import ExcelJS from 'exceljs'
import { apiGateway } from '@/lib/apiGateway'
import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { cleanCellString, normalizeDate } from './rcmSeamlessImportService'
import type { QueryExecutor } from './rcmDashboardService'

export const DEFAULT_MY_HOSPCODE = '11152'

export type T1dmRegistryHospFilter = 'ALL' | 'MINE' | 'OTHER'

export type T1dmRegistrySortField =
  | 'no'
  | 'id'
  | 'pid'
  | 'ptname'
  | 'regdate'
  | 'visitdate'
  | 'type'
  | 'maininscl'
  | 'hospmain'

export interface T1dmRegistryItem {
  no: number
  id: string
  year: string | null
  pid: string
  hn: string | null
  ptname: string
  regdate: string | null
  visitdate: string | null
  type: string | null
  maininscl: string | null
  hospmainCode: string
  hospmainName: string | null
  hospmain: string // concat_ws(':', hospmain, hospital(hospmain))
  isOtherHosp: boolean // true if hospmainCode !== myHospCode (FoxPro pink highlight)
  fileName: string | null
}

export interface T1dmImportedFileSummary {
  fileName: string
  rowCount: number
  minRegDate: string | null
  maxRegDate: string | null
  otherHospCount: number
}

export interface T1dmRegistrySummary {
  totalRegistered: number
  myHospCount: number
  otherHospCount: number
  t1dmCount: number
  gdmCount: number
  pdmCount: number
  otherTypeCount: number
  matchedHosxpHnCount: number
  totalFiles: number
}

export interface T1dmRegistryListParams {
  search?: string
  typeFilter?: string // 'ALL' | 'T1DM' | 'GDM' | 'PDM' | ...
  hospFilter?: T1dmRegistryHospFilter
  fileName?: string
  sortBy?: T1dmRegistrySortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  myHospCode?: string
}

export interface T1dmRegistryListResult {
  items: T1dmRegistryItem[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  summary: T1dmRegistrySummary
  importedFiles: T1dmImportedFileSummary[]
  availableTypes: string[]
  myHospCode: string
}

export interface ParsedT1dmExcelRow {
  rowNumber: number
  sheetName: string
  id: string
  year: string | null
  pid: string
  hn: string | null
  ptname: string
  maininscl: string | null
  hospmainRaw: string
  hospmainCode: string
  hospmainName: string | null
  hospmain: string
  type: string | null
  regdate: string | null
  visitdate: string | null
  fileName: string
  isOtherHosp: boolean
  isSkippedByHospFilter: boolean
}

export interface T1dmParseError {
  rowNumber: number
  sheetName?: string
  id?: string
  pid?: string
  reason: string
}

export interface T1dmImportParseResult {
  fileName: string
  fileSizeBytes: number
  totalSheets: number
  matchedSheets: string[]
  totalRowsScanned: number
  validRowsCount: number
  importedCount: number
  skippedOtherHospCount: number
  errorCount: number
  isAlreadyImported: boolean
  existingFileRowCount: number
  isDryRun: boolean
  filterMyHospOnly: boolean
  myHospCode: string
  typeBreakdown: Record<string, number>
  previewRows: ParsedT1dmExcelRow[]
  errors: T1dmParseError[]
  executionTimeMs: number
}

const CACHE_KEY_T1DM_REGISTRY = 'rcm-t1dm-registry-all'

/**
 * FoxPro helper:
 * m.hospmain = left(ntoc(m.hospmain), 5)
 * m.hospmain = zero(m.hospmain, 5)
 * Also extracts hospital name if the cell contains "11152:รพ.เถิน" or "11152 รพ.เถิน"
 */
export function parseHospMainField(raw: unknown): { code: string; inlineName: string | null } {
  const str = cleanCellString(raw)
  if (!str) return { code: '', inlineName: null }

  // Match leading digits up to 5 characters
  const match = str.match(/^(\d{1,5})(?:[\s:\-]+(.+))?$/)
  if (match) {
    const code = match[1].padStart(5, '0')
    const inlineName = match[2] ? match[2].trim() : null
    return { code, inlineName }
  }

  const left5 = str.slice(0, 5).trim()
  if (/^\d+$/.test(left5)) {
    const code = left5.padStart(5, '0')
    const rest = str.slice(5).replace(/^[\s:\-]+/, '').trim()
    return { code, inlineName: rest || null }
  }

  return { code: left5, inlineName: null }
}

/**
 * Normalize Thai CID / PID (strip dashes and spaces if 13 digits)
 */
export function normalizePid(raw: unknown): string {
  const str = cleanCellString(raw)
  if (!str) return ''
  const digits = str.replace(/\D/g, '')
  if (digits.length === 13) return digits
  return str
}

export class RcmT1dmImportService {
  static invalidateRegistryCache() {
    invalidateCacheKey(CACHE_KEY_T1DM_REGISTRY)
  }

