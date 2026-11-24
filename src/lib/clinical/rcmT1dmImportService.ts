import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { cleanCellString, loadWorkbookFromBuffer, normalizeDate } from './rcmSeamlessImportService'

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

export interface T1dmImportGatewayAdapter {
  getT1dmRawRegistries: typeof apiGateway.clinical.getT1dmRawRegistries
  enrichT1dmImport: typeof apiGateway.clinical.enrichT1dmImport
  persistT1dmMirror: typeof apiGateway.clinical.persistT1dmMirror
  deleteT1dmMirror: typeof apiGateway.clinical.deleteT1dmMirror
}

const defaultT1dmGateway: T1dmImportGatewayAdapter = {
  getT1dmRawRegistries: () => apiGateway.clinical.getT1dmRawRegistries(),
  enrichT1dmImport: (payload) => apiGateway.clinical.enrichT1dmImport(payload),
  persistT1dmMirror: (rows) => apiGateway.clinical.persistT1dmMirror(rows),
  deleteT1dmMirror: (payload) => apiGateway.clinical.deleteT1dmMirror(payload),
}

export class RcmT1dmImportService {
  static invalidateRegistryCache() {
    invalidateCacheKey(CACHE_KEY_T1DM_REGISTRY)
  }

  /**
   * Fetch all raw rows from rcmdb.t1dm and t1dm_registries mirror table via API Gateway.
   */
  static async fetchAllRawRegistries(
    myHospCode: string = DEFAULT_MY_HOSPCODE,
    gateway: Partial<T1dmImportGatewayAdapter> = defaultT1dmGateway
  ): Promise<T1dmRegistryItem[]> {
    const gw: T1dmImportGatewayAdapter = { ...defaultT1dmGateway, ...gateway }
    let clinicalRows: any[] = []
    let mirrorRows: any[] = []
    try {
      const res = await gw.getT1dmRawRegistries()
      clinicalRows = Array.isArray(res?.data?.clinicalRows) ? res.data.clinicalRows : []
      mirrorRows = Array.isArray(res?.data?.mirrorRows) ? res.data.mirrorRows : []
    } catch {
      clinicalRows = []
      mirrorRows = []
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
    gateway: Partial<T1dmImportGatewayAdapter> = defaultT1dmGateway
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
      () => this.fetchAllRawRegistries(myHospCode, gateway),
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
      gateway?: Partial<T1dmImportGatewayAdapter>
    } = {}
  ): Promise<T1dmImportParseResult> {
    const startTime = Date.now()
    const isDryRun = options.isDryRun !== false
    const filterMyHospOnly = options.filterMyHospOnly !== false // FoxPro default: setHospCode=.T., lHospCode=.T.
    const myHospCode = (options.myHospCode || DEFAULT_MY_HOSPCODE).trim()
    const gw: T1dmImportGatewayAdapter = { ...defaultT1dmGateway, ...(options.gateway || {}) }

    const workbook = await loadWorkbookFromBuffer(buffer, fileName)

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

      // Search rows 1..30 for header row where column 1 is 'RUN' / 'RUN NUMBER' (or row contains RUN + PID)
      const isRunHeaderCell = (val: string) =>
        /^(?:RUN(?:\s*NUMBER|\s*NO\.?|\s*ID)?|ลำดับ|ID)$/i.test(val.trim())

      let headerRowIndex = -1
      for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
        const firstCell = cleanCellString(sheet.getRow(r).getCell(1).value)
        if (isRunHeaderCell(firstCell)) {
          headerRowIndex = r
          break
        }
        // Also scan any cell in row r for 'RUN' / 'RUN NUMBER' and 'PID'
        let hasRun = false
        let hasPid = false
        sheet.getRow(r).eachCell((cell) => {
          const val = cleanCellString(cell.value).toUpperCase()
          if (isRunHeaderCell(val)) hasRun = true
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

        if (upper === 'RUN' || upper === 'RUNNUMBER' || upper === 'RUNNO' || upper === 'RUNID' || upper === 'ID' || text === 'ลำดับ') {
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
        if (isRunHeaderCell(rawId) || rawPid.toUpperCase() === 'PID') continue

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

    // Batch resolve HN, Hospital Names, and existing file count via API Gateway
    const cidsToResolve = Array.from(
      new Set(allParsedRows.map((r) => r.pid).filter((pid) => pid && pid.length === 13))
    )
    const hospCodesToResolve = Array.from(
      new Set(allParsedRows.map((r) => r.hospmainCode).filter(Boolean))
    )

    const patientHnMap = new Map<string, { hn: string; ptname: string }>()
    const hospNameMap = new Map<string, string>()
    let existingFileRowCount = 0

    try {
      const enrichRes = await gw.enrichT1dmImport({
        cids: cidsToResolve,
        hospCodes: hospCodesToResolve,
        fileName,
      })
      for (const pt of enrichRes?.data?.patients || []) {
        if (pt.cid) {
          patientHnMap.set(String(pt.cid).trim(), {
            hn: String(pt.hn || '').trim(),
            ptname: String(pt.ptname || '').trim(),
          })
        }
      }
      for (const h of enrichRes?.data?.hospNames || []) {
        if (h.hospcode && h.name) {
          hospNameMap.set(String(h.hospcode).trim().padStart(5, '0'), String(h.name).trim())
        }
      }
      existingFileRowCount = Number(enrichRes?.data?.existingFileRowCount || 0)
    } catch {
      // non-blocking
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

    const rowsToSave = allParsedRows.filter((r) => !r.isSkippedByHospFilter && r.id)
    let importedCount = 0

    if (!isDryRun && rowsToSave.length > 0) {
      importedCount = await this.persistRegistries(rowsToSave, gw)
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
   * with automatic fallback to Website mirror Named API (`/api/v1/clinical/rcm/t1dm-v2/persist-mirror`).
   */
  static async persistRegistries(
    rows: ParsedT1dmExcelRow[],
    gateway: Partial<T1dmImportGatewayAdapter> = defaultT1dmGateway
  ): Promise<number> {
    if (rows.length === 0) return 0
    const gw: T1dmImportGatewayAdapter = { ...defaultT1dmGateway, ...gateway }
    const mappedRows = rows.map((r) => ({
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

    // 1. Try Gateway Named API for rcmdb.t1dm
    try {
      const res = await apiGateway.clinical.importT1dmRegistries(mappedRows)
      if (res && res.success) {
        return res.insertedCount || rows.length
      }
    } catch (gwErr) {
      logger.warn({ gwErr }, 'Named clinical T1DM import endpoint failed, using mirror endpoint')
    }

    // 2. Fallback: Persist into Website DB `t1dm_registries` via Gateway Named API
    const BATCH_SIZE = 100
    let savedCount = 0
    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const chunk = mappedRows.slice(i, i + BATCH_SIZE)
      const res = await gw.persistT1dmMirror(chunk)
      savedCount += Number(res?.savedCount ?? chunk.length)
    }

    return savedCount
  }

  /**
   * Delete records from rcmdb.t1dm (and mirror table) via API Gateway Named Endpoints.
   */
  static async deleteRegistries(
    payload: {
      mode: 'other_hospitals' | 'by_file' | 'all'
      fileName?: string
      myHospCode?: string
    },
    gateway: Partial<T1dmImportGatewayAdapter> = defaultT1dmGateway
  ): Promise<{ deletedCount: number }> {
    const gw: T1dmImportGatewayAdapter = { ...defaultT1dmGateway, ...gateway }
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
      logger.warn({ gwErr }, 'Named clinical T1DM delete endpoint failed, checking mirror endpoint')
    }

    // 2. Also execute on Website DB mirror table via Gateway Named API
    try {
      const res = await gw.deleteT1dmMirror({
        mode: payload.mode,
        fileName: payload.fileName,
        myHospCode,
      })
      deletedCount += Number(res?.deletedCount || 0)
    } catch {
      // ignore if mirror table not used
    }

    this.invalidateRegistryCache()
    return { deletedCount }
  }
}
