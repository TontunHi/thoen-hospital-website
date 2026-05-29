import crypto from 'crypto'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { createRefreshToken } from '@/lib/refreshToken'
import nodemailer from 'nodemailer'
import { adminLoginSchema, adminOtpVerifySchema } from '@/lib/schemas/auth'
import { checkRateLimit } from '@/lib/rateLimit'

// Global or module-scoped temp storage for pending 2FA attempts
// In production, redis or a database table is preferred, but memory works for this setup.
const pendingAttempts = new Map<string, {
  userId: number;
  userRole: string;
  otp: string;
  expiresAt: number;
}>()

// Configure Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.OTP_EMAIL_USER,
    pass: process.env.OTP_EMAIL_PASS,
  },
})

export async function POST(request: Request) {
  try {
    const rateCheck = await checkRateLimit({ key: 'auth-login', maxAttempts: 5, windowSeconds: 900 })
    if (!rateCheck.allowed) return rateCheck.response!

    const body = await request.json()
    const { username, password, otp, tempToken: requestTempToken } = body

    // === STEP 2: OTP Verification ===
    if (otp && requestTempToken) {
      const parsed = adminOtpVerifySchema.safeParse({ otp, tempToken: requestTempToken })
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      }

      const attempt = pendingAttempts.get(requestTempToken)

      if (!attempt || attempt.expiresAt < Date.now()) {
        if (attempt) pendingAttempts.delete(requestTempToken)
        return NextResponse.json(
          { error: 'รหัส OTP หมดอายุหรือเซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' },
          { status: 400 }
        )
      }

      if (attempt.otp !== otp.trim()) {
        return NextResponse.json(
          { error: 'รหัส OTP ไม่ถูกต้อง' },
          { status: 400 }
        )
      }

      // Clear pending attempt
      pendingAttempts.delete(requestTempToken)

      // Create session and log in
      await createSession(attempt.userId, attempt.userRole || 'admin')
      await createRefreshToken(attempt.userId, attempt.userRole || 'admin')

      return NextResponse.json({
        success: true,
        loggedIn: true,
      })
    }

    // === STEP 1: Credentials Check & OTP Generation ===
    const parsed = adminLoginSchema.safeParse({ username, password })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    // Generate 6-digit OTP
    const generatedOtp = crypto.randomInt(100000, 999999).toString()

    // Log the OTP as requested
    console.log(`[OTP DEBUG] User: ${username}, OTP: ${generatedOtp}, Sent To: ${user.email}`)

    // Send email using nodemailer via Gmail
    try {
      await transporter.sendMail({
        from: process.env.OTP_EMAIL_FROM || '"โรงพยาบาลเถิน ระบบจัดการข่าวสาร" <pisutyimkuson@gmail.com>',
        to: user.email,
        subject: `รหัสผ่าน OTP เพื่อเข้าสู่ระบบ: ${generatedOtp}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px;">
            <h2 style="color: #0D7446; margin-bottom: 20px;">ยืนยันการเข้าสู่ระบบโรงพยาบาลเถิน</h2>
            <p>รหัสผ่านครั้งเดียว (OTP) ของคุณคือ:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #C8A835; margin: 20px 0; text-align: center; background: #f8fcf9; padding: 15px; border-radius: 6px; border: 1px dashed #0D7446;">
              ${generatedOtp}
            </div>
            <p style="color: #666; font-size: 14px;">รหัสนี้มีอายุการใช้งาน 5 นาทีเท่านั้น หากคุณไม่ได้ลงชื่อเข้าใช้กรุณาละเลยอีเมลนี้</p>
          </div>
        `,
      })
    } catch (mailError: any) {
      console.error('Failed to send OTP email:', mailError)
      return NextResponse.json(
        { error: 'ไม่สามารถส่งอีเมลยืนยัน OTP ได้ในขณะนี้ กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 500 }
      )
    }

    const tempToken = crypto.randomUUID()
    
    // Store pending attempt (expires in 5 minutes)
    pendingAttempts.set(tempToken, {
      userId: user.id,
      userRole: user.role || 'admin',
      otp: generatedOtp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })

    // Return status requesting OTP code
    return NextResponse.json({
      success: true,
      requiresOtp: true,
      tempToken,
      emailMasked: user.email.replace(/(.{3})(.*)(@.*)/, "$1***$3"),
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    )
  }
}
