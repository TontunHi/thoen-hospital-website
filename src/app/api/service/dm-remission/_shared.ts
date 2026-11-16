import { NextRequest, NextResponse } from 'next/server'
import { GatewayTimeoutError, GatewayUnavailableError } from '@/lib/apiGateway'
import {
  DmRemissionConflictError,
  DmRemissionNotFoundError,
  DmRemissionValidationError,
} from '@/lib/clinical/dmRemissionService'
import { logger } from '@/lib/logger'
import {
  checkPositionPermission,
  verifyMemberSession,
  type MemberSessionPayload,
} from '@/lib/memberAuth'

export type DmRemissionAccessLevel = 'view' | 'manage' | 'admin'

export function parsePositiveIntId(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null
  const id = Number(rawId)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function requireDmRemissionSession(
  accessLevel: DmRemissionAccessLevel = 'view'
): Promise<{ session: MemberSessionPayload; response?: never } | { session?: never; response: NextResponse }> {
  const session = await verifyMemberSession()
  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      ),
    }
  }
  if (!session.role) {
    return {
      response: NextResponse.json(
        { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      ),
    }
  }
  if (accessLevel === 'admin' && session.role !== 'admin') {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการตัวเลือกได้',
        },
        { status: 403 }
      ),
    }
  }
  if (accessLevel === 'manage' && session.role !== 'admin') {
    const canManage = await checkPositionPermission(session.username, 'manage_dm_remission')
    if (!canManage) {
      return {
        response: NextResponse.json(
          {
            success: false,
            error: 'ไม่มีสิทธิ์เพิ่ม แก้ไข หรือลบข้อมูลทะเบียน DM Remission',
          },
          { status: 403 }
        ),
      }
    }
  }
  return { session }
}

export async function parseJsonBody(
  request: NextRequest
): Promise<{ body: unknown; response?: never } | { body?: never; response: NextResponse }> {
  try {
    const body = await request.json()
    return { body }
  } catch {
    return {
      response: NextResponse.json(
        { success: false, error: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' },
        { status: 400 }
      ),
    }
  }
}

export function handleDmRemissionRouteError(error: unknown, context: string): NextResponse {
  if (error instanceof GatewayTimeoutError) {
    return NextResponse.json(
      { success: false, error: 'ระบบฐานข้อมูลใช้เวลาประมวลผลนานเกินกำหนด (Timeout) กรุณาลองใหม่อีกครั้ง' },
      { status: 504 }
    )
  }
  if (error instanceof GatewayUnavailableError) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลาง (API Gateway) ได้ในขณะนี้' },
      { status: 503 }
    )
  }
  if (error instanceof DmRemissionConflictError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 409 })
  }
  if (error instanceof DmRemissionNotFoundError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 404 })
  }
  if (error instanceof DmRemissionValidationError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
  const err = error instanceof Error ? error : new Error('Unknown error')
  logger.error({ errName: err.name, message: err.message }, `${context} failed`)
  return NextResponse.json(
    { success: false, error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' },
    { status: 500 }
  )
}
