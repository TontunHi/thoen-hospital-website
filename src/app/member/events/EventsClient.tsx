'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { getBangkokDateParts } from '@/lib/events/eventTimeUtils'
import './events-list.css'

export interface CurrentUser {
  id: number
  username: string
  name: string
  department: string | null
  position: string | null
  role: string
  isAdmin: boolean
}

export interface EventItem {
  id: number
  title: string
  description?: string | null
  location?: string | null
  bannerUrl?: string | null
  eventStartDate: string
  eventEndDate: string
  checkinOpenTime: string
  checkinCloseTime: string
  fiscalYear: string
  status: string
  headOrganizerId: number
  headOrganizer?: {
    id: number
    name: string | null
    department: string | null
    profilePath: string | null
  }
  coOrganizers?: Array<{
    member: {
      id: number
      name: string | null
      department: string | null
      profilePath: string | null
    }
  }>
  registrationCount: number
  attendanceCount: number
  isOrganizer: boolean
  hasRegistered?: boolean
  hasAttended?: boolean
}

export interface UserStats {
  totalPoints: number
  registeredCount: number
}

export interface EventsClientProps {
  initialEvents: EventItem[]
  userStats: UserStats
  currentUser: CurrentUser
}

function parseEventDate(dateString: string) {
  try {
    const parts = getBangkokDateParts(dateString)
    const dObj = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0))
    const monthShort = new Intl.DateTimeFormat('th-TH', { month: 'short', timeZone: 'UTC' }).format(dObj)
    const monthFull = new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'UTC' }).format(dObj)
    return {
      day: parts.day,
      monthShort,
      monthFull,
      thaiYear: parts.year + 543,
      groupKey: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
    }
  } catch {
    const date = new Date(dateString)
    const y = isNaN(date.getFullYear()) ? 2026 : date.getFullYear()
    const m = isNaN(date.getMonth()) ? 0 : date.getMonth()
    const d = isNaN(date.getDate()) ? 1 : date.getDate()
    const dObj = new Date(Date.UTC(y, m, d, 12, 0, 0))
    const monthShort = new Intl.DateTimeFormat('th-TH', { month: 'short', timeZone: 'UTC' }).format(dObj)
    const monthFull = new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'UTC' }).format(dObj)
    return {
      day: d,
      monthShort,
      monthFull,
      thaiYear: y + 543,
      groupKey: `${y}-${String(m + 1).padStart(2, '0')}`,
    }
  }
}

function formatThaiTimeRange(startStr: string, endStr: string) {
  try {
    const s = getBangkokDateParts(startStr)
    const e = getBangkokDateParts(endStr)
    const sTime = `${String(s.hours).padStart(2, '0')}:${String(s.minutes).padStart(2, '0')}`
    const eTime = `${String(e.hours).padStart(2, '0')}:${String(e.minutes).padStart(2, '0')}`
    return `${sTime} - ${eTime} น.`
  } catch {
    return ''
  }
}

