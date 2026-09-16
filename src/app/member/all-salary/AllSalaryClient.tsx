'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, User, Building, Briefcase, Calendar, FileText, Clock, AlertCircle, Loader2 } from 'lucide-react'
import './page.css'

interface MemberInfo {
  id: number
  username: string
  name: string | null
  department: string | null
  position: string | null
  salary_user: string | null
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

  const monthShortNameMap: Record<number, string> = {
    1: 'ม.ค.', 2: 'ก.พ.', 3: 'มี.ค.', 4: 'เม.ย.', 5: 'พ.ค.', 6: 'มิ.ย.',
    7: 'ก.ค.', 8: 'ส.ค.', 9: 'ก.ย.', 10: 'ต.ค.', 11: 'พ.ย.', 12: 'ธ.ค.'
  }

  // Auto-search effect when usernameInput changes (debounced)
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
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSalaryData(trimmed)
    }, 400) // 400ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [usernameInput])

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

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = date.getFullYear() + 543
    const monthCut = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
    const month = monthCut[date.getMonth() + 1]
    const day = date.getDate()
    return `${day} ${month} ${year}`
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
        <div className="pageTopBar">
          <Link href="/member" className="backLink">
            <ArrowLeft size={18} />
            <span>กลับหน้าหลักสมาชิก</span>
          </Link>
          <span className="badgeRole">ระบบงานสารบรรณ / ธุรการ</span>
        </div>

        {/* Search Header Card */}
        <div className="searchBoxCard card">
          <div className="searchCardHeader">
            <h2>ระบบค้นหาสลิปเงินเดือนบุคลากร</h2>
            <p>พิมพ์ชื่อผู้ใช้ หรือ เลขประจำตัวประชาชน 13 หลัก ของบุคลากร เพื่อดูสลิปเงินเดือนและโอทีได้ทันทีโดยไม่ต้องกดค้นหา</p>
          </div>

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
              placeholder="กรอกชื่อผู้ใช้ หรือ เลขประจำตัวประชาชน 13 หลัก เช่น 1529900..."
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
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
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alertBox alertDanger card">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Member Profile Banner (When found) */}
        {member && (
          <div className="employeeInfoCard card">
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

        {/* Period Selector & Data Panels */}
        {member && (
          <>
            {/* Period Filters */}
            {years.length > 0 && (
              <div className="filtersCard card">
                <h3>เลือกงวดประจำเดือน/ปี พ.ศ.</h3>
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
          </>
        )}

        {/* Blank state when no input entered yet */}
        {!usernameInput && (
          <div className="initialBlankCard card">
            <div className="blankIconCircle">
              <Search size={32} />
            </div>
            <h3>พร้อมสำหรับการสืบค้น</h3>
            <p>พิมพ์ชื่อผู้ใช้งาน หรือ เลขประจำตัวประชาชน 13 หลัก ของบุคลากรในช่องค้นหาด้านบน เพื่อเรียกดูสลิปเงินเดือนทันที</p>
          </div>
        )}

      </div>
    </div>
  )
}
