'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  ShieldCheck,
} from 'lucide-react'
import '../events.css'

function CheckinStatusContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'error'
  const message = searchParams.get('message') || ''
  const name = searchParams.get('name') || ''
  const dept = searchParams.get('dept') || ''
  const eventTitle = searchParams.get('event') || ''
  const points = searchParams.get('points') || '1'
  const time = searchParams.get('time') || ''
  const type = searchParams.get('type') || ''
  const openTime = searchParams.get('openTime') || ''
  const closeTime = searchParams.get('closeTime') || ''

  const formatThaiTime = (input?: string) => {
    if (!input) return ''
    try {
      const trimmed = String(input).trim()
      // If time only (e.g. '11:42' or '11:42:00')
      const timeOnly = trimmed.match(/^(\d{2}:\d{2})(?::\d{2})?$/)
      if (timeOnly) {
        return `${timeOnly[1]} น.`
      }
      // If Bangkok ISO or local datetime string without Z (e.g. '2026-10-21T11:42:56+07:00' or '2026-10-21 11:42:56')
      const match = trimmed.match(/[T ](\d{2}:\d{2})/)
      if (match && !trimmed.endsWith('Z')) {
        return `${match[1]} น.`
      }
      // If UTC ISO (e.g. '2026-10-21T04:42:56.000Z'), convert to Asia/Bangkok
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok', hour12: false }) + ' น.'
      }
      return match ? `${match[1]} น.` : trimmed
    } catch {
      return input
    }
  }

  // 1. Success State
  if (status === 'success') {
    return (
      <div className="checkinResultCard">
        <div className="checkinTopBar success" />

        <div className="checkinCircleIcon checkinSuccess">
          <CheckCircle2 size={44} />
        </div>

        <div
          className="eventsPillTag"
          style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', marginBottom: '0.5rem' }}
        >
          <ShieldCheck size={14} />
          <span>ยืนยันตัวตนด้วย ThaID สำเร็จ</span>
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0 0.25rem 0', color: '#0f172a' }}>
          เช็คอินเข้าร่วมกิจกรรมสำเร็จ!
        </h1>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
          ระบบได้บันทึกการเข้าร่วมงานและเพิ่มคะแนนให้ท่านเรียบร้อยแล้ว
        </p>

        {/* User Card */}
        <div className="checkinUserBox">
          <div>
            <span className="checkinUserFieldTitle">ชื่อผู้เข้าร่วม</span>
            <span className="checkinUserFieldValue">{name || 'บุคลากรโรงพยาบาลเถิน'}</span>
          </div>

          {dept && (
            <div>
              <span className="checkinUserFieldTitle">กลุ่มงาน / แผนก</span>
              <span className="checkinUserFieldValue">{dept}</span>
            </div>
          )}

          {eventTitle && (
            <div>
              <span className="checkinUserFieldTitle">กิจกรรม</span>
              <span className="checkinUserFieldValue" style={{ color: '#059669' }}>
                {eventTitle}
              </span>
            </div>
          )}

          {time && (
            <div>
              <span className="checkinUserFieldTitle">เวลาที่เช็คอิน</span>
              <span className="checkinUserFieldValue" style={{ color: '#64748b' }}>
                {formatThaiTime(time)}
              </span>
            </div>
          )}
        </div>

        {/* Points Awarded Badge */}
        <div className="checkinPointsRewardBox">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={20} color="#d97706" />
            <span>คะแนนที่ได้รับ</span>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#047857' }}>
            +{points} คะแนน 🎉
          </span>
        </div>

        {/* Navigation Action Buttons */}
        <div>
          <Link href="/member/events/leaderboard" className="checkinBtnPrimary">
            <Trophy size={16} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: '-2px' }} />
            <span>ดูกระดานคะแนน</span>
          </Link>
          <Link href="/member/events" className="checkinBtnSecondary">
            <span>กลับหน้ารายการกิจกรรม</span>
          </Link>
        </div>
      </div>
    )
  }

  // 2. Time Window Error State
  if (status === 'time_error') {
    const isEarly = type === 'early'
    return (
      <div className="checkinResultCard">
        <div className="checkinTopBar warning" />

        <div className="checkinCircleIcon checkinWarning">
          <Clock size={44} />
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0 0.25rem 0', color: '#0f172a' }}>
          {isEarly ? 'ยังไม่ถึงเวลาเปิดรับสแกน' : 'หมดเวลาเช็คอินแล้ว'}
        </h1>

        <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.5rem 0 1rem 0' }}>
          {isEarly
            ? `กิจกรรมนี้จะเปิดให้สแกนเช็คอินเวลา ${formatThaiTime(openTime)}`
            : `กิจกรรมนี้ปิดรับสแกนเช็คอินไปแล้วเมื่อเวลา ${formatThaiTime(closeTime)}`}
        </p>

        {eventTitle && (
          <div
            style={{
              padding: '0.75rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              fontWeight: 600,
              fontSize: '0.825rem',
              marginBottom: '1.25rem',
              color: '#1e293b',
            }}
          >
            {eventTitle}
          </div>
        )}

        <Link
          href="/member/events"
          className="checkinBtnPrimary"
          style={{ background: '#334155' }}
        >
          <span>กลับหน้ารายการกิจกรรม</span>
        </Link>
      </div>
    )
  }

  // 3. Generic Error State
  return (
    <div className="checkinResultCard">
      <div className="checkinTopBar error" />

      <div className="checkinCircleIcon checkinError">
        <XCircle size={44} />
      </div>

      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0 0.25rem 0', color: '#0f172a' }}>
        ไม่สามารถเช็คอินได้
      </h1>

      <div
        style={{
          padding: '0.85rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.75rem',
          color: '#991b1b',
          fontSize: '0.825rem',
          margin: '1rem 0 1.25rem 0',
          lineHeight: 1.5,
        }}
      >
        {message || 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล หรือรหัสกิจกรรมไม่ถูกต้อง'}
      </div>

      <Link
        href="/member/events"
        className="checkinBtnPrimary"
        style={{ background: '#334155' }}
      >
        <span>กลับหน้ารายการกิจกรรม</span>
      </Link>
    </div>
  )
}

export default function CheckinStatusPage() {
  return (
    <div className="checkinPageWrapper">
      <Suspense
        fallback={
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            กำลังโหลดข้อมูลผลการเช็คอิน...
          </div>
        }
      >
        <CheckinStatusContent />
      </Suspense>
    </div>
  )
}
