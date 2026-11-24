import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams } from './rcmDashboardService'
import { matchesPttypeFilter } from './pttypeConstants'
import {
  enrichItemsWithSeamlessCache,
  matchesSeamlessRepSearch,
  type SeamlessEnricherFetcher,
} from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

export interface ViralHepatitisGatewayAdapter {
  getRcmExtraViralHepatitisAdpMapping: typeof apiGateway.clinical.getRcmExtraViralHepatitisAdpMapping
  getRcmExtraViralHepatitisReportRaw: typeof apiGateway.clinical.getRcmExtraViralHepatitisReportRaw
  seamlessFetcher?: SeamlessEnricherFetcher
}

const defaultViralHepatitisGateway: ViralHepatitisGatewayAdapter = {
  getRcmExtraViralHepatitisAdpMapping: (refresh) =>
    apiGateway.clinical.getRcmExtraViralHepatitisAdpMapping(refresh),
  getRcmExtraViralHepatitisReportRaw: (p) =>
    apiGateway.clinical.getRcmExtraViralHepatitisReportRaw(p),
}

// ── 1. Domain Types: 23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B (ADP 36318, 36319) ──

export type ViralHepatitisCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'WITH_LAB'
  | 'NO_LAB'
  | 'UC_ONLY'

export type ViralHepatitisSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'LABRESULT'

export type ViralHepatitisSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'pdx'
  | 'authencode'
  | 'labresult'

export interface ViralHepatitisReportParams extends FiscalDateRangeParams {
  cardFilter?: ViralHepatitisCardFilter
  ucOnly?: boolean
  pttypes?: string
  searchField?: ViralHepatitisSearchField
  search?: string
  sortBy?: ViralHepatitisSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface ViralHepatitisAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
  source: 's_drugitems' | 'nondrugitems'
}

export interface ViralHepatitisAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: ViralHepatitisAdpMappingItem[]
}

export interface ViralHepatitisItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttypename: string
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  cc: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  sdx: string | null
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  ops: string | null
  income: number
  listname: string | null
  labresult: string | null
  hasLabResult: boolean
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  status_sm: string | null
  rep_sm: string | null
  compensated_sm: number
  address: string | null
  mobile: string | null
  tel: string | null
  fund: string | null
  subfund: string | null
}

