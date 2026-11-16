'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  FileOutput,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  aggregateProjectDashboardStats,
  getCurrentThaiFiscalYear,
  getSelectableFiscalYears,
  normalizeBudgetNumber,
  sortByPreferredOrder,
  sortStrategies,
} from '@/lib/projects/projectTrackerDomain'
import {
  PROJECT_BUDGET_SOURCES,
  PROJECT_EXCEL_COLUMNS,
  PROJECT_STRATEGY_OPTIONS,
  PROJECT_SUBMISSION_STATUSES,
  type ProjectListResult,
  type ProjectRecord,
} from '@/lib/projects/projectTrackerTypes'
import ProjectFormModal from './ProjectFormModal'
import ProjectImportModal from './ProjectImportModal'
import ProjectTrackerDashboard from './ProjectTrackerDashboard'

interface ProjectTrackerClientProps {
  userRole: string
  canManage?: boolean
  initialFiscalYear?: number
  initialData?: ProjectListResult | null
  initialError?: string | null
}

type EditableProjectField =
  | 'sequenceNo'
  | 'projectCode'
  | 'strategy'
  | 'projectName'
  | 'responsibleUnit'
  | 'q1Budget'
  | 'q2Budget'
  | 'q3Budget'
  | 'q4Budget'
  | 'actualSpent'
  | 'submissionStatus'
  | 'budgetSource'
  | 'notes'

type SheetColumnKey = EditableProjectField | 'allocatedBudget' | 'remainingBudget'
type SheetCellKind = 'readonly' | 'text' | 'number' | 'integer' | 'textarea' | 'select'

interface SheetColumnDef {
  key: SheetColumnKey
  header: string
  width: string
  kind: SheetCellKind
  semibold?: boolean
  statusBadge?: boolean
  getSelectOptions?: (row: ProjectRecord, availableStrategies: string[]) => string[]
}

function mergeOptions(presets: readonly string[], current: string | null): string[] {
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
  { key: 'sequenceNo', header: 'ลำดับ', width: '3.75rem', kind: 'integer' },
  { key: 'projectCode', header: 'รหัสโครงการ', width: '6.25rem', kind: 'text' },
  {
    key: 'strategy',
    header: 'ยุทธศาสตร์',
    width: '6.5rem',
    kind: 'select',
    semibold: true,
    getSelectOptions: (row, availableStrategies) =>
      mergeOptions([...PROJECT_STRATEGY_OPTIONS, ...availableStrategies], row.strategy),
  },
  {
    key: 'projectName',
    header: 'ชื่อโครงการ',
    width: '21rem',
    kind: 'textarea',
    semibold: true,
  },
  { key: 'responsibleUnit', header: 'หน่วยงาน/ผู้รับผิดชอบ', width: '12.5rem', kind: 'text' },
  { key: 'q1Budget', header: 'ไตรมาส 1', width: '6.25rem', kind: 'number' },
  { key: 'q2Budget', header: 'ไตรมาส 2', width: '6.25rem', kind: 'number' },
  { key: 'q3Budget', header: 'ไตรมาส 3', width: '6.25rem', kind: 'number' },
  { key: 'q4Budget', header: 'ไตรมาส 4', width: '6.25rem', kind: 'number' },
  {
    key: 'allocatedBudget',
    header: 'งบประมาณที่ได้รับ',
    width: '7.5rem',
    kind: 'readonly',
    semibold: true,
  },
  { key: 'actualSpent', header: 'งบประมาณใช้จริง', width: '7.5rem', kind: 'number' },
  {
    key: 'remainingBudget',
    header: 'งบประมาณคงเหลือ',
    width: '7.5rem',
    kind: 'readonly',
    semibold: true,
  },
  {
    key: 'submissionStatus',
    header: 'สถานะการส่งสรุปงาน',
    width: '9.5rem',
    kind: 'select',
    statusBadge: true,
    getSelectOptions: (row) => mergeOptions(PROJECT_SUBMISSION_STATUSES, row.submissionStatus),
  },
  {
    key: 'budgetSource',
    header: 'แหล่งงบประมาณ',
    width: '8.25rem',
    kind: 'select',
    getSelectOptions: (row) => mergeOptions(PROJECT_BUDGET_SOURCES, row.budgetSource),
  },
  { key: 'notes', header: 'หมายเหตุ/ปัญหาอุปสรรค', width: '11.5rem', kind: 'textarea' },
] as const

