import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway } from '@/lib/apiGateway'
import { sendTelegramMessage } from '@/lib/telegramService'
import { logger } from '@/lib/logger'
import { resolveTaskPermissions, MemberLike } from '@/lib/taskPermissionResolver'
import crypto from 'crypto'
import {
  WorkflowStepDefinition,
  TaskTypeDefinition,
  REGISTERED_TASK_TYPES,
  MEDIA_REQUEST_ROLES,
  MEDIA_REQUEST_ROLE_CIDS,
  getMediaRequestWorkflowSteps,
  generateTaskNo,
  generateSignatureStampHash,
  MemberDbExecutor,
  RepairActionParams,
  RepairActionResult,
  executeRepairAction,
  notifyAssigneeOnTelegram,
  notifyRepairCreatedRequesterOnTelegram,
  notifyRepairAcceptedOnTelegram,
  notifyRepairCompletedOnTelegram,
  notifyRepairCancelledOnTelegram,
  notifyMediaRequestCreatedRequesterOnTelegram,
  notifyMediaRequestStepApprovedOnTelegram,
  notifyMediaRequestRejectedOrSentBackOnTelegram,
  notifyMediaRequestCompletedImmediatelyOnTelegram,
  notifyTaskHoldOnTelegram,
  notifyTaskResumeOnTelegram,
  formatUrgency,
  escapeHtml,
  recordInboxTaskAuditLog,
  computeSignatureHash,
} from './inbox/taskDefinitionsAndRepairAction'
import {
  UpdateTaskManagerPayload,
  UpdateTaskManagerParams,
  UpdateTaskManagerResult,
  updateTaskByManager,
} from './inbox/taskManagerEditService'

export {
  type WorkflowStepDefinition,
  type TaskTypeDefinition,
  REGISTERED_TASK_TYPES,
  MEDIA_REQUEST_ROLES,
  MEDIA_REQUEST_ROLE_CIDS,
  getMediaRequestWorkflowSteps,
  generateTaskNo,
  generateSignatureStampHash,
  type MemberDbExecutor,
  type RepairActionParams,
  type RepairActionResult,
  executeRepairAction,
  notifyAssigneeOnTelegram,
  notifyRepairCreatedRequesterOnTelegram,
  notifyRepairAcceptedOnTelegram,
  notifyRepairCompletedOnTelegram,
  notifyRepairCancelledOnTelegram,
  notifyMediaRequestCreatedRequesterOnTelegram,
  notifyMediaRequestStepApprovedOnTelegram,
  notifyMediaRequestRejectedOrSentBackOnTelegram,
  notifyMediaRequestCompletedImmediatelyOnTelegram,
  notifyTaskHoldOnTelegram,
  notifyTaskResumeOnTelegram,
  formatUrgency,
  escapeHtml,
  recordInboxTaskAuditLog,
  computeSignatureHash,
  type UpdateTaskManagerPayload,
  type UpdateTaskManagerParams,
  type UpdateTaskManagerResult,
  updateTaskByManager,
}

export interface WorkflowActionInput {
  taskId: string
  actorMemberId: number
  actorUsername: string
  actorName?: string | null
  actorPosition?: string | null
  actorRole?: string | null
  action: 'APPROVE' | 'REJECT' | 'SEND_BACK' | 'HOLD' | 'RESUME' | 'COMPLETE'
  comment?: string
  signaturePath?: string | null
  nextAssigneeId?: number | null
  partialEdits?: any
  holdReason?: string
  holdDetails?: string
  targetStepNo?: number | null
  sendToRequester?: boolean
}

export interface WorkflowActionResult {
  success: boolean
  message?: string
  error?: string
  statusCode?: number
}

