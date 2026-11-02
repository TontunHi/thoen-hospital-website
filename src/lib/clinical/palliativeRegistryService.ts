import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export interface PalliativeRegistryItem {
  id: number
  hn: string
  patientName: string
  address: string | null
  phone: string | null
  icd10Principal: string | null
  icd10Palliative: string | null
  projectCode: string | null
  registrationStatus: string
  visit1Date: string | null
  visit1Status: string | null
  visit2Date: string | null
  visit2Status: string | null
  visit3Date: string | null
  visit3Status: string | null
  visit4Date: string | null
  visit4Status: string | null
  visit5Date: string | null
  visit5Status: string | null
  visit6Date: string | null
  visit6Status: string | null
  deathDate: string | null
  deathEntryStatus: string | null
  claimStatus: string
  claimResult: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ListRegistriesParams {
  search?: string
  registrationStatus?: string
  claimStatus?: string
  claimResult?: string
  page?: number
  limit?: number
}

export interface RegistryStats {
  total: number
  registered: number
  pendingRegistration: number
  claimed: number
  paid: number
  deny: number
}

export class PalliativeRegistryService {
  /**
   * List palliative care patient records with search and filters
   */
  static async listRegistries(params: ListRegistriesParams = {}): Promise<{
    items: PalliativeRegistryItem[]
    total: number
    page: number
    limit: number
    totalPages: number
    stats: RegistryStats
  }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(200, Math.max(1, params.limit || 50))
    const skip = (page - 1) * limit

    const where: any = {}

    if (params.search && params.search.trim() !== '') {
      const q = params.search.trim()
      where.OR = [
        { hn: { contains: q } },
        { patientName: { contains: q } },
        { icd10Principal: { contains: q } },
        { phone: { contains: q } },
      ]
    }

    if (params.registrationStatus && params.registrationStatus !== 'ALL') {
      where.registrationStatus = params.registrationStatus
    }

    if (params.claimStatus && params.claimStatus !== 'ALL') {
      where.claimStatus = params.claimStatus
    }

    if (params.claimResult && params.claimResult !== 'ALL') {
      where.claimResult = params.claimResult
    }

    // Query data, total count, and summary counts concurrently
    const [items, total, allStats] = await Promise.all([
      (prisma as any).palliativeCareRegistry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).palliativeCareRegistry.count({ where }),
      (prisma as any).palliativeCareRegistry.findMany({
        select: {
          registrationStatus: true,
          claimStatus: true,
          claimResult: true,
        },
      }),
    ])

    const stats: RegistryStats = {
      total: allStats.length,
      registered: allStats.filter((r: any) => r.registrationStatus === 'ดำเนินการเรียบร้อย').length,
      pendingRegistration: allStats.filter((r: any) => r.registrationStatus === 'ยังไม่ได้ดำเนินการ').length,
      claimed: allStats.filter((r: any) => r.claimStatus === 'ลงข้อมูล' || r.claimResult === 'ส่งเคลมแล้ว').length,
      paid: allStats.filter((r: any) => r.claimResult === 'ได้เงิน').length,
      deny: allStats.filter((r: any) => r.claimResult === 'ติด C / Deny').length,
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
    }
  }

  /**
   * Get single registry record by ID
   */
  static async getRegistryById(id: number): Promise<PalliativeRegistryItem | null> {
    return (prisma as any).palliativeCareRegistry.findUnique({
      where: { id },
    })
  }

  /**
   * Create new palliative patient registry record
   */
  static async createRegistry(
    data: {
      hn: string
      patientName: string
      address?: string | null
      phone?: string | null
      icd10Principal?: string | null
      icd10Palliative?: string | null
      projectCode?: string | null
      registrationStatus?: string
      visit1Date?: string | null
      visit1Status?: string | null
      visit2Date?: string | null
      visit2Status?: string | null
      visit3Date?: string | null
      visit3Status?: string | null
      visit4Date?: string | null
      visit4Status?: string | null
      visit5Date?: string | null
      visit5Status?: string | null
      visit6Date?: string | null
      visit6Status?: string | null
      deathDate?: string | null
      deathEntryStatus?: string | null
      claimStatus?: string
      claimResult?: string | null
    },
    actor?: string
  ): Promise<PalliativeRegistryItem> {
    const record = await (prisma as any).palliativeCareRegistry.create({
      data: {
        hn: data.hn.trim(),
        patientName: data.patientName.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        icd10Principal: data.icd10Principal?.trim() || null,
        icd10Palliative: data.icd10Palliative?.trim() || 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
        projectCode: data.projectCode?.trim() || '30001, cONS01ลงทุกเคส',
        registrationStatus: data.registrationStatus || 'ยังไม่ได้ดำเนินการ',
        visit1Date: data.visit1Date || null,
        visit1Status: data.visit1Status || 'ยังไม่ได้เยี่ยม',
        visit2Date: data.visit2Date || null,
        visit2Status: data.visit2Status || 'ยังไม่ได้เยี่ยม',
        visit3Date: data.visit3Date || null,
        visit3Status: data.visit3Status || 'ยังไม่ได้เยี่ยม',
        visit4Date: data.visit4Date || null,
        visit4Status: data.visit4Status || 'ยังไม่ได้เยี่ยม',
        visit5Date: data.visit5Date || null,
        visit5Status: data.visit5Status || 'ยังไม่ได้เยี่ยม',
        visit6Date: data.visit6Date || null,
        visit6Status: data.visit6Status || 'ยังไม่ได้เยี่ยม',
        deathDate: data.deathDate || null,
        deathEntryStatus: data.deathEntryStatus || null,
        claimStatus: data.claimStatus || 'ยังไม่ได้ลงข้อมูล',
        claimResult: data.claimResult || null,
        createdBy: actor || null,
        updatedBy: actor || null,
      },
    })

    try {
      await logAudit(
        'CREATE',
        'palliative_care_registries',
        `Created palliative care patient record id: ${record.id}, HN: ${record.hn}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for createRegistry')
    }

    return record
  }

  /**
   * Update existing palliative patient record
   */
  static async updateRegistry(
    id: number,
    data: Partial<PalliativeRegistryItem>,
    actor?: string
  ): Promise<PalliativeRegistryItem> {
    const updateData: any = { ...data }
    delete updateData.id
    delete updateData.createdAt
    delete updateData.updatedAt
    updateData.updatedBy = actor || null

    const record = await (prisma as any).palliativeCareRegistry.update({
      where: { id },
      data: updateData,
    })

    try {
      await logAudit(
        'UPDATE',
        'palliative_care_registries',
        `Updated palliative care patient record id: ${record.id}, HN: ${record.hn}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for updateRegistry')
    }

    return record
  }

  /**
   * Delete palliative patient record
   */
  static async deleteRegistry(id: number, actor?: string): Promise<{ success: boolean }> {
    const record = await (prisma as any).palliativeCareRegistry.findUnique({
      where: { id },
      select: { hn: true },
    })

    await (prisma as any).palliativeCareRegistry.delete({
      where: { id },
    })

    try {
      await logAudit(
        'DELETE',
        'palliative_care_registries',
        `Deleted palliative care patient record id: ${id}, HN: ${record?.hn || 'unknown'}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for deleteRegistry')
    }

    return { success: true }
  }
}
