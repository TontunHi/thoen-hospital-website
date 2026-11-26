import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmOpdDebtRegistryService, type OpdDebtRegistryResult } from '../rcmOpdDebtRegistryService'
import { clearMemoryCache } from '@/lib/cache'
import { GatewayNotFoundError } from '@/lib/apiGateway'

const mockResult: OpdDebtRegistryResult = {
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  includeAdmitted: false,
  cardFilter: 'ALL',
  eclaimFilter: '',
  accountFilter: '',
  pttypeFilter: '',
  vstdateFilter: '',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
  totalCount: 2,
  totalPages: 1,
  summary: {
    totalCases: 2,
    totalVisits: 3,
    totalIncome: 4500,
    totalUcMoney: 3000,
    totalDiscountMoney: 100,
    totalPaidMoney: 1400,
    totalRcptMoney: 900,
    totalDebit: 3500,
    withDebitCount: 2,
    withRcptCount: 1,
    withAuthenCount: 2,
    withoutAuthenCount: 1,
    authenRate: 66.7,
    withRepCount: 1,
    withoutRepCount: 2,
    repRate: 33.3,
    totalRepCompensated: 1450,
  },
  breakdowns: {
    eclaim: [
      { code: '01', name: 'UC ใน CUP', cases: 2, visits: 3, income: 4500, discount_money: 100, rcpt_money: 900, debit: 3500 },
    ],
    account: [
      { code: '1102050101.201', name: 'ลูกหนี้ค่ารักษา UC ในเขต', gfmis: 'GF-01', cases: 2, visits: 3, income: 4500, discount_money: 100, rcpt_money: 900, debit: 3500 },
    ],
    pttype: [
      { code: '33', name: 'บัตรทอง ในเขต', hipdata_code: 'UCS', cases: 2, visits: 3, income: 4500, discount_money: 100, rcpt_money: 900, debit: 3500 },
    ],
    vstdate: [
      { code: '2026-10-05', name: '2026-10-05', cases: 2, visits: 3, income: 4500, discount_money: 100, rcpt_money: 900, debit: 3500 },
    ],
  },
  items: [
    {
      no: 1,
      vn: '691005083001',
      an: '',
      hn: '0001111',
      cid: '9999999999999',
      ptname: 'นายทดสอบ ระบบ',
      vstdate: '2026-10-05',
      vsttime: '08:30:00',
      ptsubtypeCode: '0',
      ptsubtype: 'ตรวจโรคทั่วไป',
      authencode: 'AUTH-NHSO-01',
      authenMethod: 'SMARTCARD',
      pttype_eclaim_id: '01',
      pttype_eclaim_name: 'UC ใน CUP',
      pttype: '33',
      hipdata_code: 'UCS',
      pttypename: 'บัตรทอง ในเขต',
      gfmis: 'GF-01',
      accountcode: '1102050101.201',
      accountname: 'ลูกหนี้ค่ารักษา UC ในเขต',
      department: 'OPD อายุรกรรม',
      clinic: 'อายุรกรรม',
      pdx: 'E119',
      income: 1500,
      uc_money: 1500,
      discount_money: 0,
      paid_money: 0,
      rcpt_money: 0,
      rcpno: '',
      rcpnodate: '',
      debit: 1500,
      max_debt_amount: 3000,
      rep: '691000123',
      rep_type: 'e-Claim (OP01)',
      rep_compensated: 1450,
      rep_items: [
        {
          rep: '691000123',
          source: 'repeclaim',
          repType: 'e-Claim (OP01)',
          fund: 'OP01',
          subFund: null,
          compensated: 1450,
          errorCode: null,
        },
      ],
    },
    {
      no: 2,
      vn: '691005091502',
      an: '',
      hn: '0002222',
      cid: '8888888888888',
      ptname: 'นางตัวอย่าง ทดสอบ',
      vstdate: '2026-10-05',
      vsttime: '09:15:00',
      ptsubtypeCode: '1',
      ptsubtype: 'ส่งเสริมสุขภาพ',
      authencode: 'KIOSK-02',
      authenMethod: null,
      pttype_eclaim_id: '17',
      pttype_eclaim_name: 'จ่ายตรงกรมบัญชีกลาง',
      pttype: '21',
      hipdata_code: 'OFC',
      pttypename: 'เบิกจ่ายตรง',
      gfmis: 'GF-17',
      accountcode: '1102050101.401',
      accountname: 'ลูกหนี้จ่ายตรง',
      department: 'OPD ทั่วไป',
      clinic: 'ตรวจโรคทั่วไป',
      pdx: 'I10',
      income: 1000,
      uc_money: 0,
      discount_money: 100,
      paid_money: 900,
      rcpt_money: 900,
      rcpno: 'R69/001#900.00',
      rcpnodate: '2026-10-05 09:45',
      debit: 0,
      max_debt_amount: null,
      rep: null,
      rep_type: null,
      rep_compensated: 0,
      rep_items: [],
    },
  ],
}

