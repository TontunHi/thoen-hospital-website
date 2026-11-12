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
  Activity,
  CheckCircle2,
  FileQuestion,
  ReceiptText,
  Clock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Building2,
  Stethoscope,
} from 'lucide-react'
import type {
  ImcItem,
  ImcSummary,
  ImcCardFilter,
  ImcSortField,
  ImcReportResult,
  ImcPatientType,
} from '@/lib/clinical/rcmImcService'
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
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function splitPtName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { first: fullName, last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** แยกเลข Rep ที่ได้จาก GROUP_CONCAT (คั่นด้วย comma) */
function splitReps(value?: string | null): string[] {
  if (!value) return []
  return Array.from(new Set(value.split(',').map((s) => s.trim()).filter(Boolean)))
}

export interface ImcEligiblePatientsClientProps {
  initialData?: ImcReportResult | null
}

export default function ImcEligiblePatientsClient({
  initialData = null,
}: ImcEligiblePatientsClientProps) {
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

  // Patient type: IPD (default) | OPD
  const [patientType, setPatientType] = useState<ImcPatientType>(
    initialData?.patientType ?? 'IPD'
  )

  // Date mode: 1. กำหนดเอง -> 2. เดือน -> 3. ปีงบประมาณ (No numbers or parentheses in tabs)
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
  const [cardFilter, setCardFilter] = useState<ImcCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<ImcSortField>(
    initialData?.sortBy ?? 'date'
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
  const [items, setItems] = useState<ImcItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [summary, setSummary] = useState<ImcSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      chronicCases: 0,
      chronicRate: 0,
      inWebCases: 0,
      inWebRate: 0,
      notInWebCases: 0,
      notInWebRate: 0,
      compensatedCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      totalGetprice: 0,
      totalIncome: 0,
      uncompensatedCases: 0,
      withAuthenCases: 0,
      withAuthenRate: 0,
      noAuthenCases: 0,
      ucCases: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly, no explicit view button)
  const [selectedItem, setSelectedItem] = useState<ImcItem | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // AbortController ref for race condition defense
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
          patientType,
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
          `/api/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        const json = await res.json()

        if (!json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }

        const data: ImcReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
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
    [
      ds1,
      ds2,
      patientType,
      cardFilter,
      pttypes,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  )

  // Double-fetch guard on initial mount
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

  // Handle Patient Type Toggle (IPD / OPD)
  const handlePatientTypeChange = (type: ImcPatientType) => {
    if (patientType === type) return
    setPatientType(type)
    setCardFilter('ALL')
    setCurrentPage(1)
    setSelectedItem(null)
  }

  // Handle Sort
  const handleSort = (field: ImcSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Card Filter Selection (toggle on click)
  const handleCardClick = (filter: ImcCardFilter) => {
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

  // Modal navigation (Prev / Next)
  const selectedIndex = selectedItem ? items.findIndex((i) => (patientType === 'IPD' ? i.an === selectedItem.an : i.vn === selectedItem.vn)) : -1
  const handlePrevItem = () => {
    if (selectedIndex > 0) {
      setSelectedItem(items[selectedIndex - 1])
    }
  }
  const handleNextItem = () => {
    if (selectedIndex >= 0 && selectedIndex < items.length - 1) {
      setSelectedItem(items[selectedIndex + 1])
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItem(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Export CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        patientType,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients?${queryParams.toString()}`
      )
      const json = await res.json()

      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลสำหรับส่งออกได้')
      }

      const exportItems: ImcItem[] = json.data.items

      const headers =
        patientType === 'IPD'
          ? [
              'ลำดับ',
              'วันที่จำหน่าย',
              'วันที่รับไว้',
              'AN',
              'HN',
              'เลขบัตรประชาชน',
              'ชื่อ-สกุล',
              'อายุ',
              'สิทธิการรักษา',
              'หอผู้ป่วย',
              'ขึ้นทะเบียน Stroke',
              'บันทึกใน Web IMC',
              'ระบบที่พบ',
              'วินิจฉัย (Dx)',
              'หัตถการ (Op)',
              'AdjRW',
              'ค่าบริการ รพ.',
              'พึงได้จาก Web',
              'ชดเชยแล้ว',
              'สถานะชดเชย',
              'เลขที่ REP',
              'เลข Rep Seamless',
              'ชดเชยจาก Seamless',
              'ClaimCode',
              'ที่อยู่',
              'เบอร์โทรศัพท์',
            ]
          : [
              'ลำดับ',
              'วันที่รับบริการ',
              'เวลา',
              'VN',
              'HN',
              'เลขบัตรประชาชน',
              'ชื่อ-สกุล',
              'อายุ',
              'สิทธิการรักษา',
              'แผนก/คลินิก',
              'ขึ้นทะเบียน Stroke',
              'บันทึกใน Web IMC',
              'ระบบที่พบ',
              'อาการสำคัญ (CC)',
              'วินิจฉัย (Dx)',
              'หัตถการ (Op)',
              'สถานะจำหน่าย',
              'ค่าบริการ รพ.',
              'พึงได้จาก Web',
              'ชดเชยแล้ว',
              'สถานะชดเชย',
              'เลขที่ REP',
              'เลข Rep Seamless',
              'ชดเชยจาก Seamless',
              'ClaimCode',
              'ที่อยู่',
              'เบอร์โทรศัพท์',
            ]

      const rows = exportItems.map((r, idx) => {
        if (patientType === 'IPD') {
          return [
            idx + 1,
            r.dchdate || '',
            r.admdate || '',
            r.an || '',
            r.hn || '',
            r.cid || '',
            r.ptname || '',
            r.age || 0,
            r.pttypename || r.maininscl || '',
            r.ward || '',
            r.chronic === 'Y' ? 'ใช่' : 'ไม่ใช่',
            r.web === 'Y' ? 'ใช่' : 'ไม่ใช่',
            r.filetype || '',
            r.dx || '',
            r.op || '',
            r.adjrw ?? '',
            r.income || 0,
            r.getprice || 0,
            r.compensated || 0,
            r.status || '',
            r.rep || '',
            r.repSeamless || '',
            r.compensatedSeamless || 0,
            r.authencode || '',
            r.address || '',
            r.tel || '',
          ]
        } else {
          return [
            idx + 1,
            r.vstdate || '',
            r.vsttime || '',
            r.vn || '',
            r.hn || '',
            r.cid || '',
            r.ptname || '',
            r.age || 0,
            r.pttypename || r.maininscl || '',
            r.department || r.clinic || '',
            r.chronic === 'Y' ? 'ใช่' : 'ไม่ใช่',
            r.web === 'Y' ? 'ใช่' : 'ไม่ใช่',
            r.filetype || '',
            r.cc || '',
            r.dx || '',
            r.op || '',
            r.ovstost || '',
            r.income || 0,
            r.getprice || 0,
            r.compensated || 0,
            r.status || '',
            r.rep || '',
            r.repSeamless || '',
            r.compensatedSeamless || 0,
            r.authencode || '',
            r.address || '',
            r.tel || '',
          ]
        }
      })

      await exportRcmExcel({
        filename: `รายงานผู้รับบริการตามเกณฑ์_IMC_${patientType}_${ds1}_${ds2}.xlsx`,
        title: `รายงานผู้รับบริการตามเกณฑ์ IMC (${patientType})`,
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  // Render Sort Icon
  const renderSortIcon = (field: ImcSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} className="opacity-40" />
    }
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
  }

  return (
    <div className="imc-page">
      {/* 1. Breadcrumb */}
      <nav aria-label="Breadcrumb" className="imc-breadcrumb">
        <Link href="/service/dashboard-rcm">Dashboard-RCM</Link>
        <span className="imc-breadcrumb-sep">/</span>
        <span>กองทุน</span>
        <span className="imc-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds/rehabilitation">
          กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์
        </Link>
        <span className="imc-breadcrumb-sep">/</span>
        <span>รายงานบริการผู้ป่วย IMC</span>
        <span className="imc-breadcrumb-sep">/</span>
        <span className="imc-breadcrumb-current">รายชื่อผู้รับบริการตามเกณฑ์ IMC</span>
      </nav>

      {/* 2. Header */}
      <header className="imc-header">
        <div className="imc-title-group">
          <h1 className="imc-title">รายชื่อผู้รับบริการตามเกณฑ์ IMC</h1>
          <p className="imc-subtitle">
            <span>กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์</span>
            <span className="imc-subtitle-dot">•</span>
            <span>รายงานบริการผู้ป่วย IMC ({patientType})</span>
          </p>
        </div>

        <div className="imc-actions">
          <button
            type="button"
            className="imc-btn imc-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลและเคลียร์แคช"
          >
            <RefreshCw size={16} className={isRefreshing ? 'imc-spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="imc-btn imc-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} className={isExporting ? 'imc-spin' : ''} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* 3. Patient Type Toggle Bar */}
      <div className="imc-control-row">
        <div className="imc-patient-type-tabs" role="tablist" aria-label="ประเภทผู้ป่วย">
          <button
            type="button"
            role="tab"
            aria-selected={patientType === 'IPD'}
            className={`imc-type-tab-btn ${patientType === 'IPD' ? 'active' : ''}`}
            onClick={() => handlePatientTypeChange('IPD')}
          >
            <Building2 size={16} />
            <span>ผู้ป่วยใน (IPD)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={patientType === 'OPD'}
            className={`imc-type-tab-btn ${patientType === 'OPD' ? 'active' : ''}`}
            onClick={() => handlePatientTypeChange('OPD')}
          >
            <Stethoscope size={16} />
            <span>ผู้ป่วยนอก (OPD)</span>
          </button>
        </div>
      </div>

      {/* 4. Single-Row Date Selector (No Parentheses in range display) */}
      <div className="imc-date-selector-card">
        <div className="imc-date-tabs" role="tablist" aria-label="โหมดการเลือกช่วงเวลา">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`imc-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`imc-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`imc-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="imc-date-divider" />

        <div className="imc-date-controls">
          {dateMode === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <ThaiDatePicker
                value={ds1}
                onChange={(val) => {
                  setDs1(val)
                  setCurrentPage(1)
                }}
                maxDate={ds2}
              />
              <span style={{ fontSize: '13px', color: '#64748b' }}>ถึง</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                aria-label="เลือกเดือน"
                className="imc-select"
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

              <select
                aria-label="เลือกปี พ.ศ."
                className="imc-select"
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
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dateMode === 'fiscal' && (
            <select
              aria-label="เลือกปีงบประมาณ"
              className="imc-select"
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
          )}

        </div>
      </div>

      {/* 5. Interactive KPI Filter Cards (filter ผ่าน card ได้) */}
      <section aria-label="สรุปตัวชี้วัดและตัวกรองข้อมูล" className="imc-kpi-grid">
        {/* Card 1: ทั้งหมด */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleCardClick('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">ผู้รับบริการตามเกณฑ์ IMC ทั้งหมด</span>
            <div className="imc-kpi-icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.totalCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            ค่าบริการ รพ. รวม {(summary.totalIncome ?? 0).toLocaleString('th-TH')} บาท
          </div>
        </button>

        {/* Card 2: ขึ้นทะเบียนโรคเรื้อรัง Stroke แล้ว */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'CHRONIC' ? 'active' : ''}`}
          onClick={() => handleCardClick('CHRONIC')}
          title="คลิกเพื่อกรองเฉพาะผู้ป่วยที่ขึ้นทะเบียนโรคเรื้อรัง Stroke"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">ขึ้นทะเบียนโรคเรื้อรัง Stroke</span>
            <div className="imc-kpi-icon">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.chronicCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            คิดเป็น {(summary.chronicRate ?? 0).toFixed(1)}% ของผู้ป่วยตามเกณฑ์
          </div>
        </button>

        {/* Card 3: บันทึกใน Web IMC แล้ว */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'IN_WEB' ? 'active' : ''}`}
          onClick={() => handleCardClick('IN_WEB')}
          title="คลิกเพื่อกรองผู้ป่วยที่มีข้อมูลในระบบ Web IMC"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">บันทึกใน Web IMC แล้ว</span>
            <div className="imc-kpi-icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.inWebCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            ยอดพึงได้ {(summary.totalGetprice ?? 0).toLocaleString('th-TH')} บาท
          </div>
        </button>

        {/* Card 4: ยังไม่ได้บันทึกใน Web IMC */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'NOT_IN_WEB' ? 'active' : ''}`}
          onClick={() => handleCardClick('NOT_IN_WEB')}
          title="คลิกเพื่อกรองผู้ป่วยที่ยังไม่ได้บันทึกใน Web IMC (พบเฉพาะใน HOSxP)"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">ยังไม่ได้บันทึกใน Web IMC</span>
            <div className="imc-kpi-icon">
              <FileQuestion size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.notInWebCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            คิดเป็น {(summary.notInWebRate ?? 0).toFixed(1)}% รอการบันทึก
          </div>
        </button>

        {/* Card 5: ชดเชยแล้ว */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          title="คลิกเพื่อกรองรายการที่ได้รับชดเชยแล้ว"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">ได้รับการชดเชยแล้ว</span>
            <div className="imc-kpi-icon">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.compensatedCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            รวมเงินชดเชย {(summary.totalCompensated ?? 0).toLocaleString('th-TH')} บาท
          </div>
        </button>

        {/* Card 6: ยังไม่ได้รับการชดเชย */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้รับเงินชดเชย"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">ยังไม่ได้รับการชดเชย</span>
            <div className="imc-kpi-icon">
              <Clock size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.uncompensatedCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            อัตราชดเชยสำเร็จ {(summary.compensationRate ?? 0).toFixed(1)}%
          </div>
        </button>

        {/* Card 7: มี ClaimCode */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรองรายการที่มี ClaimCode"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">มี ClaimCode</span>
            <div className="imc-kpi-icon">
              <KeyRound size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.withAuthenCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            คิดเป็น {(summary.withAuthenRate ?? 0).toFixed(1)}% ของผู้ป่วย
          </div>
        </button>

        {/* Card 8: ไม่มี ClaimCode */}
        <button
          type="button"
          className={`imc-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => handleCardClick('NO_AUTHEN')}
          title="คลิกเพื่อกรองรายการที่ไม่มี ClaimCode"
        >
          <div className="imc-kpi-header">
            <span className="imc-kpi-title">ไม่มี ClaimCode</span>
            <div className="imc-kpi-icon">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="imc-kpi-value-row">
            <span className="imc-kpi-value">
              {(summary.noAuthenCases ?? 0).toLocaleString('th-TH')}
            </span>
            <span className="imc-kpi-unit">ราย</span>
          </div>
          <div className="imc-kpi-meta">
            สิทธิบัตรทอง (UC) {summary.ucCases} ราย
          </div>
        </button>
      </section>

      {/* 6. Unified Global Search Bar & Table Header */}
      <div className="imc-table-toolbar">
        <div className="imc-search-box">
          <Search size={16} className="imc-search-icon" />
          <input
            type="text"
            className="imc-search-input"
            placeholder={
              patientType === 'IPD'
                ? 'ค้นหา HN, CID, ชื่อผู้ป่วย, AN, วอร์ด, วินิจฉัย, REP...'
                : 'ค้นหา HN, CID, ชื่อผู้ป่วย, VN, แผนก, วินิจฉัย, REP...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="imc-search-clear"
              onClick={() => {
                setSearch('')
                setDebouncedSearch('')
                setCurrentPage(1)
              }}
              aria-label="ล้างคำค้นหา"
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

        <div className="imc-toolbar-info">
          แสดง <strong>{items.length}</strong> จากทั้งหมด <strong>{totalCount}</strong> รายการ
          {cardFilter !== 'ALL' && <span style={{ marginLeft: '8px', color: '#0d7446' }}>(ตัวกรอง: {cardFilter})</span>}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              textDecoration: 'underline',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 600,
            }}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* 7. Table (Row clickable, no explicit view button) */}
      <div className="imc-table-wrapper">
        <div className="imc-table-scroll">
          <table className="imc-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>ลำดับ</th>
                <th
                  className="imc-th-sortable"
                  onClick={() => handleSort('date')}
                  title="เรียงตามวันที่"
                >
                  <span className="imc-th-sort-inner">
                    <span>{patientType === 'IPD' ? 'วันที่จำหน่าย' : 'วันที่รับบริการ'}</span>
                    {renderSortIcon('date')}
                  </span>
                </th>
                <th>{patientType === 'IPD' ? 'วันที่รับไว้' : 'เวลา'}</th>
                <th
                  className="imc-th-sortable"
                  onClick={() => handleSort(patientType === 'IPD' ? 'an' : 'vn')}
                >
                  <span className="imc-th-sort-inner">
                    <span>{patientType === 'IPD' ? 'AN' : 'VN'}</span>
                    {renderSortIcon(patientType === 'IPD' ? 'an' : 'vn')}
                  </span>
                </th>
                <th className="imc-th-sortable" onClick={() => handleSort('hn')}>
                  <span className="imc-th-sort-inner">
                    <span>HN</span>
                    {renderSortIcon('hn')}
                  </span>
                </th>
                <th className="imc-th-sortable" onClick={() => handleSort('cid')}>
                  <span className="imc-th-sort-inner">
                    <span>เลขบัตรประชาชน</span>
                    {renderSortIcon('cid')}
                  </span>
                </th>
                <th className="imc-th-sortable" onClick={() => handleSort('ptname')}>
                  <span className="imc-th-sort-inner">
                    <span>ชื่อ-สกุล</span>
                    {renderSortIcon('ptname')}
                  </span>
                </th>
                <th className="imc-th-sortable" onClick={() => handleSort('age')}>
                  <span className="imc-th-sort-inner">
                    <span>อายุ</span>
                    {renderSortIcon('age')}
                  </span>
                </th>
                <th>สิทธิการรักษา</th>
                <th>{patientType === 'IPD' ? 'หอผู้ป่วย' : 'แผนก / คลินิก'}</th>
                <th>โรคเรื้อรัง Stroke</th>
                <th>Web IMC</th>
                <th className="col-center">การวินิจฉัย (Dx)</th>
                <th
                  className="col-center imc-th-sortable"
                  onClick={() => handleSort('income')}
                >
                  <span className="imc-th-sort-inner" style={{ justifyContent: 'center' }}>
                    <span>ค่าบริการ รพ.</span>
                    {renderSortIcon('income')}
                  </span>
                </th>
                <th
                  className="col-center imc-th-sortable"
                  onClick={() => handleSort('getprice')}
                >
                  <span className="imc-th-sort-inner" style={{ justifyContent: 'center' }}>
                    <span>พึงได้จาก Web</span>
                    {renderSortIcon('getprice')}
                  </span>
                </th>
                <th
                  className="col-center imc-th-sortable"
                  onClick={() => handleSort('compensated')}
                >
                  <span className="imc-th-sort-inner" style={{ justifyContent: 'center' }}>
                    <span>ชดเชยแล้ว</span>
                    {renderSortIcon('compensated')}
                  </span>
                </th>
                <th>สถานะ / REP</th>
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="rcm-skeleton-row">
                    {Array.from({ length: 17 }).map((__, j) => (
                      <td key={j} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={17} className="imc-empty-state">
                    <Activity size={32} className="imc-empty-icon" />
                    <p className="imc-empty-title">ไม่พบข้อมูลผู้รับบริการตามเกณฑ์ IMC</p>
                    <p>กรุณาลองปรับเปลี่ยนช่วงเวลาค้นหา หรือเลือกตัวกรองอื่น</p>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const { first, last } = splitPtName(row.ptname)
                  return (
                    <tr
                      key={patientType === 'IPD' ? `ipd-${row.an}-${row.no}` : `opd-${row.vn}-${row.no}`}
                      className="imc-row"
                      onClick={() => setSelectedItem(row)}
                      title="คลิกที่แถวเพื่อดูรายละเอียดข้อมูลเชิงลึก"
                    >
                      {/* 1. ลำดับ */}
                      <td className="col-center tabular">{row.no}</td>

                      {/* 2. วันที่จำหน่าย / รับบริการ */}
                      <td className="col-center tabular">
                        {formatThaiDate(patientType === 'IPD' ? row.dchdate : row.vstdate)}
                      </td>

                      {/* 3. วันที่รับไว้ / เวลา */}
                      <td className="col-center tabular">
                        {patientType === 'IPD' ? formatThaiDate(row.admdate) : (row.vsttime || '—')}
                      </td>

                      {/* 4. AN / VN */}
                      <td className="col-center tabular font-mono">
                        {patientType === 'IPD' ? (row.an || '—') : (row.vn || '—')}
                      </td>

                      {/* 5. HN */}
                      <td className="col-center tabular font-mono">{row.hn || '—'}</td>

                      {/* 6. CID (13 digits unmasked) */}
                      <td className="col-center tabular font-mono">{row.cid || '—'}</td>

                      {/* 7. ชื่อ-สกุล (Centered on X-axis with Intact Surname Wrap) */}
                      <td className="col-center">
                        <div className="patient-name-container">
                          <span className="patient-first">{first}</span>{' '}
                          {last && <span className="patient-last">{last}</span>}
                        </div>
                      </td>

                      {/* 8. อายุ */}
                      <td className="col-center tabular">{row.age}&nbsp;ปี</td>

                      {/* 9. สิทธิการรักษา */}
                      <td className="col-center" title={row.pttypename || ''}>
                        {row.maininscl || row.pttypename || '—'}
                      </td>

                      {/* 10. วอร์ด / แผนก */}
                      <td className="col-center">
                        {patientType === 'IPD' ? (row.ward || '—') : (row.department || row.clinic || '—')}
                      </td>

                      {/* 11. โรคเรื้อรัง Stroke */}
                      <td className="col-center">
                        {row.chronic === 'Y' ? (
                          <span className="imc-badge imc-badge-success">ขึ้นทะเบียนแล้ว</span>
                        ) : (
                          <span className="imc-badge imc-badge-neutral">ยังไม่ขึ้น</span>
                        )}
                      </td>

                      {/* 12. Web IMC */}
                      <td className="col-center">
                        {row.web === 'Y' ? (
                          <span className="imc-badge imc-badge-success">มีใน Web</span>
                        ) : (
                          <span className="imc-badge imc-badge-warning">ไม่พบใน Web</span>
                        )}
                      </td>

                      {/* 13. วินิจฉัย */}
                      <td className="col-left" title={row.dx || ''}>
                        <span
                          style={{
                            display: 'inline-block',
                            maxWidth: '220px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.dx || '—'}
                        </span>
                      </td>

                      {/* 14. ค่าบริการ รพ. */}
                      <td className="col-right">{formatMoney(row.income)}</td>

                      {/* 15. พึงได้จาก Web */}
                      <td className="col-right">{formatMoney(row.getprice)}</td>

                      {/* 16. ชดเชยแล้ว (e-Claim + Seamless) */}
                      <td className="col-right">
                        {row.compensated > 0 || (row.compensatedSeamless ?? 0) > 0 ? (
                          <div className="imc-comp-stack tabular">
                            {row.compensated > 0 && (
                              <strong style={{ color: '#15803d' }} title="ชดเชยจาก e-Claim">
                                {formatMoney(row.compensated)}
                              </strong>
                            )}
                            {(row.compensatedSeamless ?? 0) > 0 && (
                              <span
                                className="imc-comp-sub"
                                title={`ชดเชยจาก Seamless${row.seamlessFunds ? ` (${row.seamlessFunds})` : ''}`}
                              >
                                {row.compensated > 0 ? '+ ' : ''}Seamless {formatMoney(row.compensatedSeamless)}
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* 17. สถานะ / REP (แสดงเฉพาะเลข REP) */}
                      <td className="col-center">
                        {(() => {
                          const eclaimReps = splitReps(row.rep)
                          const seamlessItems =
                            row.seamlessRepItems && row.seamlessRepItems.length > 0
                              ? row.seamlessRepItems
                              : splitReps(row.repSeamless).map((rep, idx, arr) => ({
                                  rep,
                                  fund: row.seamlessFunds || null,
                                  type: null,
                                  collected: 0,
                                  compensated: arr.length === 1 ? (row.compensatedSeamless ?? 0) : 0,
                                }))

                          if (eclaimReps.length === 0 && seamlessItems.length === 0) {
                            return row.status ? (
                              <span className="imc-badge imc-badge-neutral">{row.status}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )
                          }
                          return (
                            <div className="imc-rep-stack">
                              {eclaimReps.map((rep) => (
                                <span
                                  key={`e-${rep}`}
                                  className="imc-badge imc-badge-info font-mono"
                                  title={`e-Claim${row.status ? ` · ${row.status}` : ''}${row.compensated > 0 ? ` · ชดเชย ${formatMoney(row.compensated)} บาท` : ''}`}
                                >
                                  {rep}
                                </span>
                              ))}
                              {seamlessItems.map((item) => (
                                <span
                                  key={`s-${item.rep}`}
                                  className="imc-badge imc-badge-seamless font-mono"
                                  title={[
                                    'Seamless',
                                    item.fund || row.seamlessFunds,
                                    item.type,
                                    item.collected > 0 ? `ขอเบิก ${formatMoney(item.collected)} ฿` : null,
                                    item.compensated > 0 ? `ชดเชย ${formatMoney(item.compensated)} ฿` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                >
                                  {item.rep}
                                </span>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="imc-pagination">
          <div className="imc-page-size-selector">
            <span>แสดงต่อหน้า:</span>
            <select
              aria-label="จำนวนแถวต่อหน้า"
              className="imc-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              style={{ minHeight: '32px', padding: '4px 8px' }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span>
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด {totalCount} รายการ)
            </span>
          </div>

          <div className="imc-page-buttons">
            <button
              type="button"
              className="imc-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
            >
              ย้อนกลับ
            </button>
            <button
              type="button"
              className="imc-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* 8. Patient Detail Modal (กดผ่าน record ดูข้อมูล ไม่ต้องมีปุ่มดูข้อมูล) */}
      {selectedItem && (
        <div
          className="imc-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="imc-modal-title"
        >
          <div
            className="imc-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="imc-modal-header">
              <div className="imc-modal-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h2 id="imc-modal-title" className="imc-modal-patient-name">
                    {selectedItem.ptname}
                  </h2>
                  <span className="imc-badge imc-badge-info">
                    {selectedItem.patientType === 'IPD' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)'}
                  </span>
                  {selectedItem.chronic === 'Y' && (
                    <span className="imc-badge imc-badge-success">ขึ้นทะเบียน Stroke</span>
                  )}
                  {selectedItem.web === 'Y' && (
                    <span className="imc-badge imc-badge-success">พบใน Web IMC</span>
                  )}
                </div>

                <div className="imc-modal-patient-meta">
                  <span>HN: <strong>{selectedItem.hn}</strong></span>
                  <span>•</span>
                  <span>{selectedItem.patientType === 'IPD' ? 'AN' : 'VN'}: <strong>{selectedItem.an || selectedItem.vn}</strong></span>
                  <span>•</span>
                  <span>เลขบัตรประชาชน: <strong>{selectedItem.cid}</strong></span>
                  <span>•</span>
                  <span>อายุ {selectedItem.age} ปี</span>
                </div>
              </div>

              <button
                type="button"
                className="imc-modal-close-btn"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="imc-modal-body">
              {/* Section 1: ข้อมูลการรับบริการและการจำหน่าย */}
              <div className="imc-modal-section">
                <h3 className="imc-modal-section-title">
                  <Activity size={16} />
                  <span>ข้อมูลการรับบริการและการจำหน่าย ({selectedItem.patientType})</span>
                </h3>

                <div className="imc-modal-grid">
                  {selectedItem.patientType === 'IPD' ? (
                    <>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">วันที่รับไว้ (Adm Date)</span>
                        <span className="imc-modal-val">{formatThaiDate(selectedItem.admdate)}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">วันที่จำหน่าย (Dch Date)</span>
                        <span className="imc-modal-val">{formatThaiDate(selectedItem.dchdate)}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">หอผู้ป่วย (Ward)</span>
                        <span className="imc-modal-val">{selectedItem.ward || '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">วันนอน (LOS)</span>
                        <span className="imc-modal-val">{selectedItem.los != null ? `${selectedItem.los} วัน` : '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">สถานะจำหน่าย (Dch Status)</span>
                        <span className="imc-modal-val">{selectedItem.dchstts || '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">ประเภทจำหน่าย (Dch Type)</span>
                        <span className="imc-modal-val">{selectedItem.dchtype || '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">AdjRW</span>
                        <span className="imc-modal-val">{selectedItem.adjrw != null ? selectedItem.adjrw.toFixed(4) : '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">ค่าบริการโรงพยาบาล</span>
                        <span className="imc-modal-val">{formatMoney(selectedItem.income)} บาท</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">วันที่รับบริการ (Vst Date)</span>
                        <span className="imc-modal-val">{formatThaiDate(selectedItem.vstdate)}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">เวลาที่รับบริการ (Vst Time)</span>
                        <span className="imc-modal-val">{selectedItem.vsttime || '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">แผนก / คลินิก</span>
                        <span className="imc-modal-val">{selectedItem.department || selectedItem.clinic || '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">สถานะการจำหน่ายผู้ป่วยนอก</span>
                        <span className="imc-modal-val">{selectedItem.ovstost || '—'}</span>
                      </div>
                      <div className="imc-modal-field" style={{ gridColumn: 'span 2' }}>
                        <span className="imc-modal-label">อาการสำคัญ (Chief Complaint)</span>
                        <span className="imc-modal-val">{selectedItem.cc || '—'}</span>
                      </div>
                      <div className="imc-modal-field">
                        <span className="imc-modal-label">ค่าบริการโรงพยาบาล</span>
                        <span className="imc-modal-val">{formatMoney(selectedItem.income)} บาท</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Section 2: การวินิจฉัยและหัตถการ */}
              <div className="imc-modal-section">
                <h3 className="imc-modal-section-title">
                  <Stethoscope size={16} />
                  <span>การวินิจฉัยโรคตามเกณฑ์ IMC & หัตถการ</span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="imc-modal-field">
                    <span className="imc-modal-label">รหัสและการวินิจฉัยโรค (ICD-10)</span>
                    <span className="imc-modal-val" style={{ whiteSpace: 'normal', lineHeight: '1.5' }}>
                      {selectedItem.dx || '—'}
                    </span>
                  </div>

                  {selectedItem.prediag && (
                    <div className="imc-modal-field">
                      <span className="imc-modal-label">การวินิจฉัยเบื้องต้น (Prediag)</span>
                      <span className="imc-modal-val">{selectedItem.prediag}</span>
                    </div>
                  )}

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">หัตถการทางการแพทย์ (ICD-9)</span>
                    <span className="imc-modal-val" style={{ whiteSpace: 'normal', lineHeight: '1.5' }}>
                      {selectedItem.op || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: การขึ้นทะเบียนโรคเรื้อรัง & ระบบ Web IMC */}
              <div className="imc-modal-section">
                <h3 className="imc-modal-section-title">
                  <UserCheck size={16} />
                  <span>การขึ้นทะเบียนโรคเรื้อรัง & ระบบ Web IMC</span>
                </h3>

                <div className="imc-modal-grid">
                  <div className="imc-modal-field">
                    <span className="imc-modal-label">สถานะขึ้นทะเบียนโรคเรื้อรัง (Stroke Clinic)</span>
                    <span className="imc-modal-val">
                      {selectedItem.chronic === 'Y' ? (
                        <span style={{ color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} />
                          <span>ขึ้นทะเบียนแล้ว</span>
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>ยังไม่ได้ขึ้นทะเบียน</span>
                      )}
                    </span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">สถานะบันทึกในระบบ Web IMC</span>
                    <span className="imc-modal-val">
                      {selectedItem.web === 'Y' ? (
                        <span style={{ color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} />
                          <span>บันทึกในระบบ Web แล้ว</span>
                        </span>
                      ) : (
                        <span style={{ color: '#b45309', fontWeight: 600 }}>ยังไม่พบในระบบ Web</span>
                      )}
                    </span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">ระบบข้อมูลที่พบ</span>
                    <span className="imc-modal-val">{selectedItem.filetype}</span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">ยอดพึงได้จาก Web IMC</span>
                    <span className="imc-modal-val" style={{ color: '#0d7446', fontWeight: 700 }}>
                      {formatMoney(selectedItem.getprice)} บาท
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: สิทธิ์การรักษาและการชดเชยค่าบริการ */}
              <div className="imc-modal-section">
                <h3 className="imc-modal-section-title">
                  <ShieldCheck size={16} />
                  <span>สิทธิ์การรักษาและการชดเชยค่าบริการ</span>
                </h3>

                <div className="imc-modal-grid">
                  <div className="imc-modal-field">
                    <span className="imc-modal-label">ClaimCode:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="imc-modal-val font-mono">{selectedItem.authencode || '—'}</span>
                      {selectedItem.authencode && (
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedItem.authencode!, 'authencode')}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: copiedField === 'authencode' ? '#15803d' : '#64748b',
                            padding: '2px',
                          }}
                          title="คัดลอก ClaimCode"
                        >
                          {copiedField === 'authencode' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">สิทธิการรักษา</span>
                    <span className="imc-modal-val">{selectedItem.pttypename || selectedItem.maininscl || '—'}</span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">สถานะการชดเชย (Claim Status)</span>
                    <span className="imc-modal-val">{selectedItem.status || '—'}</span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">เลขที่ใบเสร็จรับเงิน (REP)</span>
                    <span className="imc-modal-val font-mono">{selectedItem.rep || '—'}</span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">เงินชดเชยที่ได้รับจริง</span>
                    <span className="imc-modal-val" style={{ color: '#15803d', fontWeight: 700 }}>
                      {formatMoney(selectedItem.compensated)} บาท
                    </span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">เลข Rep Seamless</span>
                    <span className="imc-modal-val font-mono">
                      {splitReps(selectedItem.repSeamless).join(', ') || '—'}
                    </span>
                  </div>

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">ชดเชยจาก Seamless (รวม)</span>
                    <span className="imc-modal-val" style={{ color: '#6b21a8', fontWeight: 700 }}>
                      {formatMoney(selectedItem.compensatedSeamless ?? 0)} บาท
                    </span>
                  </div>

                  {selectedItem.seamlessFunds && (
                    <div className="imc-modal-field" style={{ gridColumn: 'span 2' }}>
                      <span className="imc-modal-label">กองทุน Seamless</span>
                      <span className="imc-modal-val">{selectedItem.seamlessFunds}</span>
                    </div>
                  )}

                  {selectedItem.seamlessRepItems && selectedItem.seamlessRepItems.length > 0 && (
                    <div className="imc-modal-field" style={{ gridColumn: 'span 2' }}>
                      <span className="imc-modal-label">รายละเอียดยอดเงินแยกรายใบ Rep (Seamless)</span>
                      <div className="imc-modal-rep-breakdown">
                        {selectedItem.seamlessRepItems.map((item) => (
                          <div key={`modal-s-${item.rep}`} className="imc-modal-rep-item">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="font-mono" style={{ fontWeight: 600, color: '#6b21a8' }}>
                                {item.rep}
                              </span>
                              {(item.type || item.fund) && (
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {[item.type, item.fund].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>
                            <div
                              className="tabular"
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}
                            >
                              {item.collected > 0 && (
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  ขอเบิก {formatMoney(item.collected)} ฿
                                </span>
                              )}
                              <strong style={{ color: '#6b21a8' }}>
                                ชดเชย {formatMoney(item.compensated)} ฿
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="imc-modal-field">
                    <span className="imc-modal-label">เบอร์โทรศัพท์ติดต่อ</span>
                    <span className="imc-modal-val font-mono">{selectedItem.tel || '—'}</span>
                  </div>

                  <div className="imc-modal-field" style={{ gridColumn: 'span 2' }}>
                    <span className="imc-modal-label">ที่อยู่ผู้ป่วย</span>
                    <span className="imc-modal-val">{selectedItem.address || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer with Prev / Next Navigation */}
            <div className="imc-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="imc-btn imc-btn-secondary"
                  onClick={handlePrevItem}
                  disabled={selectedIndex <= 0}
                  style={{ minHeight: '36px', padding: '6px 12px' }}
                >
                  <ChevronLeft size={16} />
                  <span>ก่อนหน้า</span>
                </button>
                <button
                  type="button"
                  className="imc-btn imc-btn-secondary"
                  onClick={handleNextItem}
                  disabled={selectedIndex >= items.length - 1}
                  style={{ minHeight: '36px', padding: '6px 12px' }}
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={16} />
                </button>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                  {selectedIndex + 1} / {items.length}
                </span>
              </div>

              <button
                type="button"
                className="imc-btn imc-btn-secondary"
                onClick={() => setSelectedItem(null)}
                style={{ minHeight: '36px', padding: '6px 16px' }}
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
