import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmDentalImplantService,
  DENSUR_ADP_CODE,
  type DentalImplantReportParams,
} from '../rcmDentalImplantService'

describe('RcmDentalImplantService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  describe('Constants', () => {
    it('defines standard DENSUR ADP code', () => {
      expect(DENSUR_ADP_CODE).toBe('DENSUR')
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when DENSUR ADP code exists', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3000123',
          name: 'บริการผ่าตัดใส่รากฟันเทียม',
          strength: null,
          nhso_adp_code: 'DENSUR',
        },
      ])

      const result = await RcmDentalImplantService.checkAdpMapping(mockExecutor, true)
      expect(result.adpCode).toBe('DENSUR')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('3000123')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['DENSUR'],
        expect.any(Object)
      )
    })

    it('returns isMapped false when query fails or returns empty array', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB error'))
      const result = await RcmDentalImplantService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toEqual([])
    })
  })

  describe('getDensurReport', () => {
    const mockRawRows = [
      {
        vn: '691001083001',
        cid: '1529900111221',
        hn: '0000001',
        ptname: 'นาย สมชาย ฟันดี',
        sex_code: '1',
        age: 35,
        nation: 'ไทย',
        vstdate: '2026-10-01',
        vsttime: '09:00:00',
        authencode: 'AUTH001',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'ทันตกรรม',
        clinic: 'คลินิกทันตกรรม',
        pdx: 'K081',
        dx0: null,
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: '2321',
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        listname: 'ผ่าตัดใส่รากฟันเทียม DENSUR',
        status: 'ชดเชยแล้ว',
        rep: 'REP001',
        compensated: 3000,
        agency: 'NHSO',
        fund: 'กองทุนรากฟันเทียม',
        subfund: 'DENSUR',
      },
      {
        vn: '691001083002',
        cid: '1529900111222',
        hn: '0000002',
        ptname: 'นาง สมศรี มีฟัน',
        sex_code: '2',
        age: 42,
        nation: 'ไทย',
        vstdate: '2026-10-02',
        vsttime: '10:30:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ',
        department: 'ทันตกรรม',
        clinic: 'คลินิกทันตกรรม',
        pdx: 'K081',
        dx0: null,
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: '2321',
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        listname: 'ผ่าตัดใส่รากฟันเทียม DENSUR',
        status: null,
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
      },
      {
        vn: '691001083003',
        cid: '1529900111223',
        hn: '0000001', // Same patient (สมชาย ฟันดี)
        ptname: 'นาย สมชาย ฟันดี',
        sex_code: '1',
        age: 35,
        nation: 'ไทย',
        vstdate: '2026-10-15',
        vsttime: '14:00:00',
        authencode: 'AUTH002',
        maininscl: 'UCS',
        pttypename: 'ประกันสุขภาพถ้วนหน้า',
        department: 'ทันตกรรม',
        clinic: 'คลินิกทันตกรรม',
        pdx: 'K081',
        dx0: null,
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: '2322',
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        listname: 'ผ่าตัดใส่รากฟันเทียม DENSUR',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP002',
        compensated: 3000,
        agency: 'NHSO',
        fund: 'กองทุนรากฟันเทียม',
        subfund: 'DENSUR',
      },
    ]

    const createMockExecutor = () => {
      return vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            {
              icode: '3000123',
              name: 'บริการผ่าตัดใส่รากฟันเทียม',
              strength: null,
              nhso_adp_code: 'DENSUR',
            },
          ])
        }
        return Promise.resolve(mockRawRows)
      })
    }

    it('aggregates summary KPIs correctly', async () => {
      const mockExecutor = createMockExecutor()
      const params: DentalImplantReportParams = {
        ds1: '2026-10-01',
        ds2: '2026-10-31',
      }

      const result = await RcmDentalImplantService.getDensurReport(params, mockExecutor)

      expect(result.title).toBe('กองทุนรากฟันเทียม')
      expect(result.subtitle).toBe('รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR')
      expect(result.adpCode).toBe('DENSUR')
      expect(result.summary.totalCases).toBe(3)
      expect(result.summary.uniquePatients).toBe(2) // 2 unique HNs
      expect(result.summary.compensatedCases).toBe(2)
      expect(result.summary.uncompensatedCases).toBe(1)
      expect(result.summary.totalCompensated).toBe(6000)
      expect(result.summary.withAuthenCount).toBe(2)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.ucCount).toBe(2)
      expect(result.items.length).toBe(3)
    })

    it('filters by COMPENSATED cardFilter', async () => {
      const mockExecutor = createMockExecutor()
      const result = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'COMPENSATED' },
        mockExecutor
      )

      expect(result.items.length).toBe(2)
      expect(result.items.every((it) => it.isCompensated)).toBe(true)
    })

    it('filters by UNCOMPENSATED cardFilter', async () => {
      const mockExecutor = createMockExecutor()
      const result = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'UNCOMPENSATED' },
        mockExecutor
      )

      expect(result.items.length).toBe(1)
      expect(result.items[0].hn).toBe('0000002')
    })

    it('filters by WITH_AUTHEN and NO_AUTHEN', async () => {
      const mockExecutor = createMockExecutor()
      const withAuth = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'WITH_AUTHEN' },
        mockExecutor
      )
      expect(withAuth.items.length).toBe(2)

      clearMemoryCache()
      const noAuth = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'NO_AUTHEN' },
        mockExecutor
      )
      expect(noAuth.items.length).toBe(1)
      expect(noAuth.items[0].hn).toBe('0000002')
    })

    it('filters by UC_ONLY cardFilter', async () => {
      const mockExecutor = createMockExecutor()
      const ucOnly = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'UC_ONLY' },
        mockExecutor
      )
      expect(ucOnly.items.length).toBe(2)
      expect(ucOnly.items.every((it) => it.isUc)).toBe(true)
    })

    it('searches by patient name, CID, HN, or diagnosis', async () => {
      const mockExecutor = createMockExecutor()

      const searchByName = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', search: 'สมศรี' },
        mockExecutor
      )
      expect(searchByName.items.length).toBe(1)
      expect(searchByName.items[0].hn).toBe('0000002')

      clearMemoryCache()
      const searchByHn = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', search: '0000001' },
        mockExecutor
      )
      expect(searchByHn.items.length).toBe(2)
    })

    it('supports sorting and pagination', async () => {
      const mockExecutor = createMockExecutor()

      const paginated = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', page: 1, pageSize: 2 },
        mockExecutor
      )
      expect(paginated.items.length).toBe(2)
      expect(paginated.totalCount).toBe(3)
      expect(paginated.totalPages).toBe(2)

      clearMemoryCache()
      const page2 = await RcmDentalImplantService.getDensurReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', page: 2, pageSize: 2 },
        mockExecutor
      )
      expect(page2.items.length).toBe(1)
      expect(page2.items[0].no).toBe(3)
    })
  })
})
