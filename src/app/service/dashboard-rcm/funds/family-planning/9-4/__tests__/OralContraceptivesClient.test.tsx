import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OralContraceptivesClient from '../OralContraceptivesClient'

const mockReportData = {
  ds1: '2026-11-01',
  ds2: '2026-11-06',
  reportType: '9.4',
  patientType: 'OPD',
  adpCode: 'FP003_1',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    adpCode: 'FP003_1',
    items: [{ icode: '1500099', name: 'Microgynon 30 ED', strength: '28 tab', nhso_adp_code: 'FP003_1' }],
  },
  cardFilter: 'ALL',
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalCases: 40,
    uniquePatients: 38,
    compensatedCases: 35,
    eclaimSentCases: 3,
    unsentCases: 2,
    compensationRate: 87.5,
    totalCompensated: 8750,
    totalIncome: 10000,
    errorDxCount: 2,
    errorDrugCount: 1,
    hasErrorCount: 2,
    withAuthenCount: 38,
    withoutAuthenCount: 2,
    authenRate: 95,
  },
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '6911060002',
      hn: '0012345',
      cid: '1509900123456',
      ptname: 'นาง สุภาพร สดใส',
      sex: 'หญิง',
      age: 26,
      vstdate: '2026-11-06',
      vsttime: '09:15:00',
      pttypename: 'UCS:สิทธิบัตรทอง',
      claimcode: 'AUTH777666',
      department: 'แผนกผู้ป่วยนอก',
      clinic: 'คลินิกวางแผนครอบครัว',
      cc: 'รับยาคุมกำเนิดชนิดเม็ด',
      income: 250,
      dx: 'Z304',
      op: '',
      drug: 'Microgynon 30 ED 28 tab',
      money_eclaim: 250,
      money_rep: 250,
      money_invoice: 250,
      compensated: 250,
      isCompensated: true,
      errorDx: null,
      errorDrug: null,
      hasError: false,
      rep: 'REP-2026-11-02',
      status: 'NHSO :: ได้รับ Invoice',
      patientType: 'OPD',
      reportType: '9.4',
    },
  ],
}

describe('OralContraceptivesClient Component (9.4)', () => {
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

  it('renders header, title, ADP badge FP003_1, and Dx Z304 card', async () => {
    render(<OralContraceptivesClient />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '9.4 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม (Combined Oral Contraceptive Pills)'
    )
    expect(screen.getAllByText(/FP003_1/).length).toBeGreaterThan(0)

    // Check Dx Z304 in Card 6
    expect(screen.getByText('ไม่พบ Dx Z304')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นาง สุภาพร สดใส')).toBeInTheDocument()
    })

    expect(screen.getByText('0012345')).toBeInTheDocument()
    expect(screen.getByText('AUTH777666')).toBeInTheDocument()
    expect(screen.getByText(/38 คน · รายรับ/)).toBeInTheDocument()
  })

  it('switches patient type between OPD and IPD', async () => {
    render(<OralContraceptivesClient />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD'),
        expect.anything()
      )
    })
  })

  it('filters by clicking on a summary card', async () => {
    render(<OralContraceptivesClient />)

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
    render(<OralContraceptivesClient />)

    await waitFor(() => {
      expect(screen.getByText('นาง สุภาพร สดใส')).toBeInTheDocument()
    })

    const ptNameCell = screen.getByText('นาง สุภาพร สดใส')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(within(modal).getByText(/รายละเอียดการรับบริการ · นาง สุภาพร สดใส/)).toBeInTheDocument()
      expect(within(modal).getByText('รับยาคุมกำเนิดชนิดเม็ด')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
