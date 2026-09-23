import { NextRequest, NextResponse } from 'next/server'
import { verifyAndLinkTelegram, sendTelegramMessage } from '@/lib/telegramService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

/**
 * Constant-time string comparison to prevent timing attacks on webhook secret
 */
function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

/**
 * Telegram Webhook Handler
 * Receives updates from Telegram Bot API (e.g. /start <token>)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify Secret Token if TELEGRAM_WEBHOOK_SECRET is set
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (webhookSecret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token') || ''
      if (!secureCompare(headerSecret, webhookSecret)) {
        logger.warn('Unauthorized Telegram webhook attempt: secret mismatch')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const update = await req.json()

    // 2. We are primarily looking for message updates with text commands
    const message = update?.message
    if (!message || !message.text) {
      // Return 200 OK so Telegram doesn't keep resending unhandled updates (like photos or inline callbacks)
      return NextResponse.json({ ok: true })
    }

    const text = message.text.trim()
    const chatId = message.chat?.id
    const fromUser = message.from

    if (!chatId || !fromUser) {
      return NextResponse.json({ ok: true })
    }

    // 3. Handle "/start <token>" command for account linking
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const token = parts[1]

      if (!token) {
        // User clicked start without a token
        await sendTelegramMessage(
          chatId,
          `👋 <b>ยินดีต้อนรับสู่ระบบแจ้งเตือน โรงพยาบาลเถิน</b>\n\nหากท่านต้องการผูกบัญชีเพื่อรับแจ้งเตือน กรุณาเข้าสู่ระบบเว็บไซต์โรงพยาบาล ไปที่ <b>หน้าโปรไฟล์สมาชิก</b> แล้วกดปุ่ม <b>"เชื่อมต่อ Telegram"</b> ครับ`
        )
        return NextResponse.json({ ok: true })
      }

      // Verify and link account
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
          `✅ <b>ผูกบัญชีสำเร็จเรียบร้อยแล้ว!</b>\n\nสวัสดีครับคุณ <b>${linkResult.memberName}</b>\nบัญชี Telegram ของท่านได้เชื่อมต่อกับระบบเว็บไซต์โรงพยาบาลเถินแล้ว\n\nท่านจะได้รับการแจ้งเตือนส่วนตัวผ่านทางนี้ เมื่อมีงานซ่อมหรือเอกสารที่เกี่ยวข้องกับท่านครับ ✨`
        )
      } else {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>ไม่สามารถผูกบัญชีได้</b>\n\nสาเหตุ: ${linkResult.error || 'รหัสเชื่อมต่อไม่ถูกต้อง'}\n\nกรุณากลับไปที่เว็บไซต์โรงพยาบาล แล้วกดขอรหัสเชื่อมต่อใหม่อีกครั้งครับ`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // 4. Handle "/unlink" command to unlink directly from Telegram
    if (text === '/unlink' || text === '/disconnect') {
      const { unlinkTelegramByChatId } = await import('@/lib/telegramService')
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
      } else {
        await sendTelegramMessage(
          chatId,
          `ℹ️ บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบโรงพยาบาลเถินครับ`
        )
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    logger.error({ error }, 'Error processing Telegram webhook')
    return NextResponse.json({ ok: true }) // Always return 200 to avoid Telegram webhook retry storms
  }
}
