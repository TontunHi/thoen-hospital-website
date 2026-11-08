import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'

export interface PatientClaimRecord {
  id: string
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
  metrics: RepFundsSummaryMetrics
  fundGroups: FundSummaryGroup[]
  repList: RepStatementSummary[]
  availableYears: string[]
  availableFunds: Array<{ key: string; label: string; count: number }>
  availableErrorCodes: Array<{ code: string; count: number }>
}

export interface RepFundsSummaryParams {
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
  /**
   * Get list of available fiscal years from rcmdb.repdata
   */
  static async getAvailableYears(): Promise<string[]> {
    return getCachedData('rcm-rep-available-years', async () => {
      try {
        const rows = await apiGateway.clinical.query<{ YearBudget: string }>(`
          SELECT DISTINCT YearBudget 
          FROM rcmdb.repdata 
          WHERE YearBudget IS NOT NULL AND YearBudget != '' 
          ORDER BY YearBudget DESC
        `)
        const list = rows.map((r) => String(r.YearBudget).trim()).filter(Boolean)
        return list.length > 0 ? list : ['2570', '2569', '2568', '2567']
      } catch {
        return ['2570', '2569', '2568', '2567']
      }
    }, 60000)
  }

  /**
   * Summarize Rep and Fund compensation data for a given fiscal year
   */
  static async getRepFundsSummary(params: RepFundsSummaryParams = {}): Promise<RepFundsSummaryResult> {
    const availableYears = await this.getAvailableYears()
    const fiscalYear = params.fiscalYear || availableYears[0] || '2570'
    const department = params.department || 'ALL'
    const fund = params.fund && params.fund !== 'ALL' ? params.fund : null
    const subFund = params.subFund && params.subFund !== 'ALL' ? params.subFund : null
    const search = params.search ? params.search.trim() : null

    const cacheKey = `rcm-rep-summary-${fiscalYear}-${department}-${fund || ''}-${subFund || ''}-${search || ''}-${params.ds1 || ''}-${params.ds2 || ''}`

    return getCachedData(cacheKey, async () => {
      // Base filters
    const whereClauses: string[] = []
    const queryParams: any[] = []

    if (params.ds1 && params.ds2) {
      whereClauses.push('COALESCE(AdmDate, DchDate) BETWEEN ? AND ?')
      queryParams.push(`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`)
    } else {
      whereClauses.push('YearBudget = ?')
      queryParams.push(fiscalYear)
    }

    if (department !== 'ALL') {
      whereClauses.push('Department = ?')
      queryParams.push(department)
    }

    if (fund) {
      if (['UCS', 'OFC', 'SSS', 'LGO', 'STP'].includes(fund)) {
        if (fund === 'OFC') {
          whereClauses.push("(Fund LIKE '%CS%' OR Fund LIKE '%OFC%')")
        } else if (fund === 'LGO') {
          whereClauses.push("(Fund LIKE '%LG%' OR Fund LIKE '%LGO%')")
        } else if (fund === 'SSS') {
          whereClauses.push("(Fund LIKE '%SSS%' OR Fund LIKE '%SS%')")
        } else if (fund === 'STP') {
          whereClauses.push("Fund LIKE '%STP%'")
        } else if (fund === 'UCS') {
          whereClauses.push("(Fund LIKE '%UC%' OR Fund LIKE 'IP0%' OR Fund LIKE 'OP0%' OR Fund LIKE 'HC%' OR Fund LIKE 'DM%' OR Fund LIKE 'AE%')")
        }
      } else {
        whereClauses.push('Fund = ?')
        queryParams.push(fund)
      }
    }

    if (subFund) {
      whereClauses.push('SubFund = ?')
      queryParams.push(subFund)
    }

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'paid' || params.status === 'compensated') {
        whereClauses.push('Compensated > 0')
      } else if (params.status === 'denied' || params.status === 'zero') {
        whereClauses.push('(Compensated = 0 OR Compensated IS NULL)')
      } else if (params.status === 'appeal') {
        whereClauses.push("(Appeal = 'Y' OR (Compensated < Income AND Compensated > 0))")
      } else if (params.status === 'has_error') {
        whereClauses.push('(ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0)')
      }
    }

    if (params.errorCode && params.errorCode !== 'ALL') {
      whereClauses.push('(ErrorCode = ? OR ErrorCode LIKE ?)')
      const cleanErr = params.errorCode.trim()
      queryParams.push(cleanErr, `%${cleanErr}%`)
    }

    if (search) {
      whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR SubFund LIKE ? OR PtName LIKE ? OR HN LIKE ? OR ErrorCode LIKE ?)')
      const s = `%${search}%`
      queryParams.push(s, s, s, s, s, s)
    }

