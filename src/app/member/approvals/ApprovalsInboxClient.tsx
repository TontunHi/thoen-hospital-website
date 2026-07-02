'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Check, X, Shield, Loader2, AlertCircle,
  User, Building2, Calendar, ShieldCheck, Eye, Printer,
  Clock, CheckCircle2, XCircle, History, Inbox, Star, Upload,
  Download, RefreshCw, FileCheck, MessageSquare, Laptop
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import './page.css'

interface ApprovalTicket {
  id: number
  source_system: string
  source_id: number
  step_number: number
  assigned_position: string
  status: string
  comment: string | null
  approved_at: string | null
  created_at: string
  req_title: string
  req_urgency: string
  req_created_at: string
  requester_name: string
  requester_dept: string
  has_cost: number
}

interface PRDetail {
  id: number
  title: string
  urgency: string
  order_date: string
  target_date: string
  job_type: string | null
  job_type_other: string | null
  details: string | null
  channels: string | null
  phone: string
  has_cost: number
  status: string
  created_at: string
  requester_name: string
  requester_position: string
  requester_dept: string
  department: string
  attachments?: { url: string; filename: string }[]
}

interface ApprovalStep {
  id: number
  step_number: number
  assigned_position: string
  current_approver_id: number | null
  status: string
  comment: string | null
  signature_path: string | null
  approved_at: string | null
  approver_name: string | null
}

interface WorkAttachment {
  id: number
  work_request_id: number
  phase: number
  file_type: 'image' | 'pdf'
  file_path: string
  original_name: string
  uploaded_by: number
}

interface WorkRequestDetail {
  id: number
  request_no: string
  title: string
  description: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'reviewed'
  created_by: number
  created_at: string
  updated_at: string
  creator_name: string
  creator_dept: string
  assignments: Array<{ role: 'primary' | 'secondary'; user_id: number; name: string; position: string }>
  progressNotes: { waiting_for: string | null; blockers: string | null; start_date: string | null } | null
  completion: { completed_date: string; completed_time: string } | null
  review: { reviewed_by: number; satisfaction_score: number; comment: string | null; reviewer_name: string; reviewed_at: string } | null
  attachments: WorkAttachment[]
  history: Array<{ id: number; from_status: string | null; to_status: string; comment: string | null; changed_by: number; changed_at: string; changer_name: string; changer_position: string }>
}

type TabType = 'pending' | 'history' | 'work'

