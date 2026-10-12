import { describe, it, expect } from 'vitest'
import { calculateThaiFiscalYear } from '../eventUtils'

describe('calculateThaiFiscalYear', () => {
  it('correctly calculates Thai fiscal year for October (start of fiscal year)', () => {
    // 1 Oct 2026 -> Fiscal Year 2570
    const d1 = new Date('2026-10-01T08:00:00+07:00')
    expect(calculateThaiFiscalYear(d1)).toBe('2570')

    // 12 Oct 2026 -> Fiscal Year 2570
    const d2 = new Date('2026-10-12T10:00:00+07:00')
    expect(calculateThaiFiscalYear(d2)).toBe('2570')
  })

  it('correctly calculates Thai fiscal year for September (end of fiscal year)', () => {
    // 30 Sep 2026 -> Fiscal Year 2569
    const d = new Date('2026-09-30T17:00:00+07:00')
    expect(calculateThaiFiscalYear(d)).toBe('2569')
  })

  it('correctly calculates Thai fiscal year for mid-year months (Jan - Sep)', () => {
    // 15 Jan 2027 -> Fiscal Year 2570
    expect(calculateThaiFiscalYear(new Date('2027-01-15T09:00:00+07:00'))).toBe('2570')

    // 15 Jun 2027 -> Fiscal Year 2570
    expect(calculateThaiFiscalYear(new Date('2027-06-15T09:00:00+07:00'))).toBe('2570')

    // 30 Sep 2027 -> Fiscal Year 2570
    expect(calculateThaiFiscalYear(new Date('2027-09-30T23:59:59+07:00'))).toBe('2570')
  })

  it('rolls over to next fiscal year on October 1st', () => {
    // 1 Oct 2027 -> Fiscal Year 2571
    expect(calculateThaiFiscalYear(new Date('2027-10-01T00:00:00+07:00'))).toBe('2571')
  })

  it('handles string input dates correctly', () => {
    expect(calculateThaiFiscalYear('2026-10-12')).toBe('2570')
    expect(calculateThaiFiscalYear('2026-09-20')).toBe('2569')
    expect(calculateThaiFiscalYear('2027-05-10')).toBe('2570')
  })

  it('defaults to current fiscal year when no date or invalid date is passed', () => {
    const currentFY = calculateThaiFiscalYear()
    expect(typeof currentFY).toBe('string')
    expect(currentFY.length).toBe(4)

    // Invalid date fallback
    expect(calculateThaiFiscalYear('invalid-date')).toBe(currentFY)
    expect(calculateThaiFiscalYear(null)).toBe(currentFY)
  })
})
