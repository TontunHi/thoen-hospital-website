import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RepFundsClient from '../RepFundsClient'

const mockSummaryResponse = {
  success: true,
  metrics: {
    totalCases: 14,
    totalReps: 1,
    totalIncome: 166938.75,
    totalCompensated: 146984.16,
    rate: '88.0',
    totalDiff: -19954.59,
    pendingAppeals: 0,
    errorCount: 0,
  },
  fundGroups: [
    {
      fundKey: 'IPCS,OTCS',
      fundLabel: 'ข้าราชการ (IPCS,OTCS)',
      subFundKey: '-',
      subFundLabel: '-',
      department: 'IP',
      caseCount: 14,
      totalIncome: 166938.75,
      totalCompensated: 146984.16,
      reimbursementRate: 88.0,
      netDiff: -19954.59,
      appealCount: 0,
      errorCount: 0,
    },
  ],
  repList: [
    {
      rep: '691000204',
      yearBudget: '2570',
      department: 'IP',
      fund: 'IPCS,OTCS',
      fundLabel: 'ข้าราชการ (IPCS,OTCS)',
      caseCount: 14,
      totalIncome: 166938.75,
      totalCompensated: 146984.16,
      reimbursementRate: 88.0,
      netDiff: -19954.59,
      minDate: '2026-10-08T09:40:00.000Z',
      maxDate: '2026-10-25T12:00:00.000Z',
      appealCount: 0,
      errorCount: 0,
    },
  ],
  availableYears: ['2570', '2569'],
  availableFunds: [
    { key: 'IPCS,OTCS', label: 'ข้าราชการ (IPCS,OTCS) (14)', count: 14 },
  ],
}

const mockCasesResponse = {
  success: true,
  count: 1,
  cases: [
    {
      id: '832703707',
      rep: '691000204',
      hn: '0142232',
      maskedHn: 'xx-xxx32',
      ptName: 'นาย กฤษฎา สาริวงค์',
      serviceDate: '2026-10-25',
      serviceDateThai: '25 ต.ค. 2569',
      department: 'IP',
      departmentLabel: 'ผู้ป่วยใน (IPD)',
      mainInscl: 'OFC',
      fund: 'IPCS,OTCS',
      fundLabel: 'ข้าราชการ (IPCS,OTCS)',
      subFund: '-',
      subFundLabel: '-',
      income: 3090,
      compensated: 3621.62,
      diff: 531.62,
      percentPay: 117,
      status: 'paid',
    },
  ],
}

const mockLookupResponse = {
  success: true,
  count: 1,
  claims: [
    {
      id: '832703707',
      rep: '691000204',
      hn: '0142232',
      maskedHn: 'xx-xxx32',
      ptName: 'นาย กฤษฎา สาริวงค์',
      serviceDate: '2026-10-25',
      serviceDateThai: '25 ต.ค. 2569',
      department: 'IP',
      departmentLabel: 'ผู้ป่วยใน (IPD)',
      mainInscl: 'OFC',
      fund: 'IPCS,OTCS',
      fundLabel: 'ข้าราชการ (IPCS,OTCS)',
      subFund: '-',
      subFundLabel: '-',
      income: 3090,
      compensated: 3621.62,
      diff: 531.62,
      percentPay: 117,
      status: 'paid',
    },
  ],
}

describe('RepFundsClient Component (3.1.1 Live Data)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = url.toString()
      if (u.includes('/api/service/dashboard-rcm/rep-funds/cases')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCasesResponse),
        })
      }
      if (u.includes('/api/service/dashboard-rcm/rep-funds/lookup')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLookupResponse),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSummaryResponse),
      })
    }) as any
  })

  it('renders heading and summary metrics from API correctly', async () => {
    render(<RepFundsClient />)

    expect(screen.getByText('3.1.1 ข้อมูล Rep แต่ละกองทุน')).toBeInTheDocument()
    expect(screen.getByText(/ตรวจสอบข้อมูลการชดเชยรายบุคคล/)).toBeInTheDocument()
    expect(screen.getByText('ค่ารักษาพยาบาลจริงรวม')).toBeInTheDocument()
    expect(screen.getByText('ยอดเงินชดเชย สปสช. รวม')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('166,938.75').length).toBeGreaterThan(0)
      expect(screen.getAllByText('146,984.16').length).toBeGreaterThan(0)
      expect(screen.getAllByText('88.0%').length).toBeGreaterThan(0)
    })
  })

  it('performs quick lookup by HN and displays Rep and compensation details', async () => {
    render(<RepFundsClient />)

    const hnInput = screen.getByLabelText(/เลขประจำตัวผู้ป่วย \(HN\)/)
    const form = hnInput.closest('form')!

    fireEvent.change(hnInput, { target: { value: '0142232' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/691000204/)).toBeInTheDocument()
      expect(screen.getAllByText(/นาย กฤษฎา สาริวงค์/).length).toBeGreaterThan(0)
      expect(screen.getByText(/3,621.62 บาท/)).toBeInTheDocument()
      expect(screen.getByText(/ชดเชยครบ \(117%\)/)).toBeInTheDocument()
    })
  })

  it('switches to Rep statements tab and displays Rep list', async () => {
    render(<RepFundsClient />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /มุมมองตามใบแจ้งผล REP/ })).toBeInTheDocument()
    })

    const repsTab = screen.getByRole('tab', { name: /มุมมองตามใบแจ้งผล REP/ })
    fireEvent.click(repsTab)

    await waitFor(() => {
      expect(screen.getByText('691000204')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ดูคนไข้/ })).toBeInTheDocument()
    })
  })

  it('opens case drilldown modal and shows patient name and compensation amount', async () => {
    render(<RepFundsClient />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /ดูเคส/ }).length).toBeGreaterThan(0)
    })

    const viewCasesBtn = screen.getAllByRole('button', { name: /ดูเคส/ })[0]
    fireEvent.click(viewCasesBtn)

    // Modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Patient details inside modal
    await waitFor(() => {
      expect(screen.getByText('นาย กฤษฎา สาริวงค์')).toBeInTheDocument()
      expect(screen.getByText('0142232')).toBeInTheDocument()
      expect(screen.getByText('3,621.62')).toBeInTheDocument()
      expect(screen.getByText('ชดเชยครบ 100%')).toBeInTheDocument()
    })

    // Close modal
    const closeBtns = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/ })
    fireEvent.click(closeBtns[0])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
