import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryMemberDb = vi.fn()
const mockLogAudit = vi.fn()

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: (...args: any[]) => mockQueryMemberDb(...args),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: (...args: any[]) => mockLogAudit(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('PDPA Audit Log Retention & Cleanup API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('rejects unauthorized request when CRON_SECRET is set', async () => {
    vi.stubEnv('CRON_SECRET', 'super-secret-cron-token')

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/cleanup', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-token',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toContain('Unauthorized')
    expect(mockQueryMemberDb).not.toHaveBeenCalled()
  })

  it('rejects retention days shorter than 90 days for compliance', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-token')

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/cleanup?days=30', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-cron-token',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('at least 90 days')
  })

  it('successfully executes cleanup and returns count of purged records', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-token')

    // First call: COUNT query returns 15 expired records
    mockQueryMemberDb.mockResolvedValueOnce([{ expiredCount: 15 }])
    // Second call: DELETE query returns 15 affected rows
    mockQueryMemberDb.mockResolvedValueOnce({ affectedRows: 15 })

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/cleanup?days=365', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-cron-token',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.purged).toBe(15)
    expect(json.retentionDays).toBe(365)
    expect(mockLogAudit).toHaveBeenCalledWith(
      'DELETE',
      'audit_logs',
      expect.stringContaining('purged 15 logs'),
      expect.objectContaining({ username: 'SYSTEM_CRON' })
    )
  })

  it('handles database error gracefully with 500 response', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-token')
    mockQueryMemberDb.mockRejectedValue(new Error('Database disk full'))

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/cleanup', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-cron-token',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Internal cleanup job error')
  })
})
