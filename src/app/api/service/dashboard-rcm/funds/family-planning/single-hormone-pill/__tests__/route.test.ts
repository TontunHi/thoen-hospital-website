import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getSingleHormonePill } from '../route'
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

describe('Family Planning 9.3.5 API Route (Single Hormone Pill)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill')
    const res = await getSingleHormonePill(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'testguest',
      email: 'guest@example.com',
      role: 'guest',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill')
    const res = await getSingleHormonePill(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('validates query params and calls service with reportType 9.3.5', async () => {
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
      reportType: '9.5',
      patientType: 'OPD',
      adpCode: 'FP003_2',
      adpMapping: { isMapped: true, mappedCount: 1, adpCode: 'FP003_2', items: [] },
      cardFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalCases: 10,
        uniquePatients: 9,
        compensatedCases: 8,
        eclaimSentCases: 1,
        unsentCases: 1,
        compensationRate: 80,
        totalCompensated: 3200,
        totalIncome: 4000,
        errorDxCount: 1,
        errorDrugCount: 0,
        hasErrorCount: 1,
        withAuthenCount: 9,
        withoutAuthenCount: 1,
        authenRate: 90,
      },
      totalCount: 10,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    }

    const spy = vi
      .spyOn(RcmFamilyPlanningService, 'getFamilyPlanningReport')
      .mockResolvedValue(mockResult as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill?ds1=2026-10-01&ds2=2026-10-31&patientType=OPD&cardFilter=COMPENSATED'
    )
    const res = await getSingleHormonePill(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.reportType).toBe('9.5')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: '9.5',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        patientType: 'OPD',
        cardFilter: 'COMPENSATED',
      })
    )
  })

  it('handles IPD requests with reportType 9.5', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'adminuser',
      email: 'admin@example.com',
      role: 'admin',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const mockResult = {
      ds1: '2026-10-01',
      ds2: '2026-10-31',
      reportType: '9.5',
      patientType: 'IPD',
      adpCode: 'FP003_2',
      adpMapping: { isMapped: true, mappedCount: 1, adpCode: 'FP003_2', items: [] },
      cardFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalCases: 3,
        uniquePatients: 3,
        compensatedCases: 2,
        eclaimSentCases: 1,
        unsentCases: 0,
        compensationRate: 66.7,
        totalCompensated: 800,
        totalIncome: 1200,
        errorDxCount: 0,
        errorDrugCount: 0,
        hasErrorCount: 0,
        withAuthenCount: 3,
        withoutAuthenCount: 0,
        authenRate: 100,
      },
      totalCount: 3,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    }

    const spy = vi
      .spyOn(RcmFamilyPlanningService, 'getFamilyPlanningReport')
      .mockResolvedValue(mockResult as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill?ds1=2026-10-01&ds2=2026-10-31&patientType=IPD'
    )
    const res = await getSingleHormonePill(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.reportType).toBe('9.5')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: '9.5',
        patientType: 'IPD',
      })
    )
  })
})
