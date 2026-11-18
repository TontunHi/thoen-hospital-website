export interface AppointmentMismatch {
  hn: string
  department: string
  vstdate: string
  nextdate: string
  appUser: string
}

export interface AppointmentMismatchResponse {
  totalMismatches: number
  updatedAt: string
  mismatches: AppointmentMismatch[]
}

export type UrgencyTone = 'critical' | 'warning' | 'neutral'
export type UrgencyFilter = 'all' | 'urgent7' | 'tomorrow'
export type SortOption = 'nextdate_asc' | 'user_asc' | 'dept_asc' | 'vstdate_desc'
export type BreakdownMode = 'department' | 'user'

export interface BreakdownItem {
  name: string
  count: number
  percent: number
}

export interface MismatchSummary {
  total: number
  urgent7Count: number
  tomorrowCount: number
  uniqueDepartments: number
  uniqueUsers: number
  departmentBreakdown: BreakdownItem[]
  userBreakdown: BreakdownItem[]
}

export interface MismatchFilterState {
  searchQuery: string
  urgencyFilter: UrgencyFilter
  departmentFilter: string
  userFilter: string
  sortBy: SortOption
}

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

const MS_PER_DAY = 86_400_000
const UNSPECIFIED_DEPARTMENT = 'ไม่ระบุห้องตรวจ'
const UNSPECIFIED_USER = 'ไม่ระบุผู้นัด'

/**
 * Extract calendar YYYY-MM-DD components safely in Asia/Bangkok timezone
 * without shifting dates across UTC midnight boundaries.
 */
export function parseCalendarDate(dateStr: string): { year: number; month: number; day: number } | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  const plainDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (plainDateMatch) {
    const year = Number(plainDateMatch[1])
    const month = Number(plainDateMatch[2])
    const day = Number(plainDateMatch[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day }
    }
    return null
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(parsed)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)

  if (!year || !month || !day) return null
  return { year, month, day }
}

/**
 * Format a date string into Thai Buddhist short date (e.g. "19 พ.ย. 2569").
 */
export function formatThaiShortDate(dateStr: string): string {
  const parts = parseCalendarDate(dateStr)
  if (!parts) return dateStr.trim() || '-'
  const monthLabel = THAI_SHORT_MONTHS[parts.month - 1]
  const buddhistYear = parts.year + 543
  return `${parts.day} ${monthLabel} ${buddhistYear}`
}

/**
 * Compute whole calendar days from referenceDate (Bangkok local date) to target date.
 */
export function getDaysUntilDate(dateStr: string, referenceDate: Date = new Date()): number | null {
  const target = parseCalendarDate(dateStr)
  if (!target) return null

  const refFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const refParts = refFormatter.formatToParts(referenceDate)
  const refYear = Number(refParts.find((p) => p.type === 'year')?.value)
  const refMonth = Number(refParts.find((p) => p.type === 'month')?.value)
  const refDay = Number(refParts.find((p) => p.type === 'day')?.value)

  if (!refYear || !refMonth || !refDay) return null

  const refUtcMs = Date.UTC(refYear, refMonth - 1, refDay)
  const targetUtcMs = Date.UTC(target.year, target.month - 1, target.day)
  return Math.round((targetUtcMs - refUtcMs) / MS_PER_DAY)
}

/**
 * Classify appointment urgency for kiosk triage before patient arrival.
 */
export function getUrgencyMeta(daysUntil: number | null): { tone: UrgencyTone; label: string } {
  if (daysUntil === null) {
    return { tone: 'neutral', label: 'ไม่ระบุวันนัด' }
  }
  if (daysUntil <= 0) {
    return { tone: 'critical', label: 'วันนี้ / เกินกำหนด' }
  }
  if (daysUntil === 1) {
    return { tone: 'critical', label: 'พรุ่งนี้' }
  }
  if (daysUntil <= 7) {
    return { tone: 'warning', label: `อีก ${daysUntil} วัน` }
  }
  return { tone: 'neutral', label: `อีก ${daysUntil} วัน` }
}

export function normalizeDepartmentLabel(department: string): string {
  return department.trim() || UNSPECIFIED_DEPARTMENT
}

