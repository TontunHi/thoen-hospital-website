import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FctHomeVisitClient from '../FctHomeVisitClient'

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
}))

const syntheticItems = [
  {
    id: 1,
    fiscalYear: 2570,
    visitDate: '2026-10-15',
    pcuName: 'รพ.สต.ทดสอบ',
    patientName: 'นายสมมติ เยี่ยมบ้าน',
    hn: '0001234',
    age: 68,
    address: '99 หมู่ 1 ต.ล้อมแรด อ.เถิน',
    adlScore: 4,
    adlGroup: 'ติดเตียง',
    diagnosis: 'Ischemic Stroke, HT',
    patientCategory: 'stroke',
    followUpPlan: 'ติดตามแผลกดทับ',
    treatmentFacility: 'รพ.เถิน',
    visitOutcome: 'ดีขึ้น',
    overallRiskLevel: 'High',
    riskLevel: 'Moderate',
    dentalNote: 'ตรวจสุขภาพช่องปาก',
    pharmacyNote: 'ตรวจสอบความร่วมมือในการใช้ยา',
    nutritionStatus: 'ปกติ',
    nutritionNote: 'แนะนำอาหารอ่อนโปรตีนเพียงพอ',
    ptCategory: 'ฝึกทรงตัว ยืน เดิน',
    ptNote: 'ฝึกขยับข้อเข่า',
    thaiMedCategory: 'นวดประคบสมุนไพร',
    thaiMedNote: 'ประคบลดตึงกล้ามเนื้อ',
    createdBy: 'staff1',
    updatedBy: 'staff1',
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: '2026-10-15T08:00:00Z',
  },
  {
    id: 2,
    fiscalYear: 2570,
    visitDate: '2026-11-02',
    pcuName: 'รพ.เถิน',
    patientName: 'นางตัวอย่าง ทดลอง',
    hn: '0005678',
    age: 72,
    address: '12 หมู่ 3 ต.แม่ปะ อ.เถิน',
    adlScore: null,
    adlGroup: null,
    diagnosis: 'COPD',
    patientCategory: 'COPD',
    followUpPlan: 'ประเมินการใช้ยาพ่น',
    treatmentFacility: 'รพ.เถิน',
    visitOutcome: 'คงเดิม',
    overallRiskLevel: 'Moderate',
    riskLevel: 'Low',
    dentalNote: null,
    pharmacyNote: 'สอนพ่นยา MDI',
    nutritionStatus: 'ผอม BMI น้อย',
    nutritionNote: null,
    ptCategory: null,
    ptNote: null,
    thaiMedCategory: null,
    thaiMedNote: null,
    createdBy: 'staff1',
    updatedBy: 'staff1',
    createdAt: '2026-11-02T08:00:00Z',
    updatedAt: '2026-11-02T08:00:00Z',
  },
]

