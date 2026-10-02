'use client'

import React, { useState, useEffect, useMemo, useRef, useId } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Wrench,
  Monitor,
  HeartPulse,
  MapPin,
  User,
  Calendar,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Search,
  Send,
  Loader2,
  Package,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Building,
  Check,
  Info,
  Clock,
  Zap,
  CheckCircle,
  Sparkles,
  Phone,
  FileImage,
} from 'lucide-react'
import './repair.css'

interface LocationItem {
  id: number
  room_name: string
  floor_id: number
  floor_name: string
  building_id: number
  building_name: string
  full_name: string
}

interface RepairFormClientProps {
  currentUser: {
    id: number
    username: string
    name: string
    department: string
    position: string
    email?: string
    phone?: string
  }
  initialLocations: LocationItem[]
}

interface WarrantyInfo {
  status: 'ACTIVE' | 'EXPIRED' | 'UNKNOWN'
  title: string
  desc: string
  expireDate?: string
  remainingText?: string
}

function calculateWarrantyInfo(
  warrantyEndDateStr?: string | null,
  expireDateStr?: string | null
): WarrantyInfo {
  const targetDateStr = warrantyEndDateStr || expireDateStr
  if (!targetDateStr) {
    return {
      status: 'UNKNOWN',
      title: 'ไม่มีข้อมูลระยะเวลารับประกัน',
      desc: 'ไม่พบประวัติวันสิ้นสุดการรับประกันในระบบ (ดำเนินการซ่อมบำรุงโดยทีมช่างโรงพยาบาล)',
    }
  }

  const endDate = new Date(targetDateStr)
  if (isNaN(endDate.getTime())) {
    return {
      status: 'UNKNOWN',
      title: 'ไม่มีข้อมูลระยะเวลารับประกัน',
      desc: 'ข้อมูลวันที่รับประกันไม่ถูกต้อง',
    }
  }

  const now = new Date()
  const isUnderWarranty = endDate.getTime() >= now.getTime()

  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(endDate)

  // Calculate relative difference in years, months, days
  const diffMs = Math.abs(endDate.getTime() - now.getTime())
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const years = Math.floor(totalDays / 365)
  const remDaysAfterYears = totalDays % 365
  const months = Math.floor(remDaysAfterYears / 30)
  const days = remDaysAfterYears % 30

  const durationParts: string[] = []
  if (years > 0) durationParts.push(`${years} ปี`)
  if (months > 0) durationParts.push(`${months} เดือน`)
  if (days > 0 || durationParts.length === 0) durationParts.push(`${days} วัน`)
  const durationText = durationParts.join(' ')

  if (isUnderWarranty) {
    return {
      status: 'ACTIVE',
      title: 'อยู่ในระยะเวลารับประกัน (บริษัท/ผู้จำหน่าย)',
      desc: `รับประกันถึงวันที่ ${formattedDate} (เหลือระยะเวลารับประกันอีก ${durationText})`,
      expireDate: formattedDate,
      remainingText: durationText,
    }
  } else {
    return {
      status: 'EXPIRED',
      title: 'หมดระยะเวลารับประกันแล้ว',
      desc: `สิ้นสุดการรับประกันเมื่อวันที่ ${formattedDate} (หมดประกันมาแล้ว ${durationText} • ซ่อมบำรุงโดยทีมช่างโรงพยาบาล)`,
      expireDate: formattedDate,
      remainingText: durationText,
    }
  }
}

// 3 Core Repair Categories for Hospital Workflow
const REPAIR_CATEGORIES = [
  {
    type: 'IT_REPAIR' as const,
    title: 'คอมพิวเตอร์ / IT',
    subtitle: 'คอม, ปริ้นเตอร์, HOSxP, เน็ต',
    icon: Monitor,
    themeClass: 'it',
  },
  {
    type: 'GENERAL_REPAIR' as const,
    title: 'งานช่างทั่วไป',
    subtitle: 'ไฟฟ้า, ประปา, แอร์, อาคาร',
    icon: Wrench,
    themeClass: 'general',
  },
  {
    type: 'MEDICAL_REPAIR' as const,
    title: 'เครื่องมือแพทย์',
    subtitle: 'เครื่องมือ/อุปกรณ์ทางการแพทย์',
    icon: HeartPulse,
    themeClass: 'medical',
  },
]

// Quick sample tags for non-equipment item
const QUICK_NON_EQUIPMENT_ITEMS = [
  'หลอดไฟ / โคมไฟ',
  'ก๊อกน้ำ / อ่างล้างมือ',
  'ปลั๊กไฟ / สวิตช์',
  'แอร์ / รีโมทแอร์',
  'ลูกบิด / บานพับประตู',
  'ท่อน้ำทิ้ง / ชักโครก',
  'โต๊ะ / เก้าอี้ทำงาน',
  'มู่ลี่ / ผ้าม่าน',
]

