import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PrintTaskClient from '../PrintTaskClient'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../QuotationPrintRenderer', () => ({
  default: () => null,
}))

describe('PrintTaskClient (Repair Print Form)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const buildRepairPayload = (taskType: 'IT_REPAIR' | 'GENERAL_REPAIR' | 'MEDICAL_REPAIR') => ({
    success: true,
    data: {
      task: {
        id: 'task-repair-1',
        task_no: 'REP-2611-001',
        task_type: taskType,
        title: 'เครื่องพิมพ์ไม่ทำงาน',
        description: 'ไฟไม่เข้าเครื่อง',
        requester_name: 'สมชาย ใจดี',
        requester_dept: 'งานเทคโนโลยีสารสนเทศ',
        requester_signature_path: 'signatures/req-1.png',
        created_at: '2026-11-23T02:00:00.000Z',
      },
      steps: [],
      repairDetail: {
        repair_type: taskType,
        item_category: 'EQUIPMENT',
        equipment_number: '7440-013-0001',
        equipment_name: 'เครื่องพิมพ์เลเซอร์',
        location_full_name: 'อาคารผู้ป่วยนอก ชั้น 1',
        symptom_detail: 'เปิดไม่ติดและมีเสียงดัง',
        repair_nature: 'RETROACTIVE',
        cost_type: 'HAS_COST',
        cost_amount: 2500,
        found_problem: 'บอร์ดจ่ายไฟชำรุด',
        solution_step: 'เปลี่ยนชุดจ่ายไฟใหม่',
        is_external_repair: true,
        external_vendor_name: 'ร้านเอ็นซี คอมพิวเตอร์',
        assigned_technician_name: 'นายวิชัย ช่างเทคนิค',
        co_workers: [{ id: 9, name: 'นายสมศักดิ์ ผู้ช่วย' }],
      },
    },
  })

  it.each([
    ['IT_REPAIR', 'ใบแจ้งซ่อมอุปกรณ์คอมพิวเตอร์', 'หัวหน้าศูนย์คอมพิวเตอร์'],
    ['GENERAL_REPAIR', 'ใบแจ้งซ่อมอุปกรณ์ทั่วไป', 'หัวหน้างานซ่อมบำรุง'],
    ['MEDICAL_REPAIR', 'ใบแจ้งซ่อมเครื่องมือทางการแพทย์', 'หัวหน้าศูนย์เครื่องมือแพทย์'],
  ] as const)(
    'renders %s in black-and-white with requester info kept and technician/approval boxes blank',
    async (taskType, expectedHeader, expectedRecipient) => {
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => buildRepairPayload(taskType),
      }) as unknown as typeof fetch

      const { container } = render(<PrintTaskClient taskId="task-repair-1" />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: expectedHeader })).toBeInTheDocument()
      })

      // Requester details are preserved
      expect(screen.getByText(new RegExp(expectedRecipient))).toBeInTheDocument()
      expect(screen.getByText('REP-2611-001')).toBeInTheDocument()
      expect(screen.getByText('งานเทคโนโลยีสารสนเทศ')).toBeInTheDocument()
      expect(screen.getByText('อาคารผู้ป่วยนอก ชั้น 1')).toBeInTheDocument()
      expect(screen.getByText('7440-013-0001')).toBeInTheDocument()
      expect(screen.getByText('เปิดไม่ติดและมีเสียงดัง')).toBeInTheDocument()
      expect(screen.getByText('(สมชาย ใจดี)')).toBeInTheDocument()

      // Signature image is converted to grayscale
      const sigImg = screen.getByAltText('ลายเซ็นผู้แจ้งซ่อม')
      expect(sigImg).toHaveStyle({ filter: 'grayscale(100%) contrast(1.4)' })

      // Only หมายเหตุ and บันทึกงานซ่อม checkboxes/cost amount remain unticked & blank;
      // found_problem, solution_step, and assigned technician / co-workers are displayed
      const repairForm = container.querySelector('.repair-print-form') as HTMLElement
      expect(repairForm).not.toBeNull()
      expect(repairForm).toHaveStyle({ color: 'rgb(0, 0, 0)' })

      const formText = repairForm.textContent || ''
      expect(formText).not.toContain('✓')
      expect(formText).not.toContain('•')
      expect(formText).not.toContain('2,500')

      expect(formText).toContain('บอร์ดจ่ายไฟชำรุด')
      expect(formText).toContain('เปลี่ยนชุดจ่ายไฟใหม่')
      expect(formText).toContain('(นายวิชัย ช่างเทคนิค)')
      expect(formText).toContain('ผู้ร่วมงาน: นายสมศักดิ์ ผู้ช่วย')
      expect(formText).toContain('[   ] ส่งซ่อมปกติ')
      expect(formText).toContain('[   ] ส่งซ่อมย้อนหลัง ช่างดำเนินการซ่อมให้ก่อน')
      expect(formText).toContain('(   ) ไม่มีค่าใช้จ่าย')
      expect(formText).toContain('(   ) มีค่าใช้จ่าย มูลค่า')
      expect(formText).toContain('[   ] อนุมัติ')
      expect(formText).toContain('[   ] ไม่อนุมัติ')
    }
  )

  it('keeps non-repair MEDIA_REQUEST print layout unchanged with checkmarks', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          task: {
            id: 'task-media-1',
            task_no: 'PR-2611-001',
            task_type: 'MEDIA_REQUEST',
            title: 'จัดทำโปสเตอร์',
            description: 'โปสเตอร์ประชาสัมพันธ์',
            urgency: 'URGENT',
            requester_name: 'สมศรี มณีฉาย',
            requester_dept: 'งานประชาสัมพันธ์',
            created_at: '2026-11-23T02:00:00.000Z',
            custom_payload: {
              costType: 'NO_COST',
              deliveryDate: '2026-11-30',
              workTypes: [],
              channels: [],
            },
          },
          steps: [],
          repairDetail: null,
        },
      }),
    }) as unknown as typeof fetch

    const { container } = render(<PrintTaskClient taskId="task-media-1" />)

    await waitFor(() => {
      expect(screen.getByText('แบบฟอร์มขอรับบริการงานสื่อประชาสัมพันธ์')).toBeInTheDocument()
    })

    expect(container.querySelector('.repair-print-form')).toBeNull()
    expect(container.textContent).toContain('✓')
  })
})
