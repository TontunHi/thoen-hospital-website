import ExcelJS from 'exceljs'
import { CellError, readXls } from 'xls-reader'
import { apiGateway } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'

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
export const FUND_NAME_TO_CODE_MAP: Record<string, string> = Object.entries(SEAMLESS_FUND_MAP).reduce(
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
export function unwrapCellValue(val: unknown): unknown {
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
export async function runWithConcurrency<T>(
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
export async function resolveSheetHospCode(
  sheet: ExcelJS.Worksheet,
  maxSearchRow: number,
  autoEnrichHosp: boolean,
  hospCodeResolver: (hospName: string) => Promise<string> = async (hospName) => {
    const res = await apiGateway.clinical.resolveSeamlessHospCode(hospName)
    return res?.hospcode || ''
  }
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
      const code = await hospCodeResolver(hospNameCandidate)
      if (code) {
        return String(code).trim()
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
export function decodeTextBuffer(buffer: Buffer): string {
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
 * Parse RFC-4180 CSV/TSV text into rows of cell strings (handles quoted commas like "VCTID,NAPNumber,PID")
 */
export function parseCsvRows(text: string, delimiter = ','): string[][] {
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
    } else if (ch === delimiter) {
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

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
}

export function parseHtmlTableRows(html: string): string[][] {
  const rows: string[][] = []
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null

  while ((trMatch = trRegex.exec(html)) !== null) {
    const row: string[] = []
    const tdRegex = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi
    let tdMatch: RegExpExecArray | null

    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      const attrs = tdMatch[1] || ''
      const rawCell = tdMatch[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
      row.push(decodeHtmlEntities(rawCell).replace(/\s+/g, ' ').trim())

      const colspanMatch = /\bcolspan\s*=\s*["']?(\d+)/i.exec(attrs)
      const colspan = colspanMatch ? Math.min(Number(colspanMatch[1]), 50) : 1
      for (let c = 1; c < colspan; c++) row.push('')
    }

    if (row.some((cell) => cell.length > 0)) {
      rows.push(row)
    }
  }

  return rows
}

export function parseSpreadsheetXmlSheets(xml: string): Array<{ name: string; rows: string[][] }> {
  const sheets: Array<{ name: string; rows: string[][] }> = []
  const wsRegex = /<Worksheet\b([^>]*)>([\s\S]*?)<\/Worksheet>/gi
  const wsMatches: Array<{ name: string; body: string }> = []
  let wsMatch: RegExpExecArray | null

  while ((wsMatch = wsRegex.exec(xml)) !== null) {
    const nameMatch = /\bss:Name\s*=\s*"([^"]*)"/i.exec(wsMatch[1] || '')
    wsMatches.push({
      name: decodeHtmlEntities(nameMatch?.[1] || `Sheet${wsMatches.length + 1}`),
      body: wsMatch[2],
    })
  }

  const targets = wsMatches.length > 0 ? wsMatches : [{ name: 'Sheet1', body: xml }]

  for (const target of targets) {
    const rows: string[][] = []
    const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi
    let rowMatch: RegExpExecArray | null

    while ((rowMatch = rowRegex.exec(target.body)) !== null) {
      const row: string[] = []
      const cellRegex = /<Cell\b([^>]*)(?:\/>|>([\s\S]*?)<\/Cell>)/gi
      let cellMatch: RegExpExecArray | null

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const attrs = cellMatch[1] || ''
        const idxMatch = /\bss:Index\s*=\s*"(\d+)"/i.exec(attrs)
        if (idxMatch) {
          const targetIdx = Math.min(Number(idxMatch[1]) - 1, 200)
          while (row.length < targetIdx) row.push('')
        }

        const inner = cellMatch[2] || ''
        const dataMatch = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(inner)
        const rawVal = (dataMatch ? dataMatch[1] : inner).replace(/<[^>]+>/g, '')
        row.push(decodeHtmlEntities(rawVal).trim())
      }

      if (row.some((cell) => cell.length > 0)) {
        rows.push(row)
      }
    }

    if (rows.length > 0) {
      sheets.push({ name: target.name, rows })
    }
  }

  return sheets
}

/**
 * Load .xlsx, .csv/.tsv, or HTML/XML .xls buffer into an ExcelJS Workbook,
 * giving clear diagnostics for legacy binary OLE2 .xls files.
 */
export async function loadWorkbookFromBuffer(buffer: Buffer, fileName: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04

  if (isZip) {
    try {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
      return workbook
    } catch (err: unknown) {
      throw new Error(
        `ไม่สามารถเปิดอ่านไฟล์ .xlsx ได้ (${err instanceof Error ? err.message : 'ไฟล์เสียหายหรือไม่สมบูรณ์'})`
      )
    }
  }

  const isOle2Xls =
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0

  if (isOle2Xls) {
    try {
      const xlsWorkbook = readXls(buffer)
      const visibleSheets = xlsWorkbook.sheets.filter((s) => s.visibility !== 'very-hidden')
      const targetSheets = visibleSheets.length > 0 ? visibleSheets : xlsWorkbook.sheets
      const usedNames = new Set<string>()

      for (let i = 0; i < targetSheets.length; i++) {
        const s = targetSheets[i]
        const base = (s.name || `Sheet${i + 1}`).replace(/[*?:\\/\[\]]/g, '_').slice(0, 31) || `Sheet${i + 1}`
        let sheetName = base
        let suffix = 2
        while (usedNames.has(sheetName.toLowerCase())) {
          const tag = `_${suffix++}`
          sheetName = `${base.slice(0, 31 - tag.length)}${tag}`
        }
        usedNames.add(sheetName.toLowerCase())

        const ws = workbook.addWorksheet(sheetName)
        for (const row of s.rows) {
          ws.addRow(row.map((cell) => (cell instanceof CellError ? cell.code : cell)))
        }
      }

      if (workbook.worksheets.length === 0) {
        throw new Error('ไม่พบชีทข้อมูลในไฟล์ .xls')
      }
      return workbook
    } catch {
      throw new Error(
        'ไฟล์นี้เป็น Excel 97-2003 (.xls ไบนารี) ที่เสียหาย เข้ารหัสไว้ หรือเป็นรูปแบบเก่ากว่า BIFF8 — กรุณาเปิดไฟล์ใน Excel แล้ว Save As เป็น .xlsx หรือ .csv ก่อนนำเข้า'
      )
    }
  }

  const headText = decodeTextBuffer(buffer.subarray(0, Math.min(buffer.length, 1024))).trimStart()
  if (/^<(?:!doctype|html|head|meta|style|table|\?xml|workbook|!--)\b/i.test(headText)) {
    const fullText = decodeTextBuffer(buffer)
    if (/<(?:Workbook|Worksheet)\b/i.test(fullText)) {
      const xmlSheets = parseSpreadsheetXmlSheets(fullText)
      if (xmlSheets.length > 0) {
        for (const s of xmlSheets) {
          const ws = workbook.addWorksheet(s.name.slice(0, 31) || 'Sheet1')
          for (const row of s.rows) ws.addRow(row)
        }
        return workbook
      }
    }

    const htmlRows = parseHtmlTableRows(fullText)
    if (htmlRows.length > 0) {
      const sheet = workbook.addWorksheet('INDIVIDUAL')
      for (const row of htmlRows) sheet.addRow(row)
      return workbook
    }

    throw new Error(
      'ไฟล์นี้เป็นเอกสาร HTML/XML (.xls) ที่ไม่พบตารางข้อมูล — กรุณาเปิดไฟล์ใน Excel แล้ว Save As เป็น .xlsx หรือ .csv ก่อนนำเข้า'
    )
  }

  if (/\.(csv|tsv)$/i.test(fileName) || headText.includes(',') || headText.includes('\t')) {
    const delimiter = headText.includes('\t') && !headText.includes(',') ? '\t' : ','
    const csvRows = parseCsvRows(decodeTextBuffer(buffer), delimiter)
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
export function mapSeamlessHeaderRow(
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
export function isIndividualSheet(sheet: ExcelJS.Worksheet): boolean {
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
