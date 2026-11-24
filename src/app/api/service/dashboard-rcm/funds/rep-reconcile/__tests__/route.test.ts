import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getReconcile } from '../route'
import { GET as getVnDetails } from '../vn-details/route'
import * as memberAuth from '@/lib/memberAuth'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import { RcmFundsRepReconcileService } from '@/lib/clinical/rcmFundsRepReconcileService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/clinical/rcmFundsRepReconcileService', () => ({
  RcmFundsRepReconcileService: {
    getReconcileReport: vi.fn(),
    getVnReconcileDetails: vi.fn(),
  },
}))

describe('Funds REP Reconcile API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/dashboard-rcm/funds/rep-reconcile', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)
      const res = await getReconcile(
        new Request('http://localhost/api/service/dashboard-rcm/funds/rep-reconcile')
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 for unauthorized role', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'guest',
        role: 'guest',
        email: 'guest@thoen.hospital',
      } as any)
      const res = await getReconcile(
        new Request('http://localhost/api/service/dashboard-rcm/funds/rep-reconcile')
      )
      expect(res.status).toBe(403)
    })

    it('returns 400 when ds1 date format is invalid', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
      } as any)
      const res = await getReconcile(
        new Request('http://localhost/api/service/dashboard-rcm/funds/rep-reconcile?ds1=invalid-date')
      )
      expect(res.status).toBe(400)
    })

    it('returns 200 and parses funds, sources, repPrefixes cleanly', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
      } as any)
      vi.mocked(RcmFundsRepReconcileService.getReconcileReport).mockResolvedValue({
        range: { startDate: '2026-10-01', endDate: '2026-10-31' },
        summary: {} as any,
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        availableFundCatalog: [],
        availableRepPrefixes: ['DCCS'],
      })

      const res = await getReconcile(
        new Request(
          'http://localhost/api/service/dashboard-rcm/funds/rep-reconcile?ds1=2026-10-01&ds2=2026-10-31&funds=ccs,anc&sources=seamless,repdata&repPrefixes=DCCS'
        )
      )
      expect(res.status).toBe(200)
      expect(RcmFundsRepReconcileService.getReconcileReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          fundIds: ['ccs', 'anc'],
          sources: ['seamless', 'repdata'],
          repPrefixes: ['DCCS'],
          page: 1,
          pageSize: 50,
        })
      )
    })

    it('returns 503 when GatewayUnavailableError is thrown', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
      } as any)
      vi.mocked(RcmFundsRepReconcileService.getReconcileReport).mockRejectedValue(
        new GatewayUnavailableError('Gateway offline')
      )

      const res = await getReconcile(
        new Request('http://localhost/api/service/dashboard-rcm/funds/rep-reconcile')
      )
      expect(res.status).toBe(503)
    })
  })

  describe('GET /api/service/dashboard-rcm/funds/rep-reconcile/vn-details', () => {
    it('returns 400 when vn parameter is missing or invalid', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
      } as any)
      const res = await getVnDetails(
        new Request('http://localhost/api/service/dashboard-rcm/funds/rep-reconcile/vn-details')
      )
      expect(res.status).toBe(400)
    })

    it('returns 200 with visit details when found', async () => {
      vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
        username: 'staff',
        role: 'staff',
        email: 'staff@thoen.hospital',
      } as any)
      vi.mocked(RcmFundsRepReconcileService.getVnReconcileDetails).mockResolvedValue({
        visitKey: '6901010002',
        vn: '6901010002',
        an: null,
        hn: '000002',
        cid: '1100000000002',
        ptname: 'นาย ทดสอบ',
        admdate: '2026-10-16',
        admdateThai: '16 ต.ค. 2569',
        department: 'OP',
        pttypeName: 'UCS',
        pdx: 'I251',
        dxList: ['I251'],
        adpItems: [],
        allRepLines: [],
      })

      const res = await getVnDetails(
        new Request('http://localhost/api/service/dashboard-rcm/funds/rep-reconcile/vn-details?vn=6901010002')
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.visitKey).toBe('6901010002')
    })
  })
})
