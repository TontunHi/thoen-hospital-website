import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InstrumentFundClient from '../InstrumentFundClient'
import type {
  InstrumentItem,
  InstrumentSummary,
  InstrumentReportResponse,
} from '@/lib/clinical/rcmInstrumentFundService'

const mockSummary: InstrumentSummary = {
  totalCases: 2,
  totalUniquePatients: 2,
  totalInstrumentHosp: 18500,
  totalDebit: 18500,
  oaCases: 1,
  oaAmount: 17000,
  dmCases: 1,
  dmAmount: 1500,
  otherCases: 0,
  otherAmount: 0,
  compensatedCases: 1,
  totalCompensated: 17000,
  invoiceCases: 1,
  invoiceAmount: 17000,
  repCases: 0,
  repAmount: 0,
  unsentCases: 1,
  unsentAmount: 1500,
  discrepancyCases: 0,
  authenCases: 1,
  authenRate: 50,
  ucCases: 2,
  ucRate: 100,
}

const mockItems: InstrumentItem[] = [
  {
    no: 1,
    patientType: 'OPD',
    vn: '691001111111',
    hn: '0011111',
    cid: '1529900011111',
    ptname: 'นาย สมชาย ใจดี',
    sex: 'ชาย',
    vstdate: '2026-10-15',
    vsttime: '08:30:00',
    date: '2026-10-15',
    time: '08:30:00',
    room: 'ห้องตรวจศัลยกรรม',
    ward: null,
    inscl: 'UCS',
    pttypename: 'บัตรทอง',
    authencode: 'AUTH001',
    money_hosxp: 25000,
    discount_money: 0,
    rcpt_money: 0,
    debit: 25000,
    rcpno: '12345',
    instrument: 17000,
    list: '7004:ข้อเข่าเทียม#12000.00, 7005:เบ้ารองข้อเข่า#5000.00',
    items: [
      { adpCode: '7004', name: 'ข้อเข่าเทียม', price: 12000 },
      { adpCode: '7005', name: 'เบ้ารองข้อเข่า', price: 5000 },
    ],
    oa: 'Y',
    dm: null,
    itemCount: 2,
    money_eclaim: 17000,
    money_rep: 0,
    money_invoice: 17000,
    diff_money: 0,
    eclaim_status: '1',
    status: 'NHSO :: ได้รับ Invoice แล้ว',
    statusCode: 'INVOICE',
    isDiscrepancy: false,
    isCompensated: true,
    isUc: true,
  },
  {
    no: 2,
    patientType: 'OPD',
    vn: '691002222222',
    hn: '0022222',
    cid: '1529900022222',
    ptname: 'นาง สมศรี มีสุข',
    sex: 'หญิง',
    vstdate: '2026-10-20',
    vsttime: '09:15:00',
    date: '2026-10-20',
    time: '09:15:00',
    room: 'ห้องตรวจเบาหวาน',
    ward: null,
    inscl: 'UCS',
    pttypename: 'บัตรทอง',
    authencode: null,
    money_hosxp: 2500,
    discount_money: 0,
    rcpt_money: 0,
    debit: 2500,
    rcpno: null,
    instrument: 1500,
    list: '8612:แถบตรวจน้ำตาล#1500.00',
    items: [{ adpCode: '8612', name: 'แถบตรวจน้ำตาล', price: 1500 }],
    oa: null,
    dm: 'Y',
    itemCount: 1,
    money_eclaim: 0,
    money_rep: 0,
    money_invoice: 0,
    diff_money: 0,
    eclaim_status: null,
    status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
    statusCode: 'UNSENT',
    isDiscrepancy: false,
    isCompensated: false,
    isUc: true,
  },
]

const mockInitialData: InstrumentReportResponse = {
  items: mockItems,
  total: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  summary: mockSummary,
  dateRange: {
    startDate: '2026-10-01',
    endDate: '2027-09-30',
  },
  adpMapping: {
    isMapped: true,
    mappedCount: 2,
    items: [
      { icode: '3000001', name: 'ข้อเข่าเทียม', nhso_adp_code: '7004' },
      { icode: '3000002', name: 'แถบตรวจน้ำตาล', nhso_adp_code: '8612' },
    ],
  },
}

