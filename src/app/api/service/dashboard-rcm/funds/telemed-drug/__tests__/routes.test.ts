import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as telemedGET } from '../telemed/route'
import { GET as postalDrugGET } from '../postal-drug/route'
import { GET as vnDetailsGET } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmTelemedDrugService } from '@/lib/clinical/rcmTelemedDrugService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmTelemedDrugService', () => ({
  RcmTelemedDrugService: {
    getTelemedReport: vi.fn(),
    getPostalDrugReport: vi.fn(),
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

describe('Telemed & Drug Funds API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/telemed-drug/telemed', () => {
    it('returns 401 when user is unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/telemed-drug/telemed')
      const res = await telemedGET(req)
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
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/telemed-drug/telemed')
      const res = await telemedGET(req)
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
        'http://localhost/api/service/dashboard-rcm/funds/telemed-drug/telemed?ds1=invalid-date'
      )
      const res = await telemedGET(req)
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
      vi.mocked(RcmTelemedDrugService.getTelemedReport).mockResolvedValue({
        adpCode: 'TELMED',
        categoryTitle: 'ระบบ Telemedicine & Drug',
        title: '11.53 รายชื่อผู้ได้รับบริการ TelMed',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        items: [],
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/telemed-drug/telemed?ds1=2026-10-01&ds2=2026-10-31&cardFilter=WITH_PRICE'
      )
      const res = await telemedGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('11.53 รายชื่อผู้ได้รับบริการ TelMed')
      expect(RcmTelemedDrugService.getTelemedReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'WITH_PRICE',
        })
      )
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/telemed-drug/postal-drug', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/telemed-drug/postal-drug')
      const res = await postalDrugGET(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('returns 200 with postal drug report data for valid request', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmTelemedDrugService.getPostalDrugReport).mockResolvedValue({
        adpCode: 'DRUGP',
        categoryTitle: 'ระบบ Telemedicine & Drug',
        title: '11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        items: [],
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/telemed-drug/postal-drug?ds1=2026-10-01&ds2=2026-10-31'
      )
      const res = await postalDrugGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์')
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/telemed-drug/vn-details', () => {
    it('returns 400 when VN is invalid or missing', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/telemed-drug/vn-details?vn=')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 200 with VN details when valid VN is queried', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'staff_user',
        role: 'staff',
        email: 'staff@test.com',
      } as any)
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '6911070001',
        hn: '0012345',
        vstdate: '2026-11-07',
        vsttime: '08:30:00',
        cc: 'มาตรวจตามนัด รับยาทางไปรษณีย์',
        bps: 120,
        bpd: 80,
        pulse: 72,
        bw: 65,
        height: 165,
        bmi: 23.8,
        tt: 36.5,
        diagnosis: [],
        medications: [],
        procedures: [],
        xrays: [],
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/telemed-drug/vn-details?vn=6911070001')
      const res = await vnDetailsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('6911070001')
      expect(data.data.cc).toBe('มาตรวจตามนัด รับยาทางไปรษณีย์')
    })
  })
})
