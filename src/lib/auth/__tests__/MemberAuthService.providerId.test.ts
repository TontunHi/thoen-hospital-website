import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemberAuthService } from '../MemberAuthService'
import * as providerIdAuth from '@/lib/providerIdAuth'
import * as audit from '@/lib/audit'

vi.mock('@/lib/providerIdAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof providerIdAuth>()
  return {
    ...actual,
    getProviderIdConfig: vi.fn(),
    authenticateWithProviderId: vi.fn(),
  }
})

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('MemberAuthService.exchangeProviderIdCode', () => {
  let mockDb: any
  let authService: MemberAuthService

  beforeEach(() => {
    process.env.MEMBER_SESSION_SECRET = 'test-secret-at-least-32-chars-long-123456'
    mockDb = vi.fn()
    authService = new MemberAuthService(mockDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.MEMBER_SESSION_SECRET
  })

  it('throws error when Provider ID is not configured', async () => {
    vi.mocked(providerIdAuth.getProviderIdConfig).mockReturnValue(null)

    await expect(authService.exchangeProviderIdCode('test-code', 'test-state')).rejects.toThrow(
      'Provider ID is not configured'
    )
  })

  it('throws NotAProviderError when user is not a provider', async () => {
    vi.mocked(providerIdAuth.getProviderIdConfig).mockReturnValue({
      env: 'PRD',
      healthIdBaseUrl: 'https://moph.id.th',
      providerIdBaseUrl: 'https://provider.id.th',
      healthIdClientId: 'h-id',
      healthIdClientSecret: 'h-sec',
      providerIdClientId: 'p-id',
      providerIdSecretKey: 'p-sec',
      redirectUri: 'https://example.com',
    })
    vi.mocked(providerIdAuth.authenticateWithProviderId).mockRejectedValue(
      new providerIdAuth.NotAProviderError('This user has not provider id')
    )

    await expect(authService.exchangeProviderIdCode('code', 'state')).rejects.toThrow(
      providerIdAuth.NotAProviderError
    )
    expect(audit.logAudit).toHaveBeenCalledWith(
      'LOGIN',
      'members',
      expect.stringContaining('ไม่พบข้อมูลการเป็นบุคลากรสาธารณสุข'),
      expect.objectContaining({ username: 'NOT_A_PROVIDER' })
    )
  })

  it('throws when member is not found in local database', async () => {
    vi.mocked(providerIdAuth.getProviderIdConfig).mockReturnValue({
      env: 'PRD',
      healthIdBaseUrl: 'https://moph.id.th',
      providerIdBaseUrl: 'https://provider.id.th',
      healthIdClientId: 'h-id',
      healthIdClientSecret: 'h-sec',
      providerIdClientId: 'p-id',
      providerIdSecretKey: 'p-sec',
      redirectUri: 'https://example.com',
    })
    vi.mocked(providerIdAuth.authenticateWithProviderId).mockResolvedValue({
      account_id: '12345',
      hash_cid: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      provider_id: '0111111111X21',
      name_th: 'นายแพทย์ บุคลากร สาธารณสุข',
    })
    mockDb.mockResolvedValue([])

    await expect(authService.exchangeProviderIdCode('code', 'state')).rejects.toThrow(
      'Provider ID citizen ID not registered in hospital members'
    )
    expect(mockDb).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, username, email, role, name FROM members WHERE SHA2(username, 256) = ?'),
      ['a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3']
    )
    expect(audit.logAudit).toHaveBeenCalledWith(
      'LOGIN',
      'members',
      expect.stringContaining('เข้าสู่ระบบ Provider ID สำเร็จแต่ไม่มีบัญชีในระบบ'),
      expect.objectContaining({ username: 'NOT_REGISTERED' })
    )
  })

  it('successfully logs in when user matches in hospital members table', async () => {
    vi.mocked(providerIdAuth.getProviderIdConfig).mockReturnValue({
      env: 'PRD',
      healthIdBaseUrl: 'https://moph.id.th',
      providerIdBaseUrl: 'https://provider.id.th',
      healthIdClientId: 'h-id',
      healthIdClientSecret: 'h-sec',
      providerIdClientId: 'p-id',
      providerIdSecretKey: 'p-sec',
      redirectUri: 'https://example.com',
    })
    vi.mocked(providerIdAuth.authenticateWithProviderId).mockResolvedValue({
      account_id: '12345',
      hash_cid: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      provider_id: '0111111111X21',
      name_th: 'นายแพทย์ สมชาย ใจดี',
    })
    mockDb.mockResolvedValue([
      {
        id: 10,
        username: '3520100123456',
        email: 'somchai@thoenhospital.go.th',
        role: 'doctor',
        name: 'นายแพทย์ สมชาย ใจดี',
      },
    ])

    const sessionPayload = await authService.exchangeProviderIdCode('valid-code', 'valid-state')
    expect(sessionPayload).toEqual({
      username: '3520100123456',
      email: 'somchai@thoenhospital.go.th',
      role: 'doctor',
    })
    expect(audit.logAudit).toHaveBeenCalledWith(
      'LOGIN',
      'members',
      expect.stringContaining('เข้าสู่ระบบสำเร็จผ่าน Provider ID'),
      expect.objectContaining({ email: 'somchai@thoenhospital.go.th' })
    )
  })
})
