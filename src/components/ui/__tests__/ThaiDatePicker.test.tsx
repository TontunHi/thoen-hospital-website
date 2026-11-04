import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ThaiDatePicker from '../ThaiDatePicker'

describe('ThaiDatePicker Component', () => {
  it('renders formatted Thai Buddhist date when value is provided', () => {
    render(<ThaiDatePicker value="2026-11-04" onChange={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('4 พ.ย. 2569')
  })

  it('renders placeholder when value is empty', () => {
    render(<ThaiDatePicker value="" onChange={vi.fn()} placeholder="วว/ดด/ปปปป" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('วว/ดด/ปปปป')
  })

  it('opens popover on click and allows selecting a day', () => {
    const handleChange = vi.fn()
    render(<ThaiDatePicker value="2026-11-04" onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.click(input)

    // Popover is open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('เลือกเดือน')).toHaveValue('10') // November is 10 (0-indexed)

    // Click day 15
    const day15 = screen.getByTitle('วันที่ 15 พฤศจิกายน พ.ศ. 2569')
    fireEvent.click(day15)

    expect(handleChange).toHaveBeenCalledWith('2026-11-15')
    // Popover closes after selection
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('allows clicking "วันนี้" to select current date', () => {
    const handleChange = vi.fn()
    render(<ThaiDatePicker value="" onChange={handleChange} />)

    fireEvent.click(screen.getByRole('textbox'))
    const todayBtn = screen.getByText('วันนี้')
    fireEvent.click(todayBtn)

    expect(handleChange).toHaveBeenCalled()
    const callArg = handleChange.mock.calls[0][0]
    expect(callArg).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('parses typed DD/MM/BBBB on enter or blur', () => {
    const handleChange = vi.fn()
    render(<ThaiDatePicker value="" onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '15/11/2569' } })
    fireEvent.blur(input)

    expect(handleChange).toHaveBeenCalledWith('2026-11-15')
  })

  it('clears date when clear button is clicked', () => {
    const handleChange = vi.fn()
    render(<ThaiDatePicker value="2026-11-04" onChange={handleChange} />)

    const clearBtn = screen.getByTitle('ล้างค่าวันที่')
    fireEvent.click(clearBtn)

    expect(handleChange).toHaveBeenCalledWith('')
  })
})
