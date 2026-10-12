import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createMemberSession } from '@/lib/memberAuth'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { getThaidConfig, verifyOAuthState, verifyEventOAuthState, exchangeThaidAuthorizationCode } from '@/lib/thaidAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'

export const dynamic = 'force-dynamic'

const authService = new MemberAuthService()
const eventService = new HospitalEventService()

// Deduplication cache for concurrent / duplicate callbacks (e.g. Safari top-level + ThaID app return)
const inFlightExchanges = new Map<string, Promise<{ username: string; email: string; role: string }>>()
const completedExchanges = new Map<string, { payload: { username: string; email: string; role: string }; timestamp: number }>()

function cleanExpiredCompletedExchanges() {
  const now = Date.now()
  for (const [codeKey, record] of completedExchanges.entries()) {
    if (now - record.timestamp > 60_000) {
      completedExchanges.delete(codeKey)
    }
  }
}

function getBaseUrl(request: Request): string {
  // 1. Explicitly configured public domain (e.g. https://thlp.moph.go.th)
  if (
    process.env.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL !== 'undefined' &&
    process.env.NEXT_PUBLIC_SITE_URL.trim() !== ''
  ) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  }

  // 2. Reverse proxy forwarded headers
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    return `${forwardedProto}://${forwardedHost}`
  }

  // 3. Request URL origin fallback (dev / test environments)
  try {
    const origin = new URL(request.url).origin
    if (origin && origin !== 'null') {
      return origin
    }
  } catch {
    // fallback below
  }

  return 'http://localhost:3000'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const thaidError = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = getBaseUrl(request)

  // Special branch: Event QR Check-in via ThaID
  if (state && state.startsWith('evt_')) {
    if (thaidError) {
      return NextResponse.redirect(new URL('/member/events/checkin-status?status=error&message=thaid_denied', baseUrl))
    }
    if (!code) {
      return NextResponse.redirect(new URL('/member/events/checkin-status?status=error&message=missing_code', baseUrl))
    }

    const config = getThaidConfig()
    const { isValid, qrToken } = verifyEventOAuthState(state, config?.clientSecret)

    if (!isValid || !qrToken) {
      return NextResponse.redirect(new URL('/member/events/checkin-status?status=error&message=invalid_or_expired_state', baseUrl))
    }

    if (!config) {
      return NextResponse.redirect(new URL('/member/events/checkin-status?status=error&message=thaid_not_configured', baseUrl))
    }

    try {
      const userInfo = await exchangeThaidAuthorizationCode(code, config)
      if (!userInfo || !userInfo.pid) {
        return NextResponse.redirect(new URL('/member/events/checkin-status?status=error&message=exchange_failed', baseUrl))
      }

      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'

      const result = await eventService.checkinViaThaid(qrToken, userInfo.pid, {
        ipAddress: clientIp,
        userAgent,
      })

      const target = new URL('/member/events/checkin-status', baseUrl)
      target.searchParams.set('status', 'success')
      target.searchParams.set('name', result.member.name || '')
      target.searchParams.set('dept', result.member.department || 'ไม่ระบุแผนก')
      target.searchParams.set('event', result.event.title || '')
      target.searchParams.set('points', String(result.pointsAwarded))
      target.searchParams.set('time', new Date(result.checkedInAt).toISOString())

      return NextResponse.redirect(target)
    } catch (err: any) {
      const target = new URL('/member/events/checkin-status', baseUrl)
      target.searchParams.set('status', 'error')
      target.searchParams.set('message', err.message || 'เช็คอินไม่สำเร็จ')
      return NextResponse.redirect(target)
    }
  }

  if (thaidError) {
    logger.warn({ thaidError, errorDescription }, 'ThaID authorization was denied or failed on provider side')
    try {
      await logAudit(
        'LOGIN',
        'members',
        `พยายามเข้าสู่ระบบด้วย ThaID แต่ถูกปฏิเสธหรือยกเลิกจาก ThaID App (Error: ${thaidError}${errorDescription ? ` - ${errorDescription}` : ''})`,
        { username: 'THAID_CANCELLED', email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL('/member/login?error=thaid_denied', baseUrl))
  }

  if (!code || !state) {
    try {
      await logAudit(
        'LOGIN',
        'members',
        'พยายามเข้าสู่ระบบด้วย ThaID แต่คำขอไม่ถูกต้อง (Missing code or state)',
        { username: 'THAID_INVALID_REQUEST', email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL('/member/login?error=thaid_invalid_request', baseUrl))
  }

  // 1. Dual-check verification for CSRF state token:
  // First check cookie, fallback to HMAC cryptographic signature check if cookie was dropped (e.g. by Safari ITP or cross-site redirect)
  const cookieStore = await cookies()
  const savedState = cookieStore.get('thaid_oauth_state')?.value
  const isCookieMatch = Boolean(savedState && savedState === state)

  const config = getThaidConfig()
  const isHmacValid = verifyOAuthState(state, config?.clientSecret)

  if (!isCookieMatch && !isHmacValid) {
    logger.warn(
      { savedStatePresent: Boolean(savedState), isHmacValid },
      'ThaID OAuth state mismatch or expired (both cookie and HMAC check failed)'
    )
    try {
      await logAudit(
        'LOGIN',
        'members',
        'พยายามเข้าสู่ระบบด้วย ThaID แต่ State Token หมดอายุหรือไม่ตรงกัน (CSRF Token Mismatch / Expired)',
        { username: 'THAID_STATE_MISMATCH', email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL('/member/login?error=thaid_invalid_state', baseUrl))
  }

  // State verified! Clear state cookie if it was present
  if (savedState) {
    cookieStore.delete('thaid_oauth_state')
  }

  // 2. Exchange code for user identity (PID) and get session payload,
  // with in-flight deduplication to prevent double-scan / concurrent request race condition
  cleanExpiredCompletedExchanges()

  let sessionPayload
  try {
    const cached = completedExchanges.get(code)
    if (cached && Date.now() - cached.timestamp < 60_000) {
      sessionPayload = cached.payload
    } else if (inFlightExchanges.has(code)) {
      sessionPayload = await inFlightExchanges.get(code)!
    } else {
      const exchangePromise = authService.exchangeThaidCode(code, state)
      inFlightExchanges.set(code, exchangePromise)

      try {
        sessionPayload = await exchangePromise
        completedExchanges.set(code, { payload: sessionPayload, timestamp: Date.now() })
      } finally {
        inFlightExchanges.delete(code)
      }
    }
  } catch (error: any) {
    logger.error({ error }, 'ThaID exchange failed')
    if (error.message === 'ThaID citizen ID not registered in hospital members') {
      return NextResponse.redirect(new URL('/member/login?error=not_registered', baseUrl))
    }
    return NextResponse.redirect(new URL('/member/login?error=thaid_exchange_failed', baseUrl))
  }

  // 3. Create secure session cookie (bypassing OTP)
  await createMemberSession(sessionPayload.username, sessionPayload.email, sessionPayload.role)

  return NextResponse.redirect(new URL('/member', baseUrl))
}
