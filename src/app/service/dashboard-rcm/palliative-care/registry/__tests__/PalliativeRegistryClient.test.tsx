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
      registeredDate: '2026-10-19',
      visit1Date: '2/11/2026',
      visit1Status: 'ลงข้อมูลเรียบร้อย',
      visit1Rep: '691000167',
      visit1Compensated: 302,
      visit2Date: null,
      deathDate: null,
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
      if (url.includes('/api/service/dashboard-rcm/palliative-care/registry/lookup-hn')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                hn: '0074679',
                patientName: 'นายประสิทธิ์ ทดสอบ',
                address: '100 ม.1 ต.ล้อมแรด',
                phone: '0812345678',
                death: 'N',
                deathDate: null,
                isRegistered: true,
                registeredDate: '2026-10-19',
              },
            }),
        })
      }
      if (url.includes('/api/service/dashboard-rcm/palliative-care/registry')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
      }
      return Promise.reject(new Error('not found'))
    }) as any
  })

  it('renders title, stats, and patient table correctly with Clinic 2423 status & Rep', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    expect(screen.getByText('ทะเบียน Palliative Care')).toBeInTheDocument()
    expect(screen.getByText('REGISTRY')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
      expect(screen.getByText('000206')).toBeInTheDocument()
      expect(screen.getByText('C548 CA corpus')).toBeInTheDocument()
      expect(screen.getAllByText('ขึ้นทะเบียนแล้ว').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('2026-10-19')).toBeInTheDocument()
      expect(screen.getByText('Rep: 691000167')).toBeInTheDocument()
      expect(screen.getByText('302 ฿')).toBeInTheDocument()
    })
  })

  it('opens add modal on clicking "+ เพิ่มทะเบียนผู้ป่วย" and supports HOSxP HN lookup', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('+ เพิ่มทะเบียนผู้ป่วย')).toBeInTheDocument()
    })

    const addBtn = screen.getByText('+ เพิ่มทะเบียนผู้ป่วย')
    fireEvent.click(addBtn)

    expect(screen.getByText('+ เพิ่มทะเบียนผู้ป่วย Palliative Care')).toBeInTheDocument()
    const hnInput = screen.getByPlaceholderText('เช่น 000206')
    expect(hnInput).toBeInTheDocument()

    // Type HN and click "ดึงข้อมูล"
    fireEvent.change(hnInput, { target: { value: '0074679' } })
    const lookupBtn = screen.getByText('ดึงข้อมูล')
    fireEvent.click(lookupBtn)

    await waitFor(() => {
      expect(screen.getByDisplayValue('นายประสิทธิ์ ทดสอบ')).toBeInTheDocument()
      expect(screen.getByDisplayValue('100 ม.1 ต.ล้อมแรด')).toBeInTheDocument()
      expect(screen.getByDisplayValue('0812345678')).toBeInTheDocument()
      expect(screen.getByText(/พบใน HOSxP คลินิก 2423/)).toBeInTheDocument()
    })
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

  it('allows inline cell editing like Google Sheets on click and saves on Enter', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
    })

    // Click to start editing cell
    const nameCell = screen.getByText('นางจันทนา ตันมา')
    fireEvent.click(nameCell)

    // Input appears
    const input = screen.getByDisplayValue('นางจันทนา ตันมา')
    expect(input).toBeInTheDocument()

    // Change value and press Enter
    fireEvent.change(input, { target: { value: 'นางจันทนา ตันมา (แก้ไขด่วน)' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // Verify PUT request dispatched
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/palliative-care/registry/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ patientName: 'นางจันทนา ตันมา (แก้ไขด่วน)' }),
        })
      )
    })
  })

  it('highlights death cell and row with death color theme when death information exists', async () => {
    const mockDeceasedData = {
      ...mockData,
      items: [
        {
          ...mockData.items[0],
          id: 2,
          hn: '000999',
          patientName: 'นายผู้ล่วงลับ ทดสอบ',
          deathDate: '2026-10-15',
        },
      ],
    }

    vi.mocked(global.fetch).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockDeceasedData),
      } as any)
    )

    const { container } = render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('นายผู้ล่วงลับ ทดสอบ')).toBeInTheDocument()
    })

    // Check that pcr-cell-death class is applied to the death cell
    const deathCell = container.querySelector('.pcr-cell-death')
    expect(deathCell).toBeInTheDocument()

    // Check that the death input contains the death date
    const deathInput = container.querySelector('.pcr-death-input') as HTMLInputElement
    expect(deathInput).toBeDefined()
    expect(deathInput.value).toBe('2026-10-15')

    // Check that row has pcr-row-death class
    const deathRow = container.querySelector('.pcr-row-death')
    expect(deathRow).toBeInTheDocument()
  })
})
