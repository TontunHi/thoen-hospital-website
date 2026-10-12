'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BedDouble,
  Users,
  Activity,
  DollarSign,
  Receipt,
  Download,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Send,
  BarChart3,
  Building,
  Stethoscope,
  Clock,
  RotateCcw,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { IPDRecord } from '@/lib/clinical/rcmDashboardService'
import '../sss-dental/page.css'
import './page.css'

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const CHART_COLORS = [
  '#059669', '#10b981', '#14b8a6', '#0d9488', '#34d399', '#2dd4bf', '#047857'
]

export default function IpdClient() {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = today.getMonth() + 1 >= 10 ? currentCalYear + 1 : currentCalYear

  // Dates & Modes
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

  // Subtab within IPD
  const [subTab, setSubTab] = useState<'overview' | 'list' | 'ward' | 'doctor'>('overview')

  // Filters
  const [search, setSearch] = useState<string>('')
  const [wardFilter, setWardFilter] = useState<string>('all')
  const [pttypeFilter, setPttypeFilter] = useState<string>('all')
  const [doctorFilter, setDoctorFilter] = useState<string>('all')
  const [delayGroupFilter, setDelayGroupFilter] = useState<string>('all')

  // Data States
  const [data, setData] = useState<IPDRecord[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Telegram test trigger state
  const [telegramLoading, setTelegramLoading] = useState<boolean>(false)

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

  const fetchData = useCallback(async (start = ds1, end = ds2) => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/service/dashboard-rcm/ipd-report?ds1=${start}&ds2=${end}`
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setData(json.data || [])
      } else {
        setError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถเชื่อมต่อ API ได้')
    } finally {
      setLoading(false)
    }
  }, [ds1, ds2])

  useEffect(() => {
    fetchData(ds1, ds2)
  }, [ds1, ds2, fetchData])

  // Telegram Notification Trigger
  const handleSendTelegramTest = async () => {
    if (!confirm('ต้องการส่งข้อความสรุปชาร์ตค้าง IPD เข้ากลุ่ม Telegram โรงพยาบาลตอนนี้เลยใช่หรือไม่?')) {
      return
    }
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/service/dashboard-rcm/telegram-notify', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        alert('✅ ' + json.message)
      } else {
        alert('❌ เกิดข้อผิดพลาด: ' + (json.error || 'ไม่สามารถส่งข้อความได้'))
      }
    } catch (err: any) {
      alert('❌ ไม่สามารถเชื่อมต่อ API ได้: ' + err.message)
    } finally {
      setTelegramLoading(false)
    }
  }

  // Wards and Doctors options
  const wardOptions = useMemo(() => {
    const map = new Map<string, string>()
    data.forEach((d) => {
      if (d.ward) map.set(d.ward, d.ward_name || d.ward)
    })
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }))
  }, [data])

  const pttypeOptions = useMemo(() => {
    const map = new Map<string, string>()
    data.forEach((d) => {
      if (d.pttype) map.set(d.pttype, d.pttypename || d.pttype)
    })
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }))
  }, [data])

  const doctorOptions = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.dchdoctor).filter(Boolean))).sort()
  }, [data])

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((d) => {
      if (wardFilter !== 'all' && d.ward !== wardFilter) return false
      if (pttypeFilter !== 'all' && d.pttype !== pttypeFilter) return false
      if (doctorFilter !== 'all' && d.dchdoctor !== doctorFilter) return false

      if (delayGroupFilter !== 'all') {
        if (delayGroupFilter === 'gt15' && (d.summary_days === null || d.summary_days <= 15)) return false
        if (delayGroupFilter === 'b8to15' && (d.summary_days === null || d.summary_days < 8 || d.summary_days > 15)) return false
        if (delayGroupFilter === 'lt8' && (d.summary_days === null || d.summary_days < 0 || d.summary_days >= 8)) return false
        if (delayGroupFilter === 'notFinal' && d.summary_days !== null) return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        const match =
          d.an.toLowerCase().includes(q) ||
          d.hn.toLowerCase().includes(q) ||
          d.cid.toLowerCase().includes(q) ||
          d.ptname.toLowerCase().includes(q) ||
          d.pdx.toLowerCase().includes(q) ||
          d.pdxname.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [data, wardFilter, pttypeFilter, doctorFilter, delayGroupFilter, search])

  // Metrics
  const metrics = useMemo(() => {
    const totalCases = filteredData.length
    const totalIncome = filteredData.reduce((acc, curr) => acc + (Number(curr.income) || 0), 0)
    const totalDebit = filteredData.reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0)
    const totalAdjrw = filteredData.reduce((acc, curr) => acc + (Number(curr.adjrw) || 0), 0)
    const avgCmi = totalCases > 0 ? totalAdjrw / totalCases : 0
    const totalLos = filteredData.reduce((acc, curr) => acc + (Number(curr.los) || 0), 0)
    const avgLos = totalCases > 0 ? totalLos / totalCases : 0

    const gt15 = filteredData.filter((d) => d.summary_days !== null && d.summary_days > 15).length
    const b8to15 = filteredData.filter((d) => d.summary_days !== null && d.summary_days >= 8 && d.summary_days <= 15).length
    const lt8 = filteredData.filter((d) => d.summary_days !== null && d.summary_days >= 0 && d.summary_days < 8).length
    const notFinal = filteredData.filter((d) => d.summary_days === null).length

    return { totalCases, totalIncome, totalDebit, totalAdjrw, avgCmi, totalLos, avgLos, gt15, b8to15, lt8, notFinal }
  }, [filteredData])

  // Breakdown by Ward
  const wardBreakdown = useMemo(() => {
    const map: Record<string, { ward_name: string; cases: number; los: number; income: number; debit: number; adjrw: number }> = {}
    filteredData.forEach((d) => {
      const w = d.ward_name || d.ward || 'ไม่ระบุ'
      if (!map[w]) {
        map[w] = { ward_name: w, cases: 0, los: 0, income: 0, debit: 0, adjrw: 0 }
      }
      map[w].cases += 1
      map[w].los += Number(d.los) || 0
      map[w].income += Number(d.income) || 0
      map[w].debit += Number(d.debit) || 0
      map[w].adjrw += Number(d.adjrw) || 0
    })
    return Object.values(map).sort((a, b) => b.cases - a.cases)
  }, [filteredData])

  // Breakdown by Doctor
  const doctorBreakdown = useMemo(() => {
    const map: Record<string, { doctor: string; cases: number; los: number; income: number; debit: number; adjrw: number }> = {}
    filteredData.forEach((d) => {
      const doc = d.dchdoctor || 'ไม่ระบุแพทย์'
      if (!map[doc]) {
        map[doc] = { doctor: doc, cases: 0, los: 0, income: 0, debit: 0, adjrw: 0 }
      }
      map[doc].cases += 1
      map[doc].los += Number(d.los) || 0
      map[doc].income += Number(d.income) || 0
      map[doc].debit += Number(d.debit) || 0
      map[doc].adjrw += Number(d.adjrw) || 0
    })
    return Object.values(map).sort((a, b) => b.cases - a.cases)
  }, [filteredData])

  // Chart data
  const chartDelayData = useMemo(() => {
    return [
      { name: '< 8 วัน', cases: metrics.lt8, color: '#10b981' },
      { name: '8 - 15 วัน', cases: metrics.b8to15, color: '#f59e0b' },
      { name: '> 15 วัน (ล่าช้า)', cases: metrics.gt15, color: '#ef4444' },
      { name: 'ยังไม่สรุปชาร์ต', cases: metrics.notFinal, color: '#64748b' },
    ]
  }, [metrics])

  const exportCSV = () => {
    const headers = [
      'AN', 'HN', 'เลขประจำตัวประชาชน (CID)', 'ชื่อผู้ป่วย', 'เพศ', 'อายุ',
      'วันรับไว้ (Admit)', 'วันจำหน่าย (Discharge)', 'วันนอน (LOS)',
      'หอผู้ป่วย', 'แพทย์ผู้สั่งจำหน่าย', 'สิทธิการรักษา',
      'รหัสโรคหลัก (PDX)', 'ชื่อโรคหลัก', 'AdjRW',
      'ค่ารักษาพยาบาล (บาท)', 'ลูกหนี้ค้างชำระ (บาท)', 'สถานะสรุปชาร์ต', 'สรุปชาร์ตหลังจำหน่าย (วัน)'
    ]

    const rows = filteredData.map((d) => [
      `"${d.an}"`,
      `"${d.hn}"`,
      `"${d.cid}"`,
      `"${d.ptname}"`,
      d.sex,
      d.age,
      d.admdate,
      d.dchdate,
      d.los,
      `"${d.ward_name}"`,
      `"${d.dchdoctor}"`,
      `"${d.pttypename}"`,
      d.pdx,
      `"${d.pdxname}"`,
      d.adjrw,
      d.income,
      d.debit,
      d.status,
      d.summary_days !== null ? d.summary_days : 'ยังไม่สรุป',
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `ipd_report_${ds1}_to_${ds2}.csv`)
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
            <BedDouble size={24} />
          </div>
          <div>
            <h2 className="rcm-header-h2">
              2.1.2.1 รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน (IPD)
            </h2>
            <p className="rcm-header-desc">
              สรุปข้อมูลผู้ป่วยใน จำแนกตามหอผู้ป่วยและแพทย์ผู้สั่งจำหน่าย • ตรวจสอบวันนอน, ค่า CMI, และสถานะการสรุปชาร์ต
            </p>
          </div>
        </div>
        <div className="rcm-actions-row">
          <button
            type="button"
            onClick={handleSendTelegramTest}
            disabled={telegramLoading}
            className="rcm-btn rcm-btn-secondary"
            title="ส่งสรุปชาร์ตค้างรายแพทย์เข้า Telegram โรงพยาบาล"
          >
            <Send size={14} className={telegramLoading ? 'animate-spin' : ''} style={{ color: '#0284c7' }} />
            <span>ส่งแจ้งเตือน Telegram</span>
          </button>
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
            disabled={loading || filteredData.length === 0}
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

          {/* Date Range Inputs */}
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

        {/* Filters Row */}
        <div className="rcm-controls-row">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Ward Filter */}
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">🏥 หอผู้ป่วยทั้งหมด</option>
              {wardOptions.map((w) => (
                <option key={w.code} value={w.code}>{w.name}</option>
              ))}
            </select>

            {/* Pttype Filter */}
            <select
              value={pttypeFilter}
              onChange={(e) => setPttypeFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">💳 สิทธิการรักษาทั้งหมด</option>
              {pttypeOptions.map((p) => (
                <option key={p.code} value={p.code}>{p.code}: {p.name}</option>
              ))}
            </select>

            {/* Doctor Filter */}
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">👨‍⚕️ แพทย์ D/C ทั้งหมด</option>
              {doctorOptions.map((doc) => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>

            {/* Delay Group Filter */}
            <select
              value={delayGroupFilter}
              onChange={(e) => setDelayGroupFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">⏱️ ทุกสถานะสรุปชาร์ต</option>
              <option value="lt8">สรุปเร็ว (&lt; 8 วัน)</option>
              <option value="b8to15">สรุปปานกลาง (8 - 15 วัน)</option>
              <option value="gt15">สรุปล่าช้า (&gt; 15 วัน)</option>
              <option value="notFinal">ยังไม่สรุปชาร์ต</option>
            </select>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder="ค้นหา AN, HN, ชื่อ, CID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
            แสดงผล: <b>{filteredData.length.toLocaleString()}</b> / {data.length.toLocaleString()} ราย
          </div>
        </div>
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
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <Users size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">ผู้ป่วยจำหน่ายทั้งหมด</p>
            <p className="rcm-kpi-val">
              {formatNumber(metrics.totalCases)}
              <span className="rcm-kpi-unit">ราย</span>
            </p>
          </div>
        </div>

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#f0fdfa', color: '#0d9488' }}>
            <Activity size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">CMI เฉลี่ย / วันนอนเฉลี่ย</p>
            <p className="rcm-kpi-val" style={{ color: '#0d9488' }}>
              {metrics.avgCmi.toFixed(4)}
              <span className="rcm-kpi-unit">({metrics.avgLos.toFixed(1)} วัน)</span>
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
              {formatCurrency(metrics.totalIncome)}
            </p>
          </div>
        </div>

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}>
            <Activity size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">AdjRW รวม (ค่าน้ำหนัก)</p>
            <p className="rcm-kpi-val" style={{ color: '#be185d' }}>
              {metrics.totalAdjrw.toFixed(2)}
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
              {formatCurrency(metrics.totalDebit)}
            </p>
          </div>
        </div>
      </div>

      {/* Subtab Selector */}
      <div className="rcm-subtab-bar">
        <button
          type="button"
          onClick={() => setSubTab('overview')}
          className={`rcm-subtab-btn ${subTab === 'overview' ? 'active' : ''}`}
        >
          <BarChart3 size={16} />
          <span>ภาพรวมสถิติและกราฟ (Overview)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('list')}
          className={`rcm-subtab-btn ${subTab === 'list' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>รายชื่อผู้ป่วยใน ({filteredData.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ward')}
          className={`rcm-subtab-btn ${subTab === 'ward' ? 'active' : ''}`}
        >
          <Building size={16} />
          <span>แยกตามหอผู้ป่วย ({wardBreakdown.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('doctor')}
          className={`rcm-subtab-btn ${subTab === 'doctor' ? 'active' : ''}`}
        >
          <Stethoscope size={16} />
          <span>แยกตามแพทย์ D/C ({doctorBreakdown.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: Overview with Recharts */}
      {subTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="rcm-chart-grid">
            {/* Chart 1: Cases by Ward */}
            <div className="rcm-chart-card">
              <div className="rcm-chart-header">
                <h4 className="rcm-chart-title">จำนวนผู้ป่วยจำหน่ายแยกตามหอผู้ป่วย</h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>เคส (ราย)</span>
              </div>
              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wardBreakdown}>
                    <XAxis dataKey="ward_name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [`${val} ราย`, 'ผู้ป่วยจำหน่าย']} />
                    <Bar dataKey="cases" radius={[6, 6, 0, 0]}>
                      {wardBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Summary Delay Distribution */}
            <div className="rcm-chart-card">
              <div className="rcm-chart-header">
                <h4 className="rcm-chart-title">การกระจายระยะเวลาสรุปชาร์ตหลังจำหน่าย</h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>จำนวนชาร์ต (ใบ)</span>
              </div>
              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDelayData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [`${val} ชาร์ต`, 'จำนวน']} />
                    <Bar dataKey="cases" radius={[6, 6, 0, 0]}>
                      {chartDelayData.map((entry, index) => (
                        <Cell key={`delay-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Patient List (Full 13 CID per user instruction) */}
      {subTab === 'list' && (
        <div className="rcm-table-card">
          <div className="rcm-table-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              รายชื่อผู้ป่วยในจำหน่าย (Intranet ตรวจสอบข้อมูล)
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              แสดงเลขบัตรประชาชน 13 หลักเต็มสำหรับการปฏิบัติงาน
            </span>
          </div>

          <div className="rcm-table-responsive">
            <table className="rcm-table">
              <thead>
                <tr>
                  <th>AN</th>
                  <th>HN</th>
                  <th>เลขบัตรประชาชน (CID)</th>
                  <th>ชื่อ-สกุลผู้ป่วย</th>
                  <th className="rcm-text-center">เพศ</th>
                  <th className="rcm-text-right">อายุ</th>
                  <th>วันจำหน่าย</th>
                  <th className="rcm-text-right">วันนอน</th>
                  <th>โรคหลัก (PDX)</th>
                  <th className="rcm-text-right">AdjRW</th>
                  <th className="rcm-text-right">ค่ารักษา</th>
                  <th className="rcm-text-right">ลูกหนี้</th>
                  <th className="rcm-text-center">สถานะชาร์ต</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '3rem' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#059669' }} />
                      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>กำลังดึงข้อมูลรายชื่อผู้ป่วยใน...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      ไม่พบข้อมูลผู้ป่วยในตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredData.map((pt) => (
                    <tr key={pt.an}>
                      <td className="font-mono" style={{ fontWeight: 600 }}>{pt.an}</td>
                      <td className="font-mono">{pt.hn}</td>
                      <td className="font-mono">{pt.cid || '-'}</td>
                      <td><b>{pt.ptname}</b></td>
                      <td className="rcm-text-center">{pt.sex}</td>
                      <td className="rcm-text-right">{pt.age}</td>
                      <td>{pt.dchdate}</td>
                      <td className="rcm-text-right font-mono">{pt.los}</td>
                      <td>
                        <span title={pt.pdxname}><b>{pt.pdx}</b> {pt.pdxname ? `(${pt.pdxname})` : ''}</span>
                      </td>
                      <td className="rcm-text-right font-mono" style={{ color: '#be185d' }}>
                        {Number(pt.adjrw || 0).toFixed(4)}
                      </td>
                      <td className="rcm-text-right font-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(pt.income)}
                      </td>
                      <td className="rcm-text-right font-mono" style={{ color: pt.debit > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {formatCurrency(pt.debit)}
                      </td>
                      <td className="rcm-text-center">
                        {pt.summary_days !== null ? (
                          <span className="rcm-status-pill rcm-status-done">
                            สรุปแล้ว ({pt.summary_days} วัน)
                          </span>
                        ) : (
                          <span className="rcm-status-pill rcm-status-pending">
                            ยังไม่สรุป
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Ward Breakdown */}
      {subTab === 'ward' && (
        <div className="rcm-table-card">
          <div className="rcm-table-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              สรุปข้อมูลผู้ป่วยในแยกตามหอผู้ป่วย (Ward)
            </h3>
          </div>
          <div className="rcm-table-responsive">
            <table className="rcm-table">
              <thead>
                <tr>
                  <th>หอผู้ป่วย (Ward)</th>
                  <th className="rcm-text-right">จำนวนเคส (ราย)</th>
                  <th className="rcm-text-right">วันนอนรวม (วัน)</th>
                  <th className="rcm-text-right">LOS เฉลี่ย</th>
                  <th className="rcm-text-right">AdjRW รวม</th>
                  <th className="rcm-text-right">CMI เฉลี่ย</th>
                  <th className="rcm-text-right">ค่ารักษาพยาบาล</th>
                  <th className="rcm-text-right">ลูกหนี้คงค้าง</th>
                </tr>
              </thead>
              <tbody>
                {wardBreakdown.map((w) => (
                  <tr key={w.ward_name}>
                    <td style={{ fontWeight: 700 }}>{w.ward_name}</td>
                    <td className="rcm-text-right font-mono">{formatNumber(w.cases)}</td>
                    <td className="rcm-text-right font-mono">{formatNumber(w.los)}</td>
                    <td className="rcm-text-right font-mono">{(w.cases > 0 ? w.los / w.cases : 0).toFixed(1)}</td>
                    <td className="rcm-text-right font-mono" style={{ color: '#be185d' }}>{w.adjrw.toFixed(2)}</td>
                    <td className="rcm-text-right font-mono">{(w.cases > 0 ? w.adjrw / w.cases : 0).toFixed(4)}</td>
                    <td className="rcm-text-right font-mono" style={{ fontWeight: 700 }}>{formatCurrency(w.income)}</td>
                    <td className="rcm-text-right font-mono" style={{ color: w.debit > 0 ? '#b91c1c' : '#94a3b8' }}>{formatCurrency(w.debit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Doctor Breakdown */}
      {subTab === 'doctor' && (
        <div className="rcm-table-card">
          <div className="rcm-table-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              สรุปข้อมูลผู้ป่วยในแยกตามแพทย์ผู้สั่งจำหน่าย (D/C Doctor)
            </h3>
          </div>
          <div className="rcm-table-responsive">
            <table className="rcm-table">
              <thead>
                <tr>
                  <th>ชื่อแพทย์ผู้สั่งจำหน่าย</th>
                  <th className="rcm-text-right">จำนวนเคส (ราย)</th>
                  <th className="rcm-text-right">วันนอนรวม (วัน)</th>
                  <th className="rcm-text-right">LOS เฉลี่ย</th>
                  <th className="rcm-text-right">AdjRW รวม</th>
                  <th className="rcm-text-right">CMI เฉลี่ย</th>
                  <th className="rcm-text-right">ค่ารักษาพยาบาล</th>
                  <th className="rcm-text-right">ลูกหนี้คงค้าง</th>
                </tr>
              </thead>
              <tbody>
                {doctorBreakdown.map((doc) => (
                  <tr key={doc.doctor}>
                    <td style={{ fontWeight: 700 }}>{doc.doctor}</td>
                    <td className="rcm-text-right font-mono">{formatNumber(doc.cases)}</td>
                    <td className="rcm-text-right font-mono">{formatNumber(doc.los)}</td>
                    <td className="rcm-text-right font-mono">{(doc.cases > 0 ? doc.los / doc.cases : 0).toFixed(1)}</td>
                    <td className="rcm-text-right font-mono" style={{ color: '#be185d' }}>{doc.adjrw.toFixed(2)}</td>
                    <td className="rcm-text-right font-mono">{(doc.cases > 0 ? doc.adjrw / doc.cases : 0).toFixed(4)}</td>
                    <td className="rcm-text-right font-mono" style={{ fontWeight: 700 }}>{formatCurrency(doc.income)}</td>
                    <td className="rcm-text-right font-mono" style={{ color: doc.debit > 0 ? '#b91c1c' : '#94a3b8' }}>{formatCurrency(doc.debit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
