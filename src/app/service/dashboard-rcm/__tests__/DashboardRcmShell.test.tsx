import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardRcmShell from '../DashboardRcmShell'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/service/dashboard-rcm/funds/ccs/2',
}))

describe('DashboardRcmShell Component', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders sidebar brand with all groups default-collapsed and toggles properly', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div data-testid="test-content">Dashboard Content</div>
      </DashboardRcmShell>
    )

    expect(screen.getAllByText('Dashboard-RCM').length).toBeGreaterThan(0)
    expect(screen.getByText('โรงพยาบาลเถิน')).toBeInTheDocument()

    // Check main category group buttons — all must be collapsed (false) initially!
    const opdGroupBtn = screen.getByRole('button', { name: '2.1 ผู้ป่วยนอก & ทันตกรรม' })
    const fundsGroupBtn = screen.getByRole('button', { name: 'กองทุน' })
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'false')
    expect(fundsGroupBtn).toHaveAttribute('aria-expanded', 'false')
    // Active group has 'has-active' class indicating current location while collapsed
    expect(fundsGroupBtn.className).toContain('has-active')

    expect(screen.getByRole('button', { name: '2.2 บริการผู้ป่วยใน' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3.1 ข้อมูลการชดเชยค่าบริการ (REP)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5.2 การเงิน & รายรับ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Palliative Care' })).toBeInTheDocument()

    // Initially collapsed: links are not shown
    expect(screen.queryByRole('link', { name: /ประกันสังคมทำฟัน/ })).not.toBeInTheDocument()

    // Expand '2.1 ผู้ป่วยนอก & ทันตกรรม' -> shows links and saves true to localStorage
    fireEvent.click(opdGroupBtn)
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /ประกันสังคมทำฟัน/ })).toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_groups')).toContain('"opd-dental":true')

    // Collapse '2.1 ผู้ป่วยนอก & ทันตกรรม' again -> hides links and saves false to localStorage
    fireEvent.click(opdGroupBtn)
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /ประกันสังคมทำฟัน/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_groups')).toContain('"opd-dental":false')

    // Expand 'กองทุน' -> shows submenus
    fireEvent.click(fundsGroupBtn)
    expect(fundsGroupBtn).toHaveAttribute('aria-expanded', 'true')
    expect(localStorage.getItem('rcm_sidebar_expanded_groups')).toContain('"funds":true')

    // Inside 'กองทุน', submenus are also default-collapsed
    const ccsParentToggle = screen.getByRole('button', { name: /คัดกรองมะเร็งปากมดลูก \(CCS\)/ })
    expect(ccsParentToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /บริการ 1B005/ })).not.toBeInTheDocument()

    // Expand CCS submenu -> shows sublinks and saves to localStorage
    fireEvent.click(ccsParentToggle)
    expect(ccsParentToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /บริการ 1B005/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก/ })).toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_menus')).toContain('"/service/dashboard-rcm/funds/ccs":true')

    // Collapse CCS submenu -> hides sublinks and saves false to localStorage
    fireEvent.click(ccsParentToggle)
    expect(ccsParentToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /บริการ 1B005/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_menus')).toContain('"/service/dashboard-rcm/funds/ccs":false')

    // Assert other submenus are also accessible under กองทุน
    expect(screen.getByRole('button', { name: /บริการฝากครรภ์ \(ANC\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ธาลัสซีเมียในหญิงตั้งครรภ์/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /การตรวจหลังคลอด/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /การทดสอบการตั้งครรภ์/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /วางแผนครอบครัว & คุมกำเนิด \(FP\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /คัดกรองมะเร็งช่องปาก/ })).toBeInTheDocument()

    expect(screen.getByTestId('test-content')).toBeInTheDocument()
    expect(screen.getByText('← หน้าบริการ')).toBeInTheDocument()
  })

  it('restores open/close states from localStorage on refresh/reload without losing user preferences', () => {
    // Pre-populate localStorage with user preferences before mount
    localStorage.setItem(
      'rcm_sidebar_expanded_groups',
      JSON.stringify({ 'opd-dental': true, 'ipd': false })
    )
    localStorage.setItem(
      'rcm_sidebar_expanded_menus',
      JSON.stringify({ '/service/dashboard-rcm/funds/ccs': true })
    )

    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    // 'opd-dental' was saved as true -> should be restored as open
    const opdGroupBtn = screen.getByRole('button', { name: '2.1 ผู้ป่วยนอก & ทันตกรรม' })
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /ประกันสังคมทำฟัน/ })).toBeInTheDocument()

    // 'ipd' was saved as false -> should remain collapsed
    const ipdGroupBtn = screen.getByRole('button', { name: '2.2 บริการผู้ป่วยใน' })
    expect(ipdGroupBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /สรุปผู้ป่วยใน \(IPD\)/ })).not.toBeInTheDocument()
  })

  it('toggles sidebar width collapse state and persists to localStorage', () => {
    render(
      <DashboardRcmShell userRole="admin">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const toggleBtn = screen.getByLabelText(/Collapse sidebar|Expand sidebar/)
    expect(toggleBtn).toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(localStorage.getItem('rcm_sidebar_collapsed')).toBe('true')

    fireEvent.click(toggleBtn)
    expect(localStorage.getItem('rcm_sidebar_collapsed')).toBe('false')
  })
})
