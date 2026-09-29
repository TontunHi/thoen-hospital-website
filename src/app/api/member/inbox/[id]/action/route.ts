import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { generateSignatureStampHash, notifyAssigneeOnTelegram } from '@/lib/taskInboxService'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = await request.json()
    const { action, comment, nextAssigneeId, partialEdits } = body

    if (!['APPROVE', 'REJECT', 'SEND_BACK'].includes(action)) {
      return NextResponse.json({ error: 'Action ไม่ถูกต้อง' }, { status: 400 })
    }

    // 1. Fetch current member
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role, signature_path FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    // 2. Fetch Task and current Step
    const tasks = await queryMemberDb(
      'SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1',
      [taskId]
    )
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: 'ไม่พบงานที่ระบุ' }, { status: 404 })
    }
    const task = tasks[0]

    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'งานนี้ไม่อยู่ในสถานะที่สามารถดำเนินการได้' }, { status: 400 })
    }

    // Verify authority
    const isDirectAssignee = task.current_assignee === currentMember.id
    const isRoleAssignee = task.current_role && (task.current_role === currentMember.position || task.current_role === currentMember.role)
    const isAdmin = currentMember.role === 'admin'

    if (!isDirectAssignee && !isRoleAssignee && !isAdmin) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้' }, { status: 403 })
    }

    // 3. Fetch steps to determine next step
    const steps = await queryMemberDb(
      'SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC',
      [taskId]
    )
    const currentStep = steps.find((s: any) => s.step_no === task.current_step_no)
    if (!currentStep) {
      return NextResponse.json({ error: 'ไม่พบขั้นตอนปัจจุบันของงาน' }, { status: 500 })
    }

    const nowStr = new Date().toISOString()

    // 4. Handle Partial Edits if any (e.g. updating custom_payload or budget/notes)
    if (partialEdits && typeof partialEdits === 'object' && Object.keys(partialEdits).length > 0) {
      let existingPayload = {}
      try {
        existingPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
      } catch {}

      const updatedPayload = { ...existingPayload, ...partialEdits }
      await queryMemberDb(
        'UPDATE inbox_tasks SET custom_payload = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(updatedPayload), taskId]
      )

      // Audit partial edits
      const auditEditId = crypto.randomUUID()
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs 
         (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'PARTIAL_EDIT', ?, ?, ?)`,
        [
          auditEditId,
          taskId,
          currentMember.id,
          currentMember.name || session.username,
          JSON.stringify({ changes: partialEdits, previous: existingPayload }),
        ]
      )
    }

    // 5. Handle Action: APPROVE
    if (action === 'APPROVE') {
      // Signature Hash
      let sigHash = null
      if (currentMember.signature_path) {
        sigHash = generateSignatureStampHash({
          taskId,
          stepNo: currentStep.step_no,
          signerId: currentMember.id,
          timestamp: nowStr,
        })
      }

      // Mark current step COMPLETED
      await queryMemberDb(
        `UPDATE inbox_task_steps 
         SET status = 'COMPLETED', action_taken = 'APPROVE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?, signature_path = ?, signature_hash = ?
         WHERE id = ?`,
        [
          currentMember.id,
          currentMember.name || session.username,
          comment || 'อนุมัติเรียบร้อย',
          currentMember.signature_path || null,
          sigHash,
          currentStep.id,
        ]
      )

      // Check if there is a next step
      const nextStep = steps.find((s: any) => s.step_no === task.current_step_no + 1)
      if (nextStep) {
        // Advance to next step
        const nextAssignee = nextAssigneeId || nextStep.assigned_to_id || null
        await queryMemberDb(
          `UPDATE inbox_tasks 
           SET current_step_no = ?, current_assignee = ?, current_role = ?, status = 'PENDING', updated_at = NOW()
           WHERE id = ?`,
          [nextStep.step_no, nextAssignee, nextStep.assigned_role, taskId]
        )

        await queryMemberDb(
          `UPDATE inbox_task_steps SET status = 'PENDING', assigned_to_id = ? WHERE id = ?`,
          [nextAssignee, nextStep.id]
        )

        // Dispatch Telegram to next assignee
        if (nextAssignee) {
          notifyAssigneeOnTelegram({
            taskId,
            taskNo: task.task_no,
            taskType: task.task_type,
            title: task.title,
            requesterName: task.requester_name,
            requesterDept: task.requester_dept,
            assigneeId: nextAssignee,
            stepName: nextStep.step_name,
          }).catch((e) => console.error('Telegram dispatch error on next step:', e))
        }
      } else {
        // Final Step Completed! Entire Task is APPROVED
        await queryMemberDb(
          `UPDATE inbox_tasks SET status = 'APPROVED', current_assignee = NULL, current_role = NULL, updated_at = NOW() WHERE id = ?`,
          [taskId]
        )

        // Notify requester on Telegram that task is fully approved
        notifyAssigneeOnTelegram({
          taskId,
          taskNo: task.task_no,
          taskType: task.task_type,
          title: `[อนุมัติแล้ว] ${task.title}`,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          assigneeId: task.requester_id,
          stepName: 'การอนุมัติเสร็จสิ้นสมบูรณ์',
        }).catch(() => {})
      }
    } 
    // 6. Handle Action: REJECT
    else if (action === 'REJECT') {
      await queryMemberDb(
        `UPDATE inbox_task_steps 
         SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
         WHERE id = ?`,
        [currentMember.id, currentMember.name || session.username, comment || 'ไม่อนุมัติ', currentStep.id]
      )

      await queryMemberDb(
        `UPDATE inbox_tasks SET status = 'REJECTED', current_assignee = NULL, current_role = NULL, updated_at = NOW() WHERE id = ?`,
        [taskId]
      )

      // Notify requester
      notifyAssigneeOnTelegram({
        taskId,
        taskNo: task.task_no,
        taskType: task.task_type,
        title: `[ไม่อนุมัติ] ${task.title}`,
        requesterName: task.requester_name,
        requesterDept: task.requester_dept,
        assigneeId: task.requester_id,
        stepName: `ถูกปฏิเสธในขั้นตอน: ${currentStep.step_name}`,
      }).catch(() => {})
    } 
    // 7. Handle Action: SEND_BACK
    else if (action === 'SEND_BACK') {
      // Send back to requester for modifications
      await queryMemberDb(
        `UPDATE inbox_task_steps 
         SET status = 'WAITING', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
         WHERE id = ?`,
        [currentMember.id, currentMember.name || session.username, comment || 'ส่งกลับแก้ไข', currentStep.id]
      )

      await queryMemberDb(
        `UPDATE inbox_tasks 
         SET status = 'SENT_BACK', current_step_no = 1, current_assignee = requester_id, current_role = NULL, updated_at = NOW() 
         WHERE id = ?`,
        [taskId]
      )

      // Reset first step to pending
      if (steps.length > 0) {
        await queryMemberDb(
          `UPDATE inbox_task_steps SET status = 'PENDING' WHERE task_id = ? AND step_no = 1`,
          [taskId]
        )
      }

      // Notify requester
      notifyAssigneeOnTelegram({
        taskId,
        taskNo: task.task_no,
        taskType: task.task_type,
        title: `[ส่งกลับแก้ไข] ${task.title}`,
        requesterName: task.requester_name,
        requesterDept: task.requester_dept,
        assigneeId: task.requester_id,
        stepName: `ส่งกลับแก้ไขโดย ${currentMember.name || session.username} (เหตุผล: ${comment || '-'})`,
      }).catch(() => {})
    }

    // Write Audit Log for the action
    const auditActionId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        auditActionId,
        taskId,
        action,
        currentMember.id,
        currentMember.name || session.username,
        JSON.stringify({ stepNo: currentStep.step_no, stepName: currentStep.step_name, comment }),
      ]
    )

    return NextResponse.json({
      success: true,
      message: `ดำเนินการ ${action} สำเร็จ`,
    })
  } catch (error: any) {
    console.error('Task action error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลคำสั่ง' }, { status: 500 })
  }
}
