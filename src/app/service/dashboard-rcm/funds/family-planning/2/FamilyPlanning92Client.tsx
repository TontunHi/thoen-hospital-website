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
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Building2,
  Stethoscope,
  Pill,
} from 'lucide-react'
import type {
  IudItem,
  IudSummary,
  IudPatientType,
  IudCardFilter,
  IudSearchField,
  IudSortField,
  IudAdpMappingCheck,
} from '@/lib/clinical/rcmFamilyPlanningService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
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
  if (!val || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

export interface FamilyPlanning92ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function FamilyPlanning92Client({
  initialData,
  initialRange,
}: FamilyPlanning92ClientProps = {}) {
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
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Patient Type State: 'OPD' (default) | 'IPD'
  const [patientType, setPatientType] = useState<IudPatientType>('OPD')
  const [pttypes, setPttypes] = useState<string[]>([])

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<IudCardFilter>('ALL')
  const [searchField, setSearchField] = useState<IudSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [errorFilter, setErrorFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<IudSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<IudItem[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<IudAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      adpCodes: ['20003', 'FP001', '71681', '71682'],
      items: [],
    }
  )
  const [summary, setSummary] = useState<IudSummary>(
    initialData?.summary || {
      totalCases: 0,
      uniquePatients: 0,
      compensatedCases: 0,
      uncompensatedCases: 0,
      eclaimSentCases: 0,
      unsentCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      totalIncome: 0,
      totalMoneyEclaim: 0,
      totalMoneyRep: 0,
      totalMoneyInvoice: 0,
      errorDxCount: 0,
      errorOpCount: 0,
      errorDrugCount: 0,
      hasErrorCount: 0,
      completeCount: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
    }
  )

  // Inspection Modal States
  const [selectedItem, setSelectedItem] = useState<IudItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Search debounce
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

  // Fetch Report Data from API
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
          patientType,
          cardFilter,
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
          `/api/service/dashboard-rcm/funds/family-planning/service-9-2?${q.toString()}`,
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
        if (data.summary) setSummary(data.summary)
        if (data.adpMapping) setAdpMapping(data.adpMapping)
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
      patientType,
      pttypes,
      cardFilter,
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

  const openInspectionModal = (item: IudItem) => {
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

  // Refresh handler
  const handleRefresh = () => {
    fetchData(true)
  }

  // Sorting Handler
  const handleSort = (field: IudSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Card Filter Handler
  const handleCardClick = (targetFilter: IudCardFilter) => {
    if (cardFilter === targetFilter) {
      setCardFilter('ALL')
    } else {
      setCardFilter(targetFilter)
    }
    setCurrentPage(1)
  }

  // Copy to clipboard helper
  const copyText = (txt: string, fieldId: string) => {
    if (!txt) return
    navigator.clipboard.writeText(txt)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 1800)
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setSearchField('ALL')
    setStatusFilter('ALL')
    setErrorFilter('ALL')
    setCardFilter('ALL')
    setCurrentPage(1)
  }

  // Client-side filtering for status and error dropdowns
  const displayedItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false
      }
      if (errorFilter === 'COMPLETE' && item.hasError) {
        return false
      }
      if (errorFilter === 'HAS_ERROR' && !item.hasError) {
        return false
      }
      if (errorFilter === 'ERROR_DX' && !item.errorDx) {
        return false
      }
      if (errorFilter === 'ERROR_OP' && !item.errorOp) {
        return false
      }
      if (errorFilter === 'ERROR_DRUG' && !item.errorDrug) {
        return false
      }
      return true
    })
  }, [items, statusFilter, errorFilter])

  // Distinct status options for filter dropdown
  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => {
      if (it.status) set.add(it.status)
    })
    return Array.from(set).sort()
  }, [items])

  // Export CSV Handler
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        patientType,
        cardFilter,
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
        `/api/service/dashboard-rcm/funds/family-planning/service-9-2?${q.toString()}`
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถส่งออกข้อมูลได้')
      }

      const rows: IudItem[] = json.data.items || []

      const headers = [
        'ลำดับ',
        patientType === 'IPD' ? 'AN' : 'VN',
        'HN',
        'เลขประจำตัวประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        'วันที่รับบริการ',
        patientType === 'IPD' ? 'วันที่จำหน่าย' : 'เวลารับบริการ',
        'สิทธิการรักษา',
        'ClaimCode',
        'แผนก',
        'คลินิก',
        'อาการสำคัญ (CC)',
        'การวินิจฉัย (Dx)',
        'หัตถการ (Op 697)',
        'ค่าบริการ/ยา (ADP)',
        'ค่ารักษา (บาท)',
        'ชดเชย E-Claim',
        'ชดเชย Rep',
        'ชดเชย Invoice',
        'ยอดชดเชยรวม',
        'เลข Rep',
        'สถานะการเบิก',
        'ข้อผิดพลาด Dx',
        'ข้อผิดพลาด Op',
        'ข้อผิดพลาด ค่าบริการ',
      ]

      const csvRows = rows.map((r, i) => [
        i + 1,
        `"${r.vn}"`,
        `"${r.hn}"`,
        `"${r.cid}"`,
        `"${r.ptname}"`,
        `"${r.sex}"`,
        r.age,
        `"${r.vstdate}"`,
        patientType === 'IPD' ? `"${r.dchdate || ''}"` : `"${r.vsttime}"`,
        `"${r.pttypename}"`,
        `"${r.claimcode || ''}"`,
        `"${r.department || ''}"`,
        `"${r.clinic || ''}"`,
        `"${(r.cc || '').replace(/"/g, '""')}"`,
        `"${(r.dx || '').replace(/"/g, '""')}"`,
        `"${(r.op || '').replace(/"/g, '""')}"`,
        `"${(r.drug || '').replace(/"/g, '""')}"`,
        r.income,
        r.money_eclaim,
        r.money_rep,
        r.money_invoice,
        r.compensated,
        `"${r.rep || ''}"`,
        `"${r.status}"`,
        `"${r.errorDx || ''}"`,
        `"${r.errorOp || ''}"`,
        `"${r.errorDrug || ''}"`,
      ])

      await exportRcmExcel({
        filename: `IUD_Insertion_9_2_${patientType}_${ds1}_${ds2}.xlsx`,
        title: `บริการใส่ห่วงอนามัย (IUD Insertion 9.2 - ${patientType})`,
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows: csvRows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert(`เกิดข้อผิดพลาดในการส่งออก: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fp-page">
      <div className="fp-header">
        <div className="fp-title-group">
          <h1 className="fp-title">บริการใส่ห่วงอนามัย (IUD Insertion)</h1>
          <p className="fp-subtitle">
            รายงานและตรวจสอบข้อมูลบริการใส่ห่วงอนามัย รหัส ADP: 20003, FP001, 71681, 71682
            ตรวจสอบการลงรหัส Dx (Z301), หัตถการ Op (697), ค่าบริการ/ยา และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)
          </p>
        </div>
        <div className="fp-header-actions">
          <button
            type="button"
            className="fp-btn fp-btn-outline"
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            title="ล้างแคชและดึงข้อมูลใหม่"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>รีเฟรชข้อมูล</span>
          </button>
          <button
            type="button"
            className="fp-btn fp-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. Control Bar (Date Selection + Patient Type OPD/IPD) */}
      <div className="fp-control-bar">
        {/* Date Selector */}
        <div className="fp-date-controls">
          <div className="fp-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`fp-mode-tab ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => setDateMode('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`fp-mode-tab ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setDateMode('monthly')}
            >
              เดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`fp-mode-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => setDateMode('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="fp-date-inputs">
            {dateMode === 'custom' && (
              <>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(d) => {
                    setDs1(d)
                    setCurrentPage(1)
                  }}
                  placeholder="ตั้งแต่วันที่"
                />
                <span className="fp-date-sep">ถึง</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(d) => {
                    setDs2(d)
                    setCurrentPage(1)
                  }}
                  placeholder="ถึงวันที่"
                />
              </>
            )}

            {dateMode === 'monthly' && (
              <div className="fp-select-group">
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="fp-select"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedBeYear}
                  onChange={(e) => {
                    setSelectedBeYear(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="fp-select"
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
              <div className="fp-select-group">
                <label className="fp-field-label">ปีงบประมาณ พ.ศ.</label>
                <select
                  value={selectedFiscalYear}
                  onChange={(e) => {
                    setSelectedFiscalYear(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="fp-select"
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

        {/* Patient Type Switcher (OPD / IPD) */}
        <div className="fp-type-controls">
          <span className="fp-type-label">ประเภทผู้ป่วย:</span>
          <div className="fp-type-toggle">
            <button
              type="button"
              className={`fp-type-btn ${patientType === 'OPD' ? 'active opd' : ''}`}
              onClick={() => {
                setPatientType('OPD')
                setCurrentPage(1)
              }}
            >
              ผู้ป่วยนอก (OPD)
            </button>
            <button
              type="button"
              className={`fp-type-btn ${patientType === 'IPD' ? 'active ipd' : ''}`}
              onClick={() => {
                setPatientType('IPD')
                setCurrentPage(1)
              }}
            >
              ผู้ป่วยใน (IPD)
            </button>
          </div>
        </div>
      </div>

      {!adpMapping.isMapped && (
        <div className="fp-alert fp-alert-danger">
          <AlertCircle size={20} />
          <div>
            <strong>แจ้งเตือน: คุณยังไม่ได้ Map ADP Code ในระบบ HOSxP</strong>
            <p>
              ไม่พบรายการค่าบริการ/ยาที่มีรหัส ADP: 20003, FP001, 71681, 71682 ในตาราง s_drugitems กรุณาตรวจสอบการตั้งค่า Map รหัส ADP
            </p>
          </div>
        </div>
      )}

      {/* 4. Interactive KPI Summary Cards */}
      <div className="fp-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardClick('ALL')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ALL')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ผู้รับบริการทั้งหมด</span>
            <Activity size={18} className="fp-kpi-icon fp-kpi-icon--neutral" />
          </div>
          <div className="fp-kpi-value">{summary.totalCases.toLocaleString('th-TH')}</div>
          <div className="fp-kpi-sub">
            {summary.uniquePatients.toLocaleString('th-TH')} คน ({patientType})
          </div>
        </div>

        {/* Card 2: ชดเชยแล้ว */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card fp-kpi-card--success ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('COMPENSATED')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ชดเชยแล้ว</span>
            <CheckCircle2 size={18} className="fp-kpi-icon fp-kpi-icon--success" />
          </div>
          <div className="fp-kpi-value text-emerald-700">
            {summary.compensatedCases.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">
            {summary.compensationRate.toFixed(1)}% · ฿{formatMoney(summary.totalCompensated)}
          </div>
        </div>

        {/* Card 3: ยังไม่ชดเชย */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card fp-kpi-card--pending ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UNCOMPENSATED')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ยังไม่ชดเชย</span>
            <Clock size={18} className="fp-kpi-icon fp-kpi-icon--warning" />
          </div>
          <div className="fp-kpi-value text-amber-700">
            {summary.uncompensatedCases.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">รอผลหรือยังไม่ผ่านเงื่อนไข</div>
        </div>

        {/* Card 4: ข้อมูลครบถ้วน (ไม่มี Error) */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card fp-kpi-card--info ${cardFilter === 'COMPLETE' ? 'active' : ''}`}
          onClick={() => handleCardClick('COMPLETE')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('COMPLETE')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ข้อมูลครบถ้วน</span>
            <ShieldCheck size={18} className="fp-kpi-icon fp-kpi-icon--info" />
          </div>
          <div className="fp-kpi-value text-sky-700">
            {summary.completeCount.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">มี Dx Z301, Op 697, ค่าบริการครบ</div>
        </div>

        {/* Card 5: พบข้อบกพร่อง/ไม่ครบ */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card fp-kpi-card--danger ${cardFilter === 'HAS_ERROR' ? 'active' : ''}`}
          onClick={() => handleCardClick('HAS_ERROR')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('HAS_ERROR')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">พบข้อบกพร่อง</span>
            <AlertTriangle size={18} className="fp-kpi-icon fp-kpi-icon--danger" />
          </div>
          <div className="fp-kpi-value text-rose-700">
            {summary.hasErrorCount.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">ขาด Dx, Op หรือค่าบริการ</div>
        </div>

        {/* Card 6: ไม่พบ Dx Z301 */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'ERROR_DX' ? 'active' : ''}`}
          onClick={() => handleCardClick('ERROR_DX')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ERROR_DX')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ไม่พบ Dx Z301</span>
            <AlertCircle size={18} className="fp-kpi-icon fp-kpi-icon--danger" />
          </div>
          <div className="fp-kpi-value text-rose-700">
            {summary.errorDxCount.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">วินิจฉัยใส่ห่วงคุมกำเนิด</div>
        </div>

        {/* Card 7: ไม่พบ Op 697 */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'ERROR_OP' ? 'active' : ''}`}
          onClick={() => handleCardClick('ERROR_OP')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ERROR_OP')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ไม่พบ Op 697</span>
            <AlertCircle size={18} className="fp-kpi-icon fp-kpi-icon--warning" />
          </div>
          <div className="fp-kpi-value text-amber-700">
            {summary.errorOpCount.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">หัตถการใส่ห่วงอนามัย</div>
        </div>

        {/* Card 8: ไม่พบค่าบริการ */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'ERROR_DRUG' ? 'active' : ''}`}
          onClick={() => handleCardClick('ERROR_DRUG')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ERROR_DRUG')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ไม่พบค่าบริการ/ยา</span>
            <Pill size={18} className="fp-kpi-icon fp-kpi-icon--danger" />
          </div>
          <div className="fp-kpi-value text-rose-700">
            {summary.errorDrugCount.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">ไม่พบรายการค่าบริการ ADP</div>
        </div>

        {/* Card 9: ส่ง E-Claim แล้ว */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'ECLAIM_SENT' ? 'active' : ''}`}
          onClick={() => handleCardClick('ECLAIM_SENT')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ECLAIM_SENT')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ส่ง E-Claim แล้ว</span>
            <Activity size={18} className="fp-kpi-icon fp-kpi-icon--info" />
          </div>
          <div className="fp-kpi-value text-sky-700">
            {summary.eclaimSentCases.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">มีประวัติส่งใน m_registerdata</div>
        </div>

        {/* Card 10: ยังไม่ส่ง E-Claim */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'UNSENT' ? 'active' : ''}`}
          onClick={() => handleCardClick('UNSENT')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UNSENT')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ยังไม่ส่ง E-Claim</span>
            <Clock size={18} className="fp-kpi-icon fp-kpi-icon--neutral" />
          </div>
          <div className="fp-kpi-value text-slate-700">
            {summary.unsentCases.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">ยังไม่มีประวัติในโปรแกรม E-Claim</div>
        </div>

        {/* Card 11: มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`fp-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardClick('WITH_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_AUTHEN')}
        >
          <div className="fp-kpi-header">
            <span className="fp-kpi-label">ขอ ClaimCode แล้ว</span>
            <ShieldCheck size={18} className="fp-kpi-icon fp-kpi-icon--success" />
          </div>
          <div className="fp-kpi-value text-emerald-700">
            {summary.withAuthenCount.toLocaleString('th-TH')}
          </div>
          <div className="fp-kpi-sub">
            {(summary.authenRate ?? 0).toFixed(1)}% · ขอรหัสยืนยันตัวตนแล้ว
          </div>
        </div>
      </div>

      {/* 5. Filter & Search Toolbar */}
      <div className="fp-filter-bar">
        {/* Search Input Box */}
        <div className="fp-field-group fp-search-wrapper">
          <label className="fp-field-label">คำค้นหา</label>
          <div className="fp-search-box">
            <Search size={16} className="fp-search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล, VN, แผนก, Dx, Op..."
              className="fp-search-input"
            />
            {search && (
              <button
                type="button"
                className="fp-search-clear"
                onClick={() => setSearch('')}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Pttype Filter */}
        <div className="fp-field-group">
          <label className="fp-field-label">สิทธิการรักษา</label>
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />
        </div>

        {/* Status Filter */}
        <div className="fp-field-group">
          <label className="fp-field-label">สถานะการเบิก</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="fp-select"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Error Warning Filter */}
        <div className="fp-field-group">
          <label className="fp-field-label">ข้อผิดพลาด/ความสมบูรณ์</label>
          <select
            value={errorFilter}
            onChange={(e) => setErrorFilter(e.target.value)}
            className="fp-select"
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="COMPLETE">ข้อมูลครบถ้วน (ไม่มี Error)</option>
            <option value="HAS_ERROR">พบข้อบกพร่อง (มี Error)</option>
            <option value="ERROR_DX">ไม่พบ Dx Z301</option>
            <option value="ERROR_OP">ไม่พบ Op 697</option>
            <option value="ERROR_DRUG">ไม่พบค่าบริการ/ยา</option>
          </select>
        </div>

        {/* Reset Filters Button */}
        {(search || statusFilter !== 'ALL' || errorFilter !== 'ALL' || cardFilter !== 'ALL') && (
          <div className="fp-field-group self-end">
            <button
              type="button"
              className="fp-btn fp-btn-ghost text-slate-600 hover:text-slate-900"
              onClick={handleResetFilters}
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* 6. Active Filter Chips */}
      {cardFilter !== 'ALL' && (
        <div className="fp-active-filter-strip">
          <span className="text-sm text-slate-600">กำลังกรองผ่านการ์ด:</span>
          <span className="fp-chip active">
            {cardFilter === 'COMPENSATED' && 'ชดเชยแล้ว'}
            {cardFilter === 'UNCOMPENSATED' && 'ยังไม่ชดเชย'}
            {cardFilter === 'COMPLETE' && 'ข้อมูลครบถ้วน'}
            {cardFilter === 'HAS_ERROR' && 'พบข้อบกพร่อง'}
            {cardFilter === 'ERROR_DX' && 'ไม่พบ Dx Z301'}
            {cardFilter === 'ERROR_OP' && 'ไม่พบ Op 697'}
            {cardFilter === 'ERROR_DRUG' && 'ไม่พบค่าบริการ/ยา'}
            {cardFilter === 'ECLAIM_SENT' && 'ส่ง E-Claim แล้ว'}
            {cardFilter === 'UNSENT' && 'ยังไม่ส่ง E-Claim'}
            {cardFilter === 'WITH_AUTHEN' && 'มี ClaimCode'}
            {cardFilter === 'NO_AUTHEN' && 'ไม่มี ClaimCode'}
            <button
              type="button"
              onClick={() => handleCardClick('ALL')}
              className="ml-1 hover:text-rose-600"
              title="ยกเลิกการกรองนี้"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {/* 7. Error & Loading Banners */}
      {error && (
        <div className="fp-alert fp-alert-danger">
          <AlertCircle size={20} />
          <div>
            <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 8. Ledger Table */}
      <div className="fp-table-container">
        <div className="fp-table-scroll">
          <table className="fp-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>ลำดับ</th>
                <th className="sortable" onClick={() => handleSort('vstdate')}>
                  <div className="fp-th-content">
                    <span>{patientType === 'IPD' ? 'วันที่ Admit' : 'วันที่รับบริการ'}</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th>{patientType === 'IPD' ? 'AN' : 'VN'}</th>
                <th className="sortable" onClick={() => handleSort('hn')}>
                  <div className="fp-th-content">
                    <span>HN</span>
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th>เลขบัตร ปชช.</th>
                <th className="sortable" onClick={() => handleSort('ptname')}>
                  <div className="fp-th-content">
                    <span>ชื่อ-สกุล</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th style={{ textAlign: 'center' }}>เพศ/อายุ</th>
                <th>สิทธิการรักษา</th>
                <th>แผนก / คลินิก</th>
                <th>ClaimCode</th>
                <th>Dx (ICD-10)</th>
                <th>Op (ICD-9)</th>
                <th>ค่าบริการ/ยา</th>
                <th style={{ textAlign: 'center' }}>ข้อผิดพลาด</th>
                <th>สถานะการเบิก</th>
                <th>เลขที่ Rep</th>
                <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('money_eclaim')}>
                  <div className="fp-th-content justify-end">
                    <span>E-Claim</span>
                    {sortBy === 'money_eclaim' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('money_rep')}>
                  <div className="fp-th-content justify-end">
                    <span>Rep</span>
                    {sortBy === 'money_rep' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('money_invoice')}>
                  <div className="fp-th-content justify-end">
                    <span>Invoice</span>
                    {sortBy === 'money_invoice' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('compensated')}>
                  <div className="fp-th-content justify-end">
                    <span>ชดเชยรวม</span>
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-emerald-700" />
                      <span>กำลังโหลดข้อมูลรายงาน 9.2...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-slate-500">
                    ไม่พบรายการข้อมูลตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => (
                  <tr
                    key={item.vn || idx}
                    className={item.hasError ? 'has-error' : ''}
                    onClick={() => openInspectionModal(item)}
                    title="คลิกเพื่อดูรายละเอียดเวชระเบียนและข้อมูลบริการ"
                  >
                    <td style={{ textAlign: 'center' }} className="fp-mono text-slate-500">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="fp-mono">
                      <div>{formatThaiDate(item.vstdate)}</div>
                      <div className="text-xs text-slate-500">
                        {patientType === 'IPD'
                          ? `Dch: ${item.dchdate ? formatThaiDate(item.dchdate) : 'ยังไม่ Dch'}`
                          : item.vsttime || '—'}
                      </div>
                    </td>
                    <td className="fp-mono font-medium">{item.vn}</td>
                    <td className="fp-mono">{item.hn}</td>
                    <td>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard?.writeText(item.cid || '')
                          setCopiedField(`cid-${item.vn}`)
                          setTimeout(() => setCopiedField(null), 1500)
                        }}
                        title="คลิกเพื่อคัดลอกเลขบัตรประชาชน 13 หลัก"
                        className="fp-cid-btn fp-mono"
                      >
                        <span>{formatCidDisplay(item.cid)}</span>
                        {copiedField === `cid-${item.vn}` && (
                          <span className="fp-copied-indicator">คัดลอกแล้ว</span>
                        )}
                      </button>
                    </td>
                    <td className="font-medium">{item.ptname}</td>
                    <td style={{ textAlign: 'center' }} className="text-xs">
                      {item.sex} / {item.age} ปี
                    </td>
                    <td className="text-xs text-slate-600 max-w-[140px] truncate" title={item.pttypename}>
                      {item.pttypename}
                    </td>
                    <td className="text-xs text-slate-600">
                      <div>{item.department || '—'}</div>
                      <div className="text-slate-400">{item.clinic || ''}</div>
                    </td>
                    <td className="fp-mono text-xs">
                      {item.claimcode ? (
                        <span className="fp-badge fp-badge-info">{item.claimcode}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-xs max-w-[120px] truncate" title={item.dx || ''}>
                      <span className={item.errorDx ? 'text-rose-600 font-medium' : 'text-slate-700'}>
                        {item.dx || '—'}
                      </span>
                    </td>
                    <td className="text-xs max-w-[100px] truncate" title={item.op || ''}>
                      <span className={item.errorOp ? 'text-amber-700 font-medium' : 'text-slate-700'}>
                        {item.op || '—'}
                      </span>
                    </td>
                    <td className="text-xs max-w-[140px] truncate" title={item.drug || ''}>
                      <span className={item.errorDrug ? 'text-rose-600 font-medium' : 'text-slate-700'}>
                        {item.drug || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.hasError ? (
                        <div className="flex flex-col gap-1 items-center">
                          {item.errorDx && (
                            <span className="fp-badge fp-badge-danger" title={item.errorDx}>
                              {item.errorDx}
                            </span>
                          )}
                          {item.errorOp && (
                            <span className="fp-badge fp-badge-warning-op" title={item.errorOp}>
                              {item.errorOp}
                            </span>
                          )}
                          {item.errorDrug && (
                            <span className="fp-badge fp-badge-danger" title={item.errorDrug}>
                              {item.errorDrug}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="fp-badge fp-badge-ok">ครบถ้วน</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`fp-badge ${
                          item.status.includes('Invoice')
                            ? 'fp-badge-ok'
                            : item.status.includes('Rep')
                            ? 'fp-badge-info'
                            : item.status.includes('ยังไม่ส่ง')
                            ? 'fp-badge-pending'
                            : 'fp-badge-pending'
                        }`}
                        title={item.status}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="fp-mono text-xs">{item.rep || '—'}</td>
                    <td style={{ textAlign: 'right' }} className="fp-mono text-xs">
                      {formatMoney(item.money_eclaim)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="fp-mono text-xs">
                      {formatMoney(item.money_rep)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="fp-mono text-xs">
                      {formatMoney(item.money_invoice)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="fp-mono font-semibold text-emerald-700">
                      {formatMoney(item.compensated)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 9. Pagination */}
        <div className="fp-pagination">
          <div className="fp-pagination-info">
            แสดง {displayedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง{' '}
            {Math.min(currentPage * pageSize, totalCount)} จากทั้งหมด {totalCount.toLocaleString('th-TH')}{' '}
            รายการ (หน้า {currentPage} จาก {totalPages})
          </div>

          <div className="fp-pagination-controls">
            <div className="flex items-center gap-2 mr-3">
              <span className="text-xs text-slate-500">แสดงต่อหน้า:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="fp-select text-xs py-1 px-2"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <button
              type="button"
              className="fp-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || loading}
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
              <span>ก่อนหน้า</span>
            </button>
            <button
              type="button"
              className="fp-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              title="หน้าถัดไป"
            >
              <span>ถัดไป</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 10. Clinical Inspection Modal */}
      {selectedItem && (
        <div
          className="fp-modal-backdrop"
          onClick={closeInspectionModal}
          role="dialog"
          aria-modal="true"
        >
          <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fp-modal-header">
              <div>
                <div className="flex items-center gap-2">
                  <span className="fp-badge fp-badge-info">
                    {patientType === 'IPD' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)'}
                  </span>
                  <span className="fp-mono text-sm font-semibold">{selectedItem.vn}</span>
                </div>
                <h2 className="fp-modal-title">{selectedItem.ptname}</h2>
                <div className="fp-modal-header-sub">
                  HN: {selectedItem.hn} · CID: {formatCidDisplay(selectedItem.cid)} · เพศ: {selectedItem.sex} · อายุ:{' '}
                  {selectedItem.age} ปี
                </div>
              </div>
              <button
                type="button"
                className="fp-modal-close"
                onClick={closeInspectionModal}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="fp-modal-tabs">
              <button
                type="button"
                className={`fp-modal-tab ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                รายละเอียดบริการ 9.2 & การชดเชย
              </button>
              <button
                type="button"
                className={`fp-modal-tab ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => {
                  setModalTab('clinical')
                  if (!clinicalData && !clinicalLoading) {
                    fetchClinicalDetails(selectedItem.vn)
                  }
                }}
              >
                ข้อมูลเวชระเบียนใน HOSxP
              </button>
            </div>

            <div className="fp-modal-body">
              {modalTab === 'summary' && (
                <div className="fp-modal-content-stack">
                  {/* Quick Copy Action Bar */}
                  <div className="fp-quick-copy-bar">
                    <span className="fp-quick-copy-label">คัดลอกด่วน:</span>
                    <button
                      type="button"
                      className="fp-copy-btn"
                      onClick={() => copyText(selectedItem.vn, 'vn')}
                      title="คัดลอก VN"
                    >
                      {copiedField === 'vn' ? <Check size={12} /> : <Copy size={12} />}
                      <span>VN: {selectedItem.vn}</span>
                    </button>
                    <button
                      type="button"
                      className="fp-copy-btn"
                      onClick={() => copyText(selectedItem.hn, 'hn')}
                      title="คัดลอก HN"
                    >
                      {copiedField === 'hn' ? <Check size={12} /> : <Copy size={12} />}
                      <span>HN: {selectedItem.hn}</span>
                    </button>
                    <button
                      type="button"
                      className="fp-copy-btn"
                      onClick={() => copyText(selectedItem.cid, 'cid')}
                      title="คัดลอกเลขบัตรประชาชน 13 หลัก"
                    >
                      {copiedField === 'cid' ? <Check size={12} /> : <Copy size={12} />}
                      <span>CID: {formatCidDisplay(selectedItem.cid)}</span>
                    </button>
                    {selectedItem.claimcode && (
                      <button
                        type="button"
                        className="fp-copy-btn"
                        onClick={() => copyText(selectedItem.claimcode || '', 'claimcode')}
                        title="คัดลอก ClaimCode"
                      >
                        {copiedField === 'claimcode' ? <Check size={12} /> : <Copy size={12} />}
                        <span>ClaimCode: {selectedItem.claimcode}</span>
                      </button>
                    )}
                  </div>

                  {/* Errors / Warnings */}
                  {selectedItem.hasError ? (
                    <div className="fp-modal-alert fp-modal-alert--danger">
                      <div className="fp-modal-alert-header">
                        <AlertTriangle size={16} />
                        <span>พบข้อผิดพลาดที่ต้องตรวจสอบก่อนส่งเบิก</span>
                      </div>
                      <div className="fp-modal-alert-body">
                        {selectedItem.errorDx && <div>• {selectedItem.errorDx} (ต้องมีรหัสวินิจฉัย Z301)</div>}
                        {selectedItem.errorOp && <div>• {selectedItem.errorOp} (ต้องมีรหัสหัตถการ ICD-9: 697)</div>}
                        {selectedItem.errorDrug && (
                          <div>• {selectedItem.errorDrug} (ต้องมีรายการค่าบริการ ADP: 20003, FP001, 71681, 71682)</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="fp-modal-alert fp-modal-alert--success">
                      <CheckCircle2 size={16} />
                      <span className="font-semibold">
                        ข้อมูลการให้รหัสครบถ้วน (มี Dx Z301, Op 697 และรายการค่าบริการ ADP)
                      </span>
                    </div>
                  )}

                  {/* Summary Grid */}
                  <div className="fp-modal-grid-2">
                    <div className="fp-modal-card-box">
                      <div className="fp-modal-card-title">ข้อมูลการรับบริการ</div>
                      <div className="fp-modal-row">
                        <span className="fp-modal-label">วันที่รับบริการ:</span>
                        <span className="fp-modal-val font-medium">{formatThaiDate(selectedItem.vstdate)}</span>
                      </div>
                      <div className="fp-modal-row">
                        <span className="fp-modal-label">
                          {patientType === 'IPD' ? 'วันที่จำหน่าย:' : 'เวลาที่รับบริการ:'}
                        </span>
                        <span className="fp-modal-val font-medium">
                          {patientType === 'IPD'
                            ? selectedItem.dchdate
                              ? formatThaiDate(selectedItem.dchdate)
                              : 'ยังไม่จำหน่าย'
                            : selectedItem.vsttime || '—'}
                        </span>
                      </div>
                      <div className="fp-modal-row">
                        <span className="fp-modal-label">สิทธิการรักษา:</span>
                        <span className="fp-modal-val font-medium">{selectedItem.pttypename}</span>
                      </div>
                      <div className="fp-modal-row">
                        <span className="fp-modal-label">แผนก:</span>
                        <span className="fp-modal-val font-medium">{selectedItem.department || '—'}</span>
                      </div>
                      <div className="fp-modal-row">
                        <span className="fp-modal-label">คลินิก:</span>
                        <span className="fp-modal-val font-medium">{selectedItem.clinic || '—'}</span>
                      </div>
                      <div className="fp-modal-row">
                        <span className="fp-modal-label">ClaimCode:</span>
                        <span className="fp-modal-val font-medium fp-mono text-sky-700">
                          {selectedItem.claimcode || '—'}
                        </span>
                      </div>
                      <div className="fp-modal-divider">
                        <span className="fp-modal-label block">อาการสำคัญ (CC):</span>
                        <div className="fp-modal-cc-text">{selectedItem.cc || '—'}</div>
                      </div>
                    </div>

                    <div className="fp-modal-card-box">
                      <div className="fp-modal-card-title">ข้อมูลการวินิจฉัย & ค่าบริการ</div>
                      <div className="fp-modal-field-block">
                        <span className="fp-modal-label block">รหัสการวินิจฉัย (Dx):</span>
                        <span className="fp-modal-val font-medium">{selectedItem.dx || '—'}</span>
                      </div>
                      <div className="fp-modal-field-block">
                        <span className="fp-modal-label block">รหัสหัตถการ (Op ICD-9):</span>
                        <span className="fp-modal-val font-medium">{selectedItem.op || '—'}</span>
                      </div>
                      <div className="fp-modal-field-block">
                        <span className="fp-modal-label block">รายการค่าบริการ/ยา (ADP):</span>
                        <span className="fp-modal-val font-medium">{selectedItem.drug || '—'}</span>
                      </div>
                      <div className="fp-modal-divider">
                        <span className="fp-modal-label block">สถานะการชดเชย:</span>
                        <div className="fp-modal-val font-medium mt-1">{selectedItem.status}</div>
                        {selectedItem.rep && (
                          <div className="text-xs text-slate-500 mt-0.5">เลขที่ Rep: {selectedItem.rep}</div>
                        )}
                      </div>
                      <div className="fp-modal-divider fp-modal-row items-center">
                        <span className="font-semibold text-slate-700">ยอดชดเชยรวม:</span>
                        <span className="font-bold text-emerald-700 text-base fp-mono">
                          ฿{formatMoney(selectedItem.compensated)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'clinical' && (
                <div className="fp-modal-content-stack">
                  {clinicalLoading ? (
                    <div className="text-center py-10 text-slate-500">
                      <RefreshCw size={20} className="animate-spin text-emerald-700 mx-auto mb-2" />
                      <span>กำลังโหลดเวชระเบียนจากฐานข้อมูล HOSxP...</span>
                    </div>
                  ) : clinicalError ? (
                    <div className="fp-modal-alert fp-modal-alert--danger">
                      {clinicalError}
                    </div>
                  ) : clinicalData ? (
                    <div className="fp-modal-content-stack">
                      {/* Vitals */}
                      <div className="fp-modal-card-box">
                        <div className="fp-modal-card-title flex items-center gap-1.5">
                          <Activity size={14} />
                          <span>สัญญาณชีพ (Vital Signs)</span>
                        </div>
                        <div className="fp-vitals-grid">
                          <div className="fp-vital-item">
                            <span className="fp-modal-label">BP:</span> {clinicalData.screen?.bps || '—'}/
                            {clinicalData.screen?.bpd || '—'} mmHg
                          </div>
                          <div className="fp-vital-item">
                            <span className="fp-modal-label">Pulse:</span> {clinicalData.screen?.pulse || '—'} bpm
                          </div>
                          <div className="fp-vital-item">
                            <span className="fp-modal-label">Temp:</span>{' '}
                            {clinicalData.screen?.temperature || '—'} °C
                          </div>
                          <div className="fp-vital-item">
                            <span className="fp-modal-label">BW:</span> {clinicalData.screen?.bw || '—'} kg
                          </div>
                        </div>
                      </div>

                      {/* Diagnoses */}
                      <div className="fp-modal-card-box">
                        <div className="fp-modal-card-title flex items-center gap-1.5">
                          <Stethoscope size={14} />
                          <span>การวินิจฉัยโรค (Diagnoses)</span>
                        </div>
                        {clinicalData.diagnoses && clinicalData.diagnoses.length > 0 ? (
                          <div className="fp-diag-list">
                            {clinicalData.diagnoses.map((d, i) => (
                              <div key={i} className="fp-diag-item">
                                <span className="fp-mono font-medium text-sky-800">{d.icd10}</span>
                                <span>{d.icd_name}</span>
                                <span className="text-slate-400">({d.diagtype_name})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">ไม่พบข้อมูลการวินิจฉัย</span>
                        )}
                      </div>

                      {/* Drugs & Fees */}
                      <div className="fp-modal-card-box">
                        <div className="fp-modal-card-title flex items-center gap-1.5">
                          <Pill size={14} />
                          <span>รายการยาและค่าบริการ (Medications & Fees)</span>
                        </div>
                        {clinicalData.orders?.items && clinicalData.orders.items.length > 0 ? (
                          <div className="fp-order-list">
                            {clinicalData.orders.items.map((m, i) => (
                              <div key={i} className="fp-order-item">
                                <span>
                                  {m.item_name} {m.strength ? `(${m.strength})` : ''} x {m.qty} {m.units || ''}
                                </span>
                                <span className="fp-mono text-slate-600">฿{formatMoney(m.sum_price)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">ไม่พบรายการยาหรือค่าบริการ</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">ไม่พบข้อมูลเวชระเบียน</div>
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
