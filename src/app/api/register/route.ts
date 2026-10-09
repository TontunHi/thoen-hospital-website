import { NextResponse } from 'next/server'
import { registrationService } from '@/lib/registration/registrationService.default'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const result = await registrationService.submit(body ?? {})

    if (result.ok) {
      return NextResponse.json({ success: true, message: 'ได้รับคำขอสมัครแล้ว รอผู้ดูแลระบบตรวจสอบ' }, { status: 201 })
    }
    if (result.reason === 'rate_limited') {
      return NextResponse.json(
        { error: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง', retryAfterSeconds: result.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
      )
    }
    return NextResponse.json({ error: result.message }, { status: 400 })
  } catch (error) {
    logger.error({ error }, 'Member registration submit error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่' }, { status: 500 })
  }
}
