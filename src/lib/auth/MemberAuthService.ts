import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getThaidConfig, exchangeThaidAuthorizationCode } from '@/lib/thaidAuth'
import {
  getProviderIdConfig,
  authenticateWithProviderId,
  authenticateWithHealthId,
  NotAProviderError,
  type ProviderIdProfile,
  type HealthIdUser,
} from '@/lib/providerIdAuth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { apiGateway } from '@/lib/apiGateway'
import { getSwrCachedData } from '@/lib/cache'
import { renderOtpEmailHtml, renderOtpEmailText, formatMaskedCitizenId } from '@/lib/auth/otpEmailTemplate'

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

export interface MemberAuthGatewayDeps {
  getAuthMemberByUsername: typeof apiGateway.app.getAuthMemberByUsername
  getAuthMemberByHashCid: typeof apiGateway.app.getAuthMemberByHashCid
  setMemberOtp: typeof apiGateway.app.setMemberOtp
  clearMemberOtp: typeof apiGateway.app.clearMemberOtp
  checkMemberSessionActive: typeof apiGateway.app.checkMemberSessionActive
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
  private readonly customGw?: Partial<MemberAuthGatewayDeps>

  constructor(gwDeps?: Partial<MemberAuthGatewayDeps>) {
    this.customGw = gwDeps
  }

  private get gw(): MemberAuthGatewayDeps {
    return {
      getAuthMemberByUsername:
        this.customGw?.getAuthMemberByUsername ??
        ((p) => apiGateway.app.getAuthMemberByUsername(p)),
      getAuthMemberByHashCid:
        this.customGw?.getAuthMemberByHashCid ??
        ((h) => apiGateway.app.getAuthMemberByHashCid(h)),
      setMemberOtp:
        this.customGw?.setMemberOtp ?? ((id, otp) => apiGateway.app.setMemberOtp(id, otp)),
      clearMemberOtp:
        this.customGw?.clearMemberOtp ?? ((id) => apiGateway.app.clearMemberOtp(id)),
      checkMemberSessionActive:
        this.customGw?.checkMemberSessionActive ??
        ((u, e) => apiGateway.app.checkMemberSessionActive(u, e)),
    }
  }

