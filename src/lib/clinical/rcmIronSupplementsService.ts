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

// ── 1. Domain Types: 18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001) ──

export const IRON_SUPPLEMENT_DIDS: readonly string[] = [
  '202030120137819920381422',
  '100488000004203120381169',
  '100489000004320121881267',
  '100488000004203121781674',
  '100488000004203120381442',
  '100488000004203120381013',
  '100488000004203121781144',
  '100488000004203120381053',
  '100488000004203120381144',
  '100488000004203120381271',
  '100488000004203120381341',
  '100488000004203120381626',
  '100488000004203121881626',
  '100488000004203121881442',
  '100488000004203121881553',
  '100489000004192121881506',
  '100489000004320120381122',
  '100489000004320120381506',
  '100489000004203120381555',
  '100489000004203120381084',
  '100489000004203120381144', // 100489 DID from FoxPro
  '100489000004203120381619',
  '100489000004203120381477',
  '100489000004203120381544',
  '100489000004203120381546',
] as const

export type IronSupplementsCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'TARGET_AGE'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'WITH_ADP'
  | 'WITH_DRUG'

export type IronSupplementsSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'DRUG'

export type IronSupplementsSortField =
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

export interface IronSupplementsReportParams extends FiscalDateRangeParams {
  cardFilter?: IronSupplementsCardFilter
  ucOnly?: boolean
  pttypes?: string
  targetAgeOnly?: boolean
  searchField?: IronSupplementsSearchField
  search?: string
  sortBy?: IronSupplementsSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface IronSupplementsAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface IronSupplementsAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: IronSupplementsAdpMappingItem[]
}

export interface IronSupplementsItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  isTargetAge: boolean // Age between 13 and 45 years
  nation: string | null
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
  drugname: string | null
  listname: string | null
  listname1?: string | null
  hasDrug: boolean
  hasAdp: boolean
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

export interface IronSupplementsSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  targetAgeCount: number // อายุ 13-45 ปี
  targetAgeRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  withAdpCount: number // มี ADP 14001
  withAdpRate: number
  withDrugCount: number // มีการจ่ายยา DID
  withDrugRate: number
  totalIncome: number
}

export interface IronSupplementsReportResult {
  adpCode: '14001'
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: IronSupplementsAdpMappingCheck
  cardFilter: IronSupplementsCardFilter
  ucOnly: boolean
  targetAgeOnly: boolean
  searchField: IronSupplementsSearchField
  search: string
  sortBy: IronSupplementsSortField
  sortOrder: 'asc' | 'desc'
  summary: IronSupplementsSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: IronSupplementsItem[]
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

// ── 3. RcmIronSupplementsService Implementation ───────────────────────────────

export class RcmIronSupplementsService {
  /**
   * Check if ADP code '14001' is mapped in s_drugitems table via API Gateway.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<IronSupplementsAdpMappingCheck> {
    const adpCode = '14001'
    const cacheKey = `rcm-iron-supplements-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      () => fetchAdpMappingViaGateway(adpCode, gateway, { refresh }),
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001) Report:
   * - Queries visits with dispensing of iron supplement drugs (25 DIDs) or ADP code 14001 via API Gateway
   * - Target population: Female (sex = 2), Age 13 - 45 years
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getIronSupplementsReport(
    params: IronSupplementsReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<IronSupplementsReportResult> {
    const adpCode = '14001'
    const categoryTitle = 'บริการยาเม็ดเสริมธาตุเหล็ก อายุ 13-45 ปี ADP + Drug'
    const reportTitle = '18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: IronSupplementsCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const targetAgeOnly = Boolean(params.targetAgeOnly)
    const searchField: IronSupplementsSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: IronSupplementsSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-iron-supplements-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-iron-supplements-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mRes, gwRes] = await Promise.all([
          RcmIronSupplementsService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('iron-supplements', { ds1, ds2 }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mRes,
        }
      },
      600000 // Cache TTL 10 minutes
    )

    // Normalize and map items
    // Strict cohort guard: 18.2 Iron Supplements fund is strictly for Females (sex = 2) aged 13-45 years
    let allItems: IronSupplementsItem[] = (rawRows || [])
      .filter((r: any) => {
        const sex = String(r.sex_code || r.sex || '').trim()
        const isFemale = sex === '2' || sex === 'หญิง' || sex === 'F'
        const age = Number(r.age) || 0
        const isTargetAge = age >= 13 && age <= 45
        return isFemale && isTargetAge
      })
      .map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 13 && age <= 45
      const sex = formatThaiSex(r.sex_code, r.sex)

      const drugname = r.drugname ? String(r.drugname).trim() : null
      const listname = r.listname ? String(r.listname).trim() : null
      const hasDrug = Boolean(drugname && drugname.length > 0)
      const hasAdp = Boolean(listname && listname.length > 0)

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
        birthday: r.birthday ? String(r.birthday).trim() : null,
        sex,
        age,
        isTargetAge,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: authencode || null,
        maininscl,
        isUc,
        pttypename,
        pttype_eclaim_id: r.pttype_eclaim_id != null ? String(r.pttype_eclaim_id).trim() : null,
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
        drugname,
        listname,
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        hasDrug,
        hasAdp,
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

    // Calculate Summary Aggregates (Full Page Filter based on pttypes / ucOnly)
    allItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )
    let summaryCohort = allItems
    if (params.pttypes) {
      const selectedPttypesList = params.pttypes.split(',').map((p) => p.trim()).filter(Boolean)
      summaryCohort = summaryCohort.filter((item) =>
        matchesPttypeFilter(item.pttypename || item.pttype_eclaim_id, selectedPttypesList, item.isUc, item.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = summaryCohort.filter((item) => item.isUc)
    }

    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0
    let targetAgeCount = 0
    let withAdpCount = 0
    let withDrugCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount++
      if (item.isUc) ucCount++
      if (item.isTargetAge) targetAgeCount++
      if (item.hasAdp) withAdpCount++
      if (item.hasDrug) withDrugCount++
      totalIncome += item.income
    }

    const totalVisits = summaryCohort.length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const withoutAuthenCount = totalVisits - withAuthenCount
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const targetAgeRate = totalVisits > 0 ? (targetAgeCount / totalVisits) * 100 : 0
    const withAdpRate = totalVisits > 0 ? (withAdpCount / totalVisits) * 100 : 0
    const withDrugRate = totalVisits > 0 ? (withDrugCount / totalVisits) * 100 : 0

    const summary: IronSupplementsSummary = {
      totalVisits,
      uniquePatients: uniqueHnSet.size,
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
      withAdpCount,
      withAdpRate,
      withDrugCount,
      withDrugRate,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply Card Filter on summaryCohort
    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    } else if (cardFilter === 'WITH_ADP') {
      filtered = filtered.filter((i) => i.hasAdp)
    } else if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    }

    // Secondary filters: ucOnly & targetAgeOnly
    if (ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (targetAgeOnly && cardFilter !== 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
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
        if (searchField === 'DRUG') {
          return (
            (item.drugname && item.drugname.toLowerCase().includes(search)) ||
            (item.listname && item.listname.toLowerCase().includes(search))
          )
        }

        // ALL searchField: searches hn, cid, ptname, vn, pdx, authencode, rep, pttypename, drugname, listname
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.drugname && item.drugname.toLowerCase().includes(search)) ||
          (item.listname && item.listname.toLowerCase().includes(search))
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
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      targetAgeOnly,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: paginatedItems,
      repBreakdown,
    }
  }
}
