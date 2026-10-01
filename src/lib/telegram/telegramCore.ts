import { queryMemberDb } from '@/lib/memberDb'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export interface TelegramLinkStatus {
  isLinked: boolean
  telegramUsername?: string | null
  firstName?: string | null
  linkedAt?: string | null
  telegramChatIdMasked?: string | null
}

export interface TelegramUpdate {
  update_id?: number
  message?: {
    message_id?: number
    chat?: { id: number | string; type?: string }
    from?: { id: number; username?: string; first_name?: string; is_bot?: boolean }
    text?: string
    date?: number
  }
  callback_query?: {
    id: string
    from: { id: number; username?: string; first_name?: string }
    message?: {
      message_id: number
      chat: { id: number | string }
      text?: string
    }
    data?: string
  }
}

export interface SendMessageOptions {
  parseMode?: 'HTML' | 'MarkdownV2'
  timeoutMs?: number
  replyMarkup?: any
}

export interface ProcessUpdateResult {
  handled: boolean
  action?:
    | 'START_HELP'
    | 'LINK_SUCCESS'
    | 'LINK_FAILED'
    | 'UNLINK_SUCCESS'
    | 'UNLINK_FAILED'
    | 'ACCEPT_REPAIR_SUCCESS'
    | 'ACCEPT_REPAIR_FAILED'
    | 'CANCEL_REPAIR_SUCCESS'
    | 'CANCEL_REPAIR_FAILED'
    | 'COMPLETE_REPAIR_PROMPT'
    | 'COMPLETE_REPAIR_SUCCESS'
    | 'COMPLETE_REPAIR_FAILED'
    | 'IGNORED'
  memberName?: string
  error?: string
}

export interface PendingTechnicianAction {
  action: 'AWAITING_REPAIR_COMPLETION_NOTE'
  taskId: string
  taskNo: string
  taskTitle: string
  memberId: number
  memberName: string
  groupChatId?: number | string
  originalMessageId?: number
  promptMessageId?: number
  expiresAt: number
}

export const pendingTechnicianActions = new Map<number, PendingTechnicianAction>()

/**
 * Robust Telegram API client with timeout and error handling
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendMessageOptions | 'HTML' | 'MarkdownV2' = {}
): Promise<{ success: boolean; result?: any; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN is not configured; skipping Telegram message delivery')
    return { success: false, error: 'Telegram Bot Token not configured' }
  }

  const parseMode = typeof options === 'string' ? options : (options.parseMode || 'HTML')
  const timeoutMs = typeof options === 'object' && options.timeoutMs ? options.timeoutMs : 8000
  const replyMarkup = typeof options === 'object' ? options.replyMarkup : undefined

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const bodyPayload: any = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }
    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      logger.error({ error: data }, 'Failed to send Telegram message')
      return { success: false, error: data?.description || 'Failed to send Telegram message' }
    }

    return { success: true, result: data.result }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      logger.error('Telegram sendMessage request timed out')
      return { success: false, error: 'Telegram request timed out' }
    }
    logger.error({ err }, 'Error sending Telegram message')
    return { success: false, error: err?.message || 'Unknown error sending Telegram message' }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Answer a Telegram Callback Query (stops the loading spinner on inline button)
 */
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || undefined,
        show_alert: showAlert,
      }),
    })
    return true
  } catch (err) {
    logger.error({ err }, 'Error answering Telegram callback query')
    return false
  }
}

/**
 * Edit an existing Telegram message text and reply markup
 */
export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  try {
    const bodyPayload: any = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }
    if (replyMarkup !== undefined) {
      bodyPayload.reply_markup = replyMarkup
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    })

    const data = await res.json()
    return Boolean(data.ok)
  } catch (err) {
    logger.error({ err }, 'Error editing Telegram message text')
    return false
  }
}

/**
 * Generate a secure one-time challenge token for linking Telegram
 */
export async function createTelegramLinkChallenge(
  memberId: number
): Promise<{ token: string; botUrl: string; expiresAt: Date }> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'ThoenHospitalBot'
  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Invalidate any older unused challenges for this member
  await queryMemberDb(
    'DELETE FROM telegram_link_challenges WHERE member_id = ? AND used_at IS NULL',
    [memberId]
  )

  await queryMemberDb(
    'INSERT INTO telegram_link_challenges (member_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [memberId, token, expiresAt]
  )

  const botUrl = `https://t.me/${botUsername}?start=${token}`
  return { token, botUrl, expiresAt }
}

/**
 * Check linking status of a member
 */
export async function getMemberTelegramLink(memberId: number): Promise<TelegramLinkStatus> {
  const rows = await queryMemberDb(
    'SELECT telegram_chat_id, telegram_username, first_name, linked_at FROM member_telegram_links WHERE member_id = ? LIMIT 1',
    [memberId]
  )

  if (!rows || rows.length === 0) {
    return { isLinked: false }
  }

  const link = rows[0]
  const chatIdStr = String(link.telegram_chat_id)

  return {
    isLinked: true,
    telegramUsername: link.telegram_username,
    firstName: link.first_name,
    linkedAt: link.linked_at ? new Date(link.linked_at).toISOString() : null,
    telegramChatIdMasked: chatIdStr,
  }
}

/**
 * Unlink Telegram from a member by member ID
 */
export async function unlinkMemberTelegram(memberId: number): Promise<boolean> {
  await queryMemberDb('DELETE FROM member_telegram_links WHERE member_id = ?', [memberId])
  return true
}

/**
 * Unlink Telegram by chat ID (called from /unlink command)
 */
