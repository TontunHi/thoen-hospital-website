import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MisHosBudgetTrackerClient from '../MisHosBudgetTrackerClient'
import {
  MisHosTemplateConfig,
  MisHosTableDataResult,
  MisHosHospitalInfo,
} from '@/lib/budget/misHosService'

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="barchart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Cell: () => <div data-testid="cell" />,
}))

// Mock Excel Export
vi.mock('../utils/exportExcel', () => ({
  exportMisHosRecordsToExcel: vi.fn(),
}))

describe('MisHosBudgetTrackerClient Component', () => {
  const mockTemplate: MisHosTemplateConfig = {
    stId: '1843',
    templateName: 'การโอนเงินชดเชยค่าบริการ',
    subReports: [
      { ssid: '1825', report_name: 'รายรับโอนเงินจาก สปสช. ทุกกองทุน', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
      { ssid: '505', report_name: 'การโอนเงินรายเดือน', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
    ],
  }

  const mockTableData: MisHosTableDataResult = {
    ssid: '1825',
    records: [
      { YEAR: '2567', BUDGET_UC: '120.02' },
      { YEAR: '2568', BUDGET_UC: '110.31' },
    ],
    source: 'upstream',
    fetchedAt: '2026-10-21T04:30:00.000Z',
  }

  const mockHospital: MisHosHospitalInfo = {
    hcode: '11152',
    hname: 'รพ.เถิน',
    provinceId: '5200',
    provinceName: 'ลำปาง',
    nhsoName: 'เชียงใหม่',
    nhsoZone: '01',
  }

  it('renders hospital name, year selector, and 4 KPI cards', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    expect(screen.getAllByText(/รพ.เถิน/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ปีงบประมาณ:')).toBeDefined()
    expect(screen.getByText('ยอดเงินรวมตามรายงาน')).toBeDefined()
    expect(screen.getByText('จำนวนแถวข้อมูล')).toBeDefined()
    expect(screen.getByText('รหัสรายงาน (SSID)')).toBeDefined()
  })

  it('renders sidebar categories and submenus', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    expect(screen.getByText('เมนูรายงาน MIS HOS')).toBeDefined()
    expect(screen.getByText('0. การโอนเงิน & Statement')).toBeDefined()
    expect(screen.getByText('1. บริการผู้ป่วยนอก (OP)')).toBeDefined()
    expect(screen.getByText('2. บริการผู้ป่วยใน (IP)')).toBeDefined()
    expect(screen.getByText('4. บริการค่าใช้จ่ายสูง (High Cost)')).toBeDefined()
    expect(screen.getByText('5. ส่งเสริมป้องกันโรค (PP)')).toBeDefined()
  })

  it('renders table columns and records properly', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    expect(screen.getByText('YEAR')).toBeDefined()
    expect(screen.getByText('BUDGET_UC')).toBeDefined()
    expect(screen.getAllByText('2567').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2568').length).toBeGreaterThanOrEqual(1)
  })

  it('filters table rows when user types in search input', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    const searchInput = screen.getByPlaceholderText('ค้นหาข้อมูลในตาราง...')
    fireEvent.change(searchInput, { target: { value: '2567' } })

    expect(screen.getAllByText('2567').length).toBeGreaterThanOrEqual(1)
    // The row with 2568 should no longer be in table
    const tableCells = screen.getAllByRole('cell')
    const hasCell2568 = tableCells.some(c => c.textContent === '2568')
    expect(hasCell2568).toBe(false)
  })
})
