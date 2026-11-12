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
  ShieldCheck,
  Stethoscope,
  Activity,
  Calendar,
  CreditCard,
  Building2,
  Copy,
  Check,
  Baby,
  Smile,
  Sparkles,
} from 'lucide-react'
import type {
  AncService23Item,
  AncService23Summary,
  AncService23CardFilter,
  AncService23SearchField,
  AncService23SortField,
} from '@/lib/clinical/rcmAncService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
import { UC_ECLAIM_CODES } from '@/lib/clinical/pttypeConstants'
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
  if (!val || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

export interface AncService23ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
  initialError?: string | null
}

export default function AncService23Client({
  initialData,
  initialRange,
  initialError = null,
}: AncService23ClientProps = {}) {
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
  const [cardFilter, setCardFilter] = useState<AncService23CardFilter>('ALL')
  const [serviceFilter, setServiceFilter] = useState<'ALL' | 'OK' | 'NOT_OK'>('ALL')
  const [ucFilter, setUcFilter] = useState<'ALL' | 'UC' | 'NON_UC'>('ALL')
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(() => {
    if (initialData?.pttypes) {
      return initialData.pttypes.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    if (initialData?.ucFilter === 'UC') {
      return [...UC_ECLAIM_CODES]
    }
    return []
  })
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [statusOptions, setStatusOptions] = useState<string[]>(initialData?.statusOptions || [])
  const [searchField, setSearchField] = useState<AncService23SearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<AncService23SortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData && !initialError)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(initialError)
  const [items, setItems] = useState<AncService23Item[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [summary, setSummary] = useState<AncService23Summary>(
    initialData?.summary || {
      totalVisits: 0,
      uniquePatients: 0,
      serviceOkCount: 0,
      checkupCount: 0,
      scallingCount: 0,
      ultrasoundCount: 0,
      ucCount: 0,
      compensatedCount: 0,
      uncompensatedCount: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      warningCount: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Modal Detail states
  const [selectedItem, setSelectedItem] = useState<AncService23Item | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

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
          cardFilter,
          serviceFilter,
          statusFilter,
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (selectedPttypes.length > 0) {
          q.set('pttypes', selectedPttypes.join(','))
        } else if (ucFilter !== 'ALL') {
          q.set('ucFilter', ucFilter)
        }

        if (refresh) q.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/anc/service-2-3?${q.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลบริการ 2.3 ฝากครรภ์ได้')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        if (data.statusOptions) {
          setStatusOptions(data.statusOptions)
        }
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
      cardFilter,
      serviceFilter,
      selectedPttypes,
      ucFilter,
      statusFilter,
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
        `/api/service/dashboard-rcm/funds/anc/vn-details?vn=${encodeURIComponent(vn)}`
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

  // Open inspection modal
  const openDetailModal = (item: AncService23Item) => {
    setSelectedItem(item)
    setModalTab('summary')
    if (item?.vn) {
      fetchClinicalDetails(item.vn)
    }
  }

  const closeDetailModal = () => {
    setSelectedItem(null)
    setClinicalData(null)
    setClinicalError(null)
  }

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Sort handler
  const handleSort = (field: AncService23SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Card click toggles filter
  const handleCardClick = (filterType: AncService23CardFilter) => {
    if (cardFilter === filterType) {
      setCardFilter('ALL')
    } else {
      setCardFilter(filterType)
    }
    setCurrentPage(1)
  }

  // Export CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        serviceFilter,
        statusFilter,
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (selectedPttypes.length > 0) {
        q.set('pttypes', selectedPttypes.join(','))
      } else if (ucFilter !== 'ALL') {
        q.set('ucFilter', ucFilter)
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/anc/service-2-3?${q.toString()}`
      )
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถส่งออกข้อมูลได้')
      }

      const rows: AncService23Item[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'ห้องตรวจ',
        'สิทธิการรักษา (Visit)',
        'สิทธิ UC',
        'กลุ่มบริการ',
        'ครรภ์ที่',
        'GA (สัปดาห์)',
        'ไตรมาส ANC',
        'LMP',
        'ควรขัดฟันก่อน',
        'Ultrasound',
        'ตรวจช่องปาก',
        'ขัดฟัน',
        'รหัสหัตถการ',
        'ได้รับบริการ (OK)',
        'สถานะ E-Claim',
        'E-Claim No',
        'ClaimCode',
        'ชดเชย (บาท)',
        'เลข Rep',
        'ข้อควรตรวจสอบ',
      ]

      const exportRows = rows.map((r, idx) => [
        idx + 1,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.age ?? '',
        r.nation || '',
        r.vstdate,
        r.vsttime || '',
        r.room || '',
        r.pttypename_visit || '',
        r.uc,
        r.groupname,
        r.preg_no || '',
        r.ga ?? '',
        r.anc || '',
        r.lmp || '',
        r.lastdate || '',
        r.us || '',
        r.checkup || '',
        r.scalling || '',
        r.itemname || '',
        r.ok || '',
        r.status_eclaim || '',
        r.eclaim_no || '',
        r.authencode || '',
        r.compensated || 0,
        r.rep || '',
        r.mean || '',
      ])

      await exportRcmExcel({
        filename: `ANC_2_3_US_Dental_${ds1}_to_${ds2}.xlsx`,
        title: 'หญิงตั้งครรภ์ ได้รับบริการ Ultrasound - ตรวจช่องปาก - ขัดฟัน (2.3)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: exportRows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert(e.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="anc3-page">
      {/* ── Header Bar ── */}
      <header className="anc3-header">
        <div className="anc3-title-group">
          <h1 className="anc3-title">
            2.3 หญิงตั้งครรภ์ ได้รับบริการตรวจ Ultrasound - ตรวจช่องปาก - ขัดทำความสะอาดฟัน
          </h1>
          <p className="anc3-subtitle">
            รายงานติดตามบริการฝากครรภ์ การทำหัตถการทันตกรรม และการชดเชยค่าบริการ E-Claim สปสช. โรงพยาบาลเถิน
          </p>
        </div>

        <div className="anc3-actions-group">
          <button
            type="button"
            className="anc3-btn anc3-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลและล้างแคช"
          >
            <RefreshCw size={16} className={isRefreshing ? 'anc3-spinner' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="anc3-btn anc3-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── Filter Panel (Date Mode Selector: 1. กำหนดเอง -> 2. รายเดือน -> 3. ปีงบประมาณ) ── */}
      <section className="anc3-filter-panel" aria-label="ตัวกรองและเลือกช่วงเวลา">
        <div className="anc3-filter-row">
          <div className="anc3-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`anc3-tab-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => setDateMode('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`anc3-tab-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => setDateMode('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`anc3-tab-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => setDateMode('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          {/* Mode 1: กำหนดเอง */}
          {dateMode === 'custom' && (
            <div className="anc3-date-inputs">
              <span className="anc3-label">ตั้งแต่วันที่:</span>
              <ThaiDatePicker value={ds1} onChange={(val) => setDs1(val)} />
              <span className="anc3-label">ถึง:</span>
              <ThaiDatePicker value={ds2} onChange={(val) => setDs2(val)} />
            </div>
          )}

          {/* Mode 2: รายเดือน */}
          {dateMode === 'monthly' && (
            <div className="anc3-date-inputs">
              <span className="anc3-label">เดือน:</span>
              <select
                className="anc3-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="anc3-label">ปี พ.ศ.:</span>
              <select
                className="anc3-select"
                value={selectedBeYear}
                onChange={(e) => setSelectedBeYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode 3: ปีงบประมาณ */}
          {dateMode === 'fiscal' && (
            <div className="anc3-date-inputs">
              <span className="anc3-label">ปีงบประมาณ พ.ศ.:</span>
              <select
                className="anc3-select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
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

        {/* Secondary Filter Row: Search & Dropdowns */}
        <div className="anc3-secondary-filters">
          <div className="anc3-search-box">
            <Search size={16} className="anc3-search-icon" />
            <input
              type="text"
              className="anc3-input"
              placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล, VN, ClaimCode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="anc3-clear-btn"
                onClick={() => setSearch('')}
                title="ล้างข้อความค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Service OK Dropdown */}
          <select
            className="anc3-select"
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value as 'ALL' | 'OK' | 'NOT_OK')
              setCurrentPage(1)
            }}
          >
            <option value="ALL">บริการ: ทั้งหมด</option>
            <option value="OK">เฉพาะ ได้รับบริการ (OK)</option>
            <option value="NOT_OK">ยังไม่ได้รับบริการ</option>
          </select>

          {/* Pttype Multi-Select Dropdown */}
          <PttypeMultiSelect
            selectedCodes={selectedPttypes}
            onChange={(codes) => {
              setSelectedPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {/* E-Claim Status Dropdown */}
          {statusOptions.length > 0 && (
            <select
              className="anc3-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="ALL">สถานะ E-Claim: ทั้งหมด</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* ── KPI Summary Cards (Filterable by Click) ── */}
      <section className="anc3-kpi-grid" aria-label="สรุปสถิติสำคัญและการกรอง">
        {/* Card 1: ทั้งหมด */}
        <button
          type="button"
          className={`anc3-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('ALL')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">ผู้รับบริการทั้งหมด</span>
            <Baby size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.totalVisits.toLocaleString()}</div>
          <div className="anc3-kpi-sub">{summary.uniquePatients.toLocaleString()} คน</div>
        </button>

        {/* Card 2: ได้รับบริการ (OK) */}
        <button
          type="button"
          className={`anc3-kpi-card anc3-kpi-ok ${cardFilter === 'SERVICE_OK' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('SERVICE_OK')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">ได้รับบริการ (OK)</span>
            <Check size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.serviceOkCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">
            {summary.totalVisits > 0
              ? `${((summary.serviceOkCount / summary.totalVisits) * 100).toFixed(1)}%`
              : '0%'}
          </div>
        </button>

        {/* Card 3: ตรวจช่องปาก */}
        <button
          type="button"
          className={`anc3-kpi-card ${cardFilter === 'CHECKUP' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('CHECKUP')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">ตรวจช่องปาก</span>
            <Smile size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.checkupCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">2330011 / 2330013</div>
        </button>

        {/* Card 4: ขูดหินปูน/ขัดฟัน */}
        <button
          type="button"
          className={`anc3-kpi-card ${cardFilter === 'SCALLING' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('SCALLING')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">ขูดหินปูน / ขัดฟัน</span>
            <Sparkles size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.scallingCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">ก่อน 24 สัปดาห์</div>
        </button>

        {/* Card 5: Ultrasound */}
        <button
          type="button"
          className={`anc3-kpi-card ${cardFilter === 'ULTRASOUND' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('ULTRASOUND')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">Ultrasound</span>
            <Activity size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.ultrasoundCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">หัตถการ 8876-8879</div>
        </button>

        {/* Card 6: สิทธิ UC */}
        <button
          type="button"
          className={`anc3-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UC_ONLY')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">สิทธิบัตรทอง (UC)</span>
            <ShieldCheck size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.ucCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">UC = Y</div>
        </button>

        {/* Card 7: ชดเชยแล้ว */}
        <button
          type="button"
          className={`anc3-kpi-card anc3-kpi-ok ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">ได้รับชดเชยแล้ว</span>
            <CreditCard size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.compensatedCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">{formatMoney(summary.totalCompensated)} บ.</div>
        </button>

        {/* Card 8: ข้อควรตรวจสอบ */}
        <button
          type="button"
          className={`anc3-kpi-card anc3-kpi-warn ${cardFilter === 'WARNINGS' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WARNINGS')}
        >
          <div className="anc3-kpi-header">
            <span className="anc3-kpi-label">ข้อควรตรวจสอบ</span>
            <AlertTriangle size={18} className="anc3-kpi-icon" />
          </div>
          <div className="anc3-kpi-value">{summary.warningCount.toLocaleString()}</div>
          <div className="anc3-kpi-sub">ไม่มีหัตถการ / ไม่มี LMP</div>
        </button>
      </section>

      {/* ── Error Banner ── */}
      {error && (
        <div className="anc3-empty-state" style={{ color: 'var(--anc-err)' }}>
          <AlertTriangle size={32} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Table Container ── */}
      <section className="anc3-table-container">
        <div className="anc3-table-topbar">
          <div className="anc3-table-count">
            แสดง {items.length.toLocaleString()} จากทั้งหมด {totalCount.toLocaleString()} รายการ
            {cardFilter !== 'ALL' && (
              <span className="anc3-badge anc3-badge-info" style={{ marginLeft: 8 }}>
                กรอง: {cardFilter}
              </span>
            )}
          </div>

          <div className="anc3-page-size-wrap">
            <span>แสดงแถว:</span>
            <select
              className="anc3-select"
              style={{ minHeight: 36, padding: '0 8px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="anc3-table-scroll">
          {!error && (
            <table className="anc3-table">
              <thead>
                <tr>
                  <th className="anc3-cell-center" style={{ width: 48 }}>
                    ลำดับ
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    onClick={() => handleSort('vstdate')}
                    title="คลิกเพื่อเรียงลำดับตามวันที่"
                  >
                    <div className="anc3-sort-wrap">
                      <span>วันที่รับบริการ</span>
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    onClick={() => handleSort('hn')}
                  >
                    <div className="anc3-sort-wrap">
                      <span>VN / HN</span>
                      {sortBy === 'hn' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    onClick={() => handleSort('cid')}
                  >
                    <div className="anc3-sort-wrap">
                      <span>เลขบัตรประชาชน (CID)</span>
                      {sortBy === 'cid' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    onClick={() => handleSort('ptname')}
                  >
                    <div className="anc3-sort-wrap">
                      <span>ชื่อ - สกุล</span>
                      {sortBy === 'ptname' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    onClick={() => handleSort('age')}
                    style={{ width: 64 }}
                  >
                    <div className="anc3-sort-wrap">
                      <span>อายุ</span>
                      {sortBy === 'age' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th className="anc3-cell-center" style={{ width: 140 }}>
                    สิทธิการรักษา
                  </th>
                  <th className="anc3-cell-center" style={{ width: 44 }}>
                    UC
                  </th>
                  <th className="anc3-cell-center" style={{ width: 48 }} title="Ultrasound (Y: Oper / S: Service)">
                    US
                  </th>
                  <th className="anc3-cell-center" style={{ width: 72 }} title="ตรวจช่องปาก">
                    ตรวจช่องปาก
                  </th>
                  <th className="anc3-cell-center" style={{ width: 72 }} title="ขัดฟัน/ขูดหินปูน">
                    ขัดฟัน
                  </th>
                  <th className="anc3-cell-center" style={{ width: 56 }}>
                    ครรภ์ที่
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    style={{ width: 64 }}
                    onClick={() => handleSort('ga')}
                    title="อายุครรภ์เป็นสัปดาห์ ณ วันที่มารับบริการ"
                  >
                    <div className="anc3-sort-wrap">
                      <span>GA (wk)</span>
                      {sortBy === 'ga' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th className="anc3-cell-center" style={{ width: 100 }}>
                    LMP
                  </th>
                  <th className="anc3-cell-center" style={{ width: 110 }} title="ควรขัดฟันก่อนวันที่ (LMP + 24 สัปดาห์)">
                    ควรขัดฟันก่อน
                  </th>
                  <th className="anc3-cell-center" style={{ width: 56 }} title="ไตรมาส ANC (1-5)">
                    ANC
                  </th>
                  <th className="anc3-cell-center" style={{ width: 100 }}>
                    กำหนดคลอด
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    style={{ width: 140 }}
                    onClick={() => handleSort('groupname')}
                  >
                    <div className="anc3-sort-wrap">
                      <span>กลุ่มบริการ</span>
                      {sortBy === 'groupname' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th className="anc3-cell-center" style={{ width: 140 }}>
                    รหัสหัตถการ
                  </th>
                  <th className="anc3-cell-center" style={{ width: 150 }}>
                    สถานะ E-Claim
                  </th>
                  <th className="anc3-cell-center anc3-cell-mono" style={{ width: 100 }}>
                    E-Claim No
                  </th>
                  <th
                    className="anc3-cell-center anc3-th-sortable"
                    style={{ width: 100 }}
                    onClick={() => handleSort('compensated')}
                  >
                    <div className="anc3-sort-wrap">
                      <span>ชดเชย (บ.)</span>
                      {sortBy === 'compensated' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  <th className="anc3-cell-center" style={{ width: 110 }}>
                    เลข Rep
                  </th>
                  <th className="anc3-cell-center" style={{ width: 150 }}>
                    ข้อควรตรวจสอบ
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading || isRefreshing ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                      {Array.from({ length: 24 }).map((__, colIdx) => (
                        <td key={colIdx} className="col-center">
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={24} className="anc3-empty-state">
                      <Baby size={40} />
                      <span>ไม่พบข้อมูลผู้รับบริการตามช่วงเวลาและเงื่อนไขที่กำหนด</span>
                    </td>
                  </tr>
                ) : items.map((row, idx) => {
                  const hasWarning = Boolean(row.mean)
                  const isOk = row.ok === 'Y'

                  let rowClass = ''
                  if (hasWarning) rowClass = 'anc3-row-warn'
                  else if (isOk) rowClass = 'anc3-row-ok'

                  return (
                    <tr
                      key={`${row.vn}-${idx}`}
                      className={`${rowClass} anc3-row-clickable`}
                      onClick={() => openDetailModal(row)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* 1. ลำดับ */}
                      <td className="anc3-cell-center anc3-cell-num">{row.no || idx + 1}</td>

                      {/* 2. วันที่รับบริการ */}
                      <td className="anc3-cell-num" style={{ whiteSpace: 'nowrap' }}>
                        <div>{formatThaiDate(row.vstdate, 'short')}</div>
                        {row.vsttime && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--anc-muted)' }}>
                            {row.vsttime} น.
                          </div>
                        )}
                      </td>

                      {/* 3. VN / HN */}
                      <td>
                        <div className="anc3-cell-mono" style={{ fontWeight: 600 }}>
                          {row.vn}
                        </div>
                        <div className="anc3-cell-mono" style={{ color: 'var(--anc-muted)' }}>
                          HN: {row.hn}
                        </div>
                      </td>

                      {/* 4. CID (Unmasked 13-digit Thai National ID) */}
                      <td className="anc3-cell-mono" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatCidDisplay(row.cid)}
                      </td>

                      {/* 5. ชื่อ - สกุล */}
                      <td style={{ fontWeight: 600, minWidth: 160 }}>{row.ptname}</td>

                      {/* 6. อายุ */}
                      <td className="anc3-cell-center anc3-cell-num">
                        {row.age !== null ? `${row.age} ปี` : '—'}
                      </td>

                      {/* 7. สิทธิการรักษา */}
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>{row.pttypename_visit || '—'}</div>
                      </td>

                      {/* 8. UC */}
                      <td className="anc3-cell-center">
                        {row.uc === 'Y' ? (
                          <span className="anc3-badge anc3-badge-ok">UC</span>
                        ) : (
                          <span className="anc3-indicator-dash">—</span>
                        )}
                      </td>

                      {/* 9. US */}
                      <td className="anc3-cell-center">
                        {row.us === 'Y' ? (
                          <span className="anc3-indicator-y" title="หัตถการ Ultrasound (Oper)">
                            Y
                          </span>
                        ) : row.us === 'S' ? (
                          <span className="anc3-indicator-s" title="ค่าบริการ Ultrasound (Service)">
                            S
                          </span>
                        ) : (
                          <span className="anc3-indicator-dash">—</span>
                        )}
                      </td>

                      {/* 10. ตรวจช่องปาก */}
                      <td className="anc3-cell-center">
                        {row.checkup === 'Y' ? (
                          <span className="anc3-badge anc3-badge-ok">ตรวจแล้ว</span>
                        ) : (
                          <span className="anc3-indicator-dash">—</span>
                        )}
                      </td>

                      {/* 11. ขัดฟัน */}
                      <td className="anc3-cell-center">
                        {row.scalling === 'Y' ? (
                          <span className="anc3-badge anc3-badge-ok">ขัดแล้ว</span>
                        ) : (
                          <span className="anc3-indicator-dash">—</span>
                        )}
                      </td>

                      {/* 12. ครรภ์ที่ */}
                      <td className="anc3-cell-center anc3-cell-num">{row.preg_no || '—'}</td>

                      {/* 13. GA */}
                      <td className="anc3-cell-center anc3-cell-num">
                        {row.ga !== null ? (
                          <span
                            style={{
                              fontWeight: row.ga > 48 ? 700 : 500,
                              color: row.ga > 48 ? 'var(--anc-err)' : 'inherit',
                            }}
                          >
                            {row.ga} wk
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* 14. LMP */}
                      <td className="anc3-cell-num" style={{ whiteSpace: 'nowrap' }}>
                        {row.lmp ? formatThaiDate(row.lmp, 'short') : '—'}
                      </td>

                      {/* 15. ควรขัดฟันก่อน */}
                      <td className="anc3-cell-num" style={{ whiteSpace: 'nowrap' }}>
                        {row.lastdate ? formatThaiDate(row.lastdate, 'short') : '—'}
                      </td>

                      {/* 16. ANC (Trimester 1-5) */}
                      <td className="anc3-cell-center">
                        {row.anc ? (
                          <span className="anc3-badge anc3-badge-info">ANC {row.anc}</span>
                        ) : (
                          <span className="anc3-indicator-dash">—</span>
                        )}
                      </td>

                      {/* 17. กำหนดคลอด */}
                      <td className="anc3-cell-num" style={{ whiteSpace: 'nowrap' }}>
                        {row.labor_date ? formatThaiDate(row.labor_date, 'short') : '—'}
                      </td>

                      {/* 18. กลุ่มบริการ */}
                      <td style={{ fontSize: '0.8125rem' }}>{row.groupname}</td>

                      {/* 19. รหัสหัตถการ */}
                      <td className="anc3-cell-mono" style={{ fontSize: '0.75rem' }}>
                        {row.itemname || '—'}
                      </td>

                      {/* 20. สถานะ E-Claim */}
                      <td>
                        <span
                          className={`anc3-badge ${
                            row.status_eclaim?.includes('ได้รับ Invoice') ||
                            row.status_eclaim?.includes('ส่ง Rep')
                              ? 'anc3-badge-ok'
                              : row.status_eclaim?.includes('ยังไม่ได้ส่ง')
                              ? 'anc3-badge-subtle'
                              : 'anc3-badge-info'
                          }`}
                        >
                          {row.status_eclaim || '—'}
                        </span>
                      </td>

                      {/* 21. E-Claim No */}
                      <td className="anc3-cell-mono">{row.eclaim_no || '—'}</td>

                      {/* 22. ชดเชย (บาท) */}
                      <td className="anc3-cell-right" style={{ fontWeight: 600 }}>
                        {row.compensated > 0 ? (
                          <span style={{ color: 'var(--anc-ok)' }}>
                            {formatMoney(row.compensated)}
                          </span>
                        ) : (
                          '—'
                        )}
                        <RcmSeamlessSubAmount row={row} />
                      </td>

                      {/* 23. เลข Rep */}
                      <td className="anc3-cell-mono" style={{ fontSize: '0.75rem' }}>
                        {row.rep || '—'}
                        <RcmSeamlessRepBadges row={row} />
                      </td>

                      {/* 24. ข้อควรตรวจสอบ */}
                      <td>
                        {row.mean ? (
                          <span className="anc3-badge anc3-badge-warn" title={row.mean}>
                            <AlertTriangle size={12} style={{ marginRight: 4 }} />
                            {row.mean}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--anc-muted)', fontSize: '0.75rem' }}>
                            ปกติ
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination Controls ── */}
        {totalPages > 1 && (
          <div className="anc3-pagination">
            <div className="anc3-page-info">
              หน้า {currentPage} จากทั้งหมด {totalPages} หน้า (รวม {totalCount.toLocaleString()} รายการ)
            </div>

            <div className="anc3-page-controls">
              <button
                type="button"
                className="anc3-btn anc3-btn-secondary"
                style={{ minHeight: 38, padding: '0 12px' }}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                <span>ก่อนหน้า</span>
              </button>

              <button
                type="button"
                className="anc3-btn anc3-btn-secondary"
                style={{ minHeight: 38, padding: '0 12px' }}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <span>ถัดไป</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Patient Inspection Modal (2 Tabs) ── */}
      {selectedItem && (
        <div
          className="anc3-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetailModal()
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="anc3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="anc3-modal-header">
              <h2 className="anc3-modal-title">
                เวชระเบียนผู้รับบริการฝากครรภ์: {selectedItem.ptname}
              </h2>
              <button
                type="button"
                className="anc3-clear-btn"
                onClick={closeDetailModal}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="anc3-modal-tabs">
              <button
                type="button"
                className={`anc3-modal-tab ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปข้อมูลบริการ 2.3
              </button>
              <button
                type="button"
                className={`anc3-modal-tab ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก (HOSxP)
              </button>
            </div>

            <div className="anc3-modal-body">
              {modalTab === 'summary' ? (
                <>
                  {/* General Details Grid */}
                  <div className="anc3-modal-grid">
                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">เลขบัตรประชาชน (CID)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="anc3-info-value anc3-cell-mono">
                          {formatCidDisplay(selectedItem.cid)}
                        </span>
                        <button
                          type="button"
                          className="anc3-clear-btn"
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอกเลขบัตรประชาชน"
                        >
                          {copiedField === 'cid' ? <Check size={14} color="var(--anc-ok)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">HN / VN</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="anc3-info-value anc3-cell-mono">
                          {selectedItem.hn} / {selectedItem.vn}
                        </span>
                        <button
                          type="button"
                          className="anc3-clear-btn"
                          onClick={() => handleCopy(selectedItem.vn, 'vn')}
                          title="คัดลอก VN"
                        >
                          {copiedField === 'vn' ? <Check size={14} color="var(--anc-ok)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">วันที่รับบริการ</span>
                      <span className="anc3-info-value">
                        {formatThaiDate(selectedItem.vstdate, 'full')} {selectedItem.vsttime || ''}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">ห้องตรวจ / แผนก</span>
                      <span className="anc3-info-value">{selectedItem.room || '—'}</span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">สิทธิการรักษา</span>
                      <span className="anc3-info-value">{selectedItem.pttypename_visit || '—'}</span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">ClaimCode (สปสช.)</span>
                      <span className="anc3-info-value anc3-cell-mono">
                        {selectedItem.authencode || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Pregnancy & Clinical Stream Grid */}
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 0', color: 'var(--anc-accent)' }}>
                    ข้อมูลการตั้งครรภ์ & การให้บริการ (ANC / ทันตกรรม / US)
                  </h3>

                  <div className="anc3-modal-grid">
                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">กลุ่มบริการที่ได้รับ</span>
                      <span className="anc3-info-value">{selectedItem.groupname}</span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">ครรภ์ที่ / อายุครรภ์ (GA)</span>
                      <span className="anc3-info-value">
                        ครรภ์ที่ {selectedItem.preg_no || '—'} • GA: {selectedItem.ga !== null ? `${selectedItem.ga} สัปดาห์` : '—'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">ไตรมาสฝากครรภ์ (ANC)</span>
                      <span className="anc3-info-value">
                        {selectedItem.anc ? `ANC ครั้งที่ ${selectedItem.anc}` : '—'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">LMP (ประจำเดือนครั้งสุดท้าย)</span>
                      <span className="anc3-info-value">
                        {selectedItem.lmp ? formatThaiDate(selectedItem.lmp, 'long') : '—'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">ควรขัดฟันก่อนวันที่ (LMP + 24 wk)</span>
                      <span className="anc3-info-value">
                        {selectedItem.lastdate ? formatThaiDate(selectedItem.lastdate, 'long') : '—'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">กำหนดคลอด / วันจำหน่าย</span>
                      <span className="anc3-info-value">
                        {selectedItem.labor_date ? formatThaiDate(selectedItem.labor_date, 'long') : '—'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">Ultrasound</span>
                      <span className="anc3-info-value">
                        {selectedItem.us === 'Y'
                          ? `หัตถการ (${selectedItem.oper || '8878'})`
                          : selectedItem.us === 'S'
                          ? `บริการ (${selectedItem.servicename || 'Ultrasound'})`
                          : '—'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">ตรวจช่องปาก / ขูดหินปูน-ขัดฟัน</span>
                      <span className="anc3-info-value">
                        ตรวจช่องปาก: {selectedItem.checkup === 'Y' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ'} • ขัดฟัน:{' '}
                        {selectedItem.scalling === 'Y' ? 'ขัดแล้ว' : 'ยังไม่ขัด'}
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">รหัสหัตถการทั้งหมด</span>
                      <span className="anc3-info-value anc3-cell-mono">
                        {selectedItem.itemname || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Reimbursement Details */}
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 0', color: 'var(--anc-accent)' }}>
                    ข้อมูลการเบิกจ่าย & การชดเชย (E-Claim / REP)
                  </h3>

                  <div className="anc3-modal-grid">
                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">สถานะ E-Claim</span>
                      <span className="anc3-info-value">{selectedItem.status_eclaim || '—'}</span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">E-Claim No</span>
                      <span className="anc3-info-value anc3-cell-mono">{selectedItem.eclaim_no || '—'}</span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">จำนวนเงินชดเชย</span>
                      <span className="anc3-info-value" style={{ color: 'var(--anc-ok)', fontWeight: 700 }}>
                        {formatMoney(selectedItem.compensated)} บาท
                      </span>
                    </div>

                    <div className="anc3-info-tile">
                      <span className="anc3-info-label">เลขที่ Rep / กองทุน</span>
                      <span className="anc3-info-value anc3-cell-mono">
                        {selectedItem.rep || '—'} {selectedItem.fund ? `(${selectedItem.fund})` : ''}
                      </span>
                    </div>

                    {selectedItem.mean && (
                      <div className="anc3-info-tile" style={{ gridColumn: '1 / -1', background: 'var(--anc-warn-bg)', borderColor: 'var(--anc-warn-border)' }}>
                        <span className="anc3-info-label" style={{ color: 'var(--anc-warn)' }}>
                          ข้อควรตรวจสอบ / เตือน
                        </span>
                        <span className="anc3-info-value" style={{ color: 'var(--anc-warn)' }}>
                          {selectedItem.mean}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Tab 2: Clinical Details from HOSxP */
                <div>
                  {clinicalLoading ? (
                    <div className="anc3-loading-state" style={{ minHeight: 200 }}>
                      <RefreshCw size={28} className="anc3-spinner" />
                      <span>กำลังดึงข้อมูลเวชระเบียนคลินิก HOSxP...</span>
                    </div>
                  ) : clinicalError ? (
                    <div className="anc3-empty-state" style={{ color: 'var(--anc-err)' }}>
                      <AlertTriangle size={28} />
                      <span>{clinicalError}</span>
                    </div>
                  ) : clinicalData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Chief Complaint & Physical Exam */}
                      <div className="anc3-info-tile">
                        <span className="anc3-info-label">อาการสำคัญ (CC)</span>
                        <span className="anc3-info-value">{clinicalData.screen?.cc || (clinicalData as any).cc || '—'}</span>
                      </div>

                      {(clinicalData.screen?.pe || (clinicalData as any).pe) && (
                        <div className="anc3-info-tile">
                          <span className="anc3-info-label">ผลการตรวจร่างกาย (PE)</span>
                          <span className="anc3-info-value">{clinicalData.screen?.pe || (clinicalData as any).pe}</span>
                        </div>
                      )}

                      {/* Vitals */}
                      <div className="anc3-modal-grid">
                        <div className="anc3-info-tile">
                          <span className="anc3-info-label">ความดันโลหิต (BP)</span>
                          <span className="anc3-info-value">
                            {(clinicalData.screen?.bps || (clinicalData as any).bps)
                              ? `${clinicalData.screen?.bps ?? (clinicalData as any).bps}/${clinicalData.screen?.bpd ?? (clinicalData as any).bpd} mmHg`
                              : '—'}
                          </span>
                        </div>
                        <div className="anc3-info-tile">
                          <span className="anc3-info-label">ชีพจร (Pulse)</span>
                          <span className="anc3-info-value">
                            {(clinicalData.screen?.pulse || (clinicalData as any).pulse)
                              ? `${clinicalData.screen?.pulse ?? (clinicalData as any).pulse} bpm`
                              : '—'}
                          </span>
                        </div>
                        <div className="anc3-info-tile">
                          <span className="anc3-info-label">น้ำหนัก / ส่วนสูง</span>
                          <span className="anc3-info-value">
                            {(clinicalData.screen?.bw || (clinicalData as any).bw)
                              ? `${clinicalData.screen?.bw ?? (clinicalData as any).bw} กก.`
                              : '—'}{' '}
                            {(clinicalData.screen?.height || (clinicalData as any).height)
                              ? `/ ${clinicalData.screen?.height ?? (clinicalData as any).height} ซม.`
                              : ''}
                          </span>
                        </div>
                      </div>

                      {/* Diagnoses */}
                      <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '8px 0 6px' }}>การวินิจฉัย (ICD-10)</h4>
                        {clinicalData.diagnoses && clinicalData.diagnoses.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {clinicalData.diagnoses.map((dx, i) => (
                              <div key={i} className="anc3-info-tile" style={{ padding: '8px 12px' }}>
                                <span className="anc3-info-value">
                                  <strong>{dx.icd10}</strong>: <span>{(dx as any).name || dx.icd_name || '—'}</span> (
                                  {(dx as any).dxtype || dx.diagtype_name || dx.diagtype})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--anc-muted)', fontSize: '0.875rem' }}>ไม่มีรายการวินิจฉัย</div>
                        )}
                      </div>

                      {/* Procedures */}
                      <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '8px 0 6px' }}>หัตถการ / การตรวจ (Procedures & Dental)</h4>
                        {(clinicalData as any).procedures && (clinicalData as any).procedures.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {(clinicalData as any).procedures.map((op: any, i: number) => (
                              <div key={i} className="anc3-info-tile" style={{ padding: '8px 12px' }}>
                                <span className="anc3-info-value">
                                  <strong>{op.icd9}</strong>: <span>{op.name || '—'}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : selectedItem?.itemname || selectedItem?.servicename ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {selectedItem?.servicename && (
                              <div className="anc3-info-tile" style={{ padding: '8px 12px' }}>
                                <span className="anc3-info-value">
                                  <strong>บริการ:</strong> {selectedItem.servicename}
                                </span>
                              </div>
                            )}
                            {selectedItem?.itemname && (
                              <div className="anc3-info-tile" style={{ padding: '8px 12px' }}>
                                <span className="anc3-info-value">
                                  <strong>รหัสหัตถการ:</strong> {selectedItem.itemname}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--anc-muted)', fontSize: '0.875rem' }}>ไม่มีรายการหัตถการ</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>

            <div className="anc3-modal-footer">
              <button
                type="button"
                className="anc3-btn anc3-btn-secondary"
                onClick={closeDetailModal}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
