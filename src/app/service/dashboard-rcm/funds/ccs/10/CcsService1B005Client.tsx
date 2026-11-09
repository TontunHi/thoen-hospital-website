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
  ShieldCheck,
  Stethoscope,
  Activity,
  Calendar,
  CreditCard,
  Building2,
  Copy,
  Check,
} from 'lucide-react'
import type {
  CcsService1B005Item,
  CcsService1B005Summary,
  CcsService1B005CompensationFilter,
  CcsService1B005SearchField,
  CcsService1B005SortField,
  CcsAdpMappingCheck,
} from '@/lib/clinical/rcmCervicalCancerService'
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
  if (!val || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

export interface CcsService1B005ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function CcsService1B005Client({
  initialData,
  initialRange,
}: CcsService1B005ClientProps = {}) {
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

  // Date selection states: 1. กำหนดเอง (default) -> 2. รายเดือน -> 3. ปีงบประมาณ
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${curCalYear}-${String(curMonth).padStart(2, '0')}-01`)
  const [ds2, setDs2] = useState<string>(
    initialRange?.endDate || `${curCalYear}-${String(curMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )

  // Filter & Search states
  const [compensationFilter, setCompensationFilter] =
    useState<CcsService1B005CompensationFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [searchField, setSearchField] = useState<CcsService1B005SearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<CcsService1B005SortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CcsService1B005Item[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<CcsAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<CcsService1B005Summary>(
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
    async (refresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      if (refresh) setIsRefreshing(true)
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

        if (refresh) q.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/ccs/service-1b005?${q.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลบริการ 1B005 ได้')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        setAdpMapping(data.adpMapping)
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }
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
      compensationFilter,
      pttypes,
      searchField,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
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

  // Fetch VN Clinical Details for Inspection Modal
  const fetchClinicalDetails = useCallback(async (vn: string) => {
    setClinicalLoading(true)
    setClinicalError(null)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/ccs/vn-details?vn=${encodeURIComponent(vn)}`
      )
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถโหลดเวชระเบียนคลินิกได้')
      }
      setClinicalData(json.data)
    } catch (err: unknown) {
      const e = err as Error
      setClinicalError(e.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลเวชระเบียน')
    } finally {
      setClinicalLoading(false)
    }
  }, [])

  const selectedItem = useMemo(() => {
    if (selectedIndex === null || !items[selectedIndex]) return null
    return items[selectedIndex]
  }, [selectedIndex, items])

  const handleOpenDetail = (index: number) => {
    setSelectedIndex(index)
    setModalTab('summary')
    setClinicalData(null)
    const it = items[index]
    if (it) {
      fetchClinicalDetails(it.vn)
    }
  }

  const handleCloseDetail = () => {
    setSelectedIndex(null)
    setClinicalData(null)
  }

  const handlePrevPatient = () => {
    if (selectedIndex === null || selectedIndex <= 0) return
    const nextIdx = selectedIndex - 1
    setSelectedIndex(nextIdx)
    const it = items[nextIdx]
    if (it) fetchClinicalDetails(it.vn)
  }

  const handleNextPatient = () => {
    if (selectedIndex === null || selectedIndex >= items.length - 1) return
    const nextIdx = selectedIndex + 1
    setSelectedIndex(nextIdx)
    const it = items[nextIdx]
    if (it) fetchClinicalDetails(it.vn)
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Quick Filter via KPI Cards
  const handleCardClick = (filterType: CcsService1B005CompensationFilter) => {
    if (compensationFilter === filterType) {
      setCompensationFilter('ALL')
    } else {
      setCompensationFilter(filterType)
    }
    setCurrentPage(1)
  }

  // Sorting Handler
  const handleSort = (field: CcsService1B005SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'vstdate' ? 'desc' : 'asc')
    }
    setCurrentPage(1)
  }

  const renderSortIndicator = (field: CcsService1B005SortField) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp size={13} className="ccs10-sort-active" />
      ) : (
        <ArrowDown size={13} className="ccs10-sort-active" />
      )
    }
    return <ArrowUpDown size={13} className="ccs10-sort-muted" />
  }

  // Excel Export Handler
  const handleExportExcel = async () => {
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

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/ccs/service-1b005?${q.toString()}`
      )
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'ส่งออกไฟล์ Excel ไม่สำเร็จ')
      }

      const allItems: CcsService1B005Item[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'VN',
        'CID',
        'HN',
        'ชื่อ-สกุล',
        'อายุ (ปี)',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'เลข ClaimCode',
        'สิทธิ์การรักษา',
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
        'รายการตรวจ 1B005',
        'สถานะการชดเชย',
        'เลขที่หนังสือ (Rep)',
        'ยอดชดเชย (บาท)',
      ]

      const rows = allItems.map((r) => [
        r.no,
        r.vn,
        r.cid,
        r.hn,
        r.ptname,
        r.age ?? '',
        r.nation ?? '',
        r.vstdate,
        r.vsttime,
        r.authencode ?? '',
        r.pttypename ?? '',
        r.department ?? '',
        r.clinic ?? '',
        r.pdx ?? '',
        r.dx0 ?? '',
        r.dx1 ?? '',
        r.dx2 ?? '',
        r.dx3 ?? '',
        r.dx4 ?? '',
        r.dx5 ?? '',
        r.op0 ?? '',
        r.op1 ?? '',
        r.op2 ?? '',
        r.op3 ?? '',
        r.op4 ?? '',
        r.op5 ?? '',
        r.listname ?? '',
        r.status ?? '',
        r.rep ?? '',
        r.compensated,
      ])

      await exportRcmExcel({
        filename: `CCS_1_10_Service_1B005_${ds1}_to_${ds2}.xlsx`,
        title: 'รายงานผู้รับบริการตรวจคัดกรองมะเร็งปากมดลูก บริการ 1B005',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${allItems.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'ส่งออกไฟล์ Excel ไม่สำเร็จ')
    } finally {
      setIsExporting(false)
    }
  }

  const resetFilters = () => {
    setCompensationFilter('ALL')
    setPttypes([])
    setSearchField('ALL')
    setSearch('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    compensationFilter !== 'ALL' ||
    pttypes.length > 0 ||
    searchField !== 'ALL' ||
    debouncedSearch.length > 0

  return (
    <div className="ccs10-page">
      {/* ── 1. Header Bar ── */}
      <header className="ccs10-header">
        <div className="ccs10-title-group">
          <nav className="ccs10-breadcrumb" aria-label="แถบนำทาง">
            <a href="/service/dashboard-rcm" className="ccs10-breadcrumb-link">
              Dashboard RCM
            </a>
            <span className="ccs10-breadcrumb-sep" aria-hidden="true">/</span>
            <a href="/service/dashboard-rcm/funds/ccs" className="ccs10-breadcrumb-link">
              กองทุนมะเร็งปากมดลูก (CCS)
            </a>
            <span className="ccs10-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="ccs10-breadcrumb-current">บริการ 1B005</span>
          </nav>
          <h1 className="ccs10-title">1.10 บริการ 1B005</h1>
          <p className="ccs10-subtitle">
            รายงานผู้รับบริการตรวจคัดกรองมะเร็งปากมดลูกด้วยรหัส ADP 1B005 ตรวจสอบการสั่งใช้รหัส ADP การวินิจฉัย (ICD-10) หัตถการ (ICD-9) และการชดเชยค่าบริการ e-Claim / สปสช.
          </p>
        </div>

        <div className="ccs10-header-actions">
          <button
            type="button"
            className="ccs10-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            aria-busy={isRefreshing}
            title="รีเฟรชข้อมูลจากฐานข้อมูล HOSxP"
          >
            <RefreshCw size={16} className={isRefreshing ? 'ccs10-spin-icon' : undefined} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="ccs10-btn-primary"
            onClick={handleExportExcel}
            disabled={loading || isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. ADP Mapping Warning Banner ── */}
      {!adpMapping.isMapped && (
        <div className="ccs10-banner ccs10-banner-warn" role="alert">
          <div className="ccs10-banner-content">
            <AlertTriangle size={20} />
            <span>
              <strong>แจ้งเตือน:</strong> คุณยังไม่ได้ Map ADP Code <code>1B005</code> ในตาราง{' '}
              <code>s_drugitems</code> ของระบบ HOSxP
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Date Selection Ribbon (Order: กำหนดเอง -> รายเดือน -> ปีงบประมาณ) ── */}
      <section className="ccs10-date-card">
        <div className="ccs10-date-row">
          <div className="ccs10-mode-tabs" role="tablist" aria-label="โหมดการเลือกช่วงเวลา">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`ccs10-mode-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => setDateMode('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`ccs10-mode-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => setDateMode('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`ccs10-mode-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => setDateMode('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="ccs10-date-divider" aria-hidden="true" />

          {/* Controls based on active date mode */}
          {dateMode === 'custom' && (
            <div className="ccs10-date-inputs">
              <span className="ccs10-filter-label">ตั้งแต่วันที่:</span>
              <ThaiDatePicker value={ds1} onChange={(val) => setDs1(val)} />
              <span className="ccs10-filter-label">ถึง:</span>
              <ThaiDatePicker value={ds2} onChange={(val) => setDs2(val)} />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="ccs10-date-inputs">
              <select
                className="ccs10-date-select"
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
              <select
                className="ccs10-date-select"
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

          {dateMode === 'fiscal' && (
            <div className="ccs10-date-inputs">
              <span className="ccs10-filter-label">ปีงบประมาณ:</span>
              <select
                className="ccs10-date-select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
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

      {/* Global error alert */}
      {error && (
        <div
          className="ccs10-banner ccs10-banner-warn"
          style={{
            background: 'var(--ccs-err-bg)',
            borderColor: 'var(--ccs-err-border)',
            color: 'var(--ccs-err)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* ── 4. Interactive KPI Summary Ribbon ── */}
      <section className="ccs10-kpi-grid">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'ALL'}
          className={`ccs10-kpi-card ${
            compensationFilter === 'ALL' ? 'is-active-filter' : ''
          }`}
          onClick={() => handleCardClick('ALL')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('ALL')}
          title="คลิกเพื่อแสดงรายการรับบริการทั้งหมด"
        >
          <span className="ccs10-kpi-label">
            จำนวนรับบริการทั้งหมด
            {compensationFilter === 'ALL' && (
              <span className="ccs10-kpi-filter-tag">กำลังแสดง</span>
            )}
          </span>
          <span className="ccs10-kpi-value">{summary.totalVisits.toLocaleString('th-TH')}</span>
          <span className="ccs10-kpi-sub">
            จำนวน {summary.uniquePatients.toLocaleString('th-TH')} คน (HN ไม่ซ้ำ)
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'COMPENSATED'}
          className={`ccs10-kpi-card ${
            compensationFilter === 'COMPENSATED' ? 'is-active-filter-success' : ''
          }`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <span className="ccs10-kpi-label">
            ได้รับการชดเชยแล้ว
            {compensationFilter === 'COMPENSATED' && (
              <span className="ccs10-kpi-filter-tag">กำลังกรอง</span>
            )}
          </span>
          <span className="ccs10-kpi-value ccs10-kpi-val-ok">
            {summary.compensatedVisits.toLocaleString('th-TH')}
          </span>
          <span className="ccs10-kpi-sub" style={{ color: 'var(--ccs-ok)' }}>
            อัตราชดเชย {summary.compensationRate}%
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'UNCOMPENSATED'}
          className={`ccs10-kpi-card ${
            compensationFilter === 'UNCOMPENSATED' ? 'is-active-filter-warn' : ''
          }`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ได้รับการชดเชย"
        >
          <span className="ccs10-kpi-label">
            ยังไม่ได้รับการชดเชย
            {compensationFilter === 'UNCOMPENSATED' && (
              <span className="ccs10-kpi-filter-tag">กำลังกรอง</span>
            )}
          </span>
          <span className="ccs10-kpi-value ccs10-kpi-val-err">
            {summary.uncompensatedVisits.toLocaleString('th-TH')}
          </span>
          <span className="ccs10-kpi-sub" style={{ color: 'var(--ccs-err)' }}>
            รอผลชดเชย / ติดข้อผิดพลาด
          </span>
        </div>

        <div className="ccs10-kpi-card" style={{ cursor: 'default' }}>
          <span className="ccs10-kpi-label">ยอดเงินชดเชยรวม</span>
          <span className="ccs10-kpi-value ccs10-kpi-val-ok">
            {summary.totalCompensated.toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="ccs10-kpi-sub">
            เฉลี่ย ฿{summary.averageCompensated.toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} / รายที่ชดเชย
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'HAS_AUTHEN'}
          className={`ccs10-kpi-card ${
            compensationFilter === 'HAS_AUTHEN' ? 'is-active-filter' : ''
          }`}
          onClick={() => handleCardClick('HAS_AUTHEN')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('HAS_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <span className="ccs10-kpi-label">
            มี ClaimCode
            {compensationFilter === 'HAS_AUTHEN' && (
              <span className="ccs10-kpi-filter-tag">กำลังกรอง</span>
            )}
          </span>
          <span className="ccs10-kpi-value">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
          <span className="ccs10-kpi-sub">
            พร้อมส่งเบิก e-Claim
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'NO_AUTHEN'}
          className={`ccs10-kpi-card ${
            compensationFilter === 'NO_AUTHEN' ? 'is-active-filter-warn' : ''
          }`}
          onClick={() => handleCardClick('NO_AUTHEN')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('NO_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่มี ClaimCode"
        >
          <span className="ccs10-kpi-label">
            ไม่มี ClaimCode
            {compensationFilter === 'NO_AUTHEN' && (
              <span className="ccs10-kpi-filter-tag">กำลังกรอง</span>
            )}
          </span>
          <span
            className={`ccs10-kpi-value ${summary.withoutAuthenCount > 0 ? 'ccs10-kpi-val-err' : ''}`}
          >
            {summary.withoutAuthenCount.toLocaleString('th-TH')}
          </span>
          <span className="ccs10-kpi-sub">
            ต้องขอรหัส Authen จาก สปสช.
          </span>
        </div>
      </section>

      {/* ── 5. Filter & Search Controls Bar ── */}
      <section className="ccs10-filter-card">
        <div className="ccs10-filter-group">
          <span className="ccs10-filter-label">สถานะชดเชย:</span>
          <select
            className="ccs10-date-select"
            value={compensationFilter}
            onChange={(e) => {
              setCompensationFilter(e.target.value as CcsService1B005CompensationFilter)
              setCurrentPage(1)
            }}
            aria-label="ตัวกรองสถานะชดเชย"
          >
            <option value="ALL">ทั้งหมด (ทุกสถานะ)</option>
            <option value="COMPENSATED">ได้รับการชดเชยแล้ว</option>
            <option value="UNCOMPENSATED">ยังไม่ได้รับการชดเชย</option>
            <option value="HAS_AUTHEN">มี ClaimCode</option>
            <option value="NO_AUTHEN">ไม่มี ClaimCode</option>
          </select>

          <span className="ccs10-filter-label" style={{ marginLeft: '8px' }}>
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

        <div className="ccs10-search-box">
          <div className="ccs10-search-input-wrap">
            <Search size={16} className="ccs10-search-icon" />
            <input
              type="text"
              className="ccs10-search-input"
              placeholder="พิมพ์คำค้นหา (ชื่อ, HN, CID, วินิจฉัย)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ค้นหาข้อมูล"
            />
            {search && (
              <button
                type="button"
                className="ccs10-search-clear"
                onClick={() => setSearch('')}
                title="ล้างข้อความค้นหา"
                aria-label="ล้างข้อความค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="ccs10-btn-ghost"
              onClick={resetFilters}
              title="ล้างตัวกรองและการค้นหาทั้งหมด"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </section>

      {/* ── 6. Clinical Audit Ledger Table (Double-tier Merged Header) ── */}
      <section className="ccs10-table-card">
        <div className="ccs10-table-wrapper">
          <table className="ccs10-table">
            <thead>
              {/* Single Tier Centered Header */}
              <tr>
                <th className="ccs10-align-center" style={{ width: '45px' }}>
                  ลำดับ
                </th>
                <th
                  className="is-sortable ccs10-align-center"
                  onClick={() => handleSort('vstdate')}
                  title="คลิกเพื่อเรียงตามวันที่รับบริการ"
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-center">
                    <span>วันที่-เวลา</span>
                    {renderSortIndicator('vstdate')}
                  </div>
                </th>
                <th className="ccs10-align-center">VN</th>
                <th
                  className="is-sortable ccs10-align-center"
                  onClick={() => handleSort('hn')}
                  title="คลิกเพื่อเรียงตาม HN"
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-center">
                    <span>HN</span>
                    {renderSortIndicator('hn')}
                  </div>
                </th>
                <th
                  className="is-sortable ccs10-align-center"
                  onClick={() => handleSort('cid')}
                  title="คลิกเพื่อเรียงตาม CID"
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-center">
                    <span>เลขประจำตัวประชาชน</span>
                    {renderSortIndicator('cid')}
                  </div>
                </th>
                <th
                  className="is-sortable"
                  onClick={() => handleSort('ptname')}
                  title="คลิกเพื่อเรียงตามชื่อ-สกุล"
                >
                  <div className="ccs10-th-sort-inner">
                    <span>ชื่อ-สกุล</span>
                    {renderSortIndicator('ptname')}
                  </div>
                </th>
                <th
                  className="ccs10-align-center is-sortable"
                  onClick={() => handleSort('age')}
                  title="คลิกเพื่อเรียงตามอายุ"
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-center">
                    <span>อายุ</span>
                    {renderSortIndicator('age')}
                  </div>
                </th>
                <th>สิทธิการรักษา</th>
                <th>แผนก / คลินิก</th>
                <th
                  className="is-sortable ccs10-align-center"
                  onClick={() => handleSort('authencode')}
                  title="คลิกเพื่อเรียงตาม ClaimCode"
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-center">
                    <span>ClaimCode</span>
                    {renderSortIndicator('authencode')}
                  </div>
                </th>

                {/* Diagnosis Group (PDX, DX0 - DX5) */}
                <th
                  className="is-sortable ccs10-align-center"
                  onClick={() => handleSort('pdx')}
                  title="คลิกเพื่อเรียงตาม PDX"
                  style={{ background: 'var(--ccs-surface-2)' }}
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-center">
                    <span>PDX</span>
                    {renderSortIndicator('pdx')}
                  </div>
                </th>
                <th className="ccs10-align-center" style={{ background: 'var(--ccs-surface-2)' }}>DX0</th>
                <th className="ccs10-align-center" style={{ background: 'var(--ccs-surface-2)' }}>DX1</th>
                <th className="ccs10-align-center" style={{ background: 'var(--ccs-surface-2)' }}>DX2</th>
                <th className="ccs10-align-center" style={{ background: 'var(--ccs-surface-2)' }}>DX3</th>
                <th className="ccs10-align-center" style={{ background: 'var(--ccs-surface-2)' }}>DX4</th>
                <th className="ccs10-align-center" style={{ background: 'var(--ccs-surface-2)' }}>DX5</th>

                {/* Procedure Group (OP0 - OP5) */}
                <th className="ccs10-align-center">OP0</th>
                <th className="ccs10-align-center">OP1</th>
                <th className="ccs10-align-center">OP2</th>
                <th className="ccs10-align-center">OP3</th>
                <th className="ccs10-align-center">OP4</th>
                <th className="ccs10-align-center">OP5</th>

                {/* Listname */}
                <th>รายการ 1B005</th>

                {/* Compensation */}
                <th className="ccs10-align-center">สถานะ</th>
                <th className="ccs10-align-center">เลขที่หนังสือ</th>
                <th
                  className="ccs10-align-right is-sortable"
                  onClick={() => handleSort('compensated')}
                  title="คลิกเพื่อเรียงตามยอดชดเชย"
                >
                  <div className="ccs10-th-sort-inner ccs10-justify-end">
                    <span>ยอดชดเชย</span>
                    {renderSortIndicator('compensated')}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, idx) => (
                  <tr key={`skel-${idx}`}>
                    <td colSpan={27}>
                      <div className="ccs10-skeleton-line" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={27}>
                    <div className="ccs10-empty-state">
                      <p>ไม่พบข้อมูลการรับบริการ 1B005 ตามเงื่อนไขและช่วงเวลาที่ระบุ</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="ccs10-btn-secondary"
                          onClick={resetFilters}
                        >
                          ล้างตัวกรองทั้งหมด
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={it.vn}
                    className="ccs10-row-interactive"
                    onClick={() => handleOpenDetail(idx)}
                    title="คลิกทั้งแถวเพื่อดูรายละเอียดเวชระเบียน"
                  >
                    <td className="ccs10-align-center">{it.no}</td>
                    <td className="ccs10-align-center">
                      <div>{it.vstdate ? formatThaiDate(it.vstdate) : '—'}</div>
                      {it.vsttime && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--ccs-muted)', fontFamily: 'var(--ccs-font-mono)' }}>
                          {it.vsttime}&nbsp;น.
                        </div>
                      )}
                    </td>
                    <td className="ccs10-align-center">
                      <button
                        type="button"
                        className="ccs10-link-vn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetail(idx)
                        }}
                        title="คลิกเพื่อเปิดเวชระเบียนคลินิก"
                      >
                        {it.vn}
                      </button>
                    </td>
                    <td className="ccs10-mono ccs10-align-center">{it.hn}</td>
                    {/* Thai Citizen ID always full 13-digits without masking */}
                    <td className="ccs10-mono ccs10-align-center">{formatCidDisplay(it.cid)}</td>
                    <td>
                      <span className="ccs10-pt-name">{it.ptname}</span>
                    </td>
                    <td className="ccs10-align-center">
                      {it.age != null ? `${it.age}\u00A0ปี` : '—'}
                    </td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.pttypename || '—'}
                    </td>
                    <td>
                      <div>{it.department || '—'}</div>
                      {it.clinic && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--ccs-muted)' }}>
                          {it.clinic}
                        </div>
                      )}
                    </td>
                    <td className="ccs10-align-center">
                      {it.authencode ? (
                        <span className="ccs10-badge ccs10-badge-success">{it.authencode}</span>
                      ) : (
                        <span className="ccs10-badge ccs10-badge-ghost">ไม่มี ClaimCode</span>
                      )}
                    </td>

                    {/* Diagnoses */}
                    <td className="ccs10-mono ccs10-align-center" style={{ fontWeight: 600 }}>
                      {it.pdx || '—'}
                    </td>
                    <td className="ccs10-mono ccs10-align-center">{it.dx0 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.dx1 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.dx2 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.dx3 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.dx4 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.dx5 || '—'}</td>

                    {/* Procedures */}
                    <td className="ccs10-mono ccs10-align-center">{it.op0 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.op1 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.op2 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.op3 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.op4 || '—'}</td>
                    <td className="ccs10-mono ccs10-align-center">{it.op5 || '—'}</td>

                    {/* Item listname */}
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.listname || '—'}
                    </td>

                    {/* Status & Rep */}
                    <td className="ccs10-align-center">
                      {it.status ? (
                        <span
                          className={`ccs10-badge ${
                            it.isCompensated
                              ? 'ccs10-badge-success'
                              : it.status.includes('Error')
                              ? 'ccs10-badge-danger'
                              : 'ccs10-badge-info'
                          }`}
                        >
                          {it.status}
                        </span>
                      ) : (
                        <span className="ccs10-badge ccs10-badge-ghost">รอส่งเบิก</span>
                      )}
                    </td>
                    <td className="ccs10-mono ccs10-align-center">{it.rep || '—'}</td>
                    <td
                      className="ccs10-align-right ccs10-mono"
                      style={{
                        fontWeight: 600,
                        color: it.isCompensated ? 'var(--ccs-ok)' : 'var(--ccs-ink)',
                      }}
                    >
                      {formatMoney(it.compensated)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 7. Pagination Toolbar ── */}
        <div className="ccs10-table-footer">
          <div>
            แสดง {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{' '}
            {Math.min(currentPage * pageSize, totalCount)} จากทั้งหมด {totalCount.toLocaleString()} รายการ
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ccs10-filter-label">แสดงหน้าละ:</span>
              <select
                className="ccs10-date-select"
                style={{ height: '32px', padding: '0 8px' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                aria-label="จำนวนรายการต่อหน้า"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div className="ccs10-pagination">
              <button
                type="button"
                className="ccs10-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="หน้าแรก"
              >
                «
              </button>
              <button
                type="button"
                className="ccs10-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={14} />
              </button>

              <span style={{ padding: '0 8px', fontSize: 'var(--ccs-text-xs)', fontWeight: 600 }}>
                หน้า {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="ccs10-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="ccs10-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="หน้าสุดท้าย"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Patient Detail Inspection Modal ── */}
      {selectedItem && (
        <div
          className="ccs10-modal-backdrop"
          onClick={handleCloseDetail}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-patient-title"
        >
          <div className="ccs10-modal-window" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="ccs10-modal-header">
              <div>
                <h2 id="modal-patient-title" className="ccs10-modal-title">
                  เวชระเบียนผู้รับบริการ: {selectedItem.ptname}
                </h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <span className="ccs10-badge ccs10-badge-ghost">HN: {selectedItem.hn}</span>
                  <span className="ccs10-badge ccs10-badge-ghost">VN: {selectedItem.vn}</span>
                  <span className="ccs10-badge ccs10-badge-ghost">
                    CID: {formatCidDisplay(selectedItem.cid)}
                  </span>
                  {selectedItem.isCompensated && (
                    <span className="ccs10-badge ccs10-badge-success">
                      ชดเชย ฿{formatMoney(selectedItem.compensated)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="ccs10-page-btn"
                  onClick={handlePrevPatient}
                  disabled={selectedIndex === 0}
                  title="ผู้ป่วยคนก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="ccs10-page-btn"
                  onClick={handleNextPatient}
                  disabled={selectedIndex === items.length - 1}
                  title="ผู้ป่วยคนถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="ccs10-btn-ghost"
                  onClick={handleCloseDetail}
                  title="ปิดหน้าต่าง"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Tab Navigation (Pinned Tab Bar) */}
            <div className="ccs10-modal-tabs">
              <button
                type="button"
                className={`ccs10-modal-tab-btn ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปผลคัดกรองและการชดเชย
              </button>
              <button
                type="button"
                className={`ccs10-modal-tab-btn ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก HOSxP
              </button>
            </div>

            {/* Modal Body */}
            <div className="ccs10-modal-body">
              {modalTab === 'summary' && (
                <>
                  <div className="ccs10-desc-grid">
                    <div className="ccs10-desc-item">
                      <span className="ccs10-desc-label">เลขประจำตัวประชาชน (CID)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="ccs10-desc-value ccs10-mono">
                          {formatCidDisplay(selectedItem.cid)}
                        </span>
                        <button
                          type="button"
                          className="ccs10-btn-ghost"
                          style={{ minHeight: 'auto', padding: '2px 6px' }}
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอก CID"
                        >
                          {copiedField === 'cid' ? <Check size={12} color="var(--ccs-ok)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div className="ccs10-desc-item">
                      <span className="ccs10-desc-label">เลข ClaimCode</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="ccs10-desc-value ccs10-mono">
                          {selectedItem.authencode || '—'}
                        </span>
                        {selectedItem.authencode && (
                          <button
                            type="button"
                            className="ccs10-btn-ghost"
                            style={{ minHeight: 'auto', padding: '2px 6px' }}
                            onClick={() => handleCopy(selectedItem.authencode!, 'authen')}
                            title="คัดลอก ClaimCode"
                          >
                            {copiedField === 'authen' ? <Check size={12} color="var(--ccs-ok)" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="ccs10-desc-item">
                      <span className="ccs10-desc-label">วันที่รับบริการ</span>
                      <span className="ccs10-desc-value">
                        {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime} น.
                      </span>
                    </div>

                    <div className="ccs10-desc-item">
                      <span className="ccs10-desc-label">สิทธิการรักษา</span>
                      <span className="ccs10-desc-value">{selectedItem.pttypename || '—'}</span>
                    </div>

                    <div className="ccs10-desc-item">
                      <span className="ccs10-desc-label">แผนก / คลินิก</span>
                      <span className="ccs10-desc-value">
                        {selectedItem.department || '—'}
                        {selectedItem.clinic ? ` / ${selectedItem.clinic}` : ''}
                      </span>
                    </div>

                    <div className="ccs10-desc-item">
                      <span className="ccs10-desc-label">รายการตรวจที่สั่งใช้ (1B005)</span>
                      <span className="ccs10-desc-value" style={{ fontWeight: 600 }}>
                        {selectedItem.listname || '—'}
                      </span>
                    </div>
                  </div>

                  <hr style={{ borderColor: 'var(--ccs-hairline-soft)', margin: '8px 0' }} />

                  <div>
                    <h3
                      style={{
                        fontSize: 'var(--ccs-text-sm)',
                        fontWeight: 700,
                        color: 'var(--ccs-ink)',
                        marginBottom: '8px',
                      }}
                    >
                      การวินิจฉัยโรคและหัตถการ
                    </h3>
                    <div className="ccs10-desc-grid">
                      <div className="ccs10-desc-item">
                        <span className="ccs10-desc-label">การวินิจฉัยหลัก (PDX)</span>
                        <span
                          className="ccs10-desc-value ccs10-mono"
                          style={{ fontWeight: 700, color: 'var(--ccs-accent-dark)' }}
                        >
                          {selectedItem.pdx || '—'}
                        </span>
                      </div>
                      <div className="ccs10-desc-item">
                        <span className="ccs10-desc-label">การวินิจฉัยร่วม (DX0 - DX5)</span>
                        <span className="ccs10-desc-value ccs10-mono">
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
                      <div className="ccs10-desc-item">
                        <span className="ccs10-desc-label">หัตถการ (OP0 - OP5)</span>
                        <span className="ccs10-desc-value ccs10-mono">
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

                  <hr style={{ borderColor: 'var(--ccs-hairline-soft)', margin: '8px 0' }} />

                  <div>
                    <h3
                      style={{
                        fontSize: 'var(--ccs-text-sm)',
                        fontWeight: 700,
                        color: 'var(--ccs-ink)',
                        marginBottom: '8px',
                      }}
                    >
                      สถานะการเบิกจ่ายและชดเชยค่าบริการ
                    </h3>
                    <div className="ccs10-desc-grid">
                      <div className="ccs10-desc-item">
                        <span className="ccs10-desc-label">สถานะการชดเชย</span>
                        <span className="ccs10-desc-value">{selectedItem.status || 'รอส่งเบิก'}</span>
                      </div>
                      <div className="ccs10-desc-item">
                        <span className="ccs10-desc-label">เลขที่หนังสือ (Rep Number)</span>
                        <span className="ccs10-desc-value ccs10-mono">{selectedItem.rep || '—'}</span>
                      </div>
                      <div className="ccs10-desc-item">
                        <span className="ccs10-desc-label">ยอดเงินชดเชยที่ได้รับ</span>
                        <span
                          className="ccs10-desc-value ccs10-mono"
                          style={{
                            fontWeight: 700,
                            color: selectedItem.isCompensated ? 'var(--ccs-ok)' : 'var(--ccs-ink)',
                          }}
                        >
                          ฿{formatMoney(selectedItem.compensated)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {clinicalLoading ? (
                    <div className="ccs10-empty-state">
                      <RefreshCw size={24} className="ccs10-spin-icon" />
                      <p>กำลังดึงข้อมูลเวชระเบียนทางคลินิกจาก HOSxP...</p>
                    </div>
                  ) : clinicalError ? (
                    <div
                      className="ccs10-banner ccs10-banner-warn"
                      style={{
                        background: 'var(--ccs-err-bg)',
                        borderColor: 'var(--ccs-err-border)',
                        color: 'var(--ccs-err)',
                      }}
                    >
                      {clinicalError}
                    </div>
                  ) : clinicalData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Vitals */}
                      {clinicalData.screen && (
                        <div
                          style={{
                            background: 'var(--ccs-surface-2)',
                            padding: '12px',
                            borderRadius: '8px',
                            display: 'flex',
                            gap: '16px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <strong>ความดันโลหิต:</strong> {clinicalData.screen.bps || '—'}/
                            {clinicalData.screen.bpd || '—'} mmHg
                          </div>
                          <div>
                            <strong>ชีพจร:</strong> {clinicalData.screen.pulse || '—'} bpm
                          </div>
                          <div>
                            <strong>อุณหภูมิ:</strong> {clinicalData.screen.temperature || '—'} °C
                          </div>
                          <div>
                            <strong>น้ำหนัก:</strong> {clinicalData.screen.bw || '—'} kg
                          </div>
                          <div>
                            <strong>ส่วนสูง:</strong> {clinicalData.screen.height || '—'} cm
                          </div>
                          <div>
                            <strong>BMI:</strong> {clinicalData.screen.bmi || '—'}
                          </div>
                        </div>
                      )}

                      {/* Drug & Items */}
                      <div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>
                          รายการยาและเวชภัณฑ์ที่สั่งจ่าย
                        </h4>
                        {!clinicalData.orders?.items || clinicalData.orders.items.length === 0 ? (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--ccs-muted)' }}>
                            ไม่พบรายการสั่งจ่ายยา/เวชภัณฑ์
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {clinicalData.orders.items.map((ord, i) => (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  background: 'var(--ccs-surface)',
                                  border: '1px solid var(--ccs-hairline)',
                                  borderRadius: '6px',
                                  fontSize: '0.8125rem',
                                }}
                              >
                                <span>{ord.item_name || ord.income_name}</span>
                                <span className="ccs10-mono">{formatMoney(ord.sum_price)} บ.</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="ccs10-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="ccs10-page-btn"
                  onClick={handlePrevPatient}
                  disabled={selectedIndex === 0}
                >
                  <ChevronLeft size={16} /> คนก่อนหน้า
                </button>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  {selectedIndex !== null ? selectedIndex + 1 : 1} จาก {items.length}
                </span>
                <button
                  type="button"
                  className="ccs10-page-btn"
                  onClick={handleNextPatient}
                  disabled={selectedIndex === items.length - 1}
                >
                  คนถัดไป <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="ccs10-btn-secondary"
                  onClick={handleCloseDetail}
                  style={{ marginLeft: '12px' }}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
