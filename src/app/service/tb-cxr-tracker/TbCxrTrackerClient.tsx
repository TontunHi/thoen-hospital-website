'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import ExcelJS from 'exceljs'
import {
  ArrowLeft,
  Search,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Download,
  Building2,
  Users,
  Check,
  Copy,
  X,
  Clock,
  Sparkles,
  Filter
} from 'lucide-react'
import './page.css'

interface TbRecord {
  id: number
  risk_type: string | null
  title: string | null
  fname: string | null
  lname: string | null
  cid: string | null
  gender: string | null
  born: string | null
  addr: string | null
  mu: string | null
  province_id: string | null
  amphur_id: string | null
  tambol_id: string | null
  full_name: string | null
  people_type: string | null
  race_id: string | null
  hn: string | null
  inccl_id: string | null
  contact_date: string | null
  symptom_screen: string | null
  cxr_date: string | null
  cxr_status: 'DONE' | 'MISSING'
  cxr_result: string | null
  cxr_abnormal_result: string | null
  dx: string | null
  icd10: string | null
  hba1c: string | null
  immunno_discase: string | null
  b24: string | null
  b24_ch: string | null
  note: string | null
  age: number | null
  status: string
  home: string
}

interface SummaryData {
  total: number
  doneCount: number
  missingCount: number
  coveragePercentage: number
  statusBreakdown: Record<string, number>
}

interface Props {
  userRole?: string
}

/** แปลงวันที่ YYYYMMDD หรือ YYYY-MM-DD เป็นวันที่ไทย พ.ศ. (เช่น "16 ต.ค. 2569") */
function formatThaiDateString(rawDate?: string | null): string {
  if (!rawDate) return '-'
  try {
    let year = 0
    let month = 0
    let day = 0

    const clean = String(rawDate).trim()
    if (clean.length === 8 && /^\d{8}$/.test(clean)) {
      year = parseInt(clean.substring(0, 4), 10)
      month = parseInt(clean.substring(4, 6), 10) - 1
      day = parseInt(clean.substring(6, 8), 10)
    } else {
      const d = new Date(clean)
      if (isNaN(d.getTime())) return clean
      year = d.getFullYear()
      month = d.getMonth()
      day = d.getDate()
    }

    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    const thaiYear = year > 2400 ? year : year + 543
    return `${day} ${monthNames[month]} ${thaiYear}`
  } catch {
    return String(rawDate)
  }
}

/** Mask ข้อมูลส่วนบุคคลตามมาตรฐาน PDPA (แสดง 4 ตัวท้าย) */
function maskCid(cid?: string | null, isMasked = true): string {
  if (!cid) return '-'
  if (!isMasked) return cid
  const s = String(cid).trim()
  if (s.length < 5) return s
  return 'x-xxxx-xxxxx-xx-' + s.slice(-4)
}

function maskHn(hn?: string | null, isMasked = true): string {
  if (!hn) return '-'
  if (!isMasked) return hn
  const s = String(hn).trim()
  if (s.length < 5) return s
  return '***' + s.slice(-4)
}

