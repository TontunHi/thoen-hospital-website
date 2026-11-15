'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  X,
  AlertCircle,
  Filter,
  RotateCcw,
} from 'lucide-react'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import {
  REP_DATA_SOURCES,
  type RepDataSource,
  type PatientClaimRecord,
  type RepFundsSummaryMetrics,
  type RepFundsSummaryResult,
} from '@/lib/clinical/rcmRepFundsService'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

export type {
  RepDataSource,
  PatientClaimRecord,
  RepFundsSummaryMetrics,
  RepFundsSummaryResult,
}

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

const UNIVERSAL_PAYER_FUNDS = new Set(['UCS', 'OFC', 'SSS', 'LGO', 'STP'])

const EMPTY_METRICS: RepFundsSummaryMetrics = {
  totalCases: 0,
  totalReps: 0,
  totalIncome: 0,
  totalCompensated: 0,
  rate: '0.0',
  totalDiff: 0,
  pendingAppeals: 0,
  errorCount: 0,
}

export interface RepFundsClientProps {
  initialSummary?: RepFundsSummaryResult | null
  initialCases?: PatientClaimRecord[] | null
  initialRange?: { startDate: string; endDate: string }
}

export default function RepFundsClient({
  initialSummary,
  initialCases,
  initialRange,
}: RepFundsClientProps = {}) {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const defaultFiscalYear = currentMonth >= 10 ? currentCalYear + 1 : currentCalYear
  const defaultFiscalYearStr = String(defaultFiscalYear + 543)

  // Active Data Source Tab: 'repdata' | 'repeclaim' | 'seamless'
  const [activeSource, setActiveSource] = useState<RepDataSource>(
    initialSummary?.source || 'repdata'
  )

  // Date controls: 'custom' | 'month' | 'year'
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(defaultFiscalYearStr)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedMonthYear, setSelectedMonthYear] = useState<number>(currentCalYear + 543)
  const [ds1, setDs1] = useState<string>(
    initialRange?.startDate || `${defaultFiscalYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialRange?.endDate || `${defaultFiscalYear}-09-30`
  )

  // Dimension Filters
  const [selectedFund, setSelectedFund] = useState<string>('ALL')
  const [selectedDept, setSelectedDept] = useState<'ALL' | 'OP' | 'IP'>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [recordLimit, setRecordLimit] = useState<number>(250)

  // Debounce search input (instant clear when empty)
  useEffect(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) {
      setDebouncedSearch('')
      return
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Summary Data States
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(!initialSummary)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<RepFundsSummaryMetrics>(
    initialSummary?.metrics || EMPTY_METRICS
  )
  const [availableYears, setAvailableYears] = useState<string[]>(
    initialSummary?.availableYears || [
      defaultFiscalYearStr,
      String(defaultFiscalYear + 542),
      String(defaultFiscalYear + 541),
      String(defaultFiscalYear + 540),
    ]
  )
  const [availableFunds, setAvailableFunds] = useState<
    Array<{ key: string; label: string; count: number }>
  >(initialSummary?.availableFunds || [])

  // Remember latest case count per source tab as user explores each tab
  const [sourceCaseCounts, setSourceCaseCounts] = useState<Partial<Record<RepDataSource, number>>>(
    () =>
      initialSummary?.metrics
        ? { [initialSummary.source || 'repdata']: initialSummary.metrics.totalCases ?? 0 }
        : {}
  )

  // Cases Table States
  const [statementCases, setStatementCases] = useState<PatientClaimRecord[]>(initialCases || [])
  const [isCasesLoading, setIsCasesLoading] = useState<boolean>(!initialCases)
  const [casesError, setCasesError] = useState<string | null>(null)

  // Single Case Detail Modal
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<PatientClaimRecord | null>(null)

  const activeSourceMeta = useMemo(
    () => REP_DATA_SOURCES.find((s) => s.id === activeSource) || REP_DATA_SOURCES[0],
    [activeSource]
  )

  // Ensure select value always exists in options even if a source doesn't have rows for selected year yet
  const yearSelectOptions = useMemo(() => {
    if (availableYears.includes(selectedFiscalYear)) return availableYears
    return [selectedFiscalYear, ...availableYears]
  }, [availableYears, selectedFiscalYear])

  // Available Calendar Years for Month Mode (Buddhist Era)
  const availableMonthYears = useMemo(() => {
    const list: number[] = []
    const currentBe = currentCalYear + 543
    for (let y = currentBe + 1; y >= currentBe - 5; y--) {
      list.push(y)
    }
    return list
  }, [currentCalYear])

  // Handle Date Mode Changes
  const handleModeChange = (mode: 'custom' | 'month' | 'year') => {
    setDateMode(mode)
    if (mode === 'year') {
      const beYear = parseInt(selectedFiscalYear, 10) || defaultFiscalYear + 543
      const ceYear = beYear - 543
      setDs1(`${ceYear - 1}-10-01`)
      setDs2(`${ceYear}-09-30`)
    } else if (mode === 'month') {
      const ceYear = selectedMonthYear - 543
      const mStr = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mStr}-01`)
      setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    }
  }

  const handleSelectFiscalYear = (yearStr: string) => {
    setSelectedFiscalYear(yearStr)
    const beYear = parseInt(yearStr, 10)
    if (!isNaN(beYear)) {
      const ceYear = beYear - 543
      setDs1(`${ceYear - 1}-10-01`)
      setDs2(`${ceYear}-09-30`)
    }
  }

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month)
    const ceYear = selectedMonthYear - 543
    const mStr = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleSelectMonthYear = (beYear: number) => {
    setSelectedMonthYear(beYear)
    const ceYear = beYear - 543
    const mStr = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleSelectSource = (source: RepDataSource) => {
    if (source === activeSource) return
    setActiveSource(source)
    setSelectedCaseDetail(null)
    // Preserve universal payer filters (UCS/OFC/SSS/LGO/STP); reset source-specific fund names
    if (selectedFund !== 'ALL' && !UNIVERSAL_PAYER_FUNDS.has(selectedFund)) {
      setSelectedFund('ALL')
    }
  }

  // Request Cancellation & Mount Guards
  const abortSummaryRef = useRef<AbortController | null>(null)
  const abortCasesRef = useRef<AbortController | null>(null)
  const isFirstMountSummary = useRef(true)
  const isFirstMountCases = useRef(true)

  const buildQueryParams = useCallback(
    (includeLimit = false) => {
      const q = new URLSearchParams()
      q.set('source', activeSource)
      if (dateMode === 'year') {
        if (selectedFiscalYear) q.set('fiscalYear', selectedFiscalYear)
      } else {
        if (ds1) q.set('ds1', ds1)
        if (ds2) q.set('ds2', ds2)
      }
      if (selectedDept && selectedDept !== 'ALL') q.set('department', selectedDept)
      if (selectedFund && selectedFund !== 'ALL') q.set('fund', selectedFund)
      if (selectedStatus && selectedStatus !== 'ALL') q.set('status', selectedStatus)
      if (debouncedSearch) q.set('search', debouncedSearch)
      if (includeLimit) q.set('limit', String(recordLimit))
      return q
    },
    [
      activeSource,
      dateMode,
      selectedFiscalYear,
      ds1,
      ds2,
      selectedDept,
      selectedFund,
      selectedStatus,
      debouncedSearch,
      recordLimit,
    ]
  )

  // 1. Fetch Summary KPI Metrics & Fund Dropdown Options
  const fetchSummaryData = useCallback(async () => {
    abortSummaryRef.current?.abort()
    const controller = new AbortController()
    abortSummaryRef.current = controller

    setIsLoadingSummary(true)
    setSummaryError(null)

    try {
      const q = buildQueryParams(false)
      const res = await fetch(`/api/service/dashboard-rcm/rep-funds?${q.toString()}`, {
        signal: controller.signal,
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      const nextMetrics: RepFundsSummaryMetrics = json.metrics || EMPTY_METRICS
      setMetrics(nextMetrics)
      setSourceCaseCounts((prev) => ({
        ...prev,
        [activeSource]: nextMetrics.totalCases ?? 0,
      }))
      if (Array.isArray(json.availableYears) && json.availableYears.length > 0) {
        setAvailableYears(json.availableYears)
      }
      setAvailableFunds(Array.isArray(json.availableFunds) ? json.availableFunds : [])
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setSummaryError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลสรุป Rep ได้')
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingSummary(false)
      }
    }
  }, [activeSource, buildQueryParams])

  // 2. Fetch Statement Cases for Active Data Source
  const fetchStatementCases = useCallback(async () => {
    abortCasesRef.current?.abort()
    const controller = new AbortController()
    abortCasesRef.current = controller

    setIsCasesLoading(true)
    setCasesError(null)

    try {
      const q = buildQueryParams(true)
      const res = await fetch(`/api/service/dashboard-rcm/rep-funds/cases?${q.toString()}`, {
        signal: controller.signal,
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      setStatementCases(json.cases || [])
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setCasesError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการข้อมูลเคสใน Rep ได้')
    } finally {
      if (!controller.signal.aborted) {
        setIsCasesLoading(false)
      }
    }
  }, [buildQueryParams])

  useEffect(() => {
    if (isFirstMountSummary.current) {
      isFirstMountSummary.current = false
      if (initialSummary) return
    }
    fetchSummaryData()
    return () => {
      abortSummaryRef.current?.abort()
    }
  }, [fetchSummaryData, initialSummary])

  useEffect(() => {
    if (isFirstMountCases.current) {
      isFirstMountCases.current = false
      if (initialCases) return
    }
    fetchStatementCases()
    return () => {
      abortCasesRef.current?.abort()
    }
  }, [fetchStatementCases, initialCases])

  // Escape key handler for Case Detail modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCaseDetail) {
        setSelectedCaseDetail(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCaseDetail])

  const hasActiveFilters =
    selectedFund !== 'ALL' ||
    selectedDept !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    Boolean(searchTerm.trim())

  const handleCardFilter = (statusValue: string) => {
    setSelectedStatus((prev) =>
      statusValue === 'ALL' ? 'ALL' : prev === statusValue ? 'ALL' : statusValue
    )
  }

  const handleResetFilters = () => {
    const targetFiscal = availableYears[0] || defaultFiscalYearStr
    setDateMode('year')
    setSelectedFiscalYear(targetFiscal)
    const beYear = parseInt(targetFiscal, 10) || defaultFiscalYear + 543
    const ceYear = beYear - 543
    setDs1(`${ceYear - 1}-10-01`)
    setDs2(`${ceYear}-09-30`)
    setSelectedMonth(today.getMonth() + 1)
    setSelectedMonthYear(today.getFullYear() + 543)
    setSelectedFund('ALL')
    setSelectedDept('ALL')
    setSelectedStatus('ALL')
    setSearchTerm('')
  }

  // Export Excel (.xlsx) scoped to active data source tab
  const handleExportExcel = async () => {
    const timeframeTag = dateMode === 'year' ? `FY${selectedFiscalYear}` : `${ds1}_to_${ds2}`
    const isSeamless = activeSource === 'seamless'

    const headers = isSeamless
      ? [
          'เลขที่ใบ REP',
          'HN',
          'ชื่อ-สกุลคนไข้',
          'วันที่รับบริการ',
          'แผนก',
          'กองทุน Seamless',
          'ประเภทรายการ',
          'สิทธิ (MainInscl)',
          'ยอดขอเบิก (บาท)',
          'เงินชดเชย (บาท)',
          'ส่วนต่าง (บาท)',
          'อัตราชดเชย (%)',
          'สถานะ Seamless',
          'เลขที่ใบโอน (PayNo)',
          'วันที่โอน',
          'ไม่ชดเชย (บาท)',
          'จ่ายเพิ่ม (บาท)',
          'เรียกคืน (บาท)',
          'หมายเหตุ / Deny Code',
        ]
      : [
          'เลขที่ใบ REP',
          'เลขประจำตัว (HN)',
          'ชื่อ-สกุลคนไข้',
          'วันที่รับบริการ',
          'แผนก',
          'กองทุน',
          'ค่ารักษาจริง (บาท)',
          'เงินชดเชย (บาท)',
          'ส่วนต่าง (บาท)',
          'อัตราชดเชย (%)',
          'สถานะ',
          'รหัส Error',
        ]

    const rows = statementCases.map((c) =>
      isSeamless
        ? [
            c.rep,
            c.hn,
            c.ptName,
            c.serviceDateThai,
            c.departmentLabel,
            c.fundLabel,
            c.subFundLabel,
            c.mainInscl,
            c.income,
            c.compensated,
            c.diff,
            `${c.percentPay}%`,
            c.seamlessStatus || (c.compensated > 0 ? 'ชดเชย' : 'ไม่ชดเชย'),
            c.payNo || '',
            c.payDateThai || '',
            c.noCompensated ?? 0,
            c.payMore ?? 0,
            c.recall ?? 0,
            c.errorCode || '',
          ]
        : [
            c.rep,
            c.hn,
            c.ptName,
            c.serviceDateThai,
            c.departmentLabel,
            c.fundLabel,
            c.income,
            c.compensated,
            c.diff,
            `${c.percentPay}%`,
            c.compensated > 0 ? 'ได้รับชดเชย' : 'ไม่ได้รับชดเชย',
            c.errorCode || '',
          ]
    )

    await exportRcmExcel({
      filename: `rep-${activeSource}-${timeframeTag}.xlsx`,
      title: `3.1.1 ข้อมูล Rep แต่ละกองทุน (${activeSourceMeta.label})`,
      subtitle: `แหล่งข้อมูล: ${activeSourceMeta.tableName} | ช่วงเวลา: ${timeframeTag} | โรงพยาบาลเถิน`,
      headers,
      rows,
    })
  }

  const isSeamless = activeSource === 'seamless'

  return (
    <div className="rep-funds-container">
      {/* 1. Header */}
      <header className="rep-header">
        <div className="rep-header-top">
          <div className="rep-title-group">
            <div className="rep-title-row">
              <h1>3.1.1 ข้อมูล Rep แต่ละกองทุน</h1>
              <span className="rep-meta-count">
                {activeSourceMeta.tableName} · {(metrics.totalCases ?? 0).toLocaleString('th-TH')} เคส ·{' '}
                {(metrics.totalReps ?? 0).toLocaleString('th-TH')} ใบ REP
              </span>
            </div>
            <p className="rep-subtitle">
              ตรวจสอบการชดเชยค่าบริการทางการแพทย์ครบทั้ง 3 แหล่งข้อมูล ({REP_DATA_SOURCES.map((s) => s.tableName).join(', ')}) รวมหลาย Rep และหลาย HN ในที่เดียว คลิกที่แถวเพื่อดูรายละเอียดเคสได้ทันที
            </p>
          </div>

          <div className="rep-header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                fetchSummaryData()
                fetchStatementCases()
              }}
            >
              <RefreshCw
                size={16}
                strokeWidth={1.5}
                className={isLoadingSummary || isCasesLoading ? 'spin-icon' : ''}
              />
              รีเฟรชข้อมูล
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportExcel}
              title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
            >
              <Download size={16} strokeWidth={1.5} />
              ส่งออก Excel
            </button>
          </div>
        </div>
      </header>

      {/* 2. Summary KPI Cards (Numbers-first, Clickable Filters) */}
      <section className="summary-bar" aria-label="แถบสรุปยอดรวมตามแหล่งข้อมูลและช่วงเวลา">
        <button
          type="button"
          className={`card-surface metric-card ${selectedStatus === 'ALL' ? 'is-active' : ''}`}
          aria-pressed={selectedStatus === 'ALL'}
          onClick={() => handleCardFilter('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <span className="metric-label">
            {isSeamless ? 'ยอดขอเบิก Seamless รวม' : 'ค่ารักษาพยาบาลจริงรวม'}
          </span>
          <span className="metric-value">
            {(metrics.totalIncome ?? 0).toLocaleString('th-TH', {
              minimumFractionDigits: 2,
            })}
          </span>
          <span className="metric-sub">
            {isSeamless ? 'ยอดเงินส่งขอเบิก (Collected) (บาท)' : 'ยอดบันทึกจริงในระบบ HOSxP (บาท)'}
          </span>
        </button>

        <button
          type="button"
          className={`card-surface metric-card ${selectedStatus === 'paid' ? 'is-active' : ''}`}
          aria-pressed={selectedStatus === 'paid'}
          onClick={() => handleCardFilter('paid')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับเงินชดเชย"
        >
          <span className="metric-label">
            {isSeamless ? 'ยอดเงินชดเชย Seamless รวม' : 'ยอดเงินชดเชย สปสช. รวม'}
          </span>
          <span className="metric-value metric-value-primary">
            {(metrics.totalCompensated ?? 0).toLocaleString('th-TH', {
              minimumFractionDigits: 2,
            })}
          </span>
          <span className="metric-sub">ยอดเงินที่ได้รับโอนชดเชยจริง (บาท)</span>
        </button>

        <button
          type="button"
          className={`card-surface metric-card ${selectedStatus === 'denied' ? 'is-active' : ''}`}
          aria-pressed={selectedStatus === 'denied'}
          onClick={() => handleCardFilter('denied')}
          title="คลิกเพื่อกรองรายการที่ไม่ได้รับชดเชย (0 บาท)"
        >
          <span className="metric-label">อัตราการชดเชยเฉลี่ย</span>
          <span className="metric-value">{metrics.rate ?? '0.0'}%</span>
          <span className="metric-sub">
            {isSeamless ? 'สัดส่วนเงินชดเชยเทียบยอดขอเบิก' : 'สัดส่วนเงินชดเชยเทียบกับค่ารักษาจริง'}
          </span>
        </button>

        <button
          type="button"
          className={`card-surface metric-card ${selectedStatus === 'appeal' ? 'is-active' : ''}`}
          aria-pressed={selectedStatus === 'appeal'}
          onClick={() => handleCardFilter('appeal')}
          title="คลิกเพื่อกรองเคสที่ชดเชยต่ำกว่ายอดเรียกเก็บ / รออุทธรณ์"
        >
          <span className="metric-label">ส่วนต่างรายรับสุทธิ</span>
          <span
            className={`metric-value ${
              (metrics.totalDiff ?? 0) < 0 ? 'metric-value-danger' : 'metric-value-success'
            }`}
          >
            {(metrics.totalDiff ?? 0).toLocaleString('th-TH', {
              minimumFractionDigits: 2,
            })}
          </span>
          <span className="metric-sub">
            {(metrics.totalDiff ?? 0) < 0
              ? 'ส่วนขาด / ยังไม่ได้รับการชดเชย'
              : 'ส่วนเกินรายรับ (บาท)'}
          </span>
        </button>

        <button
          type="button"
          className={`card-surface metric-card ${
            selectedStatus === 'has_error' ? 'is-active' : ''
          }`}
          aria-pressed={selectedStatus === 'has_error'}
          onClick={() => handleCardFilter('has_error')}
          title="คลิกเพื่อกรองเฉพาะเคสที่ติดรหัส Error / Deny Code"
        >
          <span className="metric-label">
            {isSeamless ? 'ชดเชยไม่ครบ / ติด Deny Code' : 'เคสรออุทธรณ์ / ติด Error'}
          </span>
          <span
            className={`metric-value ${
              (metrics.pendingAppeals ?? 0) > 0 || (metrics.errorCount ?? 0) > 0
                ? 'metric-value-warning'
                : ''
            }`}
          >
            {(isSeamless ? metrics.errorCount : metrics.pendingAppeals) ?? 0} เคส
          </span>
          <span className="metric-sub">
            {isSeamless
              ? `ชดเชยไม่ครบ ${(metrics.pendingAppeals ?? 0).toLocaleString('th-TH')} เคส · Deny/Note ${(metrics.errorCount ?? 0).toLocaleString('th-TH')}`
              : `Error ${metrics.errorCount ?? 0} เคส · รอส่งหลักฐานเพิ่ม`}
          </span>
        </button>
      </section>

      {/* 3. Data Source Tabs + Filters + Main Table */}
      <section className="card-surface main-dashboard-card" aria-labelledby="table-heading">
        {/* Top Bar: 3 Data Source Sub-Tabs & Timeframe Selector */}
        <div className="card-tabs-header">
          <div className="view-tabs" role="tablist" aria-label="เลือกแหล่งข้อมูล REP">
            {REP_DATA_SOURCES.map((src) => {
              const isSelected = activeSource === src.id
              const badgeCount = isSelected
                ? (metrics.totalCases ?? statementCases.length)
                : sourceCaseCounts[src.id]
              return (
                <button
                  key={src.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`view-tab-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectSource(src.id)}
                  title={`${src.tableName}: ${src.description}`}
                >
                  <span>{src.label}</span>
                  {badgeCount !== undefined && (
                    <span className="tab-badge">{badgeCount.toLocaleString('th-TH')}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Timeframe Controls */}
          <div className="date-controls-row">
            <div className="rcm-button-group" role="tablist" aria-label="รูปแบบช่วงเวลา">
              <button
                type="button"
                role="tab"
                aria-selected={dateMode === 'custom'}
                onClick={() => handleModeChange('custom')}
                className={`rcm-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
              >
                กำหนดเอง
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dateMode === 'month'}
                onClick={() => handleModeChange('month')}
                className={`rcm-mode-btn ${dateMode === 'month' ? 'active' : ''}`}
              >
                รายเดือน
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dateMode === 'year'}
                onClick={() => handleModeChange('year')}
                className={`rcm-mode-btn ${dateMode === 'year' ? 'active' : ''}`}
              >
                รายปีงบประมาณ
              </button>
            </div>

            <div className="contextual-date-inputs">
              {dateMode === 'year' && (
                <div className="date-input-pair">
                  <select
                    className="filter-select compact-select"
                    value={selectedFiscalYear}
                    onChange={(e) => handleSelectFiscalYear(e.target.value)}
                    aria-label="1. เลือกปีงบประมาณ"
                    title="1. เลือกปีงบประมาณ"
                  >
                    {yearSelectOptions.map((yr) => (
                      <option key={yr} value={yr}>
                        ปีงบประมาณ {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dateMode === 'month' && (
                <div className="date-input-pair">
                  <select
                    className="filter-select compact-select"
                    value={selectedMonth}
                    onChange={(e) => handleSelectMonth(Number(e.target.value))}
                    aria-label="เลือกเดือน"
                    title="เลือกเดือน"
                  >
                    {THAI_MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-select compact-select"
                    value={selectedMonthYear}
                    onChange={(e) => handleSelectMonthYear(Number(e.target.value))}
                    aria-label="เลือกปี พ.ศ."
                    title="เลือกปี พ.ศ."
                  >
                    {availableMonthYears.map((yr) => (
                      <option key={yr} value={yr}>
                        พ.ศ. {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dateMode === 'custom' && (
                <div className="date-input-pair custom-range-wrap">
                  <div className="date-picker-wrap">
                    <span className="date-label">ตั้งแต่วันที่:</span>
                    <ThaiDatePicker
                      value={ds1}
                      onChange={setDs1}
                      maxDate={ds2}
                      aria-label="ตั้งแต่วันที่"
                    />
                  </div>
                  <div className="date-picker-wrap">
                    <span className="date-label">ถึงวันที่:</span>
                    <ThaiDatePicker
                      value={ds2}
                      onChange={setDs2}
                      minDate={ds1}
                      aria-label="ถึงวันที่"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fetchSummaryData()
                      fetchStatementCases()
                    }}
                    disabled={isLoadingSummary || isCasesLoading}
                    className="btn-fetch-range"
                    title="ดึงข้อมูลตามช่วงวันที่ระบุ"
                  >
                    <Filter size={16} strokeWidth={1.5} />
                    <span>ดึงข้อมูล</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dimension Filters & Search Toolbar */}
        <div className="toolbar-section">
          <div className="dimension-filters-row">
            <div className="filter-group">
              <h2 id="table-heading" className="sr-only">
                ตัวกรองข้อมูล Rep และกองทุน เรียงจากระดับใหญ่ไปเล็ก
              </h2>

              {/* 2. กองทุนหลัก (Main Fund - Payer / Seamless Fund) */}
              <select
                className="filter-select"
                value={selectedFund}
                onChange={(e) => setSelectedFund(e.target.value)}
                aria-label="2. เลือกกองทุนหลัก"
                title="2. กองทุนหลัก"
              >
                <option value="ALL">กองทุนหลัก: ทั้งหมด</option>
                <option value="UCS">บัตรทอง (UCS รวม)</option>
                <option value="OFC">ข้าราชการ (OFC/CS รวม)</option>
                <option value="SSS">ประกันสังคม (SSS รวม)</option>
                <option value="LGO">อปท. (LGO รวม)</option>
                <option value="STP">สถานะและสิทธิ (STP)</option>
                {availableFunds.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* 4. แผนกบริการ (Department - Service Venue) */}
              <select
                className="filter-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as 'ALL' | 'OP' | 'IP')}
                aria-label="4. เลือกแผนกบริการ"
                title="4. แผนกบริการ"
              >
                <option value="ALL">แผนก: ทั้งหมด</option>
                <option value="OP">ผู้ป่วยนอก (OPD)</option>
                <option value="IP">ผู้ป่วยใน (IPD)</option>
              </select>

              {/* 5. สถานะการชดเชย (Reimbursement Status) */}
              <select
                className="filter-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                aria-label="5. เลือกสถานะการชดเชย"
                title="5. สถานะการชดเชย"
              >
                <option value="ALL">สถานะการชดเชย: ทั้งหมด</option>
                <option value="paid">ได้รับเงินชดเชย (Compensated &gt; 0)</option>
                <option value="denied">ไม่ได้รับชดเชย (0 บาท)</option>
                <option value="appeal">ชดเชยไม่ครบ / รออุทธรณ์</option>
                <option value="has_error">
                  {isSeamless ? 'มีรหัส Deny / Note' : 'มีรหัส Error Code'}
                </option>
              </select>

              {/* Limit selector for statement cases */}
              <select
                className="filter-select"
                value={recordLimit}
                onChange={(e) => setRecordLimit(Number(e.target.value))}
                aria-label="เลือกจำนวนรายการที่แสดง"
                title="จำนวนรายการที่แสดง"
              >
                <option value={100}>แสดง 100 รายการ</option>
                <option value={250}>แสดง 250 รายการ</option>
                <option value={500}>แสดง 500 รายการ</option>
                <option value={1000}>แสดง 1,000 รายการ</option>
                <option value={5000}>แสดง 5,000 รายการ</option>
                <option value={0}>แสดงทั้งหมด (ไม่จำกัด)</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-reset-inline"
                  onClick={handleResetFilters}
                  title="ล้างตัวกรองทั้งหมด"
                >
                  <RotateCcw size={16} strokeWidth={1.5} />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>

            {/* 6. ช่องค้นหาเฉพาะเจาะจง (Search: Rep, HN, Name, Error) */}
            <div className="search-input-wrapper">
              <Search size={16} strokeWidth={1.5} className="search-input-icon" aria-hidden="true" />
              <input
                type="text"
                className="search-input"
                placeholder={
                  isSeamless
                    ? 'ค้นหาเลข Rep, HN, ชื่อคนไข้, PayNo, Deny Code...'
                    : 'ค้นหาเลข Rep, HN, ชื่อคนไข้, Error...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="6. ค้นหาเลข Rep, HN, ชื่อคนไข้, หรือรหัส Error"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Unified Rep Statements Data Table for Active Source */}
        <div>
          {(summaryError || casesError) && (
            <div className="empty-state">
              <AlertCircle size={24} strokeWidth={1.5} className="error-icon" />
              <span className="empty-state-title error-text">
                เกิดข้อผิดพลาดในการโหลดข้อมูลจาก {activeSourceMeta.tableName}
              </span>
              <span>{casesError || summaryError}</span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  fetchSummaryData()
                  fetchStatementCases()
                }}
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          )}

          {!casesError && isCasesLoading ? (
            <div className="loading-box">
              <div className="spinner" />
              <span>กำลังดึงข้อมูลจากตาราง {activeSourceMeta.tableName}...</span>
            </div>
          ) : !casesError ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขที่ใบ REP</th>
                    <th>เลขประจำตัว (HN)</th>
                    <th>ชื่อ-สกุลคนไข้</th>
                    <th>วันที่รับบริการ</th>
                    <th>แผนก</th>
                    <th>{isSeamless ? 'กองทุน / สิทธิ' : 'กองทุน'}</th>
                    <th className="num-col">
                      {isSeamless ? 'ยอดขอเบิก (บาท)' : 'ค่ารักษาจริง (บาท)'}
                    </th>
                    <th className="num-col">เงินชดเชยที่ได้ (บาท)</th>
                    <th className="num-col">ส่วนต่าง (บาท)</th>
                    <th className="num-col">อัตราชดเชย</th>
                    <th>{isSeamless ? 'สถานะ / Deny Code' : 'สถานะ / Error Code'}</th>
                  </tr>
                </thead>
                <tbody>
                  {statementCases.length > 0 ? (
                    statementCases.map((record) => (
                      <tr
                        key={`${activeSource}_${record.id}`}
                        className="clickable-row"
                        tabIndex={0}
                        aria-label={`คลิกเพื่อดูรายละเอียดเคส HN ${record.hn} ในใบ REP ${record.rep}`}
                        title="คลิกที่แถวเพื่อดูรายละเอียดเคสนี้"
                        onClick={() => setSelectedCaseDetail(record)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedCaseDetail(record)
                          }
                        }}
                      >
                        <td className="rep-code-cell">{record.rep || '—'}</td>
                        <td className="hn-cell">{record.hn || '—'}</td>
                        <td className="ptname-cell">{record.ptName || '—'}</td>
                        <td className="date-cell">{record.serviceDateThai}</td>
                        <td>
                          <span className="dept-tag">
                            {record.department === 'IP' ? 'IPD' : 'OPD'}
                          </span>
                        </td>
                        <td className="fund-cell">
                          <div>{record.fundLabel}</div>
                          {isSeamless && record.mainInscl && (
                            <span className="muted-dash" style={{ fontSize: '11px' }}>
                              สิทธิ: {record.mainInscl}
                            </span>
                          )}
                        </td>
                        <td className="num-col">
                          {(record.income ?? 0).toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="num-col amount-compensated">
                          {(record.compensated ?? 0).toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`num-col ${
                            record.diff < 0 ? 'amount-negative' : 'amount-positive'
                          }`}
                        >
                          {(record.diff ?? 0).toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="num-col rate-cell">{record.percentPay}%</td>
                        <td>
                          <div className="badge-group">
                            {record.compensated > 0 ? (
                              <span className="status-badge success">
                                {record.seamlessStatus || 'ได้รับชดเชย'}
                              </span>
                            ) : (
                              <span className="status-badge danger">
                                {record.seamlessStatus || 'ไม่ได้รับชดเชย (0 บาท)'}
                              </span>
                            )}
                            {record.errorCode && (
                              <span className="status-badge warning" title={record.errorCode}>
                                {isSeamless ? record.errorCode : `Error ${record.errorCode}`}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11}>
                        <div className="empty-state">
                          <span className="empty-state-title">
                            ไม่พบข้อมูลใน {activeSourceMeta.tableName} ตามเงื่อนไขที่เลือก
                          </span>
                          <span>
                            ลองเปลี่ยนปีงบประมาณ ช่วงวันที่ กองทุน หรือคำค้นหาใหม่
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {statementCases.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={6}>
                        แสดง {statementCases.length.toLocaleString('th-TH')} รายการ จาก{' '}
                        {activeSourceMeta.tableName} (คลิกที่แถวเพื่อดูรายละเอียด)
                      </td>
                      <td className="num-col">
                        {statementCases
                          .reduce((s, c) => s + (c.income ?? 0), 0)
                          .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="num-col amount-compensated">
                        {statementCases
                          .reduce((s, c) => s + (c.compensated ?? 0), 0)
                          .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="num-col">
                        {statementCases
                          .reduce((s, c) => s + (c.diff ?? 0), 0)
                          .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {/* 4. Single Case Detail Modal */}
      {selectedCaseDetail && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCaseDetail(null)
          }}
        >
          <div className="modal-dialog" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <div>
                <h3 id="case-detail-title">
                  รายละเอียดเคส: {selectedCaseDetail.ptName} (HN: {selectedCaseDetail.hn})
                </h3>
                <p className="modal-subtitle">
                  แหล่งข้อมูล: {REP_DATA_SOURCES.find((s) => s.id === (selectedCaseDetail.source || activeSource))?.tableName} · ใบแจ้งผล REP: {selectedCaseDetail.rep} ·{' '}
                  {selectedCaseDetail.departmentLabel} · {selectedCaseDetail.serviceDateThai}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCaseDetail(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="modal-body">
              <div className="case-detail-card">
                <div className="case-detail-section">
                  <span className="case-detail-section-title">ข้อมูลผู้ป่วยและบริการ</span>
                  <div className="case-detail-grid">
                    <div className="result-item">
                      <span className="result-label">ชื่อ-สกุลคนไข้</span>
                      <span className="result-value">{selectedCaseDetail.ptName}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">เลขประจำตัวผู้ป่วย (HN)</span>
                      <span className="result-value accent-primary font-mono">
                        {selectedCaseDetail.hn}
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">วันที่รับบริการ</span>
                      <span className="result-value">{selectedCaseDetail.serviceDateThai}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">แผนกบริการ</span>
                      <span className="result-value">{selectedCaseDetail.departmentLabel}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">เลขที่ใบแจ้งผล (REP)</span>
                      <span className="result-value accent-primary font-mono">
                        {selectedCaseDetail.rep}
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">กองทุน / สิทธิ</span>
                      <span className="result-value">
                        {selectedCaseDetail.fundLabel} ({selectedCaseDetail.mainInscl})
                      </span>
                    </div>
                    {selectedCaseDetail.subFund && selectedCaseDetail.subFund !== '-' && (
                      <div className="result-item">
                        <span className="result-label">
                          {selectedCaseDetail.source === 'seamless'
                            ? 'ประเภทรายการ (Type)'
                            : 'กองทุนย่อย / รายการ'}
                        </span>
                        <span className="result-value">{selectedCaseDetail.subFundLabel}</span>
                      </div>
                    )}
                    {selectedCaseDetail.projectCode && (
                      <div className="result-item">
                        <span className="result-label">รหัสโครงการ (Project Code)</span>
                        <span className="result-value">{selectedCaseDetail.projectCode}</span>
                      </div>
                    )}
                    {(selectedCaseDetail.vn || selectedCaseDetail.an) && (
                      <div className="result-item">
                        <span className="result-label">VN / AN</span>
                        <span className="result-value font-mono">
                          {selectedCaseDetail.vn || selectedCaseDetail.an}
                        </span>
                      </div>
                    )}
                    {selectedCaseDetail.eclaimNo && (
                      <div className="result-item">
                        <span className="result-label">E-Claim No</span>
                        <span className="result-value font-mono">
                          {selectedCaseDetail.eclaimNo}
                        </span>
                      </div>
                    )}
                    {selectedCaseDetail.fileName && (
                      <div className="result-item">
                        <span className="result-label">ไฟล์ที่นำเข้า</span>
                        <span className="result-value font-mono">{selectedCaseDetail.fileName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="case-detail-section">
                  <span className="case-detail-section-title">ข้อมูลการเงินและผลการชดเชย</span>
                  <div className="case-detail-grid">
                    <div className="result-item">
                      <span className="result-label">
                        {selectedCaseDetail.source === 'seamless'
                          ? 'ยอดขอเบิก (Collected)'
                          : 'ค่ารักษาจริง รพ.'}
                      </span>
                      <span className="result-value">
                        {(selectedCaseDetail.income ?? 0).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        บาท
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">เงินที่ได้รับการชดเชย</span>
                      <span className="result-value text-success">
                        {(selectedCaseDetail.compensated ?? 0).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        บาท
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">ส่วนต่างรายรับสุทธิ</span>
                      <span
                        className={`result-value ${
                          selectedCaseDetail.diff < 0 ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {(selectedCaseDetail.diff ?? 0).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        บาท
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">อัตราชดเชย (%)</span>
                      <span className="result-value">{selectedCaseDetail.percentPay}%</span>
                    </div>
                    {selectedCaseDetail.payNo && (
                      <div className="result-item">
                        <span className="result-label">เลขที่ใบโอน (PayNo)</span>
                        <span className="result-value font-mono">{selectedCaseDetail.payNo}</span>
                      </div>
                    )}
                    {selectedCaseDetail.payDateThai && (
                      <div className="result-item">
                        <span className="result-label">วันที่โอนเงิน (PayDate)</span>
                        <span className="result-value">{selectedCaseDetail.payDateThai}</span>
                      </div>
                    )}
                    {selectedCaseDetail.noCompensated !== undefined &&
                      selectedCaseDetail.noCompensated > 0 && (
                        <div className="result-item">
                          <span className="result-label">ยอดไม่ชดเชย</span>
                          <span className="result-value text-danger">
                            {selectedCaseDetail.noCompensated.toLocaleString('th-TH', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            บาท
                          </span>
                        </div>
                      )}
                    {selectedCaseDetail.payMore !== undefined && selectedCaseDetail.payMore > 0 && (
                      <div className="result-item">
                        <span className="result-label">จ่ายเพิ่ม (PayMore)</span>
                        <span className="result-value text-success">
                          {selectedCaseDetail.payMore.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          บาท
                        </span>
                      </div>
                    )}
                    {selectedCaseDetail.recall !== undefined && selectedCaseDetail.recall > 0 && (
                      <div className="result-item">
                        <span className="result-label">เรียกคืน (Recall)</span>
                        <span className="result-value text-danger">
                          {selectedCaseDetail.recall.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          บาท
                        </span>
                      </div>
                    )}
                    <div className="result-item">
                      <span className="result-label">สถานะการชดเชย</span>
                      <div className="badge-group">
                        {selectedCaseDetail.compensated > 0 ? (
                          <span className="status-badge success">
                            {selectedCaseDetail.seamlessStatus || 'ได้รับเงินชดเชย'}
                          </span>
                        ) : (
                          <span className="status-badge danger">
                            {selectedCaseDetail.seamlessStatus || 'ไม่ได้รับชดเชย (0 บาท)'}
                          </span>
                        )}
                        {selectedCaseDetail.errorCode && (
                          <span className="status-badge warning">
                            {selectedCaseDetail.source === 'seamless'
                              ? selectedCaseDetail.errorCode
                              : `Error ${selectedCaseDetail.errorCode}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedCaseDetail.errorCode && (
                      <div className="result-item">
                        <span className="result-label">
                          {selectedCaseDetail.source === 'seamless'
                            ? 'หมายเหตุ / รหัส Deny Code'
                            : 'รหัส Error Code'}
                        </span>
                        <span className="result-value text-danger">
                          {selectedCaseDetail.errorCode}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCaseDetail(null)}
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
