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
  availableErrorCodes: [
    { code: '179', count: 12 },
    { code: '305', count: 5 },
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
    expect(screen.getByText(/รวมหลาย Rep และหลาย HN ในที่เดียว/)).toBeInTheDocument()
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
      expect(screen.getAllByText(/691000204/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/นาย กฤษฎา สาริวงค์/).length).toBeGreaterThan(0)
      expect(screen.getByText(/3,621.62 บาท/)).toBeInTheDocument()
      expect(screen.getAllByText(/ได้รับชดเชย/).length).toBeGreaterThan(0)
    })
  })

  it('renders multi-Rep and multi-HN statements in Rep view and clicking a row opens case detail modal without button', async () => {
    render(<RepFundsClient />)

    // Verify Rep statements view is active and displays multiple Reps and HNs directly in table
    await waitFor(() => {
      expect(screen.getAllByText('691000204').length).toBeGreaterThan(0)
      expect(screen.getAllByText('0142232').length).toBeGreaterThan(0)
      expect(screen.getAllByText('นาย กฤษฎา สาริวงค์').length).toBeGreaterThan(0)
    })

    // Verify there are no "ดูคนไข้" or "ดูเคส" buttons in the table
    expect(screen.queryByRole('button', { name: /ดูคนไข้/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ดูเคส/ })).not.toBeInTheDocument()

    // Click directly on the row to view detail
    const caseRow = screen.getByText('นาย กฤษฎา สาริวงค์').closest('tr')!
    fireEvent.click(caseRow)

    // Modal opens showing single case detail
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/รายละเอียดเคส: นาย กฤษฎา สาริวงค์/)).toBeInTheDocument()
      expect(screen.getAllByText('3,621.62 บาท').length).toBeGreaterThan(0)
    })

    // Close modal
    const closeBtns = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/ })
    fireEvent.click(closeBtns[0])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('switches to Fund Matrix tab and clicking a fund row opens fund cases modal', async () => {
    render(<RepFundsClient />)

    const fundsTab = screen.getByRole('tab', { name: /มุมมองตามกองทุน/ })
    fireEvent.click(fundsTab)

    await waitFor(() => {
      expect(screen.getByText('ข้าราชการ (IPCS,OTCS)')).toBeInTheDocument()
    })

    // Verify no "ดูเคส" button in Fund Matrix
    expect(screen.queryByRole('button', { name: /ดูเคส/ })).not.toBeInTheDocument()

    // Click on fund row to open cases
    const fundRow = screen.getByText('ข้าราชการ (IPCS,OTCS)').closest('tr')!
    fireEvent.click(fundRow)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/รายชื่อคนไข้: ข้าราชการ \(IPCS,OTCS\)/)).toBeInTheDocument()
    })

    // Close modal
    const closeBtns = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/ })
    fireEvent.click(closeBtns[0])
  })

  it('orders filters logically from broad to specific: Year, Fund, Dept, Status, Search', async () => {
    render(<RepFundsClient />)

    // Check all filters exist
    const yearSelect = screen.getByLabelText(/1\. เลือกปีงบประมาณ/)
    const fundSelect = screen.getByLabelText(/2\. เลือกกองทุนหลัก/)
    const deptSelect = screen.getByLabelText(/4\. เลือกแผนกบริการ/)
    const statusSelect = screen.getByLabelText(/5\. เลือกสถานะการชดเชย/)
    const searchInput = screen.getByLabelText(/6\. ค้นหาเลข Rep/)

    expect(yearSelect).toBeInTheDocument()
    expect(fundSelect).toBeInTheDocument()
    expect(deptSelect).toBeInTheDocument()
    expect(statusSelect).toBeInTheDocument()
    expect(searchInput).toBeInTheDocument()

    // Verify error code select filter is removed
    expect(screen.queryByLabelText(/เลือกรหัส Error Code/)).not.toBeInTheDocument()

    // Test changing department and status filters
    await waitFor(() => {
      fireEvent.change(deptSelect, { target: { value: 'IP' } })
      fireEvent.change(statusSelect, { target: { value: 'paid' } })
    })

    expect(deptSelect).toHaveValue('IP')
    expect(statusSelect).toHaveValue('paid')
  })

  it('toggles patient claim lookup section visibility', async () => {
    render(<RepFundsClient />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ค้นหารายคนไข้/ })).toBeInTheDocument()
    })

    const toggleBtn = screen.getByRole('button', { name: /ค้นหารายคนไข้/ })

    // Click to open
    fireEvent.click(toggleBtn)
    expect(screen.getByRole('button', { name: /ซ่อนการค้นหา/ })).toBeInTheDocument()

    // Click to collapse
    const collapseBtn = screen.getByRole('button', { name: /ซ่อนการค้นหา/ })
    fireEvent.click(collapseBtn)
    expect(screen.getByRole('button', { name: /ค้นหารายคนไข้/ })).toBeInTheDocument()
  })

  it('supports switching date mode between custom, month, and fiscal year', async () => {
    render(<RepFundsClient />)

    // Check all 3 mode buttons are rendered
    const customBtn = screen.getByRole('tab', { name: /กำหนดเอง/ })
    const monthBtn = screen.getByRole('tab', { name: /รายเดือน/ })
    const yearBtn = screen.getByRole('tab', { name: /รายปีงบประมาณ/ })

    expect(customBtn).toBeInTheDocument()
    expect(monthBtn).toBeInTheDocument()
    expect(yearBtn).toBeInTheDocument()

    // Ensure redundant timeframe badge (e.g. "1 ต.ค. 2569 - 30 ก.ย. 2570") is not rendered
    expect(screen.queryByText(/1 ต\.ค\./)).not.toBeInTheDocument()

    // Default mode is year: fiscal year selector should be present
    expect(screen.getByLabelText(/1\. เลือกปีงบประมาณ/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/ตั้งแต่วันที่/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/เลือกเดือน/)).not.toBeInTheDocument()

    // Switch to 'month' mode
    fireEvent.click(monthBtn)
    await waitFor(() => {
      expect(screen.getByLabelText(/เลือกเดือน/)).toBeInTheDocument()
      expect(screen.getByLabelText(/เลือกปี พ\.ศ\./)).toBeInTheDocument()
      expect(screen.queryByLabelText(/1\. เลือกปีงบประมาณ/)).not.toBeInTheDocument()
    })

    // Switch to 'custom' mode
    fireEvent.click(customBtn)
    await waitFor(() => {
      expect(screen.getByLabelText(/ตั้งแต่วันที่/)).toBeInTheDocument()
      expect(screen.getByLabelText(/ถึงวันที่/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ดึงข้อมูล/ })).toBeInTheDocument()
      expect(screen.queryByLabelText(/เลือกเดือน/)).not.toBeInTheDocument()
    })

    // Switch back to 'year' mode
    fireEvent.click(yearBtn)
    await waitFor(() => {
      expect(screen.getByLabelText(/1\. เลือกปีงบประมาณ/)).toBeInTheDocument()
      expect(screen.queryByLabelText(/ตั้งแต่วันที่/)).not.toBeInTheDocument()
    })
  })

  it('fetches data with ds1 and ds2 when in custom date mode', async () => {
    render(<RepFundsClient />)

    // Switch to custom mode
    const customBtn = screen.getByRole('tab', { name: /กำหนดเอง/ })
    fireEvent.click(customBtn)

    await waitFor(() => {
      expect(screen.getByLabelText(/ตั้งแต่วันที่/)).toBeInTheDocument()
    })

    // Click fetch button
    const fetchBtn = screen.getByRole('button', { name: /ดึงข้อมูล/ })
    fireEvent.click(fetchBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/service\/dashboard-rcm\/rep-funds\?.*ds1=.*&ds2=/),
        expect.anything()
      )
    })
  })

  it('renders clean Excel export button and allows filtering by clicking KPI cards', async () => {
    render(<RepFundsClient />)

    // Export button has clean label "ส่งออก Excel" without "(รายการเคส Rep)"
    const exportBtn = screen.getByRole('button', { name: 'ส่งออก Excel' })
    expect(exportBtn).toBeInTheDocument()
    expect(screen.queryByText(/รายการเคส Rep/)).not.toBeInTheDocument()

    const statusSelect = screen.getByLabelText(/5\. เลือกสถานะการชดเชย/)
    expect(statusSelect).toHaveValue('ALL')

    // Click "ยอดเงินชดเชย สปสช. รวม" card -> sets status filter to 'paid'
    const paidCard = screen.getByText('ยอดเงินชดเชย สปสช. รวม').closest('button')!
    fireEvent.click(paidCard)
    expect(statusSelect).toHaveValue('paid')
    expect(paidCard).toHaveAttribute('aria-pressed', 'true')

    // Click same card again -> toggles back to 'ALL'
    fireEvent.click(paidCard)
    expect(statusSelect).toHaveValue('ALL')
    expect(paidCard).toHaveAttribute('aria-pressed', 'false')

    // Click "เคสรออุทธรณ์ / ติด Error" card -> sets status filter to 'has_error'
    const errorCard = screen.getByText('เคสรออุทธรณ์ / ติด Error').closest('button')!
    fireEvent.click(errorCard)
    expect(statusSelect).toHaveValue('has_error')
    expect(errorCard).toHaveAttribute('aria-pressed', 'true')
  })
})
