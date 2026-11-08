import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardRcmShell from '../DashboardRcmShell'

// Mock next/navigation for rehabilitation services disability-services route
vi.mock('next/navigation', () => ({
  usePathname: () =>
    '/service/dashboard-rcm/funds/rehabilitation/services/disability-services',
}))

describe('DashboardRcmShell Rehabilitation Breadcrumb & Navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders exact 4-level breadcrumbs: กองทุน -> กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์ -> รายการการให้บริการฟื้นฟูสมรรถภาพ -> รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability', () => {
    render(
      <DashboardRcmShell userRole="staff">
        <div>Rehab Content</div>
      </DashboardRcmShell>
    )

    const breadcrumbNav = screen.getByLabelText('Breadcrumb')
    expect(breadcrumbNav).toBeInTheDocument()

    const bc = within(breadcrumbNav)

    // Base breadcrumb: บริการ / Dashboard-RCM
    expect(bc.getByRole('link', { name: 'บริการ' })).toBeInTheDocument()
    expect(bc.getByText('Dashboard-RCM')).toBeInTheDocument()

    // Level 1: กองทุน
    expect(bc.getByText('กองทุน')).toBeInTheDocument()

    // Level 2: กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์
    expect(
      bc.getByText('กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์')
    ).toBeInTheDocument()

    // Level 3: รายการการให้บริการฟื้นฟูสมรรถภาพ
    expect(
      bc.getByText('รายการการให้บริการฟื้นฟูสมรรถภาพ')
    ).toBeInTheDocument()

    // Level 4: รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability
    expect(
      bc.getByText('รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability')
    ).toBeInTheDocument()
  })
})
