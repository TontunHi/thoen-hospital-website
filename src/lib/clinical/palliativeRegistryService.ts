import { apiGateway } from '@/lib/apiGateway'
import { queryClinicalDb } from '@/lib/clinicalDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

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
  registeredDate?: string | null
  visit1Date: string | null
  visit1Status?: string | null
  visit1Remark?: string | null
  visit1Rep?: string | null
  visit1Compensated?: number
  visit2Date: string | null
  visit2Status?: string | null
  visit2Remark?: string | null
  visit2Rep?: string | null
  visit2Compensated?: number
  visit3Date: string | null
  visit3Status?: string | null
  visit3Remark?: string | null
  visit3Rep?: string | null
  visit3Compensated?: number
  visit4Date: string | null
  visit4Status?: string | null
  visit4Remark?: string | null
  visit4Rep?: string | null
  visit4Compensated?: number
  visit5Date: string | null
  visit5Status?: string | null
  visit5Remark?: string | null
  visit5Rep?: string | null
  visit5Compensated?: number
  visit6Date: string | null
  visit6Status?: string | null
  visit6Remark?: string | null
  visit6Rep?: string | null
  visit6Compensated?: number
  deathDate: string | null
  deathEntryStatus?: string | null
  claimStatus?: string
  claimResult?: string | null
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

export interface PatientLookupResult {
  hn: string
  patientName: string
  address: string
  phone: string
  death: string
  deathDate: string | null
  isRegistered: boolean
  registeredDate: string | null
}

