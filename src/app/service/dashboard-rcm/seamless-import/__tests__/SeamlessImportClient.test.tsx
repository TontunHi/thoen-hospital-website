import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SeamlessImportClient from '../SeamlessImportClient'
import type {
  SeamlessDatabaseStats,
  SeamlessLedgerResult,
  SeamlessImportedFileDetail,
} from '@/lib/clinical/rcmSeamlessImportService'

const mockStats: SeamlessDatabaseStats = {
  totalRows: 120,
  totalReps: 4,
  totalFiles: 2,
  latestAdmDate: '2026-01-15',
  totalCompensated: 150000,
  otherHospCount: 3,
  missingPayDateCount: 5,
  denyCodeCount: 2,
  myHospCode: '11152',
  topFunds: [{ fund: 'ระบบเบิกจ่ายตรง', rowCount: 120, totalCompensated: 150000 }],
  recentFiles: [
    {
      fileName: '11152_DDSA6901.xlsx',
      rowCount: 100,
      minDate: '2026-01-01',
      maxDate: '2026-01-15',
      totalCompensated: 120000,
    },
  ],
}

const mockLedger: SeamlessLedgerResult = {
  items: [
    {
      id: 'TX-SYNTH-001',
      yymm: '6901',
      yearBudget: '2569',
      fund: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
      period: '6901',
      rep: 'DDSA6901001',
      vn: '6901150001',
      hn: '0000001',
      an: null,
      pid: '9999999999990',
      ptname: 'นาย ทดสอบ สมมติ',
      admDate: '2026-01-15',
      sendDate: '2026-01-16',
      regDate: null,
      mainInscl: 'UCS',
      department: 'OP',
      hcode: '11152',
      hsub: '11152',
      hsend: '11152',
      type: 'บริการฟื้นฟู',
      serialNo: '1',
      payNo: 'PAY-6901',
      payDate: '2026-02-01',
      yymmPay: '6902',
      yearBudgetPay: '2569',
      codeAccount: 'AC01',
      collected: 1200,
      compensated: 1000,
      noCompensated: 200,
      payMore: 0,
      recall: 0,
      status: 'ชดเชย',
      note: null,
      stmid: null,
      equipCode: null,
      equipName: null,
      fileName: '11152_DDSA6901.xlsx',
      isOtherHosp: false,
    },
  ],
  totalCount: 1,
  totalPages: 1,
  page: 1,
  pageSize: 50,
  availableFunds: ['ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ'],
  myHospCode: '11152',
}

const mockFiles: SeamlessImportedFileDetail[] = [
  {
    fileName: '11152_DDSA6901.xlsx',
    rowCount: 100,
    repCount: 2,
    minDate: '2026-01-01',
    maxDate: '2026-01-15',
    totalCollected: 130000,
    totalCompensated: 120000,
    otherHospCount: 3,
    missingPayDateCount: 5,
  },
]

const mockDenyCodes = [{ code: 'E01', name: 'ข้อมูลไม่ครบถ้วน' }]

