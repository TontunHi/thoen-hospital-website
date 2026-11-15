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
   * Build unified SQL WHERE clause for repdata / repeclaim / seamless
   */
  private static buildWhereClause(
    source: RepDataSource,
    params: {
      rep?: string
      fiscalYear?: string
      ds1?: string
      ds2?: string
      department?: 'ALL' | 'OP' | 'IP'
      fund?: string | null
      subFund?: string | null
      status?: string
      errorCode?: string
      hn?: string
      search?: string | null
    }
  ): { whereSql: string; queryParams: any[] } {
    const isSeamless = source === 'seamless'
    const whereClauses: string[] = []
    const queryParams: any[] = []

    if (params.rep && params.rep.trim()) {
      whereClauses.push('Rep = ?')
      queryParams.push(params.rep.trim())
    }

    if (params.ds1 && params.ds2) {
      if (isSeamless) {
        whereClauses.push('AdmDate BETWEEN ? AND ?')
        queryParams.push(params.ds1, params.ds2)
      } else {
        whereClauses.push('COALESCE(AdmDate, DchDate) BETWEEN ? AND ?')
        queryParams.push(`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`)
      }
    } else if (params.fiscalYear) {
      whereClauses.push('YearBudget = ?')
      queryParams.push(params.fiscalYear)
    }

    if (params.department && params.department !== 'ALL') {
      if (isSeamless) {
        if (params.department === 'IP') {
          whereClauses.push("(Department = 'IP' OR (IFNULL(Department, '') = '' AND IFNULL(AN, '') <> ''))")
        } else {
          whereClauses.push("(Department = 'OP' OR (IFNULL(Department, '') = '' AND IFNULL(AN, '') = ''))")
        }
      } else {
        whereClauses.push('Department = ?')
        queryParams.push(params.department)
      }
    }

    if (params.fund && params.fund !== 'ALL') {
      const f = params.fund
      if (['UCS', 'OFC', 'SSS', 'LGO', 'STP'].includes(f)) {
        const col = isSeamless ? 'MainInscl' : 'Fund'
        if (f === 'OFC') {
          whereClauses.push(`(${col} LIKE '%CS%' OR ${col} LIKE '%OFC%')`)
        } else if (f === 'LGO') {
          whereClauses.push(`(${col} LIKE '%LG%' OR ${col} LIKE '%LGO%')`)
        } else if (f === 'SSS') {
          whereClauses.push(`(${col} LIKE '%SSS%' OR ${col} LIKE '%SS%')`)
        } else if (f === 'STP') {
          whereClauses.push(`${col} LIKE '%STP%'`)
        } else if (f === 'UCS') {
          whereClauses.push(
            isSeamless
              ? "(MainInscl IN ('UCS', 'WEL', 'UC') OR MainInscl LIKE '%UC%')"
              : "(Fund LIKE '%UC%' OR Fund LIKE 'IP0%' OR Fund LIKE 'OP0%' OR Fund LIKE 'HC%' OR Fund LIKE 'DM%' OR Fund LIKE 'AE%')"
          )
        }
      } else if (f === 'UNKNOWN') {
        whereClauses.push("(Fund IS NULL OR TRIM(Fund) = '')")
      } else {
        whereClauses.push('TRIM(Fund) = ?')
        queryParams.push(f.trim())
      }
    }

    if (!isSeamless && params.subFund && params.subFund !== 'ALL') {
      whereClauses.push('SubFund = ?')
      queryParams.push(params.subFund)
    }

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'paid' || params.status === 'compensated') {
        whereClauses.push('Compensated > 0')
      } else if (params.status === 'denied' || params.status === 'zero') {
        whereClauses.push('(Compensated = 0 OR Compensated IS NULL)')
      } else if (params.status === 'appeal') {
        whereClauses.push(
          isSeamless
            ? '(Compensated < Collected AND Compensated > 0)'
            : "(Appeal = 'Y' OR (Compensated < Income AND Compensated > 0))"
        )
      } else if (params.status === 'has_error') {
        whereClauses.push(
          isSeamless
            ? '(Note IS NOT NULL AND LENGTH(TRIM(Note)) > 0)'
            : '(ErrorCode IS NOT NULL AND LENGTH(TRIM(ErrorCode)) > 0)'
        )
      }
    }

    if (params.errorCode && params.errorCode !== 'ALL') {
      const cleanErr = params.errorCode.trim()
      whereClauses.push(isSeamless ? '(Note = ? OR Note LIKE ?)' : '(ErrorCode = ? OR ErrorCode LIKE ?)')
      queryParams.push(cleanErr, `%${cleanErr}%`)
    }

    if (params.hn && params.hn.trim()) {
      const cleanHn = params.hn.trim()
      whereClauses.push('(HN = ? OR HN LIKE ?)')
      queryParams.push(cleanHn, `%${cleanHn}`)
    }

    if (params.search && params.search.trim()) {
      const s = `%${params.search.trim()}%`
      if (isSeamless) {
        whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR Type LIKE ? OR Ptname LIKE ? OR HN LIKE ? OR Note LIKE ? OR PayNo LIKE ?)')
        queryParams.push(s, s, s, s, s, s, s)
      } else {
        whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR SubFund LIKE ? OR PtName LIKE ? OR HN LIKE ? OR ErrorCode LIKE ?)')
        queryParams.push(s, s, s, s, s, s)
      }
    }

    return {
      whereSql: whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1',
      queryParams,
    }
  }

  /**
   * Get list of available fiscal years for a given REP data source
   */
  static async getAvailableYears(sourceInput?: RepDataSource | string): Promise<string[]> {
    const source = normalizeRepSource(sourceInput)
    const tableName = REP_SOURCE_TABLES[source]

    return getCachedData(`rcm-rep-available-years-${source}`, async () => {
      // 1. Dual-Path: Named REST API first
      if (typeof (apiGateway.clinical as any).getRepFundsYears === 'function') {
        try {
          const res = await (apiGateway.clinical as any).getRepFundsYears(source)
          if (res?.success && Array.isArray(res?.data) && res.data.length > 0) {
            return res.data
          }
        } catch {
          // fallback to raw query
        }
      }

      // 2. Fallback to SQL query
      try {
        const rows = await apiGateway.clinical.query<{ YearBudget: string }>(`
          SELECT DISTINCT YearBudget 
          FROM ${tableName} 
          WHERE YearBudget IS NOT NULL AND TRIM(YearBudget) != '' 
          ORDER BY YearBudget DESC
        `)
        const list = rows.map((r) => String(r.YearBudget).trim()).filter(Boolean)
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
    const tableName = REP_SOURCE_TABLES[source]
    const isSeamless = source === 'seamless'
    const availableYears = await this.getAvailableYears(source)
    const fiscalYear = params.fiscalYear || availableYears[0] || getDynamicFallbackYears()[0]
    const department = params.department || 'ALL'
    const fund = params.fund && params.fund !== 'ALL' ? params.fund : null
    const subFund = params.subFund && params.subFund !== 'ALL' ? params.subFund : null
    const search = params.search ? params.search.trim() : null

    const cacheKey = `rcm-rep-summary-${source}-${fiscalYear}-${department}-${fund || ''}-${subFund || ''}-${params.status || ''}-${params.errorCode || ''}-${search || ''}-${params.ds1 || ''}-${params.ds2 || ''}`

    return getCachedData(cacheKey, async () => {
      // 1. Dual-Path: Named REST API first
      if (typeof (apiGateway.clinical as any).getRepFundsSummary === 'function') {
        try {
          const res = await (apiGateway.clinical as any).getRepFundsSummary({
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
          if (res?.success && res?.data) {
            const d = res.data
            const m = (d.metrics || {}) as any
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

            const availableFunds = (d.availableFunds || []).map((r: any) => ({
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
          }
        } catch {
          // fallback to raw query
        }
      }

      // 2. Fallback to parallel SQL queries
      const { whereSql, queryParams } = this.buildWhereClause(source, {
        fiscalYear,
        ds1: params.ds1,
        ds2: params.ds2,
        department,
        fund,
        subFund,
        status: params.status,
        errorCode: params.errorCode,
        search,
      })

      const metricsSql = isSeamless
        ? `
          SELECT
            COUNT(*) as totalCases,
            COUNT(DISTINCT NULLIF(TRIM(Rep), '')) as totalReps,
            COALESCE(ROUND(SUM(Collected), 2), 0) as totalIncome,
            COALESCE(ROUND(SUM(Compensated), 2), 0) as totalCompensated,
            COALESCE(ROUND(SUM(Compensated - Collected), 2), 0) as totalDiff,
            SUM(CASE WHEN Compensated < Collected AND Compensated > 0 THEN 1 ELSE 0 END) as pendingAppeals,
            SUM(CASE WHEN Note IS NOT NULL AND LENGTH(TRIM(Note)) > 0 THEN 1 ELSE 0 END) as errorCount
          FROM ${tableName}
          WHERE ${whereSql}
        `
        : `
          SELECT 
            COUNT(*) as totalCases,
            COUNT(DISTINCT NULLIF(TRIM(Rep), '')) as totalReps,
            COALESCE(ROUND(SUM(Income), 2), 0) as totalIncome,
            COALESCE(ROUND(SUM(Compensated), 2), 0) as totalCompensated,
            COALESCE(ROUND(SUM(Compensated - Income), 2), 0) as totalDiff,
            SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as pendingAppeals,
            SUM(CASE WHEN ErrorCode IS NOT NULL AND LENGTH(TRIM(ErrorCode)) > 0 THEN 1 ELSE 0 END) as errorCount
          FROM ${tableName}
          WHERE ${whereSql}
        `

      let availableFundsSql = `
        SELECT COALESCE(NULLIF(TRIM(Fund), ''), 'UNKNOWN') as fundKey, COUNT(*) as cnt
        FROM ${tableName}
      `
      let fundsQueryParams: any[] = []
      if (params.ds1 && params.ds2) {
        availableFundsSql += isSeamless
          ? ` WHERE AdmDate BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(TRIM(Fund), ''), 'UNKNOWN') ORDER BY cnt DESC`
          : ` WHERE COALESCE(AdmDate, DchDate) BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(TRIM(Fund), ''), 'UNKNOWN') ORDER BY cnt DESC`
        fundsQueryParams = isSeamless
          ? [params.ds1, params.ds2]
          : [`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`]
      } else {
        availableFundsSql += ` WHERE YearBudget = ? GROUP BY COALESCE(NULLIF(TRIM(Fund), ''), 'UNKNOWN') ORDER BY cnt DESC`
        fundsQueryParams = [fiscalYear]
      }

      const [metricsRows, fundRows] = await Promise.all([
        apiGateway.clinical.query<any>(metricsSql, queryParams),
        apiGateway.clinical.query<any>(availableFundsSql, fundsQueryParams),
      ])

      const m = metricsRows[0] || {}
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

      const availableFunds = (fundRows || []).map((r) => ({
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
    const tableName = REP_SOURCE_TABLES[source]
    const isSeamless = source === 'seamless'

    // 1. Dual-Path: Named REST API first
    if (typeof (apiGateway.clinical as any).getRepFundsCases === 'function') {
      try {
        const res = await (apiGateway.clinical as any).getRepFundsCases({ ...params, source })
        if (res?.success && Array.isArray(res?.data)) {
          return res.data.map((r: any) => this.mapClaimRecord(r, source))
        }
      } catch {
        // fallback to raw query
      }
    }

    // 2. Fallback to SQL query
    const effectiveParams = { ...params }
    if (
      !params.rep &&
      !(params.ds1 && params.ds2) &&
      !params.fiscalYear &&
      !params.hn &&
      !(params.search && params.search.trim())
    ) {
      effectiveParams.fiscalYear = getDynamicFallbackYears()[0]
    }

    const { whereSql, queryParams } = this.buildWhereClause(source, effectiveParams)

    const hasLimit = params.limit !== undefined ? Number(params.limit) > 0 : true
    const limit = hasLimit ? Math.max(Number(params.limit || 200), 1) : null
    const offset = Math.max(Number(params.offset || 0), 0)

    const sql = isSeamless
      ? `
        SELECT
          ID, Rep, HN, VN, AN, Ptname AS PtName, AdmDate,
          CASE
            WHEN Department = 'IP' OR (IFNULL(Department, '') = '' AND IFNULL(AN, '') <> '') THEN 'IP'
            ELSE 'OP'
          END AS Department,
          COALESCE(Collected, 0) AS Income,
          COALESCE(Compensated, 0) AS Compensated,
          (COALESCE(Compensated, 0) - COALESCE(Collected, 0)) AS Diff,
          Fund,
          Type AS SubFund,
          Note AS ErrorCode,
          'N' AS Appeal,
          YearBudget,
          MainInscl,
          Period,
          PayNo,
          PayDate,
          NoCompensated,
          PayMore,
          Recall,
          Status AS SeamlessStatus,
          STMID,
          FileName
        FROM ${tableName}
        WHERE ${whereSql}
        ORDER BY AdmDate DESC, ID DESC
        ${limit !== null ? 'LIMIT ? OFFSET ?' : ''}
      `
      : `
        SELECT 
          ID, Rep, HN, VN, AN, EclaimNo, PtName, AdmDate, DchDate, Department, 
          Income, Compensated, Diff, TRIM(Fund) AS Fund, SubFund, ErrorCode, Appeal, YearBudget, ProjectCode, MainInscl, FileName
        FROM ${tableName}
        WHERE ${whereSql}
        ORDER BY AdmDate DESC, ID DESC
        ${limit !== null ? 'LIMIT ? OFFSET ?' : ''}
      `

    if (limit !== null) {
      queryParams.push(limit, offset)
    }

    const rows = await apiGateway.clinical.query<any>(sql, queryParams)

    return rows.map((r) => this.mapClaimRecord(r, source))
  }

  /**
   * Search patient claims by HN, patient name, or service date
   */
  static async lookupPatientClaims(params: { hn?: string; ptName?: string; serviceDate?: string }): Promise<PatientClaimRecord[]> {
    // 1. Dual-Path: Named REST API first
    if (typeof (apiGateway.clinical as any).lookupPatientClaims === 'function') {
      try {
        const res = await (apiGateway.clinical as any).lookupPatientClaims(params)
        if (res?.success && Array.isArray(res?.data)) {
          return res.data.map((r: any) => this.mapClaimRecord(r))
        }
      } catch {
        // fallback to raw query
      }
    }

    // 2. Fallback to SQL query
    const whereClauses: string[] = []
    const queryParams: any[] = []

    if (params.hn && params.hn.trim()) {
      const cleanHn = params.hn.trim()
      whereClauses.push('(HN = ? OR HN LIKE ?)')
      queryParams.push(cleanHn, `%${cleanHn}`)
    }

    if (params.ptName && params.ptName.trim()) {
      whereClauses.push('PtName LIKE ?')
      queryParams.push(`%${params.ptName.trim()}%`)
    }

    if (params.serviceDate && params.serviceDate.trim()) {
      whereClauses.push('(DATE(AdmDate) = ? OR DATE(DchDate) = ?)')
      queryParams.push(params.serviceDate.trim(), params.serviceDate.trim())
    }

    if (whereClauses.length === 0) {
      return []
    }

    const sql = `
      SELECT 
        ID, Rep, HN, PtName, AdmDate, DchDate, Department, 
        Income, Compensated, Diff, Fund, SubFund, ErrorCode, Appeal, YearBudget, ProjectCode
      FROM rcmdb.repdata
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY AdmDate DESC
    `

    const rows = await apiGateway.clinical.query<any>(sql, queryParams)

    return rows.map((r) => this.mapClaimRecord(r))
  }
}

