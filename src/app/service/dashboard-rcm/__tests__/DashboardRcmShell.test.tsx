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
    expect(screen.getByRole('button', { name: /คัดกรองสุขภาพกาย\/จิต/ })).toBeInTheDocument()

    // Nested sub-submenus under Rehabilitation are also default-collapsed initially
    const rehabParentBtn = screen.getByRole('button', { name: /กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์/ })
    expect(rehabParentBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /รายการการให้บริการฟื้นฟูสมรรถภาพ/ })).not.toBeInTheDocument()

    // Expand Rehabilitation -> shows its submenus, which are also collapsed by default
    fireEvent.click(rehabParentBtn)
    expect(rehabParentBtn).toHaveAttribute('aria-expanded', 'true')
    const rehabServicesSubBtn = screen.getByRole('button', { name: /รายการการให้บริการฟื้นฟูสมรรถภาพ/ })
    expect(rehabServicesSubBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /เว็บ Disability/ })).not.toBeInTheDocument()

    // Expand Services sub-submenu -> shows Disability link and saves to localStorage
    fireEvent.click(rehabServicesSubBtn)
    expect(rehabServicesSubBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /เว็บ Disability/ })).toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_menus')).toContain('"/service/dashboard-rcm/funds/rehabilitation/services":true')

    // Collapse Services sub-submenu -> closes Disability link and saves false
    fireEvent.click(rehabServicesSubBtn)
    expect(rehabServicesSubBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /เว็บ Disability/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_menus')).toContain('"/service/dashboard-rcm/funds/rehabilitation/services":false')

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

  it('performs instant quick search across all RCM endpoints by keyword and ADP code', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const searchInput = screen.getByPlaceholderText(/ค้นหาเมนู/i)
    expect(searchInput).toBeInTheDocument()

    // 1. Search for ADP code "12003"
    fireEvent.change(searchInput, { target: { value: '12003' } })
    expect(screen.getByText(/ผลการค้นหา/)).toBeInTheDocument()
    expect(screen.getByText(/Fasting Plasma Glucose/)).toBeInTheDocument()

    // 2. Search for Thai keyword "มะเร็ง"
    fireEvent.change(searchInput, { target: { value: 'มะเร็ง' } })
    expect(
      screen.getAllByText(/รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก/).length
    ).toBeGreaterThan(0)
    expect(screen.getByText(/คัดกรองรอยโรคมะเร็งช่องปาก/)).toBeInTheDocument()

    // 3. Search for unmatched term -> empty state
    fireEvent.change(searchInput, { target: { value: 'xyzไม่มีในระบบ999' } })
    expect(screen.getByText(/ไม่พบเมนูที่ตรงกับ/)).toBeInTheDocument()

    // 4. Clear search via reset button
    const clearBtn = screen.getByRole('button', { name: 'ล้างคำค้นหา' })
    fireEvent.click(clearBtn)
    expect(searchInput).toHaveValue('')
    // Restores default categories
    expect(screen.getByRole('button', { name: 'กองทุน' })).toBeInTheDocument()
  })

  it('renders clean compact tooltip on collapsed sidebar item hover without bloated text', () => {
    // Pre-populate collapsed sidebar
    localStorage.setItem('rcm_sidebar_collapsed', 'true')

    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    // In collapsed mode, hover an item link
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)

    // Mouse enter on first navigation link wrapper
    const firstNavItem = links[0].closest('li')
    expect(firstNavItem).toBeInTheDocument()
    if (firstNavItem) {
      fireEvent.mouseEnter(firstNavItem)
      // Tooltip appears cleanly without long text
      const tooltip = document.querySelector('.rcm-collapsed-tooltip')
      expect(tooltip).toBeInTheDocument()

      fireEvent.mouseLeave(firstNavItem)
      expect(document.querySelector('.rcm-collapsed-tooltip')).not.toBeInTheDocument()
    }
  })

  it('supports interactive drag-to-resize sidebar width and double-click reset', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' })
    expect(resizeHandle).toBeInTheDocument()

    const sidebar = screen.getByRole('complementary', { name: 'Dashboard RCM Navigation' })
    expect(sidebar).toHaveStyle({ width: '260px' })

    // Simulate drag resize to 350px
    fireEvent.mouseDown(resizeHandle)
    fireEvent.mouseMove(window, { clientX: 350 })
    fireEvent.mouseUp(window)

    expect(sidebar).toHaveStyle({ width: '350px' })
    expect(localStorage.getItem('rcm_sidebar_width')).toBe('350')

    // Double-click to reset back to default 260px
    fireEvent.doubleClick(resizeHandle)
    expect(sidebar).toHaveStyle({ width: '260px' })
    expect(localStorage.getItem('rcm_sidebar_width')).toBe('260')
  })
})
