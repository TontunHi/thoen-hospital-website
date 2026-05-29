/**
 * Refresh Token system for extended sessions
 * 
 * Pattern:
 * - Session token: 30-minute lifetime (in admin_session cookie)
 * - Refresh token: 8-hour lifetime (in admin_refresh cookie)
 * 
 * When the session expires, the client can call /api/auth/refresh
 * to get a new session without re-entering credentials, as long as
 * the refresh token is still valid.
 */

import { cookies } from 'next/headers'
import crypto from 'crypto'

const SECRET = process.env.ADMIN_SECRET
const REFRESH_COOKIE_NAME = 'admin_refresh'
const REFRESH_MAX_AGE = 60 * 60 * 8 // 8 hours in seconds

function getSecret(): string {
  if (!SECRET) {
    throw new Error('ADMIN_SECRET environment variable is required')
  }
  return SECRET
}

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', getSecret())
  hmac.update(value)
  return hmac.digest('hex')
}

function createRefreshTokenValue(adminId: number, role: string): string {
  const payload = JSON.stringify({
    adminId,
    role,
    type: 'refresh',
    exp: Date.now() + REFRESH_MAX_AGE * 1000,
    jti: crypto.randomUUID(), // unique token ID to prevent replay
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

function verifyRefreshTokenValue(token: string): { adminId: number; role: string } | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expectedSignature = sign(encoded)
    
    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    if (payload.type !== 'refresh') return null
    if (payload.exp < Date.now()) return null

    return { adminId: payload.adminId, role: payload.role }
  } catch {
    return null
  }
}

/**
 * Create and set a refresh token cookie.
 * Call this alongside createSession() during login.
 */
export async function createRefreshToken(adminId: number, role: string): Promise<void> {
  const token = createRefreshTokenValue(adminId, role)
  const cookieStore = await cookies()

  cookieStore.set(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  })
}

/**
 * Verify the refresh token from cookies.
 * Returns the admin ID and role if valid, null otherwise.
 */
export async function verifyRefreshToken(): Promise<{ adminId: number; role: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(REFRESH_COOKIE_NAME)?.value

  if (!token) return null

  return verifyRefreshTokenValue(token)
}

/**
 * Delete the refresh token cookie (on logout).
 */
export async function destroyRefreshToken(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(REFRESH_COOKIE_NAME)
}
