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

    it('marks actively borrowed assets as availableQty: 0 in catalog', async () => {
      mockDb.equipmentBorrowItem.findMany.mockResolvedValueOnce([
        { assetId: 101, quantity: 1, returnedQty: 0 },
      ])
      mockDb.hospitalAsset.findMany.mockResolvedValueOnce([
        { id: 101, name: 'Projector', articleNum: 'PRJ-01', category: 'IT', locationFullName: 'IT Room', brand: 'Epson' },
        { id: 102, name: 'Microphone', articleNum: 'MIC-01', category: 'IT', locationFullName: 'IT Room', brand: 'Shure' },
      ])

      const items = await service.getAvailableCatalog({ type: 'ASSET' })
      const borrowed = items.find((i) => i.id === 101)
      const available = items.find((i) => i.id === 102)

      expect(borrowed?.availableQty).toBe(0)
      expect(available?.availableQty).toBe(1)
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
      expect(mockDb.equipmentBorrowRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  status: 'PENDING',
                }),
              ]),
            },
          }),
        })
      )
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
      mockDb.equipmentBorrowItem.update = vi.fn().mockResolvedValue({ id: 201, status: 'BORROWED' })
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
      expect(mockDb.equipmentBorrowItem.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: { status: 'BORROWED' },
      })
      expect(result.status).toBe('APPROVED')
    })

    it('rejects request and updates items status to REJECTED', async () => {
      mockDb.equipmentBorrowRequest.findUnique.mockResolvedValue({ id: 50, status: 'PENDING', requestNo: 'BR-001' })
      mockDb.equipmentBorrowRequest.update.mockResolvedValue({ id: 50, status: 'REJECTED' })
      mockDb.equipmentBorrowItem.updateMany = vi.fn().mockResolvedValue({ count: 1 })

      await service.rejectBorrowRequest(50, 'อุปกรณ์ไม่พร้อม', actor)

      expect(mockDb.equipmentBorrowRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 50 },
          data: expect.objectContaining({ status: 'REJECTED', rejectReason: 'อุปกรณ์ไม่พร้อม' }),
        })
      )
      expect(mockDb.equipmentBorrowItem.updateMany).toHaveBeenCalledWith({
        where: { requestId: 50 },
        data: { status: 'REJECTED' },
      })
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

    it('processes return inspection via queryExecutor without passing raw Date objects', async () => {
      const mockQueryExecutor = vi.fn()
      const sqlService = new EquipmentBorrowService(null, mockQueryExecutor)

      const mockReq = {
        id: 1,
        request_no: 'BR-202610-0001',
        status: 'APPROVED',
        requester_id: 10,
        requester_name: 'นนธภพ',
      }

      const mockItems = [
        {
          id: 101,
          request_id: 1,
          item_type: 'MATERIAL',
          material_id: 3,
          item_name: 'ถุงมือสีขาว',
          quantity: 2,
          returned_qty: 0,
          status: 'BORROWED',
          mat_name: 'ถุงมือสีขาว',
          mat_unit: 'คู่',
          mat_type: 'REUSABLE',
        },
      ]

      mockQueryExecutor
        // 1. getBorrowRequestById initial
        .mockResolvedValueOnce([mockReq])
        .mockResolvedValueOnce(mockItems)
        // 2. update item
        .mockResolvedValueOnce({ affectedRows: 1 })
        // 3. update material stock
        .mockResolvedValueOnce({ affectedRows: 1 })
        // 4. select updated items for allDone check
        .mockResolvedValueOnce([{ quantity: 2, returned_qty: 2, status: 'RETURNED' }])
        // 5. update request status
        .mockResolvedValueOnce({ affectedRows: 1 })
        // 6. getBorrowRequestById final
        .mockResolvedValueOnce([{ ...mockReq, status: 'RETURNED' }])
        .mockResolvedValueOnce([{ ...mockItems[0], returned_qty: 2, status: 'RETURNED' }])

      const returnData = [
        {
          itemId: 101,
          returnedQty: 2,
          condition: 'NORMAL' as const,
          notes: 'ok',
        },
      ]

      const result = await sqlService.processItemReturn(1, returnData, actor)

      const updateReqCall = mockQueryExecutor.mock.calls.find(([sql]) =>
        sql.includes('UPDATE equipment_borrow_requests')
      )
      expect(updateReqCall).toBeDefined()
      expect(updateReqCall![0]).toContain("actual_return_date = CASE WHEN ? = 'RETURNED' THEN NOW() ELSE NULL END")
      expect(updateReqCall![1]).toEqual(['RETURNED', 'RETURNED', 1])

      for (const call of mockQueryExecutor.mock.calls) {
        const params = call[1] || []
        for (const p of params) {
          expect(p instanceof Date).toBe(false)
        }
      }

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

  describe('Overdue Notification Dispatcher (15:00 Daily Cron)', () => {
    let mockTelegramSender: any

    beforeEach(() => {
      mockTelegramSender = vi.fn().mockResolvedValue({ ok: true })
      mockDb.memberTelegramLink = {
        findFirst: vi.fn(),
      }
    })

    it('sends Telegram message to overdue borrowers with remaining items only', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago

      mockDb.equipmentBorrowRequest.findMany.mockResolvedValueOnce([
        {
          id: 10,
          requestNo: 'BR-202610-0010',
          requesterId: 101,
          requesterName: 'นพ.สมชาย ใจดี',
          requesterDept: 'OPD',
          purpose: 'ออกหน่วยแพทย์',
          expectedReturnDate: pastDate,
          items: [
            {
              id: 1,
              itemName: 'เครื่องวัดความดัน',
              itemCode: '6515-001-0001',
              quantity: 2,
              returnedQty: 1, // Still 1 remaining
              status: 'BORROWED',
            },
            {
              id: 2,
              itemName: 'หูฟัง Stethoscope',
              itemCode: '6515-001-0002',
              quantity: 1,
              returnedQty: 1, // Fully returned -> should NOT appear in message
              status: 'RETURNED',
            },
          ],
        },
      ])

      mockDb.memberTelegramLink.findFirst.mockResolvedValueOnce({
        telegramChatId: '987654321',
      })

      const customService = new EquipmentBorrowService(mockDb, vi.fn(), mockTelegramSender)
      const res = await customService.dispatchOverdueNotifications({ siteUrl: 'https://thlp.moph.go.th' })

      expect(res.success).toBe(true)
      expect(res.totalOverdue).toBe(1)
      expect(res.sentCount).toBe(1)
      expect(res.skippedNoTelegramCount).toBe(0)

      expect(mockTelegramSender).toHaveBeenCalledTimes(1)
      expect(mockTelegramSender).toHaveBeenCalledWith(
        '987654321',
        expect.stringContaining('เครื่องวัดความดัน'),
        expect.objectContaining({ parseMode: 'HTML' })
      )
      // Fully returned items must NOT be included in remaining items list
      expect(mockTelegramSender).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('หูฟัง Stethoscope'),
        expect.anything()
      )
    })

    it('skips sending and records SKIPPED_NO_TELEGRAM if borrower has not linked Telegram', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago

      mockDb.equipmentBorrowRequest.findMany.mockResolvedValueOnce([
        {
          id: 11,
          requestNo: 'BR-202610-0011',
          requesterId: 102,
          requesterName: 'พว.สุดา สวยงาม',
          requesterDept: 'ER',
          purpose: 'ตรวจเวรดึก',
          expectedReturnDate: pastDate,
          items: [
            {
              id: 3,
              itemName: 'ไฟฉายส่องตรวจ',
              quantity: 1,
              returnedQty: 0,
              status: 'BORROWED',
            },
          ],
        },
      ])

      // No telegram link found
      mockDb.memberTelegramLink.findFirst.mockResolvedValueOnce(null)

      const customService = new EquipmentBorrowService(mockDb, vi.fn(), mockTelegramSender)
      const res = await customService.dispatchOverdueNotifications()

      expect(res.totalOverdue).toBe(1)
      expect(res.sentCount).toBe(0)
      expect(res.skippedNoTelegramCount).toBe(1)
      expect(res.details[0].status).toBe('SKIPPED_NO_TELEGRAM')
      expect(mockTelegramSender).not.toHaveBeenCalled()
    })

    it('handles Telegram sending failure and records FAILED status without crashing', async () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      mockDb.equipmentBorrowRequest.findMany.mockResolvedValueOnce([
        {
          id: 12,
          requestNo: 'BR-202610-0012',
          requesterId: 103,
          requesterName: 'นายสมบัติ พนักงานขับรถ',
          expectedReturnDate: pastDate,
          items: [{ id: 4, itemName: 'วิทยุสื่อสาร', quantity: 1, returnedQty: 0, status: 'BORROWED' }],
        },
      ])

      mockDb.memberTelegramLink.findFirst.mockResolvedValueOnce({
        telegramChatId: '11223344',
      })

      mockTelegramSender.mockRejectedValueOnce(new Error('Telegram API Bot Blocked'))

      const customService = new EquipmentBorrowService(mockDb, vi.fn(), mockTelegramSender)
      const res = await customService.dispatchOverdueNotifications()

      expect(res.totalOverdue).toBe(1)
      expect(res.sentCount).toBe(0)
      expect(res.failedCount).toBe(1)
      expect(res.details[0].status).toBe('FAILED')
      expect(res.details[0].error).toContain('Telegram API Bot Blocked')
    })

    it('works with Zero-DB queryExecutor for production environment', async () => {
      const mockQueryExecutor = vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('FROM equipment_borrow_requests r')) {
          return Promise.resolve([
            {
              id: 20,
              request_no: 'BR-202610-0020',
              requester_id: 200,
              requester_name: 'ผู้ยืมระบบเกตเวย์',
              requester_dept: 'IT',
              purpose: 'ทดสอบระบบ',
              expected_return_date: '2026-10-18',
              overdue_days: 1,
            },
          ])
        }
        if (sql.includes('FROM equipment_borrow_items')) {
          return Promise.resolve([
            {
              id: 50,
              item_name: 'จอภาพ Dell 24 นิ้ว',
              item_code: '7440-002-0050',
              quantity: 1,
              returned_qty: 0,
              status: 'BORROWED',
            },
          ])
        }
        if (sql.includes('FROM member_telegram_links')) {
          return Promise.resolve([{ telegram_chat_id: '55667788' }])
        }
        return Promise.resolve([])
      })

      const customService = new EquipmentBorrowService(null, mockQueryExecutor, mockTelegramSender)
      const res = await customService.dispatchOverdueNotifications()

      expect(res.totalOverdue).toBe(1)
      expect(res.sentCount).toBe(1)
      expect(res.details[0].requestNo).toBe('BR-202610-0020')
      expect(mockTelegramSender).toHaveBeenCalledWith(
        '55667788',
        expect.stringContaining('จอภาพ Dell 24 นิ้ว'),
        expect.objectContaining({ parseMode: 'HTML' })
      )
    })
  })

  describe('Inventory Reconciliation and Pre-validation', () => {
    it('reconciles availableQty against currently borrowed items when totalQty is updated in Zero-DB', async () => {
      const mockQueryExecutor = vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('SELECT * FROM hospital_materials WHERE id = ?')) {
          return Promise.resolve([
            { id: 2, name: 'พวงมาลาสีชมพู', total_qty: 1, available_qty: 0, is_active: 1 },
          ])
        }
        if (sql.includes('SELECT COALESCE(SUM(i.quantity - i.returned_qty)')) {
          // 0 currently borrowed
          return Promise.resolve([{ borrowed: 0 }])
        }
        if (sql.includes('UPDATE hospital_materials SET')) {
          return Promise.resolve({ affectedRows: 1 })
        }
        return Promise.resolve([])
      })

      const customService = new EquipmentBorrowService(null, mockQueryExecutor)
      await customService.updateMaterial(2, { totalQty: 1 }, actor)

      const updateCall = mockQueryExecutor.mock.calls.find(([sql]) =>
        sql.includes('UPDATE hospital_materials SET')
      )
      expect(updateCall).toBeDefined()
      // total_qty = 1, available_qty = 1 (1 - 0 borrowed)
      expect(updateCall![0]).toContain('available_qty = ?')
      expect(updateCall![1]).toContain(1)
    })

    it('pre-validates all material stock before executing any updates during approval in Zero-DB', async () => {
      const mockQueryExecutor = vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('FROM equipment_borrow_requests WHERE id = ?')) {
          return Promise.resolve([
            { id: 2, request_no: 'BR-202610-4958', status: 'PENDING', requester_id: 121 },
          ])
        }
        if (sql.includes('FROM equipment_borrow_items i') && sql.includes('WHERE i.request_id = ?')) {
          return Promise.resolve([
            { id: 10, request_id: 2, item_type: 'MATERIAL', material_id: 2, item_name: 'พวงมาลาสีชมพู', quantity: 1, returned_qty: 0, status: 'PENDING' },
            { id: 11, request_id: 2, item_type: 'MATERIAL', material_id: 3, item_name: 'ถุงมือสีขาว', quantity: 2, returned_qty: 0, status: 'PENDING' },
          ])
        }
        if (sql.includes('SELECT id, name, available_qty, unit, material_type FROM hospital_materials WHERE id = ?')) {
          const matId = params?.[0]
          if (matId === 2) {
            return Promise.resolve([{ id: 2, name: 'พวงมาลาสีชมพู', available_qty: 1, unit: 'ชิ้น', material_type: 'REUSABLE' }])
          }
          if (matId === 3) {
            // Insufficient stock for material 3!
            return Promise.resolve([{ id: 3, name: 'ถุงมือสีขาว', available_qty: 0, unit: 'คู่', material_type: 'REUSABLE' }])
          }
        }
        return Promise.resolve([])
      })

      const customService = new EquipmentBorrowService(null, mockQueryExecutor)

      await expect(customService.approveAndDispenseRequest(2, actor)).rejects.toThrow(
        /ยอดคงเหลือไม่เพียงพอสำหรับ ถุงมือสีขาว/
      )

      // Ensure that hospital_materials update was NEVER called for item 1
      const updateCalls = mockQueryExecutor.mock.calls.filter(([sql]) =>
        sql.includes('UPDATE hospital_materials SET')
      )
      expect(updateCalls.length).toBe(0)
    })
  })
})
