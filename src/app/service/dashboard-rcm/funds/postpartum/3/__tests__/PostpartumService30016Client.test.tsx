import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PostpartumService30016Client from '../PostpartumService30016Client'

describe('PostpartumService30016Client (7.3 การจ่ายยา Triforine ADP 30016)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ds1: '2024-10-01',
          ds2: '2025-09-30',
          adpMapping: {
            isMapped: true,
            mappedCount: 2,
            items: [
              {
                icode: '1540013',
                name: 'triferdine(ไตรเฟอร์ดีน)',
                strength: '0.15+60.18+0.4',
                nhso_adp_code: '30016',
              },
              {
                icode: '3002541',
                name: 'ยาTriferdine หลังคลอด',
                strength: '',
                nhso_adp_code: '30016',
              },
            ],
          },
          compensationFilter: 'ALL',
          searchField: 'ALL',
          sortBy: 'vstdate',
          sortOrder: 'desc',
          summary: {
            totalVisits: 30,
            uniquePatients: 28,
            compensatedVisits: 25,
            uncompensatedVisits: 5,
            compensationRate: 83.3,
            totalCompensated: 9000,
            averageCompensated: 360,
            withAuthenCount: 28,
            withoutAuthenCount: 2,
            withPdxCount: 30,
            withOpCount: 20,
          },
          totalCount: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          items: [
            {
              no: 1,
              vn: '671002083018',
              hn: '0005401',
              cid: '1520800121698',
              ptname: 'น.ส.สิรินทรา พุทธิหน๋อย',
              age: 28,
              nation: 'ไทย',
              vstdate: '2024-10-02',
              vsttime: '08:30:18',
              authencode: 'AUTH_PNC_01',
              pttypename: 'บัตรอนามัยมารดา',
              department: '512 จุดซักประวัติ สูตินารีเวช',
              clinic: 'สูติกรรม',
              pdx: 'Z392',
              dx0: 'Z237',
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
              listname: 'triferdine(ไตรเฟอร์ดีน) 0.15+60.18+0.4',
              listname1: 'Albumin, Glucose',
              status: 'NHSO :: มี Invoice แล้ว',
              rep: '671000033',
              compensated: 360,
              isCompensated: true,
              fund: 'DM14',
              subfund: 'PNC',
            },
            {
              no: 2,
              vn: '671002083019',
              hn: '0005402',
              cid: '1520800999999',
              ptname: 'นางสมหญิง ทดสอบ',
              age: 32,
              nation: 'ไทย',
              vstdate: '2024-10-03',
              vsttime: '09:15:00',
              authencode: null,
              pttypename: 'จ่ายเงินเอง',
              department: '512 จุดซักประวัติ สูตินารีเวช',
              clinic: 'สูติกรรม',
              pdx: 'Z391',
              dx0: null,
              dx1: null,
              dx2: null,
              dx3: null,
              dx4: null,
              dx5: null,
              op0: '9929',
              op1: null,
              op2: null,
              op3: null,
              op4: null,
              op5: null,
              listname: 'triferdine(ไตรเฟอร์ดีน) 0.15+60.18+0.4',
              listname1: null,
              status: null,
              rep: null,
              compensated: 0,
              isCompensated: false,
              fund: null,
              subfund: null,
            },
          ],
        },
      }),
    })
  })

  it('renders header, title, badges, and ADP mapping info correctly', async () => {
    render(<PostpartumService30016Client />)

    expect(screen.getByText('กองทุนการตรวจหลังคลอด (PNC)')).toBeInTheDocument()
    expect(
      screen.getByText('7.3 การจ่ายยา Triforine ADP (รหัสบริการ 30016)')
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/ระบบตรวจพบรายการยาที่ Map รหัส ADP/)).toBeInTheDocument()
      expect(screen.getByText('1540013')).toBeInTheDocument()
      expect(screen.getByText('3002541')).toBeInTheDocument()
    })
  })

  it('renders KPI cards with correct summary numbers and allows clicking to filter', async () => {
    render(<PostpartumService30016Client />)

    await waitFor(() => {
      const allCard = screen.getByRole('button', { name: /ผู้รับบริการทั้งหมด/ })
      expect(allCard).toHaveTextContent('30')
      const compCard = screen.getByRole('button', { name: /ชดเชยค่าบริการแล้ว/ })
      expect(compCard).toHaveTextContent('25')
      const uncompCard = screen.getByRole('button', { name: /ยังไม่ชดเชย/ })
      expect(uncompCard).toHaveTextContent('5')
    })

    // Click on Compensated KPI card to filter
    const compCard = screen.getByRole('button', { name: /ชดเชยค่าบริการแล้ว/ })
    fireEvent.click(compCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('compensationFilter=COMPENSATED')
      )
    })
  })

  it('renders table rows, masked CID, diagnoses, and procedures', async () => {
    render(<PostpartumService30016Client />)

    await waitFor(() => {
      expect(screen.getByText('น.ส.สิรินทรา พุทธิหน๋อย')).toBeInTheDocument()
      expect(screen.getByText('นางสมหญิง ทดสอบ')).toBeInTheDocument()
      expect(screen.getByText('•••1698')).toBeInTheDocument() // Masked CID
      expect(screen.getByText('•••9999')).toBeInTheDocument()
      expect(screen.getByText('Z392')).toBeInTheDocument() // PDx
      expect(screen.getByText('Z391')).toBeInTheDocument()
      expect(screen.getByText('9929')).toBeInTheDocument() // Op0
    })
  })

  it('opens clinical modal when clicking view detail', async () => {
    render(<PostpartumService30016Client />)

    await waitFor(() => {
      expect(screen.getAllByText('ดูรายละเอียด').length).toBeGreaterThan(0)
    })

    const viewDetailBtns = screen.getAllByText('ดูรายละเอียด')
    fireEvent.click(viewDetailBtns[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(
        screen.getByText(/รายละเอียดการรับบริการ VN: 671002083018/)
      ).toBeInTheDocument()
      expect(screen.getByText('ปิดหน้าต่าง')).toBeInTheDocument()
    })

    // Close modal
    fireEvent.click(screen.getByText('ปิดหน้าต่าง'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