  /**
   * Ensure Website fallback mirror table exists when rcmdb.t1dm is read-only or unavailable
   */
  private static mirrorTableEnsured = false
  private static async ensureWebsiteMirrorTable(): Promise<void> {
    if (this.mirrorTableEnsured) return
    try {
      await apiGateway.app.execute(`
        INSERT INTO member_system_settings (config_key, config_value)
        VALUES ('t1dm_registry_initialized', '1')
        ON DUPLICATE KEY UPDATE config_value = '1'
      `)
    } catch {
      // ignore
    }
    this.mirrorTableEnsured = true
  }

  /**
   * Fetch all raw rows from rcmdb.t1dm (with HOSxP hospcode & patient HN join),
   * and merge with any rows stored in t1dm_registries mirror table if used.
   */
  static async fetchAllRawRegistries(
    myHospCode: string = DEFAULT_MY_HOSPCODE,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<T1dmRegistryItem[]> {
    const sql = `
      SELECT 
        t.ID AS id,
        IFNULL(t.Year, '') AS year,
        IFNULL(t.PID, '') AS pid,
        IFNULL(t.PtName, '') AS ptname,
        DATE_FORMAT(t.Register_Date, '%Y-%m-%d') AS regdate,
        DATE_FORMAT(t.Visit_Date, '%Y-%m-%d') AS visitdate,
        IFNULL(t.Type, '') AS type,
        IFNULL(t.Maininscl, '') AS maininscl,
        LPAD(TRIM(IFNULL(t.HCode, '')), 5, '0') AS hospmain_code,
        IFNULL(h.name, '') AS hospmain_name,
        CONCAT_WS(':', LPAD(TRIM(IFNULL(t.HCode, '')), 5, '0'), NULLIF(TRIM(h.name), '')) AS hospmain,
        IFNULL(t.FileName, '') AS filename,
        IFNULL(pt.hn, '') AS hn
      FROM rcmdb.t1dm t
      LEFT JOIN hospcode h ON h.hospcode = LPAD(TRIM(t.HCode), 5, '0')
      LEFT JOIN patient pt ON pt.cid = t.PID
      ORDER BY t.Register_Date DESC, t.ID ASC
    `

    let clinicalRows: any[] = []
    try {
      clinicalRows = await executor(sql, [])
    } catch (err: any) {
      // Fallback if FileName column does not exist yet on rcmdb.t1dm
      if (err?.message && /FileName/i.test(err.message)) {
        try {
          const fallbackNoFileSql = sql.replace('IFNULL(t.FileName, \'\') AS filename,', '\'\' AS filename,')
          clinicalRows = await executor(fallbackNoFileSql, [])
        } catch {
          clinicalRows = []
        }
      } else {
        clinicalRows = []
      }
    }

    // Also check Website DB mirror table `t1dm_registries` if any rows were imported via appPool fallback
    let mirrorRows: any[] = []
    if (executor === queryClinicalDb) {
      try {
        mirrorRows = await apiGateway.app.query<any>(`
          SELECT 
            id,
            year,
            pid,
            hn,
            ptname,
            DATE_FORMAT(register_date, '%Y-%m-%d') AS regdate,
            DATE_FORMAT(visit_date, '%Y-%m-%d') AS visitdate,
            type,
            maininscl,
            hospmain_code,
            hospmain_name,
            filename
          FROM t1dm_registries
          ORDER BY register_date DESC, id ASC
        `)
      } catch {
        mirrorRows = []
      }
    }

    // Merge by ID (mirrorRows override or supplement clinicalRows)
    const mergedMap = new Map<string, any>()
    for (const r of clinicalRows || []) {
      const id = String(r.id || '').trim()
      if (!id) continue
      mergedMap.set(id, r)
    }
    for (const m of mirrorRows || []) {
      const id = String(m.id || '').trim()
      if (!id) continue
      const existing = mergedMap.get(id)
      const hospCode = String(m.hospmain_code || existing?.hospmain_code || '')
        .trim()
        .padStart(5, '0')
      const hospName = String(m.hospmain_name || existing?.hospmain_name || '').trim()
      mergedMap.set(id, {
        id,
        year: m.year || existing?.year || '',
        pid: m.pid || existing?.pid || '',
        ptname: m.ptname || existing?.ptname || '',
        regdate: m.regdate || existing?.regdate || null,
        visitdate: m.visitdate || existing?.visitdate || null,
        type: m.type || existing?.type || '',
        maininscl: m.maininscl || existing?.maininscl || '',
        hospmain_code: hospCode === '00000' ? '' : hospCode,
        hospmain_name: hospName,
        hospmain: hospName ? `${hospCode}:${hospName}` : hospCode,
        filename: m.filename || existing?.filename || '',
        hn: m.hn || existing?.hn || '',
      })
    }

    const combined = Array.from(mergedMap.values())

    return combined.map((r, index) => {
      const rawHospCode = String(r.hospmain_code || '').trim()
      const hospmainCode =
        rawHospCode && rawHospCode !== '00000' ? rawHospCode.padStart(5, '0') : ''
      const hospmainName = r.hospmain_name ? String(r.hospmain_name).trim() : null
      const hospmainDisplay = hospmainName
        ? `${hospmainCode}:${hospmainName}`
        : hospmainCode || '—'
      const isOtherHosp = Boolean(hospmainCode && hospmainCode !== myHospCode)

      return {
        no: index + 1,
        id: String(r.id || '').trim(),
        year: r.year ? String(r.year).trim() : null,
        pid: String(r.pid || '').trim(),
        hn: r.hn ? String(r.hn).trim() : null,
        ptname: String(r.ptname || '').trim(),
        regdate: r.regdate ? String(r.regdate).slice(0, 10) : null,
        visitdate: r.visitdate ? String(r.visitdate).slice(0, 10) : null,
        type: r.type ? String(r.type).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : null,
        hospmainCode,
        hospmainName,
        hospmain: hospmainDisplay,
        isOtherHosp,
        fileName: r.filename ? String(r.filename).trim() : null,
      }
    })
  }

  /**
   * List T1DM/GDM/PDM registry items with summary KPIs, file breakdown, filters, search, sort, and pagination.
   */
  static async getRegistryList(
    params: T1dmRegistryListParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<T1dmRegistryListResult> {
    const myHospCode = (params.myHospCode || DEFAULT_MY_HOSPCODE).trim()
    const search = (params.search || '').trim().toLowerCase()
    const typeFilter = (params.typeFilter || 'ALL').trim().toUpperCase()
    const hospFilter: T1dmRegistryHospFilter = params.hospFilter || 'ALL'
    const fileNameFilter = (params.fileName || '').trim()
    const sortBy: T1dmRegistrySortField = params.sortBy || 'regdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    if (params.refresh) {
      this.invalidateRegistryCache()
    }

    const allItems = await getCachedData(
      CACHE_KEY_T1DM_REGISTRY,
      () => this.fetchAllRawRegistries(myHospCode, executor),
      120_000 // 2 minutes cache
    )

    // Compute overall summary across all items in the registry
    let myHospCount = 0
    let otherHospCount = 0
    let t1dmCount = 0
    let gdmCount = 0
    let pdmCount = 0
    let otherTypeCount = 0
    let matchedHosxpHnCount = 0

    const fileMap = new Map<
      string,
      { rowCount: number; minRegDate: string | null; maxRegDate: string | null; otherHospCount: number }
    >()
    const typesSet = new Set<string>()

    for (const item of allItems) {
      if (item.isOtherHosp) {
        otherHospCount++
      } else {
        myHospCount++
      }

      if (item.hn) {
        matchedHosxpHnCount++
      }

      const tUpper = (item.type || '').toUpperCase()
      if (item.type) typesSet.add(item.type)

      if (tUpper.includes('T1DM')) t1dmCount++
      else if (tUpper.includes('GDM')) gdmCount++
      else if (tUpper.includes('PDM')) pdmCount++
      else otherTypeCount++

      if (item.fileName) {
        const entry = fileMap.get(item.fileName) || {
          rowCount: 0,
          minRegDate: null,
          maxRegDate: null,
          otherHospCount: 0,
        }
        entry.rowCount++
        if (item.isOtherHosp) entry.otherHospCount++
        if (item.regdate) {
          if (!entry.minRegDate || item.regdate < entry.minRegDate) entry.minRegDate = item.regdate
          if (!entry.maxRegDate || item.regdate > entry.maxRegDate) entry.maxRegDate = item.regdate
        }
        fileMap.set(item.fileName, entry)
      }
    }

    const importedFiles: T1dmImportedFileSummary[] = Array.from(fileMap.entries())
      .map(([fileName, stats]) => ({
        fileName,
        rowCount: stats.rowCount,
        minRegDate: stats.minRegDate,
        maxRegDate: stats.maxRegDate,
        otherHospCount: stats.otherHospCount,
      }))
      .sort((a, b) => (b.maxRegDate || '').localeCompare(a.maxRegDate || ''))

    const summary: T1dmRegistrySummary = {
      totalRegistered: allItems.length,
      myHospCount,
      otherHospCount,
      t1dmCount,
      gdmCount,
      pdmCount,
      otherTypeCount,
      matchedHosxpHnCount,
      totalFiles: importedFiles.length,
    }

    // Apply Filters
    let filtered = [...allItems]

    if (hospFilter === 'MINE') {
      filtered = filtered.filter((i) => !i.isOtherHosp)
    } else if (hospFilter === 'OTHER') {
      filtered = filtered.filter((i) => i.isOtherHosp)
    }

    if (typeFilter && typeFilter !== 'ALL') {
      filtered = filtered.filter((i) => (i.type || '').toUpperCase() === typeFilter)
    }

    if (fileNameFilter && fileNameFilter !== 'ALL') {
      filtered = filtered.filter((i) => i.fileName === fileNameFilter)
    }

    if (search) {
      filtered = filtered.filter(
        (i) =>
          i.id.toLowerCase().includes(search) ||
          i.pid.toLowerCase().includes(search) ||
          (i.hn && i.hn.toLowerCase().includes(search)) ||
          i.ptname.toLowerCase().includes(search) ||
          (i.type && i.type.toLowerCase().includes(search)) ||
          (i.maininscl && i.maininscl.toLowerCase().includes(search)) ||
          i.hospmain.toLowerCase().includes(search) ||
          (i.fileName && i.fileName.toLowerCase().includes(search))
      )
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null) valA = ''
      if (valB == null) valB = ''

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = String(valB).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-number sequentially
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = reindexed.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    const resultItems = exportAll
      ? reindexed
      : reindexed.slice((page - 1) * pageSize, page * pageSize)

    return {
      items: resultItems,
      totalCount,
      totalPages,
      page,
      pageSize,
      summary,
      importedFiles,
      availableTypes: Array.from(typesSet).sort(),
      myHospCode,
    }
  }

  /**
   * Parse and optionally import a T1DM Excel file (.xlsx / .xls) following FoxPro AddByExcel rules:
   * - Check if sheet A1 contains 'T1DM' (or fallback to scanning rows 1..30 for header starting with 'RUN')
   * - Find header row ii in 1..30 where cell(ii, 1) = 'RUN'
   * - Map columns:
   *   RUN -> ID
   *   ปีงบประมาณ -> Year
   *   PID -> PID
   *   ชื่อ-นามสกุล -> PtName
   *   สิทธิ -> Maininscl
   *   หน่วยบริการลงทะเบียน -> HospMain
   *   ชนิดการลงทะเบียน -> Type
   *   วันที่ลงทะเบียน -> Register_Date
   *   วันที่เข้ารับบริการ -> Visit_Date
   * - Format HospMain: left 5 chars padded with leading zeros
   * - Convert dates from Buddhist Era / Excel dates to YYYY-MM-DD (toengdate)
   * - Filter by myHospCode when filterMyHospOnly (setHospCode=.T.) is enabled
   */
  static async parseAndImportWorkbook(
    buffer: Buffer,
    fileName: string,
    options: {
      isDryRun?: boolean
      filterMyHospOnly?: boolean
      myHospCode?: string
      executor?: QueryExecutor
    } = {}
  ): Promise<T1dmImportParseResult> {
    const startTime = Date.now()
    const isDryRun = Boolean(options.isDryRun)
    const filterMyHospOnly = options.filterMyHospOnly !== false // FoxPro default: setHospCode=.T., lHospCode=.T.
    const myHospCode = (options.myHospCode || DEFAULT_MY_HOSPCODE).trim()
    const executor = options.executor || queryClinicalDb

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])

