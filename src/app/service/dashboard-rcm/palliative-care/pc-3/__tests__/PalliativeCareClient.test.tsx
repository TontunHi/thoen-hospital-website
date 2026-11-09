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

    // Date mode buttons (single-row ribbon: กำหนดเอง | รายเดือน | ปีงบประมาณ)
    expect(screen.getByText('กำหนดเอง')).toBeInTheDocument()
    expect(screen.getByText('รายเดือน')).toBeInTheDocument()
    expect(screen.getByText('ปีงบประมาณ')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นายธวัชชัย คำมา')).toBeInTheDocument()
      expect(screen.getByText('นางสมใจ สบายดี')).toBeInTheDocument()
    })

    // Metric bar items
    expect(screen.getAllByText('Advance Care Plan').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Opioid').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/มีรหัส Z515/).length).toBeGreaterThan(0)
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

  it('exports modern Excel (.xlsx) file with full columns and downloaded workbook', async () => {
    let downloadedName = ''
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName)
      if (tagName === 'a') {
        el.click = () => {
          downloadedName = el.getAttribute('download') || ''
        }
      }
      return el
    })

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => 'blob:pc3'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(),
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockPalliativeResponse,
        items: [
          {
            ...mockPalliativeResponse.items[0],
            ptname: 'ทดสอบชื่อ',
          },
        ],
      }),
    } as any)

    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByText(/ทดสอบชื่อ/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ส่งออก Excel/ }))

    await waitFor(() => {
      expect(downloadedName).toContain('Palliative_Care_PC3_')
      expect(downloadedName.endsWith('.xlsx')).toBe(true)
    }, { timeout: 4000 })
  })

  it('has UC checkbox checked by default and allows toggling', async () => {    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByText('เฉพาะสิทธิ UC')).toBeInTheDocument()
    })

    const ucCheckbox = screen.getByRole('checkbox', { name: /เฉพาะสิทธิ UC/i }) as HTMLInputElement
    expect(ucCheckbox.checked).toBe(true)

    // Uncheck
    fireEvent.click(ucCheckbox)
    expect(ucCheckbox.checked).toBe(false)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('ucOnly=false'), expect.anything())
    })
  })

  it('switches between date modes properly', async () => {
    render(<PalliativeCareClient />)

    // Click 'ปีงบประมาณ'
    const fiscalBtn = screen.getByText('ปีงบประมาณ')
    fireEvent.click(fiscalBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/ปีงบประมาณ/).length).toBeGreaterThan(1)
    })

    // Click 'กำหนดเอง'
    const customBtn = screen.getByText('กำหนดเอง')
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

    // คลิกทั้งแถวเพื่อเปิดรายละเอียด (Row-clickable record)
    const patientRow = screen.getByText('นายธวัชชัย คำมา').closest('tr')
    expect(patientRow).not.toBeNull()
    fireEvent.click(patientRow as HTMLElement)

    await waitFor(() => {
      expect(screen.getByText(/รายละเอียดผู้ป่วย: นายธวัชชัย คำมา/)).toBeInTheDocument()
      expect(screen.getByText('มาตรวจตามนัด')).toBeInTheDocument()
      expect(screen.getAllByText('บัตรทอง ในเขต').length).toBeGreaterThan(1)
      expect(screen.getAllByText('สถานะการมีชีวิต').length).toBeGreaterThan(1)
    })
  })

  it('displays death status column and handles death filter option', async () => {
    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'สถานะการมีชีวิต' })).toBeInTheDocument()
      expect(screen.getByText('มีชีวิต')).toBeInTheDocument()
      expect(screen.getAllByText(/เสียชีวิต.*15 ต\.ค\. 2568/).length).toBeGreaterThanOrEqual(1)
    })

    // Filter dropdown for deathStatus
    const deathSelect = screen.getByLabelText('สถานะการมีชีวิต')
    fireEvent.change(deathSelect, { target: { value: 'Y' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('deathStatus=Y'), expect.anything())
    })

    // Filter dropdown for compensatedFilter
    const paidSelect = screen.getByLabelText('เงินชดเชย')
    fireEvent.change(paidSelect, { target: { value: 'PAID' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('compensated=PAID'), expect.anything())
    })

    // Filter by threshold >=750
    fireEvent.change(paidSelect, { target: { value: '>=750' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/compensated=(?:%3E%3D750|>=750)/),
        expect.anything()
      )
    })
  })

  it('filters data when clicking on metric cards in PC.3', async () => {
    render(<PalliativeCareClient />)

    await waitFor(() => {
      expect(screen.getByText('นายธวัชชัย คำมา')).toBeInTheDocument()
    })

    // Click 'Advance Care Plan' card
    const acpCard = screen.getByRole('button', { name: /Advance Care Plan/ })
    fireEvent.click(acpCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('filterType=Chronic'), expect.anything())
      expect(acpCard).toHaveClass('is-active')
    })

    // Click 'มีรหัส Z515' card
    const z515Card = screen.getByRole('button', { name: /มีรหัส Z515/ })
    fireEvent.click(z515Card)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('z515Status=Y'), expect.anything())
      expect(z515Card).toHaveClass('is-active')
    })

    // Click 'เสียชีวิต' chip
    const deathCard = screen.getByRole('button', { name: /เสียชีวิต/ })
    fireEvent.click(deathCard)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('deathStatus=Y'), expect.anything())
      expect(deathCard).toHaveClass('is-active')
    })

    // Click 'ผู้ป่วย Palliative ทั้งหมด' card to reset
    const allCard = screen.getByRole('button', { name: /ผู้ป่วย Palliative ทั้งหมด/ })
    fireEvent.click(allCard)

    await waitFor(() => {
      expect(allCard).toHaveClass('is-active')
    })
  })
})
