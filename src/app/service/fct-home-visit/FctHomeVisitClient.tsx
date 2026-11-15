'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import ExcelJS from 'exceljs'
import {
  ArrowLeft,
  Plus,
  FileOutput,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Settings,
  Pencil,
  Trash2,
  BarChart3,
  Table2,
  X,
} from 'lucide-react'
import { formatThaiShortDate, suggestAdlGroup } from '@/lib/clinical/fctHomeVisitDomain'
import {
  FCT_EXCEL_COLUMNS,
  FCT_OPTION_CATEGORY_META,
  type FctHomeVisitListResult,
  type FctHomeVisitOptionRecord,
  type FctHomeVisitRecord,
  type FctHomeVisitUpdateInput,
  type FctOptionCategory,
} from '@/lib/clinical/fctHomeVisitTypes'
import FctHomeVisitDashboard from './FctHomeVisitDashboard'
import FctHomeVisitFormModal from './FctHomeVisitFormModal'
import FctHomeVisitImportModal from './FctHomeVisitImportModal'
import FctHomeVisitSettingsModal from './FctHomeVisitSettingsModal'

interface FctHomeVisitClientProps {
  userRole: string
  canManage?: boolean
  initialFiscalYear: number
}

type EditableVisitField =
  | 'visitDate'
  | 'pcuName'
  | 'patientName'
  | 'hn'
  | 'age'
  | 'address'
  | 'adlScore'
  | 'adlGroup'
  | 'diagnosis'
  | 'patientCategory'
  | 'followUpPlan'
  | 'treatmentFacility'
  | 'visitOutcome'
  | 'overallRiskLevel'
  | 'riskLevel'
  | 'dentalNote'
  | 'pharmacyNote'
  | 'nutritionStatus'
  | 'nutritionNote'
  | 'ptCategory'
  | 'ptNote'
  | 'thaiMedCategory'
  | 'thaiMedNote'

type SheetColumnKey = EditableVisitField | 'rowIndex'

type SheetCellKind = 'readonly' | 'date' | 'text' | 'integer' | 'textarea' | 'select'

type BadgeVariant = 'adl' | 'outcome' | 'risk' | 'nutrition'

