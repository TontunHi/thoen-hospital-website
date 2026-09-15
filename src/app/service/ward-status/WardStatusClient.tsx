'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bed,
  RefreshCw,
  Search,
  Users,
  Activity,
  Calendar,
  Building2,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface PatientRecord {
  hn: string
  ptname: string
  age: number
  regdate: string
  admitDays: number
  bedno: string
  ward: string
  wardGroup: string
}

interface WardSection {
  id: string
  title: string
  shortTitle: string
  floor: string
  badgeColor: string
  accentColor: string
  patients: PatientRecord[]
}

interface ApiResponse {
  totalPatients: number
  updatedAt: string
  sections: WardSection[]
}

export default function WardStatusClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch('/api/service/ward-status', { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch ward status:', err)
    } finally {
      setLoading(false)
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 500)
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Poll background every 30 seconds
    const interval = setInterval(() => {
      fetchData()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchData])

  // Filter sections and patients based on active tab and search query
  const filteredSections = useMemo(() => {
    if (!data?.sections) return []

    const q = searchQuery.trim().toLowerCase()

    return data.sections
      .filter((sec) => (activeTab === 'all' ? true : sec.id === activeTab))
      .map((sec) => {
        if (!q) return sec
        const matchedPatients = sec.patients.filter(
          (p) =>
            p.ptname.toLowerCase().includes(q) ||
            p.bedno.toLowerCase().includes(q) ||
            p.hn.toLowerCase().includes(q)
        )
        return {
          ...sec,
          patients: matchedPatients,
        }
      })
      .filter((sec) => (activeTab === 'all' && q ? sec.patients.length > 0 : true))
  }, [data, activeTab, searchQuery])

  const totalFilteredCount = useMemo(() => {
    return filteredSections.reduce((acc, sec) => acc + sec.patients.length, 0)
  }, [filteredSections])

  return (
    <div className="wardStatusPage">
      <div className="wardContainer">
        {/* Navigation & Header */}
        <div style={{ marginBottom: '1rem' }}>
          <Link
            href="/service"
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
            <ArrowLeft size={16} /> กลับหน้ารวมบริการ
          </Link>
        </div>

        <div className="wardHeaderCard">
          <div className="wardTitleWrapper">
            <div className="wardIconBadge">
              <Bed size={26} />
            </div>
            <div className="wardTitleSection">
              <h1>สถานะผู้ป่วยนอนรักษาพยาบาล (IPD Status)</h1>
              <p className="wardSubtitle">
                ติดตามจำนวนผู้ป่วยครองเตียงในแต่ละหอผู้ป่วยแบบเรียลไทม์ โรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="wardControls">
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
              className={`refreshBtn ${isRefreshing ? 'spinning' : ''}`}
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="statsGrid">
          <div
            className={`statCard ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <div className="statCard__header">
              <span className="statCard__title">ผู้ป่วยในทั้งหมด</span>
              <Users size={16} color="#0d9488" />
            </div>
            <div className="statCard__value">
              {loading ? '...' : data?.totalPatients || 0}
              <span className="statCard__unit">เตียง</span>
            </div>
          </div>

          {data?.sections.map((sec) => (
            <div
              key={sec.id}
              className={`statCard ${activeTab === sec.id ? 'active' : ''}`}
              onClick={() => setActiveTab(sec.id)}
            >
              <div className="statCard__header">
                <span className="statCard__title">{sec.shortTitle}</span>
                <span className={`statCard__pill ${sec.badgeColor}`}>{sec.floor}</span>
              </div>
              <div className="statCard__value">
                {loading ? '...' : sec.patients.length}
                <span className="statCard__unit">เตียง</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filter and Search Bar */}
        <div className="filterBar">
          <div className="tabsList">
            <button
              className={`tabBtn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              ทั้งหมด ({data?.totalPatients || 0})
            </button>
            {data?.sections.map((sec) => (
              <button
                key={sec.id}
                className={`tabBtn ${activeTab === sec.id ? 'active' : ''}`}
                onClick={() => setActiveTab(sec.id)}
              >
                {sec.shortTitle} ({sec.patients.length})
              </button>
            ))}
          </div>

          <div className="searchBox">
            <Search className="searchIcon" size={17} />
            <input
              type="text"
              className="searchInput"
              placeholder="ค้นหาชื่อผู้ป่วย, เลขเตียง, HN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Patients Tables by Ward */}
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              background: '#ffffff',
              borderRadius: '12px',
              color: '#64748b',
            }}
          >
            <RefreshCw
              size={32}
              className="spinning"
              style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: '#0d9488' }}
            />
            <p style={{ margin: 0, fontWeight: 600 }}>กำลังเชื่อมต่อและดึงข้อมูลจากระบบ HOSxP...</p>
          </div>
        ) : filteredSections.length === 0 || totalFilteredCount === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3.5rem 1rem',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              color: '#64748b',
            }}
          >
            <Users size={38} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155', margin: 0 }}>
              {searchQuery ? 'ไม่พบข้อมูลผู้ป่วยตามคำค้นหา' : 'ไม่มีผู้ป่วยนอนรักษาพยาบาลในขณะนี้'}
            </p>
            {searchQuery && (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                ลองเปลี่ยนคำค้นหา หรือกดปุ่มรีเซ็ตการค้นหา
              </p>
            )}
          </div>
        ) : (
          <div className="wardSectionsGrid">
            {filteredSections.map((sec) => (
              <div key={sec.id} className="wardSection">
              <div className="wardSection__header">
                <div className="wardSection__titleGroup">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: sec.accentColor,
                      display: 'inline-block',
                    }}
                  />
                  <h2>{sec.title}</h2>
                  <span className="floorTag">{sec.floor}</span>
                </div>
                <div className="countBadge">
                  ครองเตียง {sec.patients.length} ราย
                </div>
              </div>

              <div className="wardTableWrapper">
                {sec.patients.length === 0 ? (
                  <div className="emptyState">ไม่มีผู้ป่วยนอนในหอผู้ป่วยนี้ในขณะนี้</div>
                ) : (
                  <table className="wardTable">
                    <thead>
                      <tr>
                        <th style={{ width: '100px', textAlign: 'center' }}>เตียง</th>
                        <th>ชื่อผู้ป่วย (PDPA)</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>อายุ</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>วันที่ Admit</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>ระยะเวลานอน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.patients.map((p, idx) => (
                        <tr key={`${p.bedno}-${idx}`}>
                          <td style={{ textAlign: 'center' }}>
                            <span className="bedBadge">{p.bedno}</span>
                          </td>
                          <td>
                            <div className="patientName">{p.ptname}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {p.age > 0 ? `${p.age} ปี` : '< 1 ปี'}
                          </td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>
                            {p.regdate || '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`daysPill ${
                                p.admitDays >= 7 ? 'longStay' : ''
                              }`}
                            >
                              {p.admitDays === 0 ? 'วันนี้' : `${p.admitDays} วัน`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
