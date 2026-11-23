'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  FileOutput,
  RefreshCw,
  Search,
  Settings,
  Copy,
  Trash2,
  BarChart3,
  Table2,
  X,
  FlaskConical,
} from 'lucide-react'
import {
  getCurrentThaiFiscalYear,
} from '@/lib/clinical/dmRemissionDomain'
import {
  DM_A1C_OUTCOMES,
  DM_MEDS_OUTCOMES,
  DM_REMISSION_EXCEL_COLUMNS,
  DM_WAIST_OUTCOMES,
  DM_WEIGHT_OUTCOMES,
  type DmOptionCategory,
  type DmRemissionCohortRecord,
  type DmRemissionListResult,
  type DmRemissionOptionRecord,
} from '@/lib/clinical/dmRemissionTypes'
import DmRemissionDashboard from './DmRemissionDashboard'
import DmRemissionFormModal from './DmRemissionFormModal'
import DmRemissionSettingsModal from './DmRemissionSettingsModal'
import DmRemissionCarryoverModal from './DmRemissionCarryoverModal'

interface DmRemissionClientProps {
  userRole: string
  canManage?: boolean
  initialFiscalYear?: number
}

type EditableCohortField =
  | 'pcuName'
  | 'patientName'
  | 'cid'
  | 'hn'
  | 'age'
  | 'underlyingDiseases'
  | 'heightCm'
  | 'weightBeforeKg'
  | 'weightAfterKg'
  | 'waistBeforeCm'
  | 'waistAfterCm'
  | 'fpgBefore'
  | 'fpgAfter'
  | 'a1cBefore'
  | 'a1cAfter'
  | 'a1cPostStop3m'
  | 'medsBefore'
  | 'medsAfter'
  | 'summaryA1c'
  | 'summaryMeds'
  | 'summaryWeight'
  | 'summaryWaist'
  | 'summaryDiet'
  | 'summaryExercise'
  | 'summaryIf'
  | 'summaryRemission'

type SheetColumnKey = EditableCohortField | 'rowIndex' | 'bmiBefore' | 'bmiAfter'

type SheetCellKind = 'readonly' | 'text' | 'number' | 'integer' | 'textarea' | 'select'

interface SheetColumnDef {
  key: SheetColumnKey
  header: string
  width: string
  kind: SheetCellKind
  groupStart?: boolean
  step?: string
  digits?: number
  semibold?: boolean
  trendColor?: boolean
  remissionBadge?: boolean
  getSelectOptions?: (
    row: DmRemissionCohortRecord,
    opts: Record<DmOptionCategory, DmRemissionOptionRecord[]>,
    availablePcus: string[]
  ) => string[]
}

function mergeUniqueOptions(presets: readonly string[], current: string | null): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  for (const label of presets) {
    const clean = label.trim()
    if (clean && !seen.has(clean)) {
      seen.add(clean)
      list.push(clean)
    }
  }
  if (current && current.trim() && !seen.has(current.trim())) {
    list.push(current.trim())
  }
  return list
}

function activeOptionLabels(
  opts: Record<DmOptionCategory, DmRemissionOptionRecord[]>,
  category: DmOptionCategory
): string[] {
  return (opts[category] || []).filter((o) => o.isActive).map((o) => o.label)
}

