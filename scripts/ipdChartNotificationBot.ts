/**
 * Telegram Bot Notification Script for IPD Incomplete Charts Summary (สรุปชาร์ตค้าง IPD)
 *
 * Standalone Service for Thoen Hospital:
 * - Queries HOSxP MySQL for incomplete charts grouped by discharging doctor.
 * - Formats HTML report message.
 * - Sends alert to hospital Telegram group via sendTelegramMessage.
 *
 * Usage:
 *   npx tsx scripts/ipdChartNotificationBot.ts --now        (Run immediate check & send to group)
 *   npx tsx scripts/ipdChartNotificationBot.ts --dry-run    (Print to console only without sending)
 */

import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
dotenv.config()

import dns from 'dns'
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

import { RcmDashboardService } from '../src/lib/clinical/rcmDashboardService'
import { sendTelegramMessage } from '../src/lib/telegramService'

const isDryRun = process.argv.includes('--dry-run')
const isNow = process.argv.includes('--now')

async function run() {
  console.log(`[${new Date().toISOString()}] Starting IPD Incomplete Chart Summary Bot...`)

  try {
    const reportData = await RcmDashboardService.getIpdDoctorChartSummary()
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://thlp.moph.go.th'
    const appUrl = `${baseUrl.replace(/\/+$/, '')}/service/dashboard-rcm/ipd`
    const message = RcmDashboardService.formatTelegramChartSummary(reportData, appUrl)

    console.log(`Summary: Total ${reportData.grandTotal.total_charts} charts, Incomplete: ${reportData.grandTotal.uncompleted_charts} charts across ${reportData.doctors.length} doctors.`)

    if (isDryRun) {
      console.log('\n--- DRY RUN: Telegram Message Preview ---')
      console.log(message.replace(/<[^>]*>/g, ''))
      console.log('-----------------------------------------\n')
      process.exit(0)
    }

    const chatId = process.env.TELEGRAM_IPD_CHAT_ID || process.env.TELEGRAM_CHAT_ID

    if (!chatId) {
      console.error('Error: TELEGRAM_IPD_CHAT_ID or TELEGRAM_CHAT_ID is not configured in .env')
      process.exit(1)
    }

    console.log(`Sending message to Telegram Chat ID: ${chatId}...`)
    const result = await sendTelegramMessage(chatId, message, 'HTML')

    if (result.success) {
      console.log('✅ Successfully sent IPD chart summary to Telegram!')
      process.exit(0)
    } else {
      console.error('❌ Failed to send Telegram message:', result.error)
      process.exit(1)
    }
  } catch (err: any) {
    console.error('Fatal error running IPD Chart Notification Bot:', err?.message || err)
    process.exit(1)
  }
}

run()
