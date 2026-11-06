import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getService121 } from '../service-12-1/route'
import { GET as getVnDetails } from '../vn-details/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmOralCancerService } from '@/lib/clinical/rcmOralCancerService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmOralCancerService', () => ({
  RcmOralCancerService: {
    getOralCancerReport: vi.fn(),
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

describe('Oral Cancer API Routes (12.1 ADP 90004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/oral-cancer/service-12-1', () => {
    it('returns 401 when user is not authenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/oral-cancer/service-12-1')
      const res = await getService121(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 when user does not have hospital staff role', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'guest_user',
        email: 'guest@example.com',
        role: 'user',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/oral-cancer/service-12-1')
      const res = await getService121(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('returns 400 when invalid query parameters are supplied', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer1',
        email: 'officer@example.com',
        role: 'staff',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/oral-cancer/service-12-1?ds1=invalid-date'
      )
      const res = await getService121(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('returns 200 with oral cancer data on valid authenticated request', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer1',
        email: 'officer@example.com',
        role: 'staff',
      } as any)

      const mockResult = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        adpMapping: { isMapped: true, mappedCount: 1, items: [] },
        cardFilter: 'ALL',
        ucOnly: false,
        searchField: 'ALL',
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        summary: {
          totalVisits: 10,
          uniquePatients: 9,
          compensatedVisits: 8,
          uncompensatedVisits: 2,
          compensationRate: 80,
          totalCompensated: 1200,
          averageCompensated: 150,
          withAuthenCount: 10,
          withoutAuthenCount: 0,
          authenRate: 100,
          ucCount: 10,
          ucRate: 100,
          totalIncome: 3000,
        },
        totalCount: 10,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        items: [],
      }
      vi.mocked(RcmOralCancerService.getOralCancerReport).mockResolvedValue(mockResult as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/oral-cancer/service-12-1?ds1=2026-10-01&ds2=2026-10-31'
      )
      const res = await getService121(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.summary.totalVisits).toBe(10)
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/oral-cancer/vn-details', () => {
    it('returns 400 when vn parameter is missing', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer1',
        email: 'officer@example.com',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/oral-cancer/vn-details')
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns 200 with VN clinical details when found', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: '1',
        username: 'officer1',
        email: 'officer@example.com',
        role: 'staff',
      } as any)

      const mockDetails = {
        vn: '691001083000',
        hn: '0012345',
        ptname: 'นายสมชาย ใจดี',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        department: 'ทันตกรรม',
      }
      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(mockDetails as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/oral-cancer/vn-details?vn=691001083000')
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.hn).toBe('0012345')
    })
  })
})
