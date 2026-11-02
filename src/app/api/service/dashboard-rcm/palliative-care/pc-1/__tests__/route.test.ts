import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getPalliativeCarePc1Report: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

describe('GET /api/service/dashboard-rcm/palliative-care/pc-1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-1')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('returns 403 when user does not have permission', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'user',
      role: 'guest',
    } as any)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-1')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
  })

  it('calls RcmDashboardService and returns PC.1 report data', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff_user',
      role: 'staff',
    } as any)

    const mockResult = {
      ds1: '2026-10-01',
      ds2: '2026-10-31',
      paidStatus: 'ALL' as const,
      summary: {
        totalVisits: 10,
        totalPatients: 8,
        paidCount: 5,
        unpaidCount: 5,
        totalCompensated: 5000,
        totalInvoiceCompensated: 0,
      },
      items: [],
    }

    vi.mocked(RcmDashboardService.getPalliativeCarePc1Report).mockResolvedValue(mockResult)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-1?ds1=2026-10-01&ds2=2026-10-31')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.summary.totalVisits).toBe(10)
    expect(RcmDashboardService.getPalliativeCarePc1Report).toHaveBeenCalledWith(
      expect.objectContaining({
        ds1: '2026-10-01',
        ds2: '2026-10-31',
      })
    )
  })
})
