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
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  ShieldCheck,
  Building,
  DollarSign,
  Layers,
  Copy,
  Check,
} from 'lucide-react'
import type {
  WalkinFundItem,
  WalkinFundSummary,
  WalkinFundReportResult,
  WalkinFundCardFilter,
  WalkinFundSortField,
  WalkinAdpMappingCheck,
} from '@/lib/clinical/rcmWalkinFundService'
import { formatThaiDate } from '@/lib/formatters'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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

export interface WalkinFundClientProps {
  initialData?: WalkinFundReportResult | null
  initialRange?: { startDate: string; endDate: string }
  initialError?: string | null
}

export default function WalkinFundClient({
  initialData = null,
  initialRange,
  initialError = null,
}: WalkinFundClientProps) {
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

  // Date Mode: กำหนดเอง | เดือน | ปีงบประมาณ (ไม่มี () ในการแสดงผล)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('fiscal')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)

  const [ds1, setDs1] = useState<string>(
    initialData?.ds1 ?? initialRange?.startDate ?? `${defaultFiscalCeYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialData?.ds2 ?? initialRange?.endDate ?? `${defaultFiscalCeYear}-09-30`
  )

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<WalkinFundCardFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<WalkinFundSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(initialError)
  const [items, setItems] = useState<WalkinFundItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<WalkinAdpMappingCheck | null>(
    initialData?.adpMapping ?? null
  )
  const [summary, setSummary] = useState<WalkinFundSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      invoiceVisits: 0,
      totalInvoiceCompensated: 0,
      unsentVisits: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<WalkinFundItem | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race defense
  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstMount = useRef<boolean>(true)

  // Debounce search
  useEffect(() => {
    if (!search && !debouncedSearch) return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search, debouncedSearch])

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
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })
        if (pttypes.length > 0) {
          queryParams.set('pttypes', pttypes.join(','))
        }
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/walkin?${queryParams.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(
            json.error?.message || json.error || 'ไม่สามารถดึงข้อมูลรายงานกองทุน Walkin ได้'
          )
        }

        const data: WalkinFundReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) setSummary(data.summary)
        if (data.adpMapping) setAdpMapping(data.adpMapping)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError(
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, pttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
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

  // Date Mode transitions (atomic state updates)
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
  const handleCardFilterClick = (filter: WalkinFundCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Sorting Handler
  const handleSort = (field: WalkinFundSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Copy to clipboard helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // Safe Excel Export Handler (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      const exportParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) {
        exportParams.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(`/api/service/dashboard-rcm/funds/walkin?${exportParams.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error('ไม่สามารถดึงข้อมูลสำหรับการส่งออกได้')

      const exportRows: WalkinFundItem[] = json.data.items || []

      // Headers
      const headers = [
        'ลำดับ',
        'VN',
        'AN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'ClaimCode',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'PDX',
        'DX0',
        'DX1',
        'DX2',
        'DX3',
        'DX4',
        'DX5',
        'รายการยา/บริการ ADP (WALKIN)',
        'ยอดเงินรวม HOSxP (บาท)',
        'เลข Rep',
        'ยอดชดเชย Rep (บาท)',
        'เลข Invoice',
        'ยอด Invoice (บาท)',
        'Transaction Type',
        'Resource/Agency',
        'Subfund',
        'Project Code',
        'Remark',
        'สถานะการชดเชย',
      ]

      const rows = exportRows.map((r) => [
        r.no,
        r.vn,
        r.an || '',
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        r.age,
        r.nation || '',
        r.vstdate,
        r.vsttime,
        r.authencode || '',
        r.pttypename,
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.dx0 || '',
        r.dx1 || '',
        r.dx2 || '',
        r.dx3 || '',
        r.dx4 || '',
        r.dx5 || '',
        r.listname || '',
        r.income,
        r.rep || '',
        r.compensated,
        r.invoice || '',
        r.invoice_compensated,
        r.transactiontype || '',
        r.resource || '',
        r.subfund || '',
        r.projectcode || '',
        r.remark || '',
        r.status || '',
      ])

      await exportRcmExcel({
        filename: `rcm_fund_walkin_${ds1}_to_${ds2}.xlsx`,
        title: 'กองทุน Walkin',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportRows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  // Next/Prev item in modal
  const handleModalNav = (direction: 'prev' | 'next') => {
    if (!selectedItem) return
    const currentIndex = items.findIndex((i) => i.vn === selectedItem.vn)
    if (currentIndex === -1) return

    const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex >= 0 && nextIndex < items.length) {
      setSelectedItem(items[nextIndex])
    }
  }

  return (
    <div className="walkin-page">
      {/* 1. Breadcrumb */}
      <nav className="walkin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/service/dashboard-rcm">แดชบอร์ด RCM</Link>
        <span className="walkin-breadcrumb-sep">/</span>
        <span>กองทุน</span>
        <span className="walkin-breadcrumb-sep">/</span>
        <span className="walkin-breadcrumb-current">กองทุน Walkin</span>
      </nav>

      {/* 2. Header Bar */}
      <div className="walkin-header">
        <div className="walkin-title-group">
          <h1 className="walkin-title">กองทุน Walkin</h1>
          <p className="walkin-subtitle">
            <span>รายชื่อผู้รับบริการจาก ADP (WALKIN)</span>
            <span className="walkin-subtitle-badge">ADP: WALKIN</span>
          </p>
        </div>
        <div className="walkin-actions">
          <button
            type="button"
            className="walkin-btn walkin-btn-refresh"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw
              size={16}
              className={isRefreshing || loading ? 'walkin-spin' : ''}
            />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>
          <button
            type="button"
            className="walkin-btn walkin-btn-export"
            onClick={handleExportExcel}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* 3. Mapping Warning Banner if not mapped */}
      {adpMapping && !adpMapping.isMapped && (
        <div className="walkin-warning-banner" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>แจ้งเตือน:</strong> ยังไม่มีการจับคู่รหัส ADP <code>WALKIN</code> ในตาราง{' '}
            <code>s_drugitems</code> ของระบบ กรุณาตรวจสอบการตั้งค่า Map ADP Code
          </div>
        </div>
      )}

      {/* 4. Single-Row Date Toolbar (ไม่มีวงเล็บช่วงวันที่) */}
      <div className="walkin-toolbar">
        <div className="walkin-date-section">
          <div className="walkin-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`walkin-tab ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`walkin-tab ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`walkin-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="walkin-divider" />

          <div className="walkin-date-inputs">
            {dateMode === 'fiscal' && (
              <select
                className="walkin-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    ปีงบประมาณ {year}
                  </option>
                ))}
              </select>
            )}

            {dateMode === 'monthly' && (
              <>
                <select
                  className="walkin-select"
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
                  className="walkin-select"
                  value={selectedBeYear}
                  onChange={(e) => handleMonthlyBeYearChange(Number(e.target.value))}
                  aria-label="เลือกปี พ.ศ."
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}

            {dateMode === 'custom' && (
              <>
                <input
                  type="date"
                  className="walkin-input-date"
                  value={ds1}
                  onChange={(e) => handleCustomDateChange(e.target.value, ds2)}
                  aria-label="วันที่เริ่มต้น"
                />
                <span className="walkin-date-to">ถึง</span>
                <input
                  type="date"
                  className="walkin-input-date"
                  value={ds2}
                  onChange={(e) => handleCustomDateChange(ds1, e.target.value)}
                  aria-label="วันที่สิ้นสุด"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5. Clickable KPI Summary Cards */}
      <div className="walkin-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'ALL' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('ALL')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">ผู้รับบริการทั้งหมด</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.totalVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>ผู้ป่วยไม่ซ้ำ: <strong>{(summary.uniquePatients ?? 0).toLocaleString('th-TH')}</strong> คน</span>
            <span>•</span>
            <span>รวม <strong>{formatMoney(summary.totalIncome)}</strong> ฿</span>
          </div>
        </div>

        {/* Card 2: มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'WITH_AUTHEN' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('WITH_AUTHEN')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">มี ClaimCode</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.withAuthenCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>คิดเป็น: <strong>{(summary.authenRate ?? 0).toFixed(1)}%</strong> ของทั้งหมด</span>
          </div>
        </div>

        {/* Card 3: ไม่มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'NO_AUTHEN' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('NO_AUTHEN')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">ไม่มี ClaimCode</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.withoutAuthenCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>ต้องขอ ClaimCode ย้อนหลัง</span>
          </div>
        </div>

        {/* Card 4: ชดเชยแล้ว (มี Rep) */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'COMPENSATED' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('COMPENSATED')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">ชดเชยแล้ว (มี Rep)</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.compensatedVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>ชดเชย <strong>{formatMoney(summary.totalCompensated)}</strong> ฿ ({(summary.compensationRate ?? 0).toFixed(1)}%)</span>
          </div>
        </div>

        {/* Card 5: มี Invoice (รอ Rep) */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'INVOICE' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('INVOICE')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('INVOICE')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">มี Invoice แล้ว (รอ Rep)</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.invoiceVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>ยอด Invoice: <strong>{formatMoney(summary.totalInvoiceCompensated)}</strong> ฿</span>
          </div>
        </div>

        {/* Card 6: ยังไม่ส่ง / รอส่ง */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'UNSENT' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('UNSENT')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('UNSENT')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">ยังไม่ส่ง / รอส่ง e-Claim</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.unsentVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>ยังไม่มีเลข Invoice หรือ Rep</span>
          </div>
        </div>

        {/* Card 7: สิทธิบัตรทอง (UC) */}
        <div
          role="button"
          tabIndex={0}
          className={`walkin-card ${cardFilter === 'UC_ONLY' ? 'walkin-card-active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('UC_ONLY')}
        >
          <div className="walkin-card-header">
            <span className="walkin-card-title">สิทธิบัตรทอง (UC)</span>
            <span className="walkin-card-indicator" />
          </div>
          <div className="walkin-card-value">
            {(summary.ucCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="walkin-card-sub">
            <span>คิดเป็น: <strong>{(summary.ucRate ?? 0).toFixed(1)}%</strong> ของทั้งหมด</span>
          </div>
        </div>
      </div>

      {/* 6. Search & Filter Bar */}
      <div className="walkin-filter-bar">
        <div className="walkin-search-box">
          <Search size={16} className="walkin-search-icon" />
          <input
            type="text"
            className="walkin-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ClaimCode, รายการยา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="walkin-search-clear"
              onClick={() => setSearch('')}
              aria-label="ล้างคำค้นหา"
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

        <div className="walkin-filter-info">
          {cardFilter !== 'ALL' && (
            <span className="walkin-active-filter-badge">
              <span>
                กรอง:{' '}
                {cardFilter === 'WITH_AUTHEN'
                  ? 'มี ClaimCode'
                  : cardFilter === 'NO_AUTHEN'
                  ? 'ไม่มี ClaimCode'
                  : cardFilter === 'COMPENSATED'
                  ? 'ชดเชยแล้ว (มี Rep)'
                  : cardFilter === 'INVOICE'
                  ? 'มี Invoice (รอ Rep)'
                  : cardFilter === 'UNSENT'
                  ? 'ยังไม่ส่ง e-Claim'
                  : 'สิทธิบัตรทอง (UC)'}
              </span>
              <button
                type="button"
                onClick={() => setCardFilter('ALL')}
                aria-label="ยกเลิกตัวกรอง"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <span>
            พบทั้งหมด <span className="walkin-count-badge">{totalCount.toLocaleString('th-TH')}</span> รายการ
          </span>
        </div>
      </div>

      {/* 7. Table Card */}
      <div className="walkin-table-card">
        {loading ? (
          <div className="walkin-loading-box">
            <div className="walkin-loading-spinner" />
            <div>กำลังโหลดข้อมูลกองทุน Walkin...</div>
          </div>
        ) : error ? (
          <div className="walkin-error-box">
            <AlertCircle size={32} className="text-red-500" />
            <div className="text-red-700 font-semibold">{error}</div>
            <button
              type="button"
              className="walkin-btn walkin-btn-refresh mt-2"
              onClick={() => fetchData(true)}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="walkin-empty-box">
            <FileText size={36} className="text-gray-400" />
            <div className="font-medium text-gray-700">ไม่พบรายการผู้รับบริการตามเงื่อนไขที่เลือก</div>
            <div className="text-sm text-gray-500">
              ลองเปลี่ยนช่วงเวลาการค้นหา หรือกดล้างตัวกรองด้านบน
            </div>
          </div>
        ) : (
          <div className="walkin-table-container">
            <table className="walkin-table">
              <thead>
                <tr>
                  <th className="col-center" style={{ width: '60px' }}>
                    ลำดับ
                  </th>
                  <th
                    className="col-center sortable"
                    onClick={() => handleSort('vstdate')}
                    style={{ width: '110px' }}
                  >
                    <span className="walkin-sort-th">
                      วันที่รับบริการ
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: '80px' }}>
                    เวลา
                  </th>
                  <th
                    className="col-center sortable"
                    onClick={() => handleSort('hn')}
                    style={{ width: '90px' }}
                  >
                    <span className="walkin-sort-th">
                      HN
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: '130px' }}>
                    เลขบัตรประชาชน
                  </th>
                  <th
                    className="col-center sortable"
                    onClick={() => handleSort('ptname')}
                    style={{ width: '180px' }}
                  >
                    <span className="walkin-sort-th">
                      ชื่อ-สกุล
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </span>
                  </th>
                  <th
                    className="col-center sortable"
                    onClick={() => handleSort('age')}
                    style={{ width: '80px' }}
                  >
                    <span className="walkin-sort-th">
                      อายุ
                      {sortBy === 'age' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: '120px' }}>
                    ClaimCode
                  </th>
                  <th className="col-center" style={{ width: '150px' }}>
                    สิทธิการรักษา
                  </th>
                  <th className="col-left" style={{ minWidth: '220px' }}>
                    รายการยา/บริการ ADP (WALKIN)
                  </th>
                  <th className="col-center" style={{ width: '90px' }}>
                    PDX
                  </th>
                  <th className="col-center" style={{ width: '110px' }}>
                    เลข Rep / Inv
                  </th>
                  <th
                    className="col-right sortable"
                    onClick={() => handleSort('compensated')}
                    style={{ width: '110px' }}
                  >
                    <span className="walkin-sort-th">
                      ชดเชย (บาท)
                      {sortBy === 'compensated' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: '130px' }}>
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.vn}
                    className="walkin-table-row"
                    onClick={() => setSelectedItem(item)}
                    title="คลิกเพื่อดูรายละเอียดเชิงลึก"
                  >
                    <td className="col-center walkin-tabular">{item.no}</td>
                    <td className="col-center walkin-tabular">
                      {formatThaiDate(item.vstdate)}
                    </td>
                    <td className="col-center walkin-tabular">
                      {item.vsttime ? item.vsttime.slice(0, 5) : '—'}
                    </td>
                    <td className="col-center walkin-tabular font-medium">
                      {item.hn}
                    </td>
                    <td className="col-center walkin-tabular font-medium text-gray-700">
                      {item.cid || '—'}
                    </td>
                    <td className="col-center">
                      <span className="walkin-ptname">{item.ptname}</span>
                    </td>
                    <td className="col-center walkin-tabular whitespace-nowrap">
                      {item.age}&nbsp;ปี
                    </td>
                    <td className="col-center">
                      {item.authencode ? (
                        <span className="walkin-authen-badge">{item.authencode}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="col-center">
                      <div className="flex items-center justify-center flex-wrap gap-1">
                        <span>{item.pttypename || '—'}</span>
                        {item.isUc && <span className="walkin-tag-uc">UC</span>}
                      </div>
                    </td>
                    <td className="col-left">
                      <div className="font-medium text-gray-800 line-clamp-2">
                        {item.listname || '—'}
                      </div>
                    </td>
                    <td className="col-center walkin-tabular font-semibold text-emerald-800">
                      {item.pdx || '—'}
                    </td>
                    <td className="col-center walkin-tabular">
                      {item.rep ? (
                        <span className="font-medium text-teal-700">{item.rep}</span>
                      ) : item.invoice ? (
                        <span className="text-emerald-700">{item.invoice}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="col-right walkin-tabular font-semibold">
                      {item.compensated > 0 ? (
                        <span className="text-emerald-700">{formatMoney(item.compensated)}</span>
                      ) : item.invoice_compensated > 0 ? (
                        <span className="text-teal-700">{formatMoney(item.invoice_compensated)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="col-center">
                      {item.isCompensated ? (
                        <span className="walkin-badge walkin-badge-rep">ชดเชยแล้ว</span>
                      ) : item.invoice ? (
                        <span className="walkin-badge walkin-badge-invoice">มี Invoice</span>
                      ) : item.status ? (
                        <span className="walkin-badge walkin-badge-neutral">{item.status}</span>
                      ) : (
                        <span className="walkin-badge walkin-badge-unsent">รอส่ง</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. Pagination */}
        {!loading && !error && items.length > 0 && (
          <div className="walkin-pagination">
            <div className="flex items-center gap-2">
              <span>แสดงแถวละ</span>
              <select
                className="walkin-select text-xs py-1 h-8"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span>
                (หน้า {currentPage} จาก {totalPages})
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="walkin-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                «
              </button>
              <button
                type="button"
                className="walkin-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 walkin-tabular font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="walkin-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="walkin-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="หน้าสุดท้าย"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 9. Record Detail Modal (คลิกที่ record เพื่อเปิด) */}
      {selectedItem && (
        <div
          className="walkin-modal-overlay"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label="รายละเอียดผู้รับบริการ"
        >
          <div
            className="walkin-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="walkin-modal-header">
              <div className="flex items-center gap-2">
                <User size={18} className="text-emerald-700" />
                <h2 className="walkin-modal-title">
                  รายละเอียดผู้รับบริการ: {selectedItem.ptname}
                </h2>
              </div>
              <button
                type="button"
                className="walkin-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <div className="walkin-modal-body">
              {/* Patient Basic Info */}
              <div>
                <h3 className="walkin-modal-section-title">
                  <User size={15} /> ข้อมูลทั่วไปของผู้ป่วย
                </h3>
                <div className="walkin-modal-grid">
                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">HN</span>
                    <div className="flex items-center gap-2">
                      <span className="walkin-modal-val-tabular">{selectedItem.hn}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedItem.hn, 'hn')}
                        className="text-gray-400 hover:text-emerald-700"
                        title="คัดลอก HN"
                      >
                        {copiedField === 'hn' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">เลขบัตรประชาชน (CID)</span>
                    <div className="flex items-center gap-2">
                      <span className="walkin-modal-val-tabular">{selectedItem.cid || '—'}</span>
                      {selectedItem.cid && (
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          className="text-gray-400 hover:text-emerald-700"
                          title="คัดลอก CID"
                        >
                          {copiedField === 'cid' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">ชื่อ - สกุล</span>
                    <span className="walkin-modal-val">{selectedItem.ptname}</span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">เพศ / อายุ / สัญชาติ</span>
                    <span className="walkin-modal-val">
                      {selectedItem.sex || '—'} / {selectedItem.age}&nbsp;ปี / {selectedItem.nation || 'ไทย'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">สิทธิการรักษา</span>
                    <span className="walkin-modal-val">
                      {selectedItem.pttypename} {selectedItem.isUc && '(บัตรทอง/UC)'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">ClaimCode</span>
                    <span className="walkin-modal-val-tabular">
                      {selectedItem.authencode || '— ไม่มี ClaimCode —'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visit Details */}
              <div>
                <h3 className="walkin-modal-section-title">
                  <Building size={15} /> ข้อมูลการรับบริการ (Visit)
                </h3>
                <div className="walkin-modal-grid">
                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">VN / AN</span>
                    <span className="walkin-modal-val-tabular">
                      VN: {selectedItem.vn} {selectedItem.an ? `| AN: ${selectedItem.an}` : ''}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">วันที่และเวลารับบริการ</span>
                    <span className="walkin-modal-val-tabular">
                      {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime || '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">แผนก / คลินิก</span>
                    <span className="walkin-modal-val">
                      {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">ยอดเงินรวม HOSxP (income)</span>
                    <span className="walkin-modal-val-tabular text-emerald-800">
                      {formatMoney(selectedItem.income)} บาท
                    </span>
                  </div>

                  <div className="walkin-modal-item col-span-2">
                    <span className="walkin-modal-label">รายการยา/บริการ ADP (WALKIN)</span>
                    <span className="walkin-modal-val font-semibold text-slate-800">
                      {selectedItem.listname || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Diagnosis & Procedures */}
              <div>
                <h3 className="walkin-modal-section-title">
                  <ShieldCheck size={15} /> การวินิจฉัยและหัตถการ
                </h3>
                <div className="walkin-modal-grid">
                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">การวินิจฉัยหลัก (PDX)</span>
                    <span className="walkin-modal-val-tabular text-emerald-700">
                      {selectedItem.pdx || '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">การวินิจฉัยร่วม (DX0 - DX5)</span>
                    <span className="walkin-modal-val-tabular">
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

                  <div className="walkin-modal-item col-span-2">
                    <span className="walkin-modal-label">หัตถการ (OP0 - OP5)</span>
                    <span className="walkin-modal-val-tabular">
                      {[
                        selectedItem.op0,
                        selectedItem.op1,
                        selectedItem.op2,
                        selectedItem.op3,
                        selectedItem.op4,
                        selectedItem.op5,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Claim & Reimbursement */}
              <div>
                <h3 className="walkin-modal-section-title">
                  <DollarSign size={15} /> ข้อมูลการส่งเคลมและชดเชย (e-Claim / REP)
                </h3>
                <div className="walkin-modal-grid">
                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">เลข Rep</span>
                    <span className="walkin-modal-val-tabular">
                      {selectedItem.rep || '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">ยอดเงินชดเชย (Rep)</span>
                    <span className="walkin-modal-val-tabular text-emerald-700">
                      {selectedItem.compensated > 0
                        ? `${formatMoney(selectedItem.compensated)} บาท`
                        : '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">เลข Invoice</span>
                    <span className="walkin-modal-val-tabular">
                      {selectedItem.invoice || '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">ยอด Invoice</span>
                    <span className="walkin-modal-val-tabular text-teal-700">
                      {selectedItem.invoice_compensated > 0
                        ? `${formatMoney(selectedItem.invoice_compensated)} บาท`
                        : '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">Transaction Type / Subfund</span>
                    <span className="walkin-modal-val">
                      {selectedItem.transactiontype || '—'} / {selectedItem.subfund || '—'}
                    </span>
                  </div>

                  <div className="walkin-modal-item">
                    <span className="walkin-modal-label">Project Code / Resource</span>
                    <span className="walkin-modal-val">
                      {selectedItem.projectcode || '—'} / {selectedItem.resource || '—'}
                    </span>
                  </div>

                  {selectedItem.remark && (
                    <div className="walkin-modal-item col-span-2">
                      <span className="walkin-modal-label">หมายเหตุ (Remark)</span>
                      <span className="walkin-modal-val text-amber-800">
                        {selectedItem.remark}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="walkin-modal-footer">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="walkin-btn walkin-btn-refresh py-1 px-3 text-xs"
                  onClick={() => handleModalNav('prev')}
                >
                  <ChevronLeft size={14} /> ก่อนหน้า
                </button>
                <button
                  type="button"
                  className="walkin-btn walkin-btn-refresh py-1 px-3 text-xs"
                  onClick={() => handleModalNav('next')}
                >
                  ถัดไป <ChevronRight size={14} />
                </button>
              </div>
              <button
                type="button"
                className="walkin-btn walkin-btn-refresh"
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
