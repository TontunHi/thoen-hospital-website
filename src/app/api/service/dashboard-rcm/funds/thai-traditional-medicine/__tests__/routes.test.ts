import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getTopic3 } from '../3/route'
import { GET as getTopic11 } from '../11/route'
import { GET as getHerbalDrugs } from '../herbal-drugs/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThaiTraditionalMedicineService } from '@/lib/clinical/rcmThaiTraditionalMedicineService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmThaiTraditionalMedicineService', () => ({
  RcmThaiTraditionalMedicineService: {
    getReportTopic3: vi.fn(),
    getReportTopic11: vi.fn(),
    getVnHerbalDrugs: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Thai Traditional Medicine API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/thai-traditional-medicine/3', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/thai-traditional-medicine/3')
      const res = await getTopic3(req)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 200 with report data for valid session', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff01',
        email: 'staff01@thoen.hospital',
        role: 'staff',
      } as any)

      vi.mocked(RcmThaiTraditionalMedicineService.getReportTopic3).mockResolvedValue({
        title: 'รายชื่อผู้รับบริการแพทย์แผนไทยรวม',
        categoryTitle: 'บริการแพทย์แผนไทย และการแพทย์ทางเลือก',
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        cardFilter: 'ALL',
        place: 'ALL',
        ucOnly: false,
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
        totalCount: 1,
        totalPages: 1,
        summary: {} as any,
        items: [] as any,
      })

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/thai-traditional-medicine/3?ds1=2026-10-01&ds2=2027-09-30')
      const res = await getTopic3(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.title).toContain('รายชื่อผู้รับบริการแพทย์แผนไทยรวม')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/thai-traditional-medicine/11', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/thai-traditional-medicine/11')
      const res = await getTopic11(req)
      expect(res.status).toBe(401)
    })

    it('returns 200 with report data for valid session', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff01',
        email: 'staff01@thoen.hospital',
        role: 'staff',
      } as any)

      vi.mocked(RcmThaiTraditionalMedicineService.getReportTopic11).mockResolvedValue({
        title: 'รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ',
        categoryTitle: 'บริการแพทย์แผนไทย และการแพทย์ทางเลือก',
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        cardFilter: 'ALL',
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
        totalCount: 1,
        totalPages: 1,
        summary: {} as any,
        items: [] as any,
      })

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/thai-traditional-medicine/11?ds1=2026-10-01&ds2=2027-09-30')
      const res = await getTopic11(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.title).toContain('รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/thai-traditional-medicine/herbal-drugs', () => {
    it('returns 400 when vn is missing or invalid', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff01',
        email: 'staff01@thoen.hospital',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/thai-traditional-medicine/herbal-drugs?vn=')
      const res = await getHerbalDrugs(req)
      expect(res.status).toBe(400)
    })

    it('returns 200 with herbal drugs list for valid vn', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff01',
        email: 'staff01@thoen.hospital',
        role: 'staff',
      } as any)

      vi.mocked(RcmThaiTraditionalMedicineService.getVnHerbalDrugs).mockResolvedValue([
        { drug: 'ฟ้าทะลายโจร 500 mg', qty: 30, units: 'แคปซูล', unitprice: 3, sumprice: 90 },
      ])

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/thai-traditional-medicine/herbal-drugs?vn=691001123456')
      const res = await getHerbalDrugs(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.length).toBe(1)
      expect(body.data[0].drug).toBe('ฟ้าทะลายโจร 500 mg')
    })
  })
})
