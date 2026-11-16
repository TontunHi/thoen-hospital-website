import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import ProjectTrackerClient from '../ProjectTrackerClient'
import type { ProjectListResult, ProjectRecord } from '@/lib/projects/projectTrackerTypes'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}))

const mockItems: ProjectRecord[] = [
  {
    id: 1,
    fiscalYear: 2570,
    sequenceNo: 1,
    projectCode: '080101',
    strategy: 'ย.1',
    projectName: 'โครงการพัฒนาภาคีเครือข่ายสุขภาพ',
    responsibleUnit: 'ธนภัทร อุ่ยเจริญ',
    q1Budget: 3000,
    q2Budget: 20000,
    q3Budget: 0,
    q4Budget: 3500,
    allocatedBudget: 26500,
    actualSpent: 0,
    remainingBudget: 26500,
    disbursementRate: 0,
    submissionStatus: 'ส่งแล้ว',
    budgetSource: 'เงินบำรุง',
    notes: null,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 2,
    fiscalYear: 2570,
    sequenceNo: 2,
    projectCode: null,
    strategy: 'ย.2',
    projectName: 'โครงการพัฒนาระบบบริการผู้ป่วยภาวะติดเชื้อ',
    responsibleUnit: 'รุ่งอรุณ / กลุ่มการพยาบาล',
    q1Budget: 0,
    q2Budget: 0,
    q3Budget: 1200,
    q4Budget: 0,
    allocatedBudget: 1200,
    actualSpent: 0,
    remainingBudget: 1200,
    disbursementRate: 0,
    submissionStatus: 'ยังไม่ส่ง',
    budgetSource: 'เงินบำรุง',
    notes: null,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
]

const mockApiData: { success: true; data: ProjectListResult } = {
  success: true,
  data: {
    fiscalYear: 2570,
    availableFiscalYears: [2570],
    availableStrategies: ['ย.1', 'ย.2'],
    availableStatuses: ['ส่งแล้ว', 'ยังไม่ส่ง'],
    availableBudgetSources: ['เงินบำรุง'],
    items: mockItems,
    stats: {
      totalProjects: 2,
      submittedCount: 1,
      pendingCount: 1,
      noBudgetCount: 0,
      cancelledCount: 0,
      submissionRate: 50,
      allocatedBudgetTotal: 27700,
      actualSpentTotal: 0,
      remainingBudgetTotal: 27700,
      disbursementRate: 0,
      remainingRate: 100,
      byStrategy: [
        {
          strategy: 'ย.1',
          strategyTitle: 'ย.1',
          totalProjects: 1,
          submittedCount: 1,
          pendingCount: 0,
          noBudgetCount: 0,
          cancelledCount: 0,
          completionRate: 100,
          allocatedBudget: 26500,
          actualSpent: 0,
          remainingBudget: 26500,
        },
        {
          strategy: 'ย.2',
          strategyTitle: 'ย.2',
          totalProjects: 1,
          submittedCount: 0,
          pendingCount: 1,
          noBudgetCount: 0,
          cancelledCount: 0,
          completionRate: 0,
          allocatedBudget: 1200,
          actualSpent: 0,
          remainingBudget: 1200,
        },
      ],
      byStatus: {
        ส่งแล้ว: 1,
        ยังไม่ส่ง: 1,
      },
      byBudgetSource: [
        {
          label: 'เงินบำรุง',
          count: 2,
          allocatedBudget: 27700,
          actualSpent: 0,
        },
      ],
      byQuarter: [
        { quarter: 'ไตรมาส 1', key: 'q1Budget', allocatedBudget: 3000 },
        { quarter: 'ไตรมาส 2', key: 'q2Budget', allocatedBudget: 20000 },
        { quarter: 'ไตรมาส 3', key: 'q3Budget', allocatedBudget: 1200 },
        { quarter: 'ไตรมาส 4', key: 'q4Budget', allocatedBudget: 3500 },
      ],
    },
  },
}

describe('ProjectTrackerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiData,
    } as Response)
  })

  it('renders dashboard KPIs, dynamic filters without hardcoded phantom options, and hides write actions in view-only mode', async () => {
    render(<ProjectTrackerClient userRole="member" canManage={false} />)

    await waitFor(() => {
      expect(screen.getByText('โครงการพัฒนาภาคีเครือข่ายสุขภาพ')).toBeInTheDocument()
    })

    expect(screen.getByText('สิทธิ์ดูข้อมูลอย่างเดียว')).toBeInTheDocument()
    expect(screen.getAllByText('50.0%').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: /เพิ่มโครงการ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /นำเข้า Excel/ })).not.toBeInTheDocument()

    // Filter dropdowns should reflect only options actually present in DB
    const fySelect = screen.getByLabelText('เลือกปีงบประมาณ')
    expect(within(fySelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'ปีงบประมาณ 2570',
    ])

    const strategySelect = screen.getByLabelText('กรองตามยุทธศาสตร์')
    expect(within(strategySelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'ทุกยุทธศาสตร์ (2)',
      'ย.1',
      'ย.2',
    ])

    const statusSelect = screen.getByLabelText('กรองตามสถานะการส่งงาน')
    expect(within(statusSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'ทุกสถานะ (2)',
      'ส่งแล้ว',
      'ยังไม่ส่ง',
    ])
  })

  it('allows creating a new project via easy form modal with live Q1-Q4 budget calculation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockApiData } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockItems[0] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockApiData } as Response)
    global.fetch = fetchMock

    render(<ProjectTrackerClient userRole="member" canManage={true} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /เพิ่มโครงการ/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /เพิ่มโครงการ/ }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/ชื่อโครงการ/), {
      target: { value: 'โครงการอบรมเชิงปฏิบัติการ' },
    })
    fireEvent.change(within(dialog).getByLabelText(/ไตรมาส 1/), {
      target: { value: '4500' },
    })
    fireEvent.change(within(dialog).getByLabelText(/ไตรมาส 2/), {
      target: { value: '5500' },
    })

    // Live auto-sum preview should display ฿10,000
    expect(within(dialog).getAllByText('฿10,000').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(within(dialog).getByRole('button', { name: 'เพิ่มโครงการ' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/service/project-tracker',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('supports inline spreadsheet editing when user has manage permission', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockApiData } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockItems[1], actualSpent: 1200 } }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockApiData } as Response)
    global.fetch = fetchMock

    render(<ProjectTrackerClient userRole="admin" canManage={true} />)

    await waitFor(() => {
      expect(screen.getByText('โครงการพัฒนาระบบบริการผู้ป่วยภาวะติดเชื้อ')).toBeInTheDocument()
    })

    // No pencil edit button should exist (sheet-only editing)
    expect(
      screen.queryByRole('button', {
        name: /แก้ไข โครงการพัฒนาระบบบริการผู้ป่วยภาวะติดเชื้อ/,
      })
    ).not.toBeInTheDocument()

    // Click inline status cell for row 1
    const cells = screen.getAllByRole('gridcell')
    const spentCell = cells.find((c) => c.getAttribute('title') === 'คลิกเพื่อแก้ไข งบประมาณใช้จริง')
    expect(spentCell).toBeDefined()
    fireEvent.click(spentCell!)

    const input = await screen.findByLabelText(/กรอก งบประมาณใช้จริง ของ โครงการพัฒนาภาคีเครือข่ายสุขภาพ/)
    fireEvent.change(input, { target: { value: '5000' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/service/project-tracker/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ actualSpent: 5000 }),
        })
      )
    })

    // Local PATCH state update should not fire a redundant GET
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('hydrates from SSR initialData and filters client-side without extra API calls', () => {
    render(
      <ProjectTrackerClient
        userRole="member"
        canManage={false}
        initialData={mockApiData.data}
        initialError={null}
      />
    )

    expect(screen.getByText('โครงการพัฒนาภาคีเครือข่ายสุขภาพ')).toBeInTheDocument()
    expect(screen.getByText('โครงการพัฒนาระบบบริการผู้ป่วยภาวะติดเชื้อ')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()

    // Filter by strategy locally
    fireEvent.change(screen.getByLabelText('กรองตามยุทธศาสตร์'), {
      target: { value: 'ย.1' },
    })

    expect(screen.getByText('โครงการพัฒนาภาคีเครือข่ายสุขภาพ')).toBeInTheDocument()
    expect(screen.queryByText('โครงการพัฒนาระบบบริการผู้ป่วยภาวะติดเชื้อ')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
