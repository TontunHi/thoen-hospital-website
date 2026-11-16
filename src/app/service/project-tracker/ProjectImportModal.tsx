'use client'

import React, { useEffect, useRef, useState } from 'react'
import type ExcelJS from 'exceljs'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react'
import {
  detectFiscalYearFromFilename,
  parseProjectImportMatrix,
} from '@/lib/projects/projectTrackerDomain'
import type {
  ProjectBatchImportResult,
  ProjectImportParseResult,
} from '@/lib/projects/projectTrackerTypes'

interface ProjectImportModalProps {
  isOpen: boolean
  currentFiscalYear: number
  availableFiscalYears: number[]
  onClose: () => void
  onImported: (importedFiscalYear?: number) => Promise<void> | void
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
        .map((part) =>
          part && typeof part === 'object' ? String((part as { text?: unknown }).text ?? '') : ''
        )
        .join('')
    }
    if ('result' in obj && obj.result !== undefined) {
      return extractExcelCellValue(obj.result)
    }
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.hyperlink === 'string') return obj.text ?? obj.hyperlink
  }
  return String(raw)
}

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

    if (ch === '"') inQuotes = true
    else if (ch === ',') {
      currentRow.push(currentCell)
      currentCell = ''
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') i += 1
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

function sheetToMatrix(sheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    rows[rowNumber - 1] = values.map(extractExcelCellValue)
  })
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]) rows[i] = []
  }
  return rows
}

async function readBestSheetMatrix(
  file: File
): Promise<{ matrix: unknown[][]; sheetName: string }> {
  const lower = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (lower.endsWith('.csv')) {
    const bytes = new Uint8Array(buffer)
    const utf8 = new TextDecoder('utf-8').decode(bytes)
    const text = utf8.includes('\uFFFD') ? new TextDecoder('windows-874').decode(bytes) : utf8
    return { matrix: parseCsvMatrix(text), sheetName: 'CSV' }
  }

  if (lower.endsWith('.xlsx')) {
    const { default: ExcelJSRuntime } = await import('exceljs')
    const workbook = new ExcelJSRuntime.Workbook()
    await workbook.xlsx.load(buffer)
    if (workbook.worksheets.length === 0) {
      throw new Error('ไม่พบแผ่นงาน (Worksheet) ในไฟล์ Excel')
    }

    // Prefer a sheet whose name indicates project registry data or contains the 'ชื่อโครงการ' header
    const namedDataSheet = workbook.worksheets.find((ws) => {
      const n = ws.name.toLowerCase()
      return n.includes('ทะเบียน') || n.includes('data')
    })
    if (namedDataSheet) {
      const m = sheetToMatrix(namedDataSheet)
      return { matrix: m, sheetName: namedDataSheet.name }
    }

    for (const ws of workbook.worksheets) {
      const m = sheetToMatrix(ws)
      const hasProjectHeader = m.slice(0, 20).some((r) =>
        (r || []).some((cell) => String(cell ?? '').replace(/\s+/g, '').includes('ชื่อโครงการ'))
      )
      if (hasProjectHeader) {
        return { matrix: m, sheetName: ws.name }
      }
    }

    const fallback = workbook.worksheets[0]
    return { matrix: sheetToMatrix(fallback), sheetName: fallback.name }
  }

  throw new Error('รองรับเฉพาะไฟล์ .xlsx หรือ .csv เท่านั้น')
}

