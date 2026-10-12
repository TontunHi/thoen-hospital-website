import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getThaidConfig, generateEventOAuthState, buildThaidAuthorizeUrl } from '@/lib/thaidAuth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
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

  const event = await prisma.hospitalEvent.findUnique({
    where: { qrToken: token },
  })

  if (!event) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'error')
    errUrl.searchParams.set('message', 'ไม่พบข้อมูลกิจกรรมจาก QR Code นี้ หรือรหัสไม่ถูกต้อง')
    return NextResponse.redirect(errUrl)
  }

  const now = new Date()

  // 1. Validate Time-gated window
  if (now < event.checkinOpenTime) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'time_error')
    errUrl.searchParams.set('type', 'early')
    errUrl.searchParams.set('event', event.title)
    errUrl.searchParams.set('openTime', event.checkinOpenTime.toISOString())
    return NextResponse.redirect(errUrl)
  }

  if (now > event.checkinCloseTime) {
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'time_error')
    errUrl.searchParams.set('type', 'late')
    errUrl.searchParams.set('event', event.title)
    errUrl.searchParams.set('closeTime', event.checkinCloseTime.toISOString())
    return NextResponse.redirect(errUrl)
  }

  // 2. Redirect to ThaID OAuth
  const config = getThaidConfig()

  if (!config) {
    // If ThaID credentials are not configured in environment, redirect to demo check-in fallback
    const errUrl = new URL('/member/events/checkin-status', baseUrl)
    errUrl.searchParams.set('status', 'error')
    errUrl.searchParams.set('message', 'ระบบยังไม่ได้ตั้งค่าเชื่อมต่อกับ ThaID ของกรมการปกครอง (DOPA)')
    return NextResponse.redirect(errUrl)
  }

  const state = generateEventOAuthState(token, config.clientSecret)
  const authorizeUrl = buildThaidAuthorizeUrl(state, config)

  return NextResponse.redirect(authorizeUrl)
}
