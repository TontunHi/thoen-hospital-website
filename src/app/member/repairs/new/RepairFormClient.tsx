'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Wrench, 
  Monitor, 
  HeartPulse, 
  MapPin, 
  User, 
  Calendar, 
  Image as ImageIcon, 
  X, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Search,
  Sparkles,
  Send,
  Loader2,
  Package,
  Layers,
  ShieldCheck
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

interface TechnicianItem {
  id: number
  name: string
  position: string
  department: string
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
  technicians: TechnicianItem[]
}

export default function RepairFormClient({
  currentUser,
  initialLocations,
  technicians,
}: RepairFormClientProps) {
  const router = useRouter()

  // 1. Repair Category State
  const [repairType, setRepairType] = useState<'GENERAL_REPAIR' | 'IT_REPAIR' | 'MEDICAL_REPAIR'>('IT_REPAIR')

  // 2. Item Category State (EQUIPMENT vs NON_EQUIPMENT)
  const [itemCategory, setItemCategory] = useState<'EQUIPMENT' | 'NON_EQUIPMENT'>('EQUIPMENT')
  const [equipmentNumber, setEquipmentNumber] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [nonEquipmentItem, setNonEquipmentItem] = useState('')
  const [assetSuggestions, setAssetSuggestions] = useState<any[]>([])
  const [isSearchingAsset, setIsSearchingAsset] = useState(false)
  const [selectedAssetWarranty, setSelectedAssetWarranty] = useState<{ isUnderWarranty: boolean; expireDate?: string } | null>(null)
  const assetWrapperRef = useRef<HTMLDivElement>(null)

  // 3. Location State with Auto-complete
  const [locationSearch, setLocationSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null)
  const [locationOptions, setLocationOptions] = useState<LocationItem[]>(initialLocations)
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const locationWrapperRef = useRef<HTMLDivElement>(null)

  // 4. Symptom & Urgency
  const [symptomDetail, setSymptomDetail] = useState('')
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'VERY_URGENT'>('NORMAL')

  // 5. Technician Assignment
  const [assignMode, setAssignMode] = useState<'AUTO' | 'SPECIFIC'>('AUTO')
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string>('')

  // 6. Photo Attachments (Max 5 files, 10MB each)
  const [photos, setPhotos] = useState<{ file: File; previewUrl: string }[]>([])
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)

  // 7. Form Submission State
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

  // Close location dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (locationWrapperRef.current && !locationWrapperRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search locations when user types
  useEffect(() => {
    if (!locationSearch.trim()) {
      setLocationOptions(initialLocations)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingLocation(true)
      try {
        const res = await fetch(`/api/locations?search=${encodeURIComponent(locationSearch.trim())}`)
        const data = await res.json()
        if (data.success && data.data) {
          setLocationOptions(data.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearchingLocation(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [locationSearch, initialLocations])

  // Search assets when user types in equipment number
  useEffect(() => {
    if (!equipmentNumber.trim() || equipmentNumber.length < 2) {
      setAssetSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingAsset(true)
      try {
        const res = await fetch(`/api/assets/lookup?q=${encodeURIComponent(equipmentNumber.trim())}`)
        const data = await res.json()
        if (data.success && data.data) {
          setAssetSuggestions(data.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearchingAsset(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [equipmentNumber])

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

    if (!selectedLocation && !locationSearch.trim()) {
      setErrorMessage('กรุณาเลือกสถานที่ (อาคาร/ชั้น/ห้อง)')
      return
    }

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

      // 2. Submit repair ticket
      const payload = {
        repairType,
        itemCategory,
        equipmentNumber: equipmentNumber.trim(),
        equipmentName: equipmentName.trim(),
        nonEquipmentItem: nonEquipmentItem.trim(),
        locationId: selectedLocation?.id || null,
        locationFullName: selectedLocation ? selectedLocation.full_name : locationSearch.trim(),
        symptomDetail: symptomDetail.trim(),
        assignedTechnicianId: assignMode === 'SPECIFIC' && assignedTechnicianId ? assignedTechnicianId : null,
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
            ระบบได้บันทึกคำขอและนำส่งเข้าสู่กล่องงานเรียบร้อยแล้ว ช่างและผู้เกี่ยวข้องได้รับการแจ้งเตือน
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
            <p>ยื่นคำขอแจ้งซ่อมงานช่าง คอมพิวเตอร์ และเครื่องมือแพทย์ พร้อมส่งตรงเข้ากล่องงาน</p>
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
                onChange={() => setItemCategory('EQUIPMENT')}
              />
              <Package size={20} />
              <div>
                <strong>ครุภัณฑ์ (มีเลขทะเบียน / ครุภัณฑ์โรงพยาบาล)</strong>
                <span>อุปกรณ์ที่มีรหัสครุภัณฑ์ติดอยู่ เช่น คอมพิวเตอร์, แอร์, เครื่องวัดความดัน</span>
              </div>
            </label>

            <label className={`categoryRadioCard ${itemCategory === 'NON_EQUIPMENT' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="itemCategory"
                value="NON_EQUIPMENT"
                checked={itemCategory === 'NON_EQUIPMENT'}
                onChange={() => setItemCategory('NON_EQUIPMENT')}
              />
              <Layers size={20} />
              <div>
                <strong>ไม่ใช่ครุภัณฑ์ / วัสดุ / อาคารสถานที่</strong>
                <span>สิ่งของทั่วไป เช่น หลอดไฟ, ก๊อกน้ำ, ลูกบิดประตู, สายแลน, เมาส์</span>
              </div>
            </label>
          </div>

          {/* Conditional inputs */}
          {itemCategory === 'EQUIPMENT' ? (
            <div style={{ marginTop: '1rem' }}>
              <div className="grid2Cols">
                <div className="formGroup" style={{ position: 'relative' }}>
                  <label>เลขทะเบียนครุภัณฑ์ (สแกนหรือพิมพ์เพื่อค้นหา)</label>
                  <input
                    type="text"
                    className="repairInput"
                    placeholder="เช่น 7440-013-0007/154/69"
                    value={equipmentNumber}
                    onChange={(e) => {
                      setEquipmentNumber(e.target.value)
                      setSelectedAssetWarranty(null)
                    }}
                  />
                  {isSearchingAsset && (
                    <span style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '0.8rem', color: '#64748b' }}>
                      กำลังค้นหา...
                    </span>
                  )}
                  {assetSuggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        marginTop: '4px',
                      }}
                    >
                      {assetSuggestions.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                          onClick={() => {
                            setEquipmentNumber(item.articleNum)
                            setEquipmentName(item.name + (item.model ? ` (${item.model})` : ''))
                            if (item.category === 'IT') setRepairType('IT_REPAIR')
                            if (item.category === 'MEDICAL') setRepairType('MEDICAL_REPAIR')
                            if (item.category === 'GENERAL') setRepairType('GENERAL_REPAIR')
                            setSelectedAssetWarranty({
                              isUnderWarranty: item.isUnderWarranty,
                              expireDate: item.warrantyEndDate,
                            })
                            setAssetSuggestions([])
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#0284c7', fontSize: '0.875rem' }}>
                            {item.articleNum}
                          </div>
                          <div style={{ fontSize: '0.825rem', color: '#334155' }}>
                            {item.name} {item.model ? `• ${item.model}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="formGroup">
                  <label>ชื่อครุภัณฑ์</label>
                  <input
                    type="text"
                    className="repairInput"
                    placeholder="เช่น เครื่องตรวจคลื่นหัวใจ, เครื่องพิมพ์ HP LaserJet"
                    value={equipmentName}
                    onChange={(e) => setEquipmentName(e.target.value)}
                  />
                </div>
              </div>

              {/* Warranty Alert Badge */}
              {selectedAssetWarranty && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    background: selectedAssetWarranty.isUnderWarranty ? '#ecfdf5' : '#f8fafc',
                    color: selectedAssetWarranty.isUnderWarranty ? '#047857' : '#64748b',
                    border: `1px solid ${selectedAssetWarranty.isUnderWarranty ? '#a7f3d0' : '#e2e8f0'}`,
                  }}
                >
                  {selectedAssetWarranty.isUnderWarranty ? (
                    <>
                      <ShieldCheck size={18} style={{ color: '#059669', flexShrink: 0 }} />
                      <span>
                        <strong>ครุภัณฑ์นี้อยู่ในระยะเวลารับประกัน</strong> (ถึงวันที่{' '}
                        {new Date(selectedAssetWarranty.expireDate || '').toLocaleDateString('th-TH')})
                      </span>
                    </>
                  ) : (
                    <span>ครุภัณฑ์นี้พ้นระยะเวลารับประกันแล้ว (ซ่อมบำรุงโดยช่าง รพ.)</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="formGroup" style={{ marginTop: '1rem' }}>
              <label>รายการ / สิ่งของที่ชำรุดเสียหาย <span className="reqStar">*</span></label>
              <input
                type="text"
                className="repairInput"
                placeholder="ระบุสิ่งของที่ชำรุด เช่น เครื่องปริ้นสติ๊กเกอร์, ก๊อกน้ำอ่างล้างมือ, หลอดไฟนีออน"
                value={nonEquipmentItem}
                onChange={(e) => setNonEquipmentItem(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        {/* Step 3: Location Selector (Auto-complete from hospital_locations) */}
        <div className="repairSection" ref={locationWrapperRef}>
          <label className="sectionHeaderLabel">
            <span className="stepNum">3</span> สถานที่ตั้งอุปกรณ์ / จุดที่เกิดความเสียหาย <span className="reqStar">*</span>
          </label>

          <div style={{ position: 'relative' }}>
            <div className="locationSearchInputWrap">
              <MapPin size={18} className="locIcon" />
              <input
                type="text"
                className="repairInput withIcon"
                placeholder="พิมพ์ค้นหาชื่อห้อง, ตึก หรือชั้น (เช่น OPD, ชั้น 4, ห้องพิเศษ, บัตร)..."
                value={selectedLocation ? selectedLocation.full_name : locationSearch}
                onChange={(e) => {
                  setSelectedLocation(null)
                  setLocationSearch(e.target.value)
                  setIsLocationDropdownOpen(true)
                }}
                onFocus={() => setIsLocationDropdownOpen(true)}
              />
              {selectedLocation && (
                <button
                  type="button"
                  className="clearLocBtn"
                  onClick={() => {
                    setSelectedLocation(null)
                    setLocationSearch('')
                  }}
                  title="ล้างค่า"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Dropdown Results */}
            {isLocationDropdownOpen && (
              <div className="locDropdownMenu">
                {isSearchingLocation ? (
                  <div className="dropdownNotice">
                    <Loader2 size={16} className="animate-spin inline mr-2 text-emerald-600" />
                    กำลังค้นหาสถานที่...
                  </div>
                ) : locationOptions.length === 0 ? (
                  <div className="dropdownNotice">
                    ไม่พบสถานที่ตามคำค้นหา (คุณสามารถพิมพ์ระบุเองได้)
                  </div>
                ) : (
                  locationOptions.map((loc) => (
                    <div
                      key={loc.id}
                      className="locDropdownItem"
                      onClick={() => {
                        setSelectedLocation(loc)
                        setLocationSearch(loc.full_name)
                        setIsLocationDropdownOpen(false)
                      }}
                    >
                      <div className="locItemMain">
                        <strong>{loc.room_name}</strong>
                        <span className="locItemSub">{loc.building_name} • {loc.floor_name}</span>
                      </div>
                      <span className="locBadge">#{loc.id}</span>
                    </div>
                  ))
                )}
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
                <span>ปกติ (ตามคิวงาน)</span>
              </label>

              <label className={`urgencyRadio ${urgency === 'URGENT' ? 'selected urgent' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="URGENT"
                  checked={urgency === 'URGENT'}
                  onChange={() => setUrgency('URGENT')}
                />
                <span>ด่วน (กระทบการทำงาน)</span>
              </label>

              <label className={`urgencyRadio ${urgency === 'VERY_URGENT' ? 'selected veryUrgent' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="VERY_URGENT"
                  checked={urgency === 'VERY_URGENT'}
                  onChange={() => setUrgency('VERY_URGENT')}
                />
                <span>ด่วนที่สุด (บริการคนไข้หยุดชะงัก / ฉุกเฉิน)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Step 5: Technician Selection */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">5</span> การระบุช่างผู้รับผิดชอบ
          </label>
          
          <div className="grid2Cols">
            <label className={`technicianModeCard ${assignMode === 'AUTO' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="assignMode"
                value="AUTO"
                checked={assignMode === 'AUTO'}
                onChange={() => setAssignMode('AUTO')}
              />
              <div>
                <strong>ให้ระบบจัดสรรช่างให้ (อัตโนมัติ)</strong>
                <span>ส่งงานเข้ากองกลางแผนกช่างตามประเภทงาน เพื่อให้หัวหน้าช่างหรือช่างเวรรับเรื่อง</span>
              </div>
            </label>

            <label className={`technicianModeCard ${assignMode === 'SPECIFIC' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="assignMode"
                value="SPECIFIC"
                checked={assignMode === 'SPECIFIC'}
                onChange={() => setAssignMode('SPECIFIC')}
              />
              <div>
                <strong>ระบุชื่อช่างเจาะจง</strong>
                <span>เลือกรายชื่อช่างหรือเจ้าหน้าที่ที่ต้องการมอบหมายงานโดยตรง</span>
              </div>
            </label>
          </div>

          {assignMode === 'SPECIFIC' && (
            <div className="formGroup" style={{ marginTop: '0.85rem' }}>
              <label>เลือกช่างผู้รับผิดชอบ <span className="reqStar">*</span></label>
              <select
                className="repairSelect"
                value={assignedTechnicianId}
                onChange={(e) => setAssignedTechnicianId(e.target.value)}
                required={assignMode === 'SPECIFIC'}
              >
                <option value="">-- เลือกเจ้าหน้าที่ / ช่าง ({technicians.length} ท่าน) --</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.position || t.department || 'เจ้าหน้าที่'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Step 6: Photo Uploads (Max 5 files, 10MB each) */}
        <div className="repairSection">
          <label className="sectionHeaderLabel">
            <span className="stepNum">6</span> แนบรูปถ่ายประกอบความเสียหาย (สูงสุด 5 รูป, รูปละไม่เกิน 10MB)
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

        {/* Step 7: Auto Detected Reporter & Date Info */}
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
