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
}

export interface SendMessageOptions {
  parseMode?: 'HTML' | 'MarkdownV2'
  timeoutMs?: number
}

export interface ProcessUpdateResult {
  handled: boolean
  action?: 'START_HELP' | 'LINK_SUCCESS' | 'LINK_FAILED' | 'UNLINK_SUCCESS' | 'UNLINK_FAILED' | 'IGNORED'
  memberName?: string
  error?: string
}

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
      signal: controller.signal,
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      logger.error({ error: data }, 'Failed to send Telegram message')
      return { success: false, error: data?.description || 'Failed to send Telegram message' }
    }

    return { success: true, result: data.result }
  } catch (err: any) {
    const isAbort = err.name === 'AbortError'
    const errorMsg = isAbort ? 'Telegram API request timed out' : err.message
    logger.error({ err, isAbort }, 'Error sending Telegram message')
    return { success: false, error: errorMsg }
  } finally {
    clearTimeout(timeoutId)
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
 * Unified Telegram Command Router & Update Processor
 * Shared identically between Webhook API and Intranet Long-Polling Service
 */
export async function processTelegramUpdate(update: TelegramUpdate): Promise<ProcessUpdateResult> {
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

  // 1. Handle "/start" or "/start <token>"
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/)
    const token = parts[1]

    if (!token) {
      await sendTelegramMessage(
        chatId,
        `👋 <b>ยินดีต้อนรับสู่ระบบแจ้งเตือน โรงพยาบาลเถิน</b>\n\nหากท่านต้องการผูกบัญชีเพื่อรับแจ้งเตือน กรุณาเข้าสู่ระบบเว็บไซต์โรงพยาบาล ไปที่ <b>หน้าโปรไฟล์สมาชิก</b> แล้วกดปุ่ม <b>"เชื่อมต่อ Telegram"</b> ครับ`
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

      await sendTelegramMessage(
        chatId,
        `✅ <b>ผูกบัญชีสำเร็จเรียบร้อยแล้ว!</b>\n\nสวัสดีครับคุณ <b>${linkResult.memberName}</b>\nบัญชี Telegram ของท่านได้เชื่อมต่อกับระบบเว็บไซต์โรงพยาบาลเถินแล้ว\n\nท่านจะได้รับการแจ้งเตือนส่วนตัวผ่านทางนี้ เมื่อมีงานหรือเอกสารที่เกี่ยวข้องกับท่านครับ ✨`
      )

      return {
        handled: true,
        action: 'LINK_SUCCESS',
        memberName: linkResult.memberName,
      }
    } else {
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>ไม่สามารถผูกบัญชีได้</b>\n\nสาเหตุ: ${linkResult.error || 'รหัสเชื่อมต่อไม่ถูกต้อง'}\n\nกรุณากลับไปที่เว็บไซต์โรงพยาบาล แล้วกดขอรหัสเชื่อมต่อใหม่อีกครั้งครับ`
      )

      return {
        handled: true,
        action: 'LINK_FAILED',
        error: linkResult.error,
      }
    }
  }

  // 2. Handle "/unlink" or "/disconnect"
  if (text === '/unlink' || text === '/disconnect') {
    const unlinkResult = await unlinkTelegramByChatId(chatId)

    if (unlinkResult.success) {
      await logAudit(
        'DELETE',
        'member_telegram_links',
        `User unlinked Telegram account via /unlink command in bot: ${unlinkResult.memberName}`
      )

      await sendTelegramMessage(
        chatId,
        `👋 <b>ยกเลิกการเชื่อมต่อบัญชีเรียบร้อยแล้ว</b>\n\nบัญชี Telegram ของท่านไม่ได้ผูกกับระบบโรงพยาบาลเถินแล้ว หากต้องการเชื่อมต่อใหม่ สามารถเข้าไปกดสร้างรหัสเชื่อมต่อได้ที่หน้าเว็บไซต์โรงพยาบาลครับ`
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

  return { handled: false, action: 'IGNORED' }
}

export const TelegramBotCore = {
  processUpdate: processTelegramUpdate,
  sendMessage: sendTelegramMessage,
  createLinkChallenge: createTelegramLinkChallenge,
  getMemberLink: getMemberTelegramLink,
  unlinkMember: unlinkMemberTelegram,
  unlinkByChatId: unlinkTelegramByChatId,
  verifyAndLink: verifyAndLinkTelegram,
}
