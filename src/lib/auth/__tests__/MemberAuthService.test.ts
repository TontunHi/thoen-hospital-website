import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemberAuthService, type MemberAuthGatewayDeps } from '../MemberAuthService'
import * as thaidAuth from '@/lib/thaidAuth'
import * as audit from '@/lib/audit'

vi.mock('@/lib/thaidAuth', () => ({
  getThaidConfig: vi.fn(() => ({ clientId: 'test' })),
  exchangeThaidAuthorizationCode: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue(true),
    })),
  },
}))

describe('MemberAuthService', () => {
  let mockGw: {
    getAuthMemberByUsername: ReturnType<typeof vi.fn<MemberAuthGatewayDeps['getAuthMemberByUsername']>>
    getAuthMemberByHashCid: ReturnType<typeof vi.fn<MemberAuthGatewayDeps['getAuthMemberByHashCid']>>
    setMemberOtp: ReturnType<typeof vi.fn<MemberAuthGatewayDeps['setMemberOtp']>>
    clearMemberOtp: ReturnType<typeof vi.fn<MemberAuthGatewayDeps['clearMemberOtp']>>
    checkMemberSessionActive: ReturnType<typeof vi.fn<MemberAuthGatewayDeps['checkMemberSessionActive']>>
  }
  let authService: MemberAuthService

  beforeEach(() => {
    process.env.MEMBER_SESSION_SECRET = 'test-secret'
    mockGw = {
      getAuthMemberByUsername: vi.fn(),
      getAuthMemberByHashCid: vi.fn(),
      setMemberOtp: vi.fn().mockResolvedValue({ updated: true }),
      clearMemberOtp: vi.fn().mockResolvedValue({ cleared: true }),
      checkMemberSessionActive: vi.fn(),
    }
    authService = new MemberAuthService(mockGw)
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.MEMBER_SESSION_SECRET
  })

  describe('requestOtp', () => {
    it('validates citizen ID format implicitly by returning error if not found', async () => {
      mockGw.getAuthMemberByUsername.mockResolvedValue(null)
      const result = await authService.requestOtp('invalid')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/ไม่พบข้อมูลผู้ใช้งานนี้/)
    })

    it('sends OTP and writes OTP record for valid flow', async () => {
      mockGw.getAuthMemberByUsername.mockResolvedValue({
        id: 1,
        username: '1234567890123',
        name: 'นายทดสอบ ระบบ',
        email: 'test@example.com',
      })

      const result = await authService.requestOtp('1234567890123')
      expect(result.success).toBe(true)
      expect(mockGw.setMemberOtp).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{6}$/))
    })
  })

  describe('verifyOtp', () => {
    it('rejects expired OTP', async () => {
      mockGw.getAuthMemberByUsername.mockResolvedValue({
        id: 1,
        username: '1234567890123',
        email: 'test@example.com',
        otp_code: '123456',
        is_valid: 0,
        role: 'member',
      })

      await expect(authService.verifyOtp('1234567890123', '123456')).rejects.toThrow(
        'รหัส OTP หมดอายุการใช้งานแล้ว กรุณาขอรหัสใหม่'
      )
      expect(audit.logAudit).toHaveBeenCalledWith(
        'LOGIN',
        'members',
        expect.stringContaining('OTP expired'),
        expect.anything()
      )
    })

    it('returns session payload for valid OTP flow', async () => {
      mockGw.getAuthMemberByUsername.mockResolvedValue({
        id: 1,
        username: '1234567890123',
        email: 'test@example.com',
        otp_code: '123456',
        is_valid: 1,
        role: 'admin',
      })

      const result = await authService.verifyOtp('1234567890123', '123456')
      expect(result).toEqual({
        username: '1234567890123',
        email: 'test@example.com',
        role: 'admin',
      })
      expect(mockGw.clearMemberOtp).toHaveBeenCalledWith(1)
    })
  })

  describe('Session Management', () => {
    it('buildSession and verifySession handle valid JWT', async () => {
      mockGw.checkMemberSessionActive.mockResolvedValue({ active: true, role: 'admin' })

      const token = await authService.buildSession({
        username: '123',
        email: 'test@test.com',
        role: 'admin',
      })
      expect(token).toBeTruthy()
      expect(token.split('.').length).toBe(2)

      const verified = await authService.verifySession(token)
      expect(verified.username).toBe('123')
      expect(verified.role).toBe('admin')
      expect(audit.logAudit).toHaveBeenCalledWith(
        'LOGIN',
        'members',
        expect.stringContaining('logged in successfully'),
        expect.anything()
      )
    })

    it('buildSession does NOT log LOGIN audit when renewing session (iat provided)', async () => {
      const pastIat = Date.now() - 900_000
      await authService.buildSession({
        username: '123',
        email: 'test@test.com',
        role: 'admin',
        iat: pastIat,
      })
      expect(audit.logAudit).not.toHaveBeenCalled()
    })

    it('buildSession does NOT log LOGIN audit when skipAudit is true', async () => {
      await authService.buildSession(
        { username: '123', email: 'test@test.com', role: 'admin' },
        { skipAudit: true }
      )
      expect(audit.logAudit).not.toHaveBeenCalled()
    })

    it('verifySession throws on bad JWT signature', async () => {
      await expect(authService.verifySession('bad.token')).rejects.toThrow('Invalid signature')
    })

    it('verifySession throws when user is missing from DB', async () => {
      mockGw.checkMemberSessionActive.mockResolvedValue({ active: false, role: null })
      const token = await authService.buildSession({
        username: '123',
        email: 'test@test.com',
        role: 'admin',
      })
      await expect(authService.verifySession(token)).rejects.toThrow('User no longer active')
    })

    it('verifySession preserves signed session on transient Gateway 429/503 error', async () => {
      mockGw.checkMemberSessionActive.mockRejectedValue(
        new Error('Rate limit exceeded, retry in 35 seconds')
      )
      const token = await authService.buildSession({
        username: '123',
        email: 'test@test.com',
        role: 'staff',
      })
      const verified = await authService.verifySession(token)
      expect(verified.username).toBe('123')
      expect(verified.role).toBe('staff')
    })
  })

  describe('exchangeThaidCode', () => {
    it('throws ThaID exchange error', async () => {
      vi.mocked(thaidAuth.exchangeThaidAuthorizationCode).mockResolvedValue(null)

      await expect(authService.exchangeThaidCode('code123', 'state123')).rejects.toThrow(
        'Failed to obtain citizen ID from ThaID'
      )
    })

    it('maps to member session payload on success', async () => {
      vi.mocked(thaidAuth.exchangeThaidAuthorizationCode).mockResolvedValue({
        pid: '1234567890123',
      })
      mockGw.getAuthMemberByUsername.mockResolvedValue({
        id: 1,
        username: '1234567890123',
        email: 'test@example.com',
        role: 'member',
      })

      const result = await authService.exchangeThaidCode('code123', 'state123')
      expect(result.username).toBe('1234567890123')
      expect(result.role).toBe('member')
    })
  })
})
