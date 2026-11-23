import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InvoiceSummaryClient from '../InvoiceSummaryClient'
import type { InvoiceSummaryResult, InvoiceDetailResult } from '@/lib/clinical/rcmDashboardService'

const mockInitialSummary: InvoiceSummaryResult = {
  department: 'OP',
  ds1: '2026-08-01',
  ds2: '2026-08-31',
  dateType: 'bill_date',
  items: [
    {
      code: '01',
      name: 'UC ใน CUP',
      visit: 100,
      receipt: 12500,
      compensated: 45000,
      down: 2000,
      up: -5000,
      debit: 48000,
    },
    {
      code: '17',
      name: 'เบิกจ่ายตรงกรมบัญชีกลาง',
      visit: 20,
      receipt: 1000,
      compensated: 15000,
      down: 500,
      up: -200,
      debit: 14700,
    },
  ],
  grandTotal: {
    visit: 120,
    receipt: 13500,
    compensated: 60000,
    down: 2500,
    up: -5200,
    debit: 62700,
  },
}

const mockInitialDetail: InvoiceDetailResult = {
  department: 'OP',
  ds1: '2026-08-01',
  ds2: '2026-08-31',
  dateType: 'bill_date',
  totalCount: 120,
  page: 1,
  pageSize: 50,
  totalPages: 3,
  filteredSummary: {
    totalVisits: 120,
    compensated: 60000,
    fund_money: 13500,
    income_hosxp: 65000,
    rcpt_money: 2300,
    debit_hosxp: 62700,
    hc: 3000,
    ae: 1500,
    inst: 2000,
    op: 4000,
    ip: 0,
    drug: 1800,
    dmis: 1200,
    down: 2500,
    up: -5200,
    net_diff: -2700,
  },
  items: [
    {
      no: 1,
      vnOrAn: '690813131739',
      cid: '1234567890123',
      hn: '0012345',
      ptname: 'นายทดสอบ ระบบ',
      vstdate: '2026-08-13',
      vsttime: '13:17:00',
      income_hosxp: 600,
      rcpt_money: 0,
      debit_hosxp: 600,
      compensated: 550,
      fund_money: 100,
      hc: 100,
      ae: 0,
      inst: 0,
      op: 0,
      ip: 0,
      drug: 0,
      dmis: 0,
      down: 0,
      up: -50,
      rep: '690800078',
      bill: '8843/022',
      billdate: '2026-08-25',
      pttype_eclaim_id: '01',
    },
  ],
}

describe('InvoiceSummaryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('skips initial mount fetches when SSR initialSummary and initialDetail are provided', () => {
    render(
      <InvoiceSummaryClient
        initialSummary={mockInitialSummary}
        initialDetail={mockInitialDetail}
        initialRange={{ startDate: '2026-08-01', endDate: '2026-08-31' }}
      />
    )

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText(/รายละเอียดผู้ป่วย \(OP\)/)).toBeInTheDocument()
  })

  it('renders all 3 filtered summary dashboard categories with accurate totals', () => {
    render(
      <InvoiceSummaryClient
        initialSummary={mockInitialSummary}
        initialDetail={mockInitialDetail}
        initialRange={{ startDate: '2026-08-01', endDate: '2026-08-31' }}
      />
    )

    const dashboard = screen.getByLabelText('สรุปผลตามตัวกรองรายละเอียดผู้ป่วย')
    expect(dashboard).toBeInTheDocument()

    // 3 category headings
    expect(within(dashboard).getByRole('heading', { name: /เปรียบเทียบการเงิน & ลูกหนี้ HOSxP/ })).toBeInTheDocument()
    expect(within(dashboard).getByRole('heading', { name: /หมวดกองทุนย่อย \(Sub-funds 7 หมวด\)/ })).toBeInTheDocument()
    expect(within(dashboard).getByRole('heading', { name: /ผลต่าง \(กระทบยอด\)/ })).toBeInTheDocument()

    // Category 1 figures
    expect(within(dashboard).getAllByText('60,000.00').length).toBeGreaterThan(0)
    expect(within(dashboard).getAllByText('62,700.00').length).toBeGreaterThan(0)
    expect(within(dashboard).getByText('65,000.00')).toBeInTheDocument()
    expect(within(dashboard).getByText('2,300.00')).toBeInTheDocument()

    // Category 2: 7 sub-funds
    expect(within(dashboard).getByText('3,000.00')).toBeInTheDocument() // HC
    expect(within(dashboard).getByText('1,500.00')).toBeInTheDocument() // AE
    expect(within(dashboard).getByText('2,000.00')).toBeInTheDocument() // INST
    expect(within(dashboard).getByText('4,000.00')).toBeInTheDocument() // OP
    expect(within(dashboard).getByText('1,800.00')).toBeInTheDocument() // Drug
    expect(within(dashboard).getByText('1,200.00')).toBeInTheDocument() // DMIS

    // Category 3: reconciliation diff
    expect(within(dashboard).getByText('+2,500.00')).toBeInTheDocument()
    expect(within(dashboard).getByText('-5,200.00')).toBeInTheDocument()
    expect(within(dashboard).getAllByText('-2,700.00').length).toBeGreaterThan(0)
  })

  it('updates the 3-category filtered dashboard when selecting a specific pttype', async () => {
    const filteredUcDetail: InvoiceDetailResult = {
      ...mockInitialDetail,
      pttype: '01',
      totalCount: 100,
      totalPages: 2,
      filteredSummary: {
        totalVisits: 100,
        compensated: 45000,
        fund_money: 12500,
        income_hosxp: 50000,
        rcpt_money: 2000,
        debit_hosxp: 48000,
        hc: 2500,
        ae: 1000,
        inst: 1500,
        op: 3500,
        ip: 0,
        drug: 2500,
        dmis: 1500,
        down: 2000,
        up: -5000,
        net_diff: -3000,
      },
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: filteredUcDetail }),
    } as Response)

    render(
      <InvoiceSummaryClient
        initialSummary={mockInitialSummary}
        initialDetail={mockInitialDetail}
        initialRange={{ startDate: '2026-08-01', endDate: '2026-08-31' }}
      />
    )

    // Click row 01 in master summary table
    fireEvent.click(screen.getByText('UC ใน CUP'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('mode=detail&page=1&pageSize=50&pttype=01'),
        expect.anything()
      )
    })

    const dashboard = screen.getByLabelText('สรุปผลตามตัวกรองรายละเอียดผู้ป่วย')
    await waitFor(() => {
      expect(within(dashboard).getByText('100 รายการ')).toBeInTheDocument()
      expect(within(dashboard).getAllByText('45,000.00').length).toBeGreaterThan(0)
      expect(within(dashboard).getAllByText('-3,000.00').length).toBeGreaterThan(0)
    })
  })

  it('splits sticky grouped header cleanly into colSpan=3 and colSpan=5 matching sticky columns', () => {
    const { container } = render(
      <InvoiceSummaryClient
        initialSummary={mockInitialSummary}
        initialDetail={mockInitialDetail}
        initialRange={{ startDate: '2026-08-01', endDate: '2026-08-31' }}
      />
    )

    const stickyGroupHeader = container.querySelector('th.group-left-sticky')
    const scrollGroupHeader = container.querySelector('th.group-left')
    expect(stickyGroupHeader).toHaveAttribute('colspan', '3')
    expect(scrollGroupHeader).toHaveAttribute('colspan', '5')
    expect(container.querySelectorAll('.invoice-detail-table thead tr:last-child th').length).toBe(25)
  })
})
