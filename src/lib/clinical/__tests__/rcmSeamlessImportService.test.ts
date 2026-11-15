import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmSeamlessImportService,
  resolveFundFromRep,
  resolveFundCodeFromNameOrRep,
  calculateYYMM,
  calculateYearBudget,
  normalizeDate,
  parseNumber,
  cleanCellString,
  extractHospCodeFromText,
  normalizeHn,
  normalizeAn,
  isSeamlessFileName,
  SEAMLESS_FUND_MAP,
} from '../rcmSeamlessImportService'

// Mock queryClinicalDb
vi.mock('@/lib/clinicalDb', () => ({
  queryClinicalDb: vi.fn(),
}))

vi.mock('@/lib/apiGateway', async () => {
  const actual = await vi.importActual<typeof import('@/lib/apiGateway')>('@/lib/apiGateway')
  return {
    ...actual,
    apiGateway: {
      clinical: {
        importSeamlessRecords: vi.fn(),
        deleteSeamlessRecords: vi.fn(),
        syncSeamlessPayment: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway, GatewayNotFoundError, GatewayUnavailableError } from '@/lib/apiGateway'

describe('RcmSeamlessImportService Utilities', () => {
  it('correctly maps Rep prefixes to canonical fund names', () => {
    expect(resolveFundFromRep('DAMD6901001')).toBe('ระบบบริการทางการแพทย์ AMED')
    expect(resolveFundFromRep('DCCS6902002')).toBe('ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก')
    expect(resolveFundFromRep('DDSA6903003')).toBe('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')
    expect(resolveFundFromRep('DNAP6904004')).toBe('ระบบสารสนเทศการให้บริการผู้ติดเชื้อเอชไอวี ผู้ป่วยเอดส์ แห่งชาติ (NAP)')
    expect(resolveFundFromRep('DTTM6905005')).toBe('ระบบบริการการแพทย์แผนไทย')
    expect(resolveFundFromRep('UNKNOWN123')).toBe('กองทุน UNKN')
    expect(resolveFundFromRep('')).toBe('ไม่ระบุกองทุน')
  })

  it('contains all 30 standard fund prefixes', () => {
    const keys = Object.keys(SEAMLESS_FUND_MAP)
    expect(keys.length).toBe(30)
    expect(keys).toContain('DAMD')
    expect(keys).toContain('DAME')
    expect(keys).toContain('DANC')
    expect(keys).toContain('DATK')
    expect(keys).toContain('DBMT')
    expect(keys).toContain('DCAC')
    expect(keys).toContain('DCCS')
    expect(keys).toContain('DCKD')
    expect(keys).toContain('DCMH')
    expect(keys).toContain('DCNB')
    expect(keys).toContain('DDEN')
    expect(keys).toContain('DDOW')
    expect(keys).toContain('DDSA')
    expect(keys).toContain('DHEM')
    expect(keys).toContain('DHTD')
    expect(keys).toContain('DINS')
    expect(keys).toContain('DKTP')
    expect(keys).toContain('DLTC')
    expect(keys).toContain('DLTD')
    expect(keys).toContain('DMOP')
    expect(keys).toContain('DMOR')
    expect(keys).toContain('DMTB')
    expect(keys).toContain('DMXD')
    expect(keys).toContain('DNAP')
    expect(keys).toContain('DPHS')
    expect(keys).toContain('DPRX')
    expect(keys).toContain('DTDT')
    expect(keys).toContain('DTLM')
    expect(keys).toContain('DTSH')
    expect(keys).toContain('DTTM')
  })

  it('calculates Buddhist Era YYMM correctly', () => {
    // 2026-08-31 -> 2569 -> '6908'
    expect(calculateYYMM('2026-08-31')).toBe('6908')
    // 2026-10-15 -> 2569 -> '6910'
    expect(calculateYYMM('2026-10-15')).toBe('6910')
    expect(calculateYYMM('')).toBe('')
  })

  it('calculates Fiscal Year (YearBudget) in Buddhist Era correctly (Oct-Sep threshold)', () => {
    // August 2026 is Fiscal Year 2569
    expect(calculateYearBudget('2026-08-31')).toBe('2569')
    // October 2026 is Fiscal Year 2570
    expect(calculateYearBudget('2026-10-01')).toBe('2570')
    // December 2026 is Fiscal Year 2570
    expect(calculateYearBudget('2026-12-15')).toBe('2570')
    // January 2027 is Fiscal Year 2570
    expect(calculateYearBudget('2027-01-10')).toBe('2570')
    // September 2027 is Fiscal Year 2570
    expect(calculateYearBudget('2027-09-30')).toBe('2570')
    expect(calculateYearBudget('')).toBe('')
  })

  it('normalizes various date formats to YYYY-MM-DD', () => {
    expect(normalizeDate('2026-08-31')).toBe('2026-08-31')
    expect(normalizeDate('31/08/2026')).toBe('2026-08-31')
    // Thai Buddhist year: 31/08/2569 -> 2026-08-31
    expect(normalizeDate('31/08/2569')).toBe('2026-08-31')
    expect(normalizeDate(new Date('2026-08-31T00:00:00.000Z'))).toBe('2026-08-31')
    expect(normalizeDate(null)).toBeNull()
    expect(normalizeDate('')).toBeNull()
  })

  it('parses numeric values defensively', () => {
    expect(parseNumber(123.45)).toBe(123.45)
    expect(parseNumber('1,234.50')).toBe(1234.5)
    expect(parseNumber(null)).toBe(0)
    expect(parseNumber('invalid')).toBe(0)
    expect(parseNumber(undefined, 10)).toBe(10)
  })

  it('cleans cell strings correctly', () => {
    expect(cleanCellString('  hello  ')).toBe('hello')
    expect(cleanCellString({ text: '  nested text  ' })).toBe('nested text')
    expect(cleanCellString(null)).toBe('')
  })
})

describe('RcmSeamlessImportService.parseWorkbook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('parses Excel workbook containing INDIVIDUAL, SUMMARY, and DENY CODE sheets', async () => {
    // Create an in-memory workbook
    const wb = new ExcelJS.Workbook()

    // 1. INDIVIDUAL sheet
    const indSheet = wb.addWorksheet('REP_INDIVIDUAL')
    indSheet.addRow(['รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ'])
    indSheet.addRow([
      'ลำดับ',
      'Rep',
      'TranID',
      'PID',
      'สิทธิการรักษาพยาบาล',
      'วันที่รับบริการ',
      'วันที่ส่งข้อมูล',
      'วันที่ลงทะเบียน',
      'รายการประเภทที่ขอเบิก',
      'VisitNo',
      'จำนวน',
      'ราคาต่อหน่วย',
      'ราคาเพดาน',
      'รวมเงินที่ขอเบิก',
      'ชดเชย',
      'ไม่ชดเชย',
      'จ่ายเพิ่ม',
      'เรียกคืน',
      'หน่วยบริการแม่ข่าย',
    ])
    indSheet.addRow([
      1,
      'DDSA69093000090',
      '691107156138',
      '3520800100034',
      'WEL',
      '2026-08-31',
      '2026-08-31',
      '2026-08-31',
      'กายภาพบำบัด',
      '15',
      1,
      350,
      350,
      350,
      34.41,
      0,
      0,
      0,
      '10700',
    ])
    indSheet.addRow([
      2,
      'DCCS69093000010',
      '691105716926',
      '3520800188276',
      'WEL',
      '2026-08-31',
      '2026-08-31',
      '2026-08-31',
      'ตรวจมะเร็งปากมดลูก',
      '3',
      1,
      270,
      270,
      270,
      250.0,
      0,
      0,
      0,
      '10700',
    ])

    // 2. SUMMARY sheet
    const sumSheet = wb.addWorksheet('SUMMARY')
    // Set F12, E12, G12
    sumSheet.getCell('F12').value = 'DDSA69093000090'
    sumSheet.getCell('E12').value = 'DDSA6941090041'
    sumSheet.getCell('G12').value = '2026-09-30'

    // 3. DENY CODE sheet
    const denySheet = wb.addWorksheet('DENY CODE')
    denySheet.addRow(['รหัส', 'ความหมาย'])
    denySheet.addRow(['E01', 'ข้อมูลไม่ถูกต้อง'])
    denySheet.addRow(['E02', 'เกินโควต้า'])

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())

    // Mock HOSxP batch patient resolution
    vi.mocked(queryClinicalDb).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM rcmdb.nhso_budget')) {
        return [{ paydate: '2026-10-15', accountcode: 'ACC_01' }] as any
      }
      if (sql.includes('FROM patient')) {
        return [
          { cid: '3520800100034', hn: '0018735', ptname: 'วงเวียน ตุ่นบุตร' },
          { cid: '3520800188276', hn: '0067578', ptname: 'พรรณี กิมเฮง' },
        ] as any
      }
      if (sql.includes('FROM ovst')) {
        return [
          { vn: '690831090120', hn: '0018735', vstdate: '2026-08-31' },
          { vn: '690831080144', hn: '0067578', vstdate: '2026-08-31' },
        ] as any
      }
      return [] as any
    })

    const result = await RcmSeamlessImportService.parseWorkbook(buffer, 'test-seamless.xlsx', {
      isDryRun: true,
      autoEnrichHosp: true,
      updatePayment: true,
      myHospCode: '10700',
    })

    expect(result.fileName).toBe('test-seamless.xlsx')
    expect(result.validRows).toBe(2)
    expect(result.errorRows).toBe(0)
    expect(result.denyCodes.length).toBe(2)
    expect(result.denyCodes[0].code).toBe('E01')

    // Check SUMMARY linking
    expect(result.summaryInfo).toBeDefined()
    expect(result.summaryInfo?.rep).toBe('DDSA69093000090')
    expect(result.summaryInfo?.payNo).toBe('DDSA6941090041')
    expect(result.summaryInfo?.payDate).toBe('2026-10-15')
    expect(result.summaryInfo?.codeAccount).toBe('ACC_01')

    // Check enriched patient data
    const row1 = result.previewRows[0]
    expect(row1.id).toBe('691107156138')
    expect(row1.fund).toBe('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')
    expect(row1.hn).toBe('0018735')
    expect(row1.ptname).toBe('วงเวียน ตุ่นบุตร')
    expect(row1.vn).toBe('690831090120')
    expect(row1.collected).toBe(350)
    expect(row1.compensated).toBe(34.41)
    expect(row1.status).toBe('ชดเชย')

    const row2 = result.previewRows[1]
    expect(row2.id).toBe('691105716926')
    expect(row2.fund).toBe('ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก')
    expect(row2.hn).toBe('0067578')
    expect(row2.ptname).toBe('พรรณี กิมเฮง')
    expect(row2.vn).toBe('690831080144')
    expect(result.isDryRun).toBe(true)
    expect(apiGateway.clinical.importSeamlessRecords).not.toHaveBeenCalled()
  })

  it('persists rows via apiGateway.clinical.importSeamlessRecords when isDryRun=false and reports duplicate counts', async () => {
    const wb = new ExcelJS.Workbook()
    const indSheet = wb.addWorksheet('INDIVIDUAL')
    indSheet.addRow(['รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ'])
    indSheet.addRow(['ลำดับ', 'Rep', 'TranID', 'PID', 'สิทธิ', 'วันที่รับบริการ', 'รวมเงินที่ขอเบิก', 'ชดเชย'])
    indSheet.addRow([1, 'DDSA69093000090', 'ID_NEW_1', '3520800100034', 'WEL', '2026-08-31', 350, 100])
    indSheet.addRow([2, 'DDSA69093000090', 'ID_DUP_1', '3520800188276', 'WEL', '2026-08-31', 270, 200])
    // Duplicate ID inside same file should deduplicate
    indSheet.addRow([3, 'DDSA69093000090', 'ID_DUP_1', '3520800188276', 'WEL', '2026-08-31', 270, 250])

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())

    vi.mocked(queryClinicalDb).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT COUNT(*) AS cnt FROM rcmdb.seamless WHERE FileName')) {
        return [{ cnt: 1 }] as any
      }
      if (sql.includes('SELECT ID FROM rcmdb.seamless WHERE ID IN')) {
        return [{ ID: 'ID_DUP_1' }] as any
      }
      return [] as any
    })

    vi.mocked(apiGateway.clinical.importSeamlessRecords).mockResolvedValue({
      success: true,
      totalSubmitted: 2,
      insertedCount: 1,
      updatedCount: 1,
      skippedCount: 0,
      duplicateCount: 1,
    })

    const result = await RcmSeamlessImportService.parseWorkbook(buffer, 'dup-test.xlsx', {
      isDryRun: false,
      autoEnrichHosp: false,
      updatePayment: false,
      duplicateMode: 'update',
    })

    expect(apiGateway.clinical.importSeamlessRecords).toHaveBeenCalledTimes(1)
    expect(apiGateway.clinical.importSeamlessRecords).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ID_NEW_1', compensated: 100 }),
        expect.objectContaining({ id: 'ID_DUP_1', compensated: 250 }),
      ]),
      'update'
    )
    expect(result.validRows).toBe(2)
    expect(result.duplicateInFileCount).toBe(1)
    expect(result.existingInDbCount).toBe(1)
    expect(result.newInDbCount).toBe(1)
    expect(result.insertedCount).toBe(1)
    expect(result.updatedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(result.isAlreadyImported).toBe(true)
  })

  it('passes duplicateMode=skip and skips duplicate rows', async () => {
    const wb = new ExcelJS.Workbook()
    const indSheet = wb.addWorksheet('INDIVIDUAL')
    indSheet.addRow(['รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ'])
    indSheet.addRow(['ลำดับ', 'Rep', 'TranID', 'PID', 'สิทธิ', 'วันที่รับบริการ', 'รวมเงินที่ขอเบิก', 'ชดเชย'])
    indSheet.addRow([1, 'DDSA69093000090', 'ID_DUP_1', '3520800188276', 'WEL', '2026-08-31', 270, 200])

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())

    vi.mocked(queryClinicalDb).mockResolvedValue([{ ID: 'ID_DUP_1' }] as any)
    vi.mocked(apiGateway.clinical.importSeamlessRecords).mockResolvedValue({
      success: true,
      totalSubmitted: 1,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      duplicateCount: 1,
    })

    const result = await RcmSeamlessImportService.parseWorkbook(buffer, 'skip-test.xlsx', {
      isDryRun: false,
      autoEnrichHosp: false,
      updatePayment: false,
      duplicateMode: 'skip',
    })

    expect(apiGateway.clinical.importSeamlessRecords).toHaveBeenCalledWith(
      expect.any(Array),
      'skip'
    )
    expect(result.insertedCount).toBe(0)
    expect(result.updatedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
  })

  it('throws clear message if Gateway seamless import endpoint returns 404', async () => {
    const wb = new ExcelJS.Workbook()
    const indSheet = wb.addWorksheet('INDIVIDUAL')
    indSheet.addRow(['รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ'])
    indSheet.addRow(['ลำดับ', 'Rep', 'TranID', 'PID', 'สิทธิ', 'วันที่รับบริการ', 'รวมเงินที่ขอเบิก', 'ชดเชย'])
    indSheet.addRow([1, 'DDSA69093000090', 'ID_1', '3520800188276', 'WEL', '2026-08-31', 270, 200])
    const buffer = Buffer.from(await wb.xlsx.writeBuffer())

    vi.mocked(queryClinicalDb).mockResolvedValue([] as any)
    vi.mocked(apiGateway.clinical.importSeamlessRecords).mockRejectedValue(
      new GatewayNotFoundError('Not found')
    )

    await expect(
      RcmSeamlessImportService.parseWorkbook(buffer, 'test.xlsx', {
        isDryRun: false,
        autoEnrichHosp: false,
        updatePayment: false,
      })
    ).rejects.toThrow('API Gateway ยังไม่รองรับการบันทึกข้อมูล Seamless')
  })

  it('filters out non-myHospCode rows by default (FoxPro lHospCode & SeekHCode parity)', async () => {
    const wb = new ExcelJS.Workbook()
    const indSheet = wb.addWorksheet('INDIVIDUAL')
    indSheet.addRow(['รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ'])
    indSheet.addRow(['', 'รหัสหน่วยบริการ', '11152'])
    indSheet.addRow([
      'ลำดับ',
      'Rep',
      'TranID',
      'PID',
      'สิทธิ',
      'วันที่รับบริการ',
      'รวมเงินที่ขอเบิก',
      'ชดเชย',
      'หน่วยบริการแม่ข่าย',
    ])
    // Row 1: matches myHospCode via empty column fallback to SeekHCode (11152)
    indSheet.addRow([1, 'DDSA69093000090', 'ID_THOEN_1', '3520800100034', 'WEL', '2026-08-31', 350, 100, ''])
    // Row 2: explicit 11152
    indSheet.addRow([2, 'DDSA69093000090', 'ID_THOEN_2', '3520800188276', 'WEL', '2026-08-31', 270, 200, '11152'])
    // Row 3: another hospital code -> should be skipped when filterMyHospOnly=true
    indSheet.addRow([3, 'DDSA69093000090', 'ID_OTHER_1', '3520800199999', 'WEL', '2026-08-31', 500, 400, '06195'])

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
    vi.mocked(queryClinicalDb).mockResolvedValue([] as any)

    const filteredResult = await RcmSeamlessImportService.parseWorkbook(buffer, 'hcode-filter.xlsx', {
      isDryRun: true,
      autoEnrichHosp: false,
      updatePayment: false,
    })

    expect(filteredResult.filterMyHospOnly).toBe(true)
    expect(filteredResult.validRows).toBe(2)
    expect(filteredResult.skippedOtherHospCount).toBe(1)
    expect(filteredResult.previewRows.map((r) => r.id)).toEqual(['ID_THOEN_1', 'ID_THOEN_2'])
    expect(filteredResult.previewRows[0].hcode).toBe('11152')

    const unfilteredResult = await RcmSeamlessImportService.parseWorkbook(buffer, 'hcode-filter.xlsx', {
      isDryRun: true,
      autoEnrichHosp: false,
      updatePayment: false,
      filterMyHospOnly: false,
    })

    expect(unfilteredResult.filterMyHospOnly).toBe(false)
    expect(unfilteredResult.validRows).toBe(3)
    expect(unfilteredResult.skippedOtherHospCount).toBe(0)
  })

  it('parses DKTP 2-row merged header CSV format (REP No., subheader collected/noCompensated, second ลำดับที่)', async () => {
    const csvLines = [
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      ',รายงาน : ,REP แบบ INDIVIDUAL,,,,,,,,,,,,,,,,,,,,,,,,',
      ',วันที่จัดพิมพ์ : ,13/11/2569 เวลา 15:11,,,,,,,,,,,,,,,,,,,,,,,,',
      ',โครงการ : ,Krungthai Digital Health Platform,,,,,,,,,,,,,,,,,,,,,,,,',
      ',รอบ : ,2569/กุมภาพันธ์16,,,,,,,,,,,,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      'ลำดับที่,REP No.,Trans ID,HN,AN,"VCTID,NAPNumber,PID",ชื่อ-สกุล,สิทธิการรักษาพยาบาล,หน่วยบริการแม่ข่าย (HmainOP),วันที่ส่งข้อมูล,วันที่เข้ารักษา/วันที่รับบริการ,ลำดับที่,รายการประเภทที่ขอเบิก,เรียกเก็บ,,,,ล่าช้า (PS),,ชดเชย,,,,สถานะ,หมายเหตุ,หมายเหตุอื่นๆ (STMID),หน่วยบริการที่ส่งข้อมูล (HSEND)',
      ',,,,,,,,,,,,,จำนวน,ราคาต่อหน่วย,ราคาเพดาน,รวมเงินที่ขอเบิก,PS CODE,%,ชดเชย,ไม่ชดเชย,จ่ายเพิ่ม,เรียกคืน,,,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      '1,DKTP69021600048,690205799991,,,9999900000011,สมมติ ทดสอบระบบ,WEL,11152,04/02/2569,04/02/2569,1,ค่าบริการเก็บตัวอย่าง,1,50,0,50,0,,50,0,0,0,ชดเชย,,,06203',
    ].join('\n')

    vi.mocked(queryClinicalDb).mockResolvedValue([] as any)

    const result = await RcmSeamlessImportService.parseWorkbook(
      Buffer.from(csvLines, 'utf8'),
      'REP_DKTP_690216.csv',
      {
        isDryRun: true,
        autoEnrichHosp: false,
        updatePayment: false,
      }
    )

    expect(result.validRows).toBe(1)
    expect(result.errorRows).toBe(0)
    const row = result.previewRows[0]
    expect(row.rep).toBe('DKTP69021600048')
    expect(row.fund).toBe('Krungthai Digital Health Platform')
    expect(row.id).toBe('690205799991')
    expect(row.pid).toBe('9999900000011')
    expect(row.ptname).toBe('สมมติ ทดสอบระบบ')
    expect(row.hcode).toBe('11152')
    expect(row.hsend).toBe('06203')
    expect(row.admDate).toBe('2026-02-04')
    expect(row.sendDate).toBe('2026-02-04')
    expect(row.serialNo).toBe('1')
    expect(row.collected).toBe(50)
    expect(row.compensated).toBe(50)
    expect(row.noCompensated).toBe(0)
    expect(row.status).toBe('ชดเชย')
  })

  it('throws clear Thai error when uploading OLE2 binary .xls file', async () => {
    const ole2Buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    await expect(
      RcmSeamlessImportService.parseWorkbook(ole2Buffer, 'legacy_rep.xls', {
        isDryRun: true,
        autoEnrichHosp: false,
        updatePayment: false,
      })
    ).rejects.toThrow('Save As เป็น .xlsx หรือ .csv')
  })
})

