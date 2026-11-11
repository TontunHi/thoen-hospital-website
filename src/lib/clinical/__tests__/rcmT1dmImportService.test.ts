import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import {
  RcmT1dmImportService,
  parseHospMainField,
  normalizePid,
  DEFAULT_MY_HOSPCODE,
} from '../rcmT1dmImportService'
import { clearMemoryCache } from '@/lib/cache'
import { apiGateway } from '@/lib/apiGateway'

// Mock apiGateway
vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    clinical: {
      importT1dmRegistries: vi.fn(),
      deleteT1dmRegistries: vi.fn(),
    },
    app: {
      query: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
      transaction: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

describe('RcmT1dmImportService Helpers', () => {
  it('correctly parses HospMain field into 5-digit code and inline name', () => {
    expect(parseHospMainField('11152:รพ.เถิน')).toEqual({
      code: '11152',
      inlineName: 'รพ.เถิน',
    })
    expect(parseHospMainField('10700')).toEqual({
      code: '10700',
      inlineName: null,
    })
    expect(parseHospMainField('42:รพ.สต.ดอนแก้ว')).toEqual({
      code: '00042',
      inlineName: 'รพ.สต.ดอนแก้ว',
    })
    expect(parseHospMainField('')).toEqual({
      code: '',
      inlineName: null,
    })
  })

  it('normalizes PID by removing non-digits when 13 digits', () => {
    expect(normalizePid('1-5299-00011-11-1')).toBe('1529900011111')
    expect(normalizePid(' 3520800100034 ')).toBe('3520800100034')
    expect(normalizePid('')).toBe('')
  })
})

describe('RcmT1dmImportService Workbook Parsing & Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  async function createTestT1dmWorkbook() {
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet('T1DM_DATA')
    // Row 1: Marker
    sheet.getCell('A1').value = 'รายงานทะเบียน T1DM/GDM/PDM'
    // Row 2: Headers (FoxPro: RUN|ปีงบประมาณ|PID|ชื่อ-นามสกุล|สิทธิ|หน่วยบริการลงทะเบียน|ชนิดการลงทะเบียน|วันที่ลงทะเบียน|วันที่เข้ารับบริการ)
    sheet.addRow([
      'RUN',
      'ปีงบประมาณ',
      'PID',
      'ชื่อ-นามสกุล',
      'สิทธิ',
      'หน่วยบริการลงทะเบียน',
      'ชนิดการลงทะเบียน',
      'วันที่ลงทะเบียน',
      'วันที่เข้ารับบริการ',
    ])
    // Row 3: Patient from 11152 (Mine)
    sheet.addRow([
      '1',
      '2570',
      '1529900011111',
      'นาง กานดา ใจดี',
      'UCS',
      '11152:รพ.เถิน',
      'GDM',
      '2026-10-15',
      '2026-10-20',
    ])
    // Row 4: Patient from 10700 (Other hospital)
    sheet.addRow([
      '2',
      '2570',
      '1529900022222',
      'นาง สุมาลี ปัญญา',
      'OFC',
      '10700:รพ.ลำปาง',
      'T1DM',
      '2026-10-16',
      '2026-10-22',
    ])
    // Row 5: Another patient from 11152
    sheet.addRow([
      '3',
      '2570',
      '1529900033333',
      'นางสาว อารีย์ สมบูรณ์',
      'SSS',
      '11152',
      'PDM',
      '2026-10-18',
      '2026-10-25',
    ])

    return Buffer.from(await wb.xlsx.writeBuffer())
  }

  it('parses Excel workbook and filters other hospitals when filterMyHospOnly is true (FoxPro default)', async () => {
    const buffer = await createTestT1dmWorkbook()
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM patient')) {
        return [
          { cid: '1529900011111', hn: '0011111', ptname: 'นาง กานดา ใจดี' },
          { cid: '1529900033333', hn: '0033333', ptname: 'นางสาว อารีย์ สมบูรณ์' },
        ]
      }
      if (sql.includes('FROM hospcode')) {
        return [
          { hospcode: '11152', name: 'รพ.เถิน' },
          { hospcode: '10700', name: 'รพ.ลำปาง' },
        ]
      }
      if (sql.includes('COUNT(*) AS cnt FROM rcmdb.t1dm')) {
        return [{ cnt: 0 }]
      }
      return []
    })

    vi.mocked(apiGateway.clinical.importT1dmRegistries).mockResolvedValue({
      success: true,
      insertedCount: 2,
      updatedCount: 0,
    })

    const result = await RcmT1dmImportService.parseAndImportWorkbook(buffer, 'T1DM_OCT2026.xlsx', {
      isDryRun: false,
      filterMyHospOnly: true,
      myHospCode: '11152',
      executor: mockExecutor,
    })

    expect(result.fileName).toBe('T1DM_OCT2026.xlsx')
    expect(result.totalRowsScanned).toBe(3)
    expect(result.validRowsCount).toBe(3)
    // 1 row from 10700 skipped by filter
    expect(result.skippedOtherHospCount).toBe(1)
    expect(result.importedCount).toBe(2)
    expect(result.previewRows.length).toBe(2)
    expect(result.previewRows[0].hospmainCode).toBe('11152')
    expect(result.previewRows[0].hn).toBe('0011111')
  })

  it('imports all rows when filterMyHospOnly is false (FoxPro lhospcode=.F.)', async () => {
    const buffer = await createTestT1dmWorkbook()
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS cnt FROM rcmdb.t1dm')) {
        return [{ cnt: 0 }]
      }
      return []
    })

    vi.mocked(apiGateway.clinical.importT1dmRegistries).mockResolvedValue({
      success: true,
      insertedCount: 3,
      updatedCount: 0,
    })

    const result = await RcmT1dmImportService.parseAndImportWorkbook(buffer, 'T1DM_ALL.xlsx', {
      isDryRun: false,
      filterMyHospOnly: false,
      myHospCode: '11152',
      executor: mockExecutor,
    })

    expect(result.importedCount).toBe(3)
    expect(result.skippedOtherHospCount).toBe(0)
    // Preview contains both 11152 and 10700
    expect(result.previewRows.some((r) => r.isOtherHosp)).toBe(true)
  })

  it('detects duplicate files if already imported', async () => {
    const buffer = await createTestT1dmWorkbook()
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS cnt FROM rcmdb.t1dm')) {
        return [{ cnt: 15 }] // Previously imported 15 rows
      }
      return []
    })

    const result = await RcmT1dmImportService.parseAndImportWorkbook(buffer, 'PREVIOUS_FILE.xlsx', {
      isDryRun: true,
      executor: mockExecutor,
    })

    expect(result.isAlreadyImported).toBe(true)
    expect(result.existingFileRowCount).toBe(15)
  })
})

