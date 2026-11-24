import { apiGateway } from '@/lib/apiGateway'
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
import { isUniversalCoverageScheme } from './rcmOralCancerService'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

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

// ── Types: กองทุนยา Streptokinase ───────────────────────────────────────────

export type StreptokinasePatientType = 'OPD' | 'IPD'

export type StreptokinaseCardFilter =
  | 'ALL'
  | 'AUDIT_PASS'
  | 'AUDIT_ERROR'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_INVOICE'
  | 'WITH_REP'
  | 'NOT_SENT'

export type StreptokinaseSortField =
  | 'date'
  | 'time'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'drugname'
  | 'money_hosxp'
  | 'debit'
  | 'money_eclaim'
  | 'money_rep'
  | 'money_invoice'
  | 'rep'
  | 'status'

export interface StreptokinaseReportParams extends FiscalDateRangeParams {
  patientType?: StreptokinasePatientType
  cardFilter?: StreptokinaseCardFilter
  search?: string
  sortBy?: StreptokinaseSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
  reps?: string
}

export interface StreptokinaseItem {
  no: number
  patientType: StreptokinasePatientType
  vn: string | null
  an: string | null
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  date: string // vstdate for OPD, dchdate for IPD
  vstdate?: string
  vsttime?: string
  admdate?: string
  dchdate?: string
  pttypename: string
  pttype_eclaim_id?: string | null
  maininscl?: string
  department?: string | null
  clinic?: string | null
  ward?: string | null
  drugname: string
  money_hosxp: number
  discount_money: number
  rcpt_money: number
  debit: number
  rcpno: string
  money_eclaim: number
  money_rep: number
  money_invoice: number
  dx: string | null
  op: string | null
  errorDx: string | null
  errorOp: string | null
  hasError: boolean
  rep: string | null
  status: string
  compensated: number
  isCompensated: boolean
  isUc?: boolean
}

export interface StreptokinaseSummary {
  totalCases: number
  uniquePatients: number
  auditPassCases: number
  auditPassRate: number
  auditErrorCases: number
  auditErrorRate: number
  compensatedCases: number
  uncompensatedCases: number
  compensationRate: number
  totalCompensated: number
  totalHosxp: number
  totalDebit: number
  withInvoiceCases: number
  withRepCases: number
  notSentCases: number
}

export interface StreptokinaseReportResult {
  title: string
  subtitle: string
  patientType: StreptokinasePatientType
  ds1: string
  ds2: string
  adpMapping: AdpMappingCheck
  cardFilter: StreptokinaseCardFilter
  search: string
  sortBy: StreptokinaseSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: StreptokinaseSummary
  items: StreptokinaseItem[]
  repBreakdown?: RepBreakdownSummary
}

export interface AnClinicalDetails {
  header: {
    an: string
    hn: string
    cid: string
    ptname: string
    sex: string
    age: number
    admdate: string
    dchdate: string
    pttypename: string
    ward: string
  }
  diagnoses: {
    icd10: string
    icdName: string
    diagtype: string
    diagtypeName: string
    doctorName: string
  }[]
  procedures: {
    icd9: string
    icd9Name: string
    opdate: string
    doctorName: string
  }[]
  orders: {
    icode: string
    itemName: string
    strength: string | null
    units: string | null
    qty: number
    unitprice: number
    sumPrice: number
    paidstName: string
    incomeName: string
    isDrug: boolean
  }[]
}

// ── Service Implementation ──────────────────────────────────────────────────

export interface StreptokinaseGatewayAdapter extends RcmFundGatewayAdapter {
  getAnClinicalDetails?: (an: string) => Promise<{ success?: boolean; data: AnClinicalDetails | null }>
}

const defaultStreptokinaseGateway: StreptokinaseGatewayAdapter = {
  ...defaultRcmFundGateway,
  getAnClinicalDetails: (an) => apiGateway.clinical.getAnClinicalDetails(an),
}

