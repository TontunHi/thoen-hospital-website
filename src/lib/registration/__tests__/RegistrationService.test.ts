import { describe, it, expect, vi } from 'vitest'
import { createRegistrationService, type RegistrationDeps } from '../RegistrationService'

function makeDeps(overrides: Partial<RegistrationDeps> = {}) {
  const deps: RegistrationDeps = {
    createRegistration: vi.fn().mockResolvedValue({ id: 42 }),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
    log: vi.fn(),
    ...overrides,
  }
  return deps
}

const validInput = {
  citizenId: ' 1234567890123 ',
  firstNameTh: ' สมชาย ',
  lastNameTh: ' ใจดี ',
  email: ' somchai@example.com ',
}

describe('RegistrationService.submit', () => {
  it('saves a trimmed pending registration and returns its id', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit(validInput)

    expect(result).toEqual({ ok: true, id: 42 })
    expect(deps.createRegistration).toHaveBeenCalledWith({
      citizenId: '1234567890123',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ใจดี',
      email: 'somchai@example.com',
    })
  })

  it.each(['12345678901a3', '123456789012', '12345678901234'])('rejects citizen ID %s (not 13 digits) without saving', async (citizenId) => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({ ...validInput, citizenId })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('refuses without saving when the IP rate limit is exceeded', async () => {
    const deps = makeDeps({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 120 }),
    })
    const result = await createRegistrationService(deps).submit(validInput)

    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 120 })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('logs the submission with the citizen ID masked to its last 4 digits', async () => {
    const deps = makeDeps()
    await createRegistrationService(deps).submit(validInput)

    const logged = JSON.stringify(vi.mocked(deps.log).mock.calls)
    expect(logged).toContain('x-xxxx-xxxxx-01-23')
    expect(logged).not.toContain('1234567890123')
  })

  it('rejects an invalid email without saving', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({ ...validInput, email: 'not-an-email' })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it.each(['firstNameTh', 'lastNameTh'])('rejects a blank %s without saving', async (field) => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({ ...validInput, [field]: '   ' })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it.each(['firstNameTh', 'lastNameTh'])('rejects a %s longer than 100 characters without saving', async (field) => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({ ...validInput, [field]: 'ก'.repeat(101) })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it('rejects an email longer than 100 characters without saving', async () => {
    const deps = makeDeps()
    const result = await createRegistrationService(deps).submit({ ...validInput, email: `${'a'.repeat(95)}@x.com` })

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })

  it.each([
    ['citizenId', 'กรุณากรอกเลขบัตรประชาชน'],
    ['firstNameTh', 'กรุณากรอกชื่อภาษาไทย'],
    ['lastNameTh', 'กรุณากรอกนามสกุลภาษาไทย'],
    ['email', 'กรุณากรอกอีเมล'],
  ])('rejects a request missing %s with a Thai message naming it', async (field, message) => {
    const deps = makeDeps()
    const input: Record<string, string> = { ...validInput }
    delete input[field]
    const result = await createRegistrationService(deps).submit(input)

    expect(result).toEqual({ ok: false, reason: 'invalid', message })
    expect(deps.createRegistration).not.toHaveBeenCalled()
  })
})
