import { NextResponse } from 'next/server'
import { createMemberSession } from '@/lib/memberAuth'
import { memberLoginSchema } from '@/lib/schemas/member'
import { checkRateLimit } from '@/lib/rateLimit'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'

const authService = new MemberAuthService()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email, otp } = body

    const parsed = memberLoginSchema.safeParse({ username, email, otp })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()
    const trimmedOtp = otp.trim()

    const rateCheck = await checkRateLimit({
      key: 'member-login',
      identifier: trimmedUsername,
      maxAttempts: 5,
      windowSeconds: 300,
    })
    if (!rateCheck.allowed) return rateCheck.response!

    let sessionPayload
    try {
      sessionPayload = await authService.verifyOtp(trimmedUsername, trimmedOtp, trimmedEmail)
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message },
        { status: 400 }
      )
    }

    await createMemberSession(sessionPayload.username, sessionPayload.email, sessionPayload.role)

    return NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      member: {
        username: sessionPayload.username,
        email: sessionPayload.email,
        role: sessionPayload.role,
      },
    })
  } catch (error: any) {
    console.error('Member login error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์เข้าสู่ระบบ' },
      { status: 500 }
    )
  }
}
