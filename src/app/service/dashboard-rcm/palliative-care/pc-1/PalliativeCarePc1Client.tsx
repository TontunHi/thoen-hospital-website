'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  PalliativeCarePc1Item,
  PalliativeCarePc1Summary,
} from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

const THAI_MONTHS = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
]

const YEAR_OPTIONS = [2572, 2571, 2570, 2569, 2568, 2567, 2566, 2565]

export interface PalliativeCarePc1ClientProps {
  initialData?: any | null
  initialRange?: { startDate: string; endDate: string }
}

export default function PalliativeCarePc1Client({
  initialData,
  initialRange,
}: PalliativeCarePc1ClientProps = {}) {
  const today = useMemo(() => new Date(), [])
  const curCalYear = today.getFullYear()
  const curBeYear = curCalYear + 543
  const curMonth = today.getMonth() + 1
  const defaultFiscalBeYear = curMonth >= 10 ? curBeYear + 1 : curBeYear

  // Date Mode: 'custom' | 'monthly' | 'fiscal'
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('monthly')

  // Selected Month & Year (for monthly mode)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)

  // Selected Fiscal Year (for fiscal mode)
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)

  // Actual Date Range state
  const initialMonthlyRange = useMemo(() => {
    const padM = String(curMonth).padStart(2, '0')
    const lastDay = new Date(curCalYear, curMonth, 0).getDate()
    return {
      start: `${curCalYear}-${padM}-01`,
      end: `${curCalYear}-${padM}-${String(lastDay).padStart(2, '0')}`,
    }
  }, [curCalYear, curMonth])

  const [ds1, setDs1] = useState<string>(initialRange?.startDate || initialMonthlyRange.start)
  const [ds2, setDs2] = useState<string>(initialRange?.endDate || initialMonthlyRange.end)

  // Filter states
  const [paidStatus, setPaidStatus] = useState<'ALL' | 'PAID' | 'UNPAID' | 'INVOICE'>('ALL')
  const [search, setSearch] = useState<string>('')
  const [baseSummary, setBaseSummary] = useState<PalliativeCarePc1Summary | null>(initialData?.summary || null)

  // Data states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PalliativeCarePc1Item[]>(initialData?.items || [])
  const [summary, setSummary] = useState<PalliativeCarePc1Summary>(
    initialData?.summary || {
      totalVisits: 0,
      totalPatients: 0,
      paidCount: 0,
      unpaidCount: 0,
      totalCompensated: 0,
      totalInvoiceCompensated: 0,
    }
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Selected row for detail modal
  const [selectedItem, setSelectedItem] = useState<PalliativeCarePc1Item | null>(null)

  // Reset baseSummary when date range changes
  useEffect(() => {
    setBaseSummary(null)
  }, [ds1, ds2])

  // Handle Date Mode Changes
  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const padM = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${padM}-01`)
      setDs2(`${ceYear}-${padM}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceFiscalYear = selectedFiscalYear - 543
      setDs1(`${ceFiscalYear - 1}-10-01`)
      setDs2(`${ceFiscalYear}-09-30`)
    }
  }

  // Handle Month or Year change in Monthly mode
  const handleMonthYearChange = (newMonth: number, newBeYear: number) => {
    setSelectedMonth(newMonth)
    setSelectedBeYear(newBeYear)
    const ceYear = newBeYear - 543
    const padM = String(newMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, newMonth, 0).getDate()
    setDs1(`${ceYear}-${padM}-01`)
    setDs2(`${ceYear}-${padM}-${String(lastDay).padStart(2, '0')}`)
  }

  // Handle Fiscal Year change in Fiscal mode
  const handleFiscalYearChange = (newFiscalYear: number) => {
    setSelectedFiscalYear(newFiscalYear)
    const ceFiscalYear = newFiscalYear - 543
    setDs1(`${ceFiscalYear - 1}-10-01`)
    setDs2(`${ceFiscalYear}-09-30`)
  }

  // Handle Card Filter click
  const handleCardClick = (target: 'ALL' | 'PAID' | 'UNPAID' | 'INVOICE') => {
    setCurrentPage(1)
    if (target === 'ALL') {
      setPaidStatus('ALL')
    } else {
      setPaidStatus((prev) => (prev === target ? 'ALL' : target))
    }
  }

  // Fetch report data
  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
      })
      if (paidStatus !== 'ALL') {
        q.set('paidStatus', paidStatus)
      }
      if (search.trim()) {
        q.set('search', search.trim())
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/pc-1?${q.toString()}`, {
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถโหลดข้อมูล Palliative Care PC.1 ได้')
      }

      setItems(data.items || [])
      const newSummary = data.summary || {
        totalVisits: 0,
        totalPatients: 0,
        paidCount: 0,
        unpaidCount: 0,
        totalCompensated: 0,
        totalInvoiceCompensated: 0,
      }
      setSummary(newSummary)
      if (paidStatus === 'ALL' && !search.trim()) {
        setBaseSummary(newSummary)
      }
      setCurrentPage(1)
    } catch (err: unknown) {
      const errorObj = err as Error
      if (errorObj.name !== 'AbortError') {
        setError(errorObj.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [ds1, ds2, paidStatus, search])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData, initialData])

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize])

  const totalPages = Math.ceil(items.length / pageSize) || 1

  // Modern Excel (.xlsx) Export
  const handleExportCsv = async () => {
    if (!items || items.length === 0) return

    const headers = [
      'ลำดับ',
      'VN',
      'CID',
      'HN',
      'ชื่อ-สกุล',
      'อายุ',
      'สัญชาติ',
      'วันที่รับบริการ',
      'เวลา',
      'ClaimCode',
      'สิทธิการรักษา',
      'แผนก/จุดบริการ',
      'คลินิก',
      'PDX',
      'DX0',
      'DX1',
      'DX2',
      'DX3',
      'DX4',
      'DX5',
      'OP0',
      'OP1',
      'OP2',
      'OP3',
      'OP4',
      'OP5',
      'รายการ',
      'เลข Rep',
      'เงินชดเชย',
      'TransactionType',
      'Invoice',
      'ชดเชย Invoice',
      'Resource',
      'Subfund',
      'หมายเหตุ',
      'ProjectCode',
    ]

    const rows = items.map((r) => [
      r.no,
      r.vn,
      r.cid,
      r.hn,
      r.ptname,
      r.age,
      r.nation,
      r.vstdate,
      r.vsttime,
      r.authencode,
      r.pttypename,
      r.department,
      r.clinic,
      r.pdx || '',
      r.dx0 || '',
      r.dx1 || '',
      r.dx2 || '',
      r.dx3 || '',
      r.dx4 || '',
      r.dx5 || '',
      r.op0 || '',
      r.op1 || '',
      r.op2 || '',
      r.op3 || '',
      r.op4 || '',
      r.op5 || '',
      r.listname,
      r.rep || '',
      r.compensated,
      r.transaction_type || '',
      r.invoice || '',
      r.invoice_compensated,
      r.resource || '',
      r.subfund || '',
      r.remark || '',
      r.projectcode || '',
    ])

    await exportRcmExcel({
      filename: `Palliative_Care_PC1_EndOfLife_${ds1}_to_${ds2}.xlsx`,
      title: 'บริการ Palliative Care End Of Life (PC.1)',
      subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
      headers,
      rows,
    })
  }

  return (
    <div className="pc1-container">
      {/* Header */}
      <div className="pc1-header">
        <div>
          <div className="pc1-title-wrap">
            <h1 className="pc1-title">บริการ Palliative Care End Of Life</h1>
            <span className="pc1-badge">PC.1</span>
          </div>
          <p className="pc1-desc">
            ระบบตรวจสอบการให้บริการผู้ป่วย Palliative Care ระยะท้าย (End Of Life) ตามรหัสบริการ สปสช. ADP Code 30001
          </p>
        </div>

        <div className="pc1-header-actions">
          <button
            type="button"
            className="pc1-btn-secondary"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>

          <button
            type="button"
            className="pc1-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            ส่งออก Excel
          </button>
        </div>
      </div>

      {/* Metric Bar */}
      <div className="pc1-metric-bar" role="region" aria-label="สรุปสถิติและตัวกรองด่วนผ่านการ์ด">
        <button
          type="button"
          className={`pc1-metric-card pc1-card-total pc1-metric-card-btn ${paidStatus === 'ALL' ? 'is-active is-active-total' : ''}`}
          onClick={() => handleCardClick('ALL')}
          aria-pressed={paidStatus === 'ALL'}
          title={paidStatus === 'ALL' ? 'แสดงผู้ป่วยทั้งหมด' : 'คลิกเพื่อดูผู้ป่วยทั้งหมด'}
        >
          <div className="pc1-metric-label">ผู้ป่วยทั้งหมด</div>
          <div className="pc1-metric-val">
            {(baseSummary || summary).totalPatients.toLocaleString()}
            <span className="pc1-metric-unit">คน</span>
          </div>
        </button>

        <button
          type="button"
          className={`pc1-metric-card pc1-card-visits pc1-metric-card-btn ${paidStatus === 'ALL' ? 'is-active is-active-visits' : ''}`}
          onClick={() => handleCardClick('ALL')}
          aria-pressed={paidStatus === 'ALL'}
          title={paidStatus === 'ALL' ? 'แสดงการรับบริการทั้งหมด' : 'คลิกเพื่อดูการรับบริการทั้งหมด'}
        >
          <div className="pc1-metric-label">รับบริการทั้งหมด</div>
          <div className="pc1-metric-val">
            {(baseSummary || summary).totalVisits.toLocaleString()}
            <span className="pc1-metric-unit">ครั้ง</span>
          </div>
        </button>

        <button
          type="button"
          className={`pc1-metric-card pc1-card-paid pc1-metric-card-btn ${paidStatus === 'PAID' ? 'is-active is-active-paid' : ''}`}
          onClick={() => handleCardClick('PAID')}
          aria-pressed={paidStatus === 'PAID'}
          title={paidStatus === 'PAID' ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะรายการที่ชดเชยแล้ว'}
        >
          <div className="pc1-metric-label">ชดเชยแล้ว</div>
          <div className="pc1-metric-val" style={{ color: '#059669' }}>
            {(baseSummary || summary).paidCount.toLocaleString()}
            <span className="pc1-metric-unit">ครั้ง</span>
          </div>
        </button>

        <button
          type="button"
          className={`pc1-metric-card pc1-card-comp pc1-metric-card-btn ${paidStatus === 'PAID' ? 'is-active is-active-comp' : ''}`}
          onClick={() => handleCardClick('PAID')}
          aria-pressed={paidStatus === 'PAID'}
          title={paidStatus === 'PAID' ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะรายการที่มีเงินชดเชย'}
        >
          <div className="pc1-metric-label">ยอดชดเชยรวม (Rep)</div>
          <div className="pc1-metric-val" style={{ color: '#047857' }}>
            {(baseSummary || summary).totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            <span className="pc1-metric-unit">฿</span>
          </div>
        </button>

        <button
          type="button"
          className={`pc1-metric-card pc1-card-unpaid pc1-metric-card-btn ${paidStatus === 'UNPAID' ? 'is-active is-active-unpaid' : ''}`}
          onClick={() => handleCardClick('UNPAID')}
          aria-pressed={paidStatus === 'UNPAID'}
          title={paidStatus === 'UNPAID' ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะรายการที่ยังไม่ชดเชย'}
        >
          <div className="pc1-metric-label">ยังไม่ชดเชย</div>
          <div className="pc1-metric-val" style={{ color: '#d97706' }}>
            {(baseSummary || summary).unpaidCount.toLocaleString()}
            <span className="pc1-metric-unit">ครั้ง</span>
          </div>
        </button>

        <button
          type="button"
          className={`pc1-metric-card pc1-card-inv pc1-metric-card-btn ${paidStatus === 'INVOICE' ? 'is-active is-active-inv' : ''}`}
          onClick={() => handleCardClick('INVOICE')}
          aria-pressed={paidStatus === 'INVOICE'}
          title={paidStatus === 'INVOICE' ? 'คลิกเพื่อยกเลิกการกรอง' : 'คลิกเพื่อกรองเฉพาะรายการชดเชย Invoice'}
        >
          <div className="pc1-metric-label">ชดเชย Invoice</div>
          <div className="pc1-metric-val" style={{ color: '#4f46e5' }}>
            {(baseSummary || summary).totalInvoiceCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            <span className="pc1-metric-unit">฿</span>
          </div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="pc1-toolbar">
        {/* Date Mode Row */}
        <div className="pc1-toolbar-row">
          <div className="pc1-segmented-track">
            <button
              type="button"
              className={`pc1-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง (วันถึงวัน)
            </button>
            <button
              type="button"
              className={`pc1-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={`pc1-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              รายปีงบประมาณ
            </button>
          </div>

          {dateMode === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ThaiDatePicker
                value={ds1}
                onChange={setDs1}
                maxDate={ds2}
                aria-label="ตั้งแต่วันที่"
              />
              <span style={{ color: 'var(--pc1-muted)', fontSize: '0.85rem' }}>ถึง</span>
              <ThaiDatePicker
                value={ds2}
                onChange={setDs2}
                minDate={ds1}
                aria-label="ถึงวันที่"
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="pc1-select"
                value={selectedMonth}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedBeYear)}
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                className="pc1-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dateMode === 'fiscal' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="pc1-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filters Row: เงินชดเชย, ช่องค้นหา */}
        <div className="pc1-toolbar-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pc1-muted)' }}>
              การชดเชย:
            </span>
            <select
              className="pc1-select"
              value={paidStatus}
              onChange={(e) => {
                setPaidStatus(e.target.value as 'ALL' | 'PAID' | 'UNPAID' | 'INVOICE')
                setCurrentPage(1)
              }}
            >
              <option value="ALL">การชดเชย: ทั้งหมด</option>
              <option value="PAID">ชดเชยแล้ว</option>
              <option value="UNPAID">ยังไม่ได้รับชดเชย</option>
              <option value="INVOICE">ชดเชย Invoice</option>
            </select>
          </div>

          <input
            type="search"
            className="pc1-search-input"
            placeholder="ค้นหา HN, ชื่อผู้ป่วย, เลข CID 13 หลัก, VN, รหัสโรค หรือรายการ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pc1-muted)' }}>หน้าละ:</span>
            <select
              className="pc1-select"
              style={{ minHeight: 38, padding: '0 0.5rem', fontSize: '0.8125rem' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="pc1-legend">
        <span style={{ fontWeight: 700, color: 'var(--pc1-ink)' }}>แถบสี:</span>
        <span className="pc1-legend-pill">
          <span className="pc1-dot-paid" />
          <span>แถบสีเขียว = ได้รับเงินชดเชยแล้ว</span>
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: 8,
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="pc1-table-card">
        <div className="pc1-table-scroll">
          <table className="pc1-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 45, textAlign: 'center' }}>ลำดับ</th>
                <th rowSpan={2}>VN</th>
                <th rowSpan={2}>HN</th>
                <th rowSpan={2}>เลขบัตรประชาชน (CID)</th>
                <th rowSpan={2} style={{ whiteSpace: 'nowrap' }}>ชื่อ-สกุล</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>อายุ</th>
                <th rowSpan={2}>สัญชาติ</th>
                <th rowSpan={2}>วันที่รับบริการ</th>
                <th rowSpan={2}>เวลา</th>
                <th rowSpan={2}>ClaimCode</th>
                <th rowSpan={2}>สิทธิการรักษา</th>
                <th rowSpan={2}>แผนก / จุดบริการ</th>
                <th rowSpan={2}>คลินิก</th>
                {/* Merged Header 1: การวินิจฉัย */}
                <th colSpan={7} className="pc1-th-group-dx">การวินิจฉัย</th>
                {/* Merged Header 2: หัตถการ */}
                <th colSpan={6} className="pc1-th-group-op">หัตถการ</th>
                <th rowSpan={2}>รายการ</th>
                <th rowSpan={2}>เลข Rep</th>
                <th rowSpan={2}>เงินชดเชย</th>
                <th rowSpan={2}>TransactionType</th>
                <th rowSpan={2}>Invoice</th>
                <th rowSpan={2}>ชดเชย Invoice</th>
                <th rowSpan={2}>Subfund</th>
                <th rowSpan={2}>หมายเหตุ</th>
              </tr>
              <tr>
                <th className="pc1-th-group-dx">PDX</th>
                <th className="pc1-th-group-dx">DX0</th>
                <th className="pc1-th-group-dx">DX1</th>
                <th className="pc1-th-group-dx">DX2</th>
                <th className="pc1-th-group-dx">DX3</th>
                <th className="pc1-th-group-dx">DX4</th>
                <th className="pc1-th-group-dx">DX5</th>
                <th className="pc1-th-group-op">OP0</th>
                <th className="pc1-th-group-op">OP1</th>
                <th className="pc1-th-group-op">OP2</th>
                <th className="pc1-th-group-op">OP3</th>
                <th className="pc1-th-group-op">OP4</th>
                <th className="pc1-th-group-op">OP5</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={34} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--pc1-muted)' }}>
                    กำลังโหลดข้อมูล Palliative Care PC.1 จากระบบ...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={34} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--pc1-muted)' }}>
                    ไม่พบข้อมูลผู้ป่วย Palliative Care End Of Life ในช่วงเวลาหรือเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr
                    key={item.vn}
                    className={`pc1-table-row ${item.compensated > 0 ? 'pc1-row-paid' : ''}`}
                    onClick={() => setSelectedItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedItem(item)
                      }
                    }}
                    title="คลิกเพื่อดูรายละเอียดผู้ป่วย"
                  >
                    <td className="pc1-num" style={{ textAlign: 'center', color: 'var(--pc1-muted)' }}>
                      {item.no}
                    </td>
                    <td className="pc1-num">{item.vn}</td>
                    <td className="pc1-num">{item.hn}</td>
                    {/* CID 13 หลักเต็ม ไม่ mask */}
                    <td className="pc1-num">{item.cid || '-'}</td>
                    {/* ชื่อ-สกุล แนวนอนแถวเดียว ไม่ซ้อนกัน */}
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {item.ptname}
                    </td>
                    <td className="pc1-num" style={{ textAlign: 'center' }}>{item.age}</td>
                    <td>{item.nation || '-'}</td>
                    <td className="pc1-num">{formatThaiDate(item.vstdate)}</td>
                    <td className="pc1-num">{item.vsttime}</td>
                    <td className="pc1-num">{item.authencode || '-'}</td>
                    <td>{item.pttypename || '-'}</td>
                    <td>{item.department || '-'}</td>
                    <td>{item.clinic || '-'}</td>

                    {/* PDX, DX0 - DX5 */}
                    <td className="pc1-num" style={{ fontWeight: 600, color: '#1d4ed8' }}>{item.pdx || '-'}</td>
                    <td className="pc1-num">{item.dx0 || '-'}</td>
                    <td className="pc1-num">{item.dx1 || '-'}</td>
                    <td className="pc1-num">{item.dx2 || '-'}</td>
                    <td className="pc1-num">{item.dx3 || '-'}</td>
                    <td className="pc1-num">{item.dx4 || '-'}</td>
                    <td className="pc1-num">{item.dx5 || '-'}</td>

                    {/* OP0 - OP5 */}
                    <td className="pc1-num">{item.op0 || '-'}</td>
                    <td className="pc1-num">{item.op1 || '-'}</td>
                    <td className="pc1-num">{item.op2 || '-'}</td>
                    <td className="pc1-num">{item.op3 || '-'}</td>
                    <td className="pc1-num">{item.op4 || '-'}</td>
                    <td className="pc1-num">{item.op5 || '-'}</td>

                    <td>{item.listname}</td>
                    <td className="pc1-num">{item.rep || '-'}</td>
                    <td className="pc1-num" style={{ fontWeight: 600, color: item.compensated > 0 ? '#059669' : 'inherit' }}>
                      {item.compensated > 0 ? item.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td>{item.transaction_type || '-'}</td>
                    <td className="pc1-num">{item.invoice || '-'}</td>
                    <td className="pc1-num">
                      {item.invoice_compensated > 0 ? item.invoice_compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td>{item.subfund || '-'}</td>
                    <td style={{ color: 'var(--pc1-muted)', fontSize: '0.8rem' }}>{item.remark || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="pc1-pagination">
          <div>
            แสดง {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง{' '}
            {Math.min(currentPage * pageSize, items.length)} จากทั้งหมด{' '}
            <strong style={{ color: 'var(--pc1-ink)' }}>{items.length.toLocaleString()}</strong> รายการ
          </div>

          <div className="pc1-page-btns">
            <button
              type="button"
              className="pc1-page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
            >
              « หน้าแรก
            </button>
            <button
              type="button"
              className="pc1-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              ‹ ก่อนหน้า
            </button>
            <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
              หน้า {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="pc1-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              ถัดไป ›
            </button>
            <button
              type="button"
              className="pc1-page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              หน้าสุดท้าย »
            </button>
          </div>
        </div>
      </div>

      {/* Patient Detail Modal */}
      {selectedItem && (
        <div className="pc1-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="pc1-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pc1-modal-header">
              <h2 className="pc1-modal-title">
                รายละเอียดผู้ป่วย: {selectedItem.ptname} (HN: {selectedItem.hn})
              </h2>
              <button
                type="button"
                className="pc1-modal-close"
                onClick={() => setSelectedItem(null)}
              >
                ✕
              </button>
            </div>

            <div className="pc1-modal-body">
              <div className="pc1-modal-grid">
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">เลขบัตรประชาชน (CID)</span>
                  <span className="pc1-modal-field-val pc1-num">{selectedItem.cid || '-'}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">VN</span>
                  <span className="pc1-modal-field-val pc1-num">{selectedItem.vn}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">วันที่และเวลารับบริการ</span>
                  <span className="pc1-modal-field-val">{formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime ? `(${selectedItem.vsttime} น.)` : ''}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">อายุ / สัญชาติ</span>
                  <span className="pc1-modal-field-val">{selectedItem.age} ปี / {selectedItem.nation}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">ClaimCode</span>
                  <span className="pc1-modal-field-val pc1-num">{selectedItem.authencode || '-'}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">สิทธิการรักษา</span>
                  <span className="pc1-modal-field-val">{selectedItem.pttypename}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">แผนก / จุดบริการ</span>
                  <span className="pc1-modal-field-val">{selectedItem.department}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">คลินิก</span>
                  <span className="pc1-modal-field-val">{selectedItem.clinic}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">รายการบริการ</span>
                  <span className="pc1-modal-field-val" style={{ color: '#059669' }}>{selectedItem.listname}</span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">เลข Rep / เงินชดเชย</span>
                  <span className="pc1-modal-field-val">
                    {selectedItem.rep || '-'} / {selectedItem.compensated > 0 ? `${selectedItem.compensated.toLocaleString()} ฿` : 'ยังไม่ชดเชย'}
                  </span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">Invoice / ชดเชย Invoice</span>
                  <span className="pc1-modal-field-val">
                    {selectedItem.invoice || '-'} / {selectedItem.invoice_compensated > 0 ? `${selectedItem.invoice_compensated.toLocaleString()} ฿` : '0 ฿'}
                  </span>
                </div>
                <div className="pc1-modal-field">
                  <span className="pc1-modal-field-label">Subfund / Resource</span>
                  <span className="pc1-modal-field-val">{selectedItem.subfund || '-'} / {selectedItem.resource || '-'}</span>
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--pc1-border)', paddingTop: '0.75rem' }}>
                <span className="pc1-modal-field-label">รหัสวินิจฉัย (PDX, DX0-5):</span>
                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[selectedItem.pdx, selectedItem.dx0, selectedItem.dx1, selectedItem.dx2, selectedItem.dx3, selectedItem.dx4, selectedItem.dx5]
                    .filter(Boolean)
                    .map((dx, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        {dx}
                      </span>
                    ))}
                </div>
              </div>

              {selectedItem.remark && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span className="pc1-modal-field-label">หมายเหตุ:</span>
                  <div style={{ marginTop: '0.2rem', fontSize: '0.875rem', color: 'var(--pc1-muted)' }}>
                    {selectedItem.remark}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
