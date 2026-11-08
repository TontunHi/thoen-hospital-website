import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DentalImplantDensurClient from '../DentalImplantDensurClient'
import type {
  DentalImplantDensurItem,
  DentalImplantSummary,
  DentalImplantReportResult,
} from '@/lib/clinical/rcmDentalImplantService'

const mockSummary: DentalImplantSummary = {
  totalCases: 2,
  uniquePatients: 2,
  compensatedCases: 1,
  uncompensatedCases: 1,
  compensationRate: 50,
  totalCompensated: 3000,
  withAuthenCount: 1,
  withoutAuthenCount: 1,
  authenRate: 50,
  ucCount: 1,
  ucRate: 50,
}

const mockItems: DentalImplantDensurItem[] = [
  {
    no: 1,
    vn: '691001083001',
    cid: '1529900111221',
    hn: '0000001',
    ptname: 'นาย สมชาย ฟันดี',
    sex: 'ชาย',
    age: 35,
    nation: 'ไทย',
    vstdate: '2026-10-01',
    vsttime: '09:00:00',
    authencode: 'AUTH001',
    maininscl: 'UCS',
    isUc: true,
    pttypename: 'บัตรทอง',
    department: 'ทันตกรรม',
    clinic: 'คลินิกทันตกรรม',
    pdx: 'K081',
    dx0: null,
    dx1: null,
    dx2: null,
    dx3: null,
    dx4: null,
    dx5: null,
    op0: '2321',
    op1: null,
    op2: null,
    op3: null,
    op4: null,
    op5: null,
    listname: 'ผ่าตัดใส่รากฟันเทียม DENSUR',
    status: 'ชดเชยแล้ว',
    rep: 'REP001',
    compensated: 3000,
    isCompensated: true,
  },
  {
    no: 2,
    vn: '691001083002',
    cid: '1529900111222',
    hn: '0000002',
    ptname: 'นาง สมศรี มีฟัน',
    sex: 'หญิง',
    age: 42,
    nation: 'ไทย',
    vstdate: '2026-10-02',
    vsttime: '10:30:00',
    authencode: null,
    maininscl: 'OFC',
    isUc: false,
    pttypename: 'ข้าราชการ',
    department: 'ทันตกรรม',
    clinic: 'คลินิกทันตกรรม',
    pdx: 'K081',
    dx0: null,
    dx1: null,
    dx2: null,
    dx3: null,
    dx4: null,
    dx5: null,
    op0: '2321',
    op1: null,
    op2: null,
    op3: null,
    op4: null,
    op5: null,
    listname: 'ผ่าตัดใส่รากฟันเทียม DENSUR',
    status: null,
    rep: null,
    compensated: 0,
    isCompensated: false,
  },
]

const mockInitialData: DentalImplantReportResult = {
  title: 'กองทุนรากฟันเทียม',
  subtitle: 'รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR',
  adpCode: 'DENSUR',
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  adpMapping: {
    adpCode: 'DENSUR',
    isMapped: true,
    mappedCount: 1,
    items: [
      {
        icode: '3000123',
        name: 'บริการผ่าตัดใส่รากฟันเทียม DENSUR',
        strength: null,
        nhso_adp_code: 'DENSUR',
      },
    ],
  },
  cardFilter: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
  totalCount: 2,
  totalPages: 1,
  summary: mockSummary,
  items: mockItems,
}

describe('DentalImplantDensurClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                cc: 'มาตรวจรากฟันเทียม',
                bps: 120,
                bpd: 80,
                pulse: 72,
                doctorName: 'ทพ. รักฟัน มั่นคง',
                department: 'กลุ่มงานทันตกรรม',
              },
            }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockInitialData,
          }),
      })
    })
  })

  it('renders page header and subtitle correctly', () => {
    render(<DentalImplantDensurClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('กองทุนรากฟันเทียม')
    expect(screen.getByText('รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR')).toBeInTheDocument()
  })

  it('renders date mode tabs without parentheses in labels', () => {
    render(<DentalImplantDensurClient initialData={mockInitialData} />)

    expect(screen.getByRole('button', { name: 'กำหนดเอง' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เดือน' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ปีงบประมาณ' })).toBeInTheDocument()

    // Ensure no () in buttons
    expect(screen.queryByText(/\(.*\)/, { selector: '.densur-tab-btn' })).toBeNull()
  })

  it('renders summary cards with correct counts and allows filtering', async () => {
    render(<DentalImplantDensurClient initialData={mockInitialData} />)

    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getAllByText('ชดเชยแล้ว').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('รอชดเชย')).toBeInTheDocument()
    expect(screen.getByText('มี Authen Code')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี Authen Code')).toBeInTheDocument()
    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeInTheDocument()

    // Click card to filter by COMPENSATED
    const compensatedCard = screen.getByTitle('คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว')
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED'),
        expect.anything()
      )
    })
  })

  it('clicking a record row opens the detail modal (no view button in table)', async () => {
    render(<DentalImplantDensurClient initialData={mockInitialData} />)

    // Ensure there is NO "ดูข้อมูล" or "ดูรายละเอียด" button in the table
    expect(screen.queryByRole('button', { name: /ดูข้อมูล|ดูรายละเอียด/ })).toBeNull()

    // Find patient row and click it
    const patientCell = screen.getByText('นาย สมชาย ฟันดี')
    fireEvent.click(patientCell)

    // Detail modal should appear
    await waitFor(() => {
      expect(
        screen.getByText('รายละเอียดบริการผ่าตัดใส่รากฟันเทียม DENSUR')
      ).toBeInTheDocument()
      expect(screen.getByText(/PDX:\s*K081/)).toBeInTheDocument()
      expect(screen.getByText(/OP0:\s*2321/)).toBeInTheDocument()
    })

    // Clinical details fetched lazily
    await waitFor(() => {
      expect(screen.getByText('มาตรวจรากฟันเทียม')).toBeInTheDocument()
      expect(screen.getByText('ทพ. รักฟัน มั่นคง')).toBeInTheDocument()
    })

    // Close modal
    const closeBtns = screen.getAllByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtns[0])

    await waitFor(() => {
      expect(
        screen.queryByText('รายละเอียดบริการผ่าตัดใส่รากฟันเทียม DENSUR')
      ).toBeNull()
    })
  })
})
