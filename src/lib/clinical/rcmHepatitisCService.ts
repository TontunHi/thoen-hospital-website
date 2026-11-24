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
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: ไวรัสตับอักเสบ C (23.2 คัดกรอง 36331 & 23.4 ยืนยัน HCV RNA 36333) ──

export const HEPATITIS_C_SCREENING_ADP = '36331' as const
export const HEPATITIS_C_CONFIRM_ADP = '36333' as const

export type HepatitisCCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'WITH_LAB'
  | 'SEAMLESS'
  | 'SEAMLESS_COMPENSATED'

export type HepatitisCSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'LAB'
  | 'LABRESULT'

export type HepatitisCSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'pdx'
  | 'labresult'
  | 'authencode'

export interface HepatitisCReportParams extends FiscalDateRangeParams {
  adpCode?: string
  cardFilter?: HepatitisCCardFilter
  ucOnly?: boolean
  pttypes?: string
  withLabOnly?: boolean
  reps?: string
  searchField?: HepatitisCSearchField
  search?: string
  sortBy?: HepatitisCSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface HepatitisCAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface HepatitisCAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: HepatitisCAdpMappingItem[]
}

export interface HepatitisCItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  nation?: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttypename: string
  pttype_eclaim_id?: string | null
  cc: string | null
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
  labresult: string | null
  hasLab: boolean
  listname: string | null
  listname1?: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund: string | null
  subfund: string | null
  errorcode?: string | null
  transactiontype?: string | null
  status_sm: string | null
  rep_sm: string | null
  compensated_sm: number
  isSeamlessCompensated: boolean
  address: string | null
  mobile: string | null
  tel: string | null
  hospcode?: string | null
}

export interface HepatitisCSummary {
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
  withLabCount: number
  withLabRate: number
  seamlessCount: number
  seamlessCompensatedCount?: number
  totalSeamlessCompensated: number
  totalIncome: number
}

