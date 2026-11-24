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

// ── 1. Domain Types: 17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP (13001) ──

export type AnemiaScreeningCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'TARGET_AGE'
  | 'REPEAT_CLAIM'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type AnemiaScreeningSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'

export type AnemiaScreeningSortField =
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
  | 'camedate'

export interface AnemiaScreeningReportParams extends FiscalDateRangeParams {
  cardFilter?: AnemiaScreeningCardFilter
  ucOnly?: boolean
  pttypes?: string
  reps?: string
  targetAgeOnly?: boolean
  searchField?: AnemiaScreeningSearchField
  search?: string
  sortBy?: AnemiaScreeningSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface AnemiaScreeningAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AnemiaScreeningAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: AnemiaScreeningAdpMappingItem[]
}

export interface AnemiaScreeningItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  isTargetAge: boolean // Age between 13 and 24 years
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
  listname1?: string | null
  camedate: string | null // เคยเคลมในปีงบประมาณก่อนหน้า visit นี้
  hasRepeatClaim: boolean // มีประวัติเคยเคลมในปีงบเดียวกัน
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

export interface AnemiaScreeningSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  targetAgeCount: number // อายุ 13-24 ปี
  targetAgeRate: number
  repeatClaimCount: number // เคยเคลมซ้ำในปีงบประมาณ
  repeatClaimRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface AnemiaScreeningReportResult {
  adpCode: '13001'
  title: string
  ds1: string
  ds2: string
  fiscalStartYear: string
  adpMapping: AnemiaScreeningAdpMappingCheck
  cardFilter: AnemiaScreeningCardFilter
  ucOnly: boolean
  pttypes?: string
  targetAgeOnly: boolean
  searchField: AnemiaScreeningSearchField
  search: string
  sortBy: AnemiaScreeningSortField
  sortOrder: 'asc' | 'desc'
  summary: AnemiaScreeningSummary
  repBreakdown?: RepBreakdownSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: AnemiaScreeningItem[]
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

/**
 * Calculates start of fiscal year (YYYY-10-01) for a given date YYYY-MM-DD.
 * Equivalent to legacy FoxPro startyear(_start).
 */
export function getFiscalYearStartDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const startY = m >= 10 ? y : y - 1
  return `${startY}-10-01`
}

// ── 3. RcmAnemiaScreeningService Implementation ───────────────────────────────────

export class RcmAnemiaScreeningService {
  /**
   * Check if ADP code '13001' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<AnemiaScreeningAdpMappingCheck> {
    const adpCode = '13001'
    const cacheKey = `rcm-anemia-screening-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      () => fetchAdpMappingViaGateway(adpCode, gateway, { refresh }),
      600000
    )
  }

  static async getAnemiaScreeningReport(
    params: AnemiaScreeningReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<AnemiaScreeningReportResult> {
    const adpCode = '13001'
    const reportTitle = '17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: AnemiaScreeningCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const targetAgeOnly = Boolean(params.targetAgeOnly)
    const searchField: AnemiaScreeningSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: AnemiaScreeningSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const fiscalStartYear = getFiscalYearStartDate(ds1)
    const cacheKey = `rcm-anemia-screening-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-anemia-screening-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmAnemiaScreeningService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('anemia-screening', { ds1, ds2, adpCode }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mappingRes,
        }
      },
      300000
    )

    // Normalize and map items
    const allItems: AnemiaScreeningItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 13 && age <= 24
      const camedate = r.camedate ? String(r.camedate).trim() : null
      const hasRepeatClaim = Boolean(camedate && camedate.length > 0)
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
        isUc,
        pttype_eclaim_id: String(r.pttype_eclaim_id || '').trim(),
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
        camedate: camedate || null,
        hasRepeatClaim,
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
    const pttypes = (params.pttypes || '').trim()
    const selectedPttypesList = pttypes ? pttypes.split(',').map((s) => s.trim()).filter(Boolean) : []

    // Cohort for summary KPIs (Full page filter Q2: A)
    const summaryCohort = selectedPttypesList.length > 0
      ? enrichedAllItems.filter((it) => matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, selectedPttypesList, it.isUc, it.pttype_eclaim_id))
      : enrichedAllItems

    // Calculate Summary Aggregates across summaryCohort
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let repeatClaimCount = 0
    let withAuthenCount = 0
    let ucCount = 0
    let targetAgeCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.hasRepeatClaim) repeatClaimCount++
      if (item.authencode) withAuthenCount++
      if (item.isUc) ucCount++
      if (item.isTargetAge) targetAgeCount++
      totalIncome += item.income
    }

    const totalVisits = summaryCohort.length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const withoutAuthenCount = totalVisits - withAuthenCount
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const repeatClaimRate = totalVisits > 0 ? (repeatClaimCount / totalVisits) * 100 : 0
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const targetAgeRate = totalVisits > 0 ? (targetAgeCount / totalVisits) * 100 : 0

    const summary: AnemiaScreeningSummary = {
      totalVisits,
      uniquePatients: uniqueHnSet.size,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      targetAgeCount,
      targetAgeRate,
      repeatClaimCount,
      repeatClaimRate,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    } else if (cardFilter === 'REPEAT_CLAIM') {
      filtered = filtered.filter((i) => i.hasRepeatClaim)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // Secondary filters: ucOnly & targetAgeOnly (fallback when pttypes is empty)
    if (selectedPttypesList.length === 0 && ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (targetAgeOnly && cardFilter !== 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    // Apply Search
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

        // ALL searchField: searches hn, cid, ptname, vn, pdx, authencode, rep, pttypename
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'vstdate':
          comparison = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
          break
        case 'vsttime':
          comparison = a.vsttime.localeCompare(b.vsttime)
          break
        case 'hn':
          comparison = a.hn.localeCompare(b.hn)
          break
        case 'cid':
          comparison = a.cid.localeCompare(b.cid)
          break
        case 'ptname':
          comparison = a.ptname.localeCompare(b.ptname, 'th')
          break
        case 'age':
          comparison = a.age - b.age
          break
        case 'income':
          comparison = a.income - b.income
          break
        case 'compensated':
          comparison = a.compensated - b.compensated
          break
        case 'pdx':
          comparison = (a.pdx || '').localeCompare(b.pdx || '')
          break
        case 'authencode':
          comparison = (a.authencode || '').localeCompare(b.authencode || '')
          break
        case 'camedate':
          comparison = (a.camedate || '').localeCompare(b.camedate || '')
          break
        default:
          comparison = a.vstdate.localeCompare(b.vstdate)
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Re-index displayed numbers sequentially
    const reindexedItems = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = reindexedItems.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    const paginatedItems = exportAll
      ? reindexedItems
      : reindexedItems.slice((page - 1) * pageSize, page * pageSize)

    return {
      adpCode,
      title: reportTitle,
      ds1,
      ds2,
      fiscalStartYear,
      adpMapping,
      cardFilter,
      ucOnly,
      pttypes,
      targetAgeOnly,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      repBreakdown,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: paginatedItems,
    }
  }
}
