import { apiGateway } from '@/lib/apiGateway'

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

export interface SalaryLedgerGatewayAdapter {
  lookupMember: (target: string) => Promise<{
    id: number
    username: string
    email: string | null
    name: string | null
    department: string | null
    position: string | null
    salary_user: string | null
  } | null>
  getRecords: (salaryUser: string) => Promise<{
    salary: Array<Record<string, any>>
    ot: Array<Record<string, any>>
  }>
  getCalendar: () => Promise<Array<Record<string, any>>>
}

const defaultSalaryLedgerGateway: SalaryLedgerGatewayAdapter = {
  lookupMember: (target) => apiGateway.salary.lookupMember(target),
  getRecords: (salaryUser) => apiGateway.salary.getRecords(salaryUser),
  getCalendar: () => apiGateway.salary.getCalendar(),
}

export class SalaryLedgerService {
  constructor(
    private readonly gateway: SalaryLedgerGatewayAdapter = defaultSalaryLedgerGateway
  ) {}

  async getEmployeeSalaryLedger(options: SalaryLedgerOptions): Promise<SalaryLedgerResult> {
    const { targetUsername, selectedYear, selectedMonth } = options

    const targetMember = await this.gateway.lookupMember(targetUsername)
    const salaryLookupId = targetMember?.salary_user || targetUsername

    const records = await this.gateway.getRecords(salaryLookupId)
    const salaryRows: any[] = records?.salary || []
    const otRows: any[] = records?.ot || []

    if (salaryRows.length === 0 && otRows.length === 0 && !targetMember) {
      return {
        success: false,
        notFound: true,
        error: `ไม่พบข้อมูลเงินเดือนสำหรับรหัส "${targetUsername}"`,
      }
    }

    let calendarRows: any[] = []
    try {
      calendarRows = (await this.gateway.getCalendar()) || []
    } catch {
      calendarRows = []
    }

    const periods = new Set<string>()

    const mappedSalaries = salaryRows.map((row) => {
      const cleanedPeriod = row.c8 ? String(row.c8).replace(/\s+/g, ' ').trim() : ''
      if (cleanedPeriod) periods.add(cleanedPeriod)
      return {
        ...row,
        computedPeriod: cleanedPeriod,
      }
    })

    const mappedOts = otRows.map((row) => {
      if (!row.c10 || !row.c1) return { ...row, computedPeriod: '' }

      const otMonth = String(row.c10).trim()
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