    const whereSql = whereClauses.join(' AND ')

    // 1. Overall KPI Metrics
    const metricsSql = `
      SELECT 
        COUNT(*) as totalCases,
        COUNT(DISTINCT Rep) as totalReps,
        COALESCE(ROUND(SUM(Income), 2), 0) as totalIncome,
        COALESCE(ROUND(SUM(Compensated), 2), 0) as totalCompensated,
        COALESCE(ROUND(SUM(Compensated - Income), 2), 0) as totalDiff,
        SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as pendingAppeals,
        SUM(CASE WHEN ErrorCode IS NOT NULL AND ErrorCode != '' THEN 1 ELSE 0 END) as errorCount
      FROM rcmdb.repdata
      WHERE ${whereSql}
    `
    const metricsRows = await apiGateway.clinical.query<any>(metricsSql, queryParams)
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

    // 2. Fund Groups Breakdown
    const fundGroupsSql = `
      SELECT 
        COALESCE(Fund, 'UNKNOWN') as fundKey,
        COALESCE(SubFund, '-') as subFundKey,
        Department as department,
        COUNT(*) as caseCount,
        ROUND(SUM(Income), 2) as totalIncome,
        ROUND(SUM(Compensated), 2) as totalCompensated,
        ROUND(SUM(Compensated - Income), 2) as netDiff,
        SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as appealCount,
        SUM(CASE WHEN ErrorCode IS NOT NULL AND ErrorCode != '' THEN 1 ELSE 0 END) as errorCount
      FROM rcmdb.repdata
      WHERE ${whereSql}
      GROUP BY Fund, SubFund, Department
      ORDER BY totalCompensated DESC
      LIMIT 150
    `
    const fundGroupRows = await apiGateway.clinical.query<any>(fundGroupsSql, queryParams)
    const fundGroups: FundSummaryGroup[] = fundGroupRows.map((r) => {
      const inc = Number(r.totalIncome || 0)
      const comp = Number(r.totalCompensated || 0)
      const reimbRate = inc > 0 ? Math.round((comp / inc) * 1000) / 10 : 0
      return {
        fundKey: String(r.fundKey),
        fundLabel: formatFundLabel(r.fundKey),
        subFundKey: String(r.subFundKey),
        subFundLabel: formatSubFundLabel(r.subFundKey),
        department: r.department === 'IP' ? 'IP' : 'OP',
        caseCount: Number(r.caseCount || 0),
        totalIncome: inc,
        totalCompensated: comp,
        reimbursementRate: reimbRate,
        netDiff: Number(r.netDiff || 0),
        appealCount: Number(r.appealCount || 0),
        errorCount: Number(r.errorCount || 0),
      }
    })

