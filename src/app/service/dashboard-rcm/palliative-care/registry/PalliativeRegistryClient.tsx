'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
import {
  PalliativeRegistryItem,
  RegistryStats,
  VisitRepItem,
  ColorCounts,
  calculateFiscalYear,
  getItemFiscalYear,
} from '@/lib/clinical/palliativeRegistryService'
import { formatThaiDate } from '@/lib/formatters'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

export interface PalliativeRegistryClientProps {
  userRole?: string
  username?: string
  initialData?: any | null
}

const PROJECT_CODE_PRESETS = [
  '30001, Cons01',
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

interface RepAmountBadgeProps {
  rep?: string | null
  compensated?: number | string | null
  reason?: string | null
  source?: string | null
}

export function RepAmountBadge({
  rep,
  compensated,
  reason,
  source,
}: RepAmountBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const amount = Number(compensated || 0)
  const isPaid = amount > 0
  const amountStr = `${amount.toLocaleString()} ฿`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !isExpanded
    setIsExpanded(next)

    if (rep && next) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(rep).then(() => {
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
          }).catch(() => {})
        }
      } catch {
        // ignore
      }
    }
  }

  return (
    <button
      type="button"
      className={`pcr-rep-badge ${isPaid ? 'pcr-rep-paid' : 'pcr-rep-zero'}`}
      onClick={handleClick}
      title={
        isExpanded
          ? 'คลิกเพื่อย่อ'
          : `เลขที่หนังสือ (Rep): ${rep || '-'}${reason ? `\nสาเหตุ: ${reason}` : ''}${source ? `\nแหล่งข้อมูล: ${source}` : ''}\n(คลิกเพื่อดูและคัดลอกเลข Rep)`
      }
      aria-expanded={isExpanded}
    >
      <span className="pcr-rep-amount">{amountStr}</span>
      {isExpanded && (
        <span className="pcr-rep-detail">
          Rep: {rep || '-'}
          {isCopied ? ' (คัดลอกแล้ว)' : ''}
          {reason ? ` (${reason})` : ''}
        </span>
      )}
    </button>
  )
}

function EditableVisitCell({
  item,
  visitNum,
  canEdit,
  onSaveDate,
}: EditableVisitCellProps) {
  const visitObj = item.visits?.find((v) => v.visitNo === visitNum)
  const date = visitObj?.visitDate || (visitNum <= 6 ? (item as any)[`visit${visitNum}Date`] : '') || ''
  const rep = visitObj?.rep || (visitNum <= 6 ? (item as any)[`visit${visitNum}Rep`] : '') || ''
  const compensated =
    visitObj !== undefined && visitObj.compensated !== undefined
      ? visitObj.compensated
      : visitNum <= 6
        ? (item as any)[`visit${visitNum}Compensated`]
        : 0
  const reason = visitObj?.reason || (visitNum <= 6 ? (item as any)[`visit${visitNum}Reason`] : '') || ''
  const repItems = (
    Array.isArray(visitObj?.repItems)
      ? visitObj?.repItems
      : Array.isArray((item as any)[`visit${visitNum}RepItems`])
        ? (item as any)[`visit${visitNum}RepItems`]
        : []
  ) as VisitRepItem[]

  // Pick latest Rep
  const latestRep = repItems.length > 0 ? repItems[0] : null
  const displayRep = latestRep?.rep || rep || ''
  const displayComp = latestRep !== null ? latestRep.compensated : compensated
  const displayReason = latestRep?.reason || reason || ''
  const displaySource = latestRep?.source

  const hasComp = displayComp !== undefined && displayComp !== null && Number(displayComp) > 0
  const hasRep = Boolean(displayRep || hasComp)

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
        date && <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatThaiDate(date)}</div>
      )}

      {date ? (
        hasRep ? (
          <RepAmountBadge
            rep={displayRep}
            compensated={displayComp}
            reason={displayReason}
            source={displaySource}
          />
        ) : (
          <span className="pcr-rep-badge pcr-rep-pending" title="ยังไม่พบข้อมูลในระบบชดเชย RCM">
            รอผลชดเชย
          </span>
        )
      ) : (
        !canEdit && <span style={{ color: 'var(--pc-muted)', fontSize: '0.75rem' }}>-</span>
      )}

      {displayReason && !displayRep && (
        <span className="pcr-remark-badge" title={`เหตุผล: ${displayReason}`}>
          {displayReason}
        </span>
      )}
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
      title={isDeceased ? `ผู้ป่วยเสียชีวิต: ${formatThaiDate(date)}` : undefined}
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
        <span className="pcr-death-chip">{formatThaiDate(date)}</span>
      ) : (
        '-'
      )}
    </td>
  )
}

