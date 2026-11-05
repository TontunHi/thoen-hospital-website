import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import OrganizationPublicClient from '../OrganizationPublicClient'

describe('OrganizationPublicClient Component', () => {
  const samplePublicOrgChart = [
    {
      id: 1,
      name: 'กลุ่มงานการพยาบาล',
      parentId: null,
      orderIndex: 0,
      members: [
        {
          id: 10,
          groupId: 1,
          name: 'พว.สมหญิง หัวหน้างาน',
          position: 'พยาบาลวิชาชีพชำนาญการพิเศษ',
          role: 'leader',
          orderIndex: 0,
          imagePath: '/uploads/head.jpg'
        },
        {
          id: 20,
          groupId: 1,
          name: 'พว.สมชาย พยาบาล',
          position: 'พยาบาลวิชาชีพ',
          role: 'member',
          orderIndex: 1,
          imagePath: null
        }
      ],
      children: [
        {
          id: 2,
          name: 'งานอุบัติเหตุและฉุกเฉิน',
          parentId: 1,
          orderIndex: 0,
          members: [
            {
              id: 30,
              groupId: 2,
              name: 'พยาบาล ER 1',
              position: 'พยาบาลวิชาชีพ',
              role: 'member',
              orderIndex: 0,
              imagePath: null
            }
          ],
          children: [
            {
              id: 3,
              name: 'หน่วยรถพยาบาล EMS',
              parentId: 2,
              orderIndex: 0,
              members: [
                {
                  id: 40,
                  groupId: 3,
                  name: 'จนท.กู้ชีพ EMS',
                  position: 'พนักงานขับรถพยาบาล',
                  role: 'member',
                  orderIndex: 0,
                  imagePath: null
                }
              ],
              children: []
            }
          ]
        }
      ]
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/departments/public/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  id: 10,
                  groupId: 1,
                  name: 'พว.สมหญิง หัวหน้างาน',
                  position: 'พยาบาลวิชาชีพชำนาญการพิเศษ',
                  role: 'leader',
                  orderIndex: 0,
                  imagePath: '/uploads/head.jpg',
                  groupName: 'กลุ่มงานการพยาบาล'
                }
              ]
            })
        })
      }
      if (url.includes('/api/departments/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: samplePublicOrgChart })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })
    }) as any
  })

  it('renders hero banner and department tabs', async () => {
    render(<OrganizationPublicClient />)

    expect(screen.getAllByText('โครงสร้างกลุ่มงานและบุคลากร').length).toBeGreaterThanOrEqual(1)

    await waitFor(() => {
      expect(screen.getAllByText('กลุ่มงานการพยาบาล').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('พว.สมหญิง หัวหน้างาน')).toBeDefined()
      expect(screen.getByText('หัวหน้ากลุ่มงาน')).toBeDefined()
      expect(screen.getByText('งานอุบัติเหตุและฉุกเฉิน')).toBeDefined()
      expect(screen.getByText('หน่วยรถพยาบาล EMS')).toBeDefined()
    })

    // Hero badges should be removed
    expect(screen.queryByText(/Thoen Hospital Organization/i)).toBeNull()
    expect(screen.queryByText(/🏥 โรงพยาบาลเถิน จ.ลำปาง/i)).toBeNull()
  })

  it('verifies that no phone numbers are rendered on public view (PDPA Privacy)', async () => {
    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง หัวหน้างาน')).toBeDefined()
    })

    // Confirm no telephone icon text or phone labels exist
    expect(screen.queryByText(/เบอร์ภายใน/i)).toBeNull()
    expect(screen.queryByText(/เบอร์โทร/i)).toBeNull()
  })

  it('searches staff by keyword and displays instant results', async () => {
    render(<OrganizationPublicClient />)

    const searchInput = screen.getByPlaceholderText(/ค้นหาบุคลากรตามชื่อ-นามสกุล หรือตำแหน่ง/i)
    fireEvent.change(searchInput, { target: { value: 'สมหญิง' } })

    await waitFor(() => {
      expect(screen.getByText(/ผลการค้นหาสำหรับ/i)).toBeDefined()
      expect(screen.getAllByText('พว.สมหญิง หัวหน้างาน').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('switches between Tree Diagram View and Directory Cards View', async () => {
    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getByText('ผังโครงสร้างองค์กร')).toBeDefined()
      expect(screen.getByText('รายชื่อแบบการ์ด')).toBeDefined()
    })

    // Initially in tree view: zoom level "100%" should be visible
    expect(screen.getByText('100%')).toBeDefined()

    // Zoom in
    const zoomInBtn = screen.getByTitle('ขยายขนาด')
    fireEvent.click(zoomInBtn)
    expect(screen.getByText('110%')).toBeDefined()

    // Switch to Directory Cards view
    const cardsBtn = screen.getByText('รายชื่อแบบการ์ด')
    fireEvent.click(cardsBtn)

    // In cards view, zoom controls should be hidden
    expect(screen.queryByText('110%')).toBeNull()

    // Subgroup header should still be visible in cards view
    expect(screen.getByText('งานอุบัติเหตุและฉุกเฉิน')).toBeDefined()

    // Switch back to tree view (zoom level is preserved)
    const treeBtn = screen.getByText('ผังโครงสร้างองค์กร')
    fireEvent.click(treeBtn)
    expect(screen.getByText('110%')).toBeDefined()

    // Reset zoom level back to 100%
    const resetZoomBtn = screen.getByTitle('รีเซ็ตขนาด 100%')
    fireEvent.click(resetZoomBtn)
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('renders regular staff members while omitting the "เจ้าหน้าที่" badge tag', async () => {
    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getByText('พว.สมหญิง หัวหน้างาน')).toBeDefined()
      expect(screen.getByText('งานอุบัติเหตุและฉุกเฉิน')).toBeDefined()
      // Regular staff members should be displayed
      expect(screen.getByText('พว.สมชาย พยาบาล')).toBeDefined()
      expect(screen.getByText('พยาบาล ER 1')).toBeDefined()
      expect(screen.getByText('จนท.กู้ชีพ EMS')).toBeDefined()
    })

    // The badge tag "เจ้าหน้าที่" must NOT be rendered on member cards
    expect(screen.queryByText('เจ้าหน้าที่')).toBeNull()
  })

  it('renders large department in tiered rows of X and switches density on button click', async () => {
    // Generate a department like กลุ่มงานการแพทย์ with 1 head doctor and 10 doctors (no sub-units)
    const doctorsOrgChart = [
      {
        id: 99,
        name: 'กลุ่มงานการแพทย์',
        parentId: null,
        orderIndex: 0,
        members: [
          {
            id: 100,
            groupId: 99,
            name: 'นพ.หัวหน้า กลุ่มงานการแพทย์',
            position: 'นายแพทย์เชี่ยวชาญ',
            role: 'leader',
            orderIndex: 0,
            imagePath: null
          },
          ...Array.from({ length: 10 }, (_, i) => ({
            id: 101 + i,
            groupId: 99,
            name: `นพ.แพทย์ผู้ปฏิบัติงาน ${i + 1}`,
            position: 'นายแพทย์ชำนาญการ',
            role: 'member' as const,
            orderIndex: i + 1,
            imagePath: null
          }))
        ],
        children: []
      }
    ]

    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/departments/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: doctorsOrgChart })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })
    })

    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getAllByText('กลุ่มงานการแพทย์').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('นพ.หัวหน้า กลุ่มงานการแพทย์')).toBeDefined()
      expect(screen.getByText('นพ.แพทย์ผู้ปฏิบัติงาน 1')).toBeDefined()
      expect(screen.getByText('นพ.แพทย์ผู้ปฏิบัติงาน 10')).toBeDefined()
    })

    // Density controls: default should have '4' active
    const btn4 = screen.getByRole('button', { name: 'แสดงแถวละ 4 คน' })
    expect(btn4.className).toContain('active')

    // Check that rows were created: with 10 members and perRow = 4, there are Math.ceil(10/4) = 3 rows
    const tieredRowsDefault = document.querySelectorAll('.orgTreeTieredRow')
    expect(tieredRowsDefault.length).toBe(3)

    // Switch density to 5 per row
    const btn5 = screen.getByRole('button', { name: 'แสดงแถวละ 5 คน' })
    fireEvent.click(btn5)
    expect(btn5.className).toContain('active')
    expect(btn4.className).not.toContain('active')

    // With 10 members and perRow = 5, there should now be exactly 2 rows (5 + 5)
    const tieredRows5 = document.querySelectorAll('.orgTreeTieredRow')
    expect(tieredRows5.length).toBe(2)

    // Switch density to 3 per row (10 members = 4 rows: 3 + 3 + 3 + 1)
    const btn3 = screen.getByRole('button', { name: 'แสดงแถวละ 3 คน' })
    fireEvent.click(btn3)
    expect(btn3.className).toContain('active')
    const tieredRows3 = document.querySelectorAll('.orgTreeTieredRow')
    expect(tieredRows3.length).toBe(4)
  })

  it('swaps member cards when dragged and dropped onto each other in tree view and calls reorder API', async () => {
    const mockChart = [
      {
        id: 10,
        name: 'กลุ่มงานการแพทย์',
        parentId: null,
        orderIndex: 0,
        members: [
          {
            id: 101,
            groupId: 10,
            name: 'นพ.แพทย์ คนที่หนึ่ง',
            position: 'นายแพทย์ชำนาญการ',
            role: 'member' as const,
            orderIndex: 0,
            imagePath: null
          },
          {
            id: 102,
            groupId: 10,
            name: 'นพ.แพทย์ คนที่สอง',
            position: 'นายแพทย์ปฏิบัติการ',
            role: 'member' as const,
            orderIndex: 1,
            imagePath: null
          }
        ],
        children: []
      }
    ]

    const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/departments/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockChart })
        })
      }
      if (url.includes('/api/departments/members/reorder')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'บันทึกลำดับสมาชิกสำเร็จ' })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })
    })

    global.fetch = mockFetch

    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getByText('นพ.แพทย์ คนที่หนึ่ง')).toBeDefined()
      expect(screen.getByText('นพ.แพทย์ คนที่สอง')).toBeDefined()
    })

    const card1 = screen.getByText('นพ.แพทย์ คนที่หนึ่ง').closest('.treeMemberCard')!
    const card2 = screen.getByText('นพ.แพทย์ คนที่สอง').closest('.treeMemberCard')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
      dropEffect: ''
    }

    // 1. Drag start on card 1
    fireEvent.dragStart(card1, { dataTransfer })
    expect(card1.className).toContain('isDragging')

    // 2. Drag over card 2 -> should get drop target highlight
    fireEvent.dragOver(card2, { dataTransfer })
    expect(card2.className).toContain('isDropTarget')

    // 3. Drop on card 2 and end drag inside act
    await act(async () => {
      fireEvent.drop(card2, { dataTransfer })
      fireEvent.dragEnd(card1)
    })

    // Verify reorder API was called with swapped member IDs: [102, 101]
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/departments/members/reorder',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            groupId: 10,
            memberIds: [102, 101]
          })
        })
      )
    })
  })

  it('swaps department tabs when dragged and dropped onto each other and calls group reorder API', async () => {
    const mockChart = [
      {
        id: 1,
        name: 'กลุ่มงานการแพทย์',
        parentId: null,
        orderIndex: 0,
        members: [],
        children: []
      },
      {
        id: 2,
        name: 'กลุ่มงานพยาบาล',
        parentId: null,
        orderIndex: 1,
        members: [],
        children: []
      }
    ]

    const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/departments/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockChart })
        })
      }
      if (url.includes('/api/departments/groups/reorder')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'บันทึกลำดับกลุ่มงานสำเร็จ' })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })
    })

    global.fetch = mockFetch

    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getAllByText('กลุ่มงานการแพทย์').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('กลุ่มงานพยาบาล').length).toBeGreaterThanOrEqual(1)
    })

    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.deptTabBtn')
    const tabMed = tabButtons[0]
    const tabNurse = tabButtons[1]

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
      dropEffect: ''
    }

    // Drag Tab 1 over Tab 2 and drop
    fireEvent.dragStart(tabMed, { dataTransfer })
    expect(tabMed.className).toContain('isDragging')

    fireEvent.dragOver(tabNurse, { dataTransfer })
    expect(tabNurse.className).toContain('isDropTarget')

    await act(async () => {
      fireEvent.drop(tabNurse, { dataTransfer })
      fireEvent.dragEnd(tabMed)
    })

    // Verify groups reorder API was called with swapped group IDs: [2, 1]
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/departments/groups/reorder',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            groupIds: [2, 1]
          })
        })
      )
    })
  })

  it('opens member detail modal when clicking a member card and displays name, department, and position', async () => {
    const mockDetailChart = [
      {
        id: 15,
        name: 'กลุ่มงานทันตกรรม',
        parentId: null,
        orderIndex: 0,
        members: [
          {
            id: 201,
            groupId: 15,
            name: 'ทพ.สมศักดิ์ ฟันดี',
            position: 'ทันตแพทย์ชำนาญการพิเศษ',
            role: 'member' as const,
            orderIndex: 0,
            imagePath: '/uploads/dentist.jpg'
          }
        ],
        children: []
      }
    ]

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/departments/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockDetailChart })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })
    })

    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getByText('ทพ.สมศักดิ์ ฟันดี')).toBeDefined()
    })

    // Click on member card
    const card = screen.getByText('ทพ.สมศักดิ์ ฟันดี').closest('.treeMemberCard')!
    await act(async () => {
      fireEvent.click(card)
    })

    // Check modal opened with title
    expect(screen.getByText('ข้อมูลบุคลากร')).toBeDefined()

    // Check modal displays Name, Position, and Department/Group inside the modal card
    const modal = document.querySelector('.orgModalCard')!
    expect(modal).toBeDefined()
    expect(modal.textContent).toContain('ทพ.สมศักดิ์ ฟันดี')
    expect(modal.textContent).toContain('ทันตแพทย์ชำนาญการพิเศษ')
    expect(modal.textContent).toContain('กลุ่มงานทันตกรรม')

    // Check enlarged avatar image is present
    const avatarImg = document.querySelector<HTMLImageElement>('.orgModalAvatar')!
    expect(avatarImg).toBeDefined()
    expect(avatarImg.src).toContain('/uploads/dentist.jpg')

    // Click photo to open full-size lightbox viewer
    const avatarWrap = document.querySelector('.orgModalAvatarWrap.hasZoom')!
    await act(async () => {
      fireEvent.click(avatarWrap)
    })

    // Lightbox should be open
    const lightbox = document.querySelector('.orgLightboxOverlay')!
    expect(lightbox).toBeDefined()
    const lightboxImg = document.querySelector<HTMLImageElement>('.orgLightboxImage')!
    expect(lightboxImg.src).toContain('/uploads/dentist.jpg')

    // Close lightbox
    const lightboxClose = screen.getByRole('button', { name: 'ปิดรูปภาพขนาดเต็ม' })
    await act(async () => {
      fireEvent.click(lightboxClose)
    })
    expect(document.querySelector('.orgLightboxOverlay')).toBeNull()

    // Click close button
    const closeBtn = screen.getByRole('button', { name: 'ปิด' })
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    // Modal should be closed
    expect(screen.queryByText('ข้อมูลบุคลากร')).toBeNull()
  })
})
