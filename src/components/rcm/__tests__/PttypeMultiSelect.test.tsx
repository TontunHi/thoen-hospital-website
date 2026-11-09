import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PttypeMultiSelect } from '../PttypeMultiSelect'

describe('PttypeMultiSelect', () => {
  it('renders trigger button with "✓ ทุกสิทธิการรักษา" when selectedCodes is empty', () => {
    render(<PttypeMultiSelect selectedCodes={[]} onChange={vi.fn()} />)
    expect(screen.getByText('✓ ทุกสิทธิการรักษา')).toBeInTheDocument()
  })

  it('renders single selected right name', () => {
    render(
      <PttypeMultiSelect
        selectedCodes={['ชำระเงินเอง']}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('สิทธิ: ชำระเงินเอง')).toBeInTheDocument()
  })

  it('renders custom count label when multiple rights are selected', () => {
    render(<PttypeMultiSelect selectedCodes={['ชำระเงินเอง', 'ประกันสังคม']} onChange={vi.fn()} />)
    expect(screen.getByText('เลือก 2 สิทธิการรักษา')).toBeInTheDocument()
  })

  it('opens panel on click and shows search & presets', () => {
    render(<PttypeMultiSelect selectedCodes={[]} onChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i })
    fireEvent.click(button)

    expect(screen.getByPlaceholderText('ค้นหาสิทธิการรักษา...')).toBeInTheDocument()
    expect(screen.getByText('✓ ทุกสิทธิ')).toBeInTheDocument()
    expect(screen.getByText('🏥 สิทธิบัตรทอง (UC)')).toBeInTheDocument()
  })

  it('calls onChange when clicking "✓ ทุกสิทธิ"', () => {
    const onChange = vi.fn()
    render(<PttypeMultiSelect selectedCodes={['ชำระเงินเอง']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i }))

    fireEvent.click(screen.getByText('✓ ทุกสิทธิ'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('discovers options dynamically from items prop', () => {
    const mockItems = [
      { pttypename: 'ประกันสุขภาพถ้วนหน้า ใน CUP' },
      { pttypename: 'จ่ายตรงกรมบัญชีกลาง' },
      { pttypename: 'จ่ายเงินเอง' },
    ]
    render(<PttypeMultiSelect selectedCodes={[]} onChange={vi.fn()} items={mockItems} />)
    fireEvent.click(screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i }))

    expect(screen.getByText('ประกันสุขภาพถ้วนหน้า ใน CUP')).toBeInTheDocument()
    expect(screen.getByText('จ่ายตรงกรมบัญชีกลาง')).toBeInTheDocument()
    expect(screen.getByText('จ่ายเงินเอง')).toBeInTheDocument()
  })

  it('toggles an option when clicked', () => {
    const onChange = vi.fn()
    const mockOptions = [
      { code: 'ประกันสังคม', name: 'ประกันสังคม' },
      { code: 'ชำระเงินเอง', name: 'ชำระเงินเอง' },
    ]
    render(
      <PttypeMultiSelect
        selectedCodes={['ประกันสังคม']}
        onChange={onChange}
        options={mockOptions}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i }))

    const optCash = screen.getByText('ชำระเงินเอง')
    fireEvent.click(optCash)
    expect(onChange).toHaveBeenCalledWith(['ประกันสังคม', 'ชำระเงินเอง'])
  })

  it('unselects an option when already selected', () => {
    const onChange = vi.fn()
    const mockOptions = [
      { code: 'ประกันสังคม', name: 'ประกันสังคม' },
      { code: 'ชำระเงินเอง', name: 'ชำระเงินเอง' },
    ]
    render(
      <PttypeMultiSelect
        selectedCodes={['ประกันสังคม', 'ชำระเงินเอง']}
        onChange={onChange}
        options={mockOptions}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /เลือกสิทธิการรักษา/i }))

    const optSocial = screen.getByText('ประกันสังคม')
    fireEvent.click(optSocial)
    expect(onChange).toHaveBeenCalledWith(['ชำระเงินเอง'])
  })
})
