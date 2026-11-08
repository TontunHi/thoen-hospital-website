import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmClopidogrelService,
  isUniversalCoverageScheme,
  CLOPIDOGREL_ADP_CODE,
  CLOPIDOGREL_DID_PREFIX,
  type ClopidogrelReportParams,
} from '../rcmClopidogrelService'

describe('RcmClopidogrelService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isUniversalCoverageScheme', () => {
    it('returns true for pttype_eclaim_id between 01 and 09', () => {
      expect(isUniversalCoverageScheme('', '', '01')).toBe(true)
      expect(isUniversalCoverageScheme('', '', '05')).toBe(true)
      expect(isUniversalCoverageScheme('', '', '09')).toBe(true)
      expect(isUniversalCoverageScheme('', '', '10')).toBe(false)
    })

    it('returns true for UCS / WEL / UC in maininscl', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
    })

    it('returns true for Thai UC keywords in pttypename', () => {
      expect(isUniversalCoverageScheme('', 'บัตรทอง')).toBe(true)
      expect(isUniversalCoverageScheme('', 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme('', '30 บาทรักษาทุกโรค')).toBe(true)
      expect(isUniversalCoverageScheme('', 'UC สิทธิประกันสุขภาพ')).toBe(true)
    })

    it('returns false for non-UC schemes', () => {
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ')).toBe(false)
      expect(isUniversalCoverageScheme('', '')).toBe(false)
    })
  })

  describe('Constants', () => {
    it('defines standard Clopidogrel ADP code and DID prefix', () => {
      expect(CLOPIDOGREL_ADP_CODE).toBe('3799977101')
      expect(CLOPIDOGREL_DID_PREFIX).toBe('1248460000039721217')
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when ADP code exists', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1540099',
          name: 'Clopidogrel 75 mg',
          strength: '75 mg',
          nhso_adp_code: '3799977101',
        },
      ])

      const result = await RcmClopidogrelService.checkAdpMapping(mockExecutor, true)
      expect(result.adpCode).toBe('3799977101')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('1540099')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['3799977101', '3799977101'],
        expect.any(Object)
      )
    })

    it('returns isMapped false when database query throws or returns empty', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB error'))
      const result = await RcmClopidogrelService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getClopidogrelReport', () => {
    const mockRawRows = [
      {
        vn: '691001083001',
        cid: '1529900111221',
        hn: '0000001',
        ptname: 'นาย สมชาย ใจดี',
        firstName: 'นาย สมชาย',
        lastName: 'ใจดี',
        birthday: '1960-05-15',
        sex_code: '1',
        sex: 'ชาย',
        age: 66,
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH001',
        maininscl: 'UCS',
        pttype_eclaim_id: '01',
        pttypename: 'บัตรทอง',
        department: 'กลุ่มงานอายุรกรรม',
        clinic: 'ตรวจโรคทั่วไป',
        doctorname: 'นพ. รักษา ดี',
        pdx: 'I200',
        dx0: 'I10',
        dx1: null,
        hosxp_money: 1200,
        icode: '1540099',
        drugname: 'Clopidogrel 75 mg tablet',
        units: 'เม็ด',
        adpcode: '3799977101',
        tmt: '123456',
        did: '1248460000039721217001',
        qty: 30,
        money: 300,
        status_eclaim: 'NHSO :: ได้รับ Invoice แล้ว',
        rep: 'REP1001',
        compensated: 280,
        agency: 'NHSO',
        fund: 'กองทุนยา',
        subfund: 'Clopidogrel',
        errorcode: null,
      },
      {
        vn: '691001083002',
        cid: '1529900111222',
        hn: '0000002',
        ptname: 'นาง สมศรี มั่งมี',
        firstName: 'นาง สมศรี',
        lastName: 'มั่งมี',
        birthday: '1970-08-20',
        sex_code: '2',
        sex: 'หญิง',
        age: 56,
        vstdate: '2026-10-02',
        vsttime: '09:15:00',
        authencode: null,
        maininscl: 'SSS',
        pttype_eclaim_id: '',
        pttypename: 'ประกันสังคม',
        department: 'กลุ่มงานอายุรกรรม',
        clinic: 'ตรวจโรคทั่วไป',
        doctorname: 'พญ. เมตตา จิต',
        pdx: 'I251',
        dx0: null,
        dx1: null,
        hosxp_money: 800,
        icode: '1540099',
        drugname: 'Clopidogrel 75 mg tablet',
        units: 'เม็ด',
        adpcode: '3799977101',
        tmt: '123456',
        did: '1248460000039721217001',
        qty: 60,
        money: 600,
        status_eclaim: '- :: ยังไม่ได้ส่ง',
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
        errorcode: null,
      },
    ]

    const createMockExecutor = () => {
      return vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('s_drugitems') || sql.includes('SELECT icode, name')) {
          return Promise.resolve([
            {
              icode: '1540099',
              name: 'Clopidogrel 75 mg',
              strength: '75 mg',
              nhso_adp_code: '3799977101',
            },
          ])
        }
        return Promise.resolve(mockRawRows)
      })
    }

    it('fetches and calculates summary KPIs accurately', async () => {
      const mockExecutor = createMockExecutor()
      const params: ClopidogrelReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        cardFilter: 'ALL',
        refresh: true,
      }

      const result = await RcmClopidogrelService.getClopidogrelReport(params, mockExecutor)

      expect(result.summary.totalVisits).toBe(2)
      expect(result.summary.uniquePatients).toBe(2)
      expect(result.summary.compensatedVisits).toBe(1)
      expect(result.summary.uncompensatedVisits).toBe(1)
      expect(result.summary.totalCompensated).toBe(280)
      expect(result.summary.compensationRate).toBe(50)
      expect(result.summary.totalDrugMoney).toBe(900)
      expect(result.summary.totalHosxpIncome).toBe(2000)
      expect(result.summary.totalQty).toBe(90)
      expect(result.summary.withAuthenCount).toBe(1)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.authenRate).toBe(50)
      expect(result.summary.ucCount).toBe(1)
      expect(result.summary.ucRate).toBe(50)
      expect(result.summary.invoiceCount).toBe(1)
      expect(result.summary.notSentCount).toBe(1)
      expect(result.items.length).toBe(2)
    })

    it('filters by cardFilter COMPENSATED', async () => {
      const mockExecutor = createMockExecutor()
      const result = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'COMPENSATED',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.totalCount).toBe(1)
      expect(result.items[0].vn).toBe('691001083001')
      expect(result.items[0].isCompensated).toBe(true)
    })

    it('filters by cardFilter UNCOMPENSATED', async () => {
      const mockExecutor = createMockExecutor()
      const result = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'UNCOMPENSATED',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.totalCount).toBe(1)
      expect(result.items[0].vn).toBe('691001083002')
      expect(result.items[0].isCompensated).toBe(false)
    })

    it('filters by cardFilter UC_ONLY', async () => {
      const mockExecutor = createMockExecutor()
      const result = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'UC_ONLY',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.totalCount).toBe(1)
      expect(result.items[0].isUc).toBe(true)
    })

    it('filters by cardFilter WITH_AUTHEN and NO_AUTHEN', async () => {
      const mockExecutor = createMockExecutor()
      const withAuthen = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'WITH_AUTHEN',
          refresh: true,
        },
        mockExecutor
      )
      expect(withAuthen.totalCount).toBe(1)
      expect(withAuthen.items[0].authencode).toBe('AUTH001')

      const noAuthen = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          cardFilter: 'NO_AUTHEN',
          refresh: true,
        },
        mockExecutor
      )
      expect(noAuthen.totalCount).toBe(1)
      expect(noAuthen.items[0].authencode).toBeNull()
    })

    it('searches across patient name, HN, doctor, diagnosis', async () => {
      const mockExecutor = createMockExecutor()
      const searchByName = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          search: 'สมศรี',
          refresh: true,
        },
        mockExecutor
      )
      expect(searchByName.totalCount).toBe(1)
      expect(searchByName.items[0].hn).toBe('0000002')

      const searchByDiag = await RcmClopidogrelService.getClopidogrelReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          search: 'I200',
          refresh: true,
        },
        mockExecutor
      )
      expect(searchByDiag.totalCount).toBe(1)
      expect(searchByDiag.items[0].hn).toBe('0000001')
    })
  })
})
