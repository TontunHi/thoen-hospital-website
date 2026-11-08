import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StreptokinaseRecipientsClient from '../StreptokinaseRecipientsClient'
import type {
  StreptokinaseReportResult,
  StreptokinaseItem,
} from '@/lib/clinical/rcmStreptokinaseService'

const mockSummary = {
  totalCases: 2,
  uniquePatients: 2,
  auditPassCases: 1,
  auditPassRate: 50.0,
  auditErrorCases: 1,
  auditErrorRate: 50.0,
  compensatedCases: 1,
  uncompensatedCases: 1,
  compensationRate: 50.0,
  totalCompensated: 12000,
  totalHosxp: 25000,
  totalDebit: 12500,
  withInvoiceCases: 1,
  withRepCases: 1,
  notSentCases: 1,
}

const mockItemOpd: StreptokinaseItem = {
  no: 1,
  patientType: 'OPD',
  vn: '690101111111',
  an: null,
  hn: '0012345',
  cid: '1529900011111',
  ptname: 'นาย สมชาย ใจดี',
  sex: 'ชาย',
  birthday: '1970-01-01',
  age: 56,
  date: '2026-10-15',
  vstdate: '2026-10-15',
  vsttime: '08:30:00',
  pttypename: 'บัตรทอง',
  department: 'ห้องอุบัติเหตุ-ฉุกเฉิน',
  clinic: 'อุบัติเหตุและฉุกเฉิน',
  drugname: 'Streptokinase inj 1.5 MU #1',
  money_hosxp: 12500,
  discount_money: 0,
  rcpt_money: 0,
  debit: 12500,
  rcpno: '',
  dx: 'I210',
  op: '9910',
  errorDx: null,
  errorOp: null,
  hasError: false,
  money_eclaim: 12000,
  money_rep: 12000,
  money_invoice: 12000,
  rep: 'REP69001',
  status: 'NHSO :: ได้รับ Invoice',
  compensated: 12000,
  isCompensated: true,
}

const mockItemIpd: StreptokinaseItem = {
  no: 2,
  patientType: 'IPD',
  vn: null,
  an: '690001234',
  hn: '0023456',
  cid: '1529900022222',
  ptname: 'นาง สมศรี ดวงดี',
  sex: 'หญิง',
  birthday: '1965-05-12',
  age: 61,
  date: '2026-10-20',
  admdate: '2026-10-18',
  dchdate: '2026-10-20',
  pttypename: 'บัตรทอง',
  ward: 'ตึกผู้ป่วยในหญิง',
  drugname: 'Streptokinase inj 1.5 MU #1',
  money_hosxp: 12500,
  discount_money: 0,
  rcpt_money: 0,
  debit: 12500,
  rcpno: '',
  dx: 'I10',
  op: '',
  errorDx: 'ไม่พบ Dx I210-I213 หรือ I22x',
  errorOp: 'ไม่พบ Op 9910',
  hasError: true,
  money_eclaim: 0,
  money_rep: 0,
  money_invoice: 0,
  rep: null,
  status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
  compensated: 0,
  isCompensated: false,
}

const mockInitialData: StreptokinaseReportResult = {
  title: 'กองทุนยา Streptokinase',
  subtitle: 'รายชื่อรับยา Streptokinase',
  patientType: 'OPD',
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  adpMapping: {
    adpCode: 'STEMI',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '1560001', name: 'Streptokinase inj 1.5 MU', strength: '1.5 MU', nhso_adp_code: 'STEMI01' }],
  },
  cardFilter: 'ALL',
  search: '',
  sortBy: 'date',
  sortOrder: 'desc',
  summary: mockSummary,
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [mockItemOpd, mockItemIpd],
}

