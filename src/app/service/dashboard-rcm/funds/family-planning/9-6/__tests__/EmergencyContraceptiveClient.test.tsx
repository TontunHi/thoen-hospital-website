import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmergencyContraceptiveClient from '../EmergencyContraceptiveClient'

const mockReportData = {
  ds1: '2026-11-01',
  ds2: '2026-11-06',
  reportType: '9.6',
  patientType: 'OPD',
  adpCode: 'FP003_3',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    adpCode: 'FP003_3',
    items: [{ icode: '1500088', name: 'Postinor (Levonorgestrel 0.75 mg)', strength: '2 tab', nhso_adp_code: 'FP003_3' }],
  },
  cardFilter: 'ALL',
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalCases: 18,
    uniquePatients: 17,
    compensatedCases: 14,
    eclaimSentCases: 3,
    unsentCases: 1,
    compensationRate: 77.8,
    totalCompensated: 4200,
    totalIncome: 5400,
    errorDxCount: 1,
    errorDrugCount: 0,
    hasErrorCount: 1,
    withAuthenCount: 17,
    withoutAuthenCount: 1,
    authenRate: 94.4,
  },
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '6911060012',
      hn: '0087654',
      cid: '1509900876543',
      ptname: 'นางสาว กานดา สดใส',
      sex: 'หญิง',
      age: 21,
      vstdate: '2026-11-06',
      vsttime: '11:20:00',
      pttypename: 'UCS:สิทธิบัตรทอง',
      claimcode: 'AUTH667788',
      department: 'แผนกสูติ-นรีเวชกรรม',
      clinic: 'คลินิกวางแผนครอบครัว',
      cc: 'ขอรับยาเม็ดคุมกำเนิดฉุกเฉิน',
      income: 300,
      dx: 'Z304',
      op: null,
      drug: 'Postinor 0.75 mg 2 tab',
      money_eclaim: 300,
      money_rep: 300,
      money_invoice: 300,
      compensated: 300,
      isCompensated: true,
      errorDx: null,
      errorDrug: null,
      hasError: false,
      rep: 'REP-2026-11-02',
      status: 'NHSO :: ได้รับ Invoice',
      patientType: 'OPD',
      reportType: '9.6',
    },
  ],
}

describe('EmergencyContraceptiveClient Component (9.6)', () => {
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

  it('renders header, title, ADP badge FP003_3, and summary metrics', async () => {
    render(<EmergencyContraceptiveClient />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน (Emergency Contraceptive Pills)'
    )
    expect(screen.getAllByText(/FP003_3/).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('นางสาว กานดา สดใส')).toBeInTheDocument()
    })

    expect(screen.getByText('0087654')).toBeInTheDocument()
    expect(screen.getByText('AUTH667788')).toBeInTheDocument()
    expect(screen.getByText(/17 คน · รายรับ/)).toBeInTheDocument()
    expect(screen.getByText('ไม่พบ Dx Z304')).toBeInTheDocument()
  })

  it('switches patient type between OPD and IPD', async () => {
    render(<EmergencyContraceptiveClient />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD')
      )
    })
  })

  it('filters by clicking on a summary card', async () => {
    render(<EmergencyContraceptiveClient />)

    const compensatedCard = screen.getByTitle(/คลิกเพื่อกรองเฉพาะรายการที่ได้รับชดเชยแล้ว/)
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED')
      )
    })
  })

  it('opens audit detail modal when a table row is clicked', async () => {
    render(<EmergencyContraceptiveClient />)

    await waitFor(() => {
      expect(screen.getByText('นางสาว กานดา สดใส')).toBeInTheDocument()
    })

    const ptNameCell = screen.getByText('นางสาว กานดา สดใส')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(within(modal).getByText(/รายละเอียดการรับบริการ · นางสาว กานดา สดใส/)).toBeInTheDocument()
      expect(within(modal).getByText('ขอรับยาเม็ดคุมกำเนิดฉุกเฉิน')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