describe('RcmT1dmImportService Registry Queries & Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  const mockDbRows = [
    {
      id: '1',
      year: '2570',
      pid: '1529900011111',
      ptname: 'นาง กานดา ใจดี',
      regdate: '2026-10-15',
      visitdate: '2026-10-20',
      type: 'GDM',
      maininscl: 'UCS',
      hospmain_code: '11152',
      hospmain_name: 'รพ.เถิน',
      hospmain: '11152:รพ.เถิน',
      filename: 'T1DM_FILE1.xlsx',
      hn: '0011111',
    },
    {
      id: '2',
      year: '2570',
      pid: '1529900022222',
      ptname: 'นาง สุมาลี ปัญญา',
      regdate: '2026-10-16',
      visitdate: '2026-10-22',
      type: 'T1DM',
      maininscl: 'OFC',
      hospmain_code: '10700',
      hospmain_name: 'รพ.ลำปาง',
      hospmain: '10700:รพ.ลำปาง',
      filename: 'T1DM_FILE1.xlsx',
      hn: null,
    },
    {
      id: '3',
      year: '2570',
      pid: '1529900033333',
      ptname: 'นางสาว อารีย์ สมบูรณ์',
      regdate: '2026-10-18',
      visitdate: '2026-10-25',
      type: 'PDM',
      maininscl: 'SSS',
      hospmain_code: '11152',
      hospmain_name: 'รพ.เถิน',
      hospmain: '11152:รพ.เถิน',
      filename: 'T1DM_FILE2.xlsx',
      hn: '0033333',
    },
  ]

  it('aggregates registry list and summary metrics accurately', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockDbRows)

    const result = await RcmT1dmImportService.getRegistryList(
      {
        page: 1,
        pageSize: 50,
      },
      mockExecutor
    )

    expect(result.totalCount).toBe(3)
    expect(result.summary.totalRegistered).toBe(3)
    expect(result.summary.myHospCount).toBe(2)
    expect(result.summary.otherHospCount).toBe(1)
    expect(result.summary.gdmCount).toBe(1)
    expect(result.summary.t1dmCount).toBe(1)
    expect(result.summary.pdmCount).toBe(1)
    expect(result.summary.matchedHosxpHnCount).toBe(2)
    expect(result.importedFiles.length).toBe(2)
  })

  it('filters by hospFilter = MINE', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockDbRows)

    const result = await RcmT1dmImportService.getRegistryList(
      {
        hospFilter: 'MINE',
      },
      mockExecutor
    )

    expect(result.totalCount).toBe(2)
    expect(result.items.every((i) => !i.isOtherHosp)).toBe(true)
  })

  it('filters by hospFilter = OTHER (FoxPro pink highlighted rows)', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockDbRows)

    const result = await RcmT1dmImportService.getRegistryList(
      {
        hospFilter: 'OTHER',
      },
      mockExecutor
    )

    expect(result.totalCount).toBe(1)
    expect(result.items[0].isOtherHosp).toBe(true)
    expect(result.items[0].hospmainCode).toBe('10700')
  })

  it('filters by search term', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockDbRows)

    const result = await RcmT1dmImportService.getRegistryList(
      {
        search: 'สุมาลี',
      },
      mockExecutor
    )

    expect(result.totalCount).toBe(1)
    expect(result.items[0].ptname).toBe('นาง สุมาลี ปัญญา')
  })

  it('executes delete by mode other_hospitals, by_file, and all', async () => {
    vi.mocked(apiGateway.clinical.deleteT1dmRegistries).mockResolvedValue({
      success: true,
      deletedCount: 1,
    })

    const delOther = await RcmT1dmImportService.deleteRegistries({
      mode: 'other_hospitals',
      myHospCode: '11152',
    })
    expect(delOther.deletedCount).toBe(1)
    expect(apiGateway.clinical.deleteT1dmRegistries).toHaveBeenCalledWith({
      mode: 'other_hospitals',
      fileName: undefined,
      myHospCode: '11152',
    })

    const delFile = await RcmT1dmImportService.deleteRegistries({
      mode: 'by_file',
      fileName: 'T1DM_FILE1.xlsx',
    })
    expect(delFile.deletedCount).toBe(1)
  })
})
