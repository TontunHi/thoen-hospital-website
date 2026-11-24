import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { matchesPttypeFilter } from './pttypeConstants'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: 20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001) ──

export type FluorideVarnishCardFilter =
  | 'ALL'
  | 'TARGET_AGE'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type FluorideVarnishSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'

export type FluorideVarnishSortField =
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

export interface FluorideVarnishReportParams extends FiscalDateRangeParams {
  cardFilter?: FluorideVarnishCardFilter
  ucOnly?: boolean
  pttypes?: string
  targetAgeOnly?: boolean
  reps?: string
  searchField?: FluorideVarnishSearchField
  search?: string
  sortBy?: FluorideVarnishSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface FluorideVarnishAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface FluorideVarnishAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: FluorideVarnishAdpMappingItem[]
}

export interface FluorideVarnishItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  isTargetAge: boolean // Age between 25 and 59 years
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id?: string
  isUc: boolean
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
  listname: string | null // ADP 15001 item name
  listname1?: string | null // Non-drug items
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund: string | null
  subfund: string | null
  errorcode?: string | null
  transactiontype?: string | null
}

export interface FluorideVarnishSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  targetAgeCount: number // อายุ 25-59 ปี
  targetAgeRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface FluorideVarnishReportResult {
  title: string
  adpCode: string
  ds1: string
  ds2: string
  cardFilter: FluorideVarnishCardFilter
  ucOnly: boolean
  targetAgeOnly: boolean
  searchField: FluorideVarnishSearchField
  search: string
  sortBy: FluorideVarnishSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  items: FluorideVarnishItem[]
  summary: FluorideVarnishSummary
  adpMapping: FluorideVarnishAdpMappingCheck
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Business Logic Helpers ─────────────────────────────────

/**
 * Checks if the patient scheme corresponds to Universal Coverage (บัตรทอง / UC / UCS / WEL).
 */
export function isUniversalCoverageScheme(
  maininscl?: string | null,
  pttypename?: string | null,
  pttypeEclaimId?: string | null
): boolean {
  if (pttypeEclaimId) {
    const num = parseInt(pttypeEclaimId.trim(), 10)
    if (!isNaN(num) && num >= 1 && num <= 9) return true
  }
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

// ── 3. Service Implementation ─────────────────────────────────

export class RcmFluorideVarnishService {
  /**
   * Check if ADP code '15001' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<FluorideVarnishAdpMappingCheck> {
    const adpCode = '15001'
    const cacheKey = `rcm-fluoride-varnish-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      () => fetchAdpMappingViaGateway(adpCode, gateway, { refresh }),
      600000
    )
  }

  static async getFluorideVarnishReport(
    params: FluorideVarnishReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<FluorideVarnishReportResult> {
    const adpCode = '15001'
    const reportTitle = '20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: FluorideVarnishCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const targetAgeOnly = Boolean(params.targetAgeOnly)
    const searchField: FluorideVarnishSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: FluorideVarnishSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fluoride-varnish-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fluoride-varnish-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmFluorideVarnishService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('fluoride-varnish', { ds1, ds2, adpCode }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mappingRes,
        }
      },
      300000
    )

    // Normalize and map items
    const allItems: FluorideVarnishItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 25 && age <= 59
      const sex = formatThaiSex(r.sex_code, r.sex)

      const sDxList = [r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sOpsList = [r.op1, r.op2, r.op3, r.op4, r.op5]
        .map((op) => (op ? String(op).trim() : ''))
        .filter(Boolean)

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex,
        age,
        isTargetAge,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: authencode || null,
        maininscl,
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pttypename,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        sdx: sDxList.length > 0 ? sDxList.join(', ') : null,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        ops: sOpsList.length > 0 ? sOpsList.join(', ') : null,
        income: Number(r.income) || 0,
        listname: r.listname ? String(r.listname).trim() : null,
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        errorcode: r.errorcode ? String(r.errorcode).trim() : null,
        transactiontype: r.transactiontype ? String(r.transactiontype).trim() : null,
      }
    })

    const enrichedAllItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = enrichedAllItems
    if (params.pttypes) {
      summaryCohort = enrichedAllItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = enrichedAllItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const compensatedVisits = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? Math.round((compensatedVisits / totalVisits) * 1000) / 10 : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const averageCompensated =
      compensatedVisits > 0 ? Math.round((totalCompensated / compensatedVisits) * 100) / 100 : 0

    const targetAgeCount = summaryCohort.filter((i) => i.isTargetAge).length
    const targetAgeRate = totalVisits > 0 ? Math.round((targetAgeCount / totalVisits) * 1000) / 10 : 0

    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? Math.round((withAuthenCount / totalVisits) * 1000) / 10 : 0

    const ucCount = summaryCohort.filter((i) => i.isUc).length
    const ucRate = totalVisits > 0 ? Math.round((ucCount / totalVisits) * 1000) / 10 : 0
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)

    const summary: FluorideVarnishSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      targetAgeCount,
      targetAgeRate,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter by Card & Toggles
    let filtered = [...summaryCohort]

    if (cardFilter === 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    } else if (cardFilter === 'COMPENSATED') {
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

    if (ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (targetAgeOnly && cardFilter !== 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Filter by Search Query
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (i.pdx || '').toLowerCase().includes(search) ||
            (i.sdx || '').toLowerCase().includes(search)
          )
        }
        if (searchField === 'PTTYPE') return i.pttypename.toLowerCase().includes(search)

        // Global search across all relevant fields
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx || '').toLowerCase().includes(search) ||
          (i.sdx || '').toLowerCase().includes(search) ||
          (i.authencode || '').toLowerCase().includes(search) ||
          i.pttypename.toLowerCase().includes(search) ||
          (i.listname || '').toLowerCase().includes(search) ||
          (i.status || '').toLowerCase().includes(search) ||
          (i.rep || '').toLowerCase().includes(search)
        )
      })
    }

    // Sort items
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'vstdate') {
        cmp = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
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
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Re-index filtered rows
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pageItems: FluorideVarnishItem[]
    if (exportAll) {
      pageItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIdx = (page - 1) * pageSize
      pageItems = filtered.slice(startIdx, startIdx + pageSize).map((item, idx) => ({
        ...item,
        no: startIdx + idx + 1,
      }))
    }

    return {
      title: reportTitle,
      adpCode,
      ds1,
      ds2,
      cardFilter,
      ucOnly,
      targetAgeOnly,
      searchField,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      items: pageItems,
      summary,
      adpMapping,
      repBreakdown,
    }
  }
}
