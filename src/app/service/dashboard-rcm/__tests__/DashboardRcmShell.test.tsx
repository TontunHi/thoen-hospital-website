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

  it('renders sidebar brand, collapsible main groups, and nested CCS submenu', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div data-testid="test-content">Dashboard Content</div>
      </DashboardRcmShell>
    )

    expect(screen.getAllByText('Dashboard-RCM').length).toBeGreaterThan(0)
    expect(screen.getByText('โรงพยาบาลเถิน')).toBeInTheDocument()

    // Check main category group buttons
    const opdGroupBtn = screen.getByRole('button', { name: '2.1 ผู้ป่วยนอก & ทันตกรรม' })
    const fundsGroupBtn = screen.getByRole('button', { name: 'กองทุน' })
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'true')
    expect(fundsGroupBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '2.2 บริการผู้ป่วยใน' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3.1 ข้อมูลการชดเชยค่าบริการ (REP)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5.2 การเงิน & รายรับ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Palliative Care' })).toBeInTheDocument()

    // Collapse & re-expand a main category group ('2.1 ผู้ป่วยนอก & ทันตกรรม')
    expect(screen.getByRole('link', { name: /ประกันสังคมทำฟัน/ })).toBeInTheDocument()
    fireEvent.click(opdGroupBtn)
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /ประกันสังคมทำฟัน/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('rcm_sidebar_expanded_groups')).toContain('"opd-dental":false')

    fireEvent.click(opdGroupBtn)
    expect(opdGroupBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /ประกันสังคมทำฟัน/ })).toBeInTheDocument()

    // Collapse the currently active main group ('กองทุน') -> marks button with has-active
    fireEvent.click(fundsGroupBtn)
    expect(fundsGroupBtn).toHaveAttribute('aria-expanded', 'false')
    expect(fundsGroupBtn.className).toContain('has-active')
    expect(screen.queryByRole('link', { name: /รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก/ })).not.toBeInTheDocument()

    // Re-expand 'กองทุน' and toggle nested CCS submenu
    fireEvent.click(fundsGroupBtn)
    const parentToggle = screen.getByRole('button', { name: /คัดกรองมะเร็งปากมดลูก \(CCS\)/ })
    fireEvent.click(parentToggle)
    expect(screen.queryByRole('link', { name: /รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก/ })).not.toBeInTheDocument()
    fireEvent.click(parentToggle)
    expect(screen.getByRole('link', { name: /บริการ 1B005/ })).toBeInTheDocument()

    // Assert ANC navigation under กองทุน
    expect(screen.getByRole('button', { name: /บริการฝากครรภ์ \(ANC\)/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2\.3.*ตรวจช่องปาก/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /บริการ 30011/ })).toBeInTheDocument()

    // Assert Thalassemia navigation under กองทุน
    expect(screen.getByRole('button', { name: /ธาลัสซีเมียในหญิงตั้งครรภ์/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /3\.1.*คัดกรองธาลัสซีเมีย/ })).toBeInTheDocument()

    // Assert Postpartum navigation under กองทุน
    expect(screen.getByRole('button', { name: /การตรวจหลังคลอด/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /7\.2.*การตรวจหลังคลอด/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /7\.3.*การจ่ายยา/ })).toBeInTheDocument()

    // Assert Pregnancy Test navigation under กองทุน
    expect(screen.getByRole('button', { name: /การทดสอบการตั้งครรภ์/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /8\.1.*การทดสอบการตั้งครรภ์/ })).toBeInTheDocument()

    // Assert Family Planning navigation under กองทุน
    expect(screen.getByRole('button', { name: /วางแผนครอบครัว & คุมกำเนิด \(FP\)/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /9\.1.*วางแผนครอบครัว/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /9\.2.*บริการใส่ห่วงอนามัย/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /9\.3\.1.*รายการฝังยาคุม/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /9\.3\.2.*รายการถอดยาคุม/ })).toBeInTheDocument()

    expect(screen.getByTestId('test-content')).toBeInTheDocument()
    expect(screen.getByText('← หน้าบริการ')).toBeInTheDocument()
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
