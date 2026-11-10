import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getService201 } from '../service-20-1/route'
import { GET as getVnDetails } from '../vn-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmFluorideVarnishService } from '@/lib/clinical/rcmFluorideVarnishService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmFluorideVarnishService', () => ({
  RcmFluorideVarnishService: {
    getFluorideVarnishReport: vi.fn(),
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

describe('Fluoride Varnish API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1', () => {
    it('returns 401 when user is unauthenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1')
      const res = await getService201(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 when user has insufficient role', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'guest',
        role: 'guest',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1')
      const res = await getService201(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('returns 400 for invalid query parameters', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'dentist1',
        role: 'staff',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1?ds1=invalid-date'
      )
      const res = await getService201(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('returns 200 with report data for valid request', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'dentist1',
        role: 'staff',
      } as any)

      const mockResult = {
        title: '20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)',
        adpCode: '15001',
        totalCount: 5,
        items: [],
      }
      vi.mocked(RcmFluorideVarnishService.getFluorideVarnishReport).mockResolvedValue(
        mockResult as any
      )

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1?ds1=2026-10-01&ds2=2026-10-31'
      )
      const res = await getService201(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.title).toBe(mockResult.title)
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/fluoride-varnish/vn-details', () => {
    it('returns 400 for invalid or missing VN', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff1',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/vn-details')
      const res = await getVnDetails(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 404 when VN clinical details are not found', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff1',
        role: 'staff',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/vn-details?vn=691001083000'
      )
      const res = await getVnDetails(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 with details when VN exists', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff1',
        role: 'staff',
      } as any)
      const mockDetails = { vn: '691001083000', hn: '0000001', ptname: 'ทดสอบ' }
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(mockDetails as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/fluoride-varnish/vn-details?vn=691001083000'
      )
      const res = await getVnDetails(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('691001083000')
    })
  })
})
