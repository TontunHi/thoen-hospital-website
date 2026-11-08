import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SingleHormonePillClient from '../SingleHormonePillClient'

const mockReportData = {
  ds1: '2026-11-01',
  ds2: '2026-11-06',
  reportType: '9.5',
  patientType: 'OPD',
  adpCode: 'FP003_2',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    adpCode: 'FP003_2',
    items: [{ icode: '1500005', name: 'Exluton (Lynestrenol)', strength: '0.5 mg', nhso_adp_code: 'FP003_2' }],
  },
  cardFilter: 'ALL',
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalCases: 15,
    uniquePatients: 14,
    compensatedCases: 12,
    eclaimSentCases: 2,
    unsentCases: 1,
    compensationRate: 80,
    totalCompensated: 4800,
    totalIncome: 6000,
    errorDxCount: 1,
    errorDrugCount: 1,
    hasErrorCount: 2,
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
      vn: '6911060005',
      hn: '0099881',
      cid: '1509900987654',
      ptname: 'นาง สุภาพร ใจดี',
      sex: 'หญิง',
      age: 26,
      vstdate: '2026-11-06',
      vsttime: '09:15:00',
      pttypename: 'UCS:สิทธิบัตรทอง',
      claimcode: 'AUTH999111',
      department: 'แผนกสูติ-นรีเวชกรรม',
      clinic: 'คลินิกวางแผนครอบครัว',
      cc: 'มารับยาคุมกำเนิดฮอร์โมนเดี่ยวสำหรับให้นมบุตร',
      income: 400,
      dx: 'Z304',
      op: null,
      drug: 'Exluton 0.5 mg',
      money_eclaim: 400,
      money_rep: 400,
      money_invoice: 400,
      compensated: 400,
      isCompensated: true,
      errorDx: null,
      errorDrug: null,
      hasError: false,
      rep: 'REP-2026-11',
      status: 'NHSO :: ได้รับ Invoice',
      patientType: 'OPD',
      reportType: '9.5',
    },
  ],
}

describe('SingleHormonePillClient Component (9.5)', () => {
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

  it('renders header, title 9.5, ADP code FP003_2, and summary metrics', async () => {
    render(<SingleHormonePillClient />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดี่ยว (Progestin-Only Pills)'
    )
    expect(screen.getAllByText(/FP003_2/).length).toBeGreaterThan(0)
    expect(screen.getByText(/ไม่พบ Dx Z304/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นาง สุภาพร ใจดี')).toBeInTheDocument()
    })

    expect(screen.getByText('0099881')).toBeInTheDocument()
    expect(screen.getByText('AUTH999111')).toBeInTheDocument()
    expect(screen.getByText(/14 คน · รายรับ/)).toBeInTheDocument()
  })

  it('switches patient type between OPD and IPD calling the single-hormone-pill endpoint', async () => {
    render(<SingleHormonePillClient />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill'),
        expect.anything()
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD'),
        expect.anything()
      )
    })
  })

  it('filters by clicking on a summary card', async () => {
    render(<SingleHormonePillClient />)

    const compensatedCard = screen.getByTitle(/คลิกเพื่อกรองเฉพาะรายการที่ได้รับชดเชยแล้ว/)
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED'),
        expect.anything()
      )
    })
  })

  it('opens audit detail modal when a table row is clicked', async () => {
    render(<SingleHormonePillClient />)

    await waitFor(() => {
      expect(screen.getByText('นาง สุภาพร ใจดี')).toBeInTheDocument()
    })

    const ptNameCell = screen.getByText('นาง สุภาพร ใจดี')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(within(modal).getByText(/รายละเอียดการรับบริการ · นาง สุภาพร ใจดี/)).toBeInTheDocument()
      expect(within(modal).getByText('มารับยาคุมกำเนิดฮอร์โมนเดี่ยวสำหรับให้นมบุตร')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
