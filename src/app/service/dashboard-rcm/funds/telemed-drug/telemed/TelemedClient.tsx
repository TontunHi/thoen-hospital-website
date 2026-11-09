'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
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
  Calendar,
  PhoneCall,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  Copy,
  Check,
  Building,
} from 'lucide-react'
import type {
  TelemedItem,
  TelemedSummary,
  TelemedCardFilter,
  TelemedSearchField,
  TelemedSortField,
  AdpMappingCheck,
  TelemedReportResult,
} from '@/lib/clinical/rcmTelemedDrugService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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

function formatMoney(val?: number | null): string {
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface TelemedClientProps {
  initialData?: TelemedReportResult | null
}

export default function TelemedClient({ initialData = null }: TelemedClientProps) {
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
  const [cardFilter, setCardFilter] = useState<TelemedCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<TelemedSortField>(
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
  const [items, setItems] = useState<TelemedItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<AdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: 'TELMED',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<TelemedSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      withPriceCount: 0,
      withPriceRate: 0,
      exportCode5Count: 0,
      exportCode5Rate: 0,
      totalSumPrice: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<TelemedItem | null>(null)
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
          searchField: 'ALL',
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/telemed-drug/telemed?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: TelemedReportResult = json.data
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
      const res = await fetch(`/api/service/dashboard-rcm/funds/telemed-drug/vn-details?vn=${vn}`)
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

  const handleRowClick = (item: TelemedItem) => {
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
      // Keep current ds1, ds2
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

  const handleFiscalYearChange = (beYear: number) => {
    setSelectedFiscalYear(beYear)
    const ceFiscal = beYear - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
    setCurrentPage(1)
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    const ceYear = selectedBeYear - 543
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleBeYearChange = (beYear: number) => {
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const mm = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  // Sorting
  const handleSort = (field: TelemedSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: TelemedSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} style={{ color: 'var(--primary, #0D7446)', flexShrink: 0 }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--primary, #0D7446)', flexShrink: 0 }} />
    )
  }

  // Card filter selection
  const handleCardFilterClick = (filter: TelemedCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Export Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        ucOnly: String(ucOnly),
        searchField: 'ALL',
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/telemed-drug/telemed?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: TelemedItem[] = json.data.items
      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'วันที่รับบริการ',
        'เวลา',
        'ประเภทการมา (ovstist)',
        'ClaimCode',
        'สิทธิการรักษา',
        'กลุ่มสิทธิ',
        'รพ.หลัก',
        'รพ.รอง',
        'แผนก',
        'คลินิก',
        'วินิจฉัยหลัก (PDX)',
        'ค่าบริการรวม (บาท)',
        'ค่า TelMed (บาท)',
        'สถานะการส่ง',
        'เลขที่ใบตอบรับ (REP)',
        'ยอดชดเชย (บาท)',
        'กองทุน (Fund)',
        'กองทุนย่อย (Subfund)',
      ]

      const rows = exportRows.map((r) => [
        r.no,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        r.age,
        r.vstdate,
        r.vsttime,
        r.ovstist,
        r.authencode || '',
        r.pttypename,
        r.maininscl,
        r.hospmain || '',
        r.hospsub || '',
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.income,
        r.sum_price,
        r.status,
        r.rep || '',
        r.compensated,
        r.fund || '',
        r.subfund || '',
      ])

      await exportRcmExcel({
        filename: `telemed_report_11_53_${ds1}_to_${ds2}.xlsx`,
        title: '11.53 รายชื่อผู้ได้รับบริการ TelMed',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportRows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="telemed-container">
      {/* ── 1. Header & Navigation ── */}
      <div className="telemed-header">
        <div>
          <nav className="telemed-breadcrumb" aria-label="Breadcrumb">
            <Link href="/service">บริการ</Link>
            <span className="telemed-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm">Dashboard RCM</Link>
            <span className="telemed-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
            <span className="telemed-breadcrumb-sep">/</span>
            <span className="telemed-breadcrumb-cur">ระบบ Telemedicine & Drug</span>
          </nav>
          <h1 className="telemed-title">11.53 รายชื่อผู้ได้รับบริการ TelMed</h1>
          <p className="telemed-subtitle">
            บริการการแพทย์ทางไกล รหัส ADP TELMED หรือประเภทการมาบริการสาธารณสุขทางไกล (รหัสส่งออก 5)
          </p>
        </div>

        <div className="telemed-header-actions">
          <button
            type="button"
            className="telemed-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="telemed-btn telemed-btn-primary"
            onClick={handleExportExcel}
            disabled={isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Warnings (ADP Map Check) ── */}
      {!adpMapping.isMapped && (
        <div className="telemed-warning-banner" role="alert">
          <AlertTriangle size={20} className="telemed-warning-icon" />
          <div className="telemed-warning-content">
            <strong>ยังไม่ได้ Map รหัส ADP Code &apos;TELMED&apos; ในระบบ</strong>
            <span>
              ไม่พบการผูกรหัสค่าบริการทางการแพทย์กับ ADP Code &apos;TELMED&apos; ในตาราง s_drugitems
              กรุณาตรวจสอบการตั้งค่ารายการค่าบริการเพื่อให้การดึงข้อมูลสมบูรณ์
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Unified Single-Row Date Selector ── */}
      <div className="telemed-date-toolbar">
        <div className="telemed-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`telemed-mode-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`telemed-mode-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`telemed-mode-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="telemed-date-divider" />

        <div className="telemed-date-controls">
          {dateMode === 'custom' && (
            <>
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
                placeholder="ตั้งแต่วันที่"
                aria-label="ตั้งแต่วันที่"
              />
              <span style={{ color: 'var(--gray-400, #94a3b8)' }}>ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
                placeholder="ถึงวันที่"
                aria-label="ถึงวันที่"
              />
            </>
          )}

          {dateMode === 'monthly' && (
            <>
              <select
                className="telemed-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                aria-label="เลือกเดือน"
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="telemed-select"
                value={selectedBeYear}
                onChange={(e) => handleBeYearChange(Number(e.target.value))}
                aria-label="เลือกปี พ.ศ."
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </>
          )}

          {dateMode === 'fiscal' && (
            <select
              className="telemed-select"
              value={selectedFiscalYear}
              onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
              aria-label="เลือกปีงบประมาณ"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  ปีงบประมาณ {y}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── 4. Balanced 4x2 KPI Summary Cards ── */}
      <div className="telemed-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="telemed-kpi-icon-wrap">
              <PhoneCall size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val">
              {summary.totalVisits.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span>{summary.uniquePatients.toLocaleString('th-TH')} คน</span>
            <span>•</span>
            <span>รายได้ {formatMoney(summary.totalIncome)} บ.</span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">ชดเชยแล้ว</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#047857', backgroundColor: '#ecfdf5' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val" style={{ color: '#047857' }}>
              {summary.compensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span className="telemed-kpi-badge" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
              {summary.compensationRate.toFixed(1)}%
            </span>
            <span>ชดเชย {formatMoney(summary.totalCompensated)} บ.</span>
          </div>
        </div>

        {/* Card 3: รอชดเชย / ยังไม่ได้ส่ง */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">รอชดเชย / ยังไม่ส่ง</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#b45309', backgroundColor: '#fffbeb' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val" style={{ color: '#b45309' }}>
              {summary.uncompensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span>
              {summary.totalVisits > 0
                ? ((summary.uncompensatedVisits / summary.totalVisits) * 100).toFixed(1)
                : 0}
              %
            </span>
            <span>ของทั้งหมด</span>
          </div>
        </div>

        {/* Card 4: สิทธิบัตรทอง UC */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">สิทธิบัตรทอง (UC)</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#0369a1', backgroundColor: '#f0f9ff' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val">
              {summary.ucCount.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span className="telemed-kpi-badge" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>
              {summary.ucRate.toFixed(1)}%
            </span>
            <span>ของทั้งหมด</span>
          </div>
        </div>

        {/* Card 5: มี ClaimCode */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">มี ClaimCode</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#059669', backgroundColor: '#f0fdf4' }}>
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val">
              {summary.withAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span className="telemed-kpi-badge" style={{ backgroundColor: '#f0fdf4', color: '#059669' }}>
              {summary.authenRate.toFixed(1)}%
            </span>
            <span>ยืนยันตัวตนแล้ว</span>
          </div>
        </div>

        {/* Card 6: ไม่มี ClaimCode */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">ไม่มี ClaimCode</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val" style={{ color: summary.withoutAuthenCount > 0 ? '#dc2626' : undefined }}>
              {summary.withoutAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span>
              {summary.totalVisits > 0
                ? ((summary.withoutAuthenCount / summary.totalVisits) * 100).toFixed(1)
                : 0}
              %
            </span>
            <span>เสี่ยงเบิกชดเชยไม่ได้</span>
          </div>
        </div>

        {/* Card 7: มีค่าบริการ TelMed */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'WITH_PRICE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_PRICE')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">มีค่าบริการ TelMed</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#0D7446', backgroundColor: '#f7fbf9' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val">
              {summary.withPriceCount.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span>ค่า TelMed {formatMoney(summary.totalSumPrice)} บ.</span>
          </div>
        </div>

        {/* Card 8: ประเภทมา รพ. ทางไกล (รหัส 5) */}
        <div
          className={`telemed-kpi-card ${cardFilter === 'EXPORT_CODE_5' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('EXPORT_CODE_5')}
          role="button"
          tabIndex={0}
        >
          <div className="telemed-kpi-header">
            <span className="telemed-kpi-title">ประเภทมา รพ. ทางไกล (รหัส 5)</span>
            <div className="telemed-kpi-icon-wrap" style={{ color: '#4f46e5', backgroundColor: '#eef2ff' }}>
              <Building size={18} />
            </div>
          </div>
          <div className="telemed-kpi-value-row">
            <span className="telemed-kpi-main-val">
              {summary.exportCode5Count.toLocaleString('th-TH')}
            </span>
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span className="telemed-kpi-badge" style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
              {summary.exportCode5Rate.toFixed(1)}%
            </span>
            <span>ovstist export code = 5</span>
          </div>
        </div>
      </div>

      {/* ── 5. Toolbar & Unified Global Search ── */}
      <div className="telemed-toolbar">
        <div className="telemed-search-wrap">
          <Search size={18} className="telemed-search-icon" />
          <input
            type="text"
            className="telemed-search-input"
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, VN, PDX, สิทธิ, แผนก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="telemed-search-clear"
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

        <div className="telemed-toolbar-actions">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ucOnly}
              onChange={(e) => {
                setUcOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะสิทธิบัตรทอง (UC)</span>
          </label>
          <div className="telemed-count-info">
            พบ {totalCount.toLocaleString('th-TH')} รายการ
          </div>
        </div>
      </div>

      {/* ── 6. Error & Loading Messages ── */}
      {error && (
        <div className="telemed-warning-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={20} className="telemed-warning-icon" style={{ color: '#dc2626' }} />
          <div className="telemed-warning-content">
            <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── 7. Records Table (Row-Clickable) ── */}
      <div className="telemed-table-wrapper">
        <table className="telemed-table">
          <thead>
            <tr>
              <th className="col-center" style={{ width: 60 }}>ลำดับ</th>
              <th className="col-center" style={{ width: 140 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('vstdate')}
                >
                  <span>วันที่รับบริการ</span>
                  {renderSortIcon('vstdate')}
                </button>
              </th>
              <th className="col-center" style={{ width: 100 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('hn')}
                >
                  <span>HN</span>
                  {renderSortIcon('hn')}
                </button>
              </th>
              <th className="col-center" style={{ width: 140 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('cid')}
                >
                  <span>เลขบัตรประชาชน</span>
                  {renderSortIcon('cid')}
                </button>
              </th>
              <th className="col-center" style={{ minWidth: 180 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('ptname')}
                >
                  <span>ชื่อ-สกุลผู้ป่วย</span>
                  {renderSortIcon('ptname')}
                </button>
              </th>
              <th className="col-center" style={{ width: 100 }}>เพศ / อายุ</th>
              <th className="col-center" style={{ minWidth: 140 }}>สิทธิการรักษา</th>
              <th className="col-center" style={{ minWidth: 160 }}>ประเภทการมา</th>
              <th className="col-center" style={{ width: 90 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('pdx')}
                >
                  <span>PDX</span>
                  {renderSortIcon('pdx')}
                </button>
              </th>
              <th className="col-center" style={{ width: 110 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('sum_price')}
                >
                  <span>ค่า TelMed</span>
                  {renderSortIcon('sum_price')}
                </button>
              </th>
              <th className="col-center" style={{ width: 130 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('authencode')}
                >
                  <span>ClaimCode</span>
                  {renderSortIcon('authencode')}
                </button>
              </th>
              <th className="col-center" style={{ minWidth: 140 }}>สถานะ / ใบตอบรับ</th>
              <th className="col-center" style={{ width: 120 }}>
                <button
                  type="button"
                  className="telemed-th-sort"
                  onClick={() => handleSort('compensated')}
                >
                  <span>ชดเชย (บาท)</span>
                  {renderSortIcon('compensated')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="telemed-empty-state">
                  <RefreshCw size={24} className="animate-spin" />
                  <span>กำลังโหลดข้อมูลรายงาน...</span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={13} className="telemed-empty-state">
                  <PhoneCall size={32} style={{ opacity: 0.3 }} />
                  <span>ไม่พบข้อมูลผู้รับบริการ TelMed ในช่วงเวลาและเงื่อนไขที่เลือก</span>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const nameParts = item.ptname.split(' ')
                const firstName = nameParts[0] || ''
                const lastName = nameParts.slice(1).join(' ')

                return (
                  <tr
                    key={item.vn}
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อดูรายละเอียดการรับบริการ"
                  >
                    <td className="col-center telemed-num-cell">{item.no}</td>
                    <td className="col-center telemed-num-cell">
                      <div style={{ fontWeight: 500 }}>
                        {formatThaiDate(item.vstdate)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500, #64748b)' }}>
                        {item.vsttime || '—'}
                      </div>
                    </td>
                    <td className="col-center telemed-num-cell" style={{ fontWeight: 600 }}>
                      {item.hn}
                    </td>
                    <td className="col-center telemed-num-cell">
                      {item.cid || '—'}
                    </td>
                    <td className="telemed-ptname-cell">
                      <span className="telemed-name-part" style={{ fontWeight: 600 }}>
                        {firstName}
                      </span>
                      {lastName ? (
                        <>
                          {' '}
                          <span className="telemed-name-part">{lastName}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="col-center telemed-num-cell" style={{ whiteSpace: 'nowrap' }}>
                      {item.sex} • {item.age}&nbsp;ปี
                    </td>
                    <td className="col-center" style={{ fontSize: '0.8125rem' }}>
                      <span title={item.pttypename}>
                        {item.pttypename.length > 25
                          ? item.pttypename.substring(0, 25) + '...'
                          : item.pttypename}
                      </span>
                    </td>
                    <td className="col-center" style={{ fontSize: '0.8125rem' }}>
                      <span
                        className={`telemed-badge ${
                          item.ovstist_export_code === '5'
                            ? 'telemed-badge-info'
                            : 'telemed-badge-gray'
                        }`}
                        title={item.ovstist}
                      >
                        {item.ovstist.length > 24
                          ? item.ovstist.substring(0, 24) + '...'
                          : item.ovstist}
                      </span>
                    </td>
                    <td className="col-center telemed-num-cell" style={{ fontWeight: 600 }}>
                      {item.pdx || '—'}
                    </td>
                    <td className="col-center telemed-num-cell">
                      {item.sum_price > 0 ? (
                        <span style={{ fontWeight: 600, color: 'var(--primary, #0D7446)' }}>
                          {item.sum_price.toLocaleString('th-TH')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>0</span>
                      )}
                    </td>
                    <td className="col-center telemed-num-cell">
                      {item.authencode ? (
                        <span className="telemed-badge telemed-badge-blue">
                          {item.authencode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>—</span>
                      )}
                    </td>
                    <td className="col-center" style={{ fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                        <span
                          className={`telemed-badge ${
                            item.isCompensated
                              ? 'telemed-badge-success'
                              : 'telemed-badge-warning'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.rep && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500, #64748b)' }}>
                            REP: {item.rep}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="col-center telemed-num-cell" style={{ fontWeight: 600 }}>
                      {item.compensated > 0 ? (
                        <span style={{ color: '#047857' }}>
                          {formatMoney(item.compensated)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 8. Pagination ── */}
      <div className="telemed-pagination">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--gray-600, #475569)' }}>
            หน้าที่ {currentPage} จาก {totalPages} หน้า (รวม {totalCount.toLocaleString('th-TH')} รายการ)
          </span>
          <select
            className="telemed-select"
            style={{ height: 34, padding: '0 8px' }}
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
        </div>

        <div className="telemed-page-nav">
          <button
            type="button"
            className="telemed-page-btn"
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = i + 1
            if (totalPages > 5) {
              if (currentPage > 3) p = currentPage - 2 + i
              if (p > totalPages) p = totalPages - 4 + i
            }
            if (p < 1 || p > totalPages) return null

            return (
              <button
                key={p}
                type="button"
                className={`telemed-page-btn ${currentPage === p ? 'active' : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            )
          })}

          <button
            type="button"
            className="telemed-page-btn"
            disabled={currentPage >= totalPages || loading}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="หน้าถัดไป"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── 9. Detail Modal (Triggered by Row Click) ── */}
      {selectedItem && (
        <div className="telemed-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="telemed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="telemed-modal-header">
              <div>
                <h3 className="telemed-modal-title">
                  รายละเอียดการรับบริการ TelMed
                </h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500, #64748b)', marginTop: 2 }}>
                  VN: {selectedItem.vn} • HN: {selectedItem.hn} • วันที่ {formatThaiDate(selectedItem.vstdate)}
                </div>
              </div>
              <button
                type="button"
                className="telemed-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="telemed-modal-tabs">
              <button
                type="button"
                className={`telemed-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                สรุปข้อมูลการรับบริการ
              </button>
              <button
                type="button"
                className={`telemed-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ข้อมูลทางคลินิก (เวชระเบียน)
              </button>
            </div>

            <div className="telemed-modal-body">
              {modalTab === 'summary' ? (
                <>
                  <div className="telemed-detail-grid">
                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">ชื่อ-สกุลผู้ป่วย</span>
                      <span className="telemed-detail-val">
                        <span>{selectedItem.ptname}</span>
                        <button
                          type="button"
                          className="telemed-copy-btn"
                          onClick={() => handleCopyText(selectedItem.ptname, 'ptname')}
                          title="คัดลอกชื่อ"
                        >
                          {copiedField === 'ptname' ? <Check size={14} style={{ color: '#047857' }} /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">เลขประจำตัวประชาชน (CID)</span>
                      <span className="telemed-detail-val">
                        <span>{selectedItem.cid || '—'}</span>
                        {selectedItem.cid && (
                          <button
                            type="button"
                            className="telemed-copy-btn"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คัดลอกเลขบัตร"
                          >
                            {copiedField === 'cid' ? <Check size={14} style={{ color: '#047857' }} /> : <Copy size={14} />}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">เพศ / อายุ</span>
                      <span className="telemed-detail-val">
                        {selectedItem.sex} • {selectedItem.age} ปี
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">วันที่และเวลารับบริการ</span>
                      <span className="telemed-detail-val">
                        {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">ประเภทการมา (ovstist)</span>
                      <span className="telemed-detail-val">
                        {selectedItem.ovstist || '—'}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">ClaimCode (การยืนยันตัวตน)</span>
                      <span className="telemed-detail-val">
                        {selectedItem.authencode ? (
                          <span className="telemed-badge telemed-badge-blue">
                            {selectedItem.authencode}
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>ไม่มี ClaimCode</span>
                        )}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">สิทธิการรักษา</span>
                      <span className="telemed-detail-val">
                        {selectedItem.pttypename}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">แผนก / คลินิก</span>
                      <span className="telemed-detail-val">
                        {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">รพ.หลัก / รพ.รอง</span>
                      <span className="telemed-detail-val">
                        {selectedItem.hospmain || '—'} / {selectedItem.hospsub || '—'}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">การวินิจฉัยหลัก (PDX)</span>
                      <span className="telemed-detail-val" style={{ color: '#0D7446' }}>
                        {selectedItem.pdx || '—'}
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">ค่าบริการ TelMed (บาท)</span>
                      <span className="telemed-detail-val" style={{ color: 'var(--primary, #0D7446)' }}>
                        {selectedItem.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">ค่าบริการรวมทั้ง Visit (บาท)</span>
                      <span className="telemed-detail-val">
                        {selectedItem.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">สถานะการชดเชย / REP</span>
                      <span className="telemed-detail-val">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{selectedItem.status}</span>
                          {selectedItem.rep && (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500, #64748b)' }}>
                              REP: {selectedItem.rep}
                            </span>
                          )}
                        </div>
                      </span>
                    </div>

                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">ยอดชดเชยที่ได้รับ (บาท)</span>
                      <span className="telemed-detail-val" style={{ color: '#047857' }}>
                        {selectedItem.compensated > 0
                          ? `${formatMoney(selectedItem.compensated)} บาท`
                          : 'ยังไม่ได้รับชดเชย'}
                      </span>
                    </div>
                  </div>

                  {selectedItem.listname && (
                    <div className="telemed-detail-item">
                      <span className="telemed-detail-label">รายการค่าบริการ Telemedicine ที่ผูก ADP</span>
                      <span className="telemed-detail-val" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {selectedItem.listname}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  {loadingVnDetails ? (
                    <div className="telemed-empty-state">
                      <RefreshCw size={24} className="animate-spin" />
                      <span>กำลังโหลดข้อมูลเวชระเบียน...</span>
                    </div>
                  ) : vnDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="telemed-detail-grid">
                        <div className="telemed-detail-item">
                          <span className="telemed-detail-label">สัญญาณชีพ (Vital Signs)</span>
                          <span className="telemed-detail-val" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            BP: {vnDetails.screen?.bps || '—'}/{vnDetails.screen?.bpd || '—'} mmHg • ชีพจร: {vnDetails.screen?.pulse || '—'} • น้ำหนัก: {vnDetails.screen?.bw || '—'} กก.
                          </span>
                        </div>
                        <div className="telemed-detail-item">
                          <span className="telemed-detail-label">อาการสำคัญ (Chief Complaint)</span>
                          <span className="telemed-detail-val" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            {vnDetails.screen?.cc || '—'}
                          </span>
                        </div>
                      </div>

                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div className="telemed-detail-item">
                          <span className="telemed-detail-label">รายการการวินิจฉัยโรค (Diagnoses)</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            {vnDetails.diagnoses.map((d, i) => (
                              <div key={i} style={{ fontSize: '0.875rem' }}>
                                <strong style={{ color: '#0D7446' }}>{d.icd10}</strong> : {d.icd_name} ({d.diagtype_name})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div className="telemed-detail-item">
                          <span className="telemed-detail-label">รายการยาและเวชภัณฑ์</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            {vnDetails.orders.items.map((m, i) => (
                              <div key={i} style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{m.item_name} ({m.qty} {m.units || 'หน่วย'})</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(m.sum_price)} บ.</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="telemed-empty-state">
                      <span>ไม่พบข้อมูลคลินิกเพิ่มเติมสำหรับ VN นี้</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
