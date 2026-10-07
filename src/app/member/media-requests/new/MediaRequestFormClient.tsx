'use client'

import React, { useState, useTransition, useEffect, useId, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Palette,
  User,
  Phone,
  Building,
  UploadCloud,
  X,
  Link as LinkIcon,
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle,
  ChevronRight,
  FileCheck,
  ArrowLeft,
  Check,
  Info,
  Sparkles,
  CalendarDays,
  FileSpreadsheet,
  FileImage,
  FileText,
  FileArchive,
  Clock,
  ShieldCheck,
  Zap,
  CheckCircle,
  HelpCircle,
} from 'lucide-react'
import './mediaRequest.css'

interface CurrentMember {
  id: number
  username: string
  name: string
  department: string
  position: string
  email?: string
  phone?: string
}

interface MediaRequestFormClientProps {
  currentUser: CurrentMember
}

// Predefined Work Types with quick assist tags
const WORK_TYPES_CONFIG = [
  { key: 'tri_fold', label: 'แผ่นพับ 3 พับ', icon: '📄', hasCustomInput: false },
  { key: 'website_aw', label: 'AW ขึ้นเว็บไซต์', icon: '🌐', hasCustomInput: false },
  {
    key: 'poster',
    label: 'โปสเตอร์',
    icon: '🖼️',
    hasCustomInput: true,
    placeholder: 'ระบุขนาด เช่น A3, A2, 60x90 ซม.…',
    quickTags: ['A4', 'A3', 'A2', '60x90 ซม.'],
  },
  { key: 'staff_card', label: 'บัตรพนักงาน', icon: '🪪', hasCustomInput: false },
  { key: 'announcement_board', label: 'ป้ายประกาศ', icon: '📌', hasCustomInput: false },
  { key: 'sticker', label: 'สติ๊กเกอร์', icon: '🏷️', hasCustomInput: false },
  { key: 'video_editing', label: 'ตัดต่อวิดีโอ', icon: '🎬', hasCustomInput: false },
  { key: 'powerpoint', label: 'PowerPoint', icon: '📊', hasCustomInput: false },
  {
    key: 'other',
    label: 'อื่น ๆ',
    icon: '✨',
    hasCustomInput: true,
    placeholder: 'ระบุลักษณะงาน เช่น ไวนิล, Standee, Roll-up…',
    quickTags: ['ไวนิล', 'Standee', 'Roll-up', 'ป้ายโฟมบอร์ด', 'ของที่ระลึก'],
  },
]

// Predefined Channels with quick assist tags
const CHANNELS_CONFIG = [
  { key: 'hospital_social', label: 'สื่อโซเชียลของรพ.', icon: '📱', hasCustomInput: false },
  { key: 'facebook_page', label: 'Page Facebook', icon: '🌐', hasCustomInput: false },
  {
    key: 'indoor',
    label: 'ในอาคารโรงพยาบาล',
    icon: '🏥',
    hasCustomInput: true,
    placeholder: 'ระบุบริเวณ เช่น หน้าห้องตรวจ OPD, โถงประชาสัมพันธ์ชั้น 1…',
    quickTags: ['หน้าห้องตรวจ OPD', 'โถงประชาสัมพันธ์ ชั้น 1', 'แผนกฉุกเฉิน (ER)', 'ตึกผู้ป่วยใน (IPD)'],
  },
  {
    key: 'community',
    label: 'ในชุมชน',
    icon: '🏘️',
    hasCustomInput: true,
    placeholder: 'ระบุจุด/ชุมชน เช่น รพ.สต. ในเครือข่าย, ชุมชนเทศบาลเถิน…',
    quickTags: ['รพ.สต. ในเครือข่าย', 'ชุมชนเทศบาลเถิน', 'ออกหน่วยบริการ'],
  },
  {
    key: 'other',
    label: 'อื่น ๆ',
    icon: '📣',
    hasCustomInput: true,
    placeholder: 'ระบุช่องทางเผยแพร่เพิ่มเติม…',
  },
]

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return <FileImage aria-hidden="true" className="w-4 h-4 text-emerald-600 shrink-0" />
  }
  if (['pdf', 'doc', 'docx'].includes(ext)) {
    return <FileText aria-hidden="true" className="w-4 h-4 text-blue-600 shrink-0" />
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet aria-hidden="true" className="w-4 h-4 text-teal-600 shrink-0" />
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive aria-hidden="true" className="w-4 h-4 text-amber-600 shrink-0" />
  }
  return <FileCheck aria-hidden="true" className="w-4 h-4 text-teal-600 shrink-0" />
}

