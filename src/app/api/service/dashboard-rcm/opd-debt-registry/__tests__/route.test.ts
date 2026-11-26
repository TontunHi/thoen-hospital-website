import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmOpdDebtRegistryService', () => ({
  RcmOpdDebtRegistryService: {
    getReportData: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { GatewayTimeoutError, GatewayUnavailableError } from '@/lib/apiGateway'
import { RcmOpdDebtRegistryService } from '@/lib/clinical/rcmOpdDebtRegistryService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { GET as getReport } from '../route'
import { GET as getVnDetails } from '../vn-details/route'

describe('OPD Debt Registry API Routes (2.1.1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)
    const res = await getReport(
      new Request('http://localhost/api/service/dashboard-rcm/opd-debt-registry')
    )
    expect(res.status).toBe(401)
  })

  it('rejects unauthorized roles with 403', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'guest01',
      email: 'guest@example.local',
      role: 'guest' as never,
    } as never)

    const res = await getReport(
      new Request('http://localhost/api/service/dashboard-rcm/opd-debt-registry')
    )
    expect(res.status).toBe(403)
  })

  it('validates invalid date parameter with 400', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'finance01',
      email: 'finance@thoen.moph.go.th',
      role: 'staff',
    } as never)

    const res = await getReport(
      new Request('http://localhost/api/service/dashboard-rcm/opd-debt-registry?ds1=invalid')
    )
    expect(res.status).toBe(400)
  })

  it('returns report data and writes audit log for authorized staff', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'finance01',
      email: 'finance@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmOpdDebtRegistryService.getReportData).mockResolvedValue({
      ds1: '2026-10-01',
      ds2: '2026-10-31',
      includeAdmitted: true,
      cardFilter: 'WITH_DEBIT',
      eclaimFilter: '',
      accountFilter: '',
      pttypeFilter: '',
      vstdateFilter: '',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 1,
      summary: {
        totalCases: 0,
        totalVisits: 0,
        totalIncome: 0,
        totalUcMoney: 0,
        totalDiscountMoney: 0,
        totalPaidMoney: 0,
        totalRcptMoney: 0,
        totalDebit: 0,
        withDebitCount: 0,
        withRcptCount: 0,
        withAuthenCount: 0,
        withoutAuthenCount: 0,
        authenRate: 0,
        withRepCount: 0,
        withoutRepCount: 0,
        repRate: 0,
        totalRepCompensated: 0,
      },
      breakdowns: { eclaim: [], account: [], pttype: [], vstdate: [] },
      items: [],
    })

    const res = await getReport(
      new Request(
        'http://localhost/api/service/dashboard-rcm/opd-debt-registry?ds1=2026-10-01&ds2=2026-10-31&includeAdmitted=true&cardFilter=WITH_DEBIT'
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(RcmOpdDebtRegistryService.getReportData).toHaveBeenCalledWith(
      expect.objectContaining({
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        includeAdmitted: true,
        cardFilter: 'WITH_DEBIT',
      })
    )
    expect(logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'rcm_opd_debt_registry',
      expect.stringContaining('2026-10-01'),
      expect.objectContaining({ username: 'finance01' })
    )
  })

  it('maps GatewayUnavailableError to 503 and GatewayTimeoutError to 504', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'finance01',
      email: 'finance@thoen.moph.go.th',
      role: 'staff',
    } as never)

    vi.mocked(RcmOpdDebtRegistryService.getReportData).mockRejectedValueOnce(
      new GatewayUnavailableError('Gateway offline')
    )
    const res503 = await getReport(
      new Request('http://localhost/api/service/dashboard-rcm/opd-debt-registry')
    )
    expect(res503.status).toBe(503)

    vi.mocked(RcmOpdDebtRegistryService.getReportData).mockRejectedValueOnce(
      new GatewayTimeoutError('Timed out')
    )
    const res504 = await getReport(
      new Request('http://localhost/api/service/dashboard-rcm/opd-debt-registry')
    )
    expect(res504.status).toBe(504)
  })

  it('validates VN and returns clinical details from vn-details route', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'finance01',
      email: 'finance@thoen.moph.go.th',
      role: 'staff',
    } as never)

    const badRes = await getVnDetails(
      new Request('http://localhost/api/service/dashboard-rcm/opd-debt-registry/vn-details?vn=')
    )
    expect(badRes.status).toBe(400)

    vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
      header: {
        vn: '691005083001',
        hn: '0001111',
        cid: '9999999999999',
        ptname: 'นายทดสอบ ระบบ',
        age: 40,
        sex: 'ชาย',
        vstdate: '2026-10-05',
        vsttime: '08:30:00',
        pttypename: 'บัตรทอง',
        department: 'OPD',
        clinic: 'อายุรกรรม',
      },
      screen: null,
      diagnoses: [],
      orders: { items: [], categories: [], total_price: 0, total_items: 0, total_paid: 0, total_claim: 0 },
    })

    const okRes = await getVnDetails(
      new Request(
        'http://localhost/api/service/dashboard-rcm/opd-debt-registry/vn-details?vn=691005083001'
      )
    )
    expect(okRes.status).toBe(200)
  })
})
