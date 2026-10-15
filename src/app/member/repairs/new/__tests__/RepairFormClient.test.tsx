import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RepairFormClient from '../RepairFormClient'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('RepairFormClient Component (Hallmark Anti-AI-Slop Redesign)', () => {
  const mockCurrentUser = {
    id: 1,
    username: 'nurse01',
    name: 'พว. วันเพ็ญ นามสมมุติ',
    department: 'กลุ่มงานการพยาบาล',
    position: 'พยาบาลวิชาชีพชำนาญการ',
    email: 'wanpen@thoenhospital.go.th',
    phone: '0812345678',
  }

  const mockLocations = [
    {
      id: 10,
      building_id: 1,
      building_name: 'อาคารผู้ป่วยนอก (OPD)',
      floor_id: 1,
      floor_name: 'ชั้น 1',
      room_name: 'ห้องตรวจ 1',
      full_name: 'อาคารผู้ป่วยนอก (OPD) ชั้น 1 ห้องตรวจ 1',
    },
    {
      id: 11,
      building_id: 1,
      building_name: 'อาคารผู้ป่วยนอก (OPD)',
      floor_id: 1,
      floor_name: 'ชั้น 1',
      room_name: 'ห้องตรวจ 2',
      full_name: 'อาคารผู้ป่วยนอก (OPD) ชั้น 1 ห้องตรวจ 2',
    },
    {
      id: 20,
      building_id: 2,
      building_name: 'อาคารเฉลิมพระเกียรติ',
      floor_id: 2,
      floor_name: 'ชั้น 2',
      room_name: 'ห้องพยาบาล',
      full_name: 'อาคารเฉลิมพระเกียรติ ชั้น 2 ห้องพยาบาล',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders clinical workbench layout with Roman title and four steps', () => {
    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    // Header & Navigation
    expect(screen.getByText('แบบฟอร์มแจ้งซ่อมบำรุงและอุปกรณ์')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /กลับสู่กล่องงาน/i })).toBeInTheDocument()

    // 4 Step Titles
    expect(screen.getByRole('heading', { name: /เลือกประเภทงานซ่อม/i })).toBeInTheDocument()
    expect(screen.getByText('ข้อมูลสิ่งของ / อุปกรณ์ที่ชำรุดเสียหาย')).toBeInTheDocument()
    expect(screen.getByText('รายละเอียด / อาการชำรุดเสียหาย')).toBeInTheDocument()
    expect(screen.getByText('แนบรูปถ่ายประกอบความเสียหาย (ไม่บังคับ)')).toBeInTheDocument()

    // Sidebar
    expect(screen.getByText('สถานที่ตั้ง / จุดเกิดเหตุ')).toBeInTheDocument()
    expect(screen.getByText('ระดับความเร่งด่วน')).toBeInTheDocument()
    expect(screen.getByText('ผู้แจ้งซ่อม')).toBeInTheDocument()
    expect(screen.getByText('พว. วันเพ็ญ นามสมมุติ')).toBeInTheDocument()
    expect(screen.getByText('ความพร้อมของข้อมูลใบแจ้งซ่อม:')).toBeInTheDocument()
  })

  it('starts with no category selected and allows selecting IT, General, or Medical', () => {
    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    const itCard = screen.getByRole('radio', { name: /คอมพิวเตอร์ \/ IT/i })
    const genCard = screen.getByRole('radio', { name: /งานช่างทั่วไป/i })
    const medCard = screen.getByRole('radio', { name: /เครื่องมือแพทย์/i })

    // Initially none is selected
    expect(itCard).toHaveAttribute('aria-checked', 'false')
    expect(genCard).toHaveAttribute('aria-checked', 'false')
    expect(medCard).toHaveAttribute('aria-checked', 'false')

    // Select IT
    fireEvent.click(itCard)
    expect(itCard).toHaveAttribute('aria-checked', 'true')
    expect(genCard).toHaveAttribute('aria-checked', 'false')

    // Switch to General
    fireEvent.click(genCard)
    expect(genCard).toHaveAttribute('aria-checked', 'true')
    expect(itCard).toHaveAttribute('aria-checked', 'false')

    // Switch to Medical
    fireEvent.click(medCard)
    expect(medCard).toHaveAttribute('aria-checked', 'true')
    expect(genCard).toHaveAttribute('aria-checked', 'false')
  })

  it('allows toggling between Equipment and Non-Equipment with quick tags', () => {
    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    const nonEquipRadio = screen.getByRole('radio', { name: /ไม่ใช่ครุภัณฑ์/i })
    fireEvent.click(nonEquipRadio)

    expect(screen.getByText('รายการ / สิ่งของที่ชำรุดเสียหาย')).toBeInTheDocument()
    expect(screen.getByText('ตัวเลือกด่วน:')).toBeInTheDocument()

    const quickTag = screen.getByRole('button', { name: /\+ หลอดไฟ \/ โคมไฟ/i })
    fireEvent.click(quickTag)

    const input = screen.getByPlaceholderText(/ระบุสิ่งของที่ชำรุด เช่น/i) as HTMLInputElement
    expect(input.value).toBe('หลอดไฟ / โคมไฟ')
  })

  it('handles 3-level cascading location dropdowns and updates live checklist', () => {
    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    const buildingSelect = screen.getByLabelText(/1\. อาคาร \/ ตึก/i) as HTMLSelectElement
    const floorSelect = screen.getByLabelText(/2\. ชั้น/i) as HTMLSelectElement
    const roomSelect = screen.getByLabelText(/3\. ห้อง \/ แผนก/i) as HTMLSelectElement

    // Floor and Room are initially disabled
    expect(floorSelect).toBeDisabled()
    expect(roomSelect).toBeDisabled()

    // Select Building
    fireEvent.change(buildingSelect, { target: { value: '1' } })
    expect(floorSelect).not.toBeDisabled()

    // Select Floor
    fireEvent.change(floorSelect, { target: { value: '1' } })
    expect(roomSelect).not.toBeDisabled()

    // Select Room
    fireEvent.change(roomSelect, { target: { value: '10' } })
    expect(roomSelect.value).toBe('10')
  })

  it('appends quick symptom snippets to textarea', () => {
    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    const symptomTextarea = screen.getByPlaceholderText(/อธิบายอาการเสีย ปัญหาที่พบ/i) as HTMLTextAreaElement
    expect(symptomTextarea.value).toBe('')

    const quickSymptomBtn = screen.getByRole('button', { name: /\+ เปิดไม่ติด \/ ไม่มีไฟเข้า/i })
    fireEvent.click(quickSymptomBtn)

    expect(symptomTextarea.value).toContain('เปิดไม่ติด / ไม่มีไฟเข้า')
  })

  it('submits successfully and renders receipt card with ticket number', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          taskId: 'task-789',
          taskNo: 'IT-2603-099',
        },
      }),
    })

    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    // 1. Select repair category
    const itCard = screen.getByRole('radio', { name: /คอมพิวเตอร์ \/ IT/i })
    fireEvent.click(itCard)

    // 2. Fill equipment name
    const equipNameInput = screen.getByPlaceholderText(/เช่น คอมพิวเตอร์ All-in-One Dell/i)
    fireEvent.change(equipNameInput, { target: { value: 'คอมพิวเตอร์ Dell All-in-One' } })

    // 3. Select location
    const buildingSelect = screen.getByLabelText(/1\. อาคาร \/ ตึก/i)
    fireEvent.change(buildingSelect, { target: { value: '1' } })
    const floorSelect = screen.getByLabelText(/2\. ชั้น/i)
    fireEvent.change(floorSelect, { target: { value: '1' } })
    const roomSelect = screen.getByLabelText(/3\. ห้อง \/ แผนก/i)
    fireEvent.change(roomSelect, { target: { value: '10' } })

    // 4. Enter symptom
    const symptomTextarea = screen.getByPlaceholderText(/อธิบายอาการเสีย ปัญหาที่พบ/i)
    fireEvent.change(symptomTextarea, { target: { value: 'เปิดเครื่องแล้วหน้าจอมืดสนิท ไม่มีไฟสถานะขึ้น' } })

    // 5. Submit form
    const submitBtn = screen.getByRole('button', { name: /ยืนยันส่งใบแจ้งซ่อม/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('ส่งใบแจ้งซ่อมสำเร็จเรียบร้อย!')).toBeInTheDocument()
      expect(screen.getByText('IT-2603-099')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /เปิดดูรายละเอียดและติดตามสถานะ/i })).toBeInTheDocument()
    })
  })

  it('shows error alert if user attempts to submit without picking a category', async () => {
    render(
      <RepairFormClient
        currentUser={mockCurrentUser}
        initialLocations={mockLocations}
      />
    )

    const submitBtn = screen.getByRole('button', { name: /ยืนยันส่งใบแจ้งซ่อม/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/กรุณาเลือกประเภทงานซ่อม/i)).toBeInTheDocument()
    })
  })
})
