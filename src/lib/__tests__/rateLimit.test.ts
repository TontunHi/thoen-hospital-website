import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Map([
      ['x-forwarded-for', '192.168.1.100'],
      ['user-agent', 'Vitest-Agent'],
    ])
  ),
}))

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows requests within limit', async () => {
    const { checkRateLimit } = await import('../rateLimit')
    const key = `test-limit-${Date.now()}`

    const res1 = await checkRateLimit({ key, maxAttempts: 3, windowSeconds: 60 })
    expect(res1.allowed).toBe(true)
    expect(res1.remaining).toBe(2)

    const res2 = await checkRateLimit({ key, maxAttempts: 3, windowSeconds: 60 })
    expect(res2.allowed).toBe(true)
    expect(res2.remaining).toBe(1)
  })

  it('blocks requests exceeding limit and returns 429 response', async () => {
    const { checkRateLimit } = await import('../rateLimit')
    const key = `test-block-${Date.now()}`

    await checkRateLimit({ key, maxAttempts: 2, windowSeconds: 60 })
    await checkRateLimit({ key, maxAttempts: 2, windowSeconds: 60 })
    const res3 = await checkRateLimit({ key, maxAttempts: 2, windowSeconds: 60 })

    expect(res3.allowed).toBe(false)
    expect(res3.remaining).toBe(0)
    expect(res3.response).toBeDefined()
    expect(res3.response?.status).toBe(429)
  })

  it('bypasses rate limit in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { checkRateLimit } = await import('../rateLimit')
    const key = `test-dev-${Date.now()}`

    const res = await checkRateLimit({ key, maxAttempts: 1, windowSeconds: 60 })
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(1)
  })
})
