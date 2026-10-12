import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  })
})
