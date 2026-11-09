'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
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
  Sparkles,
  ShieldCheck,
  Clock,
  UserCheck,
  ReceiptText,
  Copy,
  Check,
} from 'lucide-react'
import type {
  FluorideVarnishItem,
  FluorideVarnishSummary,
  FluorideVarnishCardFilter,
  FluorideVarnishSearchField,
  FluorideVarnishSortField,
  FluorideVarnishAdpMappingCheck,
  FluorideVarnishReportResult,
} from '@/lib/clinical/rcmFluorideVarnishService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * จัดรูปแบบชื่อ-สกุล:
 * - แสดงบรรทัดเดียวกันเป็นหลัก
 * - หากจำเป็นต้องตัดบรรทัดใหม่ ให้ยกไปทั้งนามสกุลโดยไม่แตกพยางค์กลางคำ
 */
function formatPatientName(ptname?: string | null) {
  if (!ptname) return '—'
  const trimmed = ptname.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length <= 1) {
    return <span className="fluoride-ptname-single">{trimmed}</span>
  }
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return (
    <span className="fluoride-ptname-wrap">
      <span className="fluoride-ptname-first">{first}</span>{' '}
      <span className="fluoride-ptname-last">{last}</span>
    </span>
  )
}

export interface FluorideVarnish201ClientProps {
  initialData?: FluorideVarnishReportResult | null
}

