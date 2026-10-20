import { queryMemberDb } from '@/lib/memberDb'
import { sendTelegramMessage } from '@/lib/telegramService'
import { logger } from '@/lib/logger'
import { resolveTaskPermissions, MemberLike } from '@/lib/taskPermissionResolver'
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
  PROCUREMENT_OFFICER: 'เจ้าหน้าที่พัสดุ',
  PROCUREMENT_HEAD: 'หัวหน้าเจ้าหน้าที่พัสดุ',
  DIRECTOR: 'ผู้อำนวยการโรงพยาบาลเถิน',
} as const

export const MEDIA_REQUEST_ROLE_CIDS: Record<string, string> = {
  [MEDIA_REQUEST_ROLES.DIGITAL_HEAD]: '3510101262116',
  [MEDIA_REQUEST_ROLES.PROCUREMENT_OFFICER]: '1529900015359',
  [MEDIA_REQUEST_ROLES.PROCUREMENT_HEAD]: '3521000525368',
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
      stepName: 'เจ้าหน้าที่พัสดุ ตรวจสอบความถูกต้อง',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PROCUREMENT_OFFICER,
      canEditFields: ['comment'],
    },
    {
      stepNo: 4,
      stepName: 'หัวหน้าเจ้าหน้าที่พัสดุ ตรวจสอบและให้ความเห็นชอบ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PROCUREMENT_HEAD,
      canEditFields: ['comment'],
    },
    {
      stepNo: 5,
      stepName: 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.DIRECTOR,
      canEditFields: ['comment'],
    },
    {
      stepNo: 6,
      stepName: 'นักประชาสัมพันธ์ ดำเนินการสั่งพิมพ์/ผลิตสื่อ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
      canEditFields: ['comment'],
    },
    {
      stepNo: 7,
      stepName: 'นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PR_OFFICER,
      canEditFields: ['comment'],
    },
  ]
}

/**
 * Generate Next Running Task No according to Thai Fiscal Year (1 Oct - 30 Sep):
 * Format: [PREFIX]-[FISCAL_YEAR]-[MONTH]-[RUNNING 4 DIGITS] (e.g. IT-2570-10-0001)
 */
export async function generateTaskNo(
  taskType: string,
  executor: MemberDbExecutor = queryMemberDb,
  now: Date = new Date()
): Promise<string> {
  const prefix = REGISTERED_TASK_TYPES[taskType]?.titlePrefix || 'TASK'
  
  // Thai Fiscal Year: 1 October - 30 September
  // If month is Oct, Nov, Dec (>= 10), it falls into next Thai Fiscal Year (calendarYear + 543 + 1)
  const monthNumber = now.getMonth() + 1
  const thaiFiscalYear = now.getFullYear() + 543 + (monthNumber >= 10 ? 1 : 0)
  const monthStr = String(monthNumber).padStart(2, '0')
  const ymPrefix = `${prefix}-${thaiFiscalYear}-${monthStr}-`

  const rows = await executor(
    'SELECT COUNT(*) as cnt FROM inbox_tasks WHERE task_no LIKE ?',
    [`${ymPrefix}%`]
  )
  const count = (rows[0]?.cnt || 0) + 1
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
} from './inbox/taskNotificationHelper'
import { recordInboxTaskAuditLog, computeSignatureHash } from './inbox/taskAuditLogger'

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


/**
 * Generate a cryptographically strong verification hash for an e-Signature on a step
 */
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

/**
 * Centralized transactional state machine for repair tasks
 */
