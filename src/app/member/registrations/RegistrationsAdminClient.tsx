'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Edit3,
  Eye,
  ArrowLeft,
  RefreshCw,
  UserCheck,
  UserX,
  Building2,
  Mail,
  Phone,
  Car,
  Home,
  KeyRound,
  ShieldCheck,
  FileText,
  AlertCircle,
  Save,
  X,
  Plus,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import {
  WORK_DEPARTMENTS,
  POSITIONS,
  JOB_LEVELS,
  PERSONNEL_GROUPS,
  TITLES,
  HOUSING_LOCATIONS,
  THAI_PROVINCES,
} from '@/lib/registration/registrationConstants'
import type { RegistrationRecord } from '@/lib/registration/RegistrationService'
import type { VehicleItem } from '@/lib/registration/registrationSchema'
import './page.css'

export default function RegistrationsAdminClient() {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  // Modals
  const [selectedItem, setSelectedItem] = useState<RegistrationRecord | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<RegistrationRecord>>({})

  // Confirm dialogs
  const [confirmApproveId, setConfirmApproveId] = useState<number | null>(null)
  const [confirmRejectId, setConfirmRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  useEffect(() => {
    const isAnyModalOpen = isDetailOpen || isEditOpen || confirmRejectId !== null
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isDetailOpen, isEditOpen, confirmRejectId])

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const fetchRegistrations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())

      const res = await fetch(`/api/member/registrations?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setRegistrations(data.data || [])
      } else {
        showToast('error', data.error || 'ไม่สามารถโหลดข้อมูลคำขอได้')
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegistrations()
  }, [statusFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRegistrations()
  }

  // Action: Approve
  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/member/registrations/${id}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('success', data.message || 'อนุมัติคำขอและสร้างบัญชีสมาชิกสำเร็จ')
        setConfirmApproveId(null)
        if (isDetailOpen) setIsDetailOpen(false)
        fetchRegistrations()
      } else {
        showToast('error', data.error || 'อนุมัติคำขอไม่สำเร็จ')
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาดในการอนุมัติคำขอ')
    }
  }

  // Action: Reject
  const handleReject = async (id: number) => {
    try {
      const res = await fetch(`/api/member/registrations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('success', data.message || 'ปฏิเสธคำขอเรียบร้อยแล้ว')
        setConfirmRejectId(null)
        setRejectReason('')
        if (isDetailOpen) setIsDetailOpen(false)
        fetchRegistrations()
      } else {
        showToast('error', data.error || 'ปฏิเสธคำขอไม่สำเร็จ')
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ')
    }
  }

  // Action: Delete
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/member/registrations/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('success', data.message || 'ลบคำขอเรียบร้อยแล้ว')
        setConfirmDeleteId(null)
        if (isDetailOpen) setIsDetailOpen(false)
        fetchRegistrations()
      } else {
        showToast('error', data.error || 'ลบคำขอไม่สำเร็จ')
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาดในการลบคำขอ')
    }
  }

  // Action: Open Edit Modal
  const openEditModal = (item: RegistrationRecord) => {
    setSelectedItem(item)
    const initialVehicles =
      item.hasVehicle && item.vehicles && Array.isArray(item.vehicles) && item.vehicles.length > 0
        ? JSON.parse(JSON.stringify(item.vehicles))
        : []

    setEditFormData({
      citizenId: item.citizenId,
      title: item.title,
      firstNameTh: item.firstNameTh,
      lastNameTh: item.lastNameTh,
      firstNameEn: item.firstNameEn || '',
      lastNameEn: item.lastNameEn || '',
      nickname: item.nickname || '',
      licenseNo: item.licenseNo || '',
      birthDate: item.birthDate || '',
      startDate: item.startDate || '',
      containDate: item.containDate || '',
      department: item.department,
      position: item.position,
      level: item.level,
      personnelGroup: item.personnelGroup,
      personnelGroupOther: item.personnelGroupOther || '',
      hasHosxp: Boolean(item.hasHosxp),
      hosxpUser: item.hosxpUser || '',
      hosxpPass: item.hosxpPass || '',
      email: item.email,
      phone: item.phone,
      lineId: item.lineId || '',
      inHospitalHousing: Boolean(item.inHospitalHousing),
      housingLocation: item.housingLocation || (HOUSING_LOCATIONS[0] as string),
      hasVehicle: Boolean(item.hasVehicle && initialVehicles.length > 0),
      vehicles: initialVehicles.length > 0 ? initialVehicles : [{ platePrefix: '', plateNumber: '', province: 'ลำปาง' }],
    })
    setIsEditOpen(true)
  }

  // Vehicle Management Handlers in Edit Modal
  const handleAddVehicle = () => {
    setEditFormData((prev) => {
      const currentVehicles = Array.isArray(prev.vehicles) ? [...prev.vehicles] : []
      if (currentVehicles.length >= 2) {
        showToast('info', 'สามารถลงทะเบียนรถยนต์ได้สูงสุด 2 คัน')
        return prev
      }
      return {
        ...prev,
        hasVehicle: true,
        vehicles: [...currentVehicles, { platePrefix: '', plateNumber: '', province: 'ลำปาง' }],
      }
    })
  }

  const handleUpdateVehicle = (index: number, field: keyof VehicleItem, value: string) => {
    setEditFormData((prev) => {
      const currentVehicles = Array.isArray(prev.vehicles) ? [...prev.vehicles] : []
      if (!currentVehicles[index]) {
        currentVehicles[index] = { platePrefix: '', plateNumber: '', province: 'ลำปาง' }
      }
      currentVehicles[index] = { ...currentVehicles[index], [field]: value }
      return {
        ...prev,
        vehicles: currentVehicles,
      }
    })
  }

  const handleRemoveVehicle = (index: number) => {
    setEditFormData((prev) => {
      const currentVehicles = Array.isArray(prev.vehicles) ? [...prev.vehicles] : []
      const nextVehicles = currentVehicles.filter((_, i) => i !== index)
      return {
        ...prev,
        hasVehicle: nextVehicles.length > 0,
        vehicles: nextVehicles,
      }
    })
  }

  // Action: Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    const sanitizedVehicles =
      editFormData.hasVehicle && Array.isArray(editFormData.vehicles)
        ? editFormData.vehicles
            .filter((v) => v.platePrefix?.trim() || v.plateNumber?.trim())
            .map((v) => ({
              platePrefix: v.platePrefix?.trim() || '',
              plateNumber: v.plateNumber?.trim() || '',
              province: v.province || 'ลำปาง',
            }))
        : null

    const payload = {
      ...editFormData,
      hasVehicle: Boolean(sanitizedVehicles && sanitizedVehicles.length > 0),
      vehicles: sanitizedVehicles,
      inHospitalHousing: Boolean(editFormData.inHospitalHousing),
      housingLocation: editFormData.inHospitalHousing ? editFormData.housingLocation : null,
      hasHosxp: Boolean(editFormData.hasHosxp),
      hosxpUser: editFormData.hasHosxp ? editFormData.hosxpUser?.trim() || null : null,
      hosxpPass: editFormData.hasHosxp ? editFormData.hosxpPass?.trim() || null : null,
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/member/registrations/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          showToast('success', 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว')
          setIsEditOpen(false)
          fetchRegistrations()
          if (selectedItem) {
            setSelectedItem((prev) => (prev ? ({ ...prev, ...payload } as unknown as RegistrationRecord) : null))
          }
        } else {
          showToast('error', data.error || 'บันทึกข้อมูลไม่สำเร็จ')
        }
      } catch {
        showToast('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      }
    })
  }

  // Stats calculation
  const totalCount = registrations.length
  const pendingCount = registrations.filter((r) => r.status === 'pending').length
  const approvedCount = registrations.filter((r) => r.status === 'approved').length
  const rejectedCount = registrations.filter((r) => r.status === 'rejected').length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badgeStatus badgeApproved">
            <CheckCircle2 size={13} />
            อนุมัติแล้ว
          </span>
        )
      case 'rejected':
        return (
          <span className="badgeStatus badgeRejected">
            <XCircle size={13} />
            ไม่อนุมัติ
          </span>
        )
      case 'pending':
      default:
        return (
          <span className="badgeStatus badgePending">
            <Clock size={13} />
            รอตรวจสอบ
          </span>
        )
    }
  }

  return (
    <div className="registrationsAdminPage">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <div className="adminHeaderWrapper">
        <div className="adminHeaderTop">
          <Link href="/member" className="backToDashboardBtn">
            <ArrowLeft size={16} />
            <span>กลับหน้าสมาชิก</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="refreshBtn"
              onClick={fetchRegistrations}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>รีเฟรช</span>
            </button>
          </div>
        </div>

        <div className="adminTitleRow">
          <div>
            <h1 className="adminTitle">ตรวจสอบคำขอลงทะเบียนบุคลากร</h1>
            <p className="adminSubtitle">
              ตรวจสอบ พิจารณาอนุมัติคำขอเปิดบัญชีเข้าใช้งานระบบ และดูประวัติย้อนหลัง
            </p>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="statsGrid">
          <div
            className={`statCard ${statusFilter === 'all' ? 'activeStat' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span className="statLabel">คำขอทั้งหมด</span>
            <span className="statValue text-slate-800">{totalCount}</span>
          </div>

          <div
            className={`statCard ${statusFilter === 'pending' ? 'activeStat' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <div className="flex items-center justify-between">
              <span className="statLabel">รอตรวจสอบ</span>
              <span className="statDot bg-amber-500" />
            </div>
            <span className="statValue text-amber-600">{pendingCount}</span>
          </div>

          <div
            className={`statCard ${statusFilter === 'approved' ? 'activeStat' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            <div className="flex items-center justify-between">
              <span className="statLabel">อนุมัติแล้ว</span>
              <span className="statDot bg-emerald-500" />
            </div>
            <span className="statValue text-emerald-600">{approvedCount}</span>
          </div>

          <div
            className={`statCard ${statusFilter === 'rejected' ? 'activeStat' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            <div className="flex items-center justify-between">
              <span className="statLabel">ไม่อนุมัติ</span>
              <span className="statDot bg-rose-500" />
            </div>
            <span className="statValue text-rose-600">{rejectedCount}</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="filterToolbar">
          <div className="tabFilterGroup">
            <button
              type="button"
              className={`filterTab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              ทั้งหมด ({totalCount})
            </button>
            <button
              type="button"
              className={`filterTab ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              รอตรวจสอบ ({pendingCount})
            </button>
            <button
              type="button"
              className={`filterTab ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              อนุมัติแล้ว ({approvedCount})
            </button>
            <button
              type="button"
              className={`filterTab ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              ไม่อนุมัติ ({rejectedCount})
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="searchForm">
            <div className="searchBox">
              <Search size={16} className="searchIcon" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เลขบัตร, แผนก, ตำแหน่ง…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="searchInput"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    fetchRegistrations()
                  }}
                  className="clearSearchBtn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="searchBtn">
              ค้นหา
            </button>
          </form>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="adminTableCard">
        {loading ? (
          <div className="loadingState">
            <RefreshCw size={28} className="animate-spin text-emerald-600 mb-2" />
            <p>กำลังโหลดข้อมูลคำขอสมัคร…</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="emptyState">
            <FileText size={40} className="text-slate-300 mb-2" />
            <p className="emptyTitle">ไม่พบรายการคำขอลงทะเบียน</p>
            <p className="emptySubtitle">
              {searchQuery ? 'ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง' : 'ยังไม่มีคำขอสมัครในสถานะนี้'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="tableResponsive">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>วันที่ส่ง</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>เลขบัตรประชาชน</th>
                    <th>กลุ่มงาน / ตำแหน่ง</th>
                    <th>ข้อมูลติดต่อ</th>
                    <th>สถานะ</th>
                    <th className="text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className="font-semibold text-slate-800">
                          {item.title}
                          {item.firstNameTh} {item.lastNameTh}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.firstNameEn} {item.lastNameEn} ({item.nickname})
                        </div>
                      </td>
                      <td className="tabularNums text-sm text-slate-700">{item.citizenId}</td>
                      <td>
                        <div className="text-sm font-medium text-slate-800">{item.department}</div>
                        <div className="text-xs text-slate-500">
                          {item.position} • {item.level}
                        </div>
                      </td>
                      <td>
                        <div className="text-xs text-slate-700">{item.email}</div>
                        <div className="text-xs text-slate-500">{item.phone}</div>
                      </td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td>
                        <div className="actionBtnGroup">
                          <button
                            type="button"
                            className="btnIcon actionView"
                            title="ดูรายละเอียด"
                            onClick={() => {
                              setSelectedItem(item)
                              setIsDetailOpen(true)
                            }}
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            className="btnIcon actionEdit"
                            title="แก้ไขข้อมูล"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit3 size={16} />
                          </button>

                          {item.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btnIcon actionApprove"
                                title="อนุมัติคำขอ"
                                onClick={() => setConfirmApproveId(item.id)}
                              >
                                <UserCheck size={16} />
                              </button>

                              <button
                                type="button"
                                className="btnIcon actionReject"
                                title="ปฏิเสธคำขอ"
                                onClick={() => setConfirmRejectId(item.id)}
                              >
                                <UserX size={16} />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="btnIcon actionDelete"
                            title="ลบคำขอ"
                            onClick={() => setConfirmDeleteId(item.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (Responsive for 390px screens) */}
            <div className="mobileCardList">
              {registrations.map((item) => (
                <div key={item.id} className="mobileCard">
                  <div className="mobileCardHeader">
                    <div>
                      <h3 className="mobileCardTitle">
                        {item.title}
                        {item.firstNameTh} {item.lastNameTh}
                      </h3>
                      <p className="mobileCardDate">
                        {new Date(item.createdAt).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>{getStatusBadge(item.status)}</div>
                  </div>

                  <div className="mobileCardBody">
                    <div className="mobileRow">
                      <span className="mobileLabel">เลขบัตร:</span>
                      <span className="mobileValue tabularNums">{item.citizenId}</span>
                    </div>
                    <div className="mobileRow">
                      <span className="mobileLabel">กลุ่มงาน:</span>
                      <span className="mobileValue">{item.department}</span>
                    </div>
                    <div className="mobileRow">
                      <span className="mobileLabel">ตำแหน่ง:</span>
                      <span className="mobileValue">{item.position}</span>
                    </div>
                    <div className="mobileRow">
                      <span className="mobileLabel">อีเมล:</span>
                      <span className="mobileValue">{item.email}</span>
                    </div>
                  </div>

                  <div className="mobileCardActions">
                    <button
                      type="button"
                      className="btnSecondary flex-1 text-xs py-2 h-9"
                      onClick={() => {
                        setSelectedItem(item)
                        setIsDetailOpen(true)
                      }}
                    >
                      <Eye size={14} />
                      <span>รายละเอียด</span>
                    </button>

                    <button
                      type="button"
                      className="btnSecondary text-xs py-2 px-3 h-9"
                      onClick={() => openEditModal(item)}
                    >
                      <Edit3 size={14} />
                    </button>

                    {item.status === 'pending' && (
                      <button
                        type="button"
                        className="btnPrimary text-xs py-2 px-3 h-9"
                        onClick={() => setConfirmApproveId(item.id)}
                      >
                        <UserCheck size={14} />
                        <span>อนุมัติ</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Detail View
         ══════════════════════════════════════════════════════════════ */}
      {isDetailOpen && selectedItem && (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDetailOpen(false)
          }}
        >
          <div className="modalCard modalWide" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="reqIdPill">คำขอ #{selectedItem.id}</span>
                  {getStatusBadge(selectedItem.status)}
                </div>
                <h3 className="modalTitle">
                  {selectedItem.title}
                  {selectedItem.firstNameTh} {selectedItem.lastNameTh}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ยื่นคำขอเมื่อ{' '}
                  {new Date(selectedItem.createdAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsDetailOpen(false)}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="modalBody">
              {/* Section 1: ข้อมูลส่วนตัว */}
              <div className="detailSection">
                <h4 className="detailSectionTitle">
                  <UserCheck size={16} className="text-emerald-700" />
                  <span>1. ข้อมูลส่วนบุคคล</span>
                </h4>
                <div className="detailGrid">
                  <div className="detailItem">
                    <span className="detailLabel">เลขบัตรประชาชน:</span>
                    <span className="detailVal tabularNums font-mono font-semibold text-slate-800">
                      {selectedItem.citizenId}
                    </span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ชื่อ-นามสกุล (ไทย):</span>
                    <span className="detailVal font-semibold text-slate-900">
                      {selectedItem.title}
                      {selectedItem.firstNameTh} {selectedItem.lastNameTh}
                    </span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ชื่อ-นามสกุล (อังกฤษ):</span>
                    <span className="detailVal">
                      {selectedItem.firstNameEn || selectedItem.lastNameEn
                        ? `${selectedItem.firstNameEn || ''} ${selectedItem.lastNameEn || ''}`.trim()
                        : '-'}
                    </span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ชื่อเล่น:</span>
                    <span className="detailVal">{selectedItem.nickname || '-'}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">วันเกิด (พ.ศ.):</span>
                    <span className="detailVal">{selectedItem.birthDate}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">เลขที่ใบประกอบวิชาชีพ:</span>
                    <span className="detailVal">{selectedItem.licenseNo || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: ข้อมูลตำแหน่ง */}
              <div className="detailSection">
                <h4 className="detailSectionTitle">
                  <Building2 size={16} className="text-emerald-700" />
                  <span>2. ข้อมูลตำแหน่งและกลุ่มงาน</span>
                </h4>
                <div className="detailGrid">
                  <div className="detailItem">
                    <span className="detailLabel">กลุ่มงาน / แผนก:</span>
                    <span className="detailVal font-medium text-emerald-800">{selectedItem.department}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ตำแหน่ง:</span>
                    <span className="detailVal font-medium text-slate-800">{selectedItem.position}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ระดับงาน:</span>
                    <span className="detailVal">{selectedItem.level}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">กลุ่มบุคคล:</span>
                    <span className="detailVal">
                      {selectedItem.personnelGroup}
                      {selectedItem.personnelGroupOther ? ` (${selectedItem.personnelGroupOther})` : ''}
                    </span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">วันที่เริ่มปฏิบัติงาน:</span>
                    <span className="detailVal">{selectedItem.startDate}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">วันที่บรรจุ:</span>
                    <span className="detailVal">{selectedItem.containDate || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: ติดต่อ & HOSxP */}
              <div className="detailSection">
                <h4 className="detailSectionTitle">
                  <KeyRound size={16} className="text-emerald-700" />
                  <span>3. ข้อมูลติดต่อ & บัญชีระบบ HOSxP</span>
                </h4>
                <div className="detailGrid">
                  <div className="detailItem">
                    <span className="detailLabel">อีเมล:</span>
                    <span className="detailVal font-medium text-slate-800">{selectedItem.email}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">เบอร์โทรศัพท์:</span>
                    <span className="detailVal tabularNums font-medium text-slate-800">{selectedItem.phone}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">Line ID:</span>
                    <span className="detailVal">{selectedItem.lineId || '-'}</span>
                  </div>
                  <div className="detailItem fullWidth">
                    <span className="detailLabel">สิทธิ์ระบบ HOSxP:</span>
                    <div className="mt-1">
                      {selectedItem.hasHosxp ? (
                        <div className="hosxpCredentialBox">
                          <span className="hosxpBadge">ขอเปิดใช้งาน HOSxP</span>
                          <span className="hosxpItem">
                            Username: <code>{selectedItem.hosxpUser}</code>
                          </span>
                          <span className="hosxpItem">
                            Password: <code>{selectedItem.hosxpPass}</code>
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">ไม่ใช้งานระบบ HOSxP</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: ที่พัก & ยานพาหนะ */}
              <div className="detailSection">
                <h4 className="detailSectionTitle">
                  <Home size={16} className="text-emerald-700" />
                  <span>4. สวัสดิการที่พักอาศัย & ยานพาหนะ</span>
                </h4>
                <div className="detailGrid">
                  <div className="detailItem fullWidth">
                    <span className="detailLabel">สถานที่พักอาศัย:</span>
                    <div className="mt-0.5">
                      {selectedItem.inHospitalHousing ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-medium">
                          <Home size={14} />
                          {selectedItem.housingLocation || 'พักในโรงพยาบาล'}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">พักอาศัยภายนอกโรงพยาบาล</span>
                      )}
                    </div>
                  </div>

                  <div className="detailItem fullWidth">
                    <span className="detailLabel">ข้อมูลรถยนต์เข้าโซนบ้านพัก:</span>
                    <div className="mt-2">
                      {selectedItem.hasVehicle && selectedItem.vehicles && Array.isArray(selectedItem.vehicles) && selectedItem.vehicles.length > 0 ? (
                        <div className="licensePlateList">
                          {selectedItem.vehicles.map((v: VehicleItem, idx: number) => (
                            <div key={idx} className="thaiLicensePlate">
                              <div className="plateMain">
                                <span className="platePrefix">{v.platePrefix}</span>
                                <span className="plateNumber">{v.plateNumber}</span>
                              </div>
                              <div className="plateProvince">{v.province}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm italic">ไม่มีรถยนต์ลงทะเบียน</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: สถานะ & การอนุมัติ */}
              <div className="detailSection">
                <h4 className="detailSectionTitle">
                  <ShieldCheck size={16} className="text-emerald-700" />
                  <span>5. สถานะคำขอและประวัติ</span>
                </h4>
                <div className="detailGrid">
                  <div className="detailItem">
                    <span className="detailLabel">สถานะปัจจุบัน:</span>
                    <div className="mt-1">{getStatusBadge(selectedItem.status)}</div>
                  </div>
                  {selectedItem.status === 'approved' && (
                    <>
                      <div className="detailItem">
                        <span className="detailLabel">ผู้อนุมัติ:</span>
                        <span className="detailVal font-medium">{selectedItem.approvedBy || '-'}</span>
                      </div>
                      <div className="detailItem">
                        <span className="detailLabel">วันที่อนุมัติ:</span>
                        <span className="detailVal">
                          {selectedItem.approvedAt
                            ? new Date(selectedItem.approvedAt).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </span>
                      </div>
                    </>
                  )}
                  {selectedItem.status === 'rejected' && (
                    <div className="detailItem fullWidth">
                      <span className="detailLabel">เหตุผลที่ปฏิเสธ:</span>
                      <div className="mt-1 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm">
                        {selectedItem.rejectReason || 'ไม่ระบุเหตุผล'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modalFooter flex justify-between items-center">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => {
                  setIsDetailOpen(false)
                  openEditModal(selectedItem)
                }}
              >
                <Edit3 size={15} />
                <span>แก้ไขข้อมูล</span>
              </button>

              <div className="flex gap-2">
                {selectedItem.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btnReject"
                      onClick={() => {
                        setIsDetailOpen(false)
                        setConfirmRejectId(selectedItem.id)
                      }}
                    >
                      <UserX size={15} />
                      <span>ปฏิเสธคำขอ</span>
                    </button>

                    <button
                      type="button"
                      className="btnPrimary"
                      onClick={() => {
                        setIsDetailOpen(false)
                        setConfirmApproveId(selectedItem.id)
                      }}
                    >
                      <UserCheck size={15} />
                      <span>อนุมัติและสร้างบัญชี</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Edit Registration Data
         ══════════════════════════════════════════════════════════════ */}
      {isEditOpen && selectedItem && (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditOpen(false)
          }}
        >
          <div className="modalCard modalWide" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveEdit}>
              <div className="modalHeader">
                <div className="flex items-center gap-2">
                  <Edit3 size={20} className="text-emerald-700" />
                  <div>
                    <h3 className="modalTitle">แก้ไขข้อมูลคำขอ #{selectedItem.id}</h3>
                    <p className="text-xs text-slate-500">ปรับปรุงข้อมูลบุคลากรและยานพาหนะ</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modalCloseBtn"
                  onClick={() => setIsEditOpen(false)}
                  aria-label="ปิด"
                >
                  ✕
                </button>
              </div>

              <div className="modalBody">
                {/* 1. ข้อมูลส่วนบุคคล */}
                <div className="editGroupCard">
                  <h4 className="editGroupTitle">
                    <UserCheck size={16} className="text-emerald-700" />
                    <span>1. ข้อมูลส่วนบุคคล</span>
                  </h4>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">เลขบัตรประชาชน (13 หลัก) *</label>
                      <input
                        type="text"
                        className="textInput font-mono"
                        value={editFormData.citizenId || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, citizenId: e.target.value.replace(/\D/g, '') }))
                        }
                        maxLength={13}
                        required
                      />
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">คำนำหน้า *</label>
                      <select
                        className="selectInput"
                        value={editFormData.title || 'นาย'}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, title: e.target.value }))
                        }
                      >
                        {TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">ชื่อ (ภาษาไทย) *</label>
                      <input
                        type="text"
                        className="textInput"
                        value={editFormData.firstNameTh || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, firstNameTh: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">นามสกุล (ภาษาไทย) *</label>
                      <input
                        type="text"
                        className="textInput"
                        value={editFormData.lastNameTh || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, lastNameTh: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">First Name (English)</label>
                      <input
                        type="text"
                        className="textInput"
                        value={editFormData.firstNameEn || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, firstNameEn: e.target.value }))
                        }
                      />
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">Last Name (English)</label>
                      <input
                        type="text"
                        className="textInput"
                        value={editFormData.lastNameEn || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, lastNameEn: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">ชื่อเล่น</label>
                      <input
                        type="text"
                        className="textInput"
                        value={editFormData.nickname || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, nickname: e.target.value }))
                        }
                      />
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">เลขที่ใบประกอบวิชาชีพ</label>
                      <input
                        type="text"
                        className="textInput"
                        value={editFormData.licenseNo || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, licenseNo: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="fieldGroup">
                    <label className="inputLabel">วันเดือนปีเกิด (พ.ศ.) *</label>
                    <input
                      type="text"
                      className="textInput"
                      placeholder="เช่น 15/05/2538"
                      value={editFormData.birthDate || ''}
                      onChange={(e) =>
                        setEditFormData((prev) => ({ ...prev, birthDate: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                {/* 2. ตำแหน่งและกลุ่มงาน */}
                <div className="editGroupCard">
                  <h4 className="editGroupTitle">
                    <Building2 size={16} className="text-emerald-700" />
                    <span>2. ตำแหน่งและกลุ่มงาน</span>
                  </h4>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">กลุ่มงาน / แผนก *</label>
                      <select
                        className="selectInput"
                        value={editFormData.department || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, department: e.target.value }))
                        }
                      >
                        {WORK_DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">ตำแหน่ง *</label>
                      <select
                        className="selectInput"
                        value={editFormData.position || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, position: e.target.value }))
                        }
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">ระดับงาน *</label>
                      <select
                        className="selectInput"
                        value={editFormData.level || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, level: e.target.value }))
                        }
                      >
                        {JOB_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">กลุ่มบุคคล *</label>
                      <select
                        className="selectInput"
                        value={editFormData.personnelGroup || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, personnelGroup: e.target.value }))
                        }
                      >
                        {PERSONNEL_GROUPS.map((grp) => (
                          <option key={grp} value={grp}>
                            {grp}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">วันที่เริ่มปฏิบัติงาน (พ.ศ.) *</label>
                      <input
                        type="text"
                        className="textInput"
                        placeholder="เช่น 01/10/2566"
                        value={editFormData.startDate || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, startDate: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">วันที่บรรจุ (พ.ศ.)</label>
                      <input
                        type="text"
                        className="textInput"
                        placeholder="เช่น 01/10/2567"
                        value={editFormData.containDate || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, containDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 3. ข้อมูลติดต่อ & HOSxP */}
                <div className="editGroupCard">
                  <h4 className="editGroupTitle">
                    <KeyRound size={16} className="text-emerald-700" />
                    <span>3. ข้อมูลติดต่อ & HOSxP</span>
                  </h4>

                  <div className="grid2Col">
                    <div className="fieldGroup">
                      <label className="inputLabel">อีเมล *</label>
                      <input
                        type="email"
                        className="textInput"
                        value={editFormData.email || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="fieldGroup">
                      <label className="inputLabel">เบอร์โทรศัพท์ *</label>
                      <input
                        type="tel"
                        className="textInput"
                        value={editFormData.phone || ''}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="fieldGroup">
                    <label className="inputLabel">Line ID</label>
                    <input
                      type="text"
                      className="textInput"
                      value={editFormData.lineId || ''}
                      onChange={(e) =>
                        setEditFormData((prev) => ({ ...prev, lineId: e.target.value }))
                      }
                    />
                  </div>

                  {/* HOSxP toggle */}
                  <div className="subEditToggleBox">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600 rounded"
                        checked={Boolean(editFormData.hasHosxp)}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, hasHosxp: e.target.checked }))
                        }
                      />
                      <span className="text-sm font-semibold text-slate-800">ขอใช้งานระบบสารสนเทศ HOSxP</span>
                    </label>

                    {editFormData.hasHosxp && (
                      <div className="grid2Col mt-3 pt-3 border-t border-slate-200">
                        <div className="fieldGroup">
                          <label className="inputLabel">HOSxP Username</label>
                          <input
                            type="text"
                            className="textInput"
                            value={editFormData.hosxpUser || ''}
                            onChange={(e) =>
                              setEditFormData((prev) => ({ ...prev, hosxpUser: e.target.value }))
                            }
                          />
                        </div>

                        <div className="fieldGroup">
                          <label className="inputLabel">HOSxP Password</label>
                          <input
                            type="text"
                            className="textInput"
                            value={editFormData.hosxpPass || ''}
                            onChange={(e) =>
                              setEditFormData((prev) => ({ ...prev, hosxpPass: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. สวัสดิการที่พัก & ยานพาหนะ */}
                <div className="editGroupCard">
                  <h4 className="editGroupTitle">
                    <Home size={16} className="text-emerald-700" />
                    <span>4. สวัสดิการที่พักอาศัย & ยานพาหนะ</span>
                  </h4>

                  {/* Housing */}
                  <div className="subEditToggleBox mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600 rounded"
                        checked={Boolean(editFormData.inHospitalHousing)}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, inHospitalHousing: e.target.checked }))
                        }
                      />
                      <span className="text-sm font-semibold text-slate-800">พักอาศัยอยู่ในโรงพยาบาล</span>
                    </label>

                    {editFormData.inHospitalHousing && (
                      <div className="fieldGroup mt-3 pt-3 border-t border-slate-200">
                        <label className="inputLabel">สถานที่พักอาศัย</label>
                        <select
                          className="selectInput"
                          value={editFormData.housingLocation || HOUSING_LOCATIONS[0]}
                          onChange={(e) =>
                            setEditFormData((prev) => ({ ...prev, housingLocation: e.target.value }))
                          }
                        >
                          {HOUSING_LOCATIONS.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Vehicle Management */}
                  <div className="subEditToggleBox">
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-emerald-600 rounded"
                          checked={Boolean(editFormData.hasVehicle)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setEditFormData((prev) => ({
                              ...prev,
                              hasVehicle: checked,
                              vehicles: checked && (!prev.vehicles || prev.vehicles.length === 0)
                                ? [{ platePrefix: '', plateNumber: '', province: 'ลำปาง' }]
                                : prev.vehicles,
                            }))
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-800">มีรถยนต์เข้าโซนบ้านพัก</span>
                      </label>

                      {editFormData.hasVehicle && (!editFormData.vehicles || editFormData.vehicles.length < 2) && (
                        <button
                          type="button"
                          className="btnAddVehicle"
                          onClick={handleAddVehicle}
                        >
                          <Plus size={14} />
                          <span>เพิ่มรถยนต์ ({editFormData.vehicles?.length || 0}/2)</span>
                        </button>
                      )}
                    </div>

                    {editFormData.hasVehicle && (
                      <div className="vehicleEditList mt-3 pt-3 border-t border-slate-200">
                        {(!editFormData.vehicles || editFormData.vehicles.length === 0) ? (
                          <div className="text-center py-3 text-sm text-slate-500">
                            ยังไม่มีรายการรถยนต์ กด &quot;เพิ่มรถยนต์&quot; ด้านบนเพื่อเพิ่มข้อมูล
                          </div>
                        ) : (
                          editFormData.vehicles.map((v, vIdx) => (
                            <div key={vIdx} className="vehicleEditCard">
                              <div className="vehicleEditHeader">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                  <Car size={14} className="text-emerald-700" />
                                  <span>รถยนต์คันที่ {vIdx + 1}</span>
                                </div>
                                <button
                                  type="button"
                                  className="btnRemoveVehicle"
                                  onClick={() => handleRemoveVehicle(vIdx)}
                                  title="ลบรถคันนี้"
                                >
                                  <Trash2 size={13} />
                                  <span>ลบ</span>
                                </button>
                              </div>

                              <div className="grid3Col">
                                <div className="fieldGroup mb-0">
                                  <label className="inputLabel text-xs">หมวดอักษร</label>
                                  <input
                                    type="text"
                                    className="textInput text-xs h-9"
                                    placeholder="เช่น กข"
                                    maxLength={4}
                                    value={v.platePrefix || ''}
                                    onChange={(e) => handleUpdateVehicle(vIdx, 'platePrefix', e.target.value)}
                                  />
                                </div>

                                <div className="fieldGroup mb-0">
                                  <label className="inputLabel text-xs">เลขทะเบียน</label>
                                  <input
                                    type="text"
                                    className="textInput text-xs h-9 tabularNums"
                                    placeholder="เช่น 1234"
                                    maxLength={6}
                                    value={v.plateNumber || ''}
                                    onChange={(e) => handleUpdateVehicle(vIdx, 'plateNumber', e.target.value)}
                                  />
                                </div>

                                <div className="fieldGroup mb-0">
                                  <label className="inputLabel text-xs">จังหวัด</label>
                                  <select
                                    className="selectInput text-xs h-9"
                                    value={v.province || 'ลำปาง'}
                                    onChange={(e) => handleUpdateVehicle(vIdx, 'province', e.target.value)}
                                  >
                                    {THAI_PROVINCES.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modalFooter flex justify-end gap-2">
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={() => setIsEditOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btnPrimary"
                  disabled={isPending}
                >
                  <Save size={16} />
                  <span>{isPending ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CONFIRM DIALOGS
         ══════════════════════════════════════════════════════════════ */}
      {/* Approve Confirm */}
      <ConfirmDialog
        isOpen={confirmApproveId !== null}
        title="ยืนยันการอนุมัติคำขอลงทะเบียน"
        description="เมื่ออนุมัติแล้ว ระบบจะสร้างบัญชีสมาชิก (Member) ในระบบให้โดยอัตโนมัติ และผู้ใช้จะสามารถเข้าสู่ระบบผ่านเลขบัตรประชาชนได้ทันที"
        confirmText="อนุมัติและสร้างบัญชี"
        cancelText="ยกเลิก"
        type="info"
        onConfirm={() => {
          if (confirmApproveId) handleApprove(confirmApproveId)
        }}
        onCancel={() => setConfirmApproveId(null)}
      />

      {/* Reject Modal with Reason */}
      {confirmRejectId !== null && (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmRejectId(null)
          }}
        >
          <div className="modalCard max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-rose-600" />
                <h3 className="modalTitle">ปฏิเสธคำขอลงทะเบียน</h3>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setConfirmRejectId(null)}
              >
                ✕
              </button>
            </div>
            <div className="modalBody">
              <p className="text-sm text-slate-600 mb-3">
                กรุณาระบุเหตุผลในการปฏิเสธคำขอนี้ เพื่อบันทึกเป็นประวัติในระบบ
              </p>
              <textarea
                className="textInput h-24 py-2"
                placeholder="ระบุเหตุผล เช่น ข้อมูลไม่ถูกต้อง, ไม่พบบันทึกการจ้างงาน"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="modalFooter flex justify-end gap-2">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setConfirmRejectId(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btnReject"
                onClick={() => {
                  if (confirmRejectId) handleReject(confirmRejectId)
                }}
              >
                ยืนยันการปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="ยืนยันการลบคำขอลงทะเบียน"
        description="คุณแน่ใจหรือไม่ว่าต้องการลบคำขอลงทะเบียนนี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
        confirmText="ลบคำขอ"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