describe('InstrumentFundClient', () => {
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

  it('renders heading, patient details, and 8 KPI summary cards correctly', () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    // Heading
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์/i,
      })
    ).toBeInTheDocument()

    // 8 KPI Cards check
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ผ่าข้อเข่า OA')).toBeInTheDocument()
    expect(screen.getByText('อุปกรณ์เบาหวาน DM')).toBeInTheDocument()
    expect(screen.getByText('อุปกรณ์อื่นๆ')).toBeInTheDocument()
    expect(screen.getByText('ได้รับ Invoice สปสช.')).toBeInTheDocument()
    expect(screen.getByText('ได้รับ Rep แล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ส่ง E-Claim')).toBeInTheDocument()
    expect(screen.getByText('ยอดไม่เท่ากัน')).toBeInTheDocument()

    // Table rows
    expect(screen.getByText('นาย สมชาย ใจดี')).toBeInTheDocument()
    expect(screen.getByText('นาง สมศรี มีสุข')).toBeInTheDocument()
    expect(screen.getByText('1529900011111')).toBeInTheDocument()
    expect(screen.getByText('1529900022222')).toBeInTheDocument()

    // Table headers: 'รายการอวัยวะเทียมและอุปกรณ์' must be present, 'ประเภท' must be removed
    expect(
      screen.getByRole('columnheader', { name: 'รายการอวัยวะเทียมและอุปกรณ์' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'ประเภท' })
    ).not.toBeInTheDocument()

    // Table row cells: instruments displayed on front page without needing to open modal
    expect(screen.getByText('ข้อเข่าเทียม')).toBeInTheDocument()
    expect(screen.getByText('เบ้ารองข้อเข่า')).toBeInTheDocument()
    expect(screen.getByText('แถบตรวจน้ำตาล')).toBeInTheDocument()
    expect(screen.getByText('7004')).toBeInTheDocument()
    expect(screen.getByText('8612')).toBeInTheDocument()
  })

  it('filters data when KPI card is clicked', async () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    const oaCard = screen.getByText('ผ่าข้อเข่า OA').closest('button')
    expect(oaCard).toBeInTheDocument()

    fireEvent.click(oaCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=OA'),
        expect.anything()
      )
    })
  })

  it('switches patient type between OPD and IPD', async () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    const ipdTab = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/i })
    fireEvent.click(ipdTab)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD'),
        expect.anything()
      )
    })
  })

  it('opens detail modal upon clicking record row without separate view button', async () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    const row = screen.getByText('นาย สมชาย ใจดี').closest('tr')
    expect(row).toBeInTheDocument()

    fireEvent.click(row!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลทั่วไปและการรับบริการ')).toBeInTheDocument()
      expect(screen.getAllByText(/รายการอวัยวะเทียมและอุปกรณ์/i).length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('การเงินและการกระทบยอดชดเชย')).toBeInTheDocument()
      expect(screen.getAllByText('ข้อเข่าเทียม').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('filters data when instrument dropdown is changed', async () => {
    render(
      <InstrumentFundClient
        initialData={{
          ...mockInitialData,
          availableInstruments: [
            { id: '7004', code: '7004', name: 'ข้อเข่าเทียม', count: 1, category: 'OA' },
            { id: '8612', code: '8612', name: 'แถบตรวจน้ำตาล', count: 1, category: 'DM' },
          ],
        }}
      />
    )

    const triggerBtn = screen.getByTestId('instrument-select-trigger')
    expect(triggerBtn).toBeInTheDocument()

    // Click to open dropdown popover
    fireEvent.click(triggerBtn)

    // Select the knee option in the dropdown list using data-testid
    const option = screen.getByTestId('instrument-option-7004')
    expect(option).toBeInTheDocument()
    fireEvent.click(option)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('instrumentFilter=7004'),
        expect.anything()
      )
    })
  })

  it('changes date mode seamlessly without parentheses in date display', async () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    const monthTab = screen.getByRole('button', { name: 'เดือน' })
    fireEvent.click(monthTab)
    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('button', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByLabelText('เลือกปีงบประมาณ')).toBeInTheDocument()
  })

  it('triggers search when typing in search input', async () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    const searchInput = screen.getByPlaceholderText(
      /ค้นหา HN, CID, ชื่อ-สกุล, VN\/AN, สิทธิ, รหัสอุปกรณ์.../i
    )
    fireEvent.change(searchInput, { target: { value: 'สมชาย' } })

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search='),
          expect.anything()
        )
      },
      { timeout: 1000 }
    )
  })

  it('complies with ui-style-brief and user spec: no redundant date range badge and correct breadcrumb', () => {
    render(<InstrumentFundClient initialData={mockInitialData} />)

    // Breadcrumb should show "กองทุนอวัยวะเทียมและอุปกรณ์", not rehabilitation
    expect(screen.getByText('กองทุนอวัยวะเทียมและอุปกรณ์')).toBeInTheDocument()
    expect(screen.queryByText('กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์')).not.toBeInTheDocument()

    // No redundant date badge showing "1 ต.ค. 2569 ถึง 30 ก.ย. 2570" or parentheses
    expect(screen.queryByTitle('ช่วงวันที่ประมวลผล')).not.toBeInTheDocument()
  })
})
