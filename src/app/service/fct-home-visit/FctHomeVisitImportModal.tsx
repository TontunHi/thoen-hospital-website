'use client'

import React, { useState, useEffect, useRef } from 'react'
import ExcelJS from 'exceljs'
import { FileSpreadsheet, Upload, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  formatThaiShortDate,
  getThaiFiscalYearFromDate,
  parseFctImportMatrix,
} from '@/lib/clinical/fctHomeVisitDomain'
import type {
  FctBatchImportResult,
  FctImportParseResult,
} from '@/lib/clinical/fctHomeVisitTypes'

interface FctHomeVisitImportModalProps {
  isOpen: boolean
  currentFiscalYear?: number
  onClose: () => void
  onImported: (dominantFiscalYear?: number) => Promise<void> | void
}

function getApiErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const err = (json as { error?: unknown }).error
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}

/**
 * RFC-4180 compliant CSV parser supporting quoted commas, escaped quotes (""),
 * and embedded newlines inside quoted cells.
 */
function parseCsvMatrix(text: string): unknown[][] {
  const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i]

    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          currentCell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        currentCell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      currentRow.push(currentCell)
      currentCell = ''
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') {
        i += 1
      }
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else if (ch === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else {
      currentCell += ch
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}

function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const utf8Text = new TextDecoder('utf-8').decode(bytes)
  if (utf8Text.includes('\uFFFD')) {
    return new TextDecoder('windows-874').decode(bytes)
  }
  return utf8Text
}

function extractExcelCellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return ''
  if (raw instanceof Date || typeof raw === 'number' || typeof raw === 'string') {
    return raw
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (part && typeof part === 'object' ? String((part as { text?: unknown }).text ?? '') : ''))
        .join('')
    }
    if ('result' in obj && obj.result !== undefined) {
      return extractExcelCellValue(obj.result)
    }
    if (typeof obj.text === 'string') {
      return obj.text
    }
    if (typeof obj.hyperlink === 'string') {
      return obj.text ?? obj.hyperlink
    }
  }
  return String(raw)
}

async function readMatrixFromFile(file: File): Promise<unknown[][]> {
  const lowerName = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (lowerName.endsWith('.csv')) {
    const text = decodeCsvBytes(buffer)
    return parseCsvMatrix(text)
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const sheet = workbook.worksheets[0]
      if (!sheet) {
        throw new Error('ไม่พบแผ่นงาน (Worksheet) ในไฟล์ Excel')
      }
      const rows: unknown[][] = []
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : []
        rows[rowNumber - 1] = values.map(extractExcelCellValue)
      })
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i]) rows[i] = []
      }
      return rows
    } catch {
      if (lowerName.endsWith('.xls')) {
        throw new Error('ไฟล์ .xls รุ่นเก่าไม่รองรับโดยตรง กรุณาบันทึกเป็น .xlsx หรือ .csv (UTF-8) แล้วลองใหม่อีกครั้ง')
      }
      throw new Error('ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียหาย')
    }
  }

  throw new Error('รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv เท่านั้น')
}

