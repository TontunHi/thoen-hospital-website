import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as service182GET } from '../service-18-2/route'
import { GET as vnDetailsGET } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmIronSupplementsService } from '@/lib/clinical/rcmIronSupplementsService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmIronSupplementsService', () => ({
  RcmIronSupplementsService: {
    getIronSupplementsReport: vi.fn(),
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

describe('Iron Supplements Funds API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/iron-supplements/service-18-2', () => {
    it('returns 401 when user is unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/iron-supplements/service-18-2')
      const res = await service182GET(req)
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
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/iron-supplements/service-18-2')
      const res = await service182GET(req)
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
        'http://localhost/api/service/dashboard-rcm/funds/iron-supplements/service-18-2?ds1=invalid-date'
      )
      const res = await service182GET(req)
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
      vi.mocked(RcmIronSupplementsService.getIronSupplementsReport).mockResolvedValue({
        adpCode: '14001',
        categoryTitle: 'บริการยาเม็ดเสริมธาตุเหล็ก อายุ 13-45 ปี ADP + Drug',
        title: '18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        items: [],
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/iron-supplements/service-18-2?ds1=2026-10-01&ds2=2026-10-31&cardFilter=WITH_ADP'
      )
      const res = await service182GET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.adpCode).toBe('14001')
      expect(RcmIronSupplementsService.getIronSupplementsReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'WITH_ADP',
        })
      )
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/iron-supplements/vn-details', () => {
    it('returns 400 for invalid VN', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/iron-supplements/vn-details?vn=')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 404 when VN is not found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/iron-supplements/vn-details?vn=691001083000'
      )
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 with details when VN is found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '691001083000',
        hn: '0000001',
        ptname: 'น.ส. สมหญิง สดใส',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/iron-supplements/vn-details?vn=691001083000'
      )
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('691001083000')
    })
  })
})
