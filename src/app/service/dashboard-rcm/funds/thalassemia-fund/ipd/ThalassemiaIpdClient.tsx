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
  Calendar,
  Droplet,
  Pill,
  TestTube2,
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Activity,
  Layers,
  Copy,
  Check,
} from 'lucide-react'
import type {
  ThalassemiaIpdItem,
  ThalassemiaFundSummary,
  ThalassemiaFundCardFilter,
  ThalassemiaIpdSortField,
  ThalassemiaIpdReportResult,
  AnClinicalDetails,
} from '@/lib/clinical/rcmThalassemiaFundService'
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
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface ThalassemiaIpdClientProps {
  initialData?: ThalassemiaIpdReportResult | null
}

export default function ThalassemiaIpdClient({ initialData = null }: ThalassemiaIpdClientProps) {
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

  // Date selection states: 1. กำหนดเอง -> 2. เดือน -> 3. ปีงบประมาณ
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
  const [cardFilter, setCardFilter] = useState<ThalassemiaFundCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<ThalassemiaIpdSortField>(
    initialData?.sortBy ?? 'dchdate'
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
  const [items, setItems] = useState<ThalassemiaIpdItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [summary, setSummary] = useState<ThalassemiaFundSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      uniquePatients: 0,
      drugCases: 0,
      drugRate: 0,
      bloodCases: 0,
      bloodRate: 0,
      totalBloodUnits: 0,
      ferritinCases: 0,
      ferritinRate: 0,
      hbHctCases: 0,
      hbHctRate: 0,
      compensatedCases: 0,
      uncompensatedCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      ucCases: 0,
      ucRate: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<ThalassemiaIpdItem | null>(null)
  const [modalTab, setModalTab] = useState<'overview' | 'orders'>('overview')
  const [anDetails, setAnDetails] = useState<AnClinicalDetails | null>(null)
  const [loadingAnDetails, setLoadingAnDetails] = useState<boolean>(false)
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
        if (debouncedSearch) {
          params.set('search', debouncedSearch)
        }
        params.set('sortBy', sortBy)
        params.set('sortOrder', sortOrder)
        params.set('page', String(currentPage))
        params.set('pageSize', String(pageSize))
        if (pttypes.length > 0) params.set('pttypes', pttypes.join(','))
        if (refresh) params.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/thalassemia-fund/ipd?${params.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data: ThalassemiaIpdReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
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
    [ds1, ds2, cardFilter, pttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Fetch on parameter change (skip on first mount if initialData is provided)
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Sorting handler
  const handleSort = (field: ThalassemiaIpdSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Card filter click
  const handleCardClick = (filter: ThalassemiaFundCardFilter) => {
    if (cardFilter === filter) {
      setCardFilter('ALL')
    } else {
      setCardFilter(filter)
    }
    setCurrentPage(1)
  }

  // Open Record Detail modal on row click
  const handleRowClick = async (item: ThalassemiaIpdItem) => {
    setSelectedItem(item)
    setModalTab('overview')
    setAnDetails(null)
    setLoadingAnDetails(true)

    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/thalassemia-fund/an-details?an=${encodeURIComponent(
          item.an
        )}`
      )
      const json = await res.json()
      if (json.success && json.data) {
        setAnDetails(json.data)
      }
    } catch {
      // Ignore detail fetch errors
    } finally {
      setLoadingAnDetails(false)
    }
  }

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Excel (.xlsx) Export
  const exportToExcel = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('ds1', ds1)
      params.set('ds2', ds2)
      params.set('cardFilter', cardFilter)
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('exportAll', 'true')
      if (pttypes.length > 0) params.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/thalassemia-fund/ipd?${params.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')
      }

      const exportItems: ThalassemiaIpdItem[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'AN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        'วันที่รับไว้รักษา (Admit)',
        'วันที่จำหน่าย (Discharge)',
        'สิทธิการรักษา',
        'หอผู้ป่วย',
        'ICD-10',
        'ICD-9',
        'ยาขับเหล็ก',
        'ชนิดเลือดที่ได้รับ',
        'วันที่ให้เลือด',
        'จำนวน Unit เลือด',
        'ผล Ferritin',
        'วันที่ตรวจ Ferritin',
        'ผล Hb',
        'วันที่ตรวจ Hb',
        'ผล Hct',
        'วันที่ตรวจ Hct',
        'เลขที่ Seamless',
        'เลขที่ Rep',
        'สถานะการชดเชย',
        'ยอดชดเชย (บาท)',
      ]

      const rows = exportItems.map((row) => [
        row.no,
        row.an,
        row.hn,
        row.cid,
        row.ptname,
        row.sex,
        row.age,
        row.admdate,
        row.dchdate,
        row.pttypename || '',
        row.ward || '',
        row.icd10 || '',
        row.icd9 || '',
        row.drugname || '',
        row.blood || '',
        row.bloodDate || '',
        row.bloodQty,
        row.ferritinResult || '',
        row.ferritinDate || '',
        row.hbResult || '',
        row.hbDate || '',
        row.hctResult || '',
        row.hctDate || '',
        row.seamless || '',
        row.rep || '',
        row.status || '',
        row.compensated,
      ])

      await exportRcmExcel({
        filename: `thalassemia_ipd_${ds1}_to_${ds2}.xlsx`,
        title: 'ผู้ป่วยใน Thalassemia - กองทุนโรคโลหิตจางธาลัสซีเมีย (ชนิดรุนแรง)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportItems.length.toLocaleString('th-TH')} รายการ)`,
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
    <div className="th-page">
      {/* ── 1. Clean Breadcrumb (No Eyebrow Pills) ── */}
      <nav className="th-breadcrumb" aria-label="breadcrumb">
        <Link href="/">หน้าหลัก</Link>
        <span className="th-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm">รายงาน RCM</Link>
        <span className="th-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
        <span className="th-breadcrumb-sep">/</span>
        <span className="th-breadcrumb-current">ผู้ป่วยใน Thalassemia</span>
      </nav>

      {/* ── 2. Header Bar ── */}
      <div className="th-header">
        <div className="th-title-group">
          <h1 className="th-title">ผู้ป่วยใน Thalassemia</h1>
          <p className="th-subtitle">
            <span>กองทุนโรคโลหิตจางธาลัสซีเมีย (ชนิดรุนแรง)</span>
            <span className="th-subtitle-dot">·</span>
            <span>ผู้ป่วยในที่ได้รับการให้เลือด (ICD-9 9904 หรือ ADP 232xxxx) หรือได้รับยาขับธาตุเหล็ก</span>
            <span className="th-subtitle-dot">·</span>
            <span>ติดตามผลตรวจ Lab Ferritin, Hb, Hct และการชดเชยค่าบริการ</span>
          </p>
        </div>

        <div className="th-actions">
          <button
            type="button"
            className="th-btn th-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'th-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}</span>
          </button>

          <button
            type="button"
            className="th-btn th-btn-secondary"
            onClick={exportToExcel}
            disabled={loading || isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. Single-Row Unified Date Selection Card ── */}
      <div className="th-date-card">
        <div className="th-date-segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`th-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`th-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`th-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="th-date-divider" aria-hidden="true" />

        <div className="th-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="th-control-group">
                <span className="th-control-label">จำหน่ายตั้งแต่วันที่:</span>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="th-control-group">
                <span className="th-control-label">ถึงวันที่:</span>
                <ThaiDatePicker
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
              <div className="th-control-group">
                <span className="th-control-label">เดือนที่จำหน่าย:</span>
                <select
                  className="th-select"
                  value={selectedMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value)
                    setSelectedMonth(m)
                    applyDateMode('monthly', selectedFiscalYear, m, selectedBeYear)
                    setCurrentPage(1)
                  }}
                >
                  {THAI_MONTHS.map((mo) => (
                    <option key={mo.value} value={mo.value}>
                      {mo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="th-control-group">
                <span className="th-control-label">ปี พ.ศ.:</span>
                <select
                  className="th-select"
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
            <div className="th-control-group">
              <span className="th-control-label">เลือกปีงบประมาณ:</span>
              <select
                className="th-select"
                value={selectedFiscalYear}
                onChange={(e) => {
                  const y = Number(e.target.value)
                  setSelectedFiscalYear(y)
                  applyDateMode('fiscal', y, selectedMonth, selectedBeYear)
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

      {/* ── 4. Equal & Balanced KPI Summary Grid (4 x 2) ── */}
      <div className="th-kpi-grid">
        {/* Card 1: ทั้งหมด */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('ALL')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ALL')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">ผู้ป่วยในทั้งหมด</span>
            <Activity size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.totalCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.uniquePatients.toLocaleString()} คน</span>
          </div>
        </div>

        {/* Card 2: ได้รับการให้เลือด (9904 / เลือด) */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'WITH_BLOOD' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_BLOOD')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_BLOOD')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">ได้รับการให้เลือด (9904)</span>
            <Droplet size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.bloodCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.totalBloodUnits.toLocaleString()} Unit</span>
          </div>
        </div>

        {/* Card 3: ได้รับยาขับเหล็ก */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'WITH_DRUG' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_DRUG')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_DRUG')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">ได้รับยาขับธาตุเหล็ก</span>
            <Pill size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.drugCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.drugRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 4: ตรวจ Ferritin */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'WITH_FERRITIN' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_FERRITIN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_FERRITIN')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">มีผลตรวจ Ferritin</span>
            <TestTube2 size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.ferritinCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.ferritinRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 5: ตรวจ Hb / Hct */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'WITH_HB_HCT' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_HB_HCT')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_HB_HCT')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">มีผลตรวจ Hb / Hct</span>
            <Layers size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.hbHctCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.hbHctRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 6: ชดเชยแล้ว */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('COMPENSATED')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">ชดเชยแล้ว</span>
            <ReceiptText size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.compensatedCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{formatMoney(summary.totalCompensated)} ฿</span>
          </div>
        </div>

        {/* Card 7: ยังไม่ชดเชย */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UNCOMPENSATED')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">ยังไม่ชดเชย / รอชดเชย</span>
            <ReceiptText size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.uncompensatedCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.totalCases > 0 ? ((summary.uncompensatedCases / summary.totalCases) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* Card 8: สิทธิบัตรทอง */}
        <div
          role="button"
          tabIndex={0}
          className={`th-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UC_ONLY')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UC_ONLY')}
        >
          <div className="th-kpi-card-header">
            <span className="th-kpi-label">สิทธิบัตรทอง (UC)</span>
            <ShieldCheck size={18} className="th-kpi-icon" />
          </div>
          <div className="th-kpi-value-row">
            <span className="th-kpi-value">{summary.ucCases.toLocaleString()}</span>
            <span className="th-kpi-sub">{summary.ucRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* ── 5. Toolbar with Search Input ── */}
      <div className="th-toolbar">
        <div className="th-search-box">
          <Search size={16} className="th-search-icon" />
          <input
            type="text"
            className="th-search-input"
            placeholder="ค้นหา HN, CID, ชื่อผู้ป่วย, AN, รหัสโรค, ยา, เลือด, สิทธิ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="th-search-clear"
              onClick={() => setSearch('')}
              title="ล้างข้อความค้นหา"
            >
              <X size={14} />
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

        <div className="th-toolbar-meta">
          <span>
            พบข้อมูลทั้งหมด <span className="th-count-badge">{totalCount.toLocaleString()}</span> รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <button
              type="button"
              className="th-badge th-badge-neutral"
              onClick={() => setCardFilter('ALL')}
              style={{ cursor: 'pointer' }}
            >
              <span>ล้างตัวกรองการ์ด</span>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── 6. Data Table ── */}
      <div className="th-table-container">
        <div className="th-table-scroll">
          <table className="th-table">
            <thead>
              <tr>
                <th className="col-center" style={{ width: '50px' }}>
                  ลำดับ
                </th>
                <th className="col-center" style={{ minWidth: '100px' }}>
                  <button
                    type="button"
                    className="th-th-sort"
                    onClick={() => handleSort('admdate')}
                  >
                    <span>วันรับรักษา</span>
                    {sortBy === 'admdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '100px' }}>
                  <button
                    type="button"
                    className="th-th-sort"
                    onClick={() => handleSort('dchdate')}
                  >
                    <span>วันจำหน่าย</span>
                    {sortBy === 'dchdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '90px' }}>
                  AN
                </th>
                <th className="col-center" style={{ minWidth: '85px' }}>
                  <button
                    type="button"
                    className="th-th-sort"
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
                <th className="col-center" style={{ minWidth: '130px' }}>
                  เลขประจำตัวประชาชน
                </th>
                <th className="col-center" style={{ minWidth: '180px' }}>
                  <button
                    type="button"
                    className="th-th-sort"
                    onClick={() => handleSort('ptname')}
                  >
                    <span>ชื่อ-สกุล</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '60px' }}>
                  เพศ
                </th>
                <th className="col-center" style={{ minWidth: '70px' }}>
                  อายุ
                </th>
                <th style={{ minWidth: '130px' }}>สิทธิการรักษา</th>
                <th className="col-center" style={{ minWidth: '90px' }}>
                  ICD-10
                </th>
                <th className="col-center" style={{ minWidth: '80px' }}>
                  ICD-9
                </th>
                <th style={{ minWidth: '160px' }}>ยาขับธาตุเหล็ก</th>
                <th style={{ minWidth: '150px' }}>ชนิดเลือด</th>
                <th className="col-center" style={{ minWidth: '60px' }}>
                  Unit
                </th>
                <th className="col-center" style={{ minWidth: '90px' }}>
                  Ferritin
                </th>
                <th className="col-center" style={{ minWidth: '80px' }}>
                  Hb / Hct
                </th>
                <th className="col-center" style={{ minWidth: '100px' }}>
                  เลขที่ Rep
                </th>
                <th className="col-center" style={{ minWidth: '110px' }}>
                  <button
                    type="button"
                    className="th-th-sort"
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
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                    {Array.from({ length: 19 }).map((__, colIdx) => (
                      <td key={colIdx} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={19} className="th-empty-state">
                    <div className="th-empty-title" style={{ color: '#dc2626' }}>
                      เกิดข้อผิดพลาด
                    </div>
                    <div className="th-empty-desc">{error}</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={19} className="th-empty-state">
                    <Droplet size={28} className="th-empty-icon" />
                    <div className="th-empty-title">ไม่พบข้อมูลที่ตรงตามเงื่อนไข</div>
                    <div className="th-empty-desc">
                      ลองเปลี่ยนตัวกรอง วันที่ หรือคำค้นหาใหม่อีกครั้ง
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                    <tr
                      key={row.an}
                      className="th-row-clickable"
                      onClick={() => handleRowClick(row)}
                      title="กดเพื่อเปิดดูรายละเอียดเวชระเบียนผู้ป่วยใน"
                    >
                      <td className="col-center th-num">{row.no}</td>
                      <td className="col-center th-num">
                        {formatThaiDate(row.admdate)}
                      </td>
                      <td className="col-center th-num">
                        {formatThaiDate(row.dchdate)}
                      </td>
                      <td className="col-center th-num">{row.an}</td>
                      <td className="col-center th-num">{row.hn}</td>
                      <td className="col-center th-cid">{row.cid}</td>
                      <td className="col-center th-ptname">{row.ptname}</td>
                      <td className="col-center">{row.sex}</td>
                      <td className="col-center th-age-nowrap">{row.age}&nbsp;ปี</td>
                      <td>
                        <span title={row.pttypename}>{row.pttypename || '—'}</span>
                      </td>
                      <td className="col-center">
                        <span className="th-badge th-badge-info">{row.icd10 || '—'}</span>
                      </td>
                      <td className="col-center">
                        {row.icd9 ? (
                          <span className="th-badge th-badge-neutral">{row.icd9}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {row.drugname ? (
                          <span className="th-badge th-badge-purple" title={row.drugname}>
                            {row.drugname}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {row.blood ? (
                          <span className="th-badge th-badge-amber" title={row.blood}>
                            {row.blood}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-center th-num">
                        {row.bloodQty > 0 ? row.bloodQty : '—'}
                      </td>
                      <td className="col-center th-num">
                        {row.ferritinResult ? (
                          <span title={`วันที่ตรวจ: ${row.ferritinDate || '—'}`}>
                            {row.ferritinResult}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-center th-num">
                        {row.hbResult || row.hctResult ? (
                          <span title={`Hb: ${row.hbResult || '—'} | Hct: ${row.hctResult || '—'}`}>
                            {row.hbResult || '—'} / {row.hctResult || '—'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-center">
                        {row.rep ? (
                          <span className="th-badge th-badge-success">{row.rep}</span>
                        ) : (
                          <span className="th-badge th-badge-neutral">รอ Rep</span>
                        )}
                      </td>
                      <td className="col-center th-num">
                        {row.compensated > 0 ? (
                          <span style={{ fontWeight: 600, color: '#047857' }}>
                            {formatMoney(row.compensated)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>

        {/* ── 7. Pagination Bar ── */}
        {!loading && items.length > 0 && (
          <div className="th-pagination">
            <div>
              กำลังแสดงหน้าที่ <span className="th-num">{currentPage}</span> จากทั้งหมด{' '}
              <span className="th-num">{totalPages}</span> หน้า
            </div>

            <div className="th-pagination-btns">
              <button
                type="button"
                className="th-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ย้อนกลับ
              </button>

              <button
                type="button"
                className="th-page-btn is-active"
              >
                {currentPage}
              </button>

              <button
                type="button"
                className="th-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 8. Inpatient Detail Modal (กดผ่าน record ดูข้อมูล) ── */}
      {selectedItem && (
        <div
          className="th-modal-overlay"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="th-modal" onClick={(e) => e.stopPropagation()}>
            <div className="th-modal-header">
              <div>
                <h3 className="th-modal-title">
                  {selectedItem.ptname} (HN: {selectedItem.hn})
                </h3>
                <p className="th-modal-subtitle">
                  <span>AN: {selectedItem.an}</span>
                  <span className="th-subtitle-dot">·</span>
                  <span>
                    Admit: {formatThaiDate(selectedItem.admdate)} – Discharge:{' '}
                    {formatThaiDate(selectedItem.dchdate)}
                  </span>
                  <span className="th-subtitle-dot">·</span>
                  <span>หอผู้ป่วย: {selectedItem.ward || '—'}</span>
                </p>
              </div>

              <button
                type="button"
                className="th-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="th-modal-tabs">
              <button
                type="button"
                className={`th-modal-tab ${modalTab === 'overview' ? 'is-active' : ''}`}
                onClick={() => setModalTab('overview')}
              >
                ภาพรวมผู้ป่วยใน & กองทุน
              </button>
              <button
                type="button"
                className={`th-modal-tab ${modalTab === 'orders' ? 'is-active' : ''}`}
                onClick={() => setModalTab('orders')}
              >
                รายการยา & การรักษาในเวชระเบียน ({anDetails?.orders?.length || 0})
              </button>
            </div>

            <div className="th-modal-body">
              {modalTab === 'overview' && (
                <>
                  <div className="th-detail-grid">
                    {/* ข้อมูลทั่วไป */}
                    <div className="th-detail-card">
                      <div className="th-detail-card-title">
                        <UserCheck size={16} />
                        <span>ข้อมูลส่วนบุคคล & สิทธิ</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">เลขบัตรประชาชน:</span>
                        <span className="th-detail-value th-cid">
                          {selectedItem.cid}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedItem.cid, 'cid')}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 6 }}
                            title="คัดลอก CID"
                          >
                            {copiedField === 'cid' ? <Check size={14} color="#047857" /> : <Copy size={14} color="#94a3b8" />}
                          </button>
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">HN / AN:</span>
                        <span className="th-detail-value th-num">{selectedItem.hn} / {selectedItem.an}</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">เพศ / อายุ:</span>
                        <span className="th-detail-value">{selectedItem.sex} / {selectedItem.age} ปี</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">สิทธิการรักษา:</span>
                        <span className="th-detail-value">{selectedItem.pttypename || '—'}</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">หอผู้ป่วย:</span>
                        <span className="th-detail-value">{selectedItem.ward || '—'}</span>
                      </div>
                    </div>

                    {/* ข้อมูลการรักษา & โรค */}
                    <div className="th-detail-card">
                      <div className="th-detail-card-title">
                        <Droplet size={16} />
                        <span>ข้อมูลการวินิจฉัย & กองทุน</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">รหัสโรค ICD-10:</span>
                        <span className="th-detail-value">
                          <span className="th-badge th-badge-info">{selectedItem.icd10 || '—'}</span>
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">หัตถการ ICD-9:</span>
                        <span className="th-detail-value">{selectedItem.icd9 || '—'}</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">เลขที่ Rep / Seamless:</span>
                        <span className="th-detail-value th-num">
                          {selectedItem.rep || selectedItem.seamless || '—'}
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">สถานะชดเชย:</span>
                        <span className="th-detail-value">
                          {selectedItem.status || (selectedItem.isCompensated ? 'ชดเชยแล้ว' : 'รอชดเชย')}
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">ยอดชดเชย:</span>
                        <span className="th-detail-value" style={{ color: '#047857', fontWeight: 600 }}>
                          {formatMoney(selectedItem.compensated)} บาท
                        </span>
                      </div>
                    </div>

                    {/* การให้เลือด & ยาขับเหล็ก */}
                    <div className="th-detail-card">
                      <div className="th-detail-card-title">
                        <Pill size={16} />
                        <span>ยาขับเหล็ก & การให้เลือด</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">ยาขับธาตุเหล็ก:</span>
                        <span className="th-detail-value">{selectedItem.drugname || '—'}</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">ชนิดเลือดที่ได้รับ:</span>
                        <span className="th-detail-value">{selectedItem.blood || '—'}</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">วันที่ให้เลือด:</span>
                        <span className="th-detail-value">
                          {selectedItem.bloodDate ? formatThaiDate(selectedItem.bloodDate) : '—'}
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">จำนวน Unit เลือด:</span>
                        <span className="th-detail-value th-num">{selectedItem.bloodQty > 0 ? `${selectedItem.bloodQty} Unit` : '—'}</span>
                      </div>
                    </div>

                    {/* ผลตรวจทางห้องปฏิบัติการ Lab */}
                    <div className="th-detail-card">
                      <div className="th-detail-card-title">
                        <TestTube2 size={16} />
                        <span>ผลตรวจทางห้องปฏิบัติการ (Lab)</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">ผล Ferritin:</span>
                        <span className="th-detail-value th-num">{selectedItem.ferritinResult || '—'}</span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">วันที่ตรวจ Ferritin:</span>
                        <span className="th-detail-value">
                          {selectedItem.ferritinDate ? formatThaiDate(selectedItem.ferritinDate) : '—'}
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">ผล Hb / วันที่ตรวจ:</span>
                        <span className="th-detail-value">
                          {selectedItem.hbResult || '—'}{' '}
                          {selectedItem.hbDate && `(${formatThaiDate(selectedItem.hbDate)})`}
                        </span>
                      </div>
                      <div className="th-detail-row">
                        <span className="th-detail-label">ผล Hct / วันที่ตรวจ:</span>
                        <span className="th-detail-value">
                          {selectedItem.hctResult || '—'}{' '}
                          {selectedItem.hctDate && `(${formatThaiDate(selectedItem.hctDate)})`}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'orders' && (
                <div>
                  {loadingAnDetails ? (
                    <div className="th-empty-state">
                      <RefreshCw size={24} className="th-spin th-empty-icon" />
                      <div>กำลังโหลดรายการยาและหัตถการผู้ป่วยใน...</div>
                    </div>
                  ) : !anDetails || !anDetails.orders || anDetails.orders.length === 0 ? (
                    <div className="th-empty-state">
                      <div>ไม่พบรายการยาหรือเวชภัณฑ์ในการนอนโรงพยาบาลนี้</div>
                    </div>
                  ) : (
                    <table className="th-orders-table">
                      <thead>
                        <tr>
                          <th>รหัส</th>
                          <th>รายการ</th>
                          <th>ความแรง</th>
                          <th style={{ textAlign: 'center' }}>จำนวน</th>
                          <th>หน่วย</th>
                          <th style={{ textAlign: 'right' }}>ราคา/หน่วย</th>
                          <th style={{ textAlign: 'right' }}>รวมเงิน</th>
                          <th>สถานะชำระ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anDetails.orders.map((ord, idx) => (
                          <tr key={`${ord.icode}-${idx}`}>
                            <td className="th-num">{ord.icode}</td>
                            <td>
                              <span style={{ fontWeight: ord.isDrug ? 600 : 400 }}>
                                {ord.itemName}
                              </span>
                            </td>
                            <td>{ord.strength || '—'}</td>
                            <td style={{ textAlign: 'center' }} className="th-num">
                              {ord.qty}
                            </td>
                            <td>{ord.units || '—'}</td>
                            <td style={{ textAlign: 'right' }} className="th-num">
                              {ord.unitprice.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }} className="th-num">
                              {ord.sumPrice.toFixed(2)}
                            </td>
                            <td>
                              <span className="th-badge th-badge-neutral">{ord.paidstName || '—'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <div className="th-modal-footer">
              <button
                type="button"
                className="th-btn th-btn-secondary"
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
