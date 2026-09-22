/**
 * Telegram Bot Notification Script for Appointment Mismatch (รายการนัดผิดห้องตรวจ)
 * 
 * Standalone Service for Thoen Hospital:
 * - Runs 24/7 with long-polling to receive user button clicks (Callback Queries).
 * - Schedules daily group summaries at 08:00 and 16:00 (Thai Time).
 * - Queries HOSxP MySQL (APPOINT_DB_*) for appointment mismatch records.
 * - Groups and sorts mismatches by app_user (count descending).
 * - Sends public summary with Inline Keyboard buttons to Telegram Group.
 * - Sends detailed HN list directly into user's Private Chat (DM) upon button click (PDPA compliant).
 * 
 * Usage:
 *   npx tsx scripts/appointmentMismatchBot.ts
 *   npx tsx scripts/appointmentMismatchBot.ts --now        (Run immediate check & send to group)
 *   npx tsx scripts/appointmentMismatchBot.ts --dry-run    (Print to console only without sending)
 */

import path from 'path'
import dotenv from 'dotenv'

// โหลด environment แยกเฉพาะของ Bot จาก scripts/.env.bot (หากไม่มีจะ fallback ไปที่ .env หลัก)
dotenv.config({ path: path.resolve(__dirname, '.env.bot') })
dotenv.config() // fallback to root .env if not found in .env.bot

import dns from 'dns'

// บังคับให้ Node.js แปลงโดเมนเป็น IPv4 ก่อนเสมอ ป้องกัน IPv6 connect timeout บนเครือข่ายโรงพยาบาล
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

import mysql from 'mysql2/promise'

interface AppointmentMismatch {
  hn: string
  department: string
  vstdate: string
  nextdate: string
  appUser: string
}

interface UserMismatchGroup {
  appUser: string
  count: number
  items: AppointmentMismatch[]
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

const API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

/**
 * Format ISO date string or MySQL date to Thai Buddhist format (e.g. "17 ก.ย. 2569")
 */
function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr

    const day = date.getDate()
    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear() + 543

    return `${day} ${month} ${year}`
  } catch {
    return dateStr
  }
}

/**
 * Helper to call Telegram API
 */
async function callTelegram(method: string, payload: Record<string, any>, timeoutMs = 45000) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const json = await response.json()
    return json
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch mismatches from HOSxP Database
 */
async function fetchMismatchesFromDb(): Promise<AppointmentMismatch[]> {
  const connection = await mysql.createConnection({
    host: process.env.APPOINT_DB_HOST || 'localhost',
    port: parseInt(process.env.APPOINT_DB_PORT || '3306', 10),
    user: process.env.APPOINT_DB_USER || 'root',
    password: process.env.APPOINT_DB_PASSWORD || '',
    database: process.env.APPOINT_DB_NAME || 'hos',
    charset: process.env.APPOINT_DB_CHARSET || 'tis620',
    connectTimeout: 7000,
  })

  try {
    const sql = `
      SELECT 
        o.hn,
        o.vstdate,
        o.nextdate,
        k.department,
        o.app_user
      FROM oapp o
      LEFT OUTER JOIN kskdepartment k ON o.depcode = k.depcode
      WHERE o.nextdate > CURRENT_DATE
        AND (k.depcode_active IS NULL OR k.depcode_active = '')
      ORDER BY o.app_user
    `

    const [rows]: any = await connection.execute(sql)

    return rows.map((row: any) => {
      const rawUser = row.app_user ? String(row.app_user).trim().replace(/\s+/g, ' ') : 'ไม่ระบุชื่อผู้นัด'
      const rawDept = row.department ? String(row.department).trim().replace(/\s+/g, ' ') : 'ไม่ระบุห้องตรวจ'
      return {
        hn: String(row.hn || ''),
        department: rawDept,
        vstdate: row.vstdate ? String(row.vstdate) : '',
        nextdate: row.nextdate ? String(row.nextdate) : '',
        appUser: rawUser,
      }
    })
  } finally {
    await connection.end()
  }
}

/**
 * Group and sort mismatches by appUser descending
 */
