import { apiGateway } from '@/lib/apiGateway'
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
 * Zero-SQL Architecture: routes queries via Gateway Named Endpoints.
 */
export class HospitalAssetService {
  constructor(
    private readonly db: any = null,
    private readonly gateway = apiGateway.app
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

    // Zero-SQL Production Gateway Execution
    const { total: rawTotal, items: itemRows } = await this.gateway.listAssetsV2({
      search,
      category,
      warrantyStatus,
      department,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
    })

    const total = Number(rawTotal || 0)
    const items = (itemRows || []).map(mapDbRowToAsset)
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

    const row = await this.gateway.getAssetByIdV2(id)
    return row ? mapDbRowToAsset(row) : null
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

    const row = await this.gateway.getAssetByArticleNumV2(articleNum.trim())
    return row ? mapDbRowToAsset(row) : null
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

        const r: any = (await this.gateway.getAssetStatsV2()) || {}
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

    const created = await this.gateway.createAssetV2({
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
      receivedDate: data.receivedDate || null,
      warrantyStartDate: data.warrantyStartDate || null,
      warrantyEndDate: data.warrantyEndDate || null,
      expireDate: data.expireDate || null,
      price: data.price ? Number(data.price) : null,
      vendorName: data.vendorName?.trim() || null,
      vendorContact: data.vendorContact?.trim() || null,
      contractNo: data.contractNo?.trim() || null,
      status: data.status || 'ACTIVE',
      imageUrl: data.imageUrl?.trim() || null,
      notes: data.notes?.trim() || null,
    })

    invalidateCacheKey('asset:stats')
    return created ? mapDbRowToAsset(created) : null
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

    const payload: Record<string, unknown> = {}
    if (data.articleNum !== undefined) payload.articleNum = data.articleNum.trim()
    if (data.fsnNum !== undefined) payload.fsnNum = data.fsnNum?.trim() || null
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.brand !== undefined) payload.brand = data.brand?.trim() || null
    if (data.model !== undefined) payload.model = data.model?.trim() || null
    if (data.serialNo !== undefined) payload.serialNo = data.serialNo?.trim() || null
    if (data.category !== undefined) payload.category = data.category
    if (data.locationId !== undefined) payload.locationId = data.locationId ? Number(data.locationId) : null
    if (data.locationFullName !== undefined) payload.locationFullName = data.locationFullName?.trim() || null
    if (data.department !== undefined) payload.department = data.department?.trim() || null
    if (data.custodianId !== undefined) payload.custodianId = data.custodianId ? Number(data.custodianId) : null
    if (data.receivedDate !== undefined) payload.receivedDate = data.receivedDate || null
    if (data.warrantyStartDate !== undefined) payload.warrantyStartDate = data.warrantyStartDate || null
    if (data.warrantyEndDate !== undefined) payload.warrantyEndDate = data.warrantyEndDate || null
    if (data.expireDate !== undefined) payload.expireDate = data.expireDate || null
    if (data.price !== undefined) payload.price = data.price ? Number(data.price) : null
    if (data.vendorName !== undefined) payload.vendorName = data.vendorName?.trim() || null
    if (data.vendorContact !== undefined) payload.vendorContact = data.vendorContact?.trim() || null
    if (data.contractNo !== undefined) payload.contractNo = data.contractNo?.trim() || null
    if (data.status !== undefined) payload.status = data.status
    if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl?.trim() || null
    if (data.notes !== undefined) payload.notes = data.notes?.trim() || null

    const updated = await this.gateway.updateAssetV2(id, payload)
    invalidateCacheKey('asset:stats')
    return updated ? mapDbRowToAsset(updated) : null
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: number) {
    invalidateCacheKey('asset:stats')
    if (this.db?.hospitalAsset) {
      return this.db.hospitalAsset.delete({ where: { id } })
    }
    await this.gateway.deleteAssetV2(id)
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
