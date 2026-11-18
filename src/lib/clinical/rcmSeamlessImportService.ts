import ExcelJS from 'exceljs'
import { apiGateway, GatewayNotFoundError, GatewayUnavailableError } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'
import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey, invalidateCachePattern } from '@/lib/cache'
import type { QueryExecutor } from './rcmDashboardService'

export const DEFAULT_SEAMLESS_HOSPCODE = '11152'

/**
 * 30 Standard Fund Prefixes mapped from Rep code (as defined in FoxPro RCM module)
 */
export const SEAMLESS_FUND_MAP: Record<string, string> = {
  DAMD: 'ระบบบริการทางการแพทย์ AMED',
  DAME: 'ระบบบริการทางการแพทย์ทางไกล',
  DANC: 'ระบบบริการฝากครรภ์',
  DATK: 'โครงการแจกชุดตรวจโควิด-19',
  DBMT: 'โครงการปลูกถ่ายไขกระดูก',
  DCAC: 'ระบบบริการตรวจคัดกรองและตรวจยืนยันมะเร็งลำไส้ใหญ่',
  DCCS: 'ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก',
  DCKD: 'ระบบสารสนเทศเพื่อการให้บริการผู้ป่วยไตวายเรื้อรังระยะสุดท้าย',
  DCMH: 'ระบบบริการดูแลผู้ป่วยจิตเวชเรื้อรังในชุมชน',
  DCNB: 'ระบบการจ่ายค่าใช้จ่ายบริการสาธารณสุข กรณีการใช้ยาน้ำมันกัญชา',
  DDEN: 'โครงการฟันเทียมพระราชทาน',
  DDOW: 'ระบบบูรณาการการคัดกรองความผิดปกติของหญิงตั้งครรภ์และทารกแรกเกิด (กลุ่มอาการดาวน์)',
  DDSA: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
  DHEM: 'ระบบบริหารโรคเลือดออกง่ายฮีโมฟีเลีย',
  DHTD: 'ระบบผ่าตัดเปลี่ยนหัวใจในเด็ก',
  DINS: 'โครงการบัตรประชาชนใบเดียวสำหรับหน่วยนวัตกรรม',
  DKTP: 'Krungthai Digital Health Platform',
  DLTC: 'ระบบผู้สูงอายุและผู้มีภาวะพึ่งพิง',
  DLTD: 'ระบบผ่าตัดเปลี่ยนตับในเด็ก',
  DMOP: 'ระบบหมอพร้อม',
  DMOR: 'ระบบหมอพร้อม',
  DMTB: 'ระบบบริหารจัดการโรคเฉพาะ(วัณโรค)',
  DMXD: 'ระบบทันตกรรมจัดฟันและบริการแก้ไขการพูดและการได้ยิน (Cleft Lip and Cleft Palate)',
  DNAP: 'ระบบสารสนเทศการให้บริการผู้ติดเชื้อเอชไอวี ผู้ป่วยเอดส์ แห่งชาติ (NAP)',
  DPHS: 'ระบบบริการสร้างเสริมสุขภาพและป้องกันโรคที่บ้านและชุมชน',
  DPRX: 'ระบบข้อมูลการจ่ายยาตามใบสั่งแพทย์',
  DTDT: 'ระบบบริการผู้ป่วยโรคโลหิตจางธาลัสซีเมียชนิดรุนแรง',
  DTLM: 'ระบบบูรณาการการคัดกรองความผิดปกติของหญิงตั้งครรภ์และทารกแรกเกิด (โรคโลหิตจางธาลัสซีเมีย)',
  DTSH: 'ระบบบริการไทรอยด์สำหรับเด็กแรกเกิด',
  DTTM: 'ระบบบริการการแพทย์แผนไทย',
}

export interface ParsedSeamlessRow {
  rowNumber: number
  id: string // TransID / ID
  rep: string
  fund: string
  period: string | null
  vn: string | null
  hn: string | null
  an: string | null
  pid: string | null // 13-digit Thai CID
  ptname: string | null
  admDate: string | null // YYYY-MM-DD
  sendDate: string | null // YYYY-MM-DD
  regDate: string | null // YYYY-MM-DD
  mainInscl: string | null
  department: string // 'OP' | 'IP'
  hcode: string
  type: string | null
  serialNo: string | null
  collected: number
  compensated: number
  noCompensated: number
  payMore: number
  recall: number
  status: string | null
  note: string | null
  stmid: string | null
  codeAccount: string | null
  equipCode: string | null
  equipName: string | null
  hsub: string | null
  hsend: string | null
  payNo: string | null
  payDate: string | null
  yymm: string
  yearBudget: string
  yymmPay: string | null
  yearBudgetPay: string | null
  fileName: string
}

export interface SeamlessSummaryInfo {
  rep: string
  payNo: string
  repDate: string | null
  payDate: string | null
  codeAccount: string | null
}

export interface SeamlessDenyCode {
  code: string
  name: string
}

export interface SeamlessParseError {
  rowNumber: number
  transId?: string
  rep?: string
  field?: string
  reason: string
}

export interface SeamlessSummaryMetrics {
  totalCompensation: number
  uniquePatients: number
  uniqueFunds: string[]
  matchedPatientsHOSxP: number
  matchedVnsHOSxP: number
}

export type SeamlessDuplicateMode = 'update' | 'skip'

export interface SeamlessFundBreakdownItem {
  fundCode: string
  fundName: string
  count: number
  totalCollected: number
  totalCompensated: number
}

export interface SeamlessParseResult {
  fileName: string
  fileSizeBytes: number
  totalSheets: number
  processedSheets: string[]
  totalRows: number
  validRows: number
  errorRows: number
  fundsDetected: Record<string, number>
  fundBreakdown?: SeamlessFundBreakdownItem[]
  summaryInfo: SeamlessSummaryInfo | null
  denyCodes: SeamlessDenyCode[]
  previewRows: ParsedSeamlessRow[]
  errors: SeamlessParseError[]
  summary: SeamlessSummaryMetrics
  executionTimeMs: number
  isDryRun: boolean
  filterMyHospOnly: boolean
  duplicateMode: SeamlessDuplicateMode
  insertedCount: number
  updatedCount: number
  skippedCount: number
  skippedOtherHospCount: number
  existingInDbCount: number
  newInDbCount: number
  duplicateInFileCount: number
  isAlreadyImported: boolean
  existingFileRowCount: number
}

export interface SeamlessDatabaseStats {
  totalRows: number
  totalReps: number
  totalFiles: number
  latestAdmDate: string | null
  totalCompensated: number
  otherHospCount?: number
  missingPayDateCount?: number
  denyCodeCount?: number
  myHospCode?: string
  topFunds: Array<{ fund: string; rowCount: number; totalCompensated: number }>
  recentFiles: Array<{
    fileName: string
    rowCount: number
    minDate: string | null
    maxDate: string | null
    totalCompensated: number
  }>
}

export type SeamlessHospFilter = 'ALL' | 'MINE' | 'OTHER'
export type SeamlessPayStatusFilter = 'ALL' | 'PAID' | 'UNPAID'
export type SeamlessLedgerSortField =
  | 'admDate'
  | 'id'
  | 'rep'
  | 'fund'
  | 'hn'
  | 'ptname'
  | 'collected'
  | 'compensated'
  | 'payDate'
  | 'fileName'

export interface SeamlessLedgerItem {
  id: string
  yymm: string | null
  yearBudget: string | null
  fund: string
  period: string | null
  rep: string
  vn: string | null
  hn: string | null
  an: string | null
  pid: string | null
  ptname: string | null
  admDate: string | null
  sendDate: string | null
  regDate: string | null
  mainInscl: string | null
  department: string | null
  hcode: string | null
  hsub: string | null
  hsend: string | null
  type: string | null
  serialNo: string | null
  payNo: string | null
  payDate: string | null
  yymmPay: string | null
  yearBudgetPay: string | null
  codeAccount: string | null
  collected: number
  compensated: number
  noCompensated: number
  payMore: number
  recall: number
  status: string | null
  note: string | null
  stmid: string | null
  equipCode: string | null
  equipName: string | null
  fileName: string | null
  isOtherHosp: boolean
}

export interface SeamlessLedgerQueryParams {
  search?: string
  fundFilter?: string
  hospFilter?: SeamlessHospFilter
  payStatus?: SeamlessPayStatusFilter
  fileName?: string
  sortBy?: SeamlessLedgerSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  myHospCode?: string
}