function groupAndSortMismatches(mismatches: AppointmentMismatch[]): UserMismatchGroup[] {
  const map = new Map<string, AppointmentMismatch[]>()

  for (const item of mismatches) {
    const user = item.appUser || 'ไม่ระบุชื่อผู้นัด'
    if (!map.has(user)) {
      map.set(user, [])
    }
    map.get(user)!.push(item)
  }

  const groups: UserMismatchGroup[] = []
  for (const [appUser, items] of map.entries()) {
    groups.push({
      appUser,
      count: items.length,
      items,
    })
  }

  // Sort descending by count
  groups.sort((a, b) => b.count - a.count)
  return groups
}

/**
 * In-memory cache for mapping callback IDs to user details
 * callback_data has a 64-byte limit in Telegram, so we use short index tokens
 */
const callbackCache = new Map<string, { appUser: string; items: AppointmentMismatch[] }>()

/**
 * Generate bot username link for deep-linking
 */
let botUsername = ''
async function getBotInfo() {
  try {
    const res = await callTelegram('getMe', {})
    if (res.ok && res.result?.username) {
      botUsername = res.result.username
      console.log(`🤖 Logged in as Telegram Bot: @${botUsername}`)
    }
  } catch (err) {
    console.error('⚠️ Could not fetch bot info:', err)
  }
}

/**
 * Send summary message to Telegram group
 */
async function sendGroupSummary(isDryRun = false) {
  console.log(`\n🔍 [${new Date().toLocaleString('th-TH')}] Checking appointment mismatches...`)

  let mismatches: AppointmentMismatch[] = []
  try {
    mismatches = await fetchMismatchesFromDb()
  } catch (err) {
    console.error('❌ Failed to fetch data from HOSxP:', err)
    if (!isDryRun && TELEGRAM_CHAT_ID) {
      await callTelegram('sendMessage', {
        chat_id: TELEGRAM_CHAT_ID,
        text: `⚠️ <b>ระบบแจ้งเตือนรายการนัดผิดห้องตรวจ</b>\nเกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล HOSxP ไม่สามารถดึงข้อมูลได้ในรอบนี้`,
        parse_mode: 'HTML',
      })
    }
    return
  }

  const nowThai = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const dateThai = formatThaiDate(new Date().toISOString())

  // Case 1: Zero mismatches
  if (mismatches.length === 0) {
    const message = 
      `✨ <b>รายงานตรวจสอบการนัดหมาย — รพ.เถิน</b>\n` +
      `📅 <b>ประจำวันที่:</b> ${dateThai} (${nowThai} น.)\n` +
      `──────────────────────────\n\n` +
      `🎉 <b>ยอดเยี่ยม! วันนี้ไม่พบรายการนัดผิดห้องตรวจ</b>\n\n` +
      `ทุกรายการนัดหมายระบุห้องตรวจถูกต้องครบถ้วน\n` +
      `เครื่องส่งตรวจอัตโนมัติสามารถทำงานได้ตามปกติครับ 👏\n\n` +
      `──────────────────────────\n` +
      `🌐 <b>ระบบนัดหมายออนไลน์:</b> <a href="https://thlp.moph.go.th/service/appointment-mismatch">thlp.moph.go.th</a>`

    console.log(message)

    if (!isDryRun && TELEGRAM_CHAT_ID) {
      await callTelegram('sendMessage', {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔗 ดูรายละเอียดทั้งหมดบนเว็บไซต์ (ต้องเข้าสู่ระบบสมาชิก)',
                url: 'https://thlp.moph.go.th/service/appointment-mismatch',
              },
            ],
          ],
        },
      })
    }
    return
  }

  // Case 2: Found mismatches
  const grouped = groupAndSortMismatches(mismatches)
  callbackCache.clear()

  let text = 
    `🔔 <b>รายงานสรุปรายการนัดผิดห้องตรวจ</b>\n` +
    `🏥 <b>โรงพยาบาลเถิน</b> | ประจำวันที่ ${dateThai} (${nowThai} น.)\n` +
    `──────────────────────────\n\n` +
    `⚠️ <b>พบรายการที่ต้องแก้ไข:</b> <code>${mismatches.length}</code> รายการ\n` +
    `<i>(หากระบุห้องตรวจไม่ถูกต้อง จะทำให้ระบบเครื่องส่งตรวจอัตโนมัติไม่ทำงาน)</i>\n\n` +
    `📋 <b>สรุปแยกตามผู้ทำรายการนัดหมาย:</b>\n`

  const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = []

  grouped.forEach((g, index) => {
    // Bold + space จัดคอลัมน์ให้อ่านง่าย สบายตา ไม่มี emoji อันดับ
    text += `• <b>${g.appUser}</b>  ➔  <b>${g.count}</b> รายการ\n`

    const token = `usr_${index}`
    callbackCache.set(token, { appUser: g.appUser, items: g.items })

    // Create inline buttons (1 button per row for clear reading)
    inlineKeyboard.push([
      {
        text: `👤 ดูรายการ HN ของ ${g.appUser} (${g.count})`,
        callback_data: token,
      },
    ])
  })

  text += 
    `\n──────────────────────────\n` +
    `💡 <i>กดปุ่มด้านล่างเพื่อรับรายการ HN ผ่านแชตส่วนตัว (PDPA)</i>\n` +
    `🔐 <i>สามารถตรวจสอบแบบเต็มได้ที่เว็บไซต์ (ต้อง Login สมาชิก)</i>`

  // แนบปุ่มลิงก์ไปยังเว็บไซต์ที่แถวล่างสุด
  inlineKeyboard.push([
    {
      text: '🔗 ดูรายละเอียดทั้งหมดบนเว็บไซต์ (ต้องเข้าสู่ระบบสมาชิก)',
      url: 'https://thlp.moph.go.th/service/appointment-mismatch',
    },
  ])

  if (isDryRun) {
    console.log('--- [DRY RUN MESSAGE] ---')
    console.log(text)
    console.log('--- [INLINE BUTTONS] ---', inlineKeyboard)
    return
  }

  if (!TELEGRAM_CHAT_ID) {
    console.error('❌ TELEGRAM_CHAT_ID is not configured in .env')
    return
  }

  const result = await callTelegram('sendMessage', {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  })

  if (result.ok) {
    console.log(`✅ Summary message sent successfully to group (ID: ${TELEGRAM_CHAT_ID})`)
  } else {
    console.error('❌ Failed to send Telegram message:', result)
  }
}

