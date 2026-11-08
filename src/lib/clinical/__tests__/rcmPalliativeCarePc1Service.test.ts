import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmDashboardService } from '../rcmDashboardService'

vi.mock('@/lib/cache', () => ({
  getCachedData: vi.fn((key: string, fetcher: () => Promise<any>) => fetcher()),
}))

describe('RcmDashboardService.getPalliativeCarePc1Report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockRows = [
    {
      vn: '691021131643',
      cid: '3520800269098',
      hn: '0000206',
      ptname: 'นางจันทนา ตันมา',
      age: 60,
      nation: 'ไทย',
      vstdate: '2026-10-21',
      vsttime: '13:16:43',
      authencode: 'AUTH001',
      pttypename: 'บัตรทอง ผู้สูงอายุ ในเขต',
      department: '117 จุดซักประวัติ Palliative Care',
      clinic: 'อายุรกรรม',
      pdx: 'C548',
      dx0: 'Z515',
      dx1: 'Z636',
      dx2: 'Z718',
      dx3: 'Z740',
      dx4: null,
      dx5: null,
      op0: null,
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      listname: 'ค่าเยี่ยมบ้านPaliative care',
      rep: '691000192',
      compensated: 1000,
      transaction_type: null,
      invoice: null,
      invoice_compensated: 0,
      resource: null,
      subfund: 'PALLIATIVE-CARE',
      remark: null,
      projectcode: null,
    },
    {
      vn: '691021131644',
      cid: '3520800269099',
      hn: '0000207',
      ptname: 'นายสมชาย ใจดี',
      age: 72,
      nation: 'ไทย',
      vstdate: '2026-10-22',
      vsttime: '09:30:15',
      authencode: '',
      pttypename: 'บัตรทอง ทั่วไป',
      department: '117 จุดซักประวัติ Palliative Care',
      clinic: 'อายุรกรรม',
      pdx: 'C349',
      dx0: 'Z515',
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
      listname: 'ค่าเยี่ยมบ้านPaliative care',
      rep: null,
      compensated: 0,
      transaction_type: null,
      invoice: null,
      invoice_compensated: 0,
      resource: null,
      subfund: 'PALLIATIVE-CARE',
      remark: 'รอผลเคลม',
      projectcode: null,
    },
  ]

  it('maps database rows to PalliativeCarePc1Item objects and calculates summary', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const result = await RcmDashboardService.getPalliativeCarePc1Report(
      { ds1: '2026-10-01', ds2: '2026-10-31' },
      mockExecutor
    )

    expect(result.summary.totalVisits).toBe(2)
    expect(result.summary.totalPatients).toBe(2)
    expect(result.summary.paidCount).toBe(1)
    expect(result.summary.unpaidCount).toBe(1)
    expect(result.summary.totalCompensated).toBe(1000)
    expect(result.summary.totalInvoiceCompensated).toBe(0)

    expect(result.items.length).toBe(2)
    expect(result.items[0].vn).toBe('691021131643')
    expect(result.items[0].ptname).toBe('นางจันทนา ตันมา')
    expect(result.items[0].compensated).toBe(1000)
    expect(result.items[0].no).toBe(1)
  })

  it('filters by paidStatus correctly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // PAID
    const paidResult = await RcmDashboardService.getPalliativeCarePc1Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', paidStatus: 'PAID' },
      mockExecutor
    )
    expect(paidResult.items.length).toBe(1)
    expect(paidResult.items[0].hn).toBe('0000206')

    // UNPAID
    const unpaidResult = await RcmDashboardService.getPalliativeCarePc1Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', paidStatus: 'UNPAID' },
      mockExecutor
    )
    expect(unpaidResult.items.length).toBe(1)
    expect(unpaidResult.items[0].hn).toBe('0000207')

    // INVOICE
    const invoiceRows = [
      ...mockRows,
      {
        ...mockRows[1],
        vn: '691021131645',
        hn: '0000208',
        invoice: 'INV001',
        invoice_compensated: 500,
      },
    ]
    const invExecutor = vi.fn().mockResolvedValue(invoiceRows)
    const invResult = await RcmDashboardService.getPalliativeCarePc1Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', paidStatus: 'INVOICE' },
      invExecutor
    )
    expect(invResult.items.length).toBe(1)
    expect(invResult.items[0].hn).toBe('0000208')
  })

  it('filters by search keyword correctly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const searchResult = await RcmDashboardService.getPalliativeCarePc1Report(
      { ds1: '2026-10-01', ds2: '2026-10-31', search: 'สมชาย' },
      mockExecutor
    )
    expect(searchResult.items.length).toBe(1)
    expect(searchResult.items[0].hn).toBe('0000207')
    expect(searchResult.items[0].ptname).toBe('นายสมชาย ใจดี')
  })

  it('handles empty data gracefully', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmDashboardService.getPalliativeCarePc1Report(
      { ds1: '2026-10-01', ds2: '2026-10-31' },
      mockExecutor
    )
    expect(result.items.length).toBe(0)
    expect(result.summary.totalVisits).toBe(0)
    expect(result.summary.totalPatients).toBe(0)
    expect(result.summary.totalCompensated).toBe(0)
  })
})
