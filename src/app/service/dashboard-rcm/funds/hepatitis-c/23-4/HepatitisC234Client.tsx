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
  TestTube2,
  ShieldCheck,
  Clock,
  UserCheck,
  ReceiptText,
  Copy,
  Check,
  Activity,
  FileSpreadsheet,
} from 'lucide-react'
import type {
  HepatitisCItem,
  HepatitisCSummary,
  HepatitisCCardFilter,
  HepatitisCSearchField,
  HepatitisCSortField,
  HepatitisCAdpMappingCheck,
  HepatitisCReportResult,
} from '@/lib/clinical/rcmHepatitisCService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { UC_ECLAIM_CODES } from '@/lib/clinical/pttypeConstants'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'
import { RcmSeamlessSubAmount, RcmSeamlessRepBadges, RcmSeamlessModalSection } from '@/components/rcm/RcmSeamlessRepDisplay'

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

export interface HepatitisC234ClientProps {
  initialData?: HepatitisCReportResult | null
}

export default function HepatitisC234Client({
  initialData = null,
}: HepatitisC234ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<HepatitisCCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(
    initialData?.ucOnly ? [...UC_ECLAIM_CODES] : []
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [withLabOnly, setWithLabOnly] = useState<boolean>(initialData?.withLabOnly ?? false)
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<HepatitisCSortField>(
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
  const [items, setItems] = useState<HepatitisCItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<HepatitisCAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '36333',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<HepatitisCSummary>(
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
      withLabCount: 0,
      withLabRate: 0,
      seamlessCount: 0,
      totalSeamlessCompensated: 0,
      totalIncome: 0,
    }
  )

  // Interactive Record Modal state
  const [selectedItem, setSelectedItem] = useState<HepatitisCItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Abort controller ref to prevent race condition
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

  // Data Fetching Function
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
          withLabOnly: String(withLabOnly),
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (selectedPttypes.length > 0) {
          queryParams.set('pttypes', selectedPttypes.join(','))
        } else if (ucOnly) {
          queryParams.set('ucOnly', 'true')
        }

        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4?${queryParams.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (json.success && json.data) {
          const d: HepatitisCReportResult = json.data
          setItems(d.items)
          setTotalCount(d.totalCount)
          setTotalPages(d.totalPages)
          setSummary(d.summary)
          setAdpMapping(d.adpMapping)
        } else {
          setError(json.error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
      } catch (err: unknown) {
        const errorObj = err as Error
        if (errorObj?.name === 'AbortError') return
        setError(errorObj.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
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
      selectedPttypes,
      ucOnly,
      withLabOnly,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  )

  // First mount: skip if initialData was provided
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
      const res = await fetch(`/api/service/dashboard-rcm/funds/hepatitis-c/vn-details?vn=${vn}`)
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

  const handleRowClick = (item: HepatitisCItem) => {
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
    const ceYear = beYear - 543
    const mm = String(m).padStart(2, '0')
    const lastDay = new Date(ceYear, m, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleFiscalYearChange = (beYear: number) => {
    setSelectedFiscalYear(beYear)
    const ceFiscal = beYear - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
    setCurrentPage(1)
  }

  // Handle Card Filter Selection
  const handleCardFilterSelect = (filter: HepatitisCCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Table Column Sorting
  const handleSort = (field: HepatitisCSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIndicator = (field: HepatitisCSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} className="sort-icon-inactive" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="sort-icon-active" />
    ) : (
      <ArrowDown size={14} className="sort-icon-active" />
    )
  }

  // Export Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        withLabOnly: String(withLabOnly),
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (selectedPttypes.length > 0) {
        queryParams.set('pttypes', selectedPttypes.join(','))
      } else if (ucOnly) {
        queryParams.set('ucOnly', 'true')
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4?${queryParams.toString()}`
      )
      const json = await res.json()

      if (!json.success || !json.data) {
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับส่งออก')
        return
      }

      const exportRows: HepatitisCItem[] = json.data.items

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
        'สิทธิการรักษา',
        'ClaimCode',
        'แผนก',
        'คลินิก',
        'อาการสำคัญ (CC)',
        'PDX',
        'ผลตรวจ Lab HCV RNA',
        'รายการ ADP 36333',
        'สถานะการชดเชย',
        'เลขที่หนังสือ (REP)',
        'ยอดชดเชย (บาท)',
        'หน่วยงาน',
        'กองทุน',
        'สถานะ Seamless',
        'REP Seamless',
        'ชดเชย Seamless (บาท)',
        'ที่อยู่',
        'เบอร์โทรศัพท์',
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
        r.pttypename || '',
        r.authencode || '',
        r.department || '',
        r.clinic || '',
        r.cc || '',
        r.pdx || '',
        r.labresult || '',
        r.listname || '',
        r.status || '',
        r.rep || '',
        r.compensated,
        r.agency || '',
        r.fund || '',
        r.status_sm || '',
        r.rep_sm || '',
        r.compensated_sm,
        r.address || '',
        r.mobile || r.tel || '',
      ])

      await exportRcmExcel({
        filename: `hepatitis-c-hcv-rna-36333-${ds1}-to-${ds2}.xlsx`,
        title: '23.4 ตรวจยืนยันไวรัสตับ C HCV RNA (รหัส ADP 36333)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportRows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch {
      alert('ไม่สามารถส่งออกไฟล์ Excel ได้')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="hs-page-container">
      {/* ── Page Header ────────────────────────────────────────── */}
      <section className="hs-header-section">
        <div className="hs-title-row">
          <div className="hs-title-group">
            <h1 className="hs-page-title">23.4 ตรวจยืนยันไวรัสตับ C HCV RNA</h1>
            <p className="hs-page-subtitle">
              บริการตรวจยืนยันการติดเชื้อไวรัสตับอักเสบซีด้วยวิธี HCV RNA รหัส ADP 36333
            </p>
          </div>

          <div className="hs-header-actions">
            <button
              type="button"
              className="hs-btn-secondary"
              onClick={() => fetchData(true)}
              disabled={loading || isRefreshing}
              title="รีเฟรชและอัปเดตข้อมูลล่าสุดจากฐานข้อมูล"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              className="hs-btn-primary"
              onClick={handleExportExcel}
              disabled={loading || isExporting || items.length === 0}
              title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
            >
              <Download size={16} className={isExporting ? 'animate-spin' : ''} />
              <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
            </button>
          </div>
        </div>

        {/* Warning Banner: ADP 36333 Mapping Check */}
        {!adpMapping.isMapped && (
          <div className="hs-warning-banner" role="alert">
            <AlertTriangle size={20} className="hs-warning-icon" />
            <div className="hs-warning-content">
              <span className="hs-warning-title">ยังไม่ได้ Map รหัส ADP 36333</span>
              <span>
                ไม่พบรายการยาหรือค่าบริการที่ผูกกับรหัส ADP 36333 ในตาราง s_drugitems
                กรุณาตรวจสอบการตั้งค่า Map รหัส ADP ในระบบ HOSxP เพื่อให้ข้อมูลแสดงผลครบถ้วน
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Date Selector (Single Unified Row) ─────────────────── */}
      <section className="hs-date-selector-card">
        <div className="hs-date-selector-row">
          <div className="hs-segmented-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`hs-tab-btn ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`hs-tab-btn ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`hs-tab-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="hs-date-divider" />

          <div className="hs-date-inputs-group">
            {dateMode === 'custom' && (
              <>
                <div className="hs-date-picker-wrap">
                  <span className="hs-date-label">ตั้งแต่วันที่</span>
                  <ThaiDatePicker
                    value={ds1}
                    onChange={(val) => {
                      setDs1(val)
                      setCurrentPage(1)
                    }}
                  />
                </div>
                <div className="hs-date-picker-wrap">
                  <span className="hs-date-label">ถึงวันที่</span>
                  <ThaiDatePicker
                    value={ds2}
                    onChange={(val) => {
                      setDs2(val)
                      setCurrentPage(1)
                    }}
                  />
                </div>
              </>
            )}

            {dateMode === 'monthly' && (
              <>
                <div className="hs-date-picker-wrap">
                  <span className="hs-date-label">เดือน</span>
                  <select
                    className="hs-select-field"
                    value={selectedMonth}
                    onChange={(e) =>
                      handleMonthYearChange(Number(e.target.value), selectedBeYear)
                    }
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hs-date-picker-wrap">
                  <span className="hs-date-label">ปี พ.ศ.</span>
                  <select
                    className="hs-select-field"
                    value={selectedBeYear}
                    onChange={(e) =>
                      handleMonthYearChange(selectedMonth, Number(e.target.value))
                    }
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
              <div className="hs-date-picker-wrap">
                <span className="hs-date-label">รอบปีงบประมาณ</span>
                <select
                  className="hs-select-field"
                  value={selectedFiscalYear}
                  onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
                >
                  {[2569, 2570].map((y) => (
                    <option key={y} value={y}>
                      ปีงบ {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── KPI Summary Cards (Balanced 4x2 Grid) ──────────────── */}
      <section className="hs-kpi-grid">
        {/* Row 1, Col 1: ทั้งหมด */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('ALL')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="hs-kpi-icon-wrap">
              <TestTube2 size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.totalVisits.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>ผู้ป่วย {summary.uniquePatients.toLocaleString()} คน</span>
          </div>
        </button>

        {/* Row 1, Col 2: ชดเชยแล้ว */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('COMPENSATED')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">ชดเชยแล้ว</span>
            <div className="hs-kpi-icon-wrap">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.compensatedVisits.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง ({summary.compensationRate}%)</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>ยอดชดเชย {formatMoney(summary.totalCompensated)} บาท</span>
          </div>
        </button>

        {/* Row 1, Col 3: ยังไม่ชดเชย / รอส่ง */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('UNCOMPENSATED')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">ยังไม่ชดเชย / รอส่ง</span>
            <div className="hs-kpi-icon-wrap">
              <Clock size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.uncompensatedVisits.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>
              {summary.totalVisits > 0
                ? Math.round((summary.uncompensatedVisits / summary.totalVisits) * 1000) / 10
                : 0}
              % ของผู้รับบริการ
            </span>
          </div>
        </button>

        {/* Row 1, Col 4: มี ClaimCode */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('WITH_AUTHEN')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">มี ClaimCode</span>
            <div className="hs-kpi-icon-wrap">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.withAuthenCount.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง ({summary.authenRate}%)</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>พิสูจน์ตัวตนผ่านระบบแล้ว</span>
          </div>
        </button>

        {/* Row 2, Col 1: ไม่มี ClaimCode */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('NO_AUTHEN')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">ไม่มี ClaimCode</span>
            <div className="hs-kpi-icon-wrap">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.withoutAuthenCount.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>ต้องติดตามขอรหัส ClaimCode</span>
          </div>
        </button>

        {/* Row 2, Col 2: สิทธิบัตรทอง */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('UC_ONLY')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">สิทธิบัตรทอง (UC)</span>
            <div className="hs-kpi-icon-wrap">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.ucCount.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง ({summary.ucRate}%)</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>ผู้มีสิทธิหลักประกันสุขภาพถ้วนหน้า</span>
          </div>
        </button>

        {/* Row 2, Col 3: มีผลตรวจ Lab HCV RNA */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'WITH_LAB' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('WITH_LAB')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">มีผลตรวจ Lab (HCV RNA)</span>
            <div className="hs-kpi-icon-wrap">
              <Activity size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.withLabCount.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง ({summary.withLabRate}%)</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>ได้รับผลตรวจไวรัสจากห้องปฏิบัติการ</span>
          </div>
        </button>

        {/* Row 2, Col 4: Seamless ชดเชย */}
        <button
          type="button"
          className={`hs-kpi-card ${cardFilter === 'SEAMLESS' ? 'active' : ''}`}
          onClick={() => handleCardFilterSelect('SEAMLESS')}
        >
          <div className="hs-kpi-card-header">
            <span className="hs-kpi-title">ชดเชย Seamless</span>
            <div className="hs-kpi-icon-wrap">
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div className="hs-kpi-value-row">
            <span className="hs-kpi-value">{summary.seamlessCount.toLocaleString()}</span>
            <span className="hs-kpi-unit">ครั้ง</span>
          </div>
          <div className="hs-kpi-subtext">
            <span>ชดเชย {formatMoney(summary.totalSeamlessCompensated)} บาท</span>
          </div>
        </button>
      </section>

      {/* ── Toolbar: Unified Search & Quick Checkboxes ────────── */}
      <section className="hs-toolbar-card">
        <div className="hs-search-box">
          <Search size={16} className="hs-search-icon" />
          <input
            type="text"
            className="hs-search-input"
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, VN, ผลตรวจ Lab, รหัสโรค, สิทธิการรักษา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="hs-search-clear-btn"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="hs-toolbar-meta">
          <PttypeMultiSelect
            selectedCodes={selectedPttypes}
            onChange={(codes) => {
              setSelectedPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {selectedPttypes.length > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: '0.8rem',
              }}
            >
              <span>
                สิทธิ:{' '}
                {selectedPttypes.length === UC_ECLAIM_CODES.length &&
                UC_ECLAIM_CODES.every((c) => selectedPttypes.includes(c))
                  ? 'เฉพาะ UC (01-09)'
                  : `${selectedPttypes.length} สิทธิ`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPttypes([])
                  setCurrentPage(1)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0369a1',
                  padding: 0,
                  display: 'flex',
                }}
                title="ล้างตัวกรองสิทธิ"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <label className="hs-checkbox-label">
            <input
              type="checkbox"
              className="hs-checkbox-input"
              checked={withLabOnly}
              onChange={(e) => {
                setWithLabOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะที่มีผล Lab</span>
          </label>

          <span className="hs-meta-text">
            พบทั้งหมด <span className="hs-meta-count">{totalCount.toLocaleString()}</span> รายการ
          </span>
        </div>
      </section>

      {/* ── Data Table (Click record to view details) ─────────── */}
      <section className="hs-table-card">
        {error && (
          <div className="hs-warning-banner" style={{ margin: '16px' }}>
            <AlertTriangle size={18} className="hs-warning-icon" />
            <div className="hs-warning-content">
              <span className="hs-warning-title">เกิดข้อผิดพลาด</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="hs-table-responsive">
          <table className="hs-table">
            <thead>
              <tr>
                <th className="text-center" style={{ width: '60px' }}>
                  ลำดับ
                </th>
                <th
                  className="sortable text-center"
                  style={{ width: '130px' }}
                  onClick={() => handleSort('vstdate')}
                >
                  <span className="hs-th-sort">
                    <span>วันที่รับบริการ</span>
                    {renderSortIndicator('vstdate')}
                  </span>
                </th>
                <th className="text-center" style={{ width: '80px' }}>
                  เวลา
                </th>
                <th
                  className="sortable text-center"
                  style={{ width: '100px' }}
                  onClick={() => handleSort('hn')}
                >
                  <span className="hs-th-sort">
                    <span>HN</span>
                    {renderSortIndicator('hn')}
                  </span>
                </th>
                <th
                  className="sortable text-center"
                  style={{ width: '150px' }}
                  onClick={() => handleSort('cid')}
                >
                  <span className="hs-th-sort">
                    <span>เลขบัตรประชาชน</span>
                    {renderSortIndicator('cid')}
                  </span>
                </th>
                <th
                  className="sortable"
                  style={{ minWidth: '180px' }}
                  onClick={() => handleSort('ptname')}
                >
                  <span className="hs-th-sort">
                    <span>ชื่อ-สกุล</span>
                    {renderSortIndicator('ptname')}
                  </span>
                </th>
                <th
                  className="sortable text-center"
                  style={{ width: '80px' }}
                  onClick={() => handleSort('age')}
                >
                  <span className="hs-th-sort">
                    <span>อายุ</span>
                    {renderSortIndicator('age')}
                  </span>
                </th>
                <th style={{ minWidth: '160px' }}>สิทธิการรักษา</th>
                <th
                  className="sortable text-center"
                  style={{ width: '130px' }}
                  onClick={() => handleSort('authencode')}
                >
                  <span className="hs-th-sort">
                    <span>ClaimCode</span>
                    {renderSortIndicator('authencode')}
                  </span>
                </th>
                <th
                  className="sortable text-center"
                  style={{ width: '90px' }}
                  onClick={() => handleSort('pdx')}
                >
                  <span className="hs-th-sort">
                    <span>PDX</span>
                    {renderSortIndicator('pdx')}
                  </span>
                </th>
                <th
                  className="sortable text-center"
                  style={{ minWidth: '170px' }}
                  onClick={() => handleSort('labresult')}
                >
                  <span className="hs-th-sort">
                    <span>ผลตรวจ Lab HCV RNA</span>
                    {renderSortIndicator('labresult')}
                  </span>
                </th>
                <th className="text-center" style={{ minWidth: '140px' }}>
                  สถานะการชดเชย
                </th>
                <th className="text-center" style={{ width: '120px' }}>
                  เลขที่หนังสือ (REP)
                </th>
                <th
                  className="sortable text-center"
                  style={{ width: '130px' }}
                  onClick={() => handleSort('compensated')}
                >
                  <span className="hs-th-sort">
                    <span>ชดเชย (บาท)</span>
                    {renderSortIndicator('compensated')}
                  </span>
                </th>
                <th className="text-center" style={{ minWidth: '120px' }}>
                  Seamless
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, rowIdx) => (
                  <tr key={`skeleton-${rowIdx}`} className="rcm-skeleton-row">
                    {Array.from({ length: 15 }).map((__, colIdx) => (
                      <td key={colIdx} className="text-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '48px 0', textAlign: 'center' }}>
                    <div className="hs-empty-state">
                      <TestTube2 size={32} className="hs-empty-icon" />
                      <span className="hs-empty-title">ไม่พบข้อมูลการตรวจยืนยันไวรัสตับ C</span>
                      <span className="hs-empty-desc">
                        ไม่มีรายการผู้รับบริการที่ตรงกับเงื่อนไขช่วงเวลาหรือตัวกรองที่เลือก
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.vn}
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อดูรายละเอียดเวชระเบียนและการชดเชย"
                  >
                    <td className="text-center">{item.no}</td>
                    <td className="text-center">{formatThaiDate(item.vstdate)}</td>
                    <td className="text-center">{item.vsttime.slice(0, 5)}</td>
                    <td className="text-center font-medium">{item.hn}</td>
                    <td className="text-center">{item.cid || '—'}</td>
                    <td>{item.ptname}</td>
                    <td className="text-center">{item.age} ปี</td>
                    <td>{item.pttypename || '—'}</td>
                    <td className="text-center">
                      {item.authencode ? (
                        <span className="hs-badge hs-badge-success">{item.authencode}</span>
                      ) : (
                        <span className="hs-badge hs-badge-warning">ไม่มี</span>
                      )}
                    </td>
                    <td className="text-center font-medium">{item.pdx || '—'}</td>
                    <td className="text-center">
                      {item.labresult ? (
                        <span
                          className={`hs-badge ${
                            item.labresult.toLowerCase().includes('not')
                              ? 'hs-badge-neutral'
                              : 'hs-badge-primary'
                          }`}
                        >
                          {item.labresult}
                        </span>
                      ) : (
                        <span className="hs-badge hs-badge-neutral">รอผล Lab</span>
                      )}
                    </td>
                    <td className="text-center">
                      {item.status ? (
                        <span
                          className={`hs-badge ${
                            item.isCompensated
                              ? 'hs-badge-success'
                              : item.status.includes('Invoice')
                              ? 'hs-badge-primary'
                              : 'hs-badge-neutral'
                          }`}
                        >
                          {item.status.replace(/^[A-Z]+ :: /, '')}
                        </span>
                      ) : (
                        <span className="hs-badge hs-badge-neutral">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div>{item.rep || '—'}</div>
                      <RcmSeamlessRepBadges row={item} />
                    </td>
                    <td className="text-center font-medium">
                      {item.compensated > 0 ? formatMoney(item.compensated) : '—'}
                      <RcmSeamlessSubAmount row={item} />
                    </td>
                    <td className="text-center">
                      {item.isSeamlessCompensated ? (
                        <span className="hs-badge hs-badge-success">
                          ชดเชย {formatMoney(item.compensated_sm)}
                        </span>
                      ) : item.status_sm ? (
                        <span className="hs-badge hs-badge-neutral">{item.status_sm}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Bar ──────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="hs-pagination-bar">
            <div className="hs-pagination-info">
              แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า (ทั้งหมด{' '}
              {totalCount.toLocaleString()} รายการ)
            </div>

            <div className="hs-pagination-controls">
              <button
                type="button"
                className="hs-page-btn"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '0.875rem', padding: '0 8px' }}>
                หน้า {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="hs-page-btn"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>

              <select
                className="hs-select-field"
                style={{ height: '34px', marginLeft: '12px' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={20}>20 แถว / หน้า</option>
                <option value={50}>50 แถว / หน้า</option>
                <option value={100}>100 แถว / หน้า</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* ── Interactive Detail Modal (Click Record to View) ─────── */}
      {selectedItem && (
        <div
          className="hs-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="hs-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="hs-modal-header">
              <div className="hs-modal-title-group">
                <h3 className="hs-modal-title">
                  รายละเอียดการตรวจยืนยันไวรัสตับ C HCV RNA (VN: {selectedItem.vn})
                </h3>
                <p className="hs-modal-subtitle">
                  {selectedItem.ptname} • HN: {selectedItem.hn} • เลขบัตรประชาชน: {selectedItem.cid}
                </p>
              </div>
              <button
                type="button"
                className="hs-modal-close-btn"
                onClick={() => setSelectedItem(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="hs-modal-tabs">
              <button
                type="button"
                className={`hs-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลสรุปและการชดเชย
              </button>
              <button
                type="button"
                className={`hs-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ประวัติเวชระเบียนคลินิก (Clinical Details)
              </button>
            </div>

            {/* Modal Body */}
            <div className="hs-modal-body">
              {modalTab === 'summary' && (
                <>
                  {/* Lab Result Highlight Box */}
                  <div className="hs-lab-highlight-box">
                    <span className="hs-lab-highlight-title">ผลการตรวจทางห้องปฏิบัติการ (HCV RNA)</span>
                    <span className="hs-lab-highlight-result">
                      {selectedItem.labresult || 'ยังไม่มีการบันทึกผลการตรวจ Lab ในระบบ'}
                    </span>
                  </div>

                  {/* General Patient Details */}
                  <div className="hs-detail-section">
                    <span className="hs-section-title">ข้อมูลทั่วไปและวันเวลาที่รับบริการ</span>
                    <div className="hs-detail-grid">
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">ชื่อ-สกุล</span>
                        <span className="hs-detail-value">{selectedItem.ptname}</span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">HN / VN</span>
                        <span className="hs-detail-value">
                          {selectedItem.hn} / {selectedItem.vn}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">เลขบัตรประชาชน (13 หลัก)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="hs-detail-value">{selectedItem.cid || '—'}</span>
                          {selectedItem.cid && (
                            <button
                              type="button"
                              className="hs-modal-close-btn"
                              style={{ padding: '2px' }}
                              onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                              title="คัดลอกเลขบัตรประชาชน"
                            >
                              {copiedField === 'cid' ? (
                                <Check size={14} color="#0d7446" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">เพศ / อายุ</span>
                        <span className="hs-detail-value">
                          {selectedItem.sex} • {selectedItem.age} ปี
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">วันที่รับบริการ</span>
                        <span className="hs-detail-value">
                          {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime} น.
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">สิทธิการรักษา</span>
                        <span className="hs-detail-value">
                          {selectedItem.pttypename || '—'}{' '}
                          {selectedItem.isUc && (
                            <span className="hs-badge hs-badge-success" style={{ marginLeft: '4px' }}>
                              บัตรทอง
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">แผนก / คลินิก</span>
                        <span className="hs-detail-value">
                          {selectedItem.department || '—'} • {selectedItem.clinic || '—'}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">อาการสำคัญ (CC)</span>
                        <span className="hs-detail-value">{selectedItem.cc || '—'}</span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">ที่อยู่ผู้ป่วย</span>
                        <span className="hs-detail-value">{selectedItem.address || '—'}</span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">เบอร์โทรศัพท์</span>
                        <span className="hs-detail-value">
                          {selectedItem.mobile || selectedItem.tel || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ADP and Service Items */}
                  <div className="hs-detail-section">
                    <span className="hs-section-title">รายการตรวจและรหัส ADP กองทุน</span>
                    <div className="hs-detail-grid">
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">รหัส ADP สปสช.</span>
                        <span className="hs-detail-value font-medium">36333</span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">รายการบริการที่ Map</span>
                        <span className="hs-detail-value">{selectedItem.listname || '—'}</span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">ClaimCode:</span>
                        <span className="hs-detail-value">
                          {selectedItem.authencode ? (
                            <span className="hs-badge hs-badge-success">{selectedItem.authencode}</span>
                          ) : (
                            <span className="hs-badge hs-badge-warning">ไม่มีรหัส ClaimCode</span>
                          )}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">ค่าบริการรวมในใบเสร็จ</span>
                        <span className="hs-detail-value">
                          {formatMoney(selectedItem.income)} บาท
                        </span>
                      </div>
                      {selectedItem.listname1 && (
                        <div className="hs-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="hs-detail-label">รายการประกอบอื่นๆ (Non-drug)</span>
                          <span className="hs-detail-value">{selectedItem.listname1}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Compensation and Claim Status */}
                  <div className="hs-detail-section">
                    <span className="hs-section-title">สถานะการชดเชยค่าบริการทางการแพทย์</span>
                    <div className="hs-detail-grid">
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">สถานะการตอบรับ</span>
                        <span className="hs-detail-value font-medium">
                          {selectedItem.status || '—'}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">เลขที่หนังสือ (REP)</span>
                        <span className="hs-detail-value font-medium">
                          {selectedItem.rep || '—'}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">ประมาณการชดเชย</span>
                        <span className="hs-detail-value font-medium" style={{ color: '#0d7446' }}>
                          {formatMoney(selectedItem.compensated)} บาท
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">กองทุน / กองทุนย่อย</span>
                        <span className="hs-detail-value">
                          {selectedItem.fund || '—'} • {selectedItem.subfund || '—'}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">สถานะ Seamless</span>
                        <span className="hs-detail-value">
                          {selectedItem.status_sm || '—'}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">ยอดชดเชย Seamless</span>
                        <span className="hs-detail-value">
                          {formatMoney(selectedItem.compensated_sm)} บาท
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis & Operations */}
                  <div className="hs-detail-section">
                    <span className="hs-section-title">การวินิจฉัยโรคและหัตถการ</span>
                    <div className="hs-detail-grid">
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">โรคหลัก (PDX)</span>
                        <span className="hs-detail-value font-medium">
                          {selectedItem.pdx || '—'}
                        </span>
                      </div>
                      <div className="hs-detail-item">
                        <span className="hs-detail-label">โรครอง (SDX: DX0-DX5)</span>
                        <span className="hs-detail-value">{selectedItem.sdx || '—'}</span>
                      </div>
                      <div className="hs-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="hs-detail-label">หัตถการ (OP0-OP5)</span>
                        <span className="hs-detail-value">{selectedItem.ops || '—'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'clinical' && (
                <div className="hs-detail-section">
                  {loadingVnDetails ? (
                    <div className="hs-empty-state">
                      <RefreshCw size={24} className="animate-spin hs-empty-icon" />
                      <span className="hs-empty-title">กำลังดึงข้อมูลเวชระเบียน...</span>
                    </div>
                  ) : !vnDetails ? (
                    <div className="hs-empty-state">
                      <AlertTriangle size={28} className="hs-empty-icon" />
                      <span className="hs-empty-title">ไม่พบรายละเอียดเวชระเบียน</span>
                      <span className="hs-empty-desc">
                        ไม่มีข้อมูลการซักประวัติหรือรายการสั่งการแพทย์สำหรับ VN นี้
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Vital Signs */}
                      <span className="hs-section-title">สัญญาณชีพและการคัดกรอง (OPD Screen)</span>
                      <div className="hs-detail-grid">
                        <div className="hs-detail-item">
                          <span className="hs-detail-label">ความดันโลหิต (BP)</span>
                          <span className="hs-detail-value">
                            {vnDetails.screen?.bps && vnDetails.screen?.bpd
                              ? `${vnDetails.screen.bps}/${vnDetails.screen.bpd} mmHg`
                              : '—'}
                          </span>
                        </div>
                        <div className="hs-detail-item">
                          <span className="hs-detail-label">ชีพจร / อุณหภูมิ</span>
                          <span className="hs-detail-value">
                            {vnDetails.screen?.pulse ? `${vnDetails.screen.pulse} bpm` : '—'} •{' '}
                            {vnDetails.screen?.temperature
                              ? `${vnDetails.screen.temperature} °C`
                              : '—'}
                          </span>
                        </div>
                        <div className="hs-detail-item">
                          <span className="hs-detail-label">น้ำหนัก / ส่วนสูง / BMI</span>
                          <span className="hs-detail-value">
                            {vnDetails.screen?.bw ? `${vnDetails.screen.bw} กก.` : '—'} •{' '}
                            {vnDetails.screen?.height ? `${vnDetails.screen.height} ซม.` : '—'} •{' '}
                            {vnDetails.screen?.bmi ? `BMI ${vnDetails.screen.bmi}` : '—'}
                          </span>
                        </div>
                        <div className="hs-detail-item">
                          <span className="hs-detail-label">อาการสำคัญ (CC)</span>
                          <span className="hs-detail-value">
                            {vnDetails.screen?.cc || selectedItem.cc || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Doctor Diagnoses */}
                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <>
                          <span className="hs-section-title" style={{ marginTop: '12px' }}>
                            การวินิจฉัยของแพทย์
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {vnDetails.diagnoses.map((diag, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '0.875rem',
                                }}
                              >
                                <span className="hs-badge hs-badge-primary">{diag.icd10}</span>
                                <span>{diag.diagtype_name || diag.diagtype}</span>
                                <span style={{ color: 'var(--gray-500, #6b7280)' }}>
                                  ({diag.doctor_name || 'ไม่ระบุแพทย์'})
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Orders Summary */}
                      {vnDetails.orders && vnDetails.orders.items.length > 0 && (
                        <>
                          <span className="hs-section-title" style={{ marginTop: '12px' }}>
                            รายการสั่งยาและเวชภัณฑ์ ({vnDetails.orders.items.length} รายการ)
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {vnDetails.orders.items.slice(0, 15).map((order, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.875rem',
                                  padding: '4px 0',
                                  borderBottom: '1px solid var(--gray-100, #f3f4f6)',
                                }}
                              >
                                <span>{order.item_name}</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {order.qty} {order.units || ''} • {formatMoney(order.sum_price)} บาท
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>

            {/* Modal Footer */}
            <div className="hs-modal-footer">
              <button
                type="button"
                className="hs-btn-secondary"
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
