'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bed,
  RefreshCw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePolling } from '@/hooks/usePolling'
import './page.css'

interface WardSummarySection {
  id: string
  title: string
  shortTitle: string
  floor: string
  badgeColor: string
  accentColor: string
  count: number
}

interface ApiResponse {
  totalPatients: number
  updatedAt: string
  sections: WardSummarySection[]
}

export default function WardStatusPublicClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const res = await fetch('/api/systems/ward-status', { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch public ward status:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Use polling with Page Visibility API (S1)
  const { lastUpdated, refresh } = usePolling(fetchData, 30000)

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
    <div className={`wardStatusPage ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="wardContainer">
        {/* Navigation link (hidden in fullscreen) */}
        {!isFullscreen && (
          <div style={{ marginBottom: '1rem' }}>
            <Link href="/systems" className="backLink">
              <ArrowLeft size={16} /> กลับหน้าระบบสารสนเทศ
            </Link>
          </div>
        )}

        {/* Header Card */}
        <div className="wardHeaderCard">
          <div className="wardTitleWrapper">
            <div className="wardIconBadge">
              <Bed size={28} />
            </div>
            <div className="wardTitleSection">
              <h1>สถานะผู้ป่วยนอนรักษาพยาบาล (IPD Status)</h1>
              <p className="wardSubtitle">
                ติดตามจำนวนผู้ป่วยครองเตียงในแต่ละหอผู้ป่วยแบบเรียลไทม์ โรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="wardControls">
            <div className="lastUpdateText" suppressHydrationWarning>
              อัปเดตล่าสุด:{' '}
              {lastUpdated
                ? `${lastUpdated.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })} น.`
                : 'กำลังโหลด...'}
            </div>

            <button
              className={`actionBtn ${isRefreshing ? 'spinning' : ''}`}
              onClick={refresh}
              disabled={isRefreshing}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>

            <button
              className="actionBtn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'แสดงผลเต็มจอ (TV / Kiosk Mode)'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? 'ย่อจอ' : 'เต็มจอ'}</span>
            </button>
          </div>
        </div>

        {/* 8 Stats Cards Grid */}
        <div className="statsGrid">
          {/* Card 1: Total Patients */}
          <div className="statCard totalCard">
            <div className="statCard__header">
              <span className="statCard__title">ผู้ป่วยในทั้งหมด</span>
              <span className="statCard__pill badge-emerald">รวมทุกหอผู้ป่วย</span>
            </div>
            <div className="statCard__value">
              {loading ? '...' : data?.totalPatients ?? 0}
              <span className="statCard__unit">เตียง</span>
            </div>
          </div>

          {/* Cards 2-8: Ward Sections */}
          {data?.sections && data.sections.length > 0
            ? data.sections.map((sec) => (
                <div key={sec.id} className="statCard">
                  <div className="statCard__header">
                    <span className="statCard__title">{sec.shortTitle}</span>
                    <span className={`statCard__pill ${sec.badgeColor}`}>
                      {sec.floor}
                    </span>
                  </div>
                  <div className="statCard__value">
                    {loading ? '...' : sec.count}
                    <span className="statCard__unit">เตียง</span>
                  </div>
                </div>
              ))
            : loading &&
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="statCard">
                  <div className="statCard__header">
                    <span className="statCard__title">กำลังโหลด...</span>
                  </div>
                  <div className="statCard__value">
                    ...
                    <span className="statCard__unit">เตียง</span>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}
