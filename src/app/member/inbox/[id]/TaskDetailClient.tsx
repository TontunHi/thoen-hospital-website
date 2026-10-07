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
  MapPin,
  ExternalLink,
  Plus,
  Trash2,
  Building2,
  Stethoscope,
  Sparkles,
  Info,
  DollarSign,
  Palette,
  Share2,
  Layers,
  FileCheck,
  Phone,
  UploadCloud,
  X,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Link as LinkIcon,
  Loader2,
  PauseCircle,
  PlayCircle
} from 'lucide-react'

// Predefined Work Types with quick assist tags for Media Request
const WORK_TYPES_CONFIG = [
  { key: 'tri_fold', label: 'แผ่นพับ 3 พับ', icon: '📄', hasCustomInput: false },
  { key: 'website_aw', label: 'AW ขึ้นเว็บไซต์', icon: '🌐', hasCustomInput: false },
  {
    key: 'poster',
    label: 'โปสเตอร์',
    icon: '🖼️',
    hasCustomInput: true,
    placeholder: 'ระบุขนาด เช่น A3, A2, 60x90 ซม.…',
    quickTags: ['A4', 'A3', 'A2', '60x90 ซม.'],
  },
  { key: 'staff_card', label: 'บัตรพนักงาน', icon: '🪪', hasCustomInput: false },
  { key: 'announcement_board', label: 'ป้ายประกาศ', icon: '📌', hasCustomInput: false },
  { key: 'sticker', label: 'สติ๊กเกอร์', icon: '🏷️', hasCustomInput: false },
  { key: 'video_editing', label: 'ตัดต่อวิดีโอ', icon: '🎬', hasCustomInput: false },
  { key: 'powerpoint', label: 'PowerPoint', icon: '📊', hasCustomInput: false },
  {
    key: 'other',
    label: 'อื่น ๆ',
    icon: '✨',
    hasCustomInput: true,
    placeholder: 'ระบุลักษณะงาน เช่น ไวนิล, Standee, Roll-up…',
    quickTags: ['ไวนิล', 'Standee', 'Roll-up', 'ป้ายโฟมบอร์ด', 'ของที่ระลึก'],
  },
]

