import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'

export type RepDataSource = 'repdata' | 'repeclaim' | 'seamless'

export const REP_SOURCE_TABLES: Record<RepDataSource, string> = {
  repdata: 'rcmdb.repdata',
  repeclaim: 'rcmdb.repeclaim',
  seamless: 'rcmdb.seamless',
}

export const REP_DATA_SOURCES: Array<{
  id: RepDataSource
  label: string
  tableName: string
  shortLabel: string
  description: string
}> = [
  {
    id: 'repdata',
    label: 'REP หลัก (repdata)',
    tableName: 'rcmdb.repdata',
    shortLabel: 'repdata',
    description: 'ข้อมูล REP/STM หลักจาก สปสช. และกองทุนหลัก',
  },
  {
    id: 'repeclaim',
    label: 'REP e-Claim (repeclaim)',
    tableName: 'rcmdb.repeclaim',
    shortLabel: 'repeclaim',
    description: 'ข้อมูลตอบรับผลเคลมจากระบบ e-Claim / Statement',
  },
  {
    id: 'seamless',
    label: 'Seamless / DMIS (seamless)',
    tableName: 'rcmdb.seamless',
    shortLabel: 'seamless',
    description: 'ข้อมูลการชดเชยระบบ Seamless / กองทุนเฉพาะ (DDSA, DCCS, DANC, DTTM ฯลฯ)',
  },
]

export function normalizeRepSource(source?: string | null): RepDataSource {
  const s = String(source || '').trim().toLowerCase()
  if (s === 'repeclaim' || s === 'seamless') return s
  return 'repdata'
}

export function getDynamicFallbackYears(): string[] {
  const now = new Date()
  const fy = now.getFullYear() + 543 + (now.getMonth() + 1 >= 10 ? 1 : 0)
  return [String(fy), String(fy - 1), String(fy - 2), String(fy - 3)]
}

export interface PatientClaimRecord {
  id: string
  source?: RepDataSource
  rep: string
  hn: string
  maskedHn: string
  ptName: string
  serviceDate: string // YYYY-MM-DD
  serviceDateThai: string
  department: 'OP' | 'IP'
  departmentLabel: string
  mainInscl: string // UCS, OFC, SSS, LGO, STP, OTHER
  fund: string
  fundLabel: string
  subFund: string
  subFundLabel: string
  projectCode?: string
  income: number
  compensated: number
  diff: number
  percentPay: number
  errorCode?: string
  appeal?: 'Y' | 'N'
  status: 'paid' | 'appeal' | 'denied'
  vn?: string
  an?: string
  eclaimNo?: string
  period?: string
  payNo?: string
  payDate?: string
  payDateThai?: string
  noCompensated?: number
  payMore?: number
  recall?: number
  seamlessStatus?: string
  stmid?: string
  fileName?: string
}

export interface FundSummaryGroup {
  fundKey: string
  fundLabel: string
  subFundKey: string
  subFundLabel: string
  department: 'OP' | 'IP'
  caseCount: number
  totalIncome: number
  totalCompensated: number
  reimbursementRate: number // %
  netDiff: number
  appealCount: number
  errorCount: number
}

export interface RepStatementSummary {
  rep: string
  yearBudget: string
  department: 'OP' | 'IP'
  fund: string
  fundLabel: string
  caseCount: number
  totalIncome: number
  totalCompensated: number
  reimbursementRate: number
  netDiff: number
  minDate: string | null
  maxDate: string | null
  appealCount: number
  errorCount: number
}

export interface RepFundsSummaryMetrics {
  totalCases: number
  totalIncome: number
  totalCompensated: number
  rate: string
  totalDiff: number
  pendingAppeals: number
  errorCount: number
  totalReps: number
}

export interface RepFundsSummaryResult {
  source?: RepDataSource
  metrics: RepFundsSummaryMetrics
  fundGroups: FundSummaryGroup[]
  repList: RepStatementSummary[]
  availableYears: string[]
  availableFunds: Array<{ key: string; label: string; count: number }>
  availableErrorCodes: Array<{ code: string; count: number }>
}