interface SheetColumnDef {
  key: SheetColumnKey
  header: string
  width: string
  kind: SheetCellKind
  groupStart?: boolean
  semibold?: boolean
  min?: number
  max?: number
  badgeVariant?: BadgeVariant
  getSelectOptions?: (
    row: FctHomeVisitRecord,
    opts: Record<FctOptionCategory, FctHomeVisitOptionRecord[]>,
    availablePcus: string[]
  ) => string[]
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

function getCategoryOptionLabels(
  opts: Record<FctOptionCategory, FctHomeVisitOptionRecord[]>,
  category: FctOptionCategory
): string[] {
  const raw = opts[category] || []
  if (raw.length === 0) {
    return [...FCT_OPTION_CATEGORY_META[category].seedLabels]
  }
  return raw.filter((o) => o.isActive).map((o) => o.label)
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

const SHEET_COLUMNS: readonly SheetColumnDef[] = [
  { key: 'rowIndex', header: 'ลำดับ', width: '3.75rem', kind: 'readonly' },
  { key: 'visitDate', header: 'วันที่เยี่ยมบ้าน', width: '8.5rem', kind: 'date' },
  {
    key: 'pcuName',
    header: 'รพ.สต.',
    width: '9rem',
    kind: 'select',
    getSelectOptions: (row, opts, availablePcus) =>
      mergeUniqueOptions(
        [...getCategoryOptionLabels(opts, 'pcu'), ...availablePcus],
        row.pcuName
      ),
  },
  { key: 'patientName', header: 'ชื่อ-สกุล', width: '12.5rem', kind: 'text', semibold: true },
  { key: 'hn', header: 'HN', width: '6.25rem', kind: 'text' },
  { key: 'age', header: 'อายุ', width: '4.25rem', kind: 'integer', min: 0, max: 150 },
  { key: 'address', header: 'ที่อยู่', width: '14rem', kind: 'textarea' },

  {
    key: 'adlScore',
    header: 'คะแนน ADL',
    width: '5.5rem',
    kind: 'integer',
    min: 0,
    max: 20,
    groupStart: true,
  },
  {
    key: 'adlGroup',
    header: 'กลุ่ม ADL',
    width: '7.5rem',
    kind: 'select',
    badgeVariant: 'adl',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'adl_group'), row.adlGroup),
  },
  { key: 'diagnosis', header: 'Dx', width: '12.5rem', kind: 'textarea' },
  {
    key: 'patientCategory',
    header: 'ประเภทคนไข้',
    width: '9.5rem',
    kind: 'select',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'patient_category'), row.patientCategory),
  },
  { key: 'followUpPlan', header: 'สิ่งที่ต้องตาม', width: '13rem', kind: 'textarea' },

  {
    key: 'treatmentFacility',
    header: 'สถานที่รักษา',
    width: '10.5rem',
    kind: 'select',
    groupStart: true,
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(
        getCategoryOptionLabels(opts, 'treatment_facility'),
        row.treatmentFacility
      ),
  },
  {
    key: 'visitOutcome',
    header: 'ผลลัพธ์การเยี่ยม',
    width: '8.5rem',
    kind: 'select',
    badgeVariant: 'outcome',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'visit_outcome'), row.visitOutcome),
  },
  {
    key: 'overallRiskLevel',
    header: 'ความเสี่ยงโดยรวม',
    width: '8.25rem',
    kind: 'select',
    badgeVariant: 'risk',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'overall_risk'), row.overallRiskLevel),
  },
  {
    key: 'riskLevel',
    header: 'ระดับความเสี่ยง',
    width: '7.75rem',
    kind: 'select',
    badgeVariant: 'risk',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'risk_level'), row.riskLevel),
  },

  {
    key: 'dentalNote',
    header: 'ทันตกรรม',
    width: '11.5rem',
    kind: 'textarea',
    groupStart: true,
  },
  { key: 'pharmacyNote', header: 'เภสัช', width: '11.5rem', kind: 'textarea' },
  {
    key: 'nutritionStatus',
    header: 'นักโภช (สถานะ)',
    width: '9.5rem',
    kind: 'select',
    badgeVariant: 'nutrition',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'nutrition_status'), row.nutritionStatus),
  },
  { key: 'nutritionNote', header: 'นักโภช (คำแนะนำ)', width: '13rem', kind: 'textarea' },
  {
    key: 'ptCategory',
    header: 'กายภาพ (หมวดกิจกรรม)',
    width: '11.5rem',
    kind: 'select',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'pt_category'), row.ptCategory),
  },
  { key: 'ptNote', header: 'กายภาพ (บันทึก)', width: '12rem', kind: 'textarea' },
  {
    key: 'thaiMedCategory',
    header: 'แผนไทย (หมวดอาการ/บริการ)',
    width: '11.5rem',
    kind: 'select',
    getSelectOptions: (row, opts) =>
      mergeUniqueOptions(getCategoryOptionLabels(opts, 'thai_med_category'), row.thaiMedCategory),
  },
  { key: 'thaiMedNote', header: 'แผนไทย (บันทึก)', width: '12rem', kind: 'textarea' },
] as const

const EDITABLE_COLUMNS = SHEET_COLUMNS.filter(
  (col): col is SheetColumnDef & { key: EditableVisitField } => col.kind !== 'readonly'
)

function getBadgeClass(variant: BadgeVariant, val: string | null): string {
  if (!val) return 'fctBadge fctBadgeNeutral'
  if (variant === 'adl') {
    if (val === 'ติดเตียง') return 'fctBadge fctBadgeDanger'
    if (val === 'ติดบ้าน') return 'fctBadge fctBadgeWarning'
    if (val === 'ติดสังคม') return 'fctBadge fctBadgeSuccess'
    return 'fctBadge fctBadgeNeutral'
  }
  if (variant === 'outcome') {
    if (val === 'ดีขึ้น') return 'fctBadge fctBadgeSuccess'
    if (val === 'คงเดิม') return 'fctBadge fctBadgeAccent'
    if (val === 'แย่ลง') return 'fctBadge fctBadgeDanger'
    if (val === 'เสียชีวิต') return 'fctBadge fctBadgeDark'
    return 'fctBadge fctBadgeNeutral'
  }
  if (variant === 'risk') {
    if (val === 'High') return 'fctBadge fctBadgeDanger'
    if (val === 'Moderate') return 'fctBadge fctBadgeWarning'
    if (val === 'Low') return 'fctBadge fctBadgeSuccess'
    return 'fctBadge fctBadgeNeutral'
  }
  if (variant === 'nutrition') {
    if (val === 'ขาดสารอาหารรุนแรง') return 'fctBadge fctBadgeDanger'
    if (val === 'ผอม BMI น้อย' || val === 'อ้วน BMI เกิน') return 'fctBadge fctBadgeWarning'
    if (val === 'ปกติ') return 'fctBadge fctBadgeSuccess'
    return 'fctBadge fctBadgeNeutral'
  }
  return 'fctBadge fctBadgeNeutral'
}

