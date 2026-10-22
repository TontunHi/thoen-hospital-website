export type StatementRange = '1m' | '3m' | '6m' | '1y' | 'custom'

export interface StatementOptions {
  range?: StatementRange
  fromPeriod?: string
  toPeriod?: string
}

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export const RANGE_LIMIT_MAP: Partial<Record<StatementRange, number>> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12
}

export const RANGE_LABEL_MAP: Partial<Record<StatementRange, string>> = {
  '1m': '1 เดือน',
  '3m': '3 เดือน',
  '6m': '6 เดือน',
  '1y': '1 ปี',
  'custom': 'กำหนดเอง'
}

export interface StatementPeriodItem {
  period: string
  month: string
  year: string
  sortKey: number
  // Salary
  hasSalary: boolean
  salaryBase: number
  salaryRetroactive: number
  salaryRefund: number
  salaryEarnings: number
  salaryDeductions: number
  salaryNet: number
  // OT
  hasOt: boolean
  otCh11: number
  otShift: number
  otPerDiem: number
  otSpecial: number
  otEarnings: number
  otDeductions: number
  otNet: number
  // Combined Totals
  totalEarnings: number
  totalDeductions: number
  netPay: number
  // Raw rows for detailed breakdown
  rawSalary?: any
  rawOt?: any
}

export interface StatementSummary {
  periodCount: number
  fromPeriod: string
  toPeriod: string
  totalSalaryEarnings: number
  totalOtEarnings: number
  totalEarnings: number
  totalSalaryDeductions: number
  totalOtDeductions: number
  totalDeductions: number
  totalNetPay: number
  avgMonthlyEarnings: number
  avgMonthlyDeductions: number
  avgMonthlyNetPay: number
}

export interface StatementTransactionItem {
  index: number
  date: string
  period: string
  type: 'salary' | 'ot'
  details: string
  withdrawal: number
  deposit: number
  balance: number
}

export interface StatementResult {
  member: {
    id: number
    username: string
    name: string | null
    department: string | null
    position: string | null
    accountNumber: string | null
  }
  range: StatementRange
  rangeLabel: string
  availablePeriods: string[]
  records: StatementPeriodItem[]
  transactions: StatementTransactionItem[]
  summary: StatementSummary
  generatedAt: string
}

/**
 * Cleanly parse numeric amounts from string or number values.
 * Handles commas, negatives, dashes, and invalid values gracefully.
 */
export function parseSalaryAmount(val: any): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const cleaned = String(val).replace(/,/g, '').trim()
  if (!cleaned || cleaned === '-') return 0
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100
}

/**
 * Calculate standard Thai period sort key (year * 12 + monthIndex)
 */
export function getPeriodSortKey(month: string, year: string): number {
  const mIndex = THAI_MONTHS.indexOf(month.trim())
  const yNum = parseInt(year.trim(), 10)
  if (mIndex === -1 || isNaN(yNum)) return 0
  return yNum * 12 + mIndex
}

/**
 * Format Thai date string from ISO or date
 */
export function formatThaiDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  const day = d.getDate()
  const month = THAI_MONTHS[d.getMonth()] || ''
  const year = d.getFullYear() + 543
  return `${day} ${month} ${year}`
}

/**
 * Normalize and combine salary & OT records into monthly statement items
 */
