import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getRecipients } from '../recipients/route'
import { GET as getVnDetails } from '../vn-details/route'
import { GET as getAnDetails } from '../an-details/route'
import { GET as getAdpCheck } from '../adp-check/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmStreptokinaseService } from '@/lib/clinical/rcmStreptokinaseService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/clinical/rcmStreptokinaseService', () => ({
  RcmStreptokinaseService: {
    getStreptokinaseReport: vi.fn(),
    getAnClinicalDetails: vi.fn(),
    checkAdpMapping: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

describe('Streptokinase API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/streptokinase/recipients', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
      const res = await getRecipients(
        new Request('http://localhost/api/service/dashboard-rcm/funds/streptokinase/recipients')
      )
      expect(res.status).toBe(401)
    })

    it('returns report data when session is valid', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
        displayName: 'Staff',
      } as any)

      vi.mocked(RcmStreptokinaseService.getStreptokinaseReport).mockResolvedValue({
        title: 'กองทุนยา Streptokinase',
        subtitle: 'รายชื่อรับยา Streptokinase',
        patientType: 'OPD',
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        adpMapping: { adpCode: 'STEMI', isMapped: true, mappedCount: 1, items: [] },
        cardFilter: 'ALL',
        search: '',
        sortBy: 'date',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 1,
        summary: {} as any,
        items: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/streptokinase/recipients?patientType=OPD&ds1=2026-10-01&ds2=2027-09-30&cardFilter=ALL'
      )
      const res = await getRecipients(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.patientType).toBe('OPD')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/streptokinase/vn-details', () => {
    it('returns 400 for missing vn', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/streptokinase/vn-details')
      const res = await getVnDetails(req)
      expect(res.status).toBe(400)
    })

    it('returns clinical details for valid vn', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)

      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '691015123456',
        hn: '0012345',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/streptokinase/vn-details?vn=691015123456'
      )
      const res = await getVnDetails(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.vn).toBe('691015123456')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/streptokinase/an-details', () => {
    it('returns 400 for missing an', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/streptokinase/an-details')
      const res = await getAnDetails(req)
      expect(res.status).toBe(400)
    })

    it('returns admission details for valid an', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)

      vi.mocked(RcmStreptokinaseService.getAnClinicalDetails).mockResolvedValue({
        header: { an: '690001234' },
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/streptokinase/an-details?an=690001234'
      )
      const res = await getAnDetails(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.header.an).toBe('690001234')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/streptokinase/adp-check', () => {
    it('returns mapping check result', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)

      vi.mocked(RcmStreptokinaseService.checkAdpMapping).mockResolvedValue({
        adpCode: 'STEMI',
        isMapped: true,
        mappedCount: 1,
        items: [],
      })

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/streptokinase/adp-check')
      const res = await getAdpCheck(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.isMapped).toBe(true)
    })
  })
})
