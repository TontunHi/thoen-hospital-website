import { describe, it, expect, vi } from 'vitest'
import {
  RcmDashboardService,
  dateRangeToYymmList,
} from '@/lib/clinical/rcmDashboardService'

vi.mock('@/lib/cache', () => ({
  getCachedData: vi.fn((_key, fetcher) => fetcher()),
}))

describe('RcmDashboardService - Invoice Summary (5.2.2.1)', () => {
  describe('dateRangeToYymmList', () => {
    it('generates correct YYMM list for a single month', () => {
      const list = dateRangeToYymmList('2026-08-01', '2026-08-31')
      expect(list).toEqual(['6908'])
    })

    it('generates correct YYMM list spanning fiscal year bounds', () => {
      const list = dateRangeToYymmList('2025-10-01', '2026-09-30')
      expect(list).toEqual([
        '6810', '6811', '6812',
        '6901', '6902', '6903', '6904', '6905', '6906', '6907', '6908', '6909',
      ])
    })

    it('returns empty array for invalid dates', () => {
      expect(dateRangeToYymmList('invalid', 'dates')).toEqual([])
    })
  })

  describe('getInvoiceSummary', () => {
    it('executes query and computes grand total correctly for OPD', async () => {
      const mockRows = [
        {
          code: '01',
          name: 'UC ใน CUP',
          visit: 10,
          receipt: 5000,
          compensated: 4500,
          down: 500,
          up: -1000,
          debit: 5000,
        },
        {
          code: '17',
          name: 'เบิกจ่ายตรงกรมบัญชีกลาง',
          visit: 5,
          receipt: 2000,
          compensated: 2000,
          down: 0,
          up: 0,
          debit: 2000,
        },
      ]

      const mockExecutor = vi.fn().mockResolvedValue(mockRows)

      const result = await RcmDashboardService.getInvoiceSummary(
        {
          department: 'OP',
          ds1: '2026-08-01',
          ds2: '2026-08-31',
        },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalled()
      expect(result.department).toBe('OP')
      expect(result.items.length).toBe(2)
      expect(result.grandTotal).toEqual({
        visit: 15,
        receipt: 7000,
        compensated: 6500,
        down: 500,
        up: -1000,
        debit: 7000,
      })
    })

    it('handles IPD department parameter correctly', async () => {
      const mockRows = [
        {
          code: '01',
          name: 'UC ใน CUP',
          visit: 2,
          receipt: 12000,
          compensated: 10000,
          down: 0,
          up: -2000,
          debit: 12000,
        },
      ]

      const mockExecutor = vi.fn().mockResolvedValue(mockRows)

      const result = await RcmDashboardService.getInvoiceSummary(
        {
          department: 'IP',
          ds1: '2026-08-01',
          ds2: '2026-08-31',
        },
        mockExecutor
      )

      expect(result.department).toBe('IP')
      expect(result.grandTotal.visit).toBe(2)
      expect(result.grandTotal.compensated).toBe(10000)
    })
  })

  describe('getInvoiceDetails', () => {
    it('executes count and paginated data queries correctly', async () => {
      const mockCount = [{ total: 1 }]
      const mockItems = [
        {
          vnOrAn: '690813131739',
          cid: '1234567890123',
          hn: '123456',
          ptname: 'นายทดสอบ ระบบ',
          vstdate: '2026-08-13',
          vsttime: '13:17:00',
          compensated: 572,
          fund_money: 0,
          income_hosxp: 572,
          rcpt_money: 0,
          debit_hosxp: 572,
          hc: 0,
          ae: 0,
          inst: 0,
          op: 0,
          ip: 0,
          drug: 0,
          dmis: 0,
          down: 0,
          up: 0,
          rep: '690800078',
          bill: '8843/022',
          billdate: '2026-08-25',
          pttype_eclaim_id: '01',
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockItems)

      const result = await RcmDashboardService.getInvoiceDetails(
        {
          department: 'OP',
          ds1: '2026-08-01',
          ds2: '2026-08-31',
          pttype: '01',
          page: 1,
          pageSize: 50,
        },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalledTimes(2)
      expect(result.totalCount).toBe(1)
      expect(result.items.length).toBe(1)
      expect(result.items[0].no).toBe(1)
      expect(result.items[0].vnOrAn).toBe('690813131739')
      expect(result.items[0].cid).toBe('1234567890123')
    })
  })
})
