'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
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
  Info
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

function calculateWarrantyInfo(warrantyEndDateStr?: string | null, expireDateStr?: string | null): WarrantyInfo {
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

  let durationParts: string[] = []
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

export default function RepairFormClient({
  currentUser,
  initialLocations,
}: RepairFormClientProps) {
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
    const fullName = asset.name + (asset.brand || asset.model ? ` (${[asset.brand, asset.model].filter(Boolean).join(' ')})` : '')
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
      const match = initialLocations.find((l) => l.full_name === asset.locationFullName || asset.locationFullName.includes(l.room_name))
      if (match) {
        setSelectedBuildingId(String(match.building_id))
        setSelectedFloorId(String(match.floor_id))
        setSelectedRoomId(String(match.id))
      }
    }

    setShowAssetSuggestions(false)
  }

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const newFiles: { file: File; previewUrl: string }[] = []
    const totalCount = photos.length + selectedFiles.length

    if (totalCount > 5) {
      alert('สามารถแนบรูปภาพได้สูงสุดไม่เกิน 5 รูป')
      return
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]
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
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index]
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validation
    if (itemCategory === 'EQUIPMENT' && !equipmentNumber.trim() && !equipmentName.trim()) {
      setErrorMessage('กรุณาระบุเลขทะเบียนครุภัณฑ์ หรือชื่อครุภัณฑ์')
      return
    }

    if (itemCategory === 'NON_EQUIPMENT' && !nonEquipmentItem.trim()) {
      setErrorMessage('กรุณาระบุรายการ/สิ่งของที่ชำรุดเสียหาย')
      return
    }

    if (!selectedRoomId) {
      setErrorMessage('กรุณาเลือกสถานที่ (อาคาร, ชั้น และห้อง/แผนก) ให้ครบถ้วน')
      return
    }

    const pickedRoom = initialLocations.find((l) => l.id === Number(selectedRoomId))
    if (!pickedRoom) {
      setErrorMessage('ไม่พบข้อมูลห้องที่เลือก กรุณาเลือกใหม่')
      return
    }

    const finalLocationFullName = hasSpecificNote && specificNote.trim()
      ? `${pickedRoom.full_name} (${specificNote.trim()})`
      : pickedRoom.full_name

    if (!symptomDetail.trim()) {
      setErrorMessage('กรุณาระบุรายละเอียดหรืออาการเสีย')
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

      // 2. Submit repair ticket (technician selection is removed; assignedTechnicianId is always null for queue dispatch)
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
    } finally {
      setSubmitting(false)
      setIsUploadingPhotos(false)
    }
  }

  // Success Screen
  if (successInfo) {
    return (
      <div className="repairWrapper">
        <div className="repairSuccessCard">
          <div className="repairSuccessIcon">
            <CheckCircle2 size={54} />
          </div>
          <h2>ส่งใบแจ้งซ่อมสำเร็จเรียบร้อย!</h2>
          <p>
            ระบบได้นำส่งใบงานเข้าสู่ระบบและแจ้งเตือนเข้ากลุ่มงานช่างเรียบร้อยแล้ว ช่างสามารถกดรับงานเพื่อเข้าดำเนินการได้ทันที
          </p>
          <div className="repairTicketBox">
            <span className="ticketLabel">เลขที่ใบแจ้งซ่อม</span>
            <span className="ticketNo">{successInfo.taskNo}</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.75rem', flexWrap: 'wrap' }}>
            <Link href={`/member/inbox/${successInfo.taskId}`} className="submitRepairBtn" style={{ textDecoration: 'none' }}>
              <span>ดูสถานะงานในกล่องงาน</span>
            </Link>
            <Link href="/member/inbox" className="repairCancelBtn" style={{ textDecoration: 'none' }}>
              <span>กลับสู่กล่องงาน</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="repairWrapper">
      {/* ── Top Bar ── */}
      <div className="repairHeaderCard">
        <div className="repairHeaderLeft">
          <div className="repairBadgeIcon">
            <Wrench size={28} />
          </div>
          <div>
            <span className="repairEyebrow">ศูนย์บริการบุคลากร</span>
            <h1>แจ้งซ่อมบำรุง</h1>
            <p>ยื่นคำขอแจ้งซ่อมงานช่าง คอมพิวเตอร์ และเครื่องมือแพทย์ พร้อมส่งตรงเข้ากลุ่มงานช่างและกล่องงาน</p>
          </div>
        </div>

        <Link href="/member/inbox" className="repairBackBtn">
          <ArrowLeft size={16} />
          <span>กลับกล่องงาน</span>
        </Link>
      </div>

      {errorMessage && (
        <div className="repairAlert error" role="alert">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Main Form ── */}
      <form onSubmit={handleSubmit} className="repairFormCard">
        {/* Step 1: Repair Category Selector (3 Tabs) */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">1</span> เลือกประเภทงานซ่อม <span className="reqStar">*</span>
          </label>
          <div className="repairTypeTabs">
            <button
              type="button"
              className={`repairTabBtn ${repairType === 'IT_REPAIR' ? 'active' : ''}`}
              onClick={() => setRepairType('IT_REPAIR')}
            >
              <div className="tabIconWrap">
                <Monitor size={22} />
              </div>
              <div className="tabText">
                <strong>ซ่อมคอมพิวเตอร์ / ไอที</strong>
                <span>คอมพิวเตอร์, ปริ้นเตอร์, เครือข่าย, โสตฯ</span>
              </div>
            </button>

            <button
              type="button"
              className={`repairTabBtn ${repairType === 'GENERAL_REPAIR' ? 'active' : ''}`}
              onClick={() => setRepairType('GENERAL_REPAIR')}
            >
              <div className="tabIconWrap">
                <Wrench size={22} />
              </div>
              <div className="tabText">
                <strong>ซ่อมงานช่างทั่วไป</strong>
                <span>ไฟฟ้า, ประปา, แอร์, อาคารสถานที่, เฟอร์นิเจอร์</span>
              </div>
            </button>

            <button
              type="button"
              className={`repairTabBtn ${repairType === 'MEDICAL_REPAIR' ? 'active' : ''}`}
              onClick={() => setRepairType('MEDICAL_REPAIR')}
            >
              <div className="tabIconWrap">
                <HeartPulse size={22} />
              </div>
              <div className="tabText">
                <strong>ซ่อมเครื่องมือทางการแพทย์</strong>
                <span>เครื่องมือแพทย์, อุปกรณ์ตรวจรักษา, วอร์ด</span>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Item Category (ครุภัณฑ์ vs ไม่ใช่ครุภัณฑ์) */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">2</span> ข้อมูลสิ่งของ / อุปกรณ์ที่ชำรุดเสียหาย <span className="reqStar">*</span>
          </label>
          
          <div className="itemCategoryToggles">
            <label className={`categoryRadioCard ${itemCategory === 'EQUIPMENT' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="itemCategory"
                value="EQUIPMENT"
                checked={itemCategory === 'EQUIPMENT'}
                onChange={() => {
                  setItemCategory('EQUIPMENT')
                  setWarrantyInfo(null)
                }}
              />
              <Package size={20} />
              <div>
                <strong>ครุภัณฑ์ (ค้นหาจากคลังข้อมูลครุภัณฑ์โรงพยาบาล)</strong>
                <span>พิมพ์เลขครุภัณฑ์หรือชื่อเพื่อค้นหา ระบบจะเติมชื่อและตรวจสอบประกันให้อัตโนมัติ</span>
              </div>
            </label>

            <label className={`categoryRadioCard ${itemCategory === 'NON_EQUIPMENT' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="itemCategory"
                value="NON_EQUIPMENT"
                checked={itemCategory === 'NON_EQUIPMENT'}
                onChange={() => {
                  setItemCategory('NON_EQUIPMENT')
                  setWarrantyInfo(null)
                }}
              />
              <Layers size={20} />
              <div>
                <strong>ไม่ใช่ครุภัณฑ์ / วัสดุ / ระบบอาคารสถานที่</strong>
                <span>สิ่งของทั่วไป เช่น หลอดไฟ, ก๊อกน้ำ, ลูกบิดประตู, ท่อน้ำ, ปลั๊กไฟ, โต๊ะ/เก้าอี้</span>
              </div>
            </label>
          </div>

          {/* Conditional inputs */}
          {itemCategory === 'EQUIPMENT' ? (
            <div style={{ marginTop: '1rem' }}>
              <div className="grid2Cols">
                <div className="formGroup" ref={assetWrapperRef} style={{ position: 'relative' }}>
                  <label>
                    เลขทะเบียนครุภัณฑ์ (พิมพ์ค้นหาจากระบบ) <span className="reqStar">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="repairInput withIcon"
                      placeholder="เช่น 7440-013-0007/154/69 หรือชื่อเครื่อง..."
                      value={equipmentNumber}
                      onChange={(e) => {
                        setEquipmentNumber(e.target.value)
                        setWarrantyInfo(null)
                      }}
                      onFocus={() => {
                        if (assetSuggestions.length > 0) setShowAssetSuggestions(true)
                      }}
                    />
                    <Search size={18} className="locIcon" style={{ color: '#94a3b8' }} />
                    {isSearchingAsset && (
                      <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                        <Loader2 size={16} className="animate-spin" />
                      </span>
                    )}
                  </div>

                  {/* Autocomplete suggestions */}
                  {showAssetSuggestions && assetSuggestions.length > 0 && (
                    <div className="assetSuggestionDropdown">
                      <div className="assetSuggestionHeader">
                        <Search size={14} />
                        <span>พบข้อมูลครุภัณฑ์ในคลัง ({assetSuggestions.length} รายการ) - คลิกเพื่อเลือก</span>
                      </div>
                      {assetSuggestions.map((item) => (
                        <div
                          key={item.id}
                          className="assetSuggestionItem"
                          onClick={() => handleSelectAsset(item)}
                        >
                          <div className="assetItemTop">
                            <span className="assetArtNum">{item.articleNum}</span>
                            {item.isUnderWarranty ? (
                              <span className="warrantyPill active">
                                <ShieldCheck size={12} /> ในประกัน
                              </span>
                            ) : (
                              <span className="warrantyPill expired">
                                <ShieldAlert size={12} /> หมดประกัน
                              </span>
                            )}
                          </div>
                          <div className="assetItemName">
                            <strong>{item.name}</strong>
                            {item.brand || item.model ? <span> • {[item.brand, item.model].filter(Boolean).join(' ')}</span> : null}
                          </div>
                          {item.locationFullName && (
                            <div className="assetItemLoc">
                              <MapPin size={12} /> {item.locationFullName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="formGroup">
                  <label>ชื่อครุภัณฑ์ (เติมให้อัตโนมัติเมื่อเลือกครุภัณฑ์)</label>
                  <input
                    type="text"
                    className="repairInput"
                    placeholder="เช่น คอมพิวเตอร์ All-in-One Dell OptiPlex, ปริ้นเตอร์ HP"
                    value={equipmentName}
                    onChange={(e) => setEquipmentName(e.target.value)}
                  />
                </div>
              </div>

              {/* Warranty Card Display */}
              {warrantyInfo && (
                <div className={`warrantyCardContainer ${warrantyInfo.status.toLowerCase()}`}>
                  <div className="warrantyIconWrap">
                    {warrantyInfo.status === 'ACTIVE' ? (
                      <ShieldCheck size={26} className="text-emerald-600" />
                    ) : warrantyInfo.status === 'EXPIRED' ? (
                      <ShieldAlert size={26} className="text-rose-600" />
                    ) : (
                      <Info size={26} className="text-slate-500" />
                    )}
                  </div>
                  <div className="warrantyCardBody">
                    <div className="warrantyCardTitle">
                      <strong>{warrantyInfo.title}</strong>
                      {warrantyInfo.expireDate && (
                        <span className="warrantyDateBadge">
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
              <label>รายการ / สิ่งของที่ชำรุดเสียหาย <span className="reqStar">*</span></label>
              <input
                type="text"
                className="repairInput"
                placeholder="ระบุสิ่งของที่ชำรุด เช่น ก๊อกน้ำอ่างล้างมือรั่วซึม, หลอดไฟนีออนหน้าห้องดับ, ปลั๊กไฟชำรุด"
                value={nonEquipmentItem}
                onChange={(e) => setNonEquipmentItem(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        {/* Step 3: Location Selector (3 Cascading Dropdowns: Building -> Floor -> Room) */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">3</span> สถานที่ตั้งอุปกรณ์ / จุดที่เกิดความเสียหาย <span className="reqStar">*</span>
          </label>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '-0.25rem 0 0.5rem 0' }}>
            กรุณาเลือก อาคาร ➔ ชั้น ➔ ห้อง/แผนก จากระบบ เพื่อให้ทีมช่างเข้าถึงหน้างานได้ถูกต้องและรวดเร็ว
          </p>

          <div className="grid3Cols">
            {/* 1. Building Dropdown */}
            <div className="formGroup">
              <label>1. อาคาร / ตึก <span className="reqStar">*</span></label>
              <select
                className="repairSelect"
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

            {/* 2. Floor Dropdown */}
            <div className="formGroup">
              <label>2. ชั้น <span className="reqStar">*</span></label>
              <select
                className="repairSelect"
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

            {/* 3. Room Dropdown */}
            <div className="formGroup">
              <label>3. ห้อง / แผนก / จุดบริการ <span className="reqStar">*</span></label>
              <select
                className="repairSelect"
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
              <span>ระบุจุดเพิ่มเติม / รายละเอียดตำแหน่งเฉพาะเจาะจง (เช่น หน้าห้องน้ำ, เสาต้นที่ 3, โต๊ะพยาบาลหมายเลข 2)</span>
            </label>

            {hasSpecificNote && (
              <div className="formGroup" style={{ marginTop: '0.65rem' }}>
                <input
                  type="text"
                  className="repairInput"
                  placeholder="พิมพ์ระบุจุดหรือตำแหน่งเฉพาะเจาะจง..."
                  value={specificNote}
                  onChange={(e) => setSpecificNote(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Symptom Description & Urgency */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">4</span> รายละเอียด / อาการชำรุดเสียหาย <span className="reqStar">*</span>
          </label>
          <div className="formGroup">
            <textarea
              className="repairTextarea"
              rows={3}
              placeholder="อธิบายอาการเสีย ปัญหาที่พบ หรือลักษณะความชำรุด เช่น เครื่องปริ้น ลูกกลิ้ง เสียใช้ไม่ได้, น้ำรั่วซึมใต้ซิงค์, เปิดไม่ติดมีกลิ่นไหม้..."
              value={symptomDetail}
              onChange={(e) => setSymptomDetail(e.target.value)}
              required
            />
          </div>

          <div className="formGroup" style={{ marginTop: '0.85rem' }}>
            <label>ระดับความเร่งด่วน</label>
            <div className="urgencyOptions">
              <label className={`urgencyRadio ${urgency === 'NORMAL' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="NORMAL"
                  checked={urgency === 'NORMAL'}
                  onChange={() => setUrgency('NORMAL')}
                />
                <span>🟢 ปกติ (ตามคิวงาน)</span>
              </label>

              <label className={`urgencyRadio ${urgency === 'URGENT' ? 'selected urgent' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="URGENT"
                  checked={urgency === 'URGENT'}
                  onChange={() => setUrgency('URGENT')}
                />
                <span>🟡 ด่วน (กระทบการทำงาน)</span>
              </label>

              <label className={`urgencyRadio ${urgency === 'VERY_URGENT' ? 'selected veryUrgent' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="VERY_URGENT"
                  checked={urgency === 'VERY_URGENT'}
                  onChange={() => setUrgency('VERY_URGENT')}
                />
                <span>🔴 ด่วนที่สุด (บริการคนไข้หยุดชะงัก / ฉุกเฉิน)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Step 5: Photo Uploads (Max 5 files, 10MB each) */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">5</span> แนบรูปถ่ายประกอบความเสียหาย (สูงสุด 5 รูป, รูปละไม่เกิน 10MB)
          </label>

          <div className="photoUploadContainer">
            {photos.map((p, idx) => (
              <div key={idx} className="photoThumbWrap">
                <img src={p.previewUrl} alt={`รูปประกอบความเสียหาย ${idx + 1}`} className="photoThumbImg" />
                <button
                  type="button"
                  className="photoDeleteBtn"
                  onClick={() => removePhoto(idx)}
                  title="ลบรูปนี้"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {photos.length < 5 && (
              <label className="photoUploadBox">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
                <UploadCloud size={24} className="text-gray-400" />
                <span>เพิ่มรูปภาพ ({photos.length}/5)</span>
              </label>
            )}
          </div>
        </div>

        {/* Reporter & Date Info */}
        <div className="reporterInfoBox">
          <div className="reporterMeta">
            <User size={16} />
            <span>
              <strong>ผู้แจ้งซ่อม:</strong> {currentUser.name} ({currentUser.position || currentUser.department || 'บุคลากร'})
            </span>
          </div>
          <div className="reporterMeta">
            <Calendar size={16} />
            <span>
              <strong>วันที่และเวลาแจ้งซ่อม:</strong> {currentDateTimeThai}
            </span>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="formActionRow">
          <Link href="/member/inbox" className="repairCancelBtn">
            ยกเลิก
          </Link>
          <button
            type="submit"
            className="submitRepairBtn"
            disabled={submitting || isUploadingPhotos}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{isUploadingPhotos ? 'กำลังอัปโหลดรูปภาพ...' : 'กำลังส่งใบแจ้งซ่อม...'}</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>ยืนยันส่งใบแจ้งซ่อม</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