export interface SeamlessLedgerResult {
  items: SeamlessLedgerItem[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  availableFunds: string[]
  myHospCode: string
}

export interface SeamlessImportedFileDetail {
  fileName: string
  rowCount: number
  minDate: string | null
  maxDate: string | null
  totalCollected: number
  totalCompensated: number
  otherHospCount: number
  missingPayDateCount: number
  repCount: number
}

/**
 * Reverse lookup map from Thai Fund Name -> 4-char prefix (e.g. 'DDSA')
 */
const FUND_NAME_TO_CODE_MAP: Record<string, string> = Object.entries(SEAMLESS_FUND_MAP).reduce(
  (acc, [code, name]) => {
    if (!acc[name]) acc[name] = code
    return acc
  },
  {} as Record<string, string>
)

/**
 * FoxPro isSeamless() parity: check whether a filename matches one of the 30 fund prefixes or REP...INDIVIDUAL
 */
export function isSeamlessFileName(fileName: string): boolean {
  const upper = (fileName || '').toUpperCase()
  if (!upper) return false
  if (upper.includes('REP') && upper.includes('INDIVIDUAL')) return true
  return Object.keys(SEAMLESS_FUND_MAP).some((prefix) => upper.includes(prefix))
}

/**
 * Resolve 4-character fund code from Rep or Thai fund name
 */
export function resolveFundCodeFromNameOrRep(fundNameOrRep: string): string {
  const trimmed = (fundNameOrRep || '').trim()
  if (!trimmed) return 'DMIS'
  if (FUND_NAME_TO_CODE_MAP[trimmed]) return FUND_NAME_TO_CODE_MAP[trimmed]
  const upper = trimmed.slice(0, 4).toUpperCase()
  if (SEAMLESS_FUND_MAP[upper]) return upper
  const customMatch = trimmed.match(/^กองทุน\s+([A-Z0-9]{4})$/i)
  if (customMatch) return customMatch[1].toUpperCase()
  return upper
}

/**
 * Determine Fund name from Rep code prefix (first 4 characters)
 */
export function resolveFundFromRep(rep: string): string {
  if (!rep || typeof rep !== 'string') return 'ไม่ระบุกองทุน'
  const prefix = rep.trim().slice(0, 4).toUpperCase()
  return SEAMLESS_FUND_MAP[prefix] || `กองทุน ${prefix}`
}

/**
 * Calculate Buddhist Era YYMM (e.g. 2026-08-31 -> BE 2569 -> '69' + '08' = '6908')
 */
export function calculateYYMM(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return ''
  const parts = dateStr.split('-')
  const year = parseInt(parts[0], 10)
  const month = parts[1].padStart(2, '0')
  if (isNaN(year)) return ''
  const beYear = year + 543
  const yy = String(beYear).slice(-2)
  return `${yy}${month}`
}

/**
 * Calculate Fiscal Year in Buddhist Era (Oct-Sep)
 * If month >= 10, fiscal year = year + 543 + 1
 */
export function calculateYearBudget(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return ''
  const parts = dateStr.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  if (isNaN(year) || isNaN(month)) return ''
  const fiscalYear = month >= 10 ? year + 543 + 1 : year + 543
  return String(fiscalYear)
}

/**
 * Unwrap ExcelJS formula/richText/hyperlink/error cell objects to primitive value
 */
function unwrapCellValue(val: unknown): unknown {
  if (val === null || val === undefined) return val
  if (typeof val !== 'object') return val
  if (val instanceof Date) return val
  const obj = val as Record<string, unknown>
  if ('result' in obj) {
    return obj.result
  }
  if ('richText' in obj && Array.isArray(obj.richText)) {
    return obj.richText.map((part) => (part && typeof part === 'object' ? String((part as { text?: unknown }).text || '') : '')).join('')
  }
  if ('text' in obj) {
    return obj.text
  }
  if ('error' in obj) {
    return ''
  }
  return val
}

/**
 * Normalize any input date value (Excel date, string, timestamp) to YYYY-MM-DD
 */
export function normalizeDate(value: unknown): string | null {
  const raw = unwrapCellValue(value)
  if (raw === null || raw === undefined || raw === '') return null

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null
    let year = raw.getUTCFullYear()
    if (year > 2400) year -= 543
    const month = String(raw.getUTCMonth() + 1).padStart(2, '0')
    const day = String(raw.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const str = String(raw).trim()
  if (!str || /^null$/i.test(str)) return null

  // Format: YYYY-MM-DD (or YYYY-MM-DD HH:mm:ss)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10)
    if (year > 2400) year -= 543
    return `${year}-${isoMatch[2]}-${isoMatch[3]}`
  }

  // Format: DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0')
    const month = slashMatch[2].padStart(2, '0')
    let year = parseInt(slashMatch[3], 10)
    // If year > 2400, it's Buddhist Era
    if (year > 2400) {
      year -= 543
    }
    return `${year}-${month}-${day}`
  }

  // Format: YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    let year = parseInt(str.slice(0, 4), 10)
    if (year > 2400) year -= 543
    const month = str.slice(4, 6)
    const day = str.slice(6, 8)
    return `${year}-${month}-${day}`
  }

  // Fallback Date parser
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

/**
 * Safe numeric parser with fallback
 */
export function parseNumber(val: unknown, fallback = 0): number {
  const raw = unwrapCellValue(val)
  if (raw === null || raw === undefined || raw === '') return fallback
  const num =
    typeof raw === 'number'
      ? raw
      : parseFloat(String(raw).replace(/[,฿\s]/g, '').trim())
  return isNaN(num) || !Number.isFinite(num) ? fallback : Math.round(num * 100) / 100
}

/**
 * Clean Thai string or cell value (handles richText, formula results, hyperlinks, zero-width spaces)
 */
export function cleanCellString(val: unknown): string {
  const raw = unwrapCellValue(val)
  if (raw === null || raw === undefined) return ''
  return String(raw)
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
    .trim()
}

/**
 * Extract 5-digit hospital code (or padded numeric code / trimmed prefix before parentheses)
 */
export function extractHospCodeFromText(raw: string): string {
  const cleaned = (raw || '').trim()
  if (!cleaned) return ''
  const beforeParen = cleaned.split('(')[0].trim()
  const fiveDigitMatch = beforeParen.match(/\b(\d{5})\b/)
  if (fiveDigitMatch) return fiveDigitMatch[1]
  if (/^\d{1,5}$/.test(beforeParen)) return beforeParen.padStart(5, '0')
  return beforeParen
}

/**
 * FoxPro checkhn() parity: zero-pad numeric HN to 7 digits
 */
export function normalizeHn(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || /^null$/i.test(trimmed)) return null
  return /^\d{1,7}$/.test(trimmed) ? trimmed.padStart(7, '0') : trimmed
}

/**
 * FoxPro checkan() parity: zero-pad numeric AN to 9 digits
 */
export function normalizeAn(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || /^null$/i.test(trimmed)) return null
  return /^\d{1,9}$/.test(trimmed) ? trimmed.padStart(9, '0') : trimmed
}

/**
 * Run async chunk processors with bounded concurrency
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  let idx = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++]
      await worker(current)
    }
  })
  await Promise.all(runners)
}

/**
 * FoxPro SeekHCode() parity: scan sheet top metadata rows before header for
 * "รหัสหน่วยบริการ" or "ชื่อหน่วยบริการ" (falling back to HOSxP `hospcode` lookup)
 */
async function resolveSheetHospCode(
  sheet: ExcelJS.Worksheet,
  maxSearchRow: number,
  autoEnrichHosp: boolean,
  exec: QueryExecutor = queryClinicalDb
): Promise<string> {
  let hospNameCandidate = ''

  for (let r = 1; r <= maxSearchRow; r++) {
    const row = sheet.getRow(r)
    const maxCol = Math.min(8, row.cellCount || 8)
    for (let c = 1; c <= maxCol; c++) {
      const text = cleanCellString(row.getCell(c).value)
      if (!text) continue

      const readAdjacentValue = (): string => {
        const colonIdx = text.indexOf(':')
        if (colonIdx !== -1) {
          const afterColon = text.slice(colonIdx + 1).trim()
          if (afterColon) return afterColon
        }
        for (let offset = 1; offset <= 3; offset++) {
          const nextVal = cleanCellString(row.getCell(c + offset).value)
          if (nextVal) return nextVal
        }
        return ''
      }

      if (text.includes('รหัสหน่วยบริการ')) {
        const val = readAdjacentValue()
        const code = extractHospCodeFromText(val)
        if (code) return code
      }

      if (text.includes('ชื่อหน่วยบริการ') && !hospNameCandidate) {
        const val = readAdjacentValue()
        if (val) {
          const codeMatch = val.match(/\b(\d{5})\b/)
          if (codeMatch) return codeMatch[1]
          hospNameCandidate = val
        }
      }
    }
  }

  if (hospNameCandidate && autoEnrichHosp) {
    try {
      const cleanedName = hospNameCandidate.replace(/^โรงพยาบาล/, '').trim()
      const hospRows = await exec(
        `
        SELECT hospcode
        FROM hospcode
        WHERE name = ?
           OR name = ?
           OR CONCAT(IFNULL(hosptype, ''), name) LIKE ?
        LIMIT 1
        `,
        [hospNameCandidate, cleanedName || hospNameCandidate, `%${cleanedName || hospNameCandidate}%`]
      )
      if (hospRows.length > 0 && hospRows[0].hospcode) {
        return String(hospRows[0].hospcode).trim()
      }
    } catch (err) {
      logger.warn({ err }, 'SeekHCode hospcode lookup failed in Seamless import')
    }
  }

  return ''
}

/**
 * Decode CSV/text buffer supporting UTF-8 (with BOM) and Thai legacy Windows-874/TIS-620
 */
function decodeTextBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8')
  }
  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text
  }
  try {
    return new TextDecoder('windows-874').decode(buffer)
  } catch {
    return utf8Text
  }
}

/**
 * Parse RFC-4180 CSV text into rows of cell strings (handles quoted commas like "VCTID,NAPNumber,PID")
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      currentRow.push(currentField)
      currentField = ''
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else if (ch === '\n') {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else {
      currentField += ch
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

/**
 * Load .xlsx or .csv buffer into an ExcelJS Workbook, giving clear diagnostics for legacy binary/HTML .xls
 */
async function loadWorkbookFromBuffer(buffer: Buffer, fileName: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04

  if (isZip) {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
    return workbook
  }

  const isOle2Xls =
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0

  if (isOle2Xls) {
    throw new Error(
      'ไฟล์นี้เป็น Excel 97-2003 (.xls ไบนารี) ซึ่งระบบเว็บอ่านโดยตรงไม่ได้ — กรุณาเปิดไฟล์ใน Excel แล้ว Save As เป็น .xlsx หรือ .csv ก่อนนำเข้า'
    )
  }

  const headText = decodeTextBuffer(buffer.subarray(0, Math.min(buffer.length, 512))).trimStart()
  if (/^<(?:!doctype|html|table|\?xml|workbook)\b/i.test(headText)) {
    throw new Error(
      'ไฟล์นี้เป็นเอกสาร HTML/XML (.xls) ซึ่งระบบเว็บอ่านโดยตรงไม่ได้ — กรุณาเปิดไฟล์ใน Excel แล้ว Save As เป็น .xlsx หรือ .csv ก่อนนำเข้า'
    )
  }

  if (/\.csv$/i.test(fileName) || headText.includes(',')) {
    const csvRows = parseCsvRows(decodeTextBuffer(buffer))
    const sheet = workbook.addWorksheet('INDIVIDUAL')
    for (const row of csvRows) {
      sheet.addRow(row)
    }
    return workbook
  }

  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
    return workbook
  } catch (err: unknown) {
    const isLegacyXls = /\.xls$/i.test(fileName)
    throw new Error(
      isLegacyXls
        ? 'ไฟล์นามสกุล .xls (รูปแบบไบนารีเก่า) ไม่รองรับการอ่านโดยตรง กรุณาเปิดด้วย Excel แล้ว Save As เป็น .xlsx หรือ .csv ก่อนนำเข้า'
        : `ไม่สามารถเปิดอ่านไฟล์ Excel ได้ (${err instanceof Error ? err.message : 'รูปแบบไฟล์ไม่ถูกต้อง'})`
    )
  }
}

