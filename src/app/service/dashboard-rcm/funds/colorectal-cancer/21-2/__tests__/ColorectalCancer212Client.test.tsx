import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ColorectalCancer212Client from '../ColorectalCancer212Client'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 1050,
  averageCompensated: 150,
  completeCount: 8,
  completeRate: 80.0,
  missingAdpCount: 1,
  missingAdpRate: 10.0,
  missingPpCount: 1,
  missingPpRate: 10.0,
  invalidPpCodeCount: 0,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  ucCount: 8,
  ucRate: 80.0,
  totalIncome: 1500,
}

const mockItem = {
  no: 1,
  vn: '691001083000',
  cid: '1529900111222',
  hn: '0012345',
  ptname: 'นายประสิทธิ์ สุขใจ',
  birthday: '1970-05-15',
  sex: 'ชาย',
  age: 56,
  isTargetAge: true,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH90005',
  maininscl: 'UCS',
  isUc: true,
  pttypename: 'บัตรทอง',
  department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
  clinic: 'ตรวจโรคทั่วไป',
  pdx: 'Z121',
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
  labresult: 'Negative',
  code: '1B0060 FIT test ผลปกติ',
  pp_special_code: '1B0060',
  listname: 'ตรวจคัดกรอง FIT test 90005',
  hasAdp: true,
  hasPpSpecial: true,
  dataQualityStatus: 'COMPLETE' as const,
  status_seamless: 'Approved',
  rep_seamless: 'REP69-001',
  compensated_seamless: 150,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP69-001',
  compensated: 150,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'PP',
  subfund: 'FIT',
}

const mockInitialData = {
  adpCode: '90005' as const,
  title: '21.2 รายชื่อผู้รับบริการ ADP (90005)',
  categoryTitle: 'บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    adpCode: '90005',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3000501', name: 'ตรวจคัดกรอง FIT test', strength: null, nhso_adp_code: '90005' }],
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

describe('ColorectalCancer212Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders correctly with initialData without loading skeleton', () => {
    render(<ColorectalCancer212Client initialData={mockInitialData} />)

    expect(screen.getByText('21.2 รายชื่อผู้รับบริการ ADP (90005)')).toBeInTheDocument()
    expect(
      screen.getByText(/บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง \(Fit test\) อายุ 50-70 ปี/)
    ).toBeInTheDocument()

    // Check KPI Cards
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ชดเชย')).toBeInTheDocument()
    expect(screen.getByText('ข้อมูลครบถ้วน')).toBeInTheDocument()
    expect(screen.getByText('ขาด ADP 90005')).toBeInTheDocument()
    expect(screen.getByText('ขาด Special PP')).toBeInTheDocument()
    expect(screen.getByText('มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี ClaimCode')).toBeInTheDocument()

    // Check table patient row
    expect(screen.getByText((_, el) => el?.textContent === 'นายประสิทธิ์ สุขใจ' && el?.classList.contains('crc-name-wrap'))).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900111222')).toBeInTheDocument()
    expect(screen.getByText('AUTH90005')).toBeInTheDocument()
  })

  it('opens detail modal upon clicking patient table row directly (without action button)', async () => {
    render(<ColorectalCancer212Client initialData={mockInitialData} />)

    const patientRow = screen.getByText('0012345').closest('tr')
    expect(patientRow).toBeTruthy()

    fireEvent.click(patientRow!)

    await waitFor(() => {
      // Modal should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลการคัดกรอง & การชดเชย')).toBeInTheDocument()
      expect(screen.getByText('การตรวจคัดกรอง FIT test & รหัส ADP 90005')).toBeInTheDocument()
      expect(screen.getByText('ผล Lab Stool FIT test')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByLabelText('ปิดหน้าต่าง')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('filters data when clicking on KPI Summary Card', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            ...mockInitialData,
            cardFilter: 'MISSING_ADP',
            totalCount: 1,
            items: [{ ...mockItem, dataQualityStatus: 'MISSING_ADP', listname: null }],
          },
        }),
    })
    global.fetch = fetchMock

    render(<ColorectalCancer212Client initialData={mockInitialData} />)

    const missingAdpCard = screen.getByText('ขาด ADP 90005').closest('.crc-kpi-card')
    expect(missingAdpCard).toBeTruthy()

    fireEvent.click(missingAdpCard!)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain('cardFilter=MISSING_ADP')
    })
  })

  it('switches date mode to monthly and fiscal year without tab numbering', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockInitialData }),
    })
    global.fetch = fetchMock

    render(<ColorectalCancer212Client initialData={mockInitialData} />)

    const monthlyBtn = screen.getByRole('button', { name: 'รายเดือน' })
    const fiscalBtn = screen.getByRole('button', { name: 'ปีงบประมาณ' })

    // Verify button names do not have 1. 2. 3.
    expect(screen.queryByText('1. กำหนดเอง')).not.toBeInTheDocument()
    expect(screen.queryByText('2. เดือน')).not.toBeInTheDocument()
    expect(screen.queryByText('3. ปีงบประมาณ')).not.toBeInTheDocument()

    fireEvent.click(monthlyBtn)
    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()

    fireEvent.click(fiscalBtn)
    expect(screen.getByLabelText('เลือกปีงบประมาณ')).toBeInTheDocument()
  })

  it('searches by keyword with debounce', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockInitialData }),
    })
    global.fetch = fetchMock

    render(<ColorectalCancer212Client initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(/ค้นหา HN, CID, ชื่อผู้ป่วย, VN/)
    fireEvent.change(searchInput, { target: { value: '0012345' } })

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalled()
        const url = fetchMock.mock.calls[0][0] as string
        expect(url).toContain('search=0012345')
      },
      { timeout: 1000 }
    )
  })

  it('conforms to ui-style-brief: patient name cohesion, age cohesion, centered reimbursement column, and escape key modal close', async () => {
    const { container } = render(<ColorectalCancer212Client initialData={mockInitialData} />)

    // 1. Patient Name wrap & cohesion
    const nameWrap = container.querySelector('.crc-name-wrap')
    expect(nameWrap).toBeInTheDocument()
    const nameParts = container.querySelectorAll('.crc-name-part')
    expect(nameParts.length).toBe(2)
    expect(nameParts[0].textContent).toBe('นายประสิทธิ์')
    expect(nameParts[1].textContent).toBe('สุขใจ')

    // 2. Centered reimbursement column header and cell
    const repHeader = screen.getByText('ยอดชดเชย').closest('th')
    expect(repHeader).toHaveClass('crc-col-center')

    const repCell = screen.getByText('150.00').closest('td')
    expect(repCell).toHaveClass('crc-col-center')

    // 3. Open modal by row click and close with Escape key
    const patientRow = screen.getByText('0012345').closest('tr')
    fireEvent.click(patientRow!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('filters by right when selecting options in PttypeMultiSelect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockInitialData }),
    })
    global.fetch = fetchMock

    render(<ColorectalCancer212Client initialData={mockInitialData} />)

    const selectTrigger = screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i })
    expect(selectTrigger).toBeInTheDocument()
    fireEvent.click(selectTrigger)

    // Click UC preset
    const ucBtn = screen.getByText('🏥 เฉพาะ UC (01-09)')
    fireEvent.click(ucBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain('pttypes=01%2C02%2C03%2C04%2C05%2C06%2C07%2C08%2C09')
      expect(url).toContain('page=1')
    })
  })
})
