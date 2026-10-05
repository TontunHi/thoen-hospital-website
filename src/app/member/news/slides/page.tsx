'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  X, 
  Sparkles,
  Film,
  CheckCircle2,
  AlertCircle,
  Timer,
  Zap,
  Sliders,
  Search,
  RefreshCw,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FastForward,
  Check,
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

  // Global Slide Duration Setting (seconds)
  const [slideDuration, setSlideDuration] = useState<number>(6)
  const [savingDuration, setSavingDuration] = useState(false)
  const [durationSavedFeedback, setDurationSavedFeedback] = useState(false)

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
  const [quickActionLoadingId, setQuickActionLoadingId] = useState<number | null>(null)

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
        if (typeof data.slideDuration === 'number') {
          setSlideDuration(data.slideDuration)
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

  // Quick Preset Helper for Start Date
  const setStartNow = () => {
    const nowStr = formatToDatetimeLocal(new Date().toISOString())
    setStartDate(nowStr)
    // If end date is empty or in the past, set default +30 days
    if (!endDate || new Date(endDate) <= new Date()) {
      const end = new Date()
      end.setDate(end.getDate() + 30)
      setEndDate(formatToDatetimeLocal(end.toISOString()))
    }
  }

  const setStartTomorrowMorning = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(8, 0, 0, 0)
    setStartDate(formatToDatetimeLocal(tomorrow.toISOString()))

    if (!endDate || new Date(endDate) <= tomorrow) {
      const end = new Date(tomorrow)
      end.setDate(end.getDate() + 30)
      setEndDate(formatToDatetimeLocal(end.toISOString()))
    }
  }

  const setStartNextMonthFirst = () => {
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1)
    nextMonth.setHours(0, 0, 0, 0)
    setStartDate(formatToDatetimeLocal(nextMonth.toISOString()))

    const end = new Date(nextMonth)
    end.setMonth(end.getMonth() + 1, 0) // last day of next month
    end.setHours(23, 59, 0, 0)
    setEndDate(formatToDatetimeLocal(end.toISOString()))
  }

  // Quick Preset Helper for Duration / End Date
  const applyDurationPreset = (days: number | 'fiscal' | 'year_end' | 'full_year') => {
    const base = startDate ? new Date(startDate) : new Date()
    const validBase = isNaN(base.getTime()) ? new Date() : base

    if (!startDate) {
      setStartDate(formatToDatetimeLocal(validBase.toISOString()))
    }

    const end = new Date(validBase)

    if (days === 'fiscal') {
      // Fiscal year ends on 30 September
      const curYear = validBase.getFullYear()
      const fiscalThisYear = new Date(curYear, 8, 30, 23, 59, 0) // Sep 30
      if (validBase > fiscalThisYear) {
        end.setFullYear(curYear + 1, 8, 30)
      } else {
        end.setFullYear(curYear, 8, 30)
      }
      end.setHours(23, 59, 0, 0)
    } else if (days === 'year_end') {
      // Calendar year ends on 31 December
      end.setMonth(11, 31)
      end.setHours(23, 59, 0, 0)
    } else if (days === 'full_year') {
      end.setFullYear(end.getFullYear() + 1)
    } else {
      end.setDate(end.getDate() + days)
    }

    setEndDate(formatToDatetimeLocal(end.toISOString()))
  }

  // Save Global Autoplay Duration
  const handleSaveGlobalDuration = async (newDuration: number) => {
    setSavingDuration(true)
    setError('')
    try {
      const res = await fetch('/api/hero-slides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideDuration: newDuration }),
      })
      const data = await res.json()
      if (res.ok) {
        setSlideDuration(newDuration)
        setDurationSavedFeedback(true)
        setTimeout(() => setDurationSavedFeedback(false), 3000)
      } else {
        setError(data.error || 'ไม่สามารถบันทึกความเร็วสไลด์ได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการบันทึกความเร็วสไลด์')
    } finally {
      setSavingDuration(false)
    }
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

    // Default dates if empty
    if (!startDate) setStartNow()

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
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(editingId ? 'แก้ไขข้อมูลสไลด์ภาพเรียบร้อยแล้ว' : 'บันทึกและตั้งเวลาแสดงผลสไลด์เรียบร้อยแล้ว')
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

  // Quick Action on Slide (Extend time or Publish Now)
  const handleQuickExtend = async (slide: SlideItem, extraDays: number) => {
    setQuickActionLoadingId(slide.id)
    setError('')
    try {
      const now = new Date()
      const currentEnd = new Date(slide.endDate)
      
      let newStart = new Date(slide.startDate)
      let newEnd = new Date()

      if (currentEnd < now) {
        // Expired -> Reactivate from NOW + extraDays
        newStart = now
        newEnd = new Date(now)
        newEnd.setDate(newEnd.getDate() + extraDays)
      } else {
        // Still active -> Extend from current end date + extraDays
        newEnd = new Date(currentEnd)
        newEnd.setDate(newEnd.getDate() + extraDays)
      }

      const res = await fetch(`/api/hero-slides/${slide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slide,
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        }),
      })

      if (res.ok) {
        setSuccess(`ขยายเวลาแสดงผลสไลด์ "${slide.title || 'ID ' + slide.id}" เพิ่ม ${extraDays} วันเรียบร้อยแล้ว`)
        fetchSlides()
      } else {
        const data = await res.json()
        setError(data.error || 'ไม่สามารถขยายเวลาแสดงผลได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setQuickActionLoadingId(null)
    }
  }

  const handleQuickPublishNow = async (slide: SlideItem) => {
    setQuickActionLoadingId(slide.id)
    setError('')
    try {
      const now = new Date()
      let newEnd = new Date(slide.endDate)
      
      if (newEnd <= now) {
        newEnd = new Date(now)
        newEnd.setDate(newEnd.getDate() + 30) // Default 30 days if it was expired
      }

      const res = await fetch(`/api/hero-slides/${slide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slide,
          startDate: now.toISOString(),
          endDate: newEnd.toISOString(),
        }),
      })

      if (res.ok) {
        setSuccess(`เปิดแสดงผลสไลด์ "${slide.title || 'ID ' + slide.id}" บนหน้าแรกทันทีเรียบร้อยแล้ว`)
        fetchSlides()
      } else {
        const data = await res.json()
        setError(data.error || 'ไม่สามารถเปิดแสดงผลได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setQuickActionLoadingId(null)
    }
  }

  const handleQuickDeactivate = async (slide: SlideItem) => {
    setQuickActionLoadingId(slide.id)
    setError('')
    try {
      const now = new Date()
      const res = await fetch(`/api/hero-slides/${slide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slide,
          endDate: now.toISOString(), // Expire immediately
        }),
      })

      if (res.ok) {
        setSuccess(`ปิดการแสดงผลสไลด์ "${slide.title || 'ID ' + slide.id}" เรียบร้อยแล้ว`)
        fetchSlides()
      } else {
        const data = await res.json()
        setError(data.error || 'ไม่สามารถปิดการแสดงผลได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setQuickActionLoadingId(null)
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

  // Get detailed status of a slide
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
      return { key: 'upcoming', label: 'กำลังมาถึง (Upcoming)', className: 'status-upcoming', timeDetail }
    } else if (now > end) {
      const diffMs = now.getTime() - end.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const timeDetail = diffDays > 0 ? `หมดอายุไปแล้ว ${diffDays} วัน` : `เพิ่งหมดอายุวันนี้`
      return { key: 'expired', label: 'หมดอายุแล้ว (Expired)', className: 'status-expired', timeDetail }
    } else {
      const diffMs = end.getTime() - now.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const timeDetail = diffDays > 0 ? `เหลือเวลาอีก ${diffDays} วัน ${diffHours} ชม.` : `เหลือเวลาอีก ${diffHours} ชม.`
      return { key: 'active', label: 'กำลังแสดงผล (Live)', className: 'status-active', timeDetail }
    }
  }

  // Drag and Drop handlers
  const [draggedItem, setDraggedItem] = useState<SlideItem | null>(null)

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
    let statusText = '🟢 สไลด์จะเริ่มแสดงผลทันทีหลังบันทึก'
    if (now < s) {
      previewStatus = 'upcoming'
      statusText = '🟡 สไลด์จะรอเริ่มแสดงผลตามเวลาที่กำหนด (ตั้งเวลาล่วงหน้า)'
    } else if (now > e) {
      previewStatus = 'expired'
      statusText = '🔴 เวลาสิ้นสุดผ่านไปแล้ว สไลด์นี้จะไม่แสดงบนหน้าแรก'
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

  const isCurrentVideo = isVideoPreview || isVideoFile(imagePath) || isVideoFile(localPreviewUrl)

  return (
    <div className="slidesAdminPage">
      {/* ── Page Header & Stats Summary ── */}
      <div className="pageHeader">
        <div className="headerLeft">
          <h1>จัดการสไลด์โชว์ & กำหนดเวลาแสดงผล</h1>
          <p className="subtext">
            อัปโหลด กำหนดช่วงวัน-เวลาเริ่มและสิ้นสุดการแสดงผล และปรับความเร็วของสไลด์โชว์หน้าแรก
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

      {/* ── Global Autoplay Speed Control Card ── */}
      <div className="durationControlCard card">
        <div className="durationHeader">
          <div className="durationTitle">
            <Sliders size={18} className="icon-emerald" />
            <div>
              <h3>ความเร็วในการเปลี่ยนสไลด์อัตโนมัติ (Autoplay Duration)</h3>
              <p className="durationSub">กำหนดเวลาแสดงผลของแต่ละภาพนิ่งบนหน้าแรก ก่อนจะเปลี่ยนไปสไลด์ถัดไป (วิดีโอจะเล่นจนจบอัตโนมัติ)</p>
            </div>
          </div>
          <div className="durationCurrentBadge">
            <Timer size={14} />
            <span>ปัจจุบัน: <strong>{slideDuration} วินาที</strong> ต่อสไลด์</span>
            {durationSavedFeedback && (
              <span className="savedFeedbackBadge">
                <Check size={12} /> บันทึกแล้ว
              </span>
            )}
          </div>
        </div>

        <div className="durationPresetsRow">
          <span className="presetLabel">เลือกความเร็ว:</span>
          {[3, 4, 5, 6, 8, 10, 15].map((sec) => (
            <button
              key={sec}
              type="button"
              className={`durationPresetBtn ${slideDuration === sec ? 'active' : ''}`}
              onClick={() => handleSaveGlobalDuration(sec)}
              disabled={savingDuration}
            >
              {sec} วินาที {sec === 6 ? '(มาตรฐาน)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Grid Layout ── */}
      <div className="slidesGrid">
        {/* Creation / Edit Form */}
        <div className="formSection card">
          <div className="formHeaderTitle">
            <h2>{editingId ? 'แก้ไขข้อมูลและกำหนดเวลาสไลด์' : 'เพิ่มสไลด์ใหม่ & กำหนดเวลา'}</h2>
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

            {/* ── Scheduling Date & Time Section ── */}
            <div className="timingSectionBox">
              <div className="timingSectionHeader">
                <div className="timingSectionTitle">
                  <CalendarClock size={16} className="text-emerald-700" />
                  <span>กำหนดเวลาแสดงผล (Schedule Period) *</span>
                </div>
              </div>

              {/* Start Date & Presets */}
              <div className="formGroup">
                <div className="labelWithPresets">
                  <label htmlFor="startDate">วันและเวลาที่เริ่มแสดงผล *</label>
                  <div className="presetTags">
                    <button type="button" className="presetTagBtn" onClick={setStartNow}>
                      ⚡ เริ่มทันที
                    </button>
                    <button type="button" className="presetTagBtn" onClick={setStartTomorrowMorning}>
                      🌅 พรุ่งนี้ 08:00
                    </button>
                    <button type="button" className="presetTagBtn" onClick={setStartNextMonthFirst}>
                      📅 วันที่ 1 เดือนหน้า
                    </button>
                  </div>
                </div>
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

              {/* End Date & Duration Presets */}
              <div className="formGroup">
                <div className="labelWithPresets">
                  <label htmlFor="endDate">วันและเวลาที่สิ้นสุดการแสดงผล *</label>
                  <div className="presetTags durationTagList">
                    <span className="tagGroupLabel">ระยะเวลา:</span>
                    <button type="button" className="presetTagBtn" onClick={() => applyDurationPreset(7)}>
                      7 วัน
                    </button>
                    <button type="button" className="presetTagBtn" onClick={() => applyDurationPreset(15)}>
                      15 วัน
                    </button>
                    <button type="button" className="presetTagBtn" onClick={() => applyDurationPreset(30)}>
                      30 วัน (1 ด.)
                    </button>
                    <button type="button" className="presetTagBtn" onClick={() => applyDurationPreset(60)}>
                      60 วัน (2 ด.)
                    </button>
                    <button type="button" className="presetTagBtn" onClick={() => applyDurationPreset(90)}>
                      90 วัน (3 ด.)
                    </button>
                    <button type="button" className="presetTagBtn tagSpecial" onClick={() => applyDurationPreset('fiscal')} title="สิ้นปีงบประมาณ 30 กันยายน">
                      สิ้นปีงบฯ
                    </button>
                    <button type="button" className="presetTagBtn tagSpecial" onClick={() => applyDurationPreset('year_end')} title="สิ้นปีปฏิทิน 31 ธันวาคม">
                      สิ้นปี 31 ธ.ค.
                    </button>
                    <button type="button" className="presetTagBtn" onClick={() => applyDurationPreset('full_year')}>
                      1 ปี
                    </button>
                  </div>
                </div>
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
                          ⏱️ รวม {formSchedulePreview.diffDays} วัน
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
                  onClick={() => setDisplayOrder(prev => Math.max(0, prev - 1))}
                  className="counterBtn"
                >
                  -
                </button>
                <input
                  id="displayOrder"
                  type="number"
                  min="0"
                  className="formInput orderInput"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  placeholder="0"
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
                {submitting ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกและเปิดใช้งานตามกำหนดเวลา')}
              </button>
            </div>
          </form>
        </div>

        {/* ── Slide List Section with Filters & Quick Controls ── */}
        <div className="listSection card">
          <div className="listHeader">
            <h2>รายการสไลด์ทั้งหมด ({slides.length})</h2>
            <p className="listSubtext">
              <ArrowUpDown size={14} /> ลากวางเพื่อสลับลำดับ หรือใช้ปุ่มด่วนเพื่อขยายเวลาแสดงผลได้ทันที
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
                🟢 กำลังแสดงผล ({counts.active})
              </button>
              <button
                type="button"
                className={`filterTab tab-upcoming ${activeTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                🟡 ตั้งเวลาล่วงหน้า ({counts.upcoming})
              </button>
              <button
                type="button"
                className={`filterTab tab-expired ${activeTab === 'expired' ? 'active' : ''}`}
                onClick={() => setActiveTab('expired')}
              >
                🔴 หมดอายุ ({counts.expired})
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
                const isActionBusy = quickActionLoadingId === slide.id

                return (
                  <div 
                    key={slide.id} 
                    className={`slideItemCard ${isDraggingThis ? 'dragging' : ''} card-${status.key}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, slide)}
                    onDragOver={(e) => handleDragOver(e, index)}
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
                            <ArrowUpDown size={12} />
                            <span>ลำดับที่: {slide.displayOrder}</span>
                            {isSlideVideo && (
                              <span className="videoTag">🎥 วิดีโอ MP4</span>
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
                          <Calendar size={14} className="metaIcon" />
                          <span><strong>เริ่ม:</strong> {formatThaiDateTime(slide.startDate)}</span>
                        </div>
                        <div className="metaRow">
                          <Clock size={14} className="metaIcon" />
                          <span><strong>สิ้นสุด:</strong> {formatThaiDateTime(slide.endDate)}</span>
                        </div>
                        {slide.linkUrl && (
                          <div className="metaRow urlRow">
                            <LinkIcon size={14} className="metaIcon" />
                            <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" draggable={false}>
                              ลิงก์: {slide.linkUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* ── Quick Timing Actions & Admin Buttons ── */}
                      <div className="slideBottomActions">
                        {/* Quick Timing Extenders */}
                        <div className="quickTimingButtons">
                          {status.key === 'expired' && (
                            <>
                              <button
                                type="button"
                                className="quickBtn extendBtn"
                                onClick={() => handleQuickExtend(slide, 7)}
                                disabled={isActionBusy}
                                title="เปิดแสดงผลใหม่เป็นเวลา 7 วัน"
                              >
                                ⚡ ต่อเวลา +7 วัน
                              </button>
                              <button
                                type="button"
                                className="quickBtn extendBtn"
                                onClick={() => handleQuickExtend(slide, 30)}
                                disabled={isActionBusy}
                                title="เปิดแสดงผลใหม่เป็นเวลา 30 วัน"
                              >
                                ⚡ ต่อเวลา +30 วัน
                              </button>
                            </>
                          )}

                          {status.key === 'upcoming' && (
                            <button
                              type="button"
                              className="quickBtn publishNowBtn"
                              onClick={() => handleQuickPublishNow(slide)}
                              disabled={isActionBusy}
                              title="เริ่มแสดงผลบนหน้าแรกทันที (ไม่ต้องรอเวลาเริ่มต้น)"
                            >
                              🚀 แสดงผลทันที
                            </button>
                          )}

                          {status.key === 'active' && (
                            <>
                              <button
                                type="button"
                                className="quickBtn extendBtn"
                                onClick={() => handleQuickExtend(slide, 30)}
                                disabled={isActionBusy}
                                title="ขยายเวลาสิ้นสุดเพิ่มอีก 30 วัน"
                              >
                                ⏰ +30 วัน
                              </button>
                              <button
                                type="button"
                                className="quickBtn deactivateBtn"
                                onClick={() => handleQuickDeactivate(slide)}
                                disabled={isActionBusy}
                                title="ปิดการแสดงผลบนหน้าแรกทันที"
                              >
                                ⏹️ พักสไลด์
                              </button>
                            </>
                          )}
                        </div>

                        {/* Standard Edit/Delete Actions */}
                        <div className="slideItemActions">
                          {isSlideVideo && (
                            <button
                              type="button"
                              onClick={() => setPreviewModalSlide(slide)}
                              className="previewVideoBtn"
                              draggable={false}
                            >
                              <Play size={13} fill="currentColor" /> ตัวอย่าง
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
