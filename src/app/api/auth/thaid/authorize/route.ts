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

  const state = generateOAuthState(config.clientSecret)
  const authUrl = buildThaidAuthorizeUrl(state, config)

  const proto = request.headers.get('x-forwarded-proto')
  const isHttps =
    proto === 'https' ||
    request.url.startsWith('https://') ||
    process.env.COOKIE_SECURE === 'true'

  const cookieStore = await cookies()
  cookieStore.set('thaid_oauth_state', state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 900, // 15 minutes
  })

  if (acceptsJson) {
    return NextResponse.json({
      success: true,
      redirectUrl: authUrl,
    })
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${encodeURI(authUrl)}">
  <title>กำลังเชื่อมต่อไปยัง ThaID...</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#1e293b;">
  <div style="text-align:center;padding:2rem;">
    <p style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">กำลังเชื่อมต่อไปยังระบบ ThaID...</p>
    <p style="font-size:0.875rem;color:#64748b;">หากหน้าจอไม่เปลี่ยน กรุณา <a href="${encodeURI(authUrl)}" style="color:#0284c7;text-decoration:underline;">คลิกที่นี่</a></p>
  </div>
  <script>window.location.replace(${JSON.stringify(authUrl)});</script>
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
