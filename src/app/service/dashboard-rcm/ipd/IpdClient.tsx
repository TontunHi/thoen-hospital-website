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
  Send,
  BarChart3,
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
  Sparkles,
} from 'lucide-react'
import {
  BarChart,
  Bar,
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
  key: keyof Omit<IpdDepartmentAdjrwItem, 'month' | 'total'>
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
  const [deptTableOrientation, setDeptTableOrientation] = useState<'dept_as_rows' | 'month_as_rows'>('dept_as_rows')

  const deptMonthRows = useMemo(() => deptAdjrwData.filter((r) => r.month !== 'รวม'), [deptAdjrwData])
  const deptTotalSummaryRow = useMemo(() => deptAdjrwData.find((r) => r.month === 'รวม'), [deptAdjrwData])

  const deptStats = useMemo(() => {
    if (!deptAdjrwData || deptAdjrwData.length === 0) return null

    const monthRows = deptAdjrwData.filter((r) => r.month !== 'รวม')
    const totalRow = deptAdjrwData.find((r) => r.month === 'รวม')

    const grandTotal = totalRow ? totalRow.total : monthRows.reduce((acc, m) => acc + m.total, 0)

    // Find top department
    let topDeptName = '-'
    let topDeptVal = 0
    let topDeptColor = '#059669'
    let topDeptBg = '#ecfdf5'
    IPD_DEPARTMENTS.forEach((d) => {
      const val = totalRow ? totalRow[d.key] : monthRows.reduce((acc, m) => acc + m[d.key], 0)
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
      if (m.total > peakMonthVal) {
        peakMonthVal = m.total
        peakMonthName = m.month
      }
    })

    return {
      grandTotal,
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

  // Sorted department rank map based on grand total SumAdjRW
  const deptRankings = useMemo(() => {
    if (!deptAdjrwData || deptAdjrwData.length === 0) return {}
    const list = IPD_DEPARTMENTS.map((dept) => {
      const total = deptTotalSummaryRow
        ? deptTotalSummaryRow[dept.key]
        : deptMonthRows.reduce((acc, m) => acc + m[dept.key], 0)
      return { key: dept.key, total }
    })
    list.sort((a, b) => b.total - a.total)
    const map: Record<string, number> = {}
    list.forEach((item, idx) => {
      map[item.key] = idx + 1
    })
    return map
  }, [deptAdjrwData, deptTotalSummaryRow, deptMonthRows])

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

  const exportDeptAdjrwCSV = () => {
    if (deptTableOrientation === 'dept_as_rows') {
      const headers = ['รายชื่อแผนก', ...deptMonthRows.map((m) => m.month), 'รวม']
      const rows = IPD_DEPARTMENTS.map((dept) => {
        const deptTotal = deptTotalSummaryRow
          ? deptTotalSummaryRow[dept.key]
          : deptMonthRows.reduce((acc, m) => acc + m[dept.key], 0)
        return [
          `"${dept.name}"`,
          ...deptMonthRows.map((m) => m[dept.key].toFixed(4)),
          deptTotal.toFixed(4),
        ]
      })

      const grandTotal = deptTotalSummaryRow
        ? deptTotalSummaryRow.total
        : deptMonthRows.reduce((acc, m) => acc + m.total, 0)
      const totalRowLine = [
        '"รวม"',
        ...deptMonthRows.map((m) => m.total.toFixed(4)),
        grandTotal.toFixed(4),
      ]

      const csvContent =
        '\uFEFF' +
        [headers.join(','), ...rows.map((r) => r.join(',')), totalRowLine.join(',')].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ipd_dept_sumadjrw_${ds1}_to_${ds2}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const headers = [
        'เดือน',
        'อายุรกรรม',
        'ศัลยกรรม',
        'สูตินารีเวชกรรม',
        'กุมารเวชกรรม',
        'ออร์โธปิติกส์',
        'ENT',
        'จักษุ',
        'อื่นๆ',
        'ทันตกรรม',
        'จิตเวช',
        'รวม (SumAdjRW)',
      ]

      const rows = deptAdjrwData.map((d) => [
        `"${d.month}"`,
        d.medicine.toFixed(4),
        d.surgery.toFixed(4),
        d.obgyn.toFixed(4),
        d.pediatrics.toFixed(4),
        d.orthopedics.toFixed(4),
        d.ent.toFixed(4),
        d.eye.toFixed(4),
        d.other.toFixed(4),
        d.dental.toFixed(4),
        d.psychiatry.toFixed(4),
        d.total.toFixed(4),
      ])

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ipd_dept_sumadjrw_${ds1}_to_${ds2}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
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
          <button
            type="button"
            onClick={() => (subTab === 'department' ? exportDeptAdjrwCSV() : exportCSV())}
            disabled={
              subTab === 'department'
                ? deptAdjrwLoading || deptAdjrwData.length === 0
                : loading || filteredData.length === 0
            }
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
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                <Filter size={13} />
                <span>ดึงข้อมูล</span>
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
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                <Filter size={13} />
                <span>ดึงข้อมูล</span>
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
                    ปีงบประมาณ {y + 543} (1 ต.ค. {y + 542} - 30 ก.ย. {y + 543})
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
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                <Filter size={13} />
                <span>ดึงข้อมูล</span>
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

              <div className="rcm-dept-kpi-card">
                <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <TrendingUp size={22} />
                </div>
                <div>
                  <p className="rcm-dept-kpi-label">เดือนภาระงานสูงสุด</p>
                  <p className="rcm-dept-kpi-val" style={{ color: '#1d4ed8' }}>
                    {deptStats.peakMonthName}
                  </p>
                  <p className="rcm-dept-kpi-sub">
                    SumAdjRW รวม {deptStats.peakMonthVal.toFixed(4)}
                  </p>
                </div>
              </div>

              <div className="rcm-dept-kpi-card">
                <div className="rcm-dept-kpi-icon" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <p className="rcm-dept-kpi-label">กลุ่มแผนกการรักษา</p>
                  <p className="rcm-dept-kpi-val" style={{ color: '#6d28d9' }}>
                    {deptStats.deptCount} แผนก
                  </p>
                  <p className="rcm-dept-kpi-sub">
                    ครอบคลุมบริการผู้ป่วยในทุกสาขา
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Table Card */}
          <div className="rcm-table-card">
            <div className="rcm-table-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  🏢 ตารางจำนวน SumAdjRW แยกรายแผนก IPD
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#334155', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                  {deptTableOrientation === 'dept_as_rows'
                    ? 'แสดงผลรวมค่าน้ำหนักสัมพัทธ์ (SumAdjRW) จำแนกตามรายชื่อแผนก (แถว) และรายเดือน (คอลัมน์)'
                    : 'แสดงผลรวมค่าน้ำหนักสัมพัทธ์ (SumAdjRW) จำแนกตามรายเดือน (แถว) และรายชื่อแผนก (คอลัมน์)'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Segmented Switcher */}
                <div className="rcm-view-switcher">
                  <button
                    type="button"
                    onClick={() => setDeptTableOrientation('dept_as_rows')}
                    className={`rcm-view-switcher-btn ${deptTableOrientation === 'dept_as_rows' ? 'active' : ''}`}
                    title="แสดงรายชื่อแผนกเป็นแถว และแสดงเดือนเป็นคอลัมน์"
                  >
                    <Building2 size={13} />
                    <span>แผนกเป็นแถว</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeptTableOrientation('month_as_rows')}
                    className={`rcm-view-switcher-btn ${deptTableOrientation === 'month_as_rows' ? 'active' : ''}`}
                    title="แสดงรายเดือนเป็นแถว และแสดงแผนกเป็นคอลัมน์"
                  >
                    <Calendar size={13} />
                    <span>เดือนเป็นแถว</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={exportDeptAdjrwCSV}
                  disabled={deptAdjrwLoading || deptAdjrwData.length === 0}
                  className="rcm-btn rcm-btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  title="ส่งออกตาราง SumAdjRW แยกรายแผนก เป็นไฟล์ CSV"
                >
                  <Download size={13} />
                  <span>ส่งออก CSV</span>
                </button>
              </div>
            </div>

            <div className="rcm-table-responsive" style={{ maxHeight: '650px' }}>
              {deptTableOrientation === 'dept_as_rows' ? (
                /* มุมมองที่ 1: แผนกเป็นแถว (Department as Rows) และ เดือนเป็นคอลัมน์ */
                <table className="rcm-table rcm-dept-table">
                  <thead>
                    <tr>
                      <th className="rcm-dept-sticky-col rcm-dept-header-sticky">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Building2 size={15} style={{ color: '#059669' }} />
                          <span>แผนกการรักษา</span>
                          <span className="rcm-dept-count-pill">{IPD_DEPARTMENTS.length} สาขา</span>
                        </div>
                      </th>
                      {deptMonthRows.map((m) => {
                        const isPeakMonth = deptStats && deptStats.peakMonthName === m.month
                        return (
                          <th
                            key={m.month}
                            className={`rcm-text-center ${isPeakMonth ? 'rcm-month-peak-th' : ''}`}
                            style={{ minWidth: '92px' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                              <span>{m.month}</span>
                              {isPeakMonth && (
                                <span className="rcm-peak-month-badge">สูงสุด</span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                      <th className="rcm-text-center rcm-dept-total-th">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <BarChart3 size={14} />
                          <span>รวม (SumAdjRW)</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptAdjrwLoading ? (
                      <tr>
                        <td
                          colSpan={deptMonthRows.length + 2}
                          style={{ textAlign: 'center', padding: '3.5rem' }}
                        >
                          <RefreshCw
                            size={24}
                            className="animate-spin"
                            style={{ margin: '0 auto 0.5rem', color: '#059669' }}
                          />
                          <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                            กำลังดึงข้อมูล SumAdjRW แยกรายแผนกจากฐานข้อมูล HOSxP...
                          </p>
                        </td>
                      </tr>
                    ) : deptAdjrwError ? (
                      <tr>
                        <td
                          colSpan={deptMonthRows.length + 2}
                          style={{ textAlign: 'center', padding: '2rem', color: '#dc2626', fontWeight: 600 }}
                        >
                          <AlertCircle size={20} style={{ margin: '0 auto 0.5rem' }} />
                          <p style={{ margin: 0 }}>{deptAdjrwError}</p>
                        </td>
                      </tr>
                    ) : deptAdjrwData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={deptMonthRows.length + 2}
                          style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}
                        >
                          ไม่พบข้อมูล SumAdjRW ในช่วงเวลาที่เลือก
                        </td>
                      </tr>
                    ) : (
                      IPD_DEPARTMENTS.map((dept) => {
                        const deptTotal = deptTotalSummaryRow
                          ? deptTotalSummaryRow[dept.key]
                          : deptMonthRows.reduce((acc, m) => acc + m[dept.key], 0)
                        const pctShare =
                          deptStats && deptStats.grandTotal > 0
                            ? (deptTotal / deptStats.grandTotal) * 100
                            : 0
                        const rank = deptRankings[dept.key] || 99

                        return (
                          <tr key={dept.key} className="rcm-dept-row">
                            <td className="rcm-dept-sticky-col rcm-dept-cell-sticky">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <span
                                    className="rcm-dept-name-badge"
                                    style={{
                                      backgroundColor: dept.bg,
                                      color: dept.color,
                                      border: `1px solid ${dept.border}`,
                                    }}
                                  >
                                    {dept.name}
                                  </span>
                                </div>
                                <span
                                  className={`rcm-rank-pill ${
                                    rank === 1
                                      ? 'rank-1'
                                      : rank === 2
                                      ? 'rank-2'
                                      : rank === 3
                                      ? 'rank-3'
                                      : 'rank-default'
                                  }`}
                                  title={`อันดับ ${rank} ของโรงพยาบาล (${pctShare.toFixed(1)}%)`}
                                >
                                  #{rank}
                                </span>
                              </div>
                            </td>
                            {deptMonthRows.map((m) => {
                              const val = m[dept.key]
                              return (
                                <td
                                  key={m.month}
                                  className={`rcm-text-center font-mono ${val > 0 ? 'rcm-cell-val-active' : 'rcm-cell-val-empty'}`}
                                >
                                  {val > 0 ? (
                                    <span className="rcm-val-number">{val.toFixed(4)}</span>
                                  ) : (
                                    <span className="rcm-val-dash">–</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="rcm-text-center font-mono rcm-dept-total-cell">
                              <div className="rcm-dept-total-num">{deptTotal.toFixed(4)}</div>
                              {deptStats && deptStats.grandTotal > 0 && (
                                <div className="rcm-dept-total-breakdown">
                                  <div className="rcm-dept-pct-label">
                                    <span>{pctShare.toFixed(1)}%</span>
                                    <span className="rcm-dept-pct-sub">ของ รพ.</span>
                                  </div>
                                  <div className="rcm-dept-bar-track">
                                    <div
                                      className="rcm-dept-bar-fill"
                                      style={{
                                        width: `${Math.min(100, Math.max(4, pctShare))}%`,
                                        background: rank === 1 ? 'linear-gradient(90deg, #10b981, #047857)' : `linear-gradient(90deg, ${dept.color}, #059669)`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {!deptAdjrwLoading && deptAdjrwData.length > 0 && (
                    <tfoot>
                      <tr className="rcm-dept-tfoot-row">
                        <td className="rcm-dept-sticky-col rcm-dept-tfoot-sticky">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Sparkles size={15} style={{ color: '#059669' }} />
                            <span>รวมทุกแผนก</span>
                          </div>
                        </td>
                        {deptMonthRows.map((m) => (
                          <td
                            key={m.month}
                            className="rcm-text-center font-mono rcm-dept-tfoot-month-cell"
                          >
                            {m.total.toFixed(4)}
                          </td>
                        ))}
                        <td className="rcm-text-center font-mono rcm-dept-tfoot-grand-cell">
                          <div className="rcm-grand-total-val">
                            {(deptTotalSummaryRow
                              ? deptTotalSummaryRow.total
                              : deptMonthRows.reduce((acc, m) => acc + m.total, 0)
                            ).toFixed(4)}
                          </div>
                          <div className="rcm-grand-total-sub">
                            100.0% (Grand Total)
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                /* มุมมองที่ 2: เดือนเป็นแถว (Month as Rows) และ แผนกเป็นคอลัมน์ */
                <table className="rcm-table">
                  <thead>
                    <tr>
                      <th className="rcm-text-center" style={{ width: '90px' }}>เดือน</th>
                      <th className="rcm-text-center">อายุรกรรม</th>
                      <th className="rcm-text-center">ศัลยกรรม</th>
                      <th className="rcm-text-center">สูตินารีเวชกรรม</th>
                      <th className="rcm-text-center">กุมารเวชกรรม</th>
                      <th className="rcm-text-center">ออร์โธปิติกส์</th>
                      <th className="rcm-text-center">ENT</th>
                      <th className="rcm-text-center">จักษุ</th>
                      <th className="rcm-text-center">อื่นๆ</th>
                      <th className="rcm-text-center">ทันตกรรม</th>
                      <th className="rcm-text-center">จิตเวช</th>
                      <th
                        className="rcm-text-center"
                        style={{
                          minWidth: '110px',
                          backgroundColor: '#ecfdf5',
                          color: '#065f46',
                          fontWeight: 800,
                          borderLeft: '2px solid #a7f3d0',
                        }}
                      >
                        รวม (SumAdjRW)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptAdjrwLoading ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '3.5rem' }}>
                          <RefreshCw
                            size={24}
                            className="animate-spin"
                            style={{ margin: '0 auto 0.5rem', color: '#059669' }}
                          />
                          <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                            กำลังดึงข้อมูล SumAdjRW แยกรายแผนกจากฐานข้อมูล HOSxP...
                          </p>
                        </td>
                      </tr>
                    ) : deptAdjrwError ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#dc2626', fontWeight: 600 }}>
                          <AlertCircle size={20} style={{ margin: '0 auto 0.5rem' }} />
                          <p style={{ margin: 0 }}>{deptAdjrwError}</p>
                        </td>
                      </tr>
                    ) : deptAdjrwData.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                          ไม่พบข้อมูล SumAdjRW ในช่วงเวลาที่เลือก
                        </td>
                      </tr>
                    ) : (
                      deptMonthRows.map((row, idx) => (
                        <tr key={row.month || idx}>
                          <td
                            className="rcm-text-center font-mono"
                            style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}
                          >
                            {row.month}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.medicine > 0 ? 600 : 400,
                              color: row.medicine > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.medicine > 0 ? row.medicine.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.surgery > 0 ? 600 : 400,
                              color: row.surgery > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.surgery > 0 ? row.surgery.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.obgyn > 0 ? 600 : 400,
                              color: row.obgyn > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.obgyn > 0 ? row.obgyn.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.pediatrics > 0 ? 600 : 400,
                              color: row.pediatrics > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.pediatrics > 0 ? row.pediatrics.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.orthopedics > 0 ? 600 : 400,
                              color: row.orthopedics > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.orthopedics > 0 ? row.orthopedics.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.ent > 0 ? 600 : 400,
                              color: row.ent > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.ent > 0 ? row.ent.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.eye > 0 ? 600 : 400,
                              color: row.eye > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.eye > 0 ? row.eye.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.other > 0 ? 600 : 400,
                              color: row.other > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.other > 0 ? row.other.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.dental > 0 ? 600 : 400,
                              color: row.dental > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.dental > 0 ? row.dental.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: row.psychiatry > 0 ? 600 : 400,
                              color: row.psychiatry > 0 ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {row.psychiatry > 0 ? row.psychiatry.toFixed(4) : '-'}
                          </td>
                          <td
                            className="rcm-text-center font-mono"
                            style={{
                              fontWeight: 800,
                              color: '#064e3b',
                              backgroundColor: '#f0fdf4',
                              borderLeft: '2px solid #a7f3d0',
                            }}
                          >
                            {row.total.toFixed(4)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {deptTotalSummaryRow && (
                    <tfoot>
                      <tr
                        className="total-row"
                        style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1' }}
                      >
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            <Sparkles size={14} style={{ color: '#059669' }} />
                            <span>รวม</span>
                          </div>
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.medicine.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.surgery.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.obgyn.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.pediatrics.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.orthopedics.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.ent.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.eye.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.other.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.dental.toFixed(4)}
                        </td>
                        <td className="rcm-text-center font-mono" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {deptTotalSummaryRow.psychiatry.toFixed(4)}
                        </td>
                        <td
                          className="rcm-text-center font-mono"
                          style={{
                            fontWeight: 900,
                            color: '#064e3b',
                            backgroundColor: '#dcfce7',
                            borderLeft: '2px solid #86efac',
                            fontSize: '0.92rem',
                          }}
                        >
                          {deptTotalSummaryRow.total.toFixed(4)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
            <div
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                fontSize: '0.85rem',
                color: '#1e293b',
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>แสดงข้อมูล SumAdjRW รวม 10 แผนกการรักษา</span>
              <span>
                {deptTotalSummaryRow ? (
                  <>
                    SumAdjRW รวมทั้งหมด:{' '}
                    <b style={{ color: '#047857', fontSize: '0.95rem' }}>
                      {deptTotalSummaryRow.total.toFixed(4)}
                    </b>
                  </>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: 📊 กราฟสรุป (Charts)                                            */}
      {/* 3 กราฟแท่งแนวตั้ง (Horizontal BarCharts) ตามต้นฉบับ                          */}
      {/* ========================================================================= */}
      {subTab === 'overview' && (
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
      )}
    </div>
  )
}
