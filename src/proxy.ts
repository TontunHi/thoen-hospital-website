/**
 * Next.js 16 Proxy (formerly middleware.ts)
 * 
 * Protects routes based on authentication and role.
 * In Next.js 16, the proxy runs on the Node.js runtime (not Edge).
 * 
 * Route protection rules:
 * - /admin/**       → admin only
 * - /salary/**      → authenticated members (salary session)
 * - /api/er/**      → doctor, nurse, admin (handled in API route itself)
 * - /login          → public (redirect to admin if already logged in)
 * - Everything else → public
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

/**
 * Lightweight token verification for the proxy layer.
 * Does NOT use the full auth.ts (which uses next/headers cookies()).
 * Instead, reads the cookie directly from the request.
 */
function verifyTokenInProxy(token: string): { adminId: number; role: string } | null {
  try {
    const secret = process.env.ADMIN_SECRET
    if (!secret) return null

    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(encoded)
    const expectedSignature = hmac.digest('hex')

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return null

    return { adminId: payload.adminId, role: payload.role || 'admin' }
  } catch {
    return null
  }
}

function verifyMemberTokenInProxy(token: string): { username: string; email: string } | null {
  try {
    const secret = process.env.MEMBER_SESSION_SECRET
    if (!secret) return null

    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(encoded)
    const expectedSignature = hmac.digest('hex')

    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return null

    return { username: payload.username, email: payload.email }
  } catch {
    return null
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Public routes (no auth required) ───
  const publicPaths = [
    '/',
    '/about',
    '/contact',
    '/news',
    '/service',
    '/login',
    '/member/login',
    '/systems',
    '/unauthorized',
  ]

  // Check if path is public (exact match or starts with public prefix)
  const isPublicPage = publicPaths.some(p => 
    pathname === p || pathname.startsWith(p + '/')
  )

  // Public API routes (no auth needed)
  const publicApiPaths = [
    '/api/news',
    '/api/contact', // POST is public (form submission)
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/member/login',
    '/api/member/logout',
    '/api/member/otp',
    '/api/member/me',
    '/api/salary/login',
    '/api/salary/logout',
  ]

  const isPublicApi = publicApiPaths.some(p =>
    pathname === p || pathname.startsWith(p + '/')
  )

  // Static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next()
  }

  if (isPublicPage || isPublicApi) {
    return NextResponse.next()
  }

  // ─── Protected: /admin/** → admin only ───
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('admin_session')
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const session = verifyTokenInProxy(sessionCookie.value)
    if (!session) {
      // Invalid or expired token — clear and redirect
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('admin_session')
      return response
    }

    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    return NextResponse.next()
  }

  // ─── Protected: /salary/** → authenticated member (salary session) ───
  if (pathname.startsWith('/salary')) {
    const memberCookie = request.cookies.get('member_session')
    const salaryCookie = request.cookies.get('salary_user_session')

    if (!memberCookie?.value && !salaryCookie?.value) {
      return NextResponse.redirect(new URL('/member/login', request.url))
    }

    return NextResponse.next()
  }

  // ─── Protected: /api/er/** → doctor, nurse, admin OR member ───
  if (pathname.startsWith('/api/er')) {
    const sessionCookie = request.cookies.get('admin_session')
    const memberCookie = request.cookies.get('member_session')

    // Allow members to view ER status
    if (memberCookie?.value) {
      const member = verifyMemberTokenInProxy(memberCookie.value)
      if (member) {
        return NextResponse.next()
      }
    }

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const session = verifyTokenInProxy(sessionCookie.value)
    if (!session) {
      return NextResponse.json(
        { error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      )
    }

    const allowedRoles = ['doctor', 'nurse', 'admin']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    return NextResponse.next()
  }

  // ─── Protected: /api/salary/data → needs salary session ───
  if (pathname.startsWith('/api/salary/data')) {
    const salaryCookie = request.cookies.get('salary_user_session')
    if (!salaryCookie?.value) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบเงินเดือนก่อน' },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // ─── All other routes → allow (public pages) ───
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