export default function FluorideVarnish201Client({
  initialData = null,
}: FluorideVarnish201ClientProps) {
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

  // Date selection states: Standard Order: 1. กำหนดเอง -> 2. เดือน -> 3. ปีงบประมาณ
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(
    initialData?.ds1 ?? `${defaultFiscalCeYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialData?.ds2 ?? `${defaultFiscalCeYear}-09-30`
  )

  // Filter & Search states
  const [pttypes, setPttypes] = useState<string[]>([])
  const [cardFilter, setCardFilter] = useState<FluorideVarnishCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [targetAgeOnly, setTargetAgeOnly] = useState<boolean>(initialData?.targetAgeOnly ?? false)
  const [searchField, setSearchField] = useState<FluorideVarnishSearchField>(
    initialData?.searchField ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<FluorideVarnishSortField>(
    initialData?.sortBy ?? 'vstdate'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialData?.sortOrder ?? 'desc'
  )
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FluorideVarnishItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<FluorideVarnishAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '15001',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<FluorideVarnishSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      targetAgeCount: 0,
      targetAgeRate: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<FluorideVarnishItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race condition safety
  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef<boolean>(true)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

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
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          ucOnly: String(ucOnly),
          targetAgeOnly: String(targetAgeOnly),
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: FluorideVarnishReportResult = json.data
          setItems(result.items)
          setTotalCount(result.totalCount)
          setTotalPages(result.totalPages)
          setSummary(result.summary)
          setAdpMapping(result.adpMapping)
        } else {
          throw new Error(json.error?.message || 'รูปแบบข้อมูลตอบกลับไม่ถูกต้อง')
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
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
      ucOnly,
      targetAgeOnly,
      searchField,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
      pttypes,
    ]
  )

  // Trigger fetch on filter change (skipping first mount if initialData is provided)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Fetch clinical VN details when modal opens and switches to clinical tab
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/fluoride-varnish/vn-details?vn=${vn}`)
      const json = await res.json()
      if (json.success) {
        setVnDetails(json.data)
      } else {
        setVnDetails(null)
      }
    } catch {
      setVnDetails(null)
    } finally {
      setLoadingVnDetails(false)
    }
  }, [])

  const handleRowClick = (item: FluorideVarnishItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
  }

  const handleModalTabChange = (tab: 'summary' | 'clinical') => {
    setModalTab(tab)
    if (tab === 'clinical' && selectedItem && !vnDetails && !loadingVnDetails) {
      fetchVnDetails(selectedItem.vn)
    }
  }

  const handleCopyText = (text: string, fieldId: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 1500)
    }
  }

  // Handle Date Mode Changes
  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)

    if (mode === 'custom') {
      // keep current ds1, ds2
    } else if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mm}-01`)
      setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceFiscal = selectedFiscalYear - 543
      setDs1(`${ceFiscal - 1}-10-01`)
      setDs2(`${ceFiscal}-09-30`)
    }
  }

  const handleMonthYearChange = (m: number, beYear: number) => {
    setSelectedMonth(m)
    setSelectedBeYear(beYear)
    setCurrentPage(1)
    const ceYear = beYear - 543
    const mm = String(m).padStart(2, '0')
    const lastDay = new Date(ceYear, m, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleFiscalYearChange = (fy: number) => {
    setSelectedFiscalYear(fy)
    setCurrentPage(1)
    const ceFiscal = fy - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
  }

  // Handle Card Filter Selection
  const handleCardFilter = (filter: FluorideVarnishCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Handle Table Sorting
  const handleSort = (field: FluorideVarnishSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Handle CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        ucOnly: String(ucOnly),
        targetAgeOnly: String(targetAgeOnly),
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: FluorideVarnishItem[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'กลุ่มเสี่ยง 25-29 ปี',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'ClaimCode',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'PDX',
        'SDX',
        'รายการ ADP (15001)',
        'สถานะชดเชย',
        'เลขที่ REP',
        'ยอดชดเชย (บาท)',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const csvContent = exportRows.map((r, i) => [
        i + 1,
        `"${r.vn}"`,
        `"${r.hn}"`,
        `"${r.cid}"`,
        `"${r.ptname.replace(/"/g, '""')}"`,
        `"${r.sex}"`,
        r.age,
        r.isTargetAge ? '"ใช่ (25-29 ปี)"' : '"ไม่ใช่"',
        `"${r.nation || ''}"`,
        `"${r.vstdate}"`,
        `"${r.vsttime}"`,
        `"${r.authencode || ''}"`,
        `"${(r.pttypename || '').replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${(r.clinic || '').replace(/"/g, '""')}"`,
        `"${r.pdx || ''}"`,
        `"${(r.sdx || '').replace(/"/g, '""')}"`,
        `"${(r.listname || '').replace(/"/g, '""')}"`,
        `"${(r.status || '').replace(/"/g, '""')}"`,
        `"${r.rep || ''}"`,
        r.compensated,
        `"${r.fund || ''}"`,
        `"${r.subfund || ''}"`,
      ])

      await exportRcmExcel({
        filename: `fluoride-varnish-15001-${ds1}-to-${ds2}.xlsx`,
        title: 'การทาฟลูออไรด์วานิช (20.1 / ADP 15001)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: csvContent,
      })
    } catch (err: any) {
      alert(err.message || 'ส่งออกไฟล์ไม่สำเร็จ')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fluoride-container">
      {/* ── 1. Header & Breadcrumbs (No Eyebrow/Floating Badge) ── */}
      <header className="fluoride-header">
        <div>
          <nav className="fluoride-breadcrumb" aria-label="Breadcrumb">
            <Link href="/service">หน้าหลัก</Link>
            <span className="fluoride-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm">แดชบอร์ด RCM</Link>
            <span className="fluoride-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds/ccs/2">กองทุน</Link>
            <span className="fluoride-breadcrumb-sep">/</span>
            <span className="fluoride-breadcrumb-cur">20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง)</span>
          </nav>
          <h1 className="fluoride-title">
            20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-29 ปี ADP (15001)
          </h1>
          <p className="fluoride-subtitle">
            รายงานติดตามผู้รับบริการเคลือบฟลูออไรด์วานิชในกลุ่มเสี่ยง การเบิกชดเชยค่าบริการ และสถานะ e-Claim
            โรงพยาบาลเถิน
          </p>
        </div>

        <div className="fluoride-header-actions">
          <button
            type="button"
            className="fluoride-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="fluoride-btn fluoride-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── Warning Banner (ADP Mapping Pre-Check) ── */}
      {!adpMapping.isMapped && (
        <div className="fluoride-warning-banner" role="alert">
          <AlertTriangle size={20} className="fluoride-warning-icon" />
          <div className="fluoride-warning-content">
            <strong>แจ้งเตือน: ยังไม่ได้ Map รหัส ADP 15001</strong>
            <span>
              ไม่พบรายการค่าบริการที่ผูกกับรหัส ADP &quot;15001&quot; ในตาราง{' '}
              <code>s_drugitems</code> กรุณาตรวจสอบการตั้งค่า Map ADP Code ในระบบ HOSxP
              เพื่อให้การดึงข้อมูลและเบิกจ่ายกองทุนครบถ้วนสมบูรณ์
            </span>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="fluoride-warning-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={20} style={{ color: '#dc2626' }} />
          <div className="fluoride-warning-content">
            <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── 2. Unified Date Selector Toolbar (Single-Row) ── */}
      <section className="fluoride-date-toolbar" aria-label="ช่วงเวลาการค้นหา">
        <div className="fluoride-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`fluoride-mode-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`fluoride-mode-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`fluoride-mode-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="fluoride-date-divider" />

        <div className="fluoride-date-controls">
          {dateMode === 'custom' && (
            <div className="fluoride-custom-range">
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
                placeholder="ตั้งแต่วันที่"
                aria-label="ตั้งแต่วันที่"
              />
              <span className="fluoride-custom-sep">ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
                placeholder="ถึงวันที่"
                aria-label="ถึงวันที่"
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="fluoride-custom-range">
              <select
                aria-label="เลือกเดือน"
                className="fluoride-select"
                value={selectedMonth}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedBeYear)}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="เลือกปี พ.ศ."
                className="fluoride-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
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
              aria-label="เลือกปีงบประมาณ"
              className="fluoride-select"
              value={selectedFiscalYear}
              onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
            >
              {yearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  ปีงบประมาณ {fy}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* ── 3. Balanced 4x2 KPI Summary Cards (Interactive Filtering) ── */}
      <section className="fluoride-kpi-grid" aria-label="สรุปสถิติ KPI">
        {/* Card 1: ทั้งหมด */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('ALL')}
          title="คลิกเพื่อแสดงผู้รับบริการทั้งหมด"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">ผู้รับบริการทั้งหมด</span>
            <span className="fluoride-kpi-icon">
              <Sparkles size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val">{summary.totalVisits.toLocaleString()}</span>
            <span className="fluoride-kpi-sub">
              {summary.uniquePatients.toLocaleString()} คน (เฉลี่ย{' '}
              {summary.uniquePatients > 0
                ? (summary.totalVisits / summary.uniquePatients).toFixed(1)
                : 0}{' '}
              ครั้ง/คน)
            </span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ชดเชยแล้ว"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">ชดเชยแล้ว</span>
            <span className="fluoride-kpi-icon" style={{ color: '#059669', backgroundColor: '#d1fae5' }}>
              <ReceiptText size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val" style={{ color: '#059669' }}>
              {summary.compensatedVisits.toLocaleString()}
            </span>
            <span className="fluoride-kpi-sub">
              {summary.compensationRate}% ของผู้รับบริการทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('UNCOMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ชดเชยหรือรอ Rep"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">ยังไม่ชดเชย / รอชดเชย</span>
            <span className="fluoride-kpi-icon" style={{ color: '#d97706', backgroundColor: '#fef3c7' }}>
              <Clock size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val" style={{ color: '#d97706' }}>
              {summary.uncompensatedVisits.toLocaleString()}
            </span>
            <span className="fluoride-kpi-sub">
              {summary.totalVisits > 0
                ? (100 - summary.compensationRate).toFixed(1)
                : 0}
              % รอดำเนินการ e-Claim
            </span>
          </div>
        </div>

        {/* Card 4: ยอดเงินชดเชยรวม */}
        <div
          role="button"
          tabIndex={0}
          className="fluoride-kpi-card"
          onClick={() => handleCardFilter('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('COMPENSATED')}
          title="ยอดเงินชดเชยรวมที่ได้รับจาก สปสช. / กองทุน"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">ยอดเงินชดเชยรวม</span>
            <span className="fluoride-kpi-icon" style={{ color: '#059669', backgroundColor: '#d1fae5' }}>
              <ReceiptText size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val" style={{ color: '#059669' }}>
              {formatMoney(summary.totalCompensated)}
            </span>
            <span className="fluoride-kpi-sub">
              เฉลี่ย {formatMoney(summary.averageCompensated)} บาท/ราย
            </span>
          </div>
        </div>

        {/* Card 5: กลุ่มเป้าหมาย 25-29 ปี */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'TARGET_AGE' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('TARGET_AGE')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('TARGET_AGE')}
          title="คลิกเพื่อกรองเฉพาะกลุ่มเป้าหมายอายุ 25-29 ปี"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">กลุ่มเป้าหมาย (25-29 ปี)</span>
            <span className="fluoride-kpi-icon" style={{ color: '#2563eb', backgroundColor: '#dbeafe' }}>
              <UserCheck size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val" style={{ color: '#2563eb' }}>
              {summary.targetAgeCount.toLocaleString()}
            </span>
            <span className="fluoride-kpi-sub">
              {summary.targetAgeRate}% ของผู้รับบริการทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 6: สิทธิบัตรทอง (UC) */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UC_ONLY')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('UC_ONLY')}
          title="คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UC)"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">สิทธิบัตรทอง (UC)</span>
            <span className="fluoride-kpi-icon">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val">{summary.ucCount.toLocaleString()}</span>
            <span className="fluoride-kpi-sub">
              {summary.ucRate}% ของผู้รับบริการทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 7: มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('WITH_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะผู้รับบริการที่มี ClaimCode"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">มี ClaimCode</span>
            <span className="fluoride-kpi-icon" style={{ color: '#059669', backgroundColor: '#d1fae5' }}>
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val" style={{ color: '#059669' }}>
              {summary.withAuthenCount.toLocaleString()}
            </span>
            <span className="fluoride-kpi-sub">
              {summary.authenRate}% มีรหัสยืนยันตัวตน
            </span>
          </div>
        </div>

        {/* Card 8: ไม่มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`fluoride-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('NO_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilter('NO_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะผู้รับบริการที่ไม่มี ClaimCode"
        >
          <div className="fluoride-kpi-header">
            <span className="fluoride-kpi-title">ไม่มี ClaimCode</span>
            <span className="fluoride-kpi-icon" style={{ color: '#ef4444', backgroundColor: '#fee2e2' }}>
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="fluoride-kpi-body">
            <span className="fluoride-kpi-val" style={{ color: '#ef4444' }}>
              {summary.withoutAuthenCount.toLocaleString()}
            </span>
            <span className="fluoride-kpi-sub">
              {summary.totalVisits > 0
                ? (100 - summary.authenRate).toFixed(1)
                : 0}
              % ไม่มีรหัสยืนยันตัวตน
            </span>
          </div>
        </div>
      </section>

      {/* ── 4. Unified Search & Filters Toolbar ── */}
      <section className="fluoride-filter-bar" aria-label="แถบเครื่องมือค้นหาและกรอง">
        <div className="fluoride-search-box">
          <Search size={16} className="fluoride-search-icon" />
          <input
            type="text"
            className="fluoride-search-input"
            placeholder="ค้นหาด้วย HN, CID, ชื่อผู้ป่วย, VN, รหัสโรค หรือสิทธิการรักษา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="fluoride-search-clear"
              onClick={() => setSearch('')}
              title="ล้างข้อความค้นหา"
            >
              <X size={16} />
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

        <div className="fluoride-secondary-filters">
          <label className="fluoride-checkbox-label">
            <input
              type="checkbox"
              className="fluoride-checkbox"
              checked={targetAgeOnly}
              onChange={(e) => {
                setTargetAgeOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะกลุ่มเป้าหมาย (25-29 ปี)</span>
          </label>

          <label className="fluoride-checkbox-label">
            <input
              type="checkbox"
              className="fluoride-checkbox"
              checked={ucOnly}
              onChange={(e) => {
                setUcOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะสิทธิบัตรทอง (UC)</span>
          </label>

          {cardFilter !== 'ALL' && (
            <div className="fluoride-active-filter-badge">
              <span>
                กรอง:{' '}
                {cardFilter === 'TARGET_AGE' && 'กลุ่มเป้าหมาย 25-29 ปี'}
                {cardFilter === 'COMPENSATED' && 'ชดเชยแล้ว'}
                {cardFilter === 'UNCOMPENSATED' && 'ยังไม่ชดเชย'}
                {cardFilter === 'WITH_AUTHEN' && 'มี Authen'}
                {cardFilter === 'NO_AUTHEN' && 'ไม่มี Authen'}
                {cardFilter === 'UC_ONLY' && 'สิทธิบัตรทอง'}
              </span>
              <button
                type="button"
                className="fluoride-filter-reset-btn"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกตัวกรองการ์ด"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Main Table Card (Row-Clickable, No Button Clutter) ── */}
      <section className="fluoride-table-card" aria-label="ตารางรายชื่อผู้รับบริการ">
        <div className="fluoride-table-meta">
          <div>
            แสดงผลรายการที่ <strong>{items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> ถึง{' '}
            <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> จากทั้งหมด{' '}
            <strong>{totalCount.toLocaleString()}</strong> รายการ
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            * คลิกที่แถวผู้ป่วยเพื่อเปิดดูรายละเอียดและเวชระเบียน
          </div>
        </div>

        {loading ? (
          <div className="fluoride-loading-overlay">
            <RefreshCw size={20} className="spin" />
            <span>กำลังโหลดข้อมูลรายงาน...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="fluoride-empty-state">
            <Sparkles size={40} className="fluoride-empty-icon" />
            <strong style={{ fontSize: '1rem', color: '#334155' }}>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</strong>
            <span style={{ fontSize: '0.875rem' }}>
              ลองเปลี่ยนช่วงเวลาการค้นหา หรือปรับตัวกรองที่เลือกใหม่อีกครั้ง
            </span>
          </div>
        ) : (
          <div className="fluoride-table-scroll">
            <table className="fluoride-table">
              <thead>
                <tr>
                  <th className="col-center" style={{ width: '50px' }}>
                    ลำดับ
                  </th>
                  <th className="col-center" style={{ width: '100px' }}>
                    <button
                      type="button"
                      className="fluoride-sort-btn"
                      onClick={() => handleSort('vstdate')}
                    >
                      <span>วันที่รับบริการ</span>
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '80px' }}>
                    เวลา
                  </th>
                  <th className="col-center" style={{ width: '120px' }}>
                    <button
                      type="button"
                      className="fluoride-sort-btn"
                      onClick={() => handleSort('hn')}
                    >
                      <span>HN</span>
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '140px' }}>
                    เลขบัตรประชาชน
                  </th>
                  <th className="col-left" style={{ minWidth: '160px' }}>
                    <button
                      type="button"
                      className="fluoride-sort-btn"
                      onClick={() => handleSort('ptname')}
                    >
                      <span>ชื่อ-สกุล</span>
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '80px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="fluoride-sort-btn"
                      onClick={() => handleSort('age')}
                    >
                      <span>อายุ</span>
                      {sortBy === 'age' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '110px' }}>
                    ClaimCode
                  </th>
                  <th className="col-left" style={{ minWidth: '150px' }}>
                    สิทธิการรักษา
                  </th>
                  <th className="col-center" style={{ width: '80px' }}>
                    <button
                      type="button"
                      className="fluoride-sort-btn"
                      onClick={() => handleSort('pdx')}
                    >
                      <span>PDX</span>
                      {sortBy === 'pdx' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-left" style={{ minWidth: '180px' }}>
                    รายการ ADP (15001)
                  </th>
                  <th className="col-center" style={{ width: '130px' }}>
                    สถานะชดเชย
                  </th>
                  <th className="col-center" style={{ width: '110px' }}>
                    เลขที่ REP
                  </th>
                  <th className="col-center" style={{ width: '120px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="fluoride-sort-btn"
                      onClick={() => handleSort('compensated')}
                    >
                      <span>ชดเชย (บาท)</span>
                      {sortBy === 'compensated' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.vn}
                    className="fluoride-table-row"
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อดูรายละเอียดเวชระเบียน"
                  >
                    <td className="col-center fluoride-num">{item.no}</td>
                    <td className="col-center fluoride-num">
                      {item.vstdate ? formatThaiDate(item.vstdate) : '—'}
                    </td>
                    <td className="col-center fluoride-num font-mono">{item.vsttime || '—'}</td>
                    <td className="col-center fluoride-num font-mono font-semibold">{item.hn}</td>
                    <td className="col-center fluoride-num font-mono">{item.cid}</td>
                    <td className="col-left font-semibold" style={{ minWidth: '160px' }}>
                      {formatPatientName(item.ptname)}
                    </td>
                    <td className="col-center fluoride-num" style={{ whiteSpace: 'nowrap' }}>
                      {item.age}&nbsp;ปี
                    </td>
                    <td className="col-center">
                      {item.authencode ? (
                        <span className="fluoride-authen-badge">{item.authencode}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td className="col-left" title={item.pttypename}>
                      <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.pttypename}
                      </div>
                    </td>
                    <td className="col-center font-mono font-bold" style={{ color: '#0369a1' }}>
                      {item.pdx || '—'}
                    </td>
                    <td className="col-left" title={item.listname || ''}>
                      <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.listname || '—'}
                      </div>
                    </td>
                    <td className="col-center">
                      {item.isCompensated ? (
                        <span className="fluoride-status-badge is-compensated">ชดเชยแล้ว</span>
                      ) : item.status ? (
                        <span className="fluoride-status-badge is-pending">{item.status}</span>
                      ) : (
                        <span className="fluoride-status-badge is-uncompensated">รอชดเชย</span>
                      )}
                    </td>
                    <td className="col-center fluoride-num font-mono">
                      {item.rep || '—'}
                    </td>
                    <td className="col-center fluoride-num font-semibold" style={{ color: item.isCompensated ? '#059669' : '#475569', whiteSpace: 'nowrap' }}>
                      {formatMoney(item.compensated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Controls ── */}
        {items.length > 0 && (
          <div className="fluoride-pagination">
            <div className="fluoride-page-info">
              หน้า <strong>{currentPage}</strong> จากทั้งหมด <strong>{totalPages}</strong> หน้า (
              {totalCount.toLocaleString()} รายการ)
            </div>

            <div className="fluoride-page-controls">
              <select
                aria-label="จำนวนแถวต่อหน้า"
                className="fluoride-page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={20}>20 แถว/หน้า</option>
                <option value={50}>50 แถว/หน้า</option>
                <option value={100}>100 แถว/หน้า</option>
                <option value={200}>200 แถว/หน้า</option>
              </select>

              <button
                type="button"
                className="fluoride-page-btn"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '0.8125rem', padding: '0 8px', color: '#475569' }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="fluoride-page-btn"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── 6. Detail Modal (Opened by clicking record) ── */}
      {selectedItem && (
        <div
          className="fluoride-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="fluoride-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fluoride-modal-header">
              <div className="fluoride-modal-title-group">
                <h3 className="fluoride-modal-title">
                  {selectedItem.ptname} (HN: {selectedItem.hn})
                </h3>
                <div className="fluoride-modal-subtitle">
                  <span>VN: {selectedItem.vn}</span>
                  <span>•</span>
                  <span>วันที่ {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime} น.</span>
                  <span>•</span>
                  <span>อายุ {selectedItem.age} ปี</span>
                </div>
              </div>
              <button
                type="button"
                className="fluoride-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="fluoride-modal-tabs">
              <button
                type="button"
                className={`fluoride-modal-tab-btn ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลการรับบริการและการชดเชย
              </button>
              <button
                type="button"
                className={`fluoride-modal-tab-btn ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                เวชระเบียนคลินิก (HOSxP OPD)
              </button>
            </div>

            <div className="fluoride-modal-body">
              {modalTab === 'summary' && (
                <>
                  <div className="fluoride-detail-grid">
                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">เลขบัตรประชาชน (CID)</span>
                      <span className="fluoride-detail-value font-mono">
                        {selectedItem.cid}
                        <button
                          type="button"
                          className="fluoride-copy-btn"
                          onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                          title="คัดลอก CID"
                        >
                          {copiedField === 'cid' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">ClaimCode:</span>
                      <span className="fluoride-detail-value font-mono">
                        {selectedItem.authencode || 'ไม่มี'}
                        {selectedItem.authencode && (
                          <button
                            type="button"
                            className="fluoride-copy-btn"
                            onClick={() => handleCopyText(selectedItem.authencode!, 'authen')}
                            title="คัดลอก ClaimCode"
                          >
                            {copiedField === 'authen' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">สิทธิการรักษา</span>
                      <span className="fluoride-detail-value">{selectedItem.pttypename}</span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">แผนก / คลินิก</span>
                      <span className="fluoride-detail-value">
                        {selectedItem.department || '—'} {selectedItem.clinic ? `(${selectedItem.clinic})` : ''}
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">การวินิจฉัยหลัก (PDX)</span>
                      <span className="fluoride-detail-value font-mono" style={{ color: '#0369a1' }}>
                        {selectedItem.pdx || '—'}
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">การวินิจฉัยร่วม (SDX)</span>
                      <span className="fluoride-detail-value font-mono">
                        {selectedItem.sdx || '—'}
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">สถานะการชดเชย</span>
                      <span className="fluoride-detail-value">
                        {selectedItem.status || (selectedItem.isCompensated ? 'ชดเชยแล้ว' : 'รอการชดเชย')}
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">เลขที่ REP / ใบเสร็จ</span>
                      <span className="fluoride-detail-value font-mono">
                        {selectedItem.rep || '—'}
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">ยอดเงินชดเชย</span>
                      <span className="fluoride-detail-value" style={{ color: '#059669' }}>
                        {formatMoney(selectedItem.compensated)} บาท
                      </span>
                    </div>

                    <div className="fluoride-detail-item">
                      <span className="fluoride-detail-label">กองทุน / กองทุนย่อย</span>
                      <span className="fluoride-detail-value">
                        {selectedItem.fund || '—'} {selectedItem.subfund ? `(${selectedItem.subfund})` : ''}
                      </span>
                    </div>
                  </div>

                  <h4 className="fluoride-detail-section-title">
                    รายการเคลือบฟลูออไรด์ (ADP 15001)
                  </h4>
                  <div className="fluoride-detail-item">
                    <span className="fluoride-detail-value">
                      {selectedItem.listname || 'ไม่ระบุชื่อรายการ'}
                    </span>
                  </div>

                  {selectedItem.listname1 && (
                    <>
                      <h4 className="fluoride-detail-section-title">
                        รายการค่าบริการ/หัตถการร่วม (Non-drug Items)
                      </h4>
                      <div className="fluoride-detail-item">
                        <span className="fluoride-detail-value font-mono" style={{ fontSize: '0.8125rem' }}>
                          {selectedItem.listname1}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {loadingVnDetails ? (
                    <div className="fluoride-loading-overlay">
                      <RefreshCw size={20} className="spin" />
                      <span>กำลังโหลดเวชระเบียนคลินิกจากระบบ HOSxP...</span>
                    </div>
                  ) : vnDetails ? (
                    <div className="fluoride-detail-grid">
                      <div className="fluoride-detail-item">
                        <span className="fluoride-detail-label">อาการสำคัญ (Chief Complaint)</span>
                        <span className="fluoride-detail-value">{vnDetails.screen?.cc || '—'}</span>
                      </div>
                      <div className="fluoride-detail-item">
                        <span className="fluoride-detail-label">ประวัติปัจจุบัน (Present Illness)</span>
                        <span className="fluoride-detail-value">{vnDetails.screen?.hpi || '—'}</span>
                      </div>
                      <div className="fluoride-detail-item">
                        <span className="fluoride-detail-label">สัญญาณชีพ (Vital Signs)</span>
                        <span className="fluoride-detail-value">
                          BP:{' '}
                          {vnDetails.screen?.bps && vnDetails.screen?.bpd
                            ? `${vnDetails.screen.bps}/${vnDetails.screen.bpd} mmHg`
                            : '—'}
                          , PR: {vnDetails.screen?.pulse ? `${vnDetails.screen.pulse} bpm` : '—'}
                          , Temp: {vnDetails.screen?.temperature ? `${vnDetails.screen.temperature} °C` : '—'}
                        </span>
                      </div>
                      <div className="fluoride-detail-item">
                        <span className="fluoride-detail-label">น้ำหนัก / ส่วนสูง / BMI</span>
                        <span className="fluoride-detail-value">
                          {vnDetails.screen?.bw ? `${vnDetails.screen.bw} kg` : '—'} /{' '}
                          {vnDetails.screen?.height ? `${vnDetails.screen.height} cm` : '—'} /{' '}
                          {vnDetails.screen?.bmi ? `BMI ${vnDetails.screen.bmi}` : '—'}
                        </span>
                      </div>
                      <div className="fluoride-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="fluoride-detail-label">แผนกคัดกรอง</span>
                        <span className="fluoride-detail-value">
                          {vnDetails.screen?.screen_dep_name || vnDetails.header?.department || '—'}
                        </span>
                      </div>
                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div className="fluoride-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="fluoride-detail-label">รายการสั่งตรวจ / ยา / หัตถการ</span>
                          <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '0.8125rem' }}>
                            {vnDetails.orders.items.map((it, idx) => (
                              <li key={idx} style={{ marginBottom: 4 }}>
                                <strong>{it.item_name}</strong> {it.qty ? `(จำนวน ${it.qty})` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="fluoride-empty-state">
                      <AlertTriangle size={32} color="#94a3b8" />
                      <span>ไม่พบข้อมูลประวัติเวชระเบียนคลินิกเพิ่มเติมสำหรับ VN นี้</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="fluoride-modal-footer">
              <button
                type="button"
                className="fluoride-btn"
                onClick={() => setSelectedItem(null)}
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
