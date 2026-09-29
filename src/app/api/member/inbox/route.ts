import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { generateTaskNo, notifyAssigneeOnTelegram, REGISTERED_TASK_TYPES, WorkflowStepDefinition } from '@/lib/taskInboxService'
import crypto from 'crypto'

// GET: Fetch list of tasks for unified inbox (pending for this user, created by this user, or all if admin)
export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'inbox' // 'inbox' (waiting for me), 'my-requests' (created by me), 'all' (all tasks in system)
    const type = searchParams.get('type') // filter by taskType
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()

    // 1. Get current member info
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]
    const memberId = currentMember.id
    const userRole = currentMember.role
    const userPosition = (currentMember.position || '').trim()

    // 2. Check admin or management permissions
    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE position_name = ?',
      [userPosition]
    )
    const hasPerm = (key: string) => permRows.some((p: any) => p.permission_key === key)
    const canViewAll = userRole === 'admin' || hasPerm('manage_inbox') || hasPerm('manage_repairs') || hasPerm('view_all_work')

    let whereClauses: string[] = []
    let queryParams: any[] = []

    if (tab === 'my-requests') {
      // Tasks submitted by the user
      whereClauses.push('t.requester_id = ?')
      queryParams.push(memberId)
    } else if (tab === 'all') {
      // All tasks view (allowed for admin or managers; fallback to own tasks if not allowed)
      if (!canViewAll) {
        whereClauses.push('(t.requester_id = ? OR t.current_assignee = ?)')
        queryParams.push(memberId, memberId)
      }
      // If canViewAll, no restriction unless filtered
    } else {
      // Default 'inbox': Tasks waiting for this specific user, user's assigned role/position, or where user is co-worker
      whereClauses.push(
        `(t.status = 'PENDING' AND (
          t.current_assignee = ? 
          OR (t.current_role IS NOT NULL AND (t.current_role = ? OR t.current_role = ?))
          OR EXISTS (
            SELECT 1 FROM repair_details rd 
            WHERE rd.task_id = t.id 
            AND JSON_CONTAINS(rd.co_workers, JSON_OBJECT('id', ?))
          )
        ))`
      )
      queryParams.push(memberId, userPosition, userRole, memberId)
    }

    if (type) {
      whereClauses.push('t.task_type = ?')
      queryParams.push(type)
    }

    if (status) {
      whereClauses.push('t.status = ?')
      queryParams.push(status)
    }

    if (search) {
      whereClauses.push('(t.task_no LIKE ? OR t.title LIKE ? OR t.requester_name LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const tasks = await queryMemberDb(
      `SELECT 
        t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
        t.requester_id, t.requester_name, t.requester_dept,
        t.status, t.current_step_no, t.current_assignee, t.current_role,
        t.reference_id, t.created_at, t.updated_at,
        s.step_name as current_step_name
       FROM inbox_tasks t
       LEFT JOIN inbox_task_steps s ON t.id = s.task_id AND t.current_step_no = s.step_no
       ${whereSql}
       ORDER BY 
         CASE WHEN t.urgency = 'VERY_URGENT' THEN 1 WHEN t.urgency = 'URGENT' THEN 2 ELSE 3 END ASC,
         t.updated_at DESC
       LIMIT 100`,
      queryParams
    )

    // Summary count for badges and stats cards
    const inboxBadgeRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t 
       WHERE t.status = 'PENDING' 
       AND (
         t.current_assignee = ? 
         OR (t.current_role IS NOT NULL AND (t.current_role = ? OR t.current_role = ?))
         OR EXISTS (
           SELECT 1 FROM repair_details rd 
           WHERE rd.task_id = t.id 
           AND JSON_CONTAINS(rd.co_workers, JSON_OBJECT('id', ?))
         )
       )`,
      [memberId, userPosition, userRole, memberId]
    )
    const inboxCount = inboxBadgeRows[0]?.cnt || 0

    // Other stats for dashboard
    const allPendingRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE t.status = 'PENDING'`
    )
    const allPendingCount = allPendingRows[0]?.cnt || 0

    const approvedRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE t.status = 'APPROVED'`
    )
    const approvedCount = approvedRows[0]?.cnt || 0

    const myRequestsRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE t.requester_id = ?`,
      [memberId]
    )
    const myRequestsCount = myRequestsRows[0]?.cnt || 0

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        inboxCount,
        canViewAll,
        stats: {
          pendingCount: inboxCount,
          allPendingCount,
          approvedCount,
          myRequestsCount,
        },
      },
    })
  } catch (error: any) {
    console.error('Unified inbox GET error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงรายการงาน' }, { status: 500 })
  }
}

// POST: Create a new task and initiate workflow steps
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const body = await request.json()
    const { taskType, title, description, urgency = 'NORMAL', customPayload, steps } = body

    if (!taskType || !title) {
      return NextResponse.json({ error: 'กรุณาระบุประเภทงานและหัวข้อเรื่อง' }, { status: 400 })
    }

    const typeConfig = REGISTERED_TASK_TYPES[taskType]
    if (!typeConfig) {
      return NextResponse.json({ error: 'ประเภทงานไม่ถูกต้อง' }, { status: 400 })
    }

    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo(taskType)

    // Workflow steps configuration (custom steps or fallback to default registered steps)
    const workflowSteps: WorkflowStepDefinition[] = (steps && steps.length > 0) ? steps : typeConfig.defaultSteps

    // First Step Assignee
    const firstStep = workflowSteps[0]
    const initialAssignee = firstStep.assignedToId || null
    const initialRole = firstStep.assignedRole || null

    // 1. Insert into inbox_tasks
    await queryMemberDb(
      `INSERT INTO inbox_tasks 
       (id, task_no, task_type, title, description, urgency, requester_id, requester_name, requester_dept, status, current_step_no, current_assignee, current_role, custom_payload) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?)`,
      [
        taskId,
        taskNo,
        taskType,
        title.trim(),
        description || '',
        urgency,
        currentMember.id,
        currentMember.name || session.username,
        currentMember.department || null,
        initialAssignee,
        initialRole,
        customPayload ? JSON.stringify(customPayload) : null,
      ]
    )

    // 2. Insert workflow steps into inbox_task_steps
    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i]
      const stepId = crypto.randomUUID()
      const stepStatus = i === 0 ? 'PENDING' : 'WAITING'

      await queryMemberDb(
        `INSERT INTO inbox_task_steps 
         (id, task_id, step_no, step_name, assignee_type, assigned_to_id, assigned_role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stepId,
          taskId,
          step.stepNo || (i + 1),
          step.stepName,
          step.assigneeType || 'INDIVIDUAL',
          step.assignedToId || null,
          step.assignedRole || null,
          stepStatus,
        ]
      )
    }

    // 3. Write Audit Log
    const auditId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'CREATE_TASK', ?, ?, ?)`,
      [
        auditId,
        taskId,
        currentMember.id,
        currentMember.name || session.username,
        JSON.stringify({ taskNo, taskType, title, initialAssignee }),
      ]
    )

    // 4. Send Telegram Notification to the first assignee if linked
    if (initialAssignee) {
      notifyAssigneeOnTelegram({
        taskId,
        taskNo,
        taskType,
        title,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department,
        assigneeId: initialAssignee,
        stepName: firstStep.stepName,
      }).catch((e) => console.error('Telegram dispatch error on task creation:', e))
    }

    return NextResponse.json({
      success: true,
      message: 'สร้างงานและส่งเข้าสู่กระบวนการเรียบร้อยแล้ว',
      data: { taskId, taskNo },
    })
  } catch (error: any) {
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างคำขอ' }, { status: 500 })
  }
}
