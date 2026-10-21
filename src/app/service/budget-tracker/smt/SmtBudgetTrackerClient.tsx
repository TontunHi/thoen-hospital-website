'use client'

import React, { useState, useEffect, useMemo, useTransition } from 'react'
import {
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Clock,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowUpDown,
} from 'lucide-react'
import {
  SmtBudgetRecord,
  SmtBudgetSearchResult,
  SmtBudgetSummary,
} from '@/lib/budget/smtBudgetService'
import SmtDisbursementTrendChart from './components/SmtDisbursementTrendChart'
import SmtFundBreakdownChart from './components/SmtFundBreakdownChart'
import { exportSmtRecordsToExcel } from './utils/exportExcel'
import '../budget-tracker.css'

interface SmtBudgetTrackerClientProps {
  initialData: SmtBudgetSearchResult | null
  defaultVendorId?: string
  defaultYears?: string[]
}

const AVAILABLE_YEARS = ['2570', '2569', '2568', '2567', '2566', '2565']

export const THOEN_NETWORK_PRESETS = [
  { code: '11152', name: 'รพ.เถิน (แม่ข่าย CUP)' },
  { code: '01140', name: 'รพ.สต.บ้านดอนแก้ว' },
  { code: '01141', name: 'รพ.สต.บ้านดอนไชย' },
  { code: '01142', name: 'รพ.สต.บ้านนาเบี้ย' },
  { code: '01143', name: 'รพ.สต.บ้านปางกุ่ม' },
  { code: '01144', name: 'รพ.สต.บ้านปางหละ' },
  { code: '01145', name: 'รพ.สต.บ้านแม่ถิน' },
  { code: '01146', name: 'รพ.สต.บ้านแม่ปราบ' },
  { code: '01147', name: 'รพ.สต.บ้านแม่มอก' },
  { code: '01148', name: 'รพ.สต.บ้านเวียง' },
  { code: '01149', name: 'รพ.สต.บ้านสบเติน' },
  { code: '01150', name: 'รพ.สต.บ้านห้วยเกตุ' },
]

