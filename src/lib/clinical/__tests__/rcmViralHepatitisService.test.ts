import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmViralHepatitisService, isUniversalCoverageScheme } from '../rcmViralHepatitisService'

describe('RcmViralHepatitisService (23.1 Viral Hepatitis B Screening ADP 36318, 36319)', () => {
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

  describe('checkViralHepatitisAdpMapping', () => {
    it('returns isMapped = true when 36318 or 36319 exists', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3000101',
          name: 'ตรวจคัดกรองไวรัสตับอักเสบ บี (HBsAg)',
          strength: null,
          nhso_adp_code: '36318',
          source: 's_drugitems',
        },
        {
          icode: '3000102',
          name: 'ตรวจคัดกรองไวรัสตับอักเสบ ซี (HCV)',
          strength: null,
          nhso_adp_code: '36319',
          source: 's_drugitems',
        },
      ])

      const result = await RcmViralHepatitisService.checkViralHepatitisAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(2)
      expect(result.items[0].nhso_adp_code).toBe('36318')
      expect(result.items[1].nhso_adp_code).toBe('36319')
    })

    it('returns isMapped = false when both are missing', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmViralHepatitisService.checkViralHepatitisAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getViralHepatitisReport', () => {
    const mockRows = [
      {
        vn: '691001083000',
        cid: '1529900012345',
        hn: '0012345',
        ptname: 'นายสมชาย ใจดี',
        age: 38,
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH1234',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง ทั่วไป',
        department: 'งานชันสูตร',
        clinic: 'ตรวจโรคทั่วไป',
        cc: 'ตรวจคัดกรองไวรัสตับอักเสบ',
        pdx: 'Z115',
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
        income: 250,
        listname: 'ตรวจคัดกรองไวรัสตับอักเสบ บี (HBsAg)',
        labresult: 'Negative',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP691001',
        compensated: 130,
        status_sm: null,
        rep_sm: null,
        compensated_sm: 0,
        address: '123 หมู่ 1 ต.ล้อมแรด',
        mobile: '0812345678',
        tel: '054123456',
        fund: 'OP_PP',
        subfund: 'HEP_B',
      },
      {
        vn: '691002094500',
        cid: '1529900067890',
        hn: '0067890',
        ptname: 'นางสมศรี มีสุข',
        age: 42,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:45:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ กรมบัญชีกลาง',
        department: 'งานชันสูตร',
        clinic: 'ตรวจโรคทั่วไป',
        cc: 'เช็คร่างกาย',
        pdx: 'Z000',
        dx0: 'Z115',
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
        income: 250,
        listname: 'ตรวจคัดกรองไวรัสตับอักเสบ บี (HBsAg)',
        labresult: null,
        status: '-::ยังไม่ได้ส่ง',
        rep: null,
        compensated: 0,
        status_sm: null,
        rep_sm: null,
        compensated_sm: 0,
        address: '456 หมู่ 2 ต.เถินบุรี',
        mobile: '0898765432',
        tel: null,
        fund: null,
        subfund: null,
      },
    ]

    it('aggregates summary and processes items correctly', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([
          {
            icode: '3000101',
            name: 'ตรวจคัดกรองไวรัสตับอักเสบ บี (HBsAg)',
            strength: null,
            nhso_adp_code: '36318',
            source: 's_drugitems',
          },
        ])
        .mockResolvedValueOnce(mockRows)

      const result = await RcmViralHepatitisService.getViralHepatitisReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', sortOrder: 'asc', refresh: true },
        mockExecutor
      )

      expect(result.totalCount).toBe(2)
      expect(result.summary.totalVisits).toBe(2)
      expect(result.summary.uniquePatients).toBe(2)
      expect(result.summary.compensatedVisits).toBe(1)
      expect(result.summary.uncompensatedVisits).toBe(1)
      expect(result.summary.totalCompensated).toBe(130)
      expect(result.summary.withAuthenCount).toBe(1)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.withLabCount).toBe(1)
      expect(result.summary.withoutLabCount).toBe(1)
      expect(result.summary.ucCount).toBe(1)
      expect(result.items[0].ptname).toBe('นายสมชาย ใจดี')
      expect(result.items[0].labresult).toBe('Negative')
      expect(result.items[0].hasLabResult).toBe(true)
      expect(result.items[0].isCompensated).toBe(true)
      expect(result.items[1].isCompensated).toBe(false)
      expect(result.items[1].hasLabResult).toBe(false)
    })

    it('filters items correctly by cardFilter', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRows)

      const compResult = await RcmViralHepatitisService.getViralHepatitisReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'COMPENSATED', refresh: true },
        mockExecutor
      )
      expect(compResult.totalCount).toBe(1)
      expect(compResult.items[0].hn).toBe('0012345')

      const mockExecutor2 = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRows)

      const labResult = await RcmViralHepatitisService.getViralHepatitisReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'WITH_LAB', refresh: true },
        mockExecutor2
      )
      expect(labResult.totalCount).toBe(1)
      expect(labResult.items[0].labresult).toBe('Negative')
    })

    it('filters items correctly by global search keyword', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRows)

      const searchResult = await RcmViralHepatitisService.getViralHepatitisReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', search: 'สมศรี', refresh: true },
        mockExecutor
      )
      expect(searchResult.totalCount).toBe(1)
      expect(searchResult.items[0].ptname).toBe('นางสมศรี มีสุข')
    })
  })
})
