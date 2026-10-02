import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createMemberSession } from '@/lib/memberAuth'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const authService = new MemberAuthService()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const thaidError = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (thaidError) {
    logger.warn({ thaidError }, 'ThaID authorization was denied or failed on provider side')
    return NextResponse.redirect(new URL('/member/login?error=thaid_denied', baseUrl))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/member/login?error=thaid_invalid_request', baseUrl))
  }

  // 1. Verify CSRF state token
  const cookieStore = await cookies()
  const savedState = cookieStore.get('thaid_oauth_state')?.value
  cookieStore.delete('thaid_oauth_state')

  if (!savedState || savedState !== state) {
    logger.warn({ savedStatePresent: Boolean(savedState) }, 'ThaID OAuth state mismatch or expired')
    return NextResponse.redirect(new URL('/member/login?error=thaid_invalid_state', baseUrl))
  }

  // 3. Exchange code for user identity (PID) and get session payload
  let sessionPayload
  try {
    sessionPayload = await authService.exchangeThaidCode(code, state)
  } catch (error: any) {
    logger.error({ error }, 'ThaID exchange failed')
    if (error.message === 'ThaID citizen ID not registered in hospital members') {
      return NextResponse.redirect(new URL('/member/login?error=not_registered', baseUrl))
    }
    return NextResponse.redirect(new URL('/member/login?error=thaid_exchange_failed', baseUrl))
  }

  // 4. Create secure session cookie (bypassing OTP)
  await createMemberSession(sessionPayload.username, sessionPayload.email, sessionPayload.role)

  return NextResponse.redirect(new URL('/member', baseUrl))
}
