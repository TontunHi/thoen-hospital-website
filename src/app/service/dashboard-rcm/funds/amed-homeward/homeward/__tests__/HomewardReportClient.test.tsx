import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HomewardReportClient from '../HomewardReportClient'
import type { HomewardReportResult, HomewardItem } from '@/lib/clinical/rcmAmedHomewardService'

const mockItem: HomewardItem = {
  no: 1,
  an: '690006884',
  hn: '0048017',
  cid: '1520800099251',
  ptname: 'นาย ประสิทธิ์ แสนสุข',
  sex: 'ชาย',
  birthday: '1970-05-12',
  age: 56,
  nation: '99:ไทย',
  admdate: '2026-10-01',
  dchdate: '2026-10-05',
  los: 4,
  editdate: '2026-10-06 10:00',
  day_diff: 1,
  ward: '04 ห้องพิเศษ',
  bedno: 'V01',
  clinic: 'อายุรกรรม',
  prediag: 'Pneumonia',
  pdx: 'J189',
  pdxname: 'Pneumonia, unspecified',
  sdx: 'I10, E119',
  proc_code: '9604',
  adjrw: 1.5432,
  admdoctor: 'นพ.สมชาย',
  dchdoctor: 'นพ.สมชาย',
  authencode: 'AUTH1111',
  hasAuthen: true,
  pttype_eclaim_id: '01',
  pttype_eclaim_name: 'UC ใน CUP',
  pttype: '77',
  pttypename: 'บัตรทอง ผู้สูงอายุ ในเขต',
  copttype: '77',
  gfmis: '80074',
  accountcode: '1102050101.202',
  pttypeno: 'ท7721768054',
  hospmain: '11152:โรงพยาบาลเถิน',
  hospsub: '06195:รพ.สต.บ้านเด่นแก้ว',
  dchstts: 'Improved',
  dchtype: 'With Approval',
  summary_status: 'สรุปแล้ว',
  income: 12500,
  uc_money: 12000,
  discount_money: 0,
  paid_money: 500,
  rcpt_money: 500,
  rcpno: '500:001',
  debit: 12000,
  max_debt_amount: 12000,
  follow_money: 0,
  bill: 'BILL01#0',
  billdate: '2026-10-05',
  staff: 'เจ้าหน้าที่ ก',
  address: '123 หมู่ 1 ต.ล้อมแรด',
  mobile: '0812345678',
  tel: '054123456',
  rep: 'REP1001',
  rep_remark: 'ผ่านการตรวจสอบ',
  invoice: 'INV2001',
  onweb_cid: '1520800099251',
  anonweb: '690006884',
  isOnAmed: true,
  hasRep: true,
}

const mockInitialData: HomewardReportResult = {
  ds1: '2026-10-01',
  ds2: '2027-09-30',
  cardFilter: 'ALL',
  search: '',
  sortBy: 'dchdate',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
  totalCount: 1,
  totalPages: 1,
  summary: {
    totalCases: 1,
    onAmedCases: 1,
    notOnAmedCases: 0,
    withAuthenCases: 1,
    noAuthenCases: 0,
    withRepCases: 1,
    noRepCases: 0,
    withDebitCases: 1,
    totalIncome: 12500,
    totalDebit: 12000,
    totalAdjrw: 1.5432,
    avgLos: 4,
  },
  items: [mockItem],
}

describe('HomewardReportClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockInitialData,
      }),
    })
  })

  it('renders HOMEWARD header, 8 KPI cards, and patient row', () => {
    render(<HomewardReportClient initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 1, name: /รายงาน HOMEWARD/i })).toBeInTheDocument()
    expect(screen.getByText('ผู้ป่วยทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ลงทะเบียน AMed แล้ว')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่มีใน AMed')).toBeInTheDocument()
    expect(screen.getByText('มี Authen Code')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี Authen Code')).toBeInTheDocument()
    expect(screen.getByText('มี Rep / Invoice แล้ว')).toBeInTheDocument()
    expect(screen.getByText('รอ Rep / Invoice')).toBeInTheDocument()
    expect(screen.getByText('มียอดหนี้ค้างชำระ')).toBeInTheDocument()

    // Patient row data
    expect(screen.getByText('นาย ประสิทธิ์')).toBeInTheDocument()
    expect(screen.getByText('แสนสุข')).toBeInTheDocument()
    expect(screen.getByText('690006884')).toBeInTheDocument()
    expect(screen.getByText('0048017')).toBeInTheDocument()
    expect(screen.getByText('1520800099251')).toBeInTheDocument()
  })

  it('filters via clicking KPI card', async () => {
    render(<HomewardReportClient initialData={mockInitialData} />)

    const amedCard = screen.getByText('ลงทะเบียน AMed แล้ว')
    fireEvent.click(amedCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('opens clinical detail modal on row click without button', async () => {
    render(<HomewardReportClient initialData={mockInitialData} />)

    const row = screen.getByText('690006884').closest('tr')
    fireEvent.click(row!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Pneumonia, unspecified/i)).toBeInTheDocument()
    })

    // Switch to financial tab
    const financialTab = screen.getByText(/สิทธิการรักษา & การเงิน/i)
    fireEvent.click(financialTab)

    await waitFor(() => {
      expect(screen.getByText(/12,500\.00/i)).toBeInTheDocument()
    })

    // Switch to AMed tab
    const amedTab = screen.getByText(/สถานะ AMed & ใบเสร็จ\/REP/i)
    fireEvent.click(amedTab)

    await waitFor(() => {
      expect(screen.getByText('พบข้อมูลบนระบบ AMed')).toBeInTheDocument()
      expect(screen.getAllByText('REP1001').length).toBeGreaterThanOrEqual(1)
    })

    // Close modal
    const closeBtn = screen.getByTitle(/ปิดหน้าต่าง/i)
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
