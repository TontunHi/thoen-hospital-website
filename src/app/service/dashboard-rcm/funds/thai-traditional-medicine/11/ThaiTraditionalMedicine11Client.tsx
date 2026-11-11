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
  Leaf,
  Pill,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Sparkles,
  Check,
  Activity,
  FileSpreadsheet,
} from 'lucide-react'
import type {
  Ttm11Item,
  Ttm11Summary,
  Ttm11CardFilter,
  Ttm11SortField,
  Ttm11ReportResult,
  TtmHerbDrugItem,
} from '@/lib/clinical/rcmThaiTraditionalMedicineService'
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

export interface ThaiTraditionalMedicine11ClientProps {
  initialData?: Ttm11ReportResult | null
}

export default function ThaiTraditionalMedicine11Client({
  initialData = null,
}: ThaiTraditionalMedicine11ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<Ttm11CardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<Ttm11SortField>(
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
  const [items, setItems] = useState<Ttm11Item[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [summary, setSummary] = useState<Ttm11Summary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      totalDispensedUnits: 0,
      totalDrugAmount: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucsCount: 0,
      welCount: 0,
      invoiceCount: 0,
    }
  )

  // Detail Modal states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<Ttm11Item | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [herbalDrugs, setHerbalDrugs] = useState<TtmHerbDrugItem[]>([])
  const [loadingDrugs, setLoadingDrugs] = useState<boolean>(false)
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
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/thai-traditional-medicine/11?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `HTTP ${res.status} เกิดข้อผิดพลาดในการโหลดข้อมูล`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          setItems(json.data.items || [])
          setTotalCount(json.data.totalCount || 0)
          setTotalPages(json.data.totalPages || 1)
          setSummary(json.data.summary)
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

  // Skip first mount fetch if initialData is provided
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Fetch clinical VN details when modal opens and switches to clinical tab
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/thai-traditional-medicine/vn-details?vn=${vn}`)
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

  // Fetch herbal drug items prescribed in this VN
  const fetchHerbalDrugs = useCallback(async (vn: string) => {
    setLoadingDrugs(true)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/thai-traditional-medicine/herbal-drugs?vn=${encodeURIComponent(vn)}`
      )
      const json = await res.json()
      if (json.success && json.data) {
        setHerbalDrugs(json.data)
      } else {
        setHerbalDrugs([])
      }
    } catch {
      setHerbalDrugs([])
    } finally {
      setLoadingDrugs(false)
    }
  }, [])

  // Handle row click (open detail modal directly)
  const handleRowClick = (item: Ttm11Item) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
    setHerbalDrugs([])
    if (item.vn) {
      fetchHerbalDrugs(item.vn)
    }
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

  const handleFiscalYearChange = (beFiscal: number) => {
    setSelectedFiscalYear(beFiscal)
    setCurrentPage(1)
    const ceFiscal = beFiscal - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
  }

  // Handle Card Filter
  const handleCardFilter = (filterKey: Ttm11CardFilter) => {
    setCardFilter((prev) => (prev === filterKey ? 'ALL' : filterKey))
    setCurrentPage(1)
  }

  // Handle Table Sorting
  const handleSort = (field: Ttm11SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/thai-traditional-medicine/11?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')
      }

      const rowsData: Ttm11Item[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'AN',
        'CID',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'วันที่รับบริการ',
        'เวลา',
        'สิทธิ (Hipdata)',
        'สิทธิการรักษา',
        'HospMain',
        'HospSub',
        'ClaimCode',
        'Authen Endpoint',
        'PDX',
        'รายการยาสมุนไพร 32 รายการ',
        'รหัส TTMT',
        'จำนวนรวม (ชิ้น)',
        'มูลค่ายารวม (บาท)',
        'ค่ารักษา (บาท)',
        'เลขที่ Rep',
        'ยอดชดเชย Rep (บาท)',
        'กองทุน',
        'กองทุนย่อย',
        'ErrorCode',
        'Invoice Rep',
        'ยอดชดเชย Invoice (บาท)',
        'สถานะ',
      ]

      const rows = rowsData.map((r, idx) => [
        idx + 1,
        r.vn,
        r.hn,
        r.an || '',
        r.cid,
        r.ptname,
        r.sex,
        r.age,
        r.vstdate,
        r.vsttime,
        r.hipdataCode,
        r.pttypename,
        r.hospmain || '',
        r.hospsub || '',
        r.authCode || '',
        r.authenEndpoint || '',
        r.pdx || '',
        r.drugNames,
        r.ttmtCodes,
        r.totalQty,
        r.totalDrugAmount,
        r.income,
        r.rep || '',
        r.compensated,
        r.fund || '',
        r.subfund || '',
        r.errorcode || '',
        r.repInvoice || '',
        r.compensatedInvoice ?? '',
        r.status || '',
      ])

      await exportRcmExcel({
        filename: `TTM_Topic11_Herbs32_${ds1}_to_${ds2}.xlsx`,
        title: 'รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${rowsData.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="ttm11-container">
      {/* ── 1. Page Header ── */}
      <div className="ttm11-header">
        <div className="ttm11-header-left">
          <div className="ttm11-breadcrumb">
            <Link href="/service/dashboard-rcm" className="ttm11-breadcrumb-link">
              Dashboard RCM
            </Link>
            <span className="ttm11-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds" className="ttm11-breadcrumb-link">
              กองทุน
            </Link>
            <span className="ttm11-breadcrumb-sep">/</span>
            <span className="ttm11-breadcrumb-current">
              รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ
            </span>
          </div>
          <h1 className="ttm11-title">รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ</h1>
          <p className="ttm11-subtitle">
            บริการแพทย์แผนไทย และการแพทย์ทางเลือก • ทะเบียนผู้รับบริการที่ได้รับยาสมุนไพร 32 รายการ
            (TTMT Code, กลุ่มสิทธิ UCS / WEL) พร้อมยอดชดเชย Rep และ Invoice
          </p>
        </div>

        <div className="ttm11-header-actions">
          <button
            type="button"
            className="ttm11-btn ttm11-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="ttm11-btn ttm11-btn-primary"
            onClick={handleExportExcel}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} className={isExporting ? 'animate-spin' : ''} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Unified Single-Row Date Selector ── */}
      <div className="ttm11-date-card">
        <div className="ttm11-date-row">
          {/* Mode Switcher Tabs */}
          <div className="ttm11-date-tabs">
            <button
              type="button"
              className={`ttm11-date-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`ttm11-date-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={`ttm11-date-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="ttm11-date-divider" />

          {/* Date Range Inputs */}
          {dateMode === 'custom' && (
            <div className="ttm11-date-inputs">
              <span className="ttm11-date-label">ตั้งแต่:</span>
              <ThaiDatePicker
                value={ds1}
                onChange={(v) => {
                  setDs1(v)
                  setCurrentPage(1)
                }}
              />
              <span className="ttm11-date-label">ถึง:</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(v) => {
                  setDs2(v)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="ttm11-date-inputs">
              <span className="ttm11-date-label">เดือน:</span>
              <select
                className="ttm11-date-select"
                value={selectedMonth}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedBeYear)}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <span className="ttm11-date-label">ปี:</span>
              <select
                className="ttm11-date-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dateMode === 'fiscal' && (
            <div className="ttm11-date-inputs">
              <span className="ttm11-date-label">ปีงบประมาณ:</span>
              <select
                className="ttm11-date-select"
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

      {/* ── 3. Symmetrical 4-Column x 2-Row KPI Grid (8 Cards) ── */}
      <div className="ttm11-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="ttm11-kpi-icon icon-primary">
              <Pill size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="ttm11-kpi-sub">
              {summary.uniquePatients.toLocaleString('th-TH')} คน • {summary.totalDispensedUnits.toLocaleString('th-TH')} ชิ้น
            </span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">ชดเชยแล้ว</span>
            <div className="ttm11-kpi-icon icon-success">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val text-success">
              {summary.compensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="ttm11-kpi-sub">
              {formatMoney(summary.totalCompensated)} บาท ({summary.compensationRate.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้รับการชดเชย"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">ยังไม่ชดเชย</span>
            <div className="ttm11-kpi-icon icon-warn">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val text-danger">
              {summary.uncompensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="ttm11-kpi-sub">
              {(100 - summary.compensationRate).toFixed(1)}% รอส่งเบิก/รอตอบรับ
            </span>
          </div>
        </div>

        {/* Card 4: มี ClaimCode */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">มี ClaimCode</span>
            <div className="ttm11-kpi-icon icon-info">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
            <span className="ttm11-kpi-sub">{summary.authenRate.toFixed(1)}% ยืนยันตัวตนแล้ว</span>
          </div>
        </div>

        {/* Card 5: ไม่มี ClaimCode */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('NO_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองรายการที่ไม่มี ClaimCode"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">ไม่มี ClaimCode</span>
            <div className="ttm11-kpi-icon icon-danger">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val text-danger">
              {summary.withoutAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="ttm11-kpi-sub">
              {(100 - summary.authenRate).toFixed(1)}% ต้องขอ ClaimCode ย้อนหลัง
            </span>
          </div>
        </div>

        {/* Card 6: สิทธิบัตรทอง (UCS) */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'HIP_UCS' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('HIP_UCS')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UCS)"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">สิทธิบัตรทอง (UCS)</span>
            <div className="ttm11-kpi-icon icon-accent">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val">{summary.ucsCount.toLocaleString('th-TH')}</span>
            <span className="ttm11-kpi-sub">
              {summary.totalVisits > 0
                ? ((summary.ucsCount / summary.totalVisits) * 100).toFixed(1)
                : 0}
              % สิทธิบัตรทองหลัก
            </span>
          </div>
        </div>

        {/* Card 7: สิทธิสวัสดิการ (WEL) */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'HIP_WEL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('HIP_WEL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะสิทธิสวัสดิการผู้มีรายได้น้อย (WEL)"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">สิทธิสวัสดิการ (WEL)</span>
            <div className="ttm11-kpi-icon icon-neutral">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val">{summary.welCount.toLocaleString('th-TH')}</span>
            <span className="ttm11-kpi-sub">ผู้มีรายได้น้อย/ผู้สูงอายุ</span>
          </div>
        </div>

        {/* Card 8: มี Invoice แล้ว */}
        <div
          className={`ttm11-kpi-card ${cardFilter === 'WITH_INVOICE' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_INVOICE')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี e-Claim Invoice แล้ว"
        >
          <div className="ttm11-kpi-header">
            <span className="ttm11-kpi-title">มี Invoice แล้ว</span>
            <div className="ttm11-kpi-icon icon-success">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="ttm11-kpi-body">
            <span className="ttm11-kpi-val">{summary.invoiceCount.toLocaleString('th-TH')}</span>
            <span className="ttm11-kpi-sub">ออกใบแจ้งหนี้ Rep e-Claim แล้ว</span>
          </div>
        </div>
      </div>

      {/* ── 4. Search & Filters Bar ── */}
      <div className="ttm11-filter-bar">
        <div className="ttm11-search-box">
          <Search size={16} className="ttm11-search-icon" />
          <input
            type="text"
            className="ttm11-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, AN, PDX, ชื่อยา, TTMT, Rep..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="ttm11-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="ttm11-secondary-filters">
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {cardFilter !== 'ALL' && (
            <div className="ttm11-active-filter-badge">
              <span>ฟิลเตอร์: <strong>{cardFilter}</strong></span>
              <button
                type="button"
                className="ttm11-active-filter-clear"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกฟิลเตอร์การ์ด"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Data Table Section ── */}
      <div className="ttm11-table-card">
        <div className="ttm11-table-meta">
          <div>
            พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
            {loading && <span className="text-muted" style={{ marginLeft: 8 }}>กำลังโหลดข้อมูล...</span>}
          </div>
          <div className="ttm11-row-hint">
            * คลิกที่แถวเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย
          </div>
        </div>

        {error && (
          <div className="ttm11-empty-state">
            <AlertTriangle size={32} className="text-danger" />
            <div className="ttm11-empty-title">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
            <div className="ttm11-empty-desc">{error}</div>
            <button
              type="button"
              className="ttm11-btn ttm11-btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => fetchData()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {!error && (
          <div className="ttm11-table-scroll">
            <table className="ttm11-table">
              <thead>
                <tr>
                  <th className="col-center">ลำดับ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm11-sort-btn"
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
                      className="ttm11-sort-btn"
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
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm11-sort-btn"
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
                      className="ttm11-sort-btn"
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
                  <th className="col-center">สิทธิ (Hipdata)</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm11-sort-btn"
                      onClick={() => handleSort('authCode')}
                    >
                      ClaimCode{' '}
                      {sortBy === 'authCode' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm11-sort-btn"
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
                  <th className="col-center">รายการยาสมุนไพร 32 รายการ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm11-sort-btn"
                      onClick={() => handleSort('totalQty')}
                    >
                      จำนวน (ชิ้น){' '}
                      {sortBy === 'totalQty' ? (
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
                      className="ttm11-sort-btn"
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
                {loading || isRefreshing ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="rcm-skeleton-row">
                      {Array.from({ length: 14 }).map((__, colIdx) => (
                        <td key={colIdx} className="col-center">
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="col-center" style={{ padding: '48px 16px' }}>
                      ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr
                    key={item.vn}
                    className="ttm11-row-clickable"
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย"
                  >
                    <td className="col-center ttm11-num">{item.no}</td>
                    <td className="col-center ttm11-num">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center ttm11-num">{item.vsttime || '—'}</td>
                    <td className="col-center ttm11-num font-mono">{item.hn}</td>
                    <td className="col-center ttm11-num font-mono">{item.cid}</td>
                    <td className="col-center">
                      <div className="ttm11-patient-name">
                        <span className="ttm11-name-part">{item.ptname}</span>
                      </div>
                    </td>
                    <td className="col-center ttm11-num">{item.age}&nbsp;ปี</td>
                    <td className="col-center">
                      <span
                        className={`ttm11-badge ${
                          item.hipdataCode === 'UCS' ? 'ttm11-badge-ok' : 'ttm11-badge-info'
                        }`}
                        title={item.pttypename}
                      >
                        {item.hipdataCode}
                      </span>
                    </td>
                    <td className="col-center font-mono">
                      {item.authCode || item.authenEndpoint ? (
                        <span className="ttm11-badge ttm11-badge-ok">
                          {item.authCode || item.authenEndpoint}
                        </span>
                      ) : (
                        <span className="ttm11-badge ttm11-badge-warn">ไม่มี</span>
                      )}
                    </td>
                    <td className="col-center font-mono font-bold">{item.pdx || '—'}</td>
                    <td
                      className="col-left"
                      style={{
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={item.drugNames}
                    >
                      {item.drugNames || '—'}
                    </td>
                    <td className="col-center ttm11-num font-semibold">{item.totalQty}</td>
                    <td className="col-center">
                      <span
                        className={`ttm11-badge ${
                          item.isCompensated
                            ? 'ttm11-badge-ok'
                            : item.status && !item.status.includes('ยังไม่ได้ส่ง')
                            ? 'ttm11-badge-info'
                            : 'ttm11-badge-warn'
                        }`}
                      >
                        {item.status || 'ยังไม่ได้ส่ง'}
                      </span>
                    </td>
                    <td className="col-center ttm11-num font-semibold">
                      {item.isCompensated ? (
                        <span className="text-success">
                          {formatMoney(item.compensated || item.compensatedInvoice)}
                        </span>
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

        {/* ── 6. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="ttm11-pagination">
            <div className="ttm11-pagination-info">
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ)
            </div>

            <div className="ttm11-pagination-controls">
              <button
                type="button"
                className="ttm11-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                หน้าแรก
              </button>
              <button
                type="button"
                className="ttm11-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="ttm11-page-status">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="ttm11-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="ttm11-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="หน้าสุดท้าย"
              >
                หน้าสุดท้าย
              </button>

              <select
                className="ttm11-page-size-select"
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

      {/* ── 7. Patient Detail Modal (Triggered by Clicking Row) ── */}
      {selectedItem && (
        <div className="ttm11-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="ttm11-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ttm11-modal-title"
          >
            {/* Modal Header */}
            <div className="ttm11-modal-header">
              <div className="ttm11-modal-header-info">
                <div className="ttm11-modal-title-row">
                  <Leaf size={22} className="text-primary" />
                  <h2 id="ttm11-modal-title" className="ttm11-modal-title">
                    {selectedItem.ptname}
                  </h2>
                  <span className="ttm11-modal-age">{selectedItem.age} ปี</span>
                </div>
                <div className="ttm11-modal-meta">
                  <span>
                    HN: <strong className="font-mono">{selectedItem.hn}</strong>
                  </span>
                  {selectedItem.an && (
                    <>
                      <span>•</span>
                      <span>
                        AN: <strong className="font-mono">{selectedItem.an}</strong>
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    CID: <strong className="font-mono">{selectedItem.cid}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    VN: <strong className="font-mono">{selectedItem.vn}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    วันที่รับบริการ:{' '}
                    <strong>
                      {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="ttm11-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="ttm11-modal-tabs">
              <button
                type="button"
                className={`ttm11-modal-tab ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลบริการ & ยาสมุนไพร 32 รายการ
              </button>
              <button
                type="button"
                className={`ttm11-modal-tab ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ประวัติเวชระเบียนคลินิก
              </button>
            </div>

            {/* Modal Content */}
            <div className="ttm11-modal-body">
              {modalTab === 'summary' && (
                <div className="ttm11-modal-grid">
                  {/* Section 1: ข้อมูลผู้รับบริการ & สิทธิ */}
                  <div className="ttm11-modal-section">
                    <h3 className="ttm11-section-title">ข้อมูลผู้รับบริการ & สิทธิ์</h3>
                    <div className="ttm11-info-list">
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">ชื่อ-สกุล</span>
                        <span className="ttm11-info-val font-semibold">{selectedItem.ptname}</span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">เลขบัตรประชาชน</span>
                        <span className="ttm11-info-val font-mono">
                          <button
                            type="button"
                            className="ttm11-copy-inline"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คลิกเพื่อคัดลอก CID"
                          >
                            <span>{selectedItem.cid}</span>
                            {copiedField === 'cid' && (
                              <span className="ttm11-copy-feedback">คัดลอกแล้ว</span>
                            )}
                          </button>
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">เพศ / อายุ</span>
                        <span className="ttm11-info-val">
                          {selectedItem.sex} • {selectedItem.age} ปี
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">กลุ่มสิทธิ (Hipdata)</span>
                        <span className="ttm11-info-val">
                          <span
                            className={`ttm11-badge ${
                              selectedItem.hipdataCode === 'UCS'
                                ? 'ttm11-badge-ok'
                                : 'ttm11-badge-info'
                            }`}
                          >
                            {selectedItem.hipdataLabel}
                          </span>
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">สิทธิการรักษา</span>
                        <span className="ttm11-info-val">{selectedItem.pttypename}</span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">สถานพยาบาลหลัก (HospMain)</span>
                        <span className="ttm11-info-val">{selectedItem.hospmain || '—'}</span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">สถานพยาบาลรอง (HospSub)</span>
                        <span className="ttm11-info-val">{selectedItem.hospsub || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: การยืนยันตัวตน & แผนก */}
                  <div className="ttm11-modal-section">
                    <h3 className="ttm11-section-title">การยืนยันตัวตน & แผนก</h3>
                    <div className="ttm11-info-list">
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">ClaimCode:</span>
                        <span className="ttm11-info-val font-mono">
                          {selectedItem.authCode ? (
                            <span className="ttm11-badge ttm11-badge-ok">
                              {selectedItem.authCode}
                            </span>
                          ) : (
                            <span className="ttm11-badge ttm11-badge-warn">ไม่มี</span>
                          )}
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">Authen Endpoint (สปสช.)</span>
                        <span className="ttm11-info-val font-mono">
                          {selectedItem.authenEndpoint || '—'}
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">แผนกตรวจ</span>
                        <span className="ttm11-info-val">{selectedItem.department || '—'}</span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">PDX (โรคหลัก)</span>
                        <span className="ttm11-info-val font-mono font-bold">
                          {selectedItem.pdx || '—'}
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">รหัสโรครอง (DX0–DX5)</span>
                        <span className="ttm11-info-val font-mono">
                          {[
                            selectedItem.dx0,
                            selectedItem.dx1,
                            selectedItem.dx2,
                            selectedItem.dx3,
                            selectedItem.dx4,
                            selectedItem.dx5,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </span>
                      </div>
                      <div className="ttm11-info-item">
                        <span className="ttm11-info-label">ค่ารักษาพยาบาล (Income)</span>
                        <span className="ttm11-info-val font-semibold ttm11-num">
                          {formatMoney(selectedItem.income)} บาท
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: รายการยาสมุนไพร 32 รายการที่ได้รับ (Full width) */}
                  <div className="ttm11-modal-section col-span-2">
                    <h3 className="ttm11-section-title">
                      รายการยาสมุนไพร 32 รายการที่ได้รับในครั้งนี้ ({loadingDrugs ? 'กำลังโหลด...' : herbalDrugs.length > 0 ? `${herbalDrugs.length} รายการ` : `${selectedItem.itemCount || 1} รายการ`} • รวม {selectedItem.totalQty} ชิ้น)
                    </h3>

                    {loadingDrugs ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
                        <RefreshCw size={18} className="animate-spin" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
                        กำลังโหลดรายละเอียดรายการยา...
                      </div>
                    ) : herbalDrugs.length > 0 ? (
                      <table className="ttm11-drug-table">
                        <thead>
                          <tr>
                            <th className="col-center">รหัสยา (icode)</th>
                            <th className="col-left">ชื่อยาสมุนไพร</th>
                            <th className="col-center">รหัส TTMT</th>
                            <th className="col-center">รหัส DID</th>
                            <th className="col-center">หมวด SKS</th>
                            <th className="col-center">จำนวน</th>
                            <th className="col-right">ราคา/หน่วย</th>
                            <th className="col-right">รวมเงิน (บาท)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {herbalDrugs.map((d, dIdx) => (
                            <tr key={dIdx}>
                              <td className="col-center font-mono">{d.icode || '—'}</td>
                              <td className="col-left font-semibold">
                                {d.name || d.drug} {d.strength && <span className="text-muted">{d.strength}</span>}
                              </td>
                              <td className="col-center font-mono font-bold text-primary">
                                {d.ttmt_code || '—'}
                              </td>
                              <td className="col-center font-mono text-muted">{d.did || '—'}</td>
                              <td className="col-center">{d.category_id ? `หมวด ${d.category_id}` : '—'}</td>
                              <td className="col-center ttm11-num">
                                {d.qty} {d.units || ''}
                              </td>
                              <td className="col-right ttm11-num">{formatMoney(d.unitprice)}</td>
                              <td className="col-right ttm11-num font-semibold">
                                {formatMoney(d.sumprice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                        {selectedItem.drugNames || '—'}
                      </div>
                    )}
                  </div>

                  {/* Section 4: การชดเชย Rep และ Invoice e-Claim (Full width) */}
                  <div className="ttm11-modal-section col-span-2">
                    <h3 className="ttm11-section-title">
                      ข้อมูลการชดเชย Rep และ e-Claim Invoice
                    </h3>
                    <div className="ttm11-modal-grid">
                      <div className="ttm11-info-list">
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">สถานะการชดเชย</span>
                          <span className="ttm11-info-val">
                            <span
                              className={`ttm11-badge ${
                                selectedItem.isCompensated
                                  ? 'ttm11-badge-ok'
                                  : selectedItem.status &&
                                    !selectedItem.status.includes('ยังไม่ได้ส่ง')
                                  ? 'ttm11-badge-info'
                                  : 'ttm11-badge-warn'
                              }`}
                            >
                              {selectedItem.status || 'ยังไม่ได้ส่ง'}
                            </span>
                          </span>
                        </div>
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">เลขที่ Rep</span>
                          <span className="ttm11-info-val font-mono">
                            {selectedItem.rep || '—'}
                          </span>
                        </div>
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">ยอดชดเชย Rep</span>
                          <span className="ttm11-info-val font-bold text-success ttm11-num">
                            {selectedItem.compensated > 0
                              ? `${formatMoney(selectedItem.compensated)} บาท`
                              : '—'}
                          </span>
                        </div>
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">กองทุน / กองทุนย่อย</span>
                          <span className="ttm11-info-val">
                            {selectedItem.fund || '—'} / {selectedItem.subfund || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="ttm11-info-list">
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">เลขที่ e-Claim Invoice</span>
                          <span className="ttm11-info-val font-mono">
                            {selectedItem.repInvoice || '—'}
                          </span>
                        </div>
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">ยอดชดเชย Invoice</span>
                          <span className="ttm11-info-val font-bold text-success ttm11-num">
                            {selectedItem.compensatedInvoice != null &&
                            selectedItem.compensatedInvoice > 0
                              ? `${formatMoney(selectedItem.compensatedInvoice)} บาท`
                              : '—'}
                          </span>
                        </div>
                        <div className="ttm11-info-item">
                          <span className="ttm11-info-label">ErrorCode</span>
                          <span className="ttm11-info-val font-mono">
                            {selectedItem.errorcode ? (
                              <span className="ttm11-badge ttm11-badge-danger">
                                {selectedItem.errorcode}
                              </span>
                            ) : (
                              'ปกติ (ไม่มี Error)'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Clinical Details */}
              {modalTab === 'clinical' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {loadingVnDetails && (
                    <div className="ttm11-loading-card">
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>กำลังโหลดประวัติเวชระเบียนคลินิก...</span>
                    </div>
                  )}

                  {!loadingVnDetails && vnDetails && (
                    <>
                      {/* Clinical Diagnoses */}
                      <div className="ttm11-modal-section">
                        <h3 className="ttm11-section-title">
                          รายการวินิจฉัยโรคทั้งหมด ({vnDetails.diagnoses.length} รายการ)
                        </h3>
                        {vnDetails.diagnoses.length === 0 ? (
                          <div className="text-muted">ไม่พบข้อมูลการวินิจฉัย</div>
                        ) : (
                          <table className="ttm11-drug-table">
                            <thead>
                              <tr>
                                <th className="col-center">ประเภท</th>
                                <th className="col-center">ICD-10</th>
                                <th className="col-left">ชื่อโรค</th>
                                <th className="col-left">แพทย์ผู้ตรวจ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.diagnoses.map((d, idx) => (
                                <tr key={idx}>
                                  <td className="col-center">{d.diagtype_name}</td>
                                  <td className="col-center font-mono font-bold">{d.icd10}</td>
                                  <td className="col-left">{d.icd_name}</td>
                                  <td className="col-left">{d.doctor_name || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Clinical Doctor Orders & Drugs */}
                      <div className="ttm11-modal-section">
                        <h3 className="ttm11-section-title">
                          คำสั่งการรักษาและรายการยา/เวชภัณฑ์ ({vnDetails.orders.items.length} รายการ)
                        </h3>
                        {vnDetails.orders.items.length === 0 ? (
                          <div className="text-muted">ไม่มีคำสั่งยาหรือเวชภัณฑ์ในครั้งนี้</div>
                        ) : (
                          <table className="ttm11-drug-table">
                            <thead>
                              <tr>
                                <th className="col-left">รายการ</th>
                                <th className="col-center">จำนวน</th>
                                <th className="col-center">หน่วยนับ</th>
                                <th className="col-right">ราคา/หน่วย</th>
                                <th className="col-right">รวมเงิน (บาท)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.orders.items.map((o, idx) => (
                                <tr key={idx}>
                                  <td className="col-left">
                                    <span className="font-semibold">{o.item_name}</span>
                                    {o.strength && (
                                      <span className="text-muted" style={{ marginLeft: 6 }}>
                                        {o.strength}
                                      </span>
                                    )}
                                  </td>
                                  <td className="col-center ttm11-num">{o.qty}</td>
                                  <td className="col-center">{o.units || '—'}</td>
                                  <td className="col-right ttm11-num">{formatMoney(o.unitprice)}</td>
                                  <td className="col-right ttm11-num font-semibold">
                                    {formatMoney(o.sum_price)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </>
                  )}

                  {!loadingVnDetails && !vnDetails && (
                    <div className="ttm11-empty-state">
                      <AlertTriangle size={32} className="text-muted" />
                      <div className="ttm11-empty-title">ไม่พบรายละเอียดเวชระเบียนเพิ่มเติม</div>
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
