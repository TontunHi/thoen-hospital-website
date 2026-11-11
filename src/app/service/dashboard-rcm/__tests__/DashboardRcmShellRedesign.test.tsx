import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardRcmShell from '../DashboardRcmShell'

// Mock next/navigation to a deep nested page
vi.mock('next/navigation', () => ({
  usePathname: () => '/service/dashboard-rcm/funds/telemed-drug/telemed',
}))

describe('DashboardRcmShell Redesign Plan Compliance', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('complies with Row Anatomy: shows code column without decorative icons, and labels without parentheses code', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    // Expand 'กองทุน' group
    const fundsGroupBtn = screen.getByRole('button', { name: 'กองทุน' })
    fireEvent.click(fundsGroupBtn)

    // Check code column "11" for Telemedicine & Drug
    const telemedToggle = screen.getByRole('button', { name: /ระบบ Telemedicine & Drug/ })
    expect(telemedToggle).toBeInTheDocument()
    expect(within(telemedToggle).getByText('11')).toBeInTheDocument()

    // Ensure label does NOT contain duplicate "(11)" or redundant parentheses
    expect(within(telemedToggle).getByText('ระบบ Telemedicine & Drug')).toBeInTheDocument()

    // Expand Telemed module
    fireEvent.click(telemedToggle)

    // Check subpages: "บริการ Telemed" and "ยาไปรษณีย์ Drug" without duplicate badge prefixes
    const telemedLink = screen.getByRole('link', { name: /บริการ Telemed/ })
    expect(telemedLink).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ยาไปรษณีย์ Drug/ })).toBeInTheDocument()

    // Single Highlight rule: active page has 'is-active', parent has 'branch-active' but NOT 'is-active'
    expect(telemedLink.className).toContain('is-active')
    expect(telemedToggle.className).toContain('branch-active')
    expect(telemedToggle.className).not.toContain('is-active')
  })

  it('supports pinning (ปักหมุด) up to 5 items and displays pinned section', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    // Initially no pinned section
    expect(screen.queryByText(/ปักหมุด/)).not.toBeInTheDocument()

    // Expand OPD group
    const opdGroupBtn = screen.getByRole('button', { name: '2.1 ผู้ป่วยนอก & ทันตกรรม' })
    fireEvent.click(opdGroupBtn)

    // Pin "ประกันสังคมทำฟัน"
    const pinBtns = screen.getAllByRole('button', { name: 'Pin' })
    expect(pinBtns.length).toBeGreaterThan(0)
    fireEvent.click(pinBtns[0])

    // Pinned section appears with 1 item
    expect(screen.getByText('ปักหมุด (1/5)')).toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_pinned')).toContain('/service/dashboard-rcm/sss-dental')

    // Unpin item
    const unpinBtn = screen.getByRole('button', { name: 'Unpin' })
    fireEvent.click(unpinBtn)
    expect(screen.queryByText(/ปักหมุด/)).not.toBeInTheDocument()
  })

  it('supports density toggle (comfortable 40px vs compact 32px)', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const sidebar = screen.getByRole('complementary', { name: 'Dashboard RCM Navigation' })
    expect(sidebar.className).toContain('density-comfortable')

    // Toggle density
    const densityBtn = screen.getByRole('button', { name: 'Toggle row density' })
    fireEvent.click(densityBtn)

    expect(sidebar.className).toContain('density-compact')
    expect(localStorage.getItem('rcm_sidebar_density')).toBe('compact')

    // Toggle back
    fireEvent.click(densityBtn)
    expect(sidebar.className).toContain('density-comfortable')
    expect(localStorage.getItem('rcm_sidebar_density')).toBe('comfortable')
  })

  it('renders Rail mode (64px) with code centered and flyout on hover', () => {
    localStorage.setItem('rcm_sidebar_collapsed', 'true')

    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const sidebar = screen.getByRole('complementary', { name: 'Dashboard RCM Navigation' })
    expect(sidebar.className).toContain('collapsed')

    // In rail mode, items render only codes
    expect(screen.getByText('2.1.1')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()

    // Hover over rail item "11"
    const railItems = document.querySelectorAll('.rcm-rail-item')
    expect(railItems.length).toBeGreaterThan(0)

    const item11 = Array.from(railItems).find((el) => el.textContent?.includes('11'))
    expect(item11).toBeDefined()

    if (item11) {
      fireEvent.mouseEnter(item11)
      const flyout = document.querySelector('.rcm-rail-flyout')
      expect(flyout).toBeInTheDocument()
      expect(within(flyout as HTMLElement).getByText('ระบบ Telemedicine & Drug')).toBeInTheDocument()

      fireEvent.mouseLeave(item11)
    }
  })

  it('renders dedicated bottom footer with unblocked link to /service', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Content</div>
      </DashboardRcmShell>
    )

    const footerLink = screen.getByRole('link', { name: /กลับหน้าบริการ/ })
    expect(footerLink).toBeInTheDocument()
    expect(footerLink).toHaveAttribute('href', '/service')
  })
})
