import { NextRequest, NextResponse } from 'next/server'
import { processTelegramUpdate } from '@/lib/telegram/telegramCore'
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
 * Receives updates from Telegram Bot API and delegates to TelegramBotCore
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
    await processTelegramUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    logger.error({ error }, 'Error processing Telegram webhook')
    return NextResponse.json({ ok: true }) // Always return 200 to avoid Telegram webhook retry storms
  }
}

