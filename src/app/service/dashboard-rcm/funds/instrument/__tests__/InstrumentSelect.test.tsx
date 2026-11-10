import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { InstrumentSelect } from '../InstrumentSelect'
import type { InstrumentOptionItem } from '@/lib/clinical/rcmInstrumentFundService'

const mockItems: InstrumentOptionItem[] = [
  { id: '7004', code: '7004', name: 'ข้อเข่าเทียม', count: 15, category: 'OA' },
  { id: '7005', code: '7005', name: 'เบ้ารองข้อเข่า', count: 12, category: 'OA' },
  { id: '8612', code: '8612', name: 'แถบตรวจน้ำตาล', count: 42, category: 'DM' },
  { id: '8813', code: '8813', name: 'แผ่นตรวจน้ำตาล', count: 30, category: 'DM' },
  { id: 'สายดูดเสมหะ', code: '-', name: 'สายดูดเสมหะ', count: 5, category: 'OTHER' },
  { id: 'ท่อช่วยหายใจ', code: '-', name: 'ท่อช่วยหายใจ', count: 3, category: 'OTHER' },
]

describe('InstrumentSelect', () => {
  it('renders trigger button and shows default label when value is empty', () => {
    render(<InstrumentSelect value="" onChange={vi.fn()} items={mockItems} />)

    const trigger = screen.getByTestId('instrument-select-trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent(/อุปกรณ์ทั้งหมด \(6 ชนิด\)/)
  })

  it('renders selected item badge and name on trigger button when value is set', () => {
    render(<InstrumentSelect value="7004" onChange={vi.fn()} items={mockItems} />)

    const trigger = screen.getByTestId('instrument-select-trigger')
    expect(trigger).toHaveTextContent('7004')
    expect(trigger).toHaveTextContent('ข้อเข่าเทียม')
  })

  it('opens panel and renders all options with unique keys (including multiple items with code -)', () => {
    render(<InstrumentSelect value="" onChange={vi.fn()} items={mockItems} />)

    fireEvent.click(screen.getByTestId('instrument-select-trigger'))

    // Dialog should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('instrument-option-all')).toBeInTheDocument()
    expect(screen.getByTestId('instrument-option-7004')).toBeInTheDocument()
    expect(screen.getByTestId('instrument-option-7005')).toBeInTheDocument()
    expect(screen.getByTestId('instrument-option-8612')).toBeInTheDocument()
    // Multiple items with code '-' must have unique testids and render without key collisions
    expect(screen.getByTestId('instrument-option-สายดูดเสมหะ')).toBeInTheDocument()
    expect(screen.getByTestId('instrument-option-ท่อช่วยหายใจ')).toBeInTheDocument()
  })

  it('filters options by search input inside dropdown', () => {
    render(<InstrumentSelect value="" onChange={vi.fn()} items={mockItems} />)

    fireEvent.click(screen.getByTestId('instrument-select-trigger'))

    const searchInput = screen.getByPlaceholderText('ค้นหารหัส ADP หรือชื่ออุปกรณ์...')
    fireEvent.change(searchInput, { target: { value: 'เบ้ารอง' } })

    expect(screen.getByText('เบ้ารองข้อเข่า')).toBeInTheDocument()
    expect(screen.queryByText('แถบตรวจน้ำตาล')).not.toBeInTheDocument()
  })

  it('filters options by category tab (e.g. OA, DM)', () => {
    render(<InstrumentSelect value="" onChange={vi.fn()} items={mockItems} />)

    fireEvent.click(screen.getByTestId('instrument-select-trigger'))

    const oaButton = screen.getByRole('button', { name: /ผ่าข้อเข่า OA/ })
    fireEvent.click(oaButton)

    expect(screen.getByText('ข้อเข่าเทียม')).toBeInTheDocument()
    expect(screen.getByText('เบ้ารองข้อเข่า')).toBeInTheDocument()
    expect(screen.queryByText('แถบตรวจน้ำตาล')).not.toBeInTheDocument()
  })

  it('calls onChange with selected value when an option is clicked', () => {
    const handleChange = vi.fn()
    render(<InstrumentSelect value="" onChange={handleChange} items={mockItems} />)

    fireEvent.click(screen.getByTestId('instrument-select-trigger'))
    fireEvent.click(screen.getByTestId('instrument-option-8612'))

    expect(handleChange).toHaveBeenCalledWith('8612')
  })

  it('clears selection when clear button is clicked', () => {
    const handleChange = vi.fn()
    render(<InstrumentSelect value="7004" onChange={handleChange} items={mockItems} />)

    const clearBtn = screen.getByTitle('ล้างตัวกรองอุปกรณ์')
    fireEvent.click(clearBtn)

    expect(handleChange).toHaveBeenCalledWith('')
  })

  it('closes dropdown when Escape key is pressed', () => {
    render(<InstrumentSelect value="" onChange={vi.fn()} items={mockItems} />)

    fireEvent.click(screen.getByTestId('instrument-select-trigger'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
