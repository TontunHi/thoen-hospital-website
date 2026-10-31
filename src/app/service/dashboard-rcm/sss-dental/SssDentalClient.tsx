'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Stethoscope,
  Users,
  DollarSign,
  Receipt,
  Download,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Clock,
  Layers,
} from 'lucide-react'
import { DentalDoctorSummaryItem, SssDentalResult } from '@/lib/clinical/rcmDashboardService'
import './page.css'

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

type SortField =
  | 'doctor_name'
  | 'total_visits'
  | 'total_income'
  | 'total_uc_money'
  | 'total_rcpt_money'
  | 'total_debit'

type SortOrder = 'asc' | 'desc'

export default function SssDentalClient() {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = today.getMonth() + 1 >= 10 ? currentCalYear + 1 : currentCalYear

  // Date controls
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(defaultFiscalYear)
  const [ds1, setDs1] = useState<string>(`${defaultFiscalYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(`${defaultFiscalYear}-09-30`)

  // Filter & Sort States
  const [searchDoctor, setSearchDoctor] = useState<string>('')
  const [selectedDoctorCode, setSelectedDoctorCode] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('total_income')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Data States
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<DentalDoctorSummaryItem[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [grandTotal, setGrandTotal] = useState<SssDentalResult['grandTotal']>({
    visits: 0,
    income: 0,
    uc_money: 0,
    rcpt_money: 0,
    discount: 0,
    debit: 0,
  })
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, { income: number; visits: number }>>({})

  // 12 Fiscal Month columns grouped into 4 Quarters
  const fiscalQuarters = useMemo(() => {
    if (dateMode !== 'year') return []
    const prevYear = selectedYear - 1
    const curYear = selectedYear

    return [
      {
        quarter: 'ไตรมาส 1 (Q1)',
        shortTag: 'Q1',
        className: 'quarter-q1',
        months: [
          { key: `${prevYear}-10`, label: 'ต.ค.', qTag: 'Q1', qClass: 'q1-badge' },
          { key: `${prevYear}-11`, label: 'พ.ย.', qTag: 'Q1', qClass: 'q1-badge' },
          { key: `${prevYear}-12`, label: 'ธ.ค.', qTag: 'Q1', qClass: 'q1-badge' },
        ],
      },
      {
        quarter: 'ไตรมาส 2 (Q2)',
        shortTag: 'Q2',
        className: 'quarter-q2',
        months: [
          { key: `${curYear}-01`, label: 'ม.ค.', qTag: 'Q2', qClass: 'q2-badge' },
          { key: `${curYear}-02`, label: 'ก.พ.', qTag: 'Q2', qClass: 'q2-badge' },
          { key: `${curYear}-03`, label: 'มี.ค.', qTag: 'Q2', qClass: 'q2-badge' },
        ],
      },
      {
        quarter: 'ไตรมาส 3 (Q3)',
        shortTag: 'Q3',
        className: 'quarter-q3',
        months: [
          { key: `${curYear}-04`, label: 'เม.ย.', qTag: 'Q3', qClass: 'q3-badge' },
          { key: `${curYear}-05`, label: 'พ.ค.', qTag: 'Q3', qClass: 'q3-badge' },
          { key: `${curYear}-06`, label: 'มิ.ย.', qTag: 'Q3', qClass: 'q3-badge' },
        ],
      },
      {
        quarter: 'ไตรมาส 4 (Q4)',
        shortTag: 'Q4',
        className: 'quarter-q4',
        months: [
          { key: `${curYear}-07`, label: 'ก.ค.', qTag: 'Q4', qClass: 'q4-badge' },
          { key: `${curYear}-08`, label: 'ส.ค.', qTag: 'Q4', qClass: 'q4-badge' },
          { key: `${curYear}-09`, label: 'ก.ย.', qTag: 'Q4', qClass: 'q4-badge' },
        ],
      },
    ]
  }, [dateMode, selectedYear])

  // Flat list of 12 fiscal months with quarter meta
  const fiscalMonthColumns = useMemo(() => {
    return fiscalQuarters.flatMap((q) => q.months)
  }, [fiscalQuarters])

  const availableYears = useMemo(() => {
    const list = []
    for (let y = defaultFiscalYear; y >= defaultFiscalYear - 6; y--) {
      list.push(y)
    }
    return list
  }, [defaultFiscalYear])

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month)
    const mStr = String(month).padStart(2, '0')
    const lastDay = new Date(currentCalYear, month, 0).getDate()
    setDs1(`${currentCalYear}-${mStr}-01`)
    setDs2(`${currentCalYear}-${mStr}-${String(lastDay).padStart(2, '0')}`)
  }

  const handleSelectFiscalYear = (fiscalYear: number) => {
    setSelectedYear(fiscalYear)
    setDs1(`${fiscalYear - 1}-10-01`)
    setDs2(`${fiscalYear}-09-30`)
  }

  const fetchData = useCallback(
    async (start = ds1, end = ds2, docFilter = selectedDoctorCode) => {
      setLoading(true)
      setError(null)
      try {
        let url = `/api/service/dashboard-rcm/sss-dental?ds1=${start}&ds2=${end}&visits=false`
        if (docFilter) {
          url += `&doctor=${encodeURIComponent(docFilter)}`
        }
        const res = await fetch(url, { cache: 'no-store' })
        const json = await res.json()
        if (json.success) {
          setDoctors(json.doctors || [])
          setMonths(json.months || [])
          setMonthlyTotals(json.monthlyTotals || {})
          setGrandTotal(
            json.grandTotal || {
              visits: 0,
              income: 0,
              uc_money: 0,
              rcpt_money: 0,
              discount: 0,
              debit: 0,
            }
          )
        } else {
          setError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
      } catch (err: any) {
        setError(err?.message || 'ไม่สามารถเชื่อมต่อ API ได้')
      } finally {
        setLoading(false)
      }
    },
    [ds1, ds2, selectedDoctorCode]
  )

  useEffect(() => {
    fetchData(ds1, ds2, selectedDoctorCode)
  }, [ds1, ds2, selectedDoctorCode, fetchData])

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'doctor_name' ? 'asc' : 'desc')
    }
  }

  // Filtered & Sorted Doctors
  const processedDoctors = useMemo(() => {
    let result = doctors

    if (searchDoctor.trim()) {
      const q = searchDoctor.toLowerCase()
      result = result.filter(
        (d) =>
          d.doctor_name.toLowerCase().includes(q) ||
          d.doctor_code.toLowerCase().includes(q)
      )
    }

    return [...result].sort((a, b) => {
      let valA: any = a[sortField]
      let valB: any = b[sortField]

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, 'th')
        return sortOrder === 'asc' ? cmp : -cmp
      }

      valA = Number(valA) || 0
      valB = Number(valB) || 0
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })
  }, [doctors, searchDoctor, sortField, sortOrder])

  // CSV Export
  const exportCSV = () => {
    const isYearMode = dateMode === 'year'
    const headers = [
      'รหัสแพทย์',
      'ชื่อทันตแพทย์',
      'จำนวนครั้งตรวจ',
      'ค่ารักษาพยาบาลรวม (บาท)',
      'สิทธิเบิกชดเชย UC (บาท)',
      'ชำระเอง/ใบเสร็จ (บาท)',
      'ส่วนลด (บาท)',
      'ลูกหนี้คงค้าง (บาท)',
      ...(isYearMode
        ? fiscalMonthColumns.map((m) => `ยอด ${m.label}`)
        : months.map((m) => `ยอด ${m}`)),
    ]

    const rows = processedDoctors.map((doc) => {
      const monthValues = isYearMode
        ? fiscalMonthColumns.map((m) => doc.monthly_income[m.key] || 0)
        : months.map((m) => doc.monthly_income[m] || 0)

      return [
        `"${doc.doctor_code}"`,
        `"${doc.doctor_name}"`,
        doc.total_visits,
        doc.total_income,
        doc.total_uc_money,
        doc.total_rcpt_money,
        doc.total_discount,
        doc.total_debit,
        ...monthValues,
      ]
    })

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `sss_dental_report_${ds1}_to_${ds2}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatNumber = (num: number) => num.toLocaleString('th-TH')
  const formatCurrency = (num: number) =>
    '฿' + num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="rcm-sort-icon muted" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} className="rcm-sort-icon active" />
    ) : (
      <ArrowDown size={12} className="rcm-sort-icon active" />
    )
  }

  return (
    <div className="dental-page-root">
      {/* ===== COMMAND BAR (STICKY TOOLBAR) ===== */}
      <section className="dental-command-bar" aria-label="Toolbar and Filters">
        <div className="dental-command-top">
          <div className="dental-command-heading">
            <div className="dental-icon-box">
              <Stethoscope size={22} />
            </div>
            <div>
              <div className="dental-badge-row">
                <span className="dental-code-pill">2.1.1.1</span>
                <span className="dental-tag">กองทุนประกันสังคม</span>
              </div>
              <h1 className="dental-title">รายงานการให้บริการทันตกรรม สิทธิ์ประกันสังคม</h1>
              <p className="dental-subtitle">
                สรุปยอดตรวจรักษาและชดเชยค่าบริการ จำแนกตามทันตแพทย์ผู้ให้การรักษา • รพ.เถิน
              </p>
            </div>
          </div>

          <div className="dental-command-actions">
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={loading}
              className="dental-btn dental-btn-secondary"
              title="รีเฟรชข้อมูลจากฐานข้อมูล HOSxP"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>รีเฟรช</span>
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || processedDoctors.length === 0}
              className="dental-btn dental-btn-primary"
              title="ดาวน์โหลดไฟล์ตารางในรูปแบบ CSV"
            >
              <Download size={14} />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="dental-filters-row">
          {/* Mode Selector Segment */}
          <div className="dental-segmented-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              onClick={() => setDateMode('custom')}
              className={`dental-seg-btn ${dateMode === 'custom' ? 'active' : ''}`}
            >
              กำหนดเอง (วันถึงวัน)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'month'}
              onClick={() => {
                setDateMode('month')
                handleSelectMonth(selectedMonth)
              }}
              className={`dental-seg-btn ${dateMode === 'month' ? 'active' : ''}`}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'year'}
              onClick={() => {
                setDateMode('year')
                handleSelectFiscalYear(selectedYear)
              }}
              className={`dental-seg-btn ${dateMode === 'year' ? 'active' : ''}`}
            >
              รายปีงบประมาณ
            </button>
          </div>

          {/* Contextual Date Controls */}
          <div className="dental-date-selectors">
            {dateMode === 'year' && (
              <div className="dental-input-group">
                <label htmlFor="year-select" className="dental-input-label">
                  ปีงบประมาณ:
                </label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => handleSelectFiscalYear(Number(e.target.value))}
                  className="dental-select"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y + 543} (ต.ค. {y + 542} - ก.ย. {y + 543})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateMode === 'month' && (
              <div className="dental-input-group">
                <label htmlFor="month-select" className="dental-input-label">
                  เดือน:
                </label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => handleSelectMonth(Number(e.target.value))}
                  className="dental-select"
                >
                  {THAI_MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name} {currentCalYear + 543}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateMode === 'custom' && (
              <div className="dental-range-group">
                <div className="dental-input-group">
                  <span className="dental-input-label">ตั้งแต่:</span>
                  <input
                    type="date"
                    value={ds1}
                    onChange={(e) => setDs1(e.target.value)}
                    className="dental-date-input"
                  />
                </div>
                <span className="dental-range-sep">ถึง</span>
                <div className="dental-input-group">
                  <input
                    type="date"
                    value={ds2}
                    onChange={(e) => setDs2(e.target.value)}
                    className="dental-date-input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Search Doctor Box */}
          <div className="dental-search-box">
            <Search size={15} className="dental-search-icon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อทันตแพทย์..."
              value={searchDoctor}
              onChange={(e) => setSearchDoctor(e.target.value)}
              className="dental-search-input"
            />
            {searchDoctor && (
              <button
                type="button"
                onClick={() => setSearchDoctor('')}
                className="dental-search-clear"
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Match counter */}
          <div className="dental-match-counter">
            <span>ทันตแพทย์: </span>
            <b>{processedDoctors.length}</b> ท่าน
          </div>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="dental-alert-box">
          <AlertCircle size={20} className="dental-alert-icon" />
          <div className="dental-alert-content">
            <strong>เกิดข้อผิดพลาด:</strong> {error}
          </div>
        </div>
      )}

      {/* ===== COMPACT KPI METRIC STRIP ===== */}
      <section className="dental-kpi-strip" aria-label="Key Performance Indicators">
        {/* Metric 1: Total Visits */}
        <div className="dental-kpi-item">
          <div className="dental-kpi-icon-wrap kpi-visits">
            <Users size={18} />
          </div>
          <div className="dental-kpi-text">
            <span className="dental-kpi-label">จำนวนครั้งรับบริการ</span>
            <div className="dental-kpi-val-row">
              <span className="dental-kpi-number">{formatNumber(grandTotal.visits)}</span>
              <span className="dental-kpi-unit">ครั้ง</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Income */}
        <div className="dental-kpi-item">
          <div className="dental-kpi-icon-wrap kpi-income">
            <DollarSign size={18} />
          </div>
          <div className="dental-kpi-text">
            <span className="dental-kpi-label">ค่ารักษาพยาบาลรวม</span>
            <div className="dental-kpi-val-row">
              <span className="dental-kpi-number text-income">{formatCurrency(grandTotal.income)}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: UC Money */}
        <div className="dental-kpi-item">
          <div className="dental-kpi-icon-wrap kpi-uc">
            <Receipt size={18} />
          </div>
          <div className="dental-kpi-text">
            <span className="dental-kpi-label">สิทธิเบิกชดเชย (UC)</span>
            <div className="dental-kpi-val-row">
              <span className="dental-kpi-number text-uc">{formatCurrency(grandTotal.uc_money)}</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Cash Receipt */}
        <div className="dental-kpi-item">
          <div className="dental-kpi-icon-wrap kpi-rcpt">
            <DollarSign size={18} />
          </div>
          <div className="dental-kpi-text">
            <span className="dental-kpi-label">ชำระเงินสด / ใบเสร็จ</span>
            <div className="dental-kpi-val-row">
              <span className="dental-kpi-number text-rcpt">{formatCurrency(grandTotal.rcpt_money)}</span>
            </div>
          </div>
        </div>

        {/* Metric 5: Outstanding Debit */}
        <div className={`dental-kpi-item ${grandTotal.debit > 0 ? 'kpi-has-debit' : ''}`}>
          <div className="dental-kpi-icon-wrap kpi-debit">
            <AlertCircle size={18} />
          </div>
          <div className="dental-kpi-text">
            <span className="dental-kpi-label">ลูกหนี้คงค้าง</span>
            <div className="dental-kpi-val-row">
              <span className={`dental-kpi-number ${grandTotal.debit > 0 ? 'text-debit' : ''}`}>
                {formatCurrency(grandTotal.debit)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DENSE RESPONSIVE FINANCIAL LEDGER ===== */}
      <section className="dental-ledger-card" aria-label="Doctor Breakdown Table">
        {/* Table Subheader */}
        <div className="dental-ledger-header">
          <div className="dental-ledger-title">
            <FileSpreadsheet size={16} className="dental-ledger-icon" />
            <span>ตารางสรุปรายได้และสิทธิเบิกชดเชย จำแนกรายทันตแพทย์</span>
          </div>

          {/* Quarter Indicators in Year Mode */}
          {dateMode === 'year' && (
            <div className="dental-quarter-legend">
              {fiscalQuarters.map((q) => (
                <span key={q.quarter} className={`dental-quarter-pill ${q.className}`}>
                  {q.quarter}
                </span>
              ))}
            </div>
          )}

          <div className="dental-ledger-time">
            <Clock size={13} />
            <span>
              ช่วงเวลา: <b>{ds1}</b> ถึง <b>{ds2}</b>
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="dental-table-container">
          <table className="dental-table">
            <thead>
              <tr className="dental-header-row">
                <th className="th-sticky th-col-idx">#</th>
                <th
                  className="th-sticky th-col-doctor sortable"
                  onClick={() => handleSort('doctor_name')}
                  title="คลิกเพื่อเรียงตามชื่อทันตแพทย์"
                >
                  <div className="th-sort-wrapper">
                    <span>ชื่อทันตแพทย์</span>
                    {renderSortIndicator('doctor_name')}
                  </div>
                </th>
                <th
                  className="th-sticky th-col-visits sortable text-right"
                  onClick={() => handleSort('total_visits')}
                  title="คลิกเพื่อเรียงตามจำนวนครั้งตรวจ"
                >
                  <div className="th-sort-wrapper justify-end">
                    <span>ครั้งตรวจ</span>
                    {renderSortIndicator('total_visits')}
                  </div>
                </th>
                <th
                  className="th-sticky th-col-income sortable text-right"
                  onClick={() => handleSort('total_income')}
                  title="คลิกเพื่อเรียงตามค่ารักษาพยาบาลรวม"
                >
                  <div className="th-sort-wrapper justify-end">
                    <span>ค่ารักษารวม</span>
                    {renderSortIndicator('total_income')}
                  </div>
                </th>
                <th
                  className="th-col-summary sortable text-right"
                  onClick={() => handleSort('total_uc_money')}
                  title="คลิกเพื่อเรียงตามสิทธิเบิก UC"
                >
                  <div className="th-sort-wrapper justify-end">
                    <span>สิทธิเบิก UC</span>
                    {renderSortIndicator('total_uc_money')}
                  </div>
                </th>
                <th
                  className="th-col-summary sortable text-right"
                  onClick={() => handleSort('total_rcpt_money')}
                  title="คลิกเพื่อเรียงตามยอดชำระเอง"
                >
                  <div className="th-sort-wrapper justify-end">
                    <span>ชำระเอง</span>
                    {renderSortIndicator('total_rcpt_money')}
                  </div>
                </th>
                <th
                  className="th-col-summary sortable text-right"
                  onClick={() => handleSort('total_debit')}
                  title="คลิกเพื่อเรียงตามลูกหนี้คงค้าง"
                >
                  <div className="th-sort-wrapper justify-end">
                    <span>ลูกหนี้ค้าง</span>
                    {renderSortIndicator('total_debit')}
                  </div>
                </th>

                {/* Month Columns with Quarter Tag Pills */}
                {dateMode === 'year'
                  ? fiscalMonthColumns.map((m) => (
                      <th key={m.key} className={`th-month-col ${m.qClass}`}>
                        <div className="th-month-content">
                          <span className="th-qtag">{m.qTag}</span>
                          <span className="th-month-label">{m.label}</span>
                        </div>
                      </th>
                    ))
                  : months.map((m) => (
                      <th key={m} className="th-month-col">
                        <div className="th-month-content">
                          <span className="th-month-label">{m}</span>
                        </div>
                      </th>
                    ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={
                      7 + (dateMode === 'year' ? fiscalMonthColumns.length : months.length)
                    }
                    className="td-empty-state"
                  >
                    <RefreshCw size={26} className="animate-spin td-spin-icon" />
                    <p className="td-empty-title">กำลังประมวลผลข้อมูลรายงานทันตกรรม...</p>
                    <span className="td-empty-desc">กำลังเชื่อมต่อข้อมูลแบบสดจากฐานข้อมูล HOSxP</span>
                  </td>
                </tr>
              ) : processedDoctors.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      7 + (dateMode === 'year' ? fiscalMonthColumns.length : months.length)
                    }
                    className="td-empty-state"
                  >
                    <AlertCircle size={26} className="td-empty-icon" />
                    <p className="td-empty-title">ไม่พบข้อมูลการให้บริการทันตกรรมประกันสังคม</p>
                    <span className="td-empty-desc">
                      โปรดตรวจสอบช่วงเวลาหรือคำค้นหาชื่อทันตแพทย์อีกครั้ง
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {processedDoctors.map((doc, idx) => (
                    <tr key={doc.doctor_code} className="dental-row">
                      <td className="td-sticky td-col-idx font-mono">{idx + 1}</td>
                      <td className="td-sticky td-col-doctor">
                        <div className="doctor-cell" title={doc.doctor_name}>
                          <span className="doctor-name">{doc.doctor_name}</span>
                          <span className="doctor-code font-mono">{doc.doctor_code}</span>
                        </div>
                      </td>
                      <td className="td-sticky td-col-visits text-right font-mono">
                        {formatNumber(doc.total_visits)}
                      </td>
                      <td className="td-sticky td-col-income text-right font-mono font-bold text-income">
                        {formatCurrency(doc.total_income)}
                      </td>
                      <td className="td-col-summary text-right font-mono text-uc">
                        {formatCurrency(doc.total_uc_money)}
                      </td>
                      <td className="td-col-summary text-right font-mono text-rcpt">
                        {formatCurrency(doc.total_rcpt_money)}
                      </td>
                      <td className="td-col-summary text-right font-mono">
                        {doc.total_debit > 0 ? (
                          <span className="debit-pill">{formatCurrency(doc.total_debit)}</span>
                        ) : (
                          <span className="debit-zero">฿0</span>
                        )}
                      </td>

                      {/* Month Values */}
                      {dateMode === 'year'
                        ? fiscalMonthColumns.map((m) => {
                            const val = doc.monthly_income[m.key] || 0
                            return (
                              <td
                                key={m.key}
                                className={`td-month-col font-mono text-right ${
                                  val > 0 ? 'has-income' : 'is-zero'
                                }`}
                              >
                                {val > 0 ? formatCurrency(val) : '—'}
                              </td>
                            )
                          })
                        : months.map((m) => {
                            const val = doc.monthly_income[m] || 0
                            return (
                              <td
                                key={m}
                                className={`td-month-col font-mono text-right ${
                                  val > 0 ? 'has-income' : 'is-zero'
                                }`}
                              >
                                {val > 0 ? formatCurrency(val) : '—'}
                              </td>
                            )
                          })}
                    </tr>
                  ))}

                  {/* Grand Total Row */}
                  <tr className="dental-total-row">
                    <td className="td-sticky td-col-idx font-bold">รวม</td>
                    <td className="td-sticky td-col-doctor font-bold">
                      สรุปยอดทั้งหมด ({processedDoctors.length} ท่าน)
                    </td>
                    <td className="td-sticky td-col-visits text-right font-mono font-bold">
                      {formatNumber(grandTotal.visits)}
                    </td>
                    <td className="td-sticky td-col-income text-right font-mono font-heavy text-income">
                      {formatCurrency(grandTotal.income)}
                    </td>
                    <td className="td-col-summary text-right font-mono font-bold text-uc">
                      {formatCurrency(grandTotal.uc_money)}
                    </td>
                    <td className="td-col-summary text-right font-mono font-bold text-rcpt">
                      {formatCurrency(grandTotal.rcpt_money)}
                    </td>
                    <td className="td-col-summary text-right font-mono font-bold">
                      {grandTotal.debit > 0 ? (
                        <span className="debit-pill font-bold">
                          {formatCurrency(grandTotal.debit)}
                        </span>
                      ) : (
                        <span className="debit-zero">฿0</span>
                      )}
                    </td>

                    {/* Grand Total Monthly Income */}
                    {dateMode === 'year'
                      ? fiscalMonthColumns.map((m) => {
                          const totalVal = monthlyTotals[m.key]?.income || 0
                          return (
                            <td
                              key={m.key}
                              className={`td-month-col font-mono text-right font-bold ${
                                totalVal > 0 ? 'total-month-val' : 'is-zero'
                              }`}
                            >
                              {totalVal > 0 ? formatCurrency(totalVal) : '—'}
                            </td>
                          )
                        })
                      : months.map((m) => {
                          const totalVal = monthlyTotals[m]?.income || 0
                          return (
                            <td
                              key={m}
                              className={`td-month-col font-mono text-right font-bold ${
                                totalVal > 0 ? 'total-month-val' : 'is-zero'
                              }`}
                            >
                              {totalVal > 0 ? formatCurrency(totalVal) : '—'}
                            </td>
                          )
                        })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
