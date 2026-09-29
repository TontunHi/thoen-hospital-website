'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Clock,
  User,
  FileText,
  CalendarRange,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
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

export default function CheckDateClientView() {
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = searchValue.trim().replace(/\D/g, '')
    if (cleaned.length !== 13) {
      setError('กรุณากรอกเลขประจำตัวประชาชนให้ครบถ้วน 13 หลัก')
      return
    }

    setLoading(true)
    setError('')
    setAppointments(null)
    setSearched(false)

    try {
      const res = await fetch(`/api/appointment?q=${encodeURIComponent(cleaned)}`)
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
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      return {
        day: date.getDate(),
        month: thaiMonths[date.getMonth()],
        year: (date.getFullYear() + 543).toString().substring(2),
      }
    } catch {
      return { day: '-', month: '-', year: '-' }
    }
  }

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
        {/* Breadcrumb Navigation (N5) */}
        <Breadcrumb items={[{ label: 'ตรวจสอบตารางนัดหมายแพทย์' }]} />

        <div className="appointCard animate-fadeInUp">
          <div className="cardDecorativeHeader"></div>

          <header className="appointHeader">
            <h1>ตรวจสอบตารางนัดหมายแพทย์</h1>
            <p>
              ค้นหาและตรวจสอบวันเวลานัดหมายการตรวจรักษากับโรงพยาบาลเถิน สะดวก รวดเร็ว และเป็นความลับ
            </p>
          </header>

          <form onSubmit={handleSearch} className="searchForm" role="search">
            <div className="searchInputWrapper">
              <label htmlFor="citizen-id-input" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
                เลขประจำตัวประชาชน 13 หลัก
              </label>
              <Search className="searchIcon" size={20} aria-hidden="true" />
              <input
                id="citizen-id-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="appointInput"
                placeholder="กรอกเลขประจำตัวประชาชน 13 หลัก"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value.replace(/\D/g, ''))}
                maxLength={13}
                required
                disabled={loading}
                aria-describedby="search-helper-text"
                aria-invalid={!!error}
              />
              <span
                id="search-helper-text"
                style={{
                  position: 'absolute',
                  right: '1rem',
                  fontSize: '0.8125rem',
                  color: searchValue.length === 13 ? 'var(--primary)' : 'var(--gray-500)',
                  fontWeight: 600,
                  pointerEvents: 'none',
                }}
              >
                {searchValue.length}/13
              </span>
            </div>

            <button
              type="submit"
              className="appointSearchBtn touch-target"
              disabled={loading || searchValue.length !== 13}
              aria-label="ค้นหาข้อมูลนัดหมาย"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="spinner" aria-hidden="true" />
                  <span>กำลังค้นหา...</span>
                </>
              ) : (
                <>
                  <Search size={18} aria-hidden="true" />
                  <span>ค้นหาข้อมูล</span>
                </>
              )}
            </button>
          </form>

          {/* PDPA Privacy Protection Notice (F3) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--primary-light)',
              padding: '0.625rem 1rem',
              borderRadius: 'var(--radius-md)',
              marginTop: '1rem',
              fontSize: '0.8125rem',
              color: 'var(--primary-dark)',
            }}
          >
            <ShieldCheck size={18} flex-shrink="0" />
            <span>
              <strong>คุ้มครองข้อมูลส่วนบุคคล (PDPA):</strong> ระบบจะแสดงเฉพาะข้อมูลตารางนัดหมายที่เกี่ยวข้อง และปิดบังข้อมูลส่วนบุคคลตามมาตรฐานความปลอดภัย
            </span>
          </div>

          {error && (
            <div className="appointAlert alert-error animate-fadeIn" role="alert" style={{ marginTop: '1rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {searched && appointments && appointments.length > 0 && (
            <div className="patientBanner animate-fadeIn" style={{ marginTop: '1.5rem' }}>
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
                    className={`tabButton touch-target ${activeTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upcoming')}
                  >
                    นัดหมายเร็วๆ นี้
                    <span className="tabCount">
                      {appointments.filter((a) => isFutureAppointment(a.appoint_date)).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`tabButton touch-target ${activeTab === 'past' ? 'active' : ''}`}
                    onClick={() => setActiveTab('past')}
                  >
                    ประวัติการนัดหมาย
                    <span className="tabCount">
                      {appointments.filter((a) => !isFutureAppointment(a.appoint_date)).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`tabButton touch-target ${activeTab === 'all' ? 'active' : ''}`}
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
                    <CalendarRange size={56} className="emptyStateIcon" />
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
                                <span className="detailVal">
                                  {app.appoint_time ? app.appoint_time.substring(0, 5) + ' น.' : 'ไม่ระบุเวลา'}
                                </span>
                              </div>
                            </div>
                            <div className="appointDetails__row">
                              <User size={16} className="detailIcon" />
                              <div className="detailContent">
                                <span className="detailLabel">ผู้ทำรายการนัดหมาย</span>
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
                <p>
                  กรุณาเดินทางมาถึงโรงพยาบาลก่อนเวลานัดหมายอย่างน้อย <strong>15 - 30 นาที</strong> เพื่อทำประวัติคัดกรองเบื้องต้น
                </p>
              </li>
              <li>
                <div className="bulletMarker">2</div>
                <p>
                  โปรดเตรียม <strong>บัตรประจำตัวประชาชนตัวจริง</strong>, สมุดนัด (ถ้ามี) และกล่องยาเดิมที่กำลังรับประทานอยู่มาแสดงต่อเจ้าหน้าที่
                </p>
              </li>
              <li>
                <div className="bulletMarker">3</div>
                <p>
                  หากต้องการเลื่อนนัดหมาย สอบถามข้อมูลเพิ่มเติม กรุณาติดต่อสายด่วนโรงพยาบาลเถิน หรือตามเบอร์ติดต่อที่ระบุในใบนัด
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
