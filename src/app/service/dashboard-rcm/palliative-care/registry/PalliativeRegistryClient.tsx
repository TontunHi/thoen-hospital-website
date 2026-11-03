'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Download,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
} from 'lucide-react'
import { PalliativeRegistryItem, RegistryStats } from '@/lib/clinical/palliativeRegistryService'
import './page.css'

interface PalliativeRegistryClientProps {
  userRole?: string
  username?: string
}

const PROJECT_CODE_PRESETS = [
  '(30001, cONS01ลงทุกเคส )',
  'Eva001 เฉพาะกรณีปรับยา',
  'PALDS เฉพาะกรณีเคสที่มีแผล',
  'O2 เฉพาะกรณี Home Oxigen',
]

interface EditableTextCellProps {
  value: string | null | undefined
  placeholder?: string
  canEdit: boolean
  isEditing: boolean
  onStartEdit: () => void
  onSave: (val: string) => void
  onCancel: () => void
  className?: string
  style?: React.CSSProperties
}

function EditableTextCell({
  value,
  placeholder = '-',
  canEdit,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  className = '',
  style = {},
}: EditableTextCellProps) {
  const [temp, setTemp] = useState(value || '')

  useEffect(() => {
    setTemp(value || '')
  }, [value, isEditing])

  if (!canEdit) {
    return <span style={style}>{value || placeholder}</span>
  }

  if (isEditing) {
    return (
      <input
        type="text"
        className="pcr-sheet-input"
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={() => {
          if (temp.trim() !== (value || '').trim()) {
            onSave(temp.trim())
          } else {
            onCancel()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSave(temp.trim())
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        autoFocus
      />
    )
  }

  return (
    <div
      className={`pcr-sheet-cell ${className}`}
      style={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
      onClick={onStartEdit}
      title="คลิกเพื่อแก้ไข (Google Sheets Mode)"
    >
      <span>{value || placeholder}</span>
    </div>
  )
}

interface EditableVisitCellProps {
  item: PalliativeRegistryItem
  visitNum: number
  canEdit: boolean
  onSaveDate: (val: string) => void
}

function EditableVisitCell({
  item,
  visitNum,
  canEdit,
  onSaveDate,
}: EditableVisitCellProps) {
  const date = (item as any)[`visit${visitNum}Date`] || ''
  const rep = (item as any)[`visit${visitNum}Rep`] || ''
  const compensated = (item as any)[`visit${visitNum}Compensated`]
  const rawRemark = (item as any)[`visit${visitNum}Remark`] || (item as any)[`visit${visitNum}Status`] || ''
  const isPresetStatus =
    rawRemark === 'ยังไม่ได้เยี่ยม' ||
    rawRemark === 'เยี่ยมแล้วยังไม่ได้ลงข้อมูล' ||
    rawRemark === 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ'
  const remark = isPresetStatus ? '' : rawRemark

  const hasComp = compensated !== undefined && compensated !== null && Number(compensated) > 0
  const hasRep = Boolean(rep || hasComp)

  return (
    <div className="pcr-visit-card">
      {canEdit ? (
        <input
          type="text"
          className="pcr-sheet-date-input"
          placeholder="วว/ดด/ปปปป"
          defaultValue={date}
          key={`${item.id}-v${visitNum}-${date}`}
          onBlur={(e) => {
            if (e.target.value.trim() !== date.trim()) {
              onSaveDate(e.target.value.trim())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          title={`วันที่เยี่ยมครั้งที่ ${visitNum} (Enter เพื่อบันทึก)`}
        />
      ) : (
        date && <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{date}</div>
      )}

      {date ? (
        hasRep ? (
          <div className="pcr-rep-badge pcr-rep-paid" title={`เลข Rep: ${rep || '-'}`}>
            <span>Rep: {rep || '-'}</span>
            <span className="pcr-rep-amount">{Number(compensated || 0).toLocaleString()} ฿</span>
          </div>
        ) : (
          <span className="pcr-rep-badge pcr-rep-pending" title="ยังไม่พบข้อมูลในระบบชดเชย RCM">
            รอผลชดเชย
          </span>
        )
      ) : (
        !canEdit && <span style={{ color: 'var(--pc-muted)', fontSize: '0.75rem' }}>-</span>
      )}

      {remark ? (
        <span className="pcr-remark-badge" title={`หมายเหตุ: ${remark}`}>
          {remark}
        </span>
      ) : null}
    </div>
  )
}

interface EditableDeathCellProps {
  item: PalliativeRegistryItem
  canEdit: boolean
  onSaveDate: (val: string) => void
  isSavedDate?: boolean
}

function EditableDeathCell({
  item,
  canEdit,
  onSaveDate,
  isSavedDate,
}: EditableDeathCellProps) {
  const date = (item.deathDate || '').trim()
  const isDeceased = Boolean(date)

  return (
    <td
      style={{ fontSize: '0.8rem', minWidth: 95 }}
      className={`${isSavedDate ? 'just-saved' : ''} ${isDeceased ? 'pcr-cell-death' : ''}`}
      title={isDeceased ? `ผู้ป่วยเสียชีวิต: ${date}` : undefined}
    >
      {canEdit ? (
        <input
          type="text"
          className={`pcr-sheet-date-input ${isDeceased ? 'pcr-death-input' : ''}`}
          placeholder="วว/ดด/ปปปป"
          defaultValue={date}
          key={`${item.id}-death-${date}`}
          onBlur={(e) => {
            if (e.target.value.trim() !== date.trim()) {
              onSaveDate(e.target.value.trim())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          title="วันที่เสียชีวิต (Enter เพื่อบันทึก)"
        />
      ) : date ? (
        <span className="pcr-death-chip">{date}</span>
      ) : (
        '-'
      )}
    </td>
  )
}

export default function PalliativeRegistryClient({
  userRole = 'staff',
  username = '',
}: PalliativeRegistryClientProps) {
  // Data state
  const [items, setItems] = useState<PalliativeRegistryItem[]>([])
  const [stats, setStats] = useState<RegistryStats>({
    total: 0,
    registered: 0,
    pendingRegistration: 0,
    claimed: 0,
    paid: 0,
    deny: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState({
    canView: true,
    canEdit: userRole === 'admin',
    canManage: userRole === 'admin',
  })

  // Filter & Search states
  const [search, setSearch] = useState('')
  const [filterRegStatus, setFilterRegStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Modal 1: Add New Patient (Initial Intake Fields)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    hn: '',
    patientName: '',
    address: '',
    phone: '',
    icd10Principal: '',
    icd10Palliative: 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
    projectCode: '(30001, cONS01ลงทุกเคส )',
    registrationStatus: 'ยังไม่ได้ดำเนินการ',
    deathDate: '',
  })
  const [isLookingUpHn, setIsLookingUpHn] = useState(false)
  const [lookupFeedback, setLookupFeedback] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Modal 2: Edit / Follow-up Visits Modal
  const [editingItem, setEditingItem] = useState<PalliativeRegistryItem | null>(null)
  const [editForm, setEditForm] = useState<Partial<PalliativeRegistryItem>>({})
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<PalliativeRegistryItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Google Sheets Inline Edit States
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved')
  const [justSavedCell, setJustSavedCell] = useState<{ id: number; field: string } | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null)

  // Auto lookup HN from HOSxP
  const handleLookupHn = async (hnToSearch?: string) => {
    const targetHn = (hnToSearch || addForm.hn).trim()
    if (!targetHn) return

    setIsLookingUpHn(true)
    setLookupFeedback(null)

    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/palliative-care/registry/lookup-hn?hn=${encodeURIComponent(targetHn)}`
      )
      const json = await res.json()
      if (!res.ok || !json.success || !json.data) {
        setLookupFeedback({
          type: 'warning',
          message: 'ไม่พบข้อมูล HN นี้ในระบบ HOSxP (สามารถกรอกข้อมูลเองได้)',
        })
        return
      }

      const data = json.data
      setAddForm((prev) => ({
        ...prev,
        hn: data.hn,
        patientName: data.patientName || prev.patientName,
        address: data.address || prev.address,
        phone: data.phone || prev.phone,
        registrationStatus: data.isRegistered ? 'ดำเนินการเรียบร้อย' : 'ยังไม่ได้ดำเนินการ',
        deathDate: data.deathDate || prev.deathDate,
      }))

      if (data.isRegistered) {
        setLookupFeedback({
          type: 'success',
          message: `✓ พบใน HOSxP คลินิก 2423 (ขึ้นทะเบียนเมื่อ: ${data.registeredDate || '-'})`,
        })
      } else {
        setLookupFeedback({
          type: 'warning',
          message: `ℹ พบข้อมูลผู้ป่วยใน HOSxP แต่ยังไม่ได้ขึ้นทะเบียนคลินิก 2423 (สถานะ: ยังไม่ได้ดำเนินการ / รอ)`,
        })
      }
    } catch (err: any) {
      setLookupFeedback({
        type: 'error',
        message: 'เชื่อมต่อ HOSxP ไม่สำเร็จ กรุณากรอกข้อมูลเอง',
      })
    } finally {
      setIsLookingUpHn(false)
    }
  }

  // Handle Google Sheets Inline Cell Save (Instant Auto-save)
  const handleCellSave = async (id: number, field: string, value: any) => {
    // 1. Optimistic UI update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
    setEditingCell(null)
    setSaveStatus('saving')
    setJustSavedCell({ id, field })

    try {
      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      setSaveStatus('saved')

      // Quietly update stats in background without table re-render
      fetch('/api/service/dashboard-rcm/palliative-care/registry?limit=1')
        .then((r) => r.json())
        .then((d) => {
          if (d?.stats) setStats(d.stats)
        })
        .catch(() => {})
    } catch (err: any) {
      setSaveStatus('error')
      alert(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      fetchData() // Revert to server truth
    } finally {
      setTimeout(() => {
        setJustSavedCell((current) =>
          current?.id === id && current?.field === field ? null : current
        )
      }, 1500)
    }
  }

  // Fetch list
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      if (filterRegStatus !== 'ALL') q.set('registrationStatus', filterRegStatus)
      q.set('page', page.toString())
      q.set('limit', '50')

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry?${q.toString()}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลทะเบียนได้')
      }

      setItems(data.items || [])
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.total || 0)
      if (data.stats) setStats(data.stats)
      if (data.permissions) setPermissions(data.permissions)
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [search, filterRegStatus, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle Add Form Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.hn.trim()) {
      setAddError('กรุณาระบุ HN ผู้ป่วย')
      return
    }

    setIsSubmittingAdd(true)
    setAddError(null)

    try {
      const res = await fetch('/api/service/dashboard-rcm/palliative-care/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      setIsAddModalOpen(false)
      setAddForm({
        hn: '',
        patientName: '',
        address: '',
        phone: '',
        icd10Principal: '',
        icd10Palliative: 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
        projectCode: '(30001, cONS01ลงทุกเคส )',
        registrationStatus: 'ยังไม่ได้ดำเนินการ',
        deathDate: '',
      })
      setLookupFeedback(null)
      fetchData()
    } catch (err: any) {
      setAddError(err?.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (item: PalliativeRegistryItem) => {
    setEditingItem(item)
    setEditForm({ ...item })
    setEditError(null)
  }

  // Handle Edit Form Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    setIsSubmittingEdit(true)
    setEditError(null)

    try {
      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'อัปเดตข้อมูลไม่สำเร็จ')
      }

      setEditingItem(null)
      fetchData()
    } catch (err: any) {
      setEditError(err?.message || 'เกิดข้อผิดพลาดในการอัปเดต')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry/${deletingItem.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ลบข้อมูลไม่สำเร็จ')
      }
      setDeletingItem(null)
      fetchData()
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setIsDeleting(false)
    }
  }

  // Export CSV/Excel
  const handleExportCSV = () => {
    if (items.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก')
      return
    }

    const headers = [
      'ลำดับ',
      'HN',
      'ชื่อ-สกุลผู้ป่วย',
      'ที่อยู่',
      'เบอร์โทรผู้ป่วย/ญาติ',
      'ICD10 รหัสโรคหลัก',
      'ICD 10 รหัส Palliative',
      'Project code Palliative',
      'สถานะการขึ้นทะเบียน 2423',
      'วันที่ขึ้นทะเบียน 2423',
      'วันเยี่ยมครั้งที่ 1',
      'Rep เยี่ยม 1',
      'ชดเชย เยี่ยม 1 (บาท)',
      'หมายเหตุ เยี่ยม 1',
      'วันเยี่ยมครั้งที่ 2',
      'Rep เยี่ยม 2',
      'ชดเชย เยี่ยม 2 (บาท)',
      'หมายเหตุ เยี่ยม 2',
      'วันเยี่ยมครั้งที่ 3',
      'Rep เยี่ยม 3',
      'ชดเชย เยี่ยม 3 (บาท)',
      'หมายเหตุ เยี่ยม 3',
      'วันเยี่ยมครั้งที่ 4',
      'Rep เยี่ยม 4',
      'ชดเชย เยี่ยม 4 (บาท)',
      'หมายเหตุ เยี่ยม 4',
      'วันเยี่ยมครั้งที่ 5',
      'Rep เยี่ยม 5',
      'ชดเชย เยี่ยม 5 (บาท)',
      'หมายเหตุ เยี่ยม 5',
      'วันเยี่ยมครั้งที่ 6',
      'Rep เยี่ยม 6',
      'ชดเชย เยี่ยม 6 (บาท)',
      'หมายเหตุ เยี่ยม 6',
      'วันที่เสียชีวิต',
    ]

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = items.map((item, idx) => [
      idx + 1,
      `="${item.hn}"`,
      escapeCsv(item.patientName),
      escapeCsv(item.address),
      escapeCsv(item.phone),
      escapeCsv(item.icd10Principal),
      escapeCsv(item.icd10Palliative),
      escapeCsv(item.projectCode),
      escapeCsv(item.registeredDate ? 'ขึ้นทะเบียนแล้ว' : item.registrationStatus),
      escapeCsv(item.registeredDate || ''),
      escapeCsv(item.visit1Date || ''),
      escapeCsv(item.visit1Rep || ''),
      item.visit1Compensated ?? 0,
      escapeCsv(item.visit1Remark || item.visit1Status || ''),
      escapeCsv(item.visit2Date || ''),
      escapeCsv(item.visit2Rep || ''),
      item.visit2Compensated ?? 0,
      escapeCsv(item.visit2Remark || item.visit2Status || ''),
      escapeCsv(item.visit3Date || ''),
      escapeCsv(item.visit3Rep || ''),
      item.visit3Compensated ?? 0,
      escapeCsv(item.visit3Remark || item.visit3Status || ''),
      escapeCsv(item.visit4Date || ''),
      escapeCsv(item.visit4Rep || ''),
      item.visit4Compensated ?? 0,
      escapeCsv(item.visit4Remark || item.visit4Status || ''),
      escapeCsv(item.visit5Date || ''),
      escapeCsv(item.visit5Rep || ''),
      item.visit5Compensated ?? 0,
      escapeCsv(item.visit5Remark || item.visit5Status || ''),
      escapeCsv(item.visit6Date || ''),
      escapeCsv(item.visit6Rep || ''),
      item.visit6Compensated ?? 0,
      escapeCsv(item.visit6Remark || item.visit6Status || ''),
      escapeCsv(item.deathDate || ''),
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Palliative_Care_Registry_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const canEdit = permissions.canEdit || permissions.canManage

  return (
    <div className="pcr-container">
      {/* 0. Back link */}
      <div>
        <Link href="/service/dashboard-rcm/palliative-care/pc-1" className="pcr-back-link">
          ← กลับแดชบอร์ด Palliative Care
        </Link>
      </div>

      {/* 1. Header */}
      <div className="pcr-header">
        <div>
          <div className="pcr-title-wrap">
            <h1 className="pcr-title">ทะเบียน Palliative Care</h1>
            <span className="pcr-badge">REGISTRY</span>
          </div>
          <p className="pcr-desc">
            ระบบบันทึกและติดตามทะเบียนผู้ป่วย Palliative Care, ตรวจสอบคลินิก 2423 อัตโนมัติจาก HOSxP, ติดตามเยี่ยมบ้าน 1-6 และผลชดเชย Rep
          </p>
        </div>

        <div className="pcr-header-actions">
          <div className={`pcr-sheets-bar ${saveStatus}`} title="ระบบบันทึกอัตโนมัติแบบ Google Sheets">
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>กำลังบันทึกอัตโนมัติ...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle size={13} />
                <span>บันทึกไม่สำเร็จ</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>บันทึกการเปลี่ยนแปลงทั้งหมดแล้ว</span>
              </>
            )}
          </div>

          <button
            type="button"
            className="pcr-btn pcr-btn-secondary"
            onClick={handleExportCSV}
            title="ส่งออกไฟล์ Excel / CSV"
          >
            <Download size={15} />
            ส่งออก Excel
          </button>

          {canEdit && (
            <button
              type="button"
              className="pcr-btn pcr-btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              + เพิ่มทะเบียนผู้ป่วย
            </button>
          )}
        </div>
      </div>

      {/* 2. Sub-navigation Tabs */}
      <div className="pcr-tabs-bar">
        <Link href="/service/dashboard-rcm/palliative-care/pc-1" className="pcr-tab-link">
          <span className="pcr-tab-badge">PC.1</span>
          <span>End Of Life (ADP 30001)</span>
        </Link>
        <Link href="/service/dashboard-rcm/palliative-care/pc-3" className="pcr-tab-link">
          <span className="pcr-tab-badge">PC.3</span>
          <span>รายงานจำแนกตามกลุ่มโรค</span>
        </Link>
        <Link href="/service/dashboard-rcm/palliative-care/registry" className="pcr-tab-link is-active">
          <span className="pcr-tab-badge">PC.Reg</span>
          <span>ทะเบียนผู้ป่วย & เยี่ยมบ้าน</span>
        </Link>
      </div>

      {/* 3. Consolidated Executive Metric Strip */}
      <div className="pcr-metric-strip">
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ผู้ป่วยในทะเบียนทั้งหมด</span>
          <span className="pcr-metric-val">
            {stats.total.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ขึ้นทะเบียน 2423 แล้ว</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-teal-text)' }}>
            {stats.registered.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ยังไม่ได้ดำเนินการ / รอ</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-amber-text)' }}>
            {stats.pendingRegistration.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ได้เงิน (ชดเชยแล้ว)</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-teal-text)' }}>
            {stats.paid.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ติด C / Deny</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-rose-text)' }}>
            {stats.deny.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
      </div>

      {/* 4. Toolbar & Filters */}
      <div className="pcr-toolbar">
        <input
          type="search"
          className="pcr-search-input"
          placeholder="ค้นหา HN, ชื่อผู้ป่วย, รหัสโรค ICD-10..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          aria-label="ค้นหาผู้ป่วยในทะเบียน"
        />

        <select
          className="pcr-select"
          value={filterRegStatus}
          onChange={(e) => {
            setFilterRegStatus(e.target.value)
            setPage(1)
          }}
          aria-label="กรองสถานะการขึ้นทะเบียน"
        >
          <option value="ALL">สถานะขึ้นทะเบียน 2423: ทั้งหมด</option>
          <option value="ดำเนินการเรียบร้อย">ขึ้นทะเบียนแล้ว</option>
          <option value="ยังไม่ได้ดำเนินการ">ยังไม่ได้ดำเนินการ / รอ</option>
        </select>

        <button
          type="button"
          className="pcr-btn pcr-btn-secondary"
          onClick={fetchData}
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            background: 'var(--pc-rose-bg)',
            border: '1px solid var(--pc-rose-border)',
            color: 'var(--pc-rose-text)',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* 5. Legend & Spreadsheet Mode Bar */}
      <div className="pcr-legend-bar">
        <div className="pcr-guide-hint">
          <span>โหมดสเปรดชีต: ดึงข้อมูลชื่อ/ที่อยู่/เบอร์โทรและสถานะคลินิก 2423 จาก HOSxP อัตโนมัติ | วันที่เยี่ยมและวันที่เสียชีวิตคลิกแก้ไขได้ทันที</span>
        </div>
        <div className="pcr-legend-items">
          <span className="pcr-legend-chip pcr-tag-teal">เขียว: ขึ้นทะเบียน 2423 แล้ว / ได้เงินชดเชย</span>
          <span className="pcr-legend-chip pcr-tag-amber">ส้ม: ยังไม่ได้ดำเนินการ / รอผลชดเชย</span>
          <span className="pcr-legend-chip pcr-tag-rose">ชมพู: ผู้ป่วยเสียชีวิต</span>
        </div>
      </div>

      {/* 6. Data Table */}
      <div className="pcr-table-card">
        <div className="pcr-table-scroll">
          <table className="pcr-table">
            <thead>
              {/* Grouped Header Row 1 */}
              <tr>
                <th colSpan={5} className="pcr-th-group">ข้อมูลผู้ป่วย</th>
                <th colSpan={3} className="pcr-th-group">การวินิจฉัยและโครงการ</th>
                <th colSpan={1} className="pcr-th-group">การขึ้นทะเบียน 2423</th>
                <th colSpan={6} className="pcr-th-group">ติดตามเยี่ยมบ้าน (ครั้งที่ 1 - 6)</th>
                <th colSpan={1} className="pcr-th-group">ข้อมูลเสียชีวิต</th>
                {canEdit && <th colSpan={1} className="pcr-th-group">จัดการ</th>}
              </tr>

              {/* Sub Header Row 2 */}
              <tr>
                <th className="pcr-th-sub" style={{ width: 45 }}>ลำดับ</th>
                <th className="pcr-th-sub">HN</th>
                <th className="pcr-th-sub">ชื่อ-สกุลผู้ป่วย</th>
                <th className="pcr-th-sub">ที่อยู่</th>
                <th className="pcr-th-sub">เบอร์โทร</th>
                <th className="pcr-th-sub">ICD10 โรคหลัก</th>
                <th className="pcr-th-sub">ICD 10 Palliative</th>
                <th className="pcr-th-sub">Project code</th>
                <th className="pcr-th-sub">สถานะขึ้นทะเบียน</th>
                <th className="pcr-th-sub">เยี่ยม 1</th>
                <th className="pcr-th-sub">เยี่ยม 2</th>
                <th className="pcr-th-sub">เยี่ยม 3</th>
                <th className="pcr-th-sub">เยี่ยม 4</th>
                <th className="pcr-th-sub">เยี่ยม 5</th>
                <th className="pcr-th-sub">เยี่ยม 6</th>
                <th className="pcr-th-sub">วันที่เสียชีวิต</th>
                {canEdit && <th className="pcr-th-sub">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 17 : 16} style={{ padding: '2.5rem', color: 'var(--pc-muted)' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    กำลังโหลดข้อมูลทะเบียน...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 17 : 16} style={{ padding: '2.5rem', color: 'var(--pc-muted)' }}>
                    <div>ไม่พบข้อมูลทะเบียนผู้ป่วยตามเงื่อนไขที่เลือก</div>
                    {(search || filterRegStatus !== 'ALL') && (
                      <button
                        type="button"
                        className="pcr-btn pcr-btn-secondary"
                        style={{ marginTop: '0.75rem', minHeight: 32, padding: '4px 12px' }}
                        onClick={() => {
                          setSearch('')
                          setFilterRegStatus('ALL')
                          setPage(1)
                        }}
                      >
                        ล้างตัวกรองทั้งหมด
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const rowNum = (page - 1) * 50 + idx + 1
                  const isDeceased = Boolean(item.deathDate?.trim())
                  const isRegistered = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')

                  return (
                    <tr key={item.id} className={isDeceased ? 'pcr-row-death' : ''}>
                      <td style={{ color: 'var(--pc-muted)', fontWeight: 600 }}>{rowNum}</td>
                      <td
                        style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--pc-ink)' }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'hn' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.hn}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'hn'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'hn' })}
                          onSave={(val) => handleCellSave(item.id, 'hn', val)}
                          onCancel={() => setEditingCell(null)}
                          style={{ fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </td>
                      <td
                        style={{ fontWeight: 600, minWidth: 135 }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'patientName' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.patientName}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'patientName'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'patientName' })}
                          onSave={(val) => handleCellSave(item.id, 'patientName', val)}
                          onCancel={() => setEditingCell(null)}
                          style={{ fontWeight: 600 }}
                        />
                      </td>
                      <td
                        style={{ maxWidth: 190, fontSize: '0.8rem', color: 'var(--pc-ink-2)' }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'address' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.address}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'address'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'address' })}
                          onSave={(val) => handleCellSave(item.id, 'address', val)}
                          onCancel={() => setEditingCell(null)}
                        />
                      </td>
                      <td
                        style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'phone' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.phone}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'phone'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'phone' })}
                          onSave={(val) => handleCellSave(item.id, 'phone', val)}
                          onCancel={() => setEditingCell(null)}
                        />
                      </td>
                      <td
                        style={{ fontWeight: 600, color: 'var(--pc-blue-text)' }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'icd10Principal' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.icd10Principal}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'icd10Principal'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'icd10Principal' })}
                          onSave={(val) => handleCellSave(item.id, 'icd10Principal', val)}
                          onCancel={() => setEditingCell(null)}
                          style={{ fontWeight: 600, color: 'var(--pc-blue-text)' }}
                        />
                      </td>
                      <td
                        style={{ fontSize: '0.75rem', maxWidth: 180, color: 'var(--pc-ink-2)' }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'icd10Palliative' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.icd10Palliative}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'icd10Palliative'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'icd10Palliative' })}
                          onSave={(val) => handleCellSave(item.id, 'icd10Palliative', val)}
                          onCancel={() => setEditingCell(null)}
                          style={{ fontSize: '0.75rem' }}
                        />
                      </td>
                      <td
                        style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        className={justSavedCell?.id === item.id && justSavedCell?.field === 'projectCode' ? 'just-saved' : ''}
                      >
                        <EditableTextCell
                          value={item.projectCode}
                          canEdit={canEdit}
                          isEditing={editingCell?.id === item.id && editingCell?.field === 'projectCode'}
                          onStartEdit={() => setEditingCell({ id: item.id, field: 'projectCode' })}
                          onSave={(val) => handleCellSave(item.id, 'projectCode', val)}
                          onCancel={() => setEditingCell(null)}
                        />
                      </td>

                      {/* Clinic 2423 Registration Status */}
                      <td style={{ minWidth: 120 }}>
                        {item.registeredDate ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span className="pcr-tag pcr-tag-teal">ขึ้นทะเบียนแล้ว</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--pc-teal-text)', fontWeight: 600 }}>
                              {item.registeredDate}
                            </span>
                          </div>
                        ) : isRegistered ? (
                          <span className="pcr-tag pcr-tag-teal">ดำเนินการเรียบร้อย</span>
                        ) : (
                          <span className="pcr-tag pcr-tag-amber">ยังไม่ได้ดำเนินการ / รอ</span>
                        )}
                      </td>

                      {/* Visits 1 - 6 */}
                      {[1, 2, 3, 4, 5, 6].map((num) => {
                        const isSaved =
                          justSavedCell?.id === item.id && justSavedCell?.field === `visit${num}Date`

                        return (
                          <td key={num} className={isSaved ? 'just-saved' : ''} style={{ fontSize: '0.75rem', minWidth: 95 }}>
                            <EditableVisitCell
                              item={item}
                              visitNum={num}
                              canEdit={canEdit}
                              onSaveDate={(val) => handleCellSave(item.id, `visit${num}Date`, val)}
                            />
                          </td>
                        )
                      })}

                      {/* Death Date */}
                      <EditableDeathCell
                        item={item}
                        canEdit={canEdit}
                        onSaveDate={(val) => handleCellSave(item.id, 'deathDate', val)}
                        isSavedDate={justSavedCell?.id === item.id && justSavedCell?.field === 'deathDate'}
                      />

                      {/* Actions */}
                      {canEdit && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="pcr-btn pcr-btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.75rem', minHeight: 30 }}
                              onClick={() => handleOpenEdit(item)}
                              title="แก้ไข / บันทึกการเยี่ยม"
                            >
                              <Edit2 size={12} />
                              แก้ไข
                            </button>
                            {permissions.canManage && (
                              <button
                                type="button"
                                className="pcr-btn pcr-btn-danger"
                                style={{ padding: '3px 8px', fontSize: '0.75rem', minHeight: 30 }}
                                onClick={() => setDeletingItem(item)}
                                title="ลบเคส"
                              >
                                <Trash2 size={12} />
                                ลบ
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 7. Pagination */}
        <div className="pcr-pagination">
          <div>
            แสดง {items.length} จาก {totalCount} รายการ (หน้า {page} / {totalPages})
          </div>
          <div className="pcr-page-btns">
            <button
              type="button"
              className="pcr-btn pcr-btn-secondary"
              style={{ padding: '4px 10px', minHeight: 32 }}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={15} />
              ก่อนหน้า
            </button>
            <button
              type="button"
              className="pcr-btn pcr-btn-secondary"
              style={{ padding: '4px 10px', minHeight: 32 }}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ถัดไป
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Modal 1: เพิ่มทะเบียนผู้ป่วย (Initial Intake Fields)      */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="pcr-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="pcr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pcr-modal-header">
              <h2 className="pcr-modal-title">+ เพิ่มทะเบียนผู้ป่วย Palliative Care</h2>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="pcr-modal-body">
                {addError && (
                  <div
                    style={{
                      background: 'var(--pc-rose-bg)',
                      border: '1px solid var(--pc-rose-border)',
                      color: 'var(--pc-rose-text)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    {addError}
                  </div>
                )}

                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">ข้อมูลแรกรับผู้ป่วย (ดึงข้อมูลอัตโนมัติจาก HOSxP)</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label pcr-form-label-required">HN (หมายเลขผู้ป่วย)</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="pcr-input"
                          placeholder="เช่น 000206"
                          required
                          value={addForm.hn}
                          onChange={(e) => setAddForm({ ...addForm, hn: e.target.value })}
                          onBlur={() => {
                            if (addForm.hn.trim() && !addForm.patientName.trim()) {
                              handleLookupHn(addForm.hn)
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="pcr-btn pcr-btn-secondary"
                          style={{ minHeight: 40, whiteSpace: 'nowrap', padding: '0 12px' }}
                          onClick={() => handleLookupHn(addForm.hn)}
                          disabled={isLookingUpHn || !addForm.hn.trim()}
                          title="ดึงชื่อ ที่อยู่ เบอร์โทร และสถานะคลินิก 2423 จาก HOSxP"
                        >
                          {isLookingUpHn ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Search size={14} />
                              ดึงข้อมูล
                            </>
                          )}
                        </button>
                      </div>

                      {lookupFeedback && (
                        <div
                          className={
                            lookupFeedback.type === 'success'
                              ? 'pcr-tag pcr-tag-teal'
                              : lookupFeedback.type === 'warning'
                              ? 'pcr-tag pcr-tag-amber'
                              : 'pcr-tag pcr-tag-rose'
                          }
                          style={{ marginTop: 4, padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4 }}
                        >
                          {lookupFeedback.message}
                        </div>
                      )}
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label pcr-form-label-required">ชื่อ-สกุลผู้ป่วย</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก HOSxP หรือกรอกเอง"
                        required
                        value={addForm.patientName}
                        onChange={(e) => setAddForm({ ...addForm, patientName: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ที่อยู่</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก HOSxP หรือกรอกเอง เช่น 205/1 ม.4 ต.เถินบุรี อ.เถิน"
                        value={addForm.address}
                        onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">เบอร์โทรผู้ป่วย / ญาติ</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก HOSxP หรือกรอกเอง เช่น 065-2488015"
                        value={addForm.phone}
                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ICD10 รหัสโรคหลัก</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น C548 CA corpus"
                        value={addForm.icd10Principal}
                        onChange={(e) => setAddForm({ ...addForm, icd10Principal: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">Project code Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={addForm.projectCode}
                        onChange={(e) => setAddForm({ ...addForm, projectCode: e.target.value })}
                      />
                      <div className="pcr-chips">
                        {PROJECT_CODE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`pcr-chip ${addForm.projectCode === preset ? 'is-active' : ''}`}
                            onClick={() => setAddForm({ ...addForm, projectCode: preset })}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">วันที่เสียชีวิต (ถ้ามี)</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="วว/ดด/ปปปป หรือ เว้นว่างหากยังมีชีวิต"
                        value={addForm.deathDate}
                        onChange={(e) => setAddForm({ ...addForm, deathDate: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ICD 10 รหัส Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={addForm.icd10Palliative}
                        onChange={(e) => setAddForm({ ...addForm, icd10Palliative: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--pc-teal-bg)',
                    border: '1px solid var(--pc-teal-border)',
                    color: 'var(--pc-teal-text)',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    fontSize: '0.8125rem',
                  }}
                >
                  หมายเหตุ: สถานะขึ้นทะเบียนจะถูกตรวจสอบกับ <strong>คลินิก 2423 (Palliative care)</strong> ใน HOSxP อัตโนมัติ และข้อมูลการเยี่ยมบ้านครั้งที่ 1-6 พร้อมผลชดเชย Rep จะแสดงในตารางเมื่อบันทึกวันเยี่ยม
                </div>
              </div>

              <div className="pcr-modal-footer">
                <button
                  type="button"
                  className="pcr-btn pcr-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="pcr-btn pcr-btn-primary"
                  disabled={isSubmittingAdd}
                >
                  {isSubmittingAdd ? 'กำลังบันทึก...' : 'บันทึกขึ้นทะเบียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Modal 2: แก้ไข / บันทึกการเยี่ยมบ้านและหมายเหตุ (Full Edit)*/}
      {/* ======================================================== */}
      {editingItem && (
        <div className="pcr-modal-backdrop" onClick={() => setEditingItem(null)}>
          <div
            className="pcr-modal-card"
            style={{ maxWidth: 960 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pcr-modal-header">
              <div>
                <h2 className="pcr-modal-title">
                  บันทึกข้อมูลและประวัติการเยี่ยม: {editingItem.patientName} (HN: {editingItem.hn})
                </h2>
              </div>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setEditingItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="pcr-modal-body">
                {editError && (
                  <div
                    style={{
                      background: 'var(--pc-rose-bg)',
                      border: '1px solid var(--pc-rose-border)',
                      color: 'var(--pc-rose-text)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    {editError}
                  </div>
                )}

                {/* Section A: Basic info */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">ข้อมูลผู้ป่วยและการขึ้นทะเบียน 2423</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">HN</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.hn || ''}
                        onChange={(e) => setEditForm({ ...editForm, hn: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ชื่อ-สกุลผู้ป่วย</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.patientName || ''}
                        onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ที่อยู่</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">เบอร์โทรผู้ป่วย/ญาติ</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ICD10 รหัสโรคหลัก</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.icd10Principal || ''}
                        onChange={(e) => setEditForm({ ...editForm, icd10Principal: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">สถานะในคลินิก 2423 HOSxP</label>
                      <div style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                        {editingItem.registeredDate ? (
                          <span className="pcr-tag pcr-tag-teal">
                            ขึ้นทะเบียนแล้ว (วันที่: {editingItem.registeredDate})
                          </span>
                        ) : (
                          <span className="pcr-tag pcr-tag-amber">
                            ยังไม่ได้ดำเนินการ / รอ
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">Project code Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.projectCode || ''}
                        onChange={(e) => setEditForm({ ...editForm, projectCode: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ICD 10 รหัส Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.icd10Palliative || ''}
                        onChange={(e) => setEditForm({ ...editForm, icd10Palliative: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Visits 1 - 6 */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">บันทึกการเยี่ยมบ้าน (ครั้งที่ 1 - 6) และเหตุผล/หมายเหตุ</div>
                  <div className="pcr-form-grid">
                    {[1, 2, 3, 4, 5, 6].map((num) => {
                      const dateKey = `visit${num}Date` as keyof PalliativeRegistryItem
                      const statusKey = `visit${num}Status` as keyof PalliativeRegistryItem
                      const rep = (editingItem as any)[`visit${num}Rep`]
                      const comp = (editingItem as any)[`visit${num}Compensated`]

                      return (
                        <div
                          key={num}
                          style={{
                            border: '1px solid var(--pc-border)',
                            borderRadius: 8,
                            padding: '0.75rem',
                            background: 'var(--pc-surface-alt)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--pc-ink)' }}>
                              การเยี่ยมครั้งที่ {num}
                            </span>
                            {rep ? (
                              <span className="pcr-tag pcr-tag-teal" style={{ fontSize: '0.7rem' }}>
                                Rep: {rep} ({Number(comp || 0).toLocaleString()} ฿)
                              </span>
                            ) : null}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--pc-muted)' }}>วันเยี่ยม</label>
                              <input
                                type="text"
                                className="pcr-input"
                                placeholder="เช่น 2/11/2026"
                                value={(editForm as any)[dateKey] || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, [dateKey]: e.target.value })
                                }
                              />
                            </div>
                            <div style={{ flex: 1.5 }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--pc-muted)' }}>เหตุผล / หมายเหตุ</label>
                              <input
                                type="text"
                                className="pcr-input"
                                placeholder="ระบุเหตุผลหรือข้อความเพิ่มเติม"
                                value={(editForm as any)[statusKey] || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, [statusKey]: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Section C: Death Information */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">ข้อมูลการเสียชีวิต</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">วันที่เสียชีวิต</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น 2/11/2026 (เว้นว่างหากยังมีชีวิต)"
                        value={editForm.deathDate || ''}
                        onChange={(e) => setEditForm({ ...editForm, deathDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pcr-modal-footer">
                <button
                  type="button"
                  className="pcr-btn pcr-btn-secondary"
                  onClick={() => setEditingItem(null)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="pcr-btn pcr-btn-primary"
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="pcr-modal-backdrop" onClick={() => setDeletingItem(null)}>
          <div className="pcr-modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="pcr-modal-header">
              <h2 className="pcr-modal-title" style={{ color: 'var(--pc-rose-text)' }}>
                ยืนยันการลบเคสผู้ป่วย
              </h2>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setDeletingItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pcr-modal-body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--pc-ink)' }}>
                คุณต้องการลบข้อมูลทะเบียนผู้ป่วย <strong>{deletingItem.patientName}</strong> (HN: {deletingItem.hn}) ออกจากระบบใช่หรือไม่?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--pc-rose-text)' }}>
                * การกระทำนี้ไม่สามารถย้อนกลับได้ และจะถูกบันทึกในระบบ Audit Log
              </p>
            </div>
            <div className="pcr-modal-footer">
              <button
                type="button"
                className="pcr-btn pcr-btn-secondary"
                onClick={() => setDeletingItem(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="pcr-btn pcr-btn-danger"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                <Trash2 size={15} />
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
