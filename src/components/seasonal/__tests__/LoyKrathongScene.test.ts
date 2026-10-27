import { describe, it, expect } from 'vitest'
import { isLoyKrathongSeason } from '../LoyKrathongScene'

describe('LoyKrathongScene - isLoyKrathongSeason', () => {
  it('returns true when date is within the Loy Krathong season (Oct 25 to Nov 30 in Asia/Bangkok)', () => {
    // Current date in late October (2026-10-27)
    const today = new Date('2026-10-27T06:35:00Z')
    expect(isLoyKrathongSeason(today)).toBe(true)

    // Start of seasonal window (2026-10-25T00:00:00+07:00 -> 2026-10-24T17:00:00Z)
    const startWindow = new Date('2026-10-24T17:00:00Z')
    expect(isLoyKrathongSeason(startWindow)).toBe(true)

    // Mid November (2026-11-24T18:00:00+07:00 -> 2026-11-24T11:00:00Z)
    const midFestival = new Date('2026-11-24T11:00:00Z')
    expect(isLoyKrathongSeason(midFestival)).toBe(true)

    // End of November (2026-11-30T23:59:00+07:00 -> 2026-11-30T16:59:00Z)
    const endOfFestival = new Date('2026-11-30T16:59:00Z')
    expect(isLoyKrathongSeason(endOfFestival)).toBe(true)
  })

  it('returns false when outside of the festival window', () => {
    // Before seasonal window (2026-10-24T23:59:00+07:00 -> 2026-10-24T16:59:00Z)
    const beforeSeason = new Date('2026-10-24T16:59:00Z')
    expect(isLoyKrathongSeason(beforeSeason)).toBe(false)

    // Day after seasonal window (2026-12-01T00:01:00+07:00 -> 2026-11-30T17:01:00Z)
    const afterSeason = new Date('2026-11-30T17:01:00Z')
    expect(isLoyKrathongSeason(afterSeason)).toBe(false)

    // Songkran in April
    const april = new Date('2026-04-13T05:00:00Z')
    expect(isLoyKrathongSeason(april)).toBe(false)
  })
})
