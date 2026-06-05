/**
 * In-memory rate limiter for API routes
 * 
 * Prevents brute-force attacks on authentication endpoints
 * and spam on public-facing forms.
 * 
 * NOTE: This is per-process. In a multi-instance deployment,
 * use Redis-backed rate limiting instead.
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Global store — persists across requests within the same process
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for, x-real-ip, then falls back to 'unknown'.
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; take the first (client)
    return forwarded.split(',')[0].trim()
  }
  const realIp = headersList.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

interface RateLimitOptions {
  /** Unique identifier prefix for this limiter (e.g., 'auth-login') */
  key: string
  /** Maximum number of requests allowed within the window */
  maxAttempts: number
  /** Time window in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of remaining attempts */
  remaining: number
  /** When the rate limit resets (Unix timestamp ms) */
  resetTime: number
  /** Pre-built 429 response if not allowed */
  response?: NextResponse
}

/**
 * Check rate limit for the current request.
 * 
 * Usage in API routes:
 * ```ts
 * const rateCheck = await checkRateLimit({ key: 'auth-login', maxAttempts: 5, windowSeconds: 900 })
 * if (!rateCheck.allowed) return rateCheck.response!
 * ```
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === 'development') {
    return {
      allowed: true,
      remaining: options.maxAttempts,
      resetTime: Date.now() + options.windowSeconds * 1000,
    }
  }

  cleanupExpiredEntries()

  const clientIp = await getClientIp()
  const storeKey = `${options.key}:${clientIp}`
  const now = Date.now()
  const windowMs = options.windowSeconds * 1000

  let entry = rateLimitStore.get(storeKey)

  // Reset if window has passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    }
  }

  entry.count++
  rateLimitStore.set(storeKey, entry)

  const remaining = Math.max(0, options.maxAttempts - entry.count)

  if (entry.count > options.maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000)

    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      response: NextResponse.json(
        {
          error: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง',
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSeconds.toString(),
            'X-RateLimit-Limit': options.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
          },
        }
      ),
    }
  }

  return {
    allowed: true,
    remaining,
    resetTime: entry.resetTime,
  }
}
