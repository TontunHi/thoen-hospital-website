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
  Heart,
  ShieldCheck,
  Calendar,
  CreditCard,
  Building2,
  Stethoscope,
  Activity,
  FileText,
  AlertCircle,
} from 'lucide-react'
import type {
  FamilyPlanning91Item as FamilyPlanningItem,
  FamilyPlanning91Summary as FamilyPlanningSummary,
  FamilyPlanningFormat,
  FamilyPlanning91CardFilter as FamilyPlanningCardFilter,
  FamilyPlanning91SearchField as FamilyPlanningSearchField,
  FamilyPlanning91SortField as FamilyPlanningSortField,
  FamilyPlanningAdpMappingCheck,
} from '@/lib/clinical/rcmFamilyPlanningService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
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
  if (val == null || isNaN(val)) return '0.00'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

export interface FamilyPlanning91ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function FamilyPlanning91Client({
  initialData,
  initialRange,
}: FamilyPlanning91ClientProps = {}) {
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

  // Date Selection States (Default to Custom)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter States
  const [format, setFormat] = useState<FamilyPlanningFormat>('NEW_ECLAIM')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [serviceOnly, setServiceOnly] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('ALL')
  const [errorFilter, setErrorFilter] = useState<string>('ALL')
  const [cardFilter, setCardFilter] = useState<FamilyPlanningCardFilter>('ALL')
  const [searchField, setSearchField] = useState<FamilyPlanningSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<FamilyPlanningSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data States
  const [loading, setLoading] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FamilyPlanningItem[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [statusOptions, setStatusOptions] = useState<string[]>(initialData?.statusOptions || [])
  const [errorOptions, setErrorOptions] = useState<string[]>(initialData?.errorOptions || [])
  const [adpMapping, setAdpMapping] = useState<FamilyPlanningAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      format: 'NEW_ECLAIM',
      items: [],
    }
  )
  const [summary, setSummary] = useState<FamilyPlanningSummary>(
    initialData?.summary || {
      totalVisits: 0,
      uniquePatients: 0,
      serviceOnlyCount: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      errorCount: 0,
      authenCount: 0,
      withoutAuthenCount: 0,
      noAuthenCount: 0,
      withDxCount: 0,
      withDrugCount: 0,
      totalIncome: 0,
      totalDiscount: 0,
      totalPaidMoney: 0,
      totalRemain: 0,
    }
  )

  // Inspection Modal States
  const [selectedItem, setSelectedItem] = useState<FamilyPlanningItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Search Debounce (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Recalculate Date Range when Mode/Year/Month changes
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

  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Fetch Report Data
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      if (forceRefresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const q = new URLSearchParams({
          ds1,
          ds2,
          format,
          serviceOnly: String(serviceOnly),
          status,
          cardFilter,
          errorFilter,
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

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/family-planning/service-9-1?${q.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        setAdpMapping(data.adpMapping)
        if (data.statusOptions) setStatusOptions(data.statusOptions)
        if (data.errorOptions) setErrorOptions(data.errorOptions)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        const e = err as Error
        setError(e.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
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
      format,
      pttypes,
      serviceOnly,
      status,
      cardFilter,
      errorFilter,
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
      abortRef.current?.abort()
    }
  }, [fetchData, initialData])

  // Fetch Clinical Visit Details for Modal
  const fetchClinicalDetails = useCallback(async (vn: string) => {
    setClinicalLoading(true)
    setClinicalError(null)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/family-planning/vn-details?vn=${encodeURIComponent(vn)}`
      )
      const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : 'application/json'
      if (!contentType.includes('application/json')) {
        throw new Error(`ไม่สามารถเชื่อมต่อระบบข้อมูลเวชระเบียนได้ (HTTP ${res.status})`)
      }
      const json = await res.json()
      if (!res.ok || !json.success) {
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

  const openInspectionModal = (item: FamilyPlanningItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    if (item.vn) {
      fetchClinicalDetails(item.vn)
    }
  }

  const closeInspectionModal = () => {
    setSelectedItem(null)
    setClinicalData(null)
    setClinicalError(null)
  }

  // Copy Helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Sorting Handler
  const handleSort = (field: FamilyPlanningSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Card Filter Toggle Handler
  const handleCardClick = (targetFilter: FamilyPlanningCardFilter) => {
    if (cardFilter === targetFilter) {
      setCardFilter('ALL')
    } else {
      setCardFilter(targetFilter)
    }
    setCurrentPage(1)
  }

  // Export CSV Handler
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        format,
        serviceOnly: String(serviceOnly),
        status,
        cardFilter,
        errorFilter,
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (pttypes.length > 0) {
        q.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/family-planning/service-9-1?${q.toString()}`
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถส่งออกข้อมูลได้')
      }

      const rows: FamilyPlanningItem[] = json.data.items || []

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
        'อาการสำคัญ (CC)',
        'ClaimCode',
        'สิทธิการรักษา',
        'PDX',
        'การวินิจฉัยทั้งหมด (Dx)',
        'หัตถการ (Op)',
        'ค่าบริการทั้งหมด',
        'แพทย์ผู้ตรวจ',
        'รายการบริการ ADP',
        'รายการยาคุมกำเนิด',
        'สถานะการชดเชย',
        'เลขที่ Rep',
        'เงินชดเชย',
        'ข้อบกพร่อง/แจ้งเตือน',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const exportRows = rows.map((r) => [
        r.no,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        r.age ?? '',
        r.nation || '',
        r.vstdate,
        r.vsttime,
        r.cc || '',
        r.authencode || '',
        r.pttypename || '',
        r.pdx || '',
        r.diag || '',
        r.oper || r.op || '',
        r.income,
        r.doctorname || '',
        r.listname || '',
        r.drugname || '',
        r.status || '',
        r.rep || '',
        r.compensated,
        r.errorname || '',
        r.fund || '',
        r.subfund || '',
      ])

      await exportRcmExcel({
        filename: `rcm-family-planning-9-1-${ds1}-to-${ds2}.xlsx`,
        title: 'วางแผนครอบครัวและการป้องกันการตั้งครรภ์ (9.1)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: exportRows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert(e.message || 'ส่งออกไฟล์ Excel ไม่สำเร็จ')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fp91-page">
      {/* ── 1. Header Section ── */}
      <header className="fp91-header">
        <div className="fp91-title-group">
          <h1 className="fp91-title">วางแผนครอบครัวและการป้องกันการตั้งครรภ์</h1>
          <p className="fp91-subtitle">
            รายงานและตรวจสอบข้อมูลบริการวางแผนครอบครัว การป้องกันการตั้งครรภ์ไม่พึงประสงค์
            รหัสบริการ ADP หัตถการ ยาคุมกำเนิด และการชดเชยค่าบริการ
          </p>
        </div>

        <div className="fp91-header-actions">
          <button
            type="button"
            className="fp91-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            aria-busy={isRefreshing}
            title="รีเฟรชดึงข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? 'fp91-spin-icon' : undefined}
              aria-hidden="true"
            />
            {isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
          </button>
          <button
            type="button"
            className="fp91-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || totalCount === 0}
            aria-busy={isExporting}
            title="ส่งออกรายงานทั้งหมดเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}
          </button>
        </div>
      </header>

      {/* ── 2. Warning Banner when ADP code is unmapped ── */}
      {!adpMapping.isMapped && (
        <div className="fp91-banner fp91-banner-warn" role="alert">
          <div className="fp91-banner-content">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              <strong>แจ้งเตือน:</strong> คุณยังไม่ได้ Map รหัส ADP Code ของระบบ (
              {format === 'KRUNGTHAI' ? '20001, 20002, 20003, 20004' : 'FP001, FP002, FP003_1-4'}) ในตาราง{' '}
              <code>s_drugitems</code> กรุณาตรวจสอบการตั้งค่ารายการตรวจในระบบ HOSxP
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Error Banner ── */}
      {error && (
        <div className="fp91-banner fp91-banner-error" role="alert">
          <div className="fp91-banner-content">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="fp91-btn-secondary"
            onClick={() => fetchData(true)}
            style={{ minHeight: '34px', padding: '0 12px' }}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* ── 4. Interactive KPI Summary Cards (Filter via card) ── */}
      <section
        className="fp91-summary-grid"
        aria-label="สรุปภาพรวมบริการวางแผนครอบครัว (สามารถคลิกการ์ดเพื่อกรองข้อมูล)"
      >
        {/* Card 1: ทั้งหมด */}
        <button
          type="button"
          className="fp91-summary-card"
          aria-pressed={cardFilter === 'ALL'}
          onClick={() => handleCardClick('ALL')}
          title="แสดงผู้รับบริการทั้งหมด"
        >
          <div className="fp91-card-header">
            <span className="fp91-card-label">ผู้รับบริการทั้งหมด</span>
            <Activity size={16} className="text-muted" aria-hidden="true" />
          </div>
          <span className="fp91-card-val font-tabular">{summary.totalVisits.toLocaleString()}</span>
          <span className="fp91-card-sub">
            {summary.uniquePatients.toLocaleString()} คน • รายรับรวม ฿{formatMoney(summary.totalIncome)}
          </span>
        </button>

        {/* Card 2: เฉพาะมีรายการบริการ ADP */}
        <button
          type="button"
          className="fp91-summary-card"
          aria-pressed={cardFilter === 'SERVICE_ONLY'}
          onClick={() => handleCardClick('SERVICE_ONLY')}
          title="กรองเฉพาะเคสที่พบบริการ ADP"
        >
          <div className="fp91-card-header">
            <span className="fp91-card-label">พบบริการ ADP</span>
            <span className="fp91-badge fp91-badge-blue">เฉพาะบริการ</span>
          </div>
          <span className="fp91-card-val text-blue font-tabular">
            {summary.serviceOnlyCount.toLocaleString()}
          </span>
          <span className="fp91-card-sub text-blue">
            {summary.totalVisits > 0
              ? `${((summary.serviceOnlyCount / summary.totalVisits) * 100).toFixed(1)}% ของทั้งหมด`
              : '0%'}
          </span>
        </button>

        {/* Card 3: ได้รับชดเชยแล้ว */}
        <button
          type="button"
          className="fp91-summary-card"
          aria-pressed={cardFilter === 'COMPENSATED'}
          onClick={() => handleCardClick('COMPENSATED')}
          title="กรองเฉพาะเคสที่ได้รับเงินชดเชยแล้ว"
        >
          <div className="fp91-card-header">
            <span className="fp91-card-label">ได้รับชดเชยแล้ว</span>
            <CreditCard size={16} className="text-ok" aria-hidden="true" />
          </div>
          <span className="fp91-card-val text-ok font-tabular">
            {summary.compensatedVisits.toLocaleString()}
          </span>
          <span className="fp91-card-sub text-ok">
            ฿{formatMoney(summary.totalCompensated)} ({summary.compensationRate}%)
          </span>
        </button>

        {/* Card 4: รอชดเชย / ยังไม่ได้ส่ง */}
        <button
          type="button"
          className="fp91-summary-card card-warn"
          aria-pressed={cardFilter === 'UNCOMPENSATED'}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          title="กรองเคสที่ยังไม่ได้รับชดเชยหรือยังไม่ได้ส่ง"
        >
          <div className="fp91-card-header">
            <span className="fp91-card-label">รอชดเชย / ยังไม่ส่ง</span>
            <span className="fp91-badge fp91-badge-warn">รอชดเชย</span>
          </div>
          <span className="fp91-card-val text-warn font-tabular">
            {summary.uncompensatedVisits.toLocaleString()}
          </span>
          <span className="fp91-card-sub text-warn">ติดตามส่งเบิกตามรอบ</span>
        </button>

        {/* Card 5: พบข้อบกพร่อง / ข้อควรตรวจสอบ */}
        <button
          type="button"
          className="fp91-summary-card card-error"
          aria-pressed={cardFilter === 'HAS_ERROR'}
          onClick={() => handleCardClick('HAS_ERROR')}
          title="กรองเคสที่พบข้อบกพร่อง เช่น ไม่มีหัตถการ, ไม่พบ Dx, หรือไม่พบบริการ"
        >
          <div className="fp91-card-header">
            <span className="fp91-card-label">พบข้อควรตรวจสอบ</span>
            <AlertTriangle size={16} className="text-danger" aria-hidden="true" />
          </div>
          <span className="fp91-card-val text-danger font-tabular">
            {summary.errorCount.toLocaleString()}
          </span>
          <span className="fp91-card-sub text-danger">Dx/หัตถการ/บริการไม่สอดคล้อง</span>
        </button>

        {/* Card 6: ไม่มี ClaimCode */}
        <button
          type="button"
          className="fp91-summary-card"
          aria-pressed={cardFilter === 'NO_AUTHEN'}
          onClick={() => handleCardClick('NO_AUTHEN')}
          title="กรองเคสที่ยังไม่มีรหัส ClaimCode"
        >
          <div className="fp91-card-header">
            <span className="fp91-card-label">ไม่มี ClaimCode</span>
            <ShieldCheck size={16} className="text-muted" aria-hidden="true" />
          </div>
          <span className="fp91-card-val font-tabular">
            {summary.noAuthenCount.toLocaleString()}
          </span>
          <span className="fp91-card-sub text-muted">มี ClaimCode {summary.authenCount.toLocaleString()} ราย</span>
        </button>
      </section>

      {/* ── 5. Filter Control Panel ── */}
      <section className="fp91-filter-panel" aria-label="ตัวกรองและเงื่อนไขการค้นหา">
        {/* Row 1: Date Range Selector */}
        <div className="fp91-filter-row">
          <div className="fp91-date-tabs" role="tablist" aria-label="โหมดเลือกช่วงเวลา">
            <button
              type="button"
              className={`fp91-date-tab-btn ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => setDateMode('custom')}
              role="tab"
              aria-selected={dateMode === 'custom'}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              className={`fp91-date-tab-btn ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setDateMode('monthly')}
              role="tab"
              aria-selected={dateMode === 'monthly'}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={`fp91-date-tab-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => setDateMode('fiscal')}
              role="tab"
              aria-selected={dateMode === 'fiscal'}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="fp91-date-pickers">
            {dateMode === 'custom' && (
              <>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  aria-label="วันที่เริ่มต้น"
                />
                <span className="fp91-date-sep">ถึง</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  aria-label="วันที่สิ้นสุด"
                />
              </>
            )}

            {dateMode === 'monthly' && (
              <>
                <select
                  className="fp91-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="fp91-select font-tabular"
                  value={selectedBeYear}
                  onChange={(e) => setSelectedBeYear(Number(e.target.value))}
                  aria-label="เลือกปี พ.ศ."
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {dateMode === 'fiscal' && (
              <select
                className="fp91-select font-tabular"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {[2569, 2570].map((y) => (
                  <option key={y} value={y}>
                    ปีงบ {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Filters & Search Bar */}
        <div className="fp91-filter-row">
          {/* Format Selection (New EClaim vs KrungThai) */}
          <select
            className="fp91-select"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value as FamilyPlanningFormat)
              setCurrentPage(1)
            }}
            aria-label="รูปแบบ ADP Code"
          >
            <option value="NEW_ECLAIM">New EClaim (FP001, FP002, FP003_1-4)</option>
            <option value="KRUNGTHAI">KrungThai Health Platform (20001 - 20004)</option>
          </select>

          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {/* Service Only Checkbox (เหมือน chkService ใน FoxPro) */}
          <label className="fp91-checkbox-label" title="แสดงเฉพาะเคสที่บันทึกรหัสบริการ ADP">
            <input
              type="checkbox"
              className="fp91-checkbox"
              checked={serviceOnly}
              onChange={(e) => {
                setServiceOnly(e.target.checked)
                setCurrentPage(1)
              }}
            />
            <span>เฉพาะบริการ</span>
          </label>

          {/* Status Dropdown */}
          <select
            className="fp91-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="กรองตามสถานะการชดเชย"
          >
            <option value="ALL">สถานะ: ทั้งหมด</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Error Filter Dropdown */}
          <select
            className="fp91-select"
            value={errorFilter}
            onChange={(e) => {
              setErrorFilter(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="กรองตามข้อผิดพลาด"
          >
            <option value="ALL">การตรวจสอบ: ทั้งหมด</option>
            <option value="HAS_ERROR">เฉพาะที่พบข้อบกพร่อง</option>
            <option value="NO_ERROR">เฉพาะที่ปกติ (ไม่มีข้อบกพร่อง)</option>
            {errorOptions.map((eo) => (
              <option key={eo} value={eo}>
                {eo}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="fp91-search-box">
            <Search size={16} className="fp91-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="fp91-input fp91-search-input"
              placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล, VN, ยาคุม, ข้อบกพร่อง..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ช่องค้นหา"
            />
            {search && (
              <button
                type="button"
                className="fp91-search-clear"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── 6. Table Section ── */}
      <section className="fp91-table-card" aria-label="ตารางข้อมูลบริการวางแผนครอบครัว">
        {/* Table Meta Controls */}
        <div className="fp91-table-meta">
          <div className="fp91-table-count">
            พบข้อมูลทั้งหมด <strong>{totalCount.toLocaleString()}</strong> รายการ (หน้า{' '}
            {currentPage} จาก {totalPages})
            {cardFilter !== 'ALL' && (
              <span className="fp91-badge fp91-badge-neutral" style={{ marginLeft: 8 }}>
                กรองการ์ด: {cardFilter}
              </span>
            )}
          </div>

          <div className="fp91-page-size-selector">
            <span>แสดงแถวต่อหน้า:</span>
            <select
              className="fp91-select"
              style={{ minHeight: '34px', padding: '0 8px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              aria-label="เลือกจำนวนแถวต่อหน้า"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Table Scroll Area */}
        <div className="fp91-table-scroll">
          <table className="fp91-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>ลำดับ</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('vstdate')}
                  style={{ width: '140px' }}
                >
                  <span className="fp91-th-content">
                    วันที่-เวลา
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th style={{ width: '120px' }}>VN</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('hn')}
                  style={{ width: '90px' }}
                >
                  <span className="fp91-th-content">
                    HN
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th style={{ width: '160px' }}>เลขบัตรประชาชน</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('ptname')}
                  style={{ minWidth: '180px' }}
                >
                  <span className="fp91-th-content">
                    ชื่อ-สกุล
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('age')}
                  style={{ width: '80px', textAlign: 'center' }}
                >
                  <span className="fp91-th-content">
                    อายุ
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th style={{ minWidth: '160px' }}>สิทธิการรักษา</th>
                <th style={{ width: '130px' }}>
                    ClaimCode
                  </th>
                <th style={{ minWidth: '130px' }}>การวินิจฉัย (Dx)</th>
                <th style={{ minWidth: '110px' }}>หัตถการ (Op)</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('listname')}
                  style={{ minWidth: '170px' }}
                >
                  <span className="fp91-th-content">
                    บริการ ADP
                    {sortBy === 'listname' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th style={{ minWidth: '170px' }}>ยาคุมกำเนิด</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('status')}
                  style={{ minWidth: '150px' }}
                >
                  <span className="fp91-th-content">
                    สถานะ
                    {sortBy === 'status' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th style={{ width: '110px' }}>เลขที่ Rep</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('compensated')}
                  style={{ width: '110px', textAlign: 'right' }}
                >
                  <span className="fp91-th-content" style={{ justifyContent: 'flex-end' }}>
                    เงินชดเชย
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('errorname')}
                  style={{ minWidth: '180px' }}
                >
                  <span className="fp91-th-content">
                    ข้อบกพร่อง / แนะนำ
                    {sortBy === 'errorname' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </span>
                </th>
                </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, rowIdx) => (
                  <tr key={`skeleton-${rowIdx}`} className="rcm-skeleton-row">
                    {Array.from({ length: 17 }).map((__, colIdx) => (
                      <td key={colIdx} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={17}>
                    <div className="fp91-empty-state">
                      <FileText size={32} className="fp91-empty-icon" />
                      <div className="fp91-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
                      <div className="fp91-empty-desc">
                        ลองเปลี่ยนช่วงวันที่ ค้นหาด้วยคำอื่น หรือเลือกโหมดการกรองใหม่
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const hasErr = item.hasError
                  const isMissingDx = !item.icd10 && (item.hasService || Boolean(item.drugname))

                  return (
                    <tr
                      key={item.vn}
                      className={hasErr ? 'fp91-row-error' : undefined}
                      onClick={() => openInspectionModal(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center' }} className="font-tabular text-muted">
                        {item.no}
                      </td>
                      <td className="font-tabular">
                        <div>{formatThaiDate(item.vstdate)}</div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {item.vsttime || '—'}
                        </div>
                      </td>
                      <td className="font-tabular font-medium">{item.vn}</td>
                      <td className="font-tabular">{item.hn}</td>
                      <td>
                        <button
                          type="button"
                          className="fp91-cid-btn font-tabular"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(item.cid, `cid-${item.vn}`)
                          }}
                          title="คลิกเพื่อคัดลอกเลขบัตรประชาชน 13 หลัก"
                        >
                          <span>{formatCidDisplay(item.cid)}</span>
                          {copiedField === `cid-${item.vn}` && (
                            <span className="text-ok" style={{ fontSize: '11px', marginLeft: '4px' }}>
                              คัดลอกแล้ว
                            </span>
                          )}
                        </button>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.ptname}</div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {item.sex} • {item.nation || 'ไทย'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }} className="font-tabular">
                        {item.age != null ? `${item.age} ปี` : '—'}
                      </td>
                      <td>
                        <span title={item.pttypename || ''}>
                          {item.pttypename || '—'}
                        </span>
                      </td>
                      <td>
                        {item.authencode ? (
                          <span className="fp91-badge fp91-badge-ok font-tabular">
                            {item.authencode}
                          </span>
                        ) : (
                          <span className="fp91-badge fp91-badge-neutral">ไม่มี</span>
                        )}
                      </td>
                      <td>
                        {item.icd10 ? (
                          <div>
                            <span className="fp91-badge fp91-badge-blue font-tabular">
                              {item.icd10}
                            </span>
                            {item.diag && item.diag !== item.icd10 && (
                              <div
                                className="text-muted"
                                style={{ fontSize: '11.5px', marginTop: '2px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                title={item.diag}
                              >
                                {item.diag}
                              </div>
                            )}
                          </div>
                        ) : isMissingDx ? (
                          <span className="fp91-badge fp91-badge-danger">ไม่พบ Dx Z30</span>
                        ) : item.pdx ? (
                          <span className="fp91-badge fp91-badge-neutral font-tabular" title="PDX ไม่ใช่ Z30">
                            {item.pdx}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {item.op || item.oper ? (
                          <span className="fp91-badge fp91-badge-ok font-tabular">
                            {item.oper || item.op}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {item.listname ? (
                          <span className="fp91-badge fp91-badge-blue" title={item.listname}>
                            {item.listname}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {item.drugname ? (
                          <span className="fp91-badge fp91-badge-purple" title={item.drugname}>
                            {item.drugname}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`fp91-badge ${
                            item.compensated > 0
                              ? 'fp91-badge-ok'
                              : item.status.includes('ยังไม่ได้ส่ง')
                              ? 'fp91-badge-warn'
                              : 'fp91-badge-neutral'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="font-tabular">
                        <div>{item.rep || '—'}</div>
                        <RcmSeamlessRepBadges row={item} />
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-tabular font-medium">
                        {item.compensated > 0 ? (
                          <span className="text-ok">฿{formatMoney(item.compensated)}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        <RcmSeamlessSubAmount row={item} />
                      </td>
                      <td>
                        {item.errorname ? (
                          <span className="fp91-badge fp91-badge-danger">
                            <AlertTriangle size={12} />
                            {item.errorname}
                          </span>
                        ) : (
                          <span className="fp91-badge fp91-badge-ok">
                            <Check size={12} />
                            ปกติ
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="fp91-pagination">
          <div className="fp91-pagination-info font-tabular">
            แสดงรายการที่ {(currentPage - 1) * pageSize + 1} ถึง{' '}
            {Math.min(currentPage * pageSize, totalCount)} จากทั้งหมด {totalCount.toLocaleString()}{' '}
            รายการ
          </div>

          <div className="fp91-pagination-controls">
            <button
              type="button"
              className="fp91-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="font-tabular" style={{ padding: '0 8px', fontSize: '13.5px' }}>
              หน้า {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="fp91-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. Inspection Detail Modal ── */}
      {selectedItem && (
        <div
          className="fp91-modal-backdrop"
          onClick={closeInspectionModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fp91-modal-title"
        >
          <div className="fp91-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="fp91-modal-header">
              <h2 id="fp91-modal-title" className="fp91-modal-title">
                รายละเอียดการรับบริการ: VN {selectedItem.vn} ({selectedItem.ptname})
              </h2>
              <button
                type="button"
                className="fp91-modal-close-btn"
                onClick={closeInspectionModal}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="fp91-modal-tabs">
              <button
                type="button"
                className={`fp91-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปข้อมูลกองทุน 9.1
              </button>
              <button
                type="button"
                className={`fp91-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก (HOSxP)
              </button>
            </div>

            <div className="fp91-modal-body">
              {modalTab === 'summary' ? (
                <div>
                  <div className="fp91-grid-2">
                    <div className="fp91-field-card">
                      <div className="fp91-field-label">ผู้รับบริการ</div>
                      <div className="fp91-field-value">{selectedItem.ptname}</div>
                      <div className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                        HN: {selectedItem.hn} • เลขบัตร: {formatCidDisplay(selectedItem.cid)}
                      </div>
                    </div>

                    <div className="fp91-field-card">
                      <div className="fp91-field-label">วันที่และเวลาเข้ารับบริการ</div>
                      <div className="fp91-field-value font-tabular">
                        {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime || '—'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                        สิทธิ: {selectedItem.pttypename || '—'}
                      </div>
                    </div>

                    <div className="fp91-field-card">
                      <div className="fp91-field-label">รหัส ClaimCode</div>
                      <div className="fp91-field-value font-tabular">
                        {selectedItem.authencode || 'ไม่มี Authen Code'}
                      </div>
                    </div>

                    <div className="fp91-field-card">
                      <div className="fp91-field-label">แพทย์ผู้ตรวจ</div>
                      <div className="fp91-field-value">
                        {selectedItem.doctorname || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="fp91-field-card" style={{ marginBottom: '16px' }}>
                    <div className="fp91-field-label">อาการสำคัญ (Chief Complaint)</div>
                    <div className="fp91-field-value" style={{ fontWeight: 500 }}>
                      {selectedItem.cc || '—'}
                    </div>
                  </div>

                  <div className="fp91-grid-2">
                    <div className="fp91-field-card">
                      <div className="fp91-field-label">การวินิจฉัย (ICD-10)</div>
                      <div className="fp91-field-value font-tabular">
                        {selectedItem.pdx || selectedItem.icd10 || '—'}
                      </div>
                      {selectedItem.diag && (
                        <div className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                          {selectedItem.diag}
                        </div>
                      )}
                    </div>

                    <div className="fp91-field-card">
                      <div className="fp91-field-label">หัตถการ (ICD-9)</div>
                      <div className="fp91-field-value font-tabular">
                        {selectedItem.oper || selectedItem.op || '—'}
                      </div>
                    </div>

                    <div className="fp91-field-card">
                      <div className="fp91-field-label">บริการ ADP ที่บันทึก</div>
                      <div className="fp91-field-value font-tabular">
                        {selectedItem.listname || 'ไม่พบรายการบริการ ADP'}
                      </div>
                    </div>

                    <div className="fp91-field-card">
                      <div className="fp91-field-label">ยาคุมกำเนิดที่จ่าย</div>
                      <div className="fp91-field-value font-tabular">
                        {selectedItem.drugname || 'ไม่พบรายการยาคุมกำเนิด'}
                      </div>
                    </div>
                  </div>

                  <div className="fp91-field-card" style={{ marginTop: '16px' }}>
                    <div className="fp91-field-label">ผลการตรวจสอบความสอดคล้อง (FoxPro Audit)</div>
                    {selectedItem.errorname ? (
                      <div
                        className="text-danger"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                      >
                        <AlertTriangle size={18} />
                        {selectedItem.errorname}
                      </div>
                    ) : (
                      <div
                        className="text-ok"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                      >
                        <Check size={18} />
                        ข้อมูลถูกต้องสมบูรณ์ตามหลักเกณฑ์การเบิกชดเชย
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {clinicalLoading ? (
                    <div className="fp91-empty-state">
                      <RefreshCw size={28} className="fp91-spin-icon fp91-empty-icon" />
                      <div className="fp91-empty-title">กำลังโหลดเวชระเบียนคลินิก...</div>
                    </div>
                  ) : clinicalError ? (
                    <div className="fp91-banner fp91-banner-error">
                      <div className="fp91-banner-content">
                        <AlertCircle size={18} />
                        <span>{clinicalError}</span>
                      </div>
                    </div>
                  ) : clinicalData ? (
                    <div>
                      {/* Vital signs */}
                      {clinicalData.screen && (
                        <div className="fp91-field-card" style={{ marginBottom: '16px' }}>
                          <div className="fp91-field-label">สัญญาณชีพ (Vital Signs)</div>
                          <div style={{ fontSize: '13.5px', marginTop: '4px' }}>
                            BP: {clinicalData.screen.bps || '—'}/{clinicalData.screen.bpd || '—'}{' '}
                            mmHg • PR: {clinicalData.screen.pulse || '—'} bpm • Temp:{' '}
                            {clinicalData.screen.temperature || '—'} °C • น้ำหนัก:{' '}
                            {clinicalData.screen.bw || '—'} kg
                          </div>
                        </div>
                      )}

                      {/* Diagnoses */}
                      <div className="fp91-field-card" style={{ marginBottom: '16px' }}>
                        <div className="fp91-field-label">รายการวินิจฉัย (ICD-10) จาก HOSxP</div>
                        {clinicalData.diagnoses && clinicalData.diagnoses.length > 0 ? (
                          <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13.5px' }}>
                            {clinicalData.diagnoses.map((d: any, i: number) => (
                              <li key={i}>
                                <strong>{d.icd10}</strong>: {d.icd_name || d.icdName || d.diagtype_name || d.diagtype || '—'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted" style={{ fontSize: '13px' }}>
                            ไม่พบรายการวินิจฉัย
                          </div>
                        )}
                      </div>

                      {/* Orders */}
                      <div className="fp91-field-card">
                        <div className="fp91-field-label">รายการยาและเวชภัณฑ์ที่สั่งจ่าย</div>
                        {clinicalData.orders?.items && clinicalData.orders.items.length > 0 ? (
                          <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13.5px' }}>
                            {clinicalData.orders.items.map((o: any, i: number) => (
                              <li key={i}>
                                <strong>{o.item_name || o.itemName}</strong> (จำนวน: {o.qty} {o.units || ''}) — ฿
                                {formatMoney(o.sum_price || o.totalPrice)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted" style={{ fontSize: '13px' }}>
                            ไม่พบรายการสั่งจ่าย
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="fp91-empty-state">
                      <div className="fp91-empty-title">ไม่พบข้อมูลเวชระเบียนคลินิก</div>
                    </div>
                  )}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
