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
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Check,
  Copy,
  Info,
  DollarSign,
  Activity,
  FileText,
  Stethoscope,
  BedDouble,
  Tag,
} from 'lucide-react'
import type {
  AdpSearchItem,
  AdpSearchSummary,
  AdpSearchCardFilter,
  AdpMappingCheck,
  AdpSearchReportResult,
  PatientType,
  AdpOption,
} from '@/lib/clinical/rcmAdpSearchService'
import { POPULAR_ADP_PRESETS, parseAdpCodes } from '@/lib/clinical/rcmAdpSearchService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import AdpMultiSelect from './AdpMultiSelect'
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

export interface AdpSearchClientProps {
  initialData?: AdpSearchReportResult | null
  availableOptions?: AdpOption[]
}

export default function AdpSearchClient({
  initialData = null,
  availableOptions = [],
}: AdpSearchClientProps) {
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

  // Patient type state: OPD or IPD
  const [patientType, setPatientType] = useState<PatientType>(initialData?.patientType ?? 'OPD')

  // ADP Code input & multi-select states
  const initialCodes = useMemo(() => {
    return parseAdpCodes(initialData?.adpCode ?? '14001')
  }, [initialData?.adpCode])

  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialCodes)
  const [appliedAdpCode, setAppliedAdpCode] = useState<string>(initialData?.adpCode ?? '14001')

  // Available ADP options
  const defaultOptions: AdpOption[] = useMemo(() => {
    return POPULAR_ADP_PRESETS.map((p) => ({
      code: p.code,
      title: p.title,
      category: p.category,
    }))
  }, [])

  const [adpOptions, setAdpOptions] = useState<AdpOption[]>(
    availableOptions && availableOptions.length > 0 ? availableOptions : defaultOptions
  )

  // Client-side fallback if SSR options were empty
  useEffect(() => {
    if (!availableOptions || availableOptions.length === 0) {
      fetch('/api/service/dashboard-rcm/funds/adp-search?options=true')
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            setAdpOptions(json.data)
          }
        })
        .catch(() => {})
    }
  }, [availableOptions])

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
  const [cardFilter, setCardFilter] = useState<AdpSearchCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<string>(
    initialData?.sortBy ?? (initialData?.patientType === 'IPD' ? 'dchdate' : 'vstdate')
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialData?.sortOrder ?? 'desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AdpSearchItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<AdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCodes: ['14001'],
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<AdpSearchSummary>(
    initialData?.summary ?? {
      totalRecords: 0,
      uniquePatients: 0,
      totalIncome: 0,
      totalCompensated: 0,
      totalDebt: 0,
      compensatedCount: 0,
      uncompensatedCount: 0,
      compensationRate: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      withOperationCount: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<AdpSearchItem | null>(null)
  const [modalTab, setModalTab] = useState<'overview' | 'clinical'>('overview')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Fetch Data Callback
  const fetchData = useCallback(
    async (refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      if (refresh) setIsRefreshing(true)
      setError(null)

      try {
        const queryParams = new URLSearchParams({
          patientType,
          adpCode: appliedAdpCode,
          ds1,
          ds2,
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/adp-search?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: AdpSearchReportResult = json.data
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
      patientType,
      appliedAdpCode,
      ds1,
      ds2,
      cardFilter,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  )

  // Trigger fetch on parameter changes (skipping first mount if initialData is provided)
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

  // Fetch optional deep VN details for modal
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/adp-search/vn-details?vn=${encodeURIComponent(vn)}`
      )
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

  // Row Click handler (Opens modal directly!)
  const handleRowClick = (item: AdpSearchItem) => {
    setSelectedItem(item)
    setModalTab('overview')
    setVnDetails(null)
  }

  const handleModalTabChange = (tab: 'overview' | 'clinical') => {
    setModalTab(tab)
    if (
      tab === 'clinical' &&
      selectedItem &&
      selectedItem.patientType === 'OPD' &&
      !vnDetails &&
      !loadingVnDetails
    ) {
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

  // Handle Patient Type Switch
  const handleTypeChange = (type: PatientType) => {
    if (type === patientType) return
    setPatientType(type)
    setCardFilter('ALL')
    setCurrentPage(1)
    setSortBy(type === 'IPD' ? 'dchdate' : 'vstdate')
  }

  // Handle Multi-Select Codes Change
  const handleCodesChange = (codes: string[]) => {
    setSelectedCodes(codes)
  }

  // Handle ADP Code Submit
  const handleApplyAdpCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanCodes = selectedCodes.map((c) => c.trim()).filter(Boolean)
    const codeString = cleanCodes.length > 0 ? cleanCodes.join(', ') : '14001'
    setAppliedAdpCode(codeString)
    setCardFilter('ALL')
    setCurrentPage(1)
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

  // Handle Sorting
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Export to CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        patientType,
        adpCode: appliedAdpCode,
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/adp-search?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')
      }

      const exportItems: AdpSearchItem[] = json.data.items

      const headers = [
        'ลำดับ',
        'ประเภท',
        'รหัส ADP',
        patientType === 'IPD' ? 'วันที่จำหน่าย' : 'วันที่รับบริการ',
        'HN',
        patientType === 'IPD' ? 'AN' : 'VN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สิทธิการรักษา',
        'รายการที่เลือก',
        'รหัส icode',
        'การวินิจฉัยโรค',
        'หัตถการ',
        'ค่าบริการ (บาท)',
        'ชดเชย (บาท)',
        'ยอดค้างชำระ (บาท)',
        'สถานะการชดเชย',
        'Authen Code',
        'เลข Rep',
        'กองทุน (Fund)',
      ]

      const rows = exportItems.map((it) => [
        it.no,
        it.patientType,
        it.nhsoAdpCode,
        it.vstdate,
        it.hn,
        it.patientType === 'IPD' ? it.an || '' : it.vn,
        `="${it.cid}"`,
        `"${it.ptname.replace(/"/g, '""')}"`,
        it.sex,
        it.age,
        `"${(it.pttypename || '').replace(/"/g, '""')}"`,
        `"${(it.name || '').replace(/"/g, '""')}"`,
        it.icode,
        `"${(it.diag || it.pdx || '').replace(/"/g, '""')}"`,
        `"${(it.operation || it.proc || '').replace(/"/g, '""')}"`,
        it.income,
        it.compensated,
        it.nee,
        it.isCompensated ? 'ชดเชยแล้ว' : 'ยังไม่ชดเชย',
        it.authencode || '',
        it.rep || it.invoiceclaim || '',
        it.fund || '',
      ])

      const csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const sanitizedAdp = appliedAdpCode.replace(/[^A-Za-z0-9]/g, '_')
      link.setAttribute(
        'href',
        url
      )
      link.setAttribute(
        'download',
        `adp-search-${patientType.toLowerCase()}-${sanitizedAdp}-${ds1}-to-${ds2}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์ CSV')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="adp-page">
      {/* ── Page Header ── */}
      <header className="adp-header">
        <nav className="adp-breadcrumb" aria-label="breadcrumb">
          <Link href="/service/dashboard-rcm" className="adp-breadcrumb-link">
            Dashboard RCM
          </Link>
          <span className="adp-breadcrumb-sep">/</span>
          <span className="adp-breadcrumb-link">กองทุน</span>
          <span className="adp-breadcrumb-sep">/</span>
          <span className="adp-breadcrumb-current">ค้นหาจากรหัส ADPCODE</span>
        </nav>

        <div className="adp-title-row">
          <div className="adp-title-group">
            <h1 className="adp-title">ค้นหาจากรหัส ADPCODE</h1>
            <p className="adp-subtitle">
              ค้นหารายชื่อผู้รับบริการและข้อมูลการชดเชยค่าบริการทางการแพทย์จากรหัส ADP (OPD & IPD)
            </p>
          </div>

          <div className="adp-actions-row">
            {/* Patient Type Switcher: OPD / IPD */}
            <div className="adp-type-switcher" role="group" aria-label="ประเภทผู้ป่วย">
              <button
                type="button"
                className={`adp-type-btn ${patientType === 'OPD' ? 'active' : ''}`}
                onClick={() => handleTypeChange('OPD')}
              >
                ผู้ป่วยนอก (OPD)
              </button>
              <button
                type="button"
                className={`adp-type-btn ${patientType === 'IPD' ? 'active' : ''}`}
                onClick={() => handleTypeChange('IPD')}
              >
                ผู้ป่วยใน (IPD)
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="adp-btn adp-btn-secondary"
              onClick={() => fetchData(true)}
              disabled={loading || isRefreshing}
              title="รีเฟรชข้อมูลจากฐานข้อมูล"
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
              <span>รีเฟรช</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              className="adp-btn adp-btn-secondary"
              onClick={handleExportCsv}
              disabled={loading || isExporting || totalCount === 0}
              title="ส่งออกรายงานเป็นไฟล์ CSV"
            >
              <Download size={16} />
              <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก CSV'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── ADP Code Control Card (Multi Selector Dropdown) ── */}
      <section className="adp-control-card">
        <form onSubmit={handleApplyAdpCode} className="adp-code-form-row">
          <div className="adp-multi-select-wrapper">
            <AdpMultiSelect
              options={adpOptions}
              selectedCodes={selectedCodes}
              onChange={handleCodesChange}
              onSearchSubmit={() => handleApplyAdpCode()}
              disabled={loading || isRefreshing}
            />
          </div>

          <button
            type="submit"
            className="adp-btn adp-btn-primary"
            disabled={loading || isRefreshing}
          >
            <Search size={16} />
            <span>ค้นหารหัส ADP</span>
          </button>
        </form>

        {/* Mapping Status Check Banner */}
        <div
          className={`adp-mapping-banner ${adpMapping.isMapped ? 'success' : 'warning'}`}
        >
          <div className="adp-mapping-content">
            {adpMapping.isMapped ? (
              <Check size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>
              {adpMapping.isMapped
                ? `พบการ Map รหัส ADP [${appliedAdpCode}] ในฐานข้อมูล HOSxP s_drugitems จำนวน ${adpMapping.mappedCount} รายการ`
                : `คำเตือน: ยังไม่พบการ Map รหัส ADP [${appliedAdpCode}] ในตาราง s_drugitems ของโรงพยาบาล`}
            </span>
          </div>
          {adpMapping.items.length > 0 && (
            <span className="adp-mapping-items-text">
              {adpMapping.items.map((i) => i.name).slice(0, 3).join(', ')}
              {adpMapping.items.length > 3 ? ` และอีก ${adpMapping.items.length - 3} รายการ` : ''}
            </span>
          )}
        </div>
      </section>

      {/* ── Single-Row Unified Date Selector ── */}
      <section className="as-date-bar">
        <div className="as-date-row">
          {/* Mode Switcher: กำหนดเอง | เดือน | ปีงบประมาณ (No leading numbers!) */}
          <div className="as-date-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`as-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`as-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`as-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="as-date-divider" />

          {/* Date Range Inputs */}
          {dateMode === 'custom' && (
            <div className="as-date-inputs">
              <span className="as-date-label">เริ่มต้น</span>
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
              />
              <span className="as-date-label">ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="as-date-inputs">
              <span className="as-date-label">ประจำเดือน</span>
              <select
                className="as-select"
                value={selectedMonth}
                onChange={(e) =>
                  handleMonthYearChange(parseInt(e.target.value, 10), selectedBeYear)
                }
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="as-select"
                value={selectedBeYear}
                onChange={(e) =>
                  handleMonthYearChange(selectedMonth, parseInt(e.target.value, 10))
                }
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
            <div className="as-date-inputs">
              <span className="as-date-label">เลือกปี</span>
              {/* Only 'ปีงบประมาณ [พ.ศ.]', no distracting date range in parentheses */}
              <select
                className="as-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(parseInt(e.target.value, 10))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* ── Symmetrical KPI Summary Cards Grid (Clickable to Filter) ── */}
      <section className="adp-kpi-grid">
        {patientType === 'OPD' ? (
          <>
            {/* 1. ทั้งหมด */}
            <div
              className={`adp-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('ALL')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ผู้รับบริการทั้งหมด</span>
                <div className="adp-kpi-icon">
                  <UserCheck size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.totalRecords.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.uniquePatients.toLocaleString()} คน</span>
              </div>
            </div>

            {/* 2. ชดเชยแล้ว */}
            <div
              className={`adp-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('COMPENSATED')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ชดเชยแล้ว</span>
                <div className="adp-kpi-icon">
                  <Check size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.compensatedCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.compensationRate}%</span>
              </div>
            </div>

            {/* 3. ยังไม่ชดเชย */}
            <div
              className={`adp-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('UNCOMPENSATED')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ยังไม่ชดเชย</span>
                <div className="adp-kpi-icon">
                  <ReceiptText size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.uncompensatedCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">
                  {(100 - summary.compensationRate).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* 4. มี Authen Code */}
            <div
              className={`adp-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('WITH_AUTHEN')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">มี Authen Code</span>
                <div className="adp-kpi-icon">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.withAuthenCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.authenRate}%</span>
              </div>
            </div>

            {/* 5. ไม่มี Authen Code */}
            <div
              className={`adp-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('NO_AUTHEN')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ไม่มี Authen Code</span>
                <div className="adp-kpi-icon">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.withoutAuthenCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">
                  {(100 - summary.authenRate).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* 6. สิทธิบัตรทอง */}
            <div
              className={`adp-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('UC_ONLY')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">สิทธิบัตรทอง (UC)</span>
                <div className="adp-kpi-icon">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.ucCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.ucRate}%</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* IPD Cards: Balanced 6 cards */}
            <div
              className={`adp-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('ALL')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ผู้ป่วยในทั้งหมด</span>
                <div className="adp-kpi-icon">
                  <BedDouble size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.totalRecords.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.uniquePatients.toLocaleString()} คน</span>
              </div>
            </div>

            <div
              className={`adp-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('COMPENSATED')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ชดเชยแล้ว</span>
                <div className="adp-kpi-icon">
                  <Check size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.compensatedCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.compensationRate}%</span>
              </div>
            </div>

            <div
              className={`adp-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('UNCOMPENSATED')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">ยังไม่ชดเชย</span>
                <div className="adp-kpi-icon">
                  <ReceiptText size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.uncompensatedCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">
                  {(100 - summary.compensationRate).toFixed(1)}%
                </span>
              </div>
            </div>

            <div
              className={`adp-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('UC_ONLY')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">สิทธิบัตรทอง (UC)</span>
                <div className="adp-kpi-icon">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.ucCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">{summary.ucRate}%</span>
              </div>
            </div>

            <div
              className={`adp-kpi-card ${cardFilter === 'WITH_OPERATION' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('WITH_OPERATION')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">มีหัตถการ (Procedure)</span>
                <div className="adp-kpi-icon">
                  <Activity size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.withOperationCount.toLocaleString()}</span>
                <span className="adp-kpi-rate">เคส</span>
              </div>
            </div>

            <div
              className={`adp-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setCardFilter('ALL')
                setCurrentPage(1)
              }}
            >
              <div className="adp-kpi-header">
                <span className="adp-kpi-title">อัตราการชดเชยรวม</span>
                <div className="adp-kpi-icon">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="adp-kpi-body">
                <span className="adp-kpi-value">{summary.compensationRate}%</span>
                <span className="adp-kpi-rate">{formatMoney(summary.totalCompensated)} ฿</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Financial Highlights Bar ── */}
      <section className="adp-fin-bar">
        <div className="adp-fin-item">
          <div className="adp-fin-icon">
            <DollarSign size={18} />
          </div>
          <div>
            <div className="adp-fin-label">ค่าบริการรวม (Income)</div>
            <div className="adp-fin-val">{formatMoney(summary.totalIncome)} บาท</div>
          </div>
        </div>

        <div className="adp-fin-item">
          <div className="adp-fin-icon">
            <ReceiptText size={18} />
          </div>
          <div>
            <div className="adp-fin-label">ยอดเงินชดเชยรวม (Compensated)</div>
            <div className="adp-fin-val green">{formatMoney(summary.totalCompensated)} บาท</div>
          </div>
        </div>

        <div className="adp-fin-item">
          <div className="adp-fin-icon">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="adp-fin-label">ยอดค้างชำระ (Nee)</div>
            <div className="adp-fin-val amber">{formatMoney(summary.totalDebt)} บาท</div>
          </div>
        </div>
      </section>

      {/* ── Search & Filter Toolbar ── */}
      <section className="adp-toolbar">
        {/* Unified Global Search (No field dropdown clutter!) */}
        <div className="adp-search-wrapper">
          <Search size={16} className="adp-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, VN/AN, สิทธิ, รหัสโรค, รหัส ADP, รายการ..."
            className="adp-search-input"
            aria-label="ค้นหาข้อมูล"
          />
          {search && (
            <button
              type="button"
              className="adp-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="adp-toolbar-info">
          <span>พบ </span>
          <span className="adp-count-highlight">{totalCount.toLocaleString()}</span>
          <span> รายการ {cardFilter !== 'ALL' && `(ตัวกรอง: ${cardFilter})`}</span>
        </div>
      </section>

      {/* ── Table Card ── */}
      <section className="adp-table-card">
        {error ? (
          <div className="adp-empty-state">
            <div className="adp-empty-icon">
              <AlertTriangle size={24} />
            </div>
            <h3 className="adp-empty-title">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
            <p className="adp-empty-text">{error}</p>
            <button
              type="button"
              className="adp-btn adp-btn-secondary"
              onClick={() => fetchData(true)}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="adp-empty-state">
            <div className="adp-empty-icon">
              <RefreshCw size={24} className="spin" />
            </div>
            <h3 className="adp-empty-title">กำลังค้นหาข้อมูลจากระบบ</h3>
            <p className="adp-empty-text">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลรายงานตามรหัส ADP</p>
          </div>
        ) : items.length === 0 ? (
          <div className="adp-empty-state">
            <div className="adp-empty-icon">
              <Search size={24} />
            </div>
            <h3 className="adp-empty-title">ไม่พบรายการข้อมูล</h3>
            <p className="adp-empty-text">
              ไม่พบข้อมูลผู้รับบริการที่ตรงกับเงื่อนไขรหัส ADP หรือตัวกรองที่ระบุในช่วงเวลานี้
            </p>
          </div>
        ) : (
          <div className="adp-table-scroll">
            <table className="adp-table">
              <thead>
                <tr>
                  <th className="col-center" style={{ width: '60px' }}>
                    ลำดับ
                  </th>
                  <th className="col-center" style={{ width: '130px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort(patientType === 'IPD' ? 'dchdate' : 'vstdate')}
                    >
                      <span>{patientType === 'IPD' ? 'วันที่จำหน่าย' : 'วันที่รับบริการ'}</span>
                      {sortBy === (patientType === 'IPD' ? 'dchdate' : 'vstdate') ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '90px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort('hn')}
                    >
                      <span>HN</span>
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '140px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort('cid')}
                    >
                      <span>เลขบัตรประชาชน</span>
                      {sortBy === 'cid' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ minWidth: '180px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort('ptname')}
                    >
                      <span>ชื่อ-สกุลผู้ป่วย</span>
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '80px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort('age')}
                    >
                      <span>อายุ</span>
                      {sortBy === 'age' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-left" style={{ minWidth: '140px' }}>
                    สิทธิการรักษา
                  </th>
                  <th className="col-center" style={{ width: '100px' }}>
                    รหัส ADP
                  </th>
                  <th className="col-left" style={{ minWidth: '200px' }}>
                    รายการที่เลือก
                  </th>
                  <th className="col-center" style={{ width: '110px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort('income')}
                    >
                      <span>ค่าบริการ</span>
                      {sortBy === 'income' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '110px' }}>
                    <button
                      type="button"
                      className="adp-th-sort-btn"
                      onClick={() => handleSort('compensated')}
                    >
                      <span>ชดเชย (บาท)</span>
                      {sortBy === 'compensated' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center" style={{ width: '100px' }}>
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  // Format patient name intact wrap
                  const nameParts = item.ptname.split(' ')
                  const firstName = nameParts[0] || ''
                  const lastName = nameParts.slice(1).join(' ')

                  return (
                    <tr
                      key={`${item.vn || item.an}-${item.icode}-${item.no}`}
                      onClick={() => handleRowClick(item)}
                      title="กดเพื่อดูรายละเอียดเวชระเบียนและข้อมูลการเงิน"
                    >
                      <td className="col-center adp-num">{item.no}</td>
                      <td className="col-center adp-num">
                        {formatThaiDate(item.vstdate)}
                      </td>
                      <td className="col-center adp-num">{item.hn}</td>
                      {/* Full 13-digit Thai Citizen ID without hyphens */}
                      <td className="col-center adp-num">{item.cid}</td>
                      {/* Centered Patient Name on X-Axis with intact surname wrap */}
                      <td className="col-center">
                        <div className="adp-ptname-box">
                          <span className="adp-ptname-first">{firstName}</span>
                          {lastName && <span className="adp-ptname-last">{lastName}</span>}
                        </div>
                      </td>
                      {/* Age and Unit cohesion */}
                      <td className="col-center adp-num" style={{ whiteSpace: 'nowrap' }}>
                        {item.age}&nbsp;ปี
                      </td>
                      <td className="col-left">
                        <span title={item.pttypename}>{item.pttypename}</span>
                      </td>
                      <td className="col-center">
                        <span className="adp-badge adp-badge-blue">{item.nhsoAdpCode}</span>
                      </td>
                      <td className="col-left">
                        <div title={`${item.icode}: ${item.name}`}>
                          <div style={{ fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            icode: {item.icode}
                          </div>
                        </div>
                      </td>
                      <td className="col-center adp-num">
                        {formatMoney(item.income)}
                      </td>
                      {/* Centered Reimbursement Column */}
                      <td className="col-center adp-num" style={{ fontWeight: 600 }}>
                        {formatMoney(item.compensated)}
                      </td>
                      <td className="col-center">
                        {item.isCompensated ? (
                          <span className="adp-badge adp-badge-green">ชดเชยแล้ว</span>
                        ) : (
                          <span className="adp-badge adp-badge-gray">รอชดเชย</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Bar ── */}
        {totalCount > 0 && (
          <div className="adp-pagination">
            <div className="adp-page-size-wrap">
              <span>แสดงแถวต่อหน้า:</span>
              <select
                className="as-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10))
                  setCurrentPage(1)
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div className="adp-page-nav">
              <button
                type="button"
                className="adp-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="adp-page-current">
                หน้า {currentPage.toLocaleString()} จาก {totalPages.toLocaleString()}
              </span>
              <button
                type="button"
                className="adp-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Detail Modal (Opened directly by clicking record row!) ── */}
      {selectedItem && (
        <div
          className="adp-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null)
          }}
        >
          <div className="adp-modal-box" role="dialog" aria-modal="true">
            {/* Modal Header */}
            <div className="adp-modal-header">
              <div className="adp-modal-title-wrap">
                <h2 className="adp-modal-title">
                  {selectedItem.ptname} ({selectedItem.sex}, {selectedItem.age} ปี)
                </h2>
                <div className="adp-modal-sub">
                  HN: {selectedItem.hn} • {selectedItem.patientType === 'IPD' ? 'AN' : 'VN'}:{' '}
                  {selectedItem.patientType === 'IPD' ? selectedItem.an : selectedItem.vn} •
                  วันที่: {formatThaiDate(selectedItem.vstdate)}
                </div>
              </div>
              <button
                type="button"
                className="adp-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="adp-modal-tabs">
              <button
                type="button"
                className={`adp-modal-tab-btn ${modalTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('overview')}
              >
                ข้อมูลภาพรวม & การเงิน
              </button>
              <button
                type="button"
                className={`adp-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ข้อมูลคลินิก & รายการที่ตรวจ
              </button>
            </div>

            {/* Modal Content */}
            <div className="adp-modal-content">
              {modalTab === 'overview' ? (
                <>
                  {/* Demographics & Service */}
                  <div>
                    <div className="adp-modal-section-title">
                      <UserCheck size={16} />
                      <span>ข้อมูลทั่วไปและการรับบริการ</span>
                    </div>
                    <div className="adp-modal-grid-2">
                      <div className="adp-field-row">
                        <span className="adp-field-label">เลขบัตรประชาชน (CID)</span>
                        <div className="adp-field-value">
                          <span>{selectedItem.cid}</span>
                          <button
                            type="button"
                            className="adp-copy-btn"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คัดลอกเลขบัตรประชาชน"
                          >
                            {copiedField === 'cid' ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">HN / {selectedItem.patientType === 'IPD' ? 'AN' : 'VN'}</span>
                        <div className="adp-field-value">
                          <span>
                            {selectedItem.hn} / {selectedItem.patientType === 'IPD' ? selectedItem.an : selectedItem.vn}
                          </span>
                        </div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">สิทธิการรักษา</span>
                        <div className="adp-field-value">
                          <span>{selectedItem.pttypename}</span>
                          {selectedItem.isUc && (
                            <span className="adp-badge adp-badge-green">สิทธิบัตรทอง</span>
                          )}
                        </div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">แผนก / แผนกหลัก</span>
                        <div className="adp-field-value">
                          <span>{selectedItem.department || selectedItem.clinic || '—'}</span>
                        </div>
                      </div>

                      {selectedItem.hospmain && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">สถานพยาบาลหลัก (Hospmain)</span>
                          <div className="adp-field-value">{selectedItem.hospmain}</div>
                        </div>
                      )}

                      {selectedItem.hospsub && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">สถานพยาบาลรอง (Hospsub)</span>
                          <div className="adp-field-value">{selectedItem.hospsub}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Reimbursement */}
                  <div>
                    <div className="adp-modal-section-title">
                      <DollarSign size={16} />
                      <span>ข้อมูลค่ารักษาและการชดเชย</span>
                    </div>
                    <div className="adp-modal-grid-2">
                      <div className="adp-field-row">
                        <span className="adp-field-label">ค่าบริการทั้งหมด (Income)</span>
                        <div className="adp-field-value">{formatMoney(selectedItem.income)} บาท</div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">ยอดชดเชยรวม (Compensated)</span>
                        <div className="adp-field-value" style={{ color: 'var(--primary)' }}>
                          {formatMoney(selectedItem.compensated)} บาท
                        </div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">ยอดค้างชำระ (Nee)</span>
                        <div className="adp-field-value">{formatMoney(selectedItem.nee)} บาท</div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">ใบตอบรับ (Rep) / Invoice Claim</span>
                        <div className="adp-field-value">
                          <span>{selectedItem.rep || selectedItem.invoiceclaim || '—'}</span>
                        </div>
                      </div>

                      {selectedItem.fund && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">กองทุน (Fund / Subfund)</span>
                          <div className="adp-field-value">
                            {selectedItem.fund} {selectedItem.subfund ? `(${selectedItem.subfund})` : ''}
                          </div>
                        </div>
                      )}

                      {selectedItem.projectcode && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">รหัสโครงการ (Project Code)</span>
                          <div className="adp-field-value">{selectedItem.projectcode}</div>
                        </div>
                      )}

                      {selectedItem.authencode && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">Authen Code</span>
                          <div className="adp-field-value">
                            <span>{selectedItem.authencode}</span>
                            <button
                              type="button"
                              className="adp-copy-btn"
                              onClick={() => handleCopyText(selectedItem.authencode!, 'authen')}
                              title="คัดลอก Authen Code"
                            >
                              {copiedField === 'authen' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedItem.approvalcode && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">KTB Approval / EDC</span>
                          <div className="adp-field-value">{selectedItem.approvalcode}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Clinical & Items Tab */}
                  <div>
                    <div className="adp-modal-section-title">
                      <Stethoscope size={16} />
                      <span>ข้อมูลการวินิจฉัยและหัตถการ</span>
                    </div>
                    <div className="adp-modal-grid-2">
                      <div className="adp-field-row">
                        <span className="adp-field-label">การวินิจฉัยโรค (Diagnosis)</span>
                        <div className="adp-field-value">
                          {selectedItem.diag ||
                            selectedItem.pdx ||
                            (selectedItem.pdxname
                              ? `${selectedItem.pdx}: ${selectedItem.pdxname}`
                              : '—')}
                        </div>
                      </div>

                      {selectedItem.sdx && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">การวินิจฉัยร่วม (SDX)</span>
                          <div className="adp-field-value">{selectedItem.sdx}</div>
                        </div>
                      )}

                      {(selectedItem.operation || selectedItem.proc) && (
                        <div className="adp-field-row">
                          <span className="adp-field-label">หัตถการ (Operation / Procedure)</span>
                          <div className="adp-field-value">
                            {selectedItem.operation || selectedItem.proc}
                          </div>
                        </div>
                      )}

                      {selectedItem.symptom && (
                        <div className="adp-field-row" style={{ gridColumn: 'span 2' }}>
                          <span className="adp-field-label">อาการสำคัญ (Chief Complaint)</span>
                          <div className="adp-field-value">{selectedItem.symptom}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target ADP Item */}
                  <div>
                    <div className="adp-modal-section-title">
                      <Tag size={16} />
                      <span>รายการที่ตรงกับรหัส ADP ที่ค้นหา</span>
                    </div>
                    <div className="adp-modal-grid-2">
                      <div className="adp-field-row">
                        <span className="adp-field-label">รหัส NHSO ADP</span>
                        <div className="adp-field-value">
                          <span className="adp-badge adp-badge-blue">{selectedItem.nhsoAdpCode}</span>
                        </div>
                      </div>

                      <div className="adp-field-row">
                        <span className="adp-field-label">รหัส icode</span>
                        <div className="adp-field-value">{selectedItem.icode}</div>
                      </div>

                      <div className="adp-field-row" style={{ gridColumn: 'span 2' }}>
                        <span className="adp-field-label">ชื่อรายการตรวจ / ยา</span>
                        <div className="adp-field-value">{selectedItem.name}</div>
                      </div>
                    </div>
                  </div>

                  {/* Complete items list from opitemrece */}
                  {selectedItem.listname && (
                    <div>
                      <div className="adp-modal-section-title">
                        <FileText size={16} />
                        <span>รายการค่าบริการทางการแพทย์ทั้งหมดในครั้งนี้ (opitemrece)</span>
                      </div>
                      <div className="adp-items-box">{selectedItem.listname}</div>
                    </div>
                  )}

                  {/* Deep Clinical Details if loaded */}
                  {loadingVnDetails && (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                      <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} />
                      กำลังดึงรายละเอียดเวชระเบียนเชิงลึก...
                    </div>
                  )}

                  {vnDetails && (
                    <div>
                      <div className="adp-modal-section-title">
                        <Activity size={16} />
                        <span>สัญญาณชีพ & ประวัติการคัดกรอง</span>
                      </div>
                      <div className="adp-modal-grid-2">
                        <div className="adp-field-row">
                          <span className="adp-field-label">ความดันโลหิต (BP)</span>
                          <div className="adp-field-value">
                            {vnDetails.screen?.bps && vnDetails.screen?.bpd
                              ? `${vnDetails.screen.bps}/${vnDetails.screen.bpd} mmHg`
                              : '—'}
                          </div>
                        </div>

                        <div className="adp-field-row">
                          <span className="adp-field-label">ชีพจร / อุณหภูมิ</span>
                          <div className="adp-field-value">
                            {vnDetails.screen?.pulse ? `${vnDetails.screen.pulse} bpm` : '—'} /{' '}
                            {vnDetails.screen?.temperature ? `${vnDetails.screen.temperature} °C` : '—'}
                          </div>
                        </div>

                        <div className="adp-field-row">
                          <span className="adp-field-label">น้ำหนัก / ส่วนสูง / BMI</span>
                          <div className="adp-field-value">
                            {vnDetails.screen?.bw ? `${vnDetails.screen.bw} kg` : '—'} /{' '}
                            {vnDetails.screen?.height ? `${vnDetails.screen.height} cm` : '—'} /{' '}
                            {vnDetails.screen?.bmi ? vnDetails.screen.bmi : '—'}
                          </div>
                        </div>

                        <div className="adp-field-row">
                          <span className="adp-field-label">แพทย์ผู้ตรวจ</span>
                          <div className="adp-field-value">
                            {vnDetails.diagnoses[0]?.doctor_name || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="adp-modal-footer">
              <button
                type="button"
                className="adp-btn adp-btn-secondary"
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
