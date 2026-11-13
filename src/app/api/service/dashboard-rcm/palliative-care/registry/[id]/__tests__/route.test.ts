import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/memberAuth', () => ({
  getAuthenticatedMember: vi.fn(),
}))

vi.mock('@/lib/clinical/palliativeRegistryService', () => ({
  PalliativeRegistryService: {
    getRegistryById: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

import { getAuthenticatedMember } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'

describe('Palliative Registry [id] API Route GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when unauthenticated', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue(null as any)
    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('GET returns 403 when member lacks palliative registry permissions', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn().mockReturnValue(false),
    } as any)
    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('GET returns 200 when member has view_palliative_registry permission', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      username: 'viewer_pc',
      role: 'member',
      email: 'viewer_pc@hospital.local',
      can: vi.fn((perms: string | string[]) => {
        const list = Array.isArray(perms) ? perms : [perms]
        return list.includes('view_palliative_registry')
      }),
    } as any)
    vi.mocked(PalliativeRegistryService.getRegistryById).mockResolvedValue({
      id: 1,
      hn: '000206',
      patientName: 'ผู้ป่วย ทดสอบ',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(1)
  })
})
