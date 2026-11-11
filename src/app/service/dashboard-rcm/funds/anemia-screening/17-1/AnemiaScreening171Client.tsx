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
  Droplets,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Clock,
  History,
  Copy,
  Check,
} from 'lucide-react'
import type {
  AnemiaScreeningItem,
  AnemiaScreeningSummary,
  AnemiaScreeningCardFilter,
  AnemiaScreeningSearchField,
  AnemiaScreeningSortField,
  AnemiaScreeningAdpMappingCheck,
  AnemiaScreeningReportResult,
} from '@/lib/clinical/rcmAnemiaScreeningService'
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

export interface AnemiaScreening171ClientProps {
  initialData?: AnemiaScreeningReportResult | null
}

export default function AnemiaScreening171Client({
  initialData = null,
}: AnemiaScreening171ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<AnemiaScreeningCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(
    initialData?.ucOnly ? [...UC_ECLAIM_CODES] : []
  )
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [targetAgeOnly, setTargetAgeOnly] = useState<boolean>(initialData?.targetAgeOnly ?? false)
  const [searchField, setSearchField] = useState<AnemiaScreeningSearchField>(
    initialData?.searchField ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<AnemiaScreeningSortField>(
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
  const [items, setItems] = useState<AnemiaScreeningItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<AnemiaScreeningAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: '13001',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<AnemiaScreeningSummary>(
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
      repeatClaimCount: 0,
      repeatClaimRate: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<AnemiaScreeningItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race condition safety
  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search])

  // Synchronize date ranges when mode changes
  const applyDateMode = useCallback(
    (mode: 'custom' | 'monthly' | 'fiscal', fYear = selectedFiscalYear, m = selectedMonth, bYear = selectedBeYear) => {
      if (mode === 'fiscal') {
        const ceYear = fYear - 543
        setDs1(`${ceYear - 1}-10-01`)
        setDs2(`${ceYear}-09-30`)
      } else if (mode === 'monthly') {
        const ceYear = bYear - 543
        const padM = String(m).padStart(2, '0')
        const lastDay = new Date(ceYear, m, 0).getDate()
        setDs1(`${ceYear}-${padM}-01`)
        setDs2(`${ceYear}-${padM}-${String(lastDay).padStart(2, '0')}`)
      }
    },
    [selectedFiscalYear, selectedMonth, selectedBeYear]
  )

  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    applyDateMode(mode)
    setCurrentPage(1)
  }

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
        const params = new URLSearchParams()
        params.set('ds1', ds1)
        params.set('ds2', ds2)
        params.set('cardFilter', cardFilter)
        if (selectedPttypes.length > 0) {
          params.set('pttypes', selectedPttypes.join(','))
        } else if (ucOnly) {
          params.set('ucOnly', 'true')
        }
        params.set('targetAgeOnly', String(targetAgeOnly))
        if (debouncedSearch) {
          params.set('searchField', searchField)
          params.set('search', debouncedSearch)
        }
        params.set('sortBy', sortBy)
        params.set('sortOrder', sortOrder)
        params.set('page', String(currentPage))
        params.set('pageSize', String(pageSize))
        if (refresh) params.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/anemia-screening/service-17-1?${params.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data: AnemiaScreeningReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        setAdpMapping(data.adpMapping)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้')
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

  // Skip first mount if initialData is provided
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Fetch VN Clinical details when opening clinical tab in modal
  useEffect(() => {
    if (!selectedItem?.vn || modalTab !== 'clinical') return
    let active = true
    setLoadingVnDetails(true)
    fetch(`/api/service/dashboard-rcm/funds/anemia-screening/vn-details?vn=${encodeURIComponent(selectedItem.vn)}`)
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success) {
          setVnDetails(json.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingVnDetails(false)
      })

    return () => {
      active = false
    }
  }, [selectedItem, modalTab])

  // Handle row click directly
  const handleRowClick = (item: AnemiaScreeningItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
  }

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItem) {
        setSelectedItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem])

  // Sorting helper
  const handleSort = (field: AnemiaScreeningSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Toggle card filter
  const handleCardFilter = (filter: AnemiaScreeningCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Export to CSV with UTF-8 BOM
  const exportToCsv = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('ds1', ds1)
      params.set('ds2', ds2)
      params.set('cardFilter', cardFilter)
      if (selectedPttypes.length > 0) {
        params.set('pttypes', selectedPttypes.join(','))
      } else if (ucOnly) {
        params.set('ucOnly', 'true')
      }
      params.set('targetAgeOnly', String(targetAgeOnly))
      if (debouncedSearch) {
        params.set('searchField', searchField)
        params.set('search', debouncedSearch)
      }
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('exportAll', 'true')

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/anemia-screening/service-17-1?${params.toString()}`
      )
      const json = await res.json()
      if (!json.success) throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')

      const exportItems: AnemiaScreeningItem[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'วันที่รับบริการ',
        'เวลา',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        'กลุ่มเป้าหมาย (13-24 ปี)',
        'สิทธิการรักษา',
        'สิทธิบัตรทอง',
        'แผนก',
        'คลินิก',
        'การวินิจฉัยหลัก (PDX)',
        'การวินิจฉัยร่วม (SDX)',
        'รายการ ADP',
        'ค่าบริการ',
        'ClaimCode',
        'เคยเคลมซ้ำในปีงบ',
        'วันที่เคยเคลมเดิม',
        'เลขที่ REP',
        'สถานะการชดเชย',
        'ยอดชดเชย (บาท)',
        'กองทุน',
      ]

      const rows = exportItems.map((row) => [
        row.no,
        row.vstdate,
        row.vsttime,
        row.hn,
        row.cid,
        row.ptname,
        row.sex,
        row.age,
        row.isTargetAge ? 'ตรงกลุ่มเป้าหมาย' : 'นอกกลุ่มเป้าหมาย',
        row.pttypename || '',
        row.isUc ? 'ใช่' : 'ไม่ใช่',
        row.department || '',
        row.clinic || '',
        row.pdx || '',
        row.sdx || '',
        row.listname || '',
        row.income,
        row.authencode || '',
        row.hasRepeatClaim ? 'มีประวัติเคลมซ้ำ' : 'ไม่พบเคลมซ้ำ',
        row.camedate || '',
        row.rep || '',
        row.status || '',
        row.compensated,
        row.fund || '',
      ])

      await exportRcmExcel({
        filename: `anemia_screening_17_1_${ds1}_to_${ds2}.xlsx`,
        title: '17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP (13001)',
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
    <div className="as-page">
      {/* ── 1. Clean Breadcrumb (No Eyebrow Pills) ── */}
      <nav className="as-breadcrumb" aria-label="breadcrumb">
        <Link href="/">หน้าหลัก</Link>
        <span className="as-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm">รายงาน RCM</Link>
        <span className="as-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
        <span className="as-breadcrumb-sep">/</span>
        <span className="as-breadcrumb-current">17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP</span>
      </nav>

      {/* ── 2. Header Bar ── */}
      <div className="as-header">
        <div className="as-title-group">
          <h1 className="as-title">17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP</h1>
          <p className="as-subtitle">
            <span>รหัส ADP 13001</span>
            <span className="as-subtitle-dot">·</span>
            <span>ค่าบริการเหมาจ่าย 65.00 บาท/ครั้ง</span>
            <span className="as-subtitle-dot">·</span>
            <span>กลุ่มเป้าหมาย: หญิงไทยอายุ 13-24 ปี ทุกสิทธิการรักษา (ตรวจ CBC 1 ครั้ง/คน/ปี)</span>
          </p>
        </div>

        <div className="as-actions">
          <button
            type="button"
            className="as-btn as-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลจากฐานข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'as-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}</span>
          </button>

          <button
            type="button"
            className="as-btn as-btn-secondary"
            onClick={exportToCsv}
            disabled={loading || isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. Warning Banner when ADP is not mapped ── */}
      {!adpMapping.isMapped && (
        <div className="as-banner-warn" role="alert">
          <AlertTriangle size={20} className="as-banner-warn-icon" />
          <div>
            <strong>แจ้งเตือน:</strong> ไม่พบการผูกรหัส ADP <code>13001</code> ในตาราง <code>s_drugitems</code>{' '}
            กรุณาตรวจสอบการตั้งค่ารายการค่าตรวจวินิจฉัย/แล็บเพื่อให้ระบบดึงข้อมูลได้สมบูรณ์
          </div>
        </div>
      )}

      {/* ── 4. Date Selection Card (เรียง: กำหนดเอง -> เดือน -> ปีงบประมาณ) ── */}
      <div className="as-date-card">
        <div className="as-date-segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`as-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`as-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`as-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="as-date-divider" aria-hidden="true" />

        <div className="as-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="as-control-group">
                <span className="as-control-label">ตั้งแต่วันที่:</span>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="as-control-group">
                <span className="as-control-label">ถึงวันที่:</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                  }}
                />
              </div>
              <button
                type="button"
                className="as-btn as-btn-primary"
                onClick={() => {
                  setCurrentPage(1)
                  fetchData()
                }}
              >
                ค้นหาช่วงเวลา
              </button>
            </>
          )}

          {dateMode === 'monthly' && (
            <>
              <div className="as-control-group">
                <span className="as-control-label">เลือกเดือน:</span>
                <select
                  className="as-select"
                  value={selectedMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value)
                    setSelectedMonth(m)
                    applyDateMode('monthly', selectedFiscalYear, m, selectedBeYear)
                    setCurrentPage(1)
                  }}
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="as-control-group">
                <span className="as-control-label">ปี พ.ศ.:</span>
                <select
                  className="as-select"
                  value={selectedBeYear}
                  onChange={(e) => {
                    const y = Number(e.target.value)
                    setSelectedBeYear(y)
                    applyDateMode('monthly', selectedFiscalYear, selectedMonth, y)
                    setCurrentPage(1)
                  }}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {dateMode === 'fiscal' && (
            <div className="as-control-group">
              <span className="as-control-label">ปีงบประมาณ พ.ศ.:</span>
              <select
                className="as-select"
                value={selectedFiscalYear}
                onChange={(e) => {
                  const y = Number(e.target.value)
                  setSelectedFiscalYear(y)
                  applyDateMode('fiscal', y)
                  setCurrentPage(1)
                }}
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
      </div>

      {/* ── 5. KPI Summary Cards (Interactive Filter Cards) ── */}
      <div className="as-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`as-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="as-kpi-icon">
              <Droplets size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">
              {summary.uniquePatients.toLocaleString('th-TH')} คน (ยอดเรียกเก็บ ฿{summary.totalIncome.toLocaleString('th-TH')})
            </span>
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          className={`as-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">ชดเชยแล้ว</span>
            <div className="as-kpi-icon">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.compensatedVisits.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">
              {summary.compensationRate.toFixed(1)}% · รวม ฿{formatMoney(summary.totalCompensated)}
            </span>
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย / รอชดเชย */}
        <div
          className={`as-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ได้รับเงินชดเชย"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">รอชดเชย / ยังไม่ชดเชย</span>
            <div className="as-kpi-icon">
              <Clock size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.uncompensatedVisits.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">
              {(100 - summary.compensationRate).toFixed(1)}% ของยอดบริการทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 4: ตรงกลุ่มเป้าหมายอายุ 13-24 ปี */}
        <div
          className={`as-kpi-card ${cardFilter === 'TARGET_AGE' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('TARGET_AGE')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะผู้รับบริการอายุ 13-24 ปี"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">กลุ่มอายุ 13-24 ปี</span>
            <div className="as-kpi-icon">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.targetAgeCount.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">
              {summary.targetAgeRate.toFixed(1)}% ตรงเกณฑ์ สปสช.
            </span>
          </div>
        </div>

        {/* Card 5: มี ClaimCode */}
        <div
          className={`as-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">มี ClaimCode</span>
            <div className="as-kpi-icon">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">{summary.authenRate.toFixed(1)}% มีรหัสยืนยันตัวตน</span>
          </div>
        </div>

        {/* Card 6: ไม่มี ClaimCode */}
        <div
          className={`as-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('NO_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ขาด ClaimCode"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">ไม่มี ClaimCode</span>
            <div className="as-kpi-icon">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.withoutAuthenCount.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">
              {(100 - summary.authenRate).toFixed(1)}% ต้องเร่งตรวจสอบ
            </span>
          </div>
        </div>

        {/* Card 7: สิทธิบัตรทอง (UC) */}
        <div
          className={`as-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UC_ONLY')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UCS/UC/WEL)"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">สิทธิบัตรทอง (UC)</span>
            <div className="as-kpi-icon">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.ucCount.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">{summary.ucRate.toFixed(1)}% ของผู้รับบริการ</span>
          </div>
        </div>

        {/* Card 8: เคยเคลมซ้ำในปีงบ */}
        <div
          className={`as-kpi-card ${cardFilter === 'REPEAT_CLAIM' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('REPEAT_CLAIM')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองรายการที่มีประวัติเคยเบิก 13001 มาแล้วในปีงบเดียวกัน"
        >
          <div className="as-kpi-header">
            <span className="as-kpi-title">เคยเคลมซ้ำในปีงบ</span>
            <div className="as-kpi-icon">
              <History size={16} />
            </div>
          </div>
          <div className="as-kpi-body">
            <span className="as-kpi-val">{summary.repeatClaimCount.toLocaleString('th-TH')}</span>
            <span className="as-kpi-sub">{summary.repeatClaimRate.toFixed(1)}% ตรวจซ้ำในปีงบ</span>
          </div>
        </div>
      </div>

      {/* ── 6. Search & Filter Bar ── */}
      <div className="as-toolbar">
        <div className="as-search-group">
          <div className="as-search-input-wrapper">
            <Search size={16} className="as-search-icon" />
            <input
              type="text"
              className="as-search-input"
              placeholder="พิมพ์คำค้นหา (ค้นหาได้ทั้ง HN, CID, ชื่อผู้ป่วย, VN, รหัสโรค, สิทธิการรักษา)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="as-search-clear"
                onClick={() => setSearch('')}
                title="ล้างข้อความค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
        </div>

        <div className="as-toolbar-info">
          แสดง <strong>{items.length.toLocaleString('th-TH')}</strong> จากทั้งหมด{' '}
          <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
        </div>
      </div>

      {/* ── 7. Patient Ledger Table (Row-Clickable, No Button Column!) ── */}
      <div className="as-table-card">
        {error ? (
          <div className="as-state-box">
            <AlertTriangle size={32} color="#dc2626" />
            <p><strong>เกิดข้อผิดพลาด:</strong> {error}</p>
            <button type="button" className="as-btn as-btn-primary" onClick={() => fetchData()}>
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : (
          <div className="as-table-wrapper">
            <table className="as-table">
              <thead>
                <tr>
                  <th className="col-center">#</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="as-table-sort-btn"
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
                      className="as-table-sort-btn"
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
                  <th className="col-center">
                    <button
                      type="button"
                      className="as-table-sort-btn"
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
                      className="as-table-sort-btn"
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
                  <th className="col-center">กลุ่มเป้าหมาย</th>
                  <th className="col-center">สิทธิการรักษา</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="as-table-sort-btn"
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
                      className="as-table-sort-btn"
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
                      className="as-table-sort-btn"
                      onClick={() => handleSort('camedate')}
                    >
                      เคลมซ้ำในงบ{' '}
                      {sortBy === 'camedate' ? (
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
                      className="as-table-sort-btn"
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
                {loading || isRefreshing ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                      {Array.from({ length: 14 }).map((__, colIdx) => (
                        <td key={colIdx} className="col-center">
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="as-state-box">
                      <Droplets size={36} color="#94a3b8" />
                      <p>ไม่พบรายการข้อมูลตามเงื่อนไขหรือช่วงเวลาที่เลือก</p>
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr
                    key={item.vn}
                    className="as-row-clickable"
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย"
                  >
                    <td className="col-center as-num">{item.no}</td>
                    <td className="col-center as-num">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center as-num">{item.vsttime || '—'}</td>
                    <td className="col-center as-num font-mono">{item.hn}</td>
                    <td className="col-center as-num font-mono">{item.cid}</td>
                    <td className="col-left">{item.ptname}</td>
                    <td className="col-center as-num">{item.age} ปี</td>
                    <td className="col-center">
                      {item.isTargetAge ? (
                        <span className="as-target-age-pill">13-24 ปี</span>
                      ) : (
                        <span className="as-badge as-badge-neutral">นอกเกณฑ์</span>
                      )}
                    </td>
                    <td className="col-center">
                      <span className={`as-badge ${item.isUc ? 'as-badge-ok' : 'as-badge-neutral'}`}>
                        {item.pttypename || item.maininscl || '—'}
                      </span>
                    </td>
                    <td className="col-center font-mono">
                      {item.authencode ? (
                        <span className="as-badge as-badge-ok">{item.authencode}</span>
                      ) : (
                        <span className="as-badge as-badge-warn">ไม่มี</span>
                      )}
                    </td>
                    <td className="col-center font-mono font-bold">{item.pdx || '—'}</td>
                    <td className="col-center">
                      {item.hasRepeatClaim ? (
                        <span className="as-badge as-badge-err" title={`เคยเคลม: ${item.camedate}`}>
                          เคยเคลม ({item.camedate})
                        </span>
                      ) : (
                        <span className="as-badge as-badge-neutral">ครั้งแรกในงบ</span>
                      )}
                    </td>
                    <td className="col-center">
                      <span
                        className={`as-badge ${
                          item.isCompensated ? 'as-badge-ok' : item.status ? 'as-badge-info' : 'as-badge-warn'
                        }`}
                      >
                        {item.status || 'รอชดเชย'}
                      </span>
                    </td>
                    <td className="col-center as-num font-semibold">
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

        {/* ── 8. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="as-pagination">
            <div className="as-pagination-info">
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ)
            </div>

            <div className="as-pagination-controls">
              <button
                type="button"
                className="as-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                หน้าแรก
              </button>
              <button
                type="button"
                className="as-page-btn"
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
                className="as-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="as-page-btn"
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

      {/* ── 9. Clinical Detail Modal (Clicking Record Directly Opens This!) ── */}
      {selectedItem && (
        <div
          className="as-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null)
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="as-modal-content">
            <div className="as-modal-header">
              <div className="as-modal-title-wrap">
                <h3 className="as-modal-title">
                  {selectedItem.ptname} ({selectedItem.age} ปี)
                </h3>
                <span className="as-modal-subtitle">
                  HN: {selectedItem.hn} · VN: {selectedItem.vn} · วันที่รับบริการ: {formatThaiDate(selectedItem.vstdate)}{' '}
                  {selectedItem.vsttime}
                </span>
              </div>
              <button
                type="button"
                className="as-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง (ESC)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="as-modal-tabs">
              <button
                type="button"
                className={`as-modal-tab-btn ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปข้อมูลการชดเชย & เวชระเบียน
              </button>
              <button
                type="button"
                className={`as-modal-tab-btn ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                รายละเอียดการตรวจและแล็บ (HOSxP)
              </button>
            </div>

            <div className="as-modal-body">
              {modalTab === 'summary' ? (
                <>
                  <div>
                    <h4 className="as-modal-section-title">ข้อมูลตัวบุคคล & สิทธิประโยชน์</h4>
                    <div className="as-detail-grid">
                      <div className="as-detail-card">
                        <span className="as-detail-label">เลขบัตรประชาชน (CID)</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="as-detail-val">{selectedItem.cid}</span>
                          <button
                            type="button"
                            className="as-btn as-btn-secondary"
                            style={{ minHeight: '26px', padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          >
                            {copiedField === 'cid' ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedField === 'cid' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">HN / VN</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="as-detail-val">
                            {selectedItem.hn} / {selectedItem.vn}
                          </span>
                          <button
                            type="button"
                            className="as-btn as-btn-secondary"
                            style={{ minHeight: '26px', padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleCopy(selectedItem.hn, 'hn')}
                          >
                            {copiedField === 'hn' ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedField === 'hn' ? 'คัดลอกแล้ว' : 'คัดลอก HN'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">สิทธิการรักษา</span>
                        <span className="as-detail-val">
                          {selectedItem.pttypename} ({selectedItem.maininscl || '—'})
                        </span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">เกณฑ์อายุ 13-24 ปี</span>
                        <span className="as-detail-val">
                          {selectedItem.isTargetAge ? (
                            <span style={{ color: '#15803d' }}>ตรงเกณฑ์ ({selectedItem.age} ปี)</span>
                          ) : (
                            <span style={{ color: '#b45309' }}>นอกเกณฑ์ ({selectedItem.age} ปี)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="as-modal-section-title">การวินิจฉัยและรายการส่งเบิก ADP</h4>
                    <div className="as-detail-grid">
                      <div className="as-detail-card">
                        <span className="as-detail-label">การวินิจฉัยหลัก (PDX)</span>
                        <span className="as-detail-val font-bold">{selectedItem.pdx || '—'}</span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">การวินิจฉัยร่วม (SDX)</span>
                        <span className="as-detail-val">{selectedItem.sdx || '—'}</span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">รายการบริการ ADP</span>
                        <span className="as-detail-val">{selectedItem.listname || '13001 คัดกรองโลหิตจาง'}</span>
                      </div>

                      {selectedItem.listname1 ? (
                        <div className="as-detail-card" style={{ gridColumn: '1 / -1' }}>
                          <span className="as-detail-label">รายการตรวจเวชภัณฑ์/หัตถการไม่คิดมูลค่ายา (listname1)</span>
                          <span className="as-detail-val font-mono" style={{ fontSize: '0.8125rem' }}>
                            {selectedItem.listname1}
                          </span>
                        </div>
                      ) : null}

                      <div className="as-detail-card">
                        <span className="as-detail-label">ค่าบริการเรียกเก็บ (Income)</span>
                        <span className="as-detail-val">฿{formatMoney(selectedItem.income)}</span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">ClaimCode (สปสช.)</span>
                        <span className="as-detail-val">
                          {selectedItem.authencode || <span style={{ color: '#d97706' }}>ไม่มีรหัส ClaimCode</span>}
                        </span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">ประวัติเคลมซ้ำในงบเดียวกัน</span>
                        <span className="as-detail-val">
                          {selectedItem.hasRepeatClaim ? (
                            <span style={{ color: '#dc2626' }}>เคยเคลมแล้ววันที่ {selectedItem.camedate}</span>
                          ) : (
                            <span style={{ color: '#16a34a' }}>ไม่พบการเคลมซ้ำ</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="as-modal-section-title">สถานะการชดเชย & ใบตอบรับ REP</h4>
                    <div className="as-detail-grid">
                      <div className="as-detail-card">
                        <span className="as-detail-label">สถานะการชดเชย</span>
                        <span className="as-detail-val">
                          <span
                            className={`as-badge ${
                              selectedItem.isCompensated
                                ? 'as-badge-ok'
                                : selectedItem.status
                                ? 'as-badge-info'
                                : 'as-badge-warn'
                            }`}
                          >
                            {selectedItem.status || 'รอส่งเบิก / รอประมวลผล'}
                          </span>
                        </span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">ยอดเงินชดเชย</span>
                        <span className="as-detail-val font-bold" style={{ color: '#15803d', fontSize: '1.125rem' }}>
                          ฿{formatMoney(selectedItem.compensated)}
                        </span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">เลขที่ REP</span>
                        <span className="as-detail-val font-mono">{selectedItem.rep || '—'}</span>
                      </div>

                      <div className="as-detail-card">
                        <span className="as-detail-label">กองทุน / กองทุนย่อย</span>
                        <span className="as-detail-val">
                          {selectedItem.fund || selectedItem.subfund
                            ? `${selectedItem.fund || ''} ${selectedItem.subfund ? `(${selectedItem.subfund})` : ''}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Tab 2: Clinical Details from HOSxP */
                <div>
                  {loadingVnDetails ? (
                    <div className="as-state-box">
                      <div className="as-spinner" />
                      <p>กำลังดึงข้อมูลเวชระเบียนจากระบบ HOSxP...</p>
                    </div>
                  ) : !vnDetails ? (
                    <div className="as-state-box">
                      <AlertTriangle size={32} color="#94a3b8" />
                      <p>ไม่พบข้อมูลการบันทึกเวชระเบียนเพิ่มเติมสำหรับ VN นี้</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="as-detail-grid">
                        <div className="as-detail-card">
                          <span className="as-detail-label">อาการสำคัญ (CC)</span>
                          <span className="as-detail-val">{vnDetails.screen?.cc || '—'}</span>
                        </div>
                        <div className="as-detail-card">
                          <span className="as-detail-label">สัญญาณชีพ (Vital Signs)</span>
                          <span className="as-detail-val">
                            BP: {vnDetails.screen?.bps ?? '—'}/{vnDetails.screen?.bpd ?? '—'} mmHg, PR:{' '}
                            {vnDetails.screen?.pulse ?? '—'} bpm, Temp: {vnDetails.screen?.temperature ?? '—'} °C
                          </span>
                        </div>
                        <div className="as-detail-card">
                          <span className="as-detail-label">น้ำหนัก / ส่วนสูง / BMI</span>
                          <span className="as-detail-val">
                            {vnDetails.screen?.bw ?? '—'} kg / {vnDetails.screen?.height ?? '—'} cm (BMI:{' '}
                            {vnDetails.screen?.bmi ?? '—'})
                          </span>
                        </div>
                        <div className="as-detail-card">
                          <span className="as-detail-label">แผนกคัดกรอง / ซักประวัติ</span>
                          <span className="as-detail-val">
                            {vnDetails.screen?.screen_dep_name || vnDetails.header.department || '—'}
                          </span>
                        </div>
                      </div>

                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div>
                          <h4 className="as-modal-section-title">รายการการวินิจฉัยโรค (Diagnoses)</h4>
                          <div className="as-table-wrapper">
                            <table className="as-table">
                              <thead>
                                <tr>
                                  <th className="col-center">รหัส ICD-10</th>
                                  <th>ชื่อโรค / ภาวะ</th>
                                  <th className="col-center">ประเภทการวินิจฉัย</th>
                                  <th>แพทย์ผู้วินิจฉัย</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vnDetails.diagnoses.map((d, dIdx) => (
                                  <tr key={dIdx}>
                                    <td className="col-center as-num font-mono font-bold">{d.icd10}</td>
                                    <td>{d.icd_name}</td>
                                    <td className="col-center">
                                      <span className="as-badge as-badge-neutral">{d.diagtype_name || d.diagtype}</span>
                                    </td>
                                    <td>{d.doctor_name || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div>
                          <h4 className="as-modal-section-title">
                            รายการตรวจทางห้องปฏิบัติการ ยา และเวชภัณฑ์ (รวม ฿
                            {formatMoney(vnDetails.orders.total_price)})
                          </h4>
                          <div className="as-table-wrapper">
                            <table className="as-table">
                              <thead>
                                <tr>
                                  <th>รายการ</th>
                                  <th className="col-center">หมวดหมู่</th>
                                  <th className="col-center">จำนวน</th>
                                  <th className="col-right">ราคารวม (บาท)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vnDetails.orders.items.map((o, oIdx) => (
                                  <tr key={oIdx}>
                                    <td>
                                      {o.item_name}{' '}
                                      {o.strength ? <span style={{ color: '#64748b' }}>({o.strength})</span> : null}
                                    </td>
                                    <td className="col-center">
                                      <span className="as-badge as-badge-neutral">{o.income_name || o.category_group}</span>
                                    </td>
                                    <td className="col-center as-num">
                                      {o.qty} {o.units || ''}
                                    </td>
                                    <td className="col-right as-num">{formatMoney(o.sum_price)}</td>
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

            <div className="as-modal-footer">
              <button
                type="button"
                className="as-btn as-btn-primary"
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
