import { queryMemberDb } from '@/lib/memberDb'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export interface TelegramLinkStatus {
  isLinked: boolean
  telegramUsername?: string | null
  firstName?: string | null
  linkedAt?: string | null
  telegramChatIdMasked?: string | null
}

/**
 * Send message to a telegram user or group using Bot API
 */
export async function sendTelegramMessage(chatId: string | number, text: string, parseMode: 'HTML' | 'MarkdownV2' = 'HTML') {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN is not configured; skipping Telegram message delivery')
    return { success: false, error: 'Telegram Bot Token not configured' }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      logger.error({ error: data }, 'Failed to send Telegram message')
      return { success: false, error: data?.description || 'Failed to send Telegram message' }
    }

    return { success: true, result: data.result }
  } catch (err: any) {
    logger.error({ err }, 'Error sending Telegram message')
    return { success: false, error: err.message }
  }
}

/**
 * Generate a secure one-time challenge token for linking Telegram
 */
export async function createTelegramLinkChallenge(memberId: number): Promise<{ token: string; botUrl: string; expiresAt: Date }> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'ThoenHospitalBot'
  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

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
 * Unlink Telegram from a member
 */
export async function unlinkMemberTelegram(memberId: number): Promise<boolean> {
  await queryMemberDb(
    'DELETE FROM member_telegram_links WHERE member_id = ?',
    [memberId]
  )
  return true
}

/**
 * Unlink Telegram by Telegram chat ID (called from Telegram command /unlink)
 */
export async function unlinkTelegramByChatId(chatId: number | string): Promise<{ success: boolean; memberName?: string }> {
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
 * Verify token and link Telegram account (called from Telegram Webhook /start <token>)
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

  // 3. Insert or update link (upsert pattern)
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
  await queryMemberDb(
    'UPDATE telegram_link_challenges SET used_at = NOW() WHERE id = ?',
    [challenge.id]
  )

  return { success: true, memberName: member.name || member.username }
}
