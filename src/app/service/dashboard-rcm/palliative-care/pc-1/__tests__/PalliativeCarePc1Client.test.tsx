import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PalliativeCarePc1Client from '../PalliativeCarePc1Client'

const mockPc1Response = {
  success: true,
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  paidStatus: 'ALL',
  summary: {
    totalVisits: 2,
    totalPatients: 2,
    paidCount: 1,
    unpaidCount: 1,
    totalCompensated: 1000,
    totalInvoiceCompensated: 0,
  },
  items: [
    {
      no: 1,
      vn: '691021131643',
      cid: '3520800269098',
      hn: '0000206',
      ptname: 'นางจันทนา ตันมา',
      age: 60,
      nation: 'ไทย',
      vstdate: '2026-10-21',
      vsttime: '13:16:43',
      authencode: 'AUTH001',
      pttypename: 'บัตรทอง ผู้สูงอายุ ในเขต',
      department: '117 จุดซักประวัติ Palliative Care',
      clinic: 'อายุรกรรม',
      pdx: 'C548',
      dx0: 'Z515',
      dx1: 'Z636',
      dx2: 'Z718',
      dx3: 'Z740',
      dx4: null,
      dx5: null,
      op0: null,
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      listname: 'ค่าเยี่ยมบ้านPaliative care',
      rep: '691000192',
      compensated: 1000,
      transaction_type: null,
      invoice: null,
      invoice_compensated: 0,
      resource: null,
      subfund: 'PALLIATIVE-CARE',
      remark: null,
      projectcode: null,
    },
    {
      no: 2,
      vn: '691021131644',
      cid: '3520800269099',
      hn: '0000207',
      ptname: 'นายสมชาย ใจดี',
      age: 72,
      nation: 'ไทย',
      vstdate: '2026-10-22',
      vsttime: '09:30:15',
      authencode: '',
      pttypename: 'บัตรทอง ทั่วไป',
      department: '117 จุดซักประวัติ Palliative Care',
      clinic: 'อายุรกรรม',
      pdx: 'C349',
      dx0: 'Z515',
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
      listname: 'ค่าเยี่ยมบ้านPaliative care',
      rep: null,
      compensated: 0,
      transaction_type: null,
      invoice: null,
      invoice_compensated: 0,
      resource: null,
      subfund: 'PALLIATIVE-CARE',
      remark: 'รอผลเคลม',
      projectcode: null,
    },
  ],
}

describe('PalliativeCarePc1Client Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPc1Response,
    } as any)
  })

  it('renders header with PC.1 badge and unified metric bar', async () => {
    render(<PalliativeCarePc1Client />)

    expect(screen.getByText('บริการ Palliative Care End Of Life')).toBeInTheDocument()
    expect(screen.getByText('PC.1')).toBeInTheDocument()

    // Date mode buttons
    expect(screen.getByText('กำหนดเอง (วันถึงวัน)')).toBeInTheDocument()
    expect(screen.getByText('รายเดือน')).toBeInTheDocument()
    expect(screen.getByText('รายปีงบประมาณ')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
      expect(screen.getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    })

    // Metric items
    expect(screen.getByText('ผู้ป่วยทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('รับบริการทั้งหมด')).toBeInTheDocument()
    expect(screen.getAllByText('ชดเชยแล้ว').length).toBeGreaterThan(0)
    expect(screen.getByText('ยอดชดเชยรวม (Rep)')).toBeInTheDocument()
  })

  it('displays full CID without masking and shows diagnosis and listname in table', async () => {
    render(<PalliativeCarePc1Client />)

    await waitFor(() => {
      expect(screen.getByText('3520800269098')).toBeInTheDocument()
      expect(screen.getByText('3520800269099')).toBeInTheDocument()
      expect(screen.getByText('C548')).toBeInTheDocument()
      expect(screen.getAllByText('ค่าเยี่ยมบ้านPaliative care').length).toBeGreaterThan(0)
    })
  })

  it('switches between date modes properly', async () => {
    render(<PalliativeCarePc1Client />)

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

  it('filters by paidStatus dropdown properly', async () => {
    render(<PalliativeCarePc1Client />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('การชดเชย: ทั้งหมด')
    fireEvent.change(select, { target: { value: 'PAID' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('paidStatus=PAID'), expect.anything())
    })
  })

  it('opens detail modal on row click', async () => {
    render(<PalliativeCarePc1Client />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    const patientRow = screen.getByText('นางจันทนา ตันมา').closest('tr')!
    fireEvent.click(patientRow)

    await waitFor(() => {
      expect(screen.getByText(/รายละเอียดผู้ป่วย: นางจันทนา ตันมา/)).toBeInTheDocument()
      expect(screen.getAllByText('บัตรทอง ผู้สูงอายุ ในเขต').length).toBeGreaterThan(1)
    })
  })

  it('filters data when clicking on metric cards', async () => {
    render(<PalliativeCarePc1Client />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    // Click 'ชดเชยแล้ว' card button
    const paidCardBtn = screen.getByRole('button', { name: /ชดเชยแล้ว/ })
    fireEvent.click(paidCardBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('paidStatus=PAID'), expect.anything())
      expect(paidCardBtn).toHaveClass('is-active')
    })

    // Click 'ยังไม่ชดเชย' card button
    const unpaidCardBtn = screen.getByRole('button', { name: /ยังไม่ชดเชย/ })
    fireEvent.click(unpaidCardBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('paidStatus=UNPAID'), expect.anything())
      expect(unpaidCardBtn).toHaveClass('is-active')
    })

    // Click 'ผู้ป่วยทั้งหมด' to reset
    const allCardBtn = screen.getByRole('button', { name: /ผู้ป่วยทั้งหมด/ })
    fireEvent.click(allCardBtn)

    await waitFor(() => {
      expect(allCardBtn).toHaveClass('is-active')
    })
  })
})
