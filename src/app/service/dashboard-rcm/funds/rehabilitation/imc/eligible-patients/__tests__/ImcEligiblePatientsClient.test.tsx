import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ImcEligiblePatientsClient from '../ImcEligiblePatientsClient'
import type {
  ImcItem,
  ImcSummary,
  ImcReportResult,
} from '@/lib/clinical/rcmImcService'

const mockSummary: ImcSummary = {
  totalCases: 3,
  chronicCases: 2,
  chronicRate: 66.7,
  inWebCases: 2,
  inWebRate: 66.7,
  notInWebCases: 1,
  notInWebRate: 33.3,
  compensatedCases: 1,
  compensationRate: 33.3,
  totalCompensated: 12000,
  totalGetprice: 3500,
  totalIncome: 49400,
  uncompensatedCases: 2,
  withAuthenCases: 2,
  withAuthenRate: 66.7,
  noAuthenCases: 1,
  ucCases: 2,
}

const mockItem: ImcItem = {
  no: 1,
  patientType: 'IPD',
  vn: null,
  an: '690001',
  hn: '000001',
  cid: '1529900123456',
  ptname: 'นายสมชาย ใจดี',
  age: 65,
  chronic: 'Y',
  web: 'Y',
  filetype: 'ตรงกันทั้ง 2 ระบบ',
  date: '2026-10-05',
  vstdate: null,
  vsttime: null,
  admdate: '2026-10-01',
  dchdate: '2026-10-05',
  los: 4,
  ward: 'หอผู้ป่วยชาย',
  cc: null,
  prediag: 'Stroke',
  authencode: 'AUTH123456',
  maininscl: 'UCS',
  pttypename: '10:บัตรทอง',
  department: null,
  clinic: null,
  ovstost: null,
  dchstts: 'ทุเลา',
  dchtype: 'แพทย์อนุญาต',
  dx: 'I63.9: Cerebral infarction',
  op: '99.04: Packed cell transfusion',
  adjrw: 1.85,
  income: 12500,
  status: 'NHSO :: มี Invoice แล้ว',
  rep: 'REP2610-001',
  compensated: 12000,
  repSeamless: 'DDSA68103100077,DDSA69093000090',
  compensatedSeamless: 484.41,
  seamlessFunds: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
  seamlessRepItems: [
    {
      rep: 'DDSA68103100077',
      fund: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
      type: 'กิจกรรมบำบัด (รหัสรายบุคคล)',
      collected: 450,
      compensated: 450,
    },
    {
      rep: 'DDSA69093000090',
      fund: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
      type: 'การจ่าย Point เพิ่มเติม กายภาพบำบัด',
      collected: 150,
      compensated: 34.41,
    },
  ],
  getprice: 1500,
  address: '12 ม.1 ต.ล้อมแรด อ.เถิน',
  tel: '0812345678',
  isCompensated: true,
  isUc: true,
}

const mockInitialData: ImcReportResult = {
  categoryTitle: 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์',
  subtopicTitle: 'รายงานบริการผู้ป่วย IMC',
  reportTitle: 'รายชื่อผู้รับบริการตามเกณฑ์ IMC',
  patientType: 'IPD',
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  summary: mockSummary,
  totalCount: 1,
  totalPages: 1,
  page: 1,
  pageSize: 50,
  cardFilter: 'ALL',
  search: '',
  sortBy: 'date',
  sortOrder: 'desc',
  items: [mockItem],
}

describe('ImcEligiblePatientsClient', () => {
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

  it('renders title, breadcrumb, KPI cards, and patient row properly', () => {
    render(<ImcEligiblePatientsClient initialData={mockInitialData} />)

    // Heading
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /รายชื่อผู้รับบริการตามเกณฑ์ IMC/i,
      })
    ).toBeInTheDocument()

    // Patient info in table
    expect(screen.getByText('นายสมชาย')).toBeInTheDocument()
    expect(screen.getByText('ใจดี')).toBeInTheDocument()
    expect(screen.getByText('000001')).toBeInTheDocument()
    expect(screen.getByText('1529900123456')).toBeInTheDocument()
    expect(screen.getByText('690001')).toBeInTheDocument()
    expect(screen.getByText('ขึ้นทะเบียนแล้ว')).toBeInTheDocument()
    expect(screen.getByText('มีใน Web')).toBeInTheDocument()

    // Multiple Reps (e-Claim + Seamless) rendered as Rep-only badges, with + Seamless in compensated cell
    expect(screen.getByText('REP2610-001')).toBeInTheDocument()
    expect(screen.getByText('DDSA68103100077')).toBeInTheDocument()
    expect(screen.getByText('DDSA69093000090')).toBeInTheDocument()
    expect(screen.getByText('+ Seamless 484.41')).toBeInTheDocument()

    // 8 KPI Cards check
    expect(screen.getByText('ผู้รับบริการตามเกณฑ์ IMC ทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ขึ้นทะเบียนโรคเรื้อรัง Stroke')).toBeInTheDocument()
    expect(screen.getByText('บันทึกใน Web IMC แล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ได้บันทึกใน Web IMC')).toBeInTheDocument()
    expect(screen.getByText('ได้รับการชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ได้รับการชดเชย')).toBeInTheDocument()
    expect(screen.getByText('มี ClaimCode')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี ClaimCode')).toBeInTheDocument()
  })

  it('toggles card filter when a KPI card is clicked', async () => {
    render(<ImcEligiblePatientsClient initialData={mockInitialData} />)

    const chronicCard = screen.getByText('ขึ้นทะเบียนโรคเรื้อรัง Stroke').closest('button')
    expect(chronicCard).toBeInTheDocument()

    fireEvent.click(chronicCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=CHRONIC'),
        expect.anything()
      )
    })
  })

  it('toggles patient type (IPD -> OPD)', async () => {
    render(<ImcEligiblePatientsClient initialData={mockInitialData} />)

    const opdTab = screen.getByRole('tab', { name: /ผู้ป่วยนอก \(OPD\)/i })
    expect(opdTab).toBeInTheDocument()

    fireEvent.click(opdTab)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=OPD'),
        expect.anything()
      )
    })
  })

  it('changes date mode seamlessly (กำหนดเอง / เดือน / ปีงบประมาณ)', async () => {
    render(<ImcEligiblePatientsClient initialData={mockInitialData} />)

    const monthTab = screen.getByRole('tab', { name: 'รายเดือน' })
    fireEvent.click(monthTab)
    expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByLabelText('เลือกปีงบประมาณ')).toBeInTheDocument()
  })

  it('opens detail modal upon clicking patient row directly without separate view button', async () => {
    render(<ImcEligiblePatientsClient initialData={mockInitialData} />)

    const patientRow = screen.getByText('000001').closest('tr')
    expect(patientRow).toBeInTheDocument()

    fireEvent.click(patientRow!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(
        screen.getByText(/ข้อมูลการรับบริการและการจำหน่าย \(IPD\)/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/การวินิจฉัยโรคตามเกณฑ์ IMC & หัตถการ/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/การขึ้นทะเบียนโรคเรื้อรัง & ระบบ Web IMC/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/สิทธิ์การรักษาและการชดเชยค่าบริการ/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText('DDSA68103100077, DDSA69093000090')
      ).toBeInTheDocument()
      expect(
        screen.getByText('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')
      ).toBeInTheDocument()
      expect(
        screen.getByText(/กิจกรรมบำบัด \(รหัสรายบุคคล\)/)
      ).toBeInTheDocument()
      expect(
        screen.getByText('ชดเชย 450.00 ฿')
      ).toBeInTheDocument()
    })
  })
})
