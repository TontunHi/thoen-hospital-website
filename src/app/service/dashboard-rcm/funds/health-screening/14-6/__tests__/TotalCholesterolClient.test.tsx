import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TotalCholesterolClient from '../TotalCholesterolClient'

const mockSummary = {
  totalVisits: 15,
  uniquePatients: 12,
  compensatedVisits: 10,
  uncompensatedVisits: 5,
  compensationRate: 66.7,
  totalCompensated: 1200,
  averageCompensated: 120,
  repeatClaimCount: 3,
  repeatClaimRate: 20.0,
  withAuthenCount: 14,
  withoutAuthenCount: 1,
  authenRate: 93.3,
  ucCount: 13,
  ucRate: 86.7,
  targetAgeCount: 11,
  targetAgeRate: 73.3,
  totalIncome: 1800,
}

const mockItem = {
  no: 1,
  vn: '691002094500',
  cid: '1529900067890',
  hn: '0067890',
  ptname: 'นางสมศรี มีสุข',
  age: 48,
  isTargetAge: true,
  nation: 'ไทย',
  vstdate: '2026-10-05',
  vsttime: '09:45:00',
  authencode: 'AUTH12004',
  maininscl: 'UCS',
  isUc: true,
  pttype_eclaim_id: 'UCS',
  pttypename: 'บัตรทอง ทั่วไป',
  department: 'งานผู้ป่วยนอก',
  clinic: 'คลินิกสุขภาพ',
  pdx: 'Z000',
  dx0: null,
  dx1: null,
  dx2: null,
  dx3: null,
  dx4: null,
  dx5: null,
  sdx: null,
  op0: null,
  op1: null,
  op2: null,
  op3: null,
  op4: null,
  op5: null,
  ops: null,
  income: 120,
  listname: 'Total Cholesterol',
  listname1: 'ค่าบริการตรวจทางเทคนิคการแพทย์',
  camedate: null,
  hasRepeatClaim: false,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP691002',
  compensated: 120,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'OP_PP',
  subfund: 'SCREENING',
  errorcode: null,
  transactiontype: 'OP',
}

describe('TotalCholesterolClient Component (14.6 ADP 12004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('service-14-6')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              adpCode: '12004',
              title: '14.6 Total Cholesterol / HDL',
              ds1: '2026-10-01',
              ds2: '2026-10-31',
              summary: mockSummary,
              adpMapping: { adpCode: '12004', isMapped: true, mappedCount: 1, items: [] },
              totalCount: 1,
              totalPages: 1,
              items: [mockItem],
            },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })
    })
  })

  it('renders title, KPI cards (including target age 45-59), and table', async () => {
    render(<TotalCholesterolClient />)

    expect(screen.getByText('14.6 Total Cholesterol / HDL (อายุ 45-59 ปี)')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นางสมศรี มีสุข')).toBeInTheDocument()
    })

    // Check KPI cards
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('กลุ่มอายุ 45-59 ปี')).toBeInTheDocument()
    expect(screen.getAllByText('เคยเคลมในปีงบ').length).toBeGreaterThan(0)

    // Check listname1 header and row content
    expect(screen.getByText('รายการค่าบริการอื่นๆ')).toBeInTheDocument()
    expect(screen.getByText('ค่าบริการตรวจทางเทคนิคการแพทย์')).toBeInTheDocument()
  })

  it('filters by target age 45-59 when clicking target age KPI card', async () => {
    render(<TotalCholesterolClient />)

    await waitFor(() => {
      expect(screen.getByText('นางสมศรี มีสุข')).toBeInTheDocument()
    })

    const targetAgeBtn = screen.getByRole('button', { name: /ตัวกรอง: กลุ่มเป้าหมายอายุ 45-59 ปี/ })
    fireEvent.click(targetAgeBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=TARGET_AGE'),
        expect.anything()
      )
    })
  })

  it('opens detail modal when clicking a table row', async () => {
    render(<TotalCholesterolClient />)

    await waitFor(() => {
      expect(screen.getByText('นางสมศรี มีสุข')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('นางสมศรี มีสุข'))

    await waitFor(() => {
      expect(screen.getByText('รายละเอียดการรับบริการ Total Cholesterol (12004)')).toBeInTheDocument()
    })
  })

  it('hydrates immediately from SSR initialData without redundant mount fetch', async () => {
    render(
      <TotalCholesterolClient
        initialData={{
          adpCode: '12004',
          title: '14.6 Total Cholesterol / HDL',
          ds1: '2025-10-01',
          ds2: '2026-09-30',
          fiscalStartYear: '2025-10-01',
          adpMapping: { adpCode: '12004', isMapped: true, mappedCount: 1, items: [] },
          cardFilter: 'ALL',
          ucOnly: false,
          targetAgeOnly: false,
          searchField: 'ALL',
          search: '',
          sortBy: 'vstdate',
          sortOrder: 'desc',
          summary: mockSummary,
          totalCount: 1,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          items: [mockItem],
        }}
      />
    )

    expect(screen.getByText('นางสมศรี มีสุข')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()

    const targetAgeBtn = screen.getByRole('button', { name: /ตัวกรอง: กลุ่มเป้าหมายอายุ 45-59 ปี/ })
    fireEvent.click(targetAgeBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})
