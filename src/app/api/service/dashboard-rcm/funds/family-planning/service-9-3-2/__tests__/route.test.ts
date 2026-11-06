import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'

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

describe('Family Planning 9.3.2 Service API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-3-2')
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

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-3-2')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('validates query params and calls RcmFamilyPlanningService.getFamilyPlanning932Report', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staffuser',
      email: 'staff@example.com',
      role: 'staff',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const mockResult = {
      ds1: '2026-11-01',
      ds2: '2026-11-06',
      format: 'NEW_ECLAIM' as const,
      cardFilter: 'ALL' as const,
      searchField: 'ALL' as const,
      search: '',
      sortBy: 'vstdate' as const,
      sortOrder: 'desc' as const,
      adpCodes: ['FP001', 'FP002'],
      adpMapping: { isMapped: true, mappedCount: 2, adpCodes: ['FP001', 'FP002'], items: [] },
      summary: {
        totalCases: 10,
        uniquePatients: 9,
        totalIncome: 15000,
        totalCompensated: 12000,
        totalCompensatedEclaim: 12000,
        totalCompensatedRep: 12000,
        totalCompensatedNhso: 12000,
        compensatedCount: 8,
        uncompensatedCount: 2,
        compensationRate: 80,
        eclaimSentCount: 8,
        unsentCount: 2,
        withAuthenCount: 9,
        noAuthenCount: 1,
        authenRate: 90,
        withDrugCount: 6,
        withServiceCount: 7,
        hasErrorCount: 1,
      },
      pagination: {
        page: 1,
        pageSize: 50,
        totalItems: 10,
        totalPages: 1,
      },
      items: [],
    }

    const spy = vi
      .spyOn(RcmFamilyPlanningService, 'getFamilyPlanning932Report')
      .mockResolvedValue(mockResult)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-3-2?ds1=2026-11-01&ds2=2026-11-06&format=NEW_ECLAIM&cardFilter=COMPENSATED'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.summary.totalCases).toBe(10)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        ds1: '2026-11-01',
        ds2: '2026-11-06',
        format: 'NEW_ECLAIM',
        cardFilter: 'COMPENSATED',
      })
    )
  })

  it('rejects invalid date parameters with 400', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staffuser',
      email: 'staff@example.com',
      role: 'staff',
      aud: 'member',
      iat: 1,
      exp: 9999999999,
    })

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-3-2?ds1=invalid-date'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('INVALID_PARAMS')
  })
})
