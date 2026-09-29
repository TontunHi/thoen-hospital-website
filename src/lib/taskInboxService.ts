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

function formatUrgency(urgency?: string | null) {
  if (urgency === 'VERY_URGENT') return '🔴 ด่วนที่สุด'
  if (urgency === 'URGENT') return '🟡 ด่วน'
  return '🟢 ปกติ'
}

/**
 * Dispatch Telegram Alert when a task reaches an assignee (e.g. Technician or Signer)
 */
export async function notifyAssigneeOnTelegram(params: {
  taskId: string
  taskNo: string
  taskType: string
  title: string
  requesterName: string
  requesterDept?: string | null
  assigneeId?: number | null
  targetRole?: string | null
  stepName: string
  equipmentNumber?: string | null
  itemName?: string | null
  location?: string | null
  symptom?: string | null
  urgency?: string | null
}) {
  try {
    let chatIds: (string | number)[] = []

    const isRepair = ['IT_REPAIR', 'MEDICAL_REPAIR', 'GENERAL_REPAIR'].includes(params.taskType)

    if (isRepair) {
      // Route directly to Department Telegram Group
      let groupChatId: string | undefined
      if (params.taskType === 'IT_REPAIR') {
        groupChatId = process.env.TELEGRAM_GROUP_IT_REPAIR || '-5547296760'
      } else if (params.taskType === 'GENERAL_REPAIR') {
        groupChatId = process.env.TELEGRAM_GROUP_GENERAL_REPAIR || '-5487353615'
      } else if (params.taskType === 'MEDICAL_REPAIR') {
        groupChatId = process.env.TELEGRAM_GROUP_MEDICAL_REPAIR || '-5477389393'
      }

      if (groupChatId) {
        chatIds.push(groupChatId)
      }
    } else {
      if (params.assigneeId) {
        // 1. Check if direct assignee is linked to Telegram (Notify ONLY this assigned person)
        const links = await queryMemberDb(
          'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
          [params.assigneeId]
        )
        if (links && links.length > 0) {
          chatIds.push(links[0].telegram_chat_id)
        }
      } else if (params.targetRole) {
        // 2. If no direct assignee, notify ONLY members in that specific role/position/department (NO admin broadcast)
        const links = await queryMemberDb(
          `SELECT l.telegram_chat_id 
           FROM member_telegram_links l
           JOIN members m ON l.member_id = m.id
           WHERE (m.position LIKE ? OR m.department LIKE ?)`,
          [`%${params.targetRole}%`, `%${params.targetRole}%`]
        )
        if (links && links.length > 0) {
          chatIds = links.map((r: any) => r.telegram_chat_id)
        }
      }
    }

    if (chatIds.length === 0) {
      return
    }

    const typeLabel = REGISTERED_TASK_TYPES[params.taskType]?.name || params.taskType
    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const urgencyLabel = formatUrgency(params.urgency)

    let message = ''
    if (isRepair) {
      message = `🔔 <b>มีงานแจ้งซ่อมใหม่เข้ามายังกลุ่มงาน</b>

🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>
⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}
📂 <b>ประเภทงาน :</b> ${escapeHtml(typeLabel)}

📋 <b>เรื่อง / รายการ :</b> ${escapeHtml(params.itemName || params.title)}
${params.equipmentNumber ? `🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(params.equipmentNumber)}</code>\n` : ''}📍 <b>สถานที่ :</b> ${escapeHtml(params.location || 'โรงพยาบาลเถิน')}
${params.symptom ? `📝 <b>อาการเสีย :</b> ${escapeHtml(params.symptom)}\n` : ''}
👤 <b>ผู้ยื่นแจ้ง :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}
⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.

──────────────────────
✨ <i>ช่างในกลุ่มสามารถกดปุ่มด้านล่างเพื่อรับงานได้ทันที</i>`
    } else {
      message = `🔔 <b>มีงานใหม่รอคุณปฏิบัติหน้าที่ / ลงนาม</b>

🏷️ <b>รหัสงาน :</b> <code>${params.taskNo}</code>
⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}
📂 <b>ประเภทงาน :</b> ${escapeHtml(typeLabel)}

📋 <b>หัวข้อเรื่อง :</b> ${escapeHtml(params.title)}
${params.location ? `📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}\n` : ''}
👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}
📍 <b>ขั้นตอน :</b> ${escapeHtml(params.stepName)}
⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.

──────────────────────
✨ <i>กรุณากดปุ่มด้านล่างเพื่อเปิดดูรายละเอียดและดำเนินการ</i>`
    }

    const inlineKeyboard = isRepair
      ? [
          [
            {
              text: '🛠️ กดรับงานทันที (Accept Job)',
              callback_data: `accept_repair:${params.taskId}`,
            },
            {
              text: '❌ ปฏิเสธ/ยกเลิกงาน',
              callback_data: `cancel_repair:${params.taskId}`,
            },
          ],
          [
            {
              text: '📋 เปิดดูรายละเอียดบนเว็บไซต์',
              url: taskLink,
            },
          ],
        ]
      : [
          [
            {
              text: '📋 เปิดดูรายละเอียดและลงนาม',
              url: taskLink,
            },
          ],
        ]

    for (const chatId of chatIds) {
      await sendTelegramMessage(chatId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: inlineKeyboard,
        },
      })
    }
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram notification for task')
  }
}

