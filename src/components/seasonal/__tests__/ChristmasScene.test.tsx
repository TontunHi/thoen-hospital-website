import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useSearchParams } from 'next/navigation'
import ChristmasScene, { isChristmasSeason } from '../ChristmasScene'

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: () => null,
  })),
}))

describe('ChristmasScene - isChristmasSeason', () => {
  it('returns true when date is within the Christmas & New Year window (Nov 25 to Jan 5 in Asia/Bangkok)', () => {
    // Nov 25 in Bangkok (2026-11-25T10:15:00+07:00 -> 2026-11-25T03:15:00Z)
    expect(isChristmasSeason(new Date('2026-11-25T03:15:00Z'))).toBe(true)

    // Christmas Day (2026-12-25T12:00:00+07:00 -> 2026-12-25T05:00:00Z)
    expect(isChristmasSeason(new Date('2026-12-25T05:00:00Z'))).toBe(true)

    // New Year's Day (2027-01-01T00:01:00+07:00 -> 2026-12-31T17:01:00Z)
    expect(isChristmasSeason(new Date('2026-12-31T17:01:00Z'))).toBe(true)

    // End of window Jan 5 (2027-01-05T23:59:00+07:00 -> 2027-01-05T16:59:00Z)
    expect(isChristmasSeason(new Date('2027-01-05T16:59:00Z'))).toBe(true)
  })

  it('returns false when outside the Christmas window', () => {
    // Nov 24 in Bangkok (2026-11-24T23:59:00+07:00 -> 2026-11-24T16:59:00Z)
    expect(isChristmasSeason(new Date('2026-11-24T16:59:00Z'))).toBe(false)

    // Jan 6 in Bangkok (2027-01-06T00:01:00+07:00 -> 2027-01-05T17:01:00Z)
    expect(isChristmasSeason(new Date('2027-01-05T17:01:00Z'))).toBe(false)

    // Songkran in April
    expect(isChristmasSeason(new Date('2026-04-13T05:00:00Z'))).toBe(false)
  })
})

describe('ChristmasScene Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSearchParams).mockReturnValue({
      get: () => null,
    } as unknown as ReturnType<typeof useSearchParams>)
  })

  it('renders the Three.js 3D stage host, fairy garland, and frost corner ornaments when active', () => {
    const { container, getByTestId } = render(<ChristmasScene forceActive />)
    const wrapper = getByTestId('christmas-scene')
    expect(wrapper).toBeTruthy()
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')

    const stageHost = getByTestId('christmas-3d-stage')
    expect(stageHost).toBeTruthy()

    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(3) // 1 garland cord + 2 corner frost ornaments
  })

  it('does not render when disabled via ?theme=normal query param', () => {
    vi.mocked(useSearchParams).mockReturnValue({
      get: (param: string) => (param === 'theme' ? 'normal' : null),
    } as unknown as ReturnType<typeof useSearchParams>)

    const { queryByTestId } = render(<ChristmasScene forceActive />)
    expect(queryByTestId('christmas-scene')).toBeNull()
  })
})
