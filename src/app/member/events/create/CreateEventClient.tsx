'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  Clock,
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
} from 'lucide-react'

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
  const [fiscalYear, setFiscalYear] = useState('2569')

  // Co-organizers (Multi-select)
  const [selectedCoOrganizers, setSelectedCoOrganizers] = useState<number[]>([])

  // Material & Asset Borrowing items
  const [borrowRows, setBorrowRows] = useState<BorrowItemRow[]>([])

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Toggle co-organizer
  const handleToggleCoOrganizer = (memberId: number) => {
    setSelectedCoOrganizers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    )
  }

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
        eventStartDate: new Date(eventStartDate).toISOString(),
        eventEndDate: new Date(eventEndDate).toISOString(),
        checkinOpenTime: hasCustomCheckinTime && checkinOpenTime ? new Date(checkinOpenTime).toISOString() : null,
        checkinCloseTime: hasCustomCheckinTime && checkinCloseTime ? new Date(checkinCloseTime).toISOString() : null,
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
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/member/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>กลับหน้ารายการกิจกรรม</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                <Sparkles size={12} />
                สร้างกิจกรรมและเช็คอิน
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              สร้างกิจกรรมใหม่ (Hospital Event)
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1">
              กรอกข้อมูลกิจกรรม กำหนดผู้รับผิดชอบ และเลือกยืมอุปกรณ์หรือวัสดุสนับสนุนงาน
            </p>
          </div>

          {errorMsg && (
            <div className="mx-6 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Section 1: Basic Event Information */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Calendar size={18} className="text-emerald-600" />
                <span>ข้อมูลพื้นฐานของกิจกรรม</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อกิจกรรม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น โครงการอบรมช่วยฟื้นคืนชีพขั้นพื้นฐาน (CPR) ประจำปี 2569"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รายละเอียด / วัตถุประสงค์
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุรายละเอียดกิจกรรม หัวข้อ หรือสิ่งที่ผู้เข้าร่วมต้องเตรียม..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      สถานที่จัดกิจกรรม
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="เช่น ห้องประชุม 1 ชั้น 3 อาคารผู้ป่วยนอก"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ปีงบประมาณ พ.ศ.
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 2569"
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Event Schedule (Start & End) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันและเวลาเริ่มกิจกรรม <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={eventStartDate}
                      onChange={(e) => setEventStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันและเวลาสิ้นสุดกิจกรรม <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={eventEndDate}
                      onChange={(e) => setEventEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Custom Check-in Time Toggle */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="customCheckin"
                      checked={hasCustomCheckinTime}
                      onChange={(e) => setHasCustomCheckinTime(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <label htmlFor="customCheckin" className="text-xs font-medium text-slate-700 cursor-pointer">
                      กำหนดช่วงเวลาเปิด-ปิดสแกน QR Code เช็คอินแยกต่างหาก (หากไม่ติ๊ก จะเปิดให้สแกนตามเวลาจัดงาน)
                    </label>
                  </div>

                  {hasCustomCheckinTime && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 mt-2">
                      <div>
                        <label className="block text-xs font-semibold text-amber-900 mb-1">
                          เวลาเปิดรับสแกนเช็คอิน
                        </label>
                        <input
                          type="datetime-local"
                          value={checkinOpenTime}
                          onChange={(e) => setCheckinOpenTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-amber-900 mb-1">
                          เวลาปิดรับสแกนเช็คอิน
                        </label>
                        <input
                          type="datetime-local"
                          value={checkinCloseTime}
                          onChange={(e) => setCheckinCloseTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                      <p className="text-[11px] text-amber-800 col-span-full">
                        💡 ข้อแนะนำ: สามารถเปิดรับสแกนล่วงหน้า 30 นาทีก่อนเริ่มงาน เพื่อให้เจ้าหน้าที่ทยอยเช็คอินหน้างานได้ทัน
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Organizers (Head + Co-organizers) */}
            <div className="pt-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Users size={18} className="text-emerald-600" />
                <span>ผู้รับผิดชอบกิจกรรม</span>
              </h2>

              <div className="space-y-4">
                {/* Head Organizer (Auto-assigned to current user) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                      หัวหน้ารับผิดชอบ (ผู้สร้าง)
                    </span>
                    <span className="text-sm font-bold text-slate-800">{currentUser.name}</span>
                    <span className="text-xs text-slate-500 block">
                      {currentUser.department || 'ไม่ระบุกลุ่มงาน'} • {currentUser.position || 'เจ้าหน้าที่'}
                    </span>
                  </div>
                  <CheckCircle2 size={18} className="text-emerald-600" />
                </div>

                {/* Co-organizers Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้รับผิดชอบร่วม (Co-organizers) สามารถเลือกเพิ่มได้เลย
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    ผู้รับผิดชอบร่วมจะมีสิทธิ์เปิดดู QR Code หน้างาน และแก้ไขข้อมูลกิจกรรมนี้ได้
                  </p>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                    {availableMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">ไม่พบบุคลากรอื่นในระบบ</p>
                    ) : (
                      availableMembers.map((m) => {
                        const isSelected = selectedCoOrganizers.includes(m.id)
                        return (
                          <div
                            key={m.id}
                            onClick={() => handleToggleCoOrganizer(m.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                              isSelected
                                ? 'bg-emerald-100/70 text-emerald-900 font-semibold'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div>
                              <span>{m.name}</span>
                              <span className="text-[10px] text-slate-500 ml-2">
                                ({m.department || 'ไม่ระบุแผนก'})
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Material & Equipment Borrowing */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Package size={18} className="text-emerald-600" />
                  <span>ยืมวัสดุและอุปกรณ์สำหรับกิจกรรม</span>
                </h2>
                <button
                  type="button"
                  onClick={handleAddBorrowRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <Plus size={14} />
                  <span>+ ยืมอุปกรณ์/วัสดุ</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 mb-3">
                หากกิจกรรมนี้ต้องใช้อุปกรณ์หรือวัสดุ (เช่น สายไฟ, ไมโครโฟน, ปลั๊กพ่วง, โปรเจคเตอร์) สามารถกดเลือกได้ทันที ระบบจะออกใบขอยืมเข้าสู่งานพัสดุให้อัตโนมัติ
              </p>

              {borrowRows.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Package size={28} className="mx-auto text-slate-300 mb-1" />
                  <p className="text-xs text-slate-500">ยังไม่มีรายการขอยืมอุปกรณ์</p>
                  <button
                    type="button"
                    onClick={handleAddBorrowRow}
                    className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    + คลิกเพื่อเลือกรายการยืม
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {borrowRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                    >
                      {/* Type Selector (Material vs Asset) */}
                      <div className="w-full sm:w-32">
                        <label className="text-[10px] text-slate-500 block mb-0.5">ประเภท</label>
                        <select
                          value={row.type}
                          onChange={(e) =>
                            handleUpdateBorrowRow(idx, 'type', e.target.value as any)
                          }
                          className="w-full py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="MATERIAL">วัสดุ/พัสดุ</option>
                          <option value="ASSET">ครุภัณฑ์</option>
                        </select>
                      </div>

                      {/* Item Dropdown */}
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block mb-0.5">เลือกรายการ</label>
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
                          className="w-full py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      </div>

                      {/* Quantity Input */}
                      <div className="w-full sm:w-24">
                        <label className="text-[10px] text-slate-500 block mb-0.5">จำนวน</label>
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
                          className="w-full py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Delete button */}
                      <div className="sm:pt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveBorrowRow(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="ลบรายการนี้"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <Link
                href="/member/events"
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-60"
              >
                <Save size={16} />
                <span>{submitting ? 'กำลังบันทึก...' : 'บันทึกและสร้างกิจกรรม'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
