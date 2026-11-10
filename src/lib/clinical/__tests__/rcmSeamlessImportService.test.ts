import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import {
  RcmSeamlessImportService,
  resolveFundFromRep,
  calculateYYMM,
  calculateYearBudget,
  normalizeDate,
  parseNumber,
  cleanCellString,
  SEAMLESS_FUND_MAP,
} from '../rcmSeamlessImportService'

// Mock queryClinicalDb
vi.mock('@/lib/clinicalDb', () => ({
  queryClinicalDb: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { queryClinicalDb } from '@/lib/clinicalDb'

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
  })
})

describe('RcmSeamlessImportService.getSeamlessDatabaseStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
