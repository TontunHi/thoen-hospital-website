import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmAmedHomewardService } from '@/lib/clinical/rcmAmedHomewardService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/clinical/rcmAmedHomewardService', () => ({
  RcmAmedHomewardService: {
    getHomewardReport: vi.fn(),
  },
}))

describe('GET /api/service/dashboard-rcm/funds/amed-homeward/homeward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/service/dashboard-rcm/funds/amed-homeward/homeward'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when role is not authorized', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'user',
      role: 'guest',
      email: 'guest@hospital.com',
      displayName: 'Guest',
    } as any)
    const res = await GET(new Request('http://localhost/api/service/dashboard-rcm/funds/amed-homeward/homeward'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns report data when session is valid', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff',
      role: 'staff',
      email: 'staff@thoen.hospital',
      displayName: 'Staff',
    } as any)

    vi.mocked(RcmAmedHomewardService.getHomewardReport).mockResolvedValue({
      ds1: '2026-10-01',
      ds2: '2027-09-30',
      cardFilter: 'ALL',
      search: '',
      sortBy: 'dchdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
      totalCount: 1,
      totalPages: 1,
      summary: {
        totalCases: 1,
        onAmedCases: 1,
        notOnAmedCases: 0,
        withAuthenCases: 1,
        noAuthenCases: 0,
        withRepCases: 1,
        noRepCases: 0,
        withDebitCases: 1,
        totalIncome: 10000,
        totalDebit: 10000,
        totalAdjrw: 1.25,
        avgLos: 4,
      },
      items: [],
    })

    const res = await GET(
      new Request('http://localhost/api/service/dashboard-rcm/funds/amed-homeward/homeward?ds1=2026-10-01&ds2=2027-09-30')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalCases).toBe(1)
  })
})
