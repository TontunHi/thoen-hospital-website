'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import './page.css'

export default function SalaryDashboardPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  
  const [salaryData, setSalaryData] = useState<any>(null)
  const [otData, setOtData] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'salary' | 'ot'>('salary')

  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  // 1. Fetch initial session and available periods
  useEffect(() => {
    async function loadSession() {
      try {
        const dataRes = await fetch('/api/salary/data')
        if (dataRes.status === 401) {
          // Attempt auto-login using SSO
          const ssoRes = await fetch('/api/salary/login')
          const ssoData = await ssoRes.json()
          
          if (ssoRes.ok && ssoData.success) {
            // SSO success, retry fetching data
            const retryRes = await fetch('/api/salary/data')
            if (retryRes.ok) {
              const data = await retryRes.json()
              setYears(data.years || [])
              setSelectedYear(data.selectedYear || '')
              setSelectedMonth(data.selectedMonth || '')
              setSalaryData(data.salary)
              setOtData(data.ot)
              setName(data.userName || '')
              setLoading(false)
              return
            }
          }
          
          // If SSO fails or not authenticated
          if (ssoData.authenticated === false) {
            window.location.href = '/member/login'
          } else if (ssoData.hasSalaryCredentials === false) {
            setError('คุณยังไม่ได้ผูกข้อมูลระบบเงินเดือน กรุณาผูกข้อมูลในหน้าระบบสมาชิกก่อน')
          } else {
            setError(ssoData.error || 'การเข้าสู่ระบบเงินเดือนอัตโนมัติล้มเหลว')
          }
          setLoading(false)
          return
        }

        const data = await dataRes.json()
        if (dataRes.ok) {
          setYears(data.years || [])
          setSelectedYear(data.selectedYear || '')
          setSelectedMonth(data.selectedMonth || '')
          setSalaryData(data.salary)
          setOtData(data.ot)
          setName(data.userName || '')
        } else {
          setError(data.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }
      } catch (err) {
        setError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้')
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [])

  // Fetch data when filter changes
  const handleFilterChange = async (year: string, month: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/salary/data?year=${year}&month=${month}`)
      if (res.status === 401) {
        // Attempt SSO auto-login
        const ssoRes = await fetch('/api/salary/login')
        const ssoData = await ssoRes.json()
        if (ssoRes.ok && ssoData.success) {
          const retryRes = await fetch(`/api/salary/data?year=${year}&month=${month}`)
          if (retryRes.ok) {
            const data = await retryRes.json()
            setSalaryData(data.salary)
            setOtData(data.ot)
            setLoading(false)
            return
          }
        }
        
        if (ssoData.authenticated === false) {
          window.location.href = '/member/login'
        } else {
          setError(ssoData.error || 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบหลักใหม่')
        }
        setLoading(false)
        return
      }
      const data = await res.json()
      if (res.ok) {
        setSalaryData(data.salary)
        setOtData(data.ot)
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      }
    } catch {
      setError('ไม่สามารถดึงข้อมูลสำหรับช่วงเวลาที่เลือกได้')
    } finally {
      setLoading(false)
    }
  }

  const onYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedYear(val)
    handleFilterChange(val, selectedMonth)
  }

  const onMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedMonth(val)
    handleFilterChange(selectedYear, val)
  }

  // Get employee full name from salary or ot data
  const displayName = name || salaryData?.c4?.trim() || otData?.c4?.trim() || 'บุคลากรโรงพยาบาลเถิน'
  const displayAccount = salaryData?.c3 || otData?.c3 || '-'
  const paymentDate = salaryData?.c1 || otData?.c1

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = date.getFullYear() + 543
    const monthCut = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
    const month = monthCut[date.getMonth() + 1]
    const day = date.getDate()
    return `${day} ${month} ${year}`
  }

  return (
    <div className="salaryPage">
      <div className="container salaryContainer">
        
        {/* User Info Header Panel */}
        <header className="salaryHeader card">
          <div className="salaryUserPanel">
            <div className="salaryUserInfo">
              <h2>ยินดีต้อนรับเข้าสู่ระบบข้อมูลเงินเดือน</h2>
              <h1 className="salaryUserName">{displayName}</h1>
              <p className="salaryUserRole">
                บัญชีธนาคารเลขที่: <span className="highlight-text">{displayAccount}</span>
                {paymentDate && (
                  <> | วันที่เงินโอนเข้า: <span className="highlight-text">{formatThaiDate(paymentDate)}</span></>
                )}
              </p>
            </div>
          </div>
          {/* Removed LogoutButton as per user request */}
        </header>

        {/* Filters Panel */}
        <section className="salaryFiltersCard card">
          <h3>เลือกช่วงเวลาตรวจสอบสลิป</h3>
          <div className="filtersGrid">
            <div className="filterGroup">
              <label htmlFor="yearFilter">ประจำปี พ.ศ.</label>
              <select 
                id="yearFilter" 
                value={selectedYear} 
                onChange={onYearChange}
                className="filterSelect"
                disabled={loading || years.length === 0}
              >
                {years.length === 0 ? (
                  <option value="">ไม่มีข้อมูลปี</option>
                ) : (
                  years.map(y => (
                    <option key={y} value={y}>พ.ศ. {y}</option>
                  ))
                )}
              </select>
            </div>

            <div className="filterGroup">
              <label htmlFor="monthFilter">ประจำเดือน</label>
              <select 
                id="monthFilter" 
                value={selectedMonth} 
                onChange={onMonthChange}
                className="filterSelect"
                disabled={loading}
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Slips Tab Toggle */}
        <div className="systemsTabs">
          <button 
            className={`tabBtn ${activeTab === 'salary' ? 'active' : ''}`}
            onClick={() => setActiveTab('salary')}
          >
            รายละเอียดเงินเดือน
          </button>
          <button 
            className={`tabBtn ${activeTab === 'ot' ? 'active' : ''}`}
            onClick={() => setActiveTab('ot')}
          >
            รายละเอียดค่าล่วงเวลา (OT)
          </button>
        </div>

        {/* Error Alert */}
        {error && <div className="salaryAlert alert-danger">{error}</div>}

        {/* Loading Spinner */}
        {loading ? (
          <div className="salaryLoadingPanel card">
            <div className="spinner"></div>
            <p>กำลังค้นหาข้อมูลในระบบฐานข้อมูลเงินเดือน...</p>
          </div>
        ) : (
          <div className="tabContent">
            
            {/* 1. SALARY SLIP TAB */}
            {activeTab === 'salary' && (
              salaryData ? (
                <div className="slipBreakdownGrid">
                  
                  {/* Earnings Card */}
                  <div className="slipCard card earningCard">
                    <div className="slipCardHeader">
                      <h3>รายรับ (Earnings)</h3>
                      <span className="totalPill totalEarning">+{salaryData.c11} บาท</span>
                    </div>
                    <ul className="slipList">
                      <li>
                        <span>เงินเดือน</span>
                        <strong>{salaryData.c5 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ตกเบิกเงินเดือน</span>
                        <strong>{salaryData.c6 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>เงินคืนประกันสังคม</span>
                        <strong>{salaryData.c7 || '0.00'}</strong>
                      </li>
                    </ul>
                  </div>

                  {/* Deductions Card */}
                  <div className="slipCard card deductionCard">
                    <div className="slipCardHeader">
                      <h3>รายจ่าย (Deductions)</h3>
                      <span className="totalPill totalDeduction">-{salaryData.c25} บาท</span>
                    </div>
                    <ul className="slipList">
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

                  {/* Net Pay Card (Span 2 columns) */}
                  <div className="slipCard card netPayCard">
                    <div className="netPayWrapper">
                      <div className="netPayTitle">คงเหลือสุทธิ (Net Pay)</div>
                      <div className="netPayValue">{salaryData.c26} <span className="currency">บาท</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="salaryEmptyPanel card">
                  <div className="emptyIcon"></div>
                  <h3>ไม่พบข้อมูลสลิปเงินเดือน</h3>
                  <p>ไม่พบรายการข้อมูลเงินเดือนในช่วงเวลาประจำเดือน {selectedMonth} ปี พ.ศ. {selectedYear}</p>
                </div>
              )
            )}

            {/* 2. OVERTIME (OT) SLIP TAB */}
            {activeTab === 'ot' && (
              otData ? (
                <div className="slipBreakdownGrid">
                  
                  {/* Earnings Card */}
                  <div className="slipCard card earningCard">
                    <div className="slipCardHeader">
                      <h3>รายรับ (Earnings)</h3>
                      <span className="totalPill totalEarning">+{otData.c15} บาท</span>
                    </div>
                    <ul className="slipList">
                      <li>
                        <span>ค่าตอบแทนล่วงเวลา (โอที)</span>
                        <strong>{otData.c5 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ค่าเวรบ่าย-ดึก / ค่าเวร</span>
                        <strong>{otData.c6 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>เบี้ยเลี้ยง / เงินชดเชย</span>
                        <strong>{otData.c7 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ค่าตอบแทนพิเศษ (P4P / พ.ต.ส.)</span>
                        <strong>{otData.c8 || '0.00'}</strong>
                      </li>
                    </ul>
                  </div>

                  {/* Deductions Card */}
                  <div className="slipCard card deductionCard">
                    <div className="slipCardHeader">
                      <h3>รายจ่าย (Deductions)</h3>
                      <span className="totalPill totalDeduction">-{otData.c22} บาท</span>
                    </div>
                    <ul className="slipList">
                      <li>
                        <span>ภาษีหัก ณ ที่จ่าย 5%</span>
                        <strong>{otData.c16 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ค่าบำรุงหอพัก / ค่าไฟฟ้า</span>
                        <strong>{otData.c17 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ค่าน้ำประปา</span>
                        <strong>{otData.c18 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ค่าสวัสดิการ / อื่นๆ</span>
                        <strong>{otData.c19 || '0.00'}</strong>
                      </li>
                    </ul>
                  </div>

                  {/* Net Pay Card (Span 2 columns) */}
                  <div className="slipCard card netPayCard">
                    <div className="netPayWrapper">
                      <div className="netPayTitle">คงเหลือสุทธิ (Net Pay)</div>
                      <div className="netPayValue">{otData.c23} <span className="currency">บาท</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="salaryEmptyPanel card">
                  <div className="emptyIcon"></div>
                  <h3>ไม่พบข้อมูลสลิปค่าล่วงเวลา (OT)</h3>
                  <p>ไม่พบรายการข้อมูลค่าล่วงเวลาในช่วงเวลาประจำเดือน {selectedMonth} ปี พ.ศ. {selectedYear}</p>
                </div>
              )
            )}

          </div>
        )}

      </div>
    </div>
  )
}
