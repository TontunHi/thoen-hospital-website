import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Fallback route handler for /api/v2/oauth2/auth
 * If an intermediate reverse-proxy (e.g. Nginx proxy_redirect) rewrites the external
 * DOPA ThaID URL (https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/...) to the hospital's
 * own domain, this route safely catches it and forwards the user to ThaID rather than returning 404.
 */
export async function GET(request: Request) {
  const { search } = new URL(request.url)
  const targetUrl = `https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/${search}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${encodeURI(targetUrl)}">
  <title>กำลังเชื่อมต่อไปยัง ThaID...</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#1e293b;">
  <div style="text-align:center;padding:2rem;">
    <p style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">กำลังเชื่อมต่อไปยังระบบ ThaID...</p>
    <p style="font-size:0.875rem;color:#64748b;">หากหน้าจอไม่เปลี่ยน กรุณา <a href="${encodeURI(targetUrl)}" style="color:#0284c7;text-decoration:underline;">คลิกที่นี่</a></p>
  </div>
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
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
