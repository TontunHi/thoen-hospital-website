import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCachedData } from '../cache'

describe('In-Memory Short-Lived TTL Cache', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('should return fresh data on first fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'ok', value: 123 })
    const result = await getCachedData('test-key-1', fetcher, 5000)

    expect(result).toEqual({ status: 'ok', value: 123 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('should return cached data on subsequent calls within TTL without calling fetcher again', async () => {
    const fetcher = vi.fn().mockResolvedValue('first-call')
    const key = `test-key-${Date.now()}`

    const res1 = await getCachedData(key, fetcher, 5000)
    const res2 = await getCachedData(key, fetcher, 5000)

    expect(res1).toBe('first-call')
    expect(res2).toBe('first-call')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('should call fetcher again after TTL expires', async () => {
    let counter = 0
    const fetcher = vi.fn().mockImplementation(async () => {
      counter++
      return `data-${counter}`
    })
    const key = `test-ttl-${Date.now()}`

    // 10ms TTL
    const res1 = await getCachedData(key, fetcher, 10)
    expect(res1).toBe('data-1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Wait 25ms for TTL to expire
    await new Promise((r) => setTimeout(r, 25))

    const res2 = await getCachedData(key, fetcher, 10)
    expect(res2).toBe('data-2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