/**
 * Handle user clicking inline buttons in group
 */
async function handleCallbackQuery(callbackQuery: any) {
  const { id, from, data } = callbackQuery
  const userId = from.id
  const userName = from.first_name || 'ผู้ใช้งาน'

  if (!data || !callbackCache.has(data)) {
    await callTelegram('answerCallbackQuery', {
      callback_query_id: id,
      text: 'ข้อมูลชุดนี้หมดอายุแล้ว หรือระบบมีการรีสตาร์ท กรุณารอรอบแจ้งเตือนถัดไป',
      show_alert: true,
    })
    return
  }

  const { appUser, items } = callbackCache.get(data)!

  let dmText = 
    `📋 <b>รายละเอียดรายการนัดผิดห้องตรวจ</b>\n` +
    `👤 <b>ผู้นัด:</b> ${appUser}\n` +
    `📊 <b>จำนวนที่พบ:</b> <code>${items.length}</code> รายการ\n` +
    `──────────────────────────\n\n`

  items.forEach((it, idx) => {
    dmText += 
      `<b>${idx + 1}. HN:</b> <code>${it.hn}</code>\n` +
      `   ▫️ <b>วันที่รับบริการ:</b> ${formatThaiDate(it.vstdate)}\n` +
      `   ▫️ <b>วันนัดครั้งถัดไป:</b> ${formatThaiDate(it.nextdate)}\n` +
      `   ▫️ <b>ห้องตรวจที่ระบุ:</b> ${it.department}\n\n`
  })

  dmText += 
    `──────────────────────────\n` +
    `💡 <i>กรุณาตรวจสอบและแก้ไขห้องตรวจในโปรแกรม HOSxP ให้ถูกต้อง</i>\n` +
    `🌐 <a href="https://thlp.moph.go.th/service/appointment-mismatch">เข้าสู่ระบบเพื่อดูบนเว็บไซต์</a>`

  try {
    // Send to user's direct chat
    const sendRes = await callTelegram('sendMessage', {
      chat_id: userId,
      text: dmText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })

    if (sendRes.ok) {
      await callTelegram('answerCallbackQuery', {
        callback_query_id: id,
        text: `ส่งรายละเอียด ${items.length} รายการของ ${appUser} ไปที่แชตส่วนตัวของคุณเรียบร้อยแล้ว`,
        show_alert: false,
      })
    } else {
      // User hasn't started the bot yet
      const botLink = botUsername ? `https://t.me/${botUsername}` : 'บอท'
      await callTelegram('answerCallbackQuery', {
        callback_query_id: id,
        text: `ไม่สามารถส่งข้อความได้ กรุณากดเริ่มใช้งาน (Start) บอทที่แชตส่วนตัวก่อน: ${botLink}`,
        show_alert: true,
      })
    }
  } catch (err: any) {
    console.error(`❌ Error sending DM to user ${userId}:`, err?.message || err)
    await callTelegram('answerCallbackQuery', {
      callback_query_id: id,
      text: `กรุณากดคุยกับบอทที่แชตส่วนตัวก่อนอย่างน้อย 1 ครั้ง เพื่อเปิดสิทธิ์รับข้อความครับ`,
      show_alert: true,
    })
  }
}

