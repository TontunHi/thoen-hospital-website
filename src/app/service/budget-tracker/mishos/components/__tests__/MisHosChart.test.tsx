import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MisHosChart from '../MisHosChart'

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  BarChart: ({ children, layout }: any) => <div data-testid="barchart" data-layout={layout}>{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: any) => <div data-testid="linechart">{children}</div>,
  Line: () => <div data-testid="line" />,
  PieChart: ({ children }: any) => <div data-testid="piechart">{children}</div>,
  Pie: ({ data }: any) => (
    <div data-testid="pie">
      {data?.map((d: any, idx: number) => (
        <span key={idx} data-testid={`slice-${d.name}`}>
          {d.name}: {d.value}
        </span>
      ))}
    </div>
  ),
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Cell: () => <div data-testid="cell" />,
}))

describe('MisHosChart Component', () => {
  it('renders a circular PieChart for single-row pass/fail ratio (SSID 423 / 422)', () => {
    // Exact response structure from NHSO MIS HOS upstream
    const mockPieRecords = [
      { 'ผ่าน': '3848', 'ไม่ผ่าน': '19' }
    ]

    render(
      <MisHosChart
        records={mockPieRecords}
        reportTitle="สัดส่วนความถูกต้องการส่งข้อมูลผู้ป่วยนอก (OP) สิทธิ UC"
        chartType="pie"
        chartConfig={{
          ssid: '423',
          reportName: 'สัดส่วนความถูกต้องการส่งข้อมูลผู้ป่วยนอก (OP) สิทธิ UC',
          chartType: 'pie',
          color: ['#10b981', '#ef4444'],
        }}
      />
    )

    expect(screen.getByTestId('piechart')).toBeDefined()
    expect(screen.getByTestId('pie')).toBeDefined()
    expect(screen.getByTestId('slice-ผ่าน')).toBeDefined()
    expect(screen.getByText(/ผ่าน: 3848/)).toBeDefined()
    expect(screen.getByTestId('slice-ไม่ผ่าน')).toBeDefined()
    expect(screen.getByText(/ไม่ผ่าน: 19/)).toBeDefined()
  })

  it('renders a circular PieChart for multi-row categorical data with name and value', () => {
    const mockMultiRecords = [
      { DESCRIPTION: 'กองทุน A', ACT_AMT: '5000' },
      { DESCRIPTION: 'กองทุน B', ACT_AMT: '2500' },
    ]

    render(
      <MisHosChart
        records={mockMultiRecords}
        reportTitle="สัดส่วนงบประมาณ"
        chartType="pie"
      />
    )

    expect(screen.getByTestId('piechart')).toBeDefined()
    expect(screen.getByText(/กองทุน A: 5000/)).toBeDefined()
    expect(screen.getByText(/กองทุน B: 2500/)).toBeDefined()
  })

  it('renders a horizontal bar chart (layout="vertical") for hospital breakdown (SSID 1223)', () => {
    const mockHospitalRecords = [
      { HNAME: 'รพ.เถิน', ACT_AMT_ALL: '436000' },
      { HNAME: 'รพ.สบปราบ', ACT_AMT_ALL: '326250' },
      { HNAME: 'รพ.เมืองปาน', ACT_AMT_ALL: '438500' },
    ]

    render(
      <MisHosChart
        records={mockHospitalRecords}
        reportTitle="ผลการชดเชยบริการผู้ป่วยประคับประคอง รายหน่วยบริการ"
        chartType="barhorizontal"
        chartConfig={{
          ssid: '1223',
          reportName: 'ผลการชดเชยบริการผู้ป่วยประคับประคอง รายหน่วยบริการ',
          chartType: 'barhorizontal',
          height: 520,
        }}
      />
    )

    const barChart = screen.getByTestId('barchart')
    expect(barChart).toBeDefined()
    expect(barChart.getAttribute('data-layout')).toBe('vertical')
    expect(screen.getByTestId('xaxis')).toBeDefined()
    expect(screen.getByTestId('yaxis')).toBeDefined()
  })
})
