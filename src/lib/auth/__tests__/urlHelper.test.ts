import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAllowedHost, getSafeBaseUrl } from '../urlHelper'

describe('urlHelper - Host Header Injection & Open Redirect Defense', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.ALLOWED_HOSTS
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isAllowedHost', () => {
    it('allows official hospital and MOPH domains', () => {
      expect(isAllowedHost('thlp.moph.go.th')).toBe(true)
      expect(isAllowedHost('sub.thlp.moph.go.th')).toBe(true)
      expect(isAllowedHost('thoenhospital.com')).toBe(true)
      expect(isAllowedHost('portal.thoenhospital.com')).toBe(true)
      expect(isAllowedHost('ict.moph.go.th')).toBe(true)
    })

    it('allows dev localhost and 127.0.0.1 with ports', () => {
      expect(isAllowedHost('localhost')).toBe(true)
      expect(isAllowedHost('localhost:3000')).toBe(true)
      expect(isAllowedHost('localhost:6060')).toBe(true)
      expect(isAllowedHost('127.0.0.1')).toBe(true)
      expect(isAllowedHost('127.0.0.1:3000')).toBe(true)
    })

    it('rejects malicious external domains and IP addresses', () => {
      expect(isAllowedHost('evil.com')).toBe(false)
      expect(isAllowedHost('attacker.org')).toBe(false)
      expect(isAllowedHost('thlp.moph.go.th.evil.com')).toBe(false)
      expect(isAllowedHost('198.51.100.1')).toBe(false)
      expect(isAllowedHost('')).toBe(false)
    })

    it('supports custom ALLOWED_HOSTS env variable', () => {
      process.env.ALLOWED_HOSTS = 'staging.example.com,test.local:8080'
      expect(isAllowedHost('staging.example.com')).toBe(true)
      expect(isAllowedHost('test.local:8080')).toBe(true)
      expect(isAllowedHost('other.example.com')).toBe(false)
    })
  })

  describe('getSafeBaseUrl', () => {
    it('prioritizes valid NEXT_PUBLIC_SITE_URL if configured', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.thoenhospital.com/'
      const req = new Request('http://localhost:3000/callback', {
        headers: { host: 'localhost:3000' }
      })
      expect(getSafeBaseUrl(req)).toBe('https://custom.thoenhospital.com')
    })

    it('uses incoming trusted host header when allowed', () => {
      const req = new Request('http://thlp.moph.go.th/callback', {
        headers: {
          host: 'thlp.moph.go.th',
          'x-forwarded-proto': 'https'
        }
      })
      expect(getSafeBaseUrl(req)).toBe('https://thlp.moph.go.th')
    })

    it('blocks Host Header Injection and falls back to safe origin', () => {
      const req = new Request('http://evil.com/callback', {
        headers: {
          host: 'evil.com',
          'x-forwarded-host': 'attacker.com',
          'x-forwarded-proto': 'https'
        }
      })
      // Should not contain evil.com or attacker.com
      const safeUrl = getSafeBaseUrl(req)
      expect(safeUrl).not.toContain('evil.com')
      expect(safeUrl).not.toContain('attacker.com')
      expect(safeUrl).toBe('http://localhost:3000')
    })

    it('falls back to https://thlp.moph.go.th in production if host is attacker', () => {
      ;(process.env as any).NODE_ENV = 'production'
      const req = new Request('http://evil.com/callback', {
        headers: { host: 'evil.com' }
      })
      expect(getSafeBaseUrl(req)).toBe('https://thlp.moph.go.th')
    })
  })
})
