import { describe, it, expect, vi } from 'vitest'
import { createRegistrationService, type RegistrationDeps } from '../RegistrationService'

const validFullInput = {
  citizenId: ' 1234567890123 ',
  title: ' นาย ',
  customTitle: '',
  firstNameTh: ' สมชาย ',
  lastNameTh: ' ใจดี ',
  firstNameEn: ' Somchai ',
  lastNameEn: ' Jaidee ',
  nickname: ' ชาย ',
  licenseNo: ' ว.12345 ',
  birthDate: ' 01/01/2540 ',
  startDate: ' 01/01/2567 ',
  containDate: ' 01/05/2567 ',
  department: ' กลุ่มงานการแพทย์ ',
  position: ' แพทย์ ',
  level: ' ปฎิบัติการ ',
  personnelGroup: ' ข้าราชการ ',
  hasHosxp: true,
  hosxpUser: ' somchai_doc ',
  hosxpPass: ' secret123 ',
  email: ' somchai@example.com ',
  phone: ' 0812345678 ',
  lineId: ' somchai_line ',
  inHospitalHousing: true,
  housingLocation: ' แฟลตมะลิ ',
  hasVehicle: true,
  vehicles: [{ platePrefix: 'กข', plateNumber: '1234', province: 'ลำปาง' }],
  consentPolicy: true,
}

