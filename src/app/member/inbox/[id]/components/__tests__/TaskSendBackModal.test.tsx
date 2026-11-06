import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskSendBackModal from '../TaskSendBackModal'

describe('TaskSendBackModal Component', () => {
  const mockSteps = [
    { id: 's-1', step_no: 1, step_name: 'นักประชาสัมพันธ์ ตรวจสอบและจัดทำแบบ', assigned_role: 'นักประชาสัมพันธ์' },
    { id: 's-2', step_no: 2, step_name: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ ตรวจสอบและเสนอเรื่อง', assigned_role: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' },
    { id: 's-3', step_no: 3, step_name: 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ', assigned_role: 'ผู้อำนวยการโรงพยาบาลเถิน' },
  ]

  it('renders previous step options down to step 1 and requester option when at step 3', () => {
    const handleClose = vi.fn()
    const handleConfirm = vi.fn()
    const setTarget = vi.fn()
    const setRequester = vi.fn()
    const setComment = vi.fn()

    render(
      <TaskSendBackModal
        isOpen={true}
        onClose={handleClose}
        taskNo="PR-2570-11-0001"
        taskTitle="ประชาสัมพันธ์หน้าเพจรพ."
        requesterName="นาย ทินทรรศน์ ศิริโรจน์ฤชาชัย"
        currentStepNo={3}
        currentStepName="ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ"
        steps={mockSteps}
        selectedTargetStepNo={2}
        setSelectedTargetStepNo={setTarget}
        sendToRequester={false}
        setSendToRequester={setRequester}
        comment="โปรดแก้ไขรายละเอียด"
        setComment={setComment}
        actionLoading={false}
        onConfirm={handleConfirm}
      />
    )

    // Modal title & task no
    expect(screen.getByText('ส่งกลับไปแก้ไข (Send Back)')).toBeInTheDocument()
    expect(screen.getByText('PR-2570-11-0001')).toBeInTheDocument()

    // Step 2 option (previous step)
    expect(screen.getByText(/ขั้นตอนที่ 2: หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์/i)).toBeInTheDocument()
    expect(screen.getByText('ขั้นตอนก่อนหน้า')).toBeInTheDocument()

    // Step 1 option
    expect(screen.getByText(/ขั้นตอนที่ 1: นักประชาสัมพันธ์/i)).toBeInTheDocument()

    // Requester option
    expect(screen.getByText(/ผู้ยื่นคำขอรับบริการ \(ส่งกลับผู้ขอเพื่อแก้ไขข้อมูล\)/i)).toBeInTheDocument()
    expect(screen.getByText(/นาย ทินทรรศน์ ศิริโรจน์ฤชาชัย/i)).toBeInTheDocument()

    // Confirm button enabled with comment
    const confirmBtn = screen.getByRole('button', { name: /ยืนยันส่งกลับแก้ไข/i })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables confirm button when comment is empty', () => {
    render(
      <TaskSendBackModal
        isOpen={true}
        onClose={vi.fn()}
        taskNo="PR-2570-11-0001"
        taskTitle="ประชาสัมพันธ์"
        requesterName="สมชาย"
        currentStepNo={2}
        steps={mockSteps}
        selectedTargetStepNo={1}
        setSelectedTargetStepNo={vi.fn()}
        sendToRequester={false}
        setSendToRequester={vi.fn()}
        comment=""
        setComment={vi.fn()}
        actionLoading={false}
        onConfirm={vi.fn()}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: /ยืนยันส่งกลับแก้ไข/i })
    expect(confirmBtn).toBeDisabled()
    expect(screen.getByText(/\* จำเป็นต้องระบุเหตุผลในการส่งกลับแก้ไข/i)).toBeInTheDocument()
  })

  it('renders simple requester destination when at step 1', () => {
    render(
      <TaskSendBackModal
        isOpen={true}
        onClose={vi.fn()}
        taskNo="PR-2570-11-0001"
        taskTitle="ประชาสัมพันธ์"
        requesterName="สมชาย ใจดี"
        currentStepNo={1}
        steps={mockSteps}
        selectedTargetStepNo={1}
        setSelectedTargetStepNo={vi.fn()}
        sendToRequester={true}
        setSendToRequester={vi.fn()}
        comment="แก้รูปภาพ"
        setComment={vi.fn()}
        actionLoading={false}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText(/ส่งกลับไปยัง/i)).toBeInTheDocument()
    expect(screen.getByText(/ผู้ยื่นคำขอรับบริการ \(สมชาย ใจดี\)/i)).toBeInTheDocument()
  })
})
