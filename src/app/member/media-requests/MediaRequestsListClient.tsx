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
  AlertCircle,
  FileText,
  Printer,
  ChevronRight,
  Filter,
  Layers,
  Share2,
  ExternalLink,
  RotateCcw,
  Sparkles,
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

  useEffect(() => {
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
      {/* Top Header Card */}
      <div className="mediaHeaderCard">
        <div className="mediaHeaderLeft">
          <div className="mediaBadgeIcon">
            <Palette className="w-7 h-7" />
          </div>
          <div>
            <span className="mediaEyebrow">
              Hospital PR & Media Requisition
            </span>
            <h1 className="mediaHeaderTitle">
              ระบบขอสื่อประชาสัมพันธ์
            </h1>
            <p className="mediaHeaderSubtitle">
              ยื่นคำขอจัดทำสื่อ แผ่นพับ โปสเตอร์ AW เว็บไซต์ บัตรพนักงาน ติดตามสถานะ และพิมพ์ใบขอรับบริการ
            </p>
          </div>
        </div>

        <div>
          <Link href="/member/media-requests/new" className="btnCreateNew">
            <Plus className="w-5 h-5" />
            <span>ยื่นขอสื่อประชาสัมพันธ์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="mediaStatsGrid">
        <div className="mediaStatCard">
          <div className="mediaStatIcon total">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="mediaStatLabel">คำขอทั้งหมด</span>
            <span className="mediaStatValue">{totalCount}</span>
          </div>
        </div>

        <div className="mediaStatCard">
          <div className="mediaStatIcon pending">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="mediaStatLabel">รอดำเนินการ / ลงนาม</span>
            <span className="mediaStatValue pending">{pendingCount}</span>
          </div>
        </div>

        <div className="mediaStatCard">
          <div className="mediaStatIcon approved">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="mediaStatLabel">อนุมัติเสร็จสิ้น</span>
            <span className="mediaStatValue approved">{approvedCount}</span>
          </div>
        </div>
      </div>

      {/* Table & Filter Card */}
      <div className="mediaTableCard">
        {/* Filter Bar */}
        <div className="mediaFilterBar">
          {/* Status Tabs */}
          <div className="mediaFilterTabs">
            <button
              type="button"
              className={`mediaFilterTab ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              ทั้งหมด ({totalCount})
            </button>
            <button
              type="button"
              className={`mediaFilterTab ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              รอดำเนินการ ({pendingCount})
            </button>
            <button
              type="button"
              className={`mediaFilterTab ${statusFilter === 'APPROVED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('APPROVED')}
            >
              อนุมัติแล้ว ({approvedCount})
            </button>
            <button
              type="button"
              className={`mediaFilterTab ${statusFilter === 'SENT_BACK' ? 'active' : ''}`}
              onClick={() => setStatusFilter('SENT_BACK')}
            >
              ส่งกลับแก้ไข
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="mediaSearchForm">
            <div className="mediaSearchWrap">
              <Search className="w-4 h-4 mediaSearchIcon" />
              <input
                type="text"
                className="mediaSearchInput"
                placeholder="ค้นหาเลขที่, เรื่อง, ผู้ขอ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="mediaSearchBtn">
              ค้นหา
            </button>
          </form>
        </div>

        {/* Requests List */}
        <div>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Clock style={{ width: '2rem', height: '2rem', animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem', color: '#0d9488' }} />
              <div style={{ fontSize: '0.875rem' }}>กำลังโหลดรายการคำขอสื่อ...</div>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="mediaEmptyState">
              <div className="mediaEmptyIcon">
                <Palette style={{ width: '2rem', height: '2rem' }} />
              </div>
              <h3 className="mediaEmptyTitle">ไม่พบรายการคำขอสื่อประชาสัมพันธ์</h3>
              <p className="mediaEmptyDesc">
                {search || statusFilter !== 'ALL'
                  ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา ลองเปลี่ยนคำค้นหาหรือตัวกรอง'
                  : 'คุณยังไม่เคยยื่นคำขอสื่อประชาสัมพันธ์ สามารถกดปุ่มด้านล่างเพื่อเริ่มยื่นคำขอแรก'}
              </p>
              <Link href="/member/media-requests/new" className="btnActionDetail" style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}>
                <Plus style={{ width: '1rem', height: '1rem' }} />
                ยื่นคำขอสื่อประชาสัมพันธ์ใหม่
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
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
                            +{workTypes.length - 3} อื่นๆ
                          </span>
                        )}

                        <span style={{ color: '#cbd5e1' }}>•</span>

                        <span className="mediaRequesterText">
                          ผู้ขอ: <strong>{t.requester_name}</strong> ({t.requester_dept || '-'})
                        </span>
                      </div>

                      {/* Progress Step & Dates */}
                      <div className="mediaBottomMeta">
                        <span className="mediaStepIndicator">
                          <span className="mediaStepDot" />
                          ขั้นตอน: {t.current_step_name || 'พิจารณาอนุมัติ'}
                        </span>

                        {payload.deliveryDate && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#475569' }}>
                            <Calendar style={{ width: '0.875rem', height: '0.875rem', color: '#94a3b8' }} />
                            กำหนดรับงาน: <strong>{payload.deliveryDate}</strong>
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
                        <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
                      </Link>

                      <Link
                        href={`/member/media-requests/${t.id}/print`}
                        target="_blank"
                        className="btnActionPrint"
                        title="พิมพ์ใบขอรับบริการ (A4)"
                      >
                        <Printer style={{ width: '1rem', height: '1rem' }} />
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
