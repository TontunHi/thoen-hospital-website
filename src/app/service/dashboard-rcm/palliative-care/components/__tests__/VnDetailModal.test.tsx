import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { VnDetailModal } from '../VnDetailModal'

const mockVnData = {
  success: true,
  data: {
    header: {
      vn: '691021131643',
      hn: '0000206',
      cid: '3520800269098',
      ptname: 'นางจันทนา ตันมา',
      age: 60,
      sex: 'หญิง',
      vstdate: '2026-10-21',
      vsttime: '13:16:43',
      pttypename: 'บัตรทอง',
      department: 'จุดซักประวัติ Palliative Care',
      clinic: 'อายุรกรรม',
    },
    screen: {
      bw: 52,
      height: 159,
      bmi: 20.57,
      bps: 120,
      bpd: 80,
      pulse: 80,
      rr: 20,
      temperature: 36.5,
      spo2: 98,
      fbs: null,
      cc: 'case CA corpus',
      hpi: 'โทรติดตามเยี่ยมบ้าน case CA corpus',
      pmh: 'CA corpus uteri',
      pe: 'no abnormal signs',
      screen_dep: '122',
      screen_dep_name: 'จุดซักประวัติ Palliative Care',
      symptom: null,
    },
    diagnoses: [
      {
        icd10: 'C548',
        icd_name: 'Malignant neoplasm of corpus uteri',
        diagtype: '1',
        diagtype_name: 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)',
        doctor_name: 'พญ.สุทธิดา จตุจินดา',
      },
      {
        icd10: 'Z515',
        icd_name: 'Palliative care',
        diagtype: '2',
        diagtype_name: 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)',
        doctor_name: 'พญ.สุทธิดา จตุจินดา',
      },
    ],
    orders: {
      items: [
        {
          icode: '1500001',
          item_name: 'Morphine syrup 10 mg/5 mL',
          strength: '10 mg/5 mL',
          units: 'ขวด',
          qty: 2,
          unitprice: 150,
          sum_price: 300,
          paidst: '02',
          paidst_name: 'ลูกหนี้สิทธิ',
          income_code: '03',
          income_name: 'ค่ายาในบัญชียาหลักแห่งชาติ',
          category_group: 'DRUG' as const,
          drugusage_text: 'รับประทานครั้งละ 1 ช้อนชา',
        },
        {
          icode: '3002602',
          item_name: 'ค่าเยี่ยมบ้าน Palliative care',
          strength: null,
          units: null,
          qty: 1,
          unitprice: 200,
          sum_price: 200,
          paidst: '02',
          paidst_name: 'ลูกหนี้สิทธิ',
          income_code: '36',
          income_name: 'บริการอื่นๆ และส่งเสริมป้องกันโรค',
          category_group: 'PROCEDURE_SERVICE' as const,
          drugusage_text: '',
        },
      ],
      categories: [
        {
          category_group: 'DRUG' as const,
          title: 'ยาและเวชภัณฑ์ยา',
          total_price: 300,
          item_count: 1,
          items: [],
        },
        {
          category_group: 'PROCEDURE_SERVICE' as const,
          title: 'หัตถการและค่าบริการทางการพยาบาล / การแพทย์',
          total_price: 200,
          item_count: 1,
          items: [],
        },
      ],
      total_price: 500,
      total_items: 3,
      total_paid: 0,
      total_claim: 500,
    },
  },
}

describe('VnDetailModal', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('vn=691021131643')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVnData),
        })
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, error: 'Not found' }),
      })
    }) as any
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('renders nothing when vn is null', () => {
    const { container } = render(<VnDetailModal vn={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('fetches and displays patient banner and default screen tab (opdscreen)', async () => {
    render(<VnDetailModal vn="691021131643" onClose={vi.fn()} />)

    expect(screen.getByText(/กำลังดึงข้อมูลการรับบริการ/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    expect(screen.getByText('VN: 691021131643')).toBeInTheDocument()
    expect(screen.getByText('0000206')).toBeInTheDocument()
    expect(screen.getByText('120/80')).toBeInTheDocument()
    expect(screen.getByText('case CA corpus')).toBeInTheDocument()
  })

  it('switches to diagnoses tab (ovstdiag) and displays ICD-10 list', async () => {
    render(<VnDetailModal vn="691021131643" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    const diagTabBtn = screen.getByRole('button', { name: /การวินิจฉัยโรค/i })
    fireEvent.click(diagTabBtn)

    expect(screen.getByText('C548')).toBeInTheDocument()
    expect(screen.getByText('Malignant neoplasm of corpus uteri')).toBeInTheDocument()
    expect(screen.getByText('Z515')).toBeInTheDocument()
    expect(screen.getByText('Palliative care')).toBeInTheDocument()
  })

  it('switches to orders tab (opitemrece) and displays financial summary and itemized table', async () => {
    render(<VnDetailModal vn="691021131643" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    const ordersTabBtn = screen.getByRole('button', { name: /รายการยาและค่ารักษา/i })
    fireEvent.click(ordersTabBtn)

    expect(screen.getByText('Morphine syrup 10 mg/5 mL')).toBeInTheDocument()
    expect(screen.getByText('ค่าเยี่ยมบ้าน Palliative care')).toBeInTheDocument()
    expect(screen.getAllByText('500.00 ฿').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn()
    render(<VnDetailModal vn="691021131643" onClose={handleClose} />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    const closeBtns = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/i })
    expect(closeBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(closeBtns[0])

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', async () => {
    const handleClose = vi.fn()
    render(<VnDetailModal vn="691021131643" onClose={handleClose} />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
