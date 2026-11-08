'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Download,
  RefreshCw,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Check,
} from 'lucide-react'
import type { LongTermCareRecord } from '@/lib/clinical/ltcRegistryService'
import './page.css'

interface SheetInputProps {
  value: string | number | null | undefined
  onSave: (val: string) => void
  type?: string
  placeholder?: string
  style?: React.CSSProperties
  wrapStyle?: React.CSSProperties
  centered?: boolean
  min?: number
  max?: number
  status?: 'saving' | 'saved' | 'error'
  title?: string
}

function SheetInput({
  value,
  onSave,
  type = 'text',
  placeholder = '',
  style,
  wrapStyle,
  centered = false,
  min,
  max,
  status,
  title,
}: SheetInputProps) {
  const [val, setVal] = useState(value !== null && value !== undefined ? String(value) : '')

  useEffect(() => {
    setVal(value !== null && value !== undefined ? String(value) : '')
  }, [value])

  const handleBlur = () => {
    const originalStr = value !== null && value !== undefined ? String(value) : ''
    if (val.trim() !== originalStr.trim()) {
      onSave(val)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setVal(value !== null && value !== undefined ? String(value) : '')
      e.currentTarget.blur()
    }
  }

  return (
    <div
      className={`ltc-sheet-cell-wrap ${centered ? 'is-centered' : ''}`}
      style={wrapStyle}
    >
      <input
        type={type}
        min={min}
        max={max}
        placeholder={placeholder}
        title={title}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`ltc-sheet-input ${status === 'saving' ? 'is-saving' : status === 'saved' ? 'is-saved' : status === 'error' ? 'is-error' : ''}`}
        style={style}
      />
      {status === 'saving' && (
        <span className="ltc-sheet-status-dot" style={{ color: 'var(--ltc-accent)' }} title="กำลังบันทึก...">
          <RefreshCw size={11} className="animate-spin" />
        </span>
      )}
      {status === 'saved' && (
        <span className="ltc-sheet-status-dot" style={{ color: '#16a34a' }} title="บันทึกเรียบร้อย">
          <Check size={12} />
        </span>
      )}
      {status === 'error' && (
        <span className="ltc-sheet-status-dot" style={{ color: '#dc2626' }} title="เกิดข้อผิดพลาดในการบันทึก">
          <AlertCircle size={12} />
        </span>
      )}
    </div>
  )
}

export interface LtcRegistryClientProps {
  userRole: string
  username: string
  isAdmin: boolean
  initialData?: any | null
}

