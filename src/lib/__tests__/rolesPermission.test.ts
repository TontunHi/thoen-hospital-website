import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requirePermission } from '../roles'
import * as memberAuth from '../memberAuth'

vi.mock('../memberAuth', () => ({
  verifyMemberSession: vi.fn(),
  checkPositionPermission: vi.fn(),
}))

describe('roles - requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValueOnce(null)

    const result = await requirePermission('upload_salary')
    expect(result.error).toBeDefined()
    expect(result.session).toBeUndefined()
  })

  it('allows admin regardless of specific permission', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValueOnce({
      username: 'superadmin',
      email: 'admin@thoen.moph.go.th',
      role: 'admin',
      aud: 'member',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })

    const result = await requirePermission('upload_salary')
    expect(result.error).toBeUndefined()
    expect(result.session?.role).toBe('admin')
  })

  it('allows user if they have granted position permission', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValueOnce({
      username: 'finance_officer',
      email: 'finance@thoen.moph.go.th',
      role: 'member' as any,
      aud: 'member',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    vi.mocked(memberAuth.checkPositionPermission).mockResolvedValueOnce(true)

    const result = await requirePermission('upload_salary')
    expect(result.error).toBeUndefined()
    expect(result.session?.username).toBe('finance_officer')
  })

  it('denies user if position permission is not granted', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValueOnce({
      username: 'general_member',
      email: 'member@thoen.moph.go.th',
      role: 'member' as any,
      aud: 'member',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    vi.mocked(memberAuth.checkPositionPermission).mockResolvedValueOnce(false)

    const result = await requirePermission('upload_salary')
    expect(result.error).toBeDefined()
  })
})
