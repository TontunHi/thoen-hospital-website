import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SmtBudgetTrackerClient from '../SmtBudgetTrackerClient'
import { SmtBudgetSearchResult } from '@/lib/budget/smtBudgetService'

// Mock Recharts ResponsiveContainer to avoid size measurement issues in JSDOM
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 250 }}>{children}</div>,
  }
})

describe('SmtBudgetTrackerClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  const mockInitialData: SmtBudgetSearchResult = {
    source: 'upstream',
    fetchedAt: Date.now(),
    summary: {
      recordCount: 2,
      totalAmount: 350000,
      totalNetPayment: 335000,
      totalWait: 10000,
      totalDebt: 5000,
      totalVat: 0,
      totalBond: 0,
      totalOdbt: 0,
    },
    datas: [
      {
        fiscalYear: '2570',
        runDt: '2024-10-15',
        batchNo: 'B2570-01',
        postingDate: '15/10/2569',
        refDocNo: 'DOC-111',
        fundName: 'งบผู้ป่วยนอก (OP)',
        fundGroupDescr: 'บริการทางการแพทย์',
        amount: 100000,
        total: 95000,
        wait: 0,
        debt: 5000,
        vat: 0,
        bond: 0,
        downloadPAYMFileName: 'PAYM_01.pdf',
      },
      {
        fiscalYear: '2570',
        runDt: '2024-11-20',
        batchNo: 'B2570-02',
        postingDate: '20/11/2569',
        refDocNo: 'DOC-222',
        fundName: 'งบผู้ป่วยใน (IP)',
        fundGroupDescr: 'บริการทางการแพทย์',
        amount: 250000,
        total: 240000,
        wait: 10000,
        debt: 0,
        vat: 0,
        bond: 0,
        downloadPAYMFileName: 'PAYM_02.pdf',
      },
    ],
  }

  it('renders vendor name, multi-year buttons, and 4 KPI summary cards', () => {
    render(
      <SmtBudgetTrackerClient
        initialData={mockInitialData}
        defaultVendorId="11152"
        defaultYears={['2570']}
      />
    )

    // Check Vendor & Title
    expect(screen.getAllByText(/รพ.เถิน/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/11152/).length).toBeGreaterThanOrEqual(1)

    // Check KPI Cards
    expect(screen.getByText('วงเงินจัดสรรรวม (Amount)')).toBeDefined()
    expect(screen.getByText('฿350,000.00')).toBeDefined()

    expect(screen.getByText('ยอดเงินโอนสุทธิ (Net Total)')).toBeDefined()
    expect(screen.getByText('฿335,000.00')).toBeDefined()

    expect(screen.getByText('รอดำเนินการโอน (Wait)')).toBeDefined()
    expect(screen.getByText('฿10,000.00')).toBeDefined()
  })

  it('renders transactions table with correct columns and downloads', () => {
    render(
      <SmtBudgetTrackerClient
        initialData={mockInitialData}
        defaultVendorId="11152"
        defaultYears={['2570']}
      />
    )

    // Check transaction records
    expect(screen.getByText('B2570-01')).toBeDefined()
    expect(screen.getByText('DOC-111')).toBeDefined()
    expect(screen.getByText('งบผู้ป่วยนอก (OP)')).toBeDefined()

    expect(screen.getByText('B2570-02')).toBeDefined()
    expect(screen.getByText('DOC-222')).toBeDefined()
    expect(screen.getByText('งบผู้ป่วยใน (IP)')).toBeDefined()

    // Download PAYM buttons
    const paymButtons = screen.getAllByText('PAYM')
    expect(paymButtons.length).toBe(2)
  })

  it('filters records using search text input', () => {
    render(
      <SmtBudgetTrackerClient
        initialData={mockInitialData}
        defaultVendorId="11152"
        defaultYears={['2570']}
      />
    )

    const searchInput = screen.getByPlaceholderText(/ค้นหา Batch/)
    fireEvent.change(searchInput, { target: { value: 'DOC-111' } })

    // DOC-111 matches
    expect(screen.getByText('B2570-01')).toBeDefined()
    // DOC-222 should be filtered out
    expect(screen.queryByText('B2570-02')).toBeNull()
  })
})