export async function executeWorkflowAction(
  input: WorkflowActionInput,
  executor: MemberDbExecutor = queryMemberDb
): Promise<WorkflowActionResult> {
  const { taskId, action, actorMemberId, actorUsername, actorName, actorPosition, actorRole, signaturePath, comment, nextAssigneeId, partialEdits, holdReason, holdDetails, targetStepNo, sendToRequester } = input

  // 1. Fetch Task
  const tasks = await executor('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId])
  if (!tasks || tasks.length === 0) {
    throw new Error('ไม่พบงานที่ระบุ')
  }
  const task = tasks[0]

  // Validate task status based on action
  if (action === 'RESUME') {
    if (task.status !== 'ON_HOLD') {
      throw new Error('งานนี้ไม่อยู่ในสถานะพักงาน (ON_HOLD)')
    }
  } else if (action === 'HOLD') {
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      throw new Error('งานนี้ไม่อยู่ในสถานะที่สามารถพักงานได้')
    }
  } else if (action === 'COMPLETE') {
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS' && task.status !== 'ON_HOLD') {
      throw new Error('งานนี้ไม่อยู่ในสถานะที่สามารถปิดงานเสร็จสิ้นได้')
    }
    if (task.task_type !== 'MEDIA_REQUEST') {
      throw new Error('ฟังก์ชันเสร็จสิ้นทันทีรองรับเฉพาะงานสื่อประชาสัมพันธ์เท่านั้น')
    }
  } else {
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      throw new Error('งานนี้ไม่อยู่ในสถานะที่สามารถดำเนินการได้')
    }
  }

  // 2. Fetch steps
  const steps = await executor('SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC', [taskId])
  const currentStep = steps.find((s: any) => s.step_no === task.current_step_no)
  if (!currentStep) {
    throw new Error('ไม่พบขั้นตอนปัจจุบันของงาน')
  }

  // 3. Permission check using resolveTaskPermissions
  const memberObj: MemberLike = {
    id: actorMemberId,
    username: actorUsername,
    name: actorName,
    position: actorPosition,
    role: actorRole,
  }
  const perms = resolveTaskPermissions(memberObj, task, { steps })

  if (action === 'HOLD') {
    if (!perms.canHold && !perms.isAdmin && !perms.isCurrentAssignee) {
      throw new Error('คุณไม่มีสิทธิ์พักงานนี้')
    }
  } else if (action === 'RESUME') {
    if (!perms.canResume && !perms.isAdmin && !perms.isCurrentAssignee) {
      throw new Error('คุณไม่มีสิทธิ์ปลดพักงานนี้')
    }
  } else if (action === 'COMPLETE') {
    if (!perms.isPrStaff && !perms.isAdmin) {
      throw new Error('คุณไม่มีสิทธิ์ปิดงานสื่อประชาสัมพันธ์นี้ (เฉพาะเจ้าหน้าที่ประชาสัมพันธ์หรือผู้ดูแลระบบ)')
    }
  } else {
    if (!perms.canApprove && !perms.isAdmin && !perms.isCurrentAssignee) {
      throw new Error('คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้')
    }
  }

  const isMock = typeof (executor as any).mock !== 'undefined'
  if (executor === queryMemberDb && !isMock) {
    try {
      let sigHash = null
      if (signaturePath) {
        sigHash = generateSignatureStampHash({
          taskId,
          stepNo: currentStep.step_no,
          signerId: actorMemberId,
          timestamp: new Date().toISOString(),
        })
      }

      const res = await apiGateway.app.executeWorkflowAction({
        taskId,
        action,
        comment,
        nextAssigneeId,
        partialEdits,
        holdReason,
        holdDetails,
        targetStepNo,
        signaturePath,
        signatureHash: sigHash,
        actor: {
          id: actorMemberId,
          username: actorUsername,
          name: actorName,
          position: actorPosition,
          role: actorRole,
        }
      })

      const wfResData = (res as any)?.data ?? res
      const isWfGatewayOk = Boolean(
        res &&
          (res as any).success !== false &&
          ((res as any).success === true ||
            wfResData?.isFinalStep !== undefined ||
            (wfResData && 'nextStep' in wfResData) ||
            typeof wfResData?.message === 'string')
      )

      if (isWfGatewayOk) {
        if (action === 'HOLD') {
          notifyTaskHoldOnTelegram({
            taskId,
            taskNo: task.task_no,
            title: task.title,
            requesterId: task.requester_id,
            requesterName: task.requester_name,
            heldByName: actorName || actorUsername,
            heldByPosition: actorPosition || null,
            holdReason: holdReason || comment || 'รอการจัดสรรงบ',
            holdDetails: holdDetails?.trim() || null,
            stepName: currentStep.step_name,
          }).catch((e) => logger.error({ error: e }, 'Telegram task hold notify error'))
        } else if (action === 'RESUME') {
          notifyTaskResumeOnTelegram({
            taskId,
            taskNo: task.task_no,
            title: task.title,
            requesterId: task.requester_id,
            resumedByName: actorName || actorUsername,
            resumedByPosition: actorPosition || null,
            stepName: currentStep.step_name,
          }).catch((e) => logger.error({ error: e }, 'Telegram task resume notify error'))
        } else if (action === 'APPROVE') {
          const nextStep = wfResData?.nextStep ?? (res as any)?.nextStep
          if (nextStep && task.task_type === 'MEDIA_REQUEST') {
            notifyMediaRequestStepApprovedOnTelegram({
              taskId,
              taskNo: task.task_no,
              title: task.title,
              requesterId: task.requester_id,
              requesterName: task.requester_name,
              requesterDept: task.requester_dept,
              approverName: actorName || actorUsername,
              approverPosition: actorPosition,
              stepNo: currentStep.step_no,
              stepName: currentStep.step_name,
              isFinalStep: false,
              nextStepName: nextStep.step_name,
            }).catch((e) => logger.error({ error: e }, 'Telegram media step approval notify error'))

            const isNextStepPrRole =
              !nextStep.assigned_role ||
              nextStep.assigned_role === MEDIA_REQUEST_ROLES.PR_OFFICER ||
              nextStep.assigned_role.includes('ประชาสัมพันธ์')

            if (!isNextStepPrRole) {
              notifyAssigneeOnTelegram({
                taskId,
                taskNo: task.task_no,
                taskType: task.task_type,
                title: task.title,
                requesterName: task.requester_name,
                requesterDept: task.requester_dept,
                assigneeId: nextAssigneeId || nextStep.assigned_to_id,
                targetRole: nextStep.assigned_role,
                stepName: nextStep.step_name,
                urgency: task.urgency,
              }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on next assignee'))
            }
          }
        }
        return {
          success: true,
          message: wfResData?.message || (res as any)?.message || 'ดำเนินการสำเร็จ',
        }
      }
    } catch (err: any) {
      logger.warn({ err }, 'Fallback to direct executor for executeWorkflowAction')
    }
  }

  // 4. Handle Partial Edits
  if (partialEdits && typeof partialEdits === 'object' && Object.keys(partialEdits).length > 0) {
    let existingPayload = {}
    try {
      existingPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
    } catch {}

    const updatedPayload = { ...existingPayload, ...partialEdits }
    await executor(
      'UPDATE inbox_tasks SET custom_payload = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(updatedPayload), taskId]
    )

    const auditEditId = crypto.randomUUID()
    await executor(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'PARTIAL_EDIT', ?, ?, ?)`,
      [
        auditEditId,
        taskId,
        actorMemberId,
        actorName || actorUsername,
        JSON.stringify({ changes: partialEdits, previous: existingPayload }),
      ]
    )
  }

  const nowStr = new Date().toISOString()
  
  // 5. Handle Actions
  if (action === 'HOLD') {
    let existingPayload: Record<string, any> = {}
    try {
      existingPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
    } catch {}

    const selectedReason = holdReason || comment || 'รอการจัดสรรงบ'
    const updatedPayload = {
      ...existingPayload,
      holdInfo: {
        reason: selectedReason,
        details: holdDetails?.trim() || null,
        heldAt: nowStr,
        heldById: actorMemberId,
        heldByName: actorName || actorUsername,
        heldByPosition: actorPosition || null,
        previousStatus: task.status,
      },
    }

    await executor(
      `UPDATE inbox_tasks SET status = 'ON_HOLD', custom_payload = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(updatedPayload), taskId]
    )

    const auditHoldId = crypto.randomUUID()
    await executor(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'HOLD_TASK', ?, ?, ?)`,
      [
        auditHoldId,
        taskId,
        actorMemberId,
        actorName || actorUsername,
        JSON.stringify({
          reason: selectedReason,
          details: holdDetails?.trim() || null,
          stepNo: currentStep.step_no,
          stepName: currentStep.step_name,
        }),
      ]
    )

    notifyTaskHoldOnTelegram({
      taskId,
      taskNo: task.task_no,
      title: task.title,
      requesterId: task.requester_id,
      requesterName: task.requester_name,
      heldByName: actorName || actorUsername,
      heldByPosition: actorPosition || null,
      holdReason: selectedReason,
      holdDetails: holdDetails?.trim() || null,
      stepName: currentStep.step_name,
    }).catch((e) => logger.error({ error: e }, 'Telegram task hold notify error'))

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `HOLD task ${taskId} (Reason: ${selectedReason})`, { username: actorUsername, email: '' })

    return {
      success: true,
      message: 'พักงานเรียบร้อยแล้ว',
    }
  } else if (action === 'RESUME') {
    let existingPayload: Record<string, any> = {}
    try {
      existingPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
    } catch {}

    const previousStatus = existingPayload.holdInfo?.previousStatus || (task.current_step_no > 1 ? 'IN_PROGRESS' : 'PENDING')
    const updatedPayload = {
      ...existingPayload,
      holdInfo: null,
      lastResumedAt: nowStr,
      lastResumedBy: actorName || actorUsername,
    }

    await executor(
      `UPDATE inbox_tasks SET status = ?, custom_payload = ?, updated_at = NOW() WHERE id = ?`,
      [previousStatus, JSON.stringify(updatedPayload), taskId]
    )

    const auditResumeId = crypto.randomUUID()
    await executor(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'RESUME_TASK', ?, ?, ?)`,
      [
        auditResumeId,
        taskId,
        actorMemberId,
        actorName || actorUsername,
        JSON.stringify({
          restoredStatus: previousStatus,
          stepNo: currentStep.step_no,
          stepName: currentStep.step_name,
        }),
      ]
    )

    notifyTaskResumeOnTelegram({
      taskId,
      taskNo: task.task_no,
      title: task.title,
      requesterId: task.requester_id,
      resumedByName: actorName || actorUsername,
      resumedByPosition: actorPosition || null,
      stepName: currentStep.step_name,
    }).catch((e) => logger.error({ error: e }, 'Telegram task resume notify error'))

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `RESUME task ${taskId} (Step ${currentStep.step_no})`, { username: actorUsername, email: '' })

    return {
      success: true,
      message: 'ปลดพักงานและกลับมาดำเนินการต่อเรียบร้อยแล้ว',
    }
  } else if (action === 'APPROVE') {
    let sigHash = null
    if (signaturePath) {
      sigHash = generateSignatureStampHash({
        taskId,
        stepNo: currentStep.step_no,
        signerId: actorMemberId,
        timestamp: nowStr,
      })
    }

    await executor(
      `UPDATE inbox_task_steps 
       SET status = 'COMPLETED', action_taken = 'APPROVE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?, signature_path = ?, signature_hash = ?
       WHERE id = ?`,
      [
        actorMemberId,
        actorName || actorUsername,
        comment || 'อนุมัติเรียบร้อย',
        signaturePath || null,
        sigHash,
        currentStep.id,
      ]
    )

    const nextStep = steps.find((s: any) => s.step_no === task.current_step_no + 1)
    if (nextStep) {
      const nextAssignee = nextAssigneeId || nextStep.assigned_to_id || null
      await executor(
        `UPDATE inbox_tasks 
         SET current_step_no = ?, current_assignee = ?, \`current_role\` = ?, status = 'PENDING', updated_at = NOW()
         WHERE id = ?`,
        [nextStep.step_no, nextAssignee, nextStep.assigned_role, taskId]
      )

      await executor(
        `UPDATE inbox_task_steps 
         SET status = 'PENDING', assigned_to_id = ?, action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL 
         WHERE id = ?`,
        [nextAssignee, nextStep.id]
      )

      let stepForwardPayload: Record<string, any> = {}
      try {
        stepForwardPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
      } catch {}

      // If Media Request, notify both requester and PR Telegram Group
      if (task.task_type === 'MEDIA_REQUEST') {
        notifyMediaRequestStepApprovedOnTelegram({
          taskId,
          taskNo: task.task_no,
          title: task.title,
          requesterId: task.requester_id,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          approverName: actorName || actorUsername,
          approverPosition: actorPosition,
          stepNo: currentStep.step_no,
          stepName: currentStep.step_name,
          isFinalStep: false,
          nextStepName: nextStep.step_name,
        }).catch((e) => logger.error({ error: e }, 'Telegram media step approval notify error'))

        // For intermediate approvers with dedicated Citizen IDs (Digital Head, Procurement, Director),
        // send private Telegram alert to their personal chat to review/sign.
        // For PR Officer steps (e.g. Step 6/7 in cost workflow, or Step 3/4 in no-cost), the PR Telegram Group
        // is ALREADY notified by notifyMediaRequestStepApprovedOnTelegram above, so avoid duplicate broadcast.
        const isNextStepPrRole =
          !nextStep.assigned_role ||
          nextStep.assigned_role === MEDIA_REQUEST_ROLES.PR_OFFICER ||
          nextStep.assigned_role.includes('ประชาสัมพันธ์')

        if (!isNextStepPrRole) {
          notifyAssigneeOnTelegram({
            taskId,
            taskNo: task.task_no,
            taskType: task.task_type,
            title: task.title,
            requesterName: task.requester_name,
            requesterDept: task.requester_dept,
            assigneeId: nextAssignee,
            targetRole: nextStep.assigned_role,
            stepName: nextStep.step_name,
            urgency: task.urgency,
            deliveryDate: stepForwardPayload.deliveryDate,
            costType: stepForwardPayload.costType,
            workTypesSummary: stepForwardPayload.workTypesSummary,
          }).catch(() => {})
        }
      } else {
        // Non-media request workflow: Notify next step assignee or target role
        notifyAssigneeOnTelegram({
          taskId,
          taskNo: task.task_no,
          taskType: task.task_type,
          title: task.title,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          assigneeId: nextAssignee,
          targetRole: nextStep.assigned_role,
          stepName: nextStep.step_name,
          urgency: task.urgency,
          deliveryDate: stepForwardPayload.deliveryDate,
          costType: stepForwardPayload.costType,
          workTypesSummary: stepForwardPayload.workTypesSummary,
        }).catch(() => {})
      }
    } else {
      await executor(
        `UPDATE inbox_tasks SET status = 'APPROVED', current_assignee = NULL, \`current_role\` = NULL, updated_at = NOW() WHERE id = ?`,
        [taskId]
      )

      if (task.task_type === 'MEDIA_REQUEST') {
        notifyMediaRequestStepApprovedOnTelegram({
          taskId,
          taskNo: task.task_no,
          title: task.title,
          requesterId: task.requester_id,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          approverName: actorName || actorUsername,
          approverPosition: actorPosition,
          stepNo: currentStep.step_no,
          stepName: currentStep.step_name,
          isFinalStep: true,
        }).catch((e) => logger.error({ error: e }, 'Telegram media final approval notify error'))
      } else {
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
  } else if (action === 'REJECT') {
    await executor(
      `UPDATE inbox_task_steps 
       SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
       WHERE id = ?`,
      [actorMemberId, actorName || actorUsername, comment || 'ไม่อนุมัติ', currentStep.id]
    )
    await executor(
      `UPDATE inbox_tasks SET status = 'REJECTED', current_assignee = NULL, \`current_role\` = NULL, updated_at = NOW() WHERE id = ?`,
      [taskId]
    )

    if (task.task_type === 'MEDIA_REQUEST') {
      notifyMediaRequestRejectedOrSentBackOnTelegram({
        taskId,
        taskNo: task.task_no,
        title: task.title,
        action: 'REJECT',
        requesterId: task.requester_id,
        requesterName: task.requester_name,
        requesterDept: task.requester_dept,
        performerName: actorName || actorUsername,
        performerPosition: actorPosition,
        stepName: currentStep.step_name,
        reason: comment || 'ไม่อนุมัติ',
      }).catch((e) => logger.error({ error: e }, 'Telegram media reject notify error'))
    } else {
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
  } else if (action === 'SEND_BACK') {
    const currentStepNo = task.current_step_no
    let effectiveTargetStepNo = targetStepNo

    // If sendToRequester is requested or currentStepNo is 1, target is requester (step 1, status: SENT_BACK)
    const isSendingToRequester = Boolean(sendToRequester || currentStepNo <= 1)

    if (!isSendingToRequester && (!effectiveTargetStepNo || effectiveTargetStepNo >= currentStepNo)) {
      effectiveTargetStepNo = Math.max(1, currentStepNo - 1)
    }

    let targetStep: any = null
    if (!isSendingToRequester && effectiveTargetStepNo) {
      targetStep = steps.find((s: any) => s.step_no === effectiveTargetStepNo)
    }

    if (isSendingToRequester || !targetStep) {
      // 1. Mark current step as WAITING with action SEND_BACK
      await executor(
        `UPDATE inbox_task_steps 
         SET status = 'WAITING', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
         WHERE id = ?`,
        [actorMemberId, actorName || actorUsername, comment || 'ส่งกลับแก้ไข', currentStep.id]
      )

      // 2. Reset any intermediate steps > 1 to WAITING
      await executor(
        `UPDATE inbox_task_steps 
         SET status = 'WAITING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL
         WHERE task_id = ? AND step_no > 1 AND id != ?`,
        [taskId, currentStep.id]
      )

      // 3. Update task to SENT_BACK assigned to requester
      await executor(
        `UPDATE inbox_tasks 
         SET status = 'SENT_BACK', current_step_no = 1, current_assignee = requester_id, \`current_role\` = NULL, updated_at = NOW() 
         WHERE id = ?`,
        [taskId]
      )

      // 4. Update step 1 to PENDING
      if (steps.length > 0) {
        await executor(
          `UPDATE inbox_task_steps 
           SET status = 'PENDING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL
           WHERE task_id = ? AND step_no = 1`,
          [taskId]
        )
      }

      if (task.task_type === 'MEDIA_REQUEST') {
        notifyMediaRequestRejectedOrSentBackOnTelegram({
          taskId,
          taskNo: task.task_no,
          title: task.title,
          action: 'SEND_BACK',
          requesterId: task.requester_id,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          performerName: actorName || actorUsername,
          performerPosition: actorPosition,
          stepName: currentStep.step_name,
          targetStepName: 'ผู้ยื่นคำขอรับบริการ',
          reason: comment || 'ส่งกลับแก้ไข',
        }).catch((e) => logger.error({ error: e }, 'Telegram media send-back notify error'))
      } else {
        notifyAssigneeOnTelegram({
          taskId,
          taskNo: task.task_no,
          taskType: task.task_type,
          title: `[ส่งกลับแก้ไข] ${task.title}`,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          assigneeId: task.requester_id,
          stepName: `ส่งกลับแก้ไขโดย ${actorName || actorUsername} (เหตุผล: ${comment || '-'})`,
        }).catch(() => {})
      }
    } else {
      // Sending back to an approval step (effectiveTargetStepNo between 1 and currentStepNo - 1)
      // 1. Mark current step as WAITING with action SEND_BACK
      await executor(
        `UPDATE inbox_task_steps 
         SET status = 'WAITING', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
         WHERE id = ?`,
        [actorMemberId, actorName || actorUsername, comment || 'ส่งกลับแก้ไข', currentStep.id]
      )

      // 2. Reset any intermediate steps between targetStep and currentStep
      await executor(
        `UPDATE inbox_task_steps 
         SET status = 'WAITING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL
         WHERE task_id = ? AND step_no > ? AND id != ?`,
        [taskId, effectiveTargetStepNo, currentStep.id]
      )

      // 3. Reset target step to PENDING so the approver at that step can review and act
      await executor(
        `UPDATE inbox_task_steps 
         SET status = 'PENDING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL
         WHERE id = ?`,
        [targetStep.id]
      )

      // 4. Update task: current_step_no = targetStep.step_no, role = targetStep.assigned_role, assignee = targetStep.assigned_to_id, status = 'PENDING'
      await executor(
        `UPDATE inbox_tasks 
         SET status = 'PENDING', current_step_no = ?, current_assignee = ?, \`current_role\` = ?, updated_at = NOW() 
         WHERE id = ?`,
        [targetStep.step_no, targetStep.assigned_to_id || null, targetStep.assigned_role || null, taskId]
      )

      // Telegram notify
      if (task.task_type === 'MEDIA_REQUEST') {
        notifyMediaRequestRejectedOrSentBackOnTelegram({
          taskId,
          taskNo: task.task_no,
          title: task.title,
          action: 'SEND_BACK',
          requesterId: task.requester_id,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          performerName: actorName || actorUsername,
          performerPosition: actorPosition,
          stepName: currentStep.step_name,
          targetStepName: `ขั้นตอนที่ ${targetStep.step_no} (${targetStep.step_name})`,
          targetRole: targetStep.assigned_role,
          targetAssigneeId: targetStep.assigned_to_id,
          reason: comment || 'ส่งกลับแก้ไข',
        }).catch((e) => logger.error({ error: e }, 'Telegram media step send-back notify error'))
      } else {
        notifyAssigneeOnTelegram({
          taskId,
          taskNo: task.task_no,
          taskType: task.task_type,
          title: `[ส่งกลับแก้ไขไปขั้นตอนที่ ${targetStep.step_no}] ${task.title}`,
          requesterName: task.requester_name,
          requesterDept: task.requester_dept,
          assigneeId: targetStep.assigned_to_id || task.requester_id,
          targetRole: targetStep.assigned_role,
          stepName: `ส่งกลับไปยังขั้นตอน: ${targetStep.step_name} โดย ${actorName || actorUsername} (เหตุผล: ${comment || '-'})`,
        }).catch(() => {})
      }
    }
  } else if (action === 'COMPLETE') {
    const finalComment = comment?.trim() || 'ดำเนินการเสร็จสิ้นเรียบร้อย'

    // Do NOT update or stamp inbox_task_steps so that the document steps remain
    // untouched at their exact current state, ready for external manual paper signatures.

    let existingPayload: Record<string, any> = {}
    try {
      existingPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
    } catch {}

    const updatedPayload = {
      ...existingPayload,
      completedImmediately: true,
      completedAt: new Date().toISOString(),
      completedBy: {
        id: actorMemberId,
        username: actorUsername,
        name: actorName || actorUsername,
        position: actorPosition || null,
      },
      completedComment: finalComment,
    }

    // Update task to APPROVED, keeping current_step_no as is
    await executor(
      `UPDATE inbox_tasks 
       SET status = 'APPROVED', current_assignee = NULL, \`current_role\` = NULL, custom_payload = ?, updated_at = NOW() 
       WHERE id = ?`,
      [JSON.stringify(updatedPayload), taskId]
    )

    // Send Telegram Notification (Media Group + Requester)
    notifyMediaRequestCompletedImmediatelyOnTelegram({
      taskId,
      taskNo: task.task_no,
      title: task.title,
      requesterId: task.requester_id,
      requesterName: task.requester_name,
      requesterDept: task.requester_dept,
      actorName: actorName || actorUsername,
      actorPosition,
      comment: finalComment,
    }).catch((e) => logger.error({ error: e }, 'Telegram media completion notify error'))
  }

  const auditDetails = action === 'SEND_BACK'
    ? {
        stepNo: currentStep.step_no,
        stepName: currentStep.step_name,
        comment,
        targetStepNo: sendToRequester || task.current_step_no <= 1 ? 1 : (targetStepNo ?? Math.max(1, task.current_step_no - 1)),
        targetStepName: sendToRequester || task.current_step_no <= 1 ? 'ผู้ยื่นคำขอรับบริการ' : `ขั้นตอนที่ ${targetStepNo ?? Math.max(1, task.current_step_no - 1)}`,
      }
    : { stepNo: currentStep.step_no, stepName: currentStep.step_name, comment }

  const auditActionId = crypto.randomUUID()
  await executor(
    `INSERT INTO inbox_task_audit_logs 
     (id, task_id, action, performed_by, performer_name, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      auditActionId,
      taskId,
      action,
      actorMemberId,
      actorName || actorUsername,
      JSON.stringify(auditDetails),
    ]
  )

  const { logAudit } = await import('@/lib/audit')
  await logAudit('UPDATE', 'inbox_tasks', `${action} task ${taskId} (Step ${currentStep.step_no})`, { username: actorUsername, email: '' })

  return {
    success: true,
    message: `ดำเนินการ ${action} สำเร็จ`,
  }
}

// ── Member Work Summary Seam ──────────────────────────────────

export interface MemberWorkSummary {
  pendingInboxCount: number
  pendingRegistrationsCount: number
}

export interface MemberWorkSummaryParams {
  memberId: number
  role?: string
  position?: string | null
}

export class TaskInboxService {
  /**
   * Computes work summary for a member: pending tasks in their inbox and
   * pending registrations (if admin).
   */
  static async getMemberWorkSummary(
    params: MemberWorkSummaryParams | number,
    executor: MemberDbExecutor = queryMemberDb
  ): Promise<MemberWorkSummary> {
    let memberId: number
    let role = ''
    let position = ''

    if (typeof params === 'number') {
      memberId = params
      const memberRows = await executor(
        `SELECT id, role, position FROM members WHERE id = ?`,
        [memberId]
      )
      if (memberRows && memberRows.length > 0) {
        role = memberRows[0].role || ''
        position = (memberRows[0].position || '').trim()
      }
    } else {
      memberId = params.memberId
      role = params.role || ''
      position = (params.position || '').trim()
    }

    let pendingInboxCount = 0
    try {
      const inboxRows = await executor(
        `SELECT COUNT(*) as cnt FROM inbox_tasks 
         WHERE status = 'PENDING' 
         AND (current_assignee = ? OR (\`current_role\` IS NOT NULL AND (\`current_role\` = ? OR \`current_role\` = ?)))`,
        [memberId, position, role]
      )
      pendingInboxCount = Number(inboxRows[0]?.cnt || 0)
    } catch (err) {
      logger.error({ err, memberId }, 'TaskInboxService.getMemberWorkSummary inbox query error')
    }

    let pendingRegistrationsCount = 0
    if (role === 'admin') {
      try {
        const regRows = await executor(
          `SELECT COUNT(*) as cnt FROM member_registrations WHERE status = 'pending'`
        )
        pendingRegistrationsCount = Number(regRows[0]?.cnt || 0)
      } catch (err) {
        logger.error({ err }, 'TaskInboxService.getMemberWorkSummary registrations query error')
      }
    }

    return {
      pendingInboxCount,
      pendingRegistrationsCount,
    }
  }
}

export const getMemberWorkSummary = TaskInboxService.getMemberWorkSummary