describe('RcmSeamlessImportService.getSeamlessDatabaseStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('fetches database stats from rcmdb.seamless', async () => {
    vi.mocked(queryClinicalDb).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT \n            COUNT(*) as totalRows')) {
        return [
          {
            totalRows: 86087,
            totalReps: 155,
            totalFiles: 155,
            latestAdmDate: '2026-08-31',
            totalCompensated: 18867767.07,
          },
        ] as any
      }
      if (sql.includes('GROUP BY Fund')) {
        return [
          { fund: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ', rowCount: 17913, totalCompensated: 1214535.53 },
        ] as any
      }
      if (sql.includes('GROUP BY FileName')) {
        return [
          {
            fileName: '11152_DDSA6941090041.XLSX',
            rowCount: 200,
            minDate: '2026-08-01',
            maxDate: '2026-08-31',
            totalCompensated: 50000,
          },
        ] as any
      }
      return [] as any
    })

    const stats = await RcmSeamlessImportService.getSeamlessDatabaseStats()
    expect(stats.totalRows).toBe(86087)
    expect(stats.totalReps).toBe(155)
    expect(stats.totalCompensated).toBe(18867767.07)
    expect(stats.topFunds.length).toBe(1)
    expect(stats.recentFiles.length).toBe(1)
  })
})

