import ExcelJS from 'exceljs'
import { SmtBudgetRecord } from '@/lib/budget/smtBudgetService'

export async function exportSmtRecordsToExcel(
  records: SmtBudgetRecord[],
  years: string[],
  vendorId: string,
  vendorName: string = 'รพ.เถิน'
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Thoen Hospital Portal'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('ข้อมูลงบประมาณ สปสช. (SMT)', {
    views: [{ state: 'frozen', ySplit: 5 }],
  })

  // Title block
  worksheet.mergeCells('A1:O1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = `รายงานการโอนเงินงบประมาณ สปสช. (Smart Monitoring & Tracking)`
  titleCell.font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.getRow(1).height = 32

  // Meta block
  worksheet.mergeCells('A2:O2')
  const metaCell = worksheet.getCell('A2')
  metaCell.value = `หน่วยบริการ: ${vendorName} (รหัส: ${vendorId}) | ปีงบประมาณ: ${years.join(', ')} | วันที่ส่งออก: ${new Date().toLocaleDateString('th-TH')}`
  metaCell.font = { name: 'Sarabun', size: 10, italic: true }
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 20

  worksheet.addRow([]) // blank row 3

  // Headers (Row 4)
  const headerRow = worksheet.addRow([
    'ลำดับ',
    'ปีงบ',
    'วันที่โอน',
    'รอบจัดสรร',
    'เลขที่เอกสาร',
    'กลุ่มกองทุน',
    'ชื่อกองทุน',
    'กองทุนย่อย',
    'วงเงินจัดสรร (บาท)',
    'ยอดโอนสุทธิ (บาท)',
    'รอดำเนินการ (บาท)',
    'หักหนี้ (บาท)',
    'VAT (บาท)',
    'พันธบัตร (บาท)',
    'สถานะการโอน',
  ])
  headerRow.height = 26

  headerRow.eachCell(cell => {
    cell.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // Format date helper
  const formatDate = (val?: string) => {
    if (!val) return '–'
    const str = String(val)
    if (str.length === 8 && /^\d+$/.test(str)) {
      return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`
    }
    return str
  }

  // Populate data
  records.forEach((r, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      r.fiscalYear || '–',
      formatDate(r.postingDate || r.runDt),
      r.batchNo || '–',
      r.refDocNo || '–',
      r.fundGroupDescr || '–',
      r.fundName || '–',
      r.efundDesc || r.fundDescr || '–',
      Number(r.amount) || 0,
      Number(r.total) || 0,
      Number(r.wait) || 0,
      Number(r.debt) || 0,
      Number(r.vat) || 0,
      Number(r.bond) || 0,
      r.pmntStts || 'โอนสำเร็จ',
    ])

    row.height = 20

    // Number formats
    ;[9, 10, 11, 12, 13, 14].forEach(colIndex => {
      const cell = row.getCell(colIndex)
      cell.numFmt = '#,##0.00'
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    })

    ;[1, 2, 3, 4, 5, 15].forEach(colIndex => {
      row.getCell(colIndex).alignment = { vertical: 'middle', horizontal: 'center' }
    })
  })

  // Set column widths
  worksheet.columns = [
    { width: 8 },  // ลำดับ
    { width: 10 }, // ปีงบ
    { width: 14 }, // วันที่โอน
    { width: 14 }, // รอบจัดสรร
    { width: 18 }, // เลขที่เอกสาร
    { width: 28 }, // กลุ่มกองทุน
    { width: 34 }, // ชื่อกองทุน
    { width: 32 }, // กองทุนย่อย
    { width: 18 }, // วงเงินจัดสรร
    { width: 18 }, // ยอดโอนสุทธิ
    { width: 16 }, // รอดำเนินการ
    { width: 14 }, // หักหนี้
    { width: 14 }, // VAT
    { width: 14 }, // พันธบัตร
    { width: 16 }, // สถานะ
  ]

  // Totals Row
  const totalRowIndex = worksheet.rowCount + 1
  const totalsRow = worksheet.addRow([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'ยอดรวมทั้งสิ้น',
    { formula: `SUM(I5:I${totalRowIndex - 1})` },
    { formula: `SUM(J5:J${totalRowIndex - 1})` },
    { formula: `SUM(K5:K${totalRowIndex - 1})` },
    { formula: `SUM(L5:L${totalRowIndex - 1})` },
    { formula: `SUM(M5:M${totalRowIndex - 1})` },
    { formula: `SUM(N5:N${totalRowIndex - 1})` },
    '',
  ])
  totalsRow.height = 24
  totalsRow.eachCell(cell => {
    cell.font = { name: 'Sarabun', bold: true, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF059669' } },
      bottom: { style: 'double', color: { argb: 'FF059669' } },
    }
  })
  ;[9, 10, 11, 12, 13, 14].forEach(colIndex => {
    totalsRow.getCell(colIndex).numFmt = '#,##0.00'
  })

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `SMT_Budget_${vendorId}_${years.join('-')}.xlsx`
  anchor.click()
  window.URL.revokeObjectURL(url)
}
