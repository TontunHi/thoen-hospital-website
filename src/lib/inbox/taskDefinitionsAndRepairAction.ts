import { apiGateway } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'
import { safeJsonParse } from '@/lib/utils/safeJson'
import crypto from 'crypto'

export interface WorkflowStepDefinition {
  stepNo: number
  stepName: string
  assigneeType: 'INDIVIDUAL' | 'ROLE' | 'CHAIN'
  assignedToId?: number
  assignedRole?: string
  canEditFields?: string[]
}

export interface TaskTypeDefinition {
  taskType: string
  titlePrefix: string
  name: string
  defaultSteps: WorkflowStepDefinition[]
}

export const REGISTERED_TASK_TYPES: Record<string, TaskTypeDefinition> = {
  IT_REPAIR: {
    taskType: 'IT_REPAIR',
    titlePrefix: 'IT',
    name: 'งานซ่อมคอมพิวเตอร์และสารสนเทศ',
    defaultSteps: [
      {
        stepNo: 1,
        stepName: 'ช่างรับงานและดำเนินการซ่อม',
        assigneeType: 'INDIVIDUAL',
        canEditFields: ['coWorkers', 'repairNature', 'costType', 'costAmount', 'foundProblem', 'solutionStep'],
      },
    ],
  },
  GENERAL_REPAIR: {
    taskType: 'GENERAL_REPAIR',
    titlePrefix: 'GN',
    name: 'งานซ่อมบำรุงทั่วไป / งานช่าง',
    defaultSteps: [
      {
        stepNo: 1,
        stepName: 'ช่างรับงานและดำเนินการซ่อม',
        assigneeType: 'INDIVIDUAL',
        canEditFields: ['coWorkers', 'repairNature', 'costType', 'costAmount', 'foundProblem', 'solutionStep'],
      },
    ],
  },
  MEDICAL_REPAIR: {
    taskType: 'MEDICAL_REPAIR',
    titlePrefix: 'MED',
    name: 'งานซ่อมเครื่องมือทางการแพทย์',
    defaultSteps: [
      {
        stepNo: 1,
        stepName: 'ช่างรับงานและดำเนินการซ่อม',
        assigneeType: 'INDIVIDUAL',
        canEditFields: ['coWorkers', 'repairNature', 'costType', 'costAmount', 'foundProblem', 'solutionStep'],
      },
    ],
  },
  ROOM_BOOKING: {
    taskType: 'ROOM_BOOKING',
    titlePrefix: 'RM',
    name: 'งานขอใช้ห้องประชุม / กิจกรรม',
    defaultSteps: [
      {
        stepNo: 1,
        stepName: 'หัวหน้างาน/ผู้รับผิดชอบห้องประชุม ตรวจสอบคิวห้อง',
        assigneeType: 'ROLE',
        assignedRole: 'เจ้าพนักงานธุรการ',
        canEditFields: ['assignedRoom', 'facilitiesPrepared', 'comment'],
      },
      {
        stepNo: 2,
        stepName: 'ผู้มีอำนาจลงนามอนุมัติการใช้สถานที่',
        assigneeType: 'ROLE',
        assignedRole: 'ผู้อำนวยการ',
        canEditFields: ['comment'],
      },
    ],
  },
  DOC_APPROVAL: {
    taskType: 'DOC_APPROVAL',
    titlePrefix: 'DOC',
    name: 'เอกสารขออนุมัติทั่วไป / ขอจัดซื้อ',
    defaultSteps: [
      {
        stepNo: 1,
        stepName: 'หัวหน้างานผู้ขอ ตรวจสอบเบื้องต้น',
        assigneeType: 'INDIVIDUAL',
        canEditFields: ['comment'],
      },
      {
        stepNo: 2,
        stepName: 'งานพัสดุ/การเงิน ตรวจสอบงบประมาณและระเบียบ',
        assigneeType: 'ROLE',
        assignedRole: 'เจ้าพนักงานการเงินและบัญชี',
        canEditFields: ['budgetSource', 'comment'],
      },
      {
        stepNo: 3,
        stepName: 'ผู้อำนวยการพิจารณาลงนามอนุมัติ',
        assigneeType: 'ROLE',
        assignedRole: 'ผู้อำนวยการ',
        canEditFields: ['comment'],
      },
    ],
  },
  MEDIA_REQUEST: {
    taskType: 'MEDIA_REQUEST',
    titlePrefix: 'PR',
    name: 'งานขอสื่อประชาสัมพันธ์',
    defaultSteps: [
      {
        stepNo: 1,
        stepName: 'นักประชาสัมพันธ์ ตรวจสอบและรับเรื่อง',
        assigneeType: 'ROLE',
        assignedRole: 'นักประชาสัมพันธ์',
        canEditFields: ['comment'],
      },
      {
        stepNo: 2,
        stepName: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ พิจารณาอนุมัติ',
        assigneeType: 'ROLE',
        assignedRole: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
        canEditFields: ['comment'],
      },
      {
        stepNo: 3,
        stepName: 'นักประชาสัมพันธ์ ดำเนินการผลิตสื่อ',
        assigneeType: 'ROLE',
        assignedRole: 'นักประชาสัมพันธ์',
        canEditFields: ['comment'],
      },
      {
        stepNo: 4,
        stepName: 'นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน',
        assigneeType: 'ROLE',
        assignedRole: 'นักประชาสัมพันธ์',
        canEditFields: ['comment'],
      },
    ],
  },
}

