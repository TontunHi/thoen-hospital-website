import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ThalassemiaService31Client from '../ThalassemiaService31Client'

const mockReportData = {
  ds1: '2026-05-01',
  ds2: '2026-05-31',
  cardFilter: 'ALL',
  laborTypeFilter: 'ALL',
  searchField: 'ALL',
  search: '',
  sortBy: 'labor_date',
  sortOrder: 'desc',
  summary: {
    totalMothers: 45,
    screenedCount: 38,
    unscreenedCount: 7,
    screeningRate: 84.4,
    normalCount: 32,
    riskCount: 6,
    pendingCount: 0,
    thoenHospitalCount: 40,
    otherHospitalCount: 5,
    normalLaborCount: 35,
    cesareanLaborCount: 10,
    otherLaborCount: 0,
  },
  adpMapping: {
    isMapped: true,
    mappedCount: 2,
    items: [
      { icode: '3000748', name: 'DCIP', strength: '', nhso_adp_code: '30313' },
      { icode: '3000227', name: 'Hemoglobin typing', strength: '', nhso_adp_code: '30313' },
    ],
  },
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      person_id: 101,
      ancno: 5001,
      cid: '1520800011111',
      hn: '0055001',
      ptname: 'นาง วิภา สดใส',
      age: 29,
      pttypename: 'บัตรทอง รพ.เถิน',
      address: '15 ม.3 ต.ล้อมแรด',
      labor_date: '2026-05-15',
      labor_type: 'NORMAL',
      labour_type_id: 1,
      hospital: 'โรงพยาบาลเถิน',
      labour_hospcode: '11152',
      preg_no: 1,
      lmp: '2025-08-08',
      edc: '2026-05-15',
      labcode: '2128',
      labname: 'DCIP',
      labresult: 'DCIP: Negative',
      lab_order_date: '2025-10-12',
      ordered_adp_items: 'DCIP',
      has_lab: true,
      lab_status: 'NORMAL',
      is_thoen_hospital: true,
    },
    {
      no: 2,
      person_id: 102,
      ancno: 5002,
      cid: '1520800022222',
      hn: '0055002',
      ptname: 'น.ส. นภา สายลม',
      age: 33,
      pttypename: 'จ่ายตรง',
      address: '88 ม.1 ต.เถินบุรี',
      labor_date: '2026-05-18',
      labor_type: 'CESAREAN',
      labour_type_id: 2,
      hospital: 'โรงพยาบาลเถิน',
      labour_hospcode: '11152',
      preg_no: 2,
      lmp: '2025-08-11',
      edc: '2026-05-18',
      labcode: '2128, 2126',
      labname: 'DCIP, Hemoglobin typing',
      labresult: 'DCIP: Positive | Hb typing: E trait',
      lab_order_date: '2025-10-20',
      ordered_adp_items: 'DCIP, Hemoglobin typing',
      has_lab: true,
      lab_status: 'RISK',
      is_thoen_hospital: true,
    },
  ],
}

describe('ThalassemiaService31Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockReportData }),
      })
    )
  })

  it('renders title, KPI cards, and patient records in table', async () => {
    render(<ThalassemiaService31Client />)

    expect(screen.getByText('3.1 คัดกรองธาลัสซีเมีย')).toBeInTheDocument()
    expect(screen.getByText('หญิงตั้งครรภ์ที่คลอดทั้งหมด')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นาง วิภา สดใส')).toBeInTheDocument()
      expect(screen.getByText('น.ส. นภา สายลม')).toBeInTheDocument()
    })

    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('DCIP: Negative')).toBeInTheDocument()
    expect(screen.getByText('DCIP: Positive | Hb typing: E trait')).toBeInTheDocument()
    expect(screen.getByText('1520800011111')).toBeInTheDocument()
    expect(screen.getByText('1520800022222')).toBeInTheDocument()
  })

  it('allows interactive filtering by clicking on KPI summary cards', async () => {
    render(<ThalassemiaService31Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง วิภา สดใส')).toBeInTheDocument()
    })

    const riskCard = screen.getByRole('button', { name: /ผลผิดปกติ \/ กลุ่มเสี่ยง/ })
    fireEvent.click(riskCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=RISK')
      )
    })
  })

  it('switches date modes between custom, monthly, and fiscal year', async () => {
    render(<ThalassemiaService31Client />)

    const tabs = screen.getAllByRole('button', { name: /กำหนดเอง|รายเดือน|ปีงบประมาณ/ })
    expect(tabs.length).toBeGreaterThanOrEqual(3)

    // Click "รายเดือน"
    fireEvent.click(screen.getByRole('button', { name: 'รายเดือน' }))
    await waitFor(() => {
      expect(screen.getByLabelText('เลือกเดือน')).toBeInTheDocument()
    })

    // Click "กำหนดเอง"
    fireEvent.click(screen.getByRole('button', { name: 'กำหนดเอง' }))
    await waitFor(() => {
      expect(screen.getByLabelText('ตั้งแต่วันที่')).toBeInTheDocument()
    })
  })

  it('opens patient detail modal when clicking on record row', async () => {
    render(<ThalassemiaService31Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง วิภา สดใส')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('นาง วิภา สดใส'))

    await waitFor(() => {
      expect(screen.getByText(/นาง วิภา สดใส \(HN: 0055001\)/)).toBeInTheDocument()
      expect(screen.getByText('ข้อมูลการตั้งครรภ์และการคลอด')).toBeInTheDocument()
      expect(screen.getByText('ผลการตรวจคัดกรองธาลัสซีเมียทางห้องปฏิบัติการ (Lab)')).toBeInTheDocument()
    })
  })
})
