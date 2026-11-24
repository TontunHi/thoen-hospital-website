import { apiGateway, GatewayNotFoundError, GatewayUnavailableError } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'
import { getCachedData, invalidateCacheKey, invalidateCachePattern } from '@/lib/cache'
import {
  DEFAULT_SEAMLESS_HOSPCODE,
  SEAMLESS_FUND_MAP,
  FUND_NAME_TO_CODE_MAP,
  isSeamlessFileName,
  resolveFundCodeFromNameOrRep,
  resolveFundFromRep,
  calculateYYMM,
  calculateYearBudget,
  unwrapCellValue,
  normalizeDate,
  parseNumber,
  cleanCellString,
  extractHospCodeFromText,
  normalizeHn,
  normalizeAn,
  runWithConcurrency,
  resolveSheetHospCode,
  decodeTextBuffer,
  parseCsvRows,
  decodeHtmlEntities,
  parseHtmlTableRows,
  parseSpreadsheetXmlSheets,
  loadWorkbookFromBuffer,
  mapSeamlessHeaderRow,
  isIndividualSheet,
  type ParsedSeamlessRow,
  type SeamlessSummaryInfo,
  type SeamlessDenyCode,
  type SeamlessParseError,
  type SeamlessSummaryMetrics,
  type SeamlessDuplicateMode,
  type SeamlessFundBreakdownItem,
  type SeamlessParseResult,
  type SeamlessDatabaseStats,
  type SeamlessHospFilter,
  type SeamlessPayStatusFilter,
  type SeamlessLedgerSortField,
  type SeamlessLedgerItem,
  type SeamlessLedgerQueryParams,
  type SeamlessLedgerResult,
  type SeamlessImportedFileDetail,
} from './seamless-import/typesAndParsers'

export * from './seamless-import/typesAndParsers'

export interface SeamlessImportGatewayAdapter {
  lookupSeamlessBudget: typeof apiGateway.clinical.lookupSeamlessBudget
  resolveSeamlessHospCode: typeof apiGateway.clinical.resolveSeamlessHospCode
  enrichSeamlessImport: typeof apiGateway.clinical.enrichSeamlessImport
  preflightSeamlessCheck: typeof apiGateway.clinical.preflightSeamlessCheck
  getSeamlessStats: typeof apiGateway.clinical.getSeamlessStats
  getSeamlessLedger: typeof apiGateway.clinical.getSeamlessLedger
  getSeamlessFiles: typeof apiGateway.clinical.getSeamlessFiles
  getSeamlessDenyCodes: typeof apiGateway.clinical.getSeamlessDenyCodes
}

