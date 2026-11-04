import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/palliativeRegistryService', () => ({
  PalliativeRegistryService: {
    lookupPatientByHn: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'

describe('GET /api/service/dashboard-rcm/palliative-care/registry/lookup-hn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/lookup-hn?hn=0000206')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('returns 400 when hn is missing', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff',
      role: 'staff',
    } as any)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/lookup-hn')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns 404 when patient is not found', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff',
      role: 'staff',
    } as any)
    vi.mocked(PalliativeRegistryService.lookupPatientByHn).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/lookup-hn?hn=9999999')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })

  it('returns 200 and patient data when found', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff',
      role: 'staff',
    } as any)

    const mockPatient = {
      hn: '0000206',
      an: '670005964',
      patientName: 'นางจันทนา ตันมา',
      address: '205/1 ม.04 ต.เถินบุรี',
      phone: '0801209257',
      death: 'N',
      deathDate: null,
      isRegistered: true,
      registeredDate: '2026-11-02',
      icd10Principal: 'C541',
    }

    vi.mocked(PalliativeRegistryService.lookupPatientByHn).mockResolvedValue(mockPatient)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/lookup-hn?hn=0000206')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.patientName).toBe('นางจันทนา ตันมา')
    expect(json.data.isRegistered).toBe(true)
    expect(json.data.icd10Principal).toBe('C541')
    expect(json.data.registeredDate).toBe('2026-11-02')
  })
})
