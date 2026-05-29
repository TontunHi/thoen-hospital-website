import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MEMBER_OTP_EMAIL_USER || 'pisutyimkuson@gmail.com',
    pass: process.env.MEMBER_OTP_EMAIL_PASS || 'wioj qozz rwhy kwip',
  },
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email } = body

    if (!username || !email) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้งานและอีเมล' },
        { status: 400 }
      )
    }

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()

    // 1. Check if user already exists
    const users = await queryMemberDb(
      'SELECT * FROM members WHERE username = ?',
      [trimmedUsername]
    )

    if (users && users.length > 0) {
      const user = users[0]
      // Username exists, check if email matches
      if (user.email.toLowerCase() !== trimmedEmail.toLowerCase()) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้งานนี้ลงทะเบียนด้วยอีเมลอื่นอยู่แล้ว' },
          { status: 400 }
        )
      }
    }

    // 2. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    if (users && users.length > 0) {
      // Update existing user with new OTP using DB-native server time
      await queryMemberDb(
        'UPDATE members SET otp_code = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE username = ?',
        [otp, trimmedUsername]
      )
    } else {
      // Create new user using DB-native server time
      await queryMemberDb(
        'INSERT INTO members (username, email, otp_code, otp_expiry) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
        [trimmedUsername, trimmedEmail, otp]
      )
    }

    // Console log for debugging/testing
    console.log(`[MEMBER OTP DEBUG] User: ${trimmedUsername}, OTP: ${otp}, Sent to: ${trimmedEmail}`)

    // 3. Send OTP to email
    try {
      const fromName = process.env.MEMBER_OTP_EMAIL_FROM || '"ระบบสมาชิก โรงพยาบาลเถิน" <pisutyimkuson@gmail.com>'
      await transporter.sendMail({
        from: fromName,
        to: trimmedEmail,
        subject: `รหัส OTP สำหรับเข้าสู่ระบบสมาชิก: ${otp}`,
        html: `
          <div style="font-family: sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #059669; margin: 0;">โรงพยาบาลเถิน</h2>
              <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">ระบบยืนยันตัวตนเข้าสู่ระบบสมาชิก</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p>เรียนคุณ <strong>${trimmedUsername}</strong>,</p>
            <p>คุณได้ขอรหัส OTP สำหรับเข้าสู่ระบบสมาชิก รหัสอ้างอิงและใช้งานของคุณคือ:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #d97706; margin: 25px 0; text-align: center; background: #fffbeb; padding: 15px; border-radius: 8px; border: 1px dashed #f59e0b;">
              ${otp}
            </div>
            <p style="color: #ef4444; font-size: 13px; text-align: center; margin-top: 20px;">
              * รหัส OTP นี้มีอายุการใช้งาน 5 นาทีเท่านั้นเพื่อความปลอดภัย
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0 0 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 10px;">
              ข้อความฉบับนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้
            </p>
          </div>
        `,
      })
    } catch (mailError: any) {
      console.error('Failed to send member OTP email:', mailError)
      return NextResponse.json(
        { error: 'ไม่สามารถส่งอีเมลยืนยัน OTP ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'ส่งรหัส OTP เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Member OTP Request error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการประมวลผลระบบสมาชิก' },
      { status: 500 }
    )
  }
}