const mockListResponse = {
  success: true,
  data: {
    fiscalYear: 2570,
    availableFiscalYears: [2571, 2570, 2569, 2568],
    availablePcus: ['รพ.สต.ทดสอบ', 'รพ.เถิน'],
    items: syntheticItems,
    options: {
      pcu: [
        { id: 1, category: 'pcu', label: 'รพ.สต.ทดสอบ', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 2, category: 'pcu', label: 'รพ.เถิน', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      patient_category: [
        { id: 3, category: 'patient_category', label: 'stroke', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      adl_group: [
        { id: 4, category: 'adl_group', label: 'ติดเตียง', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 5, category: 'adl_group', label: 'ติดบ้าน', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 6, category: 'adl_group', label: 'ติดสังคม', sortOrder: 2, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      visit_outcome: [
        { id: 7, category: 'visit_outcome', label: 'ดีขึ้น', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 8, category: 'visit_outcome', label: 'คงเดิม', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 9, category: 'visit_outcome', label: 'แย่ลง', sortOrder: 2, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 10, category: 'visit_outcome', label: 'เสียชีวิต', sortOrder: 3, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      overall_risk: [
        { id: 11, category: 'overall_risk', label: 'Low', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 12, category: 'overall_risk', label: 'Moderate', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 13, category: 'overall_risk', label: 'High', sortOrder: 2, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      risk_level: [
        { id: 14, category: 'risk_level', label: 'Low', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 15, category: 'risk_level', label: 'Moderate', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 16, category: 'risk_level', label: 'High', sortOrder: 2, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      treatment_facility: [
        { id: 17, category: 'treatment_facility', label: 'รพ.เถิน', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      nutrition_status: [
        { id: 18, category: 'nutrition_status', label: 'ปกติ', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 19, category: 'nutrition_status', label: 'ผอม BMI น้อย', sortOrder: 1, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
        { id: 20, category: 'nutrition_status', label: 'ขาดสารอาหารรุนแรง', sortOrder: 2, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      pt_category: [
        { id: 21, category: 'pt_category', label: 'ฝึกทรงตัว ยืน เดิน', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
      thai_med_category: [
        { id: 22, category: 'thai_med_category', label: 'นวดประคบสมุนไพร', sortOrder: 0, isActive: true, createdBy: 'system', createdAt: '', updatedAt: '' },
      ],
    },
    stats: {
      totalVisits: 2,
      uniquePatients: 2,
      unidentifiedHnVisits: 1,
      highRiskOrSevereCount: 1,
      adlGroupCounts: { ติดเตียง: 1, ติดบ้าน: 0, ติดสังคม: 0, ยังไม่ระบุ: 1 },
      outcomeCounts: { ดีขึ้น: 1, คงเดิม: 1, แย่ลง: 0, เสียชีวิต: 0 },
      overallRiskCounts: { High: 1, Moderate: 1, Low: 0 },
      riskLevelCounts: { Low: 1, Moderate: 1, High: 0 },
      nutritionStatusCounts: { ปกติ: 1, 'ผอม BMI น้อย': 1 },
      byPcu: [
        {
          pcuName: 'รพ.สต.ทดสอบ',
          totalVisits: 1,
          uniquePatients: 1,
          adlGroupCounts: { ติดเตียง: 1 },
          outcomeCounts: { ดีขึ้น: 1 },
        },
        {
          pcuName: 'รพ.เถิน',
          totalVisits: 1,
          uniquePatients: 1,
          adlGroupCounts: { ยังไม่ระบุ: 1 },
          outcomeCounts: { คงเดิม: 1 },
        },
      ],
      patientCategoryBreakdown: [
        { label: 'stroke', count: 1 },
        { label: 'COPD', count: 1 },
      ],
      monthlyTrend: [
        { monthKey: '2026-10', monthLabel: 'ต.ค. 69', count: 1 },
        { monthKey: '2026-11', monthLabel: 'พ.ย. 69', count: 1 },
      ],
      disciplineEngagement: [
        { key: 'nutrition', label: 'นักโภชนาการ', filledCount: 2, rate: 100 },
        { key: 'dental', label: 'ทันตกรรม', filledCount: 1, rate: 50 },
        { key: 'pharmacy', label: 'เภสัชกรรม', filledCount: 2, rate: 100 },
        { key: 'pt', label: 'กายภาพบำบัด', filledCount: 1, rate: 50 },
        { key: 'thaiMed', label: 'แพทย์แผนไทย', filledCount: 1, rate: 50 },
      ],
    },
  },
}

describe('FctHomeVisitClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/service/fct-home-visit/lookup-hn')) {
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
                patientName: 'นางสาวตัวอย่าง ใจดี',
                age: 61,
                address: '77 หมู่ 2 ต.เถินบุรี อ.เถิน',
              },
            }),
        })
      }

      if (url === '/api/service/fct-home-visit' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ success: true, data: { id: 3 } }),
        })
      }

      if (url === '/api/service/fct-home-visit/1' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body || '{}'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...syntheticItems[0], ...body },
            }),
        })
      }

      if (url === '/api/service/fct-home-visit/2' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body || '{}'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...syntheticItems[1], ...body },
            }),
        })
      }

      if (url === '/api/service/fct-home-visit/1' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { id: 1 } }),
        })
      }

      if (url === '/api/service/fct-home-visit/import' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                insertedCount: 1,
                skippedDuplicateCount: 0,
                errorCount: 0,
                duplicates: [],
              },
            }),
        })
      }

      if (url === '/api/service/fct-home-visit/options' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 99, category: 'pt_category', label: 'ฝึกเดินในชุมชน' },
            }),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockListResponse),
      })
    }) as typeof fetch
  })

  it('renders view-only mode cleanly when member lacks manage_fct_home_visit permission', async () => {
    render(<FctHomeVisitClient userRole="member" canManage={false} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมมติ เยี่ยมบ้าน')).toBeInTheDocument()
    })

    expect(screen.getByText('15 ต.ค. 2569')).toBeInTheDocument()
    expect(screen.getByText('สิทธิ์ดูข้อมูลอย่างเดียว')).toBeInTheDocument()
    expect(screen.getByText(/ไม่ระบุ HN 1 ครั้ง/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export Excel/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /เพิ่มรายการเยี่ยม/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /นำเข้า Excel\/CSV/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ตั้งค่าตัวเลือก/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^แก้ไข นายสมมติ เยี่ยมบ้าน$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ลบ นายสมมติ เยี่ยมบ้าน$/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle('คลิกเพื่อแก้ไข คะแนน ADL')).not.toBeInTheDocument()
  })

  it('supports HN lookup without CID, auto-suggests ADL group, and submits create & edit forms for manager', async () => {
    render(<FctHomeVisitClient userRole="subdistrict" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมมติ เยี่ยมบ้าน')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /นำเข้า Excel\/CSV/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ตั้งค่าตัวเลือก/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /เพิ่มรายการเยี่ยม/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText(/บัตรประชาชน|CID/i)).not.toBeInTheDocument()

    const hnInput = within(dialog).getByLabelText(/HN รพ\./i)
    fireEvent.change(hnInput, { target: { value: '5555' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /ดึงข้อมูล/i }))

    await waitFor(() => {
      expect(within(dialog).getByDisplayValue('นางสาวตัวอย่าง ใจดี')).toBeInTheDocument()
    })
    expect(within(dialog).getByDisplayValue('61')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('77 หมู่ 2 ต.เถินบุรี อ.เถิน')).toBeInTheDocument()

    const adlScoreInput = within(dialog).getByLabelText(/คะแนน ADL/i)
    fireEvent.change(adlScoreInput, { target: { value: '3' } })
    const adlGroupSelect = within(dialog).getByLabelText(/^กลุ่ม ADL$/i) as HTMLSelectElement
    expect(adlGroupSelect.value).toBe('ติดเตียง')

    fireEvent.change(adlGroupSelect, { target: { value: 'ติดบ้าน' } })
    expect(adlGroupSelect.value).toBe('ติดบ้าน')

    fireEvent.change(hnInput, { target: { value: '9999999' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /ดึงข้อมูล/i }))

    await waitFor(() => {
      expect(within(dialog).getByText(/ไม่พบ HN นี้ใน HOSxP/i)).toBeInTheDocument()
    })

    fireEvent.click(within(dialog).getByRole('button', { name: /บันทึกรายการเยี่ยม/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /^แก้ไข นายสมมติ เยี่ยมบ้าน$/i }))
    expect(screen.getByText('แก้ไขข้อมูลการเยี่ยมบ้าน FCT')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /บันทึกการแก้ไข/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit/1',
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })
  })

  it('edits sheet cells inline including auto-suggesting adlGroup when adlGroup is empty, and deletes a visit', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<FctHomeVisitClient userRole="member" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นางตัวอย่าง ทดลอง')).toBeInTheDocument()
    })

    const adlCells = screen.getAllByTitle('คลิกเพื่อแก้ไข คะแนน ADL')
    fireEvent.click(adlCells[1])

    const adlInput = screen.getByLabelText('กรอก คะแนน ADL ของ นางตัวอย่าง ทดลอง')
    fireEvent.change(adlInput, { target: { value: '8' } })
    fireEvent.keyDown(adlInput, { key: 'Enter' })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit/2',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ adlScore: 8, adlGroup: 'ติดบ้าน' }),
        })
      )
    })

    const outcomeCells = screen.getAllByTitle('คลิกเพื่อแก้ไข ผลลัพธ์การเยี่ยม')
    fireEvent.click(outcomeCells[0])

    const outcomeSelect = screen.getByLabelText('เลือก ผลลัพธ์การเยี่ยม ของ นายสมมติ เยี่ยมบ้าน')
    fireEvent.change(outcomeSelect, { target: { value: 'แย่ลง' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ visitOutcome: 'แย่ลง' }),
        })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /^ลบ นายสมมติ เยี่ยมบ้าน$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('parses CSV in Import modal, previews rows, and submits batch import', async () => {
    render(<FctHomeVisitClient userRole="member" canManage={true} initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมมติ เยี่ยมบ้าน')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /นำเข้า Excel\/CSV/i }))

    const dialog = screen.getByRole('dialog')
    const csvText = [
      'ลำดับ,ชื่อ-สกุล,HN,อายุ,ที่อยู่,รพ.สต.,คะแนน ADL,กลุ่ม ADL,Dx,ประเภทคนไข้,สิ่งที่ต้องตาม,วันที่เยี่ยมบ้าน,สถานที่รักษา,ผลลัพธ์การเยี่ยม',
      '1,นายทดสอบ นำเข้า,1234,65,"10 หมู่ 1, ต.ล้อมแรด",รพ.เถิน,10,,HT,DM HT,ติดตามความดัน,2026-10-20,รพ.เถิน,ดีขึ้น',
    ].join('\n')

    const file = new File([csvText], 'fct-sample.csv', { type: 'text/csv' })
    const fileInput = within(dialog).getByLabelText('เลือกไฟล์ Excel หรือ CSV')
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(within(dialog).getByText('นายทดสอบ นำเข้า')).toBeInTheDocument()
    })
    expect(within(dialog).getByText('0001234')).toBeInTheDocument()
    expect(within(dialog).getByText('ติดบ้าน')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /ยืนยันนำเข้า 1 รายการ/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit/import',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    await waitFor(() => {
      expect(within(dialog).getByText(/นำเข้าสำเร็จ/i)).toBeInTheDocument()
    })
  })

  it('shows admin settings button and creates option under selected category', async () => {
    render(<FctHomeVisitClient userRole="admin" initialFiscalYear={2570} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมมติ เยี่ยมบ้าน')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ตั้งค่าตัวเลือก/i }))
    fireEvent.click(screen.getByRole('button', { name: /กายภาพบำบัด \(หมวดกิจกรรม\)/i }))

    fireEvent.change(screen.getByPlaceholderText(/เพิ่มตัวเลือกในหมวด/i), {
      target: { value: 'ฝึกเดินในชุมชน' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^เพิ่ม$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/service/fct-home-visit/options',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            category: 'pt_category',
            label: 'ฝึกเดินในชุมชน',
            sortOrder: 1,
            isActive: true,
          }),
        })
      )
    })
  })
})
