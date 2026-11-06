import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getImplantInsertion } from '../implant-insertion/route'
import { GET as getImplantRemoval } from '../implant-removal/route'
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

describe('Family Planning API Routes (9.3.1 & 9.3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/implant-insertion')
    const res = await getImplantInsertion(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'testuser',
      email: 'test@example.com',
      role: 'guest',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/implant-insertion')
    const res = await getImplantInsertion(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('validates query params and calls service with reportType 9.3.1', async () => {
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
      reportType: '9.3.1',
      patientType: 'OPD',
      adpCode: 'FP002_1',
      adpMapping: { isMapped: true, mappedCount: 1, adpCode: 'FP002_1', items: [] },
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
        totalCompensated: 24000,
        totalIncome: 30000,
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
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/implant-insertion?ds1=2026-10-01&ds2=2026-10-31&patientType=OPD&cardFilter=COMPENSATED'
    )
    const res = await getImplantInsertion(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.reportType).toBe('9.3.1')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: '9.3.1',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        patientType: 'OPD',
        cardFilter: 'COMPENSATED',
      })
    )
  })

  it('calls service with reportType 9.3.2 for implant removal', async () => {
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
      reportType: '9.3.2',
      patientType: 'IPD',
      adpCode: 'FP002_2',
      adpMapping: { isMapped: true, mappedCount: 1, adpCode: 'FP002_2', items: [] },
      cardFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalCases: 5,
        uniquePatients: 5,
        compensatedCases: 4,
        eclaimSentCases: 0,
        unsentCases: 1,
        compensationRate: 80,
        totalCompensated: 12000,
        totalIncome: 15000,
        errorDxCount: 0,
        errorDrugCount: 0,
        hasErrorCount: 0,
        withAuthenCount: 5,
        withoutAuthenCount: 0,
        authenRate: 100,
      },
      totalCount: 5,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    }

    const spy = vi
      .spyOn(RcmFamilyPlanningService, 'getFamilyPlanningReport')
      .mockResolvedValue(mockResult as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/implant-removal?ds1=2026-10-01&ds2=2026-10-31&patientType=IPD'
    )
    const res = await getImplantRemoval(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.reportType).toBe('9.3.2')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: '9.3.2',
        patientType: 'IPD',
      })
    )
  })
})
