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

const VISIT_STATUS_OPTIONS = [
  'ยังไม่ได้เยี่ยม',
  'เยี่ยมแล้วยังไม่ได้ลงข้อมูล',
  'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
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

interface EditableSelectCellProps {
  value: string | null | undefined
  options: Array<{ value: string; label: string }>
  canEdit: boolean
  onSave: (val: string) => void
  badgeClassFn?: (val: string) => string
}

function EditableSelectCell({
  value,
  options,
  canEdit,
  onSave,
  badgeClassFn,
}: EditableSelectCellProps) {
  const currentVal = value || options[0]?.value || ''

  if (!canEdit) {
    return (
      <span className={`pcr-tag ${badgeClassFn ? badgeClassFn(currentVal) : 'pcr-tag-neutral'}`}>
        {currentVal || '-'}
      </span>
    )
  }

  const badgeClass = badgeClassFn ? badgeClassFn(currentVal) : 'pcr-tag-neutral'

  return (
    <select
      className={`pcr-sheet-select pcr-tag ${badgeClass}`}
      value={currentVal}
      onChange={(e) => onSave(e.target.value)}
      title="คลิกเพื่อเลือกเปลี่ยนสถานะทันที"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ background: '#fff', color: '#14201a' }}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface EditableVisitCellProps {
  item: PalliativeRegistryItem
  visitNum: number
  canEdit: boolean
  onSaveDate: (val: string) => void
  onSaveStatus: (val: string) => void
}

function EditableVisitCell({
  item,
  visitNum,
  canEdit,
  onSaveDate,
  onSaveStatus,
}: EditableVisitCellProps) {
  const date = (item as any)[`visit${visitNum}Date`] || ''
  const status = (item as any)[`visit${visitNum}Status`] || 'ยังไม่ได้เยี่ยม'
  const isDone = status === 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ'
  const isPending = status === 'เยี่ยมแล้วยังไม่ได้ลงข้อมูล'
  const badgeClass = isDone ? 'pcr-tag-teal' : isPending ? 'pcr-tag-amber' : 'pcr-tag-neutral'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 95 }}>
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
          title="วันที่เยี่ยม (Enter เพื่อบันทึก)"
        />
      ) : (
        date && <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{date}</div>
      )}

      {canEdit ? (
        <select
          className={`pcr-sheet-select pcr-tag ${badgeClass}`}
          value={status}
          onChange={(e) => onSaveStatus(e.target.value)}
          title="คลิกเพื่อเปลี่ยนสถานะการเยี่ยม"
        >
          {VISIT_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt} style={{ background: '#fff', color: '#14201a' }}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <span className={`pcr-tag ${badgeClass}`}>{status}</span>
      )}
    </div>
  )
}

const REGISTRATION_STATUS_OPTIONS = [
  { value: 'ดำเนินการเรียบร้อย', label: 'ดำเนินการเรียบร้อย' },
  { value: 'ยังไม่ได้ดำเนินการ', label: 'ยังไม่ได้ดำเนินการ' },
]

const CLAIM_STATUS_OPTIONS = [
  { value: 'ยังไม่ได้ลงข้อมูล', label: 'ยังไม่ได้ลงข้อมูล' },
  { value: 'ลงข้อมูล', label: 'ลงข้อมูล' },
]

const CLAIM_RESULT_OPTIONS = [
  { value: '', label: '- ไม่ระบุ -' },
  { value: 'ส่งเคลมแล้ว', label: 'ส่งเคลมแล้ว' },
  { value: 'ได้เงิน', label: 'ได้เงิน' },
  { value: 'ติด C / Deny', label: 'ติด C / Deny' },
]

const DEATH_STATUS_OPTIONS = [
  { value: '', label: '- ไม่ระบุ -' },
  { value: 'ยังไม่ได้เยี่ยม', label: 'ยังไม่ได้เยี่ยม' },
  { value: 'เยี่ยมแล้วยังไม่ได้ลงข้อมูล', label: 'เยี่ยมแล้วยังไม่ได้ลงข้อมูล' },
  { value: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ', label: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ' },
]

interface EditableDeathCellProps {
  item: PalliativeRegistryItem
  canEdit: boolean
  onSaveDate: (val: string) => void
  onSaveStatus: (val: string) => void
  isSavedDate?: boolean
  isSavedStatus?: boolean
}

