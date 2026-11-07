import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as get145 } from '../service-14-5/route'
import { GET as get146 } from '../service-14-6/route'
import { GET as getVnDetails } from '../vn-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmHealthScreeningService } from '@/lib/clinical/rcmHealthScreeningService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmHealthScreeningService', () => ({
  RcmHealthScreeningService: {
    getHealthScreeningReport: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Health Screening API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /service-14-5', () => {
    it('returns 401 when user is not authenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/health-screening/service-14-5')
      const res = await get145(req)
      const data = await res.json()
      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('returns 403 when user does not have permission', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'guest',
        role: 'guest' as any,
      } as any)
      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/health-screening/service-14-5')
      const res = await get145(req)
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
    })

    it('calls getHealthScreeningReport with 12003 and returns 200 for staff', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer',
        role: 'staff',
      } as any)

      vi.mocked(RcmHealthScreeningService.getHealthScreeningReport).mockResolvedValue({
        adpCode: '12003',
        title: 'FPG',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        fiscalStartYear: '2026-10-01',
        adpMapping: { adpCode: '12003', isMapped: true, mappedCount: 1, items: [] },
        cardFilter: 'ALL',
        ucOnly: false,
        targetAgeOnly: false,
        searchField: 'ALL',
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        summary: {
          totalVisits: 10,
          uniquePatients: 8,
          compensatedVisits: 5,
          uncompensatedVisits: 5,
          compensationRate: 50,
          totalCompensated: 500,
          averageCompensated: 100,
          repeatClaimCount: 1,
          repeatClaimRate: 10,
          withAuthenCount: 9,
          withoutAuthenCount: 1,
          authenRate: 90,
          ucCount: 8,
          ucRate: 80,
          targetAgeCount: 6,
          targetAgeRate: 60,
          totalIncome: 1000,
        },
        totalCount: 10,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        items: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/health-screening/service-14-5?ds1=2026-10-01&ds2=2026-10-31'
      )
      const res = await get145(req)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.adpCode).toBe('12003')
      expect(RcmHealthScreeningService.getHealthScreeningReport).toHaveBeenCalledWith(
        expect.objectContaining({
          adpCode: '12003',
          ds1: '2026-10-01',
          ds2: '2026-10-31',
        })
      )
    })
  })

  describe('GET /service-14-6', () => {
    it('calls getHealthScreeningReport with 12004 and returns 200 for staff', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer',
        role: 'staff',
      } as any)

      vi.mocked(RcmHealthScreeningService.getHealthScreeningReport).mockResolvedValue({
        adpCode: '12004',
        title: 'Cholesterol',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        fiscalStartYear: '2026-10-01',
        adpMapping: { adpCode: '12004', isMapped: true, mappedCount: 1, items: [] },
        cardFilter: 'ALL',
        ucOnly: false,
        targetAgeOnly: false,
        searchField: 'ALL',
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
        'http://localhost/api/service/dashboard-rcm/funds/health-screening/service-14-6?cardFilter=TARGET_AGE'
      )
      const res = await get146(req)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.adpCode).toBe('12004')
      expect(RcmHealthScreeningService.getHealthScreeningReport).toHaveBeenCalledWith(
        expect.objectContaining({
          adpCode: '12004',
          cardFilter: 'TARGET_AGE',
        })
      )
    })
  })

  describe('GET /vn-details', () => {
    it('returns 400 when vn is invalid', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/health-screening/vn-details?vn=12')
      const res = await getVnDetails(req)
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('returns clinical details when vn is found', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer',
        role: 'staff',
      } as any)

      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '691001083000',
        hn: '0012345',
        patientName: 'นายสมชาย ใจดี',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/health-screening/vn-details?vn=691001083000'
      )
      const res = await getVnDetails(req)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('691001083000')
    })
  })
})
