import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmColorectalCancerService,
  evaluateFitTestDataQuality,
  isUniversalCoverageScheme,
} from '../rcmColorectalCancerService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmColorectalCancerService (21.2 บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่ Fit test)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-fit-test-adp-mapping-check-90005')
  })

  describe('evaluateFitTestDataQuality helper', () => {
    it('returns MISSING_ADP when hasAdp is false', () => {
      expect(evaluateFitTestDataQuality(false, '1B0060 FIT test ผลลบ', '1B0060')).toBe('MISSING_ADP')
      expect(evaluateFitTestDataQuality(false, null, null)).toBe('MISSING_ADP')
    })

    it('returns MISSING_PP when hasAdp is true but PP codes are missing', () => {
      expect(evaluateFitTestDataQuality(true, '', '')).toBe('MISSING_PP')
      expect(evaluateFitTestDataQuality(true, null, null)).toBe('MISSING_PP')
    })

    it('returns COMPLETE when hasAdp is true and PP code is 1B0060 or 1B0061', () => {
      expect(evaluateFitTestDataQuality(true, '1B0060 FIT test ผลปกติ', '1B0060')).toBe('COMPLETE')
      expect(evaluateFitTestDataQuality(true, '1B0061 FIT test ผลผิดปกติ', '1B0061')).toBe('COMPLETE')
      expect(evaluateFitTestDataQuality(true, 'ตรวจคัดกรอง FIT test', '1B0060, 1B0061')).toBe('COMPLETE')
    })

    it('returns INVALID_PP_CODE when hasAdp is true and PP code is neither 1B0060 nor 1B0061', () => {
      expect(evaluateFitTestDataQuality(true, '1B0069 ตรวจคัดกรองอื่นๆ', '1B0069')).toBe('INVALID_PP_CODE')
      expect(evaluateFitTestDataQuality(true, '1B9999 อื่นๆ', '1B9999')).toBe('INVALID_PP_CODE')
    })
  })

  describe('isUniversalCoverageScheme helper', () => {
    it('identifies UC from hipdata_code', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
      expect(isUniversalCoverageScheme('OFC', '')).toBe(false)
    })

    it('identifies UC from pttypename', () => {
      expect(isUniversalCoverageScheme('', 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme('', 'บัตรทอง')).toBe(true)
      expect(isUniversalCoverageScheme('', '30 บาทรักษาทุกโรค')).toBe(true)
      expect(isUniversalCoverageScheme('', 'ข้าราชการ กรมบัญชีกลาง')).toBe(false)
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped: true when 90005 exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        { icode: '3000501', name: 'ตรวจคัดกรองมะเร็งลำไส้ใหญ่ Fit test', strength: null, nhso_adp_code: '90005' },
      ])

      const res = await RcmColorectalCancerService.checkAdpMapping(mockExecutor)
      expect(res.isMapped).toBe(true)
      expect(res.mappedCount).toBe(1)
      expect(res.items[0].nhso_adp_code).toBe('90005')
    })

    it('returns isMapped: false when no records found in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const res = await RcmColorectalCancerService.checkAdpMapping(mockExecutor)
      expect(res.isMapped).toBe(false)
      expect(res.mappedCount).toBe(0)
      expect(res.items).toHaveLength(0)
    })
  })

  describe('getColorectalCancerReport', () => {
    const mockDbRows = [
      {
        vn: '670101080001',
        cid: '1529900112233',
        hn: '0001234',
        ptname: 'นายสมชาย มั่นคง',
        birthday: '1970-01-15',
        sex_code: '1',
        age: 56,
        nation: 'ไทย',
        vstdate: '2026-10-15',
        vsttime: '08:30:00',
        authencode: 'AUTH123456',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z121',
        dx0: null,
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
        income: 150,
        labresult: 'Negative',
        pp_special_code: '1B0060',
        code: '1B0060 FIT test ผลปกติ',
        listname: 'ตรวจคัดกรอง FIT test 90005',
        status_seamless: 'Approved',
        rep_seamless: 'REP67-001',
        compensated_seamless: 150,
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP67-001',
        compensated: 150,
        agency: 'NHSO',
        fund: 'PP',
        subfund: 'FIT',
      },
      {
        vn: '670101080002',
        cid: '1529900223344',
        hn: '0005678',
        ptname: 'นางสมศรี ใจดี',
        birthday: '1965-05-20',
        sex_code: '2',
        age: 61,
        nation: 'ไทย',
        vstdate: '2026-10-16',
        vsttime: '09:15:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ',
        department: 'กลุ่มงานการพยาบาล',
        clinic: 'ตรวจสุขภาพ',
        pdx: 'Z121',
        dx0: null,
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
        income: 150,
        labresult: 'Positive',
        pp_special_code: '1B0061',
        code: '1B0061 FIT test ผลผิดปกติ',
        listname: null, // ขาด ADP 90005 -> MISSING_ADP
        status_seamless: null,
        rep_seamless: null,
        compensated_seamless: 0,
        status: null,
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
      },
      {
        vn: '670101080003',
        cid: '1529900334455',
        hn: '0009999',
        ptname: 'นายประสิทธิ์ พึ่งตน',
        birthday: '1960-03-10',
        sex_code: '1',
        age: 66,
        nation: 'ไทย',
        vstdate: '2026-10-17',
        vsttime: '10:00:00',
        authencode: 'AUTH999888',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'งานบริการปฐมภูมิ',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z121',
        dx0: null,
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
        income: 150,
        labresult: 'รอผล',
        pp_special_code: null,
        code: null, // ขาด Special PP -> MISSING_PP
        listname: 'ตรวจคัดกรอง FIT test 90005',
        status_seamless: null,
        rep_seamless: null,
        compensated_seamless: 0,
        status: null,
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
      },
    ]

    it('generates report with correct summary KPIs and data quality classification', async () => {
      const mockExecutor = vi
        .fn()
        .mockImplementation((sql: string) => {
          if (sql.includes('SELECT \n              icode') || sql.includes('SELECT icode')) {
            return Promise.resolve([
              { icode: '3000501', name: 'ตรวจคัดกรอง FIT test', strength: null, nhso_adp_code: '90005' },
            ])
          }
          return Promise.resolve(mockDbRows)
        })

      const res = await RcmColorectalCancerService.getColorectalCancerReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          sortBy: 'vstdate',
          sortOrder: 'asc',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.adpCode).toBe('90005')
      expect(res.totalCount).toBe(3)
      expect(res.summary.totalVisits).toBe(3)
      expect(res.summary.uniquePatients).toBe(3)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.uncompensatedVisits).toBe(2)
      expect(res.summary.totalCompensated).toBe(150)
      expect(res.summary.completeCount).toBe(1)
      expect(res.summary.missingAdpCount).toBe(1)
      expect(res.summary.missingPpCount).toBe(1)
      expect(res.summary.withAuthenCount).toBe(2)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.ucCount).toBe(2)

      // Check item 1 (complete)
      expect(res.items[0].dataQualityStatus).toBe('COMPLETE')
      expect(res.items[0].isCompensated).toBe(true)

      // Check item 2 (missing adp)
      expect(res.items[1].dataQualityStatus).toBe('MISSING_ADP')
      expect(res.items[1].isCompensated).toBe(false)

      // Check item 3 (missing pp)
      expect(res.items[2].dataQualityStatus).toBe('MISSING_PP')
    })

    it('filters correctly by cardFilter: COMPLETE', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT \n              icode') || sql.includes('SELECT icode')) return Promise.resolve([])
        return Promise.resolve(mockDbRows)
      })

      const res = await RcmColorectalCancerService.getColorectalCancerReport(
        { cardFilter: 'COMPLETE', refresh: true },
        mockExecutor
      )

      expect(res.totalCount).toBe(1)
      expect(res.items[0].hn).toBe('0001234')
    })

    it('filters correctly by cardFilter: MISSING_ADP', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT \n              icode') || sql.includes('SELECT icode')) return Promise.resolve([])
        return Promise.resolve(mockDbRows)
      })

      const res = await RcmColorectalCancerService.getColorectalCancerReport(
        { cardFilter: 'MISSING_ADP', refresh: true },
        mockExecutor
      )

      expect(res.totalCount).toBe(1)
      expect(res.items[0].hn).toBe('0005678')
    })

    it('filters correctly by search query across HN, name, CID, and lab result', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT \n              icode') || sql.includes('SELECT icode')) return Promise.resolve([])
        return Promise.resolve(mockDbRows)
      })

      const resHn = await RcmColorectalCancerService.getColorectalCancerReport(
        { search: '0005678', refresh: true },
        mockExecutor
      )
      expect(resHn.totalCount).toBe(1)
      expect(resHn.items[0].ptname).toContain('สมศรี')

      const resLab = await RcmColorectalCancerService.getColorectalCancerReport(
        { search: 'Negative', refresh: true },
        mockExecutor
      )
      expect(resLab.totalCount).toBe(1)
      expect(resLab.items[0].hn).toBe('0001234')
    })

    it('filters items and recomputes summary KPIs when pttypes is specified', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT \n              icode') || sql.includes('SELECT icode')) return Promise.resolve([])
        return Promise.resolve(mockDbRows)
      })

      // mockDbRows has 3 items:
      // Item 1: UCS / บัตรทอง (UC) -> compensated: 150
      // Item 2: OFC / ข้าราชการ (non-UC)
      // Item 3: UCS / บัตรทอง (UC) -> compensated: 0
      const res = await RcmColorectalCancerService.getColorectalCancerReport(
        { pttypes: '01,02,03,04,05,06,07,08,09', refresh: true },
        mockExecutor
      )

      expect(res.totalCount).toBe(2)
      expect(res.summary.totalVisits).toBe(2)
      expect(res.items.every((it) => it.isUc)).toBe(true)
      expect(res.pttypes).toBe('01,02,03,04,05,06,07,08,09')
    })
  })
})