describe('Seamless ExcelJS unwrapping, helpers, and FoxPro parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('unwraps ExcelJS richText, formula, and hyperlink objects cleanly', () => {
    expect(
      cleanCellString({ richText: [{ text: '11152' }, { text: '_DDSA' }] })
    ).toBe('11152_DDSA')
    expect(cleanCellString({ formula: 'A1+B1', result: 'REP-123' })).toBe('REP-123')
    expect(cleanCellString({ text: 'link-text', hyperlink: 'https://example.com' })).toBe(
      'link-text'
    )
    expect(parseNumber({ formula: 'SUM(A1:A2)', result: '1,250.50' })).toBe(1250.5)
    expect(normalizeDate({ formula: 'TODAY()', result: '2569-01-15' })).toBe('2026-01-15')
  })

  it('validates seamless filenames, pads HCode, HN, and AN, and resolves fund codes', () => {
    expect(isSeamlessFileName('11152_DDSA6941090041.xlsx')).toBe(true)
    expect(isSeamlessFileName('REP_INDIVIDUAL_6901.xlsx')).toBe(true)
    expect(isSeamlessFileName('random_notes.xlsx')).toBe(false)

    expect(extractHospCodeFromText('6195 (โรงพยาบาลเถิน)')).toBe('06195')
    expect(extractHospCodeFromText('11152 - โรงพยาบาลเถิน')).toBe('11152')

    expect(normalizeHn('1234')).toBe('0001234')
    expect(normalizeHn('1234567')).toBe('1234567')
    expect(normalizeAn('6900012')).toBe('006900012')

    expect(resolveFundCodeFromNameOrRep('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')).toBe('DDSA')
    expect(resolveFundCodeFromNameOrRep('DANC6901001')).toBe('DANC')
  })

  it('parses vertically-merged 2-row ExcelJS headers, "ผู้ป่วย" title, and HN->VN/AN resolution without PID', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('INDIVIDUAL_1')
    sheet.getCell('C1').value = 'รายงานสรุปการขอเบิกชดเชยค่าการรักษาผู้ป่วยของหน่วยบริการ'
    sheet.getCell('A2').value = '11152 โรงพยาบาลเถิน'
    // Vertically-merged 2-row headers (ExcelJS repeats master value on r+1)
    sheet.getCell('A3').value = 'ลำดับ'
    sheet.getCell('B3').value = 'Rep'
    sheet.getCell('C3').value = 'TranID'
    sheet.getCell('D3').value = 'HN'
    sheet.getCell('E3').value = 'วันที่รับบริการ'
    sheet.getCell('F3').value = 'เรียกเก็บ'
    sheet.getCell('G3').value = 'ชดเชย'
    sheet.mergeCells('A3:A4')
    sheet.mergeCells('B3:B4')
    sheet.mergeCells('C3:C4')
    sheet.mergeCells('D3:D4')
    sheet.mergeCells('E3:E4')
    sheet.mergeCells('F3:F4')
    sheet.mergeCells('G3:G4')
    sheet.addRow([1, 'DDSA6901001', 'TX-9001', '1234', '15/01/2569', 500, 450])

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('hospname')) {
        return [{ hospcode: '11152', name: 'โรงพยาบาลเถิน' }] as any
      }
      if (sql.includes('FROM patient') && sql.includes('IN (')) {
        return [{ hn: '0001234', cid: '9999999999999', ptname: 'นาย ทดสอบ' }] as any
      }
      if (sql.includes('FROM ovst')) {
        return [{ vn: '690115080001', hn: '0001234', vstdate: '2026-01-15' }] as any
      }
      return [] as any
    })

    const result = await RcmSeamlessImportService.parseWorkbook(buffer, '11152_DDSA6901.xlsx', {
      isDryRun: true,
      autoEnrichHosp: true,
      filterMyHospOnly: false,
      updatePayment: false,
      executor: mockExecutor,
    })

    expect(result.previewRows).toHaveLength(1)
    expect(result.previewRows[0].hn).toBe('0001234')
    expect(result.previewRows[0].vn).toBe('690115080001')
    expect(result.previewRows[0].ptname).toBe('นาย ทดสอบ')
    expect(result.previewRows[0].fund).toBe('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')
    expect(result.fundBreakdown).toHaveLength(1)
    expect(result.fundBreakdown?.[0].fundCode).toBe('DDSA')
  })

  it('supports SUMMARY-only workbooks cleanly without throwing', async () => {
    const workbook = new ExcelJS.Workbook()
    const summarySheet = workbook.addWorksheet('SUMMARY')
    summarySheet.getCell('E12').value = 'PAY-2569-01'
    summarySheet.getCell('F12').value = 'DDSA6902001'
    summarySheet.getCell('G12').value = '20/02/2569'

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('FROM rcmdb.nhso_budget')) {
        return [{ paydate: '2026-02-20', accountcode: 'AC-999' }] as any
      }
      return [] as any
    })

    const result = await RcmSeamlessImportService.parseWorkbook(buffer, '11152_DDSA6902.xlsx', {
      isDryRun: true,
      autoEnrichHosp: false,
      filterMyHospOnly: false,
      updatePayment: true,
      executor: mockExecutor,
    })

    expect(result.previewRows).toHaveLength(0)
    expect(result.validRows).toBe(0)
    expect(result.summaryInfo).not.toBeNull()
    expect(result.summaryInfo?.rep).toBe('DDSA6902001')
    expect(result.summaryInfo?.payNo).toBe('PAY-2569-01')
    expect(result.summaryInfo?.payDate).toBe('2026-02-20')
    expect(result.summaryInfo?.codeAccount).toBe('AC-999')
  })
})