export async function unlinkTelegramByChatId(
  chatId: number | string
): Promise<{ success: boolean; memberName?: string }> {
  const rows = await queryMemberDb(
    `SELECT m.id, m.name, m.username 
     FROM member_telegram_links l
     JOIN members m ON l.member_id = m.id
     WHERE l.telegram_chat_id = ? LIMIT 1`,
    [chatId]
  )

  if (!rows || rows.length === 0) {
    return { success: false }
  }

  const member = rows[0]
  await queryMemberDb('DELETE FROM member_telegram_links WHERE telegram_chat_id = ?', [chatId])
  return { success: true, memberName: member.name || member.username }
}

/**
 * Verify challenge token and link Telegram account
 */
export async function verifyAndLinkTelegram(
  token: string,
  chatId: number,
  userId: number,
  username?: string,
  firstName?: string
): Promise<{ success: boolean; memberName?: string; error?: string }> {
  // 1. Find valid challenge token
  const challenges = await queryMemberDb(
    'SELECT id, member_id, expires_at, used_at FROM telegram_link_challenges WHERE token_hash = ? LIMIT 1',
    [token]
  )

  if (!challenges || challenges.length === 0) {
    return { success: false, error: 'รหัสเชื่อมต่อไม่ถูกต้อง หรือถูกยกเลิกแล้ว' }
  }

  const challenge = challenges[0]

  if (challenge.used_at) {
    return { success: false, error: 'รหัสเชื่อมต่อนี้ถูกใช้งานไปแล้ว' }
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return { success: false, error: 'รหัสเชื่อมต่อนี้หมดอายุแล้ว กรุณากดขอเชื่อมต่อใหม่ที่หน้าเว็บไซต์' }
  }

  const memberId = challenge.member_id

  // 2. Fetch member info
  const members = await queryMemberDb('SELECT id, name, username FROM members WHERE id = ? LIMIT 1', [memberId])
  if (!members || members.length === 0) {
    return { success: false, error: 'ไม่พบบัญชีผู้ใช้งานในระบบ' }
  }

  const member = members[0]

  // 3. Upsert into member_telegram_links
  await queryMemberDb(
    `INSERT INTO member_telegram_links 
      (member_id, telegram_chat_id, telegram_user_id, telegram_username, first_name, linked_at) 
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
      telegram_chat_id = VALUES(telegram_chat_id),
      telegram_user_id = VALUES(telegram_user_id),
      telegram_username = VALUES(telegram_username),
      first_name = VALUES(first_name),
      updated_at = NOW()`,
    [memberId, chatId, userId, username || null, firstName || null]
  )

  // 4. Mark challenge as used
  await queryMemberDb('UPDATE telegram_link_challenges SET used_at = NOW() WHERE id = ?', [challenge.id])

  return { success: true, memberName: member.name || member.username }
}

/**
 * Helper to finalize repair completion, update database, audit log, group message, and notify requester
 */
async function completeRepairTaskHelper(params: {
  taskId: string
  memberId: number
  memberName: string
  username?: string
  solutionStep: string
  chatId?: number | string
  originalMessageId?: number
}): Promise<{ success: boolean; taskNo?: string; title?: string; error?: string }> {
  const { taskId, memberId, memberName, username, solutionStep, chatId, originalMessageId } = params

  // 1. Fetch Task and Repair Detail
  const tasks = await queryMemberDb('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId])
  if (!tasks || tasks.length === 0) {
    return { success: false, error: 'Task not found' }
  }
  const task = tasks[0]

  const repairRows = await queryMemberDb('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId])
  const repair = repairRows?.[0]

  // 2. Update Database
  await queryMemberDb(
    `UPDATE repair_details 
     SET repair_status = 'COMPLETED',
         solution_step = ?,
         updated_at = NOW()
     WHERE task_id = ?`,
    [solutionStep, taskId]
  )

  await queryMemberDb(
    `UPDATE inbox_tasks SET status = 'APPROVED', updated_at = NOW() WHERE id = ?`,
    [taskId]
  )

  await queryMemberDb(
    `UPDATE inbox_task_steps 
     SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
     WHERE task_id = ? AND step_no = 1`,
    [memberId, memberName, solutionStep, taskId]
  )

  // 3. Insert Audit Log
  await queryMemberDb(
    `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
     VALUES (?, ?, 'COMPLETE_REPAIR_TELEGRAM', ?, ?, ?)`,
    [
      crypto.randomUUID(),
      taskId,
      memberId,
      memberName || username || 'Technician',
      JSON.stringify({ status: 'COMPLETED', source: 'TELEGRAM_BOT', solution_step: solutionStep }),
    ]
  )

  const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
  const taskLink = `${domainUrl}/member/inbox/${taskId}`

  const thaiDate = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  // 4. Update Original Message in Telegram Group / Chat
  if (chatId && originalMessageId) {
    const lines: string[] = [
      `✅ <b>งานแจ้งซ่อมนี้ดำเนินการเสร็จสิ้นแล้ว</b>`,
      `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
      `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
    ]
    if (repair?.equipment_number) {
      lines.push(`🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(repair.equipment_number)}</code>`)
    }
    if (repair?.location_full_name) {
      lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(repair.location_full_name)}`)
    }
    lines.push(`👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(task.requester_name)}${task.requester_dept ? ` (${escapeHtml(task.requester_dept)})` : ''}`)
    lines.push(`👨‍🔧 <b>ช่างผู้ดำเนินการ :</b> ${escapeHtml(memberName)}`)
    lines.push(`📝 <b>ผลการซ่อม/การแก้ไข :</b> ${escapeHtml(solutionStep)}`)
    lines.push(`📍 <b>สถานะปัจจุบัน :</b> ✓ เสร็จสิ้นสมบูรณ์ (COMPLETED)`)
    lines.push(`⏰ <b>เวลาปิดงาน :</b> ${thaiDate} น.`)

    const completedGroupMsg = `${lines.join('\n\n')}\n\n──────────────────────\n✨ <i>ระบบได้บันทึกข้อมูลและส่งแจ้งเตือนไปยังผู้ยื่นคำขอเรียบร้อยแล้ว</i>`

    await editTelegramMessageText(chatId, originalMessageId, completedGroupMsg, {
      inline_keyboard: [
        [
          {
            text: '📋 เปิดดูรายละเอียดบนเว็บไซต์',
            url: taskLink,
          },
        ],
      ],
    })
  }

  // 5. Notify Requester on Telegram with solutionStep
  if (task.requester_id) {
    try {
      const reqLinks = await queryMemberDb(
        'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
        [task.requester_id]
      )

      if (reqLinks && reqLinks.length > 0) {
        const reqChatId = reqLinks[0].telegram_chat_id
        const costText = repair?.cost_type === 'HAS_COST' && repair?.cost_amount
          ? `มีค่าใช้จ่าย ${Number(repair.cost_amount).toLocaleString()} บาท`
          : 'ไม่มีค่าใช้จ่าย'

        const lines: string[] = [
          `✅ <b>งานแจ้งซ่อมของคุณดำเนินการเสร็จสิ้นแล้ว</b>`,
          `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
          `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
        ]
        if (repair?.location_full_name) {
          lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(repair.location_full_name)}`)
        }
        lines.push(`👨‍🔧 <b>ช่างผู้ดำเนินการ :</b> ${escapeHtml(memberName)}`)
        if (solutionStep) {
          lines.push(`📝 <b>ผลการซ่อม/การแก้ไข :</b> ${escapeHtml(solutionStep)}`)
        }
        lines.push(`💵 <b>ค่าใช้จ่าย :</b> ${costText}`)
        lines.push(`📍 <b>สถานะ :</b> ✓ ซ่อมเสร็จสิ้นสมบูรณ์`)
        lines.push(`⏰ <b>เวลาปิดงาน :</b> ${thaiDate} น.`)

        const reqMsg = `${lines.join('\n\n')}\n\n──────────────────────\n✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบรายละเอียดและพิมพ์ใบงาน</i>`

        await sendTelegramMessage(reqChatId, reqMsg, {
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
      }
    } catch (e) {
      logger.error({ e, taskId }, 'Failed to notify requester of repair completion from Telegram callback')
    }
  }

  return { success: true, taskNo: task.task_no, title: task.title }
}

