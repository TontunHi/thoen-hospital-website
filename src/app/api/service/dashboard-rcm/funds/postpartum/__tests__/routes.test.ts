import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmPostpartumService', () => ({
  RcmPostpartumService: {
    getService72Report: vi.fn(),
    getService30016Report: vi.fn(),
    check72AdpMapping: vi.fn(),
    check30016AdpMapping: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { RcmPostpartumService } from '@/lib/clinical/rcmPostpartumService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { GET as getService30015 } from '../service-30015/route'
import { GET as getService30016 } from '../service-30016/route'
import { GET as getVnDetails } from '../vn-details/route'

describe('Postpartum API Routes (/api/service/dashboard-rcm/funds/postpartum/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated access with 401', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const res = await getService30016(
      new Request('http://localhost/api/service/dashboard-rcm/funds/postpartum/service-30016')
    )
    expect(res.status).toBe(401)
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'guest01',
      email: 'guest@example.local',
      role: 'guest' as never,
    } as never)

    const res = await getService30016(
      new Request('http://localhost/api/service/dashboard-rcm/funds/postpartum/service-30016')
    )
    expect(res.status).toBe(403)
  })

  it('validates query parameters and returns 200 with data on service-30016', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'nurse01',
      email: 'nurse@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmPostpartumService.getService30016Report).mockResolvedValue({
      ds1: '2024-10-01',
      ds2: '2024-10-31',
      compensationFilter: 'ALL',
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
        totalCompensated: 2880,
        averageCompensated: 360,
        withAuthenCount: 10,
        withoutAuthenCount: 0,
        withPdxCount: 10,
        withOpCount: 5,
      },
      adpMapping: {
        isMapped: true,
        mappedCount: 2,
        items: [
          { icode: '1540013', name: 'triferdine', strength: '0.15', nhso_adp_code: '30016' },
        ],
      },
      totalCount: 10,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService30016(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/postpartum/service-30016?ds1=2024-10-01&ds2=2024-10-31'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalVisits).toBe(10)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_postpartum_7_3_service_30016',
      expect.stringContaining('2024-10-01 to 2024-10-31'),
      expect.objectContaining({ username: 'nurse01' })
    )
  })

  it('validates invalid query parameter format with 400', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'nurse01',
      email: 'nurse@thoen.moph.go.th',
      role: 'staff',
    } as never)

    const res = await getService30016(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/postpartum/service-30016?ds1=invalid-date'
      )
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PARAMS')
  })

  it('handles vn-details route with validation and data return', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'nurse01',
      email: 'nurse@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
      vn: '671002083018',
      hn: '0005401',
      ptname: 'น.ส.สิรินทรา',
      prescriptions: [],
      diagnoses: [],
      procedures: [],
    } as never)

    const res = await getVnDetails(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/postpartum/vn-details?vn=671002083018'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.vn).toBe('671002083018')
  })

  it('rejects invalid vn with 400 in vn-details', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'nurse01',
      email: 'nurse@thoen.moph.go.th',
      role: 'staff',
    } as never)

    const res = await getVnDetails(
      new Request('http://localhost/api/service/dashboard-rcm/funds/postpartum/vn-details?vn=')
    )
    expect(res.status).toBe(400)
  })

  it('validates query parameters and returns 200 with data on service-30015', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'nurse01',
      email: 'nurse@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmPostpartumService.getService72Report).mockResolvedValue({
      ds1: '2024-10-01',
      ds2: '2024-10-31',
      compensationFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 5,
        uniquePatients: 5,
        compensatedVisits: 4,
        uncompensatedVisits: 1,
        compensationRate: 80,
        totalCompensated: 1440,
        averageCompensated: 360,
        withAuthenCount: 5,
        withoutAuthenCount: 0,
        withPdxCount: 5,
        withOpCount: 2,
      },
      adpMapping: {
        isMapped: true,
        mappedCount: 1,
        items: [],
      },
      totalCount: 5,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService30015(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/postpartum/service-30015?ds1=2024-10-01&ds2=2024-10-31'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalVisits).toBe(5)
  })
})