describe('SeamlessImportClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('view=deny_codes')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ code: 'E01', name: 'ข้อมูลไม่ครบถ้วน' }],
          }),
        } as Response
      }
      if (url.includes('view=files')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockFiles }),
        } as Response
      }
      if (url.includes('view=ledger')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockLedger }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: mockStats }),
      } as Response
    })
  })

  it('renders SSR stats & ledger without redundant initial stats/ledger fetches (Double-Fetch Guard)', () => {
    render(
      <SeamlessImportClient
        initialStats={mockStats}
        initialLedger={mockLedger}
        initialImportedFiles={mockFiles}
        initialDenyCodes={mockDenyCodes}
        initialError={null}
        userRole="admin"
        username="tester"
        canImport={true}
        canManage={true}
      />
    )

    expect(screen.getByText('ระบบนำเข้าข้อมูล Seamless')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('TX-SYNTH-001')).toBeInTheDocument()
    expect(screen.getByText('9999999999990')).toBeInTheDocument()

    // Ensure initial stats & initial ledger were NOT refetched unnecessarily
    const fetchCalls = vi.mocked(global.fetch).mock.calls.map(([u]) => String(u))
    expect(fetchCalls.some((u) => u === '/api/service/dashboard-rcm/seamless-import')).toBe(false)
    expect(fetchCalls.some((u) => u.includes('view=ledger'))).toBe(false)
  })

  it('triggers AbortController-backed ledger fetch when hospFilter changes', async () => {
    render(
      <SeamlessImportClient
        initialStats={mockStats}
        initialLedger={mockLedger}
        initialImportedFiles={mockFiles}
        initialDenyCodes={mockDenyCodes}
        initialError={null}
        userRole="staff"
        username="staff"
        canImport={true}
        canManage={false}
      />
    )

    const hospSelect = screen.getByLabelText('กรองตามหน่วยบริการ')
    fireEvent.change(hospSelect, { target: { value: 'OTHER' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('view=ledger&page=1&pageSize=50&hospFilter=OTHER'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  it('enforces view-only UI when canImport=false', () => {
    render(
      <SeamlessImportClient
        initialStats={mockStats}
        initialLedger={mockLedger}
        initialImportedFiles={mockFiles}
        initialDenyCodes={mockDenyCodes}
        initialError={null}
        userRole="staff"
        username="viewer1"
        canImport={false}
        canManage={false}
      />
    )

    expect(screen.getByText(/มีสิทธิ์ดูข้อมูลเท่านั้น/)).toBeInTheDocument()
    expect(screen.queryByText(/ซิงค์วันที่โอน/)).not.toBeInTheDocument()
    expect(screen.queryByText('ล้างข้อมูลทั้งหมด')).not.toBeInTheDocument()
  })

  it('supports FoxPro sync_payment and delete other_hospitals / delete all confirmation modals', async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { updatedPaymentCount: 5, backfilledDateCount: 10 },
          }),
        } as Response
      }
      if (init?.method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { deletedCount: 3 } }),
        } as Response
      }
      if (url.includes('view=deny_codes')) {
        return { ok: true, json: async () => ({ success: true, data: [] }) } as Response
      }
      if (url.includes('view=files')) {
        return { ok: true, json: async () => ({ success: true, data: mockFiles }) } as Response
      }
      if (url.includes('view=ledger')) {
        return { ok: true, json: async () => ({ success: true, data: mockLedger }) } as Response
      }
      return { ok: true, json: async () => ({ success: true, data: mockStats }) } as Response
    })

    render(
      <SeamlessImportClient
        initialStats={mockStats}
        initialLedger={mockLedger}
        initialImportedFiles={mockFiles}
        initialDenyCodes={mockDenyCodes}
        initialError={null}
        userRole="admin"
        username="admin1"
        canImport={true}
        canManage={true}
      />
    )

    // 1. Sync payment modal
    fireEvent.click(screen.getByRole('button', { name: /ซิงค์วันที่โอน/ }))
    fireEvent.click(screen.getByRole('button', { name: /เริ่มซิงค์วันที่โอนเงิน/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dashboard-rcm/seamless-import',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'sync_payment', force: false }),
        })
      )
    })

    // 2. Delete All requires typing DELETE ALL
    fireEvent.click(screen.getByRole('button', { name: 'ล้างข้อมูลทั้งหมด' }))
    const confirmDeleteBtn = screen.getByRole('button', { name: 'ยืนยันการลบข้อมูล' })
    expect(confirmDeleteBtn).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('DELETE ALL'), {
      target: { value: 'DELETE ALL' },
    })
    expect(confirmDeleteBtn).not.toBeDisabled()
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dashboard-rcm/seamless-import',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ mode: 'all' }),
        })
      )
    })
  })
})
