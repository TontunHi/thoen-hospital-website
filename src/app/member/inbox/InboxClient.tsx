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
  Stethoscope,
  Sparkles,
  User,
  ShieldCheck
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
  const [acceptingTaskId, setAcceptingTaskId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Cancel Modal Popup State
  const [cancelModalTask, setCancelModalTask] = useState<{ id: string; taskNo: string; title: string } | null>(null)
  const [cancelReason, setCancelReason] = useState<string>('')
  const [cancelling, setCancelling] = useState<boolean>(false)

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

  const handleQuickAccept = async (e: React.MouseEvent, taskId: string, taskNo: string) => {
    e.stopPropagation()
    setAcceptingTaskId(taskId)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ACCEPT_JOB' }),
      })
      const data = await res.json()
      if (data.success) {
        setToastMessage(`✓ รับงานซ่อม ${taskNo} สำเร็จเรียบร้อยแล้ว (แจ้งเตือนไปยังผู้แจ้งแล้ว)`)
        setTimeout(() => setToastMessage(null), 4500)
        await fetchTasks()
      } else {
        alert(data.error || 'ไม่สามารถรับงานได้')
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setAcceptingTaskId(null)
    }
  }

  const handleOpenCancelModal = (e: React.MouseEvent, task: TaskSummary) => {
    e.stopPropagation()
    setCancelModalTask({ id: task.id, taskNo: task.task_no, title: task.title })
    setCancelReason('')
  }

  const handleConfirmCancel = async () => {
    if (!cancelModalTask || !cancelReason.trim()) {
      alert('กรุณาระบุเหตุผลในการยกเลิกงาน')
      return
    }
    setCancelling(true)
    try {
      const res = await fetch(`/api/member/inbox/${cancelModalTask.id}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL_JOB',
          reason: cancelReason.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setToastMessage(`✓ ยกเลิกงาน ${cancelModalTask.taskNo} สำเร็จเรียบร้อยแล้ว`)
        setTimeout(() => setToastMessage(null), 4500)
        setCancelModalTask(null)
        setCancelReason('')
        await fetchTasks()
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการยกเลิกงาน')
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setCancelling(false)
    }
  }

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
            <span>ซ่อมคอมฯ/ไอที</span>
          </span>
        )
      case 'GENERAL_REPAIR':
        return (
          <span className="typeBadge typeGeneral">
            <Wrench size={13} />
            <span>ซ่อมงานช่างทั่วไป</span>
          </span>
        )
      case 'MEDICAL_REPAIR':
        return (
          <span className="typeBadge typeMedical">
            <Stethoscope size={13} />
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
      case 'IN_PROGRESS':
        return (
          <span className="statusBadge statusInProgress">
            <Wrench size={13} />
            <span>กำลังซ่อม</span>
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
          <div className="inboxIconBadge" aria-hidden="true">
            <Inbox size={26} />
          </div>
          <div className="inboxTitleArea">
            <h1>กล่องงานกลาง (Unified Inbox)</h1>
            <p>รวมรายการคำร้อง งานแจ้งซ่อม และเอกสารที่รอคุณลงนามหรือปฏิบัติหน้าที่</p>
          </div>
        </div>
        <div className="headerActions">
          <Link href="/member" className="backBtn" aria-label="กลับหน้าโปรไฟล์สมาชิก">
            <ArrowLeft size={16} />
            <span>หน้าหลักโปรไฟล์</span>
          </Link>
        </div>
      </div>

      {/* ── Compact Quick Stats Chips ── */}
      <div className="compactStatsRow" role="region" aria-label="สถิติกล่องงานด่วน">
        <div className="compactStatChip chipPending">
          <span className="compactStatNumber">{stats.pendingCount}</span>
          <span className="compactStatLabel">งานรอฉันดำเนินการ</span>
        </div>

        <div className="compactStatChip chipMyReq">
          <span className="compactStatNumber">{stats.myRequestsCount}</span>
          <span className="compactStatLabel">คำร้องที่ฉันส่งขอ</span>
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
        <div className="inboxTabsRow" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'inbox'}
            className={`tabPill ${tab === 'inbox' ? 'active' : ''}`}
            onClick={() => setTab('inbox')}
          >
            <Inbox size={16} />
            <span>งานรอฉันตรวจสอบ / ช่างรับงาน</span>
            {inboxCount > 0 && <span className="tabBadgeAlert">{inboxCount}</span>}
          </button>
          
          <button
            role="tab"
            aria-selected={tab === 'my-requests'}
            className={`tabPill ${tab === 'my-requests' ? 'active' : ''}`}
            onClick={() => setTab('my-requests')}
          >
            <Send size={16} />
            <span>คำร้องที่ฉันยื่นขอ</span>
          </button>

          {canViewAll && (
            <button
              role="tab"
              aria-selected={tab === 'all'}
              className={`tabPill ${tab === 'all' ? 'active' : ''}`}
              onClick={() => setTab('all')}
            >
              <Layers size={16} />
              <span>งานทั้งหมดในระบบ (Admin / หัวหน้า)</span>
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="toolbarRow">
          <div className="searchFieldWrap">
            <Search size={16} className="searchFieldIcon" aria-hidden="true" />
            <input
              type="text"
              className="searchFieldInput"
              placeholder="ค้นหาตามรหัสงาน (เช่น IT-...), ชื่อเรื่อง, หรือผู้ยื่นขอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ค้นหากล่องงาน"
            />
          </div>

          <select
            className="filterSelectInput"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="กรองตามประเภทงาน"
          >
            <option value="">ทุกประเภทงาน</option>
            <option value="IT_REPAIR">งานซ่อมคอมฯ / ไอที</option>
            <option value="MEDICAL_REPAIR">งานซ่อมเครื่องมือแพทย์</option>
            <option value="GENERAL_REPAIR">งานซ่อมช่างทั่วไป</option>
            <option value="ROOM_BOOKING">งานขอใช้ห้องประชุม</option>
            <option value="DOC_APPROVAL">เอกสารขออนุมัติทั่วไป</option>
          </select>

          <select
            className="filterSelectInput"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="กรองตามสถานะ"
          >
            <option value="">ทุกสถานะ</option>
            <option value="PENDING">รอดำเนินการ / รอรับงาน</option>
            <option value="IN_PROGRESS">กำลังดำเนินการ (รับงานแล้ว)</option>
            <option value="APPROVED">เสร็จสิ้น / อนุมัติแล้ว</option>
            <option value="REJECTED">ไม่อนุมัติ / ยกเลิก</option>
            <option value="SENT_BACK">ส่งกลับแก้ไข</option>
          </select>

          <button type="submit" className="refreshBtn" title="ค้นหาและรีเฟรชข้อมูล">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>ค้นหา</span>
          </button>
        </form>
      </div>

      {/* ── Toast Success Message ── */}
      {toastMessage && (
        <div style={{
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #bbf7d0',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.75rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
          boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.1)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Tasks Container (Table on Desktop / Cards on Mobile) ── */}
      <div className="inboxTableWrapper">
        {loading ? (
          <div className="inboxEmptyState">
            <div className="emptyIconCircle">
              <RefreshCw size={32} className="animate-spin text-blue-600" />
            </div>
            <h3>กำลังโหลดรายการงาน...</h3>
            <p>กรุณารอสักครู่ ระบบกำลังดึงข้อมูลกล่องงานล่าสุด</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="inboxEmptyState">
            <div className="emptyIconCircle">
              <Inbox size={34} />
            </div>
            <h3>ไม่มีรายการงานในหมวดหมู่นี้</h3>
            <p>
              {tab === 'inbox' 
                ? 'ยอดเยี่ยม! ขณะนี้คุณไม่มีงานค้างที่ต้องพิจารณาหรือปฏิบัติหน้าที่'
                : tab === 'all'
                ? 'ไม่พบรายการงานในระบบตามเงื่อนไขที่เลือก'
                : 'ไม่พบรายการคำร้องที่คุณยื่นขอในขณะนี้'}
            </p>
          </div>
        ) : (
          <>
            {/* 1. Desktop Table View (>=768px) */}
            <div className="desktopTableView">
              <table className="modernTasksTable">
                <thead>
                  <tr>
                    <th style={{ width: '13%' }}>รหัสงาน</th>
                    <th style={{ width: '15%' }}>ประเภทงาน</th>
                    <th style={{ width: '28%' }}>หัวข้อเรื่อง / รายละเอียด</th>
                    <th style={{ width: '15%' }}>ผู้ยื่นขอ</th>
                    <th style={{ width: '12%' }}>ขั้นตอน</th>
                    <th style={{ width: '10%' }}>สถานะ</th>
                    <th style={{ width: '7%', textAlign: 'center' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const isRepair = ['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type)
                    const canQuickAccept = isRepair && task.status === 'PENDING' && tab === 'inbox'
                    const canQuickCancel = isRepair && task.status === 'PENDING' && (tab === 'inbox' || tab === 'my-requests')

                    return (
                      <tr
                        key={task.id}
                        className="modernTableRow"
                        onClick={() => router.push(`/member/inbox/${task.id}`)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            router.push(`/member/inbox/${task.id}`)
                          }
                        }}
                      >
                        <td>
                          <span className="taskNoBadge">{task.task_no}</span>
                        </td>
                        <td>{getTypeBadge(task.task_type)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.2rem', lineHeight: 1.4 }}>
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.8rem', color: '#64748b' }}>
                            {getUrgencyTag(task.urgency)}
                            <span>•</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatThaiDate(task.created_at)}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{task.requester_name}</div>
                          {task.requester_dept && (
                            <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.1rem' }}>
                              {task.requester_dept}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>
                            {task.current_step_name || `ขั้นตอนที่ ${task.current_step_no}`}
                          </span>
                        </td>
                        <td>{getStatusBadge(task.status)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            {canQuickAccept && (
                              <button
                                type="button"
                                disabled={acceptingTaskId === task.id || cancelling}
                                onClick={(e) => handleQuickAccept(e, task.id, task.task_no)}
                                style={{
                                  backgroundColor: '#2563eb',
                                  color: 'white',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '0.45rem',
                                  border: 'none',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.2)',
                                  transition: 'all 0.15s ease',
                                }}
                                title="คลิกเพื่อรับงานซ่อมนี้ทันที"
                              >
                                {acceptingTaskId === task.id ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <Wrench size={12} />
                                )}
                                <span>รับงาน</span>
                              </button>
                            )}
                            {canQuickCancel && (
                              <button
                                type="button"
                                disabled={acceptingTaskId === task.id || cancelling}
                                onClick={(e) => handleOpenCancelModal(e, task)}
                                style={{
                                  backgroundColor: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '0.45rem',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  transition: 'all 0.15s ease',
                                }}
                                title="คลิกเพื่อเปิดหน้าต่างยกเลิก/ปฏิเสธงาน"
                              >
                                <XCircle size={12} />
                                <span>ยกเลิก</span>
                              </button>
                            )}
                            {!canQuickAccept && !canQuickCancel && (
                              <ChevronRight size={16} className="text-slate-400 mx-auto" />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. Mobile Card View (<768px) */}
            <div className="mobileCardView">
              {tasks.map((task) => {
                const isRepair = ['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type)
                const canQuickAccept = isRepair && task.status === 'PENDING' && tab === 'inbox'
                const canQuickCancel = isRepair && task.status === 'PENDING' && (tab === 'inbox' || tab === 'my-requests')

                return (
                  <div
                    key={task.id}
                    className="taskMobileCard"
                    onClick={() => router.push(`/member/inbox/${task.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/member/inbox/${task.id}`)
                      }
                    }}
                  >
                    <div className="taskMobileCardTop">
                      <span className="taskNoBadge">{task.task_no}</span>
                      {getTypeBadge(task.task_type)}
                    </div>

                    <div className="taskMobileCardTitle">{task.title}</div>

                    <div className="taskMobileCardMeta">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#1e293b', fontWeight: 500 }}>
                        <User size={13} className="text-slate-500" />
                        {task.requester_name} {task.requester_dept ? `(${task.requester_dept})` : ''}
                      </span>
                    </div>

                    <div className="taskMobileCardFooter">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getUrgencyTag(task.urgency)}
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                          {formatThaiDate(task.created_at)}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {canQuickAccept && (
                          <button
                            type="button"
                            disabled={acceptingTaskId === task.id || cancelling}
                            onClick={(e) => handleQuickAccept(e, task.id, task.task_no)}
                            style={{
                              backgroundColor: '#2563eb',
                              color: 'white',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '0.45rem',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '0.775rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {acceptingTaskId === task.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Wrench size={12} />
                            )}
                            <span>รับงาน</span>
                          </button>
                        )}
                        {canQuickCancel && (
                          <button
                            type="button"
                            disabled={acceptingTaskId === task.id || cancelling}
                            onClick={(e) => handleOpenCancelModal(e, task)}
                            style={{
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '0.45rem',
                              fontWeight: 600,
                              fontSize: '0.775rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <XCircle size={12} />
                            <span>ยกเลิก</span>
                          </button>
                        )}
                        <div>{getStatusBadge(task.status)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: Quick Cancel / Reject Popup ── */}
      {cancelModalTask && (
        <div className="modalBackdrop" onClick={() => setCancelModalTask(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #fee2e2', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca' }}>
                  <XCircle size={18} className="text-red-600" />
                </div>
                <span>ยืนยันการยกเลิก / ปฏิเสธงาน</span>
              </h3>
              <button
                type="button"
                onClick={() => setCancelModalTask(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>รหัสงาน: <strong className="taskNoBadge">{cancelModalTask.taskNo}</strong></div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginTop: '0.25rem' }}>{cancelModalTask.title}</div>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.15rem', lineHeight: 1.5 }}>
              เมื่อยืนยันยกเลิก สถานะงานจะถูกปรับเป็น <strong style={{ color: '#dc2626' }}>&ldquo;ไม่อนุมัติ / ยกเลิก&rdquo;</strong> และระบบจะส่งการแจ้งเตือนพร้อมเหตุผลไปยังผู้เกี่ยวข้องทันที
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                ระบุเหตุผลในการยกเลิกหรือปฏิเสธ <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="เช่น อุปกรณ์ไม่อยู่ในเงื่อนไขการซ่อม, มอบหมายผิดแผนก, ข้อมูลไม่ครบถ้วน, ผู้ใช้ขอยกเลิกเอง ฯลฯ"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setCancelModalTask(null)}
                className="backBtn"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleConfirmCancel}
                style={{
                  backgroundColor: !cancelReason.trim() ? '#fca5a5' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.6rem 1.35rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: !cancelReason.trim() ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cancelling ? <Clock size={16} className="animate-spin" /> : <XCircle size={16} />}
                <span>ยืนยันยกเลิกงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
