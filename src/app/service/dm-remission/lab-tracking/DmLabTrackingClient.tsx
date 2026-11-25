'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileOutput,
  Pill,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { getCurrentThaiFiscalYear } from '@/lib/clinical/dmRemissionDomain'
import { formatThaiBuddhistDateTime, formatThaiDate } from '@/lib/formatters'
import {
  DM_ANTIDIABETIC_DRUGS,
  type DmLabCohortStatusFilter,
  type DmLabDiagScope,
  type DmLabDrugScope,
  type DmLabPatientTimeline,
  type DmLabTrackingRecord,
  type DmLabTrackingResult,
  type DmLabUcScope,
} from '@/lib/clinical/dmRemissionLabTypes'
import DmLabPatientModal from './DmLabPatientModal'

interface DmLabTrackingClientProps {
  userRole: string
  initialData?: DmLabTrackingResult | null
  initialError?: string | null
}

const MAX_TIMELINE_CACHE_ENTRIES = 50
const A1C_LIMIT_OPTIONS = [5.7, 6.0, 6.5, 7.0] as const

const UC_SCOPE_LABELS: Record<DmLabUcScope, string> = {
  visit: 'สิทธิ์ UC ณ Visit ที่เจาะแล็บ (แนะนำ)',
  current: 'สิทธิ์ UC ปัจจุบันในทะเบียนผู้ป่วย',
  either: 'สิทธิ์ UC ณ Visit หรือปัจจุบัน',
}

const DIAG_SCOPE_LABELS: Record<DmLabDiagScope, string> = {
  ever: 'เคยมีวินิจฉัย E11 ใน HOSxP',
  in_fy: 'มีวินิจฉัย E11 ในปีงบประมาณนี้',
  same_vn: 'มีวินิจฉัย E11 ใน Visit ที่เจาะแล็บ',
}

const DRUG_SCOPE_LABELS: Record<DmLabDrugScope, string> = {
  fy: 'ไม่มีสั่งยาเบาหวานตลอดปีงบประมาณ',
  '90d_before_lab': 'ไม่มีสั่งยาเบาหวาน 90 วันก่อนวันเจาะ',
  visit_only: 'ไม่มีสั่งยาเบาหวานเฉพาะ Visit ที่เจาะ',
  all: 'แสดงทั้งหมด (รวมผู้ป่วยที่มียาเบาหวาน)',
}

