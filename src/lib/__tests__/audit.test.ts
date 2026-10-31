import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryMemberDb = vi.fn()

vi.mock('../memberDb', () => ({
  queryMemberDb: (...args: any[]) => mockQueryMemberDb(...args),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Map([
      ['x-forwarded-for', '203.0.113.195'],
      ['user-agent', 'HospitalBrowser/1.0'],
    ])
  ),
}))

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryMemberDb.mockResolvedValue([{ insertId: 1 }])
  })

  it('inserts audit log entry with masked username and sanitized parameters per PDPA', async () => {
    const { logAudit } = await import('../audit')

    await logAudit(
      'READ',
      'patients',
      'Viewed patient visit history for CID 1234567890123 and HN: 0012345',
      { username: '1234567890123', email: 'staff@hospital.go.th' }
    )

    expect(mockQueryMemberDb).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQueryMemberDb.mock.calls[0]
    expect(sql).toContain('INSERT INTO audit_logs')
    // Username must be masked to show only last 4 digits
    expect(params[0]).toBe('x-xxxx-xxxxx-01-23')
    expect(params[1]).toBe('staff@hospital.go.th')
    expect(params[2]).toBe('READ')
    expect(params[3]).toBe('patients')
    // Action details must have CID and HN masked
    expect(params[4]).toBe('Viewed patient visit history for CID x-xxxx-xxxxx-01-23 and HN: xxxx2345')
    expect(params[5]).toBe('203.0.113.195')
  })

  it('skips recursion if targetTable is audit_logs', async () => {
    const { logAudit } = await import('../audit')

    await logAudit('READ', 'audit_logs', 'Querying audit history')
    expect(mockQueryMemberDb).not.toHaveBeenCalled()
  })

  it('handles database error gracefully without throwing', async () => {
    const { logAudit } = await import('../audit')
    mockQueryMemberDb.mockRejectedValue(new Error('DB Connection Timeout'))

    // Should not throw
    await expect(
      logAudit('LOGIN', 'members', 'Login attempt', { username: 'test', email: 'test@hospital.go.th' })
    ).resolves.not.toThrow()
  })

  it('throttles rapid sequential audit logs within cooldown window', async () => {
    const { logThrottledAudit, _resetAuditThrottleCacheForTesting } = await import('../audit')
    _resetAuditThrottleCacheForTesting()

    const user = { username: '1234567890123', email: 'staff@hospital.go.th' }
    
    // First call: writes to DB
    const res1 = await logThrottledAudit('READ', 'loratadine_dispense_log', 'First view', user, 1000)
    expect(res1).toBe(true)
    expect(mockQueryMemberDb).toHaveBeenCalledTimes(1)

    // Second call immediately after: should be throttled (skipped)
    const res2 = await logThrottledAudit('READ', 'loratadine_dispense_log', 'Second view', user, 1000)
    expect(res2).toBe(false)
    expect(mockQueryMemberDb).toHaveBeenCalledTimes(1) // Still 1!

    // Third call after cooldown expires (simulate elapsed time)
    await new Promise((resolve) => setTimeout(resolve, 1050))
    const res3 = await logThrottledAudit('READ', 'loratadine_dispense_log', 'Third view after cooldown', user, 1000)
    expect(res3).toBe(true)
    expect(mockQueryMemberDb).toHaveBeenCalledTimes(2) // Incremented to 2!
  })

  describe('maskAuditIdentifier', () => {
    it('correctly masks 13-digit Thai national IDs showing only the last 4 digits', async () => {
      const { maskAuditIdentifier } = await import('../audit')
      expect(maskAuditIdentifier('1234567890123')).toBe('x-xxxx-xxxxx-01-23')
      expect(maskAuditIdentifier('1-2345-67890-12-3')).toBe('x-xxxx-xxxxx-01-23')
    })

    it('preserves already masked identifiers', async () => {
      const { maskAuditIdentifier } = await import('../audit')
      expect(maskAuditIdentifier('x-xxxx-xxxxx-01-23')).toBe('x-xxxx-xxxxx-01-23')
      expect(maskAuditIdentifier('x-xxxx-xxxxx-12-3')).toBe('x-xxxx-xxxxx-12-3')
      expect(maskAuditIdentifier('••••••1234')).toBe('••••••1234')
      expect(maskAuditIdentifier('****1234')).toBe('****1234')
    })

    it('preserves system role accounts', async () => {
      const { maskAuditIdentifier } = await import('../audit')
      expect(maskAuditIdentifier('admin')).toBe('admin')
      expect(maskAuditIdentifier('system')).toBe('system')
      expect(maskAuditIdentifier('cron')).toBe('cron')
    })

    it('handles empty or null values', async () => {
      const { maskAuditIdentifier } = await import('../audit')
      expect(maskAuditIdentifier(null)).toBeNull()
      expect(maskAuditIdentifier(undefined)).toBeNull()
      expect(maskAuditIdentifier('')).toBeNull()
    })
  })

  describe('maskAuditDetails', () => {
    it('masks 13-digit CIDs inside action details text', async () => {
      const { maskAuditDetails } = await import('../audit')
      const input = 'User 1234567890123 logged in to Salary portal manually'
      expect(maskAuditDetails(input)).toBe('User x-xxxx-xxxxx-01-23 logged in to Salary portal manually')
    })

    it('masks formatted Thai citizen IDs', async () => {
      const { maskAuditDetails } = await import('../audit')
      const input = 'เข้าสู่ระบบสำเร็จผ่าน ThaID (เลขบัตรประชาชน 1-2345-67890-12-3)'
      expect(maskAuditDetails(input)).toBe('เข้าสู่ระบบสำเร็จผ่าน ThaID (เลขบัตรประชาชน x-xxxx-xxxxx-12-3)')
    })

    it('masks hospital numbers (HN) to show only last 4 digits', async () => {
      const { maskAuditDetails } = await import('../audit')
      const input = 'พิมพ์เวชระเบียน HN: 0012345 (VN: 660101123456)'
      expect(maskAuditDetails(input)).toBe('พิมพ์เวชระเบียน HN: xxxx2345 (VN: 660101123456)')
    })

    it('masks phone numbers', async () => {
      const { maskAuditDetails } = await import('../audit')
      const input = 'ติดต่อกลับที่เบอร์ 0812345678'
      expect(maskAuditDetails(input)).toBe('ติดต่อกลับที่เบอร์ 081-xxx-5678')
    })

    it('preserves already masked text cleanly', async () => {
      const { maskAuditDetails } = await import('../audit')
      const input = 'ค้นหาประวัติการรักษาและผลแลปสำหรับ: x-xxxx-xxxxx-1234 (พบ 2 รายการ)'
      expect(maskAuditDetails(input)).toBe('ค้นหาประวัติการรักษาและผลแลปสำหรับ: x-xxxx-xxxxx-1234 (พบ 2 รายการ)')
    })
  })
})
