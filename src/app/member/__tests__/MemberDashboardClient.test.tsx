import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemberDashboardClient, { MemberDashboardClientProps } from '../MemberDashboardClient'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

describe('MemberDashboardClient Component (member-dashboard-design spec)', () => {
  const defaultProps: MemberDashboardClientProps = {
    member: {
      id: 1,
      username: '1209701234510',
      email: 'somchai@thoenhospital.go.th',
      name: 'นายสมชาย ใจดี',
      department: 'กลุ่มงานสารสนเทศ',
      position: 'นักวิชาการคอมพิวเตอร์',
      profile_path: null,
      role: 'admin',
    },
    initials: 'สจ',
    displayRole: 'ผู้ดูแลระบบ',
    isTelegramLinked: true,
    pendingInboxCount: 3,
    pendingRegistrationsCount: 2,
    permissions: {
      hasInbox: true,
      hasRepair: true,
      hasMediaRequest: true,
      hasSalary: true,
      hasSignature: true,
      hasEquipmentBorrow: true,
      hasEvents: true,
      isAssetsAuthorized: true,
      isNewsAuthorized: true,
      isItaAuthorized: true,
      isRduAuthorized: true,
      isOutgoingDocAuthorized: true,
      isEthicsAuthorized: true,
      isFinance: true,
      isAllSalaryAuthorized: true,
      isAdmin: true,
      isLocationsAuthorized: true,
      isSubdistrict: false,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile card with masked ID, role chip, and user details', () => {
    render(<MemberDashboardClient {...defaultProps} />)

    // Name & initials
    expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    expect(screen.getByText('สจ')).toBeInTheDocument()

    // Masked user ID is removed from profile banner
    expect(screen.queryByText(/@120970/)).not.toBeInTheDocument()

    // Role chip & position/department
    expect(screen.getByText('ผู้ดูแลระบบ')).toBeInTheDocument()
    expect(screen.getByText(/นักวิชาการคอมพิวเตอร์ · กลุ่มงานสารสนเทศ/)).toBeInTheDocument()

    // Telegram status
    expect(screen.getByText('เชื่อมต่อแล้ว')).toBeInTheDocument()

    // Logout button
    expect(screen.getByRole('button', { name: /ออกจากระบบ/i })).toBeInTheDocument()
  })

  it('renders daily services: featured card and 6 secondary cards', () => {
    render(<MemberDashboardClient {...defaultProps} />)

    // Section title
    expect(screen.getByRole('heading', { level: 3, name: 'งานประจำวัน' })).toBeInTheDocument()

    // Featured card: กล่องงานและคำร้อง with pending count
    expect(screen.getByText('กล่องงานและคำร้อง')).toBeInTheDocument()
    expect(screen.getByText('3 งานรอคุณ')).toBeInTheDocument()
    expect(screen.getByText('เปิดกล่องงาน')).toBeInTheDocument()

    // 6 Secondary cards
    expect(screen.getByText('แจ้งซ่อมบำรุงและอุปกรณ์')).toBeInTheDocument()
    expect(screen.getByText('ระบบขอสื่อประชาสัมพันธ์')).toBeInTheDocument()
    expect(screen.getByText('ระบบสลิปเงินเดือนออนไลน์')).toBeInTheDocument()
    expect(screen.getByText('จัดการลายเซ็นดิจิทัล')).toBeInTheDocument()
    expect(screen.getByText('ระบบยืม-คืนอุปกรณ์และพัสดุ')).toBeInTheDocument()
    expect(screen.getByText('ระบบกิจกรรมและสะสมคะแนน')).toBeInTheDocument()
  })

  it('renders information systems & documents list (7 items)', () => {
    render(<MemberDashboardClient {...defaultProps} />)

    expect(screen.getByRole('heading', { level: 3, name: 'ระบบสารสนเทศและเอกสาร' })).toBeInTheDocument()

    expect(screen.getByText('ระบบจัดการข้อมูลครุภัณฑ์')).toBeInTheDocument()
    expect(screen.getByText('จัดการบทความ ITA')).toBeInTheDocument()
    expect(screen.getByText('ระบบจัดการเอกสาร RDU')).toBeInTheDocument()
    expect(screen.getByText('จัดการระบบหนังสือส่งออก Online')).toBeInTheDocument()
    expect(screen.getByText('จัดการเอกสารชมรมจริยธรรม')).toBeInTheDocument()
    expect(screen.getByText('ระบบนำเข้าข้อมูลการเงิน')).toBeInTheDocument()
    expect(screen.getByText('สลิปเงินเดือนบุคลากรทั้งหมด')).toBeInTheDocument()
  })

  it('renders admin section (6 items) when user is admin', () => {
    render(<MemberDashboardClient {...defaultProps} />)

    expect(screen.getByRole('heading', { level: 3, name: 'สำหรับผู้ดูแลระบบ' })).toBeInTheDocument()

    expect(screen.getByText('ตั้งค่าระบบและเปิด/ปิดฟังก์ชัน')).toBeInTheDocument()
    expect(screen.getByText('โปรแกรมโพสข่าวประชาสัมพันธ์')).toBeInTheDocument()
    expect(screen.getByText('ตรวจสอบคำขอลงทะเบียน')).toBeInTheDocument()
    expect(screen.getByText('2 คำขอใหม่')).toBeInTheDocument()
    expect(screen.getByText('แดชบอร์ดจัดการสมาชิก')).toBeInTheDocument()
    expect(screen.getByText('จัดการสถานที่ ตึก-ชั้น-ห้อง')).toBeInTheDocument()
    expect(screen.getByText('ประวัติการใช้งาน (Audit Logs)')).toBeInTheDocument()
  })

  it('hides admin section when user is not admin', () => {
    const nonAdminProps: MemberDashboardClientProps = {
      ...defaultProps,
      displayRole: 'สมาชิกทั่วไป',
      permissions: {
        ...defaultProps.permissions,
        isAdmin: false,
        isLocationsAuthorized: false,
      },
    }

    render(<MemberDashboardClient {...nonAdminProps} />)
    expect(screen.queryByRole('heading', { level: 3, name: 'สำหรับผู้ดูแลระบบ' })).not.toBeInTheDocument()
  })

  it('renders subdistrict notice for subdistrict role accounts', () => {
    const subdistrictProps: MemberDashboardClientProps = {
      ...defaultProps,
      permissions: {
        ...defaultProps.permissions,
        isSubdistrict: true,
      },
    }

    render(<MemberDashboardClient {...subdistrictProps} />)

    expect(screen.getByText('บัญชีผู้ใช้หน่วยบริการ รพ.สต.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /เข้าสู่หน้าระบบงานสารสนเทศ/i })).toBeInTheDocument()
    // Services are not rendered for subdistrict
    expect(screen.queryByRole('heading', { level: 3, name: 'งานประจำวัน' })).not.toBeInTheDocument()
  })
})
