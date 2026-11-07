import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ThalassemiaIpdClient from '../ThalassemiaIpdClient'

const mockSummary = {
  totalCases: 4,
  uniquePatients: 3,
  drugCases: 2,
  drugRate: 50,
  bloodCases: 4,
  bloodRate: 100,
  totalBloodUnits: 9,
  ferritinCases: 3,
  ferritinRate: 75,
  hbHctCases: 4,
  hbHctRate: 100,
  compensatedCases: 3,
  uncompensatedCases: 1,
  compensationRate: 75,
  totalCompensated: 36000,
  averageCompensated: 12000,
  ucCases: 3,
  ucRate: 75,
}

const mockIpdItem = {
  no: 1,
  an: '690001234',
  hn: '0012345',
  cid: '1529900012345',
  ptname: 'นาย ผู้ป่วยใน ใจสู้',
  sex: 'ชาย',
  birthday: '1990-01-01',
  age: 36,
  admdate: '2026-10-10',
  dchdate: '2026-10-14',
  pttypename: 'ประกันสุขภาพถ้วนหน้า',
  ward: 'สามัญชาย',
  icd10: 'D561',
  icd9: '9904',
  drugname: 'Desferrioxamin 500 mg #10',
  hasDrug: true,
  blood: 'Packed Red Cells',
  bloodDate: '2026-10-11',
  bloodQty: 2,
  hasBlood: true,
  ferritinResult: '2400',
  ferritinDate: '2026-10-11',
  hbResult: '6.5',
  hbDate: '2026-10-10',
  hctResult: '19',
  hctDate: '2026-10-10',
  seamless: 'REP_IPD01',
  rep: 'REP_IPD01',
  status: 'ชดเชยแล้ว',
  compensated: 12500,
  isCompensated: true,
  isUc: true,
}

const mockInitialData = {
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  cardFilter: 'ALL' as const,
  search: '',
  sortBy: 'dchdate' as const,
  sortOrder: 'desc' as const,
  page: 1,
  pageSize: 50,
  totalCount: 1,
  totalPages: 1,
  summary: mockSummary,
  items: [mockIpdItem],
}

describe('ThalassemiaIpdClient', () => {
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

  it('renders IPD header, KPI cards, and inpatient table row', () => {
    render(<ThalassemiaIpdClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1, name: /ผู้ป่วยใน Thalassemia/i })).toBeInTheDocument()
    expect(screen.getByText('นาย ผู้ป่วยใน ใจสู้')).toBeInTheDocument()
    expect(screen.getByText('690001234')).toBeInTheDocument()
    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('Desferrioxamin 500 mg #10')).toBeInTheDocument()
  })

  it('filters via clicking KPI card', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockInitialData,
          cardFilter: 'WITH_BLOOD',
        },
      }),
    } as any)

    render(<ThalassemiaIpdClient initialData={mockInitialData} />)

    const bloodCard = screen.getByText('ได้รับการให้เลือด (9904)')
    fireEvent.click(bloodCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('opens inpatient detail modal on row click', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('an-details')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              header: { an: '690001234', hn: '0012345' },
              diagnoses: [{ icd10: 'D561', icdName: 'Beta thalassaemia' }],
              procedures: [{ icd9: '9904', icd9Name: 'Transfusion of packed cells' }],
              orders: [
                {
                  icode: '1000001',
                  itemName: 'LPRC (Leukocyte-Poor Red Cells)',
                  strength: null,
                  qty: 2,
                  units: 'Unit',
                  unitprice: 700,
                  sumPrice: 1400,
                  isDrug: false,
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

    render(<ThalassemiaIpdClient initialData={mockInitialData} />)

    const row = screen.getByText('690001234').closest('tr')
    expect(row).toBeInTheDocument()
    fireEvent.click(row!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/ข้อมูลส่วนบุคคล & สิทธิ/i)).toBeInTheDocument()
    })

    // Switch to orders tab
    const ordersTab = screen.getByText(/รายการยา & การรักษาในเวชระเบียน/i)
    fireEvent.click(ordersTab)

    await waitFor(() => {
      expect(screen.getByText('LPRC (Leukocyte-Poor Red Cells)')).toBeInTheDocument()
    })
  })
})