/**
 * Map recognized Thai/English Seamless column headers onto a mutable column-index map
 */
function mapSeamlessHeaderRow(
  row: ExcelJS.Row,
  targetMap: Record<string, number>
): number {
  let matched = 0

  row.eachCell((cell, colNumber) => {
    const raw = cleanCellString(cell.value).toLowerCase()
    const text = raw.replace(/\s+/g, '')
    const textNoDots = text.replace(/\./g, '')
    if (!text) return

    if (text === 'ลำดับ' || text === 'ลำดับที่' || text === 'no') {
      if (!targetMap.no) {
        targetMap.no = colNumber
      } else if (!targetMap.serialNo && colNumber > targetMap.no) {
        // Format DKTP uses a second "ลำดับที่" column for Visit/SerialNo
        targetMap.serialNo = colNumber
      }
      matched++
    } else if (text === 'rep' || text === 'เลขที่rep' || textNoDots === 'repno') {
      targetMap.rep = colNumber
      matched++
    } else if (text === 'tranid' || text === 'transid' || text === 'id') {
      targetMap.id = colNumber
      matched++
    } else if (text.includes('pid') || text.includes('เลขบัตร') || text.includes('เลขประจำตัว')) {
      targetMap.pid = colNumber
      matched++
    } else if (text.includes('สิทธิ') || text.includes('maininscl')) {
      targetMap.mainInscl = colNumber
      matched++
    } else if (text.includes('วันที่เข้า') || text.includes('วันที่รับบริการ') || text.includes('admdate')) {
      targetMap.admDate = colNumber
      matched++
    } else if (text.includes('วันที่ส่ง') || text.includes('senddate')) {
      targetMap.sendDate = colNumber
      matched++
    } else if (text.includes('วันที่ลงทะเบียน') || text.includes('regdate')) {
      targetMap.regDate = colNumber
      matched++
    } else if (text.includes('ประเภทที่ขอเบิก') || text === 'type') {
      targetMap.type = colNumber
      matched++
    } else if (text.includes('visitno') || text.includes('serialno')) {
      targetMap.serialNo = colNumber
      matched++
    } else if (text.includes('รวมเงินที่ขอเบิก') || text.includes('collected')) {
      targetMap.collected = colNumber
      matched++
    } else if (text === 'ชดเชย' || text.includes('compensated') || text === 'เงินชดเชย') {
      if (!targetMap.compensated && !text.includes('ไม่ชดเชย')) {
        targetMap.compensated = colNumber
        matched++
      }
    } else if (text.includes('ไม่ชดเชย') || text.includes('nocompensated')) {
      targetMap.noCompensated = colNumber
      matched++
    } else if (text.includes('จ่ายเพิ่ม') || text.includes('paymore')) {
      targetMap.payMore = colNumber
      matched++
    } else if (text.includes('เรียกคืน') || text.includes('recall')) {
      targetMap.recall = colNumber
      matched++
    } else if (text.includes('แม่ข่าย') || text.includes('hmain') || text.includes('hcode')) {
      targetMap.hcode = colNumber
      matched++
    } else if (text.includes('ลูกข่าย') || text.includes('hsub')) {
      targetMap.hsub = colNumber
      matched++
    } else if (text.includes('hsend')) {
      targetMap.hsend = colNumber
      matched++
    } else if (text.includes('stmid')) {
      targetMap.stmid = colNumber
      matched++
    } else if (text.includes('รหัสอุปกรณ์') || text.includes('equipcode')) {
      targetMap.equipCode = colNumber
      matched++
    } else if (text.includes('ชื่อรายการอุปกรณ์') || text.includes('equipname')) {
      targetMap.equipName = colNumber
      matched++
    } else if (text === 'สถานะ' || text === 'status') {
      targetMap.status = colNumber
      matched++
    } else if (text === 'note' || text === 'หมายเหตุ') {
      targetMap.note = colNumber
      matched++
    } else if (text === 'hn') {
      targetMap.hn = colNumber
    } else if (text === 'vn') {
      targetMap.vn = colNumber
    } else if (text === 'an') {
      targetMap.an = colNumber
    } else if (text === 'ptname' || text.includes('ชื่อ-สกุล') || text.includes('ชื่อสกุล')) {
      targetMap.ptname = colNumber
    }
  })

  return matched
}

/**
 * Check whether a worksheet contains Seamless INDIVIDUAL claim data
 * based on structural headers (requiring TransID/ID or excluding Summary/Detail/DenyCode tables)
 */
function isIndividualSheet(sheet: ExcelJS.Worksheet): boolean {
  const sheetNameUpper = (sheet.name || '').toUpperCase()
  if (
    sheetNameUpper.includes('SUMMARY') ||
    sheetNameUpper.includes('DENY CODE') ||
    sheetNameUpper.includes('DENY_CODE') ||
    sheetNameUpper === 'DETAIL'
  ) {
    return false
  }

  let hasSummaryColumns = false
  let hasDetailOrDenyColumns = false
  let hasStructuredHeaderWithoutId = false

  for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
    const row = sheet.getRow(r)
    const tempMap: Record<string, number> = {}
    const foundKeywords = mapSeamlessHeaderRow(row, tempMap)

    if (tempMap.id && foundKeywords >= 3 && (tempMap.rep || tempMap.pid || tempMap.hn || tempMap.admDate)) {
      return true
    }

    let rowText = ''
    row.eachCell((cell) => {
      const val = cleanCellString(cell.value)
      if (val) rowText += ` ${val}`
    })

    if (rowText.includes('งวด/เลขที่เบิกจ่าย') || rowText.includes('REP Date')) {
      hasSummaryColumns = true
    }
    if (
      rowText.includes('รวมจำนวนชดเชย') ||
      rowText.includes('ชดเชยสุทธิ') ||
      rowText.includes('DENY CODE')
    ) {
      hasDetailOrDenyColumns = true
    }
    if (foundKeywords >= 4 && !tempMap.id && (tempMap.rep || tempMap.pid)) {
      hasStructuredHeaderWithoutId = true
    }
  }

  if (hasSummaryColumns || hasDetailOrDenyColumns || hasStructuredHeaderWithoutId) {
    return false
  }

  if (sheetNameUpper.includes('INDIVIDUAL')) return true

  for (let r = 1; r <= Math.min(8, sheet.rowCount); r++) {
    const row = sheet.getRow(r)
    for (let c = 1; c <= Math.min(8, row.cellCount || 8); c++) {
      const val = cleanCellString(row.getCell(c).value)
      if (
        val.includes('REP แบบ INDIVIDUAL') ||
        val.includes('รายงานสรุปการขอเบิกชดเชยค่าการรักษาผู้ป่วยของหน่วยบริการ') ||
        val.includes('รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ')
      ) {
        return true
      }
    }
  }
  return false
}

/**
 * Service for parsing, enriching, and importing Seamless RCM Excel/CSV files
 */
export class RcmSeamlessImportService {
  /**
   * Invalidate all Seamless & dependent RCM caches after mutation
   */
  static invalidateSeamlessCaches(): void {
    invalidateCacheKey('rcm-seamless-stats')
    invalidateCacheKey('rcm-seamless-files')
    invalidateCacheKey('rcm-seamless-deny-codes')
    invalidateCachePattern(/^rcm-seamless-ledger:/)
    invalidateCachePattern(/:seamless-map$/)
    invalidateCachePattern(/^rcm-/)
  }

