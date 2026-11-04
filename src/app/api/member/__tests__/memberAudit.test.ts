import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, PUT, DELETE } from '../route'

const mockRequireMemberApi = vi.fn()
const mockQueryMemberDb = vi.fn()
const mockLogAudit = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: (...args: any[]) => mockRequireMemberApi(...args),
}))

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: (...args: any[]) => mockQueryMemberDb(...args),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: (...args: any[]) => mockLogAudit(...args),
  maskAuditIdentifier: (val: string) => val ? `masked_${val}` : val,
}))

describe('Member API Route Handlers - Audit Logging (A09 Compliance)', () => {
  const adminActor = {
    username: 'admin_thoen',
    email: 'admin@thoen.moph.go.th',
    role: 'admin',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireMemberApi.mockResolvedValue({
      member: adminActor,
      error: null,
    })
  })

  describe('POST (Create Member)', () => {
    it('creates new member and records Tier 1 Audit Log', async () => {
      mockQueryMemberDb
        .mockResolvedValueOnce([]) // duplicate check
        .mockResolvedValueOnce({ insertId: 10 }) // insert

      const req = new Request('http://localhost:3000/api/member', {
        method: 'POST',
        body: JSON.stringify({
          username: '1234567890123',
          email: 'nurse_joy@thoen.moph.go.th',
          name: 'Joy Nurse',
          department: 'OPD',
          position: 'Registered Nurse',
          role: 'member',
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      expect(mockLogAudit).toHaveBeenCalledWith(
        'CREATE',
        'members',
        expect.stringContaining('Admin created new member: masked_1234567890123 (role: member, department: OPD)'),
        { username: adminActor.username, email: adminActor.email }
      )
    })
  })

  describe('PUT (Update Member)', () => {
    it('updates member and records Tier 1 Audit Log', async () => {
      mockQueryMemberDb
        .mockResolvedValueOnce([]) // targetUser self check
        .mockResolvedValueOnce([]) // duplicate check
        .mockResolvedValueOnce([{ salary_pass: 'oldhash' }]) // existing salary_pass
        .mockResolvedValueOnce({ affectedRows: 1 }) // update

      const req = new Request('http://localhost:3000/api/member', {
        method: 'PUT',
        body: JSON.stringify({
          id: 42,
          username: 'somchai_doc',
          email: 'somchai@thoen.moph.go.th',
          name: 'Somchai Doc',
          department: 'ER',
          position: 'Physician',
          salary_pass: '********',
          role: 'member',
        }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(200)

      expect(mockLogAudit).toHaveBeenCalledWith(
        'UPDATE',
        'members',
        expect.stringContaining('Admin updated member ID 42 (masked_somchai_doc): role=member'),
        { username: adminActor.username, email: adminActor.email }
      )
    })
  })

  describe('DELETE (Remove Member)', () => {
    it('removes member and records Tier 1 Audit Log', async () => {
      mockQueryMemberDb
        .mockResolvedValueOnce([{ username: 'target_nurse' }]) // query before delete
        .mockResolvedValueOnce({ affectedRows: 1 }) // delete

      const req = new Request('http://localhost:3000/api/member?id=99', {
        method: 'DELETE',
      })

      const res = await DELETE(req)
      expect(res.status).toBe(200)

      expect(mockLogAudit).toHaveBeenCalledWith(
        'DELETE',
        'members',
        expect.stringContaining('Admin deleted member ID 99 (masked_target_nurse)'),
        { username: adminActor.username, email: adminActor.email }
      )
    })
  })
})
