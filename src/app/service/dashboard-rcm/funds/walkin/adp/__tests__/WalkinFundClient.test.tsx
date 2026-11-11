import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import WalkinFundClient from '../WalkinFundClient'
import type {
  WalkinFundItem,
  WalkinFundSummary,
  WalkinFundReportResult,
} from '@/lib/clinical/rcmWalkinFundService'

const mockSummary: WalkinFundSummary = {
  totalVisits: 2,
  uniquePatients: 2,
  compensatedVisits: 1,
  uncompensatedVisits: 1,
  compensationRate: 50,
  totalCompensated: 450,
  invoiceVisits: 1,
  totalInvoiceCompensated: 450,
  unsentVisits: 1,
  withAuthenCount: 1,
  withoutAuthenCount: 1,
  authenRate: 50,
  ucCount: 2,
  ucRate: 100,
  totalIncome: 1200,
}

const mockItems: WalkinFundItem[] = [
  {
    no: 1,
    vn: '691001111111',
    an: null,
    hn: '0011111',
    cid: '1529900011111',
    ptname: 'นาย สมชาย ใจดี',
    sex: 'ชาย',
    age: 45,
    nation: 'ไทย',
    vstdate: '2026-10-15',
    vsttime: '08:30:00',
    authencode: 'AUTH001',
    maininscl: 'UCS',
    isUc: true,
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
    income: 700,
    listname: 'บริการ Walkin ผู้ป่วยนอก',
    status: 'Rep :: มี Rep แล้ว',
    rep: 'REP12345',
    compensated: 450,
    isCompensated: true,
    transactiontype: 'OP',
    invoice: 'INV001',
    invoice_compensated: 450,
    resource: 'สปสช.',
    subfund: 'WALKIN',
    remark: null,
    projectcode: 'WK01',
  },
  {
    no: 2,
    vn: '691002222222',
    an: null,
    hn: '0022222',
    cid: '1529900022222',
    ptname: 'นาง สมศรี มีสุข',
    sex: 'หญิง',
    age: 52,
    nation: 'ไทย',
    vstdate: '2026-10-20',
    vsttime: '09:15:00',
    authencode: null,
    maininscl: 'UCS',
    isUc: true,
    pttypename: 'บัตรทอง',
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
    income: 500,
    listname: 'บริการ Walkin ผู้ป่วยนอก',
    status: null,
    rep: null,
    compensated: 0,
    isCompensated: false,
    transactiontype: null,
    invoice: null,
    invoice_compensated: 0,
    resource: null,
    subfund: null,
    remark: null,
    projectcode: null,
  },
]

const mockInitialData: WalkinFundReportResult = {
  title: 'กองทุน Walkin: รายชื่อผู้รับบริการจาก ADP (WALKIN)',
  adpCode: 'WALKIN',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  cardFilter: 'ALL',
  ucOnly: false,
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
  totalCount: 2,
  totalPages: 1,
  items: mockItems,
  summary: mockSummary,
  adpMapping: {
    adpCode: 'WALKIN',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '1000001', name: 'บริการ Walkin', strength: null, nhso_adp_code: 'WALKIN' }],
  },
}

describe('WalkinFundClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockInitialData,
      }),
    })
  })

  it('renders initial report title, subtitle, and records with zero waterfall', () => {
    render(<WalkinFundClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { name: 'กองทุน Walkin' })).toBeInTheDocument()
    expect(screen.getByText('รายชื่อผู้รับบริการจาก ADP (WALKIN)')).toBeInTheDocument()
    expect(screen.getByText('นาย สมชาย ใจดี')).toBeInTheDocument()
    expect(screen.getByText('นาง สมศรี มีสุข')).toBeInTheDocument()

    // Mount Guard: Should not call fetch on first render if initialData was supplied
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does NOT display date range inside parentheses in toolbar', () => {
    render(<WalkinFundClient initialData={mockInitialData} />)

    // Ensure no redundant parentheses "(...)" in date selection text
    const dateText = screen.queryByText(/\(.*\d{4}.*\)/)
    expect(dateText).toBeNull()
  })

  it('filters data when clicking on a summary KPI card', async () => {
    render(<WalkinFundClient initialData={mockInitialData} />)

    // Click "มี ClaimCode" card
    const authenCard = screen.getByText('มี ClaimCode').closest('.walkin-card')
    expect(authenCard).toBeInTheDocument()
    if (authenCard) {
      fireEvent.click(authenCard)
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=WITH_AUTHEN'),
        expect.anything()
      )
    })
  })

  it('opens detail modal when clicking a record row (no "ดูข้อมูล" button)', async () => {
    render(<WalkinFundClient initialData={mockInitialData} />)

    // Verify there is NO "ดูข้อมูล" button in the table
    expect(screen.queryByRole('button', { name: /ดูข้อมูล/ })).toBeNull()

    // Click row with patient name
    const patientRow = screen.getByText('นาย สมชาย ใจดี').closest('tr')
    expect(patientRow).toBeInTheDocument()
    if (patientRow) {
      fireEvent.click(patientRow)
    }

    // Modal should be visible with detailed sections
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลการรับบริการ (Visit)')).toBeInTheDocument()
      expect(screen.getByText('การวินิจฉัยและหัตถการ')).toBeInTheDocument()
    })
  })

  it('switches date mode between custom, monthly, and fiscal year', async () => {
    render(<WalkinFundClient initialData={mockInitialData} />)

    // Switch to monthly mode
    const monthTab = screen.getByRole('tab', { name: 'รายเดือน' })
    fireEvent.click(monthTab)

    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()
    expect(screen.getByLabelText('เลือกปี พ.ศ.')).toBeInTheDocument()

    // Switch to custom mode
    const customTab = screen.getByRole('tab', { name: 'กำหนดเอง' })
    fireEvent.click(customTab)

    expect(screen.getByLabelText('วันที่เริ่มต้น')).toBeInTheDocument()
    expect(screen.getByLabelText('วันที่สิ้นสุด')).toBeInTheDocument()
  })
})