export const MEDIA_REQUEST_ROLES = {
  PR_OFFICER: 'นักประชาสัมพันธ์',
  DIGITAL_HEAD: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
  DIRECTOR: 'ผู้อำนวยการโรงพยาบาลเถิน',
} as const

export const MEDIA_REQUEST_ROLE_CIDS: Record<string, string> = {
  [MEDIA_REQUEST_ROLES.DIGITAL_HEAD]: '3510101262116',
  [MEDIA_REQUEST_ROLES.DIRECTOR]: '3540300329784',
}

export function getMediaRequestWorkflowSteps(hasCost: boolean): WorkflowStepDefinition[] {
  if (!hasCost) {
    return [
      {
        stepNo: 1,
        stepName: 'นักประชาสัมพันธ์ ตรวจสอบและรับเรื่อง',
        assigneeType: 'ROLE',
        assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
        canEditFields: ['comment'],
      },
      {
        stepNo: 2,
        stepName: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ พิจารณาอนุมัติ',
        assigneeType: 'ROLE',
        assignedRole: MEDIA_REQUEST_ROLES.DIGITAL_HEAD,
        canEditFields: ['comment'],
      },
      {
        stepNo: 3,
        stepName: 'นักประชาสัมพันธ์ ดำเนินการผลิตสื่อ',
        assigneeType: 'ROLE',
        assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
        canEditFields: ['comment'],
      },
      {
        stepNo: 4,
        stepName: 'นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน',
        assigneeType: 'ROLE',
        assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
        canEditFields: ['comment'],
      },
    ]
  }

  return [
    {
      stepNo: 1,
      stepName: 'นักประชาสัมพันธ์ ตรวจสอบและจัดทำแบบ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
      canEditFields: ['comment'],
    },
    {
      stepNo: 2,
      stepName: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ ตรวจสอบและเสนอเรื่อง',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.DIGITAL_HEAD,
      canEditFields: ['comment'],
    },
    {
      stepNo: 3,
      stepName: 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.DIRECTOR,
      canEditFields: ['comment'],
    },
    {
      stepNo: 4,
      stepName: 'นักประชาสัมพันธ์ ดำเนินการสั่งพิมพ์/ผลิตสื่อ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
      canEditFields: ['comment'],
    },
    {
      stepNo: 5,
      stepName: 'นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
      canEditFields: ['comment'],
    },
  ]
}

export interface TaskRepairGatewayAdapter {
  generateTaskNo: typeof apiGateway.app.generateTaskNo
  getTaskFullDetails: typeof apiGateway.app.getTaskFullDetails
  executeRepairActionV2: typeof apiGateway.app.executeRepairActionV2
}

const defaultTaskRepairGateway: TaskRepairGatewayAdapter = {
  generateTaskNo: (ymPrefix) => apiGateway.app.generateTaskNo(ymPrefix),
  getTaskFullDetails: (id) => apiGateway.app.getTaskFullDetails(id),
  executeRepairActionV2: (data) => apiGateway.app.executeRepairActionV2(data),
}

export async function generateTaskNo(
  taskType: string,
  gateway: Partial<TaskRepairGatewayAdapter> = {},
  now: Date = new Date()
): Promise<string> {
  const prefix = REGISTERED_TASK_TYPES[taskType]?.titlePrefix || 'TASK'
  const monthNumber = now.getMonth() + 1
  const thaiFiscalYear = now.getFullYear() + 543 + (monthNumber >= 10 ? 1 : 0)
  const monthStr = String(monthNumber).padStart(2, '0')
  const ymPrefix = `${prefix}-${thaiFiscalYear}-${monthStr}-`

  const gw = { ...defaultTaskRepairGateway, ...gateway }
  const res = await gw.generateTaskNo(ymPrefix)
  const generatedNo = (res as any)?.taskNo || (res as any)?.data?.taskNo
  if (generatedNo) return generatedNo
  const count = Number((res as any)?.count ?? 0) + 1
  return `${ymPrefix}${String(count).padStart(4, '0')}`
}

// ── Sub-domain Helper Imports & Re-exports ──────────────────
import {
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
} from './taskNotificationHelper'
import { recordInboxTaskAuditLog, computeSignatureHash } from './taskAuditLogger'

export {
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
}

export function generateSignatureStampHash(params: {
  taskId: string
  stepNo: number
  signerId: number
  timestamp: string
}): string {
  const secret = process.env.NEXTAUTH_SECRET || 'thoen-hospital-signature-secret-key-2026'
  return crypto
    .createHmac('sha256', secret)
    .update(`${params.taskId}:${params.stepNo}:${params.signerId}:${params.timestamp}`)
    .digest('hex')
}

export type MemberDbExecutor = (sql: string, params?: any[]) => Promise<any>

