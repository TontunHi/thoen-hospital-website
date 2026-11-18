'use client'

import React, { useMemo, useState } from 'react'
import {
  Users,
  DollarSign,
  Receipt,
  CreditCard,
  AlertCircle,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  RcmKpiStrip,
  RcmKpiTile,
  RcmMonthlyBarChart,
  RcmRankedListCard,
  MonthlyBarDatum,
  RankedListItem,
} from './RcmDashboardPrimitives'
import { buildFiscalQuarters, formatShortThaiMonth } from './rcmDateRangeUtils'

export interface DoctorFinanceRow {
  doctor_code: string
  doctor_name: string
  total_visits: number
  total_income: number
  total_uc_money: number
  total_rcpt_money: number
  total_discount: number
  total_debit: number
  monthly_income: Record<string, number>
  monthly_visits: Record<string, number>
}

export interface DoctorFinanceTotals {
  visits: number
  income: number
  uc_money: number
  rcpt_money: number
  discount: number
  debit: number
}

export type DoctorSortField =
  | 'doctor_name'
  | 'total_visits'
  | 'total_income'
  | 'total_uc_money'
  | 'total_rcpt_money'
  | 'total_debit'

interface RcmDoctorFinanceBodyProps {
  doctors: DoctorFinanceRow[]
  months: string[]
  monthlyTotals: Record<string, { income: number; visits: number }>
  grandTotal: DoctorFinanceTotals
  dateMode: 'custom' | 'month' | 'year'
  selectedYear: number
  loading: boolean
  hasLoadedOnce: boolean
  entityLabel: string // e.g. "ทันตแพทย์" or "แพทย์"
  visitLabel: string // e.g. "จำนวนครั้งรับบริการ" or "ผู้ป่วยนอกทั้งหมด"
  searchPlaceholder: string
  emptyTitle: string
  emptyDesc: string
  showDynamicMonthsOutsideYear?: boolean
}

const formatInt = (n: number) => (n ?? 0).toLocaleString('th-TH')
const formatBaht = (n: number) =>
  `฿${Math.round(n ?? 0).toLocaleString('th-TH')}`

/**
 * Shared analytical + ledger view for doctor-level RCM dashboards (sss-dental, opd-doctor).
 * Follows Monitor flow: KPI Strip -> Monthly Trend + Doctor Ranking -> Sortable Financial Ledger.
 */
