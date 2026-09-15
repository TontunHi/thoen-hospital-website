'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  RefreshCw,
  Maximize2,
  Minimize2,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface OrPatient {
  hn: string
  ptname: string
  age_text: number
  room_name: string
  request_time: string
  status_name: string
}

interface ApiResponse {
  waiting: OrPatient[]
  inProgress: OrPatient[]
  recovery: OrPatient[]
  total: number
  updatedAt: string
}

export default function StatusOrClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch('/api/systems/status-or', { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch OR status:', err)
    } finally {
      setLoading(false)
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 500)
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchData])

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  return (
    <div className={`orStatusPage ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="orContainer">
        {/* Navigation link (hidden in fullscreen) */}
        {!isFullscreen && (
          <div style={{ marginBottom: '1rem' }}>
            <Link
              href="/systems"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#64748b',
                fontSize: '0.9rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={16} /> กลับหน้าระบบสารสนเทศ
            </Link>
          </div>
        )}

        {/* Header Card */}
        <div className="orHeaderCard">
          <div className="orTitleWrapper">
            <div className="orIconBadge">
              <Activity size={28} />
            </div>
            <div className="orTitleSection">
              <h1>สถานะการให้บริการห้องผ่าตัด (OR Live Status)</h1>
              <p className="orSubtitle">
                แสดงสถานะผู้ป่วยประจำวัน: รอผ่าตัด, กำลังผ่าตัด, และผ่าตัดเสร็จ/พักฟื้น โรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="orControls">
            <div className="lastUpdateText">
              อัปเดตล่าสุด:{' '}
              {lastUpdated.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}{' '}
              น.
            </div>

            <button
              className={`actionBtn ${isRefreshing ? 'spinning' : ''}`}
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>

            <button
              className="actionBtn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'เปิดโหมดเต็มจอ'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? 'ย่อจอ' : 'เต็มจอ'}</span>
            </button>
          </div>
        </div>

        {/* Hospital Slogan Banner */}
        <div className="orSloganBanner">
          <h2>ห่วงใย.....ใส่ใจ.....ได้มาตรฐาน &nbsp;•&nbsp; งานผ่าตัด โรงพยาบาลเถิน จังหวัดลำปาง</h2>
        </div>

        {/* 3 Equal Columns Layout (33.3% each) */}
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '5rem 1rem',
              background: isFullscreen ? '#1e293b' : '#ffffff',
              borderRadius: '16px',
              border: `1px solid ${isFullscreen ? '#334155' : '#e2e8f0'}`,
              color: '#94a3b8',
            }}
          >
            <RefreshCw
              size={36}
              className="spinning"
              style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: '#2563eb' }}
            />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem' }}>
              กำลังเชื่อมต่อและดึงข้อมูลจากระบบห้องผ่าตัด HOSxP...
            </p>
          </div>
        ) : (
          <div className="orThreeColGrid">
            {/* Column 1: รอผ่าตัด */}
            <div className="orColCard">
              <div className="orColCard__header waiting">
                <div className="orColCard__titleGroup">
                  <Clock size={20} color="#a16207" />
                  <h2 className="waitingTitle">รอผ่าตัด</h2>
                </div>
                <span className="orBadgeCount waiting">
                  {data?.waiting.length || 0} ราย
                </span>
              </div>

              <div className="orTableWrapper">
                {!data?.waiting || data.waiting.length === 0 ? (
                  <div className="emptyState">ไม่มีรายการผู้ป่วยรอผ่าตัดในขณะนี้</div>
                ) : (
                  <table className="orTable">
                    <thead>
                      <tr>
                        <th>ชื่อผู้ป่วย</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>อายุ</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>ห้อง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.waiting.map((p, idx) => (
                        <tr key={`${p.hn}-${idx}`}>
                          <td>
                            <div className="patientNameCell">{p.ptname}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {p.age_text ? `${p.age_text} ปี` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="roomTag">{p.room_name}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Column 2: กำลังผ่าตัด */}
            <div className="orColCard">
              <div className="orColCard__header inProgress">
                <div className="orColCard__titleGroup">
                  <Activity size={20} color="#be185d" />
                  <h2 className="inProgressTitle">กำลังผ่าตัด</h2>
                </div>
                <span className="orBadgeCount inProgress">
                  {data?.inProgress.length || 0} ราย
                </span>
              </div>

              <div className="orTableWrapper">
                {!data?.inProgress || data.inProgress.length === 0 ? (
                  <div className="emptyState">ไม่มีผู้ป่วยกำลังผ่าตัดในขณะนี้</div>
                ) : (
                  <table className="orTable">
                    <thead>
                      <tr>
                        <th>ชื่อผู้ป่วย</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>อายุ</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>ห้อง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inProgress.map((p, idx) => (
                        <tr key={`${p.hn}-${idx}`}>
                          <td>
                            <div className="patientNameCell">{p.ptname}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {p.age_text ? `${p.age_text} ปี` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="roomTag">{p.room_name}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Column 3: ผ่าตัดเสร็จ/พักฟื้น */}
            <div className="orColCard">
              <div className="orColCard__header recovery">
                <div className="orColCard__titleGroup">
                  <CheckCircle2 size={20} color="#0e7490" />
                  <h2 className="recoveryTitle">ผ่าตัดเสร็จ/พักฟื้น</h2>
                </div>
                <span className="orBadgeCount recovery">
                  {data?.recovery.length || 0} ราย
                </span>
              </div>

              <div className="orTableWrapper">
                {!data?.recovery || data.recovery.length === 0 ? (
                  <div className="emptyState">ไม่มีผู้ป่วยพักฟื้นในขณะนี้</div>
                ) : (
                  <table className="orTable">
                    <thead>
                      <tr>
                        <th>ชื่อผู้ป่วย</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>อายุ</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>ห้อง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recovery.map((p, idx) => (
                        <tr key={`${p.hn}-${idx}`}>
                          <td>
                            <div className="patientNameCell">{p.ptname}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {p.age_text ? `${p.age_text} ปี` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="roomTag">{p.room_name}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
