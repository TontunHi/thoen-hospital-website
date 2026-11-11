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
  Home,
  FileText,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  CreditCard,
  Building2,
  Activity,
  Receipt,
  Phone,
} from 'lucide-react'
import type {
  HomewardItem,
  HomewardSummary,
  HomewardCardFilter,
  HomewardSortField,
  HomewardReportResult,
} from '@/lib/clinical/rcmAmedHomewardService'
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
  if (val == null || val === 0) return '0.00'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface HomewardReportClientProps {
  initialData?: HomewardReportResult | null
}

export default function HomewardReportClient({ initialData = null }: HomewardReportClientProps) {
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

  // Date selection states: กำหนดเอง | เดือน | ปีงบประมาณ
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
  const [cardFilter, setCardFilter] = useState<HomewardCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<HomewardSortField>(
    initialData?.sortBy ?? 'dchdate'
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
  const [items, setItems] = useState<HomewardItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [summary, setSummary] = useState<HomewardSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      onAmedCases: 0,
      notOnAmedCases: 0,
      withAuthenCases: 0,
      noAuthenCases: 0,
      withRepCases: 0,
      noRepCases: 0,
      withDebitCases: 0,
      totalIncome: 0,
      totalDebit: 0,
      totalAdjrw: 0,
      avgLos: 0,
    }
  )

  // Modal inspection states
  const [selectedItem, setSelectedItem] = useState<HomewardItem | null>(null)
  const [modalTab, setModalTab] = useState<'general' | 'financial' | 'amed'>('general')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Ref to prevent initial fetch when initialData is provided
  const isFirstMount = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(handler)
  }, [search])

  // Handle Month mode change
  const handleMonthYearChange = useCallback((m: number, beYear: number) => {
    setSelectedMonth(m)
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const start = `${ceYear}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(ceYear, m, 0).getDate()
    const end = `${ceYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    setDs1(start)
    setDs2(end)
    setCurrentPage(1)
  }, [])

  // Handle Fiscal Year mode change
  const handleFiscalYearChange = useCallback((fiscalBe: number) => {
    setSelectedFiscalYear(fiscalBe)
    const fiscalCe = fiscalBe - 543
    const start = `${fiscalCe - 1}-10-01`
    const end = `${fiscalCe}-09-30`
    setDs1(start)
    setDs2(end)
    setCurrentPage(1)
  }, [])

  // Fetch report data
  const fetchData = useCallback(
    async (refresh = false) => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

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

        if (pttypes.length > 0) {
          queryParams.set('pttypes', pttypes.join(','))
        }

        if (refresh) {
          queryParams.append('refresh', 'true')
        }

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/amed-homeward/homeward?${queryParams.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data: HomewardReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, pttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Handle Card Filter Toggle
  const handleCardFilterClick = (filter: HomewardCardFilter) => {
    setCardFilter((prev) => (prev === filter ? 'ALL' : filter))
    setCurrentPage(1)
  }

  // Handle Sort column click
  const handleSort = (field: HomewardSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Render Sort Indicator inline
  const renderSortIndicator = (field: HomewardSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
    }
    return sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
  }

  // Handle Copy text helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Export full Excel (.xlsx)
  const handleExportExcel = async () => {
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

      if (pttypes.length > 0) {
        queryParams.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/amed-homeward/homeward?${queryParams.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกไฟล์ไม่สำเร็จ')
      }

      const exportItems: HomewardItem[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'AN',
        'HN',
        'เลขประจำตัวประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'สัญชาติ',
        'วันที่รับบริการ (Admit)',
        'วันที่จำหน่าย (Discharge)',
        'จำนวนวันนอน (LOS)',
        'วันที่สรุปเวชระเบียน',
        'ระยะเวลาสรุป (วัน)',
        'หอผู้ป่วย',
        'เตียง',
        'คลินิก/สาขา',
        'การวินิจฉัยเบื้องต้น (Prediag)',
        'รหัสโรคหลัก (PDX)',
        'ชื่อโรคหลัก',
        'รหัสโรครอง (SDX)',
        'รหัสหัตถการ (ICD-9)',
        'AdjRW',
        'แพทย์ผู้รับ',
        'แพทย์จำหน่าย',
        'ClaimCode',
        'รหัสสิทธิ eClaim',
        'ชื่อสิทธิ eClaim',
        'รหัสสิทธิ รพ.',
        'ชื่อสิทธิ รพ.',
        'GFMIS',
        'Account Code',
        'เลขที่สิทธิ',
        'รพ.หลัก',
        'รพ.รอง',
        'สถานะการจำหน่าย',
        'ประเภทการจำหน่าย',
        'สถานะสรุปชาร์จ',
        'ค่ารักษาทั้งหมด (Income)',
        'ชดเชย UC',
        'ส่วนลด (Discount)',
        'ชำระเอง (Paid)',
        'ใบเสร็จ (Rcpt)',
        'ยอดหนี้ค้างชำระ (Debit)',
        'เพดานหนี้สูงสุด',
        'เงินติดตาม',
        'เลขที่ใบแจ้งหนี้',
        'วันที่ใบแจ้งหนี้',
        'ผู้บันทึก',
        'ที่อยู่',
        'เบอร์โทรศัพท์',
        'สถานะ AMed',
        'CID บน AMed Web',
        'AN บน AMed Web',
        'เลข Rep',
        'หมายเหตุ Rep',
        'เลข Invoice',
      ]

      const rows = exportItems.map((item) => [
        item.no,
        item.an,
        item.hn,
        item.cid,
        item.ptname,
        item.sex,
        item.age,
        item.nation,
        item.admdate,
        item.dchdate,
        item.los,
        item.editdate || '',
        item.day_diff,
        item.ward,
        item.bedno,
        item.clinic,
        item.prediag,
        item.pdx,
        item.pdxname,
        item.sdx || '',
        item.proc_code || '',
        item.adjrw,
        item.admdoctor,
        item.dchdoctor,
        item.authencode || '',
        item.pttype_eclaim_id,
        item.pttype_eclaim_name,
        item.pttype,
        item.pttypename,
        item.gfmis,
        item.accountcode,
        item.pttypeno,
        item.hospmain,
        item.hospsub,
        item.dchstts,
        item.dchtype,
        item.summary_status,
        item.income,
        item.uc_money,
        item.discount_money,
        item.paid_money,
        item.rcpt_money,
        item.debit,
        item.max_debt_amount ?? '',
        item.follow_money,
        item.bill || '',
        item.billdate || '',
        item.staff,
        item.address,
        item.tel,
        item.isOnAmed ? 'ลงทะเบียนแล้ว' : 'ยังไม่มีในระบบ',
        item.onweb_cid || '',
        item.anonweb || '',
        item.rep || '',
        item.rep_remark || '',
        item.invoice || '',
      ])

      await exportRcmExcel({
        filename: `รายงาน_HOMEWARD_${ds1}_ถึง_${ds2}.xlsx`,
        title: 'รายงาน HOMEWARD',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportItems.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })
    } catch (err: unknown) {
      alert((err as Error).message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล')
    } finally {
      setIsExporting(false)
    }
  }

  // Helper to split patient name into first & last for intact surname wrap
  const splitPatientName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return { first: fullName, last: '' }
    const first = parts.slice(0, -1).join(' ')
    const last = parts[parts.length - 1]
    return { first, last }
  }

  return (
    <div className="hw-page">
      {/* ── 1. Clean Breadcrumb (No Eyebrow Pills) ── */}
      <nav className="hw-breadcrumb" aria-label="Breadcrumb">
        <Link href="/service/dashboard-rcm">แดชบอร์ด RCM</Link>
        <span className="hw-breadcrumb-sep">/</span>
        <span>กองทุน</span>
        <span className="hw-breadcrumb-sep">/</span>
        <span>ระบบ AMed และ Home Ward</span>
        <span className="hw-breadcrumb-sep">/</span>
        <span className="hw-breadcrumb-current">รายงาน HOMEWARD</span>
      </nav>

      {/* ── 2. Header Bar ── */}
      <div className="hw-header">
        <div className="hw-title-group">
          <h1 className="hw-title">รายงาน HOMEWARD</h1>
          <p className="hw-subtitle">
            <span>ระบบดูแลผู้ป่วยใน Home Ward และระบบ AMed Tele-medicine</span>
            <span className="hw-subtitle-dot">•</span>
            <span>สิทธิการรักษาบัตรทองและกองทุนย่อย</span>
          </p>
        </div>

        <div className="hw-actions">
          <button
            type="button"
            className="hw-btn hw-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลจากฐานข้อมูล"
          >
            <RefreshCw size={15} className={isRefreshing ? 'hw-spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="hw-btn hw-btn-primary"
            onClick={handleExportExcel}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={15} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. Single-Row Unified Date Selector ── */}
      <div className="hw-date-card">
        {/* Segmented Mode Switcher (No 1. 2. 3. numbers) */}
        <div className="hw-date-segmented" role="tablist">
          <button
            type="button"
            className={`hw-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => setDateMode('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            className={`hw-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => {
              setDateMode('monthly')
              handleMonthYearChange(selectedMonth, selectedBeYear)
            }}
          >
            รายเดือน
          </button>
          <button
            type="button"
            className={`hw-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => {
              setDateMode('fiscal')
              handleFiscalYearChange(selectedFiscalYear)
            }}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="hw-date-divider" />

        {/* Date Inputs in Single Line */}
        <div className="hw-date-controls">
          {dateMode === 'custom' && (
            <div className="hw-control-group">
              <span className="hw-control-label">ตั้งแต่:</span>
              <ThaiDatePicker value={ds1} onChange={(val) => setDs1(val)} />
              <span className="hw-control-label">ถึง:</span>
              <ThaiDatePicker value={ds2} onChange={(val) => setDs2(val)} />
              <button
                type="button"
                className="hw-btn hw-btn-secondary"
                style={{ padding: '6px 14px', minHeight: 38 }}
                onClick={() => {
                  setCurrentPage(1)
                  fetchData()
                }}
              >
                ค้นหา
              </button>
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="hw-control-group">
              <span className="hw-control-label">เดือน:</span>
              <select
                className="hw-select"
                value={selectedMonth}
                onChange={(e) =>
                  handleMonthYearChange(Number(e.target.value), selectedBeYear)
                }
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <span className="hw-control-label">ปี พ.ศ.:</span>
              <select
                className="hw-select"
                value={selectedBeYear}
                onChange={(e) =>
                  handleMonthYearChange(selectedMonth, Number(e.target.value))
                }
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
            <div className="hw-control-group">
              <span className="hw-control-label">ปีงบประมาณ:</span>
              <select
                className="hw-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
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
      <div className="hw-kpi-grid">
        {/* Card 1: ผู้ป่วยทั้งหมด */}
        <div
          className={`hw-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('ALL')}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">ผู้ป่วยทั้งหมด</span>
            <div className={`hw-kpi-dot ${cardFilter === 'ALL' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span className="hw-kpi-value">{summary.totalCases.toLocaleString()}</span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">
            AdjRW รวม: {summary.totalAdjrw.toFixed(2)} | วันนอนเฉลี่ย: {summary.avgLos} วัน
          </div>
        </div>

        {/* Card 2: ลงทะเบียน AMed แล้ว */}
        <div
          className={`hw-kpi-card ${cardFilter === 'ON_AMED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('ON_AMED')}
          title="คลิกเพื่อกรองเฉพาะผู้ป่วยที่ลงทะเบียนในระบบ AMed"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">ลงทะเบียน AMed แล้ว</span>
            <div className={`hw-kpi-dot ${cardFilter === 'ON_AMED' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span className="hw-kpi-value" style={{ color: '#0d7446' }}>
              {summary.onAmedCases.toLocaleString()}
            </span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">
            คิดเป็น{' '}
            {summary.totalCases > 0
              ? ((summary.onAmedCases / summary.totalCases) * 100).toFixed(1)
              : 0}
            % ของทั้งหมด
          </div>
        </div>

        {/* Card 3: ยังไม่มีใน AMed */}
        <div
          className={`hw-kpi-card ${cardFilter === 'NOT_ON_AMED' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('NOT_ON_AMED')}
          title="คลิกเพื่อกรองเฉพาะผู้ป่วยที่ยังไม่ได้ลงทะเบียนใน AMed"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">ยังไม่มีใน AMed</span>
            <div className={`hw-kpi-dot ${cardFilter === 'NOT_ON_AMED' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span
              className="hw-kpi-value"
              style={{ color: summary.notOnAmedCases > 0 ? '#b45309' : undefined }}
            >
              {summary.notOnAmedCases.toLocaleString()}
            </span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">ยังไม่พบข้อมูล CID/AN บนระบบ AMed</div>
        </div>

        {/* Card 4: มี ClaimCode */}
        <div
          className={`hw-kpi-card ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะผู้ป่วยที่มี ClaimCode"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">มี ClaimCode</span>
            <div className={`hw-kpi-dot ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span className="hw-kpi-value" style={{ color: '#0d7446' }}>
              {summary.withAuthenCases.toLocaleString()}
            </span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">
            คิดเป็น{' '}
            {summary.totalCases > 0
              ? ((summary.withAuthenCases / summary.totalCases) * 100).toFixed(1)
              : 0}
            % ของทั้งหมด
          </div>
        </div>

        {/* Card 5: ไม่มี ClaimCode */}
        <div
          className={`hw-kpi-card ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('NO_AUTHEN')}
          title="คลิกเพื่อกรองเฉพาะผู้ป่วยที่ไม่มี ClaimCode"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">ไม่มี ClaimCode</span>
            <div className={`hw-kpi-dot ${cardFilter === 'NO_AUTHEN' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span
              className="hw-kpi-value"
              style={{ color: summary.noAuthenCases > 0 ? '#dc2626' : undefined }}
            >
              {summary.noAuthenCases.toLocaleString()}
            </span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">จำเป็นต้องขอรหัสยืนยันตัวตน สปสช.</div>
        </div>

        {/* Card 6: มี Rep / Invoice แล้ว */}
        <div
          className={`hw-kpi-card ${cardFilter === 'WITH_REP' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_REP')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี Rep หรือ Invoice แล้ว"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">มี Rep / Invoice แล้ว</span>
            <div className={`hw-kpi-dot ${cardFilter === 'WITH_REP' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span className="hw-kpi-value" style={{ color: '#0d7446' }}>
              {summary.withRepCases.toLocaleString()}
            </span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">มีเอกสารตอบรับจากระบบ e-Claim/REP</div>
        </div>

        {/* Card 7: รอ Rep / Invoice */}
        <div
          className={`hw-kpi-card ${cardFilter === 'NO_REP' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('NO_REP')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่มี Rep หรือ Invoice"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">รอ Rep / Invoice</span>
            <div className={`hw-kpi-dot ${cardFilter === 'NO_REP' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span className="hw-kpi-value">{summary.noRepCases.toLocaleString()}</span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">อยู่ระหว่างดำเนินการเคลมหรือรอใบตอบรับ</div>
        </div>

        {/* Card 8: มียอดหนี้ค้างชำระ */}
        <div
          className={`hw-kpi-card ${cardFilter === 'WITH_DEBIT' ? 'is-active' : ''}`}
          onClick={() => handleCardFilterClick('WITH_DEBIT')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มียอดหนี้ค้างชำระ (Debit > 0)"
        >
          <div className="hw-kpi-card-header">
            <span className="hw-kpi-title">มียอดหนี้ค้างชำระ</span>
            <div className={`hw-kpi-dot ${cardFilter === 'WITH_DEBIT' ? 'is-active' : ''}`} />
          </div>
          <div className="hw-kpi-value-row">
            <span
              className="hw-kpi-value"
              style={{ color: summary.withDebitCases > 0 ? '#b45309' : undefined }}
            >
              {summary.withDebitCases.toLocaleString()}
            </span>
            <span className="hw-kpi-unit">ราย</span>
          </div>
          <div className="hw-kpi-sub">
            หนี้รวม: {formatMoney(summary.totalDebit)} บาท
          </div>
        </div>
      </div>

      {/* ── 5. Toolbar & Unified Search ── */}
      <div className="hw-toolbar">
        <div className="hw-search-box">
          <Search size={16} className="hw-search-icon" />
          <input
            type="text"
            className="hw-search-input"
            placeholder="ค้นหา HN, AN, CID, ชื่อผู้ป่วย, PDX, สิทธิ์, แพทย์, Rep..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="hw-search-clear"
              onClick={() => setSearch('')}
              title="ล้างข้อความค้นหา"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ minWidth: '220px' }}>
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />
        </div>

        <div className="hw-toolbar-info">
          <span>
            แสดง <span className="hw-count-badge">{items.length}</span> จากทั้งหมด{' '}
            <span className="hw-count-badge">{totalCount}</span> รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <button
              type="button"
              className="hw-btn hw-btn-secondary"
              style={{ padding: '4px 10px', minHeight: 32, fontSize: 12 }}
              onClick={() => setCardFilter('ALL')}
            >
              ล้างตัวกรองการ์ด (แสดงทั้งหมด)
            </button>
          )}
        </div>
      </div>

      {/* ── 6. Error Alert ── */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            className="hw-btn hw-btn-secondary"
            style={{ padding: '4px 10px', minHeight: 30, fontSize: 12 }}
            onClick={() => fetchData()}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* ── 7. Table Section ── */}
      <div className="hw-table-card">
        <div className="hw-table-container">
          {!error && (
            <table className="hw-table">
              <thead>
                <tr>
                  <th className="col-center" style={{ width: 55 }}>
                    ลำดับ
                  </th>
                  <th className="col-center" style={{ width: 110 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('dchdate')}>
                      วันจำหน่าย {renderSortIndicator('dchdate')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 110 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('admdate')}>
                      วันรับ (Admit) {renderSortIndicator('admdate')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 95 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('an')}>
                      AN {renderSortIndicator('an')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 85 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('hn')}>
                      HN {renderSortIndicator('hn')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 140 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('cid')}>
                      เลขบัตรประชาชน {renderSortIndicator('cid')}
                    </span>
                  </th>
                  <th className="col-center" style={{ minWidth: 170 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('ptname')}>
                      ชื่อ-สกุล ผู้ป่วย {renderSortIndicator('ptname')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 75 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('age')}>
                      อายุ {renderSortIndicator('age')}
                    </span>
                  </th>
                  <th className="col-center" style={{ minWidth: 140 }}>
                    สิทธิการรักษา
                  </th>
                  <th className="col-center" style={{ width: 110 }}>
                    หอผู้ป่วย
                  </th>
                  <th className="col-center" style={{ width: 90 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('pdx')}>
                      PDX {renderSortIndicator('pdx')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 100 }}>
                    ClaimCode
                  </th>
                  <th className="col-center" style={{ width: 120 }}>
                    สถานะ AMed
                  </th>
                  <th className="col-center" style={{ width: 110 }}>
                    Rep / Inv
                  </th>
                  <th className="col-center" style={{ width: 120 }}>
                    <span className="hw-th-sort" onClick={() => handleSort('debit')}>
                      หนี้ค้างชำระ {renderSortIndicator('debit')}
                    </span>
                  </th>
                  <th className="col-center" style={{ width: 105 }}>
                    สรุปชาร์จ
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
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="hw-empty-state">
                      <Home size={36} className="hw-empty-icon" />
                      <p className="hw-empty-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
                      <p className="hw-empty-desc">
                        ลองปรับเปลี่ยนช่วงวันที่ ค้นหาคำอื่น หรือคลิกการ์ด &quot;ผู้ป่วยทั้งหมด&quot;
                      </p>
                    </td>
                  </tr>
                ) : items.map((item) => {
                  const nameParts = splitPatientName(item.ptname)
                  return (
                    <tr
                      key={item.an}
                      onClick={() => {
                        setSelectedItem(item)
                        setModalTab('general')
                      }}
                      title="คลิกที่แถวเพื่อดูรายละเอียดเชิงลึก"
                    >
                      <td className="col-center font-tabular text-muted">{item.no}</td>
                      <td className="col-center font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        {formatThaiDate(item.dchdate)}
                      </td>
                      <td className="col-center font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        {formatThaiDate(item.admdate)}
                      </td>
                      <td className="col-center font-tabular" style={{ fontWeight: 600 }}>
                        {item.an}
                      </td>
                      <td className="col-center font-tabular">{item.hn}</td>
                      <td className="col-center font-tabular">{item.cid || '—'}</td>
                      <td className="col-center">
                        <div className="patient-name-container">
                          <span className="patient-first">{nameParts.first}</span>{' '}
                          <span className="patient-last">{nameParts.last}</span>
                        </div>
                      </td>
                      <td className="col-center font-tabular" style={{ whiteSpace: 'nowrap' }}>
                        {item.age}&nbsp;ปี
                      </td>
                      <td className="col-center" title={item.pttypename}>
                        <div
                          style={{
                            maxWidth: 150,
                            margin: '0 auto',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.pttypename}
                        </div>
                      </td>
                      <td className="col-center">
                        <span className="hw-badge hw-badge-neutral">{item.ward || '—'}</span>
                      </td>
                      <td className="col-center font-tabular" title={item.pdxname}>
                        <span style={{ fontWeight: 600 }}>{item.pdx || '—'}</span>
                      </td>
                      <td className="col-center font-tabular">
                        {item.hasAuthen ? (
                          <span className="hw-badge hw-badge-success">{item.authencode}</span>
                        ) : (
                          <span className="hw-badge hw-badge-danger">ไม่มี</span>
                        )}
                      </td>
                      <td className="col-center">
                        {item.isOnAmed ? (
                          <span className="hw-badge hw-badge-success">บน AMed</span>
                        ) : (
                          <span className="hw-badge hw-badge-warning">ยังไม่มี</span>
                        )}
                      </td>
                      <td className="col-center">
                        {item.rep ? (
                          <span className="hw-badge hw-badge-info" title={item.rep_remark || ''}>
                            {item.rep}
                          </span>
                        ) : item.invoice ? (
                          <span className="hw-badge hw-badge-info">Inv:{item.invoice}</span>
                        ) : (
                          <span className="hw-badge hw-badge-neutral">รอ Rep</span>
                        )}
                      </td>
                      <td className="col-center font-tabular">
                        <span
                          style={{
                            fontWeight: 600,
                            color: item.debit > 0 ? '#b45309' : '#0d7446',
                          }}
                        >
                          {formatMoney(item.debit)}
                        </span>
                      </td>
                      <td className="col-center">
                        <span
                          className={`hw-badge ${
                            item.summary_status && item.summary_status.includes('สรุป')
                              ? 'hw-badge-success'
                              : 'hw-badge-neutral'
                          }`}
                        >
                          {item.summary_status || 'รอสรุป'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 8. Pagination ── */}
        {totalPages > 1 && (
          <div className="hw-pagination">
            <div className="hw-page-info">
              หน้า <span style={{ fontWeight: 600 }}>{currentPage}</span> จาก{' '}
              <span style={{ fontWeight: 600 }}>{totalPages}</span> (แสดงหน้าละ {pageSize} รายการ)
            </div>

            <div className="hw-page-buttons">
              <button
                type="button"
                className="hw-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> ก่อนหน้า
              </button>

              <span className="hw-control-label" style={{ margin: '0 8px' }}>
                หน้า {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="hw-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
              >
                ถัดไป <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Patient Clinical Detail Modal ── */}
      {selectedItem && (
        <div
          className="hw-modal-overlay"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="hw-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="hw-modal-header">
              <div>
                <h3 className="hw-modal-title">
                  {selectedItem.ptname} ({selectedItem.age} ปี)
                </h3>
                <div className="hw-modal-subtitle">
                  <span>
                    AN: <strong className="font-tabular">{selectedItem.an}</strong>
                    <button
                      type="button"
                      className="hw-copy-btn"
                      style={{ marginLeft: 6 }}
                      onClick={() => handleCopy(selectedItem.an, 'an')}
                    >
                      {copiedKey === 'an' ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedKey === 'an' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                  </span>

                  <span>•</span>

                  <span>
                    HN: <strong className="font-tabular">{selectedItem.hn}</strong>
                    <button
                      type="button"
                      className="hw-copy-btn"
                      style={{ marginLeft: 6 }}
                      onClick={() => handleCopy(selectedItem.hn, 'hn')}
                    >
                      {copiedKey === 'hn' ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedKey === 'hn' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                  </span>

                  <span>•</span>

                  <span>
                    CID: <strong className="font-tabular">{selectedItem.cid}</strong>
                    <button
                      type="button"
                      className="hw-copy-btn"
                      style={{ marginLeft: 6 }}
                      onClick={() => handleCopy(selectedItem.cid, 'cid')}
                    >
                      {copiedKey === 'cid' ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedKey === 'cid' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="hw-modal-close"
                onClick={() => setSelectedItem(null)}
                title="ปิดหน้าต่าง (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="hw-modal-tabs">
              <button
                type="button"
                className={`hw-modal-tab ${modalTab === 'general' ? 'is-active' : ''}`}
                onClick={() => setModalTab('general')}
              >
                <Activity size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                ข้อมูลทั่วไปและการรักษา
              </button>
              <button
                type="button"
                className={`hw-modal-tab ${modalTab === 'financial' ? 'is-active' : ''}`}
                onClick={() => setModalTab('financial')}
              >
                <CreditCard size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                สิทธิการรักษา & การเงิน
              </button>
              <button
                type="button"
                className={`hw-modal-tab ${modalTab === 'amed' ? 'is-active' : ''}`}
                onClick={() => setModalTab('amed')}
              >
                <Home size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                สถานะ AMed & ใบเสร็จ/REP
              </button>
            </div>

            {/* Modal Body */}
            <div className="hw-modal-body">
              {modalTab === 'general' && (
                <div>
                  <div className="hw-detail-grid">
                    <div className="hw-detail-card">
                      <div className="hw-detail-card-title">
                        <Calendar size={14} /> ข้อมูลการรับรักษาและหอผู้ป่วย
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">วันที่รับ (Admit):</span>
                        <span className="hw-detail-value">{formatThaiDate(selectedItem.admdate)}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">วันที่จำหน่าย (Discharge):</span>
                        <span className="hw-detail-value">{formatThaiDate(selectedItem.dchdate)}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">จำนวนวันนอน (LOS):</span>
                        <span className="hw-detail-value">{selectedItem.los} วัน</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">หอผู้ป่วย / เตียง:</span>
                        <span className="hw-detail-value">
                          {selectedItem.ward || '—'} {selectedItem.bedno ? `(เตียง ${selectedItem.bedno})` : ''}
                        </span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">แผนก / คลินิก:</span>
                        <span className="hw-detail-value">{selectedItem.clinic || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">แพทย์ผู้รับ:</span>
                        <span className="hw-detail-value">{selectedItem.admdoctor || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">แพทย์จำหน่าย:</span>
                        <span className="hw-detail-value">{selectedItem.dchdoctor || '—'}</span>
                      </div>
                    </div>

                    <div className="hw-detail-card">
                      <div className="hw-detail-card-title">
                        <FileText size={14} /> การวินิจฉัยและสถานะจำหน่าย
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">สถานะการจำหน่าย:</span>
                        <span className="hw-detail-value">{selectedItem.dchstts || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ประเภทการจำหน่าย:</span>
                        <span className="hw-detail-value">{selectedItem.dchtype || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">สถานะสรุปชาร์จ:</span>
                        <span className="hw-detail-value">{selectedItem.summary_status || 'รอสรุป'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">วันที่สรุปเวชระเบียน:</span>
                        <span className="hw-detail-value">{selectedItem.editdate || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ระยะเวลาสรุปผล:</span>
                        <span className="hw-detail-value">{selectedItem.day_diff} วัน</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ผู้บันทึกสรุป:</span>
                        <span className="hw-detail-value">{selectedItem.staff || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">AdjRW:</span>
                        <span className="hw-detail-value" style={{ fontWeight: 700, color: '#0d7446' }}>
                          {selectedItem.adjrw.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hw-detail-card">
                    <div className="hw-detail-card-title">
                      <Activity size={14} /> รายละเอียดการวินิจฉัยโรคและหัตถการ
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">การวินิจฉัยเบื้องต้น (Prediag):</span>
                      <span className="hw-detail-value">{selectedItem.prediag || '—'}</span>
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">การวินิจฉัยหลัก (PDX):</span>
                      <span className="hw-detail-value" style={{ fontWeight: 600 }}>
                        {selectedItem.pdx} - {selectedItem.pdxname}
                      </span>
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">การวินิจฉัยร่วม/โรครอง (SDX):</span>
                      <span className="hw-detail-value">{selectedItem.sdx || '—'}</span>
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">หัตถการ (ICD-9 Operation):</span>
                      <span className="hw-detail-value">{selectedItem.proc_code || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'financial' && (
                <div>
                  <div className="hw-detail-grid">
                    <div className="hw-detail-card">
                      <div className="hw-detail-card-title">
                        <CreditCard size={14} /> ข้อมูลสิทธิและการส่งเบิก
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">สิทธิการรักษา รพ.:</span>
                        <span className="hw-detail-value">
                          ({selectedItem.pttype}) {selectedItem.pttypename}
                        </span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">สิทธิ e-Claim:</span>
                        <span className="hw-detail-value">
                          ({selectedItem.pttype_eclaim_id}) {selectedItem.pttype_eclaim_name || '—'}
                        </span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ClaimCode:</span>
                        <span className="hw-detail-value" style={{ fontWeight: 600 }}>
                          {selectedItem.authencode || 'ไม่มี'}
                        </span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">GFMIS Code:</span>
                        <span className="hw-detail-value">{selectedItem.gfmis || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">Account Code:</span>
                        <span className="hw-detail-value">{selectedItem.accountcode || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">เลขที่บัตรสิทธิ:</span>
                        <span className="hw-detail-value">{selectedItem.pttypeno || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">รพ.หลัก / รพ.รอง:</span>
                        <span className="hw-detail-value">
                          {selectedItem.hospmain} / {selectedItem.hospsub}
                        </span>
                      </div>
                    </div>

                    <div className="hw-detail-card">
                      <div className="hw-detail-card-title">
                        <Receipt size={14} /> สรุปยอดเงินและหนี้ค้างชำระ
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ค่ารักษาทั้งหมด (Income):</span>
                        <span className="hw-detail-value">{formatMoney(selectedItem.income)} บาท</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">สิทธิ UC (UC Money):</span>
                        <span className="hw-detail-value">{formatMoney(selectedItem.uc_money)} บาท</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ส่วนลด (Discount):</span>
                        <span className="hw-detail-value">{formatMoney(selectedItem.discount_money)} บาท</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ชำระเอง (Paid):</span>
                        <span className="hw-detail-value">{formatMoney(selectedItem.paid_money)} บาท</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ยอดใบเสร็จ (Rcpt):</span>
                        <span className="hw-detail-value">{formatMoney(selectedItem.rcpt_money)} บาท</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">ยอดหนี้ค้างชำระ (Debit):</span>
                        <span
                          className="hw-detail-value"
                          style={{
                            fontWeight: 700,
                            color: selectedItem.debit > 0 ? '#b45309' : '#0d7446',
                          }}
                        >
                          {formatMoney(selectedItem.debit)} บาท
                        </span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">เพดานหนี้สูงสุด (Max Debt):</span>
                        <span className="hw-detail-value">
                          {selectedItem.max_debt_amount != null
                            ? `${formatMoney(selectedItem.max_debt_amount)} บาท`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hw-detail-card">
                    <div className="hw-detail-card-title">
                      <Phone size={14} /> ข้อมูลการติดต่อและที่อยู่ผู้ป่วย
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">ที่อยู่:</span>
                      <span className="hw-detail-value">{selectedItem.address || '—'}</span>
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">เบอร์โทรศัพท์:</span>
                      <span className="hw-detail-value">{selectedItem.tel || '—'}</span>
                    </div>
                    <div className="hw-detail-row">
                      <span className="hw-detail-label">เบอร์มือถือ:</span>
                      <span className="hw-detail-value">{selectedItem.mobile || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'amed' && (
                <div>
                  <div className="hw-detail-grid">
                    <div className="hw-detail-card">
                      <div className="hw-detail-card-title">
                        <Home size={14} /> สถานะบนระบบ AMed Web
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">สถานะการลงทะเบียน:</span>
                        <span className="hw-detail-value">
                          {selectedItem.isOnAmed ? (
                            <span className="hw-badge hw-badge-success">พบข้อมูลบนระบบ AMed</span>
                          ) : (
                            <span className="hw-badge hw-badge-warning">ยังไม่พบข้อมูลใน AMed</span>
                          )}
                        </span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">CID บน AMed Web:</span>
                        <span className="hw-detail-value">{selectedItem.onweb_cid || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">AN บน AMed Web:</span>
                        <span className="hw-detail-value">{selectedItem.anonweb || '—'}</span>
                      </div>
                    </div>

                    <div className="hw-detail-card">
                      <div className="hw-detail-card-title">
                        <Receipt size={14} /> ข้อมูลใบตอบรับ REP / e-Claim
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">เลขที่ REP:</span>
                        <span className="hw-detail-value">{selectedItem.rep || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">หมายเหตุ REP:</span>
                        <span className="hw-detail-value">{selectedItem.rep_remark || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">เลขที่ Invoice:</span>
                        <span className="hw-detail-value">{selectedItem.invoice || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">เลขที่บิลติดตาม (Bill):</span>
                        <span className="hw-detail-value">{selectedItem.bill || '—'}</span>
                      </div>
                      <div className="hw-detail-row">
                        <span className="hw-detail-label">วันที่บิล (Bill Date):</span>
                        <span className="hw-detail-value">{selectedItem.billdate || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="hw-modal-footer">
              <button
                type="button"
                className="hw-btn hw-btn-secondary"
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