export default function SmtBudgetTrackerClient({
  initialData,
  defaultVendorId = '11152',
  defaultYears = ['2570'],
}: SmtBudgetTrackerClientProps) {
  const [selectedYears, setSelectedYears] = useState<string[]>(defaultYears)
  const [vendorId, setVendorId] = useState<string>(defaultVendorId)
  const [customVendorInput, setCustomVendorInput] = useState<string>('')
  const [isCustomVendor, setIsCustomVendor] = useState<boolean>(false)

  const [records, setRecords] = useState<SmtBudgetRecord[]>(initialData?.datas || [])
  const [dataSource, setDataSource] = useState<string>(initialData?.source || 'upstream')
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Polling Auto-refresh (0 = off, 300 = 5m, 900 = 15m, 1800 = 30m)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0)

  // Initialize lastUpdated after mount to prevent SSR locale hydration discrepancy
  useEffect(() => {
    if (initialData?.fetchedAt) {
      setLastUpdated(new Date(initialData.fetchedAt).toLocaleTimeString('th-TH'))
    }
  }, [initialData?.fetchedAt])

  // Filters
  const [selectedFund, setSelectedFund] = useState<string>('ALL')
  const [selectedSubFund, setSelectedSubFund] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageInput, setPageInput] = useState<string>('1')
  const pageSize = 15

  const [isPending, startTransition] = useTransition()

  // Format money helper
  const formatMoney = (val?: number) => {
    if (val === undefined || isNaN(val)) return '0.00'
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  // Multi-Year Toggle
  const handleToggleYear = (yr: string) => {
    setSelectedYears(prev => {
      if (prev.includes(yr)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter(y => y !== yr)
      }
      return [...prev, yr].sort().reverse()
    })
  }

  // Fetch data function
  const fetchData = async (force = false) => {
    setLoading(true)
    setErrorMsg('')

    try {
      const activeVendor = isCustomVendor && customVendorInput.trim() ? customVendorInput.trim() : vendorId

      const res = await fetch('/api/budget/smt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetYears: selectedYears,
          vendorId5Digit: activeVendor,
          forceRefresh: force,
        }),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ สปสช.')
      }

      setRecords(json.data.datas || [])
      setDataSource(json.data.source)
      setLastUpdated(new Date(json.data.fetchedAt).toLocaleTimeString('th-TH'))
      setCurrentPage(1)
    } catch (err: any) {
      setErrorMsg(err?.message || 'ไม่สามารถเชื่อมต่อระบบ สปสช. ได้')
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch when years or vendor change
  useEffect(() => {
    fetchData()
  }, [selectedYears, vendorId, isCustomVendor])

  // Auto-refresh polling effect
  useEffect(() => {
    if (autoRefreshInterval <= 0) return
    const timer = setInterval(() => {
      fetchData(true)
    }, autoRefreshInterval * 1000)
    return () => clearInterval(timer)
  }, [autoRefreshInterval, selectedYears, vendorId, isCustomVendor, customVendorInput])

  // Fund list extraction
  const availableFunds = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => {
      const raw = (r.fundGroupDescr || r.fundName || '').trim()
      if (raw) set.add(raw)
    })
    return Array.from(set).sort()
  }, [records])

  // Subfund list extraction
  const availableSubFunds = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => {
      const f = (r.fundGroupDescr || r.fundName || '').trim()
      if (selectedFund === 'ALL' || f === selectedFund) {
        const sub = (r.efundDesc || r.fundDescr || '').trim()
        if (sub) set.add(sub)
      }
    })
    return Array.from(set).sort()
  }, [records, selectedFund])

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const f = (r.fundGroupDescr || r.fundName || '').trim()
      if (selectedFund !== 'ALL' && f !== selectedFund) return false

      const sub = (r.efundDesc || r.fundDescr || '').trim()
      if (selectedSubFund !== 'ALL' && sub !== selectedSubFund) return false

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const b = String(r.batchNo || '').toLowerCase()
        const doc = String(r.refDocNo || '').toLowerCase()
        const fn = String(r.fundName || '').toLowerCase()
        const fd = String(r.fundDescr || '').toLowerCase()
        if (!b.includes(term) && !doc.includes(term) && !fn.includes(term) && !fd.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [records, selectedFund, selectedSubFund, searchTerm])

  // Dynamic KPI summary based on filtered records
  const dynamicSummary: SmtBudgetSummary = useMemo(() => {
    let totalAmount = 0
    let totalNetPayment = 0
    let totalWait = 0
    let totalDebt = 0
    let totalVat = 0
    let totalBond = 0
    let totalOdbt = 0

    for (const r of filteredRecords) {
      totalAmount += Number(r.amount) || 0
      totalNetPayment += Number(r.total) || 0
      totalWait += Number(r.wait) || 0
      totalDebt += Number(r.debt) || 0
      totalVat += Number(r.vat) || 0
      totalBond += Number(r.bond) || 0
      totalOdbt += Number(r.odbt) || 0
    }

    return {
      recordCount: filteredRecords.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalNetPayment: Math.round(totalNetPayment * 100) / 100,
      totalWait: Math.round(totalWait * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalBond: Math.round(totalBond * 100) / 100,
      totalOdbt: Math.round(totalOdbt * 100) / 100,
    }
  }, [filteredRecords])

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage])

  const handlePageJump = (p: number) => {
    const valid = Math.max(1, Math.min(totalPages, p))
    setCurrentPage(valid)
    setPageInput(String(valid))
  }

  const currentVendorName = useMemo(() => {
    if (isCustomVendor) return `หน่วยบริการรหัส ${customVendorInput || 'กำหนดเอง'}`
    const preset = THOEN_NETWORK_PRESETS.find(p => p.code === vendorId)
    return preset ? preset.name : `รหัส ${vendorId}`
  }, [vendorId, isCustomVendor, customVendorInput])

  // Excel Export Handler
  const handleExportExcel = async () => {
    await exportSmtRecordsToExcel(filteredRecords, selectedYears, vendorId, currentVendorName)
  }

  return (
    <div className="bt-smt-container">
      {/* ============================================================ */}
      {/* TOP CONTROLS BAR: Multi-Year, Vendor Preset, Refresh & Status */}
      {/* ============================================================ */}
      <div className="bt-focus-banner" style={{ marginBottom: '1.25rem' }}>
        <div className="bt-focus-info">
          {/* Vendor selection & Preset */}
          <div className="bt-focus-top-badges">
            <span className="bt-focus-pill" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}>
              สปสช. SMT เรียลไทม์
            </span>
            <span className="bt-focus-name" style={{ color: '#0369a1' }}>
              {currentVendorName}
            </span>
            <span className="bt-focus-code">
              รหัส: {isCustomVendor ? customVendorInput : vendorId}
            </span>
          </div>

          {/* Preset Buttons for CUP Thoen & Input Toggle */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>เลือกหน่วยบริการ:</span>
            <select
              value={isCustomVendor ? 'CUSTOM' : vendorId}
              onChange={e => {
                if (e.target.value === 'CUSTOM') {
                  setIsCustomVendor(true)
                } else {
                  setIsCustomVendor(false)
                  setVendorId(e.target.value)
                }
              }}
              className="bt-select"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', minWidth: '220px' }}
            >
              {THOEN_NETWORK_PRESETS.map(p => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
              <option value="CUSTOM">-- ระบุรหัสหน่วยบริการอื่น --</option>
            </select>

            {isCustomVendor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="text"
                  placeholder="รหัส 5 หลัก"
                  maxLength={5}
                  value={customVendorInput}
                  onChange={e => setCustomVendorInput(e.target.value)}
                  className="bt-select"
                  style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={() => fetchData(true)}
                  className="bt-focus-reset-btn"
                  style={{ padding: '0.25rem 0.55rem' }}
                >
                  ค้นหา
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Multi-Year Selectors, Auto-refresh & Force Button */}
        <div className="bt-focus-actions">
          {/* Multi-Year Selection Chips */}
          <div className="bt-year-control">
            <span className="bt-year-label">
              <Calendar size={13} />
              <span>ปีงบประมาณ:</span>
            </span>
            <div className="bt-year-buttons">
              {AVAILABLE_YEARS.map(yr => {
                const isActive = selectedYears.includes(yr)
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => handleToggleYear(yr)}
                    className={`bt-year-btn ${isActive ? 'active' : ''}`}
                    title={isActive ? `คลิกเพื่อนำปี ${yr} ออก` : `คลิกเพื่อเลือกปี ${yr} ร่วม`}
                  >
                    <span>{yr}</span>
                    {yr === '2570' && <span className="bt-year-pill-new">ใหม่</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Polling Interval Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <Clock size={13} style={{ color: '#64748b' }} />
            <select
              value={autoRefreshInterval}
              onChange={e => setAutoRefreshInterval(Number(e.target.value))}
              style={{ border: 'none', background: 'transparent', fontSize: '0.75rem', color: '#475569', fontWeight: 600, outline: 'none' }}
            >
              <option value={0}>ปิดอัปเดตอัตโนมัติ</option>
              <option value={300}>อัปเดตทุก 5 นาที</option>
              <option value={900}>อัปเดตทุก 15 นาที</option>
              <option value={1800}>อัปเดตทุก 30 นาที</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading}
            className="bt-focus-reset-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            title="ข้ามแคชเพื่อดึงข้อมูลสดจาก สปสช."
          >
            <RefreshCw size={13} className={loading ? 'bt-spin' : ''} />
            <span>{loading ? 'กำลังโหลด...' : 'ดึงข้อมูลสด'}</span>
          </button>
        </div>
      </div>

      {/* Cache Status & Last Update Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', padding: '0 0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Database size={13} />
            แหล่งข้อมูล:{' '}
            <b style={{ color: dataSource === 'cache' ? '#059669' : '#0284c7' }}>
              {dataSource === 'cache' ? 'แคชในหน่วยความจำ (TTL 10 นาที)' : 'เชื่อมตรง Upstream สปสช.'}
            </b>
          </span>
          {lastUpdated && <span suppressHydrationWarning>· อัปเดตล่าสุด: {lastUpdated}</span>}
        </div>
        <div>
          <span>พบธุรกรรมทั้งหมด <b>{filteredRecords.length}</b> รายการ</span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4 PRIMARY KPI SUMMARY CARDS                                  */}
      {/* ============================================================ */}
      <div className="bt-stat-grid" style={{ marginBottom: '1.25rem' }}>
        {/* Card 1: วงเงินจัดสรรรวม */}
        <div className="bt-stat-card">
          <div className="bt-stat-label">
            <span>วงเงินจัดสรรรวม (Amount)</span>
            <TrendingUp size={16} style={{ color: '#059669' }} />
          </div>
          <div className="bt-stat-value" style={{ color: '#065f46' }}>
            ฿{formatMoney(dynamicSummary.totalAmount)}
          </div>
          <div className="bt-stat-footer">
            ยอดงบประมาณจัดสรรทั้งหมดก่อนหักภาษี/หนี้
          </div>
        </div>

        {/* Card 2: ยอดเงินโอนสุทธิ */}
        <div className="bt-stat-card">
          <div className="bt-stat-label">
            <span>ยอดเงินโอนสุทธิ (Net Total)</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
          </div>
          <div className="bt-stat-value" style={{ color: '#047857' }}>
            ฿{formatMoney(dynamicSummary.totalNetPayment)}
          </div>
          <div className="bt-stat-footer">
            เงินโอนเข้าบัญชีจริง คิดเป็น <b>{dynamicSummary.totalAmount ? ((dynamicSummary.totalNetPayment / dynamicSummary.totalAmount) * 100).toFixed(1) : '0'}%</b> ของงบจัดสรร
          </div>
        </div>

        {/* Card 3: ยอดเงินรอดำเนินการ */}
        <div className="bt-stat-card">
          <div className="bt-stat-label">
            <span>รอดำเนินการโอน (Wait)</span>
            <Clock size={16} style={{ color: '#d97706' }} />
          </div>
          <div className="bt-stat-value" style={{ color: '#b45309' }}>
            ฿{formatMoney(dynamicSummary.totalWait)}
          </div>
          <div className="bt-stat-footer">
            อยู่ระหว่างกระบวนการโอนเงินของ สปสช.
          </div>
        </div>

        {/* Card 4: ยอดหักหนี้/VAT/พันธบัตร */}
        <div className="bt-stat-card">
          <div className="bt-stat-label">
            <span>ยอดหักหนี้ / ภาษี / พันธบัตร</span>
            <span style={{ fontSize: '0.7rem', color: '#be123c', fontWeight: 600 }}>หัก ณ ที่จ่าย</span>
          </div>
          <div className="bt-stat-value" style={{ color: '#991b1b' }}>
            ฿{formatMoney(dynamicSummary.totalDebt + dynamicSummary.totalVat + dynamicSummary.totalBond)}
          </div>
          <div className="bt-stat-footer" style={{ fontSize: '0.725rem' }}>
            หนี้: ฿{formatMoney(dynamicSummary.totalDebt)} · VAT: ฿{formatMoney(dynamicSummary.totalVat)} · พันธบัตร: ฿{formatMoney(dynamicSummary.totalBond)}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CHARTS ROW: Trend vs Fund Group Breakdown                   */}
      {/* ============================================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Chart 1: Disbursement Trend */}
        <div className="bt-panel" style={{ marginBottom: 0 }}>
          <div className="bt-panel-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
            <div>
              <h3 className="bt-panel-title">
                {selectedYears.length > 1
                  ? `เปรียบเทียบงบประมาณตามปีงบ (${selectedYears.join(', ')})`
                  : `แนวโน้มการโอนเงินงบประมาณรายเดือน (ปีงบ ${selectedYears[0]})`}
              </h3>
              <p className="bt-panel-desc">
                {selectedYears.length > 1
                  ? 'เปรียบเทียบวงเงินจัดสรรและยอดเงินโอนสุทธิรายปี'
                  : 'แสดงรอบการโอนเงินจริงในรอบ 12 เดือนตามปีงบประมาณไทย (ต.ค. - ก.ย.)'}
              </p>
            </div>
          </div>
          <SmtDisbursementTrendChart records={filteredRecords} selectedYears={selectedYears} />
        </div>

        {/* Chart 2: Fund Group Breakdown */}
        <div className="bt-panel" style={{ marginBottom: 0 }}>
          <div className="bt-panel-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
            <div>
              <h3 className="bt-panel-title">
                สัดส่วนตามกลุ่มกองทุน สปสช.
              </h3>
              <p className="bt-panel-desc">
                คลิกที่กลุ่มกองทุนเพื่อกรองดูรายการเฉพาะด้าน
              </p>
            </div>
            {selectedFund !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedFund('ALL')}
                className="bt-focus-reset-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem' }}
              >
                ✕ ล้างตัวกรอง ({selectedFund})
              </button>
            )}
          </div>
          <SmtFundBreakdownChart
            records={records}
            selectedFund={selectedFund}
            onSelectFund={setSelectedFund}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* TRANSACTIONS TABLE & EXPORT CONTROLS                        */}
      {/* ============================================================ */}
      <div className="bt-panel">
        {/* Table Filters & Actions Header */}
        <div className="bt-panel-header">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            {/* Fund Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#475569' }}>กลุ่มกองทุน:</span>
              <select
                value={selectedFund}
                onChange={e => {
                  setSelectedFund(e.target.value)
                  setSelectedSubFund('ALL')
                  setCurrentPage(1)
                }}
                className="bt-select"
                style={{ maxWidth: '200px' }}
              >
                <option value="ALL">-- ทุกกลุ่มกองทุน ({availableFunds.length}) --</option>
                {availableFunds.map(f => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Subfund Filter Dropdown */}
            {availableSubFunds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#475569' }}>กองทุนย่อย:</span>
                <select
                  value={selectedSubFund}
                  onChange={e => {
                    setSelectedSubFund(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="bt-select"
                  style={{ maxWidth: '200px' }}
                >
                  <option value="ALL">-- ทุกกองทุนย่อย ({availableSubFunds.length}) --</option>
                  {availableSubFunds.map(sf => (
                    <option key={sf} value={sf}>
                      {sf}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                placeholder="ค้นหา Batch, เลขที่เอกสาร, ชื่อกองทุน..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="bt-select"
                style={{ paddingLeft: '2rem', width: '220px' }}
              />
            </div>
          </div>

          {/* Export to Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="bt-focus-reset-btn"
            style={{
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
            }}
          >
            <FileSpreadsheet size={15} />
            <span>ส่งออก Excel (.xlsx)</span>
          </button>
        </div>

        {/* Table Wrapper */}
        <div className="bt-table-wrapper bt-table-wrapper-max">
          <table className="bt-table bt-table-ranking">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>ลำดับ</th>
                <th style={{ width: '55px', textAlign: 'center' }}>ปีงบ</th>
                <th style={{ width: '85px', textAlign: 'center' }}>วันที่โอน</th>
                <th style={{ width: '90px' }} className="t">รอบจัดสรร</th>
                <th style={{ width: '110px' }} className="t">เลขที่เอกสาร</th>
                <th className="t">ชื่อกองทุน / กลุ่มกองทุน</th>
                <th style={{ minWidth: '115px', textAlign: 'right' }}>วงเงินจัดสรร (บาท)</th>
                <th style={{ minWidth: '115px', textAlign: 'right' }}>ยอดโอนสุทธิ (บาท)</th>
                <th style={{ width: '70px', textAlign: 'center' }}>สถานะ</th>
                <th style={{ width: '90px', textAlign: 'center' }}>เอกสาร</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    ไม่พบรายการธุรกรรมงบประมาณตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1
                  const dateStr = String(r.postingDate || r.runDt || '')
                  const formattedDate =
                    dateStr.length === 8 && /^\d+$/.test(dateStr)
                      ? `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`
                      : dateStr || '–'

                  const paymLink = r.downloadPAYMFileName || r.downloadUrl
                  const hasPaym = !!paymLink

                  return (
                    <tr key={`${r.batchNo}-${r.refDocNo}-${idx}`}>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{globalIdx}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.fiscalYear || '–'}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.75rem' }}>{formattedDate}</td>
                      <td className="t" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1' }}>
                        {r.batchNo || '–'}
                      </td>
                      <td className="t" style={{ fontSize: '0.75rem', color: '#475569' }}>
                        {r.refDocNo || '–'}
                      </td>
                      <td className="t">
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.fundName || '–'}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {r.fundGroupDescr || '–'} {r.efundDesc ? `· ${r.efundDesc}` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatMoney(Number(r.amount) || 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                        {formatMoney(Number(r.total) || 0)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="bt-badge bt-badge-emerald" style={{ fontSize: '0.675rem' }}>
                          {r.pmntStts || 'โอนสำเร็จ'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {hasPaym ? (
                          <a
                            href={
                              r.downloadUrl ||
                              `https://smt.nhso.go.th/smtf/api/budgetreport/downloadFile?fileName=${r.downloadPAYMFileName}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bt-focus-reset-btn"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.675rem',
                              textDecoration: 'none',
                            }}
                            title="ดาวน์โหลดใบโอนเงิน สปสช. (PAYM)"
                          >
                            <Download size={11} />
                            <span>PAYM</span>
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>–</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.85rem',
              marginTop: '0.5rem',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.8rem',
              color: '#475569',
            }}
          >
            <div>
              แสดงหน้า <b>{currentPage}</b> จาก <b>{totalPages}</b> หน้า ({filteredRecords.length} รายการ)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => handlePageJump(currentPage - 1)}
                disabled={currentPage <= 1}
                className="bt-focus-reset-btn"
                style={{ padding: '0.3rem 0.6rem' }}
              >
                <ChevronLeft size={14} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>หน้า</span>
                <input
                  type="text"
                  value={pageInput}
                  onChange={e => setPageInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handlePageJump(parseInt(pageInput, 10))
                    }
                  }}
                  onBlur={() => handlePageJump(parseInt(pageInput, 10))}
                  style={{
                    width: '40px',
                    textAlign: 'center',
                    padding: '0.2rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => handlePageJump(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="bt-focus-reset-btn"
                style={{ padding: '0.3rem 0.6rem' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
