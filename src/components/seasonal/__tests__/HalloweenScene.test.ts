import { describe, it, expect } from 'vitest'
import { isHalloweenSeason } from '../HalloweenScene'

describe('HalloweenScene - isHalloweenSeason', () => {
  it('returns true when date is within the Halloween window (Oct 27 to Oct 31 in Asia/Bangkok)', () => {
    // Current date (2026-10-27T15:56:00+07:00 -> 2026-10-27T08:56:00Z)
    const today = new Date('2026-10-27T08:56:00Z')
    expect(isHalloweenSeason(today)).toBe(true)

    // Start of Oct 27 (2026-10-27T00:00:00+07:00 -> 2026-10-26T17:00:00Z)
    const startWindow = new Date('2026-10-26T17:00:00Z')
    expect(isHalloweenSeason(startWindow)).toBe(true)

    // Mid Halloween period (2026-10-29T12:00:00+07:00 -> 2026-10-29T05:00:00Z)
    const midPeriod = new Date('2026-10-29T05:00:00Z')
    expect(isHalloweenSeason(midPeriod)).toBe(true)

    // End of Halloween night (2026-10-31T23:59:00+07:00 -> 2026-10-31T16:59:00Z)
    const endOfHalloween = new Date('2026-10-31T16:59:00Z')
    expect(isHalloweenSeason(endOfHalloween)).toBe(true)
  })

  it('returns false when outside the Halloween window', () => {
    // Before Oct 27 (2026-10-26T23:59:00+07:00 -> 2026-10-26T16:59:00Z)
    const beforeOct27 = new Date('2026-10-26T16:59:00Z')
    expect(isHalloweenSeason(beforeOct27)).toBe(false)

    // Right after Halloween: Start of November (2026-11-01T00:00:01+07:00 -> 2026-10-31T17:00:01Z)
    const novFirst = new Date('2026-10-31T17:00:01Z')
    expect(isHalloweenSeason(novFirst)).toBe(false)

    // Songkran in April
    const april = new Date('2026-04-13T05:00:00Z')
    expect(isHalloweenSeason(april)).toBe(false)
  })
})
