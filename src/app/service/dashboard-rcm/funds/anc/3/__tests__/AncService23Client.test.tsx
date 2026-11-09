import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AncService23Client from '../AncService23Client'

const mockReportData = {
  ds1: '2026-05-01',
  ds2: '2026-05-31',
  cardFilter: 'ALL',
  serviceFilter: 'ALL',
  ucFilter: 'ALL',
  statusFilter: 'ALL',
  statusOptions: ['NHSO :: ได้รับ Invoice แล้ว', 'Rep :: ส่ง Rep แล้ว', '- :: ยังไม่ได้ส่ง'],
  searchField: 'ALL',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  summary: {
    totalVisits: 85,
    uniquePatients: 78,
    serviceOkCount: 65,
    checkupCount: 50,
    scallingCount: 42,
    ultrasoundCount: 40,
    ucCount: 75,
    compensatedCount: 45,
    uncompensatedCount: 40,
    compensationRate: 52.94,
    totalCompensated: 22500,
    averageCompensated: 500,
    warningCount: 6,
  },
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  items: [
    {
      no: 1,
      vn: '690501083000',
      cid: '3520900015322',
      hn: '0134464',
      person_id: 101,
      ptname: 'นาง สมหญิง ทดสอบ',
      sex: 'หญิง',
      age: 28,
      nation: 'ไทย',
      vstdate: '2026-05-15',
      vsttime: '08:30:00',
      camedate: '2026-05-15',
      room: 'แผนกสูติ-นรีเวชกรรม',
      pttypename_patient: 'บัตรทอง รพ.เถิน',
      pttypename_visit: 'บัตรทอง รพ.เถิน',
      uc: 'Y',
      authencode: 'AUTH690515',
      group_id: '1111',
      groupname: 'ANC & บริการทันตกรรม & Ultrasound',
      preg_no: 2,
      ga: 19,
      lmp: '2026-01-01',
      lastdate: '2026-06-18',
      pregnancy: 'ตั้งครรภ์',
      labor_date: '2026-10-08',
      dchdate: null,
      anc: '2',
      servicename: 'ตรวจอัลตราซาวด์สูติกรรม',
      oper: '8878',
      us: 'Y',
      checkup: 'Y',
      scalling: 'Y',
      service_date: '2026-05-15',
      itemname: '2330011,2387010,8878',
      ok: 'Y',
      doctor: 'ว54321',
      typearea: '1',
      address: '12 ม.2 ต.ล้อมแรด',
      tel: '0812345678',
      eclaim_no: 'E6905001',
      status_eclaim: 'NHSO :: ได้รับ Invoice แล้ว',
      service: 'Y',
      compensated: 500,
      isCompensated: true,
      rep: 'REP6905',
      fund: 'ANC',
      subfund: 'Dental-US',
      mean: null,
    },
    {
      no: 2,
      vn: '690501090000',
      cid: '1529900022222',
      hn: '0134465',
      person_id: 102,
      ptname: 'น.ส. กัญญารัตน์ เตือนใจ',
      sex: 'หญิง',
      age: 24,
      nation: 'ไทย',
      vstdate: '2026-05-16',
      vsttime: '09:00:00',
      camedate: '2026-05-16',
      room: 'แผนกทันตกรรม',
      pttypename_patient: 'จ่ายตรง',
      pttypename_visit: 'จ่ายตรง',
      uc: ' ',
      authencode: null,
      group_id: '0001',
      groupname: 'บริการทันตกรรม',
      preg_no: null,
      ga: null,
      lmp: null,
      lastdate: null,
      pregnancy: null,
      labor_date: null,
      dchdate: null,
      anc: null,
      servicename: null,
      oper: null,
      us: null,
      checkup: 'Y',
      scalling: null,
      service_date: '2026-05-16',
      itemname: '2330011',
      ok: 'Y',
      doctor: 'ท12345',
      typearea: '3',
      address: '45 ม.4 ต.เถินบุรี',
      tel: '0898765432',
      eclaim_no: null,
      status_eclaim: '- :: ยังไม่ได้ส่ง',
      service: null,
      compensated: 0,
      isCompensated: false,
      rep: null,
      fund: null,
      subfund: null,
      mean: 'ไม่มี LMP',
    },
  ],
}

