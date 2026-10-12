import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export interface Actor {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
}

export interface CreateMaterialInput {
  name: string
  category?: string
  materialType?: 'REUSABLE' | 'CONSUMABLE'
  totalQty: number
  availableQty?: number
  unit?: string
  location?: string | null
  imageUrl?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface UpdateMaterialInput extends Partial<CreateMaterialInput> {}

export interface BorrowBasketItemInput {
  itemType: 'ASSET' | 'MATERIAL'
  assetId?: number | null
  materialId?: number | null
  itemName: string
  itemCode?: string | null
  quantity: number
}

export interface CreateBorrowRequestInput {
  purpose: string
  location?: string | null
  borrowDate: Date | string
  expectedReturnDate?: Date | string | null
  phone?: string | null
  notes?: string | null
  items: BorrowBasketItemInput[]
}

export interface ItemReturnInput {
  itemId: number
  returnedQty: number
  condition: 'NORMAL' | 'DAMAGED' | 'LOST'
  notes?: string | null
}

export interface BorrowDashboardStats {
  totalItems: number
  availableItems: number
  borrowedItems: number
  overdueRequests: number
}

export class EquipmentBorrowService {
  constructor(private readonly db: any = prisma) {}

  // ==========================================
  // 1. Material & Loanable Asset Management
  // ==========================================

  async getMaterials(options: {
    search?: string
    category?: string
    materialType?: string
    isActive?: boolean
    page?: number
    limit?: number
  } = {}) {
    const { search, category, materialType, isActive, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    const where: any = {}
    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { name: { contains: q } },
        { location: { contains: q } },
        { notes: { contains: q } },
      ]
    }
    if (category && category !== 'ALL') {
      where.category = category
    }
    if (materialType && materialType !== 'ALL') {
      where.materialType = materialType
    }
    if (typeof isActive === 'boolean') {
      where.isActive = isActive
    }

