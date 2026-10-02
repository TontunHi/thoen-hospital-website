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
        stepName: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ ตรวจสอบและมอบหมายงาน',
        assigneeType: 'ROLE',
        assignedRole: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
        canEditFields: ['comment'],
      },
      {
        stepNo: 2,
        stepName: 'เจ้าหน้าที่พัสดุ ตรวจสอบความถูกต้อง',
        assigneeType: 'ROLE',
        assignedRole: 'เจ้าหน้าที่พัสดุ',
        canEditFields: ['comment'],
      },
      {
        stepNo: 3,
        stepName: 'หัวหน้าเจ้าหน้าที่พัสดุ ตรวจสอบและให้ความเห็นชอบ',
        assigneeType: 'ROLE',
        assignedRole: 'หัวหน้าเจ้าหน้าที่พัสดุ',
        canEditFields: ['comment'],
      },
    ],
  },
}

export const MEDIA_REQUEST_ROLES = {
  DIGITAL_HEAD: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
  PROCUREMENT_OFFICER: 'เจ้าหน้าที่พัสดุ',
  PROCUREMENT_HEAD: 'หัวหน้าเจ้าหน้าที่พัสดุ',
  DIRECTOR: 'ผู้อำนวยการโรงพยาบาลเถิน',
} as const

