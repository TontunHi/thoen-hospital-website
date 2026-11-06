import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmThalassemiaService', () => ({
  RcmThalassemiaService: {
    getThalassemiaReport: vi.fn(),
    checkThalassemiaAdpMapping: vi.fn(),
  },
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { RcmThalassemiaService } from '@/lib/clinical/rcmThalassemiaService'
import { GET as getService31 } from '../service-31/route'

describe('Thalassemia API Routes (/api/service/dashboard-rcm/funds/thalassemia/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated access with 401', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const res = await getService31(
      new Request('http://localhost/api/service/dashboard-rcm/funds/thalassemia/service-31')
    )
    expect(res.status).toBe(401)
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'guest01',
      email: 'guest@example.local',
      role: 'guest' as never,
    } as never)

    const res = await getService31(
      new Request('http://localhost/api/service/dashboard-rcm/funds/thalassemia/service-31')
    )
    expect(res.status).toBe(403)
  })

  it('validates GET query parameters, logs audit and returns data on valid access', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'doctor01',
      email: 'doctor@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmThalassemiaService.getThalassemiaReport).mockResolvedValue({
      ds1: '2026-05-01',
      ds2: '2026-05-31',
      cardFilter: 'ALL',
      laborTypeFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'labor_date',
      sortOrder: 'desc',
      summary: {
        totalMothers: 10,
        screenedCount: 8,
        unscreenedCount: 2,
        screeningRate: 80,
        normalCount: 7,
        riskCount: 1,
        pendingCount: 0,
        thoenHospitalCount: 9,
        otherHospitalCount: 1,
        normalLaborCount: 8,
        cesareanLaborCount: 2,
        otherLaborCount: 0,
      },
      adpMapping: {
        isMapped: true,
        mappedCount: 2,
        items: [
          { icode: '3000748', name: 'DCIP', strength: '', nhso_adp_code: '30313' },
          { icode: '3000227', name: 'Hemoglobin typing', strength: '', nhso_adp_code: '30313' },
        ],
      },
      totalCount: 10,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService31(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/thalassemia/service-31?ds1=2026-05-01&ds2=2026-05-31&cardFilter=ALL'
      )
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalMothers).toBe(10)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_thalassemia_3_1',
      expect.stringContaining('Viewed Thalassemia screening in pregnancy report (3.1)'),
      expect.objectContaining({ username: 'doctor01' })
    )
  })
})
