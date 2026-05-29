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

export default function ErOutStatusPage() {
  const [data, setData] = useState<ERData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  if (loading && !data) {
    return (
      <div className="erStatusPage">
        <div className="container erContainer">
          <div className="erLoadingPanel card">
            <div className="spinner"></div>
            <h3>กำลังเปิดเชื่อมต่อฐานข้อมูล HOSxP โรงพยาบาลเถิน...</h3>
            <p>เพื่อดึงสถิติผู้ป่วยที่เข้ารักษาในห้องฉุกเฉินในเดือนนี้</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="erStatusPage">
      <div className="container erContainer">
        
        {/* Navigation back */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/systems" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            ← กลับไปหน้าระบบสารสนเทศ
          </Link>
        </div>

        {/* Dashboard Header */}
        <header className="erHeaderCard card">
          <div className="erTitleSection">
            <h1>รายงานสถานะห้องฉุกเฉิน (ER Public Status)</h1>
            <p className="erSubtitle">รายงานข้อมูลและสถิติห้องฉุกเฉินโรงพยาบาลเถินสำหรับภายนอก</p>
          </div>
        </header>

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

        {/* Monthly statistics */}
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

      </div>
    </div>
  )
}