export default function PalliativeRegistryClient({
  userRole = 'staff',
  username = '',
  initialData,
}: PalliativeRegistryClientProps) {
  // Data state
  const [items, setItems] = useState<PalliativeRegistryItem[]>(initialData?.items || [])
  const [stats, setStats] = useState<RegistryStats>(
    initialData?.stats || {
      total: 0,
      registered: 0,
      pendingRegistration: 0,
      claimed: 0,
      paid: 0,
      waitingComp: 0,
      deceased: 0,
      deny: 0,
    }
  )
  const [colorCounts, setColorCounts] = useState<ColorCounts>(
    initialData?.colorCounts || {
      total: 0,
      green: 0,
      orange: 0,
      orangeWaitingRep: 0,
      pink: 0,
    }
  )
  const [serverFiscalYears, setServerFiscalYears] = useState<number[]>(initialData?.availableFiscalYears || [])
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState(
    initialData?.permissions || {
      canView: true,
      canEdit: userRole === 'admin',
      canManage: userRole === 'admin',
    }
  )

  // Filter & Search states
  const [search, setSearch] = useState('')
  const [filterFiscalYear, setFilterFiscalYear] = useState('ALL')
  const [filterRegStatus, setFilterRegStatus] = useState('ALL')
  const [filterColor, setFilterColor] = useState('ALL')
  const [filterCompAmount, setFilterCompAmount] = useState('ALL')
  const [filterCompVisits, setFilterCompVisits] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 1)
  const [totalCount, setTotalCount] = useState(initialData?.total || 0)
  const isFirstMount = useRef(true)

  // Modal 1: Add New Patient (Initial Intake Fields)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    hn: '',
    patientName: '',
    address: '',
    phone: '',
    icd10Principal: '',
    icd10Palliative: 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
    projectCode: '30001, Cons01',
    registrationStatus: 'ยังไม่ได้ดำเนินการ',
    deathDate: '',
  })
  const [isLookingUpHn, setIsLookingUpHn] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [lookupFeedback, setLookupFeedback] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Modal 2: Edit / Follow-up Visits Modal
  const [editingItem, setEditingItem] = useState<PalliativeRegistryItem | null>(null)
  const [editForm, setEditForm] = useState<Partial<PalliativeRegistryItem>>({})
  const [editVisits, setEditVisits] = useState<
    Array<{
      visitNo: number
      visitDate: string
      rep?: string | null
      compensated?: number
      reason?: string | null
      repItems?: VisitRepItem[]
    }>
  >([])
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
  const handleLookupHn = useCallback(async (hnToSearch?: string) => {
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
        icd10Principal: data.icd10Principal || prev.icd10Principal,
        registrationStatus: data.isRegistered ? 'ดำเนินการเรียบร้อย' : 'ยังไม่ได้ดำเนินการ',
        deathDate: data.deathDate || prev.deathDate,
      }))

      // Check if patient is in LTC
      if (data.isLtc) {
        setIsDuplicate(true)
        setLookupFeedback({
          type: 'error',
          message:
            data.ltcMessage ||
            `⚠️ ผู้ป่วยรายนี้ (HN: ${data.hn} - ${data.patientName}) มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้`,
        })
        return
      }

      // Check if patient or AN is already in registry
      const alreadyInTable = items.some(
        (it) => it.hn.trim() === String(data.hn).trim() || (data.an && it.an && it.an.trim() === String(data.an).trim())
      )

      if (data.isAlreadyInRegistry || alreadyInTable) {
        setIsDuplicate(true)
        const anText = data.an ? `AN: ${data.an} / ` : ''
        setLookupFeedback({
          type: 'error',
          message: `⚠️ ผู้ป่วยรายนี้ (${anText}HN: ${data.hn} - ${data.patientName}) มีอยู่ในระบบทะเบียนแล้ว ห้ามลงข้อมูลซ้ำ`,
        })
      } else {
        setIsDuplicate(false)
        const anMsg = data.an ? ` | AN: ${data.an}` : ''
        const dxMsg = data.icd10Principal ? ` | โรคหลัก: ${data.icd10Principal}` : ''
        if (data.isRegistered) {
          setLookupFeedback({
            type: 'success',
            message: `✓ พบใน HOSxP คลินิก Palliative Care (ขึ้นทะเบียน: ${formatThaiDate(data.registeredDate, '-')})${anMsg}${dxMsg}`,
          })
        } else {
          setLookupFeedback({
            type: 'warning',
            message: `ℹ พบข้อมูลผู้ป่วยใน HOSxP (ยังไม่ได้ขึ้นทะเบียน Palliative Care)${anMsg}${dxMsg}`,
          })
        }
      }
    } catch (err: any) {
      setLookupFeedback({
        type: 'error',
        message: 'เชื่อมต่อ HOSxP ไม่สำเร็จ กรุณากรอกข้อมูลเอง',
      })
    } finally {
      setIsLookingUpHn(false)
    }
  }, [addForm.hn, items])

  // Auto-open Add Modal and prefill/lookup if 'addHn' or 'hn' param is present in URL
  const searchParams = useSearchParams()
  const handledHnParamRef = useRef<string | null>(null)

  useEffect(() => {
    let targetHn = searchParams?.get('addHn') || searchParams?.get('hn') || null
    if (!targetHn && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      targetHn = urlParams.get('addHn') || urlParams.get('hn') || null
    }

    if (!targetHn) return
    const trimmedHn = targetHn.trim()
    if (!trimmedHn || handledHnParamRef.current === trimmedHn) return

    handledHnParamRef.current = trimmedHn
    setIsAddModalOpen(true)
    setAddForm((prev) => ({ ...prev, hn: trimmedHn }))
    handleLookupHn(trimmedHn)
  }, [searchParams, handleLookupHn])

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

  // Handle Google Sheets Inline Visit Save (any visit 1..N)
  const handleVisitSave = async (
    item: PalliativeRegistryItem,
    visitNum: number,
    newDate: string
  ) => {
    const currentVisits = item.visits ? [...item.visits] : []
    const existingIdx = currentVisits.findIndex((v) => v.visitNo === visitNum)
    let nextVisits: Array<{
      visitNo: number
      visitDate: string
      rep?: string | null
      compensated?: number
      reason?: string | null
      repItems?: VisitRepItem[]
    }>

    if (newDate.trim()) {
      if (existingIdx >= 0) {
        nextVisits = currentVisits.map((v) =>
          v.visitNo === visitNum ? { ...v, visitDate: newDate.trim() } : v
        )
      } else {
        nextVisits = [...currentVisits, { visitNo: visitNum, visitDate: newDate.trim() }].sort(
          (a, b) => a.visitNo - b.visitNo
        )
      }
    } else {
      if (existingIdx >= 0) {
        nextVisits = currentVisits.filter((v) => v.visitNo !== visitNum)
      } else {
        nextVisits = currentVisits
      }
    }

    const fieldKey = `visit${visitNum}Date`

    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it
        const updated: any = {
          ...it,
          visits: nextVisits,
        }
        if (visitNum <= 6) {
          updated[fieldKey] = newDate.trim() || null
        }
        return updated
      })
    )
    setSaveStatus('saving')
    setJustSavedCell({ id: item.id, field: fieldKey })

    try {
      const payload: any = {
        visits: nextVisits.map((v) => ({ visitNo: v.visitNo, visitDate: v.visitDate })),
      }
      if (visitNum <= 6) {
        payload[fieldKey] = newDate.trim() || null
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      setSaveStatus('saved')

      // Quietly update stats in background
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
          current?.id === item.id && current?.field === fieldKey ? null : current
        )
      }, 1500)
    }
  }

  const abortRef = useRef<AbortController | null>(null)

  // Fetch list with Server-side Two-Tier Query Architecture
  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      if (filterFiscalYear !== 'ALL') q.set('fiscalYear', filterFiscalYear)
      if (filterRegStatus !== 'ALL') q.set('registrationStatus', filterRegStatus)
      if (filterColor !== 'ALL') q.set('color', filterColor)
      if (filterCompAmount !== 'ALL') q.set('compAmount', filterCompAmount)
      if (filterCompVisits !== 'ALL') q.set('compVisits', filterCompVisits)
      q.set('page', page.toString())
      q.set('limit', '50')

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry?${q.toString()}`, {
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลทะเบียนได้')
      }

      setItems(data.items || [])
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.total || 0)
      if (data.stats) setStats(data.stats)
      if (data.colorCounts) setColorCounts(data.colorCounts)
      if (Array.isArray(data.availableFiscalYears) && data.availableFiscalYears.length > 0) {
        setServerFiscalYears(data.availableFiscalYears)
      }
      if (data.permissions) setPermissions(data.permissions)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [search, filterFiscalYear, filterRegStatus, filterColor, filterCompAmount, filterCompVisits, page])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
    return () => abortRef.current?.abort()
  }, [fetchData, initialData])

  // Active Thai Fiscal Year (e.g., Nov 2026 -> 2570)
  const activeFiscalYear = useMemo(() => {
    const now = new Date()
    const ceYear = now.getFullYear()
    const m = now.getMonth() + 1
    const be = ceYear + 543
    return m >= 10 ? be + 1 : be
  }, [])

  // Dynamic available fiscal years from entire registry database
  const availableFiscalYears = useMemo(() => {
    if (serverFiscalYears.length > 0) return serverFiscalYears
    return [activeFiscalYear, activeFiscalYear - 1, activeFiscalYear - 2]
  }, [serverFiscalYears, activeFiscalYear])

  // Items are already filtered and paginated server-side
  const displayedItems = items

  // Dynamic maximum visits across displayed items (minimum 6)
  const maxVisits = useMemo(() => {
    let max = 6
    for (const item of displayedItems) {
      if (item.visits && item.visits.length > 0) {
        for (const v of item.visits) {
          if (
            v.visitNo > max &&
            (Boolean(v.visitDate?.trim()) || Boolean(v.rep) || (v.compensated ?? 0) > 0)
          ) {
            max = v.visitNo
          }
        }
      }
    }
    return max
  }, [displayedItems])

  // Array of visit numbers [1..maxVisits]
  const visitNumbers = useMemo(() => {
    const list: number[] = []
    for (let i = 1; i <= maxVisits; i++) {
      list.push(i)
    }
    return list
  }, [maxVisits])

  // Lock background scrolling when any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(isAddModalOpen || editingItem || deletingItem)
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isAddModalOpen, editingItem, deletingItem])

  // Handle Add Form Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.hn.trim()) {
      setAddError('กรุณาระบุ HN ผู้ป่วย')
      return
    }

    if (isDuplicate) {
      setAddError('ผู้ป่วยรายนี้มีข้อมูลในทะเบียนแล้ว ห้ามลงข้อมูลซ้ำ')
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
      setIsDuplicate(false)
      setAddForm({
        hn: '',
        patientName: '',
        address: '',
        phone: '',
        icd10Principal: '',
        icd10Palliative: 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
        projectCode: '30001, Cons01',
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

    const initialVisits: Array<{
      visitNo: number
      visitDate: string
      rep?: string | null
      compensated?: number
      reason?: string | null
      repItems?: VisitRepItem[]
    }> = []

    const existingVisits = item.visits && item.visits.length > 0 ? item.visits : []
    const maxVisitNo = Math.max(6, ...existingVisits.map((v) => v.visitNo))

    for (let v = 1; v <= maxVisitNo; v++) {
      const found = existingVisits.find((ev) => ev.visitNo === v)
      if (found) {
        initialVisits.push({ ...found })
      } else if (v <= 6) {
        initialVisits.push({
          visitNo: v,
          visitDate: (item as any)[`visit${v}Date`] || '',
          rep: (item as any)[`visit${v}Rep`] || null,
          compensated: (item as any)[`visit${v}Compensated`] || 0,
          reason: (item as any)[`visit${v}Reason`] || null,
          repItems: (item as any)[`visit${v}RepItems`] || [],
        })
      } else {
        initialVisits.push({
          visitNo: v,
          visitDate: '',
        })
      }
    }
    setEditVisits(initialVisits)
  }

  const handleVisitDateChange = (visitNo: number, value: string) => {
    setEditVisits((prev) =>
      prev.map((v) => (v.visitNo === visitNo ? { ...v, visitDate: value } : v))
    )
  }

  const handleAddVisit = () => {
    setEditVisits((prev) => {
      const nextNo = prev.length + 1
      return [...prev, { visitNo: nextNo, visitDate: '' }]
    })
  }

  const handleRemoveVisit = (visitNo: number) => {
    setEditVisits((prev) => {
      if (visitNo <= 6) return prev
      const filtered = prev.filter((v) => v.visitNo !== visitNo)
      return filtered.map((v, idx) => ({ ...v, visitNo: idx + 1 }))
    })
  }

  // Handle Edit Form Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    setIsSubmittingEdit(true)
    setEditError(null)

    try {
      const visitsPayload = editVisits
        .filter((v) => v.visitDate && v.visitDate.trim())
        .map((v) => ({ visitNo: v.visitNo, visitDate: v.visitDate.trim() }))

      const vMap = new Map<number, string>()
      editVisits.forEach((v) => {
        if (v.visitDate && v.visitDate.trim()) vMap.set(v.visitNo, v.visitDate.trim())
      })

      const submitData = {
        ...editForm,
        visit1Date: vMap.get(1) || null,
        visit2Date: vMap.get(2) || null,
        visit3Date: vMap.get(3) || null,
        visit4Date: vMap.get(4) || null,
        visit5Date: vMap.get(5) || null,
        visit6Date: vMap.get(6) || null,
        visits: visitsPayload,
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
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

  // Export CSV/Excel across ALL filtered items
  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      if (filterFiscalYear !== 'ALL') q.set('fiscalYear', filterFiscalYear)
      if (filterRegStatus !== 'ALL') q.set('registrationStatus', filterRegStatus)
      if (filterColor !== 'ALL') q.set('color', filterColor)
      if (filterCompAmount !== 'ALL') q.set('compAmount', filterCompAmount)
      if (filterCompVisits !== 'ALL') q.set('compVisits', filterCompVisits)
      q.set('exportAll', 'true')

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/registry?${q.toString()}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')
      }

      const exportItems: PalliativeRegistryItem[] = data.items || []
      if (exportItems.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก')
        return
      }

      let exportMaxVisits = 6
      for (const item of exportItems) {
        if (item.visits && item.visits.length > 0) {
          for (const v of item.visits) {
            if (
              v.visitNo > exportMaxVisits &&
              (Boolean(v.visitDate?.trim()) || Boolean(v.rep) || (v.compensated ?? 0) > 0)
            ) {
              exportMaxVisits = v.visitNo
            }
          }
        }
      }

      const visitHeaders: string[] = []
      for (let n = 1; n <= exportMaxVisits; n++) {
        visitHeaders.push(`วันเยี่ยมครั้งที่ ${n}`, `Rep เยี่ยม ${n}`, `ชดเชย เยี่ยม ${n} (บาท)`)
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
        'สถานะการขึ้นทะเบียน Palliative Care',
        'วันที่ขึ้นทะเบียน Palliative Care',
        ...visitHeaders,
        'วันที่เสียชีวิต',
      ]

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""'
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      }

      const formatVisitRep = (itemsList?: VisitRepItem[], fallbackRep?: string | null) => {
        if (itemsList && itemsList.length > 0) {
          return itemsList[0].rep
        }
        return fallbackRep || ''
      }

      const formatVisitComp = (itemsList?: VisitRepItem[], fallbackComp?: number | null) => {
        if (itemsList && itemsList.length > 0) {
          return itemsList[0].compensated
        }
        return fallbackComp ?? 0
      }

      const rows = exportItems.map((item, idx) => {
        const visitCols: any[] = []
        for (let n = 1; n <= exportMaxVisits; n++) {
          const visitObj = item.visits?.find((v) => v.visitNo === n)
          const date =
            visitObj?.visitDate || (n <= 6 ? (item as any)[`visit${n}Date`] : '') || ''
          const rep = visitObj?.rep || (n <= 6 ? (item as any)[`visit${n}Rep`] : '') || ''
          const comp =
            visitObj !== undefined && visitObj.compensated !== undefined
              ? visitObj.compensated
              : n <= 6
                ? (item as any)[`visit${n}Compensated`]
                : 0
          const repItems = (
            Array.isArray(visitObj?.repItems)
              ? visitObj?.repItems
              : Array.isArray((item as any)[`visit${n}RepItems`])
                ? (item as any)[`visit${n}RepItems`]
                : []
          ) as VisitRepItem[]

          const displayRep = formatVisitRep(repItems, rep)
          const displayComp = formatVisitComp(repItems, comp)

          visitCols.push(
            date,
            displayRep,
            displayComp
          )
        }

        return [
          idx + 1,
          item.hn,
          item.patientName,
          item.address,
          item.phone,
          item.icd10Principal,
          item.icd10Palliative,
          item.projectCode,
          item.registeredDate ? 'ขึ้นทะเบียนแล้ว' : item.registrationStatus,
          item.registeredDate || '',
          ...visitCols,
          item.deathDate || '',
        ]
      })

      const fySuffix = filterFiscalYear !== 'ALL' ? `_FY${filterFiscalYear}` : ''
      await exportRcmExcel({
        filename: `Palliative_Care_Registry${fySuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        title: 'ทะเบียนผู้ป่วย Palliative Care โรงพยาบาลเถิน',
        subtitle: `ปีงบประมาณ: ${filterFiscalYear !== 'ALL' ? filterFiscalYear : 'ทั้งหมด'} | วันที่ส่งออก: ${new Date().toLocaleDateString('th-TH')}`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์')
    } finally {
      setIsExporting(false)
    }
  }

  const canEdit = permissions.canEdit || permissions.canManage

  // Card click filtering handlers & active state checks
  const handleCardClick = (
    cardType: 'total' | 'registered' | 'pending' | 'paid' | 'waiting' | 'deceased'
  ) => {
    setPage(1)
    if (cardType === 'total') {
      setFilterRegStatus('ALL')
      setFilterColor('ALL')
    } else if (cardType === 'registered') {
      setFilterRegStatus((prev) => (prev === 'ดำเนินการเรียบร้อย' ? 'ALL' : 'ดำเนินการเรียบร้อย'))
      setFilterColor('ALL')
    } else if (cardType === 'pending') {
      setFilterRegStatus((prev) => (prev === 'ยังไม่ได้ดำเนินการ' ? 'ALL' : 'ยังไม่ได้ดำเนินการ'))
      setFilterColor('ALL')
    } else if (cardType === 'paid') {
      setFilterColor((prev) => (prev === 'GREEN' ? 'ALL' : 'GREEN'))
      setFilterRegStatus('ALL')
    } else if (cardType === 'waiting') {
      setFilterColor((prev) => (prev === 'ORANGE' ? 'ALL' : 'ORANGE'))
      setFilterRegStatus('ALL')
    } else if (cardType === 'deceased') {
      setFilterColor((prev) => (prev === 'PINK' ? 'ALL' : 'PINK'))
      setFilterRegStatus('ALL')
    }
  }

  const isTotalActive = filterRegStatus === 'ALL' && filterColor === 'ALL'
  const isRegisteredActive = filterRegStatus === 'ดำเนินการเรียบร้อย'
  const isPendingActive = filterRegStatus === 'ยังไม่ได้ดำเนินการ'
  const isPaidActive = filterColor === 'GREEN'
  const isWaitingActive = filterColor === 'ORANGE'
  const isDeceasedActive = filterColor === 'PINK'
  const hasActiveFilters = Boolean(
    search.trim() ||
      filterFiscalYear !== 'ALL' ||
      filterColor !== 'ALL' ||
      filterRegStatus !== 'ALL' ||
      filterCompAmount !== 'ALL' ||
      filterCompVisits !== 'ALL'
  )

  const handleClearAllFilters = () => {
    setSearch('')
    setFilterFiscalYear('ALL')
    setFilterColor('ALL')
    setFilterRegStatus('ALL')
    setFilterCompAmount('ALL')
    setFilterCompVisits('ALL')
    setPage(1)
  }

  return (
    <div className="pcr-container">
      {/* 0. Back link & Registry Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <Link href="/service/dashboard-rcm/palliative-care/pc-1" className="pcr-back-link">
          ← กลับแดชบอร์ด Palliative Care
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--pc-surface)', padding: '0.35rem', borderRadius: 10, border: '1px solid var(--pc-border)' }}>
          <Link
            href="/service/dashboard-rcm/palliative-care/registry"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--pc-accent-dark)',
              background: 'var(--pc-accent-tint)',
              borderRadius: 7,
              textDecoration: 'none',
            }}
          >
            ทะเบียน Palliative Care
          </Link>
          <Link
            href="/service/dashboard-rcm/palliative-care/ltc-registry"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--pc-muted)',
              borderRadius: 7,
              textDecoration: 'none',
            }}
          >
            ทะเบียน Long Term Care (LTC)
          </Link>
        </div>
      </div>

      {/* 1. Header */}
      <div className="pcr-header">
        <div>
          <div className="pcr-title-wrap">
            <h1 className="pcr-title">ทะเบียน Palliative Care</h1>
            <span className="pcr-badge">REGISTRY</span>
          </div>
          <p className="pcr-desc">
            ระบบบันทึกและติดตามทะเบียนผู้ป่วย Palliative Care, ตรวจสอบคลินิก Palliative Care อัตโนมัติจาก HOSxP, ติดตามเยี่ยมบ้าน 1-6 และผลชดเชย Rep
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
            disabled={isExporting}
            title="ส่งออกไฟล์ Excel / CSV ทั้งหมดตาม Filter"
          >
            {isExporting ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}
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

      {/* 3. Consolidated Executive Metric Strip (Interactive Cards) */}
      <div className="pcr-metric-strip" role="region" aria-label="สรุปสถิติผู้ป่วยและตัวกรองด่วน">
        <button
          type="button"
          className={`pcr-metric-cell pcr-metric-cell-btn ${isTotalActive ? 'is-active is-active-total' : ''}`}
          onClick={() => handleCardClick('total')}
          title={isTotalActive ? 'แสดงผู้ป่วยทั้งหมด' : 'คลิกเพื่อดูผู้ป่วยทั้งหมด'}
          aria-pressed={isTotalActive}
        >
          <span className="pcr-metric-label">
            ผู้ป่วยในทะเบียน{filterFiscalYear !== 'ALL' ? ` (ปีงบ ${filterFiscalYear})` : 'ทั้งหมด'}
          </span>
          <span className="pcr-metric-val">
            {stats.total.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </button>

        <button
          type="button"
          className={`pcr-metric-cell pcr-metric-cell-btn ${isRegisteredActive ? 'is-active is-active-registered' : ''}`}
          onClick={() => handleCardClick('registered')}
          title={isRegisteredActive ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะผู้ป่วยที่ขึ้นทะเบียนแล้ว'}
          aria-pressed={isRegisteredActive}
        >
          <span className="pcr-metric-label">ขึ้นทะเบียน Palliative Care แล้ว</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-teal-text)' }}>
            {stats.registered.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </button>

        <button
          type="button"
          className={`pcr-metric-cell pcr-metric-cell-btn ${isPendingActive ? 'is-active is-active-pending' : ''}`}
          onClick={() => handleCardClick('pending')}
          title={isPendingActive ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะผู้ป่วยที่ยังไม่ขึ้นทะเบียน'}
          aria-pressed={isPendingActive}
        >
          <span className="pcr-metric-label">ยังไม่ขึ้นทะเบียน Palliative Care</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-amber-text)' }}>
            {stats.pendingRegistration.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </button>

        <button
          type="button"
          className={`pcr-metric-cell pcr-metric-cell-btn ${isPaidActive ? 'is-active is-active-paid' : ''}`}
          onClick={() => handleCardClick('paid')}
          title={isPaidActive ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะผู้ป่วยที่ได้รับเงินชดเชยแล้ว'}
          aria-pressed={isPaidActive}
        >
          <span className="pcr-metric-label">ได้รับเงินชดเชยแล้ว</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-teal-text)' }}>
            {stats.paid.toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </button>

        <button
          type="button"
          className={`pcr-metric-cell pcr-metric-cell-btn ${isWaitingActive ? 'is-active is-active-waiting' : ''}`}
          onClick={() => handleCardClick('waiting')}
          title={isWaitingActive ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะผู้ป่วยที่รอผลชดเชย'}
          aria-pressed={isWaitingActive}
        >
          <span className="pcr-metric-label">รอผลชดเชย</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-amber-text)' }}>
            {(stats.waitingComp ?? 0).toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </button>

        <button
          type="button"
          className={`pcr-metric-cell pcr-metric-cell-btn ${isDeceasedActive ? 'is-active is-active-deceased' : ''}`}
          onClick={() => handleCardClick('deceased')}
          title={isDeceasedActive ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะผู้ป่วยที่เสียชีวิต'}
          aria-pressed={isDeceasedActive}
        >
          <span className="pcr-metric-label">ผู้ป่วยเสียชีวิต</span>
          <span className="pcr-metric-val" style={{ color: 'var(--pc-rose-text)' }}>
            {(stats.deceased ?? 0).toLocaleString()}
            <span className="pcr-metric-unit">คน</span>
          </span>
        </button>
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

        {/* Fiscal Year Filter Dropdown */}
        <select
          className="pcr-select"
          value={filterFiscalYear}
          onChange={(e) => {
            setFilterFiscalYear(e.target.value)
            setPage(1)
          }}
          aria-label="เลือกปีงบประมาณ"
        >
          <option value="ALL">ปีงบประมาณ: ทั้งหมด</option>
          {availableFiscalYears.map((fy) => (
            <option key={fy} value={String(fy)}>
              ปีงบประมาณ {fy}
            </option>
          ))}
        </select>

        {/* Compensation & Status Filter Dropdown (No color names, no decorative icons, uniform flush-left alignment) */}
        <select
          className="pcr-select"
          value={filterColor}
          onChange={(e) => {
            setFilterColor(e.target.value)
            setPage(1)
          }}
          aria-label="กรองสถานะเงินชดเชย"
        >
          <option value="ALL">สถานะเงินชดเชย: ทั้งหมด ({colorCounts.total || stats.total})</option>
          <option value="GREEN">ได้รับเงินชดเชยแล้ว ({colorCounts.green})</option>
          <option value="ORANGE">ยังไม่ได้รับเงินชดเชย ({colorCounts.orange})</option>
          <option value="ORANGE_WAITING_REP">ขึ้นทะเบียนแล้ว แต่ยังรอเงินชดเชย ({colorCounts.orangeWaitingRep})</option>
          <option value="PINK">ผู้ป่วยเสียชีวิต ({colorCounts.pink})</option>
        </select>

        <select
          className="pcr-select"
          value={filterRegStatus}
          onChange={(e) => {
            setFilterRegStatus(e.target.value)
            setPage(1)
          }}
          aria-label="กรองสถานะการขึ้นทะเบียน"
        >
          <option value="ALL">สถานะขึ้นทะเบียน Palliative Care: ทั้งหมด</option>
          <option value="ดำเนินการเรียบร้อย">ขึ้นทะเบียนแล้ว</option>
          <option value="ยังไม่ได้ดำเนินการ">ยังไม่ได้ดำเนินการ / รอ</option>
        </select>

        {/* New Filter: จำนวนเงินที่ชดเชย */}
        <select
          className="pcr-select"
          value={filterCompAmount}
          onChange={(e) => {
            setFilterCompAmount(e.target.value)
            setPage(1)
          }}
          aria-label="กรองจำนวนเงินที่ชดเชย"
          title="กรองตามจำนวนเงินชดเชยรวมของผู้ป่วย"
        >
          <option value="ALL">จำนวนเงินชดเชย: ทั้งหมด</option>
          <option value="PAID">มีเงินชดเชย (&gt; 0 บาท)</option>
          <option value="ZERO">ไม่มียอดเงินชดเชย (0 บาท)</option>
          <option value="1_1000">1 - 1,000 บาท</option>
          <option value="1001_3000">1,001 - 3,000 บาท</option>
          <option value="3001_5000">3,001 - 5,000 บาท</option>
          <option value="5001_10000">5,001 - 10,000 บาท</option>
          <option value="OVER_10000">มากกว่า 10,000 บาท</option>
        </select>

        {/* New Filter: จำนวนครั้งเยี่ยมที่บ้าน เฉพาะที่มีเงินชดเชยเท่านั้น */}
        <select
          className="pcr-select"
          value={filterCompVisits}
          onChange={(e) => {
            setFilterCompVisits(e.target.value)
            setPage(1)
          }}
          aria-label="กรองจำนวนครั้งเยี่ยมเฉพาะที่มีเงินชดเชย"
          title="กรองจำนวนครั้งเยี่ยมบ้านเฉพาะครั้งที่ได้รับเงินชดเชย"
        >
          <option value="ALL">ครั้งเยี่ยมที่มีชดเชย: ทั้งหมด</option>
          <option value="HAS_COMP">มีครั้งเยี่ยมที่ได้ชดเชย (&ge; 1 ครั้ง)</option>
          <option value="0">ไม่มีครั้งเยี่ยมที่ได้ชดเชย (0 ครั้ง)</option>
          <option value="1">ได้เงินชดเชย 1 ครั้ง</option>
          <option value="2">ได้เงินชดเชย 2 ครั้ง</option>
          <option value="3">ได้เงินชดเชย 3 ครั้ง</option>
          <option value="4">ได้เงินชดเชย 4 ครั้ง</option>
          <option value="5">ได้เงินชดเชย 5 ครั้ง</option>
          <option value="6">ได้เงินชดเชย 6 ครั้ง</option>
          <option value="7_PLUS">ได้เงินชดเชย 7 ครั้งขึ้นไป</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            className="pcr-btn pcr-btn-secondary"
            onClick={handleClearAllFilters}
            title="ล้างตัวกรองทั้งหมด"
          >
            ล้างตัวกรอง
          </button>
        )}

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
          <span>โหมดสเปรดชีต: ดึงข้อมูลชื่อ/ที่อยู่/เบอร์โทรและสถานะคลินิก Palliative Care จาก HOSxP อัตโนมัติ | วันที่เยี่ยมและวันที่เสียชีวิตคลิกแก้ไขได้ทันที</span>
        </div>
        <div className="pcr-legend-items">
          <span className="pcr-legend-chip pcr-tag-teal">เขียว: ขึ้นทะเบียน Palliative Care แล้ว / ได้เงินชดเชย</span>
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
                <th rowSpan={2} className="pcr-th-sub pcr-sticky-col-idx" style={{ width: 45 }}>ลำดับ</th>
                <th rowSpan={2} className="pcr-th-sub pcr-sticky-col-hn">HN</th>
                <th colSpan={3} className="pcr-th-group">ข้อมูลผู้ป่วย</th>
                <th colSpan={3} className="pcr-th-group">การวินิจฉัยและโครงการ</th>
                <th colSpan={1} className="pcr-th-group">การขึ้นทะเบียน Palliative Care</th>
                <th colSpan={maxVisits} className="pcr-th-group">ติดตามเยี่ยมบ้าน (ครั้งที่ 1 - {maxVisits})</th>
                <th colSpan={1} className="pcr-th-group">ข้อมูลเสียชีวิต</th>
                {canEdit && <th rowSpan={2} className="pcr-th-sub">จัดการ</th>}
              </tr>

              {/* Sub Header Row 2 */}
              <tr>
                <th className="pcr-th-sub">ชื่อ-สกุลผู้ป่วย</th>
                <th className="pcr-th-sub">ที่อยู่</th>
                <th className="pcr-th-sub">เบอร์โทร</th>
                <th className="pcr-th-sub">ICD10 โรคหลัก</th>
                <th className="pcr-th-sub">ICD 10 Palliative</th>
                <th className="pcr-th-sub">Project code</th>
                <th className="pcr-th-sub">สถานะขึ้นทะเบียน</th>
                {visitNumbers.map((n) => (
                  <th key={n} className="pcr-th-sub">
                    เยี่ยม {n}
                  </th>
                ))}
                <th className="pcr-th-sub">วันที่เสียชีวิต</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={10 + maxVisits + (canEdit ? 1 : 0)} style={{ padding: '2.5rem', color: 'var(--pc-muted)' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    กำลังโหลดข้อมูลทะเบียน...
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={10 + maxVisits + (canEdit ? 1 : 0)} style={{ padding: '2.5rem', color: 'var(--pc-muted)' }}>
                    <div>ไม่พบข้อมูลทะเบียนผู้ป่วยตามเงื่อนไขที่เลือก</div>
                    {(search || filterRegStatus !== 'ALL' || filterColor !== 'ALL') && (
                      <button
                        type="button"
                        className="pcr-btn pcr-btn-secondary"
                        style={{ marginTop: '0.75rem', minHeight: 32, padding: '4px 12px' }}
                        onClick={() => {
                          setSearch('')
                          setFilterRegStatus('ALL')
                          setFilterColor('ALL')
                          setPage(1)
                        }}
                      >
                        ล้างตัวกรองทั้งหมด
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const rowNum = (page - 1) * 50 + idx + 1
                  const isDeceased = Boolean(item.deathDate?.trim())
                  let hasComp = false
                  if (item.visits && item.visits.length > 0) {
                    for (const v of item.visits) {
                      if ((v.compensated || 0) > 0) {
                        hasComp = true
                        break
                      }
                    }
                  } else {
                    for (let v = 1; v <= 6; v++) {
                      if (((item as any)[`visit${v}Compensated`] || 0) > 0) {
                        hasComp = true
                        break
                      }
                    }
                  }

                  const isRegistered = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')

                  // 1 สี = 1 ความหมาย ไฮไลท์ทั้ง Record
                  let rowColorClass = 'pcr-row-pending'
                  if (isDeceased) {
                    rowColorClass = 'pcr-row-death'
                  } else if (hasComp) {
                    rowColorClass = 'pcr-row-paid'
                  }

                  return (
                    <tr key={item.id} className={rowColorClass}>
                      <td className="pcr-sticky-col-idx" style={{ color: 'var(--pc-muted)', fontWeight: 600 }}>{rowNum}</td>
                      <td
                        className="pcr-sticky-col-hn"
                        style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--pc-ink)', whiteSpace: 'nowrap' }}
                      >
                        {item.hn}
                      </td>
                      <td
                        style={{ fontWeight: 600, minWidth: 135, textAlign: 'left' }}
                      >
                        {item.patientName}
                        {item.isLtc && (
                          <span
                            style={{
                              marginLeft: '0.35rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#0284c7',
                              backgroundColor: '#e0f2fe',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              display: 'inline-block',
                              verticalAlign: 'middle',
                              border: '1px solid #bae6fd',
                            }}
                            title="ผู้ป่วยรายนี้มีรายชื่อในทะเบียน Long Term Care (LTC)"
                          >
                            (LTC)
                          </span>
                        )}
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

                      {/* Clinic Palliative Care Registration Status */}
                      <td style={{ minWidth: 120 }}>
                        {item.registeredDate ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span className="pcr-tag pcr-tag-teal">ขึ้นทะเบียนแล้ว</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--pc-teal-text)', fontWeight: 600 }}>
                              {formatThaiDate(item.registeredDate)}
                            </span>
                          </div>
                        ) : isRegistered ? (
                          <span className="pcr-tag pcr-tag-teal">ดำเนินการเรียบร้อย</span>
                        ) : (
                          <span className="pcr-tag pcr-tag-amber">ยังไม่ได้ดำเนินการ / รอ</span>
                        )}
                      </td>

                      {/* Visits 1 - maxVisits */}
                      {visitNumbers.map((num) => {
                        const isSaved =
                          justSavedCell?.id === item.id && justSavedCell?.field === `visit${num}Date`

                        return (
                          <td key={num} className={isSaved ? 'just-saved' : ''} style={{ fontSize: '0.75rem', minWidth: 95 }}>
                            <EditableVisitCell
                              item={item}
                              visitNum={num}
                              canEdit={canEdit}
                              onSaveDate={(val) => handleVisitSave(item, num, val)}
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
                              className="pcr-action-btn"
                              onClick={() => handleOpenEdit(item)}
                              title="แก้ไข / บันทึกการเยี่ยม"
                              aria-label="แก้ไข / บันทึกการเยี่ยม"
                            >
                              <span className="pcr-symbol" aria-hidden="true">✎</span>
                            </button>
                            {permissions.canManage && (
                              <button
                                type="button"
                                className="pcr-action-btn pcr-action-btn-delete"
                                onClick={() => setDeletingItem(item)}
                                title="ลบเคส"
                                aria-label="ลบเคส"
                              >
                                <span className="pcr-symbol" aria-hidden="true">✕</span>
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
            แสดง {items.length} จาก {totalCount.toLocaleString()} รายการ (หน้า {page} / {totalPages})
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

            <form onSubmit={handleAddSubmit} className="pcr-modal-form">
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
                      <label className="pcr-form-label pcr-form-label-required">HN หรือ AN (หมายเลขผู้ป่วย / เลข admit)</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="pcr-input"
                          placeholder="เช่น 000206"
                          required
                          value={addForm.hn}
                          onChange={(e) => {
                            const val = e.target.value
                            const norm = (h: string) => (/^\d+$/.test(h.trim()) ? h.trim().replace(/^0+/, '') : h.trim())
                            const valNorm = norm(val)
                            const alreadyInTable = Boolean(
                              valNorm &&
                                items.some(
                                  (it) => norm(it.hn) === valNorm || (it.an && norm(it.an) === valNorm)
                                )
                            )
                            if (alreadyInTable) {
                              setIsDuplicate(true)
                              setLookupFeedback({
                                type: 'error',
                                message: `⚠️ หมายเลขนี้มีอยู่ในทะเบียนแล้ว ห้ามลงข้อมูลซ้ำ`,
                              })
                            } else if (isDuplicate) {
                              setIsDuplicate(false)
                              setLookupFeedback(null)
                            }
                            setAddForm({ ...addForm, hn: val })
                          }}
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
                          title="ดึงชื่อ ที่อยู่ เบอร์โทร และสถานะคลินิก Palliative Care จาก HOSxP"
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
                      <label className="pcr-form-label">ICD10 รหัสโรคหลัก (ดึงอัตโนมัติจาก AN ในคลินิก Palliative Care)</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก AN ใน HOSxP อัตโนมัติ เช่น C541"
                        value={addForm.icd10Principal}
                        onChange={(e) => setAddForm({ ...addForm, icd10Principal: e.target.value })}
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
                  หมายเหตุ: สถานะขึ้นทะเบียนจะถูกตรวจสอบกับ <strong>คลินิก Palliative Care</strong> ใน HOSxP อัตโนมัติ และข้อมูลการเยี่ยมบ้านครั้งที่ 1-6 พร้อมผลชดเชย Rep จะแสดงในตารางเมื่อบันทึกวันเยี่ยม
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
                  disabled={isSubmittingAdd || isDuplicate || !addForm.hn.trim()}
                >
                  {isSubmittingAdd
                    ? 'กำลังบันทึก...'
                    : isDuplicate
                    ? 'มีข้อมูลในทะเบียนแล้ว (ห้ามลงซ้ำ)'
                    : 'บันทึกขึ้นทะเบียน'}
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
                  บันทึกข้อมูลและประวัติการเยี่ยม: {editingItem.patientName}
                </h2>
                <div className="pcr-modal-patient-subtitle">
                  <span className="pcr-modal-patient-pill">HN: {editingItem.hn}</span>
                  {editingItem.registeredDate ? (
                    <span className="pcr-modal-patient-pill" style={{ color: 'var(--pc-teal-text)' }}>
                      ขึ้นทะเบียน Palliative Care เมื่อ {formatThaiDate(editingItem.registeredDate)}
                    </span>
                  ) : (
                    <span className="pcr-modal-patient-pill" style={{ color: 'var(--pc-amber-text)' }}>
                      ยังไม่ขึ้นทะเบียน Palliative Care
                    </span>
                  )}
                  {editingItem.deathDate && (
                    <span className="pcr-modal-patient-pill" style={{ color: 'var(--pc-rose-text)', borderColor: 'var(--pc-rose-border)' }}>
                      เสียชีวิตเมื่อ {formatThaiDate(editingItem.deathDate)}
                    </span>
                  )}
                </div>
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

            <form onSubmit={handleEditSubmit} className="pcr-modal-form">
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
                  <div className="pcr-form-section-title">1. ข้อมูลผู้ป่วยและการขึ้นทะเบียนคลินิก Palliative Care</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">HN (ข้อมูลคงที่)</label>
                      <input
                        type="text"
                        className="pcr-input pcr-input-readonly"
                        value={editForm.hn || ''}
                        readOnly
                        disabled
                        title="HN เป็นข้อมูลคงที่ ไม่สามารถแก้ไขได้"
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ชื่อ-สกุลผู้ป่วย (ข้อมูลคงที่)</label>
                      <input
                        type="text"
                        className="pcr-input pcr-input-readonly"
                        value={editForm.patientName || ''}
                        readOnly
                        disabled
                        title="ชื่อ-สกุลผู้ป่วย เป็นข้อมูลคงที่ ไม่สามารถแก้ไขได้"
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
                        placeholder="เช่น 0812345678"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ICD-10 รหัสโรคหลัก</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.icd10Principal || ''}
                        onChange={(e) => setEditForm({ ...editForm, icd10Principal: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">สถานะคลินิก Palliative Care ใน HOSxP</label>
                      <div style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                        {editingItem.registeredDate ? (
                          <span className="pcr-tag pcr-tag-teal">
                            ขึ้นทะเบียนแล้ว (วันที่: {formatThaiDate(editingItem.registeredDate)})
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
                      <label className="pcr-form-label">ICD-10 รหัส Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.icd10Palliative || ''}
                        onChange={(e) => setEditForm({ ...editForm, icd10Palliative: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Visits */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">2. บันทึกวันเยี่ยมบ้านและข้อมูลการชดเชย Rep (ขั้นต่ำ 6 ครั้ง)</div>
                  <div className="pcr-form-grid">
                    {editVisits.map((v) => {
                      const latestRep = v.repItems && v.repItems.length > 0 ? v.repItems[0] : null
                      const displayRep = latestRep?.rep || v.rep || ''
                      const displayComp = latestRep !== null ? latestRep.compensated : v.compensated
                      const displayReason = latestRep?.reason || v.reason || ''
                      const displaySource = latestRep?.source

                      return (
                        <div key={v.visitNo} className="pcr-visit-edit-card">
                          <div className="pcr-visit-edit-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="pcr-visit-edit-title">
                                การเยี่ยมครั้งที่ {v.visitNo}
                              </span>
                              {v.visitNo > 6 && (
                                <button
                                  type="button"
                                  className="pcr-btn-delete-visit"
                                  onClick={() => handleRemoveVisit(v.visitNo)}
                                  title={`ลบการเยี่ยมครั้งที่ ${v.visitNo}`}
                                >
                                  ✕ ลบครั้งนี้
                                </button>
                              )}
                            </div>
                            {displayRep || (displayComp !== undefined && displayComp !== null && Number(displayComp) > 0) ? (
                              <RepAmountBadge
                                rep={displayRep}
                                compensated={displayComp}
                                reason={displayReason}
                                source={displaySource}
                              />
                            ) : v.visitDate ? (
                              <span className="pcr-rep-badge pcr-rep-pending">รอผลชดเชย</span>
                            ) : null}
                          </div>

                          <div>
                            <label className="pcr-form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                              วันเยี่ยม (วว/ดด/ปปปป พ.ศ.)
                            </label>
                            <input
                              type="text"
                              className="pcr-input"
                              placeholder="เช่น 02/11/2569"
                              value={v.visitDate || ''}
                              onChange={(e) => handleVisitDateChange(v.visitNo, e.target.value)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="pcr-btn pcr-btn-secondary"
                      onClick={handleAddVisit}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    >
                      <span className="pcr-symbol" aria-hidden="true">+</span>
                      เพิ่มการเยี่ยม (ครั้งที่ {editVisits.length + 1})
                    </button>
                  </div>
                </div>

                {/* Section C: Death Information */}
                <div className={`pcr-form-section ${editForm.deathDate ? 'pcr-form-section-death' : ''}`}>
                  <div className="pcr-form-section-title" style={{ color: editForm.deathDate ? 'var(--pc-rose-text)' : undefined }}>
                    3. ข้อมูลการเสียชีวิต
                  </div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">วันที่เสียชีวิต (วว/ดด/ปปปป พ.ศ.)</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น 02/11/2569 (เว้นว่างหากยังมีชีวิต)"
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
                  {isSubmittingEdit ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
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
                <span className="pcr-symbol" aria-hidden="true">✕</span>
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
