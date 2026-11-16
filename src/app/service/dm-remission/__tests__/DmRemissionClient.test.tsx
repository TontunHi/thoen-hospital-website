import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DmRemissionClient from '../DmRemissionClient'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  Legend: () => <div />,
}))

const mockListResponse = {
  success: true,
  data: {
    fiscalYear: 2570,
    availableFiscalYears: [2571, 2570, 2569, 2568],
    availablePcus: ['รพ.สต.ทดสอบ'],
    items: [
      {
        id: 1,
        fiscalYear: 2570,
        pcuName: 'รพ.สต.ทดสอบ',
        patientName: 'นายทดสอบ สมมติ',
        cid: '1000000000000',
        hn: '0001234',
        age: 54,
        underlyingDiseases: 'HT, DLP',
        heightCm: 160,
        weightBeforeKg: 70,
        weightAfterKg: 64,
        bmiBefore: 27.34,
        bmiAfter: 25,
        waistBeforeCm: 92,
        waistAfterCm: 85,
        fpgBefore: 145,
        fpgAfter: 102,
        a1cBefore: 7.4,
        a1cAfter: 6.1,
        a1cPostStop3m: 6.0,
        medsBefore: 'Metformin 500mg 1x2',
        medsAfter: 'Off',
        summaryA1c: 'ลด',
        summaryMeds: 'หยุดยา',
        summaryWeight: 'ลด',
        summaryWaist: 'ลด',
        summaryDiet: null,
        summaryExercise: null,
        summaryIf: null,
        summaryRemission: 'Remission',
        createdBy: 'staff1',
        updatedBy: 'staff1',
        createdAt: '2026-10-05T08:00:00Z',
        updatedAt: '2026-10-05T08:00:00Z',
      },
    ],
    options: {
      remission: [
        { id: 1, category: 'remission', label: 'Remission', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 2, category: 'remission', label: 'ไม่ Remission', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 3, category: 'remission', label: 'รอ lab A1c', sortOrder: 2, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      diet: [],
      exercise: [],
      if_fasting: [],
      pcu: [],
    },
    stats: {
      totalPatients: 1,
      remissionCount: 1,
      remissionRate: 100,
      statusCounts: { Remission: 1, 'ไม่ Remission': 0, 'รอ lab A1c': 0, 'ยังไม่ระบุ': 0 },
      averages: {
        a1cBefore: 7.4,
        a1cAfter: 6.1,
        a1cPostStop3m: 6.0,
        a1cDelta: -1.3,
        weightBeforeKg: 70,
        weightAfterKg: 64,
        weightDelta: -6,
        bmiBefore: 27.34,
        bmiAfter: 25,
        waistBeforeCm: 92,
        waistAfterCm: 85,
        fpgBefore: 145,
        fpgAfter: 102,
      },
      byPcu: [
        { pcuName: 'รพ.สต.ทดสอบ', total: 1, remissionCount: 1, remissionRate: 100, statusCounts: { Remission: 1 } },
      ],
      breakdowns: {
        summaryA1c: { ลด: 1 },
        summaryMeds: { หยุดยา: 1 },
        summaryWeight: { ลด: 1 },
        summaryWaist: { ลด: 1 },
        summaryDiet: {},
        summaryExercise: {},
        summaryIf: {},
      },
    },
  },
}

describe('DmRemissionClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/service/dm-remission/lookup-hn')) {
        if (url.includes('9999999')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ success: false, error: 'Not found' }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                hn: '0005555',
                cid: '1000000000002',
                patientName: 'นางสาวตัวอย่าง ทดสอบ',
                age: 48,
              },
            }),
        })
      }

      if (url === '/api/service/dm-remission' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ success: true, data: { id: 2 } }),
        })
      }

      if (url === '/api/service/dm-remission/1' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body || '{}'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                ...mockListResponse.data.items[0],
                ...body,
              },
            }),
        })
      }

      if (url === '/api/service/dm-remission/1' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        })
      }

      if (url === '/api/service/dm-remission/carryover' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { copiedCount: 3, skippedCount: 1 } }),
        })
      }

      if (url === '/api/service/dm-remission/options' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ success: true, data: { id: 10, category: 'diet', label: 'ลดหวาน' } }),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockListResponse),
      })
    }) as any
  })

  it('renders view-only mode cleanly when member lacks manage_dm_remission permission', async () => {
    render(<DmRemissionClient userRole="member" canManage={false} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    expect(screen.getByText('1000000000000')).toBeInTheDocument()
    expect(screen.getByText('27.34')).toBeInTheDocument()
    expect(screen.getByText('สิทธิ์ดูข้อมูลอย่างเดียว')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export Excel/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /เพิ่มผู้ป่วย/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /คัดลอกข้ามปีงบ/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ตั้งค่าตัวเลือก/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ลบ นายทดสอบ สมมติ$/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle('คลิกเพื่อแก้ไข FPG หลัง')).not.toBeInTheDocument()
  })

  it('renders dashboard KPIs, unmasked CID, and hides admin settings for subdistrict manager', async () => {
    render(<DmRemissionClient userRole="subdistrict" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    expect(screen.getByText('1000000000000')).toBeInTheDocument()
    expect(screen.getByText('27.34')).toBeInTheDocument()
    expect(screen.queryByText('สิทธิ์ดูข้อมูลอย่างเดียว')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ตั้งค่าตัวเลือก/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^แก้ไข นายทดสอบ สมมติ$/i })).not.toBeInTheDocument()
  })

  it('edits numeric and dropdown cells inline like a spreadsheet via PATCH without an edit button', async () => {
    render(<DmRemissionClient userRole="member" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    const fpgCell = screen.getByTitle('คลิกเพื่อแก้ไข FPG หลัง')
    fireEvent.click(fpgCell)

    const input = screen.getByLabelText('กรอก FPG หลัง ของ นายทดสอบ สมมติ')
    fireEvent.change(input, { target: { value: '98' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dm-remission/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ fpgAfter: 98 }),
        })
      )
    })

    const remissionCell = screen.getByTitle('คลิกเพื่อแก้ไข สรุป Remission')
    fireEvent.click(remissionCell)

    const select = screen.getByLabelText('เลือก สรุป Remission ของ นายทดสอบ สมมติ')
    fireEvent.change(select, { target: { value: 'ไม่ Remission' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dm-remission/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ summaryRemission: 'ไม่ Remission' }),
        })
      )
    })
  })

  it('shows admin settings button for admin role', async () => {
    render(<DmRemissionClient userRole="admin" initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /ตั้งค่าตัวเลือก/i })).toBeInTheDocument()
  })

  it('looks up HN in modal, calculates live BMI, and handles missing HN gracefully', async () => {
    render(<DmRemissionClient userRole="member" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /เพิ่มผู้ป่วย/i }))

    const hnInput = screen.getByLabelText(/HN รพ\./i)
    fireEvent.change(hnInput, { target: { value: '5555' } })
    fireEvent.click(screen.getByRole('button', { name: /ดึงข้อมูล/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('นางสาวตัวอย่าง ทดสอบ')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('1000000000002')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/ส่วนสูง/i), { target: { value: '160' } })
    fireEvent.change(screen.getByLabelText(/น้ำหนัก ก่อน/i), { target: { value: '80' } })
    expect(screen.getByText('31.25')).toBeInTheDocument()

    fireEvent.change(hnInput, { target: { value: '9999999' } })
    fireEvent.click(screen.getByRole('button', { name: /ดึงข้อมูล/i }))

    await waitFor(() => {
      expect(screen.getByText(/ไม่พบ HN นี้ใน HOSxP/i)).toBeInTheDocument()
    })
  })

  it('deletes a cohort row after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<DmRemissionClient userRole="subdistrict" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ลบ นายทดสอบ สมมติ/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dm-remission/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('submits carryover modal and admin settings option creation', async () => {
    render(<DmRemissionClient userRole="admin" initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /คัดลอกข้ามปีงบ/i }))
    fireEvent.click(screen.getByRole('button', { name: /ยืนยันคัดลอก/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dm-remission/carryover',
        expect.objectContaining({ method: 'POST' })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /ตั้งค่าตัวเลือก/i }))
    fireEvent.click(screen.getByRole('button', { name: /สรุป การปรับอาหาร/i }))
    fireEvent.change(screen.getByPlaceholderText(/เพิ่มตัวเลือกในหมวด/i), {
      target: { value: 'ลดหวาน' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^เพิ่ม$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/dm-remission/options',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('defaults to populated fiscalYear from API when initialFiscalYear is omitted and shows only populated years', async () => {
    const baseFetch = global.fetch as typeof fetch
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/service/dm-remission') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                ...mockListResponse.data,
                fiscalYear: 2569,
                availableFiscalYears: [2569, 2565],
                items: [{ ...mockListResponse.data.items[0], fiscalYear: 2569 }],
              },
            }),
        })
      }
      return baseFetch(url, init)
    }) as typeof fetch

    render(<DmRemissionClient userRole="member" canManage={true} />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ สมมติ')).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/service/dm-remission', {
      cache: 'no-store',
    })
    const fySelect = screen.getByLabelText('เลือกปีงบประมาณ') as HTMLSelectElement
    expect(fySelect.value).toBe('2569')
    expect(Array.from(fySelect.options).map((opt) => opt.value)).toEqual(['2569', '2565'])
  })
})
