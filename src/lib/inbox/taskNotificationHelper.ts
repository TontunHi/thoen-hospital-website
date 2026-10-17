import { queryMemberDb } from '@/lib/memberDb'
import { sendTelegramMessage } from '@/lib/telegramService'
import { logger } from '@/lib/logger'
import { MEDIA_REQUEST_ROLES, MEDIA_REQUEST_ROLE_CIDS, REGISTERED_TASK_TYPES } from '@/lib/taskInboxService'

export function formatUrgency(urgency?: string | null, taskType?: string | null) {
  if (urgency === 'VERY_URGENT') return '🔴 ด่วนที่สุด (Emergency)'
  if (urgency === 'URGENT') return '🟡 ด่วน (Urgent)'
  if (taskType === 'MEDIA_REQUEST') return '🟢 ไม่ด่วน (Non-urgent)'
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
      // 1. Direct Assignee if specified
      if (params.assigneeId) {
        const links = await queryMemberDb(
          'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
          [params.assigneeId]
        )
        if (links && links.length > 0) {
          chatIds.push(links[0].telegram_chat_id)
        }
      } else if (params.targetRole) {
        // 2. Match role against designated Citizen ID
        const targetCid = MEDIA_REQUEST_ROLE_CIDS[params.targetRole]
        if (targetCid) {
          const links = await queryMemberDb(
            `SELECT l.telegram_chat_id 
             FROM member_telegram_links l
             JOIN members m ON l.member_id = m.id
             WHERE m.username = ? LIMIT 1`,
            [targetCid]
          )
          if (links && links.length > 0) {
            chatIds.push(links[0].telegram_chat_id)
          }
        } else if (
          params.targetRole === MEDIA_REQUEST_ROLES.PR_OFFICER ||
          params.targetRole.includes('ประชาสัมพันธ์')
        ) {
          // 3. For PR Officer, notify all users with PR position who have linked Telegram, and PR group
          const links = await queryMemberDb(
            `SELECT DISTINCT l.telegram_chat_id 
             FROM member_telegram_links l
             JOIN members m ON l.member_id = m.id
             WHERE (m.position LIKE '%ประชาสัมพันธ์%' OR m.department LIKE '%ประชาสัมพันธ์%' OR m.role = 'pr')`
          )
          if (links && links.length > 0) {
            for (const row of links) {
              if (!chatIds.includes(row.telegram_chat_id)) {
                chatIds.push(row.telegram_chat_id)
              }
            }
          }
          const mediaGroupChatId = process.env.TELEGRAM_GROUP_MEDIA_REQUEST || process.env.TELEGRAM_GROUP_PR || '-5235759439'
          if (mediaGroupChatId && !chatIds.includes(mediaGroupChatId)) {
            chatIds.push(mediaGroupChatId)
          }
        } else {
          // Fallback to position/department matching
          const links = await queryMemberDb(
            `SELECT l.telegram_chat_id 
             FROM member_telegram_links l
             JOIN members m ON l.member_id = m.id
             WHERE (m.position LIKE ? OR m.department LIKE ?)`,
            [`%${params.targetRole}%`, `%${params.targetRole}%`]
          )
          if (links && links.length > 0) {
            for (const row of links) {
              if (!chatIds.includes(row.telegram_chat_id)) {
                chatIds.push(row.telegram_chat_id)
              }
            }
          }
        }
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

    const urgencyLabel = formatUrgency(params.urgency, params.taskType)

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
      const isPrRole = params.targetRole === MEDIA_REQUEST_ROLES.PR_OFFICER || params.targetRole?.includes('ประชาสัมพันธ์')
      const header = isPrRole
        ? '🎨 <b>มีงานจัดทำสื่อประชาสัมพันธ์</b>'
        : '📋 <b>มีคำขอสื่อประชาสัมพันธ์รอคุณพิจารณา / ลงนาม</b>'
      const costLabel = params.costType === 'HAS_COST' ? '🔴 มีค่าใช้จ่าย (งบประมาณ)' : '🟢 ไม่มีค่าใช้จ่าย'
      const lines: string[] = [
        header,
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

/**
 * Dispatch Telegram Confirmation Alert to Requester when a media request is created
 */
export async function notifyMediaRequestCreatedRequesterOnTelegram(params: {
  taskId: string
  taskNo: string
  title: string
  requesterId?: number | null
  urgency?: string | null
  deliveryDate?: string | null
  costType?: string | null
  workTypesSummary?: string | null
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

    const urgencyLabel = formatUrgency(params.urgency, 'MEDIA_REQUEST')
    const costLabel = params.costType === 'HAS_COST' ? '🔴 มีค่าใช้จ่าย (งบประมาณ)' : '🟢 ไม่มีค่าใช้จ่าย'

    const lines: string[] = [
      `🎨 <b>คุณได้ยื่นคำขอจัดทำสื่อประชาสัมพันธ์เรียบร้อยแล้ว</b>`,
      `🏷️ <b>รหัสคำขอ :</b> <code>${params.taskNo}</code>`,
      `⚡ <b>ความเร่งด่วน :</b> ${urgencyLabel}`,
      `📋 <b>หัวข้อ :</b> <b>${escapeHtml(params.title)}</b>`,
    ]
    if (params.deliveryDate) {
      lines.push(`📅 <b>วันที่ขอรับงาน :</b> ${escapeHtml(params.deliveryDate)}`)
    }
    lines.push(`💰 <b>งบประมาณ :</b> ${costLabel}`)
    if (params.workTypesSummary) {
      lines.push(`📐 <b>ลักษณะงาน :</b> ${escapeHtml(params.workTypesSummary)}`)
    }
    lines.push(`📍 <b>สถานะ :</b> ⏳ อยู่ระหว่างเสนอพิจารณา (ขั้นตอนที่ 1)`)
    lines.push(`⏰ <b>เวลาส่งเรื่อง :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>ระบบได้ส่งข้อมูลเข้ากลุ่มงานประชาสัมพันธ์แล้ว และจะแจ้งเตือนความคืบหน้าให้ทราบเมื่อมีการอนุมัติ</i>`

    await sendTelegramMessage(chatId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '🔍 ติดตามสถานะคำขอสื่อ ↗',
              url: taskLink,
            },
          ],
        ],
      },
    })
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram media request creation confirmation to requester')
  }
}