export default function ProjectImportModal({
  isOpen,
  currentFiscalYear,
  availableFiscalYears,
  onClose,
  onImported,
}: ProjectImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [targetFiscalYear, setTargetFiscalYear] = useState<number>(currentFiscalYear)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [parseResult, setParseResult] = useState<ProjectImportParseResult | null>(null)
  const [importResult, setImportResult] = useState<ProjectBatchImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setFileName(null)
      setTargetFiscalYear(currentFiscalYear)
      setImportMode('append')
      setParseResult(null)
      setImportResult(null)
      setError(null)
    }
  }, [isOpen, currentFiscalYear])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, importing, onClose])

  if (!isOpen) return null

  const selectableYears = Array.from(
    new Set([targetFiscalYear, ...availableFiscalYears])
  ).sort((a, b) => b - a)

  const handleFileSelected = async (file: File) => {
    setParsing(true)
    setError(null)
    setImportResult(null)
    setFileName(file.name)

    try {
      const hasYearInName = /(25[6-9]\d|26[0-5]\d)/.test(file.name)
      const resolvedFy = hasYearInName
        ? detectFiscalYearFromFilename(file.name)
        : targetFiscalYear
      setTargetFiscalYear(resolvedFy)

      const { matrix, sheetName } = await readBestSheetMatrix(file)
      const parsed = parseProjectImportMatrix(matrix, {
        fiscalYear: resolvedFy,
        sheetName,
      })
      setParseResult(parsed)
    } catch (err: unknown) {
      setParseResult(null)
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ได้')
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return
    setImporting(true)
    setError(null)

    try {
      const payloadRows = parseResult.rows.map((r) => ({
        ...r.data,
        fiscalYear: targetFiscalYear,
      }))

      const res = await fetch('/api/service/project-tracker/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscalYear: targetFiscalYear,
          mode: importMode,
          rows: payloadRows,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถนำเข้าข้อมูลได้')
      }
      setImportResult(json.data)
      await onImported(targetFiscalYear)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างนำเข้าข้อมูล')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="ptModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pt-import-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onClose()
      }}
    >
      <div className="ptModalDialog">
        <div className="ptModalHeader">
          <h2 id="pt-import-modal-title" className="ptModalTitle">
            นำเข้าข้อมูลโครงการจาก Excel / CSV
          </h2>
          <button
            type="button"
            className="ptIconBtn"
            onClick={onClose}
            disabled={importing}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="ptModalBody">
          {error && <div className="ptAlert ptAlertError">{error}</div>}

          {importResult && (
            <div className="ptAlert ptAlertInfo">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} strokeWidth={1.5} />
                นำเข้าข้อมูลสำเร็จ {importResult.inserted.toLocaleString()} โครงการ (ปีงบประมาณ{' '}
                {importResult.fiscalYear})
              </span>
              <button type="button" className="ptBtn ptBtnSm" onClick={onClose}>
                เสร็จสิ้น
              </button>
            </div>
          )}

          <div className="ptFormGrid ptFormGrid2">
            <div className="ptField">
              <label htmlFor="pt-import-fy" className="ptFieldLabel">
                ปีงบประมาณปลายทาง
              </label>
              <select
                id="pt-import-fy"
                className="ptSelect"
                value={String(targetFiscalYear)}
                onChange={(e) => setTargetFiscalYear(Number(e.target.value))}
                disabled={importing}
              >
                {selectableYears.map((fy) => (
                  <option key={fy} value={String(fy)}>
                    ปีงบประมาณ {fy}
                  </option>
                ))}
              </select>
            </div>

            <div className="ptField">
              <label htmlFor="pt-import-mode" className="ptFieldLabel">
                รูปแบบการนำเข้า
              </label>
              <select
                id="pt-import-mode"
                className="ptSelect"
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as 'append' | 'replace')}
                disabled={importing}
              >
                <option value="append">เพิ่มต่อจากรายการเดิมในปีงบนี้</option>
                <option value="replace">แทนที่รายการทั้งหมดในปีงบนี้</option>
              </select>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileSelected(file)
            }}
          />

          <div
            className={`ptDropzone ${dragActive ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void handleFileSelected(file)
            }}
          >
            <Upload size={22} strokeWidth={1.5} />
            <div>
              {parsing
                ? 'กำลังอ่านไฟล์ Excel...'
                : fileName
                  ? `ไฟล์ที่เลือก: ${fileName}`
                  : 'คลิกหรือลากไฟล์ .xlsx / .csv มาวางที่นี่'}
            </div>
            <span className="ptCardMeta">
              รองรับไฟล์รูปแบบทะเบียนคุมโครงการ (.xlsx หรือ .csv)
            </span>
          </div>

          {parseResult && (
            <div className="ptFormSection">
              <div className="ptCardHeader">
                <span className="ptFieldLabel" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <FileSpreadsheet size={16} strokeWidth={1.5} />
                  ชีต: {parseResult.detectedSheetName} · พบ {parseResult.rows.length.toLocaleString()} โครงการ
                </span>
                {parseResult.errors.length > 0 && (
                  <span className="ptCardMeta" style={{ color: 'var(--pt-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertTriangle size={14} strokeWidth={1.5} />
                    ข้ามแถวไม่สมบูรณ์ {parseResult.errors.length} แถว
                  </span>
                )}
              </div>

              {parseResult.rows.length > 0 && (
                <div className="ptPreviewTableWrap">
                  <table className="ptSummaryTable">
                    <thead>
                      <tr>
                        <th>ลำดับ</th>
                        <th>ยุทธศาสตร์</th>
                        <th>ชื่อโครงการ</th>
                        <th>สถานะ</th>
                        <th className="ptNumCol">งบที่ได้รับ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.slice(0, 12).map((item) => {
                        const alloc =
                          (item.data.q1Budget ?? 0) +
                          (item.data.q2Budget ?? 0) +
                          (item.data.q3Budget ?? 0) +
                          (item.data.q4Budget ?? 0)
                        return (
                          <tr key={item.rowNumber}>
                            <td>{item.data.sequenceNo}</td>
                            <td>{item.data.strategy}</td>
                            <td>{item.data.projectName}</td>
                            <td>{item.data.submissionStatus}</td>
                            <td className="ptNumCol">{alloc.toLocaleString('en-US')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {parseResult.rows.length > 12 && (
                <span className="ptCardMeta">
                  แสดงตัวอย่าง 12 รายการแรก จากทั้งหมด {parseResult.rows.length.toLocaleString()} รายการ
                </span>
              )}
            </div>
          )}
        </div>

        <div className="ptModalFooter">
          <button
            type="button"
            className="ptBtn"
            onClick={onClose}
            disabled={importing}
          >
            ปิด
          </button>
          <button
            type="button"
            className="ptBtn ptBtnPrimary"
            disabled={importing || !parseResult || parseResult.rows.length === 0}
            onClick={handleConfirmImport}
          >
            {importing
              ? 'กำลังนำเข้า...'
              : `ยืนยันนำเข้า ${parseResult?.rows.length ?? 0} โครงการ`}
          </button>
        </div>
      </div>
    </div>
  )
}