export default function FctHomeVisitImportModal({
  isOpen,
  currentFiscalYear,
  onClose,
  onImported,
}: FctHomeVisitImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [parseResult, setParseResult] = useState<FctImportParseResult | null>(null)
  const [importResult, setImportResult] = useState<FctBatchImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setFileName(null)
      setParsing(false)
      setImporting(false)
      setDragActive(false)
      setParseResult(null)
      setImportResult(null)
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !importing && !parsing) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, importing, parsing, onClose])

  if (!isOpen) return null

  const processFile = async (file: File) => {
    setParsing(true)
    setError(null)
    setImportResult(null)
    setFileName(file.name)
    try {
      const matrix = await readMatrixFromFile(file)
      const parsed = parseFctImportMatrix(matrix)
      setParseResult(parsed)
    } catch (err: unknown) {
      setParseResult(null)
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอ่านไฟล์')
    } finally {
      setParsing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void processFile(file)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void processFile(file)
    }
  }

  const datedFiscalYearMap = new Map<number, number>()
  if (parseResult) {
    for (const row of parseResult.validRows) {
      if (row.data.visitDate) {
        const fy = getThaiFiscalYearFromDate(row.data.visitDate)
        datedFiscalYearMap.set(fy, (datedFiscalYearMap.get(fy) ?? 0) + 1)
      }
    }
  }
  const datedBreakdown = Array.from(datedFiscalYearMap.entries()).sort(
    (a, b) => b[1] - a[1] || b[0] - a[0]
  )
  const dominantFiscalYear = datedBreakdown[0]?.[0] ?? currentFiscalYear

  const fiscalYearMap = new Map<number, number>()
  if (parseResult) {
    for (const row of parseResult.validRows) {
      const fy = getThaiFiscalYearFromDate(row.data.visitDate, dominantFiscalYear)
      fiscalYearMap.set(fy, (fiscalYearMap.get(fy) ?? 0) + 1)
    }
  }
  const fiscalYearBreakdown = Array.from(fiscalYearMap.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const todayBangkokIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(
    new Date()
  )
  const futureDateCount = parseResult
    ? parseResult.validRows.filter((r) => Boolean(r.data.visitDate && r.data.visitDate > todayBangkokIso))
        .length
    : 0

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return

    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/service/fct-home-visit/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parseResult.validRows.map((r) => ({
            ...r.data,
            fiscalYear: r.data.visitDate ? undefined : (r.data.fiscalYear ?? dominantFiscalYear),
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data) {
        throw new Error(getApiErrorMessage(json, 'นำเข้าข้อมูลไม่สำเร็จ'))
      }
      setImportResult(json.data as FctBatchImportResult)
      await onImported(dominantFiscalYear)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างนำเข้าข้อมูล')
    } finally {
      setImporting(false)
    }
  }

  const warningRowCount = parseResult
    ? parseResult.validRows.filter((r) => r.warnings.length > 0).length
    : 0

  return (
    <div
      className="fctModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fct-import-title"
    >
      <div className="fctModal">
        <div className="fctModalHeader">
          <h2 id="fct-import-title" className="fctModalTitle">
            นำเข้าข้อมูลการเยี่ยมบ้านทีม FCT (Excel / CSV)
          </h2>
          <button
            type="button"
            className="fctBtn fctBtnSm"
            onClick={onClose}
            aria-label="ปิดหน้าต่างนำเข้า"
            disabled={importing}
          >
            <X size={16} />
          </button>
        </div>

        <div className="fctModalBody">
          <p className="fctModalDesc">
            รองรับไฟล์แม่แบบ Excel (.xlsx) และไฟล์ CSV (UTF-8 หรือ Windows-874) โดยระบบจะตรวจสอบวันที่เยี่ยมบ้าน ชื่อ-สกุล และปรับรูปแบบ HN ให้อัตโนมัติก่อนบันทึก
          </p>

          <div
            className={`fctDropzone ${dragActive ? 'fctDropzoneActive' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              aria-label="เลือกไฟล์ Excel หรือ CSV"
              className="fctFileInputHidden"
              onChange={handleFileChange}
            />
            <Upload size={22} strokeWidth={1.5} />
            <strong>
              {fileName ? `ไฟล์ที่เลือก: ${fileName}` : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}
            </strong>
            <span className="fctCardMeta">รองรับ .xlsx, .xls, .csv</span>
          </div>

          {parsing && <div className="fctAlert fctAlertInfo">กำลังอ่านและตรวจสอบข้อมูลในไฟล์...</div>}
          {error && <div className="fctAlert fctAlertError">{error}</div>}

          {importResult && (
            <div className="fctSectionBox">
              <div className="fctAlert fctAlertInfo">
                <span>
                  <CheckCircle2
                    size={16}
                    style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.35rem' }}
                  />
                  นำเข้าสำเร็จ <strong>{importResult.insertedCount.toLocaleString()}</strong> รายการ · ข้ามรายการซ้ำ{' '}
                  <strong>{importResult.skippedDuplicateCount.toLocaleString()}</strong> รายการ
                  {importResult.errorCount > 0 ? ` · ผิดพลาด ${importResult.errorCount} รายการ` : ''}
                </span>
              </div>

              {importResult.duplicates.length > 0 && (
                <div className="fctIssueBox fctFieldSpaced">
                  <h4 className="fctIssueBoxTitle">
                    รายการที่ข้ามเนื่องจากข้อมูลซ้ำ ({importResult.duplicates.length} รายการ)
                  </h4>
                  <ul className="fctIssueList">
                    {importResult.duplicates.map((dup, idx) => (
                      <li key={`${dup.rowNumber}-${idx}`}>
                        แถว {dup.rowNumber}: {dup.patientName} (HN {dup.hn || '-'}) · วันที่{' '}
                        {formatThaiShortDate(dup.visitDate)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {parseResult && !importResult && (
            <>
              <div className="fctImportStats">
                <div className="fctImportStatCard">
                  <span className="fctImportStatLabel">ตรวจสอบทั้งหมด</span>
                  <span className="fctImportStatNum">
                    {parseResult.totalScanned.toLocaleString()} แถว
                  </span>
                </div>
                <div className="fctImportStatCard">
                  <span className="fctImportStatLabel">พร้อมนำเข้า</span>
                  <span className="fctImportStatNum fctImportStatNumSuccess">
                    {parseResult.validRows.length.toLocaleString()} แถว
                  </span>
                </div>
                <div className="fctImportStatCard">
                  <span className="fctImportStatLabel">มีคำเตือน</span>
                  <span className="fctImportStatNum fctImportStatNumWarning">
                    {warningRowCount.toLocaleString()} แถว
                  </span>
                </div>
                <div className="fctImportStatCard">
                  <span className="fctImportStatLabel">ข้อมูลไม่สมบูรณ์ (ข้าม)</span>
                  <span className="fctImportStatNum fctImportStatNumDanger">
                    {parseResult.errors.length.toLocaleString()} แถว
                  </span>
                </div>
              </div>

              {fiscalYearBreakdown.length > 0 && (
                <div
                  className={`fctAlert ${
                    fiscalYearBreakdown.length > 1 || futureDateCount > 0
                      ? 'fctAlertWarning'
                      : 'fctAlertInfo'
                  }`}
                >
                  <div>
                    <div>
                      <strong>ปีงบประมาณที่จะบันทึก:</strong>{' '}
                      {fiscalYearBreakdown
                        .map(([fy, count]) => `ปีงบ ${fy} (${count.toLocaleString()} รายการ)`)
                        .join(' · ')}
                    </div>
                    {(fiscalYearBreakdown.length > 1 || futureDateCount > 0) && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.85em' }}>
                        {futureDateCount > 0
                          ? `พบวันที่เยี่ยมบ้านในอนาคต ${futureDateCount.toLocaleString()} แถว — `
                          : ''}
                        กรุณาตรวจสอบวันที่เยี่ยมบ้านของแถวที่อยู่คนละปีงบประมาณก่อนยืนยันนำเข้า
                      </div>
                    )}
                  </div>
                </div>
              )}

              {parseResult.errors.length > 0 && (
                <div className="fctIssueBox">
                  <h4 className="fctIssueBoxTitle">
                    <AlertTriangle
                      size={14}
                      style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.3rem' }}
                    />
                    รายการที่ไม่สามารถนำเข้าได้ ({parseResult.errors.length} แถว)
                  </h4>
                  <ul className="fctIssueList">
                    {parseResult.errors.map((errItem, idx) => (
                      <li key={`${errItem.rowNumber}-${idx}`}>
                        แถว {errItem.rowNumber} ({errItem.patientName}): {errItem.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parseResult.validRows.length > 0 && (
                <div className="fctPreviewWrap">
                  <table className="fctPreviewTable">
                    <thead>
                      <tr>
                        <th>แถว</th>
                        <th>ปีงบ</th>
                        <th>วันที่เยี่ยม</th>
                        <th>ชื่อ-สกุล</th>
                        <th>HN</th>
                        <th>รพ.สต.</th>
                        <th>กลุ่ม ADL</th>
                        <th>ผลลัพธ์</th>
                        <th>คำเตือน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.validRows.map((row) => {
                        const rowFy = getThaiFiscalYearFromDate(row.data.visitDate, dominantFiscalYear)
                        const isFuture = Boolean(row.data.visitDate && row.data.visitDate > todayBangkokIso)
                        const rowWarnings = isFuture
                          ? [...row.warnings, `วันที่ในอนาคต (ปีงบ ${rowFy})`]
                          : row.warnings
                        return (
                          <tr key={row.rowNumber}>
                            <td>{row.rowNumber}</td>
                            <td>{rowFy}</td>
                            <td>{formatThaiShortDate(row.data.visitDate)}</td>
                            <td>{row.data.patientName}</td>
                            <td>{row.data.hn || '-'}</td>
                            <td>{row.data.pcuName || '-'}</td>
                            <td>{row.data.adlGroup || '-'}</td>
                            <td>{row.data.visitOutcome || '-'}</td>
                            <td>
                              {rowWarnings.length === 0 ? (
                                '-'
                              ) : (
                                rowWarnings.map((w, i) => (
                                  <span key={i} className="fctWarnBadge">
                                    {w}
                                  </span>
                                ))
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="fctModalFooter">
          <button
            type="button"
            className="fctBtn"
            onClick={onClose}
            disabled={importing}
          >
            {importResult ? 'ปิด' : 'ยกเลิก'}
          </button>
          {!importResult && (
            <button
              type="button"
              className="fctBtn fctBtnPrimary"
              onClick={handleConfirmImport}
              disabled={
                importing ||
                parsing ||
                !parseResult ||
                parseResult.validRows.length === 0
              }
            >
              <FileSpreadsheet size={16} strokeWidth={1.5} />
              {importing
                ? 'กำลังนำเข้า...'
                : `ยืนยันนำเข้า ${parseResult?.validRows.length ?? 0} รายการ`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
