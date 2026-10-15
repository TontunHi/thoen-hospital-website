import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfileBanner from '../ProfileBanner'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

describe('ProfileBanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders signature status chip with "มีแล้ว" when member has signature', () => {
    render(
      <ProfileBanner
        member={{
          id: 1,
          username: 'somchai',
          email: 'somchai@hospital.com',
          name: 'นายสมชาย ใจดี',
          department: 'เทคโนโลยีสารสนเทศ',
          position: 'นักวิชาการคอมพิวเตอร์',
          profile_path: null,
          role: 'member',
          hasSignature: true,
        }}
        initials="สม"
        displayRole="เจ้าหน้าที่"
        isTelegramLinked={true}
      />
    )

    expect(screen.getByText('ลายเซ็น')).toBeDefined()
    expect(screen.getByText('มีแล้ว')).toBeDefined()
    const link = screen.getByTitle('ดูลายมือชื่ออิเล็กทรอนิกส์ของคุณ')
    expect(link.getAttribute('href')).toBe('/member/signature')
  })

  it('renders signature status chip with "ยังไม่มีลายเซ็น" when member lacks signature', () => {
    render(
      <ProfileBanner
        member={{
          id: 2,
          username: 'somying',
          email: 'somying@hospital.com',
          name: 'นางสมหญิง มั่นคง',
          department: 'ผู้ป่วยใน',
          position: 'พยาบาลวิชาชีพ',
          profile_path: null,
          role: 'member',
          hasSignature: false,
        }}
        initials="สม"
        displayRole="เจ้าหน้าที่"
        isTelegramLinked={false}
      />
    )

    expect(screen.getByText('ลายเซ็น')).toBeDefined()
    expect(screen.getByText('ยังไม่มีลายเซ็น')).toBeDefined()
    const link = screen.getByTitle('คลิกเพื่อบันทึกลายมือชื่ออิเล็กทรอนิกส์')
    expect(link.getAttribute('href')).toBe('/member/signature')
  })

  it('does not display signature chip for subdistrict users', () => {
    render(
      <ProfileBanner
        member={{
          id: 3,
          username: 'sub01',
          email: 'sub@hospital.com',
          name: 'รพ.สต. ดอนไฟ',
          department: null,
          position: null,
          profile_path: null,
          role: 'subdistrict',
          hasSignature: false,
        }}
        initials="ดฟ"
        displayRole="รพ.สต."
        isTelegramLinked={false}
      />
    )

    expect(screen.queryByText('ลายเซ็น')).toBeNull()
  })
})