export function RcmDoctorFinanceBody({
  doctors,
  months,
  monthlyTotals,
  grandTotal,
  dateMode,
  selectedYear,
  loading,
  hasLoadedOnce,
  entityLabel,
  visitLabel,
  searchPlaceholder,
  emptyTitle,
  emptyDesc,
  showDynamicMonthsOutsideYear = false,
}: RcmDoctorFinanceBodyProps) {
  const [activeMetric, setActiveMetric] = useState<'income' | 'visits'>('income')
  const [onlyDebit, setOnlyDebit] = useState(false)
  const [selectedDoctorCode, setSelectedDoctorCode] = useState<string | null>(null)
  const [searchDoctor, setSearchDoctor] = useState('')
  const [sortField, setSortField] = useState<DoctorSortField>('total_income')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showMonthlyCols, setShowMonthlyCols] = useState(true)

  const currentYm = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const fiscalQuarters = useMemo(() => {
    if (dateMode !== 'year') return []
    return buildFiscalQuarters(selectedYear)
  }, [dateMode, selectedYear])

  const fiscalMonthColumns = useMemo(
    () => fiscalQuarters.flatMap((q) => q.months),
    [fiscalQuarters]
  )

  const isStale = loading && hasLoadedOnce
  const isInitialSkeleton = loading && !hasLoadedOnce

  const debitDoctorsCount = useMemo(
    () => doctors.filter((d) => (d.total_debit ?? 0) > 0).length,
    [doctors]
  )

  const safeIncome = grandTotal.income ?? 0
  const safeVisits = grandTotal.visits ?? 0
  const safeUc = grandTotal.uc_money ?? 0
  const safeRcpt = grandTotal.rcpt_money ?? 0
  const safeDebit = grandTotal.debit ?? 0

  const ucPct = safeIncome > 0 ? ((safeUc / safeIncome) * 100).toFixed(1) : '0.0'
  const rcptPct = safeIncome > 0 ? ((safeRcpt / safeIncome) * 100).toFixed(1) : '0.0'
  const debitPct = safeIncome > 0 ? ((safeDebit / safeIncome) * 100).toFixed(1) : '0.0'
  const avgPerVisit = safeVisits > 0 ? safeIncome / safeVisits : 0

  // Monthly series aligned for both sparklines and main chart
  const monthSeries = useMemo<MonthlyBarDatum[]>(() => {
    const cols =
      dateMode === 'year'
        ? fiscalMonthColumns.map((m) => ({ key: m.key, label: m.label }))
        : months.map((m) => ({ key: m, label: formatShortThaiMonth(m) }))

    return cols.map((c) => {
      const bucket = monthlyTotals[c.key] || { income: 0, visits: 0 }
      const value = activeMetric === 'income' ? bucket.income : bucket.visits
      const secondaryLabel =
        activeMetric === 'income'
          ? `${formatInt(bucket.visits)} ครั้ง`
          : formatBaht(bucket.income)

      return {
        key: c.key,
        label: c.label,
        value,
        secondaryLabel,
        isPartial: c.key === currentYm,
      }
    })
  }, [dateMode, fiscalMonthColumns, months, monthlyTotals, activeMetric, currentYm])

  const incomeSpark = useMemo(
    () =>
      (dateMode === 'year'
        ? fiscalMonthColumns.map((m) => monthlyTotals[m.key]?.income ?? 0)
        : months.map((m) => monthlyTotals[m]?.income ?? 0)),
    [dateMode, fiscalMonthColumns, months, monthlyTotals]
  )

  const visitSpark = useMemo(
    () =>
      (dateMode === 'year'
        ? fiscalMonthColumns.map((m) => monthlyTotals[m.key]?.visits ?? 0)
        : months.map((m) => monthlyTotals[m]?.visits ?? 0)),
    [dateMode, fiscalMonthColumns, months, monthlyTotals]
  )

  const chartStats = useMemo(() => {
    const nonZero = monthSeries.filter((m) => m.value > 0)
    if (nonZero.length === 0) return []
    const sum = nonZero.reduce((acc, m) => acc + m.value, 0)
    const avg = sum / nonZero.length
    const peak = nonZero.reduce((best, m) => (m.value > best.value ? m : best), nonZero[0])
    return [
      {
        label: 'เฉลี่ย/เดือน',
        value: activeMetric === 'income' ? formatBaht(avg) : `${formatInt(Math.round(avg))} ครั้ง`,
      },
      {
        label: 'สูงสุด',
        value: `${peak.label} (${
          activeMetric === 'income' ? formatBaht(peak.value) : `${formatInt(peak.value)} ครั้ง`
        })`,
      },
    ]
  }, [monthSeries, activeMetric])

  const kpiTiles = useMemo<RcmKpiTile[]>(
    () => [
      {
        id: 'visits',
        label: visitLabel,
        value: formatInt(safeVisits),
        context: `${doctors.length} ${entityLabel}`,
        tooltip: 'จำนวนครั้งที่มารับบริการทั้งหมด (VN) — คลิกเพื่อดูแนวโน้มรายเดือนบนกราฟ',
        icon: <Users size={15} strokeWidth={1.5} />,
        tone: 'accent',
        interactive: true,
        selected: activeMetric === 'visits',
        sparkValues: visitSpark,
        onClick: () => setActiveMetric('visits'),
      },
      {
        id: 'income',
        label: 'ค่ารักษาพยาบาลรวม',
        value: formatBaht(safeIncome),
        context: safeVisits > 0 ? `เฉลี่ย ${formatBaht(avgPerVisit)} / ครั้ง` : '—',
        tooltip: 'ยอดค่ารักษาพยาบาลรวมทั้งหมดในช่วงเวลา — คลิกเพื่อดูแนวโน้มรายได้รายเดือน',
        icon: <DollarSign size={15} strokeWidth={1.5} />,
        tone: 'money',
        interactive: true,
        selected: activeMetric === 'income',
        sparkValues: incomeSpark,
        onClick: () => setActiveMetric('income'),
      },
      {
        id: 'uc',
        label: 'สิทธิเบิกชดเชย (UC)',
        value: formatBaht(safeUc),
        context: `${ucPct}% ของค่ารักษา`,
        tooltip: 'ยอดเรียกเก็บจากกองทุนสิทธิการรักษา (uc_money)',
        icon: <Receipt size={15} strokeWidth={1.5} />,
        tone: 'neutral',
      },
      {
        id: 'rcpt',
        label: 'ชำระเงินสด / ใบเสร็จ',
        value: formatBaht(safeRcpt),
        context: `${rcptPct}% ของค่ารักษา`,
        tooltip: 'ยอดที่ผู้รับบริการชำระเงินเองตามใบเสร็จ (rcpt_money)',
        icon: <CreditCard size={15} strokeWidth={1.5} />,
        tone: 'neutral',
      },
      {
        id: 'debit',
        label: 'ลูกหนี้คงค้าง',
        value: formatBaht(safeDebit),
        context:
          safeDebit > 0
            ? `${debitPct}% · ค้างใน ${debitDoctorsCount} ท่าน`
            : 'ไม่มียอดคงค้าง',
        tooltip: 'ยอดลูกหนี้คงค้างรอติดตาม (debit) — คลิกเพื่อกรองเฉพาะรายที่มีลูกหนี้คงค้าง',
        icon: <AlertCircle size={15} strokeWidth={1.5} />,
        tone: 'warn',
        interactive: debitDoctorsCount > 0,
        selected: onlyDebit,
        isAlert: safeDebit > 0,
        onClick: () => setOnlyDebit((prev) => !prev),
      },
    ],
    [
      visitLabel,
      safeVisits,
      doctors.length,
      entityLabel,
      activeMetric,
      visitSpark,
      safeIncome,
      avgPerVisit,
      incomeSpark,
      safeUc,
      ucPct,
      safeRcpt,
      rcptPct,
      safeDebit,
      debitPct,
      debitDoctorsCount,
      onlyDebit,
    ]
  )

  // Ranked breakdown list items (respects debit toggle & selected metric)
  const rankedItems = useMemo<RankedListItem[]>(() => {
    const source = onlyDebit ? doctors.filter((d) => (d.total_debit ?? 0) > 0) : doctors
    const sorted = [...source].sort((a, b) => {
      if (onlyDebit) return (b.total_debit ?? 0) - (a.total_debit ?? 0)
      return activeMetric === 'visits'
        ? (b.total_visits ?? 0) - (a.total_visits ?? 0)
        : (b.total_income ?? 0) - (a.total_income ?? 0)
    })

    const totalBase = onlyDebit
      ? safeDebit
      : activeMetric === 'visits'
        ? safeVisits
        : safeIncome

    return sorted.map((doc) => {
      const val = onlyDebit
        ? doc.total_debit ?? 0
        : activeMetric === 'visits'
          ? doc.total_visits ?? 0
          : doc.total_income ?? 0
      const sharePct = totalBase > 0 ? (val / totalBase) * 100 : 0
      return {
        id: doc.doctor_code,
        name: doc.doctor_name,
        value: val,
        valueLabel:
          activeMetric === 'visits' && !onlyDebit
            ? `${formatInt(val)} ครั้ง`
            : formatBaht(val),
        sharePct,
        alertChip:
          !onlyDebit && (doc.total_debit ?? 0) > 0
            ? `ค้าง ${formatBaht(doc.total_debit)}`
            : undefined,
        tooltip: `${doc.doctor_name} (${doc.doctor_code}) · ${formatInt(doc.total_visits)} ครั้ง · ${formatBaht(doc.total_income)}`,
      }
    })
  }, [doctors, onlyDebit, activeMetric, safeDebit, safeVisits, safeIncome])

  // Filtered & sorted ledger rows
  const processedDoctors = useMemo(() => {
    let result = doctors
    if (onlyDebit) {
      result = result.filter((d) => (d.total_debit ?? 0) > 0)
    }
    if (selectedDoctorCode) {
      result = result.filter((d) => d.doctor_code === selectedDoctorCode)
    }
    if (searchDoctor.trim()) {
      const q = searchDoctor.toLowerCase()
      result = result.filter(
        (d) =>
          d.doctor_name.toLowerCase().includes(q) ||
          d.doctor_code.toLowerCase().includes(q)
      )
    }

    return [...result].sort((a, b) => {
      const valA = a[sortField]
      const valB = b[sortField]
      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB, 'th')
        return sortOrder === 'asc' ? cmp : -cmp
      }
      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
  }, [doctors, onlyDebit, selectedDoctorCode, searchDoctor, sortField, sortOrder])

  const handleSort = (field: DoctorSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'doctor_name' ? 'asc' : 'desc')
    }
  }

  const renderSortIcon = (field: DoctorSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.45 }} />
    }
    return sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const isTableFiltered =
    onlyDebit || Boolean(selectedDoctorCode) || Boolean(searchDoctor.trim())

  const tableTotals = useMemo(() => {
    if (!isTableFiltered) {
      return {
        visits: safeVisits,
        income: safeIncome,
        uc_money: safeUc,
        rcpt_money: safeRcpt,
        debit: safeDebit,
      }
    }
    return processedDoctors.reduce(
      (acc, doc) => ({
        visits: acc.visits + (doc.total_visits ?? 0),
        income: acc.income + (doc.total_income ?? 0),
        uc_money: acc.uc_money + (doc.total_uc_money ?? 0),
        rcpt_money: acc.rcpt_money + (doc.total_rcpt_money ?? 0),
        debit: acc.debit + (doc.total_debit ?? 0),
      }),
      { visits: 0, income: 0, uc_money: 0, rcpt_money: 0, debit: 0 }
    )
  }, [isTableFiltered, processedDoctors, safeVisits, safeIncome, safeUc, safeRcpt, safeDebit])

  const activeMonthColumns = useMemo(() => {
    if (!showMonthlyCols) return []
    if (dateMode === 'year') return fiscalMonthColumns.map((m) => ({ key: m.key, label: m.label, qTag: m.qTag }))
    if (showDynamicMonthsOutsideYear) return months.map((m) => ({ key: m, label: formatShortThaiMonth(m), qTag: '' }))
    return []
  }, [showMonthlyCols, dateMode, fiscalMonthColumns, showDynamicMonthsOutsideYear, months])

  const toggleDoctorSelection = (code: string) => {
    setSelectedDoctorCode((prev) => (prev === code ? null : code))
  }

  return (
    <div className={isStale ? 'dd-stale' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Hairline-divided Interactive KPI Strip */}
      <RcmKpiStrip tiles={kpiTiles} loading={isInitialSkeleton} />

      {/* 2. Analytical Overview + Attention Ranked List (7 + 5) */}
      <div className="dd-main-grid">
        <RcmMonthlyBarChart
          kicker={
            activeMetric === 'income'
              ? 'แนวโน้มค่ารักษาพยาบาลรายเดือน'
              : 'แนวโน้มจำนวนครั้งบริการรายเดือน'
          }
          headline={
            activeMetric === 'income'
              ? formatBaht(safeIncome)
              : `${formatInt(safeVisits)} ครั้ง`
          }
          data={monthSeries}
          hue={activeMetric === 'income' ? 'money' : 'accent'}
          isCurrency={activeMetric === 'income'}
          unit={activeMetric === 'visits' ? 'ครั้ง' : ''}
          chips={chartStats}
          loading={isInitialSkeleton}
        />

        <RcmRankedListCard
          title={onlyDebit ? `รายชื่อ${entityLabel}ที่มีลูกหนี้คงค้าง` : `อันดับ${entityLabel}`}
          metricLabel={
            onlyDebit
              ? `ค้างชำระรวม ${formatBaht(safeDebit)}`
              : activeMetric === 'income'
                ? 'เรียงตามค่ารักษาพยาบาลรวม'
                : 'เรียงตามจำนวนครั้งรับบริการ'
          }
          items={rankedItems}
          hue={activeMetric === 'income' ? 'money' : 'accent'}
          selectedId={selectedDoctorCode}
          onSelect={toggleDoctorSelection}
          emptyLabel={onlyDebit ? 'ไม่มียอดลูกหนี้คงค้าง' : `ไม่พบข้อมูล${entityLabel}`}
          headerAction={
            debitDoctorsCount > 0 ? (
              <button
                type="button"
                onClick={() => setOnlyDebit((prev) => !prev)}
                className="dd-btn"
                style={{
                  height: 28,
                  fontSize: 12,
                  padding: '0 0.6rem',
                  borderColor: onlyDebit ? 'var(--dd-down)' : undefined,
                  color: onlyDebit ? 'var(--dd-down)' : undefined,
                }}
              >
                {onlyDebit ? 'แสดงทั้งหมด' : `มีลูกหนี้ค้าง (${debitDoctorsCount})`}
              </button>
            ) : undefined
          }
        />
      </div>

      {/* 3. Sortable Financial Ledger Table */}
      <section className="dd-table-card" aria-label={`ตารางสรุปราย${entityLabel}`}>
        <div className="dd-table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h2 className="dd-panel-title">
              ตารางสรุปราย{entityLabel} ({processedDoctors.length} ท่าน)
            </h2>
            {dateMode === 'year' && showMonthlyCols && (
              <div className="dd-quarter-bar">
                {fiscalQuarters.map((q) => (
                  <span key={q.quarter} className="dd-q-pill">
                    {q.quarter}
                  </span>
                ))}
              </div>
            )}
            {selectedDoctorCode && (
              <button
                type="button"
                onClick={() => setSelectedDoctorCode(null)}
                className="dd-chip"
                style={{ cursor: 'pointer' }}
              >
                <span>เฉพาะ: {doctors.find((d) => d.doctor_code === selectedDoctorCode)?.doctor_name}</span>
                <X size={12} />
              </button>
            )}
          </div>

          <div className="dd-table-controls">
            {(dateMode === 'year' || (showDynamicMonthsOutsideYear && months.length > 0)) && (
              <button
                type="button"
                onClick={() => setShowMonthlyCols((prev) => !prev)}
                className="dd-btn"
                style={{ height: 32, fontSize: 12 }}
              >
                {showMonthlyCols ? 'ซ่อนคอลัมน์รายเดือน' : 'แสดงรายเดือน'}
              </button>
            )}

            <div className="dd-search-wrap">
              <Search size={14} className="dd-search-icon" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchDoctor}
                onChange={(e) => setSearchDoctor(e.target.value)}
                className="dd-search-input"
              />
              {searchDoctor && (
                <button
                  type="button"
                  onClick={() => setSearchDoctor('')}
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
                <th className="dd-th-sticky-1">#</th>
                <th
                  className="dd-th-sticky-2 is-sortable"
                  onClick={() => handleSort('doctor_name')}
                  title={`คลิกเพื่อเรียงตามชื่อ${entityLabel}`}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ชื่อ{entityLabel} {renderSortIcon('doctor_name')}
                  </span>
                </th>
                <th
                  className="is-sortable"
                  onClick={() => handleSort('total_visits')}
                  title="คลิกเพื่อเรียงตามจำนวนครั้งตรวจ"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ครั้งตรวจ {renderSortIcon('total_visits')}
                  </span>
                </th>
                <th
                  className="is-sortable"
                  onClick={() => handleSort('total_income')}
                  title="คลิกเพื่อเรียงตามค่ารักษาพยาบาลรวม"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ค่ารักษารวม {renderSortIcon('total_income')}
                  </span>
                </th>
                <th
                  className="is-sortable"
                  onClick={() => handleSort('total_uc_money')}
                  title="คลิกเพื่อเรียงตามสิทธิเบิก UC"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    สิทธิเบิก UC {renderSortIcon('total_uc_money')}
                  </span>
                </th>
                <th
                  className="is-sortable"
                  onClick={() => handleSort('total_rcpt_money')}
                  title="คลิกเพื่อเรียงตามยอดชำระเอง"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ชำระเอง {renderSortIcon('total_rcpt_money')}
                  </span>
                </th>
                <th
                  className="is-sortable"
                  onClick={() => handleSort('total_debit')}
                  title="คลิกเพื่อเรียงตามลูกหนี้คงค้าง"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ลูกหนี้ค้าง {renderSortIcon('total_debit')}
                  </span>
                </th>

                {activeMonthColumns.map((m) => (
                  <th key={m.key}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
                      {m.qTag && (
                        <span style={{ fontSize: 10, color: 'var(--dd-muted)', fontWeight: 500 }}>
                          {m.qTag}
                        </span>
                      )}
                      <span>{m.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isInitialSkeleton ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7 + activeMonthColumns.length}>
                      <div className="dd-skeleton" style={{ height: 22, width: '100%' }} />
                    </td>
                  </tr>
                ))
              ) : processedDoctors.length === 0 ? (
                <tr>
                  <td colSpan={7 + activeMonthColumns.length}>
                    <div className="dd-empty-box">
                      <AlertCircle size={22} />
                      <p className="dd-empty-title">{emptyTitle}</p>
                      <p className="dd-empty-desc">{emptyDesc}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedDoctors.map((doc, idx) => (
                  <tr
                    key={doc.doctor_code}
                    className={selectedDoctorCode === doc.doctor_code ? 'is-highlighted' : ''}
                  >
                    <td className="dd-td-sticky-1" style={{ color: 'var(--dd-muted)' }}>
                      {idx + 1}
                    </td>
                    <td className="dd-td-sticky-2">
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          title={doc.doctor_name}
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {doc.doctor_name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--dd-muted)' }}>
                          {doc.doctor_code}
                        </span>
                      </div>
                    </td>
                    <td>{formatInt(doc.total_visits)}</td>
                    <td style={{ fontWeight: 600 }}>{formatBaht(doc.total_income)}</td>
                    <td style={{ color: 'var(--dd-ink-2)' }}>{formatBaht(doc.total_uc_money)}</td>
                    <td style={{ color: 'var(--dd-ink-2)' }}>{formatBaht(doc.total_rcpt_money)}</td>
                    <td>
                      {(doc.total_debit ?? 0) > 0 ? (
                        <span className="dd-warn-chip">{formatBaht(doc.total_debit)}</span>
                      ) : (
                        <span className="dd-muted-zero">—</span>
                      )}
                    </td>

                    {activeMonthColumns.map((m) => {
                      const val = doc.monthly_income[m.key] || 0
                      return (
                        <td key={m.key} className={val > 0 ? '' : 'dd-muted-zero'}>
                          {val > 0 ? formatBaht(val) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>

            {!isInitialSkeleton && processedDoctors.length > 0 && (
              <tfoot>
                <tr className="dd-total-row">
                  <td className="dd-td-sticky-1">รวม</td>
                  <td className="dd-td-sticky-2">
                    ทั้งหมด ({processedDoctors.length} ท่าน)
                  </td>
                  <td>{formatInt(tableTotals.visits)}</td>
                  <td>{formatBaht(tableTotals.income)}</td>
                  <td>{formatBaht(tableTotals.uc_money)}</td>
                  <td>{formatBaht(tableTotals.rcpt_money)}</td>
                  <td>
                    {tableTotals.debit > 0 ? (
                      <span className="dd-warn-chip">{formatBaht(tableTotals.debit)}</span>
                    ) : (
                      <span className="dd-muted-zero">—</span>
                    )}
                  </td>

                  {activeMonthColumns.map((m) => {
                    const totalVal = isTableFiltered
                      ? processedDoctors.reduce((acc, d) => acc + (d.monthly_income[m.key] || 0), 0)
                      : monthlyTotals[m.key]?.income || 0
                    return (
                      <td key={m.key} className={totalVal > 0 ? '' : 'dd-muted-zero'}>
                        {totalVal > 0 ? formatBaht(totalVal) : '—'}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}
