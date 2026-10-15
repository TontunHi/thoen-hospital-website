'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Palette,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Printer,
  ChevronRight,
  Layers,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react'
import './mediaRequests.css'

interface MediaTaskItem {
  id: string
  task_no: string
  task_type: string
  title: string
  description: string
  urgency: 'NORMAL' | 'URGENT' | 'VERY_URGENT'
  requester_id: number
  requester_name: string
  requester_dept?: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'SENT_BACK'
  current_step_no: number
  current_step_name?: string | null
  custom_payload?: any
  created_at: string
  updated_at: string
}

export default function MediaRequestsListClient({
  initialTasks,
  canViewAll,
}: {
  initialTasks: MediaTaskItem[]
  canViewAll: boolean
}) {
  const [tasks, setTasks] = useState<MediaTaskItem[]>(initialTasks)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'SENT_BACK' | 'REJECTED'>('ALL')
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'NORMAL' | 'URGENT' | 'VERY_URGENT'>('ALL')
  const [loading, setLoading] = useState(false)

  const fetchFilteredTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (search.trim()) params.append('search', search.trim())

      const res = await fetch(`/api/member/media-requests?${params.toString()}`)
      const data = await res.json()
      if (data.success && data.data?.tasks) {
        const parsed = data.data.tasks.map((t: any) => ({
          ...t,
          custom_payload:
            typeof t.custom_payload === 'string'
              ? JSON.parse(t.custom_payload)
              : t.custom_payload,
        }))
        setTasks(parsed)
      }
    } catch (err) {
      console.error('Failed to filter media requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const isFirstRender = React.useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchFilteredTasks()
  }, [statusFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchFilteredTasks()
  }

  // Filter tasks client-side by urgency if set
  const displayedTasks = tasks.filter((t) => {
    if (urgencyFilter !== 'ALL' && t.urgency !== urgencyFilter) return false
    return true
  })

  // Stats Counters
  const totalCount = tasks.length
  const pendingCount = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length
  const approvedCount = tasks.filter((t) => t.status === 'APPROVED').length

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  return (
    <div className="mediaRequestsWrapper">
      {/* Top Navigation Bar */}
      <nav aria-label="นำทาง" className="mediaNav">
        <Link href="/member" className="mediaNavBackLink">
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          <span>กลับสู่พอร์ทัลสมาชิก</span>
        </Link>
        <Link href="/member/inbox" className="mediaNavInboxLink">
          <Layers aria-hidden="true" className="w-4 h-4" />
          <span>กล่องงาน (Task Inbox)</span>
        </Link>
      </nav>

      {/* Top Header Card */}
      <header className="mediaHeaderCard">
        <div className="mediaHeaderLeft">
          <div className="mediaBadgeIcon" aria-hidden="true">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <span className="mediaEyebrow">
              Hospital PR & Digital Media Requisition
            </span>
            <h1 className="mediaHeaderTitle">
              ระบบขอสื่อประชาสัมพันธ์
            </h1>
            <p className="mediaHeaderSubtitle">
              ยื่นคำขอจัดทำสื่อ แผ่นพับ โปสเตอร์ AW เว็บไซต์ บัตรพนักงาน ติดตามสถานะ และพิมพ์ใบขอรับบริการ
            </p>
          </div>
        </div>

        <div className="mediaHeaderActions">
          <Link href="/member/media-requests/new" className="btnCreateNew">
            <Plus aria-hidden="true" className="w-4 h-4" />
            <span>ยื่นขอสื่อประชาสัมพันธ์ใหม่</span>
          </Link>
        </div>
      </header>

      {/* Stats Cards Grid */}
      <div className="mediaStatsGrid" role="region" aria-label="สรุปภาพรวมคำขอสื่อ">
        <div
          role="button"
          tabIndex={0}
          className={`mediaStatCard ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setStatusFilter('ALL')
            }
          }}
          aria-label={`คำขอทั้งหมด ${totalCount} รายการ`}
        >
          <div className="mediaStatIcon total" aria-hidden="true">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="mediaStatLabel">คำขอทั้งหมด</span>
            <span className="mediaStatValue tabularNums">{totalCount}</span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={`mediaStatCard ${statusFilter === 'PENDING' ? 'active' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setStatusFilter('PENDING')
            }
          }}
          aria-label={`รอดำเนินการหรือลงนาม ${pendingCount} รายการ`}
        >
          <div className="mediaStatIcon pending" aria-hidden="true">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="mediaStatLabel">รอดำเนินการ / ลงนาม</span>
            <span className="mediaStatValue pending tabularNums">{pendingCount}</span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={`mediaStatCard ${statusFilter === 'APPROVED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('APPROVED')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setStatusFilter('APPROVED')
            }
          }}
          aria-label={`อนุมัติเสร็จสิ้น ${approvedCount} รายการ`}
        >
          <div className="mediaStatIcon approved" aria-hidden="true">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="mediaStatLabel">อนุมัติเสร็จสิ้น</span>
            <span className="mediaStatValue approved tabularNums">{approvedCount}</span>
          </div>
        </div>
      </div>

      {/* Table & Filter Card */}
      <div className="mediaTableCard">
        {/* Filter Bar */}
        <div className="mediaFilterBar">
          {/* Status Tabs */}
          <div className="mediaFilterTabs" role="tablist" aria-label="กรองสถานะคำขอ">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'ALL'}
              className={`mediaFilterTab ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              ทั้งหมด ({totalCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'PENDING'}
              className={`mediaFilterTab ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              รอดำเนินการ ({pendingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'APPROVED'}
              className={`mediaFilterTab ${statusFilter === 'APPROVED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('APPROVED')}
            >
              อนุมัติแล้ว ({approvedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'SENT_BACK'}
              className={`mediaFilterTab ${statusFilter === 'SENT_BACK' ? 'active' : ''}`}
              onClick={() => setStatusFilter('SENT_BACK')}
            >
              ส่งกลับแก้ไข
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="mediaSearchForm" role="search">
            <div className="mediaSearchWrap">
              <Search aria-hidden="true" className="w-4 h-4 mediaSearchIcon" />
              <input
                type="search"
                className="mediaSearchInput"
                placeholder="ค้นหาเลขที่, เรื่อง, ผู้ขอ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="ค้นหาคำขอสื่อประชาสัมพันธ์"
              />
            </div>
            <button type="submit" className="mediaSearchBtn">
              ค้นหา
            </button>
            {(search || statusFilter !== 'ALL' || urgencyFilter !== 'ALL') && (
              <button
                type="button"
                className="mediaResetBtn"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('ALL')
                  setUrgencyFilter('ALL')
                }}
                title="ล้างตัวกรองทั้งหมด"
                aria-label="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </form>
        </div>

        {/* Requests List */}
        <div>
          {loading ? (
            <div className="mediaLoadingState">
              <Clock aria-hidden="true" className="w-8 h-8 mediaLoadingSpinner" />
              <div className="mediaLoadingText">กำลังโหลดรายการคำขอสื่อ...</div>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="mediaEmptyState">
              <div className="mediaEmptyIcon" aria-hidden="true">
                <Palette className="w-8 h-8" />
              </div>
              <h3 className="mediaEmptyTitle">ไม่พบรายการคำขอสื่อประชาสัมพันธ์</h3>
              <p className="mediaEmptyDesc">
                {search || statusFilter !== 'ALL'
                  ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา ลองเปลี่ยนคำค้นหาหรือตัวกรอง'
                  : 'คุณยังไม่เคยยื่นคำขอสื่อประชาสัมพันธ์ สามารถกดปุ่มด้านล่างเพื่อเริ่มยื่นคำขอแรก'}
              </p>
              <Link href="/member/media-requests/new" className="btnActionDetail btnEmptyCreate">
                <Plus aria-hidden="true" className="w-4 h-4" />
                <span>ยื่นคำขอสื่อประชาสัมพันธ์ใหม่</span>
              </Link>
            </div>
          ) : (
            <div>
              {displayedTasks.map((t) => {
                const payload = t.custom_payload || {}
                const workTypes = payload.workTypes || []
                const channels = payload.channels || []
                const hasCost = payload.costType === 'HAS_COST'

                return (
                  <div key={t.id} className="mediaRequestRow">
                    {/* Left Details */}
                    <div className="mediaRequestLeft">
                      <div className="mediaRequestTopMeta">
                        <span className="mediaTaskNo">
                          {t.task_no}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`badgeStatus ${
                            t.status === 'APPROVED'
                              ? 'approved'
                              : t.status === 'SENT_BACK'
                              ? 'sent-back'
                              : t.status === 'REJECTED'
                              ? 'rejected'
                              : 'pending'
                          }`}
                        >
                          {t.status === 'APPROVED'
                            ? '✓ อนุมัติเสร็จสิ้น'
                            : t.status === 'SENT_BACK'
                            ? '⚠️ ส่งกลับแก้ไข'
                            : t.status === 'REJECTED'
                            ? '✕ ไม่อนุมัติ'
                            : '⏳ รอดำเนินการ'}
                        </span>

                        {/* Cost Tag */}
                        <span
                          className={`badgeCost ${
                            hasCost ? 'hasCost' : 'noCost'
                          }`}
                        >
                          {hasCost ? 'มีค่าใช้จ่าย' : 'ไม่มีค่าใช้จ่าย'}
                        </span>

                        {/* Urgency */}
                        {t.urgency === 'VERY_URGENT' && (
                          <span className="badgeUrgent veryUrgent">
                            🔴 ด่วนที่สุด
                          </span>
                        )}
                        {t.urgency === 'URGENT' && (
                          <span className="badgeUrgent urgent">
                            🟡 ด่วน
                          </span>
                        )}
                        {t.urgency === 'NORMAL' && (
                          <span className="badgeUrgent normal">
                            🟢 ไม่ด่วน
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <Link href={`/member/inbox/${t.id}`} className="mediaTitleLink">
                        {t.title}
                      </Link>

                      {/* Work Types & Channels Tags */}
                      <div className="mediaRequestTags">
                        {workTypes.slice(0, 3).map((w: any, idx: number) => (
                          <span key={idx} className="mediaTag">
                            🎨 {w.label} {w.customDetail ? `(${w.customDetail})` : ''}
                          </span>
                        ))}
                        {workTypes.length > 3 && (
                          <span className="mediaTagMore">
                            +{workTypes.length - 3} อื่นๆ
                          </span>
                        )}

                        <span className="mediaMetaDot" aria-hidden="true">•</span>

                        <span className="mediaRequesterText">
                          ผู้ขอ: <strong>{t.requester_name}</strong> ({t.requester_dept || '-'})
                        </span>
                      </div>

                      {/* Progress Step & Dates */}
                      <div className="mediaBottomMeta">
                        <span className="mediaStepIndicator">
                          <span className="mediaStepDot" aria-hidden="true" />
                          ขั้นตอน: {t.current_step_name || 'พิจารณาอนุมัติ'}
                        </span>

                        {payload.deliveryDate && (
                          <span className="mediaDeliveryDate">
                            <Calendar aria-hidden="true" className="w-3.5 h-3.5 mediaDateIcon" />
                            <span>กำหนดรับงาน: <strong>{payload.deliveryDate}</strong></span>
                          </span>
                        )}

                        <span>ยื่นเมื่อ: {formatThaiDate(t.created_at)}</span>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="mediaRequestRight">
                      <Link
                        href={`/member/inbox/${t.id}`}
                        className="btnActionDetail"
                      >
                        <span>เปิดดู / อนุมัติ</span>
                        <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                      </Link>

                      <Link
                        href={`/member/media-requests/${t.id}/print`}
                        target="_blank"
                        className="btnActionPrint"
                        title="พิมพ์ใบขอรับบริการ (A4)"
                        aria-label={`พิมพ์ใบขอรับบริการเลขที่ ${t.task_no}`}
                      >
                        <Printer aria-hidden="true" className="w-4 h-4 shrink-0" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