const defaultSeamlessGateway: SeamlessImportGatewayAdapter = {
  lookupSeamlessBudget: (payNo) => apiGateway.clinical.lookupSeamlessBudget(payNo),
  resolveSeamlessHospCode: (hospName) => apiGateway.clinical.resolveSeamlessHospCode(hospName),
  enrichSeamlessImport: (payload) => apiGateway.clinical.enrichSeamlessImport(payload),
  preflightSeamlessCheck: (payload) => apiGateway.clinical.preflightSeamlessCheck(payload),
  getSeamlessStats: (myHospCode) => apiGateway.clinical.getSeamlessStats(myHospCode),
  getSeamlessLedger: (params) => apiGateway.clinical.getSeamlessLedger(params),
  getSeamlessFiles: (myHospCode) => apiGateway.clinical.getSeamlessFiles(myHospCode),
  getSeamlessDenyCodes: () => apiGateway.clinical.getSeamlessDenyCodes(),
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
      gateway?: Partial<SeamlessImportGatewayAdapter>
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
    const gw: SeamlessImportGatewayAdapter = { ...defaultSeamlessGateway, ...(options.gateway || {}) }

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
              const budgetRes = await gw.lookupSeamlessBudget(cleanPayNo)
              if (budgetRes?.data?.paydate) {
                summaryInfo.payDate = budgetRes.data.paydate
                summaryInfo.codeAccount = budgetRes.data.accountcode || null
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
        async (hospName) => (await gw.resolveSeamlessHospCode(hospName))?.hospcode || ''
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

    // 4. Batch HOSxP Enrichment via API Gateway: DNAP, CID -> HN/Ptname, HN -> Ptname, VN/AN
    if (autoEnrichHosp && parsedRows.length > 0) {
      // 4a. FoxPro DNAP parity: resolve nap_number -> CID
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
        try {
          const napRes = await gw.enrichSeamlessImport({ napNumbers })
          const napCidMap = new Map<string, string>()
          for (const nr of napRes?.data?.napRows || []) {
            if (nr.nap_number && nr.cid) {
              napCidMap.set(String(nr.nap_number).trim(), String(nr.cid).trim())
            }
          }
          for (const row of parsedRows) {
            if (row.rep.toUpperCase().startsWith('DNAP') && row.pid && napCidMap.has(row.pid)) {
              row.pid = napCidMap.get(row.pid)!
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Batch DNAP nap_number resolution error in Seamless import')
        }
      }

      // 4b & 4c. Resolve HN & Ptname from CID and Ptname/CID from HN
      const cidsToResolve = Array.from(
        new Set(
          parsedRows
            .filter((r) => r.pid && r.pid.length === 13)
            .map((r) => r.pid as string)
        )
      )
      const hnsMissingInfo = Array.from(
        new Set(
          parsedRows
            .filter((r) => r.hn && (!r.ptname || !r.pid))
            .map((r) => r.hn as string)
        )
      )

      if (cidsToResolve.length > 0 || hnsMissingInfo.length > 0) {
        try {
          const ptRes = await gw.enrichSeamlessImport({
            cids: cidsToResolve,
            hnsMissing: hnsMissingInfo,
          })
          const patientMap = new Map<string, { hn: string; ptname: string }>()
          for (const r of ptRes?.data?.cidRows || []) {
            if (r.cid) patientMap.set(r.cid, { hn: r.hn, ptname: r.ptname })
          }
          const hnPatientMap = new Map<string, { cid: string; ptname: string }>()
          for (const r of ptRes?.data?.hnRows || []) {
            if (r.hn) {
              hnPatientMap.set(normalizeHn(r.hn) || r.hn, { cid: r.cid, ptname: r.ptname })
            }
          }

          for (const row of parsedRows) {
            if (row.pid && patientMap.has(row.pid)) {
              const pt = patientMap.get(row.pid)!
              if (!row.hn) row.hn = normalizeHn(pt.hn)
              if (!row.ptname) row.ptname = pt.ptname
            }
            if (row.hn && hnPatientMap.has(row.hn)) {
              const pt = hnPatientMap.get(row.hn)!
              if (!row.pid && pt.cid) row.pid = pt.cid
              if (!row.ptname && pt.ptname) row.ptname = pt.ptname
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Batch patient resolution error in Seamless import')
        }
      }

      // 4d. Resolve VN (ovst) and AN (ipt) for ALL rows that have HN and AdmDate
      const hnDatePairs = parsedRows
        .filter((r) => r.hn && r.admDate && (!r.vn || !r.an))
        .map((r) => ({ hn: r.hn as string, date: r.admDate as string }))

      if (hnDatePairs.length > 0) {
        const uniqueHns = Array.from(new Set(hnDatePairs.map((p) => p.hn)))
        const minDate = hnDatePairs.reduce((min, p) => (p.date < min ? p.date : min), hnDatePairs[0].date)
        const maxDate = hnDatePairs.reduce((max, p) => (p.date > max ? p.date : max), hnDatePairs[0].date)

        try {
          const visitRes = await gw.enrichSeamlessImport({
            ovstLookup: { hns: uniqueHns, minDate, maxDate },
            iptLookup: { hns: uniqueHns, minDate, maxDate },
          })
          const vnMap = new Map<string, string>()
          for (const o of visitRes?.data?.ovstRows || []) {
            const normHn = normalizeHn(o.hn) || o.hn
            vnMap.set(`${normHn}_${o.vstdate}`, o.vn)
          }
          const anMap = new Map<string, string>()
          for (const ip of visitRes?.data?.iptRows || []) {
            if (ip.an && ip.hn && ip.regdate) {
              const normHn = normalizeHn(ip.hn) || ip.hn
              anMap.set(`${normHn}_${ip.regdate}`, normalizeAn(ip.an) || ip.an)
            }
          }

          for (const row of parsedRows) {
            if (row.hn && row.admDate && !row.vn) {
              const key = `${row.hn}_${row.admDate}`
              if (vnMap.has(key)) {
                row.vn = vnMap.get(key)!
              } else if (!row.an && anMap.has(key)) {
                row.an = anMap.get(key)!
                row.department = 'IP'
              }
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Batch visit (VN/AN) resolution error in Seamless import')
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

    // 6. Pre-flight duplicate detection via API Gateway (FileName count + existing IDs)
    let existingFileRowCount = 0
    const existingIdSet = new Set<string>()
    if (uniqueRows.length > 0) {
      try {
        const preflight = await gw.preflightSeamlessCheck({
          fileName,
          ids: uniqueRows.map((r) => r.id),
        })
        existingFileRowCount = Number(preflight?.data?.existingFileRowCount || 0)
        for (const id of preflight?.data?.existingIds || []) {
          if (id) existingIdSet.add(String(id).trim())
        }
      } catch {
        // Non-blocking pre-flight check
      }
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
   * Fetch current stats from database (rcmdb.seamless) via API Gateway with 60s In-Memory Cache
   */
  static async getSeamlessDatabaseStats(
    gateway: Partial<SeamlessImportGatewayAdapter> = defaultSeamlessGateway,
    refresh = false
  ): Promise<SeamlessDatabaseStats> {
    const cacheKey = 'rcm-seamless-stats'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    const gw: SeamlessImportGatewayAdapter = { ...defaultSeamlessGateway, ...gateway }

    return getCachedData(
      cacheKey,
      async () => {
        try {
          const res = await gw.getSeamlessStats(DEFAULT_SEAMLESS_HOSPCODE)
          const d = res?.data
          if (d) {
            return {
              totalRows: Number(d.totalRows || 0),
              totalReps: Number(d.totalReps || 0),
              totalFiles: Number(d.totalFiles || 0),
              latestAdmDate: d.latestAdmDate || null,
              totalCompensated: Number(d.totalCompensated || 0),
              otherHospCount: Number(d.otherHospCount || 0),
              missingPayDateCount: Number(d.missingPayDateCount || 0),
              denyCodeCount: Number(d.denyCodeCount || 0),
              myHospCode: d.myHospCode || DEFAULT_SEAMLESS_HOSPCODE,
              topFunds: (d.topFunds || []).map((f: any) => ({
                fund: f.fund || 'ไม่ระบุกองทุน',
                rowCount: Number(f.rowCount || 0),
                totalCompensated: Number(f.totalCompensated || 0),
              })),
              recentFiles: (d.recentFiles || []).map((rf: any) => ({
                fileName: rf.fileName,
                rowCount: Number(rf.rowCount || 0),
                minDate: rf.minDate,
                maxDate: rf.maxDate,
                totalCompensated: Number(rf.totalCompensated || 0),
              })),
            }
          }
        } catch (err) {
          logger.error({ err }, 'Failed to fetch seamless database statistics')
        }
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
      },
      60_000
    )
  }

  /**
   * Server-paginated ledger of `rcmdb.seamless` records via API Gateway (50 rows/page, 5-Pillar compliant)
   */
  static async getSeamlessLedger(
    params: SeamlessLedgerQueryParams = {},
    gateway: Partial<SeamlessImportGatewayAdapter> = defaultSeamlessGateway
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
    const gw: SeamlessImportGatewayAdapter = { ...defaultSeamlessGateway, ...gateway }

    return getCachedData(
      cacheKey,
      async () => {
        const res = await gw.getSeamlessLedger({
          search,
          fundFilter,
          hospFilter,
          payStatus,
          fileName,
          sortBy,
          sortOrder,
          page,
          pageSize,
          exportAll: Boolean(params.exportAll),
          myHospCode,
        })
        const d = res?.data
        const itemRows = d?.itemRows || []
        const totalCount = Number(d?.totalCount || 0)
        const totalPages = Number(d?.totalPages || Math.max(1, Math.ceil(totalCount / pageSize)))

        const items: SeamlessLedgerItem[] = itemRows.map((r: Record<string, unknown>) => {
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
          availableFunds: (d?.availableFunds || []).map((f) => String(f)).filter(Boolean),
          myHospCode,
        }
      },
      60_000
    )
  }

  /**
   * List all imported Seamless files grouped by FileName via API Gateway
   */
  static async getSeamlessImportedFiles(
    gateway: Partial<SeamlessImportGatewayAdapter> = defaultSeamlessGateway,
    refresh = false
  ): Promise<SeamlessImportedFileDetail[]> {
    const cacheKey = 'rcm-seamless-files'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    const gw: SeamlessImportGatewayAdapter = { ...defaultSeamlessGateway, ...gateway }

    return getCachedData(
      cacheKey,
      async () => {
        const res = await gw.getSeamlessFiles(DEFAULT_SEAMLESS_HOSPCODE)
        const rows = res?.data || []
        return rows.map((r: Record<string, unknown>) => ({
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
   * List DENY CODE dictionary from `rcmdb.seamless_error` via API Gateway
   */
  static async getSeamlessDenyCodes(
    search = '',
    gateway: Partial<SeamlessImportGatewayAdapter> = defaultSeamlessGateway,
    refresh = false
  ): Promise<SeamlessDenyCode[]> {
    const cacheKey = 'rcm-seamless-deny-codes'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    const gw: SeamlessImportGatewayAdapter = { ...defaultSeamlessGateway, ...gateway }

    const allCodes = await getCachedData(
      cacheKey,
      async () => {
        try {
          const res = await gw.getSeamlessDenyCodes()
          return (res?.data || [])
            .map((r: { Code?: string; code?: string; Name?: string; name?: string }) => ({
              code: String(r.Code ?? r.code ?? '').trim(),
              name: String(r.Name ?? r.name ?? '').trim(),
            }))
            .filter((r: SeamlessDenyCode) => r.code)
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
