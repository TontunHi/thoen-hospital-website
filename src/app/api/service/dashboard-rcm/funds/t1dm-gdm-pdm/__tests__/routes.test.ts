import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getRecipients } from '../service-recipients/route'
import { GET as getVnDetails } from '../vn-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmT1dmGdmPdmService } from '@/lib/clinical/rcmT1dmGdmPdmService'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/memberAuth')
vi.mock('@/lib/clinical/rcmT1dmGdmPdmService')
vi.mock('@/lib/clinical/rcmDashboardService')
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

describe('T1DM/GDM/PDM API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /service-recipients', () => {
    it('returns 401 when user is not authenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients')
      const res = await getRecipients(req)
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

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients')
      const res = await getRecipients(req)
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

      const mockReport = {
        categoryTitle: 'กองทุน T1DM/GDM/PDM',
        reportTitle: 'รายชื่อผู้รับบริการ',
        items: [],
        totalCount: 0,
      }
      vi.mocked(RcmT1dmGdmPdmService.getRecipientsReport).mockResolvedValue(mockReport as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients?cardFilter=ALL'
      )
      const res = await getRecipients(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.categoryTitle).toBe('กองทุน T1DM/GDM/PDM')
    })
  })

  describe('GET /vn-details', () => {
    it('returns 400 when VN is invalid or missing', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff01',
        role: 'staff',
      } as any)

      const req = new Request('http://localhost/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/vn-details?vn=')
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_VN')
    })

    it('returns clinical details for valid VN', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff01',
        role: 'staff',
      } as any)

      vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue({
        vn: '691001123456',
        hn: '0012345',
      } as any)

      const req = new Request(
        'http://localhost/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/vn-details?vn=691001123456'
      )
      const res = await getVnDetails(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.vn).toBe('691001123456')
    })
  })
})
