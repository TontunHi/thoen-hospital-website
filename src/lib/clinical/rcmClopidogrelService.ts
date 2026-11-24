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

// ── 1. Domain Types: กองทุนยา Clopidogrel ─────────────────────────────────────

export const CLOPIDOGREL_ADP_CODE = '37999771001'
export const CLOPIDOGREL_ADP_CODE_LEGACY = '3799977101'
export const CLOPIDOGREL_ADP_CODES = [CLOPIDOGREL_ADP_CODE, CLOPIDOGREL_ADP_CODE_LEGACY]
export const CLOPIDOGREL_DID_PREFIX = '1248460000039721217'

export type ClopidogrelCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'UC_ONLY'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'INVOICE'
  | 'NOT_SENT'

export type ClopidogrelSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'qty'
  | 'money'
  | 'hosxp_money'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface ClopidogrelReportParams extends FiscalDateRangeParams {
  cardFilter?: ClopidogrelCardFilter
  ucOnly?: boolean
  pttypes?: string
  reps?: string
  search?: string
  sortBy?: ClopidogrelSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ClopidogrelAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface ClopidogrelAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: ClopidogrelAdpMappingItem[]
}

export interface ClopidogrelItem {
  no: number
  vn: string
  hn: string
  cid: string
  ptname: string
  firstName: string
  lastName: string
  sex: string
  birthday: string | null
  age: number
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id: string
  pttypename: string
  isUc: boolean
  department: string | null
  clinic: string | null
  doctorname: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  icode: string
  drugname: string
  units: string | null
  adpcode: string | null
  adpname: string | null
  tmt: string | null
  did: string | null
  qty: number
  money: number
  hosxp_money: number
  status_eclaim: string
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund?: string | null
  subfund?: string | null
  errorcode?: string | null
}

export interface ClopidogrelSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  totalDrugMoney: number
  totalHosxpIncome: number
  totalQty: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  invoiceCount: number
  invoiceRate: number
  repCount: number
  repRate: number
  notSentCount: number
}

