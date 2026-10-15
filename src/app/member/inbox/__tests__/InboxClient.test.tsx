import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import InboxClient from '../InboxClient'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('InboxClient Component (Hallmark Anti-AI-Slop Redesign)', () => {
  const mockSessionUser = {
    username: 'admin01',
    role: 'admin',
    email: 'admin@thoenhospital.go.th',
  }

  const mockTasks = [
    {
      id: 'task-101',
      task_no: 'IT-2603-001',
      task_type: 'IT_REPAIR',
      title: 'คอมพิวเตอร์ห้องตรวจ 3 เปิดไม่ติด',
      urgency: 'VERY_URGENT',
      requester_name: 'นพ. สมชาย ใจดี',
      requester_dept: 'แผนกผู้ป่วยนอก (OPD)',
      status: 'PENDING',
      current_step_no: 1,
      current_step_name: 'รอช่างรับงาน',
      created_at: '2026-03-15T08:30:00.000Z',
      updated_at: '2026-03-15T08:30:00.000Z',
    },
    {
      id: 'task-102',
      task_no: 'GEN-2603-002',
      task_type: 'GENERAL_REPAIR',
      title: 'หลอดไฟทางเดินชั้น 2 กะพริบ',
      urgency: 'NORMAL',
      requester_name: 'พว. สมหญิง ยิ้มแย้ม',
      requester_dept: 'งานการพยาบาล',
      status: 'IN_PROGRESS',
      current_step_no: 2,
      current_step_name: 'กำลังดำเนินการซ่อม',
      created_at: '2026-03-14T10:15:00.000Z',
      updated_at: '2026-03-14T11:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          tasks: mockTasks,
          inboxCount: 1,
          departmentCount: 2,
          userDepartment: 'ศูนย์คอมพิวเตอร์',
          canViewAll: true,
          stats: {
            pendingCount: 1,
            allPendingCount: 4,
            approvedCount: 12,
            myRequestsCount: 2,
          },
        },
      }),
    }) as any
  })

  it('renders executive hospital header with Roman title and shortcut actions', async () => {
    render(<InboxClient sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByText('กล่องงานและคำร้อง')).toBeInTheDocument()
      expect(screen.getByText(/โรงพยาบาลเถิน จ\.ลำปาง/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /แจ้งซ่อมบำรุง/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /ขอสื่อประชาสัมพันธ์/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /หน้าหลักโปรไฟล์/i })).toBeInTheDocument()
    })
  })

  it('renders interactive KPI overview grid with accurate tabular figures', async () => {
    render(<InboxClient sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByText(/งานรอฉันปฏิบัติ/)).toBeInTheDocument()
      expect(screen.getByText(/มีงานค้าง/)).toBeInTheDocument()
    })
  })

  it('renders navigation tabs and search/filter controls', async () => {
    render(<InboxClient sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /งานรอฉันตรวจสอบ/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /คำร้องที่ฉันยื่นขอ/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/ค้นหาตามรหัสงาน/i)).toBeInTheDocument()
    })
  })

  it('renders task list with semantic badges and quick action buttons', async () => {
    render(<InboxClient sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getAllByText('IT-2603-001')[0]).toBeInTheDocument()
      expect(screen.getAllByText('คอมพิวเตอร์ห้องตรวจ 3 เปิดไม่ติด')[0]).toBeInTheDocument()
      expect(screen.getAllByText('ด่วนที่สุด')[0]).toBeInTheDocument()
      expect(screen.getAllByText('ซ่อมคอมฯ/ไอที')[0]).toBeInTheDocument()
    })

    // Quick Accept and Quick Cancel buttons for PENDING repair task
    const acceptButtons = screen.getAllByRole('button', { name: /รับงาน/i })
    expect(acceptButtons.length).toBeGreaterThan(0)
    const cancelButtons = screen.getAllByRole('button', { name: /ยกเลิก/i })
    expect(cancelButtons.length).toBeGreaterThan(0)
  })

  it('opens cancel modal when clicking cancel button and closes cleanly', async () => {
    render(<InboxClient sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getAllByText('IT-2603-001')[0]).toBeInTheDocument()
    })

    const cancelBtn = screen.getAllByRole('button', { name: /ยกเลิก/i })[0]
    fireEvent.click(cancelBtn)

    expect(screen.getByText('ยืนยันการยกเลิก / ปฏิเสธงาน')).toBeInTheDocument()
    expect(screen.getByLabelText(/ระบุเหตุผลในการยกเลิกหรือปฏิเสธ/i)).toBeInTheDocument()

    const dismissButtons = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/i })
    fireEvent.click(dismissButtons[0])

    expect(screen.queryByText('ยืนยันการยกเลิก / ปฏิเสธงาน')).not.toBeInTheDocument()
  })
})
