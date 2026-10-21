import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as memberAuth from '@/lib/memberAuth'

describe('GET /api/budget/rh1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/budget/rh1')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns executive summary by default when authenticated', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
    } as any)

    const request = new Request('http://localhost:3000/api/budget/rh1?year=2569')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.summary).toBeDefined()
    expect(json.data.summary.hospital.c).toBe(11152)
  })

  it('returns available fiscal years when view=years', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
    } as any)

    const request = new Request('http://localhost:3000/api/budget/rh1?view=years')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.years).toContain('2570')
    expect(json.data.years).toContain('2569')
  })

  it('returns L1 overview when view=l1', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      username: 'staff01',
      role: 'staff',
    } as any)

    const request = new Request('http://localhost:3000/api/budget/rh1?view=l1&year=2569')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.l1)).toBe(true)
    expect(json.data.l1.length).toBeGreaterThan(0)
  })
})
