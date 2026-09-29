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

import { processTelegramUpdate } from '../src/lib/telegram/telegramCore'
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

          if (update.callback_query) {
            console.log(`📩 Incoming callback_query: [${update.callback_query.data}] from user ${update.callback_query.from.id} (${update.callback_query.from.first_name || update.callback_query.from.username})`)
          } else if (update.message?.text) {
            console.log(`📩 Incoming text message: "${update.message.text}" from user ${update.message.from?.id} (${update.message.from?.first_name || update.message.from?.username})`)
          }

          if (update.message || update.callback_query) {
            const result = await processTelegramUpdate(update)
            console.log(`📡 Result: action=${result.action}, handled=${result.handled}, member=${result.memberName || 'N/A'}${result.error ? `, error=${result.error}` : ''}`)
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
