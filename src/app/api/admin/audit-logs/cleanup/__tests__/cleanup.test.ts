import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { NextResponse } from 'next/server'

const mockGetExpiredAuditLogsCount = vi.fn()
const mockPurgeExpiredAuditLogs = vi.fn()
const mockRequireMemberAdmin = vi.fn()

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getExpiredAuditLogsCount: (...args: unknown[]) => mockGetExpiredAuditLogsCount(...args),
      purgeExpiredAuditLogs: (...args: unknown[]) => mockPurgeExpiredAuditLogs(...args),
    },
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  requireMemberAdmin: () => mockRequireMemberAdmin(),
}))

describe('PDPA Audit Log Cleanup API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireMemberAdmin.mockResolvedValue({
      session: { username: 'admin', email: 'admin@hospital.go.th', role: 'admin' },
    })
  })

  it('rejects unauthenticated non-admin requests', async () => {
    mockRequireMemberAdmin.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const req = new Request('http://localhost/api/admin/audit-logs/cleanup')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('checks expired count with minimum 90-day retention enforcement in GET', async () => {
    mockGetExpiredAuditLogsCount.mockResolvedValueOnce({ expiredCount: 42 })

    const req = new Request('http://localhost/api/admin/audit-logs/cleanup?days=30')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.retentionDays).toBe(90)
    expect(json.expiredCount).toBe(42)
    expect(mockGetExpiredAuditLogsCount).toHaveBeenCalledWith(90)
  })

  it('rejects POST with retentionDays < 90', async () => {
    const req = new Request('http://localhost/api/admin/audit-logs/cleanup', {
      method: 'POST',
      body: JSON.stringify({ retentionDays: 60 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('ไม่น้อยกว่า 90 วัน')
  })

  it('executes batch delete via Gateway and records admin actor in POST', async () => {
    mockPurgeExpiredAuditLogs.mockResolvedValueOnce({ expiredCount: 15, purgedCount: 15 })

    const req = new Request('http://localhost/api/admin/audit-logs/cleanup', {
      method: 'POST',
      body: JSON.stringify({ retentionDays: 90 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.purgedCount).toBe(15)

    expect(mockPurgeExpiredAuditLogs).toHaveBeenCalledWith({
      retentionDays: 90,
      mode: 'admin',
      adminActor: { username: 'admin', email: 'admin@hospital.go.th' },
    })
  })
})
