import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getCatalog } from '../catalog/route'
import { GET as getStats } from '../stats/route'
import { GET as getMaterials, POST as createMaterial } from '../materials/route'
import { POST as createRequest } from '../requests/route'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import * as memberAuth from '@/lib/memberAuth'

vi.mock('@/lib/equipment/equipmentBorrowService', () => ({
  equipmentBorrowService: {
    getAvailableCatalog: vi.fn(),
    getBorrowDashboardStats: vi.fn(),
    getMaterials: vi.fn(),
    createMaterial: vi.fn(),
    createBorrowRequest: vi.fn(),
  },
}))

describe('Equipment Borrow API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('catalog endpoint returns 401 when not authenticated', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: {
        status: 401,
        json: async () => ({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }),
      } as any,
    })

    const req = new Request('http://localhost/api/member/equipment-borrow/catalog')
    const res = await getCatalog(req)

    expect(res.status).toBe(401)
  })

  it('catalog endpoint returns data for authenticated member', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: {
        id: 10,
        username: 'testuser',
        name: 'Test User',
        role: 'member',
        department: 'IT',
        isAdmin: false,
        can: () => false,
      } as any,
    })

    const mockCatalog = [
      { id: 1, itemType: 'MATERIAL', name: 'ปลั๊กพ่วง', availableQty: 5, unit: 'อัน' },
    ]
    vi.mocked(equipmentBorrowService.getAvailableCatalog).mockResolvedValue(mockCatalog as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/catalog?search=ปลั๊ก')
    const res = await getCatalog(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockCatalog)
  })

  it('stats endpoint returns dashboard metrics', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true, can: () => true } as any,
    })

    const mockStats = { totalItems: 50, availableItems: 40, borrowedItems: 10, overdueRequests: 1 }
    vi.mocked(equipmentBorrowService.getBorrowDashboardStats).mockResolvedValue(mockStats)

    const res = await getStats()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockStats)
  })

  it('POST materials rejects request with invalid data', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true, can: () => true } as any,
    })

    const req = new Request('http://localhost/api/member/equipment-borrow/materials', {
      method: 'POST',
      body: JSON.stringify({ name: '', totalQty: -5 }),
    })
    const res = await createMaterial(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })

  it('POST requests creates borrow request when valid', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: {
        id: 10,
        username: 'user1',
        name: 'สมศรี มีสุข',
        department: 'ทันตกรรม',
        isAdmin: false,
        can: () => false,
      } as any,
    })

    const mockCreated = { id: 99, requestNo: 'BR-202610-0099', status: 'PENDING' }
    vi.mocked(equipmentBorrowService.createBorrowRequest).mockResolvedValue(mockCreated as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/requests', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'จัดประชุมวิชาการ',
        borrowDate: '2026-10-20',
        items: [
          { itemType: 'MATERIAL', materialId: 1, itemName: 'ปลั๊กไฟ', quantity: 2 },
        ],
      }),
    })
    const res = await createRequest(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockCreated)
  })
})
