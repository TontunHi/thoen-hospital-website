import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'

// ── 1. Domain Types: 3.1 ธาลัสซีเมียในหญิงตั้งครรภ์ (Thalassemia in Pregnancy) ──

export type ThalassemiaCardFilter =
  | 'ALL'
  | 'SCREENED'
  | 'UNSCREENED'
  | 'NORMAL'
  | 'RISK'
  | 'THOEN_HOSPITAL'

export type ThalassemiaLaborTypeFilter = 'ALL' | 'NORMAL' | 'CESAREAN' | 'OTHER'

export type ThalassemiaSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'LABRESULT'
  | 'HOSPITAL'
  | 'PTTYPE'

export type ThalassemiaSortField =
  | 'labor_date'
  | 'ptname'
  | 'hn'
  | 'cid'
  | 'age'
  | 'hospital'
  | 'labor_type'
  | 'labresult'

export interface ThalassemiaReportParams extends FiscalDateRangeParams {
  cardFilter?: ThalassemiaCardFilter
  laborTypeFilter?: ThalassemiaLaborTypeFilter
  searchField?: ThalassemiaSearchField
  search?: string
  sortBy?: ThalassemiaSortField
  sortOrder?: 'asc' | 'desc'
  pttypes?: string | string[]
  ucOnly?: boolean
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ThalassemiaAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface ThalassemiaAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: ThalassemiaAdpMappingItem[]
}

export interface ThalassemiaItem {
  no: number
  person_id: number
  ancno: number
  cid: string
  hn: string
  ptname: string
  age: number
  pttypename: string
  pttype_eclaim_id?: string | null
  isUc?: boolean
  address: string
  labor_date: string
  labor_type: string
  labour_type_id: number | null
  hospital: string
  labour_hospcode: string | null
  preg_no: number | null
  lmp: string | null
  edc: string | null
  labcode: string | null
  labname: string | null
  labresult: string | null
  lab_order_date: string | null
  ordered_adp_items?: string | null
  has_lab: boolean
  lab_status: 'NORMAL' | 'RISK' | 'PENDING' | 'NO_LAB'
  is_thoen_hospital: boolean
}

export interface ThalassemiaSummary {
  totalMothers: number
  screenedCount: number
  unscreenedCount: number
  screeningRate: number
  normalCount: number
  riskCount: number
  pendingCount: number
  thoenHospitalCount: number
  otherHospitalCount: number
  normalLaborCount: number
  cesareanLaborCount: number
  otherLaborCount: number
}

