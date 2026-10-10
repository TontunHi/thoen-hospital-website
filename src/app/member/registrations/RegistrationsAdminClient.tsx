'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import { HOUSING_LOCATIONS } from '@/lib/registration/registrationConstants'
import type { RegistrationRecord } from '@/lib/registration/RegistrationService'
import type { VehicleItem } from '@/lib/registration/registrationSchema'
import { RegistrationFilterBar } from './components/RegistrationFilterBar'
import { RegistrationTable } from './components/RegistrationTable'
import { RegistrationDetailModal } from './components/RegistrationDetailModal'
import { RegistrationEditModal } from './components/RegistrationEditModal'
import { RegistrationRejectModal } from './components/RegistrationRejectModal'
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

  const handleApprove = async (id: number) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/member/registrations/${id}/approve`, {
          method: 'POST',
        })
        const data = await res.json()
        if (res.ok && data.success) {
          showToast('success', 'อนุมัติคำขอและสร้างบัญชีบุคลากรเรียบร้อยแล้ว')
          setConfirmApproveId(null)
          fetchRegistrations()
        } else {
          showToast('error', data.error || 'เกิดข้อผิดพลาดในการอนุมัติ')
        }
      } catch {
        showToast('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      }
    })
  }

  const handleReject = async (id: number) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/member/registrations/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          showToast('info', 'ปฏิเสธคำขอลงทะเบียนเรียบร้อยแล้ว')
          setConfirmRejectId(null)
          setRejectReason('')
          fetchRegistrations()
        } else {
          showToast('error', data.error || 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ')
        }
      } catch {
        showToast('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      }
    })
  }

  const handleDelete = async (id: number) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/member/registrations/${id}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (res.ok && data.success) {
          showToast('success', 'ลบคำขอลงทะเบียนเรียบร้อยแล้ว')
          setConfirmDeleteId(null)
          fetchRegistrations()
        } else {
          showToast('error', data.error || 'เกิดข้อผิดพลาดในการลบคำขอ')
        }
      } catch {
        showToast('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      }
    })
  }

  const openEditModal = (item: RegistrationRecord) => {
    setSelectedItem(item)
    const initialVehicles = Array.isArray(item.vehicles) ? (item.vehicles as VehicleItem[]) : []
    setEditFormData({
      citizenId: item.citizenId,
      title: item.title,
      firstNameTh: item.firstNameTh,
      lastNameTh: item.lastNameTh,
      firstNameEn: item.firstNameEn || '',
      lastNameEn: item.lastNameEn || '',
      nickname: item.nickname || '',
      licenseNo: item.licenseNo || '',
      birthDate: item.birthDate,
      startDate: item.startDate,
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

        <RegistrationFilterBar
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          onRefresh={fetchRegistrations}
          loading={loading}
          totalCount={totalCount}
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          rejectedCount={rejectedCount}
        />
      </div>

      <div className="adminTableCard">
        <RegistrationTable
          registrations={registrations}
          loading={loading}
          searchQuery={searchQuery}
          onView={(item) => {
            setSelectedItem(item)
            setIsDetailOpen(true)
          }}
          onEdit={openEditModal}
          onApprove={(id) => setConfirmApproveId(id)}
          onReject={(id) => setConfirmRejectId(id)}
          onDelete={(id) => setConfirmDeleteId(id)}
          getStatusBadge={getStatusBadge}
        />
      </div>

      <RegistrationDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onOpenEdit={openEditModal}
        onApprove={(id) => setConfirmApproveId(id)}
        onReject={(id) => setConfirmRejectId(id)}
        getStatusBadge={getStatusBadge}
      />

      <RegistrationEditModal
        isOpen={isEditOpen}
        selectedItem={selectedItem}
        formData={editFormData}
        setFormData={setEditFormData}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleSaveEdit}
        isPending={isPending}
        onAddVehicle={handleAddVehicle}
        onUpdateVehicle={handleUpdateVehicle}
        onRemoveVehicle={handleRemoveVehicle}
      />

      <RegistrationRejectModal
        isOpen={confirmRejectId !== null}
        requestId={confirmRejectId}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        onClose={() => setConfirmRejectId(null)}
        onConfirm={() => {
          if (confirmRejectId) handleReject(confirmRejectId)
        }}
      />

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
