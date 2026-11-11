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
} from 'lucide-react'
import {
  SeamlessDatabaseStats,
  SeamlessParseResult,
  ParsedSeamlessRow,
  SeamlessDenyCode,
  SeamlessParseError,
  SEAMLESS_FUND_MAP,
} from '@/lib/clinical/rcmSeamlessImportService'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './seamless-import.css'

interface SeamlessImportClientProps {
  initialStats: SeamlessDatabaseStats | null
  initialError: string | null
  userRole?: string
  username?: string
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

type TabType = 'individual' | 'summary' | 'denyCodes' | 'errors'

export default function SeamlessImportClient({
  initialStats,
  initialError,
  userRole = 'member',
  username = '',
}: SeamlessImportClientProps) {
  // Database stats state
  const [stats, setStats] = useState<SeamlessDatabaseStats | null>(initialStats)
  const [isRefreshingStats, setIsRefreshingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(initialError)

  // Multi-File upload queue
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isDryRun, setIsDryRun] = useState(true)
  const [autoEnrichHosp, setAutoEnrichHosp] = useState(true)
  const [updatePayment, setUpdatePayment] = useState(true)

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
  const isFirstMount = useRef(true)

  // Refresh DB stats from server
  const fetchStats = useCallback(async () => {
    setIsRefreshingStats(true)
    try {
      const res = await fetch('/api/service/dashboard-rcm/seamless-import')
      const json = await res.json()
      if (json.success && json.data) {
        setStats(json.data)
        setStatsError(null)
      } else {
        setStatsError(json.error || 'ไม่สามารถโหลดข้อมูลสถิติได้')
      }
    } catch {
      setStatsError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsRefreshingStats(false)
    }
  }, [])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialStats) return
    }
    fetchStats()
  }, [fetchStats, initialStats])

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
      if (/\.(xlsx|xls)$/i.test(file.name)) {
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
        title: 'พบไฟล์ที่ไม่ใช่รูปแบบ Excel (.xlsx, .xls)',
        message: `ระบบรองรับเฉพาะไฟล์ Excel (.xlsx, .xls) เท่านั้น ไฟล์ต่อไปนี้ไม่ได้รับการเพิ่มลงคิว:\n${invalidNames.join(
          ', '
        )}`,
        details:
          'โปรดตรวจสอบว่าไฟล์รายงานที่ดาวน์โหลดจาก e-Claim หรือ สปสช. เป็นนามสกุล .xlsx หรือ .xls ถูกต้องก่อนนำเข้า',
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

  // Batch process all pending files
  const handleProcessBatch = async () => {
    if (fileQueue.length === 0 || isProcessingBatch) return

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
    let lastErrorEncountered: ErrorModalState | null = null

    for (let i = 0; i < totalBatchCount; i++) {
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

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.4))
        setProgressStage(`[${i + 1}/${totalBatchCount}] ตรวจสอบคอลัมน์ & แมปโครงสร้าง 30 กองทุน...`)
        setActiveStageIndex(2)

        const res = await fetch('/api/service/dashboard-rcm/seamless-import', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.75))
        setProgressStage(`[${i + 1}/${totalBatchCount}] เชื่อมโยง HOSxP ค้นหา HN/VN แบบ Batch...`)
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

        lastErrorEncountered = {
          isOpen: true,
          title: 'เกิดข้อผิดพลาดในการนำเข้าไฟล์',
          fileName: currentItem.name,
          message: errorMsg,
          details:
            'แนะนำ: ตรวจสอบว่าไฟล์มีชีท INDIVIDUAL หรือไม่ และมีคอลัมน์เลขประจำตัวประชาชน (PID/CID) ถูกต้องตามรูปแบบ สปสช.',
        }
      }
    }

    setProgressPercent(100)
    setProgressStage(`ประมวลผลเสร็จสมบูรณ์ทั้งสิ้น ${totalBatchCount} ไฟล์`)
    setActiveStageIndex(4)
    setIsProcessingBatch(false)

    // Trigger Error Modal if any error occurred
    if (lastErrorEncountered) {
      setErrorModal(lastErrorEncountered)
    }

    // Refresh database stats if any file was processed not in dry-run
    if (!isDryRun) {
      fetchStats()
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

    const targetList = activeResultFile?.result
      ? [activeResultFile]
      : successfulFiles

    targetList.forEach((item) => {
      if (item.result) {
        totalRows += item.result.totalRows
        validRows += item.result.validRows
        errorRows += item.result.errorRows
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
            onClick={fetchStats}
            disabled={isRefreshingStats}
            className="seamless-btn secondary"
            title="รีเฟรชข้อมูลสถิติจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshingStats ? 'seamless-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={displayedPreviewRows.length === 0}
            className="seamless-btn primary"
            title="ส่งออกรายการที่ประมวลผลเป็นไฟล์ Excel"
          >
            <Download size={16} />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

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
            <span className="seamless-stat-label">จำนวนเลขที่ Rep สะสม</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '80px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="seamless-stat-value tabular-nums">
                {(stats?.totalReps ?? 0).toLocaleString('th-TH')} รายการ
              </span>
            )}
            <span className="seamless-stat-sub">งวดการโอนเงินชดเชย</span>
          </div>
        </div>
      </div>

      {/* Main Upload & Multi-File Queue Card */}
      <div className="seamless-card">
        <div className="seamless-card-header">
          <h2 className="seamless-card-title">
            <FileSpreadsheet size={20} style={{ color: '#059669' }} />
            <span>เลือกไฟล์ Excel ข้อมูล Seamless</span>
          </h2>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            รองรับ .xlsx, .xls ทั้งชีท INDIVIDUAL, SUMMARY และ DENY CODE
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
            accept=".xlsx,.xls"
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
                        <span className="seamless-file-item-name">{item.name}</span>
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
                          onClick={() =>
                            setErrorModal({
                              isOpen: true,
                              title: 'รายละเอียดข้อผิดพลาดของไฟล์',
                              fileName: item.name,
                              message: item.errorMessage || 'ข้อผิดพลาดในการประมวลผล',
                              details:
                                'ตรวจสอบว่าชีทของไฟล์ตรงกับรูปแบบ e-Claim และโครงสร้างคอลัมน์ไม่ถูกเปลี่ยนชื่อ',
                            })
                          }
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

          <button
            type="button"
            onClick={handleProcessBatch}
            disabled={fileQueue.length === 0 || isProcessingBatch}
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
              <span className="seamless-sum-label">รายการที่ถูกต้อง</span>
              {isProcessingBatch ? (
                <div className="rcm-skeleton-bar" style={{ width: '90px', height: '24px', margin: '4px 0' }} />
              ) : (
                <span className="seamless-sum-val green tabular-nums">
                  {combinedMetrics.validRows.toLocaleString('th-TH')}
                </span>
              )}
              <span className="seamless-sum-sub">พร้อมใช้งาน / บันทึก</span>
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
                  <strong>แนวทางแก้ไข:</strong> ตรวจสอบว่าไฟล์เปิดด้วยโปรแกรมอื่นค้างอยู่หรือไม่, ไฟล์เป็นนามสกุล .xlsx หรือ .xls, มีแผ่นงานชื่อ <code>INDIVIDUAL</code> และมีคอลัมน์เลขประจำตัวประชาชนครบถ้วน
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
