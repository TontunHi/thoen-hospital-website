import ExcelJS from 'exceljs'
import {
  StatementResult,
  formatThaiDate,
  buildStatementData,
  buildStatementTransactions
} from './salaryStatementService'

/**
 * Generates a professionally formatted Thai Excel statement workbook for Thoen Hospital
 */
export async function generateStatementExcel(data: StatementResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'โรงพยาบาลเถิน'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet('หนังสือรับรองเงินได้', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  })

  // Set column widths (6 columns)
  worksheet.columns = [
    { width: 7 },  // A: ที่
    { width: 16 }, // B: วันที่
    { width: 44 }, // C: รายการ
    { width: 22 }, // D: ถอน / รายการหัก (บาท)
    { width: 22 }, // E: ฝาก / รายรับ (บาท)
    { width: 22 }, // F: ยอดคงเหลือ (บาท)
  ]

  // Styles helper
  const primaryColor = 'FF0284C7' // Hospital sky blue #0284c7
  const headerFont = { name: 'Cordia New', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  const normalFont = { name: 'Cordia New', size: 14 }
  const boldFont = { name: 'Cordia New', size: 14, bold: true }
  const titleFont = { name: 'Cordia New', size: 18, bold: true, color: { argb: 'FF0369A1' } }
  const subTitleFont = { name: 'Cordia New', size: 15, bold: true, color: { argb: 'FF334155' } }
  const currencyFormat = '#,##0.00'

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  }

  const doubleBottomBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  }

  // Row 1: Hospital Header
  worksheet.mergeCells('A1:F1')
  const r1 = worksheet.getCell('A1')
  r1.value = 'โรงพยาบาลเถิน สำนักงานสาธารณสุขจังหวัดลำปาง'
  r1.font = titleFont
  r1.alignment = { vertical: 'middle', horizontal: 'center' }

  // Row 2: Document Name (Thai Only)
  worksheet.mergeCells('A2:F2')
  const r2 = worksheet.getCell('A2')
  r2.value = 'หนังสือรับรองและสรุปรายการเงินได้-รายการหัก'
  r2.font = subTitleFont
  r2.alignment = { vertical: 'middle', horizontal: 'center' }

  // Row 3: Period Range (Without "ย้อนหลัง")
  worksheet.mergeCells('A3:F3')
  const r3 = worksheet.getCell('A3')
  r3.value = `ช่วงงวด: ${data.summary.fromPeriod} ถึง ${data.summary.toPeriod}`
  r3.font = { name: 'Cordia New', size: 13, bold: true, color: { argb: 'FF475569' } }
  r3.alignment = { vertical: 'middle', horizontal: 'center' }

  // Row 5 & 6: Member Profile (Thai Only)
  worksheet.mergeCells('A5:B5')
  worksheet.getCell('A5').value = `ชื่อ-นามสกุล: ${data.member.name || '-'}`
  worksheet.getCell('A5').font = boldFont

  worksheet.mergeCells('C5:D5')
  worksheet.getCell('C5').value = `รหัสบุคลากร: ${data.member.username}`
  worksheet.getCell('C5').font = boldFont

  worksheet.mergeCells('E5:F5')
  worksheet.getCell('E5').value = `ตำแหน่ง: ${data.member.position || '-'}`
  worksheet.getCell('E5').font = boldFont

  worksheet.mergeCells('A6:B6')
  worksheet.getCell('A6').value = `กลุ่มงาน/ฝ่าย: ${data.member.department || '-'}`
  worksheet.getCell('A6').font = boldFont

  worksheet.mergeCells('C6:D6')
  worksheet.getCell('C6').value = `เลขที่บัญชีธนาคาร: ${data.member.accountNumber || '-'}`
  worksheet.getCell('C6').font = boldFont

  worksheet.mergeCells('E6:F6')
  worksheet.getCell('E6').value = `วันที่ออกเอกสาร: ${formatThaiDate(new Date())}`
  worksheet.getCell('E6').font = boldFont

  for (let r = 5; r <= 6; r++) {
    for (let c = 1; c <= 6; c++) {
      worksheet.getCell(r, c).border = thinBorder
      worksheet.getCell(r, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      }
    }
  }

  // Row 8: Account Summary Header (ข้อมูลสรุปบัญชี)
  worksheet.mergeCells('A8:F8')
  const r8 = worksheet.getCell('A8')
  r8.value = 'ข้อมูลสรุปบัญชี'
  r8.font = { name: 'Cordia New', size: 14, bold: true, color: { argb: 'FF0369A1' } }
  r8.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F2FE' }
  }
  r8.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  r8.border = thinBorder

  // Row 9: Account Summary KPIs
  worksheet.mergeCells('A9:B9')
  worksheet.getCell('A9').value = `รวมรายรับทั้งสิ้น (ฝาก):`
  worksheet.getCell('A9').font = boldFont

  worksheet.getCell('C9').value = data.summary.totalEarnings
  worksheet.getCell('C9').numFmt = currencyFormat
  worksheet.getCell('C9').font = { name: 'Cordia New', size: 14, bold: true, color: { argb: 'FF059669' } }
  worksheet.getCell('C9').alignment = { vertical: 'middle', horizontal: 'right' }

  worksheet.getCell('D9').value = `รวมรายการหักทั้งสิ้น (ถอน):`
  worksheet.getCell('D9').font = boldFont

  worksheet.getCell('E9').value = data.summary.totalDeductions
  worksheet.getCell('E9').numFmt = currencyFormat
  worksheet.getCell('E9').font = { name: 'Cordia New', size: 14, bold: true, color: { argb: 'FFDC2626' } }
  worksheet.getCell('E9').alignment = { vertical: 'middle', horizontal: 'right' }

  worksheet.getCell('F9').value = `ยอดเงินสุทธิ: ${data.summary.totalNetPay.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`
  worksheet.getCell('F9').font = { name: 'Cordia New', size: 14, bold: true, color: { argb: 'FF0284C7' } }
  worksheet.getCell('F9').alignment = { vertical: 'middle', horizontal: 'center' }

  for (let c = 1; c <= 6; c++) {
    worksheet.getCell(9, c).border = thinBorder
    worksheet.getCell(9, c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F9FF' }
    }
  }

  // Row 11: Table Header (รายการเคลื่อนไหวทางบัญชี)
  const headerRow = worksheet.getRow(11)
  headerRow.height = 30
  const headerValues = [
    'ลำดับ',
    'วันที่',
    'รายการ',
    'ถอน / รายการหัก (บาท)',
    'ฝาก / รายรับ (บาท)',
    'ยอดคงเหลือ (บาท)'
  ]

  headerValues.forEach((val, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = val
    cell.font = headerFont
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder
  })

  // Rows 12+: Transaction Details Rows
  let currentRowIndex = 12
  const txList = data.transactions && data.transactions.length > 0
    ? data.transactions
    : buildStatementTransactions(data.records)

  txList.forEach((tx, idx) => {
    const row = worksheet.getRow(currentRowIndex)
    row.height = 24

    const isEven = idx % 2 === 1
    const rowBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF'

    row.getCell(1).value = idx + 1
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

    row.getCell(2).value = tx.date
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }

    row.getCell(3).value = tx.details
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' }

    row.getCell(4).value = tx.withdrawal
    row.getCell(4).numFmt = currencyFormat
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(4).font = { name: 'Cordia New', size: 14, color: { argb: tx.withdrawal > 0 ? 'FFDC2626' : 'FF475569' } }

    row.getCell(5).value = tx.deposit
    row.getCell(5).numFmt = currencyFormat
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(5).font = { name: 'Cordia New', size: 14, color: { argb: tx.deposit > 0 ? 'FF059669' : 'FF475569' } }

    row.getCell(6).value = tx.balance
    row.getCell(6).numFmt = currencyFormat
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(6).font = boldFont

    for (let col = 1; col <= 6; col++) {
      const cell = row.getCell(col)
      if (col <= 3) cell.font = normalFont
      cell.border = thinBorder
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBg }
      }
    }

    currentRowIndex++
  })

  // Summary Row: TOTAL (รวมทั้งสิ้น)
  const totalRow = worksheet.getRow(currentRowIndex)
  totalRow.height = 26
  worksheet.mergeCells(`A${currentRowIndex}:C${currentRowIndex}`)
  const totalLabelCell = totalRow.getCell(1)
  totalLabelCell.value = 'รวมทั้งสิ้น'
  totalLabelCell.font = boldFont
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' }

  totalRow.getCell(4).value = data.summary.totalDeductions
  totalRow.getCell(5).value = data.summary.totalEarnings
  totalRow.getCell(6).value = data.summary.totalNetPay

  for (let col = 1; col <= 6; col++) {
    const cell = totalRow.getCell(col)
    cell.font = boldFont
    cell.border = doubleBottomBorder
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    }
    if (col >= 4) {
      cell.numFmt = currencyFormat
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
