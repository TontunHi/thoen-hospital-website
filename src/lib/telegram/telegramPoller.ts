import { processTelegramUpdate } from './telegramCore'
import { logger } from '@/lib/logger'
import dns from 'dns'

// Force IPv4 first to prevent network timeouts on hospital intranet
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

declare global {
  // eslint-disable-next-line no-var
  var __thoen_telegram_poller_active__: boolean | undefined
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

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
 * Background Long-Polling Worker for Telegram
 * Embedded into Next.js server lifecycle via instrumentation.ts
 */
export function startTelegramPolling() {
  if (process.env.DISABLE_TELEGRAM_POLLER === 'true') {
    logger.info('Telegram poller is disabled via DISABLE_TELEGRAM_POLLER=true (using standalone bot)')
    return
  }

  if (!TELEGRAM_BOT_TOKEN) {
    logger.info('TELEGRAM_BOT_TOKEN not configured; skipping embedded Telegram poller')
    return
  }

  // Prevent multiple poller instances during hot reloading or worker threads
  if (globalThis.__thoen_telegram_poller_active__) {
    logger.info('Telegram background poller is already running in this process')
    return
  }

  globalThis.__thoen_telegram_poller_active__ = true
  logger.info('Starting embedded Telegram background poller (Approach A)...')

  // Run in background without blocking server startup
  void (async () => {
    try {
      // 1. Verify token
      const me = await callTelegram('getMe')
      logger.info({ username: me?.result?.username }, 'Telegram poller connected successfully')

      // 2. Ensure webhook is removed so getUpdates does not 409 Conflict
      try {
        await callTelegram('deleteWebhook', { drop_pending_updates: false })
      } catch (err: any) {
        logger.warn({ err: err?.message }, 'Could not delete webhook (might already be deleted)')
      }

      // 3. Polling loop
      let offset = 0
      while (globalThis.__thoen_telegram_poller_active__) {
        try {
          const res = await callTelegram('getUpdates', {
            offset,
            timeout: 25,
            allowed_updates: ['message', 'callback_query'],
          })

          if (res?.ok && Array.isArray(res.result)) {
            for (const update of res.result) {
              offset = update.update_id + 1
              try {
                const result = await processTelegramUpdate(update)
                logger.info(
                  {
                    action: result.action,
                    handled: result.handled,
                    member: result.memberName,
                  },
                  'Processed incoming Telegram update'
                )
              } catch (updateErr: any) {
                logger.error({ err: updateErr?.message }, 'Error processing Telegram update item')
              }
            }
          }
        } catch (pollErr: any) {
          logger.warn({ err: pollErr?.message }, 'Telegram polling cycle encountered error, retrying in 5s')
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    } catch (initErr: any) {
      logger.error({ err: initErr?.message }, 'Failed to initialize Telegram background poller')
    }
  })()
}
