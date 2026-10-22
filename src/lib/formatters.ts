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
  const clean = name.replace(/^(นาย|นางสาว|นาง|นพ\.|พญ\.|ทพ\.|ภก\.|ภญ\.|พยาบาล|ดร\.)\s*/, '').trim()
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
