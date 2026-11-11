import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import T1dmImportClient from '../T1dmImportClient'
import type { T1dmRegistryListResult } from '@/lib/clinical/rcmT1dmImportService'

const mockInitialData: T1dmRegistryListResult = {
  items: [
    {
      no: 1,
      id: '101',
      year: '2570',
      pid: '1529900011111',
      hn: '0011111',
      ptname: 'นาง กานดา ใจดี',
      regdate: '2026-10-15',
      visitdate: '2026-10-20',
      type: 'GDM',
      maininscl: 'UCS',
      hospmainCode: '11152',
      hospmainName: 'รพ.เถิน',
      hospmain: '11152:รพ.เถิน',
      isOtherHosp: false,
      fileName: 'T1DM_OCT.xlsx',
    },
    {
      no: 2,
      id: '102',
      year: '2570',
      pid: '1529900022222',
      hn: null,
      ptname: 'นาง สุมาลี ปัญญา',
      regdate: '2026-10-16',
      visitdate: '2026-10-22',
      type: 'T1DM',
      maininscl: 'OFC',
      hospmainCode: '10700',
      hospmainName: 'รพ.ลำปาง',
      hospmain: '10700:รพ.ลำปาง',
      isOtherHosp: true, // FoxPro pink row
      fileName: 'T1DM_OCT.xlsx',
    },
  ],
  totalCount: 2,
  totalPages: 1,
  page: 1,
  pageSize: 50,
  summary: {
    totalRegistered: 2,
    myHospCount: 1,
    otherHospCount: 1,
    t1dmCount: 1,
    gdmCount: 1,
    pdmCount: 0,
    otherTypeCount: 0,
    matchedHosxpHnCount: 1,
    totalFiles: 1,
  },
  importedFiles: [
    {
      fileName: 'T1DM_OCT.xlsx',
      rowCount: 2,
      minRegDate: '2026-10-15',
      maxRegDate: '2026-10-16',
      otherHospCount: 1,
    },
  ],
  availableTypes: ['T1DM', 'GDM', 'PDM'],
  myHospCode: '11152',
}

describe('T1dmImportClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockInitialData,
      }),
    })
  })

  it('renders header, 4 KPI stats cards, and dropzone properly', () => {
    render(<T1dmImportClient initialData={mockInitialData} canImport={true} canManage={true} />)

    // Header & Title
    expect(
      screen.getByRole('heading', { level: 1, name: /ระบบนำเข้าข้อมูลทะเบียน T1DM\/GDM\/PDM/i })
    ).toBeInTheDocument()

    // 4 KPI Cards
    expect(screen.getByText('ผู้ป่วยในทะเบียนทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('หน่วยบริการ รพ.เถิน (11152)')).toBeInTheDocument()
    expect(screen.getByText('ต่างหน่วยบริการ (ไม่ใช่ 11152)')).toBeInTheDocument()
    expect(screen.getByText('จำนวนไฟล์ที่นำเข้าแล้ว')).toBeInTheDocument()

    // Upload Dropzone
    expect(
      screen.getByText(/ลากไฟล์มาวางที่นี่ หรือ/i)
    ).toBeInTheDocument()

    // Link to Fund 2
    expect(screen.getByRole('link', { name: /เปิดหน้ารายชื่อผู้รับบริการ \(กองทุน\) →/i })).toBeInTheDocument()
  })

  it('renders options checkboxes for 11152 filtering and Dry Run mode', () => {
    render(<T1dmImportClient initialData={mockInitialData} canImport={true} />)

    expect(screen.getByText(/นำเข้าเฉพาะหน่วยบริการ รพ.เถิน \(11152\)/i)).toBeInTheDocument()
    expect(screen.getByText(/โหมดตรวจสอบข้อมูลอย่างเดียว \(Dry Run\)/i)).toBeInTheDocument()
  })

  it('opens confirmation modal when "ลบรายการต่าง รพ." button is clicked', () => {
    render(<T1dmImportClient initialData={mockInitialData} canImport={true} />)

    const deleteOtherBtn = screen.getByRole('button', { name: /ลบรายการต่าง รพ\./i })
    fireEvent.click(deleteOtherBtn)

    expect(screen.getByText(/ยืนยันการลบรายการต่าง รพ\.\?/i)).toBeInTheDocument()
    expect(screen.getByText(/hospmain <> '11152'/i)).toBeInTheDocument()
  })

  it('opens file management modal when "ประวัติไฟล์" button is clicked', () => {
    render(<T1dmImportClient initialData={mockInitialData} canImport={true} />)

    const filesBtn = screen.getByRole('button', { name: /ประวัติไฟล์/i })
    fireEvent.click(filesBtn)

    expect(screen.getByText(/รายการไฟล์ที่นำเข้าในระบบ/i)).toBeInTheDocument()
    expect(screen.getByText('T1DM_OCT.xlsx')).toBeInTheDocument()
  })
})
