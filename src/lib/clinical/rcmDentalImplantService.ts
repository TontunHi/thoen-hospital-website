import { getCachedData, invalidateCacheKey } from '@/lib/cache'
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
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: กองทุนรากฟันเทียม (Dental Implant) - DENSUR ────────────────

export const DENSUR_ADP_CODE = 'DENSUR'

export type DentalImplantCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type DentalImplantSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'pttypename'
  | 'authencode'
  | 'pdx'
  | 'listname'
  | 'status'
  | 'rep'
  | 'compensated'

export interface DentalImplantReportParams extends FiscalDateRangeParams {
  cardFilter?: DentalImplantCardFilter
  pttypes?: string
  reps?: string
  ucOnly?: boolean
  search?: string
  sortBy?: DentalImplantSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface DentalImplantAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface DentalImplantAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: DentalImplantAdpMappingItem[]
}

export interface DentalImplantDensurItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id?: string | null
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
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  listname: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund?: string | null
  subfund?: string | null
  errorcode?: string | null
  transactiontype?: string | null
}

export interface DentalImplantSummary {
  totalCases: number
  uniquePatients: number
  compensatedCases: number
  uncompensatedCases: number
  compensationRate: number
  totalCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
}

export interface DentalImplantReportResult {
  title: string
  subtitle: string
  adpCode: string
  ds1: string
  ds2: string
  adpMapping: DentalImplantAdpMappingCheck
  cardFilter: DentalImplantCardFilter
  search: string
  sortBy: DentalImplantSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: DentalImplantSummary
  repBreakdown?: RepBreakdownSummary
  items: DentalImplantDensurItem[]
}

// ── 2. Helper Functions ─────────────────────────────────────────────────────

function isUniversalCoverage(maininscl: string, pttypename: string, pttypeEclaimId?: string | null): boolean {
  if (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) return true
  const normMain = (maininscl || '').trim().toUpperCase()
  if (normMain === 'UCS' || normMain === 'UC' || normMain === 'WEL') return true
  const normName = (pttypename || '').toLowerCase()
  if (
    normName.includes('ประกันสุขภาพ') ||
    normName.includes('บัตรทอง') ||
    normName.includes('ถ้วนหน้า') ||
    normName.includes('uc') ||
    normName.includes('ท.74') ||
    normName.includes('ท.89')
  ) {
    return true
  }
  return false
}

// ── 3. Service Implementation ───────────────────────────────────────────────