function pctOf(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function isInDmRemissionCohortRow(row: DmLabTrackingRecord): boolean {
  return row.inDmRemissionCohort ?? (row.inCohortRegistry && !row.inT1dmRegistry)
}

function formatDmRemissionText(row: DmLabTrackingRecord, forExport = false): string {
  if (!isInDmRemissionCohortRow(row)) return 'ยังไม่เข้าทะเบียน'
  const fallback = forExport ? 'ยังไม่ระบุ' : 'รอสรุป'
  return `อยู่ในทะเบียน (${row.cohortRemissionStatus || fallback})`
}

function formatT1dmRegistryText(row: DmLabTrackingRecord): string {
  if (!row.inT1dmRegistry) return 'ยังไม่ลงทะเบียน'
  return row.t1dmRegistryType
    ? `ลงทะเบียนแล้ว (${row.t1dmRegistryType})`
    : 'ลงทะเบียนแล้ว'
}

export default function DmLabTrackingClient({
  userRole: _userRole,
  initialData,
  initialError,
}: DmLabTrackingClientProps) {
  const hasInitialProps = initialData !== undefined || initialError !== undefined

  const [fiscalYear, setFiscalYear] = useState<number>(
    () => initialData?.fiscalYear ?? getCurrentThaiFiscalYear()
  )
  const [a1cMax, setA1cMax] = useState<number>(6.5)
  const [ucScope, setUcScope] = useState<DmLabUcScope>('visit')
  const [diagScope, setDiagScope] = useState<DmLabDiagScope>('ever')
  const [drugScope, setDrugScope] = useState<DmLabDrugScope>('fy')
  const [cohortStatus, setCohortStatus] = useState<DmLabCohortStatusFilter>('all')
  const [tambon, setTambon] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [includeDeceased, setIncludeDeceased] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)

  const [showRulesPanel, setShowRulesPanel] = useState<boolean>(false)
  const [showDrugList, setShowDrugList] = useState<boolean>(false)

  const [data, setData] = useState<DmLabTrackingResult | null>(initialData ?? null)
  const [loading, setLoading] = useState<boolean>(!hasInitialProps)
  const [exporting, setExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  const [selectedRecord, setSelectedRecord] = useState<DmLabTrackingRecord | null>(null)
  const [timeline, setTimeline] = useState<DmLabPatientTimeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  const listAbortRef = useRef<AbortController | null>(null)
  const timelineAbortRef = useRef<AbortController | null>(null)
  const timelineCacheRef = useRef<Map<string, DmLabPatientTimeline>>(new Map())
  const skipInitialFetchRef = useRef<boolean>(hasInitialProps)

  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === debouncedSearch) return
    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmed)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput, debouncedSearch])

  const buildQueryParams = useCallback(
    (overrides?: { exportAll?: boolean; refresh?: boolean; targetPage?: number }) => {
      const params = new URLSearchParams()
      params.set('fiscalYear', String(fiscalYear))
      params.set('a1cMax', String(a1cMax))
      params.set('ucScope', ucScope)
      params.set('diagScope', diagScope)
      params.set('drugScope', drugScope)
      params.set('cohortStatus', cohortStatus)
      if (tambon) params.set('tambon', tambon)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (includeDeceased) params.set('includeDeceased', 'true')
      params.set('page', String(overrides?.targetPage ?? page))
      if (overrides?.exportAll) params.set('exportAll', 'true')
      if (overrides?.refresh) params.set('refresh', 'true')
      return params
    },
    [
      fiscalYear,
      a1cMax,
      ucScope,
      diagScope,
      drugScope,
      cohortStatus,
      tambon,
      debouncedSearch,
      includeDeceased,
      page,
    ]
  )

  const fetchLabTracking = useCallback(
    async (options?: { refresh?: boolean }) => {
      listAbortRef.current?.abort()
      const controller = new AbortController()
      listAbortRef.current = controller

      setLoading(true)
      setError(null)
      try {
        const params = buildQueryParams({ refresh: options?.refresh })
        const res = await fetch(`/api/service/dm-remission/lab-tracking?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'ไม่สามารถดึงข้อมูลติดตามการเจาะ HbA1c ได้')
        }
        const result = json.data as DmLabTrackingResult
        setData(result)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ')
      } finally {
        if (listAbortRef.current === controller) {
          setLoading(false)
        }
      }
    },
    [buildQueryParams]
  )

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false
      return
    }
    void fetchLabTracking()
    return () => {
      listAbortRef.current?.abort()
    }
  }, [fetchLabTracking])

  const handleOpenTimeline = async (record: DmLabTrackingRecord) => {
    setSelectedRecord(record)
    setTimelineError(null)

    const cached = timelineCacheRef.current.get(record.hn)
    if (cached) {
      // Refresh LRU insertion order
      timelineCacheRef.current.delete(record.hn)
      timelineCacheRef.current.set(record.hn, cached)
      setTimeline(cached)
      setTimelineLoading(false)
      return
    }

    timelineAbortRef.current?.abort()
    const controller = new AbortController()
    timelineAbortRef.current = controller

    setTimeline(null)
    setTimelineLoading(true)
    try {
      const res = await fetch(
        `/api/service/dm-remission/lab-tracking/${encodeURIComponent(record.hn)}`,
        {
          cache: 'no-store',
          signal: controller.signal,
        }
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถดึงประวัติรายบุคคลได้')
      }
      const fetched = json.data as DmLabPatientTimeline
      if (timelineCacheRef.current.size >= MAX_TIMELINE_CACHE_ENTRIES) {
        const oldestKey = timelineCacheRef.current.keys().next().value
        if (oldestKey !== undefined) {
          timelineCacheRef.current.delete(oldestKey)
        }
      }
      timelineCacheRef.current.set(record.hn, fetched)
      setTimeline(fetched)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setTimelineError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลรายบุคคล')
    } finally {
      if (timelineAbortRef.current === controller) {
        setTimelineLoading(false)
      }
    }
  }

  const handleCloseTimeline = useCallback(() => {
    timelineAbortRef.current?.abort()
    setSelectedRecord(null)
    setTimeline(null)
    setTimelineError(null)
    setTimelineLoading(false)
  }, [])

  const handleExportExcel = async () => {
    if (!data || data.summary.totalEligible === 0) return
    setExporting(true)
    setError(null)
    try {
      const params = buildQueryParams({ exportAll: true, targetPage: 1 })
      const res = await fetch(`/api/service/dm-remission/lab-tracking?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถเตรียมข้อมูลส่งออก Excel ได้')
      }
      const exportResult = json.data as DmLabTrackingResult

      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'โรงพยาบาลเถิน (Thoen Hospital)'
      workbook.created = new Date()
      const sheet = workbook.addWorksheet(`Lab_Tracking_${exportResult.fiscalYear}`, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      })

      sheet.columns = [
        { header: 'ลำดับ', key: 'index', width: 8 },
        { header: 'HN', key: 'hn', width: 12 },
        { header: 'เลขบัตรประชาชน', key: 'cid', width: 18 },
        { header: 'ชื่อ-นามสกุล', key: 'patientName', width: 24 },
        { header: 'อายุ (ปี)', key: 'ageYears', width: 10 },
        { header: 'เพศ', key: 'sexLabel', width: 8 },
        { header: 'วันเจาะ HbA1c ล่าสุด', key: 'visitDate', width: 16 },
        { header: 'HbA1c ล่าสุด (%)', key: 'latestA1c', width: 14 },
        { header: 'จำนวนครั้งในปีงบ', key: 'a1cTestCount', width: 14 },
        { header: 'HbA1c ก่อนหน้า (%)', key: 'prevA1c', width: 15 },
        { header: 'สิทธิ์ ณ Visit', key: 'visitPttypeName', width: 28 },
        { header: 'รหัส E11 ล่าสุด', key: 'lastE11Icd10', width: 14 },
        { header: 'วันวินิจฉัย E11 ล่าสุด', key: 'lastE11Date', width: 18 },
        { header: 'ยาเบาหวานในปีงบ', key: 'dmDrugs', width: 28 },
        { header: 'ตำบล', key: 'tambonName', width: 16 },
        { header: 'หมู่บ้าน', key: 'villageName', width: 18 },
        { header: 'ทะเบียน DM Remission', key: 'cohortStatus', width: 24 },
        { header: 'ทะเบียน DM (T1DM/GDM/PDM)', key: 't1dmStatus', width: 26 },
      ]

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D7446' },
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

      exportResult.items.forEach((row, idx) => {
        sheet.addRow({
          index: idx + 1,
          hn: row.hn,
          cid: row.cid || '-',
          patientName: row.patientName,
          ageYears: row.ageYears ?? '-',
          sexLabel: row.sexLabel ?? '-',
          visitDate: formatThaiDate(row.visitDate),
          latestA1c: row.latestA1c,
          a1cTestCount: row.a1cTestCount,
          prevA1c: row.prevA1c ?? '-',
          visitPttypeName: row.visitPttypeName || row.visitPttypeCode || '-',
          lastE11Icd10: row.lastE11Icd10 || '-',
          lastE11Date: row.lastE11Date ? formatThaiDate(row.lastE11Date) : '-',
          dmDrugs:
            row.dmDrugsInFy.length > 0 ? row.dmDrugsInFy.join(', ') : 'ไม่พบคำสั่งยาในปีงบ',
          tambonName: row.tambonName || '-',
          villageName: row.villageName
            ? `${row.villageName}${row.villageMoo ? ` ม.${row.villageMoo}` : ''}`
            : '-',
          cohortStatus: formatDmRemissionText(row, true),
          t1dmStatus: formatT1dmRegistryText(row),
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dm-lab-tracking-fy${exportResult.fiscalYear}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExporting(false)
    }
  }

  const handleResetFilters = () => {
    setA1cMax(6.5)
    setUcScope('visit')
    setDiagScope('ever')
    setDrugScope('fy')
    setCohortStatus('all')
    setTambon('')
    setSearchInput('')
    setDebouncedSearch('')
    setIncludeDeceased(false)
    setPage(1)
  }

  const hasCustomFilters =
    a1cMax !== 6.5 ||
    ucScope !== 'visit' ||
    diagScope !== 'ever' ||
    drugScope !== 'fy' ||
    cohortStatus !== 'all' ||
    tambon !== '' ||
    debouncedSearch !== '' ||
    includeDeceased

  const activeFy = fiscalYear ?? data?.fiscalYear ?? null
  const availableFys = data?.availableFiscalYears ?? (activeFy ? [activeFy] : [])
  const availableTambons = data?.availableTambons ?? []
  const summary = data?.summary
  const funnel = summary?.funnel
  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, pageSize: 50, totalItems: 0, totalPages: 1 }

  const funnelSteps = funnel
    ? [
        {
          step: 1,
          label: `ตรวจ HbA1c ยืนยันผลในปีงบประมาณ ${data?.fiscalYear ?? ''}`,
          count: funnel.totalA1cTested,
          percent: 100,
          isFinal: false,
        },
        {
          step: 2,
          label: `ผล HbA1c ล่าสุด <= ${a1cMax.toFixed(1)}%`,
          count: funnel.a1cUnderLimit,
          percent:
            funnel.totalA1cTested > 0
              ? (funnel.a1cUnderLimit / funnel.totalA1cTested) * 100
              : 0,
          isFinal: false,
        },
        {
          step: 3,
          label: `สิทธิ์ UC (${ucScope === 'visit' ? 'ณ Visit ที่เจาะ' : ucScope === 'current' ? 'สิทธิ์ปัจจุบัน' : 'อย่างใดอย่างหนึ่ง'})`,
          count: funnel.ucEligible,
          percent:
            funnel.totalA1cTested > 0 ? (funnel.ucEligible / funnel.totalA1cTested) * 100 : 0,
          isFinal: false,
        },
        {
          step: 4,
          label: `มีรหัสวินิจฉัย E11 (${diagScope === 'ever' ? 'ประวัติทั้งหมด' : diagScope === 'in_fy' ? 'ในปีงบ' : 'Visit เดียวกัน'})`,
          count: funnel.e11Diagnosed,
          percent:
            funnel.totalA1cTested > 0
              ? (funnel.e11Diagnosed / funnel.totalA1cTested) * 100
              : 0,
          isFinal: false,
        },
        {
          step: 5,
          label:
            drugScope === 'all'
              ? 'รวมทั้งหมดตามเงื่อนไขสิทธิ์และ E11'
              : `ไม่พบคำสั่งยาเบาหวาน (${drugScope === 'fy' ? 'ตลอดปีงบ' : drugScope === '90d_before_lab' ? '90 วันก่อนเจาะ' : 'เฉพาะ Visit ที่เจาะ'})`,
          count: funnel.noDmDrugs,
          percent:
            funnel.totalA1cTested > 0 ? (funnel.noDmDrugs / funnel.totalA1cTested) * 100 : 0,
          isFinal: true,
        },
      ]
    : []

  const pageStart =
    pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.totalItems)

  return (
    <div className="dmltPage">
      <div className="dmltContainer">
        <header className="dmltHeader">
          <div>
            <Link href="/service/dm-remission" className="dmltBackLink">
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span>กลับหน้าทะเบียน DM Remission</span>
            </Link>
            <div className="dmltTitleRow">
              <h1 className="dmltTitle">ติดตามการเจาะ HbA1c ผู้ป่วยเบาหวาน</h1>
              <span className="dmltBadge">
                <span className="dmltDot" aria-hidden="true" />
                {activeFy !== null ? `ปีงบประมาณ ${activeFy}` : 'กำลังโหลด'}
              </span>
            </div>
            <p className="dmltSubtitle">
              คัดกรองผู้ป่วยสิทธิ์ UC วินิจฉัย E11 ที่ผล HbA1c ล่าสุด &lt;= {a1cMax.toFixed(1)}%
              และไม่พบการสั่งยาเบาหวาน แยกปีงบตามวันที่เจาะ Lab ใน HOSxP
            </p>
          </div>

          <div className="dmltHeaderActions">
            <button
              type="button"
              className="dmltBtn"
              onClick={() => void fetchLabTracking({ refresh: true })}
              disabled={loading}
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              รีเฟรชข้อมูล
            </button>
            <button
              type="button"
              className="dmltBtn dmltBtnPrimary"
              onClick={() => void handleExportExcel()}
              disabled={exporting || !summary || summary.totalEligible === 0}
            >
              <FileOutput size={16} strokeWidth={1.5} />
              {exporting ? 'กำลังส่งออก' : 'ส่งออก Excel'}
            </button>
          </div>
        </header>

        {error && <div className="dmltAlert dmltAlertError">{error}</div>}

        {summary && (
          <>
            <section className="dmltKpiGrid" aria-label="สรุปจำนวนผู้ป่วยที่ผ่านเงื่อนไข">
              <div className="dmltKpiCard">
                <span className="dmltKpiLabel">ผ่านเกณฑ์คัดกรอง (ตามตัวกรอง)</span>
                <span className="dmltKpiValue dmltKpiValueAccent">
                  {summary.totalEligible.toLocaleString()} ราย
                </span>
                <span className="dmltKpiMeta">
                  จากผู้ตรวจ HbA1c ในปีงบทั้งหมด {summary.funnel.totalA1cTested.toLocaleString()} ราย
                </span>
              </div>

              <div className="dmltKpiCard">
                <span className="dmltKpiLabel">ค่า HbA1c เฉลี่ย / มัธยฐาน</span>
                <span className="dmltKpiValue">
                  {summary.avgLatestA1c !== null ? `${summary.avgLatestA1c.toFixed(2)}%` : '—'}
                </span>
                <span className="dmltKpiMeta">
                  มัธยฐาน{' '}
                  {summary.medianLatestA1c !== null
                    ? `${summary.medianLatestA1c.toFixed(2)}%`
                    : '—'}{' '}
                  · ตรวจซ้ำปีงบนี้ {summary.repeatTestedCount.toLocaleString()} ราย
                </span>
              </div>

              <div className="dmltKpiCard">
                <span className="dmltKpiLabel">ยังไม่เข้าทะเบียนใดเลย</span>
                <span className="dmltKpiValue">
                  {summary.unregisteredCount.toLocaleString()} ราย
                </span>
                <span className="dmltKpiMeta">
                  คิดเป็น {pctOf(summary.unregisteredCount, summary.totalEligible)} ของกลุ่มที่แสดง
                </span>
              </div>

              <div className="dmltKpiCard">
                <span className="dmltKpiLabel">อยู่ในทะเบียนแล้ว</span>
                <span className="dmltKpiValue">
                  {summary.registeredCount.toLocaleString()} ราย
                </span>
                <span className="dmltKpiMeta">
                  DM Remission {(summary.dmRemissionCount ?? 0).toLocaleString()} · ทะเบียน DM{' '}
                  {(summary.t1dmRegistryCount ?? 0).toLocaleString()} · ทั้งคู่{' '}
                  {(summary.bothRegistriesCount ?? 0).toLocaleString()}
                </span>
              </div>
            </section>

            <section className="dmltVisualGrid" aria-label="ลำดับการคัดกรองและสัดส่วนค่า HbA1c">
              <div className="dmltCard">
                <div className="dmltCardHeader">
                  <h2 className="dmltCardTitle">ลำดับการคัดกรองจาก HOSxP</h2>
                  <span className="dmltCardSub">
                    อัปเดตเมื่อ {data ? formatThaiBuddhistDateTime(data.fetchedAt) : '—'}
                  </span>
                </div>
                <div className="dmltFunnelList">
                  {funnelSteps.map((step) => (
                    <div key={step.step} className="dmltFunnelRow">
                      <div className="dmltFunnelRowHead">
                        <span className="dmltFunnelLabel">
                          <span
                            className={`dmltStepNum ${step.isFinal ? 'dmltStepNumActive' : ''}`}
                          >
                            {step.step}
                          </span>
                          <span>{step.label}</span>
                        </span>
                        <span className="dmltFunnelMetric">
                          <strong>{step.count.toLocaleString()}</strong> ราย (
                          {step.percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="dmltBarTrack">
                        <div
                          className={`dmltBarFill ${step.isFinal ? 'dmltBarFillAccent' : ''}`}
                          style={{ width: `${Math.max(step.count > 0 ? 1.5 : 0, Math.min(100, step.percent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {funnel && (
                  <div className="dmltFunnelFooter">
                    <span>
                      กลุ่มผ่านเกณฑ์ทั้งหมด <strong>{funnel.noDmDrugs.toLocaleString()}</strong> ราย
                    </span>
                    <span>
                      อยู่ในทะเบียนแล้ว {funnel.registeredInCohort.toLocaleString()} ราย ·
                      รอติดตามเพิ่ม {funnel.unregisteredCandidates.toLocaleString()} ราย
                    </span>
                  </div>
                )}
              </div>

              <div className="dmltCard">
                <div className="dmltCardHeader">
                  <h2 className="dmltCardTitle">ช่วงระดับ HbA1c และตำบล</h2>
                  <span className="dmltCardSub">{summary.totalEligible.toLocaleString()} ราย</span>
                </div>
                <div className="dmltBandList">
                  {summary.a1cBands.map((band) => (
                    <div key={band.key} className="dmltBandRow">
                      <div className="dmltBandHead">
                        <span>{band.label}</span>
                        <span>
                          {band.count.toLocaleString()} ({band.percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="dmltBarTrack">
                        <div
                          className="dmltBarFill dmltBarFillAccent"
                          style={{
                            width: `${Math.max(band.count > 0 ? 2 : 0, Math.min(100, band.percent))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <hr className="dmltDivider" />

                <div className="dmltCardSub" style={{ marginBottom: '0.5rem' }}>
                  ตำบลที่มีผู้ผ่านเกณฑ์มากที่สุด (คลิกเพื่อกรอง)
                </div>
                <div className="dmltTambonChips">
                  {summary.byTambon.slice(0, 6).map((item) => {
                    const isActive = tambon === item.tambonName
                    return (
                      <button
                        key={item.tambonName}
                        type="button"
                        className={`dmltChip ${isActive ? 'dmltChipActive' : ''}`}
                        onClick={() => {
                          setTambon(isActive ? '' : item.tambonName)
                          setPage(1)
                        }}
                      >
                        <span>{item.tambonName}</span>
                        <strong>{item.count}</strong>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        <section className="dmltControlsCard" aria-label="ตัวกรองและเงื่อนไขทางคลินิก">
          <div className="dmltFilterRow">
            <select
              aria-label="เลือกปีงบประมาณจากวันที่เจาะ Lab"
              className="dmltSelect"
              value={activeFy !== null ? String(activeFy) : ''}
              disabled={availableFys.length === 0}
              onChange={(e) => {
                setFiscalYear(Number(e.target.value))
                setPage(1)
              }}
            >
              {availableFys.map((fy) => (
                <option key={fy} value={String(fy)}>
                  ปีงบประมาณ {fy}
                </option>
              ))}
            </select>

            <select
              aria-label="กำหนดเกณฑ์ HbA1c สูงสุด"
              className="dmltSelect"
              value={String(a1cMax)}
              onChange={(e) => {
                setA1cMax(Number(e.target.value))
                setPage(1)
              }}
            >
              {A1C_LIMIT_OPTIONS.map((limit) => (
                <option key={limit} value={String(limit)}>
                  HbA1c &lt;= {limit.toFixed(1)}%
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตามสถานะทะเบียน"
              className="dmltSelect"
              value={cohortStatus}
              onChange={(e) => {
                setCohortStatus(e.target.value as DmLabCohortStatusFilter)
                setPage(1)
              }}
            >
              <option value="all">ทุกสถานะทะเบียน</option>
              <option value="unregistered">ยังไม่เข้าทะเบียนใดเลย</option>
              <option value="registered">อยู่ในทะเบียนแล้ว (อย่างน้อย 1 แหล่ง)</option>
              <option value="dm_remission">ทะเบียน DM Remission โรงพยาบาลเถิน</option>
              <option value="t1dm">ทะเบียน DM (T1_T2DM/GDM/PDM)</option>
              <option value="both">มีชื่อในทั้ง 2 ทะเบียน</option>
            </select>

            <select
              aria-label="กรองตามตำบล"
              className="dmltSelect"
              value={tambon}
              onChange={(e) => {
                setTambon(e.target.value)
                setPage(1)
              }}
            >
              <option value="">ทุกตำบล ({availableTambons.length})</option>
              {availableTambons.map((t) => (
                <option key={t} value={t}>
                  ต.{t}
                </option>
              ))}
            </select>

            <div className="dmltSearchWrap">
              <Search size={16} strokeWidth={1.5} className="dmltSearchIcon" />
              <input
                type="text"
                aria-label="ค้นหาชื่อ HN เลขบัตร หรือหมู่บ้าน"
                className="dmltInput dmltSearchInput"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหา ชื่อ, HN, เลขบัตร, หมู่บ้าน"
              />
            </div>

            <button
              type="button"
              className="dmltBtn"
              aria-expanded={showRulesPanel}
              onClick={() => setShowRulesPanel((prev) => !prev)}
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
              เงื่อนไข HOSxP
            </button>

            {hasCustomFilters && (
              <button
                type="button"
                className="dmltBtn dmltBtnGhost dmltBtnSm"
                onClick={handleResetFilters}
              >
                <X size={14} strokeWidth={1.5} />
                รีเซ็ต
              </button>
            )}
          </div>

          {showRulesPanel && (
            <div className="dmltRulesGrid">
              <div className="dmltRuleField">
                <label htmlFor="dmlt-uc-scope" className="dmltRuleLabel">
                  การตรวจสิทธิ์ UC (hipdata_code = UCS)
                </label>
                <select
                  id="dmlt-uc-scope"
                  className="dmltSelect"
                  value={ucScope}
                  onChange={(e) => {
                    setUcScope(e.target.value as DmLabUcScope)
                    setPage(1)
                  }}
                >
                  {(Object.keys(UC_SCOPE_LABELS) as DmLabUcScope[]).map((key) => (
                    <option key={key} value={key}>
                      {UC_SCOPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dmltRuleField">
                <label htmlFor="dmlt-diag-scope" className="dmltRuleLabel">
                  การตรวจวินิจฉัย E11 (เบาหวานชนิดที่ 2)
                </label>
                <select
                  id="dmlt-diag-scope"
                  className="dmltSelect"
                  value={diagScope}
                  onChange={(e) => {
                    setDiagScope(e.target.value as DmLabDiagScope)
                    setPage(1)
                  }}
                >
                  {(Object.keys(DIAG_SCOPE_LABELS) as DmLabDiagScope[]).map((key) => (
                    <option key={key} value={key}>
                      {DIAG_SCOPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dmltRuleField">
                <label htmlFor="dmlt-drug-scope" className="dmltRuleLabel">
                  เงื่อนไขการปลอดยาเบาหวาน
                </label>
                <select
                  id="dmlt-drug-scope"
                  className="dmltSelect"
                  value={drugScope}
                  onChange={(e) => {
                    setDrugScope(e.target.value as DmLabDrugScope)
                    setPage(1)
                  }}
                >
                  {(Object.keys(DRUG_SCOPE_LABELS) as DmLabDrugScope[]).map((key) => (
                    <option key={key} value={key}>
                      {DRUG_SCOPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="dmltRuleMetaRow">
            <label className="dmltCheckboxLabel">
              <input
                type="checkbox"
                checked={includeDeceased}
                onChange={(e) => {
                  setIncludeDeceased(e.target.checked)
                  setPage(1)
                }}
              />
              <span>รวมผู้ป่วยที่สถานะเสียชีวิตใน HOSxP</span>
            </label>

            <button
              type="button"
              className="dmltBtn dmltBtnGhost dmltBtnSm"
              aria-expanded={showDrugList}
              onClick={() => setShowDrugList((prev) => !prev)}
            >
              <Pill size={14} strokeWidth={1.5} />
              รายการยาเบาหวานที่ตรวจสอบ ({DM_ANTIDIABETIC_DRUGS.length} รหัส)
            </button>
          </div>

          {showDrugList && (
            <div className="dmltDrugPopover">
              <div>
                <strong>รายการยาเบาหวานที่นำมาคัดกรองใน opitemrece</strong> (ไม่รวมเอกสารคำแนะนำยา
                และเข็มฉีดอินซูลิน):
              </div>
              <div className="dmltDrugGrid">
                {DM_ANTIDIABETIC_DRUGS.map((drug) => (
                  <div key={drug.icode} className="dmltDrugItem">
                    <span>
                      {drug.name}
                      {!drug.isActive ? ' (รหัสเดิม)' : ''}
                    </span>
                    <span className="dmltDrugCode">{drug.icode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="dmltTableCard" aria-label="รายชื่อผู้ป่วยที่ผ่านเงื่อนไข">
          <div className="dmltTableMeta">
            <span>
              แสดงผล{' '}
              <strong>
                {pageStart.toLocaleString()}–{pageEnd.toLocaleString()}
              </strong>{' '}
              จากทั้งหมด <strong>{pagination.totalItems.toLocaleString()}</strong> รายการ
            </span>
            <span>คลิกปุ่ม &quot;ดูประวัติ&quot; เพื่อตรวจสอบผล Lab ย้อนหลัง, ICD-10 และรายการยา</span>
          </div>

          {loading && !data ? (
            <div className="dmltEmpty">กำลังดึงข้อมูลผู้ป่วยจาก HOSxP</div>
          ) : items.length === 0 ? (
            <div className="dmltEmpty">
              ไม่พบรายชื่อผู้ป่วยที่ตรงตามเงื่อนไขในปีงบประมาณและตัวกรองที่เลือก
            </div>
          ) : (
            <div className="dmltTableScroll">
              <table className="dmltTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>HN / เลขบัตร</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>วันเจาะ HbA1c ล่าสุด</th>
                    <th>HbA1c (%)</th>
                    <th>สิทธิ์ ณ Visit</th>
                    <th>วินิจฉัย E11</th>
                    <th>ยาเบาหวาน</th>
                    <th>ที่อยู่</th>
                    <th>ทะเบียน DM Remission</th>
                    <th>ทะเบียน DM (T1DM/GDM/PDM)</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const rowNumber = (pagination.page - 1) * pagination.pageSize + idx + 1
                    return (
                      <tr key={row.hn}>
                        <td className="dmltNum">{rowNumber}</td>
                        <td>
                          <div className="dmltMono">{row.hn}</div>
                          {row.cid && <div className="dmltSubCell dmltMono">{row.cid}</div>}
                        </td>
                        <td>
                          <div>{row.patientName}</div>
                          <div className="dmltSubCell">
                            {row.sexLabel || 'ไม่ระบุเพศ'}
                            {row.ageYears !== null ? ` · ${row.ageYears} ปี` : ''}
                            {row.deathFlag ? ' · เสียชีวิต' : ''}
                          </div>
                        </td>
                        <td>
                          <div>{formatThaiDate(row.visitDate)}</div>
                          <div className="dmltSubCell dmltNum">
                            เจาะ {row.a1cTestCount} ครั้งในปีงบ
                          </div>
                        </td>
                        <td>
                          <div className="dmltA1cStrong">{row.latestA1c.toFixed(2)}%</div>
                          {row.prevA1c !== null && (
                            <div className="dmltSubCell dmltNum">
                              ก่อนหน้า {row.prevA1c.toFixed(2)}%
                            </div>
                          )}
                        </td>
                        <td>
                          <div>{row.visitPttypeName || row.visitPttypeCode || '—'}</div>
                          {!row.isUcVisit && row.isUcCurrent && (
                            <div className="dmltSubCell">สิทธิ์ปัจจุบันเป็น UC</div>
                          )}
                        </td>
                        <td>
                          <div className="dmltMono">{row.lastE11Icd10 || '—'}</div>
                          <div className="dmltSubCell">
                            {row.lastE11Date ? formatThaiDate(row.lastE11Date) : '—'}
                            {row.sameVnE11 ? ' · Visit เดียวกัน' : ''}
                          </div>
                        </td>
                        <td>
                          {!row.hasDmDrugInFy ? (
                            <span className="dmltPill dmltPillSuccess">ไม่พบในปีงบ</span>
                          ) : (
                            <span className="dmltPill dmltPillWarning">
                              {row.dmDrugsInFy.slice(0, 2).join(', ')}
                              {row.dmDrugsInFy.length > 2
                                ? ` +${row.dmDrugsInFy.length - 2}`
                                : ''}
                            </span>
                          )}
                        </td>
                        <td>
                          <div>{row.tambonName ? `ต.${row.tambonName}` : 'ไม่ระบุตำบล'}</div>
                          {(row.villageName || row.villageMoo) && (
                            <div className="dmltSubCell">
                              {row.villageName || ''}
                              {row.villageMoo ? ` ม.${row.villageMoo}` : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          {isInDmRemissionCohortRow(row) ? (
                            <span className="dmltPill dmltPillInfo">
                              {formatDmRemissionText(row)}
                            </span>
                          ) : (
                            <span className="dmltPill dmltPillNeutral">ยังไม่เข้าทะเบียน</span>
                          )}
                        </td>
                        <td>
                          {row.inT1dmRegistry ? (
                            <span className="dmltPill dmltPillSuccess">
                              {formatT1dmRegistryText(row)}
                            </span>
                          ) : (
                            <span className="dmltPill dmltPillNeutral">ยังไม่ลงทะเบียน</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="dmltBtn dmltBtnSm"
                            onClick={() => void handleOpenTimeline(row)}
                          >
                            <Eye size={14} strokeWidth={1.5} />
                            ดูประวัติ
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="dmltPagination">
              <span>
                หน้า {pagination.page.toLocaleString()} จาก{' '}
                {pagination.totalPages.toLocaleString()}
              </span>
              <div className="dmltPaginationControls">
                <button
                  type="button"
                  className="dmltBtn dmltBtnSm"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} strokeWidth={1.5} />
                  ก่อนหน้า
                </button>
                <button
                  type="button"
                  className="dmltBtn dmltBtnSm"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  ถัดไป
                  <ChevronRight size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <DmLabPatientModal
        record={selectedRecord}
        timeline={timeline}
        loading={timelineLoading}
        error={timelineError}
        onClose={handleCloseTimeline}
      />
    </div>
  )
}
