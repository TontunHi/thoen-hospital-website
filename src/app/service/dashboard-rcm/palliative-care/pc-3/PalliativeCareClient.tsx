'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Download,
  FileSearch,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  PalliativeCareItem,
  PalliativeCareResult,
  PalliativeCareSummary,
} from '@/lib/clinical/rcmDashboardService'
import { VnDetailModal } from '../components/VnDetailModal'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

const THAI_MONTHS = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
]

const YEAR_OPTIONS = [2572, 2571, 2570, 2569, 2568, 2567, 2566, 2565]

const EMPTY_SUMMARY: PalliativeCareSummary = {
  totalVisits: 0,
  totalPatients: 0,
  advanceCarePlanCount: 0,
  opioidCount: 0,
  hasZ515Count: 0,
  missingZ515Count: 0,
  paidCount: 0,
  totalCompensated: 0,
  deceasedCount: 0,
}

const SEARCH_DEBOUNCE_MS = 300

/** เงินบาท: ทศนิยม 2 ตำแหน่งคงที่ทั้งหน้า เพื่อให้เทียบหลักได้ตรงกัน */
const formatBaht = (value: number | null | undefined): string =>
  (Number.isFinite(value ?? NaN) ? (value as number) : 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatCount = (value: number | null | undefined): string =>
  (Number.isFinite(value ?? NaN) ? (value as number) : 0).toLocaleString('th-TH')

/* ── CSV safety helpers (Excel on Windows + Formula Injection Guard) ─────── */
const CSV_GUARD_PATTERN = /^[=+\-@\t\r]/

function csvText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  const raw = String(value)
  const guarded = CSV_GUARD_PATTERN.test(raw) ? `'${raw}` : raw
  return `"${guarded.replace(/"/g, '""')}"`
}

/** รหัสตัวเลข (VN/HN/CID) ต้องคงเลข 0 นำหน้าและไม่ถูก Excel แปลงเป็นวิทยาศาสตร์ */
function csvNumericCode(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return '""'
  return /^\d+$/.test(raw) ? `="${raw}"` : csvText(raw)
}

export interface PalliativeCareClientProps {
  initialData?: PalliativeCareResult | null
  initialRange?: { startDate: string; endDate: string }
}

