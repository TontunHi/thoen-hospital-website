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
  Leaf,
  Sparkles,
  Pill,
  HeartPulse,
  ReceiptText,
  UserCheck,
  Check,
  Activity,
  FileSpreadsheet,
  Building2,
} from 'lucide-react'
import type {
  Ttm3Item,
  Ttm3Summary,
  Ttm3CardFilter,
  Ttm3PlaceFilter,
  Ttm3SortField,
  Ttm3ReportResult,
  TtmHerbDrugItem,
} from '@/lib/clinical/rcmThaiTraditionalMedicineService'
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
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface ThaiTraditionalMedicine3ClientProps {
  initialData?: Ttm3ReportResult | null
}

export default function ThaiTraditionalMedicine3Client({
  initialData = null,
}: ThaiTraditionalMedicine3ClientProps) {
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
  const [cardFilter, setCardFilter] = useState<Ttm3CardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [placeFilter, setPlaceFilter] = useState<Ttm3PlaceFilter>(
    initialData?.place ?? 'ALL'
  )
  const [treatmentType, setTreatmentType] = useState<string>('')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [ucOnly, setUcOnly] = useState<boolean>(initialData?.ucOnly ?? false)
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<Ttm3SortField>(
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
  const [items, setItems] = useState<Ttm3Item[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [summary, setSummary] = useState<Ttm3Summary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      treatmentDrugCount: 0,
      treatmentMassageCount: 0,
      treatmentCompressCount: 0,
      treatmentOtherCount: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      inHospCount: 0,
      outHospCount: 0,
      ucCount: 0,
      totalIncome: 0,
    }
  )

  // Detail Modal states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<Ttm3Item | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [herbalDrugs, setHerbalDrugs] = useState<TtmHerbDrugItem[]>([])
  const [loadingDrugs, setLoadingDrugs] = useState<boolean>(false)
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
          place: placeFilter,
          ucOnly: String(ucOnly),
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
        if (treatmentType) queryParams.set('treatmentType', treatmentType)
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/thai-traditional-medicine/3?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `HTTP ${res.status} เกิดข้อผิดพลาดในการโหลดข้อมูล`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          setItems(json.data.items || [])
          setTotalCount(json.data.totalCount || 0)
          setTotalPages(json.data.totalPages || 1)
          setSummary(json.data.summary)
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
    [
      ds1,
      ds2,
      cardFilter,
      placeFilter,
      treatmentType,
      pttypes,
      ucOnly,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  )

  // Skip first mount fetch if initialData is provided
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Fetch clinical VN details when modal opens and switches to clinical tab
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/thai-traditional-medicine/vn-details?vn=${vn}`)
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

  // Fetch herbal drug items prescribed in this VN (matching FoxPro ShowDrug)
  const fetchHerbalDrugs = useCallback(async (vn: string) => {
    setLoadingDrugs(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/thai-traditional-medicine/herbal-drugs?vn=${vn}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setHerbalDrugs(json.data)
      } else {
        setHerbalDrugs([])
      }
    } catch {
      setHerbalDrugs([])
    } finally {
      setLoadingDrugs(false)
    }
  }, [])

  // Handle row click (open detail modal directly)
  const handleRowClick = (item: Ttm3Item) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
    setHerbalDrugs([])
    if (item.treatment1 === 'Y' || item.herbDrugs) {
      fetchHerbalDrugs(item.vn)
    }
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
      // Keep current ds1, ds2
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

  const handleFiscalYearChange = (beFiscal: number) => {
    setSelectedFiscalYear(beFiscal)
    setCurrentPage(1)
    const ceFiscal = beFiscal - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
  }

  // Handle Card Filter
  const handleCardFilter = (filterKey: Ttm3CardFilter) => {
    setCardFilter((prev) => (prev === filterKey ? 'ALL' : filterKey))
    setCurrentPage(1)
  }

  // Handle Table Sorting
  const handleSort = (field: Ttm3SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        place: placeFilter,
        ucOnly: String(ucOnly),
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
      if (treatmentType) queryParams.set('treatmentType', treatmentType)

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/thai-traditional-medicine/3?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')
      }

      const rowsData: Ttm3Item[] = json.data.items

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'CID',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'วันที่รับบริการ',
        'เวลา',
        'สถานที่',
        'สิทธิการรักษา',
        'ClaimCode',
        'ยา (T1)',
        'นวด (T2)',
        'ประคบ (T3)',
        'อบ (T4)',
        'ทับหม้อเกลือ (T5)',
        'สมาธิบำบัด (T6)',
        'อื่นๆ (T7)',
        'รายการการรักษา',
        'ยาสมุนไพร',
        'PDX',
        'ค่ารักษา (บาท)',
        'สถานะชดเชย',
        'เลขที่ Rep',
        'ยอดชดเชย (บาท)',
        'Seamless Payno',
        'Seamless ชดเชย (บาท)',
      ]

      const rows = rowsData.map((r, idx) => [
        idx + 1,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        r.age,
        r.vstdate,
        r.vsttime,
        r.placeLabel,
        r.pttypename,
        r.authencode || '',
        r.treatment1,
        r.treatment2,
        r.treatment3,
        r.treatment4,
        r.treatment5,
        r.treatment6,
        r.treatment7,
        r.treatmentNames || '',
        r.herbDrugs || '',
        r.pdx || '',
        r.income,
        r.status || '',
        r.rep || '',
        r.compensated,
        r.seamlessPayno || '',
        r.seamlessCompensated ?? '',
      ])

      await exportRcmExcel({
        filename: `TTM_Topic3_Report_${ds1}_to_${ds2}.xlsx`,
        title: 'รายชื่อผู้รับบริการแพทย์แผนไทยรวม',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${rowsData.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="ttm-container">
      {/* ── 1. Page Header ── */}
      <div className="ttm-header">
        <div className="ttm-header-left">
          <div className="ttm-breadcrumb">
            <Link href="/service/dashboard-rcm" className="ttm-breadcrumb-link">
              Dashboard RCM
            </Link>
            <span className="ttm-breadcrumb-sep">/</span>
            <Link href="/service/dashboard-rcm/funds" className="ttm-breadcrumb-link">
              กองทุน
            </Link>
            <span className="ttm-breadcrumb-sep">/</span>
            <span className="ttm-breadcrumb-current">
              รายชื่อผู้รับบริการแพทย์แผนไทยรวม
            </span>
          </div>
          <h1 className="ttm-title">รายชื่อผู้รับบริการแพทย์แผนไทยรวม</h1>
          <p className="ttm-subtitle">
            บริการแพทย์แผนไทย และการแพทย์ทางเลือก • ทะเบียนผู้รับบริการ จำแนกการรักษา 7 ด้าน
            (ยา, นวด, ประคบ, อบ, ทับหม้อเกลือ, สมาธิบำบัด, อื่นๆ) และสถานะการชดเชย
          </p>
        </div>

        <div className="ttm-header-actions">
          <button
            type="button"
            className="ttm-btn ttm-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="ttm-btn ttm-btn-primary"
            onClick={handleExportExcel}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} className={isExporting ? 'animate-spin' : ''} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Unified Single-Row Date Selector ── */}
      <div className="ttm-date-card">
        <div className="ttm-date-row">
          {/* Mode Switcher Tabs */}
          <div className="ttm-date-tabs">
            <button
              type="button"
              className={`ttm-date-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`ttm-date-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              className={`ttm-date-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="ttm-date-divider" />

          {/* Date Range Inputs */}
          {dateMode === 'custom' && (
            <div className="ttm-date-inputs">
              <span className="ttm-date-label">ตั้งแต่:</span>
              <ThaiDatePicker
                value={ds1}
                onChange={(v) => {
                  setDs1(v)
                  setCurrentPage(1)
                }}
              />
              <span className="ttm-date-label">ถึง:</span>
              <ThaiDatePicker
                value={ds2}
                onChange={(v) => {
                  setDs2(v)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="ttm-date-inputs">
              <span className="ttm-date-label">เดือน:</span>
              <select
                className="ttm-date-select"
                value={selectedMonth}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedBeYear)}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <span className="ttm-date-label">ปี:</span>
              <select
                className="ttm-date-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dateMode === 'fiscal' && (
            <div className="ttm-date-inputs">
              <span className="ttm-date-label">ปีงบประมาณ:</span>
              <select
                className="ttm-date-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
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
      </div>

      {/* ── 3. Symmetrical 4-Column x 2-Row KPI Grid (8 Cards) ── */}
      <div className="ttm-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('ALL')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">ผู้รับบริการทั้งหมด</span>
            <div className="ttm-kpi-icon icon-primary">
              <Leaf size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val">{summary.totalVisits.toLocaleString('th-TH')}</span>
            <span className="ttm-kpi-sub">
              {summary.uniquePatients.toLocaleString('th-TH')} คน ({summary.inHospCount} ใน รพ. / {summary.outHospCount} นอก)
            </span>
          </div>
        </div>

        {/* Card 2: ได้รับยาสมุนไพร */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'TREATMENT_DRUG' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('TREATMENT_DRUG')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะผู้ที่ได้รับยาสมุนไพร"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">จ่ายยาสมุนไพร (ยา)</span>
            <div className="ttm-kpi-icon icon-success">
              <Pill size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val text-success">
              {summary.treatmentDrugCount.toLocaleString('th-TH')}
            </span>
            <span className="ttm-kpi-sub">
              {summary.totalVisits > 0
                ? ((summary.treatmentDrugCount / summary.totalVisits) * 100).toFixed(1)
                : 0}
              % ของผู้รับบริการ
            </span>
          </div>
        </div>

        {/* Card 3: นวดไทย */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'TREATMENT_MASSAGE' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('TREATMENT_MASSAGE')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะการนวดไทย"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">การนวดไทย (นวด)</span>
            <div className="ttm-kpi-icon icon-info">
              <Activity size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val">{summary.treatmentMassageCount.toLocaleString('th-TH')}</span>
            <span className="ttm-kpi-sub">
              {summary.totalVisits > 0
                ? ((summary.treatmentMassageCount / summary.totalVisits) * 100).toFixed(1)
                : 0}
              % ให้บริการนวดไทย
            </span>
          </div>
        </div>

        {/* Card 4: ประคบสมุนไพร */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'TREATMENT_COMPRESS' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('TREATMENT_COMPRESS')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะการประคบสมุนไพร"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">ประคบสมุนไพร (ประคบ)</span>
            <div className="ttm-kpi-icon icon-accent">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val">{summary.treatmentCompressCount.toLocaleString('th-TH')}</span>
            <span className="ttm-kpi-sub">
              {summary.totalVisits > 0
                ? ((summary.treatmentCompressCount / summary.totalVisits) * 100).toFixed(1)
                : 0}
              % ให้บริการประคบ
            </span>
          </div>
        </div>

        {/* Card 5: อบ/ทับหม้อเกลือ/อื่นๆ */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'TREATMENT_OTHER' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('TREATMENT_OTHER')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองการอบ/ทับหม้อเกลือ/สมาธิบำบัด/อื่นๆ"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">อบ / ทับหม้อ / อื่นๆ</span>
            <div className="ttm-kpi-icon icon-neutral">
              <HeartPulse size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val">{summary.treatmentOtherCount.toLocaleString('th-TH')}</span>
            <span className="ttm-kpi-sub">อบ, ทับหม้อเกลือ, สมาธิ</span>
          </div>
        </div>

        {/* Card 6: ชดเชยแล้ว */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('COMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">ชดเชยแล้ว</span>
            <div className="ttm-kpi-icon icon-success">
              <ReceiptText size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val text-success">
              {summary.compensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="ttm-kpi-sub">
              {formatMoney(summary.totalCompensated)} บาท ({summary.compensationRate.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Card 7: ยังไม่ชดเชย / รอส่งเบิก */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้รับการชดเชย"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">ยังไม่ชดเชย</span>
            <div className="ttm-kpi-icon icon-warn">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val text-danger">
              {summary.uncompensatedVisits.toLocaleString('th-TH')}
            </span>
            <span className="ttm-kpi-sub">
              {(100 - summary.compensationRate).toFixed(1)}% รอผลการชดเชย
            </span>
          </div>
        </div>

        {/* Card 8: มี ClaimCode */}
        <div
          className={`ttm-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilter('WITH_AUTHEN')}
          role="button"
          tabIndex={0}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="ttm-kpi-header">
            <span className="ttm-kpi-title">มี ClaimCode</span>
            <div className="ttm-kpi-icon icon-info">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="ttm-kpi-body">
            <span className="ttm-kpi-val">{summary.withAuthenCount.toLocaleString('th-TH')}</span>
            <span className="ttm-kpi-sub">{summary.authenRate.toFixed(1)}% ยืนยันตัวตนแล้ว</span>
          </div>
        </div>
      </div>

      {/* ── 4. Search & Filters Bar ── */}
      <div className="ttm-filter-bar">
        <div className="ttm-search-box">
          <Search size={16} className="ttm-search-icon" />
          <input
            type="text"
            className="ttm-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ยาสมุนไพร, การรักษา, ClaimCode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="ttm-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="ttm-secondary-filters">
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {/* สถานที่ */}
          <select
            className="ttm-select-filter"
            value={placeFilter}
            onChange={(e) => {
              setPlaceFilter(e.target.value as Ttm3PlaceFilter)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">สถานที่: ทั้งหมด</option>
            <option value="IN_HOSP">สถานที่: ในสถานบริการ (รพ.)</option>
            <option value="OUT_HOSP">สถานที่: นอกสถานบริการ</option>
          </select>

          {/* ด้านการรักษา */}
          <select
            className="ttm-select-filter"
            value={treatmentType}
            onChange={(e) => {
              setTreatmentType(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">การรักษา: ทุกประเภท</option>
            <option value="1">1. ยาสมุนไพร</option>
            <option value="2">2. นวดไทย</option>
            <option value="3">3. ประคบสมุนไพร</option>
            <option value="4">4. อบสมุนไพร</option>
            <option value="5">5. ทับหม้อเกลือ</option>
            <option value="6">6. สมาธิบำบัด</option>
            <option value="7">7. อื่นๆ</option>
          </select>

          {/* สิทธิบัตรทอง */}
          <label className="ttm-checkbox-label">
            <input
              type="checkbox"
              className="ttm-checkbox"
              checked={ucOnly}
              onChange={(e) => {
                setUcOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะสิทธิบัตรทอง</span>
          </label>

          {cardFilter !== 'ALL' && (
            <div className="ttm-active-filter-badge">
              <span>ฟิลเตอร์: <strong>{cardFilter}</strong></span>
              <button
                type="button"
                className="ttm-active-filter-clear"
                onClick={() => setCardFilter('ALL')}
                title="ยกเลิกฟิลเตอร์การ์ด"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Data Table Section ── */}
      <div className="ttm-table-card">
        <div className="ttm-table-meta">
          <div>
            พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
            {loading && <span className="text-muted" style={{ marginLeft: 8 }}>กำลังโหลดข้อมูล...</span>}
          </div>
          <div className="ttm-row-hint">
            * คลิกที่แถวเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย
          </div>
        </div>

        {error && (
          <div className="ttm-empty-state">
            <AlertTriangle size={32} className="text-danger" />
            <div className="ttm-empty-title">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
            <div className="ttm-empty-desc">{error}</div>
            <button
              type="button"
              className="ttm-btn ttm-btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => fetchData()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="ttm-loading-card">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span>กำลังประมวลผลข้อมูลผู้รับบริการแพทย์แผนไทยรวม...</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="ttm-empty-state">
            <Leaf size={36} className="ttm-empty-icon" />
            <div className="ttm-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
            <div className="ttm-empty-desc">
              ไม่พบรายการผู้รับบริการแพทย์แผนไทยในช่วงเวลาหรือฟิลเตอร์ที่กำหนด กรุณาลองปรับช่วงวันที่หรือคำค้นหา
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="ttm-table-scroll">
            <table className="ttm-table">
              <thead>
                <tr>
                  <th className="col-center">ลำดับ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm-sort-btn"
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
                      className="ttm-sort-btn"
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
                      className="ttm-sort-btn"
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
                      className="ttm-sort-btn"
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
                  <th className="col-center">สถานที่</th>
                  <th className="col-center">สิทธิการรักษา</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm-sort-btn"
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
                  {/* 7 ด้านการรักษา */}
                  <th className="col-center" title="จ่ายยาสมุนไพร">ยา</th>
                  <th className="col-center" title="การนวดไทย">นวด</th>
                  <th className="col-center" title="การประคบสมุนไพร">ประคบ</th>
                  <th className="col-center" title="การอบไอน้ำสมุนไพร">อบ</th>
                  <th className="col-center" title="การทับหม้อเกลือ">ทับหม้อ</th>
                  <th className="col-center" title="สมาธิบำบัด">สมาธิ</th>
                  <th className="col-center" title="การรักษาอื่นๆ">อื่นๆ</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm-sort-btn"
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
                  <th className="col-center">สถานะชดเชย</th>
                  <th className="col-center">
                    <button
                      type="button"
                      className="ttm-sort-btn"
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
                    className="ttm-row-clickable"
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อเปิดดูรายละเอียดเวชระเบียนและข้อมูลการชดเชย"
                  >
                    <td className="col-center ttm-num">{item.no}</td>
                    <td className="col-center ttm-num">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center ttm-num">{item.vsttime || '—'}</td>
                    <td className="col-center ttm-num font-mono">{item.hn}</td>
                    <td className="col-center ttm-num font-mono">{item.cid}</td>
                    <td className="col-center">
                      <div className="ttm-patient-name">
                        <span className="ttm-name-part">{item.ptname}</span>
                      </div>
                    </td>
                    <td className="col-center ttm-num">{item.age}&nbsp;ปี</td>
                    <td className="col-center">
                      <span className={`ttm-badge ${item.place === 'Y' ? 'ttm-badge-ok' : 'ttm-badge-info'}`}>
                        {item.placeLabel}
                      </span>
                    </td>
                    <td className="col-center">
                      <span className={`ttm-badge ${item.isUc ? 'ttm-badge-ok' : 'ttm-badge-neutral'}`}>
                        {item.pttypename}
                      </span>
                    </td>
                    <td className="col-center font-mono">
                      {item.authencode ? (
                        <span className="ttm-badge ttm-badge-ok">{item.authencode}</span>
                      ) : (
                        <span className="ttm-badge ttm-badge-warn">ไม่มี</span>
                      )}
                    </td>

                    {/* 7 Checkboxes */}
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment1 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                        title={item.treatment1 === 'Y' ? item.herbDrugs || 'จ่ายยาสมุนไพร' : 'ไม่มี'}
                      >
                        {item.treatment1 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment2 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                      >
                        {item.treatment2 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment3 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                      >
                        {item.treatment3 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment4 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                      >
                        {item.treatment4 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment5 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                      >
                        {item.treatment5 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment6 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                      >
                        {item.treatment6 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>
                    <td className="col-center">
                      <span
                        className={`ttm-treatment-cell ${
                          item.treatment7 === 'Y' ? 'ttm-treatment-yes' : 'ttm-treatment-no'
                        }`}
                      >
                        {item.treatment7 === 'Y' ? <Check size={14} className="inline-block text-emerald-700" /> : '—'}
                      </span>
                    </td>

                    <td className="col-center font-mono font-bold">{item.pdx || '—'}</td>

                    <td className="col-center">
                      <span
                        className={`ttm-badge ${
                          item.isCompensated
                            ? 'ttm-badge-ok'
                            : item.status && !item.status.includes('ยังไม่ได้ส่ง')
                            ? 'ttm-badge-info'
                            : 'ttm-badge-warn'
                        }`}
                      >
                        {item.status || 'ยังไม่ได้ส่ง'}
                      </span>
                    </td>

                    <td className="col-center ttm-num font-semibold">
                      {item.isCompensated ? (
                        <span className="text-success">{formatMoney(item.compensated)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 6. Pagination Controls ── */}
        {!loading && items.length > 0 && (
          <div className="ttm-pagination">
            <div className="ttm-pagination-info">
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString('th-TH')} รายการ)
            </div>

            <div className="ttm-pagination-controls">
              <button
                type="button"
                className="ttm-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                หน้าแรก
              </button>
              <button
                type="button"
                className="ttm-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="ttm-page-status">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="ttm-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="ttm-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="หน้าสุดท้าย"
              >
                หน้าสุดท้าย
              </button>

              <select
                className="ttm-page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                aria-label="จำนวนรายการต่อหน้า"
              >
                <option value={25}>25 รายการ/หน้า</option>
                <option value={50}>50 รายการ/หน้า</option>
                <option value={100}>100 รายการ/หน้า</option>
                <option value={200}>200 รายการ/หน้า</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Patient Detail Modal (Triggered by Clicking Row) ── */}
      {selectedItem && (
        <div className="ttm-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="ttm-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ttm-modal-title"
          >
            {/* Modal Header */}
            <div className="ttm-modal-header">
              <div className="ttm-modal-header-info">
                <div className="ttm-modal-title-row">
                  <Leaf size={22} className="text-primary" />
                  <h2 id="ttm-modal-title" className="ttm-modal-title">
                    {selectedItem.ptname}
                  </h2>
                  <span className="ttm-modal-age">{selectedItem.age} ปี</span>
                </div>
                <div className="ttm-modal-meta">
                  <span>
                    HN: <strong className="font-mono">{selectedItem.hn}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    CID: <strong className="font-mono">{selectedItem.cid}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    VN: <strong className="font-mono">{selectedItem.vn}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    วันที่รับบริการ:{' '}
                    <strong>
                      {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="ttm-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="ttm-modal-tabs">
              <button
                type="button"
                className={`ttm-modal-tab ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลบริการ & การชดเชย
              </button>
              <button
                type="button"
                className={`ttm-modal-tab ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                ประวัติเวชระเบียนคลินิก
              </button>
            </div>

            {/* Modal Content */}
            <div className="ttm-modal-body">
              {modalTab === 'summary' && (
                <div className="ttm-modal-grid">
                  {/* Section 1: ข้อมูลผู้รับบริการ & สิทธิ์ */}
                  <div className="ttm-modal-section">
                    <h3 className="ttm-section-title">ข้อมูลผู้รับบริการ & สิทธิ์</h3>
                    <div className="ttm-info-list">
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">ชื่อ-สกุล</span>
                        <span className="ttm-info-val font-semibold">{selectedItem.ptname}</span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">เลขบัตรประชาชน</span>
                        <span className="ttm-info-val font-mono">
                          <button
                            type="button"
                            className="ttm-copy-inline"
                            onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                            title="คลิกเพื่อคัดลอก CID"
                          >
                            <span>{selectedItem.cid}</span>
                            {copiedField === 'cid' && (
                              <span className="ttm-copy-feedback">คัดลอกแล้ว</span>
                            )}
                          </button>
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">เพศ / อายุ</span>
                        <span className="ttm-info-val">
                          {selectedItem.sex} • {selectedItem.age} ปี
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">สิทธิการรักษา</span>
                        <span className="ttm-info-val">
                          <span
                            className={`ttm-badge ${
                              selectedItem.isUc ? 'ttm-badge-ok' : 'ttm-badge-neutral'
                            }`}
                          >
                            {selectedItem.pttypename}
                          </span>
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">ClaimCode:</span>
                        <span className="ttm-info-val font-mono">
                          {selectedItem.authencode ? (
                            <span className="ttm-badge ttm-badge-ok">
                              {selectedItem.authencode}
                            </span>
                          ) : (
                            <span className="ttm-badge ttm-badge-warn">ไม่มี</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: ข้อมูลการรับบริการ & สถานที่ */}
                  <div className="ttm-modal-section">
                    <h3 className="ttm-section-title">ข้อมูลการรับบริการ & สถานที่</h3>
                    <div className="ttm-info-list">
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">วันที่รับบริการ (VN)</span>
                        <span className="ttm-info-val font-mono">
                          {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">วันที่ให้บริการแผนไทย</span>
                        <span className="ttm-info-val">
                          {selectedItem.servicedate
                            ? formatThaiDate(selectedItem.servicedate)
                            : '—'}
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">สถานที่ให้บริการ</span>
                        <span className="ttm-info-val">
                          <span
                            className={`ttm-badge ${
                              selectedItem.place === 'Y' ? 'ttm-badge-ok' : 'ttm-badge-info'
                            }`}
                          >
                            {selectedItem.placeLabel}
                          </span>
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">แผนก / แผนกหลัก</span>
                        <span className="ttm-info-val">{selectedItem.department || '—'}</span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">คลินิก</span>
                        <span className="ttm-info-val">{selectedItem.clinic || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: การรักษา 7 ด้าน (Full width) */}
                  <div className="ttm-modal-section col-span-2">
                    <h3 className="ttm-section-title">การให้บริการแพทย์แผนไทย 7 ด้าน</h3>
                    <div className="ttm-treatments-checklist">
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment1 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment1 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>1. ยาแผนไทยและสมุนไพร</span>
                      </div>
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment2 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment2 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>2. การนวดไทย</span>
                      </div>
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment3 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment3 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>3. การประคบสมุนไพร</span>
                      </div>
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment4 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment4 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>4. การอบไอน้ำสมุนไพร / การอบสมุนไพร</span>
                      </div>
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment5 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment5 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>5. การทับหม้อเกลือ</span>
                      </div>
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment6 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment6 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>6. สมาธิบำบัด</span>
                      </div>
                      <div
                        className={`ttm-treatment-check-item ${
                          selectedItem.treatment7 === 'Y' ? 'is-checked' : 'is-unchecked'
                        }`}
                      >
                        <span>{selectedItem.treatment7 === 'Y' ? <Check size={14} className="inline-block text-emerald-700 mr-1" /> : '—'}</span>
                        <span>7. การรักษาอื่นๆ</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: รายการยาสมุนไพรที่ได้รับ (FoxPro ShowDrug) */}
                  {(selectedItem.treatment1 === 'Y' ||
                    selectedItem.herbDrugs ||
                    herbalDrugs.length > 0) && (
                    <div className="ttm-modal-section col-span-2">
                      <h3 className="ttm-section-title">
                        รายการยาสมุนไพรที่สั่งจ่ายในครั้งนี้
                      </h3>

                      {loadingDrugs ? (
                        <div className="ttm-loading-card">
                          <RefreshCw size={16} className="animate-spin text-primary" />
                          <span>กำลังดึงรายการยา...</span>
                        </div>
                      ) : herbalDrugs.length > 0 ? (
                        <table className="ttm-drug-table">
                          <thead>
                            <tr>
                              <th className="col-left">รายการยา</th>
                              <th className="col-center">จำนวน</th>
                              <th className="col-center">หน่วยนับ</th>
                              <th className="col-right">ราคาต่อหน่วย</th>
                              <th className="col-right">รวมเงิน (บาท)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {herbalDrugs.map((d, dIdx) => (
                              <tr key={dIdx}>
                                <td className="col-left font-semibold">{d.drug}</td>
                                <td className="col-center ttm-num">{d.qty}</td>
                                <td className="col-center">{d.units || '—'}</td>
                                <td className="col-right ttm-num">{formatMoney(d.unitprice)}</td>
                                <td className="col-right ttm-num font-semibold">
                                  {formatMoney(d.sumprice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : selectedItem.herbDrugs ? (
                        <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                          {selectedItem.herbDrugs}
                        </div>
                      ) : (
                        <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                          ไม่มีรายการยาสมุนไพร
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 5: การวินิจฉัยโรค (Diagnoses) */}
                  <div className="ttm-modal-section">
                    <h3 className="ttm-section-title">การวินิจฉัยโรค</h3>
                    <div className="ttm-info-list">
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">PDX (โรคหลัก)</span>
                        <span className="ttm-info-val font-mono font-bold">
                          {selectedItem.pdx || '—'}
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">รหัสโรครอง (DX0–DX5)</span>
                        <span className="ttm-info-val font-mono">
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
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">ค่ารักษาพยาบาล (Income)</span>
                        <span className="ttm-info-val font-semibold ttm-num">
                          {formatMoney(selectedItem.income)} บาท
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: ข้อมูลการชดเชย & Seamless */}
                  <div className="ttm-modal-section">
                    <h3 className="ttm-section-title">ข้อมูลการชดเชย & Seamless</h3>
                    <div className="ttm-info-list">
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">สถานะการชดเชย</span>
                        <span className="ttm-info-val">
                          <span
                            className={`ttm-badge ${
                              selectedItem.isCompensated
                                ? 'ttm-badge-ok'
                                : selectedItem.status &&
                                  !selectedItem.status.includes('ยังไม่ได้ส่ง')
                                ? 'ttm-badge-info'
                                : 'ttm-badge-warn'
                            }`}
                          >
                            {selectedItem.status || 'ยังไม่ได้ส่ง'}
                          </span>
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">เลขที่ Rep</span>
                        <span className="ttm-info-val font-mono">{selectedItem.rep || '—'}</span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">ยอดเงินชดเชย</span>
                        <span className="ttm-info-val font-bold text-success ttm-num">
                          {selectedItem.isCompensated
                            ? `${formatMoney(selectedItem.compensated)} บาท`
                            : '—'}
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">Seamless Payno</span>
                        <span className="ttm-info-val font-mono">
                          {selectedItem.seamlessPayno || '—'}
                        </span>
                      </div>
                      <div className="ttm-info-item">
                        <span className="ttm-info-label">Seamless ชดเชย</span>
                        <span className="ttm-info-val ttm-num">
                          {selectedItem.seamlessCompensated != null
                            ? `${formatMoney(selectedItem.seamlessCompensated)} บาท`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Clinical Details */}
              {modalTab === 'clinical' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {loadingVnDetails && (
                    <div className="ttm-loading-card">
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>กำลังโหลดประวัติเวชระเบียนคลินิก...</span>
                    </div>
                  )}

                  {!loadingVnDetails && vnDetails && (
                    <>
                      {/* Clinical Diagnoses */}
                      <div className="ttm-modal-section">
                        <h3 className="ttm-section-title">
                          รายการวินิจฉัยโรคทั้งหมด ({vnDetails.diagnoses.length} รายการ)
                        </h3>
                        {vnDetails.diagnoses.length === 0 ? (
                          <div className="text-muted">ไม่พบข้อมูลการวินิจฉัย</div>
                        ) : (
                          <table className="ttm-drug-table">
                            <thead>
                              <tr>
                                <th className="col-center">ประเภท</th>
                                <th className="col-center">ICD-10</th>
                                <th className="col-left">ชื่อโรค</th>
                                <th className="col-left">แพทย์ผู้ตรวจ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.diagnoses.map((d, idx) => (
                                <tr key={idx}>
                                  <td className="col-center">{d.diagtype_name}</td>
                                  <td className="col-center font-mono font-bold">{d.icd10}</td>
                                  <td className="col-left">{d.icd_name}</td>
                                  <td className="col-left">{d.doctor_name || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Clinical Doctor Orders & Drugs */}
                      <div className="ttm-modal-section">
                        <h3 className="ttm-section-title">
                          คำสั่งการรักษาและรายการยา/เวชภัณฑ์ ({vnDetails.orders.items.length} รายการ)
                        </h3>
                        {vnDetails.orders.items.length === 0 ? (
                          <div className="text-muted">ไม่มีคำสั่งยาหรือเวชภัณฑ์ในครั้งนี้</div>
                        ) : (
                          <table className="ttm-drug-table">
                            <thead>
                              <tr>
                                <th className="col-left">รายการ</th>
                                <th className="col-center">จำนวน</th>
                                <th className="col-center">หน่วยนับ</th>
                                <th className="col-right">ราคา/หน่วย</th>
                                <th className="col-right">รวมเงิน (บาท)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.orders.items.map((o, idx) => (
                                <tr key={idx}>
                                  <td className="col-left">
                                    <span className="font-semibold">{o.item_name}</span>
                                    {o.strength && (
                                      <span className="text-muted" style={{ marginLeft: 6 }}>
                                        {o.strength}
                                      </span>
                                    )}
                                  </td>
                                  <td className="col-center ttm-num">{o.qty}</td>
                                  <td className="col-center">{o.units || '—'}</td>
                                  <td className="col-right ttm-num">{formatMoney(o.unitprice)}</td>
                                  <td className="col-right ttm-num font-semibold">
                                    {formatMoney(o.sum_price)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </>
                  )}

                  {!loadingVnDetails && !vnDetails && (
                    <div className="ttm-empty-state">
                      <AlertTriangle size={32} className="text-muted" />
                      <div className="ttm-empty-title">ไม่พบรายละเอียดเวชระเบียนเพิ่มเติม</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
