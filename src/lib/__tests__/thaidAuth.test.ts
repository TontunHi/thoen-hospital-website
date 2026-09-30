import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getThaidConfig,
  generateOAuthState,
  buildThaidAuthorizeUrl,
  exchangeThaidAuthorizationCode,
} from '../thaidAuth'

describe('ThaID Auth Utility', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns null when ThaID env variables are missing', () => {
    delete process.env.THAID_CLIENT_ID
    delete process.env.THAID_CLIENT_SECRET
    expect(getThaidConfig()).toBeNull()
  })

  it('returns valid config when env variables are provided', () => {
    process.env.THAID_CLIENT_ID = 'test-client-id'
    process.env.THAID_CLIENT_SECRET = 'test-secret'
    process.env.THAID_REDIRECT_URI = 'https://thoenhospital.moph.go.th/api/auth/thaid/callback'

    const config = getThaidConfig()
    expect(config).not.toBeNull()
    expect(config?.clientId).toBe('test-client-id')
    expect(config?.clientSecret).toBe('test-secret')
    expect(config?.redirectUri).toBe('https://thoenhospital.moph.go.th/api/auth/thaid/callback')
  })

  it('generates a random hex state of at least 32 characters', () => {
    const state1 = generateOAuthState()
    const state2 = generateOAuthState()
    expect(typeof state1).toBe('string')
    expect(state1.length).toBeGreaterThanOrEqual(32)
    expect(state1).not.toBe(state2)
  })

  it('builds a proper ThaID authorization URL with query params', () => {
    const config = {
      clientId: 'sample_id',
      clientSecret: 'sample_secret',
      redirectUri: 'https://example.com/callback',
      authUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
      tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    }

    const state = 'custom_state_123'
    const urlStr = buildThaidAuthorizeUrl(state, config)
    const parsed = new URL(urlStr)

    expect(parsed.origin).toBe('https://imauth.bora.dopa.go.th')
    expect(parsed.pathname).toBe('/api/v2/oauth2/auth/')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('sample_id')
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback')
    expect(parsed.searchParams.get('scope')).toBe('openid pid')
    expect(parsed.searchParams.get('state')).toBe('custom_state_123')
  })

  it('exchanges authorization code and extracts citizen ID (pid)', async () => {
    const config = {
      clientId: 'client123',
      clientSecret: 'secret123',
      redirectUri: 'https://example.com/callback',
      authUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
      tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    }

    // Mock fetch for token exchange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'dummy_token',
        pid: '1234567890123',
        given_name: 'สมชาย',
        family_name: 'ใจดี',
      }),
    } as any)

    const userInfo = await exchangeThaidAuthorizationCode('auth_code_xyz', config)
    expect(userInfo).not.toBeNull()
    expect(userInfo?.pid).toBe('1234567890123')
    expect(userInfo?.firstName).toBe('สมชาย')
    expect(userInfo?.lastName).toBe('ใจดี')
  })

  it('handles token exchange failure gracefully', async () => {
    const config = {
      clientId: 'client123',
      clientSecret: 'secret123',
      redirectUri: 'https://example.com/callback',
      authUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
      tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    } as any)

    const userInfo = await exchangeThaidAuthorizationCode('bad_code', config)
    expect(userInfo).toBeNull()
  })
})
