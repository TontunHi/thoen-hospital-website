'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RefreshCw,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Building2,
  Stethoscope,
  Pill,
} from 'lucide-react'
import type {
  FamilyPlanning932Item,
  FamilyPlanning932Summary,
  FamilyPlanning932Format,
  FamilyPlanning932CardFilter,
  FamilyPlanning932SearchField,
  FamilyPlanning932SortField,
  FamilyPlanning932AdpMappingCheck,
  FamilyPlanningAdpMappingItem,
} from '@/lib/clinical/rcmFamilyPlanningService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
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

function formatMoney(val?: number | null): string {
  if (!val || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

export interface FamilyPlanning932ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function FamilyPlanning932Client({
  initialData,
  initialRange,
}: FamilyPlanning932ClientProps = {}) {
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

  // Date selection states: 1. กำหนดเอง (default) -> 2. รายเดือน -> 3. ปีงบประมาณ
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Format state: NEW_ECLAIM (FP001, FP002) vs KRUNGTHAI (20003, 20004)
  const [format, setFormat] = useState<FamilyPlanning932Format>('NEW_ECLAIM')

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<FamilyPlanning932CardFilter>('ALL')
  const [searchField, setSearchField] = useState<FamilyPlanning932SearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<FamilyPlanning932SortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data states
  const [items, setItems] = useState<FamilyPlanning932Item[]>(initialData?.items || [])
  const [summary, setSummary] = useState<FamilyPlanning932Summary | null>(initialData?.summary || null)
  const [adpMapping, setAdpMapping] = useState<FamilyPlanning932AdpMappingCheck | null>(initialData?.adpMapping || null)
  const [totalItems, setTotalItems] = useState<number>(initialData?.pagination?.totalItems || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.pagination?.totalPages || 1)
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [error, setError] = useState<string | null>(null)

  // Clinical Modal states
  const [selectedItem, setSelectedItem] = useState<FamilyPlanning932Item | null>(null)
  const [clinicalDetails, setClinicalDetails] = useState<VnClinicalDetails | null>(null)
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race condition prevention
  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Handle Date Mode Changes
  const handleDateModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mStr = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mStr}-01`)
      setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const fiscalCe = selectedFiscalYear - 543
      setDs1(`${fiscalCe - 1}-10-01`)
      setDs2(`${fiscalCe}-09-30`)
    }
    setPage(1)
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    const ceYear = selectedBeYear - 543
    const mStr = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    setPage(1)
  }

  const handleBeYearChange = (beYear: number) => {
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const mStr = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    setPage(1)
  }

  const handleFiscalYearChange = (beYear: number) => {
    setSelectedFiscalYear(beYear)
    const fiscalCe = beYear - 543
    setDs1(`${fiscalCe - 1}-10-01`)
    setDs2(`${fiscalCe}-09-30`)
    setPage(1)
  }

  // Fetch Report Data
  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          format,
          cardFilter,
          searchField,
          search,
          sortBy,
          sortOrder,
          page: String(page),
          pageSize: String(pageSize),
        })

        if (isRefresh) {
          queryParams.set('refresh', 'true')
        }

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/family-planning/service-9-3-2?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson?.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงาน 9.3.2 ได้`)
        }

        const json = await res.json()
        if (!json.success || !json.data) {
          throw new Error(json?.error?.message || 'รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง')
        }

        setItems(json.data.items || [])
        setSummary(json.data.summary || null)
        setAdpMapping(json.data.adpMapping || null)
        setTotalItems(json.data.pagination?.totalItems || 0)
        setTotalPages(json.data.pagination?.totalPages || 1)
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [ds1, ds2, format, cardFilter, searchField, search, sortBy, sortOrder, page, pageSize]
  )

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

  // Sorting Handler
  const handleSort = (field: FamilyPlanning932SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const renderSortIcon = (field: FamilyPlanning932SortField) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="opacity-40" />
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
  }

  // Open Clinical Modal
  const openClinicalModal = async (item: FamilyPlanning932Item) => {
    setSelectedItem(item)
    setClinicalDetails(null)
    setClinicalError(null)
    setClinicalLoading(true)

    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/family-planning/vn-details?vn=${item.vn}`)
      if (!res.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลเวชระเบียนของผู้รับบริการได้')
      }
      const json = await res.json()
      if (!json.success || !json.data) {
        throw new Error(json?.error?.message || 'ไม่พบข้อมูลเวชระเบียน')
      }
      setClinicalDetails(json.data)
    } catch (err: unknown) {
      const e = err as Error
      setClinicalError(e.message || 'เกิดข้อผิดพลาดในการโหลดเวชระเบียน')
    } finally {
      setClinicalLoading(false)
    }
  }

  const closeClinicalModal = () => {
    setSelectedItem(null)
    setClinicalDetails(null)
    setClinicalError(null)
    setCopiedField(null)
  }

  const copyText = (txt: string, fieldName: string) => {
    navigator.clipboard.writeText(txt)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Export to Excel / CSV
  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        format,
        cardFilter,
        searchField,
        search,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/family-planning/service-9-3-2?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับส่งออก')
        return
      }

      const rows: FamilyPlanning932Item[] = json.data.items

      const headers = [
        'ลำดับ',
        'วันที่รับบริการ',
        'VN',
        'AN',
        'เลขบัตรประชาชน (CID)',
        'HN',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สิทธิการรักษา',
        'Authen Code',
        'แผนก',
        'คลินิก',
        'รายการยา',
        'รายการค่าบริการ',
        'รหัส ADP',
        'การวินิจฉัย (Dx)',
        'หัตถการ (Op)',
        'ค่ารักษา (บาท)',
        'สถานะการส่ง',
        'เลขที่หนังสือ EClaim',
        'เลขที่หนังสือ Rep',
        'เลขที่หนังสือ NHSO',
        'ยอดชดเชย EClaim (บาท)',
        'ยอดชดเชย Rep (บาท)',
        'ยอดชดเชย NHSO (บาท)',
        'ยอดชดเชยรวม (บาท)',
      ]

      const csvRows = rows.map((r, i) => [
        i + 1,
        r.vstdate || '',
        r.vn || '',
        r.an || '',
        `="${r.cid}"`,
        `="${r.hn}"`,
        r.ptname || '',
        r.sex || '',
        r.age || '',
        r.pttypename || '',
        r.authencode || '',
        r.department || '',
        r.clinic || '',
        r.drugname ? `"${r.drugname.replace(/"/g, '""')}"` : '',
        r.listname ? `"${r.listname.replace(/"/g, '""')}"` : '',
        r.adpcode || '',
        r.dx ? `"${r.dx.replace(/"/g, '""')}"` : '',
        r.op ? `"${r.op.replace(/"/g, '""')}"` : '',
        r.income || 0,
        r.status || '',
        r.rep_eclaim || '',
        r.rep_rep || '',
        r.rep_nhso || '',
        r.compensated_eclaim || 0,
        r.compensated_rep || 0,
        r.compensated_nhso || 0,
        r.compensated || 0,
      ])

      const csvContent =
        '\uFEFF' +
        [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\r\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute(
        'download',
        `FP-9-3-2-Contraception-Women-20Plus-${ds1}-to-${ds2}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('ไม่สามารถส่งออกไฟล์ได้: ' + (err as Error).message)
    }
  }

  // Toggle card filter
  const handleCardFilterClick = (filter: FamilyPlanning932CardFilter) => {
    setCardFilter((prev: FamilyPlanning932CardFilter) => (prev === filter ? 'ALL' : filter))
    setPage(1)
  }

  return (
    <div className="fp932-page">
      {/* Header */}
      <div className="fp932-header">
        <div className="fp932-title-group">
          <div className="fp932-title-badge">
            <ShieldCheck size={14} />
            <span>กองทุนบริการวางแผนครอบครัว (FP) • ข้อ 9.3.2</span>
          </div>
          <h1 className="fp932-title">
            9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป
          </h1>
          <p className="fp932-subtitle">
            รายงานการให้บริการคุมกำเนิดกึ่งถาวร (รายการยาฝังคุมกำเนิด Norplant / Implanon / Jadelle และรายการบริการรหัส ADP: FP001, FP002) 
            ในหญิงอายุ 20 ปีขึ้นไป ตรวจสอบการลงรหัสวินิจฉัย (Dx), หัตถการ (Op), ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / REP / สปสช.
          </p>
        </div>

        <div className="fp932-header-actions">
          <select
            className="fp-format-select"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value as FamilyPlanning932Format)
              setPage(1)
            }}
            title="เลือกรูปแบบรหัส ADP"
          >
            <option value="NEW_ECLAIM">รูปแบบ E-Claim (FP001, FP002)</option>
            <option value="KRUNGTHAI">รูปแบบกรุงไทย (20003, 20004)</option>
          </select>

          <button
            type="button"
            className="fp-btn fp-btn-outline"
            onClick={() => fetchData(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            className="fp-btn fp-btn-primary"
            onClick={handleExport}
            disabled={loading || totalItems === 0}
          >
            <Download size={15} />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {/* ADP Mapping Status Banner */}
      {adpMapping && (
        <div
          className={`fp-adp-banner ${
            adpMapping.isMapped ? 'fp-adp-banner--ok' : 'fp-adp-banner--warn'
          }`}
        >
          <div className="fp-adp-banner-text">
            {adpMapping.isMapped ? (
              <>
                <CheckCircle2 size={18} />
                <span>
                  <strong>การ Map รหัส ADP:</strong> พบการตั้งค่า Map รหัส ADP ในระบบแล้ว ({adpMapping.mappedCount} รายการ: {adpMapping.adpCodes.join(', ')})
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} />
                <span>
                  <strong>คุณยังไม่ได้ Map ADP Code:</strong> ไม่พบการ Map รหัส ADP ในตาราง s_drugitems / nondrugitems สำหรับรหัส {adpMapping.adpCodes.join(', ')} กรุณาตรวจสอบการตั้งค่ารหัสสปสช.
                </span>
              </>
            )}
          </div>
          {adpMapping.items && adpMapping.items.length > 0 && (
            <div className="text-xs font-mono opacity-80">
              {adpMapping.items.map((it: FamilyPlanningAdpMappingItem) => `${it.icode}:${it.nhso_adp_code}`).join(' | ')}
            </div>
          )}
        </div>
      )}

      {/* Date Filter Panel */}
      <div className="fp-filter-panel">
        <div className="fp-date-mode-tabs">
          <button
            type="button"
            className={`fp-tab-btn ${dateMode === 'custom' ? 'fp-tab-btn--active' : ''}`}
            onClick={() => handleDateModeChange('custom')}
          >
            กำหนดวันเอง
          </button>
          <button
            type="button"
            className={`fp-tab-btn ${dateMode === 'monthly' ? 'fp-tab-btn--active' : ''}`}
            onClick={() => handleDateModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            className={`fp-tab-btn ${dateMode === 'fiscal' ? 'fp-tab-btn--active' : ''}`}
            onClick={() => handleDateModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="fp-date-inputs">
          {dateMode === 'custom' && (
            <>
              <div className="fp-date-group">
                <span className="fp-date-label">ตั้งแต่วันที่:</span>
                <ThaiDatePicker value={ds1} onChange={(v) => { setDs1(v); setPage(1); }} />
              </div>
              <div className="fp-date-group">
                <span className="fp-date-label">ถึงวันที่:</span>
                <ThaiDatePicker value={ds2} onChange={(v) => { setDs2(v); setPage(1); }} />
              </div>
            </>
          )}

          {dateMode === 'monthly' && (
            <>
              <div className="fp-date-group">
                <span className="fp-date-label">เดือน:</span>
                <select
                  className="fp-date-select"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fp-date-group">
                <span className="fp-date-label">ปี พ.ศ.:</span>
                <select
                  className="fp-date-select"
                  value={selectedBeYear}
                  onChange={(e) => handleBeYearChange(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {dateMode === 'fiscal' && (
            <div className="fp-date-group">
              <span className="fp-date-label">ปีงบประมาณ พ.ศ.:</span>
              <select
                className="fp-date-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-500 ml-auto font-medium">
            ช่วงวันที่ค้นหา: {formatThaiDate(ds1)} — {formatThaiDate(ds2)}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="fp-kpi-grid">
        <div
          className={`fp-kpi-card ${cardFilter === 'ALL' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="fp-kpi-icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.totalCases.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">
            {summary ? `ผู้ป่วยไม่ซ้ำ: ${summary.uniquePatients.toLocaleString()} คน` : 'กำลังคำนวณ...'}
          </div>
        </div>

        <div className="fp-kpi-card" style={{ cursor: 'default' }}>
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ค่ารักษารวม</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <Activity size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">
            {summary ? formatMoney(summary.totalIncome) : '—'}
          </div>
          <div className="fp-kpi-sub">ยอดเงินรวมตามจริงในระบบ</div>
        </div>

        <div className="fp-kpi-card" style={{ cursor: 'default' }}>
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ประมาณการชดเชยรวม</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-accent-soft)', color: 'var(--fp-accent)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">
            {summary ? formatMoney(summary.totalCompensated) : '—'}
          </div>
          <div className="fp-kpi-sub">
            {summary ? `REP: ${formatMoney(summary.totalCompensatedRep)} | สปสช: ${formatMoney(summary.totalCompensatedNhso)}` : '—'}
          </div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'COMPENSATED' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ได้รับการชดเชยแล้ว</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-ok-soft)', color: 'var(--fp-ok)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.compensatedCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">
            {summary ? `คิดเป็น ${summary.compensationRate}% ของผู้รับบริการ` : '—'}
          </div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ยังไม่ได้รับการชดเชย</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-warn-soft)', color: 'var(--fp-warn)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.uncompensatedCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">รอส่ง หรืออยู่ระหว่างการตอบรับ</div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'ECLAIM_SENT' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('ECLAIM_SENT')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ส่ง E-Claim แล้ว</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-blue-soft)', color: 'var(--fp-blue)' }}>
              <Check size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.eclaimSentCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">ส่งข้อมูลแล้ว / ได้รับผลการตรวจสอบ</div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'UNSENT' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('UNSENT')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ยังไม่ได้ส่ง</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.unsentCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">ยังไม่ได้ส่งเข้าโปรแกรม E-Claim</div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">มี Authen Code</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-ok-soft)', color: 'var(--fp-ok)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.withAuthenCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">
            {summary ? `คิดเป็น ${summary.authenRate}% ของผู้รับบริการ` : '—'}
          </div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">ไม่มี Authen Code</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-warn-soft)', color: 'var(--fp-warn)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.noAuthenCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">เสี่ยงติด C หรือไม่ได้รับชดเชย</div>
        </div>

        <div
          className={`fp-kpi-card ${cardFilter === 'HAS_ERROR' ? 'fp-kpi-card--active' : ''}`}
          onClick={() => handleCardFilterClick('HAS_ERROR')}
          role="button"
          tabIndex={0}
        >
          <div className="fp-kpi-top">
            <span className="fp-kpi-title">พบข้อผิดพลาด</span>
            <div className="fp-kpi-icon" style={{ backgroundColor: 'var(--fp-danger-soft)', color: 'var(--fp-danger)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="fp-kpi-value">{summary ? summary.hasErrorCount.toLocaleString() : '—'}</div>
          <div className="fp-kpi-sub">ไม่มี Dx / รายการยาหรือบริการ</div>
        </div>
      </div>

      {/* Controls Bar: Search & Filter Summary */}
      <div className="fp-controls-bar">
        <div className="fp-search-box">
          <select
            className="fp-search-select"
            value={searchField}
            onChange={(e) => {
              setSearchField(e.target.value as FamilyPlanning932SearchField)
              setPage(1)
            }}
          >
            <option value="ALL">ค้นหาทุกคอลัมน์</option>
            <option value="HN">HN</option>
            <option value="CID">เลขบัตรประชาชน (CID)</option>
            <option value="PTNAME">ชื่อ-สกุล</option>
            <option value="VN">VN</option>
            <option value="PTTYPE">สิทธิการรักษา</option>
            <option value="DEPARTMENT">แผนก</option>
            <option value="CLINIC">คลินิก</option>
            <option value="DX">รหัสโรค (Dx)</option>
            <option value="OP">หัตถการ (Op)</option>
            <option value="DRUG">รายการยา</option>
            <option value="SERVICE">รายการค่าบริการ</option>
            <option value="ADP">รหัส ADP</option>
            <option value="REP">เลขที่หนังสือ (REP)</option>
          </select>

          <div className="fp-search-input-wrap">
            <Search size={15} className="fp-search-icon-left" />
            <input
              type="text"
              className="fp-search-input"
              placeholder="พิมพ์คำค้นหา..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            {search && (
              <button
                type="button"
                className="fp-search-clear"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="fp-table-meta">
          {cardFilter !== 'ALL' && (
            <span className="fp-badge fp-badge-blue">
              ตัวกรองการ์ด: {cardFilter}
              <button
                type="button"
                onClick={() => {
                  setCardFilter('ALL')
                  setPage(1)
                }}
                className="ml-1 text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </span>
          )}
          <span>
            แสดงผล <strong>{items.length}</strong> จากทั้งหมด <strong>{totalItems}</strong> รายการ
          </span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="fp-table-card">
        {error ? (
          <div className="fp-empty-box">
            <AlertTriangle size={32} className="fp-empty-icon text-red-500 mx-auto" />
            <div className="fp-empty-title">เกิดข้อผิดพลาด</div>
            <div className="fp-empty-text">{error}</div>
            <button
              type="button"
              className="fp-btn fp-btn-outline mt-4"
              onClick={() => fetchData()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="fp-empty-box">
            <RefreshCw size={32} className="fp-empty-icon animate-spin mx-auto text-emerald-600" />
            <div className="fp-empty-title">กำลังดึงข้อมูลรายงาน 9.3.2...</div>
            <div className="fp-empty-text">กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูลจากระบบ HOSxP และ E-Claim</div>
          </div>
        ) : items.length === 0 ? (
          <div className="fp-empty-box">
            <Activity size={32} className="fp-empty-icon mx-auto text-slate-400" />
            <div className="fp-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
            <div className="fp-empty-text">
              ไม่พบผู้รับบริการคุมกำเนิดกึ่งถาวรในหญิงอายุ 20 ปีขึ้นไป ในช่วงวันที่ระบุ
            </div>
          </div>
        ) : (
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead>
                <tr className="fp-table-th-group">
                  <th colSpan={9}>ข้อมูลทั่วไปของผู้รับบริการ (หญิงอายุ 20 ปีขึ้นไป)</th>
                  <th colSpan={6}>การให้บริการ & รหัสตรวจสอบ (Dx / Op / ADP)</th>
                  <th colSpan={4}>สถานะ & เลขที่หนังสือ</th>
                  <th colSpan={4}>ประมาณการชดเชยค่าบริการ (บาท)</th>
                  <th colSpan={1}>จัดการ</th>
                </tr>
                <tr>
                  <th style={{ width: '45px' }}>ลำดับ</th>
                  <th className="fp-th-sortable" onClick={() => handleSort('vstdate')} style={{ width: '95px' }}>
                    <div className="fp-th-sortable-inner">
                      <span>วันที่</span>
                      {renderSortIcon('vstdate')}
                    </div>
                  </th>
                  <th style={{ width: '100px' }}>VN / AN</th>
                  <th className="fp-th-sortable" onClick={() => handleSort('cid')} style={{ width: '145px' }}>
                    <div className="fp-th-sortable-inner">
                      <span>เลขบัตรประชาชน (CID)</span>
                      {renderSortIcon('cid')}
                    </div>
                  </th>
                  <th className="fp-th-sortable" onClick={() => handleSort('hn')} style={{ width: '80px' }}>
                    <div className="fp-th-sortable-inner">
                      <span>HN</span>
                      {renderSortIcon('hn')}
                    </div>
                  </th>
                  <th className="th-left fp-th-sortable" onClick={() => handleSort('ptname')} style={{ minWidth: '160px' }}>
                    <div className="fp-th-sortable-inner justify-start">
                      <span>ชื่อ-สกุล</span>
                      {renderSortIcon('ptname')}
                    </div>
                  </th>
                  <th className="fp-th-sortable" onClick={() => handleSort('age')} style={{ width: '85px' }}>
                    <div className="fp-th-sortable-inner">
                      <span>เพศ/อายุ</span>
                      {renderSortIcon('age')}
                    </div>
                  </th>
                  <th style={{ minWidth: '110px' }}>สิทธิ</th>
                  <th style={{ width: '110px' }}>Authen Code</th>
                  <th style={{ minWidth: '140px' }}>รายการยาคุมกำเนิด</th>
                  <th style={{ minWidth: '140px' }}>รายการค่าบริการ</th>
                  <th style={{ width: '90px' }}>รหัส ADP</th>
                  <th style={{ width: '90px' }}>วินิจฉัย (Dx)</th>
                  <th style={{ width: '80px' }}>หัตถการ (Op)</th>
                  <th className="th-right fp-th-sortable" onClick={() => handleSort('income')} style={{ width: '90px' }}>
                    <div className="fp-th-sortable-inner justify-end">
                      <span>ค่ารักษา</span>
                      {renderSortIcon('income')}
                    </div>
                  </th>
                  <th className="fp-th-sortable" onClick={() => handleSort('status')} style={{ minWidth: '120px' }}>
                    <div className="fp-th-sortable-inner">
                      <span>สถานะการส่ง</span>
                      {renderSortIcon('status')}
                    </div>
                  </th>
                  <th style={{ width: '100px' }}>EClaim</th>
                  <th style={{ width: '100px' }}>Rep</th>
                  <th style={{ width: '100px' }}>Invoice</th>
                  <th className="th-right fp-th-sortable" onClick={() => handleSort('compensated_eclaim')} style={{ width: '85px' }}>
                    <div className="fp-th-sortable-inner justify-end">
                      <span>EClaim</span>
                      {renderSortIcon('compensated_eclaim')}
                    </div>
                  </th>
                  <th className="th-right fp-th-sortable" onClick={() => handleSort('compensated_rep')} style={{ width: '85px' }}>
                    <div className="fp-th-sortable-inner justify-end">
                      <span>Rep</span>
                      {renderSortIcon('compensated_rep')}
                    </div>
                  </th>
                  <th className="th-right fp-th-sortable" onClick={() => handleSort('compensated_nhso')} style={{ width: '85px' }}>
                    <div className="fp-th-sortable-inner justify-end">
                      <span>Invoice</span>
                      {renderSortIcon('compensated_nhso')}
                    </div>
                  </th>
                  <th className="th-right fp-th-sortable" onClick={() => handleSort('compensated')} style={{ width: '95px' }}>
                    <div className="fp-th-sortable-inner justify-end">
                      <span>ยอดชดเชย</span>
                      {renderSortIcon('compensated')}
                    </div>
                  </th>
                  <th style={{ width: '70px' }}>ดูข้อมูล</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.vn || row.no}>
                    <td className="font-mono text-slate-500">{row.no}</td>
                    <td className="whitespace-nowrap">{formatThaiDate(row.vstdate)}</td>
                    <td>
                      <button
                        type="button"
                        className="fp-vn-btn font-mono"
                        onClick={() => openClinicalModal(row)}
                        title="คลิกดูประวัติการรักษา"
                      >
                        {row.vn}
                      </button>
                      {row.an && <div className="text-xs text-slate-400 font-mono">AN: {row.an}</div>}
                    </td>
                    <td className="font-mono tracking-tight text-xs">
                      {formatCidDisplay(row.cid)}
                    </td>
                    <td className="font-mono text-xs">{row.hn}</td>
                    <td className="td-left font-medium whitespace-nowrap">{row.ptname}</td>
                    <td className="text-xs whitespace-nowrap">
                      {row.sex} {row.age} ปี
                    </td>
                    <td className="text-xs text-slate-600 truncate max-w-[130px]" title={row.pttypename}>
                      {row.pttypename}
                    </td>
                    <td>
                      {row.authencode ? (
                        <span className="fp-badge fp-badge-ok font-mono text-[11px]" title={row.authencode}>
                          {row.authencode}
                        </span>
                      ) : (
                        <span className="fp-badge fp-badge-warn text-[11px]">ไม่มี Authen</span>
                      )}
                    </td>
                    <td className="text-xs td-left">
                      {row.drugname ? (
                        <span className="fp-badge fp-badge-purple" title={row.drugname}>
                          <Pill size={11} />
                          <span>{row.drugname}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-xs td-left">
                      {row.listname ? (
                        <span className="fp-badge fp-badge-blue" title={row.listname}>
                          <Stethoscope size={11} />
                          <span>{row.listname}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td>
                      {row.adpcode ? (
                        <span className="font-mono font-semibold text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {row.adpcode}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td>
                      {row.dx ? (
                        <span className="font-mono font-medium text-xs text-slate-800">
                          {row.dx}
                        </span>
                      ) : (
                        <span className="fp-badge fp-badge-danger text-[11px]">ไม่มี Dx</span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-slate-700">
                      {row.op || '—'}
                    </td>
                    <td className="td-right font-medium">
                      {formatMoney(row.income)}
                    </td>
                    <td>
                      <span
                        className={`fp-badge text-[11px] whitespace-nowrap ${
                          row.status.includes('Invoice')
                            ? 'fp-badge-ok'
                            : row.status.includes('Rep')
                              ? 'fp-badge-ok'
                              : row.status.includes('E-Claim')
                                ? 'fp-badge-blue'
                                : 'fp-badge-gray'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-600 truncate max-w-[90px]" title={row.rep_eclaim || ''}>
                      {row.rep_eclaim || '—'}
                    </td>
                    <td className="font-mono text-xs text-slate-600 truncate max-w-[90px]" title={row.rep_rep || ''}>
                      {row.rep_rep || '—'}
                    </td>
                    <td className="font-mono text-xs text-slate-600 truncate max-w-[90px]" title={row.rep_nhso || ''}>
                      {row.rep_nhso || '—'}
                    </td>
                    <td className="td-right text-xs font-mono text-slate-600">
                      {formatMoney(row.compensated_eclaim)}
                    </td>
                    <td className="td-right text-xs font-mono text-slate-600">
                      {formatMoney(row.compensated_rep)}
                    </td>
                    <td className="td-right text-xs font-mono text-slate-600">
                      {formatMoney(row.compensated_nhso)}
                    </td>
                    <td className="td-right font-semibold text-emerald-700">
                      {formatMoney(row.compensated)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="fp-page-btn text-xs py-1 px-2"
                        onClick={() => openClinicalModal(row)}
                        title="ดูรายละเอียดเวชระเบียน"
                      >
                        ดูข้อมูล
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="fp-pagination-bar">
          <div className="fp-page-size-wrap">
            <span>แสดงแถวต่อหน้า:</span>
            <select
              className="fp-date-select py-1 px-2 text-xs"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          <div className="fp-pagination-nav">
            <button
              type="button"
              className="fp-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft size={16} />
              <span>ก่อนหน้า</span>
            </button>

            <span className="fp-page-info">
              หน้า <strong>{page}</strong> จาก <strong>{totalPages}</strong>
            </span>

            <button
              type="button"
              className="fp-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <span>ถัดไป</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Clinical Details Modal */}
      {selectedItem && (
        <div className="fp-modal-overlay" onClick={closeClinicalModal}>
          <div className="fp-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fp-modal-header">
              <div className="fp-modal-header-left">
                <div className="fp-modal-icon-badge">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h3 className="fp-modal-title">
                    {selectedItem.ptname} (HN: {selectedItem.hn})
                  </h3>
                  <p className="fp-modal-sub">
                    VN: {selectedItem.vn} • วันที่ {formatThaiDate(selectedItem.vstdate)} • เพศ {selectedItem.sex} อายุ {selectedItem.age} ปี
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="fp-modal-close"
                onClick={closeClinicalModal}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="fp-modal-body">
              {/* Quick Copy Action Bar */}
              <div className="fp-modal-copy-bar">
                <button
                  type="button"
                  className="fp-copy-btn"
                  onClick={() => copyText(selectedItem.hn, 'hn')}
                >
                  {copiedField === 'hn' ? <Check size={12} /> : <Copy size={12} />}
                  <span>HN: {selectedItem.hn}</span>
                </button>
                <button
                  type="button"
                  className="fp-copy-btn"
                  onClick={() => copyText(selectedItem.cid, 'cid')}
                >
                  {copiedField === 'cid' ? <Check size={12} /> : <Copy size={12} />}
                  <span>CID: {formatCidDisplay(selectedItem.cid)}</span>
                </button>
                <button
                  type="button"
                  className="fp-copy-btn"
                  onClick={() => copyText(selectedItem.vn, 'vn')}
                >
                  {copiedField === 'vn' ? <Check size={12} /> : <Copy size={12} />}
                  <span>VN: {selectedItem.vn}</span>
                </button>
                {selectedItem.authencode && (
                  <button
                    type="button"
                    className="fp-copy-btn"
                    onClick={() => copyText(selectedItem.authencode || '', 'authen')}
                  >
                    {copiedField === 'authen' ? <Check size={12} /> : <Copy size={12} />}
                    <span>Authen: {selectedItem.authencode}</span>
                  </button>
                )}
              </div>

              {/* Status & Error Notice */}
              {selectedItem.hasError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>ข้อผิดพลาด:</strong> {selectedItem.errorDetail || 'กรุณาตรวจสอบการลงรหัส Dx หรือรายการค่าบริการ'}
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>ข้อมูลการให้บริการคุมกำเนิดกึ่งถาวรและรหัสครบถ้วน</span>
                </div>
              )}

              {/* Grid 2 Columns */}
              <div className="fp-modal-grid-2">
                <div className="fp-modal-card-box">
                  <div className="fp-modal-card-title">
                    <Building2 size={15} />
                    <span>ข้อมูลการรับบริการ</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">วันที่รับบริการ:</span>
                    <span className="fp-modal-val">{formatThaiDate(selectedItem.vstdate)}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">สิทธิการรักษา:</span>
                    <span className="fp-modal-val">{selectedItem.pttypename}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">แผนก / แผนกตรวจ:</span>
                    <span className="fp-modal-val">{selectedItem.department || '—'}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">คลินิก:</span>
                    <span className="fp-modal-val">{selectedItem.clinic || '—'}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">Authen Claim Code:</span>
                    <span className="fp-modal-val font-mono">{selectedItem.authencode || '—'}</span>
                  </div>
                </div>

                <div className="fp-modal-card-box">
                  <div className="fp-modal-card-title">
                    <ShieldCheck size={15} />
                    <span>การชดเชย & เลขที่หนังสือ</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">สถานะการส่ง:</span>
                    <span className="fp-modal-val">{selectedItem.status}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">เลขที่หนังสือ EClaim:</span>
                    <span className="fp-modal-val font-mono">{selectedItem.rep_eclaim || '—'}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">เลขที่หนังสือ Rep:</span>
                    <span className="fp-modal-val font-mono">{selectedItem.rep_rep || '—'}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">เลขที่หนังสือ Invoice:</span>
                    <span className="fp-modal-val font-mono">{selectedItem.rep_nhso || '—'}</span>
                  </div>
                  <div className="fp-modal-row">
                    <span className="fp-modal-label">ยอดชดเชยสุทธิ:</span>
                    <span className="fp-modal-val font-bold text-emerald-700">
                      {formatMoney(selectedItem.compensated)} บาท
                    </span>
                  </div>
                </div>
              </div>

              {/* Medical Coding & Clinical Summary */}
              <div className="fp-modal-card-box">
                <div className="fp-modal-card-title">
                  <Pill size={15} />
                  <span>การให้รหัสโรค หัตถการ และรายการยา/บริการคุมกำเนิด</span>
                </div>
                <div className="fp-modal-row">
                  <span className="fp-modal-label">รหัสการวินิจฉัย (Dx):</span>
                  <span className="fp-modal-val font-mono font-medium">{selectedItem.dx || '—'}</span>
                </div>
                <div className="fp-modal-row">
                  <span className="fp-modal-label">รหัสหัตถการ (Op):</span>
                  <span className="fp-modal-val font-mono font-medium">{selectedItem.op || '—'}</span>
                </div>
                <div className="fp-modal-row">
                  <span className="fp-modal-label">รายการยาคุมกำเนิด (Norplant / Implant):</span>
                  <span className="fp-modal-val font-medium text-purple-700">{selectedItem.drugname || '—'}</span>
                </div>
                <div className="fp-modal-row">
                  <span className="fp-modal-label">รายการค่าบริการ (ADP):</span>
                  <span className="fp-modal-val font-medium text-sky-700">{selectedItem.listname || '—'}</span>
                </div>
                <div className="fp-modal-row">
                  <span className="fp-modal-label">รหัส ADP สปสช.:</span>
                  <span className="fp-modal-val font-mono font-bold text-emerald-800">{selectedItem.adpcode || '—'}</span>
                </div>
                <div className="fp-modal-row">
                  <span className="fp-modal-label">ค่ารักษาพยาบาล (Income):</span>
                  <span className="fp-modal-val font-medium">{formatMoney(selectedItem.income)} บาท</span>
                </div>
              </div>

              {/* Extended Clinical Details from API if available */}
              {clinicalLoading ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  <RefreshCw size={18} className="animate-spin inline mr-2 text-emerald-600" />
                  กำลังโหลดข้อมูลเวชระเบียนเพิ่มเติม...
                </div>
              ) : clinicalError ? (
                <div className="text-xs text-slate-400 italic text-center">
                  (ไม่พบข้อมูลเวชระเบียนแบบละเอียดเพิ่มเติมจาก HOSxP)
                </div>
              ) : clinicalDetails ? (
                <div className="fp-modal-card-box">
                  <div className="fp-modal-card-title">
                    <Activity size={15} />
                    <span>อาการสำคัญ & การตรวจร่างกาย (HOSxP)</span>
                  </div>
                  {clinicalDetails.screen?.cc && (
                    <div className="fp-modal-row">
                      <span className="fp-modal-label">อาการสำคัญ (CC):</span>
                      <span className="fp-modal-val td-left max-w-[500px]">{clinicalDetails.screen.cc}</span>
                    </div>
                  )}
                  {clinicalDetails.screen?.hpi && (
                    <div className="fp-modal-row">
                      <span className="fp-modal-label">ประวัติปัจจุบัน (PI):</span>
                      <span className="fp-modal-val td-left max-w-[500px]">{clinicalDetails.screen.hpi}</span>
                    </div>
                  )}
                  {clinicalDetails.screen && (
                    <div className="fp-modal-row">
                      <span className="fp-modal-label">สัญญาณชีพ:</span>
                      <span className="fp-modal-val">
                        BP: {clinicalDetails.screen.bps || '—'}/{clinicalDetails.screen.bpd || '—'} mmHg • 
                        PR: {clinicalDetails.screen.pulse || '—'} bpm • 
                        T: {clinicalDetails.screen.temperature || '—'} °C • 
                        BW: {clinicalDetails.screen.bw || '—'} kg
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="fp-modal-footer">
              <button
                type="button"
                className="fp-btn fp-btn-outline"
                onClick={closeClinicalModal}
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