    const matchedSheets: string[] = []
    const allParsedRows: ParsedT1dmExcelRow[] = []
    const errors: T1dmParseError[] = []
    const typeBreakdown: Record<string, number> = {}
    let totalRowsScanned = 0
    let skippedOtherHospCount = 0

    for (const sheet of workbook.worksheets) {
      const sheetName = sheet.name || 'Sheet1'
      const a1Text = cleanCellString(sheet.getCell('A1').value).toUpperCase()
      const a2Text = cleanCellString(sheet.getCell('A2').value).toUpperCase()

      // Search rows 1..30 for header row where column 1 is 'RUN' (or contains 'RUN')
      let headerRowIndex = -1
      for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
        const firstCell = cleanCellString(sheet.getRow(r).getCell(1).value).toUpperCase()
        if (firstCell === 'RUN' || firstCell === 'ลำดับ' || firstCell === 'ID') {
          headerRowIndex = r
          break
        }
        // Also scan any cell in row r for 'RUN' and 'PID'
        let hasRun = false
        let hasPid = false
        sheet.getRow(r).eachCell((cell) => {
          const val = cleanCellString(cell.value).toUpperCase()
          if (val === 'RUN') hasRun = true
          if (val.includes('PID') || val.includes('เลขบัตร')) hasPid = true
        })
        if (hasRun && hasPid) {
          headerRowIndex = r
          break
        }
      }

