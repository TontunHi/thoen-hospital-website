import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CancerFundAdpClient from '../CancerFundAdpClient'
import type { CancerFundReportResult } from '@/lib/clinical/rcmCancerFundService'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 45000,
  averageCompensated: 6428.57,
  totalInvoiceCompensated: 45000,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  invoiceCount: 7,
  invoiceRate: 70.0,
  repCount: 7,
  repRate: 70.0,
  ucCount: 8,
  ucRate: 80.0,
}

const mockItem = {
  no: 1,
  vn: '691001083001',
  cid: '1529900111221',
  hn: '0000001',
  ptname: 'นาย สมชาย รักดี',
  firstName: 'นาย สมชาย',
  lastName: 'รักดี',
  sex: 'ชาย',
  birthday: '1960-05-15',
  age: 66,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH001',
  maininscl: 'UCS',
  pttype_eclaim_id: '01',
  pttypename: 'บัตรทอง',
  isUc: true,
  department: 'กลุ่มงานอายุรกรรม',
  clinic: 'คลินิกเคมีบำบัด',
  pdx: 'C349',
  dx0: 'Z511',
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
  listname: 'Paclitaxel 100 mg injection',
  rep: 'REP-C01',
  compensated: 4500,
  isCompensated: true,
  transactiontype: 'OP',
  invoice: 'INV-001',
  invoice_compensated: 4500,
  resource: 'NHSO',
  subfund: 'CANCER',
  remark: null,
  projectcode: 'CA01',
  status_eclaim: 'NHSO :: ได้รับ Invoice แล้ว',
}

const mockInitialData: CancerFundReportResult = {
  title: 'กองทุนมะเร็ง',
  categoryTitle: 'กองทุนมะเร็ง',
  subTitle: 'รายชื่อผู้ป่วย จาก ADP (CANCER)',
  adpCode: 'CANCER',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    adpCode: 'CANCER',
    isMapped: true,
    mappedCount: 1,
    items: [
      {
        icode: '1590001',
        name: 'Paclitaxel 100 mg injection',
        strength: '100 mg',
        nhso_adp_code: 'CANCER',
      },
    ],
  },
  cardFilter: 'ALL',
  ucOnly: false,
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: mockSummary,
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [mockItem],
}

describe('CancerFundAdpClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders correctly with initialData without waterfall skeleton', () => {
    render(<CancerFundAdpClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1, name: 'กองทุนมะเร็ง' })).toBeInTheDocument()
    expect(screen.getByText('รายชื่อผู้ป่วย จาก ADP (CANCER)')).toBeInTheDocument()

    // Check summary cards
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ชดเชย')).toBeInTheDocument()
    expect(screen.getByText('มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('มี Invoice แล้ว')).toBeInTheDocument()
    expect(screen.getByText('สิทธิ์บัตรทอง (UC)')).toBeInTheDocument()
    expect(screen.getByText('ยอดชดเชยรวม (บาท)')).toBeInTheDocument()

    // Check patient table row
    expect(screen.getByText('0000001')).toBeInTheDocument()
    expect(screen.getByText('1529900111221')).toBeInTheDocument()
    expect(screen.getByText('AUTH001')).toBeInTheDocument()
    expect(screen.getByText('C349')).toBeInTheDocument()
    expect(screen.getByText('Paclitaxel 100 mg injection')).toBeInTheDocument()
  })

  it('opens detail modal upon clicking record directly in table', async () => {
    render(<CancerFundAdpClient initialData={mockInitialData} />)

    const patientRow = screen.getByText('0000001').closest('tr')
    expect(patientRow).toBeTruthy()

    fireEvent.click(patientRow!)

    await waitFor(() => {
      expect(screen.getByText('ข้อมูลสรุปการรับบริการ')).toBeInTheDocument()
      expect(screen.getByText('การวินิจฉัยและหัตถการ')).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลการชดเชยและ e-Claim')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByText('ปิด')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText('ข้อมูลสรุปการรับบริการ')).not.toBeInTheDocument()
    })
  })

  it('filters data when clicking on Summary Card', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            ...mockInitialData,
            cardFilter: 'COMPENSATED',
          },
        }),
    })
    global.fetch = fetchMock

    render(<CancerFundAdpClient initialData={mockInitialData} />)

    const compensatedCard = screen.getByText('ชดเชยแล้ว').closest('.cancer-card')
    expect(compensatedCard).toBeTruthy()

    fireEvent.click(compensatedCard!)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED'),
        expect.anything()
      )
    })
  })

  it('switches date mode to monthly and fiscal without brackets', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockInitialData }),
    })
    global.fetch = fetchMock

    render(<CancerFundAdpClient initialData={mockInitialData} />)

    const monthlyBtn = screen.getByText('เดือน')
    fireEvent.click(monthlyBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const fiscalBtn = screen.getByText('ปีงบประมาณ')
    fireEvent.click(fiscalBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
  })
})
