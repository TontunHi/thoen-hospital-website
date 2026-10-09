import { formatMaskedCitizenId } from '@/lib/auth/otpEmailTemplate'
import { registrationSchema, type RegistrationFormData } from './registrationSchema'

export const PUBLIC_REGISTRATION_ACTOR = { username: 'public-registration', email: null }

export type SubmitResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; reason: 'conflict'; message: string }

export type OperationResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export interface RegistrationRecord extends RegistrationFormData {
  id: number
  status: string
  rejectReason?: string | null
  approvedAt?: Date | string | null
  approvedBy?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface RegistrationDeps {
  findExistingMember?: (query: { citizenId?: string; email?: string }) => Promise<{ id: number; username: string; email: string } | null>
  findPendingRegistration?: (query: { citizenId?: string; email?: string; excludeId?: number }) => Promise<{ id: number; citizenId: string; email: string } | null>
  createRegistration: (data: Omit<RegistrationFormData, 'consentPolicy'>) => Promise<{ id: number }>
  getRegistrationById?: (id: number) => Promise<RegistrationRecord | null>
  listRegistrations?: (filter: { status?: string; search?: string; page?: number; limit?: number }) => Promise<{ items: RegistrationRecord[]; total: number }>
  updateRegistration?: (id: number, data: Partial<RegistrationFormData> & { status?: string; rejectReason?: string | null; approvedBy?: string | null; approvedAt?: Date | null }) => Promise<{ id: number }>
  deleteRegistration?: (id: number) => Promise<void>
  createMemberFromRegistration?: (data: {
    username: string
    email: string
    name: string
    department: string
    position: string
    role: string
  }) => Promise<{ id: number }>
  checkRateLimit: () => Promise<{ allowed: boolean; retryAfterSeconds: number }>
  log: (message: string, context: Record<string, unknown>) => void
  audit: (
    actionType: 'CREATE' | 'UPDATE' | 'DELETE',
    targetTable: 'member_registrations' | 'members',
    details: string,
    actor: { username: string; email: string | null }
  ) => Promise<void>
}

export function createRegistrationService(deps: RegistrationDeps) {
  return {
    async submit(input: unknown): Promise<SubmitResult> {
      const parsed = registrationSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, reason: 'invalid', message: parsed.error.issues[0].message }
      }

      const data: RegistrationFormData = parsed.data

      // Check if citizenId or email already has active member account
      if (deps.findExistingMember) {
        const existingMember = await deps.findExistingMember({ citizenId: data.citizenId, email: data.email })
        if (existingMember) {
          if (existingMember.username === data.citizenId) {
            return { ok: false, reason: 'conflict', message: 'เลขบัตรประชาชนนี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ' }
          }
          if (existingMember.email.toLowerCase() === data.email.toLowerCase()) {
            return { ok: false, reason: 'conflict', message: 'อีเมลนี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ' }
          }
        }
      }

      // Check if there is already a pending request
      if (deps.findPendingRegistration) {
        const existingPending = await deps.findPendingRegistration({ citizenId: data.citizenId, email: data.email })
        if (existingPending) {
          return { ok: false, reason: 'conflict', message: 'คุณได้ส่งคำขอสมัครไว้แล้ว อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบ' }
        }
      }

      const rate = await deps.checkRateLimit()
      if (!rate.allowed) {
        return { ok: false, reason: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds }
      }

      // Strip consentPolicy before saving
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { consentPolicy, ...saveData } = data

      const { id } = await deps.createRegistration(saveData)
      const maskedCitizenId = formatMaskedCitizenId(data.citizenId)
      deps.log('Member registration submitted', { registrationId: id, citizenId: maskedCitizenId })

      await deps.audit(
        'CREATE',
        'member_registrations',
        `ส่งคำขอสมัครสมาชิก #${id} (${data.title}${data.firstNameTh} ${data.lastNameTh}, เลขบัตร ${maskedCitizenId})`,
        PUBLIC_REGISTRATION_ACTOR
      )

      return { ok: true, id }
    },

    async list(filter: { status?: string; search?: string; page?: number; limit?: number }) {
      if (!deps.listRegistrations) {
        throw new Error('listRegistrations dependency is not implemented')
      }
      return deps.listRegistrations(filter)
    },

    async getById(id: number) {
      if (!deps.getRegistrationById) {
        throw new Error('getRegistrationById dependency is not implemented')
      }
      return deps.getRegistrationById(id)
    },

    async update(
      id: number,
      input: Partial<RegistrationFormData>,
      actor: { username: string; email: string | null }
    ): Promise<OperationResult> {
      if (!deps.updateRegistration || !deps.getRegistrationById) {
        throw new Error('updateRegistration dependencies not implemented')
      }

      const existing = await deps.getRegistrationById(id)
      if (!existing) {
        return { ok: false, message: 'ไม่พบข้อมูลคำขอสมัคร' }
      }

      await deps.updateRegistration(id, input)
      await deps.audit(
        'UPDATE',
        'member_registrations',
        `แก้ไขข้อมูลคำขอสมัคร #${id} (${existing.firstNameTh} ${existing.lastNameTh})`,
        actor
      )

      return { ok: true, data: undefined }
    },

    async approve(
      id: number,
      actor: { username: string; email: string | null }
    ): Promise<OperationResult> {
      if (!deps.getRegistrationById || !deps.updateRegistration || !deps.createMemberFromRegistration) {
        throw new Error('approve dependencies not implemented')
      }

      const registration = await deps.getRegistrationById(id)
      if (!registration) {
        return { ok: false, message: 'ไม่พบข้อมูลคำขอสมัคร' }
      }

      if (registration.status === 'approved') {
        return { ok: false, message: 'คำขอนี้ได้รับการอนุมัติไปแล้ว' }
      }

      // Create or update member account
      const fullName = `${registration.title}${registration.firstNameTh} ${registration.lastNameTh}`.trim()
      await deps.createMemberFromRegistration({
        username: registration.citizenId,
        email: registration.email,
        name: fullName,
        department: registration.department,
        position: registration.position,
        role: 'member',
      })

      // Update registration status
      await deps.updateRegistration(id, {
        status: 'approved',
        approvedBy: actor.username,
        approvedAt: new Date(),
      })

      const maskedCitizenId = formatMaskedCitizenId(registration.citizenId)
      await deps.audit(
        'UPDATE',
        'member_registrations',
        `อนุมัติคำขอสมัครสมาชิก #${id} (${fullName}, เลขบัตร ${maskedCitizenId}) และสร้างบัญชีผู้ใช้สำเร็จ`,
        actor
      )

      return { ok: true, data: undefined }
    },

    async reject(
      id: number,
      reason: string | null,
      actor: { username: string; email: string | null }
    ): Promise<OperationResult> {
      if (!deps.getRegistrationById || !deps.updateRegistration) {
        throw new Error('reject dependencies not implemented')
      }

      const registration = await deps.getRegistrationById(id)
      if (!registration) {
        return { ok: false, message: 'ไม่พบข้อมูลคำขอสมัคร' }
      }

      await deps.updateRegistration(id, {
        status: 'rejected',
        rejectReason: reason || 'ไม่ผ่านการอนุมัติ',
      })

      await deps.audit(
        'UPDATE',
        'member_registrations',
        `ปฏิเสธคำขอสมัครสมาชิก #${id} (${registration.firstNameTh} ${registration.lastNameTh}, เหตุผล: ${reason || 'ไม่ระบุ'})`,
        actor
      )

      return { ok: true, data: undefined }
    },

    async delete(
      id: number,
      actor: { username: string; email: string | null }
    ): Promise<OperationResult> {
      if (!deps.getRegistrationById || !deps.deleteRegistration) {
        throw new Error('delete dependencies not implemented')
      }

      const registration = await deps.getRegistrationById(id)
      if (!registration) {
        return { ok: false, message: 'ไม่พบข้อมูลคำขอสมัคร' }
      }

      await deps.deleteRegistration(id)
      await deps.audit(
        'DELETE',
        'member_registrations',
        `ลบคำขอสมัครสมาชิก #${id} (${registration.firstNameTh} ${registration.lastNameTh})`,
        actor
      )

      return { ok: true, data: undefined }
    },
  }
}
