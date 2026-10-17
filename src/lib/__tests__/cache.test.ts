import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCachedData,
  getSwrCachedData,
  invalidateCacheKey,
  invalidateCachePattern,
  clearMemoryCache,
} from '../cache'

describe('In-Memory Stale-While-Revalidate (SWR) Cache Engine', () => {
  beforeEach(() => {
    vi.useRealTimers()
    clearMemoryCache()
  })

  it('should return fresh data on first fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'ok', value: 123 })
    const result = await getSwrCachedData('test-swr-1', fetcher, { staleTtlMs: 5000 })

    expect(result).toEqual({ status: 'ok', value: 123 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('should deduplicate simultaneous in-flight requests (single-flight)', async () => {
    let callCount = 0
    const slowFetcher = vi.fn().mockImplementation(async () => {
      callCount++
      await new Promise((r) => setTimeout(r, 30))
      return `flight-result-${callCount}`
    })

    const key = `test-flight-${Date.now()}`
    const [res1, res2, res3] = await Promise.all([
      getSwrCachedData(key, slowFetcher, { staleTtlMs: 5000 }),
      getSwrCachedData(key, slowFetcher, { staleTtlMs: 5000 }),
      getSwrCachedData(key, slowFetcher, { staleTtlMs: 5000 }),
    ])

    expect(res1).toBe('flight-result-1')
    expect(res2).toBe('flight-result-1')
    expect(res3).toBe('flight-result-1')
    expect(slowFetcher).toHaveBeenCalledTimes(1)
  })

  it('should return stale data immediately and revalidate in background when in stale window', async () => {
    let callCount = 0
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount++
      return `version-${callCount}`
    })

    const key = `test-swr-bg-${Date.now()}`
    // staleTtlMs: 20ms, maxTtlMs: 100ms
    const res1 = await getSwrCachedData(key, fetcher, { staleTtlMs: 20, maxTtlMs: 100 })
    expect(res1).toBe('version-1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Wait 30ms so it is past staleTtlMs (20ms) but before maxTtlMs (100ms)
    await new Promise((r) => setTimeout(r, 30))

    // Second call should return stale data (version-1) immediately, but trigger background fetch
    const res2 = await getSwrCachedData(key, fetcher, { staleTtlMs: 20, maxTtlMs: 100 })
    expect(res2).toBe('version-1')

    // Wait 20ms for background revalidation to settle
    await new Promise((r) => setTimeout(r, 20))
    expect(fetcher).toHaveBeenCalledTimes(2)

    // Subsequent call should now have the fresh version-2
    const res3 = await getSwrCachedData(key, fetcher, { staleTtlMs: 20, maxTtlMs: 100 })
    expect(res3).toBe('version-2')
  })

  it('should invalidate cache key directly', async () => {
    const fetcher = vi.fn().mockResolvedValue('value-a')
    const key = 'key-to-invalidate'

    await getSwrCachedData(key, fetcher, { staleTtlMs: 10000 })
    expect(fetcher).toHaveBeenCalledTimes(1)

    invalidateCacheKey(key)

    fetcher.mockResolvedValueOnce('value-b')
    const res2 = await getSwrCachedData(key, fetcher, { staleTtlMs: 10000 })
    expect(res2).toBe('value-b')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('should invalidate cache keys matching pattern', async () => {
    const fetcher = vi.fn().mockResolvedValue('val')
    await getSwrCachedData('asset:room:1', fetcher, { staleTtlMs: 10000 })
    await getSwrCachedData('asset:room:2', fetcher, { staleTtlMs: 10000 })
    await getSwrCachedData('user:profile:1', fetcher, { staleTtlMs: 10000 })

    invalidateCachePattern('asset:')

    fetcher.mockClear()
    await getSwrCachedData('user:profile:1', fetcher, { staleTtlMs: 10000 })
    expect(fetcher).toHaveBeenCalledTimes(0) // Still cached

    await getSwrCachedData('asset:room:1', fetcher, { staleTtlMs: 10000 })
    expect(fetcher).toHaveBeenCalledTimes(1) // Re-fetched
  })

  it('should maintain 100% backward compatibility with getCachedData', async () => {
    let counter = 0
    const fetcher = vi.fn().mockImplementation(async () => {
      counter++
      return `legacy-${counter}`
    })
    const key = `test-legacy-${Date.now()}`

    const res1 = await getCachedData(key, fetcher, 20)
    expect(res1).toBe('legacy-1')

    const res2 = await getCachedData(key, fetcher, 20)
    expect(res2).toBe('legacy-1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    await new Promise((r) => setTimeout(r, 30))
    const res3 = await getCachedData(key, fetcher, 20)
    expect(res3).toBe('legacy-2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