export class RcmStreptokinaseService {
  /**
   * ตรวจสอบการ Map รหัส ADP สำหรับยากลุ่ม STEMI / Streptokinase ในตาราง s_drugitems via API Gateway
   */
  static async checkAdpMapping(
    gateway: StreptokinaseGatewayAdapter = defaultStreptokinaseGateway,
    refresh?: boolean
  ): Promise<AdpMappingCheck> {
    const cacheKey = 'rcm-adp-mapping-check-stemi'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      () => fetchAdpMappingViaGateway('STEMI', gateway, { refresh }),
      600000 // 10 minutes cache
    )
  }

  /**
   * ดึงรายงานรายชื่อรับยา Streptokinase (OPD หรือ IPD) via API Gateway
   */
  static async getStreptokinaseReport(
    params: StreptokinaseReportParams,
    gateway: StreptokinaseGatewayAdapter = defaultStreptokinaseGateway
  ): Promise<StreptokinaseReportResult> {
    const title = 'กองทุนยา Streptokinase'
    const subtitle = 'รายชื่อรับยา Stroke และSTEMI'
    const patientType: StreptokinasePatientType = params.patientType === 'OPD' ? 'OPD' : 'IPD'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: StreptokinaseCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: StreptokinaseSortField = params.sortBy || 'date'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-streptokinase-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-adp-mapping-check-stemi')
    }

    const adpMapping = await this.checkAdpMapping(gateway, params.refresh)

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const gwRes = await gateway.getRcmFundData('streptokinase', { ds1, ds2, patientType })
        return extractFundRawRows(gwRes)
      },
      600000 // 10 minutes TTL
    )

    // Parse and evaluate Clinical/Audit Rules
    let allItems: StreptokinaseItem[] = (rawRows || []).map((r: any, idx: number) => {
      const dx = r.dx ? String(r.dx).trim() : null
      const op = r.op ? String(r.op).trim() : null

      // Diagnostic check: STEMI Dx (I210-I213 or I22x)
      // ICD-10 pattern: I210, I211, I212, I213, I21.0, I21.1, I21.2, I21.3, or I22, I220, I22.0, etc.
      const hasStemiDx = Boolean(dx && /(I21[0-3]|I21\.[0-3]|I22)/i.test(dx))
      const errorDx = hasStemiDx ? null : 'ไม่พบ Dx I210-I213 หรือ I22x'

      // Procedure check: Op 9910 (Injection or infusion of thrombolytic agent)
      const hasOp9910 = Boolean(op && /(9910|99\.10)/.test(op))
      const errorOp = hasOp9910 ? null : 'ไม่พบ Op 9910'

      const moneyHosxp = Number(r.money_hosxp || 0)
      const discountMoney = Number(r.discount_money || 0)
      const rcptMoney = Number(r.rcpt_money || 0)
      const debit = Number(r.debit || 0)

      const moneyEclaim = Number(r.money_eclaim || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyInvoice = Number(r.money_invoice || 0)

      const rep = r.rep ? String(r.rep).trim() : null
      const rawStatus = r.status ? String(r.status).trim() : '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'

      // Compensation calculation: prioritize invoice -> rep -> eclaim
      const compensated = moneyInvoice > 0 ? moneyInvoice : (moneyRep > 0 ? moneyRep : (moneyEclaim > 0 ? moneyEclaim : 0))
      const isCompensated = compensated > 0 || Boolean(rep && rep.length > 0)

      const hasError = Boolean(errorDx || errorOp)

      const baseItem: StreptokinaseItem = {
        no: idx + 1,
        patientType,
        vn: r.vn ? String(r.vn).trim() : null,
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code, r.sex),
        birthday: r.birthday ? String(r.birthday).trim() : null,
        age: Number(r.age || 0),
        date: String(r.vstdate || r.dchdate || '').trim(),
        vstdate: r.vstdate ? String(r.vstdate).trim() : undefined,
        vsttime: r.vsttime ? String(r.vsttime).trim() : undefined,
        admdate: r.admdate ? String(r.admdate).trim() : undefined,
        dchdate: r.dchdate ? String(r.dchdate).trim() : undefined,
        pttypename: String(r.pttypename || '').trim(),
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : undefined,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        ward: r.ward ? String(r.ward).trim() : null,
        drugname: String(r.drugname || '').trim(),
        money_hosxp: moneyHosxp,
        discount_money: discountMoney,
        rcpt_money: rcptMoney,
        debit,
        rcpno: String(r.rcpno || '').replace(/['"]/g, '').trim(),
        money_eclaim: moneyEclaim,
        money_rep: moneyRep,
        money_invoice: moneyInvoice,
        dx,
        op,
        errorDx,
        errorOp,
        hasError,
        rep,
        status: rawStatus,
        compensated,
        isCompensated,
        isUc: isUniversalCoverageScheme(r.maininscl, r.pttypename),
      }

      return baseItem
    })

    // Compute Summary Stats
    allItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway, defaultStreptokinaseGateway),
      Boolean(params.refresh)
    )
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((it) =>
        matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, params.pttypes, it.isUc, it.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((it) => it.isUc)
    }

    const totalCases = summaryCohort.length
    const uniqueHnSet = new Set(summaryCohort.map((it) => it.hn))
    const uniquePatients = uniqueHnSet.size

    const auditPassCases = summaryCohort.filter((it) => !it.hasError).length
    const auditPassRate = totalCases > 0 ? Number(((auditPassCases / totalCases) * 100).toFixed(1)) : 0

    const auditErrorCases = summaryCohort.filter((it) => it.hasError).length
    const auditErrorRate = totalCases > 0 ? Number(((auditErrorCases / totalCases) * 100).toFixed(1)) : 0

    const compensatedCases = summaryCohort.filter((it) => it.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const compensationRate = totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0

    const totalCompensated = summaryCohort.reduce((acc, it) => acc + it.compensated, 0)
    const totalHosxp = summaryCohort.reduce((acc, it) => acc + it.money_hosxp, 0)
    const totalDebit = summaryCohort.reduce((acc, it) => acc + it.debit, 0)

    const withInvoiceCases = summaryCohort.filter((it) => it.status.includes('Invoice') || it.money_invoice > 0).length
    const withRepCases = summaryCohort.filter((it) => it.status.includes('Rep') || it.money_rep > 0).length
    const notSentCases = summaryCohort.filter((it) => it.status.startsWith('-') || it.status.includes('ยังไม่ส่ง')).length

    const summary: StreptokinaseSummary = {
      totalCases,
      uniquePatients,
      auditPassCases,
      auditPassRate,
      auditErrorCases,
      auditErrorRate,
      compensatedCases,
      uncompensatedCases,
      compensationRate,
      totalCompensated,
      totalHosxp,
      totalDebit,
      withInvoiceCases,
      withRepCases,
      notSentCases,
    }

    // Filter by Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'AUDIT_PASS') {
      filtered = filtered.filter((it) => !it.hasError)
    } else if (cardFilter === 'AUDIT_ERROR') {
      filtered = filtered.filter((it) => it.hasError)
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((it) => it.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((it) => !it.isCompensated)
    } else if (cardFilter === 'WITH_INVOICE') {
      filtered = filtered.filter((it) => it.status.includes('Invoice') || it.money_invoice > 0)
    } else if (cardFilter === 'WITH_REP') {
      filtered = filtered.filter((it) => it.status.includes('Rep') || it.money_rep > 0)
    } else if (cardFilter === 'NOT_SENT') {
      filtered = filtered.filter((it) => it.status.startsWith('-') || it.status.includes('ยังไม่ส่ง'))
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)
    if (selectedReps.length > 0) {
      filtered = filtered.filter((it) => matchesRepFilter(it, selectedReps))
    }

    // Global Search across all relevant fields
    if (search) {
      filtered = filtered.filter((it) => {
        return (
          matchesSeamlessRepSearch(it, search) ||
          it.hn.toLowerCase().includes(search) ||
          it.cid.includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          (it.vn && it.vn.toLowerCase().includes(search)) ||
          (it.an && it.an.toLowerCase().includes(search)) ||
          (it.dx && it.dx.toLowerCase().includes(search)) ||
          (it.op && it.op.toLowerCase().includes(search)) ||
          it.drugname.toLowerCase().includes(search) ||
          it.pttypename.toLowerCase().includes(search) ||
          (it.department && it.department.toLowerCase().includes(search)) ||
          (it.clinic && it.clinic.toLowerCase().includes(search)) ||
          (it.ward && it.ward.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search)) ||
          it.status.toLowerCase().includes(search)
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '')
        if (cmp === 0 && a.vsttime && b.vsttime) {
          cmp = a.vsttime.localeCompare(b.vsttime)
        }
      } else if (sortBy === 'time') {
        cmp = (a.vsttime || '').localeCompare(b.vsttime || '')
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname, 'th')
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'drugname') {
        cmp = a.drugname.localeCompare(b.drugname)
      } else if (sortBy === 'money_hosxp') {
        cmp = a.money_hosxp - b.money_hosxp
      } else if (sortBy === 'debit') {
        cmp = a.debit - b.debit
      } else if (sortBy === 'money_eclaim') {
        cmp = a.money_eclaim - b.money_eclaim
      } else if (sortBy === 'money_rep') {
        cmp = a.money_rep - b.money_rep
      } else if (sortBy === 'money_invoice') {
        cmp = a.money_invoice - b.money_invoice
      } else if (sortBy === 'rep') {
        cmp = (a.rep || '').localeCompare(b.rep || '')
      } else if (sortBy === 'status') {
        cmp = a.status.localeCompare(b.status, 'th')
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed records
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      title,
      subtitle,
      patientType,
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
      items: pagedItems,
      repBreakdown,
    }
  }

  /**
   * รายละเอียดเวชระเบียนผู้ป่วยในระดับ Admission (AN Clinical Details) สำหรับ Detail Modal via API Gateway
   */
  static async getAnClinicalDetails(
    an: string,
    gateway: StreptokinaseGatewayAdapter = defaultStreptokinaseGateway
  ): Promise<AnClinicalDetails | null> {
    const cleanAn = (an || '').trim()
    if (!cleanAn) return null
    const fn = gateway.getAnClinicalDetails ?? defaultStreptokinaseGateway.getAnClinicalDetails!
    const res = await fn(cleanAn)
    return res?.data ?? null
  }
}
