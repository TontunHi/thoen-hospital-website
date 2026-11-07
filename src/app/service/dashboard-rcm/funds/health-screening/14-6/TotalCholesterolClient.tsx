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
  Calendar,
  Activity,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  History,
  Target,
} from 'lucide-react'
import type {
  HealthScreeningItem,
  HealthScreeningSummary,
  HealthScreeningCardFilter,
  HealthScreeningSearchField,
  HealthScreeningSortField,
  HealthScreeningAdpMappingCheck,
  HealthScreeningReportResult,
} from '@/lib/clinical/rcmHealthScreeningService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import '../health-screening.css'

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

export interface TotalCholesterolClientProps {
  initialData?: HealthScreeningReportResult | null
}

export default function TotalCholesterolClient({
  initialData = null,
}: TotalCholesterolClientProps) {
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
  const [cardFilter, setCardFilter] = useState<HealthScreeningCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [targetAgeOnly, setTargetAgeOnly] = useState<boolean>(
    initialData?.targetAgeOnly ?? false
  )
  const [searchField, setSearchField] = useState<HealthScreeningSearchField>(
    initialData?.searchField ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<HealthScreeningSortField>(
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
  const [items, setItems] = useState<HealthScreeningItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<HealthScreeningAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '12004',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<HealthScreeningSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      repeatClaimCount: 0,
      repeatClaimRate: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      targetAgeCount: 0,
      targetAgeRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)

  // AbortController
  const abortRef = useRef<AbortController | null>(null)
  const initialQueryKeyRef = useRef<string | null>(
    initialData
      ? JSON.stringify({
          ds1: initialData.ds1,
          ds2: initialData.ds2,
          cardFilter: initialData.cardFilter,
          ucOnly: initialData.ucOnly,
          targetAgeOnly: initialData.targetAgeOnly,
          searchField: initialData.searchField,
          search: initialData.search,
          sortBy: initialData.sortBy,
          sortOrder: initialData.sortOrder,
          page: initialData.page,
          pageSize: initialData.pageSize,
        })
      : null
  )

  const currentQueryKey = useMemo(
    () =>
      JSON.stringify({
        ds1,
        ds2,
        cardFilter,
        ucOnly,
        targetAgeOnly,
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        page: currentPage,
        pageSize,
      }),
    [
      ds1,
      ds2,
      cardFilter,
      ucOnly,
      targetAgeOnly,
      searchField,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  )

  // Debounce search input (350ms)
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === debouncedSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed)
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search, debouncedSearch])

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
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (forceRefresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const q = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          ucOnly: String(ucOnly),
          targetAgeOnly: String(targetAgeOnly),
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (forceRefresh) {
          q.set('refresh', 'true')
        }

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/health-screening/service-14-6?${q.toString()}`,
          { signal: controller.signal }
        )
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
        if ((err as Error)?.name === 'AbortError') return
        const e = err as Error
        setError(e.message)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, ucOnly, targetAgeOnly, searchField, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  useEffect(() => {
    if (initialQueryKeyRef.current && initialQueryKeyRef.current === currentQueryKey) {
      return
    }
    initialQueryKeyRef.current = null
    fetchData()
    return () => abortRef.current?.abort()
  }, [fetchData, currentQueryKey])

  // Selected item for modal
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null

  // Fetch VN Clinical Details when opening modal tab 'clinical'
  useEffect(() => {
    if (!selectedItem || modalTab !== 'clinical') return
    if (!selectedItem.vn) return

    let isMounted = true
    setClinicalLoading(true)
    setClinicalError(null)

    fetch(`/api/service/dashboard-rcm/funds/health-screening/vn-details?vn=${selectedItem.vn}`)
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
  const handleSort = (field: HealthScreeningSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: HealthScreeningSortField) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="opacity-40" aria-hidden="true" />
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="text-emerald-700 font-bold" aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className="text-emerald-700 font-bold" aria-hidden="true" />
    )
  }

  // Export CSV with UTF-8 BOM
  const handleExportCsv = async () => {
    try {
      setIsExporting(true)
      const q = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        ucOnly: String(ucOnly),
        targetAgeOnly: String(targetAgeOnly),
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/health-screening/service-14-6?${q.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถส่งออกข้อมูลได้')
      }

      const rows: HealthScreeningItem[] = json.data.items || []
      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ',
        'กลุ่มเป้าหมาย (45-59 ปี)',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลารับบริการ',
        'Authen Code',
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
        'เคยเคลมในปีงบ',
        'รายการตรวจ (ADP 12004)',
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
        r.age,
        r.isTargetAge ? 'ใช่' : 'ไม่ใช่',
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
        `"${r.camedate || ''}"`,
        `"${(r.listname || '').replace(/"/g, '""')}"`,
        `"${(r.listname1 || '').replace(/"/g, '""')}"`,
        `"${r.status || ''}"`,
        `"${r.rep || ''}"`,
        r.compensated,
        `"${r.fund || ''}"`,
        `"${r.subfund || ''}"`,
      ])

      const csvContent =
        '\uFEFF' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rcm_cholesterol_14_6_12004_${ds1}_to_${ds2}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const e = err as Error
      alert(`เกิดข้อผิดพลาดในการส่งออกไฟล์: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="hs-page">
      {/* ── 1. Header Bar ── */}
      <header className="hs-header">
        <div className="hs-title-group">
          <div className="hs-title-badge">
            <Activity size={14} aria-hidden="true" />
            <span>กองทุน 14 • บริการคัดกรองและประเมินปัจจัยเสี่ยงต่อสุขภาพกาย/จิต (ADP)</span>
          </div>
          <h1 className="hs-title">14.6 Total Cholesterol / HDL (อายุ 45-59 ปี)</h1>
          <p className="hs-subtitle">
            บริการเจาะเลือดจากหลอดเลือดดำหลังอดอาหาร 8 ชม. เพื่อตรวจ Total Cholesterol หรือ HDL รหัส ADP{' '}
            <strong>12004</strong> ในกลุ่มเป้าหมายอายุ 45-59 ปี ตรวจสอบการขอรหัส Authen
            การตรวจซ้ำในปีงบ และสถานะการชดเชย
          </p>
        </div>

        <div className="hs-header-actions">
          <button
            type="button"
            className="hs-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="hs-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || items.length === 0}
            aria-label="ส่งออกข้อมูลเป็นไฟล์ Excel / CSV"
          >
            <Download size={16} aria-hidden="true" />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel / CSV'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. ADP Mapping Alert Banner ── */}
      {!adpMapping.isMapped && (
        <div className="hs-alert-banner" role="alert">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>ยังไม่ได้ Map ADP Code:</strong> ไม่พบรหัส <strong>12004</strong> ในตาราง{' '}
            <code>s_drugitems</code> กรุณาตรวจสอบการตั้งค่า Map ADP Code ในระบบ HOSxP
          </span>
        </div>
      )}

      {/* ── 3. Date Selection Panel (เรียง: 1. กำหนดเอง -> 2. เดือน -> 3. ปีงบประมาณ) ── */}
      <section className="hs-date-panel" aria-label="ตัวเลือกช่วงเวลา">
        <div className="hs-date-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`hs-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => setDateMode('custom')}
          >
            <Calendar size={16} aria-hidden="true" />
            <span>กำหนดเอง</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`hs-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setDateMode('monthly')}
          >
            <Calendar size={16} aria-hidden="true" />
            <span>เดือน</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`hs-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => setDateMode('fiscal')}
          >
            <Calendar size={16} aria-hidden="true" />
            <span>ปีงบประมาณ</span>
          </button>
        </div>

        <div className="hs-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="hs-control-group">
                <label htmlFor="hs-date-start" className="hs-control-label">
                  ตั้งแต่วันที่:
                </label>
                <ThaiDatePicker
                  id="hs-date-start"
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>

              <div className="hs-control-group">
                <label htmlFor="hs-date-end" className="hs-control-label">
                  ถึงวันที่:
                </label>
                <ThaiDatePicker
                  id="hs-date-end"
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
              <div className="hs-control-group">
                <label htmlFor="hs-month-select" className="hs-control-label">
                  เดือน:
                </label>
                <select
                  id="hs-month-select"
                  className="hs-select"
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

              <div className="hs-control-group">
                <label htmlFor="hs-year-select" className="hs-control-label">
                  ปี พ.ศ.:
                </label>
                <select
                  id="hs-year-select"
                  className="hs-select"
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
            <div className="hs-control-group">
              <label htmlFor="hs-fiscal-select" className="hs-control-label">
                ปีงบประมาณ พ.ศ.:
              </label>
              <select
                id="hs-fiscal-select"
                className="hs-select"
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

      {/* ── 4. Interactive Summary KPI Cards (Filter ผ่าน card ได้) ── */}
      <section className="hs-cards-grid" aria-label="สรุปสถิติและตัวกรองข้อมูล">
        {/* Card 1: All Visits */}
        <button
          type="button"
          className={`hs-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('ALL')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ผู้รับบริการทั้งหมด"
        >
          <div className="hs-card-indicator" />
          <div className="hs-card-head">
            <span className="hs-card-title">ผู้รับบริการทั้งหมด</span>
            <span className="hs-card-badge all">ทั้งหมด</span>
          </div>
          <div className="hs-card-value">{summary.totalVisits.toLocaleString('th-TH')} ครั้ง</div>
          <div className="hs-card-sub">
            <UserCheck size={14} aria-hidden="true" />
            <span>จำนวนคน: {summary.uniquePatients.toLocaleString('th-TH')} ราย</span>
          </div>
        </button>

        {/* Card 2: Compensated Visits */}
        <button
          type="button"
          className={`hs-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('COMPENSATED')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ได้รับชดเชยแล้ว"
        >
          <div className="hs-card-indicator" />
          <div className="hs-card-head">
            <span className="hs-card-title">ได้รับชดเชยแล้ว</span>
            <span className="hs-card-badge success">
              {summary.compensationRate.toFixed(1)}%
            </span>
          </div>
          <div className="hs-card-value text-emerald-700">
            {summary.compensatedVisits.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="hs-card-sub text-emerald-800">
            <ReceiptText size={14} aria-hidden="true" />
            <span>ยอดเงิน: {formatMoney(summary.totalCompensated)} บาท</span>
          </div>
        </button>

        {/* Card 3: Uncompensated Visits */}
        <button
          type="button"
          className={`hs-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('UNCOMPENSATED')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ยังไม่ได้รับการชดเชย"
        >
          <div className="hs-card-indicator" />
          <div className="hs-card-head">
            <span className="hs-card-title">ยังไม่ชดเชย / รอผล</span>
            <span className="hs-card-badge warning">รอดำเนินการ</span>
          </div>
          <div className="hs-card-value text-amber-700">
            {summary.uncompensatedVisits.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="hs-card-sub text-amber-800">
            <Clock size={14} aria-hidden="true" />
            <span>{(100 - summary.compensationRate).toFixed(1)}% ของทั้งหมด</span>
          </div>
        </button>

        {/* Card 4: Target Age 45-59 Years */}
        <button
          type="button"
          className={`hs-card ${cardFilter === 'TARGET_AGE' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('TARGET_AGE')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: กลุ่มเป้าหมายอายุ 45-59 ปี"
        >
          <div className="hs-card-indicator" />
          <div className="hs-card-head">
            <span className="hs-card-title">กลุ่มอายุ 45-59 ปี</span>
            <span className="hs-card-badge info">
              {summary.targetAgeRate.toFixed(1)}%
            </span>
          </div>
          <div className="hs-card-value text-sky-700">
            {summary.targetAgeCount.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="hs-card-sub text-sky-800">
            <Target size={14} aria-hidden="true" />
            <span>เกณฑ์เป้าหมายกองทุน</span>
          </div>
        </button>

        {/* Card 5: Repeat Claim in Fiscal Year (เคยเคลมซ้ำ) */}
        <button
          type="button"
          className={`hs-card ${cardFilter === 'REPEAT_CLAIM' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('REPEAT_CLAIM')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: เคยเคลมในปีงบประมาณ"
        >
          <div className="hs-card-indicator" />
          <div className="hs-card-head">
            <span className="hs-card-title">เคยเคลมในปีงบ</span>
            <span className="hs-card-badge danger">
              {summary.repeatClaimRate.toFixed(1)}%
            </span>
          </div>
          <div className="hs-card-value text-rose-700">
            {summary.repeatClaimCount.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="hs-card-sub text-rose-800">
            <History size={14} aria-hidden="true" />
            <span>เคยตรวจซ้ำก่อนหน้า visit นี้</span>
          </div>
        </button>

        {/* Card 6: Authen Code */}
        <button
          type="button"
          className={`hs-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('WITH_AUTHEN')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: มีรหัส Authen Code"
        >
          <div className="hs-card-indicator" />
          <div className="hs-card-head">
            <span className="hs-card-title">มีรหัส AUTHEN</span>
            <span className="hs-card-badge success">{summary.authenRate.toFixed(1)}%</span>
          </div>
          <div className="hs-card-value text-emerald-700">
            {summary.withAuthenCount.toLocaleString('th-TH')} ครั้ง
          </div>
          <div className="hs-card-sub">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>ไม่มี Authen: {summary.withoutAuthenCount.toLocaleString('th-TH')} ครั้ง</span>
          </div>
        </button>
      </section>

      {/* ── 5. Search Bar & Secondary Filters ── */}
      <section className="hs-filter-bar" aria-label="ค้นหาและตัวกรองตาราง">
        <div className="hs-filter-left">
          <select
            className="hs-select"
            value={searchField}
            onChange={(e) => {
              setSearchField(e.target.value as HealthScreeningSearchField)
              setCurrentPage(1)
            }}
            aria-label="ค้นหาจากคอลัมน์"
          >
            <option value="ALL">ทุกคอลัมน์</option>
            <option value="HN">HN</option>
            <option value="CID">เลขบัตรประชาชน</option>
            <option value="PTNAME">ชื่อ-สกุล</option>
            <option value="VN">VN</option>
            <option value="DIAG">รหัสโรค (ICD-10)</option>
            <option value="PTTYPE">สิทธิการรักษา</option>
          </select>

          <div className="hs-search-box">
            <Search size={18} className="hs-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="hs-search-input"
              placeholder="พิมพ์คำค้นหา (HN, เลขบัตร, ชื่อผู้ป่วย, VN, สิทธิ...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="hs-clear-search"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="hs-filter-right">
          <label className="hs-checkbox-label">
            <input
              type="checkbox"
              className="hs-checkbox"
              checked={targetAgeOnly}
              onChange={(e) => {
                setTargetAgeOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะอายุ 45-59 ปี</span>
          </label>

          <label className="hs-checkbox-label">
            <input
              type="checkbox"
              className="hs-checkbox"
              checked={ucOnly}
              onChange={(e) => {
                setUcOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะบัตรทอง (UC)</span>
          </label>

          <select
            className="hs-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            aria-label="จำนวนแถวต่อหน้า"
          >
            <option value={25}>25 แถว / หน้า</option>
            <option value={50}>50 แถว / หน้า</option>
            <option value={100}>100 แถว / หน้า</option>
          </select>
        </div>
      </section>

      {/* ── 6. Error Notice ── */}
      {error && (
        <div className="hs-alert-banner" role="alert">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="hs-btn-secondary" onClick={() => fetchData()}>
            ลองใหม่อีกครั้ง
          </button>
        </div>
      )}

      {/* ── 7. Data Table (Center-Aligned Standard) ── */}
      <section className="hs-table-container" aria-label="ตารางข้อมูล Total Cholesterol 12004">
        <div className="hs-table-wrapper">
          <table className="hs-table">
            <thead>
              <tr>
                <th className="col-center" style={{ width: 50 }}>ลำดับ</th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('vstdate')}>
                    <span>วันที่รับบริการ</span>
                    {renderSortIcon('vstdate')}
                  </button>
                </th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('vsttime')}>
                    <span>เวลา</span>
                    {renderSortIcon('vsttime')}
                  </button>
                </th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('hn')}>
                    <span>HN</span>
                    {renderSortIcon('hn')}
                  </button>
                </th>
                <th className="col-center">เลขบัตรประชาชน</th>
                <th className="col-left">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('ptname')}>
                    <span>ชื่อ-สกุลผู้รับบริการ</span>
                    {renderSortIcon('ptname')}
                  </button>
                </th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('age')}>
                    <span>อายุ</span>
                    {renderSortIcon('age')}
                  </button>
                </th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('authencode')}>
                    <span>Authen Code</span>
                    {renderSortIcon('authencode')}
                  </button>
                </th>
                <th className="col-center">สิทธิการรักษา</th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('pdx')}>
                    <span>PDX</span>
                    {renderSortIcon('pdx')}
                  </button>
                </th>
                <th className="col-center">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('camedate')}>
                    <span>เคยเคลมในปีงบ</span>
                    {renderSortIcon('camedate')}
                  </button>
                </th>
                <th className="col-left">รายการตรวจ (ADP 12004)</th>
                <th className="col-left">รายการค่าบริการอื่นๆ</th>
                <th className="col-center">สถานะการชดเชย</th>
                <th className="col-center">เลขที่ REP</th>
                <th className="col-right">
                  <button type="button" className="hs-table-sort-btn" onClick={() => handleSort('compensated')}>
                    <span>ชดเชย (บาท)</span>
                    {renderSortIcon('compensated')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16}>
                    <div className="hs-loading-state">
                      <RefreshCw size={24} className="animate-spin text-emerald-700" aria-hidden="true" />
                      <span>กำลังโหลดข้อมูล กรุณารอสักครู่...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={16}>
                    <div className="hs-empty-state">
                      <UserCheck size={36} aria-hidden="true" />
                      <h3>ไม่พบข้อมูลผู้รับบริการตรวจ Total Cholesterol / HDL</h3>
                      <p>ลองปรับเปลี่ยนช่วงเวลาค้นหา หรือสลับแท็บตัวกรองสถานะ</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr
                    key={item.vn || idx}
                    className="hs-row-clickable"
                    onClick={() => {
                      setSelectedIndex(idx)
                      setModalTab('summary')
                    }}
                  >
                    <td className="col-center hs-num text-muted">{item.no}</td>
                    <td className="col-center hs-num font-medium">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center hs-num text-muted">{item.vsttime || '—'}</td>
                    <td className="col-center hs-num font-mono">{item.hn || '—'}</td>
                    <td className="col-center hs-num font-mono">{item.cid || '—'}</td>
                    <td className="col-left">
                      <div className="hs-patient-cell">
                        <span className="hs-patient-name">{item.ptname}</span>
                        <span className="hs-patient-sub">
                          {item.clinic && <span>{item.clinic}</span>}
                          {item.department && <span>{item.department}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="col-center hs-num">
                      <span className={item.isTargetAge ? 'font-semibold text-emerald-800' : 'text-gray-500'}>
                        {item.age} ปี
                      </span>
                    </td>
                    <td className="col-center">
                      {item.authencode ? (
                        <span className="hs-status-pill authen">{item.authencode}</span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="col-center">
                      <span className="text-xs text-gray-700">{item.pttypename || '—'}</span>
                    </td>
                    <td className="col-center hs-num font-mono font-semibold">
                      {item.pdx || '—'}
                    </td>
                    <td className="col-center">
                      {item.hasRepeatClaim ? (
                        <span className="hs-repeat-pill" title={`เคยตรวจเมื่อ: ${item.camedate}`}>
                          <History size={12} aria-hidden="true" />
                          <span>{item.camedate}</span>
                        </span>
                      ) : (
                        <span className="hs-repeat-first">ครั้งแรกในปีงบ</span>
                      )}
                    </td>
                    <td className="col-left">
                      <span className="text-xs text-gray-700 line-clamp-1" title={item.listname || ''}>
                        {item.listname || 'Total Cholesterol / HDL (12004)'}
                      </span>
                    </td>
                    <td className="col-left">
                      <span className="text-xs text-gray-500 line-clamp-1" title={item.listname1 || ''}>
                        {item.listname1 || '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      {item.status ? (
                        <span className="hs-status-pill success">{item.status}</span>
                      ) : (
                        <span className="hs-status-pill pending">รอดำเนินการ</span>
                      )}
                    </td>
                    <td className="col-center hs-num font-mono">{item.rep || '—'}</td>
                    <td className="col-right hs-num font-semibold text-emerald-800">
                      {item.compensated > 0 ? `${formatMoney(item.compensated)} ฿` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 8. Pagination Bar ── */}
        <div className="hs-pagination">
          <div>
            แสดงหน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (รวมทั้งหมด{' '}
            <strong>{totalCount}</strong> รายการ)
          </div>

          <div className="hs-pagination-controls">
            <button
              type="button"
              className="hs-page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1 || loading}
              aria-label="ไปหน้าแรก"
            >
              «
            </button>
            <button
              type="button"
              className="hs-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              aria-label="ย้อนกลับ"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <span className="px-2 text-xs font-semibold hs-num">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="hs-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hs-page-btn"
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
          className="hs-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hs-modal-header">
              <div>
                <h3 className="hs-modal-title">รายละเอียดการรับบริการ Total Cholesterol (12004)</h3>
                <span className="text-xs text-gray-500 font-mono">
                  VN: {selectedItem.vn} • HN: {selectedItem.hn}
                </span>
              </div>
              <button
                type="button"
                className="hs-modal-close"
                onClick={() => setSelectedIndex(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="hs-modal-tabs">
              <button
                type="button"
                className={`hs-modal-tab ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                ข้อมูลบริการ & การชดเชย
              </button>
              <button
                type="button"
                className={`hs-modal-tab ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                ข้อมูลเวชระเบียนคลินิก
              </button>
            </div>

            <div className="hs-modal-body">
              {modalTab === 'summary' && (
                <div className="hs-modal-grid">
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">ชื่อ-สกุล</span>
                    <span className="hs-modal-val font-semibold">{selectedItem.ptname}</span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">เลขบัตรประชาชน</span>
                    <span className="hs-modal-val font-mono">{selectedItem.cid || '—'}</span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">อายุ / กลุ่มเป้าหมาย</span>
                    <span className="hs-modal-val">
                      {selectedItem.age} ปี {selectedItem.isTargetAge ? '(กลุ่มเป้าหมาย 45-59 ปี)' : '(นอกเกณฑ์เป้าหมาย)'}
                    </span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">วันที่ & เวลา</span>
                    <span className="hs-modal-val">
                      {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                    </span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">รหัส Authen Code</span>
                    <span className="hs-modal-val font-mono">
                      {selectedItem.authencode || '— ไม่มีรหัส —'}
                    </span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">สิทธิการรักษา</span>
                    <span className="hs-modal-val">{selectedItem.pttypename}</span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">การวินิจฉัยโรค (PDX)</span>
                    <span className="hs-modal-val font-mono font-semibold">
                      {selectedItem.pdx || '—'}
                    </span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">เคยเคลมในปีงบประมาณ</span>
                    <span className="hs-modal-val">
                      {selectedItem.camedate ? (
                        <span className="text-rose-700 font-semibold">
                          เคยตรวจวันที่ {selectedItem.camedate}
                        </span>
                      ) : (
                        'ครั้งแรกในปีงบประมาณ'
                      )}
                    </span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">รายการตรวจ (ADP 12004)</span>
                    <span className="hs-modal-val">{selectedItem.listname || '—'}</span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">รายการค่าบริการอื่นๆ</span>
                    <span className="hs-modal-val">{selectedItem.listname1 || '—'}</span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">สถานะการชดเชย</span>
                    <span className="hs-modal-val font-semibold">
                      {selectedItem.status || 'รอดำเนินการ'}
                    </span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">เลขที่ REP</span>
                    <span className="hs-modal-val font-mono">{selectedItem.rep || '—'}</span>
                  </div>
                  <div className="hs-modal-item">
                    <span className="hs-modal-label">ยอดชดเชย</span>
                    <span className="hs-modal-val font-semibold text-emerald-800">
                      {selectedItem.compensated > 0 ? `${formatMoney(selectedItem.compensated)} บาท` : '—'}
                    </span>
                  </div>
                </div>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {clinicalLoading ? (
                    <div className="hs-loading-state">
                      <RefreshCw size={24} className="animate-spin text-emerald-700" aria-hidden="true" />
                      <span>กำลังโหลดข้อมูลเวชระเบียน...</span>
                    </div>
                  ) : clinicalError ? (
                    <div className="hs-alert-banner" role="alert">
                      <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
                      <span>{clinicalError}</span>
                    </div>
                  ) : clinicalData ? (
                    <div className="hs-modal-grid">
                      <div className="hs-modal-item">
                        <span className="hs-modal-label">อาการสำคัญ (CC)</span>
                        <span className="hs-modal-val">{clinicalData.screen?.cc || '—'}</span>
                      </div>
                      <div className="hs-modal-item">
                        <span className="hs-modal-label">ความดันโลหิต (BP)</span>
                        <span className="hs-modal-val font-mono">
                          {clinicalData.screen?.bps ? `${clinicalData.screen.bps}/${clinicalData.screen.bpd} mmHg` : '—'}
                        </span>
                      </div>
                      <div className="hs-modal-item">
                        <span className="hs-modal-label">อุณหภูมิร่างกาย / ชีพจร</span>
                        <span className="hs-modal-val font-mono">
                          {clinicalData.screen?.temperature ? `${clinicalData.screen.temperature} °C` : '—'} • {clinicalData.screen?.pulse ? `${clinicalData.screen.pulse} bpm` : '—'}
                        </span>
                      </div>
                      <div className="hs-modal-item">
                        <span className="hs-modal-label">น้ำหนัก / ส่วนสูง / BMI</span>
                        <span className="hs-modal-val font-mono">
                          {clinicalData.screen?.bw ? `${clinicalData.screen.bw} kg` : '—'} / {clinicalData.screen?.height ? `${clinicalData.screen.height} cm` : '—'} / {clinicalData.screen?.bmi || '—'}
                        </span>
                      </div>
                      <div className="hs-modal-item">
                        <span className="hs-modal-label">แพทย์ผู้ตรวจ</span>
                        <span className="hs-modal-val">
                          {clinicalData.diagnoses?.find((d) => d.doctor_name)?.doctor_name || '—'}
                        </span>
                      </div>
                      <div className="hs-modal-item">
                        <span className="hs-modal-label">แผนก / แผนกย่อย</span>
                        <span className="hs-modal-val">
                          {clinicalData.header?.department || selectedItem.department || '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">ไม่พบข้อมูลเวชระเบียนสำหรับ visit นี้</div>
                  )}
                </div>
              )}
            </div>

            <div className="hs-modal-footer">
              <button
                type="button"
                className="hs-btn-secondary"
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