export async function executeRepairAction(
  params: RepairActionParams,
  executor: MemberDbExecutor = queryMemberDb
): Promise<RepairActionResult> {
  const { taskId, action, performer, payload = {}, dispatchNotifications = true } = params

  // 1. Fetch Task and Repair Detail
  const tasks = await executor('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId])
  if (!tasks || tasks.length === 0) {
    return { success: false, error: 'ไม่พบงานที่ระบุ', statusCode: 404 }
  }
  const task = tasks[0]

  const repairRows = await executor('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId])
  if (!repairRows || repairRows.length === 0) {
    return { success: false, error: 'ไม่พบรายละเอียดงานซ่อม', statusCode: 404 }
  }
  const repairDetail = repairRows[0]

  let coWorkers: any[] = []
  try {
    coWorkers = repairDetail.co_workers
      ? typeof repairDetail.co_workers === 'string'
        ? JSON.parse(repairDetail.co_workers)
        : repairDetail.co_workers
      : []
  } catch {}

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

  // ── Action 1: ACCEPT_JOB ──
  if (action === 'ACCEPT_JOB') {
    await executor(
      `UPDATE inbox_tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?`,
      [taskId]
    )
    await executor(
      `UPDATE repair_details SET repair_status = 'IN_PROGRESS', updated_at = NOW() WHERE task_id = ?`,
      [taskId]
    )
    await executor(
      `UPDATE inbox_task_steps SET status = 'IN_PROGRESS' WHERE task_id = ? AND step_no = 1`,
      [taskId]
    )

    await executor(
      `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'ACCEPT_JOB', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        taskId,
        performer.id,
        performer.name || performer.username,
        JSON.stringify({ status: 'IN_PROGRESS', technician: performer.name || performer.username }),
      ]
    )

    if (dispatchNotifications) {
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
    }

    return { success: true, message: 'รับงานซ่อมเรียบร้อยแล้ว' }
  }

  // ── Action 2: UPDATE_COWORKERS ──
  if (action === 'UPDATE_COWORKERS') {
    const { newCoWorkers } = payload
    if (!Array.isArray(newCoWorkers)) {
      return { success: false, error: 'ข้อมูลผู้ร่วมงานไม่ถูกต้อง', statusCode: 400 }
    }

    await executor(
      `UPDATE repair_details SET co_workers = ?, updated_at = NOW() WHERE task_id = ?`,
      [JSON.stringify(newCoWorkers), taskId]
    )

    await executor(
      `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'UPDATE_COWORKERS', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        taskId,
        performer.id,
        performer.name || performer.username,
        JSON.stringify({ co_workers: newCoWorkers }),
      ]
    )

    return { success: true, message: 'อัปเดตรายชื่อผู้ร่วมงานสำเร็จ' }
  }

  // ── Action 3: SAVE_REPAIR_PROGRESS ──
  if (action === 'SAVE_REPAIR_PROGRESS') {
    const {
      repairNature,
      isExternalRepair,
      externalVendorName,
      externalReason,
      costType,
      costAmount,
      foundProblem,
      solutionStep,
    } = payload

    const newRepairStatus = isExternalRepair ? 'EXTERNAL_REPAIR' : 'IN_PROGRESS'

    await executor(
      `UPDATE repair_details 
       SET repair_nature = ?,
           is_external_repair = ?,
           external_vendor_name = ?,
           external_reason = ?,
           cost_type = ?,
           cost_amount = ?,
           found_problem = ?,
           solution_step = ?,
           repair_status = ?,
           updated_at = NOW()
       WHERE task_id = ?`,
      [
        repairNature || 'NORMAL',
        isExternalRepair ? 1 : 0,
        externalVendorName?.trim() || null,
        externalReason?.trim() || null,
        costType || 'NO_COST',
        costType === 'HAS_COST' && costAmount ? Number(costAmount) : null,
        foundProblem?.trim() || null,
        solutionStep?.trim() || null,
        newRepairStatus,
        taskId,
      ]
    )

    await executor(
      `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'UPDATE_REPAIR_PROGRESS', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        taskId,
        performer.id,
        performer.name || performer.username,
        JSON.stringify({
          isExternalRepair,
          externalVendorName,
          costType,
          costAmount,
          foundProblem,
          solutionStep,
        }),
      ]
    )

    return { success: true, message: 'บันทึกข้อมูลผลการซ่อมเรียบร้อยแล้ว' }
  }

  // ── Action 4: COMPLETE_REPAIR ──
  if (action === 'COMPLETE_REPAIR') {
    const { foundProblem, solutionStep, costType, costAmount, repairNature } = payload

    await executor(
      `UPDATE repair_details 
       SET repair_status = 'COMPLETED',
           repair_nature = COALESCE(?, repair_nature),
           found_problem = COALESCE(?, found_problem),
           solution_step = COALESCE(?, solution_step),
           cost_type = COALESCE(?, cost_type),
           cost_amount = CASE WHEN ? = 'HAS_COST' THEN ? ELSE cost_amount END,
           updated_at = NOW()
       WHERE task_id = ?`,
      [
        repairNature || null,
        foundProblem?.trim() || null,
        solutionStep?.trim() || null,
        costType || null,
        costType,
        costAmount ? Number(costAmount) : null,
        taskId,
      ]
    )

    await executor(
      `UPDATE inbox_tasks SET status = 'APPROVED', updated_at = NOW() WHERE id = ?`,
      [taskId]
    )

    await executor(
      `UPDATE inbox_task_steps 
       SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = 'ดำเนินการซ่อมเสร็จสิ้นเรียบร้อย'
       WHERE task_id = ? AND step_no = 1`,
      [performer.id, performer.name || performer.username, taskId]
    )

    await executor(
      `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'COMPLETE_REPAIR', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        taskId,
        performer.id,
        performer.name || performer.username,
        JSON.stringify({ status: 'COMPLETED' }),
      ]
    )

    if (dispatchNotifications) {
      notifyRepairCompletedOnTelegram({
        taskId,
        taskNo: task.task_no,
        taskType: task.task_type,
        title: task.title,
        requesterId: task.requester_id,
        technicianName: performer.name || performer.username,
        costType: costType || repairDetail.cost_type,
        costAmount: costAmount ? Number(costAmount) : repairDetail.cost_amount,
        location: repairDetail.location_full_name || null,
        solutionStep: solutionStep?.trim() || repairDetail.solution_step || null,
      }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on complete repair'))
    }

    return { success: true, message: 'บันทึกการซ่อมเสร็จสิ้นสมบูรณ์' }
  }

  // ── Action 5: CANCEL_JOB ──
  if (action === 'CANCEL_JOB') {
    const { reason } = payload

    if (task.status === 'APPROVED' || task.status === 'REJECTED') {
      return { success: false, error: 'ไม่สามารถยกเลิกงานที่เสร็จสิ้นหรือถูกยกเลิกไปแล้วได้', statusCode: 400 }
    }

    const cancelReasonText = reason?.trim() || (isRequester ? 'ผู้ยื่นคำขอยกเลิกรายการ' : 'ช่างปฏิเสธ/ยกเลิกงานซ่อม')

    await executor(
      `UPDATE inbox_tasks SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`,
      [taskId]
    )

    await executor(
      `UPDATE repair_details SET repair_status = 'CANCELLED', updated_at = NOW() WHERE task_id = ?`,
      [taskId]
    )

    await executor(
      `UPDATE inbox_task_steps 
       SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
       WHERE task_id = ? AND step_no = 1`,
      [performer.id, performer.name || performer.username, cancelReasonText, taskId]
    )

    await executor(
      `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'CANCEL_REPAIR', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        taskId,
        performer.id,
        performer.name || performer.username,
        JSON.stringify({ status: 'REJECTED', reason: cancelReasonText }),
      ]
    )

    if (dispatchNotifications) {
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
        }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on cancel repair'))
      }
    }

    return { success: true, message: 'ยกเลิกรายการแจ้งซ่อมเรียบร้อยแล้ว' }
  }

  return { success: false, error: 'Action ที่ส่งมาไม่ถูกต้อง', statusCode: 400 }
}

export interface UpdateTaskManagerPayload {
  title?: string
  description?: string
  urgency?: string
  // For Media Request:
  costType?: 'HAS_COST' | 'NO_COST'
  estimatedBudget?: string | number
  deliveryDate?: string
  workTypesSummary?: string
  workTypes?: Array<{ key: string; label: string; customDetail?: string | null }>
  channels?: Array<{ key: string; label: string; customDetail?: string | null }>
  phone?: string | null
  driveLink?: string | null
  attachments?: Array<{ fileName: string; filePath: string; fileType?: string | null; fileSize?: number | null }>
  quotations?: Array<{ fileName: string; filePath: string; fileType?: string | null; fileSize?: number | null }>
  mediaDetails?: string
  objectives?: string
  // For Repair:
  itemCategory?: 'EQUIPMENT' | 'NON_EQUIPMENT'
  equipmentNumber?: string
  equipmentName?: string
  nonEquipmentItem?: string
  locationId?: number | null
  locationFullName?: string
  symptomDetail?: string
}

export interface UpdateTaskManagerParams {
  taskId: string
  performer: MemberLike
  updates: UpdateTaskManagerPayload
}

export interface UpdateTaskManagerResult {
  success: boolean
  message?: string
  error?: string
  statusCode?: number
  diff?: Record<string, { from: any; to: any }>
}

/**
 * Domain Service: Update task details by authorized manager/technician/requester
 * Handles dynamic workflow transformations (Step 4 for Media Request),
 * repair details updates, and writes structured field-diff audit logs.
 */
export async function updateTaskByManager(
  params: UpdateTaskManagerParams,
  executor: MemberDbExecutor = queryMemberDb
): Promise<UpdateTaskManagerResult> {
  const { taskId, performer, updates } = params

  // 1. Fetch Task
  const tasks = await executor('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId])
  if (!tasks || tasks.length === 0) {
    return { success: false, error: 'ไม่พบข้อมูลงานนี้', statusCode: 404 }
  }
  const task = tasks[0]

  // 2. Fetch Repair Detail (if any)
  const repairRows = await executor('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId])
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

  // 3. Fetch Steps
  const steps = await executor(
    'SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC',
    [taskId]
  )

  // 4. Permission Check via Domain Resolver
  const permissions = resolveTaskPermissions(performer, task, { repairDetail, steps })
  if (!permissions.canEdit) {
    return { success: false, error: 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลคำขอนี้', statusCode: 403 }
  }

  const isMediaTask = task.task_type === 'MEDIA_REQUEST'
  const isRepairTask = ['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type)

  let customPayload: Record<string, any> = {}
  try {
    customPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
  } catch {}

  const diff: Record<string, { from: any; to: any }> = {}
  const updatedTaskFields: Record<string, any> = {}

  // Basic task field diff & updates
  if (updates.title !== undefined && updates.title.trim() && updates.title.trim() !== task.title) {
    diff.title = { from: task.title, to: updates.title.trim() }
    updatedTaskFields.title = updates.title.trim()
  }
  if (updates.description !== undefined && updates.description.trim() !== (task.description || '').trim()) {
    diff.description = { from: task.description, to: updates.description.trim() }
    updatedTaskFields.description = updates.description.trim()
  }
  if (updates.urgency !== undefined && updates.urgency !== task.urgency) {
    diff.urgency = { from: task.urgency, to: updates.urgency }
    updatedTaskFields.urgency = updates.urgency
  }

  // Media Request Handling
  if (isMediaTask) {
    if (updates.costType !== undefined) {
      const oldCostType = customPayload.costType || 'NO_COST'
      if (oldCostType !== updates.costType) {
        diff.costType = { from: oldCostType, to: updates.costType }
        customPayload.costType = updates.costType

        if (updates.costType === 'HAS_COST') {
          const targetSteps = getMediaRequestWorkflowSteps(true)
          for (const s of targetSteps) {
            if (s.stepNo > 2) {
              const stepRows = await executor(
                'SELECT id, status FROM inbox_task_steps WHERE task_id = ? AND step_no = ? LIMIT 1',
                [taskId, s.stepNo]
              )
              if (!Array.isArray(stepRows) || stepRows.length === 0) {
                const stepId = crypto.randomUUID()
                await executor(
                  `INSERT INTO inbox_task_steps 
                   (id, task_id, step_no, step_name, assignee_type, assigned_role, status)
                   VALUES (?, ?, ?, ?, 'ROLE', ?, 'WAITING')`,
                  [stepId, taskId, s.stepNo, s.stepName, s.assignedRole]
                )
              } else if (stepRows[0] && (stepRows[0].status === 'WAITING' || stepRows[0].status === 'PENDING')) {
                await executor(
                  `UPDATE inbox_task_steps 
                   SET step_name = ?, assigned_role = ?
                   WHERE id = ?`,
                  [s.stepName, s.assignedRole, stepRows[0].id]
                )
              }
            }
          }
        } else if (updates.costType === 'NO_COST') {
          const targetSteps = getMediaRequestWorkflowSteps(false)
          await executor(
            `DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no > 4 AND status IN ('PENDING', 'WAITING')`,
            [taskId]
          )
          for (const s of targetSteps) {
            if (s.stepNo > 2) {
              const stepRows = await executor(
                'SELECT id, status FROM inbox_task_steps WHERE task_id = ? AND step_no = ? LIMIT 1',
                [taskId, s.stepNo]
              )
              if (Array.isArray(stepRows) && stepRows.length > 0 && stepRows[0] && (stepRows[0].status === 'WAITING' || stepRows[0].status === 'PENDING')) {
                await executor(
                  `UPDATE inbox_task_steps 
                   SET step_name = ?, assigned_role = ?
                   WHERE id = ?`,
                  [s.stepName, s.assignedRole, stepRows[0].id]
                )
              }
            }
          }
        }
      }
    }

    if (updates.estimatedBudget !== undefined && String(updates.estimatedBudget) !== String(customPayload.estimatedBudget ?? '')) {
      diff.estimatedBudget = { from: customPayload.estimatedBudget, to: updates.estimatedBudget }
      customPayload.estimatedBudget = updates.estimatedBudget
    }
    if (updates.deliveryDate !== undefined && updates.deliveryDate !== (customPayload.deliveryDate ?? '')) {
      let normDelivery = updates.deliveryDate
      if (normDelivery) {
        const parts = normDelivery.split('-')
        if (parts.length === 3) {
          let y = parseInt(parts[0], 10)
          if (y > 2400) y -= 543
          normDelivery = `${y}-${parts[1]}-${parts[2]}`
        }
      }
      diff.deliveryDate = { from: customPayload.deliveryDate, to: normDelivery }
      customPayload.deliveryDate = normDelivery
    }
    if (updates.workTypesSummary !== undefined && updates.workTypesSummary !== (customPayload.workTypesSummary ?? '')) {
      diff.workTypesSummary = { from: customPayload.workTypesSummary, to: updates.workTypesSummary }
      customPayload.workTypesSummary = updates.workTypesSummary
    }
    if (updates.mediaDetails !== undefined && updates.mediaDetails !== (customPayload.details ?? '')) {
      diff.mediaDetails = { from: customPayload.details, to: updates.mediaDetails }
      customPayload.details = updates.mediaDetails
    }
    if (updates.objectives !== undefined && updates.objectives !== (customPayload.objectives ?? '')) {
      diff.objectives = { from: customPayload.objectives, to: updates.objectives }
      customPayload.objectives = updates.objectives
    }
    if (updates.workTypes !== undefined) {
      diff.workTypes = { from: customPayload.workTypes, to: updates.workTypes }
      customPayload.workTypes = updates.workTypes
      customPayload.workTypesSummary = updates.workTypes
        .map((w: any) => (w.customDetail ? `${w.label} (${w.customDetail})` : w.label))
        .join(', ')
    }
    if (updates.channels !== undefined) {
      diff.channels = { from: customPayload.channels, to: updates.channels }
      customPayload.channels = updates.channels
    }
    if (updates.phone !== undefined && (updates.phone || null) !== (customPayload.phone ?? null)) {
      diff.phone = { from: customPayload.phone, to: updates.phone }
      customPayload.phone = updates.phone ? updates.phone.trim() : null
    }
    if (updates.driveLink !== undefined && (updates.driveLink || null) !== (customPayload.driveLink ?? null)) {
      diff.driveLink = { from: customPayload.driveLink, to: updates.driveLink }
      customPayload.driveLink = updates.driveLink ? updates.driveLink.trim() : null
    }
    if (updates.attachments !== undefined) {
      diff.attachments = { from: customPayload.attachments, to: updates.attachments }
      customPayload.attachments = updates.attachments
    }
    if (updates.quotations !== undefined) {
      diff.quotations = { from: customPayload.quotations, to: updates.quotations }
      customPayload.quotations = updates.quotations
    }

    updatedTaskFields.custom_payload = JSON.stringify(customPayload)
  }

  // Repair Task Handling
  if (isRepairTask && repairDetail) {
    const finalItemCat = updates.itemCategory || repairDetail.item_category || 'EQUIPMENT'
    const finalEqNum = updates.equipmentNumber !== undefined ? updates.equipmentNumber : repairDetail.equipment_number
    const finalEqName = updates.equipmentName !== undefined ? updates.equipmentName : repairDetail.equipment_name
    const finalNonEq = updates.nonEquipmentItem !== undefined ? updates.nonEquipmentItem : repairDetail.non_equipment_item
    const finalLocId = updates.locationId !== undefined ? updates.locationId : repairDetail.location_id
    const finalLocName = updates.locationFullName !== undefined ? updates.locationFullName : repairDetail.location_full_name
    const finalSymptom = updates.symptomDetail !== undefined ? updates.symptomDetail : repairDetail.symptom_detail

    if (updates.itemCategory !== undefined && updates.itemCategory !== repairDetail.item_category) {
      diff.itemCategory = { from: repairDetail.item_category, to: updates.itemCategory }
    }
    if (updates.equipmentNumber !== undefined && updates.equipmentNumber !== (repairDetail.equipment_number || '')) {
      diff.equipmentNumber = { from: repairDetail.equipment_number, to: updates.equipmentNumber }
    }
    if (updates.equipmentName !== undefined && updates.equipmentName !== (repairDetail.equipment_name || '')) {
      diff.equipmentName = { from: repairDetail.equipment_name, to: updates.equipmentName }
    }
    if (updates.nonEquipmentItem !== undefined && updates.nonEquipmentItem !== (repairDetail.non_equipment_item || '')) {
      diff.nonEquipmentItem = { from: repairDetail.non_equipment_item, to: updates.nonEquipmentItem }
    }
    if (updates.locationFullName !== undefined && updates.locationFullName !== (repairDetail.location_full_name || '')) {
      diff.locationFullName = { from: repairDetail.location_full_name, to: updates.locationFullName }
    }
    if (updates.symptomDetail !== undefined && updates.symptomDetail !== (repairDetail.symptom_detail || '')) {
      diff.symptomDetail = { from: repairDetail.symptom_detail, to: updates.symptomDetail }
    }

    await executor(
      `UPDATE repair_details SET 
        item_category = ?, 
        equipment_number = ?, 
        equipment_name = ?, 
        non_equipment_item = ?, 
        location_id = ?, 
        location_full_name = ?, 
        symptom_detail = ?, 
        updated_at = NOW() 
       WHERE task_id = ?`,
      [
        finalItemCat,
        finalEqNum?.trim() || null,
        finalEqName?.trim() || null,
        finalNonEq?.trim() || null,
        finalLocId || null,
        finalLocName?.trim() || 'โรงพยาบาลเถิน',
        finalSymptom?.trim() || '',
        taskId,
      ]
    )

    const itemName = finalItemCat === 'EQUIPMENT'
      ? (finalEqName ? `${finalEqName} (${finalEqNum || 'ไม่ระบุเลข'})` : `ครุภัณฑ์เลขที่ ${finalEqNum}`)
      : finalNonEq

    if (itemName && !updates.title) {
      updatedTaskFields.title = `แจ้งซ่อม: ${itemName}`
    }
    if (finalSymptom && updates.description === undefined) {
      updatedTaskFields.description = finalSymptom.trim()
    }

    customPayload.itemCategory = finalItemCat
    customPayload.itemName = itemName
    customPayload.locationFullName = finalLocName
    updatedTaskFields.custom_payload = JSON.stringify(customPayload)
  }

  // Update inbox_tasks table if there are changes
  const updateSets: string[] = ['updated_at = NOW()']
  const updateParams: any[] = []

  if (updatedTaskFields.title) {
    updateSets.push('title = ?')
    updateParams.push(updatedTaskFields.title)
  }
  if (updatedTaskFields.description !== undefined) {
    updateSets.push('description = ?')
    updateParams.push(updatedTaskFields.description)
  }
  if (updatedTaskFields.urgency) {
    updateSets.push('urgency = ?')
    updateParams.push(updatedTaskFields.urgency)
  }
  if (updatedTaskFields.custom_payload) {
    updateSets.push('custom_payload = ?')
    updateParams.push(updatedTaskFields.custom_payload)
  }

  updateParams.push(taskId)
  await executor(
    `UPDATE inbox_tasks SET ${updateSets.join(', ')} WHERE id = ?`,
    updateParams
  )

  // Write structured field-diff Audit Log
  const auditId = crypto.randomUUID()
  await executor(
    `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
     VALUES (?, ?, 'MANAGER_EDIT_TASK', ?, ?, ?)`,
    [
      auditId,
      taskId,
      performer.id,
      performer.name || performer.username,
      JSON.stringify({
        diff,
        updatedFields: updates,
        taskType: task.task_type,
        editorRole: performer.position || performer.role,
      }),
    ]
  )

  return {
    success: true,
    message: 'แก้ไขข้อมูลคำขอเรียบร้อยแล้ว',
    diff,
  }
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
  const { taskId, action, actorMemberId, actorUsername, actorName, actorPosition, actorRole, signaturePath, comment, nextAssigneeId, partialEdits, holdReason, holdDetails } = input

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
        `UPDATE inbox_task_steps SET status = 'PENDING', assigned_to_id = ? WHERE id = ?`,
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
    await executor(
      `UPDATE inbox_task_steps 
       SET status = 'WAITING', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
       WHERE id = ?`,
      [actorMemberId, actorName || actorUsername, comment || 'ส่งกลับแก้ไข', currentStep.id]
    )
    await executor(
      `UPDATE inbox_tasks 
       SET status = 'SENT_BACK', current_step_no = 1, current_assignee = requester_id, \`current_role\` = NULL, updated_at = NOW() 
       WHERE id = ?`,
      [taskId]
    )
    if (steps.length > 0) {
      await executor(
        `UPDATE inbox_task_steps SET status = 'PENDING' WHERE task_id = ? AND step_no = 1`,
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
      JSON.stringify({ stepNo: currentStep.step_no, stepName: currentStep.step_name, comment }),
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

