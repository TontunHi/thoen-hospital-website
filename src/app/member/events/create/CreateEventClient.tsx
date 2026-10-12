'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  MapPin,
  Users,
  Package,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  X,
  UserCheck,
} from 'lucide-react'
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils'
import '../events.css'

interface CurrentUser {
  id: number
  name: string
  department: string | null
  position: string | null
}

interface MaterialOption {
  id: number
  name: string
  category: string
  availableQty: number
  unit: string
}

interface AssetOption {
  id: number
  articleNum: string
  name: string
  category: string
}

interface MemberOption {
  id: number
  name: string | null
  department: string | null
  position: string | null
}

interface BorrowItemRow {
  type: 'MATERIAL' | 'ASSET'
  selectedId: number | ''
  quantity: number
}

interface CreateEventClientProps {
  currentUser: CurrentUser
  loanableMaterials: MaterialOption[]
  loanableAssets: AssetOption[]
  availableMembers: MemberOption[]
}

export default function CreateEventClient({
  currentUser,
  loanableMaterials,
  loanableAssets,
  availableMembers,
}: CreateEventClientProps) {
  const router = useRouter()

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [hasCustomCheckinTime, setHasCustomCheckinTime] = useState(false)
  const [checkinOpenTime, setCheckinOpenTime] = useState('')
  const [checkinCloseTime, setCheckinCloseTime] = useState('')
  const [fiscalYear, setFiscalYear] = useState(() => calculateThaiFiscalYear())
  const [isManualFiscalYear, setIsManualFiscalYear] = useState(false)

  // Auto-sync fiscal year with event start date unless manually customized
  const handleStartDateChange = (val: string) => {
    setEventStartDate(val)
    if (!isManualFiscalYear) {
      setFiscalYear(calculateThaiFiscalYear(val || undefined))
    }
  }

  // Handle manual fiscal year change
  const handleFiscalYearChange = (val: string) => {
    setFiscalYear(val)
    setIsManualFiscalYear(true)
  }

  // Reset to auto-calculated fiscal year
  const handleResetFiscalYear = () => {
    setIsManualFiscalYear(false)
    setFiscalYear(calculateThaiFiscalYear(eventStartDate || undefined))
  }

  // Co-organizers (Multi-select via Search)
  const [selectedCoOrganizers, setSelectedCoOrganizers] = useState<number[]>([])
  const [coOrgSearch, setCoOrgSearch] = useState('')

  // Material & Asset Borrowing items
  const [borrowRows, setBorrowRows] = useState<BorrowItemRow[]>([])

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Add co-organizer
  const handleAddCoOrganizer = (memberId: number) => {
    if (!selectedCoOrganizers.includes(memberId)) {
      setSelectedCoOrganizers((prev) => [...prev, memberId])
    }
    setCoOrgSearch('')
  }

  // Remove co-organizer
  const handleRemoveCoOrganizer = (memberId: number) => {
    setSelectedCoOrganizers((prev) => prev.filter((id) => id !== memberId))
  }

  // Filter available members based on search query (excluding already selected)
  const searchFilteredMembers = availableMembers.filter((m) => {
    if (selectedCoOrganizers.includes(m.id)) return false
    if (!coOrgSearch.trim()) return false

    const q = coOrgSearch.toLowerCase().trim()
    const nameMatch = m.name?.toLowerCase().includes(q) || false
    const deptMatch = m.department?.toLowerCase().includes(q) || false
    const posMatch = m.position?.toLowerCase().includes(q) || false
    return nameMatch || deptMatch || posMatch
  })

  // Add new borrow item row
  const handleAddBorrowRow = () => {
    setBorrowRows((prev) => [
      ...prev,
      { type: 'MATERIAL', selectedId: '', quantity: 1 },
    ])
  }

  // Remove borrow item row
  const handleRemoveBorrowRow = (index: number) => {
    setBorrowRows((prev) => prev.filter((_, i) => i !== index))
  }

  // Update borrow item row
  const handleUpdateBorrowRow = (
    index: number,
    field: keyof BorrowItemRow,
    value: any
  ) => {
    setBorrowRows((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      if (field === 'type') {
        copy[index].selectedId = ''
      }
      return copy
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!title.trim()) {
      setErrorMsg('กรุณาระบุชื่อกิจกรรม')
      return
    }
    if (!eventStartDate || !eventEndDate) {
      setErrorMsg('กรุณาระบุวันเวลาเริ่มต้นและสิ้นสุดกิจกรรม')
      return
    }
    if (new Date(eventStartDate) > new Date(eventEndDate)) {
      setErrorMsg('วันเวลาเริ่มต้นต้องมาก่อนวันเวลาสิ้นสุด')
      return
    }

    if (hasCustomCheckinTime) {
      if (!checkinOpenTime || !checkinCloseTime) {
        setErrorMsg('กรุณาระบุช่วงเวลาเปิด-ปิดรับสแกนเช็คอินให้ครบถ้วน')
        return
      }
      if (new Date(checkinOpenTime) > new Date(checkinCloseTime)) {
        setErrorMsg('เวลาเปิดรับเช็คอินต้องมาก่อนเวลาปิดรับเช็คอิน')
        return
      }
    }

    // Format borrowing basket
    const formattedBorrowItems: Array<{
      itemType: 'ASSET' | 'MATERIAL'
      assetId?: number
      materialId?: number
      itemName: string
      quantity: number
    }> = []

    for (const row of borrowRows) {
      if (!row.selectedId) continue
      if (row.type === 'MATERIAL') {
        const mat = loanableMaterials.find((m) => m.id === Number(row.selectedId))
        if (mat) {
          formattedBorrowItems.push({
            itemType: 'MATERIAL',
            materialId: mat.id,
            itemName: mat.name,
            quantity: Math.max(1, row.quantity),
          })
        }
      } else {
        const ast = loanableAssets.find((a) => a.id === Number(row.selectedId))
        if (ast) {
          formattedBorrowItems.push({
            itemType: 'ASSET',
            assetId: ast.id,
            itemName: `${ast.name} (${ast.articleNum})`,
            quantity: Math.max(1, row.quantity),
          })
        }
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        eventStartDate,
        eventEndDate,
        checkinOpenTime: hasCustomCheckinTime && checkinOpenTime ? checkinOpenTime : null,
        checkinCloseTime: hasCustomCheckinTime && checkinCloseTime ? checkinCloseTime : null,
        fiscalYear,
        coOrganizerMemberIds: selectedCoOrganizers,
        borrowItems: formattedBorrowItems.length > 0 ? formattedBorrowItems : undefined,
      }

      const res = await fetch('/api/member/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถสร้างกิจกรรมได้')
      }

      // Navigate to created event details & QR view
      router.push(`/member/events/${json.data.id}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสร้างกิจกรรม')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="eventsPageContainer">
      {/* Back button */}
      <div className="backNavRow">
        <Link href="/member/events" className="btnBack">
          <ArrowLeft size={16} />
          <span>กลับหน้ารายการกิจกรรม</span>
        </Link>
      </div>

      {/* Form Container */}
      <div className="createEventCard">
        {/* Header */}
        <div className="createEventHeader">
          <div className="eventsPillTag">
            <Sparkles size={12} />
            <span>สร้างกิจกรรมและเช็คอิน</span>
          </div>
          <h1>สร้างกิจกรรมใหม่ (Hospital Event)</h1>
          <p>
            กรอกข้อมูลกิจกรรม กำหนดผู้รับผิดชอบ และเลือกยืมอุปกรณ์หรือวัสดุสนับสนุนงาน
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '1.25rem 2rem 0' }}>
            <div className="formErrorBanner">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="createEventForm">
          {/* Section 1: Basic Event Information */}
          <div>
            <h2 className="formSectionTitle">
              <Calendar size={18} />
              <span>ข้อมูลพื้นฐานของกิจกรรม</span>
            </h2>

            <div className="formRow">
              <label className="formLabel">
                ชื่อกิจกรรม <span className="formRequired">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={`เช่น โครงการอบรมช่วยฟื้นคืนชีพขั้นพื้นฐาน (CPR) ประจำปี ${calculateThaiFiscalYear()}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="formInput"
              />
            </div>

            <div className="formRow">
              <label className="formLabel">
                รายละเอียด / วัตถุประสงค์
              </label>
              <textarea
                rows={3}
                placeholder="ระบุรายละเอียดกิจกรรม หัวข้อ หรือสิ่งที่ผู้เข้าร่วมต้องเตรียม..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="formTextarea"
              />
            </div>

            <div className="formRowTwoCol">
              <div>
                <label className="formLabel">
                  สถานที่จัดกิจกรรม
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="เช่น ห้องประชุม 1 ชั้น 3 อาคารผู้ป่วยนอก"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="formInput"
                    style={{ paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label className="formLabel" style={{ marginBottom: 0 }}>
                    ปีงบประมาณ พ.ศ.
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600, background: '#ecfdf5', padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
                    ปีงบปัจจุบัน {calculateThaiFiscalYear()}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder={`เช่น ${calculateThaiFiscalYear()}`}
                  value={fiscalYear}
                  onChange={(e) => handleFiscalYearChange(e.target.value)}
                  className="formInput"
                />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                  <span>รอบปีงบประมาณ 1 ต.ค. - 30 ก.ย.</span>
                  {isManualFiscalYear && (
                    <button
                      type="button"
                      onClick={handleResetFiscalYear}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                        fontSize: '0.75rem',
                      }}
                    >
                      คำนวณตามวันจัดงาน ({calculateThaiFiscalYear(eventStartDate || undefined)})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Event Schedule (Start & End) */}
            <div className="formRowTwoCol">
              <div>
                <label className="formLabel">
                  วันและเวลาเริ่มกิจกรรม <span className="formRequired">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={eventStartDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="formInput"
                />
              </div>

              <div>
                <label className="formLabel">
                  วันและเวลาสิ้นสุดกิจกรรม <span className="formRequired">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                  className="formInput"
                />
              </div>
            </div>

            {/* Custom Check-in Time Toggle */}
            <div className="formCheckboxGroup">
              <label className="formCheckboxLabel">
                <input
                  type="checkbox"
                  id="customCheckin"
                  checked={hasCustomCheckinTime}
                  onChange={(e) => setHasCustomCheckinTime(e.target.checked)}
                  style={{ width: '1rem', height: '1rem', accentColor: '#059669', cursor: 'pointer' }}
                />
                <span>กำหนดช่วงเวลาเปิด-ปิดสแกน QR Code เช็คอินแยกต่างหาก (หากไม่ติ๊ก จะเปิดให้สแกนตามเวลาจัดงาน)</span>
              </label>

              {hasCustomCheckinTime && (
                <div className="formCustomTimeBox">
                  <div className="formRowTwoCol" style={{ marginBottom: '0.5rem' }}>
                    <div>
                      <label className="formLabel" style={{ color: '#92400e' }}>
                        เวลาเปิดรับสแกนเช็คอิน
                      </label>
                      <input
                        type="datetime-local"
                        value={checkinOpenTime}
                        onChange={(e) => setCheckinOpenTime(e.target.value)}
                        className="formInput"
                      />
                    </div>
                    <div>
                      <label className="formLabel" style={{ color: '#92400e' }}>
                        เวลาปิดรับสแกนเช็คอิน
                      </label>
                      <input
                        type="datetime-local"
                        value={checkinCloseTime}
                        onChange={(e) => setCheckinCloseTime(e.target.value)}
                        className="formInput"
                      />
                    </div>
                  </div>
                  <div className="formCustomTimeTip">
                    💡 ข้อแนะนำ: สามารถเปิดรับสแกนล่วงหน้า 30 นาทีก่อนเริ่มงาน เพื่อให้เจ้าหน้าที่ทยอยเช็คอินหน้างานได้ทัน
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Organizers (Head + Co-organizers Search & Add) */}
          <div>
            <h2 className="formSectionTitle">
              <Users size={18} />
              <span>ผู้รับผิดชอบกิจกรรม</span>
            </h2>

            {/* Head Organizer (Auto-assigned to current user) */}
            <div className="headOrganizerBox">
              <div>
                <span className="headOrgRoleTag">หัวหน้ารับผิดชอบ (ผู้สร้าง)</span>
                <div className="headOrgName">{currentUser.name}</div>
                <div className="headOrgMeta">
                  {currentUser.department || 'ไม่ระบุกลุ่มงาน'} • {currentUser.position || 'เจ้าหน้าที่'}
                </div>
              </div>
              <CheckCircle2 size={20} color="#059669" />
            </div>

            {/* Co-organizers Search & Add */}
            <div style={{ marginTop: '1.25rem' }}>
              <label className="formLabel">
                ผู้รับผิดชอบร่วม (Co-organizers)
              </label>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>
                ผู้รับผิดชอบร่วมจะมีสิทธิ์เปิดดู QR Code หน้างาน และจัดการกิจกรรมนี้ร่วมกัน
              </p>

              {/* Selected Co-Organizers Chips */}
              {selectedCoOrganizers.length > 0 ? (
                <div className="selectedCoOrganizersList">
                  {selectedCoOrganizers.map((id) => {
                    const member = availableMembers.find((m) => m.id === id)
                    if (!member) return null
                    return (
                      <div key={id} className="selectedCoOrgChip">
                        <div className="selectedCoOrgInfo">
                          <UserCheck size={14} style={{ color: '#059669' }} />
                          <span className="selectedCoOrgName">{member.name}</span>
                          <span className="selectedCoOrgDept">
                            ({member.department || 'ไม่ระบุแผนก'})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCoOrganizer(id)}
                          className="btnRemoveCoOrg"
                          title="ลบออก"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="noCoOrgPrompt">
                  ยังไม่มีผู้รับผิดชอบร่วมที่เลือก (พิมพ์ค้นหาชื่อด้านล่างเพื่อเพิ่ม)
                </div>
              )}

              {/* Search Box */}
              <div className="coOrgSearchContainer">
                <div className="coOrgSearchInputWrap">
                  <Search size={16} className="coOrgSearchIcon" />
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อ-สกุล หรือชื่อแผนก เพื่อค้นหาและเพิ่มผู้รับผิดชอบร่วม..."
                    value={coOrgSearch}
                    onChange={(e) => setCoOrgSearch(e.target.value)}
                    className="coOrgSearchInput"
                  />
                  {coOrgSearch && (
                    <button
                      type="button"
                      onClick={() => setCoOrgSearch('')}
                      className="btnClearSearch"
                      title="ล้างข้อความ"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown / Search Results Box */}
                {coOrgSearch.trim().length > 0 && (
                  <div className="coOrgSearchResultsBox">
                    {searchFilteredMembers.length === 0 ? (
                      <div className="coOrgSearchEmpty">
                        ไม่พบบุคลากรที่ตรงกับ &ldquo;{coOrgSearch}&rdquo;
                      </div>
                    ) : (
                      searchFilteredMembers.slice(0, 10).map((m) => (
                        <div
                          key={m.id}
                          className="coOrgSearchResultItem"
                          onClick={() => handleAddCoOrganizer(m.id)}
                        >
                          <div className="coOrgResultText">
                            <div className="coOrgResultName">{m.name}</div>
                            <div className="coOrgResultMeta">
                              {m.department || 'ไม่ระบุกลุ่มงาน'} • {m.position || 'เจ้าหน้าที่'}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btnAddCoOrgBtn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddCoOrganizer(m.id)
                            }}
                          >
                            <Plus size={14} />
                            <span>เพิ่ม</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Material & Equipment Borrowing */}
          <div>
            <div className="borrowSectionHeader">
              <h2 className="formSectionTitle" style={{ margin: 0, border: 'none', padding: 0 }}>
                <Package size={18} />
                <span>ยืมวัสดุและอุปกรณ์สำหรับกิจกรรม</span>
              </h2>
              <button
                type="button"
                onClick={handleAddBorrowRow}
                className="btnAddBorrow"
              >
                <Plus size={14} />
                <span>+ ยืมอุปกรณ์/วัสดุ</span>
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
              หากกิจกรรมนี้ต้องใช้อุปกรณ์หรือวัสดุ (เช่น สายไฟ, ไมโครโฟน, ปลั๊กพ่วง, โปรเจคเตอร์) สามารถกดเลือกได้ทันที ระบบจะออกใบขอยืมเข้าสู่งานพัสดุให้อัตโนมัติ
            </p>

            {borrowRows.length === 0 ? (
              <div className="borrowEmptyState">
                <Package size={30} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.825rem', color: '#64748b' }}>ยังไม่มีรายการขอยืมอุปกรณ์</div>
                <button
                  type="button"
                  onClick={handleAddBorrowRow}
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#059669',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  + คลิกเพื่อเลือกรายการยืม
                </button>
              </div>
            ) : (
              <div>
                {borrowRows.map((row, idx) => (
                  <div key={idx} className="borrowRow">
                    {/* Type Selector */}
                    <select
                      value={row.type}
                      onChange={(e) =>
                        handleUpdateBorrowRow(idx, 'type', e.target.value as any)
                      }
                      className="borrowTypeSelect"
                    >
                      <option value="MATERIAL">วัสดุ/พัสดุ</option>
                      <option value="ASSET">ครุภัณฑ์</option>
                    </select>

                    {/* Item Dropdown */}
                    <select
                      value={row.selectedId}
                      onChange={(e) =>
                        handleUpdateBorrowRow(
                          idx,
                          'selectedId',
                          e.target.value ? Number(e.target.value) : ''
                        )
                      }
                      required
                      className="borrowItemSelect"
                    >
                      <option value="">-- เลือกรายการ --</option>
                      {row.type === 'MATERIAL'
                        ? loanableMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (คงเหลือ: {m.availableQty} {m.unit})
                            </option>
                          ))
                        : loanableAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} [{a.articleNum}]
                            </option>
                          ))}
                    </select>

                    {/* Quantity Input */}
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) =>
                        handleUpdateBorrowRow(
                          idx,
                          'quantity',
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      }
                      className="borrowQtyInput"
                      placeholder="จำนวน"
                    />

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveBorrowRow(idx)}
                      className="btnRemoveBorrow"
                      title="ลบรายการนี้"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="formActionsRow">
            <Link href="/member/events" className="btnCancel">
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btnSubmit"
            >
              <Save size={16} />
              <span>{submitting ? 'กำลังบันทึก...' : 'บันทึกและสร้างกิจกรรม'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
