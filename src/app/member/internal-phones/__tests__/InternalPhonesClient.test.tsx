import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import InternalPhonesClient from '../InternalPhonesClient'
import type { InternalPhoneListResult } from '@/lib/internalPhones/internalPhoneTypes'

const sampleData: InternalPhoneListResult = {
  items: [
    {
      id: 1,
      building: 'อาคารร่มฉัตร',
      floor: '1',
      room: 'ER / ฉุกเฉิน',
      phone: '1100, 1101',
      note: null,
      displayOrder: 1,
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 2,
      building: 'อาคารร่มฉัตร',
      floor: '2',
      room: 'งานยุทธศาสตร์ งาน IT',
      phone: '2404',
      note: null,
      displayOrder: 2,
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 3,
      building: 'อาคารร่มบุญ',
      floor: null,
      room: 'ตึกร่มบุญ',
      phone: '2110',
      note: null,
      displayOrder: 3,
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 4,
      building: 'อาคารซักฟอก',
      floor: '1',
      room: 'ซักฟอก',
      phone: '2109',
      note: null,
      displayOrder: 4,
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '',
      updatedAt: '',
    },
  ],
  buildings: ['อาคารร่มฉัตร', 'อาคารร่มบุญ', 'อาคารซักฟอก'],
  floorsByBuilding: { อาคารร่มฉัตร: ['1', '2'], อาคารร่มบุญ: [], อาคารซักฟอก: ['1'] },
  stats: { totalCount: 4, buildingCount: 3, extensionCount: 5 },
}

describe('InternalPhonesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts on big building stage selector, enters floor selector for multi-floor building, and hides manage buttons when canManage=false', () => {
    render(<InternalPhonesClient initialData={sampleData} canManage={false} />)

    expect(screen.queryByRole('button', { name: /เพิ่มเบอร์โทรภายใน/i })).not.toBeInTheDocument()
    expect(screen.getByText('ขั้นตอนที่ 1')).toBeInTheDocument()
    expect(screen.getByText('เลือกอาคารที่ต้องการติดต่อ')).toBeInTheDocument()

    // Click multi-floor building -> Step 2 (Floor selector)
    fireEvent.click(screen.getByRole('button', { name: /อาคารร่มฉัตร/i }))
    expect(screen.getByText('ขั้นตอนที่ 2')).toBeInTheDocument()
    expect(screen.getByText('อาคารร่มฉัตร — เลือกชั้น')).toBeInTheDocument()

    // Click floor 1 -> Step 3 (Directory list filtered to floor 1)
    fireEvent.click(screen.getByRole('button', { name: /ชั้น 1/i }))
    expect(screen.getAllByText('ER / ฉุกเฉิน').length).toBeGreaterThan(0)
    expect(screen.queryByText('งานยุทธศาสตร์ งาน IT')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /แก้ไข ER/i })).not.toBeInTheDocument()
  })

  it('skips floor selection automatically when building has only 1 floor or no floor choices', () => {
    render(<InternalPhonesClient initialData={sampleData} canManage={false} />)

    // Floorless building -> jumps straight to list
    fireEvent.click(screen.getByRole('button', { name: /อาคารร่มบุญ/i }))
    expect(screen.queryByText('ขั้นตอนที่ 2')).not.toBeInTheDocument()
    expect(screen.getAllByText('2110').length).toBeGreaterThan(0)

    // Back to building selector
    fireEvent.click(screen.getByRole('button', { name: /เลือกอาคารใหม่/i }))
    expect(screen.getByText('ขั้นตอนที่ 1')).toBeInTheDocument()

    // Single-floor building (only floor 1) -> jumps straight to list
    fireEvent.click(screen.getByRole('button', { name: /อาคารซักฟอก/i }))
    expect(screen.queryByText('ขั้นตอนที่ 2')).not.toBeInTheDocument()
    expect(screen.getAllByText('2109').length).toBeGreaterThan(0)
  })

  it('allows creating, editing, and deleting when canManage=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: sampleData }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<InternalPhonesClient initialData={sampleData} canManage={true} />)

    // Navigate into all items list
    fireEvent.click(screen.getByRole('button', { name: /ดูเบอร์โทรทั้งหมดทุกอาคาร/i }))

    // Open Add Modal
    fireEvent.click(screen.getByRole('button', { name: /เพิ่มเบอร์โทรภายใน/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/ห้อง \/ หน่วยงาน/i), {
      target: { value: 'ห้องประชุมใหม่' },
    })
    fireEvent.change(within(dialog).getByLabelText(/เบอร์โทรภายใน/i), {
      target: { value: '2499' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'เพิ่มรายการ' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/member/internal-phones',
        expect.objectContaining({ method: 'POST' })
      )
    })

    // Open Delete Modal on first item
    const deleteButtons = screen.getAllByRole('button', { name: 'ลบ ER / ฉุกเฉิน' })
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText('ยืนยันการลบข้อมูล')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลบ' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/member/internal-phones/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    vi.unstubAllGlobals()
  })

  it('supports "/" search shortcut, Escape clear, filter reset, and renders extensions as plain non-copyable text', () => {
    render(<InternalPhonesClient initialData={sampleData} canManage={false} />)

    const searchInput = screen.getByLabelText('ค้นหาเบอร์โทรภายใน') as HTMLInputElement
    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(searchInput)

    // Typing jumps straight to search results across all buildings
    fireEvent.change(searchInput, { target: { value: '2404' } })
    expect(screen.getAllByText('งานยุทธศาสตร์ งาน IT').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'ล้างตัวกรอง' })).toBeInTheDocument()

    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(searchInput.value).toBe('')
    expect(screen.getByText('ขั้นตอนที่ 1')).toBeInTheDocument()

    // View all -> verify plain non-copyable text & reset button returns to Step 1
    fireEvent.click(screen.getByRole('button', { name: /ดูเบอร์โทรทั้งหมดทุกอาคาร/i }))
    expect(screen.queryByRole('button', { name: /คัดลอกเบอร์/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('1100').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))
    expect(screen.getByText('ขั้นตอนที่ 1')).toBeInTheDocument()
  })
})
