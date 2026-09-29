import { queryMemberDb } from '@/lib/memberDb'
import { sendTelegramMessage } from '@/lib/telegramService'
import { logger } from '@/lib/logger'
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
}

/**
 * Generate Next Running Task No: e.g. IT-256909-0001
 */
export async function generateTaskNo(taskType: string): Promise<string> {
  const prefix = REGISTERED_TASK_TYPES[taskType]?.titlePrefix || 'TASK'
  const today = new Date()
  const thaiYear = today.getFullYear() + 543
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const ymPrefix = `${prefix}-${thaiYear}${month}-`

  const rows = await queryMemberDb(
    'SELECT COUNT(*) as cnt FROM inbox_tasks WHERE task_no LIKE ?',
    [`${ymPrefix}%`]
  )
  const count = (rows[0]?.cnt || 0) + 1
  return `${ymPrefix}${String(count).padStart(4, '0')}`
}

/**
 * Dispatch Telegram Alert when a task reaches an assignee
 */
export async function notifyAssigneeOnTelegram(params: {
  taskId: string
  taskNo: string
  taskType: string
  title: string
  requesterName: string
  requesterDept?: string | null
  assigneeId?: number | null
  stepName: string
}) {
  if (!params.assigneeId) return

  try {
    // 1. Check if user is linked to Telegram
    const links = await queryMemberDb(
      'SELECT telegram_chat_id, first_name FROM member_telegram_links WHERE member_id = ? LIMIT 1',
      [params.assigneeId]
    )

    if (!links || links.length === 0) {
      // User hasn't linked Telegram; silently skip
      return
    }

    const chatId = links[0].telegram_chat_id
    const typeLabel = REGISTERED_TASK_TYPES[params.taskType]?.name || params.taskType
    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const message = `🔔 <b>มีงานใหม่รอคุณตรวจสอบ / อนุมัติ</b>

📋 <b>เรื่อง:</b> ${escapeHtml(params.title)}
🏷️ <b>ประเภท:</b> ${escapeHtml(typeLabel)} (<code>${params.taskNo}</code>)
👤 <b>ผู้ยื่นขอ:</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}
📍 <b>ขั้นตอนปัจจุบัน:</b> ${escapeHtml(params.stepName)}
⏰ <b>วันที่ส่ง:</b> ${thaiDate} น.

🔗 <a href="${taskLink}">กดที่นี่เพื่อเปิดดูและจัดการงานบนเว็บไซต์</a>`

    await sendTelegramMessage(chatId, message, 'HTML')
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram notification for task')
  }
}

function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
