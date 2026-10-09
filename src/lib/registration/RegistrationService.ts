import { z } from 'zod'
import { formatMaskedCitizenId } from '@/lib/auth/otpEmailTemplate'

const registrationSchema = z.object({
  citizenId: z.string({ error: 'กรุณากรอกเลขบัตรประชาชน' }).trim().regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก'),
  firstNameTh: z.string({ error: 'กรุณากรอกชื่อภาษาไทย' }).trim().min(1, 'กรุณากรอกชื่อภาษาไทย').max(100),
  lastNameTh: z.string({ error: 'กรุณากรอกนามสกุลภาษาไทย' }).trim().min(1, 'กรุณากรอกนามสกุลภาษาไทย').max(100),
  email: z.string({ error: 'กรุณากรอกอีเมล' }).trim().max(100, 'อีเมลยาวเกิน 100 ตัวอักษร').email('รูปแบบอีเมลไม่ถูกต้อง'),
})

export interface NewRegistration {
  citizenId: string
  firstNameTh: string
  lastNameTh: string
  email: string
}

export type SubmitResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export interface RegistrationDeps {
  createRegistration: (data: NewRegistration) => Promise<{ id: number }>
  checkRateLimit: () => Promise<{ allowed: boolean; retryAfterSeconds: number }>
  log: (message: string, context: Record<string, unknown>) => void
}

export function createRegistrationService(deps: RegistrationDeps) {
  return {
    async submit(input: unknown): Promise<SubmitResult> {
      const rate = await deps.checkRateLimit()
      if (!rate.allowed) {
        return { ok: false, reason: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds }
      }
      const parsed = registrationSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, reason: 'invalid', message: parsed.error.issues[0].message }
      }
      const data: NewRegistration = parsed.data
      const { id } = await deps.createRegistration(data)
      deps.log('Member registration submitted', {
        registrationId: id,
        citizenId: formatMaskedCitizenId(data.citizenId),
      })
      return { ok: true, id }
    },
  }
}