describe('RcmOpdDebtRegistryService (2.1.1.3 ทะเบียนตั้งหนี้)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('delegates Tier 1 summary/breakdowns and Tier 2 ledger to API Gateway named endpoint', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ data: mockResult })

    const res = await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31', page: 1, pageSize: 50 },
      mockFetcher
    )

    expect(mockFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        includeAdmitted: false,
        cardFilter: 'ALL',
        sortBy: 'vstdate',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
      })
    )
    expect(res.summary.totalCases).toBe(2)
    expect(res.summary.totalDebit).toBe(3500)
    expect(res.breakdowns.account[0].gfmis).toBe('GF-01')
    expect(res.items).toHaveLength(2)
    expect(res.items[0].authencode).toBe('AUTH-NHSO-01')
    expect(res.items[0].rep).toBe('691000123')
    expect(res.items[0].rep_type).toBe('e-Claim (OP01)')
    expect(res.items[0].rep_compensated).toBe(1450)
    expect(res.summary.totalRepCompensated).toBe(1450)
    expect(res.items[1].rcpno).toBe('R69/001#900.00')
  })

  it('passes includeAdmitted and exportAll normalization cleanly to Gateway', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ data: { ...mockResult, includeAdmitted: true } })

    await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31', includeAdmitted: true, exportAll: true },
      mockFetcher
    )

    expect(mockFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAdmitted: true,
        exportAll: true,
        page: 1,
        pageSize: 50000,
      })
    )
  })

  it('normalizes missing REP fields defensively when Gateway omits them', async () => {
    const legacyItem = { ...mockResult.items[1] } as Partial<typeof mockResult.items[1]>
    delete legacyItem.rep
    delete legacyItem.rep_type
    delete legacyItem.rep_compensated
    delete legacyItem.rep_items

    const mockFetcher = vi.fn().mockResolvedValue({
      data: {
        ...mockResult,
        summary: {
          totalCases: 1,
          totalVisits: 1,
          totalIncome: 1000,
          totalUcMoney: 0,
          totalDiscountMoney: 100,
          totalPaidMoney: 900,
          totalRcptMoney: 900,
          totalDebit: 0,
          withDebitCount: 0,
          withRcptCount: 1,
          withAuthenCount: 1,
          withoutAuthenCount: 0,
          authenRate: 100,
        },
        items: [legacyItem],
      },
    })

    const res = await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31' },
      mockFetcher
    )

    expect(res.summary.withRepCount).toBe(0)
    expect(res.summary.totalRepCompensated).toBe(0)
    expect(res.items[0].rep).toBeNull()
    expect(res.items[0].rep_type).toBeNull()
    expect(res.items[0].rep_compensated).toBe(0)
    expect(res.items[0].rep_items).toEqual([])
  })

  it('throws GatewayNotFoundError when Gateway returns malformed payload', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ data: {} })

    await expect(
      RcmOpdDebtRegistryService.getReportData({ ds1: '2026-10-01', ds2: '2026-10-31' }, mockFetcher)
    ).rejects.toBeInstanceOf(GatewayNotFoundError)
  })
})