const EDITABLE_COLUMNS = SHEET_COLUMNS.filter(
  (c): c is SheetColumnDef & { key: EditableProjectField } => c.kind !== 'readonly'
)

function getStatusBadgeClass(status: string): string {
  if (status === 'ส่งแล้ว') return 'ptBadge ptBadgeSubmitted'
  if (status === 'ยังไม่ส่ง') return 'ptBadge ptBadgePending'
  if (status === 'ยกเลิกโครงการ') return 'ptBadge ptBadgeCancelled'
  return 'ptBadge ptBadgeNoBudget'
}

function fmtMoney(val: number): string {
  if (!Number.isFinite(val)) return '-'
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function ProjectTrackerClient({
  userRole,
  canManage,
  initialFiscalYear,
  initialData,
  initialError,
}: ProjectTrackerClientProps) {
  const isAdmin = userRole === 'admin'
  const hasManagePermission = canManage ?? isAdmin
  const hasInitialProps = initialData !== undefined || initialError !== undefined

  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(
    initialFiscalYear ?? initialData?.fiscalYear ?? null
  )
  const [strategyFilter, setStrategyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeView, setActiveView] = useState<'both' | 'dashboard' | 'table'>('both')

  const [data, setData] = useState<ProjectListResult | null>(initialData ?? null)
  const [loading, setLoading] = useState(!hasInitialProps)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const [activeCell, setActiveCell] = useState<{
    rowId: number
    field: EditableProjectField
  } | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const skipBlurRef = useRef(false)
  const skipNextFetchForFyRef = useRef<number | null>(null)
  const skipInitialFetchRef = useRef(hasInitialProps)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 150)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchData = useCallback(
    async (fyOverride?: number) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        const fyToLoad = fyOverride ?? selectedFiscalYear
        if (fyToLoad !== null) params.set('fiscalYear', String(fyToLoad))

        const qs = params.toString()
        const res = await fetch(`/api/service/project-tracker${qs ? `?${qs}` : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'ไม่สามารถโหลดข้อมูลระบบติดตามโครงการได้')
        }
        setData(json.data)
        if (fyOverride === undefined && selectedFiscalYear === null && json.data?.fiscalYear) {
          skipNextFetchForFyRef.current = json.data.fiscalYear
          setSelectedFiscalYear(json.data.fiscalYear)
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        if (abortRef.current === controller) {
          setLoading(false)
        }
      }
    },
    [selectedFiscalYear]
  )

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false
      return
    }
    if (
      skipNextFetchForFyRef.current !== null &&
      selectedFiscalYear === skipNextFetchForFyRef.current
    ) {
      skipNextFetchForFyRef.current = null
      return
    }
    void fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData, selectedFiscalYear])

  const allYearRecords = useMemo(() => data?.items ?? [], [data?.items])

  const fiscalYear = selectedFiscalYear ?? data?.fiscalYear ?? null
  const availableFiscalYears = data?.availableFiscalYears ?? []

  const availableStrategies = useMemo(
    () =>
      allYearRecords.length > 0
        ? sortStrategies(allYearRecords.map((r) => r.strategy))
        : (data?.availableStrategies ?? []),
    [allYearRecords, data?.availableStrategies]
  )

  const availableStatuses = useMemo(
    () =>
      allYearRecords.length > 0
        ? sortByPreferredOrder(
            allYearRecords.map((r) => r.submissionStatus),
            PROJECT_SUBMISSION_STATUSES
          )
        : (data?.availableStatuses ?? []),
    [allYearRecords, data?.availableStatuses]
  )

  const availableBudgetSources = useMemo(
    () =>
      allYearRecords.length > 0
        ? sortByPreferredOrder(
            allYearRecords.map((r) => r.budgetSource),
            PROJECT_BUDGET_SOURCES
          )
        : (data?.availableBudgetSources ?? []),
    [allYearRecords, data?.availableBudgetSources]
  )

  const yearStats = useMemo(
    () => (data ? aggregateProjectDashboardStats(allYearRecords) : null),
    [data, allYearRecords]
  )

  const items = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!strategyFilter && !statusFilter && !sourceFilter && !q) {
      return allYearRecords
    }
    return allYearRecords.filter((item) => {
      if (strategyFilter && item.strategy !== strategyFilter) return false
      if (statusFilter && item.submissionStatus !== statusFilter) return false
      if (sourceFilter && item.budgetSource !== sourceFilter) return false
      if (q) {
        const hay = [
          item.projectCode || '',
          item.projectName || '',
          item.responsibleUnit || '',
          item.strategy || '',
          item.notes || '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allYearRecords, strategyFilter, statusFilter, sourceFilter, debouncedSearch])

  const selectableFiscalYears = getSelectableFiscalYears(availableFiscalYears)
  const modalDefaultFiscalYear = fiscalYear ?? getCurrentThaiFiscalYear()

  const hasActiveFilters = Boolean(
    strategyFilter || statusFilter || sourceFilter || searchInput.trim()
  )

  const handleResetFilters = () => {
    setStrategyFilter('')
    setStatusFilter('')
    setSourceFilter('')
    setSearchInput('')
    setDebouncedSearch('')
  }

  const startCellEdit = (row: ProjectRecord, col: SheetColumnDef) => {
    if (!hasManagePermission || col.kind === 'readonly') return
    const field = col.key as EditableProjectField
    const raw = row[field]
    setActiveCell({ rowId: row.id, field })
    setDraftValue(raw === null || raw === undefined ? '' : String(raw))
  }

  const cancelCellEdit = () => {
    skipBlurRef.current = true
    setActiveCell(null)
    setDraftValue('')
  }

  const moveNextEditableCell = (
    currentRowId: number,
    currentField: EditableProjectField,
    delta: { horizontal?: number; vertical?: number }
  ) => {
    const rowIdx = items.findIndex((r) => r.id === currentRowId)
    const colIdx = EDITABLE_COLUMNS.findIndex((c) => c.key === currentField)
    if (rowIdx < 0 || colIdx < 0) return

    let nextRowIdx = rowIdx + (delta.vertical ?? 0)
    let nextColIdx = colIdx + (delta.horizontal ?? 0)

    if (nextColIdx >= EDITABLE_COLUMNS.length) {
      nextColIdx = 0
      nextRowIdx += 1
    } else if (nextColIdx < 0) {
      nextColIdx = EDITABLE_COLUMNS.length - 1
      nextRowIdx -= 1
    }

    const nextRow = items[nextRowIdx]
    const nextCol = EDITABLE_COLUMNS[nextColIdx]
    if (nextRow && nextCol) {
      startCellEdit(nextRow, nextCol)
    } else {
      setActiveCell(null)
    }
  }

  const commitCellEdit = async (
    row: ProjectRecord,
    col: SheetColumnDef,
    nextRawValue: string,
    nextDelta?: { horizontal?: number; vertical?: number }
  ) => {
    if (!hasManagePermission || col.kind === 'readonly') return
    const field = col.key as EditableProjectField
    skipBlurRef.current = true

    let payloadValue: string | number | null
    if (col.kind === 'number') {
      payloadValue = normalizeBudgetNumber(nextRawValue)
    } else if (col.kind === 'integer') {
      const n = Number(nextRawValue)
      payloadValue = Number.isInteger(n) && n > 0 ? n : row.sequenceNo
    } else {
      const trimmed = nextRawValue.trim()
      if (
        (field === 'projectName' ||
          field === 'strategy' ||
          field === 'submissionStatus' ||
          field === 'budgetSource') &&
        !trimmed
      ) {
        setError(`ช่อง "${col.header}" ต้องไม่เป็นค่าว่าง`)
        setActiveCell(null)
        return
      }
      payloadValue = trimmed || null
    }

    const currentValue = row[field]
    const unchanged =
      (currentValue ?? null) === payloadValue ||
      (typeof currentValue === 'number' && Number(currentValue) === Number(payloadValue))

    if (nextDelta) {
      moveNextEditableCell(row.id, field, nextDelta)
    } else {
      setActiveCell(null)
    }

    if (unchanged) return

    const cellKey = `${row.id}:${field}`
    setSavingCellKey(cellKey)
    setError(null)
    try {
      const res = await fetch(`/api/service/project-tracker/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: payloadValue }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถบันทึกการแก้ไขได้')
      }
      const updated = json.data as ProjectRecord
      setData((prev) => {
        if (!prev) return prev
        const nextItems = prev.items
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.sequenceNo - b.sequenceNo || a.id - b.id)
        return {
          ...prev,
          items: nextItems,
        }
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSavingCellKey(null)
    }
  }

  const handleDeleteRow = async (row: ProjectRecord) => {
    if (!hasManagePermission) return
    const confirmed = window.confirm(
      `ต้องการลบโครงการ "${row.projectName}" ใช่หรือไม่`
    )
    if (!confirmed) return

    setDeletingId(row.id)
    setError(null)
    try {
      const res = await fetch(`/api/service/project-tracker/${row.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถลบโครงการได้')
      }
      setNotice(`ลบโครงการ "${row.projectName}" เรียบร้อยแล้ว`)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.filter((item) => item.id !== row.id),
        }
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบรายการ')
    } finally {
      setDeletingId(null)
    }
  }

  const handleExportExcel = async () => {
    if (!data || !yearStats) return
    setExporting(true)
    setError(null)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const exportStats = hasActiveFilters ? aggregateProjectDashboardStats(items) : yearStats

      // Sheet 1: ภาพรวม (Dashboard)
      const dashSheet = workbook.addWorksheet('ภาพรวม (Dashboard)')
      dashSheet.addRow([
        `ระบบติดตามสรุปโครงการและงบประมาณ ปีงบประมาณ ${data.fiscalYear} (โรงพยาบาลเถิน)`,
      ])
      dashSheet.getRow(1).font = { bold: true, size: 14 }
      dashSheet.addRow([])
      dashSheet.addRow([
        'โครงการทั้งหมด',
        exportStats.totalProjects,
        'ส่งสรุปแล้ว',
        exportStats.submittedCount,
        'ยังไม่ส่ง',
        exportStats.pendingCount,
        'ไม่ใช้งบประมาณ',
        exportStats.noBudgetCount,
        'ยกเลิก',
        exportStats.cancelledCount,
      ])
      dashSheet.addRow([])
      const stratHeader = dashSheet.addRow([
        'ยุทธศาสตร์',
        'โครงการทั้งหมด',
        'ส่งสรุปแล้ว',
        'ยังไม่ส่ง',
        'ไม่ใช้งบประมาณ',
        'ยกเลิก',
        'ร้อยละความสำเร็จ',
        'งบประมาณได้รับจัดสรรรวม',
        'งบประมาณใช้จ่ายจริงรวม',
        'งบประมาณคงเหลือรวม',
      ])
      stratHeader.font = { bold: true }

      for (const row of exportStats.byStrategy) {
        dashSheet.addRow([
          row.strategy,
          row.totalProjects,
          row.submittedCount,
          row.pendingCount,
          row.noBudgetCount,
          row.cancelledCount,
          `${row.completionRate.toFixed(1)}%`,
          row.allocatedBudget,
          row.actualSpent,
          row.remainingBudget,
        ])
      }

      const totalDashRow = dashSheet.addRow([
        'รวมทั้งหมด',
        exportStats.totalProjects,
        exportStats.submittedCount,
        exportStats.pendingCount,
        exportStats.noBudgetCount,
        exportStats.cancelledCount,
        `${exportStats.submissionRate.toFixed(1)}%`,
        exportStats.allocatedBudgetTotal,
        exportStats.actualSpentTotal,
        exportStats.remainingBudgetTotal,
      ])
      totalDashRow.font = { bold: true }
      dashSheet.columns.forEach((col) => {
        col.width = 18
      })

      // Sheet 2: ทะเบียนคุมโครงการ (Data)
      const dataSheet = workbook.addWorksheet('ทะเบียนคุมโครงการ (Data)')
      const headerRow = dataSheet.addRow([...PROJECT_EXCEL_COLUMNS])
      headerRow.font = { bold: true }

      items.forEach((item, index) => {
        const excelRowNum = index + 2
        dataSheet.addRow([
          item.sequenceNo || index + 1,
          item.projectCode || '',
          item.strategy,
          item.projectName,
          item.responsibleUnit || '',
          item.q1Budget,
          item.q2Budget,
          item.q3Budget,
          item.q4Budget,
          { formula: `SUM(F${excelRowNum}:I${excelRowNum})`, result: item.allocatedBudget },
          item.actualSpent,
          { formula: `J${excelRowNum}-K${excelRowNum}`, result: item.remainingBudget },
          item.submissionStatus,
          item.budgetSource,
          item.notes || '',
        ])
      })

      const colWidths = [8, 14, 14, 48, 28, 13, 13, 13, 13, 16, 16, 16, 18, 16, 28]
      colWidths.forEach((w, idx) => {
        dataSheet.getColumn(idx + 1).width = w
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ระบบติดตามการส่งโครงการ_ปี_${data.fiscalYear}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExporting(false)
    }
  }

  const renderCellContent = (row: ProjectRecord, col: SheetColumnDef) => {
    if (col.key === 'allocatedBudget' || col.key === 'remainingBudget') {
      return <span>{fmtMoney(row[col.key])}</span>
    }

    const field = col.key as EditableProjectField
    const isEditing = activeCell?.rowId === row.id && activeCell?.field === field
    const isSaving = savingCellKey === `${row.id}:${field}`

    if (isEditing) {
      if (col.kind === 'select') {
        const choices = col.getSelectOptions
          ? col.getSelectOptions(row, availableStrategies)
          : []
        return (
          <select
            autoFocus
            aria-label={`เลือก ${col.header} ของ ${row.projectName}`}
            className="ptSheetCellSelect"
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
                void commitCellEdit(row, col, draftValue, {
                  horizontal: e.shiftKey ? -1 : 1,
                })
              }
            }}
          >
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
            aria-label={`กรอก ${col.header} ของ ${row.projectName}`}
            className="ptSheetCellTextarea"
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
                void commitCellEdit(row, col, draftValue, {
                  horizontal: e.shiftKey ? -1 : 1,
                })
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
          step={col.kind === 'number' ? '0.01' : col.kind === 'integer' ? '1' : undefined}
          min={col.kind === 'number' || col.kind === 'integer' ? 0 : undefined}
          aria-label={`กรอก ${col.header} ของ ${row.projectName}`}
          className="ptSheetCellInput"
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
              void commitCellEdit(row, col, draftValue, {
                horizontal: e.shiftKey ? -1 : 1,
              })
            } else if (e.key === 'Enter') {
              e.preventDefault()
              void commitCellEdit(row, col, draftValue, {
                vertical: e.shiftKey ? -1 : 1,
              })
            }
          }}
        />
      )
    }

    const rawVal = row[field]
    if (col.statusBadge) {
      const statusText = typeof rawVal === 'string' && rawVal.trim() ? rawVal : 'ยังไม่ส่ง'
      return (
        <span className={`ptSheetDisplay ${isSaving ? 'ptSheetCellSaving' : ''}`}>
          <span className={getStatusBadgeClass(statusText)}>
            <span className="ptBadgeDot" aria-hidden="true" />
            {statusText}
          </span>
        </span>
      )
    }

    const displayText =
      col.kind === 'number'
        ? typeof rawVal === 'number' && rawVal > 0
          ? fmtMoney(rawVal)
          : field === 'actualSpent'
            ? fmtMoney(Number(rawVal ?? 0))
            : '-'
        : col.kind === 'integer'
          ? String(rawVal ?? '-')
          : typeof rawVal === 'string' && rawVal.trim() !== ''
            ? rawVal
            : '-'

    const isMuted = displayText === '-'

    return (
      <span
        className={`ptSheetDisplay ${isMuted ? 'ptSheetCellMuted' : ''} ${
          isSaving ? 'ptSheetCellSaving' : ''
        }`}
      >
        {displayText}
      </span>
    )
  }

  return (
    <div className="ptPage" data-theme="light">
      <div className="ptContainer">
        <header className="ptHeader">
          <div>
            <Link href="/service" className="ptBackLink">
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span>กลับหน้าระบบสารสนเทศภายใน</span>
            </Link>
            <div className="ptTitleRow">
              <h1 className="ptTitle">ระบบติดตามการส่งโครงการ</h1>
              <span className="ptFyBadge">
                <span className="ptFyDot" aria-hidden="true" />
                {fiscalYear !== null ? `ปีงบประมาณ ${fiscalYear}` : 'กำลังโหลด'}
              </span>
              {!hasManagePermission && (
                <span className="ptViewOnlyBadge">สิทธิ์ดูข้อมูลอย่างเดียว</span>
              )}
            </div>
            <p className="ptSubtitle">
              Dashboard สรุปผลความก้าวหน้าการส่งสรุปโครงการและงบประมาณ โรงพยาบาลเถิน
            </p>
          </div>

          <div className="ptHeaderActions">
            <button
              type="button"
              className="ptBtn"
              onClick={() => void fetchData()}
              disabled={loading}
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              รีเฟรช
            </button>

            {isAdmin && (
              <Link href="/member/settings?task=PROJECT_TRACKER" className="ptBtn">
                <ShieldCheck size={16} strokeWidth={1.5} />
                จัดการสิทธิ์ลงข้อมูล
              </Link>
            )}

            {hasManagePermission && (
              <button
                type="button"
                className="ptBtn"
                onClick={() => setImportOpen(true)}
              >
                <Upload size={16} strokeWidth={1.5} />
                นำเข้า Excel
              </button>
            )}

            <button
              type="button"
              className="ptBtn"
              onClick={() => void handleExportExcel()}
              disabled={exporting || !data || items.length === 0}
            >
              <FileOutput size={16} strokeWidth={1.5} />
              {exporting ? 'กำลังส่งออก' : 'Export Excel'}
            </button>

            {hasManagePermission && (
              <button
                type="button"
                className="ptBtn ptBtnPrimary"
                onClick={() => setFormOpen(true)}
              >
                <Plus size={16} strokeWidth={1.5} />
                เพิ่มโครงการ
              </button>
            )}
          </div>
        </header>

        {error && <div className="ptAlert ptAlertError">{error}</div>}
        {notice && (
          <div className="ptAlert ptAlertInfo">
            <span>{notice}</span>
            <button
              type="button"
              className="ptBtn ptBtnSm"
              onClick={() => setNotice(null)}
            >
              ปิด
            </button>
          </div>
        )}

        <div className="ptControlBar">
          <div className="ptFilterGroup">
            <select
              aria-label="เลือกปีงบประมาณ"
              className="ptSelect"
              value={
                fiscalYear !== null && availableFiscalYears.includes(fiscalYear)
                  ? String(fiscalYear)
                  : ''
              }
              disabled={availableFiscalYears.length === 0}
              onChange={(e) => {
                const nextFy = Number(e.target.value)
                if (Number.isInteger(nextFy)) {
                  setStrategyFilter('')
                  setStatusFilter('')
                  setSourceFilter('')
                  setSelectedFiscalYear(nextFy)
                }
              }}
            >
              {availableFiscalYears.length === 0 ? (
                <option value="">ยังไม่มีข้อมูลปีงบประมาณ</option>
              ) : (
                availableFiscalYears.map((fy) => (
                  <option key={fy} value={String(fy)}>
                    ปีงบประมาณ {fy}
                  </option>
                ))
              )}
            </select>

            <select
              aria-label="กรองตามยุทธศาสตร์"
              className="ptSelect"
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
            >
              <option value="">ทุกยุทธศาสตร์ ({availableStrategies.length})</option>
              {availableStrategies.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตามสถานะการส่งงาน"
              className="ptSelect"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">ทุกสถานะ ({availableStatuses.length})</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตามแหล่งงบประมาณ"
              className="ptSelect"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">ทุกแหล่งงบประมาณ ({availableBudgetSources.length})</option>
              {availableBudgetSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>

            <div className="ptSearchWrap">
              <Search size={16} strokeWidth={1.5} className="ptSearchIcon" />
              <input
                type="text"
                aria-label="ค้นหาชื่อโครงการ รหัส หรือผู้รับผิดชอบ"
                className="ptInput ptSearchInput"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหา ชื่อโครงการ, รหัส, ผู้รับผิดชอบ"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="ptBtn ptBtnGhost ptBtnSm"
                onClick={handleResetFilters}
              >
                <X size={14} strokeWidth={1.5} />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="ptTabGroup" role="tablist" aria-label="มุมมองข้อมูล">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'both'}
              className={`ptTabBtn ${activeView === 'both' ? 'active' : ''}`}
              onClick={() => setActiveView('both')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'dashboard'}
              className={`ptTabBtn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <BarChart3 size={16} strokeWidth={1.5} />
              Dashboard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'table'}
              className={`ptTabBtn ${activeView === 'table' ? 'active' : ''}`}
              onClick={() => setActiveView('table')}
            >
              <Table2 size={16} strokeWidth={1.5} />
              ทะเบียนคุม ({items.length})
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="ptCard">
            <div className="ptEmpty">กำลังโหลดข้อมูลระบบติดตามโครงการ</div>
          </div>
        ) : (
          <>
            {data && yearStats && (activeView === 'both' || activeView === 'dashboard') && (
              <ProjectTrackerDashboard
                stats={yearStats}
                fiscalYear={data.fiscalYear}
                strategyFilter={strategyFilter}
                statusFilter={statusFilter}
                budgetSourceFilter={sourceFilter}
                onSelectStrategy={setStrategyFilter}
                onSelectStatus={setStatusFilter}
                onSelectBudgetSource={setSourceFilter}
              />
            )}

            {(activeView === 'both' || activeView === 'table') && (
              <section className="ptTableCard" aria-label="ตารางทะเบียนคุมโครงการ">
                <div className="ptTableMeta">
                  <span>
                    แสดงทั้งหมด <strong>{items.length.toLocaleString()}</strong> โครงการ
                    {strategyFilter ? ` · ${strategyFilter}` : ''}
                    {statusFilter ? ` · สถานะ ${statusFilter}` : ''}
                    {sourceFilter ? ` · แหล่งงบ ${sourceFilter}` : ''}
                  </span>
                  <span>
                    {hasManagePermission
                      ? 'คลิกที่ช่องใดก็ได้เพื่อแก้ไขทันที (เหมือน Sheet) · กด Tab เลื่อนช่อง · Enter เพื่อบันทึก'
                      : 'สิทธิ์ดูข้อมูลอย่างเดียว · ขอสิทธิ์ลงข้อมูลได้ที่ผู้ดูแลระบบ (/member/settings)'}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="ptEmpty">
                    {hasManagePermission
                      ? `ไม่พบโครงการ${fiscalYear !== null ? `ในปีงบประมาณ ${fiscalYear}` : ''} กดปุ่ม "เพิ่มโครงการ" หรือ "นำเข้า Excel"`
                      : `ไม่พบโครงการ${fiscalYear !== null ? `ในปีงบประมาณ ${fiscalYear}` : ''}`}
                  </div>
                ) : (
                  <div className="ptTableScroll">
                    <table className="ptTable" role="grid">
                      <colgroup>
                        {SHEET_COLUMNS.map((col) => (
                          <col key={col.key} style={{ width: col.width }} />
                        ))}
                        {hasManagePermission && (
                          <col style={{ width: '3.75rem' }} />
                        )}
                      </colgroup>
                      <thead>
                        <tr>
                          {SHEET_COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              className={
                                col.kind === 'number' ||
                                col.key === 'allocatedBudget' ||
                                col.key === 'remainingBudget'
                                  ? 'ptCellNum'
                                  : col.kind === 'integer'
                                    ? 'ptCellCenter'
                                    : undefined
                              }
                            >
                              {col.header}
                            </th>
                          ))}
                          {hasManagePermission && (
                            <th className="ptStickyActions">ลบ</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((row) => (
                          <tr key={row.id}>
                            {SHEET_COLUMNS.map((col) => {
                              const isEditable =
                                hasManagePermission && col.kind !== 'readonly'
                              const isEditing =
                                isEditable &&
                                activeCell?.rowId === row.id &&
                                activeCell?.field === col.key

                              const classNames = [
                                isEditable ? 'ptSheetTd' : '',
                                isEditing ? 'ptSheetTdEditing' : '',
                                col.kind === 'number' ||
                                col.key === 'allocatedBudget' ||
                                col.key === 'remainingBudget'
                                  ? 'ptCellNum'
                                  : col.kind === 'integer'
                                    ? 'ptCellCenter'
                                    : '',
                                col.semibold ? 'ptFwSemibold' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')

                              return (
                                <td
                                  key={col.key}
                                  className={classNames}
                                  role={isEditable ? 'gridcell' : undefined}
                                  tabIndex={isEditable && !isEditing ? 0 : undefined}
                                  title={
                                    isEditable ? `คลิกเพื่อแก้ไข ${col.header}` : undefined
                                  }
                                  onClick={
                                    isEditable && !isEditing
                                      ? () => startCellEdit(row, col)
                                      : undefined
                                  }
                                  onKeyDown={
                                    isEditable && !isEditing
                                      ? (e) => {
                                          if (
                                            e.key === 'Enter' ||
                                            e.key === ' ' ||
                                            e.key === 'F2'
                                          ) {
                                            e.preventDefault()
                                            startCellEdit(row, col)
                                          }
                                        }
                                      : undefined
                                  }
                                >
                                  {renderCellContent(row, col)}
                                </td>
                              )
                            })}
                            {hasManagePermission && (
                              <td className="ptStickyActions">
                                <div className="ptRowActions">
                                  <button
                                    type="button"
                                    className="ptIconBtn ptIconBtnDanger"
                                    title="ลบโครงการ"
                                    aria-label={`ลบ ${row.projectName}`}
                                    disabled={deletingId === row.id}
                                    onClick={() => void handleDeleteRow(row)}
                                  >
                                    <Trash2 size={14} strokeWidth={1.5} />
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

      <ProjectFormModal
        isOpen={formOpen}
        defaultFiscalYear={modalDefaultFiscalYear}
        availableFiscalYears={selectableFiscalYears}
        availableStrategies={availableStrategies}
        onClose={() => setFormOpen(false)}
        onSaved={async (savedFy, createdRecord) => {
          setNotice('เพิ่มโครงการใหม่เข้าทะเบียนเรียบร้อยแล้ว')
          if (savedFy && savedFy !== fiscalYear) {
            skipNextFetchForFyRef.current = savedFy
            setSelectedFiscalYear(savedFy)
            await fetchData(savedFy)
          } else if (createdRecord) {
            setData((prev) => {
              if (!prev) return prev
              const exists = prev.items.some((item) => item.id === createdRecord.id)
              const nextItems = exists
                ? prev.items.map((item) => (item.id === createdRecord.id ? createdRecord : item))
                : [...prev.items, createdRecord].sort(
                    (a, b) => a.sequenceNo - b.sequenceNo || a.id - b.id
                  )
              return {
                ...prev,
                items: nextItems,
              }
            })
          } else {
            await fetchData()
          }
        }}
      />

      <ProjectImportModal
        isOpen={importOpen}
        currentFiscalYear={modalDefaultFiscalYear}
        availableFiscalYears={selectableFiscalYears}
        onClose={() => setImportOpen(false)}
        onImported={async (importedFy) => {
          setNotice('นำเข้าข้อมูลโครงการจากไฟล์เรียบร้อยแล้ว')
          if (importedFy && importedFy !== fiscalYear) {
            skipNextFetchForFyRef.current = importedFy
            setSelectedFiscalYear(importedFy)
            await fetchData(importedFy)
          } else {
            await fetchData()
          }
        }}
      />
    </div>
  )
}
