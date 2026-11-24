import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { isUniversalCoverageScheme } from './rcmOralCancerService'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Constants ──────────────────────────────────────────────────────────────

/**
 * รหัส ADP กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์ (Rehabilitation ADP Codes)
 * ตามประกาศ สปสช. และสคริปต์รายงานโรงพยาบาลเถิน (ทั้งหมด 16 รหัส):
 * H9449.1, H0489, H9339, H9375.1, H9375.2, H9378.1, H9378.2, H9378.3,
 * H9383.1, H9383.2, H9433.1, H9433.2, H9438.1, H9438.2, H9449.2, H9549
 */
export const REHAB_ADP_CODES = [
  'H9449.1',
  'H0489',
  'H9339',
  'H9375.1',
  'H9375.2',
  'H9378.1',
  'H9378.2',
  'H9378.3',
  'H9383.1',
  'H9383.2',
  'H9433.1',
  'H9433.2',
  'H9438.1',
  'H9438.2',
  'H9449.2',
  'H9549',
] as const

export type RehabAdpCode = (typeof REHAB_ADP_CODES)[number]

// ── 2. Domain Types ───────────────────────────────────────────────────────────

export type RehabCardFilter =
  | 'ALL'
  | 'MATCHED'
  | 'NOT_IN_WEB'
  | 'NO_REHAB_CODE'
  | 'NO_VN'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type RehabSortField =
  | 'vstdate'
  | 'vsttime'
  | 'vn'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'income'
  | 'compensated'
  | 'rehab_name'
  | 'rehab_code'
  | 'match_status'

export interface RehabReportParams extends FiscalDateRangeParams {
  cardFilter?: RehabCardFilter
  search?: string
  sortBy?: RehabSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
  reps?: string
}

export interface RehabAdpMappingItem {
  icode: string
  name: string
  strength?: string | null
  nhso_adp_code: string
}

export interface RehabAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  totalTargetCodes: number
  items: RehabAdpMappingItem[]
}

export type RehabMatchStatus = 'MATCHED' | 'NOT_IN_WEB' | 'NO_REHAB_CODE' | 'NO_VN'

export interface RehabServiceItem {
  no: number
  vn: string
  an: string | null
  hn: string
  cid: string
  ptname: string
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttypename: string
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  income: number
  listname: string | null
  diag: string | null
  oper: string | null
  doctorname: string | null
  filetype: string
  rehab_name: string
  rehab_code: string | null
  rep_seamless: string | null
  payno: string | null
  compensated_seamless: number
  noCompensated: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  isUc: boolean
  match_status: RehabMatchStatus
  // ข้อมูลเพิ่มเติมจากเว็บ Disability (rehab_service)
  targetgroup?: string | null
  deformed_type?: string | null
  adl?: string | null
  startservice?: string | null
  endservice?: string | null
  unitprice?: number | null
  realprice?: number | null
  staff?: string | null
  serialno?: string | null
  web_status?: string | null
  filename?: string | null
}

export interface RehabSummary {
  totalCases: number
  matchedCases: number
  matchedRate: number
  notInWebCases: number
  notInWebRate: number
  noRehabCodeCases: number
  noRehabCodeRate: number
  noVnCases: number
  noVnRate: number
  compensatedCases: number
  compensationRate: number
  totalCompensated: number
  uncompensatedCases: number
  withAuthenCases: number
  withAuthenRate: number
  noAuthenCases: number
  ucCases: number
}