describe('StreptokinaseRecipientsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/service/dashboard-rcm/funds/streptokinase/recipients')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockInitialData,
            }),
        })
      }
      if (url.includes('/api/service/dashboard-rcm/funds/streptokinase/vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                vn: '690101111111',
                hn: '0012345',
                ptname: 'นาย สมชาย ใจดี',
                orders: {
                  items: [{ icode: '1560001', name: 'Streptokinase inj 1.5 MU', qty: 1, unitprice: 12500, sum_price: 12500 }],
                },
              },
            }),
        })
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`))
    })
  })

  it('renders title, breadcrumb, KPI cards, and patient row without button column', () => {
    render(<StreptokinaseRecipientsClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1, name: 'รายชื่อรับยา Streptokinase' })).toBeDefined()
    expect(screen.getByText(/สมชาย/)).toBeDefined()
    expect(screen.getByText('0012345')).toBeDefined()

    // KPI Cards
    expect(screen.getByText('ผู้รับยาทั้งหมด')).toBeDefined()
    expect(screen.getByText('บันทึก Dx/Op ถูกต้อง')).toBeDefined()
    expect(screen.getByText('พบข้อผิดพลาด Dx/Op')).toBeDefined()
    expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeDefined()

    // Verify row-clickable table: no action button column "ดูข้อมูล"
    expect(screen.queryByRole('button', { name: 'ดูข้อมูล' })).toBeNull()
  })

  it('opens detail modal directly when clicking a record row', async () => {
    render(<StreptokinaseRecipientsClient initialData={mockInitialData} />)

    // Click on the patient row directly
    const row = screen.getByText('0012345').closest('tr')
    expect(row).not.toBeNull()
    fireEvent.click(row!)

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
      expect(screen.getByText('นาย สมชาย ใจดี (0012345)')).toBeDefined()
      expect(screen.getByText(/ผ่านการตรวจสอบ: พบรหัสโรค STEMI/)).toBeDefined()
      expect(screen.getByText(/ผ่านการตรวจสอบ: มีการบันทึกหัตถการ Op 9910/)).toBeDefined()
    })

    // Close modal
    const closeBtn = screen.getByLabelText('ปิดหน้าต่าง')
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('displays warning banner when ADP mapping is missing', () => {
    const unmappedData = {
      ...mockInitialData,
      adpMapping: {
        adpCode: 'STEMI',
        isMapped: false,
        mappedCount: 0,
        items: [],
      },
    }
    render(<StreptokinaseRecipientsClient initialData={unmappedData} />)

    expect(
      screen.getByText(/คำเตือน: ยังไม่ได้ Map ADP Code สำหรับยากลุ่ม STEMI \/ Streptokinase/)
    ).toBeDefined()
  })

  it('switches patient type to IPD and triggers fetch', async () => {
    render(<StreptokinaseRecipientsClient initialData={mockInitialData} />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD'),
        expect.anything()
      )
    })
  })

  it('allows clicking KPI card to filter and searches with input', async () => {
    render(<StreptokinaseRecipientsClient initialData={mockInitialData} />)

    // Click 'พบข้อผิดพลาด Dx/Op' card
    const errorCard = screen.getByText('พบข้อผิดพลาด Dx/Op').closest('div')
    fireEvent.click(errorCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=AUDIT_ERROR'),
        expect.anything()
      )
    })

    // Search input
    const searchInput = screen.getByPlaceholderText(/ค้นหาด้วย HN, CID, ชื่อผู้ป่วย/)
    fireEvent.change(searchInput, { target: { value: 'สมศรี' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search='),
        expect.anything()
      )
    })
  })

  it('renders orders tab with spotlight card, summary grid, filter chips, and table', async () => {
    // Provide OPD response with multiple items (drug and service)
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/service/dashboard-rcm/funds/streptokinase/vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                vn: '690101111111',
                hn: '0012345',
                ptname: 'นาย สมชาย ใจดี',
                orders: {
                  items: [
                    {
                      icode: '1560001',
                      item_name: 'Streptokinase inj 1.5 MU',
                      qty: 1,
                      unitprice: 12500,
                      sum_price: 12500,
                      paidst_name: 'ชดเชยพิเศษ',
                      income_name: 'ค่ายาและสารอาหาร',
                      category_group: 'drug',
                    },
                    {
                      icode: '3000001',
                      item_name: 'ค่าตรวจวินิจฉัยคลื่นไฟฟ้าหัวใจ (EKG 12 leads)',
                      qty: 1,
                      unitprice: 200,
                      sum_price: 200,
                      paidst_name: 'เบิกได้',
                      income_name: 'ค่าบริการตรวจวินิจฉัย',
                      category_group: 'service',
                    },
                  ],
                },
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockInitialData }),
      })
    })

    render(<StreptokinaseRecipientsClient initialData={mockInitialData} />)

    // Click patient row to open modal
    const row = screen.getByText('0012345').closest('tr')
    fireEvent.click(row!)

    // Switch to Orders tab
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })
    const ordersTabBtn = screen.getByRole('button', { name: /รายการยาและค่าบริการรักษา \(Orders\)/ })
    fireEvent.click(ordersTabBtn)

    // Verify Clinical Spotlight Card
    await waitFor(() => {
      expect(screen.getByText('ยาเป้าหมายตามโครงการ (STEMI Thrombolytic Therapy)')).toBeDefined()
      expect(screen.getAllByText(/Streptokinase inj 1.5 MU/).length).toBeGreaterThan(0)
      expect(screen.getByText('ยาเป้าหมาย STEMI')).toBeDefined()
    })

    // Verify 4-Card Summary Strip
    expect(screen.getByText('คำสั่งการรักษาทั้งหมด')).toBeDefined()
    expect(screen.getByText('รายการยาและเวชภัณฑ์')).toBeDefined()
    expect(screen.getByText('ค่าบริการและหัตถการ')).toBeDefined()
    expect(screen.getByText('ยอดรวมค่ารักษา (HOSxP)')).toBeDefined()

    // Verify Table Rows
    expect(screen.getByText('ค่าตรวจวินิจฉัยคลื่นไฟฟ้าหัวใจ (EKG 12 leads)')).toBeDefined()

    // Test Category Filter: Click "รายการยา" chip
    const drugChip = screen.getByRole('button', { name: /^รายการยา\s*\d+/ })
    fireEvent.click(drugChip)
    expect(screen.queryByText('ค่าตรวจวินิจฉัยคลื่นไฟฟ้าหัวใจ (EKG 12 leads)')).toBeNull()

    // Test Search Input: Type "EKG" while on all
    const allChip = screen.getByRole('button', { name: /^ทั้งหมด\s*\d+/ })
    fireEvent.click(allChip)
    expect(screen.getByText('ค่าตรวจวินิจฉัยคลื่นไฟฟ้าหัวใจ (EKG 12 leads)')).toBeDefined()

    const searchOrderInput = screen.getByPlaceholderText('ค้นหาชื่อยา, รหัส, หมวดรายได้...')
    fireEvent.change(searchOrderInput, { target: { value: 'EKG' } })
    expect(screen.getByText('ค่าตรวจวินิจฉัยคลื่นไฟฟ้าหัวใจ (EKG 12 leads)')).toBeDefined()
    const tableRows = document.querySelectorAll('.stk-order-table tbody tr')
    expect(tableRows.length).toBe(1)
  })
})
