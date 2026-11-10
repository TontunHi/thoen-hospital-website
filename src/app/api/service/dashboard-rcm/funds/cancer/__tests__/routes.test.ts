import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getAdpReport } from '../adp/route'
import { GET as getVnDetails } from '../vn-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmCancerFundService } from '@/lib/clinical/rcmCancerFundService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/clinical/rcmCancerFundService', () => ({
  RcmCancerFundService: {
    getCancerPatientsReport: vi.fn(),
    checkAdpMapping: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

describe('Cancer Fund API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/cancer/adp', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
      const res = await getAdpReport(
        new Request('http://localhost/api/service/dashboard-rcm/funds/cancer/adp')
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when user does not have required role', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'guest',
        role: 'guest',
        email: 'guest@thoen.hospital',
        displayName: 'Guest',
      } as any)
      const res = await getAdpReport(
        new Request('http://localhost/api/service/dashboard-rcm/funds/cancer/adp')
      )
      expect(res.status).toBe(403)
    })

    it('returns 200 with report data when authenticated as staff/member/admin', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
        displayName: 'Staff',
      } as any)

      vi.mocked(RcmCancerFundService.getCancerPatientsReport).mockResolvedValue({
        title: 'กองทุนมะเร็ง',
        categoryTitle: 'กองทุนมะเร็ง',
        subTitle: 'รายชื่อผู้ป่วย จาก ADP (CANCER)',
        adpCode: 'CANCER',
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        adpMapping: { adpCode: 'CANCER', isMapped: true, mappedCount: 1, items: [] },
        cardFilter: 'ALL',
        statusFilter: 'HAS_REP',
        statusOptions: ['- :: ยังไม่ได้ส่ง', 'NHSO :: ได้รับ Invoice แล้ว'],
        ucOnly: false,
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        summary: {} as any,
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        items: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/cancer/adp?ds1=2026-10-01&ds2=2027-09-30&cardFilter=ALL&statusFilter=HAS_REP'
      )
      const res = await getAdpReport(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.categoryTitle).toBe('กองทุนมะเร็ง')
      expect(RcmCancerFundService.getCancerPatientsReport).toHaveBeenCalledWith(
        expect.objectContaining({ statusFilter: 'HAS_REP' })
      )
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/cancer/vn-details', () => {
    it('returns 400 for invalid or missing vn', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
        displayName: 'Staff',
      } as any)

      const res = await getVnDetails(
        new Request('http://localhost/api/service/dashboard-rcm/funds/cancer/vn-details?vn=12')
      )
      expect(res.status).toBe(400)
    })

    it('returns 200 when vn exists', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
        displayName: 'Staff',
      } as any)

      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '691001083001',
        hn: '0000001',
        ptname: 'นาย สมชาย รักดี',
      } as any)

      const res = await getVnDetails(
        new Request('http://localhost/api/service/dashboard-rcm/funds/cancer/vn-details?vn=691001083001')
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.vn).toBe('691001083001')
    })
  })
})
