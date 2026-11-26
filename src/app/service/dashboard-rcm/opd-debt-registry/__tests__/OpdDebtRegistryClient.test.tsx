import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpdDebtRegistryClient from '../OpdDebtRegistryClient'
import type { OpdDebtRegistryResult } from '@/lib/clinical/rcmOpdDebtRegistryService'

const mockInitialData: OpdDebtRegistryResult = {
  ds1: '2026-10-01',
  ds2: '2027-09-30',
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
    totalVisits: 2,
    totalIncome: 2500,
    totalUcMoney: 1500,
    totalDiscountMoney: 100,
    totalPaidMoney: 900,
    totalRcptMoney: 900,
    totalDebit: 1500,
    withDebitCount: 1,
    withRcptCount: 1,
    withAuthenCount: 1,
    withoutAuthenCount: 1,
    authenRate: 50.0,
    withRepCount: 1,
    withoutRepCount: 1,
    repRate: 50.0,
    totalRepCompensated: 1450,
  },
  breakdowns: {
    account: [
      {
        code: '1102050101.201',
        name: 'ลูกหนี้ค่ารักษา UC',
        gfmis: 'GF-01',
        cases: 1,
        visits: 1,
        income: 1500,
        discount_money: 0,
        rcpt_money: 0,
        debit: 1500,
      },
    ],
    eclaim: [
      {
        code: '01',
        name: 'UC ใน CUP',
        cases: 1,
        visits: 1,
        income: 1500,
        discount_money: 0,
        rcpt_money: 0,
        debit: 1500,
      },
    ],
    pttype: [
      {
        code: '33',
        name: 'บัตรทอง ในเขต',
        hipdata_code: 'UCS',
        cases: 1,
        visits: 1,
        income: 1500,
        discount_money: 0,
        rcpt_money: 0,
        debit: 1500,
      },
    ],
    vstdate: [
      {
        code: '2026-10-05',
        name: '2026-10-05',
        cases: 2,
        visits: 2,
        income: 2500,
        discount_money: 100,
        rcpt_money: 900,
        debit: 1500,
      },
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
      accountname: 'ลูกหนี้ค่ารักษา UC',
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
      authencode: null,
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

describe('OpdDebtRegistryClient Component (2.1.1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('vn-details')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              header: {
                vn: '691005083001',
                hn: '0001111',
                cid: '9999999999999',
                ptname: 'นายทดสอบ ระบบ',
                age: 40,
                sex: 'ชาย',
                vstdate: '2026-10-05',
                vsttime: '08:30:00',
                pttypename: 'บัตรทอง ในเขต',
                department: 'OPD อายุรกรรม',
                clinic: 'อายุรกรรม',
              },
              screen: {
                cc: 'ตรวจติดตามเบาหวาน',
                bps: 120,
                bpd: 80,
                pulse: 72,
                temperature: 36.6,
                bw: 65,
              },
              diagnoses: [
                {
                  icd10: 'E119',
                  icd_name: 'Type 2 diabetes mellitus',
                  diagtype: '1',
                  diagtype_name: 'PRINCIPLE DX',
                  doctor_name: null,
                },
              ],
              orders: {
                items: [],
                categories: [],
                total_price: 1500,
                total_items: 1,
                total_paid: 0,
                total_claim: 1500,
              },
            },
          }),
        } as unknown as Response
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: mockInitialData }),
      } as unknown as Response
    })
  })

  it('renders 2.1.1.3 KPI totals, full CID, and skips fetch on mount when initialData is supplied', () => {
    render(<OpdDebtRegistryClient initialData={mockInitialData} />)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('2.1.1.3')).toBeInTheDocument()
    expect(screen.getByText('รายชื่อผู้ป่วยนอก รับบริการ (ทะเบียนตั้งหนี้)')).toBeInTheDocument()
    expect(screen.getByText('นายทดสอบ ระบบ')).toBeInTheDocument()
    expect(screen.getByText(/9999999999999/)).toBeInTheDocument()
    expect(screen.getByText('AUTH-NHSO-01')).toBeInTheDocument()
    expect(screen.getByText('691000123')).toBeInTheDocument()
    expect(screen.getByText('e-Claim (OP01)')).toBeInTheDocument()
    expect(screen.getAllByText(/1,450\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText('R69/001#900.00')).toBeInTheDocument()
    expect(screen.queryByText(/1102050101\.201 ·/)).not.toBeInTheDocument()
    expect(screen.getAllByText('ลูกหนี้ค่ารักษา UC').length).toBeGreaterThan(0)
  })

  it('triggers fetch with AbortController signal when toggling บริการทั้งหมด', async () => {
    render(<OpdDebtRegistryClient initialData={mockInitialData} />)

    const checkbox = screen.getByRole('checkbox', { name: /บริการทั้งหมด/ })
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('includeAdmitted=true'),
        expect.anything()
      )
    })
  })

  it('opens detail modal on row click and lazy-fetches vn-details when switching to clinical tab', async () => {
    render(<OpdDebtRegistryClient initialData={mockInitialData} />)

    fireEvent.click(screen.getByText('นายทดสอบ ระบบ'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('เพดานตั้งหนี้ (Max Debt)')).toBeInTheDocument()
    expect(screen.getByText('฿3,000.00')).toBeInTheDocument()
    expect(within(dialog).getByText('ข้อมูลการชดเชย REP (อ้างอิงตาม VN)')).toBeInTheDocument()
    expect(within(dialog).getAllByText('฿1,450.00').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: /ข้อมูลคลินิก/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/opd-debt-registry/vn-details?vn=691005083001'),
        expect.anything()
      )
      expect(screen.getByText(/ตรวจติดตามเบาหวาน/)).toBeInTheDocument()
    })
  })

  it('fetches initial data automatically with AbortController when initialData is omitted', async () => {
    render(<OpdDebtRegistryClient />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/opd-debt-registry?'),
        expect.anything()
      )
    })
  })

  it('filters by WITH_REP when clicking ยอดชดเชยจาก REP KPI tile', async () => {
    render(<OpdDebtRegistryClient initialData={mockInitialData} />)

    fireEvent.click(screen.getByText('ยอดชดเชยจาก REP'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=WITH_REP'),
        expect.anything()
      )
    })
  })
})
