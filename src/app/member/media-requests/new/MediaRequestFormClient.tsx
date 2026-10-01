'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Palette,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  Share2,
  FileText,
  User,
  Phone,
  Building,
  UploadCloud,
  X,
  Link as LinkIcon,
  CheckCircle2,
  ShieldCheck,
  Send,
  Loader2,
  AlertCircle,
  ChevronRight,
  FileCheck,
  ArrowLeft,
  Check,
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

// Predefined Work Types
const WORK_TYPES_CONFIG = [
  { key: 'tri_fold', label: 'แผ่นพับ 3 พับ', icon: '📄', hasCustomInput: false },
  { key: 'website_aw', label: 'AW ขึ้นเว็บไซต์', icon: '🌐', hasCustomInput: false },
  {
    key: 'poster',
    label: 'โปสเตอร์',
    icon: '🖼️',
    hasCustomInput: true,
    placeholder: 'ระบุขนาด เช่น A3, A2, 60x90 ซม.',
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
    placeholder: 'ระบุลักษณะงาน เช่น ไวนิล, Standee, Roll-up',
  },
]

// Predefined Channels
const CHANNELS_CONFIG = [
  { key: 'hospital_social', label: 'สื่อโซเชียลของรพ.', icon: '📱', hasCustomInput: false },
  { key: 'facebook_page', label: 'Page Facebook', icon: '🌐', hasCustomInput: false },
  {
    key: 'indoor',
    label: 'ในอาคารโรงพยาบาล',
    icon: '🏥',
    hasCustomInput: true,
    placeholder: 'ระบุบริเวณ เช่น หน้าห้องตรวจ OPD, โถงประชาสัมพันธ์ชั้น 1',
  },
  {
    key: 'community',
    label: 'ในชุมชน',
    icon: '🏘️',
    hasCustomInput: true,
    placeholder: 'ระบุจุด/ชุมชน เช่น รพ.สต. ในเครือข่าย, ชุมชนเทศบาลเถิน',
  },
  {
    key: 'other',
    label: 'อื่น ๆ',
    icon: '📣',
    hasCustomInput: true,
    placeholder: 'ระบุช่องทางเผยแพร่เพิ่มเติม',
  },
]

