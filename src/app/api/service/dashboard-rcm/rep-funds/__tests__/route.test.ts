import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmRepFundsService } from '@/lib/clinical/rcmRepFundsService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmRepFundsService', () => ({
  RcmRepFundsService: {
    getRepFundsSummary: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('GET /api/service/dashboard-rcm/rep-funds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if not logged in', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('returns 403 if user role is not allowed', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce({
      username: 'guest',
      role: 'guest' as any,
      email: 'guest@thoen.go.th',
      aud: 'member',
      iat: 12345,
      exp: 67890,
    })

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
  })

  it('returns summary data for authorized staff', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce({
      username: 'nurse_somjai',
      role: 'staff',
      email: 'somjai@thoen.go.th',
      aud: 'member',
      iat: 12345,
      exp: 67890,
    })

    vi.mocked(RcmRepFundsService.getRepFundsSummary).mockResolvedValueOnce({
      metrics: {
        totalCases: 100,
        totalReps: 5,
        totalIncome: 100000,
        totalCompensated: 95000,
        rate: '95.0',
        totalDiff: -5000,
        pendingAppeals: 2,
        errorCount: 1,
      },
      fundGroups: [],
      repList: [],
      availableYears: ['2570', '2569'],
      availableFunds: [],
    })

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds?fiscalYear=2570')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.metrics.totalCases).toBe(100)
    expect(RcmRepFundsService.getRepFundsSummary).toHaveBeenCalledWith({
      fiscalYear: '2570',
      department: 'ALL',
      fund: undefined,
      subFund: undefined,
      search: undefined,
    })
  })
})