export default function PalliativeCareClient({
  initialData,
  initialRange,
}: PalliativeCareClientProps = {}) {
  const today = useMemo(() => new Date(), [])
  const curCalYear = today.getFullYear()
  const curBeYear = curCalYear + 543
  const curMonth = today.getMonth() + 1
  const defaultFiscalBeYear = curMonth >= 10 ? curBeYear + 1 : curBeYear

  // Date mode: 'custom' (กำหนดเอง) | 'monthly' (รายเดือน) | 'fiscal' (รายปีงบประมาณ)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('monthly')

  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)

  const initialMonthlyRange = useMemo(() => {
    const padM = String(curMonth).padStart(2, '0')
    const lastDay = new Date(curCalYear, curMonth, 0).getDate()
    return {
      start: `${curCalYear}-${padM}-01`,
      end: `${curCalYear}-${padM}-${String(lastDay).padStart(2, '0')}`,
    }
  }, [curCalYear, curMonth])

  const [ds1, setDs1] = useState<string>(initialRange?.startDate || initialMonthlyRange.start)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || initialMonthlyRange.end)

  // Filter states
  const [ucOnly, setUcOnly] = useState<boolean>(true)
  const [filterType, setFilterType] = useState<'ALL' | 'Chronic' | 'Opioid' | 'Death'>('ALL')
  const [deathStatus, setDeathStatus] = useState<'ALL' | 'Y' | 'N'>('ALL')
  const [z515Filter, setZ515Filter] = useState<'ALL' | 'Y' | 'N'>('ALL')
  const [compensatedFilter, setCompensatedFilter] = useState<string>('ALL')
  const [availableCompensations, setAvailableCompensations] = useState<number[]>(
    initialData?.availableCompensations || [
      750, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
    ]
  )
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [baseSummary, setBaseSummary] = useState<PalliativeCareSummary | null>(
    initialData?.summary || null
  )

  // Data states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PalliativeCareItem[]>(initialData?.items || [])
  const [summary, setSummary] = useState<PalliativeCareSummary>(initialData?.summary || EMPTY_SUMMARY)

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Drill-down targets
  const [selectedItem, setSelectedItem] = useState<PalliativeCareItem | null>(null)
  const [selectedVn, setSelectedVn] = useState<string | null>(null)

  // Card view on small screens (ตาราง 24 คอลัมน์อ่านไม่ไหวบนมือถือ)
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(false)

  // Reset the unfiltered baseline when the scope (date / UC) changes
  useEffect(() => {
    setBaseSummary(null)
  }, [ds1, ds2, ucOnly])

  // Unified search — debounce 300ms เพื่อไม่ยิง API ทุกคีย์
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = () => setIsMobileLayout(mediaQuery.matches)
    handleChange()
    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  // Active card filter flags
  const isTotalActive =
    filterType === 'ALL' && deathStatus === 'ALL' && compensatedFilter === 'ALL' && z515Filter === 'ALL'
  const isAcpActive = filterType === 'Chronic'
  const isOpioidActive = filterType === 'Opioid'
  const isZ515Active = z515Filter === 'Y'
  const isNoZ515Active = z515Filter === 'N'
  const isPaidActive = compensatedFilter === 'PAID'
  const isDeathActive = deathStatus === 'Y'

  type CardFilter = 'ALL' | 'ACP' | 'OPIOID' | 'Z515' | 'NO_Z515' | 'PAID' | 'DEATH'

  const handleCardClick = (card: CardFilter) => {
    setCurrentPage(1)
    if (card === 'ALL') {
      setFilterType('ALL')
      setDeathStatus('ALL')
      setCompensatedFilter('ALL')
      setZ515Filter('ALL')
    } else if (card === 'ACP') {
      const next = isAcpActive ? 'ALL' : 'Chronic'
      setFilterType(next)
      if (next !== 'ALL') {
        setDeathStatus('ALL')
        setCompensatedFilter('ALL')
        setZ515Filter('ALL')
      }
    } else if (card === 'OPIOID') {
      const next = isOpioidActive ? 'ALL' : 'Opioid'
      setFilterType(next)
      if (next !== 'ALL') {
        setDeathStatus('ALL')
        setCompensatedFilter('ALL')
        setZ515Filter('ALL')
      }
    } else if (card === 'Z515') {
      const next = isZ515Active ? 'ALL' : 'Y'
      setZ515Filter(next)
      if (next !== 'ALL') {
        setFilterType('ALL')
        setDeathStatus('ALL')
        setCompensatedFilter('ALL')
      }
    } else if (card === 'NO_Z515') {
      const next = isNoZ515Active ? 'ALL' : 'N'
      setZ515Filter(next)
      if (next !== 'ALL') {
        setFilterType('ALL')
        setDeathStatus('ALL')
        setCompensatedFilter('ALL')
      }
    } else if (card === 'PAID') {
      const next = isPaidActive ? 'ALL' : 'PAID'
      setCompensatedFilter(next)
      if (next !== 'ALL') {
        setFilterType('ALL')
        setDeathStatus('ALL')
        setZ515Filter('ALL')
      }
    } else {
      const next = isDeathActive ? 'ALL' : 'Y'
      setDeathStatus(next)
      if (next !== 'ALL') {
        setFilterType('ALL')
        setCompensatedFilter('ALL')
        setZ515Filter('ALL')
      }
    }
  }

  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)
    if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const padM = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${padM}-01`)
      setDs2(`${ceYear}-${padM}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceFiscalYear = selectedFiscalYear - 543
      setDs1(`${ceFiscalYear - 1}-10-01`)
      setDs2(`${ceFiscalYear}-09-30`)
    }
  }

  const handleMonthYearChange = (newMonth: number, newBeYear: number) => {
    setSelectedMonth(newMonth)
    setSelectedBeYear(newBeYear)
    const ceYear = newBeYear - 543
    const padM = String(newMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, newMonth, 0).getDate()
    setDs1(`${ceYear}-${padM}-01`)
    setDs2(`${ceYear}-${padM}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleFiscalYearChange = (newFiscalYear: number) => {
    setSelectedFiscalYear(newFiscalYear)
    const ceFiscalYear = newFiscalYear - 543
    setDs1(`${ceFiscalYear - 1}-10-01`)
    setDs2(`${ceFiscalYear}-09-30`)
    setCurrentPage(1)
  }

  const resetFilters = () => {
    setUcOnly(true)
    setFilterType('ALL')
    setDeathStatus('ALL')
    setZ515Filter('ALL')
    setCompensatedFilter('ALL')
    setSearch('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearch('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }

  // Fetch report data
  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        ucOnly: String(ucOnly),
        filterType,
        deathStatus,
      })
      if (z515Filter !== 'ALL') {
        q.set('z515Status', z515Filter)
      }
      if (compensatedFilter && compensatedFilter !== 'ALL') {
        q.set('compensated', compensatedFilter)
      }
      if (debouncedSearch) {
        q.set('search', debouncedSearch)
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/pc-3?${q.toString()}`, {
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถโหลดข้อมูล Palliative Care ได้')
      }

      setItems(data.items || [])
      if (Array.isArray(data.availableCompensations) && data.availableCompensations.length > 0) {
        setAvailableCompensations(data.availableCompensations)
      }
      const newSummary: PalliativeCareSummary = data.summary || EMPTY_SUMMARY
      setSummary(newSummary)
      if (isTotalActive && !debouncedSearch) {
        setBaseSummary(newSummary)
      }
      setCurrentPage(1)
    } catch (err: unknown) {
      const errorObj = err as Error
      if (errorObj.name !== 'AbortError') {
        setError(errorObj.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [ds1, ds2, ucOnly, filterType, deathStatus, z515Filter, compensatedFilter, debouncedSearch, isTotalActive])

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

  // Close the detail modal with Escape
  useEffect(() => {
    if (!selectedItem) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedItem(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem])

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize])

  const totalPages = Math.ceil(items.length / pageSize) || 1
  const uniquePatientCount = useMemo(() => new Set(items.map((row) => row.hn)).size, [items])

  const activeSummary = baseSummary || summary
  const missingZ515Rate =
    activeSummary.totalVisits > 0
      ? (activeSummary.missingZ515Count / activeSummary.totalVisits) * 100
      : 0

  const hasActiveFilters =
    !ucOnly ||
    filterType !== 'ALL' ||
    deathStatus !== 'ALL' ||
    z515Filter !== 'ALL' ||
    compensatedFilter !== 'ALL' ||
    debouncedSearch.length > 0

  const isInitialLoading = loading && items.length === 0
  const rangeStart = items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, items.length)

  // Modern Excel (.xlsx) Export
  const handleExportCsv = async () => {
    if (!items || items.length === 0) return

    const headers = [
      'ลำดับ',
      'VN',
      'HN',
      'เลขประจำตัวประชาชน (CID)',
      'ชื่อ-สกุล',
      'วันที่รับบริการ',
      'ClaimCode',
      'รหัสสิทธิ',
      'กลุ่มสิทธิ',
      'ชื่อสิทธิการรักษา',
      'สถานะการมีชีวิต',
      'วันที่เสียชีวิต',
      'จุดบริการ/ห้องตรวจ',
      'สาขา/แผนก',
      'การวินิจฉัย (Diag)',
      'หัตถการ (Oper)',
      'Z515',
      'Dx',
      'Z718',
      'Advance Care Plan (Dx & Z718)',
      'Cancer',
      'Drug',
      'Opioid (Cancer & Drug)',
      'จ่ายแล้ว',
      'เงินชดเชย',
      'Rep/Invoice',
      'E-Claim No',
      'วันที่ส่งเคลม',
      'สถานะ e-Claim',
      'ไฟล์ส่งเคลม',
      'ErrorName',
    ]

    const rows = items.map((r) => [
      r.no,
      r.vn,
      r.hn,
      r.cid,
      r.ptname,
      r.vstdate,
      r.authencode,
      r.pttype,
      r.inscl,
      r.pttypename,
      r.death === 'Y' ? 'เสียชีวิต' : 'มีชีวิต',
      r.death_date,
      r.room,
      r.spclty,
      r.diag,
      r.oper,
      r.z515,
      r.dx,
      r.z718,
      r.dx === 'Y' && r.z718 === 'Y' ? 'Y' : '',
      r.cancer,
      r.drug,
      r.cancer === 'Y' && r.drug === 'Y' ? 'Y' : '',
      r.ok === 'Y' ? 'จ่ายแล้ว' : 'ยังไม่ชดเชย',
      r.compensated,
      r.rep_invoice,
      r.eclaim_no,
      r.senddate,
      r.status_eclaim,
      r.filename_send,
      r.error_name,
    ])

    await exportRcmExcel({
      filename: `Palliative_Care_PC3_${ds1}_to_${ds2}.xlsx`,
      title: 'Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด (PC.3)',
      subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
      headers,
      rows,
    })
  }

  /** เกณฑ์ Palliative: แสดงค่าของรหัสทั้งสองตัวอย่างโปร่งใส (Y / –) */
  const renderCriteria = (firstCode: string, firstValue: string, secondCode: string, secondValue: string) => (
    <span className="pc3-crit">
      <span className={firstValue === 'Y' ? 'pc3-crit-on' : 'pc3-crit-off'}>
        {firstCode} {firstValue === 'Y' ? 'Y' : '–'}
      </span>
      <span className="pc3-crit-sep" aria-hidden="true">
        ·
      </span>
      <span className={secondValue === 'Y' ? 'pc3-crit-on' : 'pc3-crit-off'}>
        {secondCode} {secondValue === 'Y' ? 'Y' : '–'}
      </span>
    </span>
  )

  const rowStatus = (item: PalliativeCareItem) => {
    if (item.death === 'Y') return { label: 'เสียชีวิต', tone: 'is-danger' }
    if (item.ok === 'Y') return { label: 'จ่ายแล้ว', tone: 'is-ok' }
    if (item.error_name) return { label: 'ต้องแก้ไข', tone: 'is-warn' }
    return { label: 'รอชดเชย', tone: 'is-ghost' }
  }

  const emptyState = debouncedSearch ? (
    <div className="pc3-state">
      <Search size={40} className="pc3-state-icon" aria-hidden="true" />
      <p className="pc3-state-title">ไม่พบผลลัพธ์สำหรับ “{debouncedSearch}”</p>
      <p className="pc3-state-text">
        ลองค้นหาด้วย HN, เลขบัตรประชาชน 13 หลัก, ชื่อ-สกุล, VN หรือรหัสวินิจฉัย ICD-10
      </p>
      <div className="pc3-state-actions">
        <button type="button" className="pc3-btn-secondary" onClick={clearSearch}>
          ล้างคำค้นหา
        </button>
      </div>
    </div>
  ) : (
    <div className="pc3-state">
      <FileSearch size={40} className="pc3-state-icon" aria-hidden="true" />
      <p className="pc3-state-title">ไม่พบผู้ป่วย Palliative Care ในเงื่อนไขนี้</p>
      <p className="pc3-state-text">
        ลองขยายช่วงวันที่ หรือผ่อนตัวกรองสิทธิ เกณฑ์การรักษา และสถานะการชดเชย
      </p>
      {hasActiveFilters && (
        <div className="pc3-state-actions">
          <button type="button" className="pc3-btn-secondary" onClick={resetFilters}>
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="pc3-page">
      {/* ── 1. Header ─────────────────────────────────────────────────── */}
      <header className="pc3-header">
        <div className="pc3-title-group">
          <div className="pc3-title-row">
            <h1 className="pc3-title">Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด</h1>
            <span className="pc3-code-chip">PC.3</span>
          </div>
          <p className="pc3-subtitle">
            ตรวจสอบผู้ป่วย Palliative Care, เกณฑ์ Advance Care Plan (Dx + Z718), Opioid (Cancer + Drug)
            และการชดเชยค่ารักษา e-Claim (ไม่รวมสิทธิ H1, 35, 36)
          </p>
        </div>

        <div className="pc3-header-actions">
          <button
            type="button"
            className="pc3-btn-secondary"
            onClick={() => fetchData()}
            disabled={loading}
            aria-busy={loading}
            title="ดึงข้อมูลล่าสุดจาก HOSxP อีกครั้ง"
          >
            <RefreshCw size={16} className={loading ? 'pc3-spin' : undefined} aria-hidden="true" />
            <span>{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="pc3-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || items.length === 0}
            title="ส่งออกรายการทั้งหมดตามเงื่อนไขปัจจุบันเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} aria-hidden="true" />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div className="pc3-banner" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="pc3-banner-text">
            <span className="pc3-banner-strong">โหลดข้อมูลไม่สำเร็จ</span>
            <span>{error}</span>
          </div>
          <button type="button" className="pc3-btn-secondary" onClick={() => fetchData()}>
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {/* ── 2. Toolbar: Date Ribbon + Filters + Unified Search ────────── */}
      <section className="pc3-toolbar" aria-label="ตัวกรองข้อมูล">
        <div className="pc3-toolbar-row">
          <div className="pc3-mode-tabs" role="group" aria-label="รูปแบบช่วงเวลา">
            <button
              type="button"
              className={`pc3-mode-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
              aria-pressed={dateMode === 'custom'}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`pc3-mode-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('monthly')}
              aria-pressed={dateMode === 'monthly'}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={`pc3-mode-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
              aria-pressed={dateMode === 'fiscal'}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="pc3-divider-v" aria-hidden="true" />

          {dateMode === 'custom' && (
            <div className="pc3-date-controls">
              <div className="pc3-field-inline">
                <span className="pc3-field-label">ตั้งแต่วันที่</span>
                <ThaiDatePicker value={ds1} onChange={setDs1} maxDate={ds2} aria-label="ตั้งแต่วันที่" />
              </div>
              <span className="pc3-field-label">ถึง</span>
              <ThaiDatePicker value={ds2} onChange={setDs2} minDate={ds1} aria-label="ถึงวันที่" />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="pc3-date-controls">
              <select
                className="pc3-select"
                value={selectedMonth}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedBeYear)}
                aria-label="เลือกเดือน"
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                className="pc3-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
                aria-label="เลือกปี พ.ศ."
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dateMode === 'fiscal' && (
            <div className="pc3-date-controls">
              <select
                className="pc3-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Unified Global Search — ค้นได้ทุกมิติในช่องเดียว */}
          <div className="pc3-search">
            <Search size={16} className="pc3-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="pc3-search-input"
              placeholder="ค้นหา HN, ชื่อ-สกุล, CID, VN หรือรหัสโรค"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ค้นหาผู้ป่วย"
            />
            {search && (
              <button
                type="button"
                className="pc3-search-clear"
                onClick={clearSearch}
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="pc3-toolbar-divider" aria-hidden="true" />

        <div className="pc3-toolbar-row">
          <label className="pc3-check">
            <input
              type="checkbox"
              checked={ucOnly}
              onChange={(e) => {
                setUcOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะสิทธิ UC</span>
          </label>

          <div className="pc3-field-inline">
            <span className="pc3-field-label">สถานะการมีชีวิต</span>
            <select
              className="pc3-select"
              value={deathStatus}
              onChange={(e) => {
                setDeathStatus(e.target.value as 'ALL' | 'Y' | 'N')
                setCurrentPage(1)
              }}
              aria-label="สถานะการมีชีวิต"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="N">เฉพาะผู้ที่มีชีวิต</option>
              <option value="Y">เฉพาะผู้เสียชีวิต</option>
            </select>
          </div>

          <div className="pc3-field-inline">
            <span className="pc3-field-label">เงินชดเชย</span>
            <select
              className="pc3-select"
              value={compensatedFilter}
              onChange={(e) => {
                setCompensatedFilter(e.target.value)
                setCurrentPage(1)
              }}
              aria-label="เงินชดเชย"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="0">ยังไม่ได้รับชดเชย (0 บาท)</option>
              <option value="PAID">ได้รับชดเชยแล้ว (ทุกยอด)</option>
              <optgroup label="เกณฑ์ยอดเงินขั้นต่ำ (≥)">
                <option value=">=750">≥ 750 บาท</option>
                <option value=">=1000">≥ 1,000 บาท</option>
                <option value=">=2000">≥ 2,000 บาท</option>
                <option value=">=3000">≥ 3,000 บาท</option>
                <option value=">=4000">≥ 4,000 บาท</option>
                <option value=">=5000">≥ 5,000 บาท</option>
                <option value=">=6000">≥ 6,000 บาท</option>
                <option value=">=7000">≥ 7,000 บาท</option>
                <option value=">=8000">≥ 8,000 บาท</option>
                <option value=">=9000">≥ 9,000 บาท</option>
                <option value=">9000">&gt; 9,000 บาท</option>
              </optgroup>
              <optgroup label="ระบุจำนวนเงินตรงตัว (=)">
                {availableCompensations.map((val) => (
                  <option key={val} value={`=${val}`}>
                    = {val.toLocaleString('th-TH')} บาท
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="pc3-field-inline">
            <span className="pc3-field-label">กลุ่มโรค</span>
            <select
              className="pc3-select"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as 'ALL' | 'Chronic' | 'Opioid' | 'Death')
                setCurrentPage(1)
              }}
              aria-label="กลุ่มโรค"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="Chronic">Chronic (Dx + Z718)</option>
              <option value="Opioid">Opioid (Cancer + Drug)</option>
            </select>
          </div>

          <div className="pc3-field-inline">
            <span className="pc3-field-label">รหัส Z515</span>
            <select
              className="pc3-select"
              value={z515Filter}
              onChange={(e) => {
                setZ515Filter(e.target.value as 'ALL' | 'Y' | 'N')
                setCurrentPage(1)
              }}
              aria-label="รหัส Z515"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="Y">มีรหัส Z515</option>
              <option value="N">ไม่พบรหัส Z515</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="pc3-btn-ghost"
              onClick={resetFilters}
              title="ล้างตัวกรองและการค้นหาทั้งหมด"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </section>

      {/* ── 3. Tiered Summary: Featured Totals + Filter Chips ────────── */}
      <section className="pc3-summary" aria-label="สรุปภาพรวม Palliative Care">
        <div className="pc3-featured-grid">
          <button
            type="button"
            className={`pc3-kpi-card ${isTotalActive ? 'is-active' : ''}`}
            onClick={() => handleCardClick('ALL')}
            aria-pressed={isTotalActive}
            title="แสดงผู้ป่วย Palliative Care ทั้งหมด (ล้างตัวกรองตามเกณฑ์)"
          >
            <span className="pc3-kpi-label">ผู้ป่วย Palliative ทั้งหมด</span>
            <span className="pc3-kpi-value">
              {formatCount(activeSummary.totalPatients)}
              <span className="pc3-kpi-unit">คน</span>
            </span>
            <span className="pc3-kpi-sub">
              จำนวนรับบริการ {formatCount(activeSummary.totalVisits)} ครั้ง
            </span>
          </button>

          <button
            type="button"
            className={`pc3-kpi-card ${isNoZ515Active ? 'is-active' : ''}`}
            onClick={() => handleCardClick('NO_Z515')}
            aria-pressed={isNoZ515Active}
            title="กรองเฉพาะผู้ป่วยที่ไม่พบรหัส Z515 (ต้องบันทึกรหัสเพิ่ม)"
          >
            <span className="pc3-kpi-label">ไม่พบรหัส Z515</span>
            <span className={`pc3-kpi-value ${activeSummary.missingZ515Count > 0 ? 'is-warn' : ''}`}>
              {formatCount(activeSummary.missingZ515Count)}
              <span className="pc3-kpi-unit">ครั้ง</span>
            </span>
            <span className="pc3-kpi-sub">
              {missingZ515Rate.toFixed(1)}% ของการรับบริการ · ต้องบันทึกรหัสเพิ่ม
            </span>
          </button>

          <button
            type="button"
            className={`pc3-kpi-card ${isPaidActive ? 'is-active' : ''}`}
            onClick={() => handleCardClick('PAID')}
            aria-pressed={isPaidActive}
            title="กรองเฉพาะรายการที่ได้รับชดเชยแล้ว"
          >
            <span className="pc3-kpi-label">ชดเชยแล้ว</span>
            <span className="pc3-kpi-value is-ok">
              <span className="pc3-kpi-unit">฿</span>
              {formatBaht(activeSummary.totalCompensated)}
            </span>
            <span className="pc3-kpi-sub">
              {formatCount(activeSummary.paidCount)} ครั้งที่จ่ายแล้ว
            </span>
          </button>
        </div>

        <div className="pc3-chip-row" role="group" aria-label="กรองตามเกณฑ์การรักษา">
          <button
            type="button"
            className={`pc3-chip ${isAcpActive ? 'is-active' : ''}`}
            onClick={() => handleCardClick('ACP')}
            aria-pressed={isAcpActive}
            title="กรองเฉพาะผู้ป่วยที่เข้าเกณฑ์ Advance Care Plan (Dx + Z718)"
          >
            <span>Advance Care Plan</span>
            <span className="pc3-chip-count">{formatCount(activeSummary.advanceCarePlanCount)}</span>
          </button>

          <button
            type="button"
            className={`pc3-chip ${isOpioidActive ? 'is-active' : ''}`}
            onClick={() => handleCardClick('OPIOID')}
            aria-pressed={isOpioidActive}
            title="กรองเฉพาะผู้ป่วยที่ได้รับยา Opioid (Cancer + Drug)"
          >
            <span>Opioid</span>
            <span className="pc3-chip-count">{formatCount(activeSummary.opioidCount)}</span>
          </button>

          <button
            type="button"
            className={`pc3-chip ${isZ515Active ? 'is-active' : ''}`}
            onClick={() => handleCardClick('Z515')}
            aria-pressed={isZ515Active}
            title="กรองเฉพาะผู้ป่วยที่มีรหัส Z515"
          >
            <span>มีรหัส Z515</span>
            <span className="pc3-chip-count">{formatCount(activeSummary.hasZ515Count)}</span>
          </button>

          <button
            type="button"
            className={`pc3-chip ${isDeathActive ? 'is-active' : ''}`}
            onClick={() => handleCardClick('DEATH')}
            aria-pressed={isDeathActive}
            title="กรองเฉพาะผู้ป่วยที่เสียชีวิต"
          >
            <span>เสียชีวิต</span>
            <span className="pc3-chip-count is-risk">{formatCount(activeSummary.deceasedCount)}</span>
          </button>
        </div>
      </section>

      {/* ── 4. Ledger Table ──────────────────────────────────────────── */}
      <section className="pc3-table-card" aria-label="รายการผู้ป่วย Palliative Care">
        {items.length === 0 && !isInitialLoading ? (
          <div className="pc3-table-state">{emptyState}</div>
        ) : (
          <>
            <div
              className={`pc3-table-scroll ${isMobileLayout ? 'is-mobile-hidden' : ''} ${
                loading ? 'is-refreshing' : ''
              }`}
            >
              <table className="pc3-table">
                <thead>
                  <tr>
                    <th className="col-center" style={{ width: 56 }}>
                      ลำดับ
                    </th>
                    <th className="col-center">VN</th>
                    <th className="col-center">HN</th>
                    <th className="col-center">เลขบัตรประชาชน (CID)</th>
                    <th className="col-center">ชื่อ-สกุล</th>
                    <th className="col-center">วันที่รับบริการ</th>
                    <th className="col-center">ClaimCode</th>
                    <th className="col-center">รหัสสิทธิ</th>
                    <th className="col-center">ชื่อสิทธิการรักษา</th>
                    <th className="col-center">สถานะการมีชีวิต</th>
                    <th className="col-center">จุดบริการ / คลินิก</th>
                    <th className="col-center">รหัสวินิจฉัย (Diag)</th>
                    <th className="col-center">หัตถการ</th>

                    <th className="col-center">
                      <span className="pc3-th-line">Advance Care Plan</span>
                      <span className="pc3-th-hint">Dx + Z718</span>
                    </th>
                    <th className="col-center">
                      <span className="pc3-th-line">Opioid</span>
                      <span className="pc3-th-hint">Cancer + Drug</span>
                    </th>
                    <th className="col-center">Z515</th>
                    <th className="col-center">ข้อผิดพลาด e-Claim</th>

                    <th className="col-center">จ่ายแล้ว</th>
                    <th className="col-center">เงินชดเชย (บาท)</th>
                    <th className="col-center">Rep / Invoice</th>
                    <th className="col-center">E-Claim No</th>
                    <th className="col-center">วันที่ส่งเคลม</th>
                    <th className="col-center">สถานะ e-Claim</th>
                    <th className="col-center">ไฟล์ส่งเคลม</th>
                  </tr>
                </thead>
                <tbody>
                  {isInitialLoading ? (
                    Array.from({ length: 8 }).map((_, idx) => (
                      <tr key={`pc3-skeleton-${idx}`} className="pc3-skeleton-row" aria-hidden="true">
                        <td colSpan={24}>
                          <div className="pc3-skeleton-line" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    paginatedItems.map((item) => (
                      <tr
                        key={item.vn}
                        className="pc3-row"
                        tabIndex={0}
                        onClick={() => setSelectedItem(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedItem(item)
                          }
                        }}
                        title="คลิกเพื่อดูรายละเอียดผู้ป่วยและการชดเชย"
                      >
                        <td className="col-center pc3-cell-muted">{item.no}</td>
                        <td className="col-center">
                          <button
                            type="button"
                            className="pc3-vn-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedVn(item.vn)
                            }}
                            title={`เปิดรายละเอียดคลินิกของ VN ${item.vn} (opdscreen, ovstdiag, opitemrece)`}
                          >
                            {item.vn}
                          </button>
                        </td>
                        <td className="col-center pc3-mono">{item.hn}</td>
                        {/* เลขบัตรประชาชน: พอร์ทัล RCM ภายในแสดงครบ 13 หลัก */}
                        <td className="col-center pc3-mono">{item.cid || '—'}</td>
                        <td className="col-center">
                          <span className="pc3-pt-name">{item.ptname}</span>
                        </td>
                        <td className="col-center">{formatThaiDate(item.vstdate)}</td>
                        <td className="col-center pc3-mono">{item.authencode || '—'}</td>
                        <td className="col-center">
                          {item.pttype ? (
                            <span className="pc3-badge is-code">{item.pttype}</span>
                          ) : (
                            <span className="pc3-cell-muted">—</span>
                          )}
                        </td>
                        <td className="col-left">{item.pttypename || '—'}</td>
                        <td className="col-center">
                          {item.death === 'Y' ? (
                            <span
                              className="pc3-badge is-danger"
                              title={item.death_date ? `วันเสียชีวิต: ${formatThaiDate(item.death_date)}` : 'เสียชีวิต'}
                            >
                              เสียชีวิต{item.death_date ? ` (${formatThaiDate(item.death_date)})` : ''}
                            </span>
                          ) : (
                            <span className="pc3-text-ok">มีชีวิต</span>
                          )}
                        </td>
                        <td className="col-left">{item.room || item.spclty || '—'}</td>
                        <td className="col-left">
                          <span className="pc3-cell-desc" title={item.diag}>
                            {item.diag || '—'}
                          </span>
                        </td>
                        <td className="col-left">
                          <span className="pc3-cell-desc" title={item.oper}>
                            {item.oper || '—'}
                          </span>
                        </td>

                        <td className="col-center">{renderCriteria('Dx', item.dx, 'Z718', item.z718)}</td>
                        <td className="col-center">{renderCriteria('Cancer', item.cancer, 'Drug', item.drug)}</td>
                        <td className="col-center">
                          {item.z515 === 'Y' ? (
                            <span className="pc3-badge is-ok">Y</span>
                          ) : (
                            <span className="pc3-badge is-warn">ไม่พบ</span>
                          )}
                        </td>
                        <td className="col-left">
                          {item.error_name ? (
                            <span className="pc3-badge is-warn">{item.error_name}</span>
                          ) : (
                            <span className="pc3-text-ok">ครบถ้วน</span>
                          )}
                        </td>

                        <td className="col-center">
                          {item.ok === 'Y' ? (
                            <span className="pc3-badge is-ok">จ่ายแล้ว</span>
                          ) : (
                            <span className="pc3-badge is-ghost">รอชดเชย</span>
                          )}
                        </td>
                        <td className={`col-right pc3-amount ${item.compensated > 0 ? 'has-value' : ''}`}>
                          {item.compensated > 0 ? formatBaht(item.compensated) : '—'}
                        </td>
                        <td className="col-center pc3-mono">{item.rep_invoice || '—'}</td>
                        <td className="col-center pc3-mono">{item.eclaim_no || '—'}</td>
                        <td className="col-center">{formatThaiDate(item.senddate)}</td>
                        <td className="col-left">
                          {item.status_eclaim ? (
                            <span className="pc3-badge is-ghost">{item.status_eclaim}</span>
                          ) : (
                            <span className="pc3-cell-muted">—</span>
                          )}
                        </td>
                        <td className="col-left">
                          <span className="pc3-cell-desc" title={item.filename_send}>
                            {item.filename_send || '—'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card view: ตาราง 24 คอลัมน์อ่านไม่ไหวบนจอเล็ก */}
            {isMobileLayout && (
              <div className="pc3-mcard-list">
                {isInitialLoading
                  ? Array.from({ length: 4 }).map((_, idx) => (
                      <div key={`pc3-mskeleton-${idx}`} className="pc3-mcard" aria-hidden="true">
                        <div className="pc3-skeleton-line" />
                        <div className="pc3-skeleton-line" />
                      </div>
                    ))
                  : paginatedItems.map((item) => {
                      const status = rowStatus(item)
                      return (
                        <button
                          type="button"
                          key={`m-${item.vn}`}
                          className="pc3-mcard"
                          onClick={() => setSelectedItem(item)}
                        >
                          <span className="pc3-mcard-head">
                            <span className="pc3-mcard-name">{item.ptname}</span>
                            <span className={`pc3-badge ${status.tone}`}>{status.label}</span>
                          </span>
                          <span className="pc3-mcard-meta">
                            <span>HN {item.hn}</span>
                            <span>VN {item.vn}</span>
                            <span>{formatThaiDate(item.vstdate)}</span>
                          </span>
                          <span className="pc3-mcard-meta">CID {item.cid || '—'}</span>
                          <span className="pc3-mcard-foot">
                            <span>{item.pttypename || '—'}</span>
                            <span className="pc3-mcard-amount">
                              {item.compensated > 0 ? `฿ ${formatBaht(item.compensated)}` : 'ยังไม่ชดเชย'}
                            </span>
                          </span>
                        </button>
                      )
                    })}
              </div>
            )}
          </>
        )}

        {/* ── Footer / Pagination ────────────────────────────────────── */}
        <footer className="pc3-table-footer">
          <div className="pc3-footer-info">
            {items.length > 0 ? (
              <span>
                แสดง <span className="pc3-footer-count">{rangeStart}–{rangeEnd}</span> จาก{' '}
                <span className="pc3-footer-count">{formatCount(items.length)}</span> รายการ · ผู้ป่วย{' '}
                {formatCount(uniquePatientCount)} คน
              </span>
            ) : (
              <span>ไม่พบรายการตามเงื่อนไขที่เลือก</span>
            )}
            <span className="pc3-footer-size">
              <span>หน้าละ</span>
              <select
                value={pageSize}
                aria-label="จำนวนแถวต่อหน้า"
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span>รายการ</span>
            </span>
          </div>

          <div className="pc3-pagination">
            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="หน้าแรก"
              aria-label="หน้าแรก"
            >
              <ChevronsLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              title="หน้าก่อนหน้า"
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <span className="pc3-page-indicator">
              หน้า {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              title="หน้าถัดไป"
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="หน้าสุดท้าย"
              aria-label="หน้าสุดท้าย"
            >
              <ChevronsRight size={16} aria-hidden="true" />
            </button>
          </div>
        </footer>
      </section>

      {/* VN clinical detail modal (opdscreen, ovstdiag, opitemrece) */}
      <VnDetailModal vn={selectedVn} onClose={() => setSelectedVn(null)} />

      {/* ── 5. Detail Modal ──────────────────────────────────────────── */}
      {selectedItem && (
        <div className="pc3-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="pc3-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pc3-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pc3-modal-header">
              <div>
                <h3 className="pc3-modal-title" id="pc3-detail-title">
                  รายละเอียดผู้ป่วย: {selectedItem.ptname}
                </h3>
                <p className="pc3-modal-subtitle">
                  HN {selectedItem.hn} · VN {selectedItem.vn}
                </p>
              </div>
              <button
                type="button"
                className="pc3-btn-secondary"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดรายละเอียด"
              >
                ปิด
              </button>
            </div>

            <div className="pc3-modal-body">
              <section className="pc3-modal-group">
                <h4 className="pc3-modal-group-title">ข้อมูลผู้รับบริการ</h4>
                <div className="pc3-desc-grid">
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">เลขบัตรประชาชน (CID)</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.cid || '—'}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">วันที่รับบริการ</span>
                    <span className="pc3-desc-value pc3-mono">{formatThaiDate(selectedItem.vstdate)}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">สถานะการมีชีวิต</span>
                    <span className="pc3-desc-value">
                      {selectedItem.death === 'Y' ? (
                        <span className="pc3-badge is-danger">
                          เสียชีวิต{selectedItem.death_date ? ` (${formatThaiDate(selectedItem.death_date)})` : ''}
                        </span>
                      ) : (
                        <span className="pc3-text-ok">มีชีวิต</span>
                      )}
                    </span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">รหัสสิทธิ</span>
                    <span className="pc3-desc-value pc3-mono">
                      {selectedItem.pttype || selectedItem.inscl || '—'}
                    </span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">ชื่อสิทธิการรักษา</span>
                    <span className="pc3-desc-value">{selectedItem.pttypename || '—'}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">เบอร์โทรศัพท์</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.tel || '—'}</span>
                  </div>
                  <div className="pc3-desc-item is-wide">
                    <span className="pc3-desc-label">ที่อยู่</span>
                    <span className="pc3-desc-value">{selectedItem.address || '—'}</span>
                  </div>
                </div>
              </section>

              <section className="pc3-modal-group">
                <h4 className="pc3-modal-group-title">การวินิจฉัยและเกณฑ์ Palliative Care</h4>
                <div className="pc3-desc-grid">
                  <div className="pc3-desc-item is-wide">
                    <span className="pc3-desc-label">อาการสำคัญ (CC)</span>
                    <span className="pc3-desc-value">{selectedItem.cc || '—'}</span>
                  </div>
                  <div className="pc3-desc-item is-wide">
                    <span className="pc3-desc-label">การวินิจฉัยโรค (Diag)</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.diag || '—'}</span>
                  </div>
                  <div className="pc3-desc-item is-wide">
                    <span className="pc3-desc-label">หัตถการ (Oper)</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.oper || '—'}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">รหัส Z515</span>
                    <span className="pc3-desc-value">
                      {selectedItem.z515 === 'Y' ? (
                        <span className="pc3-badge is-ok">พบรหัส Z515</span>
                      ) : (
                        <span className="pc3-badge is-warn">ไม่พบรหัส Z515</span>
                      )}
                    </span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">Advance Care Plan</span>
                    <span className="pc3-desc-value">
                      {selectedItem.dx === 'Y' && selectedItem.z718 === 'Y'
                        ? 'เข้าเกณฑ์ (Dx + Z718)'
                        : 'ไม่เข้าเกณฑ์'}
                    </span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">Opioid</span>
                    <span className="pc3-desc-value">
                      {selectedItem.cancer === 'Y' && selectedItem.drug === 'Y'
                        ? 'เข้าเกณฑ์ (Cancer + Drug)'
                        : 'ไม่เข้าเกณฑ์'}
                    </span>
                  </div>
                </div>
              </section>

              <section className="pc3-modal-group">
                <h4 className="pc3-modal-group-title">การชดเชย e-Claim</h4>
                <div className="pc3-desc-grid">
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">ClaimCode</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.authencode || '—'}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">สถานะการชดเชย</span>
                    <span className="pc3-desc-value">
                      {selectedItem.ok === 'Y' ? (
                        <span className="pc3-badge is-ok">
                          จ่ายแล้ว ฿ {formatBaht(selectedItem.compensated)}
                        </span>
                      ) : (
                        <span className="pc3-badge is-ghost">ยังไม่ชดเชย</span>
                      )}
                    </span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">Rep / Invoice</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.rep_invoice || '—'}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">E-Claim No</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.eclaim_no || '—'}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">วันที่ส่งเคลม</span>
                    <span className="pc3-desc-value pc3-mono">{formatThaiDate(selectedItem.senddate)}</span>
                  </div>
                  <div className="pc3-desc-item">
                    <span className="pc3-desc-label">สถานะ e-Claim</span>
                    <span className="pc3-desc-value">{selectedItem.status_eclaim || '—'}</span>
                  </div>
                  <div className="pc3-desc-item is-wide">
                    <span className="pc3-desc-label">ไฟล์ส่งเคลม</span>
                    <span className="pc3-desc-value pc3-mono">{selectedItem.filename_send || '—'}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
