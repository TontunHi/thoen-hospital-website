import { describe, it, expect, vi, beforeEach } from 'vitest'

// 1. Mock dependencies
const mockVerifyMemberSession = vi.fn()
const mockCheckPositionPermission = vi.fn()
const mockFetchAppointmentMismatches = vi.fn()
const mockQuerySalaryEditDb = vi.fn()
const mockLogThrottledAudit = vi.fn()
const mockLogAudit = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => mockVerifyMemberSession(),
  checkPositionPermission: (...args: any[]) => mockCheckPositionPermission(...args),
}))

vi.mock('@/lib/clinicalDb', () => ({
  fetchAppointmentMismatches: () => mockFetchAppointmentMismatches(),
}))

vi.mock('@/lib/salaryDb', () => ({
  querySalaryEditDb: (...args: any[]) => mockQuerySalaryEditDb(...args),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: (...args: any[]) => mockLogThrottledAudit(...args),
  logAudit: (...args: any[]) => mockLogAudit(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('API Routes Integration Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/appointment-mismatch', () => {
    it('returns 401 if unauthenticated', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/service/appointment-mismatch/route')
      const res = await GET()
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.success).toBe(false)
    })

    it('returns 403 for subdistrict role', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'sub_user',
        email: 'sub@thoen.moph.go.th',
        role: 'subdistrict',
        aud: 'member',
        iat: 12345,
        exp: 67890,
      })
      const { GET } = await import('@/app/api/service/appointment-mismatch/route')
      const res = await GET()
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.success).toBe(false)
    })

    it('returns 200 with mismatch data for authorized staff', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'nurse_user',
        email: 'nurse@thoen.moph.go.th',
        role: 'nurse',
        aud: 'member',
        iat: 12345,
        exp: 67890,
      })
      mockLogThrottledAudit.mockResolvedValueOnce(true)
      mockFetchAppointmentMismatches.mockResolvedValueOnce([
        {
          hn: '123456',
          department: 'คลินิกเบาหวาน',
          vstdate: '2026-09-24',
          nextdate: '2026-10-01',
          appUser: 'doctor_smith',
        },
      ])

      const { GET } = await import('@/app/api/service/appointment-mismatch/route')
      const res = await GET()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.totalMismatches).toBe(1)
      expect(json.data.mismatches[0].hn).toBe('123456')
    })
  })

  describe('GET & DELETE /api/salary/batch-delete', () => {
    it('returns 401 if not logged in', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/salary/batch-delete/route')
      const req = new Request('http://localhost:3000/api/salary/batch-delete?type=salary')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })

    it('returns 403 if user lacks upload_salary permission', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'staff_no_perm',
        email: 'staff@thoen.moph.go.th',
        role: 'member',
        aud: 'member',
        iat: 12345,
        exp: 67890,
      })
      mockCheckPositionPermission.mockResolvedValueOnce(false)

      const { GET } = await import('@/app/api/salary/batch-delete/route')
      const req = new Request('http://localhost:3000/api/salary/batch-delete?type=salary')
      const res = await GET(req)
      expect(res.status).toBe(403)
    })

    it('allows admin to query latest batch info', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin_user',
        email: 'admin@thoen.moph.go.th',
        role: 'admin',
        aud: 'member',
        iat: 12345,
        exp: 67890,
      })
      mockQuerySalaryEditDb
        .mockResolvedValueOnce([{ latest_date: '2026-09-01', raw_c1: '2026-09-01' }])
        .mockResolvedValueOnce([{ total_count: 45 }])

      const { GET } = await import('@/app/api/salary/batch-delete/route')
      const req = new Request('http://localhost:3000/api/salary/batch-delete?type=salary')
      const res = await GET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.latestBatch.date).toBe('2026-09-01')
      expect(json.latestBatch.count).toBe(45)
    })

    it('allows authorized finance user to delete batch successfully', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'finance_officer',
        email: 'finance@thoen.moph.go.th',
        role: 'member',
        aud: 'member',
        iat: 12345,
        exp: 67890,
      })
      mockCheckPositionPermission.mockResolvedValueOnce(true)
      mockLogAudit.mockResolvedValueOnce(undefined)
      // Check latest row match
      mockQuerySalaryEditDb
        .mockResolvedValueOnce([{ latest_date: '2026-09-01', raw_c1: '2026-09-01' }])
        // Count to delete (total_count)
        .mockResolvedValueOnce([{ total_count: 10 }])
        // Execution result
        .mockResolvedValueOnce({ affectedRows: 10 })

      const { DELETE } = await import('@/app/api/salary/batch-delete/route')
      const req = new Request('http://localhost:3000/api/salary/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'salary', confirmedDate: '2026-09-01' }),
      })
      const res = await DELETE(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.deletedCount).toBe(10)
    })
  })
})
