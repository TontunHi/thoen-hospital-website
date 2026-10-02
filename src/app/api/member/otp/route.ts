import { NextResponse } from 'next/server'
import { memberOtpRequestSchema } from '@/lib/schemas/member'
import { checkRateLimit } from '@/lib/rateLimit'
import { MemberAuthService } from '@/lib/auth/MemberAuthService'

const authService = new MemberAuthService()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email } = body

    const parsed = memberOtpRequestSchema.safeParse({ username, email })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()

    const rateCheck = await checkRateLimit({
      key: 'member-otp',
      identifier: trimmedUsername,
      maxAttempts: 5,
      windowSeconds: 300,
    })
    if (!rateCheck.allowed) return rateCheck.response!

    const result = await authService.requestOtp(trimmedUsername, trimmedEmail)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (error: any) {
    console.error('Member OTP Request error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการประมวลผลระบบสมาชิก' },
      { status: 500 }
    )
  }
}