/**
 * Unified Telegram Command Router & Update Processor
 * Shared identically between Webhook API and Intranet Long-Polling Service
 */
export async function processTelegramUpdate(update: TelegramUpdate): Promise<ProcessUpdateResult> {
  // ── 0. Handle Interactive Inline Button Callbacks (e.g. Accept Job Directly from Telegram) ──
  if (update?.callback_query) {
    const cb = update.callback_query
    const callbackId = cb.id
    const data = cb.data || ''
    const fromUser = cb.from
    const chatId = cb.message?.chat?.id
    const messageId = cb.message?.message_id

    if (data.startsWith('accept_repair:')) {
      const taskId = data.slice('accept_repair:'.length).trim()

      // 1. Find linked member
      const links = await queryMemberDb(
        `SELECT m.id, m.name, m.username, m.position, m.role 
         FROM member_telegram_links l
         JOIN members m ON l.member_id = m.id
         WHERE l.telegram_user_id = ? OR l.telegram_chat_id = ? 
         LIMIT 1`,
        [fromUser.id, chatId || 0]
      )

      if (!links || links.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบสมาชิกโรงพยาบาล', true)
        return { handled: true, action: 'ACCEPT_REPAIR_FAILED', error: 'User not linked' }
      }

      const currentMember = links[0]

      // 2. Fetch Task and Repair Detail
      const tasks = await queryMemberDb(
        'SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1',
        [taskId]
      )

      if (!tasks || tasks.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ ไม่พบข้อมูลงานซ่อมนี้ในระบบ', true)
        return { handled: true, action: 'ACCEPT_REPAIR_FAILED', error: 'Task not found' }
      }

      const task = tasks[0]

      if (task.status !== 'PENDING') {
        await answerTelegramCallbackQuery(callbackId, 'ℹ️ งานนี้มีผู้รับงานแล้ว หรือดำเนินการไปแล้วครับ', true)
        return { handled: true, action: 'ACCEPT_REPAIR_FAILED', error: 'Already accepted' }
      }

      const repairRows = await queryMemberDb(
        'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
        [taskId]
      )
      const repair = repairRows?.[0]

      // 3. Perform Accept Job in Database
      await queryMemberDb(
        `UPDATE inbox_tasks SET status = 'IN_PROGRESS', current_assignee = ?, updated_at = NOW() WHERE id = ?`,
        [currentMember.id, taskId]
      )
      await queryMemberDb(
        `UPDATE repair_details SET repair_status = 'IN_PROGRESS', assigned_technician_id = ?, assigned_technician_name = ?, updated_at = NOW() WHERE task_id = ?`,
        [currentMember.id, currentMember.name, taskId]
      )
      await queryMemberDb(
        `UPDATE inbox_task_steps SET status = 'IN_PROGRESS', assigned_to_id = ? WHERE task_id = ? AND step_no = 1`,
        [currentMember.id, taskId]
      )

      // 4. Write Audit Log
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'ACCEPT_JOB_TELEGRAM', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          taskId,
          currentMember.id,
          currentMember.name || currentMember.username,
          JSON.stringify({ status: 'IN_PROGRESS', source: 'TELEGRAM_INLINE_BUTTON', technician: currentMember.name }),
        ]
      )

      // 5. Answer Callback Query to stop spinner
      await answerTelegramCallbackQuery(callbackId, '✓ คุณได้รับงานแจ้งซ่อมนี้เรียบร้อยแล้ว!', false)

      const thaiDate = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())

      const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
      const taskLink = `${domainUrl}/member/inbox/${taskId}`

      // 6. Update message in Telegram chat with "ปิดงาน / ซ่อมเสร็จสิ้น" and "ยกเลิกงาน" action buttons
      if (chatId && messageId) {
        const lines: string[] = [
          `✅ <b>คุณได้รับงานแจ้งซ่อมนี้เรียบร้อยแล้ว</b>`,
          `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
          `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
        ]
        if (repair?.equipment_number) {
          lines.push(`🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(repair.equipment_number)}</code>`)
        }
        if (repair?.location_full_name) {
          lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(repair.location_full_name)}`)
        }
        lines.push(`👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(task.requester_name)}${task.requester_dept ? ` (${escapeHtml(task.requester_dept)})` : ''}`)
        lines.push(`👨‍🔧 <b>ช่างผู้รับงาน :</b> คุณ (${escapeHtml(currentMember.name)})`)
        lines.push(`📍 <b>สถานะปัจจุบัน :</b> ⚙️ กำลังอยู่ระหว่างดำเนินการตรวจซ่อม`)
        lines.push(`⏰ <b>เวลารับงาน :</b> ${thaiDate} น.`)

        const updatedMessage = `${lines.join('\n\n')}\n\n──────────────────────\n✨ <i>ระบบได้ส่งการแจ้งเตือนไปยังผู้ยื่นคำขอเรียบร้อยแล้ว</i>`

        await editTelegramMessageText(chatId, messageId, updatedMessage, {
          inline_keyboard: [
            [
              {
                text: '✅ ปิดงาน / ซ่อมเสร็จสิ้น',
                callback_data: `complete_repair:${taskId}`,
              },
              {
                text: '❌ ยกเลิกงาน',
                callback_data: `cancel_repair:${taskId}`,
              },
            ],
            [
              {
                text: '📋 เปิดดูรายละเอียดบนเว็บไซต์',
                url: taskLink,
              },
            ],
          ],
        })
      }

      // 7. Notify Requester on Telegram that technician accepted the job
      if (task.requester_id) {
        try {
          const reqLinks = await queryMemberDb(
            'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
            [task.requester_id]
          )

          if (reqLinks && reqLinks.length > 0) {
            const reqChatId = reqLinks[0].telegram_chat_id
            const lines: string[] = [
              `👨‍🔧 <b>ช่างได้รับงานแจ้งซ่อมของคุณแล้ว</b>`,
              `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
              `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
            ]
            if (repair?.equipment_number) {
              lines.push(`🔢 <b>เลขครุภัณฑ์ :</b> <code>${escapeHtml(repair.equipment_number)}</code>`)
            }
            if (repair?.location_full_name) {
              lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(repair.location_full_name)}`)
            }
            lines.push(`🔧 <b>ช่างผู้รับงาน :</b> ${escapeHtml(currentMember.name)}${currentMember.position ? ` (${escapeHtml(currentMember.position)})` : ''}`)
            lines.push(`📍 <b>สถานะ :</b> ⚙️ กำลังอยู่ระหว่างดำเนินการตรวจซ่อม`)
            lines.push(`⏰ <b>เวลารับงาน :</b> ${thaiDate} น.`)

            const reqMsg = `${lines.join('\n\n')}\n\n──────────────────────\n✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อติดตามความคืบหน้าของงาน</i>`

            await sendTelegramMessage(reqChatId, reqMsg, {
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
          }
        } catch (e) {
          logger.error({ e, taskId }, 'Failed to notify requester from Telegram callback')
        }
      }

      return {
        handled: true,
        action: 'ACCEPT_REPAIR_SUCCESS',
        memberName: currentMember.name,
      }
    }

    // ── Complete Repair Action (Trigger Prompt for notes) ──
    if (data.startsWith('complete_repair:')) {
      const taskId = data.slice('complete_repair:'.length).trim()

      const links = await queryMemberDb(
        `SELECT m.id, m.name, m.username, m.position, m.role 
         FROM member_telegram_links l
         JOIN members m ON l.member_id = m.id
         WHERE l.telegram_user_id = ? OR l.telegram_chat_id = ? 
         LIMIT 1`,
        [fromUser.id, chatId || 0]
      )

      if (!links || links.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบสมาชิกโรงพยาบาล', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: 'User not linked' }
      }

      const currentMember = links[0]

      const tasks = await queryMemberDb(
        'SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1',
        [taskId]
      )

      if (!tasks || tasks.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ ไม่พบข้อมูลงานซ่อมนี้ในระบบ', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: 'Task not found' }
      }

      const task = tasks[0]

      if (task.status === 'APPROVED') {
        await answerTelegramCallbackQuery(callbackId, 'ℹ️ งานนี้ดำเนินการเสร็จสิ้นไปแล้วครับ', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: 'Already completed' }
      }

      if (task.status === 'REJECTED') {
        await answerTelegramCallbackQuery(callbackId, '⚠️ ไม่สามารถปิดงานที่ถูกยกเลิกไปแล้วได้', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: 'Already cancelled' }
      }

      const repairRows = await queryMemberDb(
        'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
        [taskId]
      )
      const repair = repairRows?.[0]

      let coWorkers: any[] = []
      try {
        coWorkers = repair?.co_workers ? (typeof repair.co_workers === 'string' ? JSON.parse(repair.co_workers) : repair.co_workers) : []
      } catch {}

      const isAssignee = task.current_assignee === currentMember.id || repair?.assigned_technician_id === currentMember.id
      const isCoWorker = coWorkers.some((cw: any) => cw.id === currentMember.id)
      const isAdmin = currentMember.role === 'admin'

      if (!isAssignee && !isCoWorker && !isAdmin) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ เฉพาะช่างผู้รับผิดชอบงานนี้หรือผู้ดูแลระบบเท่านั้นที่สามารถปิดงานได้', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: 'Not authorized' }
      }

      // Record pending action for this technician (expires in 30 mins)
      pendingTechnicianActions.set(Number(fromUser.id), {
        action: 'AWAITING_REPAIR_COMPLETION_NOTE',
        taskId,
        taskNo: task.task_no,
        taskTitle: task.title,
        memberId: currentMember.id,
        memberName: currentMember.name || currentMember.username,
        groupChatId: chatId,
        originalMessageId: messageId,
        expiresAt: Date.now() + 30 * 60 * 1000,
      })

      await answerTelegramCallbackQuery(callbackId, '✍️ กรุณาพิมพ์รายละเอียดผลการซ่อมเพื่อปิดงาน', false)

      const promptLines: string[] = [
        `👨‍🔧 <b>บันทึกปิดงานซ่อม:</b> คุณ <b>${escapeHtml(currentMember.name)}</b>`,
        `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
        `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
        `✍️ <b>กรุณาพิมพ์ข้อความตอบกลับเพื่อระบุรายละเอียดผลการซ่อม/การแก้ไข</b>\n<i>(เช่น เปลี่ยนสายแพรใหม่, ลงโปรแกรมใหม่, ทำความสะอาดหัวพิมพ์ ฯลฯ หรือพิมพ์ <b>-</b> หากไม่มีรายละเอียด)</i>`,
        `💡 <i>หรือหากไม่ต้องการพิมพ์รายละเอียด สามารถกดปุ่มด้านล่างเพื่อยืนยันปิดงานได้ทันทีครับ</i>`,
      ]

      const promptRes = await sendTelegramMessage(
        chatId || fromUser.id,
        promptLines.join('\n\n'),
        {
          parseMode: 'HTML',
          replyMarkup: {
            force_reply: true,
            selective: true,
            inline_keyboard: [
              [
                {
                  text: '⚡ ยืนยันปิดงานทันที (ไม่ระบุรายละเอียด)',
                  callback_data: `confirm_complete:${taskId}`,
                },
                {
                  text: '↩️ ยกเลิก / กลับไปก่อน',
                  callback_data: `cancel_complete_prompt:${taskId}`,
                },
              ],
            ],
          },
        }
      )

      if (promptRes.success && promptRes.result?.message_id) {
        const existing = pendingTechnicianActions.get(Number(fromUser.id))
        if (existing) {
          pendingTechnicianActions.set(Number(fromUser.id), {
            ...existing,
            promptMessageId: promptRes.result.message_id
          })
        }
      }

      return {
        handled: true,
        action: 'COMPLETE_REPAIR_PROMPT',
        memberName: currentMember.name,
      }
    }

    // ── Quick Confirm Complete (Without typing notes) ──
    if (data.startsWith('confirm_complete:')) {
      const taskId = data.slice('confirm_complete:'.length).trim()

      const links = await queryMemberDb(
        `SELECT m.id, m.name, m.username, m.position, m.role 
         FROM member_telegram_links l
         JOIN members m ON l.member_id = m.id
         WHERE l.telegram_user_id = ? OR l.telegram_chat_id = ? 
         LIMIT 1`,
        [fromUser.id, chatId || 0]
      )

      if (!links || links.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบสมาชิกโรงพยาบาล', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: 'User not linked' }
      }

      const currentMember = links[0]
      const pending = pendingTechnicianActions.get(Number(fromUser.id))
      const origMsgId = pending?.originalMessageId

      const compResult = await completeRepairTaskHelper({
        taskId,
        memberId: currentMember.id,
        memberName: currentMember.name || currentMember.username,
        username: currentMember.username,
        solutionStep: 'ซ่อมเสร็จสิ้นเรียบร้อย (ปิดงานผ่าน Telegram)',
        chatId: pending?.groupChatId || chatId,
        originalMessageId: origMsgId,
      })

      pendingTechnicianActions.delete(Number(fromUser.id))

      if (!compResult.success) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ เกิดข้อผิดพลาดในการบันทึกปิดงาน', true)
        return { handled: true, action: 'COMPLETE_REPAIR_FAILED', error: compResult.error }
      }

      // Remove the inline keyboard from the prompt message
      if (chatId && messageId) {
        const editLines: string[] = [
          `👨‍🔧 <b>บันทึกปิดงานซ่อม:</b> คุณ <b>${escapeHtml(currentMember.name)}</b>`,
          `🏷️ <b>รหัสใบงาน :</b> <code>${compResult.taskNo || taskId}</code>`,
          `⚡ <i>ยืนยันปิดงานเรียบร้อยแล้ว</i>`,
        ]
        await editTelegramMessageText(
          chatId,
          messageId,
          editLines.join('\n\n')
        )
      }

      await answerTelegramCallbackQuery(callbackId, '✓ บันทึกปิดงานซ่อมเสร็จสิ้นเรียบร้อยแล้ว!', false)

      const successLines: string[] = [
        `🎉 <b>บันทึกปิดงานเรียบร้อยแล้ว</b>`,
        `🏷️ <b>รหัสใบงาน :</b> <code>${compResult.taskNo}</code>`,
        `👨‍🔧 <b>ช่างผู้ดำเนินการ :</b> ${escapeHtml(currentMember.name)}`,
        `✨ <i>ระบบได้บันทึกและส่งแจ้งเตือนไปยังผู้ยื่นคำขอแล้วครับ</i>`,
      ]

      await sendTelegramMessage(
        chatId || fromUser.id,
        successLines.join('\n\n')
      )

      return {
        handled: true,
        action: 'COMPLETE_REPAIR_SUCCESS',
        memberName: currentMember.name,
      }
    }

    // ── Cancel Complete Prompt ──
    if (data.startsWith('cancel_complete_prompt:')) {
      pendingTechnicianActions.delete(Number(fromUser.id))
      if (chatId && messageId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `❌ <i>ยกเลิกขั้นตอนการปิดงานแล้ว</i>`
        )
      }
      await answerTelegramCallbackQuery(callbackId, '↩️ ยกเลิกขั้นตอนการปิดงานแล้ว', false)
      return { handled: true, action: 'IGNORED' }
    }

    if (data.startsWith('cancel_repair:') || data.startsWith('reject_repair:')) {
      const taskId = (data.startsWith('cancel_repair:') ? data.slice('cancel_repair:'.length) : data.slice('reject_repair:'.length)).trim()

      // 1. Find linked member
      const links = await queryMemberDb(
        `SELECT m.id, m.name, m.username, m.position, m.role 
         FROM member_telegram_links l
         JOIN members m ON l.member_id = m.id
         WHERE l.telegram_user_id = ? OR l.telegram_chat_id = ? 
         LIMIT 1`,
        [fromUser.id, chatId || 0]
      )

      if (!links || links.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบสมาชิกโรงพยาบาล', true)
        return { handled: true, action: 'CANCEL_REPAIR_FAILED', error: 'User not linked' }
      }

      const currentMember = links[0]

      // 2. Fetch Task and Repair Detail
      const tasks = await queryMemberDb(
        'SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1',
        [taskId]
      )

      if (!tasks || tasks.length === 0) {
        await answerTelegramCallbackQuery(callbackId, '⚠️ ไม่พบข้อมูลงานซ่อมนี้ในระบบ', true)
        return { handled: true, action: 'CANCEL_REPAIR_FAILED', error: 'Task not found' }
      }

      const task = tasks[0]

      if (task.status === 'APPROVED' || task.status === 'REJECTED') {
        await answerTelegramCallbackQuery(callbackId, 'ℹ️ งานนี้ดำเนินการเสร็จสิ้นหรือถูกยกเลิกไปแล้วครับ', true)
        return { handled: true, action: 'CANCEL_REPAIR_FAILED', error: 'Already completed or rejected' }
      }

      const repairRows = await queryMemberDb(
        'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
        [taskId]
      )
      const repair = repairRows?.[0]

      // 3. Perform Cancel / Reject in Database
      await queryMemberDb(
        `UPDATE inbox_tasks SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`,
        [taskId]
      )
      await queryMemberDb(
        `UPDATE repair_details SET repair_status = 'CANCELLED', updated_at = NOW() WHERE task_id = ?`,
        [taskId]
      )
      await queryMemberDb(
        `UPDATE inbox_task_steps 
         SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = 'ยกเลิก / ปฏิเสธงานผ่าน Telegram' 
         WHERE task_id = ? AND step_no = 1`,
        [currentMember.id, currentMember.name || currentMember.username, taskId]
      )

      // 4. Write Audit Log
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'CANCEL_JOB_TELEGRAM', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          taskId,
          currentMember.id,
          currentMember.name || currentMember.username,
          JSON.stringify({ status: 'REJECTED', source: 'TELEGRAM_INLINE_BUTTON', cancelled_by: currentMember.name }),
        ]
      )

      // 5. Answer Callback Query to stop spinner
      await answerTelegramCallbackQuery(callbackId, '❌ คุณได้ยกเลิก/ปฏิเสธงานแจ้งซ่อมนี้เรียบร้อยแล้ว', false)

      const thaiDate = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())

      const domainUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://thlp.moph.go.th'
      const taskLink = `${domainUrl}/member/inbox/${taskId}`

      // 6. Update message in Telegram chat
      if (chatId && messageId) {
        const lines: string[] = [
          `❌ <b>คุณได้ยกเลิก / ปฏิเสธงานแจ้งซ่อมนี้แล้ว</b>`,
          `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
          `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
        ]
        if (repair?.location_full_name) {
          lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(repair.location_full_name)}`)
        }
        lines.push(`👤 <b>ผู้ยื่นคำขอ :</b> ${escapeHtml(task.requester_name)}${task.requester_dept ? ` (${escapeHtml(task.requester_dept)})` : ''}`)
        lines.push(`👨‍🔧 <b>ผู้ยกเลิก :</b> คุณ (${escapeHtml(currentMember.name)})`)
        lines.push(`📍 <b>สถานะปัจจุบัน :</b> ⛔ ปฏิเสธ / ยกเลิกรายการ`)
        lines.push(`⏰ <b>เวลายกเลิก :</b> ${thaiDate} น.`)

        const updatedMessage = `${lines.join('\n\n')}\n\n──────────────────────\n✨ <i>ระบบได้ส่งการแจ้งเตือนไปยังผู้ยื่นคำขอเรียบร้อยแล้ว</i>`

        await editTelegramMessageText(chatId, messageId, updatedMessage, {
          inline_keyboard: [
            [
              {
                text: '📋 เปิดดูรายละเอียดบนเว็บไซต์',
                url: taskLink,
              },
            ],
          ],
        })
      }

      // 7. Notify Requester on Telegram that technician cancelled/rejected the job
      if (task.requester_id) {
        try {
          const reqLinks = await queryMemberDb(
            'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
            [task.requester_id]
          )

          if (reqLinks && reqLinks.length > 0) {
            const reqChatId = reqLinks[0].telegram_chat_id
            const lines: string[] = [
              `❌ <b>งานแจ้งซ่อมของคุณถูกปฏิเสธ / ยกเลิก</b>`,
              `🏷️ <b>รหัสใบงาน :</b> <code>${task.task_no}</code>`,
              `📋 <b>เรื่อง :</b> ${escapeHtml(task.title)}`,
            ]
            if (repair?.location_full_name) {
              lines.push(`📍 <b>สถานที่ :</b> ${escapeHtml(repair.location_full_name)}`)
            }
            lines.push(`🔧 <b>ผู้ดำเนินการ :</b> ${escapeHtml(currentMember.name)}${currentMember.position ? ` (${escapeHtml(currentMember.position)})` : ''}`)
            lines.push(`📍 <b>สถานะ :</b> ⛔ ยกเลิก / ปฏิเสธรายการ`)
            lines.push(`⏰ <b>เวลายกเลิก :</b> ${thaiDate} น.`)

            const reqMsg = `${lines.join('\n\n')}\n\n──────────────────────\n✨ <i>ท่านสามารถกดปุ่มด้านล่างเพื่อตรวจสอบรายละเอียดในระบบ</i>`

            await sendTelegramMessage(reqChatId, reqMsg, {
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
          }
        } catch (e) {
          logger.error({ e, taskId }, 'Failed to notify requester of cancellation from Telegram callback')
        }
      }

      return {
        handled: true,
        action: 'CANCEL_REPAIR_SUCCESS',
        memberName: currentMember.name,
      }
    }

    return { handled: false, action: 'IGNORED' }
  }

  const message = update?.message
  if (!message || !message.text) {
    return { handled: false, action: 'IGNORED' }
  }

  const text = message.text.trim()
  const chatId = message.chat?.id
  const fromUser = message.from

  if (!chatId || !fromUser) {
    return { handled: false, action: 'IGNORED' }
  }

  // ── 1. Check if user is replying with repair completion notes ──
  const pending = pendingTechnicianActions.get(Number(fromUser.id))
  if (pending && pending.action === 'AWAITING_REPAIR_COMPLETION_NOTE') {
    if (Date.now() > pending.expiresAt) {
      pendingTechnicianActions.delete(Number(fromUser.id))
    } else if (!text.startsWith('/')) {
      const solutionStep = text === '-' ? 'ซ่อมเสร็จสิ้นเรียบร้อย' : text

      const compResult = await completeRepairTaskHelper({
        taskId: pending.taskId,
        memberId: pending.memberId,
        memberName: pending.memberName,
        solutionStep,
        chatId: pending.groupChatId,
        originalMessageId: pending.originalMessageId,
      })

      pendingTechnicianActions.delete(Number(fromUser.id))

      if (compResult.success) {
        if (pending.promptMessageId) {
          try {
            const editPromptLines: string[] = [
              `👨‍🔧 <b>บันทึกปิดงานซ่อม:</b> คุณ <b>${escapeHtml(pending.memberName)}</b>`,
              `🏷️ <b>รหัสใบงาน :</b> <code>${pending.taskNo}</code>`,
              `✅ <i>รับข้อมูลรายละเอียดการซ่อมเรียบร้อยแล้ว</i>`,
            ]
            await editTelegramMessageText(
              chatId,
              pending.promptMessageId,
              editPromptLines.join('\n\n')
            )
          } catch (e) {
            logger.warn({ e }, 'Could not edit prompt message to remove buttons')
          }
        }

        const doneLines: string[] = [
          `🎉 <b>บันทึกผลการซ่อมและปิดงานเรียบร้อยแล้ว!</b>`,
          `🏷️ <b>รหัสใบงาน :</b> <code>${pending.taskNo}</code>`,
          `📋 <b>เรื่อง :</b> ${escapeHtml(pending.taskTitle)}`,
          `📝 <b>ผลการดำเนินงาน :</b> ${escapeHtml(solutionStep)}`,
          `👨‍🔧 <b>ช่างผู้บันทึก :</b> ${escapeHtml(pending.memberName)}`,
          `✨ <i>ระบบได้บันทึกเข้าสู่ฐานข้อมูลและส่งแจ้งเตือนไปยังผู้ยื่นคำขอเรียบร้อยแล้วครับ</i>`,
        ]

        await sendTelegramMessage(
          chatId,
          doneLines.join('\n\n')
        )

        return {
          handled: true,
          action: 'COMPLETE_REPAIR_SUCCESS',
          memberName: pending.memberName,
        }
      } else {
        await sendTelegramMessage(chatId, `⚠️ ไม่สามารถบันทึกผลการซ่อมได้: ${compResult.error || 'เกิดข้อผิดพลาด'}`)
        return {
          handled: true,
          action: 'COMPLETE_REPAIR_FAILED',
          error: compResult.error,
        }
      }
    }
  }

  // ── 2. Handle "/start" or "/start <token>" ──
  if (text.startsWith('/start')) {
    pendingTechnicianActions.delete(Number(fromUser.id))
    const parts = text.split(/\s+/)
    const token = parts[1]

    if (!token) {
      const helpLines: string[] = [
        `👋 <b>ยินดีต้อนรับสู่ระบบแจ้งเตือน โรงพยาบาลเถิน</b>`,
        `หากท่านต้องการผูกบัญชีเพื่อรับแจ้งเตือน กรุณาเข้าสู่ระบบเว็บไซต์โรงพยาบาล ไปที่ <b>หน้าโปรไฟล์สมาชิก</b> แล้วกดปุ่ม <b>"เชื่อมต่อ Telegram"</b> ครับ`,
      ]
      await sendTelegramMessage(
        chatId,
        helpLines.join('\n\n')
      )
      return { handled: true, action: 'START_HELP' }
    }

    const linkResult = await verifyAndLinkTelegram(
      token,
      Number(chatId),
      fromUser.id,
      fromUser.username,
      fromUser.first_name
    )

    if (linkResult.success) {
      await logAudit(
        'UPDATE',
        'member_telegram_links',
        `Successfully linked Telegram user ${fromUser.id} to member: ${linkResult.memberName}`
      )

      const linkSuccessLines: string[] = [
        `✅ <b>ผูกบัญชีสำเร็จเรียบร้อยแล้ว!</b>`,
        `สวัสดีครับคุณ <b>${linkResult.memberName}</b>\nบัญชี Telegram ของท่านได้เชื่อมต่อกับระบบเว็บไซต์โรงพยาบาลเถินแล้ว`,
        `ท่านจะได้รับการแจ้งเตือนส่วนตัวผ่านทางนี้ เมื่อมีงานหรือเอกสารที่เกี่ยวข้องกับท่านครับ ✨`,
      ]
      await sendTelegramMessage(
        chatId,
        linkSuccessLines.join('\n\n')
      )

      return {
        handled: true,
        action: 'LINK_SUCCESS',
        memberName: linkResult.memberName,
      }
    } else {
      const linkFailLines: string[] = [
        `⚠️ <b>ไม่สามารถผูกบัญชีได้</b>`,
        `สาเหตุ: ${linkResult.error || 'รหัสเชื่อมต่อไม่ถูกต้อง'}`,
        `กรุณากลับไปที่เว็บไซต์โรงพยาบาล แล้วกดขอรหัสเชื่อมต่อใหม่อีกครั้งครับ`,
      ]
      await sendTelegramMessage(
        chatId,
        linkFailLines.join('\n\n')
      )

      return {
        handled: true,
        action: 'LINK_FAILED',
        error: linkResult.error,
      }
    }
  }

  // 3. Handle "/unlink" or "/disconnect"
  if (text === '/unlink' || text === '/disconnect') {
    const unlinkResult = await unlinkTelegramByChatId(chatId)

    if (unlinkResult.success) {
      await logAudit(
        'DELETE',
        'member_telegram_links',
        `User unlinked Telegram account via /unlink command in bot: ${unlinkResult.memberName}`
      )

      const unlinkSuccessLines: string[] = [
        `👋 <b>ยกเลิกการเชื่อมต่อบัญชีเรียบร้อยแล้ว</b>`,
        `บัญชี Telegram ของท่านไม่ได้ผูกกับระบบโรงพยาบาลเถินแล้ว หากต้องการเชื่อมต่อใหม่ สามารถเข้าไปกดสร้างรหัสเชื่อมต่อได้ที่หน้าเว็บไซต์โรงพยาบาลครับ`,
      ]
      await sendTelegramMessage(
        chatId,
        unlinkSuccessLines.join('\n\n')
      )

      return {
        handled: true,
        action: 'UNLINK_SUCCESS',
        memberName: unlinkResult.memberName,
      }
    } else {
      await sendTelegramMessage(
        chatId,
        `ℹ️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบโรงพยาบาลเถินครับ`
      )

      return {
        handled: true,
        action: 'UNLINK_FAILED',
      }
    }
  }

  // 4. Handle "/id", "/chatid", "/groupid", "/myid"
  const command = text.toLowerCase().split(/\s+/)[0]
  if (
    command === '/id' ||
    command.startsWith('/id@') ||
    command === '/chatid' ||
    command.startsWith('/chatid@') ||
    command === '/groupid' ||
    command.startsWith('/groupid@') ||
    command === '/myid' ||
    command.startsWith('/myid@')
  ) {
    const isGroup = message.chat?.type === 'group' || message.chat?.type === 'supergroup'
    const chatTitle = (message.chat as any)?.title || 'กลุ่มนี้'

    let idMsg = ''
    if (isGroup) {
      const groupLines: string[] = [
        `🆔 <b>ข้อมูล Telegram Group ID:</b>`,
        `👥 <b>ชื่อกลุ่ม:</b> ${escapeHtml(chatTitle)}`,
        `📌 <b>Group Chat ID:</b> <code>${chatId}</code>`,
        `👤 <b>User ID ของคุณ:</b> <code>${fromUser.id}</code>`,
      ]
      idMsg = `${groupLines.join('\n\n')}\n\n──────────────────────\n💡 <i>คัดลอกค่า Group Chat ID ด้านบนไปใส่ในไฟล์ .env ได้เลยครับ เช่น:</i>\n<code>TELEGRAM_GROUP_MEDIA_REQUEST="${chatId}"</code>`
    } else {
      const userLines: string[] = [
        `🆔 <b>ข้อมูล Telegram ID ของคุณ:</b>`,
        `📌 <b>Chat ID / User ID:</b> <code>${chatId}</code>`,
        `👤 <b>ชื่อผู้ใช้:</b> ${escapeHtml(fromUser.first_name || '')} (${fromUser.username ? '@' + fromUser.username : '-'})`,
      ]
      idMsg = `${userLines.join('\n\n')}\n\n──────────────────────\n💡 <i>หากต้องการผูกบัญชีเพื่อรับแจ้งเตือน กรุณากดปุ่มเชื่อมต่อ Telegram ที่หน้าเว็บไซต์โรงพยาบาลครับ</i>`
    }

    await sendTelegramMessage(chatId, idMsg)
    return { handled: true, action: 'START_HELP' }
  }

  return { handled: false, action: 'IGNORED' }
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

export const TelegramBotCore = {
  processUpdate: processTelegramUpdate,
  sendMessage: sendTelegramMessage,
  answerCallbackQuery: answerTelegramCallbackQuery,
  editMessageText: editTelegramMessageText,
  createLinkChallenge: createTelegramLinkChallenge,
  getMemberLink: getMemberTelegramLink,
  unlinkMember: unlinkMemberTelegram,
  unlinkByChatId: unlinkTelegramByChatId,
  verifyAndLink: verifyAndLinkTelegram,
}
