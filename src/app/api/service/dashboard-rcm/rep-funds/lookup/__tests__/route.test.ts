import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmRepFundsService } from '@/lib/clinical/rcmRepFundsService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmRepFundsService', () => ({
  RcmRepFundsService: {
    lookupPatientClaims: vi.fn(),
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

describe('GET /api/service/dashboard-rcm/rep-funds/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array if no query parameters provided', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce({
      username: 'user',
      role: 'staff',
      email: 'user@thoen.go.th',
      aud: 'member',
      iat: 12345,
      exp: 67890,
    })

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds/lookup')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.claims).toEqual([])
  })

  it('returns matching claims when HN is queried', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce({
      username: 'user',
      role: 'staff',
      email: 'user@thoen.go.th',
      aud: 'member',
      iat: 12345,
      exp: 67890,
    })

    vi.mocked(RcmRepFundsService.lookupPatientClaims).mockResolvedValueOnce([
      {
        id: '1',
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
        status: 'paid',
      },
    ])

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/rep-funds/lookup?hn=0142232')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.claims).toHaveLength(1)
    expect(json.claims[0].rep).toBe('691000204')
  })
})
