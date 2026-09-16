import { describe, it, expect, beforeEach } from 'vitest'
import { createToken, verifyToken } from '../memberAuth'
import { createSalaryToken, verifySalaryToken } from '../salaryAuth'

describe('Member & Salary Authentication & JWT Audience', () => {
  beforeEach(() => {
    process.env.MEMBER_SESSION_SECRET = 'test-member-secret-at-least-32-chars-long!!'
    process.env.SALARY_SESSION_SECRET = 'test-salary-secret-at-least-32-chars-long!!'
  })

  it('creates and verifies a valid member token', () => {
    const token = createToken({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
    })

    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.username).toBe('1234567890123')
    expect(payload?.email).toBe('doctor@hospital.go.th')
    expect(payload?.role).toBe('doctor')
  })

  it('rejects member token with invalid signature', () => {
    const token = createToken({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
    })

    const tampered = token.slice(0, -4) + 'abcd'
    expect(verifyToken(tampered)).toBeNull()
  })

  it('rejects member token when presented to salary verification (audience isolation)', () => {
    const memberToken = createToken({
      username: '1234567890123',
      email: 'doctor@hospital.go.th',
      role: 'doctor',
    })

    // salary verification must reject member token because aud is 'member', not 'salary'
    expect(verifySalaryToken(memberToken)).toBeNull()
  })

  it('rejects salary token when presented to member verification (audience isolation)', () => {
    const salaryToken = createSalaryToken({
      username: '1234567890123',
      name: 'Dr. Somchai',
    })

    // member verification must reject salary token because aud is 'salary', not 'member'
    expect(verifyToken(salaryToken)).toBeNull()
  })

  it('creates and verifies a valid salary token', () => {
    const salaryToken = createSalaryToken({
      username: '1234567890123',
      name: 'Dr. Somchai',
    })

    const payload = verifySalaryToken(salaryToken)
    expect(payload).not.toBeNull()
    expect(payload?.username).toBe('1234567890123')
    expect(payload?.name).toBe('Dr. Somchai')
  })
})
