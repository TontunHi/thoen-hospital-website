import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ImplantRemovalClient from '../ImplantRemovalClient'

const mockReportData = {
  ds1: '2026-11-01',
  ds2: '2026-11-06',
  reportType: '9.3.2',
  patientType: 'OPD',
  adpCode: 'FP002_2',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    adpCode: 'FP002_2',
    items: [{ icode: '1500002', name: 'ค่าบริการถอดยาคุมกำเนิด', strength: '', nhso_adp_code: 'FP002_2' }],
  },
  cardFilter: 'ALL',
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalCases: 15,
    uniquePatients: 15,
    compensatedCases: 12,
    eclaimSentCases: 2,
    unsentCases: 1,
    compensationRate: 80,
    totalCompensated: 36000,
    totalIncome: 45000,
    errorDxCount: 1,
    errorDrugCount: 0,
    hasErrorCount: 1,
    withAuthenCount: 14,
    withoutAuthenCount: 1,
    authenRate: 93.3,
  },
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '6911060002',
      hn: '0098766',
      cid: '1509900987655',
      ptname: 'นาง สวย แจ่มใส',
      sex: 'หญิง',
      age: 26,
      vstdate: '2026-11-06',
      vsttime: '09:15:00',
      pttypename: 'UCS:สิทธิบัตรทอง',
      claimcode: 'AUTH999889',
      department: 'แผนกสูติ-นรีเวชกรรม',
      clinic: 'คลินิกวางแผนครอบครัว',
      cc: 'มาถอดยาคุมกำเนิด ครบกำหนด',
      income: 1500,
      dx: 'Z308',
      op: '9771',
      drug: 'ค่าบริการถอดยาคุมกำเนิด',
      money_eclaim: 1500,
      money_rep: 1500,
      money_invoice: 1500,
      compensated: 1500,
      isCompensated: true,
      errorDx: null,
      errorDrug: null,
      hasError: false,
      rep: 'REP-2026-11-2',
      status: 'NHSO :: ได้รับ Invoice',
      patientType: 'OPD',
      reportType: '9.3.2',
    },
  ],
}

describe('ImplantRemovalClient Component (9.3.2)', () => {
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

  it('renders header, title, ADP badge FP002_2, and summary metrics', async () => {
    render(<ImplantRemovalClient />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'รายการถอดยาคุม (Contraceptive Implant Removal)'
    )
    expect(screen.getAllByText(/FP002_2/).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('นาง สวย แจ่มใส')).toBeInTheDocument()
    })

    expect(screen.getByText('0098766')).toBeInTheDocument()
    expect(screen.getByText('AUTH999889')).toBeInTheDocument()
    expect(screen.getByText(/15 คน · รายรับ/)).toBeInTheDocument()
  })

  it('switches patient type between OPD and IPD', async () => {
    render(<ImplantRemovalClient />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD')
      )
    })
  })

  it('filters by clicking on a summary card', async () => {
    render(<ImplantRemovalClient />)

    const compensatedCard = screen.getByTitle(/คลิกเพื่อกรองเฉพาะรายการที่ได้รับชดเชยแล้ว/)
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED')
      )
    })
  })

  it('opens audit detail modal when a table row is clicked', async () => {
    render(<ImplantRemovalClient />)

    await waitFor(() => {
      expect(screen.getByText('นาง สวย แจ่มใส')).toBeInTheDocument()
    })

    const ptNameCell = screen.getByText('นาง สวย แจ่มใส')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(within(modal).getByText(/รายละเอียดการรับบริการ · นาง สวย แจ่มใส/)).toBeInTheDocument()
      expect(within(modal).getByText('มาถอดยาคุมกำเนิด ครบกำหนด')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
