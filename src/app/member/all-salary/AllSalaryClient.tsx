'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Search,
  User,
  Building,
  Briefcase,
  Calendar,
  FileText,
  Clock,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Printer,
  Download
} from 'lucide-react'
import {
  type StatementRange,
  type StatementResult,
  type StatementTransactionItem,
  getPeriodSortKey,
  buildStatementTransactions
} from '@/lib/salary/salaryStatementService'
import './page.css'

interface MemberInfo {
  id: number
  username: string
  name: string | null
  department: string | null
  position: string | null
  salary_user: string | null
}

function getPresetPeriods(allPeriods: string[], preset: StatementRange): { from: string; to: string } {
  if (!allPeriods || allPeriods.length === 0) return { from: '', to: '' }
  const count = allPeriods.length
  const to = allPeriods[count - 1]
  const limitMap: Partial<Record<StatementRange, number>> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }
  const limit = limitMap[preset] || 6
  const fromIndex = Math.max(0, count - limit)
  const from = allPeriods[fromIndex]
  return { from, to }
}

export default function AllSalaryClient() {
  const [usernameInput, setUsernameInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [member, setMember] = useState<MemberInfo | null>(null)
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const [salaryData, setSalaryData] = useState<any>(null)
  const [otData, setOtData] = useState<any>(null)
  const [calendarData, setCalendarData] = useState<any[] | null>(null)
  const [hasRecords, setHasRecords] = useState(false)

  const [activeTab, setActiveTab] = useState<'salary' | 'ot'>('salary')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // -------------------------------------------------------------
  // Statement Export & Aggregation State (1m, 3m, 6m, 1y, custom)
  // -------------------------------------------------------------
  const [statementRange, setStatementRange] = useState<StatementRange>('6m')
  const [statementData, setStatementData] = useState<StatementResult | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState('')
  const [downloadingExcel, setDownloadingExcel] = useState(false)

  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [fromPeriod, setFromPeriod] = useState<string>('')
  const [toPeriod, setToPeriod] = useState<string>('')
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false)

  const monthShortNameMap: Record<number, string> = {
    1: 'ม.ค.', 2: 'ก.พ.', 3: 'มี.ค.', 4: 'เม.ย.', 5: 'พ.ค.', 6: 'มิ.ย.',
    7: 'ก.ค.', 8: 'ส.ค.', 9: 'ก.ย.', 10: 'ต.ค.', 11: 'พ.ย.', 12: 'ธ.ค.'
  }

  // Auto-search effect: only triggers when user enters all 13 digits
  useEffect(() => {
    const trimmed = usernameInput.trim()
    if (!trimmed) {
      setMember(null)
      setSalaryData(null)
      setOtData(null)
      setCalendarData(null)
      setYears([])
      setSelectedYear('')
      setSelectedMonth('')
      setError('')
      setLoading(false)
      setStatementData(null)
      setAvailablePeriods([])
      setFromPeriod('')
      setToPeriod('')
      setIsCustomRange(false)
      return
    }

    if (trimmed.length === 13) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        fetchSalaryData(trimmed)
      }, 150)
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [usernameInput])

  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = usernameInput.trim()
    if (trimmed) {
      fetchSalaryData(trimmed)
    }
  }

  const fetchSalaryData = async (user: string, year?: string, month?: string) => {
    setLoading(true)
    setError('')
    try {
      let url = `/api/salary/all?username=${encodeURIComponent(user)}`
      if (year) url += `&year=${encodeURIComponent(year)}`
      if (month) url += `&month=${encodeURIComponent(month)}`

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        setMember(null)
        setSalaryData(null)
        setOtData(null)
        setStatementData(null)
        setError(data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
        return
      }

      setMember(data.member)
      setYears(data.years || [])
      setSelectedYear(data.selectedYear || '')
      setSelectedMonth(data.selectedMonth || '')
      setSalaryData(data.salary)
      setOtData(data.ot)
      setCalendarData(data.calendar || null)
      setHasRecords(data.hasRecords)

      if (data.periods && Array.isArray(data.periods) && data.periods.length > 0) {
        const sorted = [...data.periods].sort((a: string, b: string) => {
          const partsA = a.split(/\s+/)
          const partsB = b.split(/\s+/)
          return getPeriodSortKey(partsA[0], partsA[1]) - getPeriodSortKey(partsB[0], partsB[1])
        })
        setAvailablePeriods(sorted)
        const { from, to } = getPresetPeriods(sorted, '6m')
        setFromPeriod(from)
        setToPeriod(to)
        setIsCustomRange(false)
        setStatementRange('6m')
      } else {
        setAvailablePeriods([])
        setFromPeriod('')
        setToPeriod('')
      }

      // Reset statement data cache for new user
      setStatementData(null)
    } catch (err) {
      console.error('Fetch salary error:', err)
      setError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear)
    if (usernameInput.trim()) {
      fetchSalaryData(usernameInput.trim(), newYear, '')
    }
  }

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth)
    if (usernameInput.trim()) {
      fetchSalaryData(usernameInput.trim(), selectedYear, newMonth)
    }
  }

  // -------------------------------------------------------------
  // Statement Fetch & Export Handlers
  // -------------------------------------------------------------
  const fetchStatement = async (
    range: StatementRange = statementRange,
    customFrom?: string,
    customTo?: string
  ) => {
    const user = usernameInput.trim()
    if (!user) return null

    setStatementLoading(true)
    setStatementError('')
    try {
      const activeFrom = customFrom !== undefined ? customFrom : fromPeriod
      const activeTo = customTo !== undefined ? customTo : toPeriod
      let url = `/api/salary/all/statement?username=${encodeURIComponent(user)}&format=json`

      if (range === 'custom' || isCustomRange || (customFrom && customTo)) {
        url += `&range=custom&fromPeriod=${encodeURIComponent(activeFrom)}&toPeriod=${encodeURIComponent(activeTo)}`
      } else {
        url += `&range=${encodeURIComponent(range)}`
      }

      const res = await fetch(url)
      const json = await res.json()

      if (!res.ok) {
        setStatementError(json.error || 'ไม่สามารถโหลดข้อมูลสเตทเมนต์ได้')
        return null
      }

      setStatementData(json.statement)
      if (json.statement?.availablePeriods && json.statement.availablePeriods.length > 0) {
        setAvailablePeriods((prev) => (prev.length > 0 ? prev : json.statement.availablePeriods))
      }
      return json.statement as StatementResult
    } catch (err) {
      console.error('Fetch statement error:', err)
      setStatementError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์เพื่อออกสเตทเมนต์')
      return null
    } finally {
      setStatementLoading(false)
    }
  }

  const handleRangeChange = (newRange: StatementRange) => {
    setIsCustomRange(false)
    setStatementRange(newRange)
    if (availablePeriods.length > 0) {
      const { from, to } = getPresetPeriods(availablePeriods, newRange)
      setFromPeriod(from)
      setToPeriod(to)
      fetchStatement(newRange, from, to)
    } else {
      fetchStatement(newRange)
    }
  }

  const handleCustomPeriodChange = (newFrom: string, newTo: string) => {
    setIsCustomRange(true)
    setStatementRange('custom')
    setFromPeriod(newFrom)
    setToPeriod(newTo)
    if (newFrom && newTo) {
      fetchStatement('custom', newFrom, newTo)
    }
  }

  const handleDownloadExcel = async () => {
    const user = usernameInput.trim()
    if (!user) return

    setDownloadingExcel(true)
    try {
      let url = `/api/salary/all/statement?username=${encodeURIComponent(user)}&format=excel`
      let fileName = `salary_statement_${user}_${statementRange}.xlsx`

      if (statementRange === 'custom' || isCustomRange) {
        url += `&range=custom&fromPeriod=${encodeURIComponent(fromPeriod)}&toPeriod=${encodeURIComponent(toPeriod)}`
        const safeFrom = fromPeriod.replace(/\s+/g, '_')
        const safeTo = toPeriod.replace(/\s+/g, '_')
        fileName = `salary_statement_${user}_${safeFrom}_${safeTo}.xlsx`
      } else {
        url += `&range=${encodeURIComponent(statementRange)}`
      }

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download excel error:', err)
      alert('ไม่สามารถดาวน์โหลดไฟล์ Excel ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setTimeout(() => setDownloadingExcel(false), 1000)
    }
  }

  const handlePrintStatement = async () => {
    let data = statementData
    if (!data) {
      data = await fetchStatement(statementRange)
    }
    if (!data) return

    // Temporarily clear document title during print so browser header has no text
    const originalTitle = typeof document !== 'undefined' ? document.title : ''
    if (typeof document !== 'undefined') {
      document.title = ''
      const handleAfterPrint = () => {
        document.title = originalTitle
        window.removeEventListener('afterprint', handleAfterPrint)
      }
      window.addEventListener('afterprint', handleAfterPrint)
    }

    // Trigger browser print
    setTimeout(() => {
      window.print()
      setTimeout(() => {
        if (typeof document !== 'undefined') {
          document.title = originalTitle
        }
      }, 1000)
    }, 150)
  }

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = date.getFullYear() + 543
    const monthCut = [
      '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ]
    const month = monthCut[date.getMonth() + 1]
    const day = date.getDate()
    return `${day} ${month} ${year}`
  }

  const formatMoney = (val?: number | null) => {
    if (val === null || val === undefined) return '0.00'
    return Number(val).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const displayName = member?.name || salaryData?.c4?.trim() || otData?.c4?.trim() || member?.username || '-'
  const displayAccount = salaryData?.c3 || otData?.c3 || '-'
  const paymentDate = salaryData?.c1 || otData?.c1

  const now = new Date()
  const currentMonthName = monthShortNameMap[now.getMonth() + 1] || ''
  const currentYearBuddhist = now.getFullYear() + 543

  return (
    <div className="allSalaryPage">
      <div className="container allSalaryContainer">

        {/* Navigation / Header Bar */}
        <div className="pageTopBar no-print">
          <Link href="/member" className="backLink">
            <ArrowLeft size={18} />
            <span>กลับหน้าหลักสมาชิก</span>
          </Link>
          <span className="badgeRole">ระบบงานสารบรรณ / ธุรการ</span>
        </div>

        {/* Search Header Card */}
        <div className="searchBoxCard card no-print">
          <div className="searchCardHeader">
            <h2>ระบบค้นหาสลิปเงินเดือน & หนังสือรับรองเงินได้บุคลากร</h2>
            <p>กรอกเลขประจำตัวประชาชน 13 หลัก เพื่อดูสลิปรายเดือนและส่งออกหนังสือรับรองเงินได้</p>
          </div>

          <form onSubmit={handleManualSearch} className="searchFormWrapper">
            <div className="inputContainer">
              <div className="searchIconWrapper">
                {loading ? (
                  <Loader2 size={22} className="spinnerIcon animate-spin" />
                ) : (
                  <Search size={22} />
                )}
              </div>
              <input
                type="text"
                className="usernameSearchInput"
                placeholder="กรอกเลขประจำตัวประชาชน 13 หลัก เช่น 1529900xxxxxx"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                maxLength={13}
                autoFocus
              />
              {usernameInput && (
                <button
                  type="button"
                  className="clearInputBtn"
                  onClick={() => setUsernameInput('')}
                  title="ล้างข้อมูล"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="searchSubmitBtn"
              disabled={loading || !usernameInput.trim()}
              title="ค้นหาข้อมูล"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              <span>ค้นหา</span>
            </button>
          </form>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alertBox alertDanger card no-print">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Member Profile Banner (When found) */}
        {member && (
          <div className="employeeInfoCard card no-print">
            <div className="employeeMainInfo">
              <div className="avatarCircle">
                <User size={30} />
              </div>
              <div className="employeeDetails">
                <div className="nameBadgeRow">
                  <h3 className="employeeName">{displayName}</h3>
                  <span className="usernamePill">@{member.username}</span>
                </div>
                <div className="metaGrid">
                  <span className="metaItem">
                    <Briefcase size={14} />
                    <strong>ตำแหน่ง:</strong> {member.position || '-'}
                  </span>
                  <span className="metaItem">
                    <Building size={14} />
                    <strong>กลุ่มงาน/ฝ่าย:</strong> {member.department || '-'}
                  </span>
                  <span className="metaItem">
                    <strong>เลขที่บัญชี:</strong> <span className="highlightNumber">{displayAccount}</span>
                  </span>
                  {paymentDate && (
                    <span className="metaItem">
                      <Calendar size={14} />
                      <strong>วันที่เงินโอนเข้า:</strong> {formatThaiDate(paymentDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STATEMENT EXPORT CARD (1m, 3m, 6m, 1y)                    */}
        {/* ========================================================= */}
        {member && (
          <div className="statementExportCard card no-print">
            <div className="statementCardHeader">
              <div className="statementTitleGroup">
                <div className="statementIconCircle">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="statementTitle">ออกหนังสือรับรองและสรุปรายการเงินได้-รายการหัก</h3>
                  <p className="statementSubtitle">
                    สรุปรายรับเงินเดือนและค่าตอบแทนล่วงเวลา (OT) สำหรับยื่นสินเชื่อธนาคาร ธุรกรรมทางการเงิน หรือคำนวณภาษี
                  </p>
                </div>
              </div>
            </div>

            {/* Range Presets & Custom Month Selector */}
            <div className="statementRangeSection">
              <div className="rangePresetsHeader">
                <span className="rangeSectionLabel">เลือกระยะเวลา:</span>
                <div className="statementRangePills">
                  <button
                    type="button"
                    className={`rangePill ${!isCustomRange && statementRange === '1m' ? 'active' : ''}`}
                    onClick={() => handleRangeChange('1m')}
                  >
                    <span className="pillTitle">1 เดือน</span>
                    <span className="pillDesc">งวดล่าสุด</span>
                  </button>

                  <button
                    type="button"
                    className={`rangePill ${!isCustomRange && statementRange === '3m' ? 'active' : ''}`}
                    onClick={() => handleRangeChange('3m')}
                  >
                    <span className="pillTitle">3 เดือน</span>
                    <span className="pillDesc">3 งวด</span>
                  </button>

                  <button
                    type="button"
                    className={`rangePill ${!isCustomRange && statementRange === '6m' ? 'active' : ''}`}
                    onClick={() => handleRangeChange('6m')}
                  >
                    <span className="pillBadge">แนะนำยื่นกู้</span>
                    <span className="pillTitle">6 เดือน</span>
                    <span className="pillDesc">6 งวด</span>
                  </button>

                  <button
                    type="button"
                    className={`rangePill ${!isCustomRange && statementRange === '1y' ? 'active' : ''}`}
                    onClick={() => handleRangeChange('1y')}
                  >
                    <span className="pillBadge info">สรุปภาษี</span>
                    <span className="pillTitle">1 ปี</span>
                    <span className="pillDesc">12 งวด</span>
                  </button>
                </div>
              </div>

              {/* Custom Month Range Dropdowns */}
              {availablePeriods.length > 0 && (
                <div className="customRangeDropdownsRow">
                  <span className="customRangeLabel">หรือระบุช่วงงวดเดือนเอง:</span>
                  <div className="customRangeSelectors">
                    <div className="periodSelectGroup">
                      <label htmlFor="fromPeriodSelect">ตั้งแต่งวด:</label>
                      <select
                        id="fromPeriodSelect"
                        className="periodSelect"
                        value={fromPeriod}
                        onChange={(e) => handleCustomPeriodChange(e.target.value, toPeriod)}
                      >
                        {availablePeriods.map((p) => (
                          <option key={`from-${p}`} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="rangeSeparator">ถึง</span>

                    <div className="periodSelectGroup">
                      <label htmlFor="toPeriodSelect">ถึงงวด:</label>
                      <select
                        id="toPeriodSelect"
                        className="periodSelect"
                        value={toPeriod}
                        onChange={(e) => handleCustomPeriodChange(fromPeriod, e.target.value)}
                      >
                        {availablePeriods.map((p) => (
                          <option key={`to-${p}`} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isCustomRange && (
                      <span className="customRangeBadge">ช่วงกำหนดเอง</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="statementActionsRow">
              <div className="statementActionsLeft">
                <button
                  type="button"
                  className="statementBtn btnExcel"
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel || statementLoading}
                  title="ดาวน์โหลดเป็นไฟล์ Excel (.xlsx)"
                >
                  {downloadingExcel ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                  <span>ดาวน์โหลด Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  className="statementBtn btnPrint"
                  onClick={handlePrintStatement}
                  disabled={statementLoading}
                  title="พิมพ์หนังสือรับรองสเตทเมนต์ หรือบันทึกเป็น PDF"
                >
                  {statementLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Printer size={18} />
                  )}
                  <span>พิมพ์หนังสือรับรอง (PDF / Print)</span>
                </button>
              </div>
            </div>

            {/* Statement Error if any */}
            {statementError && (
              <div className="statementAlert alertDanger">
                <AlertCircle size={16} />
                <span>{statementError}</span>
              </div>
            )}
          </div>
        )}

        {/* Period Selector & Data Panels (Monthly View) */}
        {member && (
          <div className="no-print">
            {/* Period Filters */}
            {years.length > 0 && (
              <div className="filtersCard card">
                <h3>เลือกงวดสลิปประจำเดือน/ปี พ.ศ.</h3>
                <div className="filtersRow">
                  <div className="selectGroup">
                    <label>ประจำปี พ.ศ.</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="styledSelect"
                      disabled={loading}
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>พ.ศ. {y}</option>
                      ))}
                    </select>
                  </div>

                  <div className="selectGroup">
                    <label>ประจำเดือน</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => handleMonthChange(e.target.value)}
                      className="styledSelect"
                      disabled={loading}
                    >
                      {[
                        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                      ].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs: Salary vs OT */}
            <div className="tabsContainer">
              <button
                className={`tabButton ${activeTab === 'salary' ? 'active' : ''}`}
                onClick={() => setActiveTab('salary')}
              >
                <FileText size={18} />
                <span>สลิปเงินเดือน (Salary)</span>
              </button>
              <button
                className={`tabButton ${activeTab === 'ot' ? 'active' : ''}`}
                onClick={() => setActiveTab('ot')}
              >
                <Clock size={18} />
                <span>ค่าล่วงเวลาและอื่นๆ (OT)</span>
              </button>
            </div>

            {/* Tab Content: Salary */}
            {activeTab === 'salary' && (
              salaryData ? (
                <div className="breakdownGrid">
                  {/* Earnings */}
                  <div className="slipCard card earningCard">
                    <div className="slipCardHeader">
                      <h4>รายรับ (Earnings)</h4>
                      <span className="totalBadge earningBadge">+{salaryData.c11} บาท</span>
                    </div>
                    <ul className="itemList">
                      <li><span>เงินเดือน</span><strong>{salaryData.c5 || '0.00'}</strong></li>
                      <li><span>ตกเบิกเงินเดือน</span><strong>{salaryData.c6 || '0.00'}</strong></li>
                      <li><span>เงินคืนประกันสังคม</span><strong>{salaryData.c7 || '0.00'}</strong></li>
                    </ul>
                  </div>

                  {/* Deductions */}
                  <div className="slipCard card deductionCard">
                    <div className="slipCardHeader">
                      <h4>รายจ่าย (Deductions)</h4>
                      <span className="totalBadge deductionBadge">-{salaryData.c25} บาท</span>
                    </div>
                    <ul className="itemList">
                      <li><span>ประกันสังคม</span><strong>{salaryData.c12 || '0.00'}</strong></li>
                      <li><span>เก็บเพิ่มประกันสังคม</span><strong>{salaryData.c13 || '0.00'}</strong></li>
                      <li><span>กองทุนสำรองเลี้ยงชีพ</span><strong>{salaryData.c14 || '0.00'}</strong></li>
                      <li><span>ฌาปนกิจสงเคราะห์</span><strong>{salaryData.c15 || '0.00'}</strong></li>
                      <li><span>ธนาคารออมสิน</span><strong>{salaryData.c16 || '0.00'}</strong></li>
                      <li><span>ธนาคารกรุงไทย</span><strong>{salaryData.c23 || '0.00'}</strong></li>
                      <li><span>ธ.ก.ส.</span><strong>{salaryData.c21 || '0.00'}</strong></li>
                      <li><span>ธนาคารอิสลาม</span><strong>{salaryData.c22 || '0.00'}</strong></li>
                      <li><span>เงินสวัสดิการ รพ.</span><strong>{salaryData.c24 || '0.00'}</strong></li>
                      <li><span>กยศ.</span><strong>{salaryData.c20 || '0.00'}</strong></li>
                      <li><span>ค่าทำความสะอาด</span><strong>{salaryData.c19 || '0.00'}</strong></li>
                      <li><span>ค่าไฟฟ้า</span><strong>{salaryData.c17 || '0.00'}</strong></li>
                      <li><span>ค่าน้ำประปา</span><strong>{salaryData.c18 || '0.00'}</strong></li>
                    </ul>
                  </div>

                  {/* Net Pay Card */}
                  <div className="slipCard card netPayCard">
                    <div className="netPayWrapper">
                      <div className="netPayLabel">คงเหลือสุทธิ (Net Pay)</div>
                      <div className="netPayAmount">{salaryData.c26} <span className="unit">บาท</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="emptyStateCard card">
                  <AlertCircle size={36} className="emptyIcon" />
                  <h4>ไม่พบข้อมูลสลิปเงินเดือน</h4>
                  <p>ไม่พบรายการเงินเดือนของบุคลากรท่านนี้ ในงวดเดือน {selectedMonth} ปี พ.ศ. {selectedYear}</p>
                </div>
              )
            )}

            {/* Tab Content: OT */}
            {activeTab === 'ot' && (
              otData ? (
                <div className="breakdownGrid">
                  {/* Earnings */}
                  <div className="slipCard card earningCard">
                    <div className="slipCardHeader">
                      <h4>รายรับ (Earnings)</h4>
                      <span className="totalBadge earningBadge">+{otData.c15} บาท</span>
                    </div>
                    <ul className="itemList">
                      <li><span>ฉ.11</span><strong>{otData.c5 || '0.00'}</strong></li>
                      <li><span>ค่าเวร / OT</span><strong>{otData.c6 || '0.00'}</strong></li>
                      <li><span>เบี้ยเลี้ยง / เงินชดเชย</span><strong>{otData.c7 || '0.00'}</strong></li>
                      <li><span>ค่าตอบแทนพิเศษ (P4P / พ.ต.ส.)</span><strong>{otData.c8 || '0.00'}</strong></li>
                    </ul>
                  </div>

                  {/* Deductions */}
                  <div className="slipCard card deductionCard">
                    <div className="slipCardHeader">
                      <h4>รายจ่าย (Deductions)</h4>
                      <span className="totalBadge deductionBadge">-{otData.c22} บาท</span>
                    </div>
                    <ul className="itemList">
                      <li><span>ภาษีหัก ณ ที่จ่าย 5%</span><strong>{otData.c16 || '0.00'}</strong></li>
                      <li><span>ค่าบำรุงหอพัก / ค่าไฟฟ้า</span><strong>{otData.c17 || '0.00'}</strong></li>
                      <li><span>ค่าน้ำประปา</span><strong>{otData.c18 || '0.00'}</strong></li>
                      <li><span>ค่าทำความสะอาด</span><strong>{otData.c21 || '0.00'}</strong></li>
                      <li><span>ค่าสวัสดิการ / อื่นๆ</span><strong>{otData.c19 || '0.00'}</strong></li>
                    </ul>
                  </div>

                  {/* Net Pay Card */}
                  <div className="slipCard card netPayCard">
                    <div className="netPayWrapper">
                      <div className="netPayLabel">คงเหลือสุทธิ (Net Pay)</div>
                      <div className="netPayAmount">{otData.c23} <span className="unit">บาท</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="emptyStateCard card">
                  <AlertCircle size={36} className="emptyIcon" />
                  <h4>ไม่พบข้อมูลสลิปค่าล่วงเวลา (OT)</h4>
                  <p>ไม่พบรายการค่าล่วงเวลาของบุคลากรท่านนี้ ในงวดเดือน {selectedMonth} ปี พ.ศ. {selectedYear}</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Blank state when no input entered yet */}
        {!usernameInput && (
          <div className="initialBlankCard card no-print">
            <div className="blankIconCircle">
              <Search size={32} />
            </div>
            <h3>พร้อมสำหรับการสืบค้น</h3>
            <p>กรอกเลขประจำตัวประชาชน 13 หลัก ของบุคลากรในช่องค้นหาด้านบน เพื่อเรียกดูสลิปเงินเดือนและออกหนังสือรับรองเงินได้ทันที</p>
          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* PRINTABLE OFFICIAL STATEMENT DOCUMENT (A4 PRINT ONLY)     */}
      {/* ========================================================= */}
      {statementData && (
        <div className="statementPrintOnlyDoc" aria-hidden="true">
          {(() => {
            const txList = statementData.transactions && statementData.transactions.length > 0
              ? statementData.transactions
              : buildStatementTransactions(statementData.records)

            // Fill page naturally up to 22 rows per A4 page before breaking to the next page
            const ROWS_PER_PAGE = 22
            const pages: (typeof txList)[] = []
            if (txList.length === 0) {
              pages.push([])
            } else {
              for (let i = 0; i < txList.length; i += ROWS_PER_PAGE) {
                pages.push(txList.slice(i, i + ROWS_PER_PAGE))
              }
            }
            const totalPages = pages.length

            return pages.map((pageItems, pageIndex) => {
              const isLastPage = pageIndex === totalPages - 1

              return (
                <div key={pageIndex} className="statementPrintPage">
                  {/* Official Letterhead */}
                  <div className="statementPrintHeader">
                    <div className="statementPrintLogoRow">
                      <div className="statementPrintBrandGroup">
                        <Image
                          src="/images/common/logo-website.webp"
                          alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
                          width={52}
                          height={52}
                          className="statementPrintLogo"
                          unoptimized
                          priority
                        />
                        <div className="statementPrintHeaderText">
                          <h2>โรงพยาบาลเถิน สำนักงานสาธารณสุขจังหวัดลำปาง</h2>
                          <h3>หนังสือรับรองและสรุปรายการเงินได้-รายการหัก</h3>
                          <p className="statementPrintDocSub">
                            ช่วงงวด: <strong>{statementData.summary.fromPeriod}</strong> ถึง <strong>{statementData.summary.toPeriod}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="statementPrintPageNumber">
                        หน้า {pageIndex + 1}/{totalPages}
                      </div>
                    </div>
                  </div>

                  {/* Member Profile Info Box */}
                  <div className="statementPrintInfoBox">
                    <div className="statementPrintInfoRow">
                      <div>
                        <span className="infoLabel">ชื่อ-นามสกุล:</span>
                        <span className="infoVal bold">{statementData.member.name || '-'}</span>
                      </div>
                      <div>
                        <span className="infoLabel">รหัสประจำตัว:</span>
                        <span className="infoVal">{statementData.member.username}</span>
                      </div>
                    </div>
                    <div className="statementPrintInfoRow">
                      <div>
                        <span className="infoLabel">ตำแหน่ง:</span>
                        <span className="infoVal">{statementData.member.position || '-'}</span>
                      </div>
                      <div>
                        <span className="infoLabel">กลุ่มงาน/ฝ่าย:</span>
                        <span className="infoVal">{statementData.member.department || '-'}</span>
                      </div>
                    </div>
                    <div className="statementPrintInfoRow">
                      <div>
                        <span className="infoLabel">เลขที่บัญชีธนาคาร:</span>
                        <span className="infoVal bold">{statementData.member.accountNumber || '-'}</span>
                      </div>
                      <div>
                        <span className="infoLabel">วันที่ออกเอกสาร:</span>
                        <span className="infoVal">{formatThaiDate(new Date().toISOString())}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details Table */}
                  <div className="statementPrintTableTitle">
                    รายการเคลื่อนไหวทางบัญชี
                  </div>
                  <table className="statementPrintTable">
                    <thead>
                      <tr>
                        <th style={{ width: '6%' }}>ลำดับ</th>
                        <th style={{ width: '15%' }}>วันที่</th>
                        <th style={{ width: '37%' }}>รายการ</th>
                        <th style={{ width: '14%' }}>ถอน / รายการหัก</th>
                        <th style={{ width: '14%' }}>ฝาก / รายรับ</th>
                        <th style={{ width: '14%' }}>ยอดคงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="textCenter">
                            ไม่พบข้อมูลสำหรับช่วงเวลานี้
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((tx) => (
                          <tr key={tx.index}>
                            <td className="textCenter">{tx.index}</td>
                            <td className="textCenter">{tx.date}</td>
                            <td className="textLeft">{tx.details}</td>
                            <td className="textRight">
                              {tx.withdrawal > 0 ? `-${formatMoney(tx.withdrawal)}` : '-'}
                            </td>
                            <td className="textRight fontBold">
                              {tx.deposit > 0 ? `+${formatMoney(tx.deposit)}` : '-'}
                            </td>
                            <td className="textRight fontBold">{formatMoney(tx.balance)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="printTotalRow">
                          <td colSpan={3} className="textCenter fontBold">รวมทั้งสิ้น</td>
                          <td className="textRight fontBold">-{formatMoney(statementData.summary.totalDeductions)}</td>
                          <td className="textRight fontBold">+{formatMoney(statementData.summary.totalEarnings)}</td>
                          <td className="textRight fontBold">{formatMoney(statementData.summary.totalNetPay)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )
            })
          })()}
        </div>
      )}

    </div>
  )
}
