import { cookies } from 'next/headers'
import crypto from 'crypto'

const SECRET = process.env.ADMIN_SECRET || 'fallback-secret-key'
const COOKIE_NAME = 'admin_session'
const SESSION_MAX_AGE = 60 * 60 * 6 // 6 hours in seconds

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', SECRET)
  hmac.update(value)
  return hmac.digest('hex')
}

function createToken(adminId: number): string {
  const payload = JSON.stringify({ adminId, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const encoded = Buffer.from(payload).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

function verifyToken(token: string): { adminId: number } | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expectedSignature = sign(encoded)
    if (signature !== expectedSignature) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    if (payload.exp < Date.now()) return null

    return { adminId: payload.adminId }
  } catch {
    return null
  }
}

export async function createSession(adminId: number): Promise<void> {
  const token = createToken(adminId)
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Set to false to allow login via HTTP on local network (intranet IP)
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function verifySession(): Promise<{ adminId: number } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  return verifyToken(token)
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
