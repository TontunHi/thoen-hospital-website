import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmHealthScreeningService,
  isUniversalCoverageScheme,
  getFiscalYearStartDate,
} from '../rcmHealthScreeningService'
import { createMockRcmFundGateway } from './rcmGatewayTestHelper'

describe('RcmHealthScreeningService (14. บริการคัดกรองและประเมินปัจจัยเสี่ยงต่อสุขภาพกาย/สุขภาพจิต-ADP)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
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

  describe('getFiscalYearStartDate', () => {
    it('computes Oct 1st of corresponding fiscal year for dates before October', () => {
      // 2026-05-15 is in fiscal year 2026 (started 2025-10-01)
      expect(getFiscalYearStartDate('2026-05-15')).toBe('2025-10-01')
    })

    it('computes Oct 1st of current year for dates in October or later', () => {
      // 2026-11-01 is in fiscal year 2027 (started 2026-10-01)
      expect(getFiscalYearStartDate('2026-11-01')).toBe('2026-10-01')
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped = true when ADP code exists via gateway', async () => {
      const mockGateway = createMockRcmFundGateway({
        adpCode: '12003',
        adpItems: [
          {
            icode: '30012003',
            name: 'ตรวจระดับน้ำตาลในเลือด Fasting Plasma Glucose (FPG)',
            strength: null,
            nhso_adp_code: '12003',
          },
        ],
      })

      const result = await RcmHealthScreeningService.checkAdpMapping('12003', mockGateway, true)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].nhso_adp_code).toBe('12003')
      expect(result.items[0].name).toContain('Fasting Plasma Glucose')
    })

    it('returns isMapped = false when ADP code is missing', async () => {
      const mockGateway = createMockRcmFundGateway({ adpCode: '12004', adpItems: [] })

      const result = await RcmHealthScreeningService.checkAdpMapping('12004', mockGateway, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getHealthScreeningReport for 14.5 (ADP 12003) and 14.6 (ADP 12004)', () => {
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
        authencode: 'AUTH12003',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง ทั่วไป',
        department: 'งานผู้ป่วยนอก',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z131',
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
        income: 100,
        listname: 'ตรวจระดับน้ำตาลในเลือด Fasting Plasma Glucose',
        listname1: null,
        camedate: null, // ครั้งแรกในปีงบ
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP691001',
        compensated: 100,
        agency: 'NHSO',
        fund: 'OP_PP',
        subfund: 'SCREENING',
        errorcode: null,
        transactiontype: 'OP',
      },
      {
        vn: '691002094500',
        cid: '1529900067890',
        hn: '0067890',
        ptname: 'นางสมศรี มีสุข',
        age: 48, // 48 is in target age 45-59
        nation: 'ไทย',
        vstdate: '2026-10-05',
        vsttime: '09:45:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ กรมบัญชีกลาง',
        department: 'งานผู้ป่วยนอก',
        clinic: 'คลินิกสุขภาพ',
        pdx: 'Z000',
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
        income: 120,
        listname: 'Total Cholesterol',
        listname1: 'ค่าบริการตรวจทางเทคนิคการแพทย์',
        camedate: '2026-10-02', // เคยเคลมแล้วเมื่อ 2026-10-02!
        status: null,
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
        errorcode: null,
        transactiontype: null,
      },
      {
        vn: '691003112000',
        cid: '1529900099999',
        hn: '0099999',
        ptname: 'นายบุญมี มั่งคั่ง',
        age: 65, // 65 is OUTSIDE target age 45-59
        nation: 'ไทย',
        vstdate: '2026-10-06',
        vsttime: '11:20:00',
        authencode: 'AUTH12004',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง ผู้สูงอายุ',
        department: 'งานผู้ป่วยนอก',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'Z131',
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
        income: 100,
        listname: 'Total Cholesterol',
        listname1: null,
        camedate: null,
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

    const createMockGateway = (adpCode: '12003' | '12004' = '12003') =>
      createMockRcmFundGateway({
        adpCode,
        fundKey: 'health-screening',
        adpItems: [{ icode: adpCode, name: 'Screening', strength: null, nhso_adp_code: adpCode }],
        rawRows: mockRows,
      })

    it('aggregates summary statistics and identifies repeat claims & target age', async () => {
      const res = await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12003',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          refresh: true,
        },
        createMockGateway('12003')
      )

      expect(res.adpCode).toBe('12003')
      expect(res.summary.totalVisits).toBe(3)
      expect(res.summary.uniquePatients).toBe(3)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.uncompensatedVisits).toBe(2)
      expect(res.summary.totalCompensated).toBe(100)
      expect(res.summary.repeatClaimCount).toBe(1) // 1 patient had prior claim date
      expect(res.summary.withAuthenCount).toBe(2)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.targetAgeCount).toBe(2) // age 52 and 48 are between 45-59
      expect(res.items.length).toBe(3)
    })

    it('filters by cardFilter = REPEAT_CLAIM correctly', async () => {
      const res = await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12003',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          cardFilter: 'REPEAT_CLAIM',
          refresh: true,
        },
        createMockGateway('12003')
      )

      expect(res.items.length).toBe(1)
      expect(res.items[0].hn).toBe('0067890')
      expect(res.items[0].hasRepeatClaim).toBe(true)
      expect(res.items[0].camedate).toBe('2026-10-02')
    })

    it('filters by cardFilter = TARGET_AGE (45-59 ปี) correctly', async () => {
      const res = await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12004',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          cardFilter: 'TARGET_AGE',
          refresh: true,
        },
        createMockGateway('12004')
      )

      expect(res.items.length).toBe(2)
      expect(res.items.every((i) => i.age >= 45 && i.age <= 59)).toBe(true)
    })

    it('filters by search keyword correctly', async () => {
      const res = await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12003',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          search: 'สมศรี',
          refresh: true,
        },
        createMockGateway('12003')
      )

      expect(res.items.length).toBe(1)
      expect(res.items[0].ptname).toContain('สมศรี')
    })

    it('delegates 14.5 (12003) and 14.6 (12004) queries to Gateway named endpoint', async () => {
      const gw145 = createMockGateway('12003')
      await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12003',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          refresh: true,
        },
        gw145
      )
      expect(gw145.getRcmFundData).toHaveBeenCalledWith('health-screening', {
        ds1: '2026-03-01',
        ds2: '2026-03-31',
        adpCode: '12003',
      })

      const gw146 = createMockGateway('12004')
      await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12004',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          refresh: true,
        },
        gw146
      )
      expect(gw146.getRcmFundData).toHaveBeenCalledWith('health-screening', {
        ds1: '2026-03-01',
        ds2: '2026-03-31',
        adpCode: '12004',
      })
    })

    it('builds repBreakdown and filters items by comma-separated reps and __NO_REP__', async () => {
      const filteredRep = await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12003',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          reps: 'REP691001',
          refresh: true,
        },
        createMockGateway('12003')
      )

      expect(filteredRep.items.length).toBe(1)
      expect(filteredRep.items[0].vn).toBe('691001083000')
      expect(filteredRep.repBreakdown?.withEclaimRepCount).toBe(1)
      expect(filteredRep.repBreakdown?.withoutRepCount).toBe(2)
      expect(filteredRep.repBreakdown?.repItems.length).toBe(1)

      const filteredNoRep = await RcmHealthScreeningService.getHealthScreeningReport(
        {
          adpCode: '12003',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          reps: '__NO_REP__',
          refresh: true,
        },
        createMockGateway('12003')
      )

      expect(filteredNoRep.items.length).toBe(2)
      expect(filteredNoRep.items.every((i) => !i.rep)).toBe(true)
    })
  })
})