    // 3. Statement-level Rep List
    const repListSql = `
      SELECT 
        Rep as rep,
        YearBudget as yearBudget,
        Department as department,
        COALESCE(Fund, '-') as fund,
        COUNT(*) as caseCount,
        ROUND(SUM(Income), 2) as totalIncome,
        ROUND(SUM(Compensated), 2) as totalCompensated,
        ROUND(SUM(Compensated - Income), 2) as netDiff,
        MIN(AdmDate) as minDate,
        MAX(DchDate) as maxDate,
        SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as appealCount,
        SUM(CASE WHEN ErrorCode IS NOT NULL AND ErrorCode != '' THEN 1 ELSE 0 END) as errorCount
      FROM rcmdb.repdata
      WHERE ${whereSql}
      GROUP BY Rep, YearBudget, Department, Fund
      ORDER BY totalCompensated DESC
      LIMIT 100
    `
    const repListRows = await apiGateway.clinical.query<any>(repListSql, queryParams)
    const repList: RepStatementSummary[] = repListRows.map((r) => {
      const inc = Number(r.totalIncome || 0)
      const comp = Number(r.totalCompensated || 0)
      const reimbRate = inc > 0 ? Math.round((comp / inc) * 1000) / 10 : 0
      return {
        rep: String(r.rep || ''),
        yearBudget: String(r.yearBudget || fiscalYear),
        department: r.department === 'IP' ? 'IP' : 'OP',
        fund: String(r.fund || '-'),
        fundLabel: formatFundLabel(r.fund),
        caseCount: Number(r.caseCount || 0),
        totalIncome: inc,
        totalCompensated: comp,
        reimbursementRate: reimbRate,
        netDiff: Number(r.netDiff || 0),
        minDate: r.minDate ? String(r.minDate) : null,
        maxDate: r.maxDate ? String(r.maxDate) : null,
        appealCount: Number(r.appealCount || 0),
        errorCount: Number(r.errorCount || 0),
      }
    })

    // 4. Distinct Available Funds in selected timeframe
    let availableFundsSql = `
      SELECT 
        COALESCE(Fund, 'UNKNOWN') as fundKey,
        COUNT(*) as cnt
      FROM rcmdb.repdata
    `
    let fundsQueryParams: any[] = []
    if (params.ds1 && params.ds2) {
      availableFundsSql += `
        WHERE COALESCE(AdmDate, DchDate) BETWEEN ? AND ?
        GROUP BY Fund
        ORDER BY cnt DESC
        LIMIT 50
      `
      fundsQueryParams = [`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`]
    } else {
      availableFundsSql += `
        WHERE YearBudget = ?
        GROUP BY Fund
        ORDER BY cnt DESC
        LIMIT 50
      `
      fundsQueryParams = [fiscalYear]
    }
    const fundRows = await apiGateway.clinical.query<any>(availableFundsSql, fundsQueryParams)
    const availableFunds = fundRows.map((r) => ({
      key: String(r.fundKey),
      label: `${formatFundLabel(r.fundKey)} (${Number(r.cnt).toLocaleString('th-TH')})`,
      count: Number(r.cnt || 0),
    }))

    // 5. Distinct Available Error Codes in selected timeframe
    let availableErrorCodesSql = `
      SELECT 
        ErrorCode as code,
        COUNT(*) as cnt
      FROM rcmdb.repdata
    `
    let errQueryParams: any[] = []
    if (params.ds1 && params.ds2) {
      availableErrorCodesSql += `
        WHERE COALESCE(AdmDate, DchDate) BETWEEN ? AND ? AND ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0
        GROUP BY ErrorCode
        ORDER BY cnt DESC
        LIMIT 50
      `
      errQueryParams = [`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`]
    } else {
      availableErrorCodesSql += `
        WHERE YearBudget = ? AND ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0
        GROUP BY ErrorCode
        ORDER BY cnt DESC
        LIMIT 50
      `
      errQueryParams = [fiscalYear]
    }
    let availableErrorCodes: Array<{ code: string; count: number }> = []
    try {
      const errRows = await apiGateway.clinical.query<any>(availableErrorCodesSql, errQueryParams)
      availableErrorCodes = errRows.map((r) => ({
        code: String(r.code),
        count: Number(r.cnt || 0),
      }))
    } catch {
      availableErrorCodes = []
    }

