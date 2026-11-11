import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HepatitisC232Client from '../HepatitisC232Client'

const mockSummary = {
  totalVisits: 2,
  uniquePatients: 2,
  compensatedVisits: 1,
  uncompensatedVisits: 1,
  compensationRate: 50.0,
  totalCompensated: 250,
  averageCompensated: 250,
  withAuthenCount: 1,
  withoutAuthenCount: 1,
  authenRate: 50.0,
  ucCount: 1,
  ucRate: 50.0,
  withLabCount: 1,
  withLabRate: 50.0,
  seamlessCount: 1,
  seamlessCompensatedCount: 1,
  totalSeamlessCompensated: 250,
  totalIncome: 600,
}

const mockItem = {
  no: 1,
  vn: '691001083001',
  cid: '1529900111221',
  hn: '0000001',
  ptname: 'นาย สมชาย สุขภาพดี',
  sex: 'ชาย',
  age: 45,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH12345',
  maininscl: 'UCS',
  isUc: true,
  pttypename: 'บัตรทอง',
  cc: 'มาตรวจสุขภาพประจำปี',
  department: 'ผู้ป่วยนอกทั่วไป',
  clinic: 'เวชปฏิบัติทั่วไป',
  pdx: 'Z115',
  dx0: null,
  dx1: null,
  dx2: null,
  dx3: null,
  dx4: null,
  dx5: null,
  sdx: null,
  op0: null,
  op1: null,
  op2: null,
  op3: null,
  op4: null,
  op5: null,
  ops: null,
  labresult: 'Negative',
  hasLab: true,
  income: 300,
  listname: 'ตรวจคัดกรองไวรัสตับอักเสบ C (36331)',
  listname1: null,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP6910001',
  compensated: 250,
  isCompensated: true,
  address: '123 หมู่ 1 อ.เถิน จ.ลำปาง',
  mobile: '0812345678',
  tel: '054123456',
  status_sm: 'ชดเชยแล้ว',
  rep_sm: 'SM6910001',
  compensated_sm: 250,
  isSeamlessCompensated: true,
  agency: 'NHSO',
  fund: 'OPD_P&P',
  subfund: 'HEPATITIS_C',
  errorcode: null,
  transactiontype: 'OP',
}

const mockInitialData = {
  adpCode: '36331' as const,
  title: '23.2 บริการตรวจคัดกรองไวรัสตับอักเสบ C',
  categoryTitle: 'บริการตรวจคัดกรองไวรัสตับอักเสบ C',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    adpCode: '36331',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3003633', name: 'ตรวจคัดกรองไวรัสตับอักเสบ C', strength: null, nhso_adp_code: '36331' }],
  },
  cardFilter: 'ALL' as const,
  ucOnly: false,
  withLabOnly: false,
  searchField: 'ALL' as const,
  search: '',
  sortBy: 'vstdate' as const,
  sortOrder: 'desc' as const,
  summary: mockSummary,
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [mockItem],
}

describe('HepatitisC232Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders initial report data without loading skeleton', () => {
    render(<HepatitisC232Client initialData={mockInitialData} />)

    expect(screen.getByText('23.2 บริการตรวจคัดกรองไวรัสตับอักเสบ C')).toBeInTheDocument()
    expect(screen.getByText('นาย สมชาย สุขภาพดี')).toBeInTheDocument()
    expect(screen.getByText('1529900111221')).toBeInTheDocument()
    expect(screen.getByText('Negative')).toBeInTheDocument()
    expect(screen.getByText('AUTH12345')).toBeInTheDocument()
  })

  it('filters by clicking on a KPI card', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...mockInitialData,
          cardFilter: 'WITH_LAB',
          items: [mockItem],
        },
      }),
    } as any)

    render(<HepatitisC232Client initialData={mockInitialData} />)

    const withLabCard = screen.getByText('มีผลตรวจ Lab')
    fireEvent.click(withLabCard)

    await waitFor(() => {
      expect(screen.getByText('WITH_LAB')).toBeInTheDocument()
    })
  })

  it('switches date mode to monthly and fiscal year', async () => {
    render(<HepatitisC232Client initialData={mockInitialData} />)

    const monthModeBtn = screen.getByText('รายเดือน')
    await waitFor(() => {
      fireEvent.click(monthModeBtn)
    })
    expect(monthModeBtn).toHaveClass('active')

    const fiscalModeBtn = screen.getByText('ปีงบประมาณ')
    await waitFor(() => {
      fireEvent.click(fiscalModeBtn)
    })
    expect(fiscalModeBtn).toHaveClass('active')
  })

  it('opens detail modal when clicking a table row', async () => {
    render(<HepatitisC232Client initialData={mockInitialData} />)

    const row = screen.getByText('นาย สมชาย สุขภาพดี').closest('tr')
    expect(row).toBeInTheDocument()
    if (row) fireEvent.click(row)

    expect(screen.getByText('ข้อมูลทั่วไปผู้ป่วย')).toBeInTheDocument()
    expect(screen.getByText('ข้อมูลการตรวจ & ผล Lab ไวรัสตับอักเสบ C')).toBeInTheDocument()
    expect(screen.getByText('มาตรวจสุขภาพประจำปี')).toBeInTheDocument()
    expect(screen.getByText('123 หมู่ 1 อ.เถิน จ.ลำปาง')).toBeInTheDocument()
  })

  it('handles search input', async () => {
    render(<HepatitisC232Client initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(
      'ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ClaimCode, Rep, ผล Lab...'
    )
    fireEvent.change(searchInput, { target: { value: 'สมชาย' } })
    expect(searchInput).toHaveValue('สมชาย')
  })
})
