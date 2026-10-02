import { describe, it, expect, beforeEach, vi } from 'vitest'
import { verifyToken, shouldRenewSession } from '../memberAuth'
import { createSalaryToken, verifySalaryToken } from '../salaryAuth'
import { MemberAuthService } from '../auth/MemberAuthService'

// buildSession calls logAudit — mock it so tests don't need a live DB
vi.mock('../audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('Member & Salary Authentication & JWT Audience', () => {
  let authService: MemberAuthService

  beforeEach(() => {
    process.env.MEMBER_SESSION_SECRET = 'test-member-secret-at-least-32-chars-long!!'
    process.env.SALARY_SESSION_SECRET = 'test-salary-secret-at-least-32-chars-long!!'
    // buildSession doesn't call queryExecutor; pass a no-op mock for safety
    authService = new MemberAuthService(vi.fn())
  })

  it('creates and verifies a valid member token', async () => {
    const token = await authService.buildSession({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
    })

    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.username).toBe('1234567890123')
    expect(payload?.email).toBe('doctor@hospital.go.th')
    expect(payload?.role).toBe('doctor')
  })

  it('rejects member token with invalid signature', async () => {
    const token = await authService.buildSession({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
    })

    const tampered = token.slice(0, -4) + 'abcd'
    expect(verifyToken(tampered)).toBeNull()
  })

  it('rejects member token when presented to salary verification (audience isolation)', async () => {
    const memberToken = await authService.buildSession({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
    })

    // salary verification must reject member token because aud is 'member', not 'salary'
    expect(verifySalaryToken(memberToken)).toBeNull()
  })

  it('rejects salary token when presented to member verification (audience isolation)', () => {
    const salaryToken = createSalaryToken({
      username: '1234567890123',
      name: 'Dr. Somchai',
    })

    // member verification must reject salary token because aud is 'salary', not 'member'
    expect(verifyToken(salaryToken)).toBeNull()
  })

  it('creates and verifies a valid salary token', () => {
    const salaryToken = createSalaryToken({
      username: '1234567890123',
      name: 'Dr. Somchai',
    })

    const payload = verifySalaryToken(salaryToken)
    expect(payload).not.toBeNull()
    expect(payload?.username).toBe('1234567890123')
    expect(payload?.name).toBe('Dr. Somchai')
  })

  it('supports sliding session by renewing token and preserving initial iat', async () => {
    const now = Date.now()
    const initialIat = now - 20 * 60 * 1000 // issued 20 minutes ago
    const agedExp = now + 10 * 60 * 1000 // 10 minutes remaining (< 15 mins threshold)
    const token = await authService.buildSession({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
      iat: initialIat,
      exp: agedExp,
    })

    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.iat).toBe(initialIat)
    expect(payload?.exp).toBe(agedExp)

    // Token has aged 20 minutes (remaining 10 mins < 15 mins threshold)
    expect(shouldRenewSession(payload!)).toBe(true)

    // Renew — pass original iat to preserve it, let buildSession extend exp by SESSION_MAX_AGE
    const renewed = await authService.buildSession({
      username: payload!.username,
      email: payload!.email,
      role: payload!.role,
      iat: payload!.iat,
    })
    const renewedPayload = verifyToken(renewed)

    expect(renewedPayload).not.toBeNull()
    expect(renewedPayload?.iat).toBe(initialIat) // iat is preserved!
    expect(renewedPayload?.exp).toBeGreaterThan(payload!.exp) // exp extended
  })

  it('rejects token when exceeding 12-hour absolute cap even if exp is valid', async () => {
    const over12HoursAgo = Date.now() - (12 * 3600 + 60) * 1000 // 12 hours 1 minute ago
    const token = await authService.buildSession({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
      iat: over12HoursAgo,
    })

    // Verify token should fail because iat exceeded 12-hour hard limit
    expect(verifyToken(token)).toBeNull()
  })
})

