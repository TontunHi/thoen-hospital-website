'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Download,
  Search,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Activity,
  FileText,
  Copy,
  Check,
  Stethoscope,
} from 'lucide-react'
import type {
  DentalImplantDensurItem,
  DentalImplantSummary,
  DentalImplantReportResult,
  DentalImplantCardFilter,
  DentalImplantSortField,
  DentalImplantAdpMappingCheck,
} from '@/lib/clinical/rcmDentalImplantService'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import { formatThaiDate } from '@/lib/formatters'
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

const CARD_FILTER_LABELS: Record<DentalImplantCardFilter, string> = {
  ALL: 'รายการทั้งหมด',
  COMPENSATED: 'ชดเชยแล้ว',
  UNCOMPENSATED: 'รอชดเชย / ยังไม่ชดเชย',
  WITH_AUTHEN: 'มี Authen Code',
  NO_AUTHEN: 'ไม่มี ClaimCode',
  UC_ONLY: 'สิทธิบัตรทอง (UC)',
}

function formatMoney(val?: number | null): string {
  if (val == null || val === 0) return '0.00'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function sanitizeCsvCell(val: unknown): string {
  if (val == null) return '""'
  let s = String(val).replace(/"/g, '""')
  if (/^[=+@-|\t\r\n]/.test(s)) {
    s = `'` + s
  }
  return `"${s}"`
}

export interface DentalImplantDensurClientProps {
  initialData?: DentalImplantReportResult | null
  initialRange?: { startDate: string; endDate: string }
}

export default function DentalImplantDensurClient({
  initialData = null,
  initialRange,
}: DentalImplantDensurClientProps) {
  const today = useMemo(() => new Date(), [])
  const curCalYear = today.getFullYear()
  const curBeYear = curCalYear + 543
  const curMonth = today.getMonth() + 1
  const defaultFiscalCeYear = curMonth >= 10 ? curCalYear + 1 : curCalYear
  const defaultFiscalBeYear = defaultFiscalCeYear + 543

  const yearOptions = useMemo(() => {
    const list: number[] = []
    for (let y = defaultFiscalBeYear + 1; y >= defaultFiscalBeYear - 6; y--) {
      list.push(y)
    }
    return list
  }, [defaultFiscalBeYear])

  // Date mode: กำหนดเอง | เดือน | ปีงบประมาณ (ไม่มี () ในการแสดงผล)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('fiscal')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)

  const [ds1, setDs1] = useState<string>(
    initialData?.ds1 ?? initialRange?.startDate ?? `${defaultFiscalCeYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialData?.ds2 ?? initialRange?.endDate ?? `${defaultFiscalCeYear}-09-30`
  )

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<DentalImplantCardFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<DentalImplantSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<DentalImplantDensurItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<DentalImplantAdpMappingCheck | null>(
    initialData?.adpMapping ?? null
  )
  const [summary, setSummary] = useState<DentalImplantSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      uniquePatients: 0,
      compensatedCases: 0,
      uncompensatedCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
    }
  )

  // Detail Modal state (opened directly when clicking record row)
  const [selectedItem, setSelectedItem] = useState<DentalImplantDensurItem | null>(null)
  const [clinicalDetails, setClinicalDetails] = useState<any | null>(null)
  const [loadingClinical, setLoadingClinical] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController refs
  const abortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstMount = useRef<boolean>(true)
  const clinicalCacheRef = useRef<Map<string, any>>(new Map())

  // Debounce search
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === debouncedSearch) return

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(trimmed)
      setCurrentPage(1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search, debouncedSearch])

  // Fetch report data
  const fetchData = useCallback(
    async (refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (refresh) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const query = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })
        if (pttypes.length > 0) query.set('pttypes', pttypes.join(','))
        if (refresh) query.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/dental-implant/densur?${query.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `HTTP ${res.status}`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const d: DentalImplantReportResult = json.data
          setItems(d.items)
          setTotalCount(d.totalCount)
          setTotalPages(d.totalPages)
          setSummary(d.summary)
          setAdpMapping(d.adpMapping)
        } else {
          throw new Error(json?.error?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, pttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Fetch on parameter changes (skipping initial fetch if server data present)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      detailAbortRef.current?.abort()
    }
  }, [])

  // Handle Date Mode Changes
  const handleDateModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)
    if (mode === 'fiscal') {
      const ceYear = selectedFiscalYear - 543
      setDs1(`${ceYear - 1}-10-01`)
      setDs2(`${ceYear}-09-30`)
    } else if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mm}-01`)
      setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    }
  }

  const handleFiscalYearChange = (beYear: number) => {
    setSelectedFiscalYear(beYear)
    setCurrentPage(1)
    const ceYear = beYear - 543
    setDs1(`${ceYear - 1}-10-01`)
    setDs2(`${ceYear}-09-30`)
  }

  const handleMonthChange = (month: number, beYear: number) => {
    setSelectedMonth(month)
    setSelectedBeYear(beYear)
    setCurrentPage(1)
    const ceYear = beYear - 543
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
  }

  // Handle Sorting
  const handleSort = (field: DentalImplantSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Card Filter Click
  const handleCardFilterClick = (filter: DentalImplantCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Open Detail Modal on Record Click
  const handleRowClick = (item: DentalImplantDensurItem) => {
    setSelectedItem(item)
    setClinicalDetails(null)

    if (!item.vn) return

    if (clinicalCacheRef.current.has(item.vn)) {
      setClinicalDetails(clinicalCacheRef.current.get(item.vn))
      return
    }

    detailAbortRef.current?.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller

    setLoadingClinical(true)
    fetch(
      `/api/service/dashboard-rcm/funds/dental-implant/densur/vn-details?vn=${encodeURIComponent(item.vn)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json?.data) {
          clinicalCacheRef.current.set(item.vn, json.data)
          setClinicalDetails(json.data)
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.error('Failed to load VN clinical details:', err)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingClinical(false)
        }
      })
  }

  const handleCloseModal = () => {
    detailAbortRef.current?.abort()
    setSelectedItem(null)
    setClinicalDetails(null)
  }

  // Copy to clipboard helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Export Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      const query = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) query.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/dental-implant/densur?${query.toString()}`
      )
      if (!res.ok) throw new Error('ไม่สามารถดาวน์โหลดข้อมูลเพื่อส่งออกได้')

      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่พบข้อมูลส่งออก')
      }

      const exportItems: DentalImplantDensurItem[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'ClaimCode',
        'สิทธิการรักษา',
        'สิทธิบัตรทอง (UC)',
        'แผนก',
        'คลินิก',
        'PDX',
        'DX0',
        'DX1',
        'DX2',
        'DX3',
        'DX4',
        'DX5',
        'OP0',
        'OP1',
        'OP2',
        'OP3',
        'OP4',
        'OP5',
        'รายการบริการผ่าตัด DENSUR',
        'สถานะการเบิกจ่าย',
        'เลขที่ REP',
        'ยอดชดเชย (บาท)',
        'กองทุนย่อย',
      ]

      const rows = exportItems.map((it) => [
        it.no,
        it.vn,
        it.hn,
        it.cid,
        it.ptname,
        it.sex,
        it.age,
        it.nation || '',
        it.vstdate,
        it.vsttime,
        it.authencode || '',
        it.pttypename,
        it.isUc ? 'ใช่' : 'ไม่ใช่',
        it.department || '',
        it.clinic || '',
        it.pdx || '',
        it.dx0 || '',
        it.dx1 || '',
        it.dx2 || '',
        it.dx3 || '',
        it.dx4 || '',
        it.dx5 || '',
        it.op0 || '',
        it.op1 || '',
        it.op2 || '',
        it.op3 || '',
        it.op4 || '',
        it.op5 || '',
        it.listname || '',
        it.status || 'รอตรวจสอบ',
        it.rep || '',
        it.compensated,
        it.subfund || '',
      ])

      await exportRcmExcel({
        filename: `dental_implant_densur_${ds1}_to_${ds2}.xlsx`,
        title: 'กองทุนรากฟันเทียม (DENSUR)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportItems.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(`การส่งออกไฟล์ล้มเหลว: ${err?.message || 'ข้อผิดพลาดไม่ทราบสาเหตุ'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="densur-container">
      {/* ── 1. Header & Breadcrumb ── */}
      <div className="densur-header">
        <div className="densur-breadcrumb">
          <Link href="/service/dashboard-rcm">แดชบอร์ด RCM</Link>
          <span className="densur-breadcrumb-separator">/</span>
          <span>กองทุน</span>
          <span className="densur-breadcrumb-separator">/</span>
          <span className="densur-breadcrumb-current">กองทุนรากฟันเทียม</span>
        </div>

        <div className="densur-title-row">
          <div className="densur-title-group">
            <h1 className="densur-title">
              กองทุนรากฟันเทียม
            </h1>
            <p className="densur-subtitle">
              รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR
            </p>
          </div>

          <div className="densur-actions">
            <button
              type="button"
              className="densur-btn densur-btn-secondary"
              onClick={() => fetchData(true)}
              disabled={loading || isRefreshing}
              title="รีเฟรชดึงข้อมูลล่าสุดจากระบบ HOSxP"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'densur-spinner' : ''}
              />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>

            <button
              type="button"
              className="densur-btn densur-btn-primary"
              onClick={handleExportExcel}
              disabled={isExporting || totalCount === 0}
              title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
            >
              <Download size={16} />
              <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Warnings & Banner (ADP Mapping Check) ── */}
      {adpMapping && !adpMapping.isMapped && (
        <div className="densur-warning-banner">
          <AlertTriangle size={20} className="densur-warning-icon" />
          <div className="densur-warning-content">
            <strong>แจ้งเตือนการแมปรหัส ADP:</strong>
            <span>
              ไม่พบการจับคู่รหัส ADP &apos;{adpMapping.adpCode}&apos; ในตาราง s_drugitems
              กรุณาตรวจสอบและตั้งค่ารหัสสิทธิการเบิกจ่าย DENSUR ในระบบ HOSxP
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Date Selector Toolbar (Single Unified Row) ── */}
      <div className="densur-date-toolbar">
        <div className="densur-date-left">
          {/* Segmented Mode Switcher: กำหนดเอง | เดือน | ปีงบประมาณ (ไม่มี () ในข้อความ) */}
          <div className="densur-segmented-tabs">
            <button
              type="button"
              className={`densur-tab-btn ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`densur-tab-btn ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={`densur-tab-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="densur-date-divider" />

          {/* Date Controls */}
          <div className="densur-date-inputs">
            {dateMode === 'custom' && (
              <div className="densur-date-range-group">
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  aria-label="วันที่เริ่มต้น"
                />
                <span className="densur-date-range-to">ถึง</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  aria-label="วันที่สิ้นสุด"
                />
              </div>
            )}

            {dateMode === 'monthly' && (
              <div className="densur-date-range-group">
                <select
                  className="densur-select"
                  value={selectedMonth}
                  onChange={(e) =>
                    handleMonthChange(parseInt(e.target.value, 10), selectedBeYear)
                  }
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  className="densur-select"
                  value={selectedBeYear}
                  onChange={(e) =>
                    handleMonthChange(selectedMonth, parseInt(e.target.value, 10))
                  }
                  aria-label="เลือกปี พ.ศ."
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateMode === 'fiscal' && (
              <select
                className="densur-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(parseInt(e.target.value, 10))}
                aria-label="เลือกปีงบประมาณ"
              >
                {[2569, 2570].map((y) => (
                  <option key={y} value={y}>
                    ปีงบ {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. KPI Summary Cards Grid (Clickable Filters) ── */}
      <div className="densur-kpi-grid">
        {/* Card 1: รายการทั้งหมด */}
        <div
          className={`densur-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="densur-kpi-top">
            <span className="densur-kpi-label">ผู้รับบริการทั้งหมด</span>
            <div className="densur-kpi-icon-wrap densur-kpi-icon-all">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="densur-kpi-value-row">
            <span className="densur-kpi-value">
              {(summary.totalCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="densur-kpi-unit">ครั้ง</span>
          </div>
          <div className="densur-kpi-sub">
            {(summary.uniquePatients ?? 0).toLocaleString('th-TH')} คน • ชดเชย {formatMoney(summary.totalCompensated)} บ.
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`densur-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="densur-kpi-top">
            <span className="densur-kpi-label">ชดเชยแล้ว</span>
            <div className="densur-kpi-icon-wrap densur-kpi-icon-success">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="densur-kpi-value-row">
            <span className="densur-kpi-value">
              {(summary.compensatedCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="densur-kpi-unit">ครั้ง</span>
          </div>
          <div className="densur-kpi-sub">
            ชดเชย {(summary.compensationRate ?? 0).toFixed(1)}% • {formatMoney(summary.totalCompensated)} บ.
          </div>
        </div>

        {/* Card 3: รอชดเชย / ยังไม่ชดเชย */}
        <div
          className={`densur-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้รับการชดเชย"
        >
          <div className="densur-kpi-top">
            <span className="densur-kpi-label">รอชดเชย</span>
            <div className="densur-kpi-icon-wrap densur-kpi-icon-warning">
              <Clock size={16} />
            </div>
          </div>
          <div className="densur-kpi-value-row">
            <span className="densur-kpi-value">
              {(summary.uncompensatedCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="densur-kpi-unit">ครั้ง</span>
          </div>
          <div className="densur-kpi-sub">
            รอผลตอบรับ e-Claim หรือ REP
          </div>
        </div>

        {/* Card 4: มี ClaimCode */}
        <div
          className={`densur-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรองรายการที่มี ClaimCode"
        >
          <div className="densur-kpi-top">
            <span className="densur-kpi-label">มี ClaimCode</span>
            <div className="densur-kpi-icon-wrap densur-kpi-icon-info">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="densur-kpi-value-row">
            <span className="densur-kpi-value">
              {(summary.withAuthenCount ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="densur-kpi-unit">ครั้ง</span>
          </div>
          <div className="densur-kpi-sub">
            คิดเป็น {(summary.authenRate ?? 0).toFixed(1)}% ของทั้งหมด
          </div>
        </div>

        {/* Card 5: ไม่มี ClaimCode */}
        <div
          className={`densur-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          title="คลิกเพื่อกรองรายการที่ไม่มี ClaimCode"
        >
          <div className="densur-kpi-top">
            <span className="densur-kpi-label">ไม่มี ClaimCode</span>
            <div className="densur-kpi-icon-wrap densur-kpi-icon-warning">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="densur-kpi-value-row">
            <span className="densur-kpi-value">
              {(summary.withoutAuthenCount ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="densur-kpi-unit">ครั้ง</span>
          </div>
          <div className="densur-kpi-sub">
            เสี่ยงติด C หรือปฏิเสธจ่าย
          </div>
        </div>

        {/* Card 6: สิทธิบัตรทอง (UC) */}
        <div
          className={`densur-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          title="คลิกเพื่อกรองเฉพาะผู้ใช้สิทธิบัตรทอง (UC)"
        >
          <div className="densur-kpi-top">
            <span className="densur-kpi-label">สิทธิบัตรทอง (UC)</span>
            <div className="densur-kpi-icon-wrap densur-kpi-icon-all">
              <User size={16} />
            </div>
          </div>
          <div className="densur-kpi-value-row">
            <span className="densur-kpi-value">
              {(summary.ucCount ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="densur-kpi-unit">ครั้ง</span>
          </div>
          <div className="densur-kpi-sub">
            คิดเป็น {(summary.ucRate ?? 0).toFixed(1)}% ของผู้รับบริการ
          </div>
        </div>
      </div>

      {/* ── 5. Search Bar & Toolbar (Unified Global Search) ── */}
      <div className="densur-toolbar">
        <div className="densur-search-box">
          <Search size={16} className="densur-search-icon" />
          <input
            type="text"
            className="densur-search-input"
            placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อผู้ป่วย, VN, การวินิจฉัย, หัตถการ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="densur-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <PttypeMultiSelect
          selectedCodes={pttypes}
          onChange={(codes) => {
            setPttypes(codes)
            setCurrentPage(1)
            }}
            items={items}
        
          />

        <div className="densur-toolbar-stats">
          <span>
            พบข้อมูล{' '}
            <span className="densur-stat-highlight">
              {totalCount.toLocaleString('th-TH')}
            </span>{' '}
            รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <span className="densur-filter-chip">
              <span>ตัวกรอง: {CARD_FILTER_LABELS[cardFilter]}</span>
              <button
                type="button"
                className="densur-chip-clear"
                onClick={() => handleCardFilterClick('ALL')}
                title="ล้างตัวกรอง"
                aria-label="ล้างตัวกรอง"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── 6. Error Notice ── */}
      {error && (
        <div className="densur-warning-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={20} className="densur-warning-icon" style={{ color: '#dc2626' }} />
          <div className="densur-warning-content">
            <strong>เกิดข้อผิดพลาด:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── 7. Table Card (100% Alignment Horizontal & Vertical, Row Clickable, No View Button) ── */}
      <div className="densur-table-card">
        {!error && (
          <div className="densur-table-responsive">
            <table className="densur-table">
              <thead>
                {/* Single Tier Centered Header */}
                <tr>
                  <th className="densur-col-no densur-col-center">ลำดับ</th>
                  <th className="densur-col-date densur-col-center">
                    <button
                      type="button"
                      className="densur-th-sort"
                      onClick={() => handleSort('vstdate')}
                    >
                      <span>วันที่รับบริการ</span>
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  </th>
                  <th className="densur-col-time densur-col-center">เวลา</th>
                  <th className="densur-col-hn densur-col-center">
                    <button
                      type="button"
                      className="densur-th-sort"
                      onClick={() => handleSort('hn')}
                    >
                      <span>HN</span>
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  </th>
                  <th className="densur-col-cid densur-col-center">
                    <button
                      type="button"
                      className="densur-th-sort"
                      onClick={() => handleSort('cid')}
                    >
                      <span>เลขบัตรประชาชน</span>
                      {sortBy === 'cid' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  </th>
                  <th className="densur-col-name densur-col-center">
                    <button
                      type="button"
                      className="densur-th-sort"
                      onClick={() => handleSort('ptname')}
                    >
                      <span>ชื่อ-สกุลผู้ป่วย</span>
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  </th>
                  <th className="densur-col-age densur-col-center">
                    <button
                      type="button"
                      className="densur-th-sort"
                      onClick={() => handleSort('age')}
                    >
                      <span>อายุ</span>
                      {sortBy === 'age' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  </th>
                  <th className="densur-col-pttype densur-col-center">สิทธิการรักษา</th>
                  <th className="densur-col-authen densur-col-center">
                    ClaimCode
                  </th>
                  <th className="densur-col-code densur-col-center">
                    <span className="densur-th-line">PDX</span>
                    <span className="densur-th-sub">การวินิจฉัย</span>
                  </th>
                  <th className="densur-col-code densur-col-center">DX0</th>
                  <th className="densur-col-code densur-col-center">DX1</th>
                  <th className="densur-col-code densur-col-center">DX2</th>
                  <th className="densur-col-code densur-col-center">DX3</th>
                  <th className="densur-col-code densur-col-center">DX4</th>
                  <th className="densur-col-code densur-col-center">DX5</th>
                  <th className="densur-col-code densur-col-center">
                    <span className="densur-th-line">OP0</span>
                    <span className="densur-th-sub">หัตถการ</span>
                  </th>
                  <th className="densur-col-code densur-col-center">OP1</th>
                  <th className="densur-col-code densur-col-center">OP2</th>
                  <th className="densur-col-code densur-col-center">OP3</th>
                  <th className="densur-col-code densur-col-center">OP4</th>
                  <th className="densur-col-code densur-col-center">OP5</th>
                  <th className="densur-col-listname densur-col-center">รายการผ่าตัด DENSUR</th>
                  <th className="densur-col-status densur-col-center">สถานะ</th>
                  <th className="densur-col-rep densur-col-center">เลขที่ REP</th>
                  <th className="densur-col-compensated densur-col-center">
                    <button
                      type="button"
                      className="densur-th-sort"
                      onClick={() => handleSort('compensated')}
                    >
                      <span>ชดเชย (บาท)</span>
                      {sortBy === 'compensated' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading || isRefreshing ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="rcm-skeleton-row">
                      {Array.from({ length: 26 }).map((__, colIdx) => (
                        <td key={colIdx} className="densur-col-center">
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={26} className="densur-col-center" style={{ padding: '48px 16px' }}>
                      ไม่พบรายการบริการผ่าตัดใส่รากฟันเทียม DENSUR ที่ตรงตามเงื่อนไขในช่วงเวลาหรือตัวกรองที่เลือก
                    </td>
                  </tr>
                ) : items.map((it) => (
                  <tr
                    key={it.vn}
                    onClick={() => handleRowClick(it)}
                    title="คลิกแถวเพื่อดูรายละเอียดข้อมูลเวชระเบียน"
                  >
                    <td className="densur-col-no">{it.no}</td>
                    <td className="densur-col-date">{formatThaiDate(it.vstdate)}</td>
                    <td className="densur-col-time">{it.vsttime || '—'}</td>
                    <td className="densur-col-hn">{it.hn}</td>
                    <td className="densur-col-cid">{it.cid || '—'}</td>
                    <td className="densur-col-name">{it.ptname}</td>
                    <td className="densur-col-age">{it.age}&nbsp;ปี</td>
                    <td className="densur-col-pttype">{it.pttypename || '—'}</td>
                    <td className="densur-col-authen">
                      {it.authencode ? (
                        <span className="densur-badge densur-badge-authen">{it.authencode}</span>
                      ) : (
                        <span className="densur-badge densur-badge-neutral">ไม่มี</span>
                      )}
                    </td>
                    <td className="densur-col-code">{it.pdx || '—'}</td>
                    <td className="densur-col-code">{it.dx0 || '—'}</td>
                    <td className="densur-col-code">{it.dx1 || '—'}</td>
                    <td className="densur-col-code">{it.dx2 || '—'}</td>
                    <td className="densur-col-code">{it.dx3 || '—'}</td>
                    <td className="densur-col-code">{it.dx4 || '—'}</td>
                    <td className="densur-col-code">{it.dx5 || '—'}</td>
                    <td className="densur-col-code">{it.op0 || '—'}</td>
                    <td className="densur-col-code">{it.op1 || '—'}</td>
                    <td className="densur-col-code">{it.op2 || '—'}</td>
                    <td className="densur-col-code">{it.op3 || '—'}</td>
                    <td className="densur-col-code">{it.op4 || '—'}</td>
                    <td className="densur-col-code">{it.op5 || '—'}</td>
                    <td className="densur-col-listname" title={it.listname || ''}>
                      {it.listname || '—'}
                    </td>
                    <td className="densur-col-status">
                      {it.status ? (
                        <span
                          className={`densur-badge ${
                            it.isCompensated
                              ? 'densur-badge-success'
                              : 'densur-badge-warning'
                          }`}
                        >
                          {it.status}
                        </span>
                      ) : (
                        <span className="densur-badge densur-badge-neutral">รอตรวจสอบ</span>
                      )}
                    </td>
                    <td className="densur-col-rep">{it.rep || '—'}</td>
                    <td className="densur-col-compensated">
                      {it.compensated > 0 ? (
                        <span style={{ color: '#059669' }}>{formatMoney(it.compensated)}</span>
                      ) : (
                        '0.00'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 8. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="densur-pagination">
            <div className="densur-page-info">
              <span>
                แสดงหน้า {currentPage} จาก {totalPages} หน้า (ทั้งหมด{' '}
                {totalCount.toLocaleString('th-TH')} รายการ)
              </span>
            </div>

            <div className="densur-page-nav">
              <button
                type="button"
                className="densur-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="densur-page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1
                  if (totalPages > 5 && currentPage > 3) {
                    pNum = currentPage - 2 + i
                    if (pNum > totalPages) pNum = totalPages - (4 - i)
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      className={`densur-page-num ${currentPage === pNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pNum)}
                    >
                      {pNum}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                className="densur-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Detail Modal (0ms Paint + Clinical Fetch) ── */}
      {selectedItem && (
        <div
          className="densur-modal-backdrop"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="densur-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="densur-modal-header">
              <div className="densur-modal-title-wrap">
                <Sparkles size={18} style={{ color: '#0d7446' }} />
                <h2 className="densur-modal-title">
                  รายละเอียดบริการผ่าตัดใส่รากฟันเทียม DENSUR
                </h2>
              </div>
              <button
                type="button"
                className="densur-modal-close"
                onClick={handleCloseModal}
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="densur-modal-body">
              {/* Section 1: ข้อมูลผู้ป่วยและการรับบริการ */}
              <div className="densur-modal-section">
                <h3 className="densur-modal-section-title">
                  <User size={15} /> ข้อมูลผู้ป่วยและการรับบริการ
                </h3>
                <div className="densur-modal-grid">
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">ชื่อ-สกุล</span>
                    <span className="densur-modal-item-value">{selectedItem.ptname}</span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">HN</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.hn}
                      <button
                        type="button"
                        className="densur-copy-btn"
                        onClick={() => handleCopy(selectedItem.hn, 'hn')}
                        title="คัดลอก HN"
                      >
                        {copiedField === 'hn' ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">เลขบัตรประชาชน (13 หลัก)</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.cid || '—'}
                      {selectedItem.cid && (
                        <button
                          type="button"
                          className="densur-copy-btn"
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอกเลขบัตรประชาชน"
                        >
                          {copiedField === 'cid' ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">VN</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.vn}
                      <button
                        type="button"
                        className="densur-copy-btn"
                        onClick={() => handleCopy(selectedItem.vn, 'vn')}
                        title="คัดลอก VN"
                      >
                        {copiedField === 'vn' ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">เพศ / อายุ</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.sex} • {selectedItem.age}&nbsp;ปี
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">วันที่และเวลารับบริการ</span>
                    <span className="densur-modal-item-value">
                      {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime || ''}
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">สิทธิการรักษา</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.pttypename} {selectedItem.isUc && '(บัตรทอง UC)'}
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">ClaimCode:</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.authencode ? (
                        <>
                          <span className="densur-badge densur-badge-authen">
                            {selectedItem.authencode}
                          </span>
                          <button
                            type="button"
                            className="densur-copy-btn"
                            onClick={() => handleCopy(selectedItem.authencode!, 'authen')}
                            title="คัดลอก ClaimCode"
                          >
                            {copiedField === 'authen' ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: การวินิจฉัยและหัตถการ */}
              <div className="densur-modal-section">
                <h3 className="densur-modal-section-title">
                  <Activity size={15} /> การวินิจฉัย (ICD-10) และหัตถการ (ICD-9)
                </h3>
                <div style={{ marginBottom: 12 }}>
                  <span className="densur-modal-item-label">รหัสการวินิจฉัย:</span>
                  <div className="densur-code-pill-list">
                    {selectedItem.pdx && (
                      <span className="densur-code-pill" style={{ borderColor: '#0d7446', color: '#0d7446', fontWeight: 600 }}>
                        PDX: {selectedItem.pdx}
                      </span>
                    )}
                    {[selectedItem.dx0, selectedItem.dx1, selectedItem.dx2, selectedItem.dx3, selectedItem.dx4, selectedItem.dx5]
                      .filter(Boolean)
                      .map((dx, idx) => (
                        <span key={idx} className="densur-code-pill">
                          DX{idx}: {dx}
                        </span>
                      ))}
                    {!selectedItem.pdx &&
                      !selectedItem.dx0 &&
                      !selectedItem.dx1 &&
                      !selectedItem.dx2 &&
                      !selectedItem.dx3 &&
                      !selectedItem.dx4 &&
                      !selectedItem.dx5 && <span>— ไม่พบรหัสการวินิจฉัย —</span>}
                  </div>
                </div>

                <div>
                  <span className="densur-modal-item-label">รหัสหัตถการ:</span>
                  <div className="densur-code-pill-list">
                    {[selectedItem.op0, selectedItem.op1, selectedItem.op2, selectedItem.op3, selectedItem.op4, selectedItem.op5]
                      .filter(Boolean)
                      .map((op, idx) => (
                        <span key={idx} className="densur-code-pill" style={{ backgroundColor: '#f0fdf4', borderColor: '#a7f3d0' }}>
                          OP{idx}: {op}
                        </span>
                      ))}
                    {!selectedItem.op0 &&
                      !selectedItem.op1 &&
                      !selectedItem.op2 &&
                      !selectedItem.op3 &&
                      !selectedItem.op4 &&
                      !selectedItem.op5 && <span>— ไม่พบรหัสหัตถการ —</span>}
                  </div>
                </div>
              </div>

              {/* Section 3: รายการบริการผ่าตัด DENSUR และสถานะการเบิกจ่าย */}
              <div className="densur-modal-section">
                <h3 className="densur-modal-section-title">
                  <FileText size={15} /> รายการผ่าตัด DENSUR และสถานะการเบิกจ่าย
                </h3>
                <div className="densur-modal-grid">
                  <div className="densur-modal-item" style={{ gridColumn: 'span 2' }}>
                    <span className="densur-modal-item-label">รายการบริการผ่าตัดที่บันทึก</span>
                    <span className="densur-modal-item-value" style={{ fontWeight: 600 }}>
                      {selectedItem.listname || '—'}
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">สถานะการชดเชย</span>
                    <span className="densur-modal-item-value">
                      <span
                        className={`densur-badge ${
                          selectedItem.isCompensated
                            ? 'densur-badge-success'
                            : 'densur-badge-warning'
                        }`}
                      >
                        {selectedItem.status || 'รอตรวจสอบ'}
                      </span>
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">เลขที่ REP</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.rep || '—'}
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">ยอดเงินชดเชยที่ได้รับ</span>
                    <span className="densur-modal-item-value" style={{ color: '#059669', fontSize: 16 }}>
                      {formatMoney(selectedItem.compensated)} บาท
                    </span>
                  </div>
                  <div className="densur-modal-item">
                    <span className="densur-modal-item-label">กองทุนย่อย / Agency</span>
                    <span className="densur-modal-item-value">
                      {selectedItem.subfund || selectedItem.agency || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: ข้อมูลคลินิกเชิงลึก (Lazy fetch) */}
              <div className="densur-modal-section">
                <h3 className="densur-modal-section-title">
                  <Stethoscope size={15} /> ข้อมูลเวชระเบียนคลินิกเพิ่มเติม
                </h3>
                {loadingClinical ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13, padding: '10px 0' }}>
                    <RefreshCw size={15} className="densur-spinner" />
                    <span>กำลังดึงข้อมูลเวชระเบียนคลินิกจาก HOSxP...</span>
                  </div>
                ) : clinicalDetails ? (
                  <div className="densur-modal-grid">
                    <div className="densur-modal-item">
                      <span className="densur-modal-item-label">อาการสำคัญ (CC)</span>
                      <span className="densur-modal-item-value">
                        {clinicalDetails.cc || clinicalDetails.chiefComplaint || '—'}
                      </span>
                    </div>
                    <div className="densur-modal-item">
                      <span className="densur-modal-item-label">สัญญาณชีพ (Vital Signs)</span>
                      <span className="densur-modal-item-value">
                        BP: {clinicalDetails.bps || '—'}/{clinicalDetails.bpd || '—'} mmHg, PR: {clinicalDetails.pulse || '—'} bpm
                      </span>
                    </div>
                    <div className="densur-modal-item">
                      <span className="densur-modal-item-label">แพทย์ผู้ตรวจ</span>
                      <span className="densur-modal-item-value">
                        {clinicalDetails.doctorName || clinicalDetails.doctor || '—'}
                      </span>
                    </div>
                    <div className="densur-modal-item">
                      <span className="densur-modal-item-label">แผนก / คลินิก</span>
                      <span className="densur-modal-item-value">
                        {clinicalDetails.department || selectedItem.department || '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af', fontSize: 13 }}>
                    ไม่พบข้อมูลคลินิกเพิ่มเติมหรือไม่ได้ระบุ
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="densur-modal-footer">
              <button
                type="button"
                className="densur-btn densur-btn-secondary"
                onClick={handleCloseModal}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
