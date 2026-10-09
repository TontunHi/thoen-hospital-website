import { describe, it, expect, vi } from 'vitest'
import { handleRegisterRequest } from '../registerHttp'

describe('handleRegisterRequest', () => {
  it('answers 201 when the registration is saved', async () => {
    const res = await handleRegisterRequest({}, vi.fn().mockResolvedValue({ ok: true, id: 7 }), vi.fn())
    expect(res.status).toBe(201)
  })

  it('answers 429 with Retry-After when rate limited', async () => {
    const res = await handleRegisterRequest(
      {},
      vi.fn().mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfterSeconds: 90 }),
      vi.fn()
    )
    expect(res.status).toBe(429)
    expect(res.headers?.['Retry-After']).toBe('90')
  })

  it('answers 400 with the validation message when input is invalid', async () => {
    const res = await handleRegisterRequest(
      {},
      vi.fn().mockResolvedValue({ ok: false, reason: 'invalid', message: 'กรุณากรอกอีเมล' }),
      vi.fn()
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('กรุณากรอกอีเมล')
  })

  it('answers 500 and logs the failure without the error message, which may echo the citizen ID', async () => {
    const logError = vi.fn()
    const failure = Object.assign(new Error('insert failed for citizen_id 1234567890123'), { code: 'P2021' })
    const res = await handleRegisterRequest({}, vi.fn().mockRejectedValue(failure), logError)

    expect(res.status).toBe(500)
    expect(logError).toHaveBeenCalledOnce()
    const logged = JSON.stringify(logError.mock.calls)
    expect(logged).toContain('P2021')
    expect(logged).not.toContain('1234567890123')
  })
})

