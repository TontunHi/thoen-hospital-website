'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity,
  Users,
  Building2,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  TrendingUp,
  Award,
  AlertCircle,
  Search,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { OpdDepartmentSummaryItem } from '@/lib/clinical/rcmDashboardService'
import './page.css'

const OpdChartCard = dynamic(() => import('./OpdChartCard'), {
  ssr: false,
  loading: () => (
    <div className="rcm-chart-card animate-pulse" style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      <span>กำลังโหลดกราฟ...</span>
    </div>
  ),
})

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

/**
 * Remove numerical ordering prefix (e.g. "01. อายุรกรรม" -> "อายุรกรรม")
 */
const cleanDeptName = (name: string): string => {
  return name.replace(/^\d+[\.\s\-]+/, '').trim()
}

export default function OpdClient() {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = today.getMonth() + 1 >= 10 ? currentCalYear + 1 : currentCalYear
  const defaultDs1 = `${defaultFiscalYear - 1}-10-01`
  const defaultDs2 = `${defaultFiscalYear}-09-30`

  // Dates & Modes: Default dynamically to ongoing fiscal year bounds
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(defaultFiscalYear)
  const [ds1, setDs1] = useState<string>(defaultDs1)
  const [ds2, setDs2] = useState<string>(defaultDs2)

  // Search & Filter
  const [search, setSearch] = useState<string>('')
  const [hideZeroRows, setHideZeroRows] = useState<boolean>(false)

  // Data States
  const [data, setData] = useState<OpdDepartmentSummaryItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

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
    const startDate = `${currentCalYear}-${mStr}-01`
    const lastDay = new Date(currentCalYear, month, 0).getDate()
    const endDate = `${currentCalYear}-${mStr}-${String(lastDay).padStart(2, '0')}`
    setDs1(startDate)
    setDs2(endDate)
    fetchData(startDate, endDate)
  }

  const handleSelectFiscalYear = (year: number) => {
    setSelectedYear(year)
    const startDate = `${year - 1}-10-01`
    const endDate = `${year}-09-30`
    setDs1(startDate)
    setDs2(endDate)
    fetchData(startDate, endDate)
  }

  const fetchData = useCallback(
    async (d1?: string, d2?: string) => {
      const startDate = d1 || ds1
      const endDate = d2 || ds2
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/service/dashboard-rcm/opd-dept-summary?ds1=${encodeURIComponent(startDate)}&ds2=${encodeURIComponent(endDate)}`
        )
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setData(json.data)
        } else {
          setError(json.error || 'ไม่สามารถดึงข้อมูลสรุปผู้ป่วยนอกแยกรายแผนกได้')
        }
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      } finally {
        setLoading(false)
      }
    },
    [ds1, ds2]
  )

  useEffect(() => {
    fetchData('2024-10-01', '2025-09-30')
  }, [fetchData])

  // Separate individual departments from the summary row
  const totalRow = useMemo(() => {
    return data.find((r) => r.dept_group === 'รวมทั้งหมด') || null
  }, [data])

  const deptRows = useMemo(() => {
    return data.filter((r) => r.dept_group !== 'รวมทั้งหมด')
  }, [data])

  // Filtered rows
  const filteredDeptRows = useMemo(() => {
    return deptRows.filter((r) => {
      if (hideZeroRows && r.patients === 0 && r.visits === 0) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const cleaned = cleanDeptName(r.dept_group).toLowerCase()
        if (!cleaned.includes(q) && !r.dept_group.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [deptRows, hideZeroRows, search])

  // Overall Statistics & KPI
  const stats = useMemo(() => {
    const totalPatients = totalRow?.patients ?? deptRows.reduce((acc, r) => acc + r.patients, 0)
    const totalVisits = totalRow?.visits ?? deptRows.reduce((acc, r) => acc + r.visits, 0)
    const avgVisitsPerPatient = totalPatients > 0 ? totalVisits / totalPatients : 0

    // Find top department by visits
    let topDeptName = '-'
    let topDeptVisits = 0
    deptRows.forEach((r) => {
      if (r.visits > topDeptVisits) {
        topDeptVisits = r.visits
        topDeptName = r.dept_group
      }
    })
    const topDeptPercent = totalVisits > 0 ? (topDeptVisits / totalVisits) * 100 : 0

    return {
      totalPatients,
      totalVisits,
      avgVisitsPerPatient,
      topDeptName,
      topDeptVisits,
      topDeptPercent,
      deptCount: deptRows.length,
    }
  }, [totalRow, deptRows])

  // Chart data sorted by visits descending
  const chartData = useMemo(() => {
    return [...deptRows]
      .filter((d) => d.visits > 0 || d.patients > 0)
      .sort((a, b) => b.visits - a.visits)
      .map((d) => ({
        name: cleanDeptName(d.dept_group),
        visits: d.visits,
        patients: d.patients,
      }))
  }, [deptRows])

  // Export CSV
  const exportCSV = () => {
    const headers = ['ลำดับ', 'แผนก', 'จำนวนคน (HN)', 'จำนวนครั้ง (VN)', 'เฉลี่ย (ครั้ง/คน)', 'สัดส่วน (% ของครั้งรวม)']
    const rows = filteredDeptRows.map((r, idx) => {
      const avg = r.patients > 0 ? (r.visits / r.patients).toFixed(2) : '0.00'
      const pct = stats.totalVisits > 0 ? ((r.visits / stats.totalVisits) * 100).toFixed(2) + '%' : '0.00%'
      return [idx + 1, `"${cleanDeptName(r.dept_group)}"`, r.patients, r.visits, avg, pct]
    })

    if (totalRow) {
      const grandAvg = totalRow.patients > 0 ? (totalRow.visits / totalRow.patients).toFixed(2) : '0.00'
      rows.push(['', '"รวมทั้งหมด"', totalRow.patients, totalRow.visits, grandAvg, '100.00%'])
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `opd_dept_summary_${ds1}_to_${ds2}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="rcm-content-container">
      {/* Page Header */}
      <div className="rcm-page-header">
        <div className="rcm-page-header-title">
          <div className="rcm-icon-badge">
            <Activity size={24} />
          </div>
          <div>
            <h2 className="rcm-header-h2">
              รายงานสรุปการให้บริการผู้ป่วยนอกโรงพยาบาลเถิน (OPD)
            </h2>
            <p className="rcm-header-p">
              สรุปจำนวนผู้รับบริการผู้ป่วยนอก (คน/ครั้ง) จำแนกตามแผนกการรักษา • ฐานข้อมูล HOSxP
            </p>
          </div>
        </div>

        <div className="rcm-header-actions">
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
            disabled={loading || filteredDeptRows.length === 0}
            className="rcm-btn rcm-btn-primary"
          >
            <Download size={14} />
            <span>ส่งออก Excel (CSV)</span>
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
              onClick={() => setDateMode('custom')}
              className={`rcm-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
            >
              📅 กำหนดเอง (วันถึงวัน)
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('month')
                handleSelectMonth(selectedMonth)
              }}
              className={`rcm-mode-btn ${dateMode === 'month' ? 'active' : ''}`}
            >
              🗓️ รายเดือน ({currentCalYear + 543})
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('year')
                handleSelectFiscalYear(selectedYear)
              }}
              className={`rcm-mode-btn ${dateMode === 'year' ? 'active' : ''}`}
            >
              📆 รายปีงบประมาณ (1 ต.ค. - 30 ก.ย.)
            </button>
          </div>

          {/* Date Inputs */}
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
              <button
                type="button"
                onClick={() => fetchData(ds1, ds2)}
                disabled={loading}
                className="rcm-btn rcm-btn-primary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ffffff' }}
              >
                <Filter size={13} style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>ดึงข้อมูล</span>
              </button>
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
                    {name} ({currentCalYear + 543})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchData(ds1, ds2)}
                disabled={loading}
                className="rcm-btn rcm-btn-primary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ffffff' }}
              >
                <Filter size={13} style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>ดึงข้อมูล</span>
              </button>
            </div>
          )}

          {dateMode === 'year' && (
            <div className="rcm-date-inputs">
              <span>ปีงบประมาณ:</span>
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
              <button
                type="button"
                onClick={() => fetchData(ds1, ds2)}
                disabled={loading}
                className="rcm-btn rcm-btn-primary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ffffff' }}
              >
                <Filter size={13} style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>ดึงข้อมูล</span>
              </button>
            </div>
          )}
        </div>

        {/* Date Range Description */}
        <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={14} style={{ color: '#059669' }} />
          <span>
            ช่วงเวลาที่แสดง: <b>{ds1}</b> ถึง <b>{ds2}</b>
          </span>
        </div>
      </div>

      {/* Top KPI Cards Grid */}
      <div className="rcm-dept-kpi-grid">
        <div className="rcm-dept-kpi-card">
          <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <p className="rcm-dept-kpi-label">ผู้ป่วยนอกรวม (คน)</p>
            <p className="rcm-dept-kpi-val" style={{ color: '#1d4ed8' }}>
              {stats.totalPatients.toLocaleString()}
            </p>
            <p className="rcm-dept-kpi-sub">
              จำนวนคนที่ไม่ซ้ำ (COUNT DISTINCT HN)
            </p>
          </div>
        </div>

        <div className="rcm-dept-kpi-card">
          <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <Activity size={22} />
          </div>
          <div>
            <p className="rcm-dept-kpi-label">จำนวนครั้งรวม (ครั้ง)</p>
            <p className="rcm-dept-kpi-val" style={{ color: '#047857' }}>
              {stats.totalVisits.toLocaleString()}
            </p>
            <p className="rcm-dept-kpi-sub">
              จำนวนการรับบริการ (COUNT DISTINCT VN)
            </p>
          </div>
        </div>

        <div className="rcm-dept-kpi-card">
          <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="rcm-dept-kpi-label">เฉลี่ยการรับบริการ</p>
            <p className="rcm-dept-kpi-val" style={{ color: '#15803d' }}>
              {stats.avgVisitsPerPatient.toFixed(2)}
            </p>
            <p className="rcm-dept-kpi-sub">
              อัตราส่วนครั้งต่อคน (ครั้ง/คน)
            </p>
          </div>
        </div>

        <div className="rcm-dept-kpi-card">
          <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
            <Award size={22} />
          </div>
          <div>
            <p className="rcm-dept-kpi-label">แผนกครองยอดบริการสูงสุด</p>
            <p className="rcm-dept-kpi-val" style={{ color: '#0f172a', fontSize: '1.1rem' }}>
              {cleanDeptName(stats.topDeptName)}
            </p>
            <p className="rcm-dept-kpi-sub">
              {stats.topDeptVisits.toLocaleString()} ครั้ง ({stats.topDeptPercent.toFixed(1)}% ของทั้งหมด)
            </p>
          </div>
        </div>
      </div>

      {/* Subtab Bar: Single Tab as requested */}
      <div className="rcm-subtab-bar">
        <button
          type="button"
          className="rcm-subtab-btn active"
        >
          <span>🏢 จำนวนผู้รับบริการแยกรายแผนก (OPD Departments)</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="rcm-table-card">
        <div className="rcm-table-header">
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Building2 size={18} style={{ color: '#0f172a' }} />
              <span>🏢 ตารางสรุปจำนวนผู้รับบริการผู้ป่วยนอก (OPD) แยกรายแผนก</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
              แสดงรายละเอียด จำนวนคน, จำนวนครั้ง, อัตราส่วนครั้งต่อคน และสัดส่วนการให้บริการแยกตามแผนก
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="ค้นหาแผนก..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rcm-input"
                style={{ paddingLeft: '1.9rem', width: '160px', fontSize: '0.82rem' }}
              />
            </div>

            {/* Hide Zero Rows Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={hideZeroRows}
                onChange={(e) => setHideZeroRows(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>ซ่อนแผนกที่ยอดเป็น 0</span>
            </label>
          </div>
        </div>

        <div className="rcm-table-responsive" style={{ maxHeight: '640px' }}>
          <table className="rcm-table">
            <thead>
              <tr>
                <th className="rcm-text-center" style={{ width: '60px' }}>ลำดับ</th>
                <th style={{ textAlign: 'left', minWidth: '220px' }}>แผนก</th>
                <th className="rcm-text-center" style={{ minWidth: '130px' }}>จำนวนคน (คน)</th>
                <th className="rcm-text-center" style={{ minWidth: '130px' }}>จำนวนครั้ง (ครั้ง)</th>
                <th className="rcm-text-center" style={{ minWidth: '130px' }}>เฉลี่ย (ครั้ง/คน)</th>
                <th style={{ textAlign: 'left', minWidth: '180px' }}>สัดส่วนการรับบริการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#059669' }} />
                    <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                      กำลังดึงข้อมูลผู้รับบริการผู้ป่วยนอก (OPD) จากฐานข้อมูล HOSxP...
                    </p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#dc2626', fontWeight: 600 }}>
                    <AlertCircle size={20} style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0 }}>{error}</p>
                  </td>
                </tr>
              ) : filteredDeptRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                    ไม่พบข้อมูลผู้ป่วยนอกตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredDeptRows.map((row, idx) => {
                  const avg = row.patients > 0 ? (row.visits / row.patients).toFixed(2) : '0.00'
                  const pct = stats.totalVisits > 0 ? (row.visits / stats.totalVisits) * 100 : 0

                  return (
                    <tr key={row.dept_group} className="rcm-dept-row">
                      <td className="rcm-text-center font-mono" style={{ color: '#64748b', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>
                        {cleanDeptName(row.dept_group)}
                      </td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 600, color: row.patients > 0 ? '#0f172a' : '#94a3b8' }}>
                        {row.patients > 0 ? row.patients.toLocaleString() : '–'}
                      </td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: row.visits > 0 ? '#047857' : '#94a3b8' }}>
                        {row.visits > 0 ? row.visits.toLocaleString() : '–'}
                      </td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 600, color: row.patients > 0 ? '#1d4ed8' : '#94a3b8' }}>
                        {row.patients > 0 ? avg : '–'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className="rcm-dept-progress-bar-bg">
                            <div
                              className="rcm-dept-progress-bar-fill"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Total Row: Prominently Highlighted in Light Green */}
            {!loading && totalRow && (
              <tfoot>
                <tr className="rcm-dept-grand-total-row total-row">
                  <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                    🏆 {cleanDeptName(totalRow.dept_group)} (ทุกแผนก)
                  </td>
                  <td className="rcm-text-center font-mono">
                    {totalRow.patients.toLocaleString()}
                  </td>
                  <td className="rcm-text-center font-mono">
                    {totalRow.visits.toLocaleString()}
                  </td>
                  <td className="rcm-text-center font-mono">
                    {totalRow.patients > 0 ? (totalRow.visits / totalRow.patients).toFixed(2) : '0.00'}
                  </td>
                  <td style={{ textAlign: 'left', paddingLeft: '0.85rem' }}>
                    <span className="font-mono" style={{ fontWeight: 900 }}>100.0%</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Visual Chart Card */}
      {!loading && chartData.length > 0 && (
        <OpdChartCard chartData={chartData} />
      )}
    </div>
  )
}
