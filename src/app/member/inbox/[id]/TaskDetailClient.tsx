'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Printer, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Calendar, 
  Send, 
  ShieldCheck, 
  FileText,
  Edit3,
  History,
  CheckCircle2,
  Wrench,
  MapPin
} from 'lucide-react'

interface TaskStep {
  id: string
  step_no: number
  step_name: string
  assignee_type: string
  assigned_to_id: number | null
  assigned_role: string | null
  assigned_to_name: string | null
  assigned_to_position: string | null
  status: string
  action_taken: string | null
  action_by_name: string | null
  action_at: string | null
  comment: string | null
  signature_path: string | null
  signature_hash: string | null
}

interface TaskAudit {
  id: string
  action: string
  performed_by: number
  performer_name: string
  details: any
  created_at: string
}

export default function TaskDetailClient({
  taskId,
  sessionUser,
}: {
  taskId: string
  sessionUser: any
}) {
  const router = useRouter()
  const [task, setTask] = useState<any>(null)
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [auditLogs, setAuditLogs] = useState<TaskAudit[]>([])
  const [repairDetail, setRepairDetail] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [allMembers, setAllMembers] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [actionComment, setActionComment] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Repair Action Modals / Panels
  const [isCoWorkerModalOpen, setIsCoWorkerModalOpen] = useState(false)
  const [selectedCoWorkerId, setSelectedCoWorkerId] = useState('')
  const [isRepairProgressModalOpen, setIsRepairProgressModalOpen] = useState(false)
  const [repairProgressForm, setRepairProgressForm] = useState({
    repairNature: 'NORMAL',
    isExternalRepair: false,
    externalVendorName: '',
    externalReason: '',
    costType: 'NO_COST',
    costAmount: '',
    foundProblem: '',
    solutionStep: '',
  })

  // Partial edit state
  const [isEditingPayload, setIsEditingPayload] = useState<boolean>(false)
  const [editNote, setEditNote] = useState<string>('')
  const [editBudget, setEditBudget] = useState<string>('')

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}`)
      const json = await res.json()
      if (json.success && json.data) {
        setTask(json.data.task)
        setSteps(json.data.steps || [])
        setAuditLogs(json.data.auditLogs || [])
        setRepairDetail(json.data.repairDetail || null)
        setCurrentUser(json.data.currentUser)
        if (json.data.task.custom_payload) {
          setEditNote(json.data.task.custom_payload.approvalNote || '')
          setEditBudget(json.data.task.custom_payload.estimatedBudget || '')
        }

        if (json.data.repairDetail) {
          setRepairProgressForm({
            repairNature: json.data.repairDetail.repair_nature || 'NORMAL',
            isExternalRepair: Boolean(json.data.repairDetail.is_external_repair),
            externalVendorName: json.data.repairDetail.external_vendor_name || '',
            externalReason: json.data.repairDetail.external_reason || '',
            costType: json.data.repairDetail.cost_type || 'NO_COST',
            costAmount: json.data.repairDetail.cost_amount ? String(json.data.repairDetail.cost_amount) : '',
            foundProblem: json.data.repairDetail.found_problem || '',
            solutionStep: json.data.repairDetail.solution_step || '',
          })
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Load members for co-worker dropdown
    fetch('/api/member/inbox/assignees')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) setAllMembers(d.data)
      })
      .catch(() => {})
  }, [taskId])

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'SEND_BACK') => {
    if (!actionComment.trim() && action !== 'APPROVE') {
      setError('กรุณาระบุความคิดเห็น / เหตุผลในการดำเนินการ')
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const partialEdits: Record<string, any> = {}
      if (isEditingPayload) {
        if (editNote) partialEdits.approvalNote = editNote
        if (editBudget) partialEdits.estimatedBudget = editBudget
      }

      const res = await fetch(`/api/member/inbox/${taskId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: actionComment,
          partialEdits: Object.keys(partialEdits).length > 0 ? partialEdits : undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg(`ดำเนินการ ${action} สำเร็จเรียบร้อยแล้ว`)
        setActionComment('')
        setIsEditingPayload(false)
        await loadData()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการประมวลผล')
      }
    } catch (e: any) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Repair Action Handlers ──
  const handleAcceptJob = async () => {
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ACCEPT_JOB' }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(data.message)
        await loadData()
      } else {
        setError(data.error || 'ไม่สามารถรับงานได้')
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddCoWorker = async () => {
    if (!selectedCoWorkerId) return
    const target = allMembers.find(m => String(m.id) === String(selectedCoWorkerId))
    if (!target) return

    const currentCoWorkers = repairDetail?.co_workers || []
    if (currentCoWorkers.some((cw: any) => cw.id === target.id)) {
      alert('เจ้าหน้าที่ท่านนี้อยู่ในรายชื่อผู้ร่วมงานแล้ว')
      return
    }

    const updated = [...currentCoWorkers, { id: target.id, name: target.name, position: target.position }]

    setActionLoading(true)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_COWORKERS', newCoWorkers: updated }),
      })
      const data = await res.json()
      if (data.success) {
        setIsCoWorkerModalOpen(false)
        setSelectedCoWorkerId('')
        await loadData()
      } else {
        alert(data.error || 'ไม่สามารถเพิ่มผู้ร่วมงานได้')
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveCoWorker = async (coworkerId: number) => {
    if (!confirm('ต้องการลบผู้ร่วมงานท่านนี้ออกใช่หรือไม่?')) return
    const currentCoWorkers = repairDetail?.co_workers || []
    const updated = currentCoWorkers.filter((cw: any) => cw.id !== coworkerId)

    setActionLoading(true)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_COWORKERS', newCoWorkers: updated }),
      })
      const data = await res.json()
      if (data.success) {
        await loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveRepairProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_REPAIR_PROGRESS',
          ...repairProgressForm,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(data.message)
        setIsRepairProgressModalOpen(false)
        await loadData()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch (err) {
      setError('ไม่สามารถบันทึกข้อมูลได้')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteRepair = async () => {
    if (!confirm('ยืนยันว่าดำเนินการซ่อมเสร็จสิ้นสมบูรณ์และปิดใบงานนี้ใช่หรือไม่?')) return
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_REPAIR',
          ...repairProgressForm,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(data.message)
        await loadData()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch (err) {
      setError('ไม่สามารถปิดงานได้')
    } finally {
      setActionLoading(false)
    }
  }

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
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

  if (loading) {
    return (
      <div className="inboxWrapper" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <Clock size={36} className="animate-spin mx-auto text-blue-600 mb-3" />
        <p>กำลังโหลดรายละเอียดงาน...</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="inboxWrapper" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <AlertCircle size={48} className="mx-auto text-red-500 mb-3" />
        <h2>ไม่พบข้อมูลงาน</h2>
        <Link href="/member/inbox" className="backBtn mt-4 inline-flex">
          กลับสู่กล่องงาน
        </Link>
      </div>
    )
  }

  const isMyTurn = currentUser?.isCurrentAssignee && (task.status === 'PENDING' || task.status === 'IN_PROGRESS')

  return (
    <div className="inboxWrapper" style={{ maxWidth: '950px' }}>
      {/* Top Header */}
      <div className="inboxHeader">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="taskNoBadge" style={{ fontSize: '1rem' }}>
              {task.task_no}
            </span>
            <span className={`statusBadge ${
              task.status === 'APPROVED' ? 'statusApproved' :
              task.status === 'REJECTED' ? 'statusRejected' :
              task.status === 'SENT_BACK' ? 'statusSentBack' : 'statusPending'
            }`}>
              {task.status === 'APPROVED' ? 'อนุมัติเรียบร้อย' :
               task.status === 'REJECTED' ? 'ไม่อนุมัติ' :
               task.status === 'SENT_BACK' ? 'ส่งกลับแก้ไข' : 'รอดำเนินการ'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{task.title}</h1>
        </div>

        <div className="inboxActions">
          <Link href="/member/inbox" className="backBtn">
            <ArrowLeft size={16} />
            กลับกล่องงาน
          </Link>
          <Link href={`/member/inbox/${taskId}/print`} target="_blank" className="backBtn" style={{ color: '#2563eb', borderColor: '#bfdbfe' }}>
            <Printer size={16} />
            พิมพ์ / บันทึกเอกสาร
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Details + Workflow Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.3fr', gap: '1.5rem' }}>
        
        {/* Left Column: Details & Specific Payload */}
        <div>
          <div className="tasksTableCard" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              ข้อมูลคำร้อง
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem' }}>ผู้ยื่นคำขอ</span>
                <strong style={{ color: '#0f172a' }}>{task.requester_name}</strong>
                <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{task.requester_dept || '-'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem' }}>วันที่ยื่นเรื่อง</span>
                <strong style={{ color: '#0f172a' }}>{formatThaiDate(task.created_at)}</strong>
              </div>
            </div>

            {task.description && (
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>รายละเอียด / บันทึกข้อความ</span>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.35rem', color: '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  {task.description}
                </div>
              </div>
            )}

            {/* Custom Payload (shown only when NOT a repair task) */}
            {task.custom_payload && !repairDetail && (
              <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #dbeafe', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#1e40af', fontSize: '0.85rem' }}>ข้อมูลเฉพาะด้าน ({task.task_type})</strong>
                  {isMyTurn && (
                    <button
                      type="button"
                      onClick={() => setIsEditingPayload(!isEditingPayload)}
                      style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Edit3 size={13} />
                      {isEditingPayload ? 'ยกเลิกแก้ไข' : 'แก้ไขข้อมูล'}
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '0.85rem', color: '#1e3a8a', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {Object.entries(task.custom_payload).map(([k, v]) => (
                    <div key={k}>
                      <span style={{ color: '#60a5fa' }}>{k}: </span>
                      <strong>{String(v)}</strong>
                    </div>
                  ))}
                </div>

                {isEditingPayload && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #bfdbfe' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#1e3a8a', marginBottom: '0.25rem' }}>
                      บันทึกความเห็น / ปรับงบประมาณก่อนอนุมัติ (Audit Logged)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ระบุวงเงินงบประมาณ หรือหมายเหตุเพิ่มเติม..."
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #93c5fd', fontSize: '0.85rem', backgroundColor: 'white' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Repair Specific Card (Shown when repairDetail exists) */}
            {repairDetail && (
              <div style={{
                background: '#ffffff',
                borderRadius: '0.85rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
                overflow: 'hidden',
                marginBottom: '1.25rem'
              }}>
                {/* Header Banner */}
                <div style={{
                  padding: '1rem 1.25rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderBottom: '1px solid #bbf7d0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '0.5rem',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                    }}>
                      <Wrench size={18} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                        ข้อมูลงานแจ้งซ่อมบำรุง
                      </span>
                      <strong style={{ color: '#166534', fontSize: '1.05rem', fontWeight: 700 }}>
                        {repairDetail.repair_type === 'IT_REPAIR' ? 'งานซ่อมคอมพิวเตอร์ / ระบบสารสนเทศ' :
                         repairDetail.repair_type === 'MEDICAL_REPAIR' ? 'งานซ่อมเครื่องมือทางการแพทย์' : 'งานซ่อมช่างทั่วไป / ซ่อมบำรุง'}
                      </strong>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.35rem 0.85rem',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: repairDetail.repair_status === 'COMPLETED' ? '#dcfce7' :
                                     repairDetail.repair_status === 'IN_PROGRESS' ? '#dbeafe' :
                                     repairDetail.repair_status === 'EXTERNAL_REPAIR' ? '#fef3c7' : '#f1f5f9',
                    color: repairDetail.repair_status === 'COMPLETED' ? '#166534' :
                           repairDetail.repair_status === 'IN_PROGRESS' ? '#1e40af' :
                           repairDetail.repair_status === 'EXTERNAL_REPAIR' ? '#92400e' : '#475569',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    {repairDetail.repair_status === 'COMPLETED' ? '✓ ซ่อมเสร็จสิ้น' :
                     repairDetail.repair_status === 'IN_PROGRESS' ? '⚙ กำลังดำเนินการซ่อม' :
                     repairDetail.repair_status === 'EXTERNAL_REPAIR' ? '↗ ส่งซ่อมภายนอก' : '⏳ รอช่างรับงาน'}
                  </span>
                </div>

                <div style={{ padding: '1.25rem' }}>
                  {/* Grid 1: Basic Asset & Location Info */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    backgroundColor: '#f8fafc',
                    padding: '1rem',
                    borderRadius: '0.65rem',
                    border: '1px solid #edf2f7',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        ประเภทรายการ
                      </span>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: repairDetail.item_category === 'EQUIPMENT' ? '#dbeafe' : '#f1f5f9',
                        color: repairDetail.item_category === 'EQUIPMENT' ? '#1e40af' : '#475569'
                      }}>
                        {repairDetail.item_category === 'EQUIPMENT' ? 'ครุภัณฑ์โรงพยาบาล' : 'ไม่ใช่ครุภัณฑ์ / งานทั่วไป'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        <MapPin size={12} className="text-emerald-600" />
                        สถานที่ตั้ง / ห้อง / ตึก
                      </span>
                      <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                        {repairDetail.location_full_name || '-'}
                      </strong>
                    </div>

                    {repairDetail.item_category === 'EQUIPMENT' ? (
                      <>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                            หมายเลขครุภัณฑ์
                          </span>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#1e40af', fontSize: '0.95rem', letterSpacing: '0.02em' }}>
                            {repairDetail.equipment_number || '-'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                            ชื่อครุภัณฑ์
                          </span>
                          <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                            {repairDetail.equipment_name || '-'}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                          รายการที่ชำรุดเสียหาย
                        </span>
                        <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                          {repairDetail.non_equipment_item || '-'}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Problem & Symptom Box */}
                  <div style={{
                    backgroundColor: '#fffbeb',
                    padding: '1rem',
                    borderRadius: '0.65rem',
                    border: '1px solid #fef3c7',
                    marginBottom: '1rem'
                  }}>
                    <span style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      <AlertCircle size={15} />
                      อาการชำรุด / ปัญหาที่ผู้ใช้แจ้ง
                    </span>
                    <div style={{ color: '#78350f', whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: '1.55' }}>
                      {repairDetail.symptom_detail || '-'}
                    </div>
                  </div>

                  {/* Attached Photos */}
                  {Array.isArray(repairDetail.photos) && repairDetail.photos.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ color: '#475569', display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        รูปภาพความเสียหายที่แนบ ({repairDetail.photos.length} ภาพ)
                      </span>
                      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                        {repairDetail.photos.map((photo: string, idx: number) => (
                          <a
                            key={idx}
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              borderRadius: '0.5rem',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              transition: 'transform 0.15s ease'
                            }}
                          >
                            <img
                              src={photo}
                              alt={`รูปแนบ ${idx + 1}`}
                              style={{ width: '88px', height: '88px', objectFit: 'cover', display: 'block' }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Technician Team */}
                  <div style={{
                    borderTop: '1px dashed #e2e8f0',
                    paddingTop: '0.9rem',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#334155' }}>
                        ทีมช่างผู้รับผิดชอบงาน
                      </span>
                      {(currentUser?.isCurrentAssignee || currentUser?.isCoWorker || currentUser?.isAdmin) && (
                        <button
                          type="button"
                          onClick={() => setIsCoWorkerModalOpen(true)}
                          style={{
                            fontSize: '0.75rem',
                            color: '#16a34a',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.35rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          + เพิ่มช่างร่วมงาน
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        border: '1px solid #bbf7d0'
                      }}>
                        <User size={13} />
                        ช่างหลัก: {repairDetail.assigned_technician_name || 'ยังไม่ได้ระบุ'}
                      </span>

                      {Array.isArray(repairDetail.co_workers) && repairDetail.co_workers.map((cw: any) => (
                        <span
                          key={cw.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.825rem',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          <span>{cw.name}</span>
                          {(currentUser?.isCurrentAssignee || currentUser?.isAdmin) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCoWorker(cw.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '1rem',
                                lineHeight: 1,
                                marginLeft: '0.2rem'
                              }}
                              title="ลบออก"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Repair Results / Progress Details (Rendered if any problem/solution exists or external repair is true) */}
                  {(Boolean(repairDetail.found_problem) || Boolean(repairDetail.solution_step) || Boolean(repairDetail.is_external_repair) || repairDetail.cost_type === 'HAS_COST') && (
                    <div style={{
                      marginTop: '1rem',
                      backgroundColor: '#f8fafc',
                      padding: '1rem',
                      borderRadius: '0.65rem',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.85rem'
                    }}>
                      <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid #edf2f7', paddingBottom: '0.35rem' }}>
                        บันทึกผลการตรวจซ่อมและความคืบหน้า
                      </strong>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>ลักษณะการส่งซ่อม: </span>
                          <strong style={{ color: '#0f172a' }}>{repairDetail.repair_nature === 'RETROACTIVE' ? 'ส่งซ่อมย้อนหลัง' : 'ส่งซ่อมปกติ'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>ค่าใช้จ่าย: </span>
                          <strong style={{ color: repairDetail.cost_type === 'HAS_COST' ? '#b45309' : '#15803d' }}>
                            {repairDetail.cost_type === 'HAS_COST' ? `มีค่าใช้จ่าย (${Number(repairDetail.cost_amount || 0).toLocaleString()} บาท)` : 'ไม่มีค่าใช้จ่าย'}
                          </strong>
                        </div>
                      </div>

                      {Boolean(repairDetail.is_external_repair) && (
                        <div style={{ backgroundColor: '#fef3c7', padding: '0.5rem 0.75rem', borderRadius: '0.35rem', color: '#92400e', marginBottom: '0.5rem' }}>
                          <strong>ส่งซ่อมภายนอก: </strong> ร้าน/บริษัท {repairDetail.external_vendor_name || '-'}
                          {repairDetail.external_reason && <span> (เหตุผล: {repairDetail.external_reason})</span>}
                        </div>
                      )}

                      {repairDetail.found_problem && (
                        <div style={{ marginTop: '0.4rem' }}>
                          <span style={{ color: '#64748b', display: 'block', fontWeight: 600 }}>สาเหตุ/ปัญหาที่ตรวจพบ:</span>
                          <div style={{ color: '#1e293b', whiteSpace: 'pre-line' }}>{repairDetail.found_problem}</div>
                        </div>
                      )}

                      {repairDetail.solution_step && (
                        <div style={{ marginTop: '0.4rem' }}>
                          <span style={{ color: '#64748b', display: 'block', fontWeight: 600 }}>แนวทาง/ผลการดำเนินการแก้ไข:</span>
                          <div style={{ color: '#1e293b', whiteSpace: 'pre-line' }}>{repairDetail.solution_step}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Technician Action Buttons (For Assigned Technician, Co-worker, or Admin) */}
                  {(currentUser?.isCurrentAssignee || currentUser?.isCoWorker || currentUser?.isAdmin) && (
                    <div style={{
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      gap: '0.65rem',
                      flexWrap: 'wrap'
                    }}>
                      {repairDetail.repair_status === 'WAITING' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleAcceptJob}
                          style={{
                            backgroundColor: '#2563eb',
                            color: 'white',
                            padding: '0.6rem 1.25rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                          }}
                        >
                          <CheckCircle size={16} />
                          กดรับงานซ่อม (Accept Job)
                        </button>
                      )}

                      {(repairDetail.repair_status === 'IN_PROGRESS' || repairDetail.repair_status === 'EXTERNAL_REPAIR') && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => setIsRepairProgressModalOpen(true)}
                            style={{
                              backgroundColor: '#0284c7',
                              color: 'white',
                              padding: '0.6rem 1.15rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
                            }}
                          >
                            <Edit3 size={15} />
                            บันทึกผลการซ่อม / ส่งภายนอก
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleCompleteRepair}
                            style={{
                              backgroundColor: '#16a34a',
                              color: 'white',
                              padding: '0.6rem 1.25rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                            }}
                          >
                            <CheckCircle2 size={16} />
                            ซ่อมเสร็จสิ้น (Complete Repair)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Box: General Non-Repair Task Approval */}
          {isMyTurn && !repairDetail ? (
            <div className="tasksTableCard" style={{ padding: '1.5rem', border: '2px solid #3b82f6', backgroundColor: '#faf5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1e40af' }}>
                <ShieldCheck size={22} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>คิวงานรอคุณพิจารณาดำเนินการ</h3>
              </div>

              {!currentUser?.hasSignature && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '0.75rem', borderRadius: '0.35rem', marginBottom: '1rem', fontSize: '0.825rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>
                    คุณยังไม่ได้ตั้งค่าลายเซ็นดิจิทัล สามารถ{' '}
                    <Link href="/member/signature" target="_blank" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                      คลิกเพื่อตั้งค่าลายเซ็นที่นี่
                    </Link>{' '}
                    ก่อนกดอนุมัติเพื่อประทับลงในเอกสาร
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.35rem', color: '#334155' }}>
                  ข้อความบันทึกความเห็น / คำสั่งการ
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น อนุมัติเห็นชอบตามเสนอ, มอบหมายงาน, หรือเหตุผลที่ให้แก้ไข..."
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('APPROVE')}
                  style={{
                    backgroundColor: '#16a34a',
                    color: 'white',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <CheckCircle size={16} />
                  ลงนามอนุมัติ (Approve)
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('SEND_BACK')}
                  style={{
                    backgroundColor: '#ea580c',
                    color: 'white',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <AlertCircle size={16} />
                  ส่งกลับแก้ไข (Send Back)
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('REJECT')}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <XCircle size={16} />
                  ไม่อนุมัติ (Reject)
                </button>
              </div>
            </div>
          ) : isMyTurn && repairDetail && task.current_step_no > 1 ? (
            /* For repair task where the user is in an approval step (e.g. director / department head signing step > 1) */
            <div className="tasksTableCard" style={{ padding: '1.5rem', border: '2px solid #3b82f6', backgroundColor: '#faf5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1e40af' }}>
                <ShieldCheck size={22} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>คิวงานรอคุณลงนาม / พิจารณาอนุมัติ</h3>
              </div>

              {!currentUser?.hasSignature && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '0.75rem', borderRadius: '0.35rem', marginBottom: '1rem', fontSize: '0.825rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>
                    คุณยังไม่ได้ตั้งค่าลายเซ็นดิจิทัล สามารถ{' '}
                    <Link href="/member/signature" target="_blank" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                      คลิกเพื่อตั้งค่าลายเซ็นที่นี่
                    </Link>{' '}
                    ก่อนกดอนุมัติเพื่อประทับลงในเอกสาร
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.35rem', color: '#334155' }}>
                  ข้อความบันทึกความเห็น / คำสั่งการ
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น อนุมัติเห็นชอบตามเสนอ..."
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('APPROVE')}
                  style={{
                    backgroundColor: '#16a34a',
                    color: 'white',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <CheckCircle size={16} />
                  ลงนามอนุมัติ (Approve)
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('SEND_BACK')}
                  style={{
                    backgroundColor: '#ea580c',
                    color: 'white',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <AlertCircle size={16} />
                  ส่งกลับแก้ไข (Send Back)
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('REJECT')}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <XCircle size={16} />
                  ไม่อนุมัติ (Reject)
                </button>
              </div>
            </div>
          ) : (
            <div className="tasksTableCard" style={{ padding: '1rem', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} />
                <span>
                  {repairDetail ? 'ขณะนี้ใบแจ้งซ่อมอยู่ระหว่างขั้นตอนการปฏิบัติงานของทีมช่าง' : 'ขณะนี้งานกำลังอยู่ในขั้นตอนการพิจารณาของผู้รับผิดชอบตามลำดับสายงาน'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Workflow Steps Timeline & Audit Logs */}
        <div>
          {/* Steps Timeline Card */}
          <div className="tasksTableCard" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              ขั้นตอนการอนุมัติ (Workflow Timeline)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {steps.map((st, idx) => {
                const isCurrent = st.step_no === task.current_step_no && task.status === 'PENDING'
                const isDone = st.status === 'COMPLETED'
                const isRejected = st.status === 'REJECTED'

                return (
                  <div
                    key={st.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: isCurrent ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      backgroundColor: isDone ? '#f0fdf4' : isRejected ? '#fef2f2' : isCurrent ? '#eff6ff' : '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                        ขั้นตอนที่ {st.step_no}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isDone ? '#16a34a' : isRejected ? '#dc2626' : isCurrent ? '#2563eb' : '#94a3b8',
                      }}>
                        {isDone ? 'อนุมัติแล้ว' : isRejected ? 'ไม่อนุมัติ' : isCurrent ? 'กำลังรอพิจารณา' : 'รอดำเนินการ'}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.25rem' }}>
                      {st.step_name}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      ผู้มีอำนาจ: {st.assigned_to_name || st.assigned_role || 'ผู้รับมอบหมาย'}
                    </div>

                    {st.action_by_name && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
                        <div style={{ color: '#0f172a' }}>
                          ลงนามโดย: <strong>{st.action_by_name}</strong>
                        </div>
                        <div style={{ color: '#64748b' }}>{formatThaiDate(st.action_at)}</div>
                        {st.comment && (
                          <div style={{ marginTop: '0.25rem', fontStyle: 'italic', color: '#334155' }}>
                            "{st.comment}"
                          </div>
                        )}
                        {st.signature_path && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <ShieldCheck size={12} />
                              ประทับ e-Signature ยืนยันแล้ว
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Audit Trail Card */}
          <div className="tasksTableCard" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <History size={16} />
              ประวัติการดำเนินการ (Audit Trail)
            </h4>

            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#334155' }}>{log.action}</strong>
                    <span>{formatThaiDate(log.created_at)}</span>
                  </div>
                  <div>โดย: {log.performer_name || `ID #${log.performed_by}`}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal 1: Add Co-Worker ── */}
      {isCoWorkerModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              เพิ่มผู้ร่วมงานซ่อมบำรุง
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              เลือกบุคลากร/ช่างเพื่อเข้าร่วมรับผิดชอบและลงนามในใบแจ้งซ่อมนี้
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                เลือกเจ้าหน้าที่ / ช่าง
              </label>
              <select
                value={selectedCoWorkerId}
                onChange={(e) => setSelectedCoWorkerId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              >
                <option value="">-- กรุณาเลือก --</option>
                {allMembers
                  .filter((m) => m.id !== repairDetail?.assigned_technician_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.position || m.department || 'เจ้าหน้าที่'})
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsCoWorkerModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.35rem',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!selectedCoWorkerId || actionLoading}
                onClick={handleAddCoWorker}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                เพิ่มผู้ร่วมงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Save Repair Progress / External Repair / Costs ── */}
      {isRepairProgressModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.75rem',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              บันทึกผลการตรวจซ่อม / รายงานความคืบหน้า
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              ข้อมูลนี้จะปรากฏในใบแจ้งซ่อมพิมพ์ขนาด A4 และบันทึกลงฐานข้อมูล
            </p>

            <form onSubmit={handleSaveRepairProgress}>
              {/* ส่งซ่อมปกติ หรือ ส่งซ่อมย้อนหลัง */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  ลักษณะการส่งซ่อม (ตรงตามแบบฟอร์มเอกสาร)
                </label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="repairNature"
                      checked={repairProgressForm.repairNature === 'NORMAL'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, repairNature: 'NORMAL' }))}
                    />
                    ส่งซ่อมปกติ
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="repairNature"
                      checked={repairProgressForm.repairNature === 'RETROACTIVE'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, repairNature: 'RETROACTIVE' }))}
                    />
                    ส่งซ่อมย้อนหลัง
                  </label>
                </div>
              </div>

              {/* ปัญหาที่พบ */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  ปัญหา / สาเหตุที่ตรวจพบ
                </label>
                <textarea
                  rows={2}
                  value={repairProgressForm.foundProblem}
                  onChange={(e) => setRepairProgressForm(prev => ({ ...prev, foundProblem: e.target.value }))}
                  placeholder="เช่น สายแพร์จอภาพขาด, Power Supply เสีย, ชุดซีลยางเสื่อมสภาพ..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* แนวทางแก้ไข */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  แนวทางการแก้ไข / ขั้นตอนที่ดำเนินการ
                </label>
                <textarea
                  rows={2}
                  value={repairProgressForm.solutionStep}
                  onChange={(e) => setRepairProgressForm(prev => ({ ...prev, solutionStep: e.target.value }))}
                  placeholder="เช่น ทำการเปลี่ยนอะไหล่ Power Supply ตัวใหม่ และทดสอบการทำงาน..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* ส่งซ่อมภายนอก หรือไม่ */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={repairProgressForm.isExternalRepair}
                    onChange={(e) => setRepairProgressForm(prev => ({ ...prev, isExternalRepair: e.target.checked }))}
                  />
                  จำเป็นต้องส่งซ่อมภายนอก (ร้านค้า / บริษัทภายนอก)
                </label>

                {repairProgressForm.isExternalRepair && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                        ชื่อร้าน / บริษัทผู้รับซ่อม
                      </label>
                      <input
                        type="text"
                        value={repairProgressForm.externalVendorName}
                        onChange={(e) => setRepairProgressForm(prev => ({ ...prev, externalVendorName: e.target.value }))}
                        placeholder="เช่น บจก. เทคโนเมดิคอล"
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                        เหตุผลที่ต้องส่งภายนอก
                      </label>
                      <input
                        type="text"
                        value={repairProgressForm.externalReason}
                        onChange={(e) => setRepairProgressForm(prev => ({ ...prev, externalReason: e.target.value }))}
                        placeholder="เช่น ต้องใช้เครื่องมือเทียบมาตรฐานเฉพาะ"
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ค่าใช้จ่าย */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  ค่าใช้จ่ายในการซ่อม
                </label>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: repairProgressForm.costType === 'HAS_COST' ? '0.5rem' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      checked={repairProgressForm.costType === 'NO_COST'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, costType: 'NO_COST', costAmount: '' }))}
                    />
                    ไม่มีค่าใช้จ่าย
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      checked={repairProgressForm.costType === 'HAS_COST'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, costType: 'HAS_COST' }))}
                    />
                    มีค่าใช้จ่าย
                  </label>
                </div>

                {repairProgressForm.costType === 'HAS_COST' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                      จำนวนเงิน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={repairProgressForm.costAmount}
                      onChange={(e) => setRepairProgressForm(prev => ({ ...prev, costAmount: e.target.value }))}
                      placeholder="เช่น 1500.00"
                      style={{ width: '200px', padding: '0.45rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRepairProgressModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.35rem',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