    const [items, total] = await Promise.all([
      this.db.hospitalMaterial.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.db.hospitalMaterial.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async createMaterial(input: CreateMaterialInput, actor: Actor) {
    const totalQty = Math.max(0, input.totalQty || 0)
    const availableQty = input.availableQty !== undefined ? Math.max(0, input.availableQty) : totalQty

    const material = await this.db.hospitalMaterial.create({
      data: {
        name: input.name.trim(),
        category: input.category || 'GENERAL',
        materialType: input.materialType || 'REUSABLE',
        totalQty,
        availableQty,
        unit: input.unit?.trim() || 'ชิ้น',
        location: input.location?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
      },
    })

    await logAudit(
      'CREATE',
      'hospital_materials',
      JSON.stringify({ materialId: material.id, name: material.name, totalQty }),
      { username: actor.username || 'system' }
    )

    return material
  }

  async updateMaterial(id: number, input: UpdateMaterialInput, actor: Actor) {
    const existing = await this.db.hospitalMaterial.findUnique({ where: { id } })
    if (!existing) {
      throw new Error(`ไม่พบวัสดุรหัส ${id}`)
    }

    const data: any = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.category !== undefined) data.category = input.category
    if (input.materialType !== undefined) data.materialType = input.materialType
    if (input.unit !== undefined) data.unit = input.unit.trim()
    if (input.location !== undefined) data.location = input.location?.trim() || null
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl?.trim() || null
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null
    if (input.isActive !== undefined) data.isActive = input.isActive

    if (input.totalQty !== undefined) {
      const delta = input.totalQty - existing.totalQty
      data.totalQty = Math.max(0, input.totalQty)
      // adjust availableQty proportionally
      data.availableQty = Math.max(0, existing.availableQty + delta)
    }
    if (input.availableQty !== undefined) {
      data.availableQty = Math.max(0, input.availableQty)
    }

    const updated = await this.db.hospitalMaterial.update({
      where: { id },
      data,
    })

    await logAudit(
      'UPDATE',
      'hospital_materials',
      JSON.stringify({ materialId: id, changes: data }),
      { username: actor.username || 'system' }
    )

    return updated
  }

  async deleteMaterial(id: number, actor: Actor) {
    const existing = await this.db.hospitalMaterial.findUnique({ where: { id } })
    if (!existing) {
      throw new Error(`ไม่พบวัสดุรหัส ${id}`)
    }

    // Soft delete if already used in borrow items, otherwise hard delete
    const usedCount = await this.db.equipmentBorrowItem.count({ where: { materialId: id } })
    if (usedCount > 0) {
      const updated = await this.db.hospitalMaterial.update({
        where: { id },
        data: { isActive: false },
      })
      await logAudit(
        'UPDATE',
        'hospital_materials',
        JSON.stringify({ materialId: id, name: existing.name, action: 'DEACTIVATE' }),
        { username: actor.username || 'system' }
      )
      return updated
    }

    await this.db.hospitalMaterial.delete({ where: { id } })
    await logAudit(
      'DELETE',
      'hospital_materials',
      JSON.stringify({ materialId: id, name: existing.name }),
      { username: actor.username || 'system' }
    )
    return { success: true }
  }

  async toggleAssetLoanable(assetId: number, isLoanable: boolean, actor: Actor) {
    const existing = await this.db.hospitalAsset.findUnique({ where: { id: assetId } })
    if (!existing) {
      throw new Error(`ไม่พบครุภัณฑ์รหัส ${assetId}`)
    }

    const updated = await this.db.hospitalAsset.update({
      where: { id: assetId },
      data: { isLoanable },
    })

    await logAudit(
      'UPDATE',
      'hospital_assets',
      JSON.stringify({ assetId, articleNum: existing.articleNum, isLoanable }),
      { username: actor.username || 'system' }
    )

    return updated
  }

  async getLoanableAssets(options: {
    search?: string
    category?: string
    isLoanable?: boolean
    page?: number
    limit?: number
  } = {}) {
    const { search, category, isLoanable = true, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    const where: any = { isLoanable }
    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { name: { contains: q } },
        { articleNum: { contains: q } },
        { brand: { contains: q } },
        { model: { contains: q } },
      ]
    }
    if (category && category !== 'ALL') {
      where.category = category
    }

    const [items, total] = await Promise.all([
      this.db.hospitalAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.db.hospitalAsset.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async getAvailableCatalog(options: { search?: string; category?: string; type?: 'ALL' | 'ASSET' | 'MATERIAL' } = {}) {
    const { search, category, type = 'ALL' } = options

    const results: Array<{
      id: number
      itemType: 'ASSET' | 'MATERIAL'
      name: string
      code: string
      category: string
      subType?: string
      availableQty: number
      unit: string
      location?: string | null
      imageUrl?: string | null
    }> = []

    if (type === 'ALL' || type === 'ASSET') {
      const assetWhere: any = { isLoanable: true, status: 'ACTIVE' }
      if (search && search.trim()) {
        const q = search.trim()
        assetWhere.OR = [
          { name: { contains: q } },
          { articleNum: { contains: q } },
          { brand: { contains: q } },
        ]
      }
      if (category && category !== 'ALL') {
        assetWhere.category = category
      }

      const assets = await this.db.hospitalAsset.findMany({
        where: assetWhere,
        take: 100,
        orderBy: { name: 'asc' },
      })

      for (const a of assets) {
        results.push({
          id: a.id,
          itemType: 'ASSET',
          name: a.name + (a.brand ? ` (${a.brand})` : ''),
          code: a.articleNum,
          category: a.category,
          subType: 'ครุภัณฑ์',
          availableQty: 1,
          unit: 'เครื่อง/ชิ้น',
          location: a.locationFullName,
          imageUrl: a.imageUrl,
        })
      }
    }

    if (type === 'ALL' || type === 'MATERIAL') {
      const matWhere: any = { isActive: true, availableQty: { gt: 0 } }
      if (search && search.trim()) {
        const q = search.trim()
        matWhere.OR = [
          { name: { contains: q } },
          { location: { contains: q } },
        ]
      }
      if (category && category !== 'ALL') {
        matWhere.category = category
      }

      const materials = await this.db.hospitalMaterial.findMany({
        where: matWhere,
        take: 100,
        orderBy: { name: 'asc' },
      })

      for (const m of materials) {
        results.push({
          id: m.id,
          itemType: 'MATERIAL',
          name: m.name,
          code: `MAT-${m.id.toString().padStart(4, '0')}`,
          category: m.category,
          subType: m.materialType === 'REUSABLE' ? 'วัสดุยืม-คืน' : 'วัสดุสิ้นเปลือง',
          availableQty: m.availableQty,
          unit: m.unit,
          location: m.location,
          imageUrl: m.imageUrl,
        })
      }
    }

    return results
  }

  // ==========================================
  // 2. Borrow Request & Multi-Item Basket
  // ==========================================

  async createBorrowRequest(
    input: CreateBorrowRequestInput,
    requester: { id: number; name: string; department?: string | null }
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error('กรุณาเลือกอุปกรณ์หรือวัสดุอย่างน้อย 1 รายการ')
    }

    // Validate stock and items
    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error(`จำนวนของรายการ ${item.itemName} ต้องมากกว่า 0`)
      }

      if (item.itemType === 'MATERIAL') {
        if (!item.materialId) throw new Error('ไม่พบรหัสวัสดุ')
        const mat = await this.db.hospitalMaterial.findUnique({ where: { id: item.materialId } })
        if (!mat || !mat.isActive) {
          throw new Error(`วัสดุ ${item.itemName} ไม่พร้อมให้บริการ`)
        }
        if (mat.availableQty < item.quantity) {
          throw new Error(`ยอดคงเหลือไม่เพียงพอสำหรับ ${item.itemName} (คงเหลือ ${mat.availableQty} ${mat.unit})`)
        }
      } else if (item.itemType === 'ASSET') {
        if (!item.assetId) throw new Error('ไม่พบรหัสครุภัณฑ์')
        const asset = await this.db.hospitalAsset.findUnique({ where: { id: item.assetId } })
        if (!asset || !asset.isLoanable || asset.status !== 'ACTIVE') {
          throw new Error(`ครุภัณฑ์ ${item.itemName} ไม่อยู่ในสถานะพร้อมให้ยืม`)
        }
      }
    }

    // Generate Request Number: BR-YYYYMM-XXXX
    const now = new Date()
    const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`
    const countThisMonth = await this.db.equipmentBorrowRequest.count()
    const requestNo = `BR-${yearMonth}-${(countThisMonth + 1).toString().padStart(4, '0')}`

    const borrowDate = new Date(input.borrowDate)
    const expectedReturnDate = input.expectedReturnDate ? new Date(input.expectedReturnDate) : null

    const request = await this.db.equipmentBorrowRequest.create({
      data: {
        requestNo,
        requesterId: requester.id,
        requesterName: requester.name,
        requesterDept: requester.department || null,
        purpose: input.purpose.trim(),
        location: input.location?.trim() || null,
        borrowDate,
        expectedReturnDate,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
        status: 'PENDING',
        items: {
          create: input.items.map((it) => ({
            itemType: it.itemType,
            assetId: it.assetId || null,
            materialId: it.materialId || null,
            itemName: it.itemName,
            itemCode: it.itemCode || null,
            quantity: it.quantity,
            status: 'BORROWED',
          })),
        },
      },
      include: {
        items: true,
      },
    })

    await logAudit(
      'CREATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: request.id, requestNo: request.requestNo, itemsCount: input.items.length }),
      { username: requester.name }
    )

    return request
  }

  async getMyBorrowRequests(requesterId: number, options: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    const where: any = { requesterId }
    if (status && status !== 'ALL') {
      where.status = status
    }

    const [items, total] = await Promise.all([
      this.db.equipmentBorrowRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.db.equipmentBorrowRequest.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async getBorrowRequestById(id: number) {
    const request = await this.db.equipmentBorrowRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            asset: true,
            material: true,
          },
        },
      },
    })
    return request
  }

  // ==========================================
  // 3. Approval and Dispense
  // ==========================================

  async getPendingRequests(options: { search?: string; page?: number; limit?: number } = {}) {
    const { search, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    const where: any = { status: 'PENDING' }
    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { requestNo: { contains: q } },
        { requesterName: { contains: q } },
        { purpose: { contains: q } },
      ]
    }

    const [items, total] = await Promise.all([
      this.db.equipmentBorrowRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.db.equipmentBorrowRequest.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async approveAndDispenseRequest(id: number, actor: Actor) {
    const request = await this.db.equipmentBorrowRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            material: true,
            asset: true,
          },
        },
      },
    })

    if (!request) {
      throw new Error(`ไม่พบคำขอยืมรหัส ${id}`)
    }
    if (request.status !== 'PENDING') {
      throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${request.status})`)
    }

