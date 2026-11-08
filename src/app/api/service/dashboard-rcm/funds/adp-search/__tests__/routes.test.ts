import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getAdpSearch } from '../route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmAdpSearchService } from '@/lib/clinical/rcmAdpSearchService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmAdpSearchService', () => ({
  RcmAdpSearchService: {
    getAdpSearchReport: vi.fn(),
    getAvailableAdpCodes: vi.fn(),
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

describe('ADP Search API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/adp-search', () => {
    it('returns 401 when user is not authenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/adp-search')
      const res = await getAdpSearch(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 when user does not have permission', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: 1,
        username: 'guest',
        role: 'guest',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/adp-search')
      const res = await getAdpSearch(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('returns available options when options=true', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: 1,
        username: 'officer1',
        role: 'staff',
      } as any)

      vi.mocked(RcmAdpSearchService.getAvailableAdpCodes).mockResolvedValue([
        { code: '14001', title: 'Ferrous', category: 'ยา' },
      ])

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/adp-search?options=true')
      const res = await getAdpSearch(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual([
        { code: '14001', title: 'Ferrous', category: 'ยา' },
      ])
      expect(RcmAdpSearchService.getAvailableAdpCodes).toHaveBeenCalled()
    })

    it('returns report data successfully', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        id: 1,
        username: 'officer1',
        role: 'staff',
      } as any)

      vi.mocked(RcmAdpSearchService.getAdpSearchReport).mockResolvedValue({
        patientType: 'OPD',
        adpCode: '14001, 12003',
        ds1: '2024-10-01',
        ds2: '2025-09-30',
        cardFilter: 'ALL',
        search: '',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
        totalCount: 1,
        totalPages: 1,
        summary: {} as any,
        adpMapping: {} as any,
        items: [],
      })

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/adp-search?patientType=OPD&adpCode=14001%2C+12003'
      )
      const res = await getAdpSearch(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.adpCode).toBe('14001, 12003')
      expect(RcmAdpSearchService.getAdpSearchReport).toHaveBeenCalledWith(
        expect.objectContaining({
          patientType: 'OPD',
          adpCode: '14001, 12003',
        })
      )
    })
  })
})
