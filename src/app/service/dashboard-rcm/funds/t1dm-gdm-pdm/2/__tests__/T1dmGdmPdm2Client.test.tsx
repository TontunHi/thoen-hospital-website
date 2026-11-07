import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import T1dmGdmPdm2Client from '../T1dmGdmPdm2Client'
import type { T1dmGdmPdmRecipientItem, T1dmGdmPdmSummary } from '@/lib/clinical/rcmT1dmGdmPdmService'

const mockSummary: T1dmGdmPdmSummary = {
  totalCases: 5,
  uniquePatients: 4,
  registeredCases: 3,
  registeredRate: 60,
  notRegisteredCases: 2,
  notRegisteredRate: 40,
  compensatedCases: 4,
  compensationRate: 80,
  totalCompensated: 9600,
  averageCompensated: 2400,
  uncompensatedCases: 1,
  withAuthenCases: 4,
  withAuthenRate: 80,
  noAuthenCases: 1,
  ucCases: 3,
  ucRate: 60,
}

const mockItem: T1dmGdmPdmRecipientItem = {
  no: 1,
  vn: '691015123456',
  hn: '0012345',
  cid: '1529900012345',
  ptname: 'นาง สุภาวรรณ ใจงาม',
  sex: 'หญิง',
  birthday: '1998-04-12',
  age: 28,
  nation: 'ไทย',
  tel: '0812345678',
  ok: 'Y',
  isRegistered: true,
  type: 'GDM',
  regdate: '2026-10-05',
  vstdate: '2026-10-15',
  vsttime: '09:30:00',
  lmp: '2026-03-01',
  authencode: 'AUTH1234',
  pttypenamePatient: 'ประกันสุขภาพถ้วนหน้า',
  pttypenameVisit: 'ประกันสุขภาพถ้วนหน้า',
  maininscl: 'UCS',
  department: 'ห้องตรวจสูตินรีเวชกรรม',
  clinic: 'สูตินรีเวชกรรม',
  pdx: 'O244',
  dx0: 'Z340',
  dx1: null,
  dx2: null,
  dx3: null,
  dx4: null,
  dx5: null,
  op0: '8876',
  op1: null,
  op2: null,
  op3: null,
  op4: null,
  op5: null,
  allDx: ['O244', 'Z340'],
  allOp: ['8876'],
  status: 'มี Rep แล้ว',
  rep: 'REP001',
  compensated: 2400,
  isCompensated: true,
  fund: 'O24',
  subfund: 'GDM',
  isUc: true,
}

const mockInitialData = {
  categoryTitle: 'กองทุน T1DM/GDM/PDM',
  reportTitle: 'รายชื่อผู้รับบริการ',
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  cardFilter: 'ALL' as const,
  search: '',
  sortBy: 'vstdate' as const,
  sortOrder: 'desc' as const,
  page: 1,
  pageSize: 50,
  totalCount: 1,
  totalPages: 1,
  summary: mockSummary,
  items: [mockItem],
}

describe('T1dmGdmPdm2Client', () => {
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

  it('renders title, KPI cards, and patient row properly', () => {
    render(<T1dmGdmPdm2Client initialData={mockInitialData} />)

    expect(
      screen.getByRole('heading', { level: 1, name: /รายชื่อผู้รับบริการ กองทุน T1DM\/GDM\/PDM/i })
    ).toBeInTheDocument()
    expect(screen.getByText('นาง สุภาวรรณ')).toBeInTheDocument()
    expect(screen.getByText('ใจงาม')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900012345')).toBeInTheDocument()
    expect(screen.getByText('O244')).toBeInTheDocument()
    expect(screen.getByText('GDM')).toBeInTheDocument()
  })

  it('toggles card filter when a KPI card is clicked', async () => {
    render(<T1dmGdmPdm2Client initialData={mockInitialData} />)

    const registeredCard = screen.getByText('ลงทะเบียนแล้ว').closest('.dm-kpi-card')
    expect(registeredCard).toBeInTheDocument()

    fireEvent.click(registeredCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=REGISTERED'),
        expect.anything()
      )
    })
  })

  it('changes date mode seamlessly (กำหนดเอง / เดือน / ปีงบประมาณ)', async () => {
    render(<T1dmGdmPdm2Client initialData={mockInitialData} />)

    const monthTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthTab)
    expect(screen.getByText('เลือกเดือน:')).toBeInTheDocument()

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(screen.getByText('เลือกปีงบประมาณ:')).toBeInTheDocument()
  })

  it('opens detail modal upon clicking patient row directly without separate view button', async () => {
    render(<T1dmGdmPdm2Client initialData={mockInitialData} />)

    const patientRow = screen.getByText('0012345').closest('tr')
    expect(patientRow).toBeInTheDocument()

    fireEvent.click(patientRow!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/ข้อมูลเวชระเบียน & การชดเชย/i)).toBeInTheDocument()
      expect(screen.getByText('รหัสโรคและการวินิจฉัย (PDX/DX/OP)')).toBeInTheDocument()
    })
  })
})
