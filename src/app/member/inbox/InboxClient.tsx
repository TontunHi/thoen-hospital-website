'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Inbox, 
  Send, 
  Layers, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Calendar,
  Wrench,
  Building2,
  FileCheck2,
  Sparkles
} from 'lucide-react'

interface TaskSummary {
  id: string
  task_no: string
  task_type: string
  title: string
  description?: string
  urgency: string
  requester_name: string
  requester_dept?: string
  status: string
  current_step_no: number
  current_step_name?: string
  created_at: string
  updated_at: string
}

interface StatsSummary {
  pendingCount: number
  allPendingCount?: number
  approvedCount: number
  myRequestsCount: number
}

interface InboxClientProps {
  sessionUser: {
    username: string
    role: string
    email: string
  }
}

export default function InboxClient({ sessionUser }: InboxClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'inbox' | 'my-requests' | 'all'>('inbox')
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [inboxCount, setInboxCount] = useState<number>(0)
  const [canViewAll, setCanViewAll] = useState<boolean>(sessionUser.role === 'admin')
  const [stats, setStats] = useState<StatsSummary>({
    pendingCount: 0,
    allPendingCount: 0,
    approvedCount: 0,
    myRequestsCount: 0,
  })
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('tab', tab)
      if (selectedType) params.set('type', selectedType)
      if (selectedStatus) params.set('status', selectedStatus)
      if (search) params.set('search', search)

      const res = await fetch(`/api/member/inbox?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data) {
        setTasks(json.data.tasks || [])
        setInboxCount(json.data.inboxCount || 0)
        if (json.data.canViewAll !== undefined) {
          setCanViewAll(json.data.canViewAll)
        }
        setStats(json.data.stats || {
          pendingCount: json.data.inboxCount || 0,
          allPendingCount: 0,
          approvedCount: 0,
          myRequestsCount: 0,
        })
      }
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [tab, selectedType, selectedStatus])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTasks()
  }

  const formatThaiDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IT_REPAIR':
        return (
          <span className="typeBadge typeIT">
            <Wrench size={13} />
            <span>งานซ่อมไอที</span>
          </span>
        )
      case 'GENERAL_REPAIR':
        return (
          <span className="typeBadge" style={{ backgroundColor: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
            <Wrench size={13} />
            <span>ซ่อมงานช่าง</span>
          </span>
        )
      case 'MEDICAL_REPAIR':
        return (
          <span className="typeBadge" style={{ backgroundColor: '#fdf2f8', color: '#be185d', borderColor: '#fbcfe8' }}>
            <Wrench size={13} />
            <span>ซ่อมเครื่องมือแพทย์</span>
          </span>
        )
      case 'ROOM_BOOKING':
        return (
          <span className="typeBadge typeRoom">
            <Building2 size={13} />
            <span>จองห้องประชุม</span>
          </span>
        )
      case 'DOC_APPROVAL':
        return (
          <span className="typeBadge typeDoc">
            <FileText size={13} />
            <span>ขออนุมัติเอกสาร</span>
          </span>
        )
      default:
        return (
          <span className="typeBadge">
            <FileText size={13} />
            <span>{type}</span>
          </span>
        )
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="statusBadge statusPending">
            <Clock size={13} />
            <span>รอดำเนินการ</span>
          </span>
        )
      case 'APPROVED':
        return (
          <span className="statusBadge statusApproved">
            <CheckCircle size={13} />
            <span>อนุมัติเสร็จสิ้น</span>
          </span>
        )
      case 'REJECTED':
        return (
          <span className="statusBadge statusRejected">
            <XCircle size={13} />
            <span>ไม่อนุมัติ</span>
          </span>
        )
      case 'SENT_BACK':
        return (
          <span className="statusBadge statusSentBack">
            <AlertCircle size={13} />
            <span>ส่งกลับแก้ไข</span>
          </span>
        )
      default:
        return <span className="statusBadge">{status}</span>
    }
  }

  const getUrgencyTag = (urgency: string) => {
    switch (urgency) {
      case 'VERY_URGENT':
        return (
          <span className="urgencyDot dotVeryUrgent">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
            ด่วนที่สุด
          </span>
        )
      case 'URGENT':
        return (
          <span className="urgencyDot dotUrgent">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea580c' }}></span>
            ด่วน
          </span>
        )
      default:
        return (
          <span className="urgencyDot dotNormal">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#94a3b8' }}></span>
            ปกติ
          </span>
        )
    }
  }

  return (
    <div className="inboxWrapper">
      {/* ── Top Header Card ── */}
      <div className="inboxHeaderCard">
        <div className="inboxHeaderLeft">
          <div className="inboxIconBadge">
            <Inbox size={26} />
          </div>
          <div className="inboxTitleArea">
            <h1>กล่องงาน</h1>
            <p>รายการงานและเอกสารที่รอคุณพิจารณา อนุมัติ หรือลงนามคำร้อง</p>
          </div>
        </div>
        <div className="headerActions">
          <Link href="/member" className="backBtn">
            <ArrowLeft size={16} />
            กลับหน้าโปรไฟล์
          </Link>
        </div>
      </div>

      {/* ── Compact Quick Stats Chips ── */}
      <div className="compactStatsRow">
        <div className="compactStatChip chipPending">
          <span className="compactStatNumber">{stats.pendingCount}</span>
          <span className="compactStatLabel">งานรอฉันตรวจสอบ / ปฏิบัติ</span>
        </div>

        <div className="compactStatChip chipMyReq">
          <span className="compactStatNumber">{stats.myRequestsCount}</span>
          <span className="compactStatLabel">คำร้องที่ฉันยื่น</span>
        </div>

        {canViewAll && (
          <div className="compactStatChip" style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}>
            <span className="compactStatNumber" style={{ backgroundColor: '#e2e8f0', color: '#334155' }}>
              {stats.allPendingCount || 0}
            </span>
            <span className="compactStatLabel">งานรอปฏิบัติทั้งหมดในระบบ</span>
          </div>
        )}
      </div>

      {/* ── Tab & Filter Toolbar ── */}
      <div className="navFilterCard">
        {/* Navigation Tabs */}
        <div className="inboxTabsRow">
          <button
            className={`tabPill ${tab === 'inbox' ? 'active' : ''}`}
            onClick={() => setTab('inbox')}
          >
            <Inbox size={16} />
            <span>งานรอฉันตรวจสอบ / ช่างรับงาน</span>
            {inboxCount > 0 && <span className="tabBadgeAlert">{inboxCount}</span>}
          </button>
          
          <button
            className={`tabPill ${tab === 'my-requests' ? 'active' : ''}`}
            onClick={() => setTab('my-requests')}
          >
            <Send size={16} />
            <span>งานที่ฉันยื่นขอ</span>
          </button>

          {canViewAll && (
            <button
              className={`tabPill ${tab === 'all' ? 'active' : ''}`}
              onClick={() => setTab('all')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Layers size={16} />
              <span>งานทั้งหมดในระบบ (Admin / หัวหน้า)</span>
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="toolbarRow">
          <div className="searchFieldWrap">
            <Search size={16} className="searchFieldIcon" />
            <input
              type="text"
              className="searchFieldInput"
              placeholder="ค้นหาตามรหัสงาน (เช่น IT-...), หัวข้อเรื่อง, หรือชื่อผู้ขอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filterSelectInput"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">ทุกประเภทงาน</option>
            <option value="IT_REPAIR">งานซ่อมบำรุง / ไอที</option>
            <option value="ROOM_BOOKING">งานขอใช้ห้องประชุม</option>
            <option value="DOC_APPROVAL">เอกสารขออนุมัติทั่วไป</option>
          </select>

          <select
            className="filterSelectInput"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            <option value="PENDING">รอดำเนินการ</option>
            <option value="APPROVED">อนุมัติแล้ว</option>
            <option value="REJECTED">ไม่อนุมัติ</option>
            <option value="SENT_BACK">ส่งกลับแก้ไข</option>
          </select>

          <button type="submit" className="refreshBtn" title="ค้นหาและรีเฟรชข้อมูล">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
        </form>
      </div>

      {/* ── Tasks Table Card ── */}
      <div className="inboxTableWrapper">
        {loading ? (
          <div className="inboxEmptyState">
            <div className="emptyIconCircle">
              <RefreshCw size={32} className="animate-spin text-blue-600" />
            </div>
            <h3>กำลังโหลดรายการงาน...</h3>
            <p>กรุณารอสักครู่ ระบบกำลังค้นหารายการงานในกล่องงานของคุณ</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="inboxEmptyState">
            <div className="emptyIconCircle">
              <Inbox size={34} />
            </div>
            <h3>ไม่มีรายการงานในหมวดหมู่นี้</h3>
            <p>
              {tab === 'inbox' 
                ? 'ยอดเยี่ยม! ขณะนี้คุณไม่มีงานค้างที่ต้องพิจารณาหรืออนุมัติในระบบ'
                : tab === 'all'
                ? 'ไม่พบรายการงานในระบบตามเงื่อนไขที่เลือก'
                : 'ไม่พบรายการคำร้องที่ตรงกับเงื่อนไขการค้นหาในขณะนี้'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="modernTasksTable">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>รหัสงาน</th>
                  <th style={{ width: '14%' }}>ประเภท</th>
                  <th style={{ width: '30%' }}>หัวข้อเรื่อง / รายละเอียด</th>
                  <th style={{ width: '16%' }}>ผู้ยื่นขอ</th>
                  <th style={{ width: '15%' }}>ขั้นตอนปัจจุบัน</th>
                  <th style={{ width: '12%' }}>สถานะ</th>
                  <th style={{ width: '4%' }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="modernTableRow"
                    onClick={() => router.push(`/member/inbox/${task.id}`)}
                  >
                    <td>
                      <span className="taskNoBadge">{task.task_no}</span>
                    </td>
                    <td>{getTypeBadge(task.task_type)}</td>
                    <td>
                      <div className="taskTitleText">{task.title}</div>
                      <div className="taskSubtitleText" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {getUrgencyTag(task.urgency)}
                        <span>•</span>
                        <span>{formatThaiDate(task.created_at)}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{task.requester_name}</div>
                      {task.requester_dept && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>
                          {task.requester_dept}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 500 }}>
                        {task.current_step_name || `ขั้นตอนที่ ${task.current_step_no}`}
                      </span>
                    </td>
                    <td>{getStatusBadge(task.status)}</td>
                    <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                      <ChevronRight size={18} style={{ color: '#94a3b8' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
