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

// ── 1. Domain Types: กองทุนมะเร็ง (CANCER ADP) ───────────────────────────────

export const CANCER_ADP_CODE = 'CANCER'

export type CancerFundCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'INVOICE'
  | 'UC_ONLY'

export type CancerFundSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'pttypename'
  | 'authencode'
  | 'pdx'
  | 'listname'
  | 'status_eclaim'
  | 'rep'
  | 'compensated'

export interface CancerFundReportParams extends FiscalDateRangeParams {
  cardFilter?: CancerFundCardFilter
  statusFilter?: string
  ucOnly?: boolean
  pttypes?: string
  reps?: string
  search?: string
  sortBy?: CancerFundSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface CancerFundAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface CancerFundAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: CancerFundAdpMappingItem[]
}

export interface CancerFundPatientItem {
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
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id: string
  pttypename: string
  isUc: boolean
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
  income: number
  listname: string
  rep: string | null
  compensated: number
  isCompensated: boolean
  transactiontype: string | null
  invoice: string | null
  invoice_compensated: number
  resource: string | null
  fund: string | null
  subfund: string | null
  remark: string | null
  projectcode: string | null
  status: string
  status_eclaim: string
}

export interface CancerFundSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  totalInvoiceCompensated: number
  totalIncome: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  invoiceCount: number
  invoiceRate: number
  repCount: number
  repRate: number
  ucCount: number
  ucRate: number
}

export interface CancerFundReportResult {
  title: string
  categoryTitle: string
  subTitle: string
  adpCode: string
  ds1: string
  ds2: string
  adpMapping: CancerFundAdpMappingCheck
  cardFilter: CancerFundCardFilter
  statusFilter: string
  statusOptions: string[]
  ucOnly: boolean
  pttypes?: string
  search: string
  sortBy: CancerFundSortField
  sortOrder: 'asc' | 'desc'
  summary: CancerFundSummary
  repBreakdown?: RepBreakdownSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CancerFundPatientItem[]
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

// ── 3. RcmCancerFundService Implementation ───────────────────────────────────

export class RcmCancerFundService {
  /**
   * Check if ADP code 'CANCER' is mapped in s_drugitems or drugitems.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<CancerFundAdpMappingCheck> {
    const adpCode = CANCER_ADP_CODE
    const cacheKey = `rcm-cancer-fund-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => fetchAdpMappingViaGateway(adpCode, gateway, { includeDrugItems: true, refresh }),
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate กองทุนมะเร็ง (CANCER ADP) Patient Report via API Gateway.
   */
  static async getCancerPatientsReport(
    params: CancerFundReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<CancerFundReportResult> {
    const categoryTitle = 'กองทุนมะเร็ง'
    const reportTitle = 'กองทุนมะเร็ง'
    const subTitle = 'รายชื่อผู้ป่วย จาก ADP (CANCER)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: CancerFundCardFilter = params.cardFilter || 'ALL'
    const statusFilter = (params.statusFilter || 'ALL').trim()
    const ucOnly = Boolean(params.ucOnly)
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CancerFundSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-cancer-fund-adp-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-cancer-fund-adp-mapping-check-${CANCER_ADP_CODE}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmCancerFundService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('cancer', { ds1, ds2, adpCode: CANCER_ADP_CODE }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mappingRes,
        }
      },
      600000 // Cache TTL 10 minutes
    )

    // Normalize and transform items
    const allItems: CancerFundPatientItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const invoiceCompensated = Number(r.invoice_compensated) || 0
      const isCompensated = compensated > 0 || invoiceCompensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const sex = formatThaiSex(r.sex_code, r.sex)
      const income = Number(r.income) || 0

      const ptname = String(r.ptname || '').trim()
      let rawFirstName = String(r.firstName || '').trim()
      let rawLastName = String(r.lastName || '').trim()
      if (!rawFirstName && ptname) {
        const parts = ptname.split(/\s+/)
        rawFirstName = parts[0] || ptname
        rawLastName = parts.slice(1).join(' ')
      }

