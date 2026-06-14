'use client'

import { useState, useEffect } from 'react'
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
    <div className="erTvPage">
      <div className="erTvContainer">
        
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
          <h2 className="patientsListTitle">
            รายชื่อผู้ป่วยที่กำลังตรวจรักษาในห้องฉุกเฉิน ({activePatients.length} ราย)
          </h2>
          
          {activePatients.length === 0 ? (
            <p className="emptyPatientsMessage">ในขณะนี้ไม่มีผู้ป่วยที่ค้างรอรับการรักษาในห้องฉุกเฉิน</p>
          ) : (
            <div className="patientsTableWrapper">
              <table className="patientsTable">
                <thead>
                  <tr>
                    <th>เวลาที่เข้า</th>
                    <th>HN</th>
                    <th>ชื่อผู้ป่วย</th>
                    <th>อายุ (ปี)</th>
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
                        <td>{patient.age}</td>
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
