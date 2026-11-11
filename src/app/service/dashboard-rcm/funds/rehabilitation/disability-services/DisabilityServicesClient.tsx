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
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  FileX2,
  ReceiptText,
  Clock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import type {
  RehabServiceItem,
  RehabSummary,
  RehabCardFilter,
  RehabSortField,
  RehabReportResult,
  RehabAdpMappingCheck,
} from '@/lib/clinical/rcmRehabilitationService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
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

export interface DisabilityServicesClientProps {
  initialData?: RehabReportResult | null
}

export default function DisabilityServicesClient({
  initialData = null,
}: DisabilityServicesClientProps) {
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

  // Date mode: 1. กำหนดเอง -> 2. เดือน -> 3. ปีงบประมาณ (No numbers in tabs)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('fiscal')
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
  const [cardFilter, setCardFilter] = useState<RehabCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<RehabSortField>(
    initialData?.sortBy ?? 'vstdate'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialData?.sortOrder ?? 'desc'
  )
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<RehabServiceItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<RehabAdpMappingCheck | null>(
    initialData?.adpMapping ?? null
  )
  const [summary, setSummary] = useState<RehabSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      matchedCases: 0,
      matchedRate: 0,
      notInWebCases: 0,
      notInWebRate: 0,
      noRehabCodeCases: 0,
      noRehabCodeRate: 0,
      noVnCases: 0,
      noVnRate: 0,
      compensatedCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      uncompensatedCases: 0,
      withAuthenCases: 0,
      withAuthenRate: 0,
      noAuthenCases: 0,
      ucCases: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<RehabServiceItem | null>(null)
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
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/rehabilitation/disability-services?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        const json = await res.json()

        if (!json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }

        const data: RehabReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        setAdpMapping(data.adpMapping)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, pttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Fetch when filters or pagination changes (skip first paint if initialData provided)
  const isFirstMount = useRef(true)
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

  // Handle Date Mode Changes
  const applyDateMode = (
    mode: 'custom' | 'monthly' | 'fiscal',
    fiscalYear: number,
    month: number,
    beYear: number
  ) => {
    if (mode === 'custom') return

    if (mode === 'monthly') {
      const ceYear = beYear - 543
      const padMonth = String(month).padStart(2, '0')
      const lastDay = new Date(ceYear, month, 0).getDate()
      setDs1(`${ceYear}-${padMonth}-01`)
      setDs2(`${ceYear}-${padMonth}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const endCeYear = fiscalYear - 543
      const startCeYear = endCeYear - 1
      setDs1(`${startCeYear}-10-01`)
      setDs2(`${endCeYear}-09-30`)
    }
  }

  const handleModeChange = (newMode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(newMode)
    applyDateMode(newMode, selectedFiscalYear, selectedMonth, selectedBeYear)
    setCurrentPage(1)
  }

  // Handle Sort
  const handleSort = (field: RehabSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Card Filter Selection
  const handleCardClick = (filter: RehabCardFilter) => {
    if (cardFilter === filter) {
      setCardFilter('ALL')
    } else {
      setCardFilter(filter)
    }
    setCurrentPage(1)
  }

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Export CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/rehabilitation/disability-services?${queryParams.toString()}`
      )
      const json = await res.json()

      if (!json.success) throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')

      const exportItems: RehabServiceItem[] = json.data?.items || []

      // Prepare CSV columns
      const headers = [
        'ลำดับ',
        'VN',
        'AN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'วันที่รับบริการ',
        'เวลา',
        'ClaimCode',
        'สิทธิหลัก',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'ค่าบริการ HOSxP',
        'รายการฟื้นฟู Web Disability',
        'รหัส ADP HOSxP',
        'สถานะการ Reconcile',
        'แหล่งข้อมูล',
        'สถานะชดเชย',
        'เลขที่หนังสือ REP',
        'ยอดเงินชดเชย',
        'REP Seamless',
        'PayNo',
        'ยอดชดเชย Seamless',
        'เหตุผลไม่ชดเชย',
        'การวินิจฉัย (ICD-10)',
        'หัตถการ (ICD-9)',
        'แพทย์ผู้ตรวจ',
        'กลุ่มเป้าหมาย',
        'ประเภทความพิการ',
        'คะแนน ADL',
        'วันที่เริ่มบริการ',
        'วันที่สิ้นสุดบริการ',
        'ราคาต่อหน่วย',
        'ราคาสุทธิ',
        'ผู้ให้บริการ',
        'Serial No',
        'สถานะใน Web',
        'ชื่อไฟล์นำเข้า',
      ]

      const rows = exportItems.map((row) => [
        row.no,
        row.vn || '',
        row.an || '',
        row.hn || '',
        row.cid || '',
        row.ptname || '',
        row.vstdate,
        row.vsttime,
        row.authencode || '',
        row.maininscl || '',
        row.pttypename || '',
        row.department || '',
        row.clinic || '',
        row.income,
        row.rehab_name || '',
        row.rehab_code || '',
        row.match_status,
        row.filetype,
        row.status || '',
        row.rep || '',
        row.compensated,
        row.rep_seamless || '',
        row.payno || '',
        row.compensated_seamless,
        row.noCompensated || '',
        row.diag || '',
        row.oper || '',
        row.doctorname || '',
        row.targetgroup || '',
        row.deformed_type || '',
        row.adl || '',
        row.startservice || '',
        row.endservice || '',
        row.unitprice ?? '',
        row.realprice ?? '',
        row.staff || '',
        row.serialno || '',
        row.web_status || '',
        row.filename || '',
      ])

      await exportRcmExcel({
        filename: `rehab_disability_services_${ds1}_to_${ds2}.xlsx`,
        title: 'รายงานการให้บริการฟื้นฟูสมรรถภาพคนพิการ',
        subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล')
    } finally {
      setIsExporting(false)
    }
  }

  // Parse itemized list in modal
  const parsedItemsDetail = useMemo(() => {
    if (!selectedItem?.listname) return []
    return selectedItem.listname.split('||').map((itemStr) => {
      const [icode, adpCode, name, price] = itemStr.split('#')
      return {
        icode: icode || '',
        adpCode: adpCode || '',
        name: name || '',
        price: Number(price || 0),
      }
    })
  }, [selectedItem])

  // Helper to split patient name into first and last name for intact wrapping
  const splitPtName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return { first: fullName, last: '' }
    const last = parts.pop() || ''
    const first = parts.join(' ')
    return { first, last }
  }

  return (
    <div className="rehab-page">
      {/* ── 1. Clean Breadcrumb (No Eyebrow Badges) ── */}
      <nav className="rehab-breadcrumb" aria-label="breadcrumb">
        <Link href="/">หน้าหลัก</Link>
        <span className="rehab-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm">รายงาน RCM</Link>
        <span className="rehab-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
        <span className="rehab-breadcrumb-sep">/</span>
        <span>กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์</span>
        <span className="rehab-breadcrumb-sep">/</span>
        <span>รายการการให้บริการฟื้นฟูสมรรถภาพ</span>
        <span className="rehab-breadcrumb-sep">/</span>
        <span className="rehab-breadcrumb-current">
          รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability
        </span>
      </nav>

      {/* ── Header Bar ── */}
      <div className="rehab-header">
        <div className="rehab-title-group">
          <h1 className="rehab-title">
            รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability
          </h1>
          <p className="rehab-subtitle">
            <span>กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์</span>
            <span className="rehab-subtitle-dot">·</span>
            <span>รายการการให้บริการฟื้นฟูสมรรถภาพ</span>
            <span className="rehab-subtitle-dot">·</span>
            <span>เปรียบเทียบข้อมูลบริการระหว่าง HOSxP และเว็บ Disability</span>
          </p>
        </div>

        <div className="rehab-actions">
          <button
            type="button"
            className="rehab-btn rehab-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'rehab-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}</span>
          </button>

          <button
            type="button"
            className="rehab-btn rehab-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} className={isExporting ? 'rehab-spin' : ''} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. ADP Mapping Warning Banner (If Not Mapped) ── */}
      {adpMapping && !adpMapping.isMapped && (
        <div className="rehab-warning-banner" role="alert">
          <div className="rehab-warning-content">
            <AlertTriangle size={20} className="flex-shrink-0" />
            <div>
              <strong>ยังไม่ได้ Map รหัส ADP ฟื้นฟูสมรรถภาพในระบบ:</strong>
              <span>
                {' '}
                ไม่พบรายการค่าบริการที่ผูกกับรหัส ADP ฟื้นฟูสมรรถภาพทั้ง 16 รหัสในตาราง
                s_drugitems หรือ nondrugitems กรุณาตรวจสอบการตั้งค่ารหัสค่าใช้จ่าย
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Unified Single-Row Date Selector ── */}
      <div className="rehab-date-container">
        <div className="rehab-segmented-group" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`rehab-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`rehab-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`rehab-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="rehab-date-divider" aria-hidden="true" />

        <div className="rehab-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="rehab-control-group">
                <span className="rehab-control-label">ตั้งแต่วันที่:</span>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="rehab-control-group">
                <span className="rehab-control-label">ถึงวันที่:</span>
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
              <div className="rehab-control-group">
                <span className="rehab-control-label">เลือกเดือน:</span>
                <select
                  className="rehab-select"
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
              <div className="rehab-control-group">
                <span className="rehab-control-label">พ.ศ.:</span>
                <select
                  className="rehab-select"
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
            <div className="rehab-control-group">
              <span className="rehab-control-label">เลือกปีงบประมาณ:</span>
              <select
                className="rehab-select"
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

      {/* ── 5. Balanced KPI Summary Cards (4 Columns x 2 Rows) ── */}
      <div className="rehab-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด (ALL) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('ALL')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ALL')}
          title="คลิกเพื่อกรอง: แสดงผู้รับบริการทั้งหมด"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">ผู้รับบริการทั้งหมด</span>
            <div className="rehab-card-icon is-primary">
              <Activity size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.totalCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">100%</span>
          </div>
        </div>

        {/* Card 2: ตรงกันทั้ง 2 ระบบ (MATCHED) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'MATCHED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('MATCHED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('MATCHED')}
          title="คลิกเพื่อกรอง: มีข้อมูลตรงกันทั้ง HOSxP และเว็บ Disability"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">ตรงกันทั้ง 2 ระบบ</span>
            <div className="rehab-card-icon is-success">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.matchedCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">{summary.matchedRate}%</span>
          </div>
        </div>

        {/* Card 3: ไม่พบใน Web (NOT_IN_WEB) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'NOT_IN_WEB' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('NOT_IN_WEB')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('NOT_IN_WEB')}
          title="คลิกเพื่อกรอง: มีใน HOSxP แต่ยังไม่พบในเว็บ Disability"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">ไม่พบใน Web Disability</span>
            <div className="rehab-card-icon is-warning">
              <FileQuestion size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.notInWebCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">{summary.notInWebRate}%</span>
          </div>
        </div>

        {/* Card 4: ขาดรหัส ADP ใน HOSxP (NO_REHAB_CODE) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'NO_REHAB_CODE' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('NO_REHAB_CODE')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('NO_REHAB_CODE')}
          title="คลิกเพื่อกรอง: มีใน Web แต่ใน HOSxP ยังไม่ได้คีย์รหัสฟื้นฟู ADP"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">HOSxP ขาดรหัส ADP</span>
            <div className="rehab-card-icon is-caution">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.noRehabCodeCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">{summary.noRehabCodeRate}%</span>
          </div>
        </div>

        {/* Card 5: ชดเชยแล้ว (COMPENSATED) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('COMPENSATED')}
          title="คลิกเพื่อกรอง: ได้รับการชดเชยค่าบริการแล้ว"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">ชดเชยแล้ว</span>
            <div className="rehab-card-icon is-success">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.compensatedCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">
              ฿{formatMoney(summary.totalCompensated)} ({summary.compensationRate}%)
            </span>
          </div>
        </div>

        {/* Card 6: ยังไม่ชดเชย / รอชดเชย (UNCOMPENSATED) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรอง: ยังไม่ได้รับการชดเชยค่าบริการ"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">ยังไม่ชดเชย / รอชดเชย</span>
            <div className="rehab-card-icon">
              <Clock size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.uncompensatedCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">
              {summary.totalCases > 0
                ? ((summary.uncompensatedCases / summary.totalCases) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Card 7: มี ClaimCode (WITH_AUTHEN) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรอง: มีรหัสยืนยันตัวตน ClaimCode"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">มี ClaimCode</span>
            <div className="rehab-card-icon is-primary">
              <KeyRound size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.withAuthenCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">{summary.withAuthenRate}%</span>
          </div>
        </div>

        {/* Card 8: ไม่มี VN ใน HOSxP (NO_VN) */}
        <div
          role="button"
          tabIndex={0}
          className={`rehab-card ${cardFilter === 'NO_VN' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('NO_VN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('NO_VN')}
          title="คลิกเพื่อกรอง: มีข้อมูลในเว็บ Disability แต่ยังไม่มีเลข VN ใน HOSxP"
        >
          <div className="rehab-card-header">
            <span className="rehab-card-title">ไม่มี VN ใน HOSxP</span>
            <div className="rehab-card-icon is-danger">
              <FileX2 size={18} />
            </div>
          </div>
          <div className="rehab-card-body">
            <div>
              <span className="rehab-card-value">{summary.noVnCases.toLocaleString()}</span>
              <span className="rehab-card-unit">ราย</span>
            </div>
            <span className="rehab-card-rate">{summary.noVnRate}%</span>
          </div>
        </div>
      </div>

      {/* ── 6. Toolbar & Global Search ── */}
      <div className="rehab-toolbar">
        <div className="rehab-search-box">
          <Search size={18} className="rehab-search-icon" />
          <input
            type="text"
            className="rehab-search-input"
            placeholder="ค้นหา HN, CID, ชื่อ-สกุล, VN, รหัส ADP, รายการฟื้นฟู, หรือเลข REP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="rehab-search-clear"
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

        {cardFilter !== 'ALL' && (
          <div className="rehab-active-chip">
            <span>
              ฟิลเตอร์:{' '}
              {cardFilter === 'MATCHED'
                ? 'ตรงกันทั้ง 2 ระบบ'
                : cardFilter === 'NOT_IN_WEB'
                ? 'ไม่พบใน Web Disability'
                : cardFilter === 'NO_REHAB_CODE'
                ? 'HOSxP ขาดรหัส ADP'
                : cardFilter === 'NO_VN'
                ? 'ไม่มี VN ใน HOSxP'
                : cardFilter === 'COMPENSATED'
                ? 'ชดเชยแล้ว'
                : cardFilter === 'UNCOMPENSATED'
                ? 'ยังไม่ชดเชย'
                : cardFilter === 'WITH_AUTHEN'
                ? 'มี ClaimCode'
                : cardFilter === 'NO_AUTHEN'
                ? 'ไม่มี ClaimCode'
                : 'สิทธิบัตรทอง'}
            </span>
            <button
              type="button"
              className="rehab-active-chip-clear"
              onClick={() => handleCardClick('ALL')}
              title="ยกเลิกฟิลเตอร์"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── 7. Data Table (Row-Clickable Records) ── */}
      <div className="rehab-table-card">
        <div className="rehab-table-responsive">
          <table className="rehab-table">
            <thead>
              <tr>
                <th className="col-center" style={{ width: '50px' }}>
                  ลำดับ
                </th>
                <th className="col-center" style={{ width: '120px' }}>
                  <button
                    type="button"
                    className="rehab-th-sort"
                    onClick={() => handleSort('vstdate')}
                  >
                    <span>วันที่รับบริการ</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <button
                    type="button"
                    className="rehab-th-sort"
                    onClick={() => handleSort('vn')}
                  >
                    <span>VN</span>
                    {sortBy === 'vn' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ width: '90px' }}>
                  <button
                    type="button"
                    className="rehab-th-sort"
                    onClick={() => handleSort('hn')}
                  >
                    <span>HN</span>
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ width: '135px' }}>
                  <span>เลขบัตรประชาชน</span>
                </th>
                <th className="col-center" style={{ minWidth: '170px' }}>
                  <button
                    type="button"
                    className="rehab-th-sort"
                    onClick={() => handleSort('ptname')}
                  >
                    <span>ชื่อ-สกุลผู้ป่วย</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ width: '90px' }}>
                  <span>สิทธิ</span>
                </th>
                <th className="col-center" style={{ minWidth: '180px' }}>
                  <span>รายการฟื้นฟู Web</span>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>รหัส ADP HOSxP</span>
                </th>
                <th className="col-center" style={{ width: '150px' }}>
                  <button
                    type="button"
                    className="rehab-th-sort"
                    onClick={() => handleSort('match_status')}
                  >
                    <span>สถานะตรวจสอบ</span>
                    {sortBy === 'match_status' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <button
                    type="button"
                    className="rehab-th-sort"
                    onClick={() => handleSort('compensated')}
                  >
                    <span>ชดเชย (บาท)</span>
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ width: '120px' }}>
                  <span>สถานะชดเชย</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="rcm-skeleton-row">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="rehab-empty-state">
                    <FileQuestion size={44} className="rehab-empty-icon" />
                    <p className="rehab-empty-title">ไม่พบข้อมูลการให้บริการฟื้นฟูสมรรถภาพ</p>
                    <p>กรุณาลองปรับเปลี่ยนช่วงเวลาค้นหา หรือเลือกตัวกรองอื่น</p>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const { first, last } = splitPtName(row.ptname)
                  return (
                    <tr
                      key={`${row.vn}-${row.cid}-${row.no}`}
                      className="rehab-row"
                      onClick={() => setSelectedItem(row)}
                      title="คลิกที่แถวเพื่อดูรายละเอียดข้อมูลเชิงลึก"
                    >
                      {/* 1. ลำดับ */}
                      <td className="col-center tabular">{row.no}</td>

                      {/* 2. วันที่รับบริการ */}
                      <td className="col-center tabular">{formatThaiDate(row.vstdate)}</td>

                      {/* 3. VN */}
                      <td className="col-center tabular">{row.vn || '—'}</td>

                      {/* 4. HN */}
                      <td className="col-center tabular">{row.hn || '—'}</td>

                      {/* 5. เลขบัตรประชาชน (13 หลัก ไม่ mask) */}
                      <td className="col-center tabular">{row.cid || '—'}</td>

                      {/* 6. ชื่อ-สกุลผู้ป่วย (จัดกึ่งกลางแนวนอน ยกไปทั้งนามสกุล) */}
                      <td className="col-center">
                        <div className="patient-name-container">
                          <span className="patient-first">{first}</span>{' '}
                          {last && <span className="patient-last">{last}</span>}
                        </div>
                      </td>

                      {/* 7. สิทธิ */}
                      <td className="col-center" title={row.pttypename}>
                        {row.maininscl || row.pttypename || '—'}
                      </td>

                      {/* 8. รายการฟื้นฟู Web */}
                      <td className="col-center" title={row.rehab_name}>
                        <span
                          style={{
                            display: 'inline-block',
                            maxWidth: '220px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.rehab_name}
                        </span>
                      </td>

                      {/* 9. รหัส ADP HOSxP */}
                      <td className="col-center tabular font-mono">
                        {row.rehab_code || '—'}
                      </td>

                      {/* 10. สถานะตรวจสอบความสอดคล้อง */}
                      <td className="col-center">
                        {row.match_status === 'MATCHED' && (
                          <span className="status-badge status-badge-matched">
                            <CheckCircle2 size={13} />
                            <span>ตรงกัน 2 ระบบ</span>
                          </span>
                        )}
                        {row.match_status === 'NOT_IN_WEB' && (
                          <span className="status-badge status-badge-not-web">
                            <FileQuestion size={13} />
                            <span>ไม่พบใน Web</span>
                          </span>
                        )}
                        {row.match_status === 'NO_REHAB_CODE' && (
                          <span className="status-badge status-badge-no-code">
                            <AlertCircle size={13} />
                            <span>ขาดรหัส ADP</span>
                          </span>
                        )}
                        {row.match_status === 'NO_VN' && (
                          <span className="status-badge status-badge-no-vn">
                            <FileX2 size={13} />
                            <span>ไม่มี VN</span>
                          </span>
                        )}
                      </td>

                      {/* 11. ชดเชย (บาท) */}
                      <td className="col-center tabular font-semibold">
                        {formatMoney(row.compensated)}
                      </td>

                      {/* 12. สถานะชดเชย */}
                      <td className="col-center">
                        {row.isCompensated ? (
                          <span className="status-badge status-badge-compensated">
                            {row.rep || 'ชดเชยแล้ว'}
                          </span>
                        ) : (
                          <span className="status-badge status-badge-uncompensated">
                            {row.status || 'รอชดเชย'}
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

        {/* ── Pagination Controls ── */}
        {!loading && totalCount > 0 && (
          <div className="rehab-pagination">
            <div>
              แสดงรายการที่{' '}
              <span className="tabular font-medium">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              ถึง{' '}
              <span className="tabular font-medium">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}
              จากทั้งหมด{' '}
              <span className="tabular font-medium">{totalCount.toLocaleString()}</span>{' '}
              รายการ
            </div>

            <div className="rehab-pagination-controls">
              <button
                type="button"
                className="rehab-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="หน้าแรก"
              >
                «
              </button>
              <button
                type="button"
                className="rehab-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="หน้าก่อนหน้า"
              >
                ‹
              </button>

              <span className="tabular" style={{ padding: '0 8px' }}>
                หน้า {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="rehab-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="หน้าถัดไป"
              >
                ›
              </button>
              <button
                type="button"
                className="rehab-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="หน้าสุดท้าย"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 8. Record Detail Modal (Opened by row click!) ── */}
      {selectedItem && (
        <div
          className="rehab-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="rehab-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="rehab-modal-header">
              <div>
                <h2 className="rehab-modal-title">{selectedItem.ptname}</h2>
                <p className="rehab-modal-subtitle">
                  <span>HN: {selectedItem.hn || '—'}</span>
                  <span className="rehab-subtitle-dot">·</span>
                  <span>VN: {selectedItem.vn || 'ไม่มี VN'}</span>
                  <span className="rehab-subtitle-dot">·</span>
                  <span>วันที่รับบริการ: {formatThaiDate(selectedItem.vstdate)}</span>
                </p>
              </div>
              <button
                type="button"
                className="rehab-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rehab-modal-body">
              {/* Section 1: ข้อมูลผู้ป่วยและสิทธิ */}
              <div className="rehab-detail-section">
                <h3 className="rehab-section-title">
                  <ShieldCheck size={16} className="text-primary" />
                  <span>ข้อมูลทั่วไปและสิทธิการรักษา</span>
                </h3>
                <div className="rehab-grid-3">
                  <div className="rehab-field-group">
                    <span className="rehab-field-label">เลขบัตรประชาชน (CID)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="rehab-field-value tabular font-mono">
                        {selectedItem.cid || '—'}
                      </span>
                      {selectedItem.cid && (
                        <button
                          type="button"
                          className="rehab-search-clear"
                          style={{ position: 'static' }}
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอกเลขบัตรประชาชน"
                        >
                          {copiedField === 'cid' ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">รหัสผู้ป่วย (HN)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="rehab-field-value tabular">{selectedItem.hn}</span>
                      {selectedItem.hn && (
                        <button
                          type="button"
                          className="rehab-search-clear"
                          style={{ position: 'static' }}
                          onClick={() => handleCopy(selectedItem.hn, 'hn')}
                          title="คัดลอก HN"
                        >
                          {copiedField === 'hn' ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">ClaimCode:</span>
                    <span className="rehab-field-value tabular font-mono">
                      {selectedItem.authencode || '—'}
                    </span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">สิทธิการรักษา</span>
                    <span className="rehab-field-value">{selectedItem.pttypename || '—'}</span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">แผนกที่รับบริการ</span>
                    <span className="rehab-field-value">{selectedItem.department || '—'}</span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">แพทย์ผู้ตรวจ</span>
                    <span className="rehab-field-value">{selectedItem.doctorname || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: เปรียบเทียบ HOSxP vs Web Disability */}
              <div className="rehab-detail-section">
                <h3 className="rehab-section-title">
                  <Activity size={16} className="text-primary" />
                  <span>การเปรียบเทียบข้อมูลบริการ (HOSxP vs Web Disability)</span>
                </h3>
                <div className="rehab-grid-2">
                  <div className="rehab-field-group">
                    <span className="rehab-field-label">สถานะการตรวจสอบความสอดคล้อง</span>
                    <div>
                      {selectedItem.match_status === 'MATCHED' && (
                        <span className="status-badge status-badge-matched">
                          <CheckCircle2 size={14} />
                          <span>ข้อมูลตรงกันทั้ง 2 ระบบ</span>
                        </span>
                      )}
                      {selectedItem.match_status === 'NOT_IN_WEB' && (
                        <span className="status-badge status-badge-not-web">
                          <FileQuestion size={14} />
                          <span>มีใน HOSxP แต่ไม่พบในเว็บ Disability</span>
                        </span>
                      )}
                      {selectedItem.match_status === 'NO_REHAB_CODE' && (
                        <span className="status-badge status-badge-no-code">
                          <AlertCircle size={14} />
                          <span>มีใน Web แต่ใน HOSxP ยังไม่ได้คีย์รหัส ADP</span>
                        </span>
                      )}
                      {selectedItem.match_status === 'NO_VN' && (
                        <span className="status-badge status-badge-no-vn">
                          <FileX2 size={14} />
                          <span>มีใน Web Disability แต่ไม่มีเลข VN ใน HOSxP</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">รหัส ADP ฟื้นฟูสมรรถภาพใน HOSxP</span>
                    <span className="rehab-field-value tabular font-mono">
                      {selectedItem.rehab_code || '— (ไม่มีรหัส)'}
                    </span>
                  </div>

                  <div className="rehab-field-group" style={{ gridColumn: 'span 2' }}>
                    <span className="rehab-field-label">
                      รายการการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability
                    </span>
                    <span className="rehab-field-value font-semibold">
                      {selectedItem.rehab_name}
                    </span>
                  </div>

                  {selectedItem.targetgroup && (
                    <div className="rehab-field-group">
                      <span className="rehab-field-label">กลุ่มเป้าหมาย</span>
                      <span className="rehab-field-value">{selectedItem.targetgroup}</span>
                    </div>
                  )}

                  {selectedItem.deformed_type && (
                    <div className="rehab-field-group">
                      <span className="rehab-field-label">ประเภทความพิการ</span>
                      <span className="rehab-field-value">{selectedItem.deformed_type}</span>
                    </div>
                  )}

                  {selectedItem.adl && (
                    <div className="rehab-field-group">
                      <span className="rehab-field-label">คะแนน ADL</span>
                      <span className="rehab-field-value tabular">{selectedItem.adl}</span>
                    </div>
                  )}

                  {selectedItem.staff && (
                    <div className="rehab-field-group">
                      <span className="rehab-field-label">ผู้ให้บริการ (เว็บ Disability)</span>
                      <span className="rehab-field-value">{selectedItem.staff}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: ข้อมูลการชดเชยค่าบริการ */}
              <div className="rehab-detail-section">
                <h3 className="rehab-section-title">
                  <ReceiptText size={16} className="text-primary" />
                  <span>ข้อมูลการชดเชยค่าบริการและการเงิน</span>
                </h3>
                <div className="rehab-grid-3">
                  <div className="rehab-field-group">
                    <span className="rehab-field-label">ค่าบริการใน HOSxP</span>
                    <span className="rehab-field-value tabular">
                      ฿{formatMoney(selectedItem.income)}
                    </span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">ยอดชดเชย สปสช. (REP/eClaim)</span>
                    <span className="rehab-field-value tabular font-semibold text-emerald-700">
                      ฿{formatMoney(selectedItem.compensated)}
                    </span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">เลขหนังสือชดเชย (REP)</span>
                    <span className="rehab-field-value tabular font-mono">
                      {selectedItem.rep || '—'}
                    </span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">สถานะการชดเชย</span>
                    <span className="rehab-field-value">{selectedItem.status || '—'}</span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">REP Seamless</span>
                    <span className="rehab-field-value tabular font-mono">
                      {selectedItem.rep_seamless || '—'}
                    </span>
                  </div>

                  <div className="rehab-field-group">
                    <span className="rehab-field-label">PayNo</span>
                    <span className="rehab-field-value tabular font-mono">
                      {selectedItem.payno || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: รายการค่าบริการใน HOSxP (Itemized list) */}
              {parsedItemsDetail.length > 0 && (
                <div className="rehab-detail-section">
                  <h3 className="rehab-section-title">
                    <Activity size={16} className="text-primary" />
                    <span>รายการค่าใช้จ่ายและหัตถการใน HOSxP ({parsedItemsDetail.length} รายการ)</span>
                  </h3>
                  <table className="rehab-itemized-table">
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>รหัส (icode)</th>
                        <th style={{ width: '100px' }}>รหัส ADP</th>
                        <th>ชื่อรายการค่าบริการ</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedItemsDetail.map((it, idx) => (
                        <tr key={idx}>
                          <td className="tabular font-mono">{it.icode}</td>
                          <td className="tabular font-mono text-emerald-700 font-semibold">
                            {it.adpCode || '—'}
                          </td>
                          <td>{it.name}</td>
                          <td className="tabular text-right">฿{formatMoney(it.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rehab-modal-footer">
              <button
                type="button"
                className="rehab-btn rehab-btn-secondary"
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
