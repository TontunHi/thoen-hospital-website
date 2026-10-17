import { queryMemberDb } from '@/lib/memberDb'
import { logger } from '@/lib/logger'
import { 
  fetchGtwArticles, 
  inferAssetCategory, 
  GtwSyncSummary, 
} from './gtwAssetSyncAdapter'
import { QueryExecutor, queryGtwDb } from '@/lib/gtwDb'
import { getSwrCachedData, invalidateCacheKey } from '@/lib/cache'

export interface AssetFilterOptions {
  search?: string
  category?: string // 'ALL' | 'IT' | 'MEDICAL' | 'GENERAL'
  warrantyStatus?: string // 'ALL' | 'ACTIVE' | 'EXPIRED'
  department?: string
  status?: string // 'ACTIVE' | 'IN_REPAIR' | 'STANDBY' | 'DISPOSED'
  page?: number
  limit?: number
  sortBy?: 'articleNum' | 'name' | 'receivedDate' | 'warrantyEndDate' | 'price' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface AssetStats {
  totalAssets: number
  activeWarrantyCount: number
  expiredWarrantyCount: number
  itCount: number
  medicalCount: number
  generalCount: number
  inRepairCount: number
}

export interface CreateAssetInput {
  articleNum: string
  fsnNum?: string | null
  name: string
  brand?: string | null
  model?: string | null
  serialNo?: string | null
  category?: 'IT' | 'MEDICAL' | 'GENERAL'
  locationId?: number | null
  locationFullName?: string | null
  department?: string | null
  custodianId?: number | null
  receivedDate?: Date | string | null
  warrantyStartDate?: Date | string | null
  warrantyEndDate?: Date | string | null
  expireDate?: Date | string | null
  price?: number | string | null
  vendorName?: string | null
  vendorContact?: string | null
  contractNo?: string | null
  status?: 'ACTIVE' | 'IN_REPAIR' | 'STANDBY' | 'DISPOSED'
  imageUrl?: string | null
  notes?: string | null
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {}

function mapDbRowToAsset(row: any) {
  return {
    id: row.id,
    articleNum: row.articleNum,
    fsnNum: row.fsnNum,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNo: row.serialNo,
    category: row.category,
    locationId: row.locationId,
    locationFullName: row.locationFullName,
    department: row.department,
    custodianId: row.custodianId,
    receivedDate: row.receivedDate,
    warrantyStartDate: row.warrantyStartDate,
    warrantyEndDate: row.warrantyEndDate,
    expireDate: row.expireDate,
    price: row.price !== null ? Number(row.price) : null,
    vendorName: row.vendorName,
    vendorContact: row.vendorContact,
    contractNo: row.contractNo,
    status: row.status,
    imageUrl: row.imageUrl,
    notes: row.notes,
    isLoanable: Boolean(row.isLoanable),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    location: row.loc_id
      ? {
          id: row.loc_id,
          roomName: row.loc_room_name,
          floorName: row.loc_floor_name,
          buildingName: row.loc_building_name,
          fullName: row.loc_full_name,
        }
      : null,
    custodian: row.cust_id
      ? {
          id: row.cust_id,
          name: row.cust_name,
          position: row.cust_position,
          department: row.cust_department,
        }
      : null,
  }
}

/**
 * Deep Domain Service for Hospital Asset Management
 * Zero-DB Architecture: routes queries via queryMemberDb / API Gateway.
 */
export class HospitalAssetService {
  constructor(
    private readonly db: any = null,
    private readonly queryExecutor: (sql: string, params?: any[]) => Promise<any[]> = queryMemberDb
  ) {}

