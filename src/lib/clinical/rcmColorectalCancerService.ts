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

// ── 1. Domain Types: 21.2 บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี (ADP 90005) ──

export type ColorectalCancerCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'COMPLETE'
  | 'MISSING_ADP'
  | 'MISSING_PP'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type ColorectalCancerSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'CODE'
  | 'LAB'

export type ColorectalCancerSortField =
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
  | 'labresult'
  | 'code'

export type ColorectalCancerDataQualityStatus =
  | 'COMPLETE' // มี ADP 90005 + Special PP 1B0060 หรือ 1B0061
  | 'MISSING_ADP' // มี Special PP แต่ไม่มี ADP 90005 (แถบสีแดงอ่อน)
  | 'MISSING_PP' // มี ADP 90005 แต่ไม่มี Special PP (แถบสีส้ม)
  | 'INVALID_PP_CODE' // มี Special PP แต่รหัสไม่ใช่ 1B0060/1B0061 (แถบสีเหลืองอ่อน)

export interface ColorectalCancerReportParams extends FiscalDateRangeParams {
  cardFilter?: ColorectalCancerCardFilter
  ucOnly?: boolean
  pttypes?: string
  reps?: string
  searchField?: ColorectalCancerSearchField
  search?: string
  sortBy?: ColorectalCancerSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ColorectalCancerAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface ColorectalCancerAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: ColorectalCancerAdpMappingItem[]
}

export interface ColorectalCancerItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  isTargetAge: boolean // อายุ 50 - 70 ปี
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttype?: string
  pttype_eclaim_id?: string
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
  labresult: string | null
  code: string | null // tt.pp_special_type_name
  pp_special_code: string | null // e.g. 1B0060, 1B0061
  listname: string | null // ADP 90005 description
  hasAdp: boolean
  hasPpSpecial: boolean
  dataQualityStatus: ColorectalCancerDataQualityStatus
  status_seamless: string | null
  rep_seamless: string | null
  compensated_seamless: number
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund: string | null
  subfund: string | null
}