export interface RepairActionParams {
  taskId: string
  action: 'ACCEPT_JOB' | 'UPDATE_COWORKERS' | 'SAVE_REPAIR_PROGRESS' | 'COMPLETE_REPAIR' | 'CANCEL_JOB'
  performer: {
    id: number
    username: string
    name?: string | null
    position?: string | null
    department?: string | null
    role?: string | null
  }
  payload?: {
    newCoWorkers?: any[]
    repairNature?: string | null
    isExternalRepair?: boolean | null
    externalVendorName?: string | null
    externalReason?: string | null
    costType?: string | null
    costAmount?: number | null
    foundProblem?: string | null
    solutionStep?: string | null
    reason?: string | null
  }
  dispatchNotifications?: boolean
}

export interface RepairActionResult {
  success: boolean
  message?: string
  error?: string
  statusCode?: number
}

export async function executeRepairAction(
  params: RepairActionParams,
  gateway: Partial<TaskRepairGatewayAdapter> = {}
): Promise<RepairActionResult> {
  const { taskId, action, performer, payload = {}, dispatchNotifications = true } = params
  const gw = { ...defaultTaskRepairGateway, ...gateway }

  const detailsRes = await gw.getTaskFullDetails(taskId)
  const details = (detailsRes as any)?.data ?? detailsRes
  const task = details?.task
  if (!task) {
    return { success: false, error: 'ไม่พบงานที่ระบุ', statusCode: 404 }
  }

  const repairDetail = details?.repairDetail
  if (!repairDetail) {
    return { success: false, error: 'ไม่พบรายละเอียดงานซ่อม', statusCode: 404 }
  }

  const coWorkers = safeJsonParse<any[]>(repairDetail.co_workers, [])

  const isAssignee = task.current_assignee === performer.id
  const isCoWorker = coWorkers.some((cw: any) => cw.id === performer.id)
  const isRequester = task.requester_id === performer.id
  const isAdmin = performer.role === 'admin'

  if (!isAssignee && !isCoWorker && !isAdmin && !(action === 'CANCEL_JOB' && isRequester)) {
    return {
      success: false,
      error: 'เฉพาะช่างผู้รับผิดชอบ ผู้ยื่นคำขอ หรือผู้ดูแลระบบเท่านั้นที่สามารถดำเนินการได้',
      statusCode: 403,
    }
  }

  if (action === 'UPDATE_COWORKERS' && !Array.isArray(payload.newCoWorkers)) {
    return { success: false, error: 'ข้อมูลผู้ร่วมงานไม่ถูกต้อง', statusCode: 400 }
  }

  if (action === 'CANCEL_JOB' && (task.status === 'APPROVED' || task.status === 'REJECTED')) {
    return {
      success: false,
      error: 'ไม่สามารถยกเลิกงานที่เสร็จสิ้นหรือถูกยกเลิกไปแล้วได้',
      statusCode: 400,
    }
  }

  const res = await gw.executeRepairActionV2({
    taskId,
    action,
    performer,
    payload,
  })

  if (dispatchNotifications) {
    if (action === 'ACCEPT_JOB') {
      notifyRepairAcceptedOnTelegram({
        taskId,
        taskNo: task.task_no,
        taskType: task.task_type,
        title: task.title,
        requesterId: task.requester_id,
        technicianName: performer.name || performer.username,
        technicianPosition: performer.position,
        equipmentNumber: repairDetail.equipment_number || null,
        location: repairDetail.location_full_name || null,
      }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on accept job'))
    } else if (action === 'COMPLETE_REPAIR') {
      notifyRepairCompletedOnTelegram({
        taskId,
        taskNo: task.task_no,
        taskType: task.task_type,
        title: task.title,
        requesterId: task.requester_id,
        technicianName: performer.name || performer.username,
        costType: payload.costType || repairDetail.cost_type,
        costAmount: payload.costAmount ? Number(payload.costAmount) : repairDetail.cost_amount,
        location: repairDetail.location_full_name || null,
        solutionStep: payload.solutionStep?.trim() || repairDetail.solution_step || null,
      }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on complete repair'))
    } else if (action === 'CANCEL_JOB') {
      const cancelReasonText =
        payload.reason?.trim() ||
        (isRequester ? 'ผู้ยื่นคำขอยกเลิกรายการ' : 'ช่างปฏิเสธ/ยกเลิกงานซ่อม')
      const targetMemberId = isRequester
        ? task.current_assignee || repairDetail.assigned_technician_id
        : task.requester_id

      if (targetMemberId) {
        notifyRepairCancelledOnTelegram({
          taskId,
          taskNo: task.task_no,
          taskType: task.task_type,
          title: task.title,
          targetMemberId,
          cancelledByName: performer.name || performer.username,
          cancelledByRole: performer.position || (isRequester ? 'ผู้ยื่นคำขอ' : 'ช่างผู้รับผิดชอบ'),
          reason: cancelReasonText,
          location: repairDetail.location_full_name || null,
        }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on cancel job'))
      }
    }
  }

  return {
    success: true,
    message: res?.message || 'ดำเนินการสำเร็จ',
  }
}
