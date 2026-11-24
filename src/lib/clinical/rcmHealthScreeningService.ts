import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  NO_REP_FILTER_VALUE,
  type RepBreakdownSummary,
  type RepTagEntry,
  type RepTagGroupSummary,
} from './rcmRepTagHelper'
import { resolveFiscalDateRange, type FiscalDateRangeParams } from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'

export {
  NO_REP_FILTER_VALUE,
  type RepBreakdownSummary,
  type RepTagEntry,
  type RepTagGroupSummary,
}

// ── 1. Domain Types: 14. บริการคัดกรองและประเมินปัจจัยเสี่ยงต่อสุขภาพกาย/สุขภาพจิต-ADP ──

export type HealthScreeningCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'REPEAT_CLAIM'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'TARGET_AGE'

export type HealthScreeningSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'

export type HealthScreeningSortField =
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

export interface HealthScreeningReportParams extends FiscalDateRangeParams {
  adpCode: '12003' | '12004'
  cardFilter?: HealthScreeningCardFilter
  ucOnly?: boolean
  pttypes?: string
  reps?: string
  targetAgeOnly?: boolean
  searchField?: HealthScreeningSearchField
  search?: string
  sortBy?: HealthScreeningSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface HealthScreeningAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface HealthScreeningAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: HealthScreeningAdpMappingItem[]
}

export interface HealthScreeningItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number
  isTargetAge: boolean // For 14.6: 45-59 years old
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

export interface HealthScreeningSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  repeatClaimCount: number // เคยเคลมซ้ำในปีงบประมาณ
  repeatClaimRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  targetAgeCount: number // อายุ 45-59 ปี (สำหรับ 14.6)
  targetAgeRate: number
  totalIncome: number
}

