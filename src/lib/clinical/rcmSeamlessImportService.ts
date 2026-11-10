import ExcelJS from 'exceljs'
import { apiGateway } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'
import { queryClinicalDb } from '@/lib/clinicalDb'

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

export interface SeamlessParseResult {
  fileName: string
  fileSizeBytes: number
  totalSheets: number
  processedSheets: string[]
  totalRows: number
  validRows: number
  errorRows: number
  fundsDetected: Record<string, number>
  summaryInfo: SeamlessSummaryInfo | null
  denyCodes: SeamlessDenyCode[]
  previewRows: ParsedSeamlessRow[]
  errors: SeamlessParseError[]
  summary: SeamlessSummaryMetrics
  executionTimeMs: number
  isDryRun: boolean
}

export interface SeamlessDatabaseStats {
  totalRows: number
  totalReps: number
  totalFiles: number
  latestAdmDate: string | null
  totalCompensated: number
  topFunds: Array<{ fund: string; rowCount: number; totalCompensated: number }>
  recentFiles: Array<{
    fileName: string
    rowCount: number
    minDate: string | null
    maxDate: string | null
    totalCompensated: number
  }>
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
 * Normalize any input date value (Excel date, string, timestamp) to YYYY-MM-DD
 */
export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }

  const str = String(value).trim()
  if (!str) return null

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
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
  if (val === null || val === undefined || val === '') return fallback
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim())
  return isNaN(num) ? fallback : Math.round(num * 100) / 100
}

/**
 * Clean Thai string or cell value
 */
export function cleanCellString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object' && 'text' in (val as Record<string, unknown>)) {
    return String((val as { text: unknown }).text || '').trim()
  }
  return String(val).trim()
}

/**
 * Service for parsing, enriching, and importing Seamless RCM Excel files
 */
