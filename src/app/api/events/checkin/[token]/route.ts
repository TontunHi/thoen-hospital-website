import { NextResponse } from 'next/server'
import {
  getThaidConfig,
  generateEventOAuthState,
  buildThaidAuthorizeUrl,
} from '@/lib/thaidAuth'
import {
  validateCheckinWindow,
  toBangkokIsoString,
} from '@/lib/events/eventTimeUtils'
import { HospitalEventService } from '@/lib/events/hospitalEventService'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (!token) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'error')
    errUrl.searchParams.set('message', 'ไม่พบรหัสกิจกรรม')
    return NextResponse.redirect(errUrl)
  }

  const eventService = new HospitalEventService()
  const event = await eventService.getEventCheckinTargetByQrToken(token)

  if (!event) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'error')
    errUrl.searchParams.set('message', 'ไม่พบข้อมูลกิจกรรมจาก QR Code นี้ หรือรหัสไม่ถูกต้อง')
    return NextResponse.redirect(errUrl)
  }

  const windowCheck = validateCheckinWindow(
    event.checkinOpenTime,
    event.checkinCloseTime,
    new Date()
  )
  if (windowCheck.isEarly) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'time_error')
    errUrl.searchParams.set('type', 'early')
    errUrl.searchParams.set('event', event.title)
    errUrl.searchParams.set(
      'openTime',
      toBangkokIsoString(event.checkinOpenTime) || String(event.checkinOpenTime)
    )
    return NextResponse.redirect(errUrl)
  }

  if (windowCheck.isLate) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'time_error')
    errUrl.searchParams.set('type', 'late')
    errUrl.searchParams.set('event', event.title)
    errUrl.searchParams.set(
      'closeTime',
      toBangkokIsoString(event.checkinCloseTime) || String(event.checkinCloseTime)
    )
    return NextResponse.redirect(errUrl)
  }

  const config = getThaidConfig()
  if (!config) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'error')
    errUrl.searchParams.set(
      'message',
      'ระบบยังไม่ได้ตั้งค่าเชื่อมต่อกับ ThaID ของกรมการปกครอง (DOPA)'
    )
    return NextResponse.redirect(errUrl)
  }

  const state = generateEventOAuthState(token, config.clientSecret)
  const authorizeUrl = buildThaidAuthorizeUrl(state, config)

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${encodeURI(authorizeUrl)}">
  <title>กำลังเชื่อมต่อไปยัง ThaID...</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#1e293b;">
  <div style="text-align:center;padding:2rem;">
    <p style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">กำลังเชื่อมต่อไปยังระบบ ThaID สำหรับเช็คอินกิจกรรม...</p>
    <p style="font-size:0.875rem;color:#64748b;">หากหน้าจอไม่เปลี่ยน กรุณา <a href="${encodeURI(authorizeUrl)}" style="color:#0284c7;text-decoration:underline;">คลิกที่นี่</a></p>
  </div>
  <script>window.location.replace(${JSON.stringify(authorizeUrl)});</script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
