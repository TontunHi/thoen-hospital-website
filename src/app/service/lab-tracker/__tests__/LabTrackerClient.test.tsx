import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LabTrackerClient from '../LabTrackerClient'

describe('LabTrackerClient - Modern Hospital Lab Tracker', () => {
  const mockDashboardData = {
    doctors: [
      { code: 'DOC01', name: 'นพ.สมหมาย ใจอารี', count: 5 },
      { code: 'DOC02', name: 'พญ.สมพร รักษ์ดี', count: 3 },
    ],
    others: [
      { code: 'NUR01', name: 'พว.สุดา พยาบาลดี', count: 2 },
    ],
    totalCount: 10,
  }

  const mockReportData = {
    pending: [
      {
        hn: '0000001',
        patientName: 'นายมานะ อดทน',
        formName: 'CBC & UA',
        orderTime: '08:30',
        receiveTime: '08:45',
        doctorName: 'นพ.สมหมาย ใจอารี',
      },
    ],
    reported: [
      {
        hn: '0000002',
        patientName: 'นางชูใจ สดใส',
        formName: 'Blood Chemistry',
        orderTime: '09:00',
        receiveTime: '09:15',
        reportTime: '10:00',
        ovstost: '99',
        doctorName: 'นพ.สมหมาย ใจอารี',
      },
    ],
  }

  const mockDetailData = {
    hn: '0000001',
    patientName: 'นายมานะ อดทน',
    reported: [
      {
        formName: 'CBC',
        itemName: 'WBC Count',
        result: '6,500',
        refValue: '4,500 - 10,000 /uL',
      },
    ],
    pending: [
      {
        formName: 'UA',
        itemName: 'Urine Analysis Routine',
        isOutLab: 'N',
      },
      {
        formName: 'Special Chemistry',
        itemName: 'HbA1c',
        isOutLab: 'Y',
      },
    ],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/service/lab-tracker/doctors')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDashboardData),
        })
      }
      if (url.includes('/api/service/lab-tracker/report')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockReportData),
        })
      }
      if (url.includes('/api/service/lab-tracker/detail')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDetailData),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
  })

  it('renders dashboard with doctors, nurses, and total order count', async () => {
    render(<LabTrackerClient />)

    await waitFor(() => {
      expect(screen.getByText('นพ.สมหมาย ใจอารี')).toBeInTheDocument()
      expect(screen.getByText('พญ.สมพร รักษ์ดี')).toBeInTheDocument()
      expect(screen.getByText('พว.สุดา พยาบาลดี')).toBeInTheDocument()
    })

    // Total count card or button
    expect(screen.getByText('ยอดผู้ป่วยสั่งตรวจทั้งหมดวันนี้')).toBeInTheDocument()
    expect(screen.getAllByText('10').length).toBeGreaterThan(0)
  })

  it('selects a doctor and loads their pending and reported lab tests', async () => {
    render(<LabTrackerClient />)

    await waitFor(() => {
      expect(screen.getByText('นพ.สมหมาย ใจอารี')).toBeInTheDocument()
    })

    const doctorRow = screen.getByText('นพ.สมหมาย ใจอารี').closest('tr') || screen.getByText('นพ.สมหมาย ใจอารี')
    fireEvent.click(doctorRow)

    await waitFor(() => {
      expect(screen.getByText('นายมานะ อดทน')).toBeInTheDocument()
      expect(screen.getByText('นางชูใจ สดใส')).toBeInTheDocument()
    })

    expect(screen.getByText('0000001')).toBeInTheDocument()
    expect(screen.getByText('0000002')).toBeInTheDocument()
  })

  it('filters patient list by search query and clears search', async () => {
    render(<LabTrackerClient />)

    await waitFor(() => {
      expect(screen.getByText('นพ.สมหมาย ใจอารี')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('นพ.สมหมาย ใจอารี'))

    await waitFor(() => {
      expect(screen.getByText('นายมานะ อดทน')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/ค้นหา/i)
    fireEvent.change(searchInput, { target: { value: 'ชูใจ' } })

    // 'นายมานะ อดทน' should not match
    expect(screen.queryByText('นายมานะ อดทน')).not.toBeInTheDocument()
    expect(screen.getByText('นางชูใจ สดใส')).toBeInTheDocument()

    // Test clear search button
    const clearBtn = screen.getByLabelText('ล้างคำค้นหา')
    fireEvent.click(clearBtn)
    expect(screen.getByText('นายมานะ อดทน')).toBeInTheDocument()
  })

  it('opens lab detail modal when HN button is clicked, shows data and closes on Escape', async () => {
    render(<LabTrackerClient />)

    await waitFor(() => {
      expect(screen.getByText('นพ.สมหมาย ใจอารี')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('นพ.สมหมาย ใจอารี'))

    await waitFor(() => {
      expect(screen.getByText('0000001')).toBeInTheDocument()
    })

    const hnBtn = screen.getByRole('button', { name: '0000001' })
    fireEvent.click(hnBtn)

    await waitFor(() => {
      expect(screen.getByText('WBC Count')).toBeInTheDocument()
      expect(screen.getByText('6,500')).toBeInTheDocument()
      expect(screen.getByText('Urine Analysis Routine')).toBeInTheDocument()
      expect(screen.getByText(/ส่งตรวจแลปภายนอก/i)).toBeInTheDocument()
    })

    // Press Escape to close modal
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('WBC Count')).not.toBeInTheDocument()
    })
  })

  it('allows navigating back to dashboard view from doctor report', async () => {
    render(<LabTrackerClient />)

    await waitFor(() => {
      expect(screen.getByText('นพ.สมหมาย ใจอารี')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('นพ.สมหมาย ใจอารี'))

    await waitFor(() => {
      expect(screen.getByText('นายมานะ อดทน')).toBeInTheDocument()
    })

    const backBtn = screen.getByRole('button', { name: /ย้อนกลับ/i })
    fireEvent.click(backBtn)

    await waitFor(() => {
      expect(screen.getByText('กลุ่มแพทย์ผู้สั่งตรวจ')).toBeInTheDocument()
    })
  })

  it('renders error message when initial fetch fails', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'ไม่สามารถดึงข้อมูลได้' }),
      })
    )

    render(<LabTrackerClient />)

    await waitFor(() => {
      expect(screen.getByText(/ไม่สามารถดึงข้อมูลได้/i)).toBeInTheDocument()
    })
  })
})
