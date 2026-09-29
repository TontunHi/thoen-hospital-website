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
})

