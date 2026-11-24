import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { isUniversalCoverageScheme } from './rcmOralCancerService'
import { matchesPttypeFilter } from './pttypeConstants'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Types & Constants ───────────────────────────────────────────────────────

export type ImcPatientType = 'IPD' | 'OPD'

export type ImcCardFilter =
  | 'ALL'
  | 'CHRONIC'
  | 'NOT_CHRONIC'
  | 'IN_WEB'
  | 'NOT_IN_WEB'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type ImcSortField =
  | 'date'
  | 'an'
  | 'vn'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'getprice'
  | 'compensated'
  | 'chronic'
  | 'web'
  | 'status'
  | 'rep'

export interface ImcReportParams extends FiscalDateRangeParams {
  patientType?: ImcPatientType
  cardFilter?: ImcCardFilter
  search?: string
  sortBy?: ImcSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
  reps?: string
}

export interface SeamlessRepBreakdown {
  rep: string
  fund: string | null
  type: string | null
  collected: number
  compensated: number
}

export interface ImcItem {
  no: number
  patientType: ImcPatientType
  vn: string | null
  an: string | null
  hn: string
  cid: string
  ptname: string
  age: number
  chronic: 'Y' | null
  web: 'Y' | null
  filetype: string
  date: string // vstdate for OPD, dchdate for IPD
  vstdate: string | null
  vsttime: string | null
  admdate: string | null
  dchdate: string | null
  los: number | null
  ward: string | null
  cc: string | null
  prediag: string | null
  authencode: string | null
  maininscl: string | null
  pttypename: string | null
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  ovstost: string | null
  dchstts: string | null
  dchtype: string | null
  dx: string | null
  op: string | null
  adjrw: number | null
  income: number
  status: string | null
  rep: string | null // e-Claim Rep (repeclaim → repdata → neweclaim → eclaimdb)
  compensated: number
  /** Seamless (DMIS) Reps จาก rcmdb.seamless จับคู่ด้วย VN (OPD) / AN (IPD) คั่นด้วย comma */
  repSeamless: string | null
  /** ยอดชดเชยจาก Seamless — แยกจาก compensated (e-Claim) เพื่อไม่ให้นับซ้ำ */
  compensatedSeamless: number
  /** ชื่อกองทุน Seamless (Fund) คั่นด้วย comma */
  seamlessFunds: string | null
  /** รายละเอียดยอดเงินแยกรายใบ Rep ของ Seamless */
  seamlessRepItems?: SeamlessRepBreakdown[]
  getprice: number // จากระบบ Web IMC (imc.amount)
  address: string | null
  tel: string | null
  isCompensated: boolean
  isUc: boolean
}

export interface ImcSummary {
  totalCases: number
  chronicCases: number
  chronicRate: number
  inWebCases: number
  inWebRate: number
  notInWebCases: number
  notInWebRate: number
  compensatedCases: number
  compensationRate: number
  totalCompensated: number
  totalGetprice: number
  totalIncome: number
  uncompensatedCases: number
  withAuthenCases: number
  withAuthenRate: number
  noAuthenCases: number
  ucCases: number
}

export interface ImcReportResult {
  categoryTitle: string
  subtopicTitle: string
  reportTitle: string
  patientType: ImcPatientType
  ds1: string
  ds2: string
  summary: ImcSummary
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  cardFilter: ImcCardFilter
  search: string
  sortBy: ImcSortField
  sortOrder: 'asc' | 'desc'
  items: ImcItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Service Implementation ─────────────────────────────────────────────────

export class RcmImcService {
  /**
   * สร้างรายงานรายชื่อผู้รับบริการตามเกณฑ์ IMC
   * หัวข้อ: กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์
   * หัวข้อย่อย: รายงานบริการผู้ป่วย IMC
   * หัวข้อย่อยอีก: รายชื่อผู้รับบริการตามเกณฑ์ IMC
   */
  static async getImcReport(
    params: ImcReportParams,
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<ImcReportResult> {
    const categoryTitle = 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์'
    const subtopicTitle = 'รายงานบริการผู้ป่วย IMC'
    const reportTitle = 'รายชื่อผู้รับบริการตามเกณฑ์ IMC'

    const patientType: ImcPatientType = params.patientType === 'OPD' ? 'OPD' : 'IPD'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: ImcCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ImcSortField = params.sortBy || 'date'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fund-imc-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const gwRes = await gateway.getRcmFundData('imc', { ds1, ds2, patientType })
        return extractFundRawRows(gwRes)
      },
      300000 // Cache TTL 5 minutes
    )