export interface HepatitisCReportResult {
  adpCode: string
  title: string
  categoryTitle?: string
  ds1: string
  ds2: string
  cardFilter: HepatitisCCardFilter
  ucOnly: boolean
  withLabOnly: boolean
  searchField: HepatitisCSearchField
  search: string
  sortBy: HepatitisCSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  items: HepatitisCItem[]
  summary: HepatitisCSummary
  adpMapping: HepatitisCAdpMappingCheck
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Business Logic Helpers ─────────────────────────────────

export function isUniversalCoverageScheme(
  maininscl?: string | null,
  pttypename?: string | null
): boolean {
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

export class RcmHepatitisCService {
  /**
   * Pre-check whether the NHSO ADP Code is mapped in HOSxP `s_drugitems` table.
   */
  static async checkAdpMapping(
    gatewayOrAdp?: RcmFundGatewayAdapter | string,
    refreshOrGateway?: boolean | RcmFundGatewayAdapter,
    maybeRefresh?: boolean
  ): Promise<HepatitisCAdpMappingCheck> {
    let adpCode = '36331'
    let gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
    let refresh = false

    if (typeof gatewayOrAdp === 'string') {
      adpCode = gatewayOrAdp
      if (refreshOrGateway && typeof refreshOrGateway === 'object') {
        gateway = refreshOrGateway
      }
      if (typeof maybeRefresh === 'boolean') {
        refresh = maybeRefresh
      }
    } else if (gatewayOrAdp && typeof gatewayOrAdp === 'object') {
      gateway = gatewayOrAdp
      if (typeof refreshOrGateway === 'boolean') {
        refresh = refreshOrGateway
      }
    }

    const cacheKey = `rcm-hepatitis-c-adp-mapping-check-${adpCode}`
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
   * Generate Hepatitis C Report (23.2 screening ADP 36331 or 23.4 confirmation ADP 36333) via API Gateway.
   */
  static async getHepatitisCReport(
    params: HepatitisCReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<HepatitisCReportResult> {
    const adpCode = params.adpCode || '36331'
    const isScreening = adpCode === '36331'
    const reportTitle = isScreening
      ? '23.2 บริการตรวจคัดกรองไวรัสตับอักเสบ C'
      : '23.4 ตรวจยืนยันไวรัสตับ C HCV RNA'
    const categoryTitle = isScreening
      ? 'บริการตรวจคัดกรองไวรัสตับอักเสบ C'
      : 'ตรวจยืนยันไวรัสตับ C HCV RNA'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: HepatitisCCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const withLabOnly = Boolean(params.withLabOnly)
    const searchField: HepatitisCSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: HepatitisCSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-hepatitis-c-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-hepatitis-c-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [adpCheck, gwRes] = await Promise.all([
          this.checkAdpMapping(adpCode, gateway, params.refresh),
          gateway.getRcmFundData('hepatitis-c', { ds1, ds2, adpCode }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: adpCheck,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    let allDomainItems: HepatitisCItem[] = rawRows.map((row: any, idx: number) => {
      const compensated = Number(row.compensated || 0)
      const compensatedSm = Number(row.compensated_sm || 0)
      const isComp = compensated > 0
      const isSmComp = compensatedSm > 0
      const maininscl = String(row.maininscl || '').trim()
      const pttypename = String(row.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename)
      const labResultStr = row.labresult ? String(row.labresult).trim() : null

      const sdxList = [row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
        .map((d) => (d ? String(d).trim() : null))
        .filter((d): d is string => Boolean(d))
      const opsList = [row.op0, row.op1, row.op2, row.op3, row.op4, row.op5]
        .map((op) => (op ? String(op).trim() : null))
        .filter((op): op is string => Boolean(op))

      return {
        no: idx + 1,
        vn: String(row.vn || '').trim(),
        cid: String(row.cid || '').trim(),
        hn: String(row.hn || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        age: Number(row.age || 0),
        nation: row.nation ? String(row.nation).trim() : null,
        vstdate: String(row.vstdate || '').trim(),
        vsttime: String(row.vsttime || '').trim(),
        authencode: row.authencode ? String(row.authencode).trim() : null,
        maininscl,
        isUc,
        pttypename,
        pttype_eclaim_id: row.pttype_eclaim_id != null ? String(row.pttype_eclaim_id).trim() : null,
        cc: row.cc ? String(row.cc).trim() : null,
        department: row.department ? String(row.department).trim() : null,
        clinic: row.clinic ? String(row.clinic).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        dx0: row.dx0 ? String(row.dx0).trim() : null,
        dx1: row.dx1 ? String(row.dx1).trim() : null,
        dx2: row.dx2 ? String(row.dx2).trim() : null,
        dx3: row.dx3 ? String(row.dx3).trim() : null,
        dx4: row.dx4 ? String(row.dx4).trim() : null,
        dx5: row.dx5 ? String(row.dx5).trim() : null,
        sdx: sdxList.length > 0 ? sdxList.join(', ') : null,
        op0: row.op0 ? String(row.op0).trim() : null,
        op1: row.op1 ? String(row.op1).trim() : null,
        op2: row.op2 ? String(row.op2).trim() : null,
        op3: row.op3 ? String(row.op3).trim() : null,
        op4: row.op4 ? String(row.op4).trim() : null,
        op5: row.op5 ? String(row.op5).trim() : null,
        ops: opsList.length > 0 ? opsList.join(', ') : null,
        income: Number(row.income || 0),
        labresult: labResultStr,
        hasLab: Boolean(labResultStr && labResultStr !== '-'),
        listname: row.listname ? String(row.listname).trim() : null,
        listname1: row.listname1 ? String(row.listname1).trim() : null,
        status: row.status ? String(row.status).trim() : null,
        rep: row.rep ? String(row.rep).trim() : null,
        compensated,
        isCompensated: isComp,
        agency: row.agency ? String(row.agency).trim() : null,
        fund: row.fund ? String(row.fund).trim() : null,
        subfund: row.subfund ? String(row.subfund).trim() : null,
        errorcode: row.errorcode ? String(row.errorcode).trim() : null,
        transactiontype: row.transactiontype ? String(row.transactiontype).trim() : null,
        status_sm: row.status_sm ? String(row.status_sm).trim() : null,
        rep_sm: row.rep_sm ? String(row.rep_sm).trim() : null,
        compensated_sm: compensatedSm,
        isSeamlessCompensated: isSmComp,
        address: row.address ? String(row.address).trim() : null,
        mobile: row.mobile ? String(row.mobile).trim() : null,
        tel: row.tel ? String(row.tel).trim() : null,
        hospcode: '10978',
      }
    })

    // Calculate Summary Aggregates (Full Page Filter based on pttypes / ucOnly)
    allDomainItems = await enrichItemsWithSeamlessCache(cacheKey, allDomainItems, resolveSeamlessFetcher(gateway), Boolean(params.refresh))
    let summaryCohort = allDomainItems
    if (params.pttypes) {
      const selectedPttypesList = params.pttypes.split(',').map((p) => p.trim()).filter(Boolean)
      summaryCohort = summaryCohort.filter((item) =>
        matchesPttypeFilter(item.pttypename || item.pttype_eclaim_id, selectedPttypesList, item.isUc, item.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = summaryCohort.filter((item) => item.isUc)
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0
    let withLabCount = 0
    let seamlessCompensatedCount = 0
    let totalSeamlessCompensated = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount++
      if (item.isUc) ucCount++
      if (item.hasLab) withLabCount++
      if (item.isSeamlessCompensated) {
        seamlessCompensatedCount++
        totalSeamlessCompensated += item.compensated_sm
      }
      totalIncome += item.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const withLabRate = totalVisits > 0 ? (withLabCount / totalVisits) * 100 : 0

    const summary: HepatitisCSummary = {
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
      withLabCount,
      withLabRate,
      seamlessCount: seamlessCompensatedCount,
      seamlessCompensatedCount,
      totalSeamlessCompensated,
      totalIncome,
    }

    let filtered = summaryCohort.filter((item) => {
      switch (cardFilter) {
        case 'COMPENSATED':
          return item.isCompensated
        case 'UNCOMPENSATED':
          return !item.isCompensated
        case 'WITH_AUTHEN':
          return Boolean(item.authencode)
        case 'NO_AUTHEN':
          return !item.authencode
        case 'UC_ONLY':
          return item.isUc
        case 'WITH_LAB':
          return item.hasLab
        case 'SEAMLESS':
        case 'SEAMLESS_COMPENSATED':
          return item.isSeamlessCompensated
        case 'ALL':
        default:
          return true
      }
    })

    if (ucOnly) {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (withLabOnly) {
      filtered = filtered.filter((i) => i.hasLab)
    }
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((item) => {
        const matchHn = item.hn.toLowerCase().includes(search)
        const matchCid = item.cid.toLowerCase().includes(search)
        const matchPtname = item.ptname.toLowerCase().includes(search)
        const matchVn = item.vn.toLowerCase().includes(search)
        const matchPdx = (item.pdx || '').toLowerCase().includes(search)
        const matchSdx = (item.sdx || '').toLowerCase().includes(search)
        const matchPttype = (item.pttypename || '').toLowerCase().includes(search)
        const matchLab = (item.labresult || '').toLowerCase().includes(search)
        const matchAuthen = (item.authencode || '').toLowerCase().includes(search)
        const matchRep = (item.rep || '').toLowerCase().includes(search)

        switch (searchField) {
          case 'HN':
            return matchHn
          case 'CID':
            return matchCid
          case 'PTNAME':
            return matchPtname
          case 'VN':
            return matchVn
          case 'DIAG':
            return matchPdx || matchSdx
          case 'PTTYPE':
            return matchPttype
          case 'LAB':
          case 'LABRESULT':
            return matchLab
          case 'ALL':
          default:
            return (
              matchesSeamlessRepSearch(item, search) ||
              matchHn ||
              matchCid ||
              matchPtname ||
              matchVn ||
              matchPdx ||
              matchSdx ||
              matchPttype ||
              matchLab ||
              matchAuthen ||
              matchRep
            )
        }
      })
    }

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
        case 'age':
          cmp = a.age - b.age
          break
        case 'income':
          cmp = a.income - b.income
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
        case 'labresult':
          cmp = (a.labresult || '').localeCompare(b.labresult || '')
          break
        default:
          cmp = 0
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems: HepatitisCItem[]
    if (exportAll) {
      pagedItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered
        .slice(startIndex, startIndex + pageSize)
        .map((item, idx) => ({ ...item, no: startIndex + idx + 1 }))
    }

    return {
      adpCode,
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      withLabOnly,
      searchField,
      search: params.search || '',
      sortBy,
      sortOrder,
      page: exportAll ? 1 : page,
      pageSize: exportAll ? totalCount : pageSize,
      totalCount,
      totalPages,
      items: pagedItems,
      summary,
      repBreakdown,
    }
  }
}