/**
 * Dispatch Telegram Alert on Step Approval (Sends to Requester and Media PR Telegram Group)
 */
export async function notifyMediaRequestStepApprovedOnTelegram(params: {
  taskId: string
  taskNo: string
  title: string
  requesterId?: number | null
  requesterName: string
  requesterDept?: string | null
  approverName: string
  approverPosition?: string | null
  stepNo: number
  stepName: string
  isFinalStep: boolean
  nextStepName?: string | null
}) {
  try {
    const targetChatIds: string[] = []

    // 1. Group Telegram Chat ID
    const mediaGroupChatId = process.env.TELEGRAM_GROUP_MEDIA_REQUEST || process.env.TELEGRAM_GROUP_PR || '-5235759439'
    if (mediaGroupChatId) {
      targetChatIds.push(mediaGroupChatId)
    }

    // 2. Requester Private Chat ID
    if (params.requesterId) {
      const links = await queryMemberDb(
        'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
        [params.requesterId]
      )
      if (links && links.length > 0) {
        const reqChatId = links[0].telegram_chat_id
        if (!targetChatIds.includes(reqChatId)) {
          targetChatIds.push(reqChatId)
        }
      }
    }

    if (targetChatIds.length === 0) return

    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const header = params.isFinalStep
      ? '🎉 <b>คำขอสื่อประชาสัมพันธ์ผ่านการอนุมัติสมบูรณ์แล้ว</b>'
      : `✅ <b>อนุมัติคำขอสื่อประชาสัมพันธ์ (ขั้นตอนที่ ${params.stepNo})</b>`

    const lines: string[] = [
      header,
      `🏷️ <b>เลขคำร้อง :</b> <code>${params.taskNo}</code>`,
      `📋 <b>หัวข้อ :</b> <b>${escapeHtml(params.title)}</b>`,
      `👤 <b>ผู้ร้องขอ :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}`,
      `✍️ <b>ผู้อนุมัติ :</b> <b>${escapeHtml(params.approverName)}</b>${params.approverPosition ? ` (${escapeHtml(params.approverPosition)})` : ''}`,
    ]

    if (!params.isFinalStep && params.nextStepName) {
      lines.push(`⏭️ <b>ขั้นตอนถัดไป :</b> ${escapeHtml(params.nextStepName)}`)
    }

    lines.push(`⏰ <b>เวลาที่อนุมัติ :</b> ${thaiDate} น.`)

    const footer = params.isFinalStep
      ? '✨ <i>คำขอสื่อประชาสัมพันธ์ผ่านการอนุมัติครบถ้วนทุกขั้นตอนเรียบร้อยแล้ว</i>'
      : '✨ <i>ส่งต่อเอกสารเข้าสู่ขั้นตอนถัดไปเรียบร้อยแล้ว</i>'

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n${footer}`

    for (const chatId of targetChatIds) {
      await sendTelegramMessage(chatId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '📄 ดูเอกสารและสถานะคำขอ ↗',
                url: taskLink,
              },
            ],
          ],
        },
      }).catch((err) => logger.error({ error: err, chatId }, 'Failed sending media approval to chatId'))
    }
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram media step approval notification')
  }
}

/**
 * Dispatch Telegram Alert on Reject / Send Back (Sends to Requester and Media PR Telegram Group)
 */
export async function notifyMediaRequestRejectedOrSentBackOnTelegram(params: {
  taskId: string
  taskNo: string
  title: string
  action: 'REJECT' | 'SEND_BACK'
  requesterId?: number | null
  requesterName: string
  requesterDept?: string | null
  performerName: string
  performerPosition?: string | null
  stepName: string
  reason?: string | null
}) {
  try {
    const targetChatIds: string[] = []

    // 1. Group Telegram Chat ID
    const mediaGroupChatId = process.env.TELEGRAM_GROUP_MEDIA_REQUEST || process.env.TELEGRAM_GROUP_PR || '-5235759439'
    if (mediaGroupChatId) {
      targetChatIds.push(mediaGroupChatId)
    }

    // 2. Requester Private Chat ID
    if (params.requesterId) {
      const links = await queryMemberDb(
        'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
        [params.requesterId]
      )
      if (links && links.length > 0) {
        const reqChatId = links[0].telegram_chat_id
        if (!targetChatIds.includes(reqChatId)) {
          targetChatIds.push(reqChatId)
        }
      }
    }

    if (targetChatIds.length === 0) return

    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`

    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const isReject = params.action === 'REJECT'
    const header = isReject
      ? '❌ <b>คำขอสื่อประชาสัมพันธ์ถูกปฏิเสธ (ไม่อนุมัติ)</b>'
      : '↩️ <b>คำขอสื่อประชาสัมพันธ์ถูกส่งกลับแก้ไข</b>'

    const actorLabel = isReject ? '🚫 <b>ผู้ปฏิเสธ :</b>' : '↩️ <b>ผู้ส่งกลับ :</b>'
    const reasonLabel = isReject ? '📝 <b>เหตุผลการปฏิเสธ :</b>' : '📝 <b>เหตุผลการส่งกลับ :</b>'

    const lines: string[] = [
      header,
      `🏷️ <b>เลขคำร้อง :</b> <code>${params.taskNo}</code>`,
      `📋 <b>หัวข้อ :</b> <b>${escapeHtml(params.title)}</b>`,
      `👤 <b>ผู้ร้องขอ :</b> ${escapeHtml(params.requesterName)}${params.requesterDept ? ` (${escapeHtml(params.requesterDept)})` : ''}`,
      `${actorLabel} <b>${escapeHtml(params.performerName)}</b>${params.performerPosition ? ` (${escapeHtml(params.performerPosition)})` : ''}`,
      `📍 <b>ขั้นตอน :</b> ${escapeHtml(params.stepName)}`,
      `${reasonLabel}\n<i>${escapeHtml(params.reason || '-')}</i>`,
      `⏰ <b>เวลาดำเนินการ :</b> ${thaiDate} น.`,
    ]

    const footer = isReject
      ? '⚠️ <i>คำขอนี้ถูกยุติการดำเนินการ</i>'
      : '✨ <i>กรุณากดปุ่มด้านล่างเพื่อตรวจสอบและแก้ไขข้อมูลคำขอ</i>'

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n${footer}`

    for (const chatId of targetChatIds) {
      await sendTelegramMessage(chatId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '📋 ดูรายละเอียดคำขอ ↗',
                url: taskLink,
              },
            ],
          ],
        },
      }).catch((err) => logger.error({ error: err, chatId }, 'Failed sending media action to chatId'))
    }
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram media action notification')
  }
}

/**
 * Dispatch Telegram Alert when a task is put on hold (Sends to Requester)
 */
export async function notifyTaskHoldOnTelegram(params: {
  taskId: string
  taskNo: string
  title: string
  requesterId?: number | null
  requesterName?: string | null
  requesterDept?: string | null
  heldByName: string
  heldByPosition?: string | null
  holdReason: string
  holdDetails?: string | null
  stepName?: string
}) {
  try {
    const targetChatIds: (string | number)[] = []
    if (params.requesterId) {
      const links = await queryMemberDb(
        'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
        [params.requesterId]
      )
      if (links && links.length > 0) {
        targetChatIds.push(links[0].telegram_chat_id)
      }
    }
    if (targetChatIds.length === 0) return

    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`
    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const lines: string[] = [
      `⏸️ <b>งานถูกพักการดำเนินการชั่วคราว (On Hold)</b>`,
      `🏷️ <b>รหัสคำขอ :</b> <code>${params.taskNo}</code>`,
      `📋 <b>หัวข้อ :</b> <b>${escapeHtml(params.title)}</b>`,
      `👤 <b>ผู้ดำเนินการพักงาน :</b> ${escapeHtml(params.heldByName)}${params.heldByPosition ? ` (${escapeHtml(params.heldByPosition)})` : ''}`,
      `📌 <b>เหตุผลที่พักงาน :</b> <b>${escapeHtml(params.holdReason)}</b>`,
    ]
    if (params.holdDetails) {
      lines.push(`📝 <b>รายละเอียดเพิ่มเติม :</b>\n<i>${escapeHtml(params.holdDetails)}</i>`)
    }
    lines.push(`⏰ <b>เวลาที่บันทึก :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>หากมีข้อสงสัยหรือต้องการให้ข้อมูลเพิ่มเติม สามารถตรวจสอบรายละเอียดได้ที่ลิงก์ด้านล่าง</i>`

    for (const chatId of targetChatIds) {
      await sendTelegramMessage(chatId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [[{ text: '📋 ดูรายละเอียดคำขอ ↗', url: taskLink }]],
        },
      }).catch((err) => logger.error({ error: err, chatId }, 'Failed sending task hold notification to chatId'))
    }
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram task hold notification')
  }
}