export default function TbCxrTrackerClient({ userRole }: Props) {
  const [data, setData] = useState<TbRecord[]>([])
  const [summary, setSummary] = useState<SummaryData>({
    total: 0,
    doneCount: 0,
    missingCount: 0,
    coveragePercentage: 0,
    statusBreakdown: {}
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  // Filters & Controls
  const [activeTab, setActiveTab] = useState<'all' | 'done' | 'missing'>('all')
  const [selectedHosp, setSelectedHosp] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isMasked, setIsMasked] = useState<boolean>(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 50

  // Export Modal
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopyCode = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 1800)
  }

  // Fetch initial data
  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    else setLoading(true)

    try {
      setFetchError(null)
      // ดึงข้อมูลทั้งหมดผ่านเส้น API Gateway Adapter
      const res = await fetch('/api/service/tb-cxr-tracker?status=all', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setData(json.data || [])
        if (json.summary) {
          setSummary(json.summary)
        }
        setLastFetched(new Date())
      } else {
        setFetchError(json.error || 'ไม่สามารถโหลดข้อมูลจากระบบได้')
      }
    } catch (err: any) {
      console.error('Failed to load TB CXR data:', err)
      setFetchError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
      if (manual) setTimeout(() => setRefreshing(false), 500)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when tab/filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, selectedHosp, searchTerm])

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // 1. Tab Status Filter
      if (activeTab === 'done' && item.cxr_status !== 'DONE') return false
      if (activeTab === 'missing' && item.cxr_status !== 'MISSING') return false

      // 2. Hospital Filter
      if (selectedHosp && item.status !== selectedHosp) return false

      // 3. Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const hn = String(item.hn || '').toLowerCase()
        const cid = String(item.cid || '').toLowerCase()
        const fullname = `${item.fname || ''} ${item.lname || ''}`.toLowerCase()
        const home = String(item.home || '').toLowerCase()
        if (!hn.includes(q) && !cid.includes(q) && !fullname.includes(q) && !home.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [data, activeTab, selectedHosp, searchTerm])

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  // List of all unique health centers
  const hospList = useMemo(() => {
    const keys = Object.keys(summary.statusBreakdown || {})
    if (keys.length > 0) return keys.sort()
    return Array.from(new Set(data.map((d) => d.status).filter(Boolean))).sort()
  }, [summary.statusBreakdown, data])

  // Export to Excel using exceljs
  const handleExportExcel = async (exportType: 'filtered' | 'all' | 'done' | 'missing') => {
    setIsExporting(true)
    try {
      let exportRows: TbRecord[] = []
      let filenameSuffix = ''

      if (exportType === 'filtered') {
        exportRows = filteredData
        filenameSuffix = `filtered_${activeTab}`
      } else if (exportType === 'all') {
        exportRows = data
        filenameSuffix = 'all_5680'
      } else if (exportType === 'done') {
        exportRows = data.filter((d) => d.cxr_status === 'DONE')
        filenameSuffix = 'cxr_done_1494'
      } else if (exportType === 'missing') {
        exportRows = data.filter((d) => d.cxr_status === 'MISSING')
        filenameSuffix = 'cxr_missing_4186'
      }

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'โรงพยาบาลเถิน (Thoen Hospital)'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet('รายชื่อคัดกรอง CXR', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      })

      // Header definitions
      sheet.columns = [
        { header: 'ลำดับ', key: 'no', width: 8 },
        { header: 'HN', key: 'hn', width: 12 },
        { header: 'คำนำ', key: 'title', width: 10 },
        { header: 'ชื่อ', key: 'fname', width: 18 },
        { header: 'นามสกุล', key: 'lname', width: 20 },
        { header: 'เลขบัตรประชาชน', key: 'cid', width: 18 },
        { header: 'เพศ', key: 'gender', width: 8 },
        { header: 'อายุ (ปี)', key: 'age', width: 10 },
        { header: 'วันเกิด (YYYYMMDD)', key: 'born_raw', width: 16 },
        { header: 'วันเกิด (ไทย)', key: 'born', width: 14 },
        { header: 'สถานะ CXR', key: 'cxr_status_text', width: 16 },
        { header: 'รหัสสถานะ (cxr_status)', key: 'cxr_status', width: 18 },
        { header: 'ค่าวันที่ CXR (cxr_date)', key: 'cxr_date_raw', width: 22 },
        { header: 'วันที่ตรวจ CXR (ไทย)', key: 'cxr_date', width: 18 },
        { header: 'รพ.สต. / สถานพยาบาล', key: 'status', width: 22 },
        { header: 'ที่อยู่ตามทะเบียน', key: 'home', width: 40 },
        { header: 'สิทธิการรักษา', key: 'inccl_id', width: 24 },
        { header: 'ผลตรวจ CXR (cxr_result)', key: 'cxr_result', width: 20 },
        { header: 'ผลผิดปกติ (cxr_abnormal_result)', key: 'cxr_abnormal_result', width: 24 },
        { header: 'หมายเหตุ', key: 'note', width: 20 },
      ]

      // Style header row
      const headerRow = sheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Sarabun' }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' } // Deep Teal
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      // Add Data Rows
      exportRows.forEach((r, idx) => {
        const isDone = r.cxr_status === 'DONE'
        const row = sheet.addRow({
          no: idx + 1,
          hn: r.hn || '',
          title: r.title || '',
          fname: r.fname || '',
          lname: r.lname || '',
          cid: r.cid || '',
          gender: r.gender === 'M' ? 'ชาย' : r.gender === 'F' ? 'หญิง' : '',
          age: r.age ?? '',
          born_raw: r.born || '',
          born: formatThaiDateString(r.born),
          cxr_status_text: isDone ? 'ตรวจแล้ว' : 'ยังไม่ได้ตรวจ',
          cxr_status: r.cxr_status || (isDone ? 'DONE' : 'MISSING'),
          cxr_date_raw: r.cxr_date || '',
          cxr_date: isDone ? formatThaiDateString(r.cxr_date) : '-',
          status: r.status || '',
          home: r.home || '',
          inccl_id: r.inccl_id || '',
          cxr_result: r.cxr_result || '',
          cxr_abnormal_result: r.cxr_abnormal_result || '',
          note: r.note || '',
        })

        // Status highlight
        const statusCell = row.getCell('cxr_status_text')
        const codeCell = row.getCell('cxr_status')
        if (isDone) {
          statusCell.font = { color: { argb: 'FF059669' }, bold: true } // Green
          codeCell.font = { color: { argb: 'FF059669' }, bold: true }
        } else {
          statusCell.font = { color: { argb: 'FFDC2626' }, bold: true } // Red
          codeCell.font = { color: { argb: 'FFDC2626' }, bold: true }
        }

        row.height = 22
        row.alignment = { vertical: 'middle' }
      })

      // Generate buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.href = url
      a.download = `tb_cxr_tracker_${filenameSuffix}_${timestamp}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportModalOpen(false)
    } catch (err) {
      console.error('Export error:', err)
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="tbPageWrapper">
      <div className="tbContainer">
        {/* Navigation & Header */}
        <header className="tbHeader">
          <div className="tbHeaderLeft">
            <Link href="/service" className="tbBackLink">
              <ArrowLeft size={16} /> กลับหน้ารวมบริการ
            </Link>
            <div className="tbTitleRow">
              <h1 className="tbTitle">ระบบติดตามการทำ CXR ในกลุ่มผู้ป่วย TB</h1>
              <span className="tbLiveBadge">
                <span className="tbPulseDot"></span> LIVE API
              </span>
            </div>
            <p className="tbSubtitle">
              โรงพยาบาลเถิน · ฐานข้อมูล HOSxP & กลุ่มคัดกรองวัณโรค (CXR Screening Tracker)
            </p>
          </div>

          <div className="tbHeaderActions">
            <button
              onClick={() => setIsMasked(!isMasked)}
              className={`tbActionBtn ${isMasked ? '' : 'active'}`}
              title={isMasked ? 'แสดงข้อมูลแบบไม่ปิดบัง' : 'ซ่อนข้อมูลส่วนบุคคล (PDPA)'}
            >
              {isMasked ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{isMasked ? 'แสดง PDPA' : 'ซ่อน PDPA'}</span>
            </button>

            <button
              onClick={() => fetchData(true)}
              className="tbActionBtn"
              disabled={refreshing}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={refreshing ? 'tbSpin' : ''} />
              <span>รีเฟรช</span>
            </button>

            <button
              onClick={() => setExportModalOpen(true)}
              className="tbExportBtn"
              title="ส่งออกไฟล์ Excel"
            >
              <FileSpreadsheet size={16} />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </header>

        {/* KPI Metrics Dashboard */}
        <section className="tbKpiGrid">
          <div className="tbKpiCard primary">
            <div className="tbKpiIconWrapper primary">
              <Users size={22} />
            </div>
            <div className="tbKpiContent">
              <span className="tbKpiLabel">กลุ่มเป้าหมายคัดกรองทั้งหมด</span>
              <div className="tbKpiValue">
                {summary.total.toLocaleString()} <span className="tbKpiUnit">ราย</span>
              </div>
              <span className="tbKpiSub">ฐานข้อมูล CID.cid_link_tb</span>
            </div>
          </div>

          <div className="tbKpiCard success">
            <div className="tbKpiIconWrapper success">
              <CheckCircle2 size={22} />
            </div>
            <div className="tbKpiContent">
              <span className="tbKpiLabel">ตรวจ CXR แล้ว (มีผลบันทึก)</span>
              <div className="tbKpiValue">
                {summary.doneCount.toLocaleString()} <span className="tbKpiUnit">ราย</span>
              </div>
              <div className="tbProgressBar">
                <div
                  className="tbProgressFill"
                  style={{ width: `${summary.coveragePercentage}%` }}
                ></div>
              </div>
              <span className="tbKpiSub successText">
                ความครอบคลุม {summary.coveragePercentage}%
              </span>
            </div>
          </div>

          <div className="tbKpiCard warning">
            <div className="tbKpiIconWrapper warning">
              <Clock size={22} />
            </div>
            <div className="tbKpiContent">
              <span className="tbKpiLabel">ยังไม่ได้ตรวจ CXR / รอคัดกรอง</span>
              <div className="tbKpiValue">
                {summary.missingCount.toLocaleString()} <span className="tbKpiUnit">ราย</span>
              </div>
              <span className="tbKpiSub warningText">
                คงเหลือ {(100 - summary.coveragePercentage).toFixed(1)}% ที่ต้องลงพื้นที่
              </span>
            </div>
          </div>
        </section>

        {/* Filter & Control Bar */}
        <section className="tbControlPanel">
          {/* Segmented Tab Switcher */}
          <div className="tbTabGroup">
            <button
              className={`tbTabBtn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              ทั้งหมด
              <span className="tbTabBadge">{summary.total.toLocaleString()}</span>
            </button>
            <button
              className={`tbTabBtn done ${activeTab === 'done' ? 'active' : ''}`}
              onClick={() => setActiveTab('done')}
            >
              <CheckCircle2 size={15} />
              ตรวจ CXR แล้ว
              <span className="tbTabBadge done">{summary.doneCount.toLocaleString()}</span>
            </button>
            <button
              className={`tbTabBtn missing ${activeTab === 'missing' ? 'active' : ''}`}
              onClick={() => setActiveTab('missing')}
            >
              <AlertCircle size={15} />
              ยังไม่ได้ตรวจ
              <span className="tbTabBadge missing">{summary.missingCount.toLocaleString()}</span>
            </button>
          </div>

          {/* Search & Hospital Dropdown */}
          <div className="tbFilterRow">
            <div className="tbSearchBox">
              <Search size={16} className="tbSearchIcon" />
              <input
                type="text"
                placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล หรือที่อยู่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="tbSearchInput"
              />
              {searchTerm && (
                <button className="tbSearchClear" onClick={() => setSearchTerm('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="tbSelectWrapper">
              <Building2 size={16} className="tbSelectIcon" />
              <select
                value={selectedHosp}
                onChange={(e) => setSelectedHosp(e.target.value)}
                className="tbSelect"
              >
                <option value="">ทุก รพ.สต. / สถานพยาบาล ({hospList.length} แห่ง)</option>
                {hospList.map((hosp) => (
                  <option key={hosp} value={hosp}>
                    {hosp} ({summary.statusBreakdown[hosp] || 0} ราย)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Results Info & Count */}
        <div className="tbMetaBar">
          <span className="tbResultCount">
            พบข้อมูลตามเงื่อนไข <strong>{filteredData.length.toLocaleString()}</strong> ราย
            {selectedHosp && <span className="tbFilterPill">รพ.สต.: {selectedHosp}</span>}
            {searchTerm && <span className="tbFilterPill">ค้นหา: &quot;{searchTerm}&quot;</span>}
          </span>
          {lastFetched && (
            <span className="tbTimestamp">
              อัปเดตล่าสุด: {lastFetched.toLocaleTimeString('th-TH')} น.
            </span>
          )}
        </div>

        {/* Table View */}
        <section className="tbTableCard">
          {loading ? (
            <div className="tbLoadingState">
              <RefreshCw size={32} className="tbSpin" />
              <p>กำลังเชื่อมต่อ API Gateway และโหลดข้อมูลเวชระเบียน...</p>
            </div>
          ) : fetchError ? (
            <div className="tbEmptyState">
              <AlertCircle size={40} style={{ color: '#ef4444' }} />
              <h3>เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
              <p>{fetchError}</p>
              <button
                className="tbResetBtn"
                onClick={() => fetchData(true)}
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="tbEmptyState">
              <AlertCircle size={40} />
              <h3>ไม่พบข้อมูลที่ตรงกับเงื่อนไข</h3>
              <p>ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง รพ.สต.</p>
              <button
                className="tbResetBtn"
                onClick={() => {
                  setSelectedHosp('')
                  setSearchTerm('')
                  setActiveTab('all')
                }}
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            <div className="tbTableResponsive">
              <table className="tbTable">
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>ลำดับ</th>
                    <th style={{ width: '100px' }}>HN</th>
                    <th style={{ width: '180px' }}>ชื่อ - สกุล</th>
                    <th style={{ width: '170px' }}>เลขบัตรประชาชน</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>เพศ/อายุ</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>สถานะ CXR</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>วันที่ตรวจ CXR</th>
                    <th style={{ width: '170px' }}>รพ.สต. ที่รับผิดชอบ</th>
                    <th>ที่อยู่</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1
                    const isDone = row.cxr_status === 'DONE'
                    return (
                      <tr key={row.id || `${row.hn}-${idx}`} className={isDone ? 'rowDone' : 'rowMissing'}>
                        <td style={{ textAlign: 'center' }} className="tbColMuted">
                          {rowNumber}
                        </td>
                        <td className="tbColHn">
                          <code>{maskHn(row.hn, isMasked)}</code>
                        </td>
                        <td className="tbColName">
                          <span className="tbPatientName">
                            {row.title || ''}{row.fname || '-'} {row.lname || ''}
                          </span>
                        </td>
                        <td className="tbColCid">
                          <code>{maskCid(row.cid, isMasked)}</code>
                        </td>
                        <td style={{ textAlign: 'center' }} className="tbColMeta">
                          <span className="tbGenderBadge">
                            {row.gender === 'M' ? 'ช' : row.gender === 'F' ? 'ญ' : '-'}
                          </span>
                          <span className="tbAgeText">{row.age ? `${row.age} ปี` : '-'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="tbStatusWrapper">
                            <span className={`tbStatusBadge ${isDone ? 'done' : 'missing'}`}>
                              {isDone ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                              {isDone ? 'ตรวจแล้ว' : 'ยังไม่ได้ตรวจ'}
                            </span>
                            <span
                              className={`tbStatusCodePill ${isDone ? 'done' : 'missing'}`}
                              title="รหัสสถานะในระบบ (cxr_status)"
                            >
                              {row.cxr_status}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }} className="tbColDate">
                          {isDone && row.cxr_date ? (
                            <div className="tbDateCellWrapper">
                              <span className="tbDatePill">
                                {formatThaiDateString(row.cxr_date)}
                              </span>
                              <button
                                type="button"
                                className={`tbDateRawBtn ${copiedCode === row.cxr_date ? 'copied' : ''}`}
                                title="คลิกเพื่อคัดลอกค่า cxr_date (YYYYMMDD)"
                                onClick={() => handleCopyCode(row.cxr_date!)}
                              >
                                {copiedCode === row.cxr_date ? (
                                  <>
                                    <Check size={11} /> คัดลอกแล้ว
                                  </>
                                ) : (
                                  <>
                                    <Copy size={10} /> {row.cxr_date}
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="tbDateCellWrapper">
                              <span className="tbMutedDash">-</span>
                              <code className="tbDateRawMissing" title="ยังไม่มีค่า cxr_date">
                                NULL
                              </code>
                            </div>
                          )}
                        </td>
                        <td className="tbColHosp">
                          <span className="tbHospTag">{row.status || '-'}</span>
                        </td>
                        <td className="tbColHome" title={row.home || ''}>
                          {row.home || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Bar */}
          {!loading && filteredData.length > 0 && (
            <div className="tbPagination">
              <span className="tbPaginationInfo">
                แสดงแถวที่ {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredData.length)} จากทั้งหมด{' '}
                {filteredData.length.toLocaleString()} รายการ
              </span>

              <div className="tbPaginationControls">
                <button
                  className="tbPageBtn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="หน้าแรก"
                >
                  «
                </button>
                <button
                  className="tbPageBtn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="tbPageCurrent">
                  หน้า {currentPage} / {totalPages}
                </span>

                <button
                  className="tbPageBtn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className="tbPageBtn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="หน้าสุดท้าย"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Export Options Modal */}
      {exportModalOpen && (
        <div className="tbModalOverlay" onClick={() => !isExporting && setExportModalOpen(false)}>
          <div className="tbModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="tbModalHeader">
              <div className="tbModalIcon">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h3 className="tbModalTitle">ส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)</h3>
                <p className="tbModalSubtitle">
                  เลือกประเภทชุดข้อมูลที่ต้องการส่งออกสำหรับนำไปติดตามในพื้นที่
                </p>
              </div>
              <button
                className="tbModalClose"
                disabled={isExporting}
                onClick={() => setExportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="tbModalBody">
              <button
                className="tbExportChoiceBtn"
                disabled={isExporting}
                onClick={() => handleExportExcel('filtered')}
              >
                <div className="tbChoiceIcon">
                  <Filter size={18} />
                </div>
                <div className="tbChoiceText">
                  <strong>ส่งออกตามตัวกรองที่เลือกไว้ปัจจุบัน (Filtered View)</strong>
                  <span>
                    ส่งออกจำนวน {filteredData.length.toLocaleString()} รายการ (ตามแท็บ & รพ.สต. ที่เลือก)
                  </span>
                </div>
                <Download size={16} className="tbChoiceArrow" />
              </button>

              <button
                className="tbExportChoiceBtn warningChoice"
                disabled={isExporting}
                onClick={() => handleExportExcel('missing')}
              >
                <div className="tbChoiceIcon warning">
                  <AlertCircle size={18} />
                </div>
                <div className="tbChoiceText">
                  <strong>ส่งออกเฉพาะกลุ่มที่ &quot;ยังไม่ได้ตรวจ CXR&quot; (Missing)</strong>
                  <span>
                    ส่งออกทั้งหมด {summary.missingCount.toLocaleString()} ราย เพื่อนำไปใช้วางแผนติดตามคัดกรอง
                  </span>
                </div>
                <Download size={16} className="tbChoiceArrow" />
              </button>

              <button
                className="tbExportChoiceBtn successChoice"
                disabled={isExporting}
                onClick={() => handleExportExcel('done')}
              >
                <div className="tbChoiceIcon success">
                  <CheckCircle2 size={18} />
                </div>
                <div className="tbChoiceText">
                  <strong>ส่งออกเฉพาะกลุ่มที่ &quot;ตรวจ CXR แล้ว&quot; (Done)</strong>
                  <span>
                    ส่งออกจำนวน {summary.doneCount.toLocaleString()} ราย ที่มีผลบันทึกเรียบร้อยแล้ว
                  </span>
                </div>
                <Download size={16} className="tbChoiceArrow" />
              </button>

              <button
                className="tbExportChoiceBtn allChoice"
                disabled={isExporting}
                onClick={() => handleExportExcel('all')}
              >
                <div className="tbChoiceIcon primary">
                  <Users size={18} />
                </div>
                <div className="tbChoiceText">
                  <strong>ส่งออกกลุ่มเป้าหมายทั้งหมด (All Targets)</strong>
                  <span>
                    ส่งออกครบถ้วนทุกกลุ่ม {summary.total.toLocaleString()} รายการ
                  </span>
                </div>
                <Download size={16} className="tbChoiceArrow" />
              </button>
            </div>

            {isExporting && (
              <div className="tbExportLoading">
                <RefreshCw size={18} className="tbSpin" />
                <span>กำลังสร้างไฟล์ Excel พร้อมจัดรูปแบบตาราง...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
