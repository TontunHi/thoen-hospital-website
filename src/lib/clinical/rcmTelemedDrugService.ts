import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'
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

// ── ADP Mapping Item ──────────────────────────────────────────────────────────

export interface AdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: AdpMappingItem[]
}

// ── 1. Domain Types: 11.53 รายชื่อผู้ได้รับบริการ TelMed ─────────────────────

export type TelemedCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'WITH_PRICE'
  | 'EXPORT_CODE_5'

export type TelemedSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'DEPARTMENT'
  | 'CLINIC'

export type TelemedSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'income'
  | 'sum_price'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface TelemedReportParams extends FiscalDateRangeParams {
  cardFilter?: TelemedCardFilter | string
  cards?: string
  ucOnly?: boolean
  pttypes?: string
  sex?: string
  ageMin?: number
  ageMax?: number
  pdx?: string
  ovstistExportCode?: string
  searchField?: TelemedSearchField
  search?: string
  sortBy?: TelemedSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface TelemedItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  vstdate: string
  vsttime: string
  ovstist: string
  ovstist_export_code: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id?: string
  isUc: boolean
  pttypename: string
  hospmain: string | null
  hospsub: string | null
  department: string | null
  clinic: string | null
  pdx: string | null
  income: number
  sum_price: number // ค่า TelMed
  listname: string | null
  status: string
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface TelemedSummary {
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
  withPriceCount: number
  withPriceRate: number
  exportCode5Count: number
  exportCode5Rate: number
  totalSumPrice: number
  totalIncome: number
}

export interface TelemedReportResult {
  adpCode: 'TELMED'
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: AdpMappingCheck
  cardFilter: TelemedCardFilter | string
  ucOnly: boolean
  searchField: TelemedSearchField
  search: string
  sortBy: TelemedSortField
  sortOrder: 'asc' | 'desc'
  summary: TelemedSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: TelemedItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Domain Types: 11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์ (DRUGP) ───────

export type PostalDrugCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'WITH_PRICE'
  | 'WITHOUT_PRICE'

export type PostalDrugSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'DEPARTMENT'
  | 'CLINIC'

export type PostalDrugSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'income'
  | 'sum_price'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface PostalDrugReportParams extends FiscalDateRangeParams {
  cardFilter?: PostalDrugCardFilter
  ucOnly?: boolean
  pttypes?: string
  searchField?: PostalDrugSearchField
  search?: string
  sortBy?: PostalDrugSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface PostalDrugItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
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
  income: number
  sum_price: number // ค่าส่งยาไปรษณีย์ / EMS
  listname: string | null
  status: string
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface PostalDrugSummary {
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
  withPriceCount: number
  withPriceRate: number
  withoutPriceCount: number
  withoutPriceRate: number
  totalSumPrice: number
  totalIncome: number
}

export interface PostalDrugReportResult {
  adpCode: 'DRUGP'
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: AdpMappingCheck
  cardFilter: PostalDrugCardFilter
  ucOnly: boolean
  searchField: PostalDrugSearchField
  search: string
  sortBy: PostalDrugSortField
  sortOrder: 'asc' | 'desc'
  summary: PostalDrugSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: PostalDrugItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 3. Helper Functions ───────────────────────────────────────────────────────

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

// ── 4. RcmTelemedDrugService Implementation ───────────────────────────────────

export class RcmTelemedDrugService {
  /**
   * Check if ADP code is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    adpCode: 'TELMED' | 'DRUGP',
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<AdpMappingCheck> {
    const cacheKey = `rcm-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      async () => fetchAdpMappingViaGateway(adpCode, gateway, { refresh }),
      600000 // 10 minutes cache
    )
  }

  /**
   * Topic 1: 11.53 รายชื่อผู้ได้รับบริการ TelMed via API Gateway.
   */
  static async getTelemedReport(
    params: TelemedReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<TelemedReportResult> {
    const adpCode = 'TELMED'
    const categoryTitle = 'ระบบ Telemedicine & Drug'
    const reportTitle = '11.53 รายชื่อผู้ได้รับบริการ TelMed'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: TelemedCardFilter | string = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: TelemedSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: TelemedSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-telemed-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [adpCheck, gwRes] = await Promise.all([
          RcmTelemedDrugService.checkAdpMapping('TELMED', gateway, params.refresh),
          gateway.getRcmFundData('telemed-drug', { ds1, ds2, adpCode: 'TELMED' }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: adpCheck,
        }
      },
      600000 // 10 minutes cache
    )

    // Map and transform records
    let allRecords: TelemedItem[] = (rawRows || []).map((row: any, idx: number) => {
      const compensatedVal = parseFloat(String(row.compensated || 0)) || 0
      const sumPriceVal = parseFloat(String(row.sum_price || 0)) || 0
      const incomeVal = parseFloat(String(row.income || 0)) || 0
      const isComp = compensatedVal > 0 || String(row.status || '').toLowerCase().includes('rep')
      const pttypeEclaimId = String(row.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverageScheme(row.maininscl, row.pttypename, pttypeEclaimId)

      return {
        no: idx + 1,
        vn: String(row.vn || '').trim(),
        cid: String(row.cid || '').trim(),
        hn: String(row.hn || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        birthday: row.birthday ? String(row.birthday) : null,
        age: Number(row.age) || 0,
        vstdate: String(row.vstdate || ''),
        vsttime: String(row.vsttime || ''),
        ovstist: String(row.ovstist || ''),
        ovstist_export_code: String(row.ovstist_export_code || ''),
        authencode: row.authencode ? String(row.authencode).trim() : null,
        maininscl: String(row.maininscl || '').trim(),
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pttypename: String(row.pttypename || '').trim(),
        hospmain: row.hospmain ? String(row.hospmain).trim() : null,
        hospsub: row.hospsub ? String(row.hospsub).trim() : null,
        department: row.department ? String(row.department).trim() : null,
        clinic: row.clinic ? String(row.clinic).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        income: incomeVal,
        sum_price: sumPriceVal,
        listname: row.listname ? String(row.listname).trim() : null,
        status: String(row.status || '-:ยังไม่ได้ส่ง').trim(),
        rep: row.rep ? String(row.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: isComp,
        fund: row.fund ? String(row.fund).trim() : null,
        subfund: row.subfund ? String(row.subfund).trim() : null,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allRecords = await enrichItemsWithSeamlessCache(cacheKey, allRecords, resolveSeamlessFetcher(gateway), Boolean(params.refresh))
    let summaryCohort = allRecords
    if (params.pttypes) {
      summaryCohort = allRecords.filter((rec) =>
        matchesPttypeFilter(rec.pttypename || rec.pttype_eclaim_id, params.pttypes, rec.isUc, rec.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = allRecords.filter((rec) => rec.isUc)
    }

    // Calculate Summary Statistics across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0
    let withPriceCount = 0
    let exportCode5Count = 0
    let totalSumPrice = 0
    let totalIncome = 0

    for (const rec of summaryCohort) {
      if (rec.hn) uniqueHnSet.add(rec.hn)
      if (rec.isCompensated) {
        compensatedVisits++
        totalCompensated += rec.compensated
      }
      if (rec.authencode) withAuthenCount++
      if (rec.isUc) ucCount++
      if (rec.sum_price > 0) withPriceCount++
      if (rec.ovstist_export_code === '5') exportCode5Count++
      totalSumPrice += rec.sum_price
      totalIncome += rec.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const withPriceRate = totalVisits > 0 ? (withPriceCount / totalVisits) * 100 : 0
    const exportCode5Rate = totalVisits > 0 ? (exportCode5Count / totalVisits) * 100 : 0

    const summary: TelemedSummary = {
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
      withPriceCount,
      withPriceRate,
      exportCode5Count,
      exportCode5Rate,
      totalSumPrice,
      totalIncome,
    }

    // Multi-card filter support (comma-separated or single)
    const rawCardFilter = (params.cards || cardFilter || 'ALL').trim()
    const activeCards = rawCardFilter
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c && c !== 'ALL')

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter records
    let filtered = summaryCohort.filter((rec) => {
      if (selectedReps.length > 0 && !matchesRepFilter(rec, selectedReps)) return false
      // 2. Card filters (AND condition across different cards)
      for (const card of activeCards) {
        if (card === 'COMPENSATED' && !rec.isCompensated) return false
        if (card === 'UNCOMPENSATED' && rec.isCompensated) return false
        if (card === 'WITH_AUTHEN' && !rec.authencode) return false
        if (card === 'NO_AUTHEN' && rec.authencode) return false
        if (card === 'UC_ONLY' && !rec.isUc) return false
        if (card === 'WITH_PRICE' && rec.sum_price <= 0) return false
        if (card === 'EXPORT_CODE_5' && rec.ovstist_export_code !== '5') return false
      }

      // Extra popover filters
      if (params.sex && params.sex !== 'ALL') {
        const expectedSex = params.sex === 'M' || params.sex === 'ชาย' ? 'ชาย' : params.sex === 'F' || params.sex === 'หญิง' ? 'หญิง' : params.sex
        if (rec.sex !== expectedSex) return false
      }
      if (params.ageMin != null && rec.age < params.ageMin) return false
      if (params.ageMax != null && rec.age > params.ageMax) return false
      if (params.pdx && !(rec.pdx || '').toLowerCase().includes(params.pdx.toLowerCase())) return false
      if (params.ovstistExportCode && rec.ovstist_export_code !== params.ovstistExportCode) return false

      // 3. Search filter
      if (search) {
        if (searchField === 'HN') {
          return rec.hn.toLowerCase().includes(search)
        } else if (searchField === 'CID') {
          return rec.cid.toLowerCase().includes(search)
        } else if (searchField === 'PTNAME') {
          return rec.ptname.toLowerCase().includes(search)
        } else if (searchField === 'VN') {
          return rec.vn.toLowerCase().includes(search)
        } else if (searchField === 'DIAG') {
          return (rec.pdx || '').toLowerCase().includes(search)
        } else if (searchField === 'PTTYPE') {
          return rec.pttypename.toLowerCase().includes(search)
        } else if (searchField === 'DEPARTMENT') {
          return (rec.department || '').toLowerCase().includes(search)
        } else if (searchField === 'CLINIC') {
          return (rec.clinic || '').toLowerCase().includes(search)
        } else {
          // Global search
          return (
            matchesSeamlessRepSearch(rec, search) ||
            rec.hn.toLowerCase().includes(search) ||
            rec.cid.toLowerCase().includes(search) ||
            rec.ptname.toLowerCase().includes(search) ||
            rec.vn.toLowerCase().includes(search) ||
            (rec.pdx || '').toLowerCase().includes(search) ||
            rec.pttypename.toLowerCase().includes(search) ||
            (rec.department || '').toLowerCase().includes(search) ||
            (rec.clinic || '').toLowerCase().includes(search) ||
            (rec.authencode || '').toLowerCase().includes(search) ||
            rec.ovstist.toLowerCase().includes(search)
          )
        }
      }

      return true
    })

    // Sort records
    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'vstdate':
          cmp = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
          break
        case 'vsttime':
          cmp = a.vsttime.localeCompare(b.vsttime)
          break
        case 'hn':
          cmp = a.hn.localeCompare(b.hn)
          break
        case 'cid':
          cmp = a.cid.localeCompare(b.cid)
          break
        case 'ptname':
          cmp = a.ptname.localeCompare(b.ptname, 'th')
          break
        case 'income':
          cmp = a.income - b.income
          break
        case 'sum_price':
          cmp = a.sum_price - b.sum_price
          break
        case 'compensated':
          cmp = a.compensated - b.compensated
          break
        case 'pdx':
          cmp = (a.pdx || '').localeCompare(b.pdx || '')
          break
        case 'authencode':
          cmp = (a.authencode || '').localeCompare(b.authencode || '')
          break
        default:
          cmp = a.vstdate.localeCompare(b.vstdate)
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Re-number after sort & filter
    const totalCount = filtered.length
    filtered = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))

    // Pagination or Export
    const totalPages = Math.ceil(totalCount / pageSize) || 1
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    return {
      adpCode,
      title: reportTitle,
      categoryTitle,
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
      items: pagedItems,
      repBreakdown,
    }
  }

  /**
   * Topic 2: 11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์ (DRUGP)
   * Filter: d.nhso_adp_code in ('DRUGP')
   */
  static async getPostalDrugReport(
    params: PostalDrugReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<PostalDrugReportResult> {
    const adpCode = 'DRUGP'
    const categoryTitle = 'ระบบ Telemedicine & Drug'
    const reportTitle = '11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: PostalDrugCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: PostalDrugSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: PostalDrugSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-postal-drug-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [adpCheck, gwRes] = await Promise.all([
          RcmTelemedDrugService.checkAdpMapping('DRUGP', gateway, params.refresh),
          gateway.getRcmFundData('drug-post', { ds1, ds2, adpCode: 'DRUGP' }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: adpCheck,
        }
      },
      600000 // 10 minutes cache
    )

    // Map and transform records
    let allRecords: PostalDrugItem[] = (rawRows || []).map((row: any, idx: number) => {
      const compensatedVal = parseFloat(String(row.compensated || 0)) || 0
      const sumPriceVal = parseFloat(String(row.sum_price || 0)) || 0
      const incomeVal = parseFloat(String(row.income || 0)) || 0
      const isComp = compensatedVal > 0 || String(row.status || '').toLowerCase().includes('rep')
      const pttypeEclaimId = String(row.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverageScheme(row.maininscl, row.pttypename, pttypeEclaimId)

      return {
        no: idx + 1,
        vn: String(row.vn || '').trim(),
        cid: String(row.cid || '').trim(),
        hn: String(row.hn || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        birthday: row.birthday ? String(row.birthday) : null,
        age: Number(row.age) || 0,
        vstdate: String(row.vstdate || ''),
        vsttime: String(row.vsttime || ''),
        authencode: row.authencode ? String(row.authencode).trim() : null,
        maininscl: String(row.maininscl || '').trim(),
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pttypename: String(row.pttypename || '').trim(),
        department: row.department ? String(row.department).trim() : null,
        clinic: row.clinic ? String(row.clinic).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        income: incomeVal,
        sum_price: sumPriceVal,
        listname: row.listname ? String(row.listname).trim() : null,
        status: String(row.status || '-:ยังไม่ได้ส่ง').trim(),
        rep: row.rep ? String(row.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: isComp,
        fund: row.fund ? String(row.fund).trim() : null,
        subfund: row.subfund ? String(row.subfund).trim() : null,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allRecords = await enrichItemsWithSeamlessCache(cacheKey, allRecords, resolveSeamlessFetcher(gateway), Boolean(params.refresh))
    let summaryCohort = allRecords
    if (params.pttypes) {
      summaryCohort = allRecords.filter((rec) =>
        matchesPttypeFilter(rec.pttypename || rec.pttype_eclaim_id, params.pttypes, rec.isUc, rec.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = allRecords.filter((rec) => rec.isUc)
    }

    // Calculate Summary Statistics across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0
    let withPriceCount = 0
    let totalSumPrice = 0
    let totalIncome = 0

    for (const rec of summaryCohort) {
      if (rec.hn) uniqueHnSet.add(rec.hn)
      if (rec.isCompensated) {
        compensatedVisits++
        totalCompensated += rec.compensated
      }
      if (rec.authencode) withAuthenCount++
      if (rec.isUc) ucCount++
      if (rec.sum_price > 0) withPriceCount++
      totalSumPrice += rec.sum_price
      totalIncome += rec.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const withPriceRate = totalVisits > 0 ? (withPriceCount / totalVisits) * 100 : 0
    const withoutPriceCount = totalVisits - withPriceCount
    const withoutPriceRate = totalVisits > 0 ? (withoutPriceCount / totalVisits) * 100 : 0

    const summary: PostalDrugSummary = {
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
      withPriceCount,
      withPriceRate,
      withoutPriceCount,
      withoutPriceRate,
      totalSumPrice,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter records
    let filtered = summaryCohort.filter((rec) => {
      if (selectedReps.length > 0 && !matchesRepFilter(rec, selectedReps)) return false
      // 2. Card filter
      switch (cardFilter) {
        case 'COMPENSATED':
          if (!rec.isCompensated) return false
          break
        case 'UNCOMPENSATED':
          if (rec.isCompensated) return false
          break
        case 'WITH_AUTHEN':
          if (!rec.authencode) return false
          break
        case 'NO_AUTHEN':
          if (rec.authencode) return false
          break
        case 'UC_ONLY':
          if (!rec.isUc) return false
          break
        case 'WITH_PRICE':
          if (rec.sum_price <= 0) return false
          break
        case 'WITHOUT_PRICE':
          if (rec.sum_price > 0) return false
          break
        case 'ALL':
        default:
          break
      }

      // 3. Search filter
      if (search) {
        if (searchField === 'HN') {
          return rec.hn.toLowerCase().includes(search)
        } else if (searchField === 'CID') {
          return rec.cid.toLowerCase().includes(search)
        } else if (searchField === 'PTNAME') {
          return rec.ptname.toLowerCase().includes(search)
        } else if (searchField === 'VN') {
          return rec.vn.toLowerCase().includes(search)
        } else if (searchField === 'DIAG') {
          return (rec.pdx || '').toLowerCase().includes(search)
        } else if (searchField === 'PTTYPE') {
          return rec.pttypename.toLowerCase().includes(search)
        } else if (searchField === 'DEPARTMENT') {
          return (rec.department || '').toLowerCase().includes(search)
        } else if (searchField === 'CLINIC') {
          return (rec.clinic || '').toLowerCase().includes(search)
        } else {
          return (
            matchesSeamlessRepSearch(rec, search) ||
            rec.hn.toLowerCase().includes(search) ||
            rec.cid.toLowerCase().includes(search) ||
            rec.ptname.toLowerCase().includes(search) ||
            rec.vn.toLowerCase().includes(search) ||
            (rec.pdx || '').toLowerCase().includes(search) ||
            rec.pttypename.toLowerCase().includes(search) ||
            (rec.department || '').toLowerCase().includes(search) ||
            (rec.clinic || '').toLowerCase().includes(search) ||
            (rec.authencode || '').toLowerCase().includes(search) ||
            (rec.listname || '').toLowerCase().includes(search)
          )
        }
      }

      return true
    })

    // Sort records
    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'vstdate':
          cmp = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
          break
        case 'vsttime':
          cmp = a.vsttime.localeCompare(b.vsttime)
          break
        case 'hn':
          cmp = a.hn.localeCompare(b.hn)
          break
        case 'cid':
          cmp = a.cid.localeCompare(b.cid)
          break
        case 'ptname':
          cmp = a.ptname.localeCompare(b.ptname, 'th')
          break
        case 'income':
          cmp = a.income - b.income
          break
        case 'sum_price':
          cmp = a.sum_price - b.sum_price
          break
        case 'compensated':
          cmp = a.compensated - b.compensated
          break
        case 'pdx':
          cmp = (a.pdx || '').localeCompare(b.pdx || '')
          break
        case 'authencode':
          cmp = (a.authencode || '').localeCompare(b.authencode || '')
          break
        default:
          cmp = a.vstdate.localeCompare(b.vstdate)
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Re-number after sort & filter
    const totalCount = filtered.length
    filtered = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))

    // Pagination or Export
    const totalPages = Math.ceil(totalCount / pageSize) || 1
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    return {
      adpCode,
      title: reportTitle,
      categoryTitle,
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
      items: pagedItems,
      repBreakdown,
    }
  }
}
