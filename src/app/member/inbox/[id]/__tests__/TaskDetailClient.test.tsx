import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TaskDetailClient from '../TaskDetailClient'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('TaskDetailClient Component (Hallmark Anti-Clutter & Collapsible Workflow)', () => {
  const mockSessionUser = {
    id: 10,
    username: 'admin01',
    name: 'ดร. นพ. กิตติภูมิ รัตนวงษ์',
    role: 'admin',
    position: 'ผู้อำนวยการโรงพยาบาล',
    department: 'กลุ่มงานบริหารทั่วไป',
    isAdmin: true,
  }

  const mockTask = {
    id: 'task-pr-001',
    task_no: 'PR-2603-001',
    task_type: 'MEDIA_REQUEST',
    title: 'จัดทำสื่อไวนิลประชาสัมพันธ์งานสัปดาห์สุขภาพ',
    description: 'ต้องการไวนิลขนาด 3x1.5 เมตร สำหรับติดตั้งหน้าตึกอุบัติเหตุและฉุกเฉิน',
    urgency: 'URGENT',
    status: 'PENDING',
    current_step_no: 2,
    requester_id: 25,
    requester_name: 'สมศรี มณีฉาย',
    requester_dept: 'งานประชาสัมพันธ์',
    created_at: '2026-03-15T09:00:00.000Z',
    updated_at: '2026-03-15T09:30:00.000Z',
    custom_payload: {
      costType: 'HAS_COST',
      estimatedBudget: '3500',
      deliveryDate: '2026-03-25',
      phone: '081-234-5678',
      workTypes: [{ key: 'other', label: 'ไวนิล', customDetail: '3x1.5 เมตร' }],
      channels: [{ key: 'indoor', label: 'ในอาคารโรงพยาบาล', customDetail: 'หน้าตึกฉุกเฉิน' }],
    },
  }

  const mockSteps = [
    {
      id: 'step-1',
      step_no: 1,
      step_name: 'ผู้ยื่นคำขอส่งเรื่อง',
      assignee_type: 'USER',
      assigned_to_id: 25,
      assigned_role: 'ผู้ยื่นคำขอ',
      assigned_to_name: 'สมศรี มณีฉาย',
      assigned_to_position: 'นักประชาสัมพันธ์',
      status: 'COMPLETED',
      action_taken: 'SUBMITTED',
      action_by_name: 'สมศรี มณีฉาย',
      action_at: '2026-03-15T09:00:00.000Z',
      comment: 'ยื่นเรื่องขอผลิตสื่อ',
      signature_path: '/signatures/user-25.png',
      signature_hash: 'hash-123',
    },
    {
      id: 'step-2',
      step_no: 2,
      step_name: 'หัวหน้างานประชาสัมพันธ์พิจารณา',
      assignee_type: 'ROLE',
      assigned_to_id: 10,
      assigned_role: 'หัวหน้างานประชาสัมพันธ์',
      assigned_to_name: 'ดร. นพ. กิตติภูมิ รัตนวงษ์',
      assigned_to_position: 'ผู้อำนวยการโรงพยาบาล',
      status: 'PENDING',
      action_taken: null,
      action_by_name: null,
      action_at: null,
      comment: null,
      signature_path: null,
      signature_hash: null,
    },
    {
      id: 'step-3',
      step_no: 3,
      step_name: 'เจ้าหน้าที่พัสดุตรวจสอบงบประมาณ',
      assignee_type: 'ROLE',
      assigned_to_id: null,
      assigned_role: 'เจ้าหน้าที่พัสดุ',
      assigned_to_name: 'นายสมบัติ จัดซื้อ',
      assigned_to_position: 'นักวิชาการพัสดุ',
      status: 'PENDING',
      action_taken: null,
      action_by_name: null,
      action_at: null,
      comment: null,
      signature_path: null,
      signature_hash: null,
    },
    {
      id: 'step-4',
      step_no: 4,
      step_name: 'ผู้อำนวยการโรงพยาบาลอนุมัติ',
      assignee_type: 'ROLE',
      assigned_to_id: null,
      assigned_role: 'ผู้อำนวยการ',
      assigned_to_name: 'ดร. นพ. กิตติภูมิ รัตนวงษ์',
      assigned_to_position: 'ผู้อำนวยการโรงพยาบาล',
      status: 'PENDING',
      action_taken: null,
      action_by_name: null,
      action_at: null,
      comment: null,
      signature_path: null,
      signature_hash: null,
    },
  ]

  const mockAuditLogs = [
    {
      id: 'audit-1',
      action: 'สร้างคำขอสื่อประชาสัมพันธ์',
      performed_by: 25,
      performer_name: 'สมศรี มณีฉาย',
      details: {},
      created_at: '2026-03-15T09:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/member/inbox/task-pr-001')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              task: mockTask,
              steps: mockSteps,
              auditLogs: mockAuditLogs,
              repairDetail: null,
              currentUser: {
                ...mockSessionUser,
                isRequester: false,
                isCurrentAssignee: true,
                hasSignature: true,
              },
              allMembers: [],
            },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })
    }) as any
  })

  it('renders task header, requester info, and media request summary correctly', async () => {
    render(<TaskDetailClient taskId="task-pr-001" sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByText('จัดทำสื่อไวนิลประชาสัมพันธ์งานสัปดาห์สุขภาพ')).toBeInTheDocument()
      expect(screen.getAllByText('PR-2603-001').length).toBeGreaterThan(0)
      expect(screen.getAllByText('สมศรี มณีฉาย').length).toBeGreaterThan(0)
      expect(screen.getAllByText('งานประชาสัมพันธ์').length).toBeGreaterThan(0)
    })
  })

  it('renders collapsible workflow timeline in compact minimized view by default', async () => {
    render(<TaskDetailClient taskId="task-pr-001" sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByText('ขั้นตอนการอนุมัติ')).toBeInTheDocument()
      expect(screen.getByText('1/4')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ดูทั้งหมด \(4\)/i })).toBeInTheDocument()
    })

    // Shows the current active step in the collapsed card
    expect(screen.getByText('หัวหน้างานประชาสัมพันธ์พิจารณา')).toBeInTheDocument()
    expect(screen.getByText(/ขั้นตอนปัจจุบัน \(2\/4\)/)).toBeInTheDocument()
  })

  it('toggles workflow timeline between expanded full pipeline and collapsed active step', async () => {
    render(<TaskDetailClient taskId="task-pr-001" sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ดูทั้งหมด \(4\)/i })).toBeInTheDocument()
    })

    // Click to expand
    const expandBtn = screen.getByRole('button', { name: /ดูทั้งหมด \(4\)/i })
    fireEvent.click(expandBtn)

    // Now all steps should be visible in the pipeline list
    await waitFor(() => {
      expect(screen.getByText('ผู้ยื่นคำขอส่งเรื่อง')).toBeInTheDocument()
      expect(screen.getByText('หัวหน้างานประชาสัมพันธ์พิจารณา')).toBeInTheDocument()
      expect(screen.getByText('เจ้าหน้าที่พัสดุตรวจสอบงบประมาณ')).toBeInTheDocument()
      expect(screen.getByText('ผู้อำนวยการโรงพยาบาลอนุมัติ')).toBeInTheDocument()
    })

    // The button now says "ย่อขั้นตอน"
    const collapseBtns = screen.getAllByRole('button', { name: /ย่อขั้นตอน/i })
    expect(collapseBtns.length).toBeGreaterThan(0)

    // Click to collapse
    fireEvent.click(collapseBtns[0])

    // Should collapse back
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ดูทั้งหมด \(4\)/i })).toBeInTheDocument()
    })
  })

  it('renders audit trail in collapsible view by default and toggles on click', async () => {
    render(<TaskDetailClient taskId="task-pr-001" sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByText('ประวัติการดำเนินงาน')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลคำร้อง')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ดูประวัติ \(1\)/i })).toBeInTheDocument()
      expect(screen.getByText(/มีบันทึกประวัติการดำเนินงาน 1 รายการ/)).toBeInTheDocument()
    })

    // Initially collapsed: audit logs list is not rendered
    expect(screen.queryByText('สร้างคำขอสื่อประชาสัมพันธ์')).not.toBeInTheDocument()

    // Click to expand audit trail
    const expandAuditBtn = screen.getByRole('button', { name: /ดูประวัติ \(1\)/i })
    fireEvent.click(expandAuditBtn)

    // Now log entry is visible
    await waitFor(() => {
      expect(screen.getByText('สร้างคำขอสื่อประชาสัมพันธ์')).toBeInTheDocument()
    })

    // Click to collapse
    const collapseAuditBtns = screen.getAllByRole('button', { name: /ซ่อนประวัติ/i })
    expect(collapseAuditBtns.length).toBeGreaterThan(0)
    fireEvent.click(collapseAuditBtns[0])

    // Collapsed again
    await waitFor(() => {
      expect(screen.queryByText('สร้างคำขอสื่อประชาสัมพันธ์')).not.toBeInTheDocument()
    })
  })

  it('renders approval action buttons for authorized user', async () => {
    render(<TaskDetailClient taskId="task-pr-001" sessionUser={mockSessionUser} />)

    await waitFor(() => {
      expect(screen.getByText('คิวงานรอคุณลงนาม / พิจารณาอนุมัติ')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ลงนามอนุมัติ/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ส่งกลับแก้ไข/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ไม่อนุมัติ/i })).toBeInTheDocument()
    })
  })
})
