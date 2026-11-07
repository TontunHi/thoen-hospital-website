import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getOpd } from '../opd/route'
import { GET as getIpd } from '../ipd/route'
import { GET as getVnDetails } from '../vn-details/route'
import { GET as getAnDetails } from '../an-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmThalassemiaFundService } from '@/lib/clinical/rcmThalassemiaFundService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/clinical/rcmThalassemiaFundService', () => ({
  RcmThalassemiaFundService: {
    getOpdReport: vi.fn(),
    getIpdReport: vi.fn(),
    getAnClinicalDetails: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

describe('Thalassemia Fund API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/thalassemia-fund/opd', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
      const res = await getOpd(new Request('http://localhost/api/service/dashboard-rcm/funds/thalassemia-fund/opd'))
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

      vi.mocked(RcmThalassemiaFundService.getOpdReport).mockResolvedValue({
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        cardFilter: 'ALL',
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 1,
        summary: {} as any,
        items: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/thalassemia-fund/opd?ds1=2026-10-01&ds2=2027-09-30&cardFilter=ALL'
      )
      const res = await getOpd(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.totalCount).toBe(0)
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/thalassemia-fund/ipd', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
      const res = await getIpd(new Request('http://localhost/api/service/dashboard-rcm/funds/thalassemia-fund/ipd'))
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

      vi.mocked(RcmThalassemiaFundService.getIpdReport).mockResolvedValue({
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        cardFilter: 'ALL',
        search: '',
        sortBy: 'dchdate',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 1,
        summary: {} as any,
        items: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/thalassemia-fund/ipd?ds1=2026-10-01&ds2=2027-09-30'
      )
      const res = await getIpd(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/thalassemia-fund/vn-details', () => {
    it('validates VN parameter and returns details', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        header: { vn: '691015123456' } as any,
        screen: null,
        diagnoses: [],
        orders: { items: [], categories: [], total_price: 0, total_items: 0, total_paid: 0, total_claim: 0 },
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/thalassemia-fund/vn-details?vn=691015123456'
      )
      const res = await getVnDetails(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.header.vn).toBe('691015123456')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/thalassemia-fund/an-details', () => {
    it('validates AN parameter and returns details', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'staff',
        role: 'staff',
      } as any)
      vi.mocked(RcmThalassemiaFundService.getAnClinicalDetails).mockResolvedValue({
        header: { an: '690001234' } as any,
        diagnoses: [],
        procedures: [],
        orders: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/thalassemia-fund/an-details?an=690001234'
      )
      const res = await getAnDetails(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.header.an).toBe('690001234')
    })
  })
})
