'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Eye, 
  Clock, 
  Edit2, 
  ArrowUpDown, 
  Video, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  X, 
  Sparkles,
  Film,
  CheckCircle2
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
}

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

export default function AdminSlidesPage() {
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  // Form State
  const [imagePath, setImagePath] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')
  const [isVideoPreview, setIsVideoPreview] = useState(false)
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [displayOrder, setDisplayOrder] = useState<number>(0)
  
  // Video Player Controls State (for upload form preview)
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)

  // Video Preview Modal (for list item preview)
  const [previewModalSlide, setPreviewModalSlide] = useState<SlideItem | null>(null)

  // Edit State
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
        setSlides(data.slides || [])
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

  const formatToDatetimeLocal = (isoString: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const tzoffset = d.getTimezoneOffset() * 60000 // offset in milliseconds
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16)
    return localISOTime
  }

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
    setDisplayOrder(slide.displayOrder || 0)
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
    setDisplayOrder(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setError('')
    setSuccess('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clean up temporary previous upload if not in edit mode
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

    // Show local preview instantly
    const localUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(localUrl)
    setIsVideoPlaying(true)
    setIsVideoMuted(true)

    setUploading(true)
    setError('')
    setSuccess('')

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
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          displayOrder: Number(displayOrder) || 0,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(editingId ? 'แก้ไขข้อมูลสไลด์ภาพเรียบร้อยแล้ว' : 'บันทึกสไลด์โชว์เรียบร้อยแล้ว')
        // Reset form
        setEditingId(null)
        setImagePath('')
        setLocalPreviewUrl('')
        setIsVideoPreview(false)
        setTitle('')
        setLinkUrl('')
        setStartDate('')
        setEndDate('')
        setDisplayOrder(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
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
        setSuccess('ลบสไลด์ภาพเรียบร้อยแล้ว')
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

  const [draggedItem, setDraggedItem] = useState<SlideItem | null>(null)

  const getSlideStatus = (startStr: string, endStr: string) => {
    const now = new Date()
    const start = new Date(startStr)
    const end = new Date(endStr)

    if (now < start) {
      return { label: 'กำลังมาถึง (Upcoming)', className: 'status-upcoming' }
    } else if (now > end) {
      return { label: 'หมดอายุ (Expired)', className: 'status-expired' }
    } else {
      return { label: 'กำลังแสดงผล (Active)', className: 'status-active' }
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, slide: SlideItem) => {
    setDraggedItem(slide)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', slide.id.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
    if (!draggedItem) return
    const draggedIndex = slides.findIndex((item) => item.id === draggedItem.id)
    if (draggedIndex === targetIndex) return

    const newSlides = [...slides]
    newSlides.splice(draggedIndex, 1)
    newSlides.splice(targetIndex, 0, draggedItem)

    const reorderedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      displayOrder: idx
    }))

    setSlides(reorderedSlides)
  }

  const handleDragEnd = async () => {
    setDraggedItem(null)
    try {
      setError('')
      const updates = slides.map((slide, idx) => ({
        id: slide.id,
        displayOrder: idx
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

  if (loading) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>กำลังโหลดรายการสไลด์ภาพ...</p>
      </div>
    )
  }

  const isCurrentVideo = isVideoPreview || isVideoFile(imagePath) || isVideoFile(localPreviewUrl)

  return (
    <div className="slidesAdminPage">
      <div className="pageHeader">
        <div>
          <h1>จัดการสไลด์โชว์ & วิดีโอหัวเว็บ</h1>
          <p className="subtext">อัปโหลด ตั้งเวลาเริ่มแสดงและหมดอายุของสไลด์โชว์รูปภาพและวิดีโอ MP4 ในหน้าแรกของเว็บไซต์</p>
        </div>
      </div>

      {error && <div className="slidesAlert alert-danger">{error}</div>}
      {success && <div className="slidesAlert alert-success">{success}</div>}

      <div className="slidesGrid">
        {/* Creation / Edit Form */}
        <div className="formSection card">
          <h2>{editingId ? 'แก้ไขข้อมูลสไลด์' : 'เพิ่มสไลด์ใหม่'}</h2>
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

            <div className="formRow">
              <div className="formGroup col-6">
                <label htmlFor="startDate">วันที่เริ่มให้แสดงบนเว็บ *</label>
                <input
                  id="startDate"
                  type="datetime-local"
                  className="formInput"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  required
                />
              </div>

              <div className="formGroup col-6">
                <label htmlFor="endDate">วันและเวลาที่สิ้นสุดการแสดงผล *</label>
                <input
                  id="endDate"
                  type="datetime-local"
                  className="formInput"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  required
                />
              </div>
            </div>

            <div className="formGroup">
              <label htmlFor="displayOrder">ลำดับการแสดงผล</label>
              <div className="displayOrderWrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setDisplayOrder(prev => Math.max(0, prev - 1))}
                  className="counterBtn"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none'
                  }}
                >
                  -
                </button>
                <input
                  id="displayOrder"
                  type="number"
                  min="0"
                  className="formInput"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  style={{
                    textAlign: 'center',
                    width: '80px',
                    margin: 0
                  }}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => setDisplayOrder(prev => prev + 1)}
                  className="counterBtn"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none'
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {editingId && (
                <button type="button" className="submitBtn" style={{ backgroundColor: '#64748b' }} onClick={handleCancelEdit}>
                  ยกเลิก
                </button>
              )}
              <button type="submit" className="submitBtn" style={{ flex: 1 }} disabled={submitting || uploading}>
                {submitting ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกและเปิดใช้งานตั้งเวลา')}
              </button>
            </div>
          </form>
        </div>

        {/* Existing List */}
        <div className="listSection card">
          <h2>รายการสไลด์ทั้งหมด ({slides.length})</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpDown size={14} /> สามารถคลิกค้างแล้วลากวางเพื่อสลับลำดับการแสดงผลได้ทันที (บนสุดแสดงเป็นอันดับแรก)
          </p>
          {slides.length > 0 ? (
            <div className="slidesList">
              {slides.map((slide, index) => {
                const status = getSlideStatus(slide.startDate, slide.endDate)
                const isDraggingThis = draggedItem?.id === slide.id
                const isSlideVideo = isVideoFile(slide.imagePath)

                return (
                  <div 
                    key={slide.id} 
                    className={`slideItemCard ${isDraggingThis ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, slide)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: 'grab' }}
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
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#0d9488', fontWeight: 'bold', marginTop: '4px' }}>
                            <ArrowUpDown size={12} />
                            <span>ลำดับที่: {slide.displayOrder}</span>
                            {isSlideVideo && (
                              <span style={{ marginLeft: '6px', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                🎥 วิดีโอ MP4
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`statusPill ${status.className}`}>{status.label}</span>
                      </div>
                      
                      <div className="slideItemMeta">
                        <div className="metaRow">
                          <Calendar size={14} />
                          <span>
                            เริ่ม: {new Date(slide.startDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                          </span>
                        </div>
                        <div className="metaRow">
                          <Clock size={14} />
                          <span>
                            สิ้นสุด: {new Date(slide.endDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                          </span>
                        </div>
                        {slide.linkUrl && (
                          <div className="metaRow urlRow">
                            <LinkIcon size={14} />
                            <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" draggable={false}>ลิงก์: {slide.linkUrl}</a>
                          </div>
                        )}
                      </div>

                      <div className="slideItemActions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {isSlideVideo && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalSlide(slide)}
                            className="previewVideoBtn"
                            draggable={false}
                          >
                            <Play size={13} fill="currentColor" /> ดูตัวอย่างวิดีโอ
                          </button>
                        )}
                        <button type="button" onClick={() => handleEdit(slide)} className="deleteSlideBtn" style={{ color: '#0f766e', borderColor: '#ccfbf1' }} draggable={false}>
                          <Edit2 size={14} /> แก้ไขข้อมูล
                        </button>
                        <button type="button" onClick={() => setDeleteTargetId(slide.id)} className="deleteSlideBtn" draggable={false}>
                          <Trash2 size={14} /> ลบสไลด์
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="emptySlides">
              <ImageIcon size={48} />
              <p>ยังไม่มีการอัปโหลดสไลด์ภาพหัวแบนเนอร์</p>
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
                    {new Date(previewModalSlide.startDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น. - {new Date(previewModalSlide.endDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
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
