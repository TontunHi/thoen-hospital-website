import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmPregnancyTestService,
  determinePregnancyLabStatus,
} from '../rcmPregnancyTestService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmPregnancyTestService (8.1 การทดสอบการตั้งครรภ์)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-pregnancy-test-adp-mapping-check')
    invalidateCacheKey('rcm-pregnancy-test-report-2026-10-01-2027-09-30')
    invalidateCacheKey('rcm-pregnancy-test-report-2026-05-01-2026-05-31')
  })

  describe('determinePregnancyLabStatus helper', () => {
    it('returns NO_LAB for null, undefined, or blank strings', () => {
      expect(determinePregnancyLabStatus(null)).toBe('NO_LAB')
      expect(determinePregnancyLabStatus(undefined)).toBe('NO_LAB')
      expect(determinePregnancyLabStatus('')).toBe('NO_LAB')
      expect(determinePregnancyLabStatus('   ')).toBe('NO_LAB')
    })

    it('returns PENDING for pending/processing results', () => {
      expect(determinePregnancyLabStatus('รอผล')).toBe('PENDING')
      expect(determinePregnancyLabStatus('Pending')).toBe('PENDING')
      expect(determinePregnancyLabStatus('processing')).toBe('PENDING')
    })

    it('returns POSITIVE for positive, reactive, or + results', () => {
      expect(determinePregnancyLabStatus('Positive')).toBe('POSITIVE')
      expect(determinePregnancyLabStatus('pos')).toBe('POSITIVE')
      expect(determinePregnancyLabStatus('Pos.')).toBe('POSITIVE')
      expect(determinePregnancyLabStatus('Reactive')).toBe('POSITIVE')
      expect(determinePregnancyLabStatus('พบการตั้งครรภ์')).toBe('POSITIVE')
      expect(determinePregnancyLabStatus('+')).toBe('POSITIVE')
    })

    it('returns NEGATIVE for negative, non-reactive, or - results', () => {
      expect(determinePregnancyLabStatus('Negative')).toBe('NEGATIVE')
      expect(determinePregnancyLabStatus('neg')).toBe('NEGATIVE')
      expect(determinePregnancyLabStatus('Neg.')).toBe('NEGATIVE')
      expect(determinePregnancyLabStatus('Non-reactive')).toBe('NEGATIVE')
      expect(determinePregnancyLabStatus('ไม่พบการตั้งครรภ์')).toBe('NEGATIVE')
      expect(determinePregnancyLabStatus('-')).toBe('NEGATIVE')
    })

    it('returns OTHER for unrecognized lab results', () => {
      expect(determinePregnancyLabStatus('Inconclusive')).toBe('OTHER')
    })
  })

  describe('checkPregnancyTestAdpMapping', () => {
    it('returns isMapped: true when 31101 or 30014 exist in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        { icode: '3000101', name: 'Pregnancy test UPT', strength: '', nhso_adp_code: '31101' },
        { icode: '3000102', name: 'ตรวจการตั้งครรภ์', strength: '', nhso_adp_code: '30014' },
      ])

      const res = await RcmPregnancyTestService.checkPregnancyTestAdpMapping(mockExecutor)
      expect(res.isMapped).toBe(true)
      expect(res.mappedCount).toBe(2)
      expect(res.items[0].nhso_adp_code).toBe('31101')
      expect(res.items[1].nhso_adp_code).toBe('30014')
    })

    it('returns isMapped: false when no records found in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const res = await RcmPregnancyTestService.checkPregnancyTestAdpMapping(mockExecutor)
      expect(res.isMapped).toBe(false)
      expect(res.mappedCount).toBe(0)
      expect(res.items).toEqual([])
    })
  })

  describe('getPregnancyTestReport', () => {
    const mockRows = [
      {
        vn: '6705010001',
        cid: '1520800000001',
        hn: '0010001',
        ptname: 'น.ส. สมฤดี ทดสอบ',
        age: 24,
        vstdate: '2026-05-01',
        vsttime: '08:30:00',
        authencode: 'AUTH1001',
        maininscl: 'UCS',
        pttypename: 'UC:ประกันสุขภาพถ้วนหน้า',
        department: 'ผู้ป่วยนอก',
        clinic: 'ตรวจทั่วไป',
        pdx: 'Z320',
        sdx: 'N943',
        income: 180,
        drug_labname: 'Urine Pregnancy Test',
        listname: 'ตรวจการตั้งครรภ์ด้วยชุดทดสอบ',
        lab_order_result: 'Positive',
        status: 'NHSO :: มี Invoice แล้ว',
        rep: 'REP67-001',
        compensated: 120,
        fund: 'OP',
        subfund: 'P&P',
      },
      {
        vn: '6705010002',
        cid: '1520800000002',
        hn: '0010002',
        ptname: 'นาง สุภา นามดี',
        age: 30,
        vstdate: '2026-05-02',
        vsttime: '09:15:00',
        authencode: null,
        maininscl: 'SSS',
        pttypename: 'SSS:ประกันสังคม',
        department: 'ผู้ป่วยนอก',
        clinic: 'สูติกรรม',
        pdx: 'Z320',
        sdx: null,
        income: 150,
        drug_labname: 'Urine Pregnancy Test',
        listname: null,
        lab_order_result: 'Negative',
        status: null,
        rep: null,
        compensated: 0,
        fund: null,
        subfund: null,
      },
      {
        vn: '6705010003',
        cid: '1520800000003',
        hn: '0010003',
        ptname: 'น.ส. อารยา ใจงาม',
        age: 19,
        vstdate: '2026-05-03',
        vsttime: '10:00:00',
        authencode: 'AUTH1003',
        maininscl: 'UCS',
        pttypename: 'UC:ประกันสุขภาพถ้วนหน้า',
        department: 'เวชปฏิบัติ',
        clinic: 'ตรวจทั่วไป',
        pdx: 'Z321',
        sdx: null,
        income: 200,
        drug_labname: null,
        listname: 'ตรวจการตั้งครรภ์ด้วยชุดทดสอบ',
        lab_order_result: 'รอผล',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP67-002',
        compensated: 120,
        fund: 'OP',
        subfund: 'P&P',
      },
    ]

    it('returns report structure with summary KPIs accurately', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            { icode: '3000101', name: 'UPT', strength: '', nhso_adp_code: '31101' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const res = await RcmPregnancyTestService.getPregnancyTestReport(
        { ds1: '2026-05-01', ds2: '2026-05-31', cardFilter: 'ALL', refresh: true },
        mockExecutor
      )

      expect(res.totalCount).toBe(3)
      expect(res.summary.totalVisits).toBe(3)
      expect(res.summary.uniquePatients).toBe(3)
      expect(res.summary.compensatedVisits).toBe(2)
      expect(res.summary.uncompensatedVisits).toBe(1)
      expect(res.summary.totalCompensated).toBe(240)
      expect(res.summary.averageCompensated).toBe(120)
      expect(res.summary.withAuthenCount).toBe(2)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.positiveCount).toBe(1)
      expect(res.summary.negativeCount).toBe(1)
      expect(res.summary.pendingCount).toBe(1)
      expect(res.summary.ucCount).toBe(2)
      expect(res.summary.totalIncome).toBe(530)
      expect(res.items).toHaveLength(3)
      expect(res.items[0].no).toBe(1)
    })

    it('filters correctly by cardFilter: COMPENSATED, POSITIVE, and UC_ONLY', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) return Promise.resolve([])
        return Promise.resolve(mockRows)
      })

      // Test POSITIVE filter
      const posRes = await RcmPregnancyTestService.getPregnancyTestReport(
        { ds1: '2026-05-01', ds2: '2026-05-31', cardFilter: 'POSITIVE', refresh: true },
        mockExecutor
      )
      expect(posRes.totalCount).toBe(1)
      expect(posRes.items[0].ptname).toBe('น.ส. สมฤดี ทดสอบ')
      expect(posRes.items[0].labStatus).toBe('POSITIVE')

      // Test UC_ONLY filter
      const ucRes = await RcmPregnancyTestService.getPregnancyTestReport(
        { ds1: '2026-05-01', ds2: '2026-05-31', cardFilter: 'UC_ONLY', refresh: true },
        mockExecutor
      )
      expect(ucRes.totalCount).toBe(2)
      expect(ucRes.items.every((i) => i.isUc)).toBe(true)

      // Test COMPENSATED filter
      const compRes = await RcmPregnancyTestService.getPregnancyTestReport(
        { ds1: '2026-05-01', ds2: '2026-05-31', cardFilter: 'COMPENSATED', refresh: true },
        mockExecutor
      )
      expect(compRes.totalCount).toBe(2)
      expect(compRes.items.every((i) => i.isCompensated)).toBe(true)
    })

    it('filters correctly by search text and searchField', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) return Promise.resolve([])
        return Promise.resolve(mockRows)
      })

      const searchRes = await RcmPregnancyTestService.getPregnancyTestReport(
        {
          ds1: '2026-05-01',
          ds2: '2026-05-31',
          searchField: 'HN',
          search: '0010002',
          refresh: true,
        },
        mockExecutor
      )
      expect(searchRes.totalCount).toBe(1)
      expect(searchRes.items[0].hn).toBe('0010002')
    })
  })
})
