import { apiGateway } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'
import { safeJsonParse } from '@/lib/utils/safeJson'
import { resolveTaskPermissions, MemberLike } from '@/lib/taskPermissionResolver'
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

export interface TaskWorkflowGatewayAdapter {
  getTaskFullDetails: typeof apiGateway.app.getTaskFullDetails
  executeWorkflowActionV2: typeof apiGateway.app.executeWorkflowActionV2
  getMemberWorkSummary: typeof apiGateway.app.getMemberWorkSummary
}

const defaultWorkflowGateway: TaskWorkflowGatewayAdapter = {
  getTaskFullDetails: (id) => apiGateway.app.getTaskFullDetails(id),
  executeWorkflowActionV2: (data) => apiGateway.app.executeWorkflowActionV2(data),
  getMemberWorkSummary: (params) => apiGateway.app.getMemberWorkSummary(params),
}

export async function executeWorkflowAction(
  input: WorkflowActionInput,
  gateway: Partial<TaskWorkflowGatewayAdapter> = {}
): Promise<WorkflowActionResult> {
  const {
    taskId,
    action,
    actorMemberId,
    actorUsername,
    actorName,
    actorPosition,
    actorRole,
    signaturePath,
    comment,
    nextAssigneeId,
    partialEdits,
    holdReason,
    holdDetails,
    targetStepNo,
    sendToRequester,
  } = input

  const gw = { ...defaultWorkflowGateway, ...gateway }

  // 1. Fetch Task & Steps via Gateway Named API
  const detailsRes = await gw.getTaskFullDetails(taskId)
  const details = (detailsRes as any)?.data ?? detailsRes
  const task = details?.task
  if (!task) {
    throw new Error('ไม่พบงานที่ระบุ')
  }

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

  const steps: any[] = details?.steps || []
  const currentStep = steps.find((s: any) => s.step_no === task.current_step_no)
  if (!currentStep) {
    throw new Error('ไม่พบขั้นตอนปัจจุบันของงาน')
  }

  // 2. Permission check using resolveTaskPermissions
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

  let sigHash: string | null = null
  if (signaturePath) {
    sigHash = generateSignatureStampHash({
      taskId,
      stepNo: currentStep.step_no,
      signerId: actorMemberId,
      timestamp: new Date().toISOString(),
    })
  }

  const wfRes = await gw.executeWorkflowActionV2({
    taskId,
    action,
    comment,
    nextAssigneeId,
    partialEdits,
    holdReason,
    holdDetails,
    targetStepNo,
    sendToRequester,
    signaturePath,
    signatureHash: sigHash,
    actor: {
      id: actorMemberId,
      username: actorUsername,
      name: actorName,
      position: actorPosition,
      role: actorRole,
    },
  })

  const parsedPayload = safeJsonParse<Record<string, any>>(task.custom_payload, {})

  if (action === 'HOLD') {
    const selectedReason = holdReason || comment || 'รอการจัดสรรงบ'
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
    await logAudit('UPDATE', 'inbox_tasks', `HOLD task ${taskId} (Reason: ${selectedReason})`, {
      username: actorUsername,
      email: '',
    })
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

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `RESUME task ${taskId} (Step ${currentStep.step_no})`, {
      username: actorUsername,
      email: '',
    })
  } else if (action === 'APPROVE') {
    const nextStep = wfRes?.nextStep ?? null
    if (nextStep) {
      const nextAssignee = nextAssigneeId || nextStep.assigned_to_id || null
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
            deliveryDate: parsedPayload.deliveryDate,
            costType: parsedPayload.costType,
            workTypesSummary: parsedPayload.workTypesSummary,
          }).catch(() => {})
        }
      } else {
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
          deliveryDate: parsedPayload.deliveryDate,
          costType: parsedPayload.costType,
          workTypesSummary: parsedPayload.workTypesSummary,
        }).catch(() => {})
      }
    } else {
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

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `${action} task ${taskId} (Step ${currentStep.step_no})`, {
      username: actorUsername,
      email: '',
    })
  } else if (action === 'REJECT') {
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

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `${action} task ${taskId} (Step ${currentStep.step_no})`, {
      username: actorUsername,
      email: '',
    })
  } else if (action === 'SEND_BACK') {
    const targetStep = wfRes?.targetStep ?? null
    if (!targetStep || sendToRequester || task.current_step_no <= 1) {
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

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `${action} task ${taskId} (Step ${currentStep.step_no})`, {
      username: actorUsername,
      email: '',
    })
  } else if (action === 'COMPLETE') {
    const finalComment = comment?.trim() || 'ดำเนินการเสร็จสิ้นเรียบร้อย'
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

    const { logAudit } = await import('@/lib/audit')
    await logAudit('UPDATE', 'inbox_tasks', `${action} task ${taskId} (Step ${currentStep.step_no})`, {
      username: actorUsername,
      email: '',
    })
  }

  return {
    success: true,
    message: wfRes?.message || `ดำเนินการ ${action} สำเร็จ`,
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
  static async getMemberWorkSummary(
    params: MemberWorkSummaryParams | number,
    gateway: Partial<TaskWorkflowGatewayAdapter> = {}
  ): Promise<MemberWorkSummary> {
    const gw = { ...defaultWorkflowGateway, ...gateway }
    const memberId = typeof params === 'number' ? params : params.memberId
    const role = typeof params === 'number' ? undefined : params.role || undefined
    const position = typeof params === 'number' ? undefined : (params.position || '').trim() || undefined

    try {
      const summary = await gw.getMemberWorkSummary({ memberId, role, position })
      return {
        pendingInboxCount: Number(summary?.pendingInboxCount || 0),
        pendingRegistrationsCount: Number(summary?.pendingRegistrationsCount || 0),
      }
    } catch (err) {
      logger.error({ err, memberId }, 'TaskInboxService.getMemberWorkSummary gateway error')
      return {
        pendingInboxCount: 0,
        pendingRegistrationsCount: 0,
      }
    }
  }
}

export const getMemberWorkSummary = TaskInboxService.getMemberWorkSummary