function formatThaiDeliveryPreview(dateStr: string): string | null {
  if (!dateStr) return null
  try {
    const parts = dateStr.split('-')
    if (parts.length !== 3) return null
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const d = new Date(year, month, day)
    if (isNaN(d.getTime())) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = d.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const thaiFormatted = new Intl.DateTimeFormat('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)

    let diffBadge = ''
    if (diffDays === 0) diffBadge = ' (กำหนดส่ง: วันนี้)'
    else if (diffDays === 1) diffBadge = ' (กำหนดส่ง: พรุ่งนี้)'
    else if (diffDays > 1) diffBadge = ` (อีก ${diffDays} วัน)`
    else if (diffDays < 0) diffBadge = ` (ย้อนหลัง ${Math.abs(diffDays)} วัน)`

    return `${thaiFormatted}${diffBadge}`
  } catch {
    return null
  }
}

export default function MediaRequestFormClient({ currentUser }: MediaRequestFormClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form Field IDs for Accessibility
  const titleInputId = useId()
  const deliveryDateInputId = useId()
  const descriptionInputId = useId()
  const phoneInputId = useId()
  const driveLinkInputId = useId()

  // Form Fields State
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'VERY_URGENT'>('NORMAL')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [costType, setCostType] = useState<'NO_COST' | 'HAS_COST'>('NO_COST')

  // Selected Work Types { [key]: { selected: boolean, customDetail: string } }
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<
    Record<string, { selected: boolean; customDetail: string }>
  >({})

  // Selected Channels { [key]: { selected: boolean, customDetail: string } }
  const [selectedChannels, setSelectedChannels] = useState<
    Record<string, { selected: boolean; customDetail: string }>
  >({})

  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState(currentUser.phone || '')
  const [driveLink, setDriveLink] = useState('')

  // Attachments State
  const [uploadedFiles, setUploadedFiles] = useState<
    { fileName: string; filePath: string; fileType?: string; fileSize?: number }[]
  >([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [createdTaskInfo, setCreatedTaskInfo] = useState<{ taskId: string; taskNo: string } | null>(
    null
  )

  // Current Thai Date for Display
  const thaiDateFormatted = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'full',
  }).format(new Date())

  // Today for date minimum limit
  const todayDateString = new Date().toISOString().split('T')[0]

  // Delivery Date Thai preview
  const deliveryDatePreview = useMemo(() => formatThaiDeliveryPreview(deliveryDate), [deliveryDate])

  // Unsaved Changes Guard
  useEffect(() => {
    const isDirty =
      title.trim() !== '' ||
      deliveryDate !== '' ||
      description.trim() !== '' ||
      driveLink.trim() !== '' ||
      uploadedFiles.length > 0 ||
      Object.values(selectedWorkTypes).some((v) => v.selected) ||
      Object.values(selectedChannels).some((v) => v.selected)

    if (!isDirty || isSuccessModalOpen) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [
    title,
    deliveryDate,
    description,
    driveLink,
    uploadedFiles.length,
    selectedWorkTypes,
    selectedChannels,
    isSuccessModalOpen,
  ])

  // Escape key handler for modal
  useEffect(() => {
    if (!isSuccessModalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSuccessModalOpen(false)
        if (createdTaskInfo) {
          router.push(`/member/inbox/${createdTaskInfo.taskId}`)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSuccessModalOpen, createdTaskInfo, router])

  // Quick date setter
  const setDaysFromNow = (days: number) => {
    const target = new Date()
    target.setDate(target.getDate() + days)
    const yyyy = target.getFullYear()
    const mm = String(target.getMonth() + 1).padStart(2, '0')
    const dd = String(target.getDate()).padStart(2, '0')
    setDeliveryDate(`${yyyy}-${mm}-${dd}`)
  }

  // Work Type Toggle
  const toggleWorkType = (key: string) => {
    setSelectedWorkTypes((prev) => {
      const current = prev[key] || { selected: false, customDetail: '' }
      return {
        ...prev,
        [key]: { ...current, selected: !current.selected },
      }
    })
  }

  const setWorkTypeDetail = (key: string, detail: string) => {
    setSelectedWorkTypes((prev) => {
      const current = prev[key] || { selected: true, customDetail: '' }
      return {
        ...prev,
        [key]: { ...current, customDetail: detail },
      }
    })
  }

  // Channel Toggle
  const toggleChannel = (key: string) => {
    setSelectedChannels((prev) => {
      const current = prev[key] || { selected: false, customDetail: '' }
      return {
        ...prev,
        [key]: { ...current, selected: !current.selected },
      }
    })
  }

  const setChannelDetail = (key: string, detail: string) => {
    setSelectedChannels((prev) => {
      const current = prev[key] || { selected: true, customDetail: '' }
      return {
        ...prev,
        [key]: { ...current, customDetail: detail },
      }
    })
  }

  // Append quick tag into detail
  const handleQuickTagClick = (
    setter: (k: string, d: string) => void,
    key: string,
    currentVal: string,
    tag: string
  ) => {
    if (!currentVal) {
      setter(key, tag)
    } else if (!currentVal.includes(tag)) {
      setter(key, `${currentVal}, ${tag}`)
    }
  }

  // Insert template helper into description
  const appendDescriptionHelper = (snippet: string) => {
    setDescription((prev) => (prev ? `${prev}\n- ${snippet}: ` : `- ${snippet}: `))
  }

  // Process Files Upload (handles both input select and drag-and-drop)
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    setErrorBanner(null)

    try {
      const newFiles: { fileName: string; filePath: string; fileType?: string; fileSize?: number }[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (file.size > 25 * 1024 * 1024) {
          throw new Error(`ไฟล์ "${file.name}" มีขนาดเกิน 25MB`)
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', `media-req-${currentUser.username}`)

        const res = await fetch('/api/member/upload', {
          method: 'POST',
          body: formData,
        })

        const result = await res.json()
        if (!res.ok) {
          throw new Error(result.error || `อัปโหลด ${file.name} ไม่สำเร็จ`)
        }

        newFiles.push({
          fileName: file.name,
          filePath: result.url,
          fileType: file.type,
          fileSize: file.size,
        })
      }

      setUploadedFiles((prev) => [...prev, ...newFiles])
    } catch (err: any) {
      setErrorBanner(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)

    // Validation
    if (!title.trim()) {
      setErrorBanner('กรุณาระบุเรื่อง / หัวข้องานสื่อประชาสัมพันธ์')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (!deliveryDate) {
      setErrorBanner('กรุณาระบุวันที่ขอรับงาน')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const activeWorkTypes = Object.entries(selectedWorkTypes)
      .filter(([_, val]) => val.selected)
      .map(([key, val]) => {
        const cfg = WORK_TYPES_CONFIG.find((c) => c.key === key)
        return {
          key,
          label: cfg?.label || key,
          customDetail: val.customDetail?.trim() || null,
        }
      })

    if (activeWorkTypes.length === 0) {
      setErrorBanner('กรุณาเลือกลักษณะงานอย่างน้อย 1 รายการ')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const activeChannels = Object.entries(selectedChannels)
      .filter(([_, val]) => val.selected)
      .map(([key, val]) => {
        const cfg = CHANNELS_CONFIG.find((c) => c.key === key)
        return {
          key,
          label: cfg?.label || key,
          customDetail: val.customDetail?.trim() || null,
        }
      })

    if (activeChannels.length === 0) {
      setErrorBanner('กรุณาเลือกช่องทางเผยแพร่อย่างน้อย 1 รายการ')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (!description.trim()) {
      setErrorBanner('กรุณาระบุรายละเอียดงานให้ชัดเจน')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (!phone.trim()) {
      setErrorBanner('กรุณาระบุเบอร์โทรส่วนตัว / แผนก')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const payload = {
      title: title.trim(),
      urgency,
      deliveryDate,
      costType,
      workTypes: activeWorkTypes,
      channels: activeChannels,
      description: description.trim(),
      phone: phone.trim(),
      attachments: uploadedFiles,
      driveLink: driveLink.trim() || null,
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/member/media-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await res.json()
        if (!res.ok) {
          throw new Error(result.error || 'เกิดข้อผิดพลาดในการยื่นคำขอ')
        }

        setCreatedTaskInfo(result.data)
        setIsSuccessModalOpen(true)
      } catch (err: any) {
        setErrorBanner(err.message || 'เกิดข้อผิดพลาดในการส่งคำขอ')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  // Check if external printing or physical work might need cost
  const mightNeedCost =
    costType === 'NO_COST' &&
    ((selectedWorkTypes.other?.selected &&
      (selectedWorkTypes.other.customDetail.includes('ไวนิล') ||
        selectedWorkTypes.other.customDetail.toLowerCase().includes('standee') ||
        selectedWorkTypes.other.customDetail.toLowerCase().includes('roll-up') ||
        selectedWorkTypes.other.customDetail.toLowerCase().includes('rollup'))) ||
      selectedWorkTypes.announcement_board?.selected ||
      selectedWorkTypes.sticker?.selected)

  // Validation Status Items for Sidebar Checklist
  const validationItems = [
    { label: 'ระบุเรื่อง / หัวข้องาน', valid: title.trim().length >= 2 },
    { label: 'กำหนดวันขอรับงานเสร็จ', valid: !!deliveryDate },
    {
      label: 'เลือกลักษณะงาน (อย่างน้อย 1)',
      valid: Object.values(selectedWorkTypes).some((v) => v.selected),
    },
    {
      label: 'เลือกช่องทางเผยแพร่ (อย่างน้อย 1)',
      valid: Object.values(selectedChannels).some((v) => v.selected),
    },
    { label: 'ระบุรายละเอียดงานครบถ้วน', valid: description.trim().length >= 5 },
    { label: 'ระบุเบอร์โทรส่วนตัว / แผนก', valid: phone.trim().length >= 1 },
  ]

  const isFormValid = validationItems.every((item) => item.valid)

  return (
    <div className="media-form-container">
      {/* Top Navigation Bar */}
      <nav aria-label="นำทางแบบฟอร์ม" className="mediaFormNav">
        <Link href="/member/media-requests" className="mediaNavBackLink">
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          <span>กลับหน้ารายการคำขอสื่อ</span>
        </Link>
        <div className="mediaNavLocationBadge">
          <Building aria-hidden="true" className="w-3.5 h-3.5 text-teal-600" />
          <span>โรงพยาบาลเถิน จ.ลำปาง • กลุ่มงานดิจิทัลทางการแพทย์</span>
        </div>
      </nav>

      {/* Main Form Shell */}
      <div className="mediaFormCard">
        {/* Hero Form Header */}
        <header className="mediaFormHeader">
          <div className="mediaHeaderInner">
            <div>
              <div className="mediaHeaderBadge">
                <Palette aria-hidden="true" className="w-3.5 h-3.5" />
                Hospital PR & Digital Media Requisition
              </div>
              <h1 className="mediaHeaderTitle">
                แบบฟอร์มขอรับบริการสื่อประชาสัมพันธ์
              </h1>
              <p className="mediaHeaderSubtitle">
                ส่งความต้องการผลิตสื่อเพื่อเข้าสู่ระบบพิจารณาอนุมัติและลงนามอิเล็กทรอนิกส์ (e-Signature)
              </p>
            </div>
            <div className="mediaHeaderDateBox">
              <div className="flex items-center gap-1.5 justify-end">
                <CalendarDays aria-hidden="true" className="w-3.5 h-3.5 text-teal-200" />
                <span className="mediaDateLabel">วันที่ทำรายการ</span>
              </div>
              <span className="mediaDateValue tabularNums">{thaiDateFormatted}</span>
            </div>
          </div>
        </header>

        {/* Error Banner with Live Region */}
        {errorBanner && (
          <div role="alert" aria-live="polite" className="errorBanner">
            <AlertCircle aria-hidden="true" className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="errorBannerText">{errorBanner}</div>
          </div>
        )}

        {/* 2-Column Responsive Workspace Grid */}
        <form onSubmit={handleSubmit} className="mediaLayoutGrid" noValidate>
          {/* ── Left Column: Primary Requisition Canvas (8 cols) ── */}
          <div className="mediaCanvasCol">
            {/* Section 1: Core Project Brief */}
            <section className="sectionBox" aria-labelledby="section-brief-title">
              <div className="sectionHeader">
                <div className="sectionNumberBadge" aria-hidden="true">1</div>
                <div>
                  <h2 id="section-brief-title" className="sectionTitleText">
                    เรื่องและรายละเอียดงาน
                    <span className="requiredAsterisk" aria-hidden="true">*</span>
                  </h2>
                  <p className="sectionSubtext">ระบุชื่อหัวข้อและเนื้อหาที่ต้องการให้ออกแบบผลิตสื่อ</p>
                </div>
              </div>

              <div className="formGroup">
                <label htmlFor={titleInputId} className="formLabel">
                  เรื่อง / หัวข้องานสื่อประชาสัมพันธ์ <span className="requiredAsterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id={titleInputId}
                  name="title"
                  type="text"
                  autoComplete="off"
                  className="formInput titleInput"
                  placeholder="เช่น ขอความอนุเคราะห์จัดทำโปสเตอร์ประชาสัมพันธ์งานสัปดาห์เภสัชกรรม 2569"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="formGroup" style={{ marginTop: '1.25rem' }}>
                <div className="flex items-center justify-between">
                  <label htmlFor={descriptionInputId} className="formLabel">
                    รายละเอียดเนื้อหาและข้อกำหนดพิเศษ <span className="requiredAsterisk" aria-hidden="true">*</span>
                  </label>
                  <span className="charCounter tabularNums">{description.length} ตัวอักษร</span>
                </div>
                <textarea
                  id={descriptionInputId}
                  name="description"
                  className="formTextarea"
                  rows={6}
                  placeholder="ระบุข้อความ/เนื้อหาที่ต้องการให้ใส่ในสื่อ, แนวทางโทนสี, กลุ่มเป้าหมายผู้รับชม, หรือข้อกำหนดพิเศษอื่น ๆ…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />

                {/* Quick Helper Chips for Description */}
                <div className="descHelperBar">
                  <span className="descHelperLabel">ตัวช่วยเติมหัวข้อ:</span>
                  <button
                    type="button"
                    className="descHelperBtn"
                    onClick={() => appendDescriptionHelper('กลุ่มเป้าหมาย')}
                  >
                    + กลุ่มเป้าหมาย
                  </button>
                  <button
                    type="button"
                    className="descHelperBtn"
                    onClick={() => appendDescriptionHelper('โทนสี/แนวทางภาพ')}
                  >
                    + โทนสี/แนวทางภาพ
                  </button>
                  <button
                    type="button"
                    className="descHelperBtn"
                    onClick={() => appendDescriptionHelper('ข้อความหลักที่ต้องมี')}
                  >
                    + ข้อความหลักที่ต้องมี
                  </button>
                  <button
                    type="button"
                    className="descHelperBtn"
                    onClick={() => appendDescriptionHelper('วัตถุประสงค์')}
                  >
                    + วัตถุประสงค์
                  </button>
                </div>
              </div>
            </section>

            {/* Section 2: Work Characteristics Matrix */}
            <section className="sectionBox" aria-labelledby="section-worktypes-title">
              <div className="sectionHeader">
                <div className="sectionNumberBadge" aria-hidden="true">2</div>
                <div>
                  <h2 id="section-worktypes-title" className="sectionTitleText">
                    ลักษณะงานสื่อที่ต้องการ (เลือกได้หลายรายการ)
                    <span className="requiredAsterisk" aria-hidden="true">*</span>
                  </h2>
                  <p className="sectionSubtext">เลือกรูปแบบของสื่อที่ต้องการให้กลุ่มงานดิจิทัลผลิต</p>
                </div>
              </div>

              <div className="checkboxCardGrid">
                {WORK_TYPES_CONFIG.map((item) => {
                  const isSelected = !!selectedWorkTypes[item.key]?.selected
                  const currentDetail = selectedWorkTypes[item.key]?.customDetail || ''

                  return (
                    <div
                      key={item.key}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={isSelected}
                      className={`selectableCard ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleWorkType(item.key)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          toggleWorkType(item.key)
                        }
                      }}
                    >
                      <div className="selectableCardHeader">
                        <div className="customCheckbox" aria-hidden="true">
                          {isSelected && <Check aria-hidden="true" className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="selectableCardIcon" aria-hidden="true">{item.icon}</span>
                        <span className="selectableCardLabel">{item.label}</span>
                      </div>

                      {item.hasCustomInput && isSelected && (
                        <div className="customDetailInputWrap" onClick={(e) => e.stopPropagation()}>
                          <label htmlFor={`worktype-detail-${item.key}`} className="sr-only">
                            ระบุรายละเอียดสำหรับ {item.label}
                          </label>
                          <input
                            id={`worktype-detail-${item.key}`}
                            name={`workType_${item.key}_detail`}
                            type="text"
                            className="customDetailInput"
                            placeholder={item.placeholder}
                            value={currentDetail}
                            aria-label={`ระบุรายละเอียดสำหรับ ${item.label}`}
                            onChange={(e) => setWorkTypeDetail(item.key, e.target.value)}
                            autoFocus
                          />

                          {item.quickTags && item.quickTags.length > 0 && (
                            <div className="quickTagsWrap">
                              <span className="quickTagsLabel">ขนาดแนะนำ:</span>
                              {item.quickTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  className="quickTagPill"
                                  onClick={() =>
                                    handleQuickTagClick(setWorkTypeDetail, item.key, currentDetail, tag)
                                  }
                                >
                                  + {tag}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Section 3: Distribution Channels Matrix */}
            <section className="sectionBox" aria-labelledby="section-channels-title">
              <div className="sectionHeader">
                <div className="sectionNumberBadge" aria-hidden="true">3</div>
                <div>
                  <h2 id="section-channels-title" className="sectionTitleText">
                    ต้องการเผยแพร่ทางช่องทางใด (เลือกได้หลายรายการ)
                    <span className="requiredAsterisk" aria-hidden="true">*</span>
                  </h2>
                  <p className="sectionSubtext">เลือกช่องทางสื่อสารเป้าหมายที่ต้องการนำสื่อไปเผยแพร่</p>
                </div>
              </div>

              <div className="checkboxCardGrid">
                {CHANNELS_CONFIG.map((item) => {
                  const isSelected = !!selectedChannels[item.key]?.selected
                  const currentDetail = selectedChannels[item.key]?.customDetail || ''

                  return (
                    <div
                      key={item.key}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={isSelected}
                      className={`selectableCard ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleChannel(item.key)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          toggleChannel(item.key)
                        }
                      }}
                    >
                      <div className="selectableCardHeader">
                        <div className="customCheckbox" aria-hidden="true">
                          {isSelected && <Check aria-hidden="true" className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="selectableCardIcon" aria-hidden="true">{item.icon}</span>
                        <span className="selectableCardLabel">{item.label}</span>
                      </div>

                      {item.hasCustomInput && isSelected && (
                        <div className="customDetailInputWrap" onClick={(e) => e.stopPropagation()}>
                          <label htmlFor={`channel-detail-${item.key}`} className="sr-only">
                            ระบุรายละเอียดช่องทางสำหรับ {item.label}
                          </label>
                          <input
                            id={`channel-detail-${item.key}`}
                            name={`channel_${item.key}_detail`}
                            type="text"
                            className="customDetailInput"
                            placeholder={item.placeholder}
                            value={currentDetail}
                            aria-label={`ระบุรายละเอียดช่องทางสำหรับ ${item.label}`}
                            onChange={(e) => setChannelDetail(item.key, e.target.value)}
                            autoFocus
                          />

                          {item.quickTags && item.quickTags.length > 0 && (
                            <div className="quickTagsWrap">
                              <span className="quickTagsLabel">จุดติดตั้ง:</span>
                              {item.quickTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  className="quickTagPill"
                                  onClick={() =>
                                    handleQuickTagClick(setChannelDetail, item.key, currentDetail, tag)
                                  }
                                >
                                  + {tag}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Section 4: Attachments & Cloud Storage Links */}
            <section className="sectionBox" aria-labelledby="section-assets-title">
              <div className="sectionHeader">
                <div className="sectionNumberBadge" aria-hidden="true">4</div>
                <div>
                  <h2 id="section-assets-title" className="sectionTitleText">
                    แนบไฟล์ตัวอย่าง / เอกสารเนื้อหา / ลิงก์ไดรฟ์
                  </h2>
                  <p className="sectionSubtext">อัปโหลดไฟล์ตัวอย่าง โลโก้ ข้อความ หรือแนบลิงก์ Canva / Google Drive</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* File Dropzone */}
                <div
                  className={`fileUploadZone ${isDragging ? 'isDragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="media-files"
                    name="mediaFiles"
                    style={{ display: 'none' }}
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.zip"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <label htmlFor="media-files" style={{ cursor: 'pointer', display: 'block' }}>
                    {isUploading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 aria-hidden="true" className="w-8 h-8 text-teal-600 animate-spin mb-2" />
                        <span className="fileUploadTitle">กำลังอัปโหลดไฟล์…</span>
                      </div>
                    ) : (
                      <div>
                        <div className="fileUploadIcon">
                          <UploadCloud aria-hidden="true" className="w-6 h-6" />
                        </div>
                        <span className="fileUploadTitle">
                          {isDragging ? 'วางไฟล์ที่นี่เพื่ออัปโหลด' : 'คลิกเพื่อเลือกไฟล์ตัวอย่าง หรือลากไฟล์มาวางที่นี่'}
                        </span>
                        <span className="fileUploadDesc">
                          รองรับรูปภาพ (JPG, PNG), PDF, Word (DOCX), PowerPoint (PPTX), ZIP (สูงสุด 25MB ต่อไฟล์)
                        </span>
                      </div>
                    )}
                  </label>
                </div>

                {/* Uploaded Files Chips */}
                {uploadedFiles.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
                      ไฟล์ที่แนบแล้ว ({uploadedFiles.length} รายการ):
                    </span>
                    <div className="uploadedFilesGrid">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="uploadedFileChip">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                            {getFileIcon(file.fileName)}
                            <span className="uploadedFileName" title={file.fileName}>
                              {file.fileName}
                            </span>
                            {file.fileSize && (
                              <span className="uploadedFileSize">({formatFileSize(file.fileSize)})</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(idx)}
                            className="btnRemoveFile"
                            aria-label={`ลบไฟล์ ${file.fileName}`}
                            title={`ลบไฟล์ ${file.fileName}`}
                          >
                            <X aria-hidden="true" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cloud Storage Link */}
                <div className="formGroup" style={{ marginTop: '0.5rem' }}>
                  <label htmlFor={driveLinkInputId} className="formLabel" style={{ fontSize: '0.825rem' }}>
                    <LinkIcon aria-hidden="true" className="w-3.5 h-3.5 text-teal-600" />
                    หรือ แนบลิงก์ Google Drive / Canva / Cloud Storage
                  </label>
                  <input
                    id={driveLinkInputId}
                    name="driveLink"
                    type="url"
                    spellCheck={false}
                    autoComplete="off"
                    className="formInput"
                    placeholder="https://drive.google.com/… หรือ https://canva.com/…"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── Right Column: Context & Workflow Sidebar (4 cols, sticky) ── */}
          <aside className="mediaSidebarCol">
            {/* Sidebar Card 1: Requester Identity */}
            <div className="sidebarBox">
              <div className="sidebarBoxHeader">
                <User aria-hidden="true" className="w-4 h-4 text-teal-600" />
                <h3 className="sidebarBoxTitle">ผู้ยื่นคำขอและเบอร์ติดต่อ</h3>
              </div>
              <div className="requesterProfileCard">
                <div className="requesterAvatar">
                  {(currentUser.name || currentUser.username || 'U')[0].toUpperCase()}
                </div>
                <div className="requesterDetails">
                  <span className="requesterName">{currentUser.name || currentUser.username}</span>
                  <span className="requesterDept">{currentUser.department || 'ไม่ระบุกลุ่มงาน'}</span>
                </div>
              </div>

              <div className="formGroup" style={{ marginTop: '0.85rem' }}>
                <label htmlFor={phoneInputId} className="formLabel" style={{ fontSize: '0.8rem' }}>
                  <Phone aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" />
                  เบอร์โทรส่วนตัว / แผนก <span className="requiredAsterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id={phoneInputId}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="formInput"
                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.875rem' }}
                  placeholder="เช่น 102, 108 หรือ 08X-XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Sidebar Card 2: Timeline & Urgency */}
            <div className="sidebarBox">
              <div className="sidebarBoxHeader">
                <Clock aria-hidden="true" className="w-4 h-4 text-teal-600" />
                <h3 className="sidebarBoxTitle">กำหนดส่งมอบ & ความเร่งด่วน</h3>
              </div>

              {/* Urgency Selector */}
              <div className="formGroup">
                <span id="urgency-label" className="formLabel" style={{ fontSize: '0.825rem' }}>
                  ระดับความเร่งด่วน <span className="requiredAsterisk" aria-hidden="true">*</span>
                </span>
                <div role="radiogroup" aria-labelledby="urgency-label" className="urgencyCardsGrid">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={urgency === 'NORMAL'}
                    className={`urgencyCard normal ${urgency === 'NORMAL' ? 'active' : ''}`}
                    onClick={() => setUrgency('NORMAL')}
                  >
                    <span className="urgencyCardIcon" aria-hidden="true">🟢</span>
                    <span className="urgencyCardTitle">ไม่ด่วน</span>
                    <span className="urgencyCardSub">7–14 วัน</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={urgency === 'URGENT'}
                    className={`urgencyCard urgent ${urgency === 'URGENT' ? 'active' : ''}`}
                    onClick={() => setUrgency('URGENT')}
                  >
                    <span className="urgencyCardIcon" aria-hidden="true">🟡</span>
                    <span className="urgencyCardTitle">ด่วน</span>
                    <span className="urgencyCardSub">3–5 วัน</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={urgency === 'VERY_URGENT'}
                    className={`urgencyCard veryUrgent ${urgency === 'VERY_URGENT' ? 'active' : ''}`}
                    onClick={() => setUrgency('VERY_URGENT')}
                  >
                    <span className="urgencyCardIcon" aria-hidden="true">🔴</span>
                    <span className="urgencyCardTitle">ด่วนที่สุด</span>
                    <span className="urgencyCardSub">1–2 วัน</span>
                  </button>
                </div>
                {urgency !== 'NORMAL' && (
                  <span className="urgencyNoticeBadge">
                    <Zap aria-hidden="true" className="w-3.5 h-3.5 text-amber-600 shrink-0 inline mr-1" />
                    งานด่วนจะถูกจัดลำดับความสำคัญในคิวงานของกลุ่มงานดิจิทัลทันที
                  </span>
                )}
              </div>

              {/* Delivery Date */}
              <div className="formGroup" style={{ marginTop: '1rem' }}>
                <label htmlFor={deliveryDateInputId} className="formLabel" style={{ fontSize: '0.825rem' }}>
                  วันที่ขอรับงานเสร็จ <span className="requiredAsterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id={deliveryDateInputId}
                  name="deliveryDate"
                  type="date"
                  min={todayDateString}
                  className="formInput"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />

                {deliveryDatePreview && (
                  <div className="deliveryDatePreviewBox">
                    <CalendarDays aria-hidden="true" className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="tabularNums">{deliveryDatePreview}</span>
                  </div>
                )}

                <div className="quickDateButtons">
                  <span className="quickDateLabel">ปุ่มลัด:</span>
                  <button type="button" onClick={() => setDaysFromNow(3)} className="quickDateBtn">
                    +3 วัน
                  </button>
                  <button type="button" onClick={() => setDaysFromNow(7)} className="quickDateBtn">
                    +7 วัน
                  </button>
                  <button type="button" onClick={() => setDaysFromNow(14)} className="quickDateBtn">
                    +14 วัน
                  </button>
                  <button type="button" onClick={() => setDaysFromNow(30)} className="quickDateBtn">
                    +1 เดือน
                  </button>
                </div>

                {selectedWorkTypes.video_editing?.selected && (
                  <div className="smartHintBox" style={{ marginTop: '0.65rem' }}>
                    <Info aria-hidden="true" className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <span>🎬 ตัดต่อวิดีโอ แนะนำเผื่อเวลา 5–7 วันทำการ</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Card 3: Budget & Approval Workflow */}
            <div className="sidebarBox">
              <div className="sidebarBoxHeader">
                <ShieldCheck aria-hidden="true" className="w-4 h-4 text-teal-600" />
                <h3 className="sidebarBoxTitle">รูปแบบค่าใช้จ่าย & สายอนุมัติ</h3>
              </div>

              <div role="radiogroup" aria-label="รูปแบบค่าใช้จ่าย" className="costCardsGridSidebar">
                <div
                  role="radio"
                  tabIndex={0}
                  aria-checked={costType === 'NO_COST'}
                  className={`costCard ${costType === 'NO_COST' ? 'active' : ''}`}
                  onClick={() => setCostType('NO_COST')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setCostType('NO_COST')
                    }
                  }}
                >
                  <div className="costRadioCircle" aria-hidden="true">
                    {costType === 'NO_COST' && <div className="costRadioInner" />}
                  </div>
                  <div>
                    <span className="costCardHeading">🟢 ไม่มีค่าใช้จ่าย (No Cost)</span>
                    <span className="costCardDescription">งานผลิตภายใน</span>
                  </div>
                </div>

                <div
                  role="radio"
                  tabIndex={0}
                  aria-checked={costType === 'HAS_COST'}
                  className={`costCard ${costType === 'HAS_COST' ? 'active' : ''}`}
                  onClick={() => setCostType('HAS_COST')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setCostType('HAS_COST')
                    }
                  }}
                >
                  <div className="costRadioCircle" aria-hidden="true">
                    {costType === 'HAS_COST' && <div className="costRadioInner" />}
                  </div>
                  <div>
                    <span className="costCardHeading">🔴 มีค่าใช้จ่าย (With Cost)</span>
                    <span className="costCardDescription">มีจัดซื้อจ้างพิมพ์/ผลิตภายนอก (เสนอ ผอ.)</span>
                  </div>
                </div>
              </div>

              {mightNeedCost && (
                <div className="smartHintBox" style={{ marginTop: '0.65rem' }}>
                  <Info aria-hidden="true" className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                  <span>
                    💡 หากมีสั่งพิมพ์ภายนอก (ไวนิล/ป้าย) โปรดเลือก <strong>มีค่าใช้จ่าย</strong> เพื่อเสนอ ผอ.
                  </span>
                </div>
              )}

              {/* Workflow Steps Preview */}
              <div className="workflowPipelineBox">
                <span className="workflowPipelineTitle">เส้นทางการดำเนินงาน & สายอนุมัติ:</span>
                <div className="workflowVerticalSteps">
                  <div className="workflowVerticalStep active">
                    <span className="stepNum">1</span>
                    <span className="stepText">นักประชาสัมพันธ์ ตรวจสอบและรับเรื่อง</span>
                  </div>
                  <div className="workflowVerticalStep active">
                    <span className="stepNum">2</span>
                    <span className="stepText">หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ พิจารณาอนุมัติ</span>
                  </div>
                  {costType === 'HAS_COST' ? (
                    <>
                      <div className="workflowVerticalStep active">
                        <span className="stepNum">3</span>
                        <span className="stepText">เจ้าหน้าที่พัสดุ ตรวจสอบความถูกต้อง</span>
                      </div>
                      <div className="workflowVerticalStep active">
                        <span className="stepNum">4</span>
                        <span className="stepText">หัวหน้าเจ้าหน้าที่พัสดุ ตรวจสอบและให้ความเห็นชอบ</span>
                      </div>
                      <div className="workflowVerticalStep active director">
                        <span className="stepNum">5</span>
                        <span className="stepText">ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ</span>
                      </div>
                      <div className="workflowVerticalStep active">
                        <span className="stepNum">6</span>
                        <span className="stepText">นักประชาสัมพันธ์ ดำเนินการสั่งพิมพ์/ผลิตสื่อ</span>
                      </div>
                      <div className="workflowVerticalStep active">
                        <span className="stepNum">7</span>
                        <span className="stepText">นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="workflowVerticalStep active">
                        <span className="stepNum">3</span>
                        <span className="stepText">นักประชาสัมพันธ์ ดำเนินการผลิตสื่อ</span>
                      </div>
                      <div className="workflowVerticalStep active">
                        <span className="stepNum">4</span>
                        <span className="stepText">นักประชาสัมพันธ์ ดำเนินการเสร็จสิ้นและส่งมอบงาน</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Card 4: Submission & Form Readiness Checklist */}
            <div className="sidebarBox submissionBox">
              <span className="checklistTitle">
                <CheckCircle aria-hidden="true" className="w-4 h-4 text-teal-600 inline mr-1" />
                ความพร้อมของข้อมูลคำขอ:
              </span>
              <ul className="checklistItems">
                {validationItems.map((item, idx) => (
                  <li key={idx} className={`checklistItem ${item.valid ? 'isValid' : ''}`}>
                    <span className="checkIcon" aria-hidden="true">
                      {item.valid ? '✓' : '•'}
                    </span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>

              <div className="sidebarActionButtons">
                <button
                  type="submit"
                  disabled={isPending || isUploading}
                  className="btnSubmitPrimary"
                >
                  {isPending ? (
                    <>
                      <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                      <span>กำลังส่งคำขอเข้าสู่ระบบ…</span>
                    </>
                  ) : (
                    <>
                      <Send aria-hidden="true" className="w-5 h-5" />
                      <span>ส่งคำขอรับบริการสื่อ</span>
                    </>
                  )}
                </button>

                <Link href="/member/media-requests" className="btnCancelSecondary">
                  ยกเลิก
                </Link>
              </div>
            </div>
          </aside>
        </form>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && createdTaskInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
          className="successModalOverlay"
        >
          <div className="successModalCard">
            <div className="successIconBadge" aria-hidden="true">
              <CheckCircle2 aria-hidden="true" className="w-9 h-9" />
            </div>

            <h2 id="success-modal-title" className="successModalTitle">ส่งคำขอสื่อเรียบร้อยแล้ว</h2>
            <p className="successModalDesc">
              ระบบได้บันทึกคำขอและส่งเรื่องไปยังหัวหน้ากลุ่มงานดิจิทัลทางการแพทย์เพื่อตรวจสอบและลงนาม
            </p>

            <div className="successTaskNoBox">
              <span className="successTaskNoLabel">รหัสเอกสารคำขอ</span>
              <span className="successTaskNoValue tabularNums">{createdTaskInfo.taskNo}</span>
            </div>

            <div className="successActionsList">
              <Link
                href={`/member/inbox/${createdTaskInfo.taskId}`}
                className="btnModalPrimary"
              >
                เปิดดูรายละเอียดและติดตามสถานะ
              </Link>
              <Link
                href="/member/media-requests"
                className="btnModalSecondary"
              >
                ไปยังหน้ารายการคำขอสื่อทั้งหมด
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
