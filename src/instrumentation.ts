/**
 * Next.js Instrumentation Hook
 * 
 * Runs once at server startup.
 * Automatically initiates background tasks (e.g. embedded Telegram long-polling)
 * when running inside the Node.js server runtime.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startTelegramPolling } = await import('@/lib/telegram/telegramPoller')
    startTelegramPolling()
  }
}
