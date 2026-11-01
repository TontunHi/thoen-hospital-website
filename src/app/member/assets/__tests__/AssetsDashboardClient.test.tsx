import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AssetsDashboardClient from '../AssetsDashboardClient'

const mockInitialStats = {
  totalAssets: 1250,
  activeWarrantyCount: 840,
  expiredWarrantyCount: 410,
  itCount: 520,
  medicalCount: 380,
  generalCount: 350,
  inRepairCount: 15,
}

const mockAssets = [
  {
    id: 1,
    articleNum: '7440-001-0001/69',
    fsnNum: '7440-001-0001',
    name: 'เครื่องคอมพิวเตอร์ All-in-One Dell OptiPlex',
    brand: 'Dell',
    model: 'OptiPlex 7400',
    serialNo: 'SN-DELL-99881',
    category: 'IT' as const,
    department: 'งานเทคโนโลยีสารสนเทศ',
    locationFullName: 'อาคารเฉลิมพระเกียรติ • ชั้น 2 • ห้องศูนย์คอมพิวเตอร์',
    receivedDate: '2026-05-10',
    warrantyStartDate: '2026-05-10',
    warrantyEndDate: '2029-05-10',
    expireDate: '2029-05-10',
    price: 35000,
    vendorName: 'บริษัท คอมพิวเตอร์ ซิสเต็มส์ จำกัด',
    vendorContact: '02-999-8888',
    contractNo: 'PO-69/120',
    status: 'ACTIVE' as const,
    notes: 'เครื่องหลักระบบแม่ข่าย',
    createdAt: '2026-05-10T08:00:00Z',
  },
  {
    id: 2,
    articleNum: '6515-002-0042/68',
    fsnNum: '6515-002-0042',
    name: 'เครื่องวัดสัญญาณชีพ Vital Signs Monitor',
    brand: 'Mindray',
    model: 'ePM 12M',
    serialNo: 'SN-MR-44120',
    category: 'MEDICAL' as const,
    department: 'ห้องฉุกเฉินและอุบัติเหตุ (ER)',
    locationFullName: 'อาคารผู้ป่วยนอก • ชั้น 1 • จุดคัดกรองฉุกเฉิน',
    receivedDate: '2025-01-15',
    warrantyStartDate: '2025-01-15',
    warrantyEndDate: '2026-01-15',
    expireDate: '2026-01-15',
    price: 185000,
    vendorName: 'บริษัท เมดิคอล ไดแอกนอสติกส์ จำกัด',
    vendorContact: '02-123-4567',
    contractNo: 'PO-68/045',
    status: 'IN_REPAIR' as const,
    notes: 'รอช่างศูนย์เข้าตรวจสอบแบตเตอรี่สำรอง',
    createdAt: '2025-01-15T09:30:00Z',
  },
]

