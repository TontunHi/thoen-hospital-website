/**
 * KPI Time Utilities for Fiscal Year and Period Tracking
 * 
 * Thai Fiscal Year: 1 October - 30 September
 * Example: Fiscal Year 2570 corresponds to 1 Oct 2026 - 30 Sep 2027.
 */

export interface PeriodDefinition {
  key: string
  label: string
  unlockMonth: number // 1-12
  unlockDay: number   // 1-31
  unlockYearOffset: number // 0 for same calendar year as fiscal start, 1 for next calendar year
  description: string
}

export const FREQUENCY_PERIODS: Record<string, PeriodDefinition[]> = {
  'ราย 6 เดือน': [
    {
      key: 'H1',
      label: 'รอบ 6 เดือนแรก (ต.ค. - มี.ค.)',
      unlockMonth: 4,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 31 มีนาคม',
    },
    {
      key: 'H2',
      label: 'รอบ 12 เดือน / สิ้นปีงบประมาณ (เม.ย. - ก.ย.)',
      unlockMonth: 10,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 กันยายน',
    },
  ],
  'รายไตรมาส': [
    {
      key: 'Q1',
      label: 'ไตรมาสที่ 1 (ต.ค. - ธ.ค.)',
      unlockMonth: 1,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 31 ธันวาคม',
    },
    {
      key: 'Q2',
      label: 'ไตรมาสที่ 2 (ม.ค. - มี.ค.)',
      unlockMonth: 4,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 31 มีนาคม',
    },
    {
      key: 'Q3',
      label: 'ไตรมาสที่ 3 (เม.ย. - มิ.ย.)',
      unlockMonth: 7,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 มิถุนายน',
    },
    {
      key: 'Q4',
      label: 'ไตรมาสที่ 4 (ก.ค. - ก.ย.)',
      unlockMonth: 10,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 กันยายน',
    },
  ],
  'รายปี': [
    {
      key: 'YEAR',
      label: 'รอบสิ้นปีงบประมาณ (ต.ค. - ก.ย.)',
      unlockMonth: 10,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 กันยายน',
    },
  ],
  'รายเดือน': [
    { key: 'M01', label: 'ตุลาคม', unlockMonth: 11, unlockDay: 1, unlockYearOffset: 0, description: 'เปิดให้บันทึกหลัง 31 ต.ค.' },
    { key: 'M02', label: 'พฤศจิกายน', unlockMonth: 12, unlockDay: 1, unlockYearOffset: 0, description: 'เปิดให้บันทึกหลัง 30 พ.ย.' },
    { key: 'M03', label: 'ธันวาคม', unlockMonth: 1, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ธ.ค.' },
    { key: 'M04', label: 'มกราคม', unlockMonth: 2, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ม.ค.' },
    { key: 'M05', label: 'กุมภาพันธ์', unlockMonth: 3, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลังสิ้นเดือน ก.พ.' },
    { key: 'M06', label: 'มีนาคม', unlockMonth: 4, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 มี.ค.' },
    { key: 'M07', label: 'เมษายน', unlockMonth: 5, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 30 เม.ย.' },
    { key: 'M08', label: 'พฤษภาคม', unlockMonth: 6, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 พ.ค.' },
    { key: 'M09', label: 'มิถุนายน', unlockMonth: 7, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 30 มิ.ย.' },
    { key: 'M10', label: 'กรกฎาคม', unlockMonth: 8, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ก.ค.' },
    { key: 'M11', label: 'สิงหาคม', unlockMonth: 9, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ส.ค.' },
    { key: 'M12', label: 'กันยายน', unlockMonth: 10, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 30 ก.ย.' },
  ],
}

/**
 * Returns periods applicable for a given frequency
 */
export function getPeriodsForFrequency(frequency: string): PeriodDefinition[] {
  return FREQUENCY_PERIODS[frequency] || FREQUENCY_PERIODS['รายปี']
}

/**
 * Converts a Buddhist Era year string (e.g. "2570") to CE Start Year (e.g. 2026).
 * FY 2570 starts in Oct 2026 and ends in Sep 2027.
 */
export function getFiscalStartYearCe(fiscalYearBe: string | number): number {
  const beYear = typeof fiscalYearBe === 'string' ? parseInt(fiscalYearBe, 10) : fiscalYearBe
  return beYear - 543 - 1
}

/**
 * Check if a reporting period is unlocked given the fiscal year and current date
 */
export function checkPeriodStatus(
  frequency: string,
  periodKey: string,
  fiscalYearBe: string | number,
  currentDate = new Date()
): { isOpen: boolean; unlockDate: Date; unlockDateFormatted: string; message: string } {
  const periods = getPeriodsForFrequency(frequency)
  const period = periods.find(p => p.key === periodKey) || periods[0]

  const startYearCe = getFiscalStartYearCe(fiscalYearBe)
  const unlockYearCe = startYearCe + period.unlockYearOffset
  const unlockDate = new Date(Date.UTC(unlockYearCe, period.unlockMonth - 1, period.unlockDay, 0, 0, 0))

  const isOpen = currentDate.getTime() >= unlockDate.getTime()
  const unlockDateFormatted = `${period.unlockDay}/${period.unlockMonth}/${unlockYearCe + 543}`

  const message = isOpen
    ? 'เปิดให้บันทึกข้อมูลแล้ว'
    : `ยังไม่ถึงรอบบันทึก (เปิดให้บันทึกตั้งแต่ ${unlockDateFormatted} เป็นต้นไป)`

  return {
    isOpen,
    unlockDate,
    unlockDateFormatted,
    message,
  }
}

export interface IndicatorDueStatus {
  isDue: boolean
  isDueNow: boolean
  isDueSoon: boolean
  daysUntil?: number
  relevantPeriod: PeriodDefinition
  unlockDate: Date
  unlockDateFormatted: string
  message: string
}

/**
 * Checks whether an indicator is due for reporting right now or within the next `daysAhead` days (default 5 days).
 */
export function checkIndicatorDueStatus(
  frequency: string,
  fiscalYearBe: string | number,
  currentDate = new Date(),
  daysAhead = 5
): IndicatorDueStatus {
  // shortcut: frequency uses predefined calendar quarters and months; custom fiscal period overrides can be added if needed
  const periods = getPeriodsForFrequency(frequency)
  const startYearCe = getFiscalStartYearCe(fiscalYearBe)

  const periodsWithDates = periods.map(period => {
    const unlockYearCe = startYearCe + period.unlockYearOffset
    const unlockDate = new Date(Date.UTC(unlockYearCe, period.unlockMonth - 1, period.unlockDay, 0, 0, 0))
    const diffMs = unlockDate.getTime() - currentDate.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const isOpen = currentDate.getTime() >= unlockDate.getTime()
    const unlockDateFormatted = `${period.unlockDay}/${period.unlockMonth}/${unlockYearCe + 543}`
    return {
      period,
      unlockYearCe,
      unlockDate,
      diffDays,
      isOpen,
      unlockDateFormatted,
    }
  })

  const dueSoon = periodsWithDates.find(p => !p.isOpen && p.diffDays > 0 && p.diffDays <= daysAhead)
  const openPeriods = periodsWithDates.filter(p => p.isOpen)

  if (dueSoon) {
    return {
      isDue: true,
      isDueNow: openPeriods.length > 0,
      isDueSoon: true,
      daysUntil: dueSoon.diffDays,
      relevantPeriod: dueSoon.period,
      unlockDate: dueSoon.unlockDate,
      unlockDateFormatted: dueSoon.unlockDateFormatted,
      message: `อีก ${dueSoon.diffDays} วันจะถึงรอบบันทึก (เปิด ${dueSoon.unlockDateFormatted})`,
    }
  }

  if (openPeriods.length > 0) {
    const latestOpen = openPeriods[openPeriods.length - 1]
    return {
      isDue: true,
      isDueNow: true,
      isDueSoon: false,
      relevantPeriod: latestOpen.period,
      unlockDate: latestOpen.unlockDate,
      unlockDateFormatted: latestOpen.unlockDateFormatted,
      message: 'เปิดให้บันทึกข้อมูลแล้ว',
    }
  }

  const firstUpcoming = periodsWithDates[0]
  return {
    isDue: false,
    isDueNow: false,
    isDueSoon: false,
    relevantPeriod: firstUpcoming.period,
    unlockDate: firstUpcoming.unlockDate,
    unlockDateFormatted: firstUpcoming.unlockDateFormatted,
    message: `ยังไม่ถึงรอบบันทึก (เปิดให้บันทึกตั้งแต่ ${firstUpcoming.unlockDateFormatted} เป็นต้นไป)`,
  }
}

export interface IndicatorAnswerableEntry {
  periodKey?: string
  numeratorValue?: number | null
  denominatorValue?: number | null
  resultValue?: number | null
  resultText?: string | null
  status?: string | null
}

export interface IndicatorWithEntries {
  currentEntry?: IndicatorAnswerableEntry | null
  entries?: IndicatorAnswerableEntry[]
}

/**
 * Robust matching between period keys (e.g. M01 vs M1, H1 vs 6M1, prefixed keys like 2570-Q1)
 */
export function matchesPeriodKey(entryKey?: string | null, targetKey?: string | null): boolean {
  if (!entryKey || !targetKey) return false
  if (entryKey === targetKey) return true
  if (entryKey.endsWith('-' + targetKey) || entryKey.endsWith('_' + targetKey)) return true
  if (targetKey.endsWith('-' + entryKey) || targetKey.endsWith('_' + entryKey)) return true

  // Normalize monthly M01 -> M1
  const cleanA = entryKey.replace(/^M0?(\d+)$/, 'M$1')
  const cleanB = targetKey.replace(/^M0?(\d+)$/, 'M$1')
  if (cleanA === cleanB) return true

  // Normalize semi-annual H1 -> 6M1, H2 -> 6M2
  const normSemi = (k: string) => k === '6M1' ? 'H1' : k === '6M2' ? 'H2' : k
  if (normSemi(entryKey) === normSemi(targetKey)) return true

  // Normalize annual YEAR -> Y1
  const normYear = (k: string) => k === 'YEAR' ? 'Y1' : k
  if (normYear(entryKey) === normYear(targetKey)) return true

  return false
}

/**
 * Checks whether an indicator has already been answered for a given reporting period.
 */
export function isIndicatorAnsweredForPeriod(
  ind: IndicatorWithEntries,
  periodKey?: string
): boolean {
  if (!periodKey) return false

  const isEntryAnswered = (entry: IndicatorAnswerableEntry): boolean => {
    const hasValue = entry.resultValue !== null && entry.resultValue !== undefined
    const hasText = Boolean(entry.resultText && entry.resultText.trim() !== '' && entry.resultText !== 'ไม่มีรายงาน')
    const hasNumDen = entry.numeratorValue !== null && entry.denominatorValue !== null && entry.numeratorValue !== undefined && entry.denominatorValue !== undefined
    const isNotPending = Boolean(entry.status && entry.status !== 'PENDING')
    return (hasValue || hasText || hasNumDen) && (isNotPending || hasNumDen)
  }

  // 1. Check in entries list if present
  if (ind.entries && ind.entries.length > 0) {
    const entry = ind.entries.find(e => matchesPeriodKey(e.periodKey, periodKey))
    if (entry) {
      return isEntryAnswered(entry)
    }
  }

  // 2. Fallback to currentEntry if it matches this periodKey
  if (ind.currentEntry && matchesPeriodKey(ind.currentEntry.periodKey, periodKey)) {
    return isEntryAnswered(ind.currentEntry)
  }

  return false
}

export interface IndicatorMetricMeta {
  title?: string | null
  targetUnit?: string | null
  target_unit?: string | null
  numeratorName?: string | null
  numerator_name?: string | null
  denominatorName?: string | null
  denominator_name?: string | null
}

/**
 * Determines whether a KPI indicator's numerator/denominator formula
 * should be calculated as a percentage (x 100) or as a direct division/average/ratio (num / den).
 *
 * Rules:
 * 1. If targetUnit is '%' -> true
 * 2. If title contains 'ร้อยละ' or '%' -> true
 * 3. If explicit unit exists (and not '%') -> false (e.g. วัน, นาที, ชั่วโมง, ครั้ง, เท่า, คะแนน, บาท, ราย, ต่อพัน)
 * 4. If title contains 'อัตรา', 'อัตราส่วน', 'สัดส่วน', 'Ratio', 'ค่าเฉลี่ย', 'ระยะเวลาเฉลี่ย' -> false
 * 5. If numerator name implies unit duration/currency -> false
 * 6. Default fallback -> true
 */
export function isPercentageIndicator(ind?: IndicatorMetricMeta | null): boolean {
  if (!ind) return true
  const title = (ind.title || '').trim()
  const unit = (ind.targetUnit ?? ind.target_unit ?? '').trim()

  // 1. If title explicitly has 'อัตราส่วน', 'สัดส่วน', 'Ratio' (and does not say 'ร้อยละ') -> ALWAYS false (Ratio)
  if (
    title.includes('อัตราส่วน') ||
    title.includes('สัดส่วน') ||
    title.includes('Ratio')
  ) {
    if (!title.includes('ร้อยละ') && !title.includes('%')) {
      return false
    }
  }

  // 2. If explicit unit exists (and not '%') -> false (e.g. เท่า, วัน, นาที, ชั่วโมง, ครั้ง, คะแนน, บาท, ราย, ต่อพัน)
  if (unit && unit !== '%') return false

  // 3. If title explicitly has 'ร้อยละ' or '%' -> true
  if (title.includes('ร้อยละ') || title.includes('%')) return true

  // 4. If targetUnit is '%' (and not a ratio title) -> true
  if (unit === '%') return true

  // 5. If title has 'อัตรา', 'ค่าเฉลี่ย', 'ระยะเวลาเฉลี่ย' -> false
  if (
    title.includes('ค่าเฉลี่ย') || 
    title.includes('ระยะเวลาเฉลี่ย') ||
    title.includes('อัตรา')
  ) {
    return false
  }

  const numName = (ind.numeratorName ?? ind.numerator_name ?? '').trim()
  if (
    (numName.includes('นาที') || numName.includes('วัน') || numName.includes('ชั่วโมง') || numName.includes('บาท'))
  ) {
    return false
  }

  return true
}

/**
 * Determines whether an indicator is a Rate/Ratio indicator (displays fixed 2 decimals e.g. 0.90)
 */
export function isRateIndicator(ind?: IndicatorMetricMeta | null): boolean {
  if (!ind) return false
  const title = (ind.title || '').trim()
  const unit = (ind.targetUnit ?? ind.target_unit ?? '').trim()

  if (title.includes('ร้อยละ') || title.includes('%')) return false

  return (
    title.includes('อัตราส่วน') ||
    title.includes('สัดส่วน') ||
    title.includes('Ratio') ||
    title.includes('อัตรา') ||
    unit === 'เท่า' ||
    unit === 'อัตรา' ||
    unit.includes('ต่อ')
  )
}

/**
 * Calculates the KPI result value from numerator and denominator.
 * Returns null if den is 0 (and num > 0), or 0 if 0/0.
 */
export function calculateIndicatorResult(
  num: number,
  den: number,
  isPercentage: boolean = true
): number | null {
  if (den === 0) {
    if (num === 0) return 0
    return null
  }
  const raw = isPercentage ? (num / den) * 100 : (num / den)
  return parseFloat(raw.toFixed(4))
}

/**
 * Formats a number with Thai comma separators (e.g. 15000 -> 15,000)
 */
export function formatKpiNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '-'
  return Number(val).toLocaleString('th-TH')
}

/**
 * Formats the KPI result display based on indicator type:
 * - Percentage: trimmed decimals (up to 2 places) + '%' e.g. 85%, 92.5%, 78.25%
 * - Rate: fixed 2 decimals e.g. 0.90, 1.00, 2.50
 * - Other: trimmed decimals + custom unit (if any)
 */
export function formatKpiResultValue(
  val: number | null | undefined,
  ind?: IndicatorMetricMeta | null,
  fallbackText?: string | null
): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return fallbackText || '-'
  }

  const num = Number(val)
  const isPct = isPercentageIndicator(ind)
  const isRate = isRateIndicator(ind)
  const unit = (ind?.targetUnit ?? ind?.target_unit ?? '').trim()

  if (isPct) {
    const trimmed = parseFloat(num.toFixed(2))
    return `${trimmed}%`
  }

  if (isRate) {
    const rateFmt = num.toFixed(2)
    const customUnit = unit && unit !== '%' && unit !== 'อัตรา' ? ` ${unit}` : ''
    return `${rateFmt}${customUnit}`
  }

  const trimmed = parseFloat(num.toFixed(2))
  const customUnit = unit ? ` ${unit}` : ''
  return `${trimmed}${customUnit}`
}