  /**
   * Fetch assets with flexible filters, pagination, and sorting
   */
  async getAssets(options: AssetFilterOptions = {}) {
    const {
      search,
      category,
      warrantyStatus,
      department,
      status,
      page = 1,
      limit = 20,
      sortBy = 'receivedDate',
      sortOrder = 'desc',
    } = options

    const skip = (Math.max(1, page) - 1) * limit
    const now = new Date()

    // If unit-test mockDb is provided, preserve mockDb behavior
    if (this.db?.hospitalAsset) {
      const where: any = {}
      if (search && search.trim()) {
        const q = search.trim()
        where.OR = [
          { articleNum: { contains: q } },
          { fsnNum: { contains: q } },
          { name: { contains: q } },
          { model: { contains: q } },
          { brand: { contains: q } },
          { serialNo: { contains: q } },
          { department: { contains: q } },
          { locationFullName: { contains: q } },
        ]
      }
      if (category && category !== 'ALL') where.category = category
      if (status && status !== 'ALL') where.status = status
      if (department && department !== 'ALL') where.department = department

      const orderBy: any[] = []
      if (sortBy === 'receivedDate') {
        orderBy.push({ receivedDate: sortOrder })
        orderBy.push({ id: sortOrder === 'asc' ? 'asc' : 'desc' })
      } else if (sortBy === 'createdAt') {
        orderBy.push({ createdAt: sortOrder })
        orderBy.push({ id: sortOrder === 'asc' ? 'asc' : 'desc' })
      } else {
        const primary: any = {}
        primary[sortBy] = sortOrder
        orderBy.push(primary)
        orderBy.push({ id: 'desc' })
      }

      const [total, items] = await Promise.all([
        this.db.hospitalAsset.count({ where }),
        this.db.hospitalAsset.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            location: {
              select: {
                id: true,
                roomName: true,
                floorName: true,
                buildingName: true,
                fullName: true,
              },
            },
            custodian: {
              select: {
                id: true,
                name: true,
                position: true,
                department: true,
              },
            },
          },
        }),
      ])

