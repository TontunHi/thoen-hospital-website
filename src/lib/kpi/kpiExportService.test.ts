import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { KpiExportService } from './kpiExportService'

describe('KpiExportService', () => {
  it('generates an official Excel report with metadata, summary, and styled rows', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM kpi_topics WHERE id = ?')) {
        return [{
          id: 3,
          fiscalYear: '2570',
          code: 'THIP-70',
          title: 'ชุดตัวชี้วัด THIP ประจำปี 2570',
          description: 'ตัวชี้วัดคุณภาพโรงพยาบาล',
        }]
      }
      if (sql.includes('FROM kpi_indicators i')) {
        return [
          {
            id: 1,
            topicId: 3,
            sequence: '1',
            category: 'หมวดที่ 1',
            subcategory: 'การดูแลผู้ป่วย',
            code: 'IPD-01',
            oldCode: 'OLD-1',
            frequency: 'ราย 6 เดือน',
            title: 'อัตราการติดเชื้อในโรงพยาบาล',
            numeratorName: 'จำนวนผู้ติดเชื้อ',
            denominatorName: 'จำนวนวันนอนรวม',
            targetRaw: '<= 1.5%',
            targetOperator: '<=',
            targetValue: '1.5000',
            targetUnit: '%',
            responsibleName: 'นิศานาถ',
            indicatorType: 'HA',
            displayOrder: 1,
            entryId: 101,
            entryPeriodKey: 'H1',
            entryPeriodLabel: 'รอบ 6 เดือนแรก',
            entryNumeratorValue: '12',
            entryDenominatorValue: '1000',
            entryResultValue: '1.20',
            entryResultText: null,
            entryStatus: 'PASS',
            entryNote: null,
            entryRecordedById: 5,
            entryRecordedByName: 'นิศานาถ ทิพย์มณฑา',
            entryRecordedAt: '2026-10-15 10:00:00',
            entryUpdatedAt: '2026-10-15 10:00:00',
          },
          {
            id: 2,
            topicId: 3,
            sequence: '2',
            category: 'หมวดที่ 2',
            subcategory: 'ความปลอดภัย',
            code: 'SAF-01',
            oldCode: null,
            frequency: 'ราย 6 เดือน',
            title: 'อัตราการเกิดแผลกดทับระดับ 3 ขึ้นไป',
            numeratorName: null,
            denominatorName: null,
            targetRaw: '= 0',
            targetOperator: '=',
            targetValue: '0.0000',
            targetUnit: 'ครั้ง',
            responsibleName: 'วรัญญา',
            indicatorType: 'HA',
            displayOrder: 2,
            entryId: 102,
            entryPeriodKey: 'H1',
            entryPeriodLabel: 'รอบ 6 เดือนแรก',
            entryNumeratorValue: null,
            entryDenominatorValue: null,
            entryResultValue: '2.00',
            entryResultText: null,
            entryStatus: 'FAIL',
            entryNote: null,
            entryRecordedById: 8,
            entryRecordedByName: 'วรัญญา ชูจิต',
            entryRecordedAt: '2026-10-14 09:30:00',
            entryUpdatedAt: '2026-10-14 09:30:00',
          },
          {
            id: 3,
            topicId: 3,
            sequence: '3',
            category: 'หมวดที่ 3',
            subcategory: 'การประเมิน',
            code: 'EV-01',
            oldCode: null,
            frequency: 'รายปี',
            title: 'ผลสำรวจความพึงพอใจ',
            numeratorName: null,
            denominatorName: null,
            targetRaw: 'รอเป้าหมาย',
            targetOperator: null,
            targetValue: null,
            targetUnit: null,
            responsibleName: 'กนกวรรณ',
            indicatorType: 'HA',
            displayOrder: 3,
            entryId: null, // pending
          },
        ]
      }
      return []
    })

    const result = await KpiExportService.exportToExcel(
      {
        topicId: 3,
        fiscalYear: '2570',
      },
      mockExecutor
    )

    expect(result).toBeDefined()
    expect(result.filename).toBe('KPI_Report_2570_THIP-70.xlsx')
    expect(result.totalCount).toBe(3)
    expect(result.passCount).toBe(1)
    expect(result.failCount).toBe(1)
    expect(Buffer.isBuffer(result.buffer)).toBe(true)
    expect(result.buffer.length).toBeGreaterThan(1000)

    // Inspect generated Excel workbook structure using ExcelJS
    const readWorkbook = new ExcelJS.Workbook()
    await readWorkbook.xlsx.load(result.buffer as any)

    const sheet = readWorkbook.getWorksheet('รายงานตัวชี้วัด')
    expect(sheet).toBeDefined()

    // Title banner
    expect(sheet?.getCell('A1').value).toContain('โรงพยาบาลเถิน')
    // Topic row
    expect(sheet?.getCell('A2').value).toContain('THIP-70')
    // Summary row
    expect(sheet?.getCell('A4').value).toContain('ตัวชี้วัดทั้งหมด 3 รายการ')
    expect(sheet?.getCell('A4').value).toContain('ผ่านเกณฑ์: 1')
    expect(sheet?.getCell('A4').value).toContain('ไม่ผ่านเกณฑ์: 1')

    // Table Header
    expect(sheet?.getCell('A6').value).toBe('ลำดับ')
    expect(sheet?.getCell('G6').value).toBe('ชื่อตัวชี้วัด / คำถามหลัก')
    expect(sheet?.getCell('H6').value).toBe('คำถามตัวตั้ง (Numerator Definition)')
    expect(sheet?.getCell('I6').value).toBe('คำถามตัวหาร (Denominator Definition)')
    expect(sheet?.getCell('L6').value).toBe('คำตอบตัวตั้ง (ค่าตัวเลข)')
    expect(sheet?.getCell('M6').value).toBe('คำตอบตัวหาร (ค่าตัวเลข)')
    expect(sheet?.getCell('N6').value).toBe('ผลงานที่ได้')
    expect(sheet?.getCell('O6').value).toBe('สถานะประเมินผล')

    // Data Row 1 (Pass)
    expect(sheet?.getCell('A7').value).toBe('1')
    expect(sheet?.getCell('D7').value).toBe('IPD-01')
    expect(sheet?.getCell('H7').value).toBe('จำนวนผู้ติดเชื้อ')
    expect(sheet?.getCell('I7').value).toBe('จำนวนวันนอนรวม')
    expect(sheet?.getCell('L7').value).toBe(12)
    expect(sheet?.getCell('M7').value).toBe(1000)
    expect(sheet?.getCell('O7').value).toBe('ผ่านเกณฑ์')

    // Data Row 2 (Fail)
    expect(sheet?.getCell('A8').value).toBe('2')
    expect(sheet?.getCell('D8').value).toBe('SAF-01')
    expect(sheet?.getCell('H8').value).toBe('-')
    expect(sheet?.getCell('L8').value).toBe('-')
    expect(sheet?.getCell('O8').value).toBe('ไม่ผ่านเกณฑ์')

    // Data Row 3 (Pending)
    expect(sheet?.getCell('A9').value).toBe('3')
    expect(sheet?.getCell('O9').value).toBe('ยังไม่บันทึกผล')
  })

  it('filters by onlyDue when onlyDue is true', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql) => {
      if (sql.includes('FROM kpi_topics WHERE id = ?')) {
        return [{ id: 3, fiscalYear: '2570', code: 'THIP-70', title: 'ตัวชี้วัด 2570' }]
      }
      if (sql.includes('FROM kpi_indicators i')) {
        return [
          {
            id: 1,
            frequency: 'รายเดือน',
            title: 'ตัวชี้วัดรายเดือน',
            category: 'หมวดที่ 1',
            displayOrder: 1,
          },
          {
            id: 2,
            frequency: 'รายปี',
            title: 'ตัวชี้วัดรายปี',
            category: 'หมวดที่ 1',
            displayOrder: 2,
          },
        ]
      }
      return []
    })

    const currentDate = new Date('2026-11-02T10:00:00Z')
    const result = await KpiExportService.exportToExcel({
      topicId: 3,
      fiscalYear: '2570',
      onlyDue: true,
      currentDate,
    }, mockExecutor)

    expect(result.totalCount).toBe(1)
    expect(result.filename).toContain('KPI_Report_Due_2570_THIP-70.xlsx')
  })

  it('excludes indicators that are already answered in the due round when onlyDue is true', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql) => {
      if (sql.includes('FROM kpi_topics WHERE id = ?')) {
        return [{ id: 3, fiscalYear: '2570', code: 'THIP-70', title: 'ตัวชี้วัด 2570' }]
      }
      if (sql.includes('FROM kpi_indicators i')) {
        return [
          {
            id: 1,
            frequency: 'รายเดือน',
            title: 'ตัวชี้วัดรายเดือน ตอบแล้วในรอบ ต.ค. (M01)',
            category: 'หมวดที่ 1',
            displayOrder: 1,
            entryId: 101,
            entryPeriodKey: 'M01',
            entryStatus: 'PASS',
            entryResultValue: '90.00',
          },
          {
            id: 2,
            frequency: 'รายเดือน',
            title: 'ตัวชี้วัดรายเดือน ยังไม่ได้ตอบรอบ ต.ค. (M01)',
            category: 'หมวดที่ 1',
            displayOrder: 2,
          },
        ]
      }
      return []
    })

    // In Nov 2026, M01 is due
    const currentDate = new Date('2026-11-02T10:00:00Z')
    const result = await KpiExportService.exportToExcel({
      topicId: 3,
      fiscalYear: '2570',
      onlyDue: true,
      currentDate,
    }, mockExecutor)

    // Indicator 1 is already answered in M01, so only Indicator 2 should be in the export
    expect(result.totalCount).toBe(1)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(result.buffer as any)
    const sheet = wb.getWorksheet('รายงานตัวชี้วัด')
    expect(result.totalCount).toBe(1)
    expect(sheet?.getCell('G7').value).toBe('ตัวชี้วัดรายเดือน ยังไม่ได้ตอบรอบ ต.ค. (M01)')
  })

  it('preserves answered entries and attaches round history when category is selected', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM kpi_topics WHERE id = ?')) {
        return [{ id: 5, fiscalYear: '2570', code: 'HA-70', title: 'ตัวชี้วัด HA' }]
      }
      if (sql.includes('FROM kpi_indicators i')) {
        return [
          {
            id: 21,
            sequence: '1',
            category: 'หมวดที่ 1',
            subcategory: 'การประเมิน',
            code: 'IPD-01',
            frequency: 'รายไตรมาส',
            title: 'อัตราความพึงพอใจผู้ป่วยใน',
            numeratorName: 'จำนวนผู้พึงพอใจ',
            denominatorName: 'จำนวนผู้ตอบทั้งหมด',
            targetRaw: '>= 85%',
            targetOperator: '>=',
            targetValue: '85.0000',
            targetUnit: '%',
            responsibleName: 'นิศานาถ',
            indicatorType: 'HA',
            displayOrder: 1,
            entryId: 301,
            entryPeriodKey: 'Q1',
            entryPeriodLabel: 'ไตรมาสที่ 1',
            entryNumeratorValue: '90',
            entryDenominatorValue: '100',
            entryResultValue: '90.00',
            entryStatus: 'PASS',
            entryRecordedByName: 'นิศานาถ',
            entryRecordedAt: '2026-11-01',
          }
        ]
      }
      return []
    })

    const result = await KpiExportService.exportToExcel({
      topicId: 5,
      fiscalYear: '2570',
      category: 'หมวดที่ 1',
    }, mockExecutor)

    expect(result.totalCount).toBe(1)
    expect(result.passCount).toBe(1)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(result.buffer as any)
    const sheet = wb.getWorksheet('หมวดที่ 1')
    expect(sheet).toBeDefined()

    // Row 7 (first indicator):
    // Col 8 (Numerator question definition):
    expect(sheet?.getCell('H7').value).toBe('จำนวนผู้พึงพอใจ')
    // Col 9 (Denominator question definition):
    expect(sheet?.getCell('I7').value).toBe('จำนวนผู้ตอบทั้งหมด')
    // Col 11 (Reported period):
    expect(sheet?.getCell('K7').value).toBe('ไตรมาสที่ 1')
    // Col 12 (Numerator value number):
    expect(sheet?.getCell('L7').value).toBe(90)
    // Col 13 (Denominator value number):
    expect(sheet?.getCell('M7').value).toBe(100)
    // Col 14 (Result display):
    expect(sheet?.getCell('N7').value).toBe('90%')
    // Col 15 (Status):
    expect(sheet?.getCell('O7').value).toBe('ผ่านเกณฑ์')
    // Col 16 (Round history): contains round breakdown
    expect(sheet?.getCell('P7').value).toContain('ไตรมาสที่ 1')
    expect(sheet?.getCell('P7').value).toContain('ตัวตั้ง = 90')
    expect(sheet?.getCell('P7').value).toContain('ตัวหาร = 100')
    expect(sheet?.getCell('P7').value).toContain('ผลงาน = 90%')
  })
})
