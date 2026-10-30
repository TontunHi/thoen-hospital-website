import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
      expect(screen.getByText('จนท.กู้ชีพ EMS')).toBeDefined()
    })
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

  it('toggles staff list collapse and expand in tree node', async () => {
    render(<OrganizationPublicClient />)

    await waitFor(() => {
      expect(screen.getByText('จนท.กู้ชีพ EMS')).toBeDefined()
    })

    // Find staff toggle button for EMS unit (3rd group with 1 staff member)
    const staffToggleBtns = screen.getAllByText(/เจ้าหน้าที่ 1 ท่าน/i)
    const emsToggleBtn = staffToggleBtns[staffToggleBtns.length - 1]
    fireEvent.click(emsToggleBtn)

    // Staff member in that unit is collapsed
    expect(screen.queryByText('จนท.กู้ชีพ EMS')).toBeNull()

    // Click again to re-expand
    fireEvent.click(emsToggleBtn)
    expect(screen.getByText('จนท.กู้ชีพ EMS')).toBeDefined()
  })
})
