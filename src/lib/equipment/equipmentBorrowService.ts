import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegramService'

import {
  type Actor,
  type OverdueNotificationDetail,
  type OverdueNotificationResult,
  type CreateMaterialInput,
  type UpdateMaterialInput,
  type BorrowBasketItemInput,
  type CreateBorrowRequestInput,
  type ItemReturnInput,
  type BorrowDashboardStats,
  mapDbRowToMaterial,
  mapDbRowToRequest,
  mapDbRowToItem,
} from './equipmentBorrowTypes'
import { dispatchOverdueBorrowNotifications } from './equipmentBorrowOverdueNotifier'

export {
  type Actor,
  type OverdueNotificationDetail,
  type OverdueNotificationResult,
  type CreateMaterialInput,
  type UpdateMaterialInput,
  type BorrowBasketItemInput,
  type CreateBorrowRequestInput,
  type ItemReturnInput,
  type BorrowDashboardStats,
}

function mapBorrowBundleToRequest(bundle: {
  request: Record<string, unknown>
  items: Array<Record<string, unknown>>
}) {
  const mappedItems = (bundle.items || []).map((it: any) => ({
    ...it,
    asset: it.asset_id
      ? { id: it.asset_id, name: it.asset_name, brand: it.asset_brand, articleNum: it.asset_code }
      : null,
    material: it.material_id
      ? { id: it.material_id, name: it.mat_name, unit: it.mat_unit, materialType: it.mat_type }
      : null,
  }))
  return mapDbRowToRequest(bundle.request, mappedItems)
}

/**
 * Deep Domain Service for Equipment & Material Borrowing Management
 * Zero-SQL Architecture: routes queries via Gateway Named Endpoints.
 */
export class EquipmentBorrowService {
  constructor(
    private readonly db: any = null,
    private readonly gateway = apiGateway.app,
    private readonly telegramSender: (chatId: string | number, text: string, options?: any) => Promise<any> = sendTelegramMessage
  ) {}

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

