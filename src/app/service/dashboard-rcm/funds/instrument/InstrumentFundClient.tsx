'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Download,
  Search,
  X,
  AlertCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  ShieldCheck,
  Building,
  BedDouble,
  DollarSign,
  Activity,
  Layers,
  Copy,
  Check,
} from 'lucide-react'
import type {
  InstrumentItem,
  InstrumentSummary,
  InstrumentReportResponse,
  InstrumentPatientType,
  InstrumentCardFilter,
  InstrumentSortField,
  InstrumentAdpMappingCheck,
  InstrumentOptionItem,
} from '@/lib/clinical/rcmInstrumentFundService'
import { formatThaiDate } from '@/lib/formatters'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
import { InstrumentSelect } from './InstrumentSelect'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

const THAI_MONTH_OPTIONS = [
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

export interface InstrumentFundClientProps {
  initialData?: InstrumentReportResponse | null
  initialRange?: { startDate: string; endDate: string }
  initialError?: string | null
}

export default function InstrumentFundClient({
  initialData = null,
  initialRange,
  initialError = null,
}: InstrumentFundClientProps) {
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

  // Patient Type: OPD vs IPD
  const [patientType, setPatientType] = useState<InstrumentPatientType>('OPD')

  // Date mode: กำหนดเอง | เดือน | ปีงบประมาณ (ไม่มี () ในการแสดงผล)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('fiscal')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)

  const [ds1, setDs1] = useState<string>(
    initialData?.dateRange?.startDate ??
      initialRange?.startDate ??
      `${defaultFiscalCeYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialData?.dateRange?.endDate ??
      initialRange?.endDate ??
      `${defaultFiscalCeYear}-09-30`
  )

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<InstrumentCardFilter>('ALL')
  const [instrumentFilter, setInstrumentFilter] = useState<string>('')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<InstrumentSortField>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(initialError)
  const [items, setItems] = useState<InstrumentItem[]>(initialData?.items ?? [])
  const [availableInstruments, setAvailableInstruments] = useState<InstrumentOptionItem[]>(
    initialData?.availableInstruments ?? []
  )
  const [totalCount, setTotalCount] = useState<number>(initialData?.total ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<InstrumentAdpMappingCheck | null>(
    initialData?.adpMapping ?? null
  )
  const [summary, setSummary] = useState<InstrumentSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      totalUniquePatients: 0,
      totalInstrumentHosp: 0,
      totalDebit: 0,
      oaCases: 0,
      oaAmount: 0,
      dmCases: 0,
      dmAmount: 0,
      otherCases: 0,
      otherAmount: 0,
      compensatedCases: 0,
      totalCompensated: 0,
      invoiceCases: 0,
      invoiceAmount: 0,
      repCases: 0,
      repAmount: 0,
      unsentCases: 0,
      unsentAmount: 0,
      discrepancyCases: 0,
      authenCases: 0,
      authenRate: 0,
      ucCases: 0,
      ucRate: 0,
    }
  )

  // Detail Modal state (opened directly when clicking record row!)
  const [selectedItem, setSelectedItem] = useState<InstrumentItem | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race defense
  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstMount = useRef<boolean>(true)

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search])

  // Fetch report data
  const fetchData = useCallback(
    async (refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (refresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          patientType,
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })
        if (instrumentFilter) {
          queryParams.set('instrumentFilter', instrumentFilter)
        }
        if (pttypes.length > 0) {
          queryParams.set('pttypes', pttypes.join(','))
        }
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/instrument?${queryParams.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(
            json.error?.message ||
              json.error ||
              'ไม่สามารถดึงข้อมูลรายงานกองทุนอวัยวะเทียมและอุปกรณ์ได้'
          )
        }

        const data: InstrumentReportResponse = json.data
        setItems(data.items || [])
        setTotalCount(data.total || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) setSummary(data.summary)
        if (data.adpMapping) setAdpMapping(data.adpMapping)
        if (data.availableInstruments) setAvailableInstruments(data.availableInstruments)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError(
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
        )
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
      patientType,
      cardFilter,
      instrumentFilter,
      pttypes,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  )

  // Mount Guard: Skip double fetch on first mount if SSR sent initialData
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData, initialData])

  // Handlers for Date & Type Mode transitions (atomic state updates)
  const handlePatientTypeChange = (newType: InstrumentPatientType) => {
    if (newType === patientType) return
    setPatientType(newType)
    setCurrentPage(1)
  }

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
    const ceYear = beYear - 543
    setDs1(`${ceYear - 1}-10-01`)
    setDs2(`${ceYear}-09-30`)
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

  const handleMonthlyBeYearChange = (beYear: number) => {
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const mm = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleCustomDateChange = (start: string, end: string) => {
    setDs1(start)
    setDs2(end)
    setCurrentPage(1)
  }

  // Clickable KPI Card Filter handler
  const handleCardFilterClick = (filter: InstrumentCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Table Sort handler
  const handleSort = (field: InstrumentSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Copy helper for modal
  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  // Keyboard navigation for Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItem) {
        setSelectedItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem])

  // Safe Excel Export (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        patientType,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (instrumentFilter) {
        queryParams.set('instrumentFilter', instrumentFilter)
      }
      if (pttypes.length > 0) {
        queryParams.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/instrument?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error('ไม่สามารถส่งออกข้อมูลได้')
      }

      const allRows: InstrumentItem[] = json.data?.items || []

      const headers = [
        'ลำดับ',
        'ประเภทผู้ป่วย',
        patientType === 'OPD' ? 'VN' : 'AN',
        'HN',
        'CID',
        'ชื่อ-สกุล',
        'เพศ',
        patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันที่จำหน่าย',
        patientType === 'OPD' ? 'เวลา' : 'วันที่รับไว้',
        patientType === 'OPD' ? 'แผนก/ห้องตรวจ' : 'ตึกผู้ป่วย',
        'สิทธิการรักษา',
        'ClaimCode',
        'ค่าบริการ รพ.',
        'ลูกหนี้ Debit',
        'ค่าอวัยวะเทียม รพ.',
        'ยอด E-Claim',
        'ยอด Rep',
        'ยอด Invoice',
        'ผลต่าง',
        'สถานะการเคลม',
        'ผ่าข้อเข่า OA',
        'อุปกรณ์ DM',
        'รายการอุปกรณ์',
        'เลขที่ใบเสร็จ',
      ]

      const rows = allRows.map((r, i) => [
        i + 1,
        r.patientType,
        patientType === 'OPD' ? r.vn : r.an,
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        patientType === 'OPD' ? r.vstdate : r.dchdate,
        patientType === 'OPD' ? r.vsttime : r.admdate,
        patientType === 'OPD' ? r.room : r.ward,
        r.pttypename,
        r.authencode || '',
        r.money_hosxp,
        r.debit,
        r.instrument,
        r.money_eclaim,
        r.money_rep,
        r.money_invoice,
        r.diff_money,
        r.status,
        r.oa === 'Y' ? 'ใช่' : 'ไม่ใช่',
        r.dm === 'Y' ? 'ใช่' : 'ไม่ใช่',
        r.list || '',
        r.rcpno || '',
      ])

      await exportRcmExcel({
        filename: `rcm_instrument_${patientType.toLowerCase()}_${ds1}_${ds2}.xlsx`,
        title: `รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์ (${patientType})`,
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${allRows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="inst-page">
      {/* 1. Breadcrumb (Clean, text-only) */}
      <nav className="inst-breadcrumb" aria-label="Breadcrumb">
        <Link href="/service">บริการ</Link>
        <span className="inst-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm">Dashboard-RCM</Link>
        <span className="inst-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
        <span className="inst-breadcrumb-sep">/</span>
        <span className="inst-breadcrumb-current">
          กองทุนอวัยวะเทียมและอุปกรณ์
        </span>
      </nav>

      {/* 2. Header */}
      <header className="inst-header">
        <div className="inst-title-group">
          <h1 className="inst-title">รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์</h1>
          <p className="inst-subtitle">
            รายงานและตรวจสอบข้อมูลผู้รับบริการอวัยวะเทียมและอุปกรณ์ เพื่อกระทบยอดค่าใช้จ่าย HOSxP, E-Claim และ Rep Data
          </p>
        </div>

        <div className="inst-actions">
          <button
            type="button"
            className="inst-btn inst-btn-refresh"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลและล้างแคช"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            className="inst-btn inst-btn-export"
            onClick={handleExportExcel}
            disabled={isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* 3. Toolbar: Patient Type & Date Range (Single unified row without ()) */}
      <div className="inst-toolbar">
        {/* Patient Type OPD vs IPD Toggle */}
        <div className="inst-type-selector">
          <button
            type="button"
            className={`inst-type-tab ${patientType === 'OPD' ? 'active' : ''}`}
            onClick={() => handlePatientTypeChange('OPD')}
          >
            <Activity size={15} />
            <span>ผู้ป่วยนอก (OPD)</span>
          </button>
          <button
            type="button"
            className={`inst-type-tab ${patientType === 'IPD' ? 'active' : ''}`}
            onClick={() => handlePatientTypeChange('IPD')}
          >
            <BedDouble size={15} />
            <span>ผู้ป่วยใน (IPD)</span>
          </button>
        </div>

        {/* Date Selector */}
        <div className="inst-date-section">
          <div className="inst-date-tabs">
            <button
              type="button"
              className={`inst-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`inst-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              className={`inst-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="inst-date-inputs">
            {dateMode === 'fiscal' && (
              <select
                className="inst-select"
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

            {dateMode === 'monthly' && (
              <>
                <select
                  className="inst-select"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="inst-select"
                  value={selectedBeYear}
                  onChange={(e) => handleMonthlyBeYearChange(Number(e.target.value))}
                  aria-label="เลือกปี พ.ศ."
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {dateMode === 'custom' && (
              <>
                <input
                  type="date"
                  className="inst-input"
                  value={ds1}
                  onChange={(e) => handleCustomDateChange(e.target.value, ds2)}
                  aria-label="วันที่เริ่มต้น"
                />
                <span style={{ color: '#94a3b8' }}>—</span>
                <input
                  type="date"
                  className="inst-input"
                  value={ds2}
                  onChange={(e) => handleCustomDateChange(ds1, e.target.value)}
                  aria-label="วันที่สิ้นสุด"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Warning Banner if ADP mapping check has zero items */}
      {adpMapping && !adpMapping.isMapped && (
        <div className="inst-warning-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>แจ้งเตือน:</strong> ยังไม่ได้ทำแผนผัง Map ADP Code
            สำหรับประเภทอวัยวะเทียมและอุปกรณ์ (nhso_adp_type_id = 2) ในฐานข้อมูล HOSxP
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="inst-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Clickable KPI Cards (8 Balanced Cards) */}
      <section className="inst-kpi-grid" aria-label="KPI Cards Summary">
        {/* Card 1: ทั้งหมด */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">ผู้รับบริการทั้งหมด</span>
            <span className="inst-kpi-pill inst-pill-default">ทั้งหมด</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value">
              {(summary.totalCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ยอด รพ. {formatMoney(summary.totalInstrumentHosp)} บาท
          </div>
        </button>

        {/* Card 2: ผ่าข้อเข่า OA */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'OA' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('OA')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">ผ่าข้อเข่า OA</span>
            <span className="inst-kpi-pill inst-pill-oa">7004-7005</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value">
              {(summary.oaCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ยอด รพ. {formatMoney(summary.oaAmount)} บาท
          </div>
        </button>

        {/* Card 3: อุปกรณ์เบาหวาน DM */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'DM' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('DM')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">อุปกรณ์เบาหวาน DM</span>
            <span className="inst-kpi-pill inst-pill-dm">8612/8813/8814</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value">
              {(summary.dmCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ยอด รพ. {formatMoney(summary.dmAmount)} บาท
          </div>
        </button>

        {/* Card 4: อุปกรณ์ทั่วไปอื่นๆ */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'OTHER' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('OTHER')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">อุปกรณ์อื่นๆ</span>
            <span className="inst-kpi-pill inst-pill-default">ทั่วไป</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value">
              {(summary.otherCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ยอด รพ. {formatMoney(summary.otherAmount)} บาท
          </div>
        </button>

        {/* Card 5: ได้รับ Invoice แล้ว */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'INVOICE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('INVOICE')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">ได้รับ Invoice สปสช.</span>
            <span className="inst-kpi-pill inst-pill-invoice">NHSO</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value">
              {(summary.invoiceCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ชดเชย {formatMoney(summary.invoiceAmount)} บาท
          </div>
        </button>

        {/* Card 6: ได้รับ Rep แล้ว */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'REP' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('REP')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">ได้รับ Rep แล้ว</span>
            <span className="inst-kpi-pill inst-pill-rep">Rep Data</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value">
              {(summary.repCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ชดเชย {formatMoney(summary.repAmount)} บาท
          </div>
        </button>

        {/* Card 7: ยังไม่ส่งเข้า E-Claim */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'UNSENT' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNSENT')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">ยังไม่ส่ง E-Claim</span>
            <span className="inst-kpi-pill inst-pill-unsent">ค้างส่ง</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value" style={{ color: '#b91c1c' }}>
              {(summary.unsentCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            ยอดตกค้าง {formatMoney(summary.unsentAmount)} บาท
          </div>
        </button>

        {/* Card 8: ยอดไม่เท่ากัน (HOSxP ≠ E-Claim) */}
        <button
          type="button"
          className={`inst-kpi-card ${cardFilter === 'DISCREPANCY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('DISCREPANCY')}
        >
          <div className="inst-kpi-top">
            <span className="inst-kpi-label">ยอดไม่เท่ากัน</span>
            <span className="inst-kpi-pill inst-pill-discrepancy">HOSxP ≠ E-Claim</span>
          </div>
          <div className="inst-kpi-value-row">
            <span className="inst-kpi-value" style={{ color: '#854d0e' }}>
              {(summary.discrepancyCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="inst-kpi-unit">ราย</span>
          </div>
          <div className="inst-kpi-subvalue">
            มี ClaimCode {(summary.authenRate ?? 0).toFixed(1)}% ({summary.authenCases} ราย)
          </div>
        </button>
      </section>

      {/* 5. Search Bar & Status */}
      <div className="inst-filter-bar">
        <div className="inst-search-wrapper">
          <Search size={16} className="inst-search-icon" />
          <input
            type="text"
            className="inst-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN/AN, สิทธิ, รหัสอุปกรณ์..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="inst-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ minWidth: '220px' }}>
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          />
        </div>

        {/* ตัวกรองรายการอวัยวะเทียมและอุปกรณ์ */}
        <div className="inst-instrument-filter-wrapper">
          <InstrumentSelect
            value={instrumentFilter}
            onChange={(val) => {
              setInstrumentFilter(val)
              setCurrentPage(1)
            }}
            items={availableInstruments}
          />
        </div>

        <div className="inst-filter-info">
          {cardFilter !== 'ALL' && (
            <div className="inst-active-filter-badge">
              <span>ตัวกรอง: {cardFilter}</span>
              <button
                type="button"
                onClick={() => handleCardFilterClick('ALL')}
                title="ยกเลิกตัวกรอง"
              >
                <X size={12} />
              </button>
            </div>
          )}
          {instrumentFilter && (
            <div className="inst-active-filter-badge">
              <span>
                อุปกรณ์: {availableInstruments.find((x) => x.code === instrumentFilter)?.name || instrumentFilter}
              </span>
              <button
                type="button"
                onClick={() => {
                  setInstrumentFilter('')
                  setCurrentPage(1)
                }}
                title="ยกเลิกตัวกรองอุปกรณ์"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <span>
            พบทั้งหมด <strong className="inst-count-badge">{totalCount}</strong> รายการ
          </span>
        </div>
      </div>

      {/* 6. Clean Hospital Data Table */}
      <div className="inst-table-card">
        <div className="inst-table-container">
          <table className="inst-table" aria-label="ตารางรายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์">
            <thead>
              <tr>
                <th className="col-center" style={{ width: '50px' }}>
                  ลำดับ
                </th>
                <th
                  className="col-center sortable"
                  onClick={() => handleSort('date')}
                  title="คลิกเพื่อเรียงลำดับตามวันที่"
                >
                  <span className="inst-sort-th">
                    {patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันที่จำหน่าย'}
                    {sortBy === 'date' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                {patientType === 'OPD' && (
                  <th className="col-center" style={{ width: '70px' }}>
                    เวลา
                  </th>
                )}
                <th
                  className="col-center sortable"
                  onClick={() => handleSort(patientType === 'OPD' ? 'vn' : 'an')}
                >
                  <span className="inst-sort-th">
                    {patientType === 'OPD' ? 'VN' : 'AN'}
                    {sortBy === (patientType === 'OPD' ? 'vn' : 'an') ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th className="col-center" style={{ width: '90px' }}>
                  HN
                </th>
                <th className="col-center" style={{ width: '130px' }}>
                  เลขบัตร ปชช.
                </th>
                <th className="col-center" style={{ minWidth: '160px' }}>
                  ชื่อ-สกุล
                </th>
                <th className="col-center" style={{ width: '100px' }}>
                  สิทธิการรักษา
                </th>
                <th className="col-center" style={{ minWidth: '240px' }}>
                  รายการอวัยวะเทียมและอุปกรณ์
                </th>
                <th
                  className="col-right sortable"
                  onClick={() => handleSort('instrument')}
                  title="ค่าอวัยวะเทียมและอุปกรณ์ HOSxP"
                >
                  <span className="inst-sort-th" style={{ justifyContent: 'flex-end' }}>
                    ยอด รพ. (บาท)
                    {sortBy === 'instrument' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th
                  className="col-right sortable"
                  onClick={() => handleSort('money_eclaim')}
                  title="ยอดเคลมจากโปรแกรม E-Claim"
                >
                  <span className="inst-sort-th" style={{ justifyContent: 'flex-end' }}>
                    E-Claim (บาท)
                    {sortBy === 'money_eclaim' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th className="col-right">
                  ชดเชย (บาท)
                </th>
                <th className="col-center" style={{ minWidth: '160px' }}>
                  สถานะการเคลม
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                    ClaimCode
                  </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="inst-skeleton-row">
                    <td colSpan={patientType === 'OPD' ? 14 : 13} style={{ textAlign: 'center', color: '#94a3b8' }}>
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={patientType === 'OPD' ? 14 : 13}>
                    <div className="inst-empty-card">
                      <FileText size={36} color="#94a3b8" />
                      <p className="inst-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
                      <p className="inst-empty-text">
                        กรุณาลองเปลี่ยนช่วงเวลา ตัวกรอง หรือพิมพ์คำค้นหาใหม่
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  let rowHighlightClass = ''
                  if (row.statusCode === 'UNSENT') rowHighlightClass = 'inst-row-unsent'
                  else if (row.isDiscrepancy) rowHighlightClass = 'inst-row-discrepancy'

                  return (
                    <tr
                      key={`${patientType}-${row.vn || row.an || row.no}`}
                      className={`inst-table-row ${rowHighlightClass}`}
                      onClick={() => setSelectedItem(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setSelectedItem(row)
                      }}
                      title="กดเพื่อเปิดดูรายละเอียด"
                    >
                      <td className="col-center inst-tabular">{row.no}</td>
                      <td className="col-center inst-tabular">{formatThaiDate(row.date)}</td>
                      {patientType === 'OPD' && (
                        <td className="col-center inst-tabular">{row.vsttime || '—'}</td>
                      )}
                      <td className="col-center inst-tabular">{row.vn || row.an}</td>
                      <td className="col-center inst-tabular">{row.hn}</td>
                      <td className="col-center inst-tabular">{row.cid}</td>
                      <td className="col-center">
                        <span className="inst-ptname">{row.ptname}</span>
                      </td>
                      <td className="col-center" title={row.pttypename}>
                        <span style={{ fontSize: '12px' }}>{row.inscl || row.pttypename}</span>
                      </td>
                      <td className="col-left inst-items-cell">
                        {row.items && row.items.length > 0 ? (
                          <div className="inst-table-item-list">
                            {row.items.map((it, idx) => {
                              let badgeClass = 'inst-adp-default'
                              if (/^700[4-5]/.test(it.adpCode)) badgeClass = 'inst-adp-oa'
                              else if (/^8612|^8813|^8814/.test(it.adpCode)) badgeClass = 'inst-adp-dm'

                              return (
                                <div
                                  key={idx}
                                  className="inst-table-item-row"
                                  title={`${it.adpCode}: ${it.name}${it.price > 0 ? ` (${formatMoney(it.price)} บาท)` : ''}`}
                                >
                                  <span
                                    className={`inst-item-adp ${badgeClass}`}
                                    onClick={(e) => {
                                      if (it.adpCode && it.adpCode !== '-') {
                                        e.stopPropagation()
                                        setInstrumentFilter(it.adpCode)
                                        setCurrentPage(1)
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    title="คลิกเพื่อกรองเฉพาะอุปกรณ์นี้"
                                  >
                                    {it.adpCode}
                                  </span>
                                  <span className="inst-item-name">{it.name}</span>
                                  {it.price > 0 && (
                                    <span className="inst-item-price inst-tabular">
                                      ({formatMoney(it.price)}&nbsp;บ.)
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : row.list ? (
                          <span className="inst-item-name" style={{ fontSize: '12px' }}>{row.list}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-right" style={{ fontWeight: 600 }}>
                        {formatMoney(row.instrument)}
                      </td>
                      <td className="col-right" style={{ color: row.isDiscrepancy ? '#b45309' : '#0f172a' }}>
                        {formatMoney(row.money_eclaim)}
                      </td>
                      <td className="col-right" style={{ color: '#15803d', fontWeight: 600 }}>
                        {formatMoney(row.money_invoice || row.money_rep || 0)}
                      </td>
                      <td className="col-center">
                        <span
                          className={`inst-badge ${
                            row.statusCode === 'INVOICE'
                              ? 'inst-badge-invoice'
                              : row.statusCode === 'REP'
                              ? 'inst-badge-rep'
                              : row.statusCode === 'ECLAIM'
                              ? 'inst-badge-eclaim'
                              : 'inst-badge-unsent'
                          }`}
                        >
                          {row.statusCode === 'INVOICE' && <CheckCircle2 size={12} />}
                          {row.statusCode === 'UNSENT' && <AlertTriangle size={12} />}
                          <span>{row.status}</span>
                        </span>
                      </td>
                      <td className="col-center inst-tabular">
                        {row.authencode ? (
                          <span style={{ color: '#0d7446', fontWeight: 500 }}>{row.authencode}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 7. Pagination */}
        <div className="inst-pagination">
          <div>
            หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (รวมทั้งหมด {totalCount} รายการ)
          </div>
          <div className="inst-page-controls">
            <button
              type="button"
              className="inst-page-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let pageNum: number
              if (totalPages <= 5) pageNum = i + 1
              else if (currentPage <= 3) pageNum = i + 1
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = currentPage - 2 + i

              return (
                <button
                  key={pageNum}
                  type="button"
                  className={`inst-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              type="button"
              className="inst-page-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 8. Record Detail Modal (Opened directly when clicking row without view button) */}
      {selectedItem && (
        <div
          className="inst-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-patient-name"
        >
          <div className="inst-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="inst-modal-header">
              <div className="inst-modal-title-group">
                <h2 id="modal-patient-name" className="inst-modal-title">
                  {selectedItem.ptname}
                </h2>
                <p className="inst-modal-subtitle">
                  <span>HN: {selectedItem.hn}</span>
                  <span className="inst-subtitle-dot">•</span>
                  <span>CID: {selectedItem.cid}</span>
                  <span className="inst-subtitle-dot">•</span>
                  <span>
                    {selectedItem.patientType === 'OPD' ? `VN: ${selectedItem.vn}` : `AN: ${selectedItem.an}`}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="inst-modal-close-btn"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="inst-modal-body">
              {/* General & Visit Information */}
              <div>
                <h3 className="inst-modal-section-title">
                  <User size={16} color="#0d7446" />
                  <span>ข้อมูลทั่วไปและการรับบริการ</span>
                </h3>
                <div className="inst-detail-grid">
                  <div className="inst-detail-item">
                    <span className="inst-detail-label">
                      {selectedItem.patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันที่จำหน่าย'}
                    </span>
                    <span className="inst-detail-value">
                      {formatThaiDate(selectedItem.date)} {selectedItem.time ? `(${selectedItem.time})` : ''}
                    </span>
                  </div>
                  <div className="inst-detail-item">
                    <span className="inst-detail-label">
                      {selectedItem.patientType === 'OPD' ? 'แผนก/ห้องตรวจ' : 'ตึกผู้ป่วย'}
                    </span>
                    <span className="inst-detail-value">
                      {selectedItem.room || selectedItem.ward || '—'}
                    </span>
                  </div>
                  <div className="inst-detail-item">
                    <span className="inst-detail-label">สิทธิการรักษา</span>
                    <span className="inst-detail-value">
                      {selectedItem.pttypename} {selectedItem.inscl ? `[${selectedItem.inscl}]` : ''}
                    </span>
                  </div>
                  <div className="inst-detail-item">
                    <span className="inst-detail-label">ClaimCode:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="inst-detail-value" style={{ color: selectedItem.authencode ? '#0d7446' : '#94a3b8' }}>
                        {selectedItem.authencode || 'ไม่มี Authen Code'}
                      </span>
                      {selectedItem.authencode && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(selectedItem.authencode!, 'authen')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                          title="คัดลอก ClaimCode"
                        >
                          {copiedField === 'authen' ? <Check size={14} color="#0d7446" /> : <Copy size={14} color="#94a3b8" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedItem.rcpno && (
                    <div className="inst-detail-item">
                      <span className="inst-detail-label">เลขที่ใบเสร็จ</span>
                      <span className="inst-detail-value">{selectedItem.rcpno}</span>
                    </div>
                  )}
                  <div className="inst-detail-item">
                    <span className="inst-detail-label">หมวดหมู่อุปกรณ์</span>
                    <span className="inst-detail-value">
                      {selectedItem.oa === 'Y' && 'ผ่าตัดข้อเข่า OA '}
                      {selectedItem.dm === 'Y' && 'อุปกรณ์เบาหวาน DM '}
                      {selectedItem.oa !== 'Y' && selectedItem.dm !== 'Y' && 'อุปกรณ์ทั่วไป'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <h3 className="inst-modal-section-title">
                  <Layers size={16} color="#0d7446" />
                  <span>รายการอวัยวะเทียมและอุปกรณ์ ({selectedItem.items.length} รายการ)</span>
                </h3>
                {selectedItem.items.length > 0 ? (
                  <table className="inst-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>#</th>
                        <th style={{ width: '110px' }}>รหัส ADP</th>
                        <th>ชื่อรายการอุปกรณ์</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>ราคา (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItem.items.map((it, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{it.adpCode}</td>
                          <td>{it.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatMoney(it.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#64748b' }}>
                    {selectedItem.list || 'ไม่มีรายการระบุ'}
                  </div>
                )}
              </div>

              {/* Financial & Reconciliation Breakdown */}
              <div>
                <h3 className="inst-modal-section-title">
                  <DollarSign size={16} color="#0d7446" />
                  <span>การเงินและการกระทบยอดชดเชย</span>
                </h3>
                <div className="inst-finance-card">
                  <div className="inst-finance-row">
                    <span>ค่าบริการรวมโรงพยาบาล</span>
                    <span className="inst-tabular">{formatMoney(selectedItem.money_hosxp)} บาท</span>
                  </div>
                  <div className="inst-finance-row">
                    <span>ลูกหนี้สิทธิ์ (Debit)</span>
                    <span className="inst-tabular">{formatMoney(selectedItem.debit)} บาท</span>
                  </div>
                  <div className="inst-finance-row highlight">
                    <span>ค่าอวัยวะเทียมและอุปกรณ์ รพ. (Instrument)</span>
                    <span className="inst-tabular" style={{ color: '#0d7446' }}>
                      {formatMoney(selectedItem.instrument)} บาท
                    </span>
                  </div>
                  <div className="inst-finance-row">
                    <span>ยอดขอเบิก E-Claim</span>
                    <span className="inst-tabular">{formatMoney(selectedItem.money_eclaim)} บาท</span>
                  </div>
                  <div className="inst-finance-row">
                    <span>ยอดชดเชยจาก Rep Data</span>
                    <span className="inst-tabular">{formatMoney(selectedItem.money_rep)} บาท</span>
                  </div>
                  <div className="inst-finance-row">
                    <span>ยอดชดเชยตาม Invoice สปสช.</span>
                    <span className="inst-tabular" style={{ color: '#15803d', fontWeight: 600 }}>
                      {formatMoney(selectedItem.money_invoice)} บาท
                    </span>
                  </div>
                  <div className="inst-finance-row highlight">
                    <span>ผลต่าง (ชดเชย - ยอด รพ.)</span>
                    <span
                      className={`inst-finance-diff ${
                        selectedItem.diff_money >= 0 ? 'inst-diff-match' : 'inst-diff-mismatch'
                      }`}
                    >
                      {formatMoney(selectedItem.diff_money)} บาท
                    </span>
                  </div>
                  <div className="inst-finance-row">
                    <span>สถานะการเคลมปัจจุบัน</span>
                    <span style={{ fontWeight: 600 }}>{selectedItem.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="inst-modal-footer">
              <button
                type="button"
                className="inst-btn inst-btn-refresh"
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
