import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getIpdDepartmentAdjrw: vi.fn(),
  },
}))

describe('GET /api/service/dashboard-rcm/ipd-dept-adjrw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/ipd-dept-adjrw')
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
      email: 'guest@example.com',
    } as any)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/ipd-dept-adjrw')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Forbidden')
  })

  it('returns 200 and department AdjRW data when authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
      email: 'staff@thoenhospital.com',
    } as any)

    const mockData = [
      {
        month: 'ต.ค.-67',
        medicine: 120.45,
        surgery: 45.12,
        obgyn: 12.3,
        pediatrics: 30.15,
        orthopedics: 18.22,
        ent: 5.1,
        eye: 3.4,
        other: 1.2,
        dental: 0.5,
        psychiatry: 2.1,
        total: 238.54,
      },
    ]

    vi.mocked(RcmDashboardService.getIpdDepartmentAdjrw).mockResolvedValue(mockData)

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/ipd-dept-adjrw?ds1=2024-10-01&ds2=2025-09-30')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.count).toBe(1)
    expect(json.data).toEqual(mockData)
    expect(RcmDashboardService.getIpdDepartmentAdjrw).toHaveBeenCalledWith({
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

    vi.mocked(RcmDashboardService.getIpdDepartmentAdjrw).mockRejectedValue(new Error('DB failure'))

    const request = new Request('http://localhost:3000/api/service/dashboard-rcm/ipd-dept-adjrw')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toContain('เกิดข้อผิดพลาดในการดึงข้อมูล SumAdjRW แยกรายแผนก')
  })
})
