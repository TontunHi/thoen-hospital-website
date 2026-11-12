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
  Baby,
  Calendar,
  Filter,
} from 'lucide-react'
import type {
  AncService30011Item,
  AncService30011Summary,
  AncCompensationFilter,
  AncSearchField,
  AncSortField,
  AncAdpMappingCheck,
} from '@/lib/clinical/rcmAncService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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

function maskIdentifier(val?: string | null): string {
  if (!val) return '—'
  const trimmed = val.trim()
  if (trimmed.length <= 4) return trimmed
  return `•••${trimmed.slice(-4)}`
}

export interface AncService30011ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function AncService30011Client({
  initialData,
  initialRange,
}: AncService30011ClientProps = {}) {
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

  // Date selection states (Default to Fiscal Year)
  const [dateMode, setDateMode] = useState<'fiscal' | 'monthly' | 'custom'>('fiscal')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter & Search states
  const [compensationFilter, setCompensationFilter] = useState<AncCompensationFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [searchField, setSearchField] = useState<AncSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<AncSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AncService30011Item[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<AncAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<AncService30011Summary>(
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
      withPdxCount: 0,
      withOpCount: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Modal Detail states
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
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
          compensationFilter,
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

        const res = await fetch(`/api/service/dashboard-rcm/funds/anc/service-30011?${q.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        setItems(json.data.items || [])
        setTotalCount(json.data.totalCount || 0)
        setTotalPages(json.data.totalPages || 1)
        if (json.data.summary) setSummary(json.data.summary)
        if (json.data.adpMapping) setAdpMapping(json.data.adpMapping)
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, compensationFilter, pttypes, searchField, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
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

  // Selected item for modal
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null

  // Fetch VN Clinical Details when opening modal tab 'clinical'
  useEffect(() => {
    if (!selectedItem || modalTab !== 'clinical') return
    if (!selectedItem.vn) return

    let isMounted = true
    setClinicalLoading(true)
    setClinicalError(null)

    fetch(`/api/service/dashboard-rcm/funds/anc/vn-details?vn=${selectedItem.vn}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return
        if (json.success && json.data) {
          setClinicalData(json.data)
        } else {
          setClinicalError(json.error?.message || 'ไม่สามารถโหลดข้อมูลเวชระเบียนได้')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setClinicalError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      })
      .finally(() => {
        if (isMounted) setClinicalLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedItem, modalTab])

  // Sort handler
  const handleSort = (field: AncSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: AncSortField) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="anc4-sort-idle" aria-hidden="true" />
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="anc4-sort-active" aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className="anc4-sort-active" aria-hidden="true" />
    )
  }

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 1800)
    })
  }

  // Export CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        compensationFilter,
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (pttypes.length > 0) {
        q.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(`/api/service/dashboard-rcm/funds/anc/service-30011?${q.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')
      }

      const rows: AncService30011Item[] = json.data.items || []
      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลารับบริการ',
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
        'OP0',
        'OP1',
        'OP2',
        'OP3',
        'OP4',
        'OP5',
        'รายการบริการ 30011',
        'รายการเวชภัณฑ์/บริการอื่น',
        'สถานะชดเชย',
        'เลขที่ Rep',
        'กองทุน',
        'กองทุนย่อย',
        'ยอดชดเชย (บาท)',
      ]

      const exportRows = rows.map((r) => [
        r.no,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.age ?? '',
        r.nation || '',
        r.vstdate,
        r.vsttime,
        r.authencode || '',
        r.pttypename || '',
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.dx0 || '',
        r.dx1 || '',
        r.dx2 || '',
        r.dx3 || '',
        r.dx4 || '',
        r.dx5 || '',
        r.op0 || '',
        r.op1 || '',
        r.op2 || '',
        r.op3 || '',
        r.op4 || '',
        r.op5 || '',
        r.listname || '',
        r.listname1 || '',
        r.status || '',
        r.rep || '',
        r.fund || '',
        r.subfund || '',
        r.compensated,
      ])

      await exportRcmExcel({
        filename: `anc-service-30011_${ds1}_to_${ds2}.xlsx`,
        title: 'บริการฝากครรภ์ (ANC 30011)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: exportRows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert(e.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="anc4-page">
      {/* ── 1. Header Bar ── */}
      <header className="anc4-header">
        <div className="anc4-title-group">
          <h1 className="anc4-title">2.4 บริการฝากครรภ์ (ANC 30011)</h1>
          <p className="anc4-subtitle">
            รายงานผู้รับบริการที่มีการสั่งใช้รหัส ADP 30011 ตรวจสอบการวินิจฉัย หัตถการ รายการเวชภัณฑ์ และสถานะการชดเชยค่าบริการ E-Claim / สปสช.
          </p>
        </div>

        <div className="anc4-header-actions">
          <button
            type="button"
            className="anc4-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            aria-busy={isRefreshing}
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? 'anc4-spin-icon' : undefined}
              aria-hidden="true"
            />
            {isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
          </button>
          <button
            type="button"
            className="anc4-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || totalCount === 0}
            aria-busy={isExporting}
            title="ส่งออกรายงานทั้งหมดเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}
          </button>
        </div>
      </header>

      {/* ── 2. Warning Banner when ADP code is unmapped ── */}
      {!adpMapping.isMapped && (
        <div className="anc4-banner anc4-banner-warn" role="alert">
          <div className="anc4-banner-content">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              <strong>แจ้งเตือน:</strong> คุณยังไม่ได้ Map รหัส ADP Code <code>30011</code> ในตาราง{' '}
              <code>s_drugitems</code> กรุณาตรวจสอบการตั้งค่ารายการตรวจ/ยาในระบบ HOSxP
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Interactive KPI Summary Cards (Filter via card) ── */}
      <section className="anc4-summary-grid" aria-label="สรุปภาพรวมบริการและการชดเชย (สามารถคลิกการ์ดเพื่อกรองข้อมูล)">
        <button
          type="button"
          className="anc4-summary-card"
          aria-pressed={compensationFilter === 'ALL'}
          onClick={() => {
            setCompensationFilter('ALL')
            setCurrentPage(1)
          }}
        >
          <div className="anc4-card-header">
            <span className="anc4-card-label">จำนวนรับบริการทั้งหมด</span>
            <Activity size={16} className="text-muted" aria-hidden="true" />
          </div>
          <span className="anc4-card-val font-tabular">{summary.totalVisits.toLocaleString()}</span>
          <span className="anc4-card-sub">ผู้ป่วย {summary.uniquePatients.toLocaleString()} ราย</span>
        </button>

        <button
          type="button"
          className="anc4-summary-card"
          aria-pressed={compensationFilter === 'COMPENSATED'}
          onClick={() => {
            setCompensationFilter((prev) => (prev === 'COMPENSATED' ? 'ALL' : 'COMPENSATED'))
            setCurrentPage(1)
          }}
        >
          <div className="anc4-card-header">
            <span className="anc4-card-label">ได้รับการชดเชยแล้ว</span>
            <span className="anc4-card-badge anc4-badge-ok">ชดเชยแล้ว</span>
          </div>
          <span className="anc4-card-val text-success font-tabular">
            {summary.compensatedVisits.toLocaleString()}
          </span>
          <span className="anc4-card-sub text-success">
            {summary.compensationRate}% ของผู้รับบริการ
          </span>
        </button>

        <button
          type="button"
          className="anc4-summary-card"
          aria-pressed={compensationFilter === 'UNCOMPENSATED'}
          onClick={() => {
            setCompensationFilter((prev) => (prev === 'UNCOMPENSATED' ? 'ALL' : 'UNCOMPENSATED'))
            setCurrentPage(1)
          }}
        >
          <div className="anc4-card-header">
            <span className="anc4-card-label">ยังไม่ได้รับการชดเชย</span>
            <span className="anc4-card-badge anc4-badge-danger">รอชดเชย</span>
          </div>
          <span className="anc4-card-val text-danger font-tabular">
            {summary.uncompensatedVisits.toLocaleString()}
          </span>
          <span className="anc4-card-sub text-danger">รอผลชดเชย / ติด Error</span>
        </button>

        <div className="anc4-summary-card">
          <div className="anc4-card-header">
            <span className="anc4-card-label">ยอดชดเชยรวม</span>
            <ReceiptText size={16} className="text-accent" aria-hidden="true" />
          </div>
          <span className="anc4-card-val text-accent font-tabular">
            ฿{formatMoney(summary.totalCompensated)}
          </span>
          <span className="anc4-card-sub">
            เฉลี่ย ฿{formatMoney(summary.averageCompensated)} / รายชดเชย
          </span>
        </div>

        <button
          type="button"
          className="anc4-summary-card"
          aria-pressed={compensationFilter === 'HAS_AUTHEN'}
          onClick={() => {
            setCompensationFilter((prev) => (prev === 'HAS_AUTHEN' ? 'ALL' : 'HAS_AUTHEN'))
            setCurrentPage(1)
          }}
        >
          <div className="anc4-card-header">
            <span className="anc4-card-label">มี ClaimCode</span>
            <span className="anc4-card-badge anc4-badge-info">สปสช.</span>
          </div>
          <span className="anc4-card-val font-tabular">
            {summary.withAuthenCount.toLocaleString()}
          </span>
          <span className="anc4-card-sub">ไม่มี ClaimCode {summary.withoutAuthenCount.toLocaleString()} ราย</span>
        </button>

        <div className="anc4-summary-card">
          <div className="anc4-card-header">
            <span className="anc4-card-label">การลงข้อมูลคลินิก</span>
            <span className="anc4-card-badge anc4-badge-neutral">ICD</span>
          </div>
          <span className="anc4-card-val font-tabular">{summary.withPdxCount.toLocaleString()}</span>
          <span className="anc4-card-sub">ลงหัตถการ {summary.withOpCount.toLocaleString()} ราย</span>
        </div>
      </section>

      {/* ── 4. Filter & Search Controls ── */}
      <section className="anc4-controls-card" aria-label="ตัวกรองและค้นหาข้อมูล">
        <div className="anc4-period-row">
          <div className="anc4-period-left">
            <span className="anc4-field-label">รูปแบบช่วงเวลา</span>
            <div className="anc4-mode-tabs" role="group" aria-label="รูปแบบช่วงเวลา">
              <button
                type="button"
                aria-pressed={dateMode === 'custom'}
                className={`anc4-mode-tab ${dateMode === 'custom' ? 'active' : ''}`}
                onClick={() => setDateMode('custom')}
              >
                กำหนดเอง
              </button>
              <button
                type="button"
                aria-pressed={dateMode === 'monthly'}
                className={`anc4-mode-tab ${dateMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setDateMode('monthly')}
              >
                รายเดือน
              </button>
              <button
                type="button"
                aria-pressed={dateMode === 'fiscal'}
                className={`anc4-mode-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
                onClick={() => setDateMode('fiscal')}
              >
                ปีงบประมาณ
              </button>
            </div>
          </div>

          <div className="anc4-period-selectors">
            {dateMode === 'fiscal' && (
              <div className="anc4-date-range-box">
                <span className="anc4-field-label">ปีงบประมาณ พ.ศ.</span>
                <select
                  className="anc4-select"
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                  aria-label="เลือกปีงบประมาณ"
                >
                  {[2569, 2570].map((y) => (
                    <option key={y} value={y}>
                      ปีงบ {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateMode === 'monthly' && (
              <div className="anc4-date-range-box">
                <span className="anc4-field-label">เดือน</span>
                <select
                  className="anc4-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <span className="anc4-field-label">ปี พ.ศ.</span>
                <select
                  className="anc4-select"
                  value={selectedBeYear}
                  onChange={(e) => setSelectedBeYear(Number(e.target.value))}
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

            {dateMode === 'custom' && (
              <div className="anc4-date-range-box">
                <span className="anc4-field-label">ตั้งแต่วันที่</span>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  aria-label="ตั้งแต่วันที่"
                />
                <span className="anc4-field-label">ถึงวันที่</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  aria-label="ถึงวันที่"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Search Bar & Filter Indicators ── */}
        <div className="anc4-filter-bar">
          <div className="anc4-search-group">
            <div className="anc4-search-wrapper">
              <Search size={16} className="anc4-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="anc4-search-input"
                placeholder="ค้นหาชื่อผู้ป่วย, HN, เลขบัตร, VN หรือรหัสโรค..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="ช่องค้นหาข้อมูล"
              />
              {search && (
                <button
                  type="button"
                  className="anc4-search-clear"
                  onClick={() => setSearch('')}
                  title="ล้างคำค้นหา"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--anc-text-muted)', fontWeight: 500 }}>
              สิทธิการรักษา:
            </span>
            <PttypeMultiSelect
              selectedCodes={pttypes}
              onChange={(codes) => {
                setPttypes(codes)
                setCurrentPage(1)
            }}
            items={items}
            
          />
          </div>

          {compensationFilter !== 'ALL' && (
            <div className="anc4-active-filter-badge">
              <Filter size={12} aria-hidden="true" />
              <span>
                กรองสถานะ:{' '}
                {compensationFilter === 'COMPENSATED'
                  ? 'ได้รับการชดเชยแล้ว'
                  : compensationFilter === 'UNCOMPENSATED'
                    ? 'ยังไม่ได้รับการชดเชย'
                    : compensationFilter === 'HAS_AUTHEN'
                      ? 'มี ClaimCode'
                      : 'ไม่มี ClaimCode'}
              </span>
              <button
                type="button"
                className="anc4-active-filter-clear"
                onClick={() => setCompensationFilter('ALL')}
                title="ล้างตัวกรองสถานะ"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Main Data Table ── */}
      <section className="anc4-table-card" aria-label="ตารางรายการผู้รับบริการฝากครรภ์ ANC 30011">
        <div className="anc4-table-header-info">
          <div className="anc4-table-count">
            พบผู้รับบริการทั้งหมด <strong>{totalCount.toLocaleString()}</strong> รายการ
            {compensationFilter !== 'ALL' && ' (ตามตัวกรอง)'}
          </div>
          <div className="anc4-page-size-selector">
            <span className="anc4-field-label">แสดงต่อหน้า: </span>
            <select
              className="anc4-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              aria-label="จำนวนแถวต่อหน้า"
            >
              <option value={25}>25 แถว</option>
              <option value={50}>50 แถว</option>
              <option value={100}>100 แถว</option>
              <option value={200}>200 แถว</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="anc4-banner anc4-banner-warn" style={{ margin: '20px' }}>
            <p><strong>เกิดข้อผิดพลาด:</strong> {error}</p>
          </div>
        ) : (
          <div className="anc4-table-scroll">
            <table className="anc4-table">
              <thead>
                <tr>
                  <th className="anc4-td-center">#</th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('vstdate')}
                  >
                    <span className="anc4-th-content">
                      วันที่รับบริการ {renderSortIcon('vstdate')}
                    </span>
                  </th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('vsttime')}
                  >
                    <span className="anc4-th-content">เวลา {renderSortIcon('vsttime')}</span>
                  </th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('hn')}
                  >
                    <span className="anc4-th-content">HN {renderSortIcon('hn')}</span>
                  </th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('cid')}
                  >
                    <span className="anc4-th-content">เลขบัตร ปชช. {renderSortIcon('cid')}</span>
                  </th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('ptname')}
                  >
                    <span className="anc4-th-content">ชื่อ - สกุล {renderSortIcon('ptname')}</span>
                  </th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('age')}
                  >
                    <span className="anc4-th-content">อายุ {renderSortIcon('age')}</span>
                  </th>
                  <th className="anc4-td-center">สิทธิการรักษา</th>
                  <th className="anc4-td-center">แผนก</th>
                  <th className="anc4-td-center">คลินิก</th>
                  <th className="anc4-td-center">
                    <span style={{ fontSize: '10px', color: 'var(--anc-muted)', display: 'block' }}>การวินิจฉัย</span>
                    <span>PDX</span>
                  </th>
                  <th className="anc4-td-center">DX0</th>
                  <th className="anc4-td-center">DX1</th>
                  <th className="anc4-td-center">DX2</th>
                  <th className="anc4-td-center">DX3</th>
                  <th className="anc4-td-center">DX4</th>
                  <th className="anc4-td-center">DX5</th>
                  <th className="anc4-td-center">
                    <span style={{ fontSize: '10px', color: 'var(--anc-muted)', display: 'block' }}>หัตถการ</span>
                    <span>OP0</span>
                  </th>
                  <th className="anc4-td-center">OP1</th>
                  <th className="anc4-td-center">OP2</th>
                  <th className="anc4-td-center">OP3</th>
                  <th className="anc4-td-center">OP4</th>
                  <th className="anc4-td-center">OP5</th>
                  <th className="anc4-td-center">รายการบริการ (30011)</th>
                  <th className="anc4-td-center">เวชภัณฑ์/บริการอื่น</th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('authencode')}
                  >
                    <span className="anc4-th-content">
                      ClaimCode {renderSortIcon('authencode')}
                    </span>
                  </th>
                  <th className="anc4-td-center">สถานะชดเชย</th>
                  <th className="anc4-td-center">เลขที่ Rep</th>
                  <th className="anc4-td-center">กองทุน</th>
                  <th
                    className="anc4-th-sortable anc4-td-center"
                    onClick={() => handleSort('compensated')}
                  >
                    <span className="anc4-th-content">
                      ยอดชดเชย (บาท) {renderSortIcon('compensated')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading || isRefreshing ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                      {Array.from({ length: 30 }).map((__, colIdx) => (
                        <td key={colIdx} className="col-center">
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={30} className="anc4-empty-state">
                      <div className="anc4-empty-icon">
                        <Baby size={28} aria-hidden="true" />
                      </div>
                      <p className="anc4-empty-title">ไม่พบข้อมูลผู้รับบริการฝากครรภ์ ANC (30011)</p>
                      <p className="anc4-empty-desc">
                        ไม่พบประวัติการรับบริการในช่วงเวลาที่เลือก หรือไม่มีรายการที่ตรงกับคำค้นหาและตัวกรองที่ระบุ
                      </p>
                    </td>
                  </tr>
                ) : items.map((row, idx) => (
                  <tr
                    key={row.vn || `${row.hn}-${idx}`}
                    onClick={() => {
                      setSelectedIndex(idx)
                      setModalTab('summary')
                    }}
                    title="คลิกเพื่อดูรายละเอียดและประวัติเวชระเบียน"
                  >
                    <td className="anc4-td-center font-tabular">{row.no}</td>
                    <td className="font-tabular">{formatThaiDate(row.vstdate)}</td>
                    <td className="font-tabular">{row.vsttime.slice(0, 5)}</td>
                    <td className="font-tabular">
                      <span className="anc4-code-chip">{row.hn}</span>
                    </td>
                    <td className="font-tabular">
                      <span className="anc4-code-chip">{row.cid || '—'}</span>
                    </td>
                    <td>
                      <div className="anc4-ptname">{row.ptname}</div>
                      {row.nation && row.nation !== 'ไทย' && (
                        <span className="anc4-pt-sub">สัญชาติ: {row.nation}</span>
                      )}
                    </td>
                    <td className="anc4-td-center font-tabular">{row.age ?? '—'}</td>
                    <td>{row.pttypename || '—'}</td>
                    <td>{row.department || '—'}</td>
                    <td>{row.clinic || '—'}</td>

                    {/* การวินิจฉัย */}
                    <td className="anc4-td-center">
                      {row.pdx ? <span className="anc4-code-chip">{row.pdx}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.dx0 ? <span className="anc4-code-chip">{row.dx0}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.dx1 ? <span className="anc4-code-chip">{row.dx1}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.dx2 ? <span className="anc4-code-chip">{row.dx2}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.dx3 ? <span className="anc4-code-chip">{row.dx3}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.dx4 ? <span className="anc4-code-chip">{row.dx4}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.dx5 ? <span className="anc4-code-chip">{row.dx5}</span> : '—'}
                    </td>

                    {/* หัตถการ */}
                    <td className="anc4-td-center">
                      {row.op0 ? <span className="anc4-code-chip">{row.op0}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.op1 ? <span className="anc4-code-chip">{row.op1}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.op2 ? <span className="anc4-code-chip">{row.op2}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.op3 ? <span className="anc4-code-chip">{row.op3}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.op4 ? <span className="anc4-code-chip">{row.op4}</span> : '—'}
                    </td>
                    <td className="anc4-td-center">
                      {row.op5 ? <span className="anc4-code-chip">{row.op5}</span> : '—'}
                    </td>

                    {/* รายการบริการ */}
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.listname || '—'}
                    </td>
                    <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.listname1 || '—'}
                    </td>

                    {/* ClaimCode */}
                    <td>
                      {row.authencode ? (
                        <span className="anc4-badge anc4-badge-info font-tabular">
                          {row.authencode}
                        </span>
                      ) : (
                        <span className="anc4-badge anc4-badge-neutral">ไม่มี</span>
                      )}
                    </td>

                    {/* สถานะ */}
                    <td>
                      {row.status ? (
                        <span
                          className={`anc4-badge ${
                            row.isCompensated
                              ? 'anc4-badge-ok'
                              : row.status.includes('Error')
                                ? 'anc4-badge-danger'
                                : 'anc4-badge-warn'
                          }`}
                        >
                          {row.status}
                        </span>
                      ) : (
                        <span className="anc4-badge anc4-badge-neutral">ยังไม่พบสถานะ</span>
                      )}
                    </td>

                    {/* Rep */}
                    <td>
                      {row.rep ? (
                        <span className="anc4-code-chip">{row.rep}</span>
                      ) : (
                        '—'
                      )}
                      <RcmSeamlessRepBadges row={row} />
                    </td>

                    {/* กองทุน */}
                    <td>
                      {row.subfund || row.fund ? (
                        <span className="anc4-badge anc4-badge-neutral">
                          {row.subfund || row.fund}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* ยอดชดเชย */}
                    <td className="anc4-td-num font-tabular">
                      {row.isCompensated ? (
                        <span className="text-success font-semibold">
                          ฿{formatMoney(row.compensated)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      <RcmSeamlessSubAmount row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 6. Pagination Footer ── */}
        {!loading && totalCount > 0 && (
          <footer className="anc4-pagination">
            <div className="anc4-page-info">
              แสดงหน้า <strong>{currentPage}</strong> จากทั้งหมด <strong>{totalPages}</strong> หน้า
            </div>
            <div className="anc4-page-nav">
              <button
                type="button"
                className="anc4-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="anc4-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="หน้าถัดไป"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </section>

      {/* ── 7. Patient Detail Modal ── */}
      {selectedItem && (
        <div
          className="anc4-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`รายละเอียดผู้รับบริการ ${selectedItem.ptname}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedIndex(null)
          }}
        >
          <div className="anc4-modal-card">
            <div className="anc4-modal-header">
              <div className="anc4-modal-title-area">
                <Baby size={22} className="text-accent" aria-hidden="true" />
                <div>
                  <h2 className="anc4-modal-title">{selectedItem.ptname}</h2>
                  <span className="anc4-pt-sub">
                    HN: {selectedItem.hn} • อายุ {selectedItem.age ?? '—'} ปี • VN: {selectedItem.vn}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="anc4-modal-close"
                onClick={() => setSelectedIndex(null)}
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="anc4-modal-body">
              {/* Quick Copy Chips */}
              <div className="anc4-copy-chip-row">
                <button
                  type="button"
                  className="anc4-copy-chip font-tabular"
                  onClick={() => handleCopy(selectedItem.hn, 'hn')}
                  title="คัดลอก HN"
                >
                  {copiedField === 'hn' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  HN: {selectedItem.hn}
                </button>
                <button
                  type="button"
                  className="anc4-copy-chip font-tabular"
                  onClick={() => handleCopy(selectedItem.cid, 'cid')}
                  title="คัดลอกเลขประจำตัวประชาชน"
                >
                  {copiedField === 'cid' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  CID: {selectedItem.cid}
                </button>
                <button
                  type="button"
                  className="anc4-copy-chip font-tabular"
                  onClick={() => handleCopy(selectedItem.vn, 'vn')}
                  title="คัดลอก VN"
                >
                  {copiedField === 'vn' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  VN: {selectedItem.vn}
                </button>
                {selectedItem.authencode && (
                  <button
                    type="button"
                    className="anc4-copy-chip font-tabular"
                    onClick={() => handleCopy(selectedItem.authencode!, 'authen')}
                    title="คัดลอก ClaimCode"
                  >
                    {copiedField === 'authen' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    Authen: {selectedItem.authencode}
                  </button>
                )}
                {selectedItem.rep && (
                  <button
                    type="button"
                    className="anc4-copy-chip font-tabular"
                    onClick={() => handleCopy(selectedItem.rep!, 'rep')}
                    title="คัดลอกเลขที่ Rep"
                  >
                    {copiedField === 'rep' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    Rep: {selectedItem.rep}
                  </button>
                )}
              </div>

              {/* Modal Tabs */}
              <div className="anc4-modal-tabs">
                <button
                  type="button"
                  className={`anc4-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                  onClick={() => setModalTab('summary')}
                >
                  สรุปผลตรวจและการชดเชย ANC
                </button>
                <button
                  type="button"
                  className={`anc4-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                  onClick={() => setModalTab('clinical')}
                >
                  เวชระเบียน HOSxP
                </button>
              </div>

              {modalTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* General Info Grid */}
                  <div className="anc4-modal-info-grid">
                    <div className="anc4-modal-field">
                      <span className="anc4-field-sub">วันที่และเวลารับบริการ</span>
                      <span className="anc4-field-val font-tabular">
                        {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime}
                      </span>
                    </div>
                    <div className="anc4-modal-field">
                      <span className="anc4-field-sub">สิทธิการรักษา</span>
                      <span className="anc4-field-val">{selectedItem.pttypename || '—'}</span>
                    </div>
                    <div className="anc4-modal-field">
                      <span className="anc4-field-sub">แผนก / คลินิก</span>
                      <span className="anc4-field-val">
                        {selectedItem.department || '—'} {selectedItem.clinic ? `(${selectedItem.clinic})` : ''}
                      </span>
                    </div>
                    <div className="anc4-modal-field">
                      <span className="anc4-field-sub">สถานะการชดเชย</span>
                      <span className="anc4-field-val">
                        {selectedItem.status || 'ยังไม่พบสถานะ'}
                      </span>
                    </div>
                    <div className="anc4-modal-field">
                      <span className="anc4-field-sub">ยอดเงินชดเชย</span>
                      <span className="anc4-field-val text-success font-tabular">
                        ฿{formatMoney(selectedItem.compensated)}
                      </span>
                    </div>
                    <div className="anc4-modal-field">
                      <span className="anc4-field-sub">กองทุน / กองทุนย่อย</span>
                      <span className="anc4-field-val">
                        {selectedItem.subfund || selectedItem.fund || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Diagnoses Section */}
                  <div>
                    <h3 className="anc4-modal-section-title">
                      <Activity size={16} aria-hidden="true" />
                      การวินิจฉัยโรค (Diagnoses)
                    </h3>
                    <div className="anc4-chips-wrap">
                      {selectedItem.pdx && (
                        <span className="anc4-badge anc4-badge-ok">
                          <strong>PDX:</strong> {selectedItem.pdx}
                        </span>
                      )}
                      {[
                        selectedItem.dx0,
                        selectedItem.dx1,
                        selectedItem.dx2,
                        selectedItem.dx3,
                        selectedItem.dx4,
                        selectedItem.dx5,
                      ]
                        .filter(Boolean)
                        .map((dx, dIdx) => (
                          <span key={dIdx} className="anc4-badge anc4-badge-neutral">
                            <strong>DX{dIdx}:</strong> {dx}
                          </span>
                        ))}
                      {!selectedItem.pdx && !selectedItem.dx0 && (
                        <span className="text-muted">ไม่มีข้อมูลรหัสโรค</span>
                      )}
                    </div>
                  </div>

                  {/* Procedures Section */}
                  <div>
                    <h3 className="anc4-modal-section-title">
                      <Activity size={16} aria-hidden="true" />
                      หัตถการ (Procedures)
                    </h3>
                    <div className="anc4-chips-wrap">
                      {[
                        selectedItem.op0,
                        selectedItem.op1,
                        selectedItem.op2,
                        selectedItem.op3,
                        selectedItem.op4,
                        selectedItem.op5,
                      ]
                        .filter(Boolean)
                        .map((op, oIdx) => (
                          <span key={oIdx} className="anc4-badge anc4-badge-info">
                            <strong>OP{oIdx}:</strong> {op}
                          </span>
                        ))}
                      {!selectedItem.op0 && !selectedItem.op1 && (
                        <span className="text-muted">ไม่มีการบันทึกหัตถการ</span>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <h3 className="anc4-modal-section-title">
                      <Baby size={16} aria-hidden="true" />
                      รายการบริการฝากครรภ์ที่สั่งใช้ (ADP 30011)
                    </h3>
                    <div style={{ padding: '12px 16px', background: 'var(--anc-surface-2)', borderRadius: 'var(--anc-r-md)' }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>{selectedItem.listname || '—'}</p>
                    </div>
                  </div>

                  {/* Non-drug items (listname1) */}
                  {selectedItem.listname1 && (
                    <div>
                      <h3 className="anc4-modal-section-title">
                        <ReceiptText size={16} aria-hidden="true" />
                        รายการตรวจ/เวชภัณฑ์ที่ไม่ใช่ยาในครั้งนี้ (Non-drug items)
                      </h3>
                      <div style={{ padding: '12px 16px', background: 'var(--anc-surface-2)', borderRadius: 'var(--anc-r-md)' }}>
                        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6' }}>{selectedItem.listname1}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {clinicalLoading ? (
                    <div className="anc4-loading-state">
                      <RefreshCw size={24} className="anc4-spin-icon" style={{ color: 'var(--anc-accent)' }} />
                      <p>กำลังโหลดข้อมูลเวชระเบียนจาก HOSxP...</p>
                    </div>
                  ) : clinicalError ? (
                    <div className="anc4-banner anc4-banner-warn">
                      <p><strong>ข้อผิดพลาด:</strong> {clinicalError}</p>
                    </div>
                  ) : clinicalData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="anc4-modal-info-grid">
                        <div className="anc4-modal-field">
                          <span className="anc4-field-sub">อาการสำคัญ (CC)</span>
                          <span className="anc4-field-val">{clinicalData.screen?.cc || '—'}</span>
                        </div>
                        <div className="anc4-modal-field">
                          <span className="anc4-field-sub">ประวัติปัจจุบัน (HPI)</span>
                          <span className="anc4-field-val">{clinicalData.screen?.hpi || '—'}</span>
                        </div>
                        <div className="anc4-modal-field">
                          <span className="anc4-field-sub">สัญญาณชีพ (Vitals)</span>
                          <span className="anc4-field-val font-tabular">
                            ความดัน: {clinicalData.screen?.bps ? `${clinicalData.screen.bps}/${clinicalData.screen.bpd}` : '—'} mmHg • ชีพจร: {clinicalData.screen?.pulse || '—'} bpm • อุณหภูมิ: {clinicalData.screen?.temperature || '—'} °C
                          </span>
                        </div>
                        <div className="anc4-modal-field">
                          <span className="anc4-field-sub">น้ำหนัก / ส่วนสูง</span>
                          <span className="anc4-field-val font-tabular">
                            {clinicalData.screen?.bw ? `${clinicalData.screen.bw} กก.` : '—'} • {clinicalData.screen?.height ? `${clinicalData.screen.height} ซม.` : '—'} (BMI: {clinicalData.screen?.bmi || '—'})
                          </span>
                        </div>
                      </div>

                      {clinicalData.diagnoses && clinicalData.diagnoses.length > 0 && (
                        <div>
                          <h4 className="anc4-modal-section-title">รายการวินิจฉัยในระบบ HOSxP (ovstdiag)</h4>
                          <div className="anc4-chips-wrap">
                            {clinicalData.diagnoses.map((d, i) => (
                              <span key={i} className="anc4-badge anc4-badge-neutral">
                                <strong>{d.icd10}:</strong> {d.diagtype_name || d.diagtype} {d.icd_name ? `(${d.icd_name})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>

            <div className="anc4-modal-footer">
              <button
                type="button"
                className="anc4-btn-secondary"
                disabled={selectedIndex === null || selectedIndex <= 0}
                onClick={() => {
                  setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
                }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                คนก่อนหน้า
              </button>

              <button
                type="button"
                className="anc4-btn-secondary"
                disabled={selectedIndex === null || selectedIndex >= items.length - 1}
                onClick={() => {
                  setSelectedIndex((prev) =>
                    prev !== null && prev < items.length - 1 ? prev + 1 : prev
                  )
                }}
              >
                คนถัดไป
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
