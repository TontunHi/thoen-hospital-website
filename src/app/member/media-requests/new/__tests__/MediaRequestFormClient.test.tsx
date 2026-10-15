import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MediaRequestFormClient from '../MediaRequestFormClient'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('MediaRequestFormClient Component (Hallmark Anti-AI-Slop Redesign)', () => {
  const mockCurrentUser = {
    id: 1,
    username: 'pr_officer',
    name: 'นาย ประชาสัมพันธ์ ชำนาญการ',
    department: 'กลุ่มงานดิจิทัลทางการแพทย์',
    position: 'นักวิชาการคอมพิวเตอร์',
    phone: '108',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    global.fetch = vi.fn()
  })

  it('renders clinical workbench layout, header, nav, and 4 numbered steps with zero redundant date/location badges', () => {
    render(<MediaRequestFormClient currentUser={mockCurrentUser} />)

    // Header & Navigation
    expect(screen.getByText('แบบฟอร์มขอรับบริการสื่อประชาสัมพันธ์')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /กลับหน้ารายการคำขอสื่อ/i })).toBeInTheDocument()

    // Ensure redundant date box and location badge are NOT present
    expect(screen.queryByText(/วันที่ทำรายการ/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/โรงพยาบาลเถิน จ.ลำปาง • กลุ่มงานดิจิทัลทางการแพทย์/i)
    ).not.toBeInTheDocument()

    // 4 Step Headings
    expect(screen.getByRole('heading', { name: /เรื่องและรายละเอียดงาน/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /ลักษณะงานสื่อที่ต้องการ/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /ต้องการเผยแพร่ทางช่องทางใด/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /แนบไฟล์ตัวอย่าง \/ เอกสารเนื้อหา \/ ลิงก์ไดรฟ์/i })
    ).toBeInTheDocument()

    // Sidebar Identity & Timeline
    expect(screen.getByText('ผู้ยื่นคำขอและเบอร์ติดต่อ')).toBeInTheDocument()
    expect(screen.getByText('นาย ประชาสัมพันธ์ ชำนาญการ')).toBeInTheDocument()
    expect(screen.getByText('กลุ่มงานดิจิทัลทางการแพทย์')).toBeInTheDocument()
    expect(screen.getByText('กำหนดส่งมอบ & ความเร่งด่วน')).toBeInTheDocument()
    expect(screen.getByText('รูปแบบค่าใช้จ่าย & สายอนุมัติ')).toBeInTheDocument()
    expect(screen.getByText('ความพร้อมของข้อมูลคำขอ:')).toBeInTheDocument()
  })

  it('allows selecting work types, toggles selection, and shows custom detail input for poster', () => {
    render(<MediaRequestFormClient currentUser={mockCurrentUser} />)

    const posterOption = screen.getByRole('checkbox', { name: /โปสเตอร์/i })
    expect(posterOption).toHaveAttribute('aria-checked', 'false')

    // Click poster
    fireEvent.click(posterOption)
    expect(posterOption).toHaveAttribute('aria-checked', 'true')

    // Custom input should appear for poster
    const posterInput = screen.getByLabelText('ระบุรายละเอียดสำหรับ โปสเตอร์')
    expect(posterInput).toBeInTheDocument()

    fireEvent.change(posterInput, { target: { value: 'แนวนอน' } })
    expect(posterInput).toHaveValue('แนวนอน')

    // Click quick tag pill (+ A3)
    const a3Pill = screen.getByRole('button', { name: /\+ A3/i })
    fireEvent.click(a3Pill)
    expect(posterInput).toHaveValue('แนวนอน, A3')
  })

  it('allows selecting publishing channels and toggling them', () => {
    render(<MediaRequestFormClient currentUser={mockCurrentUser} />)

    const socialChannel = screen.getByRole('checkbox', { name: /สื่อโซเชียลของรพ\./i })
    expect(socialChannel).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(socialChannel)
    expect(socialChannel).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(socialChannel)
    expect(socialChannel).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles cost type and displays quotation dropzone only when HAS_COST', () => {
    render(<MediaRequestFormClient currentUser={mockCurrentUser} />)

    const noCostRadio = screen.getByRole('radio', { name: /ไม่มีค่าใช้จ่าย \(No Cost\)/i })
    const hasCostRadio = screen.getByRole('radio', { name: /🔴 มีค่าใช้จ่าย \(With Cost\)/i })

    expect(noCostRadio).toHaveAttribute('aria-checked', 'true')
    expect(hasCostRadio).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText(/เอกสารใบเสนอราคา \(Quotation\)/i)).not.toBeInTheDocument()

    // Switch to HAS_COST
    fireEvent.click(hasCostRadio)
    expect(hasCostRadio).toHaveAttribute('aria-checked', 'true')
    expect(noCostRadio).toHaveAttribute('aria-checked', 'false')

    // Quotation section should now be visible
    expect(screen.getByText(/เอกสารใบเสนอราคา \(Quotation\)/i)).toBeInTheDocument()
    expect(screen.getByText(/สำหรับงานที่มีค่าใช้จ่าย \(เสนอ ผอ\.\)/i)).toBeInTheDocument()
  })

  it('validates required fields and shows error alert when submitted empty', async () => {
    render(<MediaRequestFormClient currentUser={mockCurrentUser} />)

    const submitBtn = screen.getByRole('button', { name: /ส่งคำขอรับบริการสื่อ/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(
        screen.getByText('กรุณาระบุเรื่อง / หัวข้องานสื่อประชาสัมพันธ์')
      ).toBeInTheDocument()
    })
  })

  it('submits form successfully and displays success modal with task info', async () => {
    const mockCreated = {
      taskId: 'task-pr-12345',
      taskNo: 'PR-2569-0042',
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockCreated,
      }),
    })

    render(<MediaRequestFormClient currentUser={mockCurrentUser} />)

    // 1. Fill title
    const titleInput = screen.getByLabelText(/เรื่อง \/ หัวข้องานสื่อประชาสัมพันธ์/i)
    fireEvent.change(titleInput, {
      target: { value: 'จัดทำป้ายไวนิลรณรงค์วันไข้เลือดออก' },
    })

    // 2. Select work type
    const triFold = screen.getByRole('checkbox', { name: /แผ่นพับ 3 พับ/i })
    fireEvent.click(triFold)

    // 3. Select channel
    const facebookChannel = screen.getByRole('checkbox', { name: /Page Facebook/i })
    fireEvent.click(facebookChannel)

    // 4. Fill description
    const descTextarea = screen.getByLabelText(/รายละเอียดเนื้อหาและข้อกำหนดพิเศษ/i)
    fireEvent.change(descTextarea, {
      target: { value: 'ต้องการเน้น 3 เก็บ ป้องกัน 3 โรค โทนสีเขียว-ฟ้า สะอาดตา' },
    })

    // 5. Select delivery date
    const dateInput = screen.getByLabelText(/วันที่ขอรับงานเสร็จ/i)
    fireEvent.change(dateInput, { target: { value: '2026-11-01' } })

    // 6. Submit
    const submitBtn = screen.getByRole('button', { name: /ส่งคำขอรับบริการสื่อ/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('ส่งคำขอสื่อเรียบร้อยแล้ว')).toBeInTheDocument()
      expect(screen.getByText('PR-2569-0042')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /เปิดดูรายละเอียดและติดตามสถานะ/i })).toHaveAttribute(
        'href',
        '/member/inbox/task-pr-12345'
      )
    })
  })
})
