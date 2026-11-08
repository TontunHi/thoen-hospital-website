import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import LoyKrathongScene, { isLoyKrathongSeason } from '../LoyKrathongScene'

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: (param: string) => (param === 'theme' ? 'loy-krathong' : null),
  })),
}))

vi.mock('next/image', () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ''} />
  },
}))

describe('LoyKrathongScene - isLoyKrathongSeason', () => {
  it('returns true when date is within the Loy Krathong season (Nov 1 to Nov 30 in Asia/Bangkok)', () => {
    // Start of November (2026-11-01T00:00:00+07:00 -> 2026-10-31T17:00:00Z)
    const startWindow = new Date('2026-10-31T17:00:00Z')
    expect(isLoyKrathongSeason(startWindow)).toBe(true)

    // Mid November (2026-11-24T18:00:00+07:00 -> 2026-11-24T11:00:00Z)
    const midFestival = new Date('2026-11-24T11:00:00Z')
    expect(isLoyKrathongSeason(midFestival)).toBe(true)

    // End of November (2026-11-30T23:59:00+07:00 -> 2026-11-30T16:59:00Z)
    const endOfFestival = new Date('2026-11-30T16:59:00Z')
    expect(isLoyKrathongSeason(endOfFestival)).toBe(true)
  })

  it('returns false when outside of the festival window', () => {
    // During Halloween in late October (2026-10-27T06:35:00Z) -> false for Loy Krathong
    const halloweenDate = new Date('2026-10-27T06:35:00Z')
    expect(isLoyKrathongSeason(halloweenDate)).toBe(false)

    // Last day of October (2026-10-31T23:59:00+07:00 -> 2026-10-31T16:59:00Z)
    const endOfOct = new Date('2026-10-31T16:59:00Z')
    expect(isLoyKrathongSeason(endOfOct)).toBe(false)

    // Day after seasonal window (2026-12-01T00:01:00+07:00 -> 2026-11-30T17:01:00Z)
    const afterSeason = new Date('2026-11-30T17:01:00Z')
    expect(isLoyKrathongSeason(afterSeason)).toBe(false)

    // Songkran in April
    const april = new Date('2026-04-13T05:00:00Z')
    expect(isLoyKrathongSeason(april)).toBe(false)
  })
})

describe('LoyKrathongScene Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the animated Loy Krathong elements and artwork when active', () => {
    const { container } = render(<LoyKrathongScene />)
    const wrapper = container.querySelector('[aria-hidden="true"]')
    expect(wrapper).toBeTruthy()

    // Verifies SVG krathongs, lanterns and fireworks exist in the DOM
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(10) // 8 lanterns + 5 krathongs + 3 fireworks
  })
})