      const hasT1dmMarker =
        a1Text.includes('T1DM') ||
        a2Text.includes('T1DM') ||
        sheetName.toUpperCase().includes('T1DM') ||
        headerRowIndex !== -1

      if (!hasT1dmMarker || headerRowIndex === -1) {
        continue
      }

      matchedSheets.push(sheetName)

      // Map columns from headerRowIndex
      // _str='RUN|ปีงบประมาณ|PID|ชื่อ-นามสกุล|สิทธิ|หน่วยบริการลงทะเบียน|ชนิดการลงทะเบียน|วันที่ลงทะเบียน|วันที่เข้ารับบริการ'
      const colMap: Record<string, number> = {}
      const headerRow = sheet.getRow(headerRowIndex)

      headerRow.eachCell((cell, colNumber) => {
        const text = cleanCellString(cell.value).replace(/\s+/g, '')
        const upper = text.toUpperCase()
        if (!text) return

        if (upper === 'RUN' || upper === 'ID' || text === 'ลำดับ') {
          if (!colMap.id) colMap.id = colNumber
        } else if (text.includes('ปีงบประมาณ') || upper === 'YEAR') {
          colMap.year = colNumber
        } else if (upper.includes('PID') || upper.includes('CID') || text.includes('เลขบัตร')) {
          colMap.pid = colNumber
        } else if (text.includes('ชื่อ-นามสกุล') || text.includes('ชื่อ-สกุล') || upper === 'PTNAME' || text.includes('ชื่อ')) {
          if (!colMap.ptname) colMap.ptname = colNumber
        } else if (text.includes('สิทธิ') || upper.includes('MAININSCL') || upper.includes('INSCL')) {
          colMap.maininscl = colNumber
        } else if (text.includes('หน่วยบริการลงทะเบียน') || text.includes('หน่วยบริการ') || upper.includes('HOSPMAIN')) {
          colMap.hospmain = colNumber
        } else if (text.includes('ชนิดการลงทะเบียน') || text.includes('ประเภท') || upper === 'TYPE') {
          colMap.type = colNumber
        } else if (text.includes('วันที่ลงทะเบียน') || upper.includes('REGISTER_DATE') || upper === 'REGDATE') {
          colMap.regdate = colNumber
        } else if (text.includes('วันที่เข้ารับบริการ') || text.includes('วันที่รับบริการ') || upper.includes('VISIT_DATE')) {
          colMap.visitdate = colNumber
        }
      })

