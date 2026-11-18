import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SssDentalClient from '../SssDentalClient'

const mockApiResponse = {
  success: true,
  doctors: [
    {
      doctor_code: 'D01',
      doctor_name: 'ทพ.สมชาย ใจดี',
      total_visits: 120,
      total_income: 150000,
      total_uc_money: 120000,
      total_rcpt_money: 30000,
      total_discount: 0,
      total_debit: 0,
      monthly_income: { '2025-10': 15000, '2025-11': 12000 },
      monthly_visits: { '2025-10': 12, '2025-11': 10 },
    },
    {
      doctor_code: 'D02',
      doctor_name: 'ทพญ.สมศรี รักฟัน',
      total_visits: 200,
      total_income: 280000,
      total_uc_money: 200000,
      total_rcpt_money: 70000,
      total_discount: 0,
      total_debit: 10000,
      monthly_income: { '2025-10': 25000, '2025-11': 22000 },
      monthly_visits: { '2025-10': 20, '2025-11': 18 },
    },
  ],
  months: ['2025-10', '2025-11'],
  monthlyTotals: {
    '2025-10': { income: 40000, visits: 32 },
    '2025-11': { income: 34000, visits: 28 },
  },
  grandTotal: {
    visits: 320,
    income: 430000,
    uc_money: 320000,
    rcpt_money: 100000,
    discount: 0,
    debit: 10000,
  },
}

describe('SssDentalClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockApiResponse),
    } as unknown as Response)
  })

  it('renders command header and standardized date tabs correctly', async () => {
    render(<SssDentalClient initialData={mockApiResponse} />)

    expect(screen.getByText('2.1.1.1')).toBeInTheDocument()
    expect(
      screen.getByText('รายงานการให้บริการทันตกรรม สิทธิ์ประกันสังคม')
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'กำหนดเอง' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'เดือน' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ปีงบประมาณ' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ค้นหาชื่อทันตแพทย์...')).toBeInTheDocument()
    expect(screen.getByText('ส่งออก Excel')).toBeInTheDocument()
    // Double-fetch guard: should not call fetch on initial mount when initialData is provided
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches with AbortController signal when no initialData and renders known totals', async () => {
    render(<SssDentalClient />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/sss-dental'),
        expect.anything()
      )
      expect(screen.getAllByText('320').length).toBeGreaterThan(0)
      expect(screen.getAllByText('฿430,000').length).toBeGreaterThan(0)
      expect(screen.getAllByText('฿320,000').length).toBeGreaterThan(0)
      expect(screen.getAllByText('฿100,000').length).toBeGreaterThan(0)
      expect(screen.getAllByText('฿10,000').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('ไตรมาส 1 (Q1)')).toBeInTheDocument()
    expect(screen.getByText('ไตรมาส 2 (Q2)')).toBeInTheDocument()
    expect(screen.getByText('ไตรมาส 3 (Q3)')).toBeInTheDocument()
    expect(screen.getByText('ไตรมาส 4 (Q4)')).toBeInTheDocument()
    expect(screen.getAllByText('ทพ.สมชาย ใจดี').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ทพญ.สมศรี รักฟัน').length).toBeGreaterThan(0)
  })

  it('switches chart metric when clicking KPI tiles and filters debit doctors', () => {
    render(<SssDentalClient initialData={mockApiResponse} />)

    // Switch chart from income to visits
    const visitsTile = screen.getByRole('button', { name: /จำนวนครั้งรับบริการ/ })
    fireEvent.click(visitsTile)
    expect(screen.getByText('แนวโน้มจำนวนครั้งบริการรายเดือน')).toBeInTheDocument()

    // Filter only doctors with outstanding debit (> 0)
    const debitFilterBtn = screen.getByRole('button', { name: /มีลูกหนี้ค้าง \(1\)/ })
    fireEvent.click(debitFilterBtn)
    expect(screen.getAllByText('ทพญ.สมศรี รักฟัน').length).toBeGreaterThan(0)
    expect(screen.queryByText('ทพ.สมชาย ใจดี')).not.toBeInTheDocument()
  })

  it('filters doctors by search input and sorts by income header', () => {
    render(<SssDentalClient initialData={mockApiResponse} />)

    const table = screen.getByRole('table')
    const searchInput = screen.getByPlaceholderText('ค้นหาชื่อทันตแพทย์...')
    fireEvent.change(searchInput, { target: { value: 'สมศรี' } })
    expect(within(table).getByText('ทพญ.สมศรี รักฟัน')).toBeInTheDocument()
    expect(within(table).queryByText('ทพ.สมชาย ใจดี')).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })

    const incomeHeader = screen.getByTitle('คลิกเพื่อเรียงตามค่ารักษาพยาบาลรวม')
    fireEvent.click(incomeHeader)

    const rows = table.querySelectorAll('tbody tr')
    expect(rows[0].textContent).toContain('ทพ.สมชาย ใจดี')
  })
})
