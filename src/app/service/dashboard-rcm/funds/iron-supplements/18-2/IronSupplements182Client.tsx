'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
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
  Calendar,
  Pill,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react'
import type {
  IronSupplementsItem,
  IronSupplementsSummary,
  IronSupplementsCardFilter,
  IronSupplementsSearchField,
  IronSupplementsSortField,
  IronSupplementsAdpMappingCheck,
  IronSupplementsReportResult,
} from '@/lib/clinical/rcmIronSupplementsService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { UC_ECLAIM_CODES } from '@/lib/clinical/pttypeConstants'
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

export interface IronSupplements182ClientProps {
  initialData?: IronSupplementsReportResult | null
}

export default function IronSupplements182Client({
  initialData = null,
}: IronSupplements182ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<IronSupplementsCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(
    initialData?.ucOnly ? [...UC_ECLAIM_CODES] : []
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [targetAgeOnly, setTargetAgeOnly] = useState<boolean>(initialData?.targetAgeOnly ?? false)
  const [searchField, setSearchField] = useState<IronSupplementsSearchField>(
    initialData?.searchField ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<IronSupplementsSortField>(
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
  const [items, setItems] = useState<IronSupplementsItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<IronSupplementsAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '14001',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<IronSupplementsSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      targetAgeCount: 0,
      targetAgeRate: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      withAdpCount: 0,
      withAdpRate: 0,
      withDrugCount: 0,
      withDrugRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<IronSupplementsItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race condition safety
  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef<boolean>(true)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
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
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          targetAgeOnly: String(targetAgeOnly),
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (selectedPttypes.length > 0) {
          queryParams.set('pttypes', selectedPttypes.join(','))
        } else if (ucOnly) {
          queryParams.set('ucOnly', 'true')
        }

        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/iron-supplements/service-18-2?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: IronSupplementsReportResult = json.data
          setItems(result.items)
          setTotalCount(result.totalCount)
          setTotalPages(result.totalPages)
          setSummary(result.summary)
          setAdpMapping(result.adpMapping)
        } else {
          throw new Error(json.error?.message || 'รูปแบบข้อมูลตอบกลับไม่ถูกต้อง')
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
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
      selectedPttypes,
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
      const res = await fetch(`/api/service/dashboard-rcm/funds/iron-supplements/vn-details?vn=${vn}`)
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

  const handleRowClick = (item: IronSupplementsItem) => {
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
  const handleCardFilter = (filter: IronSupplementsCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Handle Table Sorting
  const handleSort = (field: IronSupplementsSortField) => {
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
        targetAgeOnly: String(targetAgeOnly),
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (selectedPttypes.length > 0) {
        queryParams.set('pttypes', selectedPttypes.join(','))
      } else if (ucOnly) {
        queryParams.set('ucOnly', 'true')
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/iron-supplements/service-18-2?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: IronSupplementsItem[] = json.data.items

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
        'ClaimCode',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'PDX',
        'SDX',
        'ชื่อยาเสริมธาตุเหล็ก (DID)',
        'รายการ ADP (14001)',
        'สถานะชดเชย',
        'เลขที่ REP',
        'ยอดชดเชย (บาท)',
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
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${(r.clinic || '').replace(/"/g, '""')}"`,
        `"${r.pdx || ''}"`,
        `"${(r.sdx || '').replace(/"/g, '""')}"`,
        `"${(r.drugname || '').replace(/"/g, '""')}"`,
        `"${(r.listname || '').replace(/"/g, '""')}"`,
        `"${(r.status || '').replace(/"/g, '""')}"`,
        `"${r.rep || ''}"`,
        r.compensated,
        `"${r.fund || ''}"`,
        `"${r.subfund || ''}"`,
      ])

      await exportRcmExcel({
        filename: `iron-supplements-14001-${ds1}-to-${ds2}.xlsx`,
        title: 'การจ่ายยาเสริมธาตุเหล็ก (18.2 / ADP 14001)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: csvContent,
      })
    } catch (err: any) {
      alert(`การส่งออกไฟล์ล้มเหลว: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="iron-container">
      {/* ── 1. Header Section ── */}
      <div className="iron-header">
        <div>
          <nav className="iron-breadcrumb" aria-label="Breadcrumb">
            <Link href="/service/dashboard-rcm">กองทุน RCM</Link>
            <span className="iron-breadcrumb-sep">/</span>
            <span>บริการยาเม็ดเสริมธาตุเหล็ก อายุ 13-45 ปี ADP + Drug</span>
            <span className="iron-breadcrumb-sep">/</span>
            <span className="iron-breadcrumb-cur">18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)</span>
          </nav>
          <h1 className="iron-title">18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)</h1>
          <p className="iron-subtitle">
            บริการยาเม็ดเสริมธาตุเหล็ก อายุ 13-45 ปี ADP + Drug · รายชื่อผู้รับบริการและการชดเชยค่าบริการทางการแพทย์
          </p>
        </div>

        <div className="iron-header-actions">
          <button
            type="button"
            className="iron-btn"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'}</span>
          </button>

          <button
            type="button"
            className="iron-btn iron-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. ADP 14001 Mapping Warning Banner ── */}
      {!adpMapping.isMapped && (
        <div className="iron-warning-banner" role="alert">
          <AlertTriangle size={20} className="iron-warning-icon" />
          <div className="iron-warning-content">
            <strong>แจ้งเตือนการกำหนดรหัสส่งตรวจ (ADP Mapping):</strong>
            <span>
              ไม่พบรายการยาหรือบริการที่ผูกรหัส สปสช. ADP <strong>14001</strong> ในตาราง{' '}
              <code>s_drugitems</code> ของระบบ กรุณาประสานงานเจ้าหน้าที่เวชระเบียนหรือเภสัชกรรมเพื่อตรวจสอบการตั้งค่ารหัส
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Unified Single-Row Date Selector ── */}
      <div className="iron-date-toolbar">
        <div className="iron-mode-tabs" role="tablist" aria-label="ช่วงเวลาการรายงาน">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`iron-mode-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`iron-mode-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`iron-mode-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="iron-date-divider" />

        <div className="iron-date-controls">
          {dateMode === 'custom' && (
            <div className="iron-custom-range">
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
                placeholder="ตั้งแต่วันที่"
                aria-label="ตั้งแต่วันที่"
              />
              <span className="iron-custom-sep">ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
                placeholder="ถึงวันที่"
                aria-label="ถึงวันที่"
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="iron-custom-range">
              <select
                className="iron-select"
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
                className="iron-select"
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
            <div className="iron-custom-range">
              <select
                className="iron-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {yearOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    ปีงบประมาณ {fy}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Balanced 4x2 KPI Summary Grid (8 Cards) ── */}
      <div className="iron-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`iron-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="iron-kpi-icon">
              <Pill size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">
              {summary.uniquePatients.toLocaleString('th-TH')} คน · รายได้ ฿{formatMoney(summary.totalIncome)}
            </span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`iron-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับเงินชดเชยแล้ว"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">ชดเชยแล้ว</span>
            <div className="iron-kpi-icon">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.compensatedVisits.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">
              {summary.compensationRate.toFixed(1)}% · รวม ฿{formatMoney(summary.totalCompensated)}
            </span>
          </div>
        </div>

        {/* Card 3: รอชดเชย / ยังไม่ชดเชย */}
        <div
          className={`iron-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ได้รับเงินชดเชย"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">รอชดเชย / ยังไม่ชดเชย</span>
            <div className="iron-kpi-icon">
              <Clock size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.uncompensatedVisits.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">
              {(100 - summary.compensationRate).toFixed(1)}% ของยอดบริการทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 4: สิทธิบัตรทอง UC */}
        <div
          className={`iron-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UC_ONLY')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UC)"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">สิทธิบัตรทอง (UC)</span>
            <div className="iron-kpi-icon">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.ucCount.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">{summary.ucRate.toFixed(1)}% ของผู้รับบริการ</span>
          </div>
        </div>

        {/* Card 5: มี ClaimCode */}
        <div
          className={`iron-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">มี ClaimCode</span>
            <div className="iron-kpi-icon">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">{summary.authenRate.toFixed(1)}% พิสูจน์ตัวตนแล้ว</span>
          </div>
        </div>

        {/* Card 6: ไม่มี ClaimCode */}
        <div
          className={`iron-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('NO_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ไม่มี ClaimCode"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">ไม่มี ClaimCode</span>
            <div className="iron-kpi-icon">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.withoutAuthenCount.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">
              {(100 - summary.authenRate).toFixed(1)}% ต้องเร่งติดตาม
            </span>
          </div>
        </div>

        {/* Card 7: มีรหัส ADP 14001 */}
        <div
          className={`iron-kpi-card ${cardFilter === 'WITH_ADP' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_ADP')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มีรหัส ADP 14001"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">มีรหัส ADP 14001</span>
            <div className="iron-kpi-icon">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.withAdpCount.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">{summary.withAdpRate.toFixed(1)}% ส่งเคลม ADP</span>
          </div>
        </div>

        {/* Card 8: จ่ายยาธาตุเหล็ก (DID) */}
        <div
          className={`iron-kpi-card ${cardFilter === 'WITH_DRUG' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_DRUG')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มีการจ่ายยาเสริมธาตุเหล็กตาม DID"
        >
          <div className="iron-kpi-header">
            <span className="iron-kpi-title">จ่ายยาธาตุเหล็ก (DID)</span>
            <div className="iron-kpi-icon">
              <Pill size={16} />
            </div>
          </div>
          <div className="iron-kpi-body">
            <span className="iron-kpi-val">{summary.withDrugCount.toLocaleString('th-TH')}</span>
            <span className="iron-kpi-sub">{summary.withDrugRate.toFixed(1)}% จ่ายยาตรงมาตรฐาน</span>
          </div>
        </div>
      </div>

      {/* ── 5. Search & Filters Toolbar ── */}
      <div className="iron-filter-bar">
        <div className="iron-search-box">
          <Search size={16} className="iron-search-icon" />
          <input
            type="text"
            className="iron-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ClaimCode, Rep, ยา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="iron-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="iron-secondary-filters">
          <PttypeMultiSelect
            selectedCodes={selectedPttypes}
            onChange={(codes) => {
              setSelectedPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {selectedPttypes.length > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: '0.8rem',
              }}
            >
              <span>
                สิทธิ:{' '}
                {selectedPttypes.length === UC_ECLAIM_CODES.length &&
                UC_ECLAIM_CODES.every((c) => selectedPttypes.includes(c))
                  ? 'เฉพาะ UC (01-09)'
                  : `${selectedPttypes.length} สิทธิ`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPttypes([])
                  setCurrentPage(1)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0369a1',
                  padding: 0,
                  display: 'flex',
                }}
                title="ล้างตัวกรองสิทธิ"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <label className="iron-checkbox-label">
            <input
              type="checkbox"
              className="iron-checkbox"
              checked={targetAgeOnly}
              onChange={(e) => {
                setTargetAgeOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะอายุ 13-45 ปี</span>
          </label>

          {cardFilter !== 'ALL' && (
            <div className="iron-active-filter-badge">
              <span>
                ฟิลเตอร์การ์ด: <strong>{cardFilter}</strong>
              </span>
              <button
                type="button"
                className="iron-filter-reset-btn"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกฟิลเตอร์การ์ด"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <select
            className="iron-select"
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

      {/* ── 6. Table Card ── */}
      <div className="iron-table-card">
        <div className="iron-table-meta">
          <div>
            พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
            {loading && <span style={{ marginLeft: 8, color: '#64748b' }}>กำลังโหลดข้อมูล...</span>}
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            * คลิกที่แถวเพื่อดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย
          </div>
        </div>

        {error && (
          <div className="iron-empty-state" style={{ color: '#b91c1c' }}>
            <AlertTriangle size={32} className="iron-empty-icon" style={{ color: '#dc2626' }} />
            <div className="iron-empty-title">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
            <div className="iron-empty-desc">{error}</div>
            <button
              type="button"
              className="iron-btn"
              style={{ marginTop: 16 }}
              onClick={() => fetchData()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="iron-loading-card">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span>กำลังประมวลผลข้อมูลรายงานบริการยาเม็ดเสริมธาตุเหล็ก...</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="iron-empty-state">
            <Pill size={36} className="iron-empty-icon" />
            <div className="iron-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
            <div className="iron-empty-desc">
              ไม่พบรายการผู้รับบริการยาเม็ดเสริมธาตุเหล็กในช่วงเวลาหรือฟิลเตอร์ที่กำหนด กรุณาลองปรับช่วงวันที่หรือคำค้นหา
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="iron-table-scroll">
            <table className="iron-table">
              <thead>
                <tr>
                  <th className="col-center">ลำดับ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="iron-sort-btn"
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
                      className="iron-sort-btn"
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
                  <th className="col-center">เลขบัตรประชาชน</th>
                  <th className="col-left">
                    <button
                      type="button"
                      className="iron-sort-btn"
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
                      className="iron-sort-btn"
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
                      className="iron-sort-btn"
                      onClick={() => handleSort('authencode')}
                    >
                      ClaimCode{' '}
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
                      className="iron-sort-btn"
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
                  <th className="col-left">ยาเสริมธาตุเหล็ก (DID) / ADP</th>
                  <th className="col-center">สถานะชดเชย</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="iron-sort-btn"
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
                {items.map((item) => (
                  <tr
                    key={item.vn}
                    className="iron-row-clickable"
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย"
                  >
                    <td className="col-center iron-num">{item.no}</td>
                    <td className="col-center iron-num">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center iron-num">{item.vsttime || '—'}</td>
                    <td className="col-center iron-num font-mono">{item.hn}</td>
                    <td className="col-center iron-num font-mono">{item.cid}</td>
                    <td className="col-left">{item.ptname}</td>
                    <td className="col-center iron-num">{item.age} ปี</td>
                    <td className="col-center">
                      <span className={`iron-badge ${item.isUc ? 'iron-badge-ok' : 'iron-badge-neutral'}`}>
                        {item.pttypename || item.maininscl || '—'}
                      </span>
                    </td>
                    <td className="col-center font-mono">
                      {item.authencode ? (
                        <span className="iron-badge iron-badge-ok">{item.authencode}</span>
                      ) : (
                        <span className="iron-badge iron-badge-warn">ไม่มี</span>
                      )}
                    </td>
                    <td className="col-center font-mono font-bold">{item.pdx || '—'}</td>
                    <td className="col-left" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.drugname ? (
                        <span title={item.drugname}>{item.drugname}</span>
                      ) : item.listname ? (
                        <span title={item.listname} className="iron-badge iron-badge-info">
                          {item.listname}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td className="col-center">
                      <span
                        className={`iron-badge ${
                          item.isCompensated ? 'iron-badge-ok' : item.status ? 'iron-badge-info' : 'iron-badge-warn'
                        }`}
                      >
                        {item.status || 'รอชดเชย'}
                      </span>
                    </td>
                    <td className="col-center iron-num font-semibold">
                      {item.isCompensated ? (
                        <span style={{ color: '#15803d' }}>{formatMoney(item.compensated)}</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 7. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="iron-pagination">
            <div className="iron-pagination-info">
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ)
            </div>

            <div className="iron-pagination-controls">
              <button
                type="button"
                className="iron-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                หน้าแรก
              </button>
              <button
                type="button"
                className="iron-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ padding: '0 8px', fontSize: '0.875rem' }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="iron-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="iron-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="หน้าสุดท้าย"
              >
                หน้าสุดท้าย
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 8. Direct Row-Click Detail Modal ── */}
      {selectedItem && (
        <div className="iron-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="iron-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-patient-title"
          >
            <div className="iron-modal-header">
              <div>
                <h2 id="modal-patient-title" className="iron-modal-title">
                  {selectedItem.ptname}
                </h2>
                <div className="iron-modal-subtitle">
                  <span>HN: {selectedItem.hn}</span>
                  <span>·</span>
                  <span>VN: {selectedItem.vn}</span>
                  <span>·</span>
                  <span>อายุ {selectedItem.age} ปี</span>
                </div>
              </div>
              <button
                type="button"
                className="iron-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="iron-modal-tabs">
              <button
                type="button"
                className={`iron-modal-tab ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลบริการ & การชดเชย
              </button>
              <button
                type="button"
                className={`iron-modal-tab ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                เวชระเบียน & ประวัติคลินิก (HOSxP)
              </button>
            </div>

            <div className="iron-modal-body">
              {modalTab === 'summary' && (
                <>
                  {/* General Patient Info */}
                  <div className="iron-detail-section">
                    <div className="iron-section-title">ข้อมูลทั่วไปผู้ป่วย</div>
                    <div className="iron-detail-grid">
                      <div className="iron-detail-item">
                        <span className="iron-detail-label">เลขประจำตัวประชาชน (CID)</span>
                        <span className="iron-detail-val font-mono">
                          {selectedItem.cid}
                          <button
                            type="button"
                            className="iron-copy-btn"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คัดลอก CID"
                          >
                            {copiedField === 'cid' ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                          </button>
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">HN / เพศ / สัญชาติ</span>
                        <span className="iron-detail-val">
                          {selectedItem.hn} · {selectedItem.sex} · {selectedItem.nation || 'ไทย'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">วันเกิด</span>
                        <span className="iron-detail-val">
                          {selectedItem.birthday ? formatThaiDate(selectedItem.birthday) : '—'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">สิทธิการรักษา</span>
                        <span className="iron-detail-val">
                          {selectedItem.pttypename} ({selectedItem.maininscl || '—'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visit & Clinical Info */}
                  <div className="iron-detail-section">
                    <div className="iron-section-title">ข้อมูลการรับบริการ</div>
                    <div className="iron-detail-grid">
                      <div className="iron-detail-item">
                        <span className="iron-detail-label">วันที่และเวลามารับบริการ</span>
                        <span className="iron-detail-val">
                          {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime || '—'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">แผนก / คลินิก</span>
                        <span className="iron-detail-val">
                          {selectedItem.department || '—'} · {selectedItem.clinic || '—'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">ClaimCode:</span>
                        <span className="iron-detail-val font-mono">
                          {selectedItem.authencode || 'ไม่มี (ยังไม่ได้ขอ Claim Code)'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">การวินิจฉัยหลัก (PDX) / ร่วม (SDX)</span>
                        <span className="iron-detail-val font-mono font-bold">
                          {selectedItem.pdx || '—'}{' '}
                          {selectedItem.sdx && (
                            <span style={{ fontWeight: 400, color: '#64748b' }}>
                              ({selectedItem.sdx})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Drugs & ADP codes */}
                  <div className="iron-detail-section">
                    <div className="iron-section-title">ยาเสริมธาตุเหล็ก & รหัส ADP (14001)</div>
                    <div className="iron-detail-grid">
                      <div className="iron-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="iron-detail-label">ชื่อยาเสริมธาตุเหล็กตาม DID ที่จ่ายใน Visit นี้</span>
                        <span className="iron-detail-val" style={{ fontWeight: 600 }}>
                          {selectedItem.drugname || 'ไม่มีรายการยา DID ในกลุ่มยาเสริมธาตุเหล็ก'}
                        </span>
                      </div>

                      <div className="iron-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="iron-detail-label">รายการ ADP 14001 (บริการยาเม็ดเสริมธาตุเหล็ก)</span>
                        <span className="iron-detail-val">
                          {selectedItem.listname || 'ไม่มีรหัส ADP 14001 ผูกกับรายการที่จ่าย'}
                        </span>
                      </div>

                      {selectedItem.listname1 && (
                        <div className="iron-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="iron-detail-label">รายการค่าบริการและหัตถการอื่นๆ ใน Visit</span>
                          <span className="iron-detail-val" style={{ fontSize: '0.8125rem', color: '#475569' }}>
                            {selectedItem.listname1}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Compensation & REP */}
                  <div className="iron-detail-section">
                    <div className="iron-section-title">สถานะการชดเชยและการเงิน</div>
                    <div className="iron-detail-grid">
                      <div className="iron-detail-item">
                        <span className="iron-detail-label">สถานะการตอบรับ (Status)</span>
                        <span className="iron-detail-val">
                          <span
                            className={`iron-badge ${
                              selectedItem.isCompensated
                                ? 'iron-badge-ok'
                                : selectedItem.status
                                ? 'iron-badge-info'
                                : 'iron-badge-warn'
                            }`}
                          >
                            {selectedItem.status || 'รอชดเชย'}
                          </span>
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">เลขที่ REP</span>
                        <span className="iron-detail-val font-mono">
                          {selectedItem.rep || '—'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">ยอดเงินชดเชย (Compensated)</span>
                        <span className="iron-detail-val font-bold" style={{ color: '#15803d', fontSize: '1.125rem' }}>
                          ฿{formatMoney(selectedItem.compensated)}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">ยอดรวมค่าบริการโรงพยาบาล (Income)</span>
                        <span className="iron-detail-val">
                          ฿{formatMoney(selectedItem.income)}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">กองทุน / กองทุนย่อย</span>
                        <span className="iron-detail-val">
                          {selectedItem.fund || '—'} / {selectedItem.subfund || '—'}
                        </span>
                      </div>

                      <div className="iron-detail-item">
                        <span className="iron-detail-label">ประเภทธุรกรรม</span>
                        <span className="iron-detail-val">
                          {selectedItem.transactiontype || 'OP'} {selectedItem.agency ? `(${selectedItem.agency})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'clinical' && (
                <div className="iron-detail-section">
                  {loadingVnDetails ? (
                    <div className="iron-loading-card">
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>กำลังดึงข้อมูลเวชระเบียนจาก HOSxP สำหรับ VN: {selectedItem.vn}...</span>
                    </div>
                  ) : vnDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <span className="iron-detail-label">อาการสำคัญ (Chief Complaint)</span>
                        <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginTop: 4 }}>
                          {vnDetails.screen?.cc || '—'}
                        </div>
                      </div>

                      <div>
                        <span className="iron-detail-label">สัญญาณชีพ (Vital Signs)</span>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                          <span>
                            ความดันโลหิต:{' '}
                            <strong>
                              {vnDetails.screen?.bps && vnDetails.screen?.bpd
                                ? `${vnDetails.screen.bps}/${vnDetails.screen.bpd} mmHg`
                                : '—'}
                            </strong>
                          </span>
                          <span>
                            ชีพจร: <strong>{vnDetails.screen?.pulse ? `${vnDetails.screen.pulse} bpm` : '—'}</strong>
                          </span>
                          <span>
                            อุณหภูมิ:{' '}
                            <strong>
                              {vnDetails.screen?.temperature ? `${vnDetails.screen.temperature} °C` : '—'}
                            </strong>
                          </span>
                          <span>
                            น้ำหนัก: <strong>{vnDetails.screen?.bw ? `${vnDetails.screen.bw} kg` : '—'}</strong>
                          </span>
                          <span>
                            ส่วนสูง:{' '}
                            <strong>{vnDetails.screen?.height ? `${vnDetails.screen.height} cm` : '—'}</strong>
                          </span>
                        </div>
                      </div>

                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div>
                          <span className="iron-detail-label">รายการยาและการสั่งตรวจใน Visit</span>
                          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                            {vnDetails.orders.items.map((item, idx) => (
                              <li key={idx} style={{ marginBottom: 4 }}>
                                <strong>{item.item_name}</strong> {item.qty ? `(จำนวน ${item.qty})` : ''} -{' '}
                                {item.drugusage_text || item.income_name || ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="iron-empty-state">
                      <AlertTriangle size={24} className="iron-empty-icon" />
                      <div>ไม่พบข้อมูลเวชระเบียนเพิ่มเติมสำหรับ VN นี้ในระบบ HOSxP</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="iron-modal-footer">
              <button
                type="button"
                className="iron-btn"
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
