'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Film,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Minimize2,
  Paperclip,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
  Video,
  X,
  XCircle,
} from 'lucide-react'
import { ToastContainer, type ToastMessage } from '@/components/ui/Toast'
import { formatThaiBuddhistDateTime, formatThaiDate } from '@/lib/formatters'
import type {
  CategoryVisibility,
  MediaSourceType,
  MediaType,
  MediaVisibility,
  OnlineMediaCategoryRecord,
  OnlineMediaViewRecord,
  OnlineMediaViewerItem,
} from '@/lib/media/onlineMediaService'
import './online-media.css'

export interface OnlineMediaManageClientProps {
  initialCategories: OnlineMediaCategoryRecord[]
  initialItems: OnlineMediaViewerItem[]
}

interface AttachmentFormItem {
  id?: number
  title: string
  s3Bucket: string
  s3Key: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  displayOrder: number
}

interface MediaFormState {
  id?: number
  title: string
  description: string
  categoryId: number
  visibility: MediaVisibility
  mediaType: MediaType
  sourceType: MediaSourceType
  s3Bucket: string
  s3Key: string
  youtubeUrl: string
  thumbnailS3Key: string
  fileName: string
  fileSize: number | null
  mimeType: string
  allowDownload: boolean
  isPublished: boolean
  attachments: AttachmentFormItem[]
}

type UploadPhase =
  | 'initializing'
  | 'uploading'
  | 'completing'
  | 'completed'
  | 'error'
  | 'cancelled'

interface UploadTelemetryState {
  active: boolean
  target: 'primary' | 'thumbnail' | 'attachment'
  fileName: string
  totalBytes: number
  uploadedBytes: number
  percent: number
  currentPart: number
  totalParts: number
  speedBytesPerSec: number
  etaSeconds: number | null
  elapsedSeconds: number
  phase: UploadPhase
  message: string
}

const MULTIPART_THRESHOLD_BYTES = 20 * 1024 * 1024 // 20 MB
const CHUNK_SIZE_UNDER_1GB = 8 * 1024 * 1024 // 8 MB
const CHUNK_SIZE_OVER_1GB = 16 * 1024 * 1024 // 16 MB for 1GB-10GB files
const MAX_MEDIA_FILE_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDurationThai(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '-'
  const secs = Math.round(totalSeconds)
  if (secs < 60) return `${secs} วินาที`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  if (mins < 60) return `${mins} นาที ${remSecs} วินาที`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs} ชม. ${remMins} นาที`
}

function extractYoutubeEmbedPreview(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  if (!trimmed) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?rel=0&modestbranding=1`
  }
  const match = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1` : null
}

function sendXhrWithProgress(
  url: string,
  body: Document | XMLHttpRequestBodyInit,
  headers: Record<string, string>,
  onProgress: (loadedBytes: number) => void,
  onRegisterXhr: (xhr: XMLHttpRequest) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    onRegisterXhr(xhr)
    xhr.open('POST', url, true)
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v)
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        onProgress(evt.loaded)
      }
    }

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && parsed.success) {
          resolve(parsed)
        } else {
          reject(new Error(parsed.error || `Upload failed with status ${xhr.status}`))
        }
      } catch {
        reject(new Error(`Invalid server response (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายระหว่างอัปโหลด'))
    xhr.onabort = () => reject(new DOMException('Upload aborted by user', 'AbortError'))
    xhr.send(body)
  })
}

function uploadFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress: (loadedBytes: number) => void,
  onRegisterXhr: (xhr: XMLHttpRequest) => void
): Promise<any> {
  return sendXhrWithProgress(url, formData, {}, onProgress, onRegisterXhr)
}

function uploadBinaryChunkWithProgress(
  url: string,
  chunk: Blob,
  onProgress: (loadedBytes: number) => void,
  onRegisterXhr: (xhr: XMLHttpRequest) => void
): Promise<any> {
  return sendXhrWithProgress(
    url,
    chunk,
    { 'Content-Type': 'application/octet-stream' },
    onProgress,
    onRegisterXhr
  )
}