    if (this.db?.hospitalMaterial) {
      const where: any = {}
      if (search && search.trim()) {
        const q = search.trim()
        where.OR = [
          { name: { contains: q } },
          { location: { contains: q } },
          { notes: { contains: q } },
        ]
      }
      if (category && category !== 'ALL') where.category = category
      if (materialType && materialType !== 'ALL') where.materialType = materialType
      if (typeof isActive === 'boolean') where.isActive = isActive

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

    const { total: rawTotal, items: itemRows } = await this.gateway.listBorrowMaterialsV2({
      search,
      category,
      materialType,
      isActive,
      page,
      limit,
    })

    const total = Number(rawTotal || 0)
    const items = (itemRows || []).map(mapDbRowToMaterial)

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

    if (this.db?.hospitalMaterial) {
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

    const createdRow = await this.gateway.createBorrowMaterialV2({
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
    })
    const material = mapDbRowToMaterial(createdRow)

    await logAudit(
      'CREATE',
      'hospital_materials',
      JSON.stringify({ materialId: material.id, name: material.name, totalQty }),
      { username: actor.username || 'system' }
    )

    return material
  }

  async updateMaterial(id: number, input: UpdateMaterialInput, actor: Actor) {
    if (this.db?.hospitalMaterial) {
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
        data.totalQty = Math.max(0, input.totalQty)
        if (input.availableQty !== undefined) {
          data.availableQty = Math.max(0, input.availableQty)
        } else {
          const activeBorrowed = await this.db.equipmentBorrowItem.aggregate({
            where: {
              materialId: id,
              status: 'BORROWED',
              request: { status: { in: ['APPROVED', 'PARTIAL_RETURNED'] } },
            },
            _sum: { quantity: true },
          })
          const currentlyBorrowed = Number(activeBorrowed?._sum?.quantity || 0)
          data.availableQty = Math.max(0, data.totalQty - currentlyBorrowed)
        }
      } else if (input.availableQty !== undefined) {
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

    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) payload.name = input.name.trim()
    if (input.category !== undefined) payload.category = input.category
    if (input.materialType !== undefined) payload.materialType = input.materialType
    if (input.unit !== undefined) payload.unit = input.unit.trim()
    if (input.location !== undefined) payload.location = input.location?.trim() || null
    if (input.imageUrl !== undefined) payload.imageUrl = input.imageUrl?.trim() || null
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
    if (input.isActive !== undefined) payload.isActive = input.isActive
    if (input.totalQty !== undefined) payload.totalQty = Math.max(0, input.totalQty)
    if (input.availableQty !== undefined) payload.availableQty = Math.max(0, input.availableQty)

    const updatedRow = await this.gateway.updateBorrowMaterialV2(id, payload)
    const updated = mapDbRowToMaterial(updatedRow)

    await logAudit(
      'UPDATE',
      'hospital_materials',
      JSON.stringify({ materialId: id, changes: input }),
      { username: actor.username || 'system' }
    )

    return updated
  }

  async deleteMaterial(id: number, actor: Actor) {
    if (this.db?.hospitalMaterial) {
      const existing = await this.db.hospitalMaterial.findUnique({ where: { id } })
      if (!existing) {
        throw new Error(`ไม่พบวัสดุรหัส ${id}`)
      }

      // Detach referencing borrow items to maintain borrow history without foreign key violations
      await this.db.equipmentBorrowItem.updateMany({
        where: { materialId: id },
        data: { materialId: null },
      })

      await this.db.hospitalMaterial.delete({ where: { id } })
      await logAudit(
        'DELETE',
        'hospital_materials',
        JSON.stringify({ materialId: id, name: existing.name }),
        { username: actor.username || 'system' }
      )
      return { success: true }
    }

    const { name } = await this.gateway.deleteBorrowMaterialV2(id)
    await logAudit(
      'DELETE',
      'hospital_materials',
      JSON.stringify({ materialId: id, name }),
      { username: actor.username || 'system' }
    )
    return { success: true }
  }

  async toggleAssetLoanable(assetId: number, isLoanable: boolean, actor: Actor) {
    if (this.db?.hospitalAsset) {
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

    const { asset, articleNum } = await this.gateway.toggleBorrowAssetLoanableV2(assetId, isLoanable)

    await logAudit(
      'UPDATE',
      'hospital_assets',
      JSON.stringify({ assetId, articleNum, isLoanable }),
      { username: actor.username || 'system' }
    )

    return asset
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

    if (this.db?.hospitalAsset) {
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

    const { total: rawTotal, items: itemRows } = await this.gateway.listLoanableAssetsV2({
      search,
      category,
      isLoanable,
      page,
      limit,
    })

    const total = Number(rawTotal || 0)

    return {
      items: itemRows || [],
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

    if (this.db?.hospitalAsset) {
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
        if (category && category !== 'ALL') assetWhere.category = category

        const borrowedAssetItems = typeof this.db.equipmentBorrowItem?.findMany === 'function'
          ? await this.db.equipmentBorrowItem.findMany({
              where: {
                itemType: 'ASSET',
                status: 'BORROWED',
                request: {
                  status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
                },
              },
              select: { assetId: true, quantity: true, returnedQty: true },
            })
          : []
        const borrowedAssetIdSet = new Set(
          borrowedAssetItems
            .filter((it: any) => (it.quantity || 0) > (it.returnedQty || 0))
            .map((it: any) => it.assetId)
            .filter(Boolean)
        )

        const assets = await this.db.hospitalAsset.findMany({
          where: assetWhere,
          take: 100,
          orderBy: { name: 'asc' },
        })

        for (const a of assets) {
          const isBorrowed = borrowedAssetIdSet.has(a.id)
          results.push({
            id: a.id,
            itemType: 'ASSET',
            name: a.name + (a.brand ? ` (${a.brand})` : ''),
            code: a.articleNum,
            category: a.category,
            subType: 'ครุภัณฑ์',
            availableQty: isBorrowed ? 0 : 1,
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
        if (category && category !== 'ALL') matWhere.category = category

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

    const catalog = await this.gateway.getBorrowCatalogV2({ search, category, type })
    const borrowedAssetIdSet = new Set((catalog.borrowedAssetIds || []).map((id) => Number(id)))

    for (const a of (catalog.assets || []) as Array<Record<string, any>>) {
      const isBorrowed = borrowedAssetIdSet.has(Number(a.id))
      results.push({
        id: a.id,
        itemType: 'ASSET',
        name: a.name + (a.brand ? ` (${a.brand})` : ''),
        code: a.articleNum,
        category: a.category,
        subType: 'ครุภัณฑ์',
        availableQty: isBorrowed ? 0 : 1,
        unit: 'เครื่อง/ชิ้น',
        location: a.locationFullName,
        imageUrl: a.imageUrl,
      })
    }

    for (const m of (catalog.materials || []) as Array<Record<string, any>>) {
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

    if (this.db?.equipmentBorrowRequest) {
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
          if (typeof this.db.equipmentBorrowItem?.findFirst === 'function') {
            const activeLoan = await this.db.equipmentBorrowItem.findFirst({
              where: {
                itemType: 'ASSET',
                assetId: item.assetId,
                status: 'BORROWED',
                request: { status: { in: ['APPROVED', 'PARTIAL_RETURNED'] } },
              },
            })
            if (activeLoan) {
              throw new Error(`ครุภัณฑ์ ${item.itemName} อยู่ระหว่างการยืมโดยผู้อื่นในขณะนี้`)
            }
          }
        }
      }

      const now = new Date()
      const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`
      const prefix = `BR-${yearMonth}-`
      let nextSeq = 1

      if (typeof this.db.equipmentBorrowRequest?.findFirst === 'function') {
        const latestThisMonth = await this.db.equipmentBorrowRequest.findFirst({
          where: { requestNo: { startsWith: prefix } },
          orderBy: { requestNo: 'desc' },
          select: { requestNo: true },
        })
        if (latestThisMonth?.requestNo) {
          const parts = latestThisMonth.requestNo.split('-')
          const lastNum = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(lastNum)) nextSeq = lastNum + 1
        }
      } else {
        const countThisMonth = await this.db.equipmentBorrowRequest.count()
        nextSeq = countThisMonth + 1
      }
      const requestNo = `${prefix}${nextSeq.toString().padStart(4, '0')}`

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
              status: 'PENDING',
            })),
          },
        },
        include: { items: true },
      })

      await logAudit(
        'CREATE',
        'equipment_borrow_requests',
        JSON.stringify({ requestId: request.id, requestNo: request.requestNo, itemsCount: input.items.length }),
        { username: requester.name }
      )

      return request
    }

    // Zero-SQL Gateway Named Endpoint implementation
    const formattedBorrowDate = input.borrowDate instanceof Date
      ? input.borrowDate.toISOString().slice(0, 10)
      : String(input.borrowDate).slice(0, 10)
    const formattedExpectedReturnDate = input.expectedReturnDate
      ? (input.expectedReturnDate instanceof Date
          ? input.expectedReturnDate.toISOString().slice(0, 10)
          : String(input.expectedReturnDate).slice(0, 10))
      : null

    const fullBundle = await this.gateway.createBorrowRequestV2({
      input: {
        purpose: input.purpose.trim(),
        location: input.location?.trim() || null,
        borrowDate: formattedBorrowDate,
        expectedReturnDate: formattedExpectedReturnDate,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
        items: input.items,
      },
      requester,
    })

    const created = mapBorrowBundleToRequest(fullBundle)

    await logAudit(
      'CREATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: created.id, requestNo: created.requestNo, itemsCount: input.items.length }),
      { username: requester.name }
    )

    return created
  }

  async getMyBorrowRequests(requesterId: number, options: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    if (this.db?.equipmentBorrowRequest) {
      const where: any = { requesterId }
      if (status && status !== 'ALL') where.status = status

      const [items, total] = await Promise.all([
        this.db.equipmentBorrowRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
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

    const { total: rawTotal, bundles } = await this.gateway.listBorrowRequestsV2({
      requesterId,
      status,
      page,
      limit,
    })

    const total = Number(rawTotal || 0)
    const items = (bundles || []).map(mapBorrowBundleToRequest)

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async getBorrowRequestById(id: number) {
    if (this.db?.equipmentBorrowRequest) {
      return this.db.equipmentBorrowRequest.findUnique({
        where: { id },
        include: {
          items: {
            include: { asset: true, material: true },
          },
        },
      })
    }

    const bundle = await this.gateway.getBorrowRequestByIdV2(id)
    return bundle ? mapBorrowBundleToRequest(bundle) : null
  }

  // ==========================================
  // 3. Approval and Dispense
  // ==========================================

  async getPendingRequests(options: { search?: string; page?: number; limit?: number } = {}) {
    return this.getAllBorrowRequests({ ...options, status: 'PENDING' })
  }

  async getAllBorrowRequests(options: {
    status?: string
    search?: string
    page?: number
    limit?: number
  } = {}) {
    const { status, search, page = 1, limit = 20 } = options
    const skip = (Math.max(1, page) - 1) * limit

    if (this.db?.equipmentBorrowRequest) {
      const where: any = {}
      if (status && status !== 'ALL') where.status = status
      if (search && search.trim()) {
        const q = search.trim()
        where.OR = [
          { requestNo: { contains: q } },
          { requesterName: { contains: q } },
          { purpose: { contains: q } },
          { location: { contains: q } },
        ]
      }

      const [items, total] = await Promise.all([
        this.db.equipmentBorrowRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: { material: true, asset: true },
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

    const { total: rawTotal, bundles } = await this.gateway.listBorrowRequestsV2({
      status,
      search,
      page,
      limit,
    })

    const total = Number(rawTotal || 0)
    const items = (bundles || []).map(mapBorrowBundleToRequest)

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async approveAndDispenseRequest(id: number, actor: Actor) {
    if (this.db?.equipmentBorrowRequest) {
      const request = await this.db.equipmentBorrowRequest.findUnique({
        where: { id },
        include: {
          items: {
            include: { material: true, asset: true },
          },
        },
      })

      if (!request) throw new Error(`ไม่พบคำขอยืมรหัส ${id}`)
      if (request.status !== 'PENDING') throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${request.status})`)

      return await this.db.$transaction(async (tx: any) => {
        // 1. Pre-validate stock availability for materials and check asset availability
        for (const item of request.items) {
          if (item.itemType === 'ASSET' && item.assetId && typeof tx.equipmentBorrowItem?.findFirst === 'function') {
            const activeLoan = await tx.equipmentBorrowItem.findFirst({
              where: {
                itemType: 'ASSET',
                assetId: item.assetId,
                status: 'BORROWED',
                requestId: { not: id },
                request: { status: { in: ['APPROVED', 'PARTIAL_RETURNED'] } },
              },
            })
            if (activeLoan) {
              throw new Error(`ครุภัณฑ์ ${item.itemName} กำลังถูกยืมโดยคำขออื่นในขณะนี้ ไม่สามารถอนุมัติจ่ายซ้ำได้`)
            }
          }
        }

        const requiredQuantities = new Map<number, number>()
        for (const item of request.items) {
          if (item.itemType === 'MATERIAL' && item.materialId) {
            const currentReq = requiredQuantities.get(item.materialId) || 0
            requiredQuantities.set(item.materialId, currentReq + item.quantity)
          }
        }

        const materialCache = new Map<number, any>()
        for (const [matId, totalNeeded] of requiredQuantities.entries()) {
          const mat = await tx.hospitalMaterial.findUnique({ where: { id: matId } })
          if (!mat || mat.availableQty < totalNeeded) {
            const item = request.items.find((i: any) => i.materialId === matId)
            throw new Error(`ยอดคงเหลือไม่เพียงพอสำหรับ ${mat?.name || item?.itemName || 'วัสดุ'} (ต้องการ ${totalNeeded}, คงเหลือ ${mat?.availableQty || 0})`)
          }
          materialCache.set(matId, mat)
        }

        // 2. Perform updates
        for (const item of request.items) {
          if (item.itemType === 'MATERIAL' && item.materialId) {
            const mat = materialCache.get(item.materialId)
            await tx.hospitalMaterial.update({
              where: { id: item.materialId },
              data: { availableQty: { decrement: item.quantity } },
            })

            if (item.material?.materialType === 'CONSUMABLE' || mat?.materialType === 'CONSUMABLE') {
              await tx.equipmentBorrowItem.update({
                where: { id: item.id },
                data: { status: 'CONSUMED', returnedQty: item.quantity, returnedAt: new Date() },
              })
            } else {
              await tx.equipmentBorrowItem.update({
                where: { id: item.id },
                data: { status: 'BORROWED' },
              })
            }
          } else if (item.itemType === 'ASSET') {
            await tx.equipmentBorrowItem.update({
              where: { id: item.id },
              data: { status: 'BORROWED' },
            })
          }
        }

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

    const { updated, nextStatus, requestNo } = await this.gateway.approveBorrowRequestV2(
      id,
      actor as unknown as Record<string, unknown>
    )

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: id, requestNo, nextStatus }),
      { username: actor.username || 'admin' }
    )

    return mapBorrowBundleToRequest(updated)
  }

  async rejectBorrowRequest(id: number, reason: string, actor: Actor) {
    if (this.db?.equipmentBorrowRequest) {
      const request = await this.db.equipmentBorrowRequest.findUnique({ where: { id } })
      if (!request) throw new Error(`ไม่พบคำขอยืมรหัส ${id}`)
      if (request.status !== 'PENDING') throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${request.status})`)

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

      if (typeof this.db.equipmentBorrowItem?.updateMany === 'function') {
        await this.db.equipmentBorrowItem.updateMany({
          where: { requestId: id },
          data: { status: 'REJECTED' },
        })
      }

      await logAudit(
        'UPDATE',
        'equipment_borrow_requests',
        JSON.stringify({ requestId: id, reason, action: 'REJECT' }),
        { username: actor.username || 'admin' }
      )

      return updated
    }

    const updatedBundle = await this.gateway.rejectBorrowRequestV2(
      id,
      reason,
      actor as unknown as Record<string, unknown>
    )

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: id, reason, action: 'REJECT' }),
      { username: actor.username || 'admin' }
    )

    return mapBorrowBundleToRequest(updatedBundle)
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

    if (this.db?.equipmentBorrowRequest) {
      const where: any = {
        status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
      }
      if (overdueOnly) where.expectedReturnDate = { lt: new Date() }
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
              include: { material: true, asset: true },
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

    const { total: rawTotal, bundles } = await this.gateway.listBorrowRequestsV2({
      search,
      overdueOnly,
      activeOnly: true,
      page,
      limit,
    })

    const total = Number(rawTotal || 0)
    const items = (bundles || []).map(mapBorrowBundleToRequest)

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async processItemReturn(requestId: number, returns: ItemReturnInput[], actor: Actor) {
    if (this.db?.equipmentBorrowRequest) {
      const request = await this.db.equipmentBorrowRequest.findUnique({
        where: { id: requestId },
        include: {
          items: {
            include: { material: true, asset: true },
          },
        },
      })

      if (!request) throw new Error(`ไม่พบคำขอยืมรหัส ${requestId}`)
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

          if (item.itemType === 'MATERIAL' && item.materialId && item.material?.materialType === 'REUSABLE') {
            if (ret.condition === 'NORMAL') {
              await tx.hospitalMaterial.update({
                where: { id: item.materialId },
                data: { availableQty: { increment: returnQty } },
              })
            }
          }
        }

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

    const { updated, allDone } = await this.gateway.returnBorrowItemsV2(
      requestId,
      returns as unknown as Array<Record<string, unknown>>,
      actor as unknown as Record<string, unknown>
    )

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId, returnedItems: returns.length, allDone, action: 'RETURN_INSPECTION' }),
      { username: actor.username || 'admin' }
    )

    return mapBorrowBundleToRequest(updated)
  }

  // ==========================================
  // 5. Dashboard Metrics & Overdue Tracking
  // ==========================================

  async getBorrowDashboardStats(): Promise<BorrowDashboardStats> {
    if (this.db?.hospitalAsset) {
      const today = new Date()

      const loanableAssetsCount = await this.db.hospitalAsset.count({
        where: { isLoanable: true, status: 'ACTIVE' },
      })

      const [materialTotalAgg, materialAvailAgg] = await Promise.all([
        this.db.hospitalMaterial.aggregate({
          where: { isActive: true },
          _sum: { totalQty: true },
        }),
        this.db.hospitalMaterial.aggregate({
          where: { isActive: true },
          _sum: { availableQty: true },
        }),
      ])

      const totalMaterials = materialTotalAgg._sum?.totalQty || 0
      const availableMaterials = materialAvailAgg._sum?.availableQty || 0

      let borrowedPiecesCount = 0
      let borrowedAssetsCount = 0

      if (typeof this.db.equipmentBorrowItem.findMany === 'function') {
        const items = (await this.db.equipmentBorrowItem.findMany({
          where: {
            status: 'BORROWED',
            request: {
              status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
            },
          },
          select: { itemType: true, quantity: true, returnedQty: true },
        })) || []

        for (const it of items) {
          const remaining = Math.max(0, (it.quantity || 0) - (it.returnedQty || 0))
          borrowedPiecesCount += remaining
          if (it.itemType === 'ASSET') borrowedAssetsCount += remaining
        }
      }

      if (borrowedPiecesCount === 0 && typeof this.db.equipmentBorrowItem.count === 'function') {
        const cnt = await this.db.equipmentBorrowItem.count({
          where: {
            status: 'BORROWED',
            request: {
              status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
            },
          },
        })
        if (cnt > 0) borrowedPiecesCount = cnt
      }

      const availableAssets = Math.max(0, loanableAssetsCount - borrowedAssetsCount)
      let overduePiecesCount = 0

      if (typeof this.db.equipmentBorrowRequest.findMany === 'function') {
        const requests = (await this.db.equipmentBorrowRequest.findMany({
          where: {
            status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
            expectedReturnDate: { lt: today },
          },
          select: {
            items: {
              where: { status: 'BORROWED' },
              select: { quantity: true, returnedQty: true },
            },
          },
        })) || []

        for (const req of requests) {
          if (req.items && Array.isArray(req.items)) {
            for (const it of req.items) {
              overduePiecesCount += Math.max(0, (it.quantity || 0) - (it.returnedQty || 0))
            }
          }
        }
      }

      if (overduePiecesCount === 0 && typeof this.db.equipmentBorrowRequest.count === 'function') {
        const cnt = await this.db.equipmentBorrowRequest.count({
          where: {
            status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
            expectedReturnDate: { lt: today },
          },
        })
        if (cnt > 0) overduePiecesCount = cnt
      }

      return {
        totalItems: loanableAssetsCount + totalMaterials,
        availableItems: availableAssets + availableMaterials,
        borrowedItems: borrowedPiecesCount,
        overdueRequests: overduePiecesCount,
      }
    }

    // Zero-SQL Production Execution
    return this.gateway.getBorrowStatsV2()
  }

  // ==========================================
  // 6. Overdue Notification Dispatcher (15:00 Daily Cron)
  // ==========================================

  async dispatchOverdueNotifications(options: { siteUrl?: string } = {}): Promise<OverdueNotificationResult> {
    return dispatchOverdueBorrowNotifications(this.db, this.gateway, this.telegramSender, options)
  }
}

export const equipmentBorrowService = new EquipmentBorrowService()
