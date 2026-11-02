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
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake')

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(400),
        width: 10,
        height: 10
      })
    }) as any

    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb) => {
      const blob = new Blob(['fake-image'], { type: 'image/png' })
      cb(blob)
    })
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/departments/groups')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: sampleGroups })
        })
      }
      if (url.includes('/api/departments/members/search-system')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  id: 99,
                  name: 'พว.สมศรี บริรักษ์',
                  position: 'พยาบาลวิชาชีพชำนาญการ',
                  department: 'กลุ่มงานการพยาบาล',
                  profilePath: '/uploads/somsri.jpg'
                }
              ]
            })
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

  it('filters group explorer by search query', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getAllByText('กลุ่มงานการพยาบาล').length).toBeGreaterThanOrEqual(1)
    })

    const searchInput = screen.getByPlaceholderText(/ค้นหากลุ่มงาน/i)
    fireEvent.change(searchInput, { target: { value: 'งานอุบัติเหตุ' } })

    expect(screen.getByText('งานอุบัติเหตุและฉุกเฉิน')).toBeDefined()
  })

  it('renders stats overview and does not render tip banner', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getByText('กลุ่มงานหลัก')).toBeDefined()
      expect(screen.getByText('หน่วยงานย่อย')).toBeDefined()
    })

    // Tip banner and pill badges should be absent
    expect(screen.queryByText(/คำแนะนำการจัดผังองค์กร/i)).toBeNull()
    expect(screen.queryByText('Hospital Administration')).toBeNull()
  })
  it('opens ImageCropModal when selecting an image file in member modal', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง รักดี')).toBeDefined()
    })

    const addMemberBtns = screen.getAllByRole('button', { name: /เพิ่มสมาชิก/i })
    fireEvent.click(addMemberBtns[0])

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDefined()

    const fakeFile = new File(['test'], 'nurse.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })

    await waitFor(() => {
      expect(screen.getByText('ตัดครอบรูปถ่ายบุคลากร (Crop Staff Photo)')).toBeDefined()
      expect(screen.getByText('3 : 4')).toBeDefined()
      expect(screen.getByText('อวาตาร์วงกลม')).toBeDefined()
    })
  })

  it('opens ImageCropModal when clicking Crop / ลบพื้นหลัง on existing member photo', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง รักดี')).toBeDefined()
    })

    // Click edit on leader (id: 10 has imagePath: '/uploads/head.jpg')
    const editBtns = screen.getAllByTitle('แก้ไขข้อมูล')
    fireEvent.click(editBtns[0])

    await waitFor(() => {
      expect(screen.getByText('แก้ไขข้อมูลสมาชิก')).toBeDefined()
      expect(screen.getByText('Crop / ตัดครอบรูป')).toBeDefined()
    })

    const cropBtn = screen.getByText('Crop / ตัดครอบรูป')
    fireEvent.click(cropBtn)

    await waitFor(() => {
      expect(screen.getByText('ตัดครอบรูปถ่ายบุคลากร (Crop Staff Photo)')).toBeDefined()
      expect(screen.getByText('3 : 4')).toBeDefined()
    })
  })
  it('populates member info and closes dropdown on single click without reopening', async () => {
    render(<OrganizationAdminClient currentAdmin={mockAdmin} />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง รักดี')).toBeDefined()
    })

    const addMemberBtns = screen.getAllByRole('button', { name: /เพิ่มสมาชิก/i })
    fireEvent.click(addMemberBtns[0])

    const searchInput = screen.getByPlaceholderText(/ค้นชื่อ หรือ แผนก/i)
    fireEvent.change(searchInput, { target: { value: 'สมศรี' } })

    // Wait for autocomplete item to appear
    await waitFor(() => {
      expect(screen.getByText('พว.สมศรี บริรักษ์')).toBeDefined()
      expect(screen.getByText(/พยาบาลวิชาชีพชำนาญการ • กลุ่มงานการพยาบาล/i)).toBeDefined()
    })

    // Click the autocomplete item once
    const autocompleteItem = screen.getByText('พว.สมศรี บริรักษ์')
    fireEvent.click(autocompleteItem)

    // Form inputs should immediately receive selected member data
    const nameInput = screen.getByPlaceholderText(/เช่น พญ\.นฤนาท/i) as HTMLInputElement
    const posInput = screen.getByPlaceholderText(/เช่น ผู้อำนวยการโรงพยาบาล/i) as HTMLInputElement
    expect(nameInput.value).toBe('พว.สมศรี บริรักษ์')
    expect(posInput.value).toBe('พยาบาลวิชาชีพชำนาญการ')

    // Dropdown list should be dismissed immediately
    expect(screen.queryByText(/พยาบาลวิชาชีพชำนาญการ • กลุ่มงานการพยาบาล/i)).toBeNull()

    // Wait longer than the 250ms debounce window to ensure dropdown does NOT pop up again
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.queryByText(/พยาบาลวิชาชีพชำนาญการ • กลุ่มงานการพยาบาล/i)).toBeNull()
  })
});
