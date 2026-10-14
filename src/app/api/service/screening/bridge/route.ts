import { NextRequest, NextResponse } from 'next/server'

/**
 * Smart Card Bridge Local Proxy Endpoint
 * Bypasses Chrome Private Network Access (PNA) and Mixed-Content policies
 * by proxying requests to the local hardware bridge daemon at http://127.0.0.1:8084
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const endpoint = searchParams.get('endpoint') === 'read' ? 'read' : 'status'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(`http://127.0.0.1:8084/${endpoint}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'BRIDGE_ERROR', message: `Bridge HTTP ${res.status}` } },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BRIDGE_OFFLINE',
          message: err.message || 'Cannot connect to Smart Card Bridge daemon on port 8084',
        },
      },
      { status: 503 }
    )
  }
}