    return await this.db.$transaction(async (tx: any) => {
      // Deduct stock for each item
      for (const item of request.items) {
        if (item.itemType === 'MATERIAL' && item.materialId) {
          const mat = await tx.hospitalMaterial.findUnique({ where: { id: item.materialId } })
          if (!mat || mat.availableQty < item.quantity) {
            throw new Error(`ยอดคงเหลือไม่เพียงพอสำหรับ ${item.itemName} (ต้องการ ${item.quantity}, คงเหลือ ${mat?.availableQty || 0})`)
          }
          await tx.hospitalMaterial.update({
            where: { id: item.materialId },
            data: { availableQty: { decrement: item.quantity } },
          })

          // If consumable, mark item as CONSUMED immediately
          if (item.material?.materialType === 'CONSUMABLE') {
            await tx.equipmentBorrowItem.update({
              where: { id: item.id },
              data: { status: 'CONSUMED', returnedQty: item.quantity, returnedAt: new Date() },
            })
          }
        }
      }

      // Check if all items in request are consumable, request can be completed directly
      const hasReturnableItems = request.items.some(
        (it: any) => it.itemType === 'ASSET' || it.material?.materialType !== 'CONSUMABLE'
      )
      const nextStatus = hasReturnableItems ? 'APPROVED' : 'RETURNED'

      const updated = await tx.equipmentBorrowRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedById: actor.id || null,
          approvedByName: actor.name || actor.username || 'Admin',
          approvedAt: new Date(),
          actualReturnDate: !hasReturnableItems ? new Date() : null,
        },
        include: { items: true },
      })

      await logAudit(
        'UPDATE',
        'equipment_borrow_requests',
        JSON.stringify({ requestId: id, requestNo: request.requestNo, nextStatus }),
        { username: actor.username || 'admin' }
      )

      return updated
    })
  }

  async rejectBorrowRequest(id: number, reason: string, actor: Actor) {
    const request = await this.db.equipmentBorrowRequest.findUnique({ where: { id } })
    if (!request) {
      throw new Error(`ไม่พบคำขอยืมรหัส ${id}`)
    }
    if (request.status !== 'PENDING') {
      throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${request.status})`)
    }

    const updated = await this.db.equipmentBorrowRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason: reason.trim(),
        approvedById: actor.id || null,
        approvedByName: actor.name || actor.username || 'Admin',
        approvedAt: new Date(),
      },
    })

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: id, reason, action: 'REJECT' }),
      { username: actor.username || 'admin' }
    )

    return updated
  }

  // ==========================================
  // 4. Return Inspection & Restocking
  // ==========================================

  async getActiveLoans(options: {
    search?: string
    overdueOnly?: boolean
    page?: number
    limit?: number
  } = {}) {
    const { search, overdueOnly, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    const where: any = {
      status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
    }

    if (overdueOnly) {
      where.expectedReturnDate = { lt: new Date() }
    }

    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { requestNo: { contains: q } },
        { requesterName: { contains: q } },
        { purpose: { contains: q } },
      ]
    }

    const [items, total] = await Promise.all([
      this.db.equipmentBorrowRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expectedReturnDate: 'asc' },
        include: {
          items: {
            include: {
              material: true,
              asset: true,
            },
          },
        },
      }),
      this.db.equipmentBorrowRequest.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async processItemReturn(requestId: number, returns: ItemReturnInput[], actor: Actor) {
    const request = await this.db.equipmentBorrowRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            material: true,
            asset: true,
          },
        },
      },
    })

    if (!request) {
      throw new Error(`ไม่พบคำขอยืมรหัส ${requestId}`)
    }
    if (!['APPROVED', 'PARTIAL_RETURNED'].includes(request.status)) {
      throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะกำลังยืม (สถานะปัจจุบัน: ${request.status})`)
    }

    return await this.db.$transaction(async (tx: any) => {
      const now = new Date()

      for (const ret of returns) {
        const item = request.items.find((i: any) => i.id === ret.itemId)
        if (!item) continue

        const returnQty = Math.min(ret.returnedQty, item.quantity - item.returnedQty)
        if (returnQty <= 0) continue

        const totalReturned = item.returnedQty + returnQty
        const isItemFullyReturned = totalReturned >= item.quantity

        let itemStatus = 'BORROWED'
        if (isItemFullyReturned) {
          itemStatus = ret.condition === 'LOST' ? 'LOST' : ret.condition === 'DAMAGED' ? 'DAMAGED' : 'RETURNED'
        }

        await tx.equipmentBorrowItem.update({
          where: { id: item.id },
          data: {
            returnedQty: totalReturned,
            status: itemStatus,
            returnCondition: ret.condition,
            returnNotes: ret.notes?.trim() || null,
            returnedAt: now,
            inspectedById: actor.id || null,
            inspectedByName: actor.name || actor.username || 'Admin',
          },
        })

        // Restock material if REUSABLE and returned in NORMAL condition
        if (item.itemType === 'MATERIAL' && item.materialId && item.material?.materialType === 'REUSABLE') {
          if (ret.condition === 'NORMAL') {
            await tx.hospitalMaterial.update({
              where: { id: item.materialId },
              data: { availableQty: { increment: returnQty } },
            })
          }
        }
      }

      // Check request overall status
      const updatedItems = await tx.equipmentBorrowItem.findMany({ where: { requestId } })
      const allDone = updatedItems.every((it: any) => it.returnedQty >= it.quantity || it.status === 'CONSUMED')

      const updatedRequest = await tx.equipmentBorrowRequest.update({
        where: { id: requestId },
        data: {
          status: allDone ? 'RETURNED' : 'PARTIAL_RETURNED',
          actualReturnDate: allDone ? now : null,
        },
        include: { items: true },
      })

      await logAudit(
        'UPDATE',
        'equipment_borrow_requests',
        JSON.stringify({ requestId, returnedItems: returns.length, allDone, action: 'RETURN_INSPECTION' }),
        { username: actor.username || 'admin' }
      )

      return updatedRequest
    })
  }

  // ==========================================
  // 5. Dashboard Metrics & Overdue Tracking
  // ==========================================

  async getBorrowDashboardStats(): Promise<BorrowDashboardStats> {
    const today = new Date()

    const [
      loanableAssetsCount,
      materialTotalAgg,
      materialAvailAgg,
      borrowedItemsCount,
      overdueRequestsCount,
    ] = await Promise.all([
      this.db.hospitalAsset.count({ where: { isLoanable: true } }),
      this.db.hospitalMaterial.aggregate({
        where: { isActive: true },
        _sum: { totalQty: true },
      }),
      this.db.hospitalMaterial.aggregate({
        where: { isActive: true },
        _sum: { availableQty: true },
      }),
      this.db.equipmentBorrowItem.count({
        where: { status: 'BORROWED' },
      }),
      this.db.equipmentBorrowRequest.count({
        where: {
          status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
          expectedReturnDate: { lt: today },
        },
      }),
    ])

    const totalMaterials = materialTotalAgg._sum?.totalQty || 0
    const availableMaterials = materialAvailAgg._sum?.availableQty || 0

    return {
      totalItems: loanableAssetsCount + totalMaterials,
      availableItems: loanableAssetsCount + availableMaterials,
      borrowedItems: borrowedItemsCount,
      overdueRequests: overdueRequestsCount,
    }
  }
}

export const equipmentBorrowService = new EquipmentBorrowService()

