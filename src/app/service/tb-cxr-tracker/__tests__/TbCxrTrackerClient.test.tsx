import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TbCxrTrackerClient from '../TbCxrTrackerClient'

const mockRecords = [
  {
    id: 1,
    risk_type: 'ผู้สัมผัสวัณโรค',
    title: 'นาย',
    fname: 'ทดสอบ',
    lname: 'หนึ่ง',
    cid: '1000000000001',
    gender: 'M',
    born: '19700512',
    addr: '12',
    mu: '1',
    province_id: '52',
    amphur_id: '07',
    tambol_id: '01',
    full_name: 'นายทดสอบ หนึ่ง',
    people_type: null,
    race_id: null,
    hn: '0001111',
    inccl_id: 'บัตรทอง',
    contact_date: '20261001',
    symptom_screen: 'ไม่มีอาการ',
    cxr_date: '20261015',
    cxr_status: 'DONE' as const,
    cxr_result: 'Normal',
    cxr_abnormal_result: null,
    dx: null,
    icd10: 'Z201',
    hba1c: null,
    immunno_discase: null,
    b24: null,
    b24_ch: null,
    note: null,
    age: 56,
    status: 'รพ.สต.ล้อมแรด',
    home: '12 ม.1 ต.ล้อมแรด อ.เถิน',
  },
  {
    id: 2,
    risk_type: 'กลุ่มเสี่ยงเบาหวาน',
    title: 'นาง',
    fname: 'สมมติ',
    lname: 'สอง',
    cid: '1000000000002',
    gender: 'F',
    born: '19650820',
    addr: '34',
    mu: '2',
    province_id: '52',
    amphur_id: '07',
    tambol_id: '02',
    full_name: 'นางสมมติ สอง',
    people_type: null,
    race_id: null,
    hn: '0002222',
    inccl_id: 'บัตรทอง',
    contact_date: '20261005',
    symptom_screen: 'ไอเรื้อรัง',
    cxr_date: null,
    cxr_status: 'MISSING' as const,
    cxr_result: null,
    cxr_abnormal_result: null,
    dx: 'DM',
    icd10: 'E119',
    hba1c: '7.4',
    immunno_discase: null,
    b24: null,
    b24_ch: null,
    note: 'นัดติดตามคัดกรอง',
    age: 61,
    status: 'รพ.สต.แม่ถอด',
    home: '34 ม.2 ต.แม่ถอด อ.เถิน',
  },
]

const mockApiResponse = {
  success: true,
  count: 2,
  summary: {
    total: 2,
    doneCount: 1,
    missingCount: 1,
    coveragePercentage: 50,
    statusBreakdown: {
      'รพ.สต.ล้อมแรด': 1,
      'รพ.สต.แม่ถอด': 1,
    },
  },
  data: mockRecords,
}

describe('TbCxrTrackerClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => mockApiResponse,
    } as Response)
  })

  it('renders KPI summary, patient rows, and Thai Buddhist dates without raw NULL text', async () => {
    render(<TbCxrTrackerClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getAllByText('นายทดสอบ หนึ่ง').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getAllByText('15 ต.ค. 2569').length).toBeGreaterThan(0)
    expect(screen.queryByText('NULL')).not.toBeInTheDocument()
  })

  it('filters by status tab, search input, and subdistrict breakdown panel', async () => {
    render(<TbCxrTrackerClient userRole="subdistrict" />)

    await waitFor(() => {
      expect(screen.getAllByText('นางสมมติ สอง').length).toBeGreaterThan(0)
    })

    // Filter to missing only via tab
    fireEvent.click(screen.getByRole('tab', { name: /ยังไม่ได้ตรวจ/i }))
    expect(screen.queryByText('นายทดสอบ หนึ่ง')).not.toBeInTheDocument()
    expect(screen.getAllByText('นางสมมติ สอง').length).toBeGreaterThan(0)

    // Toggle subdistrict breakdown panel and click รพ.สต.ล้อมแรด
    fireEvent.click(screen.getByRole('button', { name: /ภาพรวมราย รพ\.สต\./i }))
    expect(screen.getByText('ความครอบคลุมแยกตาม รพ.สต. / สถานพยาบาล')).toBeInTheDocument()

    // Reset filters and search by HN
    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))
    const searchInput = screen.getByLabelText('ค้นหารายชื่อผู้ป่วย')
    fireEvent.change(searchInput, { target: { value: '0001111' } })

    expect(screen.getAllByText('นายทดสอบ หนึ่ง').length).toBeGreaterThan(0)
    expect(screen.queryByText('นางสมมติ สอง')).not.toBeInTheDocument()
  })

  it('opens patient detail drawer and export modal cleanly', async () => {
    render(<TbCxrTrackerClient userRole="admin" />)

    await waitFor(() => {
      expect(screen.getAllByText('นางสมมติ สอง').length).toBeGreaterThan(0)
    })

    // Click patient row in table to open drawer
    const cell = screen.getAllByText('นางสมมติ สอง')[0]
    fireEvent.click(cell)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('นัดติดตามคัดกรอง')).toBeInTheDocument()
    expect(screen.getByText('E119')).toBeInTheDocument()

    // Close drawer
    fireEvent.click(screen.getByRole('button', { name: 'ปิดรายละเอียดผู้ป่วย' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Open export modal
    fireEvent.click(screen.getByRole('button', { name: /ส่งออก Excel/i }))
    expect(screen.getByText('ส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)')).toBeInTheDocument()
  })
})
