import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { apiOk, apiError, getErrorMessage, handleRouteError } from '../apiResponse'
import { logger } from '@/lib/logger'

describe('apiResponse helpers', () => {
  it('extracts message from Error instances, strings, and falls back safely', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage('string error')).toBe('string error')
    expect(getErrorMessage({ unexpected: true }, 'fallback')).toBe('fallback')
    expect(getErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('builds consistent success and error JSON responses', async () => {
    const okRes = apiOk({ count: 3 }, { message: 'loaded', status: 201 })
    expect(okRes.status).toBe(201)
    expect(await okRes.json()).toEqual({ success: true, message: 'loaded', data: { count: 3 } })

    const errRes = apiError('VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง', 400, { refId: 'abc12345' })
    expect(errRes.status).toBe(400)
    expect(await errRes.json()).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', refId: 'abc12345' },
    })
  })

  it('logs sanitized error with refId and hides internal error message from client', async () => {
    const res = handleRouteError(new Error('internal gateway socket timeout 192.168.1.208'), 'GET /api/test')
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('SERVER_ERROR')
    expect(json.error.message).not.toContain('192.168.1.208')
    expect(json.error.refId).toMatch(/^[0-9a-f-]{8}$/i)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
