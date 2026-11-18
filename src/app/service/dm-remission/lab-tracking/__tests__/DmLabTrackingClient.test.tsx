import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DmLabTrackingClient from '../DmLabTrackingClient'

const mockLabTrackingResponse = {
  success: true,
  data: {
    fiscalYear: 2569,
    fiscalYearRange: { startDate: '2025-10-01', endDate: '2026-09-30' },
    availableFiscalYears: [2570, 2569, 2568, 2567],
    availableTambons: ['ล้อมแรด'],
    appliedFilters: {
      fiscalYear: 2569,
      a1cMax: 6.5,
      ucScope: 'visit',
      diagScope: 'ever',
      drugScope: 'fy',
      cohortStatus: 'all',
      tambon: null,
      search: null,
      includeDeceased: false,
    },
    summary: {
      totalEligible: 1,
      registeredCount: 0,
      unregisteredCount: 1,
      avgLatestA1c: 6.1,
      medianLatestA1c: 6.1,
      repeatTestedCount: 1,
      a1cBands: [
        { key: 'lt_5_7', label: '< 5.7% (ช่วงปกติ)', count: 0, percent: 0 },
        { key: '5_7_to_6_0', label: '5.7 – 6.0%', count: 0, percent: 0 },
        { key: '6_1_to_6_5', label: '6.1 – 6.5%', count: 1, percent: 100 },
      ],
      byTambon: [{ tambonName: 'ล้อมแรด', count: 1, registeredCount: 0 }],
      funnel: {
        totalA1cTested: 4386,
        a1cUnderLimit: 1701,
        ucEligible: 1300,
        e11Diagnosed: 1100,
        noDmDrugs: 404,
        registeredInCohort: 40,
        unregisteredCandidates: 364,
      },
    },
    items: [
      {
        hn: '0001234',
        cid: '1520000000001',
        patientName: 'นายทดสอบ ปลอดยา',
        ageYears: 59,
        sexLabel: 'ชาย',
        deathFlag: false,
        visitDate: '2026-08-12',
        vn: '690812091234',
        labOrderNumber: 5001,
        latestA1c: 6.1,
        a1cTestCount: 2,
        prevA1c: 6.4,
        prevA1cDate: '2026-02-10',
        visitPttypeCode: '33',
        visitPttypeName: 'บัตรทอง 30บาท ในเขต',
        currentPttypeCode: '33',
        currentPttypeName: 'บัตรทอง 30บาท ในเขต',
        isUcVisit: true,
        isUcCurrent: true,
        lastE11Date: '2026-08-12',
        lastE11Icd10: 'E119',
        inFyE11Count: 2,
        sameVnE11: true,
        hasDmDrugInFy: false,
        hasDmDrug90dBeforeLab: false,
        hasDmDrugOnLabVisit: false,
        lastDmDrugDate: null,
        dmDrugsInFy: [],
        tambonName: 'ล้อมแรด',
        villageName: 'บ้านล้อมแรด',
        villageMoo: '1',
        inCohortRegistry: false,
        cohortRemissionStatus: null,
      },
    ],
    pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
    fetchedAt: '2026-11-16T10:00:00.000Z',
  },
}

const mockTimelineResponse = {
  success: true,
  data: {
    hn: '0001234',
    patientName: 'นายทดสอบ ปลอดยา',
    cid: '1520000000001',
    ageYears: 59,
    currentPttypeName: 'บัตรทอง 30บาท ในเขต',
    labHistory: [
      { labOrderNumber: 5001, orderDate: '2026-08-12', vn: '6908150001', a1c: 6.1, fpg: 102 },
    ],
    e11Diagnoses: [
      { vstdate: '2026-08-12', vn: '690812091234', icd10: 'E119', diagType: '1' },
    ],
    dmPrescriptions: [],
  },
}

describe('DmLabTrackingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/lab-tracking/0001234')) {
        return new Response(JSON.stringify(mockTimelineResponse), { status: 200 })
      }
      return new Response(JSON.stringify(mockLabTrackingResponse), { status: 200 })
    }) as unknown as typeof fetch
  })

  it('renders screening funnel, KPI cards, patient rows, drug checklist, and patient timeline modal', async () => {
    render(<DmLabTrackingClient userRole="staff" />)

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ ปลอดยา')).toBeInTheDocument()
    })

    expect(screen.getByText('ติดตามการเจาะ HbA1c ผู้ป่วยเบาหวาน')).toBeInTheDocument()
    expect(screen.getByText('ลำดับการคัดกรองจาก HOSxP')).toBeInTheDocument()
    expect(screen.getAllByText('6.10%').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('E119')).toBeInTheDocument()

    // Toggle HOSxP rule panel
    fireEvent.click(screen.getByRole('button', { name: /เงื่อนไข HOSxP/i }))
    expect(screen.getByLabelText(/การตรวจสิทธิ์ UC/i)).toBeInTheDocument()

    // Toggle checked antidiabetic drug list
    fireEvent.click(screen.getByRole('button', { name: /รายการยาเบาหวานที่ตรวจสอบ/i }))
    expect(screen.getByText('METFORMIN 500 mg')).toBeInTheDocument()

    // Open patient timeline drawer
    fireEvent.click(screen.getByRole('button', { name: /ดูประวัติ/i }))
    await waitFor(() => {
      expect(screen.getByText('ประวัติผล Lab HbA1c / FPG (15 ครั้งล่าสุด)')).toBeInTheDocument()
    })
    expect(screen.getByText('ไม่พบประวัติการสั่งยาเบาหวานในกลุ่มตรวจสอบ')).toBeInTheDocument()
  })

  it('hydrates from SSR initialData without firing a redundant mount fetch', () => {
    render(
      <DmLabTrackingClient
        userRole="staff"
        initialData={mockLabTrackingResponse.data as any}
        initialError={null}
      />
    )

    expect(screen.getByText('นายทดสอบ ปลอดยา')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('displays separate registry columns for DM Remission and T1DM/GDM/PDM', () => {
    const dualRegistryData = {
      ...mockLabTrackingResponse.data,
      items: [
        {
          ...mockLabTrackingResponse.data.items[0],
          inCohortRegistry: true,
          cohortRemissionStatus: 'ไม่ Remission',
          inDmRemissionCohort: true,
          inT1dmRegistry: true,
          t1dmRegistryType: 'T1DM',
        },
      ],
    }

    render(
      <DmLabTrackingClient
        userRole="staff"
        initialData={dualRegistryData as any}
        initialError={null}
      />
    )

    expect(screen.getByText('อยู่ในทะเบียน (ไม่ Remission)')).toBeInTheDocument()
    expect(screen.getByText('ลงทะเบียนแล้ว (T1DM)')).toBeInTheDocument()
  })
})
