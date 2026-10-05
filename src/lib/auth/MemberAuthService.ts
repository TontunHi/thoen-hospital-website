import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getThaidConfig, exchangeThaidAuthorizationCode } from '@/lib/thaidAuth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { queryMemberDb } from '@/lib/memberDb'
import { renderOtpEmailHtml, renderOtpEmailText } from '@/lib/auth/otpEmailTemplate'

export interface OtpRequestResult {
  success: boolean
  message?: string
  error?: string
}

export interface MemberSessionPayload {
  username: string
  email: string
  role: string
  aud?: string
  iat?: number
  exp?: number
}

function getSecret(): string {
  const secret = process.env.MEMBER_SESSION_SECRET
  if (!secret) {
    throw new Error('MEMBER_SESSION_SECRET environment variable is required')
  }
  return secret
}

const SESSION_MAX_AGE = 1800 // 30 minutes in seconds
const ABSOLUTE_MAX_AGE = 43200 // 12 hours in seconds

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', getSecret())
  hmac.update(value)
  return hmac.digest('hex')
}

export class MemberAuthService {
  constructor(private queryExecutor: any = queryMemberDb) {}

  async requestOtp(citizenId: string, providedEmail?: string): Promise<OtpRequestResult> {
    const trimmedUsername = citizenId.trim()
    
    const users = await this.queryExecutor(
      'SELECT id, username, name, email FROM members WHERE username = ?',
      [trimmedUsername]
    )

    if (!users || users.length === 0) {
      return { success: false, error: 'ไม่พบข้อมูลผู้ใช้งานนี้ในระบบสมาชิก กรุณาติดต่อเจ้าหน้าที่ดูแลระบบหรือกลุ่มงานทรัพยากรบุคคล' }
    }

    const user = users[0]
    
    if (providedEmail && user.email.toLowerCase() !== providedEmail.trim().toLowerCase()) {
      return { success: false, error: 'อีเมลไม่ตรงกับข้อมูลที่ลงทะเบียนไว้ในระบบ' }
    }

    const targetEmail = user.email

    const otp = crypto.randomInt(100000, 999999).toString()

    await this.queryExecutor(
      'UPDATE members SET otp_code = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ?',
      [otp, user.id]
    )

    console.log('[MEMBER OTP] OTP generated successfully and dispatching to registered email')

    const isBrevoConfigured = Boolean(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS)
    const transporter = nodemailer.createTransport(
      isBrevoConfigured
        ? {
            host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
            port: Number(process.env.BREVO_SMTP_PORT) || 587,
            secure: false,
            auth: {
              user: process.env.BREVO_SMTP_USER,
              pass: process.env.BREVO_SMTP_PASS,
            },
          }
        : {
            service: 'gmail',
            auth: {
              user: process.env.MEMBER_OTP_EMAIL_USER!,
              pass: process.env.MEMBER_OTP_EMAIL_PASS!,
            },
          }
    )

    try {
      const smtpUser = process.env.BREVO_SMTP_FROM_EMAIL || process.env.MEMBER_OTP_EMAIL_USER || ''
      const fromName = process.env.BREVO_SMTP_FROM || `"ระบบสมาชิก โรงพยาบาลเถิน" <${smtpUser}>`
      
      const emailHtml = renderOtpEmailHtml({
        otp,
        username: user.username,
        name: user.name,
        expiryMinutes: 5,
      })
      const emailText = renderOtpEmailText({
        otp,
        username: user.username,
        name: user.name,
        expiryMinutes: 5,
      })

      await transporter.sendMail({
        from: fromName,
        to: targetEmail,
        replyTo: smtpUser,
        subject: `[โรงพยาบาลเถิน] รหัสยืนยัน OTP สำหรับเข้าสู่ระบบสมาชิก: ${otp}`,
        text: emailText,
        html: emailHtml,
        headers: {
          'X-Priority': '1 (Highest)',
          'X-MSMail-Priority': 'High',
          'Importance': 'High',
          'X-Mailer': 'Thoen Hospital Member Auth Service',
        },
      })
    } catch (mailError: any) {
      console.error('Failed to send member OTP email:', mailError)
      return { success: false, error: 'ไม่สามารถส่งอีเมลยืนยัน OTP ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }
    }

    return { success: true, message: 'ส่งรหัส OTP เรียบร้อยแล้ว' }
  }

  async verifyOtp(citizenId: string, otp: string, providedEmail?: string): Promise<MemberSessionPayload> {
    const trimmedUsername = citizenId.trim()
    const trimmedOtp = otp.trim()
    const trimmedEmail = providedEmail?.trim()

    let queryStr = 'SELECT *, (otp_expiry > NOW()) AS is_valid FROM members WHERE username = ?'
    let params: any[] = [trimmedUsername]
    if (trimmedEmail) {
      queryStr += ' AND email = ?'
      params.push(trimmedEmail)
    }

    const users = await this.queryExecutor(queryStr, params)

    if (!users || users.length === 0) {
      try {
        await logAudit('LOGIN', 'members', `Failed OTP attempt for user ${trimmedUsername}: User not found or email mismatch`, { username: trimmedUsername, email: trimmedEmail || 'unknown' })
      } catch {}
      throw new Error('ข้อมูลผู้ใช้งานหรืออีเมลไม่ถูกต้อง')
    }

    const user = users[0]

    if (!user.otp_code || user.otp_code !== trimmedOtp) {
      try {
        await logAudit('LOGIN', 'members', `Failed OTP attempt for user ${trimmedUsername}: Incorrect OTP`, { username: trimmedUsername, email: user.email })
      } catch {}
      throw new Error('รหัส OTP ไม่ถูกต้อง')
    }

    if (!user.is_valid) {
      try {
        await logAudit('LOGIN', 'members', `Failed OTP attempt for user ${trimmedUsername}: OTP expired`, { username: trimmedUsername, email: user.email })
      } catch {}
      throw new Error('รหัส OTP หมดอายุการใช้งานแล้ว กรุณาขอรหัสใหม่')
    }

    await this.queryExecutor(
      'UPDATE members SET otp_code = NULL, otp_expiry = NULL WHERE id = ?',
      [user.id]
    )

    return {
      username: trimmedUsername,
      email: user.email,
      role: user.role || 'member'
    }
  }

  async buildSession(payload: MemberSessionPayload): Promise<string> {
    const now = Date.now()
    const iat = payload.iat ?? now
    const exp = payload.exp ?? (now + SESSION_MAX_AGE * 1000)
    
    const finalPayload = {
      username: payload.username,
      email: payload.email,
      role: payload.role,
      aud: 'member',
      iat,
      exp,
    }
    const encoded = Buffer.from(JSON.stringify(finalPayload)).toString('base64url')
    const signature = sign(encoded)
    
    try {
      await logAudit('LOGIN', 'members', `User ${payload.username} logged in successfully`, { username: payload.username, email: payload.email })
    } catch {}
    
    return `${encoded}.${signature}`
  }

  async verifySession(token: string): Promise<MemberSessionPayload> {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) throw new Error('Invalid token format')

    const expectedSignature = sign(encoded)
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new Error('Invalid signature')
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.aud !== 'member') throw new Error('Invalid token audience')
    
