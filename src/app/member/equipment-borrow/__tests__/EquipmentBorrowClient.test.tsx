import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import EquipmentBorrowClient from '../EquipmentBorrowClient'

describe('EquipmentBorrowClient Component', () => {
  const initialStats = {
    totalItems: 42,
    availableItems: 35,
    borrowedItems: 7,
    overdueRequests: 1,
  }

  const staffUser = {
    id: 10,
    username: 'staff1',
    name: 'เจ้าหน้าที่พยาบาล',
    role: 'nurse',
    department: 'OPD',
    isAdmin: false,
    canManageBorrow: false,
  }

  const adminUser = {
    id: 1,
    username: 'admin',
    name: 'ผู้ดูแลระบบพัสดุ',
    role: 'admin',
    department: 'งานพัสดุ',
    isAdmin: true,
    canManageBorrow: true,
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: [] }),
    }))
  })

  it('renders stats cards and title for hospital staff', () => {
    render(<EquipmentBorrowClient initialStats={initialStats} currentUser={staffUser} />)

    expect(screen.getByText('ระบบยืม-คืนอุปกรณ์และพัสดุ')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    // Staff sees standard tabs
    expect(screen.getByText('คลังอุปกรณ์พร้อมยืม')).toBeInTheDocument()
    expect(screen.getByText('คำขอของฉัน')).toBeInTheDocument()

    // Staff does NOT see admin tabs
    expect(screen.queryByText(/จัดการคำขอ & รับคืน/)).not.toBeInTheDocument()
    expect(screen.queryByText('จัดการข้อมูลคลัง')).not.toBeInTheDocument()
  })

  it('renders admin tabs when user has canManageBorrow permission', () => {
    render(<EquipmentBorrowClient initialStats={initialStats} currentUser={adminUser} />)

    expect(screen.getByText(/จัดการคำขอ & รับคืน/)).toBeInTheDocument()
    expect(screen.getByText('จัดการข้อมูลคลัง')).toBeInTheDocument()
  })

  it('opens borrow request modal when clicking quick borrow button', () => {
    render(<EquipmentBorrowClient initialStats={initialStats} currentUser={staffUser} />)

    const borrowBtn = screen.getByRole('button', { name: 'ขอยืมอุปกรณ์' })
    fireEvent.click(borrowBtn)

    expect(screen.getByText('📋 แบบฟอร์มขอยืมอุปกรณ์และวัสดุ')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/เช่น เพื่อใช้ในงานสัมมนา/)).toBeInTheDocument()
    expect(screen.getByText(/วันที่คาดว่าจะส่งคืน/)).toBeInTheDocument()
  })

  it('renders request detail modal when clicking view details on a request', async () => {
    const mockRequest = {
      id: 1,
      requestNo: 'BR-202610-0001',
      requesterId: 10,
      requesterName: 'นายสมชาย ใจดี',
      requesterDept: 'แผนกผู้ป่วยนอก (OPD)',
      purpose: 'ใช้สำหรับกิจกรรมหน่วยแพทย์เคลื่อนที่',
      location: 'ศาลาประชาคม',
      borrowDate: '2026-10-19T00:00:00.000Z',
      expectedReturnDate: '2026-10-20T00:00:00.000Z',
      actualReturnDate: null,
      phone: '0812345678',
      status: 'APPROVED',
      approvedByName: 'หัวหน้างานพัสดุ',
      createdAt: '2026-10-19T08:30:00.000Z',
      items: [
        {
          id: 101,
          itemType: 'ASSET',
          itemName: 'โปรเจคเตอร์ Epson EB-X51',
          itemCode: '7440-001-0001',
          quantity: 1,
          returnedQty: 0,
          status: 'BORROWED',
          returnCondition: null,
          returnNotes: null
        }
      ]
    }

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/member/equipment-borrow/history')) {
        return Promise.resolve({
          json: async () => ({ success: true, items: [mockRequest] }),
        })
      }
      return Promise.resolve({
        json: async () => ({ success: true, data: [] }),
      })
    }))

    render(<EquipmentBorrowClient initialStats={initialStats} currentUser={adminUser} />)

    // Click approvals tab
    const approvalsTab = screen.getByText(/จัดการคำขอ & รับคืน/)
    fireEvent.click(approvalsTab)

    // Click 'ประวัติทุกคำขอ' subtab
    const allHistoryTab = await screen.findByText(/ประวัติทุกคำขอ/)
    fireEvent.click(allHistoryTab)

    // Find and click 'ดูรายละเอียด'
    const viewDetailBtn = await screen.findByRole('button', { name: /ดูรายละเอียด/ })
    fireEvent.click(viewDetailBtn)

    // Verify modal pops up with correct details
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('BR-202610-0001')).toBeInTheDocument()
    expect(within(dialog).getByText('นายสมชาย ใจดี')).toBeInTheDocument()
    expect(within(dialog).getByText(/แผนกผู้ป่วยนอก \(OPD\)/)).toBeInTheDocument()
    expect(within(dialog).getByText('ใช้สำหรับกิจกรรมหน่วยแพทย์เคลื่อนที่')).toBeInTheDocument()
    expect(within(dialog).getByText('ศาลาประชาคม')).toBeInTheDocument()
    expect(within(dialog).getByText('โปรเจคเตอร์ Epson EB-X51')).toBeInTheDocument()
    expect(within(dialog).getByText(/7440-001-0001/)).toBeInTheDocument()

    // Close button dismisses modal
    const closeBtns = within(dialog).getAllByRole('button', { name: 'ปิดหน้าต่าง' })
    expect(closeBtns.length).toBeGreaterThan(0)
    fireEvent.click(closeBtns[0])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
