import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DisabilityServicesClient from '../DisabilityServicesClient'
import type {
  RehabServiceItem,
  RehabSummary,
  RehabReportResult,
} from '@/lib/clinical/rcmRehabilitationService'

const mockSummary: RehabSummary = {
  totalCases: 4,
  matchedCases: 1,
  matchedRate: 25,
  notInWebCases: 1,
  notInWebRate: 25,
  noRehabCodeCases: 1,
  noRehabCodeRate: 25,
  noVnCases: 1,
  noVnRate: 25,
  compensatedCases: 1,
  compensationRate: 25,
  totalCompensated: 500,
  uncompensatedCases: 3,
  withAuthenCases: 2,
  withAuthenRate: 50,
  noAuthenCases: 2,
  ucCases: 3,
}

const mockItem: RehabServiceItem = {
  no: 1,
  vn: '691010000001',
  an: null,
  hn: '0012345',
  cid: '1529900012345',
  ptname: 'นาย สมชาย สุขเกษม',
  vstdate: '2026-10-10',
  vsttime: '09:00:00',
  authencode: 'AUTH-REHAB-01',
  maininscl: 'UCS',
  pttypename: 'ประกันสุขภาพถ้วนหน้า',
  department: 'กลุ่มงานเวชกรรมฟื้นฟู',
  clinic: 'เวชกรรมฟื้นฟู',
  income: 500,
  listname: '30001#H9449.1#กายภาพบำบัดฟื้นฟู#500.00',
  diag: 'M545',
  oper: '9311',
  doctorname: 'นพ. วินิจฉัย ดีเยี่ยม',
  filetype: 'ตรงกันทั้ง 2 ระบบ',
  rehab_name: 'ฟื้นฟูกายภาพบำบัดกล้ามเนื้อ',
  rehab_code: 'H9449.1',
  rep_seamless: 'DTTM-69-001',
  payno: 'PAY-001',
  compensated_seamless: 500,
  noCompensated: null,
  status: 'มี Rep แล้ว',
  rep: 'REP-REHAB-01',
  compensated: 500,
  isCompensated: true,
  isUc: true,
  match_status: 'MATCHED',
  targetgroup: 'ผู้สูงอายุที่มีภาวะพึ่งพิง',
  deformed_type: 'การเคลื่อนไหว',
  adl: '15',
  startservice: '2026-10-10',
  endservice: '2026-10-10',
  unitprice: 500,
  realprice: 500,
  staff: 'น.ส. พยาบาล ใจดี',
  serialno: 'SER-01',
  web_status: 'SUCCESS',
  filename: 'rehab_oct69.xlsx',
}

const mockInitialData: RehabReportResult = {
  categoryTitle: 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์',
  subtopicTitle: 'รายการการให้บริการฟื้นฟูสมรรถภาพ',
  reportTitle: 'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability',
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  adpMapping: {
    isMapped: true,
    mappedCount: 2,
    totalTargetCodes: 16,
    items: [
      { icode: '30001', name: 'กายภาพบำบัดฟื้นฟู', strength: null, nhso_adp_code: 'H9449.1' },
    ],
  },
  cardFilter: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
  totalCount: 1,
  totalPages: 1,
  summary: mockSummary,
  items: [mockItem],
}

describe('DisabilityServicesClient', () => {
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

  it('renders title, breadcrumb, 8 KPI cards, and patient row properly', () => {
    render(<DisabilityServicesClient initialData={mockInitialData} />)

    // Heading
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability/i,
      })
    ).toBeInTheDocument()

    // Patient info in table
    expect(screen.getByText('นาย สมชาย')).toBeInTheDocument()
    expect(screen.getByText('สุขเกษม')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900012345')).toBeInTheDocument()
    expect(screen.getByText('H9449.1')).toBeInTheDocument()
    expect(screen.getByText('ฟื้นฟูกายภาพบำบัดกล้ามเนื้อ')).toBeInTheDocument()
    expect(screen.getByText('ตรงกัน 2 ระบบ')).toBeInTheDocument()

    // 8 KPI Cards check
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ตรงกันทั้ง 2 ระบบ')).toBeInTheDocument()
    expect(screen.getByText('ไม่พบใน Web Disability')).toBeInTheDocument()
    expect(screen.getByText('HOSxP ขาดรหัส ADP')).toBeInTheDocument()
    expect(screen.getByText('ชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ชดเชย / รอชดเชย')).toBeInTheDocument()
    expect(screen.getByText('มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี VN ใน HOSxP')).toBeInTheDocument()
  })

  it('toggles card filter when a KPI card is clicked', async () => {
    render(<DisabilityServicesClient initialData={mockInitialData} />)

    const matchedCard = screen.getByText('ตรงกันทั้ง 2 ระบบ').closest('.rehab-card')
    expect(matchedCard).toBeInTheDocument()

    fireEvent.click(matchedCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=MATCHED'),
        expect.anything()
      )
    })
  })

  it('changes date mode seamlessly (กำหนดเอง / เดือน / ปีงบประมาณ)', async () => {
    render(<DisabilityServicesClient initialData={mockInitialData} />)

    const monthTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthTab)
    expect(screen.getByText('เลือกเดือน:')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByText('เลือกปีงบประมาณ:')).toBeInTheDocument()
  })

  it('opens detail modal upon clicking patient row directly without separate view button', async () => {
    render(<DisabilityServicesClient initialData={mockInitialData} />)

    const patientRow = screen.getByText('0012345').closest('tr')
    expect(patientRow).toBeInTheDocument()

    fireEvent.click(patientRow!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(
        screen.getByText('การเปรียบเทียบข้อมูลบริการ (HOSxP vs Web Disability)')
      ).toBeInTheDocument()
      expect(
        screen.getByText('รายการการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability')
      ).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลการชดเชยค่าบริการและการเงิน')).toBeInTheDocument()
      expect(
        screen.getByText(/รายการค่าใช้จ่ายและหัตถการใน HOSxP/i)
      ).toBeInTheDocument()
    })
  })

  it('shows ADP mapping warning banner if unmapped', () => {
    const unmappedData: RehabReportResult = {
      ...mockInitialData,
      adpMapping: {
        isMapped: false,
        mappedCount: 0,
        totalTargetCodes: 16,
        items: [],
      },
    }

    render(<DisabilityServicesClient initialData={unmappedData} />)
    expect(
      screen.getByText(/ยังไม่ได้ Map รหัส ADP ฟื้นฟูสมรรถภาพในระบบ:/i)
    ).toBeInTheDocument()
  })
})