/**
 * Dispatch Telegram Alert when a task is resumed from hold (Sends to Requester)
 */
export async function notifyTaskResumeOnTelegram(params: {
  taskId: string
  taskNo: string
  title: string
  requesterId?: number | null
  requesterName?: string | null
  requesterDept?: string | null
  resumedByName: string
  resumedByPosition?: string | null
  stepName?: string
}) {
  try {
    const targetChatIds: (string | number)[] = []
    if (params.requesterId) {
      const links = await queryMemberDb(
        'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
        [params.requesterId]
      )
      if (links && links.length > 0) {
        targetChatIds.push(links[0].telegram_chat_id)
      }
    }
    if (targetChatIds.length === 0) return

    const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
    const taskLink = `${domainUrl}/member/inbox/${params.taskId}`
    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const lines: string[] = [
      `▶️ <b>งานได้รับการปลดพักและกลับมาดำเนินการต่อ (Resumed)</b>`,
      `🏷️ <b>รหัสคำขอ :</b> <code>${params.taskNo}</code>`,
      `📋 <b>หัวข้อ :</b> <b>${escapeHtml(params.title)}</b>`,
      `👤 <b>ผู้ดำเนินการ :</b> ${escapeHtml(params.resumedByName)}${params.resumedByPosition ? ` (${escapeHtml(params.resumedByPosition)})` : ''}`,
    ]
    if (params.stepName) {
      lines.push(`📍 <b>ขั้นตอนปัจจุบัน :</b> ${escapeHtml(params.stepName)}`)
    }
    lines.push(`⏰ <b>เวลาที่ดำเนินการ :</b> ${thaiDate} น.`)

    const message = `${lines.join('\n\n')}\n\n────────────────────────\n✨ <i>งานได้กลับเข้าสู่กระบวนการทำงานปกติเรียบร้อยแล้ว</i>`

    for (const chatId of targetChatIds) {
      await sendTelegramMessage(chatId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [[{ text: '📋 ดูรายละเอียดคำขอ ↗', url: taskLink }]],
        },
      }).catch((err) => logger.error({ error: err, chatId }, 'Failed sending task resume notification to chatId'))
    }
  } catch (error) {
    logger.error({ error, taskId: params.taskId }, 'Failed to send Telegram task resume notification')
  }
}

export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