export interface ClopidogrelReportResult {
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: ClopidogrelAdpMappingCheck
  cardFilter: ClopidogrelCardFilter
  ucOnly: boolean
  search: string
  sortBy: ClopidogrelSortField
  sortOrder: 'asc' | 'desc'
  summary: ClopidogrelSummary
  repBreakdown?: RepBreakdownSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ClopidogrelItem[]
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

export function isUniversalCoverageScheme(
  maininscl?: string | null,
  pttypename?: string | null,
  pttypeEclaimId?: string | null
): boolean {
  if (pttypeEclaimId) {
    const id = pttypeEclaimId.trim()
    if (/^0[1-9]$/.test(id)) return true
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

// ── 3. RcmClopidogrelService Implementation ───────────────────────────────────

export class RcmClopidogrelService {
  /**
   * Check if Clopidogrel ADP code '37999771001' (or legacy '3799977101') is mapped in s_drugitems or drugitems.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<ClopidogrelAdpMappingCheck> {
    const adpCode = CLOPIDOGREL_ADP_CODE
    const cacheKey = `rcm-clopidogrel-adp-mapping-check-v2-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-clopidogrel-adp-mapping-check-v2-${CLOPIDOGREL_ADP_CODE_LEGACY}`)
    }

    return getCachedData(
      cacheKey,
      async () => fetchAdpMappingViaGateway(adpCode, gateway, { includeDrugItems: true, refresh }),
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate กองทุนยา Clopidogrel Report via API Gateway.
   */
  static async getClopidogrelReport(
    params: ClopidogrelReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<ClopidogrelReportResult> {
    const categoryTitle = 'กองทุนยา Clopidogrel'
    const reportTitle = 'รายชื่อการใช้ยา Clopidogrel'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: ClopidogrelCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ClopidogrelSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-clopidogrel-usage-v2-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-clopidogrel-adp-mapping-check-v2-${CLOPIDOGREL_ADP_CODE}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmClopidogrelService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('clopidogrel', { ds1, ds2, adpCode: CLOPIDOGREL_ADP_CODE }),
        ])
        const rows = extractFundRawRows(gwRes)
        if (!rows || rows.length === 0) {
          invalidateCacheKey(cacheKey)
        }
        return {
          rawRows: rows,
          adpMapping: mappingRes,
        }
      },
      600000 // Cache TTL 10 minutes
    )

    // Normalize and map items
    const allItems: ClopidogrelItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const sex = formatThaiSex(r.sex_code, r.sex)

      const ptname = String(r.ptname || '').trim()
      const rawFirstName = String(r.firstName || '').trim()
      const rawLastName = String(r.lastName || '').trim()

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname,
        firstName: rawFirstName || ptname,
        lastName: rawLastName,
        sex,
        birthday: r.birthday ? String(r.birthday) : null,
        age,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode,
        maininscl,
        pttype_eclaim_id: pttypeEclaimId,
        pttypename,
        isUc,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        doctorname: r.doctorname ? String(r.doctorname).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        icode: String(r.icode || '').trim(),
        drugname: String(r.drugname || r.listname || r.name || '').trim(),
        units: r.units ? String(r.units).trim() : null,
        adpcode: r.adpcode ? String(r.adpcode).trim() : (r.nhso_adp_code ? String(r.nhso_adp_code).trim() : null),
        adpname: r.adpcode && CLOPIDOGREL_ADP_CODES.includes(String(r.adpcode).trim()) ? 'ยา Clopidogrel' : null,
        tmt: r.tmt ? String(r.tmt).trim() : null,
        did: r.did ? String(r.did).trim() : null,
        qty: Number(r.qty) || 0,
        money: Number(r.money) || 0,
        hosxp_money: Number(r.hosxp_money ?? r.income) || 0,
        status_eclaim: String(r.status_eclaim || r.status || '- :: ยังไม่ได้ส่ง').trim(),
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        errorcode: r.errorcode ? String(r.errorcode).trim() : null,
      }
    })

    const enrichedAllItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )

    // Dual-Mode Cohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = enrichedAllItems
    if (params.pttypes) {
      summaryCohort = enrichedAllItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = enrichedAllItems.filter((i) => i.isUc)
    }

    // Compute Tier 1 Aggregated Summary from summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    let compensatedVisits = 0
    let totalCompensated = 0
    let totalDrugMoney = 0
    let totalHosxpIncome = 0
    let totalQty = 0
    let withAuthenCount = 0
    let ucCount = 0
    let invoiceCount = 0
    let repCount = 0
    let notSentCount = 0

    for (const item of summaryCohort) {
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      totalDrugMoney += item.money
      totalHosxpIncome += item.hosxp_money
      totalQty += item.qty

      if (item.authencode) {
        withAuthenCount++
      }
      if (item.isUc) {
        ucCount++
      }
      if (item.status_eclaim.includes('Invoice')) {
        invoiceCount++
      } else if (item.status_eclaim.includes('Rep')) {
        repCount++
      } else if (item.status_eclaim.includes('ยังไม่ได้ส่ง')) {
        notSentCount++
      }
    }

    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated =
      compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const invoiceRate = totalVisits > 0 ? (invoiceCount / totalVisits) * 100 : 0
    const repRate = totalVisits > 0 ? (repCount / totalVisits) * 100 : 0

    const summary: ClopidogrelSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate: Math.round(compensationRate * 100) / 100,
      totalCompensated,
      averageCompensated: Math.round(averageCompensated * 100) / 100,
      totalDrugMoney: Math.round(totalDrugMoney * 100) / 100,
      totalHosxpIncome: Math.round(totalHosxpIncome * 100) / 100,
      totalQty,
      withAuthenCount,
      withoutAuthenCount,
      authenRate: Math.round(authenRate * 100) / 100,
      ucCount,
      ucRate: Math.round(ucRate * 100) / 100,
      invoiceCount,
      invoiceRate: Math.round(invoiceRate * 100) / 100,
      repCount,
      repRate: Math.round(repRate * 100) / 100,
      notSentCount,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Filters
    let filtered = [...summaryCohort]

    switch (cardFilter) {
      case 'COMPENSATED':
        filtered = filtered.filter((i) => i.isCompensated)
        break
      case 'UNCOMPENSATED':
        filtered = filtered.filter((i) => !i.isCompensated)
        break
      case 'UC_ONLY':
        filtered = filtered.filter((i) => i.isUc)
        break
      case 'WITH_AUTHEN':
        filtered = filtered.filter((i) => Boolean(i.authencode))
        break
      case 'NO_AUTHEN':
        filtered = filtered.filter((i) => !i.authencode)
        break
      case 'INVOICE':
        filtered = filtered.filter((i) => i.status_eclaim.includes('Invoice'))
        break
      case 'NOT_SENT':
        filtered = filtered.filter((i) => i.status_eclaim.includes('ยังไม่ได้ส่ง'))
        break
      case 'ALL':
      default:
        break
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    // Apply Global Search (cross-cutting: HN, CID, name, VN, doctor, clinic, department, diagnosis, drug, seamless rep)
    if (search) {
      filtered = filtered.filter((item) => {
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.doctorname && item.doctorname.toLowerCase().includes(search)) ||
          (item.clinic && item.clinic.toLowerCase().includes(search)) ||
          (item.department && item.department.toLowerCase().includes(search)) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.drugname && item.drugname.toLowerCase().includes(search)) ||
          (item.pttypename && item.pttypename.toLowerCase().includes(search)) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search))
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
      }
      if (typeof valB === 'string') {
        valB = valB.toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index item numbers after filtering and sorting
    filtered = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    // Pagination (or full dataset for exportAll)
    const paginatedItems = exportAll
      ? filtered
      : filtered.slice((page - 1) * pageSize, page * pageSize)

    return {
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      search: params.search || '',
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
