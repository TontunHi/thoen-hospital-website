import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmDashboardService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/clinical/rcmDashboardService')>()
  return {
    ...actual,
    RcmDashboardService: {
      ...actual.RcmDashboardService,
      getOpdDepartmentSummary: vi.fn(),
    },
  }
})

describe('GET /api/service/dashboard-rcm/opd-dept-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/opd-dept-summary')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Unauthorized')
  })

  it('returns 403 when user role is not permitted', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'guest_user',
      role: 'guest',
      email: 'guest@thoenhospital.com',
    } as any)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/opd-dept-summary')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Forbidden')
  })

  it('returns 200 and OPD department summary data when authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
      email: 'staff@thoenhospital.com',
    } as any)

    const mockData = [
      { dept_group: '01. อายุรกรรม', patients: 1250, visits: 2400 },
      { dept_group: 'รวมทั้งหมด', patients: 1250, visits: 2400 },
    ]

    vi.mocked(RcmDashboardService.getOpdDepartmentSummary).mockResolvedValue(mockData)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/opd-dept-summary?ds1=2024-10-01&ds2=2025-09-30')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.count).toBe(2)
    expect(json.data).toEqual(mockData)
    expect(RcmDashboardService.getOpdDepartmentSummary).toHaveBeenCalledWith({
      ds1: '2024-10-01',
      ds2: '2025-09-30',
    })
  })

  it('returns 500 when service throws an error', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'admin01',
      role: 'admin',
      email: 'admin@thoenhospital.com',
    } as any)

    vi.mocked(RcmDashboardService.getOpdDepartmentSummary).mockRejectedValue(new Error('DB failure'))

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/opd-dept-summary')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toContain('เกิดข้อผิดพลาดในการดึงข้อมูล')
  })
})