  /**
   * Parse an Excel Buffer and extract Seamless records, Summary, and Deny Codes
   */
  static async parseWorkbook(
    buffer: Buffer,
    fileName: string,
    options: {
      isDryRun?: boolean
      autoEnrichHosp?: boolean
      updatePayment?: boolean
      filterMyHospOnly?: boolean
      myHospCode?: string
      duplicateMode?: SeamlessDuplicateMode
      executor?: QueryExecutor
    } = {}
  ): Promise<SeamlessParseResult> {
    const startTime = Date.now()
    const isDryRun = Boolean(options.isDryRun)
    const autoEnrichHosp = options.autoEnrichHosp !== false
    const updatePayment = options.updatePayment !== false
    const filterMyHospOnly = options.filterMyHospOnly !== false // FoxPro default: lHospCode = .T.
    const myHospCode = (options.myHospCode || DEFAULT_SEAMLESS_HOSPCODE).trim().padStart(5, '0')
    const duplicateMode: SeamlessDuplicateMode =
      options.duplicateMode === 'skip' ? 'skip' : 'update'
    const exec = options.executor ?? queryClinicalDb

    const workbook = await loadWorkbookFromBuffer(buffer, fileName)

    const processedSheets: string[] = []
    const parsedRows: ParsedSeamlessRow[] = []
    const errors: SeamlessParseError[] = []
    const fundsDetected: Record<string, number> = {}
    let summaryInfo: SeamlessSummaryInfo | null = null
    const denyCodes: SeamlessDenyCode[] = []
    let skippedOtherHospCount = 0
    let foundSummarySheet = false
    let foundDenySheet = false

    // 1. First pass: find and parse SUMMARY sheet (FoxPro AddPay parity)
    for (const sheet of workbook.worksheets) {
      const sheetNameUpper = (sheet.name || '').toUpperCase()
      if (!sheetNameUpper.includes('SUMMARY')) continue
      foundSummarySheet = true
      if (!updatePayment) break

      processedSheets.push(sheet.name)
      let rep = cleanCellString(sheet.getCell('F12').value)
      let payNo = cleanCellString(sheet.getCell('E12').value)
      let repDate = normalizeDate(sheet.getCell('G12').value)

      // Fallback scan rows 8..20 if E12/F12 are empty in newer templates
      if (!rep && !payNo) {
        for (let r = 8; r <= Math.min(20, sheet.rowCount); r++) {
          const row = sheet.getRow(r)
          const cE = cleanCellString(row.getCell(5).value)
          const cF = cleanCellString(row.getCell(6).value)
          const cG = row.getCell(7).value
          if (
            cF &&
            /^[A-Z]{4}\d{4,}/.test(cF.toUpperCase()) &&
            cE &&
            /\d/.test(cE)
          ) {
            payNo = cE
            rep = cF
            repDate = normalizeDate(cG)
            break
          }
        }
      }

      if (rep || payNo) {
        summaryInfo = {
          rep,
          payNo,
          repDate,
          payDate: null,
          codeAccount: null,
        }

        // Cross-reference with nhso_budget via API Gateway
        if (payNo) {
          try {
            const cleanPayNo = payNo.replace(/[^a-zA-Z0-9_-]/g, '')
            if (cleanPayNo) {
              const budgetRows = await exec<{ paydate: string; accountcode: string }>(
                `
                SELECT 
                  DATE_FORMAT(MAX(paydate), '%Y-%m-%d') as paydate,
                  MAX(accountcode) as accountcode
                FROM rcmdb.nhso_budget 
                WHERE payno REGEXP ?
                LIMIT 1
                `,
                [cleanPayNo]
              )
              if (budgetRows.length > 0 && budgetRows[0].paydate) {
                summaryInfo.payDate = budgetRows[0].paydate
                summaryInfo.codeAccount = budgetRows[0].accountcode || null
              }
            }
          } catch (err) {
            logger.warn({ err, payNo }, 'Failed to lookup nhso_budget for payNo')
          }
        }
      }
      break
    }

    // 2. Second pass: find and parse DENY CODE sheet (FoxPro AddError parity)
    for (const sheet of workbook.worksheets) {
      const sheetNameUpper = (sheet.name || '').toUpperCase()
      if (sheetNameUpper.includes('DENY CODE') || sheetNameUpper.includes('DENY_CODE')) {
        foundDenySheet = true
        processedSheets.push(sheet.name)
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return // header
          const code = cleanCellString(row.getCell(1).value)
          const name = cleanCellString(row.getCell(2).value)
          if (code && name && code.toLowerCase() !== 'code' && code !== 'รหัส') {
            denyCodes.push({ code, name })
          }
        })
        break
      }
    }

    // 3. Third pass: process INDIVIDUAL sheets (main Seamless claim rows)
    let foundIndividualSheet = false
    for (const sheet of workbook.worksheets) {
      if (!isIndividualSheet(sheet)) continue

      foundIndividualSheet = true
      processedSheets.push(sheet.name)

      // Find header row (search first 15 rows), supporting 2-row merged subheaders
      let headerRowIndex = -1
      const colMap: Record<string, number> = {}

      for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
        const row = sheet.getRow(r)
        const tempMap: Record<string, number> = {}
        const foundKeywords = mapSeamlessHeaderRow(row, tempMap)

        if (foundKeywords >= 4 && (tempMap.id || tempMap.rep || tempMap.pid)) {
          headerRowIndex = r
          Object.assign(colMap, tempMap)

          // Advance across multi-row merged subheaders (2-3 rows in DKTP/NHSO exports; handles both empty CSV cells and ExcelJS merged master copies)
          const headerIdText = cleanCellString(colMap.id ? row.getCell(colMap.id).value : '')
          const maxSubHeaderRow = Math.min(sheet.rowCount, r + 4)
          while (headerRowIndex + 1 <= maxSubHeaderRow) {
            const nextRow = sheet.getRow(headerRowIndex + 1)
            const nextIdText = cleanCellString(colMap.id ? nextRow.getCell(colMap.id).value : '')
            const nextPidText = cleanCellString(colMap.pid ? nextRow.getCell(colMap.pid).value : '')
            const isIdEmptyOrMergedHeader =
              !nextIdText ||
              nextIdText === headerIdText ||
              /^(trans\s*id|tran\s*id|id)$/i.test(nextIdText)
            const isPidEmptyOrMergedHeader =
              !nextPidText ||
              nextPidText.toLowerCase().includes('pid') ||
              nextPidText.includes('เลขบัตร') ||
              nextPidText.includes('เลขประจำตัว')

            if (!isIdEmptyOrMergedHeader || !isPidEmptyOrMergedHeader) {
              break
            }

            const subMap: Record<string, number> = {}
            const subKeywords = mapSeamlessHeaderRow(nextRow, subMap)
            if (subKeywords < 1) {
              break
            }
            Object.assign(colMap, subMap)
            headerRowIndex++
          }
          break
        }
      }

      // If header not found by keyword, fallback to default FoxPro layout
      if (headerRowIndex === -1) {
        headerRowIndex = 2 // usually row 2 or 3
        colMap.no = 1
        colMap.rep = 2
        colMap.id = 3
        colMap.pid = 4
        colMap.mainInscl = 5
        colMap.admDate = 6
        colMap.sendDate = 7
        colMap.regDate = 8
        colMap.type = 9
        colMap.serialNo = 10
        colMap.collected = 14
        colMap.compensated = 15
        colMap.noCompensated = 16
        colMap.payMore = 17
        colMap.recall = 18
        colMap.hcode = 19
        colMap.hsub = 20
        colMap.hsend = 21
        colMap.stmid = 22
        colMap.equipCode = 23
        colMap.equipName = 24
        colMap.note = 25
      }

      // FoxPro SeekHCode() parity: read sheet-level hospital code from rows above header
      const sheetHCode = await resolveSheetHospCode(
        sheet,
        Math.min(sheet.rowCount, Math.max(1, headerRowIndex - 1)),
        autoEnrichHosp,
        exec
      )

      // Cache column indices outside row loop for fast O(1) lookup
      const idCol = colMap.id || 0
      const repCol = colMap.rep || 0
      const pidCol = colMap.pid || 0
      const admDateCol = colMap.admDate || 0
      const sendDateCol = colMap.sendDate || 0
      const regDateCol = colMap.regDate || 0
      const hcodeCol = colMap.hcode || 0
      const hsubCol = colMap.hsub || 0
      const hsendCol = colMap.hsend || 0
      const collectedCol = colMap.collected || 0
      const compensatedCol = colMap.compensated || 0
      const noCompensatedCol = colMap.noCompensated || 0
      const payMoreCol = colMap.payMore || 0
      const recallCol = colMap.recall || 0
      const hnCol = colMap.hn || 0
      const vnCol = colMap.vn || 0
      const anCol = colMap.an || 0
      const ptnameCol = colMap.ptname || 0
      const statusCol = colMap.status || 0
      const mainInsclCol = colMap.mainInscl || 0
      const typeCol = colMap.type || 0
      const serialNoCol = colMap.serialNo || 0
      const noteCol = colMap.note || 0
      const stmidCol = colMap.stmid || 0
      const equipCodeCol = colMap.equipCode || 0
      const equipNameCol = colMap.equipName || 0

      // Iterate through data rows (stop when footer DENY CODE / column-legend section begins)
      let stopAtFooterLegend = false
      sheet.eachRow((row, rowNumber) => {
        if (stopAtFooterLegend || rowNumber <= headerRowIndex) return

        const id = cleanCellString(idCol ? row.getCell(idCol).value : '')
        const rep = cleanCellString(repCol ? row.getCell(repCol).value : '')

        if (!id && !rep) return

        // Skip any subheader, repeat header, or footer summary/legend rows (FoxPro isdigit(m.id) parity)
        const idLower = id.toLowerCase().replace(/[\s_\-]/g, '')
        const repLower = rep.toLowerCase().replace(/[\s_\-]/g, '')
        if (repLower === 'denycode' || idLower.includes('คำอธิบายรายละเอียด')) {
          stopAtFooterLegend = true
          return
        }
        if (
          idLower === 'transid' ||
          idLower === 'tranid' ||
          idLower === 'id' ||
          idLower === 'รหัส' ||
          repLower === 'rep' ||
          repLower === 'เลขที่rep' ||
          repLower === 'repno'
        ) {
          return
        }
        if (id && !/\d/.test(id)) {
          return
        }

        const pidRaw = cleanCellString(pidCol ? row.getCell(pidCol).value : '')
        if (
          pidRaw.toLowerCase().includes('pid') ||
          pidRaw.includes('เลขบัตร') ||
          pidRaw.includes('เลขประจำตัว')
        ) {
          return
        }

        const pidCleaned = /^null$/i.test(pidRaw) ? '' : pidRaw
        const pidDigits = pidCleaned.replace(/\D/g, '')
        const pid = pidDigits.length === 13 ? pidDigits : pidCleaned

        const admDate = normalizeDate(admDateCol ? row.getCell(admDateCol).value : null)
        const sendDate = normalizeDate(sendDateCol ? row.getCell(sendDateCol).value : null)
        const regDate = normalizeDate(regDateCol ? row.getCell(regDateCol).value : null)

        if (!id) {
          errors.push({
            rowNumber,
            rep,
            field: 'ID',
            reason: 'ไม่พบ TransID หรือ ID สำหรับรายการนี้',
          })
          return
        }

        const rawHcode = cleanCellString(hcodeCol ? row.getCell(hcodeCol).value : '')
        const normalizedRawHcode = extractHospCodeFromText(rawHcode)
        const hcode = normalizedRawHcode || sheetHCode || myHospCode

        // FoxPro lHospCode=.T. parity: skip rows belonging to other hospital codes (hcode <> myHospCode)
        if (filterMyHospOnly && hcode !== myHospCode) {
          skippedOtherHospCount++
          return
        }

        const fund = resolveFundFromRep(rep)
        fundsDetected[fund] = (fundsDetected[fund] || 0) + 1

        const collected = parseNumber(collectedCol ? row.getCell(collectedCol).value : 0)
        const compensated = parseNumber(compensatedCol ? row.getCell(compensatedCol).value : 0)
        const noCompensated = parseNumber(noCompensatedCol ? row.getCell(noCompensatedCol).value : 0)
        const payMore = parseNumber(payMoreCol ? row.getCell(payMoreCol).value : 0)
        const recall = parseNumber(recallCol ? row.getCell(recallCol).value : 0)

        // FoxPro parity: strip trailing "(...)" from HSend (e.g. "06195(รพ.สต....)" -> "06195")
        const rawHsend = cleanCellString(hsendCol ? row.getCell(hsendCol).value : null)
        const hsend = rawHsend ? rawHsend.split('(')[0].trim() || null : null

        const rawHn = normalizeHn(cleanCellString(hnCol ? row.getCell(hnCol).value : null) || null)
        const rawVn = cleanCellString(vnCol ? row.getCell(vnCol).value : null) || null
        const rawAn = normalizeAn(cleanCellString(anCol ? row.getCell(anCol).value : null) || null)
        const rawPtname = cleanCellString(ptnameCol ? row.getCell(ptnameCol).value : null) || null
        const rawStatus = cleanCellString(statusCol ? row.getCell(statusCol).value : null) || null

        const status =
          rawStatus || (compensated > 0 ? 'ชดเชย' : noCompensated > 0 ? 'ไม่ชดเชย' : 'รอดำเนินการ')
        const yymm = admDate ? calculateYYMM(admDate) : ''
        const yearBudget = admDate ? calculateYearBudget(admDate) : ''

        parsedRows.push({
          rowNumber,
          id,
          rep,
          fund,
          period: summaryInfo?.payDate ? calculateYYMM(summaryInfo.payDate) : null,
          vn: rawVn,
          hn: rawHn,
          an: rawAn,
          pid: pid || null,
          ptname: rawPtname,
          admDate,
          sendDate,
          regDate,
          mainInscl: cleanCellString(mainInsclCol ? row.getCell(mainInsclCol).value : null) || null,
          department: rawAn ? 'IP' : 'OP',
          hcode,
          type: cleanCellString(typeCol ? row.getCell(typeCol).value : null) || null,
          serialNo: cleanCellString(serialNoCol ? row.getCell(serialNoCol).value : null) || null,
          collected,
          compensated,
          noCompensated,
          payMore,
          recall,
          status,
          note: cleanCellString(noteCol ? row.getCell(noteCol).value : null) || null,
          stmid: cleanCellString(stmidCol ? row.getCell(stmidCol).value : null) || null,
          codeAccount: summaryInfo?.codeAccount || null,
          equipCode: cleanCellString(equipCodeCol ? row.getCell(equipCodeCol).value : null) || null,
          equipName: cleanCellString(equipNameCol ? row.getCell(equipNameCol).value : null) || null,
          hsub: cleanCellString(hsubCol ? row.getCell(hsubCol).value : null) || null,
          hsend,
          payNo: summaryInfo?.payNo || null,
          payDate: summaryInfo?.payDate || null,
          yymm,
          yearBudget,
          yymmPay: summaryInfo?.payDate ? calculateYYMM(summaryInfo.payDate) : null,
          yearBudgetPay: summaryInfo?.payDate ? calculateYearBudget(summaryInfo.payDate) : null,
          fileName,
        })
      })
    }

    if (!foundIndividualSheet && !foundSummarySheet && !foundDenySheet) {
      throw new Error(
        'ไม่พบชีทข้อมูล INDIVIDUAL หรือส่วนหัว "REP แบบ INDIVIDUAL" ในไฟล์ที่อัปโหลด'
      )
    }

    // 4. Batch HOSxP Enrichment (parallelized chunks for speed): DNAP, CID -> HN/Ptname, HN -> Ptname, VN/AN
    if (autoEnrichHosp && parsedRows.length > 0) {
      const CHUNK_SIZE = 500
      const CONCURRENCY = 4

      // 4a. FoxPro DNAP parity: resolve nap_number -> CID from clinicmember
      const napNumbers = Array.from(
        new Set(
          parsedRows
            .filter(
              (r) =>
                r.rep.toUpperCase().startsWith('DNAP') &&
                r.pid &&
                !/^\d{13}$/.test(r.pid)
            )
            .map((r) => r.pid as string)
        )
      )
      if (napNumbers.length > 0) {
        const napCidMap = new Map<string, string>()
        const napChunks: string[][] = []
        for (let i = 0; i < napNumbers.length; i += CHUNK_SIZE) {
          napChunks.push(napNumbers.slice(i, i + CHUNK_SIZE))
        }
        await runWithConcurrency(napChunks, CONCURRENCY, async (chunk) => {
          const placeholders = chunk.map(() => '?').join(',')
          try {
            const napRows = await exec<{ nap_number: string; cid: string }>(
              `
              SELECT c.nap_number, pt.cid
              FROM clinicmember c
              JOIN patient pt ON pt.hn = c.hn
              WHERE c.nap_number IN (${placeholders})
                AND pt.cid IS NOT NULL AND pt.cid <> ''
              `,
              chunk
            )
            for (const nr of napRows) {
              if (nr.nap_number && nr.cid) {
                napCidMap.set(String(nr.nap_number).trim(), String(nr.cid).trim())
              }
            }
          } catch (err) {
            logger.warn({ err }, 'Batch DNAP nap_number resolution error in Seamless import')
          }
        })
        for (const row of parsedRows) {
          if (row.rep.toUpperCase().startsWith('DNAP') && row.pid && napCidMap.has(row.pid)) {
            row.pid = napCidMap.get(row.pid)!
          }
        }
      }

      // 4b. Resolve HN & Ptname from CID in parallel batches
      const cidsToResolve = Array.from(
        new Set(
          parsedRows
            .filter((r) => r.pid && r.pid.length === 13)
            .map((r) => r.pid as string)
        )
      )

      if (cidsToResolve.length > 0) {
        const patientMap = new Map<string, { hn: string; ptname: string }>()
        const cidChunks: string[][] = []
        for (let i = 0; i < cidsToResolve.length; i += CHUNK_SIZE) {
          cidChunks.push(cidsToResolve.slice(i, i + CHUNK_SIZE))
        }

        await runWithConcurrency(cidChunks, CONCURRENCY, async (chunk) => {
          const placeholders = chunk.map(() => '?').join(',')
          try {
            const rows = await exec<{ cid: string; hn: string; ptname: string }>(
              `
              SELECT 
                cid, 
                hn, 
                TRIM(CONCAT(COALESCE(pname, ''), COALESCE(fname, ''), ' ', COALESCE(lname, ''))) as ptname
              FROM patient
              WHERE cid IN (${placeholders})
              `,
              chunk
            )
            for (const r of rows) {
              if (r.cid) {
                patientMap.set(r.cid, { hn: r.hn, ptname: r.ptname })
              }
            }
          } catch (err) {
            logger.warn({ err }, 'Batch patient resolution error in Seamless import')
          }
        })

        for (const row of parsedRows) {
          if (row.pid && patientMap.has(row.pid)) {
            const pt = patientMap.get(row.pid)!
            if (!row.hn) row.hn = normalizeHn(pt.hn)
            if (!row.ptname) row.ptname = pt.ptname
          }
        }
      }

      // 4c. Fallback: resolve Ptname/CID from HN when Excel already had HN without Ptname/CID
      const hnsMissingInfo = Array.from(
        new Set(
          parsedRows
            .filter((r) => r.hn && (!r.ptname || !r.pid))
            .map((r) => r.hn as string)
        )
      )
      if (hnsMissingInfo.length > 0) {
        const hnPatientMap = new Map<string, { cid: string; ptname: string }>()
        const hnInfoChunks: string[][] = []
        for (let i = 0; i < hnsMissingInfo.length; i += CHUNK_SIZE) {
          hnInfoChunks.push(hnsMissingInfo.slice(i, i + CHUNK_SIZE))
        }
        await runWithConcurrency(hnInfoChunks, CONCURRENCY, async (chunk) => {
          const placeholders = chunk.map(() => '?').join(',')
          try {
            const rows = await exec<{ hn: string; cid: string; ptname: string }>(
              `
              SELECT 
                hn,
                cid,
                TRIM(CONCAT(COALESCE(pname, ''), COALESCE(fname, ''), ' ', COALESCE(lname, ''))) as ptname
              FROM patient
              WHERE hn IN (${placeholders})
              `,
              chunk
            )
            for (const r of rows) {
              if (r.hn) {
                hnPatientMap.set(normalizeHn(r.hn) || r.hn, { cid: r.cid, ptname: r.ptname })
              }
            }
          } catch (err) {
            logger.warn({ err }, 'Batch HN patient resolution error in Seamless import')
          }
        })
        for (const row of parsedRows) {
          if (row.hn && hnPatientMap.has(row.hn)) {
            const pt = hnPatientMap.get(row.hn)!
            if (!row.pid && pt.cid) row.pid = pt.cid
            if (!row.ptname && pt.ptname) row.ptname = pt.ptname
          }
        }
      }

      // 4d. Resolve VN (ovst) and AN (ipt) for ALL rows that have HN and AdmDate (independent of CID count)
      const hnDatePairs = parsedRows
        .filter((r) => r.hn && r.admDate && (!r.vn || !r.an))
        .map((r) => ({ hn: r.hn as string, date: r.admDate as string }))

      if (hnDatePairs.length > 0) {
        const vnMap = new Map<string, string>()
        const uniqueHns = Array.from(new Set(hnDatePairs.map((p) => p.hn)))
        const minDate = hnDatePairs.reduce((min, p) => (p.date < min ? p.date : min), hnDatePairs[0].date)
        const maxDate = hnDatePairs.reduce((max, p) => (p.date > max ? p.date : max), hnDatePairs[0].date)

        const hnChunks: string[][] = []
        for (let i = 0; i < uniqueHns.length; i += CHUNK_SIZE) {
          hnChunks.push(uniqueHns.slice(i, i + CHUNK_SIZE))
        }

        await runWithConcurrency(hnChunks, CONCURRENCY, async (hnChunk) => {
          const placeholders = hnChunk.map(() => '?').join(',')
          try {
            const ovstRows = await exec<{ vn: string; hn: string; vstdate: string }>(
              `
              SELECT vn, hn, DATE_FORMAT(vstdate, '%Y-%m-%d') as vstdate
              FROM ovst
              WHERE hn IN (${placeholders})
                AND vstdate BETWEEN ? AND ?
              `,
              [...hnChunk, minDate, maxDate]
            )
            for (const o of ovstRows) {
              const normHn = normalizeHn(o.hn) || o.hn
              vnMap.set(`${normHn}_${o.vstdate}`, o.vn)
            }
          } catch (err) {
            logger.warn({ err }, 'Batch visit (VN) resolution error in Seamless import')
          }
        })

        for (const row of parsedRows) {
          if (row.hn && row.admDate && !row.vn) {
            const key = `${row.hn}_${row.admDate}`
            if (vnMap.has(key)) {
              row.vn = vnMap.get(key)!
            }
          }
        }

        // Fallback IPD (AN) resolution for rows that did not match an OPD visit
        const unmatchedIpdRows = parsedRows.filter((r) => r.hn && r.admDate && !r.vn && !r.an)
        if (unmatchedIpdRows.length > 0) {
          const anMap = new Map<string, string>()
          const ipdHns = Array.from(new Set(unmatchedIpdRows.map((r) => r.hn as string)))
          const ipdMinDate = unmatchedIpdRows.reduce(
            (min, r) => ((r.admDate as string) < min ? (r.admDate as string) : min),
            unmatchedIpdRows[0].admDate as string
          )
          const ipdMaxDate = unmatchedIpdRows.reduce(
            (max, r) => ((r.admDate as string) > max ? (r.admDate as string) : max),
            unmatchedIpdRows[0].admDate as string
          )

          const ipdChunks: string[][] = []
          for (let i = 0; i < ipdHns.length; i += CHUNK_SIZE) {
            ipdChunks.push(ipdHns.slice(i, i + CHUNK_SIZE))
          }

          await runWithConcurrency(ipdChunks, CONCURRENCY, async (hnChunk) => {
            const placeholders = hnChunk.map(() => '?').join(',')
            try {
              const iptRows = await exec<{ an: string; hn: string; regdate: string }>(
                `
                SELECT an, hn, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate
                FROM ipt
                WHERE hn IN (${placeholders})
                  AND regdate BETWEEN ? AND ?
                `,
                [...hnChunk, ipdMinDate, ipdMaxDate]
              )
              for (const ip of iptRows) {
                if (ip.an && ip.hn && ip.regdate) {
                  const normHn = normalizeHn(ip.hn) || ip.hn
                  anMap.set(`${normHn}_${ip.regdate}`, normalizeAn(ip.an) || ip.an)
                }
              }
            } catch (err) {
              logger.warn({ err }, 'Batch IPD (AN) resolution error in Seamless import')
            }
          })

          for (const row of unmatchedIpdRows) {
            const key = `${row.hn}_${row.admDate}`
            if (anMap.has(key)) {
              row.an = anMap.get(key)!
              row.department = 'IP'
            }
          }
        }
      }
    }

    // 5. Deduplicate rows within the same file by ID (PK of rcmdb.seamless)
    const uniqueRowMap = new Map<string, ParsedSeamlessRow>()
    for (const row of parsedRows) {
      uniqueRowMap.set(row.id, row)
    }
    const uniqueRows = Array.from(uniqueRowMap.values())
    const duplicateInFileCount = parsedRows.length - uniqueRows.length

    // 6. Parallel pre-flight duplicate detection (FileName count + existing IDs)
    let existingFileRowCount = 0
    const existingIdSet = new Set<string>()
    if (uniqueRows.length > 0) {
      const CHECK_CHUNK = 500
      const allIds = uniqueRows.map((r) => r.id)
      const idChunks: string[][] = []
      for (let i = 0; i < allIds.length; i += CHECK_CHUNK) {
        idChunks.push(allIds.slice(i, i + CHECK_CHUNK))
      }

      await Promise.all([
        (async () => {
          try {
            const fileCheckRows = await exec<{ cnt: number }>(
              'SELECT COUNT(*) AS cnt FROM rcmdb.seamless WHERE FileName = ?',
              [fileName]
            )
            existingFileRowCount = Number(fileCheckRows?.[0]?.cnt || 0)
          } catch {
            existingFileRowCount = 0
          }
        })(),
        runWithConcurrency(idChunks, 4, async (idChunk) => {
          const placeholders = idChunk.map(() => '?').join(',')
          try {
            const existingRows = await exec<{ ID?: string; id?: string }>(
              `SELECT ID FROM rcmdb.seamless WHERE ID IN (${placeholders})`,
              idChunk
            )
            for (const er of existingRows || []) {
              const existingId = er.ID ?? er.id
              if (existingId) existingIdSet.add(String(existingId).trim())
            }
          } catch {
            // Non-blocking pre-flight check
          }
        }),
      ])
    }

    const existingInDbCount = existingIdSet.size
    const newInDbCount = Math.max(0, uniqueRows.length - existingInDbCount)

    // 7. Persist to rcmdb.seamless via API Gateway when NOT in Dry Run mode
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    if (!isDryRun) {
      const summaryUpdate =
        updatePayment && summaryInfo?.rep && summaryInfo?.payNo
          ? {
              rep: summaryInfo.rep,
              payNo: summaryInfo.payNo,
              payDate: summaryInfo.payDate,
              yymmPay: summaryInfo.payDate ? calculateYYMM(summaryInfo.payDate) : null,
              yearBudgetPay: summaryInfo.payDate ? calculateYearBudget(summaryInfo.payDate) : null,
              period: summaryInfo.payDate ? calculateYYMM(summaryInfo.payDate) : null,
              codeAccount: summaryInfo.codeAccount,
            }
          : null

      if (uniqueRows.length > 0) {
        const persistRes = await RcmSeamlessImportService.persistSeamlessRows(
          uniqueRows,
          duplicateMode,
          {
            denyCodes: denyCodes.length > 0 ? denyCodes : undefined,
            summaryUpdate,
          }
        )
        insertedCount = persistRes.insertedCount
        updatedCount = persistRes.updatedCount
        skippedCount = persistRes.skippedCount

        if (insertedCount > 0 || updatedCount > 0 || denyCodes.length > 0 || summaryUpdate) {
          RcmSeamlessImportService.invalidateSeamlessCaches()
        }
      } else if (denyCodes.length > 0 || summaryUpdate) {
        // FoxPro AddPay / AddError parity for SUMMARY-only or DENY CODE-only files
        if (denyCodes.length > 0) {
          await RcmSeamlessImportService.withGatewayRetry(
            () =>
              apiGateway.clinical.importSeamlessRecords([], duplicateMode, {
                denyCodes,
                summaryUpdate,
              }),
            'seamless_deny_summary_only'
          )
        } else if (summaryUpdate) {
          await RcmSeamlessImportService.withGatewayRetry(
            () =>
              apiGateway.clinical.syncSeamlessPayment({
                rep: summaryUpdate.rep,
                payNo: summaryUpdate.payNo,
                payDate: summaryUpdate.payDate,
                codeAccount: summaryUpdate.codeAccount,
              }),
            'seamless_summary_payment_sync'
          )
        }
        RcmSeamlessImportService.invalidateSeamlessCaches()
      }
    }

    // Compute accurate summary metrics and fund breakdown across ALL unique parsed rows
    let totalCompensation = 0
    let matchedPatientsHOSxP = 0
    let matchedVnsHOSxP = 0
    const uniquePatientsSet = new Set<string>()
    const fundBreakdownMap = new Map<string, SeamlessFundBreakdownItem>()

    for (const row of uniqueRows) {
      totalCompensation += row.compensated || 0
      if (row.pid) uniquePatientsSet.add(row.pid)
      if (row.hn) matchedPatientsHOSxP++
      if (row.vn || row.an) matchedVnsHOSxP++

      const fundCode = resolveFundCodeFromNameOrRep(row.rep || row.fund)
      const existingFund = fundBreakdownMap.get(row.fund) || {
        fundCode,
        fundName: row.fund,
        count: 0,
        totalCollected: 0,
        totalCompensated: 0,
      }
      existingFund.count += 1
      existingFund.totalCollected = Math.round((existingFund.totalCollected + (row.collected || 0)) * 100) / 100
      existingFund.totalCompensated = Math.round((existingFund.totalCompensated + (row.compensated || 0)) * 100) / 100
      fundBreakdownMap.set(row.fund, existingFund)
    }

    const summary: SeamlessSummaryMetrics = {
      totalCompensation: Math.round(totalCompensation * 100) / 100,
      uniquePatients: uniquePatientsSet.size,
      uniqueFunds: Object.keys(fundsDetected),
      matchedPatientsHOSxP,
      matchedVnsHOSxP,
    }

    const executionTimeMs = Date.now() - startTime

    return {
      fileName,
      fileSizeBytes: buffer.length,
      totalSheets: workbook.worksheets.length,
      processedSheets,
      totalRows: parsedRows.length + errors.length,
      validRows: uniqueRows.length,
      errorRows: errors.length,
      fundsDetected,
      fundBreakdown: Array.from(fundBreakdownMap.values()),
      summaryInfo,
      denyCodes,
      previewRows: uniqueRows.slice(0, 50),
      errors,
      summary,
      executionTimeMs,
      isDryRun,
      filterMyHospOnly,
      duplicateMode,
      insertedCount,
      updatedCount,
      skippedCount,
      skippedOtherHospCount,
      existingInDbCount,
      newInDbCount,
      duplicateInFileCount,
      isAlreadyImported: existingFileRowCount > 0 || existingInDbCount > 0,
      existingFileRowCount,
    }
  }

  /**
   * Retry an idempotent Gateway operation on transient GatewayUnavailableError
   * (e.g., keep-alive socket reset / ECONNRESET / temporary 503 during large multi-file batches).
   */
  private static async withGatewayRetry<T>(
    operation: () => Promise<T>,
    contextLabel: string,
    maxRetries = 2
  ): Promise<T> {
    const baseDelayMs = process.env.VITEST ? 0 : 350
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (err: unknown) {
        lastError = err
        if (!(err instanceof GatewayUnavailableError) || attempt >= maxRetries) {
          throw err
        }
        const delayMs = baseDelayMs * (attempt + 1)
        logger.warn(
          { attempt: attempt + 1, maxRetries, delayMs, contextLabel, err: err.message },
          'Transient GatewayUnavailableError during Seamless persistence, retrying chunk'
        )
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    throw lastError
  }

  /**
   * Persist parsed Seamless rows into `rcmdb.seamless` via the API Gateway Named API.
   * Uses 250-row chunks (~180-280 KB JSON) to stay safely under Fastify's bodyLimit,
   * shorten MyISAM write lock durations, and retry transient socket/gateway drops.
   */
  static async persistSeamlessRows(
    rows: ParsedSeamlessRow[],
    duplicateMode: SeamlessDuplicateMode = 'update',
    extras?: {
      denyCodes?: SeamlessDenyCode[]
      summaryUpdate?: {
        rep: string
        payNo: string
        payDate: string | null
        yymmPay: string | null
        yearBudgetPay: string | null
        period: string | null
        codeAccount: string | null
      } | null
    }
  ): Promise<{ insertedCount: number; updatedCount: number; skippedCount: number }> {
    if (rows.length === 0) {
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 }
    }

    const CHUNK_SIZE = 250
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)
        const isLastChunk = i + CHUNK_SIZE >= rows.length
        const hasExtras =
          isLastChunk && ((extras?.denyCodes && extras.denyCodes.length > 0) || extras?.summaryUpdate)

        const payloadRows = chunk.map((r) => ({
          yymm: r.yymm,
          yearBudget: r.yearBudget,
          id: r.id,
          fund: r.fund,
          period: r.period,
          rep: r.rep,
          vn: r.vn,
          hn: r.hn,
          an: r.an,
          pid: r.pid,
          ptname: r.ptname,
          admDate: r.admDate,
          mainInscl: r.mainInscl,
          department: r.department,
          hcode: r.hcode,
          type: r.type,
          serialNo: r.serialNo,
          regDate: r.regDate,
          sendDate: r.sendDate,
          payNo: r.payNo,
          payDate: r.payDate,
          yymmPay: r.yymmPay,
          yearBudgetPay: r.yearBudgetPay,
          collected: r.collected,
          compensated: r.compensated,
          noCompensated: r.noCompensated,
          payMore: r.payMore,
          recall: r.recall,
          status: r.status,
          note: r.note,
          stmid: r.stmid,
          codeAccount: r.codeAccount,
          equipCode: r.equipCode,
          equipName: r.equipName,
          hsub: r.hsub,
          hsend: r.hsend,
          fileName: r.fileName,
        }))

        const res = await RcmSeamlessImportService.withGatewayRetry(
          () =>
            hasExtras
              ? apiGateway.clinical.importSeamlessRecords(payloadRows, duplicateMode, extras)
              : apiGateway.clinical.importSeamlessRecords(payloadRows, duplicateMode),
          `persistSeamlessRows_chunk_${Math.floor(i / CHUNK_SIZE) + 1}`
        )

        insertedCount += Number(res?.insertedCount || 0)
        updatedCount += Number(res?.updatedCount || 0)
        skippedCount += Number(res?.skippedCount || 0)
      }

      return { insertedCount, updatedCount, skippedCount }
    } catch (err: unknown) {
      if (err instanceof GatewayNotFoundError) {
        throw new Error(
          'API Gateway ยังไม่รองรับการบันทึกข้อมูล Seamless (/api/v1/clinical/rcm/seamless/import) กรุณาอัปเดต API Gateway ก่อนนำเข้าข้อมูลจริง'
        )
      }
      throw err
    }
  }

  /**
   * Fetch current stats from database (rcmdb.seamless) with 60s In-Memory Cache
   */
  static async getSeamlessDatabaseStats(
    executor: QueryExecutor = queryClinicalDb,
    refresh = false
  ): Promise<SeamlessDatabaseStats> {
    const cacheKey = 'rcm-seamless-stats'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        try {
          const [summaryRows, topFunds, recentFiles, extraHealthRows, denyCountRows] = await Promise.all([
            executor(`
          SELECT 
            COUNT(*) as totalRows,
            COUNT(DISTINCT Rep) as totalReps,
            COUNT(DISTINCT FileName) as totalFiles,
            DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') as latestAdmDate,
            COALESCE(SUM(Compensated), 0) as totalCompensated
          FROM rcmdb.seamless
        `),
            executor(`
          SELECT 
            Fund as fund,
            COUNT(*) as rowCount,
            COALESCE(SUM(Compensated), 0) as totalCompensated
          FROM rcmdb.seamless
          GROUP BY Fund
          ORDER BY rowCount DESC
          LIMIT 10
        `),
            executor(`
          SELECT 
            FileName as fileName,
            COUNT(*) as rowCount,
            DATE_FORMAT(MIN(AdmDate), '%Y-%m-%d') as minDate,
            DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') as maxDate,
            COALESCE(SUM(Compensated), 0) as totalCompensated
          FROM rcmdb.seamless
          WHERE FileName IS NOT NULL AND FileName <> ''
          GROUP BY FileName
          ORDER BY MAX(AdmDate) DESC
          LIMIT 10
        `),
            executor(`
          SELECT
            SUM(CASE WHEN LPAD(TRIM(IFNULL(HCode, '')), 5, '0') <> '${DEFAULT_SEAMLESS_HOSPCODE}' THEN 1 ELSE 0 END) AS otherHospCount,
            SUM(CASE WHEN PayDate IS NULL THEN 1 ELSE 0 END) AS missingPayDateCount
          FROM rcmdb.seamless
        `).catch(() => [] as { otherHospCount: number; missingPayDateCount: number }[]),
            executor(`
          SELECT COUNT(*) AS denyCodeCount FROM rcmdb.seamless_error
        `).catch(() => [] as { denyCodeCount: number }[]),
          ])

          const summary = summaryRows[0] || {
            totalRows: 0,
            totalReps: 0,
            totalFiles: 0,
            latestAdmDate: null,
            totalCompensated: 0,
          }
          const extra = extraHealthRows[0]
          const deny = denyCountRows[0]

          return {
            totalRows: Number(summary.totalRows || 0),
            totalReps: Number(summary.totalReps || 0),
            totalFiles: Number(summary.totalFiles || 0),
            latestAdmDate: summary.latestAdmDate || null,
            totalCompensated: Number(summary.totalCompensated || 0),
            otherHospCount: Number(extra?.otherHospCount || 0),
            missingPayDateCount: Number(extra?.missingPayDateCount || 0),
            denyCodeCount: Number(deny?.denyCodeCount || 0),
            myHospCode: DEFAULT_SEAMLESS_HOSPCODE,
            topFunds: topFunds.map((f) => ({
              fund: f.fund || 'ไม่ระบุกองทุน',
              rowCount: Number(f.rowCount || 0),
              totalCompensated: Number(f.totalCompensated || 0),
            })),
            recentFiles: recentFiles.map((rf) => ({
              fileName: rf.fileName,
              rowCount: Number(rf.rowCount || 0),
              minDate: rf.minDate,
              maxDate: rf.maxDate,
              totalCompensated: Number(rf.totalCompensated || 0),
            })),
          }
        } catch (err) {
          logger.error({ err }, 'Failed to fetch seamless database statistics')
          return {
            totalRows: 0,
            totalReps: 0,
            totalFiles: 0,
            latestAdmDate: null,
            totalCompensated: 0,
            otherHospCount: 0,
            missingPayDateCount: 0,
            denyCodeCount: 0,
            myHospCode: DEFAULT_SEAMLESS_HOSPCODE,
            topFunds: [],
            recentFiles: [],
          }
        }
      },
      60_000
    )
  }

  /**
   * Server-paginated ledger of `rcmdb.seamless` records (50 rows/page, 5-Pillar compliant)
   */
  static async getSeamlessLedger(
    params: SeamlessLedgerQueryParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<SeamlessLedgerResult> {
    const myHospCode = (params.myHospCode || DEFAULT_SEAMLESS_HOSPCODE).trim().padStart(5, '0')
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = params.exportAll ? 50000 : Math.min(200, Math.max(1, Number(params.pageSize || 50)))
    const search = (params.search || '').trim()
    const fundFilter = (params.fundFilter || 'ALL').trim()
    const hospFilter: SeamlessHospFilter =
      params.hospFilter === 'MINE' || params.hospFilter === 'OTHER' ? params.hospFilter : 'ALL'
    const payStatus: SeamlessPayStatusFilter =
      params.payStatus === 'PAID' || params.payStatus === 'UNPAID' ? params.payStatus : 'ALL'
    const fileName = (params.fileName || '').trim()
    const sortBy: SeamlessLedgerSortField = params.sortBy || 'admDate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc'

    const cacheKey = `rcm-seamless-ledger:${JSON.stringify({
      page,
      pageSize,
      exportAll: Boolean(params.exportAll),
      search,
      fundFilter,
      hospFilter,
      payStatus,
      fileName,
      sortBy,
      sortOrder,
      myHospCode,
    })}`

    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        const whereClauses: string[] = ['1=1']
        const queryParams: unknown[] = []

        if (search) {
          const like = `%${search}%`
          whereClauses.push(
            `(ID LIKE ? OR Rep LIKE ? OR HN LIKE ? OR VN LIKE ? OR AN LIKE ? OR PID LIKE ? OR Ptname LIKE ? OR PayNo LIKE ? OR FileName LIKE ? OR Fund LIKE ?)`
          )
          queryParams.push(like, like, like, like, like, like, like, like, like, like)
        }

        if (fundFilter && fundFilter !== 'ALL') {
          whereClauses.push('Fund = ?')
          queryParams.push(fundFilter)
        }

        if (hospFilter === 'MINE') {
          whereClauses.push(`LPAD(TRIM(IFNULL(HCode, '')), 5, '0') = ?`)
          queryParams.push(myHospCode)
        } else if (hospFilter === 'OTHER') {
          whereClauses.push(`LPAD(TRIM(IFNULL(HCode, '')), 5, '0') <> ?`)
          queryParams.push(myHospCode)
        }

        if (payStatus === 'PAID') {
          whereClauses.push('PayDate IS NOT NULL')
        } else if (payStatus === 'UNPAID') {
          whereClauses.push('PayDate IS NULL')
        }

        if (fileName) {
          whereClauses.push('FileName = ?')
          queryParams.push(fileName)
        }

        const whereSql = whereClauses.join(' AND ')

        const sortColumnMap: Record<SeamlessLedgerSortField, string> = {
          admDate: 'AdmDate',
          id: 'ID',
          rep: 'Rep',
          fund: 'Fund',
          hn: 'HN',
          ptname: 'Ptname',
          collected: 'Collected',
          compensated: 'Compensated',
          payDate: 'PayDate',
          fileName: 'FileName',
        }
        const sortCol = sortColumnMap[sortBy] || 'AdmDate'
        const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
        const offset = (page - 1) * pageSize

        const [countRows, itemRows, fundRows] = await Promise.all([
          executor(
            `SELECT COUNT(*) AS cnt FROM rcmdb.seamless WHERE ${whereSql}`,
            queryParams
          ),
          executor(
            `
            SELECT
              ID AS id,
              YYMM AS yymm,
              YearBudget AS yearBudget,
              Fund AS fund,
              Period AS period,
              Rep AS rep,
              VN AS vn,
              HN AS hn,
              AN AS an,
              PID AS pid,
              Ptname AS ptname,
              DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admDate,
              DATE_FORMAT(SendDate, '%Y-%m-%d') AS sendDate,
              DATE_FORMAT(RegDate, '%Y-%m-%d') AS regDate,
              MainInscl AS mainInscl,
              Department AS department,
              HCode AS hcode,
              HSub AS hsub,
              HSend AS hsend,
              Type AS type,
              SerialNo AS serialNo,
              PayNo AS payNo,
              DATE_FORMAT(PayDate, '%Y-%m-%d') AS payDate,
              YYMM_Pay AS yymmPay,
              YearBudget_Pay AS yearBudgetPay,
              CodeAccount AS codeAccount,
              COALESCE(Collected, 0) AS collected,
              COALESCE(Compensated, 0) AS compensated,
              COALESCE(NoCompensated, 0) AS noCompensated,
              COALESCE(PayMore, 0) AS payMore,
              COALESCE(Recall, 0) AS recall,
              Status AS status,
              Note AS note,
              STMID AS stmid,
              EquipCode AS equipCode,
              EquipName AS equipName,
              FileName AS fileName
            FROM rcmdb.seamless
            WHERE ${whereSql}
            ORDER BY ${sortCol} ${dir}, ID DESC
            LIMIT ? OFFSET ?
            `,
            [...queryParams, pageSize, offset]
          ),
          executor(
            `SELECT DISTINCT Fund AS fund FROM rcmdb.seamless WHERE IFNULL(Fund, '') <> '' ORDER BY Fund ASC`
          ).catch(() => [] as { fund: string }[]),
        ])

        const totalCount = Number(countRows?.[0]?.cnt || 0)
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

        const items: SeamlessLedgerItem[] = (itemRows || []).map((r: Record<string, unknown>) => {
          const hcodeRaw = r.hcode ? String(r.hcode).trim() : null
          const normalizedHcode = hcodeRaw ? hcodeRaw.padStart(5, '0') : null
          return {
            id: String(r.id || ''),
            yymm: r.yymm ? String(r.yymm) : null,
            yearBudget: r.yearBudget ? String(r.yearBudget) : null,
            fund: r.fund ? String(r.fund) : 'ไม่ระบุกองทุน',
            period: r.period ? String(r.period) : null,
            rep: String(r.rep || ''),
            vn: r.vn ? String(r.vn).trim() : null,
            hn: r.hn ? String(r.hn).trim() : null,
            an: r.an ? String(r.an).trim() : null,
            pid: r.pid ? String(r.pid).trim() : null,
            ptname: r.ptname ? String(r.ptname).trim() : null,
            admDate: r.admDate ? String(r.admDate) : null,
            sendDate: r.sendDate ? String(r.sendDate) : null,
            regDate: r.regDate ? String(r.regDate) : null,
            mainInscl: r.mainInscl ? String(r.mainInscl).trim() : null,
            department: r.department ? String(r.department).trim() : null,
            hcode: hcodeRaw,
            hsub: r.hsub ? String(r.hsub).trim() : null,
            hsend: r.hsend ? String(r.hsend).trim() : null,
            type: r.type ? String(r.type).trim() : null,
            serialNo: r.serialNo ? String(r.serialNo).trim() : null,
            payNo: r.payNo ? String(r.payNo).trim() : null,
            payDate: r.payDate ? String(r.payDate) : null,
            yymmPay: r.yymmPay ? String(r.yymmPay) : null,
            yearBudgetPay: r.yearBudgetPay ? String(r.yearBudgetPay) : null,
            codeAccount: r.codeAccount ? String(r.codeAccount).trim() : null,
            collected: Number(r.collected || 0),
            compensated: Number(r.compensated || 0),
            noCompensated: Number(r.noCompensated || 0),
            payMore: Number(r.payMore || 0),
            recall: Number(r.recall || 0),
            status: r.status ? String(r.status).trim() : null,
            note: r.note ? String(r.note).trim() : null,
            stmid: r.stmid ? String(r.stmid).trim() : null,
            equipCode: r.equipCode ? String(r.equipCode).trim() : null,
            equipName: r.equipName ? String(r.equipName).trim() : null,
            fileName: r.fileName ? String(r.fileName).trim() : null,
            isOtherHosp: Boolean(normalizedHcode && normalizedHcode !== myHospCode),
          }
        })

        return {
          items,
          totalCount,
          totalPages,
          page,
          pageSize,
          availableFunds: (fundRows || []).map((f) => String(f.fund)).filter(Boolean),
          myHospCode,
        }
      },
      60_000
    )
  }

  /**
   * List all imported Seamless files grouped by FileName
   */
  static async getSeamlessImportedFiles(
    executor: QueryExecutor = queryClinicalDb,
    refresh = false
  ): Promise<SeamlessImportedFileDetail[]> {
    const cacheKey = 'rcm-seamless-files'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        const rows = await executor(`
          SELECT
            FileName AS fileName,
            COUNT(*) AS rowCount,
            COUNT(DISTINCT Rep) AS repCount,
            DATE_FORMAT(MIN(AdmDate), '%Y-%m-%d') AS minDate,
            DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') AS maxDate,
            COALESCE(SUM(Collected), 0) AS totalCollected,
            COALESCE(SUM(Compensated), 0) AS totalCompensated,
            SUM(CASE WHEN LPAD(TRIM(IFNULL(HCode, '')), 5, '0') <> '${DEFAULT_SEAMLESS_HOSPCODE}' THEN 1 ELSE 0 END) AS otherHospCount,
            SUM(CASE WHEN PayDate IS NULL THEN 1 ELSE 0 END) AS missingPayDateCount
          FROM rcmdb.seamless
          WHERE FileName IS NOT NULL AND FileName <> ''
          GROUP BY FileName
          ORDER BY MAX(AdmDate) DESC, FileName ASC
        `)
        return (rows || []).map((r: Record<string, unknown>) => ({
          fileName: String(r.fileName || ''),
          rowCount: Number(r.rowCount || 0),
          repCount: Number(r.repCount || 0),
          minDate: r.minDate ? String(r.minDate) : null,
          maxDate: r.maxDate ? String(r.maxDate) : null,
          totalCollected: Number(r.totalCollected || 0),
          totalCompensated: Number(r.totalCompensated || 0),
          otherHospCount: Number(r.otherHospCount || 0),
          missingPayDateCount: Number(r.missingPayDateCount || 0),
        }))
      },
      60_000
    )
  }

  /**
   * List DENY CODE dictionary from `rcmdb.seamless_error`
   */
  static async getSeamlessDenyCodes(
    search = '',
    executor: QueryExecutor = queryClinicalDb,
    refresh = false
  ): Promise<SeamlessDenyCode[]> {
    const cacheKey = 'rcm-seamless-deny-codes'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    const allCodes = await getCachedData(
      cacheKey,
      async () => {
        try {
          const rows = await executor(`
            SELECT Code, Name
            FROM rcmdb.seamless_error
            ORDER BY Code ASC
          `)
          return (rows || []).map((r: { Code?: string; code?: string; Name?: string; name?: string }) => ({
            code: String(r.Code ?? r.code ?? '').trim(),
            name: String(r.Name ?? r.name ?? '').trim(),
          })).filter((r: SeamlessDenyCode) => r.code)
        } catch (err) {
          logger.warn({ err }, 'Failed to query rcmdb.seamless_error')
          return [] as SeamlessDenyCode[]
        }
      },
      300_000
    )

    const term = search.trim().toLowerCase()
    if (!term) return allCodes
    return allCodes.filter(
      (c) => c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
    )
  }

  /**
   * Delete Seamless records via API Gateway (FoxPro cmdDel / cmdTable.RightClick / CalDelete parity)
   */
  static async deleteSeamlessRecords(payload: {
    mode: 'by_file' | 'by_files' | 'other_hospitals' | 'all'
    fileName?: string
    fileNames?: string[]
    myHospCode?: string
  }): Promise<{ deletedCount: number }> {
    try {
      const res = await apiGateway.clinical.deleteSeamlessRecords(payload)
      RcmSeamlessImportService.invalidateSeamlessCaches()
      return { deletedCount: Number(res?.deletedCount || 0) }
    } catch (err: unknown) {
      if (err instanceof GatewayNotFoundError) {
        throw new Error(
          'API Gateway ยังไม่รองรับคำสั่งลบข้อมูล Seamless (/api/v1/clinical/rcm/seamless/records) กรุณาอัปเดต API Gateway ก่อนใช้งาน'
        )
      }
      throw err
    }
  }

  /**
   * Sync PayDate & CodeAccount from nhso_budget and backfill YYMM / YearBudget (FoxPro AddPay parity)
   */
  static async syncSeamlessPaymentDates(payload?: {
    rep?: string
    payNo?: string
    payDate?: string | null
    codeAccount?: string | null
    force?: boolean
  }): Promise<{ updatedPaymentCount: number; backfilledDateCount: number }> {
    try {
      const res = await apiGateway.clinical.syncSeamlessPayment(payload)
      RcmSeamlessImportService.invalidateSeamlessCaches()
      return {
        updatedPaymentCount: Number(res?.updatedPaymentCount || 0),
        backfilledDateCount: Number(res?.backfilledDateCount || 0),
      }
    } catch (err: unknown) {
      if (err instanceof GatewayNotFoundError) {
        throw new Error(
          'API Gateway ยังไม่รองรับการซิงค์วันที่โอน Seamless (/api/v1/clinical/rcm/seamless/sync-payment) กรุณาอัปเดต API Gateway ก่อนใช้งาน'
        )
      }
      throw err
    }
  }
}
