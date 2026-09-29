import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import crypto from 'crypto'

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
        t.status, t.current_step_no, t.current_assignee, t.current_role,
        t.reference_id, t.custom_payload, t.created_at, t.updated_at
       FROM inbox_tasks t
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

    const isRequester = task.requester_id === currentMember?.id
    const isCurrentAssignee = task.current_assignee === currentMember?.id || 
      (task.current_role && (task.current_role === currentMember?.position || task.current_role === currentMember?.role))
    const isStepSigner = steps.some((s: any) => s.assigned_to_id === currentMember?.id || s.action_by === currentMember?.id)
    const isCoWorker = repairDetail?.co_workers?.some((cw: any) => cw.id === currentMember?.id)
    const isAdmin = currentMember?.role === 'admin'

    // Strict Privacy: Only the requester, current/past assignees, co-workers, and admins can view
    if (!isRequester && !isCurrentAssignee && !isStepSigner && !isCoWorker && !isAdmin) {
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
          isRequester,
          isCurrentAssignee,
          isCoWorker,
          isAdmin,
        },
      },
    })
  } catch (error: any) {
    console.error('Fetch task detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลงาน' }, { status: 500 })
  }
}
