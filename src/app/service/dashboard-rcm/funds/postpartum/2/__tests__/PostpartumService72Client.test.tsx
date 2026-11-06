import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PostpartumService72Client from '../PostpartumService72Client'

describe('PostpartumService72Client (Postpartum 7.2 ADP 30015)', () => {
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
                icode: '3002461',
                name: 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code',
                strength: null,
                nhso_adp_code: '30015',
              },
            ],
          },
          compensationFilter: 'ALL',
          searchField: 'ALL',
          sortBy: 'vstdate',
          sortOrder: 'desc',
          summary: {
            totalVisits: 18,
            uniquePatients: 16,
            compensatedVisits: 14,
            uncompensatedVisits: 4,
            compensationRate: 77.8,
            totalCompensated: 3990,
            averageCompensated: 285,
            withAuthenCount: 17,
            withoutAuthenCount: 1,
            withPdxCount: 18,
            withOpCount: 6,
          },
          totalCount: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          items: [
            {
              no: 1,
              vn: '691026082902',
              hn: '0003172',
              cid: '1640900058814',
              ptname: 'น.ส.พิมพ์พิไล ชานก',
              age: 34,
              nation: 'ไทย',
              vstdate: '2026-10-26',
              vsttime: '08:29:02',
              authencode: 'AUTH_PNC_01',
              pttypename: 'บัตรทอง 30บาท ในเขต',
              department: '512 จุดซักประวัติ สูตินารีเวช',
              clinic: 'นรีเวชกรรม',
              pdx: 'Z390',
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
              listname: 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code',
              listname1: '3002541:ยาTriferdine หลังคลอด',
              status: 'Rep :: มี Rep แล้ว',
              rep: '691000220',
              compensated: 285,
              isCompensated: true,
              fund: 'DM22',
              subfund: 'PP_ANC_PNC',
            },
            {
              no: 2,
              vn: '691027091500',
              hn: '0004999',
              cid: '1640900099999',
              ptname: 'นาง สมพร สุขเกษม',
              age: 28,
              nation: 'ไทย',
              vstdate: '2026-10-27',
              vsttime: '09:15:00',
              authencode: null,
              pttypename: 'ชำระเงินเอง',
              department: '512 จุดซักประวัติ สูตินารีเวช',
              clinic: 'นรีเวชกรรม',
              pdx: 'Z391',
              dx0: null,
              dx1: null,
              dx2: null,
              dx3: null,
              dx4: null,
              dx5: null,
              op0: '8901',
              op1: null,
              op2: null,
              op3: null,
              op4: null,
              op5: null,
              listname: 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code',
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

  it('renders heading, KPI summary cards, and patient rows', async () => {
    render(<PostpartumService72Client />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '7.2 การตรวจหลังคลอด ADP'
    )
    expect(screen.getByText(/กองทุนที่ 7 · การตรวจหลังคลอด/)).toBeInTheDocument()

    // Assert KPI Summary cards
    await waitFor(() => {
      expect(screen.getAllByText('18 ครั้ง').length).toBeGreaterThan(0) // Total visits & withPdxCount
      expect(screen.getByText('14 ครั้ง')).toBeInTheDocument() // Compensated visits
      expect(screen.getByText('4 ครั้ง')).toBeInTheDocument() // Uncompensated visits
      expect(screen.getByText(/3,990\.00 บาท/)).toBeInTheDocument() // Total compensated
    })

    // Assert Patient rows
    expect(screen.getByText('น.ส.พิมพ์พิไล ชานก')).toBeInTheDocument()
    expect(screen.getByText('นาง สมพร สุขเกษม')).toBeInTheDocument()
  })

  it('allows filtering by clicking on KPI summary cards', async () => {
    render(<PostpartumService72Client />)

    await waitFor(() => {
      expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeInTheDocument()
    })

    const compCard = screen.getByRole('button', { name: /ตัวกรอง: ได้รับชดเชยแล้ว/ })
    fireEvent.click(compCard)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('compensationFilter=COMPENSATED')
    )
  })

  it('opens detail modal on patient row click and allows navigating patients', async () => {
    render(<PostpartumService72Client />)

    await waitFor(() => {
      expect(screen.getByText('น.ส.พิมพ์พิไล ชานก')).toBeInTheDocument()
    })

    // Click row
    fireEvent.click(screen.getByText('น.ส.พิมพ์พิไล ชานก'))

    // Dialog opens
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('สรุปข้อมูลการเบิกจ่าย')).toBeInTheDocument()
    expect(screen.getByText('เวชระเบียนคลินิก (HOSxP)')).toBeInTheDocument()

    // Navigate to next patient
    const nextBtn = screen.getByRole('button', { name: 'คนถัดไป' })
    fireEvent.click(nextBtn)
    expect(screen.getByRole('heading', { name: 'นาง สมพร สุขเกษม' })).toBeInTheDocument()
  })

  it('displays warning banner when ADP code 30015 is not mapped in HOSxP', async () => {
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

    render(<PostpartumService72Client />)

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่ได้ Map ADP Code/)).toBeInTheDocument()
    })
  })
})
