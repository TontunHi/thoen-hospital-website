import type { SubmitResult } from './RegistrationService'

export interface RegisterHttpResponse {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

/**
 * Maps a registration submit to an HTTP response.
 * On failure it logs only the error's name and code: a database error message
 * can echo the submitted values, including the full citizen ID.
 */
export async function handleRegisterRequest(
  body: unknown,
  submit: (input: unknown) => Promise<SubmitResult>,
  logError: (context: Record<string, unknown>, message: string) => void
): Promise<RegisterHttpResponse> {
  try {
    const result = await submit(body)
    if (result.ok) {
      return { status: 201, body: { success: true, message: 'ได้รับคำขอสมัครแล้ว รอผู้ดูแลระบบตรวจสอบ' } }
    }
    if (result.reason === 'rate_limited') {
      return {
        status: 429,
        body: { error: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง', retryAfterSeconds: result.retryAfterSeconds },
        headers: { 'Retry-After': String(result.retryAfterSeconds) },
      }
    }
    return { status: 400, body: { error: result.message } }
  } catch (error) {
    const err = error as { name?: unknown; code?: unknown }
    logError({ errorName: err?.name, errorCode: err?.code }, 'Member registration submit error')
    return { status: 500, body: { error: 'เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่' } }
  }
}
