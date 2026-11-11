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
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Activity,
  ReceiptText,
} from 'lucide-react'
import type {
  CancerFundPatientItem,
  CancerFundSummary,
  CancerFundCardFilter,
  CancerFundSortField,
  CancerFundAdpMappingCheck,
  CancerFundReportResult,
} from '@/lib/clinical/rcmCancerFundService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { UC_ECLAIM_CODES } from '@/lib/clinical/pttypeConstants'
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

function renderPatientName(ptname: string) {
  if (!ptname) return '—'
  const trimmed = ptname.trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) {
    return <span className="cancer-name-part">{trimmed}</span>
  }
  const firstName = trimmed.substring(0, spaceIdx)
  const lastName = trimmed.substring(spaceIdx + 1).trim()
  return (
    <span className="cancer-name-wrap">
      <span className="cancer-name-part">{firstName}</span>{' '}
      <span className="cancer-name-part">{lastName}</span>
    </span>
  )
}

function escapeCsvCell(val: unknown): string {
  if (val == null) return '""'
  let str = String(val).trim()
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}

export interface CancerFundAdpClientProps {
  initialData?: CancerFundReportResult | null
}

export default function CancerFundAdpClient({ initialData = null }: CancerFundAdpClientProps) {
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

  // Date selection states: Standard Order: กำหนดเอง -> เดือน -> ปีงบประมาณ (Clean without parentheses)
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
  const [cardFilter, setCardFilter] = useState<CancerFundCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [statusFilter, setStatusFilter] = useState<string>(
    initialData?.statusFilter ?? 'ALL'
  )
  const [statusOptions, setStatusOptions] = useState<string[]>(
    initialData?.statusOptions ?? []
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
  const [sortBy, setSortBy] = useState<CancerFundSortField>(initialData?.sortBy ?? 'vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialData?.sortOrder ?? 'desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CancerFundPatientItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<CancerFundAdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: 'CANCER',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<CancerFundSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      totalInvoiceCompensated: 0,
      totalIncome: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      invoiceCount: 0,
      invoiceRate: 0,
      repCount: 0,
      repRate: 0,
      ucCount: 0,
      ucRate: 0,
    }
  )

  // Modal Detail states (opened directly by clicking any row)
  const [selectedItem, setSelectedItem] = useState<CancerFundPatientItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController refs & Cache
  const abortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const clinicalCacheRef = useRef<Map<string, VnClinicalDetails>>(new Map())
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

        if (statusFilter && statusFilter !== 'ALL') {
          query.set('statusFilter', statusFilter)
        }

        if (selectedPttypes.length > 0) {
          query.set('pttypes', selectedPttypes.join(','))
        } else if (ucOnly) {
          query.set('ucOnly', 'true')
        }

        if (refresh) query.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/cancer/adp?${query.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const json = await res.json()
        if (json.success && json.data) {
          const d: CancerFundReportResult = json.data
          setItems(d.items || [])
          setTotalCount(d.totalCount || 0)
          setTotalPages(d.totalPages || 1)
          setSummary(d.summary)
          setAdpMapping(d.adpMapping)
          if (d.statusOptions) {
            setStatusOptions(d.statusOptions)
          }
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
    [ds1, ds2, cardFilter, statusFilter, ucOnly, selectedPttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Double-fetch guard on mount
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
    return () => {
      abortRef.current?.abort()
      detailAbortRef.current?.abort()
    }
  }, [fetchData, initialData])

  // Fetch VN Clinical Details for modal
  const fetchVnDetails = useCallback(async (vn: string) => {
    if (clinicalCacheRef.current.has(vn)) {
      setVnDetails(clinicalCacheRef.current.get(vn)!)
      return
    }

    detailAbortRef.current?.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller

    setLoadingVnDetails(true)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/cancer/vn-details?vn=${encodeURIComponent(vn)}`,
        { signal: controller.signal }
      )
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          clinicalCacheRef.current.set(vn, json.data)
          if (clinicalCacheRef.current.size > 50) {
            const firstKey = clinicalCacheRef.current.keys().next().value
            if (firstKey) clinicalCacheRef.current.delete(firstKey)
          }
          setVnDetails(json.data)
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
    } finally {
      if (!controller.signal.aborted) {
        setLoadingVnDetails(false)
      }
    }
  }, [])

  // Open modal on record row click
  const handleRowClick = (item: CancerFundPatientItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
  }

  // Handle modal tab switch
  const handleModalTabChange = (tab: 'summary' | 'clinical') => {
    setModalTab(tab)
    if (tab === 'clinical' && selectedItem?.vn && !vnDetails) {
      fetchVnDetails(selectedItem.vn)
    }
  }

  // Date handlers
  const handleDateModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)
    if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      const mStr = String(selectedMonth).padStart(2, '0')
      setDs1(`${ceYear}-${mStr}-01`)
      setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceYear = selectedFiscalYear - 543
      setDs1(`${ceYear - 1}-10-01`)
      setDs2(`${ceYear}-09-30`)
    }
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    setCurrentPage(1)
    const ceYear = selectedBeYear - 543
    const lastDay = new Date(ceYear, month, 0).getDate()
    const mStr = String(month).padStart(2, '0')
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleBeYearChange = (beYear: number) => {
    setSelectedBeYear(beYear)
    setCurrentPage(1)
    const ceYear = beYear - 543
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    const mStr = String(selectedMonth).padStart(2, '0')
    setDs1(`${ceYear}-${mStr}-01`)
    setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleFiscalYearChange = (fiscalBeYear: number) => {
    setSelectedFiscalYear(fiscalBeYear)
    setCurrentPage(1)
    const ceYear = fiscalBeYear - 543
    setDs1(`${ceYear - 1}-10-01`)
    setDs2(`${ceYear}-09-30`)
  }

  // Card filter click handler
  const handleCardFilterClick = (filter: CancerFundCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Sort handler
  const handleSort = (field: CancerFundSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Copy helper for modal
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Modern Excel export (.xlsx)
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

      if (statusFilter && statusFilter !== 'ALL') {
        query.set('statusFilter', statusFilter)
      }

      if (selectedPttypes.length > 0) {
        query.set('pttypes', selectedPttypes.join(','))
      } else if (ucOnly) {
        query.set('ucOnly', 'true')
      }

      const res = await fetch(`/api/service/dashboard-rcm/funds/cancer/adp?${query.toString()}`)
      if (!res.ok) throw new Error('ไม่สามารถดาวน์โหลดข้อมูลเพื่อส่งออกได้')

      const json = await res.json()
      const exportItems: CancerFundPatientItem[] = json.data?.items || []

      const headers = [
        'ลำดับ',
        'วันที่รับบริการ',
        'เวลา',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        'สิทธิ์การรักษา',
        'ClaimCode',
        'แผนก',
        'คลินิก',
        'PDX',
        'DX0-5',
        'OP0-5',
        'รายการ ADP (CANCER)',
        'เลข Rep',
        'ยอดชดเชย (บาท)',
        'ยอดเรียกเก็บ (บาท)',
        'เลข Invoice',
        'ยอด Invoice (บาท)',
        'สถานะ e-Claim',
      ]

      const rows = exportItems.map((item, idx) => {
        const dxList = [item.dx0, item.dx1, item.dx2, item.dx3, item.dx4, item.dx5]
          .filter(Boolean)
          .join(', ')
        const opList = [item.op0, item.op1, item.op2, item.op3, item.op4, item.op5]
          .filter(Boolean)
          .join(', ')

        return [
          idx + 1,
          item.vstdate,
          item.vsttime,
          item.hn,
          item.cid,
          item.ptname,
          item.sex,
          item.age,
          item.pttypename,
          item.authencode || '',
          item.department || '',
          item.clinic || '',
          item.pdx || '',
          dxList,
          opList,
          item.listname,
          item.rep || '',
          item.compensated,
          item.income || 0,
          item.invoice || '',
          item.invoice_compensated,
          item.status_eclaim || item.status || '',
        ]
      })

      await exportRcmExcel({
        filename: `cancer_fund_adp_${ds1}_${ds2}.xlsx`,
        title: 'กองทุนมะเร็ง - รายชื่อผู้ป่วย จาก ADP (CANCER)',
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
    <div className="cancer-container">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="cancer-header">
        <div className="cancer-breadcrumb">
          <Link href="/service/dashboard-rcm">Dashboard RCM</Link>
          <span className="cancer-breadcrumb-sep">/</span>
          <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
          <span className="cancer-breadcrumb-sep">/</span>
          <span className="cancer-breadcrumb-current">กองทุนมะเร็ง</span>
        </div>

        <div className="cancer-title-row">
          <div className="cancer-title-main">
            <h1 className="cancer-title">กองทุนมะเร็ง</h1>
            <span className="cancer-subtitle">รายชื่อผู้ป่วย จาก ADP (CANCER)</span>
          </div>

          <div className="cancer-header-actions">
            <button
              type="button"
              className="cancer-btn cancer-btn-primary"
              onClick={handleExportExcel}
              disabled={isExporting || items.length === 0}
              title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
            >
              <Download size={16} />
              <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
            </button>
            <button
              type="button"
              className="cancer-btn"
              onClick={() => fetchData(true)}
              disabled={loading || isRefreshing}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              <span>รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ADP Mapping Warning Banner ──────────────────────────────────── */}
      {!adpMapping.isMapped && (
        <div className="cancer-adp-warning" role="alert">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <strong>แจ้งเตือน:</strong> คุณยังไม่ได้ Map รหัส ADP Code <code>{adpMapping.adpCode}</code> ในตาราง <code>s_drugitems</code> หรือ <code>drugitems</code>
          </div>
        </div>
      )}

      {/* ── Single-Row Date Selector & Filter Bar ──────────────────────── */}
      <div className="cancer-filter-bar">
        <div className="cancer-filter-row">
          <div className="cancer-date-selector">
            <div className="cancer-date-modes">
              <button
                type="button"
                className={`cancer-date-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
                onClick={() => handleDateModeChange('custom')}
              >
                กำหนดเอง
              </button>
              <button
                type="button"
                className={`cancer-date-mode-btn ${dateMode === 'monthly' ? 'active' : ''}`}
                onClick={() => handleDateModeChange('monthly')}
              >
                รายเดือน
              </button>
              <button
                type="button"
                className={`cancer-date-mode-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
                onClick={() => handleDateModeChange('fiscal')}
              >
                ปีงบประมาณ
              </button>
            </div>

            <div className="cancer-date-inputs">
              {dateMode === 'custom' && (
                <>
                  <ThaiDatePicker
                    value={ds1}
                    onChange={(val) => {
                      setDs1(val)
                      setCurrentPage(1)
                    }}
                  />
                  <span className="cancer-date-sep">ถึง</span>
                  <ThaiDatePicker
                    value={ds2}
                    onChange={(val) => {
                      setDs2(val)
                      setCurrentPage(1)
                    }}
                  />
                </>
              )}

              {dateMode === 'monthly' && (
                <>
                  <select
                    className="cancer-select"
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="cancer-select"
                    value={selectedBeYear}
                    onChange={(e) => handleBeYearChange(Number(e.target.value))}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {dateMode === 'fiscal' && (
                <select
                  className="cancer-select"
                  value={selectedFiscalYear}
                  onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
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

          <div className="cancer-search-box">
            <Search size={16} className="cancer-search-icon" />
            <input
              type="text"
              className="cancer-search-input"
              placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, PDX, ClaimCode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="cancer-search-clear"
                onClick={() => setSearch('')}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <PttypeMultiSelect
            selectedCodes={selectedPttypes}
            onChange={(codes) => {
              setSelectedPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          />

          <select
            className="cancer-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="เลือกสถานะ e-Claim / REP"
            title="สถานะ e-Claim / REP"
          >
            <option value="ALL">สถานะ e-Claim / REP: ทั้งหมด</option>
            <optgroup label="สถานะ REP">
              <option value="HAS_REP">มีเลข REP แล้ว</option>
              <option value="NO_REP">ไม่มีเลข REP</option>
            </optgroup>
            {statusOptions.length > 0 && (
              <optgroup label="สถานะ e-Claim">
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* ── Summary Cards Grid (Interactive Filter Cards) ───────────────── */}
      <div className="cancer-cards-grid">
        <div
          className={`cancer-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          title="คลิกเพื่อแสดงทั้งหมด"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">ผู้รับบริการทั้งหมด</span>
            <Activity size={16} className="text-gray-400" />
          </div>
          <div className="cancer-card-value">
            {(summary.totalVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            <span>{(summary.uniquePatients ?? 0).toLocaleString('th-TH')} คน</span>
            {(summary.totalIncome ?? 0) > 0 && (
              <>
                <span> • </span>
                <span>รวม ฿{formatMoney(summary.totalIncome)}</span>
              </>
            )}
          </div>
        </div>

        <div
          className={`cancer-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ชดเชยแล้ว"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">ชดเชยแล้ว</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="cancer-card-value">
            {(summary.compensatedVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            {(summary.compensationRate ?? 0).toFixed(1)}% ของทั้งหมด
          </div>
        </div>

        <div
          className={`cancer-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ชดเชย"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">ยังไม่ชดเชย</span>
            <AlertCircle size={16} className="text-amber-500" />
          </div>
          <div className="cancer-card-value">
            {(summary.uncompensatedVisits ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            {summary.totalVisits > 0
              ? (
                  ((summary.uncompensatedVisits ?? 0) / (summary.totalVisits ?? 1)) *
                  100
                ).toFixed(1)
              : '0.0'}
            %
          </div>
        </div>

        <div className="cancer-card cancer-card-non-clickable">
          <div className="cancer-card-header">
            <span className="cancer-card-label">ยอดชดเชยรวม (บาท)</span>
            <ReceiptText size={16} className="text-emerald-600" />
          </div>
          <div className="cancer-card-value">
            {(summary.totalCompensated ?? 0).toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="cancer-card-sub">
            เฉลี่ย {(summary.averageCompensated ?? 0).toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} บาท/ครั้ง
          </div>
        </div>

        {/* ── แถวที่ 2: สิทธิ์และกระบวนการเคลม (4 ใบพอดีกัน) ── */}
        <div
          className={`cancer-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">มี ClaimCode</span>
            <ShieldCheck size={16} className="text-blue-600" />
          </div>
          <div className="cancer-card-value">
            {(summary.withAuthenCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            {(summary.authenRate ?? 0).toFixed(1)}%
          </div>
        </div>

        <div
          className={`cancer-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ไม่มี ClaimCode"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">ไม่มี ClaimCode</span>
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <div className="cancer-card-value">
            {(summary.withoutAuthenCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            {summary.totalVisits > 0
              ? (
                  ((summary.withoutAuthenCount ?? 0) / (summary.totalVisits ?? 1)) *
                  100
                ).toFixed(1)
              : '0.0'}
            %
          </div>
        </div>

        <div
          className={`cancer-card ${cardFilter === 'INVOICE' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('INVOICE')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี Invoice"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">มี Invoice แล้ว</span>
            <ReceiptText size={16} className="text-teal-600" />
          </div>
          <div className="cancer-card-value">
            {(summary.invoiceCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            {(summary.invoiceRate ?? 0).toFixed(1)}%
          </div>
        </div>

        <div
          className={`cancer-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => handleCardFilterClick('UC_ONLY')}
          title="คลิกเพื่อกรองเฉพาะสิทธิ์บัตรทอง (UC)"
        >
          <div className="cancer-card-header">
            <span className="cancer-card-label">สิทธิ์บัตรทอง (UC)</span>
            <ShieldCheck size={16} className="text-green-600" />
          </div>
          <div className="cancer-card-value">
            {(summary.ucCount ?? 0).toLocaleString('th-TH')}
          </div>
          <div className="cancer-card-sub">
            {(summary.ucRate ?? 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ── Table Container ─────────────────────────────────────────────── */}
      <div className="cancer-table-wrapper">
        <div className="cancer-table-toolbar">
          <div className="cancer-table-info">
            แสดง {items.length.toLocaleString('th-TH')} จากทั้งหมด {totalCount.toLocaleString('th-TH')} รายการ
          </div>

          {cardFilter !== 'ALL' && (
            <div className="cancer-active-filter-badge">
              <span>ตัวกรอง: {cardFilter}</span>
              <button
                type="button"
                onClick={() => setCardFilter('ALL')}
                className="hover:opacity-75"
                title="ล้างตัวกรองการ์ด"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {selectedPttypes.length > 0 && (
            <div className="cancer-active-filter-badge">
              <span>
                สิทธิ:{' '}
                {selectedPttypes.length === UC_ECLAIM_CODES.length &&
                UC_ECLAIM_CODES.every((c) => selectedPttypes.includes(c))
                  ? 'เฉพาะบัตรทอง (UC)'
                  : `${selectedPttypes.length} สิทธิ (${selectedPttypes.join(', ')})`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPttypes([])
                  setCurrentPage(1)
                }}
                className="hover:opacity-75"
                title="ล้างตัวกรองสิทธิ"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {statusFilter !== 'ALL' && (
            <div className="cancer-active-filter-badge">
              <span>
                สถานะ:{' '}
                {statusFilter === 'HAS_REP'
                  ? 'มีเลข REP แล้ว'
                  : statusFilter === 'NO_REP'
                  ? 'ไม่มีเลข REP'
                  : statusFilter}
              </span>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL')
                  setCurrentPage(1)
                }}
                className="hover:opacity-75"
                title="ล้างตัวกรองสถานะ e-Claim / REP"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="cancer-table-scroll">
          <table className="cancer-table">
            <thead>
              <tr>
                <th className="col-center">ลำดับ</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('vstdate')}
                  >
                    <span>วันที่รับบริการ</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('vsttime')}
                  >
                    <span>เวลา</span>
                    {sortBy === 'vsttime' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('hn')}
                  >
                    <span>HN</span>
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="col-center">เลขบัตรประชาชน</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('ptname')}
                  >
                    <span>ชื่อ-สกุลผู้ป่วย</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('age')}
                  >
                    <span>อายุ</span>
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="col-center">สิทธิ์การรักษา</th>
                <th className="col-center">ClaimCode</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('pdx')}
                  >
                    <span>PDX</span>
                    {sortBy === 'pdx' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="col-center">รายการ ADP (CANCER)</th>
                <th className="col-center">สถานะ e-Claim / REP</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="cancer-sort-btn"
                    onClick={() => handleSort('compensated')}
                  >
                    <span>ชดเชย (บาท)</span>
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, rowIdx) => (
                  <tr key={`skeleton-${rowIdx}`} className="rcm-skeleton-row">
                    {Array.from({ length: 13 }).map((__, colIdx) => (
                      <td key={colIdx} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={13}>
                    <div className="cancer-state-container">
                      <AlertCircle size={24} className="text-rose-600" />
                      <p className="cancer-state-title">เกิดข้อผิดพลาด</p>
                      <p className="cancer-state-desc">{error}</p>
                      <button
                        type="button"
                        className="cancer-btn cancer-btn-primary"
                        onClick={() => fetchData(true)}
                      >
                        ลองใหม่อีกครั้ง
                      </button>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13}>
                    <div className="cancer-state-container">
                      <Search size={24} className="text-gray-400" />
                      <p className="cancer-state-title">ไม่พบรายการข้อมูล</p>
                      <p className="cancer-state-desc">
                        ไม่พบรายชื่อผู้ป่วยที่ตรงตามเงื่อนไขช่วงเวลาหรือตัวกรองที่เลือก
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.vn}
                    onClick={() => handleRowClick(item)}
                    title="คลิกเพื่อดูรายละเอียดผู้ป่วย"
                  >
                    <td className="col-center tabular-nums">{item.no}</td>
                    <td className="col-center whitespace-nowrap">
                      {formatThaiDate(item.vstdate)}
                    </td>
                    <td className="col-center tabular-nums">{item.vsttime || '—'}</td>
                    <td className="col-center font-mono font-medium">{item.hn}</td>
                    <td className="col-center font-mono text-gray-700">{item.cid}</td>
                    <td className="col-center">{renderPatientName(item.ptname)}</td>
                    <td className="col-center tabular-nums whitespace-nowrap">
                      {item.age}&nbsp;ปี
                    </td>
                    <td className="col-center whitespace-nowrap text-xs">
                      {item.pttypename || '—'}
                    </td>
                    <td className="col-center font-mono">
                      {item.authencode ? (
                        <span className="cancer-badge badge-success">{item.authencode}</span>
                      ) : (
                        <span className="cancer-badge badge-neutral">—</span>
                      )}
                    </td>
                    <td className="col-center font-mono font-semibold text-emerald-800">
                      {item.pdx || '—'}
                    </td>
                    <td className="col-center text-xs max-w-xs truncate" title={item.listname}>
                      {item.listname || '—'}
                    </td>
                    <td className="col-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`cancer-badge ${
                            item.isCompensated
                              ? 'badge-success'
                              : (item.status_eclaim || item.status || '').includes('ยังไม่ได้ส่ง')
                              ? 'badge-neutral'
                              : 'badge-info'
                          }`}
                        >
                          {item.status_eclaim || item.status || '- :: ยังไม่ได้ส่ง'}
                        </span>
                        {item.rep && (
                          <span className="font-mono text-xs text-slate-500 font-medium">
                            Rep: {item.rep}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="col-center font-semibold tabular-nums">
                      {formatMoney(item.compensated)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <div className="cancer-pagination">
          <div className="cancer-pagination-info">
            หน้า {currentPage} จาก {totalPages} หน้า (รวม {totalCount.toLocaleString('th-TH')} รายการ)
          </div>

          <div className="cancer-pagination-controls">
            <button
              type="button"
              className="cancer-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-sm font-medium px-2">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="cancer-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Modal (Opened by clicking record) ──────────────────────── */}
      {selectedItem && (
        <div className="cancer-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="cancer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancer-modal-header">
              <div className="cancer-modal-title-group">
                <h3 className="cancer-modal-title">
                  {selectedItem.ptname} (HN: {selectedItem.hn})
                </h3>
                <span className="cancer-modal-subtitle">
                  VN: {selectedItem.vn} | วันที่รับบริการ:{' '}
                  {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime}
                </span>
              </div>
              <button
                type="button"
                className="cancer-modal-close"
                onClick={() => setSelectedItem(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cancer-modal-tabs">
              <button
                type="button"
                className={`cancer-modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('summary')}
              >
                ข้อมูลสรุปการรับบริการ
              </button>
              <button
                type="button"
                className={`cancer-modal-tab-btn ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleModalTabChange('clinical')}
              >
                เวชระเบียนคลินิก (Clinical)
              </button>
            </div>

            <div className="cancer-modal-body">
              {modalTab === 'summary' && (
                <div className="cancer-detail-grid">
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">ชื่อ-สกุล</span>
                    <span className="cancer-detail-value">{selectedItem.ptname}</span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">เลขประจำตัวประชาชน</span>
                    <span className="cancer-detail-value font-mono flex items-center gap-2">
                      {selectedItem.cid}
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedItem.cid, 'cid')}
                        className="text-gray-400 hover:text-gray-600"
                        title="คัดลอกเลขบัตรประชาชน"
                      >
                        {copiedField === 'cid' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      </button>
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">เพศ / อายุ</span>
                    <span className="cancer-detail-value">
                      {selectedItem.sex} / {selectedItem.age} ปี
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">สัญชาติ</span>
                    <span className="cancer-detail-value">{selectedItem.nation || 'ไทย'}</span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">สิทธิ์การรักษา</span>
                    <span className="cancer-detail-value">{selectedItem.pttypename || '—'}</span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">ClaimCode:</span>
                    <span className="cancer-detail-value font-mono">
                      {selectedItem.authencode || '—'}
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">แผนกที่รับบริการ</span>
                    <span className="cancer-detail-value">{selectedItem.department || '—'}</span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">คลินิก</span>
                    <span className="cancer-detail-value">{selectedItem.clinic || '—'}</span>
                  </div>

                  <div className="cancer-detail-section-title">การวินิจฉัยและหัตถการ</div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">การวินิจฉัยหลัก (PDX)</span>
                    <span className="cancer-detail-value font-mono font-semibold text-emerald-800">
                      {selectedItem.pdx || '—'}
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">การวินิจฉัยร่วม (DX0-5)</span>
                    <span className="cancer-detail-value font-mono">
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
                  <div className="cancer-detail-item col-span-2">
                    <span className="cancer-detail-label">หัตถการ (OP0-5)</span>
                    <span className="cancer-detail-value font-mono">
                      {[
                        selectedItem.op0,
                        selectedItem.op1,
                        selectedItem.op2,
                        selectedItem.op3,
                        selectedItem.op4,
                        selectedItem.op5,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </span>
                  </div>
                  <div className="cancer-detail-item col-span-2">
                    <span className="cancer-detail-label">รายการยา/บริการจาก ADP (CANCER)</span>
                    <span className="cancer-detail-value font-medium text-emerald-900">
                      {selectedItem.listname || '—'}
                    </span>
                  </div>

                  <div className="cancer-detail-section-title">ข้อมูลการชดเชยและ e-Claim</div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">สถานะ e-Claim / REP</span>
                    <span className="cancer-detail-value">{selectedItem.status_eclaim || selectedItem.status}</span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">เลข Rep / Fund</span>
                    <span className="cancer-detail-value font-mono">
                      {selectedItem.rep || '—'} {selectedItem.subfund ? `(${selectedItem.subfund})` : selectedItem.fund ? `(${selectedItem.fund})` : ''}
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">ยอดค่ารักษาเรียกเก็บ (บาท)</span>
                    <span className="cancer-detail-value font-semibold">
                      {formatMoney(selectedItem.income)}
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">ยอดชดเชย Rep (บาท)</span>
                    <span className="cancer-detail-value font-semibold text-emerald-700">
                      {formatMoney(selectedItem.compensated)}
                    </span>
                  </div>
                  <div className="cancer-detail-item">
                    <span className="cancer-detail-label">เลข Invoice / ยอดชดเชย Invoice</span>
                    <span className="cancer-detail-value">
                      {selectedItem.invoice || '—'} (
                      {formatMoney(selectedItem.invoice_compensated)} บาท)
                    </span>
                  </div>
                  {selectedItem.remark && (
                    <div className="cancer-detail-item col-span-2">
                      <span className="cancer-detail-label">หมายเหตุ</span>
                      <span className="cancer-detail-value text-amber-700">{selectedItem.remark}</span>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {loadingVnDetails ? (
                    <div className="cancer-state-container">
                      <RefreshCw size={24} className="animate-spin text-emerald-700" />
                      <p className="cancer-state-title">กำลังโหลดเวชระเบียนคลินิก...</p>
                    </div>
                  ) : vnDetails ? (
                    <div className="cancer-detail-grid">
                      <div className="cancer-detail-item">
                        <span className="cancer-detail-label">แผนก / แผนกย่อย</span>
                        <span className="cancer-detail-value">
                          {vnDetails.header?.department || '—'} / {vnDetails.header?.clinic || '—'}
                        </span>
                      </div>
                      <div className="cancer-detail-item">
                        <span className="cancer-detail-label">อาการสำคัญ (Chief Complaint)</span>
                        <span className="cancer-detail-value">{vnDetails.screen?.cc || '—'}</span>
                      </div>
                      {vnDetails.screen && (
                        <div className="cancer-detail-item col-span-2">
                          <span className="cancer-detail-label">สัญญาณชีพและข้อมูลร่างกาย (Vital Signs)</span>
                          <span className="cancer-detail-value">
                            BP: {vnDetails.screen.bps || '—'}/{vnDetails.screen.bpd || '—'} mmHg • PR:{' '}
                            {vnDetails.screen.pulse || '—'} bpm • Temp: {vnDetails.screen.temperature || '—'} °C • BW:{' '}
                            {vnDetails.screen.bw || '—'} kg • Height: {vnDetails.screen.height || '—'} cm • BMI:{' '}
                            {vnDetails.screen.bmi || '—'}
                          </span>
                        </div>
                      )}

                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <>
                          <div className="cancer-detail-section-title">รายการวินิจฉัย (Diagnoses)</div>
                          <div className="col-span-2 space-y-1">
                            {vnDetails.diagnoses.map((d, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-sm py-1 border-b border-dashed border-gray-200"
                              >
                                <span>
                                  <strong>[{d.icd10}]</strong> {d.icd_name}
                                </span>
                                <span className="text-gray-500 text-xs">{d.diagtype_name || ''}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <>
                          <div className="cancer-detail-section-title">รายการยา เวชภัณฑ์ และบริการใน Visit</div>
                          <div className="col-span-2 space-y-1">
                            {vnDetails.orders.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-sm py-1 border-b border-dashed border-gray-200"
                              >
                                <span>
                                  {it.item_name} {it.qty ? `(x${it.qty})` : ''}
                                </span>
                                <span className="text-gray-600 text-xs tabular-nums">
                                  {it.income_name || it.drugusage_text || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="cancer-state-container">
                      <p className="cancer-state-title">ไม่พบข้อมูลเวชระเบียนคลินิก</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="cancer-modal-footer">
              <button
                type="button"
                className="cancer-btn"
                onClick={() => setSelectedItem(null)}
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
