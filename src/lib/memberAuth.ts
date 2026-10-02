import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from './logger'
import { MemberAuthService } from './auth/MemberAuthService'

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

export type MemberPermission =
  | 'manage_news'
  | 'manage_ita'
  | 'manage_rdu'
  | 'manage_ethics'
  | 'manage_outgoing_doc'
  | 'view_all_salary'
  | 'upload_salary'
  | 'manage_locations'
  | 'manage_repairs'
  | 'manage_inbox'
  | 'manage_media_requests'
  | 'manage_assets'
  | 'view_it_repairs'
  | 'view_general_repairs'
  | 'view_medical_repairs'
  | 'view_media_requests'
  | 'view_department_tasks'
  | 'view_all_work'

export interface MemberDto {
  id: number
  username: string
  email: string
  name: string
  department: string
  position: string
  salaryUser: string | null
  role: string
  displayRole: string
  initials: string
  signaturePath: string | null
  profilePath: string | null
  profile_path: string | null
  hasSignature: boolean
  hasSalary: boolean
  hasSalaryCredentials: boolean
  isTelegramLinked: boolean
  isAdmin: boolean
  permissions: string[]
  settings: Record<string, string>
}

export interface AuthenticatedMember {
  id: number
  username: string
  email: string
  name: string
  department: string
  position: string
  salaryUser: string | null
  role: string
  displayRole: string
  initials: string
  signaturePath: string | null
  profilePath: string | null
  profile_path: string | null
  hasSignature: boolean
  hasSalary: boolean
  hasSalaryCredentials: boolean
  isTelegramLinked: boolean
  isAdmin: boolean
  permissions: Set<string>
  settings: Record<string, string>
  session: {
    username: string
    email: string
    role: string
  }
  can(permission: MemberPermission | MemberPermission[] | string | string[]): boolean
  isFeatureEnabled(featureKey: string): boolean
  hasAccess(featureKey: string): boolean
  toDto(): MemberDto
}

export interface MemberAuthOptions {
  requiredPermission?: MemberPermission | MemberPermission[] | string | string[]
  requiredRole?: string | string[]
  requiredFeature?: string
  redirectTo?: string
}

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', getSecret())
  hmac.update(value)
  return hmac.digest('hex')
}

const authService = new MemberAuthService()

export function createToken(
  payloadData: { username: string; email: string; role: string },
  customIat?: number,
  customExp?: number
): string {
  throw new Error("createToken is deprecated. Use MemberAuthService.buildSession instead.")
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
  throw new Error("renewToken is deprecated. Use MemberAuthService.buildSession instead.")
}

