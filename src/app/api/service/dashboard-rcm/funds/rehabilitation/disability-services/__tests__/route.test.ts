import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getDisabilityServices } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmRehabilitationService } from '@/lib/clinical/rcmRehabilitationService'

vi.mock('@/lib/memberAuth')
vi.mock('@/lib/clinical/rcmRehabilitationService')
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

describe('Rehabilitation Disability Services API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/rehabilitation/disability-services'
    )
    const res = await getDisabilityServices(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when user does not have permission', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'guest',
      role: 'guest',
    } as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/rehabilitation/disability-services'
    )
    const res = await getDisabilityServices(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('returns report data successfully for authorized user', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staff01',
      role: 'staff',
    } as any)

    const mockResult = {
      categoryTitle: 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์',
      subtopicTitle: 'รายการการให้บริการฟื้นฟูสมรรถภาพ',
      reportTitle: 'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability',
      ds1: '2026-10-01',
      ds2: '2027-09-30',
      totalCount: 1,
      items: [],
      summary: { totalCases: 1 },
    }

    vi.mocked(RcmRehabilitationService.getDisabilityServicesReport).mockResolvedValue(
      mockResult as any
    )

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/rehabilitation/disability-services?ds1=2026-10-01&ds2=2027-09-30&cardFilter=ALL'
    )
    const res = await getDisabilityServices(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.reportTitle).toBe(
      'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability'
    )
  })

  it('returns 400 for invalid query parameters', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staff01',
      role: 'staff',
    } as any)

    const req = new Request(
      'http://localhost/api/service/dashboard-rcm/funds/rehabilitation/disability-services?ds1=invalid-date'
    )
    const res = await getDisabilityServices(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('INVALID_PARAMS')
  })
})