export class RcmDentalImplantService {
  /**
   * Check if ADP code 'DENSUR' is mapped in s_drugitems via API Gateway.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<DentalImplantAdpMappingCheck> {
    const adpCode = DENSUR_ADP_CODE
    const cacheKey = `rcm-dental-implant-adp-mapping-check-${adpCode}`
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
   * Generate กองทุนรากฟันเทียม - รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR Report:
   * - Fetches OPD visits with dispensing of ADP code DENSUR (age 25-59) from API Gateway
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getDensurReport(
    params: DentalImplantReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<DentalImplantReportResult> {
    const adpCode = DENSUR_ADP_CODE
    const categoryTitle = 'กองทุนรากฟันเทียม'
    const reportTitle = 'รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: DentalImplantCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: DentalImplantSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-dental-implant-densur-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-dental-implant-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmDentalImplantService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('dental-implant', { ds1, ds2, adpCode }),
        ])

        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mappingRes,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    // Transform and map rows
    const allItems: DentalImplantDensurItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated || 0)
      const pttypename = String(r.pttypename || '').trim()
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverage(maininscl, pttypename, pttypeEclaimId)
      const isCompensated = compensated > 0 || (r.status && String(r.status).includes('ชดเชย'))

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        age: Number(r.age || 0),
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
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
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: Boolean(isCompensated),
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
      summaryCohort = enrichedAllItems.filter((it) =>
        matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, params.pttypes, it.isUc, it.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = enrichedAllItems.filter((it) => it.isUc)
    }

    // Calculate aggregated summary
    const uniqueHnSet = new Set<string>()
    let compensatedCases = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0

    for (const it of summaryCohort) {
      if (it.hn) uniqueHnSet.add(it.hn)
      if (it.isCompensated) {
        compensatedCases++
        totalCompensated += it.compensated
      }
      if (it.authencode) withAuthenCount++
      if (it.isUc) ucCount++
    }

    const totalCases = summaryCohort.length
    const uncompensatedCases = totalCases - compensatedCases
    const withoutAuthenCount = totalCases - withAuthenCount
    const compensationRate = totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0
    const authenRate = totalCases > 0 ? (withAuthenCount / totalCases) * 100 : 0
    const ucRate = totalCases > 0 ? (ucCount / totalCases) * 100 : 0

    const summary: DentalImplantSummary = {
      totalCases,
      uniquePatients: uniqueHnSet.size,
      compensatedCases,
      uncompensatedCases,
      compensationRate,
      totalCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Card Filter
    let filteredItems = summaryCohort
    switch (cardFilter) {
      case 'COMPENSATED':
        filteredItems = filteredItems.filter((it) => it.isCompensated)
        break
      case 'UNCOMPENSATED':
        filteredItems = filteredItems.filter((it) => !it.isCompensated)
        break
      case 'WITH_AUTHEN':
        filteredItems = filteredItems.filter((it) => Boolean(it.authencode))
        break
      case 'NO_AUTHEN':
        filteredItems = filteredItems.filter((it) => !it.authencode)
        break
      case 'UC_ONLY':
        filteredItems = filteredItems.filter((it) => it.isUc)
        break
      case 'ALL':
      default:
        break
    }
    if (selectedRepsList.length > 0) {
      filteredItems = filteredItems.filter((it) => matchesRepFilter(it, selectedRepsList))
    }

    // Apply Global Search (HN, CID, Name, VN, PDX, DX0-5, OP0-5, Pttype, Authen code, Listname, Status, Rep)
    if (search) {
      filteredItems = filteredItems.filter((it) => {
        return (
          matchesSeamlessRepSearch(it, search) ||
          it.hn.toLowerCase().includes(search) ||
          it.cid.toLowerCase().includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          it.vn.toLowerCase().includes(search) ||
          (it.authencode && it.authencode.toLowerCase().includes(search)) ||
          (it.pdx && it.pdx.toLowerCase().includes(search)) ||
          (it.dx0 && it.dx0.toLowerCase().includes(search)) ||
          (it.dx1 && it.dx1.toLowerCase().includes(search)) ||
          (it.dx2 && it.dx2.toLowerCase().includes(search)) ||
          (it.dx3 && it.dx3.toLowerCase().includes(search)) ||
          (it.dx4 && it.dx4.toLowerCase().includes(search)) ||
          (it.dx5 && it.dx5.toLowerCase().includes(search)) ||
          (it.op0 && it.op0.toLowerCase().includes(search)) ||
          (it.op1 && it.op1.toLowerCase().includes(search)) ||
          (it.op2 && it.op2.toLowerCase().includes(search)) ||
          (it.op3 && it.op3.toLowerCase().includes(search)) ||
          (it.op4 && it.op4.toLowerCase().includes(search)) ||
          (it.op5 && it.op5.toLowerCase().includes(search)) ||
          (it.pttypename && it.pttypename.toLowerCase().includes(search)) ||
          (it.listname && it.listname.toLowerCase().includes(search)) ||
          (it.status && it.status.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search))
        )
      })
    }

    // Sort items
    filteredItems.sort((a, b) => {
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

    const totalCount = filteredItems.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    // Paginate or export all
    const items = exportAll
      ? filteredItems
      : filteredItems.slice((page - 1) * pageSize, page * pageSize)

    // Re-assign running numbers for the current page
    const itemsWithNo = items.map((it, idx) => ({
      ...it,
      no: exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1,
    }))

    return {
      title: categoryTitle,
      subtitle: reportTitle,
      adpCode,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      repBreakdown,
      items: itemsWithNo,
    }
  }
}
