import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as service171GET } from '../service-17-1/route'
import { GET as vnDetailsGET } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmAnemiaScreeningService } from '@/lib/clinical/rcmAnemiaScreeningService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmAnemiaScreeningService', () => ({
  RcmAnemiaScreeningService: {
    getAnemiaScreeningReport: vi.fn(),
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

describe('Anemia Screening Funds API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/anemia-screening/service-17-1', () => {
    it('returns 401 when user is unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/anemia-screening/service-17-1')
      const res = await service171GET(req)
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
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/anemia-screening/service-17-1')
      const res = await service171GET(req)
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
        'http://localhost/api/service/dashboard-rcm/funds/anemia-screening/service-17-1?ds1=invalid-date'
      )
      const res = await service171GET(req)
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
      vi.mocked(RcmAnemiaScreeningService.getAnemiaScreeningReport).mockResolvedValue({
        adpCode: '13001',
        title: '17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        items: [],
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/anemia-screening/service-17-1?ds1=2026-10-01&ds2=2026-10-31&cardFilter=TARGET_AGE'
      )
      const res = await service171GET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.adpCode).toBe('13001')
      expect(RcmAnemiaScreeningService.getAnemiaScreeningReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'TARGET_AGE',
        })
      )
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/anemia-screening/vn-details', () => {
    it('returns 400 for invalid VN', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/anemia-screening/vn-details?vn=')
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
        'http://localhost/api/service/dashboard-rcm/funds/anemia-screening/vn-details?vn=691001083000'
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
        'http://localhost/api/service/dashboard-rcm/funds/anemia-screening/vn-details?vn=691001083000'
      )
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('691001083000')
    })
  })
})
