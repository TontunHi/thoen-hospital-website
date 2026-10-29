import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createMemberSession } from '@/lib/memberAuth'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  getProviderIdConfig,
  verifyProviderIdOAuthState,
  NotAProviderError,
} from '@/lib/providerIdAuth'

export const dynamic = 'force-dynamic'

const authService = new MemberAuthService()

function getBaseUrl(request: Request): string {
  if (
    process.env.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL !== 'undefined' &&
    process.env.NEXT_PUBLIC_SITE_URL.trim() !== ''
  ) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  }

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    return `${forwardedProto}://${forwardedHost}`
  }

  try {
    const origin = new URL(request.url).origin
    if (origin && origin !== 'null') {
      return origin
    }
  } catch {
    // fallback
  }

  return 'http://localhost:3000'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = getBaseUrl(request)

  if (oauthError) {
    logger.warn({ oauthError, errorDescription }, 'Provider ID authorization was denied or failed on provider side')
    try {
      await logAudit(
        'LOGIN',
        'members',
        `พยายามเข้าสู่ระบบด้วย Provider ID แต่ถูกปฏิเสธหรือยกเลิก (Error: ${oauthError}${errorDescription ? ` - ${errorDescription}` : ''})`,
        { username: 'PROVIDER_ID_CANCELLED', email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL('/member/login?error=provider_id_denied', baseUrl))
  }

  if (!code || !state) {
    try {
      await logAudit(
        'LOGIN',
        'members',
        'พยายามเข้าสู่ระบบด้วย Provider ID แต่คำขอไม่ถูกต้อง (Missing code or state)',
        { username: 'PROVIDER_ID_INVALID_REQUEST', email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL('/member/login?error=provider_id_invalid_request', baseUrl))
  }

  // 1. Dual-check verification for CSRF state token (Cookie + HMAC fallback)
  const cookieStore = await cookies()
  const savedState = cookieStore.get('provider_id_oauth_state')?.value
  const isCookieMatch = Boolean(savedState && savedState === state)

  const config = getProviderIdConfig()
  const isHmacValid = verifyProviderIdOAuthState(state, config?.providerIdSecretKey)

  if (!isCookieMatch && !isHmacValid) {
    logger.warn(
      { savedStatePresent: Boolean(savedState), isHmacValid },
      'Provider ID OAuth state mismatch or expired (both cookie and HMAC check failed)'
    )
    try {
      await logAudit(
        'LOGIN',
        'members',
        'พยายามเข้าสู่ระบบด้วย Provider ID แต่ State Token หมดอายุหรือไม่ตรงกัน (CSRF Token Mismatch / Expired)',
        { username: 'PROVIDER_ID_STATE_MISMATCH', email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL('/member/login?error=provider_id_invalid_state', baseUrl))
  }

  if (savedState) {
    cookieStore.delete('provider_id_oauth_state')
  }

  // 2. Exchange code via unified MemberAuthService
  let sessionPayload
  try {
    sessionPayload = await authService.exchangeProviderIdCode(code, state)
  } catch (error: any) {
    logger.error({ error }, 'Provider ID exchange failed')
    if (error instanceof NotAProviderError || error?.message?.includes('provider id')) {
      return NextResponse.redirect(new URL('/member/login?error=provider_id_not_provider', baseUrl))
    }
    if (error?.message === 'Provider ID citizen ID not registered in hospital members') {
      return NextResponse.redirect(new URL('/member/login?error=not_registered', baseUrl))
    }
    return NextResponse.redirect(new URL('/member/login?error=provider_id_exchange_failed', baseUrl))
  }

  // 3. Issue member session cookie
  await createMemberSession(sessionPayload.username, sessionPayload.email, sessionPayload.role)

  return NextResponse.redirect(new URL('/member', baseUrl))
}
