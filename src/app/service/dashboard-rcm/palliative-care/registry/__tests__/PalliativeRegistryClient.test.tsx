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
      projectCode: '30001, Cons01',
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
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

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

  it('renders title, stats, and patient table correctly with Clinic Palliative Care status & Rep', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    expect(screen.getByText('ทะเบียน Palliative Care')).toBeInTheDocument()
    expect(screen.getByText('REGISTRY')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
      expect(screen.getByText('000206')).toBeInTheDocument()
      expect(screen.getByText('C548 CA corpus')).toBeInTheDocument()
      expect(screen.getAllByText('ขึ้นทะเบียนแล้ว').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('19 ต.ค. 2569')).toBeInTheDocument()
      expect(screen.getByText(/302 ฿/)).toBeInTheDocument()
    })

    // Rep is hidden by default for compactness, clicking the amount badge reveals Rep and copies it:
    expect(screen.queryByText(/Rep: 691000167/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/302 ฿/))
    await waitFor(() => {
      expect(screen.getByText(/Rep: 691000167/)).toBeInTheDocument()
      expect(screen.getByText(/คัดลอกแล้ว/)).toBeInTheDocument()
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('691000167')

    // Clicking again toggles it closed:
    fireEvent.click(screen.getByText(/302 ฿/))
    await waitFor(() => {
      expect(screen.queryByText(/Rep: 691000167/)).not.toBeInTheDocument()
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
      expect(screen.getByText(/พบใน HOSxP คลินิก Palliative Care/)).toBeInTheDocument()
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

  it('allows inline cell editing like Google Sheets on click and saves on Enter for editable cells like address', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
      expect(screen.getByText('205/1 ม.4 ต.เถินบุรี')).toBeInTheDocument()
    })

    // Click to start editing editable address cell
    const addrCell = screen.getByText('205/1 ม.4 ต.เถินบุรี')
    fireEvent.click(addrCell)

    // Input appears
    const input = screen.getByDisplayValue('205/1 ม.4 ต.เถินบุรี')
    expect(input).toBeInTheDocument()

    // Change value and press Enter
    fireEvent.change(input, { target: { value: '205/1 ม.4 ต.เถินบุรี (แก้ไขด่วน)' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // Verify PUT request dispatched
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/palliative-care/registry/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ address: '205/1 ม.4 ต.เถินบุรี (แก้ไขด่วน)' }),
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

  it('detects duplicate patient or AN and disables submit with warning message', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('+ เพิ่มทะเบียนผู้ป่วย')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('+ เพิ่มทะเบียนผู้ป่วย'))
    const hnInput = screen.getByPlaceholderText('เช่น 000206')

    // Type HN of a patient already in mock table (0000206)
    fireEvent.change(hnInput, { target: { value: '0000206' } })

    expect(screen.getByText(/หมายเลขนี้มีอยู่ในทะเบียนแล้ว ห้ามลงข้อมูลซ้ำ/)).toBeInTheDocument()
    const submitBtn = screen.getByText('มีข้อมูลในทะเบียนแล้ว (ห้ามลงซ้ำ)')
    expect(submitBtn).toBeDisabled()
  })

  it('keeps HN and patientName static without inline editing and without AN badge', async () => {
    const { container } = render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('นางจันทนา ตันมา')).toBeInTheDocument()
      expect(screen.getByText('000206')).toBeInTheDocument()
    })

    // Click on patientName
    fireEvent.click(screen.getByText('นางจันทนา ตันมา'))
    // Should NOT create an input
    expect(screen.queryByDisplayValue('นางจันทนา ตันมา')).toBeNull()

    // Click on HN
    fireEvent.click(screen.getByText('000206'))
    // Should NOT create an input
    expect(screen.queryByDisplayValue('000206')).toBeNull()

    // AN badge should not exist in table
    expect(container.querySelector('.pcr-badge-an')).toBeNull()
  })

  it('filters table rows by color condition (Green, Orange, Pink)', async () => {
    const multiMockData = {
      ...mockData,
      items: [
        {
          ...mockData.items[0],
          id: 1,
          hn: '000001',
          patientName: 'คนไข้เขียว ได้เงิน',
          visit1Compensated: 300,
          deathDate: null,
        },
        {
          ...mockData.items[0],
          id: 2,
          hn: '000002',
          patientName: 'คนไข้ส้ม รอชดเชย',
          visit1Compensated: 0,
          deathDate: null,
        },
        {
          ...mockData.items[0],
          id: 3,
          hn: '000003',
          patientName: 'คนไข้ชมพู เสียชีวิต',
          visit1Compensated: 0,
          deathDate: '2026-10-15',
        },
      ],
      total: 3,
    }

    vi.mocked(global.fetch).mockImplementation(((url: any) => {
      if (typeof url === 'string' && url.includes('/api/service/dashboard-rcm/palliative-care/registry')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(multiMockData),
        })
      }
      return Promise.reject(new Error('not found'))
    }) as any)

    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('คนไข้เขียว ได้เงิน')).toBeInTheDocument()
      expect(screen.getByText('คนไข้ส้ม รอชดเชย')).toBeInTheDocument()
      expect(screen.getByText('คนไข้ชมพู เสียชีวิต')).toBeInTheDocument()
    })

    // Select Deceased option in dropdown
    const select = screen.getByLabelText('กรองสถานะเงินชดเชย')
    fireEvent.change(select, { target: { value: 'PINK' } })

    expect(screen.getByText('คนไข้ชมพู เสียชีวิต')).toBeInTheDocument()
    expect(screen.queryByText('คนไข้เขียว ได้เงิน')).toBeNull()
    expect(screen.queryByText('คนไข้ส้ม รอชดเชย')).toBeNull()

    // Select Paid/Green option
    fireEvent.change(select, { target: { value: 'GREEN' } })

    expect(screen.getByText('คนไข้เขียว ได้เงิน')).toBeInTheDocument()
    expect(screen.queryByText('คนไข้ชมพู เสียชีวิต')).toBeNull()
    expect(screen.queryByText('คนไข้ส้ม รอชดเชย')).toBeNull()

    // Select Pending/Orange option
    fireEvent.change(select, { target: { value: 'ORANGE' } })

    expect(screen.getByText('คนไข้ส้ม รอชดเชย')).toBeInTheDocument()
    expect(screen.queryByText('คนไข้เขียว ได้เงิน')).toBeNull()
    expect(screen.queryByText('คนไข้ชมพู เสียชีวิต')).toBeNull()
  })

  it('filters table rows by Fiscal Year (ปีงบประมาณ)', async () => {
    const fyMockData = {
      ...mockData,
      items: [
        {
          ...mockData.items[0],
          id: 101,
          hn: '000101',
          patientName: 'คนไข้ ปีงบ 2568',
          registeredDate: '2025-05-10', // May 2025 -> FY 2568
        },
        {
          ...mockData.items[0],
          id: 102,
          hn: '000102',
          patientName: 'คนไข้ ปีงบ 2569',
          registeredDate: '2026-07-04', // Jul 2026 -> FY 2569
        },
      ],
      total: 2,
    }

    vi.mocked(global.fetch).mockImplementation(((url: any) => {
      if (typeof url === 'string' && url.includes('/api/service/dashboard-rcm/palliative-care/registry')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(fyMockData),
        })
      }
      return Promise.reject(new Error('not found'))
    }) as any)

    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('คนไข้ ปีงบ 2568')).toBeInTheDocument()
      expect(screen.getByText('คนไข้ ปีงบ 2569')).toBeInTheDocument()
    })

    // Find Fiscal Year select
    const fySelect = screen.getByLabelText('เลือกปีงบประมาณ')
    expect(fySelect).toBeInTheDocument()

    // Filter to FY 2568
    fireEvent.change(fySelect, { target: { value: '2568' } })

    expect(screen.getByText('คนไข้ ปีงบ 2568')).toBeInTheDocument()
    expect(screen.queryByText('คนไข้ ปีงบ 2569')).toBeNull()

    // Filter to FY 2569
    fireEvent.change(fySelect, { target: { value: '2569' } })

    expect(screen.getByText('คนไข้ ปีงบ 2569')).toBeInTheDocument()
    expect(screen.queryByText('คนไข้ ปีงบ 2568')).toBeNull()

    // Reset to ALL
    fireEvent.change(fySelect, { target: { value: 'ALL' } })

    expect(screen.getByText('คนไข้ ปีงบ 2568')).toBeInTheDocument()
    expect(screen.getByText('คนไข้ ปีงบ 2569')).toBeInTheDocument()
  })

  it('does not include "ยังไม่ได้ขึ้นทะเบียน Palliative Care" in the compensation status filter dropdown', async () => {
    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByLabelText('กรองสถานะเงินชดเชย')).toBeInTheDocument()
    })

    const select = screen.getByLabelText('กรองสถานะเงินชดเชย')
    const options = Array.from(select.querySelectorAll('option')).map((opt) => opt.textContent)

    expect(options.some((txt) => txt?.includes('ยังไม่ได้ขึ้นทะเบียน Palliative Care'))).toBe(false)
    expect(options.some((txt) => txt?.includes('ได้รับเงินชดเชยแล้ว'))).toBe(true)
    expect(options.some((txt) => txt?.includes('ยังไม่ได้รับเงินชดเชย'))).toBe(true)
    expect(options.some((txt) => txt?.includes('ขึ้นทะเบียนแล้ว แต่ยังรอเงินชดเชย'))).toBe(true)
    expect(options.some((txt) => txt?.includes('ผู้ป่วยเสียชีวิต'))).toBe(true)
  })

  it('displays dynamic visit columns (เยี่ยม 7, เยี่ยม 8) directly in table without badge, and supports inline editing and modal management', async () => {
    const dynamicVisitsData = {
      ...mockData,
      items: [
        {
          ...mockData.items[0],
          id: 55,
          hn: '0000055',
          patientName: 'ผู้ป่วย เยี่ยมแปดครั้ง',
          visits: [
            { visitNo: 1, visitDate: '01/10/2569', rep: '6901001', compensated: 100 },
            { visitNo: 2, visitDate: '08/10/2569', rep: '6901002', compensated: 100 },
            { visitNo: 3, visitDate: '15/10/2569', rep: '6901003', compensated: 100 },
            { visitNo: 4, visitDate: '22/10/2569', rep: '6901004', compensated: 100 },
            { visitNo: 5, visitDate: '29/10/2569', rep: '6901005', compensated: 100 },
            { visitNo: 6, visitDate: '05/11/2569', rep: '6901006', compensated: 100 },
            { visitNo: 7, visitDate: '12/11/2569', rep: '6901007', compensated: 100 },
            { visitNo: 8, visitDate: '19/11/2569', rep: '6901008', compensated: 100 },
          ],
        },
      ],
      total: 1,
    }

    vi.mocked(global.fetch).mockImplementation(((url: any) => {
      if (typeof url === 'string' && url.includes('/api/service/dashboard-rcm/palliative-care/registry')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(dynamicVisitsData),
        })
      }
      return Promise.reject(new Error('not found'))
    }) as any)

    render(<PalliativeRegistryClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('ผู้ป่วย เยี่ยมแปดครั้ง')).toBeInTheDocument()
    })

    // Verify dynamic table headers exist for visits 7 and 8
    expect(screen.getByText('เยี่ยม 7')).toBeInTheDocument()
    expect(screen.getByText('เยี่ยม 8')).toBeInTheDocument()
    expect(screen.getByText('ติดตามเยี่ยมบ้าน (ครั้งที่ 1 - 8)')).toBeInTheDocument()

    // Verify collapsed badge does NOT exist
    expect(screen.queryByText(/\+อีก/)).toBeNull()

    // Verify inline visit inputs exist for visit 7 and 8
    const visit7Input = screen.getByDisplayValue('12/11/2569')
    const visit8Input = screen.getByDisplayValue('19/11/2569')
    expect(visit7Input).toBeInTheDocument()
    expect(visit8Input).toBeInTheDocument()

    // Test inline edit on visit 7
    fireEvent.change(visit7Input, { target: { value: '14/11/2569' } })
    fireEvent.blur(visit7Input)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service/dashboard-rcm/palliative-care/registry/55'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('14/11/2569'),
        })
      )
    })

    // Open edit modal via edit button
    const editBtn = screen.getByTitle('แก้ไข / บันทึกการเยี่ยม')
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByText(/บันทึกข้อมูลและประวัติการเยี่ยม: ผู้ป่วย เยี่ยมแปดครั้ง/)).toBeInTheDocument()
      expect(screen.getByText('การเยี่ยมครั้งที่ 7')).toBeInTheDocument()
      expect(screen.getByText('การเยี่ยมครั้งที่ 8')).toBeInTheDocument()
    })

    // Visits > 6 have delete buttons in modal
    const deleteVisitBtns = screen.getAllByText('✕ ลบครั้งนี้')
    expect(deleteVisitBtns).toHaveLength(2)

    // Click "+ เพิ่มการเยี่ยม (ครั้งที่ 9)"
    const addVisitBtn = screen.getByText(/เพิ่มการเยี่ยม \(ครั้งที่ 9\)/)
    fireEvent.click(addVisitBtn)

    expect(screen.getByText('การเยี่ยมครั้งที่ 9')).toBeInTheDocument()

    expect(screen.getByText('การเยี่ยมครั้งที่ 9')).toBeInTheDocument()
  })
})
