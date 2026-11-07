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
  Calendar,
  ShieldCheck,
  ReceiptText,
  UserCheck,
  TestTube2,
  Sparkles,
  Check,
  Copy,
  Clock,
  HeartPulse,
} from 'lucide-react'
import type {
  HepatitisCItem,
  HepatitisCSummary,
  HepatitisCCardFilter,
  HepatitisCSortField,
  HepatitisCAdpMappingCheck,
  HepatitisCReportResult,
} from '@/lib/clinical/rcmHepatitisCService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
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

export interface HepatitisC232ClientProps {
  initialData?: HepatitisCReportResult | null
}

export default function HepatitisC232Client({
  initialData = null,
}: HepatitisC232ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<HepatitisCCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [withLabOnly, setWithLabOnly] = useState<boolean>(initialData?.withLabOnly ?? false)
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<HepatitisCSortField>(
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
  const [items, setItems] = useState<HepatitisCItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<HepatitisCAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '36331',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<HepatitisCSummary>(
    initialData?.summary ?? {
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
      ucCount: 0,
      ucRate: 0,
      withLabCount: 0,
      withLabRate: 0,
      seamlessCount: 0,
      seamlessCompensatedCount: 0,
      totalSeamlessCompensated: 0,
      totalIncome: 0,
    }
  )

  // Detail Modal states
  const [selectedItem, setSelectedItem] = useState<HepatitisCItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Track mount state and abort controller
  const isFirstMount = useRef<boolean>(true)
  const abortRef = useRef<AbortController | null>(null)

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
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
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          ucOnly: String(ucOnly),
          withLabOnly: String(withLabOnly),
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (refresh) {
          queryParams.set('refresh', 'true')
        }

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/hepatitis-c/service-23-2?${queryParams.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }

        const data: HepatitisCReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        setAdpMapping(data.adpMapping)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError((err as Error)?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, ucOnly, withLabOnly, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Trigger fetch on filter change (skipping first mount if initialData is provided)
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

  // Fetch clinical VN details when modal opens and switches to clinical tab
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/hepatitis-c/vn-details?vn=${vn}`)
      const json = await res.json()
      if (json.success) {
        setVnDetails(json.data)
      } else {
        setVnDetails(null)
      }
    } catch {
      setVnDetails(null)
    } finally {
      setLoadingVnDetails(false)
    }
  }, [])

  const handleRowClick = (item: HepatitisCItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
  }

  const handleModalTabChange = (tab: 'summary' | 'clinical') => {
    setModalTab(tab)
    if (tab === 'clinical' && selectedItem && !vnDetails && !loadingVnDetails) {
      fetchVnDetails(selectedItem.vn)
    }
  }

  const handleCopyText = (text: string, fieldId: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 1500)
    }
  }

  // Handle Date Mode Changes
  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)

    if (mode === 'custom') {
      // keep current ds1, ds2
    } else if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mm}-01`)
      setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceFiscal = selectedFiscalYear - 543
      setDs1(`${ceFiscal - 1}-10-01`)
      setDs2(`${ceFiscal}-09-30`)
    }
  }

  const handleMonthYearChange = (m: number, beYear: number) => {
    setSelectedMonth(m)
    setSelectedBeYear(beYear)
    setCurrentPage(1)
    const ceYear = beYear - 543
    const mm = String(m).padStart(2, '0')
    const lastDay = new Date(ceYear, m, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleFiscalYearChange = (fy: number) => {
    setSelectedFiscalYear(fy)
    setCurrentPage(1)
    const ceFiscal = fy - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
  }

  // Handle Card Filter Selection
  const handleCardFilter = (filter: HepatitisCCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Handle Table Sorting
  const handleSort = (field: HepatitisCSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Handle CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        ucOnly: String(ucOnly),
        withLabOnly: String(withLabOnly),
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/hepatitis-c/service-23-2?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: HepatitisCItem[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'Authen Code',
        'สิทธิการรักษา',
        'อาการสำคัญ (CC)',
        'แผนก',
        'คลินิก',
        'PDX',
        'SDX',
        'ผลตรวจ Lab ไวรัสตับอักเสบ C',
        'รายการ ADP (36331)',
        'สถานะชดเชย',
        'เลขที่ REP',
        'ยอดชดเชย (บาท)',
        'สถานะ Seamless',
        'เลขที่ REP Seamless',
        'ยอดชดเชย Seamless (บาท)',
        'ที่อยู่',
        'เบอร์โทรศัพท์',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const csvContent = exportRows.map((r, i) => [
        i + 1,
        `"${r.vn}"`,
        `"${r.hn}"`,
        `"${r.cid}"`,
        `"${r.ptname.replace(/"/g, '""')}"`,
        `"${r.sex}"`,
        r.age,
        `"${r.nation || ''}"`,
        `"${r.vstdate}"`,
        `"${r.vsttime}"`,
        `"${r.authencode || ''}"`,
        `"${(r.pttypename || '').replace(/"/g, '""')}"`,
        `"${(r.cc || '').replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${(r.clinic || '').replace(/"/g, '""')}"`,
        `"${r.pdx || ''}"`,
        `"${(r.sdx || '').replace(/"/g, '""')}"`,
        `"${(r.labresult || '').replace(/"/g, '""')}"`,
        `"${(r.listname || '').replace(/"/g, '""')}"`,
        `"${(r.status || '').replace(/"/g, '""')}"`,
        `"${r.rep || ''}"`,
        r.compensated,
        `"${(r.status_sm || '').replace(/"/g, '""')}"`,
        `"${r.rep_sm || ''}"`,
        r.compensated_sm,
        `"${(r.address || '').replace(/"/g, '""')}"`,
        `"${r.tel || r.mobile || ''}"`,
        `"${r.fund || ''}"`,
        `"${r.subfund || ''}"`,
      ])

      const csvString =
        '\uFEFF' +
        [headers.join(','), ...csvContent.map((row) => row.join(','))].join('\r\n')

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `hepatitis-c-36331-${ds1}-to-${ds2}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      alert((err as Error)?.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์ CSV')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="hepc-container">
      {/* ── 1. Header & Breadcrumbs ── */}
      <div className="hepc-header">
        <div>
          <div className="hepc-breadcrumb">
            <Link href="/service/dashboard-rcm">RCM Dashboard</Link>
            <span className="hepc-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
            <span className="hepc-breadcrumb-sep">/</span>
            <span className="hepc-breadcrumb-cur">23.2 ไวรัสตับอักเสบ C</span>
          </div>
          <h1 className="hepc-title">23.2 บริการตรวจคัดกรองไวรัสตับอักเสบ C</h1>
          <p className="hepc-subtitle">
            บริการตรวจคัดกรองไวรัสตับอักเสบ C (Viral Hepatitis C Screening) รหัส ADP 36331 และติดตามการชดเชยค่าบริการ
          </p>
        </div>

        <div className="hepc-header-actions">
          <button
            type="button"
            className="hepc-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="hepc-btn hepc-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || items.length === 0}
            title="ดาวน์โหลดไฟล์ CSV สำหรับ Excel"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Warnings / ADP Mapping Status Banner ── */}
      {!adpMapping.isMapped && (
        <div className="hepc-warning-banner">
          <AlertTriangle size={20} className="hepc-warning-icon" />
          <div className="hepc-warning-content">
            <strong>แจ้งเตือน: คุณยังไม่ได้ Map ADP Code (36331)</strong>
            <span>
              ไม่พบการจับคู่รหัส ADP 36331 ในตาราง <code>s_drugitems</code>{' '}
              กรุณาตรวจสอบการตั้งค่ารายการค่าบริการที่ห้องยาหรือฝ่ายประกันสุขภาพก่อนใช้งาน
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Unified Single-Row Date Selector ── */}
      <div className="hepc-date-toolbar">
        <div className="hepc-mode-group">
          <button
            type="button"
            className={`hepc-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            className={`hepc-mode-btn ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            className={`hepc-mode-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="hepc-date-divider" />

        <div className="hepc-date-inputs">
          {dateMode === 'custom' && (
            <div className="hepc-date-range-wrap">
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
                maxDate={ds2}
              />
              <span className="hepc-date-sep">ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
                minDate={ds1}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="hepc-date-range-wrap">
              <select
                className="hepc-select"
                value={selectedMonth}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedBeYear)}
                aria-label="เลือกเดือน"
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="hepc-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
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
            <div className="hepc-date-range-wrap">
              <select
                className="hepc-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
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

        <div className="hepc-date-summary-text">
          <Calendar size={14} />
          <span>
            ช่วงวันที่: {formatThaiDate(ds1)} – {formatThaiDate(ds2)}
          </span>
        </div>
      </div>

      {/* ── 4. Balanced 4x2 KPI Summary Cards ── */}
      <div className="hepc-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="hepc-kpi-bar" />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">ผู้รับบริการทั้งหมด</span>
            <UserCheck size={18} className="hepc-kpi-icon" />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="hepc-kpi-unit">ครั้ง</span>
          </div>
          <div className="hepc-kpi-sub">
            <span>ผู้ป่วย {summary.uniquePatients.toLocaleString('th-TH')} ราย</span>
            <span>เรียกเก็บ ฿{summary.totalIncome.toLocaleString('th-TH')}</span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#16a34a' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">ชดเชยแล้ว</span>
            <ShieldCheck size={18} className="hepc-kpi-icon" style={{ color: '#16a34a' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#15803d' }}>
              {summary.compensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">ครั้ง ({summary.compensationRate.toFixed(1)}%)</span>
          </div>
          <div className="hepc-kpi-sub">
            <span>ยอดชดเชย ฿{summary.totalCompensated.toLocaleString('th-TH')}</span>
            <span>เฉลี่ย ฿{summary.averageCompensated.toFixed(0)}</span>
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย / รอชดเชย */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ชดเชย"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#ca8a04' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">ยังไม่ชดเชย / รอชดเชย</span>
            <Clock size={18} className="hepc-kpi-icon" style={{ color: '#ca8a04' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#a16207' }}>
              {summary.uncompensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">
              ครั้ง ({(100 - summary.compensationRate).toFixed(1)}%)
            </span>
          </div>
          <div className="hepc-kpi-sub">
            <span>รอประมวลผล / ติดขัดส่งเบิก</span>
          </div>
        </div>

        {/* Card 4: มี Authen Code */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี Authen Code"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#0284c7' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">มี Authen Code</span>
            <Sparkles size={18} className="hepc-kpi-icon" style={{ color: '#0284c7' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#0369a1' }}>
              {summary.withAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">ครั้ง ({summary.authenRate.toFixed(1)}%)</span>
          </div>
          <div className="hepc-kpi-sub">
            <span>ยืนยันตัวตน สปสช. เรียบร้อย</span>
          </div>
        </div>

        {/* Card 5: ไม่มี Authen Code */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilter('NO_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ไม่มี Authen Code"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#e11d48' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">ไม่มี Authen Code</span>
            <AlertTriangle size={18} className="hepc-kpi-icon" style={{ color: '#e11d48' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#be123c' }}>
              {summary.withoutAuthenCount.toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">
              ครั้ง ({(100 - summary.authenRate).toFixed(1)}%)
            </span>
          </div>
          <div className="hepc-kpi-sub">
            <span>เสี่ยงต่อการถูกปฏิเสธชดเชย</span>
          </div>
        </div>

        {/* Card 6: สิทธิบัตรทอง (UC) */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilter('UC_ONLY')}
          title="คลิกเพื่อกรองเฉพาะผู้มีสิทธิบัตรทอง (UC)"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#0d9488' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">สิทธิบัตรทอง (UC)</span>
            <ReceiptText size={18} className="hepc-kpi-icon" style={{ color: '#0d9488' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#0f766e' }}>
              {summary.ucCount.toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">ครั้ง ({summary.ucRate.toFixed(1)}%)</span>
          </div>
          <div className="hepc-kpi-sub">
            <span>กลุ่มเป้าหมายกองทุนหลัก</span>
          </div>
        </div>

        {/* Card 7: มีผลการตรวจ Lab */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'WITH_LAB' ? 'active' : ''}`}
          onClick={() => handleCardFilter('WITH_LAB')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มีผลตรวจ Lab ไวรัสตับอักเสบ C"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#6366f1' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">มีผลตรวจ Lab</span>
            <TestTube2 size={18} className="hepc-kpi-icon" style={{ color: '#6366f1' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#4f46e5' }}>
              {summary.withLabCount.toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">ครั้ง ({summary.withLabRate.toFixed(1)}%)</span>
          </div>
          <div className="hepc-kpi-sub">
            <span>บันทึกผล Anti-HCV ในระบบ</span>
          </div>
        </div>

        {/* Card 8: ชดเชย Seamless */}
        <div
          className={`hepc-kpi-card ${cardFilter === 'SEAMLESS_COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilter('SEAMLESS_COMPENSATED')}
          title="คลิกเพื่อกรองรายการที่มีการชดเชยผ่านระบบ Seamless"
        >
          <div className="hepc-kpi-bar" style={{ backgroundColor: '#8b5cf6' }} />
          <div className="hepc-kpi-header">
            <span className="hepc-kpi-title">ชดเชย Seamless</span>
            <HeartPulse size={18} className="hepc-kpi-icon" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="hepc-kpi-value-wrap">
            <span className="hepc-kpi-value" style={{ color: '#7c3aed' }}>
              {(summary.seamlessCompensatedCount ?? summary.seamlessCount ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="hepc-kpi-unit">ครั้ง</span>
          </div>
          <div className="hepc-kpi-sub">
            <span>ยอด ฿{summary.totalSeamlessCompensated.toLocaleString('th-TH')}</span>
          </div>
        </div>
      </div>

      {/* ── 5. Toolbar: Unified Global Search & Secondary Filters ── */}
      <div className="hepc-toolbar">
        <div className="hepc-search-box">
          <Search size={16} className="hepc-search-icon" />
          <input
            type="text"
            className="hepc-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, Authen Code, Rep, ผล Lab..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="hepc-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="hepc-secondary-filters">
          <label className="hepc-checkbox-label">
            <input
              type="checkbox"
              className="hepc-checkbox"
              checked={ucOnly}
              onChange={(e) => {
                setUcOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะสิทธิบัตรทอง (UC)</span>
          </label>

          <label className="hepc-checkbox-label">
            <input
              type="checkbox"
              className="hepc-checkbox"
              checked={withLabOnly}
              onChange={(e) => {
                setWithLabOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะที่มีผลตรวจ Lab</span>
          </label>

          {cardFilter !== 'ALL' && (
            <div className="hepc-active-filter-badge">
              <span>
                ฟิลเตอร์การ์ด: <strong>{cardFilter}</strong>
              </span>
              <button
                type="button"
                className="hepc-filter-reset-btn"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกฟิลเตอร์การ์ด"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <select
            className="hepc-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            aria-label="จำนวนรายการต่อหน้า"
          >
            <option value={20}>20 แถว/หน้า</option>
            <option value={50}>50 แถว/หน้า</option>
            <option value={100}>100 แถว/หน้า</option>
            <option value={200}>200 แถว/หน้า</option>
          </select>
        </div>
      </div>

      {/* ── 6. Table Card (Row-Clickable) ── */}
      <div className="hepc-table-card">
        <div className="hepc-table-meta">
          <div>
            พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
            {loading && <span style={{ marginLeft: 8, color: '#64748b' }}>กำลังโหลดข้อมูล...</span>}
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            * คลิกที่แถวเพื่อดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย
          </div>
        </div>

        {error && (
          <div className="hepc-empty-state" style={{ color: '#b91c1c' }}>
            <AlertTriangle size={32} className="hepc-empty-icon" style={{ color: '#dc2626' }} />
            <div className="hepc-empty-title">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
            <div className="hepc-empty-desc">{error}</div>
            <button
              type="button"
              className="hepc-btn"
              style={{ marginTop: 16 }}
              onClick={() => fetchData()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="hepc-loading-card">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span>กำลังประมวลผลข้อมูลรายงานบริการตรวจคัดกรองไวรัสตับอักเสบ C...</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="hepc-empty-state">
            <TestTube2 size={36} className="hepc-empty-icon" />
            <div className="hepc-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
            <div className="hepc-empty-desc">
              ไม่พบรายการผู้รับบริการตรวจคัดกรองไวรัสตับอักเสบ C ในช่วงเวลาหรือฟิลเตอร์ที่กำหนด กรุณาลองปรับช่วงวันที่หรือคำค้นหา
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="hepc-table-scroll">
            <table className="hepc-table">
              <thead>
                <tr>
                  <th className="col-center">ลำดับ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('vstdate')}
                    >
                      วันที่รับบริการ{' '}
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">เวลา</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('hn')}
                    >
                      HN{' '}
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('cid')}
                    >
                      เลขบัตรประชาชน{' '}
                      {sortBy === 'cid' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-left">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('ptname')}
                    >
                      ชื่อ-สกุล{' '}
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('age')}
                    >
                      อายุ{' '}
                      {sortBy === 'age' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">สิทธิการรักษา</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('authencode')}
                    >
                      Authen Code{' '}
                      {sortBy === 'authencode' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('pdx')}
                    >
                      PDX{' '}
                      {sortBy === 'pdx' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('labresult')}
                    >
                      ผล Lab ไวรัสตับอักเสบ C{' '}
                      {sortBy === 'labresult' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  </th>
                  <th className="col-center">สถานะชดเชย</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="hepc-sort-btn"
                      onClick={() => handleSort('compensated')}
                    >
                      ยอดชดเชย (บาท){' '}
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
                {items.map((item) => {
                  const isPositive =
                    item.labresult &&
                    (item.labresult.toLowerCase().includes('pos') ||
                      item.labresult.toLowerCase().includes('reactive'))
                  const isNegative =
                    item.labresult &&
                    (item.labresult.toLowerCase().includes('neg') ||
                      item.labresult.toLowerCase().includes('non'))

                  return (
                    <tr
                      key={item.vn}
                      className="hepc-row-clickable"
                      onClick={() => handleRowClick(item)}
                      title="คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย"
                    >
                      <td className="col-center hepc-num">{item.no}</td>
                      <td className="col-center hepc-num">{formatThaiDate(item.vstdate)}</td>
                      <td className="col-center hepc-num">{item.vsttime || '—'}</td>
                      <td className="col-center hepc-num font-mono">{item.hn}</td>
                      <td className="col-center hepc-num font-mono">{item.cid}</td>
                      <td className="col-left">{item.ptname}</td>
                      <td className="col-center hepc-num">{item.age} ปี</td>
                      <td className="col-center">
                        <span
                          className={`hepc-badge ${item.isUc ? 'hepc-badge-ok' : 'hepc-badge-neutral'}`}
                        >
                          {item.pttypename || item.maininscl || '—'}
                        </span>
                      </td>
                      <td className="col-center font-mono">
                        {item.authencode ? (
                          <span className="hepc-badge hepc-badge-ok">{item.authencode}</span>
                        ) : (
                          <span className="hepc-badge hepc-badge-warn">ไม่มี</span>
                        )}
                      </td>
                      <td className="col-center font-mono font-bold">{item.pdx || '—'}</td>
                      <td className="col-center">
                        {item.labresult ? (
                          <span
                            className={`hepc-badge ${
                              isPositive
                                ? 'hepc-badge-lab-pos'
                                : isNegative
                                ? 'hepc-badge-lab-neg'
                                : 'hepc-badge-info'
                            }`}
                            title={item.labresult}
                          >
                            {item.labresult}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-center">
                        <span
                          className={`hepc-badge ${
                            item.isCompensated
                              ? 'hepc-badge-ok'
                              : item.status
                              ? 'hepc-badge-info'
                              : 'hepc-badge-warn'
                          }`}
                        >
                          {item.status || 'รอชดเชย'}
                        </span>
                      </td>
                      <td className="col-center hepc-num font-semibold">
                        {item.isCompensated ? (
                          <span style={{ color: '#15803d' }}>{formatMoney(item.compensated)}</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 7. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="hepc-pagination">
            <div className="hepc-pagination-info">
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ)
            </div>

            <div className="hepc-pagination-controls">
              <button
                type="button"
                className="hepc-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1
                if (totalPages > 5) {
                  if (currentPage > 3) {
                    p = currentPage - 3 + i
                  }
                  if (p > totalPages) {
                    p = totalPages - (4 - i)
                  }
                }
                return (
                  <button
                    key={p}
                    type="button"
                    className={`hepc-page-btn ${currentPage === p ? 'active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                )
              })}

              <button
                type="button"
                className="hepc-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 8. Detail Modal ── */}
      {selectedItem && (
        <div className="hepc-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="hepc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="hepc-modal-header">
              <div>
                <h2 className="hepc-modal-title">
                  {selectedItem.ptname} (HN: {selectedItem.hn})
                </h2>
                <p className="hepc-modal-subtitle">
                  วันที่รับบริการ: {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime || '—'} | VN: {selectedItem.vn}
                </p>
              </div>
              <button
                type="button"
                className="hepc-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={20} />
              </button>
            </div>

            <div className="hepc-modal-tabs">
              <button
                type="button"
                className={`hepc-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลการตรวจ & การชดเชย
              </button>
              <button
                type="button"
                className={`hepc-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                เวชระเบียนคลินิก (HOSxP)
              </button>
            </div>

            <div className="hepc-modal-body">
              {modalTab === 'summary' && (
                <>
                  {/* ข้อมูลผู้ป่วย */}
                  <div className="hepc-modal-section">
                    <div className="hepc-modal-section-title">
                      <UserCheck size={16} /> ข้อมูลทั่วไปผู้ป่วย
                    </div>
                    <div className="hepc-modal-grid">
                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">เลขบัตรประชาชน (CID)</span>
                        <span className="hepc-modal-field-value font-mono">
                          {selectedItem.cid}
                          <button
                            type="button"
                            className="hepc-copy-inline-btn"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คัดลอก CID"
                          >
                            {copiedField === 'cid' ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                          </button>
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">HN</span>
                        <span className="hepc-modal-field-value font-mono">
                          {selectedItem.hn}
                          <button
                            type="button"
                            className="hepc-copy-inline-btn"
                            onClick={() => handleCopyText(selectedItem.hn, 'hn')}
                            title="คัดลอก HN"
                          >
                            {copiedField === 'hn' ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                          </button>
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">เพศ / อายุ</span>
                        <span className="hepc-modal-field-value">
                          {selectedItem.sex} / {selectedItem.age} ปี
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">สิทธิการรักษา</span>
                        <span className="hepc-modal-field-value">
                          {selectedItem.pttypename || selectedItem.maininscl || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">Authen Code</span>
                        <span className="hepc-modal-field-value font-mono">
                          {selectedItem.authencode || 'ไม่มี Authen Code'}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">เบอร์โทรศัพท์</span>
                        <span className="hepc-modal-field-value">
                          {selectedItem.tel || selectedItem.mobile || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field" style={{ gridColumn: 'span 2' }}>
                        <span className="hepc-modal-field-label">ที่อยู่ผู้ป่วย</span>
                        <span className="hepc-modal-field-value">{selectedItem.address || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* ข้อมูลการตรวจ & อาการสำคัญ */}
                  <div className="hepc-modal-section">
                    <div className="hepc-modal-section-title">
                      <TestTube2 size={16} /> ข้อมูลการตรวจ & ผล Lab ไวรัสตับอักเสบ C
                    </div>
                    <div className="hepc-modal-grid">
                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">อาการสำคัญ (CC)</span>
                        <span className="hepc-modal-field-value">{selectedItem.cc || '—'}</span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">แผนก / คลินิก</span>
                        <span className="hepc-modal-field-value">
                          {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">ผลการตรวจ Lab ไวรัสตับอักเสบ C</span>
                        <span className="hepc-modal-field-value font-semibold">
                          {selectedItem.labresult ? (
                            <span className="hepc-badge hepc-badge-info">{selectedItem.labresult}</span>
                          ) : (
                            'ยังไม่มีบันทึกผล Lab'
                          )}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">รายการ ADP 36331</span>
                        <span className="hepc-modal-field-value">{selectedItem.listname || '—'}</span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">การวินิจฉัยหลัก (PDX)</span>
                        <span className="hepc-modal-field-value font-mono font-bold">
                          {selectedItem.pdx || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">การวินิจฉัยร่วม (SDX)</span>
                        <span className="hepc-modal-field-value font-mono">
                          {selectedItem.sdx || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field" style={{ gridColumn: 'span 2' }}>
                        <span className="hepc-modal-field-label">รายการตรวจประกอบ (Non-drug Items)</span>
                        <span className="hepc-modal-field-value" style={{ fontSize: '0.8125rem', color: '#475569' }}>
                          {selectedItem.listname1 || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ข้อมูลการชดเชย & e-Claim / Seamless */}
                  <div className="hepc-modal-section">
                    <div className="hepc-modal-section-title">
                      <ReceiptText size={16} /> สถานะการชดเชยค่าบริการ & Seamless
                    </div>
                    <div className="hepc-modal-grid">
                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">สถานะชดเชย (e-Claim / REP)</span>
                        <span className="hepc-modal-field-value">
                          <span
                            className={`hepc-badge ${
                              selectedItem.isCompensated ? 'hepc-badge-ok' : 'hepc-badge-warn'
                            }`}
                          >
                            {selectedItem.status || 'รอชดเชย'}
                          </span>
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">เลขที่ REP (หนังสือตอบรับ)</span>
                        <span className="hepc-modal-field-value font-mono">
                          {selectedItem.rep || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">ยอดเงินชดเชย</span>
                        <span className="hepc-modal-field-value font-bold" style={{ color: '#15803d' }}>
                          ฿{formatMoney(selectedItem.compensated)}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">ค่าบริการเรียกเก็บ (Income)</span>
                        <span className="hepc-modal-field-value">
                          ฿{formatMoney(selectedItem.income)}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">สถานะ Seamless</span>
                        <span className="hepc-modal-field-value">
                          {selectedItem.status_sm || '—'}
                        </span>
                      </div>

                      <div className="hepc-modal-field">
                        <span className="hepc-modal-field-label">ยอดชดเชย Seamless</span>
                        <span className="hepc-modal-field-value font-bold" style={{ color: '#7c3aed' }}>
                          ฿{formatMoney(selectedItem.compensated_sm)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'clinical' && (
                <div className="hepc-modal-section">
                  {loadingVnDetails ? (
                    <div className="hepc-loading-card">
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>กำลังโหลดข้อมูลเวชระเบียนคลินิกจาก HOSxP...</span>
                    </div>
                  ) : vnDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Vitals */}
                      <div className="hepc-modal-section">
                        <div className="hepc-modal-section-title">
                          <HeartPulse size={16} /> สัญญาณชีพ (Vital Signs)
                        </div>
                        <div className="hepc-modal-grid">
                          <div className="hepc-modal-field">
                            <span className="hepc-modal-field-label">ความดันโลหิต (BP)</span>
                            <span className="hepc-modal-field-value">
                              {vnDetails.screen?.bps && vnDetails.screen?.bpd
                                ? `${vnDetails.screen.bps}/${vnDetails.screen.bpd} mmHg`
                                : '—'}
                            </span>
                          </div>
                          <div className="hepc-modal-field">
                            <span className="hepc-modal-field-label">ชีพจร (Pulse) / อุณหภูมิ (Temp)</span>
                            <span className="hepc-modal-field-value">
                              {vnDetails.screen?.pulse ? `${vnDetails.screen.pulse} bpm` : '—'} /{' '}
                              {vnDetails.screen?.temperature ? `${vnDetails.screen.temperature} °C` : '—'}
                            </span>
                          </div>
                          <div className="hepc-modal-field">
                            <span className="hepc-modal-field-label">น้ำหนัก / ส่วนสูง / BMI</span>
                            <span className="hepc-modal-field-value">
                              {vnDetails.screen?.bw ? `${vnDetails.screen.bw} kg` : '—'} /{' '}
                              {vnDetails.screen?.height ? `${vnDetails.screen.height} cm` : '—'} /{' '}
                              {vnDetails.screen?.bmi ? `${vnDetails.screen.bmi}` : '—'}
                            </span>
                          </div>
                          <div className="hepc-modal-field">
                            <span className="hepc-modal-field-label">ผู้ตรวจ / แพทย์</span>
                            <span className="hepc-modal-field-value">
                              {vnDetails.diagnoses?.[0]?.doctor_name || '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* การวินิจฉัยโรค (Diagnoses) */}
                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div className="hepc-modal-section">
                          <div className="hepc-modal-section-title">การวินิจฉัยโรค (ICD-10)</div>
                          <table className="hepc-table" style={{ fontSize: '0.8125rem' }}>
                            <thead>
                              <tr>
                                <th>รหัสโรค</th>
                                <th>ชื่อการวินิจฉัย</th>
                                <th className="col-center">ประเภท</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.diagnoses.map((dx, i) => (
                                <tr key={i}>
                                  <td className="font-mono font-bold">{dx.icd10}</td>
                                  <td>{dx.icd_name}</td>
                                  <td className="col-center">
                                    <span className="hepc-badge hepc-badge-info">{dx.diagtype_name}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* รายการยาและเวชภัณฑ์ */}
                      {vnDetails.orders?.categories && vnDetails.orders.categories.length > 0 && (
                        <div className="hepc-modal-section">
                          <div className="hepc-modal-section-title">
                            <TestTube2 size={16} /> รายการตรวจทางห้องปฏิบัติการและค่าบริการ
                          </div>
                          {vnDetails.orders.categories.map((cat, i) => (
                            <div key={i} style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }}>
                                {cat.title} ({cat.item_count} รายการ - ฿{cat.total_price.toLocaleString('th-TH')})
                              </div>
                              <table className="hepc-table" style={{ fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr>
                                    <th>รายการ</th>
                                    <th className="col-center">จำนวน</th>
                                    <th className="col-right">ราคา (บาท)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cat.items.map((item, j) => (
                                    <tr key={j}>
                                      <td>
                                        {item.item_name} {item.strength ? `(${item.strength})` : ''}
                                        {item.drugusage_text ? ` - ${item.drugusage_text}` : ''}
                                      </td>
                                      <td className="col-center hepc-num">
                                        {item.qty} {item.units || ''}
                                      </td>
                                      <td className="col-right hepc-num">
                                        {item.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="hepc-empty-state">
                      <div className="hepc-empty-title">ไม่พบรายละเอียดเวชระเบียนคลินิกเพิ่มเติม</div>
                      <div className="hepc-empty-desc">
                        ไม่พบข้อมูลสัญญาณชีพหรือผลตรวจเพิ่มเติมสำหรับเลขที่ VN นี้
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="hepc-modal-footer">
              <button
                type="button"
                className="hepc-btn"
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
