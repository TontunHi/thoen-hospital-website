import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import IronSupplements182Client from '../IronSupplements182Client'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 350,
  averageCompensated: 50,
  targetAgeCount: 10,
  targetAgeRate: 100.0,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  ucCount: 8,
  ucRate: 80.0,
  withAdpCount: 6,
  withAdpRate: 60.0,
  withDrugCount: 8,
  withDrugRate: 80.0,
  totalIncome: 500,
}

const mockItem = {
  no: 1,
  vn: '691001083000',
  cid: '1529900111222',
  hn: '0012345',
  ptname: 'น.ส. สมหญิง สดใส',
  birthday: '2000-05-15',
  sex: 'หญิง',
  age: 26,
  isTargetAge: true,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH14001',
  maininscl: 'UCS',
  isUc: true,
  pttypename: 'บัตรทอง',
  department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
  clinic: 'ตรวจโรคทั่วไป',
  pdx: 'Z768',
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
  income: 50,
  drugname: 'Ferrous Fumarate 200 mg',
  listname: 'ยาเม็ดเสริมธาตุเหล็ก 14001',
  hasDrug: true,
  hasAdp: true,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP691001',
  compensated: 50,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'OP_PP',
  subfund: 'IRON',
  errorcode: null,
  transactiontype: 'OP',
}

const mockInitialData = {
  adpCode: '14001' as const,
  title: '18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)',
  categoryTitle: 'บริการยาเม็ดเสริมธาตุเหล็ก อายุ 13-45 ปี ADP + Drug',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    adpCode: '14001',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '1540012', name: 'Ferrous Fumarate 200 mg', strength: '200 mg', nhso_adp_code: '14001' }],
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

describe('IronSupplements182Client Component', () => {
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
    render(<IronSupplements182Client initialData={mockInitialData} />)

    expect(
      screen.getByRole('heading', {
        name: '18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)',
      })
    ).toBeInTheDocument()

    // 8 KPI cards check
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('รอชดเชย / ยังไม่ชดเชย')).toBeInTheDocument()
    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeInTheDocument()
    expect(screen.getByText('มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('มีรหัส ADP 14001')).toBeInTheDocument()
    expect(screen.getByText('จ่ายยาธาตุเหล็ก (DID)')).toBeInTheDocument()

    // Table rows check
    expect(screen.getByText('น.ส. สมหญิง สดใส')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900111222')).toBeInTheDocument()
    expect(screen.getByText('Ferrous Fumarate 200 mg')).toBeInTheDocument()
  })

  it('clicking a KPI card toggles cardFilter', async () => {
    render(<IronSupplements182Client initialData={mockInitialData} />)

    const compensatedCard = screen.getByTitle('คลิกเพื่อกรองเฉพาะรายการที่ได้รับเงินชดเชยแล้ว')
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED'),
        expect.any(Object)
      )
    })
  })

  it('searches by keyword with debounce', async () => {
    render(<IronSupplements182Client initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(/ค้นหา HN, CID, ชื่อ-สกุล/)
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
    render(<IronSupplements182Client initialData={mockInitialData} />)

    // Ensure there is NO "ดูข้อมูล" button in table columns
    expect(screen.queryByRole('button', { name: /ดูข้อมูล/ })).not.toBeInTheDocument()

    // Click row directly
    const row = screen.getByTitle('คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย')
    fireEvent.click(row)

    // Modal dialog appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลบริการ & การชดเชย')).toBeInTheDocument()
      expect(screen.getByText('เลขประจำตัวประชาชน (CID)')).toBeInTheDocument()
      expect(screen.getByText('ชื่อยาเสริมธาตุเหล็กตาม DID ที่จ่ายใน Visit นี้')).toBeInTheDocument()
      expect(screen.getByText('รายการ ADP 14001 (บริการยาเม็ดเสริมธาตุเหล็ก)')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByLabelText('ปิดหน้าต่าง')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('switches date mode to monthly and fiscal year', async () => {
    render(<IronSupplements182Client initialData={mockInitialData} />)

    const monthlyTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthlyTab)
    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByLabelText('เลือกปีงบประมาณ')).toBeInTheDocument()
  })
})
