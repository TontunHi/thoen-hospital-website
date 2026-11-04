import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RepFundsClient from '../RepFundsClient'

describe('RepFundsClient Component (3.1.1)', () => {
  it('renders heading and summary metrics correctly', () => {
    render(<RepFundsClient />)

    expect(screen.getByText('3.1.1 ข้อมูล Rep แต่ละกองทุน')).toBeInTheDocument()
    expect(screen.getByText('ตรวจสอบข้อมูลการชดเชยรายบุคคล (Patient Claim Lookup)')).toBeInTheDocument()
    expect(screen.getByText('ค่ารักษาพยาบาลจริงรวม')).toBeInTheDocument()
    expect(screen.getByText('ยอดเงินชดเชย สปสช. รวม')).toBeInTheDocument()
    expect(screen.getByText('อัตราการชดเชยเฉลี่ย')).toBeInTheDocument()
  })

  it('performs quick lookup by HN and displays Rep details', () => {
    render(<RepFundsClient />)

    const hnInput = screen.getByLabelText(/เลขประจำตัวผู้ป่วย \(HN\)/)
    const dateInput = screen.getByLabelText(/วันที่รับบริการ/)
    const searchBtn = screen.getByRole('button', { name: /ค้นหาข้อมูล Rep/ })

    fireEvent.change(hnInput, { target: { value: '0012345' } })
    fireEvent.change(dateInput, { target: { value: '2026-10-15' } })
    fireEvent.click(searchBtn)

    // Check result box content
    expect(screen.getByText(/REP6901-UCS-0042/)).toBeInTheDocument()
    expect(screen.getAllByText('การดูแลประคับประคอง (Palliative Care)').length).toBeGreaterThan(0)
    expect(screen.getByText(/ชดเชยครบถ้วน/)).toBeInTheDocument()
  })

  it('handles cascading dropdown from Main Fund to Sub Fund', () => {
    render(<RepFundsClient />)

    const mainFundSelect = screen.getByLabelText('เลือกกองทุนหลัก')
    const subFundSelect = screen.getByLabelText('เลือกกองทุนย่อย')

    // Initial state: ALL
    expect(mainFundSelect).toHaveValue('ALL')
    expect(subFundSelect).toHaveValue('ALL')

    // Select SSS (ประกันสังคม)
    fireEvent.change(mainFundSelect, { target: { value: 'SSS' } })

    // Subfund dropdown should now show Dental, and not Palliative Care
    expect(screen.getAllByText(/ทันตกรรมประกันสังคม/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/โรคหลอดเลือดหัวใจวิกฤต \(STEMI\)/)).not.toBeInTheDocument()

    // Select Dental subfund
    fireEvent.change(subFundSelect, { target: { value: 'Dental' } })
    expect(subFundSelect).toHaveValue('Dental')

    // Switch main fund to UCS -> Subfund resets to ALL
    fireEvent.change(mainFundSelect, { target: { value: 'UCS' } })
    expect(subFundSelect).toHaveValue('ALL')
    expect(screen.getAllByText(/โรคหลอดเลือดหัวใจวิกฤต \(STEMI\)/).length).toBeGreaterThan(0)
  })

  it('opens case detail modal when clicking ดูเคส button', () => {
    render(<RepFundsClient />)

    const viewButtons = screen.getAllByRole('button', { name: /ดูเคส/ })
    expect(viewButtons.length).toBeGreaterThan(0)

    // Click the first one
    fireEvent.click(viewButtons[0])

    // Modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/รายการเคสผู้ป่วย:/)).toBeInTheDocument()

    // Close modal via close button
    const closeButtons = screen.getAllByRole('button', { name: /ปิดหน้าต่าง/ })
    fireEvent.click(closeButtons[0])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
