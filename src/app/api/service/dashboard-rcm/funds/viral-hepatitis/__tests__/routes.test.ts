import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as service231GET } from '../service-23-1/route'
import { GET as vnDetailsGET } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmViralHepatitisService } from '@/lib/clinical/rcmViralHepatitisService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmViralHepatitisService', () => ({
  RcmViralHepatitisService: {
    getViralHepatitisReport: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Viral Hepatitis B Funds API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1', () => {
    it('returns 401 when user is unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1')
      const res = await service231GET(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 when user has insufficient role', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'guest',
        role: 'guest' as any,
        email: 'guest@test.com',
      } as any)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1')
      const res = await service231GET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('returns 400 when invalid params are passed', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1?ds1=invalid-date'
      )
      const res = await service231GET(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('returns 200 with report data for valid request', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmViralHepatitisService.getViralHepatitisReport).mockResolvedValue({
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        cardFilter: 'ALL',
        ucOnly: false,
        searchField: 'ALL',
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        summary: {
          totalVisits: 0,
          uniquePatients: 0,
          compensatedVisits: 0,
          uncompensatedVisits: 0,
          compensationRate: 0,
          totalCompensated: 0,
          averageCompensated: 0,
          withAuthenCount: 0,
          withoutAuthenCount: 0,
          authenRate: 0,
          withLabCount: 0,
          withoutLabCount: 0,
          labRate: 0,
          ucCount: 0,
          ucRate: 0,
          totalIncome: 0,
        },
        adpMapping: {
          isMapped: true,
          mappedCount: 2,
          items: [],
        },
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        items: [],
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1?ds1=2026-10-01&ds2=2026-10-31&cardFilter=WITH_LAB'
      )
      const res = await service231GET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(RcmViralHepatitisService.getViralHepatitisReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'WITH_LAB',
        })
      )
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/viral-hepatitis/vn-details', () => {
    it('returns 400 when VN is invalid or missing', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/vn-details?vn=')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 404 when clinical details not found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/vn-details?vn=691001083000')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 with details when valid VN is found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '691001083000',
        hn: '0012345',
        ptname: 'นายสมชาย ใจดี',
        vstdate: '2026-10-01',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/viral-hepatitis/vn-details?vn=691001083000')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('691001083000')
    })
  })
})
