import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AdpMultiSelect from '../AdpMultiSelect'
import type { AdpOption } from '@/lib/clinical/rcmAdpSearchService'

describe('AdpMultiSelect Component', () => {
  const sampleOptions: AdpOption[] = [
    { code: '14001', title: 'ยาเสริมธาตุเหล็ก (13-45 ปี)', category: 'ยา & เวชภัณฑ์' },
    { code: '12003', title: 'ตรวจ Fasting Plasma Glucose', category: 'ตรวจทางห้องปฏิบัติการ' },
    { code: '90005', title: 'คัดกรองมะเร็งลำไส้ใหญ่ Fit test', category: 'คัดกรองมะเร็ง' },
    { code: '15001', title: 'เคลือบฟลูออไรด์ (กลุ่มเสี่ยง)', category: 'ทันตกรรม' },
  ]

  it('renders trigger with placeholder when no codes are selected', () => {
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={[]}
        onChange={vi.fn()}
      />
    )

    expect(
      screen.getByText('เลือกรหัส ADP (สามารถเลือกได้หลายรหัส)...')
    ).toBeInTheDocument()
  })

  it('renders selected chips and count badge when codes are selected', () => {
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001', '12003']}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('14001')).toBeInTheDocument()
    expect(screen.getByText('12003')).toBeInTheDocument()
    expect(screen.getByText('2 รหัส')).toBeInTheDocument()
  })

  it('opens dropdown popover when trigger is clicked', () => {
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001']}
        onChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    expect(screen.getByPlaceholderText('พิมพ์เพื่อค้นหารหัส หรือชื่อรายการ...')).toBeInTheDocument()
    expect(screen.getByText('ยาเสริมธาตุเหล็ก (13-45 ปี)')).toBeInTheDocument()
    expect(screen.getByText('ตรวจ Fasting Plasma Glucose')).toBeInTheDocument()
  })

  it('filters options by search input', () => {
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={[]}
        onChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('พิมพ์เพื่อค้นหารหัส หรือชื่อรายการ...')
    fireEvent.change(searchInput, { target: { value: 'glucose' } })

    expect(screen.getByText('ตรวจ Fasting Plasma Glucose')).toBeInTheDocument()
    expect(screen.queryByText('ยาเสริมธาตุเหล็ก (13-45 ปี)')).not.toBeInTheDocument()
  })

  it('filters options by category tabs', () => {
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={[]}
        onChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    const dentalTab = screen.getByRole('button', { name: 'ทันตกรรม' })
    fireEvent.click(dentalTab)

    expect(screen.getByText('เคลือบฟลูออไรด์ (กลุ่มเสี่ยง)')).toBeInTheDocument()
    expect(screen.queryByText('ตรวจ Fasting Plasma Glucose')).not.toBeInTheDocument()
  })

  it('toggles selection when clicking an option row', () => {
    const handleChange = vi.fn()
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001']}
        onChange={handleChange}
      />
    )

    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    // Click 12003 to add it
    const option12003 = screen.getByText('ตรวจ Fasting Plasma Glucose')
    fireEvent.click(option12003)
    expect(handleChange).toHaveBeenCalledWith(['14001', '12003'])

    // Click 14001 to remove it
    const option14001 = screen.getByText('ยาเสริมธาตุเหล็ก (13-45 ปี)')
    fireEvent.click(option14001)
    expect(handleChange).toHaveBeenCalledWith([])
  })

  it('allows adding a custom code not in options list', () => {
    const handleChange = vi.fn()
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001']}
        onChange={handleChange}
      />
    )

    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('พิมพ์เพื่อค้นหารหัส หรือชื่อรายการ...')
    fireEvent.change(searchInput, { target: { value: '998877' } })

    // Look for custom add button
    const addCustomBtn = screen.getByRole('button', { name: /เพิ่มรหัส 998877/i })
    expect(addCustomBtn).toBeInTheDocument()
    fireEvent.click(addCustomBtn)

    expect(handleChange).toHaveBeenCalledWith(['14001', '998877'])
  })

  it('removes an individual code when clicking the chip remove button', () => {
    const handleChange = vi.fn()
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001', '12003']}
        onChange={handleChange}
      />
    )

    const removeBtn = screen.getByRole('button', { name: 'ลบรหัส 14001' })
    fireEvent.click(removeBtn)

    expect(handleChange).toHaveBeenCalledWith(['12003'])
  })

  it('clears all selected codes when clicking the clear button', () => {
    const handleChange = vi.fn()
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001', '12003']}
        onChange={handleChange}
      />
    )

    const clearBtn = screen.getByRole('button', { name: 'ล้างรหัสที่เลือกทั้งหมด' })
    fireEvent.click(clearBtn)

    expect(handleChange).toHaveBeenCalledWith([])
  })

  it('calls onSearchSubmit when clicking footer search button', () => {
    const handleSearch = vi.fn()
    render(
      <AdpMultiSelect
        options={sampleOptions}
        selectedCodes={['14001']}
        onChange={vi.fn()}
        onSearchSubmit={handleSearch}
      />
    )

    const trigger = screen.getByRole('button', { name: /เลือกหรือค้นหารหัส ADP/i })
    fireEvent.click(trigger)

    const submitBtn = screen.getByRole('button', { name: /ค้นหาทันที/i })
    fireEvent.click(submitBtn)

    expect(handleSearch).toHaveBeenCalledTimes(1)
  })
})
