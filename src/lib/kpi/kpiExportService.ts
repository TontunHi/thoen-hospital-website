import ExcelJS from 'exceljs'
import { queryMemberDb } from '@/lib/memberDb'
import { KpiService, KpiIndicatorItem, QueryExecutor, cleanPeriodLabel } from './kpiService'
import { checkIndicatorDueStatus, isIndicatorAnsweredForPeriod, getPeriodsForFrequency, matchesPeriodKey } from './kpiTimeUtils'

export interface KpiExportOptions {
  topicId: number
  fiscalYear: string
  periodKey?: string
  category?: string
  onlyDue?: boolean
  currentDate?: Date
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
  // Setup Columns definitions & widths (19 comprehensive, crystal-clear columns)
  worksheet.columns = [
    { key: 'seq', width: 8 },             // Col 1 (A): ลำดับ
    { key: 'category', width: 28 },        // Col 2 (B): หมวดหมู่
    { key: 'subcategory', width: 24 },     // Col 3 (C): หมวดหมู่ย่อย
    { key: 'code', width: 14 },            // Col 4 (D): รหัสตัวชี้วัด
    { key: 'oldCode', width: 12 },         // Col 5 (E): รหัสเดิม
    { key: 'frequency', width: 14 },       // Col 6 (F): ความถี่
    { key: 'title', width: 44 },           // Col 7 (G): ชื่อตัวชี้วัด / คำถามหลัก
    { key: 'numeratorName', width: 32 },   // Col 8 (H): คำถามตัวตั้ง (Numerator Definition)
    { key: 'denominatorName', width: 32 }, // Col 9 (I): คำถามตัวหาร (Denominator Definition)
    { key: 'target', width: 16 },          // Col 10 (J): เกณฑ์เป้าหมาย
    { key: 'period', width: 20 },          // Col 11 (K): รอบที่รายงาน
    { key: 'numeratorVal', width: 18 },    // Col 12 (L): คำตอบตัวตั้ง (ค่าตัวเลข)
    { key: 'denominatorVal', width: 18 },  // Col 13 (M): คำตอบตัวหาร (ค่าตัวเลข)
    { key: 'result', width: 18 },          // Col 14 (N): ผลงานที่ได้
    { key: 'status', width: 16 },          // Col 15 (O): สถานะประเมินผล
    { key: 'roundHistory', width: 68 },    // Col 16 (P): ประวัติคำตอบทุกรอบ (ตัวตั้ง / ตัวหาร / ผลงาน / สถานะ)
    { key: 'responsible', width: 24 },     // Col 17 (Q): ผู้รับผิดชอบ
    { key: 'recorder', width: 28 },        // Col 18 (R): ผู้บันทึก / วันที่บันทึก
    { key: 'type', width: 16 },            // Col 19 (S): ประเภทตัวชี้วัด
  ]

  const totalCount = indicators.length
  let recordedCount = 0
  let passCount = 0
  let failCount = 0
  let waitingCount = 0

