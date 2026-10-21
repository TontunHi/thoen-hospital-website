import ExcelJS from 'exceljs'

export async function exportMisHosRecordsToExcel(
  records: Record<string, any>[],
  columns: string[],
  reportTitle: string,
  year: string,
  hcode: string,
  hname: string = 'รพ.เถิน',
  columnLabels?: string[]
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Thoen Hospital Portal'
  workbook.created = new Date()

  const safeTitle = reportTitle.replace(/[\\/*?:[\]]/g, '').substring(0, 31) || 'MIS-HOS'
  const worksheet = workbook.addWorksheet(safeTitle, {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  // Title Row (A1)
  const lastColLetter = getColumnLetter(Math.max(columns.length + 1, 1))
  worksheet.mergeCells(`A1:${lastColLetter}1`)
  const titleCell = worksheet.getCell('A1')
  titleCell.value = `MIS HOS สปสช. - ${reportTitle}`
  titleCell.font = { name: 'Sarabun', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.getRow(1).height = 30

  // Meta Row (A2)
  worksheet.mergeCells(`A2:${lastColLetter}2`)
  const metaCell = worksheet.getCell('A2')
  metaCell.value = `หน่วยบริการ: ${hname} (${hcode}) | ปีงบประมาณ: ${year} | ข้อมูลจาก: MIS HOS สปสช. (ส่วนกลาง) | วันที่ส่งออก: ${new Date().toLocaleDateString('th-TH')}`
  metaCell.font = { name: 'Sarabun', size: 9, italic: true }
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 20

  worksheet.addRow([]) // Row 3 empty

  // Header Row (Row 4)
  const displayHeaders = columnLabels && columnLabels.length === columns.length
    ? columnLabels
    : columns
  const headerRow = worksheet.addRow(['ลำดับ', ...displayHeaders])
  headerRow.height = 24
  headerRow.eachCell(cell => {
    cell.font = { name: 'Sarabun', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // Data Rows
  records.forEach((rec, idx) => {
    const rowValues = [
      idx + 1,
      ...columns.map(col => {
        const val = rec[col]
        if (val === undefined || val === null) return '-'
        if (typeof val === 'number') return val
        const num = Number(val)
        if (!isNaN(num) && typeof val === 'string' && val.trim() !== '' && !val.startsWith('0') && val.length < 15) {
          return num
        }
        return val
      }),
    ]

    const dataRow = worksheet.addRow(rowValues)
    dataRow.height = 20
    const isEven = idx % 2 === 0

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 9 }
      if (!isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (typeof cell.value === 'number') {
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        if (cell.value % 1 !== 0) {
          cell.numFmt = '#,##0.00'
        } else {
          cell.numFmt = '#,##0'
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
    })
  })

  // Auto-fit columns
  worksheet.columns.forEach((col, idx) => {
    if (idx === 0) {
      col.width = 8
    } else {
      let maxLen = 14
      col.eachCell?.({ includeEmpty: false }, cell => {
        const len = cell.value ? String(cell.value).length : 0
        if (len > maxLen) maxLen = len
      })
      col.width = Math.min(Math.max(maxLen + 4, 12), 40)
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `MISHOS_${hcode}_${reportTitle.replace(/\s+/g, '_')}_${year}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getColumnLetter(colIndex: number): string {
  let letter = ''
  let temp = colIndex
  while (temp > 0) {
    const mod = (temp - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    temp = Math.floor((temp - mod) / 26)
  }
  return letter || 'A'
}
