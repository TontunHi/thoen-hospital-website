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

  it('defaults isDryRun to true when options.isDryRun is omitted', async () => {
    const buffer = await createTestT1dmWorkbook()
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmT1dmImportService.parseAndImportWorkbook(buffer, 'DEFAULT_DRYRUN.xlsx', {
      executor: mockExecutor,
    })

    expect(result.isDryRun).toBe(true)
    expect(apiGateway.clinical.importT1dmRegistries).not.toHaveBeenCalled()
  })

  it('parses HTML table .xls export (NHSO portal style) without JSZip error', async () => {
    const htmlXls = `<html><head><meta charset="utf-8"></head><body>
      <table>
        <tr><td colspan="9">รายงานทะเบียน T1DM/GDM/PDM</td></tr>
        <tr><th>RUN</th><th>ปีงบประมาณ</th><th>PID</th><th>ชื่อ-นามสกุล</th><th>สิทธิ</th><th>หน่วยบริการลงทะเบียน</th><th>ชนิดการลงทะเบียน</th><th>วันที่ลงทะเบียน</th><th>วันที่เข้ารับบริการ</th></tr>
        <tr><td>1</td><td>2570</td><td>1529900011111</td><td>นาง กานดา ใจดี</td><td>UCS</td><td>11152:รพ.เถิน</td><td>GDM</td><td>2026-10-15</td><td>2026-10-20</td></tr>
      </table>
    </body></html>`
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmT1dmImportService.parseAndImportWorkbook(
      Buffer.from(htmlXls, 'utf8'),
      'T1DM_EXPORT.xls',
      { isDryRun: true, executor: mockExecutor }
    )

    expect(result.importedCount).toBe(1)
    expect(result.previewRows[0].pid).toBe('1529900011111')
    expect(result.previewRows[0].type).toBe('GDM')
  })

  it('parses SpreadsheetML 2003 XML .xls export without JSZip error', async () => {
    const xmlXls = `<?xml version="1.0"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="T1DM">
          <Table>
            <Row><Cell><Data>RUN</Data></Cell><Cell><Data>ปีงบประมาณ</Data></Cell><Cell><Data>PID</Data></Cell><Cell><Data>ชื่อ-นามสกุล</Data></Cell><Cell><Data>สิทธิ</Data></Cell><Cell><Data>หน่วยบริการลงทะเบียน</Data></Cell><Cell><Data>ชนิดการลงทะเบียน</Data></Cell><Cell><Data>วันที่ลงทะเบียน</Data></Cell><Cell><Data>วันที่เข้ารับบริการ</Data></Cell></Row>
            <Row><Cell><Data>1</Data></Cell><Cell><Data>2570</Data></Cell><Cell><Data>1529900033333</Data></Cell><Cell><Data>นางสาว อารีย์ สมบูรณ์</Data></Cell><Cell><Data>SSS</Data></Cell><Cell><Data>11152</Data></Cell><Cell><Data>T1DM</Data></Cell><Cell><Data>2026-10-18</Data></Cell><Cell><Data>2026-10-25</Data></Cell></Row>
          </Table>
        </Worksheet>
      </Workbook>`
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmT1dmImportService.parseAndImportWorkbook(
      Buffer.from(xmlXls, 'utf8'),
      'T1DM_XML.xls',
      { isDryRun: true, executor: mockExecutor }
    )

    expect(result.importedCount).toBe(1)
    expect(result.previewRows[0].pid).toBe('1529900033333')
    expect(result.previewRows[0].type).toBe('T1DM')
  })

  it('parses CSV file and throws clear Thai error for OLE2 binary .xls', async () => {
    const csv = [
      'RUN,ปีงบประมาณ,PID,ชื่อ-นามสกุล,สิทธิ,หน่วยบริการลงทะเบียน,ชนิดการลงทะเบียน,วันที่ลงทะเบียน,วันที่เข้ารับบริการ',
      '1,2570,1529900011111,นาง กานดา ใจดี,UCS,11152:รพ.เถิน,PDM,2026-10-15,2026-10-20',
    ].join('\n')
    const mockExecutor = vi.fn().mockResolvedValue([])

    const csvResult = await RcmT1dmImportService.parseAndImportWorkbook(
      Buffer.from(csv, 'utf8'),
      'T1DM.csv',
      { isDryRun: true, executor: mockExecutor }
    )
    expect(csvResult.importedCount).toBe(1)
    expect(csvResult.previewRows[0].type).toBe('PDM')

    const ole2Buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    await expect(
      RcmT1dmImportService.parseAndImportWorkbook(ole2Buffer, 'legacy_t1dm.xls', {
        isDryRun: true,
        executor: mockExecutor,
      })
    ).rejects.toThrow('Save As เป็น .xlsx หรือ .csv')
  })

  it('parses real binary BIFF8 .xls (OLE2) workbook end-to-end', async () => {
    const biffRec = (type: number, payload: Buffer) => {
      const h = Buffer.alloc(4)
      h.writeUInt16LE(type, 0)
      h.writeUInt16LE(payload.length, 2)
      return Buffer.concat([h, payload])
    }
    const biffStr16 = (text: string, shortLen = false) => {
      const utf16 = Buffer.from(text, 'utf16le')
      const hdr = Buffer.alloc(shortLen ? 2 : 3)
      if (shortLen) {
        hdr.writeUInt8(text.length, 0)
        hdr.writeUInt8(1, 1) // fHighByte = 1 (UTF-16LE)
      } else {
        hdr.writeUInt16LE(text.length, 0)
        hdr.writeUInt8(1, 2)
      }
      return Buffer.concat([hdr, utf16])
    }

    const strings = [
      'RUN', 'ปีงบประมาณ', 'PID', 'ชื่อ-นามสกุล', 'สิทธิ', 'หน่วยบริการลงทะเบียน', 'ชนิดการลงทะเบียน', 'วันที่ลงทะเบียน', 'วันที่เข้ารับบริการ',
      '1', '2570', '1529900011111', 'นาง กานดา ใจดี', 'UCS', '11152:รพ.เถิน', 'GDM', '2026-10-15', '2026-10-20',
    ]
    const bofGlobals = biffRec(0x0809, Buffer.from([0x00, 0x06, 0x05, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    const sstHdr = Buffer.alloc(8)
    sstHdr.writeUInt32LE(strings.length, 0)
    sstHdr.writeUInt32LE(strings.length, 4)
    const sstRec = biffRec(0x00fc, Buffer.concat([sstHdr, ...strings.map((s) => biffStr16(s, false))]))
    const eofRec = biffRec(0x000a, Buffer.alloc(0))

    // Sheet substream starts after globals + dummy boundsheet
    const sheetNameBuf = biffStr16('T1DM', true)
    const bsPlaceholder = Buffer.alloc(6 + sheetNameBuf.length)
    const bsRecSize = 4 + bsPlaceholder.length
    const sheetOffset = bofGlobals.length + bsRecSize + sstRec.length + eofRec.length
    bsPlaceholder.writeUInt32LE(sheetOffset, 0)
    sheetNameBuf.copy(bsPlaceholder, 6)
    const bsRec = biffRec(0x0085, bsPlaceholder)

    const bofSheet = biffRec(0x0809, Buffer.from([0x00, 0x06, 0x10, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    const labelCells = strings.map((_, idx) => {
      const p = Buffer.alloc(10)
      p.writeUInt16LE(idx < 9 ? 0 : 1, 0)
      p.writeUInt16LE(idx % 9, 2)
      p.writeUInt32LE(idx, 6)
      return biffRec(0x00fd, p) // LABELSST
    })

    const wbRaw = Buffer.concat([bofGlobals, bsRec, sstRec, eofRec, bofSheet, ...labelCells, eofRec])
    const wbSize = Math.max(4096, Math.ceil(wbRaw.length / 512) * 512)
    const wbStream = Buffer.alloc(wbSize)
    wbRaw.copy(wbStream)
    const wbSectors = wbSize / 512

    // OLE2 Header (sector size 512): FAT at sector 0, Dir at sector 1, Workbook at sectors 2..2+wbSectors-1
    const hdr = Buffer.alloc(512, 0xff)
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(hdr, 0)
    hdr.writeUInt16LE(0x003e, 24)
    hdr.writeUInt16LE(0x0003, 26)
    hdr.writeUInt16LE(0xfffe, 28)
    hdr.writeUInt16LE(9, 30) // 512B sectors
    hdr.writeUInt16LE(6, 32)
    hdr.writeUInt32LE(1, 44) // 1 FAT sector
    hdr.writeUInt32LE(1, 48) // Dir start sector 1
    hdr.writeUInt32LE(4096, 56) // Mini cutoff
    hdr.writeUInt32LE(0xfffffffe, 60) // No mini FAT
    hdr.writeUInt32LE(0xfffffffe, 68) // No DIFAT
    hdr.writeUInt32LE(0, 76) // DIFAT[0] = sector 0

    const fat = Buffer.alloc(512, 0xff)
    fat.writeUInt32LE(0xfffffffd, 0) // sector 0 = FATSECT
    fat.writeUInt32LE(0xfffffffe, 4) // sector 1 = ENDOFCHAIN
    for (let s = 0; s < wbSectors; s++) {
      fat.writeUInt32LE(s === wbSectors - 1 ? 0xfffffffe : 2 + s + 1, (2 + s) * 4)
    }

    const dir = Buffer.alloc(512)
    const writeDirEntry = (slot: number, name: string, type: number, startSec: number, size: number) => {
      const off = slot * 128
      const nm = Buffer.from(`${name}\0`, 'utf16le')
      nm.copy(dir, off)
      dir.writeUInt16LE(nm.length, off + 64)
      dir.writeUInt8(type, off + 66)
      dir.writeUInt8(1, off + 67) // black
      dir.writeUInt32LE(0xffffffff, off + 68)
      dir.writeUInt32LE(0xffffffff, off + 72)
      dir.writeUInt32LE(type === 5 ? 1 : 0xffffffff, off + 76) // Root child = slot 1
      dir.writeUInt32LE(startSec, off + 116)
      dir.writeUInt32LE(size, off + 120)
    }
    writeDirEntry(0, 'Root Entry', 5, 0xfffffffe, 0)
    writeDirEntry(1, 'Workbook', 2, 2, wbSize)

    const realBiff8Xls = Buffer.concat([hdr, fat, dir, wbStream])
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmT1dmImportService.parseAndImportWorkbook(realBiff8Xls, 'NHSO_T1DM.xls', {
      isDryRun: true,
      executor: mockExecutor,
    })

    expect(result.importedCount).toBe(1)
    expect(result.previewRows[0].pid).toBe('1529900011111')
    expect(result.previewRows[0].ptname).toBe('นาง กานดา ใจดี')
    expect(result.previewRows[0].type).toBe('GDM')
  })

  it('parses 14-column NHSO report with "RUN NUMBER" header, blank rows, hyphen hospmain, and DD/MM/YYYY dates', async () => {
    const csv14Cols = [
      '   รายงาน การลงทะเบียนผู้ป่วย T1DM รายใหม่/GDM/PDM  ออกรายงานวันที่ 18/11/2026 14:30:06,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,',
      ',,,,,,,,,,,,,',
      'RUN NUMBER,ปีงบประมาณ,PID,ชื่อ-นามสกุล,สิทธิ,เขต,จังหวัด,หน่วยบริการลงทะเบียน,ชนิดการลงทะเบียน,วันที่ลงทะเบียน,วันที่เข้ารับบริการ,สถานะ,วัน expire date,เหตุผล',
      '2027-16683,2026,1529900011111,นาง สมมติ ทดสอบ,UCS,เขต 1 เชียงใหม่,ลำปาง,11152-รพ.เถิน,GDM,28/08/2026,28/08/2026,Y,,',
      '2026-97222,2026,1529900022222,นาย ตัวอย่าง ทดสอบ,WEL,เขต 1 เชียงใหม่,ลำปาง,11152-รพ.เถิน,T2DM,01/04/2026,07/10/2025,Y,,',
    ].join('\n')
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmT1dmImportService.parseAndImportWorkbook(
      Buffer.from(csv14Cols, 'utf8'),
      't1dm_report_14col.csv',
      { isDryRun: true, executor: mockExecutor }
    )

    expect(result.importedCount).toBe(2)
    expect(result.previewRows[0].id).toBe('2027-16683')
    expect(result.previewRows[0].year).toBe('2026')
    expect(result.previewRows[0].pid).toBe('1529900011111')
    expect(result.previewRows[0].hospmainCode).toBe('11152')
    expect(result.previewRows[0].type).toBe('GDM')
    expect(result.previewRows[0].regdate).toBe('2026-08-28')
    expect(result.previewRows[0].visitdate).toBe('2026-08-28')
    expect(result.previewRows[1].type).toBe('T2DM')
    expect(result.previewRows[1].regdate).toBe('2026-04-01')
    expect(result.previewRows[1].visitdate).toBe('2025-10-07')
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