// Quick symptom helpers
const QUICK_SYMPTOM_HELPERS = [
  'เปิดไม่ติด / ไม่มีไฟเข้า',
  'มีเสียงดังหรือกลิ่นไหม้ผิดปกติ',
  'น้ำรั่วซึม / ท่อตันระบายไม่ทัน',
  'ชำรุดแตกหัก / หลุดหลวม',
  'ไม่สามารถเชื่อมต่อระบบเครือข่ายได้',
  'หน้าจอดับ / ภาพกระพริบ',
]

export default function RepairFormClient({
  currentUser,
  initialLocations,
}: RepairFormClientProps) {
  const router = useRouter()

  // Form IDs for Accessibility
  const equipNumId = useId()
  const equipNameId = useId()
  const nonEquipId = useId()
  const symptomDescId = useId()
  const buildingSelectId = useId()
  const floorSelectId = useId()
  const roomSelectId = useId()
  const specificNoteId = useId()

  // 1. Repair Category State
  const [repairType, setRepairType] = useState<'GENERAL_REPAIR' | 'IT_REPAIR' | 'MEDICAL_REPAIR'>('IT_REPAIR')

  // 2. Item Category State (EQUIPMENT vs NON_EQUIPMENT)
  const [itemCategory, setItemCategory] = useState<'EQUIPMENT' | 'NON_EQUIPMENT'>('EQUIPMENT')
  const [equipmentNumber, setEquipmentNumber] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [nonEquipmentItem, setNonEquipmentItem] = useState('')

  // Asset Lookup State
  const [assetSuggestions, setAssetSuggestions] = useState<any[]>([])
  const [isSearchingAsset, setIsSearchingAsset] = useState(false)
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false)
  const [warrantyInfo, setWarrantyInfo] = useState<WarrantyInfo | null>(null)
  const assetWrapperRef = useRef<HTMLDivElement>(null)

  // 3. Location State (3-level Cascading Dropdown: Building -> Floor -> Room)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  const [selectedFloorId, setSelectedFloorId] = useState<string>('')
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [hasSpecificNote, setHasSpecificNote] = useState<boolean>(false)
  const [specificNote, setSpecificNote] = useState<string>('')

  // 4. Symptom & Urgency
  const [symptomDetail, setSymptomDetail] = useState('')
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'VERY_URGENT'>('NORMAL')

  // 5. Photo Attachments (Max 5 files, 10MB each)
  const [photos, setPhotos] = useState<{ file: File; previewUrl: string }[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false)

  // 6. Form Submission State
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ taskId: string; taskNo: string } | null>(null)

  // Current Date/Time in Thai format for display
  const [currentDateTimeThai, setCurrentDateTimeThai] = useState('')

  useEffect(() => {
    const now = new Date()
    const thaiFormatter = new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    setCurrentDateTimeThai(thaiFormatter.format(now))
  }, [])

  // Close asset dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assetWrapperRef.current && !assetWrapperRef.current.contains(event.target as Node)) {
        setShowAssetSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Unsaved Changes Guard
  useEffect(() => {
    const isDirty =
      equipmentNumber.trim() !== '' ||
      nonEquipmentItem.trim() !== '' ||
      symptomDetail.trim() !== '' ||
      photos.length > 0 ||
      selectedRoomId !== ''

    if (!isDirty || successInfo) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [equipmentNumber, nonEquipmentItem, symptomDetail, photos.length, selectedRoomId, successInfo])

  // Search assets when user types in equipment number or name
  useEffect(() => {
    if (!equipmentNumber.trim() || equipmentNumber.trim().length < 2) {
      setAssetSuggestions([])
      setShowAssetSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingAsset(true)
      try {
        const res = await fetch(`/api/assets/lookup?q=${encodeURIComponent(equipmentNumber.trim())}`)
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setAssetSuggestions(data.data)
          setShowAssetSuggestions(data.data.length > 0)
        }
      } catch (err) {
        console.error('Asset lookup error:', err)
      } finally {
        setIsSearchingAsset(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [equipmentNumber])

  // Extract unique Buildings from initialLocations
  const buildingOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    initialLocations.forEach((loc) => {
      if (loc.building_id && loc.building_name && !map.has(loc.building_id)) {
        map.set(loc.building_id, { id: loc.building_id, name: loc.building_name })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [initialLocations])

  // Extract unique Floors based on selected Building
  const floorOptions = useMemo(() => {
    if (!selectedBuildingId) return []
    const bId = Number(selectedBuildingId)
    const map = new Map<number, { id: number; name: string }>()
    initialLocations
      .filter((loc) => loc.building_id === bId)
      .forEach((loc) => {
        if (loc.floor_id && loc.floor_name && !map.has(loc.floor_id)) {
          map.set(loc.floor_id, { id: loc.floor_id, name: loc.floor_name })
        }
      })
    return Array.from(map.values()).sort((a, b) => a.id - b.id)
  }, [initialLocations, selectedBuildingId])

  // Extract Rooms based on selected Building and Floor
  const roomOptions = useMemo(() => {
    if (!selectedBuildingId || !selectedFloorId) return []
    const bId = Number(selectedBuildingId)
    const fId = Number(selectedFloorId)
    return initialLocations
      .filter((loc) => loc.building_id === bId && loc.floor_id === fId)
      .sort((a, b) => a.room_name.localeCompare(b.room_name, 'th'))
  }, [initialLocations, selectedBuildingId, selectedFloorId])

  // Auto-select floor & room if an asset with location is chosen
  const handleSelectAsset = (asset: any) => {
    setEquipmentNumber(asset.articleNum || '')
    const fullName =
      asset.name + (asset.brand || asset.model ? ` (${[asset.brand, asset.model].filter(Boolean).join(' ')})` : '')
    setEquipmentName(fullName)

    // Auto switch repair type based on asset category
    if (asset.category === 'IT') setRepairType('IT_REPAIR')
    else if (asset.category === 'MEDICAL') setRepairType('MEDICAL_REPAIR')
    else if (asset.category === 'GENERAL') setRepairType('GENERAL_REPAIR')

    // Calculate warranty
    const wInfo = calculateWarrantyInfo(asset.warrantyEndDate, asset.expireDate)
    setWarrantyInfo(wInfo)

    // Auto-match location if asset has locationId or locationFullName
    if (asset.locationId) {
      const match = initialLocations.find((l) => l.id === asset.locationId)
      if (match) {
        setSelectedBuildingId(String(match.building_id))
        setSelectedFloorId(String(match.floor_id))
        setSelectedRoomId(String(match.id))
      }
    } else if (asset.locationFullName) {
      const match = initialLocations.find(
        (l) => l.full_name === asset.locationFullName || asset.locationFullName.includes(l.room_name)
      )
      if (match) {
        setSelectedBuildingId(String(match.building_id))
        setSelectedFloorId(String(match.floor_id))
        setSelectedRoomId(String(match.id))
      }
    }

    setShowAssetSuggestions(false)
  }

  // Handle Photo selection & drag/drop
  const processPhotoFiles = (files: FileList | File[]) => {
    const newFiles: { file: File; previewUrl: string }[] = []
    const totalCount = photos.length + files.length

    if (totalCount > 5) {
      alert('สามารถแนบรูปภาพได้สูงสุดไม่เกิน 5 รูป')
      return
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.size > 10 * 1024 * 1024) {
        alert(`ไฟล์ "${f.name}" มีขนาดเกิน 10MB กรุณาเลือกไฟล์ที่ขนาดเล็กกว่า 10MB`)
        continue
      }
      newFiles.push({
        file: f,
        previewUrl: URL.createObjectURL(f),
      })
    }

    setPhotos((prev) => [...prev, ...newFiles])
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processPhotoFiles(e.target.files)
    }
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index]
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleAppendSymptom = (snippet: string) => {
    setSymptomDetail((prev) => (prev ? `${prev}\n- ${snippet}` : `- ${snippet}`))
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validation
    if (itemCategory === 'EQUIPMENT' && !equipmentNumber.trim() && !equipmentName.trim()) {
      setErrorMessage('กรุณาระบุเลขทะเบียนครุภัณฑ์ หรือชื่อครุภัณฑ์')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (itemCategory === 'NON_EQUIPMENT' && !nonEquipmentItem.trim()) {
      setErrorMessage('กรุณาระบุรายการ/สิ่งของที่ชำรุดเสียหาย')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (!selectedRoomId) {
      setErrorMessage('กรุณาเลือกสถานที่ (อาคาร, ชั้น และห้อง/แผนก) ให้ครบถ้วน')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const pickedRoom = initialLocations.find((l) => l.id === Number(selectedRoomId))
    if (!pickedRoom) {
      setErrorMessage('ไม่พบข้อมูลห้องที่เลือก กรุณาเลือกใหม่')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const finalLocationFullName =
      hasSpecificNote && specificNote.trim()
        ? `${pickedRoom.full_name} (${specificNote.trim()})`
        : pickedRoom.full_name

    if (!symptomDetail.trim()) {
      setErrorMessage('กรุณาระบุรายละเอียดหรืออาการเสีย')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)

    try {
      // 1. Upload photos first if any
      let finalPhotoUrls: string[] = []
      if (photos.length > 0) {
        setIsUploadingPhotos(true)
        const photoFormData = new FormData()
        photos.forEach((p) => photoFormData.append('files', p.file))

        const uploadRes = await fetch('/api/member/repairs/upload', {
          method: 'POST',
          body: photoFormData,
        })
        const uploadJson = await uploadRes.json()
        if (!uploadJson.success) {
          throw new Error(uploadJson.error || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ')
        }
        finalPhotoUrls = uploadJson.data.urls || []
        setIsUploadingPhotos(false)
      }

      // 2. Submit repair ticket
      const payload = {
        repairType,
        itemCategory,
        equipmentNumber: equipmentNumber.trim(),
        equipmentName: equipmentName.trim(),
        nonEquipmentItem: nonEquipmentItem.trim(),
        locationId: pickedRoom.id,
        locationFullName: finalLocationFullName,
        symptomDetail: symptomDetail.trim(),
        assignedTechnicianId: null,
        urgency,
        photos: finalPhotoUrls,
      }

      const res = await fetch('/api/member/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกคำขอแจ้งซ่อม')
      }

      setSuccessInfo(data.data)
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
      setIsUploadingPhotos(false)
    }
  }

  // Validation Items for Live Sidebar Checklist
  const validationItems = [
    { label: 'เลือกประเภทงานซ่อม', valid: !!repairType },
    {
      label: itemCategory === 'EQUIPMENT' ? 'ระบุเลข/ชื่อครุภัณฑ์' : 'ระบุสิ่งของที่ชำรุด',
      valid:
        itemCategory === 'EQUIPMENT'
          ? !!equipmentNumber.trim() || !!equipmentName.trim()
          : !!nonEquipmentItem.trim(),
    },
    { label: 'เลือกสถานที่ (อาคาร/ชั้น/ห้อง)', valid: !!selectedRoomId },
    { label: 'ระบุรายละเอียดอาการเสีย', valid: symptomDetail.trim().length >= 3 },
  ]

  // Success Screen
  if (successInfo) {
    return (
      <div className="repairPageContainer">
        <div className="repairSuccessCard">
          <div className="repairSuccessIcon" aria-hidden="true">
            <CheckCircle2 size={54} />
          </div>
          <h2 className="repairSuccessTitle">ส่งใบแจ้งซ่อมสำเร็จเรียบร้อย!</h2>
          <p className="repairSuccessDesc">
            ระบบได้นำส่งใบงานเข้าสู่ระบบและแจ้งเตือนเข้ากลุ่มงานช่างเรียบร้อยแล้ว ช่างสามารถกดรับงานเพื่อเข้าดำเนินการได้ทันที
          </p>

          <div className="repairTicketBox">
            <span className="ticketLabel">เลขที่ใบแจ้งซ่อม</span>
            <span className="ticketNo tabularNums">{successInfo.taskNo}</span>
          </div>

          <div className="repairSuccessActions">
            <Link href={`/member/inbox/${successInfo.taskId}`} className="btnSuccessPrimary">
              <span>เปิดดูรายละเอียดและติดตามสถานะ</span>
            </Link>
            <Link href="/member/inbox" className="btnSuccessSecondary">
              <span>กลับสู่กล่องงาน</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="repairPageContainer">
      {/* ── Top Navigation Bar ── */}
      <nav aria-label="นำทางแบบฟอร์ม" className="repairNav">
        <Link href="/member/inbox" className="repairNavBackLink">
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          <span>กลับสู่กล่องงาน</span>
        </Link>
        <div className="repairNavLocationBadge">
          <Building aria-hidden="true" className="w-3.5 h-3.5 text-teal-600" />
          <span>โรงพยาบาลเถิน จ.ลำปาง • ระบบแจ้งซ่อมบำรุง</span>
        </div>
      </nav>

      {/* ── Main Form Shell Card ── */}
      <div className="repairFormShell">
        {/* Hero Banner Header */}
        <header className="repairHeroHeader">
          <div className="repairHeroInner">
            <div>
              <div className="repairHeroBadge">
                <Wrench aria-hidden="true" className="w-3.5 h-3.5" />
                Hospital Maintenance & Asset Repair System
              </div>
              <h1 className="repairHeroTitle">แบบฟอร์มแจ้งซ่อมบำรุงและอุปกรณ์</h1>
              <p className="repairHeroSubtitle">
                ยื่นคำขอแจ้งซ่อมงานช่าง คอมพิวเตอร์ และเครื่องมือแพทย์ พร้อมแจ้งเตือนส่งตรงเข้ากลุ่มงานช่างทันที
              </p>
            </div>

            <div className="repairHeroDateBox">
              <div className="flex items-center gap-1.5 justify-end">
                <Clock aria-hidden="true" className="w-3.5 h-3.5 text-teal-200" />
                <span className="repairDateLabel">เวลาปัจจุบัน</span>
              </div>
              <span className="repairDateValue tabularNums">{currentDateTimeThai || 'กำลังโหลด…'}</span>
            </div>
          </div>
        </header>

        {/* Error Alert Banner with Live Region */}
        {errorMessage && (
          <div role="alert" aria-live="polite" className="repairAlert error">
            <AlertCircle aria-hidden="true" className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="repairAlertText">{errorMessage}</div>
          </div>
        )}

        {/* ── 2-Column Responsive Workspace Grid ── */}
        <form onSubmit={handleSubmit} className="repairLayoutGrid" noValidate>
          {/* ── Left Column: Primary Repair Canvas (8 cols) ── */}
          <div className="repairCanvasCol">
            {/* Step 1: Repair Category Selector (Compact & Fast) */}
            <section className="repairSectionBox" aria-labelledby="step-1-title">
              <div className="repairSectionHeader compact">
                <div className="repairStepBadge" aria-hidden="true">1</div>
                <div>
                  <h2 id="step-1-title" className="repairSectionTitle">
                    เลือกประเภทงานซ่อม
                    <span className="reqStar" aria-hidden="true">*</span>
                  </h2>
                  <p className="repairSectionSubtext">เลือกหมวดหมู่งานที่ต้องการแจ้งซ่อม</p>
                </div>
              </div>

              <div role="radiogroup" aria-labelledby="step-1-title" className="repairCompactGrid">
                {REPAIR_CATEGORIES.map((cat) => {
                  const isSelected = repairType === cat.type
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.type}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`repairCompactCard ${cat.themeClass} ${isSelected ? 'isSelected' : ''}`}
                      onClick={() => setRepairType(cat.type)}
                    >
                      <div className={`repairCompactIconBox ${cat.themeClass}`}>
                        <Icon aria-hidden="true" className="w-5 h-5" />
                      </div>

                      <div className="repairCompactBody">
                        <div className="flex items-center justify-between gap-1">
                          <strong className="repairCompactTitle">{cat.title}</strong>
                          {isSelected && (
                            <span className="repairCompactCheckBadge" aria-hidden="true">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span className="repairCompactSubtitle">{cat.subtitle}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Step 2: Item & Asset Identity */}
            <section className="repairSectionBox" aria-labelledby="step-2-title">
              <div className="repairSectionHeader">
                <div className="repairStepBadge" aria-hidden="true">2</div>
                <div>
                  <h2 id="step-2-title" className="repairSectionTitle">
                    ข้อมูลสิ่งของ / อุปกรณ์ที่ชำรุดเสียหาย
                    <span className="reqStar" aria-hidden="true">*</span>
                  </h2>
                  <p className="repairSectionSubtext">ระบุว่าเป็นครุภัณฑ์โรงพยาบาลหรือสิ่งของทั่วไป</p>
                </div>
              </div>

              {/* Segmented Switcher */}
              <div role="radiogroup" aria-label="ประเภทสิ่งของ" className="itemCategorySwitcher">
                <div
                  role="radio"
                  tabIndex={0}
                  aria-checked={itemCategory === 'EQUIPMENT'}
                  className={`categorySwitchCard ${itemCategory === 'EQUIPMENT' ? 'selected' : ''}`}
                  onClick={() => {
                    setItemCategory('EQUIPMENT')
                    setWarrantyInfo(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setItemCategory('EQUIPMENT')
                      setWarrantyInfo(null)
                    }
                  }}
                >
                  <div className="categorySwitchIcon">
                    <Package aria-hidden="true" className="w-5 h-5" />
                  </div>
                  <div className="categorySwitchText">
                    <strong>ครุภัณฑ์โรงพยาบาล (ค้นหาจากคลังข้อมูล)</strong>
                    <span>พิมพ์เลขครุภัณฑ์หรือชื่อเพื่อค้นหา ระบบจะเติมชื่อและตรวจสอบประกันให้อัตโนมัติ</span>
                  </div>
                </div>

                <div
                  role="radio"
                  tabIndex={0}
                  aria-checked={itemCategory === 'NON_EQUIPMENT'}
                  className={`categorySwitchCard ${itemCategory === 'NON_EQUIPMENT' ? 'selected' : ''}`}
                  onClick={() => {
                    setItemCategory('NON_EQUIPMENT')
                    setWarrantyInfo(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setItemCategory('NON_EQUIPMENT')
                      setWarrantyInfo(null)
                    }
                  }}
                >
                  <div className="categorySwitchIcon">
                    <Layers aria-hidden="true" className="w-5 h-5" />
                  </div>
                  <div className="categorySwitchText">
                    <strong>ไม่ใช่ครุภัณฑ์ / วัสดุอาคารสถานที่</strong>
                    <span>สิ่งของทั่วไป เช่น หลอดไฟ, ก๊อกน้ำ, ลูกบิดประตู, ท่อน้ำ, ปลั๊กไฟ, แอร์</span>
                  </div>
                </div>
              </div>

              {/* Conditional Form Inputs */}
              {itemCategory === 'EQUIPMENT' ? (
                <div className="equipmentLookupBlock">
                  <div className="grid2Cols">
                    <div className="formGroup" ref={assetWrapperRef} style={{ position: 'relative' }}>
                      <label htmlFor={equipNumId} className="formLabel">
                        เลขทะเบียนครุภัณฑ์ (พิมพ์ค้นหาจากระบบ) <span className="reqStar" aria-hidden="true">*</span>
                      </label>
                      <div className="inputWithIconWrap">
                        <Search aria-hidden="true" className="inputLeadingIcon" />
                        <input
                          id={equipNumId}
                          name="equipmentNumber"
                          type="text"
                          autoComplete="off"
                          className="formInput inputWithLeadingIcon"
                          placeholder="เช่น 7440-013-0007/154/69 หรือชื่อเครื่อง…"
                          value={equipmentNumber}
                          onChange={(e) => {
                            setEquipmentNumber(e.target.value)
                            setWarrantyInfo(null)
                          }}
                          onFocus={() => {
                            if (assetSuggestions.length > 0) setShowAssetSuggestions(true)
                          }}
                        />
                        {isSearchingAsset && (
                          <div className="inputTrailingSpinner">
                            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-teal-600" />
                          </div>
                        )}
                      </div>

                      {/* Autocomplete suggestions dropdown */}
                      {showAssetSuggestions && assetSuggestions.length > 0 && (
                        <div className="assetSuggestionDropdown" role="listbox">
                          <div className="assetSuggestionHeader">
                            <Search aria-hidden="true" className="w-3.5 h-3.5" />
                            <span>พบข้อมูลครุภัณฑ์ ({assetSuggestions.length} รายการ) — คลิกเพื่อเลือก</span>
                          </div>
                          {assetSuggestions.map((item) => (
                            <div
                              key={item.id}
                              role="option"
                              aria-selected="false"
                              tabIndex={0}
                              className="assetSuggestionItem"
                              onClick={() => handleSelectAsset(item)}
                              onKeyDown={(e) => {
                                if (e.key === ' ' || e.key === 'Enter') {
                                  e.preventDefault()
                                  handleSelectAsset(item)
                                }
                              }}
                            >
                              <div className="assetItemTop">
                                <span className="assetArtNum tabularNums">{item.articleNum}</span>
                                {item.isUnderWarranty ? (
                                  <span className="warrantyPill active">
                                    <ShieldCheck aria-hidden="true" className="w-3 h-3" /> ในประกัน
                                  </span>
                                ) : (
                                  <span className="warrantyPill expired">
                                    <ShieldAlert aria-hidden="true" className="w-3 h-3" /> หมดประกัน
                                  </span>
                                )}
                              </div>
                              <div className="assetItemName">
                                <strong>{item.name}</strong>
                                {item.brand || item.model ? (
                                  <span> • {[item.brand, item.model].filter(Boolean).join(' ')}</span>
                                ) : null}
                              </div>
                              {item.locationFullName && (
                                <div className="assetItemLoc">
                                  <MapPin aria-hidden="true" className="w-3 h-3 text-slate-400" />
                                  <span>{item.locationFullName}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="formGroup">
                      <label htmlFor={equipNameId} className="formLabel">
                        ชื่อครุภัณฑ์ (เติมให้อัตโนมัติเมื่อเลือกครุภัณฑ์)
                      </label>
                      <input
                        id={equipNameId}
                        name="equipmentName"
                        type="text"
                        className="formInput"
                        placeholder="เช่น คอมพิวเตอร์ All-in-One Dell OptiPlex, ปริ้นเตอร์ HP"
                        value={equipmentName}
                        onChange={(e) => setEquipmentName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Warranty Card Display */}
                  {warrantyInfo && (
                    <div className={`warrantyCardContainer ${warrantyInfo.status.toLowerCase()}`}>
                      <div className="warrantyIconWrap" aria-hidden="true">
                        {warrantyInfo.status === 'ACTIVE' ? (
                          <ShieldCheck className="w-6 h-6 text-emerald-600" />
                        ) : warrantyInfo.status === 'EXPIRED' ? (
                          <ShieldAlert className="w-6 h-6 text-rose-600" />
                        ) : (
                          <Info className="w-6 h-6 text-slate-500" />
                        )}
                      </div>
                      <div className="warrantyCardBody">
                        <div className="warrantyCardTitle">
                          <strong>{warrantyInfo.title}</strong>
                          {warrantyInfo.expireDate && (
                            <span className="warrantyDateBadge tabularNums">
                              {warrantyInfo.status === 'ACTIVE' ? 'หมดประกัน: ' : 'สิ้นสุดเมื่อ: '}
                              {warrantyInfo.expireDate}
                            </span>
                          )}
                        </div>
                        <p className="warrantyCardDesc">{warrantyInfo.desc}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="formGroup" style={{ marginTop: '1rem' }}>
                  <label htmlFor={nonEquipId} className="formLabel">
                    รายการ / สิ่งของที่ชำรุดเสียหาย <span className="reqStar" aria-hidden="true">*</span>
                  </label>
                  <input
                    id={nonEquipId}
                    name="nonEquipmentItem"
                    type="text"
                    className="formInput"
                    placeholder="ระบุสิ่งของที่ชำรุด เช่น ก๊อกน้ำอ่างล้างมือรั่วซึม, หลอดไฟนีออนหน้าห้องดับ, ปลั๊กไฟชำรุด"
                    value={nonEquipmentItem}
                    onChange={(e) => setNonEquipmentItem(e.target.value)}
                    required
                  />

                  {/* Quick Item Tags */}
                  <div className="quickTagsBar">
                    <span className="quickTagsLabel">ตัวเลือกด่วน:</span>
                    {QUICK_NON_EQUIPMENT_ITEMS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="quickTagBtn"
                        onClick={() => setNonEquipmentItem(item)}
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Step 3: Symptom Description & Helpers */}
            <section className="repairSectionBox" aria-labelledby="step-3-title">
              <div className="repairSectionHeader">
                <div className="repairStepBadge" aria-hidden="true">3</div>
                <div>
                  <h2 id="step-3-title" className="repairSectionTitle">
                    รายละเอียด / อาการชำรุดเสียหาย
                    <span className="reqStar" aria-hidden="true">*</span>
                  </h2>
                  <p className="repairSectionSubtext">อธิบายอาการเสียที่เกิดขึ้นอย่างชัดเจน เพื่อให้ช่างเตรียมเครื่องมือได้ถูกต้อง</p>
                </div>
              </div>

              <div className="formGroup">
                <div className="flex items-center justify-between">
                  <label htmlFor={symptomDescId} className="sr-only">
                    รายละเอียดอาการเสีย
                  </label>
                  <span className="charCounter tabularNums">{symptomDetail.length} ตัวอักษร</span>
                </div>
                <textarea
                  id={symptomDescId}
                  name="symptomDetail"
                  className="formTextarea"
                  rows={4}
                  placeholder="อธิบายอาการเสีย ปัญหาที่พบ หรือลักษณะความชำรุด เช่น เครื่องปริ้น ลูกกลิ้ง เสียใช้ไม่ได้, น้ำรั่วซึมใต้ซิงค์, เปิดไม่ติดมีกลิ่นไหม้…"
                  value={symptomDetail}
                  onChange={(e) => setSymptomDetail(e.target.value)}
                  required
                />

                {/* Symptom Quick Helper Chips */}
                <div className="descHelperBar">
                  <span className="descHelperLabel">อาการพบบ่อย:</span>
                  {QUICK_SYMPTOM_HELPERS.map((snippet, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="descHelperBtn"
                      onClick={() => handleAppendSymptom(snippet)}
                    >
                      + {snippet}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Step 4: Photo Attachments */}
            <section className="repairSectionBox" aria-labelledby="step-4-title">
              <div className="repairSectionHeader">
                <div className="repairStepBadge" aria-hidden="true">4</div>
                <div>
                  <h2 id="step-4-title" className="repairSectionTitle">
                    แนบรูปถ่ายประกอบความเสียหาย (ไม่บังคับ)
                  </h2>
                  <p className="repairSectionSubtext">แนบรูปภาพหน้างานหรือจุดที่ชำรุด สูงสุด 5 รูป (รูปละไม่เกิน 10MB)</p>
                </div>
              </div>

              <div className="photoUploadContainer">
                {photos.map((p, idx) => (
                  <div key={idx} className="photoThumbWrap">
                    <img src={p.previewUrl} alt={`รูปประกอบความเสียหาย ${idx + 1}`} className="photoThumbImg" />
                    <button
                      type="button"
                      className="photoDeleteBtn"
                      onClick={() => removePhoto(idx)}
                      aria-label={`ลบรูปที่ ${idx + 1}`}
                      title={`ลบรูปที่ ${idx + 1}`}
                    >
                      <X aria-hidden="true" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {photos.length < 5 && (
                  <label
                    className={`photoUploadBox ${isDraggingPhotos ? 'isDragging' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingPhotos(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setIsDraggingPhotos(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingPhotos(false)
                      if (e.dataTransfer.files) processPhotoFiles(e.dataTransfer.files)
                    }}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handlePhotoSelect}
                      style={{ display: 'none' }}
                    />
                    <div className="photoUploadIconWrap" aria-hidden="true">
                      <UploadCloud className="w-6 h-6 text-teal-600" />
                    </div>
                    <span className="photoUploadTitle">
                      {isDraggingPhotos ? 'วางรูปภาพที่นี่' : 'คลิกหรือลากรูปมาวาง'}
                    </span>
                    <span className="photoUploadSub tabularNums">({photos.length}/5 รูป)</span>
                  </label>
                )}
              </div>
            </section>
          </div>

          {/* ── Right Column: Location, Urgency & Submission Sidebar (4 cols, sticky) ── */}
          <aside className="repairSidebarCol">
            {/* Sidebar Box 1: Location Cascader */}
            <div className="sidebarBox">
              <div className="sidebarBoxHeader">
                <MapPin aria-hidden="true" className="w-4 h-4 text-teal-600" />
                <h3 className="sidebarBoxTitle">สถานที่ตั้ง / จุดเกิดเหตุ</h3>
              </div>

              <div className="locationCascadeWrap">
                {/* Building */}
                <div className="formGroup">
                  <label htmlFor={buildingSelectId} className="formLabel" style={{ fontSize: '0.8rem' }}>
                    1. อาคาร / ตึก <span className="reqStar" aria-hidden="true">*</span>
                  </label>
                  <select
                    id={buildingSelectId}
                    name="buildingId"
                    className="formSelect"
                    value={selectedBuildingId}
                    onChange={(e) => {
                      setSelectedBuildingId(e.target.value)
                      setSelectedFloorId('')
                      setSelectedRoomId('')
                    }}
                    required
                  >
                    <option value="">-- เลือกอาคาร ({buildingOptions.length} อาคาร) --</option>
                    {buildingOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Floor */}
                <div className="formGroup">
                  <label htmlFor={floorSelectId} className="formLabel" style={{ fontSize: '0.8rem' }}>
                    2. ชั้น <span className="reqStar" aria-hidden="true">*</span>
                  </label>
                  <select
                    id={floorSelectId}
                    name="floorId"
                    className="formSelect"
                    value={selectedFloorId}
                    onChange={(e) => {
                      setSelectedFloorId(e.target.value)
                      setSelectedRoomId('')
                    }}
                    disabled={!selectedBuildingId}
                    required
                  >
                    <option value="">
                      {!selectedBuildingId ? '-- กรุณาเลือกอาคารก่อน --' : `-- เลือกชั้น (${floorOptions.length} ชั้น) --`}
                    </option>
                    {floorOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room */}
                <div className="formGroup">
                  <label htmlFor={roomSelectId} className="formLabel" style={{ fontSize: '0.8rem' }}>
                    3. ห้อง / แผนก / จุดบริการ <span className="reqStar" aria-hidden="true">*</span>
                  </label>
                  <select
                    id={roomSelectId}
                    name="roomId"
                    className="formSelect"
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    disabled={!selectedFloorId}
                    required
                  >
                    <option value="">
                      {!selectedFloorId ? '-- กรุณาเลือกชั้นก่อน --' : `-- เลือกห้อง (${roomOptions.length} ห้อง) --`}
                    </option>
                    {roomOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specific Location Note Toggle */}
                <div className="specificLocationSection">
                  <label className="specificLocationToggle">
                    <input
                      type="checkbox"
                      checked={hasSpecificNote}
                      onChange={(e) => {
                        setHasSpecificNote(e.target.checked)
                        if (!e.target.checked) setSpecificNote('')
                      }}
                    />
                    <span>ระบุจุดเพิ่มเติมเฉพาะเจาะจง</span>
                  </label>

                  {hasSpecificNote && (
                    <div className="formGroup" style={{ marginTop: '0.45rem' }}>
                      <label htmlFor={specificNoteId} className="sr-only">
                        จุดเฉพาะเจาะจง
                      </label>
                      <input
                        id={specificNoteId}
                        name="specificNote"
                        type="text"
                        className="formInput"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                        placeholder="เช่น หน้าห้องน้ำ, เสาต้นที่ 3, โต๊ะพยาบาลหมายเลข 2"
                        value={specificNote}
                        onChange={(e) => setSpecificNote(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Box 2: Urgency Triage */}
            <div className="sidebarBox">
              <div className="sidebarBoxHeader">
                <Clock aria-hidden="true" className="w-4 h-4 text-teal-600" />
                <h3 className="sidebarBoxTitle">ระดับความเร่งด่วน</h3>
              </div>

              <div role="radiogroup" aria-label="ระดับความเร่งด่วน" className="urgencyCardsGrid">
                <button
                  type="button"
                  role="radio"
                  aria-checked={urgency === 'NORMAL'}
                  className={`urgencyCard normal ${urgency === 'NORMAL' ? 'active' : ''}`}
                  onClick={() => setUrgency('NORMAL')}
                >
                  <span className="urgencyCardIcon" aria-hidden="true">🟢</span>
                  <span className="urgencyCardTitle">ปกติ</span>
                  <span className="urgencyCardSub">ตามคิวงาน</span>
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
                  <span className="urgencyCardSub">กระทบงาน</span>
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
                  <span className="urgencyCardSub">ฉุกเฉิน/คนไข้</span>
                </button>
              </div>

              {urgency !== 'NORMAL' && (
                <span className="urgencyNoticeBadge">
                  <Zap aria-hidden="true" className="w-3.5 h-3.5 text-amber-600 shrink-0 inline mr-1" />
                  งานด่วนจะถูกจัดลำดับความสำคัญในคิวงานของช่างทันที
                </span>
              )}
            </div>

            {/* Sidebar Box 3: Reporter Identity */}
            <div className="sidebarBox">
              <div className="sidebarBoxHeader">
                <User aria-hidden="true" className="w-4 h-4 text-teal-600" />
                <h3 className="sidebarBoxTitle">ผู้แจ้งซ่อม</h3>
              </div>

              <div className="requesterProfileCard">
                <div className="requesterAvatar" aria-hidden="true">
                  {(currentUser.name || currentUser.username || 'U')[0].toUpperCase()}
                </div>
                <div className="requesterDetails">
                  <span className="requesterName">{currentUser.name || currentUser.username}</span>
                  <span className="requesterDept">
                    {currentUser.position || currentUser.department || 'บุคลากรโรงพยาบาล'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar Box 4: Submission & Form Readiness Checklist */}
            <div className="sidebarBox submissionBox">
              <span className="checklistTitle">
                <CheckCircle aria-hidden="true" className="w-4 h-4 text-teal-600 inline mr-1" />
                ความพร้อมของข้อมูลใบแจ้งซ่อม:
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
                  disabled={submitting || isUploadingPhotos}
                  className="btnSubmitPrimary"
                >
                  {submitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                      <span>{isUploadingPhotos ? 'กำลังอัปโหลดรูปภาพ…' : 'กำลังส่งใบแจ้งซ่อม…'}</span>
                    </>
                  ) : (
                    <>
                      <Send aria-hidden="true" className="w-5 h-5" />
                      <span>ยืนยันส่งใบแจ้งซ่อม</span>
                    </>
                  )}
                </button>

                <Link href="/member/inbox" className="btnCancelSecondary">
                  ยกเลิก
                </Link>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}