export interface RehabReportResult {
  categoryTitle: string
  subtopicTitle: string
  reportTitle: string
  ds1: string
  ds2: string
  adpMapping: RehabAdpMappingCheck
  summary: RehabSummary
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  cardFilter: RehabCardFilter
  search: string
  sortBy: RehabSortField
  sortOrder: 'asc' | 'desc'
  items: RehabServiceItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 3. Service Implementation ─────────────────────────────────────────────────

export class RcmRehabilitationService {
  /**
   * ตรวจสอบว่าในตาราง s_drugitems หรือ nondrugitems มีการ Map รหัส ADP ฟื้นฟูสมรรถภาพ (16 รหัส) ไว้หรือไม่ via API Gateway
   */
  static async checkRehabAdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
    refresh?: boolean
  ): Promise<RehabAdpMappingCheck> {
    const cacheKey = 'rcm-rehab-adp-mapping-check-16'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        const res = await fetchAdpMappingViaGateway('REHAB', gateway, { refresh })
        return {
          isMapped: res.isMapped,
          mappedCount: res.mappedCount,
          totalTargetCodes: REHAB_ADP_CODES.length,
          items: res.items,
        }
      },
      300000 // Cache TTL 5 minutes
    )
  }

  /**
   * สร้างรายงานรายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability (11.47.3) via API Gateway
   * กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์
   */
  static async getDisabilityServicesReport(
    params: RehabReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<RehabReportResult> {
    const categoryTitle = 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์'
    const subtopicTitle = 'รายการการให้บริการฟื้นฟูสมรรถภาพ'
    const reportTitle = 'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: RehabCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: RehabSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-rehab-disability-services-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mRes, gwRes] = await Promise.all([
          RcmRehabilitationService.checkRehabAdpMapping(gateway, Boolean(params.refresh)),
          gateway.getRcmFundData('rehabilitation', { ds1, ds2 }),
        ])
        return {
          rawRows: extractFundRawRows(gwRes),
          adpMapping: mRes,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    // ── 4. Map & Categorize Reconciliation Status ─────────────────────────────
    // FoxPro Color Rules:
    // empty(vn) -> lightred (NO_VN)
    // rehab_name = 'ไม่พบใน Web' -> orange (NOT_IN_WEB)
    // empty(rehab_code) -> lightyellow (NO_REHAB_CODE)
    // otherwise -> normal/green (MATCHED)
    let allItems: RehabServiceItem[] = (rawRows || []).map((r, idx) => {
      const vn = r.vn ? String(r.vn).trim() : ''
      const rehabName = r.rehab_name ? String(r.rehab_name).trim() : 'ไม่พบใน Web'
      const rehabCode = r.rehab_code ? String(r.rehab_code).trim() : null

      let matchStatus: RehabMatchStatus = 'MATCHED'
      let filetype = r.filetype ? String(r.filetype) : 'HOSxP'

      if (!vn) {
        matchStatus = 'NO_VN'
        filetype = 'Web'
      } else if (rehabName === 'ไม่พบใน Web' || rehabName.includes('ไม่พบ')) {
        matchStatus = 'NOT_IN_WEB'
        filetype = 'HOSxP'
      } else if (!rehabCode || rehabCode === '') {
        matchStatus = 'NO_REHAB_CODE'
        filetype = 'Web'
      } else {
        matchStatus = 'MATCHED'
        filetype = 'ตรงกันทั้ง 2 ระบบ'
      }

      const compensatedVal = Number(r.compensated || 0)
      const isCompensated = compensatedVal > 0 || Boolean(r.rep && String(r.rep).trim() !== '')
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename)
      const pttypeEclaimId = r.pttype_eclaim_id
        ? String(r.pttype_eclaim_id).trim()
        : r.filetype === 'Web'
          ? '01'
          : null

      return {
        no: idx + 1,
        vn,
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl: String(r.maininscl || ''),
        pttypename: String(r.pttypename || ''),
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        income: Number(r.income || 0),
        listname: r.listname ? String(r.listname).trim() : null,
        diag: r.diag ? String(r.diag).trim() : null,
        oper: r.oper ? String(r.oper).trim() : null,
        doctorname: r.doctorname ? String(r.doctorname).trim() : null,
        filetype,
        rehab_name: rehabName,
        rehab_code: rehabCode,
        rep_seamless: r.rep_seamless ? String(r.rep_seamless).trim() : null,
        payno: r.payno ? String(r.payno).trim() : null,
        compensated_seamless: Number(r.compensated_seamless || 0),
        noCompensated: r.noCompensated ? String(r.noCompensated).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated,
        isUc,
        match_status: matchStatus,
        targetgroup: r.targetgroup ? String(r.targetgroup).trim() : null,
        deformed_type: r.deformed_type ? String(r.deformed_type).trim() : null,
        adl: r.adl ? String(r.adl).trim() : null,
        startservice: r.startservice ? String(r.startservice).trim() : null,
        endservice: r.endservice ? String(r.endservice).trim() : null,
        unitprice: r.unitprice != null ? Number(r.unitprice) : null,
        realprice: r.realprice != null ? Number(r.realprice) : null,
        staff: r.staff ? String(r.staff).trim() : null,
        serialno: r.serialno ? String(r.serialno).trim() : null,
        web_status: r.web_status ? String(r.web_status).trim() : null,
        filename: r.filename ? String(r.filename).trim() : null,
      }
    })

    // ── 5. Calculate KPI Summary Cards ────────────────────────────────────────
    allItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    const totalCases = summaryCohort.length
    const matchedCases = summaryCohort.filter((i) => i.match_status === 'MATCHED').length
    const notInWebCases = summaryCohort.filter((i) => i.match_status === 'NOT_IN_WEB').length
    const noRehabCodeCases = summaryCohort.filter((i) => i.match_status === 'NO_REHAB_CODE').length
    const noVnCases = summaryCohort.filter((i) => i.match_status === 'NO_VN').length

    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const uncompensatedCases = totalCases - compensatedCases

    const withAuthenCases = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const noAuthenCases = totalCases - withAuthenCases
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: RehabSummary = {
      totalCases,
      matchedCases,
      matchedRate: totalCases > 0 ? Number(((matchedCases / totalCases) * 100).toFixed(1)) : 0,
      notInWebCases,
      notInWebRate: totalCases > 0 ? Number(((notInWebCases / totalCases) * 100).toFixed(1)) : 0,
      noRehabCodeCases,
      noRehabCodeRate: totalCases > 0 ? Number(((noRehabCodeCases / totalCases) * 100).toFixed(1)) : 0,
      noVnCases,
      noVnRate: totalCases > 0 ? Number(((noVnCases / totalCases) * 100).toFixed(1)) : 0,
      compensatedCases,
      compensationRate: totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0,
      totalCompensated,
      uncompensatedCases,
      withAuthenCases,
      withAuthenRate: totalCases > 0 ? Number(((withAuthenCases / totalCases) * 100).toFixed(1)) : 0,
      noAuthenCases,
      ucCases,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // ── 6. Filtering ──────────────────────────────────────────────────────────
    let filtered = [...summaryCohort]

    if (cardFilter === 'MATCHED') {
      filtered = filtered.filter((i) => i.match_status === 'MATCHED')
    } else if (cardFilter === 'NOT_IN_WEB') {
      filtered = filtered.filter((i) => i.match_status === 'NOT_IN_WEB')
    } else if (cardFilter === 'NO_REHAB_CODE') {
      filtered = filtered.filter((i) => i.match_status === 'NO_REHAB_CODE')
    } else if (cardFilter === 'NO_VN') {
      filtered = filtered.filter((i) => i.match_status === 'NO_VN')
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Unified Global Search across all relevant fields
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.an && i.an.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          i.rehab_name.toLowerCase().includes(search) ||
          (i.rehab_code && i.rehab_code.toLowerCase().includes(search)) ||
          (i.diag && i.diag.toLowerCase().includes(search)) ||
          (i.oper && i.oper.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search)) ||
          (i.clinic && i.clinic.toLowerCase().includes(search)) ||
          (i.doctorname && i.doctorname.toLowerCase().includes(search)) ||
          (i.staff && i.staff.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // ── 7. Sorting ────────────────────────────────────────────────────────────
    filtered.sort((a, b) => {
      const valA = a[sortBy] ?? ''
      const valB = b[sortBy] ?? ''

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB, 'th')
        return sortOrder === 'asc' ? comp : -comp
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })

    // ── 8. Pagination ─────────────────────────────────────────────────────────
    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    let pagedItems: RehabServiceItem[]
    if (exportAll) {
      pagedItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered.slice(startIndex, startIndex + pageSize).map((item, idx) => ({
        ...item,
        no: startIndex + idx + 1,
      }))
    }

    return {
      categoryTitle,
      subtopicTitle,
      reportTitle,
      ds1,
      ds2,
      adpMapping,
      summary,
      totalCount,
      totalPages,
      page,
      pageSize,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      items: pagedItems,
      repBreakdown,
    }
  }
}
