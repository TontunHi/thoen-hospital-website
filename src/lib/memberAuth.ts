import { cookies } from 'next/headers'
import crypto from 'crypto'

const SECRET = process.env.MEMBER_SESSION_SECRET || 'thoen-hospital-member-session-secret-2026'
const COOKIE_NAME = 'member_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', SECRET)
  hmac.update(value)
  return hmac.digest('hex')
}

function createToken(payloadData: { username: string; email: string }): string {
  const payload = JSON.stringify({ ...payloadData, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const encoded = Buffer.from(payload).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

function verifyToken(token: string): { username: string; email: string } | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expectedSignature = sign(encoded)
    if (signature !== expectedSignature) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    if (payload.exp < Date.now()) return null

    return { username: payload.username, email: payload.email }
  } catch {
    return null
  }
}

export async function createMemberSession(username: string, email: string): Promise<void> {
  const token = createToken({ username, email })
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Allow HTTP on LAN / Intranet
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function verifyMemberSession(): Promise<{ username: string; email: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  return verifyToken(token)
}

export async function destroyMemberSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
