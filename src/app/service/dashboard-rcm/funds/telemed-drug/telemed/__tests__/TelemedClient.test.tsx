import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TelemedClient from '../TelemedClient'

const mockSummary = {
  totalVisits: 10,
  uniquePatients: 8,
  compensatedVisits: 6,
  uncompensatedVisits: 4,
  compensationRate: 60.0,
  totalCompensated: 300,
  averageCompensated: 50,
  withAuthenCount: 9,
  withoutAuthenCount: 1,
  authenRate: 90.0,
  ucCount: 8,
  ucRate: 80.0,
  withPriceCount: 7,
  withPriceRate: 70.0,
  exportCode5Count: 6,
  exportCode5Rate: 60.0,
  totalSumPrice: 350,
  totalIncome: 1200,
}

const mockItem = {
  no: 1,
  vn: '6911070001',
  cid: '3520800111111',
  hn: '0011111',
  ptname: 'นายสมชาย ชาญชัย',
  sex: 'ชาย',
  birthday: '1980-01-01',
  age: 46,
  vstdate: '2026-11-07',
  vsttime: '09:00:00',
  ovstist: '5:บริการสาธารณสุขทางไกล',
  ovstist_export_code: '5',
  authencode: 'AUTH_TEL_01',
  maininscl: 'UCS',
  isUc: true,
  pttypename: '74:บัตรทอง',
  hospmain: '11152',
  hospsub: '11152',
  department: 'Telemed',
  clinic: 'ตรวจโรคทั่วไป',
  pdx: 'I10',
  income: 150,
  sum_price: 50,
  listname: 'ค่าให้บริการ Telemedicine Project code',
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP123',
  compensated: 50,
  isCompensated: true,
  fund: 'OP',
  subfund: 'TELMED',
}

const mockInitialData = {
  adpCode: 'TELMED' as const,
  title: '11.53 รายชื่อผู้ได้รับบริการ TelMed',
  categoryTitle: 'ระบบ Telemedicine & Drug',
  ds1: '2026-11-01',
  ds2: '2026-11-07',
  adpMapping: {
    adpCode: 'TELMED',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3002608', name: 'ค่าให้บริการ Telemedicine Project code', strength: '', nhso_adp_code: 'TELMED' }],
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

describe('TelemedClient Component', () => {
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
                vn: '6911070001',
                hn: '0011111',
                screen: {
                  cc: 'ติดตามอาการความดันโลหิตสูงผ่านระบบ Telemed',
                  bps: 124,
                  bpd: 82,
                  pulse: 74,
                  bw: 68,
                },
                diagnoses: [{ icd10: 'I10', icd_name: 'Essential (primary) hypertension', diagtype_name: 'Principal Dx' }],
                orders: { items: [], categories: [], total_price: 0, total_items: 0, total_paid: 0, total_claim: 0 },
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockInitialData }),
      })
    })
  })

  it('renders title, summary statistics cards, and records table without skeleton on first paint', () => {
    render(<TelemedClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('11.53 รายชื่อผู้ได้รับบริการ TelMed')
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('นายสมชาย')).toBeInTheDocument()
    expect(screen.getByText('3520800111111')).toBeInTheDocument()
    expect(screen.getByText('AUTH_TEL_01')).toBeInTheDocument()
  })

  it('switches date selector modes between custom, monthly, and fiscal year cleanly', () => {
    render(<TelemedClient initialData={mockInitialData} />)

    const monthlyTab = screen.getByRole('tab', { name: 'เดือน' })
    fireEvent.click(monthlyTab)
    expect(monthlyTab).toHaveClass('active')

    const fiscalTab = screen.getByRole('tab', { name: 'ปีงบประมาณ' })
    fireEvent.click(fiscalTab)
    expect(fiscalTab).toHaveClass('active')
  })

  it('filters data when clicking on a summary KPI card', async () => {
    render(<TelemedClient initialData={mockInitialData} />)

    const compensatedCard = screen.getByText('ชดเชยแล้ว').closest('.telemed-kpi-card')
    expect(compensatedCard).toBeInTheDocument()
    fireEvent.click(compensatedCard!)

    await waitFor(() => {
      expect(compensatedCard).toHaveClass('active')
    })
  })

  it('opens record details modal on row click without extra action button clutter', async () => {
    render(<TelemedClient initialData={mockInitialData} />)

    const row = screen.getByText('นายสมชาย').closest('tr')
    expect(row).toBeInTheDocument()
    fireEvent.click(row!)

    await waitFor(() => {
      expect(screen.getByText('รายละเอียดการรับบริการ TelMed')).toBeInTheDocument()
    })

    expect(screen.getByText('สรุปข้อมูลการรับบริการ')).toBeInTheDocument()

    // Switch to clinical tab
    const clinicalTab = screen.getByText('ข้อมูลทางคลินิก (เวชระเบียน)')
    fireEvent.click(clinicalTab)

    await waitFor(() => {
      expect(screen.getByText('ติดตามอาการความดันโลหิตสูงผ่านระบบ Telemed')).toBeInTheDocument()
    })
  })
})
