import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequireMemberApi = vi.fn()
vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: () => mockRequireMemberApi(),
}))

const mockUpsertAuditBatch = vi.fn()
const mockGetAuditsByTopic = vi.fn()
vi.mock('@/lib/kpi/kpiAuditService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/kpi/kpiAuditService')>('@/lib/kpi/kpiAuditService')
  return {
    ...actual,
    KpiAuditService: {
      upsertAuditBatch: (...args: any[]) => mockUpsertAuditBatch(...args),
      getAuditsByTopic: (...args: any[]) => mockGetAuditsByTopic(...args),
    },
  }
})

describe('/api/kpi/audits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('allows CRON_SECRET bearer publish without browser session', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-value-12345')
    mockUpsertAuditBatch.mockResolvedValueOnce({ savedCount: 1, skippedCount: 0 })

    const { POST } = await import('@/app/api/kpi/audits/route')
    const req = new NextRequest('http://localhost:3000/api/kpi/audits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer cron-secret-value-12345',
      },
      body: JSON.stringify({
        fiscalYear: '2570',
        periodKey: 'M01',
        items: [
          {
            indicatorId: 48,
            ruleCode: 'HR-NVD-0101',
            status: 'MISMATCH',
            aiNumerator: 3,
            aiDenominator: 15,
            aiResult: 20,
          },
        ],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.savedCount).toBe(1)
    expect(mockRequireMemberApi).not.toHaveBeenCalled()
  })

  it('rejects regular member without manage_kpi permission (403)', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-value-12345')
    mockRequireMemberApi.mockResolvedValueOnce({
      member: {
        id: 2,
        username: 'user2',
        name: 'Regular Staff',
        isAdmin: false,
        can: () => false,
      },
    })

    const { POST } = await import('@/app/api/kpi/audits/route')
    const req = new NextRequest('http://localhost:3000/api/kpi/audits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-token',
      },
      body: JSON.stringify({
        fiscalYear: '2570',
        periodKey: 'M01',
        items: [{ indicatorId: 48, ruleCode: 'HR-NVD-0101', status: 'MATCH' }],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('requires member session on GET', async () => {
    mockRequireMemberApi.mockResolvedValueOnce({
      error: NextResponse.json({ success: false }, { status: 401 }),
    })

    const { GET } = await import('@/app/api/kpi/audits/route')
    const req = new NextRequest('http://localhost:3000/api/kpi/audits?topicId=1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
