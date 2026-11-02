import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/memberAuth', () => ({
  getAuthenticatedMember: vi.fn(),
}))

vi.mock('@/lib/clinical/palliativeRegistryService', () => ({
  PalliativeRegistryService: {
    listRegistries: vi.fn(),
    createRegistry: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

import { getAuthenticatedMember } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'

describe('Palliative Care Registry API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when unauthenticated', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue(null)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('GET returns 403 when user has no permission', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'guest',
      can: vi.fn().mockReturnValue(false),
    } as any)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
  })

  it('GET returns data and permissions for authorized user', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue({
      isAdmin: true,
      username: 'admin',
      role: 'admin',
      email: 'admin@thoen.moph.go.th',
      can: vi.fn().mockReturnValue(true),
    } as any)

    vi.mocked(PalliativeRegistryService.listRegistries).mockResolvedValue({
      items: [
        {
          id: 1,
          hn: '000206',
          patientName: 'นางจันทนา ตันมา',
        } as any,
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      stats: {
        total: 1,
        registered: 1,
        pendingRegistration: 0,
        claimed: 0,
        paid: 0,
        deny: 0,
      },
    })

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry?search=000206')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.permissions.canEdit).toBe(true)
    expect(json.items).toHaveLength(1)
  })

  it('POST returns 400 on invalid input', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue({
      isAdmin: true,
      can: vi.fn().mockReturnValue(true),
    } as any)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry', {
      method: 'POST',
      body: JSON.stringify({ hn: '' }),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('POST creates new record when authorized and valid', async () => {
    vi.mocked(getAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      username: 'nurse_joy',
      name: 'พว. จอย',
      can: vi.fn().mockImplementation((perm) => perm === 'edit_palliative_registry'),
    } as any)

    vi.mocked(PalliativeRegistryService.createRegistry).mockResolvedValue({
      id: 5,
      hn: '000206',
      patientName: 'นางจันทนา ตันมา',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/palliative-care/registry', {
      method: 'POST',
      body: JSON.stringify({
        hn: '000206',
        patientName: 'นางจันทนา ตันมา',
        icd10Principal: 'C548 CA corpus',
      }),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.hn).toBe('000206')
  })
})
