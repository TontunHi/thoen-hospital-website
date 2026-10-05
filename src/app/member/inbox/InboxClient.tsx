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
  CheckCircle2,
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
  ShieldCheck,
  Palette,
  Plus,
  X,
  ArrowUpRight,
  Check,
  Monitor,
  HeartPulse
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
  custom_payload?: any
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
  const [tab, setTab] = useState<'inbox' | 'my-requests' | 'department' | 'all'>('inbox')
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [inboxCount, setInboxCount] = useState<number>(0)
  const [departmentCount, setDepartmentCount] = useState<number>(0)
  const [userDepartment, setUserDepartment] = useState<string>('')
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
        setDepartmentCount(json.data.departmentCount || 0)
        if (json.data.userDepartment) {
          setUserDepartment(json.data.userDepartment)
        }
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
            <Monitor size={13} />
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
            <HeartPulse size={13} />
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
      case 'MEDIA_REQUEST':
        return (
          <span className="typeBadge typeMediaRequest">
            <Palette size={13} />
            <span>ขอสื่อประชาสัมพันธ์</span>
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
    const s = (status || '').trim().toUpperCase()
    if (s === 'APPROVED' || s === 'COMPLETED' || s === 'อนุมัติ' || s === 'อนุมัติเสร็จสิ้น' || s === 'อนุมัติแล้ว') {
      return (
        <span className="statusBadge statusApproved">
          <CheckCircle2 size={13} strokeWidth={2.5} className="flex-shrink-0" />
          <span>อนุมัติเสร็จสิ้น</span>
        </span>
      )
    }
    if (s === 'REJECTED' || s === 'CANCELLED' || s === 'ไม่อนุมัติ' || s === 'ยกเลิก') {
      return (
        <span className="statusBadge statusRejected">
          <XCircle size={13} strokeWidth={2.5} className="flex-shrink-0" />
          <span>ไม่อนุมัติ</span>
        </span>
      )
    }
    if (s === 'SENT_BACK' || s === 'ส่งกลับแก้ไข') {
      return (
        <span className="statusBadge statusSentBack">
          <AlertCircle size={13} strokeWidth={2.5} className="flex-shrink-0" />
          <span>ส่งกลับแก้ไข</span>
        </span>
      )
    }
    if (s === 'IN_PROGRESS' || s === 'กำลังดำเนินการ' || s === 'กำลังซ่อม') {
      return (
        <span className="statusBadge statusInProgress">
          <Wrench size={13} strokeWidth={2.5} className="flex-shrink-0" />
          <span>กำลังซ่อม</span>
        </span>
      )
    }
    return (
      <span className="statusBadge statusPending">
        <Clock size={13} strokeWidth={2.5} className="flex-shrink-0" />
        <span>{s === 'PENDING' || s === 'WAITING' || !status ? 'รอดำเนินการ' : status}</span>
      </span>
    )
  }

  const getUrgencyTag = (urgency: string, taskType?: string) => {
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
            {taskType === 'MEDIA_REQUEST' ? 'ไม่ด่วน' : 'ปกติ'}
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
            <div className="inboxHeaderMetaRow">
              <span className="inboxHospTag">
                <Building2 size={12} />
                โรงพยาบาลเถิน จ.ลำปาง
              </span>
              <span className="inboxRoleTag">
                <ShieldCheck size={12} />
                {sessionUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่โรงพยาบาล'}
              </span>
            </div>
            <h1>กล่องงานและคำร้อง</h1>
            <p>ระบบติดตามคำร้อง งานแจ้งซ่อมบำรุง และเอกสารที่รอคุณลงนามหรือเข้าดำเนินการ</p>
          </div>
        </div>

        {/* Header Action Shortcuts */}
        <div className="headerActions">
          <Link href="/member/repairs/new" className="btnHeaderAction btnHeaderRepair">
            <Plus size={15} />
            <span>แจ้งซ่อมบำรุง</span>
          </Link>
          <Link href="/member/media-requests/new" className="btnHeaderAction btnHeaderMedia">
            <Plus size={15} />
            <span>ขอสื่อประชาสัมพันธ์</span>
          </Link>
          <Link href="/member" className="backBtn" aria-label="กลับหน้าหลักโปรไฟล์">
            <ArrowLeft size={15} />
            <span>หน้าหลักโปรไฟล์</span>
          </Link>
        </div>
      </div>

      {/* ── Interactive KPI Stats Cards ── */}
      <div className="inboxKpiGrid" role="region" aria-label="สรุปภาพรวมกล่องงาน">
        {/* KPI 1: Pending Tasks for User */}
        <div
          role="button"
          tabIndex={0}
          className={`inboxKpiCard kpiPending ${tab === 'inbox' ? 'isSelected' : ''}`}
          onClick={() => setTab('inbox')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setTab('inbox')
            }
          }}
        >
          <div className="kpiTopRow">
            <span className="kpiLabel">งานรอฉันปฏิบัติ / ตรวจสอบ</span>
            <div className="kpiIconBox kpiPendingIcon">
              <Inbox size={18} />
            </div>
          </div>
          <div className="kpiBottomRow">
            <span className="kpiNumber tabularNums">{stats.pendingCount}</span>
            {stats.pendingCount > 0 ? (
              <span className="kpiAlertBadge">
                <span className="kpiPulseDot" />
                มีงานค้าง
              </span>
            ) : (
              <span className="kpiOkBadge">เรียบร้อย</span>
            )}
          </div>
        </div>

        {/* KPI 2: My Requisitions */}
        <div
          role="button"
          tabIndex={0}
          className={`inboxKpiCard kpiMyReq ${tab === 'my-requests' ? 'isSelected' : ''}`}
          onClick={() => setTab('my-requests')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setTab('my-requests')
            }
          }}
        >
          <div className="kpiTopRow">
            <span className="kpiLabel">คำร้องที่ฉันยื่นขอ</span>
            <div className="kpiIconBox kpiMyReqIcon">
              <Send size={18} />
            </div>
          </div>
          <div className="kpiBottomRow">
            <span className="kpiNumber tabularNums">{stats.myRequestsCount}</span>
            <span className="kpiSubtext">ติดตามสถานะคำร้อง</span>
          </div>
        </div>

        {/* KPI 3: Department Tasks */}
        <div
          role="button"
          tabIndex={0}
          className={`inboxKpiCard kpiDept ${tab === 'department' ? 'isSelected' : ''}`}
          onClick={() => setTab('department')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setTab('department')
            }
          }}
        >
          <div className="kpiTopRow">
            <span className="kpiLabel">
              งานในหน่วยงาน {userDepartment ? `(${userDepartment})` : ''}
            </span>
            <div className="kpiIconBox kpiDeptIcon">
              <Building2 size={18} />
            </div>
          </div>
          <div className="kpiBottomRow">
            <span className="kpiNumber tabularNums">{departmentCount}</span>
            <span className="kpiSubtext">งานภายในแผนก</span>
          </div>
        </div>

        {/* KPI 4: All System Tasks (for Admin / Manager) */}
        {canViewAll && (
          <div
            role="button"
            tabIndex={0}
            className={`inboxKpiCard kpiAll ${tab === 'all' ? 'isSelected' : ''}`}
            onClick={() => setTab('all')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                setTab('all')
              }
            }}
          >
            <div className="kpiTopRow">
              <span className="kpiLabel">งานรอปฏิบัติทั้งหมด (Admin)</span>
              <div className="kpiIconBox kpiAllIcon">
                <Layers size={18} />
              </div>
            </div>
            <div className="kpiBottomRow">
              <span className="kpiNumber tabularNums">{stats.allPendingCount || 0}</span>
              <span className="kpiSubtext">ภาพรวมทั้งโรงพยาบาล</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab & Filter Toolbar Card ── */}
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
            {stats.myRequestsCount > 0 && (
              <span className="tabBadgeNeutral">{stats.myRequestsCount}</span>
            )}
          </button>

          <button
            role="tab"
            aria-selected={tab === 'department'}
            className={`tabPill ${tab === 'department' ? 'active' : ''}`}
            onClick={() => setTab('department')}
          >
            <Building2 size={16} />
            <span>งานในหน่วยงาน{userDepartment ? ` (${userDepartment})` : ''}</span>
            {departmentCount > 0 && (
              <span className="tabBadgeDept">{departmentCount}</span>
            )}
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

        {/* Search & Filter Controls Toolbar */}
        <form onSubmit={handleSearchSubmit} className="toolbarRow">
          <div className="searchFieldWrap">
            <Search size={16} className="searchFieldIcon" aria-hidden="true" />
            <input
              type="text"
              className="searchFieldInput"
              placeholder="ค้นหาตามรหัสงาน (เช่น IT-..., MR-...), ชื่อเรื่อง, หรือผู้ยื่นขอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ค้นหากล่องงาน"
            />
            {search && (
              <button
                type="button"
                className="searchClearBtn"
                onClick={() => {
                  setSearch('')
                  setTimeout(() => fetchTasks(), 50)
                }}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="filterSelectInput"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="กรองตามประเภทงาน"
          >
            <option value="">ทุกประเภทงาน</option>
            <option value="IT_REPAIR">💻 ซ่อมคอมฯ / ไอที</option>
            <option value="GENERAL_REPAIR">🔧 ซ่อมช่างทั่วไป</option>
            <option value="MEDICAL_REPAIR">🩺 ซ่อมเครื่องมือแพทย์</option>
            <option value="MEDIA_REQUEST">🎨 ขอสื่อประชาสัมพันธ์</option>
            <option value="ROOM_BOOKING">🏢 จองห้องประชุม</option>
            <option value="DOC_APPROVAL">📄 ขออนุมัติเอกสาร</option>
          </select>

          <select
            className="filterSelectInput"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="กรองตามสถานะ"
          >
            <option value="">ทุกสถานะ</option>
            <option value="PENDING">⏳ รอดำเนินการ / รอรับงาน</option>
            <option value="IN_PROGRESS">🛠️ กำลังดำเนินการ (รับงานแล้ว)</option>
            <option value="APPROVED">✅ เสร็จสิ้น / อนุมัติแล้ว</option>
            <option value="REJECTED">❌ ไม่อนุมัติ / ยกเลิก</option>
            <option value="SENT_BACK">🔄 ส่งกลับแก้ไข</option>
          </select>

          <button type="submit" className="refreshBtn" title="ค้นหาและรีเฟรชข้อมูล">
            <RefreshCw size={15} className={loading ? 'animate-spin text-teal-600' : ''} />
            <span>ค้นหา</span>
          </button>
        </form>

        {/* Results Counter Sub-bar */}
        <div className="inboxResultsBar">
          <span className="resultsCountText">
            พบรายการงานทั้งหมด <strong className="tabularNums">{tasks.length}</strong> รายการ
          </span>
          {(search || selectedType || selectedStatus) && (
            <button
              type="button"
              className="btnResetFilters"
              onClick={() => {
                setSearch('')
                setSelectedType('')
                setSelectedStatus('')
              }}
            >
              <X size={13} />
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
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
                : tab === 'department'
                ? 'ไม่พบรายการงานในหน่วยงานของคุณตามเงื่อนไขที่เลือก'
                : tab === 'all'
                ? 'ไม่พบรายการงานในระบบตามเงื่อนไขที่เลือก'
                : 'ไม่พบรายการคำร้องที่คุณยื่นขอในขณะนี้'}
            </p>
            <div className="emptyStateActions">
              <Link href="/member/repairs/new" className="emptyActionBtn btnRepairNew">
                <Plus size={14} />
                <span>แจ้งซ่อมบำรุงใหม่</span>
              </Link>
              <Link href="/member/media-requests/new" className="emptyActionBtn btnMediaRequestNew">
                <Plus size={14} />
                <span>ขอสื่อประชาสัมพันธ์</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Desktop Table View (>=768px) */}
            <div className="desktopTableView">
              <table className="modernTasksTable">
                <thead>
                  <tr>
                    <th style={{ width: '13%', whiteSpace: 'nowrap' }}>รหัสงาน</th>
                    <th style={{ width: '14%', whiteSpace: 'nowrap' }}>ประเภทงาน</th>
                    <th style={{ width: '29%' }}>หัวข้อเรื่อง / รายละเอียด</th>
                    <th style={{ width: '15%' }}>ผู้ยื่นขอ</th>
                    <th style={{ width: '15%' }}>ขั้นตอนปัจจุบัน</th>
                    <th style={{ width: '10%', whiteSpace: 'nowrap' }}>สถานะ</th>
                    <th style={{ width: '4%', textAlign: 'center', whiteSpace: 'nowrap' }}></th>
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
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="taskNoBadge">{task.task_no}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{getTypeBadge(task.task_type)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem', lineHeight: 1.45 }}>
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
                            {getUrgencyTag(task.urgency, task.task_type)}
                            <span>•</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatThaiDate(task.created_at)}</span>
                            {task.task_type === 'MEDIA_REQUEST' && task.custom_payload && (
                              <>
                                <span>•</span>
                                {task.custom_payload.costType === 'HAS_COST' ? (
                                  <span className="costPillHasCost">🔴 มีค่าใช้จ่าย</span>
                                ) : (
                                  <span className="costPillNoCost">🟢 ไม่มีค่าใช้จ่าย</span>
                                )}
                                {task.custom_payload.deliveryDate && (
                                  <span className="deliveryDateTag">
                                    <Calendar size={11} />
                                    <span>กำหนดเสร็จ: {task.custom_payload.deliveryDate}</span>
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{task.requester_name}</div>
                          {task.requester_dept && (
                            <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.15rem', lineHeight: 1.35 }}>
                              {task.requester_dept}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.35rem',
                              border: '1px solid #dbeafe',
                              whiteSpace: 'nowrap'
                            }}>
                              ขั้นตอนที่ {task.current_step_no}
                            </span>
                            <span style={{ fontSize: '0.825rem', color: '#334155', fontWeight: 500, lineHeight: 1.35 }}>
                              {task.current_step_name || 'รอดำเนินการ'}
                            </span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{getStatusBadge(task.status)}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                                  whiteSpace: 'nowrap',
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
                                  whiteSpace: 'nowrap',
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

                    {task.task_type === 'MEDIA_REQUEST' && task.custom_payload && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                        {task.custom_payload.costType === 'HAS_COST' ? (
                          <span className="costPillHasCost">🔴 มีค่าใช้จ่าย</span>
                        ) : (
                          <span className="costPillNoCost">🟢 ไม่มีค่าใช้จ่าย</span>
                        )}
                        {task.custom_payload.deliveryDate && (
                          <span className="deliveryDateTag">
                            <Calendar size={11} />
                            <span>กำหนดเสร็จ: {task.custom_payload.deliveryDate}</span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="taskMobileCardMeta">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#1e293b', fontWeight: 500 }}>
                        <User size={13} className="text-slate-500" />
                        {task.requester_name} {task.requester_dept ? `(${task.requester_dept})` : ''}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color: '#2563eb',
                        backgroundColor: '#eff6ff',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.35rem',
                        border: '1px solid #dbeafe',
                      }}>
                        ขั้นตอนที่ {task.current_step_no}: {task.current_step_name || 'รอดำเนินการ'}
                      </span>
                    </div>

                    <div className="taskMobileCardFooter">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getUrgencyTag(task.urgency, task.task_type)}
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
