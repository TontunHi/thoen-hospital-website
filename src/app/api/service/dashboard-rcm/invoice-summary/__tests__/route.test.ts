import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmDashboardService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/clinical/rcmDashboardService')>()
  return {
    ...actual,
    RcmDashboardService: {
      ...actual.RcmDashboardService,
      getInvoiceSummary: vi.fn(),
      getInvoiceDetails: vi.fn(),
    },
  }
})

describe('GET /api/service/dashboard-rcm/invoice-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/invoice-summary')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Unauthorized')
  })

  it('returns 403 when user role is not permitted', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'guest_user',
      role: 'guest',
      email: 'guest@thoenhospital.com',
    } as any)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/invoice-summary')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Forbidden')
  })

  it('returns 200 and invoice summary data when mode is summary', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
      email: 'staff@thoenhospital.com',
    } as any)

    const mockSummary = {
      department: 'OP' as const,
      ds1: '2026-08-01',
      ds2: '2026-08-31',
      items: [
        {
          code: '01',
          name: 'UC ใน CUP',
          visit: 5474,
          receipt: 943785,
          compensated: 1122830.75,
          down: 36135.75,
          up: -1866954,
          debit: 3167784.25,
        },
      ],
      grandTotal: {
        visit: 5474,
        receipt: 943785,
        compensated: 1122830.75,
        down: 36135.75,
        up: -1866954,
        debit: 3167784.25,
      },
    }

    vi.mocked(RcmDashboardService.getInvoiceSummary).mockResolvedValue(mockSummary)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/invoice-summary?department=OP&ds1=2026-08-01&ds2=2026-08-31')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockSummary)
    expect(RcmDashboardService.getInvoiceSummary).toHaveBeenCalledWith({
      department: 'OP',
      ds1: '2026-08-01',
      ds2: '2026-08-31',
      dateType: 'bill_date',
    })
  })

  it('returns 200 and invoice details when mode is detail', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
      email: 'staff@thoenhospital.com',
    } as any)

    const mockDetail = {
      department: 'OP' as const,
      ds1: '2026-08-01',
      ds2: '2026-08-31',
      pttype: '01',
      totalCount: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [
        {
          no: 1,
          vnOrAn: '690813131739',
          cid: '1234567890123',
          hn: '123456',
          ptname: 'นายทดสอบ ระบบ',
          vstdate: '2026-08-13',
          vsttime: '13:17:00',
          income_hosxp: 572,
          rcpt_money: 0,
          debit_hosxp: 572,
          compensated: 572,
          fund_money: 0,
          hc: 0,
          ae: 0,
          inst: 0,
          op: 0,
          ip: 0,
          drug: 0,
          dmis: 0,
          down: 0,
          up: 0,
          rep: '690800078',
          bill: '8843/022',
          billdate: '2026-08-25',
          pttype_eclaim_id: '01',
        },
      ],
    }

    vi.mocked(RcmDashboardService.getInvoiceDetails).mockResolvedValue(mockDetail)

    const request = new Request(
      'http://localhost:3000/api/service/dashboard-rcm/invoice-summary?department=OP&ds1=2026-08-01&ds2=2026-08-31&mode=detail&pttype=01&page=1&pageSize=50'
    )
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockDetail)
    expect(RcmDashboardService.getInvoiceDetails).toHaveBeenCalledWith({
      department: 'OP',
      ds1: '2026-08-01',
      ds2: '2026-08-31',
      dateType: 'bill_date',
      pttype: '01',
      search: undefined,
      page: 1,
      pageSize: 50,
      exportAll: false,
    })
  })

  it('returns 500 when service throws an error', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'admin01',
      role: 'admin',
      email: 'admin@thoenhospital.com',
    } as any)

    vi.mocked(RcmDashboardService.getInvoiceSummary).mockRejectedValue(new Error('Connection error'))

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/invoice-summary')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toContain('เกิดข้อผิดพลาดในการดึงข้อมูลรายงานสรุปรายรับจาก Invoice')
  })
})
