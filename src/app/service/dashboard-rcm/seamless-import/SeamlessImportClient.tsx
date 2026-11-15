'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Receipt,
  Layers,
  RefreshCw,
  Search,
  Zap,
  Info,
  X,
  ShieldCheck,
  ChevronRight,
  Copy,
  Check,
  Trash2,
  Plus,
  AlertTriangle,
  FolderOpen,
  Download,
  Building2,
  CalendarCheck2,
  BookOpen,
  StopCircle,
  Settings2,
} from 'lucide-react'
import {
  SeamlessDatabaseStats,
  SeamlessParseResult,
  SeamlessDuplicateMode,
  ParsedSeamlessRow,
  SeamlessDenyCode,
  SeamlessParseError,
  SeamlessLedgerResult,
  SeamlessImportedFileDetail,
  SeamlessHospFilter,
  SeamlessPayStatusFilter,
  SeamlessLedgerSortField,
  SeamlessFundBreakdownItem,
  SEAMLESS_FUND_MAP,
  isSeamlessFileName,
} from '@/lib/clinical/rcmSeamlessImportService'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import { formatThaiDate } from '@/lib/formatters'
import SeamlessLedgerSection from './components/SeamlessLedgerSection'
import {
  ImportedFilesModal,
  DeleteConfirmModal,
  SyncPaymentModal,
} from './components/SeamlessManagementModals'
import './seamless-import.css'

interface SeamlessImportClientProps {
  initialStats: SeamlessDatabaseStats | null
  initialLedger?: SeamlessLedgerResult | null
  initialImportedFiles?: SeamlessImportedFileDetail[]
  initialDenyCodes?: SeamlessDenyCode[]
  initialError: string | null
  userRole?: string
  username?: string
  canImport?: boolean
  canManage?: boolean
}

export interface QueuedFile {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'processing' | 'success' | 'error'
  result?: SeamlessParseResult
  errorMessage?: string
}

interface ErrorModalState {
  isOpen: boolean
  title: string
  message: string
  fileName?: string
  details?: string
}

interface ActionBannerState {
  type: 'success' | 'error'
  message: string
}

type TabType = 'individual' | 'summary' | 'denyCodes' | 'errors'