export class PalliativeRegistryService {
  /**
   * Look up patient demographics and Clinic 2423 Palliative Care registration status from HOSxP
   */
  static async lookupPatientByHn(
    hn: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PatientLookupResult | null> {
    const rawHn = (hn || '').trim()
    if (!rawHn) return null
    const cleanHn = /^\d+$/.test(rawHn) ? rawHn.padStart(7, '0') : rawHn

    const ptSql = `
      SELECT 
        pt.hn,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        CONCAT(
          IFNULL(pt.addrpart, ''),
          IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
          IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
          IF(t.name IS NOT NULL, CONCAT(' ต.', t.name), ''),
          IF(a.name IS NOT NULL, CONCAT(' อ.', a.name), '')
        ) AS address,
        COALESCE(NULLIF(pt.mobile_phone_number, ''), NULLIF(pt.informtel, ''), '') AS phone,
        IFNULL(pt.death, 'N') AS death,
        DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date
      FROM patient pt
      LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
      LEFT JOIN thaiaddress a ON a.chwpart = pt.chwpart AND a.amppart = pt.amppart AND a.tmbpart = '00'
      WHERE pt.hn = ?
      LIMIT 1;
    `

    const cmSql = `
      SELECT hn, clinic, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate
      FROM clinicmember
      WHERE hn = ? AND clinic = '47'
      LIMIT 1;
    `

    const [ptRows, cmRows] = await Promise.all([
      executor(ptSql, [cleanHn]),
      executor(cmSql, [cleanHn]),
    ])

    if (!ptRows || ptRows.length === 0) {
      return null
    }

    const pt = ptRows[0]
    const cm = cmRows && cmRows.length > 0 ? cmRows[0] : null

    return {
      hn: String(pt.hn || cleanHn),
      patientName: String(pt.ptname || '').trim(),
      address: String(pt.address || '').trim(),
      phone: String(pt.phone || '').trim(),
      death: String(pt.death || 'N'),
      deathDate: pt.death_date ? String(pt.death_date) : null,
      isRegistered: Boolean(cm),
      registeredDate: cm?.regdate ? String(cm.regdate) : null,
    }
  }

  /**
   * List palliative care patient records with search, filters, and real-time HOSxP Clinic 2423 and RCM Rep matching
   */
  static async listRegistries(
    params: ListRegistriesParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<{
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

    const items = (res.items || []) as PalliativeRegistryItem[]
    const total = res.total || 0
    const page = res.page || 1
    const limit = res.limit || 50
    const totalPages = res.totalPages || 1

    if (items.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 1,
        stats: { total: 0, registered: 0, pendingRegistration: 0, claimed: 0, paid: 0, deny: 0 },
      }
    }

    // Collect unique HNs for batch query
    const hns = [...new Set(items.map((i) => i.hn.trim()).filter(Boolean))]

    const clinicMemberMap = new Map<string, string>()
    let repDataList: Array<{
      hn: string
      admdate: string
      rep: string
      compensated: number
      remark: string | null
      errorcode: string | null
    }> = []

    if (hns.length > 0) {
      const placeholders = hns.map(() => '?').join(',')

      const cmSql = `
        SELECT hn, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate
        FROM clinicmember
        WHERE hn IN (${placeholders}) AND clinic = '47';
      `

      const repSql = `
        SELECT hn, vn, DATE_FORMAT(AdmDate, '%Y-%m-%d') as admdate, Rep as rep, Compensated as compensated, Remark as remark, ErrorCode as errorcode
        FROM rcmdb.repdata
        WHERE hn IN (${placeholders})
        ORDER BY AdmDate DESC;
      `

      try {
        const [cmRows, repRows] = await Promise.all([
          executor(cmSql, hns),
          executor(repSql, hns),
        ])

        if (Array.isArray(cmRows)) {
          for (const row of cmRows) {
            if (row.hn) clinicMemberMap.set(String(row.hn).trim(), String(row.regdate || ''))
          }
        }

        if (Array.isArray(repRows)) {
          repDataList = repRows.map((r) => ({
            hn: String(r.hn || '').trim(),
            admdate: String(r.admdate || '').trim(),
            rep: String(r.rep || '').trim(),
            compensated: Number(r.compensated || 0),
            remark: r.remark ? String(r.remark).trim() : null,
            errorcode: r.errorcode ? String(r.errorcode).trim() : null,
          }))
        }
      } catch (dbErr) {
        logger.warn({ dbErr }, 'Failed to batch fetch clinicmember/repdata for palliative registries')
      }
    }

    const normalizeDateStr = (d: string | null | undefined): string => {
      if (!d) return ''
      const clean = d.trim()
      const mCe = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
      if (mCe) {
        return `${mCe[1]}-${mCe[2].padStart(2, '0')}-${mCe[3].padStart(2, '0')}`
      }
      const mSlash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (mSlash) {
        let yr = parseInt(mSlash[3], 10)
        if (yr > 2500) yr -= 543
        return `${yr}-${mSlash[2].padStart(2, '0')}-${mSlash[1].padStart(2, '0')}`
      }
      return clean
    }

    // Enrich each item
    for (const item of items) {
      const hn = item.hn.trim()
      if (clinicMemberMap.has(hn)) {
        item.registrationStatus = 'ดำเนินการเรียบร้อย'
        item.registeredDate = clinicMemberMap.get(hn) || null
      } else if (clinicMemberMap.size > 0) {
        item.registrationStatus = 'ยังไม่ได้ดำเนินการ'
        item.registeredDate = null
      }

      for (let v = 1; v <= 6; v++) {
        const vDateRaw = (item as any)[`visit${v}Date`] as string | null
        const vRemarkStored = (item as any)[`visit${v}Status`] as string | null
        ;(item as any)[`visit${v}Remark`] = vRemarkStored || null

        if (vDateRaw && vDateRaw.trim()) {
          const normVDate = normalizeDateStr(vDateRaw)
          const match = repDataList.find(
            (r) => r.hn === hn && (r.admdate === normVDate || normVDate.includes(r.admdate) || r.admdate.includes(normVDate))
          )

          if (match) {
            ;(item as any)[`visit${v}Rep`] = match.rep
            ;(item as any)[`visit${v}Compensated`] = match.compensated
            if (!vRemarkStored && (match.remark || match.errorcode)) {
              ;(item as any)[`visit${v}Remark`] = [match.errorcode, match.remark].filter(Boolean).join(': ')
            }
          } else {
            ;(item as any)[`visit${v}Rep`] = null
            ;(item as any)[`visit${v}Compensated`] = 0
          }
        } else {
          ;(item as any)[`visit${v}Rep`] = null
          ;(item as any)[`visit${v}Compensated`] = 0
        }
      }
    }

    const registeredCount = clinicMemberMap.size > 0
      ? items.filter((i) => i.registrationStatus === 'ดำเนินการเรียบร้อย').length
      : res.stats?.registered ?? items.filter((i) => i.registrationStatus === 'ดำเนินการเรียบร้อย').length

    const pendingCount = clinicMemberMap.size > 0
      ? items.length - registeredCount
      : res.stats?.pendingRegistration ?? (items.length - registeredCount)

    let paidCount = 0
    let claimedCount = 0
    for (const item of items) {
      let hasRep = false
      let hasComp = false
      for (let v = 1; v <= 6; v++) {
        if ((item as any)[`visit${v}Rep`]) hasRep = true
        if (((item as any)[`visit${v}Compensated`] || 0) > 0) hasComp = true
      }
      if (hasRep) claimedCount++
      if (hasComp) paidCount++
    }

    const stats: RegistryStats = {
      total: res.stats?.total || total,
      registered: registeredCount,
      pendingRegistration: pendingCount,
      claimed: repDataList.length > 0 ? claimedCount : (res.stats?.claimed ?? claimedCount),
      paid: repDataList.length > 0 ? paidCount : (res.stats?.paid ?? paidCount),
      deny: res.stats?.deny || 0,
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      stats,
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
      registeredDate?: string | null
      visit1Date?: string | null
      visit1Remark?: string | null
      visit1Status?: string | null
      visit2Date?: string | null
      visit2Remark?: string | null
      visit2Status?: string | null
      visit3Date?: string | null
      visit3Remark?: string | null
      visit3Status?: string | null
      visit4Date?: string | null
      visit4Remark?: string | null
      visit4Status?: string | null
      visit5Date?: string | null
      visit5Remark?: string | null
      visit5Status?: string | null
      visit6Date?: string | null
      visit6Remark?: string | null
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
      registeredDate: data.registeredDate || null,
      visit1Date: data.visit1Date || null,
      visit1Remark: (data as any).visit1Remark || data.visit1Status || null,
      visit1Status: (data as any).visit1Remark || data.visit1Status || null,
      visit2Date: data.visit2Date || null,
      visit2Remark: (data as any).visit2Remark || data.visit2Status || null,
      visit2Status: (data as any).visit2Remark || data.visit2Status || null,
      visit3Date: data.visit3Date || null,
      visit3Remark: (data as any).visit3Remark || data.visit3Status || null,
      visit3Status: (data as any).visit3Remark || data.visit3Status || null,
      visit4Date: data.visit4Date || null,
      visit4Remark: (data as any).visit4Remark || data.visit4Status || null,
      visit4Status: (data as any).visit4Remark || data.visit4Status || null,
      visit5Date: data.visit5Date || null,
      visit5Remark: (data as any).visit5Remark || data.visit5Status || null,
      visit5Status: (data as any).visit5Remark || data.visit5Status || null,
      visit6Date: data.visit6Date || null,
      visit6Remark: (data as any).visit6Remark || data.visit6Status || null,
      visit6Status: (data as any).visit6Remark || data.visit6Status || null,
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

    for (let v = 1; v <= 6; v++) {
      if (updateData[`visit${v}Remark`] !== undefined && updateData[`visit${v}Status`] === undefined) {
        updateData[`visit${v}Status`] = updateData[`visit${v}Remark`]
      }
      if (updateData[`visit${v}Status`] !== undefined && updateData[`visit${v}Remark`] === undefined) {
        updateData[`visit${v}Remark`] = updateData[`visit${v}Status`]
      }
    }

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
