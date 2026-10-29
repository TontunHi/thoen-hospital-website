import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createMemberSession } from '@/lib/memberAuth'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  getProviderIdConfig,
  verifyMophOAuthState,
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
  const isHealthId = state?.startsWith('hid_')
  const serviceLabel = isHealthId ? 'Health ID' : 'Provider ID'
  const errorParamPrefix = isHealthId ? 'health_id' : 'provider_id'

  if (oauthError) {
    logger.warn({ oauthError, errorDescription, serviceLabel }, `${serviceLabel} authorization was denied or failed on provider side`)
    try {
      await logAudit(
        'LOGIN',
        'members',
        `พยายามเข้าสู่ระบบด้วย ${serviceLabel} แต่ถูกปฏิเสธหรือยกเลิก (Error: ${oauthError}${errorDescription ? ` - ${errorDescription}` : ''})`,
        { username: `${serviceLabel.toUpperCase().replace(/\s+/g, '_')}_CANCELLED`, email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL(`/member/login?error=${errorParamPrefix}_denied`, baseUrl))
  }

  if (!code || !state) {
    try {
      await logAudit(
        'LOGIN',
        'members',
        `พยายามเข้าสู่ระบบด้วย ${serviceLabel} แต่คำขอไม่ถูกต้อง (Missing code or state)`,
        { username: `${serviceLabel.toUpperCase().replace(/\s+/g, '_')}_INVALID_REQUEST`, email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL(`/member/login?error=${errorParamPrefix}_invalid_request`, baseUrl))
  }

  // 1. Dual-check verification for CSRF state token (Cookie + HMAC fallback)
  const cookieStore = await cookies()
  const savedState = cookieStore.get('provider_id_oauth_state')?.value || cookieStore.get('health_id_oauth_state')?.value
  const isCookieMatch = Boolean(savedState && savedState === state)

  const config = getProviderIdConfig()
  const verification = verifyMophOAuthState(state, config?.providerIdSecretKey)
  const isHmacValid = verification.isValid
  const authType = verification.type || (isHealthId ? 'health_id' : 'provider_id')

  if (!isCookieMatch && !isHmacValid) {
    logger.warn(
      { savedStatePresent: Boolean(savedState), isHmacValid, serviceLabel },
      `${serviceLabel} OAuth state mismatch or expired (both cookie and HMAC check failed)`
    )
    try {
      await logAudit(
        'LOGIN',
        'members',
        `พยายามเข้าสู่ระบบด้วย ${serviceLabel} แต่ State Token หมดอายุหรือไม่ตรงกัน (CSRF Token Mismatch / Expired)`,
        { username: `${serviceLabel.toUpperCase().replace(/\s+/g, '_')}_STATE_MISMATCH`, email: '' }
      )
    } catch {}
    return NextResponse.redirect(new URL(`/member/login?error=${errorParamPrefix}_invalid_state`, baseUrl))
  }

  if (savedState) {
    cookieStore.delete('provider_id_oauth_state')
    cookieStore.delete('health_id_oauth_state')
  }

  // 2. Exchange code via unified MemberAuthService
  let sessionPayload
  try {
    if (authType === 'health_id') {
      sessionPayload = await authService.exchangeHealthIdCode(code, state)
    } else {
      sessionPayload = await authService.exchangeProviderIdCode(code, state)
    }
  } catch (error: any) {
    logger.error({ error, serviceLabel }, `${serviceLabel} exchange failed`)
    if (error instanceof NotAProviderError || error?.message?.includes('provider id')) {
      return NextResponse.redirect(new URL('/member/login?error=provider_id_not_provider', baseUrl))
    }
    if (
      error?.message === 'Provider ID citizen ID not registered in hospital members' ||
      error?.message === 'Health ID citizen ID not registered in hospital members'
    ) {
      return NextResponse.redirect(new URL('/member/login?error=not_registered', baseUrl))
    }
    return NextResponse.redirect(new URL(`/member/login?error=${errorParamPrefix}_exchange_failed`, baseUrl))
  }

  // 3. Issue member session cookie
  await createMemberSession(sessionPayload.username, sessionPayload.email, sessionPayload.role)

  return NextResponse.redirect(new URL('/member', baseUrl))
}
