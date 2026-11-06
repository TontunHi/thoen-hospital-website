import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PregnancyTestClient from '../PregnancyTestClient'

const mockReportData = {
  ds1: '2026-05-01',
  ds2: '2026-05-31',
  cardFilter: 'ALL',
  ucOnly: false,
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  adpMapping: {
    isMapped: true,
    mappedCount: 2,
    items: [],
  },
  summary: {
    totalVisits: 2,
    uniquePatients: 2,
    compensatedVisits: 1,
    uncompensatedVisits: 1,
    compensationRate: 50.0,
    totalCompensated: 120.0,
    averageCompensated: 120.0,
    withAuthenCount: 1,
    withoutAuthenCount: 1,
    authenRate: 50.0,
    positiveCount: 1,
    positiveRate: 50.0,
    negativeCount: 1,
    negativeRate: 50.0,
    pendingCount: 0,
    noLabCount: 0,
    ucCount: 1,
    ucRate: 50.0,
    totalIncome: 330.0,
  },
  items: [
    {
      no: 1,
      vn: '6705010001',
      cid: '1520800000001',
      hn: '0010001',
      ptname: 'น.ส. สมฤดี ทดสอบ',
      age: 24,
      vstdate: '2026-05-01',
      vsttime: '08:30:00',
      authencode: 'AUTH1001',
      maininscl: 'UCS',
      isUc: true,
      pttypename: 'UC:ประกันสุขภาพถ้วนหน้า',
      department: 'ผู้ป่วยนอก',
      clinic: 'ตรวจทั่วไป',
      pdx: 'Z320',
      sdx: 'N943',
      income: 180,
      labname: 'Urine Pregnancy Test',
      listname: 'ตรวจการตั้งครรภ์ด้วยชุดทดสอบ',
      lab_order_result: 'Positive',
      labStatus: 'POSITIVE',
      combined_labname: 'Urine Pregnancy Test#Positive',
      status: 'NHSO :: มี Invoice แล้ว',
      rep: 'REP67-001',
      compensated: 120,
      isCompensated: true,
      fund: 'OP',
      subfund: 'P&P',
    },
    {
      no: 2,
      vn: '6705010002',
      cid: '1520800000002',
      hn: '0010002',
      ptname: 'นาง สุภา นามดี',
      age: 30,
      vstdate: '2026-05-02',
      vsttime: '09:15:00',
      authencode: null,
      maininscl: 'SSS',
      isUc: false,
      pttypename: 'SSS:ประกันสังคม',
      department: 'ผู้ป่วยนอก',
      clinic: 'สูติกรรม',
      pdx: 'Z320',
      sdx: null,
      income: 150,
      labname: 'Urine Pregnancy Test',
      listname: null,
      lab_order_result: 'Negative',
      labStatus: 'NEGATIVE',
      combined_labname: 'Urine Pregnancy Test#Negative',
      status: null,
      rep: null,
      compensated: 0,
      isCompensated: false,
      fund: null,
      subfund: null,
    },
  ],
}

describe('PregnancyTestClient Component (8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                header: {
                  vn: '6705010001',
                  hn: '0010001',
                  ptname: 'น.ส. สมฤดี ทดสอบ',
                },
                screen: { bps: 118, bpd: 76, pulse: 78, temperature: 36.6, cc: 'ปวดท้อง' },
                diagnoses: [{ icd10: 'Z320', diagtype: '1', diagtype_name: 'PRINCIPLE DX' }],
                orders: {
                  items: [{ item_name: 'Paracetamol', strength: '500 mg', qty: 10, sum_price: 20 }],
                },
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockReportData }),
      })
    })
  })

  it('renders title, KPI cards, and patient records in table', async () => {
    render(<PregnancyTestClient />)

    expect(screen.getByText(/8.1 การทดสอบการตั้งครรภ์/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('น.ส. สมฤดี ทดสอบ')).toBeInTheDocument()
      expect(screen.getByText('นาง สุภา นามดี')).toBeInTheDocument()
    })

    // Check KPI cards
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ผลบวก (Positive)')).toBeInTheDocument()
    expect(screen.getByText('ผลลบ (Negative)')).toBeInTheDocument()
    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeInTheDocument()
  })

  it('allows interactive filtering by clicking on KPI summary cards', async () => {
    render(<PregnancyTestClient />)

    await waitFor(() => {
      expect(screen.getByText('น.ส. สมฤดี ทดสอบ')).toBeInTheDocument()
    })

    // Click on "ผลบวก (Positive)" card
    const positiveCard = screen.getByText('ผลบวก (Positive)').closest('.preg81-card')
    expect(positiveCard).toBeInTheDocument()

    fireEvent.click(positiveCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=POSITIVE')
      )
    })
  })

  it('switches date modes between fiscal, monthly, and custom', async () => {
    render(<PregnancyTestClient />)

    // Switch to monthly
    const monthlyTab = screen.getByRole('tab', { name: 'รายเดือน' })
    fireEvent.click(monthlyTab)

    expect(monthlyTab).toHaveAttribute('aria-selected', 'true')

    // Switch to custom
    const customTab = screen.getByRole('tab', { name: 'กำหนดเอง' })
    fireEvent.click(customTab)

    expect(customTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('ตั้งแต่วันที่')).toBeInTheDocument()
    expect(screen.getByText('ถึงวันที่')).toBeInTheDocument()
  })

  it('opens clinical detail modal when clicking "ดูข้อมูล"', async () => {
    render(<PregnancyTestClient />)

    await waitFor(() => {
      expect(screen.getByText('น.ส. สมฤดี ทดสอบ')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByRole('button', { name: 'ดูข้อมูล' })
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/ข้อมูลการรับบริการตรวจการตั้งครรภ์/)).toBeInTheDocument()
    })

    // Switch to clinical tab
    const clinicalTab = screen.getByRole('button', { name: 'เวชระเบียนคลินิก & ยา' })
    fireEvent.click(clinicalTab)

    await waitFor(() => {
      expect(screen.getByText(/สัญญาณชีพและอาการสำคัญ/)).toBeInTheDocument()
      expect(screen.getByText(/Paracetamol/)).toBeInTheDocument()
    })
  })

  it('toggles "เฉพาะสิทธิ UC" checkbox filter', async () => {
    render(<PregnancyTestClient />)

    await waitFor(() => {
      expect(screen.getByText('น.ส. สมฤดี ทดสอบ')).toBeInTheDocument()
    })

    const ucCheckbox = screen.getByLabelText(/เฉพาะสิทธิ UC/)
    fireEvent.click(ucCheckbox)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ucOnly=true')
      )
    })
  })
})