export async function createMemberSession(username: string, email: string, role: string): Promise<void> {
  const token = await authService.buildSession({ username, email, role })
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

  let session
  try {
    session = await authService.verifySession(token)
  } catch {
    return null
  }

  // If in server route context that allows cookie mutation, refresh if eligible
  if (shouldRenewSession(session as any)) {
    try {
      const renewedToken = await authService.buildSession({
        username: session.username,
        email: session.email,
        role: session.role,
        iat: session.iat
      })
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

  return session as any
}

/**
 * Explicit helper for API Route handlers to ensure renewed session cookie is attached to NextResponse
 */
export async function attachRenewedMemberSessionCookie<T>(response: NextResponse<T>, session: MemberSessionPayload): Promise<NextResponse<T>> {
  if (shouldRenewSession(session as any)) {
    const renewedToken = await authService.buildSession({
      username: session.username,
      email: session.email,
      role: session.role,
      iat: session.iat
    })
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

/**
 * Hydrates complete member context with permissions and system settings in a single roundtrip.
 */
export async function fetchAuthenticatedMember(username: string, email: string): Promise<AuthenticatedMember | null> {
  try {
    const { queryMemberDb } = await import('./memberDb')

    // 1. Fetch member core profile
    const users = await queryMemberDb(
      'SELECT id, username, email, name, department, position, salary_user, role, signature_path, profile_path FROM members WHERE username = ? AND email = ? LIMIT 1',
      [username, email]
    )

    if (!users || users.length === 0) return null
    const user = users[0]

    const userPosition = (user.position || '').trim()
    const isAdmin = user.role === 'admin'

    // 2. Fetch parallel context data: permissions, system settings, telegram linking
    const [permsRes, settingsRows, telegramRows] = await Promise.all([
      userPosition
        ? queryMemberDb('SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)', [userPosition])
        : Promise.resolve([]),
      queryMemberDb('SELECT config_key, config_value FROM member_system_settings'),
      queryMemberDb('SELECT id FROM member_telegram_links WHERE member_id = ? LIMIT 1', [user.id])
    ])

    const permissions = new Set<string>()
    if (permsRes && Array.isArray(permsRes)) {
      permsRes.forEach((row: any) => {
        if (row.permission_key) permissions.add(row.permission_key)
      })
    }

    const settings: Record<string, string> = {}
    if (settingsRows && Array.isArray(settingsRows)) {
      settingsRows.forEach((row: any) => {
        if (row.config_key) settings[row.config_key] = row.config_value
      })
    }

    const isTelegramLinked = Boolean(telegramRows && telegramRows.length > 0)
    const hasSignature = Boolean(user.signature_path)
    const hasSalary = Boolean(user.salary_user)

    const roleTranslation: Record<string, string> = {
      admin: 'ผู้ดูแลระบบ (Admin)',
      member: 'สมาชิกทั่วไป (Member)',
      subdistrict: 'รพ.สต.'
    }
    const displayRole = roleTranslation[user.role] || user.role || 'สมาชิกทั่วไป'

    const initials = user.name
      ? user.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('')
      : user.username.substring(0, 2).toUpperCase()

    const can = (perm: MemberPermission | MemberPermission[] | string | string[]): boolean => {
      if (isAdmin) return true
      const keys = Array.isArray(perm) ? perm : [perm]
      if (keys.includes('upload_salary') && userPosition.includes('เจ้าพนักงานการเงินและบัญชี')) {
        return true
      }
      return keys.some(k => permissions.has(k))
    }

    const isFeatureEnabled = (key: string): boolean => {
      return settings[key] !== '0'
    }

    const hasAccess = (key: string): boolean => {
      return isAdmin || isFeatureEnabled(key)
    }

    const memberObj: AuthenticatedMember = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name || '',
      department: user.department || '',
      position: userPosition,
      salaryUser: user.salary_user || null,
      role: user.role || 'member',
      displayRole,
      initials,
      signaturePath: user.signature_path || null,
      profilePath: user.profile_path || null,
      profile_path: user.profile_path || null,
      hasSignature,
      hasSalary,
      hasSalaryCredentials: hasSalary,
      isTelegramLinked,
      isAdmin,
      permissions,
      settings,
      session: {
        username: user.username,
        email: user.email,
        role: user.role || 'member',
      },
      can,
      isFeatureEnabled,
      hasAccess,
      toDto() {
        return toClientMember(this)
      },
    }

    return memberObj
  } catch (error) {
    logger.error({ error }, 'fetchAuthenticatedMember error')
    return null
  }
}

/**
 * Sanitizes an AuthenticatedMember instance into a plain, JSON-serializable DTO
 * safe to pass across the React Server Component -> Client Component boundary.
 */
export function toClientMember(member: AuthenticatedMember): MemberDto {
  return {
    id: member.id,
    username: member.username,
    email: member.email,
    name: member.name,
    department: member.department,
    position: member.position,
    salaryUser: member.salaryUser,
    role: member.role,
    displayRole: member.displayRole,
    initials: member.initials,
    signaturePath: member.signaturePath,
    profilePath: member.profilePath,
    profile_path: member.profile_path,
    hasSignature: member.hasSignature,
    hasSalary: member.hasSalary,
    hasSalaryCredentials: member.hasSalaryCredentials,
    isTelegramLinked: member.isTelegramLinked,
    isAdmin: member.isAdmin,
    permissions: Array.from(member.permissions),
    settings: { ...member.settings },
  }
}

/**
 * For Server Components & Server Actions:
 * Enforces authentication and optional permissions.
 * Redirects defensively on failure.
 */
export async function getAuthenticatedMember(options?: MemberAuthOptions): Promise<AuthenticatedMember> {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const member = await fetchAuthenticatedMember(session.username, session.email)
  if (!member) {
    redirect('/member/login')
  }

  if (options?.requiredRole) {
    const roles = Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole]
    if (!member.isAdmin && !roles.includes(member.role)) {
      redirect(options.redirectTo || '/member')
    }
  }

  if (options?.requiredPermission) {
    if (!member.can(options.requiredPermission)) {
      redirect(options.redirectTo || '/member')
    }
  }

  if (options?.requiredFeature) {
    if (!member.hasAccess(options.requiredFeature)) {
      redirect(options.redirectTo || '/member')
    }
  }

  return member
}

/**
 * For API Route Handlers:
 * Enforces authentication and optional permissions.
 * Returns standard early-exit JSON errors on failure.
 */
export async function requireMemberApi(options?: MemberAuthOptions): Promise<
  { member: AuthenticatedMember; error?: never } |
  { member?: never; error: NextResponse }
> {
  const session = await verifyMemberSession()
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      ),
    }
  }

  const member = await fetchAuthenticatedMember(session.username, session.email)
  if (!member) {
    return {
      error: NextResponse.json(
        { success: false, error: 'ไม่พบบัญชีผู้ใช้งานในระบบ' },
        { status: 401 }
      ),
    }
  }

  if (options?.requiredRole) {
    const roles = Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole]
    if (!member.isAdmin && !roles.includes(member.role)) {
      return {
        error: NextResponse.json(
          { success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
          { status: 403 }
        ),
      }
    }
  }

  if (options?.requiredPermission) {
    if (!member.can(options.requiredPermission)) {
      return {
        error: NextResponse.json(
          { success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้' },
          { status: 403 }
        ),
      }
    }
  }

  if (options?.requiredFeature) {
    if (!member.hasAccess(options.requiredFeature)) {
      return {
        error: NextResponse.json(
          { success: false, error: 'ฟังก์ชันนี้ถูกปิดใช้งานชั่วคราว' },
          { status: 403 }
        ),
      }
    }
  }

  return { member }
}

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


