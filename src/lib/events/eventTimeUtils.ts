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
 * Formats a Date or date string to 'YYYY-MM-DD HH:mm:ss' in Bangkok time for direct SQL queries.
 */
export function toDbSqlDateTime(input: string | Date | null | undefined): string | null {
  if (!input) return null

  // If already a Date object, its UTC components literally represent Bangkok time
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${input.getUTCFullYear()}-${pad(input.getUTCMonth() + 1)}-${pad(input.getUTCDate())} ${pad(input.getUTCHours())}:${pad(input.getUTCMinutes())}:${pad(input.getUTCSeconds())}`
  }

  const d = toDbThaiDateTime(input)
  if (!d) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/**
 * Returns current Bangkok time as 'YYYY-MM-DD HH:mm:ss' string for direct SQL queries.
 */
export function getNowBangkokForDbSql(): string {
  const d = getNowBangkokForDb()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/**
 * Converts a Date read from Prisma MySQL DATETIME (where UTC components represent Bangkok time)
 * or a DATETIME string read from MySQL into an ISO 8601 string with '+07:00' timezone offset.
 * 
 * Example: '2026-10-13T08:00:00+07:00'
 */
export function toBangkokIsoString(date: Date | string | null | undefined): string | null {
  if (!date) return null

  if (typeof date === 'string') {
    const trimmed = date.trim()
    if (!trimmed) return null

    // 1. Literal MySQL DATETIME string without timezone (e.g. '2026-10-13 08:00:00' or '2026-10-13T08:00' or '2026-10-13 08:00')
    const localMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/)
    if (localMatch) {
      const [, y, m, d, hh, mm, ss] = localMatch
      return `${y}-${m}-${d}T${hh}:${mm}:${ss || '00'}+07:00`
    }

    // 2. String already with Bangkok timezone offset (+07:00 or +0700)
    const bkkOffsetMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\+07:?00$/)
    if (bkkOffsetMatch) {
      const [, y, m, d, hh, mm, ss] = bkkOffsetMatch
      return `${y}-${m}-${d}T${hh}:${mm}:${ss || '00'}+07:00`
    }

    // 3. String with other timezone (e.g. UTC ISO '2026-10-13T01:00:00.000Z')
    const dObj = new Date(trimmed)
    if (isNaN(dObj.getTime())) return null
    const bkk = getBangkokDateParts(dObj)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${bkk.year}-${pad(bkk.month)}-${pad(bkk.day)}T${pad(bkk.hours)}:${pad(bkk.minutes)}:${pad(bkk.seconds)}+07:00`
  }

  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = pad(date.getUTCFullYear())
    const m = pad(date.getUTCMonth() + 1)
    const day = pad(date.getUTCDate())
    const h = pad(date.getUTCHours())
    const min = pad(date.getUTCMinutes())
    const s = pad(date.getUTCSeconds())
    return `${y}-${m}-${day}T${h}:${min}:${s}+07:00`
  }

  return null
}

/**
 * Converts a Date or string read from MySQL DATETIME into the true UTC instant.
 * Since the DB stores Thai time literally (or in UTC parts where UTC hours = Bangkok hours),
 * Bangkok is UTC+7, so true UTC is 7 hours earlier.
 */
export function parseDbThaiTimeToUtc(date: Date | string): Date {
  if (typeof date === 'string') {
    const trimmed = date.trim()
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/)
    if (match) {
      const [, y, m, d, hh, mm, ss] = match
      return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss || '00'}+07:00`)
    }
    const dObj = new Date(trimmed)
    if (isNaN(dObj.getTime())) {
      throw new Error('Invalid date for parseDbThaiTimeToUtc')
    }
    return dObj
  }

  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date for parseDbThaiTimeToUtc')
    }
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours() - 7,
      date.getUTCMinutes(),
      date.getUTCSeconds()
    ))
  }

  throw new Error('Invalid date for parseDbThaiTimeToUtc')
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

  // Format Thai time string (HH:mm น.) in Bangkok local time
  const bkkOpen = getBangkokDateParts(openUtc)
  const bkkClose = getBangkokDateParts(closeUtc)
  const pad = (n: number) => String(n).padStart(2, '0')

  const openTimeStr = `${pad(bkkOpen.hours)}:${pad(bkkOpen.minutes)} น.`
  const closeTimeStr = `${pad(bkkClose.hours)}:${pad(bkkClose.minutes)} น.`

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