describe('RcmSeamlessImportService ledger, files, deny codes, delete & sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('fetches paginated ledger with filters and respects SQL parameters', async () => {
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT COUNT(*) AS cnt')) {
        return [{ cnt: 1 }] as any
      }
      if (sql.includes('SELECT DISTINCT Fund')) {
        return [{ fund: 'ระบบเบิกจ่ายตรง (DDSA)' }] as any
      }
      if (sql.includes('FROM rcmdb.seamless')) {
        return [
          {
            id: 'TX-1',
            yymm: '6901',
            yearBudget: '2569',
            fund: 'ระบบเบิกจ่ายตรง (DDSA)',
            period: 'งวด 1',
            rep: 'DDSA6901',
            vn: '6901150001',
            hn: '000001234',
            an: null,
            pid: '9999999999999',
            ptname: 'นาย ทดสอบ',
            admDate: '2026-01-15',
            sendDate: '2026-01-16',
            regDate: null,
            mainInscl: 'UCS',
            department: 'OPD',
            hcode: '11152',
            hsub: '11152',
            hsend: '11152',
            type: 'ค่าบริการ',
            serialNo: '1',
            payNo: 'PAY-1',
            payDate: '2026-02-01',
            yymmPay: '6902',
            yearBudgetPay: '2569',
            codeAccount: 'AC-1',
            collected: 500,
            compensated: 450,
            noCompensated: 50,
            payMore: 0,
            recall: 0,
            status: 'PASS',
            note: null,
            stmid: null,
            equipCode: null,
            equipName: null,
            fileName: '11152_DDSA.xlsx',
          },
        ] as any
      }
      return [] as any
    })

    const ledger = await RcmSeamlessImportService.getSeamlessLedger(
      {
        search: 'TX-1',
        hospFilter: 'MINE',
        payStatus: 'PAID',
        page: 1,
        pageSize: 50,
      },
      mockExecutor
    )

    expect(ledger.totalCount).toBe(1)
    expect(ledger.items).toHaveLength(1)
    expect(ledger.items[0].isOtherHosp).toBe(false)
    expect(ledger.availableFunds).toEqual(['ระบบเบิกจ่ายตรง (DDSA)'])
  })

  it('lists imported files and deny codes', async () => {
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('GROUP BY FileName')) {
        return [
          {
            fileName: '11152_DDSA.xlsx',
            rowCount: 10,
            repCount: 1,
            minDate: '2026-01-01',
            maxDate: '2026-01-15',
            totalCollected: 5000,
            totalCompensated: 4500,
            otherHospCount: 2,
            missingPayDateCount: 1,
          },
        ] as any
      }
      if (sql.includes('FROM rcmdb.seamless_error')) {
        return [
          { Code: 'E01', Name: 'ข้อมูลไม่ครบ' },
          { Code: 'E02', Name: 'เกินกำหนดส่ง' },
        ] as any
      }
      return [] as any
    })

    const files = await RcmSeamlessImportService.getSeamlessImportedFiles(mockExecutor)
    expect(files).toHaveLength(1)
    expect(files[0].otherHospCount).toBe(2)

    const denyCodes = await RcmSeamlessImportService.getSeamlessDenyCodes('E01', mockExecutor)
    expect(denyCodes).toEqual([{ code: 'E01', name: 'ข้อมูลไม่ครบ' }])
  })

  it('delegates deleteSeamlessRecords and syncSeamlessPaymentDates to apiGateway and handles GatewayNotFoundError', async () => {
    vi.mocked(apiGateway.clinical.deleteSeamlessRecords).mockResolvedValueOnce({
      deletedCount: 12,
    } as any)
    const delRes = await RcmSeamlessImportService.deleteSeamlessRecords({
      mode: 'by_file',
      fileName: '11152_DDSA.xlsx',
    })
    expect(delRes.deletedCount).toBe(12)

    vi.mocked(apiGateway.clinical.syncSeamlessPayment).mockResolvedValueOnce({
      updatedPaymentCount: 8,
      backfilledDateCount: 5,
    } as any)
    const syncRes = await RcmSeamlessImportService.syncSeamlessPaymentDates({ force: false })
    expect(syncRes).toEqual({ updatedPaymentCount: 8, backfilledDateCount: 5 })

    vi.mocked(apiGateway.clinical.deleteSeamlessRecords).mockRejectedValueOnce(
      new GatewayNotFoundError('Not Found')
    )
    await expect(
      RcmSeamlessImportService.deleteSeamlessRecords({ mode: 'other_hospitals' })
    ).rejects.toThrow('API Gateway ยังไม่รองรับคำสั่งลบข้อมูล Seamless')
  })
})

