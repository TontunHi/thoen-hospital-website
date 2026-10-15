import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MembersAdminClient from '../MembersAdminClient'

describe('MembersAdminClient Component', () => {
  const mockMembers = [
    {
      id: 1,
      username: 'admin01',
      email: 'admin01@thoenhospital.go.th',
      name: 'นพ. สมชาย ใจดี',
      department: 'กลุ่มงานการแพทย์',
      position: 'นายแพทย์ชำนาญการ',
      salary_user: '00123',
      salary_pass: '********',
      role: 'admin' as const,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      username: 'nurse02',
      email: 'nurse02@thoenhospital.go.th',
      name: 'นาง สมหญิง จริงใจ',
      department: 'กลุ่มงานการพยาบาล',
      position: 'พยาบาลวิชาชีพชำนาญการ',
      salary_user: null,
      salary_pass: null,
      role: 'member' as const,
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 3,
      username: 'subdistrict03',
      email: 'subdistrict03@thoenhospital.go.th',
      name: 'นาย ประเสริฐ สุขี',
      department: 'รพ.สต. ล้อมแรด',
      position: 'ผู้อำนวยการ รพ.สต.',
      salary_user: '00456',
      salary_pass: '********',
      role: 'subdistrict' as const,
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    },
  ]

  const mockCurrentUser = {
    username: 'admin01',
    email: 'admin01@thoenhospital.go.th',
    role: 'admin',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/member/me') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ authenticated: true, member: mockCurrentUser }),
        })
      }
      if (url === '/api/member') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, members: mockMembers }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      })
    }))
  })

  it('renders title, stats overview, and member table', async () => {
    render(<MembersAdminClient />)

    // Verify title
    expect(screen.getByText('ระบบจัดการสมาชิกและบุคลากร')).toBeInTheDocument()

    // Wait for members to load (both desktop table and mobile card render names)
    await waitFor(() => {
      expect(screen.getAllByText('นพ. สมชาย ใจดี').length).toBeGreaterThanOrEqual(1)
    })

    // Verify stats cards
    expect(screen.getByText('บุคลากรทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ผู้ดูแลระบบ (Admin)')).toBeInTheDocument()
    expect(screen.getByText('สมาชิกทั่วไป (Member)')).toBeInTheDocument()
    expect(screen.getByText('รพ.สต. ในเครือข่าย')).toBeInTheDocument()

    // Verify members are listed
    expect(screen.getAllByText('นาง สมหญิง จริงใจ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('นาย ประเสริฐ สุขี').length).toBeGreaterThanOrEqual(1)

    // Verify salary badges
    expect(screen.getAllByText('ผูกแล้ว').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ยังไม่ระบุ').length).toBeGreaterThanOrEqual(1)

    // Verify current user (คุณ) badge
    expect(screen.getAllByText('คุณ').length).toBeGreaterThanOrEqual(1)
  })

  it('filters members by search query', async () => {
    render(<MembersAdminClient />)

    await waitFor(() => {
      expect(screen.getAllByText('นพ. สมชาย ใจดี').length).toBeGreaterThanOrEqual(1)
    })

    const searchInput = screen.getByPlaceholderText(/ค้นหาชื่อ-นามสกุล/)
    fireEvent.change(searchInput, { target: { value: 'สมหญิง' } })

    expect(screen.getAllByText('นาง สมหญิง จริงใจ').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('นาย ประเสริฐ สุขี')).not.toBeInTheDocument()
  })

  it('filters members by role tabs', async () => {
    render(<MembersAdminClient />)

    await waitFor(() => {
      expect(screen.getAllByText('นพ. สมชาย ใจดี').length).toBeGreaterThanOrEqual(1)
    })

    // Click "รพ.สต." tab
    const subdistrictTab = screen.getByRole('tab', { name: /รพ\.สต\./ })
    fireEvent.click(subdistrictTab)

    expect(screen.getAllByText('นาย ประเสริฐ สุขี').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('นพ. สมชาย ใจดี')).not.toBeInTheDocument()
    expect(screen.queryByText('นาง สมหญิง จริงใจ')).not.toBeInTheDocument()
  })

  it('opens create member modal when clicking "+ เพิ่มสมาชิกใหม่"', async () => {
    render(<MembersAdminClient />)

    await waitFor(() => {
      expect(screen.getByText('ระบบจัดการสมาชิกและบุคลากร')).toBeInTheDocument()
    })

    const addBtn = screen.getByText('เพิ่มสมาชิกใหม่')
    fireEvent.click(addBtn)

    expect(screen.getByText('เพิ่มสมาชิกใหม่เข้าระบบ')).toBeInTheDocument()
    expect(screen.getByLabelText(/ชื่อ-นามสกุล \*/)).toBeInTheDocument()
    expect(screen.getByLabelText(/ชื่อผู้ใช้งาน \(Username\) \*/)).toBeInTheDocument()
    expect(screen.getByLabelText(/กลุ่มงาน \/ แผนก \*/)).toBeInTheDocument()
  })

  it('opens edit modal with member data when clicking edit', async () => {
    render(<MembersAdminClient />)

    await waitFor(() => {
      expect(screen.getAllByText('นาง สมหญิง จริงใจ').length).toBeGreaterThanOrEqual(1)
    })

    const editButtons = screen.getAllByTitle('แก้ไขข้อมูลสมาชิก')
    fireEvent.click(editButtons[1]) // Edit nurse02

    expect(screen.getByText('แก้ไขข้อมูลสมาชิก: นาง สมหญิง จริงใจ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('นาง สมหญิง จริงใจ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('nurse02')).toBeInTheDocument()
    expect(screen.getByDisplayValue('nurse02@thoenhospital.go.th')).toBeInTheDocument()
  })
})
