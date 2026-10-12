/**
 * Event utility functions for Hospital Events and Thai Calendar.
 */

/**
 * Calculates Thai Fiscal Year (ปีงบประมาณ พ.ศ.) in Asia/Bangkok timezone.
 * Government fiscal year starts October 1st and ends September 30th.
 * E.g., Oct 2026 -> B.E. 2570
 *
 * @param inputDate Optional date or date string (defaults to current date)
 * @returns Thai Fiscal Year string, e.g. "2570"
 */
export function calculateThaiFiscalYear(inputDate?: Date | string | null): string {
  const d = inputDate ? new Date(inputDate) : new Date()
  const validDate = isNaN(d.getTime()) ? new Date() : d

  // Consistently resolve date components in Thailand timezone (Asia/Bangkok)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(validDate)

  let year = validDate.getFullYear()
  let month = validDate.getMonth() + 1

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10)
    if (part.type === 'month') month = parseInt(part.value, 10)
  }

  const beYear = year + 543
  // Month is 1-indexed: 10 = October, 11 = November, 12 = December
  return String(month >= 10 ? beYear + 1 : beYear)
}