const SHEET_COLUMNS: readonly SheetColumnDef[] = [
  {
    key: 'pcuName',
    header: 'รพ.สต.',
    width: '9.5rem',
    kind: 'select',
    getSelectOptions: (row, opts, availablePcus) =>
      mergeUniqueOptions(
        [...activeOptionLabels(opts, 'pcu'), ...availablePcus],
        row.pcuName
      ),
  },
  { key: 'rowIndex', header: 'ลำดับ', width: '3.75rem', kind: 'readonly' },
  { key: 'patientName', header: 'ชื่อ-นามสกุล', width: '12.5rem', kind: 'text', semibold: true },
  { key: 'cid', header: 'เลขบัตรประชาชน', width: '9.5rem', kind: 'text' },
  { key: 'hn', header: 'HN รพ.', width: '6.25rem', kind: 'text' },
  { key: 'age', header: 'อายุ', width: '4.25rem', kind: 'integer', step: '1' },
  { key: 'underlyingDiseases', header: 'U/D อื่นเช่น HT DLP CKD', width: '11rem', kind: 'text' },
  {
    key: 'heightCm',
    header: 'ส่วนสูง',
    width: '5.5rem',
    kind: 'number',
    step: '0.1',
    digits: 1,
    groupStart: true,
  },
  { key: 'weightBeforeKg', header: 'น้ำหนัก ก่อน (kg)', width: '6.5rem', kind: 'number', step: '0.1', digits: 1 },
  { key: 'bmiBefore', header: 'BMI ก่อน (auto)', width: '6.25rem', kind: 'readonly', digits: 2, semibold: true },
  { key: 'weightAfterKg', header: 'น้ำหนัก หลัง (kg)', width: '6.5rem', kind: 'number', step: '0.1', digits: 1 },
  { key: 'bmiAfter', header: 'BMI หลัง (auto)', width: '6.25rem', kind: 'readonly', digits: 2, semibold: true },
  { key: 'waistBeforeCm', header: 'รอบเอว ก่อน (cm)', width: '6.5rem', kind: 'number', step: '0.1', digits: 1 },
  { key: 'waistAfterCm', header: 'รอบเอว หลัง (cm)', width: '6.5rem', kind: 'number', step: '0.1', digits: 1 },
  {
    key: 'fpgBefore',
    header: 'FPG ก่อน',
    width: '5.75rem',
    kind: 'number',
    step: '0.1',
    digits: 1,
    groupStart: true,
  },
  { key: 'fpgAfter', header: 'FPG หลัง', width: '5.75rem', kind: 'number', step: '0.1', digits: 1 },
  { key: 'a1cBefore', header: 'A1c ก่อน', width: '5.5rem', kind: 'number', step: '0.01', digits: 2 },
  { key: 'a1cAfter', header: 'A1c หลัง', width: '5.5rem', kind: 'number', step: '0.01', digits: 2 },
  {
    key: 'a1cPostStop3m',
    header: 'A1c หลังหยุดยา 3 เดือน',
    width: '7.75rem',
    kind: 'number',
    step: '0.01',
    digits: 2,
  },
  {
    key: 'medsBefore',
    header: 'ยา ก่อน (ชื่อยา, dose)',
    width: '14rem',
    kind: 'textarea',
    groupStart: true,
  },
  { key: 'medsAfter', header: 'ยา หลัง (ชื่อยา, dose)', width: '14rem', kind: 'textarea' },
  {
    key: 'summaryA1c',
    header: 'สรุป A1c',
    width: '7.5rem',
    kind: 'select',
    groupStart: true,
    trendColor: true,
    getSelectOptions: (row) => mergeUniqueOptions(DM_A1C_OUTCOMES, row.summaryA1c),
  },
  {
    key: 'summaryMeds',
    header: 'สรุป ยาเบาหวาน',
    width: '10.5rem',
    kind: 'select',
    trendColor: true,
    getSelectOptions: (row) => mergeUniqueOptions(DM_MEDS_OUTCOMES, row.summaryMeds),
  },
  {
    key: 'summaryWeight',
    header: 'สรุป น้ำหนัก',
    width: '7.5rem',
    kind: 'select',
    trendColor: true,
    getSelectOptions: (row) => mergeUniqueOptions(DM_WEIGHT_OUTCOMES, row.summaryWeight),
  },
  {
    key: 'summaryWaist',
    header: 'สรุป รอบเอว',
    width: '7.5rem',
    kind: 'select',
    trendColor: true,
    getSelectOptions: (row) => mergeUniqueOptions(DM_WAIST_OUTCOMES, row.summaryWaist),
  },
  {
    key: 'summaryDiet',
    header: 'สรุป การปรับอาหาร',
    width: '10rem',
    kind: 'select',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(activeOptionLabels(opts, 'diet'), row.summaryDiet),
  },
  {
    key: 'summaryExercise',
    header: 'สรุป การออกกำลังกาย',
    width: '10rem',
    kind: 'select',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(activeOptionLabels(opts, 'exercise'), row.summaryExercise),
  },
  {
    key: 'summaryIf',
    header: 'สรุป IF',
    width: '8.5rem',
    kind: 'select',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(activeOptionLabels(opts, 'if_fasting'), row.summaryIf),
  },
  {
    key: 'summaryRemission',
    header: 'สรุป Remission',
    width: '9.5rem',
    kind: 'select',
    remissionBadge: true,
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(activeOptionLabels(opts, 'remission'), row.summaryRemission),
  },
] as const

