import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmWalkinFundService,
  isUniversalCoverageScheme,
} from '../rcmWalkinFundService'
import { clearMemoryCache } from '@/lib/cache'

describe('RcmWalkinFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  describe('isUniversalCoverageScheme', () => {
    it('returns true for UCS, WEL, UC schemes', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
      expect(isUniversalCoverageScheme('', 'บัตรทอง')).toBe(true)
      expect(isUniversalCoverageScheme('', 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
    })

    it('returns false for non-UC schemes', () => {
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ')).toBe(false)
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme(null, null)).toBe(false)
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped = true when WALKIN code exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1000001',
          name: 'บริการ Walkin ตรวจรักษา',
          strength: null,
          nhso_adp_code: 'WALKIN',
        },
      ])

      const result = await RcmWalkinFundService.checkAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].nhso_adp_code).toBe('WALKIN')
    })

    it('returns isMapped = false when no rows match', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmWalkinFundService.checkAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })
  })

  describe('getReportData', () => {
    const mockRows = [
      {
        vn: '6910010001',
        an: null,
        cid: '1529900011111',
        hn: '0011111',
        ptname: 'นาย สมคิด สดใส',
        sex_code: '1',
        sex: '1',
        age: 45,
        nation: 'ไทย',
        vstdate: '2026-10-15',
        vsttime: '08:30:00',
        authencode: 'AUTH001',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'OPD ทั่วไป',
        clinic: 'เวชปฏิบัติทั่วไป',
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
        income: 500,
        listname: 'บริการ Walkin ผู้ป่วยนอก',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP12345',
        compensated: 400,
        transactiontype: 'OP',
        invoice: 'INV999',
        invoice_compensated: 400,
        resource: 'สปสช.',
        subfund: 'WALKIN',
        remark: null,
        projectcode: 'WK01',
      },
      {
        vn: '6910020002',
        an: null,
        cid: '1529900022222',
        hn: '0022222',
        ptname: 'นาง สมใจ มีสุข',
        sex_code: '2',
        sex: '2',
        age: 52,
        nation: 'ไทย',
        vstdate: '2026-10-16',
        vsttime: '09:00:00',
        authencode: null, // No Authen
        maininscl: 'OFC', // Not UC
        pttypename: 'ข้าราชการ',
        department: 'OPD ทั่วไป',
        clinic: 'เวชปฏิบัติทั่วไป',
        pdx: 'I10',
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
        income: 800,
        listname: 'บริการ Walkin ผู้ป่วยนอก',
        status: 'NHSO :: มี Invoice แล้ว',
        rep: null,
        compensated: 0,
        transactiontype: 'OP',
        invoice: 'INV888',
        invoice_compensated: 600,
        resource: 'สปสช.',
        subfund: 'WALKIN',
        remark: null,
        projectcode: 'WK01',
      },
      {
        vn: '6910030003',
        an: null,
        cid: '1529900033333',
        hn: '0033333',
        ptname: 'นาย ประสิทธิ์ ยั่งยืน',
        sex_code: '1',
        sex: '1',
        age: 38,
        nation: 'ไทย',
        vstdate: '2026-10-17',
        vsttime: '10:15:00',
        authencode: 'AUTH002',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        department: 'อุบัติเหตุฉุกเฉิน',
        clinic: 'เวชศาสตร์ฉุกเฉิน',
        pdx: 'J00',
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
        income: 300,
        listname: 'บริการ Walkin ผู้ป่วยนอก',
        status: null, // Unsent
        rep: null,
        compensated: 0,
        transactiontype: null,
        invoice: null,
        invoice_compensated: 0,
        resource: null,
        subfund: null,
        remark: null,
        projectcode: null,
      },
    ]

    const createMockExecutor = () => {
      return vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM s_drugitems') && !sql.includes('opitemrece')) {
          return [{ icode: '1000001', name: 'บริการ Walkin', strength: null, nhso_adp_code: 'WALKIN' }]
        }
        return mockRows
      })
    }

    it('aggregates summary metrics accurately', async () => {
      const mockExecutor = createMockExecutor()

      const res = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', page: 1, pageSize: 50 },
        mockExecutor
      )

      expect(res.totalCount).toBe(3)
      expect(res.summary.totalVisits).toBe(3)
      expect(res.summary.uniquePatients).toBe(3)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.totalCompensated).toBe(400)
      expect(res.summary.invoiceVisits).toBe(2)
      expect(res.summary.unsentVisits).toBe(1)
      expect(res.summary.withAuthenCount).toBe(2)
      expect(res.summary.withoutAuthenCount).toBe(1)
      expect(res.summary.ucCount).toBe(2)
      expect(res.summary.totalIncome).toBe(1600)
    })

    it('filters correctly by WITH_AUTHEN and NO_AUTHEN', async () => {
      const mockExecutor = createMockExecutor()

      const withAuthenRes = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'WITH_AUTHEN' },
        mockExecutor
      )
      expect(withAuthenRes.items).toHaveLength(2)
      expect(withAuthenRes.items.every((it) => Boolean(it.authencode))).toBe(true)

      clearMemoryCache()

      const noAuthenRes = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'NO_AUTHEN' },
        mockExecutor
      )
      expect(noAuthenRes.items).toHaveLength(1)
      expect(noAuthenRes.items[0].hn).toBe('0022222')
    })

    it('filters correctly by COMPENSATED, INVOICE, and UNSENT', async () => {
      const mockExecutor = createMockExecutor()

      const compRes = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'COMPENSATED' },
        mockExecutor
      )
      expect(compRes.items).toHaveLength(1)
      expect(compRes.items[0].rep).toBe('REP12345')

      clearMemoryCache()

      const invRes = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'INVOICE' },
        mockExecutor
      )
      expect(invRes.items).toHaveLength(1)
      expect(invRes.items[0].invoice).toBe('INV888')

      clearMemoryCache()

      const unsentRes = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', cardFilter: 'UNSENT' },
        mockExecutor
      )
      expect(unsentRes.items).toHaveLength(1)
      expect(unsentRes.items[0].hn).toBe('0033333')
    })

    it('filters by global search term', async () => {
      const mockExecutor = createMockExecutor()

      const res = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', search: 'สมใจ' },
        mockExecutor
      )
      expect(res.items).toHaveLength(1)
      expect(res.items[0].ptname).toContain('สมใจ')
    })

    it('uses Two-Source ClaimCode Guard and DATETIME Boundary Guard in SQL query', async () => {
      const mockExecutor = createMockExecutor()

      await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', refresh: true },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(NULLIF(TRIM(cc.AuthenCode)'),
        expect.any(Array),
        expect.any(Object)
      )
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN visit_pttype vt ON vt.vn = o.vn'),
        expect.any(Array),
        expect.any(Object)
      )
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)'),
        expect.any(Array),
        expect.any(Object)
      )
      expect(mockExecutor).not.toHaveBeenCalledWith(
        expect.stringContaining('m.dateadm BETWEEN ? AND ?'),
        expect.any(Array),
        expect.any(Object)
      )
    })

    it('filters correctly with pttypes and recalculates summary', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([])
        }
        return Promise.resolve([
          {
            vn: '6910010001',
            hn: '0011111',
            cid: '1529900011111',
            ptname: 'นาย ก',
            sex_code: '1',
            vstdate: '2026-10-01',
            vsttime: '09:00:00',
            maininscl: 'UCS',
            pttypename: 'บัตรทอง',
            pttype_eclaim_id: '01',
            income: 1000,
            compensated: 800,
            rep: 'REP1',
          },
          {
            vn: '6910010002',
            hn: '0022222',
            cid: '1529900022222',
            ptname: 'นาง ข',
            sex_code: '2',
            vstdate: '2026-10-02',
            vsttime: '10:00:00',
            maininscl: 'SSS',
            pttypename: 'ประกันสังคม',
            pttype_eclaim_id: '30',
            income: 2000,
            compensated: 1500,
            rep: 'REP2',
          },
        ])
      })

      const res = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', pttypes: '01,02' },
        mockExecutor
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].hn).toBe('0011111')
      expect(res.summary.totalVisits).toBe(1)
      expect(res.summary.totalIncome).toBe(1000)
    })

    it('falls back to ucOnly when pttypes is omitted', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([])
        }
        return Promise.resolve([
          {
            vn: '6910010001',
            hn: '0011111',
            cid: '1529900011111',
            ptname: 'นาย ก',
            sex_code: '1',
            vstdate: '2026-10-01',
            vsttime: '09:00:00',
            maininscl: 'UCS',
            pttypename: 'บัตรทอง',
            pttype_eclaim_id: '01',
            income: 1000,
            compensated: 800,
            rep: 'REP1',
          },
          {
            vn: '6910010002',
            hn: '0022222',
            cid: '1529900022222',
            ptname: 'นาง ข',
            sex_code: '2',
            vstdate: '2026-10-02',
            vsttime: '10:00:00',
            maininscl: 'SSS',
            pttypename: 'ประกันสังคม',
            pttype_eclaim_id: '30',
            income: 2000,
            compensated: 1500,
            rep: 'REP2',
          },
        ])
      })

      const res = await RcmWalkinFundService.getReportData(
        { ds1: '2026-10-01', ds2: '2026-10-31', ucOnly: true },
        mockExecutor
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].hn).toBe('0011111')
      expect(res.summary.totalVisits).toBe(1)
    })
  })
})
