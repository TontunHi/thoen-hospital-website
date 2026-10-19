import ExcelJS from 'exceljs'
import { queryMemberDb } from '@/lib/memberDb'
import { KpiService, KpiIndicatorItem, QueryExecutor } from './kpiService'

export interface KpiExportOptions {
  topicId: number
  fiscalYear: string
  periodKey?: string
  category?: string
}

export interface KpiExportResult {
  buffer: Buffer
  filename: string
  topicTitle: string
  totalCount: number
  passCount: number
  failCount: number
}

function formatThaiDateFull(date: Date): string {
  try {
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    }) + ' น.'
  } catch {
    return date.toISOString()
  }
}

function formatThaiDateShort(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch {
    return '-'
  }
}

function renderWorksheetData(
  worksheet: ExcelJS.Worksheet,
  indicators: KpiIndicatorItem[],
  topic: { title: string; code: string },
  fiscalYear: string,
  sectionTitle?: string
) {
  // Setup Columns definitions & widths (15 comprehensive columns)
  worksheet.columns = [
    { key: 'seq', width: 9 },         // Col 1: ลำดับ
    { key: 'category', width: 32 },    // Col 2: หมวดหมู่
    { key: 'subcategory', width: 26 }, // Col 3: หมวดหมู่ย่อย
    { key: 'code', width: 14 },        // Col 4: รหัสตัวชี้วัด
    { key: 'oldCode', width: 12 },     // Col 5: รหัสเดิม
    { key: 'frequency', width: 15 },   // Col 6: ความถี่
    { key: 'title', width: 50 },       // Col 7: ชื่อตัวชี้วัด / คำถามหลัก
    { key: 'target', width: 16 },      // Col 8: เกณฑ์เป้าหมาย
    { key: 'result', width: 14 },      // Col 9: ผลการดำเนินงาน (%)
    { key: 'numerator', width: 30 },   // Col 10: ตัวตั้ง (คำถาม / ข้อมูล)
    { key: 'denominator', width: 30 }, // Col 11: ตัวหาร (คำถาม / ข้อมูล)
    { key: 'status', width: 18 },      // Col 12: สถานะประเมินผล
    { key: 'responsible', width: 26 }, // Col 13: ผู้รับผิดชอบ
    { key: 'recorder', width: 30 },    // Col 14: ผู้บันทึก / วันที่บันทึก
    { key: 'type', width: 18 },        // Col 15: ประเภทตัวชี้วัด (HA / ยุทธศาสตร์)
  ]

  const totalCount = indicators.length
  let recordedCount = 0
  let passCount = 0
  let failCount = 0
  let waitingCount = 0

  indicators.forEach(ind => {
    const status = ind.currentEntry?.status
    if (status && status !== 'PENDING') {
      recordedCount++
      if (status === 'PASS') passCount++
      else if (status === 'FAIL') failCount++
      else if (status === 'WAITING_TARGET') waitingCount++
    }
  })

  const recordedPct = totalCount > 0 ? ((recordedCount / totalCount) * 100).toFixed(1) : '0.0'
  const passPct = recordedCount > 0 ? ((passCount / recordedCount) * 100).toFixed(1) : '0.0'
  const failPct = recordedCount > 0 ? ((failCount / recordedCount) * 100).toFixed(1) : '0.0'

  // Row 1: Hospital Name Title Banner (Merged A1:O1)
  worksheet.mergeCells('A1:O1')
  const row1 = worksheet.getCell('A1')
  row1.value = 'โรงพยาบาลเถิน จังหวัดลำปาง (Thoen Hospital, Lampang)'
  row1.font = { name: 'Sarabun', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } } // Teal 700
  row1.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 36

  // Row 2: Topic Title & Code Banner (Merged A2:O2)
  worksheet.mergeCells('A2:O2')
  const row2 = worksheet.getCell('A2')
  row2.value = `รายงานผลการดำเนินงานตามตัวชี้วัด: ${topic.title} (${topic.code})${sectionTitle ? ` — ${sectionTitle}` : ''}`
  row2.font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FF0F172A' } }
  row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } } // Teal 50
  row2.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 28

  // Row 3: Metadata Info (Merged A3:O3)
  worksheet.mergeCells('A3:O3')
  const row3 = worksheet.getCell('A3')
  row3.value = `ปีงบประมาณ: พ.ศ. ${fiscalYear}  |  ข้อมูล ณ วันที่ส่งออกรายงาน: ${formatThaiDateFull(new Date())}`
  row3.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF475569' } }
  row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  row3.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(3).height = 22

  // Row 4: Summary Statistics Bar (Merged A4:O4)
  worksheet.mergeCells('A4:O4')
  const row4 = worksheet.getCell('A4')
  row4.value = `📊 สรุปผลภาพรวม: ตัวชี้วัดทั้งหมด ${totalCount} รายการ  |  บันทึกผลแล้ว ${recordedCount} (${recordedPct}%)  |  ผ่านเกณฑ์: ${passCount} (${passPct}%)  |  ไม่ผ่านเกณฑ์: ${failCount} (${failPct}%)  |  รอผลประเมิน: ${waitingCount}`
  row4.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: 'FF134E4A' } }
  row4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } } // Teal 100
  row4.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(4).height = 26

  // Row 5: Empty Spacer Row
  worksheet.getRow(5).height = 8

  // Row 6: Table Header Columns
  const headerRow = worksheet.getRow(6)
  headerRow.height = 32
  headerRow.values = [
    'ลำดับ',
    'หมวดหมู่',
    'หมวดหมู่ย่อย',
    'รหัสตัวชี้วัด',
    'รหัสเดิม',
    'ความถี่',
    'ชื่อตัวชี้วัด / คำถามหลัก',
    'เกณฑ์เป้าหมาย',
    'ผลงาน (%)',
    'ตัวตั้ง (Numerator)',
    'ตัวหาร (Denominator)',
    'สถานะประเมินผล',
    'ผู้รับผิดชอบ',
    'ผู้บันทึก / วันที่บันทึก',
    'ประเภทตัวชี้วัด',
  ]

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } } // Teal 600
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F766E' } },
      left: { style: 'thin', color: { argb: 'FF0F766E' } },
      bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
      right: { style: 'thin', color: { argb: 'FF0F766E' } },
    }
  })

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  }

  indicators.forEach((ind, index) => {
    const entry = ind.currentEntry
    const rowNumber = 7 + index
    const dataRow = worksheet.getRow(rowNumber)
    dataRow.height = 28

    const targetText = ind.targetRaw || (
      ind.targetOperator && ind.targetValue !== null && ind.targetValue !== undefined
        ? `${ind.targetOperator} ${ind.targetValue}${ind.targetUnit || ''}`
        : '-'
    )

    let resultDisplay: string | number = '-'
    if (entry?.resultValue !== null && entry?.resultValue !== undefined) {
      resultDisplay = entry.resultValue
    } else if (entry?.resultText) {
      resultDisplay = entry.resultText
    }

    // Complete Numerator Info: Definition + Recorded Value
    let numeratorDisplay = '-'
    if (ind.numeratorName && entry?.numeratorValue !== null && entry?.numeratorValue !== undefined) {
      numeratorDisplay = `${ind.numeratorName} [รายงาน: ${entry.numeratorValue}]`
    } else if (ind.numeratorName) {
      numeratorDisplay = ind.numeratorName
    } else if (entry?.numeratorValue !== null && entry?.numeratorValue !== undefined) {
      numeratorDisplay = String(entry.numeratorValue)
    }

    // Complete Denominator Info: Definition + Recorded Value
    let denominatorDisplay = '-'
    if (ind.denominatorName && entry?.denominatorValue !== null && entry?.denominatorValue !== undefined) {
      denominatorDisplay = `${ind.denominatorName} [รายงาน: ${entry.denominatorValue}]`
    } else if (ind.denominatorName) {
      denominatorDisplay = ind.denominatorName
    } else if (entry?.denominatorValue !== null && entry?.denominatorValue !== undefined) {
      denominatorDisplay = String(entry.denominatorValue)
    }

    let statusLabel = 'ยังไม่บันทึกผล'
    let statusBg = 'FFF1F5F9' // Slate 100
    let statusTextColor = 'FF64748B' // Slate 500

    if (entry?.status === 'PASS') {
      statusLabel = 'ผ่านเกณฑ์'
      statusBg = 'FFDCFCE7' // Green 100
      statusTextColor = 'FF15803D' // Green 700
    } else if (entry?.status === 'FAIL') {
      statusLabel = 'ไม่ผ่านเกณฑ์'
      statusBg = 'FFFEE2E2' // Red 100
      statusTextColor = 'FFB91C1C' // Red 700
    } else if (entry?.status === 'WAITING_TARGET') {
      statusLabel = 'รอผลประเมิน'
      statusBg = 'FFFEF3C7' // Amber 100
      statusTextColor = 'FFB45309' // Amber 700
    }

    let recordedInfo = '-'
    if (entry?.recordedByName) {
      recordedInfo = entry.recordedByName
      if (entry.recordedAt) {
        recordedInfo += ` (${formatThaiDateShort(entry.recordedAt)})`
      }
    }

    dataRow.values = [
      ind.sequence || (index + 1),
      ind.category || '-',
      ind.subcategory || '-',
      ind.code || '-',
      ind.oldCode || '-',
      ind.frequency || '-',
      ind.title,
      targetText,
      resultDisplay,
      numeratorDisplay,
      denominatorDisplay,
      statusLabel,
      ind.responsibleName || '-',
      recordedInfo,
      ind.indicatorType || '-',
    ]

    const isEvenRow = index % 2 === 1
    const defaultRowBg = isEvenRow ? 'FFF8FAFC' : 'FFFFFFFF'

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 9.5, color: { argb: 'FF1E293B' } }
      cell.border = thinBorder
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultRowBg } }

      // Alignments per column
      if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 8 || colNumber === 15) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (colNumber === 9) {
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '#,##0.00'
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      } else if (colNumber === 12) {
        // Status column styling
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } }
        cell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: statusTextColor } }
      } else {
        // Text columns: Category, Title, Numerator, Denominator, Responsible, Recorder
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      }
    })
  })
}

