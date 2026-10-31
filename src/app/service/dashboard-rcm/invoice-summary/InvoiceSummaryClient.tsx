'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ReceiptText,
  Activity,
  BedDouble,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  Landmark,
  Wallet,
  Check,
  X,
} from 'lucide-react'
import {
  InvoiceSummaryItem,
  InvoiceSummaryResult,
  InvoiceDetailItem,
  InvoiceDetailResult,
} from '@/lib/clinical/rcmDashboardService'
import './page.css'

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const THAI_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export default function InvoiceSummaryClient() {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const defaultFiscalYear = currentMonth >= 10 ? currentCalYear + 1 : currentCalYear

  // Default to ongoing calendar month
  const initialMStr = String(currentMonth).padStart(2, '0')
  const initialLastDay = new Date(currentCalYear, currentMonth, 0).getDate()
  const defaultDs1 = `${currentCalYear}-${initialMStr}-01`
  const defaultDs2 = `${currentCalYear}-${initialMStr}-${String(initialLastDay).padStart(2, '0')}`

  // ── Filters & Controls State ───────────────────────────────
  const [department, setDepartment] = useState<'OP' | 'IP'>('OP')
  const [dateMode, setDateMode] = useState<'month' | 'year' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedYear, setSelectedYear] = useState<number>(currentCalYear)
  const [ds1, setDs1] = useState<string>(defaultDs1)
  const [ds2, setDs2] = useState<string>(defaultDs2)
  const [dateType, setDateType] = useState<'bill_date' | 'admdate'>('bill_date')
  const [selectedPttype, setSelectedPttype] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  // ── Data States ───────────────────────────────────────────
  const [summaryData, setSummaryData] = useState<InvoiceSummaryResult | null>(null)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [detailData, setDetailData] = useState<InvoiceDetailResult | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)
  const [exporting, setExporting] = useState<boolean>(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const availableYears = useMemo(() => {
    const list = []
    for (let y = defaultFiscalYear + 1; y >= defaultFiscalYear - 5; y--) {
      list.push(y)
    }
    return list
  }, [defaultFiscalYear])

  // ── Handle Date Changes ───────────────────────────────────
  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month)
    const mStr = String(month).padStart(2, '0')
    const startDate = `${selectedYear}-${mStr}-01`
    const lastDay = new Date(selectedYear, month, 0).getDate()
    const endDate = `${selectedYear}-${mStr}-${String(lastDay).padStart(2, '0')}`
    setDs1(startDate)
    setDs2(endDate)
    setPage(1)
  }

  const handleSelectYear = (year: number) => {
    setSelectedYear(year)
    if (dateMode === 'month') {
      const mStr = String(selectedMonth).padStart(2, '0')
      const startDate = `${year}-${mStr}-01`
      const lastDay = new Date(year, selectedMonth, 0).getDate()
      const endDate = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`
      setDs1(startDate)
      setDs2(endDate)
    } else if (dateMode === 'year') {
      // Fiscal year: Oct 1 of previous year to Sep 30 of target year
      const startDate = `${year - 1}-10-01`
      const endDate = `${year}-09-30`
      setDs1(startDate)
      setDs2(endDate)
    }
    setPage(1)
  }

  // Quick Quarter Selection (Thai Government Fiscal Quarters)
  const handleSelectQuarter = (q: 1 | 2 | 3 | 4) => {
    let start = ''
    let end = ''
    if (q === 1) {
      // Q1: ต.ค. - ธ.ค.
      start = `${selectedYear - 1}-10-01`
      end = `${selectedYear - 1}-12-31`
    } else if (q === 2) {
      // Q2: ม.ค. - มี.ค.
      start = `${selectedYear}-01-01`
      end = `${selectedYear}-03-31`
    } else if (q === 3) {
      // Q3: เม.ย. - มิ.ย.
      start = `${selectedYear}-04-01`
      end = `${selectedYear}-06-30`
    } else {
      // Q4: ก.ค. - ก.ย.
      start = `${selectedYear}-07-01`
      end = `${selectedYear}-09-30`
    }
    setDs1(start)
    setDs2(end)
    setPage(1)
  }

  // ── Fetch Summary Data ─────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/invoice-summary?department=${department}&ds1=${encodeURIComponent(ds1)}&ds2=${encodeURIComponent(ds2)}&dateType=${dateType}&mode=summary`
      )
      const json = await res.json()
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to fetch invoice summary')
      }
      setSummaryData(json.data)
    } catch (err: unknown) {
      setSummaryError((err as Error).message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลสรุป')
    } finally {
      setSummaryLoading(false)
    }
  }, [department, ds1, ds2, dateType])

  // ── Fetch Detail Data ──────────────────────────────────────
  const fetchDetails = useCallback(async () => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const pttypeParam = selectedPttype ? `&pttype=${encodeURIComponent(selectedPttype)}` : ''
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
      const res = await fetch(
        `/api/service/dashboard-rcm/invoice-summary?department=${department}&ds1=${encodeURIComponent(ds1)}&ds2=${encodeURIComponent(ds2)}&dateType=${dateType}&mode=detail&page=${page}&pageSize=${pageSize}${pttypeParam}${searchParam}`
      )
      const json = await res.json()
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to fetch invoice details')
      }
      setDetailData(json.data)
    } catch (err: unknown) {
      setDetailError((err as Error).message || 'เกิดข้อผิดพลาดในการโหลดรายละเอียดผู้ป่วย')
    } finally {
      setDetailLoading(false)
    }
  }, [department, ds1, ds2, dateType, selectedPttype, debouncedSearch, page, pageSize])

  // Trigger data fetches on filter changes
  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  // When clicking a row in Summary table
  const handlePttypeClick = (code: string) => {
    if (selectedPttype === code) {
      setSelectedPttype('') // unselect if already selected
    } else {
      setSelectedPttype(code)
    }
    setPage(1)
  }

  // ── Export Excel with Professional Financial Layout ───────
  const handleExportExcel = async () => {
    if (!summaryData) return
    setExporting(true)
    try {
      // 1. Fetch all detail rows for export
      const pttypeParam = selectedPttype ? `&pttype=${encodeURIComponent(selectedPttype)}` : ''
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
      const res = await fetch(
        `/api/service/dashboard-rcm/invoice-summary?department=${department}&ds1=${encodeURIComponent(ds1)}&ds2=${encodeURIComponent(ds2)}&dateType=${dateType}&mode=detail&exportAll=true${pttypeParam}${searchParam}`
      )
      const json = await res.json()
      const allDetails: InvoiceDetailItem[] = json.data?.items || []

      // 2. Build workbook
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Thoen Hospital RCM System'
      workbook.created = new Date()

      // Sheet 1: Summary by Pttype
      const sheetSummary = workbook.addWorksheet(`สรุปตามสิทธิ (${department})`)
      sheetSummary.views = [{ showGridLines: true }]

      // Header row styling
      sheetSummary.mergeCells('A1:H1')
      const titleCell = sheetSummary.getCell('A1')
      titleCell.value = `รายงานสรุปรายรับจาก Invoice (${department === 'OP' ? 'ผู้ป่วยนอก OPD' : 'ผู้ป่วยใน IPD'}) วันที่ ${ds1} ถึง ${ds2}`
      titleCell.font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FF0F172A' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

      sheetSummary.addRow([])
      sheetSummary.addRow(['รหัส', 'สิทธิการรักษา e-Claim', 'จำนวนคน', 'รายรับจากกองทุน', 'ชดเชยจริง', 'ส่วนต่ำ (กำไร)', 'ส่วนสูง (ขาดทุน)', 'ลูกหนี้ รพ.'])
      const summaryHeaderRow = sheetSummary.getRow(3)
      summaryHeaderRow.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      summaryHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' },
      }
      summaryHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }

      summaryData.items.forEach((item) => {
        sheetSummary.addRow([
          item.code,
          item.name,
          item.visit,
          item.receipt,
          item.compensated,
          item.down,
          item.up,
          item.debit,
        ])
      })

      // Grand Total Row
      const grandRow = sheetSummary.addRow([
        '',
        'รวมทั้งหมด',
        summaryData.grandTotal.visit,
        summaryData.grandTotal.receipt,
        summaryData.grandTotal.compensated,
        summaryData.grandTotal.down,
        summaryData.grandTotal.up,
        summaryData.grandTotal.debit,
      ])
      grandRow.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF0F172A' } }
      grandRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      }

      // Format currency columns
      sheetSummary.getColumn(3).numFmt = '#,##0'
      sheetSummary.getColumn(4).numFmt = '#,##0.00'
      sheetSummary.getColumn(5).numFmt = '#,##0.00'
      sheetSummary.getColumn(6).numFmt = '#,##0.00'
      sheetSummary.getColumn(7).numFmt = '#,##0.00'
      sheetSummary.getColumn(8).numFmt = '#,##0.00'
      sheetSummary.columns.forEach((col) => {
        col.width = 18
      })
      sheetSummary.getColumn(2).width = 38

      // Sheet 2: Detail Patients
      const sheetDetail = workbook.addWorksheet(`รายการผู้ป่วย (${department})`)
      sheetDetail.views = [{ showGridLines: true }]

      sheetDetail.mergeCells('A1:Y1')
      const detailTitleCell = sheetDetail.getCell('A1')
      detailTitleCell.value = `รายชื่อผู้ป่วย รายรับ ${department} วันที่ ${ds1} ถึง ${ds2} ${selectedPttype ? `(สิทธิ: ${selectedPttype})` : '(ทุกสิทธิ)'}`
      detailTitleCell.font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FF0F172A' } }

      sheetDetail.addRow([])
      sheetDetail.addRow([
        'ลำดับ',
        'รหัสสิทธิ e-Claim',
        department === 'OP' ? 'VN' : 'AN',
        'เลขบัตรประชาชน (CID)',
        'HN',
        'ชื่อ-สกุล',
        department === 'OP' ? 'วันที่รับบริการ' : 'วัน Admit',
        department === 'OP' ? 'เวลา' : 'วัน Discharge',
        'ชดเชยจริง',
        'รายรับกองทุน',
        'ค่ารักษา HOSxP',
        'ชำระเอง',
        'ลูกหนี้ HOSxP',
        'HC',
        'AE',
        'INST',
        'OP',
        'IP',
        'Drug',
        'DMIS',
        'ส่วนต่ำ',
        'ส่วนสูง',
        'เลข REP',
        'เลข Bill',
        'วันที่ Bill',
      ])

      const detailHeaderRow = sheetDetail.getRow(3)
      detailHeaderRow.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      detailHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' },
      }
      detailHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }

      allDetails.forEach((row, i) => {
        sheetDetail.addRow([
          i + 1,
          row.pttype_eclaim_id || '',
          row.vnOrAn,
          row.cid,
          row.hn,
          row.ptname,
          row.vstdate || row.admdate || '',
          row.vsttime || row.dchdate || '',
          row.compensated,
          row.fund_money,
          row.income_hosxp,
          row.rcpt_money,
          row.debit_hosxp,
          row.hc,
          row.ae,
          row.inst,
          row.op,
          row.ip,
          row.drug,
          row.dmis,
          row.down,
          row.up,
          row.rep,
          row.bill,
          row.billdate,
        ])
      })

      sheetDetail.columns.forEach((col, idx) => {
        if (idx >= 8 && idx <= 21) {
          col.numFmt = '#,##0.00'
          col.width = 14
        } else {
          col.width = 16
        }
      })
      sheetDetail.getColumn(1).width = 8   // ลำดับ
      sheetDetail.getColumn(2).width = 16  // รหัสสิทธิ
      sheetDetail.getColumn(3).width = 16  // VN/AN
      sheetDetail.getColumn(4).width = 20  // CID
      sheetDetail.getColumn(5).width = 12  // HN
      sheetDetail.getColumn(6).width = 24  // ชื่อ-สกุล

      // 3. Download file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `RCM_Invoice_${department}_${ds1}_${ds2}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด Excel: ' + (err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  // Only show rights that have actual data (visit > 0)
  const activeSummaryItems = useMemo(() => {
    return summaryData?.items?.filter((row) => row.visit > 0) || []
  }, [summaryData])

  // Selected pttype name for detail section title
  const activePttypeName = useMemo(() => {
    if (!selectedPttype || !summaryData) return 'ทุกสิทธิการรักษา'
    const match = summaryData.items.find((i) => i.code === selectedPttype)
    return match ? `${match.code} - ${match.name}` : selectedPttype
  }, [selectedPttype, summaryData])

  // Fast lookup mapping of e-Claim code to descriptive name
  const pttypeNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (summaryData?.items) {
      for (const item of summaryData.items) {
        if (item.code) {
          map[item.code] = item.name
        }
      }
    }
    return map
  }, [summaryData])

  // Calculation for net surplus/deficit
  const netDifference = useMemo(() => {
    if (!summaryData) return 0
    return summaryData.grandTotal.compensated - summaryData.grandTotal.debit
  }, [summaryData])

  // Recovery Rate KPI %
  const recoveryRate = useMemo(() => {
    if (!summaryData || !summaryData.grandTotal.debit) return 0
    return Math.round((summaryData.grandTotal.compensated / summaryData.grandTotal.debit) * 1000) / 10
  }, [summaryData])

  // Average compensation per visit
  const avgCompPerVisit = useMemo(() => {
    if (!summaryData || !summaryData.grandTotal.visit) return 0
    return Math.round((summaryData.grandTotal.compensated / summaryData.grandTotal.visit) * 100) / 100
  }, [summaryData])

  return (
    <div className="invoice-summary-container">
      {/* ── 1. Top Header Banner (Hospital Authority Theme) ───────────── */}
      <div className="rcm-page-header">
        <div className="rcm-page-header-title">
          <div className="rcm-icon-badge">
            <ReceiptText size={26} />
          </div>
          <div>
            <div className="invoice-header-meta-row">
              <span className="invoice-badge-tag">รายงาน 5.2.2.1 • RCM RECONCILIATION</span>
              <span className="invoice-live-status-pill">
                <span className="invoice-status-dot" />
                <span>Live Data • HOSxP & RCM</span>
              </span>
            </div>
            <h2 className="rcm-header-h2">
              รายงานสรุปรายรับจาก Invoice (e-Claim)
            </h2>
            <p className="rcm-header-desc">
              เปรียบเทียบลูกหนี้ค่ารักษาพยาบาล HOSxP กับยอดเงินชดเชยที่ สปสช./กองทุน จ่ายจริง ({department === 'OP' ? 'ผู้ป่วยนอก OPD' : 'ผู้ป่วยใน IPD'})
            </p>
          </div>
        </div>

        <div className="rcm-actions-row">
          <button
            type="button"
            onClick={() => {
              fetchSummary()
              fetchDetails()
            }}
            disabled={summaryLoading || detailLoading}
            className="rcm-btn rcm-btn-secondary"
            title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={summaryLoading || detailLoading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || summaryLoading || !summaryData}
            className="rcm-btn rcm-btn-primary"
            title="ส่งออก Excel ทั้งชุดข้อมูลสรุปและรายการคนไข้"
          >
            <FileSpreadsheet size={16} className={exporting ? 'animate-spin' : ''} />
            <span>{exporting ? 'กำลังส่งออก Excel...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Filter & Date Controls Card ─────────────────── */}
      <div className="invoice-card invoice-filter-card">
        {/* Department Switcher & Mode Picker */}
        <div className="invoice-filter-row">
          <div className="invoice-dept-toggle">
            <button
              onClick={() => {
                setDepartment('OP')
                setSelectedPttype('')
                setPage(1)
              }}
              className={`invoice-dept-btn ${department === 'OP' ? 'active' : ''}`}
            >
              <Activity size={18} />
              <span>ผู้ป่วยนอก (OPD)</span>
            </button>
            <button
              onClick={() => {
                setDepartment('IP')
                setSelectedPttype('')
                setPage(1)
              }}
              className={`invoice-dept-btn ${department === 'IP' ? 'active' : ''}`}
            >
              <BedDouble size={18} />
              <span>ผู้ป่วยใน (IPD)</span>
            </button>
          </div>

          {/* Date Mode Selector */}
          <div className="invoice-date-mode-group">
            <button
              type="button"
              onClick={() => setDateMode('custom')}
              className={`invoice-mode-btn ${dateMode === 'custom' ? 'active' : ''}`}
            >
              กำหนดเอง (วันถึงวัน)
            </button>
            <button
              type="button"
              onClick={() => setDateMode('month')}
              className={`invoice-mode-btn ${dateMode === 'month' ? 'active' : ''}`}
            >
              รายเดือน
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('year')
                handleSelectYear(selectedYear)
              }}
              className={`invoice-mode-btn ${dateMode === 'year' ? 'active' : ''}`}
            >
              รายปีงบประมาณ
            </button>
          </div>

          {/* Date Type Selector (Bill Date vs AdmDate) */}
          <div className="invoice-date-mode-group">
            <button
              type="button"
              onClick={() => {
                setDateType('bill_date')
                setPage(1)
              }}
              className={`invoice-mode-btn ${dateType === 'bill_date' ? 'active' : ''}`}
              title="ค้นหาตามวันที่ออก Invoice / Statement ของ e-Claim (Bill Date)"
            >
              📄 วันที่ออก Invoice
            </button>
            <button
              type="button"
              onClick={() => {
                setDateType('admdate')
                setPage(1)
              }}
              className={`invoice-mode-btn ${dateType === 'admdate' ? 'active' : ''}`}
              title="ค้นหาตามวันที่ผู้ป่วยมารับบริการ (Visit Date / AdmDate)"
            >
              🏥 วันที่รับบริการ
            </button>
          </div>
        </div>

        {/* Dynamic Controls based on Date Mode */}
        <div className="invoice-filter-controls">
          {dateMode === 'month' && (
            <div className="invoice-month-grid">
              <div className="invoice-month-top-controls">
                <div className="invoice-year-select-wrap">
                  <label>เลือกปี พ.ศ.:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleSelectYear(Number(e.target.value))}
                    className="invoice-select"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        พ.ศ. {y + 543}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="invoice-quarter-group">
                  <span className="invoice-quarter-label">เลือกตามไตรมาส:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectQuarter(1)}
                    className="invoice-quarter-btn"
                    title="ไตรมาส 1: ต.ค. - ธ.ค."
                  >
                    Q1 (ต.ค.-ธ.ค.)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectQuarter(2)}
                    className="invoice-quarter-btn"
                    title="ไตรมาส 2: ม.ค. - มี.ค."
                  >
                    Q2 (ม.ค.-มี.ค.)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectQuarter(3)}
                    className="invoice-quarter-btn"
                    title="ไตรมาส 3: เม.ย. - มิ.ย."
                  >
                    Q3 (เม.ย.-มิ.ย.)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectQuarter(4)}
                    className="invoice-quarter-btn"
                    title="ไตรมาส 4: ก.ค. - ก.ย."
                  >
                    Q4 (ก.ค.-ก.ย.)
                  </button>
                </div>
              </div>

              <div className="invoice-month-buttons">
                {THAI_MONTH_SHORT.map((shortName, idx) => {
                  const mNum = idx + 1
                  const isCurrent = mNum === selectedMonth
                  return (
                    <button
                      key={shortName}
                      onClick={() => handleSelectMonth(mNum)}
                      className={`invoice-month-pill ${isCurrent ? 'active' : ''}`}
                      title={THAI_MONTH_NAMES[idx]}
                    >
                      {shortName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {dateMode === 'year' && (
            <div className="invoice-fiscal-year-row">
              <label>เลือกปีงบประมาณ:</label>
              <div className="invoice-year-pills">
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleSelectYear(y)}
                    className={`invoice-fiscal-pill ${selectedYear === y ? 'active' : ''}`}
                  >
                    ปีงบประมาณ {y + 543}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dateMode === 'custom' && (
            <div className="invoice-custom-date-row">
              <div className="invoice-date-input-group">
                <label>วันเริ่มต้น Statement:</label>
                <input
                  type="date"
                  value={ds1}
                  onChange={(e) => setDs1(e.target.value)}
                  className="invoice-date-input"
                />
              </div>
              <div className="invoice-date-input-group">
                <label>วันสิ้นสุด Statement:</label>
                <input
                  type="date"
                  value={ds2}
                  onChange={(e) => setDs2(e.target.value)}
                  className="invoice-date-input"
                />
              </div>
              <button
                onClick={() => {
                  setPage(1)
                  fetchSummary()
                  fetchDetails()
                }}
                className="invoice-btn-apply"
              >
                <Calendar size={16} />
                <span>ประมวลผล</span>
              </button>
            </div>
          )}
        </div>

        {/* Selected Date Range Indicator & Pttype Dropdown */}
        <div className="invoice-filter-footer">
          <div className="invoice-range-badge">
            <Calendar size={16} className="text-emerald-700" />
            <span>
              ช่วงวันที่ค้นหา Statement: <b>{ds1}</b> ถึง <b>{ds2}</b>
            </span>
          </div>

          <div className="invoice-pttype-filter-box">
            <Filter size={16} className="text-slate-500" />
            <label>กรองสิทธิ e-Claim:</label>
            <select
              value={selectedPttype}
              onChange={(e) => {
                setSelectedPttype(e.target.value)
                setPage(1)
              }}
              className="invoice-select invoice-pttype-select"
            >
              <option value="">-- ทุกสิทธิที่มีข้อมูล ({summaryData?.items?.filter((i) => i.visit > 0).length || 0} สิทธิ) --</option>
              {summaryData?.items
                ?.filter((item) => item.visit > 0)
                .map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} - {item.name} ({item.visit.toLocaleString()} ราย)
                  </option>
                ))}
            </select>
            {selectedPttype && (
              <button
                onClick={() => {
                  setSelectedPttype('')
                  setPage(1)
                }}
                className="invoice-btn-clear-filter"
                title="ล้างตัวกรองสิทธิ"
              >
                <X size={13} />
                <span>ล้าง</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. KPI Metric Cards (Executive Financial Summary) ────────── */}
      <div className="invoice-kpi-grid">
        {/* Hero Card: Net Reconciliation Balance */}
        <div className={`invoice-kpi-card kpi-span-hero ${netDifference < 0 ? 'is-deficit' : ''}`}>
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap" style={{ background: netDifference >= 0 ? '#d1fae5' : '#ffe4e6', color: netDifference >= 0 ? '#059669' : '#e11d48' }}>
              {netDifference >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <span className={`kpi-status-badge ${netDifference >= 0 ? 'kpi-badge-gain' : 'kpi-badge-loss'}`}>
              {netDifference >= 0 ? 'ส่วนเกินสุทธิ (+กำไร)' : 'ส่วนขาดสุทธิ (-ขาดทุน)'}
            </span>
          </div>
          <div>
            <span className="kpi-label">ผลการกระทบยอดสุทธิ (Net Reconciliation)</span>
            <div className="kpi-value-wrap">
              <span className={`kpi-value kpi-value-hero ${netDifference >= 0 ? 'font-emerald' : 'font-rose'}`}>
                {summaryLoading ? '...' : (netDifference >= 0 ? '+' : '') + netDifference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="kpi-unit">บาท</span>
            </div>
            <div className="kpi-pill-metric">
              <span>อัตราเงินชดเชยต่อลูกหนี้:</span>
              <b className={recoveryRate >= 100 ? 'text-emerald-700' : 'text-slate-800'}>{summaryLoading ? '...' : `${recoveryRate}%`}</b>
            </div>
            <p className="kpi-hint">
              {netDifference >= 0
                ? 'ยอดเงินชดเชยที่ สปสช./กองทุน โอนจริง สูงกว่าลูกหนี้ค่ารักษาพยาบาล HOSxP'
                : 'ยอดเงินชดเชยที่ สปสช./กองทุน โอนจริง ต่ำกว่าลูกหนี้ค่ารักษาพยาบาล HOSxP'}
            </p>
          </div>
        </div>

        {/* Card 2: Compensated */}
        <div className="invoice-kpi-card kpi-span-standard card-emerald">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap">
              <Landmark size={22} />
            </div>
          </div>
          <div>
            <span className="kpi-label">เงินชดเชยที่ได้รับจริง</span>
            <div className="kpi-value-wrap">
              <span className="kpi-value font-emerald">
                {summaryLoading ? '...' : (summaryData?.grandTotal.compensated || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="kpi-unit">บาท</span>
            </div>
            <div className="kpi-pill-metric">
              <span>เฉลี่ย:</span>
              <b>{summaryLoading ? '...' : avgCompPerVisit.toLocaleString()} บ./ครั้ง</b>
            </div>
            <p className="kpi-hint">ยอดเงินที่กองทุนโอนเข้าบัญชี รพ.</p>
          </div>
        </div>

        {/* Card 3: Hospital Receivables (HOSxP Debit) */}
        <div className="invoice-kpi-card kpi-span-standard card-amber">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap">
              <Layers size={22} />
            </div>
          </div>
          <div>
            <span className="kpi-label">ลูกหนี้ HOSxP รวม</span>
            <div className="kpi-value-wrap">
              <span className="kpi-value">
                {summaryLoading ? '...' : (summaryData?.grandTotal.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="kpi-unit">บาท</span>
            </div>
            <p className="kpi-hint">ค่ารักษาพยาบาลตั้งเบิก (หักชำระเอง)</p>
          </div>
        </div>

        {/* Card 4: Sub-funds Receipt */}
        <div className="invoice-kpi-card kpi-span-standard card-purple">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap">
              <Wallet size={22} />
            </div>
          </div>
          <div>
            <span className="kpi-label">รายรับหมวดกองทุนย่อย</span>
            <div className="kpi-value-wrap">
              <span className="kpi-value font-purple">
                {summaryLoading ? '...' : (summaryData?.grandTotal.receipt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="kpi-unit">บาท</span>
            </div>
            <p className="kpi-hint">HC+AE+INST+DRUG+DMIS+ONTOP</p>
          </div>
        </div>

        {/* Card 5: Total Visits */}
        <div className="invoice-kpi-card kpi-span-standard card-blue">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap">
              <Activity size={22} />
            </div>
          </div>
          <div>
            <span className="kpi-label">ผู้รับบริการ ({department})</span>
            <div className="kpi-value-wrap">
              <span className="kpi-value">
                {summaryLoading ? '...' : (summaryData?.grandTotal.visit || 0).toLocaleString()}
              </span>
              <span className="kpi-unit">ครั้ง</span>
            </div>
            <p className="kpi-hint">นับจาก Statement ที่มีชดเชย</p>
          </div>
        </div>
      </div>

      {/* ── 4. Master Summary Table (Ledger Breakdown) ─────────────────── */}
      <div className="invoice-card invoice-table-card">
        <div className="invoice-card-header">
          <div>
            <h2 className="invoice-card-title">สรุปรายรับจาก Invoice แยกตามกลุ่มสิทธิ e-Claim ({department})</h2>
            <p className="invoice-card-desc">
              คลิกเลือกแถวของสิทธิใดเพื่อกรองตารางรายละเอียดคนไข้ด้านล่างทันที (พบ {activeSummaryItems.length} สิทธิที่มีข้อมูล)
            </p>
          </div>
          {selectedPttype && (
            <span className="invoice-active-filter-pill">
              กำลังแสดงสิทธิ: <b>{selectedPttype}</b>
            </span>
          )}
        </div>

        {summaryError && (
          <div className="invoice-alert-error">
            <AlertCircle size={20} />
            <span>{summaryError}</span>
          </div>
        )}

        <div className="invoice-table-wrapper">
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }} className="text-center">รหัส</th>
                <th style={{ textAlign: 'left' }}>สิทธิการรักษามาตรฐาน e-Claim</th>
                <th style={{ width: '110px' }} className="text-right">จำนวนคน</th>
                <th style={{ width: '150px' }} className="text-right">รายรับจากกองทุน</th>
                <th style={{ width: '150px' }} className="text-right">ชดเชยจริง</th>
                <th style={{ width: '150px' }} className="text-right col-down-header">ส่วนต่ำ (+กำไร)</th>
                <th style={{ width: '150px' }} className="text-right col-up-header">ส่วนสูง (-ขาดทุน)</th>
                <th style={{ width: '150px' }} className="text-right">ลูกหนี้ รพ.</th>
              </tr>
            </thead>
            <tbody>
              {summaryLoading ? (
                <tr>
                  <td colSpan={8} className="invoice-table-loading">
                    <RefreshCw size={26} className="animate-spin text-emerald-600" />
                    <span>กำลังประมวลผลข้อมูลสรุปรายรับจาก Invoice...</span>
                  </td>
                </tr>
              ) : !summaryData || activeSummaryItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="invoice-table-empty">
                    ไม่พบข้อมูล Statement ในช่วงเวลาที่เลือก
                  </td>
                </tr>
              ) : (
                activeSummaryItems.map((row) => {
                  const isSelected = selectedPttype === row.code
                  return (
                    <tr
                      key={row.code}
                      onClick={() => handlePttypeClick(row.code)}
                      className={`invoice-summary-row ${isSelected ? 'row-selected' : ''}`}
                      title="คลิกเพื่อกรองรายละเอียดผู้ป่วยตามสิทธินี้"
                    >
                      <td className="text-center">
                        <span className="invoice-pttype-code-badge">{row.code}</span>
                      </td>
                      <td className="text-left">
                        <span className="invoice-pttype-name">{row.name}</span>
                        {isSelected && (
                          <span className="invoice-selected-tag">
                            <Check size={12} />
                            <span>เลือกอยู่</span>
                          </span>
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-slate-700">
                        {row.visit > 0 ? row.visit.toLocaleString() : '–'}
                      </td>
                      <td className="text-right font-mono text-slate-700">
                        {row.receipt > 0 ? row.receipt.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono font-bold text-slate-900">
                        {row.compensated > 0 ? row.compensated.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono font-bold col-down-cell">
                        {row.down > 0 ? `+${row.down.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '–'}
                      </td>
                      <td className="text-right font-mono font-bold col-up-cell">
                        {row.up < 0 ? row.up.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}
                      </td>
                      <td className="text-right font-mono font-bold text-slate-800">
                        {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {summaryData && activeSummaryItems.length > 0 && (
              <tfoot>
                <tr className="invoice-table-total-row">
                  <td colSpan={2} className="text-left font-extrabold text-slate-900">
                    รวมทั้งหมด ({activeSummaryItems.length} สิทธิที่มีข้อมูล)
                  </td>
                  <td className="text-right font-mono font-extrabold text-blue-900">
                    {summaryData.grandTotal.visit.toLocaleString()}
                  </td>
                  <td className="text-right font-mono font-extrabold text-purple-900">
                    {summaryData.grandTotal.receipt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right font-mono font-extrabold text-emerald-900">
                    {summaryData.grandTotal.compensated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right font-mono font-extrabold text-emerald-900 bg-emerald-100/70">
                    +{summaryData.grandTotal.down.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right font-mono font-extrabold text-rose-900 bg-rose-100/70">
                    {summaryData.grandTotal.up.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right font-mono font-extrabold text-slate-900">
                    {summaryData.grandTotal.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── 5. Detail Patient Table ─────────────────────────── */}
      <div className="invoice-card invoice-table-card">
        <div className="invoice-detail-header-row">
          <div>
            <h2 className="invoice-card-title">
              รายละเอียดผู้ป่วย ({department}) • <span className="text-emerald-700">{activePttypeName}</span>
            </h2>
            <p className="invoice-card-desc">
              แสดงรายการชดเชยระดับ Visit / Invoice พร้อมกองทุนย่อย 7 หมวดและผลต่างลูกหนี้ (พบ {detailData?.totalCount.toLocaleString() || 0} รายการ)
            </p>
          </div>

          <div className="invoice-detail-search-bar">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="ค้นหา HN, VN, AN, ชื่อผู้ป่วย, REP, Bill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="invoice-search-input"
            />
            {search && (
              <button onClick={() => setSearch('')} className="invoice-clear-search" title="ล้างคำค้นหา">
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {detailError && (
          <div className="invoice-alert-error">
            <AlertCircle size={20} />
            <span>{detailError}</span>
          </div>
        )}

        <div className="invoice-table-wrapper">
          <table className="invoice-table invoice-detail-table">
            <thead>
              {/* Grouped Header row */}
              <tr className="invoice-header-grouped">
                <th colSpan={8} className="group-left">ข้อมูลผู้ป่วยและการรับบริการ</th>
                <th colSpan={5} className="group-finance">เปรียบเทียบการเงิน & ลูกหนี้ HOSxP</th>
                <th colSpan={7} className="group-subfunds">หมวดกองทุนย่อย (Sub-funds 7 หมวด)</th>
                <th colSpan={2} className="group-diff">ผลต่าง (กระทบยอด)</th>
                <th colSpan={3} className="group-ref">เลขอ้างอิง Statement กองทุน</th>
              </tr>
              <tr>
                <th style={{ width: '50px' }} className="sub-th col-sticky-1 text-center">No.</th>
                <th style={{ width: '65px' }} className="sub-th col-sticky-2 text-center">รหัส</th>
                <th style={{ width: '115px' }} className="sub-th col-sticky-3">{department === 'OP' ? 'VN' : 'AN'}</th>
                <th style={{ width: '135px' }} className="sub-th">เลขบัตร ปชช.</th>
                <th style={{ width: '80px' }} className="sub-th">HN</th>
                <th style={{ width: '170px', textAlign: 'left' }} className="sub-th">ชื่อ-สกุล</th>
                <th style={{ width: '95px' }} className="sub-th">{department === 'OP' ? 'วันที่รับบริการ' : 'วัน Admit'}</th>
                <th style={{ width: '85px' }} className="sub-th cell-border-group-end">{department === 'OP' ? 'เวลา' : 'วัน Dch'}</th>
                <th style={{ width: '105px' }} className="sub-th text-right font-bold text-slate-900">ชดเชยจริง</th>
                <th style={{ width: '100px' }} className="sub-th text-right">กองทุนย่อย</th>
                <th style={{ width: '100px' }} className="sub-th text-right">ค่ารักษา HOS</th>
                <th style={{ width: '80px' }} className="sub-th text-right">ชำระเอง</th>
                <th style={{ width: '100px' }} className="sub-th text-right cell-border-group-end font-bold text-slate-900">ลูกหนี้ รพ.</th>
                <th style={{ width: '80px' }} className="sub-th text-right">HC</th>
                <th style={{ width: '80px' }} className="sub-th text-right">AE</th>
                <th style={{ width: '80px' }} className="sub-th text-right">INST</th>
                <th style={{ width: '80px' }} className="sub-th text-right">OP</th>
                <th style={{ width: '80px' }} className="sub-th text-right">IP</th>
                <th style={{ width: '80px' }} className="sub-th text-right">Drug</th>
                <th style={{ width: '80px' }} className="sub-th text-right cell-border-group-end">DMIS</th>
                <th style={{ width: '95px' }} className="sub-th text-right col-down-header">ส่วนต่ำ (+กำไร)</th>
                <th style={{ width: '95px' }} className="sub-th text-right col-up-header cell-border-group-end">ส่วนสูง (-ขาดทุน)</th>
                <th style={{ width: '105px' }} className="sub-th text-center">เลข REP</th>
                <th style={{ width: '100px' }} className="sub-th text-center">เลข Bill</th>
                <th style={{ width: '95px' }} className="sub-th text-center">วันที่ Bill</th>
              </tr>
            </thead>
            <tbody>
              {detailLoading ? (
                <tr>
                  <td colSpan={25} className="invoice-table-loading">
                    <RefreshCw size={26} className="animate-spin text-emerald-600" />
                    <span>กำลังโหลดรายการผู้ป่วยและยอดชดเชยจากฐานข้อมูล...</span>
                  </td>
                </tr>
              ) : !detailData || detailData.items.length === 0 ? (
                <tr>
                  <td colSpan={25} className="invoice-table-empty">
                    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontWeight: 600, color: '#475569' }}>ไม่พบรายการผู้ป่วยตามเงื่อนไขที่เลือก</p>
                      {dateType === 'bill_date' && (
                        <p style={{ fontSize: '13px', color: '#92400e', background: '#fef3c7', padding: '8px 16px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                          💡 <b>หมายเหตุ:</b> ปัจจุบันเลือกกรองตาม <b>วันที่ออก Invoice (Bill Date)</b> หากต้องการค้นหาผู้ป่วยที่มารับบริการในเดือนนี้ที่ สปสช. ยังไม่ออกบิล Statement สามารถสลับตัวเลือกด้านบนเป็น <b>วันที่รับบริการ</b>
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                detailData.items.map((row) => {
                  return (
                    <tr key={`${row.vnOrAn}-${row.no}`} className="invoice-detail-row">
                      <td className="col-sticky-1 text-center font-mono text-slate-500">{row.no}</td>
                      <td className="col-sticky-2 text-center">
                        {row.pttype_eclaim_id ? (
                          <span
                            className="invoice-pttype-code-badge"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePttypeClick(row.pttype_eclaim_id!)
                            }}
                            title={
                              pttypeNameMap[row.pttype_eclaim_id]
                                ? `${row.pttype_eclaim_id} - ${pttypeNameMap[row.pttype_eclaim_id]} (คลิกเพื่อกรอง)`
                                : `รหัส: ${row.pttype_eclaim_id} (คลิกเพื่อกรอง)`
                            }
                          >
                            {row.pttype_eclaim_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">–</span>
                        )}
                      </td>
                      <td className="col-sticky-3 font-mono font-bold text-slate-800">{row.vnOrAn}</td>
                      <td className="font-mono text-slate-600 font-semibold">{row.cid || '–'}</td>
                      <td className="font-mono text-slate-600">{row.hn}</td>
                      <td className="text-left font-medium text-slate-900">{row.ptname}</td>
                      <td className="text-center font-mono text-slate-600">{row.vstdate || row.admdate || '–'}</td>
                      <td className="text-center font-mono text-slate-500 cell-border-group-end">{row.vsttime || row.dchdate || '–'}</td>
                      <td className="text-right font-mono font-bold text-slate-900">
                        {row.compensated > 0 ? row.compensated.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono text-slate-700">
                        {row.fund_money > 0 ? row.fund_money.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono text-slate-700">
                        {row.income_hosxp > 0 ? row.income_hosxp.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono text-slate-500">
                        {row.rcpt_money > 0 ? row.rcpt_money.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono font-bold text-slate-900 cell-border-group-end">
                        {row.debit_hosxp > 0 ? row.debit_hosxp.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="text-right font-mono text-slate-600">{row.hc > 0 ? row.hc.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono text-slate-600">{row.ae > 0 ? row.ae.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono text-slate-600">{row.inst > 0 ? row.inst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono text-slate-600">{row.op > 0 ? row.op.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono text-slate-600">{row.ip > 0 ? row.ip.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono text-slate-600">{row.drug > 0 ? row.drug.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono text-slate-600 cell-border-group-end">{row.dmis > 0 ? row.dmis.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}</td>
                      <td className="text-right font-mono font-bold col-down-cell">
                        {row.down > 0 ? `+${row.down.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '–'}
                      </td>
                      <td className="text-right font-mono font-bold col-up-cell cell-border-group-end">
                        {row.up < 0 ? row.up.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '–'}
                      </td>
                      <td className="text-center font-mono text-slate-700 text-xs">{row.rep || '–'}</td>
                      <td className="text-center font-mono text-slate-700 text-xs">{row.bill || '–'}</td>
                      <td className="text-center font-mono text-slate-500 text-xs">{row.billdate || '–'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Pagination Bar */}
        {detailData && detailData.totalPages > 1 && (
          <div className="invoice-pagination-bar">
            <div className="invoice-pagination-info">
              แสดงหน้า <b>{detailData.page}</b> จาก <b>{detailData.totalPages}</b> (ทั้งหมด {detailData.totalCount.toLocaleString()} รายการ)
            </div>

            <div className="invoice-pagination-controls">
              <div className="invoice-page-size-selector">
                <label>แสดงหน้าละ:</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="invoice-select"
                >
                  <option value={25}>25 รายการ</option>
                  <option value={50}>50 รายการ</option>
                  <option value={100}>100 รายการ</option>
                </select>
              </div>

              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || detailLoading}
                className="invoice-page-btn"
                title="หน้าแรก"
              >
                <ChevronsLeft size={16} />
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || detailLoading}
                className="invoice-page-btn"
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
                <span>ก่อนหน้า</span>
              </button>

              <span className="invoice-page-current">
                {page} / {detailData.totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(detailData.totalPages, p + 1))}
                disabled={page >= detailData.totalPages || detailLoading}
                className="invoice-page-btn"
                title="หน้าถัดไป"
              >
                <span>ถัดไป</span>
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => setPage(detailData.totalPages)}
                disabled={page >= detailData.totalPages || detailLoading}
                className="invoice-page-btn"
                title="หน้าสุดท้าย"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
