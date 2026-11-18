/**
 * Shared fiscal year, month, and quarter helpers for /service/dashboard-rcm pages.
 * Keeps date calculations single-source and Thai Buddhist Era (พ.ศ.) consistent.
 */

export const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const

export interface FiscalMonthColumn {
  key: string
  label: string
  qTag: string
  qClass: string
}

export interface FiscalQuarterGroup {
  quarter: string
  shortTag: string
  className: string
  months: FiscalMonthColumn[]
}

/** Returns the Thai fiscal year (CE, e.g. 2026 for Oct 2025 – Sep 2026). */
export function getCurrentFiscalYearCe(referenceDate: Date = new Date()): number {
  const calYear = referenceDate.getFullYear()
  return referenceDate.getMonth() + 1 >= 10 ? calYear + 1 : calYear
}

/** Builds the trailing N fiscal years list (most recent first). */
export function getAvailableFiscalYears(defaultFiscalYear: number, count = 7): number[] {
  return Array.from({ length: count }, (_, idx) => defaultFiscalYear - idx)
}

/** Computes YYYY-MM-DD start/end bounds for a given CE year and 1-based month. */
export function getMonthDateBounds(ceYear: number, month: number): { startDate: string; endDate: string } {
  const mStr = String(month).padStart(2, '0')
  const lastDay = new Date(ceYear, month, 0).getDate()
  return {
    startDate: `${ceYear}-${mStr}-01`,
    endDate: `${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** Computes YYYY-MM-DD start/end bounds for a Thai fiscal year (Oct prev year – Sep fiscal year). */
export function getFiscalYearDateBounds(fiscalYearCe: number): { startDate: string; endDate: string } {
  return {
    startDate: `${fiscalYearCe - 1}-10-01`,
    endDate: `${fiscalYearCe}-09-30`,
  }
}

/** Builds the 4 Thai fiscal quarters (12 months Oct–Sep) for a given CE fiscal year. */
export function buildFiscalQuarters(fiscalYearCe: number): FiscalQuarterGroup[] {
  const prevYear = fiscalYearCe - 1
  const curYear = fiscalYearCe

  return [
    {
      quarter: 'ไตรมาส 1 (Q1)',
      shortTag: 'Q1',
      className: 'quarter-q1',
      months: [
        { key: `${prevYear}-10`, label: 'ต.ค.', qTag: 'Q1', qClass: 'q1-badge' },
        { key: `${prevYear}-11`, label: 'พ.ย.', qTag: 'Q1', qClass: 'q1-badge' },
        { key: `${prevYear}-12`, label: 'ธ.ค.', qTag: 'Q1', qClass: 'q1-badge' },
      ],
    },
    {
      quarter: 'ไตรมาส 2 (Q2)',
      shortTag: 'Q2',
      className: 'quarter-q2',
      months: [
        { key: `${curYear}-01`, label: 'ม.ค.', qTag: 'Q2', qClass: 'q2-badge' },
        { key: `${curYear}-02`, label: 'ก.พ.', qTag: 'Q2', qClass: 'q2-badge' },
        { key: `${curYear}-03`, label: 'มี.ค.', qTag: 'Q2', qClass: 'q2-badge' },
      ],
    },
    {
      quarter: 'ไตรมาส 3 (Q3)',
      shortTag: 'Q3',
      className: 'quarter-q3',
      months: [
        { key: `${curYear}-04`, label: 'เม.ย.', qTag: 'Q3', qClass: 'q3-badge' },
        { key: `${curYear}-05`, label: 'พ.ค.', qTag: 'Q3', qClass: 'q3-badge' },
        { key: `${curYear}-06`, label: 'มิ.ย.', qTag: 'Q3', qClass: 'q3-badge' },
      ],
    },
    {
      quarter: 'ไตรมาส 4 (Q4)',
      shortTag: 'Q4',
      className: 'quarter-q4',
      months: [
        { key: `${curYear}-07`, label: 'ก.ค.', qTag: 'Q4', qClass: 'q4-badge' },
        { key: `${curYear}-08`, label: 'ส.ค.', qTag: 'Q4', qClass: 'q4-badge' },
        { key: `${curYear}-09`, label: 'ก.ย.', qTag: 'Q4', qClass: 'q4-badge' },
      ],
    },
  ]
}

/** Formats a YYYY-MM month key into short Thai label (e.g. "2025-10" -> "ต.ค. 68"). */
export function formatShortThaiMonth(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!match) return ym
  const yearBe = (Number(match[1]) + 543) % 100
  const monthIdx = Number(match[2]) - 1
  const shortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const label = shortMonths[monthIdx] ?? match[2]
  return `${label} ${String(yearBe).padStart(2, '0')}`
}
