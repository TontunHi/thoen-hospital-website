import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { NextResponse } from 'next/server'

const mockQueryMemberDb = vi.fn()
const mockRequireMemberAdmin = vi.fn()

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: (...args: any[]) => mockQueryMemberDb(...args),
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
    mockQueryMemberDb.mockResolvedValueOnce([{ expiredCount: 42 }])

    const req = new Request('http://localhost/api/admin/audit-logs/cleanup?days=30') // Even if 30 requested, clamp to 90
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.retentionDays).toBe(90)
    expect(json.expiredCount).toBe(42)
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

  it('executes batch delete and records audit log in POST', async () => {
    mockQueryMemberDb
      .mockResolvedValueOnce([{ expiredCount: 15 }]) // count
      .mockResolvedValueOnce({ affectedRows: 15 }) // batch delete
      .mockResolvedValueOnce({ affectedRows: 1 }) // audit log insert

    const req = new Request('http://localhost/api/admin/audit-logs/cleanup', {
      method: 'POST',
      body: JSON.stringify({ retentionDays: 90 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.purgedCount).toBe(15)

    // Verify audit log insertion
    expect(mockQueryMemberDb).toHaveBeenCalledTimes(3)
    const [auditSql, auditParams] = mockQueryMemberDb.mock.calls[2]
    expect(auditSql).toContain('INSERT INTO audit_logs')
    expect(auditParams).toContain('admin')
    expect(auditParams).toContain('DELETE')
  })
})
