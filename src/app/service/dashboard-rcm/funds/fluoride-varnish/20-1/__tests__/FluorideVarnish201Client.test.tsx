import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FluorideVarnish201Client from '../FluorideVarnish201Client'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 1050,
  averageCompensated: 150,
  targetAgeCount: 8,
  targetAgeRate: 80.0,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  ucCount: 8,
  ucRate: 80.0,
  totalIncome: 1500,
}

const mockItem = {
  no: 1,
  vn: '691001083001',
  cid: '1529900111221',
  hn: '0012345',
  ptname: 'นาย สมชาย ฟันดี',
  sex: 'ชาย',
  age: 26,
  isTargetAge: true,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH15001',
  maininscl: 'UCS',
  isUc: true,
  pttypename: 'บัตรทอง',
  department: 'กลุ่มงานทันตกรรม',
  clinic: 'ทันตกรรมทั่วไป',
  pdx: 'K021',
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
  income: 150,
  listname: 'เคลือบฟลูออไรด์วานิช 15001',
  listname1: null,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP691001',
  compensated: 150,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'DENTAL',
  subfund: 'PREVENTIVE',
  errorcode: null,
  transactiontype: 'OP',
}

const mockInitialData = {
  adpCode: '15001',
  title: '20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    adpCode: '15001',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3009999', name: 'เคลือบฟลูออไรด์วานิช 15001', strength: null, nhso_adp_code: '15001' }],
  },
  cardFilter: 'ALL' as const,
  ucOnly: false,
  targetAgeOnly: false,
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

describe('FluorideVarnish201Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: mockInitialData,
        }),
    } as any)
  })

  it('renders title and 8 KPI summary cards with initial figures', () => {
    render(<FluorideVarnish201Client initialData={mockInitialData} />)

    expect(
      screen.getByRole('heading', {
        name: '20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)',
      })
    ).toBeInTheDocument()

    // 8 KPI cards check
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getAllByText('ชดเชยแล้ว').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ยังไม่ชดเชย / รอชดเชย')).toBeInTheDocument()
    expect(screen.getByText('ยอดเงินชดเชยรวม')).toBeInTheDocument()
    expect(screen.getByText('กลุ่มเป้าหมาย (25-59 ปี)')).toBeInTheDocument()
    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeInTheDocument()
    expect(screen.getByText('มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี ClaimCode')).toBeInTheDocument()

    // Table rows check
    expect(screen.getByText('นาย สมชาย')).toBeInTheDocument()
    expect(screen.getByText('ฟันดี')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900111221')).toBeInTheDocument()
    expect(screen.getByText('เคลือบฟลูออไรด์วานิช 15001')).toBeInTheDocument()
  })

  it('clicking a KPI card toggles cardFilter', async () => {
    render(<FluorideVarnish201Client initialData={mockInitialData} />)

    const targetAgeCard = screen.getByTitle('คลิกเพื่อกรองเฉพาะกลุ่มเป้าหมายอายุ 25-59 ปี')
    fireEvent.click(targetAgeCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=TARGET_AGE'),
        expect.any(Object)
      )
    })
  })

  it('searches by keyword with debounce', async () => {
    render(<FluorideVarnish201Client initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(/ค้นหาด้วย HN, CID, ชื่อผู้ป่วย/)
    fireEvent.change(searchInput, { target: { value: '0012345' } })

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=0012345'),
          expect.any(Object)
        )
      },
      { timeout: 1000 }
    )
  })

  it('opens detail modal on clicking a table row directly without separate view button', async () => {
    render(<FluorideVarnish201Client initialData={mockInitialData} />)

    // Ensure there is NO "ดูข้อมูล" button in table columns
    expect(screen.queryByRole('button', { name: /ดูข้อมูล/ })).not.toBeInTheDocument()

    // Click row directly
    const row = screen.getByTitle('คลิกเพื่อดูรายละเอียดเวชระเบียน')
    fireEvent.click(row)

    // Modal dialog appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลการรับบริการและการชดเชย')).toBeInTheDocument()
      expect(screen.getByText('เลขบัตรประชาชน (CID)')).toBeInTheDocument()
      expect(screen.getByText('รายการเคลือบฟลูออไรด์ (ADP 15001)')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByTitle('ปิดหน้าต่าง')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('switches date mode to monthly and fiscal year', async () => {
    render(<FluorideVarnish201Client initialData={mockInitialData} />)

    const monthlyTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthlyTab)
    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByLabelText('เลือกปีงบประมาณ')).toBeInTheDocument()
  })

  it('displays warning banner when ADP 15001 is unmapped', () => {
    const unmappedData = {
      ...mockInitialData,
      adpMapping: {
        adpCode: '15001',
        isMapped: false,
        mappedCount: 0,
        items: [],
      },
    }

    render(<FluorideVarnish201Client initialData={unmappedData} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/ยังไม่ได้ Map รหัส ADP 15001/)).toBeInTheDocument()
  })

  it('renders age on a single line and centers the compensated column and data cell', () => {
    const { container } = render(<FluorideVarnish201Client initialData={mockInitialData} />)

    // Age cell checks
    const ageCell = screen.getByText(/26\s*ปี/)
    expect(ageCell).toBeInTheDocument()
    expect(ageCell).toHaveClass('col-center')
    expect(ageCell).toHaveStyle({ whiteSpace: 'nowrap' })

    // Compensated header check
    const compensatedHeaderBtn = screen.getByRole('button', { name: /ชดเชย \(บาท\)/ })
    const compensatedTh = compensatedHeaderBtn.closest('th')
    expect(compensatedTh).toHaveClass('col-center')

    // Compensated data cell check
    const compCell = container.querySelector('td.fluoride-num.font-semibold')
    expect(compCell).toBeInTheDocument()
    expect(compCell).toHaveClass('col-center')

    // Patient name check (single-line priority, clean surname wrap structure)
    const ptWrap = container.querySelector('.fluoride-ptname-wrap')
    expect(ptWrap).toBeInTheDocument()
    expect(container.querySelector('.fluoride-ptname-first')).toHaveTextContent('นาย สมชาย')
    expect(container.querySelector('.fluoride-ptname-last')).toHaveTextContent('ฟันดี')
  })
})

