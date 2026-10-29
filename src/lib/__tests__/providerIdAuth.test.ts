import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getProviderIdConfig,
  generateProviderIdOAuthState,
  verifyProviderIdOAuthState,
  buildProviderIdAuthorizeUrl,
  exchangeHealthIdCode,
  exchangeProviderIdToken,
  getProviderIdProfile,
  authenticateWithProviderId,
  NotAProviderError,
  type ProviderIdConfig,
} from '../providerIdAuth'

describe('providerIdAuth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.PROVIDER_ID_ENV = 'PRD'
    process.env.HEALTH_ID_CLIENT_ID = 'health-prd-client-id'
    process.env.HEALTH_ID_CLIENT_SECRET = 'health-prd-client-secret'
    process.env.PROVIDER_ID_CLIENT_ID = 'provider-prd-client-id'
    process.env.PROVIDER_ID_SECRET_KEY = 'provider-prd-secret-key'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://thlp.moph.go.th'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('getProviderIdConfig', () => {
    it('returns PRD configuration by default', () => {
      const config = getProviderIdConfig()
      expect(config).not.toBeNull()
      expect(config?.env).toBe('PRD')
      expect(config?.healthIdBaseUrl).toBe('https://moph.id.th')
      expect(config?.providerIdBaseUrl).toBe('https://provider.id.th')
      expect(config?.healthIdClientId).toBe('health-prd-client-id')
      expect(config?.providerIdClientId).toBe('provider-prd-client-id')
      expect(config?.redirectUri).toBe('https://thlp.moph.go.th/api/auth/provider-id/callback')
    })

    it('returns UAT configuration when PROVIDER_ID_ENV is UAT', () => {
      process.env.PROVIDER_ID_ENV = 'UAT'
      process.env.HEALTH_ID_UAT_CLIENT_ID = 'health-uat-id'
      process.env.HEALTH_ID_UAT_CLIENT_SECRET = 'health-uat-secret'
      process.env.PROVIDER_ID_UAT_CLIENT_ID = 'provider-uat-id'
      process.env.PROVIDER_ID_UAT_SECRET_KEY = 'provider-uat-secret'

      const config = getProviderIdConfig()
      expect(config).not.toBeNull()
      expect(config?.env).toBe('UAT')
      expect(config?.healthIdBaseUrl).toBe('https://uat-moph.id.th')
      expect(config?.providerIdBaseUrl).toBe('https://uat-provider.id.th')
      expect(config?.healthIdClientId).toBe('health-uat-id')
      expect(config?.providerIdClientId).toBe('provider-uat-id')
    })

    it('returns null if required credentials are missing', () => {
      delete process.env.HEALTH_ID_CLIENT_ID
      expect(getProviderIdConfig()).toBeNull()
    })
  })

  describe('OAuth State generation & verification', () => {
    it('generates a valid state and successfully verifies it', () => {
      const state = generateProviderIdOAuthState('my-test-secret')
      expect(state.startsWith('pid_')).toBe(true)
      const isValid = verifyProviderIdOAuthState(state, 'my-test-secret')
      expect(isValid).toBe(true)
    })

    it('rejects tampered state or wrong secret', () => {
      const state = generateProviderIdOAuthState('secret-A')
      expect(verifyProviderIdOAuthState(state, 'secret-B')).toBe(false)
      expect(verifyProviderIdOAuthState(state + 'tampered', 'secret-A')).toBe(false)
    })

    it('rejects malformed or empty state', () => {
      expect(verifyProviderIdOAuthState('', 'secret')).toBe(false)
      expect(verifyProviderIdOAuthState('invalid.state', 'secret')).toBe(false)
      expect(verifyProviderIdOAuthState('not_pid_123.nonce.hmac', 'secret')).toBe(false)
    })

    it('rejects expired state', () => {
      const expiredTimestamp = Date.now() - 20 * 60 * 1000 // 20 mins ago
      const crypto = require('crypto')
      const payload = `pid_${expiredTimestamp}.dummyNonce`
      const hmac = crypto.createHmac('sha256', 'test-secret').update(payload).digest('base64url')
      const state = `${payload}.${hmac}`

      expect(verifyProviderIdOAuthState(state, 'test-secret', 15 * 60 * 1000)).toBe(false)
    })
  })

  describe('buildProviderIdAuthorizeUrl', () => {
    it('constructs correct Health ID OAuth redirect URL with parameters', () => {
      const config = getProviderIdConfig()!
      const url = buildProviderIdAuthorizeUrl('test-state-123', config)
      const parsed = new URL(url)

      expect(parsed.origin).toBe('https://moph.id.th')
      expect(parsed.pathname).toBe('/oauth/redirect')
      expect(parsed.searchParams.get('client_id')).toBe('health-prd-client-id')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('state')).toBe('test-state-123')
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://thlp.moph.go.th/api/auth/provider-id/callback')
    })
  })

  describe('Token exchange steps', () => {
    const mockConfig: ProviderIdConfig = {
      env: 'PRD',
      healthIdBaseUrl: 'https://moph.id.th',
      providerIdBaseUrl: 'https://provider.id.th',
      healthIdClientId: 'hid-client',
      healthIdClientSecret: 'hid-secret',
      providerIdClientId: 'pid-client',
      providerIdSecretKey: 'pid-secret',
      redirectUri: 'https://thlp.moph.go.th/api/auth/provider-id/callback',
    }

    it('exchangeHealthIdCode returns access_token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          data: { access_token: 'health-id-mock-access-token' },
        }),
      } as any)

      const token = await exchangeHealthIdCode('auth-code-123', mockConfig)
      expect(token).toBe('health-id-mock-access-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://moph.id.th/api/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        })
      )
    })

    it('exchangeProviderIdToken returns provider access_token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          data: { access_token: 'provider-id-mock-access-token' },
        }),
      } as any)

      const token = await exchangeProviderIdToken('health-id-token', mockConfig)
      expect(token).toBe('provider-id-mock-access-token')
    })

    it('exchangeProviderIdToken throws NotAProviderError on status 400', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          status: 400,
          message: 'This user has not provider id',
        }),
      } as any)

      await expect(exchangeProviderIdToken('health-token', mockConfig)).rejects.toThrow(NotAProviderError)
    })

    it('getProviderIdProfile returns profile with hash_cid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          data: {
            account_id: 'acc123',
            hash_cid: '7a5635c12063210ec4cb9ea689709541a0d474890e38813e78c566e09f8f6aa7',
            provider_id: '0111111111X21',
            name_th: 'หมอพร้อม สงบสุข',
          },
        }),
      } as any)

      const profile = await getProviderIdProfile('provider-access-token', mockConfig)
      expect(profile.account_id).toBe('acc123')
      expect(profile.hash_cid).toBe('7a5635c12063210ec4cb9ea689709541a0d474890e38813e78c566e09f8f6aa7')
      expect(profile.name_th).toBe('หมอพร้อม สงบสุข')
    })

    it('authenticateWithProviderId runs end-to-end pipeline', async () => {
      global.fetch = vi.fn()
        // 1. Health ID Token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { access_token: 'token-step-1' } }),
        } as any)
        // 2. Provider ID Token
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { access_token: 'token-step-2' } }),
        } as any)
        // 3. Provider ID Profile
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              account_id: 'acc-e2e',
              hash_cid: 'mock-hash-cid',
              provider_id: 'pid-e2e',
              name_th: 'ทดสอบ ผู้ให้บริการ',
            },
          }),
        } as any)

      const profile = await authenticateWithProviderId('full-flow-code', mockConfig)
      expect(profile.hash_cid).toBe('mock-hash-cid')
      expect(profile.provider_id).toBe('pid-e2e')
    })
  })
})
