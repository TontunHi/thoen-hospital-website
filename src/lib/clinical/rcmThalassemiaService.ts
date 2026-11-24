import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams } from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import {
  enrichItemsWithSeamlessCache,
  matchesSeamlessRepSearch,
  type SeamlessEnrichedFields,
  type SeamlessEnricherFetcher,
} from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

export interface ThalassemiaPregnancyGatewayAdapter {
  getRcmExtraThalassemiaPregnancyAdpMapping: typeof apiGateway.clinical.getRcmExtraThalassemiaPregnancyAdpMapping
  getRcmExtraThalassemiaPregnancyReportRaw: typeof apiGateway.clinical.getRcmExtraThalassemiaPregnancyReportRaw
  seamlessFetcher?: SeamlessEnricherFetcher
}

const defaultThalassemiaPregnancyGateway: ThalassemiaPregnancyGatewayAdapter = {
  getRcmExtraThalassemiaPregnancyAdpMapping: (refresh) =>
    apiGateway.clinical.getRcmExtraThalassemiaPregnancyAdpMapping(refresh),
  getRcmExtraThalassemiaPregnancyReportRaw: (p) =>
    apiGateway.clinical.getRcmExtraThalassemiaPregnancyReportRaw(p),
}

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
  reps?: string
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

export interface ThalassemiaItem extends SeamlessEnrichedFields {
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
  rep?: string | null
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
  repBreakdown?: RepBreakdownSummary
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
    gateway: Partial<ThalassemiaPregnancyGatewayAdapter> = {}
  ): Promise<ThalassemiaAdpMappingCheck> {
    const gw = { ...defaultThalassemiaPregnancyGateway, ...gateway }
    const cacheKey = 'rcm-thalassemia-adp-mapping-check'
    return getCachedData(
      cacheKey,
      async () => gw.getRcmExtraThalassemiaPregnancyAdpMapping(),
      600000
    )
  }

  /**
   * Generate 3.1 Thalassemia screening in pregnancy report.
   */
  static async getThalassemiaReport(
    params: ThalassemiaReportParams = {},
    gateway: Partial<ThalassemiaPregnancyGatewayAdapter> = {}
  ): Promise<ThalassemiaReportResult> {
    const gw = { ...defaultThalassemiaPregnancyGateway, ...gateway }
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ThalassemiaCardFilter = params.cardFilter || 'ALL'
    const laborTypeFilter: ThalassemiaLaborTypeFilter = params.laborTypeFilter || 'ALL'
    const searchField: ThalassemiaSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ThalassemiaSortField = params.sortBy || 'labor_date'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-thalassemia-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-thalassemia-adp-mapping-check')
    }

    const { adpMapping, rawRows } = await getCachedData(
      cacheKey,
      async () =>
        gw.getRcmExtraThalassemiaPregnancyReportRaw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        }),
      300000
    )

    // Map rows into strongly-typed domain items
    let allItems: ThalassemiaItem[] = (rawRows || []).map((r, idx) => {
      const labStatus = determineLabStatus(
        r.labname != null ? String(r.labname) : null,
        r.labresult != null ? String(r.labresult) : null
      )
      const isThoen = r.labour_hospcode === '11152' || String(r.hospital || '').includes('เถิน')
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
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
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

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

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
    if (selectedReps.length > 0) {
      filteredItems = filteredItems.filter((item) => matchesRepFilter(item, selectedReps))
    }

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
          matchesSeamlessRepSearch(item, search) ||
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
      repBreakdown,
    }
  }
}
