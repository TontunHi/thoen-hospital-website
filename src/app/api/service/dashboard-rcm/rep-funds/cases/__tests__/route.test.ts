import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmRepFundsService } from '@/lib/clinical/rcmRepFundsService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmRepFundsService', () => ({
  RcmRepFundsService: {
    getRepCases: vi.fn(),
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

describe('GET /api/service/dashboard-rcm/rep-funds/cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if unauthorized', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(null)
    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds/cases?rep=691000204')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns patient cases for given Rep', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce({
      username: 'audit_officer',
      role: 'admin',
      email: 'audit@thoen.go.th',
      aud: 'member',
      iat: 12345,
      exp: 67890,
    })

    vi.mocked(RcmRepFundsService.getRepCases).mockResolvedValueOnce([
      {
        id: '832703707',
        rep: '691000204',
        hn: '0142232',
        maskedHn: 'xx-xxx32',
        ptName: 'นาย กฤษฎา สาริวงค์',
        serviceDate: '2026-10-25',
        serviceDateThai: '25 ต.ค. 2569',
        department: 'IP',
        departmentLabel: 'ผู้ป่วยใน (IPD)',
        mainInscl: 'OFC',
        fund: 'IPCS,OTCS',
        fundLabel: 'ข้าราชการ (IPCS,OTCS)',
        subFund: '-',
        subFundLabel: '-',
        income: 3090,
        compensated: 3621.62,
        diff: 531.62,
        percentPay: 117,
        appeal: 'N',
        status: 'paid',
      },
    ])

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds/cases?rep=691000204')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.count).toBe(1)
    expect(json.cases[0].ptName).toBe('นาย กฤษฎา สาริวงค์')
    expect(json.cases[0].compensated).toBe(3621.62)
  })
})
