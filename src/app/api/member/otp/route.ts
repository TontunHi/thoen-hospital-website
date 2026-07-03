import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import nodemailer from 'nodemailer'
import { memberOtpRequestSchema } from '@/lib/schemas/member'
import { checkRateLimit } from '@/lib/rateLimit'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MEMBER_OTP_EMAIL_USER!,
    pass: process.env.MEMBER_OTP_EMAIL_PASS!,
  },
})

export async function POST(request: Request) {
  try {
    const rateCheck = await checkRateLimit({ key: 'member-otp', maxAttempts: 3, windowSeconds: 900 })
    if (!rateCheck.allowed) return rateCheck.response!

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
    const otp = crypto.randomInt(100000, 999999).toString()

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
      const smtpUser = process.env.MEMBER_OTP_EMAIL_USER || ''
      const fromName = `"ระบบสมาชิก โรงพยาบาลเถิน" <${smtpUser}>`
      await transporter.sendMail({
        from: fromName,
        to: trimmedEmail,
        subject: `รหัสยืนยันตัวตนสำหรับเข้าสู่ระบบสมาชิก โรงพยาบาลเถิน`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">โรงพยาบาลเถิน</h2>
              <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0; font-weight: 500;">ระบบตรวจสอบสิทธิ์เข้าใช้งานสมาชิก</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
            
            <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 10px 0;">
              สวัสดีครับ นี่เป็นข้อความแจ้งเตือนอัตโนมัติจากระบบความปลอดภัย
            </p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 15px 0;">
              ระบบได้รับคำขอตรวจสอบการยืนยันตัวตนเพื่อลงชื่อเข้าสู่ระบบในชื่อบัญชี <strong>${trimmedUsername}</strong> ของทางโรงพยาบาลเถิน รหัสยืนยันของคุณคือ:
            </p>
            
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #d97706; margin: 25px 0; text-align: center; background: #fffbeb; padding: 18px; border-radius: 10px; border: 1.5px dashed #f59e0b;">
              ${otp}
            </div>
            
            <p style="color: #dc2626; font-size: 13px; text-align: center; margin: 20px 0; font-weight: 500;">
              * รหัสความปลอดภัยนี้มีอายุการใช้งานจำกัดเพียง 5 นาทีเท่านั้นเพื่อความปลอดภัย
            </p>
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            
            <div style="text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.6;">
              <p style="margin: 0 0 5px 0; font-weight: 600;">โรงพยาบาลเถิน จังหวัดลำปาง</p>
              <p style="margin: 0 0 5px 0;">364 หมู่ 2 ถนนพหลโยธิน ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง 52160</p>
              <p style="margin: 0 0 10px 0;">โทรศัพท์: 054-291316-8</p>
              <p style="margin: 0; color: #cbd5e1;">อีเมลฉบับนี้เป็นการส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้</p>
            </div>
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