export default function LtcRegistryClient({
  userRole,
  username,
  isAdmin,
  initialData,
}: LtcRegistryClientProps) {
  // Data state
  const [items, setItems] = useState<LongTermCareRecord[]>(initialData?.items || [])
  const [total, setTotal] = useState(initialData?.total || 0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 1)
  const [availableAreaZones, setAvailableAreaZones] = useState<string[]>(initialData?.availableAreaZones || [])
  const [stats, setStats] = useState(
    initialData?.stats || {
      total: 0,
      avgAdl: 0,
      zoneCounts: {} as Record<string, number>,
    }
  )
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Filters state
  const [search, setSearch] = useState('')
  const [selectedZone, setSelectedZone] = useState('ALL')

  // Add modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    hn: '',
    cid: '',
    patientName: '',
    address: '',
    moo: '',
    tambon: '',
    age: '',
    adlScore: '',
    areaZone: '',
  })
  const [isLookingUpHn, setIsLookingUpHn] = useState(false)
  const [lookupFeedback, setLookupFeedback] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [isDuplicateInLtc, setIsDuplicateInLtc] = useState(false)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<LongTermCareRecord | null>(null)
  const [editForm, setEditForm] = useState({
    cid: '',
    patientName: '',
    address: '',
    moo: '',
    tambon: '',
    age: '',
    adlScore: '',
    areaZone: '',
  })
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<LongTermCareRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Notice toast state
  const [toastNotice, setToastNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const [savingCells, setSavingCells] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const [isSyncingModalPt, setIsSyncingModalPt] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastNotice({ type, message })
    setTimeout(() => setToastNotice(null), 4000)
  }


  // Fetch data
  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      if (selectedZone !== 'ALL') q.set('areaZone', selectedZone)
      q.set('page', String(page))
      q.set('limit', String(limit))

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/ltc-registry?${q.toString()}`, {
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลทะเบียน LTC ได้')
      }

      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setAvailableAreaZones(data.availableAreaZones || [])
      if (data.stats) setStats(data.stats)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [search, selectedZone, page, limit])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData, initialData])

  // Filter state for ADL group card filter
  const [adlFilter, setAdlFilter] = useState<'ALL' | 'HOMEBOUND' | 'BEDRIDDEN'>('ALL')

  // Computed ADL groups
  const adlBreakdown = useMemo(() => {
    let bedridden = 0 // 0-4
    let homebound = 0 // 5-11
    let independent = 0 // 12-20
    for (const item of items) {
      if (item.adlScore !== null && item.adlScore !== undefined) {
        const s = Number(item.adlScore)
        if (s <= 4) bedridden++
        else if (s <= 11) homebound++
        else independent++
      }
    }
    return { bedridden, homebound, independent }
  }, [items])

  // Filtered items based on ADL card filter
  const displayedItems = useMemo(() => {
    if (adlFilter === 'BEDRIDDEN') {
      return items.filter(
        (it) => it.adlScore !== null && it.adlScore !== undefined && Number(it.adlScore) <= 4
      )
    }
    if (adlFilter === 'HOMEBOUND') {
      return items.filter(
        (it) =>
          it.adlScore !== null &&
          it.adlScore !== undefined &&
          Number(it.adlScore) >= 5 &&
          Number(it.adlScore) <= 11
      )
    }
    return items
  }, [items, adlFilter])

  // Lookup HN from HOSxP
  const handleLookupHn = async (rawHn?: string) => {
    const targetHn = (rawHn || addForm.hn).trim()
    if (!targetHn) return

    setIsLookingUpHn(true)
    setLookupFeedback(null)
    setIsDuplicateInLtc(false)

    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/palliative-care/ltc-registry/lookup-hn?hn=${encodeURIComponent(targetHn)}`
      )
      const json = await res.json()

      if (!res.ok || !json.success || !json.data) {
        setLookupFeedback({
          type: 'warning',
          message: json.error || 'ไม่พบข้อมูล HN นี้ในระบบ HOSxP (สามารถกรอกข้อมูลเองได้)',
        })
        return
      }

      const pt = json.data
      setAddForm((prev) => ({
        ...prev,
        hn: pt.hn,
        cid: pt.cid || prev.cid,
        patientName: pt.patientName || prev.patientName,
        address: pt.address || prev.address,
        moo: pt.moo || prev.moo,
        tambon: pt.tambon || prev.tambon,
        age: pt.age !== null && pt.age !== undefined ? String(pt.age) : prev.age,
      }))

      if (pt.isAlreadyInLtc) {
        setIsDuplicateInLtc(true)
        setLookupFeedback({
          type: 'error',
          message: `ผู้ป่วยรายนี้ (HN: ${pt.hn} - ${pt.patientName}) มีรายชื่ออยู่ในทะเบียน Long Term Care (LTC) แล้ว ห้ามลงข้อมูลซ้ำ`,
        })
      } else if (pt.isPalliative) {
        setLookupFeedback({
          type: 'warning',
          message: `พบข้อมูลใน HOSxP (ผู้ป่วยรายนี้มีชื่อในทะเบียน Palliative Care)`,
        })
      } else {
        setLookupFeedback({
          type: 'success',
          message: `✓ พบข้อมูลผู้ป่วยใน HOSxP: ${pt.patientName} (อายุ ${pt.age || '-'} ปี)`,
        })
      }
    } catch (err: any) {
      setLookupFeedback({
        type: 'error',
        message: err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก HOSxP',
      })
    } finally {
      setIsLookingUpHn(false)
    }
  }

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.hn.trim() || !addForm.patientName.trim() || isDuplicateInLtc) return

    setIsSubmittingAdd(true)
    try {
      const payload = {
        hn: addForm.hn.trim(),
        cid: addForm.cid.trim() || null,
        patientName: addForm.patientName.trim(),
        address: addForm.address.trim() || null,
        moo: addForm.moo.trim() || null,
        tambon: addForm.tambon.trim() || null,
        age: addForm.age ? parseInt(addForm.age, 10) : null,
        adlScore: addForm.adlScore ? parseInt(addForm.adlScore, 10) : null,
        areaZone: addForm.areaZone.trim() || null,
      }

      const res = await fetch('/api/service/dashboard-rcm/palliative-care/ltc-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      showToast(`บันทึกขึ้นทะเบียน LTC ผู้ป่วย HN: ${payload.hn} เรียบร้อยแล้ว`)
      setIsAddModalOpen(false)
      setAddForm({
        hn: '',
        cid: '',
        patientName: '',
        address: '',
        moo: '',
        tambon: '',
        age: '',
        adlScore: '',
        areaZone: '',
      })
      setLookupFeedback(null)
      fetchData()
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (record: LongTermCareRecord) => {
    setEditRecord(record)
    setEditForm({
      cid: record.cid || '',
      patientName: record.patientName || '',
      address: record.address || '',
      moo: record.moo || '',
      tambon: record.tambon || '',
      age: record.age !== null && record.age !== undefined ? String(record.age) : '',
      adlScore: record.adlScore !== null && record.adlScore !== undefined ? String(record.adlScore) : '',
      areaZone: record.areaZone || '',
    })
    setIsEditModalOpen(true)
  }

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRecord) return

    setIsSubmittingEdit(true)
    try {
      const payload = {
        cid: editForm.cid.trim() || null,
        patientName: editForm.patientName.trim(),
        address: editForm.address.trim() || null,
        moo: editForm.moo.trim() || null,
        tambon: editForm.tambon.trim() || null,
        age: editForm.age ? parseInt(editForm.age, 10) : null,
        adlScore: editForm.adlScore ? parseInt(editForm.adlScore, 10) : null,
        areaZone: editForm.areaZone.trim() || null,
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/ltc-registry/${editRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'แก้ไขข้อมูลไม่สำเร็จ')
      }

      showToast(`แก้ไขข้อมูลผู้ป่วย HN: ${editRecord.hn} เรียบร้อยแล้ว`)
      setIsEditModalOpen(false)
      setEditRecord(null)
      fetchData()
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Inline Cell Update (Spreadsheet Mode)
  const handleCellUpdate = async (
    record: LongTermCareRecord,
    field: keyof LongTermCareRecord,
    rawVal: string
  ) => {
    const originalVal = record[field] ?? ''
    const cleanRawVal = rawVal.trim()
    if (String(originalVal).trim() === cleanRawVal) return

    const cellKey = `${record.id}-${String(field)}`
    setSavingCells((prev) => ({ ...prev, [cellKey]: 'saving' }))

    try {
      const payload: Record<string, unknown> = {}
      if (field === 'adlScore') {
        payload.adlScore = cleanRawVal === '' ? null : parseInt(cleanRawVal, 10)
      } else if (field === 'age') {
        payload.age = cleanRawVal === '' ? null : parseInt(cleanRawVal, 10)
      } else if (field === 'cid') {
        payload.cid = cleanRawVal.replace(/[^0-9]/g, '') || null
      } else {
        payload[field] = cleanRawVal === '' ? null : cleanRawVal
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/ltc-registry/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'บันทึกไม่สำเร็จ')
      }

      const updatedItem = json.data as LongTermCareRecord
      setItems((prev) => prev.map((item) => (item.id === record.id ? { ...item, ...updatedItem } : item)))

      if (updatedItem.areaZone && !availableAreaZones.includes(updatedItem.areaZone)) {
        setAvailableAreaZones((prev) => [...prev, updatedItem.areaZone!])
      }

      setSavingCells((prev) => ({ ...prev, [cellKey]: 'saved' }))
      setTimeout(() => {
        setSavingCells((prev) => {
          const next = { ...prev }
          delete next[cellKey]
          return next
        })
      }, 1500)
    } catch (err: any) {
      setSavingCells((prev) => ({ ...prev, [cellKey]: 'error' }))
      showToast(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error')
      setTimeout(() => {
        setSavingCells((prev) => {
          const next = { ...prev }
          delete next[cellKey]
          return next
        })
      }, 3000)
    }
  }


  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/ltc-registry/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ลบข้อมูลไม่สำเร็จ')
      }

      showToast(`ลบข้อมูลผู้ป่วย HN: ${deleteTarget.hn} ออกจากทะเบียน LTC เรียบร้อยแล้ว`)
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setIsDeleting(false)
    }
  }

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      if (selectedZone !== 'ALL') q.set('areaZone', selectedZone)
      q.set('exportAll', 'true')

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/ltc-registry?${q.toString()}`)
      const data = await res.json()
      if (!data.success || !data.items) {
        alert('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
        return
      }

      const rows: LongTermCareRecord[] = data.items
      const headers = [
        'ลำดับ',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ นามสกุล',
        'บ้านเลขที่',
        'หมู่',
        'ตำบล',
        'อายุ (ปี)',
        'คะแนน ADL',
        'กลุ่ม ADL',
        'เขตพื้นที่',
        'ผู้บันทึก',
      ]

      const csvContent = [
        headers.join(','),
        ...rows.map((r, idx) => {
          let adlGroup = '-'
          if (r.adlScore !== null && r.adlScore !== undefined) {
            const s = Number(r.adlScore)
            if (s <= 4) adlGroup = 'ติดเตียง (0-4)'
            else if (s <= 11) adlGroup = 'ติดบ้าน (5-11)'
            else adlGroup = 'ติดสังคม (12-20)'
          }
          return [
            idx + 1,
            `"${r.hn || ''}"`,
            `"${r.cid || ''}"`,
            `"${r.patientName || ''}"`,
            `"${r.address || ''}"`,
            `"${r.moo || ''}"`,
            `"${r.tambon || ''}"`,
            r.age ?? '',
            r.adlScore ?? '',
            `"${adlGroup}"`,
            `"${r.areaZone || ''}"`,
            `"${r.createdBy || ''}"`,
          ].join(',')
        }),
      ].join('\r\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ทะเบียน_Long_Term_Care_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล: ' + err.message)
    }
  }

  // Helper for ADL category tooltip text
  const getAdlCategoryText = (score: number | null | undefined): string => {
    if (score === null || score === undefined || String(score).trim() === '') return 'ยังไม่ได้ประเมิน'
    const val = Number(score)
    if (isNaN(val)) return 'ยังไม่ได้ประเมิน'
    if (val <= 4) return 'ผู้ป่วยติดเตียง (0-4 คะแนน)'
    if (val <= 11) return 'ผู้ป่วยติดบ้าน (5-11 คะแนน)'
    return 'ผู้ป่วยติดสังคม (12-20 คะแนน)'
  }

  // Render ADL badge helper
  const renderAdlBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined || String(score).trim() === '') {
      return null
    }
    const val = Number(score)
    if (isNaN(val)) {
      return null
    }
    if (val <= 4) {
      return (
        <span className="ltc-adl-badge ltc-adl-bedridden" title="คะแนน 0-4: ผู้ป่วยติดเตียง (Severely Dependent)">
          {val} (ติดเตียง)
        </span>
      )
    }
    if (val <= 11) {
      return (
        <span className="ltc-adl-badge ltc-adl-homebound" title="คะแนน 5-11: ผู้ป่วยติดบ้าน (Partially Dependent)">
          {val} (ติดบ้าน)
        </span>
      )
    }
    return (
      <span className="ltc-adl-badge ltc-adl-independent" title="คะแนน 12-20: ติดสังคม (Independent)">
        {val} (ติดสังคม)
      </span>
    )
  }

  return (
    <div className="ltc-container">
      {/* 0. Back Link & Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <Link href="/service/dashboard-rcm/palliative-care/pc-1" className="ltc-back-link">
          ← กลับแดชบอร์ด Palliative Care
        </Link>

        {/* Tab Sub-Navigation */}
        <div className="ltc-tabs-bar">
          <Link href="/service/dashboard-rcm/palliative-care/registry" className="ltc-tab-link">
            ทะเบียน Palliative Care
          </Link>
          <Link href="/service/dashboard-rcm/palliative-care/ltc-registry" className="ltc-tab-link is-active">
            ทะเบียน Long Term Care (LTC)
          </Link>
        </div>
      </div>

      {/* 1. Header */}
      <div className="ltc-header">
        <div>
          <div className="ltc-title-wrap">
            <h1 className="ltc-title">ทะเบียน Long Term Care (LTC)</h1>
            <span className="ltc-badge">LTC REGISTRY</span>
          </div>
          <p className="ltc-desc">
            ระบบบันทึกและจัดการทะเบียนผู้ป่วยดูแลระยะยาว Long Term Care (LTC), คะแนน ADL, เขตพื้นที่รับผิดชอบ และการตรวจสอบข้ามระบบกับ Palliative Care
          </p>
        </div>

        <div className="ltc-header-actions">
          <button
            type="button"
            className="ltc-btn ltc-btn-secondary"
            onClick={handleExportCsv}
            title="ส่งออกข้อมูลเป็น CSV / Excel"
          >
            <Download size={14} />
            ส่งออก CSV
          </button>
          <button
            type="button"
            className="ltc-btn ltc-btn-primary"
            onClick={() => {
              setLookupFeedback(null)
              setIsDuplicateInLtc(false)
              setIsAddModalOpen(true)
            }}
          >
            <Plus size={14} />
            เพิ่มผู้ป่วยขึ้นทะเบียน LTC
          </button>
        </div>
      </div>

      {/* 2. Stats Cards */}
      <div className="ltc-stats-grid" role="region" aria-label="สรุปสถิติผู้ป่วยและตัวกรองด่วนผ่านการ์ด">
        <button
          type="button"
          className={`ltc-stat-card ltc-stat-card-btn ${adlFilter === 'ALL' ? 'is-active is-active-total' : ''}`}
          onClick={() => setAdlFilter('ALL')}
          aria-pressed={adlFilter === 'ALL'}
          title={adlFilter === 'ALL' ? 'แสดงผู้ป่วยทั้งหมด' : 'คลิกเพื่อดูผู้ป่วยทั้งหมด'}
        >
          <div className="ltc-stat-label">ผู้ป่วยในทะเบียน LTC ทั้งหมด</div>
          <div className="ltc-stat-val">{stats.total.toLocaleString('th-TH')}</div>
          <div className="ltc-stat-sub">รายชื่อที่ขึ้นทะเบียนในระบบ</div>
        </button>

        <div className="ltc-stat-card">
          <div className="ltc-stat-label">คะแนน ADL เฉลี่ย</div>
          <div className="ltc-stat-val" style={{ color: '#0369a1' }}>
            {stats.avgAdl > 0 ? stats.avgAdl.toFixed(1) : '-'}
          </div>
          <div className="ltc-stat-sub">จากคะแนนเต็ม 20 คะแนน</div>
        </div>

        <button
          type="button"
          className={`ltc-stat-card ltc-stat-card-btn ${adlFilter === 'HOMEBOUND' ? 'is-active is-active-homebound' : ''}`}
          onClick={() => setAdlFilter((prev) => (prev === 'HOMEBOUND' ? 'ALL' : 'HOMEBOUND'))}
          aria-pressed={adlFilter === 'HOMEBOUND'}
          title={adlFilter === 'HOMEBOUND' ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะกลุ่มติดบ้าน (ADL 5-11)'}
        >
          <div className="ltc-stat-label">กลุ่มติดบ้าน (ADL 5-11)</div>
          <div className="ltc-stat-val" style={{ color: '#b45309' }}>
            {adlBreakdown.homebound.toLocaleString('th-TH')}
          </div>
          <div className="ltc-stat-sub">ช่วยเหลือตนเองได้ปานกลาง</div>
        </button>

        <button
          type="button"
          className={`ltc-stat-card ltc-stat-card-btn ${adlFilter === 'BEDRIDDEN' ? 'is-active is-active-bedridden' : ''}`}
          onClick={() => setAdlFilter((prev) => (prev === 'BEDRIDDEN' ? 'ALL' : 'BEDRIDDEN'))}
          aria-pressed={adlFilter === 'BEDRIDDEN'}
          title={adlFilter === 'BEDRIDDEN' ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะกลุ่มติดเตียง (ADL 0-4)'}
        >
          <div className="ltc-stat-label">กลุ่มติดเตียง (ADL 0-4)</div>
          <div className="ltc-stat-val" style={{ color: '#be123c' }}>
            {adlBreakdown.bedridden.toLocaleString('th-TH')}
          </div>
          <div className="ltc-stat-sub">พึ่งพาผู้อื่นอย่างสมบูรณ์</div>
        </button>
      </div>

      {/* 3. Filters & Search */}
      <div className="ltc-filters-bar">
        <div className="ltc-filters-left">
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
            <input
              type="text"
              placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, ตำบล..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="ltc-search-input"
              style={{ width: '100%', paddingLeft: '2.2rem' }}
            />
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ltc-muted)',
              }}
            />
          </div>

          <select
            value={selectedZone}
            onChange={(e) => {
              setSelectedZone(e.target.value)
              setPage(1)
            }}
            className="ltc-select"
            title="กรองตามเขตพื้นที่"
          >
            <option value="ALL">ทุกเขตพื้นที่รับผิดชอบ</option>
            {availableAreaZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="ltc-btn ltc-btn-secondary"
            onClick={() => fetchData()}
            title="รีเฟรชข้อมูล"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--ltc-muted)' }}>
          <span style={{ marginRight: '0.75rem', color: 'var(--ltc-accent)', fontWeight: 600 }}>
            • แก้ไขข้อมูลในช่องตารางแล้วกด Enter หรือคลิกออกเพื่อบันทึกอัตโนมัติ
          </span>
          แสดง {displayedItems.length} จากทั้งหมด {adlFilter === 'ALL' ? total : displayedItems.length} รายการ
        </div>
      </div>

      {/* 4. Table Card */}
      <div className="ltc-table-card">
        <div className="ltc-table-wrap">
          <table className="ltc-table is-sheet-mode">
            <thead>
              <tr>
                <th style={{ width: 45, textAlign: 'center' }}>ลำดับ</th>
                <th style={{ minWidth: 95, textAlign: 'center' }}>HN</th>
                <th style={{ minWidth: 145, textAlign: 'center' }}>เลขประจำตัวประชาชน</th>
                <th style={{ minWidth: 175 }}>ชื่อ นามสกุล</th>
                <th style={{ minWidth: 105 }}>บ้านเลขที่</th>
                <th style={{ minWidth: 60, textAlign: 'center' }}>หมู่</th>
                <th style={{ minWidth: 120 }}>ตำบล</th>
                <th style={{ minWidth: 65, textAlign: 'center' }}>อายุ</th>
                <th style={{ minWidth: 95, textAlign: 'center' }}>คะแนน ADL</th>
                <th style={{ minWidth: 150 }}>เขตพื้นที่</th>
                <th style={{ width: 65, textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ltc-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      กำลังดึงข้อมูลทะเบียน Long Term Care...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: '#be123c' }}>
                    <AlertCircle size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {error}
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--ltc-muted)' }}>
                    ไม่พบข้อมูลผู้ป่วยในทะเบียน Long Term Care (LTC) ตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, index) => (
                  <tr
                    key={item.id}
                    onDoubleClick={() => handleOpenEdit(item)}
                    title="ดับเบิลคลิกเพื่อเปิดการ์ดแก้ไข"
                  >
                    <td style={{ textAlign: 'center', color: 'var(--ltc-muted)', fontSize: '0.8rem' }}>
                      {(page - 1) * limit + index + 1}
                    </td>

                    {/* HN: click to open record edit modal */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="ltc-clickable-cell"
                        onClick={() => handleOpenEdit(item)}
                        title="คลิกเพื่อเปิดดูและแก้ไขทั้งเรคอร์ด"
                        style={{
                          fontWeight: 700,
                          fontFamily: 'ui-monospace, monospace',
                          color: 'var(--ltc-accent-dark)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {item.hn}
                      </span>
                    </td>

                    {/* CID */}
                    <td style={{ textAlign: 'center' }}>
                      <SheetInput
                        value={item.cid}
                        onSave={(val) => handleCellUpdate(item, 'cid', val)}
                        status={savingCells[`${item.id}-cid`]}
                        centered
                        placeholder="เลขบัตร 13 หลัก"
                        style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.825rem', textAlign: 'center' }}
                      />
                    </td>

                    {/* Patient Name */}
                    <td>
                      <SheetInput
                        value={item.patientName}
                        onSave={(val) => handleCellUpdate(item, 'patientName', val)}
                        status={savingCells[`${item.id}-patientName`]}
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* Address */}
                    <td>
                      <SheetInput
                        value={item.address}
                        onSave={(val) => handleCellUpdate(item, 'address', val)}
                        status={savingCells[`${item.id}-address`]}
                        placeholder="บ้านเลขที่"
                      />
                    </td>

                    {/* Moo */}
                    <td style={{ textAlign: 'center' }}>
                      <SheetInput
                        value={item.moo}
                        onSave={(val) => handleCellUpdate(item, 'moo', val)}
                        status={savingCells[`${item.id}-moo`]}
                        centered
                        style={{ textAlign: 'center', width: 45 }}
                        placeholder="หมู่"
                      />
                    </td>

                    {/* Tambon */}
                    <td>
                      <SheetInput
                        value={item.tambon}
                        onSave={(val) => handleCellUpdate(item, 'tambon', val)}
                        status={savingCells[`${item.id}-tambon`]}
                        placeholder="ตำบล"
                      />
                    </td>

                    {/* Age */}
                    <td style={{ textAlign: 'center' }}>
                      <SheetInput
                        type="number"
                        min={0}
                        max={150}
                        placeholder="-"
                        value={item.age}
                        onSave={(val) => handleCellUpdate(item, 'age', val)}
                        status={savingCells[`${item.id}-age`]}
                        centered
                        style={{ textAlign: 'center', width: 55 }}
                      />
                    </td>

                    {/* ADL Score */}
                    <td style={{ textAlign: 'center' }}>
                      <SheetInput
                        type="number"
                        min={0}
                        max={20}
                        placeholder="-"
                        value={item.adlScore}
                        onSave={(val) => handleCellUpdate(item, 'adlScore', val)}
                        status={savingCells[`${item.id}-adlScore`]}
                        centered
                        style={{ textAlign: 'center', width: 52, fontWeight: 700 }}
                        title={
                          item.adlScore !== null && item.adlScore !== undefined && String(item.adlScore).trim() !== ''
                            ? `คะแนน ADL: ${item.adlScore} (${getAdlCategoryText(item.adlScore)})`
                            : 'คะแนน ADL (0-20)'
                        }
                      />
                    </td>

                    {/* Area Zone */}
                    <td>
                      <SheetInput
                        value={item.areaZone}
                        onSave={(val) => handleCellUpdate(item, 'areaZone', val)}
                        status={savingCells[`${item.id}-areaZone`]}
                        placeholder="เช่น รพ.สต.ล้อมแรด"
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="ltc-btn ltc-btn-danger ltc-btn-sm"
                        onClick={() => setDeleteTarget(item)}
                        title="ลบเคสออกจากทะเบียน LTC"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="ltc-pagination">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>แสดงหน้าละ:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="ltc-select"
              style={{ width: 'auto', padding: '0.2rem 0.5rem', height: '28px', fontSize: '0.8rem' }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>รายการ • หน้า {page} จากทั้งหมด {totalPages} หน้า (ทั้งหมด {total} รายการ)</span>
          </div>

          {totalPages > 1 && (
            <div className="ltc-pagination-btns">
              <button
                type="button"
                className="ltc-btn ltc-btn-secondary ltc-btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} /> ก่อนหน้า
              </button>
              <button
                type="button"
                className="ltc-btn ltc-btn-secondary ltc-btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                ถัดไป <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. Add Patient Modal */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="ltc-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIsAddModalOpen(false)}>
          <div className="ltc-modal-card">
            <div className="ltc-modal-header">
              <h3 className="ltc-modal-title">เพิ่มผู้ป่วยขึ้นทะเบียน Long Term Care (LTC)</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ltc-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="ltc-modal-body">
                {/* HN Input & Lookup */}
                <div className="ltc-form-group">
                  <label className="ltc-form-label">หมายเลข HN *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="ltc-form-input"
                      placeholder="ระบุหมายเลข HN (เช่น 0001234)"
                      value={addForm.hn}
                      onChange={(e) => setAddForm({ ...addForm, hn: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleLookupHn(addForm.hn)
                        }
                      }}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="ltc-btn ltc-btn-secondary"
                      onClick={() => handleLookupHn(addForm.hn)}
                      disabled={isLookingUpHn || !addForm.hn.trim()}
                    >
                      {isLookingUpHn ? <RefreshCw size={14} className="animate-spin" /> : 'ดึงข้อมูล HOSxP'}
                    </button>
                  </div>
                </div>

                {/* Feedback banner */}
                {lookupFeedback && (
                  <div className={`ltc-feedback ltc-feedback-${lookupFeedback.type}`}>
                    {lookupFeedback.message}
                  </div>
                )}

                {/* Patient Name & CID */}
                <div className="ltc-form-row">
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">ชื่อ - นามสกุล *</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={addForm.patientName}
                      onChange={(e) => setAddForm({ ...addForm, patientName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">เลขประจำตัวประชาชน (CID)</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={addForm.cid}
                      onChange={(e) => setAddForm({ ...addForm, cid: e.target.value })}
                      placeholder="13 หลัก"
                    />
                  </div>
                </div>

                {/* Address, Moo, Tambon */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.2fr', gap: '0.75rem' }}>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">บ้านเลขที่</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={addForm.address}
                      onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      placeholder="เช่น 12/3"
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">หมู่</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={addForm.moo}
                      onChange={(e) => setAddForm({ ...addForm, moo: e.target.value })}
                      placeholder="เช่น 1"
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">ตำบล</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={addForm.tambon}
                      onChange={(e) => setAddForm({ ...addForm, tambon: e.target.value })}
                      placeholder="เช่น ล้อมแรด"
                    />
                  </div>
                </div>

                {/* Age, ADL Score, Area Zone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.75rem' }}>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">อายุ (ปี)</label>
                    <input
                      type="number"
                      className="ltc-form-input"
                      value={addForm.age}
                      onChange={(e) => setAddForm({ ...addForm, age: e.target.value })}
                      min="0"
                      max="150"
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">คะแนน ADL (0-20)</label>
                    <input
                      type="number"
                      className="ltc-form-input"
                      value={addForm.adlScore}
                      onChange={(e) => setAddForm({ ...addForm, adlScore: e.target.value })}
                      min="0"
                      max="20"
                      placeholder="0 - 20"
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">เขตพื้นที่รับผิดชอบ</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={addForm.areaZone}
                      onChange={(e) => setAddForm({ ...addForm, areaZone: e.target.value })}
                      placeholder="เช่น รพ.สต.ล้อมแรด, รพ.เถิน"
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>เกณฑ์ประเมิน Barthel ADL Index:</strong> ติดเตียง (0-4 คะแนน), ติดบ้าน (5-11 คะแนน), ติดสังคม (12-20 คะแนน)
                  <br />
                  <span style={{ color: '#0369a1' }}>
                    * ผู้ป่วยที่ขึ้นทะเบียนใน LTC แล้ว จะไม่สามารถเพิ่มลงในทะเบียน Palliative Care ได้
                  </span>
                </div>
              </div>

              <div className="ltc-modal-footer">
                <button
                  type="button"
                  className="ltc-btn ltc-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="ltc-btn ltc-btn-primary"
                  disabled={isSubmittingAdd || isDuplicateInLtc || !addForm.hn.trim() || !addForm.patientName.trim()}
                >
                  {isSubmittingAdd
                    ? 'กำลังบันทึก...'
                    : isDuplicateInLtc
                    ? 'มีในทะเบียน LTC แล้ว'
                    : 'บันทึกขึ้นทะเบียน LTC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. Edit Patient Modal */}
      {/* ======================================================== */}
      {isEditModalOpen && editRecord && (
        <div className="ltc-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIsEditModalOpen(false)}>
          <div className="ltc-modal-card">
            <div className="ltc-modal-header">
              <h3 className="ltc-modal-title">แก้ไขข้อมูลทะเบียน LTC: HN {editRecord.hn}</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ltc-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="ltc-modal-body">
                {/* HOSxP Sync Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.85rem',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', color: '#0369a1' }}>
                    <strong>HN: {editRecord.hn}</strong> • ตรวจเทียบและดึงข้อมูลจาก HOSxP
                  </div>
                  <button
                    type="button"
                    className="ltc-btn ltc-btn-secondary ltc-btn-sm"
                    onClick={async () => {
                      setIsSyncingModalPt(true)
                      try {
                        const res = await fetch(
                          `/api/service/dashboard-rcm/palliative-care/ltc-registry/lookup-hn?hn=${encodeURIComponent(editRecord.hn)}`
                        )
                        const json = await res.json()
                        if (json.success && json.data) {
                          const pt = json.data
                          setEditForm((prev) => ({
                            ...prev,
                            cid: pt.cid || prev.cid,
                            patientName: pt.patientName || prev.patientName,
                            address: pt.address || prev.address,
                            moo: pt.moo || prev.moo,
                            tambon: pt.tambon || prev.tambon,
                            age: pt.age !== null && pt.age !== undefined ? String(pt.age) : prev.age,
                          }))
                          showToast(`ดึงข้อมูล HN: ${editRecord.hn} จาก HOSxP เรียบร้อยแล้ว`)
                        } else {
                          showToast('ไม่พบข้อมูลผู้ป่วยรายนี้ใน HOSxP', 'error')
                        }
                      } catch (err: any) {
                        showToast(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก HOSxP', 'error')
                      } finally {
                        setIsSyncingModalPt(false)
                      }
                    }}
                    disabled={isSyncingModalPt}
                    title="ดึงข้อมูลเลขบัตรประชาชน ชื่อ ที่อยู่ และอายุล่าสุดจากระบบ HOSxP"
                  >
                    <RefreshCw size={12} className={isSyncingModalPt ? 'animate-spin' : ''} />
                    {isSyncingModalPt ? 'กำลังดึง...' : 'ดึงข้อมูลล่าสุดจาก HOSxP'}
                  </button>
                </div>

                <div className="ltc-form-row">
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">ชื่อ - นามสกุล *</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={editForm.patientName}
                      onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">เลขประจำตัวประชาชน (CID)</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={editForm.cid}
                      onChange={(e) => setEditForm({ ...editForm, cid: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.2fr', gap: '0.75rem' }}>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">บ้านเลขที่</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">หมู่</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={editForm.moo}
                      onChange={(e) => setEditForm({ ...editForm, moo: e.target.value })}
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">ตำบล</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={editForm.tambon}
                      onChange={(e) => setEditForm({ ...editForm, tambon: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.75rem' }}>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">อายุ (ปี)</label>
                    <input
                      type="number"
                      className="ltc-form-input"
                      value={editForm.age}
                      onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                      min="0"
                      max="150"
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">คะแนน ADL (0-20)</label>
                    <input
                      type="number"
                      className="ltc-form-input"
                      value={editForm.adlScore}
                      onChange={(e) => setEditForm({ ...editForm, adlScore: e.target.value })}
                      min="0"
                      max="20"
                    />
                  </div>
                  <div className="ltc-form-group">
                    <label className="ltc-form-label">เขตพื้นที่รับผิดชอบ</label>
                    <input
                      type="text"
                      className="ltc-form-input"
                      value={editForm.areaZone}
                      onChange={(e) => setEditForm({ ...editForm, areaZone: e.target.value })}
                      placeholder="เช่น รพ.สต.ล้อมแรด"
                    />
                  </div>
                </div>
              </div>

              <div className="ltc-modal-footer">
                <button
                  type="button"
                  className="ltc-btn ltc-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="ltc-btn ltc-btn-primary"
                  disabled={isSubmittingEdit || !editForm.patientName.trim()}
                >
                  {isSubmittingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. Delete Confirmation Dialog */}
      {/* ======================================================== */}
      {deleteTarget && (
        <div className="ltc-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="ltc-modal-card" style={{ maxWidth: 440 }}>
            <div className="ltc-modal-header" style={{ borderBottomColor: '#fee2e2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#be123c' }}>
                <ShieldAlert size={20} />
                <h3 className="ltc-modal-title" style={{ color: '#be123c' }}>ยืนยันการลบข้อมูล</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ltc-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ltc-modal-body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ltc-ink-2)', lineHeight: 1.5 }}>
                คุณต้องการลบข้อมูลผู้ป่วย <strong>{deleteTarget.patientName}</strong> (HN: <strong>{deleteTarget.hn}</strong>) ออกจากทะเบียน Long Term Care (LTC) ใช่หรือไม่?
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#be123c' }}>
                การกระทำนี้จะถูกบันทึกใน Audit Log และไม่สามารถย้อนคืนได้
              </p>
            </div>

            <div className="ltc-modal-footer">
              <button
                type="button"
                className="ltc-btn ltc-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="ltc-btn ltc-btn-danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {toastNotice && (

        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            backgroundColor: toastNotice.type === 'success' ? '#0f172a' : '#991b1b',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            zIndex: 2000,
          }}
        >
          {toastNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toastNotice.message}
        </div>
      )}
    </div>
  )
}