describe('AncService23Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('vn-details')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              vn: '690501083000',
              hn: '0134464',
              ptname: 'นาง สมหญิง ทดสอบ',
              cc: 'มาฝากครรภ์ไตรมาสสองและตรวจสุขภาพช่องปาก',
              pe: 'GA 19 weeks, single fetus',
              bps: 110,
              bpd: 70,
              pulse: 78,
              bw: 56,
              height: 160,
              diagnoses: [{ icd10: 'Z340', name: 'Normal pregnancy', dxtype: 'Principal Dx' }],
              procedures: [{ icd9: '8878', name: 'Diagnostic ultrasound gravid uterus' }],
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

  it('renders header, date tabs in order (กำหนดเอง -> รายเดือน -> ปีงบประมาณ), and unmasked full 13-digit CID', async () => {
    render(<AncService23Client />)

    expect(screen.getByText(/2.3 หญิงตั้งครรภ์ ได้รับบริการตรวจ Ultrasound/)).toBeInTheDocument()

    // Assert tab order: 1. กำหนดเอง -> 2. รายเดือน -> 3. ปีงบประมาณ
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveTextContent('กำหนดเอง')
    expect(tabs[1]).toHaveTextContent('รายเดือน')
    expect(tabs[2]).toHaveTextContent('ปีงบประมาณ')
    expect(tabs[0]).toHaveClass('is-active')

    await waitFor(() => {
      expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    })

    // Unmasked CID format: 3-5209-00015-32-2
    expect(screen.getByText('3-5209-00015-32-2')).toBeInTheDocument()
    expect(screen.getByText('1-5299-00022-22-2')).toBeInTheDocument()

    // Assert pregnancy & dental indicators in table
    expect(screen.getByText('ANC 2')).toBeInTheDocument()
    expect(screen.getByText('19 wk')).toBeInTheDocument()
    expect(screen.getByText('ไม่มี LMP')).toBeInTheDocument()
  })

  it('renders all KPI summary cards and clicking a card triggers interactive filtering', async () => {
    render(<AncService23Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    })

    // Assert KPI Card labels & figures
    expect(screen.getByText('ผู้รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()

    expect(screen.getByText('ได้รับบริการ (OK)')).toBeInTheDocument()
    expect(screen.getByText('65')).toBeInTheDocument()

    const checkupLabel = screen.getAllByText('ตรวจช่องปาก')[0]
    expect(checkupLabel).toBeInTheDocument()
    expect(screen.getAllByText('50')[0]).toBeInTheDocument()

    expect(screen.getByText('ขูดหินปูน / ขัดฟัน')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()

    const usLabel = screen.getAllByText('Ultrasound')[0]
    expect(usLabel).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()

    expect(screen.getByText('สิทธิบัตรทอง (UC)')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()

    expect(screen.getByText('ได้รับชดเชยแล้ว')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()

    expect(screen.getAllByText('ข้อควรตรวจสอบ')[0]).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()

    // Click on "ตรวจช่องปาก" card
    const checkupCard = checkupLabel.closest('button')
    expect(checkupCard).toBeInTheDocument()
    fireEvent.click(checkupCard!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=CHECKUP'),
        expect.anything()
      )
    })
  })

  it('switches date tabs to "รายเดือน" and "ปีงบประมาณ"', async () => {
    render(<AncService23Client />)

    const tabs = screen.getAllByRole('tab')
    // Click "รายเดือน"
    fireEvent.click(tabs[1])
    expect(tabs[1]).toHaveClass('is-active')
    expect(screen.getByText('เดือน:')).toBeInTheDocument()

    // Click "ปีงบประมาณ"
    fireEvent.click(tabs[2])
    expect(tabs[2]).toHaveClass('is-active')
    expect(screen.getByText('ปีงบประมาณ พ.ศ.:')).toBeInTheDocument()
  })

  it('opens patient inspection modal and switches between Summary and Clinical HOSxP tabs', async () => {
    render(<AncService23Client />)

    await waitFor(() => {
      expect(screen.getByText('นาง สมหญิง ทดสอบ')).toBeInTheDocument()
    })

    const patientRow = screen.getByText('นาง สมหญิง ทดสอบ').closest('tr')
    expect(patientRow).toBeInTheDocument()
    fireEvent.click(patientRow!)

    await waitFor(() => {
      expect(
        screen.getByText(/เวชระเบียนผู้รับบริการฝากครรภ์: นาง สมหญิง ทดสอบ/)
      ).toBeInTheDocument()
    })

    // Tab 1: Summary info
    expect(screen.getByText('กลุ่มบริการที่ได้รับ')).toBeInTheDocument()
    expect(screen.getByText(/ANC ครั้งที่ 2/)).toBeInTheDocument()

    // Switch to Tab 2: Clinical Details
    const clinicalTabBtn = screen.getByText('เวชระเบียนคลินิก (HOSxP)')
    fireEvent.click(clinicalTabBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('vn-details?vn=690501083000')
      )
      expect(screen.getByText('มาฝากครรภ์ไตรมาสสองและตรวจสุขภาพช่องปาก')).toBeInTheDocument()
      expect(screen.getByText('Normal pregnancy')).toBeInTheDocument()
    })
  })

  it('filters by right when selecting options in PttypeMultiSelect', async () => {
    render(<AncService23Client initialData={mockReportData} />)

    const selectTrigger = screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i })
    expect(selectTrigger).toBeInTheDocument()
    fireEvent.click(selectTrigger)

    // Click UC preset
    const ucBtn = screen.getByText('🏥 เฉพาะ UC (01-09)')
    fireEvent.click(ucBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pttypes=01%2C02%2C03%2C04%2C05%2C06%2C07%2C08%2C09'),
        expect.anything()
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.anything()
      )
    })
  })
})

