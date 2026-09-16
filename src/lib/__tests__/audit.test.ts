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

  it('inserts audit log entry with correct parameters', async () => {
    const { logAudit } = await import('../audit')

    await logAudit(
      'READ',
      'patients',
      'Viewed patient visit history',
      { username: '1234567890123', email: 'staff@hospital.go.th' }
    )

    expect(mockQueryMemberDb).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQueryMemberDb.mock.calls[0]
    expect(sql).toContain('INSERT INTO audit_logs')
    expect(params[0]).toBe('1234567890123')
    expect(params[1]).toBe('staff@hospital.go.th')
    expect(params[2]).toBe('READ')
    expect(params[3]).toBe('patients')
    expect(params[4]).toBe('Viewed patient visit history')
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
})
