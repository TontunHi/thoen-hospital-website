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
  X,
  Copy,
  Check,
  Pause,
  AlertTriangle,
} from 'lucide-react'
import './page.css'

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
  status: 'WAITING' | 'VISIT_OPENED' | 'NO_RECORD' | 'CANCELLED' | string
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

  // Compute if all active items have opened visit today
  const isAllVisitOpened = useMemo(() => {
    if (selectedDate !== 'today' || items.length === 0) return false
    const active = items.filter((i) => i.status !== 'CANCELLED')
    return active.length > 0 && active.every((i) => i.status === 'VISIT_OPENED')
  }, [items, selectedDate])

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
    [selectedDate]
  )

  // Initial load and 5-second auto-refresh polling (pauses when all visits are opened)
  useEffect(() => {
    fetchQueues()

    // Stop polling if user disabled it, or viewing historical dates, or all items have opened visits
    if (!autoRefresh || selectedDate !== 'today' || isAllVisitOpened) return

    const interval = setInterval(() => {
      fetchQueues(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchQueues, autoRefresh, selectedDate, isAllVisitOpened])

  // Change status of a queue item
  const handleUpdateStatus = async (
    id: number,
    newStatus: 'WAITING' | 'VISIT_OPENED' | 'NO_RECORD' | 'CANCELLED' | string,
    vnPrompt = false
  ) => {
    let vn: string | undefined = undefined
    if (vnPrompt && newStatus === 'VISIT_OPENED') {
      const enteredVn = window.prompt('ระบุเลข Visit (VN) หากมี (เว้นว่างได้):', '')
      if (enteredVn === null) return
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

  // Filter items by status filter and search query
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return items.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
      if (!matchesStatus) return false

      if (!q) return true
      const nameMatch = item.fullName.toLowerCase().includes(q)
      const cidMatch = item.cid.includes(q)
      const vnMatch = item.vn ? item.vn.toLowerCase().includes(q) : false
      return nameMatch || cidMatch || vnMatch
    })
  }, [items, searchTerm, statusFilter])

  // Count summaries
  const stats = useMemo(() => {
    const total = items.length
    const noRecord = items.filter((i) => i.status === 'NO_RECORD').length
    const waiting = items.filter((i) => i.status === 'WAITING').length
    const opened = items.filter((i) => i.status === 'VISIT_OPENED').length
    const cancelled = items.filter((i) => i.status === 'CANCELLED').length
    return { total, noRecord, waiting, opened, cancelled }
  }, [items])

  // Format Bangkok time (HH:mm:ss น.) or (DD MMM HH:mm:ss น.) if date is 'all'
  const formatTime = (dateIso: string) => {
    if (!dateIso) return '-'
    try {
      const normalized = dateIso.endsWith('Z') ? dateIso.replace(/Z$/, '+07:00') : dateIso
      const d = new Date(normalized)
      if (selectedDate === 'all') {
        return (
          new Intl.DateTimeFormat('th-TH', {
            timeZone: 'Asia/Bangkok',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(d) + ' น.'
        )
      }
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
    <div className="screeningPage">
      <div className="screeningContainer">
        {/* Top Header Card */}
        <div className="screeningHeaderCard">
          <div className="screeningTitleWrapper">
            <div className="screeningIconBadge">
              <Users size={28} />
            </div>
            <div className="screeningTitleSection">
              <h1>
                <span>ระบบคัดกรองตรวจนอกพื้นที่</span>
                <span className="screeningTag">Screening Queue</span>
              </h1>
              <p className="screeningSubtitle">
                ติดตามรายชื่อผู้รับบริการจากเครื่องอ่านบัตรประชาชน Smart Card แบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="screeningNavControls">
            <Link href="/service/screening/scan" className="scanKioskLink">
              <CreditCard size={18} />
              <span>จุดอ่านบัตรประชาชน</span>
            </Link>
            <Link href="/service" className="backServiceLink">
              กลับหน้าบริการ
            </Link>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="screeningStatsGrid">
          <div className="screeningStatCard">
            <div className="statCardHeader">
              <span>คิวทั้งหมด</span>
              <Users size={18} />
            </div>
            <div className="statCardNumber">{stats.total}</div>
            <div className="statCardDesc">
              {selectedDate === 'today' ? 'วันนี้' : selectedDate === 'all' ? 'ทั้งหมด (All)' : selectedDate}
            </div>
          </div>

          <div className="screeningStatCard noRecord">
            <div className="statCardHeader">
              <span>ไม่มีเวชระเบียน</span>
              <AlertTriangle size={18} />
            </div>
            <div className="statCardNumber">{stats.noRecord}</div>
            <div className="statCardDesc">ยังไม่มีประวัติใน รพ.</div>
          </div>

          <div className="screeningStatCard waiting">
            <div className="statCardHeader">
              <span>รอเปิด Visit</span>
              <Clock size={18} />
            </div>
            <div className="statCardNumber">{stats.waiting}</div>
            <div className="statCardDesc">มีประวัติ รพ. แล้ว</div>
          </div>

          <div className="screeningStatCard opened">
            <div className="statCardHeader">
              <span>เปิด Visit แล้ว</span>
              <CheckCircle size={18} />
            </div>
            <div className="statCardNumber">{stats.opened}</div>
            <div className="statCardDesc">เข้าสู่ระบบสำเร็จ</div>
          </div>

          <div className="screeningStatCard cancelled">
            <div className="statCardHeader">
              <span>ยกเลิก</span>
              <XCircle size={18} />
            </div>
            <div className="statCardNumber">{stats.cancelled}</div>
            <div className="statCardDesc">ไม่มารับบริการ / ยกเลิก</div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="screeningToolbar">
          <div className="toolbarTopRow">
            {/* Status Tabs */}
            <div className="statusFilterTabs">
              {[
                { id: 'ALL', label: 'ทั้งหมด', count: stats.total },
                { id: 'NO_RECORD', label: 'ไม่มีเวชระเบียน', count: stats.noRecord },
                { id: 'WAITING', label: 'รอเปิด Visit', count: stats.waiting },
                { id: 'VISIT_OPENED', label: 'เปิด Visit แล้ว', count: stats.opened },
                { id: 'CANCELLED', label: 'ยกเลิก', count: stats.cancelled },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`filterTabBtn ${statusFilter === tab.id ? 'active' : ''}`}
                >
                  <span>{tab.label}</span>
                  <span className="filterTabBadge">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="toolbarControls">
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`autoRefreshToggleBtn ${autoRefresh && !isAllVisitOpened && selectedDate === 'today' ? 'active' : ''}`}
                title={
                  isAllVisitOpened
                    ? 'เปิด Visit ครบทุกรายแล้ว (หยุดรีเฟรชอัตโนมัติ)'
                    : selectedDate !== 'today'
                    ? 'ดูข้อมูลย้อนหลัง (ปิดอัปเดตสด)'
                    : autoRefresh
                    ? 'กำลังอัปเดตสดทุก 5 วินาที'
                    : 'หยุดอัปเดตสด'
                }
              >
                {isAllVisitOpened ? (
                  <>
                    <CheckCircle size={14} style={{ color: '#10b981' }} />
                    <span>เสร็จสิ้น (ครบทุกราย)</span>
                  </>
                ) : autoRefresh && selectedDate === 'today' ? (
                  <>
                    <RefreshCw size={14} className={isRefreshing ? 'refreshIconSpin' : ''} />
                    <span>อัปเดตสด (5s)</span>
                  </>
                ) : (
                  <>
                    <Pause size={14} />
                    <span>หยุดอัปเดตสด</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fetchQueues()}
                disabled={loading}
                className="autoRefreshToggleBtn"
                title="กดรีเฟรชข้อมูลทันที"
              >
                <RefreshCw size={14} className={loading ? 'refreshIconSpin' : ''} />
                <span>รีเฟรช</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHistoricalOpen(!isHistoricalOpen)}
                className={`historyToggleBtn ${isHistoricalOpen || selectedDate !== 'today' ? 'active' : ''}`}
              >
                <Calendar size={14} />
                <span>{selectedDate === 'today' ? 'ดูข้อมูลย้อนหลัง' : selectedDate === 'all' ? 'แสดงทั้งหมด (All)' : `วันที่: ${selectedDate}`}</span>
              </button>
            </div>
          </div>

          {/* Historical Date Picker Accordion */}
          {isHistoricalOpen && (
            <div className="historyPickerBar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                  เลือกวันที่ต้องการดู:
                </span>
                <input
                  type="date"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  className="historyDateInput"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customDateInput) {
                      setSelectedDate(customDateInput)
                    }
                  }}
                  className="historySubmitBtn"
                >
                  ค้นหาตามวันที่
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('all')
                    setCustomDateInput('')
                  }}
                  className={`historyAllBtn ${selectedDate === 'all' ? 'active' : ''}`}
                >
                  ดูทั้งหมด (All)
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
                  className="backTodayBtn"
                >
                  กลับไปดูของวันนี้ (Today)
                </button>
              )}
            </div>
          )}

          {/* Search Box */}
          <div className="searchBoxFull">
            <Search size={16} className="searchIcon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด้วยชื่อ-สกุล, เลขประจำตัวประชาชน 13 หลัก, หรือเลข VN..."
              className="searchInput"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="clearSearchBtn"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {errorMessage}
          </div>
        )}

        {/* All Completed Banner */}
        {isAllVisitOpened && (
          <div className="allCompletedBanner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle size={20} style={{ color: '#059669', flexShrink: 0 }} />
              <span>เปิด Visit ครบทุกรายแล้วสำหรับวันนี้ (ระบบหยุดรีเฟรชอัตโนมัติแล้ว)</span>
            </div>
            <button
              type="button"
              onClick={() => fetchQueues(true)}
              disabled={isRefreshing}
              className="btnActionOpenVisit"
              style={{ background: '#047857', padding: '0.4rem 0.85rem' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'refreshIconSpin' : ''} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
              ตรวจสอบข้อมูลใหม่
            </button>
          </div>
        )}

        {/* Queue Items Table */}
        <div className="screeningTableCard">
          <div className="tableResponsive">
            <table className="screeningTable">
              <thead>
                <tr>
                  <th className="tableColCenter" style={{ width: '50px' }}>ลำดับ</th>
                  <th style={{ width: '110px' }}>เวลาอ่านบัตร</th>
                  <th style={{ width: '170px' }}>เลขบัตรประชาชน</th>
                  <th>ชื่อ - สกุล</th>
                  <th className="tableColCenter" style={{ width: '80px' }}>อายุ</th>
                  <th style={{ maxWidth: '280px' }}>ที่อยู่</th>
                  <th className="tableColCenter" style={{ width: '130px' }}>สถานะ</th>
                  <th className="tableColCenter" style={{ width: '140px' }}>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="emptyTableState">
                      <RefreshCw size={28} className="refreshIconSpin" style={{ margin: '0 auto 0.5rem auto', color: '#059669', display: 'block' }} />
                      <p className="emptyStateTitle">กำลังโหลดรายการคิว...</p>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="emptyTableState">
                      <Users size={36} style={{ margin: '0 auto 0.5rem auto', color: '#cbd5e1', display: 'block' }} />
                      <p className="emptyStateTitle">ยังไม่มีรายชื่อในคิว</p>
                      <p className="emptyStateDesc">
                        {searchTerm
                          ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา'
                          : 'เสียบบัตรประชาชนที่หน้าจุดอ่านบัตรเพื่อเริ่มนำเข้ารายชื่อ'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item.id}>
                      {/* Number */}
                      <td className="tableColCenter timeMono">{idx + 1}</td>

                      {/* Time */}
                      <td className="timeMono">{formatTime(item.createdAt)}</td>

                      {/* CID */}
                      <td className="cidMono">
                        {item.cid}
                      </td>

                      {/* Full Name */}
                      <td>
                        <div className="patientNameCell">
                          <span className="patientFullName">{item.fullName}</span>
                          <span className="patientMeta">
                            {item.gender ? `เพศ: ${item.gender}` : ''}
                            {item.birthDate ? ` • เกิด: ${item.birthDate}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Age */}
                      <td className="tableColCenter" style={{ fontSize: '0.85rem' }}>
                        {formatAge(item.birthDate)}
                      </td>

                      {/* Address */}
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {item.address || '-'}
                      </td>

                      {/* Status */}
                      <td className="tableColCenter">
                        {item.status === 'NO_RECORD' && (
                          <span className="statusBadge noRecord">
                            <AlertTriangle size={12} />
                            <span>ไม่มีเวชระเบียน</span>
                          </span>
                        )}
                        {item.status === 'WAITING' && (
                          <span className="statusBadge waiting">
                            <Clock size={12} />
                            <span>รอเปิด Visit</span>
                          </span>
                        )}
                        {item.status === 'VISIT_OPENED' && (
                          <div>
                            <span className="statusBadge opened">
                              <CheckCircle size={12} />
                              <span>เปิด Visit แล้ว</span>
                            </span>
                            {item.vn && <span className="vnText">VN: {item.vn}</span>}
                          </div>
                        )}
                        {item.status === 'CANCELLED' && (
                          <span className="statusBadge cancelled">
                            <XCircle size={12} />
                            <span>ยกเลิก</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="tableColCenter">
                        <div className="tableActionRow">
                          {item.status === 'NO_RECORD' ? (
                            <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600, padding: '0.25rem 0.5rem' }}>
                              รอเปิดเวชระเบียน
                            </span>
                          ) : item.status === 'WAITING' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'VISIT_OPENED', true)}
                              disabled={actionLoadingId === item.id}
                              className="btnActionOpenVisit"
                              title="เปลี่ยนสถานะเป็นเปิด Visit แล้ว"
                            >
                              {actionLoadingId === item.id ? '...' : 'เปิด Visit'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'WAITING')}
                              disabled={actionLoadingId === item.id}
                              className="btnActionReset"
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
                              className="btnActionIcon cancel"
                              title="ยกเลิกคิวนี้"
                            >
                              <XCircle size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenRawPayload(item.id)}
                            className="btnActionIcon rawPayload"
                            title="ดูข้อมูลดิบจากบัตร (Raw Payload)"
                          >
                            <FileText size={14} />
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

      {/* Raw Payload Modal */}
      {payloadModalOpen && selectedItemForPayload && (
        <div className="rawModalOverlay" onClick={() => setPayloadModalOpen(false)}>
          <div className="rawModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="rawModalHeader">
              <div className="rawModalTitleGroup">
                <FileText size={20} style={{ color: '#34d399' }} />
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    ข้อมูลดิบจากบัตรประชาชน (Raw Payload)
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
                    {selectedItemForPayload.fullName} (CID: {selectedItemForPayload.cid})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayloadModalOpen(false)}
                className="rawModalCloseBtn"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rawModalBody">
              <div className="rawMetaBox">
                <div>
                  <strong style={{ color: '#64748b' }}>ชื่อ-สกุล:</strong>{' '}
                  <span style={{ fontWeight: 700 }}>{selectedItemForPayload.fullName}</span>
                </div>
                <div>
                  <strong style={{ color: '#64748b' }}>เลขบัตร:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                    {selectedItemForPayload.cid}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#64748b' }}>วันเกิด:</strong>{' '}
                  <span>{selectedItemForPayload.birthDate || '-'}</span>
                </div>
                <div>
                  <strong style={{ color: '#64748b' }}>เพศ:</strong>{' '}
                  <span>{selectedItemForPayload.gender || '-'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ color: '#64748b' }}>ที่อยู่:</strong>{' '}
                  <span>{selectedItemForPayload.address || '-'}</span>
                </div>
              </div>

              <div>
                <div className="rawJsonToolbar">
                  <span>โครงสร้าง JSON จากเครื่องอ่าน (rawPayload):</span>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="copyJsonBtn"
                  >
                    {copied ? (
                      <>
                        <Check size={14} style={{ color: '#059669' }} />
                        <span style={{ color: '#059669' }}>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>คัดลอก JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="rawJsonPre">
                  {selectedItemForPayload.rawPayload
                    ? typeof selectedItemForPayload.rawPayload === 'string'
                      ? JSON.stringify(JSON.parse(selectedItemForPayload.rawPayload), null, 2)
                      : JSON.stringify(selectedItemForPayload.rawPayload, null, 2)
                    : '// ไม่มีข้อมูลดิบในฟิลด์ rawPayload'}
                </pre>
              </div>
            </div>

            <div className="rawModalFooter">
              <button
                type="button"
                onClick={() => setPayloadModalOpen(false)}
                className="closeModalBtn"
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
