import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ImplantInsertionClient from '../ImplantInsertionClient'

const mockReportData = {
  ds1: '2026-11-01',
  ds2: '2026-11-06',
  reportType: '9.3.1',
  patientType: 'OPD',
  adpCode: 'FP002_1',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    adpCode: 'FP002_1',
    items: [{ icode: '1500001', name: 'Implanon NXT', strength: '68 mg', nhso_adp_code: 'FP002_1' }],
  },
  cardFilter: 'ALL',
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalCases: 25,
    uniquePatients: 24,
    compensatedCases: 20,
    eclaimSentCases: 3,
    unsentCases: 2,
    compensationRate: 80,
    totalCompensated: 60000,
    totalIncome: 75000,
    errorDxCount: 2,
    errorDrugCount: 1,
    hasErrorCount: 2,
    withAuthenCount: 23,
    withoutAuthenCount: 2,
    authenRate: 92,
  },
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '6911060001',
      hn: '0098765',
      cid: '1509900987654',
      ptname: 'นางสาว สมหญิง มั่นคง',
      sex: 'หญิง',
      age: 22,
      vstdate: '2026-11-06',
      vsttime: '08:45:00',
      pttypename: 'UCS:สิทธิบัตรทอง',
      claimcode: 'AUTH999888',
      department: 'แผนกสูติ-นรีเวชกรรม',
      clinic: 'คลินิกวางแผนครอบครัว',
      cc: 'ต้องการฝังยาคุม',
      income: 2500,
      dx: 'Z308, O009',
      op: '9923',
      drug: 'Implanon NXT 68 mg',
      money_eclaim: 2500,
      money_rep: 2500,
      money_invoice: 2500,
      compensated: 2500,
      isCompensated: true,
      errorDx: null,
      errorDrug: null,
      hasError: false,
      rep: 'REP-2026-11',
      status: 'NHSO :: ได้รับ Invoice',
      patientType: 'OPD',
      reportType: '9.3.1',
    },
  ],
}

describe('ImplantInsertionClient Component (9.3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: mockReportData,
      }),
    }))
  })

  it('renders header, title, ADP badge, and summary metrics', async () => {
    render(<ImplantInsertionClient />)

    expect(screen.getByText(/หัวข้อ 9.3.1 รายการฝังยาคุม/)).toBeInTheDocument()
    expect(screen.getAllByText(/FP002_1/).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('นางสาว สมหญิง มั่นคง')).toBeInTheDocument()
    })

    expect(screen.getByText('0098765')).toBeInTheDocument()
    expect(screen.getByText('AUTH999888')).toBeInTheDocument()
    expect(screen.getByText(/24 คน · รายรับ/)).toBeInTheDocument()
  })

  it('switches patient type between OPD and IPD', async () => {
    render(<ImplantInsertionClient />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD')
      )
    })
  })

  it('filters by clicking on a summary card', async () => {
    render(<ImplantInsertionClient />)

    const compensatedCard = screen.getByTitle(/คลิกเพื่อกรองเฉพาะรายการที่ได้รับชดเชยแล้ว/)
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED')
      )
    })
  })

  it('opens audit detail modal when a table row is clicked', async () => {
    render(<ImplantInsertionClient />)

    await waitFor(() => {
      expect(screen.getByText('นางสาว สมหญิง มั่นคง')).toBeInTheDocument()
    })

    const ptNameCell = screen.getByText('นางสาว สมหญิง มั่นคง')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(within(modal).getByText(/รายละเอียดการรับบริการ · นางสาว สมหญิง มั่นคง/)).toBeInTheDocument()
      expect(within(modal).getByText('ต้องการฝังยาคุม')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