export class RcmSeamlessImportService {
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
      myHospCode?: string
    } = {}
  ): Promise<SeamlessParseResult> {
    const startTime = Date.now()
    const isDryRun = Boolean(options.isDryRun)
    const autoEnrichHosp = options.autoEnrichHosp !== false
    const updatePayment = options.updatePayment !== false
    const myHospCode = options.myHospCode || '11152'

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])

    const processedSheets: string[] = []
    const parsedRows: ParsedSeamlessRow[] = []
    const errors: SeamlessParseError[] = []
    const fundsDetected: Record<string, number> = {}
    let summaryInfo: SeamlessSummaryInfo | null = null
    const denyCodes: SeamlessDenyCode[] = []

    // 1. First pass: find and parse SUMMARY sheet
    if (updatePayment) {
      for (const sheet of workbook.worksheets) {
        const sheetNameUpper = (sheet.name || '').toUpperCase()
        if (sheetNameUpper.includes('SUMMARY')) {
          processedSheets.push(sheet.name)
          const rep = cleanCellString(sheet.getCell('F12').value)
          const payNo = cleanCellString(sheet.getCell('E12').value)
          const repDateRaw = sheet.getCell('G12').value
          const repDate = normalizeDate(repDateRaw)

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
                const cleanPayNo = payNo.replace(/[^a-zA-Z0-9]/g, '')
                const budgetRows = await queryClinicalDb<{ paydate: string; accountcode: string }>(
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
              } catch (err) {
                logger.warn({ err, payNo }, 'Failed to lookup nhso_budget for payNo')
              }
            }
          }
          break
        }
      }
    }

    // 2. Second pass: find and parse DENY CODE sheet
    for (const sheet of workbook.worksheets) {
      const sheetNameUpper = (sheet.name || '').toUpperCase()
      if (sheetNameUpper.includes('DENY CODE') || sheetNameUpper.includes('DENY_CODE')) {
        processedSheets.push(sheet.name)
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return // header
          const code = cleanCellString(row.getCell(1).value)
          const name = cleanCellString(row.getCell(2).value)
          if (code && name) {
            denyCodes.push({ code, name })
          }
        })
        break
      }
    }

    // 3. Third pass: process INDIVIDUAL sheets (main Seamless claim rows)
    for (const sheet of workbook.worksheets) {
      const sheetNameUpper = (sheet.name || '').toUpperCase()
      const c1Val = cleanCellString(sheet.getCell('C1').value)
      const c2Val = cleanCellString(sheet.getCell('C2').value)

      const isIndividual =
        sheetNameUpper.includes('INDIVIDUAL') ||
        c1Val.includes('REP แบบ INDIVIDUAL') ||
        c2Val.includes('REP แบบ INDIVIDUAL') ||
        c1Val.includes('รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ') ||
        c2Val.includes('รายงานสรุปการขอเบิกชดเชยค่าการรักษาพยาบาลของหน่วยบริการ')

      if (!isIndividual) continue

      processedSheets.push(sheet.name)

      // Find header row (search first 10 rows)
      let headerRowIndex = -1
      const colMap: Record<string, number> = {}

      for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
        const row = sheet.getRow(r)
        let foundKeywords = 0
        const tempMap: Record<string, number> = {}

        row.eachCell((cell, colNumber) => {
          const text = cleanCellString(cell.value).toLowerCase().replace(/\s+/g, '')
          if (!text) return

          if (text === 'ลำดับ' || text === 'no') {
            tempMap.no = colNumber
            foundKeywords++
          } else if (text === 'rep' || text === 'เลขที่rep' || text === 'repno') {
            tempMap.rep = colNumber
            foundKeywords++
          } else if (text === 'tranid' || text === 'transid' || text === 'id') {
            tempMap.id = colNumber
            foundKeywords++
          } else if (text.includes('pid') || text.includes('เลขบัตร') || text.includes('เลขประจำตัว')) {
            tempMap.pid = colNumber
            foundKeywords++
          } else if (text.includes('สิทธิ') || text.includes('maininscl')) {
            tempMap.mainInscl = colNumber
            foundKeywords++
          } else if (text.includes('วันที่เข้า') || text.includes('วันที่รับบริการ') || text.includes('admdate')) {
            tempMap.admDate = colNumber
            foundKeywords++
          } else if (text.includes('วันที่ส่ง') || text.includes('senddate')) {
            tempMap.sendDate = colNumber
            foundKeywords++
          } else if (text.includes('วันที่ลงทะเบียน') || text.includes('regdate')) {
            tempMap.regDate = colNumber
            foundKeywords++
          } else if (text.includes('ประเภทที่ขอเบิก') || text === 'type') {
            tempMap.type = colNumber
            foundKeywords++
          } else if (text.includes('visitno') || text.includes('serialno')) {
            tempMap.serialNo = colNumber
            foundKeywords++
          } else if (text.includes('รวมเงินที่ขอเบิก') || text.includes('collected')) {
            tempMap.collected = colNumber
            foundKeywords++
          } else if (text === 'ชดเชย' || text.includes('compensated') || text === 'เงินชดเชย') {
            if (!tempMap.compensated && !text.includes('ไม่ชดเชย')) {
              tempMap.compensated = colNumber
              foundKeywords++
            }
          } else if (text.includes('ไม่ชดเชย') || text.includes('nocompensated')) {
            tempMap.noCompensated = colNumber
            foundKeywords++
          } else if (text.includes('จ่ายเพิ่ม') || text.includes('paymore')) {
            tempMap.payMore = colNumber
            foundKeywords++
          } else if (text.includes('เรียกคืน') || text.includes('recall')) {
            tempMap.recall = colNumber
            foundKeywords++
          } else if (text.includes('แม่ข่าย') || text.includes('hmain') || text.includes('hcode')) {
            tempMap.hcode = colNumber
            foundKeywords++
          } else if (text.includes('ลูกข่าย') || text.includes('hsub')) {
            tempMap.hsub = colNumber
            foundKeywords++
          } else if (text.includes('hsend')) {
            tempMap.hsend = colNumber
            foundKeywords++
          } else if (text.includes('stmid')) {
            tempMap.stmid = colNumber
            foundKeywords++
          } else if (text.includes('รหัสอุปกรณ์') || text.includes('equipcode')) {
            tempMap.equipCode = colNumber
            foundKeywords++
          } else if (text.includes('ชื่อรายการอุปกรณ์') || text.includes('equipname')) {
            tempMap.equipName = colNumber
            foundKeywords++
          } else if (text === 'note' || text.includes('หมายเหตุ')) {
            tempMap.note = colNumber
            foundKeywords++
          }
        })

        if (foundKeywords >= 4 && (tempMap.id || tempMap.rep || tempMap.pid)) {
          headerRowIndex = r
          Object.assign(colMap, tempMap)
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

      // Iterate through data rows
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return

        const id = cleanCellString(colMap.id ? row.getCell(colMap.id).value : '')
        const rep = cleanCellString(colMap.rep ? row.getCell(colMap.rep).value : '')

        // If ID is missing or not alphanumeric, skip or report error
        if (!id && !rep) return

        // Skip any subheader or repeat header rows that match column titles
        const idLower = id.toLowerCase().replace(/[\s_\-]/g, '')
        const repLower = rep.toLowerCase().replace(/[\s_\-]/g, '')
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

        const pidRaw = cleanCellString(colMap.pid ? row.getCell(colMap.pid).value : '')
        if (
          pidRaw.toLowerCase().includes('pid') ||
          pidRaw.includes('เลขบัตร') ||
          pidRaw.includes('เลขประจำตัว')
        ) {
          return // Subheader row
        }

        const pid = pidRaw.replace(/\D/g, '').length === 13 ? pidRaw.replace(/\D/g, '') : pidRaw

        const admDate = normalizeDate(colMap.admDate ? row.getCell(colMap.admDate).value : null)
        const sendDate = normalizeDate(colMap.sendDate ? row.getCell(colMap.sendDate).value : null)
        const regDate = normalizeDate(colMap.regDate ? row.getCell(colMap.regDate).value : null)

        if (!id) {
          errors.push({
            rowNumber,
            rep,
            field: 'ID',
            reason: 'ไม่พบ TransID หรือ ID สำหรับรายการนี้',
          })
          return
        }

        const fund = resolveFundFromRep(rep)
        fundsDetected[fund] = (fundsDetected[fund] || 0) + 1

        const collected = parseNumber(colMap.collected ? row.getCell(colMap.collected).value : 0)
        const compensated = parseNumber(colMap.compensated ? row.getCell(colMap.compensated).value : 0)
        const noCompensated = parseNumber(colMap.noCompensated ? row.getCell(colMap.noCompensated).value : 0)
        const payMore = parseNumber(colMap.payMore ? row.getCell(colMap.payMore).value : 0)
        const recall = parseNumber(colMap.recall ? row.getCell(colMap.recall).value : 0)

        const rawHcode = cleanCellString(colMap.hcode ? row.getCell(colMap.hcode).value : '')
        const hcode = rawHcode || myHospCode

        const status = compensated > 0 ? 'ชดเชย' : noCompensated > 0 ? 'ไม่ชดเชย' : 'รอดำเนินการ'
        const yymm = admDate ? calculateYYMM(admDate) : ''
        const yearBudget = admDate ? calculateYearBudget(admDate) : ''

        parsedRows.push({
          rowNumber,
          id,
          rep,
          fund,
          period: summaryInfo?.payDate ? calculateYYMM(summaryInfo.payDate) : null,
          vn: null,
          hn: null,
          an: null,
          pid: pid || null,
          ptname: null,
          admDate,
          sendDate,
          regDate,
          mainInscl: cleanCellString(colMap.mainInscl ? row.getCell(colMap.mainInscl).value : null) || null,
          department: 'OP',
          hcode,
          type: cleanCellString(colMap.type ? row.getCell(colMap.type).value : null) || null,
          serialNo: cleanCellString(colMap.serialNo ? row.getCell(colMap.serialNo).value : null) || null,
          collected,
          compensated,
          noCompensated,
          payMore,
          recall,
          status,
          note: cleanCellString(colMap.note ? row.getCell(colMap.note).value : null) || null,
          stmid: cleanCellString(colMap.stmid ? row.getCell(colMap.stmid).value : null) || null,
          codeAccount: summaryInfo?.codeAccount || null,
          equipCode: cleanCellString(colMap.equipCode ? row.getCell(colMap.equipCode).value : null) || null,
          equipName: cleanCellString(colMap.equipName ? row.getCell(colMap.equipName).value : null) || null,
          hsub: cleanCellString(colMap.hsub ? row.getCell(colMap.hsub).value : null) || null,
          hsend: cleanCellString(colMap.hsend ? row.getCell(colMap.hsend).value : null) || null,
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

    // 4. Batch HOSxP Enrichment: resolve CID -> HN, Patient Name & VN in high-speed batches
    if (autoEnrichHosp && parsedRows.length > 0) {
      const cidsToResolve = Array.from(
        new Set(
          parsedRows
            .filter((r) => r.pid && r.pid.length === 13)
            .map((r) => r.pid as string)
        )
      )

      if (cidsToResolve.length > 0) {
        const patientMap = new Map<string, { hn: string; ptname: string }>()
        const CHUNK_SIZE = 500

        for (let i = 0; i < cidsToResolve.length; i += CHUNK_SIZE) {
          const chunk = cidsToResolve.slice(i, i + CHUNK_SIZE)
          const placeholders = chunk.map(() => '?').join(',')

          try {
            const rows = await queryClinicalDb<{ cid: string; hn: string; ptname: string }>(
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
        }

        // Apply resolved HN & Ptname
        for (const row of parsedRows) {
          if (row.pid && patientMap.has(row.pid)) {
            const pt = patientMap.get(row.pid)!
            row.hn = pt.hn
            row.ptname = pt.ptname
          }
        }

        // Resolve VN for rows that have HN and AdmDate
        const hnDatePairs = parsedRows
          .filter((r) => r.hn && r.admDate)
          .map((r) => ({ hn: r.hn as string, date: r.admDate as string }))

        if (hnDatePairs.length > 0) {
          const vnMap = new Map<string, string>()
          const uniqueHns = Array.from(new Set(hnDatePairs.map((p) => p.hn)))
          const minDate = hnDatePairs.reduce((min, p) => (p.date < min ? p.date : min), hnDatePairs[0].date)
          const maxDate = hnDatePairs.reduce((max, p) => (p.date > max ? p.date : max), hnDatePairs[0].date)

          for (let i = 0; i < uniqueHns.length; i += CHUNK_SIZE) {
            const hnChunk = uniqueHns.slice(i, i + CHUNK_SIZE)
            const placeholders = hnChunk.map(() => '?').join(',')

            try {
              const ovstRows = await queryClinicalDb<{ vn: string; hn: string; vstdate: string }>(
                `
                SELECT vn, hn, DATE_FORMAT(vstdate, '%Y-%m-%d') as vstdate
                FROM ovst
                WHERE hn IN (${placeholders})
                  AND vstdate BETWEEN ? AND ?
                `,
                [...hnChunk, minDate, maxDate]
              )
              for (const o of ovstRows) {
                const key = `${o.hn}_${o.vstdate}`
                vnMap.set(key, o.vn)
              }
            } catch (err) {
              logger.warn({ err }, 'Batch visit (VN) resolution error in Seamless import')
            }
          }

          for (const row of parsedRows) {
            if (row.hn && row.admDate) {
              const key = `${row.hn}_${row.admDate}`
              if (vnMap.has(key)) {
                row.vn = vnMap.get(key)!
              }
            }
          }
        }
      }
    }

    // Compute accurate summary metrics across ALL parsed rows
    let totalCompensation = 0
    let matchedPatientsHOSxP = 0
    let matchedVnsHOSxP = 0
    const uniquePatientsSet = new Set<string>()

    for (const row of parsedRows) {
      totalCompensation += row.compensated || 0
      if (row.pid) uniquePatientsSet.add(row.pid)
      if (row.hn) matchedPatientsHOSxP++
      if (row.vn) matchedVnsHOSxP++
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
      validRows: parsedRows.length,
      errorRows: errors.length,
      fundsDetected,
      summaryInfo,
      denyCodes,
      previewRows: parsedRows.slice(0, 50),
      errors,
      summary,
      executionTimeMs,
      isDryRun,
    }
  }

  /**
   * Fetch current stats from database (rcmdb.seamless)
   */
  static async getSeamlessDatabaseStats(): Promise<SeamlessDatabaseStats> {
    try {
      const [summaryRows, topFunds, recentFiles] = await Promise.all([
        queryClinicalDb<{
          totalRows: number
          totalReps: number
          totalFiles: number
          latestAdmDate: string | null
          totalCompensated: number
        }>(`
          SELECT 
            COUNT(*) as totalRows,
            COUNT(DISTINCT Rep) as totalReps,
            COUNT(DISTINCT FileName) as totalFiles,
            DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') as latestAdmDate,
            COALESCE(SUM(Compensated), 0) as totalCompensated
          FROM rcmdb.seamless
        `),
        queryClinicalDb<{ fund: string; rowCount: number; totalCompensated: number }>(`
          SELECT 
            Fund as fund,
            COUNT(*) as rowCount,
            COALESCE(SUM(Compensated), 0) as totalCompensated
          FROM rcmdb.seamless
          GROUP BY Fund
          ORDER BY rowCount DESC
          LIMIT 10
        `),
        queryClinicalDb<{
          fileName: string
          rowCount: number
          minDate: string | null
          maxDate: string | null
          totalCompensated: number
        }>(`
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
      ])

      const summary = summaryRows[0] || {
        totalRows: 0,
        totalReps: 0,
        totalFiles: 0,
        latestAdmDate: null,
        totalCompensated: 0,
      }

      return {
        totalRows: Number(summary.totalRows || 0),
        totalReps: Number(summary.totalReps || 0),
        totalFiles: Number(summary.totalFiles || 0),
        latestAdmDate: summary.latestAdmDate || null,
        totalCompensated: Number(summary.totalCompensated || 0),
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
        topFunds: [],
        recentFiles: [],
      }
    }
  }
}
