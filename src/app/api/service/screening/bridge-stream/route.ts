import { NextRequest } from 'next/server'
import { smartCardBridgeHub } from '@/lib/screening/smartCardBridgeHub'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get('station') || '1'
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send immediate connection acknowledge
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Keepalive comment ping every 15 seconds to prevent proxy / Nginx timeouts
      const keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(keepAliveTimer)
        }
      }, 15000)

      unsubscribe = smartCardBridgeHub.subscribe(station, (event, data) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Stream closed or aborted
        }
      })

      req.signal.addEventListener('abort', () => {
        clearInterval(keepAliveTimer)
        if (unsubscribe) unsubscribe()
        try {
          controller.close()
        } catch {
          // Controller already closed
        }
      })
    },
    cancel() {
      if (unsubscribe) unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