export interface HealthScreeningReportResult {
  adpCode: '12003' | '12004'
  title: string
  ds1: string
  ds2: string
  fiscalStartYear: string
  adpMapping: HealthScreeningAdpMappingCheck
  cardFilter: HealthScreeningCardFilter
  ucOnly: boolean
  pttypes?: string
  reps?: string
  targetAgeOnly: boolean
  searchField: HealthScreeningSearchField
  search: string
  sortBy: HealthScreeningSortField
  sortOrder: 'asc' | 'desc'
  summary: HealthScreeningSummary
  repBreakdown?: RepBreakdownSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: HealthScreeningItem[]
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

// ── 3. RcmHealthScreeningService Implementation ───────────────────────────────────

export class RcmHealthScreeningService {
  /**
   * Check if ADP code ('12003' or '12004') is mapped in s_drugitems table.
   * Mirrors legacy FoxPro check:
   * select count(*) from s_drugitems where nhso_adp_code in ('12003' / '12004')
   */
  static async checkAdpMapping(
    adpCode: '12003' | '12004',
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<HealthScreeningAdpMappingCheck> {
    const cacheKey = `rcm-health-screening-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      async () => fetchAdpMappingViaGateway(adpCode, gateway, { refresh }),
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 14.5 or 14.6 Health Screening Report via API Gateway.
   */
  static async getHealthScreeningReport(
    params: HealthScreeningReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<HealthScreeningReportResult> {
    const adpCode = params.adpCode || '12003'
    const is146 = adpCode === '12004'
    const reportTitle = is146
      ? '14.6 เจาะเลือดจากหลอดเลือดดำ หลังอดอาหาร 8 ชม. Total Cholesterol หรือ HDL (อายุ 45-59 ปี)'
      : '14.5 ตรวจระดับน้ำตาลในเลือด Fasting Plasma Glucose (FPG)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const fiscalStartYear = getFiscalYearStartDate(ds1)

    const cardFilter: HealthScreeningCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const targetAgeOnly = Boolean(params.targetAgeOnly)
    const searchField: HealthScreeningSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: HealthScreeningSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-health-screening-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-health-screening-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmHealthScreeningService.checkAdpMapping(adpCode, gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('health-screening', { ds1, ds2, adpCode }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mappingRes,
        }
      },
      180000 // Cache TTL 3 minutes
    )

    // Transform raw rows into structured domain items
    let allItems: HealthScreeningItem[] = (rawRows || []).map((r, idx) => {
      const compensatedVal = Number(r.compensated) || 0
      const isComp = compensatedVal > 0 || Boolean(r.rep)
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename)
      const ageNum = Number(r.age) || 0
      const isTargetAge = ageNum >= 45 && ageNum <= 59 // Target age for 14.6
      const camedateVal = r.camedate ? String(r.camedate).trim() : null
      const hasRepeatClaim = Boolean(camedateVal)

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
        age: ageNum,
        isTargetAge,
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
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        camedate: camedateVal,
        hasRepeatClaim,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: isComp,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        errorcode: r.errorcode ? String(r.errorcode).trim() : null,
        transactiontype: r.transactiontype ? String(r.transactiontype).trim() : null,
      }
    })

    const pttypes = (params.pttypes || '').trim()
    const selectedPttypesList = pttypes ? pttypes.split(',').map((s) => s.trim()).filter(Boolean) : []
    const selectedRepsList = parseRepFilterParam(params.reps)
    const repsParam = selectedRepsList.length > 0 ? selectedRepsList.join(',') : undefined

    // Cohort for summary KPIs (Full page filter Q2: A)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, resolveSeamlessFetcher(gateway), Boolean(params.refresh))
    const summaryCohort = selectedPttypesList.length > 0
      ? allItems.filter((it) => matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, selectedPttypesList, it.isUc, it.pttype_eclaim_id))
      : allItems

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)

    // Compute Summary KPIs across summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const compensatedVisits = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0

    const repeatClaimCount = summaryCohort.filter((i) => i.hasRepeatClaim).length
    const repeatClaimRate = totalVisits > 0 ? (repeatClaimCount / totalVisits) * 100 : 0

    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0

    const ucCount = summaryCohort.filter((i) => i.isUc).length
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const targetAgeCount = summaryCohort.filter((i) => i.isTargetAge).length
    const targetAgeRate = totalVisits > 0 ? (targetAgeCount / totalVisits) * 100 : 0

    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)

    const summary: HealthScreeningSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      repeatClaimCount,
      repeatClaimRate,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      targetAgeCount,
      targetAgeRate,
      totalIncome,
    }

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'REPEAT_CLAIM') {
      filtered = filtered.filter((i) => i.hasRepeatClaim)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    } else if (cardFilter === 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }

    // Secondary filters (fallback when pttypes is empty)
    if (selectedPttypesList.length === 0 && ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (targetAgeOnly && cardFilter !== 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    // Apply Search Filter
    if (search) {
      filtered = filtered.filter((item) => {
        if (searchField === 'HN') {
          return item.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          return item.cid.toLowerCase().includes(search)
        }
        if (searchField === 'PTNAME') {
          return item.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return item.vn.toLowerCase().includes(search)
        }
        if (searchField === 'DIAG') {
          const dxMatch =
            (item.pdx && item.pdx.toLowerCase().includes(search)) ||
            (item.sdx && item.sdx.toLowerCase().includes(search))
          return Boolean(dxMatch)
        }
        if (searchField === 'PTTYPE') {
          return item.pttypename.toLowerCase().includes(search)
        }

        // searchField === 'ALL'
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.sdx && item.sdx.toLowerCase().includes(search)) ||
          (item.clinic && item.clinic.toLowerCase().includes(search)) ||
          (item.department && item.department.toLowerCase().includes(search)) ||
          (item.listname && item.listname.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search)) ||
          (item.status && item.status.toLowerCase().includes(search))
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null) valA = ''
      if (valB == null) valB = ''

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA)
      const strB = String(valB)
      return sortOrder === 'asc'
        ? strA.localeCompare(strB, 'th')
        : strB.localeCompare(strA, 'th')
    })

    // Re-index displayed item numbers
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems: HealthScreeningItem[]
    if (exportAll) {
      pagedItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIdx = (page - 1) * pageSize
      pagedItems = filtered.slice(startIdx, startIdx + pageSize).map((item, idx) => ({
        ...item,
        no: startIdx + idx + 1,
      }))
    }

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
      reps: repsParam,
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
      items: pagedItems,
    }
  }
}
