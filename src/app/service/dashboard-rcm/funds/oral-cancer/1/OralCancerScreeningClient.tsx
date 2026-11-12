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
  Calendar,
  ShieldCheck,
  Users,
  Activity,
  UserCheck,
  Sparkles,
} from 'lucide-react'
import type {
  OralCancerItem,
  OralCancerSummary,
  OralCancerCardFilter,
  OralCancerSearchField,
  OralCancerSortField,
  OralCancerAdpMappingCheck,
} from '@/lib/clinical/rcmOralCancerService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { UC_ECLAIM_CODES } from '@/lib/clinical/pttypeConstants'
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

function formatCid(cid?: string | null): string {
  if (!cid) return '—'
  const clean = cid.replace(/\D/g, '')
  return clean || cid.trim() || '—'
}

export interface PhysicalExamSection {
  title: string
  badgeText: string
  badgeClass: string
  items: string[]
}

export function parsePhysicalExam(text?: string | null): PhysicalExamSection[] {
  if (!text || !text.trim()) return []
  const lines = text.split(/\r?\n/)
  const sections: PhysicalExamSection[] = []
  let current: PhysicalExamSection | null = null

  const patterns = [
    {
      regex: /^(?:U\/D|Underlying)\s*:?/i,
      title: 'โรคประจำตัว (Underlying Disease)',
      badgeText: 'ประวัติโรค',
      badgeClass: 'oral-badge-slate',
    },
    {
      regex: /^(?:I\/O|Intraoral|Intra-oral)\s*:?/i,
      title: 'การตรวจภายในช่องปาก (Intraoral Exam)',
      badgeText: 'ตรวจในช่องปาก',
      badgeClass: 'oral-badge-teal',
    },
    {
      regex: /^(?:E\/O|Extraoral|Extra-oral)\s*:?/i,
      title: 'การตรวจภายนอกช่องปาก (Extraoral Exam)',
      badgeText: 'ตรวจนอกช่องปาก',
      badgeClass: 'oral-badge-teal',
    },
    {
      regex: /^(?:OPG[\s.]*(?:Periapical)?|Periapical|Film|X-?ray|Radiographic)\s*:?/i,
      title: 'ภาพถ่ายรังสี / เอกซเรย์ (OPG & Periapical Film)',
      badgeText: 'รังสีวินิจฉัย',
      badgeClass: 'oral-badge-blue',
    },
    {
      regex: /^(?:Hx\s+of\s+Tx|Hx|History)\s*:?/i,
      title: 'ประวัติการรักษาเดิม (Treatment History)',
      badgeText: 'ประวัติการรักษา',
      badgeClass: 'oral-badge-slate',
    },
    {
      regex: /^(?:DDx|Impression|Imp)\s*:?/i,
      title: 'การวินิจฉัยแยกโรค (Differential Diagnosis)',
      badgeText: 'ข้อวินิจฉัย',
      badgeClass: 'oral-badge-amber',
    },
    {
      regex: /^(?:Tx|Treatment|Procedure|Operative)\s*:?/i,
      title: 'การรักษา / หัตถการผ่าตัดและตัดชิ้นเนื้อ (Treatment & Biopsy)',
      badgeText: 'หัตถการ/ผ่าตัด',
      badgeClass: 'oral-badge-emerald',
    },
    {
      regex: /^(?:Plan|N\/V|Next\s*Visit)\s*:?/i,
      title: 'แผนการรักษาต่อเนื่องและการนัดหมาย (Plan / Next Visit)',
      badgeText: 'แผนการดูแล',
      badgeClass: 'oral-badge-indigo',
    },
  ]

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    let matched = false
    for (const p of patterns) {
      if (p.regex.test(line)) {
        matched = true
        const remainder = line.replace(p.regex, '').trim().replace(/^:\s*/, '')
        if (current && current.title === p.title) {
          if (remainder) current.items.push(remainder)
        } else {
          current = {
            title: p.title,
            badgeText: p.badgeText,
            badgeClass: p.badgeClass,
            items: remainder ? [remainder] : [],
          }
          sections.push(current)
        }
        break
      }
    }

    if (!matched) {
      if (!current) {
        current = {
          title: 'บันทึกการตรวจร่างกายทั่วไป',
          badgeText: 'บันทึกการตรวจ',
          badgeClass: 'oral-badge-teal',
          items: [],
        }
        sections.push(current)
      }
      current.items.push(line)
    }
  }

  return sections
}

