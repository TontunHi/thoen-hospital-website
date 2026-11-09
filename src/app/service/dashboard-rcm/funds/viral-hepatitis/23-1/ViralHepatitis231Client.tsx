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
  TestTube2,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  Check,
  Activity,
  FileSpreadsheet,
} from 'lucide-react'
import type {
  ViralHepatitisItem,
  ViralHepatitisSummary,
  ViralHepatitisCardFilter,
  ViralHepatitisSortField,
  ViralHepatitisAdpMappingCheck,
  ViralHepatitisReportResult,
} from '@/lib/clinical/rcmViralHepatitisService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { UC_ECLAIM_CODES } from '@/lib/clinical/pttypeConstants'
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

export interface ViralHepatitis231ClientProps {
  initialData?: ViralHepatitisReportResult | null
}

export default function ViralHepatitis231Client({
  initialData = null,
}: ViralHepatitis231ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<ViralHepatitisCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(
    initialData?.ucOnly ? [...UC_ECLAIM_CODES] : []
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<ViralHepatitisSortField>(
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
  const [items, setItems] = useState<ViralHepatitisItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<ViralHepatitisAdpMappingCheck>(
    initialData?.adpMapping ?? {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<ViralHepatitisSummary>(
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
      withLabCount: 0,
      withoutLabCount: 0,
      labRate: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<ViralHepatitisItem | null>(null)
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
          searchField: 'ALL',
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
          `/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: ViralHepatitisReportResult = json.data
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
      selectedPttypes,
      ucOnly,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
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
      const res = await fetch(`/api/service/dashboard-rcm/funds/viral-hepatitis/vn-details?vn=${vn}`)
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

  const handleRowClick = (item: ViralHepatitisItem) => {
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
  const handleCardFilter = (filter: ViralHepatitisCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Handle Table Sorting
  const handleSort = (field: ViralHepatitisSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Handle Excel (.xlsx) Export
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        searchField: 'ALL',
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
        `/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: ViralHepatitisItem[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ (ปี)',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'ClaimCode',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'อาการสำคัญ (CC)',
        'PDX',
        'SDX',
        'รายการตรวจ (ADP 36318, 36319)',
        'ผลตรวจ Lab',
        'สถานะชดเชย',
        'เลขที่ REP',
        'ยอดชดเชย (บาท)',
        'สถานะ Seamless',
        'REP Seamless',
        'ยอด Seamless (บาท)',
        'ที่อยู่',
        'เบอร์โทรศัพท์',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const rows = exportRows.map((r, i) => [
        i + 1,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.age,
        r.nation || '',
        r.vstdate,
        r.vsttime,
        r.authencode || '',
        r.pttypename || '',
        r.department || '',
        r.clinic || '',
        r.cc || '',
        r.pdx || '',
        r.sdx || '',
        r.listname || '',
        r.labresult || '',
        r.status || '',
        r.rep || '',
        r.compensated,
        r.status_sm || '',
        r.rep_sm || '',
        r.compensated_sm,
        r.address || '',
        r.tel || r.mobile || '',
        r.fund || '',
        r.subfund || '',
      ])

      await exportRcmExcel({
        filename: `viral-hepatitis-b-36318-36319-${ds1}-to-${ds2}.xlsx`,
        title: '23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B (Hepatitis B Screening)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportRows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(`การส่งออกล้มเหลว: ${err.message || 'เกิดข้อผิดพลาด'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="vh-container">
      {/* ── 1. Page Header (Modern, No Eyebrow Badge) ── */}
      <div className="vh-header">
        <div className="vh-header-left">
          <nav className="vh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/service/dashboard-rcm" className="vh-breadcrumb-link">
              RCM Dashboard
            </Link>
            <span className="vh-breadcrumb-sep">/</span>
            <span className="vh-breadcrumb-link">กองทุน</span>
            <span className="vh-breadcrumb-sep">/</span>
            <span className="vh-breadcrumb-current">
              23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B
            </span>
          </nav>

          <h1 className="vh-title">23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B</h1>
          <p className="vh-subtitle">
            บริการตรวจคัดกรองไวรัสตับอักเสบ B (Hepatitis B Screening) รหัส ADP สปสช.{' '}
            <span className="font-mono font-semibold">36318, 36319</span> ข้อมูลผู้รับบริการ การส่งตรวจห้องปฏิบัติการ และสถานะการชดเชยค่าบริการ
          </p>
        </div>

        <div className="vh-header-actions">
          <button
            type="button"
            className="vh-btn vh-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            title="รีเฟรชข้อมูลล่าสุดจากระบบ"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="vh-btn vh-btn-primary"
            onClick={handleExportExcel}
            disabled={isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={15} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. ADP Mapping Warning Banner ── */}
      {!adpMapping.isMapped && (
        <div className="vh-warning-banner" role="alert">
          <AlertTriangle size={20} className="vh-warning-icon" />
          <div className="vh-warning-content">
            <strong>แจ้งเตือนการกำหนดรหัสส่งตรวจ (ADP Mapping):</strong>
            <span>
              ไม่พบรายการตรวจหรือยาที่ผูกรหัส สปสช. ADP <strong>36318, 36319</strong> ในตาราง{' '}
              <code>s_drugitems</code> หรือ <code>nondrugitems</code> ของระบบ กรุณาประสานงานเจ้าหน้าที่เวชระเบียนหรือห้องปฏิบัติการเพื่อตรวจสอบการตั้งค่ารหัส
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Unified Single-Row Date Selector ── */}
      <div className="vh-date-toolbar">
        <div className="vh-mode-tabs" role="tablist" aria-label="ช่วงเวลาการรายงาน">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`vh-mode-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`vh-mode-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`vh-mode-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="vh-date-divider" />

        <div className="vh-date-controls">
          {dateMode === 'custom' && (
            <div className="vh-custom-range">
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
                placeholder="ตั้งแต่วันที่"
                aria-label="ตั้งแต่วันที่"
              />
              <span className="vh-custom-sep">ถึง</span>
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
            <div className="vh-custom-range">
              <select
                className="vh-select"
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
                className="vh-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
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
            <div className="vh-custom-range">
              <select
                className="vh-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {yearOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    ปีงบประมาณ {fy}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Balanced Symmetrical 4x2 KPI Summary Grid (8 Cards) ── */}
      <div className="vh-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`vh-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="vh-kpi-icon">
              <TestTube2 size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="vh-kpi-sub">
              {summary.uniquePatients.toLocaleString('th-TH')} คน · รายได้ ฿{formatMoney(summary.totalIncome)}
            </span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`vh-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">ชดเชยแล้ว</span>
            <div className="vh-kpi-icon icon-success">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val text-success">
              {summary.compensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="vh-kpi-sub">
              {summary.compensationRate.toFixed(1)}% · รวม ฿{formatMoney(summary.totalCompensated)}
            </span>
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย / รอชดเชย */}
        <div
          className={`vh-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ชดเชยหรือรอผล"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">ยังไม่ชดเชย / รอผล</span>
            <div className="vh-kpi-icon icon-warn">
              <Clock size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val text-warn">
              {summary.uncompensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="vh-kpi-sub">
              {(100 - summary.compensationRate).toFixed(1)}% รอการกระทบยอด
            </span>
          </div>
        </div>

        {/* Card 4: มี ClaimCode */}
        <div
          className={`vh-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">มี ClaimCode</span>
            <div className="vh-kpi-icon icon-success">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
            <span className="vh-kpi-sub">{summary.authenRate.toFixed(1)}% ยืนยันตัวตนแล้ว</span>
          </div>
        </div>

        {/* Card 5: ไม่มี ClaimCode */}
        <div
          className={`vh-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('NO_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ไม่มี ClaimCode"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">ไม่มี ClaimCode</span>
            <div className="vh-kpi-icon icon-danger">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val text-danger">
              {summary.withoutAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="vh-kpi-sub">
              {(100 - summary.authenRate).toFixed(1)}% ต้องขอ ClaimCode ย้อนหลัง
            </span>
          </div>
        </div>

        {/* Card 6: มีผลตรวจ Lab */}
        <div
          className={`vh-kpi-card ${cardFilter === 'WITH_LAB' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_LAB')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มีผลตรวจทางห้องปฏิบัติการ"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">มีผลตรวจ Lab</span>
            <div className="vh-kpi-icon icon-info">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val">{summary.withLabCount.toLocaleString('th-TH')}</span>
            <span className="vh-kpi-sub">{summary.labRate.toFixed(1)}% รายงานผลเรียบร้อย</span>
          </div>
        </div>

        {/* Card 7: รอผล / ไม่มีผล Lab */}
        <div
          className={`vh-kpi-card ${cardFilter === 'NO_LAB' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('NO_LAB')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่มีผล Lab"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">รอผล / ไม่มีผล Lab</span>
            <div className="vh-kpi-icon icon-neutral">
              <Activity size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val">{summary.withoutLabCount.toLocaleString('th-TH')}</span>
            <span className="vh-kpi-sub">{(100 - summary.labRate).toFixed(1)}% ยังไม่ออกผล</span>
          </div>
        </div>

        {/* Card 8: สิทธิบัตรทอง (UC) */}
        <div
          className={`vh-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UC_ONLY')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UC/WEL/UCS)"
        >
          <div className="vh-kpi-header">
            <span className="vh-kpi-title">สิทธิบัตรทอง (UC)</span>
            <div className="vh-kpi-icon icon-accent">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="vh-kpi-body">
            <span className="vh-kpi-val">{summary.ucCount.toLocaleString('th-TH')}</span>
            <span className="vh-kpi-sub">{summary.ucRate.toFixed(1)}% กลุ่มสิทธิหลัก</span>
          </div>
        </div>
      </div>

      {/* ── 5. Search & Filters Toolbar ── */}
      <div className="vh-filter-bar">
        <div className="vh-search-box">
          <Search size={16} className="vh-search-icon" />
          <input
            type="text"
            className="vh-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ผล Lab, ClaimCode, Rep..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="vh-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="vh-secondary-filters">
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

          {cardFilter !== 'ALL' && (
            <div className="vh-active-filter-badge">
              <span>
                ฟิลเตอร์: <strong>{cardFilter}</strong>
              </span>
              <button
                type="button"
                className="vh-active-filter-clear"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกฟิลเตอร์การ์ด"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 6. Data Table Section ── */}
      <div className="vh-table-card">
        <div className="vh-table-meta">
          <div>
            พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
            {loading && <span className="vh-loading-indicator">กำลังโหลดข้อมูล...</span>}
          </div>
          <div className="vh-row-hint">
            * คลิกที่แถวเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย
          </div>
        </div>

        {error && (
          <div className="vh-empty-state is-error">
            <AlertTriangle size={32} className="vh-empty-icon text-danger" />
            <div className="vh-empty-title">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
            <div className="vh-empty-desc">{error}</div>
            <button
              type="button"
              className="vh-btn vh-btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => fetchData()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="vh-loading-card">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span>กำลังประมวลผลข้อมูลบริการตรวจคัดกรองไวรัสตับอักเสบ B...</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="vh-empty-state">
            <TestTube2 size={36} className="vh-empty-icon" />
            <div className="vh-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
            <div className="vh-empty-desc">
              ไม่พบรายการผู้รับบริการตรวจคัดกรองไวรัสตับอักเสบ B ในช่วงเวลาหรือฟิลเตอร์ที่กำหนด กรุณาลองปรับช่วงวันที่หรือคำค้นหา
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="vh-table-scroll">
            <table className="vh-table">
              <thead>
                <tr>
                  <th className="col-center">ลำดับ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('vstdate')}
                    >
                      วันที่รับบริการ{' '}
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">เวลา</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('hn')}
                    >
                      HN{' '}
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">เลขบัตรประชาชน</th>
                  <th className="col-left">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('ptname')}
                    >
                      ชื่อ-สกุล{' '}
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('age')}
                    >
                      อายุ{' '}
                      {sortBy === 'age' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">สิทธิการรักษา</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('authencode')}
                    >
                      ClaimCode{' '}
                      {sortBy === 'authencode' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('pdx')}
                    >
                      PDX{' '}
                      {sortBy === 'pdx' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-left">รายการตรวจ (ADP 36318, 36319)</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('labresult')}
                    >
                      ผลตรวจ Lab{' '}
                      {sortBy === 'labresult' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">สถานะชดเชย</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="vh-sort-btn"
                      onClick={() => handleSort('compensated')}
                    >
                      ยอดชดเชย (บาท){' '}
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
                    className="vh-row-clickable"
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย"
                  >
                    <td className="col-center vh-num">{item.no}</td>
                    <td className="col-center vh-num">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center vh-num">{item.vsttime || '—'}</td>
                    <td className="col-center vh-num font-mono">{item.hn}</td>
                    <td className="col-center vh-num font-mono">{item.cid}</td>
                    <td className="col-left">{item.ptname}</td>
                    <td className="col-center vh-num">{item.age} ปี</td>
                    <td className="col-center">
                      <span className={`vh-badge ${item.isUc ? 'vh-badge-ok' : 'vh-badge-neutral'}`}>
                        {item.pttypename || item.maininscl || '—'}
                      </span>
                    </td>
                    <td className="col-center font-mono">
                      {item.authencode ? (
                        <span className="vh-badge vh-badge-ok">{item.authencode}</span>
                      ) : (
                        <span className="vh-badge vh-badge-warn">ไม่มี</span>
                      )}
                    </td>
                    <td className="col-center font-mono font-bold">{item.pdx || '—'}</td>
                    <td className="col-left" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={item.listname || ''}>{item.listname || '—'}</span>
                    </td>
                    <td className="col-center">
                      {item.labresult ? (
                        <span
                          className={`vh-badge ${
                            item.labresult.toLowerCase().includes('pos') ||
                            item.labresult.toLowerCase().includes('reactive')
                              ? 'vh-badge-danger'
                              : item.labresult.toLowerCase().includes('neg') ||
                                item.labresult.toLowerCase().includes('non')
                              ? 'vh-badge-ok'
                              : 'vh-badge-info'
                          }`}
                          title={item.labresult}
                        >
                          {item.labresult}
                        </span>
                      ) : (
                        <span className="vh-badge vh-badge-neutral">รอผล</span>
                      )}
                    </td>
                    <td className="col-center">
                      <span
                        className={`vh-badge ${
                          item.isCompensated
                            ? 'vh-badge-ok'
                            : item.status && !item.status.includes('ยังไม่ได้ส่ง')
                            ? 'vh-badge-info'
                            : 'vh-badge-warn'
                        }`}
                      >
                        {item.status || 'ยังไม่ได้ส่ง'}
                      </span>
                    </td>
                    <td className="col-center vh-num font-semibold">
                      {item.isCompensated ? (
                        <span className="text-success">{formatMoney(item.compensated)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 7. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="vh-pagination">
            <div className="vh-pagination-info">
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ)
            </div>

            <div className="vh-pagination-controls">
              <button
                type="button"
                className="vh-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                หน้าแรก
              </button>
              <button
                type="button"
                className="vh-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="vh-page-status">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="vh-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="vh-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="หน้าสุดท้าย"
              >
                หน้าสุดท้าย
              </button>

              <select
                className="vh-page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                aria-label="จำนวนรายการต่อหน้า"
              >
                <option value={25}>25 รายการ/หน้า</option>
                <option value={50}>50 รายการ/หน้า</option>
                <option value={100}>100 รายการ/หน้า</option>
                <option value={200}>200 รายการ/หน้า</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── 8. Patient Detail Modal (Triggered by Clicking Row) ── */}
      {selectedItem && (
        <div className="vh-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="vh-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vh-modal-title"
          >
            {/* Modal Header */}
            <div className="vh-modal-header">
              <div className="vh-modal-header-info">
                <div className="vh-modal-title-row">
                  <TestTube2 size={22} className="text-primary" />
                  <h2 id="vh-modal-title" className="vh-modal-title">
                    {selectedItem.ptname}
                  </h2>
                  <span className="vh-modal-age">{selectedItem.age} ปี</span>
                </div>
                <div className="vh-modal-meta">
                  <span>HN: <strong className="font-mono">{selectedItem.hn}</strong></span>
                  <span>•</span>
                  <span>CID: <strong className="font-mono">{selectedItem.cid}</strong></span>
                  <span>•</span>
                  <span>VN: <strong className="font-mono">{selectedItem.vn}</strong></span>
                  <span>•</span>
                  <span>วันที่รับบริการ: <strong>{formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}</strong></span>
                </div>
              </div>

              <button
                type="button"
                className="vh-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="vh-modal-tabs">
              <button
                type="button"
                className={`vh-modal-tab ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลบริการ & การชดเชย
              </button>
              <button
                type="button"
                className={`vh-modal-tab ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ประวัติเวชระเบียนคลินิก
              </button>
            </div>

            {/* Modal Content */}
            <div className="vh-modal-body">
              {modalTab === 'summary' && (
                <div className="vh-modal-grid">
                  {/* Section 1: ข้อมูลผู้ป่วยและการติดต่อ */}
                  <div className="vh-modal-section">
                    <h3 className="vh-section-title">ข้อมูลผู้รับบริการ & การติดต่อ</h3>
                    <div className="vh-info-list">
                      <div className="vh-info-item">
                        <span className="vh-info-label">ชื่อ-สกุล</span>
                        <span className="vh-info-val font-semibold">{selectedItem.ptname}</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">เลขบัตรประชาชน</span>
                        <span className="vh-info-val font-mono">
                          {selectedItem.cid}{' '}
                          <button
                            type="button"
                            className="vh-copy-mini"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คัดลอกเลขบัตรประชาชน"
                          >
                            {copiedField === 'cid' ? <Check size={12} /> : 'คัดลอก'}
                          </button>
                        </span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">HN</span>
                        <span className="vh-info-val font-mono">{selectedItem.hn}</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">อายุ</span>
                        <span className="vh-info-val">{selectedItem.age} ปี</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">สัญชาติ</span>
                        <span className="vh-info-val">{selectedItem.nation || '—'}</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">ที่อยู่</span>
                        <span className="vh-info-val">{selectedItem.address || '—'}</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">เบอร์โทรศัพท์</span>
                        <span className="vh-info-val font-mono">{selectedItem.tel || selectedItem.mobile || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: ข้อมูลการตรวจคัดกรองและสิทธิ */}
                  <div className="vh-modal-section">
                    <h3 className="vh-section-title">ข้อมูลการตรวจ & สิทธิการรักษา</h3>
                    <div className="vh-info-list">
                      <div className="vh-info-item">
                        <span className="vh-info-label">สิทธิการรักษา</span>
                        <span className="vh-info-val">
                          <span className={`vh-badge ${selectedItem.isUc ? 'vh-badge-ok' : 'vh-badge-neutral'}`}>
                            {selectedItem.pttypename || selectedItem.maininscl}
                          </span>
                        </span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">ClaimCode:</span>
                        <span className="vh-info-val font-mono">
                          {selectedItem.authencode ? (
                            <span className="vh-badge vh-badge-ok">{selectedItem.authencode}</span>
                          ) : (
                            <span className="vh-badge vh-badge-warn">ไม่มี</span>
                          )}
                        </span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">แผนก / คลินิก</span>
                        <span className="vh-info-val">
                          {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                        </span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">รายการตรวจคัดกรอง</span>
                        <span className="vh-info-val font-semibold">{selectedItem.listname || '—'}</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">ผลตรวจ Lab</span>
                        <span className="vh-info-val">
                          {selectedItem.labresult ? (
                            <span className="vh-badge vh-badge-info font-semibold">
                              {selectedItem.labresult}
                            </span>
                          ) : (
                            <span className="vh-badge vh-badge-neutral">ยังไม่มีผล Lab</span>
                          )}
                        </span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">อาการสำคัญ (CC)</span>
                        <span className="vh-info-val">{selectedItem.cc || '—'}</span>
                      </div>
                      <div className="vh-info-item">
                        <span className="vh-info-label">การวินิจฉัยหลัก (PDX)</span>
                        <span className="vh-info-val font-mono font-bold">{selectedItem.pdx || '—'}</span>
                      </div>
                      {selectedItem.sdx && (
                        <div className="vh-info-item">
                          <span className="vh-info-label">การวินิจฉัยร่วม (SDX)</span>
                          <span className="vh-info-val font-mono">{selectedItem.sdx}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 3: สถานะการชดเชยค่าบริการ */}
                  <div className="vh-modal-section" style={{ gridColumn: 'span 2' }}>
                    <h3 className="vh-section-title">สถานะการส่งเคลม & ชดเชยค่าบริการ (RCM)</h3>
                    <div className="vh-claim-card-row">
                      <div className="vh-claim-stat">
                        <span className="vh-claim-stat-label">สถานะการชดเชย</span>
                        <span className="vh-claim-stat-val font-bold">
                          {selectedItem.status || 'ยังไม่ได้ส่ง'}
                        </span>
                      </div>
                      <div className="vh-claim-stat">
                        <span className="vh-claim-stat-label">เลขที่หนังสือตอบรับ (REP)</span>
                        <span className="vh-claim-stat-val font-mono">
                          {selectedItem.rep || '—'}
                        </span>
                      </div>
                      <div className="vh-claim-stat">
                        <span className="vh-claim-stat-label">ยอดเงินชดเชย</span>
                        <span className="vh-claim-stat-val text-success font-bold">
                          ฿{formatMoney(selectedItem.compensated)}
                        </span>
                      </div>
                      <div className="vh-claim-stat">
                        <span className="vh-claim-stat-label">กองทุน / กองทุนย่อย</span>
                        <span className="vh-claim-stat-val">
                          {selectedItem.fund || '—'} {selectedItem.subfund ? `(${selectedItem.subfund})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'clinical' && (
                <div className="vh-clinical-tab">
                  {loadingVnDetails && (
                    <div className="vh-loading-card">
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>กำลังโหลดรายละเอียดเวชระเบียนจากระบบ HOSxP...</span>
                    </div>
                  )}

                  {!loadingVnDetails && !vnDetails && (
                    <div className="vh-empty-state">
                      <AlertTriangle size={32} className="vh-empty-icon text-warn" />
                      <div className="vh-empty-title">ไม่พบรายละเอียดเวชระเบียน</div>
                      <div className="vh-empty-desc">
                        ไม่พบข้อมูลประวัติทางคลินิกเพิ่มเติมสำหรับ VN: {selectedItem.vn}
                      </div>
                    </div>
                  )}

                  {!loadingVnDetails && vnDetails && (
                    <div className="vh-clinical-content">
                      {/* Vitals */}
                      <div className="vh-clinical-group">
                        <h4 className="vh-clinical-subtitle">สัญญาณชีพ & การคัดกรอง</h4>
                        <div className="vh-vitals-grid">
                          <div className="vh-vital-box">
                            <span className="vh-vital-label">ความดันโลหิต</span>
                            <span className="vh-vital-val font-mono">
                              {vnDetails.screen?.bps && vnDetails.screen?.bpd
                                ? `${vnDetails.screen.bps} / ${vnDetails.screen.bpd} mmHg`
                                : '—'}
                            </span>
                          </div>
                          <div className="vh-vital-box">
                            <span className="vh-vital-label">ชีพจร (PR)</span>
                            <span className="vh-vital-val font-mono">{vnDetails.screen?.pulse || '—'} bpm</span>
                          </div>
                          <div className="vh-vital-box">
                            <span className="vh-vital-label">อุณหภูมิ (BT)</span>
                            <span className="vh-vital-val font-mono">{vnDetails.screen?.temperature || '—'} °C</span>
                          </div>
                          <div className="vh-vital-box">
                            <span className="vh-vital-label">น้ำหนัก / ส่วนสูง</span>
                            <span className="vh-vital-val font-mono">{vnDetails.screen?.bw || '—'} kg / {vnDetails.screen?.height || '—'} cm</span>
                          </div>
                          <div className="vh-vital-box">
                            <span className="vh-vital-label">BMI</span>
                            <span className="vh-vital-val font-mono">{vnDetails.screen?.bmi || '—'}</span>
                          </div>
                          <div className="vh-vital-box">
                            <span className="vh-vital-label">รอบเอว</span>
                            <span className="vh-vital-val font-mono">{(vnDetails.screen as any)?.waist || '—'} cm</span>
                          </div>
                        </div>
                      </div>

                      {/* Lab Orders */}
                      {(vnDetails as any).labs && (vnDetails as any).labs.length > 0 && (
                        <div className="vh-clinical-group">
                          <h4 className="vh-clinical-subtitle">รายการตรวจทางห้องปฏิบัติการ (Lab Orders)</h4>
                          <div className="vh-subtable-scroll">
                            <table className="vh-subtable">
                              <thead>
                                <tr>
                                  <th>รายการ Lab</th>
                                  <th className="col-center">ผลการตรวจ</th>
                                  <th className="col-center">ค่าปกติ</th>
                                  <th className="col-center">สถานะ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(vnDetails as any).labs.map((lb: any, idx: number) => (
                                  <tr key={idx}>
                                    <td>{lb.lab_items_name || lb.form_name || '—'}</td>
                                    <td className="col-center font-bold font-mono">{lb.lab_order_result || 'รอผล'}</td>
                                    <td className="col-center font-mono">{lb.lab_items_normal_value || '—'}</td>
                                    <td className="col-center">
                                      <span className={`vh-badge ${lb.lab_order_result ? 'vh-badge-ok' : 'vh-badge-neutral'}`}>
                                        {lb.lab_order_result ? 'รายงานแล้ว' : 'รอผล'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Meds */}
                      {(vnDetails as any).medications && (vnDetails as any).medications.length > 0 && (
                        <div className="vh-clinical-group">
                          <h4 className="vh-clinical-subtitle">ยาและเวชภัณฑ์ที่จ่าย (Medications)</h4>
                          <div className="vh-subtable-scroll">
                            <table className="vh-subtable">
                              <thead>
                                <tr>
                                  <th>ชื่อยา / เวชภัณฑ์</th>
                                  <th className="col-center">จำนวน</th>
                                  <th>วิธีใช้</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(vnDetails as any).medications.map((med: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="font-semibold">{med.drug_name || med.name || '—'}</td>
                                    <td className="col-center font-mono">{med.qty || '—'}</td>
                                    <td>{med.shortlist || med.usage || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="vh-modal-footer">
              <button
                type="button"
                className="vh-btn vh-btn-secondary"
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
