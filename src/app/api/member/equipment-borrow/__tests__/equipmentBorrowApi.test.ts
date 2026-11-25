import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getCatalog } from '../catalog/route'
import { GET as getStats } from '../stats/route'
import { GET as getMaterials, POST as createMaterial } from '../materials/route'
import { GET as getMyRequests } from '../my-requests/route'
import { GET as getPendingRequests } from '../pending-requests/route'
import { GET as getActiveLoans } from '../active-loans/route'
import { GET as getHistory } from '../history/route'
import { POST as createRequest } from '../requests/route'
import { GET as getRequestDetail } from '../requests/[id]/route'
import { POST as approveRequest } from '../requests/[id]/approve/route'
import { POST as rejectRequest } from '../requests/[id]/reject/route'
import { POST as returnItems } from '../requests/[id]/return/route'
import { GET as getAssets, POST as toggleAsset, PATCH as updateAssetImage } from '../assets/route'
import { POST as uploadEquipmentImage, DELETE as deleteEquipmentImage } from '../upload/route'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import * as memberAuth from '@/lib/memberAuth'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/storage/documentStorage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/documentStorage')>(
    '@/lib/storage/documentStorage'
  )
  return {
    ...actual,
    DocumentStorage: {
      ...actual.DocumentStorage,
      formatDateDirectory: vi.fn().mockReturnValue('public/uploads/equipment-borrow/2026/11'),
      save: vi.fn(),
      delete: vi.fn(),
    },
  }
})

vi.mock('@/lib/equipment/equipmentBorrowService', () => ({
  equipmentBorrowService: {
    getAvailableCatalog: vi.fn(),
    getBorrowDashboardStats: vi.fn(),
    getMaterials: vi.fn(),
    createMaterial: vi.fn(),
    createBorrowRequest: vi.fn(),
    getMyBorrowRequests: vi.fn(),
    getPendingRequests: vi.fn(),
    getActiveLoans: vi.fn(),
    getAllBorrowRequests: vi.fn(),
    getBorrowRequestById: vi.fn(),
    approveAndDispenseRequest: vi.fn(),
    rejectBorrowRequest: vi.fn(),
    processItemReturn: vi.fn(),
    getHospitalAssets: vi.fn(),
    toggleAssetLoanable: vi.fn(),
    updateAssetImage: vi.fn(),
  },
}))

