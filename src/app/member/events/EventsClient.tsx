'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  PlusCircle,
  Trophy,
  Search,
  ChevronRight,
  QrCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
} from 'lucide-react'
import './events.css'

interface CurrentUser {
  id: number
  username: string
  name: string
  department: string | null
  position: string | null
  role: string
  isAdmin: boolean
}

interface EventItem {
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

interface UserStats {
  totalPoints: number
  registeredCount: number
}

interface EventsClientProps {
  initialEvents: EventItem[]
  userStats: UserStats
  currentUser: CurrentUser
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
  const [loading, setLoading] = useState(false)
  const [registeringId, setRegisteringId] = useState<number | null>(null)
  const [registeredCount, setRegisteredCount] = useState<number>(userStats.registeredCount)

  // Format date in Thai Buddhist Era (พ.ศ.)
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ]

  const formatThaiDate = (dateString: string) => {
    try {
      const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/)
      if (match) {
        const year = parseInt(match[1], 10) + 543
        const month = thaiMonths[parseInt(match[2], 10) - 1]
        const day = parseInt(match[3], 10)
        return `${day} ${month} ${year} เวลา ${match[4]} น.`
      }
      const d = new Date(dateString)
      const day = d.getDate()
      const month = thaiMonths[d.getMonth()]
      const year = d.getFullYear() + 543
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
      return `${day} ${month} ${year} เวลา ${time} น.`
    } catch {
      return dateString
    }
  }

  const formatThaiDateOnly = (dateString: string) => {
    try {
      const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (match) {
        const year = parseInt(match[1], 10) + 543
        const month = thaiMonths[parseInt(match[2], 10) - 1]
        const day = parseInt(match[3], 10)
        return `${day} ${month} ${year}`
      }
      const d = new Date(dateString)
      return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`
    } catch {
      return dateString
    }
  }

  const formatThaiTimeRange = (startStr: string, endStr: string) => {
    try {
      const ms = String(startStr).match(/[T ](\d{2}:\d{2})/)
      const me = String(endStr).match(/[T ](\d{2}:\d{2})/)
      if (ms && me) {
        return `${ms[1]} - ${me[1]} น.`
      }
      const s = new Date(startStr)
      const e = new Date(endStr)
      const sTime = s.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
      const eTime = e.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
      return `${sTime} - ${eTime} น.`
    } catch {
      return ''
    }
  }

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

  // Filter & sort events: Upcoming / Ongoing first (ordered by start date asc), then Completed (ordered by end date desc)
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
        const matchDesc = ev.description?.toLowerCase().includes(q) || false
        const matchLoc = ev.location?.toLowerCase().includes(q) || false
        const matchOrg = ev.headOrganizer?.name?.toLowerCase().includes(q) || false
        if (!matchTitle && !matchDesc && !matchLoc && !matchOrg) return false
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

      // 1. กิจกรรมที่จะมาถึง (หรือกำลังจัดงาน) แสดงก่อนกิจกรรมที่เสร็จสิ้น (จะมาถึง > เสร็จสิ้น)
      if (!aIsPast && bIsPast) return -1
      if (aIsPast && !bIsPast) return 1

      // 2. ถ้าอยู่ในกลุ่ม "จะมาถึง / กำลังจัดงาน": เรียงวันจากใกล้ถึงที่สุด ไปยังวันไกลสุด (Ascending)
      if (!aIsPast && !bIsPast) {
        if (aStartTime !== bStartTime) return aStartTime - bStartTime
        return aEndTime - bEndTime
      }

      // 3. ถ้าอยู่ในกลุ่ม "เสร็จสิ้น": เรียงวันจากวันที่สิ้นสุดล่าสุดลงไป (Descending)
      if (bEndTime !== aEndTime) return bEndTime - aEndTime
      return bStartTime - aStartTime
    })
  }, [events, activeTab, fiscalYearFilter, searchQuery])

  const hasUpcomingEvents = useMemo(() => {
    const nowTime = new Date().getTime()
    return sortedFilteredEvents.some((e) => new Date(e.eventEndDate).getTime() >= nowTime)
  }, [sortedFilteredEvents])

  // Extract distinct fiscal years
  const availableFiscalYears = Array.from(
    new Set(allEvents.map((e) => e.fiscalYear).filter(Boolean))
  ).sort().reverse()

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
    <div className="eventsPageContainer">
      {/* Back Navigation */}
      <Link href="/member" className="eventsBackLink">
        <ArrowLeft size={16} /> กลับสู่ระบบสมาชิก
      </Link>

      {/* Top Header & Stat Banner */}
      <header className="eventsHeaderBanner">
        <div className="eventsHeaderRow">
          <div>
            <div className="eventsPillTag">
              <ShieldCheck size={14} />
              <span>โรงพยาบาลเถิน จ.ลำปาง • ระบบกิจกรรมและเช็คอิน ThaID</span>
            </div>
            <h1 className="eventsHeaderTitle">กิจกรรมและโครงการโรงพยาบาลเถิน</h1>
            <p className="eventsHeaderSubtitle">
              เข้าร่วมกิจกรรม สแกนเช็คอินผ่าน ThaID หน้างานเพื่อสะสมคะแนน และติดตามอันดับการมีส่วนร่วมของบุคลากร
            </p>
          </div>

          {/* Action Buttons */}
          <div className="eventsHeaderActions">
            <Link href="/member/events/leaderboard" className="btnTrophy">
              <Trophy size={18} />
              <span>กระดานคะแนน</span>
            </Link>
            {currentUser.isAdmin && (
              <Link href="/member/events/create" className="btnCreateEvent">
                <PlusCircle size={18} />
                <span>+ สร้างกิจกรรมใหม่</span>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="eventsStatGrid">
          <div className="eventsStatCard">
            <div className="eventsStatLabel">คะแนนสะสมของฉัน</div>
            <div className="eventsStatValue">
              {userStats.totalPoints}
              <span className="eventsStatUnit">คะแนน</span>
            </div>
          </div>

          <div className="eventsStatCard">
            <div className="eventsStatLabel">กิจกรรมที่ลงทะเบียนไว้</div>
            <div className="eventsStatValue">
              {registeredCount}
              <span className="eventsStatUnit">งาน</span>
            </div>
          </div>

          <div className="eventsStatCard">
            <div className="eventsStatLabel">กิจกรรมทั้งหมดในระบบ</div>
            <div className="eventsStatValue">
              {allEvents.length}
              <span className="eventsStatUnit">งาน</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="eventsFilterBar">
        {/* Navigation Tabs */}
        <div className="eventsTabsGroup" role="tablist" aria-label="หมวดหมู่กิจกรรม">
          <button
            role="tab"
            aria-selected={activeTab === 'upcoming'}
            onClick={() => handleTabChange('upcoming')}
            className={`eventsTabButton ${activeTab === 'upcoming' ? 'active' : ''}`}
          >
            กิจกรรม เร็วๆ นี้ ({counts.upcoming})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'completed'}
            onClick={() => handleTabChange('completed')}
            className={`eventsTabButton ${activeTab === 'completed' ? 'active' : ''}`}
          >
            กิจกรรมที่เสร็จสิ้น ({counts.completed})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'registered'}
            onClick={() => handleTabChange('registered')}
            className={`eventsTabButton ${activeTab === 'registered' ? 'active' : ''}`}
          >
            ที่ฉันลงทะเบียนไว้ ({counts.registered})
          </button>
        </div>

        {/* Search & Fiscal Year Dropdown */}
        <div className="eventsSearchControls">
          <div className="eventsSearchWrap">
            <Search className="eventsSearchIcon" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อกิจกรรม หรือสถานที่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="eventsSearchInput"
            />
          </div>

          {availableFiscalYears.length > 0 && (
            <select
              value={fiscalYearFilter}
              onChange={(e) => setFiscalYearFilter(e.target.value)}
              className="eventsYearSelect"
            >
              <option value="ALL">ปีงบฯ ทั้งหมด</option>
              {availableFiscalYears.map((yr) => (
                <option key={yr} value={yr}>
                  ปี {yr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Event Cards Grid */}
      {loading ? (
        <div className="eventsLoadingSpinner">
          <div className="spinnerCircle" />
        </div>
      ) : sortedFilteredEvents.length === 0 ? (
        <div className="eventsEmptyState">
          <Calendar size={48} className="eventsEmptyIcon" />
          <h3 className="eventsEmptyTitle">ไม่พบกิจกรรม</h3>
          <p className="eventsEmptyDesc">
            {searchQuery.trim()
              ? 'ไม่พบกิจกรรมที่ตรงกับคำค้นหาในหมวดหมู่นี้'
              : activeTab === 'upcoming'
              ? 'ยังไม่มีกิจกรรมที่จะมาถึงในขณะนี้'
              : activeTab === 'completed'
              ? 'ยังไม่มีกิจกรรมที่เสร็จสิ้น'
              : 'คุณยังไม่ได้ลงทะเบียนเข้าร่วมกิจกรรมใดๆ'}
          </p>
          {currentUser.isAdmin && activeTab === 'upcoming' && (
            <Link href="/member/events/create" className="btnCreateEvent">
              <PlusCircle size={15} />
              <span>+ สร้างกิจกรรมใหม่</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="eventStripList">
          {sortedFilteredEvents.map((event, index) => {
            const now = new Date()
            const startDate = new Date(event.eventStartDate)
            const endDate = new Date(event.eventEndDate)
            const isPast = endDate < now
            const isOngoing = now >= startDate && now <= endDate
            const isFirstCompleted =
              isPast &&
              hasUpcomingEvents &&
              (index === 0 ||
                new Date(sortedFilteredEvents[index - 1].eventEndDate) >= now)
            const isOrganizer =
              event.headOrganizerId === currentUser.id ||
              event.coOrganizers?.some((c) => c.member?.id === currentUser.id) ||
              currentUser.isAdmin

            return (
              <React.Fragment key={event.id}>
                {isFirstCompleted && (
                  <div
                    className="eventStripSectionDivider"
                    role="separator"
                    aria-label="กิจกรรมที่เสร็จสิ้นแล้ว"
                  >
                    <Clock size={15} />
                    <span>กิจกรรมที่เสร็จสิ้นแล้ว</span>
                  </div>
                )}
                <div className="eventStripRow">
                  {/* 1. วันเวลางาน */}
                  <div className="eventStripDateCol">
                    <div className="eventStripDateMain">
                      <Calendar size={15} className="eventStripDateIcon" />
                      <span className="eventStripDateText">
                        {formatThaiDateOnly(event.eventStartDate)}
                      </span>
                    </div>
                    <div className="eventStripTimeSub">
                      <Clock size={12} />
                      <span>
                        {formatThaiTimeRange(event.eventStartDate, event.eventEndDate)}
                      </span>
                    </div>
                    <span
                      className={`eventStripStatusTag ${
                        isOngoing ? 'ongoing' : isPast ? 'completed' : 'upcoming'
                      }`}
                    >
                      {isOngoing ? 'กำลังจัดงาน' : isPast ? 'เสร็จสิ้น' : 'เร็วๆ นี้'}
                    </span>
                  </div>

                  {/* 2. ชื่อกิจกรรม */}
                  <div className="eventStripTitleCol">
                    <Link href={`/member/events/${event.id}`} className="eventStripTitleLink">
                      {event.title}
                    </Link>
                    <div className="eventStripMetaRow">
                      {event.location && (
                        <span className="eventStripMetaItem">
                          <MapPin size={12} />
                          <span>{event.location}</span>
                        </span>
                      )}
                      <span className="eventStripMetaItem">
                        <Users size={12} />
                        <span>{event.headOrganizer?.name || 'บุคลากรโรงพยาบาล'}</span>
                      </span>
                      <span className="eventStripFiscalBadge">
                        ปีงบ {event.fiscalYear}
                      </span>
                    </div>
                  </div>

                  {/* 3. จำนวนลงทะเบียน / จำนวนเข้าร่วมงาน */}
                  <div className="eventStripStatsCol">
                    <div className="eventStripStatBox">
                      <span className="eventStripStatLabel">ลงทะเบียน</span>
                      <span className="eventStripStatValue reg">
                        {event.registrationCount} <small>คน</small>
                      </span>
                    </div>
                    <div className="eventStripStatDivider">/</div>
                    <div className="eventStripStatBox">
                      <span className="eventStripStatLabel">เข้าร่วมงาน</span>
                      <span className="eventStripStatValue att">
                        {event.attendanceCount} <small>คน</small>
                      </span>
                    </div>
                  </div>

                  {/* 4. ปุ่มลงทะเบียนล่วงหน้า & ดูรายละเอียด */}
                  <div className="eventStripActionCol">
                    {isOrganizer && (
                      <Link
                        href={`/member/events/${event.id}`}
                        className="btnStripQr"
                        title="เปิด QR Code หน้างาน"
                      >
                        <QrCode size={14} />
                        <span>QR Code</span>
                      </Link>
                    )}

                    {event.hasAttended ? (
                      <div className="stripAttendedPill" title="คุณได้เข้าร่วมงานนี้แล้ว">
                        <CheckCircle2 size={13} />
                        <span>เข้าร่วมแล้ว</span>
                      </div>
                    ) : !isPast ? (
                      <button
                        type="button"
                        onClick={(e) => handleToggleRegistration(e, event)}
                        disabled={registeringId === event.id}
                        className={`btnStripRegister ${
                          event.hasRegistered ? 'registered' : 'unregistered'
                        }`}
                        title={
                          event.hasRegistered
                            ? 'คุณได้ลงทะเบียนไว้แล้ว (คลิกเพื่อยกเลิกการลงทะเบียน)'
                            : 'คลิกเพื่อลงทะเบียนล่วงหน้า'
                        }
                      >
                        {registeringId === event.id ? (
                          <span className="stripBtnSpinner" />
                        ) : event.hasRegistered ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <UserPlus size={14} />
                        )}
                        <span>
                          {registeringId === event.id
                            ? 'กำลังบันทึก...'
                            : event.hasRegistered
                            ? 'ลงทะเบียนแล้ว'
                            : 'ลงทะเบียนล่วงหน้า'}
                        </span>
                      </button>
                    ) : null}

                    <Link href={`/member/events/${event.id}`} className="btnStripDetail">
                      <span>ดูรายละเอียด</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