describe('RcmSeamlessImportService.persistSeamlessRows chunking & retries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const buildSampleRows = (count: number) =>
    Array.from({ length: count }, (_, idx) => ({
      rowNumber: idx + 1,
      id: `TX-${idx + 1}`,
      rep: 'DKTP69010100046',
      fund: 'Krungthai Digital Health Platform',
      period: '6901',
      vn: null,
      hn: null,
      an: null,
      pid: '9999900000011',
      ptname: 'สมมติ ทดสอบ',
      admDate: '2026-01-15',
      sendDate: '2026-01-16',
      regDate: null,
      mainInscl: 'WEL',
      department: 'OP',
      hcode: '11152',
      type: 'บริการผู้ป่วยนอก',
      serialNo: '1',
      collected: 100,
      compensated: 100,
      noCompensated: 0,
      payMore: 0,
      recall: 0,
      status: 'ชดเชย',
      note: null,
      stmid: null,
      codeAccount: null,
      equipCode: null,
      equipName: null,
      hsub: null,
      hsend: null,
      payNo: null,
      payDate: null,
      yymm: '6901',
      yearBudget: '2569',
      yymmPay: null,
      yearBudgetPay: null,
      fileName: 'REP_test.xlsx',
    }))

  it('splits large batches into 250-row chunks and attaches extras only to the final chunk', async () => {
    const rows = buildSampleRows(520) // 250 + 250 + 20 = 3 chunks
    vi.mocked(apiGateway.clinical.importSeamlessRecords).mockImplementation(async (chunk) => ({
      success: true,
      totalSubmitted: chunk.length,
      insertedCount: chunk.length,
      updatedCount: 0,
      skippedCount: 0,
      duplicateCount: 0,
    }))

    const denyCodes = [{ code: 'E01', name: 'ข้อมูลไม่ครบ' }]
    const res = await RcmSeamlessImportService.persistSeamlessRows(rows, 'update', { denyCodes })

    expect(res.insertedCount).toBe(520)
    expect(apiGateway.clinical.importSeamlessRecords).toHaveBeenCalledTimes(3)
    expect(vi.mocked(apiGateway.clinical.importSeamlessRecords).mock.calls[0][0]).toHaveLength(250)
    expect(vi.mocked(apiGateway.clinical.importSeamlessRecords).mock.calls[0][2]).toBeUndefined()
    expect(vi.mocked(apiGateway.clinical.importSeamlessRecords).mock.calls[1][0]).toHaveLength(250)
    expect(vi.mocked(apiGateway.clinical.importSeamlessRecords).mock.calls[1][2]).toBeUndefined()
    expect(vi.mocked(apiGateway.clinical.importSeamlessRecords).mock.calls[2][0]).toHaveLength(20)
    expect(vi.mocked(apiGateway.clinical.importSeamlessRecords).mock.calls[2][2]).toEqual({
      denyCodes,
    })
  })

  it('retries transient GatewayUnavailableError on a chunk and succeeds without failing the file', async () => {
    const rows = buildSampleRows(10)
    vi.mocked(apiGateway.clinical.importSeamlessRecords)
      .mockRejectedValueOnce(
        new GatewayUnavailableError('Connection to API Gateway failed: fetch failed (UND_ERR_SOCKET)')
      )
      .mockResolvedValueOnce({
        success: true,
        totalSubmitted: 10,
        insertedCount: 10,
        updatedCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
      })

    const res = await RcmSeamlessImportService.persistSeamlessRows(rows, 'update')

    expect(res.insertedCount).toBe(10)
    expect(apiGateway.clinical.importSeamlessRecords).toHaveBeenCalledTimes(2)
  })
})