export default function SeamlessImportClient({
  initialStats,
  initialLedger = null,
  initialImportedFiles = [],
  initialDenyCodes,
  initialError,
  userRole = 'member',
  username = '',
  canImport = true,
  canManage = false,
}: SeamlessImportClientProps) {
  const effectiveCanManage = canManage || userRole === 'admin'
  // Database stats state
  const [stats, setStats] = useState<SeamlessDatabaseStats | null>(initialStats)
  const [isRefreshingStats, setIsRefreshingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(initialError)

  // Live Database Ledger Explorer & Deny Codes state
  const [ledger, setLedger] = useState<SeamlessLedgerResult | null>(initialLedger)
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState('')
  const [hospFilter, setHospFilter] = useState<SeamlessHospFilter>('ALL')
  const [payStatus, setPayStatus] = useState<SeamlessPayStatusFilter>('ALL')
  const [fundFilter, setFundFilter] = useState('ALL')
  const [fileNameFilter, setFileNameFilter] = useState('')
  const [sortBy, setSortBy] = useState<SeamlessLedgerSortField>('admDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [ledgerPage, setLedgerPage] = useState(1)
  const [isExportingLedger, setIsExportingLedger] = useState(false)

  const [denyCodes, setDenyCodes] = useState<SeamlessDenyCode[]>(initialDenyCodes ?? [])
  const [isLoadingDenyCodes, setIsLoadingDenyCodes] = useState(false)
  const [denySearch, setDenySearch] = useState('')
  const [debouncedDenySearch, setDebouncedDenySearch] = useState('')

  // FoxPro Management state
  const [importedFiles, setImportedFiles] = useState<SeamlessImportedFileDetail[]>(initialImportedFiles)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false)
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<'other_hospitals' | 'all' | null>(null)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [isManagingDb, setIsManagingDb] = useState(false)
  const [actionBanner, setActionBanner] = useState<ActionBannerState | null>(null)

  // Multi-File upload queue
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isDryRun, setIsDryRun] = useState(false)
  const [autoEnrichHosp, setAutoEnrichHosp] = useState(true)
  const [updatePayment, setUpdatePayment] = useState(true)
  const [filterMyHospOnly, setFilterMyHospOnly] = useState(true)
  const [duplicateMode, setDuplicateMode] = useState<SeamlessDuplicateMode>('update')

  // Batch execution & Progress state
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressStage, setProgressStage] = useState<string>('')
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  // Selected file view tab ('all' or file.id)
  const [selectedFileTabId, setSelectedFileTabId] = useState<string>('all')

  // Prominent Error Modal state
  const [errorModal, setErrorModal] = useState<ErrorModalState | null>(null)
  const [copiedError, setCopiedError] = useState(false)

  // Tab & Table Search state
  const [activeTab, setActiveTab] = useState<TabType>('individual')
  const [tableSearch, setTableSearch] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const batchCancelledRef = useRef(false)
  const statsAbortRef = useRef<AbortController | null>(null)
  const ledgerAbortRef = useRef<AbortController | null>(null)
  const denyAbortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)
  const isFirstLedgerMount = useRef(true)
  const isFirstDenyMount = useRef(true)

  const importedFileNameSet = useMemo(() => {
    const set = new Set<string>()
    importedFiles.forEach((f) => set.add(f.fileName.toLowerCase()))
    stats?.recentFiles?.forEach((f) => set.add(f.fileName.toLowerCase()))
    return set
  }, [importedFiles, stats])

  // Debounce ledger & deny searches
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLedgerSearch(ledgerSearch)
      setLedgerPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [ledgerSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDenySearch(denySearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [denySearch])

  // Refresh DB stats from server
  const fetchStats = useCallback(async (forceRefresh = false) => {
    statsAbortRef.current?.abort()
    const controller = new AbortController()
    statsAbortRef.current = controller
    setIsRefreshingStats(true)
    try {
      const qs = forceRefresh ? '?refresh=true' : ''
      const res = await fetch(`/api/service/dashboard-rcm/seamless-import${qs}`, {
        signal: controller.signal,
      })
      const json = await res.json()
      if (json.success && json.data) {
        setStats(json.data)
        setStatsError(null)
      } else {
        setStatsError(json.error || 'ไม่สามารถโหลดข้อมูลสถิติได้')
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setStatsError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsRefreshingStats(false)
    }
  }, [])

  const fetchLedger = useCallback(
    async (forceRefresh = false) => {
      ledgerAbortRef.current?.abort()
      const controller = new AbortController()
      ledgerAbortRef.current = controller
      setIsLoadingLedger(true)
      try {
        const params = new URLSearchParams({
          view: 'ledger',
          page: String(ledgerPage),
          pageSize: '50',
          hospFilter,
          payStatus,
          fundFilter,
          sortBy,
          sortOrder,
        })
        if (debouncedLedgerSearch.trim()) params.set('search', debouncedLedgerSearch.trim())
        if (fileNameFilter.trim()) params.set('fileName', fileNameFilter.trim())
        if (forceRefresh) params.set('refresh', 'true')

        const res = await fetch(`/api/service/dashboard-rcm/seamless-import?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        if (json.success && json.data) {
          setLedger(json.data)
          setLedgerError(null)
        } else {
          setLedgerError(json.error || 'ไม่สามารถโหลดตารางข้อมูล Seamless ได้')
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setLedgerError('เกิดข้อผิดพลาดในการโหลดข้อมูลตาราง Seamless')
      } finally {
        setIsLoadingLedger(false)
      }
    },
    [
      ledgerPage,
      hospFilter,
      payStatus,
      fundFilter,
      sortBy,
      sortOrder,
      debouncedLedgerSearch,
      fileNameFilter,
    ]
  )

  const fetchImportedFiles = useCallback(async (forceRefresh = false) => {
    setIsLoadingFiles(true)
    try {
      const qs = forceRefresh ? 'view=files&refresh=true' : 'view=files'
      const res = await fetch(`/api/service/dashboard-rcm/seamless-import?${qs}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setImportedFiles(json.data)
      }
    } catch {
      // ignore transient modal refresh error
    } finally {
      setIsLoadingFiles(false)
    }
  }, [])

  const fetchDenyCodes = useCallback(async () => {
    denyAbortRef.current?.abort()
    const controller = new AbortController()
    denyAbortRef.current = controller
    setIsLoadingDenyCodes(true)
    try {
      const params = new URLSearchParams({ view: 'deny_codes' })
      if (debouncedDenySearch.trim()) params.set('search', debouncedDenySearch.trim())
      const res = await fetch(`/api/service/dashboard-rcm/seamless-import?${params.toString()}`, {
        signal: controller.signal,
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setDenyCodes(json.data)
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
    } finally {
      setIsLoadingDenyCodes(false)
    }
  }, [debouncedDenySearch])

  const refreshAllDatabaseViews = useCallback(
    async (forceRefresh = true) => {
      await Promise.all([
        fetchStats(forceRefresh),
        fetchLedger(forceRefresh),
        fetchImportedFiles(forceRefresh),
        fetchDenyCodes(),
      ])
    },
    [fetchStats, fetchLedger, fetchImportedFiles, fetchDenyCodes]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialStats) return
    }
    fetchStats()
  }, [fetchStats, initialStats])

  useEffect(() => {
    if (isFirstLedgerMount.current) {
      isFirstLedgerMount.current = false
      if (
        initialLedger &&
        ledgerPage === 1 &&
        !debouncedLedgerSearch &&
        hospFilter === 'ALL' &&
        payStatus === 'ALL' &&
        fundFilter === 'ALL' &&
        !fileNameFilter &&
        sortBy === 'admDate' &&
        sortOrder === 'desc'
      ) {
        return
      }
    }
    fetchLedger()
  }, [
    fetchLedger,
    initialLedger,
    ledgerPage,
    debouncedLedgerSearch,
    hospFilter,
    payStatus,
    fundFilter,
    fileNameFilter,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    if (isFirstDenyMount.current) {
      isFirstDenyMount.current = false
      if (initialDenyCodes !== undefined && !debouncedDenySearch) return
    }
    fetchDenyCodes()
  }, [fetchDenyCodes, initialDenyCodes, debouncedDenySearch])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      statsAbortRef.current?.abort()
      ledgerAbortRef.current?.abort()
      denyAbortRef.current?.abort()
    }
  }, [])

  // Drag & drop handlers for multiple files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const addFilesToQueue = (filesList: FileList | File[]) => {
    const validFiles: QueuedFile[] = []
    const invalidNames: string[] = []

    Array.from(filesList).forEach((file) => {
      if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        // Prevent duplicate file entries
        const exists = fileQueue.some(
          (item) => item.name === file.name && item.size === file.size
        )
        if (!exists) {
          validFiles.push({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            name: file.name,
            size: file.size,
            status: 'pending',
          })
        }
      } else {
        invalidNames.push(file.name)
      }
    })

    if (invalidNames.length > 0) {
      setErrorModal({
        isOpen: true,
        title: 'พบไฟล์ที่ไม่ใช่รูปแบบ Excel (.xlsx, .csv)',
        message: `ระบบรองรับไฟล์ .xlsx และ .csv (หรือ .xls ที่แปลงแล้ว) ไฟล์ต่อไปนี้ไม่ได้รับการเพิ่มลงคิว:\n${invalidNames.join(
          ', '
        )}`,
        details:
          'โปรดตรวจสอบว่าไฟล์รายงานที่ดาวน์โหลดจาก e-Claim หรือ สปสช. เป็นนามสกุล .xlsx หรือ .csv ก่อนนำเข้า',
      })
    }

    if (validFiles.length > 0) {
      setFileQueue((prev) => [...prev, ...validFiles])
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
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveFile = (id: string) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id))
    if (selectedFileTabId === id) {
      setSelectedFileTabId('all')
    }
  }

  const handleClearAllFiles = () => {
    setFileQueue([])
    setSelectedFileTabId('all')
    setProgressPercent(0)
    setProgressStage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Copy error message to clipboard
  const handleCopyError = () => {
    if (!errorModal) return
    const textToCopy = `ข้อผิดพลาด: ${errorModal.title}\nไฟล์: ${errorModal.fileName || 'ไม่ระบุ'}\nรายละเอียด: ${errorModal.message}\n${errorModal.details || ''}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedError(true)
      setTimeout(() => setCopiedError(false), 2000)
    })
  }

  const handleCancelBatch = () => {
    batchCancelledRef.current = true
    abortRef.current?.abort()
    setIsProcessingBatch(false)
    setProgressStage('ยกเลิกการประมวลผลคิวแล้ว')
  }

  // Export all filtered ledger records to Excel
  const handleExportAllLedger = async () => {
    setIsExportingLedger(true)
    try {
      const params = new URLSearchParams({
        view: 'ledger',
        exportAll: 'true',
        hospFilter,
        payStatus,
        fundFilter,
        sortBy,
        sortOrder,
      })
      if (debouncedLedgerSearch.trim()) params.set('search', debouncedLedgerSearch.trim())
      if (fileNameFilter.trim()) params.set('fileName', fileNameFilter.trim())

      const res = await fetch(`/api/service/dashboard-rcm/seamless-import?${params.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'ไม่สามารถส่งออกข้อมูล Seamless ได้')
      }
      const rows = (json.data as SeamlessLedgerResult).items || []
      await exportRcmExcel({
        filename: `Seamless_Database_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Seamless',
        title: `ทะเบียนข้อมูล Seamless ในฐานข้อมูล (${rows.length.toLocaleString('th-TH')} รายการ)`,
        headers: [
          'TransID',
          'Rep',
          'กองทุน',
          'HN',
          'VN',
          'AN',
          'CID 13 หลัก',
          'ชื่อ-สกุล',
          'วันที่รับบริการ',
          'HCode',
          'สิทธิ',
          'เรียกเก็บ (฿)',
          'ชดเชย (฿)',
          'ไม่ชดเชย (฿)',
          'PayNo',
          'วันที่โอน',
          'CodeAccount',
          'YYMM',
          'YearBudget',
          'ชื่อไฟล์',
        ],
        rows: rows.map((r) => [
          r.id,
          r.rep,
          r.fund,
          r.hn || '',
          r.vn || '',
          r.an || '',
          r.pid || '',
          r.ptname || '',
          formatThaiDate(r.admDate),
          r.hcode || '',
          r.mainInscl || '',
          r.collected || 0,
          r.compensated || 0,
          r.noCompensated || 0,
          r.payNo || '',
          formatThaiDate(r.payDate),
          r.codeAccount || '',
          r.yymm || '',
          r.yearBudget || '',
          r.fileName || '',
        ]),
      })
    } catch (err: unknown) {
      setActionBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออก Excel',
      })
    } finally {
      setIsExportingLedger(false)
    }
  }

  // FoxPro Management handlers
  const handleDeleteRequest = async (payload: {
    mode: 'by_file' | 'by_files' | 'other_hospitals' | 'all'
    fileName?: string
    fileNames?: string[]
  }) => {
    setIsManagingDb(true)
    setActionBanner(null)
    try {
      const res = await fetch('/api/service/dashboard-rcm/seamless-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.error || `ไม่สามารถลบข้อมูลได้ (${res.status})`
        throw new Error(msg)
      }
      const deletedCount = Number(json.data?.deletedCount || 0)
      setActionBanner({
        type: 'success',
        message: `ลบข้อมูล Seamless สำเร็จ ${deletedCount.toLocaleString('th-TH')} รายการ`,
      })
      if (payload.mode === 'by_file' && payload.fileName === fileNameFilter) {
        setFileNameFilter('')
      }
      setDeleteConfirmMode(null)
      await refreshAllDatabaseViews(true)
    } catch (err: unknown) {
      setActionBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูล',
      })
    } finally {
      setIsManagingDb(false)
    }
  }

  const handleSyncPayment = async (force: boolean) => {
    setIsManagingDb(true)
    setActionBanner(null)
    try {
      const res = await fetch('/api/service/dashboard-rcm/seamless-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_payment', force }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.error || `ซิงค์วันที่โอนไม่สำเร็จ (${res.status})`
        throw new Error(msg)
      }
      const updated = Number(json.data?.updatedPaymentCount || 0)
      const backfilled = Number(json.data?.backfilledDateCount || 0)
      setActionBanner({
        type: 'success',
        message: `ซิงค์วันที่โอนเงินจาก nhso_budget สำเร็จ: อัปเดตวันโอน ${updated.toLocaleString(
          'th-TH'
        )} แถว • คำนวณ YYMM/ปีงบประมาณ ${backfilled.toLocaleString('th-TH')} แถว`,
      })
      setIsSyncModalOpen(false)
      await refreshAllDatabaseViews(true)
    } catch (err: unknown) {
      setActionBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการซิงค์วันที่โอนเงิน',
      })
    } finally {
      setIsManagingDb(false)
    }
  }

  // Batch process all pending files
  const handleProcessBatch = async () => {
    if (!canImport || fileQueue.length === 0 || isProcessingBatch) return

    batchCancelledRef.current = false
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsProcessingBatch(true)
    setProgressPercent(0)

    const pendingFiles = fileQueue.filter(
      (f) => f.status === 'pending' || f.status === 'error'
    )
    if (pendingFiles.length === 0) {
      // Re-run all if none are pending
      pendingFiles.push(...fileQueue)
    }

    const totalBatchCount = pendingFiles.length
    const failedItems: Array<{ fileName: string; message: string; details: string }> = []

    for (let i = 0; i < totalBatchCount; i++) {
      if (batchCancelledRef.current || controller.signal.aborted) {
        break
      }
      const currentItem = pendingFiles[i]
      setCurrentFileIndex(i + 1)

      // Calculate overall progress base
      const fileProgressBase = (i / totalBatchCount) * 100
      const fileProgressChunk = 100 / totalBatchCount

      // Update status to processing
      setFileQueue((prev) =>
        prev.map((item) =>
          item.id === currentItem.id ? { ...item, status: 'processing', errorMessage: undefined } : item
        )
      )

      setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.15))
      setProgressStage(`[${i + 1}/${totalBatchCount}] กำลังอ่านชีท Excel: ${currentItem.name}`)
      setActiveStageIndex(1)

      try {
        const formData = new FormData()
        formData.append('file', currentItem.file)
        formData.append('dryRun', String(isDryRun))
        formData.append('autoEnrichHosp', String(autoEnrichHosp))
        formData.append('updatePayment', String(updatePayment))
        formData.append('filterMyHospOnly', String(filterMyHospOnly))
        formData.append('duplicateMode', duplicateMode)

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.4))
        setProgressStage(`[${i + 1}/${totalBatchCount}] ตรวจสอบคอลัมน์ & แมปโครงสร้าง 30 กองทุน...`)
        setActiveStageIndex(2)

        const res = await fetch('/api/service/dashboard-rcm/seamless-import', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.75))
        setProgressStage(
          isDryRun
            ? `[${i + 1}/${totalBatchCount}] เชื่อมโยง HOSxP ค้นหา HN/VN แบบ Batch...`
            : `[${i + 1}/${totalBatchCount}] จับคู่ HOSxP และบันทึกลง rcmdb.seamless...`
        )
        setActiveStageIndex(3)

        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || `เซิร์ฟเวอร์ตอบกลับรหัส ${res.status}`)
        }

        // Successfully parsed
        setFileQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? { ...item, status: 'success', result: json.data }
              : item
          )
        )

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk))
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return

        const errorMsg =
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์หรือไม่สามารถอ่านโครงสร้างไฟล์ได้'

        // Mark item as error
        setFileQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? { ...item, status: 'error', errorMessage: errorMsg }
              : item
          )
        )

        const contextualDetails = errorMsg.includes('.xls')
          ? 'แนะนำ: ไฟล์รูปแบบ Excel 97-2003 (.xls) / HTML ไม่สามารถอ่านได้โดยตรง กรุณาเปิดด้วย Excel แล้วเลือก Save As เป็น .xlsx หรือ .csv'
          : /command denied|access denied|API Gateway|เชื่อมต่อ|Timeout|นานเกินกำหนด/i.test(errorMsg)
          ? 'แนะนำ: เกิดปัญหาการเชื่อมต่อหรือ Timeout ฝั่ง API Gateway (ไม่ได้เกิดจากโครงสร้างไฟล์) — ไฟล์ที่ล้มเหลวยังไม่ถูกบันทึกครบถ้วน สามารถกดปุ่มนำเข้าอีกครั้งเพื่อลองใหม่เฉพาะไฟล์ที่ค้างได้ทันที'
          : 'แนะนำ: ตรวจสอบว่าไฟล์มีชีท INDIVIDUAL หรือส่วนหัว "REP แบบ INDIVIDUAL" และคอลัมน์ Trans ID / PID ครบถ้วน'

        failedItems.push({
          fileName: currentItem.name,
          message: errorMsg,
          details: contextualDetails,
        })
      }
    }

    if (batchCancelledRef.current) {
      setIsProcessingBatch(false)
      return
    }

    setProgressPercent(100)
    setProgressStage(
      failedItems.length > 0
        ? `ประมวลผลเสร็จสิ้น: สำเร็จ ${totalBatchCount - failedItems.length}/${totalBatchCount} ไฟล์ (ล้มเหลว ${failedItems.length} ไฟล์)`
        : `ประมวลผลเสร็จสมบูรณ์ทั้งสิ้น ${totalBatchCount} ไฟล์`
    )
    setActiveStageIndex(4)
    setIsProcessingBatch(false)

    // Trigger Error Modal listing ALL failed files if any error occurred
    if (failedItems.length === 1) {
      const only = failedItems[0]
      setErrorModal({
        isOpen: true,
        title: 'เกิดข้อผิดพลาดในการนำเข้าไฟล์',
        fileName: only.fileName,
        message: only.message,
        details: only.details,
      })
    } else if (failedItems.length > 1) {
      const failedSummaryList = failedItems
        .map((item, idx) => `${idx + 1}. ${item.fileName} — ${item.message}`)
        .join('\n')
      setErrorModal({
        isOpen: true,
        title: `พบข้อผิดพลาดในการนำเข้า ${failedItems.length} ไฟล์ (จากทั้งหมด ${totalBatchCount} ไฟล์)`,
        fileName: failedItems.map((item) => item.fileName).join(', '),
        message: `ไฟล์ที่ล้มเหลวทั้ง ${failedItems.length} ไฟล์ยังไม่ได้บันทึกลงฐานข้อมูลครบถ้วน กดปุ่มนำเข้าอีกครั้งเพื่อลองใหม่เฉพาะไฟล์ที่ค้างได้เลย`,
        details: `${failedSummaryList}\n\n${failedItems[failedItems.length - 1].details}`,
      })
    }

    // Refresh database stats & ledger if any file was processed not in dry-run
    if (!isDryRun) {
      refreshAllDatabaseViews(true)
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

  // Combined metrics
  const combinedMetrics = useMemo(() => {
    let totalRows = 0
    let validRows = 0
    let errorRows = 0
    let totalCompensation = 0
    let matchedHn = 0
    let matchedVn = 0
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let skippedOtherHospCount = 0
    let existingInDbCount = 0
    let newInDbCount = 0
    let hasLiveSaved = false

    const targetList = activeResultFile?.result
      ? [activeResultFile]
      : successfulFiles

    targetList.forEach((item) => {
      if (item.result) {
        totalRows += item.result.totalRows
        validRows += item.result.validRows
        errorRows += item.result.errorRows
        insertedCount += item.result.insertedCount || 0
        updatedCount += item.result.updatedCount || 0
        skippedCount += item.result.skippedCount || 0
        skippedOtherHospCount += item.result.skippedOtherHospCount || 0
        existingInDbCount += item.result.existingInDbCount || 0
        newInDbCount += item.result.newInDbCount || 0
        if (!item.result.isDryRun) {
          hasLiveSaved = true
        }
        if (item.result.summary) {
          totalCompensation += item.result.summary.totalCompensation || 0
          matchedHn += item.result.summary.matchedPatientsHOSxP || 0
          matchedVn += item.result.summary.matchedVnsHOSxP || 0
        } else if (item.result.previewRows) {
          item.result.previewRows.forEach((r) => {
            totalCompensation += r.compensated || 0
            if (r.hn) matchedHn++
            if (r.vn) matchedVn++
          })
        }
      }
    })

    return {
      totalRows,
      validRows,
      errorRows,
      totalCompensation,
      matchedHn,
      matchedVn,
      insertedCount,
      updatedCount,
      skippedCount,
      skippedOtherHospCount,
      existingInDbCount,
      newInDbCount,
      hasLiveSaved,
      processedCount: targetList.length,
    }
  }, [successfulFiles, activeResultFile])

  // Combined Rows for tables
  const displayedPreviewRows = useMemo(() => {
    let rows: ParsedSeamlessRow[] = []
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
        r.rep.toLowerCase().includes(q) ||
        (r.pid && r.pid.includes(q)) ||
        (r.hn && r.hn.includes(q)) ||
        (r.vn && r.vn.includes(q)) ||
        (r.ptname && r.ptname.toLowerCase().includes(q)) ||
        (r.fund && r.fund.toLowerCase().includes(q))
    )
  }, [activeResultFile, successfulFiles, tableSearch])

  // Aggregated Fund Breakdown (accurate 4-char code + collected/compensated totals)
  const displayedFundBreakdown = useMemo(() => {
    const map = new Map<string, SeamlessFundBreakdownItem>()
    const sourceFiles = activeResultFile?.result ? [activeResultFile] : successfulFiles
    sourceFiles.forEach((f) => {
      ;(f.result?.fundBreakdown || []).forEach((item) => {
        const key = item.fundName
        const cur = map.get(key) || {
          fundCode: item.fundCode,
          fundName: item.fundName,
          count: 0,
          totalCollected: 0,
          totalCompensated: 0,
        }
        cur.count += item.count
        cur.totalCollected = Math.round((cur.totalCollected + item.totalCollected) * 100) / 100
        cur.totalCompensated = Math.round((cur.totalCompensated + item.totalCompensated) * 100) / 100
        map.set(key, cur)
      })
    })
    return Array.from(map.values())
  }, [activeResultFile, successfulFiles])

  // Aggregated Funds detected
  const displayedFunds = useMemo(() => {
    const map: Record<string, number> = {}
    if (activeResultFile?.result) {
      Object.entries(activeResultFile.result.fundsDetected || {}).forEach(([k, v]) => {
        map[k] = (map[k] || 0) + v
      })
    } else {
      successfulFiles.forEach((f) => {
        Object.entries(f.result?.fundsDetected || {}).forEach(([k, v]) => {
          map[k] = (map[k] || 0) + v
        })
      })
    }
    return Object.entries(map).map(([fundCode, count]) => ({
      fundCode,
      fundName: SEAMLESS_FUND_MAP[fundCode] || fundCode,
      count,
    }))
  }, [activeResultFile, successfulFiles])

  // Summary info
  const displayedSummaryInfo = useMemo(() => {
    if (activeResultFile?.result) {
      return activeResultFile.result.summaryInfo ? [activeResultFile.result.summaryInfo] : []
    }
    return successfulFiles
      .map((f) => f.result?.summaryInfo)
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
  }, [activeResultFile, successfulFiles])

  const displayedDenyCodes = useMemo(() => {
    let rows: SeamlessDenyCode[] = []
    if (activeResultFile?.result) {
      rows = activeResultFile.result.denyCodes || []
    } else {
      successfulFiles.forEach((f) => {
        if (f.result?.denyCodes) {
          rows.push(...f.result.denyCodes)
        }
      })
    }
    return rows
  }, [activeResultFile, successfulFiles])

  const displayedErrors = useMemo(() => {
    const list: Array<{ fileName: string; row: number; error: string }> = []
    if (activeResultFile?.result) {
      activeResultFile.result.errors.forEach((err) => {
        list.push({ fileName: activeResultFile.name, row: err.rowNumber, error: err.reason })
      })
    } else {
      successfulFiles.forEach((f) => {
        f.result?.errors.forEach((err) => {
          list.push({ fileName: f.name, row: err.rowNumber, error: err.reason })
        })
      })
      fileQueue
        .filter((f) => f.status === 'error' && f.errorMessage)
        .forEach((f) => {
          list.push({ fileName: f.name, row: 0, error: f.errorMessage || 'ข้อผิดพลาดในการอ่านไฟล์' })
        })
    }
    return list
  }, [activeResultFile, successfulFiles, fileQueue])

  // Fallback activeTab if the currently active tab has no data
  useEffect(() => {
    if (activeTab === 'denyCodes' && displayedDenyCodes.length === 0) {
      setActiveTab('individual')
    } else if (
      activeTab === 'summary' &&
      displayedFunds.length === 0 &&
      displayedSummaryInfo.length === 0
    ) {
      setActiveTab('individual')
    } else if (activeTab === 'errors' && displayedErrors.length === 0) {
      setActiveTab('individual')
    }
  }, [
    activeTab,
    displayedDenyCodes.length,
    displayedFunds.length,
    displayedSummaryInfo.length,
    displayedErrors.length,
  ])

  // Dynamic columns: only show columns that actually contain data in the imported file
  const dynamicColumns = useMemo(() => {
    const rows = displayedPreviewRows
    if (rows.length === 0) return []

    const cols: Array<{
      key: string
      header: string
      align?: 'left' | 'right' | 'center'
      width?: string
      render: (row: ParsedSeamlessRow, idx: number) => React.ReactNode
    }> = [
      {
        key: 'index',
        header: 'ลำดับ',
        width: '60px',
        align: 'center',
        render: (_row, idx) => (
          <span style={{ color: '#64748b', fontSize: '0.8125rem' }} className="tabular-nums">
            {idx + 1}
          </span>
        ),
      },
    ]

    if (rows.some((r) => r.id && r.id.trim() !== '')) {
      cols.push({
        key: 'id',
        header: 'Trans ID',
        align: 'center',
        render: (r) => (
          <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#475569' }}>
            {r.id}
          </span>
        ),
      })
    }

    if (rows.some((r) => r.rep && r.rep.trim() !== '')) {
      cols.push({
        key: 'rep',
        header: 'Rep',
        align: 'center',
        render: (r) => <span style={{ fontWeight: 600, color: '#334155' }}>{r.rep}</span>,
      })
    }

    if (rows.some((r) => r.fund && r.fund.trim() !== '' && r.fund !== 'ไม่ระบุกองทุน')) {
      cols.push({
        key: 'fund',
        header: 'กองทุน',
        align: 'center',
        render: (r) => <span className="seamless-fund-tag">{r.fund}</span>,
      })
    }

    if (rows.some((r) => r.pid && r.pid.trim() !== '')) {
      cols.push({
        key: 'pid',
        header: 'เลขบัตรประชาชน',
        align: 'center',
        render: (r) => (
          <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
            {r.pid}
          </span>
        ),
      })
    }

    if (rows.some((r) => r.hn && r.hn.trim() !== '')) {
      cols.push({
        key: 'hn',
        header: 'HN',
        align: 'center',
        render: (r) => (
          <span style={{ fontWeight: 600, color: '#047857' }}>
            {r.hn || '—'}
          </span>
        ),
      })
    }

    if (rows.some((r) => r.vn && r.vn.trim() !== '')) {
      cols.push({
        key: 'vn',
        header: 'VN',
        align: 'center',
        render: (r) => (
          <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>
            {r.vn || '—'}
          </span>
        ),
      })
    }

    if (rows.some((r) => r.ptname && r.ptname.trim() !== '')) {
      cols.push({
        key: 'ptname',
        header: 'ชื่อ-สกุล',
        align: 'center',
        render: (r) => <span>{r.ptname || '—'}</span>,
      })
    }

    if (rows.some((r) => r.admDate && r.admDate.trim() !== '')) {
      cols.push({
        key: 'admDate',
        header: 'วันที่บริการ',
        align: 'center',
        render: (r) => <span style={{ fontSize: '0.8125rem' }}>{r.admDate || '—'}</span>,
      })
    }

    if (rows.some((r) => r.sendDate && r.sendDate.trim() !== '')) {
      cols.push({
        key: 'sendDate',
        header: 'วันที่ส่ง',
        align: 'center',
        render: (r) => <span style={{ fontSize: '0.8125rem' }}>{r.sendDate || '—'}</span>,
      })
    }

    if (rows.some((r) => r.mainInscl && r.mainInscl.trim() !== '')) {
      cols.push({
        key: 'mainInscl',
        header: 'สิทธิการรักษา',
        align: 'center',
        render: (r) => <span>{r.mainInscl || '—'}</span>,
      })
    }

    if (rows.some((r) => r.type && r.type.trim() !== '')) {
      cols.push({
        key: 'type',
        header: 'ประเภทบริการ',
        align: 'center',
        render: (r) => <span>{r.type || '—'}</span>,
      })
    }

    if (rows.some((r) => r.serialNo && r.serialNo.trim() !== '')) {
      cols.push({
        key: 'serialNo',
        header: 'ครั้งที่',
        align: 'center',
        render: (r) => <span>{r.serialNo || '—'}</span>,
      })
    }

    if (rows.some((r) => (r.collected || 0) > 0)) {
      cols.push({
        key: 'collected',
        header: 'เรียกเก็บ',
        align: 'center',
        render: (r) => (
          <span className="tabular-nums" style={{ color: '#475569' }}>
            {r.collected ? r.collected.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
          </span>
        ),
      })
    }

    if (rows.some((r) => (r.compensated || 0) > 0)) {
      cols.push({
        key: 'compensated',
        header: 'ชดเชย',
        align: 'center',
        render: (r) => (
          <span style={{ fontWeight: 700, color: '#0f172a' }} className="tabular-nums">
            {r.compensated ? r.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
          </span>
        ),
      })
    }

    if (rows.some((r) => (r.noCompensated || 0) > 0)) {
      cols.push({
        key: 'noCompensated',
        header: 'ไม่ชดเชย',
        align: 'center',
        render: (r) => (
          <span style={{ color: '#dc2626', fontWeight: 600 }} className="tabular-nums">
            {r.noCompensated ? r.noCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
          </span>
        ),
      })
    }

    if (rows.some((r) => (r.equipName && r.equipName.trim() !== '') || (r.equipCode && r.equipCode.trim() !== ''))) {
      cols.push({
        key: 'equip',
        header: 'อุปกรณ์',
        align: 'center',
        render: (r) => <span>{r.equipName || r.equipCode || '—'}</span>,
      })
    }

    if (rows.some((r) => r.note && r.note.trim() !== '')) {
      cols.push({
        key: 'note',
        header: 'หมายเหตุ',
        align: 'center',
        render: (r) => (
          <span style={{ fontSize: '0.75rem', color: '#dc2626' }} title={r.note || ''}>
            {r.note || '—'}
          </span>
        ),
      })
    }

    if (rows.some((r) => Boolean(r.hn || r.vn))) {
      cols.push({
        key: 'hosMatch',
        header: 'สถานะ HOSxP',
        align: 'center',
        render: (r) => (
          r.hn ? (
            <span className="seamless-badge-match match">
              <CheckCircle2 size={12} />
              พบในระบบ
            </span>
          ) : (
            <span className="seamless-badge-match unmatch">
              ไม่พบ HN
            </span>
          )
        ),
      })
    }

    return cols
  }, [displayedPreviewRows])

  const handleExportExcel = useCallback(async () => {
    if (displayedPreviewRows.length === 0) return
    await exportRcmExcel({
      filename: `seamless_import_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Seamless Import',
      title: 'รายงานข้อมูลนำเข้า Seamless สปสช.',
      subtitle: `โรงพยาบาลเถิน • จำนวน ${displayedPreviewRows.length.toLocaleString('th-TH')} รายการ`,
      headers: [
        'ลำดับ',
        'Trans ID',
        'Rep',
        'กองทุน',
        'เลขบัตรประชาชน',
        'HN',
        'VN',
        'ชื่อ-สกุล',
        'วันที่บริการ',
        'วันที่ส่ง',
        'สิทธิการรักษา',
        'เรียกเก็บ',
        'ชดเชย',
        'ไม่ชดเชย',
      ],
      rows: displayedPreviewRows.map((r, idx) => [
        idx + 1,
        r.id || '',
        r.rep || '',
        r.fund || '',
        r.pid || '',
        r.hn || '',
        r.vn || '',
        r.ptname || '',
        r.admDate || '',
        r.sendDate || '',
        r.mainInscl || '',
        r.collected || 0,
        r.compensated || 0,
        r.noCompensated || 0,
      ]),
    })
  }, [displayedPreviewRows])

  return (
    <div className="seamless-import-container">
      {/* Header Section */}
      <div className="seamless-header">
        <div className="seamless-title-group">
          <div className="seamless-breadcrumb">
            <Link href="/service/dashboard-rcm">Dashboard RCM</Link>
            <span className="seamless-breadcrumb-sep">/</span>
            <span>นำเข้าข้อมูล</span>
            <span className="seamless-breadcrumb-sep">/</span>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>นำเข้าข้อมูล Seamless</span>
          </div>
          <h1 className="seamless-title">
            <Upload size={22} style={{ color: '#059669' }} />
            <span>ระบบนำเข้าข้อมูล Seamless</span>
          </h1>
          <p className="seamless-subtitle">
            แปลงและประมวลผลไฟล์ Excel กองทุน สปสช. Seamless รองรับการอัปโหลดพร้อมกันหลายไฟล์และตรวจสอบสิทธิ์อัตโนมัติ
          </p>
        </div>

        <div className="seamless-actions">
          <button
            type="button"
            onClick={() => refreshAllDatabaseViews(true)}
            disabled={isRefreshingStats || isLoadingLedger}
            className="seamless-btn secondary"
            title="รีเฟรชข้อมูลสถิติและตารางฐานข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshingStats ? 'seamless-spin' : ''} />
            <span>รีเฟรชทั้งหมด</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={displayedPreviewRows.length === 0}
            className="seamless-btn primary"
            title="ส่งออกรายการที่ประมวลผลในรอบนี้เป็นไฟล์ Excel"
          >
            <Download size={16} />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {statsError && (
        <div className="seamless-inline-alert error" role="alert">
          <AlertCircle size={16} />
          <span>{statsError}</span>
        </div>
      )}

      {actionBanner && (
        <div className={`seamless-feedback-banner ${actionBanner.type}`} role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {actionBanner.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{actionBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="seamless-icon-action-btn"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Database Overview Stats Cards */}
      <div className="seamless-stats-grid">
        <div className="seamless-stat-card">
          <div className="seamless-stat-icon-wrap emerald">
            <Database size={20} />
          </div>
          <div className="seamless-stat-info">
            <span className="seamless-stat-label">รายการชดเชยในฐานข้อมูล</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '100px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="seamless-stat-value tabular-nums">
                {(stats?.totalRows ?? 0).toLocaleString('th-TH')}
              </span>
            )}
            <span className="seamless-stat-sub">ตารางฐานข้อมูล Seamless</span>
          </div>
        </div>

        <div className="seamless-stat-card">
          <div className="seamless-stat-icon-wrap blue">
            <Receipt size={20} />
          </div>
          <div className="seamless-stat-info">
            <span className="seamless-stat-label">ยอดเงินชดเชยสะสมรวม</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '130px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="seamless-stat-value tabular-nums">
                ฿{(stats?.totalCompensated ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            )}
            <span className="seamless-stat-sub">ยอดชดเชยรวมทุกกองทุน</span>
          </div>
        </div>

        <div className="seamless-stat-card">
          <div className="seamless-stat-icon-wrap amber">
            <Layers size={20} />
          </div>
          <div className="seamless-stat-info">
            <span className="seamless-stat-label">จำนวนไฟล์ที่นำเข้าแล้ว</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '80px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="seamless-stat-value tabular-nums">
                {(stats?.totalFiles ?? 0).toLocaleString('th-TH')} ไฟล์
              </span>
            )}
            <span className="seamless-stat-sub">ไฟล์รายงานที่บันทึกสำเร็จ</span>
          </div>
        </div>

        <div className="seamless-stat-card">
          <div className="seamless-stat-icon-wrap purple">
            <FileSpreadsheet size={20} />
          </div>
          <div className="seamless-stat-info">
            <span className="seamless-stat-label">จำนวนเลขที่ Rep / หน่วยอื่น / รอวันโอน</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '80px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="seamless-stat-value tabular-nums">
                {(stats?.totalReps ?? 0).toLocaleString('th-TH')} Rep
              </span>
            )}
            <span className="seamless-stat-sub tabular-nums">
              ต่างหน่วย {(stats?.otherHospCount ?? 0).toLocaleString('th-TH')} • รอวันโอน{' '}
              {(stats?.missingPayDateCount ?? 0).toLocaleString('th-TH')} • Deny{' '}
              {(stats?.denyCodeCount ?? 0).toLocaleString('th-TH')}
            </span>
          </div>
        </div>
      </div>

      {/* FoxPro Management & Maintenance Bar */}
      <div className="seamless-management-bar">
        <div className="seamless-management-label">
          <Settings2 size={16} style={{ color: '#059669' }} />
          <span>คำสั่งจัดการฐานข้อมูล Seamless (FoxPro Parity)</span>
          {stats?.latestAdmDate && (
            <span className="seamless-mini-badge neutral">
              ข้อมูลล่าสุด: {formatThaiDate(stats.latestAdmDate)}
            </span>
          )}
        </div>
        <div className="seamless-management-actions">
          <button
            type="button"
            onClick={() => {
              fetchImportedFiles()
              setIsFilesModalOpen(true)
            }}
            className="seamless-btn secondary"
            title="ดูรายชื่อไฟล์ที่นำเข้าแล้วและลบรายไฟล์ / หลายไฟล์"
          >
            <FolderOpen size={15} />
            <span>จัดการไฟล์ ({(stats?.totalFiles ?? importedFiles.length).toLocaleString('th-TH')})</span>
          </button>

          {canImport && (
            <>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                disabled={isManagingDb}
                className="seamless-btn secondary"
                title="เทียบเท่า FoxPro AddPay: ดึงวันที่โอนจาก nhso_budget และเติม YYMM / YearBudget"
              >
                <CalendarCheck2 size={15} style={{ color: '#059669' }} />
                <span>ซิงค์วันที่โอน (nhso_budget)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteConfirmMode('other_hospitals')}
                disabled={isManagingDb || (stats?.otherHospCount ?? 0) === 0}
                className="seamless-btn warn-outline"
                title="เทียบเท่า FoxPro cmdDel.RightClick: ลบแถวที่ HCode <> 11152"
              >
                <Building2 size={15} />
                <span>ลบต่างหน่วย ({(stats?.otherHospCount ?? 0).toLocaleString('th-TH')})</span>
              </button>
            </>
          )}

          {effectiveCanManage && (
            <button
              type="button"
              onClick={() => setDeleteConfirmMode('all')}
              disabled={isManagingDb || (stats?.totalRows ?? 0) === 0}
              className="seamless-btn danger"
              title="เทียบเท่า FoxPro CalDelete: ล้างข้อมูลทั้งหมดในตาราง (เฉพาะผู้ดูแล)"
            >
              <Trash2 size={15} />
              <span>ล้างข้อมูลทั้งหมด</span>
            </button>
          )}
        </div>
      </div>

      {!canImport && (
        <div className="seamless-feedback-banner error" role="note">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} />
            <span>
              บัญชี <strong>{username || 'ผู้ใช้งาน'}</strong> มีสิทธิ์ดูข้อมูลเท่านั้น (<code>view_rcm_import</code>) สามารถค้นหาและส่งออกตารางฐานข้อมูลด้านล่างได้
            </span>
          </div>
        </div>
      )}

      {/* Main Upload & Multi-File Queue Card */}
      <div className="seamless-card">
        <div className="seamless-card-header">
          <h2 className="seamless-card-title">
            <FileSpreadsheet size={20} style={{ color: '#059669' }} />
            <span>เลือกไฟล์ Excel ข้อมูล Seamless</span>
          </h2>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            รองรับ .xlsx และ .csv ทั้งชีท INDIVIDUAL, SUMMARY และ DENY CODE (หากเป็น .xls กรุณา Save As เป็น .xlsx ก่อน)
          </span>
        </div>

        {/* Dropzone */}
        <div
          className={`seamless-dropzone ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="คลิกหรือลากไฟล์ Excel มาวางที่นี่เพื่ออัปโหลดหลายไฟล์พร้อมกัน"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          <div className="seamless-dropzone-icon">
            <Upload size={24} />
          </div>
          <div className="seamless-dropzone-text">
            <span className="seamless-dropzone-main">
              ลากไฟล์มาวางที่นี่ หรือ <span className="seamless-dropzone-highlight">คลิกเพื่อเลือกไฟล์</span>
            </span>
          </div>
        </div>

        {/* Files Queue List */}
        {fileQueue.length > 0 && (
          <div className="seamless-files-panel">
            <div className="seamless-batch-bar">
              <div className="seamless-batch-info">
                <FolderOpen size={18} style={{ color: '#059669' }} />
                <span>
                  เลือกทั้งหมด <strong>{fileQueue.length} ไฟล์</strong> •{' '}
                  {(
                    fileQueue.reduce((acc, f) => acc + f.size, 0) /
                    (1024 * 1024)
                  ).toFixed(2)}{' '}
                  MB
                </span>
                {successfulFiles.length > 0 && (
                  <span style={{ color: '#059669', marginLeft: '0.5rem', fontWeight: 600 }}>
                    • สำเร็จแล้ว {successfulFiles.length}/{fileQueue.length} ไฟล์
                  </span>
                )}
              </div>

              <div className="seamless-batch-actions">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingBatch}
                  className="seamless-btn secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                >
                  <Plus size={14} />
                  <span>เพิ่มไฟล์</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllFiles}
                  disabled={isProcessingBatch}
                  className="seamless-btn secondary"
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8125rem',
                    color: '#e11d48',
                  }}
                >
                  <Trash2 size={14} />
                  <span>ล้างทั้งหมด</span>
                </button>
              </div>
            </div>

            <div className="seamless-files-list">
              {fileQueue.map((item) => {
                const isItemProcessing = item.status === 'processing'
                const isItemSuccess = item.status === 'success'
                const isItemError = item.status === 'error'

                return (
                  <div
                    key={item.id}
                    className={`seamless-file-item ${
                      isItemProcessing
                        ? 'is-processing'
                        : isItemSuccess
                        ? 'is-success'
                        : isItemError
                        ? 'is-error'
                        : ''
                    }`}
                  >
                    <div className="seamless-file-item-left">
                      <div className="seamless-file-item-icon">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div className="seamless-file-item-details">
                        <span className="seamless-file-item-name">
                          {item.name}
                          <span className="seamless-inline-badges">
                            {isSeamlessFileName(item.name) ? (
                              <span className="seamless-mini-badge emerald">ตรงแพทเทิร์น Seamless</span>
                            ) : (
                              <span className="seamless-mini-badge amber">ชื่อไฟล์นอกแพทเทิร์น</span>
                            )}
                            {importedFileNameSet.has(item.name.toLowerCase()) && (
                              <span className="seamless-mini-badge rose">เคยนำเข้าแล้ว</span>
                            )}
                          </span>
                        </span>
                        <div className="seamless-file-item-meta">
                          <span>{(item.size / 1024).toFixed(1)} KB</span>
                          {item.result && (
                            <>
                              <span>•</span>
                              <span>{item.result.validRows.toLocaleString('th-TH')} รายการ</span>
                              <span>•</span>
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                ฿{(item.result.summary ? item.result.summary.totalCompensation : (item.result.previewRows ? item.result.previewRows.reduce((sum, r) => sum + (r.compensated || 0), 0) : 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </span>
                              {!item.result.isDryRun ? (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#0369a1', fontWeight: 600 }}>
                                    เพิ่มใหม่ {item.result.insertedCount.toLocaleString('th-TH')}
                                    {item.result.updatedCount > 0
                                      ? ` / อัปเดต ${item.result.updatedCount.toLocaleString('th-TH')}`
                                      : ''}
                                    {item.result.skippedCount > 0
                                      ? ` / ข้ามซ้ำ ${item.result.skippedCount.toLocaleString('th-TH')}`
                                      : ''}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#b45309', fontWeight: 500 }}>
                                    โหมดตรวจสอบ (ใหม่ {item.result.newInDbCount.toLocaleString('th-TH')} / ซ้ำ {item.result.existingInDbCount.toLocaleString('th-TH')})
                                  </span>
                                </>
                              )}
                              {item.result.skippedOtherHospCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#64748b' }}>
                                    ข้ามต่างหน่วย {item.result.skippedOtherHospCount.toLocaleString('th-TH')}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                          {item.errorMessage && (
                            <span style={{ color: '#e11d48', fontWeight: 500 }}>
                              • {item.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="seamless-file-item-right">
                      {isItemProcessing && (
                        <span className="seamless-file-status-badge processing">
                          <RefreshCw size={12} className="seamless-spin" />
                          กำลังอ่าน...
                        </span>
                      )}
                      {isItemSuccess && (
                        <span className="seamless-file-status-badge success">
                          <CheckCircle2 size={12} />
                          สำเร็จ
                        </span>
                      )}
                      {isItemError && (
                        <button
                          type="button"
                          onClick={() => {
                            const errText = item.errorMessage || 'ข้อผิดพลาดในการประมวลผล'
                            const errHint = errText.includes('.xls')
                              ? 'ไฟล์รูปแบบ Excel 97-2003 (.xls) / HTML ไม่สามารถอ่านได้โดยตรง กรุณาเปิดใน Excel แล้ว Save As เป็น .xlsx หรือ .csv'
                              : errText.includes('API Gateway') || errText.includes('เชื่อมต่อ')
                              ? 'ตรวจสอบการเชื่อมต่อ API Gateway (192.168.1.208:8443) หรือลองรีเฟรชหน้าเว็บ'
                              : 'ตรวจสอบว่าชีทของไฟล์ตรงกับรูปแบบ e-Claim (มีส่วนหัว REP แบบ INDIVIDUAL) และโครงสร้างคอลัมน์ครบถ้วน'
                            setErrorModal({
                              isOpen: true,
                              title: 'รายละเอียดข้อผิดพลาดของไฟล์',
                              fileName: item.name,
                              message: errText,
                              details: errHint,
                            })
                          }}
                          className="seamless-file-status-badge error"
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="คลิกเพื่อดูข้อผิดพลาดอย่างละเอียด"
                        >
                          <AlertCircle size={12} />
                          ผิดพลาด • ดูสาเหตุ
                        </button>
                      )}
                      {item.status === 'pending' && (
                        <span className="seamless-file-status-badge pending">
                          รอประมวลผล
                        </span>
                      )}

                      {!isProcessingBatch && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="seamless-file-remove-btn"
                          title="ลบไฟล์นี้ออกจากคิว"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Options & Action Footer */}
        <div className="seamless-options-grid">
          <label className="seamless-checkbox-label">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              disabled={isProcessingBatch}
            />
            <div>
              <span className="seamless-checkbox-title">โหมดตรวจสอบอย่างเดียว</span>
              <span className="seamless-checkbox-desc">
                อ่านและตรวจโครงสร้างไฟล์ แมปสิทธิ์ แต่ยังไม่บันทึกทับลงฐานข้อมูล
              </span>
            </div>
          </label>

          <label className="seamless-checkbox-label">
            <input
              type="checkbox"
              checked={autoEnrichHosp}
              onChange={(e) => setAutoEnrichHosp(e.target.checked)}
              disabled={isProcessingBatch}
            />
            <div>
              <span className="seamless-checkbox-title">ค้นหา HN และ VN อัตโนมัติจาก HOSxP</span>
              <span className="seamless-checkbox-desc">
                สำหรับโรงพยาบาลเถิน รหัส 11152 ใช้ CID 13 หลัก ดึง HN และจับคู่วันที่รับบริการเพื่อหา VN
              </span>
            </div>
          </label>

          <label className="seamless-checkbox-label">
            <input
              type="checkbox"
              checked={updatePayment}
              onChange={(e) => setUpdatePayment(e.target.checked)}
              disabled={isProcessingBatch}
            />
            <div>
              <span className="seamless-checkbox-title">คำนวณและปรับยอดเงินชดเชย</span>
              <span className="seamless-checkbox-desc">
                คำนวณยอดรวมและแยกยอดเงินชดเชยที่ได้รับจริงจาก สปสช.
              </span>
            </div>
          </label>

          <label className="seamless-checkbox-label">
            <input
              type="checkbox"
              checked={filterMyHospOnly}
              onChange={(e) => setFilterMyHospOnly(e.target.checked)}
              disabled={isProcessingBatch}
            />
            <div>
              <span className="seamless-checkbox-title">นำเข้าเฉพาะหน่วยบริการ รพ.เถิน (11152)</span>
              <span className="seamless-checkbox-desc">
                (FoxPro: lHospCode=.T.) กรองเฉพาะ HCode = 11152 (รองรับ SeekHCode จากส่วนหัวชีท) แถวต่างหน่วยบริการจะถูกข้ามอัตโนมัติ
              </span>
            </div>
          </label>

          <div className="seamless-checkbox-label" style={{ cursor: 'default' }}>
            <div style={{ width: '100%' }}>
              <span className="seamless-checkbox-title">เมื่อพบข้อมูล Trans ID ซ้ำในฐานข้อมูล</span>
              <select
                value={duplicateMode}
                onChange={(e) =>
                  setDuplicateMode(e.target.value === 'skip' ? 'skip' : 'update')
                }
                disabled={isProcessingBatch}
                aria-label="การจัดการข้อมูลซ้ำ"
                style={{
                  marginTop: '0.35rem',
                  width: '100%',
                  padding: '0.4rem 0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.8125rem',
                  color: '#0f172a',
                }}
              >
                <option value="update">อัปเดตทับรายการเดิม (แนะนำ — ป้องกันแถวซ้ำ)</option>
                <option value="skip">ข้ามรายการที่มีอยู่แล้ว (เพิ่มเฉพาะรายการใหม่)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Process Button & Action Bar */}
        <div className="seamless-action-bar">
          <div className="seamless-action-hint">
            <span className={`seamless-mode-dot ${isDryRun ? 'dryrun' : 'live'}`} />
            <span>
              {isDryRun
                ? 'โหมดตรวจสอบ: จำลองการอ่านและแมปข้อมูลโดยไม่บันทึกลงฐานข้อมูล'
                : 'โหมดนำเข้าจริง: ตรวจสอบและบันทึกข้อมูลลงในตาราง rcmdb.seamless'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isProcessingBatch && (
              <button
                type="button"
                onClick={handleCancelBatch}
                className="seamless-btn danger"
              >
                <StopCircle size={15} />
                <span>ยกเลิกคิว</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleProcessBatch}
              disabled={!canImport || fileQueue.length === 0 || isProcessingBatch}
              className={`seamless-cta-btn ${isDryRun ? 'is-dryrun' : 'is-live'}`}
            >
              {isProcessingBatch ? (
                <>
                  <RefreshCw size={15} className="seamless-spin" />
                  <span>
                    กำลังประมวลผล {currentFileIndex}/{fileQueue.length}
                  </span>
                </>
              ) : (
                <>
                  {isDryRun ? <ShieldCheck size={15} /> : <Upload size={15} />}
                  <span>
                    {isDryRun ? 'เริ่มตรวจสอบ' : 'เริ่มนำเข้าข้อมูล'}
                    {fileQueue.length > 0 ? ` • ${fileQueue.length} ไฟล์` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Multi-Stage Animated Progress Bar */}
        {(isProcessingBatch || progressPercent > 0) && (
          <div className="seamless-progress-card">
            <div className="seamless-progress-header">
              <span className="seamless-progress-title">
                {isProcessingBatch ? 'กำลังประมวลผล...' : 'สถานะการทำงาน'}
              </span>
              <span className="seamless-progress-percentage tabular-nums">{progressPercent}%</span>
            </div>

            <div className="seamless-progress-track">
              <div
                className="seamless-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="seamless-stage-text">
              <span className="seamless-stage-dot" />
              <span>{progressStage}</span>
            </div>

            {/* Stages stepper */}
            <div className="seamless-stepper">
              <div className={`seamless-step-item ${activeStageIndex >= 1 ? 'completed' : ''}`}>
                <div className="seamless-step-circle">1</div>
                <span className="seamless-step-label">อ่านข้อมูลไฟล์</span>
              </div>
              <div className={`seamless-step-connector ${activeStageIndex >= 2 ? 'active' : ''}`} />
              <div className={`seamless-step-item ${activeStageIndex >= 2 ? 'completed' : ''}`}>
                <div className="seamless-step-circle">2</div>
                <span className="seamless-step-label">ตรวจสอบโครงสร้าง</span>
              </div>
              <div className={`seamless-step-connector ${activeStageIndex >= 3 ? 'active' : ''}`} />
              <div className={`seamless-step-item ${activeStageIndex >= 3 ? 'completed' : ''}`}>
                <div className="seamless-step-circle">3</div>
                <span className="seamless-step-label">จับคู่ HOSxP</span>
              </div>
              <div className={`seamless-step-connector ${activeStageIndex >= 4 ? 'active' : ''}`} />
              <div className={`seamless-step-item ${activeStageIndex >= 4 ? 'completed' : ''}`}>
                <div className="seamless-step-circle">4</div>
                <span className="seamless-step-label">เสร็จสมบูรณ์</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Processed Results & Preview Section */}
      {(isProcessingBatch || successfulFiles.length > 0) && (
        <div className="seamless-card">
          <div className="seamless-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={22} style={{ color: '#059669' }} />
              <div>
                <h2 className="seamless-card-title" style={{ margin: 0 }}>
                  ผลการประมวลผลข้อมูล Seamless
                </h2>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {isProcessingBatch
                    ? 'กำลังดึงและประมวลผลข้อมูลจากไฟล์...'
                    : activeResultFile
                    ? `กำลังแสดงผลของไฟล์: ${activeResultFile.name}`
                    : `แสดงผลรวมทั้งหมด ${successfulFiles.length} ไฟล์`}
                </span>
              </div>
            </div>
          </div>

          {/* Multi-File Tab Switcher */}
          {successfulFiles.length > 1 && (
            <div className="seamless-file-tabs">
              <button
                type="button"
                onClick={() => setSelectedFileTabId('all')}
                className={`seamless-file-tab-btn ${selectedFileTabId === 'all' ? 'is-active' : ''}`}
              >
                <span>รวมทั้งหมด {successfulFiles.length} ไฟล์</span>
              </button>
              {successfulFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFileTabId(f.id)}
                  className={`seamless-file-tab-btn ${selectedFileTabId === f.id ? 'is-active' : ''}`}
                >
                  <FileSpreadsheet size={14} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Combined Summary Metric Pills */}
          <div className="seamless-summary-grid">
            <div className="seamless-sum-card">
              <span className="seamless-sum-label">จำนวนแถวทั้งหมด</span>
              {isProcessingBatch ? (
                <div className="rcm-skeleton-bar" style={{ width: '90px', height: '24px', margin: '4px 0' }} />
              ) : (
                <span className="seamless-sum-val tabular-nums">
                  {combinedMetrics.totalRows.toLocaleString('th-TH')}
                </span>
              )}
              <span className="seamless-sum-sub">รวมทุกชีทที่ประมวลผล</span>
            </div>
            <div className="seamless-sum-card">
              <span className="seamless-sum-label">
                {combinedMetrics.hasLiveSaved ? 'บันทึกลงฐานข้อมูลแล้ว' : 'รายการที่ถูกต้อง (โหมดตรวจสอบ)'}
              </span>
              {isProcessingBatch ? (
                <div className="rcm-skeleton-bar" style={{ width: '90px', height: '24px', margin: '4px 0' }} />
              ) : (
                <span className="seamless-sum-val green tabular-nums">
                  {combinedMetrics.hasLiveSaved
                    ? (combinedMetrics.insertedCount + combinedMetrics.updatedCount).toLocaleString('th-TH')
                    : combinedMetrics.validRows.toLocaleString('th-TH')}
                </span>
              )}
              <span className="seamless-sum-sub">
                {combinedMetrics.hasLiveSaved
                  ? `เพิ่มใหม่ ${combinedMetrics.insertedCount.toLocaleString('th-TH')} • อัปเดต ${combinedMetrics.updatedCount.toLocaleString('th-TH')}${combinedMetrics.skippedCount > 0 ? ` • ข้ามซ้ำ ${combinedMetrics.skippedCount.toLocaleString('th-TH')}` : ''}${combinedMetrics.skippedOtherHospCount > 0 ? ` • ข้ามต่างหน่วย ${combinedMetrics.skippedOtherHospCount.toLocaleString('th-TH')}` : ''}`
                  : `รายการใหม่ ${combinedMetrics.newInDbCount.toLocaleString('th-TH')} • ซ้ำในระบบ ${combinedMetrics.existingInDbCount.toLocaleString('th-TH')}${combinedMetrics.skippedOtherHospCount > 0 ? ` • ข้ามต่างหน่วย ${combinedMetrics.skippedOtherHospCount.toLocaleString('th-TH')}` : ''}`}
              </span>
            </div>
            <div className="seamless-sum-card">
              <span className="seamless-sum-label">ยอดเงินชดเชยรวม</span>
              {isProcessingBatch ? (
                <div className="rcm-skeleton-bar" style={{ width: '120px', height: '24px', margin: '4px 0' }} />
              ) : (
                <span className="seamless-sum-val emerald tabular-nums">
                  ฿{combinedMetrics.totalCompensation.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              )}
              <span className="seamless-sum-sub">ยอดชดเชยตามประกาศ สปสช.</span>
            </div>
            <div className="seamless-sum-card">
              <span className="seamless-sum-label">จับคู่ HOSxP สำเร็จ</span>
              {isProcessingBatch ? (
                <div className="rcm-skeleton-bar" style={{ width: '100px', height: '24px', margin: '4px 0' }} />
              ) : (
                <span className="seamless-sum-val blue tabular-nums">
                  {combinedMetrics.matchedHn.toLocaleString('th-TH')} HN
                </span>
              )}
              <span className="seamless-sum-sub">
                {combinedMetrics.matchedVn.toLocaleString('th-TH')} ครั้งรับบริการ
              </span>
            </div>
            {combinedMetrics.errorRows > 0 && (
              <div className="seamless-sum-card">
                <span className="seamless-sum-label">รายการผิดพลาด</span>
                <span className="seamless-sum-val red tabular-nums">
                  {combinedMetrics.errorRows.toLocaleString('th-TH')}
                </span>
                <span className="seamless-sum-sub">ฟิลด์ไม่ครบหรือผิดโครงสร้าง</span>
              </div>
            )}
          </div>

          {/* Per-Fund Breakdown Summary (accurate 4-char codes + sums) */}
          {displayedFundBreakdown.length > 0 && (
            <div className="seamless-fund-breakdown-wrap">
              <table className="seamless-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>รหัสกองทุน</th>
                    <th>ชื่อกองทุน Seamless</th>
                    <th style={{ textAlign: 'right' }}>จำนวนรายการ</th>
                    <th style={{ textAlign: 'right' }}>เรียกเก็บรวม (฿)</th>
                    <th style={{ textAlign: 'right' }}>ชดเชยรวม (฿)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedFundBreakdown.map((fb) => (
                    <tr key={`${fb.fundCode}-${fb.fundName}`}>
                      <td className="tabular-nums">
                        <span className="seamless-mini-badge emerald">{fb.fundCode}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{fb.fundName}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>
                        {fb.count.toLocaleString('th-TH')}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>
                        {fb.totalCollected.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                        {fb.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub Tabs Navigation */}
          <div className="seamless-tabs-bar">
            {(isProcessingBatch || combinedMetrics.validRows > 0) && (
              <button
                type="button"
                onClick={() => setActiveTab('individual')}
                className={`seamless-tab-btn ${activeTab === 'individual' ? 'active' : ''}`}
              >
                <span>รายการผู้รับบริการ</span>
                <span className="seamless-tab-count tabular-nums">
                  {combinedMetrics.validRows.toLocaleString('th-TH')}
                </span>
              </button>
            )}

            {(displayedFunds.length > 0 || displayedSummaryInfo.length > 0) && (
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`seamless-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
              >
                <span>สรุปกองทุน</span>
                {displayedFunds.length > 0 && (
                  <span className="seamless-tab-count tabular-nums">{displayedFunds.length}</span>
                )}
              </button>
            )}

            {displayedDenyCodes.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('denyCodes')}
                className={`seamless-tab-btn ${activeTab === 'denyCodes' ? 'active' : ''}`}
              >
                <span>รหัสปฏิเสธ</span>
                <span className="seamless-tab-count tabular-nums">{displayedDenyCodes.length}</span>
              </button>
            )}

            {displayedErrors.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('errors')}
                className={`seamless-tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
              >
                <span>รายการผิดพลาด</span>
                <span className="seamless-tab-count alert tabular-nums">
                  {displayedErrors.length}
                </span>
              </button>
            )}
          </div>

          {/* Tab 1: INDIVIDUAL Rows Preview */}
          {activeTab === 'individual' && (
            <div className="seamless-table-wrapper">
              <div className="seamless-table-toolbar">
                <div className="seamless-search-box">
                  <Search size={15} style={{ color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="ค้นหาข้อมูล..."
                    className="seamless-search-input"
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="seamless-search-clear"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  แสดงตัวอย่าง {displayedPreviewRows.length} รายการ จากทั้งหมด {combinedMetrics.validRows.toLocaleString('th-TH')} รายการ
                </div>
              </div>

              <div className="seamless-table-container">
                <table className="seamless-table">
                  <thead>
                    <tr>
                      {(dynamicColumns.length > 0
                        ? dynamicColumns
                        : [
                            { key: 'index', header: 'ลำดับ', width: '60px' },
                            { key: 'id', header: 'Trans ID' },
                            { key: 'rep', header: 'Rep' },
                            { key: 'fund', header: 'กองทุน' },
                            { key: 'pid', header: 'เลขบัตรประชาชน' },
                            { key: 'hn', header: 'HN' },
                            { key: 'ptname', header: 'ชื่อ-สกุล' },
                            { key: 'admDate', header: 'วันที่บริการ' },
                            { key: 'compensated', header: 'ชดเชย' },
                            { key: 'hosMatch', header: 'สถานะ HOSxP' },
                          ]
                      ).map((col) => (
                        <th
                          key={col.key}
                          style={{
                            width: col.width,
                            textAlign: 'center',
                          }}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isProcessingBatch ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                          {Array.from({
                            length: Math.max(dynamicColumns.length, 10),
                          }).map((__, colIdx) => (
                            <td key={colIdx} style={{ textAlign: 'center' }}>
                              <div className="rcm-skeleton-bar" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : displayedPreviewRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(dynamicColumns.length, 10)}
                          style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}
                        >
                          ไม่พบข้อมูลที่ตรงกับคำค้นหา
                        </td>
                      </tr>
                    ) : (
                      displayedPreviewRows.slice(0, 100).map((row, idx) => (
                        <tr key={`${row.fileName || 'f'}-${row.rowNumber || idx}-${row.id || 'id'}-${idx}`}>
                          {dynamicColumns.map((col) => (
                            <td
                              key={col.key}
                              style={{ textAlign: 'center' }}
                            >
                              {col.render(row, idx)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {displayedPreviewRows.length > 100 && (
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                  แสดงตัวอย่าง 100 รายการแรก เพื่อความรวดเร็วในการแสดงผล
                </div>
              )}
            </div>
          )}

          {/* Tab 2: SUMMARY & Detected Funds */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {displayedSummaryInfo.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
                  {displayedSummaryInfo.map((info, idx) => (
                    <div key={`${info.rep}-${info.payNo}-${idx}`} style={{ padding: '0.875rem 1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#047857', marginBottom: '0.4rem' }}>
                        Rep: {info.rep}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {info.payNo && <div>เลขที่โอน: <strong>{info.payNo}</strong></div>}
                        {info.repDate && <div>วันที่ Rep: <strong>{info.repDate}</strong></div>}
                        {info.payDate && <div>วันที่โอน: <strong>{info.payDate}</strong></div>}
                        {info.codeAccount && <div>รหัสบัญชี: <strong>{info.codeAccount}</strong></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {displayedFunds.length > 0 && (
                <div className="seamless-table-container">
                  <table className="seamless-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px', textAlign: 'center' }}>ลำดับ</th>
                        <th style={{ textAlign: 'center' }}>รหัสกองทุน</th>
                        <th style={{ textAlign: 'center' }}>ชื่อกองทุน สปสช.</th>
                        <th style={{ textAlign: 'center' }}>จำนวนรายการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedFunds.map((fund, idx) => (
                        <tr key={`${fund.fundCode}-${idx}`}>
                          <td className="tabular-nums" style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, textAlign: 'center' }}>{fund.fundCode}</td>
                          <td style={{ textAlign: 'center' }}>{fund.fundName}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }} className="tabular-nums">
                            {fund.count.toLocaleString('th-TH')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: DENY CODES */}
          {activeTab === 'denyCodes' && displayedDenyCodes.length > 0 && (
            <div className="seamless-table-container">
              <table className="seamless-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px', textAlign: 'center' }}>รหัสปฏิเสธ</th>
                    <th style={{ textAlign: 'center' }}>คำอธิบายข้อผิดพลาด</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDenyCodes.map((d, idx) => (
                    <tr key={`${d.code}-${idx}`}>
                      <td style={{ textAlign: 'center' }}>
                        <span className="seamless-fund-tag alert">{d.code}</span>
                      </td>
                      <td style={{ fontWeight: 600, textAlign: 'center' }}>{d.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Errors List */}
          {activeTab === 'errors' && displayedErrors.length > 0 && (
            <div className="seamless-table-container">
              <table className="seamless-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>ไฟล์</th>
                    <th style={{ textAlign: 'center' }}>แถวที่</th>
                    <th style={{ textAlign: 'center' }}>สาเหตุข้อผิดพลาด</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedErrors.map((err, idx) => (
                    <tr key={`${err.fileName}-${err.row}-${idx}`}>
                      <td style={{ fontWeight: 600, color: '#334155', textAlign: 'center' }}>{err.fileName}</td>
                      <td className="tabular-nums" style={{ textAlign: 'center' }}>{err.row > 0 ? err.row : 'ทั้งไฟล์'}</td>
                      <td style={{ color: '#b91c1c', textAlign: 'center' }}>{err.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prominent Error Modal Dialog (Following ui-style-brief) */}
      {/* Live Database Explorer & DENY CODE Dictionary */}
      <SeamlessLedgerSection
        ledger={ledger}
        isLoadingLedger={isLoadingLedger}
        ledgerError={ledgerError}
        denyCodes={denyCodes}
        isLoadingDenyCodes={isLoadingDenyCodes}
        search={ledgerSearch}
        onSearchChange={setLedgerSearch}
        hospFilter={hospFilter}
        onHospFilterChange={(val) => {
          setHospFilter(val)
          setLedgerPage(1)
        }}
        payStatus={payStatus}
        onPayStatusChange={(val) => {
          setPayStatus(val)
          setLedgerPage(1)
        }}
        fundFilter={fundFilter}
        onFundFilterChange={(val) => {
          setFundFilter(val)
          setLedgerPage(1)
        }}
        fileNameFilter={fileNameFilter}
        onClearFileFilter={() => {
          setFileNameFilter('')
          setLedgerPage(1)
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(field) => {
          if (sortBy === field) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
          } else {
            setSortBy(field)
            setSortOrder('desc')
          }
          setLedgerPage(1)
        }}
        page={ledgerPage}
        onPageChange={setLedgerPage}
        denySearch={denySearch}
        onDenySearchChange={setDenySearch}
        onRefreshLedger={() => fetchLedger(true)}
        onExportAllLedger={handleExportAllLedger}
        isExportingLedger={isExportingLedger}
        canImport={canImport}
        onDeleteSingleFile={(fname) => handleDeleteRequest({ mode: 'by_file', fileName: fname })}
      />

      {/* FoxPro Management Modals */}
      <ImportedFilesModal
        isOpen={isFilesModalOpen}
        files={importedFiles}
        isLoading={isLoadingFiles}
        isDeleting={isManagingDb}
        canImport={canImport}
        onClose={() => setIsFilesModalOpen(false)}
        onFilterByFile={(fname) => {
          setFileNameFilter(fname)
          setLedgerPage(1)
        }}
        onDeleteSingleFile={async (fname) => {
          await handleDeleteRequest({ mode: 'by_file', fileName: fname })
        }}
        onDeleteMultipleFiles={async (fnames) => {
          await handleDeleteRequest({ mode: 'by_files', fileNames: fnames })
        }}
      />

      <DeleteConfirmModal
        mode={deleteConfirmMode}
        otherHospCount={stats?.otherHospCount ?? 0}
        totalRows={stats?.totalRows ?? 0}
        myHospCode={stats?.myHospCode || ledger?.myHospCode || '11152'}
        isSubmitting={isManagingDb}
        onClose={() => setDeleteConfirmMode(null)}
        onConfirm={async () => {
          if (deleteConfirmMode) {
            await handleDeleteRequest({ mode: deleteConfirmMode })
          }
        }}
      />

      <SyncPaymentModal
        isOpen={isSyncModalOpen}
        missingPayDateCount={stats?.missingPayDateCount ?? 0}
        isSubmitting={isManagingDb}
        onClose={() => setIsSyncModalOpen(false)}
        onConfirm={handleSyncPayment}
      />

      {/* Detailed Error Modal */}
      {errorModal?.isOpen && (
        <div
          className="seamless-modal-backdrop"
          onClick={() => setErrorModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="seamless-modal-title"
        >
          <div
            className="seamless-error-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="seamless-modal-head">
              <div className="seamless-modal-head-left">
                <div className="seamless-modal-icon-badge">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 id="seamless-modal-title" className="seamless-modal-title">
                    {errorModal.title}
                  </h3>
                  <p className="seamless-modal-subtitle">
                    ตรวจพบข้อผิดพลาดในการประมวลผลไฟล์ Seamless
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorModal(null)}
                className="seamless-modal-close-btn"
                aria-label="ปิดหน้าต่างข้อผิดพลาด"
              >
                <X size={18} />
              </button>
            </div>

            <div className="seamless-modal-body">
              {errorModal.fileName && (
                <div className="seamless-modal-file-tag">
                  <FileSpreadsheet size={15} style={{ color: '#059669' }} />
                  <span>ไฟล์: {errorModal.fileName}</span>
                </div>
              )}

              <p className="seamless-modal-error-text">{errorModal.message}</p>

              {errorModal.details && (
                <div className="seamless-modal-details-box">
                  <span className="seamless-modal-details-label">รายละเอียดทางเทคนิค</span>
                  <pre className="seamless-modal-details-content">{errorModal.details}</pre>
                </div>
              )}

              <div className="seamless-modal-guidance">
                <Info size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>แนวทางแก้ไข:</strong> ตรวจสอบว่าไฟล์เป็นนามสกุล <code>.xlsx</code> หรือ <code>.csv</code> (หากเป็น <code>.xls</code> เก่า ให้เปิดใน Excel แล้ว Save As เป็น <code>.xlsx</code>), มีชีทหรือส่วนหัว <code>REP แบบ INDIVIDUAL</code> และไม่ได้เปิดไฟล์ค้างไว้ในโปรแกรมอื่น
                </div>
              </div>
            </div>

            <div className="seamless-modal-foot">
              <button
                type="button"
                onClick={handleCopyError}
                className="seamless-btn secondary"
                style={{ fontSize: '0.8125rem' }}
              >
                {copiedError ? (
                  <>
                    <Check size={14} style={{ color: '#059669' }} />
                    <span style={{ color: '#059669' }}>คัดลอกเรียบร้อย</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>คัดลอกข้อความผิดพลาด</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setErrorModal(null)}
                className="seamless-btn primary"
                style={{ fontSize: '0.8125rem', padding: '0.5rem 1.25rem' }}
              >
                รับทราบ / ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
