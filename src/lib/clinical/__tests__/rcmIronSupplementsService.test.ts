import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmIronSupplementsService,
  isUniversalCoverageScheme,
  IRON_SUPPLEMENT_DIDS,
  type IronSupplementsReportParams,
} from '../rcmIronSupplementsService'

describe('RcmIronSupplementsService', () => {
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

  describe('IRON_SUPPLEMENT_DIDS', () => {
    it('contains all 24 required DIDs for iron supplement medications', () => {
      expect(IRON_SUPPLEMENT_DIDS.length).toBe(24)
      expect(IRON_SUPPLEMENT_DIDS).toContain('202030120137819920381422')
      expect(IRON_SUPPLEMENT_DIDS).toContain('100488000004203120381169')
      expect(IRON_SUPPLEMENT_DIDS).toContain('100489000004320121881267')
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when ADP 14001 exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1540012',
          name: 'Ferrous Fumarate 200 mg',
          strength: '200 mg',
          nhso_adp_code: '14001',
        },
      ])

      const result = await RcmIronSupplementsService.checkAdpMapping(mockExecutor, true)
      expect(result.adpCode).toBe('14001')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('1540012')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['14001'],
        expect.any(Object)
      )
    })

    it('returns isMapped false when database query throws or returns empty', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB connection failed'))
      const result = await RcmIronSupplementsService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getIronSupplementsReport', () => {
    const mockRawRows = [
      {
        vn: '691001083000',
        cid: '1529900111222',
        hn: '0000001',
        ptname: 'น.ส. สมหญิง สดใส',
        birthday: '2000-05-15',
        sex_code: '2',
        sex: 'หญิง',
        age: 26,
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH14001',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z768',
        dx0: null,
        dx1: null,
        income: 50,
        drugname: 'Ferrous Fumarate 200 mg',
        listname: 'ยาเม็ดเสริมธาตุเหล็ก 14001',
        listname1: null,
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP691001',
        compensated: 50,
        agency: 'NHSO',
        fund: 'OP_PP',
        subfund: 'IRON',
        errorcode: null,
        transactiontype: 'OP',
      },
      {
        vn: '691001084000',
        cid: '1529900333444',
        hn: '0000002',
        ptname: 'นาง สมศรี มีสุข',
        birthday: '1985-02-10',
        sex_code: '2',
        sex: 'หญิง',
        age: 41,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:00:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ',
        department: 'กลุ่มงานการพยาบาล',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z130',
        dx0: null,
        dx1: null,
        income: 60,
        drugname: 'Ferrous Fumarate 200 mg',
        listname: null,
        listname1: null,
        status: null,
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
        errorcode: null,
        transactiontype: null,
      },
    ]

    it('processes rows correctly and aggregates summary KPIs', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('WHERE TRIM(nhso_adp_code) = ?')) {
          return Promise.resolve([
            {
              icode: '1540012',
              name: 'Ferrous Fumarate 200 mg',
              strength: '200 mg',
              nhso_adp_code: '14001',
            },
          ])
        }
        return Promise.resolve(mockRawRows)
      })

      const params: IronSupplementsReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        refresh: true,
      }

      const res = await RcmIronSupplementsService.getIronSupplementsReport(params, mockExecutor)

      expect(res.adpCode).toBe('14001')
      expect(res.categoryTitle).toContain('บริการยาเม็ดเสริมธาตุเหล็ก')
      expect(res.title).toContain('18.2')
      expect(res.totalCount).toBe(2)
      expect(res.items.length).toBe(2)

      // Summary checks
      expect(res.summary.totalVisits).toBe(2)
      expect(res.summary.uniquePatients).toBe(2)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.uncompensatedVisits).toBe(1)
      expect(res.summary.totalCompensated).toBe(50)
      expect(res.summary.withAuthenCount).toBe(1)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.ucCount).toBe(1)
      expect(res.summary.targetAgeCount).toBe(2)
      expect(res.summary.withAdpCount).toBe(1)
      expect(res.summary.withDrugCount).toBe(2)
    })

    it('filters by cardFilter COMPENSATED and UNCOMPENSATED', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('WHERE TRIM(nhso_adp_code) = ?')) return Promise.resolve([])
        return Promise.resolve(mockRawRows)
      })

      const resComp = await RcmIronSupplementsService.getIronSupplementsReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'COMPENSATED', refresh: true },
        mockExecutor
      )
      expect(resComp.items.length).toBe(1)
      expect(resComp.items[0].isCompensated).toBe(true)

      const resUncomp = await RcmIronSupplementsService.getIronSupplementsReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'UNCOMPENSATED', refresh: true },
        mockExecutor
      )
      expect(resUncomp.items.length).toBe(1)
      expect(resUncomp.items[0].isCompensated).toBe(false)
    })

    it('filters by WITH_ADP and WITH_DRUG', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('WHERE TRIM(nhso_adp_code) = ?')) return Promise.resolve([])
        return Promise.resolve(mockRawRows)
      })

      const resAdp = await RcmIronSupplementsService.getIronSupplementsReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'WITH_ADP', refresh: true },
        mockExecutor
      )
      expect(resAdp.items.length).toBe(1)
      expect(resAdp.items[0].hasAdp).toBe(true)

      const resDrug = await RcmIronSupplementsService.getIronSupplementsReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'WITH_DRUG', refresh: true },
        mockExecutor
      )
      expect(resDrug.items.length).toBe(2)
    })

    it('filters by global search keyword', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('WHERE TRIM(nhso_adp_code) = ?')) return Promise.resolve([])
        return Promise.resolve(mockRawRows)
      })

      const res = await RcmIronSupplementsService.getIronSupplementsReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', search: 'สมศรี', refresh: true },
        mockExecutor
      )
      expect(res.items.length).toBe(1)
      expect(res.items[0].ptname).toBe('นาง สมศรี มีสุข')
    })
  })
})
