import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { 
  fetchGtwArticles, 
  inferAssetCategory, 
  GtwSyncSummary, 
  GtwRawArticle 
} from './gtwAssetSyncAdapter'
import { QueryExecutor, queryGtwDb } from '@/lib/gtwDb'

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

/**
 * Deep Domain Service for Hospital Asset Management
 */
export class HospitalAssetService {
  constructor(private readonly db: any = prisma) {}

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

    const where: any = {}

    // Search filter across article_num, fsn_num, name, model, serial_no, department
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

    if (category && category !== 'ALL') {
      where.category = category
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (department && department !== 'ALL') {
      where.department = department
    }

    if (warrantyStatus === 'ACTIVE') {
      where.OR = [
        { warrantyEndDate: { gte: now } },
        {
          AND: [
            { warrantyEndDate: null },
            { expireDate: { gte: now } },
          ],
        },
      ]
    } else if (warrantyStatus === 'EXPIRED') {
      where.AND = [
        {
          OR: [
            { warrantyEndDate: { lt: now } },
            {
              AND: [
                { warrantyEndDate: null },
                { expireDate: { lt: now } },
              ],
            },
          ],
        },
      ]
    }

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

  /**
   * Find a single asset by ID or article_num
   */
  async getAssetById(id: number) {
    return this.db.hospitalAsset.findUnique({
      where: { id },
      include: {
        location: true,
        custodian: true,
      },
    })
  }

  async getAssetByArticleNum(articleNum: string) {
    return this.db.hospitalAsset.findUnique({
      where: { articleNum: articleNum.trim() },
      include: {
        location: true,
        custodian: true,
      },
    })
  }

  /**
   * Calculate summary statistics for dashboard cards
   */
  async getAssetStats(): Promise<AssetStats> {
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

  /**
   * Create a new asset
   */
  async createAsset(data: CreateAssetInput) {
    const cleanArticleNum = data.articleNum.trim()
    const category = data.category || inferAssetCategory(data.fsnNum || null, data.name)

    return this.db.hospitalAsset.create({
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
  }

  /**
   * Update an existing asset
   */
  async updateAsset(id: number, data: UpdateAssetInput) {
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

    return this.db.hospitalAsset.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: number) {
    return this.db.hospitalAsset.delete({
      where: { id },
    })
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
        const existing = await this.db.hospitalAsset.findUnique({
          where: { articleNum },
        })

        if (existing) {
          // Update missing fields from GTW without overwriting custom website edits
          await this.db.hospitalAsset.update({
            where: { id: existing.id },
            data: {
              fsnNum: existing.fsnNum || fsnNum,
              category: existing.category === 'GENERAL' ? category : existing.category,
              department: existing.department || department,
              receivedDate: existing.receivedDate || receivedDate,
              warrantyStartDate: existing.warrantyStartDate || warrantyStartDate,
              warrantyEndDate: existing.warrantyEndDate || warrantyEndDate,
              expireDate: existing.expireDate || expireDate,
              price: existing.price || price,
              contractNo: existing.contractNo || contractNo,
              gtwArticleId: raw.ARTICLE_ID,
            },
          })
          summary.updated++
        } else {
          await this.db.hospitalAsset.create({
            data: {
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
              gtwArticleId: raw.ARTICLE_ID,
            },
          })
          summary.inserted++
        }
      } catch (err: any) {
        logger.error({ error: err.message, articleNum }, 'Failed to sync GTW article')
        summary.errors++
      }
    }

    return summary
  }
}

export const hospitalAssetService = new HospitalAssetService()
