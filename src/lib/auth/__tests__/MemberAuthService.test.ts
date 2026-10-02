import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemberAuthService } from '../MemberAuthService'
import * as thaidAuth from '@/lib/thaidAuth'
import * as audit from '@/lib/audit'
import crypto from 'crypto'

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
  let mockDb: any
  let authService: MemberAuthService
  
  beforeEach(() => {
    process.env.MEMBER_SESSION_SECRET = 'test-secret'
    mockDb = vi.fn()
    authService = new MemberAuthService(mockDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.MEMBER_SESSION_SECRET
  })

  describe('requestOtp', () => {
    it('validates citizen ID format implicitly by returning error if not found', async () => {
      mockDb.mockResolvedValue([])
      const result = await authService.requestOtp('invalid')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/ไม่พบข้อมูลผู้ใช้งานนี้/)
    })

    it('sends OTP and writes OTP record for valid flow', async () => {
      mockDb.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return Promise.resolve([{ id: 1, username: '1234567890123', email: 'test@example.com' }])
        }
        return Promise.resolve()
      })
      
      const result = await authService.requestOtp('1234567890123')
      expect(result.success).toBe(true)
      expect(mockDb).toHaveBeenCalledTimes(2)
      expect(mockDb.mock.calls[1][0]).toContain('UPDATE members SET otp_code = ?')
    })
  })

  describe('verifyOtp', () => {
    it('rejects expired OTP', async () => {
      mockDb.mockResolvedValue([{ id: 1, email: 'test@example.com', otp_code: '123456', is_valid: 0, role: 'member' }])
      
      await expect(authService.verifyOtp('1234567890123', '123456')).rejects.toThrow('รหัส OTP หมดอายุการใช้งานแล้ว กรุณาขอรหัสใหม่')
      expect(audit.logAudit).toHaveBeenCalledWith('LOGIN', 'members', expect.stringContaining('OTP expired'), expect.anything())
    })

    it('returns session payload for valid OTP flow', async () => {
      mockDb.mockResolvedValue([{ id: 1, email: 'test@example.com', otp_code: '123456', is_valid: 1, role: 'admin' }])
      
      const result = await authService.verifyOtp('1234567890123', '123456')
      expect(result).toEqual({ username: '1234567890123', email: 'test@example.com', role: 'admin' })
      expect(mockDb).toHaveBeenCalledTimes(2)
      expect(mockDb.mock.calls[1][0]).toContain('UPDATE members SET otp_code = NULL')
    })
  })

  describe('Session Management', () => {
    it('buildSession and verifySession handle valid JWT', async () => {
      mockDb.mockResolvedValue([{ role: 'admin' }])
      
      const token = await authService.buildSession({ username: '123', email: 'test@test.com', role: 'admin' })
      expect(token).toBeTruthy()
      expect(token.split('.').length).toBe(2)
      
      const verified = await authService.verifySession(token)
      expect(verified.username).toBe('123')
      expect(verified.role).toBe('admin')
    })

    it('verifySession throws on bad JWT signature', async () => {
      await expect(authService.verifySession('bad.token')).rejects.toThrow('Invalid signature')
    })
  })

  describe('exchangeThaidCode', () => {
    it('throws ThaID exchange error', async () => {
      vi.mocked(thaidAuth.exchangeThaidAuthorizationCode).mockResolvedValue(null)
      
      await expect(authService.exchangeThaidCode('code123', 'state123')).rejects.toThrow('Failed to obtain citizen ID from ThaID')
    })

    it('maps to member session payload on success', async () => {
      vi.mocked(thaidAuth.exchangeThaidAuthorizationCode).mockResolvedValue({ pid: '1234567890123' })
      mockDb.mockResolvedValue([{ id: 1, username: '1234567890123', email: 'test@example.com', role: 'member' }])
      
      const result = await authService.exchangeThaidCode('code123', 'state123')
      expect(result.username).toBe('1234567890123')
      expect(result.role).toBe('member')
    })
  })
})
