import { describe, it, expect, vi } from 'vitest'
import {
  splitSeamlessReps,
  matchesSeamlessRepSearch,
  enrichRowsWithSeamless,
  enrichItemsWithSeamlessCache,
  type SeamlessEnricherFetcher,
} from '../rcmSeamlessEnricher'

describe('rcmSeamlessEnricher (Zero-SQL Gateway Adapter)', () => {
  it('splits comma-separated seamless reps and deduplicates', () => {
    expect(splitSeamlessReps('DDSA68103100077, DDSA69093000090, DDSA68103100077')).toEqual([
      'DDSA68103100077',
      'DDSA69093000090',
    ])
    expect(splitSeamlessReps(null)).toEqual([])
    expect(splitSeamlessReps('')).toEqual([])
  })

  it('matches seamless rep search in camelCase and snake_case', () => {
    expect(
      matchesSeamlessRepSearch(
        { repSeamless: 'DDSA68103100077,DDSA69093000090' },
        'ddsa690930'
      )
    ).toBe(true)
    expect(
      matchesSeamlessRepSearch({ rep_seamless: 'DDSA68103100077' }, '68103100077')
    ).toBe(true)
    expect(matchesSeamlessRepSearch({ repSeamless: null }, 'ddsa')).toBe(false)
  })

  it('enriches OPD (VN) and IPD (AN) rows with per-Rep breakdown from Gateway', async () => {
    const mockFetcher: SeamlessEnricherFetcher = vi.fn().mockResolvedValue({
      vnRows: [
        {
          k: '681010142318',
          rep: 'DDSA68103100077',
          fund: 'DMIS-กายภาพบำบัด (IMC)',
          type: 'ฟื้นฟูสมรรถภาพด้านการแพทย์',
          collected: 450,
          compensated: 450,
        },
        {
          k: '681010142318',
          rep: 'DDSA69093000090',
          fund: 'DMIS-กายภาพบำบัด (IMC)',
          type: 'ค่าบริการกายภาพบำบัด',
          collected: 100,
          compensated: 100,
        },
      ],
      anRows: [
        {
          k: '680012345',
          rep: 'DDSA68110000111',
          fund: 'DMIS-IPD',
          type: 'บริการผู้ป่วยใน',
          collected: 1500,
          compensated: 1200,
        },
      ],
    })

    const rows = [
      { vn: '681010142318', hn: '0038388', compensated: 100 },
      { vn: '-', an: '680012345', hn: '0011111', compensated: 5000 },
    ]

    const enriched = await enrichRowsWithSeamless(rows, mockFetcher)

    expect(mockFetcher).toHaveBeenCalledWith({
      vns: ['681010142318'],
      ans: ['680012345'],
    })
    expect(enriched[0].repSeamless).toBe('DDSA68103100077,DDSA69093000090')
    expect(enriched[0].rep_seamless).toBe('DDSA68103100077,DDSA69093000090')
    expect(enriched[0].compensatedSeamless).toBe(550)
    expect(enriched[0].compensated_seamless).toBe(550)
    expect(enriched[0].seamlessRepItems).toHaveLength(2)
    expect(enriched[0].seamlessRepItems?.[0]).toEqual({
      rep: 'DDSA68103100077',
      fund: 'DMIS-กายภาพบำบัด (IMC)',
      type: 'ฟื้นฟูสมรรถภาพด้านการแพทย์',
      collected: 450,
      compensated: 450,
    })

    expect(enriched[1].repSeamless).toBe('DDSA68110000111')
    expect(enriched[1].compensatedSeamless).toBe(1200)
    expect(enriched[1].seamlessRepItems).toHaveLength(1)
  })

  it('caches seamless enrichment via enrichItemsWithSeamlessCache when __includeSeamless is enabled', async () => {
    const mockFetcher: SeamlessEnricherFetcher = Object.assign(
      vi.fn().mockResolvedValue({
        vnRows: [
          {
            k: '690101000001',
            rep: 'DDSA69013100001',
            fund: 'DMIS-TEST',
            type: 'TEST',
            collected: 300,
            compensated: 300,
          },
        ],
        anRows: [],
      }),
      { __includeSeamless: true }
    )

    const items = [{ vn: '690101000001', hn: '0099999' }]
    const res1 = await enrichItemsWithSeamlessCache('test-cache-key', items, mockFetcher, true)
    const res2 = await enrichItemsWithSeamlessCache('test-cache-key', items, mockFetcher, false)

    expect(mockFetcher).toHaveBeenCalledTimes(1)
    expect(res1[0]).toMatchObject({
      repSeamless: 'DDSA69013100001',
      compensatedSeamless: 300,
    })
    expect(res2[0]).toMatchObject({
      repSeamless: 'DDSA69013100001',
      compensatedSeamless: 300,
    })
  })
})
