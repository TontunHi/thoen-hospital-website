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

describe('Family Planning 9.3.6 Emergency Contraceptive API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/emergency-contraceptive')
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

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/emergency-contraceptive')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('validates query params and calls service with reportType 9.6', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staffuser',
      email: 'staff@example.com',
      role: 'staff',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const mockResult = {
      ds1: '2026-10-01',
      ds2: '2026-10-31',
      reportType: '9.6',
      patientType: 'OPD',
      adpCode: 'FP003_3',
      adpMapping: { isMapped: true, mappedCount: 2, adpCode: 'FP003_3', items: [] },
      cardFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalCases: 15,
        uniquePatients: 14,
        compensatedCases: 12,
        eclaimSentCases: 2,
        unsentCases: 1,
        compensationRate: 80,
        totalCompensated: 4500,
        totalIncome: 6000,
        errorDxCount: 1,
        errorDrugCount: 0,
        hasErrorCount: 1,
        withAuthenCount: 14,
        withoutAuthenCount: 1,
        authenRate: 93.3,
      },
      totalCount: 15,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    }

    const spy = vi
      .spyOn(RcmFamilyPlanningService, 'getFamilyPlanningReport')
      .mockResolvedValue(mockResult as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/emergency-contraceptive?ds1=2026-10-01&ds2=2026-10-31&patientType=OPD&cardFilter=COMPENSATED'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.reportType).toBe('9.6')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: '9.6',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        patientType: 'OPD',
        cardFilter: 'COMPENSATED',
      })
    )
  })

  it('handles server exceptions gracefully with 500', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'adminuser',
      email: 'admin@example.com',
      role: 'admin',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    vi.spyOn(RcmFamilyPlanningService, 'getFamilyPlanningReport').mockRejectedValue(
      new Error('Database connectivity error')
    )

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/emergency-contraceptive')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
