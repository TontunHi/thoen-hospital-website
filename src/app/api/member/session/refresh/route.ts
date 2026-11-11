import { NextResponse } from 'next/server'
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  ABSOLUTE_MAX_AGE,
  verifyMemberSession,
} from '@/lib/memberAuth'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'

const authService = new MemberAuthService()

export async function POST() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'เซสชันหมดอายุหรือไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      )
    }

    const now = Date.now()
    const iat = typeof session.iat === 'number' ? session.iat : now

    // Check if user has exceeded absolute hard limit (12 hours)
    if (now - iat >= ABSOLUTE_MAX_AGE * 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'เซสชันหมดอายุเนื่องจากใช้งานต่อเนื่องครบ 12 ชั่วโมง กรุณาเข้าสู่ระบบใหม่เพื่อความปลอดภัย',
          code: 'ABSOLUTE_LIMIT_EXCEEDED',
        },
        { status: 401 }
      )
    }

    // Build renewed token with preserved iat and extended exp (30 minutes from now)
    const renewedToken = await authService.buildSession({
      username: session.username,
      email: session.email,
      role: session.role,
      iat,
    })

    const exp = now + SESSION_MAX_AGE * 1000

    const response = NextResponse.json({
      success: true,
      message: 'ต่ออายุเซสชันเรียบร้อยแล้ว',
      exp,
      remainingSeconds: SESSION_MAX_AGE,
    })

    response.cookies.set(COOKIE_NAME, renewedToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })

    return response
  } catch (error: any) {
    console.error('Session refresh error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการต่ออายุเซสชัน' },
      { status: 500 }
    )
  }
}