export default function OnlineMediaManageClient({
  initialCategories,
  initialItems,
}: OnlineMediaManageClientProps) {
  const [categories, setCategories] = useState<OnlineMediaCategoryRecord[]>(initialCategories)
  const [items, setItems] = useState<OnlineMediaViewerItem[]>(initialItems)
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items')

  // Filters
  const [filterVis, setFilterVis] = useState<'ALL' | MediaVisibility>('ALL')
  const [filterType, setFilterType] = useState<'ALL' | MediaType>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, message, type }])
  }
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Media Item Modal + Minimize state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isModalMinimized, setIsModalMinimized] = useState(false)
  const [isDraggingPrimary, setIsDraggingPrimary] = useState(false)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)

  // Quick category inline creator inside modal
  const [isQuickCatOpen, setIsQuickCatOpen] = useState(false)
  const [quickCatName, setQuickCatName] = useState('')
  const [isSavingQuickCat, setIsSavingQuickCat] = useState(false)

  const [itemForm, setItemForm] = useState<MediaFormState>(() => ({
    title: '',
    description: '',
    categoryId: initialCategories[0]?.id || 0,
    visibility: 'PUBLIC',
    mediaType: 'VIDEO',
    sourceType: 'MINIO',
    s3Bucket: '',
    s3Key: '',
    youtubeUrl: '',
    thumbnailS3Key: '',
    fileName: '',
    fileSize: null,
    mimeType: '',
    allowDownload: true,
    isPublished: true,
    attachments: [],
  }))
  const [isSavingItem, setIsSavingItem] = useState(false)

  // Real-Time Upload Telemetry
  const [telemetry, setTelemetry] = useState<UploadTelemetryState | null>(null)
  const [isUploadingThumb, setIsUploadingThumb] = useState(false)
  const [isUploadingAtt, setIsUploadingAtt] = useState(false)

  const activeXhrRef = useRef<XMLHttpRequest | null>(null)
  const abortRequestedRef = useRef(false)
  const activeMultipartContextRef = useRef<{
    uploadId: string
    bucket: string
    s3Key: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl && thumbnailPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailPreviewUrl)
      }
    }
  }, [thumbnailPreviewUrl])

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [catForm, setCatForm] = useState<{
    id?: number
    name: string
    visibility: CategoryVisibility
    displayOrder: number
    isActive: boolean
  }>({
    name: '',
    visibility: 'ALL',
    displayOrder: 0,
    isActive: true,
  })
  const [isSavingCat, setIsSavingCat] = useState(false)

  // Staff Viewers Modal
  const [viewerModalItem, setViewerModalItem] = useState<OnlineMediaViewerItem | null>(null)
  const [viewerList, setViewerList] = useState<OnlineMediaViewRecord[]>([])
  const [loadingViewers, setLoadingViewers] = useState(false)
  const [viewerSearch, setViewerSearch] = useState('')

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'item' | 'category'
    id: number
    label: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isAnyUploadActive = Boolean(telemetry?.active)

  const refreshData = async () => {
    try {
      const res = await fetch('/api/member/online-media', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        setCategories(json.data.categories)
        setItems(json.data.items)
      }
    } catch {
      addToast('ไม่สามารถรีเฟรชข้อมูลได้', 'error')
    }
  }

  const stats = useMemo(() => {
    return {
      total: items.length,
      publicCount: items.filter((i) => i.visibility === 'PUBLIC').length,
      internalCount: items.filter((i) => i.visibility === 'INTERNAL').length,
      totalViews: items.reduce((sum, i) => sum + i.viewCount, 0),
    }
  }, [items])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      if (filterVis !== 'ALL' && item.visibility !== filterVis) return false
      if (filterType !== 'ALL' && item.mediaType !== filterType) return false
      if (q) {
        const hay = `${item.title} ${item.categoryName || ''} ${item.createdByName || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, filterVis, filterType, searchQuery])

  const filteredViewers = useMemo(() => {
    const q = viewerSearch.trim().toLowerCase()
    if (!q) return viewerList
    return viewerList.filter(
      (v) =>
        v.memberName.toLowerCase().includes(q) ||
        (v.memberDepartment || '').toLowerCase().includes(q)
    )
  }, [viewerList, viewerSearch])

  const youtubePreviewEmbedUrl = useMemo(
    () => (itemForm.sourceType === 'YOUTUBE' ? extractYoutubeEmbedPreview(itemForm.youtubeUrl) : null),
    [itemForm.sourceType, itemForm.youtubeUrl]
  )

  const openCreateModal = () => {
    setItemForm({
      title: '',
      description: '',
      categoryId: categories[0]?.id || 0,
      visibility: 'PUBLIC',
      mediaType: 'VIDEO',
      sourceType: 'MINIO',
      s3Bucket: '',
      s3Key: '',
      youtubeUrl: '',
      thumbnailS3Key: '',
      fileName: '',
      fileSize: null,
      mimeType: '',
      allowDownload: true,
      isPublished: true,
      attachments: [],
    })
    setThumbnailPreviewUrl(null)
    setTelemetry(null)
    setIsQuickCatOpen(false)
    setIsModalMinimized(false)
    setIsItemModalOpen(true)
  }

  const openEditModal = async (item: OnlineMediaViewerItem) => {
    try {
      const res = await fetch(`/api/member/online-media/${item.id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.item) {
        addToast(json.error || 'ไม่สามารถโหลดข้อมูลสื่อได้', 'error')
        return
      }
      const raw = json.data.item
      setItemForm({
        id: raw.id,
        title: raw.title,
        description: raw.description || '',
        categoryId: raw.categoryId,
        visibility: raw.visibility,
        mediaType: raw.mediaType,
        sourceType: raw.sourceType,
        s3Bucket: raw.s3Bucket || '',
        s3Key: raw.s3Key || '',
        youtubeUrl: raw.youtubeUrl || '',
        thumbnailS3Key: raw.thumbnailS3Key || '',
        fileName: raw.fileName || '',
        fileSize: raw.fileSize ?? null,
        mimeType: raw.mimeType || '',
        allowDownload: raw.allowDownload,
        isPublished: raw.isPublished,
        attachments: (raw.attachments || []).map((a: any, idx: number) => ({
          id: a.id,
          title: a.title,
          s3Bucket: a.s3Bucket,
          s3Key: a.s3Key,
          fileName: a.fileName,
          fileSize: a.fileSize ?? null,
          mimeType: a.mimeType || null,
          displayOrder: a.displayOrder ?? idx,
        })),
      })
      setThumbnailPreviewUrl(item.thumbnailUrl)
      setTelemetry(null)
      setIsQuickCatOpen(false)
      setIsModalMinimized(false)
      setIsItemModalOpen(true)
    } catch {
      addToast('เกิดข้อผิดพลาดในการโหลดรายละเอียดสื่อ', 'error')
    }
  }

  const cancelActiveUpload = () => {
    abortRequestedRef.current = true
    if (activeXhrRef.current) {
      activeXhrRef.current.abort()
      activeXhrRef.current = null
    }
    const ctx = activeMultipartContextRef.current
    if (ctx) {
      fetch('/api/member/online-media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort', ...ctx }),
      }).catch(() => {})
      activeMultipartContextRef.current = null
    }
    setTelemetry((prev) =>
      prev
        ? {
            ...prev,
            active: false,
            phase: 'cancelled',
            message: 'ยกเลิกการอัปโหลดแล้ว',
          }
        : null
    )
    addToast('ยกเลิกการอัปโหลดไฟล์แล้ว', 'info')
  }

  const handlePrimaryFileUpload = async (file: File) => {
    if (isAnyUploadActive) {
      addToast('มีการอัปโหลดไฟล์กำลังทำงานอยู่ กรุณารอสักครู่หรือกดยกเลิกก่อน', 'warning')
      return
    }
    if (file.size > MAX_MEDIA_FILE_BYTES) {
      addToast('ขนาดไฟล์เกินกำหนด (สูงสุด 10GB)', 'error')
      return
    }

    abortRequestedRef.current = false
    activeMultipartContextRef.current = null
    const startedAt = Date.now()

    const updateProgressMetrics = (
      uploadedBytes: number,
      totalBytes: number,
      currentPart: number,
      totalParts: number,
      message: string,
      phase: UploadPhase = 'uploading'
    ) => {
      const elapsedSeconds = Math.max(0.2, (Date.now() - startedAt) / 1000)
      const speedBytesPerSec = uploadedBytes / elapsedSeconds
      const remainingBytes = Math.max(0, totalBytes - uploadedBytes)
      const etaSeconds = speedBytesPerSec > 0 ? remainingBytes / speedBytesPerSec : null
      const percent = totalBytes > 0 ? Math.min(99, Math.round((uploadedBytes / totalBytes) * 100)) : 0

      setTelemetry({
        active: true,
        target: 'primary',
        fileName: file.name,
        totalBytes,
        uploadedBytes,
        percent,
        currentPart,
        totalParts,
        speedBytesPerSec,
        etaSeconds,
        elapsedSeconds,
        phase,
        message,
      })
    }

    setTelemetry({
      active: true,
      target: 'primary',
      fileName: file.name,
      totalBytes: file.size,
      uploadedBytes: 0,
      percent: 0,
      currentPart: 0,
      totalParts: 1,
      speedBytesPerSec: 0,
      etaSeconds: null,
      elapsedSeconds: 0,
      phase: 'initializing',
      message: 'กำลังเตรียมการอัปโหลดไปยัง MinIO...',
    })

    // Auto-fill title if still blank
    setItemForm((prev) => ({
      ...prev,
      title: prev.title.trim() ? prev.title : file.name.replace(/\.[^.]+$/, ''),
    }))

    if (file.size <= MULTIPART_THRESHOLD_BYTES) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('visibility', itemForm.visibility)
        fd.append('kind', 'primary')

        const json = await uploadFormDataWithProgress(
          '/api/member/online-media/upload',
          fd,
          (loaded) => {
            updateProgressMetrics(
              Math.min(loaded, file.size),
              file.size,
              1,
              1,
              `กำลังส่งไฟล์ ${formatBytes(Math.min(loaded, file.size))} / ${formatBytes(file.size)}`
            )
          },
          (xhr) => {
            activeXhrRef.current = xhr
          }
        )

        activeXhrRef.current = null
        const uploaded = json.data
        setItemForm((prev) => ({
          ...prev,
          s3Bucket: uploaded.bucket,
          s3Key: uploaded.s3Key,
          fileName: file.name || uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        }))
        setTelemetry({
          active: false,
          target: 'primary',
          fileName: file.name,
          totalBytes: file.size,
          uploadedBytes: file.size,
          percent: 100,
          currentPart: 1,
          totalParts: 1,
          speedBytesPerSec: file.size / Math.max(0.5, (Date.now() - startedAt) / 1000),
          etaSeconds: 0,
          elapsedSeconds: (Date.now() - startedAt) / 1000,
          phase: 'completed',
          message: 'อัปโหลดขึ้น MinIO สำเร็จแล้ว พร้อมกดบันทึกข้อมูล',
        })
        addToast('อัปโหลดไฟล์สื่อขึ้น MinIO เรียบร้อยแล้ว', 'success')
      } catch (err: any) {
        activeXhrRef.current = null
        if (err?.name === 'AbortError' || abortRequestedRef.current) return
        setTelemetry((prev) =>
          prev
            ? {
                ...prev,
                active: false,
                phase: 'error',
                message: err.message || 'เกิดข้อผิดพลาดในการอัปโหลด',
              }
            : null
        )
        addToast(err.message || 'เกิดข้อผิดพลาดในการอัปโหลด', 'error')
      }
      return
    }

    // Chunked S3 Multipart Upload (> 20MB, up to 10GB)
    const chunkSize =
      file.size > 1024 * 1024 * 1024 ? CHUNK_SIZE_OVER_1GB : CHUNK_SIZE_UNDER_1GB
    let uploadContext: { uploadId: string; bucket: string; s3Key: string } | null = null

    try {
      const initRes = await fetch('/api/member/online-media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          visibility: itemForm.visibility,
          fileName: file.name,
          mimeType:
            file.type ||
            (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'video/mp4'),
          fileSize: file.size,
        }),
      })
      const initJson = await initRes.json()
      if (!initRes.ok || !initJson.success) {
        throw new Error(initJson.error || 'ไม่สามารถเริ่มต้น Multipart Upload ได้')
      }
      if (abortRequestedRef.current) return

      const initData = initJson.data
      uploadContext = {
        uploadId: initData.uploadId,
        bucket: initData.bucket,
        s3Key: initData.s3Key,
      }
      activeMultipartContextRef.current = uploadContext

      const totalParts = Math.ceil(file.size / chunkSize)
      const parts: Array<{ ETag: string; PartNumber: number }> = []
      let completedBytes = 0

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (abortRequestedRef.current) {
          throw new DOMException('Upload aborted', 'AbortError')
        }

        const start = (partNumber - 1) * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunkBlob = file.slice(start, end)
        const chunkLen = end - start

        let partJson: any = null
        let lastErr: Error | null = null

        for (let attempt = 1; attempt <= 3; attempt++) {
          if (abortRequestedRef.current) {
            throw new DOMException('Upload aborted', 'AbortError')
          }

          try {
            const partQuery = new URLSearchParams({
              action: 'part',
              uploadId: initData.uploadId,
              bucket: initData.bucket,
              s3Key: initData.s3Key,
              partNumber: String(partNumber),
            })

            partJson = await uploadBinaryChunkWithProgress(
              `/api/member/online-media/upload?${partQuery.toString()}`,
              chunkBlob,
              (chunkLoaded) => {
                const currentTotal = Math.min(file.size, completedBytes + Math.min(chunkLoaded, chunkLen))
                updateProgressMetrics(
                  currentTotal,
                  file.size,
                  partNumber,
                  totalParts,
                  `กำลังอัปโหลดส่วนที่ ${partNumber}/${totalParts}${attempt > 1 ? ` (ลองใหม่ครั้งที่ ${attempt})` : ''}`
                )
              },
              (xhr) => {
                activeXhrRef.current = xhr
              }
            )
            break
          } catch (err: any) {
            if (err?.name === 'AbortError' || abortRequestedRef.current) {
              throw err
            }
            lastErr = err
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 800 * attempt))
            }
          }
        }

        if (!partJson) {
          throw lastErr || new Error(`อัปโหลดส่วนที่ ${partNumber} ล้มเหลว`)
        }

        parts.push({
          ETag: partJson.data.eTag,
          PartNumber: partJson.data.partNumber,
        })
        completedBytes = end
      }

      activeXhrRef.current = null
      updateProgressMetrics(
        file.size,
        file.size,
        totalParts,
        totalParts,
        'กำลังรวมชิ้นส่วนไฟล์ทั้งหมดบน MinIO...',
        'completing'
      )

      const completeRes = await fetch('/api/member/online-media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          bucket: initData.bucket,
          s3Key: initData.s3Key,
          uploadId: initData.uploadId,
          parts,
        }),
      })
      const completeJson = await completeRes.json()
      if (!completeRes.ok || !completeJson.success) {
        throw new Error(completeJson.error || 'รวมไฟล์บน MinIO ไม่สำเร็จ')
      }

      activeMultipartContextRef.current = null
      setItemForm((prev) => ({
        ...prev,
        s3Bucket: initData.bucket,
        s3Key: initData.s3Key,
        fileName: file.name || initData.fileName,
        fileSize: file.size,
        mimeType: initData.mimeType,
      }))

      const elapsedSeconds = Math.max(0.5, (Date.now() - startedAt) / 1000)
      setTelemetry({
        active: false,
        target: 'primary',
        fileName: file.name,
        totalBytes: file.size,
        uploadedBytes: file.size,
        percent: 100,
        currentPart: totalParts,
        totalParts,
        speedBytesPerSec: file.size / elapsedSeconds,
        etaSeconds: 0,
        elapsedSeconds,
        phase: 'completed',
        message: 'อัปโหลดไฟล์ขึ้น MinIO สำเร็จแล้ว พร้อมกดบันทึกข้อมูล',
      })
      addToast('อัปโหลดไฟล์ขึ้น MinIO เรียบร้อยแล้ว', 'success')
    } catch (err: any) {
      activeXhrRef.current = null
      if (uploadContext) {
        fetch('/api/member/online-media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'abort', ...uploadContext }),
        }).catch(() => {})
        activeMultipartContextRef.current = null
      }
      if (err?.name === 'AbortError' || abortRequestedRef.current) return
      setTelemetry((prev) =>
        prev
          ? {
              ...prev,
              active: false,
              phase: 'error',
              message: err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ขนาดใหญ่',
            }
          : null
      )
      addToast(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ขนาดใหญ่', 'error')
    }
  }

  const handleThumbnailUpload = async (file: File) => {
    setIsUploadingThumb(true)
    const objectUrl = URL.createObjectURL(file)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('visibility', itemForm.visibility)
      fd.append('kind', 'thumbnail')

      const res = await fetch('/api/member/online-media/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'อัปโหลดภาพปกไม่สำเร็จ')
      }

      setThumbnailPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        return objectUrl
      })
      setItemForm((prev) => ({
        ...prev,
        thumbnailS3Key: json.data.s3Key,
        s3Bucket: prev.s3Bucket || json.data.bucket,
      }))
      addToast('อัปโหลดภาพหน้าปกสำเร็จ', 'success')
    } catch (err: any) {
      URL.revokeObjectURL(objectUrl)
      addToast(err.message || 'อัปโหลดภาพปกไม่สำเร็จ', 'error')
    } finally {
      setIsUploadingThumb(false)
    }
  }

  const handleAttachmentFilesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setIsUploadingAtt(true)
    try {
      for (const file of fileArray) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('visibility', itemForm.visibility)
        fd.append('kind', 'attachment')

        const res = await fetch('/api/member/online-media/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || `อัปโหลดไฟล์แนบ ${file.name} ไม่สำเร็จ`)
        }

        const uploaded = json.data
        setItemForm((prev) => ({
          ...prev,
          attachments: [
            ...prev.attachments,
            {
              title: file.name.replace(/\.[^.]+$/, ''),
              s3Bucket: uploaded.bucket,
              s3Key: uploaded.s3Key,
              fileName: file.name || uploaded.fileName,
              fileSize: uploaded.fileSize,
              mimeType: uploaded.mimeType,
              displayOrder: prev.attachments.length,
            },
          ],
        }))
      }
      addToast(`เพิ่มเอกสารแนบสำเร็จ ${fileArray.length} ไฟล์`, 'success')
    } catch (err: any) {
      addToast(err.message || 'อัปโหลดไฟล์แนบไม่สำเร็จ', 'error')
    } finally {
      setIsUploadingAtt(false)
    }
  }

  const handleQuickCreateCategory = async () => {
    const clean = quickCatName.trim()
    if (!clean || isSavingQuickCat) return
    setIsSavingQuickCat(true)
    try {
      const res = await fetch('/api/member/online-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_category',
          name: clean,
          visibility: 'ALL',
          displayOrder: categories.length + 1,
          isActive: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.category) {
        throw new Error(json.error || 'สร้างหมวดหมู่ไม่สำเร็จ')
      }
      const createdCat: OnlineMediaCategoryRecord = json.data.category
      setCategories((prev) => [...prev, createdCat])
      setItemForm((prev) => ({ ...prev, categoryId: createdCat.id }))
      setQuickCatName('')
      setIsQuickCatOpen(false)
      addToast(`เพิ่มหมวดหมู่ "${createdCat.name}" แล้ว`, 'success')
    } catch (err: any) {
      addToast(err.message || 'สร้างหมวดหมู่ไม่สำเร็จ', 'error')
    } finally {
      setIsSavingQuickCat(false)
    }
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSavingItem || isAnyUploadActive) return

    setIsSavingItem(true)
    try {
      const url = itemForm.id
        ? `/api/member/online-media/${itemForm.id}`
        : '/api/member/online-media'
      const method = itemForm.id ? 'PUT' : 'POST'

      const s3ExtMatch = (itemForm.s3Key || '').match(/(\.[a-zA-Z0-9]{1,10})$/)
      const s3Ext = s3ExtMatch ? s3ExtMatch[1].toLowerCase() : ''
      let normalizedFileName = itemForm.fileName.trim()
      if (normalizedFileName && s3Ext && !normalizedFileName.toLowerCase().endsWith(s3Ext)) {
        normalizedFileName = `${normalizedFileName}${s3Ext}`
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: itemForm.title,
          description: itemForm.description || null,
          categoryId: itemForm.categoryId,
          visibility: itemForm.visibility,
          mediaType: itemForm.mediaType,
          sourceType: itemForm.sourceType,
          s3Bucket: itemForm.s3Bucket || null,
          s3Key: itemForm.sourceType === 'MINIO' ? itemForm.s3Key || null : null,
          youtubeUrl: itemForm.sourceType === 'YOUTUBE' ? itemForm.youtubeUrl || null : null,
          thumbnailS3Key: itemForm.thumbnailS3Key || null,
          fileName: normalizedFileName || null,
          fileSize: itemForm.fileSize ?? null,
          mimeType: itemForm.mimeType || null,
          allowDownload: itemForm.allowDownload,
          isPublished: itemForm.isPublished,
          attachments: itemForm.attachments,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'บันทึกสื่อไม่สำเร็จ')
      }

      addToast(
        itemForm.id ? 'อัปเดตสื่อออนไลน์เรียบร้อยแล้ว' : 'เพิ่มสื่อออนไลน์ใหม่เรียบร้อยแล้ว',
        'success'
      )
      setIsItemModalOpen(false)
      setIsModalMinimized(false)
      setTelemetry(null)
      await refreshData()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingItem(false)
    }
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSavingCat) return
    setIsSavingCat(true)
    try {
      const res = await fetch('/api/member/online-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_category',
          ...catForm,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'บันทึกหมวดหมู่ไม่สำเร็จ')
      }
      addToast('บันทึกหมวดหมู่สื่อเรียบร้อยแล้ว', 'success')
      setIsCatModalOpen(false)
      await refreshData()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกหมวดหมู่', 'error')
    } finally {
      setIsSavingCat(false)
    }
  }

  const handleOpenViewers = async (item: OnlineMediaViewerItem) => {
    setViewerModalItem(item)
    setViewerSearch('')
    setLoadingViewers(true)
    try {
      const res = await fetch(`/api/member/online-media/${item.id}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.success) {
        setViewerList(json.data.viewers || [])
      }
    } catch {
      addToast('ไม่สามารถโหลดประวัติการรับชมได้', 'error')
    } finally {
      setLoadingViewers(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      const query = deleteTarget.type === 'category' ? '?type=category' : ''
      const res = await fetch(`/api/member/online-media/${deleteTarget.id}${query}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ลบรายการไม่สำเร็จ')
      }
      addToast(`ลบ "${deleteTarget.label}" เรียบร้อยแล้ว`, 'success')
      setDeleteTarget(null)
      await refreshData()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="container onlineMediaAdminPage">
      <div className="omTopNav">
        <Link href="/member" className="omBackBtn">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>กลับสู่แดชบอร์ดบุคลากร</span>
        </Link>
        <Link href="/media" className="omBackBtn">
          <ExternalLink size={16} aria-hidden="true" />
          <span>เปิดหน้าคลังสื่อออนไลน์</span>
        </Link>
      </div>

      <header className="omHeroHeader">
        <div>
          <h1>จัดการคลังสื่อออนไลน์</h1>
          <p>
            บริหารจัดการวิดีโอสตรีมมิงสูงสุด 10GB อินโฟกราฟิก เอกสาร PDF
            แยกสิทธิ์สื่อสาธารณะและสื่อภายในบุคลากร พร้อมประวัติการรับชมรายบุคคล
          </p>
        </div>

        <div className="omHeroActions">
          <button
            type="button"
            className="omBtn"
            onClick={() => {
              setCatForm({
                name: '',
                visibility: 'ALL',
                displayOrder: categories.length + 1,
                isActive: true,
              })
              setIsCatModalOpen(true)
            }}
          >
            <FolderOpen size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>เพิ่มหมวดหมู่</span>
          </button>
          <button type="button" className="omBtn omBtnPrimary" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>เพิ่มสื่อออนไลน์</span>
          </button>
        </div>
      </header>

      <section className="omStatsGrid" aria-label="สรุปสถิติคลังสื่อออนไลน์">
        <div className="omStatCard">
          <div className="omStatLabel">สื่อทั้งหมดในระบบ</div>
          <div className="omStatNum">{stats.total.toLocaleString()}</div>
          <div className="omStatMeta">รวมไฟล์บน MinIO และลิงก์ YouTube</div>
        </div>
        <div className="omStatCard">
          <div className="omStatLabel">สื่อสาธารณะ</div>
          <div className="omStatNum">{stats.publicCount.toLocaleString()}</div>
          <div className="omStatMeta">Bucket public-assets · ไม่ต้องล็อกอิน</div>
        </div>
        <div className="omStatCard">
          <div className="omStatLabel">สื่อภายในบุคลากร</div>
          <div className="omStatNum">{stats.internalCount.toLocaleString()}</div>
          <div className="omStatMeta">Bucket private-documents · ต้องล็อกอิน</div>
        </div>
        <div className="omStatCard">
          <div className="omStatLabel">ยอดเข้าชมสะสม</div>
          <div className="omStatNum omStatNumAccent">{stats.totalViews.toLocaleString()}</div>
          <div className="omStatMeta">นับรวมการเปิดรับชมทุกช่องทาง (ครั้ง)</div>
        </div>
      </section>

      <div className="omTabsBar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'items'}
          className={`omTabBtn ${activeTab === 'items' ? 'active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          <PlayCircle size={18} aria-hidden="true" />
          <span>รายการสื่อออนไลน์ ({items.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'categories'}
          className={`omTabBtn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <FolderOpen size={18} aria-hidden="true" />
          <span>หมวดหมู่สื่อ ({categories.length})</span>
        </button>
      </div>

      {activeTab === 'items' ? (
        <>
          <div className="omToolbar">
            <div className="omToolbarGroup" style={{ flex: '1 1 260px', maxWidth: 380 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  className="omInput"
                  style={{ paddingLeft: '2.2rem' }}
                  placeholder="ค้นหาชื่อสื่อ หมวดหมู่ หรือผู้สร้าง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="omToolbarGroup">
              <select
                className="omSelect"
                style={{ width: 'auto' }}
                value={filterVis}
                onChange={(e) => setFilterVis(e.target.value as 'ALL' | MediaVisibility)}
                aria-label="กรองตามสิทธิ์การเข้าชม"
              >
                <option value="ALL">ทุกขอบเขตสิทธิ์</option>
                <option value="PUBLIC">สื่อสาธารณะ</option>
                <option value="INTERNAL">สื่อภายในบุคลากร</option>
              </select>

              <select
                className="omSelect"
                style={{ width: 'auto' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'ALL' | MediaType)}
                aria-label="กรองตามประเภทสื่อ"
              >
                <option value="ALL">ทุกประเภทสื่อ</option>
                <option value="VIDEO">วิดีโอ</option>
                <option value="INFOGRAPHIC">อินโฟกราฟิก</option>
                <option value="DOCUMENT">เอกสาร PDF</option>
              </select>
            </div>
          </div>

          <div className="omTableCard">
            <table className="omTable">
              <thead>
                <tr>
                  <th>หัวข้อสื่อ / หมวดหมู่</th>
                  <th>สิทธิ์การเข้าถึง</th>
                  <th>แหล่งจัดเก็บ / ขนาด</th>
                  <th>ดาวน์โหลด / สถานะ</th>
                  <th className="omNumCol">การเข้าชม</th>
                  <th>วันที่สร้าง (พ.ศ.)</th>
                  <th style={{ textAlign: 'right' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="omEmptyCell">
                      ไม่พบรายการสื่อออนไลน์
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="omItemCell">
                          <div className="omItemThumb">
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt="" />
                            ) : item.mediaType === 'VIDEO' ? (
                              <PlayCircle size={18} strokeWidth={1.5} />
                            ) : item.mediaType === 'INFOGRAPHIC' ? (
                              <ImageIcon size={18} strokeWidth={1.5} />
                            ) : (
                              <FileText size={18} strokeWidth={1.5} />
                            )}
                          </div>
                          <div>
                            <div className="omItemTitle">{item.title}</div>
                            <div className="omItemSub">
                              {item.categoryName || 'ไม่ระบุหมวดหมู่'}
                              {item.attachments.length > 0 && ` · แนบเสริม ${item.attachments.length}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`omBadge ${
                            item.visibility === 'INTERNAL' ? 'omBadgeInternal' : 'omBadgePublic'
                          }`}
                        >
                          {item.visibility === 'INTERNAL' ? (
                            <>
                              <Lock size={12} strokeWidth={1.5} />
                              <span>เฉพาะบุคลากร</span>
                            </>
                          ) : (
                            <>
                              <Globe size={12} strokeWidth={1.5} />
                              <span>สาธารณะ</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="omSourceStack">
                          <span className="omSourcePrimary">
                            {item.sourceType === 'YOUTUBE' ? (
                              <>
                                <Video size={14} strokeWidth={1.5} />
                                <span>YouTube</span>
                              </>
                            ) : (
                              <span>MinIO · {item.mediaType}</span>
                            )}
                          </span>
                          <span className="omSourceSub">
                            {item.sourceType === 'MINIO' ? formatBytes(item.fileSize) : 'ลิงก์ภายนอก'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="omBadgeStack">
                          <span className={`omBadge ${item.isPublished ? 'omBadgePublic' : 'omBadgeDraft'}`}>
                            {item.isPublished ? 'เผยแพร่แล้ว' : 'ซ่อน (ร่าง)'}
                          </span>
                          {item.sourceType === 'MINIO' && (
                            <span className={`omBadge ${item.allowDownload ? 'omBadgePublic' : 'omBadgeWarn'}`}>
                              {item.allowDownload ? 'ดาวน์โหลดได้' : 'ปิดดาวน์โหลด'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="omNumCol">
                        <button
                          type="button"
                          className="omViewCountBtn"
                          onClick={() => handleOpenViewers(item)}
                          title="คลิกดูรายชื่อบุคลากรที่เข้าชมแล้ว"
                        >
                          <Users size={14} strokeWidth={1.5} />
                          <span>{item.viewCount.toLocaleString()}</span>
                        </button>
                      </td>
                      <td className="omDateCol">{formatThaiDate(item.createdAt)}</td>
                      <td>
                        <div className="omRowActions" style={{ justifyContent: 'flex-end' }}>
                          <Link
                            href={`/media/${encodeURIComponent(item.slug)}`}
                            target="_blank"
                            className="omIconBtn"
                            title="เปิดหน้าแสดงผล"
                          >
                            <ExternalLink size={15} />
                          </Link>
                          <button
                            type="button"
                            className="omIconBtn"
                            onClick={() => openEditModal(item)}
                            title="แก้ไขสื่อ"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="omIconBtn omIconBtnDanger"
                            onClick={() =>
                              setDeleteTarget({ type: 'item', id: item.id, label: item.title })
                            }
                            title="ลบสื่อ"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="omTableCard">
          <table className="omTable">
            <thead>
              <tr>
                <th>ชื่อหมวดหมู่</th>
                <th>ขอบเขตที่แสดง</th>
                <th className="omNumCol">ลำดับ</th>
                <th className="omNumCol">จำนวนสื่อ</th>
                <th>สถานะ</th>
                <th style={{ textAlign: 'right' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 600 }}>{cat.name}</td>
                  <td>
                    <span
                      className={`omBadge ${
                        cat.visibility === 'INTERNAL'
                          ? 'omBadgeInternal'
                          : cat.visibility === 'PUBLIC'
                          ? 'omBadgePublic'
                          : 'omBadgeDraft'
                      }`}
                    >
                      {cat.visibility === 'INTERNAL'
                        ? 'เฉพาะบุคลากร'
                        : cat.visibility === 'PUBLIC'
                        ? 'สาธารณะ'
                        : 'ทั้งหมด (สาธารณะ + ภายใน)'}
                    </span>
                  </td>
                  <td className="omNumCol">{cat.displayOrder}</td>
                  <td className="omNumCol">{cat.itemCount ?? 0} รายการ</td>
                  <td>
                    <span className={`omBadge ${cat.isActive ? 'omBadgePublic' : 'omBadgeDraft'}`}>
                      {cat.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td>
                    <div className="omRowActions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="omIconBtn"
                        onClick={() => {
                          setCatForm({
                            id: cat.id,
                            name: cat.name,
                            visibility: cat.visibility,
                            displayOrder: cat.displayOrder,
                            isActive: cat.isActive,
                          })
                          setIsCatModalOpen(true)
                        }}
                        title="แก้ไขหมวดหมู่"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="omIconBtn omIconBtnDanger"
                        onClick={() =>
                          setDeleteTarget({ type: 'category', id: cat.id, label: cat.name })
                        }
                        title="ลบหมวดหมู่"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Media Item Modal (2-Column UX + Real-Time Multi-GB Upload Telemetry) */}
      {isItemModalOpen && !isModalMinimized && (
        <div
          className="omModalOverlay"
          onClick={() => !isSavingItem && !isAnyUploadActive && setIsItemModalOpen(false)}
        >
          <div className="omModalDialog omModalDialogWide" onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <div>
                <h2>{itemForm.id ? 'แก้ไขรายละเอียดสื่อออนไลน์' : 'เพิ่มสื่อออนไลน์ใหม่'}</h2>
                <div className="omModalHeaderSub">
                  กรอกข้อมูลรายละเอียดและอัปโหลดไฟล์สื่อขึ้น MinIO ได้ในหน้าต่างเดียว (รองรับขนาดใหญ่สูงสุด 10GB)
                </div>
              </div>
              <div className="omModalHeaderActions">
                <button
                  type="button"
                  className="omBtn omBtnCompact"
                  onClick={() => setIsModalMinimized(true)}
                  title="ย่อหน้าต่างลงมุมขวาล่างระหว่างอัปโหลด"
                >
                  <Minimize2 size={14} />
                  <span>ย่อหน้าต่าง</span>
                </button>
                <button
                  type="button"
                  className="omIconBtn"
                  onClick={() => {
                    if (isAnyUploadActive) {
                      setIsModalMinimized(true)
                    } else if (!isSavingItem) {
                      setIsItemModalOpen(false)
                    }
                  }}
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSaveItem}
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div className="omModalBody">
                <div className="omModalTwoCol">
                  {/* Left Column: Metadata & Access Rules */}
                  <div className="omModalCol">
                    <div className="omSectionCard">
                      <div className="omSectionTitle">
                        <Lock size={15} />
                        <span>1. ขอบเขตการเข้าถึงและประเภทสื่อ</span>
                      </div>

                      <div className="omFieldGroup">
                        <span className="omLabel">ใครสามารถเข้าชมสื่อนี้ได้ *</span>
                        <div className="omChoiceGrid">
                          <button
                            type="button"
                            disabled={isAnyUploadActive}
                            className={`omChoiceCard ${
                              itemForm.visibility === 'PUBLIC' ? 'active' : ''
                            }`}
                            onClick={() => setItemForm((p) => ({ ...p, visibility: 'PUBLIC' }))}
                          >
                            <span className="omChoiceHead">
                              <Globe size={15} strokeWidth={1.5} />
                              <span>สื่อสาธารณะ</span>
                            </span>
                            <span className="omChoiceDesc">
                              ประชาชนดูได้ไม่ต้องล็อกอิน (MinIO public-assets)
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isAnyUploadActive}
                            className={`omChoiceCard ${
                              itemForm.visibility === 'INTERNAL' ? 'active' : ''
                            }`}
                            onClick={() => setItemForm((p) => ({ ...p, visibility: 'INTERNAL' }))}
                          >
                            <span className="omChoiceHead">
                              <Lock size={15} strokeWidth={1.5} />
                              <span>เฉพาะบุคลากร</span>
                            </span>
                            <span className="omChoiceDesc">
                              ต้องล็อกอิน /member ก่อน (MinIO private-documents)
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="omFieldGroup">
                        <span className="omLabel">ประเภทสื่อ *</span>
                        <div className="omChoiceGridThree">
                          <button
                            type="button"
                            className={`omChoiceCard ${
                              itemForm.mediaType === 'VIDEO' ? 'active' : ''
                            }`}
                            onClick={() => setItemForm((p) => ({ ...p, mediaType: 'VIDEO' }))}
                          >
                            <span className="omChoiceHead">
                              <PlayCircle size={15} />
                              <span>วิดีโอ</span>
                            </span>
                            <span className="omChoiceDesc">MP4 / WebM / YT</span>
                          </button>

                          <button
                            type="button"
                            className={`omChoiceCard ${
                              itemForm.mediaType === 'INFOGRAPHIC' ? 'active' : ''
                            }`}
                            onClick={() =>
                              setItemForm((p) => ({
                                ...p,
                                mediaType: 'INFOGRAPHIC',
                                sourceType: 'MINIO',
                              }))
                            }
                          >
                            <span className="omChoiceHead">
                              <ImageIcon size={15} />
                              <span>อินโฟกราฟิก</span>
                            </span>
                            <span className="omChoiceDesc">JPG / PNG / WebP</span>
                          </button>

                          <button
                            type="button"
                            className={`omChoiceCard ${
                              itemForm.mediaType === 'DOCUMENT' ? 'active' : ''
                            }`}
                            onClick={() =>
                              setItemForm((p) => ({
                                ...p,
                                mediaType: 'DOCUMENT',
                                sourceType: 'MINIO',
                              }))
                            }
                          >
                            <span className="omChoiceHead">
                              <FileText size={15} />
                              <span>เอกสาร PDF</span>
                            </span>
                            <span className="omChoiceDesc">คู่มือ / E-Book</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="omSectionCard">
                      <div className="omSectionTitle">
                        <FileText size={15} />
                        <span>2. รายละเอียดสื่อ</span>
                      </div>

                      <div className="omFieldGroup">
                        <label className="omLabel" htmlFor="om-title">
                          หัวข้อสื่อ *
                        </label>
                        <input
                          id="om-title"
                          type="text"
                          required
                          className="omInput"
                          value={itemForm.title}
                          onChange={(e) => setItemForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="เช่น แนวทางการดูแลผู้ป่วยเบาหวาน หรือ คลิปอบรมความปลอดภัย IT"
                        />
                      </div>

                      <div className="omFieldGroup">
                        <label className="omLabel" htmlFor="om-category">
                          หมวดหมู่สื่อ *
                        </label>
                        <div className="omCategoryRow">
                          <select
                            id="om-category"
                            className="omSelect"
                            value={itemForm.categoryId}
                            onChange={(e) =>
                              setItemForm((p) => ({ ...p, categoryId: Number(e.target.value) }))
                            }
                            required
                          >
                            {categories.length === 0 && (
                              <option value={0}>ยังไม่มีหมวดหมู่ กรุณาเพิ่มหมวดหมู่</option>
                            )}
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="omBtn omBtnCompact"
                            style={{ whiteSpace: 'nowrap' }}
                            onClick={() => setIsQuickCatOpen((v) => !v)}
                          >
                            <Plus size={14} />
                            <span>หมวดใหม่</span>
                          </button>
                        </div>

                        {isQuickCatOpen && (
                          <div className="omQuickCatBox">
                            <input
                              type="text"
                              className="omInput"
                              placeholder="ชื่อหมวดหมู่ใหม่..."
                              value={quickCatName}
                              onChange={(e) => setQuickCatName(e.target.value)}
                            />
                            <button
                              type="button"
                              className="omBtn omBtnPrimary omBtnCompact"
                              onClick={handleQuickCreateCategory}
                              disabled={isSavingQuickCat || !quickCatName.trim()}
                            >
                              {isSavingQuickCat ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="omFieldGroup">
                        <label className="omLabel" htmlFor="om-desc">
                          คำอธิบาย / เนื้อหาประกอบ
                        </label>
                        <textarea
                          id="om-desc"
                          rows={4}
                          className="omTextarea"
                          value={itemForm.description}
                          onChange={(e) =>
                            setItemForm((p) => ({ ...p, description: e.target.value }))
                          }
                          placeholder="รายละเอียดเนื้อหา วัตถุประสงค์ หรือคำแนะนำในการรับชม..."
                        />
                      </div>
                    </div>

                    <div className="omFieldRow">
                      <label className="omCheckRow">
                        <input
                          type="checkbox"
                          checked={itemForm.allowDownload}
                          onChange={(e) =>
                            setItemForm((p) => ({ ...p, allowDownload: e.target.checked }))
                          }
                        />
                        <span>อนุญาตให้ดาวน์โหลดไฟล์</span>
                      </label>

                      <label className="omCheckRow">
                        <input
                          type="checkbox"
                          checked={itemForm.isPublished}
                          onChange={(e) =>
                            setItemForm((p) => ({ ...p, isPublished: e.target.checked }))
                          }
                        />
                        <span>เผยแพร่บนคลังสื่อทันที</span>
                      </label>
                    </div>
                  </div>

                  {/* Right Column: File Upload / YouTube + Real-Time Telemetry + Cover & Attachments */}
                  <div className="omModalCol">
                    <div className="omSectionCard">
                      <div className="omSectionTitle">
                        <Upload size={15} />
                        <span>3. แหล่งไฟล์สื่อหลักและสถานะการอัปโหลด</span>
                      </div>

                      {itemForm.mediaType === 'VIDEO' && (
                        <div className="omChoiceGrid">
                          <button
                            type="button"
                            disabled={isAnyUploadActive}
                            className={`omChoiceCard ${
                              itemForm.sourceType === 'MINIO' ? 'active' : ''
                            }`}
                            onClick={() => setItemForm((p) => ({ ...p, sourceType: 'MINIO' }))}
                          >
                            <span className="omChoiceHead">
                              <Upload size={15} />
                              <span>อัปโหลดขึ้น MinIO</span>
                            </span>
                            <span className="omChoiceDesc">สตรีมตรงจากเซิร์ฟเวอร์ รพ. (สูงสุด 10GB)</span>
                          </button>

                          <button
                            type="button"
                            disabled={isAnyUploadActive}
                            className={`omChoiceCard ${
                              itemForm.sourceType === 'YOUTUBE' ? 'active' : ''
                            }`}
                            onClick={() => setItemForm((p) => ({ ...p, sourceType: 'YOUTUBE' }))}
                          >
                            <span className="omChoiceHead">
                              <Video size={15} color="#dc2626" />
                              <span>ลิงก์ YouTube</span>
                            </span>
                            <span className="omChoiceDesc">รองรับโหมด Unlisted / ไม่เป็นสาธารณะ</span>
                          </button>
                        </div>
                      )}

                      {itemForm.sourceType === 'YOUTUBE' ? (
                        <div className="omFieldGroup">
                          <label className="omLabel" htmlFor="om-youtube">
                            ลิงก์ YouTube หรือ Video ID *
                          </label>
                          <input
                            id="om-youtube"
                            type="text"
                            required
                            className="omInput"
                            value={itemForm.youtubeUrl}
                            onChange={(e) =>
                              setItemForm((p) => ({ ...p, youtubeUrl: e.target.value }))
                            }
                            placeholder="https://www.youtube.com/watch?v=... หรือ https://youtu.be/..."
                          />
                          <span className="omHint">
                            สำหรับคลิปภายใน แนะนำให้ตั้งค่าคลิป YouTube เป็นโหมด &quot;ไม่เป็นสาธารณะ (Unlisted)&quot; แล้วเลือกขอบเขตเป็น &quot;เฉพาะบุคลากร&quot;
                          </span>

                          {youtubePreviewEmbedUrl && (
                            <div className="omYoutubePreviewFrame">
                              <iframe
                                src={youtubePreviewEmbedUrl}
                                title="YouTube Preview"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <label
                            className={`omDropzone ${isDraggingPrimary ? 'dragging' : ''}`}
                            onDragOver={(e) => {
                              e.preventDefault()
                              setIsDraggingPrimary(true)
                            }}
                            onDragLeave={() => setIsDraggingPrimary(false)}
                            onDrop={(e) => {
                              e.preventDefault()
                              setIsDraggingPrimary(false)
                              const f = e.dataTransfer.files?.[0]
                              if (f) handlePrimaryFileUpload(f)
                            }}
                          >
                            <div className="omDropzoneIcon">
                              <Upload size={20} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                              {itemForm.s3Key
                                ? 'ลากไฟล์ใหม่มาวาง หรือคลิกเพื่อเปลี่ยนไฟล์'
                                : 'ลากไฟล์มาวางที่นี่ หรือคลิกเลือกไฟล์'}
                            </div>
                            <div className="omHint">
                              {itemForm.mediaType === 'VIDEO'
                                ? 'รองรับ .mp4, .webm, .mov, .m4v, .mkv ขนาดใหญ่ได้มากกว่า 1GB (สูงสุด 10GB) แบ่งอัปโหลดอัตโนมัติ'
                                : itemForm.mediaType === 'INFOGRAPHIC'
                                ? 'รองรับ .jpg, .png, .webp, .gif ขนาดสูงสุด 25MB'
                                : 'รองรับไฟล์ .pdf ขนาดสูงสุด 10GB (ไฟล์เกิน 20MB แบ่งอัปโหลดอัตโนมัติ)'}
                            </div>
                            <input
                              type="file"
                              hidden
                              disabled={isAnyUploadActive}
                              accept={
                                itemForm.mediaType === 'VIDEO'
                                  ? 'video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v,.mkv'
                                  : itemForm.mediaType === 'INFOGRAPHIC'
                                  ? 'image/jpeg,image/png,image/webp,image/gif'
                                  : 'application/pdf,.pdf'
                              }
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handlePrimaryFileUpload(f)
                                e.target.value = ''
                              }}
                            />
                          </label>

                          {telemetry && (
                            <div
                              className={`omTelemetryCard ${
                                telemetry.phase === 'completed'
                                  ? 'isDone'
                                  : telemetry.phase === 'error'
                                  ? 'isError'
                                  : ''
                              }`}
                            >
                              <div className="omTelemetryHeader">
                                <div className="omTelemetryTitle" title={telemetry.fileName}>
                                  {telemetry.fileName}
                                </div>
                                <span className="omTelemetryPercent">{telemetry.percent}%</span>
                              </div>

                              <div className="omStepsPipeline">
                                <div
                                  className={`omStepItem ${
                                    telemetry.phase === 'initializing' ? 'current' : 'done'
                                  }`}
                                >
                                  <span>1. เตรียมอัปโหลด</span>
                                </div>
                                <div
                                  className={`omStepItem ${
                                    telemetry.phase === 'uploading'
                                      ? 'current'
                                      : telemetry.phase === 'completing' ||
                                        telemetry.phase === 'completed'
                                      ? 'done'
                                      : ''
                                  }`}
                                >
                                  <span>2. ส่งชิ้นส่วน</span>
                                </div>
                                <div
                                  className={`omStepItem ${
                                    telemetry.phase === 'completing'
                                      ? 'current'
                                      : telemetry.phase === 'completed'
                                      ? 'done'
                                      : ''
                                  }`}
                                >
                                  <span>3. รวมไฟล์ MinIO</span>
                                </div>
                                <div
                                  className={`omStepItem ${
                                    telemetry.phase === 'completed' ? 'done' : ''
                                  }`}
                                >
                                  <span>4. เสร็จสมบูรณ์</span>
                                </div>
                              </div>

                              <div className="omProgressBar">
                                <div
                                  className="omProgressFill"
                                  style={{ width: `${telemetry.percent}%` }}
                                />
                              </div>

                              <div className="omTelemetryMetrics">
                                <div className="omMetricBox">
                                  <div className="omMetricLabel">ปริมาณข้อมูลที่ส่งแล้ว</div>
                                  <div className="omMetricValue">
                                    {formatBytes(telemetry.uploadedBytes)} /{' '}
                                    {formatBytes(telemetry.totalBytes)}
                                  </div>
                                </div>
                                <div className="omMetricBox">
                                  <div className="omMetricLabel">ความเร็ว & เวลาที่เหลือ (ETA)</div>
                                  <div className="omMetricValue">
                                    {telemetry.speedBytesPerSec > 0
                                      ? `${formatBytes(telemetry.speedBytesPerSec)}/s · ${formatDurationThai(telemetry.etaSeconds)}`
                                      : telemetry.message}
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span className="omHint">
                                  {telemetry.message}
                                  {telemetry.totalParts > 1 &&
                                    ` (ส่วนที่ ${telemetry.currentPart}/${telemetry.totalParts})`}
                                </span>

                                {telemetry.active && (
                                  <button
                                    type="button"
                                    className="omBtn omBtnDangerOutline omBtnCompact"
                                    onClick={cancelActiveUpload}
                                  >
                                    <XCircle size={14} />
                                    <span>ยกเลิกอัปโหลด</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {itemForm.s3Key && !telemetry?.active && (
                            <div className="omUploadedFileCard" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <CheckCircle2 size={18} color="#0d7446" style={{ flexShrink: 0 }} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: '0.84rem',
                                      fontWeight: 600,
                                      color: '#065f46',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {itemForm.fileName || itemForm.s3Key}
                                  </div>
                                  <div className="omHint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    ขนาด {formatBytes(itemForm.fileSize)} · Bucket{' '}
                                    {itemForm.s3Bucket ||
                                      (itemForm.visibility === 'INTERNAL'
                                        ? 'private-documents'
                                        : 'public-assets')}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid rgba(13, 116, 70, 0.18)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <label htmlFor="om-download-filename" className="omLabel" style={{ fontSize: '0.78rem', margin: 0 }}>
                                    ชื่อไฟล์เมื่อผู้ชมกดดาวน์โหลด
                                  </label>
                                  {itemForm.title.trim() && (
                                    <button
                                      type="button"
                                      className="omBtn omBtnCompact"
                                      style={{ minHeight: 26, padding: '0 8px', fontSize: '0.74rem' }}
                                      onClick={() => {
                                        const extMatch = (itemForm.fileName || itemForm.s3Key).match(/(\.[a-zA-Z0-9]{1,10})$/)
                                        const ext = extMatch ? extMatch[1].toLowerCase() : ''
                                        const safeBase = itemForm.title.trim().replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
                                        setItemForm((p) => ({
                                          ...p,
                                          fileName: `${safeBase}${ext}`,
                                        }))
                                      }}
                                    >
                                      ใช้ชื่อตามหัวข้อสื่อ
                                    </button>
                                  )}
                                </div>
                                <input
                                  id="om-download-filename"
                                  type="text"
                                  className="omInput"
                                  value={itemForm.fileName}
                                  onChange={(e) =>
                                    setItemForm((p) => ({ ...p, fileName: e.target.value }))
                                  }
                                  placeholder="ระบุชื่อไฟล์สำหรับดาวน์โหลด..."
                                />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Thumbnail Preview & Upload */}
                    <div className="omSectionCard">
                      <div className="omSectionTitle">
                        <ImageIcon size={15} />
                        <span>4. ภาพหน้าปกสื่อ (Thumbnail - ไม่บังคับ)</span>
                      </div>

                      <div className="omThumbPreviewBox">
                        {thumbnailPreviewUrl ? (
                          <img
                            src={thumbnailPreviewUrl}
                            alt="Thumbnail preview"
                            className="omThumbPreviewImg"
                          />
                        ) : (
                          <div
                            className="omThumbPreviewImg"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                            }}
                          >
                            <ImageIcon size={20} />
                          </div>
                        )}

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div className="omHint">
                            {itemForm.thumbnailS3Key
                              ? 'อัปโหลดภาพปกแล้ว'
                              : 'รองรับ JPG, PNG, WebP ขนาดไม่เกิน 10MB'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <label className="omBtn omBtnCompact" style={{ cursor: 'pointer' }}>
                              {isUploadingThumb ? <RefreshCw size={14} /> : <Upload size={14} />}
                              <span>{isUploadingThumb ? 'กำลังอัปโหลด...' : 'เลือกภาพปก'}</span>
                              <input
                                type="file"
                                hidden
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                disabled={isUploadingThumb}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleThumbnailUpload(f)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                            {itemForm.thumbnailS3Key && (
                              <button
                                type="button"
                                className="omBtn omBtnCompact"
                                onClick={() => {
                                  setThumbnailPreviewUrl(null)
                                  setItemForm((p) => ({ ...p, thumbnailS3Key: '' }))
                                }}
                              >
                                ล้างภาพปก
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Supplementary Attachments */}
                    <div className="omSectionCard">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div className="omSectionTitle">
                          <Paperclip size={15} />
                          <span>5. เอกสาร / ภาพประกอบเพิ่มเติม</span>
                        </div>

                        <label className="omBtn omBtnCompact" style={{ cursor: 'pointer' }}>
                          {isUploadingAtt ? <RefreshCw size={14} /> : <Plus size={14} />}
                          <span>{isUploadingAtt ? 'กำลังอัปโหลด...' : 'แนบไฟล์เสริม'}</span>
                          <input
                            type="file"
                            hidden
                            multiple
                            accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                            disabled={isUploadingAtt}
                            onChange={(e) => {
                              if (e.target.files) handleAttachmentFilesUpload(e.target.files)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      </div>

                      {itemForm.attachments.length === 0 ? (
                        <div className="omHint">
                          แนบไฟล์ PDF สไลด์บรรยายหรือใบงานประกอบเพื่อให้ดูควบคู่กับคลิปได้ (เลือกได้หลายไฟล์)
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {itemForm.attachments.map((att, idx) => (
                            <div
                              key={`${att.s3Key}-${idx}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#ffffff',
                                padding: '0.45rem 0.65rem',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <input
                                type="text"
                                className="omInput"
                                value={att.title}
                                onChange={(e) => {
                                  const nextTitle = e.target.value
                                  const extMatch = (att.fileName || att.s3Key).match(/(\.[a-zA-Z0-9]{1,10})$/)
                                  const ext = extMatch ? extMatch[1].toLowerCase() : ''
                                  const nextFileName = nextTitle.trim()
                                    ? `${nextTitle.trim().replace(/[\\/:*?"<>|\r\n\t]+/g, '_')}${ext}`
                                    : att.fileName
                                  setItemForm((p) => ({
                                    ...p,
                                    attachments: p.attachments.map((a, i) =>
                                      i === idx ? { ...a, title: nextTitle, fileName: nextFileName } : a
                                    ),
                                  }))
                                }}
                                aria-label="ชื่อไฟล์แนบ"
                              />
                              <span
                                className="omHint"
                                style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {formatBytes(att.fileSize)}
                              </span>
                              <button
                                type="button"
                                className="omIconBtn omIconBtnDanger"
                                onClick={() =>
                                  setItemForm((p) => ({
                                    ...p,
                                    attachments: p.attachments.filter((_, i) => i !== idx),
                                  }))
                                }
                                aria-label="ลบไฟล์แนบ"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="omModalFooter">
                <div className="omHint">
                  {isAnyUploadActive
                    ? 'กำลังอัปโหลดไฟล์อยู่ สามารถกรอกรายละเอียดหรือกดย่อหน้าต่างระหว่างรอได้'
                    : 'เมื่อบันทึกแล้ว สื่อจะแสดงตามขอบเขตสิทธิ์ที่เลือกทันที'}
                </div>
                <div className="omModalFooterActions">
                  <button
                    type="button"
                    className="omBtn"
                    onClick={() => {
                      if (isAnyUploadActive) {
                        setIsModalMinimized(true)
                      } else {
                        setIsItemModalOpen(false)
                      }
                    }}
                    disabled={isSavingItem}
                  >
                    {isAnyUploadActive ? 'ย่อหน้าต่างรออัปโหลด' : 'ยกเลิก'}
                  </button>
                  <button
                    type="submit"
                    className="omBtn omBtnPrimary"
                    disabled={isSavingItem || isAnyUploadActive}
                  >
                    {isSavingItem
                      ? 'กำลังบันทึก...'
                      : isAnyUploadActive
                      ? `รออัปโหลด (${telemetry?.percent ?? 0}%)`
                      : itemForm.id
                      ? 'บันทึกการแก้ไข'
                      : 'บันทึกสื่อใหม่'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Minimized Upload Monitor */}
      {isItemModalOpen && isModalMinimized && (
        <div className="omFloatingMonitor" role="status" aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {telemetry ? telemetry.fileName : itemForm.title || 'ร่างสื่อออนไลน์'}
            </div>
            <button
              type="button"
              className="omBtn omBtnCompact"
              onClick={() => setIsModalMinimized(false)}
            >
              <Maximize2 size={13} />
              <span>เปิดหน้าต่าง</span>
            </button>
          </div>

          {telemetry ? (
            <>
              <div className="omProgressBar">
                <div className="omProgressFill" style={{ width: `${telemetry.percent}%` }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  color: '#475569',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>
                  {telemetry.percent}% · {formatBytes(telemetry.uploadedBytes)} /{' '}
                  {formatBytes(telemetry.totalBytes)}
                </span>
                <span>
                  {telemetry.active && telemetry.speedBytesPerSec > 0
                    ? `${formatBytes(telemetry.speedBytesPerSec)}/s`
                    : telemetry.phase === 'completed'
                    ? 'พร้อมบันทึก'
                    : telemetry.message}
                </span>
              </div>
            </>
          ) : (
            <div className="omHint">ย่อหน้าต่างชั่วคราว คลิกเปิดหน้าต่างเพื่อกรอกข้อมูลต่อ</div>
          )}
        </div>
      )}

      {/* Category Modal */}
      {isCatModalOpen && (
        <div className="omModalOverlay" onClick={() => !isSavingCat && setIsCatModalOpen(false)}>
          <div className="omModalDialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <h2>{catForm.id ? 'แก้ไขหมวดหมู่สื่อ' : 'เพิ่มหมวดหมู่สื่อใหม่'}</h2>
              <button
                type="button"
                className="omIconBtn"
                onClick={() => !isSavingCat && setIsCatModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="omModalBody">
                <div className="omFieldGroup">
                  <label className="omLabel" htmlFor="cat-name">
                    ชื่อหมวดหมู่ *
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    className="omInput"
                    value={catForm.name}
                    onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="omFieldRow">
                  <div className="omFieldGroup">
                    <label className="omLabel" htmlFor="cat-vis">
                      ขอบเขตที่แสดง
                    </label>
                    <select
                      id="cat-vis"
                      className="omSelect"
                      value={catForm.visibility}
                      onChange={(e) =>
                        setCatForm((p) => ({ ...p, visibility: e.target.value as CategoryVisibility }))
                      }
                    >
                      <option value="ALL">ทั้งหมด (สาธารณะ + ภายใน)</option>
                      <option value="PUBLIC">เฉพาะสื่อสาธารณะ</option>
                      <option value="INTERNAL">เฉพาะสื่อภายในบุคลากร</option>
                    </select>
                  </div>
                  <div className="omFieldGroup">
                    <label className="omLabel" htmlFor="cat-order">
                      ลำดับการแสดงผล
                    </label>
                    <input
                      id="cat-order"
                      type="number"
                      className="omInput"
                      value={catForm.displayOrder}
                      onChange={(e) =>
                        setCatForm((p) => ({ ...p, displayOrder: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <label className="omCheckRow">
                  <input
                    type="checkbox"
                    checked={catForm.isActive}
                    onChange={(e) => setCatForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  <span>เปิดใช้งานหมวดหมู่นี้</span>
                </label>
              </div>
              <div className="omModalFooter">
                <div className="omModalFooterActions">
                  <button type="button" className="omBtn" onClick={() => setIsCatModalOpen(false)}>
                    ยกเลิก
                  </button>
                  <button type="submit" className="omBtn omBtnPrimary" disabled={isSavingCat}>
                    {isSavingCat ? 'กำลังบันทึก...' : 'บันทึกหมวดหมู่'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Viewer History Modal */}
      {viewerModalItem && (
        <div className="omModalOverlay" onClick={() => setViewerModalItem(null)}>
          <div className="omModalDialog" onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <div>
                <h2>ประวัติบุคลากรที่เข้าชมสื่อ</h2>
                <div className="omHint">{viewerModalItem.title}</div>
              </div>
              <button
                type="button"
                className="omIconBtn"
                onClick={() => setViewerModalItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={17} />
              </button>
            </div>
            <div className="omModalBody">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  ผู้เข้าชมที่มีบัญชีบุคลากร: {viewerList.length} คน (ยอดดูรวมทั้งหมด{' '}
                  {viewerModalItem.viewCount.toLocaleString()} ครั้ง)
                </span>
                <input
                  type="text"
                  className="omInput"
                  style={{ maxWidth: 250 }}
                  placeholder="ค้นหาชื่อ หรือกลุ่มงาน..."
                  value={viewerSearch}
                  onChange={(e) => setViewerSearch(e.target.value)}
                />
              </div>

              {loadingViewers ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  กำลังโหลดประวัติการเข้าชม...
                </div>
              ) : filteredViewers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  ยังไม่มีประวัติบุคลากรที่เข้าชมสื่อรายการนี้
                </div>
              ) : (
                <div className="omTableCard">
                  <table className="omTable" style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th>ชื่อ-สกุลบุคลากร</th>
                        <th>กลุ่มงาน / หน่วยงาน</th>
                        <th className="omNumCol">จำนวนครั้ง</th>
                        <th>เข้าชมครั้งแรก</th>
                        <th>เข้าชมล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredViewers.map((v) => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 600 }}>{v.memberName}</td>
                          <td>{v.memberDepartment || '-'}</td>
                          <td className="omNumCol">{v.viewCount} ครั้ง</td>
                          <td className="omDateCol">{formatThaiBuddhistDateTime(v.firstViewedAt)}</td>
                          <td className="omDateCol">{formatThaiBuddhistDateTime(v.lastViewedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="omModalOverlay" onClick={() => !isDeleting && setDeleteTarget(null)}>
          <div className="omModalDialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <h2>ยืนยันการลบข้อมูล</h2>
              <button
                type="button"
                className="omIconBtn"
                onClick={() => !isDeleting && setDeleteTarget(null)}
                aria-label="ปิด"
              >
                <X size={17} />
              </button>
            </div>
            <div className="omModalBody">
              <p style={{ margin: 0 }}>
                คุณต้องการลบ <strong>{deleteTarget.label}</strong> ใช่หรือไม่
                {deleteTarget.type === 'item'
                  ? ' ไฟล์สื่อและเอกสารแนบที่เก็บบน MinIO จะถูกลบออกอย่างถาวร'
                  : ''}
              </p>
            </div>
            <div className="omModalFooter">
              <div className="omModalFooterActions">
                <button
                  type="button"
                  className="omBtn"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="omBtn omBtnDanger"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
