import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminLayoutClient from '../AdminLayoutClient'

let mockPathname = '/member/news'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('AdminLayoutClient Component', () => {
  it('renders the executive hospital portal header and Hallmark navigation tabs without contacts', () => {
    mockPathname = '/member/news'
    render(
      <AdminLayoutClient>
        <div data-testid="child-content">หน้าเนื้อหา CMS</div>
      </AdminLayoutClient>
    )

    // Check header title and badge
    expect(screen.getByText('ระบบจัดการข่าวสารและสื่อประชาสัมพันธ์')).toBeDefined()
    expect(screen.getByText('โรงพยาบาลเถิน CMS')).toBeDefined()
    expect(screen.getByText('กลับสู่แดชบอร์ดสมาชิก')).toBeDefined()
    expect(screen.getByText('ดูหน้าเว็บข่าวจริง')).toBeDefined()
    expect(screen.getByText('เขียนข่าวใหม่')).toBeDefined()

    // Check Hallmark subnav horizontal tabs (3 core tabs)
    expect(screen.getByText('ภาพรวมแดชบอร์ด')).toBeDefined()
    expect(screen.getByText('ข่าวสารและกิจกรรม')).toBeDefined()
    expect(screen.getByText('ป้ายสไลด์ประชาสัมพันธ์')).toBeDefined()

    // Contacts tab should NOT be rendered
    expect(screen.queryByText('ข้อความติดต่อสอบถาม')).toBeNull()

    // Check child rendered
    expect(screen.getByTestId('child-content')).toBeDefined()
  })

  it('highlights the active navigation tab based on the current pathname', () => {
    mockPathname = '/member/news/slides'
    render(
      <AdminLayoutClient>
        <div>Slides</div>
      </AdminLayoutClient>
    )

    const slidesTab = screen.getByText('ป้ายสไลด์ประชาสัมพันธ์').closest('a')
    expect(slidesTab?.className).toContain('active')
  })
})