/**
 * Handle incoming direct messages (e.g. /start or /check)
 */
async function handleMessage(msg: any) {
  const chatId = msg.chat?.id
  const text = (msg.text || '').trim()
  const chatType = msg.chat?.type

  if (!chatId || !text) return

  if (text === '/start') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: 
        `สวัสดีครับ! 🏥\n` +
        `นี่คือ <b>บอทแจ้งเตือนรายการนัดผิดห้องตรวจ โรงพยาบาลเถิน</b>\n\n` +
        `บอทจะส่งข้อมูลรายการ HN ของผู้ป่วยเข้าแชตส่วนตัวนี้ เมื่อท่านกดดูข้อมูลจากในกลุ่มโรงพยาบาลครับ`,
      parse_mode: 'HTML',
    })
    return
  }

  // Allow manual check via /check command (both in group or private)
  if (text === '/check' || text === `/check@${botUsername}`) {
    if (chatType === 'private') {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: 'กำลังตรวจสอบข้อมูลรายการนัดผิดห้องตรวจสักครู่...',
      })
    }
    await sendGroupSummary()
  }
}

/**
 * Long-polling loop to listen for updates
 */
async function startLongPolling() {
  let offset = 0
  console.log('📡 Telegram Long-polling listener started...')

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
            await handleCallbackQuery(update.callback_query)
          } else if (update.message) {
            await handleMessage(update.message)
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Polling error (will retry in 5s):', err)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

/**
 * Daily Schedule Checker (Runs every minute to check 08:00 and 16:00)
 */
function startInternalScheduler() {
  console.log('⏰ Internal scheduler initialized: targets 08:00 and 16:00 (Thai Time) daily.')

  let lastTriggeredDate = ''
  let lastTriggeredSlot = ''

  setInterval(async () => {
    // Current time in Bangkok UTC+7
    const now = new Date()
    const thaiTimeStr = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }) // "08:00" or "16:00"

    const thaiDateStr = now.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Bangkok',
    }) // "YYYY-MM-DD"

    const isSlot08 = thaiTimeStr === '08:00'
    const isSlot16 = thaiTimeStr === '16:00'

    if (isSlot08 || isSlot16) {
      const currentSlot = isSlot08 ? '08:00' : '16:00'

      // Prevent triggering multiple times in the same minute
      if (lastTriggeredDate !== thaiDateStr || lastTriggeredSlot !== currentSlot) {
        lastTriggeredDate = thaiDateStr
        lastTriggeredSlot = currentSlot
        console.log(`⏰ [Trigger] Scheduled daily alarm for slot ${currentSlot}`)
        await sendGroupSummary()
      }
    }
  }, 30000) // Check every 30 seconds
}

/**
 * Main Entry Point
 */
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isNow = args.includes('--now')

  console.log('========================================================')
  console.log('🏥 Thoen Hospital — Appointment Mismatch Telegram Bot')
  console.log('========================================================')

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ WARNING: TELEGRAM_BOT_TOKEN is not set in .env')
  }
  if (!TELEGRAM_CHAT_ID) {
    console.warn('⚠️ WARNING: TELEGRAM_CHAT_ID is not set in .env')
  }

  // If CLI invoked with --dry-run or --now, run one-off and exit
  if (isDryRun) {
    console.log('Mode: Dry-run test (Print output without sending)')
    await sendGroupSummary(true)
    process.exit(0)
  }

  if (isNow) {
    console.log('Mode: Immediate one-off check (--now)')
    await sendGroupSummary(false)
    process.exit(0)
  }

  // 24/7 Long Running Service Mode
  await getBotInfo()
  startInternalScheduler()
  await startLongPolling()
}

main().catch((err) => {
  console.error('💥 Fatal error in appointmentMismatchBot:', err)
  process.exit(1)
})