export default function MediaRequestFormClient({ currentUser }: MediaRequestFormClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form Fields
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

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setErrorBanner(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
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

        setUploadedFiles((prev) => [
          ...prev,
          {
            fileName: file.name,
            filePath: result.url,
            fileType: file.type,
            fileSize: file.size,
          },
        ])
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์')
    } finally {
      setIsUploading(false)
      e.target.value = ''
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

    const payload = {
      title: title.trim(),
      urgency,
      deliveryDate,
      costType,
      workTypes: activeWorkTypes,
      channels: activeChannels,
      description: description.trim(),
      phone: phone.trim() || null,
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

  return (
    <div className="media-form-container">
      {/* Top Navigation Bar */}
      <div className="mediaFormNav">
        <Link href="/member/media-requests" className="mediaNavBackLink">
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้ารายการคำขอสื่อ</span>
        </Link>
        <div className="mediaNavLocationBadge">
          โรงพยาบาลเถิน จังหวัดลำปาง
        </div>
      </div>

      {/* Main Form Shell Card */}
      <div className="mediaFormCard">
        {/* Hero Header */}
        <div className="mediaFormHeader">
          <div className="mediaHeaderInner">
            <div>
              <div className="mediaHeaderBadge">
                <Palette className="w-3.5 h-3.5" />
                Hospital PR & Media Requisition
              </div>
              <h1 className="mediaHeaderTitle">
                แบบฟอร์มขอรับบริการสื่อประชาสัมพันธ์
              </h1>
              <p className="mediaHeaderSubtitle">
                กรอกข้อมูลความต้องการผลิตสื่อเพื่อส่งเข้าสู่ระบบพิจารณาอนุมัติและลงนามอิเล็กทรอนิกส์
              </p>
            </div>
            <div className="mediaHeaderDateBox">
              <span className="mediaDateLabel">วันที่ทำรายการ</span>
              <span className="mediaDateValue">{thaiDateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mediaFormBody">
          {/* Error Banner */}
          {errorBanner && (
            <div className="errorBanner">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="errorBannerText">{errorBanner}</div>
            </div>
          )}

          {/* 1. General Info & Subject */}
          <div className="sectionBox">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">1</div>
              <h2 className="sectionTitleText">
                ข้อมูลทั่วไปและหัวข้องาน
                <span className="requiredAsterisk">*</span>
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="formGroup">
                <label className="formLabel">
                  เรื่อง / หัวข้องานสื่อประชาสัมพันธ์ <span className="requiredAsterisk">*</span>
                </label>
                <input
                  type="text"
                  className="formInput"
                  placeholder="เช่น ขอความอนุเคราะห์จัดทำโปสเตอร์ประชาสัมพันธ์งานสัปดาห์เภสัชกรรม 2569"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {/* Urgency */}
                <div className="formGroup">
                  <label className="formLabel">
                    ระดับความเร่งด่วน <span className="requiredAsterisk">*</span>
                  </label>
                  <div className="urgencyCardsGrid">
                    <button
                      type="button"
                      className={`urgencyCard normal ${urgency === 'NORMAL' ? 'active' : ''}`}
                      onClick={() => setUrgency('NORMAL')}
                    >
                      <span className="urgencyCardIcon">🟢</span>
                      <span className="urgencyCardTitle">ปกติ</span>
                    </button>
                    <button
                      type="button"
                      className={`urgencyCard urgent ${urgency === 'URGENT' ? 'active' : ''}`}
                      onClick={() => setUrgency('URGENT')}
                    >
                      <span className="urgencyCardIcon">🟡</span>
                      <span className="urgencyCardTitle">ด่วน</span>
                    </button>
                    <button
                      type="button"
                      className={`urgencyCard veryUrgent ${urgency === 'VERY_URGENT' ? 'active' : ''}`}
                      onClick={() => setUrgency('VERY_URGENT')}
                    >
                      <span className="urgencyCardIcon">🔴</span>
                      <span className="urgencyCardTitle">ด่วนที่สุด</span>
                    </button>
                  </div>
                </div>

                {/* Delivery Date */}
                <div className="formGroup">
                  <label className="formLabel">
                    วันที่ขอรับงานเสร็จ <span className="requiredAsterisk">*</span>
                  </label>
                  <input
                    type="date"
                    className="formInput"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                  />
                  <div className="quickDateButtons">
                    <span className="quickDateLabel">ปุ่มลัด:</span>
                    <button
                      type="button"
                      onClick={() => setDaysFromNow(3)}
                      className="quickDateBtn"
                    >
                      +3 วัน
                    </button>
                    <button
                      type="button"
                      onClick={() => setDaysFromNow(7)}
                      className="quickDateBtn"
                    >
                      +7 วัน
                    </button>
                    <button
                      type="button"
                      onClick={() => setDaysFromNow(14)}
                      className="quickDateBtn"
                    >
                      +14 วัน
                    </button>
                    <button
                      type="button"
                      onClick={() => setDaysFromNow(30)}
                      className="quickDateBtn"
                    >
                      +1 เดือน
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Cost Model & Approval Route */}
          <div className="sectionBox highlightBg">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">2</div>
              <h2 className="sectionTitleText">
                รูปแบบค่าใช้จ่ายและสายงานพิจารณาอนุมัติ
                <span className="requiredAsterisk">*</span>
              </h2>
            </div>

            <div className="costCardsGrid">
              <div
                className={`costCard ${costType === 'NO_COST' ? 'active' : ''}`}
                onClick={() => setCostType('NO_COST')}
              >
                <div className="costRadioCircle">
                  {costType === 'NO_COST' && <div className="costRadioInner" />}
                </div>
                <div>
                  <span className="costCardHeading">
                    🟢 ไม่มีค่าใช้จ่าย (No Cost)
                  </span>
                  <span className="costCardDescription">
                    งานกราฟิก/ตัดต่อภายใน ไม่มีการจัดซื้อจ้างภายนอก ผ่าน 3 ขั้นตอน (สิ้นสุดที่หัวหน้าเจ้าหน้าที่พัสดุ)
                  </span>
                </div>
              </div>

              <div
                className={`costCard ${costType === 'HAS_COST' ? 'active' : ''}`}
                onClick={() => setCostType('HAS_COST')}
              >
                <div className="costRadioCircle">
                  {costType === 'HAS_COST' && <div className="costRadioInner" />}
                </div>
                <div>
                  <span className="costCardHeading">
                    🔴 มีค่าใช้จ่าย (With Cost)
                  </span>
                  <span className="costCardDescription">
                    มีค่าใช้จ่ายจัดซื้อจัดจ้างพิมพ์/ผลิตภายนอก ผ่าน 4 ขั้นตอน (เสนอถึงผู้อำนวยการโรงพยาบาลเถิน)
                  </span>
                </div>
              </div>
            </div>

            {/* Approval Chain Visualizer */}
            <div className="workflowChainBox">
              <span className="workflowChainTitle">
                เส้นทางการลงนามอนุมัติในระบบ (Approval Workflow):
              </span>
              <div className="workflowStepList">
                <span className="workflowStepPill active">
                  <span className="workflowStepNumber">1</span>
                  หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์
                </span>
                <ChevronRight className="workflowArrow" />
                <span className="workflowStepPill active">
                  <span className="workflowStepNumber">2</span>
                  เจ้าหน้าที่พัสดุ
                </span>
                <ChevronRight className="workflowArrow" />
                <span className="workflowStepPill active">
                  <span className="workflowStepNumber">3</span>
                  หัวหน้าเจ้าหน้าที่พัสดุ
                </span>
                {costType === 'HAS_COST' && (
                  <>
                    <ChevronRight className="workflowArrow" />
                    <span className="workflowStepPill active director">
                      <span className="workflowStepNumber">4</span>
                      ผู้อำนวยการโรงพยาบาลเถิน
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. Work Characteristics (Multi-select) */}
          <div className="sectionBox">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">3</div>
              <h2 className="sectionTitleText">
                ลักษณะงานที่ต้องการขอรับบริการ (เลือกได้หลายรายการ)
                <span className="requiredAsterisk">*</span>
              </h2>
            </div>

            <div className="checkboxCardGrid">
              {WORK_TYPES_CONFIG.map((item) => {
                const isSelected = !!selectedWorkTypes[item.key]?.selected
                const currentDetail = selectedWorkTypes[item.key]?.customDetail || ''

                return (
                  <div
                    key={item.key}
                    className={`selectableCard ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleWorkType(item.key)}
                  >
                    <div className="selectableCardHeader">
                      <div className="customCheckbox">
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="selectableCardIcon">{item.icon}</span>
                      <span className="selectableCardLabel">{item.label}</span>
                    </div>

                    {item.hasCustomInput && isSelected && (
                      <div className="customDetailInputWrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="customDetailInput"
                          placeholder={item.placeholder}
                          value={currentDetail}
                          onChange={(e) => setWorkTypeDetail(item.key, e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. Distribution Channels (Multi-select) */}
          <div className="sectionBox">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">4</div>
              <h2 className="sectionTitleText">
                ต้องการเผยแพร่ทางช่องทางใด (เลือกได้หลายรายการ)
                <span className="requiredAsterisk">*</span>
              </h2>
            </div>

            <div className="checkboxCardGrid">
              {CHANNELS_CONFIG.map((item) => {
                const isSelected = !!selectedChannels[item.key]?.selected
                const currentDetail = selectedChannels[item.key]?.customDetail || ''

                return (
                  <div
                    key={item.key}
                    className={`selectableCard ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleChannel(item.key)}
                  >
                    <div className="selectableCardHeader">
                      <div className="customCheckbox">
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="selectableCardIcon">{item.icon}</span>
                      <span className="selectableCardLabel">{item.label}</span>
                    </div>

                    {item.hasCustomInput && isSelected && (
                      <div className="customDetailInputWrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="customDetailInput"
                          placeholder={item.placeholder}
                          value={currentDetail}
                          onChange={(e) => setChannelDetail(item.key, e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5. Detailed Specifications */}
          <div className="sectionBox">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">5</div>
              <h2 className="sectionTitleText">
                รายละเอียดงานสื่อประชาสัมพันธ์ (โปรดระบุให้ชัดเจน)
                <span className="requiredAsterisk">*</span>
              </h2>
            </div>

            <div className="formGroup">
              <textarea
                className="formTextarea"
                rows={5}
                placeholder="ระบุข้อความ/เนื้อหาที่ต้องการให้ใส่ในสื่อ, แนวทางโทนสี, กลุ่มเป้าหมายผู้รับชม, หรือข้อกำหนดพิเศษอื่น ๆ..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                <span>กรุณาระบุรายละเอียดให้ครบถ้วนเพื่อความสะดวกรวดเร็วในการออกแบบ</span>
                <span>{description.length} ตัวอักษร</span>
              </div>
            </div>
          </div>

          {/* 6. Requester Contact Information */}
          <div className="sectionBox highlightBg">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">6</div>
              <h2 className="sectionTitleText">ข้อมูลผู้ยื่นคำขอและหน่วยงาน</h2>
            </div>

            <div className="requesterInfoGrid">
              <div className="requesterInfoBox">
                <div className="requesterInfoIcon">
                  <User className="w-5 h-5" />
                </div>
                <div className="requesterInfoText">
                  <span className="requesterInfoLabel">ผู้ขอ (จากบัญชีผู้ใช้)</span>
                  <span className="requesterInfoValue">{currentUser.name || currentUser.username}</span>
                </div>
              </div>

              <div className="requesterInfoBox">
                <div className="requesterInfoIcon">
                  <Building className="w-5 h-5" />
                </div>
                <div className="requesterInfoText">
                  <span className="requesterInfoLabel">กลุ่มงาน / หน่วยงาน</span>
                  <span className="requesterInfoValue">{currentUser.department || 'ไม่ระบุกลุ่มงาน'}</span>
                </div>
              </div>

              <div className="requesterInfoBox">
                <div className="requesterInfoIcon">
                  <Phone className="w-5 h-5" />
                </div>
                <div style={{ flex: 1 }}>
                  <span className="requesterInfoLabel">เบอร์โทรแผนก / เบอร์ภายใน</span>
                  <input
                    type="text"
                    className="formInput"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.875rem', marginTop: '0.2rem' }}
                    placeholder="เช่น 102, 108 หรือ 08X-XXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 7. Attachments & Google Drive Links */}
          <div className="sectionBox">
            <div className="sectionHeader">
              <div className="sectionNumberBadge">7</div>
              <h2 className="sectionTitleText">แนบไฟล์ตัวอย่าง / เอกสารเนื้อหา / ลิงก์ไดรฟ์</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* File Uploader */}
              <div className="fileUploadZone">
                <input
                  type="file"
                  id="media-files"
                  style={{ display: 'none' }}
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.zip"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <label htmlFor="media-files" style={{ cursor: 'pointer', display: 'block' }}>
                  {isUploading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-2" />
                      <span className="fileUploadTitle">กำลังอัปโหลดไฟล์...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="fileUploadIcon">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <span className="fileUploadTitle">
                        คลิกเพื่อเลือกไฟล์ตัวอย่าง หรือลากไฟล์มาวางที่นี่
                      </span>
                      <span className="fileUploadDesc">
                        รองรับรูปภาพ (JPG, PNG), PDF, Word (DOCX), PowerPoint (PPTX), ZIP (สูงสุด 25MB ต่อไฟล์)
                      </span>
                    </div>
                  )}
                </label>
              </div>

              {/* Uploaded Files Chips Grid */}
              {uploadedFiles.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
                    ไฟล์ที่แนบแล้ว ({uploadedFiles.length} รายการ):
                  </span>
                  <div className="uploadedFilesGrid">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="uploadedFileChip">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                          <FileCheck className="w-4 h-4 text-teal-600 shrink-0" />
                          <span className="uploadedFileName">{file.fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(idx)}
                          className="btnRemoveFile"
                          title="ลบไฟล์"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cloud / Google Drive Link */}
              <div className="formGroup" style={{ marginTop: '0.5rem' }}>
                <label className="formLabel" style={{ fontSize: '0.825rem' }}>
                  <LinkIcon className="w-3.5 h-3.5 text-teal-600" />
                  หรือ แนบลิงก์ Google Drive / Canva / Cloud Storage
                </label>
                <input
                  type="url"
                  className="formInput"
                  placeholder="https://drive.google.com/... หรือ https://canva.com/..."
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="formActionBar">
            <Link href="/member/media-requests" className="btnCancel">
              ยกเลิก
            </Link>

            <button
              type="submit"
              disabled={isPending || isUploading}
              className="btnSubmit"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังส่งคำขอเข้าสู่ระบบ...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>ส่งคำขอรับบริการสื่อประชาสัมพันธ์</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && createdTaskInfo && (
        <div className="successModalOverlay">
          <div className="successModalCard">
            <div className="successIconBadge">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="successModalTitle">ส่งคำขอสื่อเรียบร้อยแล้ว</h3>
            <p className="successModalDesc">
              ระบบได้บันทึกคำขอและส่งเรื่องไปยังหัวหน้ากลุ่มงานดิจิทัลทางการแพทย์เพื่อตรวจสอบและลงนาม
            </p>

            <div className="successTaskNoBox">
              <span className="successTaskNoLabel">รหัสเอกสารคำขอ</span>
              <span className="successTaskNoValue">{createdTaskInfo.taskNo}</span>
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