/**
 * Dispatch Telegram Confirmation Alert to Requester when a repair ticket is created
 */
export async function notifyRepairCreatedRequesterOnTelegram(params: {
  taskId: string
  taskNo: string
  taskType: string
  title: string
  requesterId?: number | null
  itemName?: string | null
  equipmentNumber?: string | null
  location?: string | null
  symptom?: string | null
  urgency?: string | null
  assignedTechName?: string | null
}) {
  if (!params.requesterId) return

  try {
    const links = await queryMemberDb(
      'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
      [params.requesterId]
    )

    if (!links || links.length === 0) return

    const chatId = links[0].telegram_chat_id
    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const typeLabel = REGISTERED_TASK_TYPES[params.taskType]?.name || params.taskType
    const urgencyLabel = formatUrgency(params.urgency)

    const message = `📝 <b>คุณได้ส่งใบแจ้งซ่อมเรียบร้อยแล้ว</b>

🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>
⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}
📂 <b>ประเภทงาน :</b> ${escapeHtml(typeLabel)}

📋 <b>เรื่อง / รายการ :</b> ${escapeHtml(params.itemName || params.title)}
${params.equipmentNumber ? `🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(params.equipmentNumber)}</code>\n` : ''}📍 <b>สถานที่ :</b> ${escapeHtml(params.location || 'โรงพยาบาลเถิน')}
${params.symptom ? `📝 <b>อาการเสีย :</b> ${escapeHtml(params.symptom)}\n` : ''}
🔧 <b>ผู้รับผิดชอบ :</b> ${params.assignedTechName ? escapeHtml(params.assignedTechName) : 'รอช่างรับงาน'}
⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.

──────────────────────
⏳ <i>ระบบได้ส่งเรื่องไปยังทีมช่างแล้ว และจะแจ้งเตือนเมื่อช่างรับงาน</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📋 ติดตามสถานะงานซ่อม',
              url: taskLink,
            },
          ],
        ],
      },
    })
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram repair create confirmation to requester')
  }
}

/**
 * Dispatch Telegram Alert to Requester when technician accepts the job
 */
export async function notifyRepairAcceptedOnTelegram(params: {
  taskId: string
  taskNo: string
  taskType: string
  title: string
  requesterId?: number | null
  technicianName: string
  technicianPosition?: string | null
  equipmentNumber?: string | null
  location?: string | null
}) {
  if (!params.requesterId) return

  try {
    const links = await queryMemberDb(
      'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
      [params.requesterId]
    )

    if (!links || links.length === 0) return

    const chatId = links[0].telegram_chat_id
    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const message = `👨‍🔧 <b>ช่างได้รับงานแจ้งซ่อมของคุณแล้ว</b>

🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>
📋 <b>เรื่อง :</b> ${escapeHtml(params.title)}
${params.equipmentNumber ? `🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(params.equipmentNumber)}</code>\n` : ''}${params.location ? `📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}\n` : ''}
🔧 <b>ช่างผู้รับงาน :</b> ${escapeHtml(params.technicianName)}${params.technicianPosition ? ` (${escapeHtml(params.technicianPosition)})` : ''}

📍 <b>สถานะ :</b> ⚙️ กำลังอยู่ระหว่างดำเนินการตรวจซ่อม
⏰ <b>เวลารับงาน :</b> ${thaiDate} น.

──────────────────────
✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อติดตามความคืบหน้าของงาน</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📋 ติดตามสถานะงานซ่อม',
              url: taskLink,
            },
          ],
        ],
      },
    })
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram repair accept notification')
  }
}

