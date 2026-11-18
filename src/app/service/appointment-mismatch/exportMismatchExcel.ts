import type ExcelJS from 'exceljs'
import {
  formatThaiShortDate,
  getDaysUntilDate,
  getUrgencyMeta,
  normalizeDepartmentLabel,
  normalizeUserLabel,
  type AppointmentMismatch,
} from './mismatchUtils'

const EXCEL_COLUMNS = [
  { header: 'ลำดับ', key: 'no', width: 8 }, // od-ignore
  { header: 'HN', key: 'hn', width: 14 }, // od-ignore
  { header: 'ห้องตรวจที่ระบุผิด', key: 'department', width: 28 }, // od-ignore
  { header: 'ผู้นัด', key: 'appUser', width: 24 }, // od-ignore
  { header: 'วันที่มารับบริการ', key: 'vstdate', width: 18 }, // od-ignore
  { header: 'วันนัดครั้งถัดไป', key: 'nextdate', width: 18 }, // od-ignore
  { header: 'ระยะเวลา', key: 'urgency', width: 18 }, // od-ignore
]

function sanitizeExcelText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export async function buildMismatchWorkbook(
  mismatches: AppointmentMismatch[],
  referenceDate: Date = new Date()
): Promise<ExcelJS.Workbook> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'โรงพยาบาลเถิน (Thoen Hospital)'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('รายการนัดผิดห้องตรวจ', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = EXCEL_COLUMNS

  const headerRow = sheet.getRow(1)
  headerRow.height = 28 // od-ignore
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Sarabun' } // od-ignore
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D7446' }, // od-ignore
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  mismatches.forEach((item, idx) => {
    const daysUntil = getDaysUntilDate(item.nextdate, referenceDate)
    const urgency = getUrgencyMeta(daysUntil)

    const row = sheet.addRow({
      no: idx + 1,
      hn: sanitizeExcelText(item.hn || '-'),
      department: sanitizeExcelText(normalizeDepartmentLabel(item.department)),
      appUser: sanitizeExcelText(normalizeUserLabel(item.appUser)),
      vstdate: formatThaiShortDate(item.vstdate),
      nextdate: formatThaiShortDate(item.nextdate),
      urgency: urgency.label,
    })

    row.height = 22 // od-ignore
    row.eachCell((cell) => {
      cell.font = { size: 11, name: 'Sarabun' } // od-ignore
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    const urgencyCell = row.getCell('urgency')
    if (urgency.tone === 'critical') {
      urgencyCell.font = { size: 11, name: 'Sarabun', bold: true, color: { argb: 'FF983630' } } // od-ignore
    } else if (urgency.tone === 'warning') {
      urgencyCell.font = { size: 11, name: 'Sarabun', bold: true, color: { argb: 'FF845D00' } } // od-ignore
    }
  })

  return workbook
}

export async function exportMismatchToExcel(
  mismatches: AppointmentMismatch[],
  referenceDate: Date = new Date()
): Promise<void> {
  if (mismatches.length === 0) return

  const workbook = await buildMismatchWorkbook(mismatches, referenceDate)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `appointment-mismatch-${dateStamp}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