function makeDeps(overrides: Partial<RegistrationDeps> = {}) {
  const deps: RegistrationDeps = {
    findExistingMember: vi.fn().mockResolvedValue(null),
    findPendingRegistration: vi.fn().mockResolvedValue(null),
    createRegistration: vi.fn().mockResolvedValue({ id: 42 }),
    getRegistrationById: vi.fn().mockResolvedValue({
      id: 42,
      citizenId: '1234567890123',
      title: 'นาย',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ใจดี',
      firstNameEn: 'Somchai',
      lastNameEn: 'Jaidee',
      nickname: 'ชาย',
      birthDate: '01/01/2540',
      startDate: '01/01/2567',
      department: 'กลุ่มงานการแพทย์',
      position: 'แพทย์',
      level: 'ปฎิบัติการ',
      personnelGroup: 'ข้าราชการ',
      hasHosxp: false,
      email: 'somchai@example.com',
      phone: '0812345678',
      inHospitalHousing: false,
      hasVehicle: false,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    listRegistrations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    updateRegistration: vi.fn().mockResolvedValue({ id: 42 }),
    deleteRegistration: vi.fn().mockResolvedValue(undefined),
    createMemberFromRegistration: vi.fn().mockResolvedValue({ id: 99 }),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
    log: vi.fn(),
    audit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return deps
}

describe('RegistrationService.submit', () => {
  it('saves a full trimmed pending registration and returns its id', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit(validFullInput)

    expect(result).toEqual({ ok: true, id: 42 })
    expect(deps.checkRateLimit).toHaveBeenCalledOnce()
    expect(deps.createRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        citizenId: '1234567890123',
        firstNameTh: 'สมชาย',
        lastNameTh: 'ใจดี',
        email: 'somchai@example.com',
        department: 'กลุ่มงานการแพทย์',
        position: 'แพทย์',
      })
    )
  })

  it('rejects duplicate citizenId when user is already an active member', async () => {
    const deps = makeDeps({
      findExistingMember: vi.fn().mockResolvedValue({ id: 1, username: '1234567890123', email: 'other@example.com' }),
    })
    const result = await createRegistrationService(deps).submit(validFullInput)

    expect(result).toEqual({
      ok: false,
      reason: 'conflict',
      message: 'เลขบัตรประชาชนนี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ',
    })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('rejects duplicate email when email is already in members table', async () => {
    const deps = makeDeps({
      findExistingMember: vi.fn().mockResolvedValue({ id: 2, username: '9999999999999', email: 'somchai@example.com' }),
    })
    const result = await createRegistrationService(deps).submit(validFullInput)

    expect(result).toEqual({
      ok: false,
      reason: 'conflict',
      message: 'อีเมลนี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ',
    })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('rejects when there is an existing pending application', async () => {
    const deps = makeDeps({
      findPendingRegistration: vi.fn().mockResolvedValue({ id: 10, citizenId: '1234567890123', email: 'somchai@example.com' }),
    })
    const result = await createRegistrationService(deps).submit(validFullInput)

    expect(result).toEqual({
      ok: false,
      reason: 'conflict',
      message: 'คุณได้ส่งคำขอสมัครไว้แล้ว อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบ',
    })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it.each(['12345678901a3', '123456789012', '12345678901234'])('rejects citizen ID %s (not 13 digits)', async (citizenId) => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({ ...validFullInput, citizenId })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('refuses without saving when the IP rate limit is exceeded', async () => {
    const deps = makeDeps({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 120 }),
    })
    const result = await createRegistrationService(deps).submit(validFullInput)

    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 120 })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('logs the submission with the citizen ID masked to its last 4 digits', async () => {
    const deps = makeDeps()
    await createRegistrationService(deps).submit(validFullInput)

    const logged = JSON.stringify(vi.mocked(deps.log).mock.calls)
    expect(logged).toContain('x-xxxx-xxxxx-01-23')
    expect(logged).not.toContain('1234567890123')
  })

  it('records the submission in the audit trail with the citizen ID masked', async () => {
    const deps = makeDeps()
    await createRegistrationService(deps).submit(validFullInput)

    expect(deps.audit).toHaveBeenCalledOnce()
    const [actionType, targetTable, details] = vi.mocked(deps.audit).mock.calls[0]
    expect(actionType).toBe('CREATE')
    expect(targetTable).toBe('member_registrations')
    expect(details).toContain('x-xxxx-xxxxx-01-23')
  })

  it('requires hosxp user and pass if hasHosxp is true', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({
      ...validFullInput,
      hasHosxp: true,
      hosxpUser: '',
      hosxpPass: '',
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('requires housing location if inHospitalHousing is true', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({
      ...validFullInput,
      inHospitalHousing: true,
      housingLocation: '',
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('requires vehicles list if hasVehicle is true', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({
      ...validFullInput,
      hasVehicle: true,
      vehicles: [],
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('RegistrationService Admin operations', () => {
  it('approves a registration, creates Member record and writes audit', async () => {
    const deps = makeDeps()
    const service = createRegistrationService(deps)
    const result = await service.approve(42, { username: 'admin1', email: 'admin@hospital.com' })

    expect(result).toEqual({ ok: true, data: undefined })
    expect(deps.createMemberFromRegistration).toHaveBeenCalledWith({
      username: '1234567890123',
      email: 'somchai@example.com',
      name: 'นายสมชาย ใจดี',
      department: 'กลุ่มงานการแพทย์',
      position: 'แพทย์',
      role: 'member',
    })
    expect(deps.updateRegistration).toHaveBeenCalledWith(42, {
      status: 'approved',
      approvedBy: 'admin1',
      approvedAt: expect.any(Date),
    })
    expect(deps.audit).toHaveBeenCalledWith(
      'UPDATE',
      'member_registrations',
      expect.stringContaining('อนุมัติคำขอสมัครสมาชิก #42'),
      { username: 'admin1', email: 'admin@hospital.com' }
    )
  })

  it('rejects a registration with reason and writes audit', async () => {
    const deps = makeDeps()
    const service = createRegistrationService(deps)
    const result = await service.reject(42, 'ข้อมูลไม่ตรงกับฐานข้อมูล HR', { username: 'admin1', email: 'admin@hospital.com' })

    expect(result).toEqual({ ok: true, data: undefined })
    expect(deps.updateRegistration).toHaveBeenCalledWith(42, {
      status: 'rejected',
      rejectReason: 'ข้อมูลไม่ตรงกับฐานข้อมูล HR',
    })
    expect(deps.audit).toHaveBeenCalledWith(
      'UPDATE',
      'member_registrations',
      expect.stringContaining('ปฏิเสธคำขอสมัครสมาชิก #42'),
      { username: 'admin1', email: 'admin@hospital.com' }
    )
  })

  it('deletes a registration and writes audit', async () => {
    const deps = makeDeps()
    const service = createRegistrationService(deps)
    const result = await service.delete(42, { username: 'admin1', email: 'admin@hospital.com' })

    expect(result).toEqual({ ok: true, data: undefined })
    expect(deps.deleteRegistration).toHaveBeenCalledWith(42)
    expect(deps.audit).toHaveBeenCalledWith(
      'DELETE',
      'member_registrations',
      expect.stringContaining('ลบคำขอสมัครสมาชิก #42'),
      { username: 'admin1', email: 'admin@hospital.com' }
    )
  })
})
