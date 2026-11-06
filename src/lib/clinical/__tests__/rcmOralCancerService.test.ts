import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmOralCancerService, isUniversalCoverageScheme } from '../rcmOralCancerService'

describe('RcmOralCancerService (12.1 Oral Cancer Screening ADP 90004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isUniversalCoverageScheme', () => {
    it('identifies UCS codes and Thai UC descriptions correctly', () => {
      expect(isUniversalCoverageScheme('UCS', null)).toBe(true)
      expect(isUniversalCoverageScheme('WEL', null)).toBe(true)
      expect(isUniversalCoverageScheme('UC', null)).toBe(true)
      expect(isUniversalCoverageScheme(null, 'บัตรทอง 30 บาท')).toBe(true)
      expect(isUniversalCoverageScheme(null, 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ')).toBe(false)
    })
  })

  describe('checkOralCancerAdpMapping', () => {
    it('returns isMapped = true when 90004 exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3009999',
          name: 'บริการคัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก (CA Oral Screening)',
          strength: null,
          nhso_adp_code: '90004',
        },
      ])

      const result = await RcmOralCancerService.checkOralCancerAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].nhso_adp_code).toBe('90004')
      expect(result.items[0].name).toContain('CA Oral Screening')
    })

    it('returns isMapped = false when 90004 is missing', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmOralCancerService.checkOralCancerAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getOralCancerReport', () => {
    const mockRows = [
      {
        vn: '691001083000',
        cid: '1529900012345',
        hn: '0012345',
        ptname: 'นายสมชาย ใจดี',
        age: 52,
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH1234',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง ทั่วไป',
        department: 'งานทันตกรรม',
        clinic: 'ทันตกรรม',
        pdx: 'K132',
        dx0: 'Z128',
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: '8902',
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        income: 300,
        listname: 'คัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP691001',
        compensated: 150,
        fund: 'OP_PP',
        subfund: 'ORAL_CA',
      },
      {
        vn: '691002094500',
        cid: '1529900067890',
        hn: '0067890',
        ptname: 'นางสมศรี มีสุข',
        age: 45,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:45:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ กรมบัญชีกลาง',
        department: 'งานทันตกรรม',
        clinic: 'ทันตกรรม',
        pdx: 'Z012',
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
        income: 200,
        listname: 'คัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก',
        status: null,
        rep: null,
        compensated: 0,
        fund: null,
        subfund: null,
      },
    ]

    it('aggregates statistics and KPIs accurately', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            {
              icode: '3009999',
              name: 'คัดกรองมะเร็งช่องปาก',
              strength: null,
              nhso_adp_code: '90004',
            },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const report = await RcmOralCancerService.getOralCancerReport(
        { startDate: '2026-10-01', endDate: '2026-10-31', refresh: true },
        mockExecutor
      )

      expect(report.summary.totalVisits).toBe(2)
      expect(report.summary.uniquePatients).toBe(2)
      expect(report.summary.compensatedVisits).toBe(1)
      expect(report.summary.uncompensatedVisits).toBe(1)
      expect(report.summary.totalCompensated).toBe(150)
      expect(report.summary.withAuthenCount).toBe(1)
      expect(report.summary.withoutAuthenCount).toBe(1)
      expect(report.summary.ucCount).toBe(1)
      expect(report.summary.totalIncome).toBe(500)
      expect(report.items.length).toBe(2)
      // Sorted by vstdate desc: 2026-10-02 (age 45) first, then 2026-10-01 (age 52)
      expect(report.items[0].age).toBe(45)
      expect(report.items[1].age).toBe(52)
      expect(report.items[1].isCompensated).toBe(true)
    })

    it('filters by cardFilter COMPENSATED', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            { icode: '3009999', name: 'คัดกรอง', strength: null, nhso_adp_code: '90004' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const report = await RcmOralCancerService.getOralCancerReport(
        { startDate: '2026-10-01', endDate: '2026-10-31', cardFilter: 'COMPENSATED', refresh: true },
        mockExecutor
      )

      expect(report.totalCount).toBe(1)
      expect(report.items[0].hn).toBe('0012345')
      expect(report.items[0].isCompensated).toBe(true)
    })

    it('filters by cardFilter WITH_AUTHEN and NO_AUTHEN', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            { icode: '3009999', name: 'คัดกรอง', strength: null, nhso_adp_code: '90004' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const withAuthen = await RcmOralCancerService.getOralCancerReport(
        { startDate: '2026-10-01', endDate: '2026-10-31', cardFilter: 'WITH_AUTHEN', refresh: true },
        mockExecutor
      )
      expect(withAuthen.totalCount).toBe(1)
      expect(withAuthen.items[0].authencode).toBe('AUTH1234')

      const noAuthen = await RcmOralCancerService.getOralCancerReport(
        { startDate: '2026-10-01', endDate: '2026-10-31', cardFilter: 'NO_AUTHEN', refresh: true },
        mockExecutor
      )
      expect(noAuthen.totalCount).toBe(1)
      expect(noAuthen.items[0].authencode).toBeNull()
    })

    it('searches by patient name, hn, and diagnosis', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            { icode: '3009999', name: 'คัดกรอง', strength: null, nhso_adp_code: '90004' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const searchByDiag = await RcmOralCancerService.getOralCancerReport(
        { startDate: '2026-10-01', endDate: '2026-10-31', search: 'K132', searchField: 'DIAG', refresh: true },
        mockExecutor
      )
      expect(searchByDiag.totalCount).toBe(1)
      expect(searchByDiag.items[0].hn).toBe('0012345')
    })
  })
})
