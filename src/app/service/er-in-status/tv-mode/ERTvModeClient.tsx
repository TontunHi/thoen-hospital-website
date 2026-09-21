'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import './page.css'

interface Patient {
  hn: string
  vn: string
  ptname: string
  age: number
  bedno: string | null
  enter_time: string
  er_list: string | null
  er_emergency_level_name: string
  er_emergency_level_id: number | string
  observe: string | null
}

interface ERData {
  activePatients: Patient[]
  summary: {
    totalActive: number
    critical: number
    emergency: number
    urgency: number
    semiUrgency: number
    nonUrgency: number
  }
}

export default function ERTvModeClient() {
  const [data, setData] = useState<ERData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fullscreen helper
  const requestFullScreen = async () => {
    try {
      const docEl = document.documentElement
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen()
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen()
        } else if ((docEl as any).msRequestFullscreen) {
          await (docEl as any).msRequestFullscreen()
        }
      }
    } catch {
      // Browser may block automatic fullscreen without user interaction
    }
  }

  const exitFullScreen = async () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        }
      }
    } catch {
      // Ignore exit error
    }
  }

  const toggleFullScreen = () => {
    if (document.fullscreenElement) {
      exitFullScreen()
    } else {
      requestFullScreen()
    }
  }

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Try auto fullscreen on mount & on user first click/tap
  useEffect(() => {
    requestFullScreen()

    const handleFirstInteraction = () => {
      if (!document.fullscreenElement) {
        requestFullScreen()
      }
    }

    window.addEventListener('click', handleFirstInteraction, { once: true })
    window.addEventListener('keydown', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])

  // 1. Verify Member Auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/member/me')
        const result = await res.json()
        if (res.ok && result.authenticated) {
          setAuthenticated(true)
          fetchStatus()
        } else {
          window.location.href = '/member/login'
        }
      } catch {
        window.location.href = '/member/login'
      }
    }
    checkAuth()
  }, [])

  // 2. Fetch function
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/er/status')
      const result = await res.json()
      if (res.ok) {
        setData(result)
        setError('')
      } else {
        setError(result.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อฐานข้อมูลห้องฉุกเฉินได้')
    } finally {
      setLoading(false)
    }
  }

  // 3. Set interval after authentication
  useEffect(() => {
    if (!authenticated) return

    const interval = setInterval(fetchStatus, 15000) // Auto-refresh every 15 seconds
    return () => clearInterval(interval)
  }, [authenticated])

  if (!authenticated || (loading && !data)) {
    return (
      <div className="erTvPage">
        <div className="erLoadingPanel">
          <div className="spinner"></div>
          <h3>กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</h3>
        </div>
      </div>
    )
  }

  const hasCritical = (data?.summary.critical || 0) > 0
  const activePatients = data?.activePatients || []

  return (
    <div className="erTvPage" ref={containerRef}>
      <div className="erTvContainer">
        
        {/* TV Header Bar */}
        <header className="erTvHeader">
          <div className="erTvHeaderLeft">
            <h1 className="erTvHospitalTitle">โรงพยาบาลเถิน • จอแสดงสถานะห้องฉุกเฉิน (ER LIVE STATUS)</h1>
            <span className="erLiveBadge">● LIVE</span>
          </div>
          <div className="erTvHeaderRight">
            <span className="erTvClock">🕒 {currentTime}</span>
            <button 
              type="button" 
              onClick={toggleFullScreen}
              className="erFullscreenBtn"
              title={isFullscreen ? 'ออกจาก Fullscreen' : 'เข้าสู่ Fullscreen (เต็มจอ)'}
            >
              {isFullscreen ? '⤢ ออกเต็มจอ' : '⛶ เต็มจอ'}
            </button>
            <Link href="/service/er-in-status" className="erExitBtn" title="กลับหน้าระบบปกติ">
              ✕ ปิดโหมดทีวี
            </Link>
          </div>
        </header>

        {/* Critical Alert Warning Alert */}
        {hasCritical && (
          <section className="erAlertBanner">
            <span className="alertIcon">⚠️</span>
            <div className="alertMsg">
              คำเตือน: ขณะนี้มีผู้ป่วยวิกฤตฉุกเฉินกู้ชีพ (Resuscitate Red Level) จำนวน {data?.summary.critical} ราย กำลังรับการช่วยเหลือ!
            </div>
          </section>
        )}

        {/* Real-time Summary Cards */}
        <section className="erSummaryGrid">
          <div className="erStatCard card">
            <div className="statVal">{data?.summary.totalActive}</div>
            <div className="statLabel">ผู้ป่วยทั้งหมด</div>
          </div>
          
          <div className="erStatCard card criticalCard">
            <div className="statVal">{data?.summary.critical}</div>
            <div className="statLabel">กู้ชีพทันที (Resuscitate)</div>
          </div>
          
          <div className="erStatCard card emergencyCard">
            <div className="statVal">{data?.summary.emergency}</div>
            <div className="statLabel">ฉุกเฉินวิกฤต (Emergency)</div>
          </div>
          
          <div className="erStatCard card urgencyCard">
            <div className="statVal">{data?.summary.urgency}</div>
            <div className="statLabel">ฉุกเฉินเร่งด่วน (Urgency)</div>
          </div>
          
          <div className="erStatCard card semiUrgencyCard">
            <div className="statVal">{data?.summary.semiUrgency}</div>
            <div className="statLabel">ฉุกเฉินไม่รุนแรง / ทั่วไป</div>
          </div>
        </section>

        {/* Active Patients Live Queue */}
        <section className="patientsListCard card">
          <div className="patientsListHeader">
            <h2 className="patientsListTitle">
              รายชื่อผู้ป่วยที่กำลังตรวจรักษาในห้องฉุกเฉิน ({activePatients.length} ราย)
            </h2>
            <span className="erUpdateNotice">รีเฟรชข้อมูลอัตโนมัติทุก 15 วินาที</span>
          </div>
          
          {activePatients.length === 0 ? (
            <div className="emptyPatientsMessage">ในขณะนี้ไม่มีผู้ป่วยที่ค้างรอรับการรักษาในห้องฉุกเฉิน</div>
          ) : (
            <div className="patientsTableWrapper">
              <table className="patientsTable">
                <thead>
                  <tr>
                    <th>เวลาที่เข้า</th>
                    <th>HN</th>
                    <th>ชื่อผู้ป่วย</th>
                    <th>อายุ</th>
                    <th>เตียงสังเกตอาการ</th>
                    <th>ระดับความเร่งด่วน</th>
                    <th>เตียงสังเกต (Observe)</th>
                  </tr>
                </thead>
                <tbody>
                  {activePatients.map((patient: Patient, idx) => {
                    const levelId = Number(patient.er_emergency_level_id)
                    let displayLevel = patient.er_emergency_level_name || 'ทั่วไป'
                    if (levelId === 1) displayLevel = '🔴 กู้ชีพทันที (Resuscitate)'
                    else if (levelId === 2) displayLevel = '🟠 ฉุกเฉินวิกฤต (Emergency)'
                    else if (levelId === 3) displayLevel = '🟡 ด่วนมาก (Urgency)'
                    else if (levelId === 4) displayLevel = '🟢 ด่วน (Semi Urgency)'
                    else if (levelId === 5) displayLevel = '⚪ ทั่วไป (Non Urgency)'

                    return (
                      <tr key={patient.vn || idx} className={`level-${levelId}`}>
                        <td style={{ fontWeight: 'bold' }}>{patient.enter_time ? patient.enter_time.substring(0, 5) : '-'}</td>
                        <td>{patient.hn}</td>
                        <td style={{ fontWeight: 600 }}>{patient.ptname}</td>
                        <td>{patient.age} ปี</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                          {patient.bedno ? `เตียง ${patient.bedno}` : '-'}
                        </td>
                        <td>
                          <span className={`severityPill pill-${levelId}`}>
                            {displayLevel}
                          </span>
                        </td>
                        <td>
                          {patient.observe === 'Y' ? (
                            <span className="observeBadge">Observe ON</span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

