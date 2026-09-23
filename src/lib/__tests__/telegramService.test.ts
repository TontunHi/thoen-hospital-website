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
