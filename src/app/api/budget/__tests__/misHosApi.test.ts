import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../mishos/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { MisHosService } from '@/lib/budget/misHosService'
import { logAudit } from '@/lib/audit'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/budget/misHosService', () => ({
  MisHosService: {
    getTableData: vi.fn(),
    getTemplateConfig: vi.fn(),
    getHospitalInfo: vi.fn(),
  },
  MIS_HOS_MENU_CATEGORIES: [{ id: '0', title: 'การโอนเงิน', submenus: [] }],
  THOEN_HOSPITAL_CODE: '11152',
}))

describe('POST /api/budget/mishos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when member session is not authenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const req = new NextRequest('http://localhost:3000/api/budget/mishos', {
      method: 'POST',
      body: JSON.stringify({ action: 'getTableData', ssid: '1825' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns categories when action is getCategories', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: 1,
      name: 'Test Member',
      role: 'MEMBER',
      citizenId: '1234567890123',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/budget/mishos', {
      method: 'POST',
      body: JSON.stringify({ action: 'getCategories' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
  })

  it('delegates to MisHosService.getTableData and logs audit', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: 1,
      name: 'Test Member',
      role: 'MEMBER',
      citizenId: '1234567890123',
    } as any)

    vi.mocked(MisHosService.getTableData).mockResolvedValue({
      ssid: '1825',
      records: [{ YEAR: '2567', BUDGET_UC: '120.02' }],
      source: 'upstream',
      fetchedAt: new Date().toISOString(),
    })

    const req = new NextRequest('http://localhost:3000/api/budget/mishos', {
      method: 'POST',
      body: JSON.stringify({
        action: 'getTableData',
        ssid: '1825',
        hcode: '11152',
        year: '2567',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.records.length).toBe(1)
    expect(logAudit).toHaveBeenCalledWith(
      'READ',
      'budget_mishos',
      expect.stringContaining('ssid=1825'),
      expect.anything()
    )
  })
})