      const statusStr = String(r.status || r.status_eclaim || '- :: ยังไม่ได้ส่ง').trim()
      const rep = r.rep ? String(r.rep).trim() : null

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
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode,
        maininscl,
        pttype_eclaim_id: pttypeEclaimId,
        pttypename,
        isUc,
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
        income,
        listname: String(r.listname || '').trim(),
        rep,
        compensated,
        isCompensated,
        transactiontype: r.transactiontype ? String(r.transactiontype).trim() : null,
        invoice: r.invoice ? String(r.invoice).trim() : null,
        invoice_compensated: invoiceCompensated,
        resource: r.resource ? String(r.resource).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        remark: r.remark ? String(r.remark).trim() : null,
        projectcode: r.projectcode ? String(r.projectcode).trim() : null,
        status: statusStr,
        status_eclaim: statusStr,
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

    // Cohort for summary KPIs:
    // If pttypes filter is specified, compute summary KPIs based on matching pttypes (Full Page Filter Q2: A)
    const summaryCohort = selectedPttypesList.length > 0
      ? enrichedAllItems.filter((it) => matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, selectedPttypesList, it.isUc, it.pttype_eclaim_id))
      : enrichedAllItems

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size

    let compensatedVisits = 0
    let totalCompensated = 0
    let totalInvoiceCompensated = 0
    let totalIncome = 0
    let withAuthenCount = 0
    let invoiceCount = 0
    let repCount = 0
    let ucCount = 0

    for (const item of summaryCohort) {
      if (item.isCompensated) compensatedVisits++
      totalCompensated += item.compensated
      totalInvoiceCompensated += item.invoice_compensated
      totalIncome += item.income
      if (item.authencode) withAuthenCount++
      if (item.invoice) invoiceCount++
      if (item.rep) repCount++
      if (item.isUc) ucCount++
    }

    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const invoiceRate = totalVisits > 0 ? (invoiceCount / totalVisits) * 100 : 0
    const repRate = totalVisits > 0 ? (repCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: CancerFundSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      totalInvoiceCompensated,
      totalIncome,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      invoiceCount,
      invoiceRate,
      repCount,
      repRate,
      ucCount,
      ucRate,
    }

    // Available status options for dropdown
    const statusOptions = Array.from(
      new Set(summaryCohort.map((i) => i.status_eclaim).filter(Boolean))
    ).sort() as string[]

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Filters
    let filtered = summaryCohort

    // 1. Card Filter
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'INVOICE') {
      filtered = filtered.filter((i) => Boolean(i.invoice))
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // 2. Status e-Claim / REP Filter
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'HAS_REP') {
        filtered = filtered.filter((i) => Boolean(i.rep))
      } else if (statusFilter === 'NO_REP') {
        filtered = filtered.filter((i) => !i.rep)
      } else {
        filtered = filtered.filter((i) => i.status_eclaim === statusFilter || i.status === statusFilter)
      }
    }

    // 3. UC-Only explicit toggle (fallback when pttypes is empty)
    if (selectedPttypesList.length === 0 && ucOnly) {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    // 4. Unified Global Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search)) ||
          (i.status_eclaim && i.status_eclaim.toLowerCase().includes(search))
        )
      })
    }

    // 4. Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortBy] ?? ''
      let valB: any = b[sortBy] ?? ''

      if (sortBy === 'compensated' || sortBy === 'income' || sortBy === 'age') {
        valA = Number(valA) || 0
        valB = Number(valB) || 0
      } else {
        valA = String(valA).toLowerCase()
        valB = String(valB).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index displayed row numbers
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let resultItems: CancerFundPatientItem[]
    if (exportAll) {
      resultItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      resultItems = filtered
        .slice(startIndex, startIndex + pageSize)
        .map((item, idx) => ({ ...item, no: startIndex + idx + 1 }))
    }

    return {
      title: reportTitle,
      categoryTitle,
      subTitle,
      adpCode: CANCER_ADP_CODE,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      statusFilter,
      statusOptions,
      ucOnly,
      pttypes,
      search,
      sortBy,
      sortOrder,
      summary,
      repBreakdown,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: resultItems,
    }
  }
}
