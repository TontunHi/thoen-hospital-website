import { NextRequest, NextResponse } from 'next/server'
import { GatewayTimeoutError, GatewayUnavailableError } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'
import {
  InternalPhoneNotFoundError,
  InternalPhoneValidationError,
} from '@/lib/internalPhones/internalPhoneService'

export function parsePositiveIntId(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null
  const id = Number(rawId)
  return Number.isSafeInteger(id) && id > 0 ? id : null
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

export function handleInternalPhoneRouteError(error: unknown, context: string): NextResponse {
  if (error instanceof GatewayTimeoutError) {
    return NextResponse.json(
      {
        success: false,
        error: 'ระบบฐานข้อมูลใช้เวลาประมวลผลนานเกินกำหนด (Timeout) กรุณาลองใหม่อีกครั้ง',
      },
      { status: 504 }
    )
  }
  if (error instanceof GatewayUnavailableError) {
    return NextResponse.json(
      {
        success: false,
        error: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลาง (API Gateway) ได้ในขณะนี้',
      },
      { status: 503 }
    )
  }
  if (error instanceof InternalPhoneNotFoundError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 404 })
  }
  if (error instanceof InternalPhoneValidationError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
  const err = error instanceof Error ? error : new Error('Unknown error')
  logger.error({ errName: err.name, message: err.message }, `${context} failed`)
  return NextResponse.json(
    { success: false, error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' },
    { status: 500 }
  )
}