      // Fallback positional mapping if standard 9 columns
      if (!colMap.id) colMap.id = 1
      if (!colMap.year) colMap.year = 2
      if (!colMap.pid) colMap.pid = 3
      if (!colMap.ptname) colMap.ptname = 4
      if (!colMap.maininscl) colMap.maininscl = 5
      if (!colMap.hospmain) colMap.hospmain = 6
      if (!colMap.type) colMap.type = 7
      if (!colMap.regdate) colMap.regdate = 8
      if (!colMap.visitdate) colMap.visitdate = 9

      const dataStartRow = headerRowIndex + 1
      const maxRow = sheet.rowCount

      for (let r = dataStartRow; r <= maxRow; r++) {
        const row = sheet.getRow(r)
        const rawId = cleanCellString(row.getCell(colMap.id).value)
        const rawPid = cleanCellString(row.getCell(colMap.pid).value)
        const rawPtname = cleanCellString(row.getCell(colMap.ptname).value)

        // Skip completely empty rows
        if (!rawId && !rawPid && !rawPtname) continue

        // Skip repeated header rows
        if (rawId.toUpperCase() === 'RUN' || rawPid.toUpperCase() === 'PID') continue

        totalRowsScanned++

        if (!rawId) {
          errors.push({
            rowNumber: r,
            sheetName,
            pid: rawPid,
            reason: 'ไม่พบรหัส RUN (ID) ในแถวข้อมูล',
          })
          continue
        }

        const pid = normalizePid(rawPid)
        const yearRaw = cleanCellString(row.getCell(colMap.year).value)
        const year = yearRaw ? yearRaw.slice(0, 4) : null
        const maininscl = cleanCellString(row.getCell(colMap.maininscl).value) || null
        const type = cleanCellString(row.getCell(colMap.type).value) || null

        const hospRawVal = row.getCell(colMap.hospmain).value
        const { code: hospmainCode, inlineName } = parseHospMainField(hospRawVal)

        const regdate = normalizeDate(row.getCell(colMap.regdate).value)
        const visitdate = normalizeDate(row.getCell(colMap.visitdate).value)

        const isOtherHosp = Boolean(hospmainCode && hospmainCode !== myHospCode)
        const isSkippedByHospFilter = filterMyHospOnly && isOtherHosp

        if (isSkippedByHospFilter) {
          skippedOtherHospCount++
        }

        const typeKey = type || 'ไม่ระบุ'
        if (!isSkippedByHospFilter) {
          typeBreakdown[typeKey] = (typeBreakdown[typeKey] || 0) + 1
        }

        allParsedRows.push({
          rowNumber: r,
          sheetName,
          id: rawId.slice(0, 20),
          year,
          pid,
          hn: null,
          ptname: rawPtname,
          maininscl,
          hospmainRaw: cleanCellString(hospRawVal),
          hospmainCode,
          hospmainName: inlineName,
          hospmain: inlineName
            ? `${hospmainCode}:${inlineName}`
            : hospmainCode || cleanCellString(hospRawVal),
          type,
          regdate,
          visitdate,
          fileName,
          isOtherHosp,
          isSkippedByHospFilter,
        })
      }
    }

