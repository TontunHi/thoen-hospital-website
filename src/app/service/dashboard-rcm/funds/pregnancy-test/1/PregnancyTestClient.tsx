'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
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
  Copy,
  Check,
  Activity,
  ReceiptText,
  Calendar,
  Baby,
  ShieldCheck,
  Users,
  TestTube2,
} from 'lucide-react'
import type {
  PregnancyTestItem,
  PregnancyTestSummary,
  PregnancyTestCardFilter,
  PregnancyTestSearchField,
  PregnancyTestSortField,
  PregnancyTestAdpMappingCheck,
} from '@/lib/clinical/rcmPregnancyTestService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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

function maskIdentifier(val?: string | null): string {
  if (!val) return '—'
  const trimmed = val.trim()
  if (trimmed.length <= 4) return trimmed
  return `•••${trimmed.slice(-4)}`
}

export interface PregnancyTestClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function PregnancyTestClient({
  initialData,
  initialRange,
}: PregnancyTestClientProps = {}) {
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

  // Date Selection States (Default to Custom)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter & Search States
  const [cardFilter, setCardFilter] = useState<PregnancyTestCardFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [ucOnly, setUcOnly] = useState<boolean>(false)
  const [searchField, setSearchField] = useState<PregnancyTestSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<PregnancyTestSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data Fetching States
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PregnancyTestItem[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<PregnancyTestAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<PregnancyTestSummary>(
    initialData?.summary || {
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
      positiveCount: 0,
      positiveRate: 0,
      negativeCount: 0,
      negativeRate: 0,
      pendingCount: 0,
      noLabCount: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Modal Detail States
  const [selectedItem, setSelectedItem] = useState<PregnancyTestItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Recalculate ds1/ds2 on dateMode changes
  useEffect(() => {
    if (dateMode === 'fiscal') {
      const ce = selectedFiscalYear - 543
      setDs1(`${ce - 1}-10-01`)
      setDs2(`${ce}-09-30`)
      setCurrentPage(1)
    } else if (dateMode === 'monthly') {
      const ce = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ce, selectedMonth, 0).getDate()
      setDs1(`${ce}-${mm}-01`)
      setDs2(`${ce}-${mm}-${String(lastDay).padStart(2, '0')}`)
      setCurrentPage(1)
    }
  }, [dateMode, selectedFiscalYear, selectedMonth, selectedBeYear])

  // Fetch report data
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      if (forceRefresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const q = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          ucOnly: String(ucOnly),
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) {
          q.set('pttypes', pttypes.join(','))
        }

        if (forceRefresh) {
          q.set('refresh', 'true')
        }

        const res = await fetch(`/api/service/dashboard-rcm/funds/pregnancy-test/service-81?${q.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) setSummary(data.summary)
        if (data.adpMapping) setAdpMapping(data.adpMapping)
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, pttypes, ucOnly, searchField, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData, initialData])

  // Fetch clinical details for Modal
  const fetchClinicalDetails = async (vn: string) => {
    setClinicalLoading(true)
    setClinicalError(null)
    setClinicalData(null)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/pregnancy-test/vn-details?vn=${encodeURIComponent(vn)}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถดึงข้อมูลเวชระเบียนคลินิกได้')
      }
      setClinicalData(json.data)
    } catch (err: unknown) {
      const e = err as Error
      setClinicalError(e.message)
    } finally {
      setClinicalLoading(false)
    }
  }

  // Handle open modal
  const handleOpenDetail = (item: PregnancyTestItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    fetchClinicalDetails(item.vn)
  }

  // Copy helper
  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Sort handler
  const handleSort = (field: PregnancyTestSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Card filter click handler
  const handleCardFilterClick = (target: PregnancyTestCardFilter) => {
    if (cardFilter === target) {
      setCardFilter('ALL')
    } else {
      setCardFilter(target)
    }
    setCurrentPage(1)
  }

  // Export to CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        ucOnly: String(ucOnly),
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) {
        q.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(`/api/service/dashboard-rcm/funds/pregnancy-test/service-81?${q.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')

      const exportRows: PregnancyTestItem[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'วันที่รับบริการ',
        'เวลา',
        'เลขที่บริการ (VN)',
        'HN',
        'CID',
        'ชื่อ-สกุล',
        'อายุ',
        'สิทธิการรักษา',
        'กลุ่มสิทธิ',
        'แผนก',
        'คลินิก',
        'PDX',
        'SDX',
        'ค่ารักษา (บาท)',
        'รายการ 31101 (UPT)',
        'ผลตรวจทางห้องปฏิบัติการ',
        'สถานะผลตรวจ',
        'รายการ 30014 (ชุดตรวจ)',
        'ClaimCode',
        'สถานะการเบิก',
        'เลขที่หนังสือชดเชย (Rep)',
        'ยอดชดเชย (บาท)',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const rows = exportRows.map((r) => [
        r.no,
        r.vstdate,
        r.vsttime,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.age,
        r.pttypename || '',
        r.maininscl || '',
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.sdx || '',
        r.income,
        r.labname || '',
        r.lab_order_result || '',
        r.labStatus,
        r.listname || '',
        r.authencode || '',
        r.status || '',
        r.rep || '',
        r.compensated,
        r.fund || '',
        r.subfund || '',
      ])

      await exportRcmExcel({
        filename: `PregnancyTest_8_1_${ds1}_to_${ds2}.xlsx`,
        title: 'การทดสอบการตั้งครรภ์ (Pregnancy Test 8.1)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert('ส่งออกไฟล์ล้มเหลว: ' + e.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="preg81-page">
      {/* ── Page Header ── */}
      <div className="preg81-header">
        <div className="preg81-title-group">
          <h1 className="preg81-title">การทดสอบการตั้งครรภ์ (Pregnancy Test)</h1>
          <p className="preg81-subtitle">
            รายงานการตรวจการตั้งครรภ์ด้วยรหัส ADP 31101 (การตรวจทางห้องปฏิบัติการ) และ 30014
            (การตรวจด้วยชุดทดสอบ) ติดตามผลตรวจ UPT และการชดเชยค่าบริการกองทุน
          </p>
        </div>
        <div className="preg81-header-actions">
          <button
            type="button"
            className="preg81-btn preg81-btn-outline"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="ล้างแคชและดึงข้อมูลใหม่"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}</span>
          </button>
          <button
            type="button"
            className="preg81-btn preg81-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── ADP Warning Banner if not mapped ── */}
      {!adpMapping.isMapped && (
        <div className="preg81-adp-warning" role="alert">
          <AlertTriangle size={22} className="preg81-adp-warning-icon" />
          <div>
            <h3 className="preg81-adp-warning-title">แจ้งเตือน: ยังไม่ได้ Map ADP Code (31101, 30014)</h3>
            <p className="preg81-adp-warning-text">
              ไม่พบรหัส ADP 31101 หรือ 30014 ในตาราง <code>s_drugitems</code> กรุณาตรวจสอบการ Map
              รหัสในระบบ HOSxP เพื่อให้การดึงข้อมูลรายงานถูกต้องครบถ้วน
            </p>
          </div>
        </div>
      )}

      {/* ── Date Filter Bar ── */}
      <div className="preg81-filter-bar">
        <div className="preg81-date-controls">
          {/* Mode Switcher */}
          <div className="preg81-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`preg81-mode-tab ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => setDateMode('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`preg81-mode-tab ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setDateMode('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`preg81-mode-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => setDateMode('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          {/* Date Mode Controls */}
          {dateMode === 'custom' && (
            <div className="preg81-date-inputs">
              <span className="text-xs font-semibold" style={{ color: 'var(--preg-text-sub)' }}>
                ตั้งแต่วันที่
              </span>
              <ThaiDatePicker
                aria-label="ตั้งแต่วันที่"
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
              />
              <span className="text-xs font-semibold" style={{ color: 'var(--preg-text-sub)' }}>
                ถึงวันที่
              </span>
              <ThaiDatePicker
                aria-label="ถึงวันที่"
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="preg81-date-inputs">
              <label htmlFor="preg81-month-select" className="sr-only">
                เลือกเดือน
              </label>
              <select
                id="preg81-month-select"
                className="preg81-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <label htmlFor="preg81-year-select" className="sr-only">
                เลือกปี
              </label>
              <select
                id="preg81-year-select"
                className="preg81-select"
                value={selectedBeYear}
                onChange={(e) => setSelectedBeYear(Number(e.target.value))}
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
            <div className="preg81-date-inputs">
              <label htmlFor="preg81-fiscal-select" className="sr-only">
                เลือกปีงบประมาณ
              </label>
              <select
                id="preg81-fiscal-select"
                className="preg81-select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
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
      </div>

      {/* ── KPI Summary Cards Grid (Interactive Filter) ── */}
      <div className="preg81-cards-grid">
        {/* Card 1: All Visits */}
        <div
          className={`preg81-card preg81-card-all ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">ผู้รับบริการทั้งหมด</h4>
            <div className="preg81-card-icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.totalVisits.toLocaleString()}
            <span className="preg81-card-unit">ครั้ง</span>
          </div>
          <p className="preg81-card-sub">
            ผู้ป่วยไม่ซ้ำ {summary.uniquePatients.toLocaleString()} คน · ค่ารักษา{' '}
            {formatMoney(summary.totalIncome)} บ.
          </p>
        </div>

        {/* Card 2: Compensated */}
        <div
          className={`preg81-card preg81-card-comp ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">ได้รับชดเชยแล้ว</h4>
            <div className="preg81-card-icon">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.compensatedVisits.toLocaleString()}
            <span className="preg81-card-unit">({summary.compensationRate}%)</span>
          </div>
          <p className="preg81-card-sub">
            ยอดรวม {formatMoney(summary.totalCompensated)} บาท (เฉลี่ย{' '}
            {formatMoney(summary.averageCompensated)} บ./ราย)
          </p>
        </div>

        {/* Card 3: Uncompensated */}
        <div
          className={`preg81-card preg81-card-uncomp ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ได้รับการชดเชย"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">ยังไม่ได้รับชดเชย</h4>
            <div className="preg81-card-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.uncompensatedVisits.toLocaleString()}
            <span className="preg81-card-unit">ราย</span>
          </div>
          <p className="preg81-card-sub">
            {summary.totalVisits > 0
              ? `${(100 - summary.compensationRate).toFixed(1)}% อยู่ระหว่างติดตามหรือส่งเบิก`
              : 'ไม่มีรายการ'}
          </p>
        </div>

        {/* Card 4: Positive (Pregnant) */}
        <div
          className={`preg81-card preg81-card-pos ${cardFilter === 'POSITIVE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('POSITIVE')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('POSITIVE')}
          title="คลิกเพื่อกรองเฉพาะผลตรวจเป็นบวก (Positive / ตั้งครรภ์)"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">ผลบวก (Positive)</h4>
            <div className="preg81-card-icon">
              <Baby size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.positiveCount.toLocaleString()}
            <span className="preg81-card-unit">({summary.positiveRate}%)</span>
          </div>
          <p className="preg81-card-sub">ตรวจพบการตั้งครรภ์ / แนะนำบริการ ANC</p>
        </div>

        {/* Card 5: Negative (Not Pregnant) */}
        <div
          className={`preg81-card preg81-card-neg ${cardFilter === 'NEGATIVE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NEGATIVE')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('NEGATIVE')}
          title="คลิกเพื่อกรองเฉพาะผลตรวจเป็นลบ (Negative / ไม่ตั้งครรภ์)"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">ผลลบ (Negative)</h4>
            <div className="preg81-card-icon">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.negativeCount.toLocaleString()}
            <span className="preg81-card-unit">({summary.negativeRate}%)</span>
          </div>
          <p className="preg81-card-sub">ตรวจไม่พบการตั้งครรภ์ (ผลปกติ)</p>
        </div>

        {/* Card 6: UC Scheme (UCS) */}
        <div
          className={`preg81-card preg81-card-uc ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('UC_ONLY')}
          title="คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UC/UCS)"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">สิทธิบัตรทอง (UC)</h4>
            <div className="preg81-card-icon">
              <Users size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.ucCount.toLocaleString()}
            <span className="preg81-card-unit">({summary.ucRate}%)</span>
          </div>
          <p className="preg81-card-sub">ผู้มีสิทธิหลักประกันสุขภาพถ้วนหน้า (UCS)</p>
        </div>

        {/* Card 7: With ClaimCode */}
        <div
          className={`preg81-card preg81-card-authen ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCardFilterClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="preg81-card-header">
            <h4 className="preg81-card-title">ยืนยันตัวตน (ClaimCode)</h4>
            <div className="preg81-card-icon">
              <Check size={18} />
            </div>
          </div>
          <div className="preg81-card-value">
            {summary.withAuthenCount.toLocaleString()}
            <span className="preg81-card-unit">({summary.authenRate}%)</span>
          </div>
          <p className="preg81-card-sub">
            ไม่มี ClaimCode {summary.withoutAuthenCount.toLocaleString()} ราย
          </p>
        </div>
      </div>

      {/* ── Toolbar: Quick Filter Pills, UC Checkbox, & Search ── */}
      <div className="preg81-toolbar">
        {/* Quick Filter Pills */}
        <div className="preg81-filter-pills" role="toolbar" aria-label="ตัวกรองสถานะ">
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'ALL' && !ucOnly ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('ALL')
              setUcOnly(false)
              setCurrentPage(1)
            }}
          >
            ทั้งหมด ({summary.totalVisits})
          </button>
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('COMPENSATED')
              setCurrentPage(1)
            }}
          >
            ได้รับชดเชย ({summary.compensatedVisits})
          </button>
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('UNCOMPENSATED')
              setCurrentPage(1)
            }}
          >
            ยังไม่ชดเชย ({summary.uncompensatedVisits})
          </button>
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'POSITIVE' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('POSITIVE')
              setCurrentPage(1)
            }}
          >
            ผลบวก ({summary.positiveCount})
          </button>
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'NEGATIVE' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('NEGATIVE')
              setCurrentPage(1)
            }}
          >
            ผลลบ ({summary.negativeCount})
          </button>
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('WITH_AUTHEN')
              setCurrentPage(1)
            }}
          >
            มี ClaimCode ({summary.withAuthenCount})
          </button>
          <button
            type="button"
            className={`preg81-pill ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('NO_AUTHEN')
              setCurrentPage(1)
            }}
          >
            ไม่มี ClaimCode ({summary.withoutAuthenCount})
          </button>

          {/* Pttype Multi-Select Filter */}
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />
        </div>

        {/* Search Row */}
        <div className="preg81-search-row">
          <div className="preg81-search-group">
            <div className="preg81-search-input-wrapper">
              <Search size={16} className="preg81-search-icon" />
              <input
                type="text"
                className="preg81-search-input"
                placeholder="พิมพ์ข้อความที่ต้องการค้นหา..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="preg81-modal-close"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setSearch('')}
                  title="ล้างข้อความค้นหา"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="preg81-counter">
            พบ <strong>{totalCount.toLocaleString()}</strong> รายการ (จากทั้งหมด{' '}
            {summary.totalVisits.toLocaleString()} รายการ)
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="preg81-adp-warning" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={20} />
          <div>
            <strong>เกิดข้อผิดพลาด:</strong> {error}
          </div>
        </div>
      )}

      {/* ── Data Table ── */}
      <div className="preg81-table-card">
        <div className="preg81-table-wrapper">
          <table className="preg81-table">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>ลำดับ</th>
                <th className="sortable" onClick={() => handleSort('vstdate')}>
                  <span className="preg81-th-content">
                    วันที่รับบริการ
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
                <th>เลขที่ VN</th>
                <th className="sortable" onClick={() => handleSort('hn')}>
                  <span className="preg81-th-content">
                    HN / CID
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
                <th className="sortable" onClick={() => handleSort('ptname')}>
                  <span className="preg81-th-content">
                    ชื่อ-สกุล ผู้รับบริการ
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
                <th className="sortable" onClick={() => handleSort('age')}>
                  <span className="preg81-th-content">
                    อายุ
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
                <th>สิทธิการรักษา</th>
                <th>แผนก / คลินิก</th>
                <th>การวินิจฉัย (PDX)</th>
                <th className="sortable" onClick={() => handleSort('income')}>
                  <span className="preg81-th-content">
                    ค่ารักษา
                    {sortBy === 'income' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
                <th className="sortable" onClick={() => handleSort('lab_order_result')}>
                  <span className="preg81-th-content">
                    ผลตรวจ UPT (31101)
                    {sortBy === 'lab_order_result' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
                <th>ชุดตรวจ (30014)</th>
                <th>ClaimCode</th>
                <th>สถานะชดเชย / Rep</th>
                <th className="sortable" onClick={() => handleSort('compensated')}>
                  <span className="preg81-th-content">
                    ยอดชดเชย
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="preg81-empty-state">
                    <RefreshCw size={28} className="animate-spin preg81-empty-icon" />
                    <p className="preg81-empty-title">กำลังโหลดข้อมูลรายงาน...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={15} className="preg81-empty-state">
                    <TestTube2 size={36} className="preg81-empty-icon" />
                    <h3 className="preg81-empty-title">ไม่พบข้อมูลการทดสอบการตั้งครรภ์</h3>
                    <p className="preg81-empty-text">
                      ในช่วงเวลาและเงื่อนไขตัวกรองที่ระบุ หากมีข้อสงสัยโปรดตรวจสอบการเบิกจ่ายในระบบ HOSxP
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.vn}
                    onClick={() => handleOpenDetail(row)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="preg81-td-num">{row.no}</td>
                    <td className="preg81-td-datetime">
                      <div>{formatThaiDate(row.vstdate)}</div>
                      <div className="text-xs text-muted" style={{ color: 'var(--preg-text-muted)' }}>
                        {row.vsttime || '—'}
                      </div>
                    </td>
                    <td className="font-mono text-xs">
                      <span
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(row.vn, `vn-${row.vn}`)
                        }}
                        title="คลิกเพื่อคัดลอก VN"
                      >
                        {row.vn}
                      </span>
                    </td>
                    <td>
                      <div className="font-mono">
                        <span
                          role="button"
                          tabIndex={0}
                          style={{ fontWeight: 600, cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(row.hn, `hn-${row.hn}`)
                          }}
                          title="คลิกเพื่อคัดลอก HN"
                        >
                          {row.hn}
                        </span>
                      </div>
                      <div className="text-xs font-mono" style={{ color: 'var(--preg-text-muted)' }}>
                        <span
                          role="button"
                          tabIndex={0}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(row.cid, `cid-${row.cid}`)
                          }}
                          title="คลิกเพื่อคัดลอก CID"
                        >
                          {row.cid || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="preg81-td-ptname">{row.ptname}</td>
                    <td className="font-tabular text-center">{row.age}</td>
                    <td>
                      <div>{row.pttypename || '—'}</div>
                      {row.isUc && <span className="preg81-badge preg81-badge-uc">บัตรทอง UC</span>}
                    </td>
                    <td>
                      <div>{row.department || '—'}</div>
                      {row.clinic && (
                        <div className="text-xs" style={{ color: 'var(--preg-text-muted)' }}>
                          {row.clinic}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600 }}>
                        {row.pdx || '—'}
                      </span>
                      {row.sdx && (
                        <div className="text-xs" style={{ color: 'var(--preg-text-muted)', maxWidth: 120 }}>
                          {row.sdx}
                        </div>
                      )}
                    </td>
                    <td className="preg81-td-money">{formatMoney(row.income)}</td>
                    <td>
                      {row.labStatus === 'POSITIVE' ? (
                        <span className="preg81-badge preg81-badge-pos">
                          <Baby size={12} />
                          Positive ({row.lab_order_result || 'ผลบวก'})
                        </span>
                      ) : row.labStatus === 'NEGATIVE' ? (
                        <span className="preg81-badge preg81-badge-neg">
                          <ShieldCheck size={12} />
                          Negative ({row.lab_order_result || 'ผลลบ'})
                        </span>
                      ) : row.labStatus === 'PENDING' ? (
                        <span className="preg81-badge preg81-badge-pending">
                          รอผลตรวจ
                        </span>
                      ) : row.lab_order_result ? (
                        <span className="preg81-badge preg81-badge-gray">
                          {row.lab_order_result}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                      {row.labname && (
                        <div className="text-xs" style={{ color: 'var(--preg-text-muted)', marginTop: 2 }}>
                          {row.labname}
                        </div>
                      )}
                    </td>
                    <td>
                      {row.listname ? (
                        <span className="text-xs">{row.listname}</span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.authencode ? (
                        <span className="preg81-badge preg81-badge-green font-mono">
                          {row.authencode}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div>{row.status || '—'}</div>
                      {row.rep && (
                        <div className="text-xs font-mono" style={{ color: 'var(--preg-primary)' }}>
                          Rep: {row.rep}
                        </div>
                      )}
                    </td>
                    <td className="preg81-td-money">
                      {row.isCompensated ? (
                        <span style={{ color: 'var(--preg-primary)', fontWeight: 700 }}>
                          {formatMoney(row.compensated)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--preg-text-muted)' }}>0.00</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="preg81-pagination">
          <div className="preg81-page-info">
            แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า (ทั้งหมด {totalCount.toLocaleString()} รายการ)
          </div>
          <div className="preg81-page-controls">
            <select
              className="preg81-select"
              style={{ minHeight: 36, padding: '4px 10px', fontSize: 13 }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              title="จำนวนรายการต่อหน้า"
            >
              <option value={25}>25 รายการ / หน้า</option>
              <option value={50}>50 รายการ / หน้า</option>
              <option value={100}>100 รายการ / หน้า</option>
              <option value={200}>200 รายการ / หน้า</option>
            </select>
            <button
              type="button"
              className="preg81-page-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
              <span>ก่อนหน้า</span>
            </button>
            <button
              type="button"
              className="preg81-page-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="หน้าถัดไป"
            >
              <span>ถัดไป</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Patient Clinical Detail Modal ── */}
      {selectedItem && (
        <div
          className="preg81-modal-overlay"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="preg81-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preg81-modal-header">
              <div>
                <h3 className="preg81-modal-title">
                  ข้อมูลการรับบริการตรวจการตั้งครรภ์ (VN: {selectedItem.vn})
                </h3>
                <p className="text-xs" style={{ color: 'var(--preg-text-muted)', margin: '4px 0 0' }}>
                  {selectedItem.ptname} · HN {selectedItem.hn} · อายุ {selectedItem.age} ปี · วันที่{' '}
                  {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                </p>
              </div>
              <button
                type="button"
                className="preg81-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="preg81-modal-tabs">
              <button
                type="button"
                className={`preg81-modal-tab ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปข้อมูลการตรวจ & ชดเชย
              </button>
              <button
                type="button"
                className={`preg81-modal-tab ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก & ยา
              </button>
            </div>

            <div className="preg81-modal-body">
              {modalTab === 'summary' ? (
                <div>
                  <div className="preg81-grid-2">
                    <div className="preg81-info-block">
                      <div className="preg81-info-label">ข้อมูลผู้ป่วย</div>
                      <div className="preg81-info-val">{selectedItem.ptname}</div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        HN: {selectedItem.hn} · CID: {selectedItem.cid}
                      </div>
                    </div>
                    <div className="preg81-info-block">
                      <div className="preg81-info-label">สิทธิการรักษา</div>
                      <div className="preg81-info-val">{selectedItem.pttypename}</div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        กลุ่มสิทธิหลัก: {selectedItem.maininscl || '—'}{' '}
                        {selectedItem.isUc && '(สิทธิบัตรทอง UCS)'}
                      </div>
                    </div>
                    <div className="preg81-info-block">
                      <div className="preg81-info-label">ผลตรวจ UPT (รหัส 31101)</div>
                      <div className="preg81-info-val" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedItem.labStatus === 'POSITIVE' ? (
                          <span className="preg81-badge preg81-badge-pos">Positive (ตรวจพบผลบวก)</span>
                        ) : selectedItem.labStatus === 'NEGATIVE' ? (
                          <span className="preg81-badge preg81-badge-neg">Negative (ตรวจพบผลลบ)</span>
                        ) : (
                          <span>{selectedItem.lab_order_result || 'ไม่มีผลตรวจ'}</span>
                        )}
                      </div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        รายการยา/Lab: {selectedItem.labname || '—'}
                      </div>
                    </div>
                    <div className="preg81-info-block">
                      <div className="preg81-info-label">รายการชุดทดสอบ (รหัส 30014)</div>
                      <div className="preg81-info-val">{selectedItem.listname || '—'}</div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        Authen Code: {selectedItem.authencode || 'ไม่มี Authen'}
                      </div>
                    </div>
                    <div className="preg81-info-block">
                      <div className="preg81-info-label">การวินิจฉัยโรค</div>
                      <div className="preg81-info-val">
                        PDX: {selectedItem.pdx || '—'}
                      </div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        SDX: {selectedItem.sdx || 'ไม่มี'}
                      </div>
                    </div>
                    <div className="preg81-info-block">
                      <div className="preg81-info-label">การชดเชยค่าบริการ</div>
                      <div className="preg81-info-val" style={{ color: 'var(--preg-primary)' }}>
                        {formatMoney(selectedItem.compensated)} บาท
                      </div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        สถานะ: {selectedItem.status || '—'} {selectedItem.rep ? `(Rep: ${selectedItem.rep})` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {clinicalLoading ? (
                    <div className="preg81-empty-state">
                      <RefreshCw size={24} className="animate-spin preg81-empty-icon" />
                      <p className="preg81-empty-title">กำลังดึงข้อมูลเวชระเบียนคลินิก...</p>
                    </div>
                  ) : clinicalError ? (
                    <div className="preg81-adp-warning" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
                      <AlertTriangle size={18} />
                      <div>{clinicalError}</div>
                    </div>
                  ) : clinicalData ? (
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>
                        สัญญาณชีพและอาการสำคัญ
                      </h4>
                      <div className="preg81-grid-2" style={{ marginBottom: 16 }}>
                        <div className="preg81-info-block">
                          <div className="preg81-info-label">ความดันโลหิต / ชีพจร</div>
                          <div className="preg81-info-val">
                            {clinicalData.screen?.bps && clinicalData.screen?.bpd
                              ? `${clinicalData.screen.bps}/${clinicalData.screen.bpd} mmHg`
                              : '—'}{' '}
                            · PR: {clinicalData.screen?.pulse || '—'} bpm
                          </div>
                        </div>
                        <div className="preg81-info-block">
                          <div className="preg81-info-label">อุณหภูมิ / น้ำหนัก / ส่วนสูง</div>
                          <div className="preg81-info-val">
                            {clinicalData.screen?.temperature ? `${clinicalData.screen.temperature} °C` : '—'} ·{' '}
                            {clinicalData.screen?.bw ? `${clinicalData.screen.bw} kg` : '—'} ·{' '}
                            {clinicalData.screen?.height ? `${clinicalData.screen.height} cm` : '—'}
                          </div>
                        </div>
                      </div>

                      {clinicalData.screen?.cc && (
                        <div className="preg81-info-block" style={{ marginBottom: 16 }}>
                          <div className="preg81-info-label">อาการสำคัญ (Chief Complaint)</div>
                          <div className="text-sm">{clinicalData.screen.cc}</div>
                        </div>
                      )}

                      {clinicalData.diagnoses && clinicalData.diagnoses.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
                            การวินิจฉัยโรค (HOSxP ovstdiag)
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {clinicalData.diagnoses.map((dx, i) => (
                              <span key={i} className="preg81-badge preg81-badge-gray">
                                <strong>{dx.icd10}:</strong> {dx.diagtype_name || dx.diagtype}{' '}
                                {dx.icd_name ? `(${dx.icd_name})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 12px' }}>
                        รายการยาและบริการที่สั่ง ({clinicalData.orders?.items?.length || 0} รายการ)
                      </h4>
                      {clinicalData.orders?.items && clinicalData.orders.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {clinicalData.orders.items.map((item, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '10px 14px',
                                backgroundColor: 'var(--preg-surface-2)',
                                borderRadius: 8,
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 13,
                              }}
                            >
                              <div>
                                <strong>{item.item_name}</strong>{' '}
                                {item.strength && <span>({item.strength})</span>}
                              </div>
                              <div className="font-tabular">
                                จำนวน: {item.qty} · {formatMoney(item.sum_price)} บ.
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">ไม่พบรายการสั่งในใบสั่งนี้</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