export interface ViralHepatitisSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  withLabCount: number
  withoutLabCount: number
  labRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface ViralHepatitisReportResult {
  ds1: string
  ds2: string
  adpMapping: ViralHepatitisAdpMappingCheck
  cardFilter: ViralHepatitisCardFilter
  ucOnly: boolean
  searchField: ViralHepatitisSearchField
  search: string
  sortBy: ViralHepatitisSortField
  sortOrder: 'asc' | 'desc'
  summary: ViralHepatitisSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ViralHepatitisItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

export function isUniversalCoverageScheme(maininscl?: string | null, pttypename?: string | null): boolean {
  if (maininscl) {
    const code = maininscl.trim().toUpperCase()
    if (code === 'UCS' || code === 'WEL' || code === 'UC') return true
  }
  if (pttypename) {
    const text = pttypename.toLowerCase()
    if (
      text.includes('บัตรทอง') ||
      text.includes('ประกันสุขภาพถ้วนหน้า') ||
      text.includes('30 บาท') ||
      text.includes('uc')
    ) {
      return true
    }
  }
  return false
}

// ── 3. RcmViralHepatitisService Implementation ──────────────────────────────────

export class RcmViralHepatitisService {
  /**
   * Check if ADP codes '36318', '36319' are mapped in s_drugitems or nondrugitems.
   * Mirrors legacy FoxPro check:
   * select count(*) from s_drugitems where nhso_adp_code in ('36318','36319')
   */
  static async checkViralHepatitisAdpMapping(
    gateway: Partial<ViralHepatitisGatewayAdapter> = {},
    refresh?: boolean
  ): Promise<ViralHepatitisAdpMappingCheck> {
    const gw = { ...defaultViralHepatitisGateway, ...gateway }
    const cacheKey = 'rcm-viral-hepatitis-adp-mapping-check-36318-36319'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      async () => {
        try {
          return await gw.getRcmExtraViralHepatitisAdpMapping(refresh)
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            items: [],
          }
        }
      },
      600000
    )
  }

  /**
   * Generate 23.1 Viral Hepatitis B Screening Report (บริการตรวจคัดกรองไวรัสตับอักเสบ B ADP 36318, 36319)
   */
  static async getViralHepatitisReport(
    params: ViralHepatitisReportParams = {},
    gateway: Partial<ViralHepatitisGatewayAdapter> = {}
  ): Promise<ViralHepatitisReportResult> {
    const gw = { ...defaultViralHepatitisGateway, ...gateway }
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ViralHepatitisCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: ViralHepatitisSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ViralHepatitisSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-viral-hepatitis-report-36318-36319-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-viral-hepatitis-adp-mapping-check-36318-36319')
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () =>
        gw.getRcmExtraViralHepatitisReportRaw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        }),
      180000
    )

    // Transform raw rows into structured domain items
    let allItems: ViralHepatitisItem[] = (rawRows || []).map((r, idx) => {
      const compensatedVal = Number(r.compensated) || 0
      const statusStr = r.status ? String(r.status) : ''
      const isComp =
        compensatedVal > 0 ||
        Boolean(r.rep) ||
        (Boolean(statusStr) && !statusStr.includes('ยังไม่ได้ส่ง'))

      const isUc = isUniversalCoverageScheme(
        r.maininscl != null ? String(r.maininscl) : null,
        r.pttypename != null ? String(r.pttypename) : null
      )
      const labResultVal = r.labresult ? String(r.labresult).trim() : null
      const hasLab = Boolean(labResultVal)

      const sDxList = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sdx = sDxList.length > 0 ? sDxList.join(', ') : null

      const opList = [r.op0, r.op1, r.op2, r.op3, r.op4, r.op5]
        .map((o) => (o ? String(o).trim() : ''))
        .filter(Boolean)
      const ops = opList.length > 0 ? opList.join(', ') : null

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age) || 0,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl: String(r.maininscl || '').trim(),
        isUc,
        pttypename: String(r.pttypename || '').trim(),
        pttype_eclaim_id: r.pttype_eclaim_id != null ? String(r.pttype_eclaim_id).trim() : null,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        sdx,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        ops,
        income: Number(r.income) || 0,
        listname: r.listname ? String(r.listname).trim() : null,
        labresult: labResultVal,
        hasLabResult: hasLab,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: Boolean(isComp),
        status_sm: r.status_sm ? String(r.status_sm).trim() : null,
        rep_sm: r.rep_sm ? String(r.rep_sm).trim() : null,
        compensated_sm: Number(r.compensated_sm) || 0,
        address: r.address ? String(r.address).trim() : null,
        mobile: r.mobile ? String(r.mobile).trim() : null,
        tel: r.tel ? String(r.tel).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    // Calculate Summary Aggregates (Full Page Filter based on pttypes / ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      const selectedPttypesList = params.pttypes.split(',').map((p) => p.trim()).filter(Boolean)
      summaryCohort = summaryCohort.filter((item) =>
        matchesPttypeFilter(item.pttypename || item.pttype_eclaim_id, selectedPttypesList, item.isUc, item.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = summaryCohort.filter((item) => item.isUc)
    }

    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withLabCount = 0
    let ucCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount++
      if (item.hasLabResult) withLabCount++
      if (item.isUc) ucCount++
      totalIncome += item.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const withoutLabCount = totalVisits - withLabCount
    const labRate = totalVisits > 0 ? (withLabCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: ViralHepatitisSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      withLabCount,
      withoutLabCount,
      labRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter Items by Card Filter from summaryCohort
    let filteredItems = summaryCohort.filter((item) => {
      if (selectedReps.length > 0 && !matchesRepFilter(item, selectedReps)) return false
      if (cardFilter === 'COMPENSATED' && !item.isCompensated) return false
      if (cardFilter === 'UNCOMPENSATED' && item.isCompensated) return false
      if (cardFilter === 'WITH_AUTHEN' && !item.authencode) return false
      if (cardFilter === 'NO_AUTHEN' && item.authencode) return false
      if (cardFilter === 'WITH_LAB' && !item.hasLabResult) return false
      if (cardFilter === 'NO_LAB' && item.hasLabResult) return false
      if (cardFilter === 'UC_ONLY' && !item.isUc) return false
      return true
    })

    // Filter Items by Search Term
    if (search) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return item.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (item.pdx || '').toLowerCase().includes(search) ||
            (item.sdx || '').toLowerCase().includes(search)
          )
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'LABRESULT') {
          return (item.labresult || '').toLowerCase().includes(search)
        }

        // Global search across all fields
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.pdx || '').toLowerCase().includes(search) ||
          (item.sdx || '').toLowerCase().includes(search) ||
          (item.listname || '').toLowerCase().includes(search) ||
          (item.labresult || '').toLowerCase().includes(search) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.authencode || '').toLowerCase().includes(search) ||
          (item.rep || '').toLowerCase().includes(search) ||
          (item.status || '').toLowerCase().includes(search)
        )
      })
    }

    // Sort Items
    filteredItems.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'vstdate') {
        cmp = a.vstdate.localeCompare(b.vstdate)
        if (cmp === 0) cmp = a.vsttime.localeCompare(b.vsttime)
      } else if (sortBy === 'vsttime') {
        cmp = a.vsttime.localeCompare(b.vsttime)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname, 'th')
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'income') {
        cmp = a.income - b.income
      } else if (sortBy === 'compensated') {
        cmp = a.compensated - b.compensated
      } else if (sortBy === 'pdx') {
        cmp = (a.pdx || '').localeCompare(b.pdx || '')
      } else if (sortBy === 'authencode') {
        cmp = (a.authencode || '').localeCompare(b.authencode || '')
      } else if (sortBy === 'labresult') {
        cmp = (a.labresult || '').localeCompare(b.labresult || '', 'th')
      }

      return sortOrder === 'desc' ? -cmp : cmp
    })

    // Re-index row numbers
    const totalCount = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let resultItems: ViralHepatitisItem[]
    if (exportAll) {
      resultItems = filteredItems.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIdx = (page - 1) * pageSize
      resultItems = filteredItems
        .slice(startIdx, startIdx + pageSize)
        .map((item, idx) => ({ ...item, no: startIdx + idx + 1 }))
    }

    return {
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: resultItems,
      repBreakdown,
    }
  }
}
