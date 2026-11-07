import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getReportRoute } from '../service-23-4/route'
import { GET as getVnDetailsRoute } from '../vn-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmHepatitisCService } from '@/lib/clinical/rcmHepatitisCService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth')
vi.mock('@/lib/clinical/rcmHepatitisCService')
vi.mock('@/lib/clinical/rcmDashboardService')
vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

describe('Hepatitis C 23.4 API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/hepatitis-c/service-23-4', () => {
    it('returns 401 when user is not logged in', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4')
      const res = await getReportRoute(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 when user has insufficient role', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: 'user-1',
        username: 'guest',
        role: 'user',
        email: 'guest@example.com',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4')
      const res = await getReportRoute(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('returns 400 when date parameter format is invalid', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: 'user-1',
        username: 'staff1',
        role: 'staff',
        email: 'staff@example.com',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4?ds1=invalid-date'
      )
      const res = await getReportRoute(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('returns 200 with report data on successful query', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: 'user-1',
        username: 'staff1',
        role: 'staff',
        email: 'staff@example.com',
      } as any)

      const mockResult: any = {
        title: '23.4 ตรวจยืนยันไวรัสตับ C HCV RNA',
        adpCode: '36333',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        items: [],
        summary: {},
      }
      vi.mocked(RcmHepatitisCService.getHepatitisCReport).mockResolvedValue(mockResult)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4?ds1=2026-10-01&ds2=2026-10-31&cardFilter=WITH_LAB'
      )
      const res = await getReportRoute(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('23.4 ตรวจยืนยันไวรัสตับ C HCV RNA')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/hepatitis-c/vn-details', () => {
    it('returns 400 for empty or invalid VN', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: 'user-1',
        username: 'staff1',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/vn-details?vn=')
      const res = await getVnDetailsRoute(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 404 when clinical details not found', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: 'user-1',
        username: 'staff1',
        role: 'staff',
      } as any)

      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/vn-details?vn=691001083000'
      )
      const res = await getVnDetailsRoute(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 with details when VN found', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: 'user-1',
        username: 'staff1',
        role: 'staff',
      } as any)

      const mockDetails: any = {
        header: { vn: '691001083000', hn: '0012345', ptname: 'นายสมชาย' },
        screen: { bps: 120, bpd: 80 },
        diagnoses: [],
        orders: { items: [], categories: [] },
      }
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(mockDetails)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/hepatitis-c/vn-details?vn=691001083000'
      )
      const res = await getVnDetailsRoute(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.header.vn).toBe('691001083000')
    })
  })
})
