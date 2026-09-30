import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getThaidConfig, generateOAuthState, buildThaidAuthorizeUrl } from '@/lib/thaidAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const acceptsJson = request.headers.get('accept')?.includes('application/json') || format === 'json'

  const config = getThaidConfig()
  if (!config) {
    if (acceptsJson) {
      return NextResponse.json(
        { success: false, error: 'ระบบ ThaID ยังไม่ได้กำหนดค่าการเชื่อมต่อ' },
        { status: 500 }
      )
    }
    return NextResponse.redirect(new URL('/member/login?error=thaid_not_configured', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
  }

  const state = generateOAuthState()
  const authUrl = buildThaidAuthorizeUrl(state, config)

  const cookieStore = await cookies()
  cookieStore.set('thaid_oauth_state', state, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 minutes
  })

  if (acceptsJson) {
    return NextResponse.json({
      success: true,
      redirectUrl: authUrl,
    })
  }

  return NextResponse.redirect(new URL(authUrl), 302)
}