// Predefined Channels with quick assist tags for Media Request
const CHANNELS_CONFIG = [
  { key: 'hospital_social', label: 'สื่อโซเชียลของรพ.', icon: '📱', hasCustomInput: false },
  { key: 'facebook_page', label: 'Page Facebook', icon: '🌐', hasCustomInput: false },
  {
    key: 'indoor',
    label: 'ในอาคารโรงพยาบาล',
    icon: '🏥',
    hasCustomInput: true,
    placeholder: 'ระบุบริเวณ เช่น หน้าห้องตรวจ OPD, โถงประชาสัมพันธ์ชั้น 1…',
    quickTags: ['หน้าห้องตรวจ OPD', 'โถงประชาสัมพันธ์ ชั้น 1', 'แผนกฉุกเฉิน (ER)', 'ตึกผู้ป่วยใน (IPD)'],
  },
  {
    key: 'community',
    label: 'ในชุมชน',
    icon: '🏘️',
    hasCustomInput: true,
    placeholder: 'ระบุจุด/ชุมชน เช่น รพ.สต. ในเครือข่าย, ชุมชนเทศบาลเถิน…',
    quickTags: ['รพ.สต. ในเครือข่าย', 'ชุมชนเทศบาลเถิน', 'ออกหน่วยบริการ'],
  },
  {
    key: 'other',
    label: 'อื่น ๆ',
    icon: '📣',
    hasCustomInput: true,
    placeholder: 'ระบุช่องทางเผยแพร่เพิ่มเติม…',
  },
]

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return <FileImage aria-hidden="true" className="w-4 h-4 text-emerald-600 shrink-0" />
  }
  if (['pdf', 'doc', 'docx'].includes(ext)) {
    return <FileText aria-hidden="true" className="w-4 h-4 text-blue-600 shrink-0" />
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet aria-hidden="true" className="w-4 h-4 text-teal-600 shrink-0" />
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive aria-hidden="true" className="w-4 h-4 text-amber-600 shrink-0" />
  }
  return <FileCheck aria-hidden="true" className="w-4 h-4 text-teal-600 shrink-0" />
}
import { resolveTaskPermissions } from '@/lib/taskPermissionResolver'

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
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
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

  // Hold Task Modal State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState<boolean>(false)
  const [holdReason, setHoldReason] = useState<string>('รอการจัดสรรงบ')
  const [holdCustomReason, setHoldCustomReason] = useState<string>('')
  const [holdDetails, setHoldDetails] = useState<string>('')

  // Manager Edit Task Modal State
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState<boolean>(false)
  const [isUploadingEditFiles, setIsUploadingEditFiles] = useState<boolean>(false)
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    urgency: 'NORMAL',
    costType: 'NO_COST',
    estimatedBudget: '',
    deliveryDate: '',
    phone: '',
    driveLink: '',
    selectedWorkTypes: {} as Record<string, { selected: boolean; customDetail: string }>,
    selectedChannels: {} as Record<string, { selected: boolean; customDetail: string }>,
    attachments: [] as Array<{ fileName: string; filePath: string; fileType?: string; fileSize?: number }>,
    objectives: '',
    mediaDetails: '',
    itemCategory: 'EQUIPMENT',
    equipmentNumber: '',
    equipmentName: '',
    nonEquipmentItem: '',
    locationFullName: '',
    symptomDetail: '',
  })

  const handleOpenEditModal = () => {
    const payload = task?.custom_payload || {}

    // Parse work types into selection map
    const wtMap: Record<string, { selected: boolean; customDetail: string }> = {}
    WORK_TYPES_CONFIG.forEach(cfg => {
      const found = (payload.workTypes || []).find((w: any) => w.key === cfg.key)
      if (found) {
        wtMap[cfg.key] = { selected: true, customDetail: found.customDetail || '' }
      }
    })
    ;(payload.workTypes || []).forEach((w: any) => {
      if (!wtMap[w.key]) {
        wtMap[w.key] = { selected: true, customDetail: w.customDetail || '' }
      }
    })

    // Parse channels into selection map
    const chMap: Record<string, { selected: boolean; customDetail: string }> = {}
    CHANNELS_CONFIG.forEach(cfg => {
      const found = (payload.channels || []).find((c: any) => c.key === cfg.key)
      if (found) {
        chMap[cfg.key] = { selected: true, customDetail: found.customDetail || '' }
      }
    })
    ;(payload.channels || []).forEach((c: any) => {
      if (!chMap[c.key]) {
        chMap[c.key] = { selected: true, customDetail: c.customDetail || '' }
      }
    })

    setEditTaskForm({
      title: task?.title || '',
      description: task?.description || '',
      urgency: task?.urgency || 'NORMAL',
      costType: payload.costType || 'NO_COST',
      estimatedBudget: payload.estimatedBudget ? String(payload.estimatedBudget) : '',
      deliveryDate: payload.deliveryDate || '',
      phone: payload.phone || '',
      driveLink: payload.driveLink || '',
      selectedWorkTypes: wtMap,
      selectedChannels: chMap,
      attachments: Array.isArray(payload.attachments) ? [...payload.attachments] : [],
      objectives: payload.objectives || '',
      mediaDetails: payload.details || '',
      itemCategory: repairDetail?.item_category || 'EQUIPMENT',
      equipmentNumber: repairDetail?.equipment_number || '',
      equipmentName: repairDetail?.equipment_name || '',
      nonEquipmentItem: repairDetail?.non_equipment_item || '',
      locationFullName: repairDetail?.location_full_name || '',
      symptomDetail: repairDetail?.symptom_detail || '',
    })
    setIsEditTaskModalOpen(true)
  }

  const toggleEditWorkType = (key: string) => {
    setEditTaskForm((prev) => {
      const current = prev.selectedWorkTypes[key] || { selected: false, customDetail: '' }
      return {
        ...prev,
        selectedWorkTypes: {
          ...prev.selectedWorkTypes,
          [key]: { ...current, selected: !current.selected },
        },
      }
    })
  }

  const setEditWorkTypeDetail = (key: string, detail: string) => {
    setEditTaskForm((prev) => {
      const current = prev.selectedWorkTypes[key] || { selected: true, customDetail: '' }
      return {
        ...prev,
        selectedWorkTypes: {
          ...prev.selectedWorkTypes,
          [key]: { ...current, customDetail: detail },
        },
      }
    })
  }

  const toggleEditChannel = (key: string) => {
    setEditTaskForm((prev) => {
      const current = prev.selectedChannels[key] || { selected: false, customDetail: '' }
      return {
        ...prev,
        selectedChannels: {
          ...prev.selectedChannels,
          [key]: { ...current, selected: !current.selected },
        },
      }
    })
  }

  const setEditChannelDetail = (key: string, detail: string) => {
    setEditTaskForm((prev) => {
      const current = prev.selectedChannels[key] || { selected: true, customDetail: '' }
      return {
        ...prev,
        selectedChannels: {
          ...prev.selectedChannels,
          [key]: { ...current, customDetail: detail },
        },
      }
    })
  }

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingEditFiles(true)
    try {
      const files = Array.from(e.target.files)
      const newFiles: any[] = []
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          alert(`ไฟล์ "${file.name}" มีขนาดเกิน 25MB`)
          continue
        }
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', `media-edit-${task?.task_no || 'task'}`)
        const res = await fetch('/api/member/upload', {
          method: 'POST',
          body: formData,
        })
        const result = await res.json()
        if (res.ok && result.url) {
          newFiles.push({
            fileName: file.name,
            filePath: result.url,
            fileType: file.type,
            fileSize: file.size,
          })
        }
      }
      setEditTaskForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }))
    } catch (err) {
      console.error('File upload error:', err)
    } finally {
      setIsUploadingEditFiles(false)
      e.target.value = ''
    }
  }

  const handleRemoveEditAttachment = (index: number) => {
    setEditTaskForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const handleSaveTaskEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const bodyPayload: any = {
        title: editTaskForm.title,
        urgency: editTaskForm.urgency,
      }

      if (task.task_type === 'MEDIA_REQUEST') {
        const activeWorkTypes = Object.entries(editTaskForm.selectedWorkTypes)
          .filter(([_, val]) => val.selected)
          .map(([key, val]) => {
            const cfg = WORK_TYPES_CONFIG.find((c) => c.key === key)
            return {
              key,
              label: cfg?.label || key,
              customDetail: val.customDetail?.trim() || null,
            }
          })

        const activeChannels = Object.entries(editTaskForm.selectedChannels)
          .filter(([_, val]) => val.selected)
          .map(([key, val]) => {
            const cfg = CHANNELS_CONFIG.find((c) => c.key === key)
            return {
              key,
              label: cfg?.label || key,
              customDetail: val.customDetail?.trim() || null,
            }
          })

        bodyPayload.description = editTaskForm.description
        bodyPayload.costType = editTaskForm.costType
        bodyPayload.estimatedBudget = editTaskForm.costType === 'HAS_COST' ? Number(editTaskForm.estimatedBudget) || 0 : 0
        bodyPayload.deliveryDate = editTaskForm.deliveryDate
        bodyPayload.phone = editTaskForm.phone
        bodyPayload.driveLink = editTaskForm.driveLink
        bodyPayload.workTypes = activeWorkTypes
        bodyPayload.channels = activeChannels
        bodyPayload.attachments = editTaskForm.attachments
      } else if (['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type)) {
        bodyPayload.itemCategory = editTaskForm.itemCategory
        bodyPayload.equipmentNumber = editTaskForm.equipmentNumber
        bodyPayload.equipmentName = editTaskForm.equipmentName
        bodyPayload.nonEquipmentItem = editTaskForm.nonEquipmentItem
        bodyPayload.locationFullName = editTaskForm.locationFullName
        bodyPayload.symptomDetail = editTaskForm.symptomDetail
      } else {
        bodyPayload.description = editTaskForm.description
      }

      const res = await fetch(`/api/member/inbox/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(data.message || 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว')
        setIsEditTaskModalOpen(false)
        await loadData()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล')
      }
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setActionLoading(false)
    }
  }

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
        setSuccessMsg(`ดำเนินการ ${action === 'APPROVE' ? 'อนุมัติ' : action === 'SEND_BACK' ? 'ส่งกลับแก้ไข' : 'ไม่อนุมัติ'} สำเร็จเรียบร้อยแล้ว`)
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

  // ── Hold & Resume Action Handlers ──
  const handleHoldTask = async () => {
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)

    const finalReason = holdReason === 'อื่นๆ' ? (holdCustomReason.trim() || 'อื่นๆ') : holdReason

    try {
      const res = await fetch(`/api/member/inbox/${taskId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'HOLD',
          holdReason: finalReason,
          holdDetails: holdDetails.trim() || undefined,
        }),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการพักงาน')
      }

      setIsHoldModalOpen(false)
      setHoldDetails('')
      setHoldCustomReason('')
      setSuccessMsg('บันทึกการพักงานเรียบร้อยแล้ว')
      await loadData()
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการพักงาน')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResumeTask = async () => {
    if (!confirm('ต้องการปลดสถานะพักงาน และกลับมาดำเนินการต่อใช่หรือไม่?')) return

    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(`/api/member/inbox/${taskId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESUME',
        }),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการปลดพักงาน')
      }

      setSuccessMsg('ปลดพักงานและกลับมาดำเนินการต่อเรียบร้อยแล้ว')
      await loadData()
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการปลดพักงาน')
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

  const handleCancelJob = async () => {
    if (!cancelReason.trim()) {
      alert('กรุณาระบุเหตุผลในการยกเลิกหรือปฏิเสธงาน')
      return
    }
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/repair-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL_JOB',
          reason: cancelReason.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(data.message)
        setIsCancelModalOpen(false)
        setCancelReason('')
        await loadData()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการยกเลิกงาน')
      }
    } catch (err) {
      setError('ไม่สามารถทำรายการได้')
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
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
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
      case 'MEDIA_REQUEST':
        return (
          <span className="typeBadge" style={{ backgroundColor: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' }}>
            <Palette size={13} />
            <span>งานขอสื่อประชาสัมพันธ์</span>
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

  const getUrgencyBadge = (urgency: string, taskType?: string) => {
    switch (urgency) {
      case 'VERY_URGENT':
        return (
          <span className="urgencyDot dotVeryUrgent" style={{ backgroundColor: '#fef2f2', padding: '0.2rem 0.55rem', borderRadius: '9999px', border: '1px solid #fecaca', fontSize: '0.775rem' }}>
            ● ด่วนที่สุด
          </span>
        )
      case 'URGENT':
        return (
          <span className="urgencyDot dotUrgent" style={{ backgroundColor: '#fff7ed', padding: '0.2rem 0.55rem', borderRadius: '9999px', border: '1px solid #fed7aa', fontSize: '0.775rem' }}>
            ● ด่วน
          </span>
        )
      default:
        return (
          <span className="urgencyDot dotNormal" style={{ backgroundColor: '#f8fafc', padding: '0.2rem 0.55rem', borderRadius: '9999px', border: '1px solid #e2e8f0', fontSize: '0.775rem' }}>
            ● {taskType === 'MEDIA_REQUEST' ? 'ไม่ด่วน' : 'ปกติ'}
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="inboxWrapper" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <Clock size={36} className="animate-spin mx-auto text-blue-600 mb-3" />
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>กำลังโหลดรายละเอียดงาน...</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="inboxWrapper" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <AlertCircle size={48} className="mx-auto text-red-500 mb-3" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>ไม่พบข้อมูลงาน</h2>
        <Link href="/member/inbox" className="backBtn mt-4 inline-flex">
          <ArrowLeft size={16} />
          กลับสู่กล่องงาน
        </Link>
      </div>
    )
  }

  const memberLike = {
    id: currentUser?.id ?? sessionUser?.id,
    username: currentUser?.username ?? sessionUser?.username,
    name: currentUser?.name ?? sessionUser?.name,
    role: currentUser?.role ?? sessionUser?.role,
    position: currentUser?.position ?? sessionUser?.position,
    department: currentUser?.department ?? sessionUser?.department,
    permissions: sessionUser?.permissions || currentUser?.permissions,
    isAdmin: Boolean(sessionUser?.isAdmin || sessionUser?.role === 'admin' || currentUser?.isAdmin),
  }

  const taskPermissions = resolveTaskPermissions(memberLike, task, { repairDetail, steps })
  const isMyTurn = taskPermissions.canApprove || (currentUser?.isCurrentAssignee && (task.status === 'PENDING' || task.status === 'IN_PROGRESS'))
  const canEdit = taskPermissions.canEdit
  const currentStep = steps.find((s) => s.step_no === task?.current_step_no)


  return (
    <div className="inboxWrapper" style={{ maxWidth: '1080px' }}>
      {/* ── Top Header Card ── */}
      <div className="detailHeaderCard">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <span className="taskNoBadge">{task.task_no}</span>
            {getTypeBadge(task.task_type)}
            <span className={`statusBadge ${
              task.status === 'APPROVED' ? 'statusApproved' :
              task.status === 'REJECTED' ? 'statusRejected' :
              task.status === 'SENT_BACK' ? 'statusSentBack' : 
              task.status === 'ON_HOLD' ? 'statusOnHold' :
              task.status === 'IN_PROGRESS' ? 'statusInProgress' : 'statusPending'
            }`} style={task.status === 'ON_HOLD' ? { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' } : undefined}>
              {task.status === 'APPROVED' && <CheckCircle2 size={13} className="flex-shrink-0" />}
              {task.status === 'REJECTED' && <XCircle size={13} className="flex-shrink-0" />}
              {task.status === 'SENT_BACK' && <AlertCircle size={13} className="flex-shrink-0" />}
              {task.status === 'ON_HOLD' && <PauseCircle size={13} className="flex-shrink-0" />}
              {task.status === 'IN_PROGRESS' && <Wrench size={13} className="flex-shrink-0" />}
              {task.status === 'PENDING' && <Clock size={13} className="flex-shrink-0" />}
              <span>
                {task.status === 'APPROVED' ? 'อนุมัติเรียบร้อย' :
                 task.status === 'REJECTED' ? 'ไม่อนุมัติ' :
                 task.status === 'SENT_BACK' ? 'ส่งกลับแก้ไข' : 
                 task.status === 'ON_HOLD' ? 'พักงานชั่วคราว' :
                 task.status === 'IN_PROGRESS' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
              </span>
            </span>
          </div>
          <h1 className="detailHeaderTitle">{task.title}</h1>
        </div>

        <div className="headerActions">
          <Link href="/member/inbox" className="backBtn">
            <ArrowLeft size={16} />
            <span>กลับกล่องงาน</span>
          </Link>
          <Link 
            href={`/member/inbox/${taskId}/print`} 
            target="_blank" 
            className="backBtn" 
            style={{ color: '#2563eb', borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
          >
            <Printer size={16} />
            <span>พิมพ์ใบงาน (A4)</span>
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="backBtn"
              style={{
                backgroundColor: '#0f766e',
                color: '#ffffff',
                borderColor: '#0f766e',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 4px rgba(15, 118, 110, 0.25)',
              }}
            >
              <Edit3 size={16} />
              <span>แก้ไขข้อมูลคำขอ</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts Banner ── */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.85rem 1.15rem', borderRadius: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.85rem 1.15rem', borderRadius: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── On Hold Notification Banner ── */}
      {task.status === 'ON_HOLD' && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.5rem',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <PauseCircle size={24} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#92400e', fontSize: '1rem', fontWeight: 700 }}>
                งานนี้ถูกพักการดำเนินการชั่วคราว (On Hold)
              </h4>
              <div style={{ fontSize: '0.875rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div>
                  <strong>เหตุผล:</strong> {task.custom_payload?.holdInfo?.reason || 'รอการจัดสรรงบ'}
                </div>
                {task.custom_payload?.holdInfo?.details && (
                  <div>
                    <strong>รายละเอียด:</strong> {task.custom_payload.holdInfo.details}
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.15rem' }}>
                  บันทึกโดย: {task.custom_payload?.holdInfo?.heldByName || '-'}
                  {task.custom_payload?.holdInfo?.heldAt ? ` • เมื่อ ${formatThaiDate(task.custom_payload.holdInfo.heldAt)}` : ''}
                </div>
              </div>
            </div>
          </div>

          {taskPermissions.canResume && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleResumeTask}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#0d9488',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(13, 148, 136, 0.25)'
              }}
            >
              <PlayCircle size={18} />
              <span>ปลดพักงาน / ดำเนินการต่อ (Resume)</span>
            </button>
          )}
        </div>
      )}

      {/* ── Main Detail Grid ── */}
      <div className="detailGrid">
        
        {/* Left Column: Work Details (Media Request, Repair Details or Non-Repair Content) + Approval Actions */}
        <div>
          {task.task_type === 'MEDIA_REQUEST' ? (
            <div className="contentCard">
              <div className="contentCardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="contentCardTitle" style={{ color: '#0f766e', margin: 0 }}>
                  <Palette size={18} className="text-teal-600" />
                  <span>รายละเอียดคำขอสื่อประชาสัมพันธ์</span>
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: '#f0fdfa',
                      color: '#0f766e',
                      border: '1px solid #99f6e4',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={14} />
                    <span>แก้ไขข้อมูล / ค่าใช้จ่าย</span>
                  </button>
                )}
              </div>

              {/* Media Request Summary Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                border: '1px solid #99f6e4',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    รูปแบบค่าใช้จ่าย / การพิจารณา
                  </span>
                  <strong style={{ color: '#115e59', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    {task.custom_payload?.costType === 'HAS_COST' ? '🔴 มีค่าใช้จ่าย' : '🟢 ไม่มีค่าใช้จ่าย'}
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {task.custom_payload?.deliveryDate && (
                    <div style={{ background: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #99f6e4', fontSize: '0.8rem', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                      <Calendar size={14} />
                      <span>ขอรับงานภายใน: {task.custom_payload.deliveryDate}</span>
                    </div>
                  )}
                  {getUrgencyBadge(task.urgency, task.task_type)}
                </div>
              </div>

              {/* Characteristics & Channels Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Work Types */}
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                    <Layers size={15} className="text-teal-600" />
                    ลักษณะงานที่ขอรับบริการ ({task.custom_payload?.workTypes?.length || 0} รายการ)
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {task.custom_payload?.workTypes && Array.isArray(task.custom_payload.workTypes) && task.custom_payload.workTypes.length > 0 ? (
                      task.custom_payload.workTypes.map((wt: any, idx: number) => (
                        <span key={idx} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.65rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.5rem',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: '#0f172a'
                        }}>
                          <span>✓ {wt.label}</span>
                          {wt.customDetail && (
                            <span style={{ color: '#0d9488', fontWeight: 500, fontSize: '0.775rem' }}>
                              ({wt.customDetail})
                            </span>
                          )}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                    )}
                  </div>
                </div>

                {/* Publishing Channels */}
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                    <Share2 size={15} className="text-teal-600" />
                    ช่องทางที่ต้องการเผยแพร่ ({task.custom_payload?.channels?.length || 0} ช่องทาง)
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {task.custom_payload?.channels && Array.isArray(task.custom_payload.channels) && task.custom_payload.channels.length > 0 ? (
                      task.custom_payload.channels.map((ch: any, idx: number) => (
                        <span key={idx} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.65rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.5rem',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: '#0f172a'
                        }}>
                          <span>📢 {ch.label}</span>
                          {ch.customDetail && (
                            <span style={{ color: '#2563eb', fontWeight: 500, fontSize: '0.775rem' }}>
                              ({ch.customDetail})
                            </span>
                          )}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Description */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <FileText size={15} className="text-teal-600" />
                  รายละเอียดและเนื้อหาที่ต้องการให้ใส่ในสื่อ
                </span>
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '0.65rem',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.9rem',
                  lineHeight: '1.65',
                  whiteSpace: 'pre-line'
                }}>
                  {task.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                </div>
              </div>

              {/* Requester & Contact Info */}
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                fontSize: '0.85rem'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>ผู้ยื่นคำขอ</span>
                  <strong style={{ color: '#0f172a' }}>{task.requester_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>กลุ่มงาน / หน่วยงาน</span>
                  <strong style={{ color: '#0f172a' }}>{task.requester_dept || '-'}</strong>
                </div>
                {task.custom_payload?.phone && (
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>เบอร์โทรติดต่อ</span>
                    <strong style={{ color: '#0d9488' }}>📞 {task.custom_payload.phone}</strong>
                  </div>
                )}
              </div>

              {/* Attachments & Cloud Links */}
              {((task.custom_payload?.attachments && task.custom_payload.attachments.length > 0) || task.custom_payload?.driveLink) && (
                <div style={{ backgroundColor: '#f0fdfa', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #99f6e4', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <FileCheck size={15} />
                    เอกสารแนบและลิงก์ประกอบ
                  </span>

                  {task.custom_payload?.attachments && task.custom_payload.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: task.custom_payload?.driveLink ? '0.75rem' : '0' }}>
                      {task.custom_payload.attachments.map((att: any, idx: number) => (
                        <a
                          key={idx}
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.75rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid #99f6e4',
                            borderRadius: '0.5rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#0f766e',
                            textDecoration: 'none'
                          }}
                        >
                          <FileText size={14} />
                          <span>{att.fileName}</span>
                          <ExternalLink size={12} className="text-teal-500" />
                        </a>
                      ))}
                    </div>
                  )}

                  {task.custom_payload?.driveLink && (
                    <div style={{ fontSize: '0.825rem', paddingTop: '0.5rem', borderTop: task.custom_payload?.attachments?.length ? '1px dashed #99f6e4' : 'none' }}>
                      <span style={{ color: '#0f766e', fontWeight: 600 }}>🔗 ลิงก์ Google Drive / Cloud: </span>
                      <a
                        href={task.custom_payload.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
                      >
                        {task.custom_payload.driveLink}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : repairDetail ? (
            <div className="contentCard">
              <div className="contentCardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="contentCardTitle" style={{ margin: 0 }}>
                  <Wrench size={18} className="text-emerald-600" />
                  <span>รายละเอียดงานแจ้งซ่อมบำรุง</span>
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={14} />
                    <span>แก้ไขข้อมูลแจ้งซ่อม</span>
                  </button>
                )}
              </div>

              {/* Repair Banner */}
              <div className="repairBanner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="repairIconWrap">
                    {repairDetail.repair_type === 'MEDICAL_REPAIR' ? <Stethoscope size={20} /> : <Wrench size={20} />}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                      ประเภทงานแจ้งซ่อมบำรุง
                    </span>
                    <strong style={{ color: '#166534', fontSize: '1rem', fontWeight: 700 }}>
                      {repairDetail.repair_type === 'IT_REPAIR' ? 'งานซ่อมระบบคอมพิวเตอร์ / สารสนเทศ' :
                       repairDetail.repair_type === 'MEDICAL_REPAIR' ? 'งานซ่อมเครื่องมือทางการแพทย์' : 'งานซ่อมช่างทั่วไป / ซ่อมบำรุง'}
                    </strong>
                  </div>
                </div>

                {/* Repair Status Tag */}
                <span className={`statusBadge ${
                  repairDetail.repair_status === 'COMPLETED' ? 'statusApproved' :
                  repairDetail.repair_status === 'IN_PROGRESS' ? 'statusInProgress' :
                  repairDetail.repair_status === 'EXTERNAL_REPAIR' ? 'statusExternal' : 'statusPending'
                }`}>
                  {repairDetail.repair_status === 'COMPLETED' ? '✓ ซ่อมเสร็จสิ้น' :
                   repairDetail.repair_status === 'IN_PROGRESS' ? '⚙ กำลังดำเนินการซ่อม' :
                   repairDetail.repair_status === 'EXTERNAL_REPAIR' ? '↗ ส่งซ่อมภายนอก' : '⏳ รอช่างรับงาน'}
                </span>
              </div>

              {/* Location & Asset Grid */}
              <div className="infoGrid2Col" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <div>
                  <span className="infoItemLabel">ประเภทรายการ</span>
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
                  <span className="infoItemLabel" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MapPin size={13} className="text-emerald-600" />
                    สถานที่ตั้ง / ห้อง / ตึก
                  </span>
                  <div className="infoItemValue" style={{ fontSize: '0.9rem' }}>
                    {repairDetail.location_full_name || '-'}
                  </div>
                </div>

                {repairDetail.item_category === 'EQUIPMENT' ? (
                  <>
                    <div>
                      <span className="infoItemLabel">หมายเลขครุภัณฑ์</span>
                      <span className="taskNoBadge" style={{ fontSize: '0.875rem' }}>
                        {repairDetail.equipment_number || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="infoItemLabel">ชื่อครุภัณฑ์</span>
                      <div className="infoItemValue" style={{ fontSize: '0.9rem' }}>
                        {repairDetail.equipment_name || '-'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="infoItemLabel">รายการที่ชำรุดเสียหาย</span>
                    <div className="infoItemValue" style={{ fontSize: '0.9rem' }}>
                      {repairDetail.non_equipment_item || '-'}
                    </div>
                  </div>
                )}
              </div>

              {/* Symptom Box */}
              <div className="symptomBox">
                <div className="symptomBoxTitle">
                  <AlertCircle size={15} />
                  <span>อาการชำรุด / ปัญหาที่ผู้ใช้แจ้ง</span>
                </div>
                <div className="symptomBoxContent">
                  {repairDetail.symptom_detail || '-'}
                </div>
              </div>

              {/* Photos Grid */}
              {Array.isArray(repairDetail.photos) && repairDetail.photos.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <span className="infoItemLabel">รูปภาพความเสียหายแนบ ({repairDetail.photos.length} รูป)</span>
                  <div className="photoThumbList">
                    {repairDetail.photos.map((photo: string, idx: number) => (
                      <a
                        key={idx}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="photoThumbItem"
                        title="คลิกเพื่อดูภาพขนาดเต็ม"
                      >
                        <img src={photo} alt={`รูปแนบ ${idx + 1}`} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned Technicians */}
              <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.85rem', marginTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
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
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Plus size={12} />
                      เพิ่มช่างร่วมงาน
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.8rem',
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
                        padding: '0.3rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.8rem',
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

              {/* Progress Result Highlights */}
              {(Boolean(repairDetail.found_problem) || Boolean(repairDetail.solution_step) || Boolean(repairDetail.is_external_repair) || repairDetail.cost_type === 'HAS_COST') && (
                <div style={{
                  marginTop: '1rem',
                  backgroundColor: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '0.65rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem'
                }}>
                  <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', borderBottom: '1px solid #edf2f7', paddingBottom: '0.35rem' }}>
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

              {/* Technician Action Buttons Control */}
              {(currentUser?.isCurrentAssignee || currentUser?.isCoWorker || currentUser?.isAdmin) && (
                <div className="technicianActionBox">
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.65rem' }}>
                    แผงควบคุมการดำเนินงานช่าง
                  </span>
                  <div className="actionButtonRow">
                    {repairDetail.repair_status === 'WAITING' && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleAcceptJob}
                          className="btnAcceptJob"
                        >
                          <CheckCircle size={16} />
                          <span>กดรับงานซ่อม (Accept Job)</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setIsCancelModalOpen(true)}
                          className="btnCancelJob"
                        >
                          <XCircle size={16} />
                          <span>ปฏิเสธ / ยกเลิกงาน</span>
                        </button>
                      </>
                    )}

                    {(repairDetail.repair_status === 'IN_PROGRESS' || repairDetail.repair_status === 'EXTERNAL_REPAIR') && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setIsRepairProgressModalOpen(true)}
                          className="btnProgressAction"
                        >
                          <Edit3 size={15} />
                          <span>บันทึกผลการซ่อม / ส่งภายนอก</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleCompleteRepair}
                          className="btnCompleteJob"
                        >
                          <CheckCircle2 size={16} />
                          <span>ซ่อมเสร็จสิ้น (Complete Repair)</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setIsCancelModalOpen(true)}
                          className="btnCancelJob"
                        >
                          <XCircle size={16} />
                          <span>ยกเลิกงานซ่อม</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Requester Cancel Option (if pending) */}
              {currentUser?.isRequester && task.status === 'PENDING' && !currentUser?.isCurrentAssignee && !currentUser?.isCoWorker && !currentUser?.isAdmin && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setIsCancelModalOpen(true)}
                    className="btnCancelJob"
                  >
                    <XCircle size={16} />
                    <span>ยกเลิกคำร้องแจ้งซ่อมนี้</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="contentCard">
              <div className="contentCardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="contentCardTitle" style={{ margin: 0 }}>
                  <FileText size={18} className="text-blue-600" />
                  <span>รายละเอียดงาน / บันทึกข้อความ</span>
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={14} />
                    <span>แก้ไขข้อมูลคำขอ</span>
                  </button>
                )}
              </div>

              {task.description ? (
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  {task.description}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.875rem' }}>
                  ไม่มีรายละเอียดเพิ่มเติม
                </div>
              )}

              {/* Custom Payload */}
              {task.custom_payload && (
                <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '0.65rem', border: '1px solid #bfdbfe', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#1e40af', fontSize: '0.85rem' }}>ข้อมูลเฉพาะด้าน ({task.task_type})</strong>
                    {isMyTurn && (
                      <button
                        type="button"
                        onClick={() => setIsEditingPayload(!isEditingPayload)}
                        style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
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
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '0.25rem' }}>
                        บันทึกความเห็น / ปรับงบประมาณก่อนอนุมัติ (Audit Logged)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น ระบุวงเงินงบประมาณ หรือหมายเหตุเพิ่มเติม..."
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #93c5fd', fontSize: '0.85rem', backgroundColor: 'white' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Box: General Non-Repair Task Approval or Step > 1 Signer */}
          {isMyTurn && (!repairDetail || task.current_step_no > 1) ? (
            <div className="approvalCard">
              <div className="approvalHeader">
                <ShieldCheck size={22} />
                <h3>คิวงานรอคุณลงนาม / พิจารณาอนุมัติ</h3>
              </div>

              {!currentUser?.hasSignature && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.825rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>
                    คุณยังไม่ได้ตั้งค่าลายเซ็นดิจิทัล สามารถ{' '}
                    <Link href="/member/signature" target="_blank" style={{ textDecoration: 'underline', fontWeight: 700 }}>
                      คลิกเพื่อตั้งค่าลายเซ็นที่นี่
                    </Link>{' '}
                    ก่อนกดอนุมัติเพื่อประทับลงในเอกสาร
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', color: '#334155' }}>
                  ข้อความบันทึกความเห็น / คำสั่งการ
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น อนุมัติเห็นชอบตามเสนอ, มอบหมายงาน, หรือเหตุผลที่ให้แก้ไข..."
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  className="commentTextarea"
                />
              </div>

              <div className="actionButtonRow" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('APPROVE')}
                  className="btnApprove"
                >
                  <CheckCircle size={16} />
                  <span>
                    {task.task_type === 'MEDIA_REQUEST' && (currentStep?.step_name?.includes('เสร็จสิ้น') || task.current_step_no === steps.length)
                      ? 'เสร็จสิ้น / ส่งมอบงาน (Complete)'
                      : task.task_type === 'MEDIA_REQUEST' && (currentStep?.step_name?.includes('ผลิตสื่อ') || currentStep?.step_name?.includes('สั่งพิมพ์'))
                      ? 'บันทึกเริ่มผลิตสื่อ (In Progress)'
                      : 'ลงนามอนุมัติ (Approve)'}
                  </span>
                </button>

                {taskPermissions.canHold && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setIsHoldModalOpen(true)}
                    className="btnHoldJob"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      padding: '0.6rem 1rem',
                      borderRadius: '0.5rem',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    <PauseCircle size={16} />
                    <span>พักงาน (Hold)</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('SEND_BACK')}
                  className="btnSendBack"
                >
                  <AlertCircle size={16} />
                  <span>ส่งกลับแก้ไข (Send Back)</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('REJECT')}
                  className="btnReject"
                >
                  <XCircle size={16} />
                  <span>ไม่อนุมัติ (Reject)</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Request Info, Workflow Timeline & Audit Logs */}
        <div>
          {/* 1. ข้อมูลคำร้อง (Request Info Card - Top Right) */}
          <div className="contentCard">
            <div className="contentCardHeader">
              <h3 className="contentCardTitle">
                <FileText size={18} className="text-blue-600" />
                <span>ข้อมูลคำร้อง</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <span className="infoItemLabel">ผู้ยื่นคำขอ</span>
                <div className="infoItemValue">{task.requester_name}</div>
                <div className="infoItemSub">{task.requester_dept || '-'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #f1f5f9' }}>
                <div>
                  <span className="infoItemLabel">วันที่ยื่นเรื่อง</span>
                  <div className="infoItemValue" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>
                    {formatThaiDate(task.created_at)}
                  </div>
                </div>
                <div>
                  <span className="infoItemLabel">ความเร่งด่วน</span>
                  <div>{getUrgencyBadge(task.urgency, task.task_type)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #f1f5f9' }}>
                <div>
                  <span className="infoItemLabel">รหัสใบงาน</span>
                  <span className="taskNoBadge">{task.task_no}</span>
                </div>
                <div>
                  <span className="infoItemLabel">ประเภทงาน</span>
                  <div>{getTypeBadge(task.task_type)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ขั้นตอนการอนุมัติ (Workflow Timeline) */}
          <div className="contentCard">
            <div className="contentCardHeader">
              <h3 className="contentCardTitle">
                <Clock size={18} className="text-blue-600" />
                <span>ขั้นตอนการอนุมัติ (Workflow Timeline)</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {steps.map((st) => {
                const isCurrent = st.step_no === task.current_step_no && task.status === 'PENDING'
                const isDone = st.status === 'COMPLETED'
                const isRejected = st.status === 'REJECTED'

                return (
                  <div
                    key={st.id}
                    className={`timelineStepCard ${isDone ? 'isDone' : isRejected ? 'isRejected' : isCurrent ? 'isCurrent' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                        ขั้นตอนที่ {st.step_no}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isDone ? '#16a34a' : isRejected ? '#dc2626' : isCurrent ? '#2563eb' : '#94a3b8',
                      }}>
                        {isDone ? '✓ อนุมัติแล้ว' : isRejected ? '✗ ไม่อนุมัติ' : isCurrent ? '● กำลังรอพิจารณา' : 'รอดำเนินการ'}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.2rem' }}>
                      {st.step_name}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      ผู้รับผิดชอบ: {st.assigned_to_name || st.assigned_role || 'ผู้รับมอบหมาย'}
                    </div>

                    {st.action_by_name && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '0.8rem' }}>
                        <div style={{ color: '#0f172a' }}>
                          ลงนามโดย: <strong>{st.action_by_name}</strong>
                        </div>
                        <div style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                          {formatThaiDate(st.action_at)}
                        </div>
                        {st.comment && (
                          <div style={{ marginTop: '0.25rem', fontStyle: 'italic', color: '#334155' }}>
                            "{st.comment}"
                          </div>
                        )}
                        {st.signature_path && (
                          <div style={{ marginTop: '0.4rem' }}>
                            <span style={{ fontSize: '0.725rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                              <ShieldCheck size={13} />
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

          {/* 3. ประวัติการดำเนินงาน (Audit Trail) */}
          <div className="contentCard">
            <div className="contentCardHeader">
              <h3 className="contentCardTitle" style={{ fontSize: '0.95rem' }}>
                <History size={16} className="text-slate-600" />
                <span>ประวัติการดำเนินงาน (Audit Trail)</span>
              </h3>
            </div>

            <div style={{ maxHeight: '240px', overflowY: 'auto', fontSize: '0.775rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#334155' }}>{log.action}</strong>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatThaiDate(log.created_at)}</span>
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
        <div className="modalBackdrop">
          <div className="modalContent">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
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
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
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
                className="backBtn"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!selectedCoWorkerId || actionLoading}
                onClick={handleAddCoWorker}
                className="btnApprove"
              >
                เพิ่มผู้ร่วมงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Save Repair Progress / External Repair / Costs ── */}
      {isRepairProgressModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '560px' }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="repairNature"
                      checked={repairProgressForm.repairNature === 'NORMAL'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, repairNature: 'NORMAL' }))}
                    />
                    ส่งซ่อมปกติ
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
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
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
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
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* ส่งซ่อมภายนอก หรือไม่ */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      checked={repairProgressForm.costType === 'NO_COST'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, costType: 'NO_COST', costAmount: '' }))}
                    />
                    ไม่มีค่าใช้จ่าย
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
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
                  className="backBtn"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btnProgressAction"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cancel / Reject Job Confirmation ── */}
      {isCancelModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsCancelModalOpen(false)}>
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
                onClick={() => setIsCancelModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
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
                onClick={() => setIsCancelModalOpen(false)}
                className="backBtn"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={handleCancelJob}
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
                {actionLoading ? <Clock size={16} className="animate-spin" /> : <XCircle size={16} />}
                <span>ยืนยันยกเลิกงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: Manager Edit Task Details Modal ── */}
      {isEditTaskModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsEditTaskModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit3 size={18} className="text-teal-600" />
                  <span>แก้ไขข้อมูลคำขอ</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  สำหรับผู้ดูแลระบบและผู้มีสิทธิ์จัดการงาน ({task.task_no})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTaskModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTaskEdit}>
              {/* ชื่องาน / หัวข้องาน */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  หัวข้องาน / รายการคำขอ <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTaskForm.title}
                  onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* ความเร่งด่วน */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  ระดับความเร่งด่วน
                </label>
                <select
                  value={editTaskForm.urgency}
                  onChange={(e) => setEditTaskForm(prev => ({ ...prev, urgency: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', backgroundColor: 'white' }}
                >
                  <option value="NORMAL">● {task.task_type === 'MEDIA_REQUEST' ? 'ไม่ด่วน' : 'ปกติ'}</option>
                  <option value="URGENT">● ด่วน</option>
                  <option value="VERY_URGENT">● ด่วนที่สุด</option>
                </select>
              </div>

              {/* Media Request Specific Fields */}
              {task.task_type === 'MEDIA_REQUEST' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1rem' }}>
                  {/* กำหนดการ & รูปแบบค่าใช้จ่าย */}
                  <div style={{ backgroundColor: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.65rem', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f766e', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={16} />
                      <span>กำหนดส่งมอบและรูปแบบค่าใช้จ่าย</span>
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.85rem' }}>
                      {/* Delivery Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#134e4a', marginBottom: '0.25rem' }}>
                          ขอรับงานภายในวันที่ / กำหนดส่งมอบ
                        </label>
                        <input
                          type="date"
                          value={editTaskForm.deliveryDate}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #99f6e4', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                        />
                      </div>

                      {/* Cost Type Radio */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#134e4a', marginBottom: '0.25rem' }}>
                          รูปแบบค่าใช้จ่าย
                        </label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minHeight: '38px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', color: '#0f766e' }}>
                            <input
                              type="radio"
                              name="editCostType"
                              value="NO_COST"
                              checked={editTaskForm.costType === 'NO_COST'}
                              onChange={() => setEditTaskForm(prev => ({ ...prev, costType: 'NO_COST', estimatedBudget: '' }))}
                            />
                            <span>🟢 ไม่มีค่าใช้จ่าย</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', color: '#b91c1c' }}>
                            <input
                              type="radio"
                              name="editCostType"
                              value="HAS_COST"
                              checked={editTaskForm.costType === 'HAS_COST'}
                              onChange={() => setEditTaskForm(prev => ({ ...prev, costType: 'HAS_COST' }))}
                            />
                            <span>🔴 มีค่าใช้จ่าย</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Estimated Budget if HAS_COST */}
                    {editTaskForm.costType === 'HAS_COST' && (
                      <div style={{ borderTop: '1px dashed #99f6e4', paddingTop: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#134e4a', marginBottom: '0.25rem' }}>
                          ประมาณการงบประมาณ (บาท) <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="เช่น 2500"
                          value={editTaskForm.estimatedBudget}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, estimatedBudget: e.target.value }))}
                          style={{ width: '100%', maxWidth: '300px', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #99f6e4', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* ลักษณะงานที่ขอรับบริการ (Work Types) */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Layers size={16} className="text-teal-600" />
                      <span>ลักษณะงานที่ขอรับบริการ (เลือกลักษณะงานที่ต้องการ)</span>
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      {WORK_TYPES_CONFIG.map((cfg) => {
                        const isSelected = !!editTaskForm.selectedWorkTypes[cfg.key]?.selected
                        return (
                          <div
                            key={cfg.key}
                            onClick={() => toggleEditWorkType(cfg.key)}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: isSelected ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              transition: 'all 0.15s ease',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by div onClick
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f766e' : '#334155' }}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Inputs for Work Types with custom details */}
                    {WORK_TYPES_CONFIG.filter((cfg) => cfg.hasCustomInput && editTaskForm.selectedWorkTypes[cfg.key]?.selected).map((cfg) => (
                      <div key={cfg.key} style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f766e', marginBottom: '0.3rem' }}>
                          รายละเอียด/ขนาดสำหรับ {cfg.label}:
                        </label>
                        <input
                          type="text"
                          placeholder={cfg.placeholder}
                          value={editTaskForm.selectedWorkTypes[cfg.key]?.customDetail || ''}
                          onChange={(e) => setEditWorkTypeDetail(cfg.key, e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.825rem', marginBottom: '0.4rem' }}
                        />
                        {cfg.quickTags && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {cfg.quickTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setEditWorkTypeDetail(cfg.key, tag)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '0.3rem',
                                  cursor: 'pointer',
                                  color: '#475569',
                                }}
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ช่องทางเผยแพร่ (Channels) */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Share2 size={16} className="text-teal-600" />
                      <span>ช่องทางที่ต้องการเผยแพร่</span>
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      {CHANNELS_CONFIG.map((cfg) => {
                        const isSelected = !!editTaskForm.selectedChannels[cfg.key]?.selected
                        return (
                          <div
                            key={cfg.key}
                            onClick={() => toggleEditChannel(cfg.key)}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: isSelected ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              transition: 'all 0.15s ease',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by div onClick
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f766e' : '#334155' }}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Inputs for Channels with custom details */}
                    {CHANNELS_CONFIG.filter((cfg) => cfg.hasCustomInput && editTaskForm.selectedChannels[cfg.key]?.selected).map((cfg) => (
                      <div key={cfg.key} style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f766e', marginBottom: '0.3rem' }}>
                          จุด/บริเวณ สำหรับ {cfg.label}:
                        </label>
                        <input
                          type="text"
                          placeholder={cfg.placeholder}
                          value={editTaskForm.selectedChannels[cfg.key]?.customDetail || ''}
                          onChange={(e) => setEditChannelDetail(cfg.key, e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.825rem', marginBottom: '0.4rem' }}
                        />
                        {cfg.quickTags && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {cfg.quickTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setEditChannelDetail(cfg.key, tag)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '0.3rem',
                                  cursor: 'pointer',
                                  color: '#475569',
                                }}
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* รายละเอียดเนื้อหาในสื่อ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      รายละเอียดและข้อความที่ต้องการให้ใส่ในสื่อ
                    </label>
                    <textarea
                      rows={3}
                      value={editTaskForm.description}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="ระบุข้อความ กำหนดการ หรือเนื้อหาที่ต้องการให้ออกแบบในสื่อ"
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    />
                  </div>

                  {/* เบอร์โทร & ลิงก์ Cloud */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        เบอร์โทรติดต่อ
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น 081-234-5678"
                        value={editTaskForm.phone}
                        onChange={(e) => setEditTaskForm(prev => ({ ...prev, phone: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        ลิงก์ Google Drive / Cloud
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={editTaskForm.driveLink}
                        onChange={(e) => setEditTaskForm(prev => ({ ...prev, driveLink: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {/* รายการไฟล์แนบ (Attachments) */}
                  <div style={{ backgroundColor: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.65rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileCheck size={16} />
                        ไฟล์แนบประกอบ ({editTaskForm.attachments.length} ไฟล์)
                      </span>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#ffffff',
                          color: '#0f766e',
                          border: '1px solid #99f6e4',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: isUploadingEditFiles ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isUploadingEditFiles ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        <span>{isUploadingEditFiles ? 'กำลังอัปโหลด...' : 'แนบไฟล์เพิ่ม'}</span>
                        <input
                          type="file"
                          multiple
                          onChange={handleEditFileUpload}
                          disabled={isUploadingEditFiles}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    {editTaskForm.attachments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {editTaskForm.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: '#ffffff',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.4rem',
                              border: '1px solid #ccfbf1',
                              fontSize: '0.825rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {getFileIcon(att.fileName)}
                              <a
                                href={att.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {att.fileName}
                              </a>
                              {att.fileSize ? (
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({formatFileSize(att.fileSize)})</span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveEditAttachment(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}
                              title="ลบไฟล์แนบนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '0.75rem 0' }}>
                        ไม่มีไฟล์แนบ (สามารถคลิกปุ่ม &quot;แนบไฟล์เพิ่ม&quot; ด้านบนเพื่อเพิ่มไฟล์ได้)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Repair Tasks Specific Fields */}
              {['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type) && (
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Wrench size={16} />
                    <span>ข้อมูลรายการซ่อม</span>
                  </h4>

                  {/* Item Category */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      ประเภทรายการ
                    </label>
                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="editItemCategory"
                          value="EQUIPMENT"
                          checked={editTaskForm.itemCategory === 'EQUIPMENT'}
                          onChange={() => setEditTaskForm(prev => ({ ...prev, itemCategory: 'EQUIPMENT' }))}
                        />
                        <span>ครุภัณฑ์ (มีหมายเลขครุภัณฑ์)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="editItemCategory"
                          value="NON_EQUIPMENT"
                          checked={editTaskForm.itemCategory === 'NON_EQUIPMENT'}
                          onChange={() => setEditTaskForm(prev => ({ ...prev, itemCategory: 'NON_EQUIPMENT' }))}
                        />
                        <span>งานซ่อมทั่วไป / สถานที่ (ไม่มีหมายเลข)</span>
                      </label>
                    </div>
                  </div>

                  {editTaskForm.itemCategory === 'EQUIPMENT' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          หมายเลขครุภัณฑ์
                        </label>
                        <input
                          type="text"
                          value={editTaskForm.equipmentNumber}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, equipmentNumber: e.target.value }))}
                          placeholder="เช่น 7440-001-0001"
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          ชื่ออุปกรณ์ / รายการครุภัณฑ์
                        </label>
                        <input
                          type="text"
                          value={editTaskForm.equipmentName}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, equipmentName: e.target.value }))}
                          placeholder="เช่น เครื่องคอมพิวเตอร์ All-in-One"
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        รายการสิ่งของ / รายการซ่อม
                      </label>
                      <input
                        type="text"
                        value={editTaskForm.nonEquipmentItem}
                        onChange={(e) => setEditTaskForm(prev => ({ ...prev, nonEquipmentItem: e.target.value }))}
                        placeholder="เช่น ซ่อมก๊อกน้ำห้องน้ำผู้ป่วย, หลอดไฟทางเดินดับ"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  )}

                  {/* Location */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      สถานที่ตั้ง / หน่วยงาน / ห้อง
                    </label>
                    <input
                      type="text"
                      value={editTaskForm.locationFullName}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, locationFullName: e.target.value }))}
                      placeholder="เช่น อาคารผู้ป่วยนอก ชั้น 1 ห้องตรวจ 3"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Symptom Detail */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      อาการชำรุด / ปัญหาที่พบ
                    </label>
                    <textarea
                      rows={2}
                      value={editTaskForm.symptomDetail}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, symptomDetail: e.target.value }))}
                      placeholder="ระบุอาการชำรุด หรือรายละเอียดปัญหาที่แจ้งซ่อม"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {/* General task description (if not Media or Repair) */}
              {task.task_type !== 'MEDIA_REQUEST' && !['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    รายละเอียดคำขอ
                  </label>
                  <textarea
                    rows={3}
                    value={editTaskForm.description}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditTaskModalOpen(false)}
                  className="backBtn"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f766e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 1.35rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)',
                  }}
                >
                  {actionLoading ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Hold Task Modal ── */}
      {isHoldModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hold-modal-title"
          className="modalOverlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="modalCard"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                backgroundColor: '#fffbeb',
                borderBottom: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PauseCircle className="text-amber-600 w-5 h-5" />
                <h3 id="hold-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#92400e' }}>
                  พักการดำเนินงานชั่วคราว (Hold Task)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHoldModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                  เลือกเหตุผลในการพักงาน <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    'รอการจัดสรรงบ',
                    'ต้องการหารือรายละเอียดเพิ่มเติม',
                    'อื่นๆ',
                  ].map((r) => (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: holdReason === r ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                        backgroundColor: holdReason === r ? '#fffbeb' : '#ffffff',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: holdReason === r ? 600 : 400,
                        color: holdReason === r ? '#92400e' : '#334155',
                      }}
                    >
                      <input
                        type="radio"
                        name="holdReasonRadio"
                        value={r}
                        checked={holdReason === r}
                        onChange={() => setHoldReason(r)}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {holdReason === 'อื่นๆ' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    ระบุเหตุผลอื่นๆ <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น รอประสานงานร้านป้ายภายนอก, รอยืนยันไฟล์ต้นฉบับ..."
                    value={holdCustomReason}
                    onChange={(e) => setHoldCustomReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  รายละเอียด / หมายเหตุเพิ่มเติม (ระบุหรือไม่ก็ได้)
                </label>
                <textarea
                  rows={3}
                  placeholder="ระบุข้อความชี้แจงสำหรับผู้ยื่นคำขอ..."
                  value={holdDetails}
                  onChange={(e) => setHoldDetails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                  }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                💡 เมื่อบันทึกพักงาน ระบบจะเปลี่ยนสถานะเป็น <strong>พักงานชั่วคราว</strong> และส่งข้อความแจ้งเตือนพร้อมเหตุผลไปยังผู้ยื่นคำขอทาง Telegram ทันที
              </div>
            </div>

            <div
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setIsHoldModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={actionLoading || (holdReason === 'อื่นๆ' && !holdCustomReason.trim())}
                onClick={handleHoldTask}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)',
                }}
              >
                {actionLoading ? <Clock size={16} className="animate-spin" /> : <PauseCircle size={16} />}
                <span>ยืนยันพักงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