export function buildStatementData(
  member: {
    id: number
    username: string
    name: string | null
    department: string | null
    position: string | null
    salary_user?: string | null
  },
  salaryRows: any[],
  otRows: any[],
  rangeOrOptions: StatementRange | StatementOptions = '6m'
): StatementResult {
  const periodMap = new Map<string, {
    month: string
    year: string
    sortKey: number
    salary?: any
    ot?: any
  }>()

  // 1. Process salary rows
  for (const sRow of salaryRows) {
    const rawPeriod = sRow.c8 ? String(sRow.c8).replace(/\s+/g, ' ').trim() : ''
    if (!rawPeriod) continue
    const parts = rawPeriod.split(' ')
    if (parts.length < 2) continue
    const month = parts[0].trim()
    const year = parts[1].trim()
    const sortKey = getPeriodSortKey(month, year)
    if (sortKey === 0) continue

    const key = `${month} ${year}`
    if (!periodMap.has(key)) {
      periodMap.set(key, { month, year, sortKey })
    }
    const item = periodMap.get(key)!
    item.salary = sRow
  }

  // 2. Process OT rows
  for (const otRow of otRows) {
    if (!otRow.c10 || !otRow.c1) continue
    const otMonth = String(otRow.c10).trim()
    const payDate = new Date(otRow.c1)
    if (isNaN(payDate.getTime())) continue

    const payYear = payDate.getFullYear() + 543
    const payMonth = payDate.getMonth() // 0 = Jan, 11 = Dec

    let otYear = payYear
    // December OT is paid in January of following year
    if (payMonth === 0 && otMonth === 'ธันวาคม') {
      otYear = payYear - 1
    }

    const year = String(otYear)
    const month = otMonth
    const sortKey = getPeriodSortKey(month, year)
    if (sortKey === 0) continue

    const key = `${month} ${year}`
    if (!periodMap.has(key)) {
      periodMap.set(key, { month, year, sortKey })
    }
    const item = periodMap.get(key)!
    item.ot = otRow
  }

  // 3. Sort all available periods
  // Chronological order (oldest to newest)
  const chronologicalPeriods = Array.from(periodMap.values()).sort((a, b) => a.sortKey - b.sortKey)
  // Newest first for preset slicing (latest 1m, 3m, 6m, 1y)
  const newestFirstPeriods = [...chronologicalPeriods].reverse()
  const availablePeriods = chronologicalPeriods.map((p) => `${p.month} ${p.year}`)

  // 4. Determine selected periods
  let selectedPeriods: typeof chronologicalPeriods = []
  let effectiveRange: StatementRange = '6m'
  let customRangeLabel = ''

  const isOptionsObj = typeof rangeOrOptions === 'object' && rangeOrOptions !== null
  const requestedRange = isOptionsObj ? rangeOrOptions.range : rangeOrOptions
  const fromPeriodParam = isOptionsObj ? rangeOrOptions.fromPeriod?.trim() : undefined
  const toPeriodParam = isOptionsObj ? rangeOrOptions.toPeriod?.trim() : undefined

  if (requestedRange === 'custom' || fromPeriodParam || toPeriodParam) {
    effectiveRange = 'custom'
    let minKey = 0
    let maxKey = Infinity

    if (fromPeriodParam) {
      const parts = fromPeriodParam.split(/\s+/)
      if (parts.length >= 2) minKey = getPeriodSortKey(parts[0], parts[1])
    }
    if (toPeriodParam) {
      const parts = toPeriodParam.split(/\s+/)
      if (parts.length >= 2) maxKey = getPeriodSortKey(parts[0], parts[1])
    }

    if (minKey > maxKey && maxKey !== Infinity) {
      const temp = minKey
      minKey = maxKey
      maxKey = temp
    }

    selectedPeriods = chronologicalPeriods.filter(
      (p) => p.sortKey >= minKey && p.sortKey <= maxKey
    )

    if (selectedPeriods.length > 0) {
      customRangeLabel = `${selectedPeriods[0].month} ${selectedPeriods[0].year} - ${selectedPeriods[selectedPeriods.length - 1].month} ${selectedPeriods[selectedPeriods.length - 1].year}`
    } else {
      customRangeLabel = 'กำหนดเอง'
    }
  } else {
    effectiveRange = (requestedRange as StatementRange) || '6m'
    const limit = RANGE_LIMIT_MAP[effectiveRange] || 6
    selectedPeriods = newestFirstPeriods.slice(0, limit)
    // Sort chronological (oldest to newest) for statement document presentation
    selectedPeriods.sort((a, b) => a.sortKey - b.sortKey)
  }

  // 5. Build Period Items
  let totalSalaryEarnings = 0
  let totalOtEarnings = 0
  let totalEarnings = 0
  let totalSalaryDeductions = 0
  let totalOtDeductions = 0
  let totalDeductions = 0
  let totalNetPay = 0
  let fallbackAccountNumber = ''

  const records: StatementPeriodItem[] = selectedPeriods.map((p) => {
    const s = p.salary
    const ot = p.ot

    if (!fallbackAccountNumber) {
      fallbackAccountNumber = s?.c3 || ot?.c3 || ''
    }

    const hasSalary = !!s
    const salaryBase = parseSalaryAmount(s?.c5)
    const salaryRetroactive = parseSalaryAmount(s?.c6)
    const salaryRefund = parseSalaryAmount(s?.c7)
    const salaryEarnings = parseSalaryAmount(s?.c11 || (salaryBase + salaryRetroactive + salaryRefund))
    const salaryDeductions = parseSalaryAmount(s?.c25)
    const salaryNet = parseSalaryAmount(s?.c26 || (salaryEarnings - salaryDeductions))

    const hasOt = !!ot
    const otCh11 = parseSalaryAmount(ot?.c5)
    const otShift = parseSalaryAmount(ot?.c6)
    const otPerDiem = parseSalaryAmount(ot?.c7)
    const otSpecial = parseSalaryAmount(ot?.c8)
    const otEarnings = parseSalaryAmount(ot?.c15 || (otCh11 + otShift + otPerDiem + otSpecial))
    const otDeductions = parseSalaryAmount(ot?.c22)
    const otNet = parseSalaryAmount(ot?.c23 || (otEarnings - otDeductions))

    const itemTotalEarnings = Math.round((salaryEarnings + otEarnings) * 100) / 100
    const itemTotalDeductions = Math.round((salaryDeductions + otDeductions) * 100) / 100
    const itemNetPay = Math.round((itemTotalEarnings - itemTotalDeductions) * 100) / 100

    totalSalaryEarnings += salaryEarnings
    totalOtEarnings += otEarnings
    totalEarnings += itemTotalEarnings
    totalSalaryDeductions += salaryDeductions
    totalOtDeductions += otDeductions
    totalDeductions += itemTotalDeductions
    totalNetPay += itemNetPay

    return {
      period: `${p.month} ${p.year}`,
      month: p.month,
      year: p.year,
      sortKey: p.sortKey,
      hasSalary,
      salaryBase,
      salaryRetroactive,
      salaryRefund,
      salaryEarnings,
      salaryDeductions,
      salaryNet,
      hasOt,
      otCh11,
      otShift,
      otPerDiem,
      otSpecial,
      otEarnings,
      otDeductions,
      otNet,
      totalEarnings: itemTotalEarnings,
      totalDeductions: itemTotalDeductions,
      netPay: itemNetPay,
      rawSalary: s,
      rawOt: ot
    }
  })

  const count = records.length
  const round2 = (num: number) => Math.round(num * 100) / 100

  const summary: StatementSummary = {
    periodCount: count,
    fromPeriod: count > 0 ? records[0].period : '-',
    toPeriod: count > 0 ? records[count - 1].period : '-',
    totalSalaryEarnings: round2(totalSalaryEarnings),
    totalOtEarnings: round2(totalOtEarnings),
    totalEarnings: round2(totalEarnings),
    totalSalaryDeductions: round2(totalSalaryDeductions),
    totalOtDeductions: round2(totalOtDeductions),
    totalDeductions: round2(totalDeductions),
    totalNetPay: round2(totalNetPay),
    avgMonthlyEarnings: count > 0 ? round2(totalEarnings / count) : 0,
    avgMonthlyDeductions: count > 0 ? round2(totalDeductions / count) : 0,
    avgMonthlyNetPay: count > 0 ? round2(totalNetPay / count) : 0
  }

  // 6. Build itemized transactions (แยกแถวรายรับและรายจ่ายชัดเจน ไม่ให้อยู่บรรทัดเดียวกัน)
  const transactions = buildStatementTransactions(records)

  return {
    member: {
      id: member.id,
      username: member.username,
      name: member.name || (salaryRows[0]?.c4?.trim()) || (otRows[0]?.c4?.trim()) || member.username,
      department: member.department,
      position: member.position,
      accountNumber: fallbackAccountNumber || '-'
    },
    range: effectiveRange,
    rangeLabel: customRangeLabel || RANGE_LABEL_MAP[effectiveRange] || effectiveRange,
    availablePeriods,
    records,
    transactions,
    summary,
    generatedAt: new Date().toISOString()
  }
}

