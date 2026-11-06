import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmAncService', () => ({
  RcmAncService: {
    getAncService23Report: vi.fn(),
    getService30011Report: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { RcmAncService } from '@/lib/clinical/rcmAncService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { GET as getService23 } from '../service-2-3/route'
import { GET as getService30011 } from '../service-30011/route'
import { GET as getVnDetails } from '../vn-details/route'

describe('ANC API Routes (/api/service/dashboard-rcm/funds/anc/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated access with 401', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const res = await getService30011(
      new Request('http://localhost/api/service/dashboard-rcm/funds/anc/service-30011')
    )
    expect(res.status).toBe(401)
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'guest01',
      email: 'guest@example.local',
      role: 'guest' as never,
    } as never)

    const res = await getService30011(
      new Request('http://localhost/api/service/dashboard-rcm/funds/anc/service-30011')
    )
    expect(res.status).toBe(403)
  })

  it('validates GET query parameters and logs audit on service-30011', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'doctor01',
      email: 'doctor@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmAncService.getService30011Report).mockResolvedValue({
      ds1: '2026-05-01',
      ds2: '2026-05-31',
      compensationFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 15,
        uniquePatients: 12,
        compensatedVisits: 10,
        uncompensatedVisits: 5,
        compensationRate: 66.7,
        totalCompensated: 3600,
        averageCompensated: 360,
        withAuthenCount: 14,
        withoutAuthenCount: 1,
        withPdxCount: 15,
        withOpCount: 12,
      },
      adpMapping: {
        isMapped: true,
        mappedCount: 1,
        items: [{ icode: '3002538', name: 'ANC Service 30011', strength: null, nhso_adp_code: '30011' }],
      },
      totalCount: 15,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService30011(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/anc/service-30011?ds1=2026-05-01&ds2=2026-05-31&compensationFilter=ALL'
      )
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalVisits).toBe(15)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_anc_2_4_service_30011',
      expect.stringContaining('Viewed ANC 2.4 30011 service report'),
      expect.objectContaining({ username: 'doctor01' })
    )
  })

  it('validates VN parameter and returns clinical details in vn-details route', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'staff01',
      email: 'staff@thoen.moph.go.th',
      role: 'member',
    } as never)

    vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
      header: {
        vn: '6901010001',
        hn: '0001111',
        cid: '1234567890123',
        ptname: 'นาง สมพร มีสุข',
        age: 28,
        sex: 'หญิง',
        vstdate: '2026-05-15',
        vsttime: '09:00:00',
        pttypename: 'UC',
        department: 'OPD',
        clinic: 'ANC',
      },
      screen: {
        bw: 55,
        height: 158,
        bmi: 22,
        bps: 110,
        bpd: 70,
        pulse: 76,
        rr: 18,
        temperature: 36.5,
        spo2: null,
        fbs: null,
        cc: 'มาฝากครรภ์และตรวจฟันตามนัด',
        hpi: null,
        pmh: null,
        pe: null,
        screen_dep: null,
        screen_dep_name: null,
        symptom: null,
      },
      diagnoses: [
        {
          icd10: 'Z340',
          icd_name: 'Normal pregnancy',
          diagtype: '1',
          diagtype_name: 'Principal Dx',
          doctor_name: null,
        },
      ],
      orders: {
        items: [],
        categories: [],
        total_price: 0,
        total_items: 0,
        total_paid: 0,
        total_claim: 0,
      },
    })

    const res = await getVnDetails(
      new Request('http://localhost/api/service/dashboard-rcm/funds/anc/vn-details?vn=6901010001')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.header.vn).toBe('6901010001')
    expect(json.data.diagnoses[0].icd10).toBe('Z340')
  })
})