export interface ThalassemiaReportResult {
  ds1: string
  ds2: string
  cardFilter: ThalassemiaCardFilter
  laborTypeFilter: ThalassemiaLaborTypeFilter
  searchField: ThalassemiaSearchField
  search: string
  sortBy: ThalassemiaSortField
  sortOrder: 'asc' | 'desc'
  summary: ThalassemiaSummary
  adpMapping: ThalassemiaAdpMappingCheck
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ThalassemiaItem[]
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

export function determineLabStatus(
  labname: string | null | undefined,
  labresult: string | null | undefined
): 'NORMAL' | 'RISK' | 'PENDING' | 'NO_LAB' {
  if (!labname && !labresult) return 'NO_LAB'
  const res = (labresult || '').toLowerCase()
  if (!res || res.includes('รอผล')) return 'PENDING'

  // Flag risk / positive results
  if (
    res.includes('positive') ||
    res.includes('abnormal') ||
    res.includes('trait') ||
    res.includes('hb e') ||
    res.includes('beta-thal') ||
    res.includes('bart') ||
    res.includes('cs')
  ) {
    return 'RISK'
  }

  // Flag normal / negative
  if (res.includes('negative') || res.includes('normal') || res.includes('a2a')) {
    return 'NORMAL'
  }

  return 'NORMAL'
}

// ── 3. RcmThalassemiaService Class ───────────────────────────────────────────

export class RcmThalassemiaService {
  /**
   * Check if ADP codes '30313' and '37532' are mapped in s_drugitems table.
   */
  static async checkThalassemiaAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ThalassemiaAdpMappingCheck> {
    const cacheKey = 'rcm-thalassemia-adp-mapping-check'
    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping('30313')
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
                isMapped: gwRes.isMapped,
                mappedCount: gwRes.mappedCount,
                items: (gwRes.items || []).map((r: any) => ({
                  icode: String(r.icode || ''),
                  name: String(r.name || ''),
                  strength: r.strength ? String(r.strength) : null,
                  nhso_adp_code: String(r.nhso_adp_code || ''),
                })),
              }
            }
          } catch {
            // Fallback to executor query
          }
        }

        const sql = `
          SELECT 
            icode, 
            name, 
            strength, 
            nhso_adp_code
          FROM s_drugitems 
          WHERE nhso_adp_code IN ('30313', '37532')
          ORDER BY nhso_adp_code ASC, icode ASC;
        `
        const rows = (await executor(sql, [], { timeoutMs: 15000 })) as any[]
        const items: ThalassemiaAdpMappingItem[] = (rows || []).map((r) => ({
          icode: String(r.icode || ''),
          name: String(r.name || ''),
          strength: r.strength ? String(r.strength) : null,
          nhso_adp_code: String(r.nhso_adp_code || ''),
        }))

        return {
          isMapped: items.length > 0,
          mappedCount: items.length,
          items,
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 3.1 Thalassemia screening in pregnancy report.
   * Matches FoxPro business logic filtering labor_date within fiscal/custom dates,
   * querying person_anc, person, patient address, and joining 1-year lab_order results.
   */
  static async getThalassemiaReport(
    params: ThalassemiaReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ThalassemiaReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ThalassemiaCardFilter = params.cardFilter || 'ALL'
    const laborTypeFilter: ThalassemiaLaborTypeFilter = params.laborTypeFilter || 'ALL'
    const searchField: ThalassemiaSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ThalassemiaSortField = params.sortBy || 'labor_date'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-thalassemia-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-thalassemia-adp-mapping-check')
    }

    const [adpMapping, rawRows] = await Promise.all([
      this.checkThalassemiaAdpMapping(executor),
      getCachedData(
        cacheKey,
        async () => {
          if (executor === queryClinicalDb) {
            try {
              const gwRes = await apiGateway.clinical.getRcmFundData('thalassemia', { ds1, ds2 })
              if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
                return gwRes.data.rawRows
              }
            } catch {
              // Fallback to executor query
            }
          }

          const sql = `
            SELECT 
              p.person_id,
              anc.person_anc_id AS ancno,
              IFNULL(p.cid, '') AS cid,
              IFNULL(p.patient_hn, '') AS hn,
              CONCAT(IFNULL(p.pname,''), IFNULL(p.fname,''), ' ', IFNULL(p.lname,'')) AS ptname,
              IFNULL(TIMESTAMPDIFF(YEAR, p.birthdate, anc.labor_date), 0) AS age,
              IFNULL(ptt.name, p.pttype) AS pttypename,
              ptt.pttype_eclaim_id,
              CONCAT_WS(' ', pt.addrpart, IF(pt.moopart IS NOT NULL AND pt.moopart != '', CONCAT('ม.', pt.moopart), NULL), pt.road) AS address,
              DATE_FORMAT(anc.labor_date, '%Y-%m-%d') AS labor_date,
              IFNULL(plt.person_labour_type_name, 'NORMAL') AS labor_type,
              anc.labour_type_id,
              IFNULL(h.name, anc.labour_hospcode) AS hospital,
              anc.labour_hospcode,
              anc.preg_no,
              DATE_FORMAT(anc.lmp, '%Y-%m-%d') AS lmp,
              DATE_FORMAT(anc.edc, '%Y-%m-%d') AS edc,
              l.labcode,
              l.labname,
              l.labresult,
              l.lab_order_date,
              ord.ordered_adp_items
            FROM person_anc anc
            JOIN person p ON p.person_id = anc.person_id
            LEFT JOIN patient pt ON pt.hn = p.patient_hn
            LEFT JOIN pttype ptt ON ptt.pttype = p.pttype
            LEFT JOIN person_labour_type plt ON plt.person_labour_type_id = anc.labour_type_id
            LEFT JOIN hospcode h ON h.hospcode = anc.labour_hospcode
            LEFT JOIN (
              SELECT 
                lh.hn,
                GROUP_CONCAT(DISTINCT lo.lab_items_code SEPARATOR ', ') AS labcode,
                GROUP_CONCAT(DISTINCT lo.lab_items_name_ref SEPARATOR ', ') AS labname,
                GROUP_CONCAT(DISTINCT CONCAT(lo.lab_items_name_ref, ': ', IFNULL(lo.lab_order_result, 'รอผล')) SEPARATOR ' | ') AS labresult,
                MAX(DATE_FORMAT(lh.order_date, '%Y-%m-%d')) AS lab_order_date
              FROM lab_head lh
              JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
              WHERE lh.order_date BETWEEN DATE_SUB(?, INTERVAL 1 YEAR) AND ?
                AND (lo.lab_items_name_ref REGEXP 'hemoglobin|thalass' OR lo.lab_items_name_ref = 'DCIP' OR lo.lab_items_name_ref = 'OF')
              GROUP BY lh.hn
            ) l ON l.hn = p.patient_hn
            LEFT JOIN (
              SELECT 
                o.hn,
                GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS ordered_adp_items
              FROM opitemrece o
              JOIN s_drugitems d ON d.icode = o.icode
              WHERE d.nhso_adp_code IN ('30313', '37532')
                AND o.vstdate BETWEEN DATE_SUB(?, INTERVAL 1 YEAR) AND ?
              GROUP BY o.hn
            ) ord ON ord.hn = p.patient_hn
            WHERE anc.labor_date BETWEEN ? AND ?
              AND p.sex = '2'
            GROUP BY anc.person_anc_id
            ORDER BY anc.labor_date DESC
          `
          return (await executor(sql, [ds1, ds2, ds1, ds2, ds1, ds2], { timeoutMs: 45000 })) as any[]
        },
        300000 // Cache TTL 5 minutes
      ),
    ])

    // Map rows into strongly-typed domain items
    const allItems: ThalassemiaItem[] = (rawRows || []).map((r, idx) => {
      const labStatus = determineLabStatus(r.labname, r.labresult)
      const isThoen = r.labour_hospcode === '11152' || (r.hospital || '').includes('เถิน')
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc = isUcEclaimCode(pttypeEclaimId)
      return {
        no: idx + 1,
        person_id: Number(r.person_id || 0),
        ancno: Number(r.ancno || 0),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age || 0),
        pttypename: String(r.pttypename || '—').trim(),
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        address: String(r.address || '').trim() || '—',
        labor_date: String(r.labor_date || ''),
        labor_type: String(r.labor_type || 'NORMAL').trim(),
        labour_type_id: r.labour_type_id != null ? Number(r.labour_type_id) : null,
        hospital: String(r.hospital || '—').trim(),
        labour_hospcode: r.labour_hospcode ? String(r.labour_hospcode).trim() : null,
        preg_no: r.preg_no != null ? Number(r.preg_no) : null,
        lmp: r.lmp ? String(r.lmp) : null,
        edc: r.edc ? String(r.edc) : null,
        labcode: r.labcode ? String(r.labcode) : null,
        labname: r.labname ? String(r.labname) : null,
        labresult: r.labresult ? String(r.labresult) : null,
        lab_order_date: r.lab_order_date ? String(r.lab_order_date) : null,
        ordered_adp_items: r.ordered_adp_items ? String(r.ordered_adp_items) : null,
        has_lab: Boolean(r.labname || r.labresult),
        lab_status: labStatus,
        is_thoen_hospital: isThoen,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Overall Summary from filtered cohort (Q2: A Full Page Filter)
    const totalMothers = summaryCohort.length
    const screenedCount = summaryCohort.filter((i) => i.has_lab).length
    const unscreenedCount = totalMothers - screenedCount
    const screeningRate = totalMothers > 0 ? Number(((screenedCount / totalMothers) * 100).toFixed(1)) : 0
    const normalCount = summaryCohort.filter((i) => i.lab_status === 'NORMAL').length
    const riskCount = summaryCohort.filter((i) => i.lab_status === 'RISK').length
    const pendingCount = summaryCohort.filter((i) => i.lab_status === 'PENDING').length
    const thoenHospitalCount = summaryCohort.filter((i) => i.is_thoen_hospital).length
    const otherHospitalCount = totalMothers - thoenHospitalCount
    const normalLaborCount = summaryCohort.filter((i) => i.labor_type.toUpperCase() === 'NORMAL').length
    const cesareanLaborCount = summaryCohort.filter((i) => i.labor_type.toUpperCase() === 'CESAREAN').length
    const otherLaborCount = totalMothers - normalLaborCount - cesareanLaborCount

    const summary: ThalassemiaSummary = {
      totalMothers,
      screenedCount,
      unscreenedCount,
      screeningRate,
      normalCount,
      riskCount,
      pendingCount,
      thoenHospitalCount,
      otherHospitalCount,
      normalLaborCount,
      cesareanLaborCount,
      otherLaborCount,
    }

    let filteredItems = summaryCohort

    // Apply Interactive Card Filter
    if (cardFilter === 'SCREENED') {
      filteredItems = filteredItems.filter((i) => i.has_lab)
    } else if (cardFilter === 'UNSCREENED') {
      filteredItems = filteredItems.filter((i) => !i.has_lab)
    } else if (cardFilter === 'NORMAL') {
      filteredItems = filteredItems.filter((i) => i.lab_status === 'NORMAL')
    } else if (cardFilter === 'RISK') {
      filteredItems = filteredItems.filter((i) => i.lab_status === 'RISK')
    } else if (cardFilter === 'THOEN_HOSPITAL') {
      filteredItems = filteredItems.filter((i) => i.is_thoen_hospital)
    }

    // Apply Labor Type Filter
    if (laborTypeFilter === 'NORMAL') {
      filteredItems = filteredItems.filter((i) => i.labor_type.toUpperCase() === 'NORMAL')
    } else if (laborTypeFilter === 'CESAREAN') {
      filteredItems = filteredItems.filter((i) => i.labor_type.toUpperCase() === 'CESAREAN')
    } else if (laborTypeFilter === 'OTHER') {
      filteredItems = filteredItems.filter(
        (i) => i.labor_type.toUpperCase() !== 'NORMAL' && i.labor_type.toUpperCase() !== 'CESAREAN'
      )
    }

    // Apply Search Filter
    if (search) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'LABRESULT') {
          return (item.labresult || '').toLowerCase().includes(search) || (item.labname || '').toLowerCase().includes(search)
        }
        if (searchField === 'HOSPITAL') return item.hospital.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)

        // Default 'ALL'
        return (
          item.hn.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          (item.labresult || '').toLowerCase().includes(search) ||
          (item.labname || '').toLowerCase().includes(search) ||
          item.hospital.toLowerCase().includes(search) ||
          item.pttypename.toLowerCase().includes(search) ||
          item.address.toLowerCase().includes(search)
        )
      })
    }

    // Apply Sorting
    filteredItems.sort((a, b) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index row numbers
    filteredItems.forEach((item, index) => {
      item.no = index + 1
    })

    const totalCount = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems = filteredItems
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filteredItems.slice(startIndex, startIndex + pageSize)
    }

    return {
      ds1,
      ds2,
      cardFilter,
      laborTypeFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      adpMapping,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: pagedItems,
    }
  }
}
