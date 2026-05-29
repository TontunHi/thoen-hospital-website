'use client'

import { useState, useEffect } from 'react'
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
  dch_type_name: string | null
  wardname: string | null
  hosname: string | null
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
  stats: {
    ptTypes: { v: number; name: string }[]
    emergencyLevels: { v: number; er_emergency_level_name: string }[]
    dischargeTypes: { v: number; name: string }[]
  }
}

export default function ErInStatusPage() {
  const [data, setData] = useState<ERData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isTvMode, setIsTvMode] = useState(false)

  // 1. Fetch function
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

  // 2. Fetch initially and start interval
  useEffect(() => {
    fetchStatus()

    const interval = setInterval(() => {
      fetchStatus()
    }, 15000) // Auto-refresh every 15 seconds

    return () => clearInterval(interval)
  }, [])

  // Toggle TV mode
  const toggleTvMode = () => {
    setIsTvMode(!isTvMode)
  }

  if (loading && !data) {
    return (
      <div className="erStatusPage">
        <div className="container erContainer">
          <div className="erLoadingPanel card">
            <div className="spinner"></div>
            <h3>กำลังเปิดเชื่อมต่อฐานข้อมูล HOSxP โรงพยาบาลเถิน...</h3>
            <p>เพื่อดึงสถิติและรายชื่อผู้ป่วยที่เข้ารักษาในห้องฉุกเฉินวันนี้</p>
          </div>
        </div>
      </div>
    )
  }

  const hasCritical = (data?.summary.critical || 0) > 0
  const activePatients = data?.activePatients || []

  return (
    <div className={`erStatusPage ${isTvMode ? 'tvModeActive' : ''}`}>
      <div className="container erContainer">
        
        {/* Navigation back when not in TV mode */}
        {!isTvMode && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Link href="/systems" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              ← กลับไปหน้าระบบสารสนเทศ
            </Link>
          </div>
        )}

        {/* Dashboard Header */}
        <header className="erHeaderCard card">
          <div className="erTitleSection">
            <h1>ระบบแสดงผลสถานะห้องฉุกเฉิน (ER Live Status)</h1>
            <p className="erSubtitle">ข้อมูลอัปเดตเรียลไทม์เพื่อบริหารจัดการผู้ป่วย ณ จุดบริการฉุกเฉิน</p>
          </div>
          <div className="erControls">
            <button onClick={toggleTvMode} className="tvToggleBtn">
              {isTvMode ? 'ปิดจอโหมดทีวี (TV Mode)' : 'เปิดจอโหมดทีวี (TV Mode)'}
            </button>
          </div>
        </header>

        {/* Critical Alert Warning Alert */}
        {hasCritical && (
          <section className="erAlertBanner">
            <span className="alertIcon"></span>
            <div className="alertMsg">
              คำเตือน: ขณะนี้มีผู้ป่วยวิกฤตฉุกเฉินกู้ชีพ (Resuscitate Red Level) จำนวน {data?.summary.critical} ราย กำลังรับการช่วยเหลือ!
              <br />
              <span style={{ fontSize: '1rem', fontWeight: 'normal', opacity: 0.9 }}>
                ทีมแพทย์และพยาบาลกำลังระดมกำลังให้การกู้ชีพอย่างเร่งด่วนที่สุด
              </span>
            </div>
          </section>
        )}

        {/* Real-time Summary Cards */}
        <section className="erSummaryGrid">
          <div className="erStatCard card">
            <div className="statVal">{data?.summary.totalActive}</div>
            <div className="statLabel">ผู้ป่วยในห้องฉุกเฉินทั้งหมด</div>
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
          <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid var(--primary-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
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

        {/* Monthly statistics (Hidden on TV view mode to focus on realtime queue) */}
        {!isTvMode && (
          <section className="erMonthlyStatsGrid">
            
            {/* 1. Monthly Pt Types */}
            <div className="statsTableCard card cardTypeGreen">
              <h3>ประเภทผู้ป่วย (ประจำเดือนนี้)</h3>
              <ul className="statsList">
                {data?.stats.ptTypes.map((pt, idx) => (
                  <li key={idx}>
                    <span className="statsItemName">{pt.name || 'ไม่ระบุประเภท'}</span>
                    <span className="statsCount">{pt.v} ราย</span>
                  </li>
                ))}
                {data?.stats.ptTypes.length === 0 && (
                  <p className="noStatsText">ไม่มีข้อมูลในเดือนนี้</p>
                )}
              </ul>
            </div>

            {/* 2. Monthly Emergency Levels */}
            <div className="statsTableCard card cardTypeRed">
              <h3>สัดส่วนความรุนแรงผู้ป่วย (ประจำเดือนนี้)</h3>
              <ul className="statsList">
                {data?.stats.emergencyLevels.map((el, idx) => (
                  <li key={idx}>
                    <span className="statsItemName">{el.er_emergency_level_name || 'ไม่ระบุความรุนแรง'}</span>
                    <span className="statsCount statusLevelCount">{el.v} ราย</span>
                  </li>
                ))}
                {data?.stats.emergencyLevels.length === 0 && (
                  <p className="noStatsText">ไม่มีข้อมูลในเดือนนี้</p>
                )}
              </ul>
            </div>

            {/* 3. Monthly Discharge Types */}
            <div className="statsTableCard card cardTypeTeal">
              <h3>สถานะหลังออกจากห้องฉุกเฉิน (ประจำเดือนนี้)</h3>
              <ul className="statsList">
                {data?.stats.dischargeTypes.map((dt, idx) => (
                  <li key={idx}>
                    <span className="statsItemName">{dt.name || 'ไม่ระบุการจำหน่าย'}</span>
                    <span className="statsCount statusDchCount">{dt.v} ราย</span>
                  </li>
                ))}
                {data?.stats.dischargeTypes.length === 0 && (
                  <p className="noStatsText">ไม่มีข้อมูลในเดือนนี้</p>
                )}
              </ul>
            </div>
            
          </section>
        )}

      </div>
    </div>
  )
}
