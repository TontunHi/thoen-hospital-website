import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { resolveTaskPermissions } from '@/lib/taskPermissionResolver'
import { updateTaskByManager } from '@/lib/taskInboxService'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params

    // 1. Fetch Task
    const tasks = await queryMemberDb(
      `SELECT 
        t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
        t.requester_id, t.requester_name, t.requester_dept,
        t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
        t.reference_id, t.custom_payload, t.created_at, t.updated_at,
        req.signature_path as requester_signature_path
       FROM inbox_tasks t
       LEFT JOIN members req ON t.requester_id = req.id
       WHERE t.id = ? LIMIT 1`,
      [taskId]
    )

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลงานนี้' }, { status: 404 })
    }

    const task = tasks[0]
    let customPayload = null
    try {
      customPayload = task.custom_payload ? JSON.parse(task.custom_payload) : null
    } catch {}

    // 2. Fetch Workflow Steps
    const steps = await queryMemberDb(
      `SELECT 
        s.id, s.step_no, s.step_name, s.assignee_type, s.assigned_to_id, s.assigned_role,
        s.status, s.action_taken, s.action_by, s.action_by_name, s.action_at,
        s.comment, s.signature_path, s.signature_hash,
        m.name as assigned_to_name, m.position as assigned_to_position
       FROM inbox_task_steps s
       LEFT JOIN members m ON s.assigned_to_id = m.id
       WHERE s.task_id = ?
       ORDER BY s.step_no ASC`,
      [taskId]
    )

    // 3. Fetch Audit Logs
    const auditLogs = await queryMemberDb(
      `SELECT 
        id, action, performed_by, performer_name, details, created_at
       FROM inbox_task_audit_logs
       WHERE task_id = ?
       ORDER BY created_at ASC`,
      [taskId]
    )

    const parsedAuditLogs = auditLogs.map((log: any) => {
      let details = log.details
      try {
        details = log.details ? JSON.parse(log.details) : null
      } catch {}
      return { ...log, details }
    })

    // 4. Fetch Repair Details (if repair task)
    const repairRows = await queryMemberDb(
      'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
      [taskId]
    )
    let repairDetail = null
    if (repairRows && repairRows.length > 0) {
      const row = repairRows[0]
      let photos = []
      let coWorkers = []
      try {
        photos = row.photos ? (typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos) : []
      } catch {}
      try {
        coWorkers = row.co_workers ? (typeof row.co_workers === 'string' ? JSON.parse(row.co_workers) : row.co_workers) : []
      } catch {}
      repairDetail = {
        ...row,
        photos,
        co_workers: coWorkers,
      }
    }

    // 5. Current user info & permission check
    const currentMemberRows = await queryMemberDb(
      'SELECT id, username, name, department, position, role, signature_path FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    const currentMember = currentMemberRows[0]
    const userPos = (currentMember?.position || '').trim()

    // Check position permissions
    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)',
      [userPos]
    )
    const permissions = permRows.map((r: any) => r.permission_key)

    const memberLike = {
      id: currentMember?.id,
      username: currentMember?.username,
      name: currentMember?.name,
      role: currentMember?.role || session.role || 'member',
      position: currentMember?.position,
      department: currentMember?.department,
      permissions,
      isAdmin: Boolean(session.role === 'admin' || currentMember?.role === 'admin'),
    }

    const taskPerms = resolveTaskPermissions(memberLike, task, { repairDetail, steps })

    if (!taskPerms.canView) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงหรือดูรายละเอียดงานนี้' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: {
        task: {
          ...task,
          custom_payload: customPayload,
        },
        steps,
        repairDetail,
        auditLogs: parsedAuditLogs,
        currentUser: {
          id: currentMember?.id,
          name: currentMember?.name,
          position: currentMember?.position,
          role: currentMember?.role,
          hasSignature: !!currentMember?.signature_path,
          isRequester: taskPerms.isRequester,
          isCurrentAssignee: taskPerms.isCurrentAssignee,
          isCoWorker: taskPerms.isCoWorker,
          isAdmin: taskPerms.isAdmin,
          canManageTask: taskPerms.canEdit,
          permissions: taskPerms,
        },
      },
    })
  } catch (error: any) {
    console.error('Fetch task detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลงาน' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)',
      [(currentMember.position || '').trim()]
    )
    const permissions = permRows.map((r: any) => r.permission_key)

    const memberLike = {
      id: currentMember.id,
      username: currentMember.username,
      name: currentMember.name,
      role: currentMember.role || session.role || 'member',
      position: currentMember.position,
      department: currentMember.department,
      permissions,
      isAdmin: Boolean(session.role === 'admin' || currentMember.role === 'admin'),
    }

    const body = await request.json()

    const result = await updateTaskByManager({
      taskId,
      performer: memberLike,
      updates: body,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลงาน' },
        { status: result.statusCode || 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      diff: result.diff,
    })
  } catch (error: any) {
    console.error('Manager edit task error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลงาน' }, { status: 500 })
  }
}
