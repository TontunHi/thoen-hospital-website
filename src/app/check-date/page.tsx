'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Calendar, Clock, User, FileText, CalendarRange, CheckCircle2, ChevronRight, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react'
import './page.css'

interface Appointment {
  hn: string
  ptname: string
  appoint_date: string
  appoint_time: string
  clinic_name: string
  doctor_name: string
  appoint_note: string
}

export default function CheckDatePage() {
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchValue.trim()) return

    setLoading(true)
    setError('')
    setAppointments(null)
    setSearched(false)

    try {
      const res = await fetch(`/api/appointment?q=${encodeURIComponent(searchValue.trim())}`)
      const data = await res.json()

      if (res.ok) {
        setAppointments(data.appointments)
        setSearched(true)
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อระบบตารางนัดหมายได้ในขณะนี้')
    } finally {
      setLoading(false)
    }
  }

  // Format Date in Thai: e.g. "2026-05-29" -> Day: 29, Month: "พ.ค.", Year: 2569
  const formatThaiDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ]
      return {
        day: date.getDate(),
        month: thaiMonths[date.getMonth()],
        year: (date.getFullYear() + 543).toString().substring(2)
      }
    } catch {
      return { day: '-', month: '-', year: '-' }
    }
  }

  // Determine if appointment date is today or in the future
  const isFutureAppointment = (dateStr: string) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const appDate = new Date(dateStr)
      return appDate >= today
    } catch {
      return false
    }
  }

  // Filter appointments based on active tab
  const filteredAppointments = appointments
    ? appointments.filter((app) => {
        const isFuture = isFutureAppointment(app.appoint_date)
        if (activeTab === 'upcoming') return isFuture
        if (activeTab === 'past') return !isFuture
        return true
      })
    : []

  return (
    <div className="appointPage">
      <div className="container">
        
        {/* Navigation Breadcrumb */}
        <div className="breadcrumbWrapper animate-fadeIn">
          <Link href="/" className="backHomeLink">
            <ChevronRight size={16} className="rotate180" />
            <span>กลับไปหน้าแรก</span>
          </Link>
        </div>

        <div className="appointCard animate-fadeInUp">
          <div className="cardDecorativeHeader"></div>
          
          <header className="appointHeader">
            <div className="serviceBadge">
              <CalendarRange size={16} />
              <span>บริการประชาชน</span>
            </div>
            <h1>ตรวจสอบตารางนัดหมายแพทย์</h1>
            <p>ค้นหาและตรวจสอบวันเวลานัดหมายการตรวจรักษากับโรงพยาบาลเถินได้ง่ายๆ สะดวก และรวดเร็ว</p>
          </header>

          <form onSubmit={handleSearch} className="searchForm">
            <div className="searchInputWrapper">
              <Search className="searchIcon" size={20} />
              <input
                type="text"
                className="appointInput"
                placeholder="กรอกเลขบัตรประชาชน 13 หลัก ของท่าน"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value.replace(/\D/g, ''))}
                maxLength={13}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="appointSearchBtn" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={18} className="spinner" />
                  <span>กำลังค้นหา...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>ค้นหาข้อมูล</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="appointAlert alert-error animate-fadeIn">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {searched && appointments && appointments.length > 0 && (
            <div className="patientBanner animate-fadeIn">
              <div className="patientAvatar">
                <User size={22} />
              </div>
              <div className="patientMeta">
                <span className="patientLabel">ผู้ป่วยที่ค้นพบ</span>
                <h3>{appointments[0].ptname}</h3>
                <span className="patientHn">เลขประจำตัวผู้ป่วย (HN): {appointments[0].hn}</span>
              </div>
            </div>
          )}

          {searched && appointments && (
            <div className="resultsSection animate-fadeInUp">
              {appointments.length > 0 && (
                <div className="tabsContainer">
                  <button
                    type="button"
                    className={`tabButton ${activeTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upcoming')}
                  >
                    นัดหมายเร็วๆ นี้
                    <span className="tabCount">
                      {appointments.filter(a => isFutureAppointment(a.appoint_date)).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`tabButton ${activeTab === 'past' ? 'active' : ''}`}
                    onClick={() => setActiveTab('past')}
                  >
                    ประวัติการนัดหมาย
                    <span className="tabCount">
                      {appointments.filter(a => !isFutureAppointment(a.appoint_date)).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`tabButton ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    ทั้งหมด
                    <span className="tabCount">{appointments.length}</span>
                  </button>
                </div>
              )}

              <div className="appointmentList">
                {filteredAppointments.length === 0 ? (
                  <div className="emptyState">
                    <CalendarRange size={64} className="emptyStateIcon" />
                    <h3>ไม่พบรายการนัดหมาย</h3>
                    <p>
                      {activeTab === 'upcoming'
                        ? 'ไม่มีนัดหมายแพทย์ที่กำลังจะมาถึงในเร็วๆ นี้'
                        : activeTab === 'past'
                        ? 'ไม่พบประวัติการนัดหมายแพทย์ที่ผ่านมา'
                        : 'ไม่พบรายการประวัตินัดหมายในระบบของคุณ'}
                    </p>
                  </div>
                ) : (
                  filteredAppointments.map((app, idx) => {
                    const dateInfo = formatThaiDate(app.appoint_date)
                    const isFuture = isFutureAppointment(app.appoint_date)
                    return (
                      <div key={idx} className={`appointmentCardItem ${isFuture ? 'upcoming' : 'past'}`}>
                        <div className="dateBlock">
                          <div className="dateBlockHeader">พ.ศ. 25{dateInfo.year}</div>
                          <div className="dateBlockBody">
                            <span className="dateBlock__day">{dateInfo.day}</span>
                            <span className="dateBlock__month">{dateInfo.month}</span>
                          </div>
                        </div>
                        
                        <div className="appointDetails">
                          <div className="appointDetails__header">
                            <h4 className="appointDetails__clinic">{app.clinic_name}</h4>
                            {isFuture ? (
                              <span className="statusBadge statusBadge--upcoming">
                                <span className="pulseDot"></span>
                                นัดหมายเร็วๆ นี้
                              </span>
                            ) : (
                              <span className="statusBadge statusBadge--past">
                                <CheckCircle2 size={12} />
                                เข้าตรวจแล้ว
                              </span>
                            )}
                          </div>

                          <div className="appointDetails__grid">
                            <div className="appointDetails__row">
                              <Clock size={16} className="detailIcon" />
                              <div className="detailContent">
                                <span className="detailLabel">เวลาตรวจ</span>
                                <span className="detailVal">{app.appoint_time ? app.appoint_time.substring(0, 5) + ' น.' : 'ไม่ระบุเวลา'}</span>
                              </div>
                            </div>
                            <div className="appointDetails__row">
                              <User size={16} className="detailIcon" />
                              <div className="detailContent">
                                <span className="detailLabel">แพทย์ผู้ตรวจ</span>
                                <span className="detailVal">{app.doctor_name || 'แพทย์เวร/แพทย์ทั่วไป'}</span>
                              </div>
                            </div>
                          </div>

                          {app.appoint_note && app.appoint_note !== '-' && (
                            <div className="appointDetails__note">
                              <FileText size={15} className="noteIcon" />
                              <div className="noteContent">
                                <strong>คำแนะนำเพิ่มเติม:</strong> {app.appoint_note}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          <div className="infoNotes">
            <div className="infoNotesHeader">
              <FileSpreadsheet size={18} />
              <h4>ข้อควรรู้และคำแนะนำในการเข้ารับบริการ</h4>
            </div>
            <ul>
              <li>
                <div className="bulletMarker">1</div>
                <p>กรุณาเดินทางมาถึงโรงพยาบาลก่อนเวลานัดหมายอย่างน้อย <strong>15 - 30 นาที</strong> เพื่อทำประวัติคัดกรองเบื้องต้น</p>
              </li>
              <li>
                <div className="bulletMarker">2</div>
                <p>โปรดเตรียม <strong>บัตรประจำตัวประชาชนตัวจริง</strong>, สมุดนัด (ถ้ามี) และกล่องยาเดิมที่กำลังรับประทานอยู่มาแสดงต่อเจ้าหน้าที่</p>
              </li>
              <li>
                <div className="bulletMarker">3</div>
                <p>หากต้องการเลื่อนนัดหมาย สอบถามข้อมูลเพิ่มเติม กรุณาติดต่อสายด่วนโรงพยาบาลเถิน หรือตามเบอร์ติดต่อที่ระบุในใบนัด</p>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}

