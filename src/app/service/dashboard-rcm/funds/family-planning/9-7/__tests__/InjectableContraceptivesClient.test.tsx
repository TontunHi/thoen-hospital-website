import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InjectableContraceptivesClient from '../InjectableContraceptivesClient'

const mockReportData = {
  ds1: '2026-11-01',
  ds2: '2026-11-06',
  reportType: '9.7',
  patientType: 'OPD',
  adpCode: 'FP003_4',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    adpCode: 'FP003_4',
    items: [{ icode: '1500099', name: 'DMPA (Medroxyprogesterone acetate 150 mg/3ml)', strength: '1 vial', nhso_adp_code: 'FP003_4' }],
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
    compensationRate: 80.0,
    totalCompensated: 7500,
    totalIncome: 9500,
    errorDxCount: 1,
    errorDrugCount: 0,
    hasErrorCount: 1,
    withAuthenCount: 23,
    withoutAuthenCount: 2,
    authenRate: 92.0,
  },
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '6911060088',
      hn: '0098765',
      cid: '1509900987654',
      ptname: 'นางสาว สมใจ มุ่งมั่น',
      sex: 'หญิง',
      age: 26,
      vstdate: '2026-11-06',
      vsttime: '10:15:00',
      pttypename: 'UCS:สิทธิบัตรทอง',
      claimcode: 'AUTH998877',
      department: 'แผนกสูติ-นรีเวชกรรม',
      clinic: 'คลินิกวางแผนครอบครัว',
      cc: 'มารับยาฉีดคุมกำเนิดตามนัด DMPA',
      income: 380,
      dx: 'Z304',
      op: null,
      drug: 'DMPA 150 mg/3ml',
      money_eclaim: 380,
      money_rep: 380,
      money_invoice: 380,
      compensated: 380,
      isCompensated: true,
      errorDx: null,
      errorDrug: null,
      hasError: false,
      rep: 'REP-2026-11-04',
      status: 'NHSO :: ได้รับ Invoice',
      patientType: 'OPD',
      reportType: '9.7',
    },
  ],
}

describe('InjectableContraceptivesClient Component (9.7)', () => {
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

  it('renders header, title, ADP badge FP003_4, and summary metrics', async () => {
    render(<InjectableContraceptivesClient />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '9.7 ยาฉีดคุมกำเนิด (Injectable Contraceptives)'
    )
    expect(screen.getAllByText(/FP003_4/).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('นางสาว สมใจ มุ่งมั่น')).toBeInTheDocument()
    })

    expect(screen.getByText('0098765')).toBeInTheDocument()
    expect(screen.getByText('AUTH998877')).toBeInTheDocument()
    expect(screen.getByText(/24 คน · รายรับ/)).toBeInTheDocument()
    expect(screen.getByText('ไม่พบ Dx Z304')).toBeInTheDocument()
  })

  it('switches patient type between OPD and IPD', async () => {
    render(<InjectableContraceptivesClient />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD')
      )
    })
  })

  it('filters by clicking on a summary card', async () => {
    render(<InjectableContraceptivesClient />)

    const compensatedCard = screen.getByTitle(/คลิกเพื่อกรองเฉพาะรายการที่ได้รับชดเชยแล้ว/)
    fireEvent.click(compensatedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED')
      )
    })
  })

  it('opens audit detail modal when a table row is clicked', async () => {
    render(<InjectableContraceptivesClient />)

    await waitFor(() => {
      expect(screen.getByText('นางสาว สมใจ มุ่งมั่น')).toBeInTheDocument()
    })

    const ptNameCell = screen.getByText('นางสาว สมใจ มุ่งมั่น')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(within(modal).getByText(/รายละเอียดการรับบริการ · นางสาว สมใจ มุ่งมั่น/)).toBeInTheDocument()
      expect(within(modal).getByText('มารับยาฉีดคุมกำเนิดตามนัด DMPA')).toBeInTheDocument()
    })

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
