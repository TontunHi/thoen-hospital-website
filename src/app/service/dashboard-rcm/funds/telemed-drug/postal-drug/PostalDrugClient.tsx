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
  Package,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  Copy,
  Check,
  Truck,
} from 'lucide-react'
import type {
  PostalDrugItem,
  PostalDrugSummary,
  PostalDrugCardFilter,
  PostalDrugSearchField,
  PostalDrugSortField,
  AdpMappingCheck,
  PostalDrugReportResult,
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

export interface PostalDrugClientProps {
  initialData?: PostalDrugReportResult | null
}

export default function PostalDrugClient({ initialData = null }: PostalDrugClientProps) {
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
  const [cardFilter, setCardFilter] = useState<PostalDrugCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<PostalDrugSortField>(
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
  const [items, setItems] = useState<PostalDrugItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<AdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: 'DRUGP',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<PostalDrugSummary>(
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
      withoutPriceCount: 0,
      withoutPriceRate: 0,
      totalSumPrice: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<PostalDrugItem | null>(null)
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
          `/api/service/dashboard-rcm/funds/telemed-drug/postal-drug?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: PostalDrugReportResult = json.data
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

  const handleRowClick = (item: PostalDrugItem) => {
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
  const handleSort = (field: PostalDrugSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: PostalDrugSortField) => {
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
  const handleCardFilterClick = (filter: PostalDrugCardFilter) => {
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
        `/api/service/dashboard-rcm/funds/telemed-drug/postal-drug?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: PostalDrugItem[] = json.data.items
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
        'ClaimCode',
        'สิทธิการรักษา',
        'กลุ่มสิทธิ',
        'แผนก',
        'คลินิก',
        'วินิจฉัยหลัก (PDX)',
        'ค่าบริการรวม (บาท)',
        'ค่าจัดส่งยา EMS (บาท)',
        'รายการค่าจัดส่ง',
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
        r.authencode || '',
        r.pttypename,
        r.maininscl,
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.income,
        r.sum_price,
        r.listname || '',
        r.status,
        r.rep || '',
        r.compensated,
        r.fund || '',
        r.subfund || '',
      ])

      await exportRcmExcel({
        filename: `postal_drug_report_11_52_${ds1}_to_${ds2}.xlsx`,
        title: '11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์',
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
    <div className="postal-container">
      {/* ── 1. Header & Navigation ── */}
      <div className="postal-header">
        <div>
          <nav className="postal-breadcrumb" aria-label="Breadcrumb">
            <Link href="/service">บริการ</Link>
            <span className="postal-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm">Dashboard RCM</Link>
            <span className="postal-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
            <span className="postal-breadcrumb-sep">/</span>
            <span className="postal-breadcrumb-cur">ระบบ Telemedicine & Drug</span>
          </nav>
          <h1 className="postal-title">11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์</h1>
          <p className="postal-subtitle">
            บริการจัดส่งยาทางไปรษณีย์ (Health Rider Project code) รหัส ADP DRUGP
          </p>
        </div>

        <div className="postal-header-actions">
          <button
            type="button"
            className="postal-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="postal-btn postal-btn-primary"
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
        <div className="postal-warning-banner" role="alert">
          <AlertTriangle size={20} className="postal-warning-icon" />
          <div className="postal-warning-content">
            <strong>ยังไม่ได้ Map รหัส ADP Code &apos;DRUGP&apos; ในระบบ</strong>
            <span>
              ไม่พบการผูกรหัสค่าบริการทางการแพทย์กับ ADP Code &apos;DRUGP&apos; ในตาราง s_drugitems
              กรุณาตรวจสอบการตั้งค่ารายการค่าบริการส่งยาทางไปรษณีย์
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Unified Single-Row Date Selector ── */}
      <div className="postal-date-toolbar">
        <div className="postal-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`postal-mode-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`postal-mode-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`postal-mode-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="postal-date-divider" />

        <div className="postal-date-controls">
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
                className="postal-select"
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
                className="postal-select"
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
              className="postal-select"
              value={selectedFiscalYear}
              onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
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

      {/* ── 4. Balanced 4x2 KPI Summary Cards ── */}
      <div className="postal-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`postal-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="postal-kpi-icon-wrap">
              <Package size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val">
              {summary.totalVisits.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
            <span>{summary.uniquePatients.toLocaleString('th-TH')} คน</span>
            <span>•</span>
            <span>รายได้ {formatMoney(summary.totalIncome)} บ.</span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`postal-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">ชดเชยแล้ว</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#047857', backgroundColor: '#ecfdf5' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val" style={{ color: '#047857' }}>
              {summary.compensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
            <span className="postal-kpi-badge" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
              {summary.compensationRate.toFixed(1)}%
            </span>
            <span>ชดเชย {formatMoney(summary.totalCompensated)} บ.</span>
          </div>
        </div>

        {/* Card 3: รอชดเชย / ยังไม่ได้ส่ง */}
        <div
          className={`postal-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">รอชดเชย / ยังไม่ส่ง</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#b45309', backgroundColor: '#fffbeb' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val" style={{ color: '#b45309' }}>
              {summary.uncompensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
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
          className={`postal-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">สิทธิบัตรทอง (UC)</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#0369a1', backgroundColor: '#f0f9ff' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val">
              {summary.ucCount.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
            <span className="postal-kpi-badge" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>
              {summary.ucRate.toFixed(1)}%
            </span>
            <span>ของทั้งหมด</span>
          </div>
        </div>

        {/* Card 5: มี ClaimCode */}
        <div
          className={`postal-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">มี ClaimCode</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#059669', backgroundColor: '#f0fdf4' }}>
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val">
              {summary.withAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
            <span className="postal-kpi-badge" style={{ backgroundColor: '#f0fdf4', color: '#059669' }}>
              {summary.authenRate.toFixed(1)}%
            </span>
            <span>ยืนยันตัวตนแล้ว</span>
          </div>
        </div>

        {/* Card 6: ไม่มี ClaimCode */}
        <div
          className={`postal-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">ไม่มี ClaimCode</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val" style={{ color: summary.withoutAuthenCount > 0 ? '#dc2626' : undefined }}>
              {summary.withoutAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
            <span>
              {summary.totalVisits > 0
                ? ((summary.withoutAuthenCount / summary.totalVisits) * 100).toFixed(1)
                : 0}
              %
            </span>
            <span>เสี่ยงเบิกชดเชยไม่ได้</span>
          </div>
        </div>

        {/* Card 7: มีค่าจัดส่งยา EMS */}
        <div
          className={`postal-kpi-card ${cardFilter === 'WITH_PRICE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_PRICE')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">มีค่าจัดส่งยา EMS</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#0D7446', backgroundColor: '#f7fbf9' }}>
              <Truck size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val">
              {summary.withPriceCount.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subtext">
            <span>ค่าส่งยา {formatMoney(summary.totalSumPrice)} บ.</span>
          </div>
        </div>

        {/* Card 8: ไม่มีค่าจัดส่งยา */}
        <div
          className={`postal-kpi-card ${cardFilter === 'WITHOUT_PRICE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITHOUT_PRICE')}
          role="button"
          tabIndex={0}
        >
          <div className="postal-kpi-header">
            <span className="postal-kpi-title">ไม่มีค่าจัดส่งยา (= 0)</span>
            <div className="postal-kpi-icon-wrap" style={{ color: '#64748b', backgroundColor: '#f1f5f9' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="postal-kpi-value-row">
            <span className="postal-kpi-main-val">
              {summary.withoutPriceCount.toLocaleString('th-TH')}
            </span>
            <span className="postal-kpi-unit">ครั้ง</span>
          </div>
          <div className="postal-kpi-subtext">
            <span className="postal-kpi-badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
              {summary.withoutPriceRate.toFixed(1)}%
            </span>
            <span>ยอดส่งยาเป็น 0 บ.</span>
          </div>
        </div>
      </div>

      {/* ── 5. Toolbar & Unified Global Search ── */}
      <div className="postal-toolbar">
        <div className="postal-search-wrap">
          <Search size={18} className="postal-search-icon" />
          <input
            type="text"
            className="postal-search-input"
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, VN, PDX, สิทธิ, แผนก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="postal-search-clear"
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

        <div className="postal-toolbar-actions">
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
          <div className="postal-count-info">
            พบ {totalCount.toLocaleString('th-TH')} รายการ
          </div>
        </div>
      </div>

      {/* ── 6. Error & Loading Messages ── */}
      {error && (
        <div className="postal-warning-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={20} className="postal-warning-icon" style={{ color: '#dc2626' }} />
          <div className="postal-warning-content">
            <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── 7. Records Table (Row-Clickable) ── */}
      <div className="postal-table-wrapper">
        <table className="postal-table">
          <thead>
            <tr>
              <th className="col-center" style={{ width: 60 }}>ลำดับ</th>
              <th className="col-center" style={{ width: 140 }}>
                <button
                  type="button"
                  className="postal-th-sort"
                  onClick={() => handleSort('vstdate')}
                >
                  <span>วันที่รับบริการ</span>
                  {renderSortIcon('vstdate')}
                </button>
              </th>
              <th className="col-center" style={{ width: 100 }}>
                <button
                  type="button"
                  className="postal-th-sort"
                  onClick={() => handleSort('hn')}
                >
                  <span>HN</span>
                  {renderSortIcon('hn')}
                </button>
              </th>
              <th className="col-center" style={{ width: 140 }}>
                <button
                  type="button"
                  className="postal-th-sort"
                  onClick={() => handleSort('cid')}
                >
                  <span>เลขบัตรประชาชน</span>
                  {renderSortIcon('cid')}
                </button>
              </th>
              <th className="col-center" style={{ minWidth: 180 }}>
                <button
                  type="button"
                  className="postal-th-sort"
                  onClick={() => handleSort('ptname')}
                >
                  <span>ชื่อ-สกุลผู้ป่วย</span>
                  {renderSortIcon('ptname')}
                </button>
              </th>
              <th className="col-center" style={{ width: 100 }}>เพศ / อายุ</th>
              <th className="col-center" style={{ minWidth: 140 }}>สิทธิการรักษา</th>
              <th className="col-center" style={{ minWidth: 150 }}>แผนก / คลินิก</th>
              <th className="col-center" style={{ width: 90 }}>
                <button
                  type="button"
                  className="postal-th-sort"
                  onClick={() => handleSort('pdx')}
                >
                  <span>PDX</span>
                  {renderSortIcon('pdx')}
                </button>
              </th>
              <th className="col-center" style={{ width: 120 }}>
                <button
                  type="button"
                  className="postal-th-sort"
                  onClick={() => handleSort('sum_price')}
                >
                  <span>ค่าส่งยา EMS</span>
                  {renderSortIcon('sum_price')}
                </button>
              </th>
              <th className="col-center" style={{ width: 130 }}>
                <button
                  type="button"
                  className="postal-th-sort"
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
                  className="postal-th-sort"
                  onClick={() => handleSort('compensated')}
                >
                  <span>ชดเชย (บาท)</span>
                  {renderSortIcon('compensated')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading || isRefreshing ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                  {Array.from({ length: 13 }).map((__, colIdx) => (
                    <td key={colIdx} className="col-center">
                      <div className="rcm-skeleton-bar" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={13} className="postal-empty-state">
                  <Package size={32} style={{ opacity: 0.3 }} />
                  <span>ไม่พบข้อมูลผู้ได้รับการส่งยาทางไปรษณีย์ในช่วงเวลาและเงื่อนไขที่เลือก</span>
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
                    <td className="col-center postal-num-cell">{item.no}</td>
                    <td className="col-center postal-num-cell">
                      <div style={{ fontWeight: 500 }}>
                        {formatThaiDate(item.vstdate)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500, #64748b)' }}>
                        {item.vsttime || '—'}
                      </div>
                    </td>
                    <td className="col-center postal-num-cell" style={{ fontWeight: 600 }}>
                      {item.hn}
                    </td>
                    <td className="col-center postal-num-cell">
                      {item.cid || '—'}
                    </td>
                    <td className="postal-ptname-cell">
                      <span className="postal-name-part" style={{ fontWeight: 600 }}>
                        {firstName}
                      </span>
                      {lastName ? (
                        <>
                          {' '}
                          <span className="postal-name-part">{lastName}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="col-center postal-num-cell" style={{ whiteSpace: 'nowrap' }}>
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
                      <span>{item.department || item.clinic || '—'}</span>
                    </td>
                    <td className="col-center postal-num-cell" style={{ fontWeight: 600 }}>
                      {item.pdx || '—'}
                    </td>
                    <td className="col-center postal-num-cell">
                      {item.sum_price > 0 ? (
                        <span style={{ fontWeight: 600, color: 'var(--primary, #0D7446)' }}>
                          {item.sum_price.toLocaleString('th-TH')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>0</span>
                      )}
                    </td>
                    <td className="col-center postal-num-cell">
                      {item.authencode ? (
                        <span className="postal-badge postal-badge-blue">
                          {item.authencode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>—</span>
                      )}
                    </td>
                    <td className="col-center" style={{ fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                        <span
                          className={`postal-badge ${
                            item.isCompensated
                              ? 'postal-badge-success'
                              : 'postal-badge-warning'
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
                    <td className="col-center postal-num-cell" style={{ fontWeight: 600 }}>
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
      <div className="postal-pagination">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--gray-600, #475569)' }}>
            หน้าที่ {currentPage} จาก {totalPages} หน้า (รวม {totalCount.toLocaleString('th-TH')} รายการ)
          </span>
          <select
            className="postal-select"
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

        <div className="postal-page-nav">
          <button
            type="button"
            className="postal-page-btn"
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
                className={`postal-page-btn ${currentPage === p ? 'active' : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            )
          })}

          <button
            type="button"
            className="postal-page-btn"
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
        <div className="postal-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="postal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="postal-modal-header">
              <div>
                <h3 className="postal-modal-title">
                  รายละเอียดผู้ได้รับการส่งยาทางไปรษณีย์
                </h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500, #64748b)', marginTop: 2 }}>
                  VN: {selectedItem.vn} • HN: {selectedItem.hn} • วันที่ {formatThaiDate(selectedItem.vstdate)}
                </div>
              </div>
              <button
                type="button"
                className="postal-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="postal-modal-tabs">
              <button
                type="button"
                className={`postal-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                สรุปข้อมูลการรับบริการ
              </button>
              <button
                type="button"
                className={`postal-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ข้อมูลทางคลินิก (เวชระเบียน)
              </button>
            </div>

            <div className="postal-modal-body">
              {modalTab === 'summary' ? (
                <>
                  <div className="postal-detail-grid">
                    <div className="postal-detail-item">
                      <span className="postal-detail-label">ชื่อ-สกุลผู้ป่วย</span>
                      <span className="postal-detail-val">
                        <span>{selectedItem.ptname}</span>
                        <button
                          type="button"
                          className="postal-copy-btn"
                          onClick={() => handleCopyText(selectedItem.ptname, 'ptname')}
                          title="คัดลอกชื่อ"
                        >
                          {copiedField === 'ptname' ? <Check size={14} style={{ color: '#047857' }} /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">เลขประจำตัวประชาชน (CID)</span>
                      <span className="postal-detail-val">
                        <span>{selectedItem.cid || '—'}</span>
                        {selectedItem.cid && (
                          <button
                            type="button"
                            className="postal-copy-btn"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คัดลอกเลขบัตร"
                          >
                            {copiedField === 'cid' ? <Check size={14} style={{ color: '#047857' }} /> : <Copy size={14} />}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">เพศ / อายุ</span>
                      <span className="postal-detail-val">
                        {selectedItem.sex} • {selectedItem.age} ปี
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">วันที่และเวลารับบริการ</span>
                      <span className="postal-detail-val">
                        {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">ClaimCode (การยืนยันตัวตน)</span>
                      <span className="postal-detail-val">
                        {selectedItem.authencode ? (
                          <span className="postal-badge postal-badge-blue">
                            {selectedItem.authencode}
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>ไม่มี ClaimCode</span>
                        )}
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">สิทธิการรักษา</span>
                      <span className="postal-detail-val">
                        {selectedItem.pttypename}
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">แผนก / คลินิก</span>
                      <span className="postal-detail-val">
                        {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">การวินิจฉัยหลัก (PDX)</span>
                      <span className="postal-detail-val" style={{ color: '#0D7446' }}>
                        {selectedItem.pdx || '—'}
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">ค่าจัดส่งยา EMS (บาท)</span>
                      <span className="postal-detail-val" style={{ color: 'var(--primary, #0D7446)' }}>
                        {selectedItem.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">ค่าบริการรวมทั้ง Visit (บาท)</span>
                      <span className="postal-detail-val">
                        {selectedItem.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">สถานะการชดเชย / REP</span>
                      <span className="postal-detail-val">
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

                    <div className="postal-detail-item">
                      <span className="postal-detail-label">ยอดชดเชยที่ได้รับ (บาท)</span>
                      <span className="postal-detail-val" style={{ color: '#047857' }}>
                        {selectedItem.compensated > 0
                          ? `${formatMoney(selectedItem.compensated)} บาท`
                          : 'ยังไม่ได้รับชดเชย'}
                      </span>
                    </div>

                    {selectedItem.fund && (
                      <div className="postal-detail-item">
                        <span className="postal-detail-label">กองทุน (Fund / Subfund)</span>
                        <span className="postal-detail-val" style={{ fontSize: '0.875rem' }}>
                          {selectedItem.fund} {selectedItem.subfund ? `(${selectedItem.subfund})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedItem.listname && (
                    <div className="postal-detail-item">
                      <span className="postal-detail-label">รายการค่าส่งยาที่ผูก ADP</span>
                      <span className="postal-detail-val" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {selectedItem.listname}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  {loadingVnDetails ? (
                    <div className="postal-empty-state">
                      <RefreshCw size={24} className="animate-spin" />
                      <span>กำลังโหลดข้อมูลเวชระเบียน...</span>
                    </div>
                  ) : vnDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="postal-detail-grid">
                        <div className="postal-detail-item">
                          <span className="postal-detail-label">สัญญาณชีพ (Vital Signs)</span>
                          <span className="postal-detail-val" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            BP: {vnDetails.screen?.bps || '—'}/{vnDetails.screen?.bpd || '—'} mmHg • ชีพจร: {vnDetails.screen?.pulse || '—'} • น้ำหนัก: {vnDetails.screen?.bw || '—'} กก.
                          </span>
                        </div>
                        <div className="postal-detail-item">
                          <span className="postal-detail-label">อาการสำคัญ (Chief Complaint)</span>
                          <span className="postal-detail-val" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            {vnDetails.screen?.cc || '—'}
                          </span>
                        </div>
                      </div>

                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div className="postal-detail-item">
                          <span className="postal-detail-label">รายการการวินิจฉัยโรค (Diagnoses)</span>
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
                        <div className="postal-detail-item">
                          <span className="postal-detail-label">รายการยาและเวชภัณฑ์</span>
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
                    <div className="postal-empty-state">
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
