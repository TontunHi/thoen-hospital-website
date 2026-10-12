import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EquipmentBorrowService } from '../equipmentBorrowService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('EquipmentBorrowService', () => {
  let mockDb: any
  let service: EquipmentBorrowService

  const actor = {
    id: 1,
    name: 'Admin User',
    username: 'admin',
    role: 'admin',
  }

  beforeEach(() => {
    mockDb = {
      hospitalMaterial: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn(),
      },
      hospitalAsset: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      equipmentBorrowRequest: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      equipmentBorrowItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockDb)),
    }
    service = new EquipmentBorrowService(mockDb)
  })

  describe('Material and Loanable Asset Management', () => {
    it('creates a material with valid input and initializes availableQty', async () => {
      const input = {
        name: 'ปลั๊กพ่วง 5 เมตร',
        category: 'ELECTRICAL',
        materialType: 'REUSABLE' as const,
        totalQty: 10,
        unit: 'อัน',
        location: 'ตู้เก็บของ IT',
      }

      mockDb.hospitalMaterial.create.mockResolvedValue({
        id: 1,
        ...input,
        availableQty: 10,
        isActive: true,
      })

      const result = await service.createMaterial(input, actor)

      expect(mockDb.hospitalMaterial.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'ปลั๊กพ่วง 5 เมตร',
          totalQty: 10,
          availableQty: 10,
        }),
      })
      expect(result.id).toBe(1)
    })

    it('toggles loanable status on a hospital asset', async () => {
      mockDb.hospitalAsset.findUnique.mockResolvedValue({ id: 101, articleNum: '7440-001', isLoanable: false })
      mockDb.hospitalAsset.update.mockResolvedValue({ id: 101, articleNum: '7440-001', isLoanable: true })

      const result = await service.toggleAssetLoanable(101, true, actor)

      expect(mockDb.hospitalAsset.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { isLoanable: true },
      })
      expect(result.isLoanable).toBe(true)
    })
  })

  describe('Borrow Requests & Multi-Item Basket', () => {
    it('creates a borrow request with multi-item basket', async () => {
      const requestInput = {
        purpose: 'จัดกิจกรรมอบรม CPR',
        location: 'ห้องประชุมตึกอำนวยการ',
        borrowDate: new Date('2026-10-15'),
        expectedReturnDate: new Date('2026-10-16'),
        phone: '0812345678',
        notes: 'ขอใช้งาน 2 วัน',
        items: [
          {
            itemType: 'ASSET' as const,
            assetId: 101,
            itemName: 'โปรเจคเตอร์ Epson',
            itemCode: '7440-001',
            quantity: 1,
          },
          {
            itemType: 'MATERIAL' as const,
            materialId: 1,
            itemName: 'ปลั๊กพ่วง 5 เมตร',
            quantity: 2,
          },
        ],
      }

      mockDb.hospitalMaterial.findUnique.mockResolvedValue({ id: 1, availableQty: 5, isActive: true })
      mockDb.hospitalAsset.findUnique.mockResolvedValue({ id: 101, isLoanable: true, status: 'ACTIVE' })

      mockDb.equipmentBorrowRequest.create.mockResolvedValue({
        id: 50,
        requestNo: 'REQ-202610-0001',
        requesterId: 10,
        requesterName: 'สมชาย รักดี',
        status: 'PENDING',
        items: requestInput.items,
      })

      const requester = { id: 10, name: 'สมชาย รักดี', department: 'งานเวชปฏิบัติ' }
      const result = await service.createBorrowRequest(requestInput, requester)

      expect(result.id).toBe(50)
      expect(mockDb.equipmentBorrowRequest.create).toHaveBeenCalled()
    })

    it('throws error if material quantity exceeds available stock', async () => {
      const requestInput = {
        purpose: 'ทดสอบ',
        borrowDate: new Date(),
        items: [
          {
            itemType: 'MATERIAL' as const,
            materialId: 1,
            itemName: 'ปลั๊กพ่วง 5 เมตร',
            quantity: 10,
          },
        ],
      }

      mockDb.hospitalMaterial.findUnique.mockResolvedValue({ id: 1, availableQty: 3, isActive: true })

      const requester = { id: 10, name: 'สมชาย รักดี' }
      await expect(service.createBorrowRequest(requestInput, requester)).rejects.toThrow(
        /ยอดคงเหลือไม่เพียงพอ/
      )
    })
  })

  describe('Approval and Dispense', () => {
    it('approves request and decrements material stock in transaction', async () => {
      const mockRequest = {
        id: 50,
        status: 'PENDING',
        items: [
          {
            id: 201,
            itemType: 'MATERIAL',
            materialId: 1,
            itemName: 'ปลั๊กพ่วง 5 เมตร',
            quantity: 2,
            material: { id: 1, availableQty: 5, materialType: 'REUSABLE' },
          },
        ],
      }

      mockDb.equipmentBorrowRequest.findUnique.mockResolvedValue(mockRequest)
      mockDb.hospitalMaterial.findUnique.mockResolvedValue({ id: 1, availableQty: 5 })
      mockDb.hospitalMaterial.update.mockResolvedValue({ id: 1, availableQty: 3 })
      mockDb.equipmentBorrowRequest.update.mockResolvedValue({
        ...mockRequest,
        status: 'APPROVED',
      })

      const result = await service.approveAndDispenseRequest(50, actor)

      expect(mockDb.$transaction).toHaveBeenCalled()
      expect(mockDb.hospitalMaterial.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { availableQty: { decrement: 2 } },
      })
      expect(result.status).toBe('APPROVED')
    })
  })

  describe('Return Inspection', () => {
    it('processes return inspection and restores reusable stock', async () => {
      const mockRequest = {
        id: 50,
        status: 'APPROVED',
        items: [
          {
            id: 201,
            itemType: 'MATERIAL',
            materialId: 1,
            itemName: 'ปลั๊กพ่วง 5 เมตร',
            quantity: 2,
            returnedQty: 0,
            status: 'BORROWED',
            material: { id: 1, materialType: 'REUSABLE' },
          },
        ],
      }

      mockDb.equipmentBorrowRequest.findUnique.mockResolvedValue(mockRequest)
      mockDb.equipmentBorrowItem.update.mockResolvedValue({ id: 201, status: 'RETURNED' })
      mockDb.equipmentBorrowItem.findMany.mockResolvedValue([
        { id: 201, quantity: 2, returnedQty: 2, status: 'RETURNED' },
      ])
      mockDb.equipmentBorrowRequest.update.mockResolvedValue({ ...mockRequest, status: 'RETURNED' })

      const returnData = [
        {
          itemId: 201,
          returnedQty: 2,
          condition: 'NORMAL' as const,
          notes: 'สภาพสมบูรณ์',
        },
      ]

      const result = await service.processItemReturn(50, returnData, actor)

      expect(mockDb.hospitalMaterial.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { availableQty: { increment: 2 } },
      })
      expect(result.status).toBe('RETURNED')
    })
  })

  describe('Dashboard Metrics', () => {
    it('aggregates total, available, borrowed, and overdue counts', async () => {
      mockDb.hospitalAsset.count.mockResolvedValueOnce(15) // loanable assets
      mockDb.hospitalMaterial.aggregate
        .mockResolvedValueOnce({ _sum: { totalQty: 50 } })
        .mockResolvedValueOnce({ _sum: { availableQty: 40 } })

      mockDb.equipmentBorrowItem.count.mockResolvedValueOnce(10) // borrowed items
      mockDb.equipmentBorrowRequest.count.mockResolvedValueOnce(2) // overdue requests

      const stats = await service.getBorrowDashboardStats()

      expect(stats.totalItems).toBe(65) // 15 + 50
      expect(stats.availableItems).toBe(55) // 15 assets + 40 material qty
      expect(stats.borrowedItems).toBe(10)
      expect(stats.overdueRequests).toBe(2)
    })

    it('calculates exact piece quantities from borrowed items and overdue requests', async () => {
      mockDb.hospitalAsset.count.mockResolvedValueOnce(2) // 2 loanable assets
      mockDb.hospitalMaterial.aggregate
        .mockResolvedValueOnce({ _sum: { totalQty: 10 } }) // 10 material pieces
        .mockResolvedValueOnce({ _sum: { availableQty: 8 } }) // 8 available pieces

      // 1 borrowed asset item, 1 borrowed material item with qty 3 (returned 1 -> remaining 2)
      mockDb.equipmentBorrowItem.findMany.mockResolvedValueOnce([
        { itemType: 'ASSET', quantity: 1, returnedQty: 0 },
        { itemType: 'MATERIAL', quantity: 3, returnedQty: 1 },
      ])

      // 1 overdue request with 2 items
      mockDb.equipmentBorrowRequest.findMany.mockResolvedValueOnce([
        {
          items: [
            { quantity: 2, returnedQty: 0 },
          ],
        },
      ])

      const stats = await service.getBorrowDashboardStats()

      expect(stats.totalItems).toBe(12) // 2 assets + 10 materials
      expect(stats.availableItems).toBe(9) // (2 - 1 asset) + 8 available materials = 9
      expect(stats.borrowedItems).toBe(3) // 1 asset + (3 - 1 = 2) materials = 3
      expect(stats.overdueRequests).toBe(2) // 2 overdue pieces
    })
  })

  describe('Admin View All Requests', () => {
    it('retrieves all borrow requests with status filter and search query', async () => {
      const mockItems = [
        { id: 1, requestNo: 'BR-001', requesterName: 'สมศรี', status: 'RETURNED', items: [] },
      ]
      mockDb.equipmentBorrowRequest.findMany.mockResolvedValue(mockItems)
      mockDb.equipmentBorrowRequest.count.mockResolvedValue(1)

      const result = await service.getAllBorrowRequests({ status: 'RETURNED', search: 'สมศรี', page: 1, limit: 10 })

      expect(mockDb.equipmentBorrowRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'RETURNED',
            OR: expect.any(Array),
          }),
          skip: 0,
          take: 10,
        })
      )
      expect(result.items).toEqual(mockItems)
      expect(result.total).toBe(1)
      expect(result.totalPages).toBe(1)
    })
  })
})
