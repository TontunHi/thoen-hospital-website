import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MediaRequestsListClient from '../MediaRequestsListClient'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('MediaRequestsListClient Component (Hallmark Anti-AI-Slop Redesign)', () => {
  const mockTasks = [
    {
      id: 'task-pr-001',
      task_no: 'PR-2569-0001',
      task_type: 'MEDIA_REQUEST',
      title: 'จัดทำป้ายไวนิลสัปดาห์เภสัชกรรม 2569',
      description: 'ต้องการไวนิลขนาด 1x3 เมตร โทนสีเขียวขาว',
      urgency: 'VERY_URGENT' as const,
      requester_id: 10,
      requester_name: 'ภก. สมชาย ใจดี',
      requester_dept: 'กลุ่มงานเภสัชกรรม',
      status: 'PENDING' as const,
      current_step_no: 1,
      current_step_name: 'นักประชาสัมพันธ์ตรวจสอบเรื่อง',
      custom_payload: {
        costType: 'HAS_COST',
        deliveryDate: '2026-10-25',
        workTypes: [{ key: 'other', label: 'ไวนิล', customDetail: '1x3 เมตร' }],
        channels: [{ key: 'indoor', label: 'ในอาคาร' }],
      },
      created_at: '2026-10-14T08:30:00Z',
      updated_at: '2026-10-14T08:30:00Z',
    },
    {
      id: 'task-pr-002',
      task_no: 'PR-2569-0002',
      task_type: 'MEDIA_REQUEST',
      title: 'แผ่นพับแนะนำการปฏิบัติตัวหลังผ่าตัด',
      description: 'แผ่นพับ 3 พับ 4 สี',
      urgency: 'NORMAL' as const,
      requester_id: 12,
      requester_name: 'พว. สมหญิง รักสงบ',
      requester_dept: 'กลุ่มงานการพยาบาล',
      status: 'APPROVED' as const,
      current_step_no: 4,
      current_step_name: 'ส่งมอบงานเรียบร้อย',
      custom_payload: {
        costType: 'NO_COST',
        deliveryDate: '2026-11-05',
        workTypes: [{ key: 'tri_fold', label: 'แผ่นพับ 3 พับ' }],
        channels: [{ key: 'hospital_social', label: 'สื่อโซเชียลของรพ.' }],
      },
      created_at: '2026-10-12T10:15:00Z',
      updated_at: '2026-10-13T14:20:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders executive clinical header, navigation bar, and stats counters', () => {
    render(<MediaRequestsListClient initialTasks={mockTasks} canViewAll={true} />)

    // Header & Navigation
    expect(screen.getByText('ระบบขอสื่อประชาสัมพันธ์')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /กลับสู่พอร์ทัลสมาชิก/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /กล่องงาน \(Task Inbox\)/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ยื่นขอสื่อประชาสัมพันธ์ใหม่/i })).toBeInTheDocument()

    // Stats
    expect(screen.getByText('คำขอทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('รอดำเนินการ / ลงนาม')).toBeInTheDocument()
    expect(screen.getByText('อนุมัติเสร็จสิ้น')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Total count
  })

  it('renders task list items with correct badges, metadata, and action links', () => {
    render(<MediaRequestsListClient initialTasks={mockTasks} canViewAll={true} />)

    // Task 1
    expect(screen.getByText('PR-2569-0001')).toBeInTheDocument()
    expect(screen.getByText('จัดทำป้ายไวนิลสัปดาห์เภสัชกรรม 2569')).toBeInTheDocument()
    expect(screen.getByText('🔴 ด่วนที่สุด')).toBeInTheDocument()
    expect(screen.getByText('มีค่าใช้จ่าย')).toBeInTheDocument()
    expect(screen.getByText('⏳ รอดำเนินการ')).toBeInTheDocument()
    expect(screen.getByText(/ภก\. สมชาย ใจดี/i)).toBeInTheDocument()
    expect(screen.getByText(/2026-10-25/)).toBeInTheDocument()

    // Task 2
    expect(screen.getByText('PR-2569-0002')).toBeInTheDocument()
    expect(screen.getByText('แผ่นพับแนะนำการปฏิบัติตัวหลังผ่าตัด')).toBeInTheDocument()
    expect(screen.getByText('🟢 ไม่ด่วน')).toBeInTheDocument()
    expect(screen.getByText('ไม่มีค่าใช้จ่าย')).toBeInTheDocument()
    expect(screen.getByText('✓ อนุมัติเสร็จสิ้น')).toBeInTheDocument()

    // Action links
    const detailLinks = screen.getAllByRole('link', { name: /เปิดดู \/ อนุมัติ/i })
    expect(detailLinks[0]).toHaveAttribute('href', '/member/inbox/task-pr-001')
    expect(detailLinks[1]).toHaveAttribute('href', '/member/inbox/task-pr-002')

    const printLink = screen.getByLabelText('พิมพ์ใบขอรับบริการเลขที่ PR-2569-0001')
    expect(printLink).toHaveAttribute('href', '/member/media-requests/task-pr-001/print')
  })

  it('filters tasks when clicking status tabs and triggers API call', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tasks: [mockTasks[1]],
        },
      }),
    })

    render(<MediaRequestsListClient initialTasks={mockTasks} canViewAll={true} />)

    const approvedTab = screen.getByRole('tab', { name: /อนุมัติแล้ว/i })
    fireEvent.click(approvedTab)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/member/media-requests?status=APPROVED')
      )
    })
  })

  it('renders empty state when no tasks match', () => {
    render(<MediaRequestsListClient initialTasks={[]} canViewAll={true} />)

    expect(screen.getByText('ไม่พบรายการคำขอสื่อประชาสัมพันธ์')).toBeInTheDocument()
    expect(
      screen.getByText(/คุณยังไม่เคยยื่นคำขอสื่อประชาสัมพันธ์ สามารถกดปุ่มด้านล่างเพื่อเริ่มยื่นคำขอแรก/i)
    ).toBeInTheDocument()
  })
})
