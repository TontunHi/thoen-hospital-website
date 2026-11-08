import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmInstrumentFundService,
  parseInstrumentItemList,
} from '../rcmInstrumentFundService'
import { clearMemoryCache } from '@/lib/cache'

describe('RcmInstrumentFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  describe('parseInstrumentItemList', () => {
    it('correctly parses concatenated instrument items with code, name, and price', () => {
      const raw = '7004:ข้อเข่าเทียม#12000.00, 7005:เบ้ารองข้อเข่า#5000.50'
      const items = parseInstrumentItemList(raw)
      expect(items).toHaveLength(2)
      expect(items[0]).toEqual({
        adpCode: '7004',
        name: 'ข้อเข่าเทียม',
        price: 12000,
      })
      expect(items[1]).toEqual({
        adpCode: '7005',
        name: 'เบ้ารองข้อเข่า',
        price: 5000.5,
      })
    })

    it('handles empty or malformed strings gracefully', () => {
      expect(parseInstrumentItemList('')).toEqual([])
      expect(parseInstrumentItemList(null)).toEqual([])
      expect(parseInstrumentItemList('ไม่มีรหัส')).toEqual([
        { adpCode: '-', name: 'ไม่มีรหัส', price: 0 },
      ])
    })
  })

  describe('checkAdpMapping', () => {
    it('returns mapped = true when nondrugitems has nhso_adp_type_id = 2 items', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        { icode: '3000001', name: 'ข้อเข่าเทียม', nhso_adp_code: '7004', nhso_adp_type_id: 2 },
        { icode: '3000002', name: 'แถบตรวจน้ำตาล', nhso_adp_code: '8612', nhso_adp_type_id: 2 },
      ])

      const result = await RcmInstrumentFundService.checkAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(2)
      expect(result.items[0].nhso_adp_code).toBe('7004')
    })

    it('returns mapped = false when no items exist', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmInstrumentFundService.checkAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })
  })

  describe('getReportData (OPD)', () => {
    const mockOpdRows = [
      {
        vn: '691001111111',
        cid: '1529900011111',
        hn: '0011111',
        ptname: 'นาย สมชาย ใจดี',
        sex_code: '1',
        vstdate: '2026-10-15',
        vsttime: '08:30:00',
        inscl: 'UCS',
        pttypename: 'บัตรทอง',
        room: 'ห้องตรวจศัลยกรรม',
        authencode: 'AUTH001',
        money_hosxp: 25000,
        discount_money: 0,
        rcpt_money: 0,
        debit: 25000,
        rcpno: '12345',
        instrument: 17000,
        list: '7004:ข้อเข่าเทียม#12000.00, 7005:เบ้ารองข้อเข่า#5000.00',
        oa: 'Y',
        dm: null,
        item_count: 2,
        money_eclaim: 17000,
        money_rep: 0,
        money_invoice: 17000,
        eclaim_status: '1',
        eclaim_statusname: 'ผ่านการตรวจสอบ',
      },
      {
        vn: '691002222222',
        cid: '1529900022222',
        hn: '0022222',
        ptname: 'นาง สมศรี มั่งมี',
        sex_code: '2',
        vstdate: '2026-10-20',
        vsttime: '09:15:00',
        inscl: 'UCS',
        pttypename: 'บัตรทอง',
        room: 'ห้องตรวจเบาหวาน',
        authencode: null,
        money_hosxp: 2500,
        discount_money: 0,
        rcpt_money: 0,
        debit: 2500,
        rcpno: null,
        instrument: 1500,
        list: '8612:แถบตรวจน้ำตาล#1500.00',
        oa: null,
        dm: 'Y',
        item_count: 1,
        money_eclaim: 1200, // Discrepancy!
        money_rep: 1200,
        money_invoice: 0,
        eclaim_status: '1',
        eclaim_statusname: 'ผ่านการตรวจสอบ',
      },
      {
        vn: '691003333333',
        cid: '1529900033333',
        hn: '0033333',
        ptname: 'นาย ประสิทธิ์ สุขใจ',
        sex_code: '1',
        vstdate: '2026-11-01',
        vsttime: '10:00:00',
        inscl: 'OFC',
        pttypename: 'ข้าราชการ',
        room: 'ห้องตรวจกระดูก',
        authencode: null,
        money_hosxp: 3500,
        discount_money: 0,
        rcpt_money: 0,
        debit: 3500,
        rcpno: null,
        instrument: 3000,
        list: '9999:อุปกรณ์อื่นๆ#3000.00',
        oa: null,
        dm: null,
        item_count: 1,
        money_eclaim: 0,
        money_rep: 0,
        money_invoice: 0,
        eclaim_status: null,
        eclaim_statusname: null,
      },
    ]

    it('aggregates OPD instrument data and summary correctly', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockOpdRows) // Main report query
        .mockResolvedValueOnce([
          { icode: '3000001', name: 'ข้อเข่า', nhso_adp_code: '7004' },
        ]) // ADP mapping check

      const result = await RcmInstrumentFundService.getReportData(
        {
          ds1: '2026-10-01',
          ds2: '2027-09-30',
          patientType: 'OPD',
          page: 1,
          pageSize: 50,
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(3)
      expect(result.total).toBe(3)
      expect(result.summary.totalCases).toBe(3)
      expect(result.summary.totalUniquePatients).toBe(3)
      expect(result.summary.totalInstrumentHosp).toBe(17000 + 1500 + 3000)

      // Breakdown by equipment category
      expect(result.summary.oaCases).toBe(1)
      expect(result.summary.oaAmount).toBe(17000)
      expect(result.summary.dmCases).toBe(1)
      expect(result.summary.dmAmount).toBe(1500)
      expect(result.summary.otherCases).toBe(1)
      expect(result.summary.otherAmount).toBe(3000)

      // Breakdown by Claim status
      expect(result.summary.invoiceCases).toBe(1)
      expect(result.summary.repCases).toBe(1)
      expect(result.summary.unsentCases).toBe(1)
      expect(result.summary.unsentAmount).toBe(3000)
      expect(result.summary.discrepancyCases).toBe(1) // Patient 2: 1500 vs 1200
    })

    it('filters by cardFilter = OA', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockOpdRows)
        .mockResolvedValueOnce([])

      const result = await RcmInstrumentFundService.getReportData(
        {
          ds1: '2026-10-01',
          ds2: '2027-09-30',
          patientType: 'OPD',
          cardFilter: 'OA',
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].oa).toBe('Y')
      expect(result.items[0].hn).toBe('0011111')
    })

    it('filters by cardFilter = DM', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockOpdRows)
        .mockResolvedValueOnce([])

      const result = await RcmInstrumentFundService.getReportData(
        {
          ds1: '2026-10-01',
          ds2: '2027-09-30',
          patientType: 'OPD',
          cardFilter: 'DM',
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].dm).toBe('Y')
      expect(result.items[0].hn).toBe('0022222')
    })

    it('filters by cardFilter = DISCREPANCY', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockOpdRows)
        .mockResolvedValueOnce([])

      const result = await RcmInstrumentFundService.getReportData(
        {
          ds1: '2026-10-01',
          ds2: '2027-09-30',
          patientType: 'OPD',
          cardFilter: 'DISCREPANCY',
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].isDiscrepancy).toBe(true)
      expect(result.items[0].hn).toBe('0022222')
    })

    it('filters by Unified Global Search (CID, HN, Name, ADP Code)', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockOpdRows)
        .mockResolvedValueOnce([])

      const result = await RcmInstrumentFundService.getReportData(
        {
          ds1: '2026-10-01',
          ds2: '2027-09-30',
          patientType: 'OPD',
          search: 'แถบตรวจน้ำตาล',
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].hn).toBe('0022222')
    })
  })

  describe('getReportData (IPD)', () => {
    const mockIpdRows = [
      {
        an: '690001234',
        hn: '0044444',
        cid: '1529900044444',
        ptname: 'นาย วิชัย ชัยชนะ',
        sex_code: '1',
        admdate: '2026-10-10',
        dchdate: '2026-10-15',
        ward: 'ตึกศัลยกรรมชาย',
        inscl: 'UCS',
        pttypename: 'ประกันสุขภาพถ้วนหน้า',
        authencode: 'AUTHIPD01',
        money_hosxp: 45000,
        discount_money: 0,
        rcpt_money: 0,
        debit: 45000,
        rcpno: null,
        instrument: 25000,
        list: '7004:ข้อเข่าเทียม#25000.00',
        oa: 'Y',
        dm: null,
        item_count: 1,
        money_eclaim: 25000,
        money_rep: 25000,
        money_invoice: 25000,
        eclaim_status: '1',
        eclaim_statusname: 'อนุมัติจ่าย',
      },
    ]

    it('processes IPD items with admission dates and ward', async () => {
      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockIpdRows)
        .mockResolvedValueOnce([])

      const result = await RcmInstrumentFundService.getReportData(
        {
          ds1: '2026-10-01',
          ds2: '2027-09-30',
          patientType: 'IPD',
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].patientType).toBe('IPD')
      expect(result.items[0].an).toBe('690001234')
      expect(result.items[0].ward).toBe('ตึกศัลยกรรมชาย')
      expect(result.items[0].dchdate).toBe('2026-10-15')
      expect(result.summary.totalCases).toBe(1)
    })
  })
})
