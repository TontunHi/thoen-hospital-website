import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ThalassemiaOpdClient from '../ThalassemiaOpdClient'

const mockSummary = {
  totalCases: 5,
  uniquePatients: 4,
  drugCases: 3,
  drugRate: 60,
  bloodCases: 4,
  bloodRate: 80,
  totalBloodUnits: 8,
  ferritinCases: 3,
  ferritinRate: 60,
  hbHctCases: 5,
  hbHctRate: 100,
  compensatedCases: 4,
  uncompensatedCases: 1,
  compensationRate: 80,
  totalCompensated: 14000,
  averageCompensated: 3500,
  ucCases: 4,
  ucRate: 80,
}

const mockOpdItem = {
  no: 1,
  vn: '691015123456',
  hn: '0012345',
  cid: '1529900012345',
  ptname: 'นาย สมชาย ใจดี',
  sex: 'ชาย',
  birthday: '1995-05-15',
  age: 31,
  vstdate: '2026-10-15',
  vsttime: '09:30:00',
  pttypename: 'ประกันสุขภาพถ้วนหน้า',
  department: 'ห้องตรวจอายุรกรรม',
  clinic: 'อายุรกรรม',
  icd10: 'D561',
  icd9: null,
  drugname: 'Deferasirox 250 mg #30',
  hasDrug: true,
  blood: 'Packed Red Cells',
  bloodDate: '2026-10-15',
  bloodQty: 2,
  hasBlood: true,
  ferritinResult: '1250',
  ferritinDate: '2026-10-15',
  hbResult: '8.5',
  hbDate: '2026-10-15',
  hctResult: '26',
  hctDate: '2026-10-15',
  authencode: 'AUTH1234',
  seamless: 'REP001',
  rep: 'REP001',
  status: 'มี Rep แล้ว',
  compensated: 3500,
  isCompensated: true,
  isUc: true,
}

const mockInitialData = {
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
  items: [mockOpdItem],
}

describe('ThalassemiaOpdClient', () => {
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
    render(<ThalassemiaOpdClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1, name: /ผู้ป่วยนอก Thalassemia/i })).toBeInTheDocument()
    expect(screen.getByText('นาย สมชาย ใจดี')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('1529900012345')).toBeInTheDocument()
    expect(screen.getByText('Deferasirox 250 mg #30')).toBeInTheDocument()
    expect(screen.getByText('Packed Red Cells')).toBeInTheDocument()
  })

  it('filters via clicking a KPI card', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockInitialData,
          cardFilter: 'WITH_DRUG',
        },
      }),
    } as any)

    render(<ThalassemiaOpdClient initialData={mockInitialData} />)

    const drugCard = screen.getByText('ได้รับยาขับธาตุเหล็ก')
    fireEvent.click(drugCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('opens detail modal when row is clicked', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('vn-details')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              header: { vn: '691015123456', hn: '0012345' },
              diagnoses: [],
              orders: [
                {
                  icode: '150001',
                  itemName: 'Deferasirox',
                  strength: '250 mg',
                  qty: 30,
                  units: 'Tab',
                  unitprice: 50,
                  sumPrice: 1500,
                  isDrug: true,
                },
              ],
            },
          }),
        } as any
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: mockInitialData,
        }),
      } as any
    })

    render(<ThalassemiaOpdClient initialData={mockInitialData} />)

    const row = screen.getByText('0012345').closest('tr')
    expect(row).toBeInTheDocument()
    fireEvent.click(row!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/ข้อมูลส่วนบุคคล & สิทธิ/i)).toBeInTheDocument()
    })

    // Switch to orders tab
    const ordersTab = screen.getByText(/รายการเวชระเบียน & ยา/i)
    fireEvent.click(ordersTab)

    await waitFor(() => {
      expect(screen.getByText('Deferasirox')).toBeInTheDocument()
    })
  })
})
