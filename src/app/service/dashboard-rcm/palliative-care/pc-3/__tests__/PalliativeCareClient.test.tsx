import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PalliativeCareClient from '../PalliativeCareClient'

const mockPalliativeResponse = {
  success: true,
  ds1: '2026-11-01',
  ds2: '2026-11-30',
  ucOnly: true,
  filterType: 'ALL',
  summary: {
    totalVisits: 2,
    totalPatients: 2,
    advanceCarePlanCount: 1,
    opioidCount: 1,
    hasZ515Count: 1,
    missingZ515Count: 1,
    paidCount: 1,
    totalCompensated: 5000,
    deceasedCount: 1,
  },
  items: [
    {
      no: 1,
      vn: '681010105235',
      cid: '3520800553276',
      hn: '0000063',
      ptname: 'นายธวัชชัย คำมา',
      vstdate: '2025-10-10',
      authencode: 'AUTH123',
      pttype: '10',
      inscl: 'UCS',
      pttypename: 'บัตรทอง ในเขต',
      address: '90 ม.06',
      tel: '0980012795',
      cc: 'มาตรวจตามนัด',
      room: 'ห้องตรวจ 1',
      spclty: 'ปฐมภูมิ',
      diag: 'B24',
      oper: '8744',
      z515: 'Y',
      dx: 'Y',
      z718: 'Y',
      cancer: 'N',
      drug: 'N',
      death: 'N',
      death_date: null,
      ok: 'Y',
      compensated: 5000,
      rep_invoice: 'rep#1',
      eclaim_no: 'ec#1',
      senddate: '2564-08-02',
      status_eclaim: '4',
      filename_send: 'file.ecd',
      error_name: '',
    },
    {
      no: 2,
      vn: '681010105236',
      cid: '3520800123456',
      hn: '0000064',
      ptname: 'นางสมใจ สบายดี',
      vstdate: '2025-10-11',
      authencode: '',
      pttype: '20',
      inscl: 'UCS',
      pttypename: 'บัตรทอง นอกเขต',
      address: '12 ม.01',
      tel: '0812345678',
      cc: 'ปวดหลังเรื้อรัง',
      room: 'ห้องตรวจ 2',
      spclty: 'อายุรกรรม',
      diag: 'C180',
      oper: '',
      z515: '',
      dx: 'Y',
      z718: '',
      cancer: 'Y',
      drug: 'Y',
      death: 'Y',
      death_date: '2025-10-15',
      ok: ' ',
      compensated: 0,
      rep_invoice: '',
      eclaim_no: '',
      senddate: null,
      status_eclaim: '- :: ยังไม่ได้ส่ง',
      filename_send: '',
      error_name: 'ไม่พบรหัส Z515',
    },
  ],
}

describe('PalliativeCareClient PC.3 Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPalliativeResponse,
    } as any)
  })

  it('renders header with PC.3 badge, date modes, and unified metric bar', async () => {
    render(<PalliativeCareClient />)

    expect(screen.getByText(/Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด/)).toBeInTheDocument()
    expect(screen.getByText('PC.3')).toBeInTheDocument()

    // Date mode buttons
    expect(screen.getByText('กำหนดเอง (วันถึงวัน)')).toBeInTheDocument()
    expect(screen.getByText('รายเดือน')).toBeInTheDocument()
    expect(screen.getByText('รายปีงบประมาณ')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นายธวัชชัย คำมา')).toBeInTheDocument()
      expect(screen.getByText('นางสมใจ สบายดี')).toBeInTheDocument()
    })

    // Metric bar items
    expect(screen.getAllByText('Advance Care Plan').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Opioid').length).toBeGreaterThan(0)
    expect(screen.getByText('มีรหัส Z515')).toBeInTheDocument()
    expect(screen.getAllByText(/ไม่พบรหัส Z515/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/ชดเชยแล้ว/).length).toBeGreaterThan(0)
  })

  it('displays full CID without masking and shows pttypename in table', async () => {
    render(<PalliativeCareClient />)

    await waitFor(() => {
      // Full CID should be displayed directly (no masking)
      expect(screen.getByText('3520800553276')).toBeInTheDocument()
      expect(screen.getByText('3520800123456')).toBeInTheDocument()
      // Pttypename should be visible in table
      expect(screen.getByText('บัตรทอง ในเขต')).toBeInTheDocument()
      expect(screen.getByText('บัตรทอง นอกเขต')).toBeInTheDocument()
    })
  })

  it('has UC checkbox checked by default and allows toggling', async () => {
    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByText('เฉพาะสิทธิ UC')).toBeInTheDocument()
    })

    const ucCheckbox = screen.getByRole('checkbox', { name: /เฉพาะสิทธิ UC/i }) as HTMLInputElement
    expect(ucCheckbox.checked).toBe(true)

    // Uncheck
    fireEvent.click(ucCheckbox)
    expect(ucCheckbox.checked).toBe(false)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('ucOnly=false'))
    })
  })

  it('switches between date modes properly', async () => {
    render(<PalliativeCareClient />)

    // Click 'รายปีงบประมาณ'
    const fiscalBtn = screen.getByText('รายปีงบประมาณ')
    fireEvent.click(fiscalBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/ปีงบประมาณ/).length).toBeGreaterThan(1)
    })

    // Click 'กำหนดเอง (วันถึงวัน)'
    const customBtn = screen.getByText('กำหนดเอง (วันถึงวัน)')
    fireEvent.click(customBtn)

    await waitFor(() => {
      expect(screen.getByText('ถึง')).toBeInTheDocument()
    })
  })

  it('opens detail modal on click', async () => {
    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByText('นายธวัชชัย คำมา')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByTitle('ดูรายละเอียดผู้ป่วย')
    fireEvent.click(infoButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/รายละเอียดผู้ป่วย: นายธวัชชัย คำมา/)).toBeInTheDocument()
      expect(screen.getByText('มาตรวจตามนัด')).toBeInTheDocument()
      expect(screen.getAllByText('บัตรทอง ในเขต').length).toBeGreaterThan(1)
      expect(screen.getAllByText('สถานะตาย').length).toBeGreaterThan(1)
    })
  })

  it('displays death status column and handles death filter option', async () => {
    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'สถานะตาย' })).toBeInTheDocument()
      expect(screen.getByText('มีชีวิต')).toBeInTheDocument()
      expect(screen.getAllByText(/เสียชีวิต.*2025-10-15/).length).toBeGreaterThanOrEqual(1)
    })

    // Filter dropdown for deathStatus
    const deathSelect = screen.getByDisplayValue('สถานะตาย: ทั้งหมด')
    fireEvent.change(deathSelect, { target: { value: 'Y' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('deathStatus=Y'))
    })

    // Filter dropdown for compensatedFilter
    const paidSelect = screen.getByDisplayValue('เงินชดเชย: ทั้งหมด')
    fireEvent.change(paidSelect, { target: { value: 'PAID' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('compensated=PAID'))
    })

    // Filter by threshold >=750
    fireEvent.change(paidSelect, { target: { value: '>=750' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/compensated=(?:%3E%3D750|>=750)/))
    })
  })
})
