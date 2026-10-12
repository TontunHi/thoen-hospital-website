/**
 * Event Time Utilities for Hospital Events Module.
 * 
 * Ensures that event dates and scan times (DATETIME columns in MySQL)
 * are stored literally as Thailand Local Time (Asia/Bangkok, UTC+7),
 * and displayed consistently on the website and QR check-in flows.
 */

interface BangkokDateParts {
  year: number
  month: number // 1-12
  day: number
  hours: number
  minutes: number
  seconds: number
}

/**
 * Extracts Asia/Bangkok date components from any Date object or ISO string.
 */
export function getBangkokDateParts(input: Date | string): BangkokDateParts {
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date provided to getBangkokDateParts')
  }

  // Format with Intl into Asia/Bangkok
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(d)
  const partMap: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value
    }
  }

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hours: parseInt(partMap.hour, 10),
    minutes: parseInt(partMap.minute, 10),
    seconds: parseInt(partMap.second, 10),
  }
}

/**
 * Parses user input (datetime-local string, ISO string, or Date)
 * into a Date object suitable for Prisma MySQL DATETIME storage.
 * 
 * Prisma writes the UTC representation of Date into MySQL DATETIME.
 * Therefore, we construct a Date where UTC parts match the Bangkok local time,
 * ensuring MySQL DATETIME literally stores 'YYYY-MM-DD HH:mm:ss' in Thai time.
 */
export function toDbThaiDateTime(input: string | Date | null | undefined): Date | null {
  if (!input) return null

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null

    // Check if input is a datetime-local format without timezone (e.g., '2026-10-13T08:00' or '2026-10-13 08:00')
    const localMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (localMatch) {
      const year = parseInt(localMatch[1], 10)
      const month = parseInt(localMatch[2], 10)
      const day = parseInt(localMatch[3], 10)
      const hours = parseInt(localMatch[4], 10)
      const minutes = parseInt(localMatch[5], 10)
      const seconds = localMatch[6] ? parseInt(localMatch[6], 10) : 0
      return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
    }

    // Input has timezone or is full ISO string
    const d = new Date(trimmed)
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date string: ${input}`)
    }
    const bkk = getBangkokDateParts(d)
    return new Date(Date.UTC(bkk.year, bkk.month - 1, bkk.day, bkk.hours, bkk.minutes, bkk.seconds))
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new Error('Invalid Date object')
    }
    const bkk = getBangkokDateParts(input)
    return new Date(Date.UTC(bkk.year, bkk.month - 1, bkk.day, bkk.hours, bkk.minutes, bkk.seconds))
  }

  return null
}

/**
 * Returns current timestamp in Bangkok representation for DB storage.
 */
export function getNowBangkokForDb(): Date {
  const bkk = getBangkokDateParts(new Date())
  return new Date(Date.UTC(bkk.year, bkk.month - 1, bkk.day, bkk.hours, bkk.minutes, bkk.seconds))
}

/**
 * Converts a Date read from Prisma MySQL DATETIME (where UTC components represent Bangkok time)
 * into an ISO 8601 string with '+07:00' timezone offset.
 * 
 * Example: '2026-10-13T08:00:00+07:00'
 */
export function toBangkokIsoString(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const y = pad(d.getUTCFullYear())
  const m = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  const h = pad(d.getUTCHours())
  const min = pad(d.getUTCMinutes())
  const s = pad(d.getUTCSeconds())

  return `${y}-${m}-${day}T${h}:${min}:${s}+07:00`
}

/**
 * Converts a Date read from MySQL DATETIME into the true UTC instant.
 * Since the DB stores Thai time in UTC parts (e.g. 08:00 UTC parts = 08:00 Bangkok time),
 * Bangkok is UTC+7, so true UTC is 7 hours earlier.
 */
export function parseDbThaiTimeToUtc(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date for parseDbThaiTimeToUtc')
  }
  return new Date(d.getTime() - 7 * 60 * 60 * 1000)
}

/**
 * Validates whether the check-in window is open for an event.
 */
export function validateCheckinWindow(
  checkinOpenTime: Date | string,
  checkinCloseTime: Date | string,
  now: Date = new Date()
): {
  isOpen: boolean
  isEarly: boolean
  isLate: boolean
  openUtc: Date
  closeUtc: Date
  openTimeStr: string
  closeTimeStr: string
} {
  const openUtc = parseDbThaiTimeToUtc(checkinOpenTime)
  const closeUtc = parseDbThaiTimeToUtc(checkinCloseTime)

  const isEarly = now < openUtc
  const isLate = now > closeUtc
  const isOpen = !isEarly && !isLate

  // Format Thai time string (HH:mm น.)
  const pad = (n: number) => String(n).padStart(2, '0')
  const openD = typeof checkinOpenTime === 'string' ? new Date(checkinOpenTime) : checkinOpenTime
  const closeD = typeof checkinCloseTime === 'string' ? new Date(checkinCloseTime) : checkinCloseTime
  
  const openTimeStr = `${pad(openD.getUTCHours())}:${pad(openD.getUTCMinutes())} น.`
  const closeTimeStr = `${pad(closeD.getUTCHours())}:${pad(closeD.getUTCMinutes())} น.`

  return {
    isOpen,
    isEarly,
    isLate,
    openUtc,
    closeUtc,
    openTimeStr,
    closeTimeStr,
  }
}
