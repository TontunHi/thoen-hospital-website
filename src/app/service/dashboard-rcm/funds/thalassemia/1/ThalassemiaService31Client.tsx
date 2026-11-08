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
  Copy,
  Check,
  Droplet,
  Baby,
  Activity,
  Building2,
  Calendar,
  Filter,
} from 'lucide-react'
import type {
  ThalassemiaItem,
  ThalassemiaSummary,
  ThalassemiaCardFilter,
  ThalassemiaLaborTypeFilter,
  ThalassemiaSearchField,
  ThalassemiaSortField,
  ThalassemiaAdpMappingCheck,
} from '@/lib/clinical/rcmThalassemiaService'
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

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

export interface ThalassemiaService31ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function ThalassemiaService31Client({
  initialData,
  initialRange,
}: ThalassemiaService31ClientProps = {}) {
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

  // Date selection states
  const [dateMode, setDateMode] = useState<'fiscal' | 'monthly' | 'custom'>('fiscal')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<ThalassemiaCardFilter>('ALL')
  const [laborTypeFilter, setLaborTypeFilter] = useState<ThalassemiaLaborTypeFilter>('ALL')
  const [searchField, setSearchField] = useState<ThalassemiaSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<ThalassemiaSortField>('labor_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ThalassemiaItem[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<ThalassemiaAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<ThalassemiaSummary>(
    initialData?.summary || {
      totalMothers: 0,
      screenedCount: 0,
      unscreenedCount: 0,
      screeningRate: 0,
      normalCount: 0,
      riskCount: 0,
      pendingCount: 0,
      thoenHospitalCount: 0,
      otherHospitalCount: 0,
      normalLaborCount: 0,
      cesareanLaborCount: 0,
      otherLaborCount: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Modal inspection states
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Recalculate ds1/ds2 on dateMode changes
  useEffect(() => {
    if (dateMode === 'fiscal') {
      const ce = selectedFiscalYear - 543
      setDs1(`${ce - 1}-10-01`)
      setDs2(`${ce}-09-30`)
      setCurrentPage(1)
    } else if (dateMode === 'monthly') {
      const ce = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ce, selectedMonth, 0).getDate()
      setDs1(`${ce}-${mm}-01`)
      setDs2(`${ce}-${mm}-${String(lastDay).padStart(2, '0')}`)
      setCurrentPage(1)
    }
  }, [dateMode, selectedFiscalYear, selectedMonth, selectedBeYear])

  // Fetch report data
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      if (forceRefresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const q = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          laborTypeFilter,
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (forceRefresh) {
          q.set('refresh', 'true')
        }

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/thalassemia/service-31?${q.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        setItems(json.data.items || [])
        setTotalCount(json.data.totalCount || 0)
        setTotalPages(json.data.totalPages || 1)
        if (json.data.summary) setSummary(json.data.summary)
        if (json.data.adpMapping) setAdpMapping(json.data.adpMapping)
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [
      ds1,
      ds2,
      cardFilter,
      laborTypeFilter,
      searchField,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
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

  // Selected item for modal
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null

  // Sort handler
  const handleSort = (field: ThalassemiaSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIndicator = (field: ThalassemiaSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} className="text-muted" aria-hidden="true" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="text-accent" aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className="text-accent" aria-hidden="true" />
    )
  }

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Export CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        laborTypeFilter,
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/thalassemia/service-31?${q.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถส่งออกข้อมูลได้')
      }

      const rows: ThalassemiaItem[] = json.data.items || []
      const headers = [
        'ลำดับ',
        'วันที่คลอด',
        'เลขที่ ANC',
        'HN',
        'เลขประจำตัวประชาชน',
        'ชื่อ-สกุล',
        'อายุ (ปี)',
        'สิทธิการรักษา',
        'ที่อยู่',
        'วิธีการคลอด',
        'โรงพยาบาลที่คลอด',
        'รหัส Lab',
        'ชื่อการตรวจ Lab',
        'ผลการตรวจ Lab',
        'วันที่ตรวจ Lab',
        'สถานะการตรวจ',
        'รายการตรวจ ADP ที่สั่ง',
      ]

      const csvRows = [
        headers.join(','),
        ...rows.map((r, idx) =>
          [
            idx + 1,
            `"${formatThaiDate(r.labor_date)}"`,
            `"${r.ancno}"`,
            `"${r.hn}"`,
            `"${r.cid}"`,
            `"${r.ptname}"`,
            r.age,
            `"${(r.pttypename || '').replace(/"/g, '""')}"`,
            `"${(r.address || '').replace(/"/g, '""')}"`,
            `"${(r.labor_type || '').replace(/"/g, '""')}"`,
            `"${(r.hospital || '').replace(/"/g, '""')}"`,
            `"${(r.labcode || '').replace(/"/g, '""')}"`,
            `"${(r.labname || '').replace(/"/g, '""')}"`,
            `"${(r.labresult || '').replace(/"/g, '""')}"`,
            `"${r.lab_order_date ? formatThaiDate(r.lab_order_date) : ''}"`,
            `"${r.lab_status}"`,
            `"${(r.ordered_adp_items || '').replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ]

      const csvContent = '\uFEFF' + csvRows.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `thalassemia-screening-3.1_${ds1}_to_${ds2}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const e = err as Error
      alert(e.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="thal31-page">
      {/* ── 1. Header Bar ── */}
      <header className="thal31-header">
        <div className="thal31-title-group">
          <h1 className="thal31-title">3.1 คัดกรองธาลัสซีเมีย</h1>
          <p className="thal31-subtitle">
            รายงานการตรวจคัดกรองโรคโลหิตจางธาลัสซีเมียในหญิงตั้งครรภ์ ตรวจสอบผลตรวจทางห้องปฏิบัติการ DCIP,
            Hemoglobin typing และรายการตรวจรหัส ADP 30313, 37532 โรงพยาบาลเถิน
          </p>
        </div>

        <div className="thal31-header-actions">
          <button
            type="button"
            className="thal31-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            aria-busy={isRefreshing}
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? 'thal31-spin-icon' : undefined}
              aria-hidden="true"
            />
            {isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
          </button>
          <button
            type="button"
            className="thal31-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || totalCount === 0}
            aria-busy={isExporting}
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? 'กำลังส่งออก...' : 'ส่งออกข้อมูล CSV'}
          </button>
        </div>
      </header>

      {/* ── 2. Warning Banner when ADP code is unmapped ── */}
      {!adpMapping.isMapped && (
        <div className="thal31-banner thal31-banner-warn" role="alert">
          <div className="thal31-banner-content">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              <strong>แจ้งเตือน:</strong> คุณยังไม่ได้ Map รหัส ADP Code <code>30313</code> หรือ{' '}
              <code>37532</code> ในตาราง <code>s_drugitems</code> กรุณาตรวจสอบการตั้งค่ารายการตรวจในระบบ HOSxP
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Interactive KPI Summary Cards (Filter via card) ── */}
      <section
        className="thal31-summary-grid"
        aria-label="สรุปภาพรวมการคัดกรองธาลัสซีเมีย (สามารถคลิกการ์ดเพื่อกรองข้อมูล)"
      >
        <button
          type="button"
          className="thal31-summary-card"
          aria-pressed={cardFilter === 'ALL'}
          onClick={() => {
            setCardFilter('ALL')
            setCurrentPage(1)
          }}
        >
          <div className="thal31-card-header">
            <span className="thal31-card-label">หญิงตั้งครรภ์ที่คลอดทั้งหมด</span>
            <Baby size={16} className="text-muted" aria-hidden="true" />
          </div>
          <span className="thal31-card-val font-tabular">{summary.totalMothers.toLocaleString()}</span>
          <span className="thal31-card-sub">
            คลอดปกติ {summary.normalLaborCount} • ผ่าตัด {summary.cesareanLaborCount}
          </span>
        </button>

        <button
          type="button"
          className="thal31-summary-card"
          aria-pressed={cardFilter === 'SCREENED'}
          onClick={() => {
            setCardFilter((prev) => (prev === 'SCREENED' ? 'ALL' : 'SCREENED'))
            setCurrentPage(1)
          }}
        >
          <div className="thal31-card-header">
            <span className="thal31-card-label">ตรวจคัดกรอง Lab แล้ว</span>
            <span className="thal31-card-badge thal31-badge-ok">ตรวจแล้ว</span>
          </div>
          <span className="thal31-card-val text-ok font-tabular">
            {summary.screenedCount.toLocaleString()}
          </span>
          <span className="thal31-card-sub text-ok">{summary.screeningRate}% ของหญิงตั้งครรภ์</span>
        </button>

        <button
          type="button"
          className="thal31-summary-card"
          aria-pressed={cardFilter === 'UNSCREENED'}
          onClick={() => {
            setCardFilter((prev) => (prev === 'UNSCREENED' ? 'ALL' : 'UNSCREENED'))
            setCurrentPage(1)
          }}
        >
          <div className="thal31-card-header">
            <span className="thal31-card-label">ยังไม่มีผลตรวจ Lab</span>
            <span className="thal31-card-badge thal31-badge-danger">ยังไม่ตรวจ</span>
          </div>
          <span className="thal31-card-val text-danger font-tabular">
            {summary.unscreenedCount.toLocaleString()}
          </span>
          <span className="thal31-card-sub text-danger">ควรติดตามตรวจก่อนหรือหลังคลอด</span>
        </button>

        <button
          type="button"
          className="thal31-summary-card"
          aria-pressed={cardFilter === 'NORMAL'}
          onClick={() => {
            setCardFilter((prev) => (prev === 'NORMAL' ? 'ALL' : 'NORMAL'))
            setCurrentPage(1)
          }}
        >
          <div className="thal31-card-header">
            <span className="thal31-card-label">ผลตรวจปกติ (Negative)</span>
            <span className="thal31-card-badge thal31-badge-ok">ปกติ</span>
          </div>
          <span className="thal31-card-val text-ok font-tabular">
            {summary.normalCount.toLocaleString()}
          </span>
          <span className="thal31-card-sub">DCIP / OF / Hb typing ปกติ</span>
        </button>

        <button
          type="button"
          className="thal31-summary-card"
          aria-pressed={cardFilter === 'RISK'}
          onClick={() => {
            setCardFilter((prev) => (prev === 'RISK' ? 'ALL' : 'RISK'))
            setCurrentPage(1)
          }}
        >
          <div className="thal31-card-header">
            <span className="thal31-card-label">ผลผิดปกติ / กลุ่มเสี่ยง</span>
            <span className="thal31-card-badge thal31-badge-danger">เสี่ยง/บวก</span>
          </div>
          <span className="thal31-card-val text-danger font-tabular">
            {summary.riskCount.toLocaleString()}
          </span>
          <span className="thal31-card-sub text-danger">DCIP Positive / พาหะ / เสี่ยงสูง</span>
        </button>

        <button
          type="button"
          className="thal31-summary-card"
          aria-pressed={cardFilter === 'THOEN_HOSPITAL'}
          onClick={() => {
            setCardFilter((prev) => (prev === 'THOEN_HOSPITAL' ? 'ALL' : 'THOEN_HOSPITAL'))
            setCurrentPage(1)
          }}
        >
          <div className="thal31-card-header">
            <span className="thal31-card-label">คลอดที่ รพ.เถิน</span>
            <Building2 size={16} className="text-muted" aria-hidden="true" />
          </div>
          <span className="thal31-card-val font-tabular">
            {summary.thoenHospitalCount.toLocaleString()}
          </span>
          <span className="thal31-card-sub">รพ.อื่น {summary.otherHospitalCount} ราย</span>
        </button>
      </section>

      {/* ── 4. Filter & Search Controls ── */}
      <section className="thal31-controls-card" aria-label="ตัวกรองและค้นหาข้อมูล">
        <div className="thal31-period-row">
          <div className="thal31-period-left">
            <span className="thal31-field-label">รูปแบบช่วงเวลา</span>
            <div className="thal31-mode-tabs" role="group" aria-label="รูปแบบช่วงเวลา">
              <button
                type="button"
                aria-pressed={dateMode === 'custom'}
                className={`thal31-mode-tab ${dateMode === 'custom' ? 'active' : ''}`}
                onClick={() => setDateMode('custom')}
              >
                กำหนดเอง
              </button>
              <button
                type="button"
                aria-pressed={dateMode === 'monthly'}
                className={`thal31-mode-tab ${dateMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setDateMode('monthly')}
              >
                รายเดือน
              </button>
              <button
                type="button"
                aria-pressed={dateMode === 'fiscal'}
                className={`thal31-mode-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
                onClick={() => setDateMode('fiscal')}
              >
                ปีงบประมาณ
              </button>
            </div>
          </div>

          <div className="thal31-period-selectors">
            {dateMode === 'fiscal' && (
              <div className="thal31-date-range-box">
                <span className="thal31-field-label">ปีงบประมาณ พ.ศ.</span>
                <select
                  className="thal31-select"
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                  aria-label="เลือกปีงบประมาณ"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateMode === 'monthly' && (
              <div className="thal31-date-range-box">
                <span className="thal31-field-label">เดือน</span>
                <select
                  className="thal31-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <span className="thal31-field-label">ปี พ.ศ.</span>
                <select
                  className="thal31-select"
                  value={selectedBeYear}
                  onChange={(e) => setSelectedBeYear(Number(e.target.value))}
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

            {dateMode === 'custom' && (
              <div className="thal31-date-range-box">
                <span className="thal31-field-label">ตั้งแต่วันที่</span>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  aria-label="ตั้งแต่วันที่"
                />
                <span className="thal31-field-label">ถึงวันที่</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  aria-label="ถึงวันที่"
                />
              </div>
            )}
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="thal31-filter-row">
          <div className="thal31-filter-group">
            <span className="thal31-field-label">วิธีการคลอด:</span>
            <select
              className="thal31-select"
              value={laborTypeFilter}
              onChange={(e) => {
                setLaborTypeFilter(e.target.value as ThalassemiaLaborTypeFilter)
                setCurrentPage(1)
              }}
              aria-label="กรองวิธีการคลอด"
            >
              <option value="ALL">ทุกวิธีการคลอด</option>
              <option value="NORMAL">คลอดปกติ (NORMAL)</option>
              <option value="CESAREAN">ผ่าตัดคลอด (CESAREAN)</option>
              <option value="OTHER">อื่นๆ / ท่าก้น / สูญญากาศ</option>
            </select>

            <div className="thal31-search-box">
              <Search size={16} className="thal31-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="thal31-search-input"
                placeholder="พิมพ์คำค้นหา (เช่น HN, ชื่อ, ผลตรวจ, รพ.)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="ช่องค้นหาข้อมูล"
              />
              {search && (
                <button
                  type="button"
                  className="thal31-clear-btn"
                  onClick={() => setSearch('')}
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Main Data Table ── */}
      <section className="thal31-table-card" aria-label="ตารางรายชื่อหญิงตั้งครรภ์และการตรวจคัดกรองธาลัสซีเมีย">
        <div className="thal31-table-header-meta">
          <div>
            <span>
              พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString()}</strong> รายการ (แสดงหน้า {currentPage} จาก{' '}
              {totalPages} หน้า)
            </span>
            {cardFilter !== 'ALL' && (
              <span style={{ marginLeft: 10 }}>
                • ตัวกรองการ์ด: <strong>{cardFilter}</strong>
              </span>
            )}
            {laborTypeFilter !== 'ALL' && (
              <span style={{ marginLeft: 10 }}>
                • ตัวกรองคลอด: <strong>{laborTypeFilter}</strong>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="thal31-field-label">แสดงหน้าละ:</span>
            <select
              className="thal31-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              style={{ minHeight: 34, padding: '0 8px' }}
              aria-label="จำนวนรายการต่อหน้า"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="thal31-table-wrap">
          {loading ? (
            <div className="thal31-loading-state">
              <RefreshCw size={28} className="thal31-spin-icon" style={{ color: 'var(--thal-accent)' }} />
              <p>กำลังโหลดข้อมูลการคัดกรองธาลัสซีเมีย...</p>
            </div>
          ) : error ? (
            <div className="thal31-empty-state" style={{ color: 'var(--thal-danger)' }}>
              <AlertTriangle size={32} />
              <p>เกิดข้อผิดพลาด: {error}</p>
              <button
                type="button"
                className="thal31-btn-secondary"
                onClick={() => fetchData()}
                style={{ marginTop: 8 }}
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="thal31-empty-state">
              <Activity size={32} />
              <p>ไม่พบข้อมูลตามเงื่อนไขช่วงเวลาหรือตัวกรองที่เลือก</p>
            </div>
          ) : (
            <table className="thal31-table">
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: 'center' }}>ลำดับ</th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('labor_date')}
                    title="คลิกเพื่อเรียงตามวันที่คลอด"
                  >
                    <span className="thal31-sort-label">
                      วันที่คลอด {renderSortIndicator('labor_date')}
                    </span>
                  </th>
                  <th style={{ width: 80, textAlign: 'center' }}>เลขที่ ANC</th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('hn')}
                    title="คลิกเพื่อเรียงตาม HN"
                  >
                    <span className="thal31-sort-label">HN {renderSortIndicator('hn')}</span>
                  </th>
                  <th>เลขประจำตัวประชาชน (CID)</th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('ptname')}
                    title="คลิกเพื่อเรียงตามชื่อผู้รับบริการ"
                  >
                    <span className="thal31-sort-label">
                      ชื่อ-สกุล หญิงตั้งครรภ์ {renderSortIndicator('ptname')}
                    </span>
                  </th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('age')}
                    style={{ textAlign: 'center' }}
                    title="คลิกเพื่อเรียงตามอายุ"
                  >
                    <span className="thal31-sort-label">อายุ {renderSortIndicator('age')}</span>
                  </th>
                  <th>สิทธิการรักษา</th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('labor_type')}
                    title="คลิกเพื่อเรียงตามวิธีการคลอด"
                  >
                    <span className="thal31-sort-label">
                      วิธีการคลอด {renderSortIndicator('labor_type')}
                    </span>
                  </th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('hospital')}
                    title="คลิกเพื่อเรียงตามโรงพยาบาลที่คลอด"
                  >
                    <span className="thal31-sort-label">
                      โรงพยาบาลที่คลอด {renderSortIndicator('hospital')}
                    </span>
                  </th>
                  <th>รายการตรวจ Lab</th>
                  <th
                    className="thal31-table-th-sortable"
                    onClick={() => handleSort('labresult')}
                    title="คลิกเพื่อเรียงตามผลตรวจ Lab"
                  >
                    <span className="thal31-sort-label">
                      ผลการตรวจ Lab {renderSortIndicator('labresult')}
                    </span>
                  </th>
                  <th>วันที่ตรวจ Lab</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  return (
                    <tr
                      key={`${item.ancno}-${index}`}
                      onClick={() => setSelectedIndex(index)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center' }} className="font-tabular text-muted">
                        {item.no}
                      </td>
                      <td className="font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        {formatThaiDate(item.labor_date)}
                      </td>
                      <td style={{ textAlign: 'center' }} className="font-tabular">
                        <span className="thal31-badge-neutral" style={{ padding: '2px 6px', borderRadius: 4 }}>
                          {item.ancno}
                        </span>
                      </td>
                      <td className="font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        <span
                          role="button"
                          tabIndex={0}
                          style={{ fontWeight: 600, color: 'var(--thal-accent)', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(item.hn, `hn-${index}`)
                          }}
                          title="คลิกเพื่อคัดลอก HN"
                        >
                          {item.hn}
                        </span>
                      </td>
                      <td className="font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        <span
                          role="button"
                          tabIndex={0}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(item.cid, `cid-${index}`)
                          }}
                          title="คลิกเพื่อคัดลอก CID"
                        >
                          {item.cid || '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, minWidth: 150 }}>{item.ptname}</td>
                      <td style={{ textAlign: 'center' }} className="font-tabular">
                        {item.age}
                      </td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.pttypename}>
                        {item.pttypename}
                      </td>
                      <td>
                        <span
                          className={`thal31-card-badge ${
                            item.labor_type.toUpperCase() === 'NORMAL'
                              ? 'thal31-badge-ok'
                              : item.labor_type.toUpperCase() === 'CESAREAN'
                              ? 'thal31-badge-warn'
                              : 'thal31-badge-neutral'
                          }`}
                        >
                          {item.labor_type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: item.is_thoen_hospital ? 600 : 400, color: item.is_thoen_hospital ? 'var(--thal-text-main)' : 'var(--thal-text-sub)' }}>
                          {item.hospital}
                        </span>
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.labname || ''}>
                        {item.labname || <span className="text-muted">—</span>}
                      </td>
                      <td>
                        {item.lab_status === 'NORMAL' ? (
                          <span className="thal31-card-badge thal31-badge-ok">
                            {item.labresult || 'ปกติ'}
                          </span>
                        ) : item.lab_status === 'RISK' ? (
                          <span className="thal31-card-badge thal31-badge-danger">
                            {item.labresult || 'ผิดปกติ/เสี่ยง'}
                          </span>
                        ) : item.lab_status === 'PENDING' ? (
                          <span className="thal31-card-badge thal31-badge-warn">รอผลตรวจ</span>
                        ) : (
                          <span className="thal31-card-badge thal31-badge-neutral text-muted">
                            ยังไม่ตรวจ
                          </span>
                        )}
                      </td>
                      <td className="font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        {item.lab_order_date ? formatThaiDate(item.lab_order_date) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 6. Pagination Bar ── */}
        <div className="thal31-pagination">
          <div className="thal31-pagination-info">
            แสดง {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง{' '}
            {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString()} รายการ
          </div>

          <div className="thal31-pagination-nav">
            <button
              type="button"
              className="thal31-page-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>ก่อนหน้า</span>
            </button>

            <span className="font-tabular" style={{ padding: '0 8px', fontSize: 13.5 }}>
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="thal31-page-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="หน้าถัดไป"
            >
              <span>ถัดไป</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. Patient Detail Modal ── */}
      {selectedItem && (
        <div
          className="thal31-modal-backdrop"
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="thal31-modal-title"
        >
          <div className="thal31-modal" onClick={(e) => e.stopPropagation()}>
            <div className="thal31-modal-header">
              <div>
                <span className="thal31-title-badge">ANC No. {selectedItem.ancno}</span>
                <h2 id="thal31-modal-title" className="thal31-modal-title">
                  {selectedItem.ptname} (HN: {selectedItem.hn})
                </h2>
              </div>
              <button
                type="button"
                className="thal31-clear-btn"
                onClick={() => setSelectedIndex(null)}
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={20} />
              </button>
            </div>

            <div className="thal31-modal-body">
              {/* Pregnancy & Delivery Info */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--thal-accent)' }}>
                  ข้อมูลการตั้งครรภ์และการคลอด
                </h3>
                <div className="thal31-info-grid">
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">วันที่คลอด</span>
                    <span className="thal31-info-val font-tabular">
                      {formatThaiDate(selectedItem.labor_date)}
                    </span>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">วิธีการคลอด</span>
                    <span className="thal31-info-val">{selectedItem.labor_type}</span>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">โรงพยาบาลที่คลอด</span>
                    <span className="thal31-info-val">{selectedItem.hospital}</span>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">สิทธิการรักษา</span>
                    <span className="thal31-info-val">{selectedItem.pttypename}</span>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">ครรภ์ที่ (Gravida)</span>
                    <span className="thal31-info-val font-tabular">{selectedItem.preg_no || '—'}</span>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">ประจำเดือนครั้งสุดท้าย (LMP) / กำหนดคลอด (EDC)</span>
                    <span className="thal31-info-val font-tabular">
                      {selectedItem.lmp ? formatThaiDate(selectedItem.lmp) : '—'} /{' '}
                      {selectedItem.edc ? formatThaiDate(selectedItem.edc) : '—'}
                    </span>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">เลขประจำตัวประชาชน (CID)</span>
                    <span className="thal31-info-val font-tabular">{formatCidDisplay(selectedItem.cid)}</span>
                  </div>
                  <div className="thal31-info-box" style={{ gridColumn: 'span 2' }}>
                    <span className="thal31-info-lbl">ที่อยู่</span>
                    <span className="thal31-info-val">{selectedItem.address}</span>
                  </div>
                </div>
              </div>

              {/* Lab Results & Thalassemia Screening */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--thal-accent)' }}>
                  ผลการตรวจคัดกรองธาลัสซีเมียทางห้องปฏิบัติการ (Lab)
                </h3>
                <div className="thal31-info-grid">
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">สถานะผลตรวจ</span>
                    <div>
                      {selectedItem.lab_status === 'NORMAL' ? (
                        <span className="thal31-card-badge thal31-badge-ok">ผลปกติ (Negative)</span>
                      ) : selectedItem.lab_status === 'RISK' ? (
                        <span className="thal31-card-badge thal31-badge-danger">ผลผิดปกติ / เสี่ยง (Positive)</span>
                      ) : selectedItem.lab_status === 'PENDING' ? (
                        <span className="thal31-card-badge thal31-badge-warn">รอผลตรวจ</span>
                      ) : (
                        <span className="thal31-card-badge thal31-badge-neutral">ยังไม่พบประวัติตรวจ Lab</span>
                      )}
                    </div>
                  </div>
                  <div className="thal31-info-box">
                    <span className="thal31-info-lbl">วันที่สั่งตรวจ Lab ล่าสุด</span>
                    <span className="thal31-info-val font-tabular">
                      {selectedItem.lab_order_date ? formatThaiDate(selectedItem.lab_order_date) : '—'}
                    </span>
                  </div>
                  <div className="thal31-info-box" style={{ gridColumn: 'span 2' }}>
                    <span className="thal31-info-lbl">รายการ Lab ที่ตรวจ</span>
                    <span className="thal31-info-val">{selectedItem.labname || '—'}</span>
                  </div>
                  <div className="thal31-info-box" style={{ gridColumn: 'span 2' }}>
                    <span className="thal31-info-lbl">ผลการตรวจ (Result Interpretation)</span>
                    <span className="thal31-info-val" style={{ color: selectedItem.lab_status === 'RISK' ? 'var(--thal-danger)' : 'inherit' }}>
                      {selectedItem.labresult || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ordered ADP Items */}
              {selectedItem.ordered_adp_items && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--thal-accent)' }}>
                    รายการตรวจ ADP 30313 / 37532 ที่สั่งใช้ในระบบ
                  </h3>
                  <div className="thal31-info-box">
                    <span className="thal31-info-val">{selectedItem.ordered_adp_items}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="thal31-modal-footer">
              <button
                type="button"
                className="thal31-btn-secondary"
                disabled={selectedIndex === null || selectedIndex <= 0}
                onClick={() => setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                คนก่อนหน้า
              </button>

              <button
                type="button"
                className="thal31-btn-secondary"
                disabled={selectedIndex === null || selectedIndex >= items.length - 1}
                onClick={() =>
                  setSelectedIndex((prev) => (prev !== null && prev < items.length - 1 ? prev + 1 : prev))
                }
              >
                คนถัดไป
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
