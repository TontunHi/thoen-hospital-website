'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  HeartPulse,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
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

  return (
    <div className="pcr-container">
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
          <button
            type="button"
            className="pcr-btn pcr-btn-secondary"
            onClick={handleExportCSV}
            title="ส่งออกไฟล์ Excel / CSV"
          >
            <Download size={16} />
            ส่งออก Excel
          </button>

          {(permissions.canEdit || permissions.canManage) && (
            <button
              type="button"
              className="pcr-btn pcr-btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={16} />
              + เพิ่มทะเบียนผู้ป่วย
            </button>
          )}
        </div>
      </div>

      {/* 2. Stats Grid */}
      <div className="pcr-stats-grid">
        <div className="pcr-stat-card">
          <span className="pcr-stat-label">ผู้ป่วยในทะเบียนทั้งหมด</span>
          <span className="pcr-stat-value">{stats.total.toLocaleString()}</span>
        </div>
        <div className="pcr-stat-card pcr-stat-registered">
          <span className="pcr-stat-label">ดำเนินการเรียบร้อย</span>
          <span className="pcr-stat-value" style={{ color: '#059669' }}>
            {stats.registered.toLocaleString()}
          </span>
        </div>
        <div className="pcr-stat-card pcr-stat-pending">
          <span className="pcr-stat-label">ยังไม่ได้ดำเนินการ</span>
          <span className="pcr-stat-value" style={{ color: '#d97706' }}>
            {stats.pendingRegistration.toLocaleString()}
          </span>
        </div>
        <div className="pcr-stat-card pcr-stat-claimed">
          <span className="pcr-stat-label">ลงข้อมูล/ส่งเคลม</span>
          <span className="pcr-stat-value" style={{ color: '#0284c7' }}>
            {stats.claimed.toLocaleString()}
          </span>
        </div>
        <div className="pcr-stat-card pcr-stat-paid">
          <span className="pcr-stat-label">ได้เงิน (ชดเชยแล้ว)</span>
          <span className="pcr-stat-value" style={{ color: '#10b981' }}>
            {stats.paid.toLocaleString()}
          </span>
        </div>
        <div className="pcr-stat-card pcr-stat-deny">
          <span className="pcr-stat-label">ติด C / Deny</span>
          <span className="pcr-stat-value" style={{ color: '#ef4444' }}>
            {stats.deny.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="pcr-toolbar">
        <div className="pcr-toolbar-row">
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="pcr-search-input"
              style={{ width: '100%', paddingLeft: '2.25rem' }}
              placeholder="ค้นหา HN, ชื่อ-สกุลผู้ป่วย, รหัสโรค ICD-10..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
          </div>

          <select
            className="pcr-select"
            value={filterRegStatus}
            onChange={(e) => {
              setFilterRegStatus(e.target.value)
              setPage(1)
            }}
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
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
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

      {/* 4. Table Card */}
      <div className="pcr-table-card">
        <div className="pcr-table-scroll">
          <table className="pcr-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>ลำดับ</th>
                <th>HN</th>
                <th>ชื่อ-สกุลผู้ป่วย</th>
                <th>ที่อยู่</th>
                <th>เบอร์โทรผู้ป่วย/ญาติ</th>
                <th>ICD10 รหัสโรคหลัก</th>
                <th>ICD 10 รหัส Palliative</th>
                <th>Project code</th>
                <th>การขึ้นทะเบียน</th>
                <th>วันเยี่ยม 1 / สถานะ</th>
                <th>วันเยี่ยม 2 / สถานะ</th>
                <th>วันเยี่ยม 3 / สถานะ</th>
                <th>วันเยี่ยม 4 / สถานะ</th>
                <th>วันเยี่ยม 5 / สถานะ</th>
                <th>วันเยี่ยม 6 / สถานะ</th>
                <th>วันที่เสียชีวิต</th>
                <th>การลงข้อมูลเสียชีวิต</th>
                <th>สถานะการเคลม</th>
                <th>ผลลัพธ์</th>
                {(permissions.canEdit || permissions.canManage) && <th>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={20} style={{ padding: '2.5rem', color: '#64748b' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    กำลังโหลดข้อมูลทะเบียน...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={20} style={{ padding: '2.5rem', color: '#64748b' }}>
                    ไม่พบข้อมูลทะเบียนผู้ป่วยตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const rowNum = (page - 1) * 50 + idx + 1
                  return (
                    <tr key={item.id}>
                      <td style={{ color: '#64748b', fontWeight: 600 }}>{rowNum}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {item.hn}
                      </td>
                      <td style={{ fontWeight: 600, minWidth: 140 }}>{item.patientName}</td>
                      <td style={{ maxWidth: 200, fontSize: '0.8rem', color: '#475569' }}>
                        {item.address || '-'}
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {item.phone || '-'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0369a1' }}>
                        {item.icd10Principal || '-'}
                      </td>
                      <td style={{ fontSize: '0.75rem', maxWidth: 180, color: '#475569' }}>
                        {item.icd10Palliative || '-'}
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {item.projectCode || '-'}
                      </td>
                      <td>
                        <span
                          className={`pcr-tag ${
                            item.registrationStatus === 'ดำเนินการเรียบร้อย'
                              ? 'pcr-tag-success'
                              : 'pcr-tag-warning'
                          }`}
                        >
                          {item.registrationStatus}
                        </span>
                      </td>

                      {/* Visits 1 - 6 */}
                      {[1, 2, 3, 4, 5, 6].map((num) => {
                        const date = (item as any)[`visit${num}Date`]
                        const status = (item as any)[`visit${num}Status`] || 'ยังไม่ได้เยี่ยม'
                        const isDone = status === 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ'
                        const isPending = status === 'เยี่ยมแล้วยังไม่ได้ลงข้อมูล'

                        return (
                          <td key={num} style={{ fontSize: '0.75rem', minWidth: 100 }}>
                            {date ? (
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>{date}</div>
                            ) : null}
                            <span
                              className={`pcr-tag ${
                                isDone
                                  ? 'pcr-tag-success'
                                  : isPending
                                  ? 'pcr-tag-warning'
                                  : 'pcr-tag-neutral'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        )
                      })}

                      {/* Death Date & Entry */}
                      <td style={{ fontSize: '0.8rem' }}>{item.deathDate || '-'}</td>
                      <td>
                        {item.deathEntryStatus ? (
                          <span
                            className={`pcr-tag ${
                              item.deathEntryStatus === 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ'
                                ? 'pcr-tag-danger'
                                : 'pcr-tag-warning'
                            }`}
                          >
                            {item.deathEntryStatus}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Claim Status & Result */}
                      <td>
                        <span
                          className={`pcr-tag ${
                            item.claimStatus === 'ลงข้อมูล' ? 'pcr-tag-info' : 'pcr-tag-neutral'
                          }`}
                        >
                          {item.claimStatus}
                        </span>
                      </td>
                      <td>
                        {item.claimResult ? (
                          <span
                            className={`pcr-tag ${
                              item.claimResult === 'ได้เงิน'
                                ? 'pcr-tag-success'
                                : item.claimResult === 'ติด C / Deny'
                                ? 'pcr-tag-danger'
                                : 'pcr-tag-info'
                            }`}
                          >
                            {item.claimResult}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Actions */}
                      {(permissions.canEdit || permissions.canManage) && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="pcr-btn pcr-btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenEdit(item)}
                              title="แก้ไข / บันทึกการเยี่ยม"
                            >
                              <Edit2 size={13} />
                              แก้ไข
                            </button>
                            {permissions.canManage && (
                              <button
                                type="button"
                                className="pcr-btn pcr-btn-danger"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => setDeletingItem(item)}
                                title="ลบเคส"
                              >
                                <Trash2 size={13} />
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

        {/* Pagination */}
        <div className="pcr-pagination">
          <div>
            แสดง {items.length} จาก {totalCount} รายการ (หน้า {page} / {totalPages})
          </div>
          <div className="pcr-page-btns">
            <button
              type="button"
              className="pcr-btn pcr-btn-secondary"
              style={{ padding: '4px 8px' }}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              ก่อนหน้า
            </button>
            <button
              type="button"
              className="pcr-btn pcr-btn-secondary"
              style={{ padding: '4px 8px' }}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ถัดไป
              <ChevronRight size={16} />
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
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="pcr-modal-body">
                {addError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
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
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    fontSize: '0.8125rem',
                  }}
                >
                  💡 <strong>หมายเหตุ:</strong> บันทึกข้อมูลแรกรับผู้ป่วยเรียบร้อยแล้ว ท่านสามารถกลับมาอัปเดตวันและสถานะการเยี่ยมบ้านครั้งที่ 1-6, วันที่เสียชีวิต และผลการเคลม ได้ในปุ่ม <strong>"แก้ไข"</strong> ในตารางภายหลัง
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
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="pcr-modal-body">
                {editError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
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
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '0.75rem',
                            background: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                            การเยี่ยมครั้งที่ {num}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', color: '#64748b' }}>วันเยี่ยม</label>
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
                              <label style={{ fontSize: '0.75rem', color: '#64748b' }}>สถานะการเยี่ยม</label>
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
              <h2 className="pcr-modal-title" style={{ color: '#b91c1c' }}>
                ยืนยันการลบเคสผู้ป่วย
              </h2>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setDeletingItem(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="pcr-modal-body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                คุณต้องการลบข้อมูลทะเบียนผู้ป่วย <strong>{deletingItem.patientName}</strong> (HN: {deletingItem.hn}) ออกจากระบบใช่หรือไม่?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#991b1b' }}>
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
                style={{ background: '#dc2626', color: '#fff' }}
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
