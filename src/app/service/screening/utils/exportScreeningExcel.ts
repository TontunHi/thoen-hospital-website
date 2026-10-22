import ExcelJS from 'exceljs'

export interface ScreeningExportItem {
  id: number
  cid: string
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  fullName: string
  createdAt: string | Date
  status?: string
}

export interface ScreeningExportMeta {
  selectedDate: string
  statusFilter: string
  hospitalName?: string
}

/**
 * Format timestamp into Thai Buddhist date and time (DD/MM/BBBB HH:mm น.)
 */
export function formatThaiDateTime(dateVal: string | Date): string {
  if (!dateVal) return '-'
  try {
    const isoStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString()
    const normalized = isoStr.endsWith('Z') ? isoStr.replace(/Z$/, '+07:00') : isoStr
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return String(dateVal)

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear() + 543
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')

    return `${day}/${month}/${year} ${hours}:${minutes} น.`
  } catch {
    return String(dateVal)
  }
}

/**
 * Generate Excel workbook for Screening Queue data
 */
export async function buildScreeningExcelWorkbook(
  items: ScreeningExportItem[],
  meta: ScreeningExportMeta
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Thoen Hospital - Screening Service'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('รายชื่อผู้รับบริการ', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  // 1. Title Row
  worksheet.mergeCells('A1:C1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'รายชื่อผู้รับบริการ หน่วยคัดกรองตรวจสุขภาพนอกสถานที่ • โรงพยาบาลเถิน'
  titleCell.font = { name: 'Sarabun', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.getRow(1).height = 30

  // 2. Metadata Subtitle Row
  const dateLabel =
    meta.selectedDate === 'today'
      ? 'วันนี้'
      : meta.selectedDate === 'all'
      ? 'ทั้งหมด (All)'
      : `วันที่ ${meta.selectedDate}`

  const statusLabel =
    meta.statusFilter === 'ALL'
      ? 'ทุกสถานะ'
      : meta.statusFilter === 'WAITING'
      ? 'รอเปิด Visit'
      : meta.statusFilter === 'VISIT_OPENED'
      ? 'เปิด Visit แล้ว'
      : meta.statusFilter === 'NO_RECORD'
      ? 'ไม่มีเวชระเบียน'
      : meta.statusFilter === 'CANCELLED'
      ? 'ยกเลิก'
      : meta.statusFilter

  worksheet.mergeCells('A2:C2')
  const metaCell = worksheet.getCell('A2')
  metaCell.value = `ช่วงข้อมูล: ${dateLabel} | สถานะ: ${statusLabel} | จำนวนทั้งหมด: ${items.length} ราย | วันที่ส่งออก: ${formatThaiDateTime(new Date())}`
  metaCell.font = { name: 'Sarabun', size: 9.5, italic: true, color: { argb: 'FF475569' } }
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  worksheet.getRow(2).height = 22

  worksheet.addRow([]) // Blank Row 3
  worksheet.getRow(3).height = 6

  // 3. Table Column Headers (Row 4)
  const headerRow = worksheet.addRow([
    'วันที่รับบริการ',
    'เลขบัตรประชาชน',
    'ชื่อ - สกุล',
  ])
  headerRow.height = 26

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0284C7' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // 4. Data Rows
  items.forEach((item, index) => {
    const formattedDate = formatThaiDateTime(item.createdAt)
    const displayName =
      item.fullName ||
      [item.title, item.firstName, item.lastName].filter(Boolean).join(' ') ||
      '-'

    const row = worksheet.addRow([
      formattedDate,
      item.cid || '-',
      displayName,
    ])
    row.height = 22

    const isEven = index % 2 === 1
    const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF'

    // Format Date Column (Col A)
    const dateCell = row.getCell(1)
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' }
    dateCell.font = { name: 'Sarabun', size: 10 }

    // Format Citizen ID Column (Col B) - strictly as Text to preserve leading zero & prevent scientific notation
    const cidCell = row.getCell(2)
    cidCell.numFmt = '@'
    cidCell.alignment = { vertical: 'middle', horizontal: 'center' }
    cidCell.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: 'FF0F172A' } }

    // Format Name Column (Col C)
    const nameCell = row.getCell(3)
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    nameCell.font = { name: 'Sarabun', size: 10 }

    // Apply borders and zebra background
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  })

  // 5. Column Widths
  worksheet.columns = [
    { width: 24 }, // วันที่รับบริการ
    { width: 22 }, // เลขบัตรประชาชน
    { width: 34 }, // ชื่อ - สกุล
  ]

  return workbook
}

/**
 * Export Screening Queue to Excel and trigger browser download
 */
export async function exportScreeningToExcel(
  items: ScreeningExportItem[],
  meta: ScreeningExportMeta
): Promise<void> {
  const workbook = await buildScreeningExcelWorkbook(items, meta)

  const dateFileTag =
    meta.selectedDate === 'today'
      ? new Date().toISOString().split('T')[0]
      : meta.selectedDate

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `screening_patients_${dateFileTag}.xlsx`
  anchor.click()
  window.URL.revokeObjectURL(url)
}