export interface RepFundsSummaryParams {
  source?: RepDataSource
  fiscalYear?: string
  ds1?: string
  ds2?: string
  department?: 'ALL' | 'OP' | 'IP'
  fund?: string
  subFund?: string
  status?: string
  errorCode?: string
  search?: string
}

export interface RepCasesParams {
  source?: RepDataSource
  rep?: string
  fund?: string
  subFund?: string
  department?: 'ALL' | 'OP' | 'IP'
  fiscalYear?: string
  ds1?: string
  ds2?: string
  hn?: string
  status?: string
  errorCode?: string
  search?: string
  limit?: number
  offset?: number
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export function formatThaiDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-'
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return String(dateInput)
    const day = d.getDate()
    const month = THAI_MONTHS[d.getMonth()]
    const year = d.getFullYear() + 543
    return `${day} ${month} ${year}`
  } catch {
    return String(dateInput)
  }
}

export function formatDateYMD(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

export function maskHn(hn: string | null | undefined): string {
  if (!hn) return 'xx-xxxxx'
  const str = hn.trim()
  if (str.length <= 3) return `xx-${str}`
  const last2 = str.slice(-2)
  return `xx-xxx${last2}`
}

export function resolveMainInscl(fund: string | null | undefined): string {
  if (!fund) return 'UCS'
  const f = fund.toUpperCase()
  if (f.includes('CS') || f.includes('OFC')) return 'OFC'
  if (f.includes('LG') || f.includes('LGO')) return 'LGO'
  if (f.includes('SSS') || f.includes('SS')) return 'SSS'
  if (f.includes('STP')) return 'STP'
  return 'UCS'
}

export function formatFundLabel(fund: string | null | undefined): string {
  if (!fund || fund.trim() === '') return 'ไม่ระบุกองทุน'
  const f = fund.trim().toUpperCase()
  if (f === 'UCS') return 'บัตรทอง (UCS)'
  if (f === 'OFC') return 'ข้าราชการ (OFC)'
  if (f === 'SSS') return 'ประกันสังคม (SSS)'
  if (f === 'LGO') return 'อปท. (LGO)'
  if (f === 'STP') return 'สถานะและสิทธิ (STP)'
  if (f.includes('CS')) return `ข้าราชการ (${fund})`
  if (f.includes('LG')) return `อปท. (${fund})`
  if (f.startsWith('IP01') || f.startsWith('IP02') || f.startsWith('OP01')) return `บัตรทอง (${fund})`
  if (f.startsWith('HC')) return `ค่าใช้จ่ายสูง (${fund})`
  if (f.startsWith('DM')) return `บริการเฉพาะ/เรื้อรัง (${fund})`
  if (f.startsWith('AE')) return `ฉุกเฉิน/ส่งต่อ (${fund})`
  return fund
}

export function formatSubFundLabel(subFund: string | null | undefined): string {
  if (!subFund || subFund.trim() === '' || subFund === '-' || subFund === 'null') return '-'
  return subFund
}

export class RcmRepFundsService {
  private static mapClaimRecord(r: any, source: RepDataSource = 'repdata'): PatientClaimRecord {
    const income = Number(r.Income ?? r.income ?? r.Collected ?? r.collected ?? 0)
    const compensated = Number(r.Compensated ?? r.compensated ?? 0)
    const diff = Number(r.Diff ?? r.diff ?? (compensated - income))
    const percentPay = income > 0 ? Math.round((compensated / income) * 100) : (compensated > 0 ? 100 : 0)

    let status: 'paid' | 'appeal' | 'denied' = 'paid'
    const appealVal = r.Appeal ?? r.appeal
    if (appealVal === 'Y') {
      status = 'appeal'
    } else if (compensated === 0 || compensated === null) {
      status = 'denied'
    } else if (compensated > 0) {
      status = 'paid'
    }

    const sDate = r.AdmDate || r.DchDate || r.admdate || r.dchdate
    const serviceDate = formatDateYMD(sDate)
    const serviceDateThai = formatThaiDate(sDate)

    const hn = String(r.HN ?? r.hn ?? '').trim()
    const rep = String(r.Rep ?? r.rep ?? '').trim()
    const fund = String(r.Fund ?? r.fund ?? '').trim()
    const subFund = String(r.SubFund ?? r.subFund ?? r.Type ?? r.type ?? '-').trim()
    const dept = (r.Department ?? r.department) === 'IP' ? 'IP' : 'OP'
    const rawMainInscl = r.MainInscl ?? r.mainInscl
    const payDateRaw = r.PayDate ?? r.payDate

    return {
      id: String(r.ID ?? r.id ?? `${rep}:${hn}`),
      source,
      rep,
      hn,
      maskedHn: maskHn(hn),
      ptName: String(r.PtName ?? r.Ptname ?? r.ptName ?? '').trim(),
      serviceDate,
      serviceDateThai,
      department: dept,
      departmentLabel: dept === 'IP' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)',
      mainInscl: rawMainInscl ? resolveMainInscl(String(rawMainInscl)) : resolveMainInscl(fund),
      fund,
      fundLabel: formatFundLabel(fund),
      subFund: subFund || '-',
      subFundLabel: formatSubFundLabel(subFund),
      projectCode: (r.ProjectCode ?? r.projectCode) ? String(r.ProjectCode ?? r.projectCode) : undefined,
      income,
      compensated,
      diff,
      percentPay,
      errorCode: (r.ErrorCode ?? r.errorCode ?? r.Note ?? r.note)
        ? String(r.ErrorCode ?? r.errorCode ?? r.Note ?? r.note).trim() || undefined
        : undefined,
      appeal: appealVal === 'Y' ? 'Y' : 'N',
      status,
      vn: r.VN ?? r.vn ? String(r.VN ?? r.vn).trim() : undefined,
      an: r.AN ?? r.an ? String(r.AN ?? r.an).trim() : undefined,
      eclaimNo: r.EclaimNo ?? r.eclaimNo ? String(r.EclaimNo ?? r.eclaimNo).trim() : undefined,
      period: r.Period ?? r.period ? String(r.Period ?? r.period).trim() : undefined,
      payNo: r.PayNo ?? r.payNo ? String(r.PayNo ?? r.payNo).trim() : undefined,
      payDate: payDateRaw ? formatDateYMD(payDateRaw) : undefined,
      payDateThai: payDateRaw ? formatThaiDate(payDateRaw) : undefined,
      noCompensated: r.NoCompensated !== undefined ? Number(r.NoCompensated || 0) : undefined,
      payMore: r.PayMore !== undefined ? Number(r.PayMore || 0) : undefined,
      recall: r.Recall !== undefined ? Number(r.Recall || 0) : undefined,
      seamlessStatus: r.SeamlessStatus ?? r.seamlessStatus ? String(r.SeamlessStatus ?? r.seamlessStatus).trim() : undefined,
      stmid: r.STMID ?? r.stmid ? String(r.STMID ?? r.stmid).trim() : undefined,
      fileName: r.FileName ?? r.fileName ? String(r.FileName ?? r.fileName).trim() : undefined,
    }
  }

  /**
   * Get list of available fiscal years for a given REP data source
   */
  static async getAvailableYears(sourceInput?: RepDataSource | string): Promise<string[]> {
    const source = normalizeRepSource(sourceInput)

    return getCachedData(`rcm-rep-available-years-${source}`, async () => {
      try {
        const res = await apiGateway.clinical.getRepFundsYears(source)
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
        return list.length > 0 ? list : getDynamicFallbackYears()
      } catch {
        return getDynamicFallbackYears()
      }
    }, 60000)
  }

  /**
   * Summarize Rep and Fund compensation data for a given source & timeframe
   */
  static async getRepFundsSummary(params: RepFundsSummaryParams = {}): Promise<RepFundsSummaryResult> {
    const source = normalizeRepSource(params.source)
    const availableYears = await this.getAvailableYears(source)
    const fiscalYear = params.fiscalYear || availableYears[0] || getDynamicFallbackYears()[0]
    const department = params.department || 'ALL'
    const fund = params.fund && params.fund !== 'ALL' ? params.fund : null
    const subFund = params.subFund && params.subFund !== 'ALL' ? params.subFund : null
    const search = params.search ? params.search.trim() : null

    const cacheKey = `rcm-rep-summary-${source}-${fiscalYear}-${department}-${fund || ''}-${subFund || ''}-${params.status || ''}-${params.errorCode || ''}-${search || ''}-${params.ds1 || ''}-${params.ds2 || ''}`

    return getCachedData(cacheKey, async () => {
      const res = await apiGateway.clinical.getRepFundsSummary({
        source,
        fiscalYear,
        department,
        fund: fund || undefined,
        subFund: subFund || undefined,
        status: params.status || undefined,
        errorCode: params.errorCode || undefined,
        search: search || undefined,
        ds1: params.ds1,
        ds2: params.ds2,
      })

      const d = (res?.data || {}) as {
        metrics?: Record<string, unknown>
        availableFunds?: Array<{ fundKey: string; cnt: number }>
      }
      const m = d.metrics || {}
      const totalIncome = Number(m.totalIncome || 0)
      const totalCompensated = Number(m.totalCompensated || 0)
      const rate = totalIncome > 0 ? ((totalCompensated / totalIncome) * 100).toFixed(1) : '0.0'

      const metrics: RepFundsSummaryMetrics = {
        totalCases: Number(m.totalCases || 0),
        totalReps: Number(m.totalReps || 0),
        totalIncome,
        totalCompensated,
        rate,
        totalDiff: Number(m.totalDiff || 0),
        pendingAppeals: Number(m.pendingAppeals || 0),
        errorCount: Number(m.errorCount || 0),
      }

      const availableFunds = (d.availableFunds || []).map((r) => ({
        key: String(r.fundKey),
        label: `${formatFundLabel(r.fundKey)} (${Number(r.cnt).toLocaleString('th-TH')})`,
        count: Number(r.cnt || 0),
      }))

      return {
        source,
        metrics,
        fundGroups: [],
        repList: [],
        availableYears,
        availableFunds,
        availableErrorCodes: [],
      }
    }, 30000)
  }

  /**
   * Get patient individual claim cases for a given source (repdata / repeclaim / seamless)
   */
  static async getRepCases(params: RepCasesParams): Promise<PatientClaimRecord[]> {
    const source = normalizeRepSource(params.source)
    const effectiveParams: RepCasesParams = { ...params, source }
    if (
      !params.rep &&
      !(params.ds1 && params.ds2) &&
      !params.fiscalYear &&
      !params.hn &&
      !(params.search && params.search.trim())
    ) {
      effectiveParams.fiscalYear = getDynamicFallbackYears()[0]
    }

    const res = await apiGateway.clinical.getRepFundsCases({
      source,
      rep: effectiveParams.rep,
      fund: effectiveParams.fund,
      subFund: effectiveParams.subFund,
      department: effectiveParams.department,
      fiscalYear: effectiveParams.fiscalYear,
      ds1: effectiveParams.ds1,
      ds2: effectiveParams.ds2,
      hn: effectiveParams.hn,
      status: effectiveParams.status,
      errorCode: effectiveParams.errorCode,
      search: effectiveParams.search,
      limit: effectiveParams.limit,
      offset: effectiveParams.offset,
    })

    const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
    return rows.map((r) => this.mapClaimRecord(r, source))
  }

  /**
   * Search patient claims by HN, patient name, or service date
   */
  static async lookupPatientClaims(params: { hn?: string; ptName?: string; serviceDate?: string }): Promise<PatientClaimRecord[]> {
    if (!params.hn?.trim() && !params.ptName?.trim() && !params.serviceDate?.trim()) {
      return []
    }
    const res = await apiGateway.clinical.lookupPatientClaims(params)
    const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
    return rows.map((r) => this.mapClaimRecord(r))
  }
}

