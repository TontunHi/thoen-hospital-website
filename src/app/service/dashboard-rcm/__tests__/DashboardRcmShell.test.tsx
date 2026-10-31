import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardRcmShell from '../DashboardRcmShell'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/service/dashboard-rcm/sss-dental',
}))

describe('DashboardRcmShell Component', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders sidebar brand and navigation groups', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div data-testid="test-content">Dashboard Content</div>
      </DashboardRcmShell>
    )

    // Check brand
    expect(screen.getAllByText('Dashboard-RCM').length).toBeGreaterThan(0)
    expect(screen.getByText('โรงพยาบาลเถิน')).toBeInTheDocument()

    // Check category groups
    expect(screen.getAllByText('2.1 ผู้ป่วยนอก & ทันตกรรม').length).toBeGreaterThan(0)
    expect(screen.getByText('2.2 บริการผู้ป่วยใน')).toBeInTheDocument()
    expect(screen.getByText('5.2 การเงิน & รายรับ')).toBeInTheDocument()

    // Check tabs
    expect(screen.getAllByText('ประกันสังคมทำฟัน').length).toBeGreaterThan(0)
    expect(screen.getByText('OPD ตามสิทธิ์')).toBeInTheDocument()
    expect(screen.getByText('สรุปผู้ป่วยใน (IPD)')).toBeInTheDocument()
    expect(screen.getByText('สรุปรายรับจาก Invoice')).toBeInTheDocument()

    // Check breadcrumbs and content
    expect(screen.getByTestId('test-content')).toBeInTheDocument()
    expect(screen.getByText('เชื่อมต่อ HOSxP สด')).toBeInTheDocument()
  })

  it('toggles collapse state and persists to localStorage', () => {
    render(
      <DashboardRcmShell userRole="admin">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const toggleBtn = screen.getByLabelText(/Collapse sidebar|Expand sidebar/)
    expect(toggleBtn).toBeInTheDocument()

    // Click collapse
    fireEvent.click(toggleBtn)
    expect(localStorage.getItem('rcm_sidebar_collapsed')).toBe('true')

    // Click again to expand
    fireEvent.click(toggleBtn)
    expect(localStorage.getItem('rcm_sidebar_collapsed')).toBe('false')
  })
})
