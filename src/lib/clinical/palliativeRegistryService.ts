import { apiGateway } from '@/lib/apiGateway'
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
  createdAt: Date | string
  updatedAt: Date | string
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
   * List palliative care patient records with search and filters via Centralized API Gateway (100% Zero-DB Architecture)
   */
  static async listRegistries(params: ListRegistriesParams = {}): Promise<{
    items: PalliativeRegistryItem[]
    total: number
    page: number
    limit: number
    totalPages: number
    stats: RegistryStats
  }> {
    const res = await apiGateway.app.getPalliativeRegistries({
      search: params.search,
      registrationStatus: params.registrationStatus,
      claimStatus: params.claimStatus,
      claimResult: params.claimResult,
      page: params.page,
      limit: params.limit,
    })

    return {
      items: (res.items || []) as PalliativeRegistryItem[],
      total: res.total || 0,
      page: res.page || 1,
      limit: res.limit || 50,
      totalPages: res.totalPages || 1,
      stats: res.stats || {
        total: 0,
        registered: 0,
        pendingRegistration: 0,
        claimed: 0,
        paid: 0,
        deny: 0,
      },
    }
  }

  /**
   * Get single registry record by ID via Centralized API Gateway
   */
  static async getRegistryById(id: number): Promise<PalliativeRegistryItem | null> {
    try {
      const res = await apiGateway.app.getPalliativeRegistryById(id)
      return (res?.data || res) as unknown as PalliativeRegistryItem
    } catch (err: any) {
      if (err?.status === 404) return null
      throw err
    }
  }

  /**
   * Create new palliative patient registry record via Centralized API Gateway
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
    const payload = {
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
    }

    const res = await apiGateway.app.createPalliativeRegistry(payload)
    const record = await this.getRegistryById(res.insertId)

    try {
      await logAudit(
        'CREATE',
        'palliative_care_registries',
        `Created palliative care patient record id: ${res.insertId}, HN: ${data.hn}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for createRegistry')
    }

    return (
      record ||
      ({
        id: res.insertId,
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actor || null,
      } as unknown as PalliativeRegistryItem)
    )
  }

  /**
   * Update existing palliative patient record via Centralized API Gateway
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

    await apiGateway.app.updatePalliativeRegistry(id, updateData)
    const record = await this.getRegistryById(id)

    try {
      await logAudit(
        'UPDATE',
        'palliative_care_registries',
        `Updated palliative care patient record id: ${id}, HN: ${record?.hn || 'unknown'}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for updateRegistry')
    }

    return (
      record ||
      ({
        id,
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as PalliativeRegistryItem)
    )
  }

  /**
   * Delete palliative patient record via Centralized API Gateway
   */
  static async deleteRegistry(id: number, actor?: string): Promise<{ success: boolean }> {
    const record = await this.getRegistryById(id)

    await apiGateway.app.deletePalliativeRegistry(id)

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
