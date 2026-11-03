'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { PalliativeCareItem, PalliativeCareSummary } from '@/lib/clinical/rcmDashboardService'
import { VnDetailModal } from '../components/VnDetailModal'
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

export default function PalliativeCareClient() {
  const today = useMemo(() => new Date(), [])
  const curCalYear = today.getFullYear()
  const curBeYear = curCalYear + 543
  const curMonth = today.getMonth() + 1
  const defaultFiscalBeYear = curMonth >= 10 ? curBeYear + 1 : curBeYear

  // Date Mode: 'custom' (กำหนดเอง) | 'monthly' (รายเดือน) | 'fiscal' (รายปีงบประมาณ)
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

  const [ds1, setDs1] = useState<string>(initialMonthlyRange.start)
  const [ds2, setDs2] = useState<string>(initialMonthlyRange.end)

  // Filter states
  const [ucOnly, setUcOnly] = useState<boolean>(true)
  const [filterType, setFilterType] = useState<'ALL' | 'Chronic' | 'Opioid' | 'Death'>('ALL')
  const [deathStatus, setDeathStatus] = useState<'ALL' | 'Y' | 'N'>('ALL')
  const [compensatedFilter, setCompensatedFilter] = useState<string>('ALL')
  const [availableCompensations, setAvailableCompensations] = useState<number[]>([
    750, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
  ])
  const [search, setSearch] = useState<string>('')

  // Data states
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PalliativeCareItem[]>([])
  const [summary, setSummary] = useState<PalliativeCareSummary>({
    totalVisits: 0,
    totalPatients: 0,
    advanceCarePlanCount: 0,
    opioidCount: 0,
    hasZ515Count: 0,
    missingZ515Count: 0,
    paidCount: 0,
    totalCompensated: 0,
    deceasedCount: 0,
  })

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Selected row for detail modal
  const [selectedItem, setSelectedItem] = useState<PalliativeCareItem | null>(null)
  const [selectedVn, setSelectedVn] = useState<string | null>(null)

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

  // Fetch report data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({
        ds1,
        ds2,
        ucOnly: String(ucOnly),
        filterType,
        deathStatus,
      })
      if (compensatedFilter && compensatedFilter !== 'ALL') {
        q.set('compensated', compensatedFilter)
      }
      if (search.trim()) {
        q.set('search', search.trim())
      }

      const res = await fetch(`/api/service/dashboard-rcm/palliative-care/pc-3?${q.toString()}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถโหลดข้อมูล Palliative Care ได้')
      }

      setItems(data.items || [])
      if (Array.isArray(data.availableCompensations) && data.availableCompensations.length > 0) {
        setAvailableCompensations(data.availableCompensations)
      }
      setSummary(
        data.summary || {
          totalVisits: 0,
          totalPatients: 0,
          advanceCarePlanCount: 0,
          opioidCount: 0,
          hasZ515Count: 0,
          missingZ515Count: 0,
          paidCount: 0,
          totalCompensated: 0,
          deceasedCount: 0,
        }
      )
      setCurrentPage(1)
    } catch (err: unknown) {
      const errorObj = err as Error
      setError(errorObj.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [ds1, ds2, ucOnly, filterType, deathStatus, compensatedFilter, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize])

  const totalPages = Math.ceil(items.length / pageSize) || 1

  // Export to CSV with UTF-8 BOM for Thai Excel support (No Masking)
  const handleExportCsv = () => {
    if (!items || items.length === 0) return

    const headers = [
      'ลำดับ',
      'VN',
      'HN',
      'เลขประจำตัวประชาชน (CID)',
      'ชื่อ-สกุล',
      'วันที่รับบริการ',
      'Authen Code',
      'รหัสสิทธิ',
      'กลุ่มสิทธิ',
      'ชื่อสิทธิการรักษา',
      'สถานะตาย',
      'วันที่เสียชีวิต',
      'จุดบริการ/ห้องตรวจ',
      'สาขา/แผนก',
      'การวินิจฉัย (Diag)',
      'หัตถการ (Oper)',
      'Z515',
      'Dx',
      'Z718',
      'Advance Care Plan (Dx & Z718)',
      'Cancer',
      'Drug',
      'Opioid (Cancer & Drug)',
      'จ่ายแล้ว',
      'เงินชดเชย',
      'Rep/Invoice',
      'E-Claim No',
      'วันที่ส่งเคลม',
      'สถานะ e-Claim',
      'ไฟล์ส่งเคลม',
      'ErrorName',
    ]

    const rows = items.map((r) => [
      r.no,
      `="${r.vn}"`,
      `="${r.hn}"`,
      `="${r.cid}"`,
      `"${r.ptname}"`,
      `"${r.vstdate}"`,
      `"${r.authencode}"`,
      `"${r.pttype}"`,
      `"${r.inscl}"`,
      `"${r.pttypename}"`,
      `"${r.death === 'Y' ? 'เสียชีวิต' : 'มีชีวิต'}"`,
      `"${r.death_date || ''}"`,
      `"${r.room}"`,
      `"${r.spclty}"`,
      `"${r.diag}"`,
      `"${r.oper}"`,
      `"${r.z515}"`,
      `"${r.dx}"`,
      `"${r.z718}"`,
      `"${r.dx === 'Y' && r.z718 === 'Y' ? 'Y' : ''}"`,
      `"${r.cancer}"`,
      `"${r.drug}"`,
      `"${r.cancer === 'Y' && r.drug === 'Y' ? 'Y' : ''}"`,
      `"${r.ok === 'Y' ? 'จ่ายแล้ว' : 'ยังไม่ชดเชย'}"`,
      r.compensated,
      `"${r.rep_invoice}"`,
      `"${r.eclaim_no}"`,
      `"${r.senddate || ''}"`,
      `"${r.status_eclaim}"`,
      `"${r.filename_send}"`,
      `"${r.error_name}"`,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Palliative_Care_PC3_${ds1}_to_${ds2}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Row highlight class based on semantic status (1 สี = 1 ความหมาย)
  const getRowClass = (item: PalliativeCareItem) => {
    if (item.death === 'Y') return 'pc3-row-death'
    if (item.ok === 'Y') return 'pc3-row-paid'
    if (item.error_name) return 'pc3-row-warn'
    return ''
  }

  return (
    <div className="pc3-container">
      {/* 1. Header */}
      <div className="pc3-header">
        <div>
          <div className="pc3-title-wrap">
            <h1 className="pc3-title">Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด</h1>
            <span className="pc3-badge">PC.3</span>
          </div>
          <p className="pc3-desc">
            ระบบตรวจสอบผู้ป่วย Palliative Care, Advance Care Plan, Opioid และการชดเชยค่ารักษา e-Claim (ไม่รวมสิทธิ H1, 35, 36)
          </p>
        </div>

        <div className="pc3-header-actions">
          <button
            type="button"
            className="pc3-btn-secondary"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>

          <button
            type="button"
            className="pc3-btn-primary"
            onClick={handleExportCsv}
            disabled={loading || items.length === 0}
          >
            ส่งออก CSV
          </button>
        </div>
      </div>

      {/* 2. Vibrant Metric Cards Bar */}
      <div className="pc3-metric-bar">
        <div className="pc3-metric-card pc3-card-total">
          <div className="pc3-metric-label">ผู้ป่วย Palliative ทั้งหมด</div>
          <div className="pc3-metric-val">
            {summary.totalPatients.toLocaleString()}
            <span className="pc3-metric-unit">คน</span>
          </div>
          <div className="pc3-metric-sub">
            จำนวนรับบริการ: {summary.totalVisits.toLocaleString()} ครั้ง
          </div>
        </div>

        <div className="pc3-metric-card pc3-card-acp">
          <div className="pc3-metric-label">Advance Care Plan</div>
          <div className="pc3-metric-val" style={{ color: '#0f766e' }}>
            {summary.advanceCarePlanCount.toLocaleString()}
            <span className="pc3-metric-unit">ครั้ง</span>
          </div>
          <div className="pc3-metric-sub">เกณฑ์ Dx + Z718</div>
        </div>

        <div className="pc3-metric-card pc3-card-opioid">
          <div className="pc3-metric-label">Opioid</div>
          <div className="pc3-metric-val" style={{ color: '#7e22ce' }}>
            {summary.opioidCount.toLocaleString()}
            <span className="pc3-metric-unit">ครั้ง</span>
          </div>
          <div className="pc3-metric-sub">Cancer + ยา Opioid</div>
        </div>

        <div className="pc3-metric-card pc3-card-z515">
          <div className="pc3-metric-label">มีรหัส Z515</div>
          <div className="pc3-metric-val" style={{ color: '#15803d' }}>
            {summary.hasZ515Count.toLocaleString()}
            <span className="pc3-metric-unit">ครั้ง</span>
          </div>
          <div className="pc3-metric-sub">ลงรหัสครบถ้วน</div>
        </div>

        <div className="pc3-metric-card pc3-card-noz515">
          <div className="pc3-metric-label">ไม่พบรหัส Z515 (ส้ม)</div>
          <div className="pc3-metric-val pc3-val-warn">
            {summary.missingZ515Count.toLocaleString()}
            <span className="pc3-metric-unit">ครั้ง</span>
          </div>
          <div className="pc3-metric-sub">ต้องบันทึกรหัสเพิ่ม</div>
        </div>

        <div className="pc3-metric-card pc3-card-paid">
          <div className="pc3-metric-label">ชดเชยแล้ว (เขียว)</div>
          <div className="pc3-metric-val pc3-val-paid">
            {summary.paidCount.toLocaleString()}
            <span className="pc3-metric-unit">ครั้ง</span>
          </div>
          <div className="pc3-metric-sub">
            {summary.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
          </div>
        </div>

        <div className="pc3-metric-card pc3-card-death">
          <div className="pc3-metric-label">เสียชีวิต (ชมพู)</div>
          <div className="pc3-metric-val pc3-val-risk">
            {summary.deceasedCount.toLocaleString()}
            <span className="pc3-metric-unit">คน</span>
          </div>
          <div className="pc3-metric-sub">สถานะจำหน่าย</div>
        </div>
      </div>

      {/* 3. Toolbar & Filters Card */}
      <div className="pc3-toolbar">
        {/* Date Mode Row */}
        <div className="pc3-toolbar-row">
          <div className="pc3-segmented-track">
            <button
              type="button"
              className={`pc3-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง (วันถึงวัน)
            </button>
            <button
              type="button"
              className={`pc3-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={`pc3-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              รายปีงบประมาณ
            </button>
          </div>

          {dateMode === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="date"
                className="pc3-input-date"
                value={ds1}
                onChange={(e) => setDs1(e.target.value)}
              />
              <span style={{ color: 'var(--pc-muted)', fontSize: '0.85rem' }}>ถึง</span>
              <input
                type="date"
                className="pc3-input-date"
                value={ds2}
                onChange={(e) => setDs2(e.target.value)}
              />
            </div>
          )}

          {dateMode === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="pc3-select"
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
                className="pc3-select"
                value={selectedBeYear}
                onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: '0.8rem', color: 'var(--pc-muted)' }}>
                ({ds1} ถึง {ds2})
              </span>
            </div>
          )}

          {dateMode === 'fiscal' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="pc3-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: '0.8rem', color: 'var(--pc-muted)' }}>
                (1 ต.ค. {selectedFiscalYear - 1} - 30 ก.ย. {selectedFiscalYear})
              </span>
            </div>
          )}
        </div>

        {/* Filters Row: Checkbox UC, สถานะตาย, เงินชดเชย, กลุ่มโรค, ค้นหา */}
        <div className="pc3-toolbar-row">
          <label className="pc3-checkbox-label">
            <input
              type="checkbox"
              checked={ucOnly}
              onChange={(e) => setUcOnly(e.target.checked)}
            />
            <span>เฉพาะสิทธิ UC</span>
          </label>

          {/* Filter สถานะตาย */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pc-muted)' }}>สถานะตาย:</span>
            <select
              className="pc3-select"
              value={deathStatus}
              onChange={(e) => setDeathStatus(e.target.value as 'ALL' | 'Y' | 'N')}
            >
              <option value="ALL">สถานะตาย: ทั้งหมด</option>
              <option value="N">เฉพาะผู้ป่วยมีชีวิต</option>
              <option value="Y">เฉพาะผู้ป่วยเสียชีวิต</option>
            </select>
          </div>

          {/* Filter เงินชดเชย */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pc-muted)' }}>เงินชดเชย:</span>
            <select
              className="pc3-select"
              value={compensatedFilter}
              onChange={(e) => setCompensatedFilter(e.target.value)}
            >
              <option value="ALL">เงินชดเชย: ทั้งหมด</option>
              <option value="0">ยังไม่ได้รับเงินชดเชย (0 บาท)</option>
              <option value="PAID">ได้รับเงินชดเชยแล้ว (ทุกยอด)</option>
              <optgroup label="เกณฑ์ยอดเงินขั้นต่ำ (>=)">
                <option value=">=750">&gt;= 750 บาท</option>
                <option value=">=1000">&gt;= 1,000 บาท</option>
                <option value=">=2000">&gt;= 2,000 บาท</option>
                <option value=">=3000">&gt;= 3,000 บาท</option>
                <option value=">=4000">&gt;= 4,000 บาท</option>
                <option value=">=5000">&gt;= 5,000 บาท</option>
                <option value=">=6000">&gt;= 6,000 บาท</option>
                <option value=">=7000">&gt;= 7,000 บาท</option>
                <option value=">=8000">&gt;= 8,000 บาท</option>
                <option value=">=9000">&gt;= 9,000 บาท</option>
                <option value=">9000">&gt; 9,000 บาท</option>
              </optgroup>
              <optgroup label="ระบุจำนวนเงินตรงตัว (=)">
                {availableCompensations.map((val) => (
                  <option key={val} value={`=${val}`}>
                    = {val.toLocaleString()} บาท
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Filter กลุ่มโรค */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pc-muted)' }}>กลุ่มโรค:</span>
            <select
              className="pc3-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'ALL' | 'Chronic' | 'Opioid' | 'Death')}
            >
              <option value="ALL">กลุ่มโรค: ทั้งหมด</option>
              <option value="Chronic">Chronic (Dx + Z718)</option>
              <option value="Opioid">Opioid (Cancer + Drug)</option>
            </select>
          </div>

          <input
            type="search"
            className="pc3-search-input"
            placeholder="ค้นหา HN, ชื่อผู้ป่วย, เลข CID 13 หลัก, VN, หรือรหัสโรค..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pc-muted)' }}>หน้าละ:</span>
            <select
              className="pc3-select"
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
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Vivid Legend Bar (แถบสีจำแนกสถานะ) */}
      <div className="pc3-legend">
        <span className="pc3-legend-title">แถบสีจำแนกสถานะ:</span>
        <div className="pc3-legend-pill pc3-pill-paid">
          <span className="pc3-legend-dot pc3-dot-paid" />
          <span>แถบสีเขียว = ได้รับเงินชดเชยแล้ว</span>
        </div>
        <div className="pc3-legend-pill pc3-pill-death">
          <span className="pc3-legend-dot pc3-dot-death" />
          <span>แถบสีชมพู = ผู้ป่วยเสียชีวิต</span>
        </div>
        <div className="pc3-legend-pill pc3-pill-warn">
          <span className="pc3-legend-dot pc3-dot-warn" />
          <span>แถบสีส้ม = ไม่พบรหัส Z515 (ต้องลงรหัสเพิ่ม)</span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '1rem', background: 'var(--pc-risk-bg)', border: '1px solid var(--pc-risk-border)', borderRadius: 8, color: 'var(--pc-risk-text)' }}>
          <strong>เกิดข้อผิดพลาด:</strong> {error}
        </div>
      )}

      {/* 5. Data Table */}
      <div className="pc3-table-card">
        <div className="pc3-table-scroll">
          <table className="pc3-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 45, textAlign: 'center' }}>ลำดับ</th>
                <th rowSpan={2}>VN</th>
                <th rowSpan={2}>HN</th>
                <th rowSpan={2}>เลขบัตรประชาชน (CID)</th>
                {/* ชื่อ-สกุล แสดงแถวแนวนอนแถวเดียวไม่ซ้อนกัน */}
                <th rowSpan={2} style={{ whiteSpace: 'nowrap' }}>ชื่อ-สกุล</th>
                <th rowSpan={2}>วันที่รับบริการ</th>
                <th rowSpan={2}>Authen Code</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>รหัสสิทธิ</th>
                <th rowSpan={2}>ชื่อสิทธิการรักษา</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>สถานะตาย</th>
                <th rowSpan={2}>จุดบริการ / คลินิก</th>
                <th rowSpan={2}>รหัสวินิจฉัย (Diag)</th>
                <th rowSpan={2}>หัตถการ</th>
                {/* Merged Header 1: Advance Care Plan */}
                <th colSpan={2} className="pc3-th-group-acp">Advance Care Plan</th>
                {/* Merged Header 2: Opioid */}
                <th colSpan={2} className="pc3-th-group-opioid">Opioid</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>Z515</th>
                <th rowSpan={2}>ErrorName</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>จ่ายแล้ว</th>
                <th rowSpan={2}>เงินชดเชย</th>
                <th rowSpan={2}>Rep / Invoice</th>
                <th rowSpan={2}>E-Claim No</th>
                <th rowSpan={2}>วันที่ส่งเคลม</th>
                <th rowSpan={2}>สถานะ e-Claim</th>
                <th rowSpan={2}>ไฟล์ส่งเคลม</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>รายละเอียด</th>
              </tr>
              <tr>
                <th className="pc3-th-group-acp">Dx</th>
                <th className="pc3-th-group-acp">Z718</th>
                <th className="pc3-th-group-opioid">Cancer</th>
                <th className="pc3-th-group-opioid">Drug</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={27} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--pc-muted)' }}>
                    กำลังโหลดข้อมูล Palliative Care จากระบบ...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={27} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--pc-muted)' }}>
                    ไม่พบข้อมูลผู้ป่วย Palliative Care ในช่วงเวลาหรือเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.vn} className={getRowClass(item)}>
                    <td className="pc3-num" style={{ textAlign: 'center', color: 'var(--pc-muted)' }}>
                      {item.no}
                    </td>
                    <td className="pc3-num">
                      <button
                        type="button"
                        className="pc3-vn-link"
                        onClick={() => setSelectedVn(item.vn)}
                        title={`คลิกเพื่อดูรายละเอียดการรับบริการ VN: ${item.vn} (opdscreen, ovstdiag, opitemrece)`}
                      >
                        {item.vn}
                      </button>
                    </td>
                    <td className="pc3-num">{item.hn}</td>
                    {/* เลขบัตรประชาชน แสดงเต็ม 13 หลัก ไม่ mask */}
                    <td className="pc3-num">{item.cid || '-'}</td>
                    {/* ชื่อ-สกุล แสดงแนวนอนแถวเดียว ไม่ซ้อนกัน */}
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {item.ptname}
                    </td>
                    <td className="pc3-num">{item.vstdate}</td>
                    <td className="pc3-num">{item.authencode || '-'}</td>
                    <td className="pc3-num" style={{ textAlign: 'center' }}>
                      <span className="pc3-tag pc3-tag-ok">{item.pttype || item.inscl || '-'}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.pttypename || '-'}</td>
                    {/* สถานะตาย */}
                    <td style={{ textAlign: 'center' }}>
                      {item.death === 'Y' ? (
                        <span className="pc3-tag pc3-tag-death" title={item.death_date ? `วันที่เสียชีวิต: ${item.death_date}` : 'เสียชีวิต'}>
                          เสียชีวิต{item.death_date ? ` (${item.death_date})` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--pc-paid-text)', fontSize: '0.8125rem', fontWeight: 600 }}>มีชีวิต</span>
                      )}
                    </td>
                    <td>{item.room || item.spclty || '-'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.diag}>
                      {item.diag || '-'}
                    </td>
                    <td style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.oper}>
                      {item.oper || '-'}
                    </td>
                    {/* Advance Care Plan */}
                    <td style={{ textAlign: 'center' }}>
                      {item.dx === 'Y' ? <span className="pc3-tag pc3-tag-ok">Y</span> : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.z718 === 'Y' ? <span className="pc3-tag pc3-tag-ok">Y</span> : '-'}
                    </td>
                    {/* Opioid */}
                    <td style={{ textAlign: 'center' }}>
                      {item.cancer === 'Y' ? <span className="pc3-tag pc3-tag-ok">Y</span> : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.drug === 'Y' ? <span className="pc3-tag pc3-tag-ok">Y</span> : '-'}
                    </td>
                    {/* Z515 */}
                    <td style={{ textAlign: 'center' }}>
                      {item.z515 === 'Y' ? (
                        <span className="pc3-tag pc3-tag-ok">Y</span>
                      ) : (
                        <span style={{ color: 'var(--pc-muted)' }}>-</span>
                      )}
                    </td>
                    {/* ErrorName */}
                    <td>
                      {item.error_name ? (
                        <span className="pc3-tag pc3-tag-warn">{item.error_name}</span>
                      ) : (
                        <span style={{ color: 'var(--pc-paid-text)', fontSize: '0.8125rem', fontWeight: 600 }}>ครบถ้วน</span>
                      )}
                    </td>
                    {/* จ่ายแล้ว */}
                    <td style={{ textAlign: 'center' }}>
                      {item.ok === 'Y' ? (
                        <span className="pc3-tag pc3-tag-paid">จ่ายแล้ว</span>
                      ) : (
                        <span style={{ color: 'var(--pc-muted)' }}>-</span>
                      )}
                    </td>
                    {/* เงินชดเชย */}
                    <td className="pc3-num" style={{ fontWeight: item.compensated > 0 ? 700 : 400 }}>
                      {item.compensated > 0
                        ? item.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="pc3-num">{item.rep_invoice || '-'}</td>
                    <td className="pc3-num">{item.eclaim_no || '-'}</td>
                    <td className="pc3-num">{item.senddate || '-'}</td>
                    <td>
                      <span className="pc3-tag">{item.status_eclaim}</span>
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.filename_send}>
                      {item.filename_send || '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="pc3-btn-secondary"
                        style={{ minHeight: 30, padding: '0 0.55rem', fontSize: '0.75rem' }}
                        title="ดูรายละเอียดผู้ป่วย"
                      >
                        ดูข้อมูล
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Footer */}
        <div className="pc3-pagination">
          <div style={{ fontSize: '0.8125rem', color: 'var(--pc-muted)' }}>
            แสดง {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง{' '}
            {Math.min(currentPage * pageSize, items.length)} จากทั้งหมด {items.length.toLocaleString()} รายการ
          </div>

          <div className="pc3-page-btns">
            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="หน้าแรก"
            >
              &laquo;
            </button>
            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              title="หน้าก่อนหน้า"
            >
              &lsaquo;
            </button>

            <span className="pc3-num" style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              หน้า {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              title="หน้าถัดไป"
            >
              &rsaquo;
            </button>
            <button
              type="button"
              className="pc3-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="หน้าสุดท้าย"
            >
              &raquo;
            </button>
          </div>
        </div>
      </div>

      {/* VN Clinical Detail Modal (opdscreen, ovstdiag, opitemrece) */}
      <VnDetailModal vn={selectedVn} onClose={() => setSelectedVn(null)} />

      {/* 7. Detail Modal */}
      {selectedItem && (
        <div className="pc3-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="pc3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pc3-modal-header">
              <h3 className="pc3-modal-title">
                รายละเอียดผู้ป่วย: {selectedItem.ptname} (HN: {selectedItem.hn})
              </h3>
              <button
                type="button"
                className="pc3-btn-secondary"
                style={{ minHeight: 32, padding: '0 0.6rem', fontSize: '0.8125rem' }}
                onClick={() => setSelectedItem(null)}
              >
                ปิด
              </button>
            </div>

            <div className="pc3-modal-body">
              <div>
                <div className="pc3-field-label">VN</div>
                <div className="pc3-field-val pc3-num">{selectedItem.vn}</div>
              </div>
              <div>
                <div className="pc3-field-label">เลขบัตรประชาชน (CID)</div>
                <div className="pc3-field-val pc3-num">{selectedItem.cid || '-'}</div>
              </div>
              <div>
                <div className="pc3-field-label">วันที่รับบริการ</div>
                <div className="pc3-field-val pc3-num">{selectedItem.vstdate}</div>
              </div>
              <div>
                <div className="pc3-field-label">Authen Code</div>
                <div className="pc3-field-val pc3-num">{selectedItem.authencode || '-'}</div>
              </div>
              <div>
                <div className="pc3-field-label">รหัสสิทธิ</div>
                <div className="pc3-field-val pc3-num">{selectedItem.pttype || selectedItem.inscl}</div>
              </div>
              <div>
                <div className="pc3-field-label">ชื่อสิทธิการรักษา</div>
                <div className="pc3-field-val">{selectedItem.pttypename}</div>
              </div>
              <div>
                <div className="pc3-field-label">สถานะตาย</div>
                <div className="pc3-field-val">
                  {selectedItem.death === 'Y' ? (
                    <span style={{ color: 'var(--pc-risk-text)', fontWeight: 600 }}>
                      เสียชีวิต{selectedItem.death_date ? ` (${selectedItem.death_date})` : ''}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--pc-paid-text)', fontWeight: 600 }}>มีชีวิต</span>
                  )}
                </div>
              </div>
              <div>
                <div className="pc3-field-label">เบอร์โทรศัพท์</div>
                <div className="pc3-field-val pc3-num">{selectedItem.tel || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="pc3-field-label">ที่อยู่</div>
                <div className="pc3-field-val">{selectedItem.address || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="pc3-field-label">อาการสำคัญ (CC)</div>
                <div className="pc3-field-val">{selectedItem.cc || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="pc3-field-label">การวินิจฉัยโรค (Diag)</div>
                <div className="pc3-field-val pc3-num">{selectedItem.diag || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="pc3-field-label">หัตถการ (Oper)</div>
                <div className="pc3-field-val pc3-num">{selectedItem.oper || '-'}</div>
              </div>
              <div>
                <div className="pc3-field-label">Z515</div>
                <div className="pc3-field-val">{selectedItem.z515 ? 'พบรหัส Z515' : 'ไม่พบรหัส Z515'}</div>
              </div>
              <div>
                <div className="pc3-field-label">Advance Care Plan</div>
                <div className="pc3-field-val">
                  {selectedItem.z718 === 'Y' && selectedItem.dx === 'Y' ? 'เข้าเกณฑ์ (Dx + Z718)' : 'ไม่เข้าเกณฑ์'}
                </div>
              </div>
              <div>
                <div className="pc3-field-label">Opioid</div>
                <div className="pc3-field-val">
                  {selectedItem.cancer === 'Y' && selectedItem.drug === 'Y' ? 'เข้าเกณฑ์ (Cancer + Drug)' : 'ไม่เข้าเกณฑ์'}
                </div>
              </div>
              <div>
                <div className="pc3-field-label">สถานะการชดเชย</div>
                <div className="pc3-field-val">
                  {selectedItem.ok === 'Y' ? `จ่ายแล้ว (${selectedItem.compensated.toLocaleString()} ฿)` : 'ยังไม่ชดเชย'}
                </div>
              </div>
              <div>
                <div className="pc3-field-label">Rep / Invoice</div>
                <div className="pc3-field-val pc3-num">{selectedItem.rep_invoice || '-'}</div>
              </div>
              <div>
                <div className="pc3-field-label">E-Claim No</div>
                <div className="pc3-field-val pc3-num">{selectedItem.eclaim_no || '-'}</div>
              </div>
              <div>
                <div className="pc3-field-label">วันที่ส่งเคลม</div>
                <div className="pc3-field-val pc3-num">{selectedItem.senddate || '-'}</div>
              </div>
              <div>
                <div className="pc3-field-label">สถานะ e-Claim</div>
                <div className="pc3-field-val">{selectedItem.status_eclaim}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="pc3-field-label">ไฟล์ส่งเคลม</div>
                <div className="pc3-field-val pc3-num">{selectedItem.filename_send || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
