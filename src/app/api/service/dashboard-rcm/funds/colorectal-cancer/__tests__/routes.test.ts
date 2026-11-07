import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as service212GET } from '../service-21-2/route'
import { GET as vnDetailsGET } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmColorectalCancerService } from '@/lib/clinical/rcmColorectalCancerService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmColorectalCancerService', () => ({
  RcmColorectalCancerService: {
    getColorectalCancerReport: vi.fn(),
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

describe('Colorectal Cancer (Fit test 21.2) API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2', () => {
    it('returns 401 when user is unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2')
      const res = await service212GET(req)
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
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2')
      const res = await service212GET(req)
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
        'http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2?ds1=invalid-date'
      )
      const res = await service212GET(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('returns 200 with data when params are valid', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)

      const mockResult: any = {
        adpCode: '90005',
        title: '21.2 รายชื่อผู้รับบริการ ADP (90005)',
        totalCount: 1,
        items: [],
      }
      vi.mocked(RcmColorectalCancerService.getColorectalCancerReport).mockResolvedValue(mockResult)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2?cardFilter=COMPLETE&page=1&pageSize=50'
      )
      const res = await service212GET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('21.2 รายชื่อผู้รับบริการ ADP (90005)')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/colorectal-cancer/vn-details', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/vn-details?vn=670101080001')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('returns 400 when invalid VN format', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/vn-details?vn=bad!')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 404 when VN is not found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/vn-details?vn=670101080001')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 with VN clinical details', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      const mockDetails: any = {
        vn: '670101080001',
        hn: '0001234',
        patientName: 'นายสมชาย มั่นคง',
      }
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(mockDetails)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/colorectal-cancer/vn-details?vn=670101080001')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('670101080001')
    })
  })
})