function readRawCellString(row: FctHomeVisitRecord, field: EditableVisitField): string {
  const val = row[field]
  if (val === null || val === undefined) return ''
  return String(val)
}

const EMPTY_OPTIONS: Record<FctOptionCategory, FctHomeVisitOptionRecord[]> = {
  pcu: [],
  patient_category: [],
  adl_group: [],
  visit_outcome: [],
  overall_risk: [],
  risk_level: [],
  treatment_facility: [],
  nutrition_status: [],
  pt_category: [],
  thai_med_category: [],
}

export default function FctHomeVisitClient({
  userRole,
  canManage,
  initialFiscalYear,
}: FctHomeVisitClientProps) {
  const [fiscalYear, setFiscalYear] = useState<number>(initialFiscalYear)
  const [pcuFilter, setPcuFilter] = useState<string>('')
  const [adlGroupFilter, setAdlGroupFilter] = useState<string>('')
  const [outcomeFilter, setOutcomeFilter] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeView, setActiveView] = useState<'both' | 'dashboard' | 'table'>('both')

  const [data, setData] = useState<FctHomeVisitListResult | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState<boolean>(false)

  const [formOpen, setFormOpen] = useState<boolean>(false)
  const [editingRecord, setEditingRecord] = useState<FctHomeVisitRecord | null>(null)
  const [importOpen, setImportOpen] = useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [activeCell, setActiveCell] = useState<{
    rowId: number
    field: EditableVisitField
  } | null>(null)
  const [draftValue, setDraftValue] = useState<string>('')
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null)
  const skipBlurRef = useRef<boolean>(false)

  const isAdmin = userRole === 'admin'
  const hasManagePermission = isAdmin || (canManage ?? false)
  const hasActiveFilters = Boolean(
    pcuFilter || adlGroupFilter || outcomeFilter || searchInput.trim()
  )

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
        params.set('fiscalYear', String(fiscalYear))
        if (pcuFilter) params.set('pcuName', pcuFilter)
        if (adlGroupFilter) params.set('adlGroup', adlGroupFilter)
        if (outcomeFilter) params.set('visitOutcome', outcomeFilter)
        if (searchQuery) params.set('search', searchQuery)

        const res = await fetch(`/api/service/fct-home-visit?${params.toString()}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(getApiErrorMessage(json, 'ไม่สามารถโหลดข้อมูลการเยี่ยมบ้านทีม FCT ได้'))
        }
        setData(json.data as FctHomeVisitListResult)
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
    [fiscalYear, pcuFilter, adlGroupFilter, outcomeFilter, searchQuery]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleResetFilters = () => {
    setPcuFilter('')
    setAdlGroupFilter('')
    setOutcomeFilter('')
    setSearchInput('')
    setSearchQuery('')
  }

  const startCellEdit = (row: FctHomeVisitRecord, col: SheetColumnDef) => {
    if (col.kind === 'readonly') return
    const field = col.key as EditableVisitField
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
    currentField: EditableVisitField,
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
    row: FctHomeVisitRecord,
    col: SheetColumnDef,
    nextRawValue: string,
    moveAfter?: { horizontal?: -1 | 1; vertical?: -1 | 1 }
  ) => {
    if (col.kind === 'readonly') return
    const field = col.key as EditableVisitField
    const prevRaw = readRawCellString(row, field)
    const trimmed = nextRawValue.trim()

    if (moveAfter) {
      moveToAdjacentEditableCell(row.id, field, moveAfter)
    } else {
      skipBlurRef.current = true
      setActiveCell(null)
    }

    if (field === 'patientName' && trimmed === '') {
      setError('กรุณาระบุชื่อ-สกุลผู้ป่วย')
      return
    }
    if (field === 'visitDate' && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      setError('กรุณาระบุวันที่เยี่ยมบ้านให้ถูกต้อง')
      return
    }

    if (trimmed === prevRaw.trim()) {
      return
    }

    let payloadValue: string | number | null
    if (trimmed === '') {
      payloadValue = null
    } else if (col.kind === 'integer') {
      const num = Number(trimmed)
      if (!Number.isFinite(num) || !Number.isInteger(num)) {
        setError(`${col.header}ต้องเป็นจำนวนเต็มที่ถูกต้อง`)
        return
      }
      if (col.min !== undefined && num < col.min) {
        setError(`${col.header}ต้องไม่น้อยกว่า ${col.min}`)
        return
      }
      if (col.max !== undefined && num > col.max) {
        setError(`${col.header}ต้องไม่เกิน ${col.max}`)
        return
      }
      payloadValue = num
    } else {
      payloadValue = trimmed
    }

    const patchBody: FctHomeVisitUpdateInput = { [field]: payloadValue }
    if (
      field === 'adlScore' &&
      typeof payloadValue === 'number' &&
      (!row.adlGroup || !row.adlGroup.trim())
    ) {
      const suggested = suggestAdlGroup(payloadValue)
      if (suggested) {
        patchBody.adlGroup = suggested
      }
    }

    const cellKey = `${row.id}:${field}`
    setSavingCellKey(cellKey)
    setError(null)
    try {
      const res = await fetch(`/api/service/fct-home-visit/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(getApiErrorMessage(json, `ไม่สามารถบันทึกช่อง "${col.header}" ได้`))
      }

      const updatedRecord = json.data as FctHomeVisitRecord
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

  const handleDelete = async (record: FctHomeVisitRecord) => {
    const confirmed = window.confirm(
      `ต้องการลบรายการเยี่ยมบ้านของ "${record.patientName}" วันที่ ${formatThaiShortDate(record.visitDate)} ใช่หรือไม่`
    )
    if (!confirmed) return

    setDeletingId(record.id)
    setError(null)
    try {
      const res = await fetch(`/api/service/fct-home-visit/${record.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(getApiErrorMessage(json, 'ไม่สามารถลบข้อมูลได้'))
      }
      setNotice('ลบรายการเยี่ยมบ้านเรียบร้อยแล้ว')
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
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'โรงพยาบาลเถิน (Thoen Hospital)'
      workbook.created = new Date()
      const sheet = workbook.addWorksheet(`FCT_Home_Visit_${fiscalYear}`, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      })

      sheet.columns = FCT_EXCEL_COLUMNS.map((col) => ({
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
        for (const col of FCT_EXCEL_COLUMNS) {
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
      anchor.download = `fct-home-visit-fy${fiscalYear}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExporting(false)
    }
  }

  const availableFiscalYears = data?.availableFiscalYears ?? [
    initialFiscalYear + 1,
    initialFiscalYear,
    initialFiscalYear - 1,
    initialFiscalYear - 2,
  ]
  const availablePcus = data?.availablePcus ?? []
  const items = data?.items ?? []
  const options: Record<FctOptionCategory, FctHomeVisitOptionRecord[]> =
    data?.options ?? EMPTY_OPTIONS

  const adlFilterOptions = Array.from(
    new Set([
      ...getCategoryOptionLabels(options, 'adl_group'),
      ...Object.keys(data?.stats.adlGroupCounts || {}).filter((k) => k !== 'ยังไม่ระบุ'),
    ])
  )

  const outcomeFilterOptions = Array.from(
    new Set([
      ...getCategoryOptionLabels(options, 'visit_outcome'),
      ...Object.keys(data?.stats.outcomeCounts || {}).filter((k) => k !== 'ยังไม่ระบุ'),
    ])
  )

  const renderCellContent = (row: FctHomeVisitRecord, idx: number, col: SheetColumnDef) => {
    if (col.key === 'rowIndex') {
      return <span>{idx + 1}</span>
    }

    const field = col.key as EditableVisitField
    const isEditing = activeCell?.rowId === row.id && activeCell?.field === field
    const isSaving = savingCellKey === `${row.id}:${field}`

    if (isEditing) {
      if (col.kind === 'select') {
        const choices = col.getSelectOptions
          ? col.getSelectOptions(row, options, availablePcus)
          : []
        return (
          <select
            autoFocus
            aria-label={`เลือก ${col.header} ของ ${row.patientName}`}
            className="fctSheetCellSelect"
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
            className="fctSheetCellTextarea"
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
          type={col.kind === 'date' ? 'date' : col.kind === 'integer' ? 'number' : 'text'}
          min={col.min}
          max={col.max}
          step={col.kind === 'integer' ? 1 : undefined}
          aria-label={`กรอก ${col.header} ของ ${row.patientName}`}
          className="fctSheetCellInput"
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

    if (col.key === 'visitDate') {
      const formattedDate =
        typeof rawVal === 'string' && rawVal.trim() !== ''
          ? formatThaiShortDate(rawVal)
          : '-'
      return (
        <span className={`fctSheetDisplay ${isSaving ? 'fctSheetCellSaving' : ''}`}>
          {formattedDate}
        </span>
      )
    }

    if (col.badgeVariant) {
      const textVal = typeof rawVal === 'string' && rawVal.trim() !== '' ? rawVal : null
      return (
        <span className={`fctSheetDisplay ${isSaving ? 'fctSheetCellSaving' : ''}`}>
          <span className={getBadgeClass(col.badgeVariant, textVal)}>
            <span className="fctBadgeDot" aria-hidden="true" />
            {textVal ?? 'ยังไม่ระบุ'}
          </span>
        </span>
      )
    }

    const displayText =
      col.kind === 'integer'
        ? typeof rawVal === 'number' && Number.isFinite(rawVal)
          ? String(rawVal)
          : '-'
        : typeof rawVal === 'string' && rawVal.trim() !== ''
          ? rawVal
          : '-'
    const isMuted = displayText === '-'
    const isLongLeft = col.kind === 'textarea' && !isMuted

    return (
      <span
        className={`fctSheetDisplay ${isLongLeft ? 'fctSheetDisplayLeft' : ''} ${
          isMuted ? 'fctSheetCellMuted' : ''
        } ${isSaving ? 'fctSheetCellSaving' : ''}`}
      >
        {displayText}
      </span>
    )
  }

  return (
    <div className="fctPage" data-theme="light">
      <div className="fctContainer">
        <header className="fctHeader">
          <div>
            <Link href="/service" className="fctBackLink">
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span>กลับหน้าระบบสารสนเทศภายใน</span>
            </Link>
            <div className="fctTitleRow">
              <h1 className="fctTitle">เยี่ยมบ้านทีม FCT</h1>
              <span className="fctFyBadge">
                <span className="fctFyDot" aria-hidden="true" />
                ปีงบประมาณ {fiscalYear}
              </span>
              {!hasManagePermission && (
                <span className="fctViewOnlyBadge">สิทธิ์ดูข้อมูลอย่างเดียว</span>
              )}
            </div>
            <p className="fctSubtitle">
              ทะเบียนติดตามการเยี่ยมบ้านทีมสหวิชาชีพ (FCT) ประเมิน ADL และรายงานสรุปผลรายหน่วยบริการ รพ.เถิน
            </p>
          </div>

          <div className="fctHeaderActions">
            <button
              type="button"
              className="fctBtn"
              onClick={() => fetchData()}
              disabled={loading}
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              รีเฟรช
            </button>
            {hasManagePermission && (
              <button
                type="button"
                className="fctBtn"
                onClick={() => setImportOpen(true)}
              >
                <FileSpreadsheet size={16} strokeWidth={1.5} />
                นำเข้า Excel/CSV
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="fctBtn"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={16} strokeWidth={1.5} />
                ตั้งค่าตัวเลือก
              </button>
            )}
            <button
              type="button"
              className="fctBtn"
              onClick={handleExportExcel}
              disabled={exporting || items.length === 0}
            >
              <FileOutput size={16} strokeWidth={1.5} />
              {exporting ? 'กำลังส่งออก' : 'Export Excel'}
            </button>
            {hasManagePermission && (
              <button
                type="button"
                className="fctBtn fctBtnPrimary"
                onClick={() => {
                  setEditingRecord(null)
                  setFormOpen(true)
                }}
              >
                <Plus size={16} strokeWidth={1.5} />
                เพิ่มรายการเยี่ยม
              </button>
            )}
          </div>
        </header>

        {error && <div className="fctAlert fctAlertError">{error}</div>}
        {notice && (
          <div className="fctAlert fctAlertInfo">
            <span>{notice}</span>
            <button type="button" className="fctBtn fctBtnSm" onClick={() => setNotice(null)}>
              ปิด
            </button>
          </div>
        )}

        <div className="fctControlBar">
          <div className="fctFilterGroup">
            <select
              aria-label="เลือกปีงบประมาณ"
              className="fctSelect"
              value={String(fiscalYear)}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {availableFiscalYears.map((fy) => (
                <option key={fy} value={String(fy)}>
                  ปีงบประมาณ {fy}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตาม รพ.สต."
              className="fctSelect"
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
              aria-label="กรองตามกลุ่ม ADL"
              className="fctSelect"
              value={adlGroupFilter}
              onChange={(e) => setAdlGroupFilter(e.target.value)}
            >
              <option value="">ทุกกลุ่ม ADL</option>
              {adlFilterOptions.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตามผลลัพธ์การเยี่ยม"
              className="fctSelect"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="">ทุกผลลัพธ์การเยี่ยม</option>
              {outcomeFilterOptions.map((out) => (
                <option key={out} value={out}>
                  {out}
                </option>
              ))}
            </select>

            <div className="fctSearchWrap">
              <Search size={16} strokeWidth={1.5} className="fctSearchIcon" />
              <input
                type="text"
                aria-label="ค้นหาชื่อ HN Dx หรือที่อยู่"
                className="fctInput fctSearchInput"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหาชื่อ/HN/Dx/ที่อยู่"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="fctBtn fctBtnGhost fctBtnSm"
                onClick={handleResetFilters}
              >
                <X size={14} strokeWidth={1.5} />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="fctTabGroup" role="tablist" aria-label="มุมมองข้อมูล">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'both'}
              className={`fctTabBtn ${activeView === 'both' ? 'active' : ''}`}
              onClick={() => setActiveView('both')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'dashboard'}
              className={`fctTabBtn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <BarChart3 size={16} strokeWidth={1.5} />
              Dashboard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'table'}
              className={`fctTabBtn ${activeView === 'table' ? 'active' : ''}`}
              onClick={() => setActiveView('table')}
            >
              <Table2 size={16} strokeWidth={1.5} />
              ตาราง Sheet ({items.length})
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="fctCard">
            <div className="fctEmpty">กำลังโหลดข้อมูลการเยี่ยมบ้านทีม FCT</div>
          </div>
        ) : (
          <>
            {data && (activeView === 'both' || activeView === 'dashboard') && (
              <FctHomeVisitDashboard
                stats={data.stats}
                fiscalYear={fiscalYear}
                adlGroupFilter={adlGroupFilter}
                outcomeFilter={outcomeFilter}
                onSelectAdlGroup={setAdlGroupFilter}
                onSelectOutcome={setOutcomeFilter}
              />
            )}

            {(activeView === 'both' || activeView === 'table') && (
              <section
                className="fctTableCard"
                aria-label="ตารางทะเบียนการเยี่ยมบ้านทีม FCT"
              >
                <div className="fctTableMeta">
                  <span>
                    แสดงทั้งหมด <strong>{items.length.toLocaleString()}</strong> รายการ
                    {pcuFilter ? ` · รพ.สต. ${pcuFilter}` : ''}
                    {adlGroupFilter ? ` · กลุ่ม ${adlGroupFilter}` : ''}
                    {outcomeFilter ? ` · ผลลัพธ์ ${outcomeFilter}` : ''}
                  </span>
                  <span>
                    {hasManagePermission
                      ? 'คลิกที่ช่องใดก็ได้เพื่อแก้ไขทันที (เหมือน Sheet) · กด Tab เลื่อนช่อง · Enter เพื่อบันทึก'
                      : 'สิทธิ์ดูข้อมูลอย่างเดียว · เลื่อนซ้าย-ขวาเพื่อดูครบทุกคอลัมน์'}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="fctEmpty">
                    {hasManagePermission
                      ? `ไม่พบรายการเยี่ยมบ้านในปีงบประมาณ ${fiscalYear} กดปุ่ม "เพิ่มรายการเยี่ยม" หรือ "นำเข้า Excel/CSV" เพื่อเริ่มบันทึก`
                      : `ไม่พบรายการเยี่ยมบ้านในปีงบประมาณ ${fiscalYear}`}
                  </div>
                ) : (
                  <div className="fctTableScroll">
                    <table className="fctTable" role="grid">
                      <colgroup>
                        {SHEET_COLUMNS.map((col) => (
                          <col key={col.key} style={{ width: col.width }} />
                        ))}
                        {hasManagePermission && (
                          <col className="fctActionCol" style={{ width: '5.5rem' }} />
                        )}
                      </colgroup>
                      <thead>
                        <tr className="fctGroupRow">
                          <th colSpan={7}>ข้อมูลผู้ป่วยและพื้นที่ (1–7)</th>
                          <th colSpan={5} className="fctGroupStart">
                            ประเมิน ADL และแผนติดตาม (8–12)
                          </th>
                          <th colSpan={4} className="fctGroupStart">
                            การเยี่ยมบ้านและผลลัพธ์ (13–16)
                          </th>
                          <th colSpan={8} className="fctGroupStart">
                            ทีมสหวิชาชีพ 5 ด้าน (17–24)
                          </th>
                          {hasManagePermission && (
                            <th className="fctStickyActions" aria-label="จัดการรายการ"></th>
                          )}
                        </tr>
                        <tr className="fctColRow">
                          {SHEET_COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              className={col.groupStart ? 'fctGroupStart' : undefined}
                            >
                              {col.header}
                            </th>
                          ))}
                          {hasManagePermission && <th className="fctStickyActions">จัดการ</th>}
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
                                isEditable ? 'fctSheetTd' : '',
                                isEditing ? 'fctSheetTdEditing' : '',
                                col.groupStart ? 'fctGroupStart' : '',
                                col.kind === 'integer' || col.key === 'rowIndex'
                                  ? 'fctCellNum'
                                  : '',
                                col.semibold ? 'fctFwSemibold' : '',
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
                              <td className="fctStickyActions">
                                <div className="fctActionBtns">
                                  <button
                                    type="button"
                                    className="fctEditIconBtn"
                                    onClick={() => {
                                      setEditingRecord(row)
                                      setFormOpen(true)
                                    }}
                                    aria-label={`แก้ไข ${row.patientName}`}
                                    title={`แก้ไข ${row.patientName}`}
                                  >
                                    <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="fctDeleteIconBtn"
                                    onClick={() => handleDelete(row)}
                                    disabled={deletingId === row.id}
                                    aria-label={`ลบ ${row.patientName}`}
                                    title={`ลบ ${row.patientName}`}
                                  >
                                    <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                                  </button>
                                </div>
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
        <FctHomeVisitFormModal
          isOpen={formOpen}
          editingRecord={editingRecord}
          availablePcus={availablePcus}
          options={options}
          onClose={() => {
            setFormOpen(false)
            setEditingRecord(null)
          }}
          onSaved={() => {
            setNotice(
              editingRecord
                ? 'แก้ไขข้อมูลการเยี่ยมบ้านเรียบร้อยแล้ว'
                : 'บันทึกรายการเยี่ยมบ้านเรียบร้อยแล้ว'
            )
            void fetchData()
          }}
        />
      )}

      {hasManagePermission && (
        <FctHomeVisitImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setNotice('นำเข้าข้อมูลการเยี่ยมบ้านเรียบร้อยแล้ว')
            void fetchData()
          }}
        />
      )}

      {isAdmin && (
        <FctHomeVisitSettingsModal
          isOpen={settingsOpen}
          options={options}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => {
            void fetchData()
          }}
        />
      )}
    </div>
  )
}
