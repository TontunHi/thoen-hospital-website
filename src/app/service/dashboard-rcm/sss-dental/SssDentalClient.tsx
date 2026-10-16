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
} from 'lucide-react'
import { DentalDoctorSummaryItem, SssDentalResult } from '@/lib/clinical/rcmDashboardService'
import './page.css'

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

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

  // Filter States
  const [searchDoctor, setSearchDoctor] = useState<string>('')
  const [selectedDoctorCode, setSelectedDoctorCode] = useState<string>('')

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

  // 12 Fiscal Month columns
  const fiscalMonthColumns = useMemo(() => {
    if (dateMode !== 'year') return []
    const prevYear = selectedYear - 1
    const curYear = selectedYear
    return [
      { key: `${prevYear}-10`, label: 'ต.ค.' },
      { key: `${prevYear}-11`, label: 'พ.ย.' },
      { key: `${prevYear}-12`, label: 'ธ.ค.' },
      { key: `${curYear}-01`, label: 'ม.ค.' },
      { key: `${curYear}-02`, label: 'ก.พ.' },
      { key: `${curYear}-03`, label: 'มี.ค.' },
      { key: `${curYear}-04`, label: 'เม.ย.' },
      { key: `${curYear}-05`, label: 'พ.ค.' },
      { key: `${curYear}-06`, label: 'มิ.ย.' },
      { key: `${curYear}-07`, label: 'ก.ค.' },
      { key: `${curYear}-08`, label: 'ส.ค.' },
      { key: `${curYear}-09`, label: 'ก.ย.' },
    ]
  }, [dateMode, selectedYear])

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

  const fetchData = useCallback(async (start = ds1, end = ds2, docFilter = selectedDoctorCode) => {
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
        setGrandTotal(json.grandTotal || {
          visits: 0,
          income: 0,
          uc_money: 0,
          rcpt_money: 0,
          discount: 0,
          debit: 0,
        })
      } else {
        setError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถเชื่อมต่อ API ได้')
    } finally {
      setLoading(false)
    }
  }, [ds1, ds2, selectedDoctorCode])

  useEffect(() => {
    fetchData(ds1, ds2, selectedDoctorCode)
  }, [ds1, ds2, selectedDoctorCode, fetchData])

  const filteredDoctors = useMemo(() => {
    if (!searchDoctor.trim()) return doctors
    const q = searchDoctor.toLowerCase()
    return doctors.filter(
      (d) =>
        d.doctor_name.toLowerCase().includes(q) ||
        d.doctor_code.toLowerCase().includes(q)
    )
  }, [doctors, searchDoctor])

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

    const rows = filteredDoctors.map((doc) => {
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

  return (
    <div className="rcm-content-container">
      {/* Page Header */}
      <div className="rcm-page-header">
        <div className="rcm-page-header-title">
          <div className="rcm-icon-badge">
            <Stethoscope size={24} />
          </div>
          <div>
            <h2 className="rcm-header-h2">
              2.1.1.1 รายงานการให้บริการทันตกรรม สิทธิ์ประกันสังคม
            </h2>
            <p className="rcm-header-desc">
              สรุปยอดการให้บริการทันตกรรมสิทธิ์ประกันสังคม โรงพยาบาลเถิน จำแนกตามทันตแพทย์ผู้ให้การรักษา
            </p>
          </div>
        </div>
        <div className="rcm-actions-row">
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="rcm-btn rcm-btn-secondary"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
          <button
            type="button"
            onClick={exportCSV}
            disabled={loading || filteredDoctors.length === 0}
            className="rcm-btn rcm-btn-primary"
          >
            <Download size={14} />
            <span>ส่งออก CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* Date Controls & Filters */}
      <div className="rcm-controls-card">
        <div className="rcm-controls-row">
          {/* Mode Selector */}
          <div className="rcm-button-group">
            <button
              type="button"
              onClick={() => {
                setDateMode('year')
                handleSelectFiscalYear(selectedYear)
              }}
              className={`rcm-mode-btn ${dateMode === 'year' ? 'active' : ''}`}
            >
              รายปีงบประมาณ
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('month')
                handleSelectMonth(selectedMonth)
              }}
              className={`rcm-mode-btn ${dateMode === 'month' ? 'active' : ''}`}
            >
              รายเดือน
            </button>
            <button
              type="button"
              onClick={() => setDateMode('custom')}
              className={`rcm-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
            >
              กำหนดเอง (วันถึงวัน)
            </button>
          </div>

          {/* Mode Details */}
          {dateMode === 'year' && (
            <div className="rcm-date-inputs">
              <span>เลือกปีงบประมาณ:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleSelectFiscalYear(Number(e.target.value))}
                className="rcm-select"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y + 543}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dateMode === 'month' && (
            <div className="rcm-date-inputs">
              <span>เลือกเดือน:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleSelectMonth(Number(e.target.value))}
                className="rcm-select"
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
            <div className="rcm-date-inputs">
              <span>ตั้งแต่:</span>
              <input
                type="date"
                value={ds1}
                onChange={(e) => setDs1(e.target.value)}
                className="rcm-input"
              />
              <span>ถึง:</span>
              <input
                type="date"
                value={ds2}
                onChange={(e) => setDs2(e.target.value)}
                className="rcm-input"
              />
            </div>
          )}
        </div>

        {/* Doctor Filters */}
        <div className="rcm-controls-row">
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '400px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                placeholder="ค้นหาชื่อทันตแพทย์..."
                value={searchDoctor}
                onChange={(e) => setSearchDoctor(e.target.value)}
                className="rcm-input"
                style={{ width: '100%', paddingLeft: '2rem' }}
              />
              <Search
                size={14}
                style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
            พบข้อมูลทันตแพทย์: <b style={{ color: '#0f172a' }}>{filteredDoctors.length}</b> ท่าน
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="rcm-kpi-grid">
        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <Users size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">จำนวนครั้งรับบริการ</p>
            <p className="rcm-kpi-val">
              {formatNumber(grandTotal.visits)}
              <span className="rcm-kpi-unit">ครั้ง</span>
            </p>
          </div>
        </div>

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">ค่ารักษาพยาบาลรวม</p>
            <p className="rcm-kpi-val" style={{ color: '#1d4ed8' }}>
              {formatCurrency(grandTotal.income)}
            </p>
          </div>
        </div>

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <Receipt size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">สิทธิเบิกชดเชย (UC)</p>
            <p className="rcm-kpi-val" style={{ color: '#15803d' }}>
              {formatCurrency(grandTotal.uc_money)}
            </p>
          </div>
        </div>

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">ชำระเงินสด / ใบเสร็จ</p>
            <p className="rcm-kpi-val" style={{ color: '#7e22ce' }}>
              {formatCurrency(grandTotal.rcpt_money)}
            </p>
          </div>
        </div>

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">ลูกหนี้คงค้าง</p>
            <p className="rcm-kpi-val" style={{ color: '#be123c' }}>
              {formatCurrency(grandTotal.debit)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rcm-table-card">
        <div className="rcm-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={18} style={{ color: '#059669' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              ตารางสรุปรายได้ทันตกรรมประกันสังคม จำแนกตามทันตแพทย์
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
            ช่วงเวลา: {ds1} ถึง {ds2}
          </span>
        </div>

        <div className="rcm-table-responsive">
          <table className="rcm-table">
            <thead>
              <tr>
                <th className="rcm-sticky-col rcm-sticky-col-1">#</th>
                <th className="rcm-sticky-col rcm-sticky-col-2" style={{ textAlign: 'center' }}>ชื่อแพทย์</th>
                <th className="rcm-sticky-col rcm-sticky-col-3">ครั้งตรวจ</th>
                <th className="rcm-sticky-col rcm-sticky-col-4">ค่ารักษารวม</th>
                <th className="rcm-sticky-col rcm-sticky-col-5">สิทธิเบิก</th>
                <th className="rcm-sticky-col rcm-sticky-col-6">ชำระเอง</th>
                <th className="rcm-sticky-col rcm-sticky-col-7">ลูกหนี้ค้าง</th>
                {dateMode === 'year'
                  ? fiscalMonthColumns.map((m) => (
                      <th key={m.key} className="rcm-month-col">
                        {m.label}
                      </th>
                    ))
                  : months.map((m) => (
                      <th key={m} className="rcm-month-col">
                        {m}
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7 + (dateMode === 'year' ? fiscalMonthColumns.length : months.length)}
                    style={{ textAlign: 'center', padding: '3rem' }}
                  >
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#059669' }} />
                    <p style={{ color: '#334155', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>กำลังดึงข้อมูลรายงานทันตกรรม...</p>
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7 + (dateMode === 'year' ? fiscalMonthColumns.length : months.length)}
                    style={{ textAlign: 'center', padding: '3rem', color: '#475569', fontWeight: 600 }}
                  >
                    ไม่พบข้อมูลการให้บริการทันตกรรมประกันสังคมในช่วงเวลานี้
                  </td>
                </tr>
              ) : (
                <>
                  {filteredDoctors.map((doc, idx) => (
                    <tr key={doc.doctor_code}>
                      <td className="rcm-sticky-col rcm-sticky-col-1 font-mono" style={{ color: '#475569', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td className="rcm-sticky-col rcm-sticky-col-2">
                        <div
                          style={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={doc.doctor_name}
                        >
                          {doc.doctor_name}
                        </div>
                      </td>
                      <td className="rcm-sticky-col rcm-sticky-col-3 font-mono" style={{ fontWeight: 600 }}>
                        {formatNumber(doc.total_visits)}
                      </td>
                      <td className="rcm-sticky-col rcm-sticky-col-4 font-mono" style={{ fontWeight: 700 }}>
                        {formatCurrency(doc.total_income)}
                      </td>
                      <td className="rcm-sticky-col rcm-sticky-col-5 font-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(doc.total_uc_money)}
                      </td>
                      <td className="rcm-sticky-col rcm-sticky-col-6 font-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(doc.total_rcpt_money)}
                      </td>
                      <td className="rcm-sticky-col rcm-sticky-col-7 font-mono" style={{ fontWeight: 600 }}>
                        {doc.total_debit > 0 ? (
                          <span className="rcm-badge-debit">{formatCurrency(doc.total_debit)}</span>
                        ) : (
                          <span style={{ color: '#64748b', fontWeight: 500 }}>฿0</span>
                        )}
                      </td>
                      {dateMode === 'year'
                        ? fiscalMonthColumns.map((m) => {
                            const val = doc.monthly_income[m.key] || 0
                            return (
                              <td
                                key={m.key}
                                className="rcm-month-col font-mono"
                                style={{
                                  color: val > 0 ? '#0f172a' : '#64748b',
                                  fontWeight: val > 0 ? 600 : 400,
                                }}
                              >
                                {val > 0 ? formatCurrency(val) : '-'}
                              </td>
                            )
                          })
                        : months.map((m) => {
                            const val = doc.monthly_income[m] || 0
                            return (
                              <td
                                key={m}
                                className="rcm-month-col font-mono"
                                style={{
                                  color: val > 0 ? '#0f172a' : '#64748b',
                                  fontWeight: val > 0 ? 600 : 400,
                                }}
                              >
                                {val > 0 ? formatCurrency(val) : '-'}
                              </td>
                            )
                          })}
                    </tr>
                  ))}

                  {/* Grand Total Row */}
                  <tr className="total-row">
                    <td className="rcm-sticky-col rcm-sticky-col-1">
                      รวม
                    </td>
                    <td className="rcm-sticky-col rcm-sticky-col-2" style={{ fontWeight: 700 }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ทั้งหมด ({filteredDoctors.length} ท่าน)
                      </div>
                    </td>
                    <td className="rcm-sticky-col rcm-sticky-col-3 font-mono" style={{ fontWeight: 700 }}>
                      {formatNumber(grandTotal.visits)}
                    </td>
                    <td className="rcm-sticky-col rcm-sticky-col-4 font-mono" style={{ fontWeight: 900 }}>
                      {formatCurrency(grandTotal.income)}
                    </td>
                    <td className="rcm-sticky-col rcm-sticky-col-5 font-mono" style={{ fontWeight: 700 }}>
                      {formatCurrency(grandTotal.uc_money)}
                    </td>
                    <td className="rcm-sticky-col rcm-sticky-col-6 font-mono" style={{ fontWeight: 700 }}>
                      {formatCurrency(grandTotal.rcpt_money)}
                    </td>
                    <td className="rcm-sticky-col rcm-sticky-col-7 font-mono" style={{ fontWeight: 700 }}>
                      {formatCurrency(grandTotal.debit)}
                    </td>
                    {dateMode === 'year'
                      ? fiscalMonthColumns.map((m) => {
                          const totalVal = monthlyTotals[m.key]?.income || 0
                          return (
                            <td
                              key={m.key}
                              className="rcm-month-col font-mono"
                              style={{
                                fontWeight: 700,
                                color: totalVal > 0 ? '#064e3b' : '#64748b',
                              }}
                            >
                              {totalVal > 0 ? formatCurrency(totalVal) : '-'}
                            </td>
                          )
                        })
                      : months.map((m) => {
                          const totalVal = monthlyTotals[m]?.income || 0
                          return (
                            <td
                              key={m}
                              className="rcm-month-col font-mono"
                              style={{
                                fontWeight: 700,
                                color: totalVal > 0 ? '#064e3b' : '#64748b',
                              }}
                            >
                              {totalVal > 0 ? formatCurrency(totalVal) : '-'}
                            </td>
                          )
                        })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
