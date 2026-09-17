'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Calendar,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface AppointmentMismatch {
  hn: string
  department: string
  vstdate: string
  nextdate: string
  appUser: string
}

interface ApiResponse {
  totalMismatches: number
  updatedAt: string
  mismatches: AppointmentMismatch[]
}

/** Format ISO date string to Thai Buddhist format (e.g. "17 ก.ย. 2569") */
function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr

    const day = date.getDate()
    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear() + 543

    return `${day} ${month} ${year}`
  } catch {
    return dateStr
  }
}

export default function AppointmentMismatchClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch('/api/service/appointment-mismatch', { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch appointment mismatch data:', err)
    } finally {
      setLoading(false)
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 500)
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => {
      fetchData()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="mismatchPage">
      <div className="mismatchContainer">
        {/* Navigation */}
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

        {/* Header Card */}
        <div className="mismatchHeaderCard">
          <div className="mismatchTitleWrapper">
            <div className="mismatchIconBadge">
              <AlertTriangle size={26} />
            </div>
            <div className="mismatchTitleSection">
              <h1>รายการนัดผิดห้องตรวจ</h1>
              <p className="mismatchSubtitle">
                ตรวจสอบรายการนัดหมายที่ระบุห้องตรวจผิด แบบเรียลไทม์ โรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="mismatchControls">
            <div className="lastUpdateText" suppressHydrationWarning>
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

        {/* Combined Warning Banner & Stats */}
        <div className="warningBanner">
          <div className="warningBanner__left">
            <AlertTriangle size={28} className="warningBanner__icon" />
            <div className="warningBanner__content">
              <strong>ทำรายการนัดผิดห้องตรวจ จะทำให้ใช้เครื่องส่งตรวจอัตโนมัติไม่ได้</strong>
              <p>(ให้ระบุห้องตรวจไปที่ จุดซักประวัติของแต่ละแผนก)</p>
              <p className="warningNote">*** รายการจะหายไปหากทำรายการถูกต้อง</p>
            </div>
          </div>

          <div className="warningBanner__stat">
            <div className="warningStat__title">
              <Calendar size={15} color="#d97706" />
              <span>รายการนัดผิดทั้งหมด</span>
            </div>
            <div className="warningStat__value">
              {loading ? '...' : data?.totalMismatches || 0}
              <span className="warningStat__unit">รายการ</span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="emptyState">
            <RefreshCw size={40} className="spinIcon" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && (!data || data.totalMismatches === 0) && (
          <div className="emptyState emptyStateSuccess">
            <CheckCircle2 size={48} color="#10b981" />
            <h3>ไม่มีรายการนัดที่ผิดห้องตรวจ</h3>
            <p>ทุกรายการนัดหมายระบุห้องตรวจถูกต้อง</p>
          </div>
        )}

        {/* Data Table */}
        {!loading && data && data.totalMismatches > 0 && (
          <div className="tableWrapper">
            <table className="mismatchTable">
              <thead>
                <tr>
                  <th className="thCenter">ลำดับ</th>
                  <th className="thCenter">HN</th>
                  <th className="thCenter">ระบุห้องตรวจผิด</th>
                  <th className="thCenter">วันที่มารับบริการ</th>
                  <th className="thCenter">วันที่นัดครั้งถัดไป</th>
                  <th className="thCenter">ชื่อผู้นัด</th>
                </tr>
              </thead>
              <tbody>
                {data.mismatches.map((item, idx) => (
                  <tr key={`${item.hn}-${item.nextdate}-${idx}`}>
                    <td className="tdCenter">{idx + 1}</td>
                    <td className="tdCenter">
                      <span className="hnBadge">{item.hn}</span>
                    </td>
                    <td className="tdCenter">
                      {item.department ? (
                        <span className="deptBadge">{item.department}</span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="tdCenter">{formatThaiDate(item.vstdate)}</td>
                    <td className="tdCenter">{formatThaiDate(item.nextdate)}</td>
                    <td className="tdCenter">
                      {item.appUser ? (
                        <span className="userBadge">{item.appUser}</span>
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