      return {
        metrics,
        fundGroups,
        repList,
        availableYears,
        availableFunds,
        availableErrorCodes,
      }
    }, 30000)
  }

  /**
   * Get patient individual claim cases under a specific Rep or Fund group
   * Directly answers: "Rep นี้เป็นของใครเลย ได้เท่าไหร่ด้วย"
   */
  static async getRepCases(params: RepCasesParams): Promise<PatientClaimRecord[]> {
    const whereClauses: string[] = []
    const queryParams: any[] = []

    if (params.rep) {
      whereClauses.push('Rep = ?')
      queryParams.push(params.rep.trim())
    }

    if (params.ds1 && params.ds2) {
      whereClauses.push('COALESCE(AdmDate, DchDate) BETWEEN ? AND ?')
      queryParams.push(`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`)
    } else if (params.fiscalYear) {
      whereClauses.push('YearBudget = ?')
      queryParams.push(params.fiscalYear)
    }

    if (params.department && params.department !== 'ALL') {
      whereClauses.push('Department = ?')
      queryParams.push(params.department)
    }

    if (params.fund && params.fund !== 'ALL') {
      if (['UCS', 'OFC', 'SSS', 'LGO', 'STP'].includes(params.fund)) {
        if (params.fund === 'OFC') {
          whereClauses.push("(Fund LIKE '%CS%' OR Fund LIKE '%OFC%')")
        } else if (params.fund === 'LGO') {
          whereClauses.push("(Fund LIKE '%LG%' OR Fund LIKE '%LGO%')")
        } else if (params.fund === 'SSS') {
          whereClauses.push("(Fund LIKE '%SSS%' OR Fund LIKE '%SS%')")
        } else if (params.fund === 'STP') {
          whereClauses.push("Fund LIKE '%STP%'")
        } else if (params.fund === 'UCS') {
          whereClauses.push("(Fund LIKE '%UC%' OR Fund LIKE 'IP0%' OR Fund LIKE 'OP0%' OR Fund LIKE 'HC%' OR Fund LIKE 'DM%' OR Fund LIKE 'AE%')")
        }
      } else {
        whereClauses.push('Fund = ?')
        queryParams.push(params.fund)
      }
    }

    if (params.subFund && params.subFund !== 'ALL') {
      whereClauses.push('SubFund = ?')
      queryParams.push(params.subFund)
    }

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'paid' || params.status === 'compensated') {
        whereClauses.push('Compensated > 0')
      } else if (params.status === 'denied' || params.status === 'zero') {
        whereClauses.push('(Compensated = 0 OR Compensated IS NULL)')
      } else if (params.status === 'appeal') {
        whereClauses.push("(Appeal = 'Y' OR (Compensated < Income AND Compensated > 0))")
      } else if (params.status === 'has_error') {
        whereClauses.push('(ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0)')
      }
    }

    if (params.errorCode && params.errorCode !== 'ALL') {
      whereClauses.push('(ErrorCode = ? OR ErrorCode LIKE ?)')
      const cleanErr = params.errorCode.trim()
      queryParams.push(cleanErr, `%${cleanErr}%`)
    }

    if (params.hn) {
      whereClauses.push('(HN = ? OR HN LIKE ?)')
      const cleanHn = params.hn.trim()
      queryParams.push(cleanHn, `%${cleanHn}`)
    }

    if (params.search && params.search.trim()) {
      whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR SubFund LIKE ? OR PtName LIKE ? OR HN LIKE ? OR ErrorCode LIKE ?)')
      const s = `%${params.search.trim()}%`
      queryParams.push(s, s, s, s, s, s)
    }

    if (whereClauses.length === 0) {
      // Safety guard against unrestricted full table scan
      whereClauses.push('YearBudget = ?')
      queryParams.push('2570')
    }

    const limit = Math.min(Math.max(Number(params.limit || 200), 1), 1000)
    const offset = Math.max(Number(params.offset || 0), 0)

    const sql = `
      SELECT 
        ID, Rep, HN, PtName, AdmDate, DchDate, Department, 
        Income, Compensated, Diff, Fund, SubFund, ErrorCode, Appeal, YearBudget, ProjectCode
      FROM rcmdb.repdata
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY AdmDate DESC, ID DESC
      LIMIT ? OFFSET ?
    `

    queryParams.push(limit, offset)

    const rows = await apiGateway.clinical.query<any>(sql, queryParams)

    return rows.map((r) => {
      const income = Number(r.Income || 0)
      const compensated = Number(r.Compensated || 0)
      const diff = Number(r.Diff ?? (compensated - income))
      const percentPay = income > 0 ? Math.round((compensated / income) * 100) : (compensated > 0 ? 100 : 0)

      let status: 'paid' | 'appeal' | 'denied' = 'paid'
      if (r.Appeal === 'Y') {
        status = 'appeal'
      } else if (compensated === 0 || compensated === null) {
        status = 'denied'
      } else if (compensated > 0) {
        status = 'paid'
      }

      const sDate = r.AdmDate || r.DchDate
      const serviceDate = formatDateYMD(sDate)
      const serviceDateThai = formatThaiDate(sDate)

      return {
        id: String(r.ID || `${r.Rep}:${r.HN}`),
        rep: String(r.Rep || ''),
        hn: String(r.HN || ''),
        maskedHn: maskHn(r.HN),
        ptName: String(r.PtName || '').trim(),
        serviceDate,
        serviceDateThai,
        department: r.Department === 'IP' ? 'IP' : 'OP',
        departmentLabel: r.Department === 'IP' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)',
        mainInscl: resolveMainInscl(r.Fund),
        fund: String(r.Fund || ''),
        fundLabel: formatFundLabel(r.Fund),
        subFund: String(r.SubFund || '-'),
        subFundLabel: formatSubFundLabel(r.SubFund),
        projectCode: r.ProjectCode ? String(r.ProjectCode) : undefined,
        income,
        compensated,
        diff,
        percentPay,
        errorCode: r.ErrorCode ? String(r.ErrorCode) : undefined,
        appeal: r.Appeal === 'Y' ? 'Y' : 'N',
        status,
      }
    })
  }

  /**
   * Search patient claims by HN, patient name, or service date
   */
  static async lookupPatientClaims(params: { hn?: string; ptName?: string; serviceDate?: string }): Promise<PatientClaimRecord[]> {
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
      LIMIT 50
    `

    const rows = await apiGateway.clinical.query<any>(sql, queryParams)

    return rows.map((r) => {
      const income = Number(r.Income || 0)
      const compensated = Number(r.Compensated || 0)
      const diff = Number(r.Diff ?? (compensated - income))
      const percentPay = income > 0 ? Math.round((compensated / income) * 100) : (compensated > 0 ? 100 : 0)

      let status: 'paid' | 'appeal' | 'denied' = 'paid'
      if (r.Appeal === 'Y') {
        status = 'appeal'
      } else if (compensated === 0 || compensated === null) {
        status = 'denied'
      } else if (compensated > 0) {
        status = 'paid'
      }

      const sDate = r.AdmDate || r.DchDate
      const serviceDate = formatDateYMD(sDate)
      const serviceDateThai = formatThaiDate(sDate)

      return {
        id: String(r.ID || `${r.Rep}:${r.HN}`),
        rep: String(r.Rep || ''),
        hn: String(r.HN || ''),
        maskedHn: maskHn(r.HN),
        ptName: String(r.PtName || '').trim(),
        serviceDate,
        serviceDateThai,
        department: r.Department === 'IP' ? 'IP' : 'OP',
        departmentLabel: r.Department === 'IP' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)',
        mainInscl: resolveMainInscl(r.Fund),
        fund: String(r.Fund || ''),
        fundLabel: formatFundLabel(r.Fund),
        subFund: String(r.SubFund || '-'),
        subFundLabel: formatSubFundLabel(r.SubFund),
        projectCode: r.ProjectCode ? String(r.ProjectCode) : undefined,
        income,
        compensated,
        diff,
        percentPay,
        errorCode: r.ErrorCode ? String(r.ErrorCode) : undefined,
        appeal: r.Appeal === 'Y' ? 'Y' : 'N',
        status,
      }
    })
  }
}