  async requestOtp(citizenId: string, providedEmail?: string): Promise<OtpRequestResult> {
    const trimmedUsername = citizenId.trim()

    const user = await this.gw.getAuthMemberByUsername({ username: trimmedUsername })

    if (!user) {
      return {
        success: false,
        error:
          'ไม่พบข้อมูลผู้ใช้งานนี้ในระบบสมาชิก กรุณาติดต่อเจ้าหน้าที่ดูแลระบบหรือกลุ่มงานทรัพยากรบุคคล',
      }
    }

    if (providedEmail && user.email.toLowerCase() !== providedEmail.trim().toLowerCase()) {
      return { success: false, error: 'อีเมลไม่ตรงกับข้อมูลที่ลงทะเบียนไว้ในระบบ' }
    }

    const targetEmail = user.email
    const otp = crypto.randomInt(100000, 999999).toString()

    await this.gw.setMemberOtp(user.id, otp)

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
        name: user.name || user.username,
        expiryMinutes: 5,
      })
      const emailText = renderOtpEmailText({
        otp,
        username: user.username,
        name: user.name || user.username,
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
          Importance: 'High',
          'X-Mailer': 'Thoen Hospital Member Auth Service',
        },
      })
    } catch (mailError: unknown) {
      console.error('Failed to send member OTP email:', mailError)
      return { success: false, error: 'ไม่สามารถส่งอีเมลยืนยัน OTP ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }
    }

    return { success: true, message: 'ส่งรหัส OTP เรียบร้อยแล้ว' }
  }

  async verifyOtp(citizenId: string, otp: string, providedEmail?: string): Promise<MemberSessionPayload> {
    const trimmedUsername = citizenId.trim()
    const trimmedOtp = otp.trim()
    const trimmedEmail = providedEmail?.trim()

    const user = await this.gw.getAuthMemberByUsername({
      username: trimmedUsername,
      email: trimmedEmail || undefined,
      includeOtp: true,
    })

    if (!user) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          `Failed OTP attempt for user ${formatMaskedCitizenId(trimmedUsername)}: User not found or email mismatch`,
          { username: formatMaskedCitizenId(trimmedUsername), email: trimmedEmail || 'unknown' }
        )
      } catch {}
      throw new Error('ข้อมูลผู้ใช้งานหรืออีเมลไม่ถูกต้อง')
    }

    if (!user.otp_code || user.otp_code !== trimmedOtp) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          `Failed OTP attempt for user ${formatMaskedCitizenId(trimmedUsername)}: Incorrect OTP`,
          { username: formatMaskedCitizenId(trimmedUsername), email: user.email }
        )
      } catch {}
      throw new Error('รหัส OTP ไม่ถูกต้อง')
    }

    if (!user.is_valid) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          `Failed OTP attempt for user ${formatMaskedCitizenId(trimmedUsername)}: OTP expired`,
          { username: formatMaskedCitizenId(trimmedUsername), email: user.email }
        )
      } catch {}
      throw new Error('รหัส OTP หมดอายุการใช้งานแล้ว กรุณาขอรหัสใหม่')
    }

    await this.gw.clearMemberOtp(user.id)

    return {
      username: trimmedUsername,
      email: user.email,
      role: user.role || 'member',
    }
  }

  async buildSession(
    payload: MemberSessionPayload,
    options?: { skipAudit?: boolean }
  ): Promise<string> {
    const now = Date.now()
    const isRenewal = typeof payload.iat === 'number'
    const iat = payload.iat ?? now
    const exp = payload.exp ?? now + SESSION_MAX_AGE * 1000

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

    if (!isRenewal && !options?.skipAudit) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          `User ${formatMaskedCitizenId(payload.username)} logged in successfully`,
          { username: formatMaskedCitizenId(payload.username), email: payload.email }
        )
      } catch {}
    }

    return `${encoded}.${signature}`
  }

  async verifySession(token: string): Promise<MemberSessionPayload> {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) throw new Error('Invalid token format')

    const expectedSignature = sign(encoded)
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
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

    let resolvedRole = payload.role || 'member'
    try {
      const fetchActive = async () =>
        this.gw.checkMemberSessionActive(payload.username, payload.email)

      const status = this.customGw
        ? await fetchActive()
        : await getSwrCachedData(
            `member-session-active:${payload.username}:${payload.email}`,
            fetchActive,
            { staleTtlMs: 30_000, maxTtlMs: 120_000 }
          )

      if (!status || !status.active) {
        throw new Error('User no longer active')
      }
      resolvedRole = status.role || resolvedRole
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'User no longer active') {
        throw err
      }
      logger.warn(
        { username: formatMaskedCitizenId(payload.username), error: msg },
        'Transient DB/Gateway error during verifySession; preserving cryptographically valid session'
      )
    }

    return {
      username: payload.username,
      email: payload.email,
      role: resolvedRole,
      aud: payload.aud,
      iat,
      exp: payload.exp,
    }
  }

  async revokeSession(_token: string): Promise<void> {
    // Stateless HMAC session revocation happens via cookie deletion in route handler
  }

  async exchangeThaidCode(code: string, _state: string): Promise<MemberSessionPayload> {
    const config = getThaidConfig()
    if (!config) throw new Error('ThaID is not configured')

    const userInfo = await exchangeThaidAuthorizationCode(code, config)
    if (!userInfo || !userInfo.pid) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          'พยายามเข้าสู่ระบบด้วย ThaID แต่การแลกเปลี่ยน Token ล้มเหลว (DOPA Token Exchange Failed/Expired)',
          { username: 'THAID_EXCHANGE_ERROR', email: '' }
        )
      } catch {}
      throw new Error('Failed to obtain citizen ID from ThaID')
    }

    const fullName =
      [userInfo.title, userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') ||
      'ไม่ระบุชื่อ'

    const user = await this.gw.getAuthMemberByUsername({ username: userInfo.pid })

    if (!user) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          `เข้าสู่ระบบ ThaID สำเร็จแต่ไม่มีบัญชีในระบบ: ${fullName} (เลขบัตรประชาชน ${formatMaskedCitizenId(userInfo.pid)}) พยายามเข้าสู่ระบบ แต่ไม่พบในฐานข้อมูลบุคลากร`,
          { username: formatMaskedCitizenId(userInfo.pid), email: '' }
        )
      } catch {}
      throw new Error('ThaID citizen ID not registered in hospital members')
    }

    try {
      await logAudit(
        'LOGIN',
        'members',
        `เข้าสู่ระบบสำเร็จผ่าน ThaID: ${user.name || fullName} (เลขบัตรประชาชน ${formatMaskedCitizenId(user.username)})`,
        { username: formatMaskedCitizenId(user.username), email: user.email }
      )
    } catch {}

    return {
      username: user.username,
      email: user.email,
      role: user.role || 'member',
    }
  }

  async exchangeProviderIdCode(code: string, _state: string): Promise<MemberSessionPayload> {
    const config = getProviderIdConfig()
    if (!config) throw new Error('Provider ID is not configured')

    let profile: ProviderIdProfile
    try {
      profile = await authenticateWithProviderId(code, config)
    } catch (authErr: unknown) {
      if (authErr instanceof NotAProviderError) {
        try {
          await logAudit(
            'LOGIN',
            'members',
            'พยายามเข้าสู่ระบบด้วย Provider ID แต่ไม่พบข้อมูลการเป็นบุคลากรสาธารณสุข (User is not a Provider)',
            { username: 'NOT_A_PROVIDER', email: '' }
          )
        } catch {}
        throw authErr
      }
      const errMsg = authErr instanceof Error ? authErr.message : 'Token Exchange Failed'
      try {
        await logAudit(
          'LOGIN',
          'members',
          `พยายามเข้าสู่ระบบด้วย Provider ID แต่การแลกเปลี่ยน Token ล้มเหลว (${errMsg})`,
          { username: 'PROVIDER_ID_EXCHANGE_ERROR', email: '' }
        )
      } catch {}
      throw authErr
    }

    if (!profile || !profile.hash_cid) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          'พยายามเข้าสู่ระบบด้วย Provider ID แต่ไม่ได้รับ hash_cid จากระบบ สธ.',
          { username: 'PROVIDER_ID_MISSING_HASH_CID', email: '' }
        )
      } catch {}
      throw new Error('Failed to obtain identity hash from Provider ID')
    }

    const fullName =
      [
        profile.title_th,
        profile.special_title_th,
        profile.name_th || `${profile.firstname_th || ''} ${profile.lastname_th || ''}`,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'ไม่ระบุชื่อ'

    const user = await this.gw.getAuthMemberByHashCid(profile.hash_cid.toLowerCase())

    if (!user) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          `เข้าสู่ระบบ Provider ID สำเร็จแต่ไม่มีบัญชีในระบบ: ${fullName} (PID: ${profile.provider_id || '-'}, hash_cid: ${profile.hash_cid.slice(0, 10)}...) พยายามเข้าสู่ระบบ แต่ไม่พบในฐานข้อมูลบุคลากร`,
          { username: 'NOT_REGISTERED', email: '' }
        )
      } catch {}
      throw new Error('Provider ID citizen ID not registered in hospital members')
    }

    try {
      await logAudit(
        'LOGIN',
        'members',
        `เข้าสู่ระบบสำเร็จผ่าน Provider ID: ${user.name || fullName} (เลขบัตรประชาชน ${formatMaskedCitizenId(user.username)}, PID: ${profile.provider_id || '-'})`,
        { username: formatMaskedCitizenId(user.username), email: user.email }
      )
    } catch {}

    return {
      username: user.username,
      email: user.email,
      role: user.role || 'member',
    }
  }

  async exchangeHealthIdCode(code: string, _state: string): Promise<MemberSessionPayload> {
    const config = getProviderIdConfig()
    if (!config) throw new Error('Health ID is not configured')

    let user: HealthIdUser
    try {
      user = await authenticateWithHealthId(code, config)
    } catch (authErr: unknown) {
      const errMsg = authErr instanceof Error ? authErr.message : 'Token Exchange Failed'
      try {
        await logAudit(
          'LOGIN',
          'members',
          `พยายามเข้าสู่ระบบด้วย Health ID แต่การแลกเปลี่ยน Token ล้มเหลว (${errMsg})`,
          { username: 'HEALTH_ID_EXCHANGE_ERROR', email: '' }
        )
      } catch {}
      throw authErr
    }

    if (!user.citizenId && !user.hashCid) {
      try {
        await logAudit(
          'LOGIN',
          'members',
          'พยายามเข้าสู่ระบบด้วย Health ID แต่ไม่พบเลขบัตรประชาชนหรือ hash_cid ในข้อมูล Token',
          { username: 'HEALTH_ID_MISSING_ID', email: '' }
        )
      } catch {}
      throw new Error('Failed to obtain identity from Health ID')
    }

    const member = user.citizenId
      ? await this.gw.getAuthMemberByUsername({ username: user.citizenId })
      : await this.gw.getAuthMemberByHashCid(user.hashCid!.toLowerCase())

    if (!member) {
      const maskedId = user.citizenId
        ? formatMaskedCitizenId(user.citizenId)
        : `${user.hashCid?.slice(0, 10)}...`
      try {
        await logAudit(
          'LOGIN',
          'members',
          `เข้าสู่ระบบ Health ID สำเร็จแต่ไม่มีบัญชีในระบบ: ${user.name || 'ไม่ระบุชื่อ'} (${maskedId}) ไม่พบในฐานข้อมูลบุคลากร`,
          { username: 'NOT_REGISTERED', email: '' }
        )
      } catch {}
      throw new Error('Health ID citizen ID not registered in hospital members')
    }

    try {
      await logAudit(
        'LOGIN',
        'members',
        `เข้าสู่ระบบสำเร็จผ่าน Health ID: ${member.name || user.name || 'บุคลากร'} (เลขบัตรประชาชน ${formatMaskedCitizenId(member.username)})`,
        { username: formatMaskedCitizenId(member.username), email: member.email }
      )
    } catch {}

    return {
      username: member.username,
      email: member.email,
      role: member.role || 'member',
    }
  }
}
