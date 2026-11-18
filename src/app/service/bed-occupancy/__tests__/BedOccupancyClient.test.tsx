import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import BedOccupancyClient from '../BedOccupancyClient'
import type { BedOccupancyData } from '@/lib/clinical/ipdWardService'

const syntheticOccupancyResponse: { success: boolean; data: BedOccupancyData } = {
  success: true,
  data: {
    opdPatientCount: 312,
    totalBeds: 81,
    totalOccupied: 64,
    totalRemaining: 17,
    totalUsagePercent: 79.01,
    occupancyRate: 82.45,
    occupancyFormula: {
      totalAdmDays: 2003,
      daysInMonth: 30,
    },
    totalAdmitToday: 11,
    totalDischargeToday: 8,
    updatedAt: '2026-11-18T05:30:00.000Z',
    wards: [
      {
        id: '06',
        name: 'ชั้น 3 Ward',
        totalBeds: 44,
        occupiedBeds: 31,
        remainingBeds: 13,
        usagePercent: 70.45,
        occupancyRate: 74.1,
        admitToday: 5,
        dischargeToday: 4,
        specialties: [
          { name: 'อายุรกรรม', count: 20 },
          { name: 'กุมารเวชกรรม', count: 11 },
        ],
        icnpClassifications: [
          { name: 'Moderate', count: 18 },
          { name: 'Semi-critical', count: 10 },
        ],
        unclassifiedBeds: ['W103', 'W118'],
      },
      {
        id: '05',
        name: 'ชั้น 3 ICU',
        totalBeds: 8,
        occupiedBeds: 7,
        remainingBeds: 1,
        usagePercent: 87.5,
        occupancyRate: 91.25,
        admitToday: 2,
        dischargeToday: 1,
        specialties: [{ name: 'เวชบำบัดวิกฤต', count: 7 }],
        icnpClassifications: [{ name: 'Critical', count: 7 }],
        unclassifiedBeds: [],
        extra: {
          onVentilator: 4,
          ciCount: 3,
        },
      },
      {
        id: '04',
        name: 'ชั้น 4 ห้องพิเศษ',
        totalBeds: 21,
        occupiedBeds: 12,
        remainingBeds: 9,
        usagePercent: 57.14,
        occupancyRate: 60.0,
        admitToday: 1,
        dischargeToday: 2,
        specialties: [{ name: 'ศัลยกรรม', count: 14 }],
        icnpClassifications: [{ name: 'Convalescent', count: 14 }],
        unclassifiedBeds: [],
        extra: {
          vipPersons: 14,
        },
      },
      {
        id: '02',
        name: 'ชั้น 5 ห้องคลอด',
        totalBeds: 8,
        occupiedBeds: 4,
        remainingBeds: 4,
        usagePercent: 50.0,
        occupancyRate: 48.0,
        admitToday: 2,
        dischargeToday: 1,
        specialties: [{ name: 'สูติ-นรีเวชกรรม', count: 4 }],
        icnpClassifications: [{ name: 'Moderate', count: 4 }],
        unclassifiedBeds: [],
        extra: {
          preDelivery: { beds: 4, occupied: 1, remaining: 3, usagePercent: 25 },
          postDelivery: { beds: 4, occupied: 3, remaining: 1, usagePercent: 75 },
        },
      },
      {
        id: '09',
        name: 'อาคารหอผู้ป่วยในร่มบุญ',
        totalBeds: 22,
        occupiedBeds: 10,
        remainingBeds: 12,
        usagePercent: 45.45,
        occupancyRate: 51.2,
        admitToday: 1,
        dischargeToday: 0,
        specialties: [{ name: 'ศัลยกรรมกระดูก', count: 10 }],
        icnpClassifications: [{ name: 'Moderate', count: 10 }],
        unclassifiedBeds: [],
      },
    ],
  },
}

describe('BedOccupancyClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => syntheticOccupancyResponse,
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders hospital capacity KPIs, ward summary table, and clinical breakdown cards', async () => {
    render(<BedOccupancyClient />)

    await waitFor(() => {
      expect(screen.getByText('อัตราการครองเตียงผู้ป่วยใน')).toBeInTheDocument()
    })

    // Overview KPIs
    expect(screen.getAllByText('64').length).toBeGreaterThan(0)
    expect(screen.getByText('82.45')).toBeInTheDocument()
    expect(screen.getByText('312')).toBeInTheDocument()
    expect(screen.getByText(/วันนอนรวม 2,003 × 100 \/ \(81 × 30 วัน\)/)).toBeInTheDocument()

    // Ward-specific clinical extras
    expect(screen.getAllByText(/On Ventilator 4 · CI 3/).length).toBeGreaterThan(0)
    expect(screen.getByText('ผู้ป่วยพักจริง 14 คน')).toBeInTheDocument()
    expect(screen.getByText('ห้องรอคลอด (Pre-delivery)')).toBeInTheDocument()
    expect(screen.getByText('ห้องหลังคลอด (Post-delivery)')).toBeInTheDocument()

    // Specialties, ICNP & Unclassified bed tags
    expect(screen.getByText('อายุรกรรม')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('W103')).toBeInTheDocument()
    expect(screen.getByText('W118')).toBeInTheDocument()
  })

  it('filters to wards with unclassified ICNP beds and toggles collapse all', async () => {
    render(<BedOccupancyClient />)

    await waitFor(() => {
      expect(screen.getByText('W103')).toBeInTheDocument()
    })

    // Filter to unclassified ICNP wards only
    fireEvent.click(screen.getByRole('button', { name: /รอระบุ ICNP/ }))

    expect(screen.getByText('W103')).toBeInTheDocument()
    expect(screen.queryByText('ห้องรอคลอด (Pre-delivery)')).not.toBeInTheDocument()

    // Collapse all visible ward detail cards
    fireEvent.click(screen.getByRole('button', { name: 'ย่อทั้งหมด' }))
    expect(screen.queryByText('W103')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ขยายทั้งหมด' })).toBeInTheDocument()

    // Expand again and restore all wards
    fireEvent.click(screen.getByRole('button', { name: 'ขยายทั้งหมด' }))
    expect(screen.getByText('W103')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ทุกหอผู้ป่วย/ }))
    expect(screen.getByText('ห้องรอคลอด (Pre-delivery)')).toBeInTheDocument()
  })

  it('surfaces error alert on API failure and retries cleanly', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => syntheticOccupancyResponse,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'ไม่สามารถเชื่อมต่อระบบข้อมูลเตียงได้' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<BedOccupancyClient />)

    await waitFor(() => {
      expect(screen.getByText('W103')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรชข้อมูล' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ไม่สามารถเชื่อมต่อระบบข้อมูลเตียงได้')
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
