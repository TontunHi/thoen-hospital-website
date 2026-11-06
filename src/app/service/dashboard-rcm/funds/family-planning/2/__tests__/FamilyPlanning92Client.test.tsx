import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FamilyPlanning92Client from '../FamilyPlanning92Client'

const mockReportData = {
  success: true,
  data: {
    ds1: '2026-11-01',
    ds2: '2026-11-06',
    patientType: 'OPD',
    adpCodes: ['20003', 'FP001', '71681', '71682'],
    adpMapping: {
      isMapped: true,
      mappedCount: 4,
      adpCodes: ['20003', 'FP001', '71681', '71682'],
      items: [
        { icode: '3000091', name: 'ค่าใส่ห่วง ไม่รวม IUD', strength: null, nhso_adp_code: '71681' },
        { icode: '3000092', name: 'ค่าเอาห่วงออก', strength: null, nhso_adp_code: '71682' },
        { icode: '3000798', name: 'ห่วงอนามัย', strength: null, nhso_adp_code: 'FP001' },
        { icode: '3002556', name: 'ค่าใส่ห่วงIUD (Z301)', strength: null, nhso_adp_code: 'FP001' },
      ],
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
      uncompensatedCases: 3,
      eclaimSentCases: 13,
      unsentCases: 2,
      compensationRate: 80,
      totalCompensated: 18000,
      totalIncome: 22500,
      totalMoneyEclaim: 18000,
      totalMoneyRep: 18000,
      totalMoneyInvoice: 18000,
      errorDxCount: 2,
      errorOpCount: 1,
      errorDrugCount: 1,
      hasErrorCount: 2,
      completeCount: 13,
      withAuthenCount: 14,
      withoutAuthenCount: 1,
      authenRate: 93.3,
    },
    totalCount: 2,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    items: [
      {
        no: 1,
        vn: '6911060001',
        hn: '0012345',
        cid: '1509900123456',
        ptname: 'นาง สมใจ มั่นคง',
        sex: 'หญิง',
        age: 28,
        vstdate: '2026-11-06',
        vsttime: '09:15:00',
        pttypename: 'UCS:สิทธิบัตรทอง',
        claimcode: 'AUTH123456',
        department: 'แผนกสูติ-นรีเวชกรรม',
        clinic: 'คลินิกวางแผนครอบครัว',
        cc: 'ต้องการใส่ห่วงอนามัย',
        income: 1500,
        dx: 'Z301',
        op: '697',
        drug: 'ค่าใส่ห่วง ไม่รวม IUD',
        money_eclaim: 1500,
        money_rep: 1500,
        money_invoice: 1500,
        compensated: 1500,
        isCompensated: true,
        errorDx: null,
        errorOp: null,
        errorDrug: null,
        hasError: false,
        rep: 'REP-2026-11',
        status: 'NHSO :: ได้รับ Invoice',
        patientType: 'OPD',
      },
      {
        no: 2,
        vn: '6911060002',
        hn: '0067890',
        cid: '1509900678901',
        ptname: 'นางสาว ดวงใจ สดใส',
        sex: 'หญิง',
        age: 32,
        vstdate: '2026-11-06',
        vsttime: '10:30:00',
        pttypename: 'UCS:สิทธิบัตรทอง',
        claimcode: null,
        department: 'แผนกสูติ-นรีเวชกรรม',
        clinic: 'คลินิกวางแผนครอบครัว',
        cc: 'มาตรวจหลังใส่ห่วง',
        income: 800,
        dx: 'N943',
        op: null,
        drug: 'ค่าบริการตรวจ',
        money_eclaim: 0,
        money_rep: 0,
        money_invoice: 0,
        compensated: 0,
        isCompensated: false,
        errorDx: 'ไม่พบ Dx Z301',
        errorOp: 'ไม่พบ Op 697',
        errorDrug: null,
        hasError: true,
        rep: null,
        status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
        patientType: 'OPD',
      },
    ],
  },
}

describe('FamilyPlanning92Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReportData,
    }) as any
  })

  it('renders header, title, ADP badge, and summary metrics', async () => {
    render(<FamilyPlanning92Client />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'บริการใส่ห่วงอนามัย (IUD Insertion)'
    )
    expect(screen.getAllByText(/20003, FP001, 71681, 71682/).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument() // Total cases
      expect(screen.getByText('12')).toBeInTheDocument() // Compensated cases
      expect(screen.getByText('นาง สมใจ มั่นคง')).toBeInTheDocument()
      expect(screen.getByText('0012345')).toBeInTheDocument()
    })
  })

  it('toggles patient type between OPD and IPD', async () => {
    render(<FamilyPlanning92Client />)

    const ipdBtn = screen.getByRole('button', { name: /ผู้ป่วยใน \(IPD\)/ })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patientType=IPD')
      )
    })
  })

  it('filters by clicking KPI cards', async () => {
    render(<FamilyPlanning92Client />)

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
    })

    // Click "ชดเชยแล้ว" card
    const compCard = screen.getByText('ชดเชยแล้ว').closest('.fp-kpi-card')
    expect(compCard).toBeTruthy()
    fireEvent.click(compCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED')
      )
    })
  })

  it('opens modal on row click and shows details', async () => {
    render(<FamilyPlanning92Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมใจ มั่นคง')).toBeInTheDocument()
    })

    const row = screen.getByText('นาง สมใจ มั่นคง').closest('tr')
    expect(row).toBeTruthy()
    fireEvent.click(row!)

    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('รายละเอียดบริการ 9.2 & การชดเชย')).toBeInTheDocument()
      expect(within(dialog).getAllByText(/AUTH123456/).length).toBeGreaterThan(0)
    })
  })
})
