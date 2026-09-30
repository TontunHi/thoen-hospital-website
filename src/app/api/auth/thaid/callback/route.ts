import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getThaidConfig, exchangeThaidAuthorizationCode } from '@/lib/thaidAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { createMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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

  // 2. Validate configuration
  const config = getThaidConfig()
  if (!config) {
    return NextResponse.redirect(new URL('/member/login?error=thaid_not_configured', baseUrl))
  }

  // 3. Exchange code for user identity (PID)
  const userInfo = await exchangeThaidAuthorizationCode(code, config)
  if (!userInfo || !userInfo.pid) {
    logger.error('Failed to obtain citizen ID (pid) from ThaID authorization code')
    return NextResponse.redirect(new URL('/member/login?error=thaid_exchange_failed', baseUrl))
  }

  // 4. Lookup member by Thai Citizen ID in members table (mapped to username)
  try {
    const users = await queryMemberDb(
      'SELECT id, username, email, role, name FROM members WHERE username = ? LIMIT 1',
      [userInfo.pid]
    )

    if (!users || users.length === 0) {
      logger.warn({ pidMasked: `***${userInfo.pid.slice(-4)}` }, 'ThaID citizen ID not registered in hospital members')
      return NextResponse.redirect(new URL('/member/login?error=not_registered', baseUrl))
    }

    const user = users[0]

    // 5. Create secure session cookie (bypassing OTP)
    await createMemberSession(user.username, user.email, user.role || 'member')

    // 6. Record audit log entry
    try {
      await logAudit(
        'LOGIN',
        'members',
        `User ${user.username} logged in via ThaID Digital ID successfully`,
        { username: user.username, email: user.email }
      )
    } catch (auditErr) {
      logger.error({ auditErr }, 'Failed to record ThaID login audit log')
    }

    return NextResponse.redirect(new URL('/member', baseUrl))
  } catch (error) {
    logger.error({ error }, 'Database error during ThaID member lookup')
    return NextResponse.redirect(new URL('/member/login?error=thaid_server_error', baseUrl))
  }
}