describe('AssetsDashboardClient Component (Anti-AI-Slop Redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/locations')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  id: 101,
                  room_name: 'ห้องศูนย์คอมพิวเตอร์',
                  floor_id: 12,
                  floor_name: 'ชั้น 2',
                  building_id: 3,
                  building_name: 'อาคารเฉลิมพระเกียรติ',
                  full_name: 'อาคารเฉลิมพระเกียรติ ชั้น 2 ห้องศูนย์คอมพิวเตอร์',
                },
              ],
            }),
        })
      }
      if (url.includes('/api/member/assets/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockInitialStats }),
        })
      }
      if (url.includes('/api/member/assets')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockAssets,
              pagination: {
                total: 2,
                page: 1,
                limit: 20,
                totalPages: 1,
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    })
  })

  it('renders executive header and all 5 clinical KPI metric cards', async () => {
    render(
      <AssetsDashboardClient
        initialStats={mockInitialStats}
        currentUser={{ username: 'admin_test', name: 'นายทดสอบ', role: 'admin' }}
      />
    )

    // Header title and standard badges
    expect(screen.getByRole('heading', { level: 1, name: 'ระบบจัดการข้อมูลครุภัณฑ์' })).toBeInTheDocument()
    expect(screen.getByText('ระบบจัดการข้อมูลครุภัณฑ์ • โรงพยาบาลเถิน')).toBeInTheDocument()
    expect(screen.getByText('กลับสู่ศูนย์ควบคุมสมาชิก')).toBeInTheDocument()

    // 5 Clinical KPI Cards
    expect(screen.getByText(/ครุภัณฑ์ทั้งหมด \(Total Assets\)/)).toBeInTheDocument()
    expect(screen.getAllByText('1,250').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/อยู่ในระยะรับประกัน \(In Warranty\)/)).toBeInTheDocument()
    expect(screen.getAllByText('840').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/อุปกรณ์ IT & เครือข่าย \(IT Assets\)/)).toBeInTheDocument()
    expect(screen.getAllByText('520').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/เครื่องมือแพทย์ \(Medical\)/)).toBeInTheDocument()
    expect(screen.getAllByText('380').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/อยู่ระหว่างส่งซ่อม \(In Repair\)/)).toBeInTheDocument()
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1)
  })

  it('renders assets in table and supports copying article number', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    })

    render(
      <AssetsDashboardClient
        initialStats={mockInitialStats}
        currentUser={{ username: 'admin_test', name: 'นายทดสอบ', role: 'admin' }}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText('7440-001-0001/69').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('เครื่องคอมพิวเตอร์ All-in-One Dell OptiPlex').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('เครื่องวัดสัญญาณชีพ Vital Signs Monitor').length).toBeGreaterThanOrEqual(1)

    // Click copy button on article num
    const copyBtns = screen.getAllByTitle('คัดลอกเลขครุภัณฑ์')
    expect(copyBtns.length).toBeGreaterThan(0)
    fireEvent.click(copyBtns[0])

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('7440-001-0001/69')
  })

  it('filters by category tab when clicking segmented category pill', async () => {
    render(
      <AssetsDashboardClient
        initialStats={mockInitialStats}
        currentUser={{ username: 'admin_test', name: 'นายทดสอบ', role: 'admin' }}
      />
    )

    const itTab = screen.getByRole('tab', { name: /คอมพิวเตอร์ & IT/ })
    fireEvent.click(itTab)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=IT'))
    })
  })

  it('opens create modal with cleanly structured form sections and location selector', async () => {
    render(
      <AssetsDashboardClient
        initialStats={mockInitialStats}
        currentUser={{ username: 'admin_test', name: 'นายทดสอบ', role: 'admin' }}
      />
    )

    const addBtn = screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์ใหม่' })
    fireEvent.click(addBtn)

    expect(screen.getByRole('heading', { level: 3, name: 'เพิ่มทะเบียนครุภัณฑ์ใหม่' })).toBeInTheDocument()
    expect(screen.getByText('1. ข้อมูลระบุตัวตนครุภัณฑ์ (Identity)')).toBeInTheDocument()
    expect(screen.getByText('2. สถานที่ติดตั้งและหน่วยงานครอบครอง (Location)')).toBeInTheDocument()
    expect(screen.getByText('3. การตรวจรับ การรับประกัน และราคา (Warranty & Cost)')).toBeInTheDocument()
    expect(screen.getByText('4. ข้อมูลคู่ค้าและหมายเหตุ (Vendor & Contract)')).toBeInTheDocument()

    // Test location toggle without emojis
    const locationToggle = screen.getByText('สลับพิมพ์ระบุเอง')
    fireEvent.click(locationToggle)
    expect(screen.getByText('เลือกจากโครงสร้างอาคาร (ตึก/ชั้น/ห้อง)')).toBeInTheDocument()
  })

  it('opens delete confirmation modal and cancels correctly', async () => {
    render(
      <AssetsDashboardClient
        initialStats={mockInitialStats}
        currentUser={{ username: 'admin_test', name: 'นายทดสอบ', role: 'admin' }}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText('7440-001-0001/69').length).toBeGreaterThanOrEqual(1)
    })

    const deleteBtns = screen.getAllByTitle('ลบข้อมูลครุภัณฑ์')
    fireEvent.click(deleteBtns[0])

    expect(screen.getByRole('heading', { level: 3, name: 'ยืนยันการลบครุภัณฑ์' })).toBeInTheDocument()
    expect(screen.getByText(/คุณต้องการลบข้อมูลครุภัณฑ์/)).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: 'ยกเลิก' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText('ยืนยันการลบครุภัณฑ์')).not.toBeInTheDocument()
    })
  })
})
