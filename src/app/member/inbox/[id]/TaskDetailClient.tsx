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
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react'
import dynamic from 'next/dynamic'

const TaskHoldModal = dynamic(() => import('./components/TaskHoldModal'), {
  ssr: false,
})

const MediaRequestCompleteModal = dynamic(() => import('./components/MediaRequestCompleteModal'), {
  ssr: false,
})

const TaskRepairModals = dynamic(() => import('./components/TaskRepairModals'), {
  ssr: false,
})

const TaskSendBackModal = dynamic(() => import('./components/TaskSendBackModal'), {
  ssr: false,
})

import { resolveTaskPermissions } from '@/lib/taskPermissionResolver'
import {
  WORK_TYPES_CONFIG,
  CHANNELS_CONFIG,
  formatFileSize,
  getFileIcon,
  RepairPhotoItem,
  type TaskStep,
  type TaskAudit,
} from './components/taskDetailConfig'
import { TaskWorkflowSidebar } from './components/TaskWorkflowSidebar'
import { TaskManagerEditModal } from './components/TaskManagerEditModal'
import { TaskRepairDetailCard } from './components/TaskRepairDetailCard'
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

  // Timeline collapsible view state
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(false)
  const [isAuditTrailExpanded, setIsAuditTrailExpanded] = useState<boolean>(false)

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

  // Media Request Immediate Complete Modal State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false)
  const [completeComment, setCompleteComment] = useState<string>('')

  // Send Back Modal State
  const [isSendBackModalOpen, setIsSendBackModalOpen] = useState<boolean>(false)
  const [sendBackTargetStepNo, setSendBackTargetStepNo] = useState<number | null>(null)
  const [sendBackToRequester, setSendBackToRequester] = useState<boolean>(false)
  const [sendBackComment, setSendBackComment] = useState<string>('')

  // Manager Edit Task Modal State
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState<boolean>(false)
  const [isUploadingEditFiles, setIsUploadingEditFiles] = useState<boolean>(false)
  const [isUploadingEditQuotations, setIsUploadingEditQuotations] = useState<boolean>(false)
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
    quotations: [] as Array<{ fileName: string; filePath: string; fileType?: string; fileSize?: number }>,
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
      quotations: Array.isArray(payload.quotations) ? [...payload.quotations] : [],
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
        if (file.name && file.name.length > 80) {
          alert(`ไม่อนุญาตให้ตั้งชื่อไฟล์ยาวเกิน 80 ตัวอักษร\n(ไฟล์ "${file.name}" ยาว ${file.name.length} ตัวอักษร)\n\nกรุณาเปลี่ยนชื่อไฟล์ให้สั้นลงก่อนอัปโหลด`)
          continue
        }
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

  const handleEditQuotationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingEditQuotations(true)
    try {
      const files = Array.from(e.target.files)
      const newFiles: any[] = []
      for (const file of files) {
        if (file.name && file.name.length > 80) {
          alert(`ไม่อนุญาตให้ตั้งชื่อไฟล์ยาวเกิน 80 ตัวอักษร\n(ไฟล์ "${file.name}" ยาว ${file.name.length} ตัวอักษร)\n\nกรุณาเปลี่ยนชื่อไฟล์ให้สั้นลงก่อนอัปโหลด`)
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          alert(`ไฟล์ใบเสนอราคา "${file.name}" มีขนาดเกิน 10MB`)
          continue
        }
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', `media-quotation-edit-${task?.task_no || 'task'}`)
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
        quotations: [...prev.quotations, ...newFiles]
      }))
    } catch (err) {
      console.error('Quotation file upload error:', err)
    } finally {
      setIsUploadingEditQuotations(false)
      e.target.value = ''
    }
  }

  const handleRemoveEditQuotation = (index: number) => {
    setEditTaskForm(prev => ({
      ...prev,
      quotations: prev.quotations.filter((_, i) => i !== index)
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
        bodyPayload.quotations = editTaskForm.costType === 'HAS_COST' ? editTaskForm.quotations : []
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

  // ── Send Back Modal Handlers ──
  const handleOpenSendBackModal = () => {
    const currentStepNo = task?.current_step_no || 1
    const defaultTarget = currentStepNo > 1 ? currentStepNo - 1 : 1
    setSendBackTargetStepNo(defaultTarget)
    setSendBackToRequester(currentStepNo <= 1)
    setSendBackComment(actionComment.trim() || '')
    setIsSendBackModalOpen(true)
  }

  const handleConfirmSendBack = async () => {
    if (!sendBackComment.trim()) {
      setError('กรุณาระบุความคิดเห็น / เหตุผลในการส่งกลับแก้ไข')
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(`/api/member/inbox/${taskId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_BACK',
          comment: sendBackComment,
          targetStepNo: sendBackToRequester ? 1 : sendBackTargetStepNo,
          sendToRequester: sendBackToRequester,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg(
          sendBackToRequester || (sendBackTargetStepNo === 1 && (task?.current_step_no || 1) <= 1)
            ? 'ส่งกลับเอกสารให้ผู้ยื่นคำขอแก้ไขเรียบร้อยแล้ว'
            : `ส่งกลับเอกสารไปยังขั้นตอนที่ ${sendBackTargetStepNo} เรียบร้อยแล้ว`
        )
        setActionComment('')
        setSendBackComment('')
        setIsSendBackModalOpen(false)
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

  // ── Media Request Immediate Complete Handler ──
  const handleCompleteMediaRequest = async () => {
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/member/inbox/${taskId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE',
          comment: completeComment.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg('ดำเนินการเสร็จสิ้นคำขอสื่อประชาสัมพันธ์เรียบร้อยแล้ว')
        setIsCompleteModalOpen(false)
        setCompleteComment('')
        await loadData()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการประมวลผล')
      }
    } catch {
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

  const formatThaiOnlyDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const parts = dateStr.split('T')[0].split('-')
      if (parts.length === 3) {
        let y = parseInt(parts[0], 10)
        if (y > 2400) y -= 543
        const m = parseInt(parts[1], 10) - 1
        const d = parseInt(parts[2], 10)
        const dateObj = new Date(y, m, d)
        return new Intl.DateTimeFormat('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(dateObj)
      }
      const d = new Date(dateStr)
      if (d.getFullYear() > 2400) {
        d.setFullYear(d.getFullYear() - 543)
      }
      return new Intl.DateTimeFormat('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
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
          <div className="detailHeaderBadgeRow">
            <span className="taskNoBadge">{task.task_no}</span>
            {getTypeBadge(task.task_type)}
            <span className={`statusBadge ${
              task.status === 'APPROVED' ? 'statusApproved' :
              task.status === 'REJECTED' ? 'statusRejected' :
              task.status === 'SENT_BACK' ? 'statusSentBack' : 
              task.status === 'ON_HOLD' ? 'statusOnHold' :
              task.status === 'IN_PROGRESS' ? 'statusInProgress' : 'statusPending'
            }`}>
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
            className="btnPrintA4Action"
          >
            <Printer size={16} />
            <span>พิมพ์ใบงาน (A4)</span>
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="btnEditTaskAction"
            >
              <Edit3 size={16} />
              <span>แก้ไขข้อมูลคำขอ</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts Banner ── */}
      {error && (
        <div className="alertBannerError">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alertBannerSuccess">
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── On Hold Notification Banner ── */}
      {task.status === 'ON_HOLD' && (
        <div className="onHoldBannerCard">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div className="onHoldBannerIcon">
              <PauseCircle size={24} />
            </div>
            <div>
              <h4 className="onHoldBannerTitle">
                งานนี้ถูกพักการดำเนินการชั่วคราว (On Hold)
              </h4>
              <div className="onHoldBannerDetails">
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
              className="btnResumeTask"
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
              <div className="mediaDetailSummaryCard">
                <div>
                  <span className="mediaCostHeaderLabel">
                    รูปแบบค่าใช้จ่าย / การพิจารณา
                  </span>
                  <strong className={`mediaCostValueText ${task.custom_payload?.costType === 'HAS_COST' ? 'hasCost' : 'noCost'}`}>
                    <span className={`costBullet ${task.custom_payload?.costType === 'HAS_COST' ? 'costBulletHasCost' : 'costBulletNoCost'}`} aria-hidden="true" />
                    <span>{task.custom_payload?.costType === 'HAS_COST' ? 'มีค่าใช้จ่าย' : 'ไม่มีค่าใช้จ่าย'}</span>
                    {task.custom_payload?.costType === 'HAS_COST' && task.custom_payload?.estimatedBudget ? (
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991b1b' }}>
                        (ประมาณการ {Number(task.custom_payload.estimatedBudget).toLocaleString()} บาท)
                      </span>
                    ) : null}
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {task.custom_payload?.deliveryDate && (
                    <div className="deliveryDateTag">
                      <Calendar size={14} />
                      <span>ขอรับงานภายใน: {formatThaiOnlyDate(task.custom_payload.deliveryDate)}</span>
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
                        <span key={idx} className="mediaPillTag">
                          <Check size={12} className="text-emerald-700 flex-shrink-0" />
                          <span>{wt.label}</span>
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
                        <span key={idx} className="mediaPillTag">
                          <Share2 size={12} className="text-teal-700 flex-shrink-0" />
                          <span>{ch.label}</span>
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
                <div className="detailDescriptionBlock">
                  {task.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                </div>
              </div>

              {/* Requester & Contact Info */}
              <div className="requesterInfoGrid">
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
                    <strong style={{ color: '#0d9488', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Phone size={13} className="flex-shrink-0" />
                      <span>{task.custom_payload.phone}</span>
                    </strong>
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
                    <div className="attachmentListWrap" style={{ marginBottom: task.custom_payload?.driveLink ? '0.75rem' : '0' }}>
                      {task.custom_payload.attachments.map((att: any, idx: number) => (
                        <a
                          key={idx}
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachmentLinkItem"
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
                      <span style={{ color: '#0f766e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <ExternalLink size={13} className="flex-shrink-0" />
                        <span>ลิงก์ Google Drive / Cloud: </span>
                      </span>
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

              {/* Quotations Card (Shown if quotations present) */}
              {task.custom_payload?.quotations && Array.isArray(task.custom_payload.quotations) && task.custom_payload.quotations.length > 0 && (
                <div className="quotationsContainer">
                  <div className="quotationHeaderRow">
                    <span className="quotationTitle">
                      <FileSpreadsheet size={16} className="text-emerald-600" />
                      เอกสารใบเสนอราคา (Quotation) ({task.custom_payload.quotations.length} ไฟล์)
                    </span>
                    <span className="quotationTag">
                      งบประมาณ / จัดซื้อจัดจ้าง
                    </span>
                  </div>

                  <div className="attachmentListWrap">
                    {task.custom_payload.quotations.map((q: any, idx: number) => (
                      <a
                        key={idx}
                        href={q.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="quotationCard"
                      >
                        {getFileIcon(q.fileName)}
                        <span>{q.fileName}</span>
                        {q.fileSize ? (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>
                            ({formatFileSize(q.fileSize)})
                          </span>
                        ) : null}
                        <ExternalLink size={13} className="text-emerald-600" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : repairDetail ? (
            <TaskRepairDetailCard
              task={task}
              repairDetail={repairDetail}
              currentUser={currentUser}
              canEdit={canEdit}
              actionLoading={actionLoading}
              handleOpenEditModal={handleOpenEditModal}
              setIsCoWorkerModalOpen={setIsCoWorkerModalOpen}
              handleRemoveCoWorker={handleRemoveCoWorker}
              handleAcceptJob={handleAcceptJob}
              setIsCancelModalOpen={setIsCancelModalOpen}
              setIsRepairProgressModalOpen={setIsRepairProgressModalOpen}
              handleCompleteRepair={handleCompleteRepair}
            />
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
                <div className="noSignatureNotice">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>
                    คุณยังไม่ได้ตั้งค่าลายเซ็นดิจิทัล สามารถ{' '}
                    <Link href="/member/signature" target="_blank">
                      คลิกเพื่อตั้งค่าลายเซ็นที่นี่
                    </Link>{' '}
                    ก่อนกดอนุมัติเพื่อประทับลงในเอกสาร
                  </span>
                </div>
              )}

              {/* Send Back Notice if previous step was sent back */}
              {(() => {
                const sendBackNoticeStep = steps.find((s) => s.action_taken === 'SEND_BACK')
                if (!sendBackNoticeStep) return null
                return (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '0.625rem',
                      fontSize: '0.85rem',
                      color: '#92400e',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                      <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                      <span>คำขอนี้ถูกส่งกลับมาแก้ไขจาก: {sendBackNoticeStep.step_name}</span>
                    </div>
                    <div style={{ color: '#78350f' }}>
                      ส่งกลับโดย: <strong>{sendBackNoticeStep.action_by_name || 'ผู้พิจารณา'}</strong>
                      {sendBackNoticeStep.comment ? ` — เหตุผล: "${sendBackNoticeStep.comment}"` : ''}
                    </div>
                  </div>
                )
              })()}

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

              <div className="actionButtonRow">
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

                {task.task_type === 'MEDIA_REQUEST' && (taskPermissions.isPrStaff || taskPermissions.isAdmin) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setIsCompleteModalOpen(true)}
                    className="btnCompleteImmediate"
                    title="จบขั้นตอนทันทีและส่งแจ้งเตือนเข้ากลุ่มสื่อประชาสัมพันธ์"
                  >
                    <CheckCircle2 size={16} />
                    <span>เสร็จสิ้น (ปิดงานทันที)</span>
                  </button>
                )}

                {taskPermissions.canHold && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setIsHoldModalOpen(true)}
                    className="btnHoldJob"
                  >
                    <PauseCircle size={16} />
                    <span>พักงาน (Hold)</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleOpenSendBackModal}
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

          {/* Action Box for PR Staff / Admin when not direct signer turn */}
          {!isMyTurn && task.task_type === 'MEDIA_REQUEST' && (taskPermissions.isPrStaff || taskPermissions.isAdmin) && task.status !== 'APPROVED' && task.status !== 'REJECTED' && (
            <div className="approvalCard" style={{ borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' }}>
              <div className="approvalHeader">
                <CheckCircle2 size={22} className="text-emerald-700" />
                <h3 style={{ color: '#166534' }}>การจัดการสำหรับเจ้าหน้าที่ประชาสัมพันธ์</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#166534', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                ปัจจุบันงานอยู่ในขั้นตอนที่ {task.current_step_no} ({currentStep?.step_name || 'รอดำเนินการ'}) ท่านสามารถกดปิดงานเสร็จสิ้นได้ทันทีหากการจัดทำสื่อเสร็จสมบูรณ์แล้ว
              </p>
              <div className="actionButtonRow">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCompleteModalOpen(true)}
                  className="btnCompleteImmediate"
                  title="จบขั้นตอนทันทีและส่งแจ้งเตือนเข้ากลุ่มสื่อประชาสัมพันธ์"
                >
                  <CheckCircle2 size={16} />
                  <span>เสร็จสิ้น (ปิดงานทันที)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <TaskWorkflowSidebar
          task={task}
          steps={steps}
          auditLogs={auditLogs}
          isTimelineExpanded={isTimelineExpanded}
          setIsTimelineExpanded={setIsTimelineExpanded}
          isAuditTrailExpanded={isAuditTrailExpanded}
          setIsAuditTrailExpanded={setIsAuditTrailExpanded}
          formatThaiDate={formatThaiDate}
          getUrgencyBadge={getUrgencyBadge}
          getTypeBadge={getTypeBadge}
        />
      </div>

      <TaskRepairModals
        isCoWorkerModalOpen={isCoWorkerModalOpen}
        setIsCoWorkerModalOpen={setIsCoWorkerModalOpen}
        selectedCoWorkerId={selectedCoWorkerId}
        setSelectedCoWorkerId={setSelectedCoWorkerId}
        allMembers={allMembers}
        repairDetail={repairDetail}
        actionLoading={actionLoading}
        handleAddCoWorker={handleAddCoWorker}
        isRepairProgressModalOpen={isRepairProgressModalOpen}
        setIsRepairProgressModalOpen={setIsRepairProgressModalOpen}
        repairProgressForm={repairProgressForm}
        setRepairProgressForm={setRepairProgressForm}
        handleSaveRepairProgress={handleSaveRepairProgress}
        isCancelModalOpen={isCancelModalOpen}
        setIsCancelModalOpen={setIsCancelModalOpen}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        handleCancelJob={handleCancelJob}
      />

      <TaskManagerEditModal
        isEditTaskModalOpen={isEditTaskModalOpen}
        setIsEditTaskModalOpen={setIsEditTaskModalOpen}
        task={task}
        editTaskForm={editTaskForm}
        setEditTaskForm={setEditTaskForm}
        handleSaveTaskEdit={handleSaveTaskEdit}
        toggleEditWorkType={toggleEditWorkType}
        setEditWorkTypeDetail={setEditWorkTypeDetail}
        toggleEditChannel={toggleEditChannel}
        setEditChannelDetail={setEditChannelDetail}
        isUploadingEditFiles={isUploadingEditFiles}
        handleEditFileUpload={handleEditFileUpload}
        handleRemoveEditAttachment={handleRemoveEditAttachment}
        isUploadingEditQuotations={isUploadingEditQuotations}
        handleEditQuotationUpload={handleEditQuotationUpload}
        handleRemoveEditQuotation={handleRemoveEditQuotation}
        actionLoading={actionLoading}
      />

      <TaskHoldModal
        isOpen={isHoldModalOpen}
        onClose={() => setIsHoldModalOpen(false)}
        holdReason={holdReason}
        setHoldReason={setHoldReason}
        holdCustomReason={holdCustomReason}
        setHoldCustomReason={setHoldCustomReason}
        holdDetails={holdDetails}
        setHoldDetails={setHoldDetails}
        actionLoading={actionLoading}
        handleHoldTask={handleHoldTask}
      />

      <MediaRequestCompleteModal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        taskNo={task.task_no}
        taskTitle={task.title}
        completeComment={completeComment}
        setCompleteComment={setCompleteComment}
        actionLoading={actionLoading}
        handleCompleteMediaRequest={handleCompleteMediaRequest}
      />

      <TaskSendBackModal
        isOpen={isSendBackModalOpen}
        onClose={() => setIsSendBackModalOpen(false)}
        taskNo={task.task_no}
        taskTitle={task.title}
        requesterName={task.requester_name}
        currentStepNo={task.current_step_no}
        currentStepName={currentStep?.step_name}
        steps={steps}
        selectedTargetStepNo={sendBackTargetStepNo}
        setSelectedTargetStepNo={setSendBackTargetStepNo}
        sendToRequester={sendBackToRequester}
        setSendToRequester={setSendBackToRequester}
        comment={sendBackComment}
        setComment={setSendBackComment}
        actionLoading={actionLoading}
        onConfirm={handleConfirmSendBack}
      />
    </div>
  )
}
