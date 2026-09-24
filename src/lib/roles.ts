/**
 * Role-Based Access Control (RBAC) system for Thoen Hospital
 * 
 * Every API route that handles sensitive data MUST call requireAuth()
 * or requireRole() before processing. Never trust frontend-only checks.
 */

import { verifyMemberSession } from './memberAuth'
import { NextResponse } from 'next/server'

// All valid roles in the system
export type UserRole = 'patient' | 'doctor' | 'nurse' | 'admin' | 'hr' | 'editor' | 'subdistrict'

export const ROLES = {
  PATIENT: 'patient' as const,
  DOCTOR: 'doctor' as const,
  NURSE: 'nurse' as const,
  ADMIN: 'admin' as const,
  HR: 'hr' as const,
  EDITOR: 'editor' as const,
  SUBDISTRICT: 'subdistrict' as const,
}

// Role hierarchy for permission checking
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['admin', 'editor', 'hr', 'doctor', 'nurse', 'patient', 'subdistrict'], // admin can do everything
  hr: ['hr'],
  editor: ['editor'],
  doctor: ['doctor'],
  nurse: ['nurse'],
  patient: ['patient'],
  subdistrict: ['subdistrict'],
}

/**
 * Verify the user is authenticated. Returns session data or a 401 response.
 * 
 * Usage in API routes:
 * ```ts
 * const authResult = await requireAuth()
 * if (authResult.error) return authResult.error
 * const { session } = authResult
 * ```
 */
export async function requireAuth(): Promise<
  { session: { username: string; email: string; role: UserRole }; error?: never } |
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

  return { session: { ...session, role: session.role as UserRole } }
}

/**
 * Verify the user is authenticated AND has one of the required roles.
 * Returns session data or a 401/403 response.
 * 
 * Usage in API routes:
 * ```ts
 * const authResult = await requireRole(['admin', 'hr'])
 * if (authResult.error) return authResult.error
 * const { session } = authResult
 * ```
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<
  { session: { username: string; email: string; role: UserRole }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const authResult = await requireAuth()
  if (authResult.error) return authResult

  const { session } = authResult

  // Admin has access to everything
  if (session.role === 'admin') {
    return { session }
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      error: NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      ),
    }
  }

  return { session }
}

/**
 * Verify user is authenticated AND either:
 * - Has admin role
 * - Matches one of the allowed roles (optional)
 * - Or has granted position permission key(s)
 */
export async function requirePermission(
  permissionKey: string | string[],
  fallbackRoles: UserRole[] = []
): Promise<
  { session: { username: string; email: string; role: UserRole }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const authResult = await requireAuth()
  if (authResult.error) return authResult

  const { session } = authResult

  // Admin has access to everything
  if (session.role === 'admin') {
    return { session }
  }

  // Check fallback role
  if (fallbackRoles.includes(session.role)) {
    return { session }
  }

  // Check dynamic position permission
  const { checkPositionPermission } = await import('./memberAuth')
  const hasPermission = await checkPositionPermission(session.username, permissionKey)
  if (hasPermission) {
    return { session }
  }

  return {
    error: NextResponse.json(
      { error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้' },
      { status: 403 }
    ),
  }
}
