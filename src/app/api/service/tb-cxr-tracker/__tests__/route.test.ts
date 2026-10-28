import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    clinical: {
      getTbCxrTracker: vi.fn(),
    },
  },
}))

describe('GET /api/service/tb-cxr-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/service/tb-cxr-tracker')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error).toContain('กรุณาเข้าสู่ระบบ')
  })

  it('returns 200 with data and summary when authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      name: 'ทดสอบ ผู้ใช้',
      cid: '1234567890123',
      role: 'staff',
    } as any)

    const mockResult = {
      success: true,
      count: 2,
      summary: {
        total: 2,
        doneCount: 1,
        missingCount: 1,
        coveragePercentage: 50.0,
        statusBreakdown: { 'รพ.เถิน': 2 },
      },
      data: [
        {
          id: 1,
          hn: '0000001',
          fname: 'สมศรี',
          lname: 'ใจดี',
          cxr_status: 'DONE',
          cxr_date: '20261015',
          status: 'รพ.เถิน',
        },
        {
          id: 2,
          hn: '0000002',
          fname: 'สมชาย',
          lname: 'กล้าหาญ',
          cxr_status: 'MISSING',
          cxr_date: null,
          status: 'รพ.เถิน',
        },
      ],
    }

    vi.mocked(apiGateway.clinical.getTbCxrTracker).mockResolvedValue(mockResult)

    const request = new Request('http://localhost:3000/api/service/tb-cxr-tracker?status=all&hospcode=รพ.เถิน')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.count).toBe(2)
    expect(json.summary.coveragePercentage).toBe(50.0)
    expect(apiGateway.clinical.getTbCxrTracker).toHaveBeenCalledWith({
      status: 'all',
      hospcode: 'รพ.เถิน',
      search: undefined,
      startDate: undefined,
    })
  })

  it('returns 200 and allows access for subdistrict role user', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 99,
      name: 'เจ้าหน้าที่ รพ.สต.',
      cid: '9876543210987',
      role: 'subdistrict',
    } as any)

    vi.mocked(apiGateway.clinical.getTbCxrTracker).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/service/tb-cxr-tracker')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.clinical.getTbCxrTracker).toHaveBeenCalled()
  })
})
