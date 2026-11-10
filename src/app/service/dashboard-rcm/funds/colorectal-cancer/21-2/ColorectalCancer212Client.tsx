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
  TestTube2,
  ReceiptText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  UserCheck,
} from 'lucide-react'
import type {
  ColorectalCancerItem,
  ColorectalCancerSummary,
  ColorectalCancerCardFilter,
  ColorectalCancerSortField,
  ColorectalCancerAdpMappingCheck,
  ColorectalCancerReportResult,
} from '@/lib/clinical/rcmColorectalCancerService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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

// Helper to render patient name with surname cohesion (keeps surname intact on wrap)
function renderPatientName(ptname: string) {
  if (!ptname) return '—'
  const trimmed = ptname.trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) {
    return <span className="crc-name-part">{trimmed}</span>
  }
  const firstName = trimmed.substring(0, spaceIdx)
  const lastName = trimmed.substring(spaceIdx + 1).trim()
  return (
    <span className="crc-name-wrap">
      <span className="crc-name-part">{firstName}</span>{' '}
      <span className="crc-name-part">{lastName}</span>
    </span>
  )
}

export interface ColorectalCancer212ClientProps {
  initialData?: ColorectalCancerReportResult | null
}

export default function ColorectalCancer212Client({
  initialData = null,
}: ColorectalCancer212ClientProps) {
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

  // Date selection states: Standard Order: กำหนดเอง -> เดือน -> ปีงบประมาณ (No numbering prefixes)
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
  const [cardFilter, setCardFilter] = useState<ColorectalCancerCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(() => {
    if (initialData?.pttypes) {
      return initialData.pttypes.split(',').map((s) => s.trim()).filter(Boolean)
    }
    if (initialData?.ucOnly) {
      return [...UC_ECLAIM_CODES]
    }
    return []
  })
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<ColorectalCancerSortField>(
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
  const [items, setItems] = useState<ColorectalCancerItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<ColorectalCancerAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '90005',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<ColorectalCancerSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      completeCount: 0,
      completeRate: 0,
      missingAdpCount: 0,
      missingAdpRate: 0,
      missingPpCount: 0,
      missingPpRate: 0,
      invalidPpCodeCount: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<ColorectalCancerItem | null>(null)
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

      if (refresh) setIsRefreshing(true)
      else setLoading(true)
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

        if (selectedPttypes.length > 0) {
          query.set('pttypes', selectedPttypes.join(','))
        } else if (ucOnly) {
          query.set('ucOnly', 'true')
        }

        if (refresh) query.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2?${query.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const json = await res.json()
        if (json.success && json.data) {
          const d: ColorectalCancerReportResult = json.data
          setItems(d.items || [])
          setTotalCount(d.totalCount || 0)
          setTotalPages(d.totalPages || 1)
          setSummary(d.summary)
          setAdpMapping(d.adpMapping)
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'ไม่สามารถดึงข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, selectedPttypes, ucOnly, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Fetch VN Clinical Details for modal
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/colorectal-cancer/vn-details?vn=${encodeURIComponent(vn)}`
      )
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setVnDetails(json.data)
        }
      }
    } catch {
      // Ignore error for clinical details fallback
    } finally {
      setLoadingVnDetails(false)
    }
  }, [])

  // First mount skipping if initialData present
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

  // Close modal on Escape key for keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItem) {
        setSelectedItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem])

  // Handle Date Mode Switch
  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)

    if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mStr = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mStr}-01`)
      setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceFiscal = selectedFiscalYear - 543
      setDs1(`${ceFiscal - 1}-10-01`)
      setDs2(`${ceFiscal}-09-30`)
    }
  }

  const handleMonthChange = (m: number) => {
    setSelectedMonth(m)
    const ceYear = selectedBeYear - 543
    const mStr = String(m).padStart(2, '0')
    const lastDay = new Date(ceYear, m, 0).getDate()
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleBeYearChange = (beYear: number) => {
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const mStr = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleFiscalYearChange = (beYear: number) => {
    setSelectedFiscalYear(beYear)
    const ceFiscal = beYear - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
    setCurrentPage(1)
  }

  // Handle Card Filter Clicking: clicking active card toggles back to ALL
  const handleCardFilterClick = (filter: ColorectalCancerCardFilter) => {
    if (cardFilter === filter) {
      setCardFilter('ALL')
    } else {
      setCardFilter(filter)
    }
    setCurrentPage(1)
  }

  // Handle Sort
  const handleSort = (field: ColorectalCancerSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const handleRowClick = (item: ColorectalCancerItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
  }

  const handleTabChange = (tab: 'summary' | 'clinical') => {
    setModalTab(tab)
    if (tab === 'clinical' && selectedItem && !vnDetails) {
      fetchVnDetails(selectedItem.vn)
    }
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // CSV Export with UTF-8 BOM
  const handleExportCsv = async () => {
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

      if (selectedPttypes.length > 0) {
        query.set('pttypes', selectedPttypes.join(','))
      } else if (ucOnly) {
        query.set('ucOnly', 'true')
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2?${query.toString()}`
      )
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')

      const json = await res.json()
      const exportItems: ColorectalCancerItem[] = json.data?.items || []

      const headers = [
        'ลำดับ',
        'วันที่รับบริการ',
        'เวลา',
        'HN',
        'CID',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สิทธิการรักษา',
        'PDX',
        'SDX',
        'ClaimCode',
        'ผล Lab (FIT)',
        'รหัส Special PP',
        'รายการ Special PP',
        'รายการค่าบริการ ADP (90005)',
        'ความสมบูรณ์ของข้อมูล',
        'สถานะ Seamless',
        'Rep Seamless',
        'ชดเชย Seamless',
        'สถานะการชดเชย',
        'เลขที่ Rep',
        'ยอดชดเชย (บาท)',
        'กองทุน',
      ]

      const rows = exportItems.map((it) => [
        it.no,
        it.vstdate,
        it.vsttime,
        it.hn,
        it.cid,
        `"${it.ptname.replace(/"/g, '""')}"`,
        it.sex,
        it.age,
        `"${it.pttypename.replace(/"/g, '""')}"`,
        it.pdx || '—',
        it.sdx || '—',
        it.authencode || '—',
        it.labresult || '—',
        it.pp_special_code || '—',
        `"${(it.code || '—').replace(/"/g, '""')}"`,
        `"${(it.listname || '—').replace(/"/g, '""')}"`,
        it.dataQualityStatus === 'COMPLETE'
          ? 'ข้อมูลครบถ้วน'
          : it.dataQualityStatus === 'MISSING_ADP'
            ? 'ขาด ADP 90005'
            : it.dataQualityStatus === 'MISSING_PP'
              ? 'ขาด Special PP'
              : 'รหัส PP ไม่ตรง 1B0060/61',
        it.status_seamless || '—',
        it.rep_seamless || '—',
        it.compensated_seamless,
        it.status || '—',
        it.rep || '—',
        it.compensated,
        it.fund || '—',
      ])

      await exportRcmExcel({
        filename: `rcm_colorectal_cancer_fit_test_21_2_${ds1}_${ds2}.xlsx`,
        title: 'บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่ Fit test (21.2 / ADP 90005)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="crc-container">
      {/* ── 1. Header & Breadcrumbs ── */}
      <header className="crc-header">
        <div>
          <nav className="crc-breadcrumb" aria-label="Breadcrumb">
            <Link href="/service/dashboard-rcm">แดชบอร์ด RCM</Link>
            <span className="crc-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
            <span className="crc-breadcrumb-sep">/</span>
            <span className="crc-breadcrumb-cur">
              บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test)
            </span>
          </nav>
          <h1 className="crc-title">21.2 รายชื่อผู้รับบริการ ADP (90005)</h1>
          <p className="crc-subtitle">
            บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี • รหัส ADP 90005
          </p>
        </div>

        <div className="crc-header-actions">
          <button
            type="button"
            className="crc-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            className="crc-btn crc-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} className={isExporting ? 'animate-spin' : ''} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. Warnings: ADP 90005 Pre-check ── */}
      {!adpMapping.isMapped && (
        <div className="crc-warning-banner" role="alert">
          <AlertTriangle size={20} className="crc-warning-icon" />
          <div className="crc-warning-content">
            <strong>แจ้งเตือนการตั้งค่ารหัส ADP:</strong>
            <span>
              ไม่พบการจับคู่รหัส ADP <strong>90005</strong> ในตาราง <code>s_drugitems</code>{' '}
              ของฐานข้อมูลโรงพยาบาล ทำให้รายการค่าบริการตรวจ Fit test อาจไม่ถูกบันทึกหรือคิดค่าชดเชย
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="crc-error-banner" role="alert">
          <AlertCircle size={20} className="crc-error-icon" />
          <div className="crc-warning-content">
            <strong>เกิดข้อผิดพลาด:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── 3. Date Selector Toolbar (Single-Row, No 1. 2. 3. clutter) ── */}
      <section className="crc-date-toolbar" aria-label="เลือกช่วงเวลาการรายงาน">
        <div className="crc-mode-segmented">
          <button
            type="button"
            className={`crc-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            className={`crc-mode-btn ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            className={`crc-mode-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="crc-date-divider" />

        <div className="crc-date-inputs">
          {dateMode === 'custom' && (
            <div className="crc-date-range-group">
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
              />
              <span className="crc-date-range-sep">ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(val) => {
                  setDs2(val)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="crc-date-range-group">
              <select
                className="crc-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                aria-label="เลือกเดือน"
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                className="crc-select"
                value={selectedBeYear}
                onChange={(e) => handleBeYearChange(Number(e.target.value))}
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
            <div className="crc-date-range-group">
              <select
                className="crc-select"
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
      </section>

      {/* ── 4. Balanced 4x2 KPI Summary Grid (Clickable Cards for Filtering) ── */}
      <section className="crc-kpi-grid" aria-label="สรุปข้อมูลสถิติและการชดเชย">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`crc-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: แสดงผู้รับบริการทั้งหมด"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title">ผู้รับบริการทั้งหมด</span>
            <span className="crc-kpi-icon">
              <TestTube2 size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value">{summary.totalVisits.toLocaleString()}</span>
            <span className="crc-kpi-unit">ครั้ง</span>
          </div>
          <span className="crc-kpi-sub">
            {summary.uniquePatients.toLocaleString()} รายบุคคล
          </span>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`crc-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: เฉพาะเคสที่ได้รับการชดเชยแล้ว"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title">ชดเชยแล้ว</span>
            <span className="crc-kpi-icon" style={{ color: '#059669', backgroundColor: '#ecfdf5' }}>
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value">{summary.compensatedVisits.toLocaleString()}</span>
            <span className="crc-kpi-unit">
              ครั้ง ({summary.compensationRate.toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub" style={{ color: '#059669', fontWeight: 600 }}>
            {formatMoney(summary.totalCompensated)} บาท
          </span>
        </div>

        {/* Card 3: ยังไม่ชดเชย */}
        <div
          className={`crc-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: เคสที่รอการชดเชยหรือยังไม่ได้ชดเชย"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title">ยังไม่ชดเชย</span>
            <span className="crc-kpi-icon" style={{ color: '#d97706', backgroundColor: '#fef3c7' }}>
              <ReceiptText size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value">{summary.uncompensatedVisits.toLocaleString()}</span>
            <span className="crc-kpi-unit">
              ครั้ง ({(100 - summary.compensationRate).toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub">
            ค่าบริการรวม {formatMoney(summary.totalIncome)} บาท
          </span>
        </div>

        {/* Card 4: ข้อมูลครบถ้วน (ADP 90005 + PP 1B0060/61) */}
        <div
          className={`crc-kpi-card ${cardFilter === 'COMPLETE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPLETE')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: ข้อมูลครบถ้วน มีทั้ง ADP 90005 และ Special PP 1B0060/61"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title">ข้อมูลครบถ้วน</span>
            <span className="crc-kpi-icon" style={{ color: '#0D7446', backgroundColor: '#ecfdf5' }}>
              <ShieldCheck size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value">{summary.completeCount.toLocaleString()}</span>
            <span className="crc-kpi-unit">
              ครั้ง ({summary.completeRate.toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub">
            มีทั้ง ADP 90005 + PP 1B0060/61
          </span>
        </div>

        {/* Card 5: ขาด ADP 90005 (FoxPro lightred) */}
        <div
          className={`crc-kpi-card ${cardFilter === 'MISSING_ADP' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('MISSING_ADP')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: ขาดรายการยา/ค่าบริการ ADP 90005"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title" style={{ color: '#b91c1c' }}>ขาด ADP 90005</span>
            <span className="crc-kpi-icon" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}>
              <AlertTriangle size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value" style={{ color: '#b91c1c' }}>
              {summary.missingAdpCount.toLocaleString()}
            </span>
            <span className="crc-kpi-unit">
              ครั้ง ({summary.missingAdpRate.toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub" style={{ color: '#b91c1c' }}>
            มี PP แต่ไม่ได้คิดค่าบริการ ADP
          </span>
        </div>

        {/* Card 6: ขาด Special PP (FoxPro orange) */}
        <div
          className={`crc-kpi-card ${cardFilter === 'MISSING_PP' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('MISSING_PP')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: ขาดรหัส Special PP"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title" style={{ color: '#c2410c' }}>ขาด Special PP</span>
            <span className="crc-kpi-icon" style={{ color: '#ea580c', backgroundColor: '#fff7ed' }}>
              <AlertCircle size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value" style={{ color: '#c2410c' }}>
              {summary.missingPpCount.toLocaleString()}
            </span>
            <span className="crc-kpi-unit">
              ครั้ง ({summary.missingPpRate.toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub" style={{ color: '#c2410c' }}>
            มี ADP แต่ไม่ได้ลงรหัส Special PP
          </span>
        </div>

        {/* Card 7: มี ClaimCode */}
        <div
          className={`crc-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: เคสที่มี ClaimCode"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title">มี ClaimCode</span>
            <span className="crc-kpi-icon" style={{ color: '#0284c7', backgroundColor: '#f0f9ff' }}>
              <UserCheck size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value">{summary.withAuthenCount.toLocaleString()}</span>
            <span className="crc-kpi-unit">
              ครั้ง ({summary.authenRate.toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub">
            ยืนยันตัวตนสำเร็จ
          </span>
        </div>

        {/* Card 8: ไม่มี ClaimCode */}
        <div
          className={`crc-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรอง: เคสที่ไม่มี ClaimCode"
        >
          <div className="crc-kpi-header">
            <span className="crc-kpi-title">ไม่มี ClaimCode</span>
            <span className="crc-kpi-icon" style={{ color: '#e11d48', backgroundColor: '#fff1f2' }}>
              <X size={18} />
            </span>
          </div>
          <div className="crc-kpi-value-row">
            <span className="crc-kpi-value">{summary.withoutAuthenCount.toLocaleString()}</span>
            <span className="crc-kpi-unit">
              ครั้ง ({(100 - summary.authenRate).toFixed(1)}%)
            </span>
          </div>
          <span className="crc-kpi-sub">
            เสี่ยงต่อการติด C / ติดขัดชดเชย
          </span>
        </div>
      </section>

      {/* ── 5. Search & Filters Toolbar ── */}
      <section className="crc-toolbar" aria-label="แถบเครื่องมือค้นหาและตัวกรอง">
        <div className="crc-search-box">
          <Search size={18} className="crc-search-icon" />
          <input
            type="text"
            className="crc-search-input"
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, VN, ผล Lab, รหัสโรค, สิทธิ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="crc-search-clear"
              onClick={() => setSearch('')}
              aria-label="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="crc-filter-pills" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <PttypeMultiSelect
            selectedCodes={selectedPttypes}
            onChange={(codes) => {
              setSelectedPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {selectedPttypes.length > 0 && (
            <div className="crc-active-filter-badge">
              <span>
                สิทธิ:{' '}
                {selectedPttypes.length === UC_ECLAIM_CODES.length &&
                UC_ECLAIM_CODES.every((c) => selectedPttypes.includes(c))
                  ? 'เฉพาะบัตรทอง (UC)'
                  : `${selectedPttypes.length} สิทธิ (${selectedPttypes.join(', ')})`}
              </span>
              <button
                type="button"
                className="crc-active-filter-clear"
                onClick={() => {
                  setSelectedPttypes([])
                  setCurrentPage(1)
                }}
                title="ยกเลิกตัวกรองสิทธิ์"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {cardFilter !== 'ALL' && (
            <div className="crc-active-filter-badge">
              <span>
                ตัวกรองการ์ด:{' '}
                {cardFilter === 'COMPENSATED'
                  ? 'ชดเชยแล้ว'
                  : cardFilter === 'UNCOMPENSATED'
                    ? 'ยังไม่ชดเชย'
                    : cardFilter === 'COMPLETE'
                      ? 'ข้อมูลครบถ้วน'
                      : cardFilter === 'MISSING_ADP'
                        ? 'ขาด ADP 90005'
                        : cardFilter === 'MISSING_PP'
                          ? 'ขาด Special PP'
                          : cardFilter === 'WITH_AUTHEN'
                            ? 'มี ClaimCode'
                            : cardFilter === 'NO_AUTHEN'
                              ? 'ไม่มี ClaimCode'
                              : 'สิทธิบัตรทอง'}
              </span>
              <button
                type="button"
                className="crc-active-filter-clear"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกตัวกรองการ์ด"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 6. Table Layout (Center-aligned standard, Direct row click) ── */}
      <section className="crc-table-container">
        <div className="crc-table-wrapper">
          <table className="crc-table">
            <thead>
              <tr>
                <th className="crc-col-center" style={{ width: '56px' }}>ลำดับ</th>
                <th
                  className="crc-col-center sortable"
                  onClick={() => handleSort('vstdate')}
                  style={{ width: '110px' }}
                  title="คลิกเพื่อเรียงตามวันที่รับบริการ"
                >
                  <div className="crc-th-content">
                    <span>วันที่รับบริการ</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </th>
                <th className="crc-col-center" style={{ width: '80px' }}>เวลา</th>
                <th
                  className="crc-col-center sortable"
                  onClick={() => handleSort('hn')}
                  style={{ width: '90px' }}
                  title="คลิกเพื่อเรียงตาม HN"
                >
                  <div className="crc-th-content">
                    <span>HN</span>
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </th>
                <th className="crc-col-center" style={{ width: '130px' }}>เลขบัตรประชาชน</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('ptname')}
                  style={{ minWidth: '170px' }}
                  title="คลิกเพื่อเรียงตามชื่อ-สกุล"
                >
                  <div className="crc-th-content">
                    <span>ชื่อ-สกุล</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </th>
                <th
                  className="crc-col-center sortable"
                  onClick={() => handleSort('age')}
                  style={{ width: '70px' }}
                  title="คลิกเพื่อเรียงตามอายุ"
                >
                  <div className="crc-th-content">
                    <span>อายุ</span>
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </th>
                <th style={{ minWidth: '150px' }}>สิทธิการรักษา</th>
                <th
                  className="crc-col-center sortable"
                  onClick={() => handleSort('pdx')}
                  style={{ width: '75px' }}
                  title="คลิกเพื่อเรียงตามรหัสการวินิจฉัยโรค (PDX)"
                >
                  <div className="crc-th-content">
                    <span>PDX</span>
                    {sortBy === 'pdx' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </th>
                <th className="crc-col-center" style={{ width: '120px' }}>
                    ClaimCode
                  </th>
                <th className="crc-col-center" style={{ width: '110px' }}>ผล Lab (FIT)</th>
                <th style={{ minWidth: '160px' }}>Special PP (1B006)</th>
                <th style={{ minWidth: '160px' }}>รายการ ADP (90005)</th>
                <th className="crc-col-center" style={{ width: '120px' }}>ความสมบูรณ์</th>
                <th className="crc-col-center" style={{ width: '110px' }}>สถานะชดเชย</th>
                <th className="crc-col-center" style={{ width: '110px' }}>เลขที่ Rep</th>
                <th
                  className="crc-col-center sortable"
                  onClick={() => handleSort('compensated')}
                  style={{ width: '120px' }}
                  title="คลิกเพื่อเรียงตามยอดชดเชย"
                >
                  <div className="crc-th-content">
                    <span>ยอดชดเชย</span>
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !isRefreshing ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="crc-table-skeleton-row">
                    {Array.from({ length: 17 }).map((_, j) => (
                      <td key={`skel-td-${j}`}>
                        <div className="crc-skeleton-box" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={17}>
                    <div className="crc-empty-state">
                      <TestTube2 size={40} className="crc-empty-icon" />
                      <p className="crc-empty-title">ไม่พบข้อมูลผู้รับบริการคัดกรอง FIT test</p>
                      <p className="crc-empty-desc">
                        {search || cardFilter !== 'ALL' || selectedPttypes.length > 0 || ucOnly
                          ? 'ลองปรับเปลี่ยนคำค้นหา หรือยกเลิกตัวกรองเพื่อค้นหาอีกครั้ง'
                          : 'ไม่มีข้อมูลการรับบริการในช่วงเวลาที่เลือก'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  let rowClass = ''
                  if (item.dataQualityStatus === 'MISSING_ADP') rowClass = 'crc-row-missing-adp'
                  else if (item.dataQualityStatus === 'MISSING_PP') rowClass = 'crc-row-missing-pp'
                  else if (item.dataQualityStatus === 'INVALID_PP_CODE') rowClass = 'crc-row-invalid-pp'

                  return (
                    <tr
                      key={item.vn}
                      className={`crc-table-row ${rowClass}`}
                      onClick={() => handleRowClick(item)}
                      title="คลิกแถวนี้เพื่อเปิดดูรายละเอียดเวชระเบียนและการชดเชย"
                    >
                      <td className="crc-col-center" style={{ color: 'var(--gray-500)' }}>
                        {item.no}
                      </td>
                      <td className="crc-col-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatThaiDate(item.vstdate)}
                      </td>
                      <td className="crc-col-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {item.vsttime.slice(0, 5)}
                      </td>
                      <td className="crc-col-center" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {item.hn}
                      </td>
                      <td className="crc-col-center" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                        {item.cid}
                      </td>
                      <td style={{ fontWeight: 500, minWidth: '170px' }}>{renderPatientName(item.ptname)}</td>
                      <td className="crc-col-center" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {item.age}&nbsp;ปี
                      </td>
                      <td style={{ color: 'var(--gray-700)', fontSize: '0.8125rem' }}>
                        {item.pttypename}
                      </td>
                      <td className="crc-col-center" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {item.pdx || '—'}
                      </td>
                      <td className="crc-col-center">
                        {item.authencode ? (
                          <span className="crc-badge crc-badge-info">{item.authencode}</span>
                        ) : (
                          <span className="crc-badge crc-badge-neutral">ไม่มี</span>
                        )}
                      </td>
                      <td className="crc-col-center">
                        {item.labresult ? (
                          <span
                            className={`crc-badge ${
                              item.labresult.toLowerCase().includes('pos') ||
                              item.labresult.includes('บวก') ||
                              item.labresult.includes('ผิดปกติ')
                                ? 'crc-badge-danger'
                                : 'crc-badge-success'
                            }`}
                          >
                            {item.labresult}
                          </span>
                        ) : (
                          <span className="crc-badge crc-badge-neutral">—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {item.code || item.pp_special_code ? (
                          <span title={item.code || ''}>
                            {item.pp_special_code ? `[${item.pp_special_code}] ` : ''}
                            {item.code || item.pp_special_code}
                          </span>
                        ) : (
                          <span className="crc-badge crc-badge-warning">ไม่มี PP</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {item.listname ? (
                          <span>{item.listname}</span>
                        ) : (
                          <span className="crc-badge crc-badge-danger">ไม่มี ADP</span>
                        )}
                      </td>
                      <td className="crc-col-center">
                        {item.dataQualityStatus === 'COMPLETE' ? (
                          <span className="crc-badge crc-badge-success">ครบถ้วน</span>
                        ) : item.dataQualityStatus === 'MISSING_ADP' ? (
                          <span className="crc-badge crc-badge-danger">ขาด ADP</span>
                        ) : item.dataQualityStatus === 'MISSING_PP' ? (
                          <span className="crc-badge crc-badge-warning">ขาด PP</span>
                        ) : (
                          <span className="crc-badge crc-badge-yellow">PP ไม่ตรง</span>
                        )}
                      </td>
                      <td className="crc-col-center">
                        {item.isCompensated ? (
                          <span className="crc-badge crc-badge-success">
                            {item.status || 'ชดเชยแล้ว'}
                          </span>
                        ) : item.status ? (
                          <span className="crc-badge crc-badge-warning">{item.status}</span>
                        ) : (
                          <span className="crc-badge crc-badge-neutral">รอชดเชย</span>
                        )}
                      </td>
                      <td className="crc-col-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {item.rep || '—'}
                      </td>
                      <td
                        className="crc-col-center"
                        style={{
                          fontWeight: 600,
                          color: item.isCompensated ? '#065f46' : 'inherit',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatMoney(item.compensated)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 7. Pagination Bar ── */}
        <div className="crc-pagination">
          <div className="crc-pagination-info">
            แสดง {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง{' '}
            {Math.min(currentPage * pageSize, totalCount)} จากทั้งหมด {totalCount.toLocaleString()}{' '}
            รายการ
          </div>

          <div className="crc-pagination-controls">
            <button
              type="button"
              className="crc-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.875rem', padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}>
              หน้า {currentPage} จาก {totalPages}
            </span>
            <button
              type="button"
              className="crc-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 8. Direct Row-Click Detail Modal (No button needed in table) ── */}
      {selectedItem && (
        <div className="crc-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="crc-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-patient-name"
          >
            <div className="crc-modal-header">
              <div className="crc-modal-title-group">
                <h2 id="modal-patient-name" className="crc-modal-title">
                  {selectedItem.ptname}
                </h2>
                <p className="crc-modal-subtitle">
                  HN: {selectedItem.hn} • VN: {selectedItem.vn} • วันที่รับบริการ:{' '}
                  {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime.slice(0, 5)} น.
                </p>
              </div>
              <button
                type="button"
                className="crc-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="crc-modal-tabs">
              <button
                type="button"
                className={`crc-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleTabChange('summary')}
              >
                ข้อมูลการคัดกรอง & การชดเชย
              </button>
              <button
                type="button"
                className={`crc-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleTabChange('clinical')}
              >
                เวชระเบียนการรักษา (VN Detail)
              </button>
            </div>

            <div className="crc-modal-body">
              {modalTab === 'summary' ? (
                <>
                  <div>
                    <h3 className="crc-modal-section-title">ข้อมูลทั่วไปและสิทธิการรักษา</h3>
                    <div className="crc-modal-grid">
                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">เลขบัตรประชาชน (CID)</span>
                        <div className="crc-modal-card-value">
                          <span>{selectedItem.cid}</span>
                          <button
                            type="button"
                            className="crc-modal-copy-btn"
                            onClick={() => handleCopy(selectedItem.cid, 'cid')}
                            title="คัดลอก CID"
                            aria-label="คัดลอกเลขประจำตัวประชาชน"
                          >
                            {copiedField === 'cid' ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">อายุ / เพศ</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.age}&nbsp;ปี ({selectedItem.sex})
                        </span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">สิทธิการรักษา</span>
                        <span className="crc-modal-card-value">{selectedItem.pttypename}</span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">ClaimCode:</span>
                        <div className="crc-modal-card-value">
                          <span>{selectedItem.authencode || 'ไม่มี'}</span>
                          {selectedItem.authencode && (
                            <button
                              type="button"
                              className="crc-modal-copy-btn"
                              onClick={() => handleCopy(selectedItem.authencode!, 'authen')}
                              title="คัดลอก ClaimCode"
                              aria-label="คัดลอก ClaimCode"
                            >
                              {copiedField === 'authen' ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="crc-modal-section-title">การตรวจคัดกรอง FIT test & รหัส ADP 90005</h3>
                    <div className="crc-modal-grid">
                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">ผล Lab Stool FIT test</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.labresult || 'ไม่มีผล Lab ในระบบ'}
                        </span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">ความสมบูรณ์ของชุดข้อมูล</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.dataQualityStatus === 'COMPLETE' ? (
                            <span className="crc-badge crc-badge-success">ข้อมูลครบถ้วน</span>
                          ) : selectedItem.dataQualityStatus === 'MISSING_ADP' ? (
                            <span className="crc-badge crc-badge-danger">ขาด ADP 90005</span>
                          ) : selectedItem.dataQualityStatus === 'MISSING_PP' ? (
                            <span className="crc-badge crc-badge-warning">ขาด Special PP</span>
                          ) : (
                            <span className="crc-badge crc-badge-yellow">รหัส PP ไม่ตรง 1B0060/61</span>
                          )}
                        </span>
                      </div>

                      <div className="crc-modal-card full-width">
                        <span className="crc-modal-card-label">รหัส Special PP (HOSxP pp_special)</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.code || selectedItem.pp_special_code
                            ? `${selectedItem.pp_special_code ? `[${selectedItem.pp_special_code}] ` : ''}${selectedItem.code || ''}`
                            : 'ไม่มีการบันทึกรหัส Special PP'}
                        </span>
                      </div>

                      <div className="crc-modal-card full-width">
                        <span className="crc-modal-card-label">รายการค่าบริการ ADP (opitemrece)</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.listname || 'ไม่มีรายการค่าบริการ ADP 90005'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="crc-modal-section-title">ข้อมูลการชดเชย & ใบตอบรับ (REP)</h3>
                    <div className="crc-modal-grid">
                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">สถานะการชดเชย</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.status || 'รอการชดเชย'}
                        </span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">เลขที่ Rep</span>
                        <span className="crc-modal-card-value">{selectedItem.rep || '—'}</span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">ยอดเงินชดเชย</span>
                        <span className="crc-modal-card-value" style={{ color: '#065f46' }}>
                          {formatMoney(selectedItem.compensated)} บาท
                        </span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">Seamless Status / Rep</span>
                        <span className="crc-modal-card-value">
                          {selectedItem.status_seamless || '—'}{' '}
                          {selectedItem.rep_seamless ? `(${selectedItem.rep_seamless})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(selectedItem.pdx || selectedItem.sdx || selectedItem.ops) && (
                    <div>
                      <h3 className="crc-modal-section-title">การวินิจฉัยและหัตถการ</h3>
                      <div className="crc-modal-grid">
                        <div className="crc-modal-card">
                          <span className="crc-modal-card-label">การวินิจฉัยหลัก (PDX)</span>
                          <span className="crc-modal-card-value">{selectedItem.pdx || '—'}</span>
                        </div>
                        <div className="crc-modal-card">
                          <span className="crc-modal-card-label">การวินิจฉัยร่วม (SDX)</span>
                          <span className="crc-modal-card-value">{selectedItem.sdx || '—'}</span>
                        </div>
                        {selectedItem.ops && (
                          <div className="crc-modal-card full-width">
                            <span className="crc-modal-card-label">รหัสหัตถการ (ICD-9-CM)</span>
                            <span className="crc-modal-card-value">{selectedItem.ops}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loadingVnDetails ? (
                    <div className="crc-empty-state">
                      <RefreshCw size={28} className="animate-spin" />
                      <p className="crc-empty-title">กำลังดึงข้อมูลเวชระเบียน...</p>
                    </div>
                  ) : vnDetails ? (
                    <div className="crc-modal-grid">
                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">แผนก / แผนกย่อย</span>
                        <span className="crc-modal-card-value">
                          {vnDetails.header?.department || '—'} / {vnDetails.header?.clinic || '—'}
                        </span>
                      </div>

                      <div className="crc-modal-card">
                        <span className="crc-modal-card-label">อาการสำคัญ (Chief Complaint)</span>
                        <span className="crc-modal-card-value" style={{ fontWeight: 400, fontSize: '0.875rem' }}>
                          {vnDetails.screen?.cc || '—'}
                        </span>
                      </div>

                      {vnDetails.screen && (
                        <div className="crc-modal-card full-width">
                          <span className="crc-modal-card-label">สัญญาณชีพ (Vital Signs)</span>
                          <span className="crc-modal-card-value" style={{ fontWeight: 400, fontSize: '0.875rem' }}>
                            BP: {vnDetails.screen.bps || '—'}/{vnDetails.screen.bpd || '—'} mmHg •
                            PR: {vnDetails.screen.pulse || '—'} bpm •
                            Temp: {vnDetails.screen.temperature || '—'} °C •
                            BW: {vnDetails.screen.bw || '—'} kg •
                            Height: {vnDetails.screen.height || '—'} cm
                          </span>
                        </div>
                      )}

                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div className="crc-modal-card full-width">
                          <span className="crc-modal-card-label">รายการวินิจฉัย (Diagnoses)</span>
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {vnDetails.diagnoses.map((d, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8125rem',
                                  padding: '4px 0',
                                  borderBottom: '1px dashed var(--gray-200)',
                                }}
                              >
                                <span>
                                  <strong>[{d.icd10}]</strong> {d.icd_name || (d as any).name}
                                </span>
                                <span style={{ color: 'var(--gray-500)' }}>{d.diagtype_name || ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div className="crc-modal-card full-width">
                          <span className="crc-modal-card-label">รายการยา เวชภัณฑ์ และค่าบริการใน Visit</span>
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {vnDetails.orders.items.map((it, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8125rem',
                                  padding: '4px 0',
                                  borderBottom: '1px dashed var(--gray-200)',
                                }}
                              >
                                <span>
                                  {it.item_name} {it.qty ? `(x${it.qty})` : ''}
                                </span>
                                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gray-600)' }}>
                                  {it.income_name || it.drugusage_text || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="crc-empty-state">
                      <p className="crc-empty-title">ไม่พบรายละเอียดเวชระเบียนเพิ่มเติม</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="crc-modal-footer">
              <button
                type="button"
                className="crc-btn"
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
