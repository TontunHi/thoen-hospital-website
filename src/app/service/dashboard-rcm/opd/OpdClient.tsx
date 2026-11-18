'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Activity,
  Users,
  TrendingUp,
  Award,
  Search,
  X,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { OpdDepartmentSummaryItem } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import {
  RcmCommandHeader,
  RcmErrorBanner,
  RcmKpiStrip,
  RcmKpiTile,
  RcmHorizontalRankedChart,
  RcmBulletListCard,
  HorizontalBarDatum,
  BulletListItem,
  formatSharePct,
} from '../_components/RcmDashboardPrimitives'
import {
  getAvailableFiscalYears,
  getCurrentFiscalYearCe,
  getFiscalYearDateBounds,
  getMonthDateBounds,
} from '../_components/rcmDateRangeUtils'
import '../_components/dashboard-design.css'

/** Removes numerical ordering prefix (e.g. "01. อายุรกรรม" -> "อายุรกรรม"). */
const cleanDeptName = (name: string): string =>
  name.replace(/^\d+[\.\s\-]+/, '').trim()

type DeptSortField = 'dept_group' | 'patients' | 'visits' | 'avg' | 'share'

export interface OpdClientProps {
  initialData?: OpdDepartmentSummaryItem[]
  initialRange?: { startDate: string; endDate: string }
}

const formatInt = (n: number) => (n ?? 0).toLocaleString('th-TH')

/**
 * 2.1.1.3 OPD Department Summary Dashboard Client.
 * Follows dashboard-design Monitor hierarchy & rcm-data-flow 5 pillars.
 */
