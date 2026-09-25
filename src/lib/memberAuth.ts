import { cookies } from 'next/headers'
import crypto from 'crypto'
import { logger } from './logger'

function getSecret(): string {
  const secret = process.env.MEMBER_SESSION_SECRET
  if (!secret) {
    throw new Error('MEMBER_SESSION_SECRET environment variable is required')
  }
  return secret
}

export const COOKIE_NAME = 'member_session'
export const SESSION_MAX_AGE = 1800 // 30 minutes in seconds
export const ABSOLUTE_MAX_AGE = 43200 // 12 hours in seconds (hard limit cap)
export const SLIDE_THRESHOLD = 900 // Slide/renew if token has aged >= 15 minutes (or < 15 mins remaining)

export interface MemberSessionPayload {
  username: string
  email: string
  role: string
  aud: 'member'
  iat: number
  exp: number
}

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', getSecret())
  hmac.update(value)
  return hmac.digest('hex')
}

export function createToken(
  payloadData: { username: string; email: string; role: string },
  customIat?: number,
  customExp?: number
): string {
  const now = Date.now()
  const iat = customIat ?? now
  const exp = customExp ?? (now + SESSION_MAX_AGE * 1000)
  const payload: MemberSessionPayload = {
    ...payloadData,
    aud: 'member',
    iat,
    exp,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifyToken(token: string): (MemberSessionPayload & { username: string; email: string; role: string }) | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expectedSignature = sign(encoded)

    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    if (payload.aud !== 'member') return null
    
    const now = Date.now()
    // Check 30-minute inactivity expiration
    if (payload.exp < now) return null

    // Check 12-hour absolute session cap (if iat is present)
    const iat = typeof payload.iat === 'number' ? payload.iat : payload.exp - SESSION_MAX_AGE * 1000
    if (now - iat > ABSOLUTE_MAX_AGE * 1000) {
      return null
    }

    return {
      username: payload.username,
      email: payload.email,
      role: payload.role || 'member',
      aud: payload.aud,
      iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

/**
 * Checks if a verified token should be renewed (if remaining time < SLIDE_THRESHOLD)
 * and has not exceeded ABSOLUTE_MAX_AGE.
 */
export function shouldRenewSession(payload: { iat: number; exp: number }): boolean {
  const now = Date.now()
  // If overall lifespan exceeded absolute cap, do not renew
  if (now - payload.iat >= ABSOLUTE_MAX_AGE * 1000) {
    return false
  }
  // Renew if remaining validity is less than SLIDE_THRESHOLD (e.g. 15 minutes)
  const remainingSeconds = Math.floor((payload.exp - now) / 1000)
  return remainingSeconds <= SLIDE_THRESHOLD
}

/**
 * Generates a renewed token preserving the original `iat` while extending `exp` by SESSION_MAX_AGE.
 */
export function renewToken(payload: { username: string; email: string; role: string; iat: number }): string {
  return createToken(
    {
      username: payload.username,
      email: payload.email,
      role: payload.role,
    },
    payload.iat
  )
}

export async function createMemberSession(username: string, email: string, role: string): Promise<void> {
  const token = createToken({ username, email, role })
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // COOKIE_SECURE=true only when serving over HTTPS.
    // Internal hospital network uses plain HTTP → must be false.
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function verifyMemberSession(): Promise<(MemberSessionPayload & { username: string; email: string; role: string }) | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  const session = verifyToken(token)
  if (!session) return null

  // If in server route context that allows cookie mutation, refresh if eligible
  if (shouldRenewSession(session)) {
    try {
      const renewedToken = renewToken(session)
      cookieStore.set(COOKIE_NAME, renewedToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      })
    } catch {
      // In Server Components, cookies().set may throw (read-only); silently ignore here
    }
  }

  try {
    const { queryMemberDb } = await import('./memberDb')
    const users = await queryMemberDb(
      'SELECT role FROM members WHERE username = ? AND email = ? LIMIT 1',
      [session.username, session.email]
    )
    if (users && users.length > 0) {
      session.role = users[0].role || 'member'
    }
  } catch (error) {
    console.error('Failed to fetch fresh session role from DB:', error)
  }

  return session
}

/**
 * Explicit helper for API Route handlers to ensure renewed session cookie is attached to NextResponse
 */
export function attachRenewedMemberSessionCookie<T>(response: NextResponse<T>, session: MemberSessionPayload): NextResponse<T> {
  if (shouldRenewSession(session)) {
    const renewedToken = renewToken(session)
    response.cookies.set(COOKIE_NAME, renewedToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
  }
  return response
}

export async function destroyMemberSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

import { NextResponse } from 'next/server'

export async function checkPositionPermission(
  username: string,
  permissionKey: string | string[]
): Promise<boolean> {
  try {
    const { queryMemberDb } = await import('./memberDb')
    const users = await queryMemberDb(
      'SELECT position, role FROM members WHERE username = ? LIMIT 1',
      [username]
    )

    if (!users || users.length === 0) return false
    const user = users[0]
    if (user.role === 'admin') return true

    const userPosition = (user.position || '').trim()
    if (!userPosition) return false

    // Built-in standard role/position rules
    const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey]
    if (keys.includes('upload_salary') && userPosition.includes('เจ้าพนักงานการเงินและบัญชี')) {
      return true
    }
    const placeholders = keys.map(() => '?').join(', ')

    const result = await queryMemberDb(
      `SELECT COUNT(*) as count FROM position_permissions WHERE permission_key IN (${placeholders}) AND TRIM(position_name) = TRIM(?)`,
      [...keys, userPosition]
    )

    return (result[0]?.count || 0) > 0
  } catch (error) {
    logger.error({ error }, 'Check position permission error')
    return false
  }
}

export async function requireNewsPermission(): Promise<
  { session: { username: string; email: string; role: string }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const session = await verifyMemberSession()

  if (!session) {
    return {
      error: NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      ),
    }
  }

  if (session.role === 'admin') {
    return { session }
  }

  const hasNewsPerm = await checkPositionPermission(session.username, 'manage_news')
  if (!hasNewsPerm) {
    return {
      error: NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์จัดการข่าวประชาสัมพันธ์' },
        { status: 403 }
      ),
    }
  }

  return { session }
}

export async function requireMemberAdmin(): Promise<
  { session: { username: string; email: string; role: string }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const session = await verifyMemberSession()

  if (!session) {
    return {
      error: NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      ),
    }
  }

  if (session.role !== 'admin') {
    return {
      error: NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      ),
    }
  }

  return { session }
}