export function getMediaRequestWorkflowSteps(hasCost: boolean): WorkflowStepDefinition[] {
  const steps: WorkflowStepDefinition[] = [
    {
      stepNo: 1,
      stepName: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ ตรวจสอบและมอบหมายงาน',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.DIGITAL_HEAD,
      canEditFields: ['comment'],
    },
    {
      stepNo: 2,
      stepName: 'เจ้าหน้าที่พัสดุ ตรวจสอบความถูกต้อง',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PROCUREMENT_OFFICER,
      canEditFields: ['comment'],
    },
    {
      stepNo: 3,
      stepName: 'หัวหน้าเจ้าหน้าที่พัสดุ ตรวจสอบและให้ความเห็นชอบ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.PROCUREMENT_HEAD,
      canEditFields: ['comment'],
    },
  ]

  if (hasCost) {
    steps.push({
      stepNo: 4,
      stepName: 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ',
      assigneeType: 'ROLE',
      assignedRole: MEDIA_REQUEST_ROLES.DIRECTOR,
      canEditFields: ['comment'],
    })
  }

  return steps
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

function formatUrgency(urgency?: string | null) {
  if (urgency === 'VERY_URGENT') return '🔴 ด่วนที่สุด (Emergency)'
  if (urgency === 'URGENT') return '🟡 ด่วน (Urgent)'
  return '🟢 ปกติ (Normal)'
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
  deliveryDate?: string | null
  costType?: string | null
  workTypesSummary?: string | null
}) {
  try {
    let chatIds: (string | number)[] = []

    const isRepair = ['IT_REPAIR', 'MEDICAL_REPAIR', 'GENERAL_REPAIR'].includes(params.taskType)
    const isMediaRequest = params.taskType === 'MEDIA_REQUEST'

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
    } else if (isMediaRequest) {
      // Route directly to Media & PR Telegram Group
      const mediaGroupChatId = process.env.TELEGRAM_GROUP_MEDIA_REQUEST || process.env.TELEGRAM_GROUP_PR || '-5235759439'
      if (mediaGroupChatId) {
        chatIds.push(mediaGroupChatId)
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
      const lines: string[] = [
        `🔔 <b>มีงานแจ้งซ่อมใหม่เข้ามายังกลุ่มงาน</b>`,
        `🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>`,
        `⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}`,
        `📂 <b>หมวดหมู่งาน :</b> ${escapeHtml(typeLabel)}`,
        `📋 <b>รายการ / อุปกรณ์ :</b> <b>${escapeHtml(params.itemName || params.title)}</b>`,
      ]
      if (params.equipmentNumber) {
        lines.push(`🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(params.equipmentNumber)}</code>`)
      }
      lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(params.location || 'โรงพยาบาลเถิน')}`)
      if (params.symptom) {
        lines.push(`📝 <b>อาการเสีย / ปัญหา :</b>\n<i>${escapeHtml(params.symptom)}</i>`)
      }
      lines.push(`👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}`)
      lines.push(`⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.`)

      message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>ช่างในกลุ่มสามารถกดปุ่มด้านล่างเพื่อรับงานเข้าสู่ระบบได้ทันที</i>`
    } else if (isMediaRequest) {
      const costLabel = params.costType === 'HAS_COST' ? '🔴 มีค่าใช้จ่าย (งบประมาณ)' : '🟢 ไม่มีค่าใช้จ่าย'
      const lines: string[] = [
        `🎨 <b>คำขอจัดทำสื่อประชาสัมพันธ์ใหม่</b>`,
        `🏷️ <b>รหัสคำขอ :</b> <code>${params.taskNo}</code>`,
        `⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}`,
        `📂 <b>หมวดหมู่งาน :</b> ${escapeHtml(typeLabel)}`,
        `📋 <b>เรื่อง / หัวข้องาน :</b> <b>${escapeHtml(params.title)}</b>`,
      ]
      if (params.deliveryDate) {
        lines.push(`📅 <b>วันที่ขอรับงาน :</b> ${escapeHtml(params.deliveryDate)}`)
      }
      lines.push(`💰 <b>งบประมาณ :</b> ${costLabel}`)
      if (params.workTypesSummary) {
        lines.push(`📐 <b>ลักษณะงาน :</b> ${escapeHtml(params.workTypesSummary)}`)
      }
      lines.push(`👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}`)
      lines.push(`📍 <b>ขั้นตอนปัจจุบัน :</b> ${escapeHtml(params.stepName)}`)
      lines.push(`⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.`)

      message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>กรุณากดปุ่มด้านล่างเพื่อเปิดดูเอกสารและดำเนินการพิจารณาลงนาม</i>`
    } else {
      const lines: string[] = [
        `📋 <b>มีงานใหม่รอคุณพิจารณา / ลงนาม</b>`,
        `🏷️ <b>รหัสเอกสาร :</b> <code>${params.taskNo}</code>`,
        `⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}`,
        `📂 <b>หมวดหมู่งาน :</b> ${escapeHtml(typeLabel)}`,
        `📋 <b>หัวข้อเรื่อง :</b> <b>${escapeHtml(params.title)}</b>`,
      ]
      if (params.location) {
        lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}`)
      }
      lines.push(`👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}`)
      lines.push(`📍 <b>ขั้นตอน :</b> ${escapeHtml(params.stepName)}`)
      lines.push(`⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.`)

      message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>กรุณากดปุ่มด้านล่างเพื่อเปิดดูรายละเอียดและดำเนินการ</i>`
    }

    const inlineKeyboard = isRepair
      ? [
          [
            {
              text: '🛠️ กดรับงานทันที (Accept)',
              callback_data: `accept_repair:${params.taskId}`,
            },
            {
              text: '❌ ปฏิเสธงาน',
              callback_data: `cancel_repair:${params.taskId}`,
            },
          ],
          [
            {
              text: '📋 ดูรายละเอียดบนเว็บไซต์ ↗',
              url: taskLink,
            },
          ],
        ]
      : [
          [
            {
              text: '✍️ ตรวจสอบและลงนาม ↗',
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

    const lines: string[] = [
      `📝 <b>คุณได้ยื่นใบแจ้งซ่อมเรียบร้อยแล้ว</b>`,
      `🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>`,
      `⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}`,
      `📂 <b>หมวดหมู่งาน :</b> ${escapeHtml(typeLabel)}`,
      `📋 <b>รายการ / อุปกรณ์ :</b> <b>${escapeHtml(params.itemName || params.title)}</b>`,
    ]
    if (params.equipmentNumber) {
      lines.push(`🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(params.equipmentNumber)}</code>`)
    }
    lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(params.location || 'โรงพยาบาลเถิน')}`)
    if (params.symptom) {
      lines.push(`📝 <b>อาการเสีย / ปัญหา :</b>\n<i>${escapeHtml(params.symptom)}</i>`)
    }
    lines.push(`🔧 <b>ผู้รับผิดชอบ :</b> ${params.assignedTechName ? escapeHtml(params.assignedTechName) : 'รอทีมช่างรับงาน'}`)
    lines.push(`📍 <b>สถานะ :</b> ⏳ รอดำเนินการ (PENDING)`)
    lines.push(`⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n⏳ <i>ระบบได้ส่งข้อมูลเข้ากลุ่มงานช่างแล้ว และจะแจ้งเตือนทันทีเมื่อช่างกดรับงาน</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '🔍 ติดตามสถานะงานซ่อม ↗',
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

    const lines: string[] = [
      `👨‍🔧 <b>ช่างได้รับงานแจ้งซ่อมของคุณแล้ว</b>`,
      `🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>`,
      `📋 <b>เรื่อง / รายการ :</b> <b>${escapeHtml(params.title)}</b>`,
    ]
    if (params.equipmentNumber) {
      lines.push(`🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(params.equipmentNumber)}</code>`)
    }
    if (params.location) {
      lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}`)
    }
    lines.push(`🔧 <b>ช่างผู้รับงาน :</b> <b>${escapeHtml(params.technicianName)}</b>${params.technicianPosition ? ` (${escapeHtml(params.technicianPosition)})` : ''}`)
    lines.push(`📍 <b>สถานะปัจจุบัน :</b> ⚙️ อยู่ระหว่างดำเนินการตรวจซ่อม (IN PROGRESS)`)
    lines.push(`⏰ <b>เวลารับงาน :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบความคืบหน้าของงาน</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '🔍 ติดตามสถานะงานซ่อม ↗',
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

    const lines: string[] = [
      `🎉 <b>งานแจ้งซ่อมของคุณดำเนินการเสร็จสิ้นแล้ว</b>`,
      `🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>`,
      `📋 <b>เรื่อง / รายการ :</b> <b>${escapeHtml(params.title)}</b>`,
    ]
    if (params.location) {
      lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}`)
    }
    lines.push(`👨‍🔧 <b>ช่างผู้ดำเนินการ :</b> <b>${escapeHtml(params.technicianName)}</b>`)
    if (params.solutionStep) {
      lines.push(`📝 <b>ผลการซ่อม / การแก้ไข :</b>\n<i>${escapeHtml(params.solutionStep)}</i>`)
    }
    lines.push(`💵 <b>ค่าใช้จ่าย :</b> ${costText}`)
    lines.push(`📍 <b>สถานะ :</b> ✅ เสร็จสิ้นสมบูรณ์ (COMPLETED)`)
    lines.push(`⏰ <b>เวลาปิดงาน :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบรายละเอียดและพิมพ์ใบงาน</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📄 ดูผลการซ่อมและพิมพ์ใบงาน ↗',
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

    const lines: string[] = [
      `❌ <b>งานแจ้งซ่อมถูกยกเลิก / ปฏิเสธ</b>`,
      `🏷️ <b>รหัสใบงาน :</b> <code>${params.taskNo}</code>`,
      `📋 <b>เรื่อง / รายการ :</b> <b>${escapeHtml(params.title)}</b>`,
    ]
    if (params.location) {
      lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(params.location)}`)
    }
    lines.push(`👤 <b>ผู้ดำเนินการยกเลิก :</b> <b>${escapeHtml(params.cancelledByName)}</b>${params.cancelledByRole ? ` (${escapeHtml(params.cancelledByRole)})` : ''}`)
    if (params.reason) {
      lines.push(`📝 <b>เหตุผลการยกเลิก :</b>\n<i>${escapeHtml(params.reason)}</i>`)
    }
    lines.push(`📍 <b>สถานะ :</b> ⛔ ยกเลิก / ปฏิเสธรายการ (CANCELLED)`)
    lines.push(`⏰ <b>เวลายกเลิก :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบรายละเอียดในระบบ</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📋 ตรวจสอบรายละเอียดงาน ↗',
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

        // Step 4 (Director) dynamic insertion / removal
        if (updates.costType === 'HAS_COST' && oldCostType !== 'HAS_COST') {
          const step4Rows = await executor(
            'SELECT id FROM inbox_task_steps WHERE task_id = ? AND step_no = 4 LIMIT 1',
            [taskId]
          )
          if (!step4Rows || step4Rows.length === 0) {
            const step4Id = crypto.randomUUID()
            await executor(
              `INSERT INTO inbox_task_steps 
               (id, task_id, step_no, step_name, assignee_type, assigned_role, status)
               VALUES (?, ?, 4, 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ', 'ROLE', 'ผู้อำนวยการโรงพยาบาลเถิน', 'PENDING')`,
              [step4Id, taskId]
            )
          }
        } else if (updates.costType === 'NO_COST' && oldCostType === 'HAS_COST') {
          await executor(
            `DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no = 4 AND status = 'PENDING'`,
            [taskId]
          )
        }
      }
    }

    if (updates.estimatedBudget !== undefined && String(updates.estimatedBudget) !== String(customPayload.estimatedBudget ?? '')) {
      diff.estimatedBudget = { from: customPayload.estimatedBudget, to: updates.estimatedBudget }
      customPayload.estimatedBudget = updates.estimatedBudget
    }
    if (updates.deliveryDate !== undefined && updates.deliveryDate !== (customPayload.deliveryDate ?? '')) {
      diff.deliveryDate = { from: customPayload.deliveryDate, to: updates.deliveryDate }
      customPayload.deliveryDate = updates.deliveryDate
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


