import { querySalaryEditDb } from '@/lib/salaryDb'
import { logAudit } from '@/lib/audit'

export type SalaryDbExecutor = (sql: string, params?: any[]) => Promise<any>

export interface ParsedSalaryBatch {
  type: 'salary' | 'ot'
  tableName: 'salary' | 'ot'
  rows: string[][]
  totalCount: number
}

export interface LatestSalaryBatchSummary {
  tableName: 'salary' | 'ot'
  date: string
  count: number
}

export interface DeleteSalaryBatchResult {
  success: boolean
  deletedCount: number
  deletedDate: string
  tableName: 'salary' | 'ot'
}

/**
 * Decode byte buffer with auto-detection of UTF-8 vs TIS-620 / Windows-874
 */
export function decodeBuffer(buf: Buffer): string {
  const utf8Str = buf.toString('utf8')
  // If no Unicode replacement characters, it is valid UTF-8
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
      str += String.fromCharCode(b - 161 + 0x0e01)
    } else {
      str += String.fromCharCode(b)
    }
  }
  return str
}

/**
 * Parse CSV text considering quoted fields, escaped quotes, and commas
 */
export function parseCSV(text: string): string[][] {
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
        currentField += char
      }
    }
    row.push(currentField.trim())
    result.push(row)
  }
  return result
}

/**
 * Normalize number and text formats (converts scientific notation to 13-digit IDs, formats currencies)
 */
export function formatNumericValue(val: string): string {
  if (!val) return ''
  const trimmed = val.trim().replace(/,/g, '')

  // 1. Check for Scientific Notation (e.g. 3.52E+12)
  if (/^[+-]?[0-9.]+[eE][+-]?[0-9]+$/.test(trimmed)) {
    const num = Number(trimmed)
    if (!isNaN(num)) {
      // Citizen ID detection: usually exponent is 12 (13 digits)
      const isCitizenId =
        trimmed.toLowerCase().includes('e+12') &&
        num >= 1000000000000 &&
        num <= 9999999999999
      if (isCitizenId) {
        return num.toLocaleString('fullwide', { useGrouping: false })
      }
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }

  // 2. Check for Standard Numbers
  if (/^[+-]?[0-9.]+$/.test(trimmed)) {
    // 13-digit Citizen ID: keep as string without decimals or grouping
    if (trimmed.length === 13) {
      return trimmed
    }
    // 10-digit Bank Account: keep as string
    if (trimmed.length === 10) {
      return trimmed
    }
    const num = Number(trimmed)
    if (!isNaN(num)) {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }

  return val
}

/**
 * Parse and format Thai Buddhist/Christian Era date into standard ISO YYYY-MM-DD
 */
export function parseAndFormatDate(val: string): string {
  const trimmed = (val || '').trim()
  const dateRegex = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/
  const match = trimmed.match(dateRegex)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    let year = parseInt(match[3], 10)

    // Convert Buddhist Era (BE) to Christian Era (CE) if year > 2400
    if (year > 2400) {
      year = year - 543
    }

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}`
  }
  return val
}

/**
 * Deep domain service for Salary & OT batch file ingestion and management
 */
export const SalaryBatchService = {
  /**
   * Parse uploaded CSV file buffer into normalized 30-column matrix
   */
  parseBatchBuffer(buffer: Buffer, type: 'salary' | 'ot'): ParsedSalaryBatch {
    const csvContent = decodeBuffer(buffer)
    const rawRows = parseCSV(csvContent)

    if (rawRows.length <= 1) {
      throw new Error('ไม่พบข้อมูลในไฟล์ CSV หรือไฟล์ว่างเปล่า')
    }

    const dataRows = rawRows.slice(1) // Skip header
    const normalizedRows = dataRows.map((row) => {
      return Array.from({ length: 30 }, (_, idx) => {
        let rawVal = row[idx] || ''
        if (idx === 0) {
          rawVal = parseAndFormatDate(rawVal)
        }
        return formatNumericValue(rawVal)
      })
    })

    return {
      type,
      tableName: type === 'salary' ? 'salary' : 'ot',
      rows: normalizedRows,
      totalCount: normalizedRows.length,
    }
  },

  /**
   * Ingest normalized 30-column salary batch into database
   */
  async ingestBatch(
    batch: ParsedSalaryBatch,
    executor: SalaryDbExecutor = querySalaryEditDb
  ): Promise<{ insertedCount: number }> {
    const columns = Array.from({ length: 30 }, (_, idx) => `c${idx + 1}`)
    const placeholders = Array.from({ length: 30 }, () => '?')
    const sql = `INSERT INTO ${batch.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`

    let insertedCount = 0
    for (const row of batch.rows) {
      await executor(sql, row)
      insertedCount++
    }

    return { insertedCount }
  },

  /**
   * Fetch the summary of the latest batch inserted in the salary or ot table
   */
  async getLatestBatchSummary(
    type: 'salary' | 'ot',
    executor: SalaryDbExecutor = querySalaryEditDb
  ): Promise<LatestSalaryBatchSummary | null> {
    const tableName = type === 'salary' ? 'salary' : 'ot'

    const latestRows = await executor(
      `SELECT DATE_FORMAT(c1, '%Y-%m-%d') as latest_date, c1 as raw_c1 
       FROM ${tableName} 
       WHERE c1 IS NOT NULL 
         AND c1 != '0000-00-00' 
         AND TRIM(c1) != '' 
       ORDER BY id DESC 
       LIMIT 1`
    )

    if (!latestRows || latestRows.length === 0) {
      return null
    }

    const latestDate =
      latestRows[0].latest_date ||
      (typeof latestRows[0].raw_c1 === 'string'
        ? latestRows[0].raw_c1.substring(0, 10)
        : '')

    if (!latestDate || latestDate === '0000-00-00') {
      return null
    }

    const countRows = await executor(
      `SELECT COUNT(*) as total_count FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [latestDate, latestDate]
    )

    const totalCount = countRows[0]?.total_count || 0

    return {
      tableName,
      date: latestDate,
      count: totalCount,
    }
  },

  /**
   * Atomically delete latest batch with date confirmation and audit trail
   */
  async deleteLatestBatch(
    params: {
      type: 'salary' | 'ot'
      confirmedDate: string
      user: { username: string; email?: string; role?: string }
    },
    executor: SalaryDbExecutor = querySalaryEditDb
  ): Promise<DeleteSalaryBatchResult> {
    const { type, confirmedDate, user } = params
    const tableName = type === 'salary' ? 'salary' : 'ot'

    const latest = await this.getLatestBatchSummary(type, executor)
    if (!latest) {
      throw new Error('ไม่พบชุดข้อมูลล่าสุดในตาราง')
    }

    if (latest.date !== confirmedDate) {
      throw new Error(
        `ข้อมูลมีการเปลี่ยนแปลง ชุดข้อมูลล่าสุดปัจจุบันคือวันที่ ${latest.date} กรุณารีเฟรชและตรวจสอบอีกครั้ง`
      )
    }

    const deleteResult: any = await executor(
      `DELETE FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [confirmedDate, confirmedDate]
    )

    const affectedRows = deleteResult?.affectedRows ?? latest.count

    await logAudit(
      'DELETE',
      tableName,
      `ลบชุดข้อมูล ${type.toUpperCase()} ล่าสุด วันที่ c1 = ${confirmedDate} จำนวน ${affectedRows} รายการ`,
      { username: user.username, email: user.email || '' }
    )

    return {
      success: true,
      deletedCount: affectedRows,
      deletedDate: confirmedDate,
      tableName,
    }
  },
}
