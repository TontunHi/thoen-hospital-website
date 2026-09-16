'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toPng } from 'html-to-image'
import './page.css'

export default function SalaryDashboardPage() {
  const [name, setName] = useState('')
  const printDocRef = useRef<HTMLDivElement>(null)
  const [isExportingImage, setIsExportingImage] = useState(false)

  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  
  const [salaryData, setSalaryData] = useState<any>(null)
  const [otData, setOtData] = useState<any>(null)
  const [calendarData, setCalendarData] = useState<any[] | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'salary' | 'ot'>('salary')

  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  const monthShortNameMap: Record<number, string> = {
    1: 'ม.ค.', 2: 'ก.พ.', 3: 'มี.ค.', 4: 'เม.ย.', 5: 'พ.ค.', 6: 'มิ.ย.',
    7: 'ก.ค.', 8: 'ส.ค.', 9: 'ก.ย.', 10: 'ต.ค.', 11: 'พ.ย.', 12: 'ธ.ค.'
  }

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
              setCalendarData(data.calendar || null)
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
          setCalendarData(data.calendar || null)
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
            setCalendarData(data.calendar || null)
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
        setCalendarData(data.calendar || null)
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

  const now = new Date()
  const currentMonthName = monthShortNameMap[now.getMonth() + 1] || ''
  const currentYearBuddhist = now.getFullYear() + 543

  const handleExportImage = async () => {
    if (!printDocRef.current || isExportingImage) return
    setIsExportingImage(true)
    let cloneContainer: HTMLDivElement | null = null
    try {
      // 1. Create a hidden wrapper offscreen at top/left: 0 but behind everything
      cloneContainer = document.createElement('div')
      cloneContainer.style.position = 'fixed'
      cloneContainer.style.top = '0'
      cloneContainer.style.left = '0'
      cloneContainer.style.width = '820px'
      cloneContainer.style.zIndex = '-99999'
      cloneContainer.style.pointerEvents = 'none'
      cloneContainer.style.overflow = 'hidden'

      // 2. Clone the printable document into the container
      const clone = printDocRef.current.cloneNode(true) as HTMLDivElement
      clone.classList.add('isCapturingImage')
      // Ensure clone is visibly displayed and full opacity inside the container
      clone.style.display = 'block'
      clone.style.position = 'static'
      clone.style.opacity = '1'
      clone.style.visibility = 'visible'

      cloneContainer.appendChild(clone)
      document.body.appendChild(cloneContainer)

      // Wait for clone DOM layout and images to settle
      await new Promise(resolve => setTimeout(resolve, 200))

      const dataUrl = await toPng(clone, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 820,
      })

      const link = document.createElement('a')
      link.download = `สลิปเงินเดือน_${displayName.replace(/\s+/g, '_')}_${selectedMonth}_${selectedYear}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to export image:', err)
      alert('ไม่สามารถบันทึกเป็นรูปภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      if (cloneContainer && cloneContainer.parentNode) {
        cloneContainer.parentNode.removeChild(cloneContainer)
      }
      setIsExportingImage(false)
    }
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

        {/* Salary Import Calendar Section */}
        {calendarData && calendarData.length > 0 && (
          <section className="salaryCalendarCard card">
            <div className="salaryCalendarHeader">
              <h3>
                ปฏิทินนำเข้าเงินเดือนและรายได้อื่นๆ <br className="mobileOnlyBreak" />
                ประจำเดือน <span className="calendarHighlight">{currentMonthName} {currentYearBuddhist}</span>
              </h3>
            </div>
            <div className="tableResponsive">
              <table className="salaryCalendarTable">
                <thead>
                  <tr>
                    <th>ประเภท</th>
                    <th className="textCenter">วันที่</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarData.map((item: any, idx: number) => {
                    const dateObj = new Date(item.datein)
                    const dayNum = dateObj.getDate()
                    const typeText = String(item.type) === '1' 
                      ? 'เงินเดือน' 
                      : 'ค่าปฏิบัติงานล่วงเวลา หรือรายได้อื่นๆ'

                    return (
                      <tr key={item.id || idx}>
                        <td>{typeText}</td>
                        <td className="textCenter">{dayNum}</td>
                        <td>{item.notesalary || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Filters Panel */}
        <section className="salaryFiltersCard card">
          <div className="salaryFiltersHeader">
            <h3>เลือกช่วงเวลาตรวจสอบสลิป</h3>
            {(salaryData || otData) && (
              <div className="printActionGroup">
                <button 
                  type="button"
                  className="printSlipBtn"
                  onClick={() => window.print()}
                  title="พิมพ์เอกสารสลิปเงินเดือน / บันทึกเป็น PDF"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  <span>พิมพ์เอกสาร / PDF</span>
                </button>

                <button 
                  type="button"
                  className="printSlipBtn imageSlipBtn"
                  onClick={handleExportImage}
                  disabled={isExportingImage}
                  title="บันทึกสลิปเงินเดือนเป็นรูปภาพ (PNG)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>{isExportingImage ? 'กำลังบันทึกรูปภาพ...' : 'บันทึกเป็นรูปภาพ'}</span>
                </button>
              </div>
            )}
          </div>
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
                        <span>ฉ.11</span>
                        <strong>{otData.c5 || '0.00'}</strong>
                      </li>
                      <li>
                        <span>ค่าเวร / OT</span>
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

        {/* Printable Document (Hidden on screen, shown only when printing or exporting image) */}
        {(salaryData || otData) && (
          <div ref={printDocRef} className="salaryPrintOnlyDoc" aria-hidden="true">
            {/* Print Header */}
            <div className="printDocHeader">
              <div className="printLogoSection">
                <Image 
                  src="/images/common/logo-website.webp" 
                  alt="โรงพยาบาลเถิน" 
                  width={65} 
                  height={65}
                  className="printLogoImage"
                  unoptimized
                  priority
                />
                <div className="printHeaderText">
                  <h2>โรงพยาบาลเถิน จังหวัดลำปาง</h2>
                  <p className="printSubText">สำนักงานสาธารณสุขจังหวัดลำปาง</p>
                  <h1>ใบแจ้งยอดเงินเดือนและค่าตอบแทนรายบุคคล</h1>
                  <p className="printPeriodText">
                    ประจำเดือน <strong>{selectedMonth}</strong> พ.ศ. <strong>{selectedYear}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Employee Information */}
            <div className="printInfoBox">
              <div className="printInfoRow">
                <div className="printInfoCol">
                  <span className="infoLabel">ชื่อ-นามสกุล:</span>
                  <span className="infoValue bold">{displayName}</span>
                </div>
                <div className="printInfoCol">
                  <span className="infoLabel">เลขที่บัญชีธนาคาร:</span>
                  <span className="infoValue">{displayAccount}</span>
                </div>
              </div>
              <div className="printInfoRow">
                <div className="printInfoCol">
                  <span className="infoLabel">วันที่โอนเงินเข้าบัญชี:</span>
                  <span className="infoValue">{paymentDate ? formatThaiDate(paymentDate) : '-'}</span>
                </div>
                <div className="printInfoCol">
                  <span className="infoLabel">วันที่พิมพ์เอกสาร:</span>
                  <span className="infoValue">{formatThaiDate(now.toISOString())}</span>
                </div>
              </div>
            </div>

            {/* Section 1: Salary */}
            {salaryData && (
              <div className="printSection">
                <div className="printSectionTitle">
                  <span>1. รายละเอียดเงินเดือน (Regular Salary)</span>
                </div>
                <div className="printTablesGrid">
                  {/* Earnings Table */}
                  <table className="printTable printEarningsTable">
                    <thead>
                      <tr>
                        <th>รายการได้ (Earnings)</th>
                        <th className="numCol">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>เงินเดือน</td>
                        <td className="numCol">{salaryData.c5 || '0.00'}</td>
                      </tr>
                      <tr>
                        <td>ตกเบิกเงินเดือน</td>
                        <td className="numCol">{salaryData.c6 || '0.00'}</td>
                      </tr>
                      <tr>
                        <td>เงินคืนประกันสังคม</td>
                        <td className="numCol">{salaryData.c7 || '0.00'}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>รวมรายการได้</th>
                        <th className="numCol">+{salaryData.c11 || '0.00'}</th>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Deductions Table */}
                  <table className="printTable printDeductionsTable">
                    <thead>
                      <tr>
                        <th>รายการหัก (Deductions)</th>
                        <th className="numCol">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryData.c12 && <tr><td>ประกันสังคม</td><td className="numCol">{salaryData.c12}</td></tr>}
                      {salaryData.c13 && <tr><td>เก็บเพิ่มประกันสังคม</td><td className="numCol">{salaryData.c13}</td></tr>}
                      {salaryData.c14 && <tr><td>กองทุนสำรองเลี้ยงชีพ</td><td className="numCol">{salaryData.c14}</td></tr>}
                      {salaryData.c15 && <tr><td>ฌาปนกิจสงเคราะห์</td><td className="numCol">{salaryData.c15}</td></tr>}
                      {salaryData.c16 && <tr><td>ธนาคารออมสิน</td><td className="numCol">{salaryData.c16}</td></tr>}
                      {salaryData.c23 && <tr><td>ธนาคารกรุงไทย</td><td className="numCol">{salaryData.c23}</td></tr>}
                      {salaryData.c21 && <tr><td>ธ.ก.ส.</td><td className="numCol">{salaryData.c21}</td></tr>}
                      {salaryData.c22 && <tr><td>ธนาคารอิสลาม</td><td className="numCol">{salaryData.c22}</td></tr>}
                      {salaryData.c24 && <tr><td>เงินสวัสดิการ รพ.</td><td className="numCol">{salaryData.c24}</td></tr>}
                      {salaryData.c20 && <tr><td>กยศ.</td><td className="numCol">{salaryData.c20}</td></tr>}
                      {salaryData.c19 && <tr><td>ค่าทำความสะอาด</td><td className="numCol">{salaryData.c19}</td></tr>}
                      {salaryData.c17 && <tr><td>ค่าไฟฟ้า</td><td className="numCol">{salaryData.c17}</td></tr>}
                      {salaryData.c18 && <tr><td>ค่าน้ำประปา</td><td className="numCol">{salaryData.c18}</td></tr>}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>รวมรายการหัก</th>
                        <th className="numCol">-{salaryData.c25 || '0.00'}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="printNetSummary">
                  <span>เงินเดือนรับสุทธิ (Net Salary):</span>
                  <strong>{salaryData.c26 || '0.00'} บาท</strong>
                </div>
              </div>
            )}

            {/* Section 2: Overtime (OT) */}
            {otData && (
              <div className="printSection">
                <div className="printSectionTitle">
                  <span>2. รายละเอียดค่าตอบแทนล่วงเวลา / ค่าตอบแทนพิเศษ (OT & Allowances)</span>
                </div>
                <div className="printTablesGrid">
                  {/* OT Earnings */}
                  <table className="printTable printEarningsTable">
                    <thead>
                      <tr>
                        <th>รายการได้ (Earnings)</th>
                        <th className="numCol">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>ฉ.11</td>
                        <td className="numCol">{otData.c5 || '0.00'}</td>
                      </tr>
                      <tr>
                        <td>ค่าเวร / OT</td>
                        <td className="numCol">{otData.c6 || '0.00'}</td>
                      </tr>
                      <tr>
                        <td>เบี้ยเลี้ยง / เงินชดเชย</td>
                        <td className="numCol">{otData.c7 || '0.00'}</td>
                      </tr>
                      <tr>
                        <td>ค่าตอบแทนพิเศษ (P4P / พ.ต.ส.)</td>
                        <td className="numCol">{otData.c8 || '0.00'}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>รวมรายการได้ OT</th>
                        <th className="numCol">+{otData.c15 || '0.00'}</th>
                      </tr>
                    </tfoot>
                  </table>

                  {/* OT Deductions */}
                  <table className="printTable printDeductionsTable">
                    <thead>
                      <tr>
                        <th>รายการหัก (Deductions)</th>
                        <th className="numCol">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otData.c16 && <tr><td>ภาษีหัก ณ ที่จ่าย 5%</td><td className="numCol">{otData.c16}</td></tr>}
                      {otData.c17 && <tr><td>ค่าบำรุงหอพัก / ค่าไฟฟ้า</td><td className="numCol">{otData.c17}</td></tr>}
                      {otData.c18 && <tr><td>ค่าน้ำประปา</td><td className="numCol">{otData.c18}</td></tr>}
                      {otData.c19 && <tr><td>ค่าสวัสดิการ / อื่นๆ</td><td className="numCol">{otData.c19}</td></tr>}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>รวมรายการหัก OT</th>
                        <th className="numCol">-{otData.c22 || '0.00'}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="printNetSummary">
                  <span>ค่าล่วงเวลารับสุทธิ (Net OT):</span>
                  <strong>{otData.c23 || '0.00'} บาท</strong>
                </div>
              </div>
            )}

            {/* Total Grand Summary if both exist */}
            {salaryData && otData && (
              <div className="printGrandTotalBox">
                <div className="grandTotalRow">
                  <span>ยอดรับรวมสุทธิทั้งสิ้น (เงินเดือน + ค่าตอบแทนล่วงเวลา OT):</span>
                  <strong className="grandTotalAmount">
                    {(
                      parseFloat((salaryData.c26 || '0').replace(/,/g, '')) + 
                      parseFloat((otData.c23 || '0').replace(/,/g, ''))
                    ).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
