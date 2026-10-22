import { queryMemberDb } from '@/lib/memberDb'
import { querySalaryDb, querySalaryEditDb } from '@/lib/salaryDb'

export interface SalaryLedgerOptions {
  targetUsername: string
  selectedYear?: string | null
  selectedMonth?: string | null
}

export interface SalaryLedgerResult {
  success: boolean
  notFound?: boolean
  error?: string
  member?: {
    id: number
    username: string
    name: string
    department: string
    position: string
    salary_user: string
  }
  years?: string[]
  periods?: string[]
  selectedYear?: string
  selectedMonth?: string
  salary?: any
  ot?: any
  calendar?: any[]
  hasRecords?: boolean
}

type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

export class SalaryLedgerService {
  constructor(
    private memberDb: QueryExecutor = queryMemberDb,
    private salaryDb: QueryExecutor = querySalaryDb,
    private salaryEditDb: QueryExecutor = querySalaryEditDb
  ) {}

  async getEmployeeSalaryLedger(options: SalaryLedgerOptions): Promise<SalaryLedgerResult> {
    const { targetUsername, selectedYear, selectedMonth } = options

    // 1. Find target member in memberDb (safely omitting sensitive password fields)
    const memberRows = await this.memberDb(
      'SELECT id, username, email, name, department, position, salary_user FROM members WHERE username = ? OR salary_user = ? LIMIT 1',
      [targetUsername, targetUsername]
    )

    const targetMember = memberRows && memberRows.length > 0 ? memberRows[0] : null
    const salaryLookupId = targetMember?.salary_user || targetUsername

    // 2. Fetch salary and OT records
    const [salaryRows, otRows] = await Promise.all([
      this.salaryDb('SELECT * FROM salary WHERE c2 = ? ORDER BY c1 DESC', [salaryLookupId]),
      this.salaryDb('SELECT * FROM ot WHERE c2 = ? ORDER BY c1 DESC', [salaryLookupId]),
    ])

    if ((!salaryRows || salaryRows.length === 0) && (!otRows || otRows.length === 0) && !targetMember) {
      return {
        success: false,
        notFound: true,
        error: `ไม่พบข้อมูลเงินเดือนสำหรับรหัส "${targetUsername}"`,
      }
    }

    // 3. Calendar records for pay dates
    let calendarRows: any[] = []
    try {
      calendarRows = await this.salaryEditDb(
        'SELECT id, type, datein, notesalary FROM datein WHERE MONTH(datein) = MONTH(NOW()) AND YEAR(datein) = YEAR(NOW()) ORDER BY ABS(DAY(datein)) ASC'
      )
    } catch {
      calendarRows = []
    }

    // 4. Map periods in-memory
    const periods = new Set<string>()

    const mappedSalaries = (salaryRows || []).map((row) => {
      const cleanedPeriod = row.c8 ? row.c8.replace(/\s+/g, ' ').trim() : ''
      if (cleanedPeriod) periods.add(cleanedPeriod)
      return {
        ...row,
        computedPeriod: cleanedPeriod,
      }
    })

    const mappedOts = (otRows || []).map((row) => {
      if (!row.c10 || !row.c1) return { ...row, computedPeriod: '' }

      const otMonth = row.c10.trim()
      const payDate = new Date(row.c1)
      const payYear = payDate.getFullYear() + 543
      const payMonth = payDate.getMonth()

      let otYear = payYear
      if (payMonth === 0 && otMonth === 'ธันวาคม') {
        otYear = payYear - 1
      }

      const computedPeriod = `${otMonth} ${otYear}`
      periods.add(computedPeriod)
      return {
        ...row,
        computedPeriod,
      }
    })

    // Parse and sort periods
    const parsedPeriods = Array.from(periods)
      .map((p) => {
        const parts = p.split(/\s+/)
        return {
          month: parts[0],
          year: parts[1],
          original: p,
        }
      })
      .filter((p) => p.month && p.year)

    const monthOrder = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ]

    parsedPeriods.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year.localeCompare(a.year)
      }
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month)
    })

    const years = Array.from(new Set(parsedPeriods.map((p) => p.year))).sort((a, b) => b.localeCompare(a))

    let targetYear = selectedYear
    let targetMonth = selectedMonth

    if (!targetYear && years.length > 0) {
      targetYear = years[0]
    }

    if (!targetMonth && targetYear) {
      const monthsForYear = parsedPeriods
        .filter((p) => p.year === targetYear)
        .map((p) => p.month)

      monthsForYear.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))
      if (monthsForYear.length > 0) {
        targetMonth = monthsForYear[0]
      }
    }

    let salaryData = null
    let otData = null

    if (targetYear && targetMonth) {
      const searchPattern = `${targetMonth} ${targetYear}`
      const matchedSalary = mappedSalaries.find((r) => r.computedPeriod === searchPattern)
      const matchedOt = mappedOts.find((r) => r.computedPeriod === searchPattern)

      if (matchedSalary) salaryData = matchedSalary
      if (matchedOt) otData = matchedOt
    }

    const resolvedName = targetMember?.name || salaryRows[0]?.c4?.trim() || otRows[0]?.c4?.trim() || targetUsername
    const memberInfo = {
      id: targetMember?.id || 0,
      username: targetMember?.username || targetUsername,
      name: resolvedName,
      department: targetMember?.department || '-',
      position: targetMember?.position || '-',
      salary_user: targetMember?.salary_user || targetUsername,
    }

    return {
      success: true,
      member: memberInfo,
      years,
      periods: parsedPeriods.map((p) => p.original),
      selectedYear: targetYear || '',
      selectedMonth: targetMonth || '',
      salary: salaryData,
      ot: otData,
      calendar: calendarRows,
      hasRecords: mappedSalaries.length > 0 || mappedOts.length > 0,
    }
  }
}

export const salaryLedgerService = new SalaryLedgerService()
