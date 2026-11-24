import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeWorkflowAction } from '../taskInboxService'
import * as audit from '../audit'
import * as telegramService from '../telegramService'

vi.mock('../audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('../apiGateway', () => ({
  apiGateway: {
    app: {
      getInboxTelegramTargetsV2: vi.fn().mockResolvedValue({ chatIds: ['123456789'] }),
    },
  },
}))

vi.mock('../telegramService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(true),
}))

describe('executeWorkflowAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTask = {
    id: 't-1',
    task_no: 'TASK-1',
    task_type: 'DOC_APPROVAL',
    title: 'Test Task',
    requester_id: 1,
    requester_name: 'Requester',
    current_assignee: 2,
    current_step_no: 1,
    status: 'PENDING',
  }

  const mockSteps = [
    { id: 's-1', task_id: 't-1', step_no: 1, step_name: 'Step 1', status: 'PENDING', assigned_to_id: 2 },
    { id: 's-2', task_id: 't-1', step_no: 2, step_name: 'Step 2', status: 'PENDING', assigned_to_id: 3 },
  ]

  const createGateway = (taskData: any = mockTask, stepsData: any[] = mockSteps, wfReturn: any = {}) => ({
    getTaskFullDetails: vi.fn().mockResolvedValue({
      success: true,
      data: { task: taskData, steps: stepsData, repairDetail: null, auditLogs: [] },
    }),
    executeWorkflowActionV2: vi.fn().mockResolvedValue({
      message: 'ดำเนินการสำเร็จ',
      isFinalStep: false,
      nextStep: stepsData.find((s) => s.step_no === (taskData?.current_step_no || 0) + 1) ?? null,
      targetStep: null,
      ...wfReturn,
    }),
  })

  it('should approve and advance to next step', async () => {
    const gw = createGateway()
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 2,
        actorUsername: 'user2',
        actorName: 'User Two',
        actorPosition: 'Manager',
        actorRole: 'member',
        action: 'APPROVE',
        comment: 'OK',
        signaturePath: '/sig.png',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 't-1',
        action: 'APPROVE',
        comment: 'OK',
        signaturePath: '/sig.png',
        signatureHash: expect.any(String),
      })
    )
    expect(audit.logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'inbox_tasks',
      'APPROVE task t-1 (Step 1)',
      { username: 'user2', email: '' }
    )
  })

  it('should reject task', async () => {
    const gw = createGateway()
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 2,
        actorUsername: 'user2',
        actorName: 'User Two',
        actorPosition: 'Manager',
        actorRole: 'member',
        action: 'REJECT',
        comment: 'No',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't-1', action: 'REJECT', comment: 'No' })
    )
  })

  it('should send back task at step 1 to requester', async () => {
    const gw = createGateway()
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 2,
        actorUsername: 'user2',
        actorName: 'User Two',
        actorPosition: 'Manager',
        actorRole: 'member',
        action: 'SEND_BACK',
        comment: 'Fix this',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't-1', action: 'SEND_BACK', comment: 'Fix this' })
    )
  })

  it('should send back task from step 3 to step 2 (previous step)', async () => {
    const step3Task = { ...mockTask, current_step_no: 3, current_assignee: 4 }
    const threeSteps = [
      { id: 's-1', task_id: 't-1', step_no: 1, step_name: 'Step 1', status: 'COMPLETED', assigned_to_id: 2, assigned_role: 'Role 1' },
      { id: 's-2', task_id: 't-1', step_no: 2, step_name: 'Step 2', status: 'COMPLETED', assigned_to_id: 3, assigned_role: 'Role 2' },
      { id: 's-3', task_id: 't-1', step_no: 3, step_name: 'Step 3', status: 'PENDING', assigned_to_id: 4, assigned_role: 'Role 3' },
    ]
    const gw = createGateway(step3Task, threeSteps, { targetStep: threeSteps[1] })
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 4,
        actorUsername: 'user4',
        actorName: 'User Four',
        actorPosition: 'Director',
        actorRole: 'member',
        action: 'SEND_BACK',
        targetStepNo: 2,
        comment: 'Re-check financial detail',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't-1', action: 'SEND_BACK', targetStepNo: 2 })
    )
  })

  it('should send back task from step 3 to requester when sendToRequester is true', async () => {
    const step3Task = { ...mockTask, current_step_no: 3, current_assignee: 4, requester_id: 999 }
    const threeSteps = [
      { id: 's-1', task_id: 't-1', step_no: 1, step_name: 'Step 1', status: 'COMPLETED', assigned_to_id: 2, assigned_role: 'Role 1' },
      { id: 's-2', task_id: 't-1', step_no: 2, step_name: 'Step 2', status: 'COMPLETED', assigned_to_id: 3, assigned_role: 'Role 2' },
      { id: 's-3', task_id: 't-1', step_no: 3, step_name: 'Step 3', status: 'PENDING', assigned_to_id: 4, assigned_role: 'Role 3' },
    ]
    const gw = createGateway(step3Task, threeSteps, { targetStep: null })
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 4,
        actorUsername: 'user4',
        actorName: 'User Four',
        actorPosition: 'Director',
        actorRole: 'member',
        action: 'SEND_BACK',
        sendToRequester: true,
        comment: 'Need requester to amend project scope',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't-1', action: 'SEND_BACK', sendToRequester: true })
    )
  })

  it('should throw unauthorized if actor lacks permission', async () => {
    const gw = createGateway()
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 99,
        actorUsername: 'user99',
        actorName: 'User 99',
        actorPosition: 'Staff',
        actorRole: 'member',
        action: 'APPROVE',
      },
      gw
    ).catch((e) => e)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toContain('ไม่มีสิทธิ์')
    expect(gw.executeWorkflowActionV2).not.toHaveBeenCalled()
  })

  it('should not send duplicate Telegram broadcast when advancing MEDIA_REQUEST to a PR_OFFICER step', async () => {
    const mediaTaskStep5 = {
      id: 'pr-1',
      task_no: 'PR-2570-10-0001',
      task_type: 'MEDIA_REQUEST',
      title: 'โลโก้กระทรวงสาธารณสุข',
      requester_id: 10,
      requester_name: 'นาย ธนยศ กันทะมา',
      requester_dept: 'กลุ่มงานบริหารทั่วไป',
      current_assignee: null,
      current_role: 'ผู้อำนวยการโรงพยาบาลเถิน',
      current_step_no: 5,
      status: 'PENDING',
    }
    const mediaSteps = [
      { id: 's-5', task_id: 'pr-1', step_no: 5, step_name: 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ', status: 'PENDING', assigned_role: 'ผู้อำนวยการโรงพยาบาลเถิน' },
      { id: 's-6', task_id: 'pr-1', step_no: 6, step_name: 'นักประชาสัมพันธ์ ดำเนินการสั่งพิมพ์/ผลิตสื่อ', status: 'WAITING', assigned_role: 'นักประชาสัมพันธ์' },
    ]
    const gw = createGateway(mediaTaskStep5, mediaSteps, { nextStep: mediaSteps[1] })

    const result = await executeWorkflowAction(
      {
        taskId: 'pr-1',
        actorMemberId: 1,
        actorUsername: 'director',
        actorName: 'ผู้อำนวยการ',
        actorPosition: 'ผู้อำนวยการโรงพยาบาลเถิน',
        actorRole: 'member',
        action: 'APPROVE',
        comment: 'อนุมัติ',
      },
      gw
    )

    expect(result.success).toBe(true)
    const telegramCalls = vi.mocked(telegramService.sendTelegramMessage).mock.calls
    const newJobMessages = telegramCalls.filter(([_, msg]) => msg.includes('มีงานจัดทำสื่อประชาสัมพันธ์'))
    expect(newJobMessages.length).toBe(0)
  })

  it('should notify final completion on last step of MEDIA_REQUEST without duplicate', async () => {
    const mediaTaskStep7 = {
      id: 'pr-1',
      task_no: 'PR-2570-10-0001',
      task_type: 'MEDIA_REQUEST',
      title: 'โลโก้กระทรวงสาธารณสุข',
      requester_id: 10,
      requester_name: 'นาย ธนยศ กันทะมา',
      requester_dept: 'กลุ่มงานบริหารทั่วไป',
      current_assignee: null,
      current_role: 'นักประชาสัมพันธ์',
      current_step_no: 7,
      status: 'PENDING',
    }
    const mediaSteps = [
      { id: 's-7', task_id: 'pr-1', step_no: 7, step_name: 'นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน', status: 'PENDING', assigned_role: 'นักประชาสัมพันธ์' },
    ]
    const gw = createGateway(mediaTaskStep7, mediaSteps, { isFinalStep: true, nextStep: null })

    const result = await executeWorkflowAction(
      {
        taskId: 'pr-1',
        actorMemberId: 5,
        actorUsername: 'pr_staff',
        actorName: 'พรพิมล มีศรี',
        actorPosition: 'นักประชาสัมพันธ์',
        actorRole: 'member',
        action: 'APPROVE',
        comment: 'ส่งมอบงานเรียบร้อย',
      },
      gw
    )

    expect(result.success).toBe(true)
    const telegramCalls = vi.mocked(telegramService.sendTelegramMessage).mock.calls
    const finalMessages = telegramCalls.filter(([_, msg]) =>
      msg.includes('คำขอสื่อประชาสัมพันธ์ผ่านการอนุมัติสมบูรณ์แล้ว')
    )
    expect(finalMessages.length).toBeGreaterThan(0)
  })

  it('should hold task with hold reason and details', async () => {
    const gw = createGateway(mockTask, mockSteps, { message: 'พักงานเรียบร้อยแล้ว' })
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 2,
        actorUsername: 'user2',
        actorName: 'User Two',
        actorPosition: 'Manager',
        actorRole: 'member',
        action: 'HOLD',
        holdReason: 'รอการจัดสรรงบ',
        holdDetails: 'รองบประมาณปี 2570 ไตรมาส 1',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 't-1',
        action: 'HOLD',
        holdReason: 'รอการจัดสรรงบ',
      })
    )
  })

  it('should resume held task back to pending', async () => {
    const heldTask = { ...mockTask, status: 'ON_HOLD' }
    const gw = createGateway(heldTask, mockSteps, {
      message: 'ปลดพักงานและกลับมาดำเนินการต่อเรียบร้อยแล้ว',
    })
    const result = await executeWorkflowAction(
      {
        taskId: 't-1',
        actorMemberId: 2,
        actorUsername: 'user2',
        actorName: 'User Two',
        actorPosition: 'Manager',
        actorRole: 'member',
        action: 'RESUME',
        comment: 'งบประมาณได้รับการอนุมัติแล้ว ดำเนินการต่อ',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't-1', action: 'RESUME' })
    )
  })

  it('should immediately complete media request when executed by PR staff', async () => {
    const mediaTask = {
      id: 'mr-1',
      task_no: 'PR-2570-10-0001',
      task_type: 'MEDIA_REQUEST',
      title: 'ป้ายไวนิลกิจกรรมรณรงค์',
      requester_id: 10,
      requester_name: 'ผู้ร้องขอ ทดสอบ',
      requester_dept: 'งานเวชปฏิบัติทั่วไป',
      current_assignee: 5,
      current_step_no: 2,
      status: 'IN_PROGRESS',
    }
    const mediaSteps = [
      { id: 'ms-1', task_id: 'mr-1', step_no: 1, step_name: 'รับเรื่อง', status: 'COMPLETED', assigned_to_id: 5 },
      { id: 'ms-2', task_id: 'mr-1', step_no: 2, step_name: 'พิจารณาอนุมัติ', status: 'PENDING', assigned_to_id: 6 },
    ]
    const gw = createGateway(mediaTask, mediaSteps)

    const result = await executeWorkflowAction(
      {
        taskId: 'mr-1',
        actorMemberId: 5,
        actorUsername: 'pr_officer',
        actorName: 'เจ้าหน้าที่ ประชาสัมพันธ์',
        actorPosition: 'นักประชาสัมพันธ์',
        actorRole: 'member',
        action: 'COMPLETE',
        comment: 'จัดทำป้ายไวนิลและส่งมอบเรียบร้อยแล้ว',
      },
      gw
    )

    expect(result.success).toBe(true)
    expect(gw.executeWorkflowActionV2).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'mr-1', action: 'COMPLETE' })
    )
    expect(audit.logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'inbox_tasks',
      'COMPLETE task mr-1 (Step 2)',
      { username: 'pr_officer', email: '' }
    )
  })

  it('should disallow COMPLETE action for non-media request task', async () => {
    const itRepairTask = { ...mockTask, task_type: 'IT_REPAIR' }
    const gw = createGateway(itRepairTask)

    await expect(
      executeWorkflowAction(
        {
          taskId: 't-1',
          actorMemberId: 2,
          actorUsername: 'admin',
          actorName: 'Admin',
          actorPosition: 'Admin',
          actorRole: 'admin',
          action: 'COMPLETE',
        },
        gw
      )
    ).rejects.toThrow('ฟังก์ชันเสร็จสิ้นทันทีรองรับเฉพาะงานสื่อประชาสัมพันธ์เท่านั้น')
  })
})
