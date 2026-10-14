'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  Search,
  RefreshCw,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  CreditCard,
  ExternalLink,
  ChevronRight,
  Filter,
  Eye,
  X,
  Copy,
  Check,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react'

interface UserInfo {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
  department?: string | null
}

interface ScreeningItem {
  id: number
  cid: string
  title: string | null
  firstName: string | null
  lastName: string | null
  fullName: string
  gender: string | null
  birthDate: string | null
  address: string | null
  status: 'WAITING' | 'VISIT_OPENED' | 'CANCELLED' | string
  vn: string | null
  recordedBy: number | null
  createdAt: string
  updatedAt: string
}

interface Props {
  user: UserInfo
}

export default function ScreeningDashboardClient({ user }: Props) {
  const [items, setItems] = useState<ScreeningItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [selectedDate, setSelectedDate] = useState<string>('today')
  const [isHistoricalOpen, setIsHistoricalOpen] = useState<boolean>(false)
  const [customDateInput, setCustomDateInput] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedItemForPayload, setSelectedItemForPayload] = useState<any | null>(null)
  const [payloadModalOpen, setPayloadModalOpen] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch queues from API
  const fetchQueues = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }
      setErrorMessage(null)

      try {
        const queryParams = new URLSearchParams()
        queryParams.set('date', selectedDate)
        if (statusFilter !== 'ALL') {
          queryParams.set('status', statusFilter)
        }

        const res = await fetch(`/api/service/screening?${queryParams.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'ไม่สามารถดึงข้อมูลคิวได้')
        }

        setItems(json.data.items || [])
      } catch (err: any) {
        setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [selectedDate, statusFilter]
  )

  // Initial load and 3-second auto-refresh polling
  useEffect(() => {
    fetchQueues()

    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchQueues(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchQueues, autoRefresh])

  // Change status of a queue item
  const handleUpdateStatus = async (
    id: number,
    newStatus: 'WAITING' | 'VISIT_OPENED' | 'CANCELLED',
    vnPrompt = false
  ) => {
    let vn: string | undefined = undefined
    if (vnPrompt && newStatus === 'VISIT_OPENED') {
      const enteredVn = window.prompt('ระบุเลข Visit (VN) หากมี (เว้นว่างได้):', '')
      if (enteredVn === null) return // cancelled by user
      vn = enteredVn.trim() || undefined
    }

    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/service/screening/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          vn: vn ?? null,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ปรับปรุงสถานะไม่สำเร็จ')
      }

      // Update local state immediately
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus, vn: vn ?? item.vn } : item
        )
      )
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Open Raw Payload modal by fetching detail
  const handleOpenRawPayload = async (id: number) => {
    try {
      const res = await fetch(`/api/service/screening/${id}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setSelectedItemForPayload(json.data)
        setPayloadModalOpen(true)
      } else {
        alert('ไม่สามารถโหลดข้อมูลดิบได้')
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเรียกดูข้อมูล')
    }
  }

  // Copy raw payload JSON to clipboard
  const handleCopyPayload = () => {
    if (!selectedItemForPayload?.rawPayload) return
    navigator.clipboard.writeText(
      typeof selectedItemForPayload.rawPayload === 'string'
        ? selectedItemForPayload.rawPayload
        : JSON.stringify(selectedItemForPayload.rawPayload, null, 2)
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return items

    return items.filter((item) => {
      const nameMatch = item.fullName.toLowerCase().includes(q)
      const cidMatch = item.cid.includes(q)
      const vnMatch = item.vn ? item.vn.toLowerCase().includes(q) : false
      return nameMatch || cidMatch || vnMatch
    })
  }, [items, searchTerm])

  // Count summaries
  const stats = useMemo(() => {
    const total = items.length
    const waiting = items.filter((i) => i.status === 'WAITING').length
    const opened = items.filter((i) => i.status === 'VISIT_OPENED').length
    const cancelled = items.filter((i) => i.status === 'CANCELLED').length
    return { total, waiting, opened, cancelled }
  }, [items])

  // Format Bangkok time (HH:mm:ss น.)
  const formatTime = (dateIso: string) => {
    try {
      const d = new Date(dateIso)
      return (
        new Intl.DateTimeFormat('th-TH', {
          timeZone: 'Asia/Bangkok',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(d) + ' น.'
      )
    } catch {
      return dateIso
    }
  }

  // Calculate age from birthdate (e.g. 2528-04-12)
  const formatAge = (birthDateStr: string | null) => {
    if (!birthDateStr) return '-'
    try {
      const parts = birthDateStr.split('-')
      if (parts.length >= 1) {
        const year = parseInt(parts[0], 10)
        if (!isNaN(year)) {
          // Thai Buddhist year or CE year
          const currentThaiYear = new Date().getFullYear() + 543
          if (year > 2400) {
            const age = currentThaiYear - year
            return `${age} ปี`
          } else {
            const age = new Date().getFullYear() - year
            return `${age} ปี`
          }
        }
      }
    } catch {
      // return default
    }
    return birthDateStr
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header */}
      <div className="bg-emerald-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-700/60 rounded-xl">
              <Users className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  ระบบคัดกรองตรวจนอกพื้นที่
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-600/80 rounded-full text-emerald-100 border border-emerald-500/50">
                  Screening Queue
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                ติดตามรายชื่อผู้รับบริการจากเครื่องอ่านบัตรประชาชน Smart Card แบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/service/screening/scan"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 transition-all shadow-sm"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>ไปที่จุดอ่านบัตรประชาชน</span>
            </Link>
            <Link
              href="/service"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl bg-emerald-900/50 hover:bg-emerald-900 text-emerald-100 transition-colors"
            >
              กลับหน้าบริการ
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Statistics Banner Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">คิวทั้งหมด</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
            <span className="text-[11px] text-slate-400">
              {selectedDate === 'today' ? 'วันนี้' : selectedDate}
            </span>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700">รอเปิด Visit</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.waiting}</p>
            <span className="text-[11px] text-amber-600/80">พร้อมส่งห้องบัตร</span>
          </div>

          <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700">เปิด Visit แล้ว</span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.opened}</p>
            <span className="text-[11px] text-emerald-600/80">เข้าสู่ระบบสำเร็จ</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">ยกเลิก</span>
              <XCircle className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-600 mt-1">{stats.cancelled}</p>
            <span className="text-[11px] text-slate-400">ไม่มารับบริการ/ยกเลิก</span>
          </div>
        </div>

        {/* Toolbar & Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'ALL', label: 'ทั้งหมด', count: stats.total },
                { id: 'WAITING', label: 'รอเปิด Visit', count: stats.waiting },
                { id: 'VISIT_OPENED', label: 'เปิด Visit แล้ว', count: stats.opened },
                { id: 'CANCELLED', label: 'ยกเลิก', count: stats.cancelled },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      statusFilter === tab.id
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Auto Refresh & Action Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  autoRefresh
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title={autoRefresh ? 'กำลังรีเฟรชอัตโนมัติทุก 3 วินาที' : 'หยุดรีเฟรชอัตโนมัติ'}
              >
                {autoRefresh ? (
                  <>
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>อัปเดตสด (3s)</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-slate-400" />
                    <span>หยุดอัปเดตสด</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fetchQueues()}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="กดรีเฟรชข้อมูลทันที"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Historical View Toggle Button */}
              <button
                type="button"
                onClick={() => setIsHistoricalOpen(!isHistoricalOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  isHistoricalOpen || selectedDate !== 'today'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{selectedDate === 'today' ? 'ดูข้อมูลย้อนหลัง' : `วันที่: ${selectedDate}`}</span>
              </button>
            </div>
          </div>

          {/* Historical Date Picker Accordion */}
          {isHistoricalOpen && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">เลือกวันที่ต้องการดู:</span>
                <input
                  type="date"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customDateInput) {
                      setSelectedDate(customDateInput)
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  ค้นหาตามวันที่
                </button>
              </div>

              {selectedDate !== 'today' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('today')
                    setCustomDateInput('')
                    setIsHistoricalOpen(false)
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline"
                >
                  กลับไปดูของวันนี้ (Today)
                </button>
              )}
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด้วยชื่อ-สกุล, เลขประจำตัวประชาชน 13 หลัก, หรือเลข VN..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-800 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Queue Items Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 text-center w-12">ลำดับ</th>
                  <th className="px-4 py-3.5 w-24">เวลาอ่านบัตร</th>
                  <th className="px-4 py-3.5 w-44">เลขบัตรประชาชน</th>
                  <th className="px-4 py-3.5">ชื่อ - สกุล</th>
                  <th className="px-4 py-3.5 w-20 text-center">อายุ</th>
                  <th className="px-4 py-3.5 hidden md:table-cell max-w-xs">ที่อยู่</th>
                  <th className="px-4 py-3.5 w-32 text-center">สถานะ</th>
                  <th className="px-4 py-3.5 w-32 text-center">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      <span>กำลังโหลดรายการคิว...</span>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">ยังไม่มีรายชื่อในคิว</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {searchTerm
                          ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา'
                          : 'เสียบบัตรประชาชนที่หน้าจุดอ่านบัตรเพื่อเริ่มนำเข้ารายชื่อ'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Number */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Scan Time */}
                      <td className="px-4 py-3.5 text-xs text-slate-600 font-mono whitespace-nowrap">
                        {formatTime(item.createdAt)}
                      </td>

                      {/* Citizen ID */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-800 font-semibold whitespace-nowrap">
                        {item.cid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{item.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.gender ? `เพศ: ${item.gender}` : ''}
                          {item.birthDate ? ` • เกิด: ${item.birthDate}` : ''}
                        </div>
                      </td>

                      {/* Age */}
                      <td className="px-4 py-3.5 text-center text-xs text-slate-600 whitespace-nowrap">
                        {formatAge(item.birthDate)}
                      </td>

                      {/* Address */}
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs text-slate-500 truncate max-w-xs" title={item.address || ''}>
                        {item.address || '-'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {item.status === 'WAITING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>รอเปิด Visit</span>
                          </span>
                        )}
                        {item.status === 'VISIT_OPENED' && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              <span>เปิด Visit แล้ว</span>
                            </span>
                            {item.vn && (
                              <span className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                                VN: {item.vn}
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>ยกเลิก</span>
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.status === 'WAITING' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'VISIT_OPENED', true)}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              title="เปลี่ยนสถานะเป็นเปิด Visit แล้ว"
                            >
                              {actionLoadingId === item.id ? '...' : 'เปิด Visit'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'WAITING')}
                              disabled={actionLoadingId === item.id}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg"
                              title="ย้อนกลับเป็นรอเปิด Visit"
                            >
                              รีเซ็ต
                            </button>
                          )}

                          {item.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'CANCELLED')}
                              disabled={actionLoadingId === item.id}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                              title="ยกเลิกคิวนี้"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenRawPayload(item.id)}
                            className="p-1 text-slate-400 hover:text-emerald-700 rounded-lg transition-colors"
                            title="ดูข้อมูลดิบจากบัตร (Raw Payload)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Raw Payload Detail Modal */}
      {payloadModalOpen && selectedItemForPayload && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">ข้อมูลดิบจากบัตรประชาชน (Raw Payload)</h3>
                  <p className="text-xs text-slate-400">
                    {selectedItemForPayload.fullName} (CID: {selectedItemForPayload.cid})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayloadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold">ชื่อ-สกุล:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedItemForPayload.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">เลขบัตร:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">{selectedItemForPayload.cid}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">วันเกิด:</span>{' '}
                  <span>{selectedItemForPayload.birthDate || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">เพศ:</span>{' '}
                  <span>{selectedItemForPayload.gender || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-semibold">ที่อยู่:</span>{' '}
                  <span>{selectedItemForPayload.address || '-'}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    โครงสร้าง JSON ที่ได้รับจากเครื่องอ่าน (rawPayload):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>คัดลอก JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 bg-slate-900 text-emerald-400 text-xs font-mono rounded-xl overflow-x-auto max-h-72 leading-relaxed">
                  {selectedItemForPayload.rawPayload
                    ? typeof selectedItemForPayload.rawPayload === 'string'
                      ? JSON.stringify(JSON.parse(selectedItemForPayload.rawPayload), null, 2)
                      : JSON.stringify(selectedItemForPayload.rawPayload, null, 2)
                    : '// ไม่มีข้อมูลดิบในฟิลด์ rawPayload'}
                </pre>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setPayloadModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