describe('Equipment Borrow API Routes (Task-based Endpoints)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Catalog
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
      member: { id: 10, username: 'testuser', name: 'Test User', role: 'member' } as any,
    })

    const mockCatalog = [{ id: 1, itemType: 'MATERIAL', name: 'ปลั๊กพ่วง', availableQty: 5, unit: 'อัน' }]
    vi.mocked(equipmentBorrowService.getAvailableCatalog).mockResolvedValue(mockCatalog as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/catalog?search=ปลั๊ก')
    const res = await getCatalog(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockCatalog)
  })

  // 2. Dashboard Stats
  it('stats endpoint returns dashboard metrics', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const mockStats = { totalItems: 50, availableItems: 40, borrowedItems: 10, overdueRequests: 1 }
    vi.mocked(equipmentBorrowService.getBorrowDashboardStats).mockResolvedValue(mockStats)

    const res = await getStats()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockStats)
  })

  // 3. Materials
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

  // 4. My Requests
  it('GET my-requests returns current member requests', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 10, username: 'staff1', name: 'สมชาย' } as any,
    })

    const mockResult = { items: [{ id: 1, requestNo: 'BR-001', status: 'APPROVED' }], total: 1, page: 1, limit: 20 }
    vi.mocked(equipmentBorrowService.getMyBorrowRequests).mockResolvedValue(mockResult as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/my-requests?status=APPROVED')
    const res = await getMyRequests(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.items).toEqual(mockResult.items)
    expect(equipmentBorrowService.getMyBorrowRequests).toHaveBeenCalledWith(10, {
      status: 'APPROVED',
      page: 1,
      limit: 20,
    })
  })

  // 5. Pending Requests (Admin)
  it('GET pending-requests returns 403 when user does not have permission', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: {
        status: 403,
        json: async () => ({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้' }),
      } as any,
    })

    const req = new Request('http://localhost/api/member/equipment-borrow/pending-requests')
    const res = await getPendingRequests(req)

    expect(res.status).toBe(403)
  })

  it('GET pending-requests returns pending list for admin', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const mockResult = { items: [{ id: 2, requestNo: 'BR-002', status: 'PENDING' }], total: 1, page: 1, limit: 20 }
    vi.mocked(equipmentBorrowService.getPendingRequests).mockResolvedValue(mockResult as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/pending-requests?search=BR')
    const res = await getPendingRequests(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.items).toEqual(mockResult.items)
  })

  // 6. Active Loans (Admin)
  it('GET active-loans returns 403 when user does not have permission', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: {
        status: 403,
        json: async () => ({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้' }),
      } as any,
    })

    const req = new Request('http://localhost/api/member/equipment-borrow/active-loans')
    const res = await getActiveLoans(req)

    expect(res.status).toBe(403)
  })

  it('GET active-loans returns active loans for manager', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const mockResult = { items: [{ id: 3, requestNo: 'BR-003', status: 'APPROVED' }], total: 1, page: 1, limit: 20 }
    vi.mocked(equipmentBorrowService.getActiveLoans).mockResolvedValue(mockResult as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/active-loans?overdue=true')
    const res = await getActiveLoans(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(equipmentBorrowService.getActiveLoans).toHaveBeenCalledWith({
      search: undefined,
      overdueOnly: true,
      page: 1,
      limit: 20,
    })
  })

  // 7. History (Admin)
  it('GET history returns 403 when user lacks manage_borrow permission', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: {
        status: 403,
        json: async () => ({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้' }),
      } as any,
    })

    const req = new Request('http://localhost/api/member/equipment-borrow/history')
    const res = await getHistory(req)

    expect(res.status).toBe(403)
  })

  it('GET history returns full loan history for manager', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const mockResult = { items: [{ id: 1, requestNo: 'BR-001', status: 'RETURNED' }], total: 1, page: 1, limit: 20 }
    vi.mocked(equipmentBorrowService.getAllBorrowRequests).mockResolvedValue(mockResult as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/history?status=RETURNED')
    const res = await getHistory(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.items).toEqual(mockResult.items)
  })

  // 8. Create Request (POST only)
  it('POST requests creates borrow request when valid', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 10, username: 'user1', name: 'สมศรี มีสุข', department: 'ทันตกรรม' } as any,
    })

    const mockCreated = { id: 99, requestNo: 'BR-202610-0099', status: 'PENDING' }
    vi.mocked(equipmentBorrowService.createBorrowRequest).mockResolvedValue(mockCreated as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/requests', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'จัดประชุมวิชาการ',
        borrowDate: '2026-10-20',
        expectedReturnDate: '2026-10-21',
        items: [{ itemType: 'MATERIAL', materialId: 1, itemName: 'ปลั๊กไฟ', quantity: 2 }],
      }),
    })
    const res = await createRequest(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockCreated)
  })

  it('POST requests rejects when expectedReturnDate is missing', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 10, username: 'user1' } as any,
    })

    const req = new Request('http://localhost/api/member/equipment-borrow/requests', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'จัดประชุมวิชาการ',
        borrowDate: '2026-10-20',
        items: [{ itemType: 'MATERIAL', materialId: 1, itemName: 'ปลั๊กไฟ', quantity: 2 }],
      }),
    })
    const res = await createRequest(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('กรุณาระบุวันที่คาดว่าจะส่งคืน')
  })

  // 9. Single Request Detail
  it('GET requests/[id] returns detail when caller is requester', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 10, username: 'staff1', isAdmin: false, can: () => false } as any,
    })

    const mockDetail = { id: 1, requestNo: 'BR-001', requesterId: 10, items: [] }
    vi.mocked(equipmentBorrowService.getBorrowRequestById).mockResolvedValue(mockDetail as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/requests/1')
    const res = await getRequestDetail(req, { params: Promise.resolve({ id: '1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockDetail)
  })

  // 10. Approve Request
  it('POST requests/[id]/approve approves request for manager', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', name: 'Admin', role: 'admin', isAdmin: true } as any,
    })

    const mockApproved = { id: 1, status: 'APPROVED' }
    vi.mocked(equipmentBorrowService.approveAndDispenseRequest).mockResolvedValue(mockApproved as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/requests/1/approve', { method: 'POST' })
    const res = await approveRequest(req, { params: Promise.resolve({ id: '1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockApproved)
  })

  // 11. Reject Request
  it('POST requests/[id]/reject rejects request with reason', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', name: 'Admin', role: 'admin', isAdmin: true } as any,
    })

    const mockRejected = { id: 1, status: 'REJECTED' }
    vi.mocked(equipmentBorrowService.rejectBorrowRequest).mockResolvedValue(mockRejected as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/requests/1/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'อุปกรณ์อยู่ระหว่างซ่อมบำรุง' }),
    })
    const res = await rejectRequest(req, { params: Promise.resolve({ id: '1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockRejected)
  })

  // 12. Return Inspection
  it('POST requests/[id]/return successfully processes return inspection', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', name: 'Admin', role: 'admin', isAdmin: true } as any,
    })

    const mockReturned = { id: 1, requestNo: 'BR-202610-0001', status: 'RETURNED' }
    vi.mocked(equipmentBorrowService.processItemReturn).mockResolvedValue(mockReturned as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/requests/1/return', {
      method: 'POST',
      body: JSON.stringify({
        returns: [{ itemId: 1, returnedQty: 2, condition: 'NORMAL', notes: 'สภาพดี' }],
      }),
    })
    const res = await returnItems(req, { params: Promise.resolve({ id: '1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockReturned)
  })

  // 13. Assets & Toggle Loanable
  it('POST assets toggles asset loanable status', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const mockAsset = { id: 101, articleNum: '7440-001', isLoanable: true }
    vi.mocked(equipmentBorrowService.toggleAssetLoanable).mockResolvedValue(mockAsset as any)

    const req = new Request('http://localhost/api/member/equipment-borrow/assets', {
      method: 'POST',
      body: JSON.stringify({ assetId: 101, isLoanable: true }),
    })
    const res = await toggleAsset(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockAsset)
  })

  // 14. Equipment Image Upload & Asset Image Patch
  it('POST upload rejects missing file with 400', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const form = new FormData()
    const req = new Request('http://localhost/api/member/equipment-borrow/upload', {
      method: 'POST',
      body: form,
    })
    const res = await uploadEquipmentImage(req)
    expect(res.status).toBe(400)
  })

  it('POST upload saves image via DocumentStorage and returns 201', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    vi.mocked(DocumentStorage.save).mockResolvedValue({
      publicUrl: '/uploads/equipment-borrow/2026/11/material-123.jpg',
      relativePath: 'public/uploads/equipment-borrow/2026/11/material-123.jpg',
      diskPath: '/tmp/material-123.jpg',
      fileName: 'material-123.jpg',
      fileSize: 2048,
      mimeType: 'image/jpeg',
    })

    const form = new FormData()
    form.append('itemType', 'MATERIAL')
    form.append('file', new File(['img-bytes'], 'cable.jpg', { type: 'image/jpeg' }))

    const req = new Request('http://localhost/api/member/equipment-borrow/upload', {
      method: 'POST',
      body: form,
    })
    const res = await uploadEquipmentImage(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.url).toBe('/uploads/equipment-borrow/2026/11/material-123.jpg')
  })

  it('DELETE upload rejects path outside equipment-borrow directory', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', isAdmin: true } as any,
    })

    const req = new Request(
      'http://localhost/api/member/equipment-borrow/upload?path=/uploads/other/secret.jpg',
      { method: 'DELETE' }
    )
    const res = await deleteEquipmentImage(req)
    expect(res.status).toBe(400)
  })

  it('PATCH assets updates asset imageUrl and rejects invalid traversal URLs', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 1, username: 'admin', name: 'Admin', role: 'admin', isAdmin: true } as any,
    })

    const badReq = new Request('http://localhost/api/member/equipment-borrow/assets', {
      method: 'PATCH',
      body: JSON.stringify({ assetId: 101, imageUrl: '/uploads/../etc/passwd' }),
    })
    const badRes = await updateAssetImage(badReq)
    expect(badRes.status).toBe(400)

    vi.mocked(equipmentBorrowService.updateAssetImage).mockResolvedValue({
      id: 101,
      imageUrl: '/uploads/equipment-borrow/2026/11/asset-1.jpg',
    } as any)

    const goodReq = new Request('http://localhost/api/member/equipment-borrow/assets', {
      method: 'PATCH',
      body: JSON.stringify({
        assetId: 101,
        imageUrl: '/uploads/equipment-borrow/2026/11/asset-1.jpg',
      }),
    })
    const goodRes = await updateAssetImage(goodReq)
    const body = await goodRes.json()

    expect(goodRes.status).toBe(200)
    expect(body.success).toBe(true)
    expect(equipmentBorrowService.updateAssetImage).toHaveBeenCalledWith(
      101,
      '/uploads/equipment-borrow/2026/11/asset-1.jpg',
      expect.objectContaining({ username: 'admin' })
    )
  })
})
