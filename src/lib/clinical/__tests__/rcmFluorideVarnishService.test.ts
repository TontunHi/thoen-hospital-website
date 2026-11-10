import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmFluorideVarnishService,
  isUniversalCoverageScheme,
  type FluorideVarnishReportParams,
} from '../rcmFluorideVarnishService'

describe('RcmFluorideVarnishService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isUniversalCoverageScheme', () => {
    it('returns true for UCS / WEL / UC in maininscl', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
    })

    it('returns true for Thai UC keywords in pttypename', () => {
      expect(isUniversalCoverageScheme('', 'บัตรทอง')).toBe(true)
      expect(isUniversalCoverageScheme('', 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme('', '30 บาทรักษาทุกโรค')).toBe(true)
    })

    it('returns false for non-UC schemes', () => {
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ')).toBe(false)
      expect(isUniversalCoverageScheme('', '')).toBe(false)
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when ADP 15001 exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3009999',
          name: 'บริการเคลือบฟลูออไรด์วานิช 15001',
          strength: '',
          nhso_adp_code: '15001',
        },
      ])

      const result = await RcmFluorideVarnishService.checkAdpMapping(mockExecutor, true)
      expect(result.adpCode).toBe('15001')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('3009999')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['15001'],
        expect.any(Object)
      )
    })

    it('returns isMapped false when database query throws or returns empty', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB connection failed'))
      const result = await RcmFluorideVarnishService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getFluorideVarnishReport', () => {
    const mockRawRows = [
      {
        vn: '691001083001',
        cid: '1529900111221',
        hn: '0000001',
        ptname: 'นาย สมชาย ฟันดี',
        sex_code: '1',
        age: 26, // Target age (25-59)
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH12345',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'กลุ่มงานทันตกรรม',
        clinic: 'ทันตกรรมทั่วไป',
        pdx: 'K021',
        dx0: null,
        dx1: null,
        income: 150,
        listname: 'เคลือบฟลูออไรด์วานิช (15001)',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP6910001',
        compensated: 150,
        fund: 'DENTAL',
        subfund: 'PREVENTIVE',
      },
      {
        vn: '691001083002',
        cid: '1529900111222',
        hn: '0000002',
        ptname: 'น.ส. สมหญิง สดใส',
        sex_code: '2',
        age: 65, // Non-target age (outside 25-59)
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:15:00',
        authencode: null,
        maininscl: 'SSS',
        pttypename: 'ประกันสังคม',
        department: 'กลุ่มงานทันตกรรม',
        clinic: 'ทันตกรรมทั่วไป',
        pdx: 'K029',
        dx0: null,
        dx1: null,
        income: 150,
        listname: 'เคลือบฟลูออไรด์วานิช (15001)',
        status: null,
        rep: null,
        compensated: 0,
        fund: null,
        subfund: null,
      },
    ]

    it('calculates correct summary metrics across all visits', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([
          { icode: '3009999', name: 'เคลือบฟลูออไรด์', strength: null, nhso_adp_code: '15001' },
        ]) // checkAdpMapping
        .mockResolvedValueOnce(mockRawRows) // main report query

      const params: FluorideVarnishReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        refresh: true,
      }

      const res = await RcmFluorideVarnishService.getFluorideVarnishReport(params, mockExecutor)

      expect(res.adpCode).toBe('15001')
      expect(res.summary.totalVisits).toBe(2)
      expect(res.summary.uniquePatients).toBe(2)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.uncompensatedVisits).toBe(1)
      expect(res.summary.compensationRate).toBe(50)
      expect(res.summary.totalCompensated).toBe(150)
      expect(res.summary.targetAgeCount).toBe(1)
      expect(res.summary.targetAgeRate).toBe(50)
      expect(res.summary.withAuthenCount).toBe(1)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.authenRate).toBe(50)
      expect(res.summary.ucCount).toBe(1)
      expect(res.summary.ucRate).toBe(50)
      expect(res.summary.totalIncome).toBe(300)
    })

    it('filters correctly by TARGET_AGE card filter', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([
          { icode: '3009999', name: 'เคลือบฟลูออไรด์', strength: null, nhso_adp_code: '15001' },
        ])
        .mockResolvedValueOnce(mockRawRows)

      const params: FluorideVarnishReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        cardFilter: 'TARGET_AGE',
        refresh: true,
      }

      const res = await RcmFluorideVarnishService.getFluorideVarnishReport(params, mockExecutor)

      expect(res.items.length).toBe(1)
      expect(res.items[0].hn).toBe('0000001')
      expect(res.items[0].age).toBe(26)
      expect(res.items[0].isTargetAge).toBe(true)
    })

    it('filters correctly by COMPENSATED card filter', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRawRows)

      const params: FluorideVarnishReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        cardFilter: 'COMPENSATED',
        refresh: true,
      }

      const res = await RcmFluorideVarnishService.getFluorideVarnishReport(params, mockExecutor)

      expect(res.items.length).toBe(1)
      expect(res.items[0].hn).toBe('0000001')
      expect(res.items[0].isCompensated).toBe(true)
    })

    it('searches globally across HN, CID, Name and Diagnosis', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRawRows)

      const params: FluorideVarnishReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        search: 'สมหญิง',
        refresh: true,
      }

      const res = await RcmFluorideVarnishService.getFluorideVarnishReport(params, mockExecutor)

      expect(res.items.length).toBe(1)
      expect(res.items[0].hn).toBe('0000002')
    })
  })
})
