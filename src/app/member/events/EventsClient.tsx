'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  PlusCircle,
  Trophy,
  Search,
  ChevronRight,
  QrCode,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react'

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
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Header & Stat Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  <Sparkles size={13} />
                  Thoen Hospital Event Portal
                </span>
                <span className="text-slate-300 text-xs">ระบบกิจกรรมบุคลากร</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                กิจกรรมโรงพยาบาลเถิน
              </h1>
              <p className="mt-1 text-sm text-slate-200 max-w-xl">
                เข้าร่วมกิจกรรม สแกนเช็คอินผ่าน ThaID หน้างานเพื่อสะสมคะแนน และติดตามอันดับการมีส่วนร่วมของแผนก
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/member/events/leaderboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Trophy size={18} className="text-amber-900" />
                <span>กระดานคะแนน (Leaderboard)</span>
              </Link>
              <Link
                href="/member/events/create"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <PlusCircle size={18} />
                <span>+ สร้างกิจกรรมใหม่</span>
              </Link>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-emerald-700/50">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
              <div className="text-xs text-emerald-200 font-medium">คะแนนสะสมของฉัน</div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1.5">
                {userStats.totalPoints}
                <span className="text-xs text-emerald-300 font-normal">คะแนน</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
              <div className="text-xs text-emerald-200 font-medium">กิจกรรมที่ลงทะเบียนไว้</div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1.5">
                {userStats.registeredCount}
                <span className="text-xs text-emerald-300 font-normal">งาน</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 col-span-2 sm:col-span-1">
              <div className="text-xs text-emerald-200 font-medium">กิจกรรมทั้งหมดในระบบ</div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1.5">
                {events.length}
                <span className="text-xs text-emerald-300 font-normal">งาน</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Navigation Tabs and Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => handleTabChange('all')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                กิจกรรมทั้งหมด ({events.length})
              </button>
              <button
                onClick={() => handleTabChange('registered')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'registered'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ที่ฉันลงทะเบียนไว้
              </button>
              <button
                onClick={() => handleTabChange('my_events')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'my_events'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ที่ฉันเป็นผู้จัด
              </button>
            </div>

            {/* Search & Fiscal Year Filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อกิจกรรม หรือสถานที่..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {availableFiscalYears.length > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Filter size={14} className="text-slate-400" />
                  <select
                    value={fiscalYearFilter}
                    onChange={(e) => setFiscalYearFilter(e.target.value)}
                    className="py-2 px-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="ALL">ปีงบฯ ทั้งหมด</option>
                    {availableFiscalYears.map((yr) => (
                      <option key={yr} value={yr}>
                        ปี {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Cards Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Calendar size={48} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-700">ไม่พบกิจกรรมที่ค้นหา</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              ยังไม่มีกิจกรรมที่ตรงกับเงื่อนไขในขณะนี้ คุณสามารถเริ่มต้นสร้างกิจกรรมใหม่ได้ทันที
            </p>
            <Link
              href="/member/events/create"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <PlusCircle size={15} />
              + สร้างกิจกรรมใหม่
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((event) => {
              const isPast = new Date(event.eventEndDate) < new Date()
              const isOrganizer =
                event.headOrganizerId === currentUser.id ||
                event.coOrganizers?.some((c) => c.member?.id === currentUser.id) ||
                currentUser.isAdmin

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden hover:shadow-md transition-all flex flex-col group"
                >
                  {/* Card Header / Banner */}
                  <div className="p-5 pb-3 border-b border-slate-100 relative">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Calendar size={12} />
                        {formatThaiDateOnly(event.eventStartDate)}
                      </span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          event.status === 'COMPLETED' || isPast
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        {event.status === 'COMPLETED' || isPast ? 'เสร็จสิ้น' : 'เร็วๆ นี้'}
                      </span>
                    </div>

                    <Link href={`/member/events/${event.id}`}>
                      <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {event.title}
                      </h3>
                    </Link>

                    {event.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {/* Card Details Body */}
                  <div className="p-5 pt-3 space-y-2.5 flex-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-slate-400 shrink-0" />
                      <span>{formatThaiDate(event.eventStartDate)}</span>
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        ผู้รับผิดชอบ: {event.headOrganizer?.name || 'บุคลากรโรงพยาบาล'}
                      </span>
                    </div>

                    {/* Registration & Attendees Stats Badge */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <span className="text-[10px] text-slate-500 block">ลงทะเบียน</span>
                        <span className="text-sm font-bold text-slate-800">
                          {event.registrationCount}{' '}
                          <span className="text-[10px] font-normal text-slate-500">คน</span>
                        </span>
                      </div>
                      <div className="bg-emerald-50/60 rounded-lg p-2 text-center border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 block font-medium">
                          เข้างานแล้ว
                        </span>
                        <span className="text-sm font-bold text-emerald-800">
                          {event.attendanceCount}{' '}
                          <span className="text-[10px] font-normal text-emerald-600">คน</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isOrganizer ? (
                      <Link
                        href={`/member/events/${event.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                      >
                        <QrCode size={14} />
                        <span>เปิด QR Code หน้างาน</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/member/events/${event.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-100/60 transition-colors"
                      >
                        <span>รายละเอียด</span>
                        <ChevronRight size={14} />
                      </Link>
                    )}

                    <Link
                      href={`/member/events/${event.id}`}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <span>ดูเพิ่มเติม</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
