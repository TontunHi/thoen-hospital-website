import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RepFundsClient from '../RepFundsClient'

const mockRepdataSummary = {
  success: true,
  source: 'repdata',
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
  fundGroups: [],
  repList: [],
  availableYears: ['2570', '2569'],
  availableFunds: [{ key: 'IPCS,OTCS', label: 'ข้าราชการ (IPCS,OTCS) (14)', count: 14 }],
  availableErrorCodes: [],
}

const mockSeamlessSummary = {
  success: true,
  source: 'seamless',
  metrics: {
    totalCases: 22,
    totalReps: 3,
    totalIncome: 25000,
    totalCompensated: 18500,
    rate: '74.0',
    totalDiff: -6500,
    pendingAppeals: 2,
    errorCount: 3,
  },
  fundGroups: [],
  repList: [],
  availableYears: ['2570', '2569'],
  availableFunds: [
    { key: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ', label: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ (22)', count: 22 },
  ],
  availableErrorCodes: [],
}

const mockRepdataCases = {
  success: true,
  count: 1,
  cases: [
    {
      id: '832703707',
      source: 'repdata',
      rep: '691000204',
      hn: '0000001',
      maskedHn: 'xx-xxx01',
      ptName: 'นาย ทดสอบ ระบบ',
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

const mockSeamlessCases = {
  success: true,
  count: 1,
  cases: [
    {
      id: 'SM_001',
      source: 'seamless',
      rep: 'DDSA69093000090',
      hn: '0000002',
      maskedHn: 'xx-xxx02',
      ptName: 'นาง ตัวอย่าง ฟื้นฟู',
      serviceDate: '2026-10-15',
      serviceDateThai: '15 ต.ค. 2569',
      department: 'OP',
      departmentLabel: 'ผู้ป่วยนอก (OPD)',
      mainInscl: 'UCS',
      fund: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
      fundLabel: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
      subFund: 'บริการคนพิการ',
      subFundLabel: 'บริการคนพิการ',
      income: 500,
      compensated: 350,
      diff: -150,
      percentPay: 70,
      errorCode: 'DS305',
      payNo: 'DDSA6941090041',
      payDateThai: '25 ต.ค. 2569',
      seamlessStatus: 'ชดเชย',
      status: 'paid',
    },
  ],
}

describe('RepFundsClient Component (Multi-source repdata / repeclaim / seamless)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = url.toString()
      const isSeamless = u.includes('source=seamless')
      if (u.includes('/api/service/dashboard-rcm/rep-funds/cases')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(isSeamless ? mockSeamlessCases : mockRepdataCases),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(isSeamless ? mockSeamlessSummary : mockRepdataSummary),
      })
    }) as any
  })

  it('renders 3 source tabs and removes Fund Matrix & Patient Claim Lookup sections', async () => {
    render(<RepFundsClient />)

    expect(screen.getByText('3.1.1 ข้อมูล Rep แต่ละกองทุน')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /REP หลัก \(repdata\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /REP e-Claim \(repeclaim\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Seamless \/ DMIS \(seamless\)/ })).toBeInTheDocument()

    // Ensure Fund Matrix and Patient Claim Lookup were removed
    expect(screen.queryByRole('tab', { name: /มุมมองตามกองทุน/ })).not.toBeInTheDocument()
    expect(
      screen.queryByText(/ตรวจสอบข้อมูลการชดเชยรายบุคคล \(Patient Claim Lookup\)/)
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ค้นหารายคนไข้/ })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('166,938.75').length).toBeGreaterThan(0)
      expect(screen.getAllByText('146,984.16').length).toBeGreaterThan(0)
      expect(screen.getAllByText('88.0%').length).toBeGreaterThan(0)
    })
  })

  it('switches across repdata, repeclaim, and seamless tabs with matching API calls and modal details', async () => {
    render(<RepFundsClient />)

    await waitFor(() => {
      expect(screen.getAllByText('691000204').length).toBeGreaterThan(0)
      expect(screen.getAllByText('นาย ทดสอบ ระบบ').length).toBeGreaterThan(0)
    })

    // Click repeclaim tab
    fireEvent.click(screen.getByRole('tab', { name: /REP e-Claim \(repeclaim\)/ }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/rep-funds?source=repeclaim'),
        expect.anything()
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/rep-funds/cases?source=repeclaim'),
        expect.anything()
      )
    })

    // Click seamless tab
    fireEvent.click(screen.getByRole('tab', { name: /Seamless \/ DMIS \(seamless\)/ }))
    await waitFor(() => {
      expect(screen.getByText('ยอดขอเบิก Seamless รวม')).toBeInTheDocument()
      expect(screen.getByText('DDSA69093000090')).toBeInTheDocument()
      expect(screen.getByText('นาง ตัวอย่าง ฟื้นฟู')).toBeInTheDocument()
    })

    // Click row in seamless table -> opens modal with PayNo & Deny Code
    const seamlessRow = screen.getByText('นาง ตัวอย่าง ฟื้นฟู').closest('tr')!
    fireEvent.click(seamlessRow)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/รายละเอียดเคส: นาง ตัวอย่าง ฟื้นฟู/)).toBeInTheDocument()
      expect(screen.getByText('DDSA6941090041')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /ปิดหน้าต่าง/ })[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('orders filters cleanly: Year, Fund, Dept, Status, Search', async () => {
    render(<RepFundsClient />)

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

    await waitFor(() => {
      fireEvent.change(deptSelect, { target: { value: 'IP' } })
      fireEvent.change(statusSelect, { target: { value: 'paid' } })
    })

    expect(deptSelect).toHaveValue('IP')
    expect(statusSelect).toHaveValue('paid')
  })

  it('supports switching date mode between custom, month, and fiscal year', async () => {
    render(<RepFundsClient />)

    const customBtn = screen.getByRole('tab', { name: /กำหนดเอง/ })
    const monthBtn = screen.getByRole('tab', { name: /รายเดือน/ })
    const yearBtn = screen.getByRole('tab', { name: /รายปีงบประมาณ/ })

    fireEvent.click(monthBtn)
    await waitFor(() => {
      expect(screen.getByLabelText(/เลือกเดือน/)).toBeInTheDocument()
      expect(screen.getByLabelText(/เลือกปี พ\.ศ\./)).toBeInTheDocument()
    })

    fireEvent.click(customBtn)
    await waitFor(() => {
      expect(screen.getByLabelText(/ตั้งแต่วันที่/)).toBeInTheDocument()
      expect(screen.getByLabelText(/ถึงวันที่/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ดึงข้อมูล/ })).toBeInTheDocument()
    })

    fireEvent.click(yearBtn)
    await waitFor(() => {
      expect(screen.getByLabelText(/1\. เลือกปีงบประมาณ/)).toBeInTheDocument()
    })
  })

  it('allows filtering by clicking KPI cards and renders Export Excel button', async () => {
    render(<RepFundsClient />)

    await waitFor(() => {
      expect(screen.getAllByText('166,938.75').length).toBeGreaterThan(0)
    })

    const exportBtn = screen.getByRole('button', { name: 'ส่งออก Excel' })
    expect(exportBtn).toBeInTheDocument()

    const statusSelect = screen.getByLabelText(/5\. เลือกสถานะการชดเชย/)
    expect(statusSelect).toHaveValue('ALL')

    const paidCard = screen.getByText('ยอดเงินชดเชย สปสช. รวม').closest('button')!
    fireEvent.click(paidCard)
    await waitFor(() => expect(statusSelect).toHaveValue('paid'))
    expect(paidCard).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(paidCard)
    await waitFor(() => expect(statusSelect).toHaveValue('ALL'))
    expect(paidCard).toHaveAttribute('aria-pressed', 'false')

    const errorCard = screen.getByText('เคสรออุทธรณ์ / ติด Error').closest('button')!
    fireEvent.click(errorCard)
    await waitFor(() => expect(statusSelect).toHaveValue('has_error'))
    expect(errorCard).toHaveAttribute('aria-pressed', 'true')
  })
})
