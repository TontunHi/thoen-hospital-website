'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Download,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Info,
  ShieldCheck,
  FolderOpen,
  Plus,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowUpDown,
} from 'lucide-react'
import type {
  T1dmRegistrySummary,
  T1dmImportedFileSummary,
  T1dmRegistryListResult,
  T1dmRegistryItem,
  T1dmRegistryHospFilter,
  T1dmRegistrySortField,
  T1dmImportParseResult,
  ParsedT1dmExcelRow,
} from '@/lib/clinical/rcmT1dmImportService'
import { formatThaiDate } from '@/lib/formatters'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

export interface T1dmImportClientProps {
  initialData?: T1dmRegistryListResult | null
  initialError?: string | null
  canImport?: boolean
  canManage?: boolean
}

export interface QueuedImportFile {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'processing' | 'success' | 'error'
  result?: T1dmImportParseResult
  errorMessage?: string
  isDuplicate?: boolean
}

export default function T1dmImportClient({
  initialData = null,
  initialError = null,
  canImport = true,
  canManage = false,
}: T1dmImportClientProps) {
  // Database stats & ledger state
  const [summary, setSummary] = useState<T1dmRegistrySummary>(
    initialData?.summary ?? {
      totalRegistered: 0,
      myHospCount: 0,
      otherHospCount: 0,
      t1dmCount: 0,
      gdmCount: 0,
      pdmCount: 0,
      otherTypeCount: 0,
      matchedHosxpHnCount: 0,
      totalFiles: 0,
    }
  )
  const [registryItems, setRegistryItems] = useState<T1dmRegistryItem[]>(
    initialData?.items ?? []
  )
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [availableTypes, setAvailableTypes] = useState<string[]>(
    initialData?.availableTypes ?? ['T1DM', 'GDM', 'PDM']
  )
  const [importedFiles, setImportedFiles] = useState<T1dmImportedFileSummary[]>(
    initialData?.importedFiles ?? []
  )
  const myHospCode = initialData?.myHospCode || '11152'

  // Registry Ledger query filters (Atomic state transitions)
  const [hospFilter, setHospFilter] = useState<T1dmRegistryHospFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [ledgerSearchInput, setLedgerSearchInput] = useState<string>('')
  const [ledgerSearch, setLedgerSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<T1dmRegistrySortField>('regdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const pageSize = 50

  // Loading & error states
  const [isRefreshingStats, setIsRefreshingStats] = useState<boolean>(false)
  const [isExportingRegistry, setIsExportingRegistry] = useState<boolean>(false)
  const [statsError, setStatsError] = useState<string | null>(initialError)

  // Multi-file upload queue
  const [fileQueue, setFileQueue] = useState<QueuedImportFile[]>([])
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [filterMyHospOnly, setFilterMyHospOnly] = useState<boolean>(true) // FoxPro default: setHospCode=.T., lHospCode=.T.
  const [isDryRun, setIsDryRun] = useState<boolean>(true) // Safe default: Dry Run enabled by default

  // Batch execution & Progress state
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false)
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0)
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [progressStage, setProgressStage] = useState<string>('')

  // Active result view (All files or specific file)
  const [selectedFileTabId, setSelectedFileTabId] = useState<string>('all')
  const [tableSearch, setTableSearch] = useState<string>('')

  // Delete confirmations
  const [isDeleteOtherHospModalOpen, setIsDeleteOtherHospModalOpen] = useState<boolean>(false)
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [isFilesModalOpen, setIsFilesModalOpen] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const ledgerAbortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Debounce ledger search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ledgerSearchInput !== ledgerSearch) {
        setLedgerSearch(ledgerSearchInput)
        setCurrentPage(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [ledgerSearchInput, ledgerSearch])

  // Refresh DB stats and paginated registry ledger from server
  const fetchRegistryData = useCallback(
    async (forceRefresh = false) => {
      ledgerAbortRef.current?.abort()
      const controller = new AbortController()
      ledgerAbortRef.current = controller

      setIsRefreshingStats(true)
      try {
        const q = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(pageSize),
          hospFilter,
          typeFilter,
          sortBy,
          sortOrder,
        })
        if (ledgerSearch.trim()) q.set('search', ledgerSearch.trim())
        if (forceRefresh) q.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/t1dm-import?${q.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (json.success && json.data) {
          setSummary(json.data.summary)
          setRegistryItems(json.data.items || [])
          setTotalCount(json.data.totalCount ?? 0)
          setTotalPages(json.data.totalPages ?? 1)
          setImportedFiles(json.data.importedFiles || [])
          if (json.data.availableTypes?.length) {
            setAvailableTypes(json.data.availableTypes)
          }
          setStatsError(null)
        } else {
          setStatsError(json.error || 'ไม่สามารถโหลดข้อมูลทะเบียนได้')
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setStatsError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      } finally {
        if (!controller.signal.aborted) {
          setIsRefreshingStats(false)
        }
      }
    },
    [currentPage, pageSize, hospFilter, typeFilter, ledgerSearch, sortBy, sortOrder]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchRegistryData(false)
    return () => {
      ledgerAbortRef.current?.abort()
    }
  }, [fetchRegistryData, initialData])

  // Atomic filter handlers for Registry Ledger
  const handleHospFilterChange = (nextFilter: T1dmRegistryHospFilter) => {
    setHospFilter(nextFilter)
    setCurrentPage(1)
  }

  const handleTypeFilterChange = (nextType: string) => {
    setTypeFilter(nextType)
    setCurrentPage(1)
  }

  const handleSortChange = (field: T1dmRegistrySortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'regdate' || field === 'visitdate' ? 'desc' : 'asc')
    }
    setCurrentPage(1)
  }

  // Drag & drop handlers for multiple files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const addFilesToQueue = (filesList: FileList | File[]) => {
    const valid: QueuedImportFile[] = []
    Array.from(filesList).forEach((f) => {
      if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
        const isDuplicate = importedFiles.some(
          (imp) => imp.fileName.toLowerCase() === f.name.toLowerCase()
        )
        const alreadyInQueue = fileQueue.some((q) => q.name === f.name && q.size === f.size)
        if (!alreadyInQueue) {
          valid.push({
            id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            file: f,
            name: f.name,
            size: f.size,
            status: 'pending',
            isDuplicate,
          })
        }
      }
    })
    if (valid.length > 0) {
      setFileQueue((prev) => [...prev, ...valid])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveQueueFile = (id: string) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id))
    if (selectedFileTabId === id) setSelectedFileTabId('all')
  }

  const handleClearAllQueue = () => {
    setFileQueue([])
    setSelectedFileTabId('all')
    setProgressPercent(0)
    setProgressStage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Batch process all queued files with current mode (Dry Run or Live Import)
  const executeImportQueue = async (overrideDryRun?: boolean) => {
    if (fileQueue.length === 0 || isProcessingQueue) return

    const targetDryRun = overrideDryRun !== undefined ? overrideDryRun : isDryRun
    if (overrideDryRun !== undefined) {
      setIsDryRun(overrideDryRun)
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsProcessingQueue(true)
    setProgressPercent(0)

    const pendingFiles =
      overrideDryRun !== undefined
        ? [...fileQueue]
        : fileQueue.filter((f) => f.status === 'pending' || f.status === 'error')
    if (pendingFiles.length === 0) {
      pendingFiles.push(...fileQueue)
    }

    const totalBatchCount = pendingFiles.length

    for (let i = 0; i < totalBatchCount; i++) {
      const currentItem = pendingFiles[i]
      setCurrentFileIndex(i + 1)

      const fileProgressBase = (i / totalBatchCount) * 100
      const fileProgressChunk = 100 / totalBatchCount

      setFileQueue((prev) =>
        prev.map((f) =>
          f.id === currentItem.id ? { ...f, status: 'processing', errorMessage: undefined } : f
        )
      )

      setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.15))
      setProgressStage(`[${i + 1}/${totalBatchCount}] กำลังอ่านชีท T1DM: ${currentItem.name}`)

      try {
        const formData = new FormData()
        formData.append('file', currentItem.file)
        formData.append('dryRun', String(targetDryRun))
        formData.append('filterMyHospOnly', String(filterMyHospOnly))
        formData.append('myHospCode', myHospCode)

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.45))
        setProgressStage(`[${i + 1}/${totalBatchCount}] ตรวจสอบคอลัมน์ RUN | PID | สิทธิ | หน่วยบริการ`)

        const res = await fetch('/api/service/dashboard-rcm/t1dm-import', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.8))
        setProgressStage(
          targetDryRun
            ? `[${i + 1}/${totalBatchCount}] ตรวจสอบ HN ใน HOSxP (โหมดจำลอง Dry Run)`
            : `[${i + 1}/${totalBatchCount}] เชื่อมโยง HN จาก HOSxP และบันทึกลงฐานข้อมูล`
        )

        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || `ข้อผิดพลาดรหัส ${res.status}`)
        }

        const parseResult: T1dmImportParseResult = json.data

        setFileQueue((prev) =>
          prev.map((f) =>
            f.id === currentItem.id ? { ...f, status: 'success', result: parseResult } : f
          )
        )

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk))
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'นำเข้าไฟล์ไม่สำเร็จ'
        setFileQueue((prev) =>
          prev.map((f) =>
            f.id === currentItem.id ? { ...f, status: 'error', errorMessage: message } : f
          )
        )
      }
    }

    setProgressPercent(100)
    setProgressStage(
      targetDryRun
        ? `จำลองตรวจสอบเสร็จสมบูรณ์ ${totalBatchCount} ไฟล์ (ยังไม่ได้บันทึกลงฐานข้อมูล)`
        : `นำเข้าและบันทึกข้อมูลสำเร็จทั้งสิ้น ${totalBatchCount} ไฟล์`
    )
    setIsProcessingQueue(false)

    // Refresh database statistics & ledger
    fetchRegistryData(true)
  }

  // Delete other hospitals (FoxPro: delete from rcmdb.t1dm where hospmain <> 11152)
  const handleDeleteOtherHospitals = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/service/dashboard-rcm/t1dm-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'other_hospitals',
          myHospCode,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ลบข้อมูลไม่สำเร็จ')
      }

      setIsDeleteOtherHospModalOpen(false)
      fetchRegistryData(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setIsDeleting(false)
    }
  }

  // Delete all records (FoxPro: CalDelete / cmdDel.RightClick)
  const handleDeleteAllRegistries = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/service/dashboard-rcm/t1dm-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'all',
          myHospCode,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ล้างข้อมูลไม่สำเร็จ')
      }

      setIsDeleteAllModalOpen(false)
      setIsFilesModalOpen(false)
      fetchRegistryData(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการล้างข้อมูล')
    } finally {
      setIsDeleting(false)
    }
  }

  // Delete file records (FoxPro: delete from rcmdb.t1dm where filename=?_file)
  const handleDeleteByFileName = async (fileName: string) => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/service/dashboard-rcm/t1dm-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'by_file',
          fileName,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ลบข้อมูลไม่สำเร็จ')
      }

      setFileToDelete(null)
      fetchRegistryData(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setIsDeleting(false)
    }
  }

  // Aggregate results across all files or active file tab
  const successfulFiles = useMemo(
    () => fileQueue.filter((f) => f.status === 'success' && f.result),
    [fileQueue]
  )

  const activeResultFile = useMemo(() => {
    if (selectedFileTabId === 'all') return null
    return fileQueue.find((f) => f.id === selectedFileTabId) || null
  }, [fileQueue, selectedFileTabId])

  const lastBatchWasDryRun = useMemo(() => {
    const targetList = activeResultFile?.result ? [activeResultFile] : successfulFiles
    return targetList.length > 0 && targetList.every((f) => f.result?.isDryRun)
  }, [successfulFiles, activeResultFile])

  // Combined metrics from newly processed files
  const combinedMetrics = useMemo(() => {
    let totalRows = 0
    let importedRows = 0
    let skippedOtherHosp = 0
    let matchedHn = 0
    let errorCount = 0
    const typeBreakdown: Record<string, number> = {}

    const targetList = activeResultFile?.result ? [activeResultFile] : successfulFiles

    targetList.forEach((item) => {
      if (item.result) {
        totalRows += item.result.totalRowsScanned
        importedRows += item.result.importedCount
        skippedOtherHosp += item.result.skippedOtherHospCount
        errorCount += item.result.errorCount || 0
        if (item.result.previewRows) {
          item.result.previewRows.forEach((r) => {
            if (r.hn) matchedHn++
          })
        }
        Object.entries(item.result.typeBreakdown || {}).forEach(([k, v]) => {
          typeBreakdown[k] = (typeBreakdown[k] || 0) + v
        })
      }
    })

    return {
      totalRows,
      importedRows,
      skippedOtherHosp,
      matchedHn,
      errorCount,
      typeBreakdown,
      processedCount: targetList.length,
    }
  }, [successfulFiles, activeResultFile])

  // Preview rows of what was imported
  const displayedPreviewRows = useMemo(() => {
    let rows: ParsedT1dmExcelRow[] = []
    if (activeResultFile?.result) {
      rows = activeResultFile.result.previewRows || []
    } else {
      successfulFiles.forEach((f) => {
        if (f.result?.previewRows) {
          rows.push(...f.result.previewRows)
        }
      })
    }

    if (!tableSearch.trim()) return rows
    const q = tableSearch.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.pid.toLowerCase().includes(q) ||
        (r.hn && r.hn.toLowerCase().includes(q)) ||
        r.ptname.toLowerCase().includes(q) ||
        (r.type && r.type.toLowerCase().includes(q)) ||
        (r.maininscl && r.maininscl.toLowerCase().includes(q)) ||
        r.hospmain.toLowerCase().includes(q)
    )
  }, [activeResultFile, successfulFiles, tableSearch])

  // Export processed preview rows to Excel
  const handleExportPreviewExcel = async () => {
    if (displayedPreviewRows.length === 0) return
    await exportRcmExcel({
      filename: `t1dm_import_preview_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'ตัวอย่างข้อมูลทะเบียน T1DM/GDM/PDM ที่ประมวลผล',
      subtitle: `โรงพยาบาลเถิน • จำนวน ${displayedPreviewRows.length.toLocaleString('th-TH')} รายการ`,
      headers: [
        'ลำดับ',
        'RUN (ID)',
        'ปีงบประมาณ',
        'เลขประจำตัวประชาชน (PID)',
        'HN ใน HOSxP',
        'ชื่อ-สกุล',
        'สิทธิการรักษา',
        'รหัสหน่วยบริการ',
        'หน่วยบริการลงทะเบียน',
        'ชนิดการลงทะเบียน',
        'วันที่ลงทะเบียน',
        'วันที่เข้ารับบริการ',
        'สถานะสังกัด',
      ],
      rows: displayedPreviewRows.map((r, idx) => [
        idx + 1,
        r.id,
        r.year || '',
        r.pid,
        r.hn || '',
        r.ptname,
        r.maininscl || '',
        r.hospmainCode,
        r.hospmain,
        r.type || '',
        r.regdate ? formatThaiDate(r.regdate) : '',
        r.visitdate ? formatThaiDate(r.visitdate) : '',
        r.isOtherHosp ? 'ต่างหน่วยบริการ' : 'รพ.เถิน (11152)',
      ]),
    })
  }

  // Export full database registry ledger to Excel (exportAll=true)
  const handleExportFullRegistryExcel = async () => {
    if (isExportingRegistry) return
    setIsExportingRegistry(true)
    try {
      const q = new URLSearchParams({
        exportAll: 'true',
        hospFilter,
        typeFilter,
        sortBy,
        sortOrder,
      })
      if (ledgerSearch.trim()) q.set('search', ledgerSearch.trim())

      const res = await fetch(`/api/service/dashboard-rcm/t1dm-import?${q.toString()}`)
      const json = await res.json()
      const items: T1dmRegistryItem[] = json?.data?.items || registryItems
      if (items.length === 0) return

      await exportRcmExcel({
        filename: `t1dm_registry_${new Date().toISOString().slice(0, 10)}.xlsx`,
        title: 'ทะเบียน T1DM/GDM/PDM (rcmdb.t1dm)',
        subtitle: `โรงพยาบาลเถิน (${myHospCode}) • จำนวน ${items.length.toLocaleString('th-TH')} รายการ`,
        headers: [
          'NO',
          'ID (RUN)',
          'ปีงบประมาณ',
          'PID',
          'HN (HOSxP)',
          'PTNAME',
          'REGDATE',
          'VISITDATE',
          'TYPE',
          'MAININSCL',
          'HOSPMAIN',
          'FILENAME',
        ],
        rows: items.map((r) => [
          r.no,
          r.id,
          r.year || '',
          r.pid,
          r.hn || '',
          r.ptname,
          r.regdate ? formatThaiDate(r.regdate) : '',
          r.visitdate ? formatThaiDate(r.visitdate) : '',
          r.type || '',
          r.maininscl || '',
          r.hospmain,
          r.fileName || '',
        ]),
      })
    } finally {
      setIsExportingRegistry(false)
    }
  }

  return (
    <div className="t1dm-import-container">
      {/* ── 1. Header Section ── */}
      <div className="t1dm-import-header">
        <div className="t1dm-import-title-group">
          <div className="t1dm-import-breadcrumb">
            <Link href="/">หน้าหลัก</Link>
            <span className="t1dm-import-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm">Dashboard RCM</Link>
            <span className="t1dm-import-breadcrumb-sep">/</span>
            <span>นำเข้าข้อมูล</span>
            <span className="t1dm-import-breadcrumb-sep">/</span>
            <span className="t1dm-import-breadcrumb-current">ทะเบียน T1DM/GDM/PDM</span>
          </div>

          <h1 className="t1dm-import-title">
            <span>ระบบนำเข้าข้อมูลทะเบียน T1DM/GDM/PDM</span>
          </h1>
          <p className="t1dm-import-subtitle">
            นำเข้าและตรวจสอบไฟล์ Excel ทะเบียนผู้ป่วยเบาหวาน สปสช. (*T1DM*.XLS*) กรองรหัสหน่วยบริการ 11152 และเชื่อมโยง HN ใน HOSxP
          </p>
        </div>

        <div className="t1dm-import-actions">
          <button
            type="button"
            onClick={() => fetchRegistryData(true)}
            disabled={isRefreshingStats}
            className="t1dm-import-btn secondary"
            title="รีเฟรชข้อมูลทะเบียนจากฐานข้อมูล (FoxPro: cmdRefresh)"
          >
            <RefreshCw size={15} className={isRefreshingStats ? 't1dm-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <Link
            href="/service/dashboard-rcm/funds/t1dm-gdm-pdm/2"
            className="t1dm-import-btn primary"
            title="เปิดหน้ารายชื่อผู้รับบริการกองทุน T1DM/GDM/PDM (ตรวจสอบยอดชดเชย & PDX O24)"
          >
            <ExternalLink size={15} />
            <span>เปิดหน้ารายชื่อผู้รับบริการ (กองทุน) →</span>
          </Link>
        </div>
      </div>

      {statsError && (
        <div className="t1dm-import-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{statsError}</span>
        </div>
      )}

      {/* ── 2. Database Overview Stats Cards (Numbers-first Unslop Standard) ── */}
      <div className="t1dm-import-stats-grid">
        <button
          type="button"
          onClick={() => handleHospFilterChange('ALL')}
          className={`t1dm-import-stat-card is-interactive ${hospFilter === 'ALL' ? 'is-selected' : ''}`}
        >
          <span className="t1dm-import-stat-label">ผู้ป่วยในทะเบียนทั้งหมด</span>
          {isRefreshingStats && registryItems.length === 0 ? (
            <div className="rcm-skeleton-bar" style={{ width: '88px', height: '28px', margin: '4px 0' }} />
          ) : (
            <span className="t1dm-import-stat-value">
              {(summary.totalRegistered ?? 0).toLocaleString('th-TH')}
            </span>
          )}
          <span className="t1dm-import-stat-sub">
            ตาราง rcmdb.t1dm • จับคู่ HN {(summary.matchedHosxpHnCount ?? 0).toLocaleString('th-TH')} ราย
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleHospFilterChange('MINE')}
          className={`t1dm-import-stat-card is-interactive ${hospFilter === 'MINE' ? 'is-selected' : ''}`}
        >
          <span className="t1dm-import-stat-label">หน่วยบริการ รพ.เถิน (11152)</span>
          {isRefreshingStats && registryItems.length === 0 ? (
            <div className="rcm-skeleton-bar" style={{ width: '88px', height: '28px', margin: '4px 0' }} />
          ) : (
            <span className="t1dm-import-stat-value accent">
              {(summary.myHospCount ?? 0).toLocaleString('th-TH')}
            </span>
          )}
          <span className="t1dm-import-stat-sub">
            {(summary.totalRegistered ?? 0) > 0
              ? `${(((summary.myHospCount ?? 0) / summary.totalRegistered) * 100).toFixed(1)}% ของทะเบียนทั้งหมด`
              : '0.0% ของทะเบียนทั้งหมด'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleHospFilterChange('OTHER')}
          className={`t1dm-import-stat-card is-interactive ${hospFilter === 'OTHER' ? 'is-selected-danger' : ''}`}
        >
          <span className="t1dm-import-stat-label">ต่างหน่วยบริการ (ไม่ใช่ 11152)</span>
          {isRefreshingStats && registryItems.length === 0 ? (
            <div className="rcm-skeleton-bar" style={{ width: '72px', height: '28px', margin: '4px 0' }} />
          ) : (
            <span
              className={`t1dm-import-stat-value ${(summary.otherHospCount ?? 0) > 0 ? 'danger' : ''}`}
            >
              {(summary.otherHospCount ?? 0).toLocaleString('th-TH')}
            </span>
          )}
          <span className="t1dm-import-stat-sub">
            {(summary.otherHospCount ?? 0) > 0
              ? 'ไฮไลท์แถวสีชมพู • ลบออกได้'
              : 'ไม่มีรายการต่างหน่วยบริการตกค้าง'}
          </span>
        </button>

        <div className="t1dm-import-stat-card">
          <span className="t1dm-import-stat-label">จำนวนไฟล์ที่นำเข้าแล้ว</span>
          {isRefreshingStats && registryItems.length === 0 ? (
            <div className="rcm-skeleton-bar" style={{ width: '72px', height: '28px', margin: '4px 0' }} />
          ) : (
            <span className="t1dm-import-stat-value">
              {(summary.totalFiles ?? 0).toLocaleString('th-TH')} ไฟล์
            </span>
          )}
          <span className="t1dm-import-stat-sub">
            T1DM {(summary.t1dmCount ?? 0).toLocaleString('th-TH')} • GDM{' '}
            {(summary.gdmCount ?? 0).toLocaleString('th-TH')} • PDM{' '}
            {(summary.pdmCount ?? 0).toLocaleString('th-TH')}
          </span>
        </div>
      </div>

      {/* ── 3. Main Upload & Multi-File Queue Card ── */}
      <div className="t1dm-import-card">
        <div className="t1dm-import-card-header">
          <div className="t1dm-import-card-heading">
            <h2 className="t1dm-import-card-title">
              <FileSpreadsheet size={18} className="t1dm-import-icon-muted" />
              <span>เลือกไฟล์ Excel ทะเบียน T1DM (*T1DM*.XLS*)</span>
            </h2>
            <span className="t1dm-import-card-caption">
              ค่าเริ่มต้นเปิดโหมดตรวจสอบข้อมูลอย่างเดียว (Dry Run) เพื่อความปลอดภัยก่อนบันทึกจริง
            </span>
          </div>

          <div className="t1dm-import-header-tools">
            {importedFiles.length > 0 && (
              <button
                type="button"
                className="t1dm-import-btn secondary sm"
                onClick={() => setIsFilesModalOpen(true)}
                title="ดูประวัติและเลือกลบข้อมูลตามไฟล์ (FoxPro: cmdDel)"
              >
                <FolderOpen size={14} />
                <span>ประวัติไฟล์ ({importedFiles.length})</span>
              </button>
            )}

            {canImport && (summary.otherHospCount ?? 0) > 0 && (
              <button
                type="button"
                className="t1dm-import-btn danger sm"
                onClick={() => setIsDeleteOtherHospModalOpen(true)}
                title="ลบรายการต่าง รพ. (hospmain ไม่ใช่ 11152)"
              >
                <Trash2 size={14} />
                <span>ลบรายการต่าง รพ. ({summary.otherHospCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropzone */}
        <div
          className={`t1dm-import-dropzone ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label="คลิกหรือลากไฟล์ Excel ทะเบียน T1DM มาวางที่นี่เพื่อนำเข้า"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          <div className="t1dm-import-dropzone-icon">
            <Upload size={20} />
          </div>
          <div>
            <span className="t1dm-import-dropzone-main">
              ลากไฟล์มาวางที่นี่ หรือ <span className="t1dm-import-dropzone-highlight">คลิกเพื่อเลือกไฟล์</span>
            </span>
            <div className="t1dm-import-dropzone-sub">
              รองรับ .xlsx, .xls, .csv ตรวจสอบหัวชีท T1DM และแถวคอลัมน์ RUN | ปีงบประมาณ | PID | ชนิดการลงทะเบียน
            </div>
          </div>
        </div>

        {/* Files Queue List */}
        {fileQueue.length > 0 && (
          <div className="t1dm-import-files-panel">
            <div className="t1dm-import-batch-bar">
              <div className="t1dm-import-batch-info">
                <FolderOpen size={15} className="t1dm-import-icon-muted" />
                <span>
                  คิวไฟล์รอประมวลผล <strong>{fileQueue.length} ไฟล์</strong> •{' '}
                  {(fileQueue.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
                {successfulFiles.length > 0 && (
                  <span className="t1dm-import-batch-done">
                    • ประมวลผลแล้ว {successfulFiles.length}/{fileQueue.length} ไฟล์
                  </span>
                )}
              </div>

              <div className="t1dm-import-batch-actions">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingQueue}
                  className="t1dm-import-btn secondary sm"
                >
                  <Plus size={14} />
                  <span>เพิ่มไฟล์</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllQueue}
                  disabled={isProcessingQueue}
                  className="t1dm-import-btn secondary sm"
                >
                  <Trash2 size={14} />
                  <span>ล้างคิว</span>
                </button>
              </div>
            </div>

            <div className="t1dm-import-files-list">
              {fileQueue.map((item) => (
                <div
                  key={item.id}
                  className={`t1dm-import-file-item ${
                    item.status === 'success'
                      ? 'is-success'
                      : item.status === 'error'
                      ? 'is-error'
                      : ''
                  }`}
                >
                  <div className="t1dm-import-file-item-left">
                    <FileSpreadsheet size={18} className="t1dm-import-file-item-icon" />
                    <div className="t1dm-import-file-item-details">
                      <span className="t1dm-import-file-item-name">{item.name}</span>
                      <div className="t1dm-import-file-item-meta">
                        <span className="t1dm-import-mono">{(item.size / 1024).toFixed(1)} KB</span>
                        {item.isDuplicate && (
                          <span className="t1dm-import-meta-warn">
                            • เคยนำเข้าไฟล์ชื่อนี้แล้ว
                          </span>
                        )}
                        {item.result && (
                          <span className="t1dm-import-meta-ok">
                            • {item.result.isDryRun ? 'ผ่านเกณฑ์ตรวจสอบ' : 'บันทึกสำเร็จ'}{' '}
                            {item.result.importedCount.toLocaleString('th-TH')} แถว (ข้ามต่าง รพ.{' '}
                            {item.result.skippedOtherHospCount})
                          </span>
                        )}
                        {item.errorMessage && (
                          <span className="t1dm-import-meta-err">• {item.errorMessage}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="t1dm-import-file-item-right">
                    {item.status === 'processing' && (
                      <span className="t1dm-import-file-status-badge processing">
                        <RefreshCw size={12} className="t1dm-spin" />
                        กำลังอ่าน
                      </span>
                    )}
                    {item.status === 'success' && (
                      <span className="t1dm-import-file-status-badge success">
                        <CheckCircle2 size={12} />
                        {item.result?.isDryRun ? 'ตรวจผ่าน' : 'สำเร็จ'}
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="t1dm-import-file-status-badge error">
                        <AlertCircle size={12} />
                        ผิดพลาด
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="t1dm-import-file-status-badge pending">รอประมวลผล</span>
                    )}

                    {!isProcessingQueue && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQueueFile(item.id)}
                        className="t1dm-import-file-remove-btn"
                        title="นำไฟล์นี้ออกจากคิว"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options Grid */}
        <div className="t1dm-import-options-grid">
          <label
            className={`t1dm-import-option-card ${filterMyHospOnly ? 'is-checked' : ''}`}
          >
            <input
              type="checkbox"
              checked={filterMyHospOnly}
              onChange={(e) => setFilterMyHospOnly(e.target.checked)}
              disabled={isProcessingQueue}
            />
            <div className="t1dm-import-option-content">
              <div className="t1dm-import-option-title-row">
                <span className="t1dm-import-checkbox-title">
                  นำเข้าเฉพาะหน่วยบริการ รพ.เถิน (11152)
                </span>
                <span className="t1dm-import-option-badge">FoxPro: lHospCode=.T.</span>
              </div>
              <span className="t1dm-import-checkbox-desc">
                กรองเฉพาะแถวที่ hospmain = 11152 รายการต่างหน่วยบริการจะถูกข้ามโดยอัตโนมัติ
              </span>
            </div>
          </label>

          <label
            className={`t1dm-import-option-card ${isDryRun ? 'is-checked-dryrun' : 'is-live-mode'}`}
          >
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              disabled={isProcessingQueue}
            />
            <div className="t1dm-import-option-content">
              <div className="t1dm-import-option-title-row">
                <span className="t1dm-import-checkbox-title">
                  โหมดตรวจสอบข้อมูลอย่างเดียว (Dry Run)
                </span>
                <span className={`t1dm-import-option-badge ${isDryRun ? 'amber' : 'emerald'}`}>
                  {isDryRun ? 'ค่าเริ่มต้น • ไม่บันทึกจริง' : 'ปิด Dry Run • บันทึกจริง'}
                </span>
              </div>
              <span className="t1dm-import-checkbox-desc">
                อ่านและจำลองตรวจโครงสร้างไฟล์ นับจำนวนแถวและจับคู่ HN โดยยังไม่บันทึกลงฐานข้อมูล (นำเครื่องหมายถูกออกเมื่อต้องการบันทึกจริง)
              </span>
            </div>
          </label>
        </div>

        {/* Action Bar */}
        <div className="t1dm-import-action-bar">
          <div className="t1dm-import-action-hint">
            <span className={`t1dm-import-mode-dot ${isDryRun ? 'dryrun' : 'live'}`} />
            <span>
              {isDryRun
                ? 'สถานะปัจจุบัน: โหมดตรวจสอบ (Dry Run) — ระบบจะจำลองการอ่านไฟล์โดยไม่แก้ไขฐานข้อมูล'
                : 'สถานะปัจจุบัน: โหมดนำเข้าจริง (Live Import) — ระบบจะบันทึกข้อมูลลงตาราง rcmdb.t1dm ทันที'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => executeImportQueue()}
            disabled={fileQueue.length === 0 || isProcessingQueue}
            className={`t1dm-import-cta-btn ${isDryRun ? 'is-dryrun' : 'is-live'}`}
          >
            {isProcessingQueue ? (
              <>
                <RefreshCw size={15} className="t1dm-spin" />
                <span>
                  กำลังประมวลผล {currentFileIndex}/{fileQueue.length}
                </span>
              </>
            ) : (
              <>
                {isDryRun ? <ShieldCheck size={16} /> : <Upload size={16} />}
                <span>
                  {isDryRun ? 'เริ่มตรวจสอบไฟล์ (Dry Run)' : 'เริ่มนำเข้าข้อมูลจริง'}
                  {fileQueue.length > 0 ? ` • ${fileQueue.length} ไฟล์` : ''}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Multi-Stage Progress Bar */}
        {(isProcessingQueue || progressPercent > 0) && (
          <div className="t1dm-import-progress-card">
            <div className="t1dm-import-progress-header">
              <span>{isProcessingQueue ? 'กำลังประมวลผลไฟล์...' : 'สถานะการทำงานล่าสุด'}</span>
              <span className="t1dm-import-mono">{progressPercent}%</span>
            </div>

            <div className="t1dm-import-progress-track">
              <div
                className="t1dm-import-progress-fill"
                style={{ transform: `scaleX(${progressPercent / 100})` }}
              />
            </div>

            <div className="t1dm-import-stage-text">
              <span className="t1dm-import-stage-dot" />
              <span>{progressStage}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Processed Results & Preview Section (Shows after Dry Run or Live Import) ── */}
      {(isProcessingQueue || successfulFiles.length > 0) && (
        <div className="t1dm-import-card">
          <div className="t1dm-import-card-header">
            <div className="t1dm-import-card-heading">
              <h2 className="t1dm-import-card-title">
                <CheckCircle2 size={18} className="t1dm-import-icon-accent" />
                <span>
                  {lastBatchWasDryRun
                    ? 'ผลการตรวจสอบไฟล์ทะเบียน T1DM/GDM/PDM (โหมดจำลอง Dry Run)'
                    : 'ผลการประมวลผลนำเข้าไฟล์ทะเบียน T1DM/GDM/PDM'}
                </span>
              </h2>
              <span className="t1dm-import-card-caption">
                {isProcessingQueue
                  ? 'กำลังดึงและประมวลผลข้อมูลจากไฟล์...'
                  : activeResultFile
                  ? `แสดงผลของไฟล์: ${activeResultFile.name}`
                  : `แสดงผลรวมทั้งหมด ${successfulFiles.length} ไฟล์`}
              </span>
            </div>

            <div className="t1dm-import-header-tools">
              <button
                type="button"
                onClick={handleExportPreviewExcel}
                disabled={displayedPreviewRows.length === 0}
                className="t1dm-import-btn secondary sm"
                title="ส่งออกตัวอย่างรายการที่ประมวลผลเป็นไฟล์ Excel"
              >
                <Download size={14} />
                <span>ส่งออกตัวอย่าง Excel</span>
              </button>
            </div>
          </div>

          {/* Multi-File Tab Switcher */}
          {successfulFiles.length > 1 && (
            <div className="t1dm-import-file-tabs">
              <button
                type="button"
                onClick={() => setSelectedFileTabId('all')}
                className={`t1dm-import-file-tab-btn ${selectedFileTabId === 'all' ? 'is-active' : ''}`}
              >
                <span>รวมทั้งหมด {successfulFiles.length} ไฟล์</span>
              </button>
              {successfulFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFileTabId(f.id)}
                  className={`t1dm-import-file-tab-btn ${selectedFileTabId === f.id ? 'is-active' : ''}`}
                >
                  <FileSpreadsheet size={13} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Summary Metric Cards */}
          <div className="t1dm-import-summary-grid">
            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">จำนวนแถวที่อ่านได้ทั้งหมด</span>
              <span className="t1dm-import-sum-val">
                {combinedMetrics.totalRows.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">รวมทุกชีทที่มีรหัส RUN</span>
            </div>

            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">
                {lastBatchWasDryRun ? 'ผ่านเกณฑ์พร้อมนำเข้า' : 'นำเข้าสำเร็จ (บันทึกลงฐานข้อมูล)'}
              </span>
              <span className="t1dm-import-sum-val green">
                {combinedMetrics.importedRows.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">
                {lastBatchWasDryRun
                  ? 'โหมดจำลอง (ยังไม่บันทึกจริง)'
                  : 'บันทึกลง rcmdb.t1dm เรียบร้อย'}
              </span>
            </div>

            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">ข้ามรายการต่าง รพ.</span>
              <span className="t1dm-import-sum-val pink">
                {combinedMetrics.skippedOtherHosp.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">
                {filterMyHospOnly ? 'กรองเฉพาะ รพ.เถิน (11152)' : 'นำเข้าทุกหน่วยบริการ'}
              </span>
            </div>

            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">จับคู่ HN ใน HOSxP สำเร็จ</span>
              <span className="t1dm-import-sum-val">
                {combinedMetrics.matchedHn.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">พบเลข HN จากตาราง patient</span>
            </div>
          </div>

          {/* Callout Banner: Either Dry Run Commit Action OR Link to Fund 2 */}
          {lastBatchWasDryRun ? (
            <div className="t1dm-import-callout is-dryrun-banner">
              <div className="t1dm-import-callout-left">
                <ShieldCheck size={20} className="t1dm-import-icon-amber" />
                <div>
                  <div className="t1dm-import-callout-title">
                    ตรวจสอบโครงสร้างไฟล์เสร็จสิ้น — ข้อมูลยังไม่ได้ถูกบันทึกลงฐานข้อมูล
                  </div>
                  <div className="t1dm-import-callout-desc">
                    พบข้อมูลพร้อมนำเข้า {combinedMetrics.importedRows.toLocaleString('th-TH')} รายการ
                    ท่านสามารถกดปุ่มด้านขวาเพื่อบันทึกข้อมูลจริงลงตาราง rcmdb.t1dm ได้ทันทีโดยไม่ต้องเลือกไฟล์ใหม่
                  </div>
                </div>
              </div>

              {canImport && (
                <button
                  type="button"
                  onClick={() => executeImportQueue(false)}
                  disabled={isProcessingQueue}
                  className="t1dm-import-btn primary"
                >
                  <Upload size={14} />
                  <span>ยืนยันนำเข้าข้อมูลจริง ({combinedMetrics.importedRows.toLocaleString('th-TH')} รายการ)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="t1dm-import-callout">
              <div className="t1dm-import-callout-left">
                <Info size={20} className="t1dm-import-icon-accent" />
                <div>
                  <div className="t1dm-import-callout-title">
                    ข้อมูลทะเบียนได้รับการนำเข้าสู่ระบบเรียบร้อยแล้ว
                  </div>
                  <div className="t1dm-import-callout-desc">
                    สามารถตรวจสอบรายชื่อผู้รับบริการ สถานะการลงทะเบียน (OK) รหัสวินิจฉัย O24 และติดตามยอดชดเชยได้ที่หน้ารายงานกองทุน
                  </div>
                </div>
              </div>

              <Link
                href="/service/dashboard-rcm/funds/t1dm-gdm-pdm/2"
                className="t1dm-import-btn primary sm"
              >
                <ExternalLink size={14} />
                <span>เปิดหน้ารายชื่อผู้รับบริการ (กองทุน) →</span>
              </Link>
            </div>
          )}

          {/* Search Bar inside Preview */}
          <div className="t1dm-import-toolbar">
            <div className="t1dm-import-search-wrap">
              <Search size={14} className="t1dm-import-search-icon" />
              <input
                type="search"
                placeholder="ค้นหาในตัวอย่างที่ประมวลผล (RUN, PID, HN, ชื่อ, ชนิด)"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="t1dm-import-search-input"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="t1dm-import-search-clear"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="t1dm-import-toolbar-meta">
              แสดงตัวอย่าง {displayedPreviewRows.length.toLocaleString('th-TH')} รายการ
            </div>
          </div>

          {/* Preview Table */}
          <div className="t1dm-import-table-wrap">
            <table className="t1dm-import-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }} className="col-center">ลำดับ</th>
                  <th style={{ minWidth: 88 }}>RUN (ID)</th>
                  <th style={{ width: 72 }} className="col-center">ปีงบ</th>
                  <th style={{ minWidth: 136 }}>เลขประจำตัวประชาชน (PID)</th>
                  <th style={{ minWidth: 88 }}>HN (HOSxP)</th>
                  <th style={{ minWidth: 180 }}>ชื่อ-นามสกุล</th>
                  <th style={{ width: 88 }} className="col-center">ชนิด</th>
                  <th style={{ width: 88 }} className="col-center">สิทธิ</th>
                  <th style={{ minWidth: 200 }}>หน่วยบริการลงทะเบียน</th>
                  <th style={{ width: 108 }} className="col-center">วันที่ลงทะเบียน</th>
                  <th style={{ width: 108 }} className="col-center">วันที่รับบริการ</th>
                </tr>
              </thead>
              <tbody>
                {displayedPreviewRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="t1dm-import-empty-cell">
                      ไม่พบข้อมูลตัวอย่างที่ตรงกับคำค้นหา
                    </td>
                  </tr>
                ) : (
                  displayedPreviewRows.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className={row.isOtherHosp ? 'is-other-hosp' : ''}>
                      <td className="col-center t1dm-import-mono">{idx + 1}</td>
                      <td className="t1dm-import-mono" style={{ fontWeight: 500 }}>
                        {row.id}
                      </td>
                      <td className="col-center t1dm-import-mono">{row.year || '—'}</td>
                      <td className="t1dm-import-mono">{row.pid}</td>
                      <td className="t1dm-import-mono">
                        {row.hn ? (
                          <span className="t1dm-hn-matched">{row.hn}</span>
                        ) : (
                          <span className="t1dm-text-muted">—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{row.ptname}</td>
                      <td className="col-center">
                        <span
                          className={`t1dm-tag ${
                            row.type?.toUpperCase().includes('T1DM')
                              ? 't1dm'
                              : row.type?.toUpperCase().includes('GDM')
                              ? 'gdm'
                              : row.type?.toUpperCase().includes('PDM')
                              ? 'pdm'
                              : 'neutral'
                          }`}
                        >
                          {row.type || '—'}
                        </span>
                      </td>
                      <td className="col-center">{row.maininscl || '—'}</td>
                      <td>
                        <span className={row.isOtherHosp ? 't1dm-hosp-other' : ''}>
                          {row.hospmain}
                        </span>
                      </td>
                      <td className="col-center t1dm-import-mono">
                        {row.regdate ? formatThaiDate(row.regdate) : '—'}
                      </td>
                      <td className="col-center t1dm-import-mono">
                        {row.visitdate ? formatThaiDate(row.visitdate) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* ── 5. FoxPro myReport Equivalent: ทะเบียน T1DM/GDM/PDM ในฐานข้อมูล (Ledger) ── */}
      {/* ========================================================================== */}
      <div className="t1dm-import-card">
        <div className="t1dm-import-card-header">
          <div className="t1dm-import-card-heading">
            <h2 className="t1dm-import-card-title">
              <Database size={18} className="t1dm-import-icon-muted" />
              <span>ทะเบียน T1DM/GDM/PDM ในฐานข้อมูล (rcmdb.t1dm)</span>
            </h2>
            <span className="t1dm-import-card-caption">
              เทียบเท่าหน้าต่าง myReport ใน FoxPro • ไฮไลท์สีชมพูสำหรับรายการที่ hospmain ≠ {myHospCode}
            </span>
          </div>

          <div className="t1dm-import-header-tools">
            <button
              type="button"
              onClick={handleExportFullRegistryExcel}
              disabled={totalCount === 0 || isExportingRegistry}
              className="t1dm-import-btn secondary sm"
              title="ส่งออกข้อมูลทะเบียนทั้งหมดในฐานข้อมูลเป็นไฟล์ Excel"
            >
              <Download size={14} />
              <span>{isExportingRegistry ? 'กำลังส่งออก...' : 'ส่งออกทะเบียน Excel'}</span>
            </button>
          </div>
        </div>

        {/* Ledger Filter & Search Bar */}
        <div className="t1dm-import-toolbar">
          <div className="t1dm-import-filter-group">
            <div className="t1dm-import-segmented" role="group" aria-label="กรองตามหน่วยบริการ">
              <button
                type="button"
                onClick={() => handleHospFilterChange('ALL')}
                className={`t1dm-import-seg-btn ${hospFilter === 'ALL' ? 'is-active' : ''}`}
              >
                ทั้งหมด ({(summary.totalRegistered ?? 0).toLocaleString('th-TH')})
              </button>
              <button
                type="button"
                onClick={() => handleHospFilterChange('MINE')}
                className={`t1dm-import-seg-btn ${hospFilter === 'MINE' ? 'is-active' : ''}`}
              >
                รพ.เถิน 11152 ({(summary.myHospCount ?? 0).toLocaleString('th-TH')})
              </button>
              <button
                type="button"
                onClick={() => handleHospFilterChange('OTHER')}
                className={`t1dm-import-seg-btn ${hospFilter === 'OTHER' ? 'is-active-danger' : ''}`}
              >
                ต่าง รพ. ({(summary.otherHospCount ?? 0).toLocaleString('th-TH')})
              </button>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              className="t1dm-import-select"
              aria-label="กรองตามชนิดการลงทะเบียน"
            >
              <option value="ALL">ทุกชนิด (T1DM/GDM/PDM)</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  ชนิด: {t}
                </option>
              ))}
            </select>
          </div>

          <div className="t1dm-import-search-wrap">
            <Search size={14} className="t1dm-import-search-icon" />
            <input
              type="search"
              placeholder="ค้นหาทะเบียน (ID, PID, HN, ชื่อ-สกุล, หน่วยบริการ)"
              value={ledgerSearchInput}
              onChange={(e) => setLedgerSearchInput(e.target.value)}
              className="t1dm-import-search-input"
            />
            {ledgerSearchInput && (
              <button
                type="button"
                onClick={() => {
                  setLedgerSearchInput('')
                  setLedgerSearch('')
                  setCurrentPage(1)
                }}
                className="t1dm-import-search-clear"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Registry Database Table (FoxPro columns: no, id, pid, ptname, regdate, type, maininscl, hospmain) */}
        <div className="t1dm-import-table-wrap">
          <table className="t1dm-import-table">
            <thead>
              <tr>
                <th style={{ width: 52 }} className="col-center">ลำดับ</th>
                <th style={{ minWidth: 92 }}>
                  <button
                    type="button"
                    onClick={() => handleSortChange('id')}
                    className="t1dm-import-th-btn"
                  >
                    <span>ID (RUN)</span>
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th style={{ minWidth: 136 }}>
                  <button
                    type="button"
                    onClick={() => handleSortChange('pid')}
                    className="t1dm-import-th-btn"
                  >
                    <span>เลขบัตรประชาชน (PID)</span>
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th style={{ minWidth: 88 }}>HN (HOSxP)</th>
                <th style={{ minWidth: 180 }}>
                  <button
                    type="button"
                    onClick={() => handleSortChange('ptname')}
                    className="t1dm-import-th-btn"
                  >
                    <span>ชื่อ-นามสกุล (PTNAME)</span>
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th style={{ width: 112 }} className="col-center">
                  <button
                    type="button"
                    onClick={() => handleSortChange('regdate')}
                    className="t1dm-import-th-btn col-center"
                  >
                    <span>วันที่ลงทะเบียน</span>
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th style={{ width: 92 }} className="col-center">
                  <button
                    type="button"
                    onClick={() => handleSortChange('type')}
                    className="t1dm-import-th-btn col-center"
                  >
                    <span>ชนิด (TYPE)</span>
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th style={{ width: 88 }} className="col-center">สิทธิ</th>
                <th style={{ minWidth: 210 }}>
                  <button
                    type="button"
                    onClick={() => handleSortChange('hospmain')}
                    className="t1dm-import-th-btn"
                  >
                    <span>หน่วยบริการ (HOSPMAIN)</span>
                    <ArrowUpDown size={12} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {registryItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="t1dm-import-empty-cell">
                    {isRefreshingStats
                      ? 'กำลังโหลดข้อมูลทะเบียน...'
                      : 'ไม่พบรายการในทะเบียน T1DM/GDM/PDM ตามเงื่อนไขที่เลือก'}
                  </td>
                </tr>
              ) : (
                registryItems.map((item) => (
                  <tr key={item.id} className={item.isOtherHosp ? 'is-other-hosp' : ''}>
                    <td className="col-center t1dm-import-mono">{item.no}</td>
                    <td className="t1dm-import-mono" style={{ fontWeight: 500 }}>
                      {item.id}
                    </td>
                    <td className="t1dm-import-mono">{item.pid}</td>
                    <td className="t1dm-import-mono">
                      {item.hn ? (
                        <span className="t1dm-hn-matched">{item.hn}</span>
                      ) : (
                        <span className="t1dm-text-muted">—</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.ptname}</td>
                    <td className="col-center t1dm-import-mono">
                      {item.regdate ? formatThaiDate(item.regdate) : '—'}
                    </td>
                    <td className="col-center">
                      <span
                        className={`t1dm-tag ${
                          item.type?.toUpperCase().includes('T1DM')
                            ? 't1dm'
                            : item.type?.toUpperCase().includes('GDM')
                            ? 'gdm'
                            : item.type?.toUpperCase().includes('PDM')
                            ? 'pdm'
                            : 'neutral'
                        }`}
                      >
                        {item.type || '—'}
                      </span>
                    </td>
                    <td className="col-center">{item.maininscl || '—'}</td>
                    <td>
                      <span className={item.isOtherHosp ? 't1dm-hosp-other' : ''}>
                        {item.hospmain}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bounded Pagination Footer (50 rows per page) */}
        <div className="t1dm-import-pagination">
          <div className="t1dm-import-pagination-info">
            แสดง{' '}
            <strong className="t1dm-import-mono">
              {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            ถึง{' '}
            <strong className="t1dm-import-mono">
              {Math.min(currentPage * pageSize, totalCount)}
            </strong>{' '}
            จากทั้งหมด <strong className="t1dm-import-mono">{totalCount.toLocaleString('th-TH')}</strong> รายการ
          </div>

          <div className="t1dm-import-pagination-controls">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isRefreshingStats}
              className="t1dm-import-btn secondary sm"
            >
              <ChevronLeft size={14} />
              <span>ก่อนหน้า</span>
            </button>
            <span className="t1dm-import-page-indicator t1dm-import-mono">
              หน้า {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isRefreshingStats}
              className="t1dm-import-btn secondary sm"
            >
              <span>ถัดไป</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ── 6. Manage Imported Files Modal (History & Deletion) ── */}
      {/* ======================================================== */}
      {isFilesModalOpen && (
        <div className="t1dm-modal-overlay" onClick={() => setIsFilesModalOpen(false)}>
          <div
            className="t1dm-modal-window"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="t1dm-modal-header">
              <h3 className="t1dm-modal-title">
                รายการไฟล์ที่นำเข้าในระบบ ({importedFiles.length} ไฟล์)
              </h3>
              <button
                type="button"
                onClick={() => setIsFilesModalOpen(false)}
                className="t1dm-modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="t1dm-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {importedFiles.length === 0 ? (
                <div className="t1dm-import-empty-cell">ยังไม่มีประวัติการนำเข้าไฟล์ในระบบ</div>
              ) : (
                <div className="t1dm-modal-file-list">
                  {importedFiles.map((file) => (
                    <div key={file.fileName} className="t1dm-modal-file-row">
                      <div>
                        <div className="t1dm-modal-file-name">{file.fileName}</div>
                        <div className="t1dm-modal-file-meta">
                          จำนวน {file.rowCount.toLocaleString('th-TH')} รายการ
                          {file.otherHospCount > 0 && (
                            <span className="t1dm-import-meta-err">
                              {' '}
                              (ต่าง รพ. {file.otherHospCount})
                            </span>
                          )}
                          {file.minRegDate && (
                            <span>
                              {' '}
                              • {formatThaiDate(file.minRegDate)} ถึง {formatThaiDate(file.maxRegDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {canImport && (
                        <button
                          type="button"
                          className="t1dm-import-btn danger sm"
                          onClick={() => {
                            setIsFilesModalOpen(false)
                            setFileToDelete(file.fileName)
                          }}
                          title={`ลบข้อมูลจากไฟล์ ${file.fileName}`}
                        >
                          <Trash2 size={13} />
                          <span>ลบ</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="t1dm-modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {canManage && summary.totalRegistered > 0 && (
                  <button
                    type="button"
                    className="t1dm-import-btn danger sm"
                    onClick={() => {
                      setIsFilesModalOpen(false)
                      setIsDeleteAllModalOpen(true)
                    }}
                  >
                    <Trash2 size={13} />
                    <span>ล้างทะเบียนทั้งหมด (CalDelete)</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="t1dm-import-btn secondary sm"
                onClick={() => setIsFilesModalOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── 7. Delete Other Hospitals Confirmation Modal ── */}
      {/* ======================================================== */}
      {isDeleteOtherHospModalOpen && (
        <div
          className="t1dm-modal-overlay"
          onClick={() => !isDeleting && setIsDeleteOtherHospModalOpen(false)}
        >
          <div
            className="t1dm-modal-window"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="t1dm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#b91c1c' }} />
                <h3 className="t1dm-modal-title">ยืนยันการลบรายการต่าง รพ.?</h3>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setIsDeleteOtherHospModalOpen(false)}
                className="t1dm-modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="t1dm-modal-body">
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
                คำสั่งนี้เทียบเท่ากับคำสั่งใน FoxPro เดิม:
                <code className="t1dm-modal-code">
                  delete from rcmdb.t1dm where hospmain &lt;&gt; &apos;{myHospCode}&apos;
                </code>
              </p>
              <div className="t1dm-modal-warn-box">
                ระบบจะลบข้อมูลผู้ป่วยที่หน่วยบริการลงทะเบียนไม่ใช่ <strong>{myHospCode} (รพ.เถิน)</strong> จำนวน{' '}
                <strong>{summary.otherHospCount.toLocaleString('th-TH')} รายการ</strong> ออกจากฐานข้อมูลอย่างถาวร
              </div>
            </div>

            <div className="t1dm-modal-footer">
              <button
                type="button"
                className="t1dm-import-btn secondary sm"
                onClick={() => setIsDeleteOtherHospModalOpen(false)}
                disabled={isDeleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="t1dm-import-btn danger sm"
                onClick={handleDeleteOtherHospitals}
                disabled={isDeleting}
              >
                {isDeleting ? 'กำลังลบข้อมูล...' : 'ยืนยันลบรายการต่าง รพ.'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── 8. Delete File Name Confirmation Modal ── */}
      {/* ======================================================== */}
      {fileToDelete && (
        <div className="t1dm-modal-overlay" onClick={() => !isDeleting && setFileToDelete(null)}>
          <div
            className="t1dm-modal-window"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="t1dm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#b91c1c' }} />
                <h3 className="t1dm-modal-title">ยืนยันการลบข้อมูลตามไฟล์?</h3>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setFileToDelete(null)}
                className="t1dm-modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="t1dm-modal-body">
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
                ต้องการลบข้อมูลทั้งหมดที่นำเข้ามาจากไฟล์นี้หรือไม่?
                <br />
                <strong style={{ color: '#059669' }}>{fileToDelete}</strong>
              </p>
              <div className="t1dm-modal-warn-box">
                (เทียบเท่า FoxPro: <code>delete from rcmdb.t1dm where filename = ?_file</code>)
              </div>
            </div>

            <div className="t1dm-modal-footer">
              <button
                type="button"
                className="t1dm-import-btn secondary sm"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="t1dm-import-btn danger sm"
                onClick={() => handleDeleteByFileName(fileToDelete)}
                disabled={isDeleting}
              >
                {isDeleting ? 'กำลังลบข้อมูล...' : 'ยืนยันการลบไฟล์นี้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── 9. Delete All Registries Confirmation Modal ── */}
      {/* ======================================================== */}
      {isDeleteAllModalOpen && (
        <div
          className="t1dm-modal-overlay"
          onClick={() => !isDeleting && setIsDeleteAllModalOpen(false)}
        >
          <div
            className="t1dm-modal-window"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="t1dm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#b91c1c' }} />
                <h3 className="t1dm-modal-title">ยืนยันการล้างข้อมูลทะเบียนทั้งหมด?</h3>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setIsDeleteAllModalOpen(false)}
                className="t1dm-modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="t1dm-modal-body">
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
                คำสั่งนี้เทียบเท่ากับ <code>CalDelete</code> ใน FoxPro:
                <code className="t1dm-modal-code">delete from rcmdb.t1dm</code>
              </p>
              <div className="t1dm-modal-warn-box">
                ข้อมูลในทะเบียนทั้งหมดจำนวน{' '}
                <strong>{summary.totalRegistered.toLocaleString('th-TH')} รายการ</strong> จะถูกลบออกจากฐานข้อมูล
              </div>
            </div>

            <div className="t1dm-modal-footer">
              <button
                type="button"
                className="t1dm-import-btn secondary sm"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="t1dm-import-btn danger sm"
                onClick={handleDeleteAllRegistries}
                disabled={isDeleting}
              >
                {isDeleting ? 'กำลังล้างข้อมูล...' : 'ยืนยันล้างทะเบียนทั้งหมด'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
