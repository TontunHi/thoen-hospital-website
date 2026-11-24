import { describe, it, expect } from 'vitest'
import {
  buildRepBreakdownSummary,
  extractRepPrefix,
  matchesRepFilter,
  NO_REP_FILTER_VALUE,
  parseRepFilterParam,
} from '../rcmRepTagHelper'

describe('rcmRepTagHelper', () => {
  it('extracts uppercase alphabetic prefixes from Seamless REP numbers', () => {
    expect(extractRepPrefix('DMOR68122400058')).toBe('DMOR')
    expect(extractRepPrefix('DDSA69093000090')).toBe('DDSA')
    expect(extractRepPrefix('690100151')).toBeNull()
  })

  it('parses comma-separated reps parameter cleanly', () => {
    expect(parseRepFilterParam('690100151, DMOR68122400058 , 690100151')).toEqual([
      '690100151',
      'DMOR68122400058',
    ])
    expect(parseRepFilterParam('')).toEqual([])
    expect(parseRepFilterParam(undefined)).toEqual([])
  })

  it('builds TAG breakdown and REP items without double-counting multi-REP visits', () => {
    const rows = [
      {
        vn: '681212070209',
        rep: '690100151',
        compensated: 100,
        fund: 'OP_PP',
        repSeamless: 'DMOR68122400058',
        compensatedSeamless: 50,
        seamlessFunds: 'ระบบหมอพร้อม',
        seamlessRepItems: [
          {
            rep: 'DMOR68122400058',
            fund: 'ระบบหมอพร้อม',
            type: 'OP',
            collected: 50,
            compensated: 50,
          },
        ],
      },
      {
        vn: '681211060645',
        rep: '690100151',
        compensated: 120,
        fund: 'OP_PP',
        repSeamless: null,
        compensatedSeamless: 0,
        seamlessRepItems: [],
      },
      {
        vn: '681211099999',
        rep: null,
        compensated: 0,
        fund: null,
        repSeamless: null,
        compensatedSeamless: 0,
        seamlessRepItems: [],
      },
    ]

    const summary = buildRepBreakdownSummary(rows)
    expect(summary.totalVisits).toBe(3)
    expect(summary.withAnyRepCount).toBe(2)
    expect(summary.withEclaimRepCount).toBe(2)
    expect(summary.withSeamlessRepCount).toBe(1)
    expect(summary.withMultipleRepsCount).toBe(1)
    expect(summary.withoutRepCount).toBe(1)
    expect(summary.totalEclaimCompensated).toBe(220)
    expect(summary.totalSeamlessCompensated).toBe(50)

    expect(summary.tagGroups.map((g) => g.groupKey)).toEqual([
      'eclaim',
      'seamless:DMOR',
      'none',
    ])

    const dmorGroup = summary.tagGroups.find((g) => g.groupKey === 'seamless:DMOR')!
    expect(dmorGroup.label).toBe('DMOR · ระบบหมอพร้อม')
    expect(dmorGroup.visitCount).toBe(1)
    expect(dmorGroup.compensated).toBe(50)

    const rep6901 = summary.repItems.find((r) => r.rep === '690100151')!
    expect(rep6901.visitCount).toBe(2)
    expect(rep6901.compensated).toBe(220)
  })

  it('matches selected REPs across primary, Seamless, and __NO_REP__', () => {
    const rowBoth = {
      rep: '690100151',
      seamlessRepItems: [{ rep: 'DMOR68122400058', fund: 'ระบบหมอพร้อม', type: null, collected: 0, compensated: 50 }],
    }
    const rowEmpty = { rep: null, repSeamless: null, seamlessRepItems: [] }

    expect(matchesRepFilter(rowBoth, [])).toBe(true)
    expect(matchesRepFilter(rowBoth, ['690100151'])).toBe(true)
    expect(matchesRepFilter(rowBoth, ['dmor68122400058'])).toBe(true)
    expect(matchesRepFilter(rowBoth, ['OTHER_REP'])).toBe(false)
    expect(matchesRepFilter(rowEmpty, [NO_REP_FILTER_VALUE])).toBe(true)
    expect(matchesRepFilter(rowBoth, [NO_REP_FILTER_VALUE])).toBe(false)
  })
})
