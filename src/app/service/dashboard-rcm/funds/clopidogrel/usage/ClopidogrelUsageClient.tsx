'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
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
  Pill,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  FileText,
  Activity,
  Copy,
  Check,
} from 'lucide-react'
import type {
  ClopidogrelItem,
  ClopidogrelSummary,
  ClopidogrelCardFilter,
  ClopidogrelSortField,
  ClopidogrelAdpMappingCheck,
  ClopidogrelReportResult,
} from '@/lib/clinical/rcmClopidogrelService'
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

const CARD_FILTER_LABELS: Record<ClopidogrelCardFilter, string> = {
  ALL: 'ทั้งหมด',
  COMPENSATED: 'เฉพาะที่ชดเชยแล้ว',
  UNCOMPENSATED: 'เฉพาะที่ยังไม่ชดเชย',
  UC_ONLY: 'เฉพาะสิทธิบัตรทอง (UC)',
  WITH_AUTHEN: 'เฉพาะที่มี Authen Code',
  NO_AUTHEN: 'เฉพาะที่ไม่มี Authen Code',
  INVOICE: 'เฉพาะที่ได้ Invoice แล้ว',
  NOT_SENT: 'เฉพาะที่ยังไม่ได้ส่ง e-Claim',
}

function formatMoney(val?: number | null): string {
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface ClopidogrelUsageClientProps {
  initialData?: ClopidogrelReportResult | null
}

export default function ClopidogrelUsageClient({
  initialData = null,
}: ClopidogrelUsageClientProps) {
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

  // Date selection states: Standard Order: กำหนดเอง -> เดือน -> ปีงบประมาณ
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
  const [pttypes, setPttypes] = useState<string[]>([])
  const [cardFilter, setCardFilter] = useState<ClopidogrelCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<ClopidogrelSortField>(
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
  const [items, setItems] = useState<ClopidogrelItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<ClopidogrelAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '3799977101',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<ClopidogrelSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      totalDrugMoney: 0,
      totalHosxpIncome: 0,
      totalQty: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      invoiceCount: 0,
      invoiceRate: 0,
      repCount: 0,
      repRate: 0,
      notSentCount: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<ClopidogrelItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef<boolean>(true)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch report data
  const fetchData = useCallback(
    async (refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (refresh) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const query = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })
        if (pttypes.length > 0) query.set('pttypes', pttypes.join(','))
        if (refresh) query.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/clopidogrel/usage?${query.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `HTTP ${res.status}`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const d: ClopidogrelReportResult = json.data
          setItems(d.items)
          setTotalCount(d.totalCount)
          setTotalPages(d.totalPages)
          setSummary(d.summary)
          setAdpMapping(d.adpMapping)
        } else {
          throw new Error(json?.error?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, debouncedSearch, sortBy, sortOrder, currentPage, pageSize, pttypes]
  )

  // Fetch on parameter changes (skipping initial fetch if server data present)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Handle Date Mode Changes
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
    setCurrentPage(1)
    const ceYear = beYear - 543
    setDs1(`${ceYear - 1}-10-01`)
    setDs2(`${ceYear}-09-30`)
  }

  const handleMonthChange = (month: number, beYear: number) => {
    setSelectedMonth(month)
    setSelectedBeYear(beYear)
    setCurrentPage(1)
    const ceYear = beYear - 543
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
  }

  // Handle Sorting
  const handleSort = (field: ClopidogrelSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Card Filter click (toggle filter)
  const handleCardFilterClick = (filter: ClopidogrelCardFilter) => {
    if (cardFilter === filter && filter !== 'ALL') {
      setCardFilter('ALL')
    } else {
      setCardFilter(filter)
    }
    setCurrentPage(1)
  }

  // Fetch VN Clinical details for modal
  useEffect(() => {
    if (!selectedItem || modalTab !== 'clinical') return
    let active = true
    setLoadingVnDetails(true)
    fetch(`/api/service/dashboard-rcm/funds/clopidogrel/vn-details?vn=${encodeURIComponent(selectedItem.vn)}`)
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success) {
          setVnDetails(json.data)
        }
      })
      .catch(() => {
        if (active) setVnDetails(null)
      })
      .finally(() => {
        if (active) setLoadingVnDetails(false)
      })

    return () => {
      active = false
    }
  }, [selectedItem, modalTab])

  // Copy helper
  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 1800)
  }

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const query = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) query.set('pttypes', pttypes.join(','))
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/clopidogrel/usage?${query.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')
      }

      const exportItems: ClopidogrelItem[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        'วันที่รับบริการ',
        'เวลารับบริการ',
        'สิทธิการรักษา',
        'สิทธิบัตรทอง',
        'ClaimCode',
        'แผนก',
        'คลินิก',
        'แพทย์ผู้สั่ง',
        'PDX',
        'รายการยา Clopidogrel',
        'จำนวน',
        'หน่วย',
        'ค่ายา (บาท)',
        'รวมค่ารักษา HOSxP (บาท)',
        'รหัส ADP',
        'รหัส TMT',
        'รหัส DID',
        'สถานะ e-Claim',
        'เลข Rep',
        'ยอดชดเชย (บาท)',
      ]

      const rows = exportItems.map((i, idx) => [
        idx + 1,
        i.vn,
        i.hn,
        i.cid,
        i.ptname,
        i.sex,
        i.age,
        i.vstdate,
        i.vsttime,
        i.pttypename,
        i.isUc ? 'ใช่' : 'ไม่ใช่',
        i.authencode || '',
        i.department || '',
        i.clinic || '',
        i.doctorname || '',
        i.pdx || '',
        i.drugname,
        i.qty,
        i.units || '',
        i.money,
        i.hosxp_money,
        i.adpcode || '',
        i.tmt || '',
        i.did || '',
        i.status_eclaim,
        i.rep || '',
        i.compensated,
      ])

      await exportRcmExcel({
        filename: `clopidogrel-usage-${ds1}-to-${ds2}.xlsx`,
        title: 'รายชื่อการใช้ยา Clopidogrel',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportItems.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="clop-container">
      {/* ── 1. Header & Breadcrumb ── */}
      <div className="clop-header">
        <div>
          <div className="clop-breadcrumb">
            <Link href="/service/dashboard-rcm">RCM Dashboard</Link>
            <span className="clop-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm">กองทุน</Link>
            <span className="clop-breadcrumb-sep">/</span>
            <span className="clop-breadcrumb-cur">กองทุนยา Clopidogrel</span>
          </div>
          <h1 className="clop-title">รายชื่อการใช้ยา Clopidogrel</h1>
          <p className="clop-subtitle">
            รายงานการสั่งใช้ยา Clopidogrel ตรวจสอบรหัส ADP และสถานะการชดเชยค่าบริการทางการแพทย์
          </p>
        </div>

        <div className="clop-header-actions">
          <button
            type="button"
            className="clop-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'clop-spinner' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            className="clop-btn clop-btn-primary"
            onClick={handleExportExcel}
            disabled={isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Warnings / ADP Mapping Check ── */}
      {!adpMapping.isMapped && (
        <div className="clop-warning-banner">
          <AlertTriangle size={20} className="clop-warning-icon" />
          <div className="clop-warning-content">
            <strong>แจ้งเตือนการกำหนดรหัส ADP:</strong>
            <span>
              ไม่พบการผูกรหัส NHSO ADP Code <code>{adpMapping.adpCode}</code> กับรายการยาในระบบ
              กรุณาตรวจสอบการตั้งค่ารหัส ADP ในระบบ HOSxP เพื่อให้การเคลมชดเชยสมบูรณ์
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Date Selector Toolbar (Single Unified Row) ── */}
      <div className="clop-date-toolbar">
        <div className="clop-date-left">
          {/* Segmented Mode Switcher: กำหนดเอง | เดือน | ปีงบประมาณ (NO numbers) */}
          <div className="clop-segmented-tabs">
            <button
              type="button"
              className={`clop-tab-btn ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`clop-tab-btn ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              className={`clop-tab-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleDateModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="clop-date-divider" />

          {/* Date Controls */}
          <div className="clop-date-inputs">
            {dateMode === 'custom' && (
              <div className="clop-date-range-group">
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  aria-label="วันที่เริ่มต้น"
                />
                <span className="clop-date-range-to">ถึง</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  aria-label="วันที่สิ้นสุด"
                />
              </div>
            )}

            {dateMode === 'monthly' && (
              <div className="clop-date-range-group">
                <select
                  className="clop-select"
                  value={selectedMonth}
                  onChange={(e) =>
                    handleMonthChange(parseInt(e.target.value, 10), selectedBeYear)
                  }
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  className="clop-select"
                  value={selectedBeYear}
                  onChange={(e) =>
                    handleMonthChange(selectedMonth, parseInt(e.target.value, 10))
                  }
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
              <select
                className="clop-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(parseInt(e.target.value, 10))}
                aria-label="เลือกปีงบประมาณ"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Equal 4x2 Balanced KPI Summary Grid (Clickable Filters) ── */}
      <div className="clop-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`clop-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">ผู้รับบริการทั้งหมด</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-all">
              <Pill size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            {summary.uniquePatients.toLocaleString('th-TH')} คน • ยอดรวม {formatMoney(summary.totalHosxpIncome)} บ.
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`clop-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">ชดเชยแล้ว</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-success">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.compensatedVisits.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            ยอดชดเชย {formatMoney(summary.totalCompensated)} บ. ({summary.compensationRate}%)
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย */}
        <div
          className={`clop-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้รับการชดเชย"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">ยังไม่ชดเชย</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-warning">
              <Clock size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.uncompensatedVisits.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            รอการพิจารณาหรือยังไม่ได้ตอบรับ
          </div>
        </div>

        {/* Card 4: สิทธิบัตรทอง (UC) */}
        <div
          className={`clop-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          title="คลิกเพื่อกรองเฉพาะผู้มีสิทธิบัตรทอง (UC)"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">สิทธิบัตรทอง (UC)</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-indigo">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.ucCount.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            สัดส่วน {summary.ucRate}% ของผู้รับบริการ
          </div>
        </div>

        {/* Card 5: มี ClaimCode */}
        <div
          className={`clop-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรองรายการที่มี ClaimCode"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">มี ClaimCode</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-teal">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            สัดส่วนยืนยันตัวตน {summary.authenRate}%
          </div>
        </div>

        {/* Card 6: ไม่มี ClaimCode */}
        <div
          className={`clop-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          title="คลิกเพื่อกรองรายการที่ไม่มี ClaimCode"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">ไม่มี ClaimCode</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-danger">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.withoutAuthenCount.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            ต้องติดตามขอรหัส ClaimCode
          </div>
        </div>

        {/* Card 7: ได้รับ Invoice แล้ว */}
        <div
          className={`clop-kpi-card ${cardFilter === 'INVOICE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('INVOICE')}
          title="คลิกเพื่อกรองรายการที่ NHSO ได้รับ Invoice แล้ว"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">ได้รับ Invoice แล้ว</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-success">
              <FileText size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.invoiceCount.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            NHSO ออกใบตอบรับแล้ว ({summary.invoiceRate}%)
          </div>
        </div>

        {/* Card 8: ยังไม่ได้ส่ง */}
        <div
          className={`clop-kpi-card ${cardFilter === 'NOT_SENT' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NOT_SENT')}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้ส่ง e-Claim"
        >
          <div className="clop-kpi-top">
            <span className="clop-kpi-label">ยังไม่ได้ส่ง</span>
            <div className="clop-kpi-icon-wrap clop-kpi-icon-warning">
              <Clock size={18} />
            </div>
          </div>
          <div className="clop-kpi-value-row">
            <span className="clop-kpi-value">{summary.notSentCount.toLocaleString('th-TH')}</span>
            <span className="clop-kpi-unit">ครั้ง</span>
          </div>
          <div className="clop-kpi-sub">
            รอตรวจสอบข้อมูลและส่งเบิก
          </div>
        </div>
      </div>

      {/* ── 5. Search Bar & Toolbar (Unified Global Search) ── */}
      <div className="clop-toolbar">
        <div className="clop-search-box">
          <Search size={18} className="clop-search-icon" />
          <input
            type="text"
            className="clop-search-input"
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, VN, แพทย์, แผนก, โรค..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clop-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <PttypeMultiSelect
          selectedCodes={pttypes}
          onChange={(codes) => {
            setPttypes(codes)
            setCurrentPage(1)
            }}
            items={items}
        
          />

        <div className="clop-toolbar-stats">
          <span>
            พบข้อมูล{' '}
            <span className="clop-stat-highlight">{totalCount.toLocaleString('th-TH')}</span>{' '}
            รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <span className="clop-filter-chip">
              <span>ตัวกรอง: {CARD_FILTER_LABELS[cardFilter]}</span>
              <button
                type="button"
                className="clop-chip-clear"
                onClick={() => handleCardFilterClick('ALL')}
                title="ล้างตัวกรองการ์ด"
                aria-label="ล้างตัวกรองการ์ด"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── 6. Error Notice ── */}
      {error && (
        <div className="clop-warning-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={20} className="clop-warning-icon" style={{ color: '#dc2626' }} />
          <div className="clop-warning-content">
            <strong>เกิดข้อผิดพลาด:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── 7. Table Card (Centered Columns, Row-Clickable) ── */}
      <div className="clop-table-card">
        {loading ? (
          <div className="clop-loading-state">
            <RefreshCw size={28} className="clop-spinner" />
            <span>กำลังโหลดข้อมูลการใช้ยา Clopidogrel...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="clop-empty-state">
            <Pill size={40} className="clop-empty-icon" />
            <h3 className="clop-empty-title">ไม่พบรายการการใช้ยา Clopidogrel</h3>
            <p className="clop-empty-desc">
              ไม่พบประวัติการสั่งใช้ยาที่ตรงตามเงื่อนไขในช่วงเวลาหรือตัวกรองที่เลือก
              ลองปรับเปลี่ยนช่วงเวลาหรือล้างคำค้นหา
            </p>
          </div>
        ) : (
          <div className="clop-table-responsive">
            <table className="clop-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }} className="clop-col-center">ลำดับ</th>
                  <th style={{ width: 130 }} className="clop-col-center">
                    <button
                      type="button"
                      className="clop-th-sort"
                      onClick={() => handleSort('vstdate')}
                    >
                      <span>วันที่รับบริการ</span>
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th style={{ width: 80 }} className="clop-col-center">เวลา</th>
                  <th style={{ width: 90 }} className="clop-col-center">
                    <button
                      type="button"
                      className="clop-th-sort"
                      onClick={() => handleSort('hn')}
                    >
                      <span>HN</span>
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th style={{ width: 140 }} className="clop-col-center">เลขบัตรประชาชน</th>
                  <th style={{ minWidth: 180 }} className="clop-col-center">ชื่อ-สกุลผู้ป่วย</th>
                  <th style={{ width: 80 }} className="clop-col-center">อายุ</th>
                  <th style={{ minWidth: 150 }} className="clop-col-center">สิทธิการรักษา</th>
                  <th style={{ minWidth: 180 }} className="clop-col-center">ยา Clopidogrel / จำนวน</th>
                  <th style={{ width: 110 }} className="clop-col-center">
                    <button
                      type="button"
                      className="clop-th-sort"
                      onClick={() => handleSort('money')}
                    >
                      <span>ค่ายา (บาท)</span>
                      {sortBy === 'money' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th style={{ width: 130 }} className="clop-col-center">
                    ClaimCode
                  </th>
                  <th style={{ minWidth: 150 }} className="clop-col-center">สถานะ e-Claim</th>
                  <th style={{ width: 110 }} className="clop-col-center">
                    <button
                      type="button"
                      className="clop-th-sort"
                      onClick={() => handleSort('compensated')}
                    >
                      <span>ชดเชย (บาท)</span>
                      {sortBy === 'compensated' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.vn}
                    onClick={() => {
                      setSelectedItem(item)
                      setModalTab('summary')
                    }}
                    title="คลิกเพื่อดูรายละเอียดเวชระเบียนและการชดเชย"
                  >
                    <td className="clop-col-center clop-tabular">{item.no}</td>
                    <td className="clop-col-center">{formatThaiDate(item.vstdate)}</td>
                    <td className="clop-col-center clop-tabular">{item.vsttime.slice(0, 5)}</td>
                    <td className="clop-col-center clop-tabular">{item.hn}</td>
                    <td className="clop-col-center clop-tabular">{item.cid || '—'}</td>
                    {/* Centered Patient Name on X-Axis & Intact Surname Wrap */}
                    <td className="clop-name-cell">
                      <span className="clop-name-wrap">{item.firstName}</span>{' '}
                      <span className="clop-name-wrap">{item.lastName}</span>
                    </td>
                    <td className="clop-col-center">
                      <span style={{ whiteSpace: 'nowrap' }}>{item.age} ปี</span>
                    </td>
                    <td className="clop-col-center">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {item.isUc && <span className="clop-badge clop-badge-uc">UC</span>}
                        <span style={{ fontSize: '0.8125rem' }}>{item.pttypename || '—'}</span>
                      </div>
                    </td>
                    <td className="clop-col-center">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontWeight: 500 }}>{item.drugname}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-500, #64748b)' }} className="clop-tabular">
                          {item.qty} {item.units || 'เม็ด'}
                        </span>
                      </div>
                    </td>
                    <td className="clop-col-center clop-tabular">{formatMoney(item.money)}</td>
                    <td className="clop-col-center">
                      {item.authencode ? (
                        <span className="clop-badge clop-badge-info clop-tabular">
                          {item.authencode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>—</span>
                      )}
                    </td>
                    <td className="clop-col-center">
                      <span
                        className={`clop-badge ${
                          item.status_eclaim.includes('Invoice')
                            ? 'clop-badge-success'
                            : item.status_eclaim.includes('Rep')
                            ? 'clop-badge-info'
                            : item.status_eclaim.includes('ยังไม่ได้ส่ง')
                            ? 'clop-badge-warning'
                            : 'clop-badge-gray'
                        }`}
                      >
                        {item.status_eclaim}
                      </span>
                    </td>
                    <td className="clop-col-center clop-tabular">
                      {item.isCompensated ? (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          {formatMoney(item.compensated)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400, #94a3b8)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 8. Pagination Controls ── */}
        {totalCount > 0 && (
          <div className="clop-pagination">
            <div className="clop-pagination-info">
              แสดงรายการที่ {((currentPage - 1) * pageSize + 1).toLocaleString('th-TH')} ถึง{' '}
              {Math.min(currentPage * pageSize, totalCount).toLocaleString('th-TH')} จากทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ
            </div>

            <div className="clop-pagination-controls">
              <select
                className="clop-select"
                style={{ height: 36, padding: '0 28px 0 10px', fontSize: '0.8125rem' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10))
                  setCurrentPage(1)
                }}
                aria-label="จำนวนแถวต่อหน้า"
              >
                <option value={20}>20 แถว/หน้า</option>
                <option value={50}>50 แถว/หน้า</option>
                <option value={100}>100 แถว/หน้า</option>
                <option value={200}>200 แถว/หน้า</option>
              </select>

              <button
                type="button"
                className="clop-page-btn"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="clop-page-current">
                หน้า {currentPage} จาก {totalPages}
              </span>

              <button
                type="button"
                className="clop-page-btn"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Detail Modal (Interactive Record View) ── */}
      {selectedItem && (
        <div
          className="clop-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="clop-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clop-modal-header">
              <div>
                <h2 className="clop-modal-title">
                  {selectedItem.ptname}
                </h2>
                <div className="clop-modal-meta">
                  <span className="clop-modal-meta-item">
                    HN: <strong className="clop-tabular">{selectedItem.hn}</strong>
                    <button
                      type="button"
                      className="clop-copy-btn"
                      onClick={() => handleCopy(selectedItem.hn, 'hn')}
                      title="คัดลอก HN"
                    >
                      {copiedField === 'hn' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                  <span className="clop-modal-meta-sep">•</span>
                  <span className="clop-modal-meta-item">
                    VN: <strong className="clop-tabular">{selectedItem.vn}</strong>
                    <button
                      type="button"
                      className="clop-copy-btn"
                      onClick={() => handleCopy(selectedItem.vn, 'vn')}
                      title="คัดลอก VN"
                    >
                      {copiedField === 'vn' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                  {selectedItem.cid && (
                    <>
                      <span className="clop-modal-meta-sep">•</span>
                      <span className="clop-modal-meta-item">
                        CID: <strong className="clop-tabular">{selectedItem.cid}</strong>
                        <button
                          type="button"
                          className="clop-copy-btn"
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอกเลขบัตรประชาชน"
                        >
                          {copiedField === 'cid' ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="clop-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="clop-modal-tabs">
              <button
                type="button"
                className={`clop-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                ข้อมูลทั่วไป & การใช้ยา
              </button>
              <button
                type="button"
                className={`clop-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                รายการค่าใช้จ่ายทั้งหมด (VN Details)
              </button>
            </div>

            <div className="clop-modal-body">
              {modalTab === 'summary' && (
                <>
                  {/* ผู้ป่วยและการรับบริการ */}
                  <div className="clop-modal-section">
                    <h3 className="clop-section-title">
                      <UserCheck size={18} style={{ color: 'var(--primary, #0D7446)' }} />
                      <span>ข้อมูลผู้ป่วยและการรับบริการ</span>
                    </h3>
                    <div className="clop-detail-grid">
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">ชื่อ-สกุล</span>
                        <span className="clop-detail-val">{selectedItem.ptname}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">เพศ / อายุ</span>
                        <span className="clop-detail-val">{selectedItem.sex} • {selectedItem.age} ปี</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">วันที่รับบริการ</span>
                        <span className="clop-detail-val">
                          {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime} น.
                        </span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">สิทธิการรักษา</span>
                        <span className="clop-detail-val">
                          {selectedItem.pttypename} {selectedItem.isUc && '(สิทธิบัตรทอง)'}
                        </span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">แผนก / แผนกหลัก</span>
                        <span className="clop-detail-val">{selectedItem.department || '—'}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">คลินิก</span>
                        <span className="clop-detail-val">{selectedItem.clinic || '—'}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">แพทย์ผู้สั่ง</span>
                        <span className="clop-detail-val">{selectedItem.doctorname || '—'}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">การวินิจฉัยหลัก (PDX)</span>
                        <span className="clop-detail-val">{selectedItem.pdx || '—'}</span>
                      </div>
                      {(selectedItem.dx0 || selectedItem.dx1 || selectedItem.dx2) && (
                        <div className="clop-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="clop-detail-label">การวินิจฉัยร่วม (SDX)</span>
                          <span className="clop-detail-val">
                            {[selectedItem.dx0, selectedItem.dx1, selectedItem.dx2, selectedItem.dx3, selectedItem.dx4, selectedItem.dx5]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ข้อมูลการใช้ยา Clopidogrel */}
                  <div className="clop-modal-section">
                    <h3 className="clop-section-title">
                      <Pill size={18} style={{ color: '#2563eb' }} />
                      <span>ข้อมูลการสั่งใช้ยา Clopidogrel</span>
                    </h3>
                    <div className="clop-detail-grid">
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">ชื่อยา</span>
                        <span className="clop-detail-val">{selectedItem.drugname}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">จำนวนที่จ่าย</span>
                        <span className="clop-detail-val">
                          {selectedItem.qty} {selectedItem.units || 'เม็ด'}
                        </span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">ค่ายา Clopidogrel</span>
                        <span className="clop-detail-val">{formatMoney(selectedItem.money)} บาท</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">รวมค่าบริการทั้ง Visit (HOSxP)</span>
                        <span className="clop-detail-val">{formatMoney(selectedItem.hosxp_money)} บาท</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">รหัส ADP</span>
                        <span className="clop-detail-val">{selectedItem.adpcode || '—'}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">รหัส TMT</span>
                        <span className="clop-detail-val">{selectedItem.tmt || '—'}</span>
                      </div>
                      <div className="clop-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="clop-detail-label">รหัส DID (24 หลัก)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="clop-detail-val clop-tabular" style={{ wordBreak: 'break-all' }}>
                            {selectedItem.did || '—'}
                          </span>
                          {selectedItem.did && (
                            <button
                              type="button"
                              className="clop-copy-btn"
                              onClick={() => handleCopy(selectedItem.did!, 'did')}
                              title="คัดลอกรหัส DID"
                            >
                              {copiedField === 'did' ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* สถานะการชดเชย & e-Claim */}
                  <div className="clop-modal-section">
                    <h3 className="clop-section-title">
                      <ReceiptText size={18} style={{ color: '#16a34a' }} />
                      <span>สถานะการส่งเคลม & ชดเชยค่าบริการ</span>
                    </h3>
                    <div className="clop-detail-grid">
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">สถานะ e-Claim</span>
                        <span className="clop-detail-val">{selectedItem.status_eclaim}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">ClaimCode:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="clop-detail-val clop-tabular">{selectedItem.authencode || '—'}</span>
                          {selectedItem.authencode && (
                            <button
                              type="button"
                              className="clop-copy-btn"
                              onClick={() => handleCopy(selectedItem.authencode!, 'authen')}
                              title="คัดลอก ClaimCode"
                            >
                              {copiedField === 'authen' ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">เลข Rep / Statement</span>
                        <span className="clop-detail-val">{selectedItem.rep || '—'}</span>
                      </div>
                      <div className="clop-detail-item">
                        <span className="clop-detail-label">ยอดชดเชยจริง</span>
                        <span className="clop-detail-val" style={{ color: selectedItem.isCompensated ? '#15803d' : 'inherit', fontWeight: 600 }}>
                          {formatMoney(selectedItem.compensated)} บาท
                        </span>
                      </div>
                      {selectedItem.fund && (
                        <div className="clop-detail-item">
                          <span className="clop-detail-label">กองทุน (Fund)</span>
                          <span className="clop-detail-val">{selectedItem.fund}</span>
                        </div>
                      )}
                      {selectedItem.subfund && (
                        <div className="clop-detail-item">
                          <span className="clop-detail-label">กองทุนย่อย (Subfund)</span>
                          <span className="clop-detail-val">{selectedItem.subfund}</span>
                        </div>
                      )}
                      {selectedItem.errorcode && (
                        <div className="clop-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="clop-detail-label">Error Code / ข้อผิดพลาด</span>
                          <span className="clop-detail-val" style={{ color: '#dc2626' }}>
                            {selectedItem.errorcode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'clinical' && (
                <div className="clop-modal-section">
                  <h3 className="clop-section-title">
                    <Activity size={18} style={{ color: 'var(--primary, #0D7446)' }} />
                    <span>รายการค่าใช้จ่ายและบริการทางการแพทย์ทั้งหมด (VN: {selectedItem.vn})</span>
                  </h3>

                  {loadingVnDetails ? (
                    <div className="clop-loading-state" style={{ padding: '32px 0' }}>
                      <RefreshCw size={24} className="clop-spinner" />
                      <span>กำลังโหลดรายการเวชระเบียน...</span>
                    </div>
                  ) : !vnDetails ? (
                    <div className="clop-empty-state" style={{ padding: '32px 0' }}>
                      <FileText size={32} className="clop-empty-icon" />
                      <p>ไม่พบรายการค่าใช้จ่ายเพิ่มเติมสำหรับ Visit นี้</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* สรุปหมวดหมู่ค่ารักษา */}
                      {vnDetails.orders?.categories && vnDetails.orders.categories.length > 0 && (
                        <div className="clop-table-responsive" style={{ border: '1px solid var(--gray-200, #e2e8f0)', borderRadius: 8 }}>
                          <table className="clop-table">
                            <thead>
                              <tr>
                                <th className="clop-col-left">หมวดค่ารักษา</th>
                                <th className="clop-col-center">จำนวนรายการ</th>
                                <th className="clop-col-right">รวมเงิน (บาท)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.orders.categories.map((cat, i) => (
                                <tr key={i}>
                                  <td className="clop-col-left">{cat.title}</td>
                                  <td className="clop-col-center clop-tabular">{cat.item_count}</td>
                                  <td className="clop-col-right">{formatMoney(cat.total_price)}</td>
                                </tr>
                              ))}
                              <tr style={{ fontWeight: 600, backgroundColor: 'var(--gray-50, #f8fafc)' }}>
                                <td className="clop-col-left">รวมค่ารักษาทั้งสิ้น</td>
                                <td className="clop-col-center clop-tabular">{vnDetails.orders.total_items}</td>
                                <td className="clop-col-right">{formatMoney(vnDetails.orders.total_price)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* รายการคำสั่งการรักษา / ยาและเวชภัณฑ์ทั้งหมด */}
                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '8px 0 6px 0', color: 'var(--gray-800, #1e293b)' }}>
                            รายการยา เวชภัณฑ์ และหัตถการทั้งหมด:
                          </h4>
                          <div className="clop-table-responsive" style={{ border: '1px solid var(--gray-200, #e2e8f0)', borderRadius: 8 }}>
                            <table className="clop-table">
                              <thead>
                                <tr>
                                  <th className="clop-col-left">รายการ</th>
                                  <th className="clop-col-center">จำนวน</th>
                                  <th className="clop-col-right">ราคา/หน่วย</th>
                                  <th className="clop-col-right">รวม (บาท)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vnDetails.orders.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="clop-col-left">
                                      <div>{item.item_name} {item.strength ? `(${item.strength})` : ''}</div>
                                      {item.drugusage_text && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500, #64748b)' }}>
                                          {item.drugusage_text}
                                        </div>
                                      )}
                                    </td>
                                    <td className="clop-col-center clop-tabular">{item.qty} {item.units || ''}</td>
                                    <td className="clop-col-right clop-tabular">{formatMoney(item.unitprice)}</td>
                                    <td className="clop-col-right clop-tabular">{formatMoney(item.sum_price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="clop-modal-footer">
              <button
                type="button"
                className="clop-btn"
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
