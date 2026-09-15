'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Pill,
  RefreshCw,
  Search,
  Clock,
  ArrowLeft,
  CheckCircle2,
  FileText,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface PaidPatient {
  hn: string
  ptname: string
  service_time: string
  timelast: string
  department: string
}

interface PrintedPatient {
  hn: string
  ptname: string
  service_time: string
  timelast: string
}

interface ApiResponse {
  paidPatients: PaidPatient[]
  printedPatients: PrintedPatient[]
  updatedAt: string
}

export default function StatusDrugClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch('/api/service/status-drug', { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch drug status:', err)
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

  // Filter based on search query
  const filteredPaid = useMemo(() => {
    if (!data?.paidPatients) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return data.paidPatients
    return data.paidPatients.filter(
      (p) =>
        p.ptname.toLowerCase().includes(q) ||
        p.hn.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
    )
  }, [data, searchQuery])

  const filteredPrinted = useMemo(() => {
    if (!data?.printedPatients) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return data.printedPatients
    return data.printedPatients.filter(
      (p) =>
        p.ptname.toLowerCase().includes(q) ||
        p.hn.toLowerCase().includes(q)
    )
  }, [data, searchQuery])

  // Helper function to check if waiting time is long (> 30 mins or > 1 hr)
  const getTimeClass = (timeStr: string) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10) || 0
      const mins = parseInt(parts[1], 10) || 0
      if (hours > 0 || mins >= 45) return 'urgent'
      if (mins >= 25) return 'warning'
    }
    return ''
  }

  return (
    <div className="drugStatusPage">
      <div className="drugContainer">
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

        <div className="drugHeaderCard">
          <div className="drugTitleWrapper">
            <div className="drugIconBadge">
              <Pill size={26} />
            </div>
            <div className="drugTitleSection">
              <h1>สถานะการรอรับยา งานเภสัชกรรม (OPD Drug Status)</h1>
              <p className="drugSubtitle">
                ติดตามคิวและระยะเวลารอรับยาของผู้ป่วยนอกแบบเรียลไทม์ โรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="drugControls">
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

        {/* Quick Stats Grid (Equal 2 columns) */}
        <div className="drugStatsGrid">
          <div className="drugStatCard amber">
            <div className="drugStatInfo">
              <h3>ผู้ป่วยนอก ที่ผ่านห้องการเงินแล้ว</h3>
              <p className="drugStatDesc">รอพิมพ์ใบสั่งยา / รอจัดยาเข้าคิว</p>
            </div>
            <div className="drugStatNumber">
              {loading ? '...' : data?.paidPatients.length || 0}
              <span>ราย</span>
            </div>
          </div>

          <div className="drugStatCard cyan">
            <div className="drugStatInfo">
              <h3>ผู้ป่วยนอก ที่พิมพ์ใบสั่งยาแล้ว</h3>
              <p className="drugStatDesc">กำลังจัดยา / รอเรียกรับยาที่ช่องจ่าย</p>
            </div>
            <div className="drugStatNumber">
              {loading ? '...' : data?.printedPatients.length || 0}
              <span>ราย</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="drugSearchBar">
          <div className="searchBoxFull">
            <Search className="searchIcon" size={17} />
            <input
              type="text"
              className="searchInput"
              placeholder="ค้นหาชื่อผู้ป่วย, HN, แผนก/ห้องตรวจ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              ผลการค้นหา: ผ่านการเงิน {filteredPaid.length} ราย | พิมพ์ใบสั่งยา {filteredPrinted.length} ราย
            </div>
          )}
        </div>

        {/* Two Columns Grid */}
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              color: '#64748b',
            }}
          >
            <RefreshCw
              size={32}
              className="spinning"
              style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: '#db2777' }}
            />
            <p style={{ margin: 0, fontWeight: 600 }}>กำลังเชื่อมต่อและดึงข้อมูลจากระบบ HOSxP...</p>
          </div>
        ) : (
          <div className="drugTwoColGrid">
            {/* Column 1: ผ่านห้องการเงินแล้ว */}
            <div className="drugColumnCard">
              <div className="drugColumnCard__header amber">
                <div className="drugColumnCard__titleGroup">
                  <FileText size={18} color="#b45309" />
                  <h2 className="amberText">ผู้ป่วยนอก ที่ผ่านห้องการเงินแล้ว</h2>
                </div>
                <span className="drugBadgeCount amber">
                  {filteredPaid.length} ราย
                </span>
              </div>

              <div className="drugTableWrapper">
                {filteredPaid.length === 0 ? (
                  <div className="emptyState">
                    <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0 }}>ไม่มีรายการผู้ป่วยตกค้างในขั้นตอนนี้</p>
                  </div>
                ) : (
                  <table className="drugTable">
                    <thead>
                      <tr>
                        <th style={{ width: '85px', textAlign: 'center' }}>HN</th>
                        <th>ชื่อ - นามสกุล</th>
                        <th style={{ width: '110px', textAlign: 'center' }}>Time Late</th>
                        <th style={{ width: '130px' }}>หน่วยงาน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPaid.map((p, idx) => (
                        <tr key={`${p.hn}-${idx}`}>
                          <td style={{ textAlign: 'center' }}>
                            <span className="hnBadge">{p.hn}</span>
                          </td>
                          <td>
                            <span className="patientFullName">{p.ptname}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`timeLatePill ${getTimeClass(p.timelast)}`}>
                              <Clock size={12} />
                              {p.timelast || '-'}
                            </span>
                          </td>
                          <td>
                            <span className="deptTag">{p.department}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Column 2: พิมพ์ใบสั่งยาแล้ว แต่ยังไม่บันทึกการจ่ายยา */}
            <div className="drugColumnCard">
              <div className="drugColumnCard__header cyan">
                <div className="drugColumnCard__titleGroup">
                  <Pill size={18} color="#0e7490" />
                  <h2 className="cyanText">พิมพ์ใบสั่งยาแล้ว (ยังไม่บันทึกจ่ายยา)</h2>
                </div>
                <span className="drugBadgeCount cyan">
                  {filteredPrinted.length} ราย
                </span>
              </div>

              <div className="drugTableWrapper">
                {filteredPrinted.length === 0 ? (
                  <div className="emptyState">
                    <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0 }}>ไม่มีรายการผู้ป่วยตกค้างในขั้นตอนนี้</p>
                  </div>
                ) : (
                  <table className="drugTable">
                    <thead>
                      <tr>
                        <th style={{ width: '85px', textAlign: 'center' }}>HN</th>
                        <th>ชื่อ - นามสกุล</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Time Late</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrinted.map((p, idx) => (
                        <tr key={`${p.hn}-${idx}`}>
                          <td style={{ textAlign: 'center' }}>
                            <span className="hnBadge">{p.hn}</span>
                          </td>
                          <td>
                            <span className="patientFullName">{p.ptname}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`timeLatePill ${getTimeClass(p.timelast)}`}>
                              <Clock size={12} />
                              {p.timelast || '-'}
                            </span>
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
