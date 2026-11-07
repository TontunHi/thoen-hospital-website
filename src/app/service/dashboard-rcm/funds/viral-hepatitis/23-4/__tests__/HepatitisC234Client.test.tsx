import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HepatitisC234Client from '../HepatitisC234Client'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 9,
  compensatedVisits: 7,
  uncompensatedVisits: 3,
  compensationRate: 70.0,
  totalCompensated: 11200,
  averageCompensated: 1600,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  ucCount: 8,
  ucRate: 80.0,
  withLabCount: 8,
  withLabRate: 80.0,
  seamlessCount: 3,
  totalSeamlessCompensated: 4800,
  totalIncome: 18000,
}

const mockItem = {
  no: 1,
  vn: '691001083000',
  cid: '1529900123456',
  hn: '0012345',
  ptname: 'นายสมชาย ใจดี',
  sex: 'ชาย',
  age: 45,
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH36333',
  maininscl: 'UCS',
  isUc: true,
  pttypename: 'บัตรทอง',
  cc: 'มาตรวจติดตามผลตับอักเสบซี',
  department: 'OPD ทั่วไป',
  clinic: 'อายุรกรรม',
  pdx: 'B182',
  dx0: 'Z711',
  dx1: null,
  dx2: null,
  dx3: null,
  dx4: null,
  dx5: null,
  sdx: 'Z711',
  op0: null,
  op1: null,
  op2: null,
  op3: null,
  op4: null,
  op5: null,
  ops: null,
  income: 1800,
  labresult: 'Detected 1,500,000 IU/mL',
  hasLab: true,
  listname: 'HCV RNA Quantitative (36333)',
  listname1: null,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP-HCV-001',
  compensated: 1600,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'กองทุนเฉพาะ',
  subfund: 'Hepatitis C',
  errorcode: null,
  transactiontype: 'OP',
  status_sm: 'ชดเชยแล้ว',
  rep_sm: 'SM-69-001',
  compensated_sm: 1600,
  isSeamlessCompensated: true,
  address: '123 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
  mobile: '0812345678',
  tel: '054123456',
}

const mockInitialData = {
  title: '23.4 ตรวจยืนยันไวรัสตับ C HCV RNA',
  adpCode: '36333',
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  adpMapping: {
    adpCode: '36333',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '1590001', name: 'HCV RNA Viral Load (36333)', strength: null, nhso_adp_code: '36333' }],
  },
  cardFilter: 'ALL' as const,
  ucOnly: false,
  withLabOnly: false,
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

describe('HepatitisC234Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders title and 8 balanced KPI summary cards correctly', () => {
    render(<HepatitisC234Client initialData={mockInitialData} />)

    expect(screen.getByText('23.4 ตรวจยืนยันไวรัสตับ C HCV RNA')).toBeDefined()
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeDefined()
    expect(screen.getByText('ชดเชยแล้ว')).toBeDefined()
    expect(screen.getByText('ยังไม่ชดเชย / รอส่ง')).toBeDefined()
    expect(screen.getByText('มี Authen Code')).toBeDefined()
    expect(screen.getByText('ไม่มี Authen Code')).toBeDefined()
    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeDefined()
    expect(screen.getByText('มีผลตรวจ Lab (HCV RNA)')).toBeDefined()
    expect(screen.getByText('ชดเชย Seamless')).toBeDefined()
  })

  it('renders table headers and row items without a separate view button column', () => {
    render(<HepatitisC234Client initialData={mockInitialData} />)

    expect(screen.getByText('นายสมชาย ใจดี')).toBeDefined()
    expect(screen.getByText('0012345')).toBeDefined()
    expect(screen.getByText('1529900123456')).toBeDefined()
    expect(screen.getByText('Detected 1,500,000 IU/mL')).toBeDefined()

    // Verify there is NO "ดูข้อมูล" or "รายละเอียด" button in table headers
    expect(screen.queryByText('ดูข้อมูล')).toBeNull()
  })

  it('opens interactive detail modal upon clicking record row', async () => {
    render(<HepatitisC234Client initialData={mockInitialData} />)

    const cell = screen.getByText('นายสมชาย ใจดี')
    fireEvent.click(cell)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
      expect(screen.getByText(/รายละเอียดการตรวจยืนยันไวรัสตับ C HCV RNA/)).toBeDefined()
      expect(screen.getByText('ผลการตรวจทางห้องปฏิบัติการ (HCV RNA)')).toBeDefined()
      expect(screen.getAllByText('Detected 1,500,000 IU/mL').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('สถานะการชดเชยค่าบริการทางการแพทย์')).toBeDefined()
    })
  })

  it('filters via clicking a KPI card', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          ...mockInitialData,
          cardFilter: 'WITH_LAB',
          items: [mockItem],
        },
      }),
    })
    global.fetch = fetchMock

    render(<HepatitisC234Client initialData={mockInitialData} />)

    const withLabCard = screen.getByText('มีผลตรวจ Lab (HCV RNA)').closest('button')
    expect(withLabCard).toBeDefined()
    if (withLabCard) fireEvent.click(withLabCard)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  it('switches date mode between custom, monthly, and fiscal year', () => {
    render(<HepatitisC234Client initialData={mockInitialData} />)

    const monthTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthTab)
    expect(monthTab.classList.contains('active')).toBe(true)

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(fiscalTab.classList.contains('active')).toBe(true)
  })

  it('displays warning banner when ADP 36333 is not mapped', () => {
    const unmappedData = {
      ...mockInitialData,
      adpMapping: {
        adpCode: '36333',
        isMapped: false,
        mappedCount: 0,
        items: [],
      },
    }

    render(<HepatitisC234Client initialData={unmappedData} />)

    expect(screen.getByText('ยังไม่ได้ Map รหัส ADP 36333')).toBeDefined()
  })
})
