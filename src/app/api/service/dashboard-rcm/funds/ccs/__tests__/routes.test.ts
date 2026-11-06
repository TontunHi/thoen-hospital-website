import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmCervicalCancerService', () => ({
  RcmCervicalCancerService: {
    getTargetPopulationReport: vi.fn(),
    getScreenedRecipientsReport: vi.fn(),
    getService1B004NReport: vi.fn(),
    getService1B004PReport: vi.fn(),
    getService1B004_0NReport: vi.fn(),
    getService1B005Report: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { RcmCervicalCancerService } from '@/lib/clinical/rcmCervicalCancerService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { GET as getTargetPop, POST as postTargetPop } from '../target-population/route'
import { GET as getScreenedRecipients } from '../screened-recipients/route'
import { GET as getService1B004N } from '../service-1b004n/route'
import { GET as getService1B004P } from '../service-1b004p/route'
import { GET as getService1B004_0N } from '../service-1b004-0n/route'
import { GET as getService1B005 } from '../service-1b005/route'
import { GET as getVnDetails } from '../vn-details/route'

describe('CCS API Routes (/api/service/dashboard-rcm/funds/ccs/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated access with 401', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const res = await getTargetPop(
      new Request('http://localhost/api/service/dashboard-rcm/funds/ccs/target-population')
    )
    expect(res.status).toBe(401)
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 99,
      username: 'guest01',
      email: 'guest@example.local',
      role: 'guest',
    } as never)

    const res = await getTargetPop(
      new Request('http://localhost/api/service/dashboard-rcm/funds/ccs/target-population')
    )
    expect(res.status).toBe(403)
  })

  it('validates GET query parameters and logs throttled audit on valid access', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    const badRes = await getTargetPop(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/target-population?ds1=invalid-date'
      )
    )
    expect(badRes.status).toBe(400)

    vi.mocked(RcmCervicalCancerService.getTargetPopulationReport).mockResolvedValue({
      ds1: '2025-10-01',
      ds2: '2026-09-30',
      screeningFilter: 'SCREENED',
      typeareaFilter: '1_3',
      searchField: 'HN',
      sortBy: 'hn',
      sortOrder: 'asc',
      summary: {
        totalTarget: 100,
        typearea13Count: 100,
        screenedCount: 25,
        unscreenedCount: 75,
        coverageRate: 25,
        abnormalCount: 1,
        compensatedCount: 20,
        matchedSameDayCount: 18,
        matchedDiffDayCount: 2,
        repOnlyCount: 0,
        totalCompensated: 5000,
      },
      totalCount: 25,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const okRes = await getTargetPop(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/target-population?ds1=2025-10-01&ds2=2026-09-30&screeningFilter=SCREENED&typeareaFilter=1_3&searchField=HN'
      )
    )
    expect(okRes.status).toBe(200)
    expect(logThrottledAudit).toHaveBeenCalledTimes(1)
  })

  it('accepts POST extraRepRows with strict 13-digit CID validation', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    const badPost = await postTargetPop(
      new Request('http://localhost/api/service/dashboard-rcm/funds/ccs/target-population', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraRepRows: [{ cid: 'INVALID', comebackDate: '2026-01-10' }],
        }),
      })
    )
    expect(badPost.status).toBe(400)

    vi.mocked(RcmCervicalCancerService.getTargetPopulationReport).mockResolvedValue({
      ds1: '2025-10-01',
      ds2: '2026-09-30',
      screeningFilter: 'ALL',
      typeareaFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'hn',
      sortOrder: 'asc',
      summary: {
        totalTarget: 1,
        typearea13Count: 1,
        screenedCount: 1,
        unscreenedCount: 0,
        coverageRate: 100,
        abnormalCount: 0,
        compensatedCount: 1,
        matchedSameDayCount: 0,
        matchedDiffDayCount: 1,
        repOnlyCount: 0,
        totalCompensated: 0,
      },
      totalCount: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const okPost = await postTargetPop(
      new Request('http://localhost/service/target-population', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ds1: '2025-10-01',
          ds2: '2026-09-30',
          extraRepRows: [{ cid: '1000000000101', comebackDate: '2026-01-10' }],
        }),
      })
    )
    expect(okPost.status).toBe(200)
    expect(logThrottledAudit).toHaveBeenCalledTimes(1)
  })

  it('returns clinical VN details when authorized', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
      header: {
        vn: '690101080001',
        hn: '0000101',
        cid: '1000000000101',
        ptname: 'นาง สมมติ หนึ่ง',
        age: 41,
        sex: 'หญิง',
        vstdate: '2026-01-15',
        vsttime: '09:00:00',
        pttypename: 'บัตรทอง',
        department: 'ตรวจโรคทั่วไป',
        clinic: 'คลินิกคัดกรอง',
      },
      screen: null,
      diagnoses: [],
      orders: {
        items: [],
        categories: [],
        total_price: 450,
        total_items: 0,
        total_paid: 0,
        total_claim: 450,
      },
    })

    const res = await getVnDetails(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/vn-details?vn=690101080001'
      )
    )
    expect(res.status).toBe(200)
  })

  it('validates GET screened-recipients params, handles auth, and returns data', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    vi.mocked(RcmCervicalCancerService.getScreenedRecipientsReport).mockResolvedValue({
      ds1: '2024-10-01',
      ds2: '2025-09-30',
      methodFilter: 'ALL',
      okFilter: 'ALL',
      resultStatusFilter: 'ALL',
      compensationFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 10,
        uniquePatients: 9,
        okCount: 8,
        notOkCount: 2,
        papCount: 5,
        viaCount: 2,
        hpvCount: 3,
        colposcopyCount: 1,
        abnormalCount: 1,
        totalSeamlessCompensated: 2000,
        totalNhsoCompensated: 2000,
      },
      totalCount: 10,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getScreenedRecipients(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/screened-recipients?ds1=2024-10-01&ds2=2025-09-30&methodFilter=PapSmear'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalVisits).toBe(10)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_ccs_2_screened_recipients',
      expect.stringContaining('2024-10-01'),
      expect.any(Object)
    )
  })

  it('validates GET service-1b004n params, checks ADP mapping status, and returns report data', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    vi.mocked(RcmCervicalCancerService.getService1B004NReport).mockResolvedValue({
      ds1: '2025-10-01',
      ds2: '2026-09-30',
      adpMapping: {
        isMapped: true,
        mappedCount: 1,
        items: [
          {
            icode: '3009999',
            name: 'ตรวจ HPV DNA (1B004N)',
            strength: null,
            nhso_adp_code: '1B004N',
          },
        ],
      },
      compensationFilter: 'COMPENSATED',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 15,
        uniquePatients: 14,
        compensatedVisits: 12,
        uncompensatedVisits: 3,
        compensationRate: 80,
        totalCompensated: 9600,
        averageCompensated: 800,
        withAuthenCount: 15,
        withoutAuthenCount: 0,
        withPdxCount: 15,
        withOpCount: 12,
      },
      totalCount: 15,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService1B004N(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/service-1b004n?ds1=2025-10-01&ds2=2026-09-30&compensationFilter=COMPENSATED'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.adpMapping.isMapped).toBe(true)
    expect(json.data.summary.totalVisits).toBe(15)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_ccs_3_service_1b004n',
      expect.stringContaining('2025-10-01'),
      expect.any(Object)
    )
  })

  it('validates GET service-1b004-0n params, checks ADP mapping status, and returns report data', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    vi.mocked(RcmCervicalCancerService.getService1B004_0NReport).mockResolvedValue({
      ds1: '2025-10-01',
      ds2: '2026-09-30',
      adpMapping: {
        isMapped: true,
        mappedCount: 1,
        items: [
          {
            icode: '3009998',
            name: 'ตรวจคัดกรองมะเร็งปากมดลูก (1B004_0N)',
            strength: null,
            nhso_adp_code: '1B004_0N',
          },
        ],
      },
      compensationFilter: 'COMPENSATED',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 10,
        uniquePatients: 10,
        compensatedVisits: 8,
        uncompensatedVisits: 2,
        compensationRate: 80,
        totalCompensated: 4800,
        averageCompensated: 600,
        withAuthenCount: 10,
        withoutAuthenCount: 0,
        withPdxCount: 10,
        withOpCount: 8,
      },
      totalCount: 10,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService1B004_0N(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/service-1b004-0n?ds1=2025-10-01&ds2=2026-09-30&compensationFilter=COMPENSATED'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.adpMapping.isMapped).toBe(true)
    expect(json.data.summary.totalVisits).toBe(10)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_ccs_5_service_1b004_0n',
      expect.stringContaining('2025-10-01'),
      expect.any(Object)
    )
  })

  it('validates GET service-1b004p params, checks ADP mapping status, and returns report data', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    vi.mocked(RcmCervicalCancerService.getService1B004PReport).mockResolvedValue({
      ds1: '2025-10-01',
      ds2: '2026-09-30',
      adpMapping: {
        isMapped: true,
        mappedCount: 1,
        items: [
          {
            icode: '3009999',
            name: 'ตรวจคัดกรองซ้ำกรณีพบผลผิดปกติ (1B004P)',
            strength: null,
            nhso_adp_code: '1B004P',
          },
        ],
      },
      compensationFilter: 'COMPENSATED',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 8,
        uniquePatients: 8,
        compensatedVisits: 6,
        uncompensatedVisits: 2,
        compensationRate: 75,
        totalCompensated: 3600,
        averageCompensated: 600,
        withAuthenCount: 8,
        withoutAuthenCount: 0,
        withPdxCount: 8,
        withOpCount: 6,
      },
      totalCount: 8,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService1B004P(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/service-1b004p?ds1=2025-10-01&ds2=2026-09-30&compensationFilter=COMPENSATED'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.adpMapping.isMapped).toBe(true)
    expect(json.data.summary.totalVisits).toBe(8)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_ccs_4_service_1b004p',
      expect.stringContaining('2025-10-01'),
      expect.any(Object)
    )
  })

  it('validates GET service-1b005 params, checks ADP mapping status, and returns report data', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      userId: 1,
      username: 'staff01',
      email: 'staff01@thoen.local',
      role: 'staff',
    } as never)

    vi.mocked(RcmCervicalCancerService.getService1B005Report).mockResolvedValue({
      ds1: '2025-10-01',
      ds2: '2026-09-30',
      adpMapping: {
        isMapped: true,
        mappedCount: 1,
        items: [
          {
            icode: '3000555',
            name: 'ตรวจคัดกรอง 1B005',
            strength: null,
            nhso_adp_code: '1B005',
          },
        ],
      },
      compensationFilter: 'COMPENSATED',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 12,
        uniquePatients: 12,
        compensatedVisits: 10,
        uncompensatedVisits: 2,
        compensationRate: 83.3,
        totalCompensated: 6000,
        averageCompensated: 600,
        withAuthenCount: 12,
        withoutAuthenCount: 0,
        withPdxCount: 12,
        withOpCount: 10,
      },
      totalCount: 12,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    })

    const res = await getService1B005(
      new Request(
        'http://localhost/api/service/dashboard-rcm/funds/ccs/service-1b005?ds1=2025-10-01&ds2=2026-09-30&compensationFilter=COMPENSATED'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.adpMapping.isMapped).toBe(true)
    expect(json.data.summary.totalVisits).toBe(12)
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_funds_ccs_10_service_1b005',
      expect.stringContaining('2025-10-01'),
      expect.any(Object)
    )
  })
})

