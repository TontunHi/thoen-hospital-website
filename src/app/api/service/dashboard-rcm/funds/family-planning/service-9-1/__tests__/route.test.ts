import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'

vi.mock('@/lib/memberAuth')
vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('GET /api/service/dashboard-rcm/funds/family-planning/service-9-1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when session is absent', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-1')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when user role is not allowed', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'guest',
      role: 'guest' as any,
      email: 'guest@thoen.go.th',
    } as any)

    const req = new Request('http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-1')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 400 when invalid query parameters are supplied', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staff1',
      role: 'staff',
      email: 'staff@thoen.go.th',
    } as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-1?ds1=invalid-date'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('INVALID_PARAMS')
  })

  it('returns 200 and report data for valid request', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staff1',
      role: 'staff',
      email: 'staff@thoen.go.th',
    } as any)

    const mockData = {
      ds1: '2024-10-01',
      ds2: '2024-10-31',
      format: 'NEW_ECLAIM',
      serviceOnly: false,
      status: 'ALL',
      cardFilter: 'ALL',
      searchField: 'ALL',
      search: '',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      summary: {
        totalVisits: 10,
        uniquePatients: 8,
        serviceOnlyCount: 7,
        compensatedVisits: 5,
        uncompensatedVisits: 5,
        compensationRate: 50,
        totalCompensated: 1250,
        averageCompensated: 250,
        errorCount: 1,
        authenCount: 9,
        noAuthenCount: 1,
        withDxCount: 9,
        withDrugCount: 8,
        totalIncome: 3500,
      },
      adpMapping: {
        isMapped: true,
        mappedCount: 6,
        format: 'NEW_ECLAIM',
        items: [],
      },
      statusOptions: ['-::ยังไม่ได้ส่ง', 'NHSO :: มี Invoice แล้ว'],
      errorOptions: ['ใส่ห่วง แต่ไม่พบหัตถการ'],
      totalCount: 10,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      items: [],
    }

    vi.spyOn(RcmFamilyPlanningService, 'getFamilyPlanningReport').mockResolvedValue(mockData as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/family-planning/service-9-1?ds1=2024-10-01&ds2=2024-10-31&format=NEW_ECLAIM'
    )
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.summary.totalVisits).toBe(10)
    expect(json.data.summary.totalCompensated).toBe(1250)
  })
})
