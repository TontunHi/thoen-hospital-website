import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, buildSecurityHeaders } from '@/lib/securityHeaders'

describe('securityHeaders', () => {
  it('strips unsafe-eval from script-src in production CSP', () => {
    const csp = buildContentSecurityPolicy(false)

    expect(csp).toContain("script-src 'self' 'unsafe-inline' blob:")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('retains unsafe-eval in development CSP for React debugging', () => {
    const csp = buildContentSecurityPolicy(true)

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:")
  })

  it('includes all baseline hospital security headers', () => {
    const headers = buildSecurityHeaders(false)
    const keys = headers.map((h) => h.key)

    expect(keys).toEqual([
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Content-Security-Policy',
      'Permissions-Policy',
      'X-DNS-Prefetch-Control',
    ])

    const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy')
    expect(cspHeader?.value).not.toContain("'unsafe-eval'")
    expect(cspHeader?.value).toContain("object-src 'none'")
    expect(cspHeader?.value).toContain("connect-src 'self' ws: wss:")
  })
})
