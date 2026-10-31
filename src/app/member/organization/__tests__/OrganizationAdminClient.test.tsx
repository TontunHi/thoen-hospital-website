import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OrganizationAdminClient from '../OrganizationAdminClient'

describe('OrganizationAdminClient Component', () => {
  const mockAdmin = {
    id: 1,
    name: 'Admin Thoen',
    role: 'admin'
  }

  const sampleGroups = [
    {
      id: 1,
      name: 'กลุ่มงานการพยาบาล',
      parentId: null,
      orderIndex: 0,
      isActive: true,
      children: [
        {
          id: 2,
          name: 'งานอุบัติเหตุและฉุกเฉิน',
          parentId: 1,
          orderIndex: 0,
          isActive: true,
          children: []
        }
      ]
    }
  ]

  const sampleMembers = [
    {
      id: 10,
      groupId: 1,
      name: 'พว.สมหญิง รักดี',
      position: 'หัวหน้ากลุ่มงานการพยาบาล',
      role: 'leader',
      orderIndex: 0,
      imagePath: '/uploads/head.jpg',
      phone: '101'
    },
    {
      id: 20,
      groupId: 1,
      name: 'พว.สมชาย บริการดี',
      position: 'พยาบาลวิชาชีพ',
      role: 'member',
      orderIndex: 1,
      imagePath: null,
      phone: '102'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/departments/groups')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: sampleGroups })
        })
      }
      if (url.includes('/api/departments/members')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: sampleMembers })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })
    }) as any
  })

  it('renders admin workbench header and groups explorer', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    expect(screen.getByText('จัดการแผนผังและสมาชิกกลุ่มงาน')).toBeDefined()
    expect(screen.getByText('โครงสร้างกลุ่มงาน')).toBeDefined()

    await waitFor(() => {
      expect(screen.getAllByText('กลุ่มงานการพยาบาล').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('งานอุบัติเหตุและฉุกเฉิน')).toBeDefined()
    })
  })

  it('renders leader card and member grid for selected group', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง รักดี')).toBeDefined()
      expect(screen.getByText('หัวหน้ากลุ่มงาน')).toBeDefined()
      expect(screen.getByText('พว.สมชาย บริการดี')).toBeDefined()
      expect(screen.getByText('พยาบาลวิชาชีพ')).toBeDefined()
    })
  })

  it('opens add member modal when clicking เพิ่มสมาชิก button', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง รักดี')).toBeDefined()
    })

    const addMemberBtns = screen.getAllByRole('button', { name: /เพิ่มสมาชิก/i })
    fireEvent.click(addMemberBtns[0])

    expect(screen.getByText('เพิ่มสมาชิกในกลุ่มงาน')).toBeDefined()
    expect(screen.getByPlaceholderText(/เช่น ผู้อำนวยการโรงพยาบาล/i)).toBeDefined()
  })
})
