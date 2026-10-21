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
  LineChart: ({ children }: any) => <div data-testid="linechart">{children}</div>,
  Line: () => <div data-testid="line" />,
  PieChart: ({ children }: any) => <div data-testid="piechart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
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
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: [] }),
    }) as any
  })

  const mockTemplate: MisHosTemplateConfig = {
    stId: '1843',
    templateName: 'การโอนเงินชดเชยค่าบริการ',
    subReports: [
      { ssid: '1825', report_name: 'รายรับโอนเงินจาก สปสช. ทุกกองทุน', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
      { ssid: '1826', report_name: 'รายรับ แยกรายกองทุนย่อย', chart_type: 'table', report_width: '12', flag_data: 'Y' },
    ],
  }

  const mockTableData: MisHosTableDataResult = {
    ssid: '1826',
    records: [
      { FUND_NAME: 'กองทุนผู้ป่วยนอก', BUDGET: '30823389.83' },
      { FUND_NAME: 'กองทุนผู้ป่วยใน', BUDGET: '15200000.00' },
    ],
    chartConfig: {
      ssid: '1826',
      reportName: 'รายรับ แยกรายกองทุนย่อย',
      chartType: 'table',
      table_header: ['ชื่อกองทุน', 'งบประมาณ,2'],
    },
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

  it('renders hospital name, zone badge, year selector, and 4 KPI cards', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    expect(screen.getAllByText(/รพ.เถิน/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/สปสช. เขต 01/)).toBeDefined()
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
    expect(screen.getByText('การโอนเงิน (Budget Transfer)')).toBeDefined()
    expect(screen.getByText('0-Eclaim Data (ข้อมูลส่งเบิก)')).toBeDefined()
    expect(screen.getByText('1. บริการผู้ป่วยนอก (OP)')).toBeDefined()
    expect(screen.getByText('2. บริการผู้ป่วยใน (IP)')).toBeDefined()
    expect(screen.getByText('4. บริการค่าใช้จ่ายสูง (High Cost)')).toBeDefined()
    expect(screen.getByText('5. ส่งเสริมป้องกันโรค (PP)')).toBeDefined()
  })

  it('renders both multi-card sub-reports simultaneously matching Module 381', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    // Sub-report 1 (Bar Chart)
    expect(screen.getByText('รายรับโอนเงินจาก สปสช. ทุกกองทุน')).toBeDefined()
    expect(screen.getByText('ID: 1825')).toBeDefined()

    // Sub-report 2 (Table)
    expect(screen.getByText('รายรับ แยกรายกองทุนย่อย')).toBeDefined()
    expect(screen.getByText('ID: 1826')).toBeDefined()
    expect(screen.getByText('ชื่อกองทุน')).toBeDefined()
    expect(screen.getByText('งบประมาณ')).toBeDefined()
    expect(screen.getByText('กองทุนผู้ป่วยนอก')).toBeDefined()
    expect(screen.getByText('กองทุนผู้ป่วยใน')).toBeDefined()

    // Table Summary Footer (tfoot)
    expect(screen.getByText('รวม')).toBeDefined()
  })

  it('filters table rows when user types in search input', () => {
    render(
      <MisHosBudgetTrackerClient
        initialTemplate={mockTemplate}
        initialTableData={mockTableData}
        initialHospital={mockHospital}
      />
    )

    const searchInput = screen.getByLabelText(/ค้นหาข้อมูลในตาราง/)
    fireEvent.change(searchInput, { target: { value: 'ผู้ป่วยนอก' } })

    expect(screen.getByText('กองทุนผู้ป่วยนอก')).toBeDefined()
    expect(screen.queryByText('กองทุนผู้ป่วยใน')).toBeNull()
  })
})
