import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegramService'

export interface Actor {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
}

export interface OverdueNotificationDetail {
  requestId: number
  requestNo: string
  requesterId: number
  requesterName: string
  requesterDept?: string | null
  overdueDays: number
  expectedReturnDate: string
  remainingItemsCount: number
  status: 'SENT' | 'SKIPPED_NO_TELEGRAM' | 'FAILED'
  error?: string
}

export interface OverdueNotificationResult {
  success: boolean
  totalOverdue: number
  sentCount: number
  skippedNoTelegramCount: number
  failedCount: number
  timestamp: string
  details: OverdueNotificationDetail[]
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

function mapDbRowToMaterial(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    materialType: row.material_type || row.materialType,
    totalQty: row.total_qty !== undefined ? Number(row.total_qty) : Number(row.totalQty || 0),
    availableQty: row.available_qty !== undefined ? Number(row.available_qty) : Number(row.availableQty || 0),
    unit: row.unit,
    location: row.location,
    imageUrl: row.image_url || row.imageUrl,
    notes: row.notes,
    isActive: Boolean(row.is_active !== undefined ? row.is_active : row.isActive),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  }
}

function mapDbRowToRequest(row: any, items: any[] = []) {
  return {
    id: row.id,
    requestNo: row.request_no || row.requestNo,
    requesterId: row.requester_id || row.requesterId,
    requesterName: row.requester_name || row.requesterName,
    requesterDept: row.requester_dept || row.requesterDept,
    purpose: row.purpose,
    location: row.location,
    borrowDate: row.borrow_date || row.borrowDate,
    expectedReturnDate: row.expected_return_date || row.expectedReturnDate,
    actualReturnDate: row.actual_return_date || row.actualReturnDate,
    phone: row.phone,
    notes: row.notes,
    status: row.status,
    approvedById: row.approved_by_id || row.approvedById,
    approvedByName: row.approved_by_name || row.approvedByName,
    approvedAt: row.approved_at || row.approvedAt,
    rejectReason: row.reject_reason || row.rejectReason,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    items: items.map(mapDbRowToItem),
  }
}

function mapDbRowToItem(row: any) {
  return {
    id: row.id,
    requestId: row.request_id || row.requestId,
    itemType: row.item_type || row.itemType,
    assetId: row.asset_id || row.assetId,
    materialId: row.material_id || row.materialId,
    itemName: row.item_name || row.itemName,
    itemCode: row.item_code || row.itemCode,
    quantity: Number(row.quantity || 0),
    returnedQty: Number(row.returned_qty !== undefined ? row.returned_qty : (row.returnedQty || 0)),
    status: row.status,
    returnCondition: row.return_condition || row.returnCondition,
    returnNotes: row.return_notes || row.returnNotes,
    returnedAt: row.returned_at || row.returnedAt,
    inspectedById: row.inspected_by_id || row.inspectedById,
    inspectedByName: row.inspected_by_name || row.inspectedByName,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    asset: row.asset || null,
    material: row.material || null,
  }
}

/**
 * Deep Domain Service for Equipment & Material Borrowing Management
 * Zero-DB Architecture: routes queries via queryMemberDb / API Gateway.
 */
