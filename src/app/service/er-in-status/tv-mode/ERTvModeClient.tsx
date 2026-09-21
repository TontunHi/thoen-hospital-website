'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import './page.css'

interface Patient {
  hn: string
  vn: string
  ptname: string
  age?: number
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
  const tableWrapperRef = useRef<HTMLDivElement>(null)

  // Auto-scroll loop when content overflows screen
  useEffect(() => {
    const el = tableWrapperRef.current
    if (!el) return

    let animationId: number
    let timeoutId: NodeJS.Timeout
    let isPaused = false

    const checkAndScroll = () => {
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight

      // If content fits on one screen, no need to scroll
      if (maxScroll <= 5) {
        el.scrollTop = 0
        return
      }

      if (isPaused) return

      // At bottom -> pause 4 seconds, then jump/smooth back to top
      if (el.scrollTop >= maxScroll - 2) {
        isPaused = true
        timeoutId = setTimeout(() => {
          el.scrollTo({ top: 0, behavior: 'smooth' })
          timeoutId = setTimeout(() => {
            isPaused = false
            step()
          }, 3000) // Pause 3 seconds at top before scrolling again
        }, 4000) // Pause 4 seconds at bottom
        return
      }

      // Smooth slow scroll down (~0.8px per frame for comfortable TV reading)
      el.scrollTop += 0.8
      animationId = requestAnimationFrame(step)
    }

    const step = () => {
      checkAndScroll()
    }

    // Start with a 4-second initial delay at top
    timeoutId = setTimeout(() => {
      animationId = requestAnimationFrame(step)
    }, 4000)

    return () => {
      cancelAnimationFrame(animationId)
      clearTimeout(timeoutId)
    }
  }, [data])

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
      // Browser user gesture requirement
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
      // Ignore
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

  // Try auto fullscreen on mount & first interaction
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

  // 1. Fetch Real ER Data on Mount (Bypass Login for TV Board)
  useEffect(() => {
    fetchStatus()
  }, [])

  // 2. Fetch function against real HOSxP ER database with tvMode parameter
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/er/status?mode=tv')
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

  // 3. Set interval polling every 10 seconds for real-time ER TV
  useEffect(() => {
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="erTvPage">
        <div className="erLoadingPanel">
          <div className="spinner"></div>
          <h3>กำลังเชื่อมต่อฐานข้อมูลห้องฉุกเฉิน...</h3>
        </div>
      </div>
    )
  }

  const hasCritical = (data?.summary.critical || 0) > 0
  const activePatients = [...(data?.activePatients || [])].sort((a, b) => {
    // ระดับความเร่งด่วน: 1 (กู้ชีพ) -> 2 (วิกฤต) -> 3 (ด่วนมาก) -> 4 (ด่วน) -> 5 (ทั่วไป)
    const levelA = Number(a.er_emergency_level_id) || 99
    const levelB = Number(b.er_emergency_level_id) || 99
    if (levelA !== levelB) {
      return levelA - levelB
    }
    // หากระดับเท่ากัน เรียงตามเวลาเข้าก่อน-หลัง
    return (a.enter_time || '').localeCompare(b.enter_time || '')
  })

