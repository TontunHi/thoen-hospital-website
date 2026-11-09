import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FastingPlasmaGlucoseClient from '../FastingPlasmaGlucoseClient'

const mockSummary = {
  totalVisits: 12,
  uniquePatients: 10,
  compensatedVisits: 8,
  uncompensatedVisits: 4,
  compensationRate: 66.7,
  totalCompensated: 800,
  averageCompensated: 100,
  repeatClaimCount: 2,
  repeatClaimRate: 16.7,
  withAuthenCount: 11,
  withoutAuthenCount: 1,
  authenRate: 91.7,
  ucCount: 10,
  ucRate: 83.3,
  targetAgeCount: 7,
  targetAgeRate: 58.3,
  totalIncome: 1200,
}

const mockItem = {
  no: 1,
  vn: '691001083000',
  cid: '1529900012345',
  hn: '0012345',
  ptname: 'นายสมชาย ใจดี',
  age: 52,
  isTargetAge: true,
  nation: 'ไทย',
  vstdate: '2026-10-01',
  vsttime: '08:30:00',
  authencode: 'AUTH12003',
  maininscl: 'UCS',
  isUc: true,
  pttype_eclaim_id: 'UCS',
  pttypename: 'บัตรทอง ทั่วไป',
  department: 'งานผู้ป่วยนอก',
  clinic: 'ตรวจโรคทั่วไป',
  pdx: 'Z131',
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
  income: 100,
  listname: 'ตรวจระดับน้ำตาลในเลือด Fasting Plasma Glucose',
  listname1: null,
  camedate: '2026-10-02',
  hasRepeatClaim: true,
  status: 'Rep :: มี Rep แล้ว',
  rep: 'REP691001',
  compensated: 100,
  isCompensated: true,
  agency: 'NHSO',
  fund: 'OP_PP',
  subfund: 'SCREENING',
  errorcode: null,
  transactiontype: 'OP',
}

describe('FastingPlasmaGlucoseClient Component (14.5 ADP 12003)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('service-14-5')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              adpCode: '12003',
              title: '14.5 Fasting Plasma Glucose',
              ds1: '2026-10-01',
              ds2: '2026-10-31',
              summary: mockSummary,
              adpMapping: { adpCode: '12003', isMapped: true, mappedCount: 1, items: [] },
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

  it('renders title, KPI cards, and data table', async () => {
    render(<FastingPlasmaGlucoseClient />)

    expect(screen.getByText('14.5 Fasting Plasma Glucose (FPG)')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    })

    // Check KPI cards
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getAllByText('เคยเคลมในปีงบ').length).toBeGreaterThan(0)
    expect(screen.getByText('มีรหัส ClaimCode')).toBeInTheDocument()

    // Check table headers
    expect(screen.getAllByText('HN').length).toBeGreaterThan(0)
    expect(screen.getAllByText('เลขบัตรประชาชน').length).toBeGreaterThan(0)
    expect(screen.getByText('ชื่อ-สกุลผู้รับบริการ')).toBeInTheDocument()
  })

  it('filters data when clicking KPI cards', async () => {
    render(<FastingPlasmaGlucoseClient />)

    await waitFor(() => {
      expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    })

    const repeatClaimBtn = screen.getByRole('button', { name: /ตัวกรอง: เคยเคลมในปีงบประมาณ/ })
    fireEvent.click(repeatClaimBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=REPEAT_CLAIM'),
        expect.anything()
      )
    })
  })

  it('opens detail modal when clicking a row', async () => {
    render(<FastingPlasmaGlucoseClient />)

    await waitFor(() => {
      expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    })

    // Click on row
    const patientCell = screen.getByText('นายสมชาย ใจดี')
    fireEvent.click(patientCell)

    await waitFor(() => {
      expect(screen.getByText('รายละเอียดการรับบริการ FPG (12003)')).toBeInTheDocument()
    })
  })

  it('hydrates immediately from SSR initialData without redundant mount fetch', async () => {
    render(
      <FastingPlasmaGlucoseClient
        initialData={{
          adpCode: '12003',
          title: '14.5 Fasting Plasma Glucose',
          ds1: '2025-10-01',
          ds2: '2026-09-30',
          fiscalStartYear: '2025-10-01',
          adpMapping: { adpCode: '12003', isMapped: true, mappedCount: 1, items: [] },
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

    expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()

    const repeatClaimBtn = screen.getByRole('button', { name: /ตัวกรอง: เคยเคลมในปีงบประมาณ/ })
    fireEvent.click(repeatClaimBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})
