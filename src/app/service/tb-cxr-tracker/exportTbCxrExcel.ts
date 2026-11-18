import ExcelJS from 'exceljs'
import type { ExportScope, FilterTab, TbRecord } from './tbCxrTypes'
import { formatGenderLabel, formatThaiDateString } from './tbCxrTypes'

const EXCEL_COLUMNS = [
  { header: 'ลำดับ', key: 'no', width: 8 }, // od-ignore
  { header: 'HN', key: 'hn', width: 12 }, // od-ignore
  { header: 'คำนำ', key: 'title', width: 10 }, // od-ignore
  { header: 'ชื่อ', key: 'fname', width: 18 }, // od-ignore
  { header: 'นามสกุล', key: 'lname', width: 20 }, // od-ignore
  { header: 'เลขบัตรประชาชน', key: 'cid', width: 18 }, // od-ignore
  { header: 'เพศ', key: 'gender', width: 8 }, // od-ignore
  { header: 'อายุ (ปี)', key: 'age', width: 10 }, // od-ignore
  { header: 'วันเกิด (YYYYMMDD)', key: 'born_raw', width: 16 }, // od-ignore
  { header: 'วันเกิด (ไทย)', key: 'born', width: 14 }, // od-ignore
  { header: 'สถานะ CXR', key: 'cxr_status', width: 16 }, // od-ignore
  { header: 'ค่าวันที่ CXR (cxr_date)', key: 'cxr_date_raw', width: 22 }, // od-ignore
  { header: 'วันที่ตรวจ CXR (ไทย)', key: 'cxr_date', width: 18 }, // od-ignore
  { header: 'รพ.สต. / สถานพยาบาล', key: 'status', width: 22 }, // od-ignore
  { header: 'ที่อยู่ตามทะเบียน', key: 'home', width: 40 }, // od-ignore
  { header: 'สิทธิการรักษา', key: 'inccl_id', width: 24 }, // od-ignore
  { header: 'ผลตรวจ CXR (cxr_result)', key: 'cxr_result', width: 20 }, // od-ignore
  { header: 'ผลผิดปกติ (cxr_abnormal_result)', key: 'cxr_abnormal_result', width: 24 }, // od-ignore
  { header: 'หมายเหตุ', key: 'note', width: 20 }, // od-ignore
]

export async function exportTbCxrToExcel(params: {
  exportType: ExportScope
  activeTab: FilterTab
  allData: TbRecord[]
  filteredData: TbRecord[]
}): Promise<void> {
  const { exportType, activeTab, allData, filteredData } = params

  let exportRows: TbRecord[] = []
  let filenameSuffix = ''

  if (exportType === 'filtered') {
    exportRows = filteredData
    filenameSuffix = `filtered_${activeTab}_${filteredData.length}`
  } else if (exportType === 'all') {
    exportRows = allData
    filenameSuffix = `all_${allData.length}`
  } else if (exportType === 'done') {
    exportRows = allData.filter((d) => d.cxr_status === 'DONE')
    filenameSuffix = `cxr_done_${exportRows.length}`
  } else {
    exportRows = allData.filter((d) => d.cxr_status === 'MISSING')
    filenameSuffix = `cxr_missing_${exportRows.length}`
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'โรงพยาบาลเถิน (Thoen Hospital)'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('รายชื่อคัดกรอง CXR', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = EXCEL_COLUMNS

  const headerRow = sheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Sarabun' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D7446' }, // Hospital brand green
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  exportRows.forEach((r, idx) => {
    const isDone = r.cxr_status === 'DONE'
    const row = sheet.addRow({
      no: idx + 1,
      hn: r.hn || '',
      title: r.title || '',
      fname: r.fname || '',
      lname: r.lname || '',
      cid: r.cid || '',
      gender: r.gender === 'M' || r.gender === 'F' ? formatGenderLabel(r.gender) : '',
      age: r.age ?? '',
      born_raw: r.born || '',
      born: formatThaiDateString(r.born),
      cxr_status: isDone ? 'ตรวจแล้ว' : 'ยังไม่ได้ตรวจ',
      cxr_date_raw: r.cxr_date || '',
      cxr_date: isDone ? formatThaiDateString(r.cxr_date) : '-',
      status: r.status || '',
      home: r.home || '',
      inccl_id: r.inccl_id || '',
      cxr_result: r.cxr_result || '',
      cxr_abnormal_result: r.cxr_abnormal_result || '',
      note: r.note || '',
    })

    const statusCell = row.getCell('cxr_status')
    statusCell.font = isDone
      ? { color: { argb: 'FF00652C' }, bold: true }
      : { color: { argb: 'FF983630' }, bold: true }

    row.height = 22
    row.alignment = { vertical: 'middle' }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  a.href = url
  a.download = `tb_cxr_tracker_${filenameSuffix}_${timestamp}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
