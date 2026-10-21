'use client'

import React, { useState, useEffect, useMemo, useTransition } from 'react'
import {
  Building2,
  Calendar,
  RefreshCw,
  Search,
  Download,
  Database,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  ArrowUpDown,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  TrendingUp,
  Receipt,
  Hash,
} from 'lucide-react'
import {
  MisHosCategory,
  MisHosSubmenu,
  MisHosSubReport,
  MisHosTemplateConfig,
  MisHosTableDataResult,
  MisHosHospitalInfo,
  MIS_HOS_MENU_CATEGORIES,
  THOEN_HOSPITAL_CODE,
  calculateThaiFiscalYear,
  getAvailableMisHosFiscalYears,
} from '@/lib/budget/misHosService'
import MisHosChart from './components/MisHosChart'
import { exportMisHosRecordsToExcel } from './utils/exportExcel'
import '../budget-tracker.css'

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

export const AVAILABLE_YEARS = getAvailableMisHosFiscalYears(11)

interface MisHosBudgetTrackerClientProps {
  initialTemplate: MisHosTemplateConfig | null
  initialTableData: MisHosTableDataResult | null
  initialHospital: MisHosHospitalInfo | null
  defaultHcode?: string
  defaultYear?: string
}

export default function MisHosBudgetTrackerClient({
  initialTemplate,
  initialTableData,
  initialHospital,
  defaultHcode = THOEN_HOSPITAL_CODE,
  defaultYear,
}: MisHosBudgetTrackerClientProps) {
  const currentFiscalYear = defaultYear || AVAILABLE_YEARS[0] || calculateThaiFiscalYear()

  // Hospital & Year controls
  const [hcode, setHcode] = useState<string>(defaultHcode)
  const [customHcode, setCustomHcode] = useState<string>('')
  const [isCustomHcode, setIsCustomHcode] = useState<boolean>(false)
  const [selectedYear, setSelectedYear] = useState<string>(currentFiscalYear)
  const [hospitalInfo, setHospitalInfo] = useState<MisHosHospitalInfo | null>(initialHospital)

  // Navigation Accordion State
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    '0': true,
  })
  const [activeCategory, setActiveCategory] = useState<string>('0')
  const [activeSubmenu, setActiveSubmenu] = useState<MisHosSubmenu>(
    MIS_HOS_MENU_CATEGORIES[0].submenus[0]
  )

  // Report & Template State
  const [template, setTemplate] = useState<MisHosTemplateConfig | null>(initialTemplate)
  const [activeSsid, setActiveSsid] = useState<string>(
    initialTemplate?.subReports[0]?.ssid || '1825'
  )
  const [records, setRecords] = useState<Record<string, any>[]>(
    initialTableData?.records || []
  )
  const [dataSource, setDataSource] = useState<string>(initialTableData?.source || 'upstream')
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageInput, setPageInput] = useState<string>('1')
  const pageSize = 15

  const [isPending, startTransition] = useTransition()

  // Format lastUpdated on client mount to avoid SSR hydration mismatch
  useEffect(() => {
    if (initialTableData?.fetchedAt) {
      setLastUpdated(new Date(initialTableData.fetchedAt).toLocaleTimeString('th-TH'))
    }
  }, [initialTableData?.fetchedAt])

  // Hospital Name helper
  const currentHospitalName = useMemo(() => {
    if (isCustomHcode) return `หน่วยบริการรหัส ${customHcode || 'กำหนดเอง'}`
    const preset = THOEN_NETWORK_PRESETS.find(p => p.code === hcode)
    return preset ? preset.name : (hospitalInfo?.hname || `รหัส ${hcode}`)
  }, [hcode, isCustomHcode, customHcode, hospitalInfo])

  // Fetch Hospital Info when hcode changes
  useEffect(() => {
    const fetchHosp = async () => {
      try {
        const res = await fetch('/api/budget/mishos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getHospitalInfo', hcode }),
        })
        const json = await res.json()
        if (json.success && json.data) {
          setHospitalInfo(json.data)
        }
      } catch {
        // Keep fallback
      }
    }
    fetchHosp()
  }, [hcode])

  // Toggle Category in Sidebar Accordion
  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }))
  }

  // Load Submenu Template & Data
  const handleSelectSubmenu = async (
    category: MisHosCategory,
    submenu: MisHosSubmenu
  ) => {
    setActiveCategory(category.id)
    setActiveSubmenu(submenu)
    setErrorMsg('')
    setLoading(true)

    try {
      // 1. Fetch template
      const tplRes = await fetch('/api/budget/mishos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTemplate',
          stId: submenu.stId,
          hcode,
          year: selectedYear,
        }),
      })
      const tplJson = await tplRes.json()
      const tpl: MisHosTemplateConfig | null = tplJson.success ? tplJson.data : null
      setTemplate(tpl)

      // 2. Select initial ssid
      const targetSsid = tpl?.subReports[0]?.ssid || submenu.defaultSsid || submenu.stId
      setActiveSsid(targetSsid)

      // 3. Fetch table data for initial ssid
      await loadTableData(targetSsid, false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลรายงานได้'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  // Load Table Data for a specific ssid
  const loadTableData = async (ssid: string, force: boolean = false) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/budget/mishos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTableData',
          ssid,
          hcode,
          year: selectedYear,
          forceRefresh: force,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setRecords(json.data.records || [])
        setDataSource(json.data.source || 'upstream')
        if (json.data.fetchedAt) {
          setLastUpdated(new Date(json.data.fetchedAt).toLocaleTimeString('th-TH'))
        }
        setCurrentPage(1)
        setPageInput('1')
      } else {
        setRecords([])
        if (json.error?.message) {
          setErrorMsg(json.error.message)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลตาราง'
      setErrorMsg(msg)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  // Handle Sub-report tab switch
  const handleSelectSubReport = (sub: MisHosSubReport) => {
    setActiveSsid(sub.ssid)
    loadTableData(sub.ssid, false)
  }

  // Force Refresh current data
  const handleForceRefresh = () => {
    loadTableData(activeSsid, true)
  }

  // Switch Year handler
  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear)
    // Re-fetch current report with new year
    setTimeout(() => {
      loadTableData(activeSsid, true)
    }, 50)
  }

  // Switch Hospital preset handler
  const handleHospitalPresetChange = (code: string) => {
    if (code === 'CUSTOM') {
      setIsCustomHcode(true)
    } else {
      setIsCustomHcode(false)
      setHcode(code)
      setTimeout(() => {
        loadTableData(activeSsid, true)
      }, 50)
    }
  }

  // Apply custom hospital search
  const handleApplyCustomHcode = () => {
    if (customHcode.trim().length === 5) {
      setHcode(customHcode.trim())
      setTimeout(() => {
        loadTableData(activeSsid, true)
      }, 50)
    }
  }

  // Active Sub-report info
  const currentSubReport = useMemo(() => {
    return template?.subReports.find(s => s.ssid === activeSsid)
  }, [template, activeSsid])

  // Filter records by search text
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records
    const term = searchTerm.toLowerCase().trim()
    return records.filter(r =>
      Object.values(r).some(val => String(val).toLowerCase().includes(term))
    )
  }, [records, searchTerm])

  // Derived Table Columns
  const tableColumns = useMemo(() => {
    if (filteredRecords.length === 0) return []
    const keys = new Set<string>()
    filteredRecords.forEach(r => Object.keys(r).forEach(k => keys.add(k)))
    return Array.from(keys)
  }, [filteredRecords])

  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // KPI Calculations
  const kpiData = useMemo(() => {
    let totalMoney = 0
    let totalVisits = 0
    let topFundName = '-'
    let topFundValue = 0

    filteredRecords.forEach(r => {
      // Find money field
      const moneyVal =
        parseFloat(r.BUDGET) ||
        parseFloat(r.ACT_AMT) ||
        parseFloat(r.BUDGET_UC) ||
        parseFloat(r.SUM_AMT) ||
        parseFloat(r.ACT_AMT_STM) ||
        0
      totalMoney += moneyVal

      // Find visits field
      const visitVal = parseInt(r.NUM_VISIT || r.VISIT || r.COUNT || 0, 10)
      totalVisits += isNaN(visitVal) ? 0 : visitVal

      // Find top item
      const itemName = r.DESCRIPTION || r.M_FUND_DESC || r.S_FUND_DESC || r.YEAR || r.MONTH_SEND
      if (itemName && moneyVal > topFundValue) {
        topFundValue = moneyVal
        topFundName = String(itemName)
      }
    })

    return { totalMoney, totalVisits, topFundName, topFundValue }
  }, [filteredRecords])

  // Excel Export Handler
  const handleExportExcel = async () => {
    await exportMisHosRecordsToExcel(
      filteredRecords,
      tableColumns,
      currentSubReport?.report_name || activeSubmenu.name,
      selectedYear,
      hcode,
      currentHospitalName
    )
  }

  return (
    <div className="bt-mishos-container">
      {/* ============================================================ */}
      {/* TOP FOCUS BANNER: Hospital Selector, Year Switcher & Refresh */}
      {/* ============================================================ */}
      <div className="bt-mishos-focus-banner">
        <div className="bt-mishos-banner-left">
          {/* Hospital Top Badges */}
          <div className="bt-mishos-badge-row">
            <span className="bt-mishos-pill-source">
              MIS HOS สปสช. (ส่วนกลาง)
            </span>
            <span className="bt-mishos-hosp-name">
              {currentHospitalName}
            </span>
            <span className="bt-mishos-hosp-code">
              รหัส: {isCustomHcode ? customHcode : hcode}
            </span>
            {hospitalInfo?.provinceName && (
              <span className="bt-mishos-hosp-meta">จ.{hospitalInfo.provinceName}</span>
            )}
            {hospitalInfo?.nhsoZone && (
              <span className="bt-mishos-hosp-meta">เขต {hospitalInfo.nhsoZone}</span>
            )}
          </div>

          {/* Preset Buttons for CUP Thoen & Input Toggle */}
          <div className="bt-mishos-selector-row">
            <label htmlFor="mishos-hosp-select" className="bt-mishos-selector-label">
              เลือกหน่วยบริการ:
            </label>
            <select
              id="mishos-hosp-select"
              value={isCustomHcode ? 'CUSTOM' : hcode}
              onChange={e => handleHospitalPresetChange(e.target.value)}
              className="bt-mishos-select"
            >
              {THOEN_NETWORK_PRESETS.map(p => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
              <option value="CUSTOM">-- ระบุรหัสหน่วยบริการอื่น --</option>
            </select>

            {isCustomHcode && (
              <div className="bt-mishos-custom-box">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="รหัส 5 หลัก"
                  value={customHcode}
                  onChange={e => setCustomHcode(e.target.value.replace(/\D/g, ''))}
                  className="bt-mishos-input-code"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomHcode}
                  className="bt-mishos-btn-search"
                >
                  ค้นหา
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Action: Fiscal Year & Force Refresh */}
        <div className="bt-mishos-banner-right">
          {/* Year Switcher */}
          <div className="bt-mishos-year-badge">
            <Calendar size={13} style={{ color: '#0284c7' }} />
            <span className="bt-mishos-year-label">ปีงบประมาณ:</span>
            <select
              value={selectedYear}
              onChange={e => handleYearChange(e.target.value)}
              className="bt-mishos-year-select"
              aria-label="เลือกปีงบประมาณ"
            >
              {AVAILABLE_YEARS.map(yr => (
                <option key={yr} value={yr}>
                  พ.ศ. {yr} {yr === AVAILABLE_YEARS[0] ? '(ปีงบล่าสุด)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleForceRefresh}
            disabled={loading}
            className="bt-mishos-refresh-btn"
            title="ข้ามแคชเพื่อดึงข้อมูลสดจาก MIS HOS สปสช."
          >
            <RefreshCw size={13} className={loading ? 'bt-spin' : ''} />
            <span>{loading ? 'กำลังโหลด...' : 'ดึงข้อมูลสด'}</span>
          </button>
        </div>
      </div>

      {/* Cache Status Bar */}
      <div className="bt-mishos-status-bar">
        <div className="bt-mishos-status-left">
          <span
            className={`bt-mishos-status-dot ${dataSource === 'cache' ? 'cache' : 'upstream'}`}
            aria-hidden="true"
          />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Database size={13} />
            แหล่งข้อมูล:{' '}
            <b style={{ color: dataSource === 'cache' ? '#059669' : '#0284c7' }}>
              {dataSource === 'cache'
                ? 'แคชในหน่วยความจำ (TTL 10 นาที)'
                : 'เชื่อมตรง Upstream สปสช.'}
            </b>
          </span>
          {lastUpdated && (
            <span suppressHydrationWarning>· อัปเดตล่าสุด: {lastUpdated}</span>
          )}
        </div>
        <div className="bt-mishos-status-right">
          พบข้อมูลทั้งหมด <b>{filteredRecords.length.toLocaleString('th-TH')}</b> แถว
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="bt-mishos-alert" role="alert">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* MAIN TWO-COLUMN LAYOUT: Sidebar (0-9) + Dynamic Report Panel */}
      {/* ============================================================ */}
      <div className="bt-mishos-layout">
        {/* ------------------------------------------------------------ */}
        {/* LEFT SIDEBAR: Accordion for 10 Main Categories (0 to 9)       */}
        {/* ------------------------------------------------------------ */}
        <aside className="bt-mishos-sidebar" aria-label="เมนูระบบ MIS HOS">
          <div className="bt-mishos-sidebar-header">
            <h2 className="bt-mishos-sidebar-title">
              <Folder size={15} style={{ color: '#0284c7' }} />
              <span>เมนูรายงาน MIS HOS</span>
            </h2>
            <span className="bt-mishos-sidebar-count">10 หมวด</span>
          </div>

          <div className="bt-mishos-sidebar-scroll">
            {MIS_HOS_MENU_CATEGORIES.map(category => {
              const isOpen = Boolean(openCategories[category.id])
              const isCatActive = activeCategory === category.id

              return (
                <div
                  key={category.id}
                  className={`bt-mishos-cat-group ${isOpen ? 'open' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`bt-mishos-cat-btn ${isCatActive ? 'active-cat' : ''}`}
                    aria-expanded={isOpen}
                  >
                    <span className="bt-mishos-cat-btn-inner">
                      <Layers size={13} style={{ color: isCatActive ? '#0284c7' : '#64748b', flexShrink: 0 }} />
                      <span className="bt-mishos-cat-title-text">{category.title}</span>
                    </span>
                    <ChevronRight
                      size={14}
                      className={`bt-mishos-chevron ${isOpen ? 'expanded' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="bt-mishos-submenu-list">
                      {category.submenus.map(sub => {
                        const isSelected =
                          activeCategory === category.id && activeSubmenu.id === sub.id

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelectSubmenu(category, sub)}
                            className={`bt-mishos-sub-btn ${isSelected ? 'active' : ''}`}
                          >
                            <span>{sub.name}</span>
                            <span className="bt-mishos-sub-btn-id">
                              #{sub.stId}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT MAIN PANEL: Sub-report Tabs, KPIs, Chart & Table       */}
        {/* ------------------------------------------------------------ */}
        <main className="bt-mishos-main-panel">
          {/* Active Submenu Header Card */}
          <div className="bt-mishos-header-card">
            <div>
              <div className="bt-mishos-header-category">
                หมวดหมู่: {MIS_HOS_MENU_CATEGORIES.find(c => c.id === activeCategory)?.title}
              </div>
              <h2 className="bt-mishos-header-title">
                <span>{activeSubmenu.name}</span>
                <span className="bt-mishos-header-stid">
                  ST-ID: {activeSubmenu.stId}
                </span>
              </h2>
            </div>

            {/* Sub-report selector tabs if template has multiple sub-reports */}
            {template && template.subReports.length > 1 && (
              <div className="bt-mishos-subreport-tabs" role="tablist" aria-label="รายงานย่อย">
                {template.subReports.map(sub => {
                  const isSubActive = sub.ssid === activeSsid
                  return (
                    <button
                      key={sub.ssid}
                      type="button"
                      role="tab"
                      aria-selected={isSubActive}
                      onClick={() => handleSelectSubReport(sub)}
                      className={`bt-mishos-subreport-tab ${isSubActive ? 'active' : ''}`}
                    >
                      <span>{sub.report_name}</span>
                      <span className="bt-mishos-subreport-tab-ssid">#{sub.ssid}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* 4 SUMMARY KPI CARDS (Restrained Hospital Palette)           */}
          {/* ========================================================== */}
          <div className="bt-mishos-kpi-grid">
            {/* Card 1: Total Money */}
            <div className="bt-mishos-kpi-card bt-mishos-kpi-card-blue">
              <div className="bt-mishos-kpi-top">
                <div>
                  <div className="bt-mishos-kpi-label">ยอดเงินรวมตามรายงาน</div>
                  <div className="bt-mishos-kpi-value bt-mishos-kpi-value-blue">
                    {kpiData.totalMoney > 0
                      ? kpiData.totalMoney.toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : '-'}
                  </div>
                </div>
                <div className="bt-mishos-kpi-icon bt-mishos-kpi-icon-blue">
                  <Receipt size={17} />
                </div>
              </div>
              <div className="bt-mishos-kpi-footer">
                <span>
                  {kpiData.totalMoney > 1000000
                    ? `~${(kpiData.totalMoney / 1000000).toFixed(2)} ล้านบาท`
                    : 'ตามสกุลเงินบาท'}
                </span>
              </div>
            </div>

            {/* Card 2: Transactions / Records count */}
            <div className="bt-mishos-kpi-card bt-mishos-kpi-card-slate">
              <div className="bt-mishos-kpi-top">
                <div>
                  <div className="bt-mishos-kpi-label">จำนวนแถวข้อมูล</div>
                  <div className="bt-mishos-kpi-value">
                    {filteredRecords.length.toLocaleString('th-TH')}
                  </div>
                </div>
                <div className="bt-mishos-kpi-icon bt-mishos-kpi-icon-slate">
                  <FileSpreadsheet size={17} />
                </div>
              </div>
              <div className="bt-mishos-kpi-footer">
                <span>
                  {kpiData.totalVisits > 0
                    ? `รับบริการ ${kpiData.totalVisits.toLocaleString('th-TH')} ครั้ง`
                    : 'รายการผลงานทั้งหมด'}
                </span>
              </div>
            </div>

            {/* Card 3: Top Item / Category */}
            <div className="bt-mishos-kpi-card bt-mishos-kpi-card-emerald">
              <div className="bt-mishos-kpi-top">
                <div>
                  <div className="bt-mishos-kpi-label">รายการ/กองทุนสูงสุด</div>
                  <div
                    className="bt-mishos-kpi-value bt-mishos-kpi-value-emerald"
                    style={{
                      fontSize: '0.95rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px',
                    }}
                    title={kpiData.topFundName}
                  >
                    {kpiData.topFundName}
                  </div>
                </div>
                <div className="bt-mishos-kpi-icon bt-mishos-kpi-icon-emerald">
                  <TrendingUp size={17} />
                </div>
              </div>
              <div className="bt-mishos-kpi-footer">
                <span>
                  {kpiData.topFundValue > 0
                    ? `${kpiData.topFundValue.toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                      })} บาท`
                    : 'สัดส่วนงบประมาณ'}
                </span>
              </div>
            </div>

            {/* Card 4: Report ID & Engine Status */}
            <div className="bt-mishos-kpi-card bt-mishos-kpi-card-navy">
              <div className="bt-mishos-kpi-top">
                <div>
                  <div className="bt-mishos-kpi-label">รหัสรายงาน (SSID)</div>
                  <div className="bt-mishos-kpi-value">
                    #{activeSsid}
                  </div>
                </div>
                <div className="bt-mishos-kpi-icon bt-mishos-kpi-icon-navy">
                  <Database size={17} />
                </div>
              </div>
              <div className="bt-mishos-kpi-footer">
                <span>ปีงบ {selectedYear} · SimpleStudio Engine</span>
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* INTERACTIVE CHART PANEL                                    */}
          {/* ========================================================== */}
          <MisHosChart
            records={records}
            reportTitle={currentSubReport?.report_name || activeSubmenu.name}
            chartType={currentSubReport?.chart_type}
          />

          {/* ========================================================== */}
          {/* SEARCH, FILTER & EXCEL EXPORT BAR                          */}
          {/* ========================================================== */}
          <div className="bt-mishos-toolbar">
            {/* Search Input */}
            <div className="bt-mishos-search-box">
              <Search size={14} className="bt-mishos-search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                  setPageInput('1')
                }}
                placeholder="ค้นหาข้อมูลในตาราง..."
                className="bt-mishos-search-input"
                aria-label="ค้นหาข้อมูลในตาราง"
              />
            </div>

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="bt-mishos-btn-excel"
            >
              <Download size={14} />
              <span>ส่งออก Excel (.xlsx)</span>
            </button>
          </div>

          {/* ========================================================== */}
          {/* DYNAMIC DATA TABLE & PAGINATION (No Overflow Bugs!)        */}
          {/* ========================================================== */}
          <div className="bt-mishos-table-card">
            <div className="bt-mishos-table-scroll">
              <table className="bt-mishos-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>ลำดับ</th>
                    {tableColumns.map(col => (
                      <th key={col}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tableColumns.length + 1 || 1}
                        className="bt-mishos-empty-row"
                      >
                        {loading ? 'กำลังดึงข้อมูลจากระบบ MIS HOS...' : 'ไม่พบรายการข้อมูล'}
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((row, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1
                      return (
                        <tr key={idx}>
                          <td className="bt-mishos-col-seq">
                            {rowNum}
                          </td>
                          {tableColumns.map(col => {
                            const val = row[col]
                            const upperCol = col.toUpperCase()
                            const isCodeOrYear =
                              upperCol.includes('YEAR') ||
                              upperCol.includes('CODE') ||
                              upperCol.includes('CD') ||
                              upperCol.includes('ID') ||
                              upperCol.includes('DATE') ||
                              upperCol.includes('MONTH')

                            const num = Number(val)
                            const isNumeric =
                              !isCodeOrYear &&
                              !isNaN(num) &&
                              typeof val === 'string' &&
                              val.trim() !== '' &&
                              !val.startsWith('0') &&
                              val.length < 15

                            const cellClass = isNumeric
                              ? 'bt-mishos-col-num'
                              : isCodeOrYear
                              ? 'bt-mishos-col-code'
                              : 'bt-mishos-col-text'

                            return (
                              <td key={col} className={cellClass}>
                                {isNumeric
                                  ? num.toLocaleString('th-TH', {
                                      minimumFractionDigits: val.includes('.') ? 2 : 0,
                                      maximumFractionDigits: 2,
                                    })
                                  : val ?? '-'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bt-mishos-pagination">
                <span className="bt-mishos-page-info">
                  หน้า <b>{currentPage}</b> จาก <b>{totalPages}</b> (รวม{' '}
                  <b>{filteredRecords.length}</b> รายการ)
                </span>

                <div className="bt-mishos-page-controls">
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.max(1, currentPage - 1)
                      setCurrentPage(p)
                      setPageInput(String(p))
                    }}
                    disabled={currentPage === 1}
                    className="bt-mishos-btn-page"
                  >
                    ก่อนหน้า
                  </button>

                  <div className="bt-mishos-page-input-box">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={e => setPageInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const p = parseInt(pageInput, 10)
                          if (!isNaN(p)) {
                            const valid = Math.max(1, Math.min(totalPages, p))
                            setCurrentPage(valid)
                            setPageInput(String(valid))
                          }
                        }
                      }}
                      className="bt-mishos-input-page"
                      aria-label="เปลี่ยนหมายเลขหน้า"
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ {totalPages}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.min(totalPages, currentPage + 1)
                      setCurrentPage(p)
                      setPageInput(String(p))
                    }}
                    disabled={currentPage === totalPages}
                    className="bt-mishos-btn-page"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
