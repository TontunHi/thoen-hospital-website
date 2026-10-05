'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Trash2, 
  Calendar, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Clock, 
  Edit2, 
  ArrowUpDown, 
  Video, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  X, 
  Film, 
  AlertCircle, 
  Timer, 
  Search, 
  CalendarClock, 
  CalendarX,
  Sparkles,
  Info
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import './page.css'

interface SlideItem {
  id: number
  imagePath: string
  title: string | null
  linkUrl: string | null
  startDate: string
  endDate: string
  displayOrder: number
  duration: number
}

type SlideStatusType = 'active' | 'upcoming' | 'expired'

const isVideoFile = (url?: string | null) => {
  if (!url) return false
  const lower = url.toLowerCase()
  return (
    lower.includes('.mp4') ||
    lower.endsWith('.mp4') ||
    lower.startsWith('blob:') ||
    lower.startsWith('data:video/') ||
    lower.includes('/stream')
  )
}

const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const formatToDatetimeLocal = (isoString?: string | null) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const tzoffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16)
}

const formatThaiDateTime = (isoString?: string | null) => {
  if (!isoString) return '-'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '-'
  return (
    d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' น.'
  )
}

export default function AdminSlidesPage() {
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  // Filter & Search State
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'upcoming' | 'expired'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Form State
  const [imagePath, setImagePath] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')
  const [isVideoPreview, setIsVideoPreview] = useState(false)
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [displayOrder, setDisplayOrder] = useState<number>(1)
  const [duration, setDuration] = useState<number>(6) // Display duration in seconds for this slide

  // Video Player Controls State (for upload form preview)
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)

  // Video Preview Modal (for list item preview)
  const [previewModalSlide, setPreviewModalSlide] = useState<SlideItem | null>(null)

  // Edit & Delete State
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSlides = async () => {
    try {
      const res = await fetch('/api/hero-slides?all=true')
      const data = await res.json()
      if (res.ok) {
        const fetchedSlides = data.slides || []
        setSlides(fetchedSlides)
        if (!editingId) {
          setDisplayOrder(fetchedSlides.length + 1)
        }
      }
    } catch (err) {
      console.error('Failed to fetch slides:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlides()
  }, [])

  const handleEdit = (slide: SlideItem) => {
    setEditingId(slide.id)
    setImagePath(slide.imagePath)
    setLocalPreviewUrl(slide.imagePath)
    const isVid = isVideoFile(slide.imagePath)
    setIsVideoPreview(isVid)
    setTitle(slide.title || '')
    setLinkUrl(slide.linkUrl || '')
    setStartDate(formatToDatetimeLocal(slide.startDate))
    setEndDate(formatToDatetimeLocal(slide.endDate))
    setDisplayOrder(slide.displayOrder || 1)
    setDuration(typeof slide.duration === 'number' && slide.duration >= 1 ? slide.duration : 6)
    setError('')
    setSuccess('')
    if (previewModalSlide) setPreviewModalSlide(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setImagePath('')
    setLocalPreviewUrl('')
    setIsVideoPreview(false)
    setTitle('')
    setLinkUrl('')
    setStartDate('')
    setEndDate('')
    setDisplayOrder(slides.length + 1)
    setDuration(6)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setError('')
    setSuccess('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (imagePath && !editingId) {
      try {
        await fetch(`/api/upload?path=${encodeURIComponent(imagePath)}`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.error('Failed to clean up previous temp image:', err)
      }
    }

    const isVideo = file.type.includes('mp4') || file.type.includes('video') || file.name.toLowerCase().endsWith('.mp4')
    setIsVideoPreview(isVideo)
    if (file.size > (isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024)) {
      setError(`ไฟล์มีขนาดใหญ่เกินกำหนด (รูปภาพไม่เกิน 10MB, วิดีโอ MP4 ไม่เกิน 100MB)`)
      setIsVideoPreview(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const localUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(localUrl)
    setIsVideoPlaying(true)
    setIsVideoMuted(true)

    setUploading(true)
    setError('')
    setSuccess('')

    // Set default dates if empty
    if (!startDate) {
      const now = new Date()
      setStartDate(formatToDatetimeLocal(now.toISOString()))
      if (!endDate) {
        const end = new Date(now)
        end.setDate(end.getDate() + 30)
        setEndDate(formatToDatetimeLocal(end.toISOString()))
      }
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title || 'slide')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setImagePath(data.url)
        setIsVideoPreview(Boolean(data.isVideo || isVideo))
        setSuccess(isVideo ? 'อัปโหลดไฟล์วิดีโอ MP4 สำเร็จ (สามารถกดเล่นและทดสอบเปิดเสียงได้)' : 'อัปโหลดไฟล์ภาพสำเร็จ')
      } else {
        setError(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ')
        setLocalPreviewUrl('')
        setIsVideoPreview(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการอัปโหลด')
      setLocalPreviewUrl('')
      setIsVideoPreview(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveSelectedImage = async () => {
    const pathToClean = imagePath
    setImagePath('')
    setLocalPreviewUrl('')
    setIsVideoPreview(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (pathToClean && !editingId) {
      try {
        await fetch(`/api/upload?path=${encodeURIComponent(pathToClean)}`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.error('Failed to delete temporary uploaded file:', err)
      }
    }
  }

  const toggleVideoPlay = () => {
    if (!previewVideoRef.current) return
    if (previewVideoRef.current.paused) {
      previewVideoRef.current.play()
      setIsVideoPlaying(true)
    } else {
      previewVideoRef.current.pause()
      setIsVideoPlaying(false)
    }
  }

  const toggleVideoMute = () => {
    if (!previewVideoRef.current) return
    const newMute = !isVideoMuted
    previewVideoRef.current.muted = newMute
    setIsVideoMuted(newMute)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = time
      setVideoCurrentTime(time)
    }
  }

  const isCurrentVideo = isVideoPreview || isVideoFile(imagePath) || isVideoFile(localPreviewUrl)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!imagePath) {
      setError('กรุณาอัปโหลดรูปภาพหรือวิดีโอก่อน')
      setSubmitting(false)
      return
    }

    if (!startDate || !endDate) {
      setError('กรุณาระบุวันเวลาเริ่มต้นและสิ้นสุดการแสดงผล')
      setSubmitting(false)
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      setError('เวลาที่เริ่มแสดงจะต้องเกิดก่อนเวลาสิ้นสุดการแสดงผล')
      setSubmitting(false)
      return
    }

    const durationNum = isCurrentVideo ? 6 : Math.max(1, Math.min(300, Number(duration) || 6))

    try {
      const url = editingId ? `/api/hero-slides/${editingId}` : '/api/hero-slides'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath,
          title: title || null,
          linkUrl: linkUrl || null,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          displayOrder: Number(displayOrder) || 0,
          duration: durationNum,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(editingId ? 'แก้ไขข้อมูลสไลด์เรียบร้อยแล้ว' : 'บันทึกและตั้งเวลาแสดงผลสไลด์เรียบร้อยแล้ว')
        handleCancelEdit()
        fetchSlides()
      } else {
        setError(data.error || 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/hero-slides/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSlides(slides.filter((slide) => slide.id !== id))
        setSuccess('ลบสไลด์เรียบร้อยแล้ว')
        if (editingId === id) {
          handleCancelEdit()
        }
      } else {
        const data = await res.json()
        setError(data.error || 'ลบไม่สำเร็จ')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการติดต่อระบบ')
    } finally {
      setIsDeleting(false)
      setDeleteTargetId(null)
    }
  }

  // Get status of a slide
  const getSlideStatus = (startStr: string, endStr: string): {
    key: SlideStatusType
    label: string
    className: string
    timeDetail: string
  } => {
    const now = new Date()
    const start = new Date(startStr)
    const end = new Date(endStr)

    if (now < start) {
      const diffMs = start.getTime() - now.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const timeDetail = diffDays > 0 ? `จะเริ่มในอีก ${diffDays} วัน ${diffHours} ชม.` : `จะเริ่มในอีก ${diffHours} ชม.`
      return { key: 'upcoming', label: 'ตั้งเวลาล่วงหน้า', className: 'status-upcoming', timeDetail }
    } else if (now > end) {
      const diffMs = now.getTime() - end.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const timeDetail = diffDays > 0 ? `หมดอายุไปแล้ว ${diffDays} วัน` : `เพิ่งหมดอายุวันนี้`
      return { key: 'expired', label: 'หมดอายุแล้ว', className: 'status-expired', timeDetail }
    } else {
      const diffMs = end.getTime() - now.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const timeDetail = diffDays > 0 ? `เหลือเวลาอีก ${diffDays} วัน ${diffHours} ชม.` : `เหลือเวลาอีก ${diffHours} ชม.`
      return { key: 'active', label: 'กำลังแสดงผล', className: 'status-active', timeDetail }
    }
  }

  // Drag and Drop handlers
  const [draggedItem, setDraggedItem] = useState<SlideItem | null>(null)

  const handleDragStart = (e: React.DragEvent, slide: SlideItem) => {
    setDraggedItem(slide)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', slide.id.toString())
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragEnter = (_e: React.DragEvent, targetIndex: number) => {
    if (!draggedItem) return
    const draggedIndex = slides.findIndex((item) => item.id === draggedItem.id)
    if (draggedIndex === targetIndex) return

    const newSlides = [...slides]
    newSlides.splice(draggedIndex, 1)
    newSlides.splice(targetIndex, 0, draggedItem)

    const reorderedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      displayOrder: idx + 1
    }))

    setSlides(reorderedSlides)
  }

  const handleDragEnd = async () => {
    setDraggedItem(null)
    try {
      setError('')
      const updates = slides.map((slide, idx) => ({
        id: slide.id,
        displayOrder: idx + 1
      }))

      const savePromises = updates.map(update => 
        fetch(`/api/hero-slides/${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...slides.find(s => s.id === update.id),
            displayOrder: update.displayOrder
          })
        })
      )

      await Promise.all(savePromises)
      setSuccess('จัดเรียงลำดับสไลด์ใหม่เรียบร้อยแล้ว')
      fetchSlides()
    } catch (err) {
      console.error('Failed to save slide order:', err)
      setError('เกิดข้อผิดพลาดในการจัดเก็บลำดับสไลด์ใหม่')
    }
  }

  // Computed Counts & Filtered Slides
  const { counts, filteredSlides } = useMemo(() => {
    let active = 0
    let upcoming = 0
    let expired = 0

    slides.forEach(slide => {
      const st = getSlideStatus(slide.startDate, slide.endDate)
      if (st.key === 'active') active++
      else if (st.key === 'upcoming') upcoming++
      else if (st.key === 'expired') expired++
    })

    const filtered = slides.filter(slide => {
      const st = getSlideStatus(slide.startDate, slide.endDate)
      if (activeTab !== 'all' && st.key !== activeTab) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = slide.title?.toLowerCase().includes(q)
        const matchLink = slide.linkUrl?.toLowerCase().includes(q)
        return matchTitle || matchLink
      }
      return true
    })

    return {
      counts: { all: slides.length, active, upcoming, expired },
      filteredSlides: filtered,
    }
  }, [slides, activeTab, searchQuery])

  // Form Schedule Preview calculation
  const formSchedulePreview = useMemo(() => {
    if (!startDate || !endDate) return null
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null

    const isInvalid = s >= e
    const now = new Date()
    const diffMs = e.getTime() - s.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    let previewStatus = 'active'
    let statusText = 'สไลด์จะเริ่มแสดงผลทันทีตามช่วงเวลาที่กำหนด'
    if (now < s) {
      previewStatus = 'upcoming'
      statusText = 'สไลด์จะรอเริ่มแสดงผลเมื่อถึงเวลาเริ่มต้น (ตั้งเวลาล่วงหน้า)'
    } else if (now > e) {
      previewStatus = 'expired'
      statusText = 'เวลาสิ้นสุดผ่านไปแล้ว สไลด์นี้จะไม่แสดงบนหน้าแรก'
    }

    return {
      isInvalid,
      diffDays,
      startFormatted: formatThaiDateTime(startDate),
      endFormatted: formatThaiDateTime(endDate),
      previewStatus,
      statusText,
    }
  }, [startDate, endDate])

  if (loading) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>กำลังโหลดข้อมูลสไลด์ภาพและระบบตั้งเวลา...</p>
      </div>
    )
  }

  return (
    <div className="slidesAdminPage">
      {/* ── Page Header & Stats Summary ── */}
      <div className="pageHeader">
        <div className="headerLeft">
          <h1>จัดการสไลด์โชว์ & กำหนดเวลาแสดงผล</h1>
          <p className="subtext">
            อัปโหลด กำหนดช่วงวัน-เวลาที่แสดง และกำหนดเวลาความนานของแต่ละสไลด์
          </p>
        </div>

        {/* Global Slide Stats Chips */}
        <div className="statsChipsContainer">
          <div className="statChip chip-active" title="สไลด์ที่กำลังโชว์อยู่บนหน้าแรกของเว็บ ณ ขณะนี้">
            <span className="dot" />
            <span className="label">กำลังโชว์:</span>
            <span className="value">{counts.active}</span>
          </div>
          <div className="statChip chip-upcoming" title="สไลด์ที่มีกำหนดการจะขึ้นโชว์ในอนาคต">
            <CalendarClock size={14} />
            <span className="label">ตั้งเวลาล่วงหน้า:</span>
            <span className="value">{counts.upcoming}</span>
          </div>
          <div className="statChip chip-expired" title="สไลด์ที่หมดเวลาแสดงผลแล้ว">
            <CalendarX size={14} />
            <span className="label">หมดอายุ:</span>
            <span className="value">{counts.expired}</span>
          </div>
        </div>
      </div>

      {error && <div className="slidesAlert alert-danger">{error}</div>}
      {success && <div className="slidesAlert alert-success">{success}</div>}

      {/* ── Main Grid Layout ── */}
      <div className="slidesGrid">
        {/* Creation / Edit Form */}
        <div className="formSection card">
          <div className="formHeaderTitle">
            <h2>{editingId ? 'แก้ไขข้อมูลสไลด์' : 'เพิ่มสไลด์ใหม่'}</h2>
            {editingId && (
              <span className="editingBadge">กำลังแก้ไข ID: {editingId}</span>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="formGroup">
              <label>อัปโหลดรูปภาพหรือวิดีโอสไลด์ * (รูปภาพแนะนำ 1920x800px หรือวิดีโอ .mp4 ไม่เกิน 100MB)</label>
              <input
                ref={fileInputRef}
                type="file"
                className="formInput"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
                onChange={handleImageUpload}
                required={!localPreviewUrl && !imagePath}
              />
              {uploading && <div className="uploadProgress">⏳ กำลังอัปโหลดและประมวลผลไฟล์...</div>}
              
              {/* Form Live Media Preview */}
              {(localPreviewUrl || imagePath) && (
                <div className={`previewUploadedSlide ${isCurrentVideo ? 'videoPreviewBox' : ''}`}>
                  {isCurrentVideo ? (
                    <div className="customVideoPlayerContainer">
                      <video
                        ref={previewVideoRef}
                        key={localPreviewUrl || imagePath}
                        src={localPreviewUrl || imagePath}
                        autoPlay
                        muted={isVideoMuted}
                        playsInline
                        loop
                        preload="auto"
                        className="previewVideoEl"
                        onLoadedMetadata={(e) => {
                          setVideoDuration(e.currentTarget.duration)
                          if (previewVideoRef.current) {
                            previewVideoRef.current.play().catch(() => {})
                          }
                        }}
                        onTimeUpdate={(e) => {
                          setVideoCurrentTime(e.currentTarget.currentTime)
                        }}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onError={(e) => {
                          console.warn('Video preview playback notice:', e)
                        }}
                      >
                        <source src={localPreviewUrl || imagePath} type="video/mp4" />
                      </video>

                      {/* Top Overlay Badges */}
                      <div className="videoOverlayHeader">
                        <div className="videoFormatBadge">
                          <Film size={13} />
                          <span>วิดีโอ MP4 HD</span>
                          {videoDuration > 0 && (
                            <span className="durationBadge">⏱️ {formatDuration(videoDuration)}</span>
                          )}
                        </div>
                        <button type="button" className="removeImgBtn" onClick={handleRemoveSelectedImage}>
                          ✕ เปลี่ยนไฟล์
                        </button>
                      </div>

                      {/* Interactive Controls Overlay */}
                      <div className="videoPlayerControls">
                        <button
                          type="button"
                          className="videoControlBtn playPauseBtn"
                          onClick={toggleVideoPlay}
                          title={isVideoPlaying ? 'หยุดชั่วคราว' : 'เล่นต่อ'}
                        >
                          {isVideoPlaying ? <Pause size={15} /> : <Play size={15} />}
                        </button>

                        <div className="videoSeekWrapper">
                          <input
                            type="range"
                            min="0"
                            max={videoDuration || 100}
                            step="0.1"
                            value={videoCurrentTime}
                            onChange={handleSeek}
                            className="videoSeekRange"
                          />
                          <div className="videoTimeDisplay">
                            <span>{formatDuration(videoCurrentTime)}</span>
                            <span>/</span>
                            <span>{formatDuration(videoDuration)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`videoControlBtn soundToggleBtn ${!isVideoMuted ? 'soundActive' : ''}`}
                          onClick={toggleVideoMute}
                          title={isVideoMuted ? 'แตะเพื่อเปิดเสียง' : 'แตะเพื่อปิดเสียง'}
                        >
                          {isVideoMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                          <span>{isVideoMuted ? 'ปิดเสียง' : 'เปิดเสียง'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={localPreviewUrl || imagePath} alt="Uploaded preview" />
                      <button type="button" className="removeImgBtn" onClick={handleRemoveSelectedImage}>
                        ✕ เปลี่ยนไฟล์
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="formGroup">
              <label htmlFor="slideTitle">หัวข้อภาพ / คำโปรย (ถ้ามี)</label>
              <input
                id="slideTitle"
                type="text"
                className="formInput"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="คำอธิบายสั้นๆ แสดงบนภาพ"
              />
            </div>

            <div className="formGroup">
              <label htmlFor="slideLink">ลิงก์ภายนอกปลายทางเมื่อคลิก (ถ้ามี)</label>
              <input
                id="slideLink"
                type="url"
                className="formInput"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="เช่น https://..."
              />
            </div>

            {/* ── Per-Slide Display Duration Control ── */}
            <div className="formGroup durationSettingBox">
              <label htmlFor="slideDurationInput" className="durationLabel">
                <Timer size={16} className="text-teal-700" />
                <span>เวลาในการโชว์สไลด์นี้ (Display Duration)</span>
              </label>

              {isCurrentVideo ? (
                <div className="videoDurationNotice">
                  <Film size={18} className="videoNoticeIcon" />
                  <div>
                    <strong>ไฟล์วิดีโอ MP4:</strong>
                    <p>สไลด์จะเล่นจนจบความยาววิดีโอโดยอัตโนมัติ แล้วจึงเปลี่ยนไปสไลด์ถัดไป (ไม่ต้องกำหนดเวลา)</p>
                  </div>
                </div>
              ) : (
                <div className="durationInputContainer">
                  <div className="durationInputWrapper">
                    <button
                      type="button"
                      onClick={() => setDuration((prev) => Math.max(1, prev - 1))}
                      className="durationCounterBtn"
                      title="ลดเวลา 1 วินาที"
                    >
                      -
                    </button>
                    <input
                      id="slideDurationInput"
                      type="number"
                      min="1"
                      max="300"
                      className="formInput durationInput"
                      value={duration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        setDuration(isNaN(val) ? 6 : Math.max(1, Math.min(300, val)))
                      }}
                      placeholder="6"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setDuration((prev) => Math.min(300, prev + 1))}
                      className="durationCounterBtn"
                      title="เพิ่มเวลา 1 วินาที"
                    >
                      +
                    </button>
                    <span className="durationUnitText">วินาที</span>
                  </div>

                  {/* Quick preset selector buttons for fast selection */}
                  <div className="durationPills">
                    {[3, 4, 5, 6, 8, 10, 15].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        className={`durationPillBtn ${duration === sec ? 'active' : ''}`}
                        onClick={() => setDuration(sec)}
                      >
                        {sec}s {sec === 6 ? '(มาตรฐาน)' : ''}
                      </button>
                    ))}
                  </div>

                  <p className="fieldHint">
                    * กำหนดระยะเวลาที่ต้องการให้ภาพนี้แสดงผลบนหน้าแรกก่อนเปลี่ยนไปสไลด์ถัดไป
                  </p>
                </div>
              )}
            </div>

            {/* ── Scheduling Date & Time Section ── */}
            <div className="timingSectionBox">
              <div className="timingSectionHeader">
                <div className="timingSectionTitle">
                  <CalendarClock size={16} className="text-teal-700" />
                  <span>ช่วงเวลาที่เปิดแสดงผลบนเว็บ (Schedule Period) *</span>
                </div>
              </div>

              {/* Start Date */}
              <div className="formGroup">
                <label htmlFor="startDate">วันและเวลาที่เริ่มแสดงผล *</label>
                <input
                  id="startDate"
                  type="datetime-local"
                  className="formInput dateInput"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  required
                />
              </div>

              {/* End Date */}
              <div className="formGroup">
                <label htmlFor="endDate">วันและเวลาที่สิ้นสุดการแสดงผล *</label>
                <input
                  id="endDate"
                  type="datetime-local"
                  className="formInput dateInput"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  required
                />
              </div>

              {/* Live Schedule Calculation Summary */}
              {formSchedulePreview && (
                <div className={`scheduleSummaryBanner ${formSchedulePreview.isInvalid ? 'bannerError' : 'bannerSuccess'}`}>
                  {formSchedulePreview.isInvalid ? (
                    <div className="summaryContent">
                      <AlertCircle size={16} />
                      <span>เวลาเริ่มต้นจะต้องเกิดก่อนเวลาสิ้นสุด</span>
                    </div>
                  ) : (
                    <div className="summaryContent">
                      <div className="summaryDates">
                        <span className="summaryDaysBadge">
                          🗓️ รวมระยะเวลา {formSchedulePreview.diffDays} วัน
                        </span>
                        <span className="summaryRange">
                          {formSchedulePreview.startFormatted} — {formSchedulePreview.endFormatted}
                        </span>
                      </div>
                      <div className="summaryStatusLine">
                        {formSchedulePreview.statusText}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="formGroup">
              <label htmlFor="displayOrder">ลำดับการแสดงผล (สไลด์ที่มีค่าน้อยกว่าจะขึ้นก่อน)</label>
              <div className="displayOrderWrapper">
                <button
                  type="button"
                  onClick={() => setDisplayOrder(prev => Math.max(1, prev - 1))}
                  className="counterBtn"
                >
                  -
                </button>
                <input
                  id="displayOrder"
                  type="number"
                  min="1"
                  className="formInput orderInput"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="1"
                />
                <button
                  type="button"
                  onClick={() => setDisplayOrder(prev => prev + 1)}
                  className="counterBtn"
                >
                  +
                </button>
              </div>
            </div>

            <div className="formButtonsRow">
              {editingId && (
                <button type="button" className="cancelEditBtn" onClick={handleCancelEdit}>
                  ยกเลิก
                </button>
              )}
              <button 
                type="submit" 
                className="submitBtn" 
                disabled={submitting || uploading || (formSchedulePreview?.isInvalid ?? false)}
              >
                {submitting ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกและเปิดใช้งาน')}
              </button>
            </div>
          </form>
        </div>

        {/* ── Slide List Section with Filters ── */}
        <div className="listSection card">
          <div className="listHeader">
            <h2>รายการสไลด์ทั้งหมด ({slides.length})</h2>
            <p className="listSubtext">
              <ArrowUpDown size={14} /> สามารถคลิกลากวางการ์ดเพื่อสลับลำดับการแสดงผลได้
            </p>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div className="listControlsBar">
            <div className="filterTabs">
              <button
                type="button"
                className={`filterTab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                ทั้งหมด ({counts.all})
              </button>
              <button
                type="button"
                className={`filterTab tab-active ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                กำลังแสดงผล ({counts.active})
              </button>
              <button
                type="button"
                className={`filterTab tab-upcoming ${activeTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                ตั้งเวลาล่วงหน้า ({counts.upcoming})
              </button>
              <button
                type="button"
                className={`filterTab tab-expired ${activeTab === 'expired' ? 'active' : ''}`}
                onClick={() => setActiveTab('expired')}
              >
                หมดอายุ ({counts.expired})
              </button>
            </div>

            <div className="searchBox">
              <Search size={14} className="searchIcon" />
              <input
                type="text"
                placeholder="ค้นหาชื่อสไลด์หรือลิงก์..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="searchInput"
              />
              {searchQuery && (
                <button type="button" className="clearSearchBtn" onClick={() => setSearchQuery('')}>
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredSlides.length > 0 ? (
            <div className="slidesList">
              {filteredSlides.map((slide, index) => {
                const status = getSlideStatus(slide.startDate, slide.endDate)
                const isDraggingThis = draggedItem?.id === slide.id
                const isSlideVideo = isVideoFile(slide.imagePath)
                const slideDurationSec = typeof slide.duration === 'number' && slide.duration >= 1 ? slide.duration : 6

                return (
                  <div 
                    key={slide.id} 
                    className={`slideItemCard ${isDraggingThis ? 'dragging' : ''} card-${status.key}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, slide)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div 
                      className={`slideImgWrapper ${isSlideVideo ? 'videoThumbnailWrapper' : ''}`}
                      onClick={() => {
                        if (isSlideVideo) setPreviewModalSlide(slide)
                      }}
                    >
                      {isSlideVideo ? (
                        <div className="slideVideoContainer">
                          <video
                            src={slide.imagePath}
                            muted
                            playsInline
                            loop
                            preload="metadata"
                            className="slideThumbnailVideo"
                            onError={(e) => console.warn('Thumbnail video notice:', e)}
                          >
                            <source src={slide.imagePath} type="video/mp4" />
                          </video>
                          <div className="videoBadge">
                            <Video size={12} />
                            <span>MP4</span>
                          </div>
                          <div className="videoPlayOverlayHover">
                            <Play size={20} fill="#ffffff" />
                          </div>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={slide.imagePath} alt={slide.title || 'Slide Image'} draggable={false} />
                      )}
                    </div>

                    <div className="slideItemDetails">
                      <div className="slideItemTitle">
                        <div>
                          {slide.title ? <h3>{slide.title}</h3> : <p className="noTitle">ไม่มีหัวข้อคำอธิบาย</p>}
                          <div className="slideSubInfo">
                            <span className="orderBadge">
                              <ArrowUpDown size={11} /> ลำดับ {slide.displayOrder}
                            </span>
                            {isSlideVideo ? (
                              <span className="slideDurationBadge videoDurationBadge">
                                <Film size={11} /> เล่นตามความยาววิดีโอ (จบแล้วเปลี่ยน)
                              </span>
                            ) : (
                              <span className="slideDurationBadge imageDurationBadge">
                                <Timer size={11} /> โชว์ {slideDurationSec} วินาที
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="statusContainer">
                          <span className={`statusPill ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="timeDetailText">{status.timeDetail}</span>
                        </div>
                      </div>
                      
                      <div className="slideItemMeta">
                        <div className="metaRow">
                          <Calendar size={13} className="metaIcon" />
                          <span><strong>เริ่ม:</strong> {formatThaiDateTime(slide.startDate)}</span>
                        </div>
                        <div className="metaRow">
                          <Clock size={13} className="metaIcon" />
                          <span><strong>สิ้นสุด:</strong> {formatThaiDateTime(slide.endDate)}</span>
                        </div>
                        {slide.linkUrl && (
                          <div className="metaRow urlRow">
                            <LinkIcon size={13} className="metaIcon" />
                            <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" draggable={false}>
                              ลิงก์: {slide.linkUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* ── Slide Action Buttons ── */}
                      <div className="slideBottomActions">
                        <div className="slideItemActions">
                          {isSlideVideo && (
                            <button
                              type="button"
                              onClick={() => setPreviewModalSlide(slide)}
                              className="previewVideoBtn"
                              draggable={false}
                            >
                              <Play size={13} fill="currentColor" /> เล่นตัวอย่าง
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEdit(slide)}
                            className="editSlideBtn"
                            draggable={false}
                          >
                            <Edit2 size={13} /> แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(slide.id)}
                            className="deleteSlideBtn"
                            draggable={false}
                          >
                            <Trash2 size={13} /> ลบ
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="emptySlides">
              <ImageIcon size={48} />
              <p>
                {searchQuery || activeTab !== 'all'
                  ? 'ไม่พบสไลด์ที่ตรงกับเงื่อนไขการค้นหา'
                  : 'ยังไม่มีการอัปโหลดสไลด์ภาพหัวแบนเนอร์'}
              </p>
              <span className="sub">ระบบจะแสดงผลรูปภาพแบนเนอร์เริ่มต้นของทางโรงพยาบาล</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Video Player Modal ── */}
      {previewModalSlide && (
        <div className="videoModalBackdrop" onClick={() => setPreviewModalSlide(null)}>
          <div className="videoModalContainer" onClick={(e) => e.stopPropagation()}>
            <div className="videoModalHeader">
              <div className="videoModalHeaderTitle">
                <Film size={18} className="text-teal-600" />
                <h3>{previewModalSlide.title || 'ตัวอย่างวิดีโอสไลด์'}</h3>
                <span className="videoModalTypeBadge">MP4 Video</span>
              </div>
              <button
                type="button"
                className="videoModalCloseBtn"
                onClick={() => setPreviewModalSlide(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="videoModalPlayerWrapper">
              <video
                src={previewModalSlide.imagePath}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="videoModalPlayer"
                onError={(e) => console.warn('Modal video playback notice:', e)}
              >
                <source src={previewModalSlide.imagePath} type="video/mp4" />
              </video>
            </div>

            <div className="videoModalFooter">
              <div className="videoModalMeta">
                <div>
                  <span className="label">ช่วงเวลาแสดงผล:</span>
                  <span className="val">
                    {formatThaiDateTime(previewModalSlide.startDate)} — {formatThaiDateTime(previewModalSlide.endDate)}
                  </span>
                </div>
                <div>
                  <span className="label">ลำดับแสดงผล:</span>
                  <span className="val">ลำดับที่ {previewModalSlide.displayOrder}</span>
                </div>
              </div>

              <div className="videoModalActions">
                <button
                  type="button"
                  onClick={() => handleEdit(previewModalSlide)}
                  className="modalEditBtn"
                >
                  <Edit2 size={14} /> แก้ไขสไลด์นี้
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalSlide(null)}
                  className="modalCloseBtn"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="ยืนยันการลบสไลด์ภาพ"
        description="ยืนยันที่จะลบสไลด์ภาพนี้ใช่หรือไม่? การลบจะทำให้ภาพหายไปจากหน้าแรกทันที"
        confirmText="ลบสไลด์ภาพ"
        cancelText="ยกเลิก"
        type="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}
