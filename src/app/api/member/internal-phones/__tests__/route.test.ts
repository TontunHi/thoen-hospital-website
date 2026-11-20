import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/internalPhones/internalPhoneService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/internalPhones/internalPhoneService')>(
    '@/lib/internalPhones/internalPhoneService'
  )
  return {
    ...actual,
    internalPhoneService: {
      listPhones: vi.fn(),
      createPhone: vi.fn(),
      updatePhone: vi.fn(),
      deletePhone: vi.fn(),
    },
  }
})

import { GET, POST } from '../route'
import { PATCH, DELETE } from '../[id]/route'
import * as memberAuth from '@/lib/memberAuth'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import {
  InternalPhoneNotFoundError,
  internalPhoneService,
} from '@/lib/internalPhones/internalPhoneService'

function makeAuthenticatedMember(permissions: string[] = [], role = 'member') {
  const permSet = new Set(permissions)
  return {
    id: 1,
    username: 'staff01',
    email: 'staff01@thoen.local',
    name: 'นายทดสอบ ระบบ',
    department: 'งาน IT',
    position: 'นักวิชาการคอมพิวเตอร์',
    salaryUser: null,
    role,
    displayRole: role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิกทั่วไป',
    initials: 'ทร',
    signaturePath: null,
    profilePath: null,
    profile_path: null,
    hasSignature: false,
    hasSalary: false,
    hasSalaryCredentials: false,
    isTelegramLinked: false,
    isAdmin: role === 'admin',
    permissions: permSet,
    settings: {},
    session: { username: 'staff01', email: 'staff01@thoen.local', role },
    can: (perm: string | string[]) => {
      if (role === 'admin') return true
      const keys = Array.isArray(perm) ? perm : [perm]
      return keys.some((k) => permSet.has(k))
    },
    isFeatureEnabled: () => true,
    hasAccess: () => true,
    toDto: vi.fn(),
  } as unknown as memberAuth.AuthenticatedMember
}

const sampleRecord = {
  id: 10,
  building: 'อาคารร่มฉัตร',
  floor: '1',
  room: 'ER / ฉุกเฉิน',
  phone: '1100, 1101',
  note: null,
  displayOrder: 25,
  isActive: true,
  createdBy: 'staff01',
  updatedBy: 'staff01',
  createdAt: '2026-11-20T06:00:00.000Z',
  updatedAt: '2026-11-20T06:00:00.000Z',
}

describe('/api/member/internal-phones routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated on GET', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 }),
    })

    const res = await GET(new NextRequest('http://localhost/api/member/internal-phones'))
    expect(res.status).toBe(401)
  })

  it('returns directory list for authenticated member on GET', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: makeAuthenticatedMember(),
    })
    vi.mocked(internalPhoneService.listPhones).mockResolvedValue({
      items: [sampleRecord],
      buildings: ['อาคารร่มฉัตร'],
      floorsByBuilding: { อาคารร่มฉัตร: ['1'] },
      stats: { totalCount: 1, buildingCount: 1, extensionCount: 2 },
    })

    const res = await GET(
      new NextRequest('http://localhost/api/member/internal-phones?search=ER')
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.items).toHaveLength(1)
    expect(internalPhoneService.listPhones).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ER' })
    )
  })

  it('returns 403 when member without manage_internal_phones tries POST', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้' }, { status: 403 }),
    })

    const res = await POST(
      new NextRequest('http://localhost/api/member/internal-phones', {
        method: 'POST',
        body: JSON.stringify({ building: 'อาคารร่มฉัตร', room: 'ห้องยา', phone: '1124' }),
      })
    )
    expect(res.status).toBe(403)
  })

  it('validates body with Zod on POST and returns 400 when invalid', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: makeAuthenticatedMember(['manage_internal_phones']),
    })

    const res = await POST(
      new NextRequest('http://localhost/api/member/internal-phones', {
        method: 'POST',
        body: JSON.stringify({ building: '', room: '' }),
      })
    )
    expect(res.status).toBe(400)
    expect(internalPhoneService.createPhone).not.toHaveBeenCalled()
  })

  it('creates internal phone record on valid POST (201)', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: makeAuthenticatedMember(['manage_internal_phones']),
    })
    vi.mocked(internalPhoneService.createPhone).mockResolvedValue(sampleRecord)

    const res = await POST(
      new NextRequest('http://localhost/api/member/internal-phones', {
        method: 'POST',
        body: JSON.stringify({
          building: 'อาคารร่มฉัตร',
          floor: '1',
          room: 'ER / ฉุกเฉิน',
          phone: '1100, 1101',
        }),
      })
    )
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(10)
  })

  it('updates and deletes internal phone records and handles 404/503', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: makeAuthenticatedMember(['manage_internal_phones']),
    })
    vi.mocked(internalPhoneService.updatePhone).mockResolvedValue({
      ...sampleRecord,
      phone: '1199',
    })

    const patchRes = await PATCH(
      new NextRequest('http://localhost/api/member/internal-phones/10', {
        method: 'PATCH',
        body: JSON.stringify({ phone: '1199' }),
      }),
      { params: Promise.resolve({ id: '10' }) }
    )
    expect(patchRes.status).toBe(200)
    expect((await patchRes.json()).data.phone).toBe('1199')

    vi.mocked(internalPhoneService.deletePhone).mockRejectedValueOnce(
      new InternalPhoneNotFoundError('ไม่พบข้อมูลเบอร์โทรภายในรายการนี้')
    )
    const notFoundRes = await DELETE(
      new NextRequest('http://localhost/api/member/internal-phones/999', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '999' }) }
    )
    expect(notFoundRes.status).toBe(404)

    vi.mocked(internalPhoneService.deletePhone).mockResolvedValueOnce({ id: 10 })
    const delRes = await DELETE(
      new NextRequest('http://localhost/api/member/internal-phones/10', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '10' }) }
    )
    expect(delRes.status).toBe(200)

    vi.mocked(internalPhoneService.listPhones).mockRejectedValueOnce(
      new GatewayUnavailableError('down')
    )
    const gwRes = await GET(new NextRequest('http://localhost/api/member/internal-phones'))
    expect(gwRes.status).toBe(503)
  })
})
