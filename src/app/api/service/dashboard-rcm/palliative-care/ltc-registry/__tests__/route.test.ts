import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
  fetchAuthenticatedMember: vi.fn(),
}))

vi.mock('@/lib/clinical/ltcRegistryService', () => ({
  LtcRegistryService: {
    listRegistries: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'

describe('LTC Registry API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(LtcRegistryService.listRegistries).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 1,
      availableAreaZones: [],
      stats: { total: 0, avgAdl: 0, zoneCounts: {} },
    })
  })

  it('GET returns 401 when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)
    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/ltc-registry')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('GET returns 403 when member lacks LTC permissions', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'user1',
      role: 'member',
      email: 'user1@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn().mockReturnValue(false),
    } as any)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/ltc-registry')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('GET returns permissions object for view_ltc_registry and edit_ltc_registry', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'editor_ltc',
      role: 'member',
      email: 'editor_ltc@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      username: 'editor_ltc',
      role: 'member',
      email: 'editor_ltc@hospital.local',
      can: vi.fn((perms: string | string[]) => {
        const list = Array.isArray(perms) ? perms : [perms]
        return list.includes('edit_ltc_registry')
      }),
    } as any)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/ltc-registry')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.permissions).toEqual({
      canView: true,
      canEdit: true,
      canManage: false,
    })
  })
})
