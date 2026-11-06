'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  FamilyPlanningItem,
  FamilyPlanningSummary,
  FamilyPlanningReportType,
  FamilyPlanningPatientType,
  FamilyPlanningCardFilter,
  FamilyPlanningSearchField,
  FamilyPlanningSortField,
  FamilyPlanningAdpMappingCheck,
} from '@/lib/clinical/rcmFamilyPlanningService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import './familyPlanning.css'

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

export interface FamilyPlanningClientProps {
  reportType: FamilyPlanningReportType // '9.3.1' | '9.3.2'
  apiEndpoint: string
  title: string
  subtitle: string
  adpCode: string
}

export default function FamilyPlanningReportClient({
  reportType,
  apiEndpoint,
  title,
  subtitle,
  adpCode,
}: FamilyPlanningClientProps) {
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
  const [ds1, setDs1] = useState<string>(`${curCalYear}-${String(curMonth).padStart(2, '0')}-01`)
  const [ds2, setDs2] = useState<string>(
    `${curCalYear}-${String(curMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )

  // Patient Type State: 'OPD' (default) | 'IPD'
  const [patientType, setPatientType] = useState<FamilyPlanningPatientType>('OPD')

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<FamilyPlanningCardFilter>('ALL')
  const [searchField, setSearchField] = useState<FamilyPlanningSearchField>('ALL')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<FamilyPlanningSortField>('vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FamilyPlanningItem[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [adpMapping, setAdpMapping] = useState<FamilyPlanningAdpMappingCheck>({
    isMapped: true,
    mappedCount: 0,
    adpCode,
    items: [],
  })
  const [summary, setSummary] = useState<FamilyPlanningSummary>({
    totalCases: 0,
    uniquePatients: 0,
    compensatedCases: 0,
    eclaimSentCases: 0,
    unsentCases: 0,
    compensationRate: 0,
    totalCompensated: 0,
    totalIncome: 0,
    errorDxCount: 0,
    errorDrugCount: 0,
    hasErrorCount: 0,
    withAuthenCount: 0,
    withoutAuthenCount: 0,
    authenRate: 0,
  })

  // Selected row for detail modal
  const [selectedItem, setSelectedItem] = useState<FamilyPlanningItem | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Debounce search input
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
    } else if (dateMode === 'monthly') {
      const ce = selectedBeYear - 543
      const mStr = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ce, selectedMonth, 0).getDate()
      setDs1(`${ce}-${mStr}-01`)
      setDs2(`${ce}-${mStr}-${String(lastDay).padStart(2, '0')}`)
    }
  }, [dateMode, selectedFiscalYear, selectedMonth, selectedBeYear])

  // Fetch Report Data
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true)
      setError(null)
      try {
        const query = new URLSearchParams({
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

        if (forceRefresh) {
          query.set('refresh', 'true')
        }

        const res = await fetch(`${apiEndpoint}?${query.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้')
        }

        const data = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) {
          setSummary(data.summary)
        }
        if (data.adpMapping) {
          setAdpMapping(data.adpMapping)
        }
      } catch (err: unknown) {
        const e = err as Error
        setError(e.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [apiEndpoint, ds1, ds2, patientType, cardFilter, searchField, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle Sort column click
  const handleSort = (field: FamilyPlanningSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Refresh Click
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData(true)
  }

  // Handle Export CSV
  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const query = new URLSearchParams({
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

      const res = await fetch(`${apiEndpoint}?${query.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกไฟล์ไม่สำเร็จ')
      }

      const rows: FamilyPlanningItem[] = json.data?.items || []
      if (rows.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก')
        return
      }

      // Build CSV Content
      const headers = [
        'ลำดับ',
        patientType === 'IPD' ? 'AN' : 'VN',
        'HN',
        'เลขประจำตัวประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ',
        patientType === 'IPD' ? 'วันที่รับรักษา' : 'วันที่รับบริการ',
        patientType === 'IPD' ? 'วันที่จำหน่าย' : 'เวลา',
        'สิทธิการรักษา',
        'Claim Code',
        'แผนก',
        'คลินิก',
        'อาการสำคัญ',
        'วินิจฉัย (Dx)',
        'หัตถการ (Op)',
        'รายการยา/บริการ',
        'ค่ารักษา (บาท)',
        'ชดเชย E-Claim',
        'ชดเชย Rep',
        'ชดเชย Invoice',
        'ยอดชดเชยรวม',
        'เลข Rep',
        'สถานะการเบิก',
        'ข้อผิดพลาด Dx',
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
        `"${r.errorDrug || ''}"`,
      ])

      const bom = '\uFEFF'
      const csvString = bom + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n')
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `FamilyPlanning_${reportType}_${patientType}_${ds1}_${ds2}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const e = err as Error
      alert(`เกิดข้อผิดพลาดในการส่งออก: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  // Copy to clipboard helper
  const copyText = (txt: string, fieldId: string) => {
    if (!txt) return
    navigator.clipboard.writeText(txt)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 1800)
  }

  return (
    <div className="fp-page">
      {/* 1. Header Area */}
      <div className="fp-header">
        <div className="fp-title-group">
          <div className="fp-title-badge">
            <ShieldCheck size={15} />
            <span>กองทุนบริการวางแผนครอบครัว · {reportType}</span>
          </div>
          <h1 className="fp-title">{title}</h1>
          <p className="fp-subtitle">{subtitle}</p>
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
            title="ส่งออกรายงานเป็นไฟล์ CSV"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก CSV'}</span>
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
              รายเดือน
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
                <span className="text-gray-400 font-medium">ถึง</span>
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
              <>
                <select
                  className="fp-select"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value))
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
                  className="fp-select"
                  value={selectedBeYear}
                  onChange={(e) => {
                    setSelectedBeYear(Number(e.target.value))
                    setCurrentPage(1)
                  }}
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
                className="fp-select"
                value={selectedFiscalYear}
                onChange={(e) => {
                  setSelectedFiscalYear(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Patient Type Switch (OPD vs IPD) */}
        <div className="fp-patient-type-wrapper">
          <span className="fp-patient-type-label">ประเภทผู้ป่วย:</span>
          <div className="fp-type-segments" role="group" aria-label="Patient Type">
            <button
              type="button"
              className={`fp-type-segment ${patientType === 'OPD' ? 'active-opd' : ''}`}
              onClick={() => {
                setPatientType('OPD')
                setCurrentPage(1)
              }}
            >
              <Stethoscope size={15} />
              <span>ผู้ป่วยนอก (OPD)</span>
            </button>
            <button
              type="button"
              className={`fp-type-segment ${patientType === 'IPD' ? 'active-ipd' : ''}`}
              onClick={() => {
                setPatientType('IPD')
                setCurrentPage(1)
              }}
            >
              <Building2 size={15} />
              <span>ผู้ป่วยใน (IPD)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. ADP Mapping Warning / Success Banner */}
      {!adpMapping.isMapped ? (
        <div className="fp-adp-banner unmapped" role="alert">
          <div className="fp-adp-banner-content">
            <AlertTriangle size={18} />
            <span>
              <strong>คุณยังไม่ได้ Map ADP Code:</strong> ระบบตรวจไม่พบรายการยาในตาราง{' '}
              <code>s_drugitems</code> ที่ผูกรหัส NHSO ADP <code>{adpCode}</code> กรุณาตรวจสอบการตั้งค่ารหัสยา
            </span>
          </div>
        </div>
      ) : (
        <div className="fp-adp-banner mapped">
          <div className="fp-adp-banner-content">
            <CheckCircle2 size={18} />
            <span>
              ระบบตรวจพบการ Map รหัส ADP <strong>{adpCode}</strong> จำนวน{' '}
              <strong>{adpMapping.mappedCount}</strong> รายการ:
              {adpMapping.items.map((i) => ` ${i.name} (${i.icode})`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* 4. Interactive Summary Cards (Clickable to Filter) */}
      <div className="fp-summary-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด */}
        <div
          className={`fp-card card-primary ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => {
            setCardFilter('ALL')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อแสดงรายการทั้งหมด"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ผู้รับบริการทั้งหมด</span>
            <div className="fp-card-icon">
              <Activity size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.totalCases.toLocaleString()}</div>
          <div className="fp-card-sub">
            {summary.uniquePatients.toLocaleString()} คน · รายรับ ฿{formatMoney(summary.totalIncome)}
          </div>
        </div>

        {/* Card 2: ได้รับชดเชยแล้ว */}
        <div
          className={`fp-card card-ok ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => {
            setCardFilter('COMPENSATED')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองเฉพาะรายการที่ได้รับชดเชยแล้ว (Invoice/Rep)"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ได้รับชดเชยแล้ว</span>
            <div className="fp-card-icon">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.compensatedCases.toLocaleString()}</div>
          <div className="fp-card-sub">
            {summary.compensationRate}% · รวม ฿{formatMoney(summary.totalCompensated)}
          </div>
        </div>

        {/* Card 3: ส่ง E-Claim แล้ว (รอชดเชย) */}
        <div
          className={`fp-card card-pending ${cardFilter === 'ECLAIM_SENT' ? 'is-active is-active-pending' : ''}`}
          onClick={() => {
            setCardFilter('ECLAIM_SENT')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองเฉพาะรายการที่ส่งเข้า E-Claim แล้ว"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ส่ง E-Claim แล้ว</span>
            <div className="fp-card-icon">
              <Clock size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.eclaimSentCases.toLocaleString()}</div>
          <div className="fp-card-sub">รอออก Invoice / Statement Rep</div>
        </div>

        {/* Card 4: ยังไม่ส่งเข้า E-Claim */}
        <div
          className={`fp-card card-pending ${cardFilter === 'UNSENT' ? 'is-active is-active-pending' : ''}`}
          onClick={() => {
            setCardFilter('UNSENT')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่ยังไม่ได้ส่งเข้าโปรแกรม E-Claim"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ยังไม่ส่ง E-Claim</span>
            <div className="fp-card-icon">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.unsentCases.toLocaleString()}</div>
          <div className="fp-card-sub">ต้องตรวจสอบและส่งออกเคลม</div>
        </div>

        {/* Card 5: ข้อผิดพลาดทั้งหมด */}
        <div
          className={`fp-card card-danger ${cardFilter === 'HAS_ERROR' ? 'is-active is-active-danger' : ''}`}
          onClick={() => {
            setCardFilter('HAS_ERROR')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่มีข้อผิดพลาด Dx หรือไม่พบค่าบริการ"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ข้อผิดพลาดทั้งหมด</span>
            <div className="fp-card-icon">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.hasErrorCount.toLocaleString()}</div>
          <div className="fp-card-sub">
            ไม่พบ Dx: {summary.errorDxCount} · ไม่พบยา: {summary.errorDrugCount}
          </div>
        </div>

        {/* Card 6: ไม่พบ Dx Z308 */}
        <div
          className={`fp-card card-danger ${cardFilter === 'ERROR_DX' ? 'is-active is-active-danger' : ''}`}
          onClick={() => {
            setCardFilter('ERROR_DX')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่ไม่พบการลงรหัส Dx Z308"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ไม่พบ Dx Z308</span>
            <div className="fp-card-icon">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.errorDxCount.toLocaleString()}</div>
          <div className="fp-card-sub">ต้องลงรหัส Z308 เพื่อเคลม</div>
        </div>

        {/* Card 7: ไม่พบค่าบริการ (ยา) */}
        <div
          className={`fp-card card-danger ${cardFilter === 'ERROR_DRUG' ? 'is-active is-active-danger' : ''}`}
          onClick={() => {
            setCardFilter('ERROR_DRUG')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่ไม่พบการสั่งจ่ายยา/ค่าบริการรหัส ADP"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">ไม่พบค่าบริการ ({adpCode})</span>
            <div className="fp-card-icon">
              <Pill size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.errorDrugCount.toLocaleString()}</div>
          <div className="fp-card-sub">ไม่พบรายการค่าบริการ ADP</div>
        </div>

        {/* Card 8: มี Authen Code */}
        <div
          className={`fp-card card-info ${cardFilter === 'WITH_AUTHEN' ? 'is-active' : ''}`}
          onClick={() => {
            setCardFilter('WITH_AUTHEN')
            setCurrentPage(1)
          }}
          title="คลิกเพื่อกรองรายการที่มี Authen Code"
        >
          <div className="fp-card-header">
            <span className="fp-card-title">มี Authen Code</span>
            <div className="fp-card-icon">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="fp-card-value">{summary.withAuthenCount.toLocaleString()}</div>
          <div className="fp-card-sub">
            {summary.authenRate}% · ไม่มี: {summary.withoutAuthenCount}
          </div>
        </div>
      </div>

      {/* 5. Toolbar: Search and Filter Chips */}
      <div className="fp-toolbar">
        <div className="fp-search-box">
          <select
            className="fp-search-field-select"
            value={searchField}
            onChange={(e) => {
              setSearchField(e.target.value as FamilyPlanningSearchField)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">ค้นหาทั้งหมด</option>
            <option value="HN">HN</option>
            <option value="CID">เลขบัตรประชาชน</option>
            <option value="PTNAME">ชื่อ-สกุล</option>
            <option value="VN">{patientType === 'IPD' ? 'AN' : 'VN'}</option>
            <option value="PTTYPE">สิทธิการรักษา</option>
            <option value="DEPARTMENT">แผนก/คลินิก</option>
            <option value="DX">รหัสวินิจฉัย (Dx)</option>
            <option value="DRUG">รายการยา/บริการ</option>
          </select>
          <Search size={16} className="text-gray-400 mr-2 shrink-0" />
          <input
            type="text"
            className="fp-search-input"
            placeholder={`ค้นหาในตาราง ${patientType}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="fp-clear-btn"
              onClick={() => setSearch('')}
              title="ล้างข้อความค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="fp-filter-chips">
          <button
            type="button"
            className={`fp-chip ${cardFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('ALL')
              setCurrentPage(1)
            }}
          >
            ทั้งหมด ({summary.totalCases})
          </button>
          <button
            type="button"
            className={`fp-chip ${cardFilter === 'COMPENSATED' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('COMPENSATED')
              setCurrentPage(1)
            }}
          >
            ชดเชยแล้ว ({summary.compensatedCases})
          </button>
          <button
            type="button"
            className={`fp-chip ${cardFilter === 'ECLAIM_SENT' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('ECLAIM_SENT')
              setCurrentPage(1)
            }}
          >
            ส่งเคลมแล้ว ({summary.eclaimSentCases})
          </button>
          <button
            type="button"
            className={`fp-chip ${cardFilter === 'UNSENT' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('UNSENT')
              setCurrentPage(1)
            }}
          >
            ยังไม่ส่งเคลม ({summary.unsentCases})
          </button>
          <button
            type="button"
            className={`fp-chip ${cardFilter === 'HAS_ERROR' ? 'active' : ''}`}
            onClick={() => {
              setCardFilter('HAS_ERROR')
              setCurrentPage(1)
            }}
          >
            พบข้อผิดพลาด ({summary.hasErrorCount})
          </button>
        </div>
      </div>

      {/* 6. Data Table */}
      <div className="fp-table-container">
        {loading ? (
          <div className="fp-empty-box">
            <RefreshCw size={28} className="animate-spin text-gray-400" />
            <p className="fp-empty-title">กำลังประมวลผลข้อมูล...</p>
            <p className="fp-empty-desc">
              ระบบกำลังเชื่อมโยงข้อมูล HOSxP, E-Claim, และ Statement Rep กองทุน
            </p>
          </div>
        ) : error ? (
          <div className="fp-empty-box text-red-600">
            <AlertTriangle size={32} />
            <p className="fp-empty-title">เกิดข้อผิดพลาด</p>
            <p className="fp-empty-desc">{error}</p>
            <button
              type="button"
              className="fp-btn fp-btn-outline mt-2"
              onClick={() => fetchData(true)}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="fp-empty-box">
            <Activity size={32} className="text-gray-300" />
            <p className="fp-empty-title">ไม่พบรายการข้อมูลตามเงื่อนไขที่เลือก</p>
            <p className="fp-empty-desc">
              กรุณาตรวจสอบการเลือกช่วงเวลา หรือลองเปลี่ยนตัวกรองและคำค้นหา
            </p>
          </div>
        ) : (
          <div className="fp-table-scroll">
            <table className="fp-table">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>ลำดับ</th>
                  <th className="sortable" onClick={() => handleSort('vstdate')}>
                    <span className="fp-th-content">
                      {patientType === 'IPD' ? 'วันที่รับรักษา' : 'วันที่รับบริการ'}
                      {sortBy === 'vstdate' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </span>
                  </th>
                  <th>{patientType === 'IPD' ? 'AN' : 'VN'}</th>
                  <th className="sortable" onClick={() => handleSort('hn')}>
                    <span className="fp-th-content">
                      HN
                      {sortBy === 'hn' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </span>
                  </th>
                  <th>เลขบัตรประชาชน</th>
                  <th className="sortable" onClick={() => handleSort('ptname')}>
                    <span className="fp-th-content">
                      ชื่อ-สกุล
                      {sortBy === 'ptname' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </span>
                  </th>
                  <th>เพศ/อายุ</th>
                  <th>สิทธิการรักษา</th>
                  <th>Authen Code</th>
                  <th>รหัสวินิจฉัย (Dx)</th>
                  <th>รายการยา / ค่าบริการ</th>
                  <th
                    className="sortable text-right"
                    onClick={() => handleSort('income')}
                    style={{ textAlign: 'right' }}
                  >
                    <span className="fp-th-content justify-end">
                      ค่ารักษา
                      {sortBy === 'income' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </span>
                  </th>
                  <th
                    className="sortable text-right"
                    onClick={() => handleSort('compensated')}
                    style={{ textAlign: 'right' }}
                  >
                    <span className="fp-th-content justify-end">
                      ชดเชย
                      {sortBy === 'compensated' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-40" />
                      )}
                    </span>
                  </th>
                  <th>สถานะการเบิก</th>
                  <th>ข้อผิดพลาด</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.vn}
                    className={row.hasError ? 'has-error' : ''}
                    onClick={() => setSelectedItem(row)}
                  >
                    <td style={{ textAlign: 'center' }} className="fp-mono text-gray-500">
                      {row.no}
                    </td>
                    <td>
                      <div className="font-medium text-gray-900">{formatThaiDate(row.vstdate)}</div>
                      <div className="text-xs text-gray-500 fp-mono">
                        {patientType === 'IPD' && row.dchdate
                          ? `จำหน่าย: ${formatThaiDate(row.dchdate)}`
                          : row.vsttime}
                      </div>
                    </td>
                    <td className="fp-mono text-xs text-gray-600 font-medium">
                      {row.vn}
                    </td>
                    <td>
                      <div className="fp-mono font-bold text-gray-900">{row.hn}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="fp-mono text-xs text-gray-700">
                          {formatCidDisplay(row.cid)}
                        </span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-700 p-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyText(row.cid, `cid_${row.vn}`)
                          }}
                          title="คัดลอกเลขบัตรประชาชน"
                        >
                          {copiedField === `cid_${row.vn}` ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-gray-900">{row.ptname}</div>
                      <div className="text-xs text-gray-500">
                        {row.department || row.clinic || '—'}
                      </div>
                    </td>
                    <td className="text-xs text-gray-700">
                      {row.sex} · <span className="fp-mono">{row.age}</span> ปี
                    </td>
                    <td className="text-xs text-gray-700 max-w-[140px] truncate" title={row.pttypename}>
                      {row.pttypename}
                    </td>
                    <td>
                      {row.claimcode ? (
                        <span className="fp-badge fp-badge-info fp-mono">{row.claimcode}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 max-w-[160px]">
                        {row.dx ? (
                          <span
                            className={`text-xs font-medium fp-mono ${
                              /Z308/i.test(row.dx) ? 'text-gray-900' : 'text-red-600 font-bold'
                            }`}
                            title={row.dx}
                          >
                            {row.dx}
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 font-semibold">ไม่มี Dx</span>
                        )}
                        {row.op && (
                          <span className="text-[11px] text-gray-500 fp-mono truncate" title={row.op}>
                            Op: {row.op}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[200px]">
                      {row.drug ? (
                        <div className="text-xs text-gray-800 font-medium truncate" title={row.drug}>
                          {row.drug}
                        </div>
                      ) : (
                        <span className="text-xs text-red-600 font-bold">ไม่พบค่าบริการ ADP</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="fp-mono text-gray-800 font-medium">
                      ฿{formatMoney(row.income)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="fp-mono">
                      {row.compensated > 0 ? (
                        <span className="font-bold text-emerald-700">฿{formatMoney(row.compensated)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span
                          className={`fp-badge ${
                            row.status.includes('NHSO')
                              ? 'fp-badge-ok'
                              : row.status.includes('Rep')
                              ? 'fp-badge-ok'
                              : row.status.includes('ยังไม่ส่ง')
                              ? 'fp-badge-pending'
                              : 'fp-badge-info'
                          }`}
                        >
                          {row.status}
                        </span>
                        {row.rep && (
                          <span className="text-[11px] text-gray-500 fp-mono">
                            Rep: {row.rep}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {row.errorDx && (
                          <span className="fp-error-tag">
                            <AlertCircle size={11} />
                            {row.errorDx}
                          </span>
                        )}
                        {row.errorDrug && (
                          <span className="fp-error-tag">
                            <AlertCircle size={11} />
                            {row.errorDrug}
                          </span>
                        )}
                        {!row.hasError && (
                          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            สมบูรณ์
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. Pagination Bar */}
        {!loading && items.length > 0 && (
          <div className="fp-pagination">
            <div className="fp-pagination-info">
              <span>
                แสดงรายการที่ <strong>{(currentPage - 1) * pageSize + 1}</strong> ถึง{' '}
                <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> จากทั้งหมด{' '}
                <strong>{totalCount.toLocaleString()}</strong> รายการ
              </span>
              <div className="flex items-center gap-2">
                <span>แสดงหน้าละ:</span>
                <select
                  className="fp-select text-xs py-1"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            <div className="fp-pagination-nav">
              <button
                type="button"
                className="fp-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 fp-mono font-medium text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="fp-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 8. Patient Visit Audit Inspection Modal */}
      {selectedItem && (
        <div
          className="fp-modal-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="fp-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fp-modal-header">
              <div className="fp-modal-title-group">
                <div className="flex items-center gap-2">
                  <span className="fp-badge fp-badge-info">
                    {selectedItem.patientType}
                  </span>
                  <span className="text-xs text-gray-500 fp-mono">
                    {patientType === 'IPD' ? `AN: ${selectedItem.vn}` : `VN: ${selectedItem.vn}`}
                  </span>
                </div>
                <h3 className="fp-modal-title">
                  รายละเอียดการรับบริการ · {selectedItem.ptname}
                </h3>
              </div>
              <button
                type="button"
                className="fp-btn fp-btn-outline p-2 min-h-0 h-8 w-8"
                onClick={() => setSelectedItem(null)}
                aria-label="Close modal"
                title="ปิดหน้าต่าง"
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-modal-body">
              {/* Patient Basic Info */}
              <div className="fp-modal-section">
                <div className="fp-modal-section-title">ข้อมูลทั่วไปของผู้ป่วย</div>
                <div className="fp-modal-grid">
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">HN:</span>
                    <span className="fp-modal-val fp-mono">{selectedItem.hn}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">เลขประจำตัวประชาชน:</span>
                    <span className="fp-modal-val fp-mono">{formatCidDisplay(selectedItem.cid)}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">เพศ / อายุ:</span>
                    <span className="fp-modal-val">
                      {selectedItem.sex} · {selectedItem.age} ปี
                    </span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">สิทธิการรักษา:</span>
                    <span className="fp-modal-val">{selectedItem.pttypename}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">Authen / Claim Code:</span>
                    <span className="fp-modal-val fp-mono">
                      {selectedItem.claimcode || '—'}
                    </span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">แผนก / คลินิก:</span>
                    <span className="fp-modal-val">
                      {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clinical Details */}
              <div className="fp-modal-section">
                <div className="fp-modal-section-title">ข้อมูลทางการแพทย์ & การลงรหัส</div>
                <div className="flex flex-col gap-3">
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">อาการสำคัญ (CC):</span>
                    <span className="fp-modal-val text-gray-800">
                      {selectedItem.cc || '—'}
                    </span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">รหัสการวินิจฉัย (ICD-10):</span>
                    <span className="fp-modal-val fp-mono text-gray-900">
                      {selectedItem.dx || '—'}
                    </span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">รหัสหัตถการ (ICD-9):</span>
                    <span className="fp-modal-val fp-mono text-gray-700">
                      {selectedItem.op || '—'}
                    </span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">รายการยา / ค่าบริการ ADP ({adpCode}):</span>
                    <span className="fp-modal-val text-emerald-800 font-bold">
                      {selectedItem.drug || 'ไม่พบรายการค่าบริการ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reimbursement & Claims */}
              <div className="fp-modal-section">
                <div className="fp-modal-section-title">สถานะการเบิกชดเชยค่าบริการ</div>
                <div className="fp-modal-grid">
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">ค่ารักษาพยาบาล (HOSxP):</span>
                    <span className="fp-modal-val fp-mono">฿{formatMoney(selectedItem.income)}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">ชดเชย E-Claim:</span>
                    <span className="fp-modal-val fp-mono">฿{formatMoney(selectedItem.money_eclaim)}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">ชดเชย Rep:</span>
                    <span className="fp-modal-val fp-mono">฿{formatMoney(selectedItem.money_rep)}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">ชดเชย Invoice:</span>
                    <span className="fp-modal-val fp-mono">฿{formatMoney(selectedItem.money_invoice)}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">สถานะปัจจุบัน:</span>
                    <span className="fp-modal-val">{selectedItem.status}</span>
                  </div>
                  <div className="fp-modal-field">
                    <span className="fp-modal-label">เลขที่ Rep:</span>
                    <span className="fp-modal-val fp-mono">{selectedItem.rep || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="fp-modal-footer">
              <button
                type="button"
                className="fp-btn fp-btn-primary"
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
