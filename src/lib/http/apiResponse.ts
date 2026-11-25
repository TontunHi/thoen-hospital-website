import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    refId?: string
  }
}

export interface ApiSuccessBody<T = unknown> {
  success: true
  data: T
  message?: string
}

/**
 * Extracts a safe human-readable error message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาดภายในระบบ'): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  return fallback
}

/**
 * Standard JSON success response builder for API route handlers.
 */
export function apiOk<T>(data: T, options?: { message?: string; status?: number; headers?: HeadersInit }) {
  const body: ApiSuccessBody<T> = options?.message
    ? { success: true, message: options.message, data }
    : { success: true, data }

  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: options?.headers,
  })
}

/**
 * Standard JSON error response builder for API route handlers.
 */
export function apiError(
  code: string,
  message: string,
  status = 500,
  options?: { refId?: string; headers?: HeadersInit }
) {
  const body: ApiErrorBody = {
    success: false,
    error: options?.refId ? { code, message, refId: options.refId } : { code, message },
  }

  return NextResponse.json(body, {
    status,
    headers: options?.headers,
  })
}

/**
 * Logs unexpected server errors with a traceable reference ID via Pino and returns
 * a sanitized 500 JSON error without leaking stack traces or internal details.
 */
export function handleRouteError(
  error: unknown,
  context: string,
  publicMessage = 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง'
) {
  const refId = crypto.randomUUID().slice(0, 8)
  logger.error(
    {
      refId,
      context,
      err: error instanceof Error ? { name: error.name, message: error.message } : error,
    },
    `${context} failed`
  )
  return apiError('SERVER_ERROR', publicMessage, 500, { refId })
}
