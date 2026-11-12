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
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react'
import type {
  CcsScreenedRecipientItem,
  CcsScreenedRecipientsSummary,
  CcsMethodFilter,
  CcsOkFilter,
  CcsResultStatusFilter,
  CcsCompensationFilter,
  CcsScreenedSortField,
} from '@/lib/clinical/rcmCervicalCancerService'
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
  if (!val || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCidDisplay(cid?: string | null): string {
  if (!cid) return '—'
  const digits = cid.replace(/\D/g, '')
  if (digits.length !== 13) return cid
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
}

function renderResultBadge(result?: string | null) {
  if (!result) return <span className="ccs2-badge ccs2-badge-ghost">—</span>
  if (result.includes('ผิดปกติ')) {
    return <span className="ccs2-badge ccs2-badge-danger">{result}</span>
  }
  return <span className="ccs2-badge ccs2-badge-success">{result}</span>
}

export interface CcsScreenedRecipientsClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function CcsScreenedRecipientsClient({
  initialData,
  initialRange,
}: CcsScreenedRecipientsClientProps = {}) {
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

  // Date selection states: 1. วัน เดือน ปี (custom) -> 2. รายเดือน (monthly) -> 3. ปีงบประมาณ (fiscal)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${curCalYear}-${String(curMonth).padStart(2, '0')}-01`)
  const [ds2, setDs2] = useState<string>(
    initialRange?.endDate || `${curCalYear}-${String(curMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )

  // Filter & Search states (FoxPro cshow combobox + criteria)
  const [methodFilter, setMethodFilter] = useState<CcsMethodFilter>('ALL')
  const [okFilter, setOkFilter] = useState<CcsOkFilter>('ALL')
  const [resultStatusFilter, setResultStatusFilter] = useState<CcsResultStatusFilter>('ALL')
  const [compensationFilter, setCompensationFilter] = useState<CcsCompensationFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<CcsScreenedSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CcsScreenedRecipientItem[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [summary, setSummary] = useState<CcsScreenedRecipientsSummary>(
    initialData?.summary || {
      totalVisits: 0,
      uniquePatients: 0,
      okCount: 0,
      notOkCount: 0,
      papCount: 0,
      viaCount: 0,
      hpvCount: 0,
      colposcopyCount: 0,
      abnormalCount: 0,
      totalSeamlessCompensated: 0,
      totalNhsoCompensated: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Modal inspection states
  const [selectedItem, setSelectedItem] = useState<CcsScreenedRecipientItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [vnLoading, setVnLoading] = useState<boolean>(false)
  const [vnError, setVnError] = useState<string | null>(null)

  // Export states
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  // Handle Debounced Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(handler)
  }, [search])

  // Sync Date Mode changes to ds1 & ds2
  useEffect(() => {
    if (dateMode === 'fiscal') {
      const ceYear = selectedFiscalYear - 543
      setDs1(`${ceYear - 1}-10-01`)
      setDs2(`${ceYear}-09-30`)
      setCurrentPage(1)
    } else if (dateMode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mm}-01`)
      setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
      setCurrentPage(1)
    }
  }, [dateMode, selectedFiscalYear, selectedMonth, selectedBeYear])

  // Fetch Report Data
  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      if (isManualRefresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)
      setExportNotice(null)

      try {
        const q = new URLSearchParams({
          ds1,
          ds2,
          methodFilter,
          okFilter,
          resultStatusFilter,
          compensationFilter,
          searchField: 'ALL',
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (pttypes.length > 0) {
          q.set('pttypes', pttypes.join(','))
        }

        const res = await fetch(`/api/service/dashboard-rcm/funds/ccs/screened-recipients?${q.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้รับบริการคัดกรอง')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) {
          setSummary(data.summary)
        }
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message || 'ไม่สามารถโหลดข้อมูลได้')
        }
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
      methodFilter,
      okFilter,
      resultStatusFilter,
      compensationFilter,
      pttypes,
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData, initialData])

  // Quick Filter via KPI Cards
  const handleCardClick = (filterType: 'ALL' | 'OK' | 'NOT_OK' | 'ABNORMAL' | 'COMPENSATED') => {
    if (filterType === 'ALL') {
      setOkFilter('ALL')
      setResultStatusFilter('ALL')
      setCompensationFilter('ALL')
    } else if (filterType === 'OK') {
      setOkFilter(okFilter === 'OK' ? 'ALL' : 'OK')
    } else if (filterType === 'NOT_OK') {
      setOkFilter(okFilter === 'NOT_OK' ? 'ALL' : 'NOT_OK')
    } else if (filterType === 'ABNORMAL') {
      setResultStatusFilter(resultStatusFilter === 'ABNORMAL' ? 'ALL' : 'ABNORMAL')
    } else if (filterType === 'COMPENSATED') {
      setCompensationFilter(compensationFilter === 'COMPENSATED' ? 'ALL' : 'COMPENSATED')
    }
    setCurrentPage(1)
  }

  // Sorting Handler
  const handleSort = (field: CcsScreenedSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'vstdate' ? 'desc' : 'asc')
    }
    setCurrentPage(1)
  }

  // Open VN Details in Modal
  const handleOpenModal = async (item: CcsScreenedRecipientItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setVnDetails(null)
    setVnError(null)

    if (item.vn) {
      setVnLoading(true)
      try {
        const res = await fetch(`/api/service/dashboard-rcm/funds/ccs/vn-details?vn=${encodeURIComponent(item.vn)}`)
        const json = await res.json()
        if (res.ok && json.success) {
          setVnDetails(json.data)
        } else {
          setVnError(json.error?.message || 'ไม่สามารถโหลดเวชระเบียนคลินิกได้')
        }
      } catch (err: unknown) {
        const e = err as Error
        setVnError(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูลเวชระเบียน')
      } finally {
        setVnLoading(false)
      }
    }
  }

  // Export to CSV with UTF-8 BOM
  const handleExportCsv = async () => {
    setIsExporting(true)
    setError(null)
    setExportNotice(null)

    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        methodFilter,
        okFilter,
        resultStatusFilter,
        compensationFilter,
        searchField: 'ALL',
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (pttypes.length > 0) {
        q.set('pttypes', pttypes.join(','))
      }

      const res = await fetch(`/api/service/dashboard-rcm/funds/ccs/screened-recipients?${q.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถดาวน์โหลดข้อมูลสำหรับส่งออกได้')
      }

      const allItems: CcsScreenedRecipientItem[] = json.data?.items || []
      if (allItems.length === 0) {
        setExportNotice('ไม่พบข้อมูลที่จะส่งออกตามเงื่อนไขที่เลือก')
        return
      }

      const headers = [
        'ลำดับ',
        'VN',
        'AN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลารับบริการ',
        'ClaimCode',
        'สิทธิผู้ป่วย',
        'สิทธิการรับบริการ',
        'แผนก',
        'คลินิก',
        'ICD-10 PDX',
        'ICD-10 ร่วม',
        'เกณฑ์บันทึก (OK)',
        'PapSmear รหัส',
        'PapSmear ผลตรวจ',
        'VIA รหัส',
        'VIA ผลตรวจ',
        'HPV รหัส',
        'HPV ผลตรวจ',
        'วิธีการอื่นๆ รหัส',
        'วิธีการอื่นๆ ผลตรวจ',
        'ColpoScopy',
        'รหัส ADP ที่คิดค่าบริการ',
        'Seamless Type',
        'Seamless Rep',
        'Seamless ยอดชดเชย',
        'Seamless หมายเหตุ',
        'Seamless วันที่จ่าย',
        'สปสช. สถานะ',
        'สปสช. เลขที่ Rep',
        'สปสช. ประมาณการชดเชย',
      ]

      const rows = allItems.map((r) => [
        r.no,
        r.vn,
        r.an ?? '',
        r.hn,
        r.cid,
        r.ptname,
        r.age ?? '',
        r.nation ?? '',
        r.vstdate ? formatThaiDate(r.vstdate) : '',
        r.vsttime ?? '',
        r.authencode ?? '',
        r.pttypename_patient ?? '',
        r.pttypename_visit ?? '',
        r.department ?? '',
        r.clinic ?? '',
        r.pdx ?? '',
        [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5].filter(Boolean).join(','),
        r.ok ?? '',
        r.papsmear ?? '',
        r.papsmear_result ?? '',
        r.via ?? '',
        r.via_result ?? '',
        r.hpv ?? '',
        r.hpv_result ?? '',
        r.other ?? '',
        r.other_result ?? '',
        r.colposcopy ?? '',
        r.listname ?? '',
        r.type ?? '',
        r.rep ?? '',
        r.compensated,
        r.note ?? '',
        r.paydate ? formatThaiDate(r.paydate) : '',
        r.status ?? '',
        r.rep_nhso ?? '',
        r.nhso,
      ])

      await exportRcmExcel({
        filename: `CCS_1_2_Screened_Recipients_${ds1}_to_${ds2}.xlsx`,
        title: 'รายชื่อผู้ได้รับการคัดกรองมะเร็งปากมดลูก (1.2)',
        subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
      setExportNotice(`ส่งออกไฟล์ Excel จำนวน ${allItems.length.toLocaleString('th-TH')} รายการสำเร็จ`)
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'ส่งออกไฟล์ Excel ไม่สำเร็จ')
    } finally {
      setIsExporting(false)
    }
  }

  const resetFilters = () => {
    setMethodFilter('ALL')
    setOkFilter('ALL')
    setResultStatusFilter('ALL')
    setCompensationFilter('ALL')
    setPttypes([])
    setSearch('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    methodFilter !== 'ALL' ||
    okFilter !== 'ALL' ||
    resultStatusFilter !== 'ALL' ||
    compensationFilter !== 'ALL' ||
    pttypes.length > 0 ||
    debouncedSearch.length > 0

  return (
    <div className="ccs2-page">
      {/* ── 1. Header Bar ── */}
      <header className="ccs2-header">
        <div className="ccs2-title-group">
          <nav className="ccs2-breadcrumb" aria-label="แถบนำทาง">
            <a href="/service/dashboard-rcm" className="ccs2-breadcrumb-link">Dashboard RCM</a>
            <span className="ccs2-breadcrumb-sep" aria-hidden="true">/</span>
            <a href="/service/dashboard-rcm/funds/ccs" className="ccs2-breadcrumb-link">กองทุนมะเร็งปากมดลูก (CCS)</a>
            <span className="ccs2-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="ccs2-breadcrumb-current">1.2 รายชื่อผู้รับบริการคัดกรอง</span>
          </nav>
          <h1 className="ccs2-title">
            1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก
          </h1>
          <p className="ccs2-subtitle">
            รายงานผู้รับบริการตรวจคัดกรองมะเร็งปากมดลูก (CCS) ตรวจสอบการบันทึกรหัสบริการ (PP Special), ผลการตรวจ, และสถานะการชดเชยค่าบริการ Seamless / สปสช.
          </p>
        </div>

        <div className="ccs2-header-actions">
          <button
            type="button"
            className="ccs2-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            aria-busy={isRefreshing}
            title="รีเฟรชข้อมูลจากระบบ"
          >
            <RefreshCw size={16} className={isRefreshing ? 'ccs2-spin-icon' : undefined} />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>
          <button
            type="button"
            className="ccs2-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || isExporting || totalCount === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. Single-Row Date Selection Ribbon: กำหนดเอง -> รายเดือน -> ปีงบประมาณ ── */}
      <section className="ccs2-date-card">
        <div className="ccs2-date-row">
          <div className="ccs2-mode-tabs" role="tablist" aria-label="โหมดการเลือกช่วงเวลา">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`ccs2-mode-tab ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => setDateMode('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`ccs2-mode-tab ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => setDateMode('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`ccs2-mode-tab ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => setDateMode('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="ccs2-date-divider" aria-hidden="true" />

          {dateMode === 'custom' && (
            <div className="ccs2-date-inputs">
              <span className="ccs2-filter-label">ตั้งแต่วันที่:</span>
              <ThaiDatePicker value={ds1} onChange={(val) => setDs1(val)} />
              <span className="ccs2-filter-label">ถึง:</span>
              <ThaiDatePicker value={ds2} onChange={(val) => setDs2(val)} />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div className="ccs2-date-inputs">
              <span className="ccs2-filter-label">เดือน:</span>
              <select
                aria-label="เลือกเดือน"
                className="ccs2-date-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="ccs2-filter-label">ปี พ.ศ.:</span>
              <select
                aria-label="เลือกปี พ.ศ."
                className="ccs2-date-select"
                value={selectedBeYear}
                onChange={(e) => setSelectedBeYear(Number(e.target.value))}
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
            <div className="ccs2-date-inputs">
              <span className="ccs2-filter-label">ปีงบประมาณ:</span>
              <select
                aria-label="เลือกปีงบประมาณ"
                className="ccs2-date-select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
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
      </section>

      {/* Notice / Error banner */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--ccs-err-bg)', border: '1px solid var(--ccs-err-border)', borderRadius: '8px', color: 'var(--ccs-err)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      {exportNotice && (
        <div style={{ padding: '12px 16px', background: 'var(--ccs-ok-bg)', border: '1px solid var(--ccs-ok-border)', borderRadius: '8px', color: 'var(--ccs-ok)', fontSize: '0.875rem' }}>
          {exportNotice}
        </div>
      )}

      {/* ── 3. KPI Summary Cards (Interactive Filters) ── */}
      <section className="ccs2-kpi-grid">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={okFilter === 'ALL' && resultStatusFilter === 'ALL' && compensationFilter === 'ALL'}
          className={`ccs2-kpi-card ${
            okFilter === 'ALL' && resultStatusFilter === 'ALL' && compensationFilter === 'ALL' ? 'is-active-filter' : ''
          }`}
          onClick={() => handleCardClick('ALL')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('ALL')}
          title="คลิกเพื่อแสดงผู้รับบริการทั้งหมด"
        >
          <span className="ccs2-kpi-label">
            ผู้รับบริการทั้งหมด
            {okFilter === 'ALL' && resultStatusFilter === 'ALL' && compensationFilter === 'ALL' && (
              <span className="ccs2-kpi-filter-tag">กำลังแสดง</span>
            )}
          </span>
          <span className="ccs2-kpi-value">{summary.totalVisits.toLocaleString('th-TH')}</span>
          <span className="ccs2-kpi-sub">
            จำนวน {summary.uniquePatients.toLocaleString('th-TH')} คน (HN ไม่ซ้ำ)
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={okFilter === 'OK'}
          className={`ccs2-kpi-card ${okFilter === 'OK' ? 'is-active-filter-success' : ''}`}
          onClick={() => handleCardClick('OK')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('OK')}
          title="คลิกเพื่อกรองเฉพาะรายการที่ผ่านเกณฑ์บันทึก (OK)"
        >
          <span className="ccs2-kpi-label">
            ผ่านเกณฑ์บันทึก (OK)
            {okFilter === 'OK' && <span className="ccs2-kpi-filter-tag">กำลังกรอง</span>}
          </span>
          <span className="ccs2-kpi-value ccs2-kpi-val-ok">
            {summary.okCount.toLocaleString('th-TH')}
          </span>
          <span className="ccs2-kpi-sub">
            {summary.totalVisits > 0
              ? `${((summary.okCount / summary.totalVisits) * 100).toFixed(1)}% ของผู้รับบริการ`
              : '—'}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={okFilter === 'NOT_OK'}
          className={`ccs2-kpi-card ${okFilter === 'NOT_OK' ? 'is-active-filter-warn' : ''}`}
          onClick={() => handleCardClick('NOT_OK')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('NOT_OK')}
          title="คลิกเพื่อกรองรายการที่ขาดรหัสคัดกรอง (Not OK)"
        >
          <span className="ccs2-kpi-label">
            ขาดรหัสคัดกรอง (Not OK)
            {okFilter === 'NOT_OK' && <span className="ccs2-kpi-filter-tag">กำลังกรอง</span>}
          </span>
          <span className="ccs2-kpi-value ccs2-kpi-val-err">
            {summary.notOkCount.toLocaleString('th-TH')}
          </span>
          <span className="ccs2-kpi-sub">ต้องตรวจสอบการบันทึกบริการ</span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={resultStatusFilter === 'ABNORMAL'}
          className={`ccs2-kpi-card ${resultStatusFilter === 'ABNORMAL' ? 'is-active-filter-warn' : ''}`}
          onClick={() => handleCardClick('ABNORMAL')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('ABNORMAL')}
          title="คลิกเพื่อกรองรายการที่พบผลตรวจผิดปกติ"
        >
          <span className="ccs2-kpi-label">
            พบผลตรวจผิดปกติ
            {resultStatusFilter === 'ABNORMAL' && <span className="ccs2-kpi-filter-tag">กำลังกรอง</span>}
          </span>
          <span
            className={`ccs2-kpi-value ${summary.abnormalCount > 0 ? 'ccs2-kpi-val-err' : ''}`}
          >
            {summary.abnormalCount.toLocaleString('th-TH')}
          </span>
          <span className="ccs2-kpi-sub">
            Pap, VIA, HPV หรือวิธีอื่นผิดปกติ
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'COMPENSATED'}
          className={`ccs2-kpi-card ${compensationFilter === 'COMPENSATED' ? 'is-active-filter' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มีข้อมูลชดเชยค่าบริการ"
        >
          <span className="ccs2-kpi-label">
            ชดเชย Seamless
            {compensationFilter === 'COMPENSATED' && <span className="ccs2-kpi-filter-tag">กำลังกรอง</span>}
          </span>
          <span className="ccs2-kpi-value">
            {summary.totalSeamlessCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="ccs2-kpi-sub">บาท (CCS Seamless)</span>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={compensationFilter === 'COMPENSATED'}
          className={`ccs2-kpi-card ${compensationFilter === 'COMPENSATED' ? 'is-active-filter' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('COMPENSATED')}
          title="คลิกเพื่อกรองเฉพาะรายการที่มีข้อมูลชดเชยค่าบริการ"
        >
          <span className="ccs2-kpi-label">
            ประมาณการชดเชย สปสช.
            {compensationFilter === 'COMPENSATED' && <span className="ccs2-kpi-filter-tag">กำลังกรอง</span>}
          </span>
          <span className="ccs2-kpi-value">
            {summary.totalNhsoCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="ccs2-kpi-sub">บาท (Rep / E-Claim)</span>
        </div>
      </section>

      {/* ── 4. Filter Toolbar (FoxPro cshow combobox) ── */}
      <section className="ccs2-filter-card">
        <div className="ccs2-filter-group">
          <span className="ccs2-filter-label">แสดงข้อมูล (วิธีตรวจ):</span>
          <select
            aria-label="แสดงข้อมูลวิธีตรวจ"
            className="ccs2-date-select"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value as CcsMethodFilter)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="PapSmear">PapSmear</option>
            <option value="VIA">VIA</option>
            <option value="HPV">HPV</option>
            <option value="ColpoScopy">ColpoScopy</option>
          </select>

          <span className="ccs2-filter-label">เกณฑ์ (OK):</span>
          <select
            aria-label="ตัวกรองเกณฑ์ OK"
            className="ccs2-date-select"
            value={okFilter}
            onChange={(e) => {
              setOkFilter(e.target.value as CcsOkFilter)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="OK">ผ่านเกณฑ์ (OK)</option>
            <option value="NOT_OK">ไม่ผ่านเกณฑ์ (เตือนสีแดง)</option>
          </select>

          <span className="ccs2-filter-label">ผลตรวจ:</span>
          <select
            aria-label="ตัวกรองผลตรวจ"
            className="ccs2-date-select"
            value={resultStatusFilter}
            onChange={(e) => {
              setResultStatusFilter(e.target.value as CcsResultStatusFilter)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="NORMAL">ปกติ</option>
            <option value="ABNORMAL">ผิดปกติ</option>
          </select>

          <span className="ccs2-filter-label">สถานะชดเชย:</span>
          <select
            aria-label="ตัวกรองสถานะชดเชย"
            className="ccs2-date-select"
            value={compensationFilter}
            onChange={(e) => {
              setCompensationFilter(e.target.value as CcsCompensationFilter)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="COMPENSATED">มีข้อมูลชดเชย</option>
            <option value="UNCOMPENSATED">ยังไม่ชดเชย</option>
          </select>

          <span className="ccs2-filter-label">สิทธิการรักษา:</span>
          <PttypeMultiSelect
            selectedCodes={pttypes}
            onChange={(codes) => {
              setPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />
        </div>

        {/* Global Search across all fields without dropdown selector */}
        <div className="ccs2-search-box">
          <div className="ccs2-search-input-wrap">
            <Search size={16} className="ccs2-search-icon" aria-hidden="true" />
            <input
              type="text"
              aria-label="คำค้นหา"
              className="ccs2-search-input"
              placeholder="ค้นหา (ชื่อ-สกุล, HN, เลขบัตรประชาชน, VN, ClaimCode...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="ccs2-search-clear"
                onClick={() => setSearch('')}
                title="ล้างข้อความค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="ccs2-btn-ghost"
              onClick={resetFilters}
              title="ล้างตัวกรองทั้งหมด"
            >
              รีเซ็ต
            </button>
          )}
        </div>
      </section>

      {/* ── 5. Main Screened Ledger Table ── */}
      <section className="ccs2-table-card">
        <div className="ccs2-table-wrapper">
          <table className="ccs2-table">
            <thead>
              <tr>
                <th className="ccs2-align-center" style={{ width: '48px' }}>ลำดับ</th>
                <th className="is-sortable ccs2-align-center" onClick={() => handleSort('vstdate')}>
                  <div className="ccs2-th-sort-inner">
                    <span>วันที่รับบริการ</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="ccs2-sort-active" /> : <ArrowDown size={13} className="ccs2-sort-active" />
                    ) : (
                      <ArrowUpDown size={13} className="ccs2-sort-muted" />
                    )}
                  </div>
                </th>
                <th className="ccs2-align-center">VN</th>
                <th className="is-sortable ccs2-align-center" onClick={() => handleSort('hn')}>
                  <div className="ccs2-th-sort-inner">
                    <span>HN</span>
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="ccs2-sort-active" /> : <ArrowDown size={13} className="ccs2-sort-active" />
                    ) : (
                      <ArrowUpDown size={13} className="ccs2-sort-muted" />
                    )}
                  </div>
                </th>
                <th className="ccs2-align-center">เลขบัตรประชาชน</th>
                <th className="is-sortable ccs2-align-center" onClick={() => handleSort('ptname')}>
                  <div className="ccs2-th-sort-inner">
                    <span>ชื่อ-สกุล</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="ccs2-sort-active" /> : <ArrowDown size={13} className="ccs2-sort-active" />
                    ) : (
                      <ArrowUpDown size={13} className="ccs2-sort-muted" />
                    )}
                  </div>
                </th>
                <th className="is-sortable ccs2-align-center" onClick={() => handleSort('age')}>
                  <div className="ccs2-th-sort-inner">
                    <span>อายุ</span>
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="ccs2-sort-active" /> : <ArrowDown size={13} className="ccs2-sort-active" />
                    ) : (
                      <ArrowUpDown size={13} className="ccs2-sort-muted" />
                    )}
                  </div>
                </th>
                <th className="ccs2-align-center">สิทธิการรักษา</th>
                <th className="ccs2-align-center">แผนกที่รับบริการ</th>
                <th className="ccs2-align-center">คลินิก</th>
                <th className="ccs2-align-center">ICD-10</th>
                <th className="ccs2-align-center">เกณฑ์ (OK)</th>
                <th className="ccs2-align-center">PapSmear (รหัส)</th>
                <th className="ccs2-align-center">PapSmear (ผล)</th>
                <th className="ccs2-align-center">VIA (รหัส)</th>
                <th className="ccs2-align-center">VIA (ผล)</th>
                <th className="ccs2-align-center">HPV (รหัส)</th>
                <th className="ccs2-align-center">HPV (ผล)</th>
                <th className="ccs2-align-center">วิธีอื่น (รหัส)</th>
                <th className="ccs2-align-center">วิธีอื่น (ผล)</th>
                <th className="ccs2-align-center">ColpoScopy</th>
                <th className="ccs2-align-center">รหัส ADP</th>
                <th className="ccs2-align-center">Seamless Type</th>
                <th className="ccs2-align-center">Seamless เลขที่หนังสือ</th>
                <th className="is-sortable ccs2-align-center" onClick={() => handleSort('compensated')}>
                  <div className="ccs2-th-sort-inner">
                    <span>Seamless ชดเชย</span>
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="ccs2-sort-active" /> : <ArrowDown size={13} className="ccs2-sort-active" />
                    ) : (
                      <ArrowUpDown size={13} className="ccs2-sort-muted" />
                    )}
                  </div>
                </th>
                <th className="ccs2-align-center">Seamless หมายเหตุ</th>
                <th className="ccs2-align-center">Seamless วันที่จ่าย</th>
                <th className="ccs2-align-center">สปสช. สถานะ</th>
                <th className="ccs2-align-center">สปสช. เลขที่ Rep</th>
                <th className="is-sortable ccs2-align-center" onClick={() => handleSort('nhso')}>
                  <div className="ccs2-th-sort-inner">
                    <span>สปสช. ประมาณการ</span>
                    {sortBy === 'nhso' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="ccs2-sort-active" /> : <ArrowDown size={13} className="ccs2-sort-active" />
                    ) : (
                      <ArrowUpDown size={13} className="ccs2-sort-muted" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="rcm-skeleton-row">
                    {Array.from({ length: 28 }).map((__, j) => (
                      <td key={j} className="ccs2-align-center">
                        <div className="ccs2-skeleton-line rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={28}>
                    <div className="ccs2-empty-state">
                      <FileSpreadsheet size={36} color="var(--ccs-muted)" />
                      <p>ไม่พบรายการผู้รับบริการตรวจคัดกรองมะเร็งปากมดลูกตามเงื่อนไขที่เลือก</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isNotOk = row.ok !== 'Y'
                  return (
                    <tr
                      key={row.vn || row.no}
                      className={`ccs2-row-interactive ${isNotOk ? 'ccs2-row-not-ok' : ''}`}
                      onClick={() => handleOpenModal(row)}
                      title="คลิกทั้งแถวเพื่อดูรายละเอียดเวชระเบียน"
                    >
                      <td className="ccs2-align-center">{row.no}</td>
                      <td>
                        {row.vstdate ? formatThaiDate(row.vstdate) : '—'}
                        {row.vsttime ? ` ${row.vsttime.slice(0, 5)}` : ''}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ccs2-link-vn ccs2-mono"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenModal(row)
                          }}
                          title="คลิกดูรายละเอียดเวชระเบียน"
                        >
                          {row.vn}
                        </button>
                      </td>
                      <td className="ccs2-mono">{row.hn}</td>
                      <td className="ccs2-mono">{formatCidDisplay(row.cid)}</td>
                      <td>
                        <span className="ccs2-pt-name">{row.ptname}</span>
                      </td>
                      <td className="ccs2-align-center">
                        {row.age != null ? `${row.age}\u00A0ปี` : '—'}
                      </td>
                      <td>{row.pttypename_visit || row.pttypename_patient || '—'}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.clinic || '—'}</td>
                      <td className="ccs2-mono" title={[row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5].filter(Boolean).join(',')}>
                        {row.pdx || '—'}
                      </td>
                      {/* OK Badge (FoxPro _color: Red if isnull(ok)) */}
                      <td className="ccs2-align-center">
                        {row.ok === 'Y' ? (
                          <span className="ccs2-badge ccs2-badge-success">OK</span>
                        ) : (
                          <span className="ccs2-badge ccs2-badge-danger" title="ขาดการบันทึกรหัสบริการคัดกรอง PP Special">
                            Not OK
                          </span>
                        )}
                      </td>
                      {/* PapSmear */}
                      <td className="ccs2-mono">{row.papsmear || '—'}</td>
                      <td className="ccs2-align-center">{renderResultBadge(row.papsmear_result)}</td>
                      {/* VIA */}
                      <td className="ccs2-mono">{row.via || '—'}</td>
                      <td className="ccs2-align-center">{renderResultBadge(row.via_result)}</td>
                      {/* HPV */}
                      <td className="ccs2-mono">{row.hpv || '—'}</td>
                      <td className="ccs2-align-center">{renderResultBadge(row.hpv_result)}</td>
                      {/* Other */}
                      <td className="ccs2-mono">{row.other || '—'}</td>
                      <td className="ccs2-align-center">{renderResultBadge(row.other_result)}</td>
                      {/* ColpoScopy */}
                      <td className="ccs2-align-center">
                        {row.colposcopy === 'Y' ? (
                          <span className="ccs2-badge ccs2-badge-info">Y</span>
                        ) : (
                          <span className="ccs2-badge ccs2-badge-ghost">—</span>
                        )}
                      </td>
                      {/* Listname ADP */}
                      <td className="ccs2-mono">{row.listname || '—'}</td>
                      {/* Seamless */}
                      <td>{row.type || '—'}</td>
                      <td className="ccs2-mono">
                        <div>{row.rep || '—'}</div>
                        <RcmSeamlessRepBadges row={row} />
                      </td>
                      <td className="ccs2-align-right">
                        <div>{formatMoney(row.compensated)}</div>
                        <RcmSeamlessSubAmount row={row} />
                      </td>
                      <td title={row.note || ''}>{row.note || '—'}</td>
                      <td>{row.paydate ? formatThaiDate(row.paydate) : '—'}</td>
                      {/* NHSO */}
                      <td>{row.status || '—'}</td>
                      <td className="ccs2-mono">{row.rep_nhso || '—'}</td>
                      <td className="ccs2-align-right">{formatMoney(row.nhso)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 6. Pagination Footer ── */}
        <div className="ccs2-table-footer">
          <div>
            แสดง {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, totalCount)} จากทั้งหมด {totalCount.toLocaleString('th-TH')} รายการ
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--ccs-muted)' }}>แสดง:</span>
              <select
                className="ccs2-date-select"
                style={{ height: '32px', padding: '0 8px' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div className="ccs2-pagination">
              <button
                type="button"
                className="ccs2-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ก่อนหน้า
              </button>
              <span style={{ padding: '0 8px', fontSize: '0.875rem' }}>
                หน้า {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="ccs2-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Patient Visit Inspection Modal ── */}
      {selectedItem && (
        <div className="ccs2-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="ccs2-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="ccs2-modal-header">
              <div>
                <h3 className="ccs2-modal-title">
                  เวชระเบียนผู้รับบริการ: {selectedItem.ptname} (HN: {selectedItem.hn})
                </h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--ccs-muted)' }}>
                  VN: {selectedItem.vn} | วันที่รับบริการ: {formatThaiDate(selectedItem.vstdate)}
                </span>
              </div>
              <button
                type="button"
                className="ccs2-btn-ghost"
                onClick={() => setSelectedItem(null)}
                style={{ minHeight: '32px', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ccs2-modal-tabs">
              <button
                type="button"
                className={`ccs2-modal-tab-btn ${modalTab === 'summary' ? 'is-active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปการคัดกรอง & การชดเชย
              </button>
              <button
                type="button"
                className={`ccs2-modal-tab-btn ${modalTab === 'clinical' ? 'is-active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก HOSxP
              </button>
            </div>

            <div className="ccs2-modal-body">
              {modalTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="ccs2-desc-grid">
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">เลขประจำตัวประชาชน:</span>
                      <span className="ccs2-desc-value ccs2-mono">{formatCidDisplay(selectedItem.cid)}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">อายุ:</span>
                      <span className="ccs2-desc-value">{selectedItem.age ?? '—'} ปี</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">สัญชาติ:</span>
                      <span className="ccs2-desc-value">{selectedItem.nation || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">ClaimCode:</span>
                      <span className="ccs2-desc-value ccs2-mono">{selectedItem.authencode || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">สิทธิการรักษา:</span>
                      <span className="ccs2-desc-value">{selectedItem.pttypename_visit || selectedItem.pttypename_patient || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">แผนก / คลินิก:</span>
                      <span className="ccs2-desc-value">{selectedItem.department || '—'} / {selectedItem.clinic || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">การวินิจฉัย (ICD-10):</span>
                      <span className="ccs2-desc-value ccs2-mono">{[selectedItem.pdx, selectedItem.dx0, selectedItem.dx1, selectedItem.dx2, selectedItem.dx3].filter(Boolean).join(', ') || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">เกณฑ์การบันทึกบริการ:</span>
                      <span className="ccs2-desc-value">
                        {selectedItem.ok === 'Y' ? (
                          <span className="ccs2-badge ccs2-badge-success">ผ่านเกณฑ์ (OK)</span>
                        ) : (
                          <span className="ccs2-badge ccs2-badge-danger">ไม่ผ่านเกณฑ์ (Not OK)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--ccs-hairline)' }} />

                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>ผลการตรวจคัดกรอง</h4>
                  <div className="ccs2-desc-grid">
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">Pap Smear:</span>
                      <span className="ccs2-desc-value">
                        {selectedItem.papsmear ? `${selectedItem.papsmear} (${selectedItem.papsmear_result})` : '—'}
                      </span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">VIA:</span>
                      <span className="ccs2-desc-value">
                        {selectedItem.via ? `${selectedItem.via} (${selectedItem.via_result})` : '—'}
                      </span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">HPV DNA:</span>
                      <span className="ccs2-desc-value">
                        {selectedItem.hpv ? `${selectedItem.hpv} (${selectedItem.hpv_result})` : '—'}
                      </span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">วิธีการอื่นๆ:</span>
                      <span className="ccs2-desc-value">
                        {selectedItem.other ? `${selectedItem.other} (${selectedItem.other_result})` : '—'}
                      </span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">ColpoScopy:</span>
                      <span className="ccs2-desc-value">{selectedItem.colposcopy === 'Y' ? 'มีการตรวจ (1B005)' : '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">รหัส ADP ที่คิดเงิน:</span>
                      <span className="ccs2-desc-value ccs2-mono">{selectedItem.listname || '—'}</span>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--ccs-hairline)' }} />

                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>ข้อมูลการชดเชยค่าบริการ</h4>
                  <div className="ccs2-desc-grid">
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">Seamless Type & Rep:</span>
                      <span className="ccs2-desc-value">{selectedItem.type || '—'} {selectedItem.rep ? `(${selectedItem.rep})` : ''}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">Seamless ยอดชดเชย:</span>
                      <span className="ccs2-desc-value">{formatMoney(selectedItem.compensated)} บาท</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">Seamless วันที่จ่าย:</span>
                      <span className="ccs2-desc-value">{selectedItem.paydate ? formatThaiDate(selectedItem.paydate) : '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">Seamless หมายเหตุ:</span>
                      <span className="ccs2-desc-value">{selectedItem.note || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">สปสช. สถานะ:</span>
                      <span className="ccs2-desc-value">{selectedItem.status || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">สปสช. เลขที่ Rep:</span>
                      <span className="ccs2-desc-value ccs2-mono">{selectedItem.rep_nhso || '—'}</span>
                    </div>
                    <div className="ccs2-desc-item">
                      <span className="ccs2-desc-label">สปสช. ประมาณการชดเชย:</span>
                      <span className="ccs2-desc-value">{formatMoney(selectedItem.nhso)} บาท</span>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {vnLoading ? (
                    <div style={{ textAlign: 'center', padding: '32px' }}>
                      <RefreshCw size={24} className="ccs2-spin-icon" style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, color: 'var(--ccs-muted)' }}>กำลังดึงข้อมูลเวชระเบียนจาก HOSxP...</p>
                    </div>
                  ) : vnError ? (
                    <div style={{ padding: '16px', background: 'var(--ccs-err-bg)', color: 'var(--ccs-err)', borderRadius: '8px' }}>
                      {vnError}
                    </div>
                  ) : vnDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Triage / Screen */}
                      {vnDetails.screen && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>การคัดกรองเบื้องต้น</h4>
                          <div className="ccs2-desc-grid">
                            <div className="ccs2-desc-item">
                              <span className="ccs2-desc-label">อาการสำคัญ (CC):</span>
                              <span className="ccs2-desc-value">{vnDetails.screen.cc || '—'}</span>
                            </div>
                            <div className="ccs2-desc-item">
                              <span className="ccs2-desc-label">ความดันโลหิต (BP):</span>
                              <span className="ccs2-desc-value">{vnDetails.screen.bps ? `${vnDetails.screen.bps}/${vnDetails.screen.bpd} mmHg` : '—'}</span>
                            </div>
                            <div className="ccs2-desc-item">
                              <span className="ccs2-desc-label">ชีพจร / อุณหภูมิ:</span>
                              <span className="ccs2-desc-value">{vnDetails.screen.pulse ? `${vnDetails.screen.pulse} bpm` : '—'} / {vnDetails.screen.temperature ? `${vnDetails.screen.temperature} °C` : '—'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Diagnoses */}
                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>การวินิจฉัยโรค (Diagnoses)</h4>
                          <table className="ccs2-table" style={{ fontSize: '0.8125rem' }}>
                            <thead>
                              <tr>
                                <th>รหัส ICD-10</th>
                                <th>ชื่อการวินิจฉัย</th>
                                <th>ประเภทการวินิจฉัย</th>
                                <th>แพทย์ผู้ตรวจ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.diagnoses.map((dx, idx) => (
                                <tr key={idx}>
                                  <td className="ccs2-mono" style={{ fontWeight: 600 }}>{dx.icd10}</td>
                                  <td>{dx.icd_name || '—'}</td>
                                  <td>{dx.diagtype_name || dx.diagtype || '—'}</td>
                                  <td>{dx.doctor_name || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Orders / Drugs / Lab */}
                      {vnDetails.orders && vnDetails.orders.items && vnDetails.orders.items.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>
                            รายการยา / ตรวจวิเคราะห์ / หัตถการ ({vnDetails.orders.total_items} รายการ · รวม {formatMoney(vnDetails.orders.total_price)} บาท)
                          </h4>
                          <table className="ccs2-table" style={{ fontSize: '0.8125rem' }}>
                            <thead>
                              <tr>
                                <th>หมวด</th>
                                <th>รายการ</th>
                                <th>รหัสสินค้า (icode)</th>
                                <th className="ccs2-align-right">จำนวน</th>
                                <th className="ccs2-align-right">ราคาต่อหน่วย</th>
                                <th className="ccs2-align-right">รวมเงิน (บาท)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vnDetails.orders.items.map((it, idx) => (
                                <tr key={idx}>
                                  <td>{it.income_name || '—'}</td>
                                  <td>{it.item_name}</td>
                                  <td className="ccs2-mono">{it.icode || '—'}</td>
                                  <td className="ccs2-align-right">{it.qty}</td>
                                  <td className="ccs2-align-right">{formatMoney(it.unitprice)}</td>
                                  <td className="ccs2-align-right">{formatMoney(it.sum_price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="ccs2-empty-state">
                      <p>ไม่พบข้อมูลเวชระเบียนคลินิกสำหรับ VN นี้</p>
                    </div>
                  )}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>

            <div className="ccs2-modal-footer">
              <button
                type="button"
                className="ccs2-btn-secondary"
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
