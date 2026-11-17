import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ERInStatusClient from '../ERInStatusClient'

const syntheticErResponse = {
  activePatients: [
    {
      hn: '0000101',
      vn: '6911170001',
      ptname: 'นายสมมติ ทดสอบหนึ่ง',
      age: 62,
      bedno: '1',
      enter_time: '08:30:00',
      er_list: 'แน่นหน้าอก',
      er_emergency_level_name: 'Resuscitate',
      er_emergency_level_id: 1,
      observe: 'Y',
      dch_type_name: 'กำลังตรวจรักษา',
      wardname: null,
      hosname: null,
      hosname_dest: null,
    },
    {
      hn: '0000102',
      vn: '6911170002',
      ptname: 'นางสาวตัวอย่าง ทดสอบสอง',
      age: 34,
      bedno: null,
      enter_time: '09:15:00',
      er_list: 'มีไข้สูง',
      er_emergency_level_name: 'Urgency',
      er_emergency_level_id: 3,
      observe: 'N',
      dch_type_name: 'รอผลแล็บ',
      wardname: null,
      hosname: null,
      hosname_dest: null,
    },
  ],
  errorStatusList: {
    total: 1,
    list: [
      {
        vstdate: '2026-11-16',
        hn: '0000999',
        vn: '6911160099',
        status_name: 'ยังไม่ได้จำหน่าย',
        nname: 'พว.ทดสอบ ระบบ',
      },
    ],
  },
  summary: {
    totalActive: 2,
    critical: 1,
    emergency: 0,
    urgency: 1,
    semiUrgency: 0,
    nonUrgency: 0,
  },
  stats: {
    ptTypes: [
      { v: 120, name: 'ฉุกเฉินทั่วไป' },
      { v: 35, name: 'อุบัติเหตุจราจร' },
    ],
    emergencyLevels: [
      { v: 5, er_emergency_level_name: 'Resuscitate' },
      { v: 40, er_emergency_level_name: 'Urgency' },
    ],
    dischargeTypes: [{ v: 110, name: 'กลับบ้าน' }],
  },
}

describe('ERInStatusClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => syntheticErResponse,
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders summary cards, critical banner, active patient queue, error status list, and monthly stats', async () => {
    render(<ERInStatusClient />)

    await waitFor(() => {
      expect(
        screen.getByText('ระบบแสดงผลสถานะห้องฉุกเฉิน (ER Live Status)')
      ).toBeInTheDocument()
    })

    // Critical alert banner
    expect(
      screen.getByText(/ขณะนี้มีผู้ป่วยวิกฤตฉุกเฉินกู้ชีพ \(Resuscitate Red Level\) จำนวน/)
    ).toBeInTheDocument()

    // Active patients table rows
    expect(screen.getByText('นายสมมติ ทดสอบหนึ่ง')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText('เตียง 1')).toBeInTheDocument()
    expect(screen.getByText('Observe ON')).toBeInTheDocument()
    expect(screen.getByText('นางสาวตัวอย่าง ทดสอบสอง')).toBeInTheDocument()
    expect(screen.getByText('ด่วนมาก (Urgency)')).toBeInTheDocument()

    // Error status list
    expect(screen.getByText(/แสดงสถานะไม่ถูกต้อง จำนวน/)).toBeInTheDocument()
    expect(screen.getByText('ยังไม่ได้จำหน่าย')).toBeInTheDocument()
    expect(screen.getByText('พว.ทดสอบ ระบบ')).toBeInTheDocument()

    // Monthly stats
    expect(screen.getByText('ฉุกเฉินทั่วไป')).toBeInTheDocument()
    expect(screen.getByText('120 ราย')).toBeInTheDocument()
    expect(screen.getByText('กลับบ้าน')).toBeInTheDocument()
  })

  it('allows manual refresh and surfaces error alert when API fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => syntheticErResponse,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'ไม่สามารถเชื่อมต่อระบบได้ชั่วคราว' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<ERInStatusClient />)

    await waitFor(() => {
      expect(screen.getByText('นายสมมติ ทดสอบหนึ่ง')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรชข้อมูล' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ไม่สามารถเชื่อมต่อระบบได้ชั่วคราว')
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
