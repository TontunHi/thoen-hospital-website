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
  ReceiptText,
  UserCheck,
  ShieldCheck,
  Calendar,
  Layers,
  HeartPulse,
  Clock,
  Phone,
  Building,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react'
import type {
  T1dmGdmPdmRecipientItem,
  T1dmGdmPdmSummary,
  T1dmGdmPdmCardFilter,
  T1dmGdmPdmSortField,
  T1dmGdmPdmReportResult,
} from '@/lib/clinical/rcmT1dmGdmPdmService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface T1dmGdmPdm2ClientProps {
  initialData?: T1dmGdmPdmReportResult | null
}

export default function T1dmGdmPdm2Client({ initialData = null }: T1dmGdmPdm2ClientProps) {
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
  const [pttypes, setPttypes] = useState<string[]>([])
  const [cardFilter, setCardFilter] = useState<T1dmGdmPdmCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<T1dmGdmPdmSortField>(
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
  const [items, setItems] = useState<T1dmGdmPdmRecipientItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [summary, setSummary] = useState<T1dmGdmPdmSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      uniquePatients: 0,
      registeredCases: 0,
      registeredRate: 0,
      notRegisteredCases: 0,
      notRegisteredRate: 0,
      compensatedCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      uncompensatedCases: 0,
      withAuthenCases: 0,
      withAuthenRate: 0,
      noAuthenCases: 0,
      ucCases: 0,
      ucRate: 0,
    }
  )

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<T1dmGdmPdmRecipientItem | null>(null)
  const [modalTab, setModalTab] = useState<'overview' | 'diagnoses' | 'orders'>('overview')
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
        if (pttypes.length > 0) query.set('pttypes', pttypes.join(','))
        if (refresh) query.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients?${query.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data: T1dmGdmPdmReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) setSummary(data.summary)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'ไม่สามารถเชื่อมต่อระบบได้')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, debouncedSearch, sortBy, sortOrder, currentPage, pageSize, pttypes]
  )

  // Skip initial fetch on mount if initialData is provided
  const initialMountRef = useRef<boolean>(true)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Fetch VN Clinical Details when row modal opens
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    setVnDetails(null)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/vn-details?vn=${encodeURIComponent(vn)}`
      )
      const json = await res.json()
      if (json.success && json.data) {
        setVnDetails(json.data)
      }
    } catch {
      // Non-blocking: details tab will show fallback
    } finally {
      setLoadingVnDetails(false)
    }
  }, [])

  const handleRowClick = (item: T1dmGdmPdmRecipientItem) => {
    setSelectedItem(item)
    setModalTab('overview')
    fetchVnDetails(item.vn)
  }

  const handleCloseModal = () => {
    setSelectedItem(null)
    setVnDetails(null)
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 1800)
  }

  // Handle Date Mode Changes
  const applyDateMode = (
    mode: 'custom' | 'monthly' | 'fiscal',
    fiscalBeYear: number,
    month: number,
    beYear: number
  ) => {
    if (mode === 'fiscal') {
      const ceYear = fiscalBeYear - 543
      setDs1(`${ceYear - 1}-10-01`)
      setDs2(`${ceYear}-09-30`)
    } else if (mode === 'monthly') {
      const ceYear = beYear - 543
      const mStr = String(month).padStart(2, '0')
      const lastDay = new Date(ceYear, month, 0).getDate()
      setDs1(`${ceYear}-${mStr}-01`)
      setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    }
  }

  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    applyDateMode(mode, selectedFiscalYear, selectedMonth, selectedBeYear)
    setCurrentPage(1)
  }

  const handleCardClick = (filter: T1dmGdmPdmCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  const handleSort = (field: T1dmGdmPdmSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Export full CSV with UTF-8 BOM
  const exportToCsv = async () => {
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
      if (pttypes.length > 0) query.set('pttypes', pttypes.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients?${query.toString()}`
      )
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')

      const exportItems: T1dmGdmPdmRecipientItem[] = json.data?.items || []

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขประจำตัวประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สัญชาติ',
        'เบอร์โทรศัพท์',
        'ทะเบียน OK',
        'ประเภทเบาหวาน',
        'วันที่ลงทะเบียน',
        'วันที่รับบริการ',
        'เวลารับบริการ',
        'ประจำเดือนครั้งสุดท้าย (LMP)',
        'ClaimCode',
        'สิทธิการรักษา (Visit)',
        'สิทธิการรักษา (Patient)',
        'แผนกที่รับบริการ',
        'คลินิก',
        'PDX (วินิจฉัยหลัก)',
        'DX0',
        'DX1',
        'DX2',
        'DX3',
        'DX4',
        'DX5',
        'OP0',
        'OP1',
        'OP2',
        'OP3',
        'OP4',
        'OP5',
        'สถานะการชดเชย',
        'เลขที่ Rep',
        'ยอดชดเชย (บาท)',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const rows = exportItems.map((row) => [
        row.no,
        row.vn,
        row.hn,
        row.cid,
        row.ptname,
        row.sex,
        row.age,
        row.nation || '',
        row.tel || '',
        row.ok || 'N',
        row.type || '',
        row.regdate || '',
        row.vstdate,
        row.vsttime,
        row.lmp || '',
        row.authencode || '',
        row.pttypenameVisit || '',
        row.pttypenamePatient || '',
        row.department || '',
        row.clinic || '',
        row.pdx || '',
        row.dx0 || '',
        row.dx1 || '',
        row.dx2 || '',
        row.dx3 || '',
        row.dx4 || '',
        row.dx5 || '',
        row.op0 || '',
        row.op1 || '',
        row.op2 || '',
        row.op3 || '',
        row.op4 || '',
        row.op5 || '',
        row.status || '',
        row.rep || '',
        row.compensated,
        row.fund || '',
        row.subfund || '',
      ])

      await exportRcmExcel({
        filename: `t1dm_gdm_pdm_recipients_${ds1}_to_${ds2}.xlsx`,
        title: 'ผู้ป่วยเบาหวาน T1DM, GDM, PDM (2)',
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

  // Helper to split patient name into first and last name for intact wrapping
  const splitPtName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return { first: fullName, last: '' }
    const last = parts.pop() || ''
    const first = parts.join(' ')
    return { first, last }
  }

  return (
    <div className="dm-page">
      {/* ── 1. Clean Breadcrumb (No Eyebrow Badges) ── */}
      <nav className="dm-breadcrumb" aria-label="breadcrumb">
        <Link href="/">หน้าหลัก</Link>
        <span className="dm-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm">รายงาน RCM</Link>
        <span className="dm-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds">กองทุน</Link>
        <span className="dm-breadcrumb-sep">/</span>
        <span>กองทุน T1DM/GDM/PDM</span>
        <span className="dm-breadcrumb-sep">/</span>
        <span className="dm-breadcrumb-current">รายชื่อผู้รับบริการ</span>
      </nav>

      {/* ── Header Bar ── */}
      <div className="dm-header">
        <div className="dm-title-group">
          <h1 className="dm-title">รายชื่อผู้รับบริการ กองทุน T1DM/GDM/PDM</h1>
          <p className="dm-subtitle">
            <span>กองทุนโรคเบาหวานขณะตั้งครรภ์และระยะหลังคลอด (ICD-10 O24)</span>
            <span className="dm-subtitle-dot">·</span>
            <span>ตรวจสอบสถานะการลงทะเบียนทะเบียน T1DM, GDM, PDM</span>
            <span className="dm-subtitle-dot">·</span>
            <span>ติดตาม ClaimCode และการชดเชยค่าบริการทางการแพทย์</span>
          </p>
        </div>

        <div className="dm-actions">
          <button
            type="button"
            className="dm-btn dm-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'dm-spin' : ''} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}</span>
          </button>

          <button
            type="button"
            className="dm-btn dm-btn-secondary"
            onClick={exportToCsv}
            disabled={loading || isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. Single-Row Unified Date Selection Card ── */}
      <div className="dm-date-card">
        <div className="dm-date-segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`dm-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`dm-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`dm-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="dm-date-divider" aria-hidden="true" />

        <div className="dm-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="dm-control-group">
                <span className="dm-control-label">ตั้งแต่วันที่:</span>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="dm-control-group">
                <span className="dm-control-label">ถึงวันที่:</span>
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
              <div className="dm-control-group">
                <span className="dm-control-label">เลือกเดือน:</span>
                <select
                  className="dm-select"
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
              <div className="dm-control-group">
                <span className="dm-control-label">พ.ศ.:</span>
                <select
                  className="dm-select"
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
            <div className="dm-control-group">
              <span className="dm-control-label">เลือกปีงบประมาณ:</span>
              <select
                className="dm-select"
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
      <div className="dm-kpi-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('ALL')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('ALL')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">ผู้รับบริการทั้งหมด</span>
            <Activity size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.totalCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">{summary.uniquePatients.toLocaleString()} คน</span>
          </div>
        </div>

        {/* Card 2: ลงทะเบียนแล้ว */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'REGISTERED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('REGISTERED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('REGISTERED')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">ลงทะเบียนแล้ว</span>
            <UserCheck size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.registeredCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">{summary.registeredRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 3: ยังไม่ลงทะเบียน */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'NOT_REGISTERED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('NOT_REGISTERED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('NOT_REGISTERED')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">ยังไม่ลงทะเบียน</span>
            <Layers size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.notRegisteredCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">{summary.notRegisteredRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 4: ชดเชยแล้ว */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('COMPENSATED')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">ชดเชยแล้ว</span>
            <ReceiptText size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.compensatedCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">{formatMoney(summary.totalCompensated)} ฿</span>
          </div>
        </div>

        {/* Card 5: ยังไม่ชดเชย */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UNCOMPENSATED')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">ยังไม่ชดเชย</span>
            <Clock size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.uncompensatedCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">
              {summary.totalCases > 0
                ? ((summary.uncompensatedCases / summary.totalCases) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Card 6: มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('WITH_AUTHEN')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">มี ClaimCode</span>
            <KeyRound size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.withAuthenCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">{summary.withAuthenRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 7: ไม่มี ClaimCode */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('NO_AUTHEN')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('NO_AUTHEN')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">ไม่มี ClaimCode</span>
            <Layers size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.noAuthenCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">
              {summary.totalCases > 0
                ? ((summary.noAuthenCases / summary.totalCases) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Card 8: สิทธิบัตรทอง */}
        <div
          role="button"
          tabIndex={0}
          className={`dm-kpi-card ${cardFilter === 'UC_ONLY' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UC_ONLY')}
          onKeyDown={(e) => e.key === 'Enter' && handleCardClick('UC_ONLY')}
        >
          <div className="dm-kpi-card-header">
            <span className="dm-kpi-label">สิทธิบัตรทอง (UC)</span>
            <ShieldCheck size={18} className="dm-kpi-icon" />
          </div>
          <div className="dm-kpi-value-row">
            <span className="dm-kpi-value">{summary.ucCases.toLocaleString()}</span>
            <span className="dm-kpi-sub">{summary.ucRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* ── 5. Toolbar & Search ── */}
      <div className="dm-toolbar">
        <div className="dm-search-box">
          <Search size={16} className="dm-search-icon" />
          <input
            type="text"
            className="dm-search-input"
            placeholder="ค้นหาด้วย HN, เลขบัตรประชาชน, ชื่อ-สกุล, VN, รหัสโรค หรือสิทธิ์..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="dm-search-clear"
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

        <div className="dm-toolbar-meta">
          <span>
            พบข้อมูลทั้งหมด <span className="dm-count-badge">{totalCount.toLocaleString()}</span> รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <button
              type="button"
              className="dm-badge dm-badge-neutral"
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
      <div className="dm-table-container">
        <div className="dm-table-scroll">
          <table className="dm-table">
            <thead>
              <tr>
                <th className="col-center" style={{ width: '50px' }}>
                  ลำดับ
                </th>
                <th className="col-center" style={{ minWidth: '120px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
                    onClick={() => handleSort('vstdate')}
                  >
                    <span>วันที่รับบริการ</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '80px' }}>
                  เวลา
                </th>
                <th className="col-center" style={{ minWidth: '90px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
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
                    className="dm-th-sort"
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
                  <button
                    type="button"
                    className="dm-th-sort"
                    onClick={() => handleSort('age')}
                  >
                    <span>อายุ</span>
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '110px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
                    onClick={() => handleSort('type')}
                  >
                    <span>ทะเบียน</span>
                    {sortBy === 'type' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '110px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
                    onClick={() => handleSort('lmp')}
                  >
                    <span>LMP</span>
                    {sortBy === 'lmp' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th style={{ minWidth: '140px' }}>สิทธิการรักษา</th>
                <th className="col-center" style={{ minWidth: '90px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
                    onClick={() => handleSort('pdx')}
                  >
                    <span>PDX</span>
                    {sortBy === 'pdx' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '110px' }}>
                    ClaimCode
                  </th>
                <th className="col-center" style={{ minWidth: '100px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
                    onClick={() => handleSort('status')}
                  >
                    <span>สถานะ</span>
                    {sortBy === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="col-center" style={{ minWidth: '100px' }}>
                  เลขที่ Rep
                </th>
                <th className="col-center" style={{ minWidth: '110px' }}>
                  <button
                    type="button"
                    className="dm-th-sort"
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
                    {Array.from({ length: 16 }).map((__, colIdx) => (
                      <td key={colIdx} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={16} className="dm-empty-state">
                    <div className="dm-empty-title" style={{ color: '#dc2626' }}>
                      เกิดข้อผิดพลาดในการดึงข้อมูล
                    </div>
                    <div className="dm-empty-desc">{error}</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={16} className="dm-empty-state">
                    <HeartPulse size={28} className="dm-empty-icon" />
                    <div className="dm-empty-title">ไม่พบข้อมูลผู้รับบริการที่ตรงตามเงื่อนไข</div>
                    <div className="dm-empty-desc">
                      ลองเปลี่ยนตัวกรอง วันที่ หรือคำค้นหาใหม่อีกครั้ง
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const { first, last } = splitPtName(row.ptname)
                  return (
                    <tr
                      key={row.vn}
                      className="dm-row-clickable"
                      onClick={() => handleRowClick(row)}
                      title="กดเพื่อเปิดดูรายละเอียดเวชระเบียนผู้ป่วย"
                    >
                      <td className="col-center dm-num">{row.no}</td>
                      <td className="col-center dm-num">
                        {formatThaiDate(row.vstdate)}
                      </td>
                      <td className="col-center dm-num">{row.vsttime || '—'}</td>
                      <td className="col-center dm-num">{row.hn}</td>
                      <td className="col-center dm-cid">{row.cid}</td>
                      <td className="dm-ptname-col">
                        <div className="dm-ptname-wrapper">
                          <span className="dm-ptname-part">{first}</span>
                          {last && (
                            <>
                              {' '}
                              <span className="dm-ptname-part">{last}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="col-center">{row.sex}</td>
                      <td className="col-center dm-age-nowrap">{row.age}&nbsp;ปี</td>
                      <td className="col-center">
                        {row.isRegistered ? (
                          <span
                            className="dm-badge dm-badge-success"
                            title={`ลงทะเบียนแล้ว: ${row.type || 'T1DM'} (${formatThaiDate(row.regdate)})`}
                          >
                            {row.type || 'OK'}
                          </span>
                        ) : (
                          <span className="dm-badge dm-badge-neutral">ยังไม่ลง</span>
                        )}
                      </td>
                      <td className="col-center dm-num">
                        {row.lmp ? formatThaiDate(row.lmp) : '—'}
                      </td>
                      <td>
                        <span title={row.pttypenameVisit || row.pttypenamePatient || ''}>
                          {row.pttypenameVisit || row.pttypenamePatient || '—'}
                        </span>
                      </td>
                      <td className="col-center">
                        <span className="dm-badge dm-badge-info">{row.pdx || '—'}</span>
                      </td>
                      <td className="col-center dm-num">
                        {row.authencode ? (
                          <span className="dm-badge dm-badge-purple" title={row.authencode}>
                            {row.authencode}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="col-center">
                        <span
                          className={`dm-badge ${
                            row.isCompensated ? 'dm-badge-success' : 'dm-badge-neutral'
                          }`}
                        >
                          {row.status || (row.isCompensated ? 'มี Rep แล้ว' : 'รอส่งเบิก')}
                        </span>
                      </td>
                      <td className="col-center dm-num">
                        {row.rep ? (
                          <span className="dm-badge dm-badge-info" title={row.rep}>
                            {row.rep}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                        <RcmSeamlessRepBadges row={row} />
                      </td>
                      <td className="col-center dm-num">
                        {row.compensated > 0 ? (
                          <span style={{ fontWeight: 600, color: '#137333' }}>
                            {formatMoney(row.compensated)}
                          </span>
                        ) : (
                          '—'
                        )}
                        <RcmSeamlessSubAmount row={row} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && totalCount > 0 && (
          <div className="dm-pagination">
            <div>
              กำลังแสดงหน้า {currentPage} จาก {totalPages} หน้า (ทั้งหมด {totalCount.toLocaleString()}{' '}
              รายการ)
            </div>
            <div className="dm-page-controls">
              <button
                type="button"
                className="dm-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                title="หน้าแรก"
              >
                &laquo;
              </button>
              <button
                type="button"
                className="dm-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="หน้าก่อนหน้า"
              >
                &lsaquo;
              </button>

              <span style={{ padding: '0 8px', fontWeight: 600, color: '#0f172a' }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="dm-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="หน้าถัดไป"
              >
                &rsaquo;
              </button>
              <button
                type="button"
                className="dm-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="หน้าสุดท้าย"
              >
                &raquo;
              </button>

              <select
                className="dm-select"
                style={{ marginLeft: '12px', minHeight: '34px', padding: '4px 8px' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={20}>20 แถว/หน้า</option>
                <option value={50}>50 แถว/หน้า</option>
                <option value={100}>100 แถว/หน้า</option>
                <option value={200}>200 แถว/หน้า</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Detail Modal (Opened by row click) ── */}
      {selectedItem && (
        <div className="dm-modal-backdrop" onClick={handleCloseModal}>
          <div
            className="dm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dm-modal-header">
              <div>
                <h3 className="dm-modal-title">
                  {selectedItem.ptname}
                </h3>
                <p className="dm-modal-subtitle">
                  HN: {selectedItem.hn} · เลขบัตรประชาชน: {selectedItem.cid} · วันที่รับบริการ:{' '}
                  {formatThaiDate(selectedItem.vstdate)} ({selectedItem.vsttime || '—'})
                </p>
              </div>
              <button
                type="button"
                className="dm-modal-close"
                onClick={handleCloseModal}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="dm-modal-tabs">
              <button
                type="button"
                className={`dm-modal-tab ${modalTab === 'overview' ? 'is-active' : ''}`}
                onClick={() => setModalTab('overview')}
              >
                ข้อมูลเวชระเบียน & การชดเชย
              </button>
              <button
                type="button"
                className={`dm-modal-tab ${modalTab === 'diagnoses' ? 'is-active' : ''}`}
                onClick={() => setModalTab('diagnoses')}
              >
                รหัสโรคและการวินิจฉัย (PDX/DX/OP)
              </button>
              <button
                type="button"
                className={`dm-modal-tab ${modalTab === 'orders' ? 'is-active' : ''}`}
                onClick={() => setModalTab('orders')}
              >
                รายการยาและใบสั่งการรักษา
              </button>
            </div>

            {/* Modal Body */}
            <div className="dm-modal-body">
              {modalTab === 'overview' && (
                <>
                  <div className="dm-detail-section-title">ข้อมูลทั่วไปและทะเบียนผู้ป่วย</div>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">หมายเลข VN:</span>
                      <span className="dm-detail-value">
                        {selectedItem.vn}
                        <button
                          type="button"
                          className="dm-copy-btn"
                          onClick={() => handleCopy(selectedItem.vn, 'vn')}
                          title="คัดลอก VN"
                        >
                          {copiedField === 'vn' ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">เลขประจำตัวประชาชน (13 หลัก):</span>
                      <span className="dm-detail-value">
                        {selectedItem.cid}
                        <button
                          type="button"
                          className="dm-copy-btn"
                          onClick={() => handleCopy(selectedItem.cid, 'cid')}
                          title="คัดลอก CID"
                        >
                          {copiedField === 'cid' ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">อายุ / เพศ:</span>
                      <span className="dm-detail-value">
                        {selectedItem.age}&nbsp;ปี ({selectedItem.sex})
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">วันเกิด / สัญชาติ:</span>
                      <span className="dm-detail-value">
                        {selectedItem.birthday ? formatThaiDate(selectedItem.birthday) : '—'} (
                        {selectedItem.nation || 'ไทย'})
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">เบอร์โทรศัพท์ติดต่อ:</span>
                      <span className="dm-detail-value">{selectedItem.tel || '—'}</span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">ประจำเดือนครั้งสุดท้าย (LMP):</span>
                      <span className="dm-detail-value">
                        {selectedItem.lmp ? formatThaiDate(selectedItem.lmp) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="dm-detail-section-title">สถานะการลงทะเบียนกองทุน T1DM/GDM/PDM</div>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">สถานะลงทะเบียน:</span>
                      <span className="dm-detail-value">
                        {selectedItem.isRegistered ? (
                          <span className="dm-badge dm-badge-success">ลงทะเบียนแล้ว (OK)</span>
                        ) : (
                          <span className="dm-badge dm-badge-neutral">ยังไม่ได้ลงทะเบียน</span>
                        )}
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">ประเภทเบาหวาน:</span>
                      <span className="dm-detail-value">
                        {selectedItem.type ? (
                          <span className="dm-badge dm-badge-purple">{selectedItem.type}</span>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">วันที่ลงทะเบียน:</span>
                      <span className="dm-detail-value">
                        {selectedItem.regdate ? formatThaiDate(selectedItem.regdate) : '—'}
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">ClaimCode:</span>
                      <span className="dm-detail-value">
                        {selectedItem.authencode ? (
                          <span className="dm-badge dm-badge-purple">{selectedItem.authencode}</span>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="dm-detail-section-title">สิทธิการรักษาและการชดเชย</div>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">สิทธิการรักษา (Visit):</span>
                      <span className="dm-detail-value">
                        {selectedItem.pttypenameVisit || '—'}
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">แผนก / คลินิก:</span>
                      <span className="dm-detail-value">
                        {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">สถานะการชดเชย:</span>
                      <span className="dm-detail-value">
                        <span
                          className={`dm-badge ${
                            selectedItem.isCompensated ? 'dm-badge-success' : 'dm-badge-neutral'
                          }`}
                        >
                          {selectedItem.status || '—'}
                        </span>
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">เลขที่ใบตอบรับ (Rep):</span>
                      <span className="dm-detail-value">{selectedItem.rep || '—'}</span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">ยอดเงินชดเชย (บาท):</span>
                      <span className="dm-detail-value" style={{ fontWeight: 700, color: '#137333' }}>
                        {formatMoney(selectedItem.compensated)} บาท
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">กองทุน / กองทุนย่อย:</span>
                      <span className="dm-detail-value">
                        {selectedItem.fund || '—'} / {selectedItem.subfund || '—'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'diagnoses' && (
                <>
                  <div className="dm-detail-section-title">การวินิจฉัยโรค (Diagnoses)</div>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">การวินิจฉัยหลัก (PDX):</span>
                      <span className="dm-detail-value">
                        <span className="dm-badge dm-badge-info">{selectedItem.pdx || '—'}</span>
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">รหัสโรคร่วม (Secondary Diagnoses DX0 - DX5):</span>
                      <span className="dm-detail-value" style={{ flexWrap: 'wrap' }}>
                        {selectedItem.allDx.length > 0 ? (
                          selectedItem.allDx.map((dx, i) => (
                            <span key={i} className="dm-badge dm-badge-neutral" style={{ marginRight: '4px' }}>
                              {dx}
                            </span>
                          ))
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="dm-detail-section-title">หัตถการทางการแพทย์ (Operations / Procedures)</div>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">หัตถการหลัก (OP0):</span>
                      <span className="dm-detail-value">
                        {selectedItem.op0 ? (
                          <span className="dm-badge dm-badge-purple">{selectedItem.op0}</span>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>

                    <div className="dm-detail-item">
                      <span className="dm-detail-label">หัตถการอื่นๆ (OP1 - OP5):</span>
                      <span className="dm-detail-value" style={{ flexWrap: 'wrap' }}>
                        {selectedItem.allOp.length > 0 ? (
                          selectedItem.allOp.map((op, i) => (
                            <span key={i} className="dm-badge dm-badge-neutral" style={{ marginRight: '4px' }}>
                              {op}
                            </span>
                          ))
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'orders' && (
                <div>
                  {loadingVnDetails ? (
                    <div className="dm-empty-state">
                      <RefreshCw size={20} className="dm-spin dm-empty-icon" />
                      <div className="dm-empty-title">กำลังดึงรายการยาและการรักษา...</div>
                    </div>
                  ) : vnDetails && vnDetails.orders?.items && vnDetails.orders.items.length > 0 ? (
                    <table className="dm-table" style={{ marginTop: '8px' }}>
                      <thead>
                        <tr>
                          <th>ชื่อรายการยา / เวชภัณฑ์</th>
                          <th className="col-center" style={{ width: '80px' }}>
                            จำนวน
                          </th>
                          <th className="col-center" style={{ width: '100px' }}>
                            หน่วย
                          </th>
                          <th className="col-center" style={{ width: '120px' }}>
                            ราคา (บาท)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {vnDetails.orders.items.map((ord, idx) => (
                          <tr key={idx}>
                            <td>{ord.item_name}</td>
                            <td className="col-center dm-num">{ord.qty}</td>
                            <td className="col-center">{ord.units || '—'}</td>
                            <td className="col-center dm-num">
                              {formatMoney(ord.sum_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="dm-empty-state">
                      <div className="dm-empty-title">ไม่พบรายการยาหรือคำสั่งการรักษาในระบบ HOSxP</div>
                      <div className="dm-empty-desc">
                        ผู้ป่วยอาจได้รับการตรวจประเมินหรือให้คำปรึกษาโดยไม่ได้มีการสั่งจ่ายยาในครั้งนี้
                      </div>
                    </div>
                  )}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>

            <div className="dm-modal-footer">
              <button
                type="button"
                className="dm-btn dm-btn-secondary"
                onClick={handleCloseModal}
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
