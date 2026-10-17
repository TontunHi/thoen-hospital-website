/**
 * In-Memory Stale-While-Revalidate (SWR) TTL Cache
 * Designed for caching read-only queries (HOSxP / ER / Lab / CMS / Assets)
 * Protects database health against rapid concurrent polling with single-flight deduplication.
 */

export interface SwrCacheOptions {
  /** Time-to-live before data is considered stale (in milliseconds). Default: 10,000ms (10s) */
  staleTtlMs?: number
  /** Maximum time-to-live before data is considered expired and MUST be fetched synchronously (in milliseconds). Default: 60,000ms (1m) */
  maxTtlMs?: number
}

interface CacheEntry<T> {
  data: T
  staleAt: number
  expiresAt: number
  lastAccessedAt: number
}

const MAX_CACHE_ENTRIES = 500
const memoryCache = new Map<string, CacheEntry<any>>()
const inFlightRequests = new Map<string, Promise<any>>()

/**
 * Evicts least-recently-used or expired entries when capacity is reached.
 */
function evictIfNeeded(now: number): void {
  if (memoryCache.size < MAX_CACHE_ENTRIES) return

  // 1. Remove expired entries first
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt <= now) {
      memoryCache.delete(k)
    }
  }

  // 2. If still over limit, evict LRU entries
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null
    let oldestAccess = Infinity

    for (const [k, v] of memoryCache.entries()) {
      if (v.lastAccessedAt < oldestAccess) {
        oldestAccess = v.lastAccessedAt
        oldestKey = k
      }
    }

    if (oldestKey) {
      memoryCache.delete(oldestKey)
    }
  }
}

function setCacheEntry<T>(
  key: string,
  data: T,
  staleTtlMs: number,
  maxTtlMs: number
): void {
  const now = Date.now()
  evictIfNeeded(now)

  memoryCache.set(key, {
    data,
    staleAt: now + staleTtlMs,
    expiresAt: now + Math.max(staleTtlMs, maxTtlMs),
    lastAccessedAt: now,
  })
}

/**
 * Fetch or retrieve cached data using Stale-While-Revalidate (SWR) semantics.
 * - Fresh (now <= staleAt): Returns cached data immediately.
 * - Stale (staleAt < now <= expiresAt): Returns cached data immediately, triggers background revalidation.
 * - Expired (now > expiresAt): Awaits fresh data with single-flight deduplication.
 */
export async function getSwrCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SwrCacheOptions = {}
): Promise<T> {
  const staleTtlMs = options.staleTtlMs ?? 10_000
  const maxTtlMs = options.maxTtlMs ?? 60_000
  const now = Date.now()

  const cached = memoryCache.get(key)

  if (cached) {
    cached.lastAccessedAt = now

    // 1. Fresh Hit
    if (now <= cached.staleAt) {
      return cached.data
    }

    // 2. Stale Hit: Serve cached data, trigger background revalidation if not already in-flight
    if (now <= cached.expiresAt) {
      if (!inFlightRequests.has(key)) {
        const bgPromise = fetcher()
          .then((freshData) => {
            setCacheEntry(key, freshData, staleTtlMs, maxTtlMs)
            return freshData
          })
          .catch(() => {
            // Keep stale cache intact if background refresh fails
          })
          .finally(() => {
            inFlightRequests.delete(key)
          })

        inFlightRequests.set(key, bgPromise)
      }
      return cached.data
    }
  }

  // 3. Expired or Cache Miss: Execute with single-flight deduplication
  const existingFlight = inFlightRequests.get(key)
  if (existingFlight) {
    return existingFlight as Promise<T>
  }

  const flightPromise = fetcher()
    .then((freshData) => {
      setCacheEntry(key, freshData, staleTtlMs, maxTtlMs)
      return freshData
    })
    .finally(() => {
      inFlightRequests.delete(key)
    })

  inFlightRequests.set(key, flightPromise)
  return flightPromise
}

/**
 * Get or fetch data with a short-lived TTL in milliseconds
 * Kept for 100% backward compatibility.
 * @param key Unique cache identifier
 * @param fetcher Async function retrieving fresh data
 * @param ttlMs Time-to-live in milliseconds (default: 8,000ms / 8s)
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 8000
): Promise<T> {
  return getSwrCachedData(key, fetcher, {
    staleTtlMs: ttlMs,
    maxTtlMs: ttlMs,
  })
}

/**
 * Invalidate a specific cache key.
 */
export function invalidateCacheKey(key: string): void {
  memoryCache.delete(key)
  inFlightRequests.delete(key)
}

/**
 * Invalidate all cache keys matching a string prefix or RegExp.
 */
export function invalidateCachePattern(pattern: RegExp | string): void {
  for (const key of memoryCache.keys()) {
    const match = typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key)
    if (match) {
      memoryCache.delete(key)
      inFlightRequests.delete(key)
    }
  }
}

/**
 * Clears all in-memory cache entries and in-flight requests (useful for test isolation).
 */
export function clearMemoryCache(): void {
  memoryCache.clear()
  inFlightRequests.clear()
}