      const totalPages = Math.ceil(total / limit) || 1
      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasMore: page < totalPages,
        },
      }
    }

    // Zero-DB Production Gateway Execution
    const whereClauses: string[] = []
    const params: any[] = []

    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      whereClauses.push(`(
        a.article_num LIKE ? OR
        a.fsn_num LIKE ? OR
        a.name LIKE ? OR
        a.model LIKE ? OR
        a.brand LIKE ? OR
        a.serial_no LIKE ? OR
        a.department LIKE ? OR
        a.location_full_name LIKE ?
      )`)
      params.push(q, q, q, q, q, q, q, q)
    }

    if (category && category !== 'ALL') {
      whereClauses.push('a.category = ?')
      params.push(category)
    }

    if (status && status !== 'ALL') {
      whereClauses.push('a.status = ?')
      params.push(status)
    }

    if (department && department !== 'ALL') {
      whereClauses.push('a.department = ?')
      params.push(department)
    }

    if (warrantyStatus === 'ACTIVE') {
      whereClauses.push('(a.warranty_end_date >= NOW() OR (a.warranty_end_date IS NULL AND a.expire_date >= NOW()))')
    } else if (warrantyStatus === 'EXPIRED') {
      whereClauses.push('(a.warranty_end_date < NOW() OR (a.warranty_end_date IS NULL AND a.expire_date < NOW()))')
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // Sort order
    let sortSql = 'a.received_date DESC, a.id DESC'
    if (sortBy === 'receivedDate') {
      sortSql = `a.received_date ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`
    } else if (sortBy === 'createdAt') {
      sortSql = `a.created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`
    } else if (sortBy === 'price') {
      sortSql = `a.price ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id DESC`
    } else if (sortBy === 'articleNum') {
      sortSql = `a.article_num ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id DESC`
    } else if (sortBy === 'name') {
      sortSql = `a.name ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id DESC`
    } else if (sortBy === 'warrantyEndDate') {
      sortSql = `a.warranty_end_date ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id DESC`
    }

    const [countRows, itemRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM hospital_assets a ${whereSql}`, params),
      this.queryExecutor(`
        SELECT 
          a.id, a.article_num AS articleNum, a.fsn_num AS fsnNum, a.name, a.brand, a.model, a.serial_no AS serialNo,
          a.category, a.location_id AS locationId, a.location_full_name AS locationFullName, a.department,
          a.custodian_id AS custodianId, a.received_date AS receivedDate, a.warranty_start_date AS warrantyStartDate,
          a.warranty_end_date AS warrantyEndDate, a.expire_date AS expireDate, a.price, a.vendor_name AS vendorName,
          a.vendor_contact AS vendorContact, a.contract_no AS contractNo, a.status, a.image_url AS imageUrl,
          a.notes, a.is_loanable AS isLoanable, a.created_at AS createdAt, a.updated_at AS updatedAt,
          l.id AS loc_id, l.room_name AS loc_room_name, l.floor_name AS loc_floor_name, l.building_name AS loc_building_name, l.full_name AS loc_full_name,
          m.id AS cust_id, m.name AS cust_name, m.position AS cust_position, m.department AS cust_department
        FROM hospital_assets a
        LEFT JOIN hospital_locations l ON a.location_id = l.id
        LEFT JOIN members m ON a.custodian_id = m.id
        ${whereSql}
        ORDER BY ${sortSql}
        LIMIT ? OFFSET ?
      `, [...params, limit, skip]),
    ])

    const total = Number(countRows[0]?.total || 0)
    const items = itemRows.map(mapDbRowToAsset)
    const totalPages = Math.ceil(total / limit) || 1

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    }
  }

  /**
   * Find a single asset by ID
   */
  async getAssetById(id: number) {
    if (this.db?.hospitalAsset) {
      return this.db.hospitalAsset.findUnique({
        where: { id },
        include: { location: true, custodian: true },
      })
    }

    const rows = await this.queryExecutor(`
      SELECT 
        a.id, a.article_num AS articleNum, a.fsn_num AS fsnNum, a.name, a.brand, a.model, a.serial_no AS serialNo,
        a.category, a.location_id AS locationId, a.location_full_name AS locationFullName, a.department,
        a.custodian_id AS custodianId, a.received_date AS receivedDate, a.warranty_start_date AS warrantyStartDate,
        a.warranty_end_date AS warrantyEndDate, a.expire_date AS expireDate, a.price, a.vendor_name AS vendorName,
        a.vendor_contact AS vendorContact, a.contract_no AS contractNo, a.status, a.image_url AS imageUrl,
        a.notes, a.is_loanable AS isLoanable, a.created_at AS createdAt, a.updated_at AS updatedAt,
        l.id AS loc_id, l.room_name AS loc_room_name, l.floor_name AS loc_floor_name, l.building_name AS loc_building_name, l.full_name AS loc_full_name,
        m.id AS cust_id, m.name AS cust_name, m.position AS cust_position, m.department AS cust_department
      FROM hospital_assets a
      LEFT JOIN hospital_locations l ON a.location_id = l.id
      LEFT JOIN members m ON a.custodian_id = m.id
      WHERE a.id = ?
      LIMIT 1
    `, [id])

    if (rows.length === 0) return null
    return mapDbRowToAsset(rows[0])
  }

  /**
   * Find a single asset by article_num
   */
  async getAssetByArticleNum(articleNum: string) {
    if (this.db?.hospitalAsset) {
      return this.db.hospitalAsset.findUnique({
        where: { articleNum: articleNum.trim() },
        include: { location: true, custodian: true },
      })
    }

    const rows = await this.queryExecutor(`
      SELECT 
        a.id, a.article_num AS articleNum, a.fsn_num AS fsnNum, a.name, a.brand, a.model, a.serial_no AS serialNo,
        a.category, a.location_id AS locationId, a.location_full_name AS locationFullName, a.department,
        a.custodian_id AS custodianId, a.received_date AS receivedDate, a.warranty_start_date AS warrantyStartDate,
        a.warranty_end_date AS warrantyEndDate, a.expire_date AS expireDate, a.price, a.vendor_name AS vendorName,
        a.vendor_contact AS vendorContact, a.contract_no AS contractNo, a.status, a.image_url AS imageUrl,
        a.notes, a.is_loanable AS isLoanable, a.created_at AS createdAt, a.updated_at AS updatedAt,
        l.id AS loc_id, l.room_name AS loc_room_name, l.floor_name AS loc_floor_name, l.building_name AS loc_building_name, l.full_name AS loc_full_name,
        m.id AS cust_id, m.name AS cust_name, m.position AS cust_position, m.department AS cust_department
      FROM hospital_assets a
      LEFT JOIN hospital_locations l ON a.location_id = l.id
      LEFT JOIN members m ON a.custodian_id = m.id
      WHERE a.article_num = ?
      LIMIT 1
    `, [articleNum.trim()])

    if (rows.length === 0) return null
    return mapDbRowToAsset(rows[0])
  }

  /**
   * Calculate summary statistics for dashboard cards
   */
  async getAssetStats(): Promise<AssetStats> {
    return getSwrCachedData(
      'asset:stats',
      async () => {
        if (this.db?.hospitalAsset) {
          const now = new Date()
          const [
            totalAssets,
            itCount,
            medicalCount,
            generalCount,
            inRepairCount,
            activeWarrantyCount,
          ] = await Promise.all([
            this.db.hospitalAsset.count(),
            this.db.hospitalAsset.count({ where: { category: 'IT' } }),
            this.db.hospitalAsset.count({ where: { category: 'MEDICAL' } }),
            this.db.hospitalAsset.count({ where: { category: 'GENERAL' } }),
            this.db.hospitalAsset.count({ where: { status: 'IN_REPAIR' } }),
            this.db.hospitalAsset.count({
              where: {
                OR: [
                  { warrantyEndDate: { gte: now } },
                  {
                    AND: [
                      { warrantyEndDate: null },
                      { expireDate: { gte: now } },
                    ],
                  },
                ],
              },
            }),
          ])

          return {
            totalAssets,
            activeWarrantyCount,
            expiredWarrantyCount: Math.max(0, totalAssets - activeWarrantyCount),
            itCount,
            medicalCount,
            generalCount,
            inRepairCount,
          }
        }

        const rows = await this.queryExecutor(`
          SELECT 
            COUNT(*) AS totalAssets,
            COALESCE(SUM(CASE WHEN category = 'IT' THEN 1 ELSE 0 END), 0) AS itCount,
            COALESCE(SUM(CASE WHEN category = 'MEDICAL' THEN 1 ELSE 0 END), 0) AS medicalCount,
            COALESCE(SUM(CASE WHEN category = 'GENERAL' THEN 1 ELSE 0 END), 0) AS generalCount,
            COALESCE(SUM(CASE WHEN status = 'IN_REPAIR' THEN 1 ELSE 0 END), 0) AS inRepairCount,
            COALESCE(SUM(CASE WHEN warranty_end_date >= NOW() OR (warranty_end_date IS NULL AND expire_date >= NOW()) THEN 1 ELSE 0 END), 0) AS activeWarrantyCount
          FROM hospital_assets
        `)

        const r = rows[0] || {}
        const totalAssets = Number(r.totalAssets || 0)
        const activeWarrantyCount = Number(r.activeWarrantyCount || 0)

        return {
          totalAssets,
          activeWarrantyCount,
          expiredWarrantyCount: Math.max(0, totalAssets - activeWarrantyCount),
          itCount: Number(r.itCount || 0),
          medicalCount: Number(r.medicalCount || 0),
          generalCount: Number(r.generalCount || 0),
          inRepairCount: Number(r.inRepairCount || 0),
        }
      },
      { staleTtlMs: 30_000, maxTtlMs: 120_000 }
    )
  }

  /**
   * Create a new asset
   */
  async createAsset(data: CreateAssetInput) {
    const cleanArticleNum = data.articleNum.trim()
    const category = data.category || inferAssetCategory(data.fsnNum || null, data.name)

    if (this.db?.hospitalAsset) {
      const created = await this.db.hospitalAsset.create({
        data: {
          articleNum: cleanArticleNum,
          fsnNum: data.fsnNum?.trim() || null,
          name: data.name.trim(),
          brand: data.brand?.trim() || null,
          model: data.model?.trim() || null,
          serialNo: data.serialNo?.trim() || null,
          category,
          locationId: data.locationId ? Number(data.locationId) : null,
          locationFullName: data.locationFullName?.trim() || null,
          department: data.department?.trim() || null,
          custodianId: data.custodianId ? Number(data.custodianId) : null,
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
          warrantyStartDate: data.warrantyStartDate ? new Date(data.warrantyStartDate) : null,
          warrantyEndDate: data.warrantyEndDate ? new Date(data.warrantyEndDate) : null,
          expireDate: data.expireDate ? new Date(data.expireDate) : null,
          price: data.price ? Number(data.price) : null,
          vendorName: data.vendorName?.trim() || null,
          vendorContact: data.vendorContact?.trim() || null,
          contractNo: data.contractNo?.trim() || null,
          status: data.status || 'ACTIVE',
          imageUrl: data.imageUrl?.trim() || null,
          notes: data.notes?.trim() || null,
        },
      })
      invalidateCacheKey('asset:stats')
      return created
    }

    const res: any = await this.queryExecutor(`
      INSERT INTO hospital_assets (
        article_num, fsn_num, name, brand, model, serial_no, category,
        location_id, location_full_name, department, custodian_id,
        received_date, warranty_start_date, warranty_end_date, expire_date,
        price, vendor_name, vendor_contact, contract_no, status, image_url, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        NOW(), NOW()
      )
    `, [
      cleanArticleNum,
      data.fsnNum?.trim() || null,
      data.name.trim(),
      data.brand?.trim() || null,
      data.model?.trim() || null,
      data.serialNo?.trim() || null,
      category,
      data.locationId ? Number(data.locationId) : null,
      data.locationFullName?.trim() || null,
      data.department?.trim() || null,
      data.custodianId ? Number(data.custodianId) : null,
      data.receivedDate || null,
      data.warrantyStartDate || null,
      data.warrantyEndDate || null,
      data.expireDate || null,
      data.price ? Number(data.price) : null,
      data.vendorName?.trim() || null,
      data.vendorContact?.trim() || null,
      data.contractNo?.trim() || null,
      data.status || 'ACTIVE',
      data.imageUrl?.trim() || null,
      data.notes?.trim() || null,
    ])

    invalidateCacheKey('asset:stats')
    return this.getAssetById(res.insertId)
  }

  /**
   * Update an existing asset
   */
  async updateAsset(id: number, data: UpdateAssetInput) {
    if (this.db?.hospitalAsset) {
      const updateData: any = {}
      if (data.articleNum !== undefined) updateData.articleNum = data.articleNum.trim()
      if (data.fsnNum !== undefined) updateData.fsnNum = data.fsnNum ? data.fsnNum.trim() : null
      if (data.name !== undefined) updateData.name = data.name.trim()
      if (data.brand !== undefined) updateData.brand = data.brand ? data.brand.trim() : null
      if (data.model !== undefined) updateData.model = data.model ? data.model.trim() : null
      if (data.serialNo !== undefined) updateData.serialNo = data.serialNo ? data.serialNo.trim() : null
      if (data.category !== undefined) updateData.category = data.category
      if (data.locationId !== undefined) updateData.locationId = data.locationId ? Number(data.locationId) : null
      if (data.locationFullName !== undefined) updateData.locationFullName = data.locationFullName ? data.locationFullName.trim() : null
      if (data.department !== undefined) updateData.department = data.department ? data.department.trim() : null
      if (data.custodianId !== undefined) updateData.custodianId = data.custodianId ? Number(data.custodianId) : null
      if (data.receivedDate !== undefined) updateData.receivedDate = data.receivedDate ? new Date(data.receivedDate) : null
      if (data.warrantyStartDate !== undefined) updateData.warrantyStartDate = data.warrantyStartDate ? new Date(data.warrantyStartDate) : null
      if (data.warrantyEndDate !== undefined) updateData.warrantyEndDate = data.warrantyEndDate ? new Date(data.warrantyEndDate) : null
      if (data.expireDate !== undefined) updateData.expireDate = data.expireDate ? new Date(data.expireDate) : null
      if (data.price !== undefined) updateData.price = data.price ? Number(data.price) : null
      if (data.vendorName !== undefined) updateData.vendorName = data.vendorName ? data.vendorName.trim() : null
      if (data.vendorContact !== undefined) updateData.vendorContact = data.vendorContact ? data.vendorContact.trim() : null
      if (data.contractNo !== undefined) updateData.contractNo = data.contractNo ? data.contractNo.trim() : null
      if (data.status !== undefined) updateData.status = data.status
      if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ? data.imageUrl.trim() : null
      if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null

      const updated = await this.db.hospitalAsset.update({
        where: { id },
        data: updateData,
      })
      invalidateCacheKey('asset:stats')
      return updated
    }

    const fields: string[] = []
    const params: any[] = []

    if (data.articleNum !== undefined) { fields.push('article_num = ?'); params.push(data.articleNum.trim()) }
    if (data.fsnNum !== undefined) { fields.push('fsn_num = ?'); params.push(data.fsnNum?.trim() || null) }
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name.trim()) }
    if (data.brand !== undefined) { fields.push('brand = ?'); params.push(data.brand?.trim() || null) }
    if (data.model !== undefined) { fields.push('model = ?'); params.push(data.model?.trim() || null) }
    if (data.serialNo !== undefined) { fields.push('serial_no = ?'); params.push(data.serialNo?.trim() || null) }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category) }
    if (data.locationId !== undefined) { fields.push('location_id = ?'); params.push(data.locationId ? Number(data.locationId) : null) }
    if (data.locationFullName !== undefined) { fields.push('location_full_name = ?'); params.push(data.locationFullName?.trim() || null) }
    if (data.department !== undefined) { fields.push('department = ?'); params.push(data.department?.trim() || null) }
    if (data.custodianId !== undefined) { fields.push('custodian_id = ?'); params.push(data.custodianId ? Number(data.custodianId) : null) }
    if (data.receivedDate !== undefined) { fields.push('received_date = ?'); params.push(data.receivedDate || null) }
    if (data.warrantyStartDate !== undefined) { fields.push('warranty_start_date = ?'); params.push(data.warrantyStartDate || null) }
    if (data.warrantyEndDate !== undefined) { fields.push('warranty_end_date = ?'); params.push(data.warrantyEndDate || null) }
    if (data.expireDate !== undefined) { fields.push('expire_date = ?'); params.push(data.expireDate || null) }
    if (data.price !== undefined) { fields.push('price = ?'); params.push(data.price ? Number(data.price) : null) }
    if (data.vendorName !== undefined) { fields.push('vendor_name = ?'); params.push(data.vendorName?.trim() || null) }
    if (data.vendorContact !== undefined) { fields.push('vendor_contact = ?'); params.push(data.vendorContact?.trim() || null) }
    if (data.contractNo !== undefined) { fields.push('contract_no = ?'); params.push(data.contractNo?.trim() || null) }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status) }
    if (data.imageUrl !== undefined) { fields.push('image_url = ?'); params.push(data.imageUrl?.trim() || null) }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes?.trim() || null) }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()')
      params.push(id)
      await this.queryExecutor(`UPDATE hospital_assets SET ${fields.join(', ')} WHERE id = ?`, params)
    }

    invalidateCacheKey('asset:stats')
    return this.getAssetById(id)
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: number) {
    invalidateCacheKey('asset:stats')
    if (this.db?.hospitalAsset) {
      return this.db.hospitalAsset.delete({ where: { id } })
    }
    await this.queryExecutor('DELETE FROM hospital_assets WHERE id = ?', [id])
    return { id }
  }

  /**
   * Bulk Sync / Import from GTW Database into hospital_assets
   */
  async syncFromGtw(
    executor: QueryExecutor = queryGtwDb,
    options: { limit?: number; since?: string } = {}
  ): Promise<GtwSyncSummary> {
    const rawArticles = await fetchGtwArticles(executor, options)

    const summary: GtwSyncSummary = {
      totalFound: rawArticles.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    }

    for (const raw of rawArticles) {
      const articleNum = (raw.ARTICLE_NUM || '').trim()
      if (!articleNum) {
        summary.skipped++
        continue
      }

      const fsnNum = (raw.SUP_FSN || '').trim() || null
      const name = (raw.ARTICLE_NAME || '').trim() || 'ไม่ระบุชื่อครุภัณฑ์'
      const model = (raw.ARTICLE_MODELS || '').trim() || null
      const serialNo = (raw.SERIAL_NO || '').trim() || null
      const category = inferAssetCategory(fsnNum, name)
      const department = (raw.DEP_SUB_SUB_NAME || raw.LOCATEDEPT || '').trim() || null

      const receivedDate = raw.RECEIVE_DATE ? new Date(raw.RECEIVE_DATE) : null
      const warrantyStartDate = raw.INS_START_DATE ? new Date(raw.INS_START_DATE) : null
      const warrantyEndDate = raw.INS_END_DATE ? new Date(raw.INS_END_DATE) : null
      const expireDate = raw.EXPIRE_DATE ? new Date(raw.EXPIRE_DATE) : null
      const price = raw.PRICE_PER_UNIT ? parseFloat(String(raw.PRICE_PER_UNIT)) : null
      const contractNo = (raw.DOC_NO_NUM || '').trim() || null

      try {
        const existing = await this.getAssetByArticleNum(articleNum)

        if (existing) {
          await this.updateAsset(existing.id, {
            fsnNum: existing.fsnNum || fsnNum,
            category: existing.category === 'GENERAL' ? category : existing.category,
            department: existing.department || department,
            receivedDate: existing.receivedDate || receivedDate,
            warrantyStartDate: existing.warrantyStartDate || warrantyStartDate,
            warrantyEndDate: existing.warrantyEndDate || warrantyEndDate,
            expireDate: existing.expireDate || expireDate,
            price: existing.price || price,
            contractNo: existing.contractNo || contractNo,
          })
          summary.updated++
        } else {
          await this.createAsset({
            articleNum,
            fsnNum,
            name,
            model,
            serialNo,
            category,
            department,
            receivedDate,
            warrantyStartDate,
            warrantyEndDate,
            expireDate,
            price,
            contractNo,
            status: 'ACTIVE',
          })
          summary.inserted++
        }
      } catch (err: any) {
        logger.error({ error: err.message, articleNum }, 'Failed to sync GTW article')
        summary.errors++
      }
    }

    invalidateCacheKey('asset:stats')
    return summary
  }
}

export const hospitalAssetService = new HospitalAssetService()
