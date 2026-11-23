'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search,
  Upload,
  Images,
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  Trash2,
  Eye,
  Calendar,
  Loader2,
  Save,
  CheckCircle2,
  FolderOpen,
  GripVertical,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import PhotoAlbumLightbox from '@/components/gallery/PhotoAlbumLightbox'
import { formatThaiMonthYear } from '@/lib/cms/albumFormatters'
import { optimizeImageFileToWebP } from '@/lib/utils/imageOptimize'
import type { PhotoAlbumItem, PhotoAlbumStatus } from '@/types/album'
import './page.css'

const THAI_MONTH_NAMES_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

interface DraftPhotoItem {
  imageUrl: string
  caption: string
}

function getBangkokNowParts(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || String(new Date().getFullYear()), 10)
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || String(new Date().getMonth() + 1), 10)
  return { year, month }
}

function buildDefaultMonthlyTitle(year: number, month: number): string {
  return `ภาพข่าวและกิจกรรม ประจำเดือน${formatThaiMonthYear(year, month)}`
}

function buildMonthlySlug(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function buildMonthlyEventDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export default function AdminGalleryPage() {
  const initialNow = useMemo(() => getBangkokNowParts(), [])

  const [albums, setAlbums] = useState<PhotoAlbumItem[]>([])
  const [loading, setLoading] = useState(true)

  // Selected Month & Year to manage
  const [selectedYear, setSelectedYear] = useState<number>(initialNow.year)
  const [selectedMonth, setSelectedMonth] = useState<number>(initialNow.month)

  // Editor state for the selected month
  const [activeAlbumId, setActiveAlbumId] = useState<number | null>(null)
  const activeAlbumIdRef = useRef<number | null>(null)
  const initialSelectionRef = useRef({ year: initialNow.year, month: initialNow.month })
  const [title, setTitle] = useState<string>(() =>
    buildDefaultMonthlyTitle(initialNow.year, initialNow.month)
  )
  const [description, setDescription] = useState<string>('')
  const [status, setStatus] = useState<PhotoAlbumStatus>('PUBLISHED')
  const [photos, setPhotos] = useState<DraftPhotoItem[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Archive filter
  const [searchQuery, setSearchQuery] = useState('')

  const [isDragging, setIsDragging] = useState(false)
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null)
  const [dragOverPhotoIndex, setDragOverPhotoIndex] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Preview & Delete
  const [previewAlbum, setPreviewAlbum] = useState<PhotoAlbumItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const selectableYears = useMemo(() => {
    const currentCe = initialNow.year
    const set = new Set<number>()
    for (let y = currentCe - 3; y <= currentCe + 1; y++) {
      set.add(y)
    }
    for (const a of albums) {
      const y = parseInt(a.eventDate.slice(0, 4), 10)
      if (!Number.isNaN(y)) set.add(y)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [albums, initialNow.year])

  const syncEditorWithMonth = useCallback(
    (year: number, month: number, albumList: PhotoAlbumItem[]) => {
      const targetPrefix = `${year}-${String(month).padStart(2, '0')}`
      const matched = albumList.find(
        (a) => a.slug === targetPrefix || a.eventDate.startsWith(targetPrefix)
      )

      if (matched) {
        activeAlbumIdRef.current = matched.id
        setActiveAlbumId(matched.id)
        setTitle(matched.title || buildDefaultMonthlyTitle(year, month))
        setDescription(matched.description || '')
        setStatus(matched.status)
        setPhotos(
          (matched.images || []).map((img) => ({
            imageUrl: img.imageUrl,
            caption: img.caption || '',
          }))
        )
      } else {
        activeAlbumIdRef.current = null
        setActiveAlbumId(null)
        setTitle(buildDefaultMonthlyTitle(year, month))
        setDescription('')
        setStatus('PUBLISHED')
        setPhotos([])
      }
      setHasUnsavedChanges(false)
    },
    []
  )

  const fetchAlbums = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/albums?all=true&limit=100&t=${Date.now()}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const fetched: PhotoAlbumItem[] = data.albums || []
        setAlbums(fetched)
        syncEditorWithMonth(
          initialSelectionRef.current.year,
          initialSelectionRef.current.month,
          fetched
        )
      } else {
        addToast(data.error || 'ไม่สามารถโหลดข้อมูลอัลบั้มได้', 'error')
      }
    } catch {
      addToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
    } finally {
      setLoading(false)
    }
  }, [syncEditorWithMonth])

  useEffect(() => {
    fetchAlbums()
  }, [fetchAlbums])

  const handleSelectYearMonth = (year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
    syncEditorWithMonth(year, month, albums)
  }

  const persistMonthlyAlbum = async (
    nextPhotos: DraftPhotoItem[],
    overrides?: {
      year?: number
      month?: number
      albumId?: number | null
      title?: string
      description?: string
      status?: PhotoAlbumStatus
    }
  ) => {
    const y = overrides?.year ?? selectedYear
    const m = overrides?.month ?? selectedMonth
    const albumId = overrides?.albumId !== undefined ? overrides.albumId : (activeAlbumIdRef.current ?? activeAlbumId)
    const finalTitle = (overrides?.title ?? title).trim() || buildDefaultMonthlyTitle(y, m)
    const finalDesc = (overrides?.description ?? description).trim() || null
    const finalStatus = overrides?.status ?? status

    if (nextPhotos.length === 0) {
      addToast('อัลบั้มต้องมีรูปภาพอย่างน้อย 1 รูป (หากต้องการลบทั้งเดือนให้กดปุ่มลบเดือน)', 'warning')
      return false
    }

    setSaving(true)
    try {
      const mappedImages = nextPhotos.map((p, idx) => ({
        imageUrl: p.imageUrl,
        caption: p.caption.trim() || null,
        displayOrder: idx,
      }))

      let res: Response
      if (albumId) {
        res = await fetch(`/api/albums/${albumId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: finalTitle,
            description: finalDesc,
            eventDate: buildMonthlyEventDate(y, m),
            coverImageUrl: mappedImages[0].imageUrl,
            status: finalStatus,
            isPinned: false,
            images: mappedImages,
          }),
        })
      } else {
        res = await fetch('/api/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: finalTitle,
            slug: buildMonthlySlug(y, m),
            description: finalDesc,
            eventDate: buildMonthlyEventDate(y, m),
            coverImageUrl: mappedImages[0].imageUrl,
            status: finalStatus,
            isPinned: false,
            images: mappedImages,
          }),
        })
      }

      const data = await res.json()
      if (res.ok && data.success && data.album) {
        const savedAlbum: PhotoAlbumItem = data.album
        activeAlbumIdRef.current = savedAlbum.id
        setActiveAlbumId(savedAlbum.id)
        setAlbums((prev) => {
          const exists = prev.some((a) => a.id === savedAlbum.id)
          const updatedList = exists
            ? prev.map((a) => (a.id === savedAlbum.id ? savedAlbum : a))
            : [savedAlbum, ...prev]
          return updatedList.sort((a, b) => b.eventDate.localeCompare(a.eventDate))
        })
        setHasUnsavedChanges(false)
        return true
      } else {
        addToast(data.error || 'บันทึกอัลบั้มเดือนนี้ไม่สำเร็จ', 'error')
        return false
      }
    } catch {
      addToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) {
      addToast('กรุณาเลือกไฟล์รูปภาพ (JPEG, PNG, WebP)', 'warning')
      return
    }

    if (photos.length + files.length > 300) {
      addToast('สามารถเก็บรูปภาพได้สูงสุด 300 รูปต่อ 1 เดือน', 'warning')
      return
    }

    const uploadedItems: DraftPhotoItem[] = []
    const uploadDateStr = buildMonthlyEventDate(selectedYear, selectedMonth)

    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`กำลังย่อขนาดและอัปโหลดภาพที่ ${i + 1} / ${files.length}...`)
      const rawFile = files[i]
      const optimized = await optimizeImageFileToWebP(rawFile, {
        maxDimension: 1600,
        quality: 0.85,
      })

      const formData = new FormData()
      formData.append('file', optimized)
      formData.append('publishedAt', uploadDateStr)

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (res.ok && data.url) {
          uploadedItems.push({ imageUrl: data.url, caption: '' })
        } else {
          addToast(data.error || `อัปโหลดไฟล์ ${rawFile.name} ไม่สำเร็จ`, 'error')
        }
      } catch {
        addToast(`เกิดข้อผิดพลาดระหว่างอัปโหลด ${rawFile.name}`, 'error')
      }
    }

    setUploadProgress('')

    if (uploadedItems.length > 0) {
      // Prepend newly uploaded photos so latest activity appears in homepage 3-photo preview immediately
      const nextPhotos = [...uploadedItems, ...photos]
      setPhotos(nextPhotos)
      const ok = await persistMonthlyAlbum(nextPhotos)
      if (ok) {
        addToast(
          `เพิ่มรูปภาพ ${uploadedItems.length} ภาพเข้าเดือน${formatThaiMonthYear(
            selectedYear,
            selectedMonth
          )} เรียบร้อยแล้ว`,
          'success'
        )
      }
    }
  }

  const handleMovePhoto = (index: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= photos.length) return
    setPhotos((prev) => {
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(targetIndex, 0, moved)
      return copy
    })
    setHasUnsavedChanges(true)
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index))
    setHasUnsavedChanges(true)
  }

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await persistMonthlyAlbum(photos)
    if (ok) {
      addToast('บันทึกข้อมูลและลำดับภาพเรียบร้อยแล้ว', 'success')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/albums/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        addToast('ลบอัลบั้มประจำเดือนเรียบร้อยแล้ว', 'success')
        const nextList = albums.filter((a) => a.id !== deleteTarget.id)
        setAlbums(nextList)
        if (activeAlbumId === deleteTarget.id) {
          syncEditorWithMonth(selectedYear, selectedMonth, nextList)
        }
        setDeleteTarget(null)
      } else {
        addToast(data.error || 'เกิดข้อผิดพลาดในการลบอัลบั้ม', 'error')
      }
    } catch {
      addToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const currentMonthText = formatThaiMonthYear(selectedYear, selectedMonth)
  const filteredArchiveAlbums = albums.filter((a) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      a.title.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      a.images?.some((img) => (img.caption || '').toLowerCase().includes(q))
    )
  })

  return (
    <div className="galleryAdminPage">
      {/* Month & Year Picker Bar */}
      <section className="galleryMonthPickerCard" aria-label="เลือกเดือนและปี พ.ศ. ที่ต้องการจัดการรูปภาพ">
        <div className="galleryMonthPickerControls">
          <div className="galleryMonthPickerField">
            <label htmlFor="admin-gallery-month" className="galleryLabel">
              เลือกเดือน:
            </label>
            <select
              id="admin-gallery-month"
              className="galleryAdminSelect galleryAdminFilterSelect"
              value={selectedMonth}
              onChange={(e) => handleSelectYearMonth(selectedYear, parseInt(e.target.value, 10))}
            >
              {THAI_MONTH_NAMES_FULL.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="galleryMonthPickerField">
            <label htmlFor="admin-gallery-year" className="galleryLabel">
              ปี พ.ศ.:
            </label>
            <select
              id="admin-gallery-year"
              className="galleryAdminSelect galleryAdminFilterSelect"
              value={selectedYear}
              onChange={(e) => handleSelectYearMonth(parseInt(e.target.value, 10), selectedMonth)}
            >
              {selectableYears.map((y) => (
                <option key={y} value={y}>
                  {y > 2400 ? y : y + 543}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={`galleryMonthStatusInfo ${activeAlbumId ? '' : 'empty'}`}>
          {activeAlbumId ? (
            <>
              <CheckCircle2 size={16} />
              <span>
                เดือน{currentMonthText}: มีอยู่แล้ว {photos.length} ภาพ (เพิ่มรูปได้เรื่อยๆ)
              </span>
            </>
          ) : (
            <>
              <FolderOpen size={16} />
              <span>เดือน{currentMonthText}: ยังไม่มีรูปภาพ — อัปโหลดเพื่อเริ่มอัลบั้มเดือนนี้</span>
            </>
          )}
        </div>
      </section>

      {/* Active Monthly Album Workbench */}
      <section className="galleryEditorCard" aria-label="จัดการรูปภาพของเดือนที่เลือก">
        <div className="galleryEditorHeader">
          <h2>อัลบั้มประจำเดือน{currentMonthText}</h2>
          {activeAlbumId && photos.length > 0 && (
            <button
              type="button"
              className="galleryActionBtn"
              onClick={() => {
                const found = albums.find((a) => a.id === activeAlbumId)
                if (found) setPreviewAlbum(found)
              }}
            >
              <Eye size={16} />
              <span>ดูตัวอย่าง Lightbox</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSaveManual} className="galleryEditorBody">
          {/* Upload Dropzone First — fastest path for adding more photos */}
          <div className="galleryField">
            <span className="galleryLabel">
              เพิ่มรูปภาพเข้าเดือน{currentMonthText} (ปัจจุบัน {photos.length} ภาพ)
            </span>

            <div
              className={`galleryDropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => {
                if (draggedPhotoIndex !== null) return
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                if (draggedPhotoIndex !== null) return
                e.preventDefault()
                setIsDragging(false)
                if (e.dataTransfer.files?.length) {
                  uploadFiles(e.dataTransfer.files)
                }
              }}
            >
              <input
                id="gallery-photo-upload"
                type="file"
                className="galleryHiddenInput"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) {
                    uploadFiles(e.target.files)
                    e.target.value = ''
                  }
                }}
              />
              <label htmlFor="gallery-photo-upload" className="galleryDropzoneLabel">
                <div className="galleryDropzoneIcon">
                  <Upload size={22} />
                </div>
                <div className="galleryDropzoneText">
                  <strong>
                    คลิกเลือกหรือลากรูปภาพมาวางเพื่อเพิ่มเข้าเดือน{currentMonthText} (เลือกหลายรูปได้)
                  </strong>
                  <span>
                    ภาพใหม่จะย่อขนาดเป็น WebP และบันทึกเข้าอัลบั้มเดือนนี้ให้อัตโนมัติทันที (3 รูปแรกจะโชว์เป็นตัวอย่างหน้าแรก)
                  </span>
                </div>
              </label>
            </div>

            {uploadProgress && (
              <div className="galleryUploadProgress">
                <Loader2 size={16} className="galleryAdminSpinner" />
                <span>{uploadProgress}</span>
              </div>
            )}
          </div>

          {/* Monthly Metadata */}
          <div className="galleryFormGrid">
            <div className="galleryField">
              <label htmlFor="monthly-title" className="galleryLabel">
                หัวข้ออัลบั้มประจำเดือน
              </label>
              <input
                id="monthly-title"
                type="text"
                className="galleryAdminInput"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setHasUnsavedChanges(true)
                }}
              />
            </div>

            <div className="galleryField">
              <label htmlFor="monthly-status" className="galleryLabel">
                สถานะการแสดงผล
              </label>
              <select
                id="monthly-status"
                className="galleryAdminSelect"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as PhotoAlbumStatus)
                  setHasUnsavedChanges(true)
                }}
              >
                <option value="PUBLISHED">เผยแพร่บนหน้าแรกและคลังภาพ</option>
                <option value="DRAFT">ฉบับร่าง (ซ่อนชั่วคราว)</option>
              </select>
            </div>
          </div>

          <div className="galleryField">
            <label htmlFor="monthly-desc" className="galleryLabel">
              สรุปกิจกรรมประจำเดือน (ไม่บังคับ)
            </label>
            <input
              id="monthly-desc"
              type="text"
              className="galleryAdminInput"
              placeholder="เช่น รวมภาพกิจกรรมบริการประชาชน การอบรม และจิตอาสา..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setHasUnsavedChanges(true)
              }}
            />
          </div>

          {/* Photo Grid */}
          {photos.length > 0 && (
            <div className="galleryField">
              <span className="galleryLabel">
                รูปภาพทั้งหมดในเดือน{currentMonthText} (ลากวางเพื่อสลับอันดับได้ • ภาพ #1–#3 จะแสดงเป็นตัวอย่างบนหน้าแรก)
              </span>

              <div className="galleryPhotoManagerGrid">
                {photos.map((photo, idx) => {
                  const isHomepageSample = idx < 3
                  const isBeingDragged = draggedPhotoIndex === idx
                  const isDropTarget = dragOverPhotoIndex === idx && draggedPhotoIndex !== null && draggedPhotoIndex !== idx
                  return (
                    <div
                      key={`${photo.imageUrl}-${idx}`}
                      draggable
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement
                        if (target.closest('input, button, textarea, select')) {
                          e.preventDefault()
                          return
                        }
                        setDraggedPhotoIndex(idx)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(idx))
                      }}
                      onDragOver={(e) => {
                        if (draggedPhotoIndex === null) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverPhotoIndex !== idx) {
                          setDragOverPhotoIndex(idx)
                        }
                      }}
                      onDragEnter={(e) => {
                        if (draggedPhotoIndex === null) return
                        e.preventDefault()
                        setDragOverPhotoIndex(idx)
                      }}
                      onDrop={(e) => {
                        if (draggedPhotoIndex === null) return
                        e.preventDefault()
                        if (draggedPhotoIndex !== idx) {
                          handleMovePhoto(draggedPhotoIndex, idx)
                        }
                        setDraggedPhotoIndex(null)
                        setDragOverPhotoIndex(null)
                      }}
                      onDragEnd={() => {
                        setDraggedPhotoIndex(null)
                        setDragOverPhotoIndex(null)
                      }}
                      className={`galleryPhotoTile ${isHomepageSample ? 'isCover' : ''} ${
                        isBeingDragged ? 'isDragging' : ''
                      } ${isDropTarget ? 'isDragOver' : ''}`}
                      title="ลากเพื่อสลับอันดับรูปภาพ"
                    >
                      <div className="galleryPhotoThumbBox">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.imageUrl}
                          alt={`ภาพที่ ${idx + 1}`}
                          className="galleryPhotoThumbImg"
                          loading="lazy"
                          draggable={false}
                        />
                        <span className="galleryPhotoOrderTag">
                          <GripVertical size={12} aria-hidden="true" />
                          <span>#{idx + 1}</span>
                        </span>
                        {isHomepageSample && (
                          <span className="galleryHomepagePreviewTag">
                            ตัวอย่างหน้าแรก #{idx + 1}
                          </span>
                        )}
                      </div>

                      <div className="galleryPhotoTileBody">
                        <input
                          type="text"
                          className="galleryPhotoCaptionInput"
                          placeholder="ชื่อกิจกรรม / คำบรรยายภาพนี้..."
                          value={photo.caption}
                          onChange={(e) => {
                            const val = e.target.value
                            setPhotos((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, caption: val } : item))
                            )
                            setHasUnsavedChanges(true)
                          }}
                        />
                        <div className="galleryPhotoTileControls">
                          <button
                            type="button"
                            className="galleryIconBtn"
                            disabled={idx === 0}
                            onClick={() => handleMovePhoto(idx, 0)}
                            title="ย้ายไปเป็นภาพแรก (แสดงหน้าแรก)"
                          >
                            <ArrowUpToLine size={14} />
                            <span>ขึ้น #1</span>
                          </button>

                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              type="button"
                              className="galleryIconBtn"
                              disabled={idx === 0}
                              onClick={() => handleMovePhoto(idx, idx - 1)}
                              aria-label="เลื่อนซ้าย"
                              title="เลื่อนซ้าย"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <button
                              type="button"
                              className="galleryIconBtn"
                              disabled={idx === photos.length - 1}
                              onClick={() => handleMovePhoto(idx, idx + 1)}
                              aria-label="เลื่อนขวา"
                              title="เลื่อนขวา"
                            >
                              <ArrowRight size={14} />
                            </button>
                            <button
                              type="button"
                              className="galleryIconBtn danger"
                              onClick={() => handleRemovePhoto(idx)}
                              aria-label={`ลบรูปที่ ${idx + 1}`}
                              title="ลบรูปนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {photos.length > 0 && (
            <div className="galleryEditorFooter">
              <button
                type="submit"
                className="galleryAdminCreateBtn"
                disabled={saving || Boolean(uploadProgress)}
              >
                {saving ? <Loader2 size={16} className="galleryAdminSpinner" /> : <Save size={16} />}
                <span>
                  {hasUnsavedChanges ? 'บันทึกการเปลี่ยนแปลง*' : 'บันทึกคำบรรยายและลำดับภาพ'}
                </span>
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Monthly Archive List */}
      <section aria-label="คลังภาพข่าวรายเดือนทั้งหมด">
        <div className="galleryAdminTopBar" style={{ marginBottom: '0.875rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>
            คลังอัลบั้มรายเดือนทั้งหมด ({albums.length} เดือน)
          </div>
          <div className="galleryAdminSearchWrap" style={{ maxWidth: '320px' }}>
            <Search size={16} className="galleryAdminSearchIcon" aria-hidden="true" />
            <input
              type="search"
              className="galleryAdminInput galleryAdminSearchInput"
              placeholder="ค้นหาเดือนหรือคำบรรยาย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="galleryAdminEmpty">
            <Loader2 size={28} className="galleryAdminSpinner" style={{ margin: '0 auto 0.5rem' }} />
            <p>กำลังโหลดคลังอัลบั้มรายเดือน...</p>
          </div>
        ) : filteredArchiveAlbums.length > 0 ? (
          <div className="galleryAdminList">
            {filteredArchiveAlbums.map((album) => {
              const ay = parseInt(album.eventDate.slice(0, 4), 10) || initialNow.year
              const am = parseInt(album.eventDate.slice(5, 7), 10) || 1
              const cover = album.coverImageUrl || album.images?.[0]?.imageUrl
              const isCurrent = ay === selectedYear && am === selectedMonth
              return (
                <article
                  key={album.id}
                  className="galleryAdminItem"
                  style={isCurrent ? { borderColor: 'var(--primary)', borderWidth: '2px' } : undefined}
                >
                  <div className="galleryAdminThumb">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={album.title} loading="lazy" />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--gray-400)',
                        }}
                      >
                        <Images size={24} />
                      </div>
                    )}
                  </div>

                  <div className="galleryAdminItemInfo">
                    <div className="galleryAdminItemBadges">
                      <span
                        className={`galleryStatusBadge ${
                          album.status === 'PUBLISHED' ? 'published' : 'draft'
                        }`}
                      >
                        {album.status === 'PUBLISHED' ? 'กำลังเผยแพร่' : 'ฉบับร่าง (ซ่อน)'}
                      </span>
                      {isCurrent && (
                        <span className="galleryPinTag">กำลังจัดการอยู่ด้านบน</span>
                      )}
                    </div>

                    <h3 className="galleryAdminItemTitle">{album.title}</h3>

                    <div className="galleryAdminItemMeta">
                      <span>
                        <Calendar size={14} />
                        เดือน{formatThaiMonthYear(ay, am)}
                      </span>
                      <span>
                        <Images size={14} />
                        {album.imageCount} ภาพ
                      </span>
                      <span>
                        <Eye size={14} />
                        {album.viewCount} ครั้ง
                      </span>
                    </div>
                  </div>

                  <div className="galleryAdminItemActions">
                    <button
                      type="button"
                      className="galleryActionBtn"
                      onClick={() => {
                        handleSelectYearMonth(ay, am)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      <FolderOpen size={15} />
                      <span>เปิดเพิ่มรูป / จัดการ</span>
                    </button>

                    <button
                      type="button"
                      className="galleryActionBtn"
                      onClick={() => setPreviewAlbum(album)}
                    >
                      <Eye size={15} />
                      <span>ดูภาพ</span>
                    </button>

                    <button
                      type="button"
                      className="galleryActionBtn danger"
                      onClick={() => setDeleteTarget({ id: album.id, title: album.title })}
                      aria-label={`ลบอัลบั้ม ${album.title}`}
                      title="ลบอัลบั้มเดือนนี้"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="galleryAdminEmpty">
            <p>ยังไม่มีอัลบั้มรายเดือนในระบบ ลองอัปโหลดรูปภาพด้านบนเพื่อสร้างอัลบั้มเดือนแรกได้เลย</p>
          </div>
        )}
      </section>

      {previewAlbum && (
        <PhotoAlbumLightbox album={previewAlbum} onClose={() => setPreviewAlbum(null)} />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="ยืนยันการลบอัลบั้มประจำเดือน"
        description={`ต้องการลบ "${deleteTarget?.title}" และรูปภาพทั้งหมดในเดือนนี้หรือไม่?`}
        confirmText="ยืนยันลบทั้งเดือน"
        cancelText="ยกเลิก"
        type="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
