import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AncService30011Client from '../AncService30011Client'

describe('AncService30011Client (ANC Page 2.4 บริการฝากครรภ์ 30011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpMapping: {
            isMapped: true,
            mappedCount: 1,
            items: [
              {
                icode: '3002538',
                name: 'ค่าฝากครรภ์ ครั้งที่ 1-8 (30011)',
                strength: null,
                nhso_adp_code: '30011',
              },
            ],
          },
          compensationFilter: 'ALL',
          searchField: 'ALL',
          sortBy: 'vstdate',
          sortOrder: 'desc',
          summary: {
            totalVisits: 25,
            uniquePatients: 24,
            compensatedVisits: 20,
            uncompensatedVisits: 5,
            compensationRate: 80.0,
            totalCompensated: 7200,
            averageCompensated: 360,
            withAuthenCount: 22,
            withoutAuthenCount: 3,
            withPdxCount: 25,
            withOpCount: 18,
          },
          totalCount: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          items: [
            {
              no: 1,
              vn: '691005081912',
              hn: '0001755',
              cid: '1520800120977',
              ptname: 'น.ส.วิภาวรรณ์ ปั๋นปาละ',
              age: 30,
              nation: 'ไทย',
              vstdate: '2026-10-05',
              vsttime: '08:19:12',
              authencode: 'AUTH_ANC_01',
              pttypename: 'บัตรอนามัยมารดา',
              department: '512 จุดซักประวัติ สูตินารีเวช',
              clinic: 'สูติกรรม',
              pdx: 'Z348',
              dx0: 'Z133',
              dx1: null,
              dx2: null,
              dx3: null,
              dx4: null,
              dx5: null,
              op0: '8878',
              op1: null,
              op2: null,
              op3: null,
              op4: null,
              op5: null,
              listname: 'ค่าฝากครรภ์ ครั้งที่ 1-8 30011',
              listname1: 'Sugar, Albumin, Ultrasound',
              status: 'Rep :: มี Rep แล้ว',
              rep: '691000048',
              compensated: 360,
              isCompensated: true,
              fund: 'DM14,DM22',
              subfund: 'ANC,PP_ANC_PNC',
            },
            {
              no: 2,
              vn: '691005081913',
              hn: '0001756',
              cid: '1520800120978',
              ptname: 'นาง สุรีย์พร วงศ์ใหญ่',
              age: 28,
              nation: 'ไทย',
              vstdate: '2026-10-06',
              vsttime: '09:20:00',
              authencode: null,
              pttypename: 'ประกันสังคม',
              department: '512 จุดซักประวัติ สูตินารีเวช',
              clinic: 'สูติกรรม',
              pdx: 'Z340',
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
              listname: 'ค่าฝากครรภ์ ครั้งที่ 1-8 30011',
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

  it('renders heading, KPI summary cards, merged table headers, and patient data', async () => {
    render(<AncService30011Client />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '2.4 บริการฝากครรภ์ (ANC 30011)'
    )
    expect(screen.queryByText('กองทุน 2. บริการฝากครรภ์ (ANC)')).not.toBeInTheDocument()

    // Assert KPI Summary cards
    await waitFor(() => {
      expect(screen.getAllByText('25').length).toBeGreaterThan(0) // Total visits
      expect(screen.getByText('20')).toBeInTheDocument() // Compensated visits
      expect(screen.getByText('5')).toBeInTheDocument() // Uncompensated visits
      expect(screen.getByText(/7,200\.00/)).toBeInTheDocument() // Total compensated
    })

    // Assert Merged Table Headers
    expect(screen.getByText('การวินิจฉัย')).toBeInTheDocument()
    expect(screen.getByText('หัตถการ')).toBeInTheDocument()
    expect(screen.getByText('PDX')).toBeInTheDocument()
    expect(screen.getByText('DX0')).toBeInTheDocument()
    expect(screen.getByText('OP0')).toBeInTheDocument()

    // Assert Patient rows
    expect(screen.getByText('น.ส.วิภาวรรณ์ ปั๋นปาละ')).toBeInTheDocument()
    expect(screen.getByText('นาง สุรีย์พร วงศ์ใหญ่')).toBeInTheDocument()
    expect(screen.getByText('0001755')).toBeInTheDocument()
    expect(screen.getByText('1520800120977')).toBeInTheDocument()
  })

  it('allows filtering by clicking on KPI summary cards', async () => {
    render(<AncService30011Client />)

    await waitFor(() => {
      expect(screen.getByText('ได้รับการชดเชยแล้ว')).toBeInTheDocument()
    })

    const compCard = screen.getByRole('button', { name: /ได้รับการชดเชยแล้ว/ })
    expect(compCard).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(compCard)
    expect(compCard).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/กรองสถานะ: ได้รับการชดเชยแล้ว/)).toBeInTheDocument()

    // Toggle off
    fireEvent.click(compCard)
    expect(compCard).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(/กรองสถานะ: ได้รับการชดเชยแล้ว/)).not.toBeInTheDocument()
  })

  it('opens detail modal on patient row click and allows navigating patients', async () => {
    render(<AncService30011Client />)

    await waitFor(() => {
      expect(screen.getByText('น.ส.วิภาวรรณ์ ปั๋นปาละ')).toBeInTheDocument()
    })

    // Click row
    fireEvent.click(screen.getByText('น.ส.วิภาวรรณ์ ปั๋นปาละ'))

    // Dialog opens
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('สรุปผลตรวจและการชดเชย ANC')).toBeInTheDocument()
    expect(screen.getByText('เวชระเบียน HOSxP')).toBeInTheDocument()

    // Quick copy buttons
    expect(screen.getByTitle('คัดลอก HN')).toBeInTheDocument()
    expect(screen.getByTitle('คัดลอกเลขประจำตัวประชาชน')).toBeInTheDocument()
    expect(screen.getByTitle('คัดลอก VN')).toBeInTheDocument()

    // Navigate to next patient
    const nextBtn = screen.getByRole('button', { name: /คนถัดไป/ })
    fireEvent.click(nextBtn)
    expect(
      screen.getByRole('heading', { name: 'นาง สุรีย์พร วงศ์ใหญ่' })
    ).toBeInTheDocument()
  })

  it('displays warning banner when ADP code 30011 is not mapped in HOSxP', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpMapping: {
            isMapped: false,
            mappedCount: 0,
            items: [],
          },
          compensationFilter: 'ALL',
          searchField: 'ALL',
          sortBy: 'vstdate',
          sortOrder: 'desc',
          summary: {
            totalVisits: 0,
            uniquePatients: 0,
            compensatedVisits: 0,
            uncompensatedVisits: 0,
            compensationRate: 0,
            totalCompensated: 0,
            averageCompensated: 0,
            withAuthenCount: 0,
            withoutAuthenCount: 0,
            withPdxCount: 0,
            withOpCount: 0,
          },
          totalCount: 0,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          items: [],
        },
      }),
    })

    render(<AncService30011Client />)

    await waitFor(() => {
      expect(
        screen.getByText(/คุณยังไม่ได้ Map รหัส ADP Code/)
      ).toBeInTheDocument()
    })
  })
})
