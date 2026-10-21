'use client'

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react'
import {
  Building2,
  Calendar,
  RefreshCw,
  Search,
  Download,
  Database,
  ChevronRight,
  Folder,
  Layers,
  AlertCircle,
  BarChart3,
  Loader2,
} from 'lucide-react'
import {
  MisHosCategory,
  MisHosSubmenu,
  MisHosSubReport,
  MisHosTemplateConfig,
  MisHosTableDataResult,
  MisHosHospitalInfo,
  MisHosChartConfig,
  MIS_HOS_MENU_CATEGORIES,
  THOEN_HOSPITAL_CODE,
  calculateThaiFiscalYear,
  getAvailableMisHosFiscalYears,
} from '@/lib/budget/misHosService'
import MisHosSubReportCard from './components/MisHosSubReportCard'
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

interface SubReportState {
  records: Record<string, any>[]
  chartConfig?: MisHosChartConfig | null
  loading: boolean
  error?: string
}

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
  const [subReportsData, setSubReportsData] = useState<Record<string, SubReportState>>(() => {
    const map: Record<string, SubReportState> = {}
    if (initialTemplate?.subReports) {
      initialTemplate.subReports.forEach(sub => {
        if (initialTableData && sub.ssid === initialTableData.ssid) {
          map[sub.ssid] = {
            records: initialTableData.records || [],
            chartConfig: initialTableData.chartConfig,
            loading: false,
          }
        } else {
          map[sub.ssid] = {
            records: [],
            loading: false,
          }
        }
      })
    }
    return map
  })

  const [dataSource, setDataSource] = useState<string>(initialTableData?.source || 'upstream')
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [globalLoading, setGlobalLoading] = useState<boolean>(false)
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

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

  // Fetch all sub-reports data in parallel for a given template
  const loadSubReportsData = useCallback(
    async (
      tpl: MisHosTemplateConfig,
      targetHcode: string,
      targetYear: string,
      force: boolean = false,
      targetProvince?: string,
      targetProvinceName?: string
    ) => {
      const activeSubs = tpl.subReports.filter(s => s.flag_data !== 'N')
      if (activeSubs.length === 0) return

      // Set loading state for all subreports
      setSubReportsData(prev => {
        const next = { ...prev }
        activeSubs.forEach(s => {
          next[s.ssid] = {
            records: prev[s.ssid]?.records || [],
            chartConfig: prev[s.ssid]?.chartConfig,
            loading: true,
          }
        })
        return next
      })

      try {
        const ssids = activeSubs.map(s => s.ssid)
        const res = await fetch('/api/budget/mishos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getBatchTableData',
            ssids,
            hcode: targetHcode,
            year: targetYear,
            province: targetProvince || hospitalInfo?.provinceId || '52',
            provinceName: targetProvinceName || hospitalInfo?.provinceName || 'ลำปาง',
            forceRefresh: force,
          }),
        })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const newMap: Record<string, SubReportState> = {}
          let sourceVal = 'upstream'
          let fetchedAtVal = ''

          json.data.forEach((item: MisHosTableDataResult) => {
            newMap[item.ssid] = {
              records: item.records || [],
              chartConfig: item.chartConfig,
              loading: false,
            }
            if (item.source) sourceVal = item.source
            if (item.fetchedAt) fetchedAtVal = item.fetchedAt
          })

          setSubReportsData(prev => ({ ...prev, ...newMap }))
          setDataSource(sourceVal)
          if (fetchedAtVal) {
            setLastUpdated(new Date(fetchedAtVal).toLocaleTimeString('th-TH'))
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลตาราง'
        setErrorMsg(msg)
      } finally {
        setSubReportsData(prev => {
          const next = { ...prev }
          activeSubs.forEach(s => {
            if (next[s.ssid]?.loading) {
              next[s.ssid] = { ...next[s.ssid], loading: false }
            }
          })
          return next
        })
      }
    },
    []
  )

  // Fetch remaining initial sub-reports on initial mount if needed
  useEffect(() => {
    if (initialTemplate) {
      const activeSubs = initialTemplate.subReports.filter(s => s.flag_data !== 'N')
      const remainingSubs = activeSubs.filter(s => s.ssid !== initialTableData?.ssid)
      if (remainingSubs.length > 0) {
        const ssids = remainingSubs.map(s => s.ssid)
        fetch('/api/budget/mishos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getBatchTableData',
            ssids,
            hcode,
            year: selectedYear,
          }),
        })
          .then(res => res.json())
          .then(json => {
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
              const newMap: Record<string, SubReportState> = {}
              json.data.forEach((item: MisHosTableDataResult) => {
                newMap[item.ssid] = {
                  records: item.records || [],
                  chartConfig: item.chartConfig,
                  loading: false,
                }
              })
              setSubReportsData(prev => ({ ...prev, ...newMap }))
            }
          })
          .catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle Category in Sidebar Accordion
  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }))
  }

  // Load Submenu Template & All Sub-Reports
  const handleSelectSubmenu = async (
    category: MisHosCategory,
    submenu: MisHosSubmenu
  ) => {
    setActiveCategory(category.id)
    setActiveSubmenu(submenu)
    setErrorMsg('')
    setGlobalLoading(true)
    setIsTemplateLoading(true)

    try {
      // 1. Fetch template (supporting secondaryStId fallback)
      const tplRes = await fetch('/api/budget/mishos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTemplate',
          stId: submenu.stId,
          secondaryStId: submenu.secondaryStId,
          hcode,
          year: selectedYear,
        }),
      })
      const tplJson = await tplRes.json()
      const tpl: MisHosTemplateConfig | null = tplJson.success ? tplJson.data : null
      setTemplate(tpl)
      setIsTemplateLoading(false)

      // 2. Fetch all sub-reports in parallel
      if (tpl && tpl.subReports.length > 0) {
        await loadSubReportsData(
          tpl,
          hcode,
          selectedYear,
          false,
          hospitalInfo?.provinceId,
          hospitalInfo?.provinceName
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลรายงานได้'
      setErrorMsg(msg)
      setIsTemplateLoading(false)
    } finally {
      setGlobalLoading(false)
      setIsTemplateLoading(false)
    }
  }

  // Force Refresh current reports
  const handleForceRefresh = () => {
    if (template) {
      loadSubReportsData(template, hcode, selectedYear, true)
    }
  }

  // Switch Year handler
  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear)
    if (template) {
      loadSubReportsData(template, hcode, newYear, true)
    }
  }

  // Switch Hospital preset handler
  const handleHospitalPresetChange = (code: string) => {
    if (code === 'CUSTOM') {
      setIsCustomHcode(true)
    } else {
      setIsCustomHcode(false)
      setHcode(code)
      if (template) {
        loadSubReportsData(template, code, selectedYear, true)
      }
    }
  }

  // Apply custom hospital search
  const handleApplyCustomHcode = () => {
    if (customHcode.trim().length === 5) {
      const code = customHcode.trim()
      setHcode(code)
      if (template) {
        loadSubReportsData(template, code, selectedYear, true)
      }
    }
  }

  // Active sub-reports list (MIS HOS Module 381: "" !== e.ssid && "Y" === e.flag_data)
  const activeSubReports = useMemo(() => {
    if (!template?.subReports) return []
    return template.subReports.filter(s => s.flag_data === 'Y' && Boolean(s.ssid))
  }, [template])

  // Total records count across all sub-reports
  const totalRecordsCount = useMemo(() => {
    let count = 0
    Object.values(subReportsData).forEach(s => {
      count += s.records?.length || 0
    })
    return count
  }, [subReportsData])

  // For testing compatibility: first table sub-report records
  const primaryTableRecords = useMemo(() => {
    const tableSub = activeSubReports.find(s => s.chart_type === 'table') || activeSubReports[0]
    return tableSub ? subReportsData[tableSub.ssid]?.records || [] : []
  }, [activeSubReports, subReportsData])

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
              <span className="bt-mishos-hosp-meta">
                สปสช. เขต {hospitalInfo.nhsoZone} {hospitalInfo.nhsoName ? `(${hospitalInfo.nhsoName})` : ''}
              </span>
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
                  พ.ศ. {yr} {yr === AVAILABLE_YEARS[0] ? '(ปีงบปัจจุบัน)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleForceRefresh}
            disabled={globalLoading}
            className="bt-mishos-refresh-btn"
            title="ข้ามแคชเพื่อดึงข้อมูลสดจาก MIS HOS สปสช."
          >
            <RefreshCw size={13} className={globalLoading ? 'bt-spin' : ''} />
            <span>{globalLoading ? 'กำลังโหลด...' : 'ดึงข้อมูลสด'}</span>
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
          พร้อมแสดงผล <b>{activeSubReports.length}</b> รายงานย่อย (รวม{' '}
          <b>{totalRecordsCount.toLocaleString('th-TH')}</b> แถว)
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
      {/* MAIN TWO-COLUMN LAYOUT: Sidebar (0-9) + Multi-Card Grid      */}
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
        {/* RIGHT MAIN PANEL: Module 381 Faithful Multi-Card Layout      */}
        {/* ------------------------------------------------------------ */}
        <main className="bt-mishos-main-panel">
          {/* Top Template Header Banner matching Module 381 */}
          <div className="bt-mishos-header-card">
            <div>
              <div className="bt-mishos-header-category">
                หมวดหมู่: {MIS_HOS_MENU_CATEGORIES.find(c => c.id === activeCategory)?.title}
              </div>
              <h2 className="bt-mishos-header-title">
                <BarChart3 size={20} style={{ color: '#0284c7' }} />
                <span>{template?.templateName || activeSubmenu.name}</span>
                <span className="bt-mishos-header-stid">
                  ST-ID: {activeSubmenu.stId}
                </span>
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
                หน่วยบริการ: {hcode} {currentHospitalName} จ.{hospitalInfo?.provinceName || 'ลำปาง'}
                {hospitalInfo?.nhsoZone ? ` (เขต ${hospitalInfo.nhsoZone})` : ''}
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* MULTI-CARD DASHBOARD GRID (Faithful to MIS HOS Module 381) */}
          {/* ========================================================== */}
          <div className="bt-mishos-multicard-grid">
            {isTemplateLoading ? (
              <>
                <div className="bt-mishos-subcard-wrap bt-mishos-col-6">
                  <div
                    className="bt-mishos-subcard"
                    style={{
                      minHeight: '260px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      background: '#ffffff',
                    }}
                  >
                    <Loader2 size={26} className="bt-spin" style={{ color: '#0284c7' }} />
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      กำลังเชื่อมต่อเทมเพลตรายงาน สปสช...
                    </span>
                  </div>
                </div>
                <div className="bt-mishos-subcard-wrap bt-mishos-col-6">
                  <div
                    className="bt-mishos-subcard"
                    style={{
                      minHeight: '260px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      background: '#ffffff',
                    }}
                  >
                    <Loader2 size={26} className="bt-spin" style={{ color: '#0f766e' }} />
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      กำลังจัดเตรียมแผนภาพและตารางข้อมูล...
                    </span>
                  </div>
                </div>
              </>
            ) : activeSubReports.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <AlertCircle size={32} style={{ color: '#0284c7' }} />
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>
                  ไม่พบรายการรายงานย่อยสำหรับหัวข้อนี้
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  หัวข้อนี้ยังไม่มีรายงานย่อยที่กำหนดไว้สำหรับปีงบประมาณ พ.ศ. {selectedYear}
                </div>
              </div>
            ) : (
              activeSubReports.map(sub => {
                const subState = subReportsData[sub.ssid] || {
                  records: [],
                  loading: false,
                  error: undefined,
                }

                return (
                  <MisHosSubReportCard
                    key={sub.ssid}
                    subReport={sub}
                    records={subState.records}
                    chartConfig={subState.chartConfig}
                    loading={subState.loading || globalLoading}
                    error={subState.error}
                    selectedYear={selectedYear}
                    hcode={hcode}
                    hname={currentHospitalName}
                  />
                )
              })
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
