'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Building2,
  Check,
  Copy,
  X,
  BarChart3,
} from 'lucide-react'
import {
  formatGenderLabel,
  formatPatientFullName,
  formatThaiDateString,
  type ExportScope,
  type FilterTab,
  type HospCoverageItem,
  type SortOption,
  type SummaryData,
  type TbRecord,
} from './tbCxrTypes'
import { exportTbCxrToExcel } from './exportTbCxrExcel'

interface Props {
  userRole?: string
}

const INITIAL_SUMMARY: SummaryData = {
  total: 0,
  doneCount: 0,
  missingCount: 0,
  coveragePercentage: 0,
  statusBreakdown: {},
}

export default function TbCxrTrackerClient({ userRole }: Props) {
  const [data, setData] = useState<TbRecord[]>([])
  const [summary, setSummary] = useState<SummaryData>(INITIAL_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  // Filters & sorting
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [selectedHosp, setSelectedHosp] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('default')

  // Subdistrict coverage breakdown toggle
  const [showHospBreakdown, setShowHospBreakdown] = useState<boolean>(false)
  const [hospSortMode, setHospSortMode] = useState<'missing' | 'rate' | 'name'>('missing')

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Modals & Drawers
  const [selectedRecord, setSelectedRecord] = useState<TbRecord | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopyText = useCallback((key: string, text: string) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1600)
  }, [])

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    else setLoading(true)

    try {
      setFetchError(null)
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
    } catch (err: unknown) {
      console.error('Failed to load TB CXR data:', err)
      setFetchError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
      )
    } finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Escape key closes drawer or export modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (exportModalOpen && !isExporting) {
        setExportModalOpen(false)
      } else if (selectedRecord) {
        setSelectedRecord(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exportModalOpen, isExporting, selectedRecord])

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, selectedHosp, searchTerm, sortBy, pageSize])

  // Per-รพ.สต. coverage breakdown derived from loaded cohort
  const hospBreakdown = useMemo<HospCoverageItem[]>(() => {
    const map = new Map<string, { total: number; done: number; missing: number }>()
    for (const item of data) {
      const name = item.status || 'ไม่ระบุ'
      const entry = map.get(name) ?? { total: 0, done: 0, missing: 0 }
      entry.total += 1
      if (item.cxr_status === 'DONE') entry.done += 1
      else entry.missing += 1
      map.set(name, entry)
    }

    const list: HospCoverageItem[] = Array.from(map.entries()).map(([name, counts]) => ({
      name,
      total: counts.total,
      done: counts.done,
      missing: counts.missing,
      coverageRate: counts.total > 0 ? (counts.done / counts.total) * 100 : 0,
    }))

    if (hospSortMode === 'missing') {
      return list.sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name, 'th'))
    }
    if (hospSortMode === 'rate') {
      return list.sort((a, b) => a.coverageRate - b.coverageRate || b.total - a.total)
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [data, hospSortMode])

  const hospList = useMemo(() => {
    const keys = Object.keys(summary.statusBreakdown || {})
    if (keys.length > 0) return keys.sort((a, b) => a.localeCompare(b, 'th'))
    return Array.from(new Set(data.map((d) => d.status).filter(Boolean)))
      .map(String)
      .sort((a, b) => a.localeCompare(b, 'th'))
  }, [summary.statusBreakdown, data])

  const filteredData = useMemo(() => {
    const filtered = data.filter((item) => {
      if (activeTab === 'done' && item.cxr_status !== 'DONE') return false
      if (activeTab === 'missing' && item.cxr_status !== 'MISSING') return false
      if (selectedHosp && item.status !== selectedHosp) return false

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const hn = String(item.hn || '').toLowerCase()
        const cid = String(item.cid || '').toLowerCase()
        const fullname = `${item.title || ''}${item.fname || ''} ${item.lname || ''}`.toLowerCase()
        const home = String(item.home || '').toLowerCase()
        if (!hn.includes(q) && !cid.includes(q) && !fullname.includes(q) && !home.includes(q)) {
          return false
        }
      }

      return true
    })

    if (sortBy === 'default') return filtered

    const sorted = [...filtered]
    if (sortBy === 'missing_first') {
      sorted.sort((a, b) => {
        if (a.cxr_status !== b.cxr_status) return a.cxr_status === 'MISSING' ? -1 : 1
        return (a.status || '').localeCompare(b.status || '', 'th')
      })
    } else if (sortBy === 'cxr_recent') {
      sorted.sort((a, b) => (b.cxr_date || '').localeCompare(a.cxr_date || ''))
    } else if (sortBy === 'name_asc') {
      sorted.sort((a, b) =>
        `${a.fname || ''} ${a.lname || ''}`.localeCompare(`${b.fname || ''} ${b.lname || ''}`, 'th')
      )
    } else if (sortBy === 'age_desc') {
      sorted.sort((a, b) => (b.age ?? -1) - (a.age ?? -1))
    }
    return sorted
  }, [data, activeTab, selectedHosp, searchTerm, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  const hasActiveFilters =
    activeTab !== 'all' || selectedHosp !== '' || searchTerm.trim() !== '' || sortBy !== 'default'

  const resetAllFilters = useCallback(() => {
    setActiveTab('all')
    setSelectedHosp('')
    setSearchTerm('')
    setSortBy('default')
  }, [])

  const handleExportExcel = async (exportType: ExportScope) => {
    setIsExporting(true)
    try {
      await exportTbCxrToExcel({
        exportType,
        activeTab,
        allData: data,
        filteredData,
      })
      setExportModalOpen(false)
    } catch (err) {
      console.error('Export error:', err)
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const remainingPercentage = Math.max(0, 100 - summary.coveragePercentage).toFixed(1)

  return (
    <div className="tbPage" data-role={userRole || 'staff'}>
      <div className="tbContainer">
        {/* Header */}
        <header className="tbHeader">
          <div className="tbHeaderLeft">
            <Link href="/service" className="tbBackLink">
              <ArrowLeft size={16} strokeWidth={1.5} />
              กลับหน้ารวมบริการ
            </Link>
            <div className="tbTitleRow">
              <h1 className="tbTitle">ระบบติดตามการทำ CXR ในกลุ่มผู้ป่วย TB</h1>
            </div>
            <p className="tbSubtitle">
              โรงพยาบาลเถิน · ทะเบียนคัดกรองภาพรังสีทรวงอกกลุ่มเสี่ยงและผู้สัมผัสวัณโรค
            </p>
          </div>

          <div className="tbHeaderActions">
            <button
              type="button"
              onClick={() => setShowHospBreakdown((prev) => !prev)}
              className={`tbBtn ${showHospBreakdown ? 'tbBtnActive' : ''}`}
              aria-expanded={showHospBreakdown}
            >
              <BarChart3 size={16} strokeWidth={1.5} />
              <span>ภาพรวมราย รพ.สต.</span>
              {hospBreakdown.length > 0 && (
                <span className="tbBtnCount">{hospBreakdown.length}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchData(true)}
              className="tbBtn"
              disabled={refreshing || loading}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} strokeWidth={1.5} className={refreshing ? 'tbSpin' : ''} />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="tbBtn tbBtnPrimary"
              disabled={loading || data.length === 0}
            >
              <FileSpreadsheet size={16} strokeWidth={1.5} />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </header>

        {/* KPI Strip */}
        <section className="tbKpiGrid" aria-label="สรุปสถานะการคัดกรอง CXR">
          <button
            type="button"
            className={`tbKpiCard ${activeTab === 'all' ? 'tbKpiCardSelected' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <div className="tbKpiHead">
              <span className="tbKpiLabel">กลุ่มเป้าหมายทั้งหมด</span>
              <span className="tbKpiDot" aria-hidden="true" />
            </div>
            <div className="tbKpiValueRow">
              <span className="tbKpiValue">{summary.total.toLocaleString()}</span>
              <span className="tbKpiUnit">ราย</span>
            </div>
            <span className="tbKpiMeta">ครอบคลุม {hospList.length} หน่วยบริการ</span>
          </button>

          <button
            type="button"
            className={`tbKpiCard ${activeTab === 'done' ? 'tbKpiCardSelected' : ''}`}
            onClick={() => setActiveTab('done')}
          >
            <div className="tbKpiHead">
              <span className="tbKpiLabel">ตรวจ CXR แล้ว</span>
              <span className="tbKpiDot tbKpiDotSuccess" aria-hidden="true" />
            </div>
            <div className="tbKpiValueRow">
              <span className="tbKpiValue tbKpiValueAccent">
                {summary.doneCount.toLocaleString()}
              </span>
              <span className="tbKpiUnit">ราย</span>
            </div>
            <span className="tbKpiMeta">มีผลบันทึกในระบบ HOSxP</span>
          </button>

          <button
            type="button"
            className={`tbKpiCard ${activeTab === 'missing' ? 'tbKpiCardSelected' : ''}`}
            onClick={() => setActiveTab('missing')}
          >
            <div className="tbKpiHead">
              <span className="tbKpiLabel">ยังไม่ได้ตรวจ CXR</span>
              <span className="tbKpiDot tbKpiDotDanger" aria-hidden="true" />
            </div>
            <div className="tbKpiValueRow">
              <span className="tbKpiValue tbKpiValueDanger">
                {summary.missingCount.toLocaleString()}
              </span>
              <span className="tbKpiUnit">ราย</span>
            </div>
            <span className="tbKpiMeta">คงเหลือ {remainingPercentage}% ที่ต้องติดตาม</span>
          </button>

          <div className="tbKpiCard">
            <div className="tbKpiHead">
              <span className="tbKpiLabel">ความครอบคลุมภาพรวม</span>
              <span className="tbKpiDot tbKpiDotAccent" aria-hidden="true" />
            </div>
            <div className="tbKpiValueRow">
              <span className="tbKpiValue">{summary.coveragePercentage.toFixed(1)}%</span>
            </div>
            <div className="tbProgressTrack" aria-hidden="true">
              <div
                className="tbProgressFill"
                style={{
                  transform: `scaleX(${Math.min(1, Math.max(0, summary.coveragePercentage / 100))})`,
                }}
              />
            </div>
            <span className="tbKpiMeta">
              ตรวจแล้ว {summary.doneCount.toLocaleString()} จาก {summary.total.toLocaleString()} ราย
            </span>
          </div>
        </section>

        {/* Subdistrict Coverage Breakdown (Expandable) */}
        {showHospBreakdown && hospBreakdown.length > 0 && (
          <section className="tbBreakdownCard" aria-label="ความครอบคลุมราย รพ.สต.">
            <div className="tbBreakdownHeader">
              <div>
                <h2 className="tbBreakdownTitle">
                  ความครอบคลุมแยกตาม รพ.สต. / สถานพยาบาล
                  <span className="tbBreakdownSub">คลิกหน่วยบริการเพื่อกรองรายชื่อ</span>
                </h2>
              </div>
              <div className="tbBreakdownSortGroup" role="group" aria-label="เรียงลำดับหน่วยบริการ">
                <button
                  type="button"
                  className={`tbMiniTab ${hospSortMode === 'missing' ? 'tbMiniTabActive' : ''}`}
                  onClick={() => setHospSortMode('missing')}
                >
                  รอตรวจมากสุด
                </button>
                <button
                  type="button"
                  className={`tbMiniTab ${hospSortMode === 'rate' ? 'tbMiniTabActive' : ''}`}
                  onClick={() => setHospSortMode('rate')}
                >
                  ความครอบคลุมน้อยสุด
                </button>
                <button
                  type="button"
                  className={`tbMiniTab ${hospSortMode === 'name' ? 'tbMiniTabActive' : ''}`}
                  onClick={() => setHospSortMode('name')}
                >
                  เรียง ก-ฮ
                </button>
              </div>
            </div>

            <div className="tbHospGrid">
              {hospBreakdown.map((item) => {
                const isSelected = selectedHosp === item.name
                return (
                  <button
                    key={item.name}
                    type="button"
                    className={`tbHospItem ${isSelected ? 'tbHospItemActive' : ''}`}
                    onClick={() => setSelectedHosp(isSelected ? '' : item.name)}
                  >
                    <div className="tbHospItemTop">
                      <span className="tbHospItemName" title={item.name}>
                        {item.name}
                      </span>
                      <span className="tbHospItemRate">{item.coverageRate.toFixed(1)}%</span>
                    </div>
                    <div className="tbProgressTrack" aria-hidden="true">
                      <div
                        className="tbProgressFill"
                        style={{
                          transform: `scaleX(${Math.min(1, Math.max(0, item.coverageRate / 100))})`,
                        }}
                      />
                    </div>
                    <div className="tbHospItemMeta">
                      <span>
                        ตรวจแล้ว {item.done.toLocaleString()} / {item.total.toLocaleString()}
                      </span>
                      <span className={item.missing > 0 ? 'tbHospMissingText' : ''}>
                        รอตรวจ {item.missing.toLocaleString()}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Filter & Control Bar */}
        <section className="tbControlPanel" aria-label="ตัวกรองและการค้นหา">
          <div className="tbControlTopRow">
            <div className="tbTabGroup" role="tablist" aria-label="สถานะการตรวจ CXR">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all'}
                className={`tbTabBtn ${activeTab === 'all' ? 'tbTabBtnActive' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                ทั้งหมด
                <span className="tbTabCount">{summary.total.toLocaleString()}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'done'}
                className={`tbTabBtn ${activeTab === 'done' ? 'tbTabBtnActive' : ''}`}
                onClick={() => setActiveTab('done')}
              >
                ตรวจ CXR แล้ว
                <span className="tbTabCount tbTabCountDone">
                  {summary.doneCount.toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'missing'}
                className={`tbTabBtn ${activeTab === 'missing' ? 'tbTabBtnActive' : ''}`}
                onClick={() => setActiveTab('missing')}
              >
                ยังไม่ได้ตรวจ
                <span className="tbTabCount tbTabCountMissing">
                  {summary.missingCount.toLocaleString()}
                </span>
              </button>
            </div>

            <div className="tbControlStatusRight">
              {lastFetched && (
                <span>อัปเดตล่าสุด {lastFetched.toLocaleTimeString('th-TH')} น.</span>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="tbBtn tbBtnSm"
                  onClick={resetAllFilters}
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          <div className="tbFilterRow">
            <div className="tbFieldWrap">
              <Search size={16} strokeWidth={1.5} className="tbFieldIcon" aria-hidden="true" />
              <input
                type="text"
                aria-label="ค้นหารายชื่อผู้ป่วย"
                placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล หรือที่อยู่"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="tbInput"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="tbClearBtn"
                  onClick={() => setSearchTerm('')}
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>

            <div className="tbFieldWrap">
              <Building2 size={16} strokeWidth={1.5} className="tbFieldIcon" aria-hidden="true" />
              <select
                aria-label="เลือก รพ.สต. หรือสถานพยาบาล"
                value={selectedHosp}
                onChange={(e) => setSelectedHosp(e.target.value)}
                className="tbSelect"
              >
                <option value="">ทุก รพ.สต. / สถานพยาบาล ({hospList.length} แห่ง)</option>
                {hospList.map((hosp) => (
                  <option key={hosp} value={hosp}>
                    {hosp} ({(summary.statusBreakdown[hosp] || 0).toLocaleString()} ราย)
                  </option>
                ))}
              </select>
            </div>

            <div className="tbFieldWrap">
              <select
                aria-label="เรียงลำดับรายชื่อ"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="tbSelect tbSelectPlain"
              >
                <option value="default">เรียงตาม: ค่าเริ่มต้น</option>
                <option value="missing_first">ยังไม่ได้ตรวจขึ้นก่อน</option>
                <option value="cxr_recent">วันที่ตรวจ CXR ล่าสุด</option>
                <option value="name_asc">ชื่อ ก - ฮ</option>
                <option value="age_desc">อายุมากไปน้อย</option>
              </select>
            </div>
          </div>
        </section>

        {/* Table & Mobile Cards */}
        <section className="tbTableCard" aria-label="ทะเบียนรายชื่อคัดกรอง CXR">
          {!loading && !fetchError && (
            <div className="tbTableMeta">
              <div className="tbTableMetaLeft">
                <span>
                  พบข้อมูล <strong>{filteredData.length.toLocaleString()}</strong> รายการ
                </span>
                {selectedHosp && (
                  <span className="tbFilterPill">รพ.สต.: {selectedHosp}</span>
                )}
                {searchTerm.trim() && (
                  <span className="tbFilterPill">ค้นหา: &quot;{searchTerm.trim()}&quot;</span>
                )}
              </div>
              <div className="tbPageSizeWrap">
                <label htmlFor="tb-page-size">แสดงหน้าละ</label>
                <select
                  id="tb-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="tbPageSizeSelect"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}

          {loading ? (
            <div className="tbStateBox">
              <RefreshCw size={24} strokeWidth={1.5} className="tbSpin tbStateIcon" />
              <p className="tbStateDesc">กำลังโหลดข้อมูลการติดตามคัดกรอง CXR…</p>
            </div>
          ) : fetchError ? (
            <div className="tbStateBox">
              <AlertCircle size={24} strokeWidth={1.5} className="tbStateIconDanger" />
              <h2 className="tbStateTitle">ไม่สามารถโหลดข้อมูลได้</h2>
              <p className="tbStateDesc">{fetchError}</p>
              <button
                type="button"
                className="tbBtn tbBtnPrimary"
                onClick={() => fetchData(true)}
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="tbStateBox">
              <AlertCircle size={24} strokeWidth={1.5} className="tbStateIcon" />
              <h2 className="tbStateTitle">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</h2>
              <p className="tbStateDesc">ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูข้อมูลทั้งหมด</p>
              <button
                type="button"
                className="tbBtn tbBtnPrimary"
                onClick={resetAllFilters}
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="tbTableScroll">
                <table className="tbTable">
                  <thead>
                    <tr>
                      <th className="tbColNum">ลำดับ</th>
                      <th>HN</th>
                      <th>ชื่อ - สกุล</th>
                      <th>เลขบัตรประชาชน</th>
                      <th>เพศ / อายุ</th>
                      <th>สถานะ CXR</th>
                      <th>วันที่ตรวจ CXR</th>
                      <th>รพ.สต. รับผิดชอบ</th>
                      <th>ที่อยู่</th>
                      <th aria-label="ดูรายละเอียด" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, idx) => {
                      const rowNumber = (currentPage - 1) * pageSize + idx + 1
                      const isDone = row.cxr_status === 'DONE'
                      const rowKey = `${row.id || row.hn || idx}`
                      const hnCopied = copiedKey === `hn-${rowKey}`
                      const cidCopied = copiedKey === `cid-${rowKey}`
                      const fullName = formatPatientFullName(row)

                      return (
                        <tr
                          key={row.id || `${row.hn}-${idx}`}
                          className="tbTableRow"
                          tabIndex={0}
                          onClick={() => setSelectedRecord(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedRecord(row)
                            }
                          }}
                        >
                          <td className="tbColNum">{rowNumber.toLocaleString()}</td>
                          <td>
                            <div className="tbIdCell">
                              <span className="tbMono">{row.hn || '-'}</span>
                              {row.hn && (
                                <button
                                  type="button"
                                  className={`tbCopyMini ${hnCopied ? 'tbCopyMiniCopied' : ''}`}
                                  aria-label={`คัดลอก HN ${row.hn}`}
                                  title="คัดลอก HN"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyText(`hn-${rowKey}`, row.hn!)
                                  }}
                                >
                                  {hnCopied ? (
                                    <Check size={14} strokeWidth={1.5} />
                                  ) : (
                                    <Copy size={14} strokeWidth={1.5} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="tbPatientName">{fullName}</div>
                            {row.risk_type && (
                              <div className="tbSubMeta">{row.risk_type}</div>
                            )}
                          </td>
                          <td>
                            <div className="tbIdCell">
                              <span className="tbMono">{row.cid || '-'}</span>
                              {row.cid && (
                                <button
                                  type="button"
                                  className={`tbCopyMini ${cidCopied ? 'tbCopyMiniCopied' : ''}`}
                                  aria-label={`คัดลอกเลขบัตรประชาชน ${row.cid}`}
                                  title="คัดลอกเลขบัตรประชาชน"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyText(`cid-${rowKey}`, row.cid!)
                                  }}
                                >
                                  {cidCopied ? (
                                    <Check size={14} strokeWidth={1.5} />
                                  ) : (
                                    <Copy size={14} strokeWidth={1.5} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <span>{formatGenderLabel(row.gender)}</span>
                            <span className="tbMutedText"> · </span>
                            <span className="tbDateText">
                              {row.age !== null && row.age !== undefined ? `${row.age} ปี` : '-'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`tbStatusPill ${isDone ? 'tbStatusPillDone' : 'tbStatusPillMissing'}`}
                            >
                              <span className="tbStatusDot" aria-hidden="true" />
                              {isDone ? 'ตรวจแล้ว' : 'ยังไม่ได้ตรวจ'}
                            </span>
                          </td>
                          <td>
                            {isDone && row.cxr_date ? (
                              <span className="tbDateText">
                                {formatThaiDateString(row.cxr_date)}
                              </span>
                            ) : (
                              <span className="tbMutedText">-</span>
                            )}
                          </td>
                          <td>{row.status || '-'}</td>
                          <td className="tbColHome" title={row.home || ''}>
                            {row.home || '-'}
                          </td>
                          <td>
                            <ChevronRight
                              size={16}
                              strokeWidth={1.5}
                              className="tbRowChevron"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="tbMobileList">
                {paginatedRows.map((row, idx) => {
                  const isDone = row.cxr_status === 'DONE'
                  const fullName = formatPatientFullName(row)
                  return (
                    <button
                      key={row.id || `${row.hn}-${idx}`}
                      type="button"
                      className="tbMobileCard"
                      onClick={() => setSelectedRecord(row)}
                    >
                      <div className="tbMobileCardTop">
                        <div>
                          <div className="tbPatientName">{fullName}</div>
                          {row.risk_type && (
                            <div className="tbSubMeta">{row.risk_type}</div>
                          )}
                        </div>
                        <span
                          className={`tbStatusPill ${isDone ? 'tbStatusPillDone' : 'tbStatusPillMissing'}`}
                        >
                          <span className="tbStatusDot" aria-hidden="true" />
                          {isDone ? 'ตรวจแล้ว' : 'ยังไม่ได้ตรวจ'}
                        </span>
                      </div>

                      <div className="tbMobileMetaRow">
                        <span className="tbMono">HN {row.hn || '-'}</span>
                        <span>
                          {formatGenderLabel(row.gender)} ·{' '}
                          {row.age !== null && row.age !== undefined ? `${row.age} ปี` : '-'}
                        </span>
                        {isDone && row.cxr_date && (
                          <span>CXR {formatThaiDateString(row.cxr_date)}</span>
                        )}
                      </div>

                      <div className="tbMobileFooter">
                        <span>{row.status || '-'}</span>
                        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Pagination */}
              <div className="tbPagination">
                <span>
                  แสดงแถวที่ {((currentPage - 1) * pageSize + 1).toLocaleString()}–
                  {Math.min(currentPage * pageSize, filteredData.length).toLocaleString()} จาก{' '}
                  {filteredData.length.toLocaleString()} รายการ
                </span>

                <div className="tbPaginationControls">
                  <button
                    type="button"
                    className="tbPageBtn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    aria-label="หน้าแรก"
                    title="หน้าแรก"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="tbPageBtn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="หน้าก่อนหน้า"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft size={16} strokeWidth={1.5} />
                  </button>

                  <span className="tbPageCurrent">
                    หน้า {currentPage.toLocaleString()} / {totalPages.toLocaleString()}
                  </span>

                  <button
                    type="button"
                    className="tbPageBtn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="หน้าถัดไป"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    className="tbPageBtn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    aria-label="หน้าสุดท้าย"
                    title="หน้าสุดท้าย"
                  >
                    »
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Patient Detail Slide-Over Drawer */}
      {selectedRecord && (
        <div
          className="tbBackdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tb-drawer-title"
          onClick={() => setSelectedRecord(null)}
        >
          <div className="tbDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="tbDrawerHeader">
              <div>
                <span
                  className={`tbStatusPill ${
                    selectedRecord.cxr_status === 'DONE'
                      ? 'tbStatusPillDone'
                      : 'tbStatusPillMissing'
                  }`}
                >
                  <span className="tbStatusDot" aria-hidden="true" />
                  {selectedRecord.cxr_status === 'DONE' ? 'ตรวจ CXR แล้ว' : 'ยังไม่ได้ตรวจ CXR'}
                </span>
                <h2 id="tb-drawer-title" className="tbDrawerTitle">
                  {formatPatientFullName(selectedRecord)}
                </h2>
                <p className="tbDrawerSub">
                  {selectedRecord.status || 'ไม่ระบุหน่วยบริการ'}
                  {selectedRecord.risk_type ? ` · ${selectedRecord.risk_type}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="tbIconCloseBtn"
                onClick={() => setSelectedRecord(null)}
                aria-label="ปิดรายละเอียดผู้ป่วย"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="tbDrawerBody">
              {/* Quick Copy Strip */}
              <div className="tbCopyStrip">
                {selectedRecord.hn && (
                  <button
                    type="button"
                    className={`tbCopyChip ${
                      copiedKey === 'drawer-hn' ? 'tbCopyChipCopied' : ''
                    }`}
                    onClick={() => handleCopyText('drawer-hn', selectedRecord.hn!)}
                  >
                    {copiedKey === 'drawer-hn' ? (
                      <Check size={14} strokeWidth={1.5} />
                    ) : (
                      <Copy size={14} strokeWidth={1.5} />
                    )}
                    <span className="tbMono">HN {selectedRecord.hn}</span>
                  </button>
                )}
                {selectedRecord.cid && (
                  <button
                    type="button"
                    className={`tbCopyChip ${
                      copiedKey === 'drawer-cid' ? 'tbCopyChipCopied' : ''
                    }`}
                    onClick={() => handleCopyText('drawer-cid', selectedRecord.cid!)}
                  >
                    {copiedKey === 'drawer-cid' ? (
                      <Check size={14} strokeWidth={1.5} />
                    ) : (
                      <Copy size={14} strokeWidth={1.5} />
                    )}
                    <span className="tbMono">{selectedRecord.cid}</span>
                  </button>
                )}
                {selectedRecord.cxr_date && (
                  <button
                    type="button"
                    className={`tbCopyChip ${
                      copiedKey === 'drawer-cxr' ? 'tbCopyChipCopied' : ''
                    }`}
                    onClick={() => handleCopyText('drawer-cxr', selectedRecord.cxr_date!)}
                  >
                    {copiedKey === 'drawer-cxr' ? (
                      <Check size={14} strokeWidth={1.5} />
                    ) : (
                      <Copy size={14} strokeWidth={1.5} />
                    )}
                    <span className="tbMono">CXR {selectedRecord.cxr_date}</span>
                  </button>
                )}
              </div>

              {/* Demographics */}
              <div className="tbDetailSection">
                <h3 className="tbDetailHeading">ข้อมูลผู้ป่วยและที่อยู่</h3>
                <dl className="tbDetailList">
                  <dt>เพศ / อายุ</dt>
                  <dd>
                    {formatGenderLabel(selectedRecord.gender)} ·{' '}
                    {selectedRecord.age !== null && selectedRecord.age !== undefined
                      ? `${selectedRecord.age} ปี`
                      : '-'}
                  </dd>
                  <dt>วันเกิด</dt>
                  <dd>{formatThaiDateString(selectedRecord.born)}</dd>
                  <dt>สิทธิการรักษา</dt>
                  <dd>{selectedRecord.inccl_id || '-'}</dd>
                  <dt>หน่วยบริการ</dt>
                  <dd>{selectedRecord.status || '-'}</dd>
                  <dt>ที่อยู่</dt>
                  <dd>{selectedRecord.home || '-'}</dd>
                </dl>
              </div>

              {/* Screening & CXR */}
              <div className="tbDetailSection">
                <h3 className="tbDetailHeading">การคัดกรองและผล CXR</h3>
                <dl className="tbDetailList">
                  <dt>กลุ่มเสี่ยง</dt>
                  <dd>{selectedRecord.risk_type || '-'}</dd>
                  <dt>วันที่คัดกรอง/สัมผัส</dt>
                  <dd>{formatThaiDateString(selectedRecord.contact_date)}</dd>
                  <dt>คัดกรองอาการ</dt>
                  <dd>{selectedRecord.symptom_screen || '-'}</dd>
                  <dt>วันที่ตรวจ CXR</dt>
                  <dd>
                    {selectedRecord.cxr_status === 'DONE' && selectedRecord.cxr_date
                      ? formatThaiDateString(selectedRecord.cxr_date)
                      : 'ยังไม่ได้ตรวจ'}
                  </dd>
                  <dt>ผลตรวจ CXR</dt>
                  <dd>{selectedRecord.cxr_result || '-'}</dd>
                  {selectedRecord.cxr_abnormal_result && (
                    <>
                      <dt>ผลผิดปกติ</dt>
                      <dd>{selectedRecord.cxr_abnormal_result}</dd>
                    </>
                  )}
                </dl>
              </div>

              {/* Additional Clinical */}
              {(selectedRecord.dx ||
                selectedRecord.icd10 ||
                selectedRecord.hba1c ||
                selectedRecord.note) && (
                <div className="tbDetailSection">
                  <h3 className="tbDetailHeading">ข้อมูลทางคลินิกเพิ่มเติม</h3>
                  <dl className="tbDetailList">
                    {selectedRecord.icd10 && (
                      <>
                        <dt>ICD-10</dt>
                        <dd className="tbMono">{selectedRecord.icd10}</dd>
                      </>
                    )}
                    {selectedRecord.dx && (
                      <>
                        <dt>การวินิจฉัย</dt>
                        <dd>{selectedRecord.dx}</dd>
                      </>
                    )}
                    {selectedRecord.hba1c && (
                      <>
                        <dt>HbA1c</dt>
                        <dd>{selectedRecord.hba1c}</dd>
                      </>
                    )}
                    {selectedRecord.note && (
                      <>
                        <dt>หมายเหตุ</dt>
                        <dd>{selectedRecord.note}</dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {exportModalOpen && (
        <div
          className="tbBackdrop tbBackdropCenter"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tb-export-title"
          onClick={() => !isExporting && setExportModalOpen(false)}
        >
          <div className="tbModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="tbModalHeader">
              <div>
                <h2 id="tb-export-title" className="tbModalTitle">
                  ส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)
                </h2>
                <p className="tbModalSubtitle">
                  เลือกชุดข้อมูลที่ต้องการนำไปใช้ติดตามการคัดกรองในพื้นที่
                </p>
              </div>
              <button
                type="button"
                className="tbIconCloseBtn"
                disabled={isExporting}
                onClick={() => setExportModalOpen(false)}
                aria-label="ปิดหน้าต่างส่งออก"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="tbModalBody">
              <button
                type="button"
                className="tbExportChoiceBtn"
                disabled={isExporting || filteredData.length === 0}
                onClick={() => handleExportExcel('filtered')}
              >
                <div className="tbChoiceText">
                  <span className="tbChoiceTitle">ส่งออกตามตัวกรองที่เลือกไว้ปัจจุบัน</span>
                  <span className="tbChoiceDesc">
                    จำนวน {filteredData.length.toLocaleString()} รายการ
                  </span>
                </div>
                <Download size={16} strokeWidth={1.5} className="tbChoiceIcon" />
              </button>

              <button
                type="button"
                className="tbExportChoiceBtn"
                disabled={isExporting || summary.missingCount === 0}
                onClick={() => handleExportExcel('missing')}
              >
                <div className="tbChoiceText">
                  <span className="tbChoiceTitle">ส่งออกเฉพาะกลุ่มที่ยังไม่ได้ตรวจ CXR</span>
                  <span className="tbChoiceDesc">
                    จำนวน {summary.missingCount.toLocaleString()} รายการ สำหรับวางแผนลงพื้นที่
                  </span>
                </div>
                <Download size={16} strokeWidth={1.5} className="tbChoiceIcon" />
              </button>

              <button
                type="button"
                className="tbExportChoiceBtn"
                disabled={isExporting || summary.doneCount === 0}
                onClick={() => handleExportExcel('done')}
              >
                <div className="tbChoiceText">
                  <span className="tbChoiceTitle">ส่งออกเฉพาะกลุ่มที่ตรวจ CXR แล้ว</span>
                  <span className="tbChoiceDesc">
                    จำนวน {summary.doneCount.toLocaleString()} รายการ ที่มีผลบันทึกแล้ว
                  </span>
                </div>
                <Download size={16} strokeWidth={1.5} className="tbChoiceIcon" />
              </button>

              <button
                type="button"
                className="tbExportChoiceBtn"
                disabled={isExporting || summary.total === 0}
                onClick={() => handleExportExcel('all')}
              >
                <div className="tbChoiceText">
                  <span className="tbChoiceTitle">ส่งออกกลุ่มเป้าหมายทั้งหมด</span>
                  <span className="tbChoiceDesc">
                    ครบถ้วนทุกกลุ่ม {summary.total.toLocaleString()} รายการ
                  </span>
                </div>
                <Download size={16} strokeWidth={1.5} className="tbChoiceIcon" />
              </button>
            </div>

            {isExporting && (
              <div className="tbExportLoading">
                <RefreshCw size={16} strokeWidth={1.5} className="tbSpin" />
                <span>กำลังสร้างไฟล์ Excel…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
