import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FamilyPlanning91Client from '../FamilyPlanning91Client'

// Mock global fetch
const mockReportData = {
  success: true,
  data: {
    ds1: '2024-10-01',
    ds2: '2024-10-31',
    format: 'NEW_ECLAIM',
    serviceOnly: false,
    status: 'ALL',
    cardFilter: 'ALL',
    searchField: 'ALL',
    search: '',
    sortBy: 'vstdate',
    sortOrder: 'desc',
    summary: {
      totalVisits: 12,
      uniquePatients: 10,
      serviceOnlyCount: 9,
      compensatedVisits: 8,
      uncompensatedVisits: 4,
      compensationRate: 66.7,
      totalCompensated: 2400,
      averageCompensated: 300,
      errorCount: 2,
      authenCount: 11,
      noAuthenCount: 1,
      withDxCount: 10,
      withDrugCount: 8,
      totalIncome: 4500,
    },
    adpMapping: {
      isMapped: true,
      mappedCount: 6,
      format: 'NEW_ECLAIM',
      items: [],
    },
    statusOptions: ['-::ยังไม่ได้ส่ง', 'NHSO :: มี Invoice แล้ว'],
    errorOptions: ['ใส่ห่วง แต่ไม่พบหัตถการ'],
    totalCount: 12,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    items: [
      {
        no: 1,
        vn: '670101080001',
        cid: '1529900123456',
        hn: '0001234',
        ptname: 'นาง สมศรี มีสุข',
        sex: 'หญิง',
        age: 28,
        nation: 'ไทย',
        vstdate: '2024-10-15',
        vsttime: '09:30:00',
        cc: 'มาฉีดยาคุมกำเนิด',
        authencode: 'AUTH123456',
        pttypename: 'สิทธิหลักประกันสุขภาพแห่งชาติ',
        pdx: 'Z300',
        dx0: null,
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: '992',
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        icd10: 'Z300',
        diag: 'Z300',
        op: '992',
        oper: '992',
        income: 300,
        doctorname: 'พญ. ใจดี มีเมตตา',
        listname: 'FP003_1:DMPA 150 mg',
        drugname: 'DMPA#1',
        status: 'NHSO :: มี Invoice แล้ว',
        rep: 'REP6710-001',
        compensated: 250,
        errorname: null,
        fund: 'OPBKK',
        subfund: 'FP',
        hasService: true,
        hasAuthen: true,
        hasError: false,
      },
      {
        no: 2,
        vn: '670101080002',
        cid: '1529900987654',
        hn: '0005678',
        ptname: 'นางสาว สมใจ ใฝ่ดี',
        sex: 'หญิง',
        age: 22,
        nation: 'ไทย',
        vstdate: '2024-10-16',
        vsttime: '10:15:00',
        cc: 'ต้องการใส่ห่วงอนามัย',
        authencode: null,
        pttypename: 'สิทธิหลักประกันสุขภาพแห่งชาติ',
        pdx: 'Z301',
        dx0: null,
        dx1: null,
        dx2: null,
        dx3: null,
        dx4: null,
        dx5: null,
        op0: null,
        op1: null,
        op2: null,
        op3: null,
        op4: null,
        op5: null,
        icd10: 'Z301',
        diag: 'Z301',
        op: null,
        oper: null,
        income: 800,
        doctorname: 'นพ. สุขภาพ รักษาดี',
        listname: 'FP001:ห่วงอนามัย TCu380A',
        drugname: null,
        status: '-::ยังไม่ได้ส่ง',
        rep: null,
        compensated: 0,
        errorname: 'ใส่ห่วง แต่ไม่พบหัตถการ',
        fund: null,
        subfund: null,
        hasService: true,
        hasAuthen: false,
        hasError: true,
      },
    ],
  },
}

describe('FamilyPlanning91Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = String(url)
      if (urlStr.includes('vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                header: { vn: '670101080001', hn: '0001234', ptname: 'นาง สมศรี มีสุข' },
                screen: { bps: 120, bpd: 80, pulse: 75, temperature: 36.5, bw: 55 },
                diagnoses: [{ icd10: 'Z300', icd_name: 'General counselling and advice on contraception' }],
                orders: {
                  items: [{ item_name: 'DMPA 150 mg', qty: 1, units: 'vial', sum_price: 250 }],
                },
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockReportData),
      })
    })
  })

  it('renders header, shortened titles, summary cards, and records correctly', async () => {
    render(<FamilyPlanning91Client />)

    // Check title and badges
    expect(screen.queryByText('9.1 วางแผนครอบครัว (FP)')).not.toBeInTheDocument()
    expect(screen.getByText('วางแผนครอบครัวและการป้องกันการตั้งครรภ์')).toBeInTheDocument()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('นาง สมศรี มีสุข')).toBeInTheDocument()
    })

    // Assert KPI Card numbers
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0) // totalVisits
    expect(screen.getByText('พบบริการ ADP')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument() // serviceOnlyCount
    expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument() // compensatedVisits
    expect(screen.getByText('พบข้อควรตรวจสอบ')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0) // errorCount

    // Assert table rows and content
    expect(screen.getByText('นางสาว สมใจ ใฝ่ดี')).toBeInTheDocument()
    expect(screen.getAllByText('ใส่ห่วง แต่ไม่พบหัตถการ').length).toBeGreaterThan(0)
  })

  it('toggles interactive KPI card filter when clicked', async () => {
    render(<FamilyPlanning91Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมศรี มีสุข')).toBeInTheDocument()
    })

    // Click card 'ได้รับชดเชยแล้ว'
    const compensatedCard = screen.getByRole('button', { name: /ได้รับชดเชยแล้ว/ })
    fireEvent.click(compensatedCard)

    // Should re-fetch with cardFilter=COMPENSATED
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED')
      )
    })

    // Click again to toggle back to ALL
    fireEvent.click(compensatedCard)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=ALL')
      )
    })
  })

  it('opens clinical inspection modal when record row is clicked', async () => {
    render(<FamilyPlanning91Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมศรี มีสุข')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('นาง สมศรี มีสุข'))

    // Modal should show
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/รายละเอียดการรับบริการ: VN 670101080001/)).toBeInTheDocument()
    })

    // Switch to clinical tab
    const clinicalTabBtn = screen.getByRole('button', { name: 'เวชระเบียนคลินิก (HOSxP)' })
    fireEvent.click(clinicalTabBtn)

    await waitFor(() => {
      expect(screen.getByText(/General counselling/)).toBeInTheDocument()
      expect(screen.getAllByText(/DMPA 150 mg/).length).toBeGreaterThan(0)
    })

    // Close modal
    const closeBtn = screen.getByLabelText('ปิดหน้าต่าง')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
