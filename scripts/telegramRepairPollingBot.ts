/**
 * Telegram Staff Notification & Account Linking Polling Bot
 *
 * Standalone background service for Thoen Hospital:
 * - Solves Cloudflare/WAF foreign IP blocking Telegram webhook requests.
 * - Uses getUpdates long-polling to pull events outbound from the server.
 * - Processes:
 *     1. Commands: "/start <token>" (ผูกบัญชี Telegram กับระบบสมาชิกโรงพยาบาล)
 *     2. Commands: "/unlink" หรือ "/disconnect" (ยกเลิกการผูกบัญชี)
 *
 * Usage:
 *   npx tsx scripts/telegramRepairPollingBot.ts
 */

import path from 'path'
import dotenv from 'dotenv'

// Load environment from root .env of the website
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import dns from 'dns'

// Force IPv4 first to prevent network timeouts on hospital intranet
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

import { verifyAndLinkTelegram, unlinkTelegramByChatId, sendTelegramMessage } from '../src/lib/telegramService'
import { logAudit } from '../src/lib/audit'
import { logger } from '../src/lib/logger'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not configured in .env or scripts/.env.bot')
  process.exit(1)
}

async function callTelegram(method: string, payload: Record<string, any> = {}) {
  const url = `${API_BASE}/${method}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Telegram API Error [${method}]: ${response.status} - ${errText}`)
  }

  return response.json()
}

/**
 * Handle incoming message (/start <token>, /unlink)
 */
async function handleMessage(message: any) {
  const text = message.text?.trim()
  const chatId = message.chat?.id
  const fromUser = message.from

  if (!text || !chatId || !fromUser) return

  try {
    // 1. /start <token>
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const token = parts[1]

      if (!token) {
        await sendTelegramMessage(
          chatId,
          `👋 <b>ยินดีต้อนรับสู่ระบบแจ้งเตือน โรงพยาบาลเถิน</b>\n\nหากท่านต้องการผูกบัญชีเพื่อรับแจ้งเตือน กรุณาเข้าสู่ระบบเว็บไซต์โรงพยาบาล ไปที่ <b>หน้าโปรไฟล์สมาชิก</b> แล้วกดปุ่ม <b>"เชื่อมต่อ Telegram"</b> ครับ`
        )
        return
      }

      console.log(`🔗 Processing account linking with token for user ${fromUser.id} (${fromUser.first_name || fromUser.username})...`)

      const linkResult = await verifyAndLinkTelegram(
        token,
        chatId,
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
        console.log(`✅ Successfully linked member: ${linkResult.memberName}`)
      } else {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>ไม่สามารถผูกบัญชีได้</b>\n\nสาเหตุ: ${linkResult.error || 'รหัสเชื่อมต่อไม่ถูกต้อง'}\n\nกรุณากลับไปที่เว็บไซต์โรงพยาบาล แล้วกดขอรหัสเชื่อมต่อใหม่อีกครั้งครับ`
        )
        console.warn(`⚠️ Linking failed: ${linkResult.error}`)
      }
      return
    }

    // 2. /unlink or /disconnect
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
        console.log(`👋 Unlinked member: ${unlinkResult.memberName}`)
      } else {
        await sendTelegramMessage(
          chatId,
          `ℹ️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบโรงพยาบาลเถินครับ`
        )
      }
      return
    }
  } catch (error) {
    logger.error({ error, chatId }, 'Error handling message in polling bot')
  }
}

/**
 * Main polling loop
 */
async function main() {
  console.log('🤖 Checking Telegram bot credentials...')
  try {
    const me = await callTelegram('getMe')
    console.log(`✅ Connected as @${me.result.username} (${me.result.first_name})`)
  } catch (err) {
    console.error('❌ Failed to connect to Telegram API:', err)
    process.exit(1)
  }

  // Ensure webhook is removed before polling, else getUpdates returns 409 Conflict
  try {
    console.log('🔄 Checking webhook status and deleting if active...')
    await callTelegram('deleteWebhook', { drop_pending_updates: false })
    console.log('✅ Webhook successfully deactivated for polling mode.')
  } catch (err) {
    console.warn('⚠️ Could not delete webhook (it might be already deleted):', err)
  }

  console.log('📡 Telegram Staff & Notification Polling Service is now listening (Long-Polling)...')

  let offset = 0
  while (true) {
    try {
      const res = await callTelegram('getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message', 'callback_query'],
      })

      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1

          if (update.message) {
            await handleMessage(update.message)
          }
        }
      }
    } catch (err: any) {
      console.error('⚠️ Polling error (retrying in 5 seconds):', err?.message || err)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

main().catch((err) => {
  console.error('Fatal bot error:', err)
  process.exit(1)
})
