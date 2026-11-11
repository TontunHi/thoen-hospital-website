import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import * as memberAuth from '@/lib/memberAuth'

describe('POST /api/member/session/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MEMBER_SESSION_SECRET = 'test-secret-key-12345678901234567890'
  })

  it('returns 401 when there is no active session', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error).toContain('เซสชันหมดอายุหรือไม่ได้เข้าสู่ระบบ')
  })

  it('successfully renews token and sets cookie when valid session exists', async () => {
    const mockSession = {
      username: '1234567890123',
      email: 'staff@thoenhospital.com',
      role: 'member',
      aud: 'member' as const,
      iat: Date.now() - 15 * 60 * 1000, // issued 15 mins ago
      exp: Date.now() + 15 * 60 * 1000,
    }

    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(mockSession)

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.remainingSeconds).toBe(1800)
    expect(json.message).toContain('ต่ออายุเซสชันเรียบร้อยแล้ว')

    // Verify Set-Cookie header is attached
    const setCookie = res.cookies.get(memberAuth.COOKIE_NAME)
    expect(setCookie).toBeDefined()
    expect(setCookie?.value).toBeTruthy()
    expect(setCookie?.maxAge).toBe(1800)
  })

  it('rejects renewal with 401 when exceeding absolute 12-hour limit', async () => {
    const over12HoursAgo = Date.now() - (12 * 3600 + 120) * 1000
    const mockSession = {
      username: '1234567890123',
      email: 'staff@thoenhospital.com',
      role: 'member',
      aud: 'member' as const,
      iat: over12HoursAgo,
      exp: Date.now() + 5 * 60 * 1000,
    }

    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(mockSession)

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.code).toBe('ABSOLUTE_LIMIT_EXCEEDED')
    expect(json.error).toContain('12 ชั่วโมง')
  })
})
