import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getService81 } from '../service-81/route'
import { GET as getVnDetails } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmPregnancyTestService } from '@/lib/clinical/rcmPregnancyTestService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmPregnancyTestService', () => ({
  RcmPregnancyTestService: {
    getPregnancyTestReport: vi.fn(),
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
    warn: vi.fn(),
  },
}))

describe('Pregnancy Test API Routes (8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/pregnancy-test/service-81', () => {
    it('returns 401 when user is not authenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/service-81')
      const res = await getService81(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 when user does not have permission', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'guest_user',
        email: 'guest@example.com',
        role: 'user',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/service-81')
      const res = await getService81(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('returns 400 when invalid query parameters are supplied', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff_user',
        email: 'staff@example.com',
        role: 'staff',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/service-81?cardFilter=INVALID_FILTER'
      )
      const res = await getService81(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('returns 200 and report data for valid authorized requests', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'admin_user',
        email: 'admin@example.com',
        role: 'admin',
      } as any)

      const mockResult = {
        ds1: '2026-05-01',
        ds2: '2026-05-31',
        totalCount: 1,
        items: [],
        summary: { totalVisits: 1 },
      }
      vi.mocked(RcmPregnancyTestService.getPregnancyTestReport).mockResolvedValue(mockResult as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/service-81?ds1=2026-05-01&ds2=2026-05-31&cardFilter=ALL'
      )
      const res = await getService81(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.ds1).toBe('2026-05-01')
      expect(RcmPregnancyTestService.getPregnancyTestReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-05-01',
          ds2: '2026-05-31',
          cardFilter: 'ALL',
        })
      )
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/pregnancy-test/vn-details', () => {
    it('returns 400 when vn parameter is missing or invalid', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff_user',
        email: 'staff@example.com',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/vn-details')
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 404 when clinical details not found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff_user',
        email: 'staff@example.com',
        role: 'staff',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/vn-details?vn=6705010001'
      )
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 and clinical details when found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff_user',
        email: 'staff@example.com',
        role: 'staff',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '6705010001',
        hn: '0010001',
        ptname: 'น.ส. สมฤดี ทดสอบ',
        vitals: {},
        diagnoses: [],
        drugs: [],
        labs: [],
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/pregnancy-test/vn-details?vn=6705010001'
      )
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('6705010001')
    })
  })
})