    const now = Date.now()
    if (payload.exp < now) throw new Error('Session expired')

    const iat = typeof payload.iat === 'number' ? payload.iat : payload.exp - SESSION_MAX_AGE * 1000
    if (now - iat > ABSOLUTE_MAX_AGE * 1000) {
      throw new Error('Absolute session max age exceeded')
    }

    // Check member still active
    const users = await this.queryExecutor(
      'SELECT role FROM members WHERE username = ? AND email = ? LIMIT 1',
      [payload.username, payload.email]
    )
    if (!users || users.length === 0) {
      throw new Error('User no longer active')
    }

    return {
      username: payload.username,
      email: payload.email,
      role: users[0].role || 'member',
      aud: payload.aud,
      iat,
      exp: payload.exp,
    }
  }

  async revokeSession(token: string): Promise<void> {
    // In a stateless JWT setup without a blocklist, revocation is done by deleting the cookie in the route handler.
    // If a blocklist is implemented in DB, we would do it here.
  }

  async exchangeThaidCode(code: string, state: string): Promise<MemberSessionPayload> {
    const config = getThaidConfig()
    if (!config) throw new Error('ThaID is not configured')

    const userInfo = await exchangeThaidAuthorizationCode(code, config)
    if (!userInfo || !userInfo.pid) {
      throw new Error('Failed to obtain citizen ID from ThaID')
    }

    const users = await this.queryExecutor(
      'SELECT id, username, email, role, name FROM members WHERE username = ? LIMIT 1',
      [userInfo.pid]
    )

    if (!users || users.length === 0) {
      throw new Error('ThaID citizen ID not registered in hospital members')
    }

    const user = users[0]

    return {
      username: user.username,
      email: user.email,
      role: user.role || 'member'
    }
  }
}
