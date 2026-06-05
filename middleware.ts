import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = request.nextUrl

  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin = pathname.startsWith('/admin')
  const isSalary = pathname.startsWith('/salary')
  const isEr = pathname.startsWith('/er')

  if (isDashboard || isAdmin || isSalary || isEr) {
    if (!token) {
      const url = new URL('/news-login', request.url)
      return NextResponse.redirect(url)
    }

    const role = token.role as string

    if (isAdmin && role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    if (isSalary && role !== 'admin' && role !== 'hr') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    if (isEr && role !== 'doctor' && role !== 'nurse' && role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/salary/:path*',
    '/er/:path*',
  ],
}
