import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmAncService } from '../rcmAncService'
import * as cacheModule from '@/lib/cache'

describe('RcmAncService (ANC 2.4 - 30011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockImplementation(async (_key, fetcher) => fetcher())
    vi.spyOn(cacheModule, 'invalidateCacheKey').mockReturnValue()
  })

  it('check30011AdpMapping returns true when ADP 30011 is mapped in s_drugitems', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([
      {
        icode: '3002538',
        name: 'ค่าฝากครรภ์ ครั้งที่ 1-8',
        strength: '',
        nhso_adp_code: '30011',
      },
    ])

    const result = await RcmAncService.check30011AdpMapping(mockExecutor)
    expect(result.isMapped).toBe(true)
    expect(result.mappedCount).toBe(1)
    expect(result.items[0].icode).toBe('3002538')
    expect(result.items[0].nhso_adp_code).toBe('30011')
  })

  it('check30011AdpMapping returns false when no items have ADP 30011', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmAncService.check30011AdpMapping(mockExecutor)
    expect(result.isMapped).toBe(false)
    expect(result.mappedCount).toBe(0)
    expect(result.items).toEqual([])
  })

  it('getService30011Report computes summary metrics and filters records accurately', async () => {
    const mockRows = [
      {
        vn: '691001001',
        cid: '1520800111111',
        hn: '0010001',
        ptname: 'น.ส.มาลี มีสุข',
        age: 26,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:00:00',
        authencode: 'AUTH001',
        pttypename: 'บัตรทอง',
        department: 'แผนกสูตินรีเวช',
        clinic: 'สูติกรรม',
        pdx: 'Z340',
        dx0: null,
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: '8878',
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        listname: 'ค่าฝากครรภ์ ครั้งที่ 1-8 30011',
        listname1: 'Sugar, Albumin',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP_001',
        compensated: 360,
        fund: 'DM14',
        subfund: 'ANC',
      },
      {
        vn: '691001002',
        cid: '1520800222222',
        hn: '0010002',
        ptname: 'นางสมศรี ใจดี',
        age: 32,
        nation: 'ไทย',
        vstdate: '2026-10-03',
        vsttime: '10:30:00',
        authencode: null,
        pttypename: 'ประกันสังคม',
        department: 'แผนกสูตินรีเวช',
        clinic: 'สูติกรรม',
        pdx: 'Z348',
        dx0: 'Z133',
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: null,
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        listname: 'ค่าฝากครรภ์ ครั้งที่ 1-8 30011',
        listname1: null,
        status: null,
        rep: null,
        compensated: 0,
        fund: null,
        subfund: null,
      },
    ]

    const mockExecutor = vi
      .fn()
      .mockImplementation((sql: string) => {
        if (sql.includes('SELECT icode, name')) {
          return Promise.resolve([
            { icode: '3002538', name: 'ค่าฝากครรภ์', strength: '', nhso_adp_code: '30011' },
          ])
        }
        return Promise.resolve(mockRows)
      })

    const result = await RcmAncService.getService30011Report(
      { ds1: '2026-10-01', ds2: '2026-10-31' },
      mockExecutor
    )

    expect(result.summary.totalVisits).toBe(2)
    expect(result.summary.uniquePatients).toBe(2)
    expect(result.summary.compensatedVisits).toBe(1)
    expect(result.summary.uncompensatedVisits).toBe(1)
    expect(result.summary.totalCompensated).toBe(360)
    expect(result.summary.compensationRate).toBe(50)
    expect(result.summary.withAuthenCount).toBe(1)
    expect(result.summary.withoutAuthenCount).toBe(1)
    expect(result.summary.withPdxCount).toBe(2)
    expect(result.summary.withOpCount).toBe(1)
    expect(result.items.length).toBe(2)
  })

  it('filters by COMPENSATED, UNCOMPENSATED, HAS_AUTHEN, and search query', async () => {
    const mockRows = [
      {
        vn: '691001001',
        cid: '1520800111111',
        hn: '0010001',
        ptname: 'น.ส.มาลี มีสุข',
        age: 26,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:00:00',
        authencode: 'AUTH001',
        pttypename: 'บัตรทอง',
        department: 'แผนกสูตินรีเวช',
        clinic: 'สูติกรรม',
        pdx: 'Z340',
        compensated: 360,
      },
      {
        vn: '691001002',
        cid: '1520800222222',
        hn: '0010002',
        ptname: 'นางสมศรี ใจดี',
        age: 32,
        nation: 'ไทย',
        vstdate: '2026-10-03',
        vsttime: '10:30:00',
        authencode: null,
        pttypename: 'ประกันสังคม',
        department: 'แผนกสูตินรีเวช',
        clinic: 'สูติกรรม',
        pdx: 'Z348',
        compensated: 0,
      },
    ]

    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT icode, name')) {
        return Promise.resolve([{ icode: '3002538', name: 'ฝากครรภ์', nhso_adp_code: '30011' }])
      }
      return Promise.resolve(mockRows)
    })

    // Filter COMPENSATED
    const compResult = await RcmAncService.getService30011Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', compensationFilter: 'COMPENSATED' },
      mockExecutor
    )
    expect(compResult.items.length).toBe(1)
    expect(compResult.items[0].hn).toBe('0010001')

    // Filter UNCOMPENSATED
    const uncompResult = await RcmAncService.getService30011Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', compensationFilter: 'UNCOMPENSATED' },
      mockExecutor
    )
    expect(uncompResult.items.length).toBe(1)
    expect(uncompResult.items[0].hn).toBe('0010002')

    // Filter HAS_AUTHEN
    const authenResult = await RcmAncService.getService30011Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', compensationFilter: 'HAS_AUTHEN' },
      mockExecutor
    )
    expect(authenResult.items.length).toBe(1)
    expect(authenResult.items[0].authencode).toBe('AUTH001')

    // Search by HN
    const searchResult = await RcmAncService.getService30011Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', search: '0010002', searchField: 'HN' },
      mockExecutor
    )
    expect(searchResult.items.length).toBe(1)
    expect(searchResult.items[0].ptname).toBe('นางสมศรี ใจดี')
  })
})
