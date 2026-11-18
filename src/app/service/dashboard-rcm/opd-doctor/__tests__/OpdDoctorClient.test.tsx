import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpdDoctorClient from '../OpdDoctorClient'
import { OpdDoctorSummaryResult } from '@/lib/clinical/rcmDashboardService'

const mockInitialData: OpdDoctorSummaryResult = {
  months: ['2025-10', '2025-11'],
  doctors: [
    {
      doctor_code: 'MD01',
      doctor_name: 'นพ.กิตติ ใจดี',
      total_visits: 450,
      total_income: 520000,
      total_uc_money: 480000,
      total_rcpt_money: 30000,
      total_discount: 0,
      total_debit: 10000,
      monthly_income: { '2025-10': 260000, '2025-11': 260000 },
      monthly_visits: { '2025-10': 220, '2025-11': 230 },
    },
    {
      doctor_code: 'MD02',
      doctor_name: 'พญ.ณิชา สุขสันต์',
      total_visits: 300,
      total_income: 380000,
      total_uc_money: 350000,
      total_rcpt_money: 30000,
      total_discount: 0,
      total_debit: 0,
      monthly_income: { '2025-10': 190000, '2025-11': 190000 },
      monthly_visits: { '2025-10': 150, '2025-11': 150 },
    },
  ],
  monthlyTotals: {
    '2025-10': { income: 450000, visits: 370 },
    '2025-11': { income: 450000, visits: 380 },
  },
  grandTotal: {
    visits: 750,
    income: 900000,
    uc_money: 830000,
    rcpt_money: 60000,
    discount: 0,
    debit: 10000,
  },
  allPttypeOptions: [
    { code: 'UCS', name: 'หลักประกันสุขภาพถ้วนหน้า' },
    { code: 'OFC', name: 'ข้าราชการ/จ่ายตรง' },
  ],
}

describe('OpdDoctorClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true, ...mockInitialData }),
    } as unknown as Response)
  })

  it('skips initial fetch when SSR initialData is provided and displays known totals', () => {
    render(<OpdDoctorClient initialData={mockInitialData} />)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('2.1.1.2')).toBeInTheDocument()
    expect(screen.getAllByText('750').length).toBeGreaterThan(0)
    expect(screen.getAllByText('฿900,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('฿830,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('฿10,000').length).toBeGreaterThan(0)
  })

  it('opens 37 e-Claim filter popover, selects a pttype chip, and refetches with AbortController signal', async () => {
    render(<OpdDoctorClient initialData={mockInitialData} />)

    fireEvent.click(screen.getByRole('button', { name: /ทุกสิทธิ \(37\)/ }))
    expect(screen.getByRole('dialog', { name: 'ตัวกรองสิทธิ e-Claim' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /UCS · หลักประกันสุขภาพถ้วนหน้า/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('eclaims=UCS'),
        expect.anything()
      )
    })

    expect(screen.getByText('UCS: หลักประกันสุขภาพถ้วนหน้า')).toBeInTheDocument()
  })

  it('filters doctors with debit > 0 when clicking debit attention button', () => {
    render(<OpdDoctorClient initialData={mockInitialData} />)

    fireEvent.click(screen.getByRole('button', { name: /มีลูกหนี้ค้าง \(1\)/ }))

    expect(screen.getAllByText('นพ.กิตติ ใจดี').length).toBeGreaterThan(0)
    expect(screen.queryByText('พญ.ณิชา สุขสันต์')).not.toBeInTheDocument()
  })
})
