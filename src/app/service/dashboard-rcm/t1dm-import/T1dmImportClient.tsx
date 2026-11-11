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
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Building,
  UserCheck,
  ExternalLink,
  Info,
  Copy,
  Layers,
  ShieldCheck,
  FolderOpen,
  Plus,
} from 'lucide-react'
import type {
  T1dmRegistrySummary,
  T1dmImportedFileSummary,
  T1dmRegistryListResult,
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
  // Database stats state
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
  const [importedFiles, setImportedFiles] = useState<T1dmImportedFileSummary[]>(
    initialData?.importedFiles ?? []
  )
  const myHospCode = initialData?.myHospCode || '11152'

  // Loading & error states
  const [isRefreshingStats, setIsRefreshingStats] = useState<boolean>(false)
  const [statsError, setStatsError] = useState<string | null>(initialError)

  // Multi-file upload queue
  const [fileQueue, setFileQueue] = useState<QueuedImportFile[]>([])
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [filterMyHospOnly, setFilterMyHospOnly] = useState<boolean>(true) // FoxPro default: setHospCode=.T.
  const [isDryRun, setIsDryRun] = useState<boolean>(false)

  // Batch execution & Progress state
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false)
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0)
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [progressStage, setProgressStage] = useState<string>('')
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0)

  // Active result view (All files or specific file)
  const [selectedFileTabId, setSelectedFileTabId] = useState<string>('all')
  const [tableSearch, setTableSearch] = useState<string>('')

  // Delete confirmations
  const [isDeleteOtherHospModalOpen, setIsDeleteOtherHospModalOpen] = useState<boolean>(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [isFilesModalOpen, setIsFilesModalOpen] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Refresh DB stats from server
  const fetchStats = useCallback(async () => {
    setIsRefreshingStats(true)
    try {
      const res = await fetch('/api/service/dashboard-rcm/t1dm-import?pageSize=1')
      const json = await res.json()
      if (json.success && json.data) {
        setSummary(json.data.summary)
        setImportedFiles(json.data.importedFiles || [])
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
      if (initialData) return
    }
    fetchStats()
  }, [fetchStats, initialData])

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
      if (/\.(xlsx|xls)$/i.test(f.name)) {
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

  // Batch process all pending files
  const handleProcessImportQueue = async () => {
    if (fileQueue.length === 0 || isProcessingQueue) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsProcessingQueue(true)
    setProgressPercent(0)

    const pendingFiles = fileQueue.filter((f) => f.status === 'pending' || f.status === 'error')
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
      setActiveStageIndex(1)

      try {
        const formData = new FormData()
        formData.append('file', currentItem.file)
        formData.append('dryRun', String(isDryRun))
        formData.append('filterMyHospOnly', String(filterMyHospOnly))
        formData.append('myHospCode', myHospCode)

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.45))
        setProgressStage(`[${i + 1}/${totalBatchCount}] ตรวจสอบคอลัมน์ RUN | PID | สิทธิ | หน่วยบริการ...`)
        setActiveStageIndex(2)

        const res = await fetch('/api/service/dashboard-rcm/t1dm-import', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk * 0.8))
        setProgressStage(`[${i + 1}/${totalBatchCount}] ดึงข้อมูล HN จาก HOSxP & บันทึกลงฐานข้อมูล...`)
        setActiveStageIndex(3)

        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || `ข้อผิดพลาดรหัส ${res.status}`)
        }

        const parseResult: T1dmImportParseResult = json.data

        setFileQueue((prev) =>
          prev.map((f) => (f.id === currentItem.id ? { ...f, status: 'success', result: parseResult } : f))
        )

        setProgressPercent(Math.round(fileProgressBase + fileProgressChunk))
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'นำเข้าไฟล์ไม่สำเร็จ'
        setFileQueue((prev) =>
          prev.map((f) => (f.id === currentItem.id ? { ...f, status: 'error', errorMessage: message } : f))
        )
      }
    }

    setProgressPercent(100)
    setProgressStage(`ประมวลผลเสร็จสมบูรณ์ทั้งสิ้น ${totalBatchCount} ไฟล์`)
    setActiveStageIndex(4)
    setIsProcessingQueue(false)

    // Refresh database statistics
    fetchStats()
  }

  // Delete other hospitals (hospmain <> 11152)
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
      fetchStats()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setIsDeleting(false)
    }
  }

  // Delete file records (delete from rcmdb.t1dm where filename=?_file)
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
      fetchStats()
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

  // Combined metrics from newly processed files
  const combinedMetrics = useMemo(() => {
    let totalRows = 0
    let importedRows = 0
    let skippedOtherHosp = 0
    let matchedHn = 0
    const typeBreakdown: Record<string, number> = {}

    const targetList = activeResultFile?.result ? [activeResultFile] : successfulFiles

    targetList.forEach((item) => {
      if (item.result) {
        totalRows += item.result.totalRowsScanned
        importedRows += item.result.importedCount
        skippedOtherHosp += item.result.skippedOtherHospCount
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
            <span style={{ color: '#0f172a', fontWeight: 600 }}>ทะเบียน T1DM/GDM/PDM</span>
          </div>

          <h1 className="t1dm-import-title">
            <Upload size={22} style={{ color: '#059669' }} />
            <span>ระบบนำเข้าข้อมูลทะเบียน T1DM/GDM/PDM</span>
          </h1>
          <p className="t1dm-import-subtitle">
            นำเข้าและประมวลผลไฟล์ Excel ทะเบียนผู้ป่วยเบาหวาน สปสช. (*T1DM*.XLS*)
            ตรวจสอบความถูกต้อง กรองหน่วยบริการ และเชื่อมโยง HOSxP อัตโนมัติ
          </p>
        </div>

        <div className="t1dm-import-actions">
          <button
            type="button"
            onClick={fetchStats}
            disabled={isRefreshingStats}
            className="t1dm-import-btn secondary"
            title="รีเฟรชข้อมูลสถิติจากฐานข้อมูล"
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

      {/* ── 2. Database Overview Stats Cards ── */}
      <div className="t1dm-import-stats-grid">
        <div className="t1dm-import-stat-card">
          <div className="t1dm-import-stat-icon-wrap emerald">
            <UserCheck size={20} />
          </div>
          <div className="t1dm-import-stat-info">
            <span className="t1dm-import-stat-label">ผู้ป่วยในทะเบียนทั้งหมด</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '90px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="t1dm-import-stat-value">
                {summary.totalRegistered.toLocaleString('th-TH')}
              </span>
            )}
            <span className="t1dm-import-stat-sub">ตาราง rcmdb.t1dm</span>
          </div>
        </div>

        <div className="t1dm-import-stat-card">
          <div className="t1dm-import-stat-icon-wrap blue">
            <Building size={20} />
          </div>
          <div className="t1dm-import-stat-info">
            <span className="t1dm-import-stat-label">หน่วยบริการ รพ.เถิน (11152)</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '90px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="t1dm-import-stat-value" style={{ color: '#059669' }}>
                {summary.myHospCount.toLocaleString('th-TH')}
              </span>
            )}
            <span className="t1dm-import-stat-sub">
              {summary.totalRegistered > 0
                ? `${((summary.myHospCount / summary.totalRegistered) * 100).toFixed(1)}% ของทั้งหมด`
                : '0%'}
            </span>
          </div>
        </div>

        <div className="t1dm-import-stat-card">
          <div className="t1dm-import-stat-icon-wrap pink">
            <AlertTriangle size={20} />
          </div>
          <div className="t1dm-import-stat-info">
            <span className="t1dm-import-stat-label">ต่างหน่วยบริการ (ไม่ใช่ 11152)</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '70px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="t1dm-import-stat-value" style={{ color: '#e11d48' }}>
                {summary.otherHospCount.toLocaleString('th-TH')}
              </span>
            )}
            <span className="t1dm-import-stat-sub">
              {summary.otherHospCount > 0 ? 'สามารถกดปุ่มลบด้านล่างได้' : 'ไม่มีรายการตกค้าง'}
            </span>
          </div>
        </div>

        <div className="t1dm-import-stat-card">
          <div className="t1dm-import-stat-icon-wrap purple">
            <FileSpreadsheet size={20} />
          </div>
          <div className="t1dm-import-stat-info">
            <span className="t1dm-import-stat-label">จำนวนไฟล์ที่นำเข้าแล้ว</span>
            {isRefreshingStats ? (
              <div className="rcm-skeleton-bar" style={{ width: '70px', height: '24px', margin: '4px 0' }} />
            ) : (
              <span className="t1dm-import-stat-value">
                {summary.totalFiles.toLocaleString('th-TH')} ไฟล์
              </span>
            )}
            <span className="t1dm-import-stat-sub">ไฟล์ Excel ที่บันทึกสำเร็จ</span>
          </div>
        </div>
      </div>

      {/* ── 3. Main Upload & Multi-File Queue Card ── */}
      <div className="t1dm-import-card">
        <div className="t1dm-import-card-header">
          <h2 className="t1dm-import-card-title">
            <FileSpreadsheet size={19} style={{ color: '#059669' }} />
            <span>เลือกไฟล์ Excel ทะเบียน T1DM (*T1DM*.XLS*)</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {importedFiles.length > 0 && (
              <button
                type="button"
                className="t1dm-import-btn secondary sm"
                onClick={() => setIsFilesModalOpen(true)}
                title="ดูประวัติและเลือกลบข้อมูลตามไฟล์"
              >
                <FolderOpen size={14} />
                <span>ประวัติไฟล์ ({importedFiles.length})</span>
              </button>
            )}

            {canImport && summary.otherHospCount > 0 && (
              <button
                type="button"
                className="t1dm-import-btn danger sm"
                onClick={() => setIsDeleteOtherHospModalOpen(true)}
                title="ลบรายการต่าง รพ. (delete from rcmdb.t1dm where hospmain <> 11152)"
              >
                <Trash2 size={13} />
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
          aria-label="คลิกหรือลากไฟล์ Excel ทะเบียน T1DM มาวางที่นี่เพื่อนำเข้า"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          <div className="t1dm-import-dropzone-icon">
            <Upload size={24} />
          </div>
          <div>
            <span className="t1dm-import-dropzone-main">
              ลากไฟล์มาวางที่นี่ หรือ <span className="t1dm-import-dropzone-highlight">คลิกเพื่อเลือกไฟล์</span>
            </span>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
              รองรับ .xlsx, .xls ตรวจสอบหัวชีท T1DM และแถวคอลัมน์ RUN | ปีงบประมาณ | PID | ชนิด
            </div>
          </div>
        </div>

        {/* Files Queue List */}
        {fileQueue.length > 0 && (
          <div className="t1dm-import-files-panel">
            <div className="t1dm-import-batch-bar">
              <div className="t1dm-import-batch-info">
                <FolderOpen size={16} style={{ color: '#059669' }} />
                <span>
                  เลือกทั้งหมด <strong>{fileQueue.length} ไฟล์</strong> •{' '}
                  {(fileQueue.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
                {successfulFiles.length > 0 && (
                  <span style={{ color: '#059669', marginLeft: 8, fontWeight: 600 }}>
                    • สำเร็จแล้ว {successfulFiles.length}/{fileQueue.length} ไฟล์
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
                  <Plus size={13} />
                  <span>เพิ่มไฟล์</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllQueue}
                  disabled={isProcessingQueue}
                  className="t1dm-import-btn secondary sm"
                  style={{ color: '#e11d48' }}
                >
                  <Trash2 size={13} />
                  <span>ล้างทั้งหมด</span>
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
                    <FileSpreadsheet size={19} className="t1dm-import-file-item-icon" />
                    <div className="t1dm-import-file-item-details">
                      <span className="t1dm-import-file-item-name">{item.name}</span>
                      <div className="t1dm-import-file-item-meta">
                        <span>{(item.size / 1024).toFixed(1)} KB</span>
                        {item.isDuplicate && (
                          <span style={{ color: '#b45309', fontWeight: 600 }}>
                            • ⚠️ เคยนำเข้าไฟล์ชื่อนี้แล้ว
                          </span>
                        )}
                        {item.result && (
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            • สำเร็จ {item.result.importedCount.toLocaleString('th-TH')} แถว (ข้ามต่าง รพ. {item.result.skippedOtherHospCount})
                          </span>
                        )}
                        {item.errorMessage && (
                          <span style={{ color: '#e11d48', fontWeight: 500 }}>
                            • {item.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="t1dm-import-file-item-right">
                    {item.status === 'processing' && (
                      <span className="t1dm-import-file-status-badge processing">
                        <RefreshCw size={12} className="t1dm-spin" />
                        กำลังอ่าน...
                      </span>
                    )}
                    {item.status === 'success' && (
                      <span className="t1dm-import-file-status-badge success">
                        <CheckCircle2 size={12} />
                        สำเร็จ
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
                        title="ลบไฟล์นี้ออกจากคิว"
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
          <label className="t1dm-import-checkbox-label">
            <input
              type="checkbox"
              checked={filterMyHospOnly}
              onChange={(e) => setFilterMyHospOnly(e.target.checked)}
              disabled={isProcessingQueue}
            />
            <div>
              <span className="t1dm-import-checkbox-title">
                นำเข้าเฉพาะหน่วยบริการ รพ.เถิน (11152)
              </span>
              <span className="t1dm-import-checkbox-desc">
                (FoxPro: lHospCode=.T.) กรองเฉพาะ hospmain = 11152 รายการที่เป็นต่างหน่วยบริการจะถูกข้ามโดยอัตโนมัติ
              </span>
            </div>
          </label>

          <label className="t1dm-import-checkbox-label">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              disabled={isProcessingQueue}
            />
            <div>
              <span className="t1dm-import-checkbox-title">โหมดตรวจสอบข้อมูลอย่างเดียว (Dry Run)</span>
              <span className="t1dm-import-checkbox-desc">
                อ่านและจำลองตรวจโครงสร้างไฟล์ นับจำนวนแถวและชนิดเบาหวาน โดยยังไม่บันทึกลงฐานข้อมูลจริง
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
                ? 'โหมดตรวจสอบ: จำลองการอ่านและแมปข้อมูลโดยไม่บันทึกลงฐานข้อมูล'
                : 'โหมดนำเข้าจริง: ตรวจสอบและบันทึกข้อมูลลงในตาราง rcmdb.t1dm'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleProcessImportQueue}
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
                  {isDryRun ? 'เริ่มตรวจสอบไฟล์' : 'เริ่มนำเข้าข้อมูล'}
                  {fileQueue.length > 0 ? ` • ${fileQueue.length} ไฟล์` : ''}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Multi-Stage Animated Progress Bar */}
        {(isProcessingQueue || progressPercent > 0) && (
          <div className="t1dm-import-progress-card">
            <div className="t1dm-import-progress-header">
              <span>{isProcessingQueue ? 'กำลังประมวลผล...' : 'สถานะการทำงาน'}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progressPercent}%</span>
            </div>

            <div className="t1dm-import-progress-track">
              <div className="t1dm-import-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="t1dm-import-stage-text">
              <span className="t1dm-import-stage-dot" />
              <span>{progressStage}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Processed Results & Preview Section (Only shows when files were processed) ── */}
      {(isProcessingQueue || successfulFiles.length > 0) && (
        <div className="t1dm-import-card">
          <div className="t1dm-import-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={22} style={{ color: '#059669' }} />
              <div>
                <h2 className="t1dm-import-card-title" style={{ margin: 0 }}>
                  ผลการประมวลผลนำเข้าไฟล์ทะเบียน T1DM/GDM/PDM
                </h2>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {isProcessingQueue
                    ? 'กำลังดึงและประมวลผลข้อมูลจากไฟล์...'
                    : activeResultFile
                    ? `แสดงผลของไฟล์: ${activeResultFile.name}`
                    : `แสดงผลรวมทั้งหมด ${successfulFiles.length} ไฟล์`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <span className="t1dm-import-sum-sub">รวมทุกชีทที่ประมวลผล</span>
            </div>

            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">นำเข้าสำเร็จ (บันทึกลงฐานข้อมูล)</span>
              <span className="t1dm-import-sum-val green">
                {combinedMetrics.importedRows.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">
                {isDryRun ? 'โหมดทดสอบ (ยังไม่บันทึกจริง)' : 'บันทึกลง rcmdb.t1dm เรียบร้อย'}
              </span>
            </div>

            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">ข้ามรายการต่าง รพ.</span>
              <span className="t1dm-import-sum-val pink">
                {combinedMetrics.skippedOtherHosp.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">
                {filterMyHospOnly ? 'กรองเฉพาะ รพ.เถิน (11152)' : 'นำเข้าทั้งหมด'}
              </span>
            </div>

            <div className="t1dm-import-sum-card">
              <span className="t1dm-import-sum-label">จับคู่ HN ใน HOSxP สำเร็จ</span>
              <span className="t1dm-import-sum-val blue">
                {combinedMetrics.matchedHn.toLocaleString('th-TH')}
              </span>
              <span className="t1dm-import-sum-sub">พบเวชระเบียนในโรงพยาบาล</span>
            </div>
          </div>

          {/* Callout Link to Fund 2 */}
          <div className="t1dm-import-callout">
            <div className="t1dm-import-callout-left">
              <Info size={22} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <div className="t1dm-import-callout-title">
                  ข้อมูลทะเบียนได้รับการนำเข้าสู่ระบบเรียบร้อยแล้ว
                </div>
                <div className="t1dm-import-callout-desc">
                  ท่านสามารถตรวจสอบรายชื่อผู้รับบริการ, ตรวจสอบสถานะการลงทะเบียน (OK), PDX โรค O24
                  และติดตามยอดเงินชดเชยค่าบริการ ได้ที่หน้ารายงานกองทุน
                </div>
              </div>
            </div>

            <Link
              href="/service/dashboard-rcm/funds/t1dm-gdm-pdm/2"
              className="t1dm-import-btn primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem' }}
            >
              <ExternalLink size={14} />
              <span>เปิดหน้ารายชื่อผู้รับบริการ (กองทุน) →</span>
            </Link>
          </div>

          {/* Search Bar inside Preview */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.5rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ position: 'relative', minWidth: 260, maxWidth: 400 }}>
              <input
                type="search"
                placeholder="ค้นหาในรายการที่นำเข้า (RUN, PID, ชื่อ, ชนิด)..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 28px 6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8125rem',
                }}
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              แสดงตัวอย่าง {displayedPreviewRows.length} รายการ
            </div>
          </div>

          {/* Preview Table */}
          <div className="t1dm-import-table-wrap">
            <table className="t1dm-import-table">
              <thead>
                <tr>
                  <th style={{ width: 45 }}>ลำดับ</th>
                  <th style={{ minWidth: 85 }}>RUN (ID)</th>
                  <th style={{ minWidth: 70 }}>ปีงบ</th>
                  <th style={{ minWidth: 135 }}>เลขประจำตัวประชาชน (PID)</th>
                  <th style={{ minWidth: 85 }}>HN ใน HOSxP</th>
                  <th style={{ minWidth: 175 }}>ชื่อ-นามสกุล</th>
                  <th style={{ minWidth: 85 }}>ชนิด</th>
                  <th style={{ minWidth: 85 }}>สิทธิ</th>
                  <th style={{ minWidth: 200 }}>หน่วยบริการลงทะเบียน</th>
                  <th style={{ minWidth: 105 }}>วันที่ลงทะเบียน</th>
                  <th style={{ minWidth: 105 }}>วันที่รับบริการ</th>
                </tr>
              </thead>
              <tbody>
                {displayedPreviewRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      ไม่พบข้อมูลตัวอย่างที่ตรงกับคำค้นหา
                    </td>
                  </tr>
                ) : (
                  displayedPreviewRows.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className={row.isOtherHosp ? 'is-other-hosp' : ''}>
                      <td className="col-center t1dm-import-mono">{idx + 1}</td>
                      <td className="col-center t1dm-import-mono" style={{ fontWeight: 600 }}>
                        {row.id}
                      </td>
                      <td className="col-center t1dm-import-mono">{row.year || '—'}</td>
                      <td className="col-center t1dm-import-mono">{row.pid}</td>
                      <td className="col-center t1dm-import-mono">
                        {row.hn ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>{row.hn}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-center" style={{ fontWeight: 500 }}>
                        {row.ptname}
                      </td>
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
                      <td className="col-center">
                        <span
                          style={
                            row.isOtherHosp
                              ? { color: '#9f1239', fontWeight: 600 }
                              : undefined
                          }
                        >
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

      {/* ======================================================== */}
      {/* ── 5. Manage Imported Files Modal (History & Deletion) ── */}
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
              <h3 className="t1dm-modal-title">รายการไฟล์ที่นำเข้าในระบบ ({importedFiles.length} ไฟล์)</h3>
              <button
                type="button"
                onClick={() => setIsFilesModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="t1dm-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {importedFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  ยังไม่มีประวัติการนำเข้าไฟล์ในระบบ
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {importedFiles.map((file) => (
                    <div
                      key={file.fileName}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{file.fileName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                          จำนวน {file.rowCount.toLocaleString('th-TH')} รายการ
                          {file.otherHospCount > 0 && (
                            <span style={{ color: '#e11d48', marginLeft: 6 }}>
                              (ต่าง รพ. {file.otherHospCount})
                            </span>
                          )}
                          {file.minRegDate && (
                            <span style={{ marginLeft: 6 }}>
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

            <div className="t1dm-modal-footer">
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
      {/* ── 6. Delete Other Hospitals Confirmation Modal ── */}
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
                <AlertTriangle size={20} style={{ color: '#b91c1c' }} />
                <h3 className="t1dm-modal-title">ยืนยันการลบรายการต่าง รพ.?</h3>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setIsDeleteOtherHospModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="t1dm-modal-body">
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
                คำสั่งนี้เทียบเท่ากับคำสั่งใน FoxPro เดิม:
                <br />
                <code
                  style={{
                    display: 'block',
                    background: '#f1f5f9',
                    padding: '8px 12px',
                    borderRadius: 6,
                    marginTop: 6,
                    fontFamily: 'monospace',
                    color: '#0f172a',
                  }}
                >
                  delete from rcmdb.t1dm where hospmain &lt;&gt; &apos;{myHospCode}&apos;
                </code>
              </p>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 6,
                  fontSize: '0.8125rem',
                  color: '#9f1239',
                }}
              >
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
      {/* ── 7. Delete File Name Confirmation Modal ── */}
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
                <AlertTriangle size={20} style={{ color: '#b91c1c' }} />
                <h3 className="t1dm-modal-title">ยืนยันการลบข้อมูลตามไฟล์?</h3>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setFileToDelete(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
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
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  fontSize: '0.8125rem',
                  color: '#991b1b',
                }}
              >
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
    </div>
  )
}