  indicators.forEach(ind => {
    const answered = (ind.entries || []).filter(e =>
      (e.resultValue !== null && e.resultValue !== undefined) ||
      (e.resultText && e.resultText.trim() !== '' && e.resultText !== 'ไม่มีรายงาน') ||
      (e.numeratorValue !== null && e.denominatorValue !== null && e.numeratorValue !== undefined && e.denominatorValue !== undefined)
    )
    const latestEntry = answered.length > 0 ? answered[answered.length - 1] : null
    const entry = ind.currentEntry || latestEntry

    const status = entry?.status
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

  // Row 1: Hospital Name Title Banner (Merged A1:S1)
  worksheet.mergeCells('A1:S1')
  const row1 = worksheet.getCell('A1')
  row1.value = 'โรงพยาบาลเถิน จังหวัดลำปาง (Thoen Hospital, Lampang)'
  row1.font = { name: 'Sarabun', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } } // Teal 700
  row1.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 36

  // Row 2: Topic Title & Code Banner (Merged A2:S2)
  worksheet.mergeCells('A2:S2')
  const row2 = worksheet.getCell('A2')
  row2.value = `รายงานผลการดำเนินงานตามตัวชี้วัด: ${topic.title} (${topic.code})${sectionTitle ? ` — ${sectionTitle}` : ''}`
  row2.font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FF0F172A' } }
  row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } } // Teal 50
  row2.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 28

  // Row 3: Metadata Info (Merged A3:S3)
  worksheet.mergeCells('A3:S3')
  const row3 = worksheet.getCell('A3')
  row3.value = `ปีงบประมาณ: พ.ศ. ${fiscalYear}  |  ข้อมูล ณ วันที่ส่งออกรายงาน: ${formatThaiDateFull(new Date())}`
  row3.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF475569' } }
  row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  row3.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(3).height = 22

  // Row 4: Summary Statistics Bar (Merged A4:S4)
  worksheet.mergeCells('A4:S4')
  const row4 = worksheet.getCell('A4')
  row4.value = `📊 สรุปผลภาพรวม: ตัวชี้วัดทั้งหมด ${totalCount} รายการ  |  บันทึกผลแล้ว ${recordedCount} (${recordedPct}%)  |  ผ่านเกณฑ์: ${passCount} (${passPct}%)  |  ไม่ผ่านเกณฑ์: ${failCount} (${failPct}%)  |  รอผลประเมิน: ${waitingCount}`
  row4.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: 'FF134E4A' } }
  row4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } } // Teal 100
  row4.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(4).height = 26

  // Row 5: Empty Spacer Row
  worksheet.getRow(5).height = 8

  // Row 6: Table Header Columns (19 columns)
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
    'คำถามตัวตั้ง (Numerator Definition)',
    'คำถามตัวหาร (Denominator Definition)',
    'เกณฑ์เป้าหมาย',
    'รอบที่รายงาน',
    'คำตอบตัวตั้ง (ค่าตัวเลข)',
    'คำตอบตัวหาร (ค่าตัวเลข)',
    'ผลงานที่ได้',
    'สถานะประเมินผล',
    'ประวัติคำตอบทุกรอบ (ตัวตั้ง / ตัวหาร / ผลงาน / สถานะ)',
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
    // Find entry: prefer currentEntry, or fall back to the most recent answered entry
    const answered = (ind.entries || []).filter(e =>
      (e.resultValue !== null && e.resultValue !== undefined) ||
      (e.resultText && e.resultText.trim() !== '' && e.resultText !== 'ไม่มีรายงาน') ||
      (e.numeratorValue !== null && e.denominatorValue !== null && e.numeratorValue !== undefined && e.denominatorValue !== undefined)
    )
    const latestEntry = answered.length > 0 ? answered[answered.length - 1] : null
    const entry = ind.currentEntry || latestEntry

    const rowNumber = 7 + index
    const dataRow = worksheet.getRow(rowNumber)

    const targetText = ind.targetRaw || (
      ind.targetOperator && ind.targetValue !== null && ind.targetValue !== undefined
        ? `${ind.targetOperator} ${ind.targetValue}${ind.targetUnit || ''}`
        : '-'
    )

    // Col 8 & 9: Clean question definitions (only definition text)
    const numeratorQuestionText = ind.numeratorName || '-'
    const denominatorQuestionText = ind.denominatorName || '-'

    // Col 11: Reported Period Name
    const periodLabelText = entry?.periodLabel || (entry?.periodKey ? cleanPeriodLabel(entry.periodLabel, entry.periodKey, ind.frequency) : '-')

    // Col 12 & 13: Clean numeric answers
    const numeratorValDisplay = entry?.numeratorValue !== null && entry?.numeratorValue !== undefined
      ? entry.numeratorValue
      : '-'

    const denominatorValDisplay = entry?.denominatorValue !== null && entry?.denominatorValue !== undefined
      ? entry.denominatorValue
      : '-'

    // Col 14: Result Display (Clean formatted value)
    let resultDisplay: string | number = '-'
    const hasNumDen = Boolean(
      (ind.numeratorName || ind.denominatorName) &&
      entry?.numeratorValue !== null &&
      entry?.denominatorValue !== null &&
      entry?.numeratorValue !== undefined &&
      entry?.denominatorValue !== undefined
    )

    if (entry && hasNumDen) {
      const num = Number(entry.numeratorValue)
      const den = Number(entry.denominatorValue)
      if (num === 0 && den === 0) {
        resultDisplay = '0% (ไม่มีเคส)'
      } else if (entry.resultValue !== null && entry.resultValue !== undefined) {
        resultDisplay = `${entry.resultValue}${ind.targetUnit || '%'}`
      } else if (den > 0) {
        const val = parseFloat(((num / den) * 100).toFixed(2))
        resultDisplay = `${val}${ind.targetUnit || '%'}`
      }
    } else if (entry?.resultValue !== null && entry?.resultValue !== undefined) {
      resultDisplay = `${entry.resultValue}${ind.targetUnit || ''}`
    } else if (entry?.resultText && entry.resultText.trim() !== '' && entry.resultText !== 'ไม่มีรายงาน') {
      resultDisplay = entry.resultText
    }

    // Col 15: Status
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

    // Col 16: Complete rounds history breakdown (Separated by newlines for easy reading)
    const periods = getPeriodsForFrequency(ind.frequency)
    const roundSummaryParts: string[] = []

    periods.forEach(p => {
      const match = (ind.entries || []).find(e => matchesPeriodKey(e.periodKey, p.key))
      if (match) {
        const matchHasNumDen = Boolean(
          (ind.numeratorName || ind.denominatorName) &&
          match.numeratorValue !== null &&
          match.denominatorValue !== null &&
          match.numeratorValue !== undefined &&
          match.denominatorValue !== undefined
        )

        let ansText = ''
        if (match && matchHasNumDen) {
          const num = Number(match.numeratorValue)
          const den = Number(match.denominatorValue)
          const numFmt = num.toLocaleString('en-US')
          const denFmt = den.toLocaleString('en-US')

          if (num === 0 && den === 0) {
            ansText = `ตัวตั้ง = ${numFmt} | ตัวหาร = ${denFmt} | ผลงาน = 0% (ไม่มีเคส)`
          } else {
            const calcVal = match.resultValue !== null && match.resultValue !== undefined
              ? match.resultValue
              : (den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0)
            ansText = `ตัวตั้ง = ${numFmt} | ตัวหาร = ${denFmt} | ผลงาน = ${calcVal}${ind.targetUnit || '%'}`
          }
        } else {
          let valDisplay = '-'
          if (match.resultValue !== null && match.resultValue !== undefined) {
            valDisplay = `${match.resultValue}${ind.targetUnit || ''}`
          } else if (match.resultText && match.resultText.trim() !== '' && match.resultText !== 'ไม่มีรายงาน') {
            valDisplay = match.resultText
          }
          ansText = `ผลงาน = ${valDisplay}`
        }

        const st = match.status === 'PASS'
          ? 'ผ่านเกณฑ์'
          : match.status === 'FAIL'
          ? 'ไม่ผ่านเกณฑ์'
          : match.status === 'WAITING_TARGET'
          ? 'รอผลประเมิน'
          : 'บันทึกแล้ว'

        let recorderMeta = ''
        if (match.recordedByName) {
          recorderMeta = ` [${match.recordedByName}${match.recordedAt ? ` • ${formatThaiDateShort(match.recordedAt)}` : ''}]`
        }

        roundSummaryParts.push(`• [${p.label}]: ${ansText} (${st})${recorderMeta}`)
      } else {
        roundSummaryParts.push(`• [${p.label}]: ยังไม่บันทึกผล`)
      }
    })

    const roundHistoryText = roundSummaryParts.join('\r\n')
    const historyLineCount = Math.max(1, roundSummaryParts.length)
    dataRow.height = Math.max(28, Math.min(130, historyLineCount * 18 + 8))

    let recordedInfo = '-'
    if (entry?.recordedByName) {
      recordedInfo = entry.recordedByName
      if (entry.recordedAt) {
        recordedInfo += ` (${formatThaiDateShort(entry.recordedAt)})`
      }
    }

    dataRow.values = [
      ind.sequence || (index + 1),       // Col 1: ลำดับ
      ind.category || '-',                // Col 2: หมวดหมู่
      ind.subcategory || '-',             // Col 3: หมวดหมู่ย่อย
      ind.code || '-',                    // Col 4: รหัสตัวชี้วัด
      ind.oldCode || '-',                 // Col 5: รหัสเดิม
      ind.frequency || '-',               // Col 6: ความถี่
      ind.title,                          // Col 7: ชื่อตัวชี้วัด / คำถามหลัก
      numeratorQuestionText,              // Col 8: คำถามตัวตั้ง (Definition)
      denominatorQuestionText,            // Col 9: คำถามตัวหาร (Definition)
      targetText,                         // Col 10: เกณฑ์เป้าหมาย
      periodLabelText,                    // Col 11: รอบที่รายงาน
      numeratorValDisplay,                // Col 12: คำตอบตัวตั้ง (Number)
      denominatorValDisplay,              // Col 13: คำตอบตัวหาร (Number)
      resultDisplay,                      // Col 14: ผลงานที่ได้
      statusLabel,                        // Col 15: สถานะประเมินผล
      roundHistoryText,                   // Col 16: ประวัติคำตอบทุกรอบ (แจกแจงทุกรอบ)
      ind.responsibleName || '-',         // Col 17: ผู้รับผิดชอบ
      recordedInfo,                       // Col 18: ผู้บันทึก / วันที่บันทึก
      ind.indicatorType || '-',           // Col 19: ประเภทตัวชี้วัด
    ]

    const isEvenRow = index % 2 === 1
    const defaultRowBg = isEvenRow ? 'FFF8FAFC' : 'FFFFFFFF'

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 9.5, color: { argb: 'FF1E293B' } }
      cell.border = thinBorder
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultRowBg } }

      // Alignments per column
      if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 10 || colNumber === 11 || colNumber === 19) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (colNumber === 12 || colNumber === 13) {
        // Numerator / Denominator answers (Numbers)
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '#,##0.##'
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      } else if (colNumber === 14) {
        // Result display
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FF0F172A' } }
      } else if (colNumber === 15) {
        // Status column styling
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } }
        cell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: statusTextColor } }
      } else if (colNumber === 16) {
        // Round history breakdown with wrapText and newline
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        cell.font = { name: 'Sarabun', size: 9, color: { argb: 'FF334155' } }
      } else {
        // Text columns: Category, Title, Questions, Responsible, Recorder
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
    const { topicId, fiscalYear, periodKey, category, onlyDue, currentDate } = options

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
    let indicators: KpiIndicatorItem[] = await KpiService.getIndicators(
      {
        topicId,
        fiscalYear,
        category: (category && category !== 'ALL') ? category : undefined,
        periodKey: periodKey === 'ALL' ? undefined : periodKey,
      },
      executor
    )

    if (onlyDue) {
      indicators = indicators.filter(ind => {
        const dueStatus = checkIndicatorDueStatus(ind.frequency, fiscalYear, currentDate)
        if (!dueStatus.isDue) return false
        return !isIndicatorAnsweredForPeriod(ind, dueStatus.relevantPeriod.key)
      })
    }

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
      renderWorksheetData(wsAll, indicators, topic, fiscalYear, onlyDue ? 'ตัวชี้วัดที่ถึงเวลา' : 'ตัวชี้วัดทั้งหมด')

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
    if (onlyDue) {
      filename = `KPI_Report_Due_${fiscalYear}_${sanitizedTopicCode}.xlsx`
    } else if (category && category !== 'ALL') {
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
