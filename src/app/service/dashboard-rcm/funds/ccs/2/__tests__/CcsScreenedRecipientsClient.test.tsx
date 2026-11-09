import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CcsScreenedRecipientsClient from '../CcsScreenedRecipientsClient'

describe('CcsScreenedRecipientsClient (CCS 1.2 — UI Style Brief)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ds1: '2024-10-01',
          ds2: '2025-09-30',
          methodFilter: 'ALL',
          okFilter: 'ALL',
          resultStatusFilter: 'ALL',
          compensationFilter: 'ALL',
          searchField: 'ALL',
          sortBy: 'vstdate',
          sortOrder: 'desc',
          summary: {
            totalVisits: 350,
            uniquePatients: 340,
            okCount: 330,
            notOkCount: 20,
            papCount: 150,
            viaCount: 50,
            hpvCount: 120,
            colposcopyCount: 30,
            abnormalCount: 15,
            totalSeamlessCompensated: 85000,
            totalNhsoCompensated: 92000,
          },
          totalCount: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          items: [
            {
              no: 1,
              vn: '671001073008',
              an: null,
              cid: '3520900015322',
              hn: '0134464',
              ptname: 'นาง สมหญิง ทดสอบ',
              age: 41,
              nation: 'ไทย',
              vstdate: '2024-10-01',
              vsttime: '07:30:08',
              authencode: 'AUTH671001',
              pttypename_patient: 'บัตรทอง รพ.เถิน',
              pttypename_visit: 'บัตรทอง รพ.เถิน',
              department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
              clinic: 'เวชกรรม',
              pdx: 'Z124',
              dx0: null,
              dx1: null,
              dx2: null,
              dx3: null,
              dx4: null,
              dx5: null,
              ok: 'Y',
              papsmear: '1B004N',
              papsmear_result: 'ปกติ',
              via: null,
              via_result: null,
              hpv: null,
              hpv_result: null,
              other: null,
              other_result: null,
              colposcopy: 'Y',
              type: 'OP',
              rep: '6710_CCS_001',
              compensated: 450,
              note: 'จ่ายแล้ว',
              paydate: '2024-11-15',
              listname: '1B005',
              status: 'NHSO :: มี Invoice แล้ว',
              rep_nhso: '11152_SOGNSTMP_202411',
              nhso: 450,
              hasAbnormalResult: false,
            },
            {
              no: 2,
              vn: '671002081500',
              an: null,
              cid: '3520900015999',
              hn: '0134999',
              ptname: 'นาง สมศรี ขาดรหัส',
              age: 38,
              nation: 'ไทย',
              vstdate: '2024-10-02',
              vsttime: '08:15:00',
              authencode: null,
              pttypename_patient: 'ประกันสังคม',
              pttypename_visit: 'ประกันสังคม',
              department: 'ห้องตรวจสูติ',
              clinic: 'สูตินรีเวช',
              pdx: 'Z124',
              dx0: null,
              dx1: null,
              dx2: null,
              dx3: null,
              dx4: null,
              dx5: null,
              ok: null, // lacks valid screening code -> Red warning row
              papsmear: null,
              papsmear_result: null,
              via: null,
              via_result: null,
              hpv: null,
              hpv_result: null,
              other: null,
              other_result: null,
              colposcopy: null,
              type: null,
              rep: null,
              compensated: 0,
              note: null,
              paydate: null,
              listname: null,
              status: null,
              rep_nhso: null,
              nhso: 0,
              hasAbnormalResult: false,
            },
          ],
        },
      }),
    })
  })

  it('renders header, date tabs, KPI summary cards, and ledger table', async () => {
    render(<CcsScreenedRecipientsClient />)

    expect(
      screen.getByText('1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก')
    ).toBeInTheDocument()

    // KPI cards render
    await waitFor(() => {
      expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
      expect(screen.getByText('350')).toBeInTheDocument()
      expect(screen.getByText('ผ่านเกณฑ์บันทึก (OK)')).toBeInTheDocument()
      expect(screen.getByText('330')).toBeInTheDocument()
      expect(screen.getByText('ขาดรหัสคัดกรอง (Not OK)')).toBeInTheDocument()
      expect(screen.getByText('20')).toBeInTheDocument()
      expect(screen.getByText('85,000.00')).toBeInTheDocument()
      expect(screen.getByText('92,000.00')).toBeInTheDocument()
    })

    // Ledger table rows render
    expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    expect(screen.getByText('นาง สมศรี ขาดรหัส')).toBeInTheDocument()
    expect(screen.getByText('671001073008')).toBeInTheDocument()
    expect(screen.getByText('0134464')).toBeInTheDocument()

    // OK and Not OK badges
    expect(screen.getByText('OK')).toBeInTheDocument()
    expect(screen.getByText('Not OK')).toBeInTheDocument()
  })

  it('always displays full Thai Citizen ID formatted without masking toggle', async () => {
    render(<CcsScreenedRecipientsClient />)

    await waitFor(() => {
      // Full Thai Citizen ID formatted as 3-5209-00015-32-2
      expect(screen.getByText('3-5209-00015-32-2')).toBeInTheDocument()
      expect(screen.getByText('3-5209-00015-99-9')).toBeInTheDocument()
    })

    // Masking toggle button should NOT exist
    expect(screen.queryByRole('button', { name: /แสดงเลขบัตร/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ซ่อนเลขบัตร/ })).not.toBeInTheDocument()
  })

  it('renders date tabs in order: กำหนดเอง -> รายเดือน -> ปีงบประมาณ with custom active by default', () => {
    render(<CcsScreenedRecipientsClient />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveTextContent('กำหนดเอง')
    expect(tabs[1]).toHaveTextContent('รายเดือน')
    expect(tabs[2]).toHaveTextContent('ปีงบประมาณ')

    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('filters by clicking on KPI summary cards', async () => {
    render(<CcsScreenedRecipientsClient />)

    await waitFor(() => {
      expect(screen.getByText('ขาดรหัสคัดกรอง (Not OK)')).toBeInTheDocument()
    })

    const notOkCard = screen.getByRole('button', { name: /ขาดรหัสคัดกรอง \(Not OK\)/ })
    fireEvent.click(notOkCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('okFilter=NOT_OK'),
        expect.anything()
      )
    })
  })

  it('filters by screening method combobox (PapSmear, VIA, HPV, ColpoScopy)', async () => {
    render(<CcsScreenedRecipientsClient />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    })

    const methodSelect = screen.getByLabelText('แสดงข้อมูลวิธีตรวจ')
    fireEvent.change(methodSelect, { target: { value: 'PapSmear' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('methodFilter=PapSmear'),
        expect.anything()
      )
    })
  })

  it('opens patient inspection modal and switches between summary and clinical tabs', async () => {
    render(<CcsScreenedRecipientsClient />)

    await waitFor(() => {
      expect(screen.getByText('671001073008')).toBeInTheDocument()
    })

    const vnBtn = screen.getByText('671001073008')
    fireEvent.click(vnBtn)

    await waitFor(() => {
      expect(
        screen.getByText('เวชระเบียนผู้รับบริการ: นาง สมหญิง ทดสอบ (HN: 0134464)')
      ).toBeInTheDocument()
      expect(screen.getByText('สรุปการคัดกรอง & การชดเชย')).toBeInTheDocument()
    })

    // Switch to clinical HOSxP tab
    const clinicalTabBtn = screen.getByText('เวชระเบียนคลินิก HOSxP')
    fireEvent.click(clinicalTabBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/funds/ccs/vn-details?vn=671001073008')
      )
    })
  })

  it('does not render redundant date range badge (Pass 7 Smart Subtraction)', async () => {
    render(<CcsScreenedRecipientsClient />)

    // The date badge "1 ต.ค. ... — 30 ก.ย. ..." should not be displayed
    expect(screen.queryByText(/— 30 ก\.ย\./)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 ต\.ค\..*—/)).not.toBeInTheDocument()
  })

  it('renders quiet breadcrumbs navigation', () => {
    render(<CcsScreenedRecipientsClient />)

    expect(screen.getByRole('navigation', { name: 'แถบนำทาง' })).toBeInTheDocument()
    expect(screen.getByText('Dashboard RCM')).toBeInTheDocument()
    expect(screen.getByText('กองทุนมะเร็งปากมดลูก (CCS)')).toBeInTheDocument()
    expect(screen.getByText('1.2 รายชื่อผู้รับบริการคัดกรอง')).toBeInTheDocument()
  })

  it('opens patient modal when clicking anywhere on the table row', async () => {
    render(<CcsScreenedRecipientsClient />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    })

    // Click on patient name cell instead of VN button
    const ptNameCell = screen.getByText('นาง สมหญิง ทดสอบ')
    fireEvent.click(ptNameCell)

    await waitFor(() => {
      expect(
        screen.getByText('เวชระเบียนผู้รับบริการ: นาง สมหญิง ทดสอบ (HN: 0134464)')
      ).toBeInTheDocument()
    })
  })

  it('does not render bottom tfoot summary row (Smart Subtraction)', async () => {
    render(<CcsScreenedRecipientsClient />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    })

    expect(screen.queryByText(/รวมทั้งหมดในหน้านี้/)).not.toBeInTheDocument()
  })
})


