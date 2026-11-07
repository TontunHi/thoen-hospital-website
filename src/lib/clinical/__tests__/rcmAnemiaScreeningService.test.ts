import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmAnemiaScreeningService,
  isUniversalCoverageScheme,
  getFiscalYearStartDate,
  type AnemiaScreeningReportParams,
} from '../rcmAnemiaScreeningService'

describe('RcmAnemiaScreeningService', () => {
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

  describe('getFiscalYearStartDate', () => {
    it('returns Oct 1 of same year for months >= 10', () => {
      expect(getFiscalYearStartDate('2026-10-15')).toBe('2026-10-01')
      expect(getFiscalYearStartDate('2026-12-31')).toBe('2026-10-01')
    })

    it('returns Oct 1 of previous year for months < 10', () => {
      expect(getFiscalYearStartDate('2026-05-20')).toBe('2025-10-01')
      expect(getFiscalYearStartDate('2026-01-01')).toBe('2025-10-01')
      expect(getFiscalYearStartDate('2026-09-30')).toBe('2025-10-01')
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when ADP 13001 exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3002545',
          name: 'คัดกรอง CBC (Z130)  13001 Project code',
          strength: '',
          nhso_adp_code: '13001',
        },
      ])

      const result = await RcmAnemiaScreeningService.checkAdpMapping(mockExecutor, true)
      expect(result.adpCode).toBe('13001')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('3002545')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['13001'],
        expect.any(Object)
      )
    })

    it('returns isMapped false when database query throws or returns empty', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB connection failed'))
      const result = await RcmAnemiaScreeningService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getAnemiaScreeningReport', () => {
    const mockRawRows = [
      {
        vn: '691001083000',
        cid: '1529900111222',
        hn: '0000001',
        ptname: 'น.ส. สมหญิง สดใส',
        sex_code: '2',
        age: 18, // Target age (13-24)
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH12345',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z138',
        dx0: null,
        dx1: null,
        income: 65,
        listname: 'คัดกรอง CBC (Z130)  13001 Project code',
        camedate: null, // No repeat claim
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP6910-001',
        compensated: 65,
      },
      {
        vn: '691002090000',
        cid: '1529900333444',
        hn: '0000002',
        ptname: 'ด.ช. สมศักดิ์ เก่งมาก',
        sex_code: '1',
        age: 8, // Non-target age (< 13)
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:00:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ',
        department: 'งานผู้ป่วยนอก',
        clinic: 'กุมารเวชกรรม',
        pdx: 'Z130',
        dx0: null,
        dx1: null,
        income: 65,
        listname: 'คัดกรอง CBC (Z130)  13001 Project code',
        camedate: '2026-10-01', // Repeat claim!
        status: null,
        rep: null,
        compensated: 0,
      },
      {
        vn: '691003100000',
        cid: '1529900555666',
        hn: '0000003',
        ptname: 'น.ส. จันทร์เพ็ญ มีสุข',
        sex_code: '2',
        age: 22, // Target age (13-24)
        nation: 'ไทย',
        vstdate: '2026-10-03',
        vsttime: '10:00:00',
        authencode: 'AUTH99999',
        maininscl: 'SSS',
        pttypename: 'ประกันสังคม',
        department: 'งานส่งเสริมสุขภาพ',
        clinic: 'ตรวจสุขภาพ',
        pdx: 'Z000',
        dx0: null,
        dx1: null,
        income: 65,
        listname: 'คัดกรอง CBC (Z130)  13001 Project code',
        camedate: null,
        status: null,
        rep: null,
        compensated: 0,
      },
    ]

    const createMockExecutor = () => {
      return vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            {
              icode: '3002545',
              name: 'คัดกรอง CBC (Z130)  13001 Project code',
              strength: '',
              nhso_adp_code: '13001',
            },
          ])
        }
        return Promise.resolve(mockRawRows)
      })
    }

    it('calculates summary aggregates accurately', async () => {
      const mockExecutor = createMockExecutor()
      const params: AnemiaScreeningReportParams = {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        refresh: true,
      }

      const report = await RcmAnemiaScreeningService.getAnemiaScreeningReport(params, mockExecutor)

      expect(report.adpCode).toBe('13001')
      expect(report.title).toContain('17.1')
      expect(report.summary.totalVisits).toBe(3)
      expect(report.summary.uniquePatients).toBe(3)
      expect(report.summary.compensatedVisits).toBe(1)
      expect(report.summary.uncompensatedVisits).toBe(2)
      expect(report.summary.totalCompensated).toBe(65)
      expect(report.summary.targetAgeCount).toBe(2) // 18 and 22 years
      expect(report.summary.repeatClaimCount).toBe(1)
      expect(report.summary.withAuthenCount).toBe(2)
      expect(report.summary.withoutAuthenCount).toBe(1)
      expect(report.summary.ucCount).toBe(1)
    })

    it('filters correctly by cardFilter: COMPENSATED', async () => {
      const mockExecutor = createMockExecutor()
      const report = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          cardFilter: 'COMPENSATED',
          refresh: true,
        },
        mockExecutor
      )

      expect(report.items.length).toBe(1)
      expect(report.items[0].hn).toBe('0000001')
      expect(report.items[0].isCompensated).toBe(true)
    })

    it('filters correctly by cardFilter: TARGET_AGE (13-24 years)', async () => {
      const mockExecutor = createMockExecutor()
      const report = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          cardFilter: 'TARGET_AGE',
          refresh: true,
        },
        mockExecutor
      )

      expect(report.items.length).toBe(2)
      expect(report.items.every((i) => i.isTargetAge)).toBe(true)
    })

    it('filters correctly by cardFilter: REPEAT_CLAIM', async () => {
      const mockExecutor = createMockExecutor()
      const report = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          cardFilter: 'REPEAT_CLAIM',
          refresh: true,
        },
        mockExecutor
      )

      expect(report.items.length).toBe(1)
      expect(report.items[0].hn).toBe('0000002')
      expect(report.items[0].hasRepeatClaim).toBe(true)
    })

    it('searches correctly across fields', async () => {
      const mockExecutor = createMockExecutor()

      // Search by HN
      const hnReport = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          searchField: 'HN',
          search: '0000003',
          refresh: true,
        },
        mockExecutor
      )
      expect(hnReport.items.length).toBe(1)
      expect(hnReport.items[0].ptname).toContain('จันทร์เพ็ญ')

      // Search by patient name in ALL field
      const nameReport = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          searchField: 'ALL',
          search: 'สมหญิง',
          refresh: true,
        },
        mockExecutor
      )
      expect(nameReport.items.length).toBe(1)
      expect(nameReport.items[0].hn).toBe('0000001')
    })

    it('paginates correctly and respects exportAll', async () => {
      const mockExecutor = createMockExecutor()

      // Paginated page 1 with pageSize 1
      const p1 = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          page: 1,
          pageSize: 1,
          refresh: true,
        },
        mockExecutor
      )
      expect(p1.items.length).toBe(1)
      expect(p1.totalCount).toBe(3)
      expect(p1.totalPages).toBe(3)

      // Export all gives full list
      const all = await RcmAnemiaScreeningService.getAnemiaScreeningReport(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          page: 1,
          pageSize: 1,
          exportAll: true,
          refresh: true,
        },
        mockExecutor
      )
      expect(all.items.length).toBe(3)
    })
  })
})