export function normalizeUserLabel(appUser: string): string {
  return appUser.trim() || UNSPECIFIED_USER
}

function buildBreakdown(counts: Map<string, number>, total: number, limit = 5): BreakdownItem[] {
  if (total === 0) return []
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
    .slice(0, limit)
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }))
}

/**
 * Summarize urgency counts and top misconfigured rooms/staff for triage overview.
 */
export function summarizeMismatches(
  mismatches: AppointmentMismatch[],
  referenceDate: Date = new Date()
): MismatchSummary {
  const deptCounts = new Map<string, number>()
  const userCounts = new Map<string, number>()

  let urgent7Count = 0
  let tomorrowCount = 0

  for (const item of mismatches) {
    const daysUntil = getDaysUntilDate(item.nextdate, referenceDate)
    if (daysUntil !== null && daysUntil <= 7) {
      urgent7Count += 1
    }
    if (daysUntil !== null && daysUntil <= 1) {
      tomorrowCount += 1
    }

    const deptName = normalizeDepartmentLabel(item.department)
    deptCounts.set(deptName, (deptCounts.get(deptName) ?? 0) + 1)

    const userName = normalizeUserLabel(item.appUser)
    userCounts.set(userName, (userCounts.get(userName) ?? 0) + 1)
  }

  return {
    total: mismatches.length,
    urgent7Count,
    tomorrowCount,
    uniqueDepartments: deptCounts.size,
    uniqueUsers: userCounts.size,
    departmentBreakdown: buildBreakdown(deptCounts, mismatches.length),
    userBreakdown: buildBreakdown(userCounts, mismatches.length),
  }
}

function toSortTimestamp(dateStr: string): number {
  const parts = parseCalendarDate(dateStr)
  if (!parts) return Number.MAX_SAFE_INTEGER
  return Date.UTC(parts.year, parts.month - 1, parts.day)
}

/**
 * Filter and sort mismatch records according to active triage toolbar state.
 */
export function filterAndSortMismatches(
  mismatches: AppointmentMismatch[],
  filters: MismatchFilterState,
  referenceDate: Date = new Date()
): AppointmentMismatch[] {
  const q = filters.searchQuery.trim().toLowerCase()

  const filtered = mismatches.filter((item) => {
    const deptLabel = normalizeDepartmentLabel(item.department)
    const userLabel = normalizeUserLabel(item.appUser)

    if (filters.departmentFilter !== 'all' && deptLabel !== filters.departmentFilter) {
      return false
    }
    if (filters.userFilter !== 'all' && userLabel !== filters.userFilter) {
      return false
    }

    if (filters.urgencyFilter !== 'all') {
      const daysUntil = getDaysUntilDate(item.nextdate, referenceDate)
      if (daysUntil === null) return false
      if (filters.urgencyFilter === 'tomorrow' && daysUntil > 1) return false
      if (filters.urgencyFilter === 'urgent7' && daysUntil > 7) return false
    }

    if (q) {
      const haystack = `${item.hn} ${deptLabel} ${userLabel}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })

  return filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'user_asc':
        return (
          normalizeUserLabel(a.appUser).localeCompare(normalizeUserLabel(b.appUser), 'th') ||
          toSortTimestamp(a.nextdate) - toSortTimestamp(b.nextdate)
        )
      case 'dept_asc':
        return (
          normalizeDepartmentLabel(a.department).localeCompare(
            normalizeDepartmentLabel(b.department),
            'th'
          ) || toSortTimestamp(a.nextdate) - toSortTimestamp(b.nextdate)
        )
      case 'vstdate_desc':
        return (
          toSortTimestamp(b.vstdate) - toSortTimestamp(a.vstdate) ||
          toSortTimestamp(a.nextdate) - toSortTimestamp(b.nextdate)
        )
      case 'nextdate_asc':
      default:
        return (
          toSortTimestamp(a.nextdate) - toSortTimestamp(b.nextdate) ||
          normalizeUserLabel(a.appUser).localeCompare(normalizeUserLabel(b.appUser), 'th')
        )
    }
  })
}