export default function EventsClient({
  initialEvents,
  userStats,
  currentUser,
}: EventsClientProps) {
  const [allEvents, setAllEvents] = useState<EventItem[]>(initialEvents)
  const [events, setEvents] = useState<EventItem[]>(initialEvents)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'registered'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('ALL')
  const [, setLoading] = useState(false)
  const [registeringId, setRegisteringId] = useState<number | null>(null)
  const [registeredCount, setRegisteredCount] = useState<number>(userStats.registeredCount)

  // Counts for each filter tab
  const counts = useMemo(() => {
    const nowTime = new Date().getTime()
    let upcoming = 0
    let completed = 0

    for (const ev of allEvents) {
      const endTime = new Date(ev.eventEndDate).getTime()
      if (endTime >= nowTime) {
        upcoming++
      } else {
        completed++
      }
    }

    return {
      upcoming,
      completed,
      registered: registeredCount,
    }
  }, [allEvents, registeredCount])

  // Filter & sort events
  const sortedFilteredEvents = useMemo(() => {
    const nowTime = new Date().getTime()

    const filtered = events.filter((ev) => {
      // 1. Tab-based filtering
      if (activeTab === 'upcoming') {
        const isUpcoming = new Date(ev.eventEndDate).getTime() >= nowTime
        if (!isUpcoming) return false
      } else if (activeTab === 'completed') {
        const isCompleted = new Date(ev.eventEndDate).getTime() < nowTime
        if (!isCompleted) return false
      }

      // 2. Fiscal year filtering
      if (fiscalYearFilter !== 'ALL' && ev.fiscalYear !== fiscalYearFilter) {
        return false
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = ev.title.toLowerCase().includes(q)
        const matchLoc = ev.location?.toLowerCase().includes(q) || false
        if (!matchTitle && !matchLoc) return false
      }

      return true
    })

    return [...filtered].sort((a, b) => {
      const aEndTime = new Date(a.eventEndDate).getTime()
      const bEndTime = new Date(b.eventEndDate).getTime()
      const aStartTime = new Date(a.eventStartDate).getTime()
      const bStartTime = new Date(b.eventStartDate).getTime()

      const aIsPast = aEndTime < nowTime
      const bIsPast = bEndTime < nowTime

      // Upcoming / ongoing before finished
      if (!aIsPast && bIsPast) return -1
      if (aIsPast && !bIsPast) return 1

      // If upcoming / ongoing: sort ascending (nearest first)
      if (!aIsPast && !bIsPast) {
        if (aStartTime !== bStartTime) return aStartTime - bStartTime
        return aEndTime - bEndTime
      }

      // If finished: sort descending (most recent first)
      if (bEndTime !== aEndTime) return bEndTime - aEndTime
      return bStartTime - aStartTime
    })
  }, [events, activeTab, fiscalYearFilter, searchQuery])

  // Extract distinct fiscal years
  const availableFiscalYears = useMemo(() => {
    return Array.from(
      new Set(allEvents.map((e) => e.fiscalYear).filter(Boolean))
    ).sort().reverse()
  }, [allEvents])

  // Group events by month / group
  const groupedEvents = useMemo(() => {
    if (sortedFilteredEvents.length === 0) return []

    // Completed tab uses a single group "เสร็จสิ้นแล้ว"
    if (activeTab === 'completed') {
      return [
        {
          key: 'completed-all',
          title: 'เสร็จสิ้นแล้ว',
          events: sortedFilteredEvents,
        },
      ]
    }

    // Upcoming and registered group by month and Buddhist year
    const map = new Map<string, { key: string; title: string; events: EventItem[] }>()

    for (const ev of sortedFilteredEvents) {
      const parsed = parseEventDate(ev.eventStartDate)
      const key = parsed.groupKey
      const title = `${parsed.monthFull} ${parsed.thaiYear}`

      if (!map.has(key)) {
        map.set(key, { key, title, events: [] })
      }
      map.get(key)!.events.push(ev)
    }

    return Array.from(map.values())
  }, [sortedFilteredEvents, activeTab])

  const handleTabChange = async (tab: 'upcoming' | 'completed' | 'registered') => {
    setActiveTab(tab)
    setLoading(true)
    try {
      const res = await fetch(`/api/member/events?tab=${tab}`)
      const json = await res.json()
      if (json.success && json.events) {
        setEvents(json.events)
      }
    } catch (err) {
      console.error('Error fetching tab events:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle pre-registration toggle (register or cancel)
  const handleToggleRegistration = async (e: React.MouseEvent, targetEvent: EventItem) => {
    e.preventDefault()
    e.stopPropagation()

    if (registeringId === targetEvent.id) return

    setRegisteringId(targetEvent.id)
    const isCurrentlyRegistered = Boolean(targetEvent.hasRegistered)
    const method = isCurrentlyRegistered ? 'DELETE' : 'POST'

    try {
      const res = await fetch(`/api/member/events/${targetEvent.id}/register`, { method })
      const json = await res.json()

      if (json.success) {
        const nextRegistered = !isCurrentlyRegistered
        const countDelta = nextRegistered ? 1 : -1

        // Update events state
        setEvents((prev) =>
          prev.map((item) =>
            item.id === targetEvent.id
              ? {
                  ...item,
                  hasRegistered: nextRegistered,
                  registrationCount: Math.max(0, item.registrationCount + countDelta),
                }
              : item
          )
        )

        // Update allEvents state so counts stay in sync
        setAllEvents((prev) =>
          prev.map((item) =>
            item.id === targetEvent.id
              ? {
                  ...item,
                  hasRegistered: nextRegistered,
                  registrationCount: Math.max(0, item.registrationCount + countDelta),
                }
              : item
          )
        )

        // Update user registeredCount stats
        setRegisteredCount((prev) => Math.max(0, prev + countDelta))
      } else {
        alert(json.error || 'เกิดข้อผิดพลาดในการลงทะเบียน')
      }
    } catch (err: any) {
      console.error('Error toggling registration:', err)
      alert(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setRegisteringId(null)
    }
  }

  return (
    <div className="ev-page">
      <div className="ev-container">
        {/* 1. ลิงก์กลับ */}
        <div>
          <Link href="/member" className="ev-back-link">
            ← กลับสู่ระบบสมาชิก
          </Link>
        </div>

        {/* 2. หัวหน้า */}
        <header className="ev-header">
          <div className="ev-header-text">
            <h1 className="ev-title">กิจกรรมและโครงการโรงพยาบาลเถิน</h1>
            <p className="ev-subtitle">
              เข้าร่วมกิจกรรม สแกนเช็คอินผ่าน ThaID หน้างานเพื่อสะสมคะแนน และติดตามอันดับการมีส่วนร่วมของบุคลากร
            </p>
          </div>

          <div className="ev-header-actions">
            <Link href="/member/events/leaderboard" className="ev-btn-secondary">
              กระดานคะแนน
            </Link>
            {currentUser.isAdmin && (
              <Link href="/member/events/create" className="ev-btn-primary">
                + สร้างกิจกรรมใหม่
              </Link>
            )}
          </div>
        </header>

        {/* 3. แถบสถิติ */}
        <section className="ev-stats-strip" aria-label="สรุปสถิติกิจกรรม">
          <div className="ev-stat-box">
            <span className="ev-stat-label">คะแนนสะสมของฉัน</span>
            <div className="ev-stat-value">
              {userStats.totalPoints} <span className="ev-stat-unit">คะแนน</span>
            </div>
          </div>

          <div className="ev-stat-box">
            <span className="ev-stat-label">กิจกรรมที่ลงทะเบียนไว้</span>
            <div className="ev-stat-value">
              {registeredCount} <span className="ev-stat-unit">งาน</span>
            </div>
          </div>

          <div className="ev-stat-box">
            <span className="ev-stat-label">กิจกรรมทั้งหมดในระบบ</span>
            <div className="ev-stat-value">
              {allEvents.length} <span className="ev-stat-unit">งาน</span>
            </div>
          </div>
        </section>

        {/* 4. แถบเครื่องมือ */}
        <section className="ev-toolbar" aria-label="เครื่องมือค้นหาและกรองกิจกรรม">
          <div className="ev-segmented-control" role="tablist" aria-label="หมวดหมู่กิจกรรม">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upcoming'}
              aria-pressed={activeTab === 'upcoming'}
              onClick={() => handleTabChange('upcoming')}
              className={`ev-tab-btn ${activeTab === 'upcoming' ? 'ev-tab-active' : ''}`}
            >
              เร็วๆ นี้ · {counts.upcoming}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'completed'}
              aria-pressed={activeTab === 'completed'}
              onClick={() => handleTabChange('completed')}
              className={`ev-tab-btn ${activeTab === 'completed' ? 'ev-tab-active' : ''}`}
            >
              เสร็จสิ้น · {counts.completed}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'registered'}
              aria-pressed={activeTab === 'registered'}
              onClick={() => handleTabChange('registered')}
              className={`ev-tab-btn ${activeTab === 'registered' ? 'ev-tab-active' : ''}`}
            >
              ที่ฉันลงทะเบียน · {counts.registered}
            </button>
          </div>

          <div className="ev-toolbar-controls">
            <div className="ev-search-wrap">
              <input
                type="search"
                placeholder="ค้นหาชื่อกิจกรรม หรือสถานที่"
                aria-label="ค้นหาชื่อกิจกรรม หรือสถานที่"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ev-search-input"
              />
            </div>

            <div className="ev-select-wrap">
              <select
                value={fiscalYearFilter}
                onChange={(e) => setFiscalYearFilter(e.target.value)}
                className="ev-year-select"
                aria-label="เลือกปีงบประมาณ"
              >
                <option value="ALL">ทุกปีงบประมาณ</option>
                {availableFiscalYears.map((yr) => (
                  <option key={yr} value={yr}>
                    ปีงบฯ {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 5. รายการกิจกรรม (จัดกลุ่มตามเดือน) */}
        {groupedEvents.length === 0 ? (
          <div className="ev-empty-card">
            <p className="ev-empty-text">
              {activeTab === 'registered'
                ? 'ยังไม่มีกิจกรรมที่คุณลงทะเบียนไว้'
                : 'ไม่พบกิจกรรมที่ตรงกับเงื่อนไข'}
            </p>
          </div>
        ) : (
          <div className="ev-group-list">
            {groupedEvents.map((group) => (
              <div key={group.key} className="ev-group-card">
                <div className="ev-group-header">
                  {group.title}
                </div>

                <div className="ev-group-items">
                  {group.events.map((event) => {
                    const now = new Date()
                    const startDate = new Date(event.eventStartDate)
                    const endDate = new Date(event.eventEndDate)
                    const isPast = endDate < now
                    const isOngoing = now >= startDate && now <= endDate
                    const parsed = parseEventDate(event.eventStartDate)
                    const isOrganizer =
                      event.headOrganizerId === currentUser.id ||
                      event.coOrganizers?.some((c) => c.member?.id === currentUser.id) ||
                      currentUser.isAdmin

                    return (
                      <div key={event.id} className="ev-row">
                        {/* 1. วันที่ (กว้าง 56px) */}
                        <div className="ev-date-col">
                          <span className="ev-date-day">{parsed.day}</span>
                          <span className="ev-date-month">{parsed.monthShort}</span>
                        </div>

                        {/* 2. ข้อมูลหลัก (ยืดได้) */}
                        <div className="ev-info-col">
                          <Link href={`/member/events/${event.id}`} className="ev-title-link">
                            {event.title}
                          </Link>
                          <div className="ev-meta-row">
                            {isOngoing && <span className="ev-ongoing-label">กำลังจัดงาน · </span>}
                            <span>{formatThaiTimeRange(event.eventStartDate, event.eventEndDate)}</span>
                            {event.location && <span> · {event.location}</span>}
                          </div>
                        </div>

                        {/* 3. ตัวเลขสถิติ */}
                        <div className="ev-numbers-col">
                          <div className="ev-num-box">
                            <span className="ev-num-label">ลงทะเบียน</span>
                            <span className="ev-num-val">{event.registrationCount}</span>
                          </div>
                          <div className="ev-num-box">
                            <span className="ev-num-label">เข้าร่วมงาน</span>
                            <span className="ev-num-val">{event.attendanceCount}</span>
                          </div>
                        </div>

                        {/* 4. การกระทำ */}
                        <div className="ev-actions-col">
                          {isOrganizer && (
                            <Link href={`/member/events/${event.id}`} className="ev-btn-qr">
                              QR Code
                            </Link>
                          )}

                          {!isPast ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleRegistration(e, event)}
                              disabled={registeringId === event.id}
                              className={`ev-btn-register ${
                                event.hasRegistered ? 'ev-reg-active' : 'ev-reg-default'
                              }`}
                              title={event.hasRegistered ? 'กดซ้ำเพื่อยกเลิก' : 'ลงทะเบียนล่วงหน้า'}
                            >
                              {registeringId === event.id
                                ? 'กำลังบันทึก...'
                                : event.hasRegistered
                                ? 'ลงทะเบียนแล้ว'
                                : 'ลงทะเบียนล่วงหน้า'}
                            </button>
                          ) : (
                            <Link href={`/member/events/${event.id}`} className="ev-link-detail">
                              ดูรายละเอียด
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
