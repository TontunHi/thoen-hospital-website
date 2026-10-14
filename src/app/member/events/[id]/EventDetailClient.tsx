'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  QrCode,
  Download,
  Printer,
  Copy,
  ArrowLeft,
  Package,
  ShieldCheck,
  Trophy,
  Pencil,
  Trash2,
  Plus,
  Search,
  UserPlus,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import '../events.css'

interface CurrentUser {
  id: number
  username: string
  name: string
  department: string | null
  position: string | null
  role: string
  isAdmin: boolean
}

interface MemberOption {
  id: number
  name: string | null
  department: string | null
  position: string | null
}

interface EventDetailClientProps {
  event: any
  checkinUrl: string
  currentUser: CurrentUser
  availableMembers?: MemberOption[]
}

export default function EventDetailClient({
  event: initialEvent,
  checkinUrl,
  currentUser,
  availableMembers = [],
}: EventDetailClientProps) {
  const [event, setEvent] = useState(initialEvent)
  const [attendances, setAttendances] = useState<any[]>(initialEvent.attendances || [])
  const [registrations, setRegistrations] = useState<any[]>(initialEvent.registrations || [])
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [activeTab, setActiveTab] = useState<'attendances' | 'registrations'>('attendances')

  const canManage = Boolean(event.canManage || currentUser.isAdmin)

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [memberSearchText, setMemberSearchText] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null)
  const [addPoints, setAddPoints] = useState(1)
  const [addTime, setAddTime] = useState('')
  const [addNote, setAddNote] = useState('')

  // Edit Modal State
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null)
  const [editPoints, setEditPoints] = useState(1)
  const [editTime, setEditTime] = useState('')

  // Delete Modal State
  const [deletingAttendance, setDeletingAttendance] = useState<any | null>(null)

  // Action status
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Edit Event Modal State
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('UPCOMING')
  const [editFiscalYear, setEditFiscalYear] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editHasCustomCheckin, setEditHasCustomCheckin] = useState(false)
  const [editCheckinOpen, setEditCheckinOpen] = useState('')
  const [editCheckinClose, setEditCheckinClose] = useState('')
  const [editEventLoading, setEditEventLoading] = useState(false)
  const [editEventError, setEditEventError] = useState<string | null>(null)

  function toDatetimeLocal(isoStr: string | null | undefined): string {
    if (!isoStr) return ''
    const match = String(isoStr).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
    if (match) {
      return `${match[1]}T${match[2]}`
    }
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return ''
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  const handleOpenEditEvent = () => {
    setEditTitle(event.title || '')
    setEditDescription(event.description || '')
    setEditLocation(event.location || '')
    setEditStatus(event.status || 'UPCOMING')
    setEditFiscalYear(event.fiscalYear || '')
    const sDate = toDatetimeLocal(event.eventStartDate)
    const eDate = toDatetimeLocal(event.eventEndDate)
    setEditStartDate(sDate)
    setEditEndDate(eDate)
    const cOpen = toDatetimeLocal(event.checkinOpenTime)
    const cClose = toDatetimeLocal(event.checkinCloseTime)
    const hasCustom = Boolean(cOpen && cClose && (cOpen !== sDate || cClose !== eDate))
    setEditHasCustomCheckin(hasCustom)
    setEditCheckinOpen(cOpen || sDate)
    setEditCheckinClose(cClose || eDate)
    setEditEventError(null)
    setIsEditEventModalOpen(true)
  }

  const handleSaveEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditEventError(null)

    if (!editTitle.trim()) {
      setEditEventError('กรุณาระบุชื่อกิจกรรม')
      return
    }
    if (!editStartDate || !editEndDate) {
      setEditEventError('กรุณาระบุวันเวลาเริ่มต้นและสิ้นสุดกิจกรรม')
      return
    }
    if (new Date(editStartDate) > new Date(editEndDate)) {
      setEditEventError('วันเวลาเริ่มต้นต้องมาก่อนวันเวลาสิ้นสุด')
      return
    }
    if (editHasCustomCheckin) {
      if (!editCheckinOpen || !editCheckinClose) {
        setEditEventError('กรุณาระบุช่วงเวลาเปิด-ปิดสแกนเช็คอินให้ครบถ้วน')
        return
      }
      if (new Date(editCheckinOpen) > new Date(editCheckinClose)) {
        setEditEventError('เวลาเปิดรับเช็คอินต้องมาก่อนเวลาปิดรับเช็คอิน')
        return
      }
    }

    setEditEventLoading(true)
    try {
      const payload = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        location: editLocation.trim() || null,
        status: editStatus,
        fiscalYear: editFiscalYear.trim() || undefined,
        eventStartDate: editStartDate,
        eventEndDate: editEndDate,
        checkinOpenTime: editHasCustomCheckin && editCheckinOpen ? editCheckinOpen : editStartDate,
        checkinCloseTime: editHasCustomCheckin && editCheckinClose ? editCheckinClose : editEndDate,
      }

      const res = await fetch(`/api/member/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถแก้ไขข้อมูลกิจกรรมได้')
      }

      setEvent((prev: any) => ({
        ...prev,
        ...json.data,
      }))
      setIsEditEventModalOpen(false)
    } catch (err: any) {
      setEditEventError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลกิจกรรม')
    } finally {
      setEditEventLoading(false)
    }
  }

  // Generate QR code data URL on mount
  useEffect(() => {
    if (checkinUrl) {
      QRCode.toDataURL(checkinUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#064e3b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err))
    }
  }, [checkinUrl])

  const formatThaiDateTime = (dateString: string) => {
    try {
      const d = new Date(dateString)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      const day = d.getDate()
      const month = thaiMonths[d.getMonth()]
      const year = d.getFullYear() + 543
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      return `${day} ${month} ${year} เวลา ${time} น.`
    } catch {
      return dateString
    }
  }

  // Determine check-in window status
  const now = new Date()
  const openTime = new Date(event.checkinOpenTime)
  const closeTime = new Date(event.checkinCloseTime)
  const isEarly = now < openTime
  const isLate = now > closeTime
  const isOpen = !isEarly && !isLate

  // Pre-registration toggle handler
  const handleToggleRegistration = async () => {
    setRegistering(true)
    try {
      const method = event.hasRegistered ? 'DELETE' : 'POST'
      const res = await fetch(`/api/member/events/${event.id}/register`, { method })
      const json = await res.json()

      if (json.success) {
        setEvent((prev: any) => ({
          ...prev,
          hasRegistered: !prev.hasRegistered,
          registrationCount: prev.hasRegistered
            ? prev.registrationCount - 1
            : prev.registrationCount + 1,
        }))
      }
    } catch (err) {
      console.error('Error toggling registration:', err)
    } finally {
      setRegistering(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `QRCode-Event-${event.id}.png`
    a.click()
  }

  // Filter available members that haven't attended yet
  const attendedMemberIds = new Set(attendances.map((a) => a.memberId))
  const eligibleMembers = availableMembers.filter((m) => !attendedMemberIds.has(m.id))

  const searchFilteredMembers = eligibleMembers.filter((m) => {
    if (!memberSearchText.trim()) return false
    const q = memberSearchText.toLowerCase().trim()
    const nameMatch = m.name?.toLowerCase().includes(q) || false
    const deptMatch = m.department?.toLowerCase().includes(q) || false
    const posMatch = m.position?.toLowerCase().includes(q) || false
    return nameMatch || deptMatch || posMatch
  })

  // Open manual add modal
  const handleOpenAddModal = () => {
    setIsAddModalOpen(true)
    setSelectedMember(null)
    setMemberSearchText('')
    setAddPoints(1)
    setAddNote('')
    setActionError(null)
    const localNow = new Date()
    localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset())
    setAddTime(localNow.toISOString().slice(0, 16))
  }

  // Submit manual add
  const handleAddAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember) {
      setActionError('กรุณาเลือกบุคลากรที่ต้องการเพิ่ม')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/member/events/${event.id}/attendances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          pointsAwarded: 1,
          checkedInAt: addTime || undefined,
          note: addNote || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'ไม่สามารถเพิ่มผู้เข้าร่วมได้')

      setAttendances((prev) => [json.data, ...prev])
      setEvent((prev: any) => ({
        ...prev,
        attendanceCount: (prev.attendanceCount || 0) + 1,
      }))
      setIsAddModalOpen(false)
      setSelectedMember(null)
      setMemberSearchText('')
    } catch (err: any) {
      setActionError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มผู้เข้าร่วม')
    } finally {
      setActionLoading(false)
    }
  }

  // Quick check-in from pre-registered list
  const handleQuickCheckinRegistration = async (regMember: any) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/member/events/${event.id}/attendances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: regMember.id,
          pointsAwarded: 1,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'ไม่สามารถเช็คชื่อได้')

      setAttendances((prev) => [json.data, ...prev])
      setEvent((prev: any) => ({
        ...prev,
        attendanceCount: (prev.attendanceCount || 0) + 1,
      }))
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเช็คชื่อ')
    } finally {
      setActionLoading(false)
    }
  }

  // Open edit modal
  const handleOpenEditModal = (att: any) => {
    setEditingAttendance(att)
    setEditPoints(att.pointsAwarded ?? 1)
    const d = new Date(att.checkedInAt)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    setEditTime(d.toISOString().slice(0, 16))
    setActionError(null)
  }

  // Save edit
  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAttendance) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/member/events/${event.id}/attendances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: editingAttendance.id,
          pointsAwarded: editingAttendance.pointsAwarded ?? 1,
          checkedInAt: editTime || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'ไม่สามารถแก้ไขได้')

      setAttendances((prev) =>
        prev.map((a) => (a.id === editingAttendance.id ? json.data : a))
      )
      setEditingAttendance(null)
    } catch (err: any) {
      setActionError(err.message || 'เกิดข้อผิดพลาดในการแก้ไข')
    } finally {
      setActionLoading(false)
    }
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingAttendance) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/member/events/${event.id}/attendances`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: deletingAttendance.id,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'ไม่สามารถลบได้')

      setAttendances((prev) => prev.filter((a) => a.id !== deletingAttendance.id))
      setEvent((prev: any) => ({
        ...prev,
        attendanceCount: Math.max(0, (prev.attendanceCount || 0) - 1),
      }))
      setDeletingAttendance(null)
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการลบ')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="eventsPageContainer">
      {/* Navigation & Header */}
      <div className="backNavRow">
        <Link href="/member/events" className="btnBack">
          <ArrowLeft size={16} />
          <span>กลับหน้ารายการกิจกรรม</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canManage && (
            <button
              type="button"
              onClick={handleOpenEditEvent}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#065f46',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Pencil size={14} />
              <span>แก้ไขรายละเอียดกิจกรรม</span>
            </button>
          )}

          <Link
            href="/member/events/leaderboard"
            className="btnTrophy"
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
          >
            <Trophy size={15} />
            <span>ดูกระดานคะแนน</span>
          </Link>
        </div>
      </div>

      {/* Event Main Banner Card */}
      <div className="detailMainCard">
        <div className="detailHeaderBanner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <span className="eventsPillTag" style={{ margin: 0 }}>
                <Calendar size={12} />
                ปีงบประมาณ {event.fiscalYear}
              </span>

              {isOpen && (
                <span
                  className="eventStatusBadge active"
                  style={{ background: '#34d399', color: '#064e3b', fontWeight: 700 }}
                >
                  ● เปิดรับสแกนเช็คอินอยู่ขณะนี้
                </span>
              )}
              {isEarly && (
                <span
                  className="eventStatusBadge"
                  style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fef3c7' }}
                >
                  <Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  ยังไม่ถึงเวลาเปิดสแกน
                </span>
              )}
              {isLate && (
                <span
                  className="eventStatusBadge"
                  style={{ background: 'rgba(100, 116, 139, 0.3)', color: '#e2e8f0' }}
                >
                  ปิดรับสแกนแล้ว
                </span>
              )}
            </div>
          </div>

          <h1>{event.title}</h1>

          {event.description && <p>{event.description}</p>}

          {/* Quick Meta */}
          <div className="detailMetaGrid">
            <div className="detailMetaItem">
              <Clock size={16} />
              <div>
                <span className="detailMetaLabel">ช่วงเวลากิจกรรม</span>
                <span>{formatThaiDateTime(event.eventStartDate)}</span>
              </div>
            </div>

            {event.location && (
              <div className="detailMetaItem">
                <MapPin size={16} />
                <div>
                  <span className="detailMetaLabel">สถานที่จัดงาน</span>
                  <span>{event.location}</span>
                </div>
              </div>
            )}

            <div className="detailMetaItem">
              <Users size={16} />
              <div>
                <span className="detailMetaLabel">หัวหน้าผู้รับผิดชอบ</span>
                <span>{event.headOrganizer?.name || 'บุคลากรโรงพยาบาล'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar (Pre-registration toggle) */}
        <div className="detailStatusBar">
          <div className="detailCountsRow">
            <div className="detailCountItem">
              <span className="detailCountItemLabel">ลงทะเบียนแล้ว</span>
              <span className="detailCountItemVal">{event.registrationCount} คน</span>
            </div>
            <div style={{ width: '1px', height: '28px', background: '#e2e8f0' }} />
            <div className="detailCountItem">
              <span className="detailCountItemLabel" style={{ color: '#059669', fontWeight: 600 }}>
                เข้างานจริงแล้ว
              </span>
              <span className="detailCountItemVal highlight">{event.attendanceCount} คน</span>
            </div>
          </div>

          <div>
            {event.hasAttended ? (
              <div className="attendanceConfirmedBadge">
                <CheckCircle2 size={16} />
                <span>คุณได้สแกนเข้าร่วมงานแล้ว (+1 คะแนน)</span>
              </div>
            ) : (
              <button
                onClick={handleToggleRegistration}
                disabled={registering}
                className={`btnRegisterAction ${event.hasRegistered ? 'cancel' : 'register'}`}
              >
                <CheckCircle2 size={16} />
                <span>
                  {registering
                    ? 'กำลังประมวลผล...'
                    : event.hasRegistered
                    ? 'ยกเลิกการลงทะเบียน'
                    : 'ลงทะเบียนเข้าร่วมกิจกรรม'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Section (For Organizers and Display) */}
      {canManage && (
        <div className="qrCodeSectionCard">
          <div className="qrCodeRow">
            {/* QR Image Frame */}
            <div className="qrFrameBox">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Event Check-in QR Code"
                  className="qrImage"
                />
              ) : (
                <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinnerCircle" />
                </div>
              )}
              <span className="qrSubtext">
                ใช้กล้องมือถือหรือ LINE สแกน (ยืนยันผ่าน ThaID)
              </span>

              {/* QR Action Buttons */}
              <div className="qrActionButtons">
                <button onClick={handleDownloadQr} className="btnQrAction">
                  <Download size={13} />
                  <span>บันทึกรูป</span>
                </button>
                <button onClick={handlePrint} className="btnQrAction">
                  <Printer size={13} />
                  <span>พิมพ์ป้ายตั้งหน้างาน</span>
                </button>
              </div>
            </div>

            {/* QR Instructions and Time Info */}
            <div className="qrDetailsCol">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <QrCode size={18} color="#059669" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    QR Code เช็คอินหน้างาน (Static Check-in QR)
                  </h2>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  ผู้จัดงานสามารถนำ QR Code นี้ฉายขึ้นจอโปรเจกเตอร์ หรือพิมพ์เป็นป้ายตั้งไว้ ณ จุดลงทะเบียนหน้างานได้ทันที
                </p>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#065f46' }}>
                  📸 <strong>วิธีสแกน:</strong> ใช้ <strong>กล้องมือถือทั่วไป (iPhone / Android)</strong> หรือ <strong>แอป LINE</strong> สแกน QR Code นี้ ระบบจะเปิดแอป ThaID เพื่อยืนยันตัวตนให้อัตโนมัติ (ไม่เปิดกล้องจากในแอป ThaID มาสแกนโดยตรง)
                </div>
              </div>

              {/* Time Window Notice */}
              <div className="qrWindowStatusBox">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#334155' }}>เงื่อนไขช่วงเวลาสแกน:</strong>
                  <span className={`eventStatusBadge ${isOpen ? 'active' : ''}`}>
                    {isOpen ? 'เปิดรับสแกน' : isEarly ? 'ยังไม่เปิดรับ' : 'ปิดรับแล้ว'}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0', color: '#475569' }}>
                  • เวลาเปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#475569' }}>
                  • เวลาปิดรับสแกน: {formatThaiDateTime(event.checkinCloseTime)}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#b45309', fontSize: '0.75rem' }}>
                  ⚠️ หากสแกนก่อนเวลาเปิด หรือหลังเวลาปิด ระบบจะปฏิเสธการเช็คอินอัตโนมัติ
                </p>
              </div>

              {/* Link Sharing Box */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  ลิงก์เช็คอินโดยตรง (Direct Check-in URL)
                </label>
                <div className="qrDirectLinkWrap">
                  <input
                    type="text"
                    readOnly
                    value={checkinUrl}
                    className="qrLinkInput"
                  />
                  <button onClick={handleCopyLink} className="btnCopyLink">
                    <Copy size={13} />
                    <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                  </button>
                </div>
              </div>

              {/* How it works note */}
              <div className="qrNoticeBox">
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                  <ShieldCheck size={14} />
                  วิธีการใช้งานสำหรับผู้เข้าร่วม:
                </strong>
                <p style={{ margin: '0.15rem 0' }}>1. ผู้เข้าร่วมเปิดกล้องมือถือ หรือแอป ThaID เพื่อสแกน QR Code</p>
                <p style={{ margin: '0.15rem 0' }}>2. ระบบส่งต่อไปยัง ThaID เพื่อยืนยันตัวตนด้วยเลขบัตรประชาชน (DOPA)</p>
                <p style={{ margin: '0.15rem 0' }}>3. เมื่อยืนยันสำเร็จ ระบบจะบันทึกเช็คอินทันที 1 คน ต่อ 1 ครั้ง และรับ 1 คะแนน</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Linked Material Borrowing Card (If items were borrowed) */}
      {event.borrowRequest && (
        <div className="tableCard" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
              <Package size={16} color="#059669" />
              <span>คำขอยืมวัสดุ/อุปกรณ์สำหรับกิจกรรมนี้ ({event.borrowRequest.requestNo})</span>
            </h3>
            <span className="eventStatusBadge">
              สถานะ: {event.borrowRequest.status}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
            {event.borrowRequest.items?.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 600 }}>• {item.itemName}</span>
                <span style={{ color: '#64748b' }}>จำนวน: {item.quantity} ชิ้น</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Co-organizers List */}
      {event.coOrganizers && event.coOrganizers.length > 0 && (
        <div className="tableCard" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
            <Users size={16} color="#059669" />
            <span>ผู้รับผิดชอบร่วม ({event.coOrganizers.length} ท่าน)</span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {event.coOrganizers.map((co: any) => (
              <span key={co.id} className="eventStatusBadge">
                {co.member?.name} ({co.member?.department || 'ไม่ระบุแผนก'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Attendances vs Registrations */}
      <div className="tableCard">
        <div
          className="eventsTabsGroup"
          style={{ borderRadius: 0, padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
        >
          <button
            onClick={() => setActiveTab('attendances')}
            className={`eventsTabButton ${activeTab === 'attendances' ? 'active' : ''}`}
          >
            ผู้เข้าร่วมงานจริง (เช็คอิน) ({attendances.length})
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`eventsTabButton ${activeTab === 'registrations' ? 'active' : ''}`}
          >
            ผู้ลงทะเบียนล่วงหน้า ({registrations.length})
          </button>
        </div>

        {activeTab === 'attendances' ? (
          <div>
            {/* Attendee Action Header */}
            <div className="attendeeSectionHeader">
              <div className="attendeeCountTitle">
                <CheckCircle2 size={16} color="#059669" />
                <span>รายชื่อผู้เข้าร่วมงานทั้งหมด ({attendances.length} ท่าน)</span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="btnManualAdd"
                >
                  <UserPlus size={14} />
                  <span>+ เพิ่มผู้เข้าร่วมงาน (Manual)</span>
                </button>
              )}
            </div>

            <div className="tableResponsiveWrap">
              {attendances.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  ยังไม่มีผู้สแกนเช็คอินเข้าร่วมกิจกรรมในขณะนี้
                </div>
              ) : (
                <table className="styledTable">
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: 'center' }}>ลำดับ</th>
                      <th>ชื่อ-สกุล</th>
                      <th>แผนก/กลุ่มงาน</th>
                      <th>เวลาที่เช็คอิน</th>
                      <th style={{ textAlign: 'center' }}>คะแนน</th>
                      {canManage && <th style={{ textAlign: 'center', width: 110 }}>จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.map((att: any, idx: number) => (
                      <tr key={att.id}>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td>
                          <strong>{att.member?.name || 'บุคลากร'}</strong>
                        </td>
                        <td>{att.member?.department || 'ไม่ระบุแผนก'}</td>
                        <td>{formatThaiDateTime(att.checkedInAt)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="pointsPill">
                            +{att.pointsAwarded} คะแนน
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(att)}
                                className="btnTableAction edit"
                                title="แก้ไขคะแนน/เวลา"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingAttendance(att)}
                                className="btnTableAction delete"
                                title="ลบรายชื่อ"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="tableResponsiveWrap">
              {registrations.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  ยังไม่มีผู้ลงทะเบียนล่วงหน้า
                </div>
              ) : (
                <table className="styledTable">
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: 'center' }}>ลำดับ</th>
                      <th>ชื่อ-สกุล</th>
                      <th>แผนก/กลุ่มงาน</th>
                      <th>วันที่ลงทะเบียน</th>
                      {canManage && <th style={{ textAlign: 'center', width: 140 }}>เช็คชื่อเข้างาน</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg: any, idx: number) => {
                      const hasAttended = attendances.some((a) => a.memberId === reg.memberId)
                      return (
                        <tr key={reg.id}>
                          <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                          <td>
                            <strong>{reg.member?.name || 'บุคลากร'}</strong>
                          </td>
                          <td>{reg.member?.department || 'ไม่ระบุแผนก'}</td>
                          <td>{formatThaiDateTime(reg.registeredAt)}</td>
                          {canManage && (
                            <td style={{ textAlign: 'center' }}>
                              {hasAttended ? (
                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <CheckCircle2 size={13} />
                                  เข้างานแล้ว
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleQuickCheckinRegistration(reg.member)}
                                  className="btnTableAction quickCheckin"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>เช็คชื่อเข้างาน</span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Modal 1: เพิ่มผู้เข้าร่วมงาน (Manual Add Attendance)
          ───────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard">
            <div className="attendeeModalHeader">
              <h3>เพิ่มผู้เข้าร่วมงาน (เช็คชื่อด้วยตนเอง)</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAttendanceSubmit}>
              <div className="attendeeModalBody">
                {actionError && (
                  <div style={{ padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                    {actionError}
                  </div>
                )}

                {/* Member Search & Selection */}
                <div>
                  <label className="formLabel">
                    เลือกบุคลากรที่ต้องการเช็คชื่อ <span className="formRequired">*</span>
                  </label>
                  {!selectedMember ? (
                    <div>
                      <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="พิมพ์ชื่อ, สกุล, หรือแผนกเพื่อค้นหา..."
                          value={memberSearchText}
                          onChange={(e) => setMemberSearchText(e.target.value)}
                          className="memberPickerSearchInput"
                          autoFocus
                        />
                      </div>

                      {memberSearchText.trim() && (
                        <div className="memberPickerResultsList">
                          {searchFilteredMembers.length === 0 ? (
                            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                              ไม่พบบุคลากรที่ตรงกัน หรือได้เข้าร่วมกิจกรรมไปแล้ว
                            </div>
                          ) : (
                            searchFilteredMembers.map((m) => (
                              <div
                                key={m.id}
                                onClick={() => {
                                  setSelectedMember(m)
                                  setMemberSearchText('')
                                }}
                                className="memberPickerItem"
                              >
                                <div>
                                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{m.name}</strong>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {m.department || 'ไม่ระบุแผนก'} • {m.position || 'เจ้าหน้าที่'}
                                  </div>
                                </div>
                                <Plus size={14} color="#059669" />
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="selectedMemberChip">
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{selectedMember.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#047857' }}>
                          {selectedMember.department || 'ไม่ระบุแผนก'} • {selectedMember.position || 'เจ้าหน้าที่'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '0.375rem' }}>
                          +1 คะแนน
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedMember(null)}
                          style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', padding: '0.25rem' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Check-in Time */}
                <div>
                  <label className="formLabel">
                    เวลาที่เช็คอิน
                  </label>
                  <input
                    type="datetime-local"
                    value={addTime}
                    onChange={(e) => setAddTime(e.target.value)}
                    className="formInput"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="formLabel">
                    เหตุผล / บันทึกเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น เช็คชื่อจากเอกสารลงทะเบียนหน้างาน, แบตหมด"
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    className="formInput"
                  />
                </div>
              </div>

              <div className="attendeeModalFooter">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={actionLoading}
                  className="modalBtnCancel"
                >
                  <X size={15} />
                  <span>ยกเลิก</span>
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedMember}
                  className="modalBtnSubmit"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 size={16} className="modalBtnSpinner" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>บันทึกการเข้าร่วม</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 2: แก้ไขข้อมูลผู้เข้าร่วมงาน (Edit Attendance)
          ───────────────────────────────────────────────────────────── */}
      {editingAttendance && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard">
            <div className="attendeeModalHeader">
              <h3>แก้ไขข้อมูลผู้เข้าร่วมงาน</h3>
              <button
                type="button"
                onClick={() => setEditingAttendance(null)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit}>
              <div className="attendeeModalBody">
                {actionError && (
                  <div style={{ padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                    {actionError}
                  </div>
                )}

                <div style={{ padding: '0.75rem 0.95rem', background: '#f8fafc', borderRadius: '0.65rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>บุคลากร</div>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                      {editingAttendance.member?.name || 'บุคลากร'}
                    </strong>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {editingAttendance.member?.department || 'ไม่ระบุแผนก'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>คะแนนสะสม</div>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#065f46', background: '#ecfdf5', padding: '0.2rem 0.55rem', borderRadius: '0.4rem', border: '1px solid #a7f3d0' }}>
                      {editingAttendance.pointsAwarded ?? 1} คะแนน
                    </span>
                  </div>
                </div>

                {/* Check-in Time */}
                <div>
                  <label className="formLabel">
                    เวลาที่เช็คอิน
                  </label>
                  <input
                    type="datetime-local"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="formInput"
                  />
                </div>
              </div>

              <div className="attendeeModalFooter">
                <button
                  type="button"
                  onClick={() => setEditingAttendance(null)}
                  disabled={actionLoading}
                  className="modalBtnCancel"
                >
                  <X size={15} />
                  <span>ยกเลิก</span>
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="modalBtnSubmit"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 size={16} className="modalBtnSpinner" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>บันทึกการแก้ไข</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 3: ยืนยันการลบรายชื่อผู้เข้าร่วม (Confirm Delete)
          ───────────────────────────────────────────────────────────── */}
      {deletingAttendance && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard" style={{ maxWidth: 440 }}>
            <div className="attendeeModalHeader" style={{ borderBottomColor: '#fecaca', background: '#fef2f2' }}>
              <h3 style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                <span>ยืนยันการลบรายชื่อ</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletingAttendance(null)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="attendeeModalBody">
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                คุณต้องการลบรายชื่อ <strong>{deletingAttendance.member?.name}</strong> ออกจากการเข้าร่วมกิจกรรมนี้ใช่หรือไม่?
              </p>
              <div style={{ padding: '0.65rem 0.85rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                ⚠️ คะแนนสะสม ({deletingAttendance.pointsAwarded} คะแนน) จะถูกนำออกจากคะแนนรวมของบุคลากรท่านนี้ทันที
              </div>
            </div>

            <div className="attendeeModalFooter">
              <button
                type="button"
                onClick={() => setDeletingAttendance(null)}
                disabled={actionLoading}
                className="modalBtnCancel"
              >
                <X size={15} />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="modalBtnDanger"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="modalBtnSpinner" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>ยืนยันลบรายชื่อ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 4: แก้ไขรายละเอียดกิจกรรม (Edit Event Details)
          ───────────────────────────────────────────────────────────── */}
      {isEditEventModalOpen && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard" style={{ maxWidth: 640 }}>
            <div className="attendeeModalHeader">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pencil size={18} color="#059669" />
                <span>แก้ไขรายละเอียดกิจกรรม</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditEventModalOpen(false)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEventSubmit}>
              <div className="attendeeModalBody" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {editEventError && (
                  <div style={{ padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                    {editEventError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="formLabel">
                    ชื่อกิจกรรม <span className="formRequired">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="formInput"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="formLabel">คำอธิบาย/วัตถุประสงค์กิจกรรม</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="formInput"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Location & Fiscal Year */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="formLabel">สถานที่จัดงาน</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="formInput"
                    />
                  </div>
                  <div>
                    <label className="formLabel">ปีงบประมาณ พ.ศ.</label>
                    <input
                      type="text"
                      value={editFiscalYear}
                      onChange={(e) => setEditFiscalYear(e.target.value)}
                      className="formInput"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="formLabel">สถานะกิจกรรม</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="formInput"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="UPCOMING">เร็วๆ นี้ (UPCOMING)</option>
                    <option value="ONGOING">กำลังจัดงาน (ONGOING)</option>
                    <option value="COMPLETED">สิ้นสุดแล้ว (COMPLETED)</option>
                    <option value="CANCELLED">ยกเลิกกิจกรรม (CANCELLED)</option>
                  </select>
                </div>

                {/* Event Schedule (Start & End) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="formLabel">
                      วันและเวลาเริ่มกิจกรรม <span className="formRequired">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
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
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="formInput"
                    />
                  </div>
                </div>

                {/* Custom Check-in Time Toggle */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={editHasCustomCheckin}
                      onChange={(e) => setEditHasCustomCheckin(e.target.checked)}
                      style={{ width: '1rem', height: '1rem', accentColor: '#059669', cursor: 'pointer' }}
                    />
                    <span>กำหนดช่วงเวลาเปิด-ปิดสแกน QR Code เช็คอินแยกต่างหาก</span>
                  </label>

                  {editHasCustomCheckin && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div>
                        <label className="formLabel" style={{ color: '#92400e', fontSize: '0.8rem' }}>
                          เวลาเปิดรับสแกนเช็คอิน
                        </label>
                        <input
                          type="datetime-local"
                          value={editCheckinOpen}
                          onChange={(e) => setEditCheckinOpen(e.target.value)}
                          className="formInput"
                        />
                      </div>
                      <div>
                        <label className="formLabel" style={{ color: '#92400e', fontSize: '0.8rem' }}>
                          เวลาปิดรับสแกนเช็คอิน
                        </label>
                        <input
                          type="datetime-local"
                          value={editCheckinClose}
                          onChange={(e) => setEditCheckinClose(e.target.value)}
                          className="formInput"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="attendeeModalFooter">
                <button
                  type="button"
                  onClick={() => setIsEditEventModalOpen(false)}
                  disabled={editEventLoading}
                  className="modalBtnCancel"
                >
                  <X size={15} />
                  <span>ยกเลิก</span>
                </button>
                <button
                  type="submit"
                  disabled={editEventLoading}
                  className="modalBtnSubmit"
                >
                  {editEventLoading ? (
                    <>
                      <Loader2 size={16} className="modalBtnSpinner" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>บันทึกการแก้ไขกิจกรรม</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Standee Sheet (Hidden on screen, perfectly centered on A4 print) */}
      <div className="printStandee">
        <div className="printStandeeBorder">
          <h1 className="printHospitalName">
            โรงพยาบาลเถิน
          </h1>
          <div className="printDivider" />
          
          <h2 className="printEventTitle">{event.title}</h2>
          
          <div className="printEventMeta">
            <p><strong>วันและเวลา:</strong> {formatThaiDateTime(event.eventStartDate)}</p>
            {event.location && (
              <p><strong>สถานที่:</strong> {event.location}</p>
            )}
          </div>

          <div className="printQrContainer">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code สำหรับเช็คอิน"
                className="printQrImage"
              />
            )}
          </div>

          <div className="printInstructions">
            <p className="printInstructionTitle">
              สแกนเช็คอินเข้าร่วมกิจกรรม (ยืนยันตัวตนผ่านแอป ThaID)
            </p>
            <p className="printInstructionTimes">
              ช่วงเวลาเปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)} ถึง {formatThaiDateTime(event.checkinCloseTime)}
            </p>
            <p className="printInstructionNote">
              📱 ใช้กล้องมือถือทั่วไปหรือแอป LINE สแกนป้ายนี้ • ได้รับ 1 คะแนนสะสม
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
