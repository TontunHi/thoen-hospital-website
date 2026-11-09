import ExcelJS from 'exceljs'

export interface RcmExcelColumn {
  header: string
  key?: string
  width?: number
  numFmt?: string
  alignment?: 'left' | 'center' | 'right'
}

export interface RcmExcelExportOptions {
  filename: string
  sheetName?: string
  title?: string
  subtitle?: string
  headers: (string | RcmExcelColumn)[]
  rows: (string | number | boolean | null | undefined)[][]
  summaryRows?: (string | number | boolean | null | undefined)[][]
}

/**
 * Clean cell value: strip CSV-specific workarounds like `="00123"`, `'=HYPERLINK...`, or extra outer quotes
 */
export function cleanCellValue(val: unknown): string | number | boolean | null {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number' || typeof val === 'boolean') return val

  let str = String(val).trim()

  // Remove Excel CSV formula wrapper: ="12345" -> 12345
  const formulaQuotedMatch = str.match(/^="([^"]*)"$/)
  if (formulaQuotedMatch) {
    return formulaQuotedMatch[1]
  }

  // Remove outer quotes: "Hello" -> Hello
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    str = str.slice(1, -1).replace(/""/g, '"')
  }

  // Remove outer single quotes or leading single quote used in CSV injection defense
  if (str.startsWith("'")) {
    if (str.endsWith("'") && str.length >= 2) {
      str = str.slice(1, -1)
    } else {
      str = str.slice(1)
    }
  }

  return str
}

/**
 * Detect column properties based on header name
 */
export function detectColumnStyle(header: string): {
  alignment: 'left' | 'center' | 'right'
  numFmt?: string
  isTextForce?: boolean
  isNumeric?: boolean
} {
  const h = header.toLowerCase()

  // 0. Checks for counts even if they mention (VN) or (HN) or (ราย), e.g., "จำนวนครั้ง (VN)", "จำนวนคน (HN)"
  if (
    h.includes('จำนวน') ||
    h.includes('ครั้ง') ||
    h.includes('คน') ||
    h.includes('visits') ||
    h.includes('patients') ||
    h.includes('cases')
  ) {
    return { alignment: 'right', numFmt: '#,##0', isNumeric: true }
  }

  // 1. Identification / Codes that MUST be treated strictly as text (never exponential, never drop leading zero)
  if (
    h.includes('cid') ||
    h.includes('บัตรประชาชน') ||
    h.includes('เลขบัตร') ||
    h === 'hn' ||
    h.includes('เลข hn') ||
    h.includes('รหัส hn') ||
    h === 'vn' ||
    h.includes('เลข vn') ||
    h.includes('รหัส vn') ||
    h === 'an' ||
    h.includes('เลข an') ||
    h.includes('รหัส an') ||
    h.includes('icode') ||
    h.includes('claim') ||
    h.includes('authen') ||
    h.includes('rep') ||
    h.includes('invoice') ||
    h.includes('bill') ||
    h.includes('receipt') ||
    h.includes('phone') ||
    h.includes('โทร') ||
    h.includes('รหัสสิทธิ') ||
    h.includes('รหัสแพทย์') ||
    h.includes('รหัส adp') ||
    h.includes('รหัส icode') ||
    h.includes('รหัสโรค') ||
    h.includes('icd')
  ) {
    return { alignment: 'center', numFmt: '@', isTextForce: true }
  }

  // 2. Financial / Currency (Baht)
  if (
    h.includes('บาท') ||
    h.includes('ชดเชย') ||
    h.includes('ค่ารักษา') ||
    h.includes('รายรับ') ||
    h.includes('ส่วนต่ำ') ||
    h.includes('ส่วนสูง') ||
    h.includes('ลูกหนี้') ||
    h.includes('ส่วนลด') ||
    h.includes('ชำระเอง') ||
    h.includes('income') ||
    h.includes('money') ||
    h.includes('compensated') ||
    h.includes('debit') ||
    h.includes('discount') ||
    h.includes('diff') ||
    h.includes('rate') ||
    h.includes('ร้อยละ') ||
    h.includes('%')
  ) {
    return { alignment: 'right', numFmt: '#,##0.00', isNumeric: true }
  }

  // 3. Counts / Quantities (Integers)
  if (
    h.includes('จำนวน') ||
    h.includes('ครั้ง') ||
    h.includes('คน') ||
    h.includes('อายุ') ||
    h.includes('visits') ||
    h.includes('patients') ||
    h.includes('cases') ||
    h.includes('age')
  ) {
    return { alignment: 'right', numFmt: '#,##0', isNumeric: true }
  }

  // 4. Sequence / Row Number
  if (h.includes('ลำดับ') || h === 'no' || h === '#') {
    return { alignment: 'center', numFmt: '#,##0', isNumeric: true }
  }

  // 5. Dates / Times
  if (h.includes('วัน') || h.includes('date') || h.includes('เวลา') || h.includes('time')) {
    return { alignment: 'center', numFmt: '@' }
  }

  // 6. Status / Flags
  if (
    h.includes('สถานะ') ||
    h.includes('status') ||
    h.includes('เพศ') ||
    h.includes('sex') ||
    h.includes('dx') ||
    h.includes('op') ||
    h.includes('z515') ||
    h.includes('z718')
  ) {
    return { alignment: 'center' }
  }

  // Default: Left-aligned general text
  return { alignment: 'left' }
}