const EDITABLE_COLUMNS = SHEET_COLUMNS.filter(
  (col): col is SheetColumnDef & { key: EditableCohortField } => col.kind !== 'readonly'
)

function getRemissionBadgeClass(status: string | null): string {
  if (status === 'Remission') return 'dmrBadge dmrBadgeSuccess'
  if (status === 'ไม่ Remission') return 'dmrBadge dmrBadgeDanger'
  if (status === 'รอ lab A1c') return 'dmrBadge dmrBadgeWarning'
  return 'dmrBadge dmrBadgeNeutral'
}

function getTrendClass(val: string | null): string {
  if (!val) return ''
  if (val.includes('ลด') || val.includes('หยุด') || val.includes('off')) {
    return 'dmrTrendGood'
  }
  if (val.includes('เพิ่ม')) {
    return 'dmrTrendUp'
  }
  return ''
}

function fmtNum(val: number | null | undefined, digits?: number): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '-'
  return digits !== undefined ? val.toFixed(digits) : String(val)
}

function readRawCellString(row: DmRemissionCohortRecord, field: EditableCohortField): string {
  const val = row[field]
  if (val === null || val === undefined) return ''
  return String(val)
}

export default function DmRemissionClient({
  userRole,
  canManage,
  initialFiscalYear,
}: DmRemissionClientProps) {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(
    initialFiscalYear ?? null
  )
  const [pcuFilter, setPcuFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeView, setActiveView] = useState<'both' | 'dashboard' | 'table'>('both')

  const [data, setData] = useState<DmRemissionListResult | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState<boolean>(false)

  const [formOpen, setFormOpen] = useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [carryoverOpen, setCarryoverOpen] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Sheet-like active cell editing state
  const [activeCell, setActiveCell] = useState<{
    rowId: number
    field: EditableCohortField
  } | null>(null)
  const [draftValue, setDraftValue] = useState<string>('')
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null)
  const skipBlurRef = useRef<boolean>(false)

  const fiscalYear = selectedFiscalYear ?? data?.fiscalYear ?? null
  const isAdmin = userRole === 'admin'
  const hasManagePermission = isAdmin || (canManage ?? false)
  const hasActiveFilters = Boolean(pcuFilter || statusFilter || searchInput.trim())

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const params = new URLSearchParams()
        if (selectedFiscalYear !== null) {
          params.set('fiscalYear', String(selectedFiscalYear))
        }
        if (pcuFilter) params.set('pcuName', pcuFilter)
        if (statusFilter) params.set('remissionStatus', statusFilter)
        if (searchQuery) params.set('search', searchQuery)

        const query = params.toString()
        const res = await fetch(
          query ? `/api/service/dm-remission?${query}` : '/api/service/dm-remission',
          { cache: 'no-store' }
        )
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'ไม่สามารถโหลดข้อมูล DM Remission ได้')
        }
        setData(json.data as DmRemissionListResult)
      } catch (err: unknown) {
        if (!opts?.silent) {
          setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }
      } finally {
        if (!opts?.silent) {
          setLoading(false)
        }
      }
    },
    [selectedFiscalYear, pcuFilter, statusFilter, searchQuery]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleResetFilters = () => {
    setPcuFilter('')
    setStatusFilter('')
    setSearchInput('')
    setSearchQuery('')
  }

  const startCellEdit = (row: DmRemissionCohortRecord, col: SheetColumnDef) => {
    if (col.kind === 'readonly') return
    const field = col.key as EditableCohortField
    skipBlurRef.current = false
    setError(null)
    setActiveCell({ rowId: row.id, field })
    setDraftValue(readRawCellString(row, field))
  }

  const cancelCellEdit = () => {
    skipBlurRef.current = true
    setActiveCell(null)
  }

  const moveToAdjacentEditableCell = (
    currentRowId: number,
    currentField: EditableCohortField,
    optionsMove: { horizontal?: -1 | 1; vertical?: -1 | 1 }
  ) => {
    if (!data) return
    const rowIdx = data.items.findIndex((r) => r.id === currentRowId)
    const colIdx = EDITABLE_COLUMNS.findIndex((c) => c.key === currentField)
    if (rowIdx === -1 || colIdx === -1) {
      setActiveCell(null)
      return
    }

    let nextRowIdx = rowIdx
    let nextColIdx = colIdx

    if (optionsMove.horizontal) {
      nextColIdx += optionsMove.horizontal
      if (nextColIdx >= EDITABLE_COLUMNS.length) {
        nextColIdx = 0
        nextRowIdx += 1
      } else if (nextColIdx < 0) {
        nextColIdx = EDITABLE_COLUMNS.length - 1
        nextRowIdx -= 1
      }
    } else if (optionsMove.vertical) {
      nextRowIdx += optionsMove.vertical
    }

    const nextRow = data.items[nextRowIdx]
    const nextCol = EDITABLE_COLUMNS[nextColIdx]
    if (!nextRow || !nextCol) {
      setActiveCell(null)
      return
    }

    skipBlurRef.current = true
    setActiveCell({ rowId: nextRow.id, field: nextCol.key })
    setDraftValue(readRawCellString(nextRow, nextCol.key))
  }

  const commitCellEdit = async (
    row: DmRemissionCohortRecord,
    col: SheetColumnDef,
    nextRawValue: string,
    moveAfter?: { horizontal?: -1 | 1; vertical?: -1 | 1 }
  ) => {
    if (col.kind === 'readonly') return
    const field = col.key as EditableCohortField
    const prevRaw = readRawCellString(row, field)
    const trimmed = nextRawValue.trim()

    if (moveAfter) {
      moveToAdjacentEditableCell(row.id, field, moveAfter)
    } else {
      skipBlurRef.current = true
      setActiveCell(null)
    }

    if (field === 'patientName' && trimmed === '') {
      setError('กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
      return
    }

    if (trimmed === prevRaw.trim()) {
      return
    }

    let payloadValue: string | number | null
    if (trimmed === '') {
      payloadValue = null
    } else if (col.kind === 'number' || col.kind === 'integer') {
      const num = Number(trimmed)
      if (!Number.isFinite(num) || (col.kind === 'integer' && !Number.isInteger(num))) {
        setError(`${col.header}ต้องเป็นตัวเลขที่ถูกต้อง`)
        return
      }
      payloadValue = num
    } else {
      payloadValue = trimmed
    }

    const cellKey = `${row.id}:${field}`
    setSavingCellKey(cellKey)
    setError(null)
    try {
      const res = await fetch(`/api/service/dm-remission/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: payloadValue }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || `ไม่สามารถบันทึกช่อง "${col.header}" ได้`)
      }

      const updatedRecord = json.data as DmRemissionCohortRecord
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) => (item.id === row.id ? updatedRecord : item)),
            }
          : prev
      )
      await fetchData({ silent: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSavingCellKey((curr) => (curr === cellKey ? null : curr))
    }
  }

  const handleDelete = async (record: DmRemissionCohortRecord) => {
    const confirmed = window.confirm(
      `ต้องการลบข้อมูลของ "${record.patientName}" ออกจากปีงบประมาณ ${record.fiscalYear} ใช่หรือไม่`
    )
    if (!confirmed) return

    setDeletingId(record.id)
    setError(null)
    try {
      const res = await fetch(`/api/service/dm-remission/${record.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถลบข้อมูลได้')
      }
      setNotice('ลบข้อมูลเรียบร้อยแล้ว')
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setDeletingId(null)
    }
  }

  const handleExportExcel = async () => {
    if (!data || data.items.length === 0) return
    setExporting(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'โรงพยาบาลเถิน (Thoen Hospital)'
      workbook.created = new Date()
      const exportFy = data.fiscalYear
      const sheet = workbook.addWorksheet(`DM_Remission_${exportFy}`, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      })

      sheet.columns = DM_REMISSION_EXCEL_COLUMNS.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width,
      }))

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D7446' },
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

      data.items.forEach((row, index) => {
        const recordValues: Record<string, string | number | null> = {}
        for (const col of DM_REMISSION_EXCEL_COLUMNS) {
          recordValues[col.key] = col.getValue(row, index)
        }
        sheet.addRow(recordValues)
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dm-remission-fy${exportFy}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExporting(false)
    }
  }

  const populatedFiscalYears = data?.availableFiscalYears ?? []
  const availableFiscalYears =
    fiscalYear !== null && !populatedFiscalYears.includes(fiscalYear)
      ? [...populatedFiscalYears, fiscalYear].sort((a, b) => b - a)
      : populatedFiscalYears
  const availablePcus = data?.availablePcus ?? []
  const items = data?.items ?? []
  const options: Record<DmOptionCategory, DmRemissionOptionRecord[]> = data?.options ?? {
    remission: [],
    diet: [],
    exercise: [],
    if_fasting: [],
    pcu: [],
  }

  const remissionFilterOptions = Array.from(
    new Set([
      ...(options.remission || []).filter((o) => o.isActive).map((o) => o.label),
      ...Object.keys(data?.stats.statusCounts || {}),
    ])
  )

  const renderCellContent = (row: DmRemissionCohortRecord, idx: number, col: SheetColumnDef) => {
    if (col.key === 'rowIndex') {
      return <span>{idx + 1}</span>
    }

    if (col.key === 'bmiBefore' || col.key === 'bmiAfter') {
      return <span>{fmtNum(row[col.key], col.digits)}</span>
    }

    const field = col.key as EditableCohortField
    const isEditing = activeCell?.rowId === row.id && activeCell?.field === field
    const isSaving = savingCellKey === `${row.id}:${field}`

    if (isEditing) {
      if (col.kind === 'select') {
        const choices = col.getSelectOptions ? col.getSelectOptions(row, options, availablePcus) : []
        return (
          <select
            autoFocus
            aria-label={`เลือก ${col.header} ของ ${row.patientName}`}
            className="dmrSheetCellSelect"
            value={draftValue}
            onChange={(e) => {
              void commitCellEdit(row, col, e.target.value)
            }}
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false
                return
              }
              setActiveCell(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelCellEdit()
              } else if (e.key === 'Tab') {
                e.preventDefault()
                void commitCellEdit(row, col, draftValue, { horizontal: e.shiftKey ? -1 : 1 })
              }
            }}
          >
            <option value="">-- ไม่ระบุ --</option>
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        )
      }

      if (col.kind === 'textarea') {
        return (
          <textarea
            autoFocus
            aria-label={`กรอก ${col.header} ของ ${row.patientName}`}
            className="dmrSheetCellTextarea"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false
                return
              }
              void commitCellEdit(row, col, draftValue)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelCellEdit()
              } else if (e.key === 'Tab') {
                e.preventDefault()
                void commitCellEdit(row, col, draftValue, { horizontal: e.shiftKey ? -1 : 1 })
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void commitCellEdit(row, col, draftValue, { vertical: 1 })
              }
            }}
          />
        )
      }

      return (
        <input
          autoFocus
          type={col.kind === 'number' || col.kind === 'integer' ? 'number' : 'text'}
          step={col.step}
          aria-label={`กรอก ${col.header} ของ ${row.patientName}`}
          className="dmrSheetCellInput"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onBlur={() => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false
              return
            }
            void commitCellEdit(row, col, draftValue)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelCellEdit()
            } else if (e.key === 'Tab') {
              e.preventDefault()
              void commitCellEdit(row, col, draftValue, { horizontal: e.shiftKey ? -1 : 1 })
            } else if (e.key === 'Enter') {
              e.preventDefault()
              void commitCellEdit(row, col, draftValue, { vertical: e.shiftKey ? -1 : 1 })
            }
          }}
        />
      )
    }

    const rawVal = row[field]
    const displayText =
      col.kind === 'number' || col.kind === 'integer'
        ? fmtNum(typeof rawVal === 'number' ? rawVal : null, col.digits)
        : typeof rawVal === 'string' && rawVal.trim() !== ''
          ? rawVal
          : '-'

    if (col.remissionBadge) {
      return (
        <span className={`dmrSheetDisplay ${isSaving ? 'dmrSheetCellSaving' : ''}`}>
          <span className={getRemissionBadgeClass(typeof rawVal === 'string' ? rawVal : null)}>
            <span className="dmrBadgeDot" aria-hidden="true" />
            {typeof rawVal === 'string' && rawVal.trim() !== '' ? rawVal : 'ยังไม่ระบุ'}
          </span>
        </span>
      )
    }

    const trendClass = col.trendColor ? getTrendClass(typeof rawVal === 'string' ? rawVal : null) : ''
    const isMuted = displayText === '-'

    return (
      <span
        className={`dmrSheetDisplay ${trendClass} ${isMuted ? 'dmrSheetCellMuted' : ''} ${isSaving ? 'dmrSheetCellSaving' : ''}`}
      >
        {displayText}
      </span>
    )
  }

  return (
    <div className="dmrPage" data-theme="light">
      <div className="dmrContainer">
        <header className="dmrHeader">
          <div>
            <Link href="/service" className="dmrBackLink">
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span>กลับหน้าระบบสารสนเทศภายใน</span>
            </Link>
            <div className="dmrTitleRow">
              <h1 className="dmrTitle">DM Remission</h1>
              <span className="dmrFyBadge">
                <span className="dmrFyDot" aria-hidden="true" />
                {fiscalYear !== null ? `ปีงบประมาณ ${fiscalYear}` : 'กำลังโหลด...'}
              </span>
              {!hasManagePermission && (
                <span className="dmrViewOnlyBadge">สิทธิ์ดูข้อมูลอย่างเดียว</span>
              )}
            </div>
            <p className="dmrSubtitle">
              ทะเบียนติดตามผู้ป่วยเบาหวานเข้าสู่ระยะสงบ และรายงานสรุปผลรายหน่วยบริการ รพ.เถิน
            </p>
          </div>

          <div className="dmrHeaderActions">
            <Link
              href="/service/dm-remission/lab-tracking"
              className="dmrBtn"
            >
              <FlaskConical size={16} strokeWidth={1.5} />
              ติดตามการเจาะ
            </Link>
            <button
              type="button"
              className="dmrBtn"
              onClick={() => fetchData()}
              disabled={loading}
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              รีเฟรช
            </button>
            {hasManagePermission && (
              <button
                type="button"
                className="dmrBtn"
                onClick={() => setCarryoverOpen(true)}
              >
                <Copy size={16} strokeWidth={1.5} />
                คัดลอกข้ามปีงบ
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="dmrBtn"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={16} strokeWidth={1.5} />
                ตั้งค่าตัวเลือก
              </button>
            )}
            <button
              type="button"
              className="dmrBtn"
              onClick={handleExportExcel}
              disabled={exporting || items.length === 0}
            >
              <FileOutput size={16} strokeWidth={1.5} />
              {exporting ? 'กำลังส่งออก' : 'Export Excel'}
            </button>
            {hasManagePermission && (
              <button
                type="button"
                className="dmrBtn dmrBtnPrimary"
                onClick={() => setFormOpen(true)}
              >
                <Plus size={16} strokeWidth={1.5} />
                เพิ่มผู้ป่วย
              </button>
            )}
          </div>
        </header>

        {error && <div className="dmrAlert dmrAlertError">{error}</div>}
        {notice && (
          <div className="dmrAlert dmrAlertInfo">
            <span>{notice}</span>
            <button type="button" className="dmrBtn dmrBtnSm" onClick={() => setNotice(null)}>
              ปิด
            </button>
          </div>
        )}

        <div className="dmrControlBar">
          <div className="dmrFilterGroup">
            <select
              aria-label="เลือกปีงบประมาณ"
              className="dmrSelect"
              value={fiscalYear !== null ? String(fiscalYear) : ''}
              disabled={availableFiscalYears.length === 0}
              onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
            >
              {availableFiscalYears.map((fy) => (
                <option key={fy} value={String(fy)}>
                  ปีงบประมาณ {fy}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตาม รพ.สต."
              className="dmrSelect"
              value={pcuFilter}
              onChange={(e) => setPcuFilter(e.target.value)}
            >
              <option value="">ทุก รพ.สต. ({availablePcus.length})</option>
              {availablePcus.map((pcu) => (
                <option key={pcu} value={pcu}>
                  {pcu}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตามสถานะ Remission"
              className="dmrSelect"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">ทุกสถานะ Remission</option>
              {remissionFilterOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <div className="dmrSearchWrap">
              <Search size={16} strokeWidth={1.5} className="dmrSearchIcon" />
              <input
                type="text"
                aria-label="ค้นหาชื่อ HN หรือเลขบัตรประชาชน"
                className="dmrInput dmrSearchInput"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหา ชื่อ, HN, เลขบัตร, รพ.สต."
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="dmrBtn dmrBtnGhost dmrBtnSm"
                onClick={handleResetFilters}
              >
                <X size={14} strokeWidth={1.5} />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="dmrTabGroup" role="tablist" aria-label="มุมมองข้อมูล">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'both'}
              className={`dmrTabBtn ${activeView === 'both' ? 'active' : ''}`}
              onClick={() => setActiveView('both')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'dashboard'}
              className={`dmrTabBtn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <BarChart3 size={16} strokeWidth={1.5} />
              Dashboard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'table'}
              className={`dmrTabBtn ${activeView === 'table' ? 'active' : ''}`}
              onClick={() => setActiveView('table')}
            >
              <Table2 size={16} strokeWidth={1.5} />
              ตารางข้อมูล ({items.length})
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="dmrCard">
            <div className="dmrEmpty">กำลังโหลดข้อมูล DM Remission</div>
          </div>
        ) : (
          <>
            {data && (activeView === 'both' || activeView === 'dashboard') && (
              <DmRemissionDashboard
                stats={data.stats}
                fiscalYear={data.fiscalYear}
                statusFilter={statusFilter}
                onSelectStatus={setStatusFilter}
              />
            )}

            {(activeView === 'both' || activeView === 'table') && (
              <section className="dmrTableCard" aria-label="ตารางทะเบียนผู้ป่วย DM Remission">
                <div className="dmrTableMeta">
                  <span>
                    แสดงทั้งหมด <strong>{items.length.toLocaleString()}</strong> รายการ
                    {pcuFilter ? ` · รพ.สต. ${pcuFilter}` : ''}
                    {statusFilter ? ` · สถานะ ${statusFilter}` : ''}
                  </span>
                  <span>
                    {hasManagePermission
                      ? 'คลิกที่ช่องใดก็ได้เพื่อแก้ไขทันที (เหมือน Sheet) · กด Tab เลื่อนช่อง · Enter เพื่อบันทึก'
                      : 'สิทธิ์ดูข้อมูลอย่างเดียว · เลื่อนซ้าย-ขวาเพื่อดูครบทั้ง 29 คอลัมน์'}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="dmrEmpty">
                    {hasManagePermission
                      ? `ไม่พบข้อมูลผู้ป่วย${fiscalYear !== null ? `ในปีงบประมาณ ${fiscalYear}` : ''} กดปุ่ม "เพิ่มผู้ป่วย" เพื่อเริ่มบันทึก`
                      : `ไม่พบข้อมูลผู้ป่วย${fiscalYear !== null ? `ในปีงบประมาณ ${fiscalYear}` : ''}`}
                  </div>
                ) : (
                  <div className="dmrTableScroll">
                    <table className="dmrTable" role="grid">
                      <colgroup>
                        {SHEET_COLUMNS.map((col) => (
                          <col key={col.key} style={{ width: col.width }} />
                        ))}
                        {hasManagePermission && (
                          <col className="dmrActionCol" style={{ width: '3.75rem' }} />
                        )}
                      </colgroup>
                      <thead>
                        <tr className="dmrGroupRow">
                          <th colSpan={7}>ข้อมูลพื้นฐานผู้ป่วย (1–7)</th>
                          <th colSpan={7} className="dmrGroupStart">สัดส่วนร่างกายและ BMI (8–14)</th>
                          <th colSpan={5} className="dmrGroupStart">ผลตรวจเลือด FPG และ A1c (15–19)</th>
                          <th colSpan={2} className="dmrGroupStart">รายการยาเบาหวาน (20–21)</th>
                          <th colSpan={8} className="dmrGroupStart">สรุปผลลัพธ์และ Remission (22–29)</th>
                          {hasManagePermission && (
                            <th className="dmrStickyActions" aria-label="ลบรายการ"></th>
                          )}
                        </tr>
                        <tr className="dmrColRow">
                          {SHEET_COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              className={col.groupStart ? 'dmrGroupStart' : undefined}
                            >
                              {col.header}
                            </th>
                          ))}
                          {hasManagePermission && <th className="dmrStickyActions">ลบ</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((row, idx) => (
                          <tr key={row.id}>
                            {SHEET_COLUMNS.map((col) => {
                              const isEditable = hasManagePermission && col.kind !== 'readonly'
                              const isEditing =
                                isEditable &&
                                activeCell?.rowId === row.id &&
                                activeCell?.field === col.key

                              const classNames = [
                                isEditable ? 'dmrSheetTd' : '',
                                isEditing ? 'dmrSheetTdEditing' : '',
                                col.groupStart ? 'dmrGroupStart' : '',
                                col.kind === 'number' ||
                                col.kind === 'integer' ||
                                col.key === 'bmiBefore' ||
                                col.key === 'bmiAfter' ||
                                col.key === 'rowIndex'
                                  ? 'dmrCellNum'
                                  : '',
                                col.semibold ? 'dmrFwSemibold' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')

                              return (
                                <td
                                  key={col.key}
                                  className={classNames}
                                  role={isEditable ? 'gridcell' : undefined}
                                  tabIndex={isEditable && !isEditing ? 0 : undefined}
                                  title={isEditable ? `คลิกเพื่อแก้ไข ${col.header}` : undefined}
                                  onClick={
                                    isEditable && !isEditing
                                      ? () => startCellEdit(row, col)
                                      : undefined
                                  }
                                  onKeyDown={
                                    isEditable && !isEditing
                                      ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ' || e.key === 'F2') {
                                            e.preventDefault()
                                            startCellEdit(row, col)
                                          }
                                        }
                                      : undefined
                                  }
                                >
                                  {renderCellContent(row, idx, col)}
                                </td>
                              )
                            })}
                            {hasManagePermission && (
                              <td className="dmrStickyActions">
                                <button
                                  type="button"
                                  className="dmrDeleteIconBtn"
                                  onClick={() => handleDelete(row)}
                                  disabled={deletingId === row.id}
                                  aria-label={`ลบ ${row.patientName}`}
                                  title={`ลบ ${row.patientName}`}
                                >
                                  <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {hasManagePermission && (
        <DmRemissionFormModal
          isOpen={formOpen}
          editingRecord={null}
          defaultFiscalYear={fiscalYear ?? getCurrentThaiFiscalYear()}
          availableFiscalYears={availableFiscalYears}
          availablePcus={availablePcus}
          options={options}
          onClose={() => setFormOpen(false)}
          onSaved={(savedFiscalYear) => {
            if (savedFiscalYear && savedFiscalYear !== fiscalYear) {
              setNotice(
                `บันทึกข้อมูลผู้ป่วยเรียบร้อยแล้ว (เปลี่ยนมุมมองเป็นปีงบประมาณ ${savedFiscalYear})`
              )
              setSelectedFiscalYear(savedFiscalYear)
              return
            }
            setNotice('บันทึกข้อมูลผู้ป่วยเรียบร้อยแล้ว')
            void fetchData()
          }}
        />
      )}

      {isAdmin && (
        <DmRemissionSettingsModal
          isOpen={settingsOpen}
          options={options}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => {
            void fetchData()
          }}
        />
      )}

      {hasManagePermission && (
        <DmRemissionCarryoverModal
          isOpen={carryoverOpen}
          targetFiscalYear={fiscalYear ?? getCurrentThaiFiscalYear()}
          availableFiscalYears={availableFiscalYears}
          onClose={() => setCarryoverOpen(false)}
          onCompleted={(summaryText, targetFy) => {
            setNotice(summaryText)
            if (targetFy && targetFy !== fiscalYear) {
              setSelectedFiscalYear(targetFy)
              return
            }
            void fetchData()
          }}
        />
      )}
    </div>
  )
}
