import { describe, it, expect } from 'vitest'
import {
  toDbThaiDateTime,
  toBangkokIsoString,
  parseDbThaiTimeToUtc,
  validateCheckinWindow,
  getBangkokDateParts,
} from '../eventTimeUtils'

describe('eventTimeUtils', () => {
  describe('toDbThaiDateTime', () => {
    it('converts datetime-local string (YYYY-MM-DDTHH:mm) directly into UTC parts matching Thai time', () => {
      const result = toDbThaiDateTime('2026-10-13T08:00')
      expect(result).not.toBeNull()
      expect(result!.getUTCFullYear()).toBe(2026)
      expect(result!.getUTCMonth()).toBe(9) // 0-indexed: 9 = October
      expect(result!.getUTCDate()).toBe(13)
      expect(result!.getUTCHours()).toBe(8)
      expect(result!.getUTCMinutes()).toBe(0)
      expect(result!.getUTCSeconds()).toBe(0)
    })

    it('converts space-separated datetime string (YYYY-MM-DD HH:mm:ss)', () => {
      const result = toDbThaiDateTime('2026-10-13 16:30:45')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(16)
      expect(result!.getUTCMinutes()).toBe(30)
      expect(result!.getUTCSeconds()).toBe(45)
    })

    it('converts UTC ISO string to its Bangkok local representation', () => {
      // 2026-10-13T01:00:00Z in UTC is 08:00:00 in Asia/Bangkok
      const result = toDbThaiDateTime('2026-10-13T01:00:00.000Z')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(8)
      expect(result!.getUTCMinutes()).toBe(0)
    })

    it('converts Bangkok ISO string (+07:00)', () => {
      const result = toDbThaiDateTime('2026-10-13T08:00:00+07:00')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(8)
      expect(result!.getUTCMinutes()).toBe(0)
    })

    it('handles null and empty input gracefully', () => {
      expect(toDbThaiDateTime(null)).toBeNull()
      expect(toDbThaiDateTime(undefined)).toBeNull()
      expect(toDbThaiDateTime('')).toBeNull()
    })
  })

  describe('toBangkokIsoString', () => {
    it('formats DB Date into ISO string with +07:00 timezone offset', () => {
      // Date stored with UTC hours = 8 (meaning 08:00 Bangkok)
      const dbDate = new Date(Date.UTC(2026, 9, 13, 8, 0, 0))
      const iso = toBangkokIsoString(dbDate)
      expect(iso).toBe('2026-10-13T08:00:00+07:00')
    })

    it('handles null gracefully', () => {
      expect(toBangkokIsoString(null)).toBeNull()
      expect(toBangkokIsoString(undefined)).toBeNull()
    })
  })

  describe('parseDbThaiTimeToUtc', () => {
    it('subtracts 7 hours from the DB UTC parts to produce the real UTC instant', () => {
      // DB has 08:00:00 in UTC parts
      const dbDate = new Date(Date.UTC(2026, 9, 13, 8, 0, 0))
      const trueUtc = parseDbThaiTimeToUtc(dbDate)
      // True UTC is 01:00:00Z
      expect(trueUtc.toISOString()).toBe('2026-10-13T01:00:00.000Z')
    })
  })

  describe('validateCheckinWindow', () => {
    // Event: 08:00 - 10:00 Bangkok time (DB stores 08:00:00 and 10:00:00)
    const openTime = new Date(Date.UTC(2026, 9, 13, 8, 0, 0))
    const closeTime = new Date(Date.UTC(2026, 9, 13, 10, 0, 0))

    it('flags early if current time is before open time', () => {
      // 07:45 Bangkok time = 00:45 UTC
      const now = new Date('2026-10-13T00:45:00.000Z')
      const result = validateCheckinWindow(openTime, closeTime, now)
      expect(result.isEarly).toBe(true)
      expect(result.isOpen).toBe(false)
      expect(result.isLate).toBe(false)
      expect(result.openTimeStr).toBe('08:00 น.')
    })

    it('flags open if current time is within open window', () => {
      // 08:30 Bangkok time = 01:30 UTC
      const now = new Date('2026-10-13T01:30:00.000Z')
      const result = validateCheckinWindow(openTime, closeTime, now)
      expect(result.isOpen).toBe(true)
      expect(result.isEarly).toBe(false)
      expect(result.isLate).toBe(false)
    })

    it('flags late if current time is after close time', () => {
      // 10:15 Bangkok time = 03:15 UTC
      const now = new Date('2026-10-13T03:15:00.000Z')
      const result = validateCheckinWindow(openTime, closeTime, now)
      expect(result.isLate).toBe(true)
      expect(result.isOpen).toBe(false)
      expect(result.isEarly).toBe(false)
      expect(result.closeTimeStr).toBe('10:00 น.')
    })
  })

  describe('getBangkokDateParts', () => {
    it('correctly extracts components in Asia/Bangkok', () => {
      // 2026-10-13T01:30:00Z = 2026-10-13 08:30:00 in Bangkok
      const parts = getBangkokDateParts(new Date('2026-10-13T01:30:00.000Z'))
      expect(parts.year).toBe(2026)
      expect(parts.month).toBe(10)
      expect(parts.day).toBe(13)
      expect(parts.hours).toBe(8)
      expect(parts.minutes).toBe(30)
    })
  })
})