function EditableDeathCell({
  item,
  canEdit,
  onSaveDate,
  onSaveStatus,
  isSavedDate,
  isSavedStatus,
}: EditableDeathCellProps) {
  const date = item.deathDate || ''
  const status = item.deathEntryStatus || ''
  const isDone = status === 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ' || status === 'ลงข้อมูลแล้ว'
  const badgeClass = isDone ? 'pcr-tag-rose' : status ? 'pcr-tag-amber' : 'pcr-tag-neutral'

  return (
    <>
      <td
        style={{ fontSize: '0.8rem', minWidth: 85 }}
        className={isSavedDate ? 'just-saved' : ''}
      >
        {canEdit ? (
          <input
            type="text"
            className="pcr-sheet-date-input"
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
        ) : (
          date || '-'
        )}
      </td>
      <td className={isSavedStatus ? 'just-saved' : ''}>
        {canEdit ? (
          <select
            className={`pcr-sheet-select pcr-tag ${badgeClass}`}
            value={status}
            onChange={(e) => onSaveStatus(e.target.value)}
            title="คลิกเพื่อเลือกสถานะการลงข้อมูลเสียชีวิต"
          >
            {DEATH_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#fff', color: '#14201a' }}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : status ? (
          <span className={`pcr-tag ${badgeClass}`}>{status}</span>
        ) : (
          '-'
        )}
      </td>
    </>
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
  const [filterClaimStatus, setFilterClaimStatus] = useState('ALL')
  const [filterClaimResult, setFilterClaimResult] = useState('ALL')
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
    registrationStatus: 'ดำเนินการเรียบร้อย',
  })
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
      if (filterClaimStatus !== 'ALL') q.set('claimStatus', filterClaimStatus)
      if (filterClaimResult !== 'ALL') q.set('claimResult', filterClaimResult)
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
  }, [search, filterRegStatus, filterClaimStatus, filterClaimResult, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle Add Form Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.hn.trim() || !addForm.patientName.trim()) {
      setAddError('กรุณาระบุ HN และชื่อ-สกุลผู้ป่วย')
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
        registrationStatus: 'ดำเนินการเรียบร้อย',
      })
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
      'การขึ้นทะเบียน',
      'วันเยี่ยมครั้งที่ 1',
      'สถานะ การเยี่ยมครั้งที่ 1',
      'วันเยี่ยมครั้งที่ 2',
      'สถานะ การเยี่ยมครั้งที่ 2',
      'วันเยี่ยมครั้งที่ 3',
      'สถานะ การเยี่ยมครั้งที่ 3',
      'วันเยี่ยมครั้งที่ 4',
      'สถานะ การเยี่ยมครั้งที่ 4',
      'วันเยี่ยมครั้งที่ 5',
      'สถานะ การเยี่ยมครั้งที่ 5',
      'วันเยี่ยมครั้งที่ 6',
      'สถานะ การเยี่ยมครั้งที่ 6',
      'วันที่เสียชีวิต',
      'การลงข้อมูลเสียชีวิต',
      'สถานะการเคลม',
      'ผลลัพธ์',
    ]

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = items.map((item, idx) => [
      idx + 1,
      escapeCsv(item.hn),
      escapeCsv(item.patientName),
      escapeCsv(item.address),
      escapeCsv(item.phone),
      escapeCsv(item.icd10Principal),
      escapeCsv(item.icd10Palliative),
      escapeCsv(item.projectCode),
      escapeCsv(item.registrationStatus),
      escapeCsv(item.visit1Date),
      escapeCsv(item.visit1Status),
      escapeCsv(item.visit2Date),
      escapeCsv(item.visit2Status),
      escapeCsv(item.visit3Date),
      escapeCsv(item.visit3Status),
      escapeCsv(item.visit4Date),
      escapeCsv(item.visit4Status),
      escapeCsv(item.visit5Date),
      escapeCsv(item.visit5Status),
      escapeCsv(item.visit6Date),
      escapeCsv(item.visit6Status),
      escapeCsv(item.deathDate),
      escapeCsv(item.deathEntryStatus),
      escapeCsv(item.claimStatus),
      escapeCsv(item.claimResult),
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
            ระบบบันทึกและติดตามทะเบียนผู้ป่วย Palliative Care, การติดตามเยี่ยมบ้านครั้งที่ 1-6, วันที่เสียชีวิต และสถานะการเบิกจ่ายชดเชย
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
          <span className="pcr-metric-label">ดำเนินการเรียบร้อย</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-teal-text)' }}>
            {stats.registered.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ยังไม่ได้ดำเนินการ</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-amber-text)' }}>
            {stats.pendingRegistration.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </div>
        <div className="pcr-metric-cell">
          <span className="pcr-metric-label">ลงข้อมูล/ส่งเคลม</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-blue-text)' }}>
            {stats.claimed.toLocaleString()}
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
          <option value="ALL">สถานะขึ้นทะเบียน: ทั้งหมด</option>
          <option value="ดำเนินการเรียบร้อย">ดำเนินการเรียบร้อย</option>
          <option value="ยังไม่ได้ดำเนินการ">ยังไม่ได้ดำเนินการ</option>
        </select>

        <select
          className="pcr-select"
          value={filterClaimStatus}
          onChange={(e) => {
            setFilterClaimStatus(e.target.value)
            setPage(1)
          }}
          aria-label="กรองสถานะการเคลม"
        >
          <option value="ALL">สถานะเคลม: ทั้งหมด</option>
          <option value="ยังไม่ได้ลงข้อมูล">ยังไม่ได้ลงข้อมูล</option>
          <option value="ลงข้อมูล">ลงข้อมูล</option>
        </select>

        <select
          className="pcr-select"
          value={filterClaimResult}
          onChange={(e) => {
            setFilterClaimResult(e.target.value)
            setPage(1)
          }}
          aria-label="กรองผลลัพธ์การเคลม"
        >
          <option value="ALL">ผลลัพธ์เคลม: ทั้งหมด</option>
          <option value="ส่งเคลมแล้ว">ส่งเคลมแล้ว</option>
          <option value="ได้เงิน">ได้เงิน</option>
          <option value="ติด C / Deny">ติด C / Deny</option>
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
          <span>โหมดสเปรดชีต: คลิกที่ช่องข้อความเพื่อแก้ไข (Enter บันทึก) หรือเลือกสถานะจากตัวเลือก ระบบจะบันทึกอัตโนมัติ</span>
        </div>
        <div className="pcr-legend-items">
          <span className="pcr-legend-chip pcr-tag-teal">เขียว: เรียบร้อย / ได้เงิน</span>
          <span className="pcr-legend-chip pcr-tag-amber">ส้ม: ยังไม่ได้ดำเนินการ / รอ</span>
          <span className="pcr-legend-chip pcr-tag-blue">ฟ้า: ลงข้อมูล / ส่งเคลม</span>
          <span className="pcr-legend-chip pcr-tag-rose">ชมพู: ติด C / เสียชีวิต</span>
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
                <th colSpan={1} className="pcr-th-group">การขึ้นทะเบียน</th>
                <th colSpan={6} className="pcr-th-group">ติดตามเยี่ยมบ้าน (ครั้งที่ 1 - 6)</th>
                <th colSpan={2} className="pcr-th-group">ข้อมูลเสียชีวิต</th>
                <th colSpan={2} className="pcr-th-group">การเบิกจ่ายชดเชย (e-Claim)</th>
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
                <th className="pcr-th-sub">การขึ้นทะเบียน</th>
                <th className="pcr-th-sub">เยี่ยม 1</th>
                <th className="pcr-th-sub">เยี่ยม 2</th>
                <th className="pcr-th-sub">เยี่ยม 3</th>
                <th className="pcr-th-sub">เยี่ยม 4</th>
                <th className="pcr-th-sub">เยี่ยม 5</th>
                <th className="pcr-th-sub">เยี่ยม 6</th>
                <th className="pcr-th-sub">วันที่เสียชีวิต</th>
                <th className="pcr-th-sub">การลงข้อมูล</th>
                <th className="pcr-th-sub">สถานะเคลม</th>
                <th className="pcr-th-sub">ผลลัพธ์</th>
                {canEdit && <th className="pcr-th-sub">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 20 : 19} style={{ padding: '2.5rem', color: 'var(--pc-muted)' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    กำลังโหลดข้อมูลทะเบียน...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 20 : 19} style={{ padding: '2.5rem', color: 'var(--pc-muted)' }}>
                    <div>ไม่พบข้อมูลทะเบียนผู้ป่วยตามเงื่อนไขที่เลือก</div>
                    {(search || filterRegStatus !== 'ALL' || filterClaimStatus !== 'ALL' || filterClaimResult !== 'ALL') && (
                      <button
                        type="button"
                        className="pcr-btn pcr-btn-secondary"
                        style={{ marginTop: '0.75rem', minHeight: 32, padding: '4px 12px' }}
                        onClick={() => {
                          setSearch('')
                          setFilterRegStatus('ALL')
                          setFilterClaimStatus('ALL')
                          setFilterClaimResult('ALL')
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
                  return (
                    <tr key={item.id}>
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
                      <td className={justSavedCell?.id === item.id && justSavedCell?.field === 'registrationStatus' ? 'just-saved' : ''}>
                        <EditableSelectCell
                          value={item.registrationStatus}
                          options={REGISTRATION_STATUS_OPTIONS}
                          canEdit={canEdit}
                          onSave={(val) => handleCellSave(item.id, 'registrationStatus', val)}
                          badgeClassFn={(val) => (val === 'ดำเนินการเรียบร้อย' ? 'pcr-tag-teal' : 'pcr-tag-amber')}
                        />
                      </td>

                      {/* Visits 1 - 6 */}
                      {[1, 2, 3, 4, 5, 6].map((num) => {
                        const isSaved =
                          justSavedCell?.id === item.id &&
                          (justSavedCell?.field === `visit${num}Date` || justSavedCell?.field === `visit${num}Status`)

                        return (
                          <td key={num} className={isSaved ? 'just-saved' : ''} style={{ fontSize: '0.75rem', minWidth: 95 }}>
                            <EditableVisitCell
                              item={item}
                              visitNum={num}
                              canEdit={canEdit}
                              onSaveDate={(val) => handleCellSave(item.id, `visit${num}Date`, val)}
                              onSaveStatus={(val) => handleCellSave(item.id, `visit${num}Status`, val)}
                            />
                          </td>
                        )
                      })}

                      {/* Death Date & Entry */}
                      <EditableDeathCell
                        item={item}
                        canEdit={canEdit}
                        onSaveDate={(val) => handleCellSave(item.id, 'deathDate', val)}
                        onSaveStatus={(val) => handleCellSave(item.id, 'deathEntryStatus', val)}
                        isSavedDate={justSavedCell?.id === item.id && justSavedCell?.field === 'deathDate'}
                        isSavedStatus={justSavedCell?.id === item.id && justSavedCell?.field === 'deathEntryStatus'}
                      />

                      {/* Claim Status & Result */}
                      <td className={justSavedCell?.id === item.id && justSavedCell?.field === 'claimStatus' ? 'just-saved' : ''}>
                        <EditableSelectCell
                          value={item.claimStatus}
                          options={CLAIM_STATUS_OPTIONS}
                          canEdit={canEdit}
                          onSave={(val) => handleCellSave(item.id, 'claimStatus', val)}
                          badgeClassFn={(val) => (val === 'ลงข้อมูล' ? 'pcr-tag-blue' : 'pcr-tag-neutral')}
                        />
                      </td>
                      <td className={justSavedCell?.id === item.id && justSavedCell?.field === 'claimResult' ? 'just-saved' : ''}>
                        <EditableSelectCell
                          value={item.claimResult}
                          options={CLAIM_RESULT_OPTIONS}
                          canEdit={canEdit}
                          onSave={(val) => handleCellSave(item.id, 'claimResult', val)}
                          badgeClassFn={(val) =>
                            val === 'ได้เงิน'
                              ? 'pcr-tag-teal'
                              : val === 'ติด C / Deny'
                              ? 'pcr-tag-rose'
                              : val
                              ? 'pcr-tag-blue'
                              : 'pcr-tag-neutral'
                          }
                        />
                      </td>

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
                  <div className="pcr-form-section-title">ข้อมูลแรกรับผู้ป่วย (Initial Intake)</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label pcr-form-label-required">HN (หมายเลขผู้ป่วย)</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น 000206"
                        required
                        value={addForm.hn}
                        onChange={(e) => setAddForm({ ...addForm, hn: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label pcr-form-label-required">ชื่อ-สกุลผู้ป่วย</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น นางจันทนา ตันมา"
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
                        placeholder="เช่น 205/1 ม.4 ต.เถินบุรี อ.เถิน จ.ลำปาง"
                        value={addForm.address}
                        onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">เบอร์โทรผู้ป่วย / ญาติ</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น 065-2488015 / 080-1209257"
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
                      <label className="pcr-form-label">การขึ้นทะเบียน</label>
                      <select
                        className="pcr-select"
                        value={addForm.registrationStatus}
                        onChange={(e) => setAddForm({ ...addForm, registrationStatus: e.target.value })}
                      >
                        <option value="ดำเนินการเรียบร้อย">ดำเนินการเรียบร้อย</option>
                        <option value="ยังไม่ได้ดำเนินการ">ยังไม่ได้ดำเนินการ</option>
                      </select>
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
                  หมายเหตุ: เมื่อบันทึกข้อมูลแรกรับผู้ป่วยเรียบร้อยแล้ว ท่านสามารถกลับมาอัปเดตวันและสถานะการเยี่ยมบ้านครั้งที่ 1-6, วันที่เสียชีวิต และผลการเคลม ได้ในตารางโดยตรง หรือกดปุ่ม <strong>&quot;แก้ไข&quot;</strong>
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
      {/* Modal 2: แก้ไข / บันทึกการเยี่ยม / สถานะเคลม (Full Edit)   */}
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
                  <div className="pcr-form-section-title">ข้อมูลผู้ป่วยและการขึ้นทะเบียน</div>
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
                      <label className="pcr-form-label">การขึ้นทะเบียน</label>
                      <select
                        className="pcr-select"
                        value={editForm.registrationStatus || 'ยังไม่ได้ดำเนินการ'}
                        onChange={(e) => setEditForm({ ...editForm, registrationStatus: e.target.value })}
                      >
                        <option value="ดำเนินการเรียบร้อย">ดำเนินการเรียบร้อย</option>
                        <option value="ยังไม่ได้ดำเนินการ">ยังไม่ได้ดำเนินการ</option>
                      </select>
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">Project code Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.projectCode || ''}
                        onChange={(e) => setEditForm({ ...editForm, projectCode: e.target.value })}
                      />
                      <div className="pcr-chips">
                        {PROJECT_CODE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`pcr-chip ${editForm.projectCode === preset ? 'is-active' : ''}`}
                            onClick={() => setEditForm({ ...editForm, projectCode: preset })}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section B: Visits 1 - 6 */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">บันทึกการเยี่ยมบ้าน (ครั้งที่ 1 - 6)</div>
                  <div className="pcr-form-grid">
                    {[1, 2, 3, 4, 5, 6].map((num) => {
                      const dateKey = `visit${num}Date` as keyof PalliativeRegistryItem
                      const statusKey = `visit${num}Status` as keyof PalliativeRegistryItem

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
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--pc-ink)' }}>
                            การเยี่ยมครั้งที่ {num}
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
                            <div style={{ flex: 1.2 }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--pc-muted)' }}>สถานะการเยี่ยม</label>
                              <select
                                className="pcr-select"
                                style={{ width: '100%' }}
                                value={(editForm as any)[statusKey] || 'ยังไม่ได้เยี่ยม'}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, [statusKey]: e.target.value })
                                }
                              >
                                {VISIT_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
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
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">การลงข้อมูลเสียชีวิต</label>
                      <select
                        className="pcr-select"
                        value={editForm.deathEntryStatus || ''}
                        onChange={(e) => setEditForm({ ...editForm, deathEntryStatus: e.target.value })}
                      >
                        <option value="">-- ไม่ระบุ (ยังมีชีวิต) --</option>
                        {VISIT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section D: Claim & Results */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">สถานะการเบิกจ่ายชดเชย (e-Claim) & ผลลัพธ์</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">สถานะการเคลม</label>
                      <select
                        className="pcr-select"
                        value={editForm.claimStatus || 'ยังไม่ได้ลงข้อมูล'}
                        onChange={(e) => setEditForm({ ...editForm, claimStatus: e.target.value })}
                      >
                        <option value="ยังไม่ได้ลงข้อมูล">ยังไม่ได้ลงข้อมูล</option>
                        <option value="ลงข้อมูล">ลงข้อมูล</option>
                      </select>
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ผลลัพธ์การเคลม</label>
                      <select
                        className="pcr-select"
                        value={editForm.claimResult || ''}
                        onChange={(e) => setEditForm({ ...editForm, claimResult: e.target.value })}
                      >
                        <option value="">-- ยังไม่ระบุ --</option>
                        <option value="ส่งเคลมแล้ว">ส่งเคลมแล้ว</option>
                        <option value="ได้เงิน">ได้เงิน</option>
                        <option value="ติด C / Deny">ติด C / Deny</option>
                      </select>
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