/**
 * Generate itemized transactions separating income and deductions into distinct rows.
 * Income and expenses are never merged on the same row.
 */
export function buildStatementTransactions(records: StatementPeriodItem[]): StatementTransactionItem[] {
  const transactions: StatementTransactionItem[] = []
  let txIndex = 1
  let runningBalance = 0

  records.forEach((rec) => {
    const salaryDate = rec.rawSalary?.c1 ? formatThaiDate(rec.rawSalary.c1) : rec.period
    const otDate = rec.rawOt?.c1 ? formatThaiDate(rec.rawOt.c1) : rec.period

    // 1. Salary Earnings (รายรับ)
    if (rec.hasSalary || rec.salaryEarnings > 0) {
      runningBalance = Math.round((runningBalance + rec.salaryEarnings) * 100) / 100
      transactions.push({
        index: txIndex++,
        date: salaryDate,
        period: rec.period,
        type: 'salary',
        details: `รายรับ: เงินเดือนและค่าจ้างประจำงวด ${rec.period}`,
        withdrawal: 0,
        deposit: rec.salaryEarnings,
        balance: runningBalance
      })
    }

    // 2. Salary Deductions (รายจ่าย / รายการหัก)
    if (rec.salaryDeductions > 0) {
      runningBalance = Math.round((runningBalance - rec.salaryDeductions) * 100) / 100
      transactions.push({
        index: txIndex++,
        date: salaryDate,
        period: rec.period,
        type: 'salary',
        details: `รายจ่าย: รายการหักเงินเดือนประจำงวด ${rec.period}`,
        withdrawal: rec.salaryDeductions,
        deposit: 0,
        balance: runningBalance
      })
    }

    // 3. OT Earnings (รายรับ)
    if (rec.hasOt || rec.otEarnings > 0) {
      runningBalance = Math.round((runningBalance + rec.otEarnings) * 100) / 100
      transactions.push({
        index: txIndex++,
        date: otDate,
        period: rec.period,
        type: 'ot',
        details: `รายรับ: ค่าตอบแทนและค่าล่วงเวลา (OT) ประจำงวด ${rec.period}`,
        withdrawal: 0,
        deposit: rec.otEarnings,
        balance: runningBalance
      })
    }

    // 4. OT Deductions (รายจ่าย / รายการหัก)
    if (rec.otDeductions > 0) {
      runningBalance = Math.round((runningBalance - rec.otDeductions) * 100) / 100
      transactions.push({
        index: txIndex++,
        date: otDate,
        period: rec.period,
        type: 'ot',
        details: `รายจ่าย: รายการหักค่าตอบแทน/OT ประจำงวด ${rec.period}`,
        withdrawal: rec.otDeductions,
        deposit: 0,
        balance: runningBalance
      })
    }
  })

  return transactions
}
