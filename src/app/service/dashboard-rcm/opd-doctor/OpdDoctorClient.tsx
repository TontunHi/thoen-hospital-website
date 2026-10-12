'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  DollarSign,
  Receipt,
  Download,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ChevronDown,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import {
  DoctorSummaryItem,
  PttypeOption,
  OpdDoctorSummaryResult,
} from '@/lib/clinical/rcmDashboardService'
import '../sss-dental/page.css'
import './page.css'

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export default function OpdDoctorClient() {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = today.getMonth() + 1 >= 10 ? currentCalYear + 1 : currentCalYear

  // Date controls
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('custom')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(defaultFiscalYear)
  const [ds1, setDs1] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [ds2, setDs2] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // 37 Pttype Multi-select
  const [allPttypes, setAllPttypes] = useState<PttypeOption[]>([])
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>([]) // Empty means "All 37 สิทธิ์"
  const [pttypeDropdownOpen, setPttypeDropdownOpen] = useState<boolean>(false)
  const [pttypeSearch, setPttypeSearch] = useState<string>('')

  // Doctor search & Filter
  const [searchDoctor, setSearchDoctor] = useState<string>('')

  // Data States
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<DoctorSummaryItem[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [grandTotal, setGrandTotal] = useState<OpdDoctorSummaryResult['grandTotal']>({
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

  const fetchData = useCallback(
    async (start = ds1, end = ds2, pttypes = selectedPttypes) => {
      setLoading(true)
      setError(null)
      try {
        let url = `/api/service/dashboard-rcm/opd-doctor-summary?ds1=${start}&ds2=${end}`
        if (pttypes.length > 0) {
          url += `&eclaims=${encodeURIComponent(pttypes.join(','))}`
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
          if (json.allPttypeOptions && allPttypes.length === 0) {
            setAllPttypes(json.allPttypeOptions)
          }
        } else {
          setError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
      } catch (err: any) {
        setError(err?.message || 'ไม่สามารถเชื่อมต่อ API ได้')
      } finally {
        setLoading(false)
      }
    },
    [ds1, ds2, selectedPttypes, allPttypes.length]
  )

  useEffect(() => {
    fetchData(ds1, ds2, selectedPttypes)
  }, [ds1, ds2, selectedPttypes, fetchData])

  // Pttype Selection Toggles
  const togglePttype = (code: string) => {
    if (selectedPttypes.includes(code)) {
      setSelectedPttypes(selectedPttypes.filter((c) => c !== code))
    } else {
      setSelectedPttypes([...selectedPttypes, code])
    }
  }

  const selectAllPttypes = () => {
    setSelectedPttypes([]) // Empty represents "All 37 สิทธิ์"
  }

  const filteredPttypeOptions = useMemo(() => {
    if (!pttypeSearch.trim()) return allPttypes
    const q = pttypeSearch.toLowerCase()
    return allPttypes.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    )
  }, [allPttypes, pttypeSearch])

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
      'ลำดับ',
      'รหัสแพทย์',
      'ชื่อ-สกุล แพทย์',
      'ตรวจ (ครั้ง)',
      'สิทธิเบิก (บาท)',
      'ชำระเอง (บาท)',
      'ส่วนลด (บาท)',
      'ลูกหนี้คงค้าง (บาท)',
      'ค่ารักษาทั้งหมด (บาท)',
      ...(isYearMode
        ? fiscalMonthColumns.map((m) => `ยอด ${m.label}`)
        : []),
    ]

    const rows = filteredDoctors.map((doc, idx) => {
      const monthValues = isYearMode
        ? fiscalMonthColumns.map((m) => doc.monthly_income[m.key] || 0)
        : []

      return [
        idx + 1,
        `"${doc.doctor_code}"`,
        `"${doc.doctor_name}"`,
        doc.total_visits,
        doc.total_uc_money,
        doc.total_rcpt_money,
        doc.total_discount,
        doc.total_debit,
        doc.total_income,
        ...monthValues,
      ]
    })

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `opd_doctor_summary_${ds1}_to_${ds2}.csv`)
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
          <div className="rcm-icon-badge" style={{ backgroundColor: '#f0fdfa', color: '#0d9488' }}>
            <Users size={24} />
          </div>
          <div>
            <h2 className="rcm-header-h2">
              2.1.1.2 สรุปค่าบริการผู้ป่วยนอก OPD ตามสิทธิ์การรักษา
            </h2>
            <p className="rcm-header-desc">
              สรุปรายได้ผู้ป่วยนอกจำแนกรายแพทย์ พร้อมการกระจายยอดรายเดือนตลอดปีงบประมาณ และตัวกรอง 37 สิทธิ e-Claim
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
            style={{ backgroundColor: '#0d9488' }}
          >
            <Download size={14} />
            <span>ส่งออก CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="rcm-controls-card">
        <div className="rcm-controls-row">
          {/* Mode Selector */}
          <div className="rcm-button-group">
            <button
              type="button"
              onClick={() => setDateMode('custom')}
              className={`rcm-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
            >
              กำหนดเอง (วันถึงวัน)
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
              onClick={() => {
                setDateMode('year')
                handleSelectFiscalYear(selectedYear)
              }}
              className={`rcm-mode-btn ${dateMode === 'year' ? 'active' : ''}`}
            >
              รายปีงบประมาณ
            </button>
          </div>

          {/* Date Mode Inputs */}
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
                    ปีงบประมาณ {y + 543} (1 ต.ค. {y + 542} - 30 ก.ย. {y + 543})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 37 e-Claim Pttype Filter & Search */}
        <div className="rcm-controls-row">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Multi-Select Dropdown */}
            <div className="rcm-dropdown-wrapper">
              <button
                type="button"
                onClick={() => setPttypeDropdownOpen(!pttypeDropdownOpen)}
                className="rcm-dropdown-btn"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Filter size={14} style={{ color: '#0d9488' }} />
                  <span>
                    {selectedPttypes.length === 0
                      ? '✓ เลือกทุกสิทธิ (37 สิทธิ)'
                      : `เลือก ${selectedPttypes.length} สิทธิ`}
                  </span>
                </div>
                <ChevronDown size={14} />
              </button>

              {pttypeDropdownOpen && (
                <div className="rcm-dropdown-panel">
                  <div className="rcm-dropdown-search">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                        กลุ่มสิทธิ e-Claim (มาตรฐาน 37 กลุ่ม)
                      </span>
                      <button
                        type="button"
                        onClick={selectAllPttypes}
                        style={{ fontSize: '0.75rem', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ✓ เลือกทุกสิทธิ
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="พิมพ์ค้นหารหัสหรือชื่อสิทธิ..."
                      value={pttypeSearch}
                      onChange={(e) => setPttypeSearch(e.target.value)}
                      className="rcm-input"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="rcm-dropdown-items">
                    {filteredPttypeOptions.map((opt) => {
                      const isSelected = selectedPttypes.includes(opt.code)
                      return (
                        <div
                          key={opt.code}
                          onClick={() => togglePttype(opt.code)}
                          className={`rcm-dropdown-item ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            style={{ cursor: 'pointer' }}
                          />
                          <span>
                            <b>{opt.code}</b> : {opt.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ padding: '0.5rem', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setPttypeDropdownOpen(false)}
                      className="rcm-btn rcm-btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    >
                      ปิดหน้าต่าง
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Doctor Search */}
            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                placeholder="ค้นหาชื่อแพทย์..."
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

          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            พบข้อมูลแพทย์: <b>{filteredDoctors.length}</b> ท่าน
          </div>
        </div>

        {/* Selected Badges */}
        {selectedPttypes.length > 0 && (
          <div className="rcm-badge-list">
            <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>สิทธิที่เลือก:</span>
            {selectedPttypes.map((code) => {
              const opt = allPttypes.find((p) => p.code === code)
              return (
                <span key={code} className="rcm-filter-tag">
                  <span>{code}: {opt?.name || code}</span>
                  <button
                    type="button"
                    onClick={() => togglePttype(code)}
                    className="rcm-tag-remove"
                  >
                    <X size={12} />
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={selectAllPttypes}
              style={{ fontSize: '0.75rem', color: '#e11d48', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              ล้างตัวกรองสิทธิ์
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="rcm-kpi-grid">
        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#f0fdfa', color: '#0d9488' }}>
            <Users size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">ผู้ป่วยนอกทั้งหมด</p>
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
            <FileSpreadsheet size={18} style={{ color: '#0d9488' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              ตารางสรุปค่าบริการผู้ป่วยนอก จำแนกรายแพทย์
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ช่วงเวลา: {ds1} ถึง {ds2}
          </span>
        </div>

        <div className="rcm-table-responsive">
          <table className="rcm-table">
            <thead>
              <tr>
                <th className="rcm-sticky-col rcm-sticky-col-1">ลำดับ</th>
                <th className="rcm-sticky-col rcm-sticky-col-2" style={{ textAlign: 'center' }}>ชื่อ-สกุล แพทย์</th>
                <th className="rcm-text-center" style={{ minWidth: '95px' }}>ตรวจ (ครั้ง)</th>
                <th className="rcm-text-right" style={{ minWidth: '110px' }}>สิทธิเบิก</th>
                <th className="rcm-text-right" style={{ minWidth: '100px' }}>ชำระเอง</th>
                <th className="rcm-text-right" style={{ minWidth: '110px' }}>ลูกหนี้คงค้าง</th>
                <th className="rcm-text-right" style={{ minWidth: '130px', backgroundColor: '#d1fae5', color: '#064e3b', fontWeight: 800 }}>ค่ารักษาทั้งหมด (บาท)</th>
                {dateMode === 'year' &&
                  fiscalMonthColumns.map((m) => (
                    <th key={m.key} className="rcm-month-col">
                      {m.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7 + (dateMode === 'year' ? fiscalMonthColumns.length : 0)}
                    style={{ textAlign: 'center', padding: '3rem' }}
                  >
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#0d9488' }} />
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>กำลังดึงข้อมูลรายงานผู้ป่วยนอก...</p>
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7 + (dateMode === 'year' ? fiscalMonthColumns.length : 0)}
                    style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}
                  >
                    ไม่พบข้อมูลการตรวจรักษาตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                <>
                  {filteredDoctors.map((doc, idx) => (
                    <tr key={doc.doctor_code}>
                      <td className="rcm-sticky-col rcm-sticky-col-1 font-mono" style={{ color: '#94a3b8' }}>
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
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 500 }}>
                        {formatNumber(doc.total_visits)}
                      </td>
                      <td className="rcm-text-right font-mono" style={{ color: '#047857', fontWeight: 500 }}>
                        {formatCurrency(doc.total_uc_money)}
                      </td>
                      <td className="rcm-text-right font-mono" style={{ color: '#b45309', fontWeight: 500 }}>
                        {formatCurrency(doc.total_rcpt_money)}
                      </td>
                      <td className="rcm-text-right font-mono">
                        {doc.total_debit > 0 ? (
                          <span className="rcm-badge-debit">{formatCurrency(doc.total_debit)}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>฿0</span>
                        )}
                      </td>
                      <td
                        className="rcm-text-right font-mono"
                        style={{
                          backgroundColor: '#ecfdf5',
                          color: '#064e3b',
                          fontWeight: 700,
                        }}
                      >
                        {formatCurrency(doc.total_income)}
                      </td>
                      {dateMode === 'year' &&
                        fiscalMonthColumns.map((m) => {
                          const val = doc.monthly_income[m.key] || 0
                          return (
                            <td
                              key={m.key}
                              className="rcm-month-col font-mono"
                              style={{
                                color: val > 0 ? '#1e293b' : '#cbd5e1',
                                fontWeight: val > 0 ? 500 : 400,
                              }}
                            >
                              {val > 0 ? formatCurrency(val) : '-'}
                            </td>
                          )
                        })}
                    </tr>
                  ))}

                  {/* Total Row */}
                  <tr className="total-row">
                    <td className="rcm-sticky-col rcm-sticky-col-1 font-bold">
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
                    <td className="rcm-text-center font-mono" style={{ fontWeight: 700 }}>
                      {formatNumber(grandTotal.visits)}
                    </td>
                    <td className="rcm-text-right font-mono" style={{ color: '#064e3b', fontWeight: 700 }}>
                      {formatCurrency(grandTotal.uc_money)}
                    </td>
                    <td className="rcm-text-right font-mono" style={{ color: '#92400e', fontWeight: 700 }}>
                      {formatCurrency(grandTotal.rcpt_money)}
                    </td>
                    <td className="rcm-text-right font-mono" style={{ color: '#991b1b', fontWeight: 700 }}>
                      {formatCurrency(grandTotal.debit)}
                    </td>
                    <td
                      className="rcm-text-right font-mono"
                      style={{
                        backgroundColor: '#d1fae5',
                        color: '#064e3b',
                        fontWeight: 800,
                      }}
                    >
                      {formatCurrency(grandTotal.income)}
                    </td>
                    {dateMode === 'year' &&
                      fiscalMonthColumns.map((m) => {
                        const totalVal = monthlyTotals[m.key]?.income || 0
                        return (
                          <td
                            key={m.key}
                            className="rcm-month-col font-mono"
                            style={{
                              fontWeight: 700,
                              color: totalVal > 0 ? '#0f172a' : '#94a3b8',
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
