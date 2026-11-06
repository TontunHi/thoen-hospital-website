import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'

// Mock dependencies
vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Family Planning 9.2 IUD Service API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-2')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'guestuser',
      email: 'guest@example.com',
      role: 'guest',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-2')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('validates query params and calls RcmFamilyPlanningService.getIudReport', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staffuser',
      email: 'staff@example.com',
      role: 'staff',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const mockResult = {
      ds1: '2024-10-01',
      ds2: '2025-09-30',
      patientType: 'OPD' as const,
      adpCodes: ['20003', 'FP001', '71681', '71682'],
      adpMapping: { isMapped: true, mappedCount: 4, adpCodes: ['20003', 'FP001', '71681', '71682'], items: [] },
      cardFilter: 'ALL' as const,
      searchField: 'ALL' as const,
      search: '',
      sortBy: 'vstdate' as const,
      sortOrder: 'desc' as const,
      summary: {
        totalCases: 5,
        uniquePatients: 5,
        compensatedCases: 3,
        uncompensatedCases: 2,
        eclaimSentCases: 3,
        unsentCases: 2,
        compensationRate: 60,
        totalCompensated: 9000,
        totalIncome: 12000,
        totalMoneyEclaim: 9000,
        totalMoneyRep: 9000,
        totalMoneyInvoice: 9000,
        errorDxCount: 1,
        errorOpCount: 1,
        errorDrugCount: 0,
        hasErrorCount: 1,
        completeCount: 4,
        withAuthenCount: 4,
        withoutAuthenCount: 1,
        authenRate: 80,
      },
      totalCount: 5,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    }

    const spy = vi.spyOn(RcmFamilyPlanningService, 'getIudReport').mockResolvedValue(mockResult)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-2?ds1=2024-10-01&ds2=2025-09-30&patientType=OPD&cardFilter=ALL'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.patientType).toBe('OPD')
    expect(json.data.summary.totalCases).toBe(5)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        ds1: '2024-10-01',
        ds2: '2025-09-30',
        patientType: 'OPD',
        cardFilter: 'ALL',
      })
    )
  })
})
