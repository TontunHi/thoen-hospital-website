/**
 * Common formatting and string utilities for Hospital Staff and UI presentation.
 */

/**
 * Extracts initials or short avatar representation from a person's name or username.
 * Strips common Thai honorifics and titles (e.g. นาย, นางสาว, นาง, นพ., พญ., ทพ., ภก., ภญ., พยาบาล, ดร.).
 *
 * @param name Full name or username string
 * @param uppercase Whether to convert English initials to uppercase (default: false)
 * @returns 1-2 character initials or fallback '?'
 */
export function getInitials(name?: string | null, uppercase: boolean = false): string {
  if (!name || !name.trim()) return '?'
  const clean = name.replace(/^(นาย|นางสาว|นาง|นพ\.|พญ\.|ทพ\.|ทพญ\.|ภก\.|ภญ\.|พว\.|จพ\.|พยาบาล|ดร\.)\s*/, '').trim()
  if (!clean) return '?'
  const sliced = clean.slice(0, 2)
  return uppercase ? sliced.toUpperCase() : sliced
}

/**
 * Format any Date or timestamp string into Thai Buddhist date and time (DD/MM/BBBB HH:mm น.)
 * Handles both native Date instances (UTC/local), ISO strings, and SQL space strings.
 */
export function formatThaiBuddhistDateTime(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '-'
  try {
    let d: Date | null = null
    if (dateVal instanceof Date) {
      d = isNaN(dateVal.getTime()) ? null : dateVal
    } else if (typeof dateVal === 'string') {
      let s = dateVal.trim()
      if (!s) return '-'
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T')
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s += '+07:00'
      const parsed = new Date(s)
      d = isNaN(parsed.getTime()) ? null : parsed
    }
    if (!d) return String(dateVal)

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)

    const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
    const yearTh = parseInt(get('year'), 10) + 543
    return `${get('day')}/${get('month')}/${yearTh} ${get('hour')}:${get('minute')} น.`
  } catch {
    return String(dateVal)
  }
}

export const THAI_MONTH_NAMES_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/**
 * Format any Date, ISO string, SQL date string (YYYY-MM-DD), YYYYMMDD, or D/M/YYYY
 * into standard Thai Buddhist format: "วัน เดือน ปี" เช่น "1 พ.ย. 2569"
 */
export function formatThaiDate(dateVal?: string | Date | null, fallback: string = '—'): string {
  if (!dateVal) return fallback
  try {
    let year: number | null = null
    let month: number | null = null // 1-12
    let day: number | null = null

    if (dateVal instanceof Date) {
      if (isNaN(dateVal.getTime())) return fallback
      year = dateVal.getFullYear()
      month = dateVal.getMonth() + 1
      day = dateVal.getDate()
    } else if (typeof dateVal === 'string') {
      const s = dateVal.trim()
      if (!s || s === '-' || s === '—') return fallback

      // 1. Check YYYY-MM-DD or YYYY/MM/DD (with optional time or T)
      const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
      if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10)
        month = parseInt(ymdMatch[2], 10)
        day = parseInt(ymdMatch[3], 10)
      } else {
        // 2. Check DD/MM/YYYY or D/M/YYYY
        const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
        if (dmyMatch) {
          day = parseInt(dmyMatch[1], 10)
          month = parseInt(dmyMatch[2], 10)
          year = parseInt(dmyMatch[3], 10)
        } else if (/^\d{8}$/.test(s)) {
          // 3. Check YYYYMMDD
          year = parseInt(s.slice(0, 4), 10)
          month = parseInt(s.slice(4, 6), 10)
          day = parseInt(s.slice(6, 8), 10)
        } else {
          // 4. Fallback to Date parser
          const parsed = new Date(s)
          if (!isNaN(parsed.getTime())) {
            year = parsed.getFullYear()
            month = parsed.getMonth() + 1
            day = parsed.getDate()
          }
        }
      }
    }

    if (!year || !month || !day || month < 1 || month > 12) {
      return typeof dateVal === 'string' ? dateVal : fallback
    }

    const beYear = year > 2400 ? year : year + 543
    return `${day} ${THAI_MONTH_NAMES_SHORT[month - 1]} ${beYear}`
  } catch {
    return typeof dateVal === 'string' ? dateVal : fallback
  }
}

/**
 * Format date range into Thai Buddhist format: e.g. "1 ต.ค. 2569 ถึง 31 ต.ค. 2569"
 */
export function formatThaiDateRange(d1?: string | Date | null, d2?: string | Date | null, fallback: string = '—'): string {
  if (!d1 && !d2) return fallback
  if (d1 && !d2) return formatThaiDate(d1, fallback)
  if (!d1 && d2) return formatThaiDate(d2, fallback)
  return `${formatThaiDate(d1, fallback)} ถึง ${formatThaiDate(d2, fallback)}`
}