    if (matchedSheets.length === 0) {
      throw new Error(
        'ไม่พบชีทข้อมูลทะเบียน T1DM (ตรวจสอบว่าเซลล์ A1 มีคำว่า T1DM หรือมีแถวหัวตารางคอลัมน์ RUN | ปีงบประมาณ | PID)'
      )
    }

    // Batch resolve HN from HOSxP patient table and Hospital Names from hospcode table
    const cidsToResolve = Array.from(
      new Set(allParsedRows.map((r) => r.pid).filter((pid) => pid && pid.length === 13))
    )
    const hospCodesToResolve = Array.from(
      new Set(allParsedRows.map((r) => r.hospmainCode).filter(Boolean))
    )

    const patientHnMap = new Map<string, { hn: string; ptname: string }>()
    const hospNameMap = new Map<string, string>()

    if (cidsToResolve.length > 0) {
      const CHUNK_SIZE = 500
      for (let i = 0; i < cidsToResolve.length; i += CHUNK_SIZE) {
        const chunk = cidsToResolve.slice(i, i + CHUNK_SIZE)
        const placeholders = chunk.map(() => '?').join(',')
        try {
          const ptRows = await executor(
            `SELECT cid, hn, TRIM(CONCAT(IFNULL(pname,''), IFNULL(fname,''), ' ', IFNULL(lname,''))) AS ptname
             FROM patient
             WHERE cid IN (${placeholders})`,
            chunk
          )
          for (const pt of ptRows || []) {
            if (pt.cid) {
              patientHnMap.set(String(pt.cid).trim(), {
                hn: String(pt.hn || '').trim(),
                ptname: String(pt.ptname || '').trim(),
              })
            }
          }
        } catch {
          // non-blocking
        }
      }
    }

