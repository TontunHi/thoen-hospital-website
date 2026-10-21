import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SmtBudgetService, SmtSearchOptions } from '../smtBudgetService'

describe('SmtBudgetService', () => {
  beforeEach(() => {
    SmtBudgetService.clearCache()
  })

  const mockUpstreamResponse = {
    datas: [
      {
        runDt: '2024-10-15',
        batchNo: 'B001',
        postingDate: '15/10/2567',
        refDocNo: 'DOC-01',
        fundName: 'งบผู้ป่วยนอก (OP)',
        fundGroupDescr: 'บริการทางการแพทย์',
        amount: 100000,
        total: 95000,
        wait: 0,
        debt: 5000,
        vat: 0,
        bond: 0,
        downloadPAYMFileName: 'PAYM_B001.pdf',
      },
      {
        runDt: '2024-11-20',
        batchNo: 'B002',
        postingDate: '20/11/2567',
        refDocNo: 'DOC-02',
        fundName: 'งบผู้ป่วยใน (IP)',
        fundGroupDescr: 'บริการทางการแพทย์',
        amount: 250000,
        total: 240000,
        wait: 10000,
        debt: 0,
        vat: 0,
        bond: 0,
        downloadPAYMFileName: 'PAYM_B002.pdf',
      },
    ],
  }

  it('calculates summary aggregates accurately for queried items', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(mockUpstreamResponse)

    const result = await SmtBudgetService.searchBudget(
      {
        budgetYears: ['2570'],
        vendorId5Digit: '11152',
      },
      mockFetcher
    )

    expect(mockFetcher).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('upstream')
    expect(result.summary.recordCount).toBe(2)
    expect(result.summary.totalAmount).toBe(350000)
    expect(result.summary.totalNetPayment).toBe(335000)
    expect(result.summary.totalWait).toBe(10000)
    expect(result.summary.totalDebt).toBe(5000)
    expect(result.datas[0].fiscalYear).toBe('2570')
  })

  it('uses in-memory cache on subsequent requests within TTL', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(mockUpstreamResponse)

    const opts: SmtSearchOptions = {
      budgetYears: ['2570'],
      vendorId5Digit: '11152',
    }

    // Call 1 -> Upstream
    const res1 = await SmtBudgetService.searchBudget(opts, mockFetcher)
    expect(res1.source).toBe('upstream')
    expect(mockFetcher).toHaveBeenCalledTimes(1)

    // Call 2 -> Cache
    const res2 = await SmtBudgetService.searchBudget(opts, mockFetcher)
    expect(res2.source).toBe('cache')
    expect(mockFetcher).toHaveBeenCalledTimes(1) // not called again!
    expect(res2.summary.totalAmount).toBe(350000)

    // Call 3 with forceRefresh -> Upstream again
    const res3 = await SmtBudgetService.searchBudget({ ...opts, forceRefresh: true }, mockFetcher)
    expect(res3.source).toBe('upstream')
    expect(mockFetcher).toHaveBeenCalledTimes(2)
  })

  it('aggregates multiple fiscal years correctly', async () => {
    const mockFetcher = vi.fn().mockImplementation(async (payload: any) => {
      if (payload.budgetYear === '2570') {
        return {
          datas: [{ amount: 1000, total: 1000, wait: 0, debt: 0, vat: 0, bond: 0 }],
        }
      }
      return {
        datas: [{ amount: 2000, total: 2000, wait: 0, debt: 0, vat: 0, bond: 0 }],
      }
    })

    const result = await SmtBudgetService.searchBudget(
      {
        budgetYears: ['2570', '2569'],
        vendorId5Digit: '11152',
      },
      mockFetcher
    )

    expect(mockFetcher).toHaveBeenCalledTimes(2)
    expect(result.datas).toHaveLength(2)
    expect(result.summary.totalAmount).toBe(3000)
  })
})