/**
 * Dispatch Telegram Alert to Requester when technician completes the repair
 */
export async function notifyRepairCompletedOnTelegram(params: {
  taskId: string
  taskNo: string
  taskType: string
  title: string
  requesterId?: number | null
  technicianName: string
  costType?: string | null
  costAmount?: number | null
  location?: string | null
  solutionStep?: string | null
}) {
  if (!params.requesterId) return

  try {
    const links = await queryMemberDb(
      'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
      [params.requesterId]
    )

    if (!links || links.length === 0) return

    const chatId = links[0].telegram_chat_id
    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const costText = params.costType === 'HAS_COST' && params.costAmount
      ? `มีค่าใช้จ่าย ${Number(params.costAmount).toLocaleString()} บาท`
      : 'ไม่มีค่าใช้จ่าย'

    const message = `✅ <b>งานแจ้งซ่อมของคุณดำเนินการเสร็จสิ้นแล้ว</b>

🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>
📋 <b>เรื่อง :</b> ${escapeHtml(params.title)}
${params.location ? `📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}\n` : ''}👨‍🔧 <b>ช่างผู้ดำเนินการ :</b> ${escapeHtml(params.technicianName)}
${params.solutionStep ? `📝 <b>ผลการซ่อม/การแก้ไข :</b> ${escapeHtml(params.solutionStep)}\n` : ''}💵 <b>ค่าใช้จ่าย :</b> ${costText}

📍 <b>สถานะ :</b> ✓ ซ่อมเสร็จสิ้นสมบูรณ์
⏰ <b>เวลาปิดงาน :</b> ${thaiDate} น.

──────────────────────
✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบรายละเอียดและพิมพ์ใบงาน</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📄 ดูรายละเอียดผลการซ่อม',
              url: taskLink,
            },
          ],
        ],
      },
    })
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram repair complete notification')
  }
}

/**
 * Dispatch Telegram Alert when a repair task is cancelled or rejected
 */
export async function notifyRepairCancelledOnTelegram(params: {
  taskId: string
  taskNo: string
  taskType: string
  title: string
  targetMemberId?: number | null
  cancelledByName: string
  cancelledByRole?: string | null
  reason?: string | null
  location?: string | null
}) {
  if (!params.targetMemberId) return

  try {
    const links = await queryMemberDb(
      'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
      [params.targetMemberId]
    )

    if (!links || links.length === 0) return

    const chatId = links[0].telegram_chat_id
    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const message = `❌ <b>งานแจ้งซ่อมถูกยกเลิก / ปฏิเสธ</b>

🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>
📋 <b>เรื่อง :</b> ${escapeHtml(params.title)}
${params.location ? `📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}\n` : ''}
👤 <b>ผู้ดำเนินการยกเลิก :</b> ${escapeHtml(params.cancelledByName)}${params.cancelledByRole ? ` (${escapeHtml(params.cancelledByRole)})` : ''}
${params.reason ? `📝 <b>เหตุผล :</b> ${escapeHtml(params.reason)}\n` : ''}
📍 <b>สถานะ :</b> ⛔ ยกเลิก / ปฏิเสธรายการ
⏰ <b>เวลายกเลิก :</b> ${thaiDate} น.

──────────────────────
✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบรายละเอียดในระบบ</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📋 ตรวจสอบรายละเอียดงาน',
              url: taskLink,
            },
          ],
        ],
      },
    })
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram repair cancel notification')
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
