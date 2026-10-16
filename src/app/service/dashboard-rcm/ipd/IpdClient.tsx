'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BedDouble,
  Users,
  Activity,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Stethoscope,
  Clock,
  RotateCcw,
  ChevronRight,
  X,
  Filter,
  TrendingUp,
  Award,
  Calendar,
  Building2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { IPDRecord, IpdDepartmentAdjrwItem } from '@/lib/clinical/rcmDashboardService'
import '../sss-dental/page.css'
import './page.css'

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const IPD_DEPARTMENTS: {
  key: keyof Omit<IpdDepartmentAdjrwItem, 'month' | 'total' | 'total_patients' | 'total_visits' | 'adjrw_sum' | 'cmi' | 'depts'>
  name: string
  color: string
  bg: string
  border: string
}[] = [
  { key: 'medicine', name: 'อายุรกรรม', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'surgery', name: 'ศัลยกรรม', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'obgyn', name: 'สูตินารีเวชกรรม', color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  { key: 'pediatrics', name: 'กุมารเวชกรรม', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  { key: 'orthopedics', name: 'ออร์โธปิติกส์', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  { key: 'ent', name: 'ENT', color: '#7e22ce', bg: '#faf5ff', border: '#e9d5ff' },
  { key: 'eye', name: 'จักษุ', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { key: 'other', name: 'อื่นๆ', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  { key: 'dental', name: 'ทันตกรรม', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  { key: 'psychiatry', name: 'จิตเวช', color: '#9333ea', bg: '#faf5ff', border: '#f3e8ff' },
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

  // Subtab within IPD: 5 tabs
  const [subTab, setSubTab] = useState<'list' | 'doctor' | 'doctor_dc' | 'department' | 'overview'>('list')

  // Filters
  const [search, setSearch] = useState<string>('')
  const [wardFilter, setWardFilter] = useState<string>('all')
  const [pttypeFilter, setPttypeFilter] = useState<string>('all')
  const [doctorAdmitFilter, setDoctorAdmitFilter] = useState<string>('all')
  const [doctorDcFilter, setDoctorDcFilter] = useState<string>('all')
  const [delayGroupFilter, setDelayGroupFilter] = useState<string>('all')

  // Data States
  const [data, setData] = useState<IPDRecord[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Department SumAdjRW States
  const [deptAdjrwData, setDeptAdjrwData] = useState<IpdDepartmentAdjrwItem[]>([])
  const [deptAdjrwLoading, setDeptAdjrwLoading] = useState<boolean>(false)
  const [deptAdjrwError, setDeptAdjrwError] = useState<string | null>(null)
  const [selectedDeptMonth, setSelectedDeptMonth] = useState<string>('all')
  const [hideZeroRows, setHideZeroRows] = useState<boolean>(false)

  const deptMonthRows = useMemo(() => deptAdjrwData.filter((r) => r.month !== 'รวม'), [deptAdjrwData])
  const deptTotalSummaryRow = useMemo(() => deptAdjrwData.find((r) => r.month === 'รวม'), [deptAdjrwData])

  const deptStats = useMemo(() => {
    if (!deptAdjrwData || deptAdjrwData.length === 0) return null

    const monthRows = deptAdjrwData.filter((r) => r.month !== 'รวม')
    const totalRow = deptAdjrwData.find((r) => r.month === 'รวม')

    const grandTotal = totalRow ? (totalRow.adjrw_sum || totalRow.total) : monthRows.reduce((acc, m) => acc + (m.adjrw_sum || m.total), 0)
    const grandPatients = totalRow?.total_patients ?? monthRows.reduce((acc, m) => acc + (m.total_patients || 0), 0)
    const grandVisits = totalRow?.total_visits ?? monthRows.reduce((acc, m) => acc + (m.total_visits || 0), 0)
    const grandCmi = totalRow?.cmi ?? (grandVisits > 0 ? Number((grandTotal / grandVisits).toFixed(4)) : 0)

    // Find top department
    let topDeptName = '-'
    let topDeptVal = 0
    let topDeptColor = '#059669'
    let topDeptBg = '#ecfdf5'
    IPD_DEPARTMENTS.forEach((d) => {
      const val = totalRow ? Number(totalRow[d.key] || 0) : monthRows.reduce((acc, m) => acc + Number(m[d.key] || 0), 0)
      if (val > topDeptVal) {
        topDeptVal = val
        topDeptName = d.name
        topDeptColor = d.color
        topDeptBg = d.bg
      }
    })
    const topDeptPercent = grandTotal > 0 ? (topDeptVal / grandTotal) * 100 : 0

    // Find peak month
    let peakMonthName = '-'
    let peakMonthVal = 0
    monthRows.forEach((m) => {
      const val = m.adjrw_sum || m.total
      if (val > peakMonthVal) {
        peakMonthVal = val
        peakMonthName = m.month
      }
    })

    return {
      grandTotal,
      grandPatients,
      grandVisits,
      grandCmi,
      topDeptName,
      topDeptVal,
      topDeptPercent,
      topDeptColor,
      topDeptBg,
      peakMonthName,
      peakMonthVal,
      monthCount: monthRows.length,
      deptCount: IPD_DEPARTMENTS.length,
    }
  }, [deptAdjrwData])

  // Overview Chart Filter Category State
  const [chartCategory, setChartCategory] = useState<'all' | 'department' | 'doctor'>('all')

  // Department Chart Data
  const deptChartData = useMemo(() => {
    if (!deptAdjrwData || deptAdjrwData.length === 0) return []

    const totalRow = deptAdjrwData.find((r) => r.month === 'รวม')
    const monthRows = deptAdjrwData.filter((r) => r.month !== 'รวม')

    return IPD_DEPARTMENTS.map((dept) => {
      let adjrw = 0
      let visits = 0
      let patients = 0

      if (totalRow) {
        const dData = totalRow.depts?.[dept.key]
        adjrw = dData?.adjrw ?? Number((totalRow as any)[dept.key] || 0)
        visits = dData?.visits ?? 0
        patients = dData?.patients ?? 0
      } else {
        monthRows.forEach((m) => {
          const dData = m.depts?.[dept.key]
          adjrw += dData?.adjrw ?? Number((m as any)[dept.key] || 0)
          visits += dData?.visits ?? 0
          patients += dData?.patients ?? 0
        })
      }

      const cmi = visits > 0 ? Number((adjrw / visits).toFixed(4)) : 0

      return {
        key: dept.key,
        name: dept.name,
        adjrw: Number(adjrw.toFixed(4)),
        visits,
        patients,
        cmi,
        color: dept.color,
        bg: dept.bg,
      }
    })
  }, [deptAdjrwData])

  const deptChartSortedByAdjrw = useMemo(() => {
    const nonZero = deptChartData.filter((d) => d.adjrw > 0 || d.visits > 0)
    return (nonZero.length > 0 ? nonZero : deptChartData).sort((a, b) => b.adjrw - a.adjrw)
  }, [deptChartData])

  const deptChartSortedByVisits = useMemo(() => {
    const nonZero = deptChartData.filter((d) => d.visits > 0 || d.adjrw > 0)
    return (nonZero.length > 0 ? nonZero : deptChartData).sort((a, b) => b.visits - a.visits)
  }, [deptChartData])

  const deptChartSortedByCmi = useMemo(() => {
    const nonZero = deptChartData.filter((d) => d.visits > 0)
    return (nonZero.length > 0 ? nonZero : deptChartData).sort((a, b) => b.cmi - a.cmi)
  }, [deptChartData])

  const deptMonthlyTrendData = useMemo(() => {
    return deptMonthRows.map((m) => ({
      month: m.month,
      adjrw: Number((m.adjrw_sum || m.total).toFixed(4)),
      visits: m.total_visits,
      patients: m.total_patients,
      cmi: m.cmi,
    }))
  }, [deptMonthRows])

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

  const fetchDeptAdjrwData = useCallback(async (start = ds1, end = ds2) => {
    setDeptAdjrwLoading(true)
    setDeptAdjrwError(null)
    try {
      const url = `/api/service/dashboard-rcm/ipd-dept-adjrw?ds1=${start}&ds2=${end}`
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setDeptAdjrwData(json.data || [])
      } else {
        setDeptAdjrwError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล SumAdjRW แยกรายแผนก')
      }
    } catch (err: any) {
      setDeptAdjrwError(err?.message || 'ไม่สามารถเชื่อมต่อ API ได้')
    } finally {
      setDeptAdjrwLoading(false)
    }
  }, [ds1, ds2])

  useEffect(() => {
    fetchData(ds1, ds2)
    fetchDeptAdjrwData(ds1, ds2)
  }, [ds1, ds2, fetchData, fetchDeptAdjrwData])

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

  const doctorAdmitOptions = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.admdoctor).filter(Boolean))).sort()
  }, [data])

  const doctorDcOptions = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.dchdoctor).filter(Boolean))).sort()
  }, [data])

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((d) => {
      if (wardFilter !== 'all' && d.ward !== wardFilter && d.ward_name !== wardFilter) return false
      if (pttypeFilter !== 'all' && d.pttype !== pttypeFilter) return false
      if (doctorAdmitFilter !== 'all' && d.admdoctor !== doctorAdmitFilter) return false
      if (doctorDcFilter !== 'all' && d.dchdoctor !== doctorDcFilter) return false

      if (delayGroupFilter !== 'all') {
        if (delayGroupFilter === 'gt15' && (d.summary_days === null || d.summary_days <= 15)) return false
        if (delayGroupFilter === 'b8to15' && (d.summary_days === null || d.summary_days < 8 || d.summary_days > 15)) return false
        if (delayGroupFilter === 'lt8' && (d.summary_days === null || d.summary_days < 0 || d.summary_days >= 8)) return false
        if (delayGroupFilter === 'notFinal' && d.summary_days !== null) return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        const match =
          (d.an || '').toLowerCase().includes(q) ||
          (d.hn || '').toLowerCase().includes(q) ||
          (d.cid || '').toLowerCase().includes(q) ||
          (d.ptname || '').toLowerCase().includes(q) ||
          (d.pdx || '').toLowerCase().includes(q) ||
          (d.pdxname || '').toLowerCase().includes(q) ||
          (d.admdoctor || '').toLowerCase().includes(q) ||
          (d.dchdoctor || '').toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [data, wardFilter, pttypeFilter, doctorAdmitFilter, doctorDcFilter, delayGroupFilter, search])

  // Summary Metrics
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

  // Doctor Admit Breakdown (แพทย์ admit, จำนวน, SumAdjRW, CMI, Income)
  const doctorAdmitSummaryData = useMemo(() => {
    const map: Record<string, { doctor: string; cases: number; sumAdjrw: number; totalIncome: number }> = {}
    filteredData.forEach((d) => {
      const doc = d.admdoctor || 'ไม่ระบุแพทย์ Admit'
      if (!map[doc]) {
        map[doc] = { doctor: doc, cases: 0, sumAdjrw: 0, totalIncome: 0 }
      }
      map[doc].cases += 1
      map[doc].sumAdjrw += Number(d.adjrw || 0)
      map[doc].totalIncome += Number(d.income || 0)
    })
    return Object.values(map).sort((a, b) => b.cases - a.cases)
  }, [filteredData])

  // Doctor D/C Breakdown (แพทย์จำหน่าย, จำนวน, SumAdjRW, CMI, Income)
  const doctorDcSummaryData = useMemo(() => {
    const map: Record<string, { doctor: string; cases: number; sumAdjrw: number; totalIncome: number }> = {}
    filteredData.forEach((d) => {
      const doc = d.dchdoctor || 'ไม่ระบุแพทย์ D/C'
      if (!map[doc]) {
        map[doc] = { doctor: doc, cases: 0, sumAdjrw: 0, totalIncome: 0 }
      }
      map[doc].cases += 1
      map[doc].sumAdjrw += Number(d.adjrw || 0)
      map[doc].totalIncome += Number(d.income || 0)
    })
    return Object.values(map).sort((a, b) => b.cases - a.cases)
  }, [filteredData])

  // Filter check
  const hasActiveFilters =
    wardFilter !== 'all' ||
    pttypeFilter !== 'all' ||
    doctorAdmitFilter !== 'all' ||
    doctorDcFilter !== 'all' ||
    delayGroupFilter !== 'all' ||
    search.trim() !== ''

  const handleClearFilters = () => {
    setWardFilter('all')
    setPttypeFilter('all')
    setDoctorAdmitFilter('all')
    setDoctorDcFilter('all')
    setDelayGroupFilter('all')
    setSearch('')
  }

  const exportCSV = () => {
    const headers = [
      'ลำดับ', 'AN', 'HN', 'เลขประจำตัวประชาชน (CID)', 'ชื่อ-สกุลผู้ป่วย', 'เพศ', 'อายุ',
      'หอผู้ป่วย', 'แพทย์ Admit', 'แพทย์ D/C', 'สิทธิการรักษา',
      'วันนอน (LOS)', 'รหัสโรคหลัก (PDX)', 'ชื่อโรคหลัก', 'AdjRW',
      'ค่ารักษา (บาท)', 'ลูกหนี้ค้าง', 'สถานะสรุปชาร์ต (วัน)'
    ]

    const rows = filteredData.map((d, idx) => [
      idx + 1,
      `"${d.an}"`,
      `"${d.hn}"`,
      `"${d.cid}"`,
      `"${d.ptname}"`,
      d.sex,
      d.age,
      `"${d.ward_name || d.ward}"`,
      `"${d.admdoctor || ''}"`,
      `"${d.dchdoctor || ''}"`,
      `"${d.pttypename || d.pttype}"`,
      d.los,
      `"${d.pdx}"`,
      `"${d.pdxname || ''}"`,
      d.adjrw,
      d.income,
      d.debit,
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
              รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน (IPD)
            </h2>
            <p className="rcm-header-desc">
              สรุปข้อมูลผู้ป่วยใน (IPD) จำแนกตามหอผู้ป่วยและแพทย์ผู้สั่งจำหน่าย • ตรวจสอบสถานะการสรุปชาร์ต วันนอน ค่ารักษาพยาบาล และ CMI
            </p>
          </div>
        </div>
        <div className="rcm-actions-row">
          <button
            type="button"
            onClick={() => {
              fetchData()
              fetchDeptAdjrwData()
            }}
            disabled={loading || deptAdjrwLoading}
            className="rcm-btn rcm-btn-secondary"
          >
            <RefreshCw size={14} className={loading || deptAdjrwLoading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
          {subTab !== 'department' && (
            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || filteredData.length === 0}
              className="rcm-btn rcm-btn-primary"
            >
              <Download size={14} />
              <span>ส่งออก Excel (CSV)</span>
            </button>
          )}
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
              <button
                type="button"
                onClick={() => {
                  fetchData(ds1, ds2)
                  fetchDeptAdjrwData(ds1, ds2)
                }}
                disabled={loading || deptAdjrwLoading}
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
                onClick={() => {
                  fetchData(ds1, ds2)
                  fetchDeptAdjrwData(ds1, ds2)
                }}
                disabled={loading || deptAdjrwLoading}
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
                onClick={() => {
                  fetchData(ds1, ds2)
                  fetchDeptAdjrwData(ds1, ds2)
                }}
                disabled={loading || deptAdjrwLoading}
                className="rcm-btn rcm-btn-primary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ffffff' }}
              >
                <Filter size={13} style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>ดึงข้อมูล</span>
              </button>
            </div>
          )}
        </div>

        {/* Filters Row */}
        <div className="rcm-controls-row">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Filter size={14} style={{ color: '#059669' }} /> ตัวกรอง:
            </span>

            {/* Ward Filter */}
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">🏥 ทุกหอผู้ป่วย</option>
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
              <option value="all">💳 ทุกสิทธิการรักษา</option>
              {pttypeOptions.map((p) => (
                <option key={p.code} value={p.code}>{p.code}: {p.name}</option>
              ))}
            </select>

            {/* Doctor Admit Filter */}
            <select
              value={doctorAdmitFilter}
              onChange={(e) => setDoctorAdmitFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">👨‍⚕️ แพทย์ Admit ทั้งหมด</option>
              {doctorAdmitOptions.map((doc) => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>

            {/* Doctor D/C Filter */}
            <select
              value={doctorDcFilter}
              onChange={(e) => setDoctorDcFilter(e.target.value)}
              className="rcm-select"
            >
              <option value="all">👨‍⚕️ แพทย์ D/C ทั้งหมด</option>
              {doctorDcOptions.map((doc) => (
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
              <option value="lt8">ปกติ (น้อยกว่า 8 วัน)</option>
              <option value="b8to15">เตือน (นานเกิน 8 - 15 วัน)</option>
              <option value="gt15">วิกฤต (นานเกิน 15 วัน)</option>
              <option value="notFinal">ร้ายแรง (ยังไม่สรุป)</option>
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

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="rcm-btn rcm-btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#b91c1c', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                title="ล้างค่าตัวกรองทั้งหมด"
              >
                <RotateCcw size={12} />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
            แสดงผล: <b style={{ color: '#047857' }}>{filteredData.length.toLocaleString()}</b> / {data.length.toLocaleString()} ราย
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 700 }}>ตัวกรองที่ใช้งานอยู่:</span>
            {wardFilter !== 'all' && (
              <span className="rcm-filter-badge">
                🏥 หอผู้ป่วย: {wardOptions.find((w) => w.code === wardFilter)?.name || wardFilter}
                <button type="button" onClick={() => setWardFilter('all')} className="rcm-filter-badge-btn"><X size={12} /></button>
              </span>
            )}
            {pttypeFilter !== 'all' && (
              <span className="rcm-filter-badge">
                💳 สิทธิ: {pttypeFilter}
                <button type="button" onClick={() => setPttypeFilter('all')} className="rcm-filter-badge-btn"><X size={12} /></button>
              </span>
            )}
            {doctorAdmitFilter !== 'all' && (
              <span className="rcm-filter-badge">
                👨‍⚕️ Admit: {doctorAdmitFilter}
                <button type="button" onClick={() => setDoctorAdmitFilter('all')} className="rcm-filter-badge-btn"><X size={12} /></button>
              </span>
            )}
            {doctorDcFilter !== 'all' && (
              <span className="rcm-filter-badge">
                👨‍⚕️ D/C: {doctorDcFilter}
                <button type="button" onClick={() => setDoctorDcFilter('all')} className="rcm-filter-badge-btn"><X size={12} /></button>
              </span>
            )}
            {delayGroupFilter !== 'all' && (
              <span className="rcm-filter-badge">
                ⏱️ สถานะชาร์ต: {
                  delayGroupFilter === 'lt8' ? '< 8 วัน' :
                  delayGroupFilter === 'b8to15' ? '8 - 15 วัน' :
                  delayGroupFilter === 'gt15' ? '> 15 วัน' : 'ยังไม่สรุป'
                }
                <button type="button" onClick={() => setDelayGroupFilter('all')} className="rcm-filter-badge-btn"><X size={12} /></button>
              </span>
            )}
            {search && (
              <span className="rcm-filter-badge">
                🔍 ค้นหา: &quot;{search}&quot;
                <button type="button" onClick={() => setSearch('')} className="rcm-filter-badge-btn"><X size={12} /></button>
              </span>
            )}
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

        <div className="rcm-kpi-card">
          <div className="rcm-kpi-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Clock size={24} />
          </div>
          <div>
            <p className="rcm-kpi-title">ชาร์ตยังไม่สรุป</p>
            <p className="rcm-kpi-val" style={{ color: '#b45309' }}>
              {formatNumber(metrics.notFinal)}
              <span className="rcm-kpi-unit">ชาร์ต</span>
            </p>
          </div>
        </div>
      </div>

      {/* Chart Audit Status Cards (Click to filter) */}
      <div className="rcm-controls-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} style={{ color: '#059669' }} />
            <span>รายงานสถานะระยะเวลาสรุปชาร์ต IPD (คลิกเพื่อกรองรายชื่อ)</span>
          </h3>
          {delayGroupFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setDelayGroupFilter('all')}
              className="rcm-filter-badge-btn"
              style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <RotateCcw size={12} />
              <span>ล้างตัวกรองสถานะ</span>
            </button>
          )}
        </div>

        <div className="rcm-delay-cards-grid">
          <button
            type="button"
            onClick={() => setDelayGroupFilter(prev => prev === 'notFinal' ? 'all' : 'notFinal')}
            className={`rcm-delay-card rcm-delay-card-red ${delayGroupFilter === 'notFinal' ? 'active' : ''}`}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={14} style={{ color: '#dc2626' }} />
                <span>1. ยังไม่สรุป</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7f1d1d', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                {metrics.notFinal.toLocaleString()}
              </div>
            </div>
            <span className="rcm-delay-pill" style={{ color: '#991b1b' }}>ร้ายแรง</span>
          </button>

          <button
            type="button"
            onClick={() => setDelayGroupFilter(prev => prev === 'gt15' ? 'all' : 'gt15')}
            className={`rcm-delay-card rcm-delay-card-orange ${delayGroupFilter === 'gt15' ? 'active' : ''}`}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={14} style={{ color: '#ea580c' }} />
                <span>2. นานเกิน 15 วัน</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#9a3412', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                {metrics.gt15.toLocaleString()}
              </div>
            </div>
            <span className="rcm-delay-pill" style={{ color: '#c2410c' }}>วิกฤต</span>
          </button>

          <button
            type="button"
            onClick={() => setDelayGroupFilter(prev => prev === 'b8to15' ? 'all' : 'b8to15')}
            className={`rcm-delay-card rcm-delay-card-amber ${delayGroupFilter === 'b8to15' ? 'active' : ''}`}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={14} style={{ color: '#d97706' }} />
                <span>3. นานเกิน 8 - 15 วัน</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#78350f', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                {metrics.b8to15.toLocaleString()}
              </div>
            </div>
            <span className="rcm-delay-pill" style={{ color: '#b45309' }}>เตือน</span>
          </button>

          <button
            type="button"
            onClick={() => setDelayGroupFilter(prev => prev === 'lt8' ? 'all' : 'lt8')}
            className={`rcm-delay-card rcm-delay-card-emerald ${delayGroupFilter === 'lt8' ? 'active' : ''}`}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={14} style={{ color: '#059669' }} />
                <span>4. น้อยกว่า 8 วัน</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#064e3b', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                {metrics.lt8.toLocaleString()}
              </div>
            </div>
            <span className="rcm-delay-pill" style={{ color: '#047857' }}>ปกติ</span>
          </button>
        </div>
      </div>

      {/* Subtab Selector */}
      <div className="rcm-subtab-bar">
        <button
          type="button"
          onClick={() => setSubTab('list')}
          className={`rcm-subtab-btn ${subTab === 'list' ? 'active' : ''}`}
        >
          <span>📋 ตารางรายชื่อผู้ป่วยใน (IPD Grid)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('doctor')}
          className={`rcm-subtab-btn ${subTab === 'doctor' ? 'active' : ''}`}
        >
          <span>👨‍⚕️ แพทย์ Admit (จำนวน & SumAdjRW)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('doctor_dc')}
          className={`rcm-subtab-btn ${subTab === 'doctor_dc' ? 'active' : ''}`}
        >
          <span>👨‍⚕️ แพทย์ D/C (จำนวน & SumAdjRW)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('department')}
          className={`rcm-subtab-btn ${subTab === 'department' ? 'active' : ''}`}
        >
          <span>🏢 จำนวน SumAdjRW แยกรายแผนก</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('overview')}
          className={`rcm-subtab-btn ${subTab === 'overview' ? 'active' : ''}`}
        >
          <span>📊 กราฟสรุป (Charts)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: 📋 ตารางรายชื่อผู้ป่วยใน (IPD Grid)                               */}
      {/* 14 คอลัมน์ เรียงตามต้นฉบับ + แสดงเลขบัตรประชาชน 13 หลักใต้ชื่อคนไข้              */}
      {/* ========================================================================= */}
      {subTab === 'list' && (
        <div className="rcm-table-card">
          <div className="rcm-table-header">
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                📋 ตารางรายชื่อผู้ป่วยใน (IPD Grid)
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#334155', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                แสดงข้อมูลผู้ป่วยในจำหน่าย 14 คอลัมน์ตามต้นฉบับ • แสดงเลขประจำตัวประชาชน 13 หลักสำหรับการตรวจสอบ
              </p>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
              พบข้อมูล: <b style={{ color: '#047857' }}>{filteredData.length.toLocaleString()}</b> รายการ
            </span>
          </div>

          <div className="rcm-table-responsive" style={{ maxHeight: '600px' }}>
            <table className="rcm-table">
              <thead>
                <tr>
                  <th className="rcm-text-center" style={{ width: '48px' }}>ลำดับ</th>
                  <th className="rcm-text-center">AN</th>
                  <th className="rcm-text-center">HN</th>
                  <th style={{ textAlign: 'left' }}>ชื่อ-สกุลผู้ป่วย</th>
                  <th className="rcm-text-center">หอผู้ป่วย</th>
                  <th className="rcm-text-center">แพทย์ Admit</th>
                  <th className="rcm-text-center">แพทย์ D/C</th>
                  <th className="rcm-text-center">สิทธิการรักษา</th>
                  <th className="rcm-text-center">วันนอน (LOS)</th>
                  <th className="rcm-text-center">PDX (โรคหลัก)</th>
                  <th className="rcm-text-center">AdjRW</th>
                  <th className="rcm-text-center">ค่ารักษา (บาท)</th>
                  <th className="rcm-text-center">ลูกหนี้ค้าง</th>
                  <th className="rcm-text-center">สรุปชาร์ต</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '3rem' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#059669' }} />
                      <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>กำลังโหลดข้อมูล IPD จากฐานข้อมูล HOSxP...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                      ไม่พบข้อมูลผู้ป่วยในตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, idx) => (
                    <tr key={row.an}>
                      <td className="rcm-text-center font-mono" style={{ color: '#475569', fontWeight: 600 }}>{idx + 1}</td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: '#047857' }}>{row.an}</td>
                      <td className="rcm-text-center font-mono" style={{ color: '#0f172a', fontWeight: 600 }}>{row.hn}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.ptname}</div>
                        {row.cid && (
                          <div style={{ fontSize: '0.75rem', color: '#334155', fontFamily: 'monospace', fontWeight: 600 }}>
                            CID: {row.cid}
                          </div>
                        )}
                      </td>
                      <td className="rcm-text-center" style={{ color: '#0f172a', whiteSpace: 'nowrap', fontWeight: 500 }}>{row.ward_name || row.ward}</td>
                      <td className="rcm-text-center" style={{ color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.admdoctor || '-'}</td>
                      <td className="rcm-text-center" style={{ color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.dchdoctor || '-'}</td>
                      <td className="rcm-text-center" style={{ color: '#1e293b', whiteSpace: 'nowrap', fontWeight: 500 }}>{row.pttypename || row.pttype}</td>
                      <td className="rcm-text-center" style={{ color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.los} วัน</td>
                      <td className="rcm-text-center">
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', display: 'block' }}>{row.pdx}</span>
                        {row.pdxname && (
                          <span style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 500, maxWidth: '140px', display: 'block', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.pdxname}>
                            {row.pdxname}
                          </span>
                        )}
                      </td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: '#be185d' }}>{Number(row.adjrw || 0).toFixed(4)}</td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: '#0f172a' }}>{Number(row.income || 0).toLocaleString()}</td>
                      <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: row.debit > 0 ? '#b91c1c' : '#475569' }}>{Number(row.debit || 0).toLocaleString()}</td>
                      <td className="rcm-text-center">
                        <span className={`rcm-status-pill ${
                          row.summary_days === null 
                            ? 'rcm-status-pending' 
                            : row.summary_days > 15 
                            ? 'rcm-status-pending' 
                            : 'rcm-status-done'
                        }`}>
                          {row.summary_days !== null ? `${row.summary_days} วัน` : 'ยังไม่สรุป'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>แสดงข้อมูล IPD ทั้งหมด {filteredData.length.toLocaleString()} รายการ</span>
            <span>รวมค่ารักษา: <b style={{ color: '#064e3b' }}>{formatCurrency(metrics.totalIncome)}</b> • รวมลูกหนี้: <b style={{ color: '#be123c' }}>{formatCurrency(metrics.totalDebit)}</b></span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: 👨‍⚕️ แพทย์ Admit (จำนวน & SumAdjRW)                                */}
      {/* 7 คอลัมน์ เรียงตามต้นฉบับ + สรุปรวมท้ายตาราง + ปุ่ม "ดูรายชื่อ"                 */}
      {/* ========================================================================= */}
      {subTab === 'doctor' && (
        <div className="rcm-table-card">
          <div className="rcm-table-header">
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                👨‍⚕️ รายงานสรุป IPD ตามรายชื่อแพทย์ Admit
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#334155', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                แสดงข้อมูลตามสเปก VFP: <b>แพทย์ Admit</b>, <b>จำนวนผู้ป่วย (Cases)</b>, <b>SumAdjRW</b>, <b>CMI เฉลี่ย</b>, และ <b>ค่ารักษาพยาบาลรวม</b>
              </p>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#064e3b', backgroundColor: '#ecfdf5', padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #a7f3d0', fontWeight: 700 }}>
              คลิกปุ่ม &quot;ดูรายชื่อ&quot; เพื่อกรองรายชื่อในตารางคนไข้ทันที
            </span>
          </div>

          <div className="rcm-table-responsive">
            <table className="rcm-table">
              <thead>
                <tr>
                  <th className="rcm-text-center" style={{ width: '60px' }}>ลำดับ</th>
                  <th style={{ textAlign: 'left' }}>รายชื่อแพทย์ Admit (ADMDOCTOR)</th>
                  <th className="rcm-text-center">จำนวนผู้ป่วย (ราย)</th>
                  <th className="rcm-text-center">ผลรวมน้ำหนักสัมพัทธ์ (SumAdjRW)</th>
                  <th className="rcm-text-center">CMI เฉลี่ย</th>
                  <th className="rcm-text-center">ค่ารักษาพยาบาลรวม (บาท)</th>
                  <th className="rcm-text-center" style={{ width: '110px' }}>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {doctorAdmitSummaryData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                      ไม่พบข้อมูลแพทย์ Admit
                    </td>
                  </tr>
                ) : (
                  doctorAdmitSummaryData.map((d, idx) => {
                    const avgCmi = d.cases > 0 ? (d.sumAdjrw / d.cases) : 0
                    return (
                      <tr key={d.doctor}>
                        <td className="rcm-text-center font-mono" style={{ color: '#475569', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669', flexShrink: 0 }} />
                            <span>{d.doctor}</span>
                          </div>
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 800, color: '#047857' }}>
                          {d.cases.toLocaleString()}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 800, color: '#0f766e', backgroundColor: '#f0fdfa' }}>
                          {d.sumAdjrw.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: '#065f46' }}>
                          {avgCmi.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 800, color: '#0f172a' }}>
                          ฿{d.totalIncome.toLocaleString()}
                        </td>
                        <td className="rcm-text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setDoctorAdmitFilter(d.doctor)
                              setSubTab('list')
                            }}
                            className="rcm-btn rcm-btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', gap: '0.2rem', fontWeight: 700 }}
                            title={`กรองรายชื่อผู้ป่วยที่แพทย์ Admit คือ ${d.doctor}`}
                          >
                            <span>ดูรายชื่อ</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td className="rcm-text-center" colSpan={2}>รวมทั้งหมด ({doctorAdmitSummaryData.length} ท่าน)</td>
                  <td className="rcm-text-center font-mono" style={{ color: '#047857', fontWeight: 900 }}>
                    {doctorAdmitSummaryData.reduce((acc, c) => acc + c.cases, 0).toLocaleString()}
                  </td>
                  <td className="rcm-text-center font-mono" style={{ color: '#0f766e', fontWeight: 900 }}>
                    {doctorAdmitSummaryData.reduce((acc, c) => acc + c.sumAdjrw, 0).toFixed(4)}
                  </td>
                  <td className="rcm-text-center font-mono" style={{ color: '#065f46', fontWeight: 800 }}>
                    {(doctorAdmitSummaryData.reduce((acc, c) => acc + c.cases, 0) > 0 
                      ? (doctorAdmitSummaryData.reduce((acc, c) => acc + c.sumAdjrw, 0) / doctorAdmitSummaryData.reduce((acc, c) => acc + c.cases, 0)) 
                      : 0).toFixed(4)}
                  </td>
                  <td className="rcm-text-center font-mono" style={{ color: '#0f172a', fontWeight: 900 }}>
                    ฿{doctorAdmitSummaryData.reduce((acc, c) => acc + c.totalIncome, 0).toLocaleString()}
                  </td>
                  <td className="rcm-text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: 👨‍⚕️ แพทย์ D/C (จำนวน & SumAdjRW)                                  */}
      {/* 7 คอลัมน์ เรียงตามต้นฉบับ + สรุปรวมท้ายตาราง + ปุ่ม "ดูรายชื่อ"                 */}
      {/* ========================================================================= */}
      {subTab === 'doctor_dc' && (
        <div className="rcm-table-card">
          <div className="rcm-table-header">
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                👨‍⚕️ รายงานสรุป IPD ตามรายชื่อแพทย์ จำหน่าย (D/C Doctor)
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#334155', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                แสดงข้อมูลตามแพทย์ผู้จำหน่าย: <b>แพทย์ D/C</b>, <b>จำนวนผู้ป่วย (Cases)</b>, <b>SumAdjRW</b>, <b>CMI เฉลี่ย</b>, และ <b>ค่ารักษาพยาบาลรวม</b>
              </p>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #99f6e4', fontWeight: 700 }}>
              คลิกปุ่ม &quot;ดูรายชื่อ&quot; เพื่อกรองรายชื่อในตารางคนไข้ทันที
            </span>
          </div>

          <div className="rcm-table-responsive">
            <table className="rcm-table">
              <thead>
                <tr>
                  <th className="rcm-text-center" style={{ width: '60px' }}>ลำดับ</th>
                  <th style={{ textAlign: 'left' }}>รายชื่อแพทย์ จำหน่าย (DCH_DOCTOR)</th>
                  <th className="rcm-text-center">จำนวนผู้ป่วย (ราย)</th>
                  <th className="rcm-text-center">ผลรวมน้ำหนักสัมพัทธ์ (SumAdjRW)</th>
                  <th className="rcm-text-center">CMI เฉลี่ย</th>
                  <th className="rcm-text-center">ค่ารักษาพยาบาลรวม (บาท)</th>
                  <th className="rcm-text-center" style={{ width: '110px' }}>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {doctorDcSummaryData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                      ไม่พบข้อมูลแพทย์ จำหน่าย
                    </td>
                  </tr>
                ) : (
                  doctorDcSummaryData.map((d, idx) => {
                    const avgCmi = d.cases > 0 ? (d.sumAdjrw / d.cases) : 0
                    return (
                      <tr key={d.doctor}>
                        <td className="rcm-text-center font-mono" style={{ color: '#475569', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d9488', flexShrink: 0 }} />
                            <span>{d.doctor}</span>
                          </div>
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 800, color: '#0d9488' }}>
                          {d.cases.toLocaleString()}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 800, color: '#047857', backgroundColor: '#ecfdf5' }}>
                          {d.sumAdjrw.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: '#065f46' }}>
                          {avgCmi.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 800, color: '#0f172a' }}>
                          ฿{d.totalIncome.toLocaleString()}
                        </td>
                        <td className="rcm-text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setDoctorDcFilter(d.doctor)
                              setSubTab('list')
                            }}
                            className="rcm-btn rcm-btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', gap: '0.2rem', fontWeight: 700 }}
                            title={`กรองรายชื่อผู้ป่วยที่แพทย์ D/C คือ ${d.doctor}`}
                          >
                            <span>ดูรายชื่อ</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td className="rcm-text-center" colSpan={2}>รวมทั้งหมด ({doctorDcSummaryData.length} ท่าน)</td>
                  <td className="rcm-text-center font-mono" style={{ color: '#0d9488', fontWeight: 900 }}>
                    {doctorDcSummaryData.reduce((acc, c) => acc + c.cases, 0).toLocaleString()}
                  </td>
                  <td className="rcm-text-center font-mono" style={{ color: '#047857', fontWeight: 900 }}>
                    {doctorDcSummaryData.reduce((acc, c) => acc + c.sumAdjrw, 0).toFixed(4)}
                  </td>
                  <td className="rcm-text-center font-mono" style={{ color: '#065f46', fontWeight: 800 }}>
                    {(doctorDcSummaryData.reduce((acc, c) => acc + c.cases, 0) > 0 
                      ? (doctorDcSummaryData.reduce((acc, c) => acc + c.sumAdjrw, 0) / doctorDcSummaryData.reduce((acc, c) => acc + c.cases, 0)) 
                      : 0).toFixed(4)}
                  </td>
                  <td className="rcm-text-center font-mono" style={{ color: '#0f172a', fontWeight: 900 }}>
                    ฿{doctorDcSummaryData.reduce((acc, c) => acc + c.totalIncome, 0).toLocaleString()}
                  </td>
                  <td className="rcm-text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 🏢 จำนวน SumAdjRW แยกรายแผนก                                      */}
      {/* ========================================================================= */}
      {subTab === 'department' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Top Summary KPI Cards */}
          {deptStats && !deptAdjrwLoading && (
            <div className="rcm-dept-kpi-grid">
              <div className="rcm-dept-kpi-card">
                <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                  <Activity size={22} />
                </div>
                <div>
                  <p className="rcm-dept-kpi-label">SumAdjRW รวมทั้งหมด</p>
                  <p className="rcm-dept-kpi-val" style={{ color: '#047857' }}>
                    {deptStats.grandTotal.toFixed(4)}
                  </p>
                  <p className="rcm-dept-kpi-sub">
                    ผลรวม 10 แผนก ({deptStats.monthCount} เดือน)
                  </p>
                </div>
              </div>

              <div className="rcm-dept-kpi-card">
                <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <TrendingUp size={22} />
                </div>
                <div>
                  <p className="rcm-dept-kpi-label">CMI รวมเฉลี่ย</p>
                  <p className="rcm-dept-kpi-val" style={{ color: '#1d4ed8' }}>
                    {deptStats.grandCmi.toFixed(4)}
                  </p>
                  <p className="rcm-dept-kpi-sub">
                    AdjRW รวม / ครั้งรวม
                  </p>
                </div>
              </div>

              <div className="rcm-dept-kpi-card">
                <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                  <Users size={22} />
                </div>
                <div>
                  <p className="rcm-dept-kpi-label">ยอดผู้ป่วยใน (IPD)</p>
                  <p className="rcm-dept-kpi-val" style={{ color: '#15803d', fontSize: '1.05rem' }}>
                    {deptStats.grandPatients.toLocaleString()} คน / {deptStats.grandVisits.toLocaleString()} ครั้ง
                  </p>
                  <p className="rcm-dept-kpi-sub">
                    คนรวม (HN) / ครั้งรวม (AN)
                  </p>
                </div>
              </div>

              <div className="rcm-dept-kpi-card">
                <div className="rcm-dept-kpi-icon" style={{ backgroundColor: deptStats.topDeptBg, color: deptStats.topDeptColor }}>
                  <Award size={22} />
                </div>
                <div>
                  <p className="rcm-dept-kpi-label">แผนกครองยอดสูงสุด</p>
                  <p className="rcm-dept-kpi-val" style={{ color: deptStats.topDeptColor, fontSize: '1.15rem' }}>
                    {deptStats.topDeptName}
                  </p>
                  <p className="rcm-dept-kpi-sub">
                    {deptStats.topDeptVal.toFixed(4)} ({deptStats.topDeptPercent.toFixed(1)}% ของทั้งหมด)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ตารางข้อมูลผู้ป่วยใน (IPD) แยกรายเดือนและรายแผนก: เดือน | แผนก | คน | ครั้ง | SumAdjRW | CMI */}
          {/* ========================================================================= */}
          <div className="rcm-table-card">
            <div className="rcm-table-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Building2 size={18} style={{ color: '#0f172a' }} />
                  <span>🏢 ตารางสรุปข้อมูลผู้ป่วยใน (IPD) แยกรายเดือนและรายแผนก</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                  แสดงรายละเอียด คน, ครั้ง, SumAdjRW และ CMI แยกตามเดือนและแผนกการรักษา
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Month Filter */}
                <select
                  value={selectedDeptMonth}
                  onChange={(e) => setSelectedDeptMonth(e.target.value)}
                  className="rcm-input"
                  style={{ width: 'auto', minWidth: '160px', padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
                >
                  <option value="all">ทุกเดือน (ทั้งหมด {deptMonthRows.length} เดือน)</option>
                  {deptMonthRows.map((m) => (
                    <option key={m.month} value={m.month}>
                      เดือน {m.month}
                    </option>
                  ))}
                  {deptTotalSummaryRow && <option value="รวม">รวมทั้งปี (สรุปรวม)</option>}
                </select>

                {/* Hide zero rows toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={hideZeroRows}
                    onChange={(e) => setHideZeroRows(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>ซ่อนแถวที่ยอดเป็น 0</span>
                </label>
              </div>
            </div>

            <div className="rcm-table-responsive" style={{ maxHeight: '720px' }}>
              <table className="rcm-table">
                <thead>
                  <tr>
                    <th className="rcm-text-center" style={{ minWidth: '100px' }}>เดือน</th>
                    <th style={{ textAlign: 'left', minWidth: '160px' }}>แผนก</th>
                    <th className="rcm-text-center" style={{ minWidth: '95px' }}>คน</th>
                    <th className="rcm-text-center" style={{ minWidth: '95px' }}>ครั้ง</th>
                    <th className="rcm-text-center" style={{ minWidth: '120px' }}>SumAdjRW</th>
                    <th className="rcm-text-center" style={{ minWidth: '100px' }}>CMI</th>
                  </tr>
                </thead>
                <tbody>
                  {deptAdjrwLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#475569' }} />
                        <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                          กำลังดึงข้อมูลแยกรายเดือนและรายแผนกจากฐานข้อมูล HOSxP...
                        </p>
                      </td>
                    </tr>
                  ) : deptAdjrwError ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#dc2626', fontWeight: 600 }}>
                        <AlertCircle size={20} style={{ margin: '0 auto 0.5rem' }} />
                        <p style={{ margin: 0 }}>{deptAdjrwError}</p>
                      </td>
                    </tr>
                  ) : deptAdjrwData.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                        ไม่พบข้อมูลในช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* 1. Monthly blocks */}
                      {(selectedDeptMonth === 'all'
                        ? deptMonthRows
                        : deptMonthRows.filter((m) => m.month === selectedDeptMonth)
                      ).map((m) => {
                        const deptsToRender = IPD_DEPARTMENTS.filter((dept) => {
                          if (!hideZeroRows) return true
                          const dData = m.depts?.[dept.key]
                          const p = dData?.patients ?? 0
                          const v = dData?.visits ?? 0
                          const a = dData?.adjrw ?? Number((m as any)[dept.key] || 0)
                          return p > 0 || v > 0 || a > 0
                        })

                        return (
                          <React.Fragment key={m.month}>
                            {deptsToRender.length === 0 ? (
                              <tr className="rcm-dept-row">
                                <td className="rcm-dept-merged-month font-mono">
                                  {m.month}
                                </td>
                                <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '0.75rem' }}>
                                  (ไม่มียอดผู้ป่วยในเดือนนี้)
                                </td>
                              </tr>
                            ) : (
                              deptsToRender.map((dept, deptIdx) => {
                                const dData = m.depts?.[dept.key]
                                const p = dData?.patients ?? 0
                                const v = dData?.visits ?? 0
                                const a = dData?.adjrw ?? Number((m as any)[dept.key] || 0)
                                const c = dData?.cmi ?? (v > 0 ? Number((a / v).toFixed(4)) : 0)

                                return (
                                  <tr key={`${m.month}-${dept.key}`} className="rcm-dept-row">
                                    {deptIdx === 0 && (
                                      <td
                                        rowSpan={deptsToRender.length}
                                        className="rcm-dept-merged-month font-mono"
                                      >
                                        {m.month}
                                      </td>
                                    )}
                                    <td style={{ textAlign: 'left', fontWeight: 600, color: '#0f172a' }}>
                                      {dept.name}
                                    </td>
                                    <td className="rcm-text-center font-mono" style={{ color: p > 0 ? '#0f172a' : '#94a3b8' }}>
                                      {p > 0 ? p.toLocaleString() : '–'}
                                    </td>
                                    <td className="rcm-text-center font-mono" style={{ color: v > 0 ? '#0f172a' : '#94a3b8' }}>
                                      {v > 0 ? v.toLocaleString() : '–'}
                                    </td>
                                    <td className="rcm-text-center font-mono" style={{ fontWeight: 600, color: a > 0 ? '#0f172a' : '#94a3b8' }}>
                                      {a > 0 ? a.toFixed(4) : '–'}
                                    </td>
                                    <td className="rcm-text-center font-mono" style={{ fontWeight: 600, color: c > 0 ? '#0f172a' : '#94a3b8' }}>
                                      {c > 0 ? c.toFixed(4) : '–'}
                                    </td>
                                  </tr>
                                )
                              })
                            )}

                            {/* Monthly subtotal row (ไฮไลท์สีเขียวอ่อน) */}
                            <tr className="rcm-dept-subtotal-row">
                              <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                                ∑ รวมประจำเดือน {m.month}
                              </td>
                              <td className="rcm-text-center font-mono">
                                {m.total_patients > 0 ? m.total_patients.toLocaleString() : '0'}
                              </td>
                              <td className="rcm-text-center font-mono">
                                {m.total_visits > 0 ? m.total_visits.toLocaleString() : '0'}
                              </td>
                              <td className="rcm-text-center font-mono">
                                {(m.adjrw_sum || m.total).toFixed(4)}
                              </td>
                              <td className="rcm-text-center font-mono">
                                {m.cmi.toFixed(4)}
                              </td>
                            </tr>
                          </React.Fragment>
                        )
                      })}

                      {/* 2. Total Year Summary Block (เมื่อเลือกดูทั้งหมด หรือเลือกดู 'รวม') */}
                      {(selectedDeptMonth === 'all' || selectedDeptMonth === 'รวม') && deptTotalSummaryRow && (
                        <>
                          <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #86efac', borderBottom: '1px solid #bbf7d0' }}>
                            <td colSpan={6} style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#166534', fontSize: '0.88rem' }}>
                              📊 สรุปรวมทั้งปีงบประมาณ / ตลอดช่วงเวลา (แยกรายแผนก)
                            </td>
                          </tr>
                          {(() => {
                            const summaryDeptsToRender = IPD_DEPARTMENTS.filter((dept) => {
                              if (!hideZeroRows) return true
                              const dData = deptTotalSummaryRow.depts?.[dept.key]
                              const p = dData?.patients ?? 0
                              const v = dData?.visits ?? 0
                              const a = dData?.adjrw ?? Number((deptTotalSummaryRow as any)[dept.key] || 0)
                              return p > 0 || v > 0 || a > 0
                            })

                            if (summaryDeptsToRender.length === 0) {
                              return (
                                <tr className="rcm-dept-row">
                                  <td className="rcm-dept-merged-month font-mono">รวม</td>
                                  <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '0.75rem' }}>
                                    (ไม่มียอดผู้ป่วย)
                                  </td>
                                </tr>
                              )
                            }

                            return summaryDeptsToRender.map((dept, deptIdx) => {
                              const dData = deptTotalSummaryRow.depts?.[dept.key]
                              const p = dData?.patients ?? 0
                              const v = dData?.visits ?? 0
                              const a = dData?.adjrw ?? Number((deptTotalSummaryRow as any)[dept.key] || 0)
                              const c = dData?.cmi ?? (v > 0 ? Number((a / v).toFixed(4)) : 0)

                              return (
                                <tr key={`total-${dept.key}`} className="rcm-dept-row" style={{ backgroundColor: '#fbfcfd' }}>
                                  {deptIdx === 0 && (
                                    <td
                                      rowSpan={summaryDeptsToRender.length}
                                      className="rcm-dept-merged-month font-mono"
                                    >
                                      รวม
                                    </td>
                                  )}
                                  <td style={{ textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>
                                    {dept.name}
                                  </td>
                                  <td className="rcm-text-center font-mono" style={{ fontWeight: 600, color: p > 0 ? '#0f172a' : '#94a3b8' }}>
                                    {p > 0 ? p.toLocaleString() : '–'}
                                  </td>
                                  <td className="rcm-text-center font-mono" style={{ fontWeight: 600, color: v > 0 ? '#0f172a' : '#94a3b8' }}>
                                    {v > 0 ? v.toLocaleString() : '–'}
                                  </td>
                                  <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: a > 0 ? '#0f172a' : '#94a3b8' }}>
                                    {a > 0 ? a.toFixed(4) : '–'}
                                  </td>
                                  <td className="rcm-text-center font-mono" style={{ fontWeight: 700, color: c > 0 ? '#0f172a' : '#94a3b8' }}>
                                    {c > 0 ? c.toFixed(4) : '–'}
                                  </td>
                                </tr>
                              )
                            })
                          })()}
                        </>
                      )}
                    </>
                  )}
                </tbody>
                {!deptAdjrwLoading && deptAdjrwData.length > 0 && (
                  <tfoot>
                    <tr className="rcm-dept-grand-total-row total-row">
                      <td colSpan={2} style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                        🏆 รวมทั้งโรงพยาบาล (ทุกแผนก)
                      </td>
                      <td className="rcm-text-center font-mono">
                        {(deptTotalSummaryRow?.total_patients ?? deptStats?.grandPatients ?? 0).toLocaleString()}
                      </td>
                      <td className="rcm-text-center font-mono">
                        {(deptTotalSummaryRow?.total_visits ?? deptStats?.grandVisits ?? 0).toLocaleString()}
                      </td>
                      <td className="rcm-text-center font-mono">
                        {(deptTotalSummaryRow ? (deptTotalSummaryRow.adjrw_sum || deptTotalSummaryRow.total) : (deptStats?.grandTotal ?? 0)).toFixed(4)}
                      </td>
                      <td className="rcm-text-center font-mono">
                        {(deptTotalSummaryRow?.cmi ?? deptStats?.grandCmi ?? 0).toFixed(4)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: 📊 กราฟสรุป (Charts)                                            */}
      {/* แสดงทั้งกราฟวิเคราะห์แยกรายแผนก (Department) และแยกตามแพทย์ (Physicians)         */}
      {/* ========================================================================= */}
      {subTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Chart Category Filter Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="rcm-button-group">
              <button
                type="button"
                onClick={() => setChartCategory('all')}
                className={`rcm-mode-btn ${chartCategory === 'all' ? 'active' : ''}`}
              >
                📊 แสดงกราฟทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setChartCategory('department')}
                className={`rcm-mode-btn ${chartCategory === 'department' ? 'active' : ''}`}
              >
                🏢 วิเคราะห์แยกรายแผนก
              </button>
              <button
                type="button"
                onClick={() => setChartCategory('doctor')}
                className={`rcm-mode-btn ${chartCategory === 'doctor' ? 'active' : ''}`}
              >
                👨‍⚕️ วิเคราะห์ตามแพทย์
              </button>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              {chartCategory === 'department' && 'แสดง 4 กราฟวิเคราะห์ผู้ป่วยในแยกรายแผนก'}
              {chartCategory === 'doctor' && 'แสดง 3 กราฟวิเคราะห์แยกตามแพทย์ผู้รักษา'}
              {chartCategory === 'all' && 'แสดงครบทั้ง 7 กราฟวิเคราะห์ (แผนก & แพทย์)'}
            </span>
          </div>

          {/* ===================================================================== */}
          {/* SECTION 1: 🏢 กราฟวิเคราะห์ผู้ป่วยในแยกรายแผนกการรักษา (Department Charts)  */}
          {/* ===================================================================== */}
          {(chartCategory === 'all' || chartCategory === 'department') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="rcm-chart-section-title">
                <h3>
                  <Building2 size={20} style={{ color: '#047857' }} />
                  <span>🏢 กราฟสรุปภาพรวมแยกรายแผนกการรักษา</span>
                </h3>
                <span className="rcm-chart-section-badge">
                  {deptStats?.monthCount ? `${deptStats.monthCount} เดือน` : 'ข้อมูลรายแผนก'}
                </span>
              </div>

              {deptAdjrwLoading ? (
                <div className="rcm-chart-card" style={{ textAlign: 'center', padding: '3rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#059669' }} />
                  <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>กำลังโหลดข้อมูลกราฟแผนกจากฐานข้อมูล HOSxP...</p>
                </div>
              ) : deptChartData.length === 0 ? (
                <div className="rcm-chart-card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  ไม่พบข้อมูลรายแผนกสำหรับสร้างกราฟในช่วงเวลานี้
                </div>
              ) : (
                <>
                  <div className="rcm-chart-grid-3">
                    {/* Dept Chart 1: SumAdjRW by Department */}
                    <div className="rcm-chart-card">
                      <div className="rcm-chart-header">
                        <div>
                          <h4 className="rcm-chart-title">
                            ผลรวม SumAdjRW แยกตามแผนก
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                            เรียงตามผลรวมค่าน้ำหนักสัมพัทธ์ (ความยากโรค)
                          </p>
                        </div>
                      </div>
                      <div style={{ height: '340px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={deptChartSortedByAdjrw}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                          >
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#0f172a' }} />
                            <Tooltip
                              formatter={(val: any) => [
                                `${Number(val).toFixed(4)} (${deptStats?.grandTotal ? ((Number(val) / deptStats.grandTotal) * 100).toFixed(1) : 0}%)`,
                                'SumAdjRW',
                              ]}
                            />
                            <Bar dataKey="adjrw" radius={[0, 4, 4, 0]}>
                              {deptChartSortedByAdjrw.map((entry) => (
                                <Cell key={`dept-adjrw-${entry.key}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Dept Chart 2: Visits by Department */}
                    <div className="rcm-chart-card">
                      <div className="rcm-chart-header">
                        <div>
                          <h4 className="rcm-chart-title">
                            จำนวนผู้ป่วยใน (ครั้ง/Admit) แยกตามแผนก
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                            เรียงตามจำนวนครั้งที่รับไว้รักษาในโรงพยาบาล (AN)
                          </p>
                        </div>
                      </div>
                      <div style={{ height: '340px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={deptChartSortedByVisits}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                          >
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#0f172a' }} />
                            <Tooltip
                              formatter={(val: any, name: any, item: any) => [
                                `${Number(val).toLocaleString()} ครั้ง (คน: ${(item?.payload?.patients ?? 0).toLocaleString()})`,
                                'จำนวนครั้ง',
                              ]}
                            />
                            <Bar dataKey="visits" radius={[0, 4, 4, 0]}>
                              {deptChartSortedByVisits.map((entry) => (
                                <Cell key={`dept-visits-${entry.key}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Dept Chart 3: CMI by Department */}
                    <div className="rcm-chart-card">
                      <div className="rcm-chart-header">
                        <div>
                          <h4 className="rcm-chart-title">
                            ดัชนีความซับซ้อนโรค CMI เฉลี่ยแยกตามแผนก
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                            ค่าเฉลี่ย CMI = SumAdjRW / ครั้ง (สะท้อนความยากโรค)
                          </p>
                        </div>
                      </div>
                      <div style={{ height: '340px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={deptChartSortedByCmi}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                          >
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#0f172a' }} />
                            <Tooltip formatter={(val: any) => [`${Number(val).toFixed(4)}`, 'CMI เฉลี่ย']} />
                            <Bar dataKey="cmi" radius={[0, 4, 4, 0]}>
                              {deptChartSortedByCmi.map((entry) => (
                                <Cell key={`dept-cmi-${entry.key}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Dept Chart 4: Monthly Trend Timeline */}
                  {deptMonthlyTrendData.length > 0 && (
                    <div className="rcm-chart-card">
                      <div className="rcm-chart-header">
                        <div>
                          <h4 className="rcm-chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <TrendingUp size={16} style={{ color: '#059669' }} />
                            <span>แนวโน้มผลรวม SumAdjRW รวมรายเดือน</span>
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                            การเปลี่ยนแปลงของ SumAdjRW ตลอด {deptMonthlyTrendData.length} เดือน
                          </p>
                        </div>
                      </div>
                      <div style={{ height: '280px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={deptMonthlyTrendData}
                            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                          >
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#0f172a' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                            <Tooltip
                              formatter={(val: any, name: any, item: any) => [
                                `${Number(val).toFixed(4)} (ผู้ป่วย: ${(item?.payload?.visits ?? 0).toLocaleString()} ครั้ง, CMI: ${(item?.payload?.cmi ?? 0).toFixed(4)})`,
                                'SumAdjRW ประจำเดือน',
                              ]}
                            />
                            <Bar dataKey="adjrw" fill="#059669" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECTION 2: 👨‍⚕️ กราฟวิเคราะห์ผู้ป่วยในแยกตามแพทย์ผู้รักษา (Physician Charts)    */}
          {/* ===================================================================== */}
          {(chartCategory === 'all' || chartCategory === 'doctor') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: chartCategory === 'all' ? '0.5rem' : '0' }}>
              <div className="rcm-chart-section-title">
                <h3>
                  <Stethoscope size={20} style={{ color: '#2563eb' }} />
                  <span>👨‍⚕️ กราฟสรุปภาพรวมแยกตามแพทย์ผู้ให้การรักษา</span>
                </h3>
                <span className="rcm-chart-section-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                  {doctorAdmitSummaryData.length} ท่าน
                </span>
              </div>

              <div className="rcm-chart-grid-3">
                {/* Chart 1: Cases by Admit Doctor */}
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title">
                        จำนวนผู้ป่วยแยกตามแพทย์ Admit
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        เรียงตามจำนวนผู้ป่วยที่รับไว้รักษา (ราย)
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '320px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={doctorAdmitSummaryData.slice(0, 10).map((d) => ({ name: d.doctor, cases: d.cases }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(val: any) => [`${val} ราย`, 'ผู้ป่วย Admit']} />
                        <Bar dataKey="cases" fill="#059669" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: SumAdjRW by Admit Doctor */}
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title">
                        ผลรวมค่าความยากโรค SumAdjRW แยกตามแพทย์ Admit
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        ผลรวมค่าน้ำหนักสัมพัทธ์ (SumAdjRW)
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '320px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={doctorAdmitSummaryData.slice(0, 10).map((d) => ({ name: d.doctor, sumAdjrw: Number(d.sumAdjrw.toFixed(4)) }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(val: any) => [`${val}`, 'SumAdjRW']} />
                        <Bar dataKey="sumAdjrw" fill="#0d9488" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: CMI by D/C Doctor */}
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title">
                        ผลรวมค่าความยากโรค Cmi แยกตามแพทย์ D/C
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        ค่าเฉลี่ยความซับซ้อนโรค (CMI = SumAdjRW / Cases)
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '320px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={doctorDcSummaryData
                          .filter((d) => d.cases > 0)
                          .slice(0, 10)
                          .map((d) => ({
                            name: d.doctor,
                            cmi: Number((d.sumAdjrw / d.cases).toFixed(4)),
                          }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(val: any) => [`${val}`, 'CMI (แพทย์ D/C)']} />
                        <Bar dataKey="cmi" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
