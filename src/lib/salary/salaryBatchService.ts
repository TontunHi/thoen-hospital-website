import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'

export interface SalaryBatchGatewayAdapter {
  uploadBatch: (
    targetTable: 'salary' | 'ot',
    rows: Record<string, unknown>[]
  ) => Promise<{ insertedCount: number }>
  getLatestBatchSummary: (
    type: 'salary' | 'ot'
  ) => Promise<{ summary: LatestSalaryBatchSummary | null }>
  deleteLatestBatch: (
    type: 'salary' | 'ot',
    confirmedDate: string
  ) => Promise<{ deletedCount: number; deletedDate: string; tableName: 'salary' | 'ot' }>
}

const defaultSalaryBatchGateway: SalaryBatchGatewayAdapter = {
  uploadBatch: (targetTable, rows) => apiGateway.salary.uploadBatch(targetTable, rows),
  getLatestBatchSummary: (type) => apiGateway.salary.getLatestBatchSummary(type),
  deleteLatestBatch: (type, confirmedDate) => apiGateway.salary.deleteLatestBatch(type, confirmedDate),
}

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
  if (!utf8Str.includes('\uFFFD')) {
    return utf8Str
  }

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

  if (/^[+-]?[0-9.]+[eE][+-]?[0-9]+$/.test(trimmed)) {
    const num = Number(trimmed)
    if (!isNaN(num)) {
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

  if (/^[+-]?[0-9.]+$/.test(trimmed)) {
    if (trimmed.length === 13) return trimmed
    if (trimmed.length === 10) return trimmed
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

    if (year > 2400) {
      year = year - 543
    }

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}`
  }
  return val
}

/**
 * Deep domain service for Salary & OT batch file ingestion and management (Zero-SQL Gateway Adapter)
 */
export const SalaryBatchService = {
  parseBatchBuffer(buffer: Buffer, type: 'salary' | 'ot'): ParsedSalaryBatch {
    const csvContent = decodeBuffer(buffer)
    const rawRows = parseCSV(csvContent)

    if (rawRows.length <= 1) {
      throw new Error('ไม่พบข้อมูลในไฟล์ CSV หรือไฟล์ว่างเปล่า')
    }

    const dataRows = rawRows.slice(1)
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

  async ingestBatch(
    batch: ParsedSalaryBatch,
    gateway: SalaryBatchGatewayAdapter = defaultSalaryBatchGateway
  ): Promise<{ insertedCount: number }> {
    const records = batch.rows.map((row) => {
      const record: Record<string, string> = {}
      row.forEach((val, idx) => {
        record[`c${idx + 1}`] = val
      })
      return record
    })
    const res = await gateway.uploadBatch(batch.tableName, records)
    return { insertedCount: res.insertedCount }
  },

  async getLatestBatchSummary(
    type: 'salary' | 'ot',
    gateway: SalaryBatchGatewayAdapter = defaultSalaryBatchGateway
  ): Promise<LatestSalaryBatchSummary | null> {
    const res = await gateway.getLatestBatchSummary(type)
    return res.summary
  },

  async deleteLatestBatch(
    params: {
      type: 'salary' | 'ot'
      confirmedDate: string
      user: { username: string; email?: string; role?: string }
    },
    gateway: SalaryBatchGatewayAdapter = defaultSalaryBatchGateway
  ): Promise<DeleteSalaryBatchResult> {
    const { type, confirmedDate, user } = params
    const tableName = type === 'salary' ? 'salary' : 'ot'
    const res = await gateway.deleteLatestBatch(type, confirmedDate)

    await logAudit(
      'DELETE',
      tableName,
      `ลบชุดข้อมูล ${type.toUpperCase()} ล่าสุด วันที่ c1 = ${confirmedDate} จำนวน ${res.deletedCount} รายการ`,
      { username: user.username, email: user.email || '' }
    )

    return {
      success: true,
      deletedCount: res.deletedCount,
      deletedDate: confirmedDate,
      tableName,
    }
  },
}
