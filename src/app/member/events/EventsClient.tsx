'use client'

import React, { useState } from 'react'
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
  const [events, setEvents] = useState<EventItem[]>(initialEvents)
  const [activeTab, setActiveTab] = useState<'all' | 'registered' | 'my_events'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)

  // Format date in Thai Buddhist Era (พ.ศ.)
  const formatThaiDate = (dateString: string) => {
    try {
      const d = new Date(dateString)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      const day = d.getDate()
      const month = thaiMonths[d.getMonth()]
      const year = d.getFullYear() + 543
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      return `${day} ${month} ${year} เวลา ${time} น.`
    } catch {
      return dateString
    }
  }

  const formatThaiDateOnly = (dateString: string) => {
    try {
      const d = new Date(dateString)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`
    } catch {
      return dateString
    }
  }

  const formatThaiTimeRange = (startStr: string, endStr: string) => {
    try {
      const s = new Date(startStr)
      const e = new Date(endStr)
      const sTime = s.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      const eTime = e.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      return `${sTime} - ${eTime} น.`
    } catch {
      return ''
    }
  }

  // Filter events based on tab, search, and fiscal year
  const filteredEvents = events.filter((ev) => {
    if (activeTab === 'my_events') {
      const isMine =
        ev.headOrganizerId === currentUser.id ||
        ev.coOrganizers?.some((c) => c.member?.id === currentUser.id)
      if (!isMine) return false
    }

    if (fiscalYearFilter !== 'ALL' && ev.fiscalYear !== fiscalYearFilter) {
      return false
    }

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

  // Extract distinct fiscal years
  const availableFiscalYears = Array.from(
    new Set(events.map((e) => e.fiscalYear).filter(Boolean))
  ).sort().reverse()

  const handleTabChange = async (tab: 'all' | 'registered' | 'my_events') => {
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

  return (
    <div className="eventsPageContainer">
      {/* Top Header & Stat Banner */}
      <div className="eventsHeaderBanner">
        <div className="eventsHeaderRow">
          <div>
            <div className="eventsPillTag">
              <Sparkles size={13} />
              <span>Thoen Hospital Event Portal</span>
            </div>
            <h1 className="eventsHeaderTitle">กิจกรรมโรงพยาบาลเถิน</h1>
            <p className="eventsHeaderSubtitle">
              เข้าร่วมกิจกรรม สแกนเช็คอินผ่าน ThaID หน้างานเพื่อสะสมคะแนน และติดตามอันดับการมีส่วนร่วมของแผนก
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
              {userStats.registeredCount}
              <span className="eventsStatUnit">งาน</span>
            </div>
          </div>

          <div className="eventsStatCard">
            <div className="eventsStatLabel">กิจกรรมทั้งหมดในระบบ</div>
            <div className="eventsStatValue">
              {events.length}
              <span className="eventsStatUnit">งาน</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="eventsFilterBar">
        {/* Navigation Tabs */}
        <div className="eventsTabsGroup">
          <button
            onClick={() => handleTabChange('all')}
            className={`eventsTabButton ${activeTab === 'all' ? 'active' : ''}`}
          >
            กิจกรรมทั้งหมด ({events.length})
          </button>
          <button
            onClick={() => handleTabChange('registered')}
            className={`eventsTabButton ${activeTab === 'registered' ? 'active' : ''}`}
          >
            ที่ฉันลงทะเบียนไว้
          </button>
          <button
            onClick={() => handleTabChange('my_events')}
            className={`eventsTabButton ${activeTab === 'my_events' ? 'active' : ''}`}
          >
            ที่ฉันเป็นผู้จัด
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
      ) : filteredEvents.length === 0 ? (
        <div className="eventsEmptyState">
          <Calendar size={48} className="eventsEmptyIcon" />
          <h3 className="eventsEmptyTitle">ไม่พบกิจกรรมที่ค้นหา</h3>
          <p className="eventsEmptyDesc">
            {currentUser.isAdmin
              ? 'ยังไม่มีกิจกรรมที่ตรงกับเงื่อนไขในขณะนี้ คุณสามารถเริ่มต้นสร้างกิจกรรมใหม่ได้ทันที'
              : 'ยังไม่มีกิจกรรมที่ตรงกับเงื่อนไขในขณะนี้'}
          </p>
          {currentUser.isAdmin && (
            <Link href="/member/events/create" className="btnCreateEvent">
              <PlusCircle size={15} />
              <span>+ สร้างกิจกรรมใหม่</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="eventStripList">
          {filteredEvents.map((event) => {
            const now = new Date()
            const startDate = new Date(event.eventStartDate)
            const endDate = new Date(event.eventEndDate)
            const isPast = endDate < now
            const isOngoing = now >= startDate && now <= endDate
            const isOrganizer =
              event.headOrganizerId === currentUser.id ||
              event.coOrganizers?.some((c) => c.member?.id === currentUser.id) ||
              currentUser.isAdmin

            return (
              <div key={event.id} className="eventStripRow">
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

                {/* 4. ปุ่มดูรายละเอียด */}
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
                  <Link href={`/member/events/${event.id}`} className="btnStripDetail">
                    <span>ดูรายละเอียด</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
