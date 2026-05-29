import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import { createMemberSession } from '@/lib/memberAuth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email, otp } = body

    if (!username || !email || !otp) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงรหัส OTP' },
        { status: 400 }
      )
    }

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()
    const trimmedOtp = otp.trim()

    // 1. Fetch member details from database and check expiration using DB-native time
    const users = await queryMemberDb(
      'SELECT *, (otp_expiry > NOW()) AS is_valid FROM members WHERE username = ? AND email = ?',
      [trimmedUsername, trimmedEmail]
    )

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'ข้อมูลผู้ใช้งานหรืออีเมลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const user = users[0]

    // 2. Validate OTP code and check expiration
    if (!user.otp_code || user.otp_code !== trimmedOtp) {
      return NextResponse.json(
        { error: 'รหัส OTP ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    if (!user.is_valid) {
      return NextResponse.json(
        { error: 'รหัส OTP หมดอายุการใช้งานแล้ว กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    // 3. OTP is valid, clear OTP from database to prevent reuse
    await queryMemberDb(
      'UPDATE members SET otp_code = NULL, otp_expiry = NULL WHERE id = ?',
      [user.id]
    )

    // 4. Create member session cookie
    await createMemberSession(trimmedUsername, trimmedEmail)

    return NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      member: {
        username: trimmedUsername,
        email: trimmedEmail,
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
