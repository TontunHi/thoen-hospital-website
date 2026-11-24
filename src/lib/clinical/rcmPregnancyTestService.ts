import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams } from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: 8.1 การทดสอบการตั้งครรภ์ (Pregnancy Test ADP 31101, 30014) ──

export type PregnancyTestCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'UC_ONLY'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type PregnancyTestSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'LABRESULT'

export type PregnancyTestSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'lab_order_result'

export interface PregnancyTestReportParams extends FiscalDateRangeParams {
  cardFilter?: PregnancyTestCardFilter
  pttypes?: string
  ucOnly?: boolean
  searchField?: PregnancyTestSearchField
  search?: string
  sortBy?: PregnancyTestSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface PregnancyTestAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface PregnancyTestAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: PregnancyTestAdpMappingItem[]
}

export type PregnancyLabStatus = 'POSITIVE' | 'NEGATIVE' | 'PENDING' | 'NO_LAB' | 'OTHER'

export interface PregnancyTestItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttypename: string
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  pdx: string | null
  sdx: string | null
  income: number
  labname: string | null
  listname: string | null
  lab_order_result: string | null
  labStatus: PregnancyLabStatus
  combined_labname: string
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface PregnancyTestSummary {
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
  positiveCount: number
  positiveRate: number
  negativeCount: number
  negativeRate: number
  pendingCount: number
  noLabCount: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface PregnancyTestReportResult {
  ds1: string
  ds2: string
  adpMapping: PregnancyTestAdpMappingCheck
  cardFilter: PregnancyTestCardFilter
  ucOnly: boolean
  searchField: PregnancyTestSearchField
  search: string
  sortBy: PregnancyTestSortField
  sortOrder: 'asc' | 'desc'
  summary: PregnancyTestSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: PregnancyTestItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

/**
 * Evaluates the lab result text from lab_order (UPT / Pregnancy test)
 * and categorizes into POSITIVE, NEGATIVE, PENDING, NO_LAB, or OTHER.
 */
export function determinePregnancyLabStatus(
  labResult: string | null | undefined
): PregnancyLabStatus {
  if (!labResult || !labResult.trim()) {
    return 'NO_LAB'
  }
  const text = labResult.trim().toLowerCase()

  if (text.includes('รอผล') || text.includes('pending') || text.includes('processing')) {
    return 'PENDING'
  }

  // Check negative keywords first to avoid 'non-reactive' matching 'reactive'
  if (
    text.includes('non-reactive') ||
    text.includes('not reactive') ||
    text.includes('negative') ||
    text === 'neg' ||
    text.includes('neg.') ||
    text.includes('ไม่พบการตั้งครรภ์') ||
    text.includes('ไม่พบ') ||
    text.includes('ผลลบ') ||
    text === '-' ||
    text.startsWith('- ')
  ) {
    return 'NEGATIVE'
  }

  // Check positive keywords (+, pos, positive, reactive, พบ)
  if (
    text.includes('positive') ||
    text === 'pos' ||
    text.includes('pos.') ||
    text.includes('reactive') ||
    text.includes('พบการตั้งครรภ์') ||
    text.includes('ผลบวก') ||
    text === '+' ||
    text.startsWith('+ ')
  ) {
    return 'POSITIVE'
  }

  return 'OTHER'
}

// ── 3. RcmPregnancyTestService Class ──────────────────────────────────────────

export class RcmPregnancyTestService {
  /**
   * Check if ADP codes '31101' and '30014' are mapped in s_drugitems table.
   * Matches FoxPro verification:
   * select count(*) from s_drugitems where nhso_adp_code in ('31101', '30014')
   */
  static async checkPregnancyTestAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<PregnancyTestAdpMappingCheck> {
    const cacheKey = 'rcm-pregnancy-test-adp-mapping-check'
    return getCachedData(
      cacheKey,
      async () => {
        const res = await fetchAdpMappingViaGateway('31101,30014', gateway)
        return {
          isMapped: res.isMapped,
          mappedCount: res.mappedCount,
          items: res.items,
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 8.1 Pregnancy testing report (การทดสอบการตั้งครรภ์).
   * Fetches visits with dispensing of ADP 31101 / 30014 and UPT lab results via API Gateway.
   */
  static async getPregnancyTestReport(
    params: PregnancyTestReportParams = {},
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<PregnancyTestReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: PregnancyTestCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: PregnancyTestSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: PregnancyTestSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-pregnancy-test-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-pregnancy-test-adp-mapping-check')
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmPregnancyTestService.checkPregnancyTestAdpMapping(gateway),
          gateway.getRcmFundData('pregnancy-test', { ds1, ds2 }),
        ])
        return {
          rawRows: extractFundRawRows<Record<string, unknown>>(gwRes),
          adpMapping: mappingRes,
        }
      },
      600 // Cache TTL 10 minutes
    )

    // Map raw rows into typed domain items
    let allItems: PregnancyTestItem[] = rawRows.map((r, idx) => {
      const compensated = Number(r.compensated || 0)
      const income = Number(r.income || 0)
      const labResult = r.lab_order_result ? String(r.lab_order_result).trim() : null
      const labStatus = determinePregnancyLabStatus(labResult)
      const drugLabName = r.drug_labname ? String(r.drug_labname).trim() : null
      const listName = r.listname ? String(r.listname).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc = isUcEclaimCode(pttypeEclaimId) || maininscl.toUpperCase() === 'UCS'

      // Mirror FoxPro: asstring(concat_ws('#',dd.labname,lo.lab_order_result)) labname
      const combinedLabName = [drugLabName, labResult].filter(Boolean).join('#')

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl,
        isUc,
        pttypename: String(r.pttypename || '').trim(),
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        sdx: r.sdx ? String(r.sdx).trim() : null,
        income,
        labname: drugLabName,
        listname: listName,
        lab_order_result: labResult,
        labStatus,
        combined_labname: combinedLabName,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, resolveSeamlessFetcher(gateway), Boolean(params.refresh))
    const summaryCohort = allItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (ucOnly || cardFilter === 'UC_ONLY') {
        return i.isUc
      }
      return true
    })

    // Compute baseline summary metrics across summaryCohort
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let positiveCount = 0
    let negativeCount = 0
    let pendingCount = 0
    let noLabCount = 0
    let ucCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      totalIncome += item.income

      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) {
        withAuthenCount++
      } else {
        withoutAuthenCount++
      }

      if (item.isUc) {
        ucCount++
      }

      if (item.labStatus === 'POSITIVE') positiveCount++
      else if (item.labStatus === 'NEGATIVE') negativeCount++
      else if (item.labStatus === 'PENDING') pendingCount++
      else if (item.labStatus === 'NO_LAB') noLabCount++
    }

    const totalVisits = summaryCohort.length
    const compensationRate = totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const authenRate = totalVisits > 0 ? Number(((withAuthenCount / totalVisits) * 100).toFixed(1)) : 0
    const positiveRate = totalVisits > 0 ? Number(((positiveCount / totalVisits) * 100).toFixed(1)) : 0
    const negativeRate = totalVisits > 0 ? Number(((negativeCount / totalVisits) * 100).toFixed(1)) : 0
    const ucRate = totalVisits > 0 ? Number(((ucCount / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: PregnancyTestSummary = {
      totalVisits,
      uniquePatients: uniqueHnSet.size,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated: Number(totalCompensated.toFixed(2)),
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      positiveCount,
      positiveRate,
      negativeCount,
      negativeRate,
      pendingCount,
      noLabCount,
      ucCount,
      ucRate,
      totalIncome: Number(totalIncome.toFixed(2)),
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply interactive filters
    let filtered = summaryCohort

    // 2. Card Filter
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'POSITIVE') {
      filtered = filtered.filter((i) => i.labStatus === 'POSITIVE')
    } else if (cardFilter === 'NEGATIVE') {
      filtered = filtered.filter((i) => i.labStatus === 'NEGATIVE')
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // 3. Search query filter
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (i.pdx && i.pdx.toLowerCase().includes(search)) ||
            (i.sdx && i.sdx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'PTTYPE') return i.pttypename.toLowerCase().includes(search)
        if (searchField === 'LABRESULT') {
          return (
            (i.lab_order_result && i.lab_order_result.toLowerCase().includes(search)) ||
            (i.labname && i.labname.toLowerCase().includes(search))
          )
        }
        // ALL
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.sdx && i.sdx.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search) ||
          (i.lab_order_result && i.lab_order_result.toLowerCase().includes(search)) ||
          (i.labname && i.labname.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search)) ||
          (i.clinic && i.clinic.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search))
        )
      })
    }

    // 4. Sorting
    filtered.sort((a, b) => {
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
      } else if (sortBy === 'lab_order_result') {
        cmp = (a.lab_order_result || '').localeCompare(b.lab_order_result || '', 'th')
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1
    const offset = (page - 1) * pageSize
    const paginated = exportAll ? filtered : filtered.slice(offset, offset + pageSize)

    // Re-number rows for the display view
    const numberedItems = paginated.map((item, idx) => ({
      ...item,
      no: exportAll ? idx + 1 : offset + idx + 1,
    }))

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
      items: numberedItems,
      repBreakdown,
    }
  }
}