export interface OralCancerScreeningClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function OralCancerScreeningClient({
  initialData,
  initialRange,
}: OralCancerScreeningClientProps = {}) {
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

  // Date Selection Mode ("เรียง กำหนดเอง เดือน ปีงบประมาณ")
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialRange?.startDate || `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || `${defaultFiscalCeYear}-09-30`)

  // Filter & Search States
  const [cardFilter, setCardFilter] = useState<OralCancerCardFilter>('ALL')
  const [ucOnly, setUcOnly] = useState<boolean>(false)
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>(() => {
    if (initialData?.pttypes) {
      return initialData.pttypes.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    if (initialData?.ucOnly) {
      return [...UC_ECLAIM_CODES]
    }
    return []
  })
  const [searchField, setSearchField] = useState<OralCancerSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<OralCancerSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data Fetching States
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<OralCancerItem[]>(initialData?.items || [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages || 1)
  const [adpMapping, setAdpMapping] = useState<OralCancerAdpMappingCheck>(
    initialData?.adpMapping || {
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<OralCancerSummary>(
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
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      totalIncome: 0,
    }
  )

  // Modal Detail States
  const [selectedItem, setSelectedItem] = useState<OralCancerItem | null>(null)
  const [modalTab, setModalTab] = useState<'summary' | 'clinical'>('summary')
  const [clinicalLoading, setClinicalLoading] = useState<boolean>(false)
  const [clinicalData, setClinicalData] = useState<VnClinicalDetails | null>(null)
  const [clinicalError, setClinicalError] = useState<string | null>(null)
  const [peViewMode, setPeViewMode] = useState<'structured' | 'raw'>('structured')

  const parsedPeSections = useMemo(
    () => parsePhysicalExam(clinicalData?.screen?.pe),
    [clinicalData?.screen?.pe]
  )

  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Handle Monthly date changes
  useEffect(() => {
    if (dateMode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      const mStr = String(selectedMonth).padStart(2, '0')
      setDs1(`${ceYear}-${mStr}-01`)
      setDs2(`${ceYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
      setCurrentPage(1)
    }
  }, [dateMode, selectedMonth, selectedBeYear])

  // Handle Fiscal Year date changes
  useEffect(() => {
    if (dateMode === 'fiscal') {
      const fiscalCe = selectedFiscalYear - 543
      setDs1(`${fiscalCe - 1}-10-01`)
      setDs2(`${fiscalCe}-09-30`)
      setCurrentPage(1)
    }
  }, [dateMode, selectedFiscalYear])

  // Main data fetching function
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
          searchField,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (selectedPttypes.length > 0) {
          queryParams.set('pttypes', selectedPttypes.join(','))
        } else if (ucOnly) {
          queryParams.set('ucOnly', 'true')
        }

        if (refresh) queryParams.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/oral-cancer/service-12-1?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) setSummary(data.summary)
        if (data.adpMapping) setAdpMapping(data.adpMapping)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [ds1, ds2, cardFilter, ucOnly, selectedPttypes, searchField, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData(false)
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData, initialData])

  // Sorting Handler
  const handleSort = (field: OralCancerSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Export to Excel / CSV with BOM
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter,
        searchField,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })

      if (selectedPttypes.length > 0) {
        queryParams.set('pttypes', selectedPttypes.join(','))
      } else if (ucOnly) {
        queryParams.set('ucOnly', 'true')
      }

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/oral-cancer/service-12-1?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')

      const exportRows: OralCancerItem[] = json.data?.items || []
      if (exportRows.length === 0) {
        alert('ไม่พบรายการข้อมูลสำหรับส่งออก')
        return
      }

      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'อายุ',
        'สัญชาติ',
        'วันที่รับบริการ',
        'เวลา',
        'ClaimCode',
        'สิทธิการรักษา',
        'แผนก',
        'คลินิก',
        'PDX',
        'SDX',
        'หัตถการ',
        'ค่าบริการ',
        'รายการ ADP 90004',
        'สถานะการชดเชย',
        'เลขที่ Rep',
        'เงินชดเชย',
      ]

      const rows = exportRows.map((r, idx) => [
        idx + 1,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.age,
        r.nation || '',
        r.vstdate,
        r.vsttime,
        r.authencode || '',
        r.pttypename || '',
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.sdx || '',
        r.ops || '',
        r.income,
        r.listname || '',
        r.status || '',
        r.rep || '',
        r.compensated,
      ])

      await exportRcmExcel({
        filename: `oral_cancer_screening_12_1_${ds1}_to_${ds2}.xlsx`,
        title: 'คัดกรองรอยโรคมะเร็งช่องปาก 40 ปีขึ้นไป (12.1 / ADP 90004)',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} | โรงพยาบาลเถิน`,
        headers,
        rows,
      })
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการส่งออก: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  // Fetch VN Clinical details for modal
  const openItemDetail = async (item: OralCancerItem) => {
    setSelectedItem(item)
    setModalTab('summary')
    setClinicalData(null)
    setClinicalError(null)
    setPeViewMode('structured')

    if (item.vn) {
      setClinicalLoading(true)
      try {
        const res = await fetch(`/api/service/dashboard-rcm/funds/oral-cancer/vn-details?vn=${item.vn}`)
        const json = await res.json()
        if (json.success && json.data) {
          setClinicalData(json.data)
        } else {
          setClinicalError(json.error?.message || 'ไม่สามารถโหลดข้อมูลเวชระเบียนเพิ่มเติมได้')
        }
      } catch (err: any) {
        setClinicalError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setClinicalLoading(false)
      }
    }
  }

  const renderSortIndicator = (field: OralCancerSortField) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="text-gray-400" aria-hidden="true" />
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="text-emerald-700" aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className="text-emerald-700" aria-hidden="true" />
    )
  }

  return (
    <div className="oral-page">
      {/* ── 1. Header Bar ── */}
      <header className="oral-header">
        <div className="oral-title-group">
          <div className="oral-title-badge">
            <Sparkles size={14} aria-hidden="true" />
            <span>หัวข้อที่ 12.1 กองทุน สปสช.</span>
          </div>
          <h1 className="oral-title">12.1 คัดกรองรอยโรคมะเร็งช่องปาก (40 ปีขึ้นไป)</h1>
          <p className="oral-subtitle">
            บริการคัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก (CA Oral Screening) อายุ 40 ปีขึ้นไป รหัส ADP 90004
          </p>
        </div>

        <div className="oral-header-actions">
          <button
            type="button"
            className="oral-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
          </button>

          <button
            type="button"
            className="oral-btn-primary"
            onClick={handleExportCsv}
            disabled={isExporting || items.length === 0}
            aria-label="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} aria-hidden="true" />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. ADP Mapping Alert Banner ── */}
      {!adpMapping.isMapped && (
        <div className="oral-alert-banner" role="alert">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
          <div>
            <strong>ยังไม่ได้ Map ADP Code:</strong> ไม่พบรหัส <code>90004</code> ในตาราง <code>s_drugitems</code>{' '}
            กรุณาตั้งค่า Map ADP Code 90004 ในระบบ HOSxP เพื่อให้ข้อมูลแสดงผลอย่างถูกต้อง
          </div>
        </div>
      )}

      {/* ── 3. Date Selection Panel ("เรียง กำหนดเอง รายเดือน ปีงบประมาณ") ── */}
      <section className="oral-date-panel" aria-label="ตัวเลือกช่วงเวลา">
        <div className="oral-date-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            className={`oral-date-tab ${dateMode === 'custom' ? 'active' : ''}`}
            onClick={() => setDateMode('custom')}
          >
            <span>กำหนดเอง</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'monthly'}
            className={`oral-date-tab ${dateMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setDateMode('monthly')}
          >
            <span>รายเดือน</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'fiscal'}
            className={`oral-date-tab ${dateMode === 'fiscal' ? 'active' : ''}`}
            onClick={() => setDateMode('fiscal')}
          >
            <span>ปีงบประมาณ</span>
          </button>
        </div>

        <div className="oral-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="oral-control-group">
                <label htmlFor="oral-date-start" className="oral-control-label">
                  ตั้งแต่วันที่:
                </label>
                <ThaiDatePicker
                  id="oral-date-start"
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                />
              </div>

              <div className="oral-control-group">
                <label htmlFor="oral-date-end" className="oral-control-label">
                  ถึงวันที่:
                </label>
                <ThaiDatePicker
                  id="oral-date-end"
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
              <div className="oral-control-group">
                <label htmlFor="oral-month-select" className="oral-control-label">
                  เดือน:
                </label>
                <select
                  id="oral-month-select"
                  className="oral-select"
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

              <div className="oral-control-group">
                <label htmlFor="oral-year-select" className="oral-control-label">
                  ปี พ.ศ.:
                </label>
                <select
                  id="oral-year-select"
                  className="oral-select"
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
            </>
          )}

          {dateMode === 'fiscal' && (
            <div className="oral-control-group">
              <label htmlFor="oral-fiscal-select" className="oral-control-label">
                ปีงบประมาณ พ.ศ.:
              </label>
              <select
                id="oral-fiscal-select"
                className="oral-select"
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

      {/* ── 4. Interactive Summary KPI Cards (Filter via Card Click!) ── */}
      <section className="oral-cards-grid" aria-label="สรุปสถิติและตัวกรองข้อมูล">
        {/* Card 1: All Visits */}
        <button
          type="button"
          className={`oral-card ${cardFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('ALL')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ผู้รับบริการทั้งหมด"
        >
          <div className="oral-card-indicator" />
          <div className="oral-card-head">
            <span className="oral-card-title">ผู้รับบริการทั้งหมด</span>
            <span className="oral-card-badge all">ทั้งหมด</span>
          </div>
          <div className="oral-card-value">{summary.totalVisits.toLocaleString('th-TH')} ครั้ง</div>
          <div className="oral-card-sub">
            <UserCheck size={14} aria-hidden="true" />
            <span>จำนวนคน: {summary.uniquePatients.toLocaleString('th-TH')} ราย</span>
          </div>
        </button>

        {/* Card 2: Compensated */}
        <button
          type="button"
          className={`oral-card ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('COMPENSATED')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ได้รับการชดเชยแล้ว"
        >
          <div className="oral-card-indicator" />
          <div className="oral-card-head">
            <span className="oral-card-title">ชดเชยแล้ว</span>
            <span className="oral-card-badge success">
              {summary.compensationRate.toFixed(1)}%
            </span>
          </div>
          <div className="oral-card-value">{summary.compensatedVisits.toLocaleString('th-TH')} ครั้ง</div>
          <div className="oral-card-sub">
            <span>รวม {formatMoney(summary.totalCompensated)} บาท</span>
          </div>
        </button>

        {/* Card 3: Uncompensated / Pending */}
        <button
          type="button"
          className={`oral-card ${cardFilter === 'UNCOMPENSATED' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('UNCOMPENSATED')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: รอชดเชย / ยังไม่ชดเชย"
        >
          <div className="oral-card-indicator" />
          <div className="oral-card-head">
            <span className="oral-card-title">ยังไม่ชดเชย</span>
            <span className="oral-card-badge warning">รอตรวจ</span>
          </div>
          <div className="oral-card-value">{summary.uncompensatedVisits.toLocaleString('th-TH')} ครั้ง</div>
          <div className="oral-card-sub">
            <span>เฉลี่ย/ครั้ง: {formatMoney(summary.averageCompensated)} ฿</span>
          </div>
        </button>

        {/* Card 4: With ClaimCode */}
        <button
          type="button"
          className={`oral-card ${cardFilter === 'WITH_AUTHEN' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('WITH_AUTHEN')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: มี ClaimCode"
        >
          <div className="oral-card-indicator" />
          <div className="oral-card-head">
            <span className="oral-card-title">มี ClaimCode</span>
            <span className="oral-card-badge info">{summary.authenRate.toFixed(1)}%</span>
          </div>
          <div className="oral-card-value">{summary.withAuthenCount.toLocaleString('th-TH')} ราย</div>
          <div className="oral-card-sub">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>ยืนยันตัวตนสำเร็จ</span>
          </div>
        </button>

        {/* Card 5: Missing ClaimCode */}
        <button
          type="button"
          className={`oral-card ${cardFilter === 'NO_AUTHEN' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('NO_AUTHEN')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: ไม่มี ClaimCode"
        >
          <div className="oral-card-indicator" />
          <div className="oral-card-head">
            <span className="oral-card-title">ไม่มี ClaimCode</span>
            <span className="oral-card-badge warning">ขาด ClaimCode</span>
          </div>
          <div className="oral-card-value">{summary.withoutAuthenCount.toLocaleString('th-TH')} ราย</div>
          <div className="oral-card-sub">
            <span>ต้องขอ ClaimCode ย้อนหลัง</span>
          </div>
        </button>

        {/* Card 6: UC Scheme */}
        <button
          type="button"
          className={`oral-card ${cardFilter === 'UC_ONLY' ? 'active' : ''}`}
          onClick={() => {
            setCardFilter('UC_ONLY')
            setCurrentPage(1)
          }}
          aria-label="ตัวกรอง: สิทธิบัตรทอง"
        >
          <div className="oral-card-indicator" />
          <div className="oral-card-head">
            <span className="oral-card-title">สิทธิบัตรทอง (UC)</span>
            <span className="oral-card-badge success">{summary.ucRate.toFixed(1)}%</span>
          </div>
          <div className="oral-card-value">{summary.ucCount.toLocaleString('th-TH')} ราย</div>
          <div className="oral-card-sub">
            <Users size={14} aria-hidden="true" />
            <span>สิทธิหลักประกันสุขภาพ</span>
          </div>
        </button>
      </section>

      {/* ── 5. Search & Filters Bar ── */}
      <section className="oral-filter-bar" aria-label="ตัวกรองและค้นหา">
        <div className="oral-filter-left">
          <div className="oral-search-box">
            <Search size={18} className="oral-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="oral-search-input"
              placeholder="พิมพ์คำค้นหา (เช่น HN, CID, ชื่อ, รหัสโรค K132)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="oral-clear-search"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="oral-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <PttypeMultiSelect
            selectedCodes={selectedPttypes}
            onChange={(codes) => {
              setSelectedPttypes(codes)
              setCurrentPage(1)
            }}
            items={items}
          
          />

          {selectedPttypes.length > 0 && (
            <div className="oral-active-filter-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem' }}>
              <span>
                สิทธิ:{' '}
                {selectedPttypes.length === UC_ECLAIM_CODES.length &&
                UC_ECLAIM_CODES.every((c) => selectedPttypes.includes(c))
                  ? 'เฉพาะบัตรทอง (UC)'
                  : `${selectedPttypes.length} สิทธิ`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPttypes([])
                  setCurrentPage(1)
                }}
                className="hover:opacity-75"
                title="ล้างตัวกรองสิทธิ"
                aria-label="ล้างตัวกรองสิทธิ"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 6. Table & Ledger (Center-Aligned Harmony) ── */}
      <section className="oral-table-container" aria-label="ตารางข้อมูลการคัดกรอง">
        {error && (
          <div className="oral-alert-banner" style={{ margin: 16 }} role="alert">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="oral-table-wrapper">
          <table className="oral-table">
            <thead>
              <tr>
                <th className="col-center">ลำดับ</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('vstdate')}
                  >
                    <span>วันที่รับบริการ</span>
                    {renderSortIndicator('vstdate')}
                  </button>
                </th>
                <th className="col-center">เวลา</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('hn')}
                  >
                    <span>HN</span>
                    {renderSortIndicator('hn')}
                  </button>
                </th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('cid')}
                  >
                    <span>เลขบัตรประชาชน</span>
                    {renderSortIndicator('cid')}
                  </button>
                </th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('ptname')}
                  >
                    <span>ชื่อ-สกุล</span>
                    {renderSortIndicator('ptname')}
                  </button>
                </th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('age')}
                  >
                    <span>อายุ (ปี)</span>
                    {renderSortIndicator('age')}
                  </button>
                </th>
                <th className="col-center">สิทธิการรักษา</th>
                <th className="col-center">ClaimCode</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('pdx')}
                  >
                    <span>วินิจฉัย (PDX)</span>
                    {renderSortIndicator('pdx')}
                  </button>
                </th>
                <th className="col-center">หัตถการ</th>
                <th className="col-center">รายการบริการ (ADP 90004)</th>
                <th className="col-center">สถานะชดเชย</th>
                <th className="col-center">เลขที่ Rep</th>
                <th className="col-center">
                  <button
                    type="button"
                    className="oral-table-sort-btn"
                    onClick={() => handleSort('compensated')}
                  >
                    <span>ชดเชย (฿)</span>
                    {renderSortIndicator('compensated')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="rcm-skeleton-row" aria-busy="true">
                    {Array.from({ length: 15 }).map((__, j) => (
                      <td key={`skeleton-cell-${j}`} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={15}>
                    <div className="oral-empty-state">
                      <Activity size={36} aria-hidden="true" />
                      <div className="oral-empty-title">ไม่พบข้อมูลการคัดกรองมะเร็งช่องปากในช่วงเวลาที่เลือก</div>
                      <div className="oral-empty-desc">
                        ลองเปลี่ยนช่วงวันที่ ค้นหาด้วยคำอื่น หรือกดรีเฟรชเพื่อตรวจสอบข้อมูลล่าสุดจากฐานข้อมูล HOSxP
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.vn}
                    className="oral-table-row clickable"
                    onClick={() => openItemDetail(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openItemDetail(item)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`คลิกเพื่อดูรายละเอียด ${item.ptname} VN ${item.vn}`}
                  >
                    <td className="col-center">{item.no}</td>
                    <td className="col-center">{formatThaiDate(item.vstdate)}</td>
                    <td className="col-center">{item.vsttime || '—'}</td>
                    <td className="col-center cell-strong">{item.hn}</td>
                    <td className="col-center">{formatCid(item.cid)}</td>
                    <td className="col-left cell-strong">{item.ptname}</td>
                    <td className="col-center">{item.age}</td>
                    <td className="col-left">{item.pttypename || '—'}</td>
                    <td className="col-center">
                      {item.authencode ? (
                        <span className="oral-badge success" title={item.authencode}>
                          {item.authencode}
                        </span>
                      ) : (
                        <span className="oral-badge neutral">ไม่มี</span>
                      )}
                    </td>
                    <td className="col-center">
                      {item.pdx ? (
                        <span className="oral-badge primary" title={item.sdx ? `ร่วม: ${item.sdx}` : undefined}>
                          {item.pdx}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="col-center">
                      {item.ops ? (
                        <span className="oral-badge neutral" title={item.ops}>
                          {item.ops}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="col-left" title={item.listname || ''}>
                      {item.listname || '—'}
                    </td>
                    <td className="col-center">
                      {item.isCompensated ? (
                        <span className="oral-badge success">
                          {item.status || 'ชดเชยแล้ว'}
                        </span>
                      ) : (
                        <span className="oral-badge warning">
                          {item.status || 'รอชดเชย'}
                        </span>
                      )}
                    </td>
                    <td className="col-center">
                      <div>{item.rep || '—'}</div>
                      <RcmSeamlessRepBadges row={item} />
                    </td>
                    <td className="col-right cell-strong">
                      <div>{formatMoney(item.compensated)}</div>
                      <RcmSeamlessSubAmount row={item} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 7. Pagination ── */}
        <div className="oral-pagination">
          <div className="oral-page-info">
            แสดงรายการที่{' '}
            <strong>
              {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, totalCount)}
            </strong>{' '}
            จากทั้งหมด <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ
          </div>

          <div className="oral-page-actions">
            <button
              type="button"
              className="oral-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="หน้าแรก"
            >
              หน้าแรก
            </button>
            <button
              type="button"
              className="oral-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold px-2">
              หน้า {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="oral-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="oral-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="หน้าสุดท้าย"
            >
              หน้าสุดท้าย
            </button>

            <select
              className="oral-select"
              style={{ minHeight: 38, padding: '0 30px 0 10px', marginLeft: 8 }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              aria-label="จำนวนรายการต่อหน้า"
            >
              <option value={25}>25 / หน้า</option>
              <option value={50}>50 / หน้า</option>
              <option value={100}>100 / หน้า</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── 8. Patient Visit Detail Modal ── */}
      {selectedItem && (
        <div
          className="oral-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="oral-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="oral-modal-header">
              <h2 className="oral-modal-title">
                รายละเอียดการรับบริการคัดกรองมะเร็งช่องปาก (VN: {selectedItem.vn})
              </h2>
              <button
                type="button"
                className="oral-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="oral-modal-tabs">
              <button
                type="button"
                className={`oral-modal-tab ${modalTab === 'summary' ? 'active' : ''}`}
                onClick={() => setModalTab('summary')}
              >
                <span>ข้อมูลบริการ & ชดเชย</span>
              </button>
              <button
                type="button"
                className={`oral-modal-tab ${modalTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setModalTab('clinical')}
              >
                <span>เวชระเบียนคลินิก (HOSxP)</span>
              </button>
            </div>

            <div className="oral-modal-body">
              {modalTab === 'summary' && (
                <div className="oral-modal-grid">
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">ชื่อ-สกุล</span>
                    <span className="oral-modal-val font-semibold">{selectedItem.ptname}</span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">HN / VN</span>
                    <span className="oral-modal-val">
                      {selectedItem.hn} / {selectedItem.vn}
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">เลขบัตรประชาชน</span>
                    <span className="oral-modal-val">{formatCid(selectedItem.cid)}</span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">อายุ / สัญชาติ</span>
                    <span className="oral-modal-val">
                      {selectedItem.age} ปี ({selectedItem.nation || 'ไทย'})
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">วันที่ & เวลาที่รับบริการ</span>
                    <span className="oral-modal-val">
                      {formatThaiDate(selectedItem.vstdate)} เวลา {selectedItem.vsttime || '—'}
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">แผนก / คลินิก</span>
                    <span className="oral-modal-val">
                      {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">สิทธิการรักษา</span>
                    <span className="oral-modal-val">{selectedItem.pttypename || '—'}</span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">ClaimCode:</span>
                    <span className="oral-modal-val font-semibold">
                      {selectedItem.authencode || 'ไม่มี Authen Code'}
                    </span>
                  </div>
                  <div className="oral-modal-item full-width">
                    <span className="oral-modal-label">การวินิจฉัยโรค (ICD-10)</span>
                    <span className="oral-modal-val">
                      วินิจฉัยหลัก (PDX): <strong>{selectedItem.pdx || '—'}</strong>
                      {selectedItem.sdx && <span> | วินิจฉัยร่วม (SDX): {selectedItem.sdx}</span>}
                    </span>
                  </div>
                  <div className="oral-modal-item full-width">
                    <span className="oral-modal-label">หัตถการ (ICD-9-CM)</span>
                    <span className="oral-modal-val">{selectedItem.ops || 'ไม่มีบันทึกหัตถการ'}</span>
                  </div>
                  <div className="oral-modal-item full-width">
                    <span className="oral-modal-label">รายการบริการ / ยา (ADP 90004)</span>
                    <span className="oral-modal-val">{selectedItem.listname || '—'}</span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">สถานะการชดเชย</span>
                    <span className="oral-modal-val font-semibold">
                      {selectedItem.status || (selectedItem.isCompensated ? 'ชดเชยแล้ว' : 'รอชดเชย')}
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">เลขที่ Rep / กองทุน</span>
                    <span className="oral-modal-val">
                      {selectedItem.rep || '—'} {selectedItem.fund ? `(${selectedItem.fund})` : ''}
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">ค่าบริการทั้งหมด</span>
                    <span className="oral-modal-val font-semibold">
                      {formatMoney(selectedItem.income)} บาท
                    </span>
                  </div>
                  <div className="oral-modal-item">
                    <span className="oral-modal-label">ยอดเงินชดเชยจริง</span>
                    <span className="oral-modal-val text-emerald-800 font-bold">
                      {formatMoney(selectedItem.compensated)} บาท
                    </span>
                  </div>
                </div>
              )}

              {modalTab === 'clinical' && (
                <div>
                  {clinicalLoading ? (
                    <div className="oral-loading-state">
                      <RefreshCw size={24} className="animate-spin text-emerald-700" />
                      <span>กำลังดึงข้อมูลเวชระเบียนคลินิกจาก HOSxP...</span>
                    </div>
                  ) : clinicalError ? (
                    <div className="oral-alert-banner" role="alert">
                      <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
                      <span>{clinicalError}</span>
                    </div>
                  ) : clinicalData ? (
                    <div className="oral-modal-grid">
                      <div className="oral-modal-item">
                        <span className="oral-modal-label">แพทย์ผู้ตรวจ</span>
                        <span className="oral-modal-val">
                          {clinicalData.diagnoses.find((d) => d.doctor_name)?.doctor_name || '—'}
                        </span>
                      </div>
                      <div className="oral-modal-item">
                        <span className="oral-modal-label">สัญญาณชีพ (Vital Signs)</span>
                        <span className="oral-modal-val">
                          BP: {clinicalData.screen?.bps || '—'}/{clinicalData.screen?.bpd || '—'} mmHg, PR:{' '}
                          {clinicalData.screen?.pulse || '—'} bpm
                        </span>
                      </div>
                      <div className="oral-modal-item full-width">
                        <span className="oral-modal-label">อาการสำคัญ (Chief Complaint)</span>
                        <span className="oral-modal-val">{clinicalData.screen?.cc || 'ไม่มีบันทึกอาการสำคัญ'}</span>
                      </div>
                      {clinicalData.screen?.pmh && (
                        <div className="oral-modal-item full-width">
                          <span className="oral-modal-label">ประวัติการเจ็บป่วยในอดีต / แพ้ยา (Past Medical History)</span>
                          <span className="oral-modal-val oral-pre-wrap">
                            {clinicalData.screen.pmh}
                          </span>
                        </div>
                      )}
                      <div className="oral-modal-item full-width">
                        <span className="oral-modal-label">ประวัติการเจ็บป่วยปัจจุบัน (Present Illness)</span>
                        <span className="oral-modal-val oral-pre-wrap">{clinicalData.screen?.hpi || '—'}</span>
                      </div>
                      <div className="oral-modal-item full-width">
                        <div className="oral-pe-header">
                          <span className="oral-modal-label">การตรวจร่างกาย (Physical Exam)</span>
                          {parsedPeSections.length > 0 && (
                            <div className="oral-pe-toggle-group" role="group" aria-label="รูปแบบการแสดงผลการตรวจร่างกาย">
                              <button
                                type="button"
                                className={`oral-pe-toggle-btn ${peViewMode === 'structured' ? 'active' : ''}`}
                                onClick={() => setPeViewMode('structured')}
                              >
                                จัดหมวดหมู่อ่านง่าย ({parsedPeSections.length} หมวด)
                              </button>
                              <button
                                type="button"
                                className={`oral-pe-toggle-btn ${peViewMode === 'raw' ? 'active' : ''}`}
                                onClick={() => setPeViewMode('raw')}
                              >
                                ข้อความต้นฉบับ
                              </button>
                            </div>
                          )}
                        </div>

                        {clinicalData.screen?.pe ? (
                          peViewMode === 'structured' && parsedPeSections.length > 0 ? (
                            <div className="oral-pe-sections-container">
                              {parsedPeSections.map((sec, idx) => (
                                <div key={idx} className="oral-pe-section-card">
                                  <div className="oral-pe-section-title-row">
                                    <h4 className="oral-pe-section-title">{sec.title}</h4>
                                    <span className={`oral-pe-badge ${sec.badgeClass}`}>{sec.badgeText}</span>
                                  </div>
                                  <ul className="oral-pe-item-list">
                                    {sec.items.map((item, iIdx) => (
                                      <li key={iIdx} className="oral-pe-item-line">
                                        {item.startsWith('- ') ? item.slice(2) : item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="oral-pe-raw-content">
                              {clinicalData.screen.pe}
                            </div>
                          )
                        ) : (
                          <span className="oral-modal-val">—</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="oral-empty-state">
                      <span>ไม่พบข้อมูลคลินิกเพิ่มเติมสำหรับ VN นี้</span>
                    </div>
                  )}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>

            <div className="oral-modal-footer">
              <button
                type="button"
                className="oral-btn-secondary"
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