  return (
    <div className="erTvPage" ref={containerRef}>
      <div className="erTvContainer">
        
        {/* TV Header Bar with Integrated KPI Badges */}
        <header className="erTvHeader">
          <div className="erTvHeaderLeft">
            <h1 className="erTvHospitalTitle">โรงพยาบาลเถิน • จอแสดงสถานะห้องฉุกเฉิน</h1>
            <span className="erLiveBadge">● LIVE</span>
          </div>

          {/* Integrated Compact KPI Bar */}
          <div className="erKpiBar">
            <div className="kpiItem kpiTotal">
              <span className="kpiLabel">ทั้งหมด</span>
              <span className="kpiVal">{data?.summary.totalActive}</span>
            </div>
            <div className="kpiItem kpiCritical">
              <span className="kpiDot redDot"></span>
              <span className="kpiLabel">กู้ชีพ</span>
              <span className="kpiVal">{data?.summary.critical}</span>
            </div>
            <div className="kpiItem kpiEmergency">
              <span className="kpiDot orangeDot"></span>
              <span className="kpiLabel">วิกฤต</span>
              <span className="kpiVal">{data?.summary.emergency}</span>
            </div>
            <div className="kpiItem kpiUrgency">
              <span className="kpiDot yellowDot"></span>
              <span className="kpiLabel">ด่วนมาก</span>
              <span className="kpiVal">{data?.summary.urgency}</span>
            </div>
            <div className="kpiItem kpiSemiUrgency">
              <span className="kpiDot greenDot"></span>
              <span className="kpiLabel">ด่วน/ทั่วไป</span>
              <span className="kpiVal">{(data?.summary.semiUrgency || 0) + (data?.summary.nonUrgency || 0)}</span>
            </div>
          </div>

          <div className="erTvHeaderRight">
            <span className="erTvClock">🕒 {currentTime}</span>
            <button 
              type="button" 
              onClick={toggleFullScreen}
              className="erFullscreenBtn"
              title={isFullscreen ? 'ออกจาก Fullscreen' : 'เข้าสู่ Fullscreen (เต็มจอ)'}
            >
              {isFullscreen ? '⤢ ย่อจอ' : '⛶ เต็มจอ'}
            </button>
            <Link href="/service/er-in-status" className="erExitBtn" title="กลับหน้าระบบปกติ">
              ✕ ปิด
            </Link>
          </div>
        </header>

        {/* Critical Alert Warning Banner */}
        {hasCritical && (
          <section className="erAlertBanner">
            <span className="alertIcon">🚨</span>
            <div className="alertMsg">
              คำเตือน: ขณะนี้มีผู้ป่วยวิกฤตฉุกเฉินกู้ชีพ (Resuscitate Red Level) จำนวน {data?.summary.critical} ราย กำลังรับการช่วยเหลือ!
            </div>
          </section>
        )}

        {/* Main Patients Table Card - Large High-Visibility TV Layout */}
        <section className="patientsListCard card">
          {activePatients.length === 0 ? (
            <div className="emptyPatientsMessage">ในขณะนี้ไม่มีผู้ป่วยที่ค้างรอรับการรักษาในห้องฉุกเฉิน</div>
          ) : (
            <div className="patientsTableWrapper" ref={tableWrapperRef}>
              <table className="patientsTable">
                <thead>
                  <tr>
                    <th className="col-time">เวลาเข้า</th>
                    <th className="col-hn">HN</th>
                    <th className="col-name">ชื่อผู้ป่วย</th>
                    <th className="col-level">ระดับความเร่งด่วน</th>
                    <th className="col-bed">เตียง / Observe</th>
                  </tr>
                </thead>
                <tbody>
                  {activePatients.map((patient: Patient, idx) => {
                    const levelId = Number(patient.er_emergency_level_id)
                    let displayLevel = patient.er_emergency_level_name || 'ทั่วไป'
                    if (levelId === 1) displayLevel = 'กู้ชีพทันที (Resuscitate)'
                    else if (levelId === 2) displayLevel = 'ฉุกเฉินวิกฤต (Emergency)'
                    else if (levelId === 3) displayLevel = 'ด่วนมาก (Urgency)'
                    else if (levelId === 4) displayLevel = 'ด่วน (Semi Urgency)'
                    else if (levelId === 5) displayLevel = 'ทั่วไป (Non Urgency)'

                    // ตัดนามสกุลออก แสดงเฉพาะ คำนำหน้า + ชื่อ
                    const nameParts = (patient.ptname || '').trim().split(/\s+/)
                    const shortName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : patient.ptname

                    return (
                      <tr key={patient.vn || idx} className={`level-${levelId}`}>
                        <td className="col-time cell-time">
                          {patient.enter_time ? patient.enter_time.substring(0, 5) : '-'}
                        </td>
                        <td className="col-hn cell-hn">
                          {patient.hn}
                        </td>
                        <td className="col-name cell-name">
                          {shortName}
                        </td>
                        <td className="col-level cell-level">
                          <span className={`severityPill pill-${levelId}`}>
                            {displayLevel}
                          </span>
                        </td>
                        <td className="col-bed cell-bed">
                          {patient.bedno ? (
                            <>
                              <span className="bedBadge">
                                เตียง {patient.bedno}
                              </span>
                              {patient.observe === 'Y' && (
                                <span className="observeBadge">Observe</span>
                              )}
                            </>
                          ) : patient.observe === 'Y' ? (
                            <span className="observeBadge">Observe</span>
                          ) : (
                            <span className="noBedBadge">-</span>
                          )}
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


