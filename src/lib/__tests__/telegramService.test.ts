import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyAndLinkTelegram } from '../telegramService'
import * as memberDb from '../memberDb'

vi.mock('../memberDb', () => ({
  queryMemberDb: vi.fn(),
}))

vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('telegramService - verifyAndLinkTelegram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails if token does not exist in telegram_link_challenges', async () => {
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])

    const result = await verifyAndLinkTelegram('invalid-token', 123456, 123456)
    expect(result.success).toBe(false)
    expect(result.error).toContain('ไม่ถูกต้อง')
  })

  it('fails if token has already been used', async () => {
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 1, member_id: 10, expires_at: new Date(Date.now() + 60000), used_at: new Date() },
    ])

    const result = await verifyAndLinkTelegram('used-token', 123456, 123456)
    expect(result.success).toBe(false)
    expect(result.error).toContain('ถูกใช้งานไปแล้ว')
  })

  it('fails if token has expired', async () => {
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 1, member_id: 10, expires_at: new Date(Date.now() - 60000), used_at: null },
    ])

    const result = await verifyAndLinkTelegram('expired-token', 123456, 123456)
    expect(result.success).toBe(false)
    expect(result.error).toContain('หมดอายุแล้ว')
  })

  it('succeeds with valid challenge token and links the account', async () => {
    const validExpiry = new Date(Date.now() + 600000)
    // 1. query token
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 1, member_id: 10, expires_at: validExpiry, used_at: null },
    ])
    // 2. query member info
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 10, name: 'นายแพทย์ทดสอบ', username: 'doctor_test' },
    ])
    // 3. upsert link
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 4. mark token used
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])

    const result = await verifyAndLinkTelegram(
      'valid-token',
      987654321,
      987654321,
      'test_telegram_user',
      'หมอทดสอบ'
    )

    expect(result.success).toBe(true)
    expect(result.memberName).toBe('นายแพทย์ทดสอบ')
    expect(memberDb.queryMemberDb).toHaveBeenCalledTimes(4)
  })
})

