import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { querySalaryDb, querySalaryEditDb } from '@/lib/salaryDb'

async function checkFinanceAccess() {
  const session = await verifyMemberSession()
  if (!session) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน', status: 401 }
  }

  const users = await queryMemberDb(
    'SELECT role, position FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    return { error: 'ไม่พบข้อมูลสมาชิกในระบบ', status: 403 }
  }

  const member = users[0]
  let isFinance = member.role === 'admin' || (member.position && member.position.includes('เจ้าพนักงานการเงินและบัญชี'))

  if (!isFinance && member.position) {
    const finPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'upload_salary' AND TRIM(position_name) = TRIM(?)",
      [member.position]
    )
    isFinance = (finPerms[0]?.count || 0) > 0
  }

  if (!isFinance) {
    return { error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้', status: 403 }
  }

  return { success: true }
}

function decodeBuffer(buf: Buffer): string {
  const utf8Str = buf.toString('utf8')
  // If no replacement characters, it is valid UTF-8
  if (!utf8Str.includes('\uFFFD')) {
    return utf8Str
  }

  // Fallback to TIS-620 / Windows-874 decoding
  let str = ''
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    if (b < 128) {
      str += String.fromCharCode(b)
    } else if (b >= 161 && b <= 251) {
      str += String.fromCharCode(b - 161 + 0x0E01)
    } else {
      str += String.fromCharCode(b)
    }
  }
  return str
}

function parseCSV(text: string): string[][] {
  const result: string[][] = []
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    if (!line.trim()) continue

    const row: string[] = []
    let inQuotes = false
    let currentField = ''

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim())
    result.push(row)
  }
  return result
}
function formatNumericValue(val: string): string {
  if (!val) return ''
  const trimmed = val.trim().replace(/,/g, '')

  // 1. Check for Scientific Notation (e.g. 3.52E+12)
  if (/^[+-]?[0-9.]+[eE][+-]?[0-9]+$/.test(trimmed)) {
    const num = Number(trimmed)
    if (!isNaN(num)) {
      // Citizen ID detection: usually exponent is 12 (13 digits)
      const isCitizenId = trimmed.toLowerCase().includes('e+12') && num >= 1000000000000 && num <= 9999999999999
      if (isCitizenId) {
        return num.toLocaleString('fullwide', { useGrouping: false })
      }
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  }

  // 2. Check for Standard Numbers (excluding dates like 2026-06-12)
  if (/^[+-]?[0-9.]+$/.test(trimmed)) {
    // If it's a 13-digit Citizen ID, keep as string without decimals or grouping
    if (trimmed.length === 13) {
      return trimmed
    }
    // If it's a 10-digit Bank Account, keep as string
    if (trimmed.length === 10) {
      return trimmed
    }
    const num = Number(trimmed)
    if (!isNaN(num)) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  }

  return val
}

function parseAndFormatDate(val: string): string {
  const trimmed = val.trim()
  // Matches d/m/yyyy, dd/mm/yyyy, or d-m-yyyy formats
  const dateRegex = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/
  const match = trimmed.match(dateRegex)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    let year = parseInt(match[3], 10)

    // Convert Buddhist Era (BE) to Christian Era (AD) if year > 2400
    if (year > 2400) {
      year = year - 543
    }

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}`
  }
  return val
}


export async function POST(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'salary' or 'ot'

    if (!file || !type || (type !== 'salary' && type !== 'ot')) {
      return NextResponse.json({ error: 'กรุณาระบุไฟล์และประเภทนำเข้าที่ถูกต้อง' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const csvContent = decodeBuffer(buffer)
    const rows = parseCSV(csvContent)

    if (rows.length <= 1) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลในไฟล์ CSV' }, { status: 400 })
    }

    const dataRows = rows.slice(1) // Skip header row
    const tableName = type === 'salary' ? 'salary' : 'ot'

    // Construct bulk query placeholders
    const columns = Array.from({ length: 30 }, (_, idx) => `c${idx + 1}`)
    const placeholders = Array.from({ length: 30 }, () => '?')
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`

    let insertedCount = 0
    for (const row of dataRows) {
      // Ensure row has exactly 30 values, padded with empty strings and formatted
      const paddedRow = Array.from({ length: 30 }, (_, idx) => {
        let rawVal = row[idx] || ''
        if (idx === 0) { // c1 is the date column
          rawVal = parseAndFormatDate(rawVal)
        }
        return formatNumericValue(rawVal)
      })
      await querySalaryEditDb(sql, paddedRow)
      insertedCount++
    }

    return NextResponse.json({
      success: true,
      message: `นำเข้าข้อมูลเรียบร้อยแล้ว ทั้งหมด ${insertedCount} รายการ`,
      count: insertedCount,
    })
  } catch (error: any) {
    console.error('CSV upload error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์และบันทึกข้อมูล' }, { status: 500 })
  }
}