/**
 * Core builder to create an ExcelJS Workbook
 */
export async function buildRcmExcelWorkbook(options: RcmExcelExportOptions): Promise<ExcelJS.Workbook> {
  const ExcelJSModule = (await import('exceljs')).default || (await import('exceljs'))
  const workbook = new ExcelJSModule.Workbook()
  workbook.creator = 'Thoen Hospital RCM System'
  workbook.created = new Date()

  const safeSheetName = (options.sheetName || options.title || 'Report')
    .replace(/[\\/*?:[\]]/g, '')
    .substring(0, 31)

  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }],
  })

  let startRowIndex = 1

  // Normalize column definitions
  const columns: RcmExcelColumn[] = options.headers.map((hdr) => {
    if (typeof hdr === 'string') {
      const style = detectColumnStyle(hdr)
      return {
        header: hdr,
        alignment: style.alignment,
        numFmt: style.numFmt,
      }
    }
    const detected = detectColumnStyle(hdr.header)
    return {
      header: hdr.header,
      key: hdr.key,
      width: hdr.width,
      alignment: hdr.alignment || detected.alignment,
      numFmt: hdr.numFmt || detected.numFmt,
    }
  })

  const colCount = Math.max(columns.length, 1)

  // 1. Optional Title Banner
  if (options.title) {
    worksheet.mergeCells(startRowIndex, 1, startRowIndex, colCount)
    const titleCell = worksheet.getCell(startRowIndex, 1)
    titleCell.value = options.title
    titleCell.font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal-700 RCM Brand
    }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(startRowIndex).height = 32
    startRowIndex++

    // Subtitle / Metadata
    const subtitleText =
      options.subtitle ||
      `โรงพยาบาลเถิน (Thoen Hospital) | วันที่ส่งออก: ${new Date().toLocaleDateString('th-TH')}`

    worksheet.mergeCells(startRowIndex, 1, startRowIndex, colCount)
    const subCell = worksheet.getCell(startRowIndex, 1)
    subCell.value = subtitleText
    subCell.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF475569' } }
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    }
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    worksheet.getRow(startRowIndex).height = 22
    startRowIndex++

    // Empty separator row
    worksheet.addRow([])
    startRowIndex++
  }

  const tableHeaderRowIndex = startRowIndex

  // Freeze panes on table header
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: tableHeaderRowIndex,
      showGridLines: true,
    },
  ]

  // 2. Table Headers
  const headerValues = columns.map((c) => c.header)
  const headerRow = worksheet.addRow(headerValues)
  headerRow.height = 26

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate-800 Dark Header
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF64748B' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF64748B' } },
      right: { style: 'thin', color: { argb: 'FF64748B' } },
    }
  })

  // 3. Data Rows
  options.rows.forEach((row, rowIdx) => {
    const isEven = rowIdx % 2 === 0
    const processedCells = row.map((rawVal, colIdx) => {
      const colDef = columns[colIdx] || { header: '' }
      const detected = detectColumnStyle(colDef.header)
      const cleaned = cleanCellValue(rawVal)

      if (cleaned === '' || cleaned === null || cleaned === undefined) {
        return ''
      }

      // If force text (CID, HN, VN, etc.): ensure string
      if (detected.isTextForce) {
        return String(cleaned)
      }

      // If numeric column: ensure number if parseable
      if (detected.isNumeric && typeof cleaned === 'string') {
        const num = Number(cleaned.replace(/,/g, ''))
        if (!isNaN(num) && cleaned.trim() !== '') {
          return num
        }
      }

      return cleaned
    })

    const dataRow = worksheet.addRow(processedCells)
    dataRow.height = 21

    dataRow.eachCell((cell, colNumber) => {
      const colDef = columns[colNumber - 1] || { header: '' }
      const style = detectColumnStyle(colDef.header)

      cell.font = { name: 'Sarabun', size: 10 }
      if (!isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // Slate-50 zebra
        }
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      // Alignment & Formatting
      const alignment = colDef.alignment || style.alignment || 'left'
      cell.alignment = { vertical: 'middle', horizontal: alignment }

      if (colDef.numFmt) {
        cell.numFmt = colDef.numFmt
      } else if (style.numFmt) {
        cell.numFmt = style.numFmt
      } else if (typeof cell.value === 'number') {
        cell.numFmt = cell.value % 1 !== 0 ? '#,##0.00' : '#,##0'
      }
    })
  })

  // 4. Summary / Grand Total Rows (if any)
  if (options.summaryRows && options.summaryRows.length > 0) {
    options.summaryRows.forEach((sRow) => {
      const cleanedSumCells = sRow.map((rawVal, colIdx) => {
        const colDef = columns[colIdx] || { header: '' }
        const detected = detectColumnStyle(colDef.header)
        const cleaned = cleanCellValue(rawVal)
        if (detected.isNumeric && typeof cleaned === 'string') {
          const num = Number(cleaned.replace(/,/g, ''))
          if (!isNaN(num) && cleaned.trim() !== '') return num
        }
        return cleaned
      })

      const summaryRow = worksheet.addRow(cleanedSumCells)
      summaryRow.height = 24
      summaryRow.eachCell((cell, colNumber) => {
        const colDef = columns[colNumber - 1] || { header: '' }
        const style = detectColumnStyle(colDef.header)

        cell.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: 'FF0F172A' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' }, // Slate-200 for grand totals
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Double bottom border standard for grand totals
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        }

        const alignment = colDef.alignment || style.alignment || 'left'
        cell.alignment = { vertical: 'middle', horizontal: alignment }

        if (colDef.numFmt) {
          cell.numFmt = colDef.numFmt
        } else if (style.numFmt) {
          cell.numFmt = style.numFmt
        } else if (typeof cell.value === 'number') {
          cell.numFmt = cell.value % 1 !== 0 ? '#,##0.00' : '#,##0'
        }
      })
    })
  }

  // 5. Auto-calculate Column Widths
  worksheet.columns.forEach((col, idx) => {
    const colDef = columns[idx]
    if (colDef?.width) {
      col.width = colDef.width
      return
    }

    let maxLen = colDef?.header ? String(colDef.header).length : 10
    // Thai characters visual width is roughly 1.1x Latin
    col.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      // Don't count title/subtitle rows spanning merged cells
      if (options.title && rowNumber < tableHeaderRowIndex) return

      const cellText = cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
      if (cellText.length > maxLen) {
        maxLen = cellText.length
      }
    })

    col.width = Math.min(Math.max(maxLen + 4, 12), 48)
  })

  return workbook
}

/**
 * Export and trigger browser download of .xlsx file
 */
export async function exportRcmExcel(options: RcmExcelExportOptions): Promise<void> {
  const workbook = await buildRcmExcelWorkbook(options)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  let finalFilename = options.filename
  if (finalFilename.endsWith('.csv')) {
    finalFilename = finalFilename.replace(/\.csv$/i, '.xlsx')
  } else if (!finalFilename.endsWith('.xlsx')) {
    finalFilename = `${finalFilename}.xlsx`
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = finalFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
