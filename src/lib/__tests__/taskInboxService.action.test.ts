import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeWorkflowAction } from '../taskInboxService'
import * as audit from '../audit'
import * as telegramService from '../telegramService'

vi.mock('../audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('../memberDb', () => ({
  queryMemberDb: vi.fn().mockResolvedValue([]),
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
    status: 'PENDING'
  }

  const mockSteps = [
    { id: 's-1', task_id: 't-1', step_no: 1, step_name: 'Step 1', status: 'PENDING', assigned_to_id: 2 },
    { id: 's-2', task_id: 't-1', step_no: 2, step_name: 'Step 2', status: 'PENDING', assigned_to_id: 3 }
  ]

  const createExecutor = (mockTaskData: any[] = [mockTask], mockStepsData: any[] = mockSteps, additionalMocks: any = {}) => {
    return vi.fn().mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('SELECT * FROM inbox_tasks WHERE id = ?')) {
        return mockTaskData
      }
      if (sql.includes('SELECT * FROM inbox_task_steps WHERE task_id = ?')) {
        return mockStepsData
      }
      if (sql.includes('SELECT telegram_chat_id')) {
        return additionalMocks.telegramLinks || []
      }
      return []
    })
  }

  it('should approve and advance to next step', async () => {
    const executor = createExecutor()
    const result = await executeWorkflowAction({
      taskId: 't-1',
      actorMemberId: 2,
      actorUsername: 'user2',
      actorName: 'User Two',
      actorPosition: 'Manager',
      actorRole: 'member',
      action: 'APPROVE',
      comment: 'OK',
      signaturePath: '/sig.png'
    }, executor)

    expect(result.success).toBe(true)
    
    // Updates current step
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_task_steps"),
      expect.arrayContaining([2, 'User Two', 'OK', '/sig.png', expect.any(String), 's-1'])
    )

    // Advances task
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_tasks"),
      expect.arrayContaining([2, 3, undefined, 't-1'])
    )

    // Audit log
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO inbox_task_audit_logs"),
      expect.arrayContaining(['t-1', 'APPROVE', 2, 'User Two'])
    )
    
    expect(audit.logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'inbox_tasks',
      'APPROVE task t-1 (Step 1)',
      { username: 'user2', email: '' }
    )
  })

  it('should reject task', async () => {
    const executor = createExecutor()
    const result = await executeWorkflowAction({
      taskId: 't-1',
      actorMemberId: 2,
      actorUsername: 'user2',
      actorName: 'User Two',
      actorPosition: 'Manager',
      actorRole: 'member',
      action: 'REJECT',
      comment: 'No'
    }, executor)

    expect(result.success).toBe(true)
    
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_tasks SET status = 'REJECTED'"),
      expect.arrayContaining(['t-1'])
    )
  })

  it('should send back task', async () => {
    const executor = createExecutor()
    const result = await executeWorkflowAction({
      taskId: 't-1',
      actorMemberId: 2,
      actorUsername: 'user2',
      actorName: 'User Two',
      actorPosition: 'Manager',
      actorRole: 'member',
      action: 'SEND_BACK',
      comment: 'Fix this'
    }, executor)

    expect(result.success).toBe(true)
    
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_tasks"),
      expect.arrayContaining(['t-1']) // SENT_BACK status
    )
  })

  it('should throw unauthorized if actor lacks permission', async () => {
    const executor = createExecutor()
    const result = await executeWorkflowAction({
      taskId: 't-1',
      actorMemberId: 99, // not assignee
      actorUsername: 'user99',
      actorName: 'User 99',
      actorPosition: 'Staff',
      actorRole: 'member',
      action: 'APPROVE',
    }, executor).catch(e => e)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toContain('ไม่มีสิทธิ์')
  })

  it('should handle MEDIA_REQUEST step approval and complete workflow', async () => {
    const mediaTask = {
      id: 'pr-1',
      task_no: 'PR-2570-10-0001',
      task_type: 'MEDIA_REQUEST',
      title: 'วิดีโอประชาสัมพันธ์',
      requester_id: 10,
      requester_name: 'Requester Name',
      requester_dept: 'งานเวชนิทัศน์',
      current_assignee: null,
      current_role: 'นักประชาสัมพันธ์',
      current_step_no: 1,
      status: 'PENDING',
    }
    const mediaSteps = [
      { id: 's-1', task_id: 'pr-1', step_no: 1, step_name: 'นักประชาสัมพันธ์ ตรวจสอบ', status: 'PENDING', assigned_role: 'นักประชาสัมพันธ์' },
      { id: 's-2', task_id: 'pr-1', step_no: 2, step_name: 'หัวหน้ากลุ่มงานดิจิทัลฯ', status: 'WAITING', assigned_role: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' },
    ]

    const executor = createExecutor([mediaTask], mediaSteps, {
      telegramLinks: [{ telegram_chat_id: '123456789' }],
    })

    const result = await executeWorkflowAction({
      taskId: 'pr-1',
      actorMemberId: 5,
      actorUsername: 'pr_officer',
      actorName: 'นายประชาสัมพันธ์',
      actorPosition: 'นักประชาสัมพันธ์',
      actorRole: 'member',
      action: 'APPROVE',
      comment: 'ตรวจสอบแล้ว ถูกต้อง',
    }, executor)

    expect(result.success).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inbox_tasks'),
      expect.arrayContaining([2, null, 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', 'pr-1'])
    )
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

    const executor = createExecutor([mediaTaskStep5], mediaSteps, {
      telegramLinks: [{ telegram_chat_id: '123456789' }],
    })

    const result = await executeWorkflowAction({
      taskId: 'pr-1',
      actorMemberId: 1,
      actorUsername: 'director',
      actorName: 'ผู้อำนวยการ',
      actorPosition: 'ผู้อำนวยการโรงพยาบาลเถิน',
      actorRole: 'member',
      action: 'APPROVE',
      comment: 'อนุมัติ',
    }, executor)

    expect(result.success).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inbox_tasks'),
      expect.arrayContaining([6, null, 'นักประชาสัมพันธ์', 'pr-1'])
    )

    // Verify Telegram service calls: should ONLY contain step approval notification, NOT the duplicate "มีงานจัดทำสื่อประชาสัมพันธ์" new job notification
    const telegramCalls = vi.mocked(telegramService.sendTelegramMessage).mock.calls
    const newJobMessages = telegramCalls.filter(([_, msg]) => msg.includes('มีงานจัดทำสื่อประชาสัมพันธ์'))
    expect(newJobMessages.length).toBe(0)
  })

  it('should not send duplicate Telegram broadcast when advancing MEDIA_REQUEST from Step 6 to Step 7', async () => {
    const mediaTaskStep6 = {
      id: 'pr-1',
      task_no: 'PR-2570-10-0001',
      task_type: 'MEDIA_REQUEST',
      title: 'โลโก้กระทรวงสาธารณสุข',
      requester_id: 10,
      requester_name: 'นาย ธนยศ กันทะมา',
      requester_dept: 'กลุ่มงานบริหารทั่วไป',
      current_assignee: null,
      current_role: 'นักประชาสัมพันธ์',
      current_step_no: 6,
      status: 'PENDING',
    }
    const mediaSteps = [
      { id: 's-6', task_id: 'pr-1', step_no: 6, step_name: 'นักประชาสัมพันธ์ ดำเนินการสั่งพิมพ์/ผลิตสื่อ', status: 'PENDING', assigned_role: 'นักประชาสัมพันธ์' },
      { id: 's-7', task_id: 'pr-1', step_no: 7, step_name: 'นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน', status: 'WAITING', assigned_role: 'นักประชาสัมพันธ์' },
    ]

    const executor = createExecutor([mediaTaskStep6], mediaSteps, {
      telegramLinks: [{ telegram_chat_id: '123456789' }],
    })

    const result = await executeWorkflowAction({
      taskId: 'pr-1',
      actorMemberId: 5,
      actorUsername: 'pr_staff',
      actorName: 'พรพิมล มีศรี',
      actorPosition: 'นักประชาสัมพันธ์',
      actorRole: 'member',
      action: 'APPROVE',
      comment: 'สั่งพิมพ์เรียบร้อย',
    }, executor)

    expect(result.success).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inbox_tasks'),
      expect.arrayContaining([7, null, 'นักประชาสัมพันธ์', 'pr-1'])
    )

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

    const executor = createExecutor([mediaTaskStep7], mediaSteps, {
      telegramLinks: [{ telegram_chat_id: '123456789' }],
    })

    const result = await executeWorkflowAction({
      taskId: 'pr-1',
      actorMemberId: 5,
      actorUsername: 'pr_staff',
      actorName: 'พรพิมล มีศรี',
      actorPosition: 'นักประชาสัมพันธ์',
      actorRole: 'member',
      action: 'APPROVE',
      comment: 'ส่งมอบงานเรียบร้อย',
    }, executor)

    expect(result.success).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_tasks SET status = 'APPROVED'"),
      expect.arrayContaining(['pr-1'])
    )

    const telegramCalls = vi.mocked(telegramService.sendTelegramMessage).mock.calls
    const finalMessages = telegramCalls.filter(([_, msg]) => msg.includes('คำขอสื่อประชาสัมพันธ์ผ่านการอนุมัติสมบูรณ์แล้ว'))
    expect(finalMessages.length).toBeGreaterThan(0)
    const newJobMessages = telegramCalls.filter(([_, msg]) => msg.includes('มีงานจัดทำสื่อประชาสัมพันธ์'))
    expect(newJobMessages.length).toBe(0)
  })

  it('should hold task with hold reason and details', async () => {
    const executor = createExecutor()
    const result = await executeWorkflowAction({
      taskId: 't-1',
      actorMemberId: 2,
      actorUsername: 'user2',
      actorName: 'User Two',
      actorPosition: 'Manager',
      actorRole: 'member',
      action: 'HOLD',
      holdReason: 'รอการจัดสรรงบ',
      holdDetails: 'รองบประมาณปี 2570 ไตรมาส 1',
    }, executor)

    expect(result.success).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_tasks SET status = 'ON_HOLD'"),
      expect.arrayContaining([
        expect.stringContaining('รอการจัดสรรงบ'),
        't-1',
      ])
    )
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("'HOLD_TASK'"),
      expect.arrayContaining(['t-1', 2, 'User Two'])
    )
  })

  it('should resume held task back to pending', async () => {
    const heldTask = {
      ...mockTask,
      status: 'ON_HOLD',
      custom_payload: JSON.stringify({
        holdReason: 'รอการจัดสรรงบ',
        holdDetails: 'รองบประมาณปี 2570',
      }),
    }
    const executor = createExecutor([heldTask])
    const result = await executeWorkflowAction({
      taskId: 't-1',
      actorMemberId: 2,
      actorUsername: 'user2',
      actorName: 'User Two',
      actorPosition: 'Manager',
      actorRole: 'member',
      action: 'RESUME',
      comment: 'งบประมาณได้รับการอนุมัติแล้ว ดำเนินการต่อ',
    }, executor)

    expect(result.success).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE inbox_tasks SET status = ?"),
      expect.arrayContaining(['PENDING', 't-1'])
    )
    expect(executor).toHaveBeenCalledWith(
      expect.stringContaining("'RESUME_TASK'"),
      expect.arrayContaining(['t-1', 2, 'User Two'])
    )
  })
})
