import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdpSearchClient from '../AdpSearchClient'
import type { AdpSearchReportResult } from '@/lib/clinical/rcmAdpSearchService'

const mockAdpReport: AdpSearchReportResult = {
  patientType: 'OPD',
  adpCode: '14001',
  ds1: '2024-10-01',
  ds2: '2025-09-30',
  cardFilter: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
  totalCount: 1,
  totalPages: 1,
  summary: {
    totalRecords: 1,
    uniquePatients: 1,
    totalIncome: 100,
    totalCompensated: 80,
    totalDebt: 20,
    compensatedCount: 1,
    uncompensatedCount: 0,
    compensationRate: 100,
    withAuthenCount: 1,
    withoutAuthenCount: 0,
    authenRate: 100,
    ucCount: 1,
    ucRate: 100,
    withOperationCount: 0,
  },
  adpMapping: {
    adpCodes: ['14001'],
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '1540012', name: 'Ferrous Fumarate', strength: '200 mg', nhso_adp_code: '14001' }],
  },
  items: [
    {
      no: 1,
      patientType: 'OPD',
      vn: '6801010001',
      hn: '0012345',
      an: null,
      cid: '1529900123456',
      ptname: 'นาย สมชาย ทดสอบ',
      sex: 'ชาย',
      birthday: '1980-01-01',
      age: 45,
      vstdate: '2025-01-01',
      vsttime: '09:00:00',
      pttype: '10',
      pttypename: 'บัตรทอง',
      nhsoAdpCode: '14001',
      icode: '1540012',
      name: 'Ferrous Fumarate 200 mg',
      income: 100,
      nee: 0,
      compensated: 80,
      isCompensated: true,
      isUc: true,
      hasAuthen: true,
      hasOperation: false,
    },
  ],
}

describe('AdpSearchClient Component with Multi-Select Dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockAdpReport,
      }),
    }) as any
  })

  it('renders header, multi-selector dropdown, and table with initialData', () => {
    render(<AdpSearchClient initialData={mockAdpReport} />)

    expect(screen.getByRole('heading', { level: 1, name: 'ค้นหาจากรหัส ADPCODE' })).toBeInTheDocument()
    // Multi selector trigger displays 14001
    expect(screen.getAllByText('14001').length).toBeGreaterThan(0)
    // Table record rendered
    expect(screen.getByText('สมชาย ทดสอบ')).toBeInTheDocument()
  })

  it('opens multi-selector dropdown and selects an additional ADP code', async () => {
    render(<AdpSearchClient initialData={mockAdpReport} />)

    // Open multi-select dropdown
    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    // Select 12003 option
    const option12003 = screen.getByText('ตรวจ Fasting Plasma Glucose')
    fireEvent.click(option12003)

    // After clicking, 12003 should be added into the selected codes
    await waitFor(() => {
      expect(screen.getAllByText('12003').length).toBeGreaterThan(0)
    })
  })

  it('switches between OPD and IPD patient types', async () => {
    render(<AdpSearchClient initialData={mockAdpReport} />)

    const ipdBtn = screen.getByRole('button', { name: 'ผู้ป่วยใน (IPD)' })
    fireEvent.click(ipdBtn)

    await waitFor(() => {
      expect(ipdBtn).toHaveClass('active')
    })
  })

  it('defaults to SPECC when initialData is null or not provided', async () => {
    render(<AdpSearchClient />)
    await waitFor(() => {
      expect(screen.getAllByText('SPECC').length).toBeGreaterThan(0)
    })
  })
})