export default function OpdClient({ initialData, initialRange }: OpdClientProps = {}) {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = useMemo(() => getCurrentFiscalYearCe(today), [today])

  // Date controls
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(defaultFiscalYear)
  const [ds1, setDs1] = useState<string>(
    initialRange?.startDate || getFiscalYearDateBounds(defaultFiscalYear).startDate
  )
  const [ds2, setDs2] = useState<string>(
    initialRange?.endDate || getFiscalYearDateBounds(defaultFiscalYear).endDate
  )

  // Interactive Dashboard Filters & Sorting
  const [activeMetric, setActiveMetric] = useState<'visits' | 'patients'>('visits')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [search, setSearch] = useState<string>('')
  const [hideZeroRows, setHideZeroRows] = useState<boolean>(true)
  const [sortField, setSortField] = useState<DeptSortField>('visits')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Data States
  const [data, setData] = useState<OpdDepartmentSummaryItem[]>(initialData || [])
  const [loading, setLoading] = useState<boolean>(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(
    Boolean(initialData && initialData.length > 0)
  )
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  const availableYears = useMemo(
    () => getAvailableFiscalYears(defaultFiscalYear),
    [defaultFiscalYear]
  )

  const fetchData = useCallback(
    async (d1 = ds1, d2 = ds2) => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/service/dashboard-rcm/opd-dept-summary?ds1=${encodeURIComponent(d1)}&ds2=${encodeURIComponent(d2)}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setData(json.data)
          setHasLoadedOnce(true)
        } else {
          setError(
            json.error?.message ||
              json.error ||
              'ไม่สามารถดึงข้อมูลสรุปผู้ป่วยนอกแยกรายแผนกได้'
          )
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [ds1, ds2]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData && initialData.length > 0) return
    }
    fetchData(ds1, ds2)
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [ds1, ds2, fetchData, initialData])

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month)
    const bounds = getMonthDateBounds(currentCalYear, month)
    setDs1(bounds.startDate)
    setDs2(bounds.endDate)
  }

  const handleSelectFiscalYear = (fiscalYear: number) => {
    setSelectedYear(fiscalYear)
    const bounds = getFiscalYearDateBounds(fiscalYear)
    setDs1(bounds.startDate)
    setDs2(bounds.endDate)
  }

  const handleDateModeChange = (mode: 'custom' | 'month' | 'year') => {
    setDateMode(mode)
    if (mode === 'month') handleSelectMonth(selectedMonth)
    else if (mode === 'year') handleSelectFiscalYear(selectedYear)
  }

  const totalRow = useMemo(
    () => data.find((r) => r.dept_group === 'รวมทั้งหมด') || null,
    [data]
  )

  const deptRows = useMemo(
    () => data.filter((r) => r.dept_group !== 'รวมทั้งหมด'),
    [data]
  )

  const stats = useMemo(() => {
    const totalPatients =
      totalRow?.patients ?? deptRows.reduce((acc, r) => acc + (r.patients ?? 0), 0)
    const totalVisits =
      totalRow?.visits ?? deptRows.reduce((acc, r) => acc + (r.visits ?? 0), 0)
    const avgVisitsPerPatient = totalPatients > 0 ? totalVisits / totalPatients : 0
    const activeDeptCount = deptRows.filter((r) => (r.visits ?? 0) > 0).length

    let topDeptRaw = ''
    let topDeptVisits = 0
    deptRows.forEach((r) => {
      if ((r.visits ?? 0) > topDeptVisits) {
        topDeptVisits = r.visits
        topDeptRaw = r.dept_group
      }
    })
    const topDeptPercent = totalVisits > 0 ? (topDeptVisits / totalVisits) * 100 : 0

    return {
      totalPatients,
      totalVisits,
      avgVisitsPerPatient,
      activeDeptCount,
      topDeptRaw,
      topDeptName: topDeptRaw ? cleanDeptName(topDeptRaw) : '—',
      topDeptVisits,
      topDeptPercent,
    }
  }, [totalRow, deptRows])

  const isStale = loading && hasLoadedOnce
  const isInitialSkeleton = loading && !hasLoadedOnce

  // Top 10 Horizontal Ranked Bars + "แผนกอื่นๆ" bucket for clean glanceability
  const chartBars = useMemo<HorizontalBarDatum[]>(() => {
    const nonZero = deptRows
      .filter((d) => (activeMetric === 'visits' ? d.visits > 0 : d.patients > 0))
      .sort((a, b) =>
        activeMetric === 'visits' ? b.visits - a.visits : b.patients - a.patients
      )

    const totalBase = activeMetric === 'visits' ? stats.totalVisits : stats.totalPatients
    const top = nonZero.slice(0, 10)
    const rest = nonZero.slice(10)

    const mapped: HorizontalBarDatum[] = top.map((d) => {
      const value = activeMetric === 'visits' ? d.visits : d.patients
      const avg = d.patients > 0 ? (d.visits / d.patients).toFixed(2) : '0.00'
      return {
        id: d.dept_group,
        label: cleanDeptName(d.dept_group),
        value,
        secondaryText:
          activeMetric === 'visits'
            ? `${formatInt(d.patients)} คน · ${avg} ครั้ง/คน`
            : `${formatInt(d.visits)} ครั้ง · ${avg} ครั้ง/คน`,
        sharePct: totalBase > 0 ? (value / totalBase) * 100 : 0,
      }
    })

    if (rest.length > 0) {
      const restVisits = rest.reduce((acc, r) => acc + r.visits, 0)
      const restPatients = rest.reduce((acc, r) => acc + r.patients, 0)
      const value = activeMetric === 'visits' ? restVisits : restPatients
      mapped.push({
        id: '__others__',
        label: `แผนกอื่นๆ (${rest.length} แผนก)`,
        value,
        secondaryText:
          activeMetric === 'visits'
            ? `${formatInt(restPatients)} คน`
            : `${formatInt(restVisits)} ครั้ง`,
        sharePct: totalBase > 0 ? (value / totalBase) * 100 : 0,
      })
    }

    return mapped
  }, [deptRows, activeMetric, stats.totalVisits, stats.totalPatients])

  // Bullet Graph: Top 8 departments by visit intensity (visits/patient) vs Hospital Average
  // Guard: ignore tiny bases (< 5 patients) so noisy outliers never shout
  const bulletItems = useMemo<BulletListItem[]>(() => {
    const benchmark = stats.avgVisitsPerPatient
    return deptRows
      .filter((d) => d.patients >= 5 && d.visits > 0)
      .map((d) => {
        const ratio = d.visits / d.patients
        return {
          id: d.dept_group,
          name: cleanDeptName(d.dept_group),
          value: ratio,
          valueLabel: ratio.toFixed(2),
          isHighAttention: benchmark > 0 && ratio >= benchmark * 1.2,
          tooltip: `${cleanDeptName(d.dept_group)}: ${ratio.toFixed(2)} ครั้ง/คน (${formatInt(d.visits)} ครั้ง / ${formatInt(d.patients)} คน)`,
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [deptRows, stats.avgVisitsPerPatient])

  const highIntensityCount = useMemo(
    () => bulletItems.filter((b) => b.isHighAttention).length,
    [bulletItems]
  )

  const kpiTiles = useMemo<RcmKpiTile[]>(
    () => [
      {
        id: 'patients',
        label: 'ผู้ป่วยนอกรวม (คน)',
        value: formatInt(stats.totalPatients),
        context: `${stats.activeDeptCount} แผนกที่มีบริการ`,
        tooltip: 'จำนวนผู้รับบริการที่ไม่ซ้ำ (COUNT DISTINCT HN) — คลิกเพื่อดูสัดส่วนรายแผนกตามจำนวนคน',
        icon: <Users size={15} strokeWidth={1.5} />,
        tone: 'accent',
        interactive: true,
        selected: activeMetric === 'patients',
        onClick: () => setActiveMetric('patients'),
      },
      {
        id: 'visits',
        label: 'จำนวนครั้งรวม (ครั้ง)',
        value: formatInt(stats.totalVisits),
        context: 'คลิกเพื่อเรียงกราฟตามครั้ง',
        tooltip: 'จำนวนครั้งที่มารับบริการทั้งหมด (COUNT DISTINCT VN) — คลิกเพื่อดูกราฟตามจำนวนครั้ง',
        icon: <Activity size={15} strokeWidth={1.5} />,
        tone: 'money',
        interactive: true,
        selected: activeMetric === 'visits',
        onClick: () => setActiveMetric('visits'),
      },
      {
        id: 'avg',
        label: 'เฉลี่ยการรับบริการ',
        value: `${stats.avgVisitsPerPatient.toFixed(2)}`,
        context:
          highIntensityCount > 0
            ? `${highIntensityCount} แผนกสูงกว่าเกณฑ์ 1.2×`
            : 'ครั้ง / คน (ภาพรวม รพ.)',
        tooltip: 'อัตราส่วนจำนวนครั้งต่อผู้ป่วย 1 คน ของโรงพยาบาลในช่วงเวลาที่เลือก',
        icon: <TrendingUp size={15} strokeWidth={1.5} />,
        tone: 'neutral',
      },
      {
        id: 'top',
        label: 'แผนกภาระงานสูงสุด',
        value: stats.topDeptName,
        compactValue: true,
        context: `${formatInt(stats.topDeptVisits)} ครั้ง (${stats.topDeptPercent.toFixed(1)}%)`,
        tooltip: 'แผนกที่มียอดจำนวนครั้งรับบริการสูงสุด — คลิกเพื่อไฮไลต์ในตาราง',
        icon: <Award size={15} strokeWidth={1.5} />,
        tone: 'neutral',
        interactive: Boolean(stats.topDeptRaw),
        selected: Boolean(stats.topDeptRaw && selectedDept === stats.topDeptRaw),
        onClick: () =>
          stats.topDeptRaw &&
          setSelectedDept((prev) => (prev === stats.topDeptRaw ? null : stats.topDeptRaw)),
      },
    ],
    [stats, activeMetric, highIntensityCount, selectedDept]
  )

  const filteredDeptRows = useMemo(() => {
    const filtered = deptRows.filter((r) => {
      if (hideZeroRows && r.patients === 0 && r.visits === 0) return false
      if (selectedDept && r.dept_group !== selectedDept) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const cleaned = cleanDeptName(r.dept_group).toLowerCase()
        if (!cleaned.includes(q) && !r.dept_group.toLowerCase().includes(q)) return false
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortField === 'dept_group') {
        const cmp = cleanDeptName(a.dept_group).localeCompare(cleanDeptName(b.dept_group), 'th')
        return sortOrder === 'asc' ? cmp : -cmp
      }
      const getVal = (row: OpdDepartmentSummaryItem) => {
        if (sortField === 'patients') return row.patients ?? 0
        if (sortField === 'visits') return row.visits ?? 0
        if (sortField === 'avg') return row.patients > 0 ? row.visits / row.patients : 0
        return stats.totalVisits > 0 ? (row.visits / stats.totalVisits) * 100 : 0
      }
      const valA = getVal(a)
      const valB = getVal(b)
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })
  }, [deptRows, hideZeroRows, selectedDept, search, sortField, sortOrder, stats.totalVisits])

  const handleSort = (field: DeptSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'dept_group' ? 'asc' : 'desc')
    }
  }

  const renderSortIcon = (field: DeptSortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.45 }} />
    return sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const exportExcel = async () => {
    const headers = [
      'ลำดับ',
      'แผนก',
      'จำนวนคน (HN)',
      'จำนวนครั้ง (VN)',
      'เฉลี่ย (ครั้ง/คน)',
      'สัดส่วน (% ของครั้งรวม)',
    ]
    const rows = filteredDeptRows.map((r, idx) => {
      const avg = r.patients > 0 ? Number((r.visits / r.patients).toFixed(2)) : 0
      const pct =
        stats.totalVisits > 0 ? ((r.visits / stats.totalVisits) * 100).toFixed(2) + '%' : '0.00%'
      return [idx + 1, cleanDeptName(r.dept_group), r.patients, r.visits, avg, pct]
    })

    const summaryRows = totalRow
      ? [
          [
            '',
            'รวมทั้งหมด',
            totalRow.patients,
            totalRow.visits,
            totalRow.patients > 0
              ? Number((totalRow.visits / totalRow.patients).toFixed(2))
              : 0,
            '100.00%',
          ],
        ]
      : undefined

    await exportRcmExcel({
      filename: `opd_dept_summary_${ds1}_to_${ds2}.xlsx`,
      title: 'รายงานสรุปการให้บริการผู้ป่วยนอกโรงพยาบาลเถิน (OPD) แยกรายแผนก',
      subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
      headers,
      rows,
      summaryRows,
    })
  }

  const toggleDeptSelect = (id: string) => {
    if (id === '__others__') return
    setSelectedDept((prev) => (prev === id ? null : id))
  }

  return (
    <div className="dd-page">
      <RcmCommandHeader
        code="2.1.1.3"
        title="รายงานสรุปการให้บริการผู้ป่วยนอก (OPD) แยกรายแผนก"
        icon={<Activity size={17} strokeWidth={1.5} />}
        dateMode={dateMode}
        onDateModeChange={handleDateModeChange}
        ds1={ds1}
        ds2={ds2}
        onDs1Change={setDs1}
        onDs2Change={setDs2}
        selectedMonth={selectedMonth}
        onSelectMonth={handleSelectMonth}
        monthYearBe={currentCalYear + 543}
        selectedYear={selectedYear}
        availableYears={availableYears}
        onSelectFiscalYear={handleSelectFiscalYear}
        loading={loading}
        exportDisabled={filteredDeptRows.length === 0}
        onRefresh={() => fetchData(ds1, ds2)}
        onExport={exportExcel}
      />

      <RcmErrorBanner error={error} onRetry={() => fetchData(ds1, ds2)} />

      <div className={isStale ? 'dd-stale' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 1. Hairline-Divided Interactive KPI Strip */}
        <RcmKpiStrip tiles={kpiTiles} loading={isInitialSkeleton} />

        {/* 2. Top-10 Horizontal Bars (7 cols) + Intensity Bullet Graph (5 cols) */}
        <div className="dd-main-grid">
          <RcmHorizontalRankedChart
            kicker={
              activeMetric === 'visits'
                ? '10 อันดับแผนกตามจำนวนครั้งรับบริการ (VN)'
                : '10 อันดับแผนกตามจำนวนผู้ป่วย (HN)'
            }
            headline={
              activeMetric === 'visits'
                ? `${formatInt(stats.totalVisits)} ครั้ง`
                : `${formatInt(stats.totalPatients)} คน`
            }
            data={chartBars}
            hue={activeMetric === 'visits' ? 'money' : 'accent'}
            unit={activeMetric === 'visits' ? 'ครั้ง' : 'คน'}
            loading={isInitialSkeleton}
            selectedId={selectedDept}
            onSelectBar={toggleDeptSelect}
            headerAction={
              <div className="dd-segmented" role="group" aria-label="ตัวชี้วัดบนกราฟ">
                <button
                  type="button"
                  onClick={() => setActiveMetric('visits')}
                  className={`dd-seg-btn ${activeMetric === 'visits' ? 'active' : ''}`}
                  style={{ padding: '0.22rem 0.55rem', fontSize: 12 }}
                >
                  จำนวนครั้ง
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('patients')}
                  className={`dd-seg-btn ${activeMetric === 'patients' ? 'active' : ''}`}
                  style={{ padding: '0.22rem 0.55rem', fontSize: 12 }}
                >
                  จำนวนคน
                </button>
              </div>
            }
          />

          <RcmBulletListCard
            title="ความถี่การมารับบริการ (ครั้ง/คน)"
            kicker="เทียบกับค่าเฉลี่ยรวมของโรงพยาบาล (ฐาน ≥ 5 คน)"
            target={stats.avgVisitsPerPatient || 1}
            targetLabel={`${stats.avgVisitsPerPatient.toFixed(2)}`}
            items={bulletItems}
            selectedId={selectedDept}
            onSelect={toggleDeptSelect}
          />
        </div>

        {/* 3. Department Breakdown Table */}
        <section className="dd-table-card" aria-label="ตารางสรุปรายแผนก">
          <div className="dd-table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 className="dd-panel-title">
                รายละเอียดผู้รับบริการแยกรายแผนก ({filteredDeptRows.length} แผนก)
              </h2>
              {selectedDept && (
                <button
                  type="button"
                  onClick={() => setSelectedDept(null)}
                  className="dd-chip"
                  style={{ cursor: 'pointer' }}
                >
                  <span>เฉพาะ: {cleanDeptName(selectedDept)}</span>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="dd-table-controls">
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: 12.5,
                  color: 'var(--dd-ink-2)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={hideZeroRows}
                  onChange={(e) => setHideZeroRows(e.target.checked)}
                />
                <span>ซ่อนแผนกยอดเป็น 0</span>
              </label>

              <div className="dd-search-wrap">
                <Search size={14} className="dd-search-icon" />
                <input
                  type="text"
                  placeholder="ค้นหาแผนก..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="dd-search-input"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="dd-search-clear"
                    title="ล้างคำค้นหา"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="dd-table-scroll">
            <table className="dd-table">
              <thead>
                <tr>
                  <th className="is-center" style={{ width: 52 }}>
                    #
                  </th>
                  <th
                    className="is-left is-sortable"
                    onClick={() => handleSort('dept_group')}
                    title="คลิกเพื่อเรียงตามชื่อแผนก"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      แผนก {renderSortIcon('dept_group')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => handleSort('patients')}
                    title="คลิกเพื่อเรียงตามจำนวนคน"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      จำนวนคน (HN) {renderSortIcon('patients')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => handleSort('visits')}
                    title="คลิกเพื่อเรียงตามจำนวนครั้ง"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      จำนวนครั้ง (VN) {renderSortIcon('visits')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => handleSort('avg')}
                    title="คลิกเพื่อเรียงตามค่าเฉลี่ยครั้งต่อคน"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      เฉลี่ย (ครั้ง/คน) {renderSortIcon('avg')}
                    </span>
                  </th>
                  <th
                    className="is-left is-sortable"
                    style={{ minWidth: 180 }}
                    onClick={() => handleSort('share')}
                    title="คลิกเพื่อเรียงตามสัดส่วน"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      สัดส่วน {renderSortIcon('share')}
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {isInitialSkeleton ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <div className="dd-skeleton" style={{ height: 22, width: '100%' }} />
                      </td>
                    </tr>
                  ))
                ) : filteredDeptRows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dd-empty-box">
                        <AlertCircle size={22} />
                        <p className="dd-empty-title">ไม่พบข้อมูลผู้ป่วยนอกตามเงื่อนไขที่เลือก</p>
                        <p className="dd-empty-desc">ลองปรับช่วงเวลาหรือยกเลิกตัวกรองแผนก</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDeptRows.map((row, idx) => {
                    const avgNum = row.patients > 0 ? row.visits / row.patients : 0
                    const isHighAvg =
                      row.patients >= 5 &&
                      stats.avgVisitsPerPatient > 0 &&
                      avgNum >= stats.avgVisitsPerPatient * 1.2
                    const pct = stats.totalVisits > 0 ? (row.visits / stats.totalVisits) * 100 : 0

                    return (
                      <tr
                        key={row.dept_group}
                        className={selectedDept === row.dept_group ? 'is-highlighted' : ''}
                      >
                        <td className="is-center" style={{ color: 'var(--dd-muted)' }}>
                          {idx + 1}
                        </td>
                        <td className="is-left" style={{ fontWeight: 500 }}>
                          {cleanDeptName(row.dept_group)}
                        </td>
                        <td className={row.patients > 0 ? '' : 'dd-muted-zero'}>
                          {row.patients > 0 ? formatInt(row.patients) : '—'}
                        </td>
                        <td
                          className={row.visits > 0 ? '' : 'dd-muted-zero'}
                          style={{ fontWeight: row.visits > 0 ? 600 : 400 }}
                        >
                          {row.visits > 0 ? formatInt(row.visits) : '—'}
                        </td>
                        <td>
                          {row.patients > 0 ? (
                            <span
                              style={{
                                color: isHighAvg ? 'var(--dd-warn)' : 'var(--dd-ink-2)',
                                fontWeight: isHighAvg ? 600 : 500,
                              }}
                            >
                              {avgNum.toFixed(2)}
                            </span>
                          ) : (
                            <span className="dd-muted-zero">—</span>
                          )}
                        </td>
                        <td className="is-left">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span
                              aria-hidden="true"
                              style={{
                                flex: 1,
                                maxWidth: 110,
                                height: 3,
                                borderRadius: 9999,
                                background: 'var(--dd-line)',
                                overflow: 'hidden',
                              }}
                            >
                              <span
                                style={{
                                  display: 'block',
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(row.visits > 0 ? 2 : 0, pct))}%`,
                                  background: 'var(--dd-money)',
                                  borderRadius: 9999,
                                }}
                              />
                            </span>
                            <span style={{ minWidth: 42, fontSize: 12.5, color: 'var(--dd-ink-2)' }}>
                              {formatSharePct(pct)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>

              {!isInitialSkeleton && totalRow && !selectedDept && !search.trim() && (
                <tfoot>
                  <tr className="dd-total-row">
                    <td className="is-center">รวม</td>
                    <td className="is-left">ทุกแผนก</td>
                    <td>{formatInt(totalRow.patients)}</td>
                    <td>{formatInt(totalRow.visits)}</td>
                    <td>
                      {totalRow.patients > 0
                        ? (totalRow.visits / totalRow.patients).toFixed(2)
                        : '0.00'}
                    </td>
                    <td className="is-left">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
