import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as callbackHandler } from '../callback/route'
import {
  generateProviderIdOAuthState,
  generateHealthIdOAuthState,
  NotAProviderError,
} from '@/lib/providerIdAuth'

const { mockCookieStore, mockExchangeProviderIdCode, mockExchangeHealthIdCode } = vi.hoisted(() => ({
  mockCookieStore: {
    get: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
  },
  mockExchangeProviderIdCode: vi.fn(),
  mockExchangeHealthIdCode: vi.fn(),
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
      exchangeProviderIdCode = mockExchangeProviderIdCode
      exchangeHealthIdCode = mockExchangeHealthIdCode
    },
  }
})

vi.mock('@/lib/providerIdAuth', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    getProviderIdConfig: vi.fn(() => ({
      env: 'PRD',
      healthIdBaseUrl: 'https://moph.id.th',
      providerIdBaseUrl: 'https://provider.id.th',
      healthIdClientId: 'test-h-client',
      healthIdClientSecret: 'test-h-secret',
      providerIdClientId: 'test-p-client',
      providerIdSecretKey: 'test-p-secret-at-least-32-chars-long',
      redirectUri: 'https://thlp.moph.go.th/api/auth/provider-id/callback',
    })),
  }
})

describe('Provider ID & Health ID Callback Route Handler', () => {
  const secret = 'test-p-secret-at-least-32-chars-long'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to provider_id_denied when error is returned in search params', async () => {
    const req = new Request('http://localhost:3000/api/auth/provider-id/callback?error=access_denied')
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=provider_id_denied')
  })

  it('redirects to provider_id_invalid_request when code or state is missing', async () => {
    const req = new Request('http://localhost:3000/api/auth/provider-id/callback?code=some-code')
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=provider_id_invalid_request')
  })

  it('redirects to provider_id_invalid_state when state verification fails', async () => {
    mockCookieStore.get.mockReturnValue(undefined) // No cookie

    const req = new Request('http://localhost:3000/api/auth/provider-id/callback?code=test-code&state=invalid-state')
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=provider_id_invalid_state')
  })

  it('redirects to provider_id_not_provider when user is not a provider', async () => {
    const validState = generateProviderIdOAuthState(secret)
    mockCookieStore.get.mockReturnValue({ value: validState })
    mockExchangeProviderIdCode.mockRejectedValue(new NotAProviderError())

    const req = new Request(`http://localhost:3000/api/auth/provider-id/callback?code=test-code&state=${validState}`)
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=provider_id_not_provider')
  })

  it('redirects to not_registered when user has no matching member record', async () => {
    const validState = generateProviderIdOAuthState(secret)
    mockCookieStore.get.mockReturnValue({ value: validState })
    mockExchangeProviderIdCode.mockRejectedValue(
      new Error('Provider ID citizen ID not registered in hospital members')
    )

    const req = new Request(`http://localhost:3000/api/auth/provider-id/callback?code=test-code&state=${validState}`)
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member/login?error=not_registered')
  })

  it('successfully logs in via Provider ID and redirects to /member', async () => {
    const validState = generateProviderIdOAuthState(secret)
    mockCookieStore.get.mockReturnValue({ value: validState })
    mockExchangeProviderIdCode.mockResolvedValue({
      username: '3520100123456',
      email: 'doctor@thoen.moph.go.th',
      role: 'doctor',
    })

    const req = new Request(`http://localhost:3000/api/auth/provider-id/callback?code=valid-code&state=${validState}`)
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member')
    expect(mockCookieStore.delete).toHaveBeenCalledWith('provider_id_oauth_state')
  })

  it('successfully logs in via Health ID and redirects to /member', async () => {
    const validHealthState = generateHealthIdOAuthState(secret)
    mockCookieStore.get.mockReturnValue({ value: validHealthState })
    mockExchangeHealthIdCode.mockResolvedValue({
      username: '3520100123456',
      email: 'nurse@thoen.moph.go.th',
      role: 'nurse',
    })

    const req = new Request(`http://localhost:3000/api/auth/provider-id/callback?code=valid-code&state=${validHealthState}`)
    const res = await callbackHandler(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/member')
    expect(mockExchangeHealthIdCode).toHaveBeenCalledWith('valid-code', validHealthState)
  })
})
