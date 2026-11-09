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
  Activity,
  ReceiptText,
  Calendar,
  Filter,
  HeartPulse,
} from 'lucide-react'
import type {
  PostpartumService30016Item,
  PostpartumService30016Summary,
  PostpartumCompensationFilter,
  PostpartumSearchField,
  PostpartumSortField,
  PostpartumAdpMappingCheck,
} from '@/lib/clinical/rcmPostpartumService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
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

function maskIdentifier(val?: string | null): string {
  if (!val) return '—'
  const trimmed = val.trim()
  if (trimmed.length <= 4) return trimmed
  return `•••${trimmed.slice(-4)}`
}

export interface PostpartumService30016ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function PostpartumService30016Client({
  initialData,
  initialRange,
}: PostpartumService30016ClientProps = {}) {
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

  // Date selection states (Default to Fiscal Year)
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter & Search states
  const [compensationFilter, setCompensationFilter] = useState<PostpartumCompensationFilter>('ALL')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [searchField, setSearchField] = useState<PostpartumSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<PostpartumSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PostpartumService30016Item[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<PostpartumAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<PostpartumService30016Summary>(
    initialData?.summary || {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      withPdxCount: 0,
      withOpCount: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Modal Detail states
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Recalculate ds1/ds2 on dateMode changes
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

  // Fetch report data
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      if (forceRefresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const q = new URLSearchParams({
          ds1,
          ds2,
          compensationFilter,
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
          `/api/service/dashboard-rcm/funds/postpartum/service-30016?${q.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        setItems(json.data.items || [])
        setTotalCount(json.data.totalCount || 0)
        setTotalPages(json.data.totalPages || 1)
        if (json.data.summary) setSummary(json.data.summary)
        if (json.data.adpMapping) setAdpMapping(json.data.adpMapping)
      } catch (err: unknown) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          setError(e.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, compensationFilter, pttypes, searchField, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
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

  // Selected item for modal
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null

  // Fetch VN Clinical Details when opening modal tab 'clinical'
  useEffect(() => {
    if (!selectedItem || modalTab !== 'clinical') return
    if (!selectedItem.vn) return

    let isMounted = true
    setClinicalLoading(true)
    setClinicalError(null)

    fetch(`/api/service/dashboard-rcm/funds/postpartum/vn-details?vn=${selectedItem.vn}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return
        if (json.success && json.data) {
          setClinicalData(json.data)
        } else {
          setClinicalError(json.error?.message || 'ไม่สามารถโหลดข้อมูลเวชระเบียนได้')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setClinicalError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      })
      .finally(() => {
        if (isMounted) setClinicalLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedItem, modalTab])

  // Sort handler
  const handleSort = (field: PostpartumSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Copy to clipboard with visual feedback
  const handleCopy = (text: string, fieldKey: string) => {
    if (!navigator?.clipboard) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  // Export CSV
  const handleExport = async () => {
    try {
      setIsExporting(true)
      const q = new URLSearchParams({
        ds1,
        ds2,
        compensationFilter,
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
        `/api/service/dashboard-rcm/funds/postpartum/service-30016?${q.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล')
      }

      const exportItems: PostpartumService30016Item[] = json.data.items || []

      const headers = [
        'ลำดับ',
        'วันที่รับบริการ',
        'เวลารับบริการ',
        'เลขที่ VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ',
        'สัญชาติ',
        'ClaimCode',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'PDX',
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
        'รายการยา ADP 30016',
        'รายการอื่นๆ',
        'สถานะการชดเชย',
        'เลขที่ Rep',
        'ยอดชดเชย (บาท)',
        'กองทุน',
        'กองทุนย่อย',
      ]

      const rows = exportItems.map((it) => [
        it.no,
        it.vstdate,
        it.vsttime || '',
        it.vn,
        it.hn,
        it.cid,
        it.ptname || '',
        it.age ?? '',
        it.nation || '',
        it.authencode || '',
        it.pttypename || '',
        it.department || '',
        it.clinic || '',
        it.pdx || '',
        it.dx0 || '',
        it.dx1 || '',
        it.dx2 || '',
        it.dx3 || '',
        it.dx4 || '',
        it.dx5 || '',
        it.op0 || '',
        it.op1 || '',
        it.op2 || '',
        it.op3 || '',
        it.op4 || '',
        it.op5 || '',
        it.listname || '',
        it.listname1 || '',
        it.status || '',
        it.rep || '',
        it.compensated,
        it.fund || '',
        it.subfund || '',
      ])

      await exportRcmExcel({
        filename: `rcm_postpartum_7_3_30016_${ds1}_to_${ds2}.xlsx`,
        title: 'การจ่ายยา Triforine ADP (รหัสบริการ 30016)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
    } catch (err: unknown) {
      const e = err as Error
      alert(`ไม่สามารถส่งออกข้อมูลได้: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="pp3-page">
      {/* ── 1. Header Bar ── */}
      <header className="pp3-header">
        <div className="pp3-title-group">
          <h1 className="pp3-title">7.3 การจ่ายยา Triforine ADP (รหัสบริการ 30016)</h1>
          <p className="pp3-subtitle">
            รายงานการสั่งจ่ายยาเสริมธาตุเหล็ก/Triforine (รหัส ADP 30016) สำหรับหญิงหลังคลอด ตรวจสอบสิทธิ
            การวินิจฉัย หัตถการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช.
          </p>
        </div>

        <div className="pp3-header-actions">
          <button
            type="button"
            className="pp3-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชและดึงข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'pp3-spin-icon' : ''} />
            <span>{isRefreshing ? 'กำลังดึงข้อมูล…' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="pp3-btn-primary"
            onClick={handleExport}
            disabled={loading || isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก…' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. ADP Mapping Alert Banner ── */}
      {!adpMapping.isMapped && (
        <div className="pp3-banner pp3-banner-warn" role="alert">
          <AlertTriangle size={20} className="shrink-0 text-amber-600" />
          <div>
            <strong>แจ้งเตือน: ยังไม่ได้ Map ADP Code 30016 ในระบบ HOSxP</strong>
            <p className="mt-1">
              ตาราง <code>s_drugitems</code> ยังไม่มีรายการยาที่ระบุ <code>nhso_adp_code = &apos;30016&apos;</code>{' '}
              กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่ารหัส ADP สำหรับยา Triforine / Triferdine
            </p>
          </div>
        </div>
      )}

      {/* ── 3. Date Selection Panel ── */}
      <section className="pp3-date-panel" aria-label="ตัวเลือกช่วงเวลา">
        <div className="pp3-date-mode-tabs">
          <button
            type="button"
            className={`pp3-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => setDateMode('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            className={`pp3-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setDateMode('monthly')}
          >
            เดือน
          </button>
          <button
            type="button"
            className={`pp3-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => setDateMode('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="pp3-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="pp3-input-group">
                <label className="pp3-label">ตั้งแต่วันที่</label>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  maxDate={ds2}
                />
              </div>

              <div className="pp3-input-group">
                <label className="pp3-label">ถึงวันที่</label>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  minDate={ds1}
                />
              </div>
            </>
          )}

          {dateMode === 'monthly' && (
            <>
              <div className="pp3-input-group">
                <label htmlFor="monthly-month-select" className="pp3-label">
                  เดือน
                </label>
                <select
                  id="monthly-month-select"
                  className="pp3-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pp3-input-group">
                <label htmlFor="monthly-year-select" className="pp3-label">
                  ปี พ.ศ.
                </label>
                <select
                  id="monthly-year-select"
                  className="pp3-select"
                  value={selectedBeYear}
                  onChange={(e) => setSelectedBeYear(Number(e.target.value))}
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
            <div className="pp3-input-group">
              <label htmlFor="fiscal-year-select" className="pp3-label">
                ปีงบประมาณ พ.ศ.
              </label>
              <select
                id="fiscal-year-select"
                className="pp3-select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
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
      </section>

      {/* ── 4. Interactive KPI Summary Cards ── */}
      <section className="pp3-kpi-grid" aria-label="สรุปข้อมูลสำคัญ">
        <button
          type="button"
          className={`pp3-kpi-card ${compensationFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter('ALL')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="pp3-kpi-header">
            <span className="pp3-kpi-title">ผู้รับบริการทั้งหมด</span>
            <HeartPulse size={18} className="pp3-kpi-icon" />
          </div>
          <div className="pp3-kpi-value">{summary.totalVisits.toLocaleString('th-TH')}</div>
          <div className="pp3-kpi-subtext">
            ผู้ป่วยไม่ซ้ำ: <strong>{summary.uniquePatients.toLocaleString('th-TH')}</strong> คน
          </div>
        </button>

        <button
          type="button"
          className={`pp3-kpi-card ${compensationFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter(compensationFilter === 'COMPENSATED' ? 'ALL' : 'COMPENSATED')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับการชดเชยแล้ว"
        >
          <div className="pp3-kpi-header">
            <span className="pp3-kpi-title">ชดเชยค่าบริการแล้ว</span>
            <ReceiptText size={18} className="pp3-kpi-icon text-emerald-600" />
          </div>
          <div className="pp3-kpi-value text-emerald-700">
            {summary.compensatedVisits.toLocaleString('th-TH')}
          </div>
          <div className="pp3-kpi-subtext">
            ยอดรวม <strong>{formatMoney(summary.totalCompensated)}</strong> บ. ({summary.compensationRate}%)
          </div>
        </button>

        <button
          type="button"
          className={`pp3-kpi-card ${compensationFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter(compensationFilter === 'UNCOMPENSATED' ? 'ALL' : 'UNCOMPENSATED')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ได้รับการชดเชย"
        >
          <div className="pp3-kpi-header">
            <span className="pp3-kpi-title">ยังไม่ชดเชย</span>
            <AlertTriangle size={18} className="pp3-kpi-icon text-amber-500" />
          </div>
          <div className="pp3-kpi-value text-amber-600">
            {summary.uncompensatedVisits.toLocaleString('th-TH')}
          </div>
          <div className="pp3-kpi-subtext">
            เฉลี่ยเคสชดเชย <strong>{formatMoney(summary.averageCompensated)}</strong> บ./ครั้ง
          </div>
        </button>

        <button
          type="button"
          className={`pp3-kpi-card ${compensationFilter === 'HAS_AUTHEN' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter(compensationFilter === 'HAS_AUTHEN' ? 'ALL' : 'HAS_AUTHEN')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองเฉพาะรายการที่มี ClaimCode"
        >
          <div className="pp3-kpi-header">
            <span className="pp3-kpi-title">มี ClaimCode</span>
            <Check size={18} className="pp3-kpi-icon text-sky-600" />
          </div>
          <div className="pp3-kpi-value">{summary.withAuthenCount.toLocaleString('th-TH')}</div>
          <div className="pp3-kpi-subtext">
            ไม่มี ClaimCode: <strong>{summary.withoutAuthenCount.toLocaleString('th-TH')}</strong> ครั้ง
          </div>
        </button>

        <button
          type="button"
          className={`pp3-kpi-card ${compensationFilter === 'HAS_PDX' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter(compensationFilter === 'HAS_PDX' ? 'ALL' : 'HAS_PDX')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่มีการลงรหัสการวินิจฉัยหลัก (PDx)"
        >
          <div className="pp3-kpi-header">
            <span className="pp3-kpi-title">มีรหัสวินิจฉัย (PDx)</span>
            <Activity size={18} className="pp3-kpi-icon" />
          </div>
          <div className="pp3-kpi-value">{summary.withPdxCount.toLocaleString('th-TH')}</div>
          <div className="pp3-kpi-subtext">
            จากทั้งหมด {summary.totalVisits.toLocaleString('th-TH')} ครั้ง
          </div>
        </button>

        <button
          type="button"
          className={`pp3-kpi-card ${compensationFilter === 'HAS_OP' ? 'active' : ''}`}
          onClick={() => {
            setCompensationFilter(compensationFilter === 'HAS_OP' ? 'ALL' : 'HAS_OP')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่มีการลงรหัสหัตถการ (OP)"
        >
          <div className="pp3-kpi-header">
            <span className="pp3-kpi-title">มีการทำหัตถการ (OP)</span>
            <Activity size={18} className="pp3-kpi-icon text-purple-600" />
          </div>
          <div className="pp3-kpi-value">{summary.withOpCount.toLocaleString('th-TH')}</div>
          <div className="pp3-kpi-subtext">หัตถการ OPD / บริการหลังคลอด</div>
        </button>
      </section>

      {/* ── 5. Search & Filters Bar ── */}
      <section className="pp3-filter-bar" aria-label="ค้นหาและตัวกรอง">
        <div className="pp3-filter-group">
          <div className="pp3-input-group">
            <label htmlFor="comp-filter-select" className="pp3-label">
              <span>สถานะชดเชย:</span>
            </label>
            <select
              id="comp-filter-select"
              className="pp3-select"
              value={compensationFilter}
              onChange={(e) => {
                setCompensationFilter(e.target.value as PostpartumCompensationFilter)
                setCurrentPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด ({summary.totalVisits})</option>
              <option value="COMPENSATED">ชดเชยแล้ว ({summary.compensatedVisits})</option>
              <option value="UNCOMPENSATED">ยังไม่ชดเชย ({summary.uncompensatedVisits})</option>
              <option value="HAS_AUTHEN">มี ClaimCode ({summary.withAuthenCount})</option>
              <option value="NO_AUTHEN">ไม่มี ClaimCode ({summary.withoutAuthenCount})</option>
              <option value="HAS_PDX">มีรหัสวินิจฉัย PDx ({summary.withPdxCount})</option>
              <option value="HAS_OP">มีรหัสหัตถการ OP ({summary.withOpCount})</option>
            </select>
          </div>

          <div className="pp3-input-group">
            <label className="pp3-label">
              <span>สิทธิการรักษา:</span>
            </label>
            <PttypeMultiSelect
              selectedCodes={pttypes}
              onChange={(codes) => {
                setPttypes(codes)
                setCurrentPage(1)
            }}
            items={items}
            
          />
          </div>

          <div className="pp3-search-box">
            <Search size={16} className="pp3-search-icon" />
            <input
              type="text"
              className="pp3-search-input"
              placeholder="พิมพ์คำค้นหา (HN, เลขบัตร, ชื่อ, VN, รหัสโรค)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="pp3-clear-btn"
                onClick={() => setSearch('')}
                title="ล้างข้อความค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="pp3-input-group">
          <label htmlFor="page-size-select" className="pp3-label">
            แสดงหน้าละ:
          </label>
          <select
            id="page-size-select"
            className="pp3-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
          >
            <option value="25">25 รายการ</option>
            <option value="50">50 รายการ</option>
            <option value="100">100 รายการ</option>
            <option value="200">200 รายการ</option>
          </select>
        </div>
      </section>

      {/* ── 6. Ledger Table Container ── */}
      <section className="pp3-table-wrapper" aria-label="ตารางข้อมูลบริการ 30016">
        {error && (
          <div className="pp3-banner pp3-banner-err m-4">
            <AlertTriangle size={18} className="shrink-0" />
            <div>
              <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="pp3-table-scroll">
          <table className="pp3-table">
            <thead>
              {/* Single Tier Centered Header */}
              <tr>
                <th className="pp3-col-center pp3-sticky-col-no">
                  ลำดับ
                </th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('vstdate')}
                  title="คลิกเพื่อเรียงตามวันที่รับบริการ"
                >
                  <div className="pp3-th-content">
                    <span>วันที่รับบริการ</span>
                    {sortBy === 'vstdate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="pp3-col-center">เลขที่ VN</th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('hn')}
                  title="คลิกเพื่อเรียงตาม HN"
                >
                  <div className="pp3-th-content">
                    <span>HN</span>
                    {sortBy === 'hn' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('cid')}
                  title="คลิกเพื่อเรียงตามเลขบัตรประชาชน"
                >
                  <div className="pp3-th-content">
                    <span>เลขบัตรประชาชน</span>
                    {sortBy === 'cid' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="pp3-sticky-col-ptname sortable pp3-col-center"
                  onClick={() => handleSort('ptname')}
                  title="คลิกเพื่อเรียงตามชื่อผู้รับบริการ"
                >
                  <div className="pp3-th-content">
                    <span>ชื่อ-สกุลผู้รับบริการ</span>
                    {sortBy === 'ptname' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('age')}
                  title="คลิกเพื่อเรียงตามอายุ"
                >
                  <div className="pp3-th-content">
                    <span>อายุ / สัญชาติ</span>
                    {sortBy === 'age' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('authencode')}
                  title="คลิกเพื่อเรียงตาม ClaimCode"
                >
                  <div className="pp3-th-content">
                    <span>ClaimCode</span>
                    {sortBy === 'authencode' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="pp3-col-center">สิทธิการรักษา</th>
                <th className="pp3-col-center">แผนก / คลินิก</th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('pdx')}
                >
                  <div className="pp3-th-content">
                    <span className="pp3-th-line">PDx</span>
                    <span className="pp3-th-sub">การวินิจฉัย</span>
                    {sortBy === 'pdx' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="pp3-col-center">Dx0</th>
                <th className="pp3-col-center">Dx1</th>
                <th className="pp3-col-center">Dx2</th>
                <th className="pp3-col-center">Dx3</th>
                <th className="pp3-col-center">Dx4</th>
                <th className="pp3-col-center">Dx5</th>
                <th className="pp3-col-center">
                  <span className="pp3-th-line">Op0</span>
                  <span className="pp3-th-sub">หัตถการ</span>
                </th>
                <th className="pp3-col-center">Op1</th>
                <th className="pp3-col-center">Op2</th>
                <th className="pp3-col-center">Op3</th>
                <th className="pp3-col-center">Op4</th>
                <th className="pp3-col-center">Op5</th>
                <th className="pp3-col-center">รายการยา ADP 30016</th>
                <th className="pp3-col-center">รายการอื่นๆ (Non-drug)</th>
                <th className="pp3-col-center">สถานะ E-Claim</th>
                <th className="pp3-col-center">เลขที่ Rep</th>
                <th
                  className="sortable pp3-col-center"
                  onClick={() => handleSort('compensated')}
                  title="คลิกเพื่อเรียงตามยอดเงินชดเชย"
                >
                  <div className="pp3-th-content">
                    <span>ชดเชย (บาท)</span>
                    {sortBy === 'compensated' ? (
                      sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="pp3-col-center">กองทุน</th>
              </tr>
            </thead>

            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={25} className="text-center py-12 text-slate-500">
                    <RefreshCw size={24} className="pp3-spin-icon inline-block mb-2 text-emerald-600" />
                    <div>กำลังโหลดข้อมูลบริการ 30016...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={25} className="pp3-empty-state">
                    <div className="pp3-empty-title">ไม่พบรายการข้อมูลตามเงื่อนไขที่เลือก</div>
                    <p>ลองเปลี่ยนช่วงวัน หรือปรับตัวกรองการชดเชย / คำค้นหา</p>
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={it.vn}
                    className={it.isCompensated ? 'row-compensated' : ''}
                    onClick={() => {
                      setSelectedIndex(idx)
                      setModalTab('summary')
                    }}
                  >
                    <td className="pp3-sticky-col-no tabular-nums text-slate-500">{it.no}</td>
                    <td className="whitespace-nowrap tabular-nums">
                      <div>{formatThaiDate(it.vstdate)}</div>
                      <div className="text-xs text-slate-500">{it.vsttime || '—'}</div>
                    </td>
                    <td className="tabular-nums font-mono text-xs">{it.vn}</td>
                    <td className="tabular-nums font-mono text-xs font-semibold">{it.hn}</td>
                    <td className="whitespace-nowrap">
                      <span
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(it.cid, `cid-${it.vn}`)
                        }}
                        title="คลิกเพื่อคัดลอก CID"
                      >
                        {it.cid || '—'}
                      </span>
                    </td>
                    <td className="pp3-sticky-col-ptname font-medium">{it.ptname}</td>
                    <td className="whitespace-nowrap tabular-nums">
                      {it.age != null ? `${it.age} ปี` : '—'} {it.nation ? `(${it.nation})` : ''}
                    </td>
                    <td className="whitespace-nowrap">
                      {it.authencode ? (
                        <span className="pp3-badge pp3-badge-primary font-mono">{it.authencode}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="max-w-[180px] truncate" title={it.pttypename || ''}>
                      {it.pttypename || '—'}
                    </td>
                    <td className="max-w-[160px] truncate" title={`${it.department || ''} / ${it.clinic || ''}`}>
                      {it.department || '—'}
                    </td>

                    {/* Diagnoses */}
                    <td>
                      {it.pdx ? <span className="pp3-badge-diag pp3-badge-pdx">{it.pdx}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td>{it.dx0 ? <span className="pp3-badge-diag">{it.dx0}</span> : '—'}</td>
                    <td>{it.dx1 ? <span className="pp3-badge-diag">{it.dx1}</span> : '—'}</td>
                    <td>{it.dx2 ? <span className="pp3-badge-diag">{it.dx2}</span> : '—'}</td>
                    <td>{it.dx3 ? <span className="pp3-badge-diag">{it.dx3}</span> : '—'}</td>
                    <td>{it.dx4 ? <span className="pp3-badge-diag">{it.dx4}</span> : '—'}</td>
                    <td>{it.dx5 ? <span className="pp3-badge-diag">{it.dx5}</span> : '—'}</td>

                    {/* Procedures */}
                    <td>{it.op0 ? <span className="pp3-badge-op">{it.op0}</span> : '—'}</td>
                    <td>{it.op1 ? <span className="pp3-badge-op">{it.op1}</span> : '—'}</td>
                    <td>{it.op2 ? <span className="pp3-badge-op">{it.op2}</span> : '—'}</td>
                    <td>{it.op3 ? <span className="pp3-badge-op">{it.op3}</span> : '—'}</td>
                    <td>{it.op4 ? <span className="pp3-badge-op">{it.op4}</span> : '—'}</td>
                    <td>{it.op5 ? <span className="pp3-badge-op">{it.op5}</span> : '—'}</td>

                    {/* Drug & non-drug lists */}
                    <td className="max-w-[200px] truncate font-medium text-emerald-800" title={it.listname || ''}>
                      {it.listname || '—'}
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-slate-500" title={it.listname1 || ''}>
                      {it.listname1 || '—'}
                    </td>

                    {/* Status & Compensation */}
                    <td className="whitespace-nowrap">
                      {it.status ? (
                        <span
                          className={`pp3-badge ${
                            it.isCompensated ? 'pp3-badge-success' : 'pp3-badge-neutral'
                          }`}
                        >
                          {it.status}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">ยังไม่มีสถานะ</span>
                      )}
                    </td>
                    <td className="tabular-nums font-mono text-xs">{it.rep || '—'}</td>
                    <td className="text-right tabular-nums font-semibold whitespace-nowrap">
                      {it.compensated > 0 ? (
                        <span className="text-emerald-700">{formatMoney(it.compensated)}</span>
                      ) : (
                        <span className="text-slate-400">0.00</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {it.fund ? (
                        <span>
                          {it.fund} {it.subfund ? `(${it.subfund})` : ''}
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
        <div className="pp3-pagination">
          <div className="pp3-pagination-info">
            แสดงรายการที่{' '}
            <strong>
              {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, totalCount)}
            </strong>{' '}
            จากทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
          </div>

          <div className="pp3-pagination-buttons">
            <button
              type="button"
              className="pp3-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs text-slate-600 px-2 tabular-nums">
              หน้า {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="pp3-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              title="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 8. Clinical Details Modal ── */}
      {selectedItem && (
        <div
          className="pp3-modal-backdrop"
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="pp3-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pp3-modal-header">
              <h2 className="pp3-modal-title">
                รายละเอียดการรับบริการ VN: {selectedItem.vn} ({selectedItem.ptname})
              </h2>
              <button
                type="button"
                className="pp3-modal-close"
                onClick={() => setSelectedIndex(null)}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pp3-modal-tabs">
              <button
                type="button"
                className={`pp3-modal-tab ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                สรุปข้อมูลบริการ 30016
              </button>
              <button
                type="button"
                className={`pp3-modal-tab ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                เวชระเบียนคลินิก & ยาทั้งหมด
              </button>
            </div>

            <div className="pp3-modal-body">
              {modalTab === 'summary' && (
                <>
                  <div className="pp3-grid-2">
                    <div className="pp3-info-row">
                      <span className="pp3-info-label">ชื่อ-สกุลผู้รับบริการ</span>
                      <span className="pp3-info-val">{selectedItem.ptname}</span>
                    </div>

                    <div className="pp3-info-row">
                      <span className="pp3-info-label">HN / เลขบัตรประชาชน</span>
                      <span className="pp3-info-val">
                        {selectedItem.hn} (CID: {selectedItem.cid || '—'})
                      </span>
                    </div>

                    <div className="pp3-info-row">
                      <span className="pp3-info-label">วันที่และเวลารับบริการ</span>
                      <span className="pp3-info-val">
                        {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime || ''}
                      </span>
                    </div>

                    <div className="pp3-info-row">
                      <span className="pp3-info-label">สิทธิการรักษา / แผนก</span>
                      <span className="pp3-info-val">
                        {selectedItem.pttypename || '—'} / {selectedItem.department || '—'}
                      </span>
                    </div>

                    <div className="pp3-info-row">
                      <span className="pp3-info-label">ClaimCode</span>
                      <span className="pp3-info-val">
                        {selectedItem.authencode ? (
                          <span className="pp3-badge pp3-badge-primary font-mono">
                            {selectedItem.authencode}
                          </span>
                        ) : (
                          'ไม่มีรหัส ClaimCode'
                        )}
                      </span>
                    </div>

                    <div className="pp3-info-row">
                      <span className="pp3-info-label">สถานะการชดเชย / กองทุน</span>
                      <span className="pp3-info-val">
                        {selectedItem.status || '—'} (ยอดชดเชย:{' '}
                        <strong className="text-emerald-700">
                          {formatMoney(selectedItem.compensated)} บาท
                        </strong>
                        )
                      </span>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <div className="flex flex-col gap-2">
                    <span className="pp3-info-label">รายการยาที่สั่งใช้รหัส ADP 30016 (Triforine/Triferdine)</span>
                    <div className="p-3 bg-emerald-50 text-emerald-950 rounded-lg border border-emerald-200 font-medium">
                      {selectedItem.listname || 'ไม่พบรายการยา'}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="pp3-info-label">รายการเวชภัณฑ์ที่ไม่ใช่ยา (Nondrugitems) ใน Visit นี้</span>
                    <div className="p-3 bg-slate-50 text-slate-800 rounded-lg border border-slate-200 text-xs leading-relaxed">
                      {selectedItem.listname1 || 'ไม่มีรายการ'}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="pp3-info-label">การวินิจฉัย (ICD-10)</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.pdx && (
                        <span className="pp3-badge-diag pp3-badge-pdx">PDx: {selectedItem.pdx}</span>
                      )}
                      {[
                        selectedItem.dx0,
                        selectedItem.dx1,
                        selectedItem.dx2,
                        selectedItem.dx3,
                        selectedItem.dx4,
                        selectedItem.dx5,
                      ]
                        .filter(Boolean)
                        .map((dx, i) => (
                          <span key={i} className="pp3-badge-diag">
                            Dx: {dx}
                          </span>
                        ))}
                      {!selectedItem.pdx && <span className="text-slate-400 text-sm">ไม่มีข้อมูลรหัสโรค</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="pp3-info-label">หัตถการ (ICD-9-CM)</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        selectedItem.op0,
                        selectedItem.op1,
                        selectedItem.op2,
                        selectedItem.op3,
                        selectedItem.op4,
                        selectedItem.op5,
                      ]
                        .filter(Boolean)
                        .map((op, i) => (
                          <span key={i} className="pp3-badge-op">
                            Op: {op}
                          </span>
                        ))}
                      {![
                        selectedItem.op0,
                        selectedItem.op1,
                        selectedItem.op2,
                        selectedItem.op3,
                        selectedItem.op4,
                        selectedItem.op5,
                      ].some(Boolean) && <span className="text-slate-400 text-sm">ไม่มีข้อมูลหัตถการ</span>}
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'clinical' && (
                <>
                  {clinicalLoading ? (
                    <div className="py-12 text-center text-slate-500">
                      <RefreshCw size={24} className="pp3-spin-icon inline-block mb-2 text-emerald-600" />
                      <div>กำลังดึงข้อมูลเวชระเบียนคลินิกและรายการยาทั้งหมด...</div>
                    </div>
                  ) : clinicalError ? (
                    <div className="pp3-banner pp3-banner-err">
                      <AlertTriangle size={18} className="shrink-0" />
                      <div>{clinicalError}</div>
                    </div>
                  ) : clinicalData ? (
                    <div className="flex flex-col gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 mb-1">
                          สัญญาณชีพและอาการสำคัญ (Chief Complaint)
                        </div>
                        <div className="text-sm text-slate-800">
                          {clinicalData.screen?.cc || 'ไม่มีบันทึกอาการสำคัญ'}
                        </div>
                        {clinicalData.screen && (
                          <div className="flex gap-4 mt-2 text-xs text-slate-600 font-mono">
                            <span>BP: {clinicalData.screen.bps || '—'}/{clinicalData.screen.bpd || '—'} mmHg</span>
                            <span>Pulse: {clinicalData.screen.pulse || '—'} bpm</span>
                            <span>Temp: {clinicalData.screen.temperature || '—'} °C</span>
                            <span>Weight: {clinicalData.screen.bw || '—'} kg</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          รายการยาทั้งหมดที่ได้รับใน Visit นี้ ({clinicalData.orders?.items?.length || 0} รายการ)
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                              <tr>
                                <th className="p-2">ชื่อยา</th>
                                <th className="p-2">วิธีใช้</th>
                                <th className="p-2 text-right">จำนวน</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {clinicalData.orders?.items && clinicalData.orders.items.length > 0 ? (
                                clinicalData.orders.items.map((rx: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-2 font-medium">{rx.item_name || rx.name}</td>
                                    <td className="p-2 text-slate-600">{rx.drugusage_text || rx.usage || '—'}</td>
                                    <td className="p-2 text-right tabular-nums">{rx.qty || '—'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-slate-400">
                                    ไม่มีรายการยาในเวชระเบียน
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="pp3-modal-footer">
              <button
                type="button"
                className="pp3-btn-secondary"
                onClick={() => setSelectedIndex(null)}
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
