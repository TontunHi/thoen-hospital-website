import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getPalliativeCareReport: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

describe('GET /api/service/dashboard-rcm/palliative-care/pc-3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-3')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('returns 403 when user does not have required role', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'user',
      role: 'guest',
    } as any)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-3')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
  })

  it('calls RcmDashboardService and returns report data successfully', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff_user',
      role: 'staff',
    } as any)

    const mockResult = {
      ds1: '2025-10-01',
      ds2: '2025-10-31',
      ucOnly: true,
      hasRepInvoice: false,
      availableCompensations: [],
      filterType: 'ALL' as const,
      summary: {
        totalVisits: 10,
        totalPatients: 8,
        advanceCarePlanCount: 4,
        opioidCount: 3,
        hasZ515Count: 9,
        missingZ515Count: 1,
        paidCount: 2,
        totalCompensated: 12000,
        deceasedCount: 2,
      },
      items: [],
    }

    vi.mocked(RcmDashboardService.getPalliativeCareReport).mockResolvedValue(mockResult)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-3?ds1=2025-10-01&ds2=2025-10-31&ucOnly=true')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.summary.totalVisits).toBe(10)
    expect(RcmDashboardService.getPalliativeCareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        ds1: '2025-10-01',
        ds2: '2025-10-31',
        ucOnly: true,
      })
    )
  })

  it('passes compensated and deathStatus query parameters to RcmDashboardService', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff_user',
      role: 'staff',
    } as any)

    const mockResult = {
      ds1: '2025-10-01',
      ds2: '2025-10-31',
      ucOnly: true,
      hasRepInvoice: false,
      availableCompensations: [],
      filterType: 'ALL' as const,
      summary: {
        totalVisits: 0,
        totalPatients: 0,
        advanceCarePlanCount: 0,
        opioidCount: 0,
        hasZ515Count: 0,
        missingZ515Count: 0,
        paidCount: 0,
        totalCompensated: 0,
        deceasedCount: 0,
      },
      items: [],
    }

    vi.mocked(RcmDashboardService.getPalliativeCareReport).mockResolvedValue(mockResult)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/pc-3?compensated=%3E%3D750&deathStatus=Y')
    const res = await GET(req)
    expect(res.status).toBe(200)

    expect(RcmDashboardService.getPalliativeCareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        compensated: '>=750',
        deathStatus: 'Y',
      })
    )
  })
})
