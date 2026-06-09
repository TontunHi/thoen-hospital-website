import { cookies } from 'next/headers'
import crypto from 'crypto'

function getSecret(): string {
  const secret = process.env.SALARY_SESSION_SECRET || process.env.MEMBER_SESSION_SECRET
  if (!secret) {
    throw new Error('SALARY_SESSION_SECRET or MEMBER_SESSION_SECRET environment variable is required')
  }
  return secret
}

const COOKIE_NAME = 'salary_user_session'
const SESSION_MAX_AGE = 1800 // 30 minutes in seconds

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', getSecret())
  hmac.update(value)
  return hmac.digest('hex')
}

function createToken(payloadData: { username: string; name: string }): string {
  const payload = JSON.stringify({ ...payloadData, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const encoded = Buffer.from(payload).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifySalaryToken(token: string): { username: string; name: string } | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expectedSignature = sign(encoded)

    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    if (payload.exp < Date.now()) return null

    return { username: payload.username, name: payload.name }
  } catch {
    return null
  }
}

export async function createSalarySession(username: string, name: string): Promise<void> {
  const token = createToken({ username, name })
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function verifySalarySession(): Promise<{ username: string; name: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  return verifySalaryToken(token)
}

export async function destroySalarySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