export class KpiExportService {
  /**
   * Generate an official formatted Excel workbook (.xlsx) for a KPI topic
   */
  static async exportToExcel(
    options: KpiExportOptions,
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiExportResult> {
    const { topicId, fiscalYear, periodKey, category } = options

    // 1. Fetch Topic Info
    const topicRows = await executor(
      'SELECT id, fiscal_year AS fiscalYear, code, title, description FROM kpi_topics WHERE id = ?',
      [topicId]
    )
    const topic = topicRows[0] || {
      id: topicId,
      fiscalYear,
      code: 'THIP',
      title: 'ตัวชี้วัดโรงพยาบาลเถิน',
    }

    // 2. Fetch all indicators with latest entry for the topic and fiscal year
    const indicators: KpiIndicatorItem[] = await KpiService.getIndicators(
      {
        topicId,
        fiscalYear,
        category: (category && category !== 'ALL') ? category : undefined,
        periodKey: periodKey === 'ALL' ? undefined : periodKey,
      },
      executor
    )

    // 3. Calculate summary statistics
    const totalCount = indicators.length
    let passCount = 0
    let failCount = 0

    indicators.forEach(ind => {
      const status = ind.currentEntry?.status
      if (status === 'PASS') passCount++
      else if (status === 'FAIL') failCount++
    })

    // 4. Create ExcelJS Workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Thoen Hospital Information System'
    workbook.lastModifiedBy = 'Thoen Hospital'
    workbook.created = new Date()
    workbook.modified = new Date()

    if (category && category !== 'ALL') {
      // Specific Category Export
      const cleanName = category.replace(/[\\/*?:[\]]/g, '_').substring(0, 31)
      const ws = workbook.addWorksheet(cleanName, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }],
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      })
      renderWorksheetData(ws, indicators, topic, fiscalYear, category)
    } else {
      // Complete Export with Primary Sheet + Strategy & HA Breakdown
      const wsAll = workbook.addWorksheet('รายงานตัวชี้วัด', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }],
        pageSetup: {
          paperSize: 9,
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      })
      renderWorksheetData(wsAll, indicators, topic, fiscalYear, 'ตัวชี้วัดทั้งหมด')

      // Secondary Sheet: กลุ่มยุทธศาสตร์ (133 ข้อ)
      const strategyIndicators = indicators.filter(i => 
        i.category.includes('ยุทธศาสตร์') || (i.indicatorType && i.indicatorType.includes('ยุทธศาสตร์'))
      )
      if (strategyIndicators.length > 0) {
        const wsStrat = workbook.addWorksheet('กลุ่มยุทธศาสตร์', {
          views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }],
          pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
          },
        })
        renderWorksheetData(wsStrat, strategyIndicators, topic, fiscalYear, 'กลุ่มยุทธศาสตร์โรงพยาบาล')
      }

      // Tertiary Sheet: กลุ่มหมวดหมู่คุณภาพ HA (165 ข้อ)
      const haIndicators = indicators.filter(i => 
        i.category.includes('หมวดที่') || (i.indicatorType && i.indicatorType.includes('HA'))
      )
      if (haIndicators.length > 0) {
        const wsHa = workbook.addWorksheet('กลุ่มหมวดหมู่ HA', {
          views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }],
          pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
          },
        })
        renderWorksheetData(wsHa, haIndicators, topic, fiscalYear, 'กลุ่มหมวดหมู่มาตรฐาน HA (IV 1-6)')
      }
    }

    // 5. Generate Buffer
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const sanitizedTopicCode = topic.code.replace(/[^a-zA-Z0-9_-]/g, '_')
    let filename = `KPI_Report_${fiscalYear}_${sanitizedTopicCode}.xlsx`
    if (category && category !== 'ALL') {
      const catClean = category.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_').substring(0, 25)
      filename = `KPI_Report_${fiscalYear}_${catClean}.xlsx`
    }

    return {
      buffer,
      filename,
      topicTitle: topic.title,
      totalCount,
      passCount,
      failCount,
    }
  }
}
