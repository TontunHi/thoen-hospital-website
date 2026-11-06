import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CcsService1B005Client from '../CcsService1B005Client'

const mockReportData = {
  ds1: '2024-10-01',
  ds2: '2025-09-30',
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3000555', name: 'ตรวจคัดกรอง 1B005', strength: null, nhso_adp_code: '1B005' }],
  },
  compensationFilter: 'ALL',
  searchField: 'ALL',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalVisits: 150,
    uniquePatients: 140,
    compensatedVisits: 120,
    uncompensatedVisits: 30,
    compensationRate: 80.0,
    totalCompensated: 72000,
    averageCompensated: 600.0,
    withAuthenCount: 145,
    withoutAuthenCount: 5,
    withPdxCount: 150,
    withOpCount: 100,
  },
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '671001083000',
      cid: '3520900015322',
      hn: '0134464',
      ptname: 'นาง สมหญิง ทดสอบ',
      age: 42,
      nation: 'ไทย',
      vstdate: '2024-10-01',
      vsttime: '08:30:00',
      authencode: 'AUTH671001',
      pttypename: 'บัตรทอง รพ.เถิน',
      department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
      clinic: 'เวชกรรม',
      pdx: 'Z124',
      dx0: null,
      dx1: null,
      dx2: null,
      dx3: null,
      dx4: null,
      dx5: null,
      op0: '8926',
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      listname: 'ตรวจคัดกรอง 1B005',
      status: 'NHSO :: มี Invoice แล้ว',
      rep: '6710_CCS_001',
      compensated: 600,
      isCompensated: true,
    },
    {
      no: 2,
      vn: '671002091500',
      cid: '3520900015999',
      hn: '0134999',
      ptname: 'นาง สมศรี รอยืนยัน',
      age: 39,
      nation: 'ไทย',
      vstdate: '2024-10-02',
      vsttime: '09:15:00',
      authencode: null,
      pttypename: 'ประกันสังคม',
      department: 'ห้องตรวจสูติ',
      clinic: 'สูตินรีเวช',
      pdx: 'Z124',
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
      listname: 'ตรวจคัดกรอง 1B005',
      status: null,
      rep: null,
      compensated: 0,
      isCompensated: false,
    },
  ],
}

describe('CcsService1B005Client (CCS 1.10 — UI Style Brief)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/service/dashboard-rcm/funds/ccs/vn-details')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              screen: {
                bps: 120,
                bpd: 80,
                pulse: 76,
                temperature: 36.5,
                bw: 55,
                height: 160,
                bmi: 21.5,
              },
              orders: {
                items: [{ item_name: 'ตรวจคัดกรอง 1B005', sum_price: 600 }],
              },
            },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: mockReportData,
        }),
      }
    })
  })

  it('renders header, date tabs, KPI summary cards, and ledger table', async () => {
    render(<CcsService1B005Client />)

    expect(screen.getByText('1.10 บริการ 1B005')).toBeInTheDocument()

    // KPI cards render
    const card = await screen.findByRole('button', { name: /จำนวนรับบริการทั้งหมด/ })
    expect(card).toBeInTheDocument()
    expect(screen.getAllByText('72,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('มี Authen Code')[0]).toBeInTheDocument()

    // Ledger table rows render
    expect(await screen.findByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    expect(screen.getByText('นาง สมศรี รอยืนยัน')).toBeInTheDocument()
    expect(screen.getByText('671001083000')).toBeInTheDocument()
    expect(screen.getByText('0134464')).toBeInTheDocument()
    expect(screen.getAllByText('Z124').length).toBeGreaterThan(0)
  })

  it('renders date tabs in order: กำหนดเอง -> รายเดือน -> ปีงบประมาณ with custom active by default', async () => {
    render(<CcsService1B005Client />)

    await waitFor(() => {
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
      expect(tabs[0]).toHaveTextContent('กำหนดเอง')
      expect(tabs[1]).toHaveTextContent('รายเดือน')
      expect(tabs[2]).toHaveTextContent('ปีงบประมาณ')
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
    })
  })

  it('always displays full Thai Citizen ID formatted without masking toggle', async () => {
    render(<CcsService1B005Client />)

    await waitFor(() => {
      expect(screen.getByText('3-5209-00015-32-2')).toBeInTheDocument()
      expect(screen.getByText('3-5209-00015-99-9')).toBeInTheDocument()
    })

    // Masking toggle button should NOT exist
    expect(screen.queryByRole('button', { name: /แสดงเลขบัตร/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ซ่อนเลขบัตร/ })).not.toBeInTheDocument()
  })

  it('filters by clicking on KPI summary cards', async () => {
    render(<CcsService1B005Client />)

    const compCard = await screen.findByRole('button', { name: /ได้รับการชดเชยแล้ว/ })
    fireEvent.click(compCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('compensationFilter=COMPENSATED')
      )
    })
  })

  it('displays warning banner when ADP 1B005 is not mapped', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockReportData,
          adpMapping: {
            isMapped: false,
            mappedCount: 0,
            items: [],
          },
        },
      }),
    })

    render(<CcsService1B005Client />)

    await waitFor(() => {
      expect(
        screen.getByText(/คุณยังไม่ได้ Map ADP Code/)
      ).toBeInTheDocument()
    })
  })

  it('opens patient inspection modal and fetches clinical details', async () => {
    render(<CcsService1B005Client />)

    await waitFor(() => {
      expect(screen.getByText('671001083000')).toBeInTheDocument()
    })

    const vnBtn = screen.getByText('671001083000')
    fireEvent.click(vnBtn)

    await waitFor(() => {
      expect(
        screen.getByText('เวชระเบียนผู้รับบริการ: นาง สมหญิง ทดสอบ')
      ).toBeInTheDocument()
    })

    // Switch to clinical tab
    const clinicalTabBtn = screen.getByText('เวชระเบียนคลินิก HOSxP')
    fireEvent.click(clinicalTabBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/funds/ccs/vn-details?vn=671001083000')
      )
      expect(screen.getByText(/120\/80 mmHg/)).toBeInTheDocument()
    })
  })
})
