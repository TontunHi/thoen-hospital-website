import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import { resolveFiscalDateRange, type FiscalDateRangeParams } from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: 12.1 บริการคัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก (Oral Cancer Screening ADP 90004) ──

export type OralCancerCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type OralCancerSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'OP'

export type OralCancerSortField =
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

export interface OralCancerReportParams extends FiscalDateRangeParams {
  cardFilter?: OralCancerCardFilter
  ucOnly?: boolean
  pttypes?: string
  searchField?: OralCancerSearchField
  search?: string
  sortBy?: OralCancerSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface OralCancerAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface OralCancerAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: OralCancerAdpMappingItem[]
}

export interface OralCancerItem {
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
  pttype_eclaim_id: string
  pttypename: string
  department: string | null
  clinic: string | null
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
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface OralCancerSummary {
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
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface OralCancerReportResult {
  ds1: string
  ds2: string
  adpMapping: OralCancerAdpMappingCheck
  cardFilter: OralCancerCardFilter
  ucOnly: boolean
  pttypes?: string
  searchField: OralCancerSearchField
  search: string
  sortBy: OralCancerSortField
  sortOrder: 'asc' | 'desc'
  summary: OralCancerSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: OralCancerItem[]
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

// ── 3. RcmOralCancerService Implementation ───────────────────────────────────

export class RcmOralCancerService {
  /**
   * Check if ADP code '90004' is mapped in s_drugitems table.
   * Mirrors legacy FoxPro check:
   * select count(*) from s_drugitems where nhso_adp_code in ('90004')
   */
  static async checkOralCancerAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<OralCancerAdpMappingCheck> {
    const cacheKey = 'rcm-oral-cancer-adp-mapping-check-90004'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      async () => {
        const res = await fetchAdpMappingViaGateway('90004', gateway, { refresh })
        return { isMapped: res.isMapped, mappedCount: res.mappedCount, items: res.items }
      },
      600000
    )
  }

  static async getOralCancerReport(
    params: OralCancerReportParams = {},
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<OralCancerReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: OralCancerCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: OralCancerSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: OralCancerSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-oral-cancer-report-90004-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-oral-cancer-adp-mapping-check-90004')
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmOralCancerService.checkOralCancerAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('oral-cancer', { ds1, ds2 }),
        ])
        return { rawRows: extractFundRawRows(gwRes), adpMapping: mappingRes }
      },
      180000
    )

    // Transform raw rows into structured domain items
    let allItems: OralCancerItem[] = (rawRows || []).map((r, idx) => {
      const compensatedVal = Number(r.compensated) || 0
      const isComp = compensatedVal > 0 || Boolean(r.rep)
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename)

      const sDxList = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sdx = sDxList.length > 0 ? sDxList.join(', ') : null

      const opList = [r.op0, r.op1, r.op2, r.op3, r.op4, r.op5]
        .map((op) => (op ? String(op).trim() : ''))
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
        pttype_eclaim_id: String(r.pttype_eclaim_id || '').trim(),
        pttypename: String(r.pttypename || '').trim(),
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
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
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: isComp,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    const pttypes = (params.pttypes || '').trim()
    const selectedPttypesList = pttypes ? pttypes.split(',').map((s) => s.trim()).filter(Boolean) : []

    // Cohort for summary KPIs (Full page filter Q2: A)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, resolveSeamlessFetcher(gateway), Boolean(params.refresh))
    const summaryCohort = selectedPttypesList.length > 0
      ? allItems.filter((it) => matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, selectedPttypesList, it.isUc, it.pttype_eclaim_id))
      : allItems

    // Compute Summary KPIs across summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const compensatedVisits = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0

    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0

    const ucCount = summaryCohort.filter((i) => i.isUc).length
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)

    const summary: OralCancerSummary = {
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
      ucCount,
      ucRate,
      totalIncome,
    }

    // Apply Card Filter
    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // Secondary UC only filter toggle (fallback when pttypes is empty)
    if (selectedPttypesList.length === 0 && ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Apply Search Filter
    if (search) {
      filtered = filtered.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return item.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (item.pdx && item.pdx.toLowerCase().includes(search)) ||
            (item.sdx && item.sdx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'OP') return Boolean(item.ops && item.ops.toLowerCase().includes(search))

        // 'ALL' fields
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.department && item.department.toLowerCase().includes(search)) ||
          (item.clinic && item.clinic.toLowerCase().includes(search)) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.sdx && item.sdx.toLowerCase().includes(search)) ||
          (item.ops && item.ops.toLowerCase().includes(search)) ||
          (item.listname && item.listname.toLowerCase().includes(search)) ||
          (item.status && item.status.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search))
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      const valA: string | number = a[sortBy] ?? ''
      const valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB, 'th')
        return sortOrder === 'asc' ? comp : -comp
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })

    // Re-index displayed item numbers
    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    let pagedItems: OralCancerItem[]
    if (exportAll) {
      pagedItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered.slice(startIndex, startIndex + pageSize).map((item, idx) => ({
        ...item,
        no: startIndex + idx + 1,
      }))
    }

    return {
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      pttypes,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: pagedItems,
      repBreakdown,
    }
  }
}