    // ── 3. Transform & Structure Domain Items ──────────────────────────────────
    const allItems: ImcItem[] = (rawRows || []).map((r, idx) => {
      const compensatedVal = Number(r.compensated || 0)
      const isCompensated = compensatedVal > 0 || Boolean(r.rep && String(r.rep).trim() !== '')
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename)
      const chronicVal = r.chronic === 'Y' ? 'Y' : null
      const webVal = r.web === 'Y' ? 'Y' : null

      let filetype = r.filetype ? String(r.filetype).trim() : 'HOSxP'
      if (filetype === 'ตรงกันทั้ง 2 ระบบ' || (webVal === 'Y' && filetype.includes('HOSxP'))) {
        filetype = 'ตรงกันทั้ง 2 ระบบ'
      } else if (webVal === 'Y') {
        filetype = 'Web'
      } else {
        filetype = 'HOSxP'
      }

      return {
        no: idx + 1,
        patientType,
        vn: r.vn ? String(r.vn).trim() : null,
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age || 0),
        chronic: chronicVal,
        web: webVal,
        filetype,
        date: String(r.date || r.dchdate || r.vstdate || ''),
        vstdate: r.vstdate ? String(r.vstdate) : null,
        vsttime: r.vsttime ? String(r.vsttime) : null,
        admdate: r.admdate ? String(r.admdate) : null,
        dchdate: r.dchdate ? String(r.dchdate) : null,
        los: r.los != null ? Number(r.los) : null,
        ward: r.ward ? String(r.ward).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        prediag: r.prediag ? String(r.prediag).trim() : null,
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : null,
        pttypename: r.pttypename ? String(r.pttypename).trim() : null,
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        ovstost: r.ovstost ? String(r.ovstost).trim() : null,
        dchstts: r.dchstts ? String(r.dchstts).trim() : null,
        dchtype: r.dchtype ? String(r.dchtype).trim() : null,
        dx: r.dx ? String(r.dx).trim() : null,
        op: r.op ? String(r.op).trim() : null,
        adjrw: r.adjrw != null ? Number(r.adjrw) : null,
        income: Number(r.income || 0),
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        repSeamless: r.rep_seamless ? String(r.rep_seamless).trim() : null,
        compensatedSeamless: Number(r.compensated_seamless || 0),
        seamlessFunds: r.seamless_funds ? String(r.seamless_funds).trim() : null,
        seamlessRepItems: Array.isArray(r.seamless_rep_items) ? r.seamless_rep_items : [],
        getprice: Number(r.getprice || 0),
        address: r.address ? String(r.address).trim() : null,
        tel: r.tel ? String(r.tel).trim() : null,
        isCompensated,
        isUc,
      }
    })

    // ── 4. Calculate Summary KPI ──────────────────────────────────────────────
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    const totalCases = summaryCohort.length
    const chronicCases = summaryCohort.filter((i) => i.chronic === 'Y').length
    const inWebCases = summaryCohort.filter((i) => i.web === 'Y').length
    const notInWebCases = totalCases - inWebCases

    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalGetprice = summaryCohort.reduce((acc, i) => acc + i.getprice, 0)
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)

    const withAuthenCases = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const noAuthenCases = totalCases - withAuthenCases
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: ImcSummary = {
      totalCases,
      chronicCases,
      chronicRate: totalCases > 0 ? Number(((chronicCases / totalCases) * 100).toFixed(1)) : 0,
      inWebCases,
      inWebRate: totalCases > 0 ? Number(((inWebCases / totalCases) * 100).toFixed(1)) : 0,
      notInWebCases,
      notInWebRate: totalCases > 0 ? Number(((notInWebCases / totalCases) * 100).toFixed(1)) : 0,
      compensatedCases,
      compensationRate: totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0,
      totalCompensated,
      totalGetprice,
      totalIncome,
      uncompensatedCases,
      withAuthenCases,
      withAuthenRate: totalCases > 0 ? Number(((withAuthenCases / totalCases) * 100).toFixed(1)) : 0,
      noAuthenCases,
      ucCases,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // ── 5. Filtering ──────────────────────────────────────────────────────────
    let filtered = [...summaryCohort]

    if (cardFilter === 'CHRONIC') {
      filtered = filtered.filter((i) => i.chronic === 'Y')
    } else if (cardFilter === 'NOT_CHRONIC') {
      filtered = filtered.filter((i) => i.chronic !== 'Y')
    } else if (cardFilter === 'IN_WEB') {
      filtered = filtered.filter((i) => i.web === 'Y')
    } else if (cardFilter === 'NOT_IN_WEB') {
      filtered = filtered.filter((i) => i.web !== 'Y')
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Global Search across all fields
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          (i.vn && i.vn.toLowerCase().includes(search)) ||
          (i.an && i.an.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.dx && i.dx.toLowerCase().includes(search)) ||
          (i.op && i.op.toLowerCase().includes(search)) ||
          (i.ward && i.ward.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search)) ||
          (i.clinic && i.clinic.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.repSeamless && i.repSeamless.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search)) ||
          (i.address && i.address.toLowerCase().includes(search)) ||
          (i.tel && i.tel.toLowerCase().includes(search))
        )
      })
    }

    // ── 6. Sorting ────────────────────────────────────────────────────────────
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

    // ── 7. Pagination ─────────────────────────────────────────────────────────
    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    let pagedItems: ImcItem[]
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
      patientType,
      ds1,
      ds2,
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
