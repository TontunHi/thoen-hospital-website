import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LtcRegistryClient from '../LtcRegistryClient'

describe('LtcRegistryClient Component', () => {
  const mockLtcData = {
    success: true,
    items: [
      {
        id: 1,
        hn: '0001234',
        cid: '1520000000001',
        patientName: 'นายใจดี ล้อมแรด',
        address: '12',
        moo: '1',
        tambon: 'ล้อมแรด',
        age: 72,
        adlScore: 8,
        areaZone: 'รพ.สต.ล้อมแรด',
        createdBy: 'admin',
        updatedBy: 'admin',
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01',
      },
      {
        id: 2,
        hn: '0005678',
        cid: '1520000000002',
        patientName: 'นางสมศรี แม่วะ',
        address: '34',
        moo: '2',
        tambon: 'แม่วะ',
        age: 80,
        adlScore: 3,
        areaZone: 'รพ.สต.แม่วะ',
        createdBy: 'admin',
        updatedBy: 'admin',
        createdAt: '2026-11-02',
        updatedAt: '2026-11-02',
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
    availableAreaZones: ['รพ.สต.ล้อมแรด', 'รพ.สต.แม่วะ'],
    stats: {
      total: 2,
      avgAdl: 5.5,
      zoneCounts: {
        'รพ.สต.ล้อมแรด': 1,
        'รพ.สต.แม่วะ': 1,
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/service/dashboard-rcm/palliative-care/ltc-registry/lookup-hn')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                hn: '0009999',
                cid: '1520000000099',
                patientName: 'นายทดสอบ คนใหม่',
                address: '99',
                moo: '3',
                tambon: 'เถินบุรี',
                age: 65,
                isAlreadyInLtc: false,
                isPalliative: false,
              },
            }),
        })
      }
      if (url.includes('/api/service/dashboard-rcm/palliative-care/ltc-registry')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLtcData),
        })
      }
      return Promise.reject(new Error('not found'))
    }) as any
  })

  it('renders header, tabs, stats, and patient table correctly', async () => {
    render(<LtcRegistryClient userRole="admin" username="admin" isAdmin={true} />)

    expect(screen.getByRole('heading', { level: 1, name: 'ทะเบียน Long Term Care (LTC)' })).toBeInTheDocument()
    expect(screen.getByText('LTC REGISTRY')).toBeInTheDocument()

    // Sub-nav tab links
    expect(screen.getByRole('link', { name: 'ทะเบียน Palliative Care' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ทะเบียน Long Term Care (LTC)' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByDisplayValue('นายใจดี ล้อมแรด')).toBeInTheDocument()
      expect(screen.getByDisplayValue('นางสมศรี แม่วะ')).toBeInTheDocument()
      expect(screen.getByText('0001234')).toBeInTheDocument()
      expect(screen.getByText('0005678')).toBeInTheDocument()
      // ADL scores and tooltips
      expect(screen.getByDisplayValue('8')).toBeInTheDocument()
      expect(screen.getByDisplayValue('3')).toBeInTheDocument()
      expect(screen.getByTitle(/ผู้ป่วยติดบ้าน/)).toBeInTheDocument()
      expect(screen.getByTitle(/ผู้ป่วยติดเตียง/)).toBeInTheDocument()
    })
  })

  it('opens add modal on clicking button and performs HOSxP lookup', async () => {
    render(<LtcRegistryClient userRole="admin" username="admin" isAdmin={true} />)

    const addBtn = screen.getByRole('button', { name: /เพิ่มผู้ป่วยขึ้นทะเบียน LTC/ })
    fireEvent.click(addBtn)

    expect(screen.getByRole('heading', { name: 'เพิ่มผู้ป่วยขึ้นทะเบียน Long Term Care (LTC)' })).toBeInTheDocument()

    const hnInput = screen.getByPlaceholderText(/ระบุหมายเลข HN/)
    fireEvent.change(hnInput, { target: { value: '9999' } })

    const lookupBtn = screen.getByRole('button', { name: 'ดึงข้อมูล HOSxP' })
    fireEvent.click(lookupBtn)

    await waitFor(() => {
      expect(screen.getByText(/พบข้อมูลผู้ป่วยใน HOSxP: นายทดสอบ คนใหม่/)).toBeInTheDocument()
      expect(screen.getByDisplayValue('นายทดสอบ คนใหม่')).toBeInTheDocument()
      expect(screen.getByDisplayValue('เถินบุรี')).toBeInTheDocument()
    })
  })

  it('opens edit modal on clicking patient HN link', async () => {
    render(<LtcRegistryClient userRole="admin" username="admin" isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText('0001234')).toBeInTheDocument()
    })

    const hnLink = screen.getByText('0001234')
    fireEvent.click(hnLink)

    expect(screen.getByRole('heading', { name: /แก้ไขข้อมูลทะเบียน LTC: HN 0001234/ })).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('นายใจดี ล้อมแรด').length).toBeGreaterThanOrEqual(2)
  })

  it('opens delete confirmation modal on clicking trash button', async () => {
    render(<LtcRegistryClient userRole="admin" username="admin" isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText('0001234')).toBeInTheDocument()
    })

    const deleteBtns = screen.getAllByTitle('ลบเคสออกจากทะเบียน LTC')
    fireEvent.click(deleteBtns[0])

    expect(screen.getByRole('heading', { name: 'ยืนยันการลบข้อมูล' })).toBeInTheDocument()
    expect(screen.getByText(/คุณต้องการลบข้อมูลผู้ป่วย/)).toBeInTheDocument()
  })

  it('filters table rows when clicking stat cards for Homebound and Bedridden groups', async () => {
    render(<LtcRegistryClient userRole="admin" username="admin" isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText('0001234')).toBeInTheDocument()
      expect(screen.getByText('0005678')).toBeInTheDocument()
    })

    // Click Homebound card (ADL 5-11)
    const homeboundBtn = screen.getByRole('button', { name: /กลุ่มติดบ้าน \(ADL 5-11\)/ })
    fireEvent.click(homeboundBtn)

    // Should only show HN 0001234 (ADL 8), HN 0005678 (ADL 3) should be filtered out
    expect(screen.getByText('0001234')).toBeInTheDocument()
    expect(screen.queryByText('0005678')).not.toBeInTheDocument()

    // Click Bedridden card (ADL 0-4)
    const bedriddenBtn = screen.getByRole('button', { name: /กลุ่มติดเตียง \(ADL 0-4\)/ })
    fireEvent.click(bedriddenBtn)

    // Should only show HN 0005678 (ADL 3), HN 0001234 (ADL 8) should be filtered out
    expect(screen.getByText('0005678')).toBeInTheDocument()
    expect(screen.queryByText('0001234')).not.toBeInTheDocument()

    // Clicking active bedridden card again toggles back to ALL
    fireEvent.click(bedriddenBtn)
    expect(screen.getByText('0001234')).toBeInTheDocument()
    expect(screen.getByText('0005678')).toBeInTheDocument()
  })

  it('renders read-only view without add/edit/delete controls for view_ltc_registry', () => {
    render(
      <LtcRegistryClient
        userRole="member"
        username="viewer_ltc"
        isAdmin={false}
        canEdit={false}
        canManage={false}
        initialData={mockLtcData}
      />
    )

    expect(screen.getByText('นายใจดี ล้อมแรด')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /เพิ่มผู้ป่วยขึ้นทะเบียน LTC/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/แก้ไขข้อมูลในช่องตาราง/)).not.toBeInTheDocument()
    expect(screen.queryByTitle('ลบเคสออกจากทะเบียน LTC')).not.toBeInTheDocument()

    // Clicking HN does not open edit modal in read-only mode
    fireEvent.click(screen.getByText('0001234'))
    expect(screen.queryByRole('heading', { name: /แก้ไขข้อมูลทะเบียน LTC/ })).not.toBeInTheDocument()
  })

  it('allows add and edit without delete controls for edit_ltc_registry', () => {
    render(
      <LtcRegistryClient
        userRole="member"
        username="editor_ltc"
        isAdmin={false}
        canEdit={true}
        canManage={false}
        initialData={mockLtcData}
      />
    )

    expect(screen.getByRole('button', { name: /เพิ่มผู้ป่วยขึ้นทะเบียน LTC/ })).toBeInTheDocument()
    expect(screen.getByDisplayValue('นายใจดี ล้อมแรด')).toBeInTheDocument()
    expect(screen.queryByTitle('ลบเคสออกจากทะเบียน LTC')).not.toBeInTheDocument()
  })

  it('allows add, edit, and delete controls for manage_ltc_registry', () => {
    render(
      <LtcRegistryClient
        userRole="member"
        username="manager_ltc"
        isAdmin={false}
        canEdit={true}
        canManage={true}
        initialData={mockLtcData}
      />
    )

    expect(screen.getByRole('button', { name: /เพิ่มผู้ป่วยขึ้นทะเบียน LTC/ })).toBeInTheDocument()
    expect(screen.getByDisplayValue('นายใจดี ล้อมแรด')).toBeInTheDocument()
    expect(screen.getAllByTitle('ลบเคสออกจากทะเบียน LTC').length).toBeGreaterThanOrEqual(1)
  })
})
