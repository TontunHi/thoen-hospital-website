import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmCancerFundService,
  isUniversalCoverageScheme,
  CANCER_ADP_CODE,
  type CancerFundReportParams,
} from '../rcmCancerFundService'

describe('RcmCancerFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
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
    it('defines standard Cancer ADP code CANCER', () => {
      expect(CANCER_ADP_CODE).toBe('CANCER')
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when CANCER ADP code exists in s_drugitems or drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1590001',
          name: 'Paclitaxel 100 mg injection',
          strength: '100 mg',
          nhso_adp_code: 'CANCER',
        },
      ])

      const result = await RcmCancerFundService.checkAdpMapping(mockExecutor, true)
      expect(result.adpCode).toBe('CANCER')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('1590001')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['CANCER', 'CANCER'],
        expect.any(Object)
      )
    })

    it('returns isMapped false when query throws or returns empty', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB error'))
      const result = await RcmCancerFundService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getCancerPatientsReport', () => {
    const mockRawRows = [
      {
        vn: '691001083001',
        cid: '1529900111221',
        hn: '0000001',
        ptname: 'นาย สมชาย รักดี',
        firstName: 'นาย สมชาย',
        lastName: 'รักดี',
        birthday: '1960-05-15',
        sex_code: '1',
        sex: 'ชาย',
        age: 66,
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH001',
        maininscl: 'UCS',
        pttype_eclaim_id: '01',
        pttypename: 'บัตรทอง',
        department: 'กลุ่มงานอายุรกรรม',
        clinic: 'คลินิกเคมีบำบัด',
        pdx: 'C349',
        dx0: 'Z511',
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
        listname: 'Paclitaxel 100 mg injection',
        income: 5000,
        rep: 'REP-C01',
        compensated: 4500,
        transactiontype: 'OP',
        invoice: 'INV-001',
        invoice_compensated: 4500,
        resource: 'NHSO',
        subfund: 'CANCER',
        remark: null,
        projectcode: 'CA01',
        status_eclaim: 'NHSO :: ได้รับ Invoice แล้ว',
      },
      {
        vn: '691001083002',
        cid: '1529900111222',
        hn: '0000002',
        ptname: 'นาง สมศรี มีหวัง',
        firstName: 'นาง สมศรี',
        lastName: 'มีหวัง',
        birthday: '1970-08-20',
        sex_code: '2',
        sex: 'หญิง',
        age: 56,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '09:15:00',
        authencode: null,
        maininscl: 'SSS',
        pttype_eclaim_id: '',
        pttypename: 'ประกันสังคม',
        department: 'กลุ่มงานอายุรกรรม',
        clinic: 'คลินิกเคมีบำบัด',
        pdx: 'C509',
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
        listname: 'Tamoxifen 20 mg',
        income: 2000,
        rep: null,
        compensated: 0,
        transactiontype: null,
        invoice: null,
        invoice_compensated: 0,
        resource: null,
        subfund: null,
        remark: null,
        projectcode: null,
        status_eclaim: '- :: ยังไม่ได้ส่ง',
      },
    ]

    const createMockExecutor = () => {
      return vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) {
          return Promise.resolve([
            {
              icode: '1590001',
              name: 'Paclitaxel 100 mg injection',
              strength: '100 mg',
              nhso_adp_code: 'CANCER',
            },
          ])
        }
        return Promise.resolve(mockRawRows)
      })
    }

    it('returns complete report with summary metrics, pagination and mapping', async () => {
      const executor = createMockExecutor()
      const params: CancerFundReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
        refresh: true,
        page: 1,
        pageSize: 50,
      }

      const res = await RcmCancerFundService.getCancerPatientsReport(params, executor)

      expect(res.categoryTitle).toBe('กองทุนมะเร็ง')
      expect(res.subTitle).toBe('รายชื่อผู้ป่วย จาก ADP (CANCER)')
      expect(res.totalCount).toBe(2)
      expect(res.items.length).toBe(2)
      expect(res.summary.totalVisits).toBe(2)
      expect(res.summary.uniquePatients).toBe(2)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.uncompensatedVisits).toBe(1)
      expect(res.summary.compensationRate).toBe(50)
      expect(res.summary.totalCompensated).toBe(4500)
      expect(res.summary.totalIncome).toBe(7000)
      expect(res.items[0].income).toBe(2000)
      expect(res.items[1].income).toBe(5000)
      expect(res.summary.withAuthenCount).toBe(1)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.authenRate).toBe(50)
      expect(res.summary.invoiceCount).toBe(1)
      expect(res.summary.ucCount).toBe(1)
      expect(res.adpMapping.isMapped).toBe(true)
    })

    it('filters correctly by cardFilter: COMPENSATED', async () => {
      const executor = createMockExecutor()
      const res = await RcmCancerFundService.getCancerPatientsReport(
        { cardFilter: 'COMPENSATED', refresh: true },
        executor
      )

      expect(res.items.length).toBe(1)
      expect(res.items[0].hn).toBe('0000001')
      expect(res.items[0].isCompensated).toBe(true)
    })

    it('filters correctly by cardFilter: UNCOMPENSATED', async () => {
      const executor = createMockExecutor()
      const res = await RcmCancerFundService.getCancerPatientsReport(
        { cardFilter: 'UNCOMPENSATED', refresh: true },
        executor
      )

      expect(res.items.length).toBe(1)
      expect(res.items[0].hn).toBe('0000002')
      expect(res.items[0].isCompensated).toBe(false)
    })

    it('filters correctly by cardFilter: WITH_AUTHEN and NO_AUTHEN', async () => {
      const executor = createMockExecutor()
      const resWith = await RcmCancerFundService.getCancerPatientsReport(
        { cardFilter: 'WITH_AUTHEN', refresh: true },
        executor
      )
      expect(resWith.items.length).toBe(1)
      expect(resWith.items[0].authencode).toBe('AUTH001')

      const resNo = await RcmCancerFundService.getCancerPatientsReport(
        { cardFilter: 'NO_AUTHEN', refresh: true },
        executor
      )
      expect(resNo.items.length).toBe(1)
      expect(resNo.items[0].authencode).toBeNull()
    })

    it('filters correctly by search query', async () => {
      const executor = createMockExecutor()
      const res = await RcmCancerFundService.getCancerPatientsReport(
        { search: 'สมศรี', refresh: true },
        executor
      )

      expect(res.items.length).toBe(1)
      expect(res.items[0].ptname).toContain('สมศรี')
    })

    it('filters correctly by search query with rep', async () => {
      const executor = createMockExecutor()
      const res = await RcmCancerFundService.getCancerPatientsReport(
        { search: 'REP-C01', refresh: true },
        executor
      )

      expect(res.items.length).toBe(1)
      expect(res.items[0].rep).toBe('REP-C01')
    })

    it('supports sorting by different fields', async () => {
      const executor = createMockExecutor()
      const resDesc = await RcmCancerFundService.getCancerPatientsReport(
        { sortBy: 'compensated', sortOrder: 'desc', refresh: true },
        executor
      )
      expect(resDesc.items[0].compensated).toBe(4500)

      const resAsc = await RcmCancerFundService.getCancerPatientsReport(
        { sortBy: 'compensated', sortOrder: 'asc', refresh: true },
        executor
      )
      expect(resAsc.items[0].compensated).toBe(0)
    })

    it('supports exportAll=true to return unpaginated records', async () => {
      const executor = createMockExecutor()
      const res = await RcmCancerFundService.getCancerPatientsReport(
        { exportAll: true, pageSize: 1, refresh: true },
        executor
      )
      expect(res.items.length).toBe(2)
      expect(res.items[0].no).toBe(1)
      expect(res.items[1].no).toBe(2)
    })
  })
})
