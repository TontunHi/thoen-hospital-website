import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpdClient from '../OpdClient'
import { OpdDepartmentSummaryItem } from '@/lib/clinical/rcmDashboardService'

const mockDeptData: OpdDepartmentSummaryItem[] = [
  { dept_group: '01. อายุรกรรม', patients: 1000, visits: 3000 }, // 3.00 visits/pt (>= 1.2x avg)
  { dept_group: '02. ทันตกรรม', patients: 1000, visits: 1500 }, // 1.50 visits/pt
  { dept_group: '03. ศัลยกรรม', patients: 500, visits: 500 },   // 1.00 visits/pt
  { dept_group: '04. คลินิกพิเศษเล็ก', patients: 2, visits: 10 }, // tiny base (<5): ignored in intensity watch
  { dept_group: '05. แผนกปิดปรับปรุง', patients: 0, visits: 0 }, // zero row
  { dept_group: 'รวมทั้งหมด', patients: 2502, visits: 5010 },
]

describe('OpdClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true, data: mockDeptData }),
    } as unknown as Response)
  })

  it('renders known KPI totals and skips fetch when initialData is supplied', () => {
    render(<OpdClient initialData={mockDeptData} />)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('2.1.1.3')).toBeInTheDocument()
    expect(screen.getAllByText('2,502').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5,010').length).toBeGreaterThan(0)
    expect(screen.getAllByText('อายุรกรรม').length).toBeGreaterThan(0)
    // Zero-row hidden by default
    expect(screen.queryByText('แผนกปิดปรับปรุง')).not.toBeInTheDocument()
  })

  it('switches chart metric between visits and patients and honors tiny-base guard in bullet graph', () => {
    render(<OpdClient initialData={mockDeptData} />)

    // Tiny base (< 5 patients) must not shout in the Intensity Watch bullet list
    const bulletPanel = screen.getByLabelText('ความถี่การมารับบริการ (ครั้ง/คน)')
    expect(bulletPanel.textContent).not.toContain('คลินิกพิเศษเล็ก')
    expect(bulletPanel.textContent).toContain('อายุรกรรม')

    // Switch to patients metric via KPI tile
    fireEvent.click(screen.getByRole('button', { name: /ผู้ป่วยนอกรวม \(คน\)/ }))
    expect(screen.getByText('10 อันดับแผนกตามจำนวนผู้ป่วย (HN)')).toBeInTheDocument()
  })

  it('fetches with AbortController signal when initialData is omitted', async () => {
    render(<OpdClient />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/opd-dept-summary'),
        expect.anything()
      )
      expect(screen.getAllByText('5,010').length).toBeGreaterThan(0)
    })
  })
})