    if (hospCodesToResolve.length > 0) {
      const placeholders = hospCodesToResolve.map(() => '?').join(',')
      try {
        const hRows = await executor(
          `SELECT hospcode, name FROM hospcode WHERE hospcode IN (${placeholders})`,
          hospCodesToResolve
        )
        for (const h of hRows || []) {
          if (h.hospcode && h.name) {
            hospNameMap.set(String(h.hospcode).trim().padStart(5, '0'), String(h.name).trim())
          }
        }
      } catch {
        // non-blocking
      }
    }

    for (const row of allParsedRows) {
      if (row.pid && patientHnMap.has(row.pid)) {
        const pt = patientHnMap.get(row.pid)!
        row.hn = pt.hn
        if (!row.ptname && pt.ptname) {
          row.ptname = pt.ptname
        }
      }
      if (row.hospmainCode && hospNameMap.has(row.hospmainCode)) {
        const resolvedName = hospNameMap.get(row.hospmainCode)!
        row.hospmainName = resolvedName
        row.hospmain = `${row.hospmainCode}:${resolvedName}`
      }
    }

    // Check if this fileName was already imported before
    let existingFileRowCount = 0
    try {
      const existingCheck = await executor(
        'SELECT COUNT(*) AS cnt FROM rcmdb.t1dm WHERE FileName = ?',
        [fileName]
      )
      existingFileRowCount = Number(existingCheck?.[0]?.cnt || 0)
    } catch {
      existingFileRowCount = 0
    }

    const rowsToSave = allParsedRows.filter((r) => !r.isSkippedByHospFilter && r.id)
    let importedCount = 0

    if (!isDryRun && rowsToSave.length > 0) {
      importedCount = await this.persistRegistries(rowsToSave)
      this.invalidateRegistryCache()
      // Also invalidate T1DM recipients report cache so fund 2 page updates immediately
      invalidateCacheKey('rcm-t1dm-gdm-pdm-recipients')
    } else {
      importedCount = rowsToSave.length
    }

    const executionTimeMs = Date.now() - startTime

