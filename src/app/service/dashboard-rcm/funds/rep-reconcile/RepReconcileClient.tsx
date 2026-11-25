'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { formatRepTypeLabel } from '@/lib/clinical/funds-reconcile/fundCatalog'
import type {
  FundCategoryGroup,
  RepReconcileDeptFilter,
  RepReconcileItem,
  RepReconcileResult,
  RepReconcileSortField,
  RepReconcileStatusFilter,
  RepReconcileSummary,
  RepSourceKind,
  VnReconcileDetails,
} from '@/lib/clinical/funds-reconcile/types'
import FundChecklistDrawer from './components/FundChecklistDrawer'
import FundSummaryCards from './components/FundSummaryCards'
import RepDetailModal from './components/RepDetailModal'
import './rep-reconcile.css'

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

const SOURCE_OPTIONS: Array<{ id: RepSourceKind; label: string }> = [
  { id: 'repdata', label: 'REP หลัก (repdata)' },
  { id: 'repeclaim', label: 'e-Claim (repeclaim)' },
  { id: 'seamless', label: 'Seamless (seamless)' },
]

const EMPTY_SUMMARY: RepReconcileSummary = {
  totalLines: 0,
  uniqueRepCount: 0,
  uniqueVisitCount: 0,
  totalIncome: 0,
  totalCompensated: 0,
  totalDiff: 0,
  reimbursementRate: 0,
  seamlessCompensated: 0,
  eclaimCompensated: 0,
  errorCount: 0,
  appealCount: 0,
  pendingRepCount: 0,
  dedupRemovedCount: 0,
  sourceBreakdown: [],
  fundCards: [],
  repTypeBreakdown: [],
}

interface RepReconcileClientProps {
  initialData: RepReconcileResult | null
  initialRange?: { startDate: string; endDate: string }
  initialError?: string | null
}

interface QueryState {
  dateMode: 'custom' | 'month' | 'year'
  fiscalBeYear: string
  month: number
  monthBeYear: number
  ds1: string
  ds2: string
  selectedFundIds: string[]
  focusFundId: string
  selectedSources: RepSourceKind[]
  selectedRepPrefixes: string[]
  department: RepReconcileDeptFilter
  status: RepReconcileStatusFilter
  includePendingRep: boolean
  search: string
  sortBy: RepReconcileSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}