export class EquipmentBorrowService {
  constructor(
    private readonly db: any = null,
    private readonly queryExecutor: (sql: string, params?: any[]) => Promise<any[]> = queryMemberDb,
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

    const whereClauses: string[] = []
    const params: any[] = []

    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      whereClauses.push('(name LIKE ? OR location LIKE ? OR notes LIKE ?)')
      params.push(q, q, q)
    }
    if (category && category !== 'ALL') {
      whereClauses.push('category = ?')
      params.push(category)
    }
    if (materialType && materialType !== 'ALL') {
      whereClauses.push('material_type = ?')
      params.push(materialType)
    }
    if (typeof isActive === 'boolean') {
      whereClauses.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const [countRows, itemRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM hospital_materials ${whereSql}`, params),
      this.queryExecutor(
        `SELECT * FROM hospital_materials ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...params, limit, skip]
      ),
    ])

    const total = Number(countRows[0]?.total || 0)
    const items = itemRows.map(mapDbRowToMaterial)

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

    const res: any = await this.queryExecutor(`
      INSERT INTO hospital_materials (
        name, category, material_type, total_qty, available_qty, unit,
        location, image_url, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      input.name.trim(),
      input.category || 'GENERAL',
      input.materialType || 'REUSABLE',
      totalQty,
      availableQty,
      input.unit?.trim() || 'ชิ้น',
      input.location?.trim() || null,
      input.imageUrl?.trim() || null,
      input.notes?.trim() || null,
      input.isActive ?? true ? 1 : 0,
    ])

    const rows = await this.queryExecutor('SELECT * FROM hospital_materials WHERE id = ?', [res.insertId])
    const material = mapDbRowToMaterial(rows[0])

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

    const existingRows = await this.queryExecutor('SELECT * FROM hospital_materials WHERE id = ?', [id])
    if (existingRows.length === 0) {
      throw new Error(`ไม่พบวัสดุรหัส ${id}`)
    }
    const existing = existingRows[0]

    const fields: string[] = []
    const params: any[] = []

    if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name.trim()) }
    if (input.category !== undefined) { fields.push('category = ?'); params.push(input.category) }
    if (input.materialType !== undefined) { fields.push('material_type = ?'); params.push(input.materialType) }
    if (input.unit !== undefined) { fields.push('unit = ?'); params.push(input.unit.trim()) }
    if (input.location !== undefined) { fields.push('location = ?'); params.push(input.location?.trim() || null) }
    if (input.imageUrl !== undefined) { fields.push('image_url = ?'); params.push(input.imageUrl?.trim() || null) }
    if (input.notes !== undefined) { fields.push('notes = ?'); params.push(input.notes?.trim() || null) }
    if (input.isActive !== undefined) { fields.push('is_active = ?'); params.push(input.isActive ? 1 : 0) }

    if (input.totalQty !== undefined) {
      const newTotalQty = Math.max(0, input.totalQty)
      fields.push('total_qty = ?')
      params.push(newTotalQty)

      if (input.availableQty !== undefined) {
        fields.push('available_qty = ?')
        params.push(Math.max(0, input.availableQty))
      } else {
        const borrowedRows = await this.queryExecutor(`
          SELECT COALESCE(SUM(i.quantity - i.returned_qty), 0) AS borrowed
          FROM equipment_borrow_items i
          JOIN equipment_borrow_requests r ON i.request_id = r.id
          WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED')
            AND i.status = 'BORROWED'
            AND i.material_id = ?
        `, [id])
        const currentlyBorrowed = Number(borrowedRows[0]?.borrowed || 0)
        fields.push('available_qty = ?')
        params.push(Math.max(0, newTotalQty - currentlyBorrowed))
      }
    } else if (input.availableQty !== undefined) {
      fields.push('available_qty = ?')
      params.push(Math.max(0, input.availableQty))
    }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()')
      params.push(id)
      await this.queryExecutor(`UPDATE hospital_materials SET ${fields.join(', ')} WHERE id = ?`, params)
    }

    const updatedRows = await this.queryExecutor('SELECT * FROM hospital_materials WHERE id = ?', [id])
    const updated = mapDbRowToMaterial(updatedRows[0])

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

    const existingRows = await this.queryExecutor('SELECT * FROM hospital_materials WHERE id = ?', [id])
    if (existingRows.length === 0) {
      throw new Error(`ไม่พบวัสดุรหัส ${id}`)
    }
    const existing = existingRows[0]

    const usedRows = await this.queryExecutor('SELECT COUNT(*) as cnt FROM equipment_borrow_items WHERE material_id = ?', [id])
    const usedCount = Number(usedRows[0]?.cnt || 0)

    if (usedCount > 0) {
      await this.queryExecutor('UPDATE hospital_materials SET is_active = 0, updated_at = NOW() WHERE id = ?', [id])
      await logAudit(
        'UPDATE',
        'hospital_materials',
        JSON.stringify({ materialId: id, name: existing.name, action: 'DEACTIVATE' }),
        { username: actor.username || 'system' }
      )
      const rows = await this.queryExecutor('SELECT * FROM hospital_materials WHERE id = ?', [id])
      return mapDbRowToMaterial(rows[0])
    }

    await this.queryExecutor('DELETE FROM hospital_materials WHERE id = ?', [id])
    await logAudit(
      'DELETE',
      'hospital_materials',
      JSON.stringify({ materialId: id, name: existing.name }),
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

    const existingRows = await this.queryExecutor('SELECT id, article_num FROM hospital_assets WHERE id = ?', [assetId])
    if (existingRows.length === 0) {
      throw new Error(`ไม่พบครุภัณฑ์รหัส ${assetId}`)
    }

    await this.queryExecutor('UPDATE hospital_assets SET is_loanable = ?, updated_at = NOW() WHERE id = ?', [isLoanable ? 1 : 0, assetId])
    const rows = await this.queryExecutor('SELECT * FROM hospital_assets WHERE id = ?', [assetId])

    await logAudit(
      'UPDATE',
      'hospital_assets',
      JSON.stringify({ assetId, articleNum: existingRows[0].article_num, isLoanable }),
      { username: actor.username || 'system' }
    )

    return rows[0]
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

    const whereClauses: string[] = ['is_loanable = ?']
    const params: any[] = [isLoanable ? 1 : 0]

    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      whereClauses.push('(name LIKE ? OR article_num LIKE ? OR brand LIKE ? OR model LIKE ?)')
      params.push(q, q, q, q)
    }
    if (category && category !== 'ALL') {
      whereClauses.push('category = ?')
      params.push(category)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const [countRows, itemRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM hospital_assets ${whereSql}`, params),
      this.queryExecutor(
        `SELECT id, article_num AS articleNum, fsn_num AS fsnNum, name, brand, model, serial_no AS serialNo, category, location_full_name AS locationFullName, is_loanable AS isLoanable, status FROM hospital_assets ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...params, limit, skip]
      ),
    ])

    const total = Number(countRows[0]?.total || 0)

    return {
      items: itemRows,
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

    if (type === 'ALL' || type === 'ASSET') {
      const assetClauses = ['is_loanable = 1', "status = 'ACTIVE'"]
      const assetParams: any[] = []
      if (search && search.trim()) {
        const q = `%${search.trim()}%`
        assetClauses.push('(name LIKE ? OR article_num LIKE ? OR brand LIKE ?)')
        assetParams.push(q, q, q)
      }
      if (category && category !== 'ALL') {
        assetClauses.push('category = ?')
        assetParams.push(category)
      }

      const [assets, activeBorrowedAssets] = await Promise.all([
        this.queryExecutor(`
          SELECT id, name, brand, article_num AS articleNum, category, location_full_name AS locationFullName, image_url AS imageUrl
          FROM hospital_assets
          WHERE ${assetClauses.join(' AND ')}
          ORDER BY name ASC
          LIMIT 100
        `, assetParams),
        this.queryExecutor(`
          SELECT DISTINCT i.asset_id
          FROM equipment_borrow_items i
          JOIN equipment_borrow_requests r ON i.request_id = r.id
          WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED')
            AND i.status = 'BORROWED'
            AND i.item_type = 'ASSET'
            AND (i.quantity - i.returned_qty) > 0
            AND i.asset_id IS NOT NULL
        `),
      ])

      const borrowedAssetIdSet = new Set(activeBorrowedAssets.map((r: any) => Number(r.asset_id)))

      for (const a of assets) {
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
    }

    if (type === 'ALL' || type === 'MATERIAL') {
      const matClauses = ['is_active = 1', 'available_qty > 0']
      const matParams: any[] = []
      if (search && search.trim()) {
        const q = `%${search.trim()}%`
        matClauses.push('(name LIKE ? OR location LIKE ?)')
        matParams.push(q, q)
      }
      if (category && category !== 'ALL') {
        matClauses.push('category = ?')
        matParams.push(category)
      }

      const materials = await this.queryExecutor(`
        SELECT id, name, category, material_type AS materialType, available_qty AS availableQty, unit, location, image_url AS imageUrl
        FROM hospital_materials
        WHERE ${matClauses.join(' AND ')}
        ORDER BY name ASC
        LIMIT 100
      `, matParams)

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

    // Zero-DB Gateway implementation
    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error(`จำนวนของรายการ ${item.itemName} ต้องมากกว่า 0`)
      }
      if (item.itemType === 'MATERIAL') {
        if (!item.materialId) throw new Error('ไม่พบรหัสวัสดุ')
        const matRows = await this.queryExecutor('SELECT id, is_active, available_qty, unit FROM hospital_materials WHERE id = ?', [item.materialId])
        if (matRows.length === 0 || !matRows[0].is_active) {
          throw new Error(`วัสดุ ${item.itemName} ไม่พร้อมให้บริการ`)
        }
        if (matRows[0].available_qty < item.quantity) {
          throw new Error(`ยอดคงเหลือไม่เพียงพอสำหรับ ${item.itemName} (คงเหลือ ${matRows[0].available_qty} ${matRows[0].unit})`)
        }
      } else if (item.itemType === 'ASSET') {
        if (!item.assetId) throw new Error('ไม่พบรหัสครุภัณฑ์')
        const assetRows = await this.queryExecutor('SELECT id, is_loanable, status FROM hospital_assets WHERE id = ?', [item.assetId])
        if (assetRows.length === 0 || !assetRows[0].is_loanable || assetRows[0].status !== 'ACTIVE') {
          throw new Error(`ครุภัณฑ์ ${item.itemName} ไม่อยู่ในสถานะพร้อมให้ยืม`)
        }
        const activeLoans = await this.queryExecutor(
          `SELECT i.id FROM equipment_borrow_items i
           JOIN equipment_borrow_requests r ON i.request_id = r.id
           WHERE i.item_type = 'ASSET' AND i.asset_id = ? AND i.status = 'BORROWED'
             AND r.status IN ('APPROVED', 'PARTIAL_RETURNED') LIMIT 1`,
          [item.assetId]
        )
        if (activeLoans && activeLoans.length > 0) {
          throw new Error(`ครุภัณฑ์ ${item.itemName} อยู่ระหว่างการยืมโดยผู้อื่นในขณะนี้`)
        }
      }
    }

    const now = new Date()
    const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`
    const prefix = `BR-${yearMonth}-`
    const latestRows = await this.queryExecutor(
      'SELECT request_no FROM equipment_borrow_requests WHERE request_no LIKE ? ORDER BY request_no DESC LIMIT 1',
      [`${prefix}%`]
    )
    let nextSeq = 1
    if (latestRows && latestRows.length > 0 && latestRows[0].request_no) {
      const parts = String(latestRows[0].request_no).split('-')
      const lastNum = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastNum)) nextSeq = lastNum + 1
    }
    const requestNo = `${prefix}${nextSeq.toString().padStart(4, '0')}`

    const formattedBorrowDate = input.borrowDate instanceof Date
      ? input.borrowDate.toISOString().slice(0, 10)
      : String(input.borrowDate).slice(0, 10)
    const formattedExpectedReturnDate = input.expectedReturnDate
      ? (input.expectedReturnDate instanceof Date
          ? input.expectedReturnDate.toISOString().slice(0, 10)
          : String(input.expectedReturnDate).slice(0, 10))
      : null

    const res: any = await this.queryExecutor(`
      INSERT INTO equipment_borrow_requests (
        request_no, requester_id, requester_name, requester_dept, purpose,
        location, borrow_date, expected_return_date, phone, notes, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
    `, [
      requestNo,
      requester.id,
      requester.name,
      requester.department || null,
      input.purpose.trim(),
      input.location?.trim() || null,
      formattedBorrowDate,
      formattedExpectedReturnDate,
      input.phone?.trim() || null,
      input.notes?.trim() || null,
    ])

    const requestId = res.insertId

    for (const it of input.items) {
      await this.queryExecutor(`
        INSERT INTO equipment_borrow_items (
          request_id, item_type, asset_id, material_id, item_name,
          item_code, quantity, returned_qty, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', NOW(), NOW())
      `, [
        requestId,
        it.itemType,
        it.assetId || null,
        it.materialId || null,
        it.itemName,
        it.itemCode || null,
        it.quantity,
      ])
    }

    await logAudit(
      'CREATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId, requestNo, itemsCount: input.items.length }),
      { username: requester.name }
    )

    return this.getBorrowRequestById(requestId)
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

    const whereClauses = ['requester_id = ?']
    const params: any[] = [requesterId]
    if (status && status !== 'ALL') {
      whereClauses.push('status = ?')
      params.push(status)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const [countRows, reqRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM equipment_borrow_requests ${whereSql}`, params),
      this.queryExecutor(
        `SELECT * FROM equipment_borrow_requests ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, skip]
      ),
    ])

    const total = Number(countRows[0]?.total || 0)
    const items = await Promise.all(
      reqRows.map(async (r) => {
        const itemRows = await this.queryExecutor('SELECT * FROM equipment_borrow_items WHERE request_id = ?', [r.id])
        return mapDbRowToRequest(r, itemRows)
      })
    )

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

    const reqRows = await this.queryExecutor('SELECT * FROM equipment_borrow_requests WHERE id = ?', [id])
    if (reqRows.length === 0) return null

    const itemRows = await this.queryExecutor(`
      SELECT 
        i.*,
        a.name AS asset_name, a.brand AS asset_brand, a.article_num AS asset_code,
        m.name AS mat_name, m.unit AS mat_unit, m.material_type AS mat_type
      FROM equipment_borrow_items i
      LEFT JOIN hospital_assets a ON i.asset_id = a.id
      LEFT JOIN hospital_materials m ON i.material_id = m.id
      WHERE i.request_id = ?
    `, [id])

    const mappedItems = itemRows.map((it: any) => ({
      ...it,
      asset: it.asset_id ? { id: it.asset_id, name: it.asset_name, brand: it.asset_brand, articleNum: it.asset_code } : null,
      material: it.material_id ? { id: it.material_id, name: it.mat_name, unit: it.mat_unit, materialType: it.mat_type } : null,
    }))

    return mapDbRowToRequest(reqRows[0], mappedItems)
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

    const whereClauses: string[] = []
    const params: any[] = []

    if (status && status !== 'ALL') {
      whereClauses.push('status = ?')
      params.push(status)
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      whereClauses.push('(request_no LIKE ? OR requester_name LIKE ? OR purpose LIKE ? OR location LIKE ?)')
      params.push(q, q, q, q)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const [countRows, reqRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM equipment_borrow_requests ${whereSql}`, params),
      this.queryExecutor(
        `SELECT * FROM equipment_borrow_requests ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, skip]
      ),
    ])

    const total = Number(countRows[0]?.total || 0)
    const items = await Promise.all(
      reqRows.map(async (r) => {
        const itemRows = await this.queryExecutor(`
          SELECT 
            i.*,
            a.name AS asset_name, a.brand AS asset_brand, a.article_num AS asset_code,
            m.name AS mat_name, m.unit AS mat_unit, m.material_type AS mat_type
          FROM equipment_borrow_items i
          LEFT JOIN hospital_assets a ON i.asset_id = a.id
          LEFT JOIN hospital_materials m ON i.material_id = m.id
          WHERE i.request_id = ?
        `, [r.id])

        const mappedItems = itemRows.map((it: any) => ({
          ...it,
          asset: it.asset_id ? { id: it.asset_id, name: it.asset_name, brand: it.asset_brand, articleNum: it.asset_code } : null,
          material: it.material_id ? { id: it.material_id, name: it.mat_name, unit: it.mat_unit, materialType: it.mat_type } : null,
        }))

        return mapDbRowToRequest(r, mappedItems)
      })
    )

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

    const request = await this.getBorrowRequestById(id)
    if (!request) throw new Error(`ไม่พบคำขอยืมรหัส ${id}`)
    if (request.status !== 'PENDING') throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${request.status})`)

    // 1. Pre-validate stock availability for materials and check asset availability
    for (const item of request.items) {
      if (item.itemType === 'ASSET' && item.assetId) {
        const activeLoans = await this.queryExecutor(
          `SELECT i.id FROM equipment_borrow_items i
           JOIN equipment_borrow_requests r ON i.request_id = r.id
           WHERE i.item_type = 'ASSET' AND i.asset_id = ? AND i.status = 'BORROWED' AND i.request_id != ?
             AND r.status IN ('APPROVED', 'PARTIAL_RETURNED') LIMIT 1`,
          [item.assetId, id]
        )
        if (activeLoans && activeLoans.length > 0) {
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
      const matRows = await this.queryExecutor('SELECT id, name, available_qty, unit, material_type FROM hospital_materials WHERE id = ?', [matId])
      const mat = matRows[0]
      if (!mat || mat.available_qty < totalNeeded) {
        const item = request.items.find((i: any) => i.materialId === matId)
        throw new Error(`ยอดคงเหลือไม่เพียงพอสำหรับ ${mat?.name || item?.itemName || 'วัสดุ'} (ต้องการ ${totalNeeded}, คงเหลือ ${mat?.available_qty || 0})`)
      }
      materialCache.set(matId, mat)
    }

    // 2. Deduct stock for each item and set status to BORROWED or CONSUMED
    for (const item of request.items) {
      if (item.itemType === 'MATERIAL' && item.materialId) {
        const mat = materialCache.get(item.materialId)
        await this.queryExecutor('UPDATE hospital_materials SET available_qty = available_qty - ?, updated_at = NOW() WHERE id = ?', [item.quantity, item.materialId])

        if (mat?.material_type === 'CONSUMABLE') {
          await this.queryExecutor("UPDATE equipment_borrow_items SET status = 'CONSUMED', returned_qty = ?, returned_at = NOW(), updated_at = NOW() WHERE id = ?", [item.quantity, item.id])
        } else {
          await this.queryExecutor("UPDATE equipment_borrow_items SET status = 'BORROWED', updated_at = NOW() WHERE id = ?", [item.id])
        }
      } else if (item.itemType === 'ASSET') {
        await this.queryExecutor("UPDATE equipment_borrow_items SET status = 'BORROWED', updated_at = NOW() WHERE id = ?", [item.id])
      }
    }

    const hasReturnableItems = request.items.some(
      (it: any) => it.itemType === 'ASSET' || it.material?.materialType !== 'CONSUMABLE'
    )
    const nextStatus = hasReturnableItems ? 'APPROVED' : 'RETURNED'

    await this.queryExecutor(`
      UPDATE equipment_borrow_requests SET
        status = ?,
        approved_by_id = ?,
        approved_by_name = ?,
        approved_at = NOW(),
        actual_return_date = CASE WHEN ? = 'RETURNED' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = ?
    `, [
      nextStatus,
      actor.id || null,
      actor.name || actor.username || 'Admin',
      nextStatus,
      id,
    ])

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: id, requestNo: request.requestNo, nextStatus }),
      { username: actor.username || 'admin' }
    )

    return this.getBorrowRequestById(id)
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

    const request = await this.getBorrowRequestById(id)
    if (!request) throw new Error(`ไม่พบคำขอยืมรหัส ${id}`)
    if (request.status !== 'PENDING') throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${request.status})`)

    await this.queryExecutor(`
      UPDATE equipment_borrow_requests SET
        status = 'REJECTED',
        reject_reason = ?,
        approved_by_id = ?,
        approved_by_name = ?,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `, [
      reason.trim(),
      actor.id || null,
      actor.name || actor.username || 'Admin',
      id,
    ])

    await this.queryExecutor("UPDATE equipment_borrow_items SET status = 'REJECTED', updated_at = NOW() WHERE request_id = ?", [id])

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId: id, reason, action: 'REJECT' }),
      { username: actor.username || 'admin' }
    )

    return this.getBorrowRequestById(id)
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

    const whereClauses: string[] = ["status IN ('APPROVED', 'PARTIAL_RETURNED')"]
    const params: any[] = []

    if (overdueOnly) {
      whereClauses.push('expected_return_date < CURDATE()')
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      whereClauses.push('(request_no LIKE ? OR requester_name LIKE ? OR purpose LIKE ?)')
      params.push(q, q, q)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const [countRows, reqRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM equipment_borrow_requests ${whereSql}`, params),
      this.queryExecutor(
        `SELECT * FROM equipment_borrow_requests ${whereSql} ORDER BY expected_return_date ASC LIMIT ? OFFSET ?`,
        [...params, limit, skip]
      ),
    ])

    const total = Number(countRows[0]?.total || 0)
    const items = await Promise.all(
      reqRows.map(async (r) => {
        const itemRows = await this.queryExecutor(`
          SELECT 
            i.*,
            a.name AS asset_name, a.brand AS asset_brand, a.article_num AS asset_code,
            m.name AS mat_name, m.unit AS mat_unit, m.material_type AS mat_type
          FROM equipment_borrow_items i
          LEFT JOIN hospital_assets a ON i.asset_id = a.id
          LEFT JOIN hospital_materials m ON i.material_id = m.id
          WHERE i.request_id = ?
        `, [r.id])

        const mappedItems = itemRows.map((it: any) => ({
          ...it,
          asset: it.asset_id ? { id: it.asset_id, name: it.asset_name, brand: it.asset_brand, articleNum: it.asset_code } : null,
          material: it.material_id ? { id: it.material_id, name: it.mat_name, unit: it.mat_unit, materialType: it.mat_type } : null,
        }))

        return mapDbRowToRequest(r, mappedItems)
      })
    )

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

    const request = await this.getBorrowRequestById(requestId)
    if (!request) throw new Error(`ไม่พบคำขอยืมรหัส ${requestId}`)
    if (!['APPROVED', 'PARTIAL_RETURNED'].includes(request.status)) {
      throw new Error(`คำขอนี้ไม่ได้อยู่ในสถานะกำลังยืม (สถานะปัจจุบัน: ${request.status})`)
    }

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

      await this.queryExecutor(`
        UPDATE equipment_borrow_items SET
          returned_qty = ?,
          status = ?,
          return_condition = ?,
          return_notes = ?,
          returned_at = NOW(),
          inspected_by_id = ?,
          inspected_by_name = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        totalReturned,
        itemStatus,
        ret.condition,
        ret.notes?.trim() || null,
        actor.id || null,
        actor.name || actor.username || 'Admin',
        item.id,
      ])

      if (item.itemType === 'MATERIAL' && item.materialId && item.material?.materialType === 'REUSABLE') {
        if (ret.condition === 'NORMAL') {
          await this.queryExecutor('UPDATE hospital_materials SET available_qty = available_qty + ?, updated_at = NOW() WHERE id = ?', [returnQty, item.materialId])
        }
      }
    }

    const updatedItemRows = await this.queryExecutor('SELECT quantity, returned_qty, status FROM equipment_borrow_items WHERE request_id = ?', [requestId])
    const allDone = updatedItemRows.every((it: any) => Number(it.returned_qty || 0) >= Number(it.quantity || 0) || it.status === 'CONSUMED')

    await this.queryExecutor(`
      UPDATE equipment_borrow_requests SET
        status = ?,
        actual_return_date = CASE WHEN ? = 'RETURNED' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = ?
    `, [
      allDone ? 'RETURNED' : 'PARTIAL_RETURNED',
      allDone ? 'RETURNED' : 'PARTIAL_RETURNED',
      requestId,
    ])

    await logAudit(
      'UPDATE',
      'equipment_borrow_requests',
      JSON.stringify({ requestId, returnedItems: returns.length, allDone, action: 'RETURN_INSPECTION' }),
      { username: actor.username || 'admin' }
    )

    return this.getBorrowRequestById(requestId)
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

    // Zero-DB Production Execution
    const [loanableRows, materialAggRows, borrowedItemRows, overdueRows] = await Promise.all([
      this.queryExecutor("SELECT COUNT(*) AS cnt FROM hospital_assets WHERE is_loanable = 1 AND status = 'ACTIVE'"),
      this.queryExecutor('SELECT COALESCE(SUM(total_qty), 0) AS totalMaterials, COALESCE(SUM(available_qty), 0) AS availableMaterials FROM hospital_materials WHERE is_active = 1'),
      this.queryExecutor(`
        SELECT i.item_type, i.quantity, i.returned_qty
        FROM equipment_borrow_items i
        JOIN equipment_borrow_requests r ON i.request_id = r.id
        WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND i.status = 'BORROWED'
      `),
      this.queryExecutor(`
        SELECT i.quantity, i.returned_qty
        FROM equipment_borrow_items i
        JOIN equipment_borrow_requests r ON i.request_id = r.id
        WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND r.expected_return_date < CURDATE() AND i.status = 'BORROWED'
      `),
    ])

    const loanableAssetsCount = Number(loanableRows[0]?.cnt || 0)
    const totalMaterials = Number(materialAggRows[0]?.totalMaterials || 0)
    const availableMaterials = Number(materialAggRows[0]?.availableMaterials || 0)

    let borrowedPiecesCount = 0
    let borrowedAssetsCount = 0
    for (const it of borrowedItemRows) {
      const remaining = Math.max(0, Number(it.quantity || 0) - Number(it.returned_qty || 0))
      borrowedPiecesCount += remaining
      if (it.item_type === 'ASSET') borrowedAssetsCount += remaining
    }

    const availableAssets = Math.max(0, loanableAssetsCount - borrowedAssetsCount)

    let overduePiecesCount = 0
    for (const it of overdueRows) {
      overduePiecesCount += Math.max(0, Number(it.quantity || 0) - Number(it.returned_qty || 0))
    }

    return {
      totalItems: loanableAssetsCount + totalMaterials,
      availableItems: availableAssets + availableMaterials,
      borrowedItems: borrowedPiecesCount,
      overdueRequests: overduePiecesCount,
    }
  }

  // ==========================================
  // 6. Overdue Notification Dispatcher (15:00 Daily Cron)
  // ==========================================

  async dispatchOverdueNotifications(options: { siteUrl?: string } = {}): Promise<OverdueNotificationResult> {
    const siteUrl = (options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://thlp.moph.go.th').replace(/\/$/, '')
    const detailUrl = `${siteUrl}/member/equipment-borrow`

    const result: OverdueNotificationResult = {
      success: true,
      totalOverdue: 0,
      sentCount: 0,
      skippedNoTelegramCount: 0,
      failedCount: 0,
      timestamp: new Date().toISOString(),
      details: [],
    }

    if (this.db?.equipmentBorrowRequest) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const overdueRequests = await this.db.equipmentBorrowRequest.findMany({
        where: {
          status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
          expectedReturnDate: { lt: todayStart },
        },
        include: {
          items: true,
        },
        orderBy: { expectedReturnDate: 'asc' },
      })

      result.totalOverdue = overdueRequests.length

      for (const req of overdueRequests) {
        const remainingItems = (req.items || []).filter(
          (it: any) => (Number(it.quantity || 0) - Number(it.returnedQty || 0)) > 0 && it.status !== 'CONSUMED'
        )

        if (remainingItems.length === 0) continue

        const expDate = req.expectedReturnDate ? new Date(req.expectedReturnDate) : todayStart
        const diffMs = todayStart.getTime() - expDate.getTime()
        const overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

        let chatId: string | number | null = null
        if (this.db.memberTelegramLink) {
          const link = await this.db.memberTelegramLink.findFirst({
            where: { memberId: req.requesterId },
          })
          chatId = link?.telegramChatId || null
        }

        if (!chatId) {
          result.skippedNoTelegramCount += 1
          result.details.push({
            requestId: req.id,
            requestNo: req.requestNo,
            requesterId: req.requesterId,
            requesterName: req.requesterName,
            requesterDept: req.requesterDept,
            overdueDays,
            expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().slice(0, 10) : '-',
            remainingItemsCount: remainingItems.length,
            status: 'SKIPPED_NO_TELEGRAM',
          })
          logger.warn(
            { requestId: req.id, requestNo: req.requestNo, requesterName: req.requesterName },
            'Overdue borrower has not linked Telegram, skipping alert'
          )
          continue
        }

        const formattedExpDate = !isNaN(expDate.getTime())
          ? expDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
          : '-'

        const itemsListHtml = remainingItems.map((it: any) => {
          const remQty = Number(it.quantity || 0) - Number(it.returnedQty || 0)
          const codePill = it.itemCode ? ` (รหัส: ${it.itemCode})` : ''
          return `• <b>${it.itemName}</b>${codePill} — คงค้าง <b>${remQty}</b> ชิ้น`
        }).join('\n')

        const messageHtml = [
          `⚠️ <b>แจ้งเตือน: เกินกำหนดส่งคืนอุปกรณ์/พัสดุ</b>`,
          `โรงพยาบาลเถิน จ.ลำปาง\n`,
          `เรียนคุณ: <b>${req.requesterName}</b> ${req.requesterDept ? `(${req.requesterDept})` : ''}`,
          `เลขที่คำขอ: <code>${req.requestNo}</code>`,
          `วัตถุประสงค์: ${req.purpose}\n`,
          `🔴 <b>สถานะ: เกินกำหนดส่งคืนแล้ว ${overdueDays} วัน</b>`,
          `📅 กำหนดส่งคืนเดิม: ${formattedExpDate}\n`,
          `📦 <b>รายการอุปกรณ์ที่ยังค้างส่งคืน:</b>`,
          itemsListHtml,
          `\nกรุณานำอุปกรณ์ดังกล่าวส่งคืน ณ งานประชาสัมพันธ์ โรงพยาบาลเถิน`,
          `🔗 ดูรายละเอียดคำขอ: <a href="${detailUrl}">${detailUrl}</a>`,
        ].join('\n')

        try {
          await this.telegramSender(chatId, messageHtml, { parseMode: 'HTML' })
          result.sentCount += 1
          result.details.push({
            requestId: req.id,
            requestNo: req.requestNo,
            requesterId: req.requesterId,
            requesterName: req.requesterName,
            requesterDept: req.requesterDept,
            overdueDays,
            expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().slice(0, 10) : '-',
            remainingItemsCount: remainingItems.length,
            status: 'SENT',
          })
        } catch (err: any) {
          result.failedCount += 1
          result.details.push({
            requestId: req.id,
            requestNo: req.requestNo,
            requesterId: req.requesterId,
            requesterName: req.requesterName,
            requesterDept: req.requesterDept,
            overdueDays,
            expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().slice(0, 10) : '-',
            remainingItemsCount: remainingItems.length,
            status: 'FAILED',
            error: err.message || String(err),
          })
          logger.error(
            { error: err, requestId: req.id, requestNo: req.requestNo },
            'Failed to dispatch Telegram overdue notification'
          )
        }
      }

      await logAudit(
        'SYSTEM',
        'equipment_borrow_requests',
        JSON.stringify({
          action: 'OVERDUE_NOTIFICATION_DISPATCH',
          totalOverdue: result.totalOverdue,
          sentCount: result.sentCount,
          skippedCount: result.skippedNoTelegramCount,
          failedCount: result.failedCount,
        }),
        { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
      )

      return result
    }

    // Zero-DB Gateway implementation
    const overdueRequests = await this.queryExecutor(`
      SELECT 
        r.id, r.request_no, r.requester_id, r.requester_name, r.requester_dept,
        r.purpose, r.location, r.borrow_date, r.expected_return_date, r.phone,
        r.status, r.created_at,
        GREATEST(1, DATEDIFF(CURDATE(), r.expected_return_date)) AS overdue_days
      FROM equipment_borrow_requests r
      WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED')
        AND r.expected_return_date < CURDATE()
      ORDER BY r.expected_return_date ASC
    `)

    result.totalOverdue = overdueRequests.length

    for (const req of overdueRequests) {
      const itemRows = await this.queryExecutor(`
        SELECT id, item_type, asset_id, material_id, item_name, item_code, quantity, returned_qty, status
        FROM equipment_borrow_items
        WHERE request_id = ?
      `, [req.id])

      const remainingItems = (itemRows || []).filter(
        (it: any) => (Number(it.quantity || 0) - Number(it.returned_qty || 0)) > 0 && it.status !== 'CONSUMED'
      )

      if (remainingItems.length === 0) continue

      const overdueDays = Number(req.overdue_days || 1)
      const expDate = req.expected_return_date ? new Date(req.expected_return_date) : null
      const formattedExpDate = expDate && !isNaN(expDate.getTime())
        ? expDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
        : String(req.expected_return_date || '-')

      const linkRows = await this.queryExecutor(`
        SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1
      `, [req.requester_id])

      const chatId = linkRows[0]?.telegram_chat_id

      if (!chatId) {
        result.skippedNoTelegramCount += 1
        result.details.push({
          requestId: req.id,
          requestNo: req.request_no,
          requesterId: req.requester_id,
          requesterName: req.requester_name,
          requesterDept: req.requester_dept,
          overdueDays,
          expectedReturnDate: req.expected_return_date ? String(req.expected_return_date).slice(0, 10) : '-',
          remainingItemsCount: remainingItems.length,
          status: 'SKIPPED_NO_TELEGRAM',
        })
        logger.warn(
          { requestId: req.id, requestNo: req.request_no, requesterName: req.requester_name },
          'Overdue borrower has not linked Telegram, skipping alert'
        )
        continue
      }

      const itemsListHtml = remainingItems.map((it: any) => {
        const remQty = Number(it.quantity || 0) - Number(it.returned_qty || 0)
        const codePill = it.item_code ? ` (รหัส: ${it.item_code})` : ''
        return `• <b>${it.item_name}</b>${codePill} — คงค้าง <b>${remQty}</b> ชิ้น`
      }).join('\n')

      const messageHtml = [
        `⚠️ <b>แจ้งเตือน: เกินกำหนดส่งคืนอุปกรณ์/พัสดุ</b>`,
        `โรงพยาบาลเถิน จ.ลำปาง\n`,
        `เรียนคุณ: <b>${req.requester_name}</b> ${req.requester_dept ? `(${req.requester_dept})` : ''}`,
        `เลขที่คำขอ: <code>${req.request_no}</code>`,
        `วัตถุประสงค์: ${req.purpose}\n`,
        `🔴 <b>สถานะ: เกินกำหนดส่งคืนแล้ว ${overdueDays} วัน</b>`,
        `📅 กำหนดส่งคืนเดิม: ${formattedExpDate}\n`,
        `📦 <b>รายการอุปกรณ์ที่ยังค้างส่งคืน:</b>`,
        itemsListHtml,
        `\nกรุณานำอุปกรณ์ดังกล่าวส่งคืน ณ งานประชาสัมพันธ์ โรงพยาบาลเถิน`,
        `🔗 ดูรายละเอียดคำขอ: <a href="${detailUrl}">${detailUrl}</a>`,
      ].join('\n')

      try {
        await this.telegramSender(chatId, messageHtml, { parseMode: 'HTML' })
        result.sentCount += 1
        result.details.push({
          requestId: req.id,
          requestNo: req.request_no,
          requesterId: req.requester_id,
          requesterName: req.requester_name,
          requesterDept: req.requester_dept,
          overdueDays,
          expectedReturnDate: req.expected_return_date ? String(req.expected_return_date).slice(0, 10) : '-',
          remainingItemsCount: remainingItems.length,
          status: 'SENT',
        })
      } catch (err: any) {
        result.failedCount += 1
        result.details.push({
          requestId: req.id,
          requestNo: req.request_no,
          requesterId: req.requester_id,
          requesterName: req.requester_name,
          requesterDept: req.requester_dept,
          overdueDays,
          expectedReturnDate: req.expected_return_date ? String(req.expected_return_date).slice(0, 10) : '-',
          remainingItemsCount: remainingItems.length,
          status: 'FAILED',
          error: err.message || String(err),
        })
        logger.error(
          { error: err, requestId: req.id, requestNo: req.request_no },
          'Failed to dispatch Telegram overdue notification'
        )
      }
    }

    await logAudit(
      'SYSTEM',
      'equipment_borrow_requests',
      JSON.stringify({
        action: 'OVERDUE_NOTIFICATION_DISPATCH',
        totalOverdue: result.totalOverdue,
        sentCount: result.sentCount,
        skippedCount: result.skippedNoTelegramCount,
        failedCount: result.failedCount,
      }),
      { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
    )

    return result
  }
}

export const equipmentBorrowService = new EquipmentBorrowService()