describe('AuthenticatedMember Context & RBAC Helper Methods', () => {
  it('correctly computes permissions, roles, and feature access', async () => {
    const { fetchAuthenticatedMember } = await import('../memberAuth')
    const memberDb = await import('../memberDb')

    // Mock queryMemberDb for user lookup, perms lookup, settings, and telegram link
    const querySpy = vi.spyOn(memberDb, 'queryMemberDb')
    querySpy
      .mockResolvedValueOnce([
        {
          id: 101,
          username: 'nurse_som',
          email: 'som@hospital.go.th',
          name: 'สมศรี มีสุข',
          department: 'กลุ่มงานการพยาบาล',
          position: 'พยาบาลวิชาชีพชำนาญการ',
          salary_user: '1234567890123',
          role: 'member',
          signature_path: 'storage/nurse_som/signature.png',
          profile_path: 'storage/nurse_som/profile.png',
        },
      ]) // members query
      .mockResolvedValueOnce([{ permission_key: 'manage_ethics' }]) // position permissions
      .mockResolvedValueOnce([
        { config_key: 'feature_signature', config_value: '1' },
        { config_key: 'feature_salary', config_value: '0' },
      ]) // system settings
      .mockResolvedValueOnce([{ id: 1 }]) // telegram link

    const member = await fetchAuthenticatedMember('nurse_som', 'som@hospital.go.th')
    expect(member).not.toBeNull()
    expect(member?.username).toBe('nurse_som')
    expect(member?.name).toBe('สมศรี มีสุข')
    expect(member?.hasSignature).toBe(true)
    expect(member?.hasSalary).toBe(true)
    expect(member?.isTelegramLinked).toBe(true)
    expect(member?.isAdmin).toBe(false)
    expect(member?.can('manage_ethics')).toBe(true)
    expect(member?.can('manage_news')).toBe(false)
    expect(member?.isFeatureEnabled('feature_signature')).toBe(true)
    expect(member?.isFeatureEnabled('feature_salary')).toBe(false)
    expect(member?.hasAccess('feature_signature')).toBe(true)
    expect(member?.hasAccess('feature_salary')).toBe(false)

    querySpy.mockRestore()
  })

  it('grants all permissions and feature access to admin users', async () => {
    const { fetchAuthenticatedMember } = await import('../memberAuth')
    const memberDb = await import('../memberDb')

    const querySpy = vi.spyOn(memberDb, 'queryMemberDb')
    querySpy
      .mockResolvedValueOnce([
        {
          id: 1,
          username: 'admin_it',
          email: 'admin@hospital.go.th',
          name: 'แอดมิน โรงพยาบาล',
          department: 'งานดิจิทัล',
          position: 'นักวิชาการคอมพิวเตอร์',
          salary_user: null,
          role: 'admin',
          signature_path: null,
          profile_path: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ config_key: 'feature_salary', config_value: '0' }])
      .mockResolvedValueOnce([])

    const member = await fetchAuthenticatedMember('admin_it', 'admin@hospital.go.th')
    expect(member).not.toBeNull()
    expect(member?.isAdmin).toBe(true)
    expect(member?.can('manage_ethics')).toBe(true)
    expect(member?.can('manage_news')).toBe(true)
    expect(member?.can('upload_salary')).toBe(true)
    // Even if setting is 0, admin has access
    expect(member?.hasAccess('feature_salary')).toBe(true)

    querySpy.mockRestore()
  })

  it('serializes AuthenticatedMember to a plain serializable DTO without functions or Set', async () => {
    const { fetchAuthenticatedMember, toClientMember } = await import('../memberAuth')
    const memberDb = await import('../memberDb')

    const querySpy = vi.spyOn(memberDb, 'queryMemberDb')
    querySpy
      .mockResolvedValueOnce([
        {
          id: 303,
          username: 'doctor_a',
          email: 'doctor_a@thoen.go.th',
          name: 'นพ. สมเกียรติ มั่นคง',
          department: 'องค์กรแพทย์',
          position: 'นายแพทย์ชำนาญการพิเศษ',
          salary_user: '3520100123456',
          role: 'member',
          signature_path: '/uploads/signatures/doc_a.png',
          profile_path: '/uploads/profiles/doc_a.jpg',
        },
      ])
      .mockResolvedValueOnce([{ permission_key: 'manage_rdu' }])
      .mockResolvedValueOnce([{ config_key: 'feature_signature', config_value: '1' }])
      .mockResolvedValueOnce([{ id: 5 }])

    const member = await fetchAuthenticatedMember('doctor_a', 'doctor_a@thoen.go.th')
    expect(member).not.toBeNull()

    const dto = toClientMember(member!)
    expect(dto.id).toBe(303)
    expect(dto.username).toBe('doctor_a')
    expect(dto.email).toBe('doctor_a@thoen.go.th')
    expect(dto.name).toBe('นพ. สมเกียรติ มั่นคง')
    expect(dto.isTelegramLinked).toBe(true)
    expect(dto.permissions).toEqual(['manage_rdu'])
    expect(Array.isArray(dto.permissions)).toBe(true)

    // Ensure no functions or Set exist on the DTO (RSC boundary safe)
    expect((dto as any).can).toBeUndefined()
    expect((dto as any).hasAccess).toBeUndefined()
    expect((dto as any).isFeatureEnabled).toBeUndefined()
    expect(dto.permissions instanceof Set).toBe(false)

    // Also check member.toDto()
    const dtoFromMethod = member!.toDto()
    expect(dtoFromMethod).toEqual(dto)

    // Verify it is JSON serializable
    const jsonString = JSON.stringify(dto)
    const parsed = JSON.parse(jsonString)
    expect(parsed.id).toBe(303)
    expect(parsed.permissions).toContain('manage_rdu')

    querySpy.mockRestore()
  })
})

