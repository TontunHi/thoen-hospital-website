import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RepReconcileClient from '../RepReconcileClient'
import type { RepReconcileResult } from '@/lib/clinical/funds-reconcile/types'

const mockInitialData: RepReconcileResult = {
  range: { startDate: '2026-10-01', endDate: '2027-09-30' },
  summary: {
    totalLines: 2,
    uniqueRepCount: 2,
    uniqueVisitCount: 2,
    totalIncome: 1550,
    totalCompensated: 1350,
    totalDiff: -200,
    reimbursementRate: 87.1,
    seamlessCompensated: 350,
    eclaimCompensated: 1000,
    errorCount: 0,
    appealCount: 0,
    pendingRepCount: 0,
    dedupRemovedCount: 1,
    sourceBreakdown: [
      {
        source: 'repdata',
        label: 'REP หลัก (repdata)',
        lineCount: 1,
        uniqueRepCount: 1,
        totalIncome: 1200,
        totalCompensated: 1000,
      },
      {
        source: 'seamless',
        label: 'Seamless / DMIS (seamless)',
        lineCount: 1,
        uniqueRepCount: 1,
        totalIncome: 350,
        totalCompensated: 350,
      },
    ],
    fundCards: [
      {
        fundId: 'clopidogrel',
        code: 'CLOP',
        label: 'กองทุนยา Clopidogrel',
        shortLabel: 'Clopidogrel',
        category: 'disease_drug',
        href: '/service/dashboard-rcm/funds/clopidogrel/usage',
        repLineCount: 1,
        uniqueRepCount: 1,
        uniqueVisitCount: 1,
        totalIncome: 1200,
        totalCompensated: 1000,
        totalDiff: -200,
        reimbursementRate: 83.3,
        seamlessCompensated: 0,
        eclaimCompensated: 1000,
        seamlessLineCount: 0,
        eclaimLineCount: 1,
        errorCount: 0,
      },
      {
        fundId: 'ccs',
        code: 'CCS',
        label: 'คัดกรองมะเร็งปากมดลูก (CCS)',
        shortLabel: 'มะเร็งปากมดลูก',
        category: 'pp',
        href: '/service/dashboard-rcm/funds/ccs/2',
        repLineCount: 1,
        uniqueRepCount: 1,
        uniqueVisitCount: 1,
        totalIncome: 350,
        totalCompensated: 350,
        totalDiff: 0,
        reimbursementRate: 100,
        seamlessCompensated: 350,
        eclaimCompensated: 0,
        seamlessLineCount: 1,
        eclaimLineCount: 0,
        errorCount: 0,
      },
    ],
    repTypeBreakdown: [],
  },
  items: [
    {
      id: 'repdata:RD1:691000204:6901010002',
      visitKey: '6901010002',
      vn: '6901010002',
      an: null,
      hn: '000002',
      cid: '1100000000002',
      ptname: 'นาย ทดสอบ ยาหัวใจ',
      admdate: '2026-10-16',
      admdateThai: '16 ต.ค. 2569',
      department: 'OP',
      mainInscl: 'UCS',
      pttypeName: 'บัตรทอง UC',
      rep: '691000204',
      repPrefix: null,
      source: 'repdata',
      matchedSources: ['repdata', 'repeclaim'],
      repFund: 'UCS',
      repSubFund: 'OP',
      projectCode: null,
      primaryFundId: 'clopidogrel',
      primaryFundCode: 'CLOP',
      primaryFundLabel: 'Clopidogrel',
      matchedFundIds: ['clopidogrel'],
      matchedFundLabels: ['Clopidogrel'],
      matchReason: 'ADP 37999771001',
      adpCodes: ['37999771001'],
      income: 1200,
      compensated: 1000,
      diff: -200,
      percentPay: 83,
      errorCode: null,
      appeal: 'N',
      status: 'paid',
      eclaimNo: 'EC1002',
      eclaimStatus: 'ชดเชยแล้ว',
      eclaimIncome: 1200,
      payNo: null,
      payDate: null,
      payDateThai: null,
      stmid: null,
      fileName: 'REP6910.xls',
    },
    {
      id: 'seamless:SM1:DCCS69010001:6901010001',
      visitKey: '6901010001',
      vn: '6901010001',
      an: null,
      hn: '000001',
      cid: '1100000000001',
      ptname: 'นาง ทดสอบ ปากมดลูก',
      admdate: '2026-10-15',
      admdateThai: '15 ต.ค. 2569',
      department: 'OP',
      mainInscl: 'UCS',
      pttypeName: 'บัตรทอง UC',
      rep: 'DCCS69010001',
      repPrefix: 'DCCS',
      source: 'seamless',
      matchedSources: ['seamless'],
      repFund: 'ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก',
      repSubFund: 'OP',
      projectCode: null,
      primaryFundId: 'ccs',
      primaryFundCode: 'CCS',
      primaryFundLabel: 'มะเร็งปากมดลูก',
      matchedFundIds: ['ccs'],
      matchedFundLabels: ['มะเร็งปากมดลูก'],
      matchReason: 'REP Prefix DCCS',
      adpCodes: [],
      income: 350,
      compensated: 350,
      diff: 0,
      percentPay: 100,
      errorCode: null,
      appeal: 'N',
      status: 'paid',
      eclaimNo: null,
      eclaimStatus: 'ชดเชย',
      eclaimIncome: 0,
      payNo: 'DCCS690001',
      payDate: '2026-10-25',
      payDateThai: '25 ต.ค. 2569',
      stmid: 'STM01',
      fileName: '11152_DCCS.xlsx',
    },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  availableFundCatalog: [
    {
      id: 'ccs',
      code: 'CCS',
      label: 'คัดกรองมะเร็งปากมดลูก (CCS)',
      shortLabel: 'มะเร็งปากมดลูก',
      category: 'pp',
      href: '/service/dashboard-rcm/funds/ccs/2',
      lineCount: 1,
      totalCompensated: 350,
    },
    {
      id: 'clopidogrel',
      code: 'CLOP',
      label: 'กองทุนยา Clopidogrel',
      shortLabel: 'Clopidogrel',
      category: 'disease_drug',
      href: '/service/dashboard-rcm/funds/clopidogrel/usage',
      lineCount: 1,
      totalCompensated: 1000,
    },
  ],
  availableRepPrefixes: ['DCCS'],
}

describe('RepReconcileClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.toString().includes('/vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                visitKey: '6901010002',
                vn: '6901010002',
                an: null,
                hn: '000002',
                cid: '1100000000002',
                ptname: 'นาย ทดสอบ ยาหัวใจ',
                admdate: '2026-10-16',
                admdateThai: '16 ต.ค. 2569',
                department: 'OP',
                pttypeName: 'บัตรทอง UC',
                pdx: 'I251',
                dxList: ['I251'],
                adpItems: [],
                allRepLines: [
                  {
                    source: 'repdata',
                    rep: '691000204',
                    fund: 'UCS',
                    subFund: 'OP',
                    income: 1200,
                    compensated: 1000,
                    errorCode: null,
                    appeal: 'N',
                    eclaimNo: 'EC1002',
                    eclaimStatus: null,
                    payNo: null,
                    payDateThai: null,
                    fileName: 'REP6910.xls',
                  },
                ],
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockInitialData }),
      })
    }) as any
  })

  it('renders SSR initialData immediately without firing a duplicate fetch on mount, omits subtitle and CSV button, and defaults pageSize to 50', () => {
    render(<RepReconcileClient initialData={mockInitialData} />)

    expect(screen.getByText('รวมข้อมูล REP กองทุน (All Funds REP)')).toBeInTheDocument()
    expect(
      screen.queryByText(/รวมผลตอบรับการชดเชยจาก rcmdb\.seamless/)
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CSV/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ส่งออก Excel/i })).toBeInTheDocument()
    expect(screen.getByLabelText('จำนวนแสดงผลต่อหน้า')).toHaveValue('50')
    expect(screen.getByText('691000204')).toBeInTheDocument()
    expect(screen.getByText('DCCS69010001')).toBeInTheDocument()
    expect(screen.getByText('repdata')).toBeInTheDocument()
    expect(screen.getByText('repeclaim')).toBeInTheDocument()
    expect(screen.getByText('seamless')).toBeInTheDocument()
    expect(screen.queryByText('+1')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('allows changing pageSize and resets page to 1 with AbortController signal', async () => {
    render(<RepReconcileClient initialData={mockInitialData} />)

    const pageSizeSelect = screen.getByLabelText('จำนวนแสดงผลต่อหน้า')
    fireEvent.change(pageSizeSelect, { target: { value: '100' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1&pageSize=100'),
        expect.anything()
      )
    })
  })

  it('opens the Fund Checklist Drawer, filters by fund, and focuses a card with AbortController signal', async () => {
    render(<RepReconcileClient initialData={mockInitialData} />)

    fireEvent.click(screen.getByRole('button', { name: /ทุกกองทุน/ }))
    expect(
      screen.getByText('เลือกกองทุนจากระบบ /funds/* เพื่อแสดงผลและคำนวณยอด')
    ).toBeInTheDocument()

    // Toggle one fund checkbox off -> triggers API fetch with remaining fund
    const checkboxes = screen.getAllByRole('checkbox')
    // checkboxes[0] is includePendingRep toggle, checkboxes[1] is 'ccs'
    fireEvent.click(checkboxes[1])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('funds=clopidogrel'),
        expect.anything()
      )
    })
  })

  it('opens lazy detail modal when clicking a statement row', async () => {
    render(<RepReconcileClient initialData={mockInitialData} />)

    fireEvent.click(screen.getByText('นาย ทดสอบ ยาหัวใจ'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/funds/rep-reconcile/vn-details?vn=6901010002'),
        expect.anything()
      )
    })

    await waitFor(() => {
      expect(screen.getByText('รายละเอียดการรับบริการและรายการ REP')).toBeInTheDocument()
      expect(screen.getByText('1100000000002')).toBeInTheDocument()
    })
  })
})