    return {
      fileName,
      fileSizeBytes: buffer.length,
      totalSheets: workbook.worksheets.length,
      matchedSheets,
      totalRowsScanned,
      validRowsCount: allParsedRows.length,
      importedCount,
      skippedOtherHospCount,
      errorCount: errors.length,
      isAlreadyImported: existingFileRowCount > 0,
      existingFileRowCount,
      isDryRun,
      filterMyHospOnly,
      myHospCode,
      typeBreakdown,
      previewRows: rowsToSave.slice(0, 100),
      errors,
      executionTimeMs,
    }
  }

  /**
   * Persist parsed T1DM rows to Gateway Named API (`/api/v1/clinical/rcm/t1dm/import`)
   * with automatic fallback to Website DB (`t1dm_registries`) so data is always saved reliably.
   */
  static async persistRegistries(rows: ParsedT1dmExcelRow[]): Promise<number> {
    if (rows.length === 0) return 0

    // 1. Try Gateway Named API for rcmdb.t1dm
    try {
      const res = await apiGateway.clinical.importT1dmRegistries(
        rows.map((r) => ({
          id: r.id,
          year: r.year,
          pid: r.pid,
          hn: r.hn,
          ptname: r.ptname,
          maininscl: r.maininscl,
          hospmainCode: r.hospmainCode,
          hospmainName: r.hospmainName,
          type: r.type,
          regdate: r.regdate,
          visitdate: r.visitdate,
          fileName: r.fileName,
        }))
      )
      if (res && res.success) {
        return res.insertedCount || rows.length
      }
    } catch (gwErr) {
      logger.warn({ gwErr }, 'Named clinical T1DM import endpoint not yet active, using app mirror persistence')
    }

    // 2. Fallback: Persist into Website DB `t1dm_registries` via parameterized transaction batches
    const statements: Array<{ sql: string; params: unknown[] }> = []
    for (const r of rows) {
      statements.push({
        sql: `
          INSERT INTO t1dm_registries (
            id, year, pid, hn, ptname, maininscl, hospmain_code, hospmain_name, type, register_date, visit_date, filename, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            year = VALUES(year),
            pid = VALUES(pid),
            hn = VALUES(hn),
            ptname = VALUES(ptname),
            maininscl = VALUES(maininscl),
            hospmain_code = VALUES(hospmain_code),
            hospmain_name = VALUES(hospmain_name),
            type = VALUES(type),
            register_date = VALUES(register_date),
            visit_date = VALUES(visit_date),
            filename = VALUES(filename),
            updated_at = NOW()
        `,
        params: [
          r.id,
          r.year,
          r.pid,
          r.hn,
          r.ptname,
          r.maininscl,
          r.hospmainCode || null,
          r.hospmainName || null,
          r.type,
          r.regdate,
          r.visitdate,
          r.fileName,
        ],
      })
    }

    const BATCH_SIZE = 100
    let savedCount = 0
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const chunk = statements.slice(i, i + BATCH_SIZE)
      await apiGateway.app.transaction(chunk)
      savedCount += chunk.length
    }

    return savedCount
  }

  /**
   * Delete records from rcmdb.t1dm (and mirror table):
   * - mode = 'other_hospitals': FoxPro `delete from rcmdb.t1dm where hospmain <> ?myhospcode`
   * - mode = 'by_file': FoxPro `delete from rcmdb.t1dm where filename = ?_file`
   * - mode = 'all': FoxPro `delete from rcmdb.t1dm`
   */
  static async deleteRegistries(payload: {
    mode: 'other_hospitals' | 'by_file' | 'all'
    fileName?: string
    myHospCode?: string
  }): Promise<{ deletedCount: number }> {
    const myHospCode = (payload.myHospCode || DEFAULT_MY_HOSPCODE).trim()
    let deletedCount = 0

    // 1. Try Gateway Named API
    try {
      const res = await apiGateway.clinical.deleteT1dmRegistries({
        mode: payload.mode,
        fileName: payload.fileName,
        myHospCode,
      })
      if (res && res.success) {
        deletedCount += Number(res.deletedCount || 0)
      }
    } catch (gwErr) {
      logger.warn({ gwErr }, 'Named clinical T1DM delete endpoint not yet active, checking mirror table')
    }

    // 2. Also execute on Website DB mirror table if present
    try {
      if (payload.mode === 'other_hospitals') {
        const res = await apiGateway.app.execute(
          'DELETE FROM t1dm_registries WHERE hospmain_code IS NOT NULL AND hospmain_code <> ? AND hospmain_code <> ""',
          [myHospCode]
        )
        deletedCount += Number(res?.affectedRows || 0)
      } else if (payload.mode === 'by_file' && payload.fileName) {
        const res = await apiGateway.app.execute(
          'DELETE FROM t1dm_registries WHERE filename = ?',
          [payload.fileName]
        )
        deletedCount += Number(res?.affectedRows || 0)
      } else if (payload.mode === 'all') {
        const res = await apiGateway.app.execute('DELETE FROM t1dm_registries WHERE 1=1', [])
        deletedCount += Number(res?.affectedRows || 0)
      }
    } catch {
      // ignore if mirror table not used
    }

    this.invalidateRegistryCache()
    return { deletedCount }
  }
}
