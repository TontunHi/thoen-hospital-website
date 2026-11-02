import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PalliativeRegistryClient from '../PalliativeRegistryClient'

const mockData = {
  success: true,
  permissions: {
    canView: true,
    canEdit: true,
    canManage: true,
  },
  items: [
    {
      id: 1,
      hn: '000206',
      patientName: 'นางจันทนา ตันมา',
      address: '205/1 ม.4 ต.เถินบุรี',
      phone: '065-2488015',
      icd10Principal: 'C548 CA corpus',
      icd10Palliative: 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
      projectCode: '(30001, cONS01ลงทุกเคส )',
      registrationStatus: 'ดำเนินการเรียบร้อย',
      visit1Date: '2/11/2026',
      visit1Status: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
      visit2Date: null,
      visit2Status: 'ยังไม่ได้เยี่ยม',
      deathDate: null,
      deathEntryStatus: null,
      claimStatus: 'ลงข้อมูล',
      claimResult: 'ได้เงิน',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  totalPages: 1,
  stats: {
    total: 1,
    registered: 1,
    pendingRegistration: 0,
    claimed: 1,
    paid: 1,
    deny: 0,
  },
}

describe('PalliativeRegistryClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/service/dashboard-rcm/palliative-care/registry')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
      }
      return Promise.reject(new Error('not found'))
    }) as any
  })

  it('renders title, stats, and patient table correctly', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    expect(screen.getByText('ทะเบียน Palliative Care')).toBeInTheDocument()
    expect(screen.getByText('REGISTRY')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
      expect(screen.getByText('000206')).toBeInTheDocument()
      expect(screen.getByText('C548 CA corpus')).toBeInTheDocument()
    })
  })

  it('opens add modal on clicking "+ เพิ่มทะเบียนผู้ป่วย"', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('+ เพิ่มทะเบียนผู้ป่วย')).toBeInTheDocument()
    })

    const addBtn = screen.getByText('+ เพิ่มทะเบียนผู้ป่วย')
    fireEvent.click(addBtn)

    expect(screen.getByText('+ เพิ่มทะเบียนผู้ป่วย Palliative Care')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('เช่น 000206')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('เช่น นางจันทนา ตันมา')).toBeInTheDocument()
  })

  it('opens edit modal on clicking "แก้ไข"', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    const editBtn = screen.getByTitle('แก้ไข / บันทึกการเยี่ยม')
    fireEvent.click(editBtn)

    expect(
      screen.getByText(/บันทึกข้อมูลและประวัติการเยี่ยม: นางจันทนา ตันมา/)
    ).toBeInTheDocument()
    expect(screen.getByText('การเยี่ยมครั้งที่ 1')).toBeInTheDocument()
  })
})
