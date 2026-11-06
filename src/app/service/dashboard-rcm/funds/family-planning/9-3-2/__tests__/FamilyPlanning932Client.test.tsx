import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FamilyPlanning932Client from '../FamilyPlanning932Client'

const mockReportData = {
  success: true,
  data: {
    ds1: '2026-11-01',
    ds2: '2026-11-06',
    format: 'NEW_ECLAIM',
    adpCodes: ['FP001', 'FP002'],
    adpMapping: {
      isMapped: true,
      mappedCount: 2,
      adpCodes: ['FP001', 'FP002'],
      items: [
        { icode: '3000798', name: 'ห่วงอนามัย', strength: null, nhso_adp_code: 'FP001' },
        { icode: '3000799', name: 'ยาฝังคุมกำเนิด', strength: null, nhso_adp_code: 'FP002' },
      ],
    },
    cardFilter: 'ALL',
    searchField: 'ALL',
    search: '',
    sortBy: 'vstdate',
    sortOrder: 'desc',
    summary: {
      totalCases: 2,
      uniquePatients: 2,
      totalIncome: 4300,
      totalCompensated: 2000,
      totalCompensatedEclaim: 2000,
      totalCompensatedRep: 2000,
      totalCompensatedNhso: 2000,
      compensatedCount: 1,
      uncompensatedCount: 1,
      compensationRate: 50,
      eclaimSentCount: 1,
      unsentCount: 1,
      withAuthenCount: 1,
      noAuthenCount: 1,
      authenRate: 50,
      withDrugCount: 2,
      withServiceCount: 1,
      hasErrorCount: 1,
    },
    pagination: {
      page: 1,
      pageSize: 50,
      totalItems: 2,
      totalPages: 1,
    },
    items: [
      {
        no: 1,
        vn: '6911060001',
        an: null,
        cid: '1509900111111',
        hn: '0000001',
        ptname: 'นาง สมใจ ดีงาม',
        sex: 'หญิง',
        age: 26,
        vstdate: '2026-11-06',
        vsttime: '09:00:00',
        pttypename: 'UCS:สิทธิบัตรทอง',
        authencode: 'AUTH001',
        department: 'แผนกสูติฯ',
        clinic: 'คลินิกวางแผนครอบครัว',
        income: 2500,
        drugname: 'ยาฝังคุมกำเนิด Implanon',
        listname: 'บริการฝังยาคุมกำเนิด',
        adpcode: 'FP002',
        dx: 'Z308',
        op: '992',
        status: 'Rep :: ได้รับ Rep แล้ว',
        rep_eclaim: 'E69001',
        rep_rep: 'REP69001',
        rep_nhso: 'INV69001',
        compensated_eclaim: 2000,
        compensated_rep: 2000,
        compensated_nhso: 2000,
        compensated: 2000,
        isCompensated: true,
        hasAuthen: true,
        hasDrug: true,
        hasService: true,
        hasError: false,
        errorDetail: null,
      },
      {
        no: 2,
        vn: '6911060002',
        an: null,
        cid: '1509900222222',
        hn: '0000002',
        ptname: 'นางสาว สมศรี รักเรียน',
        sex: 'หญิง',
        age: 22,
        vstdate: '2026-11-06',
        vsttime: '10:30:00',
        pttypename: 'UCS:สิทธิบัตรทอง',
        authencode: null,
        department: 'แผนกสูติฯ',
        clinic: 'คลินิกวางแผนครอบครัว',
        income: 1800,
        drugname: 'Norplant 6 หลอด',
        listname: null,
        adpcode: 'FP001',
        dx: null,
        op: null,
        status: '- :: ยังไม่ได้ส่ง',
        rep_eclaim: null,
        rep_rep: null,
        rep_nhso: null,
        compensated_eclaim: 0,
        compensated_rep: 0,
        compensated_nhso: 0,
        compensated: 0,
        isCompensated: false,
        hasAuthen: false,
        hasDrug: true,
        hasService: false,
        hasError: true,
        errorDetail: 'ไม่พบการลงรหัส Dx',
      },
    ],
  },
}

describe('FamilyPlanning932Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('service-9-3-2')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockReportData),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      })
    })
  })

  it('renders page title, subtitle, badges, and KPI summary cards', async () => {
    render(<FamilyPlanning932Client />)

    // Title and Header
    expect(
      screen.getByText('9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/กองทุนบริการวางแผนครอบครัว \(FP\) • ข้อ 9\.3\.2/)
    ).toBeInTheDocument()

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('นาง สมใจ ดีงาม')).toBeInTheDocument()
    })

    // Check KPI Cards
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ได้รับการชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ได้รับการชดเชย')).toBeInTheDocument()
    expect(screen.getByText('มี Authen Code')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี Authen Code')).toBeInTheDocument()
    expect(screen.getByText('พบข้อผิดพลาด')).toBeInTheDocument()

    // Table rows
    expect(screen.getByText('6911060001')).toBeInTheDocument()
    expect(screen.getByText('นางสาว สมศรี รักเรียน')).toBeInTheDocument()
    expect(screen.getByText('1-5099-00111-11-1')).toBeInTheDocument()
  })

  it('toggles interactive KPI card filter when clicked', async () => {
    render(<FamilyPlanning932Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมใจ ดีงาม')).toBeInTheDocument()
    })

    const compensatedCard = screen.getByText('ได้รับการชดเชยแล้ว').closest('.fp-kpi-card')
    expect(compensatedCard).toBeInTheDocument()

    fireEvent.click(compensatedCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED'),
        expect.any(Object)
      )
    })
  })

  it('switches format selector to Krungthai and refreshes data', async () => {
    render(<FamilyPlanning932Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมใจ ดีงาม')).toBeInTheDocument()
    })

    const select = screen.getByTitle('เลือกรูปแบบรหัส ADP') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'KRUNGTHAI' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('format=KRUNGTHAI'),
        expect.any(Object)
      )
    })
  })

  it('handles search input', async () => {
    render(<FamilyPlanning932Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมใจ ดีงาม')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('พิมพ์คำค้นหา...')
    fireEvent.change(searchInput, { target: { value: 'สมศรี' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search='),
        expect.any(Object)
      )
    })
  })
})
