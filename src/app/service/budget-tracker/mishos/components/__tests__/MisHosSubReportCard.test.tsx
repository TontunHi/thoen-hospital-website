import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MisHosSubReportCard from '../MisHosSubReportCard'

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  CartesianGrid: () => <div />,
  Cell: () => <div />,
}))

describe('MisHosSubReportCard Component', () => {
  it('safely handles numeric numbers without chartConfig (regression test for firstVal?.includes is not a function)', () => {
    // Upstream data with raw numbers
    const mockNumericRecords = [
      { YEAR: '2567', NUMPT_OP: 2, ACT_AMT_OP: 80, NUMPT_IP: 0, ACT_AMT_IP: 0, TOTAL_AMT: 80 },
      { YEAR: '2568', NUMPT_OP: 14, ACT_AMT_OP: 1040.5, NUMPT_IP: 0, ACT_AMT_IP: 0, TOTAL_AMT: 1040.5 },
      { YEAR: '2569', NUMPT_OP: 9, ACT_AMT_OP: 1137.5, NUMPT_IP: 0, ACT_AMT_IP: 0, TOTAL_AMT: 1137.5 },
    ]

    const subReport = {
      ssid: 'custom:m0402_cancer_year_table',
      report_name: 'บริการเคมีบำบัดหรือฮอร์โมนหรือรังสีรักษาสำหรับผู้ป่วยโรคมะเร็ง แยกรายปีงบประมาณ',
      chart_type: 'table',
      report_width: '6',
      flag_data: 'Y',
    }

    // Render with null chartConfig to trigger heuristic path where firstVal is a number
    const { container } = render(
      <MisHosSubReportCard
        subReport={subReport}
        records={mockNumericRecords}
        chartConfig={null}
        selectedYear="2569"
        hcode="11152"
        hname="รพ.เถิน"
      />
    )

    expect(screen.getByText('บริการเคมีบำบัดหรือฮอร์โมนหรือรังสีรักษาสำหรับผู้ป่วยโรคมะเร็ง แยกรายปีงบประมาณ')).toBeDefined()
    expect(screen.getByText('2567')).toBeDefined()
    expect(screen.getAllByText('1,040.50').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1,137.50').length).toBeGreaterThan(0)
    // Verify table rendered successfully without crashing
    const table = container.querySelector('table')
    expect(table).not.toBeNull()
  })

  it('renders custom table headers when chartConfig is provided', () => {
    const mockRecords = [
      { YEAR: '2568', NUMPT_STROKE: 15, ACTAMT_STROKE: 735000, NUMPT_STEMI: 0, ACTAMT_STEMI: 0, TOTAL_AMT: 735000 },
    ]

    const subReport = {
      ssid: 'custom:m0401_stemi_year_table',
      report_name: 'บริการกรณี ยาละลายลิ่มเลือด แยกรายปีงบประมาณ',
      chart_type: 'table',
      report_width: '6',
      flag_data: 'Y',
    }

    const chartConfig = {
      ssid: 'custom:m0401_stemi_year_table',
      reportName: 'บริการกรณี ยาละลายลิ่มเลือด แยกรายปีงบประมาณ',
      chartType: 'table',
      table_header: [
        'ปีงบประมาณ',
        'STROKE จำนวน (ครั้ง),0',
        'STROKE ชดเชย (บาท),0',
        'STEMI จำนวน (ครั้ง),0',
        'STEMI ชดเชย (บาท),0',
        'รวม (บาท),0',
      ],
    }

    render(
      <MisHosSubReportCard
        subReport={subReport}
        records={mockRecords}
        chartConfig={chartConfig}
        selectedYear="2569"
        hcode="11152"
        hname="รพ.เถิน"
      />
    )

    expect(screen.getByText('STROKE จำนวน (ครั้ง)')).toBeDefined()
    expect(screen.getByText('STROKE ชดเชย (บาท)')).toBeDefined()
    expect(screen.getAllByText('735,000').length).toBeGreaterThan(0)
  })
})
