'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { usePolling } from '@/hooks/usePolling'
import { RefreshCw, Clock, ArrowLeft, Tv, AlertTriangle } from 'lucide-react'
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
  hosname_dest: string | null
}

interface ErrorPatient {
  vstdate: string
  hn: string
  vn: string
  status_name: string | null
  nname: string | null
}

interface ERData {
  activePatients: Patient[]
  errorStatusList?: {
    total: number
    list: ErrorPatient[]
  }
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

export default function ERInStatusClient() {
  const [data, setData] = useState<ERData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch function
  const fetchStatus = async () => {
    try {
      setIsRefreshing(true)
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
      setIsRefreshing(false)
    }
  }

  // Polling with Page Visibility API (S1)
  const { lastUpdated, refresh } = usePolling(fetchStatus, 15000)

  if (loading && !data) {
    return (
      <div className="erStatusPage">
        <div className="container erContainer">
          <div style={{ marginBottom: '1.5rem' }}>
            <Link href="/service" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              ← กลับไปหน้าระบบงานภายใน
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <SkeletonCard height="130px" />
            <SkeletonCard height="130px" />
            <SkeletonCard height="130px" />
            <SkeletonCard height="130px" />
            <SkeletonCard height="130px" />
            <SkeletonCard height="130px" />
          </div>
          <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
            <SkeletonTable rows={6} cols={7} />
          </div>
        </div>
      </div>
    )
  }

  const hasCritical = (data?.summary.critical || 0) > 0
  const activePatients = data?.activePatients || []

  return (
    <div className="erStatusPage">
      <div className="container erContainer">
        
        {/* Navigation back */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link href="/service" className="btn btn-outline btn-sm touch-target">
            <ArrowLeft size={16} />
            <span>กลับสู่ระบบงานภายใน</span>
          </Link>

          {/* Last Updated Status Indicator (S2) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} />
              <span>
                อัปเดตล่าสุด: {lastUpdated ? lastUpdated.toLocaleTimeString('th-TH') : 'กำลังโหลด...'}
              </span>
            </span>

            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="btn btn-sm btn-outline touch-target"
              aria-label="รีเฟรชข้อมูล"
              title="รีเฟรชข้อมูลทันที"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spinner' : ''} />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>
          </div>
        </div>

        {/* Dashboard Header */}
        <header className="erHeaderCard card animate-fadeInUp">
          <div className="erTitleSection">
            <h1>ระบบแสดงผลสถานะห้องฉุกเฉิน (ER Live Status)</h1>
            <p className="erSubtitle">ข้อมูลอัปเดตเรียลไทม์เพื่อบริหารจัดการผู้ป่วย ณ จุดบริการฉุกเฉิน</p>
          </div>
          <div className="erControls">
            <Link href="/service/er-in-status/tv-mode" target="_blank" className="btn btn-primary touch-target">
              <Tv size={16} />
              <span>เปิดจอโหมดทีวี (TV Mode)</span>
            </Link>
          </div>
        </header>

        {/* Critical Alert Warning Alert */}
        {hasCritical && (
          <section className="erAlertBanner animate-pulse">
            <AlertTriangle size={24} style={{ color: '#ffffff', flexShrink: 0 }} />
            <div className="alertMsg">
              คำเตือน: ขณะนี้มีผู้ป่วยวิกฤตฉุกเฉินกู้ชีพ (Resuscitate Red Level) จำนวน {data?.summary.critical} ราย กำลังรับการช่วยเหลือ!
              <br />
              <span style={{ fontSize: '0.9375rem', fontWeight: 'normal', opacity: 0.95 }}>
                ทีมแพทย์และพยาบาลกำลังระดมกำลังให้การกู้ชีพอย่างเร่งด่วนที่สุด
              </span>
            </div>
          </section>
        )}

        {/* Real-time Summary Cards */}
        <section className="erSummaryGrid animate-fadeInUp">
          <div className="erStatCard card">
            <div className="statVal">{data?.summary.totalActive}</div>
            <div className="statLabel">ผู้ป่วยในห้องฉุกเฉินทั้งหมด</div>
          </div>
          
          <div className="erStatCard card criticalCard">
            <div className="statVal">{data?.summary.critical}</div>
            <div className="statLabel">🔴 กู้ชีพทันที (Resuscitate)</div>
          </div>
          
          <div className="erStatCard card emergencyCard">
            <div className="statVal">{data?.summary.emergency}</div>
            <div className="statLabel">🟠 ฉุกเฉินวิกฤต (Emergency)</div>
          </div>
          
          <div className="erStatCard card urgencyCard">
            <div className="statVal">{data?.summary.urgency}</div>
            <div className="statLabel">🟡 ฉุกเฉินเร่งด่วน (Urgency)</div>
          </div>
          
          <div className="erStatCard card semiUrgencyCard">
            <div className="statVal">{data?.summary.semiUrgency}</div>
            <div className="statLabel">🟢 ฉุกเฉินไม่รุนแรง (Semi Urgency)</div>
          </div>
        </section>

        {/* Active Patients Live Queue */}
        <section className="patientsListCard card animate-fadeInUp">
          <h2 style={{ fontSize: '1.3rem', borderBottom: '2px solid var(--primary-light)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
            รายชื่อผู้ป่วยที่กำลังตรวจรักษาในห้องฉุกเฉิน ({activePatients.length} ราย)
          </h2>
          
          {activePatients.length === 0 ? (
            <p className="emptyPatientsMessage">ในขณะนี้ไม่มีผู้ป่วยที่ค้างรอรับการรักษาในห้องฉุกเฉิน</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table patientsTable">
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
                        <td data-label="เวลาเข้า" style={{ fontWeight: 'bold' }}>{patient.enter_time ? patient.enter_time.substring(0, 5) : '-'}</td>
                        <td data-label="HN" style={{ fontWeight: 600 }}>{patient.hn}</td>
                        <td data-label="ชื่อ-สกุล" style={{ fontWeight: 600 }}>{patient.ptname}</td>
                        <td data-label="อายุ">{patient.age} ปี</td>
                        <td data-label="เตียง" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                          {patient.bedno ? `เตียง ${patient.bedno}` : '-'}
                        </td>
                        <td data-label="ระดับความรุนแรง">
                          <span className={`severityPill pill-${levelId}`}>
                            {displayLevel}
                          </span>
                        </td>
                        <td data-label="สถานะ Observe">
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

        {/* Error Status Warning & Table Section */}
        {data?.errorStatusList && (
          <section className="errorStatusCard card animate-fadeInUp">
            <div className="errorStatusBanner">
              <span className="errorStatusIcon">⚠️</span>
              <span className="errorStatusTitle">
                แสดงสถานะไม่ถูกต้อง จำนวน {data.errorStatusList.total} ราย
              </span>
            </div>

            {data.errorStatusList.total > 0 && (
              <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table className="data-table patientsTable errorStatusTable">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>วันที่มารับบริการ</th>
                      <th style={{ width: '18%', textAlign: 'center' }}>HN</th>
                      <th style={{ width: '25%' }}>สถานะ</th>
                      <th style={{ width: '35%' }}>พยาบาลเวร / เจ้าหน้าที่เวร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.errorStatusList.list.map((item, idx) => {
                      const vstDateObj = item.vstdate ? new Date(item.vstdate) : null
                      const formattedDate = vstDateObj
                        ? vstDateObj.toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'

                      return (
                        <tr key={item.vn || idx} className="errorRow">
                          <td data-label="วันที่มารับบริการ" style={{ fontWeight: 600 }}>
                            {formattedDate}
                          </td>
                          <td data-label="HN" style={{ textAlign: 'center', fontWeight: 700 }}>
                            {item.hn}
                          </td>
                          <td data-label="สถานะ">
                            <span className="errorStatusBadge">
                              {item.status_name || '-'}
                            </span>
                          </td>
                          <td data-label="พยาบาลเวร / เจ้าหน้าที่เวร" style={{ color: 'var(--gray-700)' }}>
                            {item.nname || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Monthly statistics */}
        <section className="erMonthlyStatsGrid animate-fadeInUp">
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