describe('telegramCore - processTelegramUpdate command dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 100 } }),
    })
  })

  it('handles /start without token as help message', async () => {
    const { processTelegramUpdate } = await import('../telegramService')
    const update = {
      update_id: 1,
      message: {
        chat: { id: 12345 },
        from: { id: 12345, username: 'testuser' },
        text: '/start',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('START_HELP')
  })

  it('handles /unlink command', async () => {
    const { processTelegramUpdate } = await import('../telegramService')
    vi.mocked(memberDb.queryMemberDb)
      .mockResolvedValueOnce([{ id: 10, name: 'พยาบาล ทดสอบ', username: 'nurse_test' }])
      .mockResolvedValueOnce([])

    const update = {
      update_id: 2,
      message: {
        chat: { id: 12345 },
        from: { id: 12345, username: 'testuser' },
        text: '/unlink',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('UNLINK_SUCCESS')
    expect(res.memberName).toBe('พยาบาล ทดสอบ')
  })

  it('ignores non-command text messages gracefully', async () => {
    const { processTelegramUpdate } = await import('../telegramService')
    const update = {
      update_id: 3,
      message: {
        chat: { id: 12345 },
        from: { id: 12345, username: 'testuser' },
        text: 'hello bot',
      },
    }
    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(false)
    expect(res.action).toBe('IGNORED')
  })

  it('handles callback_query accept_repair:<taskId> successfully', async () => {
    const { processTelegramUpdate } = await import('../telegramService')

    // 1. linked member query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 99, name: 'นายช่าง ทดสอบ', username: 'tech_test', role: 'member', position: 'ช่างเทคนิค' },
    ])
    // 2. task query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 'task-123', task_no: 'IT-6901-0001', task_type: 'IT_REPAIR', title: 'คอมพิวเตอร์เปิดไม่ติด', requester_id: 10, requester_name: 'ผู้ขอ ทดสอบ', requester_dept: 'OPD', status: 'PENDING' },
    ])
    // 3. update inbox_tasks
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 4. update repair_details
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 5. update inbox_task_steps
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 6. insert audit log
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 7. query requester telegram link
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { telegram_chat_id: 888888 },
    ])

    const update = {
      update_id: 4,
      callback_query: {
        id: 'cb-123',
        from: { id: 12345, username: 'tech_test' },
        message: {
          message_id: 555,
          chat: { id: 12345 },
          text: 'มีงานใหม่',
        },
        data: 'accept_repair:task-123',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('ACCEPT_REPAIR_SUCCESS')
    expect(res.memberName).toBe('นายช่าง ทดสอบ')
  })

  it('handles callback_query cancel_repair:<taskId> successfully', async () => {
    const { processTelegramUpdate } = await import('../telegramService')

    // 1. linked member query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 99, name: 'นายช่าง ทดสอบ', username: 'tech_test', role: 'member', position: 'ช่างเทคนิค' },
    ])
    // 2. task query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 'task-123', task_no: 'IT-6901-0001', task_type: 'IT_REPAIR', title: 'คอมพิวเตอร์เปิดไม่ติด', requester_id: 10, requester_name: 'ผู้ขอ ทดสอบ', requester_dept: 'OPD', status: 'PENDING' },
    ])
    // 3. update inbox_tasks (status = 'REJECTED')
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 4. update repair_details
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 5. update inbox_task_steps
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 6. insert audit log
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 7. query requester telegram link
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { telegram_chat_id: 888888 },
    ])

    const update = {
      update_id: 5,
      callback_query: {
        id: 'cb-456',
        from: { id: 12345, username: 'tech_test' },
        message: {
          message_id: 556,
          chat: { id: 12345 },
          text: 'มีงานใหม่',
        },
        data: 'cancel_repair:task-123',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('CANCEL_REPAIR_SUCCESS')
    expect(res.memberName).toBe('นายช่าง ทดสอบ')
  })

  it('handles callback_query complete_repair:<taskId> and enters pending note prompt state', async () => {
    const { processTelegramUpdate } = await import('../telegramService')

    // 1. linked member query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 99, name: 'นายช่าง ทดสอบ', username: 'tech_test', role: 'member', position: 'ช่างเทคนิค' },
    ])
    // 2. task query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 'task-777', task_no: 'IT-6901-0077', task_type: 'IT_REPAIR', title: 'จอดำเปิดไม่ติด', requester_id: 10, current_assignee: 99, status: 'IN_PROGRESS' },
    ])
    // 3. repair_details query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { task_id: 'task-777', repair_type: 'IT_REPAIR', assigned_technician_id: 99, location_full_name: 'ตึกอุบัติเหตุ ชั้น 1' },
    ])

    const update = {
      update_id: 6,
      callback_query: {
        id: 'cb-complete-777',
        from: { id: 99999, username: 'tech_test' },
        message: {
          message_id: 888,
          chat: { id: 12345 },
          text: 'งานกำลังดำเนินการ',
        },
        data: 'complete_repair:task-777',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('COMPLETE_REPAIR_PROMPT')
    expect(res.memberName).toBe('นายช่าง ทดสอบ')
  })

  it('handles technician typing repair completion notes via Telegram text message', async () => {
    const { processTelegramUpdate } = await import('../telegramService')

    // DB calls when typing note:
    // 1. task query in completeRepairTaskHelper
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 'task-777', task_no: 'IT-6901-0077', task_type: 'IT_REPAIR', title: 'จอดำเปิดไม่ติด', requester_id: 10, requester_name: 'พยาบาลสมหญิง', current_assignee: 99, status: 'IN_PROGRESS' },
    ])
    // 2. repair_details query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { task_id: 'task-777', repair_type: 'IT_REPAIR', assigned_technician_id: 99, location_full_name: 'ตึกอุบัติเหตุ ชั้น 1' },
    ])
    // 3. update repair_details
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 4. update inbox_tasks
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 5. update inbox_task_steps
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 6. insert audit log
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 7. query requester telegram link
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { telegram_chat_id: 888888 },
    ])

    const update = {
      update_id: 7,
      message: {
        message_id: 889,
        chat: { id: 12345 },
        from: { id: 99999, username: 'tech_test' },
        text: 'เปลี่ยนสาย DisplayPort และทำความสะอาดบอร์ด ใช้งานได้ปกติ',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('COMPLETE_REPAIR_SUCCESS')
    expect(res.memberName).toBe('นายช่าง ทดสอบ')
  })

  it('handles quick callback_query confirm_complete:<taskId> without typing notes', async () => {
    const { processTelegramUpdate } = await import('../telegramService')

    // 1. linked member query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 99, name: 'นายช่าง ทดสอบ', username: 'tech_test', role: 'member', position: 'ช่างเทคนิค' },
    ])
    // 2. task query in completeRepairTaskHelper
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { id: 'task-888', task_no: 'IT-6901-0088', task_type: 'IT_REPAIR', title: 'เมาส์คลิกไม่ไป', requester_id: 10, requester_name: 'ผู้ขอ ทดสอบ', requester_dept: 'OPD', status: 'IN_PROGRESS' },
    ])
    // 3. repair_details query
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { task_id: 'task-888', repair_type: 'IT_REPAIR', assigned_technician_id: 99, location_full_name: 'OPD' },
    ])
    // 4. update repair_details
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 5. update inbox_tasks
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 6. update inbox_task_steps
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 7. insert audit log
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([])
    // 8. query requester telegram link
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([
      { telegram_chat_id: 888888 },
    ])

    const update = {
      update_id: 8,
      callback_query: {
        id: 'cb-confirm-888',
        from: { id: 12345, username: 'tech_test' },
        message: {
          message_id: 999,
          chat: { id: 12345 },
          text: 'งานกำลังดำเนินการ',
        },
        data: 'confirm_complete:task-888',
      },
    }

    const res = await processTelegramUpdate(update)
    expect(res.handled).toBe(true)
    expect(res.action).toBe('COMPLETE_REPAIR_SUCCESS')
    expect(res.memberName).toBe('นายช่าง ทดสอบ')
  })
})

