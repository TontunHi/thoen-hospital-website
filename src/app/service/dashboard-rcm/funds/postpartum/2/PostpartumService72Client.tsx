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
  Calendar,
  Filter,
  HeartPulse,
  ReceiptText,
  UserCheck,
  Sparkles,
} from 'lucide-react'
import type {
  PostpartumService72Item,
  PostpartumService72Summary,
  PostpartumCompensationFilter,
  PostpartumSearchField,
  PostpartumSortField,
  PostpartumAdpMappingCheck,
} from '@/lib/clinical/rcmPostpartumService'
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

export interface PostpartumService72ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function PostpartumService72Client({
  initialData,
  initialRange,
}: PostpartumService72ClientProps = {}) {
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

  // Date selection states (Default to Custom)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter & Search states
  const [compensationFilter, setCompensationFilter] = useState<PostpartumCompensationFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [searchField, setSearchField] = useState<PostpartumSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<PostpartumSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PostpartumService72Item[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<PostpartumAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<PostpartumService72Summary>(
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

        const res = await fetch(`/api/service/dashboard-rcm/funds/postpartum/service-30015?${q.toString()}`, {
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

    fetch(`/api/service/dashboard-rcm/funds/postpartum/vn-details?vn=${selectedItem.vn}`)
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
  const handleSort = (field: PostpartumSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: PostpartumSortField) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="pnc72-sort-idle" aria-hidden="true" />
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="pnc72-sort-active" aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className="pnc72-sort-active" aria-hidden="true" />
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

      const res = await fetch(`/api/service/dashboard-rcm/funds/postpartum/service-30015?${q.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')
      }

      const rows: PostpartumService72Item[] = json.data.items || []
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
        'รายการ ADP 30015',
        'รายการค่าบริการอื่นๆ',
        'สถานะการชดเชย',
        'เลขที่หนังสือ (REP)',
        'ยอดชดเชย (บาท)',
        'กองทุน (Fund)',
        'กองทุนย่อย (Subfund)',
      ]

      const csvRows = rows.map((r, i) => [
        i + 1,
        `"${r.vn}"`,
        `"${r.hn}"`,
        `"${r.cid}"`,
        `"${r.ptname}"`,
        r.age ?? '',
        `"${r.nation || ''}"`,
        `"${r.vstdate}"`,
        `"${r.vsttime}"`,
        `"${r.authencode || ''}"`,
        `"${r.pttypename || ''}"`,
        `"${r.department || ''}"`,
        `"${r.clinic || ''}"`,
        `"${r.pdx || ''}"`,
        `"${r.dx0 || ''}"`,
        `"${r.dx1 || ''}"`,
        `"${r.dx2 || ''}"`,
        `"${r.dx3 || ''}"`,
        `"${r.dx4 || ''}"`,
        `"${r.dx5 || ''}"`,
        `"${r.op0 || ''}"`,
        `"${r.op1 || ''}"`,
        `"${r.op2 || ''}"`,
        `"${r.op3 || ''}"`,
        `"${r.op4 || ''}"`,
        `"${r.op5 || ''}"`,
        `"${(r.listname || '').replace(/"/g, '""')}"`,
        `"${(r.listname1 || '').replace(/"/g, '""')}"`,
        `"${r.status || ''}"`,
        `"${r.rep || ''}"`,
        r.compensated,
        `"${r.fund || ''}"`,
        `"${r.subfund || ''}"`,
      ])

      await exportRcmExcel({
        filename: `rcm_postpartum_7_2_30015_${ds1}_to_${ds2}.xlsx`,
        title: 'การตรวจหลังคลอด ADP (30015)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: csvRows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert(`เกิดข้อผิดพลาดในการส่งออกไฟล์: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="pnc72-page">
      {/* ── 1. Header Bar ── */}
      <header className="pnc72-header">
        <div className="pnc72-title-group">
          <h1 className="pnc72-title">การตรวจหลังคลอด ADP</h1>
          <p className="pnc72-subtitle">
            ติดตามบริการตรวจหลังคลอด รหัส ADP <strong>30015</strong> (โครงการตรวจหลังคลอด Z390-391-392)
            ตรวจสอบการขอรหัส ClaimCode การวินิจฉัย และสถานะการชดเชยค่าบริการ
          </p>
        </div>

        <div className="pnc72-header-actions">
          <button
            type="button"
            className="pnc72-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="pnc72-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || items.length === 0}
            aria-label="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} aria-hidden="true" />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. ADP Mapping Alert Banner ── */}
      {!adpMapping.isMapped && (
        <div className="pnc72-alert-banner warning" role="alert">
          <div className="pnc72-alert-content">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong>ยังไม่ได้ Map ADP Code:</strong> ไม่พบรหัส <strong>30015</strong> ในตาราง{' '}
              <code>s_drugitems</code> กรุณาตรวจสอบการตั้งค่า Map ADP Code ในระบบ HOSxP
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Date Selection Panel ── */}
      <section className="pnc72-date-panel" aria-label="ตัวเลือกช่วงเวลา">
        <div className="pnc72-date-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`pnc72-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => setDateMode('custom')}
          >
            <Calendar size={16} aria-hidden="true" />
            <span>กำหนดเอง</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`pnc72-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setDateMode('monthly')}
          >
            <Calendar size={16} aria-hidden="true" />
            <span>เดือน</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`pnc72-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => setDateMode('fiscal')}
          >
            <Calendar size={16} aria-hidden="true" />
            <span>ปีงบประมาณ</span>
          </button>
        </div>

        <div className="pnc72-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="pnc72-control-group">
                <label htmlFor="pnc-date-start" className="pnc72-control-label">
                  ตั้งแต่วันที่:
                </label>
                <ThaiDatePicker
                  id="pnc-date-start"
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>

              <div className="pnc72-control-group">
                <label htmlFor="pnc-date-end" className="pnc72-control-label">
                  ถึงวันที่:
                </label>
                <ThaiDatePicker
                  id="pnc-date-end"
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
              <div className="pnc72-control-group">
                <label htmlFor="pnc-month-select" className="pnc72-control-label">
                  เดือน:
                </label>
                <select
                  id="pnc-month-select"
                  className="pnc72-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pnc72-control-group">
                <label htmlFor="pnc-year-select" className="pnc72-control-label">
                  ปี พ.ศ.:
                </label>
                <select
                  id="pnc-year-select"
                  className="pnc72-select"
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
            </>
          )}

          {dateMode === 'fiscal' && (
            <div className="pnc72-control-group">
              <label htmlFor="pnc-fiscal-select" className="pnc72-control-label">
                ปีงบประมาณ พ.ศ.:
              </label>
              <select
                id="pnc-fiscal-select"
                className="pnc72-select"
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
      </section>

      {/* ── 4. Interactive Summary KPI Cards ── */}
      <section className="pnc72-cards-grid" aria-label="สรุปสถิติและตัวกรองข้อมูล">
        {/* Card 1: All Visits */}
        <button
          type="button"
          className={`pnc72-card ${compensationFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter('ALL')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ผู้รับบริการทั้งหมด"
        >
          <div className="pnc72-card-indicator" />
          <div className="pnc72-card-head">
            <span className="pnc72-card-title">ผู้รับบริการทั้งหมด</span>
            <span className="pnc72-card-badge all">ทั้งหมด</span>
          </div>
          <div className="pnc72-card-value">{summary.totalVisits.toLocaleString('th-TH')} ครั้ง</div>
          <div className="pnc72-card-sub">
            <UserCheck size={14} aria-hidden="true" />
            <span>จำนวนคน: {summary.uniquePatients.toLocaleString('th-TH')} ราย</span>
          </div>
        </button>

        {/* Card 2: Compensated Visits */}
        <button
          type="button"
          className={`pnc72-card ${compensationFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter('COMPENSATED')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ได้รับชดเชยแล้ว"
        >
          <div className="pnc72-card-indicator" />
          <div className="pnc72-card-head">
            <span className="pnc72-card-title">ได้รับชดเชยแล้ว</span>
            <span className="pnc72-card-badge success">
              {summary.compensationRate.toFixed(1)}%
            </span>
          </div>
          <div className="pnc72-card-value text-emerald-700">
            {summary.compensatedVisits.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="pnc72-card-sub text-emerald-800">
            <ReceiptText size={14} aria-hidden="true" />
            <span>ยอดเงิน: {formatMoney(summary.totalCompensated)} บาท</span>
          </div>
        </button>

        {/* Card 3: Uncompensated Visits */}
        <button
          type="button"
          className={`pnc72-card ${compensationFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter('UNCOMPENSATED')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ยังไม่ได้รับการชดเชย"
        >
          <div className="pnc72-card-indicator" />
          <div className="pnc72-card-head">
            <span className="pnc72-card-title">ยังไม่ชดเชย / รอผล</span>
            <span className="pnc72-card-badge warning">รอดำเนินการ</span>
          </div>
          <div className="pnc72-card-value text-amber-700">
            {summary.uncompensatedVisits.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="pnc72-card-sub text-amber-800">
            <span>
              อัตรา: {(100 - summary.compensationRate).toFixed(1)}% ของทั้งหมด
            </span>
          </div>
        </button>

        {/* Card 4: ClaimCode */}
        <button
          type="button"
          className={`pnc72-card ${compensationFilter === 'HAS_AUTHEN' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter('HAS_AUTHEN')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: มีรหัส ClaimCode"
        >
          <div className="pnc72-card-indicator" />
          <div className="pnc72-card-head">
            <span className="pnc72-card-title">มีรหัส ClaimCode</span>
            <span className="pnc72-card-badge info">พร้อมเบิก</span>
          </div>
          <div className="pnc72-card-value text-sky-700">
            {summary.withAuthenCount.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="pnc72-card-sub">
            <span>ไม่มี ClaimCode: {summary.withoutAuthenCount.toLocaleString('th-TH')} ครั้ง</span>
          </div>
        </button>

        {/* Card 5: PDx Diagnosed */}
        <div className="pnc72-card" style={{ cursor: 'default' }}>
          <div className="pnc72-card-indicator" />
          <div className="pnc72-card-head">
            <span className="pnc72-card-title">วินิจฉัยโรคหลัก (PDX)</span>
            <span className="pnc72-card-badge all">การแพทย์</span>
          </div>
          <div className="pnc72-card-value">{summary.withPdxCount.toLocaleString('th-TH')} ครั้ง</div>
          <div className="pnc72-card-sub">
            <span>มีหัตถการ: {summary.withOpCount.toLocaleString('th-TH')} ครั้ง</span>
          </div>
        </div>
      </section>

      {/* ── 5. Search Bar & Table Controls ── */}
      <section className="pnc72-tools-row" aria-label="ค้นหาและตัวกรองตาราง">
        <div className="pnc72-search-group">
          <div className="pnc72-search-box">
            <Search size={18} className="pnc72-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="pnc72-search-input"
              placeholder="พิมพ์คำค้นหา (HN, CID, ชื่อ, สิทธิ, รหัสโรค Z39...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="pnc72-search-clear"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pnc72-text-muted)', fontWeight: 500 }}>
              สิทธิ:
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
        </div>

        <div className="pnc72-tools-meta">
          <span>
            แสดง <strong>{items.length}</strong> จากทั้งหมด <strong>{totalCount}</strong> รายการ
          </span>
          <select
            className="pnc72-select"
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
          </select>
        </div>
      </section>

      {/* ── 6. Error Notice ── */}
      {error && (
        <div className="pnc72-alert-banner warning" role="alert">
          <div className="pnc72-alert-content">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="pnc72-btn-secondary"
            onClick={() => fetchData()}
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      )}

      {/* ── 7. Data Table ── */}
      <section className="pnc72-table-wrapper" aria-label="ตารางข้อมูลการตรวจหลังคลอด ADP 30015">
        <div className="pnc72-table-scroll">
          <table className="pnc72-table">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>ลำดับ</th>
                <th className="sortable" onClick={() => handleSort('vstdate')}>
                  <div className="pnc72-th-content">
                    <span>วันที่รับบริการ</span>
                    {renderSortIcon('vstdate')}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort('vsttime')}>
                  <div className="pnc72-th-content">
                    <span>เวลา</span>
                    {renderSortIcon('vsttime')}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort('hn')}>
                  <div className="pnc72-th-content">
                    <span>HN</span>
                    {renderSortIcon('hn')}
                  </div>
                </th>
                <th>เลขบัตรประชาชน</th>
                <th className="sortable" onClick={() => handleSort('ptname')}>
                  <div className="pnc72-th-content">
                    <span>ชื่อ-สกุลผู้รับบริการ</span>
                    {renderSortIcon('ptname')}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort('age')}>
                  <div className="pnc72-th-content">
                    <span>อายุ</span>
                    {renderSortIcon('age')}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort('authencode')}>
                  <div className="pnc72-th-content">
                    <span>ClaimCode</span>
                    {renderSortIcon('authencode')}
                  </div>
                </th>
                <th>สิทธิการรักษา</th>
                <th className="sortable" onClick={() => handleSort('pdx')}>
                  <div className="pnc72-th-content">
                    <span>PDX</span>
                    {renderSortIcon('pdx')}
                  </div>
                </th>
                <th>รายการ ADP (30015)</th>
                <th>สถานะการเบิก</th>
                <th>เลขที่ REP</th>
                <th className="sortable" onClick={() => handleSort('compensated')}>
                  <div className="pnc72-th-content">
                    <span>ชดเชย (บาท)</span>
                    {renderSortIcon('compensated')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14}>
                    <div className="pnc72-loading-state">
                      <div className="pnc72-spinner" aria-hidden="true" />
                      <span>กำลังโหลดข้อมูลการตรวจหลังคลอด กรุณารอสักครู่...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={14}>
                    <div className="pnc72-empty-state">
                      <UserCheck size={36} className="text-gray-400" aria-hidden="true" />
                      <strong>ไม่พบข้อมูลผู้รับบริการตรวจหลังคลอด</strong>
                      <p className="text-xs text-gray-500">
                        ลองเปลี่ยนช่วงเวลาการค้นหา หรือปรับตัวกรองสถานะการชดเชย
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr
                    key={item.vn || idx}
                    onClick={() => {
                      setSelectedIndex(idx)
                      setModalTab('summary')
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'center' }} className="pnc72-num text-muted">
                      {item.no}
                    </td>
                    <td className="pnc72-num font-medium">{formatThaiDate(item.vstdate)}</td>
                    <td className="pnc72-num text-muted">{item.vsttime || '—'}</td>
                    <td className="pnc72-num font-mono">{item.hn || '—'}</td>
                    <td className="pnc72-num font-mono">{item.cid || '—'}</td>
                    <td>
                      <div className="pnc72-patient-cell">
                        <span className="pnc72-patient-name">{item.ptname}</span>
                        <span className="pnc72-patient-sub">
                          {item.nation && <span>สัญชาติ: {item.nation}</span>}
                          {item.clinic && <span>คลินิก: {item.clinic}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="pnc72-num">{item.age != null ? `${item.age} ปี` : '—'}</td>
                    <td>
                      {item.authencode ? (
                        <span className="pnc72-tag success font-mono">{item.authencode}</span>
                      ) : (
                        <span className="pnc72-tag warning">ไม่มี ClaimCode</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-gray-700">{item.pttypename || '—'}</span>
                    </td>
                    <td>
                      {item.pdx ? (
                        <span className="pnc72-tag neutral font-mono font-semibold">{item.pdx}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-gray-700 line-clamp-1" title={item.listname || ''}>
                        {item.listname || 'ตรวจหลังคลอด 30015'}
                      </span>
                    </td>
                    <td>
                      {item.status ? (
                        <span className="pnc72-tag success">{item.status}</span>
                      ) : (
                        <span className="pnc72-tag neutral">รอดำเนินการ</span>
                      )}
                    </td>
                    <td className="pnc72-num font-mono">{item.rep || '—'}</td>
                    <td className="pnc72-num font-semibold text-emerald-800">
                      {item.compensated > 0 ? `${formatMoney(item.compensated)} ฿` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 8. Pagination Bar ── */}
        <div className="pnc72-pagination">
          <div>
            หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (รวมทั้งหมด{' '}
            <strong>{totalCount}</strong> รายการ)
          </div>

          <div className="pnc72-pagination-controls">
            <button
              type="button"
              className="pnc72-page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1 || loading}
              aria-label="ไปหน้าแรก"
            >
              «
            </button>
            <button
              type="button"
              className="pnc72-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              aria-label="ย้อนกลับ"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <span className="px-2 text-xs font-semibold pnc72-num">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="pnc72-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pnc72-page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages || loading}
              aria-label="ไปหน้าสุดท้าย"
            >
              »
            </button>
          </div>
        </div>
      </section>

      {/* ── 9. Clinical & Reimbursement Details Modal ── */}
      {selectedItem && (
        <div
          className="pnc72-modal-backdrop"
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pnc-modal-title"
        >
          <div className="pnc72-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="pnc72-modal-header">
              <div className="flex items-center gap-3">
                <HeartPulse size={20} className="text-emerald-700" aria-hidden="true" />
                <div>
                  <h2 id="pnc-modal-title" className="pnc72-modal-title">
                    {selectedItem.ptname}
                  </h2>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5 font-mono">
                    <span>HN: {selectedItem.hn}</span>
                    <span>•</span>
                    <span>VN: {selectedItem.vn}</span>
                  </div>
                </div>
              </div>

              <div className="pnc72-modal-nav-actions">
                <button
                  type="button"
                  className="pnc72-icon-btn"
                  onClick={() => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  disabled={selectedIndex === 0}
                  aria-label="คนก่อนหน้า"
                  title="คนก่อนหน้า"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="pnc72-icon-btn"
                  onClick={() =>
                    setSelectedIndex((i) => (i !== null && i < items.length - 1 ? i + 1 : i))
                  }
                  disabled={selectedIndex === items.length - 1}
                  aria-label="คนถัดไป"
                  title="คนถัดไป"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="pnc72-icon-btn"
                  onClick={() => setSelectedIndex(null)}
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="pnc72-modal-tabs">
              <button
                type="button"
                className={`pnc72-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปข้อมูลการเบิกจ่าย
              </button>
              <button
                type="button"
                className={`pnc72-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก (HOSxP)
              </button>
            </div>

            {/* Modal Body */}
            <div className="pnc72-modal-body">
              {modalTab === 'summary' ? (
                <>
                  <div className="pnc72-detail-grid">
                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">วันที่รับบริการ</span>
                      <span className="pnc72-detail-val">
                        {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">เลขบัตรประชาชน (CID)</span>
                      <div className="pnc72-detail-val font-mono">
                        <span>{selectedItem.cid}</span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-700"
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอก CID"
                        >
                          {copiedField === 'cid' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">อายุ</span>
                      <span className="pnc72-detail-val">
                        {selectedItem.age != null ? `${selectedItem.age} ปี` : '—'} (สัญชาติ:{' '}
                        {selectedItem.nation || 'ไทย'})
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">สิทธิการรักษา</span>
                      <span className="pnc72-detail-val">{selectedItem.pttypename || '—'}</span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">แผนก / แผนกตรวจ</span>
                      <span className="pnc72-detail-val">
                        {selectedItem.department || '—'} ({selectedItem.clinic || 'นรีเวชกรรม'})
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">รหัส ClaimCode</span>
                      <div className="pnc72-detail-val font-mono">
                        {selectedItem.authencode ? (
                          <>
                            <span className="pnc72-tag success">{selectedItem.authencode}</span>
                            <button
                              type="button"
                              className="text-gray-400 hover:text-gray-700"
                              onClick={() => handleCopy(selectedItem.authencode!, 'authen')}
                              title="คัดลอก ClaimCode"
                            >
                              {copiedField === 'authen' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          </>
                        ) : (
                          <span className="pnc72-tag warning">ไม่มี ClaimCode</span>
                        )}
                      </div>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">รหัสวินิจฉัยโรคหลัก (PDX)</span>
                      <span className="pnc72-detail-val font-mono">
                        {selectedItem.pdx ? (
                          <span className="pnc72-tag neutral font-bold">{selectedItem.pdx}</span>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">รหัสการวินิจฉัยร่วม (DX0 - DX5)</span>
                      <span className="pnc72-detail-val font-mono text-xs">
                        {[
                          selectedItem.dx0,
                          selectedItem.dx1,
                          selectedItem.dx2,
                          selectedItem.dx3,
                          selectedItem.dx4,
                          selectedItem.dx5,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'ไม่มี'}
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">รหัสหัตถการ (OP0 - OP5)</span>
                      <span className="pnc72-detail-val font-mono text-xs">
                        {[
                          selectedItem.op0,
                          selectedItem.op1,
                          selectedItem.op2,
                          selectedItem.op3,
                          selectedItem.op4,
                          selectedItem.op5,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'ไม่มี'}
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">ยอดชดเชยที่ได้รับ</span>
                      <span className="pnc72-detail-val text-emerald-800 text-lg">
                        {formatMoney(selectedItem.compensated)} บาท
                      </span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">สถานะการชดเชย</span>
                      <span className="pnc72-detail-val">{selectedItem.status || 'รอดำเนินการ'}</span>
                    </div>

                    <div className="pnc72-detail-item">
                      <span className="pnc72-detail-label">เลขที่ REP / กองทุน</span>
                      <span className="pnc72-detail-val font-mono">
                        REP: {selectedItem.rep || '—'} (Fund: {selectedItem.fund || '—'} /{' '}
                        {selectedItem.subfund || '—'})
                      </span>
                    </div>
                  </div>

                  <div className="pnc72-detail-item mt-4">
                    <span className="pnc72-detail-label">รายการ ADP Code 30015 ในการรับบริการครั้งนี้</span>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm mt-1">
                      {selectedItem.listname || 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code'}
                    </div>
                  </div>

                  {selectedItem.listname1 && (
                    <div className="pnc72-detail-item mt-2">
                      <span className="pnc72-detail-label">รายการค่าบริการและยาอื่นที่สั่งใน VN นี้</span>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 mt-1 max-h-36 overflow-y-auto leading-relaxed">
                        {selectedItem.listname1}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Tab 2: Clinical Details */
                <div>
                  {clinicalLoading ? (
                    <div className="pnc72-loading-state">
                      <div className="pnc72-spinner" aria-hidden="true" />
                      <span>กำลังดึงข้อมูลเวชระเบียนคลินิกจากฐานข้อมูล HOSxP...</span>
                    </div>
                  ) : clinicalError ? (
                    <div className="pnc72-alert-banner warning">
                      <span>{clinicalError}</span>
                    </div>
                  ) : clinicalData ? (
                    <div className="space-y-4">
                      {/* Vitals */}
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          สัญญาณชีพและการคัดกรอง
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-gray-500 block">ความดันโลหิต</span>
                            <span className="font-semibold pnc72-num">
                              {clinicalData.screen?.bps || '—'}/{clinicalData.screen?.bpd || '—'} mmHg
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">ชีพจร</span>
                            <span className="font-semibold pnc72-num">
                              {clinicalData.screen?.pulse || '—'} ครั้ง/นาที
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">น้ำหนัก/ส่วนสูง</span>
                            <span className="font-semibold pnc72-num">
                              {clinicalData.screen?.bw || '—'} กก. / {clinicalData.screen?.height || '—'} ซม.
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">BMI</span>
                            <span className="font-semibold pnc72-num">
                              {clinicalData.screen?.bmi || '—'}
                            </span>
                          </div>
                        </div>

                        {clinicalData.screen?.cc && (
                          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-700">
                            <strong>อาการสำคัญ (CC):</strong> {clinicalData.screen.cc}
                          </div>
                        )}
                      </div>

                      {/* Diagnoses */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          รายการวินิจฉัยโรค (ICD-10)
                        </h3>
                        {clinicalData.diagnoses && clinicalData.diagnoses.length > 0 ? (
                          <div className="space-y-1.5">
                            {clinicalData.diagnoses.map((d, i) => (
                              <div
                                key={i}
                                className="p-2.5 bg-white border border-gray-200 rounded-md text-xs flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-mono font-bold mr-2 text-emerald-800">
                                    {d.icd10}
                                  </span>
                                  <span>{d.icd_name}</span>
                                </div>
                                <span className="pnc72-tag neutral">{d.diagtype_name || d.diagtype}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">ไม่พบรายการวินิจฉัย</p>
                        )}
                      </div>

                      {/* Orders */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          รายการสั่งยา / ค่าบริการ / ตรวจทางห้องปฏิบัติการ
                        </h3>
                        {clinicalData.orders?.items && clinicalData.orders.items.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100 text-xs">
                            {clinicalData.orders.items.map((it, i) => (
                              <div key={i} className="p-2 flex items-center justify-between">
                                <span className="text-gray-800">{it.item_name}</span>
                                <span className="font-semibold pnc72-num">{formatMoney(it.sum_price)} ฿</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">ไม่มีรายการสั่งการรักษา</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pnc72-modal-footer">
              <button
                type="button"
                className="pnc72-btn-secondary"
                onClick={() => setSelectedIndex(null)}
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