export default function ApprovalsInboxClient() {
  const [tickets, setTickets] = useState<ApprovalTicket[]>([])
  const [history, setHistory] = useState<ApprovalTicket[]>([])
  const [workTickets, setWorkTickets] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [comments, setComments] = useState<Record<number, string>>({})
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [userPosition, setUserPosition] = useState<string>('')
  const [currentMemberId, setCurrentMemberId] = useState<number>(0)
  const [currentMemberRole, setCurrentMemberRole] = useState<string>('')

  const WORK_AUTHORIZED_POSITIONS = [
    'เจ้าพนักงานเครื่องคอมพิวเตอร์',
    'นักวิชาการคอมพิวเตอร์',
    'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
    'ผู้อำนวยการ',
  ]

  // PR approvals details states
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<PRDetail | null>(null)
  const [detailApprovals, setDetailApprovals] = useState<ApprovalStep[]>([])

  // Track Work system states
  const searchParams = useSearchParams()
  const workIdParam = searchParams.get('workId')

  const [isWorkOpen, setIsWorkOpen] = useState(false)
  const [workLoading, setWorkLoading] = useState(false)
  const [selectedWork, setSelectedWork] = useState<WorkRequestDetail | null>(null)
  
  // Phase 2 - Assignment form states
  const [staffList, setStaffList] = useState<Array<{ id: number; name: string; position: string }>>([])
  const [primaryAssignee, setPrimaryAssignee] = useState<number>(0)
  const [secondaryAssignees, setSecondaryAssignees] = useState<number[]>([])

  // Phase 3 - Progress notes form states
  const [waitingFor, setWaitingFor] = useState('')
  const [blockers, setBlockers] = useState('')
  const [startDate, setStartDate] = useState('')

  // Phase 4 - Completion form states
  const [completedDate, setCompletedDate] = useState('')
  const [completedTime, setCompletedTime] = useState('')

  // Phase 5 - Review states
  const [satisfactionScore, setSatisfactionScore] = useState<number>(5)
  const [reviewComment, setReviewComment] = useState('')

  // Rollback states
  const [showRollbackForm, setShowRollbackForm] = useState(false)
  const [rollbackComment, setRollbackComment] = useState('')

  const [phaseAttachments, setPhaseAttachments] = useState<Array<{ name: string; type: 'image' | 'pdf'; path: string }>>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบสั่งงานผลิตสื่อ-PR-${selectedDetail?.id?.toString().padStart(4, '0') ?? ''}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: 'TH Sarabun New', 'THSarabunNew', 'Sarabun', sans-serif; color: #000; background: #fff !important; }
      @media print {
        .no-print {
          display: none !important;
        }
        .only-print {
          display: block !important;
        }
        .only-print-block {
          display: block !important;
        }
      }
    `,
  })

  const getActiveWorkCount = () => {
    const canSeeAll = currentMemberRole === 'admin' || userPosition.includes('ดิจิทัลทางการแพทย์')
    return workTickets.filter(w => {
      const isCreator = w.created_by === currentMemberId
      let assigneesList = []
      if (Array.isArray(w.assignees)) {
        assigneesList = w.assignees
      } else {
        try {
          assigneesList = w.assignees ? JSON.parse(w.assignees) : []
        } catch (e) {}
      }
      const isAssigned = assigneesList.some((a: any) => a.id === currentMemberId || a.user_id === currentMemberId)

      if (w.status === 'pending' && canSeeAll) return true
      if (w.status === 'completed' && isCreator) return true
      if ((w.status === 'assigned' || w.status === 'in_progress') && isAssigned) return true
      return false
    }).length
  }

  useEffect(() => { 
    fetchApprovals() 
    fetchStaffList()
  }, [])

  useEffect(() => {
    if (workIdParam) {
      openWorkDetail(parseInt(workIdParam))
    }
  }, [workIdParam])

  const fetchApprovals = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/approvals')
      const data = await res.json()
      if (data.success) {
        setTickets(data.tickets || [])
        setHistory(data.history || [])
        setUserPosition(data.position || '')
      }

      // Fetch user profile info to get ID and role
      const meRes = await fetch('/api/member/me')
      if (meRes.ok) {
        const meData = await meRes.json()
        if (meData.authenticated && meData.member) {
          setCurrentMemberId(meData.member.id)
          setCurrentMemberRole(meData.member.role)
        }
      }
      // Fetch work requests
      const workRes = await fetch('/api/member/work')
      if (workRes.ok) {
        const workData = await workRes.json()
        if (workData.success) {
          setWorkTickets(workData.workRequests || [])
        }
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'ไม่สามารถเชื่อมต่อข้อมูลรายการได้')
    } finally {
      setLoading(false)
    }
  }

  const fetchStaffList = async () => {
    try {
      const res = await fetch('/api/member/work/assignees')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setStaffList(data.staff || [])
        }
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err)
    }
  }

  const openWorkDetail = async (workId: number) => {
    setIsWorkOpen(true)
    setWorkLoading(true)
    setSelectedWork(null)
    setPhaseAttachments([])
    setShowRollbackForm(false)
    setRollbackComment('')
    setReviewComment('')
    setWaitingFor('')
    setBlockers('')
    setStartDate('')
    setCompletedDate('')
    setCompletedTime('')

    try {
      const res = await fetch(`/api/member/work/${workId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const wr = data.workRequest
          setSelectedWork(wr)
          
          // Prefill assignees
          const prim = wr.assignments.find((a: any) => a.role === 'primary')
          if (prim) setPrimaryAssignee(prim.user_id)
          
          const secs = wr.assignments.filter((a: any) => a.role === 'secondary').map((a: any) => a.user_id)
          setSecondaryAssignees(secs)

          // Prefill progress notes
          if (wr.progressNotes) {
            setWaitingFor(wr.progressNotes.waiting_for || '')
            setBlockers(wr.progressNotes.blockers || '')
            if (wr.progressNotes.start_date) {
              setStartDate(new Date(wr.progressNotes.start_date).toISOString().split('T')[0])
            }
          }

          // Prefill completion info
          if (wr.completion) {
            if (wr.completion.completed_date) {
              setCompletedDate(new Date(wr.completion.completed_date).toISOString().split('T')[0])
            }
            setCompletedTime(wr.completion.completed_time || '')
          }
        } else {
          showStatus('error', data.error || 'ดึงรายละเอียดงานไม่สำเร็จ')
          setIsWorkOpen(false)
        }
      } else {
        showStatus('error', 'ไม่สามารถดึงรายละเอียดงานได้')
        setIsWorkOpen(false)
      }
    } catch (err) {
      console.error('Open work request detail error:', err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      setIsWorkOpen(false)
    } finally {
      setWorkLoading(false)
    }
  }

  const handleWorkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, phaseNum: number) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingFile(true)
    const imageCount = phaseAttachments.filter(a => a.type === 'image').length
    const pdfCount = phaseAttachments.filter(a => a.type === 'pdf').length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isPdf = file.type === 'application/pdf'
      const type = isPdf ? 'pdf' : 'image'

      if (isPdf && pdfCount + 1 > 10) {
        alert('แนบไฟล์ PDF ได้สูงสุด 10 ไฟล์')
        continue
      }
      if (!isPdf && imageCount + 1 > 20) {
        alert('แนบรูปภาพได้สูงสุด 20 รูป')
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', `work-phase-${phaseNum}`)

      try {
        const res = await fetch('/api/member/upload', {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setPhaseAttachments(prev => [...prev, { name: data.filename, type, path: data.url }])
          }
        }
      } catch (err) {
        console.error('File upload error:', err)
      }
    }
    setUploadingFile(false)
    e.target.value = ''
  }

  const handleWorkRemoveAttachment = async (pathToRemove: string) => {
    try {
      const res = await fetch(`/api/member/upload?path=${encodeURIComponent(pathToRemove)}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPhaseAttachments(prev => prev.filter(a => a.path !== pathToRemove))
      }
    } catch (err) {
      console.error('Remove file error:', err)
    }
  }

  const submitWorkPhase = async (phaseNum: number) => {
    if (!selectedWork) return
    setWorkLoading(true)

    const payload: any = { phase: phaseNum }

    if (phaseNum === 2) {
      const assignees = []
      if (primaryAssignee > 0) {
        assignees.push({ userId: primaryAssignee, role: 'primary' })
      } else {
        alert('กรุณาระบุผู้รับผิดชอบหลัก')
        setWorkLoading(false)
        return
      }
      for (const sId of secondaryAssignees) {
        assignees.push({ userId: sId, role: 'secondary' })
      }
      payload.assignees = assignees
    } else if (phaseNum === 3) {
      payload.waitingFor = waitingFor
      payload.blockers = blockers
      payload.startDate = startDate || null
      payload.attachments = phaseAttachments
    } else if (phaseNum === 4) {
      if (!completedDate || !completedTime) {
        alert('กรุณากรอกวันที่และเวลาเสร็จสิ้น')
        setWorkLoading(false)
        return
      }
      payload.completedDate = completedDate
      payload.completedTime = completedTime
      payload.attachments = phaseAttachments
    }

    try {
      const res = await fetch(`/api/member/work/${selectedWork.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', data.message || 'บันทึกสถานะงานเรียบร้อยแล้ว')
        // Refresh details
        openWorkDetail(selectedWork.id)
      } else {
        showStatus('error', data.error || 'การบันทึกล้มเหลว')
      }
    } catch (err) {
      console.error('Submit phase error:', err)
      showStatus('error', 'เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด')
    } finally {
      setWorkLoading(false)
    }
  }

  const submitWorkReview = async () => {
    if (!selectedWork) return
    setWorkLoading(true)

    try {
      const res = await fetch(`/api/member/work/${selectedWork.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfactionScore, comment: reviewComment })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', 'ประเมินและปิดงานสมบูรณ์เรียบร้อยแล้ว')
        openWorkDetail(selectedWork.id)
      } else {
        showStatus('error', data.error || 'การประเมินผิดพลาด')
      }
    } catch (err) {
      console.error('Submit review error:', err)
      showStatus('error', 'เชื่อมต่อผิดพลาด')
    } finally {
      setWorkLoading(false)
    }
  }

  const submitWorkRollback = async () => {
    if (!selectedWork) return
    if (!rollbackComment.trim()) {
      alert('กรุณากรอกเหตุผลในการถอยสถานะงาน')
      return
    }
    setWorkLoading(true)

    try {
      const res = await fetch(`/api/member/work/${selectedWork.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rollbackComment })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', 'ถอยสถานะงานกลับไปเป็น In Progress สำเร็จ')
        openWorkDetail(selectedWork.id)
      } else {
        showStatus('error', data.error || 'การถอยสถานะงานล้มเหลว')
      }
    } catch (err) {
      console.error('Submit rollback error:', err)
      showStatus('error', 'เชื่อมต่อผิดพลาด')
    } finally {
      setWorkLoading(false)
    }
  }

  const openDetail = async (sourceId: number) => {
    setIsDetailOpen(true)
    setDetailLoading(true)
    setSelectedDetail(null)
    setDetailApprovals([])
    try {
      const res = await fetch(`/api/pr-requests/detail?id=${sourceId}`)
      const data = await res.json()
      if (data.success) {
        setSelectedDetail(data.request)
        setDetailApprovals(data.approvals || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusMsg({ type, message })
    setTimeout(() => setStatusMsg(null), 5000)
  }

  const handleAction = async (ticketId: number, status: 'APPROVED' | 'REJECTED') => {
    if (processingId) return
    if (status === 'REJECTED' && !comments[ticketId]?.trim()) {
      showStatus('error', 'กรุณาระบุความคิดเห็น / เหตุผลกรณีปฏิเสธการอนุมัติ')
      return
    }
    const actionText = status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'
    if (!confirm(`ยืนยันว่าต้องการ "${actionText}" รายการนี้ใช่หรือไม่?`)) return

    try {
      setProcessingId(ticketId)
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status, comment: comments[ticketId] || null }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', `ดำเนินการ${actionText}และประทับตราลายเซ็นเรียบร้อยแล้ว`)
        // Move ticket from pending to history list
        const acted = tickets.find(t => t.id === ticketId)
        if (acted) {
          setHistory(prev => [
            { ...acted, status, approved_at: new Date().toISOString() },
            ...prev,
          ])
        }
        setTickets(prev => prev.filter(t => t.id !== ticketId))
        if (isDetailOpen) setIsDetailOpen(false)
      } else {
        showStatus('error', data.error || 'การดำเนินการไม่สำเร็จ')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setProcessingId(null)
    }
  }

  const handleCommentChange = (ticketId: number, val: string) =>
    setComments(prev => ({ ...prev, [ticketId]: val }))

  const getUrgencyClass = (urgency: string) => {
    if (urgency === 'ด่วนที่สุด') return 'critical'
    if (urgency === 'ด่วน') return 'urgent'
    return 'normal'
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear() + 543}`
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'รอการมอบหมาย'
      case 'assigned': return 'มอบหมายแล้ว'
      case 'in_progress': return 'กำลังดำเนินการ'
      case 'completed': return 'เสร็จสิ้นรอประเมิน'
      case 'reviewed': return 'ประเมินแล้ว/ปิดงาน'
      default: return status
    }
  }

  const parseJsonList = (jsonStr: any): string[] => {
    if (!jsonStr) return []
    if (Array.isArray(jsonStr)) return jsonStr
    try {
      return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : []
    } catch {
      return []
    }
  }

  // ---- Pending Card ----
  const renderPendingCard = (t: ApprovalTicket) => {
    const urgencyClass = getUrgencyClass(t.req_urgency)
    return (
      <div key={t.id} className="approvalItemCard">
        <div className={`cardBand ${urgencyClass}`} />
        <div className="cardBody">
          <div className="approvalMetaHeader">
            <span className="positionTag">
              {t.assigned_position}
            </span>
            <span className="stepTag">ขั้นที่ {t.step_number}</span>
            <span className={`urgencyBadge ${urgencyClass}`}>{t.req_urgency}</span>
            <span className={`costBadge ${t.has_cost ? 'hasCost' : 'noCost'}`}>
              {t.has_cost ? '● มีค่าใช้จ่าย' : '● ไม่มีค่าใช้จ่าย'}
            </span>
          </div>
          <h3 className="approvalTitle">{t.req_title}</h3>
          <div className="approvalMeta">
            <span className="metaItem"><User size={13} className="metaIcon" />ผู้ขอ: <strong>{t.requester_name}</strong></span>
            <span className="metaItem"><Building2 size={13} className="metaIcon" />หน่วยงาน: <strong>{t.requester_dept || '—'}</strong></span>
          </div>
          <div className="approvalDate">
            <Calendar size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            ส่งคำขอเมื่อ: {formatDate(t.req_created_at)}
          </div>
          <div className="commentSection">
            <div className="commentLabel">
              ความคิดเห็น / หมายเหตุ
              <span className="commentRequired">* จำเป็นเมื่อปฏิเสธ</span>
            </div>
            <input
              type="text"
              className="commentInput"
              placeholder="ระบุเหตุผลหรือหมายเหตุเพิ่มเติม..."
              value={comments[t.id] || ''}
              onChange={(e) => handleCommentChange(t.id, e.target.value)}
            />
          </div>
        </div>
        <div className="cardFooter">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="detailBtn" onClick={() => openDetail(t.source_id)}>
              <Eye size={14} />ดูรายละเอียด
            </button>
            {t.assigned_position === 'นักประชาสัมพันธ์' && t.step_number === 1 && (
              <Link 
                href={`/member/pr-requests/${t.source_id}/edit`}
                className="detailBtn" 
                style={{ 
                  backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                  color: '#b45309', 
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none'
                }}
              >
                แก้ไขรายละเอียด
              </Link>
            )}
          </div>
          <div className="actionBtns">
            <button onClick={() => handleAction(t.id, 'REJECTED')} disabled={processingId !== null} className="rejectBtn">
              <X size={15} />ปฏิเสธ
            </button>
            <button onClick={() => handleAction(t.id, 'APPROVED')} disabled={processingId !== null} className="approveBtn">
              {processingId === t.id ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
              {t.assigned_position === 'นักประชาสัมพันธ์' ? 'อนุมัติ' : 'ลงนามอนุมัติ'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- History Card ----
  const renderHistoryCard = (t: ApprovalTicket) => {
    const isApproved = t.status === 'APPROVED'
    const urgencyClass = getUrgencyClass(t.req_urgency)
    return (
      <div key={t.id} className={`historyCard ${isApproved ? 'histApproved' : 'histRejected'}`}>
        <div className="histCardLeft">
          <div className={`histStatusIcon ${isApproved ? 'approved' : 'rejected'}`}>
            {isApproved ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          </div>
        </div>
        <div className="histCardBody">
          <div className="histMetaRow">
            <span className="positionTag">
              {t.assigned_position}
            </span>
            <span className="stepTag">ขั้นที่ {t.step_number}</span>
            <span className={`urgencyBadge ${urgencyClass}`}>{t.req_urgency}</span>
            <span className={`histStatusBadge ${isApproved ? 'approved' : 'rejected'}`}>
              {isApproved ? '✓ อนุมัติแล้ว' : '✕ ปฏิเสธ'}
            </span>
          </div>
          <div className="histTitle">{t.req_title}</div>
          <div className="histMeta">
            <span className="metaItem"><User size={12} className="metaIcon" />ผู้ขอ: <strong>{t.requester_name}</strong></span>
            <span className="metaItem"><Building2 size={12} className="metaIcon" />หน่วยงาน: <strong>{t.requester_dept || '—'}</strong></span>
          </div>
          {t.comment && (
            <div className="histComment">
              <span className="histCommentLabel">ความเห็น:</span> {t.comment}
            </div>
          )}
        </div>
        <div className="histCardRight">
          <div className="histDate">
            <Clock size={11} />
            {t.approved_at ? formatDate(t.approved_at) : '—'}
          </div>
          <button className="detailBtn" style={{ marginTop: '8px' }} onClick={() => openDetail(t.source_id)}>
            <Eye size={13} />ดูเอกสาร
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="approvalsContainer">
      <Link href="/member" className="backLink">
        <ArrowLeft size={14} />กลับหน้าหลักสมาชิก
      </Link>

      <div className="pageHeader">
        <div className="pageHeaderText">
          <h1>กล่องงานรอการอนุมัติ</h1>
          <p className="pageSubtitle">รายการเอกสารที่รอลายเซ็นดิจิทัลของคุณ</p>
        </div>
        {!loading && tickets.length > 0 && (
          <div className="ticketCount">
            <ShieldCheck size={14} />
            รอดำเนินการ {tickets.length} รายการ
          </div>
        )}
      </div>

      {statusMsg && (
        <div className={`statusMessage ${statusMsg.type === 'success' ? 'statusSuccess' : 'statusError'}`}>
          {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabBar">
        <button
          className={`tabBtn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <Inbox size={15} />
          รออนุมัติ
          {tickets.length > 0 && <span className="tabBadge">{tickets.length}</span>}
        </button>
        <button
          className={`tabBtn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={15} />
          ประวัติการดำเนินการ
          {(history.length + workTickets.filter(w => w.status === 'reviewed').length) > 0 && (
            <span className="tabBadge neutral">{history.length + workTickets.filter(w => w.status === 'reviewed').length}</span>
          )}
        </button>
        {WORK_AUTHORIZED_POSITIONS.includes(userPosition) && (
          <button
            className={`tabBtn ${activeTab === 'work' ? 'active' : ''}`}
            onClick={() => setActiveTab('work')}
          >
            <Laptop size={15} />
            งานช่างฯ ที่ได้รับมอบหมาย
            {getActiveWorkCount() > 0 && <span className="tabBadge">{getActiveWorkCount()}</span>}
          </button>
        )}
      </div>

      {loading ? (
        <div className="loadingWrap">
          <Loader2 className="animate-spin" size={36} style={{ color: '#0d9488' }} />
          <span>กำลังโหลดรายการ...</span>
        </div>
      ) : activeTab === 'pending' ? (
        tickets.length > 0 ? (
          <div className="approvalsList">{tickets.map(renderPendingCard)}</div>
        ) : (
          <div className="emptyState">
            <div className="emptyIconWrap"><Shield size={32} /></div>
            <h3>ไม่มีเอกสารรออนุมัติ</h3>
            <p>กล่องงานรอการอนุมัติว่างเปล่า ขณะนี้ไม่มีรายการที่รอการลงนามของคุณ</p>
          </div>
        )
      ) : activeTab === 'work' ? (
        workTickets.filter((w: any) => w.status !== 'reviewed').length > 0 ? (
          <div className="approvalsList">
            {workTickets.filter((w: any) => w.status !== 'reviewed').map((w: any) => {
              const creatorName = w.creator_name || 'ไม่ระบุผู้ส่ง'
              const dateStr = new Date(w.created_at).toLocaleDateString('th-TH')
              const statusColorMap: Record<string, string> = {
                pending: '#8892b0',
                assigned: '#2563eb',
                in_progress: '#ea580c',
                completed: '#059669',
                reviewed: '#0d9488'
              }
              const cardBandClass = w.status === 'pending' || w.status === 'assigned' ? 'urgent' : w.status === 'in_progress' ? 'critical' : 'normal'
              
              return (
                <div key={w.id} className="approvalItemCard">
                  <div className={`cardBand ${cardBandClass}`}></div>
                  <div className="cardBody" style={{ padding: '20px 24px' }}>
                    <div className="approvalMetaHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span className="sourceTag" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
                        งานช่างฯ
                      </span>
                      <span className="status-badge" style={{ 
                        display: 'inline-flex', 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        backgroundColor: `${statusColorMap[w.status]}15`, 
                        color: statusColorMap[w.status],
                        border: `1.5px solid ${statusColorMap[w.status]}30` 
                      }}>
                        {getStatusLabel(w.status)}
                      </span>
                    </div>
                    <h3 className="approvalTitle" style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                      {w.title}
                    </h3>
                    <div className="approvalMeta" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <span className="metaItem" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
                        <User size={13} className="metaIcon" style={{ color: '#94a3b8' }} />
                        ผู้ส่งคำขอ: <strong style={{ color: '#0f172a' }}>{creatorName}</strong>
                      </span>
                      <span className="metaItem" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
                        <Calendar size={13} className="metaIcon" style={{ color: '#94a3b8' }} />
                        วันที่สร้าง: <strong style={{ color: '#0f172a' }}>{dateStr}</strong>
                      </span>
                    </div>
                    <div className="cardActionRow" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                      <button className="detailBtn highlightBtn" onClick={() => openWorkDetail(w.id)} style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        background: '#0d9488',
                        color: '#ffffff',
                        border: '1px solid #0d9488',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
                        transition: 'all 0.2s ease'
                      }}>
                        จัดการงาน
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="emptyState">
            <div className="emptyIconWrap"><Laptop size={32} /></div>
            <h3>ไม่มีรายงานมอบหมายงาน</h3>
            <p>ขณะนี้ยังไม่มีรายการคำของานช่างฯ ค้างรับผิดชอบอยู่</p>
          </div>
        )
      ) : (
        (() => {
          const closedWorks = workTickets.filter((w: any) => w.status === 'reviewed')
          const hasHistory = history.length > 0 || closedWorks.length > 0
          
          if (!hasHistory) {
            return (
              <div className="emptyState">
                <div className="emptyIconWrap" style={{ background: '#f8fafc' }}>
                  <History size={32} style={{ color: '#64748b' }} />
                </div>
                <h3>ยังไม่มีประวัติการดำเนินการ</h3>
                <p>รายการที่คุณอนุมัติ ปฏิเสธ หรือประเมินปิดงานเรียบร้อยแล้วจะแสดงที่นี่</p>
              </div>
            )
          }

          // Combine and sort chronologically by update/approved date
          const combined = [
            ...history.map(h => ({ ...h, historyType: 'pr' })),
            ...closedWorks.map(w => ({ ...w, historyType: 'work' }))
          ].sort((a: any, b: any) => {
            const dateA = new Date(a.historyType === 'pr' ? (a.approved_at || a.created_at) : (a.review?.reviewed_at || a.updated_at || a.created_at)).getTime()
            const dateB = new Date(b.historyType === 'pr' ? (b.approved_at || b.created_at) : (b.review?.reviewed_at || b.updated_at || b.created_at)).getTime()
            return dateB - dateA
          })

          return (
            <div className="historyList">
              {combined.map((item: any) => {
                if (item.historyType === 'pr') {
                  return renderHistoryCard(item)
                } else {
                  const creatorName = item.creator_name || 'ไม่ระบุผู้ส่ง'
                  const dateStr = new Date(item.created_at).toLocaleDateString('th-TH')
                  return (
                    <div key={`work-hist-${item.id}`} className="approvalItemCard" style={{ opacity: 0.85 }}>
                      <div className="cardBand normal"></div>
                      <div className="cardBody" style={{ padding: '20px 24px' }}>
                        <div className="approvalMetaHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span className="sourceTag" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
                            งานช่างฯ (ปิดงานแล้ว)
                          </span>
                          <span className="status-badge" style={{ 
                            display: 'inline-flex', 
                            padding: '3px 10px', 
                            borderRadius: '20px', 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            backgroundColor: 'rgba(13, 148, 136, 0.1)', 
                            color: '#0d9488',
                            border: '1.5px solid rgba(13, 148, 136, 0.3)' 
                          }}>
                            {getStatusLabel(item.status)}
                          </span>
                        </div>
                        <h3 className="approvalTitle" style={{ fontSize: '17px', fontWeight: 700, color: '#475569', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                          {item.title}
                        </h3>
                        <div className="approvalMeta" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          <span className="metaItem" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                            <User size={13} className="metaIcon" style={{ color: '#94a3b8' }} />
                            ผู้ส่งคำขอ: <strong>{creatorName}</strong>
                          </span>
                          <span className="metaItem" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                            <Calendar size={13} className="metaIcon" style={{ color: '#94a3b8' }} />
                            วันที่สร้าง: <strong>{dateStr}</strong>
                          </span>
                        </div>
                        <div className="cardActionRow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                          <span style={{ fontSize: '12.5px', color: '#0d9488', fontWeight: 600 }}>✓ เสร็จสมบูรณ์และประเมินผลแล้ว</span>
                          <button className="detailBtn" onClick={() => openWorkDetail(item.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            ดูรายละเอียด
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }
              })}
            </div>
          )
        })()
      )}

      {/* ===== Detail Modal ===== */}
      {isDetailOpen && (
        <div className="detailOverlay" onClick={() => setIsDetailOpen(false)}>
          <div className="detailModal" onClick={(e) => e.stopPropagation()}>
            <div className="detailModalHeader">
              <div>
                <h2>รายละเอียดคำขอ</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>ตรวจสอบข้อมูลก่อนลงนาม</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {selectedDetail && (
                  <button className="printDetailBtn" onClick={() => handlePrint()}>
                    <Printer size={15} />พิมพ์
                  </button>
                )}
                <button className="detailCloseBtn" onClick={() => setIsDetailOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="detailModalBody">
              {detailLoading ? (
                <div className="loadingWrap">
                  <Loader2 className="animate-spin" size={32} style={{ color: '#0d9488' }} />
                  <span>กำลังโหลดข้อมูล...</span>
                </div>
              ) : selectedDetail ? (
                <div className="printTemplate" ref={printRef}>
                  <div className="docHeader">
                    <div className="docHeaderLeft">
                      <img src="/images/common/logo-website.webp" alt="โลโก้โรงพยาบาลเถิน" className="docHospitalLogo" />
                      <div>
                        <div className="docHospitalName">โรงพยาบาลเถิน</div>
                        <div className="docHospitalSub">กลุ่มงานดิจิทัลทางการแพทย์ · จังหวัดลำปาง</div>
                      </div>
                    </div>
                    <div className="docHeaderRight">
                      <div className="docDocTitle">ใบสั่งงานผลิตสื่อประชาสัมพันธ์</div>
                      <div className="docDocId">เลขที่: PR-{String(selectedDetail.id).padStart(4, '0')}</div>
                      <div className="docDocDate">วันที่: {formatDateShort(selectedDetail.created_at)}</div>
                    </div>
                  </div>
                  <div className="docDividerThick"></div>
                  <div className="docMetaRow">
                    <div className="docUrgencyGroup">
                      <span className="docFieldLabel">ระดับความเร่งด่วน:</span>
                      {['ด่วนที่สุด', 'ด่วน', 'ไม่ด่วน'].map(u => (
                        <span key={u} className={`docCheckItem ${selectedDetail.urgency === u ? 'checked' : ''}`}>
                          <span className="docCheckBox">{selectedDetail.urgency === u ? '✓' : ''}</span> {u}
                        </span>
                      ))}
                    </div>
                    <div className={`docCostTag ${selectedDetail.has_cost ? 'cost' : 'free'}`}>
                      {selectedDetail.has_cost ? '● มีค่าใช้จ่าย' : '● ไม่มีค่าใช้จ่าย'}
                    </div>
                  </div>
                  <div className="docSection">
                    <div className="docSectionLabel">เรื่อง</div>
                    <div className="docSectionContent docSubjectText">{selectedDetail.title}</div>
                  </div>
                  <div className="docTwoCol">
                    <div className="docSection">
                      <div className="docSectionLabel">วันที่สั่งงาน</div>
                      <div className="docSectionContent">{formatDateShort(selectedDetail.order_date)}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">วันที่ขอรับงาน</div>
                      <div className="docSectionContent">{formatDateShort(selectedDetail.target_date)}</div>
                    </div>
                  </div>
                  <div className="docDivider"></div>
                  <div className="docSection">
                    <div className="docSectionLabel">ลักษณะงานที่ขอผลิต</div>
                    <div className="docCheckGrid">
                      {['แผ่นพับ 3 พับ', 'บัตรพนักงาน', 'ตัดต่อวิดีโอ', 'AW ขึ้นเว็บไซต์', 'ป้ายประกาศ', 'Power Point', 'สติ๊กเกอร์'].map(type => {
                        const isChecked = parseJsonList(selectedDetail.job_type).includes(type)
                        return (
                          <span key={type} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {type}
                          </span>
                        )
                      })}
                      {(() => {
                        const list = parseJsonList(selectedDetail.job_type)
                        const item = list.find(t => t.startsWith('โปสเตอร์ขนาด'))
                        const isChecked = !!item
                        const size = item ? item.replace('โปสเตอร์ขนาด', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                            โปสเตอร์ขนาด{isChecked ? ` ${size}` : ''}
                          </span>
                        )
                      })()}
                      {selectedDetail.job_type_other && (
                        <span className="docCheckItem checked">
                          <span className="docCheckBox">✓</span> อื่นๆ: {selectedDetail.job_type_other}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="docSection">
                    <div className="docSectionLabel">รายละเอียดความต้องการ</div>
                    <div className="docDetailsBox">{selectedDetail.details || 'ไม่ได้ระบุ'}</div>
                  </div>

                  {selectedDetail.attachments && selectedDetail.attachments.length > 0 && (
                    <div className="docSection no-print" style={{ marginTop: '8px' }}>
                      <div className="docSectionLabel">ไฟล์แนบเพิ่มเติม</div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '4px',
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px'
                      }}>
                        {selectedDetail.attachments.map((file, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                            <span>{file.filename.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#0d9488',
                                textDecoration: 'underline',
                                fontWeight: 600,
                              }}
                            >
                              {file.filename}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="docDivider"></div>
                  <div className="docSection">
                    <div className="docSectionLabel">ช่องทางเผยแพร่</div>
                    <div className="docCheckGrid">
                      {['สื่อโซเชียลของ รพ.', 'Page facebook'].map(ch => {
                        const isChecked = parseJsonList(selectedDetail.channels).includes(ch)
                        return (
                          <span key={ch} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {ch}
                          </span>
                        )
                      })}
                      {(() => {
                        const list = parseJsonList(selectedDetail.channels)
                        const item = list.find(c => c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))
                        const isChecked = !!item
                        const val = item ? item.replace('ในอาคารโรงพยาบาลบริเวณ', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                            ในอาคารโรงพยาบาลบริเวณ{isChecked ? ` ${val}` : ''}
                          </span>
                        )
                      })()}
                      {(() => {
                        const list = parseJsonList(selectedDetail.channels)
                        const item = list.find(c => c.startsWith('ในชุมชน'))
                        const isChecked = !!item
                        const val = item ? item.replace('ในชุมชน', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                            ในชุมชน{isChecked ? ` ${val}` : ''}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="docDivider"></div>
                  <div className="docThreeCol">
                    <div className="docSection">
                      <div className="docSectionLabel">ผู้ขอสั่งผลิต</div>
                      <div className="docSectionContent">{selectedDetail.requester_name || '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">กลุ่มงาน / หน่วยงาน</div>
                      <div className="docSectionContent">{selectedDetail.requester_dept || selectedDetail.department || '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">เบอร์โทรติดต่อ</div>
                      <div className="docSectionContent">{selectedDetail.phone || '—'}</div>
                    </div>
                  </div>
                  <div className="docDividerThick"></div>
                  <div className="docSigTitle">การลงนามอนุมัติ</div>
                  <div className="docSignatureRow">
                    {detailApprovals
                      .filter(step => !step.assigned_position.includes('นักประชาสัมพันธ์'))
                      .map((step, idx) => {
                      const isApproved = step.status === 'APPROVED'
                      const isSigned = isApproved && step.signature_path
                      const isRejected = step.status === 'REJECTED'
                      return (
                        <div key={step.id} className={`docSigBox ${isSigned ? 'signed' : ''} ${isRejected ? 'rejected' : ''}`}>
                          <div className="docSigImageArea">
                            {isSigned ? (
                              <img src={`/api/signatures/image?userId=${step.current_approver_id}&t=${Date.now()}`} alt="ลายเซ็น" className="docSigImage" />
                            ) : isApproved ? (
                              <div className="docSigApproved">✓ อนุมัติแล้ว</div>
                            ) : isRejected ? (
                              <div className="docSigRejected">✕ ไม่อนุมัติ</div>
                            ) : (
                              <div className="docSigEmpty"></div>
                            )}
                          </div>
                          <div className="docSigLine"></div>
                          <div className="docSigName">
                            {step.approver_name ? `( ${step.approver_name} )` : '(...........................)'}
                          </div>
                          <div
                            className="docSigPosition"
                            style={step.assigned_position === 'ผู้อำนวยการโรงพยาบาลเถิน' ? { whiteSpace: 'nowrap', wordBreak: 'keep-all' } : {}}
                          >
                            ตำแหน่ง {step.assigned_position}
                          </div>
                          {step.approved_at && <div className="docSigDate">วันที่: {formatDateShort(step.approved_at)}</div>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="docFooterNotes">
                    <div className="docNotesTitle">หมายเหตุ :</div>
                    <ol className="docNotesList">
                      <li>งานที่สั่งจะดำเนินการให้ตามลำดับคิวก่อนหลัง</li>
                      <li>กรุณากรอกแบบฟอร์มรายละเอียดให้ครบถ้วนเพื่อความรวดเร็วในการผลิต</li>
                    </ol>
                  </div>

                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ===== Track Work Details Modal (Phases 2-5) ===== */}
      {isWorkOpen && (
        <div className="detailOverlay" onClick={() => setIsWorkOpen(false)}>
          <div className="detailModal workDetailModal" onClick={(e) => e.stopPropagation()}>
            <div className="detailModalHeader">
              <div>
                <h2>{selectedWork ? `ติดตามงาน: ${selectedWork.request_no}` : 'รายละเอียดงาน'}</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>ติดตามความคืบหน้า มอบหมายงาน และประเมินผลการดำเนินการ</p>
              </div>
              <button className="detailCloseBtn" onClick={() => setIsWorkOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="detailModalBody">
              {workLoading ? (
                <div className="loadingWrap">
                  <Loader2 className="animate-spin" size={32} style={{ color: '#0d9488' }} />
                  <span>กำลังโหลดข้อมูลงาน...</span>
                </div>
              ) : selectedWork ? (
                <div className="workDetailGrid">
                  
                  {/* Left Column: Work Details, Attachments & Timeline */}
                  <div className="workDetailLeft">
                    <div className="workInfoCard">
                      <div className="workInfoCard__header">
                        <span className={`status-badge status-${selectedWork.status}`}>
                          {getStatusLabel(selectedWork.status)}
                        </span>
                        <span className="workInfoCard__date">
                          สร้างเมื่อ: {formatDate(selectedWork.created_at)}
                        </span>
                      </div>
                      <h2 className="workInfoCard__title">{selectedWork.title}</h2>
                      <div className="workInfoCard__creator">
                        <strong>ผู้ส่งคำขอ:</strong> {selectedWork.creator_name} ({selectedWork.creator_dept || 'ไม่ระบุกลุ่มงาน'})
                      </div>
                      
                      <div className="workInfoCard__section">
                        <h4>รายละเอียดความต้องการ</h4>
                        <div className="workInfoCard__desc-box">
                          {selectedWork.description}
                        </div>
                      </div>

                      {/* Phase 1 Attachments */}
                      {selectedWork.attachments.filter(a => a.phase === 1).length > 0 && (
                        <div className="workInfoCard__section">
                          <h4>ไฟล์แนบประกอบคำขอ</h4>
                          <div className="attachments-grid">
                            {selectedWork.attachments.filter(a => a.phase === 1).map(att => (
                              <div key={att.file_path} className="att-item-card">
                                <span>{att.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                                <a href={att.file_path} target="_blank" rel="noreferrer" className="att-item-link">
                                  {att.original_name}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Progress Notes Show (Phase 3) */}
                    {selectedWork.progressNotes && (
                      <div className="workInfoCard card-secondary">
                        <h4>บันทึกการดำเนินงาน</h4>
                        <div className="progress-details">
                          <p><strong>วันที่เริ่มงานจริง:</strong> {selectedWork.progressNotes.start_date ? new Date(selectedWork.progressNotes.start_date).toLocaleDateString('th-TH') : '—'}</p>
                          <p><strong>สิ่งที่กำลังรอคอย:</strong> {selectedWork.progressNotes.waiting_for || 'ไม่มี'}</p>
                          <p><strong>ปัญหาและอุปสรรค:</strong> {selectedWork.progressNotes.blockers || 'ไม่มี'}</p>
                        </div>
                        {selectedWork.attachments.filter(a => a.phase === 3).length > 0 && (
                          <div className="attachments-grid" style={{ marginTop: '10px' }}>
                            {selectedWork.attachments.filter(a => a.phase === 3).map(att => (
                              <div key={att.file_path} className="att-item-card">
                                <span>{att.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                                <a href={att.file_path} target="_blank" rel="noreferrer" className="att-item-link">
                                  {att.original_name}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completion Details Show (Phase 4) */}
                    {selectedWork.completion && (
                      <div className="workInfoCard card-secondary">
                        <h4>รายงานความเสร็จสมบูรณ์ของงาน</h4>
                        <div className="progress-details">
                          <p><strong>เสร็จเมื่อวันที่:</strong> {new Date(selectedWork.completion.completed_date).toLocaleDateString('th-TH')} เวลา {selectedWork.completion.completed_time} น.</p>
                        </div>
                        {selectedWork.attachments.filter(a => a.phase === 4).length > 0 && (
                          <div className="attachments-grid" style={{ marginTop: '10px' }}>
                            {selectedWork.attachments.filter(a => a.phase === 4).map(att => (
                              <div key={att.file_path} className="att-item-card">
                                <span>{att.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                                <a href={att.file_path} target="_blank" rel="noreferrer" className="att-item-link">
                                  {att.original_name}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review Rating Show (Phase 5) */}
                    {selectedWork.review && (
                      <div className="workInfoCard card-primary">
                        <h4>ผลการประเมินความพึงพอใจโดยหัวหน้ากลุ่มงาน</h4>
                        <div className="review-details">
                          <div className="stars-row" style={{ color: '#eab308', display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={20} fill={i < selectedWork.review!.satisfaction_score ? '#eab308' : 'none'} />
                            ))}
                          </div>
                          <p><strong>ข้อคิดเห็น:</strong> {selectedWork.review.comment || 'ไม่มีข้อคิดเห็นเพิ่มเติม'}</p>
                          <p className="text-muted" style={{ fontSize: '0.85rem' }}>ผู้ประเมิน: {selectedWork.review.reviewer_name} เมื่อ {formatDate(selectedWork.review.reviewed_at)}</p>
                        </div>
                      </div>
                    )}

                    {/* Status History Timeline */}
                    <div className="workTimeline">
                      <h4>บันทึกประวัติการเปลี่ยนสถานะ</h4>
                      <div className="timeline-steps">
                        {selectedWork.history.map(h => (
                          <div key={h.id} className="timeline-step">
                            <div className="timeline-marker"></div>
                            <div className="timeline-content">
                              <span className="timeline-time">{formatDate(h.changed_at)}</span>
                              <p className="timeline-status">
                                {h.from_status ? `${getStatusLabel(h.from_status)}` : 'เริ่มขั้นตอนดำเนินการ'} ➔ <strong>{getStatusLabel(h.to_status)}</strong>
                              </p>
                              {h.comment && <p className="timeline-comment">"{h.comment}"</p>}
                              <span className="timeline-user">{h.changer_name} ({h.changer_position || 'ไม่ระบุตำแหน่ง'})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rollback status for Dept Head (Moved here under details) */}
                    {(selectedWork.status === 'completed' || selectedWork.status === 'reviewed') && 
                     (currentMemberRole === 'admin' || userPosition.includes('ดิจิทัลทางการแพทย์')) && (
                      <div className="rollbackFormBox" style={{ marginTop: '1.25rem' }}>
                        {!showRollbackForm ? (
                          <button 
                            className="btn btn-outline btn-block" 
                            style={{ 
                              borderColor: '#e11d48', 
                              color: '#e11d48',
                              background: 'rgba(225, 29, 72, 0.03)',
                              padding: '10px 16px',
                              borderRadius: '10px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(225, 29, 72, 0.05)'
                            }}
                            onClick={() => setShowRollbackForm(true)}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#e11d48';
                              e.currentTarget.style.color = '#ffffff';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(225, 29, 72, 0.2)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(225, 29, 72, 0.03)';
                              e.currentTarget.style.color = '#e11d48';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(225, 29, 72, 0.05)';
                            }}
                          >
                            <XCircle size={16} /> สั่งแก้ไขงานใหม่ (ส่งกลับไปดำเนินการ)
                          </button>
                        ) : (
                          <div className="actionFormBox card border-danger" style={{ borderColor: '#fca5a5' }}>
                            <h3 className="text-danger">สั่งย้อนกลับไปดำเนินการใหม่</h3>
                            <div className="formGroup">
                              <label className="required-label">เหตุผลที่ต้องการให้แก้ไขงาน</label>
                              <textarea 
                                rows={3}
                                placeholder="ระบุสิ่งที่ต้องการให้แก้ไขเพิ่มเติมอย่างชัดเจน..."
                                value={rollbackComment}
                                onChange={e => setRollbackComment(e.target.value)}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowRollbackForm(false)}>
                                ยกเลิก
                              </button>
                              <button className="btn btn-primary" style={{ flex: 1, backgroundColor: '#dc2626' }} onClick={submitWorkRollback}>
                                ยืนยันย้อนกลับ
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions / Updates Form */}
                  <div className="workDetailRight">
                    
                    {/* Phase 2: Maim/Secondary Assignees Selection */}
                    {(selectedWork.status === 'pending' || selectedWork.status === 'assigned') && 
                     (currentMemberRole === 'admin' || userPosition.includes('นักวิชาการคอมพิวเตอร์') || userPosition.includes('เจ้าพนักงานเครื่องคอมพิวเตอร์')) && (
                      <div className="actionFormBox card">
                        <h3>การรับงานและมอบหมายงาน</h3>
                        <div className="formGroup">
                          <label className="required-label">ผู้รับผิดชอบหลัก (1 คน)</label>
                          <select 
                            value={primaryAssignee}
                            onChange={e => setPrimaryAssignee(parseInt(e.target.value))}
                          >
                            <option value="0">-- เลือกเจ้าหน้าที่ผู้รับผิดชอบหลัก --</option>
                            {staffList.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                            ))}
                          </select>
                        </div>

                        <div className="formGroup">
                          <label>ผู้ร่วมดำเนินงานเพิ่มเติม (เลือกได้หลายคน)</label>
                          <div className="checkbox-staff-list">
                            {staffList.filter(s => s.id !== primaryAssignee).map(s => (
                              <label key={s.id} className="checkbox-staff-item">
                                <input 
                                  type="checkbox"
                                  checked={secondaryAssignees.includes(s.id)}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSecondaryAssignees(prev => [...prev, s.id])
                                    } else {
                                      setSecondaryAssignees(prev => prev.filter(id => id !== s.id))
                                    }
                                  }}
                                />
                                <span>{s.name} ({s.position})</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <button className="btn btn-primary btn-block" onClick={() => submitWorkPhase(2)}>
                          <FileCheck size={16} /> บันทึกการมอบหมายงาน
                        </button>
                      </div>
                    )}

                    {/* Phase 3: Start Work / Progress updates */}
                    {(selectedWork.status === 'assigned' || selectedWork.status === 'in_progress') && 
                     (selectedWork.assignments.some(a => a.user_id === currentMemberId) || currentMemberRole === 'admin' || userPosition.includes('ดิจิทัลทางการแพทย์')) && (
                      <div className="actionFormBox card">
                        <h3>อัปเดตความคืบหน้าการทำงาน</h3>
                        <div className="formGroup">
                          <label>วันที่เริ่มทำงานจริง</label>
                          <input 
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                          />
                        </div>
                        <div className="formGroup">
                          <label>สิ่งที่กำลังรอคอย (ถ้ามี)</label>
                          <textarea 
                            rows={3}
                            placeholder="เช่น รอยืนยันข้อมูลฟิลด์จากกลุ่มงานบัญชี..."
                            value={waitingFor}
                            onChange={e => setWaitingFor(e.target.value)}
                          />
                        </div>
                        <div className="formGroup">
                          <label>ปัญหาและอุปสรรคที่พบ (ถ้ามี)</label>
                          <textarea 
                            rows={3}
                            placeholder="เช่น เซิร์ฟเวอร์สำรองขัดข้องชั่วคราว..."
                            value={blockers}
                            onChange={e => setBlockers(e.target.value)}
                          />
                        </div>

                        {/* File upload for Phase 3 */}
                        <div className="formGroup">
                          <label>แนบรูปภาพหรือเอกสารอัปเดตเพิ่มเติม</label>
                          <div className="mini-upload-zone" onClick={() => document.getElementById('phase3-file-input')?.click()}>
                            <Upload size={18} />
                            <span>คลิกเพื่ออัปโหลดไฟล์</span>
                            <input 
                              id="phase3-file-input"
                              type="file" 
                              multiple 
                              style={{ display: 'none' }}
                              onChange={e => handleWorkFileUpload(e, 3)}
                              disabled={uploadingFile}
                            />
                          </div>
                          {phaseAttachments.length > 0 && (
                            <div className="attachments-list" style={{ marginTop: '8px' }}>
                              {phaseAttachments.map(a => (
                                <div key={a.path} className="attachment-item">
                                  <span className="attachment-name">{a.type === 'pdf' ? '📄' : '🖼️'} {a.name}</span>
                                  <button type="button" className="attachment-remove-btn" onClick={() => handleWorkRemoveAttachment(a.path)}>
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button className="btn btn-primary btn-block" onClick={() => submitWorkPhase(3)}>
                          <RefreshCw size={16} /> บันทึกการอัปเดตดำเนินงาน
                        </button>
                      </div>
                    )}

                    {/* Phase 4: Submit Completion */}
                    {(selectedWork.status === 'in_progress' || selectedWork.status === 'completed') && 
                     (selectedWork.assignments.some(a => a.user_id === currentMemberId) || currentMemberRole === 'admin' || userPosition.includes('ดิจิทัลทางการแพทย์')) && (
                      <div className="actionFormBox card" style={{ marginTop: '1.25rem' }}>
                        <h3>รายงานส่งความเสร็จสมบูรณ์งาน</h3>
                        <div className="formGroup">
                          <label className="required-label">วันที่ทำงานเสร็จสิ้น</label>
                          <input 
                            type="date"
                            value={completedDate}
                            onChange={e => setCompletedDate(e.target.value)}
                          />
                        </div>
                        <div className="formGroup">
                          <label className="required-label">เวลาที่เสร็จสิ้น</label>
                          <input 
                            type="time"
                            value={completedTime}
                            onChange={e => setCompletedTime(e.target.value)}
                          />
                        </div>

                        {/* File upload for Phase 4 */}
                        <div className="formGroup">
                          <label>แนบผลลัพธ์ของงาน / สกรีนช็อตรายงาน / ไฟล์แนบความสำเร็จ</label>
                          <div className="mini-upload-zone" onClick={() => document.getElementById('phase4-file-input')?.click()}>
                            <Upload size={18} />
                            <span>คลิกเพื่ออัปโหลดไฟล์</span>
                            <input 
                              id="phase4-file-input"
                              type="file" 
                              multiple 
                              style={{ display: 'none' }}
                              onChange={e => handleWorkFileUpload(e, 4)}
                              disabled={uploadingFile}
                            />
                          </div>
                          {phaseAttachments.length > 0 && (
                            <div className="attachments-list" style={{ marginTop: '8px' }}>
                              {phaseAttachments.map(a => (
                                <div key={a.path} className="attachment-item">
                                  <span className="attachment-name">{a.type === 'pdf' ? '📄' : '🖼️'} {a.name}</span>
                                  <button type="button" className="attachment-remove-btn" onClick={() => handleWorkRemoveAttachment(a.path)}>
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button className="btn btn-primary btn-block bg-emerald-500" onClick={() => submitWorkPhase(4)}>
                          <CheckCircle2 size={16} /> ส่งงานเสร็จสมบูรณ์
                        </button>
                      </div>
                    )}

                    {/* Phase 5: Review & Close (Dept Head Only) */}
                    {selectedWork.status === 'completed' && (currentMemberRole === 'admin' || userPosition.includes('ดิจิทัลทางการแพทย์')) && (
                      <div className="actionFormBox card">
                        <h3>การประเมินและปิดงาน</h3>
                        <div className="formGroup">
                          <label className="required-label">ระดับความพึงพอใจการปฏิบัติงาน</label>
                          <div className="stars-rating-selector" style={{ display: 'flex', gap: '8px', cursor: 'pointer', margin: '8px 0' }}>
                            {[1, 2, 3, 4, 5].map(score => (
                              <Star 
                                key={score} 
                                size={28} 
                                fill={score <= satisfactionScore ? '#eab308' : 'none'} 
                                color="#eab308"
                                onClick={() => setSatisfactionScore(score)}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="formGroup">
                          <label>ความเห็นและคำติชมเพิ่มเติม</label>
                          <textarea 
                            rows={4}
                            placeholder="กรอกคำแนะนำ ความพึงพอใจ หรือคำขอบคุณเพื่อประเมินการปฏิบัติงาน..."
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                          />
                        </div>

                        <button className="btn btn-primary btn-block bg-teal-500" onClick={submitWorkReview}>
                          <CheckCircle2 size={16} /> อนุมัติและปิดงานสมบูรณ์
                        </button>
                      </div>
                    )}                    
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

