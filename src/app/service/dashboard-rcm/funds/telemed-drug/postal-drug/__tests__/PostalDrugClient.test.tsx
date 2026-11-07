import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PostalDrugClient from '../PostalDrugClient'

const mockSummary = {
  totalVisits: 12,
  uniquePatients: 10,
  compensatedVisits: 8,
  uncompensatedVisits: 4,
  compensationRate: 66.7,
  totalCompensated: 400,
  averageCompensated: 50,
  withAuthenCount: 11,
  withoutAuthenCount: 1,
  authenRate: 91.7,
  ucCount: 10,
  ucRate: 83.3,
  withPriceCount: 12,
  withPriceRate: 100.0,
  withoutPriceCount: 0,
  withoutPriceRate: 0.0,
  totalSumPrice: 600,
  totalIncome: 3500,
}

const mockItem = {
  no: 1,
  vn: '6911070002',
  cid: '3520800222222',
  hn: '0022222',
  ptname: 'นายบุญส่ง ทรงธรรม',
  sex: 'ชาย',
  birthday: '1970-02-20',
  age: 56,
  vstdate: '2026-11-07',
  vsttime: '11:15:00',
  authencode: 'AUTH_DRUG_99',
  maininscl: 'UCS',
  isUc: true,
  pttypename: '74:บัตรทอง ผู้พิการ ในเขต',
  department: 'ส่งยาให้ที่บ้าน',
  clinic: 'อายุรกรรมเฉพาะทาง',
  pdx: 'C349',
  income: 2940,
  sum_price: 50,
  listname: 'ค่าจัดส่งยาทางไปรษณีย์ Health Rider Project code',
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP555',
  compensated: 50,
  isCompensated: true,
  fund: 'OP',
  subfund: 'DRUGP',
}

const mockInitialData = {
  adpCode: 'DRUGP' as const,
  title: '11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์',
  categoryTitle: 'ระบบ Telemedicine & Drug',
  ds1: '2026-11-01',
  ds2: '2026-11-07',
  adpMapping: {
    adpCode: 'DRUGP',
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3002958', name: 'ค่าจัดส่งยาทางไปรษณีย์ Health Rider Project code', strength: '', nhso_adp_code: 'DRUGP' }],
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

describe('PostalDrugClient Component', () => {
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
                vn: '6911070002',
                hn: '0022222',
                screen: {
                  cc: 'ผู้ป่วยขอรับยาทางไปรษณีย์ต่อเนื่อง',
                  bps: 118,
                  bpd: 76,
                  pulse: 70,
                  bw: 60,
                },
                diagnoses: [{ icd10: 'C349', icd_name: 'Malignant neoplasm of bronchus or lung', diagtype_name: 'Principal Dx' }],
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
    render(<PostalDrugClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์')
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('นายบุญส่ง')).toBeInTheDocument()
    expect(screen.getByText('3520800222222')).toBeInTheDocument()
    expect(screen.getByText('AUTH_DRUG_99')).toBeInTheDocument()
  })

  it('filters data when clicking on a summary KPI card', async () => {
    render(<PostalDrugClient initialData={mockInitialData} />)

    const compensatedCard = screen.getByText('ชดเชยแล้ว').closest('.postal-kpi-card')
    expect(compensatedCard).toBeInTheDocument()
    fireEvent.click(compensatedCard!)

    await waitFor(() => {
      expect(compensatedCard).toHaveClass('active')
    })
  })

  it('opens record details modal on row click', async () => {
    render(<PostalDrugClient initialData={mockInitialData} />)

    const row = screen.getByText('นายบุญส่ง').closest('tr')
    expect(row).toBeInTheDocument()
    fireEvent.click(row!)

    await waitFor(() => {
      expect(screen.getByText('รายละเอียดผู้ได้รับการส่งยาทางไปรษณีย์')).toBeInTheDocument()
    })

    expect(screen.getByText('สรุปข้อมูลการรับบริการ')).toBeInTheDocument()

    // Switch to clinical tab
    const clinicalTab = screen.getByText('ข้อมูลทางคลินิก (เวชระเบียน)')
    fireEvent.click(clinicalTab)

    await waitFor(() => {
      expect(screen.getByText('ผู้ป่วยขอรับยาทางไปรษณีย์ต่อเนื่อง')).toBeInTheDocument()
    })
  })
})