export interface ColorectalCancerSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  completeCount: number
  completeRate: number
  missingAdpCount: number
  missingAdpRate: number
  missingPpCount: number
  missingPpRate: number
  invalidPpCodeCount: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface ColorectalCancerReportResult {
  adpCode: '90005'
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: ColorectalCancerAdpMappingCheck
  cardFilter: ColorectalCancerCardFilter
  ucOnly: boolean
  pttypes?: string
  searchField: ColorectalCancerSearchField
  search: string
  sortBy: ColorectalCancerSortField
  sortOrder: 'asc' | 'desc'
  summary: ColorectalCancerSummary
  repBreakdown?: RepBreakdownSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ColorectalCancerItem[]
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

/**
 * Classifies data quality based on Visual FoxPro legacy color logic:
 * - empty(nvl(listname,'')) -> lightred (ขาด ADP 90005)
 * - empty(nvl(code,'')) -> orange (ขาด Special PP)
 * - !(getwordnum(code,1,' ')=='1B0060' or getwordnum(code,1,' ')=='1B0061') -> lightyellow (รหัส PP ไม่ตรง)
 * - else -> white / normal (ข้อมูลครบถ้วน)
 */
export function evaluateFitTestDataQuality(
  hasAdp: boolean,
  ppCodeName?: string | null,
  ppSpecialCode?: string | null
): ColorectalCancerDataQualityStatus {
  if (!hasAdp) {
    return 'MISSING_ADP'
  }

  const nameVal = (ppCodeName || '').trim()
  const codeVal = (ppSpecialCode || '').trim()

  if (!nameVal && !codeVal) {
    return 'MISSING_PP'
  }

  // Check if first token or code contains 1B0060 or 1B0061
  const firstWord = nameVal.split(/\s+/)[0] || ''
  const hasValidCode =
    firstWord === '1B0060' ||
    firstWord === '1B0061' ||
    codeVal.includes('1B0060') ||
    codeVal.includes('1B0061')

  if (!hasValidCode) {
    return 'INVALID_PP_CODE'
  }

  return 'COMPLETE'
}

// ── 3. RcmColorectalCancerService Implementation ──────────────────────────────

export class RcmColorectalCancerService {
  /**
   * Check if ADP code '90005' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<ColorectalCancerAdpMappingCheck> {
    const adpCode = '90005'
    const cacheKey = `rcm-fit-test-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      () => fetchAdpMappingViaGateway(adpCode, gateway, { refresh }),
      600000
    )
  }

  static async getColorectalCancerReport(
    params: ColorectalCancerReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<ColorectalCancerReportResult> {
    const adpCode = '90005'
    const categoryTitle = 'บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี'
    const reportTitle = '21.2 รายชื่อผู้รับบริการ ADP (90005)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: ColorectalCancerCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: ColorectalCancerSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ColorectalCancerSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fit-test-report-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fit-test-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, gwRes] = await Promise.all([
          RcmColorectalCancerService.checkAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('colorectal-cancer', { ds1, ds2, adpCode }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mappingRes,
        }
      },
      600000
    )

    // Normalize and map items
    const allItems: ColorectalCancerItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const pttype = r.pttype ? String(r.pttype).trim() : ''
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : ''
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 50 && age <= 70
      const sex = formatThaiSex(r.sex_code, r.sex)

      const listname = r.listname ? String(r.listname).trim() : null
      const hasAdp = Boolean(listname && listname.length > 0)
      const code = r.code ? String(r.code).trim() : null
      const ppSpecialCode = r.pp_special_code ? String(r.pp_special_code).trim() : null
      const hasPpSpecial = Boolean((code && code.length > 0) || (ppSpecialCode && ppSpecialCode.length > 0))

      const dataQualityStatus = evaluateFitTestDataQuality(hasAdp, code, ppSpecialCode)

      const sdxList = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sdx = sdxList.length > 0 ? sdxList.join(', ') : null

      const opList = [r.op0, r.op1, r.op2, r.op3, r.op4, r.op5]
        .map((o) => (o ? String(o).trim() : ''))
        .filter(Boolean)
      const ops = opList.length > 0 ? opList.join(', ') : null

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex,
        birthday: r.birthday ? String(r.birthday).trim() : null,
        age,
        isTargetAge,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode,
        maininscl,
        isUc,
        pttype,
        pttype_eclaim_id: pttypeEclaimId,
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
        sdx,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        ops,
        income: Number(r.income) || 0,
        labresult: r.labresult ? String(r.labresult).trim() : null,
        code,
        pp_special_code: ppSpecialCode,
        listname,
        hasAdp,
        hasPpSpecial,
        dataQualityStatus,
        status_seamless: r.status_seamless ? String(r.status_seamless).trim() : null,
        rep_seamless: r.rep_seamless ? String(r.rep_seamless).trim() : null,
        compensated_seamless: Number(r.compensated_seamless) || 0,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
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

    // Calculate Summary KPIs across eligible records
    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let totalIncome = 0
    let completeCount = 0
    let missingAdpCount = 0
    let missingPpCount = 0
    let invalidPpCodeCount = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let ucCount = 0

    for (const it of summaryCohort) {
      if (it.hn) uniqueHnSet.add(it.hn)
      if (it.isCompensated) {
        compensatedVisits++
        totalCompensated += it.compensated
      }
      totalIncome += it.income

      if (it.dataQualityStatus === 'COMPLETE') completeCount++
      else if (it.dataQualityStatus === 'MISSING_ADP') missingAdpCount++
      else if (it.dataQualityStatus === 'MISSING_PP') missingPpCount++
      else if (it.dataQualityStatus === 'INVALID_PP_CODE') invalidPpCodeCount++

      if (it.authencode) withAuthenCount++
      else withoutAuthenCount++

      if (it.isUc) ucCount++
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const completeRate = totalVisits > 0 ? (completeCount / totalVisits) * 100 : 0
    const missingAdpRate = totalVisits > 0 ? (missingAdpCount / totalVisits) * 100 : 0
    const missingPpRate = totalVisits > 0 ? (missingPpCount / totalVisits) * 100 : 0
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: ColorectalCancerSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      completeCount,
      completeRate,
      missingAdpCount,
      missingAdpRate,
      missingPpCount,
      missingPpRate,
      invalidPpCodeCount,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Filter Items by cardFilter and ucOnly (Dual-Mode)
    let filtered = summaryCohort

    if (selectedPttypesList.length === 0 && ucOnly) {
      filtered = filtered.filter((it) => it.isUc)
    }

    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((it) => it.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((it) => !it.isCompensated)
    } else if (cardFilter === 'COMPLETE') {
      filtered = filtered.filter((it) => it.dataQualityStatus === 'COMPLETE')
    } else if (cardFilter === 'MISSING_ADP') {
      filtered = filtered.filter((it) => it.dataQualityStatus === 'MISSING_ADP')
    } else if (cardFilter === 'MISSING_PP') {
      filtered = filtered.filter((it) => it.dataQualityStatus === 'MISSING_PP')
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((it) => Boolean(it.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((it) => !it.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((it) => it.isUc)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((it) => matchesRepFilter(it, selectedRepsList))
    }

    // Search Filtering
    if (search) {
      filtered = filtered.filter((it) => {
        if (searchField === 'HN') return it.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return it.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return it.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return it.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (it.pdx && it.pdx.toLowerCase().includes(search)) ||
            (it.sdx && it.sdx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'PTTYPE') return it.pttypename.toLowerCase().includes(search)
        if (searchField === 'CODE') {
          return (
            (it.code && it.code.toLowerCase().includes(search)) ||
            (it.pp_special_code && it.pp_special_code.toLowerCase().includes(search)) ||
            (it.listname && it.listname.toLowerCase().includes(search))
          )
        }
        if (searchField === 'LAB') {
          return it.labresult && it.labresult.toLowerCase().includes(search)
        }

        // Global search across all relevant fields
        return (
          matchesSeamlessRepSearch(it, search) ||
          it.hn.toLowerCase().includes(search) ||
          it.cid.toLowerCase().includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          it.vn.toLowerCase().includes(search) ||
          (it.pdx && it.pdx.toLowerCase().includes(search)) ||
          (it.sdx && it.sdx.toLowerCase().includes(search)) ||
          it.pttypename.toLowerCase().includes(search) ||
          (it.authencode && it.authencode.toLowerCase().includes(search)) ||
          (it.code && it.code.toLowerCase().includes(search)) ||
          (it.pp_special_code && it.pp_special_code.toLowerCase().includes(search)) ||
          (it.listname && it.listname.toLowerCase().includes(search)) ||
          (it.labresult && it.labresult.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search)) ||
          (it.status && it.status.toLowerCase().includes(search))
        )
      })
    }

    // Sorting
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
      } else if (sortBy === 'labresult') {
        cmp = (a.labresult || '').localeCompare(b.labresult || '', 'th')
      } else if (sortBy === 'code') {
        cmp = (a.code || '').localeCompare(b.code || '', 'th')
      }

      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Re-index row numbers
    const totalCount = filtered.length
    const totalPages = exportAll ? 1 : Math.ceil(totalCount / pageSize) || 1
    const pagedItems = exportAll
      ? filtered.map((it, idx) => ({ ...it, no: idx + 1 }))
      : filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((it, idx) => ({ ...it, no: (page - 1) * pageSize + idx + 1 }))

    return {
      adpCode: '90005',
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      pttypes,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      repBreakdown,
      totalCount,
      page: exportAll ? 1 : page,
      pageSize: exportAll ? totalCount : pageSize,
      totalPages,
      items: pagedItems,
    }
  }
}
