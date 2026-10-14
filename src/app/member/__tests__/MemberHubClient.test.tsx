import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemberHubClient from '../MemberHubClient'
import { MemberPortalServiceItem } from '../types'

describe('MemberHubClient Component', () => {
  const mockServices: MemberPortalServiceItem[] = [
    {
      id: 'inbox',
      title: 'กล่องงานและคำร้อง',
      description: 'ตรวจสอบและพิจารณาอนุมัติงานที่ส่งถึงคุณ',
      href: '/member/inbox',
      icon: 'inbox',
      category: 'daily',
      isHero: true,
      keywords: ['กล่องงาน', 'inbox', 'คำร้อง'],
      badge: { text: '2 งานรอคุณ', variant: 'alert', pulse: true },
    },
    {
      id: 'repair',
      title: 'แจ้งซ่อมบำรุงและอุปกรณ์',
      description: 'ยื่นคำขอแจ้งซ่อมคอมพิวเตอร์',
      href: '/member/repairs/new',
      icon: 'build',
      category: 'daily',
      isHero: true,
      keywords: ['ซ่อม', 'repair', 'คอมพิวเตอร์'],
    },
    {
      id: 'assets',
      title: 'ระบบจัดการข้อมูลครุภัณฑ์',
      description: 'ตรวจสอบทะเบียนครุภัณฑ์โรงพยาบาล',
      href: '/member/assets',
      icon: 'devices_other',
      category: 'system',
      keywords: ['ครุภัณฑ์', 'asset'],
    },
    {
      id: 'admin_settings',
      title: 'เปิด/ปิดฟังก์ชันและตั้งค่าระบบ',
      description: 'จัดการสิทธิ์และควบคุมการเข้าใช้งาน',
      href: '/member/settings',
      icon: 'admin_panel_settings',
      category: 'admin',
      keywords: ['ตั้งค่า', 'settings', 'admin'],
    },
  ]

  beforeEach(() => {
    localStorage.clear()
  })

  it('renders search input, category tabs, and services without any SVG tags', () => {
    const { container } = render(
      <MemberHubClient
        services={mockServices}
        pendingInboxCount={2}
        pendingRegistrationsCount={0}
        isAdmin={true}
      />
    )

    // Verify search input and tabs exist
    expect(screen.getByPlaceholderText(/ค้นหาบริการหรือโมดูล/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ทั้งหมด/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /งานประจำวัน/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ระบบสารสนเทศ/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ผู้ดูแลระบบ/i })).toBeInTheDocument()

    // Verify daily services render on default calm view
    expect(screen.getByText('กล่องงานและคำร้อง')).toBeInTheDocument()
    expect(screen.getByText('แจ้งซ่อมบำรุงและอุปกรณ์')).toBeInTheDocument()

    // Non-daily services are comfortably hidden by default to prevent visual clutter
    expect(screen.queryByText('ระบบจัดการข้อมูลครุภัณฑ์')).not.toBeInTheDocument()
    expect(screen.queryByText('เปิด/ปิดฟังก์ชันและตั้งค่าระบบ')).not.toBeInTheDocument()

    // Switching to 'ทั้งหมด' tab reveals all services
    const allTab = screen.getByRole('tab', { name: /ทั้งหมด/i })
    fireEvent.click(allTab)
    expect(screen.getByText('ระบบจัดการข้อมูลครุภัณฑ์')).toBeInTheDocument()
    expect(screen.getByText('เปิด/ปิดฟังก์ชันและตั้งค่าระบบ')).toBeInTheDocument()

    // STRICT CONSTRAINT: Verify ZERO svg tags in rendered container
    const svgElements = container.querySelectorAll('svg')
    expect(svgElements.length).toBe(0)
  })

  it('filters services in real-time when typing in search input', () => {
    render(
      <MemberHubClient
        services={mockServices}
        pendingInboxCount={2}
        pendingRegistrationsCount={0}
        isAdmin={true}
      />
    )

    const searchInput = screen.getByPlaceholderText(/ค้นหาบริการหรือโมดูล/i)
    fireEvent.change(searchInput, { target: { value: 'ซ่อม' } })

    expect(screen.getByText('แจ้งซ่อมบำรุงและอุปกรณ์')).toBeInTheDocument()
    expect(screen.queryByText('กล่องงานและคำร้อง')).not.toBeInTheDocument()
    expect(screen.queryByText('ระบบจัดการข้อมูลครุภัณฑ์')).not.toBeInTheDocument()
  })

  it('filters services when selecting a category tab', () => {
    render(
      <MemberHubClient
        services={mockServices}
        pendingInboxCount={2}
        pendingRegistrationsCount={0}
        isAdmin={true}
      />
    )

    const systemTab = screen.getByRole('tab', { name: /ระบบสารสนเทศ/i })
    fireEvent.click(systemTab)

    expect(screen.getByText('ระบบจัดการข้อมูลครุภัณฑ์')).toBeInTheDocument()
    expect(screen.queryByText('กล่องงานและคำร้อง')).not.toBeInTheDocument()
    expect(screen.queryByText('เปิด/ปิดฟังก์ชันและตั้งค่าระบบ')).not.toBeInTheDocument()
  })

  it('allows pinning a favorite service and viewing in favorites tab', () => {
    render(
      <MemberHubClient
        services={mockServices}
        pendingInboxCount={2}
        pendingRegistrationsCount={0}
        isAdmin={true}
      />
    )

    // Pin 'repair' service by clicking its star button
    const pinButtons = screen.getAllByRole('button', { name: /ปักหมุด/i })
    fireEvent.click(pinButtons[1]) // click second service (repair)

    // Switch to Favorites tab
    const favTab = screen.getByRole('tab', { name: /ที่ปักหมุด/i })
    fireEvent.click(favTab)

    expect(screen.getByText('แจ้งซ่อมบำรุงและอุปกรณ์')).toBeInTheDocument()
    expect(screen.queryByText('ระบบจัดการข้อมูลครุภัณฑ์')).not.toBeInTheDocument()
  })

  it('shows an empty state with clear button when no service matches search', () => {
    render(
      <MemberHubClient
        services={mockServices}
        pendingInboxCount={2}
        pendingRegistrationsCount={0}
        isAdmin={true}
      />
    )

    const searchInput = screen.getByPlaceholderText(/ค้นหาบริการหรือโมดูล/i)
    fireEvent.change(searchInput, { target: { value: 'ไม่มีคำนี้ในระบบแน่นอน' } })

    expect(screen.getByText(/ไม่พบบริการที่ตรงกับ/i)).toBeInTheDocument()
    const clearBtn = screen.getByRole('button', { name: /ล้างคำค้นหาและแสดงทั้งหมด/i })
    expect(clearBtn).toBeInTheDocument()

    // Clicking clear restores services
    fireEvent.click(clearBtn)
    expect(screen.getByText('กล่องงานและคำร้อง')).toBeInTheDocument()
  })
})
