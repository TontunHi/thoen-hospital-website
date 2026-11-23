import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway } from '@/lib/apiGateway'
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

  const isMock = typeof (executor as any).mock !== 'undefined'
  if (executor === queryMemberDb && !isMock) {
    try {
      const res = await apiGateway.app.generateTaskNo(ymPrefix)
      const generatedNo = (res as any)?.taskNo || (res as any)?.data?.taskNo
      if (generatedNo) return generatedNo
    } catch (err) {
      logger.warn({ err }, 'Fallback to raw query for generateTaskNo')
    }
  }

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

  const isMock = typeof (executor as any).mock !== 'undefined'
  if (executor === queryMemberDb && !isMock) {
    try {
      const res = await apiGateway.app.executeRepairAction({
        taskId,
        action,
        performer,
        payload
      })
      const repairResData = (res as any)?.data ?? res
      const isRepairGatewayOk = Boolean(
        res &&
          (res as any).success !== false &&
          ((res as any).success === true || typeof repairResData?.message === 'string')
      )
      if (isRepairGatewayOk) {
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
            notifyRepairCancelledOnTelegram({
              taskId,
              taskNo: task.task_no,
              taskType: task.task_type,
              title: task.title,
              targetMemberId: task.requester_id,
              cancelledByName: performer.name || performer.username,
              reason: payload.reason || null,
            }).catch((e) => logger.error({ error: e }, 'Telegram dispatch error on cancel job'))
          }
        }
        return {
          success: true,
          message: repairResData?.message || (res as any)?.message || 'ดำเนินการสำเร็จ',
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Fallback to direct executor for executeRepairAction')
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
