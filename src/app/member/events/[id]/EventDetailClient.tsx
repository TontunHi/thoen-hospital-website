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
  Image as ImageIcon,
  FileText,
  Paperclip,
  MessageSquare,
  ExternalLink,
  Eye,
} from 'lucide-react'
import '../events.css'
import { EventDetailModals } from './components/EventDetailModals'

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

type EventDetailTab = 'attendances' | 'registrations' | 'attachments'

interface EventDetailClientProps {
  event: any
  checkinUrl: string
  currentUser: CurrentUser
  availableMembers?: MemberOption[]
  initialTab?: EventDetailTab
}

export default function EventDetailClient({
  event: initialEvent,
  checkinUrl,
  currentUser,
  availableMembers = [],
  initialTab = 'attendances',
}: EventDetailClientProps) {
  const [event, setEvent] = useState(initialEvent)
  const [attendances, setAttendances] = useState<any[]>(initialEvent.attendances || [])
  const [registrations, setRegistrations] = useState<any[]>(initialEvent.registrations || [])
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [activeTab, setActiveTab] = useState<EventDetailTab>(initialTab)
  const [attachments, setAttachments] = useState<any[]>(initialEvent.attachments || [])
  const [attachmentFilter, setAttachmentFilter] = useState<'ALL' | 'IMAGE' | 'DOCUMENT' | 'NOTE'>('ALL')
  const [isAddAttachModalOpen, setIsAddAttachModalOpen] = useState(false)
  const [attachType, setAttachType] = useState<'IMAGE' | 'DOCUMENT' | 'NOTE'>('IMAGE')
  const [attachTitle, setAttachTitle] = useState('')
  const [attachTextContent, setAttachTextContent] = useState('')
  const [attachFiles, setAttachFiles] = useState<File[]>([])
  const [attachLoading, setAttachLoading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; title: string } | null>(null)
  const [deletingAttachId, setDeletingAttachId] = useState<number | null>(null)

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

  function formatFileSize(bytes?: number | null) {
    if (!bytes || bytes === 0) return ''
    const k = 1024
    if (bytes < k) return `${bytes} B`
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`
    return `${(bytes / (k * k)).toFixed(1)} MB`
  }

  const filteredAttachments = React.useMemo(() => {
    if (attachmentFilter === 'ALL') return attachments
    return attachments.filter((a) => a.attachmentType === attachmentFilter)
  }, [attachments, attachmentFilter])

  const imageCount = React.useMemo(() => attachments.filter((a) => a.attachmentType === 'IMAGE').length, [attachments])
  const docCount = React.useMemo(() => attachments.filter((a) => a.attachmentType === 'DOCUMENT').length, [attachments])
  const noteCount = React.useMemo(() => attachments.filter((a) => a.attachmentType === 'NOTE').length, [attachments])

  const handleOpenAddAttachModal = (type: 'IMAGE' | 'DOCUMENT' | 'NOTE' = 'IMAGE') => {
    setAttachType(type)
    setAttachTitle('')
    setAttachTextContent('')
    setAttachFiles([])
    setAttachError(null)
    setIsAddAttachModalOpen(true)
  }

  const handleSaveAttachmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttachError(null)

    if (attachType === 'NOTE') {
      if (!attachTitle.trim()) {
        setAttachError('กรุณาระบุหัวข้อบันทึก')
        return
      }
      if (!attachTextContent.trim()) {
        setAttachError('กรุณาระบุเนื้อหาข้อความสรุป')
        return
      }
    } else {
      if (attachFiles.length === 0) {
        setAttachError('กรุณาเลือกไฟล์ที่ต้องการอัปโหลด')
        return
      }
    }

    setAttachLoading(true)
    try {
      if (attachType === 'NOTE') {
        const res = await fetch(`/api/member/events/${event.id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachmentType: 'NOTE',
            title: attachTitle.trim(),
            textContent: attachTextContent.trim(),
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'บันทึกข้อความไม่สำเร็จ')
        setAttachments((prev) => [json.data, ...prev])
      } else {
        const formData = new FormData()
        formData.append('attachmentType', attachType)
        if (attachTitle.trim()) {
          formData.append('title', attachTitle.trim())
        }
        for (const f of attachFiles) {
          formData.append('files', f)
        }

        const res = await fetch(`/api/member/events/${event.id}/attachments`, {
          method: 'POST',
          body: formData,
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'อัปโหลดไฟล์ไม่สำเร็จ')
        const newItems = Array.isArray(json.data) ? json.data : [json.data]
        setAttachments((prev) => [...newItems, ...prev])
        if (attachType === 'IMAGE' && attachmentFilter !== 'ALL' && attachmentFilter !== 'IMAGE') {
          setAttachmentFilter('IMAGE')
        }
      }

      setIsAddAttachModalOpen(false)
    } catch (err: any) {
      setAttachError(err.message || 'เกิดข้อผิดพลาดในการแนบข้อมูล')
    } finally {
      setAttachLoading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: number, title: string) => {
    if (!confirm(`คุณต้องการลบ "${title}" ใช่หรือไม่?`)) return

    setDeletingAttachId(attachmentId)
    try {
      const res = await fetch(`/api/member/events/${event.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'ลบข้อมูลไม่สำเร็จ')
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการลบ')
    } finally {
      setDeletingAttachId(null)
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

  const formatThaiDateOnly = (dateString?: string | null) => {
    if (!dateString) return ''
    try {
      const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      if (match) {
        const year = parseInt(match[1], 10) + 543
        const month = thaiMonths[parseInt(match[2], 10) - 1]
        const day = parseInt(match[3], 10)
        return `${day} ${month} ${year}`
      }
      const d = new Date(dateString)
      return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`
    } catch {
      return dateString
    }
  }

  const formatThaiDateTime = (dateString: string) => {
    try {
      const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      if (match) {
        const year = parseInt(match[1], 10) + 543
        const month = thaiMonths[parseInt(match[2], 10) - 1]
        const day = parseInt(match[3], 10)
        return `${day} ${month} ${year} เวลา ${match[4]} น.`
      }
      const d = new Date(dateString)
      const day = d.getDate()
      const month = thaiMonths[d.getMonth()]
      const year = d.getFullYear() + 543
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
      return `${day} ${month} ${year} เวลา ${time} น.`
    } catch {
      return dateString
    }
  }

  function parseDateSafe(val?: string | null): Date | null {
    if (!val) return null
    const match = String(val).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
    if (match) {
      return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5] || '00'}+07:00`)
    }
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }

  // Determine check-in window status
  const now = new Date()
  const openTime = parseDateSafe(event.checkinOpenTime)
  const closeTime = parseDateSafe(event.checkinCloseTime)
  const isEarly = openTime ? now < openTime : false
  const isLate = closeTime ? now > closeTime : false
  const isOpen = Boolean(openTime && closeTime && !isEarly && !isLate)

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
    setEditTime(toDatetimeLocal(att.checkedInAt))
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
          <button
            type="button"
            onClick={() => {
              setActiveTab('attachments')
              handleOpenAddAttachModal('IMAGE')
            }}
            className="btnAttachmentAddTop"
            title={canManage ? 'แนบไฟล์หรือภาพกิจกรรม' : 'อัปโหลดภาพกิจกรรมเข้าระบบ'}
          >
            {canManage ? <Paperclip size={14} /> : <ImageIcon size={14} />}
            <span>{canManage ? 'แนบไฟล์ / ภาพกิจกรรม' : 'อัปโหลดภาพกิจกรรม'}</span>
          </button>

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
      <div id="attachments-section" className="tableCard" style={{ scrollMarginTop: '1.5rem' }}>
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
          <button
            onClick={() => setActiveTab('attachments')}
            className={`eventsTabButton ${activeTab === 'attachments' ? 'active' : ''}`}
          >
            เอกสารและภาพกิจกรรม ({attachments.length})
          </button>
        </div>

        {activeTab === 'attachments' ? (
          <div>
            {/* Attachment Action Header & Filters */}
            <div className="attachmentSectionHeader">
              <div className="attachmentFilterTabs">
                <button
                  type="button"
                  onClick={() => setAttachmentFilter('ALL')}
                  className={`attachmentFilterBtn ${attachmentFilter === 'ALL' ? 'active' : ''}`}
                >
                  ทั้งหมด ({attachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentFilter('IMAGE')}
                  className={`attachmentFilterBtn ${attachmentFilter === 'IMAGE' ? 'active' : ''}`}
                >
                  📸 ภาพกิจกรรม ({imageCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentFilter('DOCUMENT')}
                  className={`attachmentFilterBtn ${attachmentFilter === 'DOCUMENT' ? 'active' : ''}`}
                >
                  📄 เอกสาร ({docCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentFilter('NOTE')}
                  className={`attachmentFilterBtn ${attachmentFilter === 'NOTE' ? 'active' : ''}`}
                >
                  📝 บันทึกสรุป ({noteCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddAttachModal('IMAGE')}
                className="btnAttachmentAdd"
                title={canManage ? 'แนบไฟล์ เอกสาร หรือภาพกิจกรรม' : 'อัปโหลดภาพกิจกรรมเข้าร่วมแชร์'}
              >
                {canManage ? <Plus size={15} /> : <ImageIcon size={15} />}
                <span>{canManage ? 'แนบไฟล์ / เอกสาร / ภาพ' : 'อัปโหลดภาพกิจกรรม'}</span>
              </button>
            </div>

            {filteredAttachments.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <Paperclip size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                  ยังไม่มีเอกสาร รูปภาพ หรือข้อความบันทึกในหมวดนี้
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAddAttachModal('IMAGE')}
                  className="btnAttachmentAdd"
                  style={{ marginTop: '1.25rem' }}
                >
                  {canManage ? <Plus size={15} /> : <ImageIcon size={15} />}
                  <span>{canManage ? 'แนบไฟล์หรือข้อความแรก' : 'อัปโหลดภาพกิจกรรมแรก'}</span>
                </button>
              </div>
            ) : (
              <div style={{ padding: '0.5rem 0' }}>
                {/* 1. Photo Grid (IMAGE) */}
                {(attachmentFilter === 'ALL' || attachmentFilter === 'IMAGE') && imageCount > 0 && (
                  <div>
                    {attachmentFilter === 'ALL' && (
                      <div style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ImageIcon size={15} color="#094738" />
                          <span>ภาพบรรยากาศกิจกรรม ({imageCount})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAddAttachModal('IMAGE')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#094738',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Plus size={13} />
                          <span>เพิ่มรูปภาพ</span>
                        </button>
                      </div>
                    )}
                    <div className="attachmentGrid">
                      {filteredAttachments
                        .filter((a) => a.attachmentType === 'IMAGE')
                        .map((img) => (
                          <div key={img.id} className="attachmentPhotoCard">
                            <img
                              src={img.filePath}
                              alt={img.title}
                              className="attachmentPhotoImg"
                              onClick={() => setLightboxUrl({ url: img.filePath, title: img.title })}
                            />
                            <div className="attachmentPhotoActions">
                              <button
                                type="button"
                                className="attachmentActionBtn"
                                onClick={() => setLightboxUrl({ url: img.filePath, title: img.title })}
                                title="ดูภาพขยายใหญ่"
                              >
                                <Eye size={13} />
                              </button>
                              <a
                                href={img.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="attachmentActionBtn"
                                title="เปิดดูรูปภาพในแท็บใหม่"
                              >
                                <ExternalLink size={13} />
                              </a>
                              <a
                                href={img.filePath}
                                download={img.title}
                                className="attachmentActionBtn"
                                title="ดาวน์โหลดรูปภาพ"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download size={13} />
                              </a>
                              {(canManage || img.uploadedByMemberId === currentUser.id || img.uploadedBy?.id === currentUser.id) && (
                                <button
                                  type="button"
                                  disabled={deletingAttachId === img.id}
                                  onClick={() => handleDeleteAttachment(img.id, img.title)}
                                  className="attachmentActionBtn danger"
                                  title="ลบรูปภาพ"
                                >
                                  {deletingAttachId === img.id ? <Loader2 size={13} className="modalBtnSpinner" /> : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                            <div
                              className="attachmentPhotoOverlay"
                              onClick={() => setLightboxUrl({ url: img.filePath, title: img.title })}
                              title="คลิกเพื่อดูภาพขยายใหญ่"
                            >
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {img.title}
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                                {img.uploadedBy?.name || (img.uploadedByMemberId === currentUser.id ? currentUser.name : 'เจ้าหน้าที่')}
                                {(img.uploadedByMemberId === currentUser.id || img.uploadedBy?.id === currentUser.id) ? ' (คุณ)' : ''} • {formatThaiDateOnly(img.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 2. Document List (DOCUMENT) */}
                {(attachmentFilter === 'ALL' || attachmentFilter === 'DOCUMENT') && docCount > 0 && (
                  <div>
                    {attachmentFilter === 'ALL' && (
                      <div style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileText size={15} color="#0284c7" />
                        <span>เอกสารราชการและไฟล์แนบ ({docCount})</span>
                      </div>
                    )}
                    <div className="attachmentDocList">
                      {filteredAttachments
                        .filter((a) => a.attachmentType === 'DOCUMENT')
                        .map((doc) => {
                          const isPdf = doc.fileType?.includes('pdf') || doc.filePath?.endsWith('.pdf')
                          const isExcel = doc.fileType?.includes('sheet') || doc.filePath?.endsWith('.xls') || doc.filePath?.endsWith('.xlsx')
                          const isWord = doc.fileType?.includes('word') || doc.filePath?.endsWith('.doc') || doc.filePath?.endsWith('.docx')

                          return (
                            <div key={doc.id} className="attachmentDocRow">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                                <a
                                  href={doc.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="attachmentDocIconLink"
                                  title={isPdf ? 'คลิกเพื่อเปิดดูเอกสาร PDF ในแท็บใหม่' : 'คลิกเพื่อเปิดดูเอกสาร'}
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    background: isPdf ? '#fee2e2' : isExcel ? '#dcfce7' : isWord ? '#e0f2fe' : '#f1f5f9',
                                    color: isPdf ? '#dc2626' : isExcel ? '#16a34a' : isWord ? '#0284c7' : '#64748b',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <FileText size={19} />
                                </a>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div>
                                    <a
                                      href={doc.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="attachmentDocTitleLink"
                                      title={isPdf ? 'คลิกเพื่อเปิดดู PDF ในแท็บใหม่' : 'คลิกเพื่อเปิดดูเอกสารในแท็บใหม่'}
                                    >
                                      <span className="attachmentDocTitleText">{doc.title}</span>
                                      {isPdf && <span className="attachmentPdfBadge">PDF</span>}
                                    </a>
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                                    {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                                    {doc.fileSize && <span>•</span>}
                                    <span>อัปโหลดโดย {doc.uploadedBy?.name || 'เจ้าหน้าที่'}</span>
                                    <span>•</span>
                                    <span>{formatThaiDateTime(doc.createdAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                <a
                                  href={doc.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btnTableAction view"
                                  title={isPdf ? 'เปิดดูเอกสาร PDF ในแท็บใหม่' : 'เปิดดูเอกสารในแท็บใหม่'}
                                >
                                  <ExternalLink size={13} />
                                  <span>เปิดดู</span>
                                </a>
                                <a
                                  href={doc.filePath}
                                  download={doc.title}
                                  className="btnTableAction download"
                                  title="ดาวน์โหลดไฟล์ลงเครื่อง"
                                >
                                  <Download size={13} />
                                  <span>ดาวน์โหลด</span>
                                </a>
                                {(canManage || doc.uploadedByMemberId === currentUser.id || doc.uploadedBy?.id === currentUser.id) && (
                                  <button
                                    type="button"
                                    disabled={deletingAttachId === doc.id}
                                    onClick={() => handleDeleteAttachment(doc.id, doc.title)}
                                    className="btnTableAction delete"
                                    title="ลบเอกสาร"
                                  >
                                    {deletingAttachId === doc.id ? <Loader2 size={13} className="modalBtnSpinner" /> : <Trash2 size={13} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* 3. Note Board (NOTE) */}
                {(attachmentFilter === 'ALL' || attachmentFilter === 'NOTE') && noteCount > 0 && (
                  <div>
                    {attachmentFilter === 'ALL' && (
                      <div style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MessageSquare size={15} color="#d97706" />
                        <span>บันทึกและข้อความสรุป ({noteCount})</span>
                      </div>
                    )}
                    <div className="attachmentNoteList">
                      {filteredAttachments
                        .filter((a) => a.attachmentType === 'NOTE')
                        .map((note) => (
                          <div key={note.id} className="attachmentNoteCard">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <MessageSquare size={15} color="#d97706" />
                                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{note.title}</strong>
                              </div>
                              {(canManage || note.uploadedByMemberId === currentUser.id || note.uploadedBy?.id === currentUser.id) && (
                                <button
                                  type="button"
                                  disabled={deletingAttachId === note.id}
                                  onClick={() => handleDeleteAttachment(note.id, note.title)}
                                  className="btnTableAction delete"
                                  style={{ padding: '0.2rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
                                  title="ลบบันทึก"
                                >
                                  {deletingAttachId === note.id ? <Loader2 size={13} className="modalBtnSpinner" /> : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5, background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
                              {note.textContent}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                              <span>โดย {note.uploadedBy?.name || 'เจ้าหน้าที่'}</span>
                              <span>{formatThaiDateTime(note.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'attendances' ? (
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
      <EventDetailModals
        event={event}
        canManage={canManage}
        qrDataUrl={qrDataUrl}
        formatThaiDateTime={formatThaiDateTime}
        actionLoading={actionLoading}
        deletingAttendance={deletingAttendance}
        setDeletingAttendance={setDeletingAttendance}
        handleConfirmDelete={handleConfirmDelete}
        isEditEventModalOpen={isEditEventModalOpen}
        setIsEditEventModalOpen={setIsEditEventModalOpen}
        editEventError={editEventError}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        editLocation={editLocation}
        setEditLocation={setEditLocation}
        editFiscalYear={editFiscalYear}
        setEditFiscalYear={setEditFiscalYear}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editStartDate={editStartDate}
        setEditStartDate={setEditStartDate}
        editEndDate={editEndDate}
        setEditEndDate={setEditEndDate}
        editHasCustomCheckin={editHasCustomCheckin}
        setEditHasCustomCheckin={setEditHasCustomCheckin}
        editCheckinOpen={editCheckinOpen}
        setEditCheckinOpen={setEditCheckinOpen}
        editCheckinClose={editCheckinClose}
        setEditCheckinClose={setEditCheckinClose}
        editEventLoading={editEventLoading}
        handleSaveEventSubmit={handleSaveEventSubmit}
        isAddAttachModalOpen={isAddAttachModalOpen}
        setIsAddAttachModalOpen={setIsAddAttachModalOpen}
        attachError={attachError}
        attachType={attachType}
        setAttachType={setAttachType}
        attachTitle={attachTitle}
        setAttachTitle={setAttachTitle}
        attachFiles={attachFiles}
        setAttachFiles={setAttachFiles}
        attachTextContent={attachTextContent}
        setAttachTextContent={setAttachTextContent}
        attachLoading={attachLoading}
        handleSaveAttachmentSubmit={handleSaveAttachmentSubmit}
        lightboxUrl={lightboxUrl}
        setLightboxUrl={setLightboxUrl}
      />
    </div>
  )
}
