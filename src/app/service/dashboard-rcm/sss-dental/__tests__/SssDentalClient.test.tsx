import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    } as any)
  })

  it('renders command bar and title correctly', async () => {
    render(<SssDentalClient />)

    expect(screen.getByText('2.1.1.1')).toBeInTheDocument()
    expect(
      screen.getByText('รายงานการให้บริการทันตกรรม สิทธิ์ประกันสังคม')
    ).toBeInTheDocument()
    expect(screen.getByText('กำหนดเอง (วันถึงวัน)')).toBeInTheDocument()
    expect(screen.getByText('รายเดือน')).toBeInTheDocument()
    expect(screen.getByText('รายปีงบประมาณ')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ค้นหาชื่อทันตแพทย์...')).toBeInTheDocument()
    expect(screen.getByText('ส่งออก Excel')).toBeInTheDocument()
  })

  it('renders KPI metrics and quarterly grouped ledger table after data load', async () => {
    render(<SssDentalClient />)

    await waitFor(() => {
      // KPI checks
      expect(screen.getAllByText('320').length).toBeGreaterThan(0) // Visits
      expect(screen.getAllByText('฿430,000').length).toBeGreaterThan(0) // Income
      expect(screen.getAllByText('฿320,000').length).toBeGreaterThan(0) // UC
      expect(screen.getAllByText('฿100,000').length).toBeGreaterThan(0) // Cash
      expect(screen.getAllByText('฿10,000').length).toBeGreaterThan(0) // Debit
    })

    // Check Quarter Headers
    expect(screen.getByText('ไตรมาส 1 (Q1)')).toBeInTheDocument()
    expect(screen.getByText('ไตรมาส 2 (Q2)')).toBeInTheDocument()
    expect(screen.getByText('ไตรมาส 3 (Q3)')).toBeInTheDocument()
    expect(screen.getByText('ไตรมาส 4 (Q4)')).toBeInTheDocument()

    // Check Doctor rows
    expect(screen.getByText('ทพ.สมชาย ใจดี')).toBeInTheDocument()
    expect(screen.getByText('ทพญ.สมศรี รักฟัน')).toBeInTheDocument()
  })

  it('filters doctors by search input', async () => {
    render(<SssDentalClient />)

    await waitFor(() => {
      expect(screen.getByText('ทพ.สมชาย ใจดี')).toBeInTheDocument()
      expect(screen.getByText('ทพญ.สมศรี รักฟัน')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('ค้นหาชื่อทันตแพทย์...')
    fireEvent.change(searchInput, { target: { value: 'สมศรี' } })

    expect(screen.getByText('ทพญ.สมศรี รักฟัน')).toBeInTheDocument()
    expect(screen.queryByText('ทพ.สมชาย ใจดี')).not.toBeInTheDocument()
  })

  it('sorts doctors when clicking sortable header', async () => {
    render(<SssDentalClient />)

    await waitFor(() => {
      expect(screen.getByText('ทพ.สมชาย ใจดี')).toBeInTheDocument()
    })

    // Default is total_income desc: D02 (280,000) should appear before D01 (150,000)
    const doctorNamesBefore = screen.getAllByText(/ทพ/).map((el) => el.textContent)
    expect(doctorNamesBefore[0]).toContain('สมศรี')

    // Click total_income header to sort ascending
    const incomeHeader = screen.getByTitle('คลิกเพื่อเรียงตามค่ารักษาพยาบาลรวม')
    fireEvent.click(incomeHeader)

    // Now D01 (150,000) should appear first
    const doctorNamesAfter = screen.getAllByText(/ทพ/).map((el) => el.textContent)
    expect(doctorNamesAfter[0]).toContain('สมชาย')
  })
})