function formatMoney(val: number | null | undefined): string {
  return (val ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function RepReconcileClient({
  initialData,
  initialRange,
  initialError = null,
}: RepReconcileClientProps) {
  const now = useMemo(() => new Date(), [])
  const currentCalYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const defaultFiscalCeYear = currentMonth >= 10 ? currentCalYear + 1 : currentCalYear
  const defaultFiscalBeStr = String(defaultFiscalCeYear + 543)

  const defaultDs1 = initialRange?.startDate || initialData?.range.startDate || `${defaultFiscalCeYear - 1}-10-01`
  const defaultDs2 = initialRange?.endDate || initialData?.range.endDate || `${defaultFiscalCeYear}-09-30`

  const [query, setQuery] = useState<QueryState>({
    dateMode: 'year',
    fiscalBeYear: defaultFiscalBeStr,
    month: currentMonth,
    monthBeYear: currentCalYear + 543,
    ds1: defaultDs1,
    ds2: defaultDs2,
    selectedFundIds: [],
    focusFundId: '',
    selectedSources: [],
    selectedRepPrefixes: [],
    department: 'ALL',
    status: 'ALL',
    includePendingRep: false,
    search: '',
    sortBy: 'admdate',
    sortOrder: 'desc',
    page: 1,
    pageSize: initialData?.pageSize ?? 50,
  })

  const [searchInput, setSearchInput] = useState('')
  const [data, setData] = useState<RepReconcileResult | null>(initialData)
  const [loading, setLoading] = useState<boolean>(!initialData && !initialError)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [isChecklistOpen, setIsChecklistOpen] = useState(false)

  // Lazy Detail Modal State
  const [selectedItem, setSelectedItem] = useState<RepReconcileItem | null>(null)
  const [detailData, setDetailData] = useState<VnReconcileDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const detailCacheRef = useRef<Map<string, VnReconcileDetails>>(new Map())
  const isFirstMount = useRef(true)

  const fiscalYearOptions = useMemo(() => {
    const base = defaultFiscalCeYear + 543
    return [0, 1, 2, 3, 4].map((offset) => String(base - offset))
  }, [defaultFiscalCeYear])

  const monthYearOptions = useMemo(() => {
    const base = currentCalYear + 543
    return [1, 0, -1, -2, -3, -4].map((offset) => base + offset)
  }, [currentCalYear])

  // Debounce search -> atomic state update resetting page to 1
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === query.search) return
    const timer = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search: trimmed, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, query.search])

  const buildSearchParams = useCallback(
    (qState: QueryState, extra?: { exportAll?: boolean; refresh?: boolean }) => {
      const p = new URLSearchParams()
      p.set('ds1', qState.ds1)
      p.set('ds2', qState.ds2)
      p.set('page', String(qState.page))
      p.set('pageSize', String(qState.pageSize))
      p.set('department', qState.department)
      p.set('status', qState.status)
      p.set('sortBy', qState.sortBy)
      p.set('sortOrder', qState.sortOrder)
      if (qState.selectedFundIds.length > 0) p.set('funds', qState.selectedFundIds.join(','))
      if (qState.focusFundId) p.set('focusFundId', qState.focusFundId)
      if (qState.selectedSources.length > 0) p.set('sources', qState.selectedSources.join(','))
      if (qState.selectedRepPrefixes.length > 0) {
        p.set('repPrefixes', qState.selectedRepPrefixes.join(','))
      }
      if (qState.includePendingRep) p.set('includePendingRep', 'true')
      if (qState.search) p.set('search', qState.search)
      if (extra?.exportAll) p.set('exportAll', 'true')
      if (extra?.refresh) p.set('refresh', 'true')
      return p
    },
    []
  )

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (forceRefresh) setIsRefreshing(true)
      setLoading(true)
      setError(null)

      try {
        const params = buildSearchParams(query, { refresh: forceRefresh })
        const res = await fetch(`/api/service/dashboard-rcm/funds/rep-reconcile?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || json.error || 'ไม่สามารถดึงข้อมูลรวม REP ได้')
        }
        setData(json.data)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [buildSearchParams, query]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData(false)
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData, initialData])

  // Atomic date & filter handlers
  const handleDateModeChange = (mode: 'custom' | 'month' | 'year') => {
    setQuery((prev) => {
      let nextDs1 = prev.ds1
      let nextDs2 = prev.ds2
      if (mode === 'year') {
        const ceYear = (parseInt(prev.fiscalBeYear, 10) || defaultFiscalCeYear + 543) - 543
        nextDs1 = `${ceYear - 1}-10-01`
        nextDs2 = `${ceYear}-09-30`
      } else if (mode === 'month') {
        const ceYear = prev.monthBeYear - 543
        const mStr = String(prev.month).padStart(2, '0')
        const lastDay = new Date(ceYear, prev.month, 0).getDate()
        nextDs1 = `${ceYear}-${mStr}-01`
        nextDs2 = `${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`
      }
      return { ...prev, dateMode: mode, ds1: nextDs1, ds2: nextDs2, page: 1 }
    })
  }

  const handleFiscalYearChange = (fiscalBeYear: string) => {
    const ceYear = (parseInt(fiscalBeYear, 10) || defaultFiscalCeYear + 543) - 543
    setQuery((prev) => ({
      ...prev,
      dateMode: 'year',
      fiscalBeYear,
      ds1: `${ceYear - 1}-10-01`,
      ds2: `${ceYear}-09-30`,
      page: 1,
    }))
  }

  const handleMonthChange = (month: number, monthBeYear: number) => {
    const ceYear = monthBeYear - 543
    const mStr = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setQuery((prev) => ({
      ...prev,
      dateMode: 'month',
      month,
      monthBeYear,
      ds1: `${ceYear}-${mStr}-01`,
      ds2: `${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`,
      page: 1,
    }))
  }

  const catalog = data?.availableFundCatalog || []

  const handleToggleFund = (fundId: string) => {
    setQuery((prev) => {
      const allIds = catalog.map((c) => c.id)
      const current = prev.selectedFundIds.length === 0 ? allIds : prev.selectedFundIds
      const exists = current.includes(fundId)
      const next = exists ? current.filter((id) => id !== fundId) : [...current, fundId]
      const normalized = next.length === allIds.length ? [] : next
      const nextFocus =
        prev.focusFundId && normalized.length > 0 && !normalized.includes(prev.focusFundId)
          ? ''
          : prev.focusFundId
      return { ...prev, selectedFundIds: normalized, focusFundId: nextFocus, page: 1 }
    })
  }

  const handleSelectAllFunds = () => {
    setQuery((prev) => ({ ...prev, selectedFundIds: [], page: 1 }))
  }

  const handleSelectFundsWithData = () => {
    const withData = catalog.filter((c) => c.lineCount > 0).map((c) => c.id)
    setQuery((prev) => ({
      ...prev,
      selectedFundIds: withData.length > 0 ? withData : [],
      focusFundId: '',
      page: 1,
    }))
  }

  const handleClearFunds = () => {
    setQuery((prev) => ({ ...prev, selectedFundIds: ['__NONE__'], focusFundId: '', page: 1 }))
  }

  const handleSelectCategory = (category: FundCategoryGroup) => {
    const catIds = catalog.filter((c) => c.category === category).map((c) => c.id)
    setQuery((prev) => ({
      ...prev,
      selectedFundIds: catIds,
      focusFundId: '',
      page: 1,
    }))
  }

  const handleToggleSource = (src: RepSourceKind) => {
    setQuery((prev) => {
      const exists = prev.selectedSources.includes(src)
      const next = exists
        ? prev.selectedSources.filter((s) => s !== src)
        : [...prev.selectedSources, src]
      return { ...prev, selectedSources: next, page: 1 }
    })
  }

  const handleTogglePrefix = (prefix: string) => {
    setQuery((prev) => {
      const exists = prev.selectedRepPrefixes.includes(prefix)
      const next = exists
        ? prev.selectedRepPrefixes.filter((p) => p !== prefix)
        : [...prev.selectedRepPrefixes, prefix]
      return { ...prev, selectedRepPrefixes: next, page: 1 }
    })
  }

  const handleSort = (field: RepReconcileSortField) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    }))
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setQuery({
      dateMode: 'year',
      fiscalBeYear: defaultFiscalBeStr,
      month: currentMonth,
      monthBeYear: currentCalYear + 543,
      ds1: defaultDs1,
      ds2: defaultDs2,
      selectedFundIds: [],
      focusFundId: '',
      selectedSources: [],
      selectedRepPrefixes: [],
      department: 'ALL',
      status: 'ALL',
      includePendingRep: false,
      search: '',
      sortBy: 'admdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  }

  // Lazy Detail Modal Fetch
  const openDetailModal = async (item: RepReconcileItem) => {
    setSelectedItem(item)
    setDetailError(null)
    const cacheKey = item.visitKey
    const cached = detailCacheRef.current.get(cacheKey)
    if (cached) {
      setDetailData(cached)
      setDetailLoading(false)
      return
    }

    detailAbortRef.current?.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller
    setDetailData(null)
    setDetailLoading(true)

    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/rep-reconcile/vn-details?vn=${encodeURIComponent(cacheKey)}`,
        { signal: controller.signal }
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลเชิงลึกของ Visit ได้')
      }
      if (detailCacheRef.current.size >= 50) {
        const firstKey = detailCacheRef.current.keys().next().value
        if (firstKey) detailCacheRef.current.delete(firstKey)
      }
      detailCacheRef.current.set(cacheKey, json.data)
      setDetailData(json.data)
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setDetailError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลเพิ่มเติมได้')
    } finally {
      if (!controller.signal.aborted) {
        setDetailLoading(false)
      }
    }
  }

  const closeDetailModal = () => {
    detailAbortRef.current?.abort()
    setSelectedItem(null)
    setDetailData(null)
    setDetailError(null)
    setDetailLoading(false)
  }

  // Export Excel (.xlsx)
  const fetchExportRows = async (): Promise<RepReconcileItem[]> => {
    const params = buildSearchParams(query, { exportAll: true })
    const res = await fetch(`/api/service/dashboard-rcm/funds/rep-reconcile?${params.toString()}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'ไม่สามารถส่งออกข้อมูลได้')
    }
    return (json.data?.items || []) as RepReconcileItem[]
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const [rows, { exportRcmExcel }] = await Promise.all([
        fetchExportRows(),
        import('@/lib/clinical/rcmExcelExport'),
      ])
      await exportRcmExcel({
        filename: `funds-rep-reconcile-${query.ds1}_to_${query.ds2}.xlsx`,
        sheetName: 'REP_Funds',
        title: 'รายงานรวมข้อมูล REP กองทุน (All Funds REP)',
        subtitle: `ช่วงวันที่ ${query.ds1} ถึง ${query.ds2} · จำนวน ${rows.length.toLocaleString('th-TH')} รายการ`,
        headers: [
          'ลำดับ',
          'VN/AN',
          'ประเภทผู้ป่วย',
          'HN',
          'เลขบัตรประชาชน',
          'ชื่อ-สกุล',
          'วันที่รับบริการ',
          'กองทุน (/funds/*)',
          'เหตุผลจับคู่',
          'เลข REP',
          'ประเภท REP',
          'แหล่งข้อมูล REP',
          'ยอดเรียกเก็บ',
          'ยอดชดเชย',
          'ส่วนต่าง',
          'เลข e-Claim',
          'สถานะ / Error',
        ],
        rows: rows.map((r, idx) => [
          idx + 1,
          r.vn || r.an || '',
          r.department,
          r.hn,
          r.cid,
          r.ptname,
          r.admdateThai,
          r.primaryFundLabel,
          r.matchReason,
          r.rep || '',
          formatRepTypeLabel(r.repPrefix, r.repFund),
          r.matchedSources.join(', '),
          r.income,
          r.compensated,
          r.diff,
          r.eclaimNo || '',
          r.errorCode || r.eclaimStatus || r.status,
        ]),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ส่งออก Excel ไม่สำเร็จ')
    } finally {
      setIsExporting(false)
    }
  }

  const summary = data?.summary || EMPTY_SUMMARY
  const items = data?.items || []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1
  const currentPage = data?.page ?? query.page
  const activeFundCountLabel =
    query.selectedFundIds.length === 0
      ? `ทุกกองทุน (${catalog.length || 26})`
      : query.selectedFundIds[0] === '__NONE__'
      ? '0 กองทุน'
      : `เลือก ${query.selectedFundIds.length}/${catalog.length || 26} กองทุน`

  const topPrefixes = (data?.availableRepPrefixes || []).slice(0, 14)

  return (
    <div className="rcm-reconcile-page">
      {/* Header */}
      <header className="rr-header">
        <div className="rr-header-title-wrap">
          <div className="rr-title-row">
            <h1>รวมข้อมูล REP กองทุน (All Funds REP)</h1>
            <span className="rr-meta-tag">
              3 Sources · {totalCount.toLocaleString('th-TH')} แถว
            </span>
          </div>
        </div>

        <div className="rr-header-actions">
          <button
            type="button"
            className="rr-btn rr-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
          >
            <RefreshCw size={16} strokeWidth={1.5} className={isRefreshing ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
          <button
            type="button"
            className="rr-btn rr-btn-primary"
            onClick={handleExportExcel}
            disabled={isExporting || totalCount === 0}
          >
            <FileSpreadsheet size={16} strokeWidth={1.5} />
            {isExporting ? 'กำลังส่งออก' : 'ส่งออก Excel'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rr-error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="rr-btn rr-btn-secondary rr-btn-sm"
            onClick={() => fetchData(true)}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* Top Filter Bar */}
      <section className="rr-filter-panel" aria-label="ตัวกรองข้อมูล">
        <div className="rr-filter-row">
          {/* Canonical Date Tabs Order: กำหนดเอง | เดือน | ปีงบประมาณ */}
          <div className="rr-segmented" role="tablist" aria-label="โหมดช่วงเวลา">
            <button
              type="button"
              role="tab"
              aria-selected={query.dateMode === 'custom'}
              className={`rr-seg-btn ${query.dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={query.dateMode === 'month'}
              className={`rr-seg-btn ${query.dateMode === 'month' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('month')}
            >
              เดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={query.dateMode === 'year'}
              className={`rr-seg-btn ${query.dateMode === 'year' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('year')}
            >
              ปีงบประมาณ
            </button>
          </div>

          {query.dateMode === 'year' && (
            <div className="rr-control-group">
              <label htmlFor="rr-fy" className="rr-label">
                ปีงบฯ
              </label>
              <select
                id="rr-fy"
                className="rr-select"
                value={query.fiscalBeYear}
                onChange={(e) => handleFiscalYearChange(e.target.value)}
              >
                {fiscalYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {query.dateMode === 'month' && (
            <>
              <select
                aria-label="เลือกเดือน"
                className="rr-select"
                value={query.month}
                onChange={(e) => handleMonthChange(Number(e.target.value), query.monthBeYear)}
              >
                {THAI_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="เลือกปี พ.ศ."
                className="rr-select"
                value={query.monthBeYear}
                onChange={(e) => handleMonthChange(query.month, Number(e.target.value))}
              >
                {monthYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}

          {query.dateMode === 'custom' && (
            <div className="rr-control-group">
              <ThaiDatePicker
                value={query.ds1}
                onChange={(val) => setQuery((prev) => ({ ...prev, ds1: val, page: 1 }))}
                aria-label="วันที่เริ่มต้น"
              />
              <span className="rr-label">ถึง</span>
              <ThaiDatePicker
                value={query.ds2}
                onChange={(val) => setQuery((prev) => ({ ...prev, ds2: val, page: 1 }))}
                aria-label="วันที่สิ้นสุด"
              />
            </div>
          )}

          <button
            type="button"
            className={`rr-btn ${isChecklistOpen || query.selectedFundIds.length > 0 ? 'rr-btn-active' : 'rr-btn-secondary'}`}
            onClick={() => setIsChecklistOpen((o) => !o)}
          >
            <Filter size={16} strokeWidth={1.5} />
            {activeFundCountLabel}
          </button>

          <select
            aria-label="แผนกผู้ป่วย"
            className="rr-select"
            value={query.department}
            onChange={(e) =>
              setQuery((prev) => ({
                ...prev,
                department: e.target.value as RepReconcileDeptFilter,
                page: 1,
              }))
            }
          >
            <option value="ALL">OPD + IPD</option>
            <option value="OP">เฉพาะ OPD</option>
            <option value="IP">เฉพาะ IPD</option>
          </select>

          <select
            aria-label="สถานะการชดเชย"
            className="rr-select"
            value={query.status}
            onChange={(e) =>
              setQuery((prev) => ({
                ...prev,
                status: e.target.value as RepReconcileStatusFilter,
                page: 1,
              }))
            }
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value="COMPENSATED">ชดเชยแล้ว (&gt; 0)</option>
            <option value="UNCOMPENSATED">ไม่ชดเชย / 0 บาท</option>
            <option value="HAS_ERROR">มีรหัส Error</option>
            <option value="APPEAL">อุทธรณ์</option>
            <option value="PENDING_REP">รอตอบรับ REP</option>
          </select>
        </div>

        <div className="rr-filter-row">
          <div className="rr-search-wrap">
            <Search size={16} strokeWidth={1.5} className="rr-search-icon" />
            <input
              type="text"
              className="rr-input rr-search-input"
              placeholder="ค้นหา VN, AN, HN, CID, ชื่อ-สกุล, เลข REP, กองทุน"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="rr-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <label className="rr-toggle-chip">
            <input
              type="checkbox"
              checked={query.includePendingRep}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  includePendingRep: e.target.checked,
                  page: 1,
                }))
              }
            />
            <span>รวมรายการรอ REP จาก e-Claim</span>
          </label>

          <button type="button" className="rr-btn rr-btn-secondary" onClick={handleResetFilters}>
            <RotateCcw size={16} strokeWidth={1.5} />
            รีเซ็ต
          </button>
        </div>

        {/* Source & REP Prefix Quick Filters */}
        <div className="rr-source-strip">
          <span className="rr-label">แหล่งข้อมูล:</span>
          {SOURCE_OPTIONS.map((opt) => {
            const active = query.selectedSources.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                className={`rr-chip ${active ? 'active' : ''}`}
                onClick={() => handleToggleSource(opt.id)}
              >
                <span className={`rr-dot rr-dot-${opt.id}`} />
                {opt.label}
              </button>
            )
          })}

          {topPrefixes.length > 0 && (
            <>
              <span className="rr-label rr-label-spaced">
                ประเภท REP:
              </span>
              {topPrefixes.map((pfx) => {
                const active = query.selectedRepPrefixes.includes(pfx)
                return (
                  <button
                    key={pfx}
                    type="button"
                    className={`rr-chip rr-mono ${active ? 'active' : ''}`}
                    onClick={() => handleTogglePrefix(pfx)}
                  >
                    {pfx}
                  </button>
                )
              })}
            </>
          )}
        </div>
      </section>

      {/* Collapsible Multi-Select Fund Checklist */}
      <FundChecklistDrawer
        isOpen={isChecklistOpen}
        catalog={catalog}
        selectedFundIds={query.selectedFundIds}
        onToggleFund={handleToggleFund}
        onSelectAll={handleSelectAllFunds}
        onSelectWithDataOnly={handleSelectFundsWithData}
        onClearAll={handleClearFunds}
        onSelectCategory={handleSelectCategory}
        onClose={() => setIsChecklistOpen(false)}
      />

      {/* KPI Summary & Per-Fund Cards */}
      <FundSummaryCards
        summary={summary}
        focusedFundId={query.focusFundId}
        onFocusFund={(fundId) => setQuery((prev) => ({ ...prev, focusFundId: fundId, page: 1 }))}
      />

      {/* Statement Line Ledger Table */}
      <section className="rr-table-card" aria-label="ตารางรายการ REP">
        <div className="rr-table-toolbar">
          <div className="rr-table-toolbar-left">
            <h2>
              รายการ REP รายใบ (Statement Lines)
            </h2>
            {query.focusFundId && (
              <button
                type="button"
                className="rr-chip active"
                onClick={() => setQuery((prev) => ({ ...prev, focusFundId: '', page: 1 }))}
              >
                กรองเฉพาะกองทุน: {summary.fundCards.find((c) => c.fundId === query.focusFundId)?.shortLabel || query.focusFundId}
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
          <div className="rr-table-toolbar-right">
            <span className="rr-meta-tag">
              แสดง {items.length.toLocaleString('th-TH')} จาก {totalCount.toLocaleString('th-TH')} รายการ
              {loading ? ' · กำลังโหลด...' : ''}
            </span>
            <div className="rr-control-group">
              <label htmlFor="rr-page-size" className="rr-label">
                แสดงผล
              </label>
              <select
                id="rr-page-size"
                aria-label="จำนวนแสดงผลต่อหน้า"
                className="rr-select rr-select-compact"
                value={query.pageSize}
                onChange={(e) =>
                  setQuery((prev) => ({
                    ...prev,
                    pageSize: Number(e.target.value),
                    page: 1,
                  }))
                }
                disabled={loading}
              >
                <option value={20}>20 รายการ</option>
                <option value={50}>50 รายการ</option>
                <option value={100}>100 รายการ</option>
                <option value={200}>200 รายการ</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rr-table-scroll">
          <table className="rr-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="sortable" onClick={() => handleSort('vn')}>
                  VN / AN <ArrowDownUp size={12} className="rr-sort-icon" />
                </th>
                <th className="sortable" onClick={() => handleSort('ptname')}>
                  HN / ชื่อ-สกุล
                </th>
                <th className="sortable" onClick={() => handleSort('admdate')}>
                  วันที่รับบริการ
                </th>
                <th className="sortable" onClick={() => handleSort('fund')}>
                  กองทุน (/funds/*)
                </th>
                <th className="sortable" onClick={() => handleSort('rep')}>
                  เลข REP
                </th>
                <th>ประเภท REP</th>
                <th className="num sortable" onClick={() => handleSort('income')}>
                  ยอดเรียกเก็บ
                </th>
                <th className="num sortable" onClick={() => handleSort('compensated')}>
                  ยอดชดเชย
                </th>
                <th>สถานะ / Error</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="rr-empty">
                    {loading ? 'กำลังโหลดข้อมูล...' : 'ไม่พบรายการ REP ตามเงื่อนไขที่เลือก'}
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => {
                  const rowNum = (currentPage - 1) * query.pageSize + idx + 1
                  const sourceBadgeClass =
                    row.source === 'seamless'
                      ? 'rr-badge-seamless'
                      : row.source === 'repeclaim'
                      ? 'rr-badge-repeclaim'
                      : row.source === 'repdata'
                      ? 'rr-badge-repdata'
                      : 'rr-badge-source'

                  const statusBadge =
                    row.status === 'pending_rep'
                      ? { cls: 'rr-badge-pending', label: 'รอ REP' }
                      : row.status === 'appeal'
                      ? { cls: 'rr-badge-appeal', label: 'อุทธรณ์' }
                      : row.status === 'denied'
                      ? { cls: 'rr-badge-denied', label: 'ไม่ชดเชย' }
                      : { cls: 'rr-badge-paid', label: 'ชดเชยแล้ว' }

                  return (
                    <tr key={row.id} onClick={() => openDetailModal(row)}>
                      <td className="rr-mono rr-cell-muted">
                        {rowNum}
                      </td>
                      <td>
                        <div className="rr-mono rr-cell-strong">
                          {row.vn || row.an || '—'}
                        </div>
                        <div className="rr-subline">{row.department === 'IP' ? 'IPD' : 'OPD'}</div>
                      </td>
                      <td>
                        <div className="rr-cell-strong">{row.ptname || '—'}</div>
                        <div className="rr-subline rr-mono">
                          HN {row.hn || '—'}
                          {row.cid ? ` · ${row.cid}` : ''}
                        </div>
                      </td>
                      <td>
                        <div>{row.admdateThai || '—'}</div>
                        <div className="rr-subline">{row.mainInscl}</div>
                      </td>
                      <td>
                        <div className="rr-cell-stack">
                          <span className="rr-fund-code-tag">{row.primaryFundCode}</span>
                          <span className="rr-cell-strong">{row.primaryFundLabel}</span>
                        </div>
                        <div className="rr-subline">{row.matchReason}</div>
                      </td>
                      <td>
                        {row.rep ? (
                          <span className="rr-rep-code">{row.rep}</span>
                        ) : (
                          <span className="rr-mono rr-cell-muted">
                            —
                          </span>
                        )}
                        {row.eclaimNo && (
                          <div className="rr-subline rr-mono">e-Claim: {row.eclaimNo}</div>
                        )}
                      </td>
                      <td>
                        <div className="rr-cell-stack">
                          <span className={`rr-badge ${sourceBadgeClass}`}>{row.source}</span>
                          {row.matchedSources.length > 1 && (
                            <span className="rr-subline rr-subline-inline">
                              +{row.matchedSources.length - 1}
                            </span>
                          )}
                        </div>
                        <div className="rr-subline">
                          {formatRepTypeLabel(row.repPrefix, row.repFund)}
                        </div>
                      </td>
                      <td className="num">{formatMoney(row.income)}</td>
                      <td className="num">
                        <div className="rr-cell-comp">
                          {formatMoney(row.compensated)}
                        </div>
                        <div className="rr-subline">
                          {(row.diff ?? 0) >= 0 ? '+' : ''}
                          {formatMoney(row.diff)}
                        </div>
                      </td>
                      <td>
                        <span className={`rr-badge ${statusBadge.cls}`}>{statusBadge.label}</span>
                        {(row.errorCode || row.eclaimStatus) && (
                          <div className="rr-subline">
                            {row.errorCode || row.eclaimStatus}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="rr-pagination">
          <span>
            หน้า {currentPage.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')} (หน้าละ{' '}
            {query.pageSize} แถว)
          </span>
          <div className="rr-page-buttons">
            <button
              type="button"
              className="rr-btn rr-btn-secondary rr-btn-sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
              ก่อนหน้า
            </button>
            <button
              type="button"
              className="rr-btn rr-btn-secondary rr-btn-sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setQuery((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            >
              ถัดไป
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </section>

      <RepDetailModal
        selectedItem={selectedItem}
        details={detailData}
        isLoading={detailLoading}
        error={detailError}
        onClose={closeDetailModal}
      />
    </div>
  )
}
