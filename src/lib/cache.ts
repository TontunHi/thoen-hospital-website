/**
 * In-Memory Short-Lived TTL Cache
 * Designed for caching read-only replica queries (HOSxP / ER / Lab Status)
 * Protects database health against rapid concurrent polling.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

/**
 * Get or fetch data with a short-lived TTL in milliseconds
 * @param key Unique cache identifier
 * @param fetcher Async function retrieving fresh data
 * @param ttlMs Time-to-live in milliseconds (default: 8,000ms / 8s)
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 8000
): Promise<T> {
  const now = Date.now()
  const cached = memoryCache.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const freshData = await fetcher()
  memoryCache.set(key, {
    data: freshData,
    expiresAt: now + ttlMs,
  })

  // Prevent memory leaks: clean up expired entries when cache grows
  if (memoryCache.size > 200) {
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt <= now) {
        memoryCache.delete(k)
      }
    }
  }

  return freshData
}
