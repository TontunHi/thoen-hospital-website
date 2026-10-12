import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as thaidCallbackHandler } from '../callback/route'
import { generateOAuthState } from '@/lib/thaidAuth'

const { mockCookieStore, mockExchangeThaidCode } = vi.hoisted(() => ({
  mockCookieStore: {
    get: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
  },
  mockExchangeThaidCode: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/memberAuth', () => ({
  createMemberSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth/MemberAuthService', () => {
  return {
    MemberAuthService: class {
      exchangeThaidCode = mockExchangeThaidCode
    },
  }
})

vi.mock('@/lib/thaidAuth', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    getThaidConfig: vi.fn(() => ({
      clientId: 'test-client',
      clientSecret: 'test-secret-1234567890',
      redirectUri: 'https://test/callback',
      authUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
      tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    })),
  }
})

describe('ThaID Callback Route Handler', () => {
  const secret = 'test-secret-1234567890'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to thaid_denied when error is returned in search params', async () => {
    const req = new Request('http://localhost:3000/api/auth/thaid/callback?error=access_denied')
    const res = await thaidCallbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=thaid_denied')
  })

  it('redirects to thaid_invalid_request when code or state is missing', async () => {
    const req = new Request('http://localhost:3000/api/auth/thaid/callback')
    const res = await thaidCallbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=thaid_invalid_request')
  })

  it('redirects to thaid_invalid_state when both cookie and HMAC verification fail', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'different_state' })

    const req = new Request('http://localhost:3000/api/auth/thaid/callback?code=abc&state=bad_state')
    const res = await thaidCallbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=thaid_invalid_state')
  })

  it('succeeds when cookie matches the state parameter', async () => {
    const state = generateOAuthState(secret)
    mockCookieStore.get.mockReturnValue({ value: state })
    mockExchangeThaidCode.mockResolvedValue({
      username: '1234567890123',
      email: 'test@example.com',
      role: 'member',
    })

    const req = new Request(`http://localhost:3000/api/auth/thaid/callback?code=valid_code_1&state=${state}`)
    const res = await thaidCallbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/member')
    expect(mockCookieStore.delete).toHaveBeenCalledWith('thaid_oauth_state')
    expect(mockExchangeThaidCode).toHaveBeenCalledWith('valid_code_1', state)
  })

  it('succeeds even if cookie was dropped by browser (Safari ITP fallback via HMAC signature)', async () => {
    // Cookie is missing (!savedState)
    mockCookieStore.get.mockReturnValue(undefined)

    const state = generateOAuthState(secret)
    mockExchangeThaidCode.mockResolvedValue({
      username: '1234567890123',
      email: 'safari@example.com',
      role: 'member',
    })

    const req = new Request(`http://localhost:3000/api/auth/thaid/callback?code=safari_code_2&state=${state}`)
    const res = await thaidCallbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/member')
    expect(mockExchangeThaidCode).toHaveBeenCalledWith('safari_code_2', state)
  })

  it('deduplicates concurrent requests with the same authorization code to prevent race conditions', async () => {
    const state = generateOAuthState(secret)
    mockCookieStore.get.mockReturnValue({ value: state })

    // Simulate delay in exchange to test race condition
    mockExchangeThaidCode.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return {
        username: '1234567890123',
        email: 'race@example.com',
        role: 'member',
      }
    })

    const req1 = new Request(`http://localhost:3000/api/auth/thaid/callback?code=same_code_xyz&state=${state}`)
    const req2 = new Request(`http://localhost:3000/api/auth/thaid/callback?code=same_code_xyz&state=${state}`)

    // Run both requests concurrently
    const [res1, res2] = await Promise.all([
      thaidCallbackHandler(req1),
      thaidCallbackHandler(req2),
    ])

    expect(res1.status).toBe(307)
    expect(res2.status).toBe(307)
    expect(res1.headers.get('location')).toBe('http://localhost:3000/member')
    expect(res2.headers.get('location')).toBe('http://localhost:3000/member')
    // Crucial check: Exchange is called only ONCE for both requests!
    expect(mockExchangeThaidCode).toHaveBeenCalledTimes(1)
  })
})
