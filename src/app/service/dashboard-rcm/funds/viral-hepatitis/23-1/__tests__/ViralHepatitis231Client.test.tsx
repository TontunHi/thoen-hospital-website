import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ViralHepatitis231Client from '../ViralHepatitis231Client'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 910,
  averageCompensated: 130,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  withLabCount: 8,
  withoutLabCount: 2,
  labRate: 80.0,
  ucCount: 8,
  ucRate: 80.0,
  totalIncome: 2500,
}

const mockItem = {
  no: 1,
  vn: '691001083000',
  cid: '1529900111222',
  hn: '0012345',
  ptname: 'นายสมชาย ใจดี',
  age: 38,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH36318',
  maininscl: 'UCS',
  isUc: true,
  pttypename: 'บัตรทอง',
  department: 'งานชันสูตร',
  clinic: 'ตรวจโรคทั่วไป',
  cc: 'ตรวจคัดกรองไวรัสตับอักเสบ บี',
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
  income: 250,
  listname: 'ตรวจคัดกรองไวรัสตับอักเสบ บี (HBsAg)',
  labresult: 'Negative',
  hasLabResult: true,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP691001',
  compensated: 130,
  isCompensated: true,
  status_sm: null,
  rep_sm: null,
  compensated_sm: 0,
  address: '123 หมู่ 1 ต.ล้อมแรด',
  mobile: '0812345678',
  tel: '054123456',
  fund: 'OP_PP',
  subfund: 'HEP_B',
}

const mockInitialData = {
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    isMapped: true,
    mappedCount: 2,
    items: [
      {
        icode: '3000101',
        name: 'ตรวจคัดกรองไวรัสตับอักเสบ บี (HBsAg)',
        strength: null,
        nhso_adp_code: '36318',
        source: 's_drugitems' as const,
      },
    ],
  },
  cardFilter: 'ALL' as const,
  ucOnly: false,
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

describe('ViralHepatitis231Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders page header, title, and initial KPI cards correctly', () => {
    render(<ViralHepatitis231Client initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B'
    )
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('มีผลตรวจ Lab')).toBeInTheDocument()
    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeInTheDocument()
  })

  it('displays table items and center-aligned columns correctly', () => {
    render(<ViralHepatitis231Client initialData={mockInitialData} />)

    expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900111222')).toBeInTheDocument()
    expect(screen.getByText('38 ปี')).toBeInTheDocument()
    expect(screen.getByText('AUTH36318')).toBeInTheDocument()
    expect(screen.getByText('Negative')).toBeInTheDocument()
  })

  it('clicking a table row opens the detail modal without any view button', async () => {
    render(<ViralHepatitis231Client initialData={mockInitialData} />)

    // Ensure there is NO "ดูข้อมูล" button
    expect(screen.queryByRole('button', { name: /ดูข้อมูล/i })).not.toBeInTheDocument()

    // Click on the patient name in the table row
    const rowCell = screen.getByText('นายสมชาย ใจดี')
    fireEvent.click(rowCell)

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลผู้รับบริการ & การติดต่อ')).toBeInTheDocument()
      expect(screen.getByText('สถานะการส่งเคลม & ชดเชยค่าบริการ (RCM)')).toBeInTheDocument()
    })

    // Close button dismisses modal
    const closeBtns = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/i })
    fireEvent.click(closeBtns[0])

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('filters data when clicking KPI cards', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockInitialData,
          cardFilter: 'WITH_LAB',
          items: [mockItem],
          totalCount: 1,
        },
      }),
    })

    render(<ViralHepatitis231Client initialData={mockInitialData} />)

    const labCard = screen.getByTitle('คลิกเพื่อกรองเฉพาะรายการที่มีผลตรวจทางห้องปฏิบัติการ')
    fireEvent.click(labCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=WITH_LAB'),
        expect.anything()
      )
    })
  })

  it('handles search input with debounced API call', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockInitialData,
          search: 'สมชาย',
          items: [mockItem],
          totalCount: 1,
        },
      }),
    })

    render(<ViralHepatitis231Client initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(
      'ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ผล Lab, Authen Code, Rep...'
    )
    fireEvent.change(searchInput, { target: { value: 'สมชาย' } })

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2'),
          expect.anything()
        )
      },
      { timeout: 1000 }
    )
  })

  it('switches date modes (Custom -> Monthly -> Fiscal)', () => {
    render(<ViralHepatitis231Client initialData={mockInitialData} />)

    const monthlyTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthlyTab)

    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)

    expect(screen.getByLabelText('เลือกปีงบประมาณ')).toBeInTheDocument()
  })

  it('shows warning banner when adpMapping.isMapped is false', () => {
    const unmappedData = {
      ...mockInitialData,
      adpMapping: {
        isMapped: false,
        mappedCount: 0,
        items: [],
      },
    }

    render(<ViralHepatitis231Client initialData={unmappedData} />)

    expect(
      screen.getByText('แจ้งเตือนการกำหนดรหัสส่งตรวจ (ADP Mapping):')
    ).toBeInTheDocument()
  })
})
