import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AnemiaScreening171Client from '../AnemiaScreening171Client'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 455,
  averageCompensated: 65,
  targetAgeCount: 8,
  targetAgeRate: 80.0,
  repeatClaimCount: 1,
  repeatClaimRate: 10.0,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  ucCount: 8,
  ucRate: 80.0,
  totalIncome: 650,
}

const mockItem = {
  no: 1,
  vn: '691001083000',
  cid: '1529900111222',
  hn: '0012345',
  ptname: 'น.ส. สมหญิง สดใส',
  sex: 'หญิง',
  age: 18,
  isTargetAge: true,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH13001',
  maininscl: 'UCS',
  isUc: true,
  pttype_eclaim_id: 'UCS',
  pttypename: 'บัตรทอง',
  department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
  clinic: 'ตรวจโรคทั่วไป',
  pdx: 'Z138',
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
  income: 65,
  listname: 'คัดกรอง CBC (Z130)  13001 Project code',
  camedate: null,
  hasRepeatClaim: false,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP691001',
  compensated: 65,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'OP_PP',
  subfund: 'ANEMIA',
  errorcode: null,
  transactiontype: 'OP',
}

const mockInitialData = {
  adpCode: '13001' as const,
  title: '17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  fiscalStartYear: '2026-10-01',
  adpMapping: {
    adpCode: '13001',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3002545', name: 'คัดกรอง CBC', strength: null, nhso_adp_code: '13001' }],
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

describe('AnemiaScreening171Client Component', () => {
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

  it('renders title, summary KPI numbers, and table with initialData', () => {
    render(<AnemiaScreening171Client initialData={mockInitialData} />)

    expect(
      screen.getByRole('heading', { level: 1, name: /17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก/ })
    ).toBeInTheDocument()
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('กลุ่มอายุ 13-24 ปี')).toBeInTheDocument()
    expect(screen.getByText('น.ส. สมหญิง สดใส')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900111222')).toBeInTheDocument()
  })

  it('filters via clicking KPI cards', async () => {
    render(<AnemiaScreening171Client initialData={mockInitialData} />)

    const targetAgeCard = screen.getByText('กลุ่มอายุ 13-24 ปี').closest('.as-kpi-card')!
    fireEvent.click(targetAgeCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=TARGET_AGE'),
        expect.any(Object)
      )
    })
  })

  it('switches date mode to monthly and fiscal year', async () => {
    render(<AnemiaScreening171Client initialData={mockInitialData} />)

    const monthTab = screen.getByRole('tab', { name: 'รายเดือน' })
    fireEvent.click(monthTab)
    expect(screen.getByText('เลือกเดือน:')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByText('ปีงบประมาณ พ.ศ.:')).toBeInTheDocument()
  })

  it('opens clinical modal directly on row click without extra button', async () => {
    render(<AnemiaScreening171Client initialData={mockInitialData} />)

    // Verify there is no "ดูข้อมูล" button in table row
    expect(screen.queryByRole('button', { name: 'ดูข้อมูล' })).not.toBeInTheDocument()

    // Clicking table row opens modal
    const row = screen.getByText('น.ส. สมหญิง สดใส').closest('tr')!
    fireEvent.click(row)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/สรุปข้อมูลการชดเชย & เวชระเบียน/)).toBeInTheDocument()
    expect(screen.getByText(/ข้อมูลตัวบุคคล & สิทธิประโยชน์/)).toBeInTheDocument()

    // Close button dismisses modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('searches by keyword', async () => {
    render(<AnemiaScreening171Client initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(/พิมพ์คำค้นหา/)
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
})
