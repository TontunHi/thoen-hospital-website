'use client'

import React, { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { usePolling } from '@/hooks/usePolling'
import { exportMismatchToExcel } from './exportMismatchExcel'
import {
  filterAndSortMismatches,
  formatThaiShortDate,
  getDaysUntilDate,
  getUrgencyMeta,
  normalizeDepartmentLabel,
  normalizeUserLabel,
  summarizeMismatches,
  type AppointmentMismatchResponse,
  type BreakdownMode,
  type SortOption,
  type UrgencyFilter,
} from './mismatchUtils'
import './page.css'

function LoadingView() {
  return (
    <div className="mismatchPage">
      <div className="mismatchContainer">
        <div className="mismatchTopBar">
          <Link href="/service" className="mismatchBackLink">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>กลับสู่ระบบงานภายใน</span>
          </Link>
        </div>

        <header className="mismatchHeader">
          <div className="mismatchTitleBlock">
            <h1 className="mismatchTitle">รายการนัดผิดห้องตรวจ</h1>
            <p className="mismatchSubtitle">กำลังโหลดข้อมูลรายการนัดหมายจากระบบโรงพยาบาล</p>
          </div>
        </header>

        <div className="mismatchOverviewGrid" aria-busy="true" aria-label="กำลังโหลดข้อมูล">
          <div className="mismatchStatsColumn">
            <div className="mismatchSkeletonCard">
              <div className="mismatchSkeletonBar mismatchSkeletonBar--sm" />
              <div className="mismatchSkeletonBar mismatchSkeletonBar--lg" />
              <div className="mismatchSkeletonBar" />
            </div>
            <div className="mismatchSkeletonCard">
              <div className="mismatchSkeletonBar mismatchSkeletonBar--sm" />
              <div className="mismatchSkeletonBar mismatchSkeletonBar--lg" />
              <div className="mismatchSkeletonBar" />
            </div>
            <div className="mismatchSkeletonCard">
              <div className="mismatchSkeletonBar mismatchSkeletonBar--sm" />
              <div className="mismatchSkeletonBar mismatchSkeletonBar--lg" />
              <div className="mismatchSkeletonBar" />
            </div>
          </div>
          <div className="mismatchSkeletonCard">
            <div className="mismatchSkeletonBar mismatchSkeletonBar--sm" />
            <div className="mismatchSkeletonBar" />
            <div className="mismatchSkeletonBar" />
            <div className="mismatchSkeletonBar" />
          </div>
        </div>

        <div className="mismatchSkeletonCard">
          <div className="mismatchSkeletonBar" />
          <div className="mismatchSkeletonBar" />
          <div className="mismatchSkeletonBar" />
          <div className="mismatchSkeletonBar" />
        </div>
      </div>
    </div>
  )
}

export default function AppointmentMismatchClient() {
  const [data, setData] = useState<AppointmentMismatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('nextdate_asc')
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('department')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const res = await fetch('/api/service/appointment-mismatch', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        setData(json.data)
        setError('')
      } else {
        setError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการนัดผิดห้องตรวจ')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อระบบข้อมูลการนัดหมายได้ชั่วคราว')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const { lastUpdated, refresh } = usePolling(fetchData, 30000)

  const mismatches = useMemo(() => data?.mismatches ?? [], [data])

  const summary = useMemo(() => summarizeMismatches(mismatches), [mismatches])

  const departmentOptions = useMemo(() => {
    const set = new Set<string>()
    for (const item of mismatches) {
      set.add(normalizeDepartmentLabel(item.department))
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [mismatches])

  const filteredMismatches = useMemo(
    () =>
      filterAndSortMismatches(mismatches, {
        searchQuery,
        urgencyFilter,
        departmentFilter,
        userFilter,
        sortBy,
      }),
    [mismatches, searchQuery, urgencyFilter, departmentFilter, userFilter, sortBy]
  )

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    urgencyFilter !== 'all' ||
    departmentFilter !== 'all' ||
    userFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setUrgencyFilter('all')
    setDepartmentFilter('all')
    setUserFilter('all')
  }

  const handleCopyHn = async (hn: string, rowKey: string) => {
    if (!hn) return
    try {
      await navigator.clipboard?.writeText(hn)
      setCopiedKey(rowKey)
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === rowKey ? null : prev))
      }, 1500)
    } catch {
      // Clipboard may be blocked in non-HTTPS contexts
    }
  }

  const handleExportExcel = async () => {
    if (filteredMismatches.length === 0 || isExporting) return
    try {
      setIsExporting(true)
      await exportMismatchToExcel(filteredMismatches)
    } catch {
      setError('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleBreakdownSelect = (name: string) => {
    if (breakdownMode === 'department') {
      setDepartmentFilter((prev) => (prev === name ? 'all' : name))
    } else {
      setUserFilter((prev) => (prev === name ? 'all' : name))
    }
  }

  if (loading && !data) {
    return <LoadingView />
  }

  const totalCount = summary.total
  const activeBreakdown =
    breakdownMode === 'department' ? summary.departmentBreakdown : summary.userBreakdown

  return (
    <div className="mismatchPage">
      <div className="mismatchContainer">
        {/* Top utility bar */}
        <div className="mismatchTopBar">
          <Link href="/service" className="mismatchBackLink">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>กลับสู่ระบบงานภายใน</span>
          </Link>

          <div className="mismatchLiveStatus">
            <span
              className={`mismatchLiveDot ${error ? 'mismatchLiveDot--error' : ''}`}
              aria-hidden="true"
            />
            <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>
              อัปเดตล่าสุด:{' '}
              <span className="mismatchLiveTime mismatchTabular" suppressHydrationWarning>
                {lastUpdated
                  ? `${lastUpdated.toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })} น.`
                  : 'กำลังเชื่อมต่อ'}
              </span>
            </span>
          </div>
        </div>

        {/* Page header */}
        <header className="mismatchHeader">
          <div className="mismatchTitleBlock">
            <h1 className="mismatchTitle">รายการนัดผิดห้องตรวจ</h1>
            <p className="mismatchSubtitle">
              ติดตามนัดหมายที่ระบุห้องตรวจไม่ตรงจุดซักประวัติ เพื่อป้องกันผู้ป่วยติดค้างหน้าเครื่องส่งตรวจอัตโนมัติ
            </p>
          </div>

          <div className="mismatchHeaderActions">
            {filteredMismatches.length > 0 && (
              <button
                type="button"
                className="mismatchBtn"
                onClick={handleExportExcel}
                disabled={isExporting}
                title="ส่งออกรายการที่แสดงเป็นไฟล์ Excel (.xlsx)"
              >
                <FileSpreadsheet size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
              </button>
            )}

            <button
              type="button"
              className="mismatchBtn mismatchBtnPrimary"
              onClick={refresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                size={16}
                strokeWidth={1.5}
                className={isRefreshing ? 'mismatchSpin' : ''}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'}</span>
            </button>
          </div>
        </header>

        {/* Error banner (never hide API errors as empty state) */}
        {error && (
          <div className="mismatchErrorBanner" role="alert">
            <span className="mismatchErrorMessage">
              <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>{error}</span>
            </span>
            <button type="button" className="mismatchResetBtn" onClick={refresh}>
              <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>ลองใหม่</span>
            </button>
          </div>
        )}

        {/* Guidance strip */}
        <section
          className={`mismatchGuideStrip ${totalCount === 0 && !error ? 'mismatchGuideStrip--clear' : ''}`}
          aria-label="แนวทางแก้ไขใน HOSxP"
        >
          {totalCount === 0 && !error ? (
            <CheckCircle2 size={20} strokeWidth={1.5} className="mismatchGuideIcon" aria-hidden="true" />
          ) : (
            <AlertTriangle size={20} strokeWidth={1.5} className="mismatchGuideIcon" aria-hidden="true" />
          )}
          <div className="mismatchGuideBody">
            <p className="mismatchGuideTitle">
              {totalCount === 0 && !error
                ? 'รายการนัดหมายพร้อมรองรับเครื่องส่งตรวจอัตโนมัติ'
                : 'การนัดผิดห้องตรวจจะทำให้ผู้ป่วยใช้เครื่องส่งตรวจอัตโนมัติไม่ได้'}
            </p>
            <p className="mismatchGuideText">
              {totalCount === 0 && !error
                ? 'ข้อมูลปัจจุบันไม่พบการนัดไปยังห้องตรวจที่ปิดใช้งาน ระบบตรวจสอบอัตโนมัติทุก 30 วินาที'
                : 'กรุณาแก้ไขห้องตรวจปลายทางใน HOSxP ให้เป็นจุดซักประวัติของแต่ละแผนก รายการที่แก้ไขถูกต้องแล้วจะหายไปจากหน้านี้โดยอัตโนมัติ'}
            </p>
          </div>
        </section>

        {/* Summary & Breakdown */}
        {!error && (
          <section className="mismatchOverviewGrid" aria-label="สรุปภาพรวมรายการนัดผิดห้องตรวจ">
            <div className="mismatchStatsColumn">
              <div className="mismatchCard mismatchStatCard">
                <span className="mismatchStatLabel">รายการนัดผิดทั้งหมด</span>
                <div
                  className={`mismatchStatFigure mismatchTabular ${
                    totalCount === 0 ? 'mismatchStatFigure--success' : ''
                  }`}
                >
                  {totalCount}
                </div>
                <span className="mismatchStatMeta mismatchTabular">
                  ครอบคลุม {summary.uniqueDepartments} ห้องตรวจ
                </span>
              </div>

              <div
                className={`mismatchCard mismatchStatCard ${
                  summary.urgent7Count > 0 ? 'mismatchStatCard--urgent' : ''
                }`}
              >
                <span className="mismatchStatLabel">นัดภายใน 7 วัน</span>
                <div
                  className={`mismatchStatFigure mismatchTabular ${
                    summary.tomorrowCount > 0
                      ? 'mismatchStatFigure--danger'
                      : summary.urgent7Count > 0
                        ? 'mismatchStatFigure--warning'
                        : ''
                  }`}
                >
                  {summary.urgent7Count}
                </div>
                <span className="mismatchStatMeta mismatchTabular">
                  พรุ่งนี้หรือวันนี้ {summary.tomorrowCount} รายการ
                </span>
              </div>

              <div className="mismatchCard mismatchStatCard">
                <span className="mismatchStatLabel">ผู้ทำรายการนัดที่ต้องแจ้งแก้ไข</span>
                <div className="mismatchStatFigure mismatchTabular">{summary.uniqueUsers}</div>
                <span className="mismatchStatMeta mismatchTabular">
                  จากทั้งหมด {totalCount} รายการ
                </span>
              </div>
            </div>

            <div className="mismatchCard mismatchBreakdownCard">
              <div className="mismatchBreakdownHeader">
                <h2 className="mismatchBreakdownTitle">
                  {breakdownMode === 'department'
                    ? 'ห้องตรวจที่พบมากที่สุด'
                    : 'ผู้นัดที่พบรายการมากที่สุด'}
                </h2>
                <div className="mismatchSegmentedSmall" role="tablist" aria-label="มุมมองสรุป">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={breakdownMode === 'department'}
                    className={`mismatchSegmentBtn ${
                      breakdownMode === 'department' ? 'mismatchSegmentBtn--active' : ''
                    }`}
                    onClick={() => setBreakdownMode('department')}
                  >
                    แยกตามห้องตรวจ
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={breakdownMode === 'user'}
                    className={`mismatchSegmentBtn ${
                      breakdownMode === 'user' ? 'mismatchSegmentBtn--active' : ''
                    }`}
                    onClick={() => setBreakdownMode('user')}
                  >
                    แยกตามผู้นัด
                  </button>
                </div>
              </div>

              {activeBreakdown.length === 0 ? (
                <p className="mismatchMutedText">ยังไม่มีรายการผิดปกติสำหรับจัดอันดับ</p>
              ) : (
                <div className="mismatchBreakdownList">
                  {activeBreakdown.map((entry) => {
                    const isSelected =
                      breakdownMode === 'department'
                        ? departmentFilter === entry.name
                        : userFilter === entry.name
                    return (
                      <button
                        key={entry.name}
                        type="button"
                        className={`mismatchBreakdownItem ${
                          isSelected ? 'mismatchBreakdownItem--selected' : ''
                        }`}
                        onClick={() => handleBreakdownSelect(entry.name)}
                        title="คลิกเพื่อกรองรายการตามหัวข้อนี้"
                      >
                        <div className="mismatchBreakdownRowTop">
                          <span className="mismatchBreakdownName">{entry.name}</span>
                          <span className="mismatchBreakdownCount mismatchTabular">
                            {entry.count} ({entry.percent}%)
                          </span>
                        </div>
                        <div className="mismatchBarTrack" aria-hidden="true">
                          <div
                            className="mismatchBarFill"
                            style={{ transform: `scaleX(${Math.max(entry.percent, 4) / 100})` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Filter & Search Toolbar (only when there are mismatches) */}
        {totalCount > 0 && (
          <section className="mismatchToolbar" aria-label="ค้นหาและกรองรายการ">
            <div className="mismatchToolbarRow">
              <div className="mismatchFilterTabs" role="group" aria-label="ตัวกรองความเร่งด่วน">
                <button
                  type="button"
                  className={`mismatchFilterTab ${
                    urgencyFilter === 'all' ? 'mismatchFilterTab--active' : ''
                  }`}
                  onClick={() => setUrgencyFilter('all')}
                >
                  <span>ทั้งหมด</span>
                  <span className="mismatchTabular">({summary.total})</span>
                </button>
                <button
                  type="button"
                  className={`mismatchFilterTab ${
                    urgencyFilter === 'urgent7' ? 'mismatchFilterTab--active' : ''
                  }`}
                  onClick={() => setUrgencyFilter('urgent7')}
                >
                  <span>ภายใน 7 วัน</span>
                  <span className="mismatchTabular">({summary.urgent7Count})</span>
                </button>
                <button
                  type="button"
                  className={`mismatchFilterTab ${
                    urgencyFilter === 'tomorrow' ? 'mismatchFilterTab--active' : ''
                  }`}
                  onClick={() => setUrgencyFilter('tomorrow')}
                >
                  <span>พรุ่งนี้ / เร่งด่วน</span>
                  <span className="mismatchTabular">({summary.tomorrowCount})</span>
                </button>
              </div>

              <div className="mismatchFilterControls">
                <div className="mismatchSearchWrap">
                  <Search
                    size={16}
                    strokeWidth={1.5}
                    className="mismatchSearchIcon"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    className="mismatchSearchInput"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหา HN, ห้องตรวจ หรือผู้นัด"
                    aria-label="ค้นหา HN ห้องตรวจ หรือผู้นัด"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="mismatchSearchClear"
                      onClick={() => setSearchQuery('')}
                      aria-label="ล้างคำค้นหา"
                    >
                      <X size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <select
                  className="mismatchSelect"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  aria-label="กรองตามห้องตรวจที่ระบุผิด"
                >
                  <option value="all">ทุกห้องตรวจ</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                <select
                  className="mismatchSelect"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="เรียงลำดับรายการ"
                >
                  <option value="nextdate_asc">วันนัดใกล้สุดก่อน</option>
                  <option value="user_asc">เรียงตามชื่อผู้นัด</option>
                  <option value="dept_asc">เรียงตามห้องตรวจ</option>
                  <option value="vstdate_desc">วันที่มารับบริการล่าสุด</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mismatchActiveChips">
                <span className="mismatchTabular">
                  แสดง {filteredMismatches.length} จาก {totalCount} รายการ
                  {userFilter !== 'all' ? ` · ผู้นัด: ${userFilter}` : ''}
                </span>
                <button type="button" className="mismatchResetBtn" onClick={resetFilters}>
                  <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>ล้างตัวกรอง</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* Success empty state (0 mismatches total) */}
        {!error && totalCount === 0 && (
          <div className="mismatchEmptyCard">
            <CheckCircle2
              size={24}
              strokeWidth={1.5}
              className="mismatchEmptyIcon--success"
              aria-hidden="true"
            />
            <h2 className="mismatchEmptyTitle">ไม่มีรายการนัดที่ผิดห้องตรวจ</h2>
            <p className="mismatchEmptyDesc">
              รายการนัดหมายทั้งหมดในระบบระบุจุดซักประวัติถูกต้อง สามารถใช้งานเครื่องส่งตรวจอัตโนมัติได้ตามปกติ
            </p>
          </div>
        )}

        {/* Filtered empty state */}
        {totalCount > 0 && filteredMismatches.length === 0 && (
          <div className="mismatchEmptyCard">
            <Search
              size={24}
              strokeWidth={1.5}
              className="mismatchEmptyIcon--neutral"
              aria-hidden="true"
            />
            <h2 className="mismatchEmptyTitle">ไม่พบรายการที่ตรงกับเงื่อนไข</h2>
            <p className="mismatchEmptyDesc">
              ลองปรับคำค้นหา หรือล้างตัวกรองเพื่อดูรายการนัดผิดห้องตรวจทั้งหมด
            </p>
            <button type="button" className="mismatchBtn" onClick={resetFilters}>
              <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>ล้างตัวกรอง</span>
            </button>
          </div>
        )}

        {/* Desktop Table Ledger */}
        {filteredMismatches.length > 0 && (
          <>
            <div className="mismatchTableCard">
              <div className="mismatchTableScroll">
                <table className="mismatchTable">
                  <thead>
                    <tr>
                      <th className="mismatchColNum">ลำดับ</th>
                      <th>HN</th>
                      <th>ห้องตรวจที่ระบุผิด</th>
                      <th>ผู้นัด</th>
                      <th className="mismatchColNum">วันที่มารับบริการ</th>
                      <th className="mismatchColNum">วันนัดครั้งถัดไป</th>
                      <th>ระยะเวลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMismatches.map((item, idx) => {
                      const rowKey = `${item.hn}-${item.nextdate}-${idx}`
                      const daysUntil = getDaysUntilDate(item.nextdate)
                      const urgency = getUrgencyMeta(daysUntil)
                      const deptLabel = normalizeDepartmentLabel(item.department)
                      const userLabel = normalizeUserLabel(item.appUser)
                      const isCopied = copiedKey === rowKey

                      return (
                        <tr key={rowKey}>
                          <td className="mismatchColNum mismatchIndexText">{idx + 1}</td>
                          <td>
                            <div className="mismatchHnGroup">
                              <span className="mismatchHnCode">{item.hn || '-'}</span>
                              {item.hn && (
                                <button
                                  type="button"
                                  className={`mismatchCopyBtn ${
                                    isCopied ? 'mismatchCopyBtn--copied' : ''
                                  }`}
                                  onClick={() => handleCopyHn(item.hn, rowKey)}
                                  aria-label={`คัดลอก HN ${item.hn}`}
                                  title={isCopied ? 'คัดลอกแล้ว' : 'คัดลอก HN'}
                                >
                                  {isCopied ? (
                                    <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                                  ) : (
                                    <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={
                                (item.department ?? '').trim()
                                  ? 'mismatchDeptText'
                                  : 'mismatchMutedText'
                              }
                            >
                              {deptLabel}
                            </span>
                          </td>
                          <td>
                            <span
                              className={(item.appUser ?? '').trim() ? '' : 'mismatchMutedText'}
                            >
                              {userLabel}
                            </span>
                          </td>
                          <td className="mismatchColNum mismatchTabular">
                            {formatThaiShortDate(item.vstdate)}
                          </td>
                          <td className="mismatchColNum mismatchTabular">
                            {formatThaiShortDate(item.nextdate)}
                          </td>
                          <td>
                            <span
                              className={`mismatchUrgencyTag mismatchUrgencyTag--${urgency.tone}`}
                            >
                              {urgency.tone === 'critical' && (
                                <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" />
                              )}
                              {urgency.tone === 'warning' && (
                                <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />
                              )}
                              <span>{urgency.label}</span>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="mismatchMobileList" aria-label="รายการนัดผิดห้องตรวจบนมือถือ">
              {filteredMismatches.map((item, idx) => {
                const rowKey = `mobile-${item.hn}-${item.nextdate}-${idx}`
                const daysUntil = getDaysUntilDate(item.nextdate)
                const urgency = getUrgencyMeta(daysUntil)
                const deptLabel = normalizeDepartmentLabel(item.department)
                const userLabel = normalizeUserLabel(item.appUser)
                const isCopied = copiedKey === rowKey

                return (
                  <article key={rowKey} className="mismatchMobileCard">
                    <div className="mismatchMobileTop">
                      <div className="mismatchHnGroup">
                        <span className="mismatchHnCode">{item.hn || '-'}</span>
                        {item.hn && (
                          <button
                            type="button"
                            className={`mismatchCopyBtn ${
                              isCopied ? 'mismatchCopyBtn--copied' : ''
                            }`}
                            onClick={() => handleCopyHn(item.hn, rowKey)}
                            aria-label={`คัดลอก HN ${item.hn}`}
                          >
                            {isCopied ? (
                              <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                            ) : (
                              <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </div>

                      <span className={`mismatchUrgencyTag mismatchUrgencyTag--${urgency.tone}`}>
                        {urgency.tone === 'critical' && (
                          <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" />
                        )}
                        {urgency.tone === 'warning' && (
                          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />
                        )}
                        <span>{urgency.label}</span>
                      </span>
                    </div>

                    <p className="mismatchMobileDept">{deptLabel}</p>

                    <div className="mismatchMobileMetaGrid">
                      <div className="mismatchMobileMetaItem">
                        <span className="mismatchMobileMetaLabel">วันนัดครั้งถัดไป</span>
                        <span className="mismatchMobileMetaValue mismatchTabular">
                          {formatThaiShortDate(item.nextdate)}
                        </span>
                      </div>
                      <div className="mismatchMobileMetaItem">
                        <span className="mismatchMobileMetaLabel">วันที่มารับบริการ</span>
                        <span className="mismatchMobileMetaValue mismatchTabular">
                          {formatThaiShortDate(item.vstdate)}
                        </span>
                      </div>
                      <div className="mismatchMobileMetaItem mismatchMobileMetaItem--full">
                        <span className="mismatchMobileMetaLabel">ผู้นัด</span>
                        <span className="mismatchMobileMetaValue">{userLabel}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
