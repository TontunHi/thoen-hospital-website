'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Trash2,
  Shield,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Coins,
  Newspaper,
  Save,
  RefreshCw,
  Users,
  Pill,
  FileSpreadsheet,
  Scale,
  Inbox,
  Package,
  Palette,
  Monitor,
  HeartPulse,
  Wrench,
  Building2,
  Search,
  Filter,
  Check,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  LayoutGrid,
  UserCheck,
  Sliders,
  UserCog,
  CheckSquare,
  Square,
  Lock,
  BadgeCheck,
  User,
  Eye,
  RotateCcw,
  Briefcase,
  SlidersHorizontal,
} from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import {
  TASK_DEFINITIONS,
  TaskDefinition,
  TaskRoleConfig,
  PermRoleType,
} from '@/lib/permissions/taskDefinitions'

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

export interface MemberItem {
  id: number
  username: string
  name: string
  department: string
  position: string
  role: string
  permissions: string[]
}

export interface PositionMappingItem {
  id: number
  permissionKey: string
  positionName: string
}

const ICON_MAP: Record<string, any> = {
  Palette,
  Monitor,
  Wrench,
  HeartPulse,
  Inbox,
  Coins,
  Package,
  FileSpreadsheet,
  Scale,
  BookOpen: Layers,
  Pill,
  Newspaper,
}

const ROLE_TYPE_CONFIG: Record<
  PermRoleType,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  view: {
    label: 'View (ดูข้อมูล)',
    icon: Eye,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  edit: {
    label: 'Edit / Do (ปฏิบัติงาน)',
    icon: Wrench,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  approve: {
    label: 'Approve (อนุมัติ/ตรวจรับ)',
    icon: CheckCircle2,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
  },
  manage: {
    label: 'Manage (ผู้ดูแลงาน)',
    icon: Shield,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
}

const AVATAR_COLORS = [
  { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
  { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' },
]

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function maskIdentifier(val?: string | null): string {
  if (!val) return ''
  const clean = val.trim()
  if (clean.length <= 4) return '****'
  if (/^\d{13}$/.test(clean)) {
    return `x-xxxx-xxxx${clean[9]}-${clean.slice(10, 12)}-${clean[12]}`
  }
  return `x-xxxx-xxxxx-${clean.slice(-4)}`
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  // Top Tabs State: 'tasks' | 'inspector' | 'features'
  const [activeTab, setActiveTab] = useState<'tasks' | 'inspector' | 'features'>('tasks')

  // Feature Toggles state
  const [featureInbox, setFeatureInbox] = useState(initialSettings['feature_inbox'] !== '0')
  const [featureSignature, setFeatureSignature] = useState(initialSettings['feature_signature'] !== '0')
  const [featureSalary, setFeatureSalary] = useState(initialSettings['feature_salary'] !== '0')
  const [featureIta, setFeatureIta] = useState(initialSettings['feature_ita'] !== '0')
  const [featureRdu, setFeatureRdu] = useState(initialSettings['feature_rdu'] !== '0')
  const [featureRepair, setFeatureRepair] = useState(initialSettings['feature_repair'] !== '0')
  const [featureMediaRequest, setFeatureMediaRequest] = useState(initialSettings['feature_media_request'] !== '0')

  const [initialFeatureState, setInitialFeatureState] = useState({
    featureInbox: initialSettings['feature_inbox'] !== '0',
    featureSignature: initialSettings['feature_signature'] !== '0',
    featureSalary: initialSettings['feature_salary'] !== '0',
    featureIta: initialSettings['feature_ita'] !== '0',
    featureRdu: initialSettings['feature_rdu'] !== '0',
    featureRepair: initialSettings['feature_repair'] !== '0',
    featureMediaRequest: initialSettings['feature_media_request'] !== '0',
  })

  const isFeaturesDirty = useMemo(() => {
    return (
      featureInbox !== initialFeatureState.featureInbox ||
      featureSignature !== initialFeatureState.featureSignature ||
      featureSalary !== initialFeatureState.featureSalary ||
      featureIta !== initialFeatureState.featureIta ||
      featureRdu !== initialFeatureState.featureRdu ||
      featureRepair !== initialFeatureState.featureRepair ||
      featureMediaRequest !== initialFeatureState.featureMediaRequest
    )
  }, [
    featureInbox,
    featureSignature,
    featureSalary,
    featureIta,
    featureRdu,
    featureRepair,
    featureMediaRequest,
    initialFeatureState,
  ])

  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Task-Centric Data & State
  const [tasks, setTasks] = useState<TaskDefinition[]>(TASK_DEFINITIONS)
  const [members, setMembers] = useState<MemberItem[]>([])
  const [positionMappings, setPositionMappings] = useState<PositionMappingItem[]>([])
  const [availablePositions, setAvailablePositions] = useState<string[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Selected Task in Left Sidebar
  const [selectedTaskId, setSelectedTaskId] = useState<string>('MEDIA_REQUEST')
  const [taskSearchQuery, setTaskSearchQuery] = useState('')

  // Add Assignee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [targetTask, setTargetTask] = useState<TaskDefinition | null>(null)
  const [targetRole, setTargetRole] = useState<TaskRoleConfig | null>(null)
  const [addMode, setAddMode] = useState<'member' | 'position'>('member')
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [positionSearchQuery, setPositionSearchQuery] = useState('')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all')
  const [isActionPending, setIsActionPending] = useState(false)

  // Member Inspector State
  const [inspectorSearch, setInspectorSearch] = useState('')
  const [inspectorDeptFilter, setInspectorDeptFilter] = useState('all')
  const [selectedInspectorMemberId, setSelectedInspectorMemberId] = useState<number | null>(null)

  // Fine-grained Edit Member Modal
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null)
  const [editingMemberPerms, setEditingMemberPerms] = useState<string[]>([])
  const [isSavingMemberPerms, setIsSavingMemberPerms] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Load Task-Centric Data
  const loadTaskData = async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/member/permissions/tasks')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          if (data.data.tasks) setTasks(data.data.tasks)
          if (data.data.members) setMembers(data.data.members)
          if (data.data.availablePositions) setAvailablePositions(data.data.availablePositions)
          if (data.data.positionMappings) setPositionMappings(data.data.positionMappings)
        }
      } else {
        addToast('ไม่สามารถโหลดข้อมูลสิทธิ์ตามงานได้', 'error')
      }
    } catch (error) {
      console.error('Failed to load task data:', error)
      addToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadTaskData()
  }, [])

  // Unique departments
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>()
    members.forEach((m) => {
      if (m.department && m.department.trim()) {
        set.add(m.department.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [members])

  // Count of staff per position
  const positionMemberCounts = useMemo(() => {
    const map: Record<string, number> = {}
    members.forEach((m) => {
      if (m.position && m.position.trim()) {
        const pos = m.position.trim()
        map[pos] = (map[pos] || 0) + 1
      }
    })
    return map
  }, [members])

  // Current selected task
  const currentTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || tasks[0]
  }, [tasks, selectedTaskId])

  // Filtered tasks in left sidebar
  const filteredTasks = useMemo(() => {
    if (!taskSearchQuery.trim()) return tasks
    const q = taskSearchQuery.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.roles.some((r) => r.label.toLowerCase().includes(q) || r.shortLabel.toLowerCase().includes(q))
    )
  }, [tasks, taskSearchQuery])

  // Split tasks by category
  const workflowTasks = useMemo(
    () => filteredTasks.filter((t) => t.category === 'workflow'),
    [filteredTasks]
  )
  const systemTasks = useMemo(
    () => filteredTasks.filter((t) => t.category === 'system'),
    [filteredTasks]
  )

  // Helper to get assigned members for a permission key
  const getAssignedMembersForPerm = (permKey: string): MemberItem[] => {
    return members.filter((m) => m.permissions.includes(permKey))
  }

  // Helper to get assigned positions for a permission key
  const getAssignedPositionsForPerm = (permKey: string): string[] => {
    return positionMappings
      .filter((p) => p.permissionKey === permKey)
      .map((p) => p.positionName)
  }

  // Check if a member has a permission (either directly or via position or admin)
  const hasMemberPermissionEffective = (
    member: MemberItem,
    permKey: string
  ): { hasPerm: boolean; origin: 'member' | 'position' | 'admin' | null } => {
    if (member.role === 'admin') return { hasPerm: true, origin: 'admin' }
    if (member.permissions.includes(permKey)) return { hasPerm: true, origin: 'member' }
    const pos = (member.position || '').trim()
    if (pos && positionMappings.some((p) => p.permissionKey === permKey && p.positionName === pos)) {
      return { hasPerm: true, origin: 'position' }
    }
    return { hasPerm: false, origin: null }
  }

  // Open Add Assignee Modal for a specific Task and Role
  const handleOpenAddModal = (task: TaskDefinition, role: TaskRoleConfig) => {
    setTargetTask(task)
    setTargetRole(role)
    setMemberSearchQuery('')
    setPositionSearchQuery('')
    setSelectedDeptFilter('all')
    setAddMode('member')
    setIsAddModalOpen(true)
  }

  // Grant permission to member (Instant Save)
  const handleGrantMember = async (member: MemberItem, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'member',
          memberId: member.id,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการมอบสิทธิ์')
      }

      // Update local state instantly
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, permissions: Array.from(new Set([...m.permissions, role.permissionKey])) }
            : m
        )
      )
      addToast(data.message || `เพิ่มสิทธิ์ให้ ${member.name} สำเร็จ`, 'success')
    } catch (err: any) {
      console.error('Grant member error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการมอบสิทธิ์', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Revoke permission from member (Instant Save)
  const handleRevokeMember = async (member: MemberItem, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'member',
          memberId: member.id,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการปลดสิทธิ์')
      }

      // Update local state instantly
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, permissions: m.permissions.filter((k) => k !== role.permissionKey) }
            : m
        )
      )
      addToast(data.message || `ปลดสิทธิ์ของ ${member.name} เรียบร้อยแล้ว`, 'info')
    } catch (err: any) {
      console.error('Revoke member error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการปลดสิทธิ์', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Grant permission to position (Instant Save)
  const handleGrantPosition = async (positionName: string, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'position',
          positionName,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการมอบสิทธิ์ตำแหน่ง')
      }

      // Update local state instantly
      setPositionMappings((prev) => [
        ...prev,
        { id: Date.now(), permissionKey: role.permissionKey, positionName },
      ])
      addToast(data.message || `เพิ่มสิทธิ์สำหรับตำแหน่ง "${positionName}" สำเร็จ`, 'success')
    } catch (err: any) {
      console.error('Grant position error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการมอบสิทธิ์ตำแหน่ง', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Revoke permission from position (Instant Save)
  const handleRevokePosition = async (positionName: string, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'position',
          positionName,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการปลดสิทธิ์ตำแหน่ง')
      }

      // Update local state instantly
      setPositionMappings((prev) =>
        prev.filter(
          (p) => !(p.permissionKey === role.permissionKey && p.positionName === positionName)
        )
      )
      addToast(data.message || `ปลดสิทธิ์สำหรับตำแหน่ง "${positionName}" เรียบร้อยแล้ว`, 'info')
    } catch (err: any) {
      console.error('Revoke position error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการปลดสิทธิ์ตำแหน่ง', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Feature Toggles Save
  const handleSaveFeatures = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSavingSettings(true)
    try {
      const payload = {
        feature_inbox: featureInbox ? '1' : '0',
        feature_signature: featureSignature ? '1' : '0',
        feature_salary: featureSalary ? '1' : '0',
        feature_ita: featureIta ? '1' : '0',
        feature_rdu: featureRdu ? '1' : '0',
        feature_repair: featureRepair ? '1' : '0',
        feature_media_request: featureMediaRequest ? '1' : '0',
      }
      const res = await fetch('/api/member/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก')

      setInitialFeatureState({
        featureInbox,
        featureSignature,
        featureSalary,
        featureIta,
        featureRdu,
        featureRepair,
        featureMediaRequest,
      })
      addToast('บันทึกการตั้งค่าเปิด/ปิดโมดูลระบบเรียบร้อยแล้ว', 'success')
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Filtered members in Inspector
  const filteredInspectorMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesDept =
        inspectorDeptFilter === 'all' || m.department?.trim() === inspectorDeptFilter
      const q = inspectorSearch.trim().toLowerCase()
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.position.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q)
      return matchesDept && matchesSearch
    })
  }, [members, inspectorSearch, inspectorDeptFilter])

  // Selected Inspector Member Object
  const selectedInspectorMember = useMemo(() => {
    if (!selectedInspectorMemberId) return filteredInspectorMembers[0] || null
    return members.find((m) => m.id === selectedInspectorMemberId) || null
  }, [members, selectedInspectorMemberId, filteredInspectorMembers])

  // Filtered members in Add Modal
  const modalFilteredMembers = useMemo(() => {
    if (!targetRole) return []
    const permKey = targetRole.permissionKey
    return members.filter((m) => {
      const matchesDept =
        selectedDeptFilter === 'all' || m.department?.trim() === selectedDeptFilter
      const q = memberSearchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.position.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q)
      return matchesDept && matchesSearch
    })
  }, [members, memberSearchQuery, selectedDeptFilter, targetRole])

  // Filtered positions in Add Modal
  const modalFilteredPositions = useMemo(() => {
    const q = positionSearchQuery.trim().toLowerCase()
    return availablePositions.filter((pos) => !q || pos.toLowerCase().includes(q))
  }, [availablePositions, positionSearchQuery])

  // Handler for opening full member edit modal
  const handleOpenEditMemberModal = (member: MemberItem) => {
    setEditingMember(member)
    setEditingMemberPerms([...member.permissions])
  }

  const handleSaveMemberAllPerms = async () => {
    if (!editingMember) return
    setIsSavingMemberPerms(true)
    try {
      const res = await fetch('/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingMember.id,
          permissions: editingMemberPerms,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์')
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id ? { ...m, permissions: editingMemberPerms } : m
        )
      )
      addToast(`บันทึกสิทธิ์ของคุณ ${editingMember.name} เรียบร้อยแล้ว`, 'success')
      setEditingMember(null)
    } catch (err: any) {
      console.error('Save member all perms failed:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingMemberPerms(false)
    }
  }

  return (
    <div className="settingsClientModern">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Main Top Navigation Tabs */}
      <div className="settingsMainTabs">
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`settingsMainTabBtn ${activeTab === 'tasks' ? 'active' : ''}`}
        >
          <div className="tabIconBox">
            <Sparkles size={18} />
          </div>
          <div className="tabTextBox">
            <span className="tabTitle">กำหนดสิทธิ์ตามภารกิจงาน</span>
            <span className="tabSub">Task-Centric Permissions (แนะนำ)</span>
          </div>
          <span className="tabBadge">{tasks.length} งาน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inspector')}
          className={`settingsMainTabBtn ${activeTab === 'inspector' ? 'active' : ''}`}
        >
          <div className="tabIconBox">
            <UserCheck size={18} />
          </div>
          <div className="tabTextBox">
            <span className="tabTitle">ตรวจสอบสิทธิ์รายบุคคล</span>
            <span className="tabSub">Member Permission Inspector</span>
          </div>
          <span className="tabBadge secondary">{members.length} บุคลากร</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('features')}
          className={`settingsMainTabBtn ${activeTab === 'features' ? 'active' : ''}`}
        >
          <div className="tabIconBox">
            <Sliders size={18} />
          </div>
          <div className="tabTextBox">
            <span className="tabTitle">เปิด/ปิดโมดูลระบบบริการ</span>
            <span className="tabSub">Feature Toggles & Modules</span>
          </div>
          {isFeaturesDirty && <span className="tabBadge dirty">มีแก้ไข</span>}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: TASK-CENTRIC PERMISSIONS (MAIN VIEW)
          ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="taskCentricContainer">
          {/* Left Column: Task Navigator */}
          <aside className="taskSidebarPane">
            <div className="taskSidebarHeader">
              <div className="taskSidebarSearchWrapper">
                <Search size={16} className="searchIcon" />
                <input
                  type="text"
                  placeholder="ค้นหาภารกิจงาน..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="taskSidebarSearchInput"
                />
                {taskSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTaskSearchQuery('')}
                    className="clearSearchBtn"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="taskNavScrollable">
              {/* Category 1: Workflow Tasks */}
              {workflowTasks.length > 0 && (
                <div className="taskNavGroup">
                  <div className="taskNavGroupHeader">
                    <Sparkles size={14} className="groupIcon groupIconWorkflow" />
                    <span>งานบริการ & กล่องงาน (Workflow)</span>
                    <span className="groupCount">{workflowTasks.length}</span>
                  </div>
                  <div className="taskNavList">
                    {workflowTasks.map((task) => {
                      const Icon = ICON_MAP[task.iconName] || Layers
                      const isSelected = selectedTaskId === task.id
                      const totalAssignedMembers = task.roles.reduce(
                        (acc, r) => acc + getAssignedMembersForPerm(r.permissionKey).length,
                        0
                      )
                      const totalAssignedPositions = task.roles.reduce(
                        (acc, r) => acc + getAssignedPositionsForPerm(r.permissionKey).length,
                        0
                      )

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`taskNavItem ${isSelected ? 'active' : ''}`}
                        >
                          <div
                            className="taskNavIconBox"
                            style={{
                              backgroundColor: `${task.badgeColor}15`,
                              color: task.badgeColor,
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="taskNavInfo">
                            <span className="taskNavName">{task.name}</span>
                            <span className="taskNavRolesCount">
                              {task.roles.length} บทบาท ({totalAssignedMembers} คน
                              {totalAssignedPositions > 0 ? `, ${totalAssignedPositions} ตำแหน่ง` : ''})
                            </span>
                          </div>
                          <ChevronRight size={16} className="taskNavArrow" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Category 2: System & Governance Modules */}
              {systemTasks.length > 0 && (
                <div className="taskNavGroup">
                  <div className="taskNavGroupHeader">
                    <Building2 size={14} className="groupIcon groupIconSystem" />
                    <span>ระบบบริหาร & กำกับดูแล (System)</span>
                    <span className="groupCount">{systemTasks.length}</span>
                  </div>
                  <div className="taskNavList">
                    {systemTasks.map((task) => {
                      const Icon = ICON_MAP[task.iconName] || Layers
                      const isSelected = selectedTaskId === task.id
                      const totalAssignedMembers = task.roles.reduce(
                        (acc, r) => acc + getAssignedMembersForPerm(r.permissionKey).length,
                        0
                      )
                      const totalAssignedPositions = task.roles.reduce(
                        (acc, r) => acc + getAssignedPositionsForPerm(r.permissionKey).length,
                        0
                      )

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`taskNavItem ${isSelected ? 'active' : ''}`}
                        >
                          <div
                            className="taskNavIconBox"
                            style={{
                              backgroundColor: `${task.badgeColor}15`,
                              color: task.badgeColor,
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="taskNavInfo">
                            <span className="taskNavName">{task.name}</span>
                            <span className="taskNavRolesCount">
                              {task.roles.length} บทบาท ({totalAssignedMembers} คน
                              {totalAssignedPositions > 0 ? `, ${totalAssignedPositions} ตำแหน่ง` : ''})
                            </span>
                          </div>
                          <ChevronRight size={16} className="taskNavArrow" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {filteredTasks.length === 0 && (
                <div className="taskEmptySearch">
                  <Search size={28} />
                  <p>ไม่พบภารกิจงานที่ตรงกับการค้นหา</p>
                </div>
              )}
            </div>
          </aside>

          {/* Right Column: Task Workspace & 4 Roles Board */}
          <main className="taskWorkspacePane">
            {currentTask && (
              <>
                {/* Task Header Banner */}
                <div
                  className="taskWorkspaceHeader"
                  style={{ borderLeftColor: currentTask.badgeColor }}
                >
                  <div className="taskWorkspaceHeaderLeft">
                    <div
                      className="taskHeaderIconBox"
                      style={{
                        backgroundColor: `${currentTask.badgeColor}15`,
                        color: currentTask.badgeColor,
                      }}
                    >
                      {React.createElement(ICON_MAP[currentTask.iconName] || Layers, {
                        size: 28,
                      })}
                    </div>
                    <div className="taskHeaderMeta">
                      <div className="taskHeaderCategoryBadge">
                        <span>{currentTask.categoryLabel}</span>
                        <span className="dotDivider">•</span>
                        <span>รหัสงาน: {currentTask.id}</span>
                      </div>
                      <h2 className="taskHeaderTitle">{currentTask.name}</h2>
                      <p className="taskHeaderDesc">{currentTask.description}</p>
                    </div>
                  </div>

                  <div className="taskWorkspaceHeaderStats">
                    <div className="taskStatBadge">
                      <Users size={16} />
                      <span>
                        กำหนดแล้ว{' '}
                        <strong>
                          {currentTask.roles.reduce(
                            (acc, r) => acc + getAssignedMembersForPerm(r.permissionKey).length,
                            0
                          )}
                        </strong>{' '}
                        คน
                      </span>
                    </div>
                    <div className="taskStatBadge positionBadge">
                      <Briefcase size={16} />
                      <span>
                        ผูกตำแหน่ง{' '}
                        <strong>
                          {currentTask.roles.reduce(
                            (acc, r) => acc + getAssignedPositionsForPerm(r.permissionKey).length,
                            0
                          )}
                        </strong>{' '}
                        ตำแหน่ง
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role Boards Grid */}
                <div className="rolesGridContainer">
                  {currentTask.roles.map((role) => {
                    const roleCfg = ROLE_TYPE_CONFIG[role.roleType]
                    const assignedMembers = getAssignedMembersForPerm(role.permissionKey)
                    const assignedPositions = getAssignedPositionsForPerm(role.permissionKey)
                    const RoleIcon = roleCfg.icon

                    return (
                      <div key={role.permissionKey} className="roleBoardCard">
                        <div className="roleBoardHeader">
                          <div className="roleBoardTitleRow">
                            <div
                              className="roleIconBox"
                              style={{
                                backgroundColor: roleCfg.bg,
                                color: roleCfg.color,
                                borderColor: roleCfg.border,
                              }}
                            >
                              <RoleIcon size={16} />
                            </div>
                            <div className="roleTitleMeta">
                              <h3 className="roleTitleText">{role.label}</h3>
                              <span className="roleKeyBadge">{role.permissionKey}</span>
                            </div>
                          </div>

                          <span
                            className="roleTypeTag"
                            style={{
                              backgroundColor: roleCfg.bg,
                              color: roleCfg.color,
                              borderColor: roleCfg.border,
                            }}
                          >
                            {roleCfg.label}
                          </span>
                        </div>

                        <p className="roleDescriptionText">{role.description}</p>

                        {/* Allowed Actions Pills */}
                        {role.allowedActions && role.allowedActions.length > 0 && (
                          <div className="roleActionsWrapper">
                            <span className="roleActionsLabel">ขอบเขตอำนาจหน้าที่:</span>
                            <div className="roleActionPills">
                              {role.allowedActions.map((action, i) => (
                                <span key={i} className="actionPill">
                                  <Check size={11} />
                                  {action}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assigned Section */}
                        <div className="roleAssignedSection">
                          {/* 1. Assigned Positions */}
                          {assignedPositions.length > 0 && (
                            <div className="assignedGroup">
                              <div className="assignedGroupTitle">
                                <Briefcase size={13} />
                                <span>ตามตำแหน่งงาน ({assignedPositions.length})</span>
                              </div>
                              <div className="assignedChipsList">
                                {assignedPositions.map((pos) => (
                                  <div key={pos} className="positionChip">
                                    <span className="chipName">{pos}</span>
                                    {positionMemberCounts[pos] && (
                                      <span className="chipCount">
                                        ({positionMemberCounts[pos]} คน)
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRevokePosition(pos, role)}
                                      className="chipRemoveBtn"
                                      title={`ปลดสิทธิ์ของตำแหน่ง ${pos}`}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 2. Assigned Members (Individual) */}
                          <div className="assignedGroup">
                            <div className="assignedGroupTitle">
                              <Users size={13} />
                              <span>รายบุคคล ({assignedMembers.length})</span>
                            </div>

                            {assignedMembers.length > 0 ? (
                              <div className="assignedChipsList">
                                {assignedMembers.map((member) => {
                                  const avColor = getAvatarColor(member.id)
                                  return (
                                    <div key={member.id} className="memberChip">
                                      <div
                                        className="memberAvatarMini"
                                        style={{
                                          backgroundColor: avColor.bg,
                                          color: avColor.text,
                                        }}
                                      >
                                        {member.name.charAt(0) || 'U'}
                                      </div>
                                      <div className="memberChipInfo">
                                        <span className="memberName">{member.name}</span>
                                        <span className="memberSub">
                                          {member.position || member.department || 'เจ้าหน้าที่'}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeMember(member, role)}
                                        className="chipRemoveBtn"
                                        title={`ปลดสิทธิ์ของคุณ ${member.name}`}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : assignedPositions.length === 0 ? (
                              <div className="roleEmptyNotice">
                                <Info size={14} />
                                <span>ยังไม่มีการกำหนดผู้รับผิดชอบในบทบาทนี้</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Card Footer: Quick Add Button */}
                        <div className="roleBoardFooter">
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(currentTask, role)}
                            className="addAssigneeBtn"
                          >
                            <Plus size={15} />
                            <span>เพิ่มผู้รับผิดชอบในบทบาทนี้</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MEMBER PERMISSION INSPECTOR
          ========================================================================= */}
      {activeTab === 'inspector' && (
        <div className="inspectorContainer">
          {/* Left Column: Member Search & List */}
          <aside className="inspectorSidebar">
            <div className="inspectorSearchBox">
              <div className="searchInputWrapper">
                <Search size={16} className="searchIcon" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, ตำแหน่ง, เลขบัตร..."
                  value={inspectorSearch}
                  onChange={(e) => setInspectorSearch(e.target.value)}
                  className="inspectorInput"
                />
                {inspectorSearch && (
                  <button
                    type="button"
                    onClick={() => setInspectorSearch('')}
                    className="clearSearchBtn"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={inspectorDeptFilter}
                onChange={(e) => setInspectorDeptFilter(e.target.value)}
                className="inspectorDeptSelect"
              >
                <option value="all">ทุกกลุ่มงาน / ฝ่าย ({members.length})</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="inspectorMemberList">
              {filteredInspectorMembers.map((m) => {
                const isSelected = (selectedInspectorMember?.id || 0) === m.id
                const avColor = getAvatarColor(m.id)
                const totalPerms = m.permissions.length
                const isAdmin = m.role === 'admin'

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedInspectorMemberId(m.id)}
                    className={`inspectorMemberItem ${isSelected ? 'active' : ''}`}
                  >
                    <div
                      className="memberAvatar"
                      style={{ backgroundColor: avColor.bg, color: avColor.text }}
                    >
                      {m.name.charAt(0) || 'U'}
                    </div>
                    <div className="memberDetails">
                      <div className="memberNameRow">
                        <span className="nameText">{m.name}</span>
                        {isAdmin && <span className="adminTag">ADMIN</span>}
                      </div>
                      <span className="positionText">{m.position || 'ไม่ระบุตำแหน่ง'}</span>
                      <span className="deptText">{m.department || 'ไม่ระบุฝ่าย'}</span>
                    </div>
                    <div className="permCountBadge">
                      {isAdmin ? (
                        <Shield size={14} className="shieldGold" />
                      ) : (
                        <span>{totalPerms} สิทธิ์</span>
                      )}
                    </div>
                  </button>
                )
              })}

              {filteredInspectorMembers.length === 0 && (
                <div className="inspectorEmptySearch">
                  <User size={32} />
                  <p>ไม่พบบุคลากรที่ตรงกับเงื่อนไขการค้นหา</p>
                </div>
              )}
            </div>
          </aside>

          {/* Right Column: Detailed Member Inspector Card */}
          <main className="inspectorMainPane">
            {selectedInspectorMember ? (
              <div className="inspectorProfileCard">
                {/* Profile Header */}
                <div className="inspectorProfileHeader">
                  <div className="profileLeft">
                    <div
                      className="profileAvatarLarge"
                      style={{
                        backgroundColor: getAvatarColor(selectedInspectorMember.id).bg,
                        color: getAvatarColor(selectedInspectorMember.id).text,
                      }}
                    >
                      {selectedInspectorMember.name.charAt(0) || 'U'}
                    </div>
                    <div className="profileMeta">
                      <div className="profileTitleRow">
                        <h2>{selectedInspectorMember.name}</h2>
                        {selectedInspectorMember.role === 'admin' ? (
                          <span className="roleBadgeAdmin">
                            <Shield size={14} />
                            ผู้ดูแลระบบสูงสุด (Super Admin)
                          </span>
                        ) : (
                          <span className="roleBadgeMember">
                            <UserCheck size={14} />
                            บุคลากรโรงพยาบาล
                          </span>
                        )}
                      </div>
                      <div className="profileSubRow">
                        <span>
                          <strong>ตำแหน่ง:</strong> {selectedInspectorMember.position || '-'}
                        </span>
                        <span className="dotDivider">•</span>
                        <span>
                          <strong>กลุ่มงาน/ฝ่าย:</strong> {selectedInspectorMember.department || '-'}
                        </span>
                        <span className="dotDivider">•</span>
                        <span>
                          <strong>รหัสบัตร/ผู้ใช้:</strong>{' '}
                          {maskIdentifier(selectedInspectorMember.username)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="profileRight">
                    <button
                      type="button"
                      onClick={() => handleOpenEditMemberModal(selectedInspectorMember)}
                      className="editAllPermsBtn"
                    >
                      <UserCog size={16} />
                      <span>ปรับสิทธิ์ละเอียด (รายคน)</span>
                    </button>
                  </div>
                </div>

                {/* Permissions Breakdown by Task */}
                <div className="inspectorTasksSection">
                  <div className="sectionHeading">
                    <Sparkles size={18} />
                    <h3>สรุปสิทธิ์การเข้าถึงและการปฏิบัติงานในแต่ละภารกิจ</h3>
                  </div>

                  <div className="inspectorTasksGrid">
                    {tasks.map((task) => {
                      const Icon = ICON_MAP[task.iconName] || Layers
                      const rolesSummary = task.roles.map((role) => {
                        const effective = hasMemberPermissionEffective(
                          selectedInspectorMember,
                          role.permissionKey
                        )
                        return {
                          role,
                          hasPerm: effective.hasPerm,
                          origin: effective.origin,
                        }
                      })

                      const hasAnyPerm = rolesSummary.some((r) => r.hasPerm)

                      return (
                        <div
                          key={task.id}
                          className={`inspectorTaskCard ${hasAnyPerm ? 'hasAccess' : 'noAccess'}`}
                        >
                          <div className="inspectorTaskCardHeader">
                            <div
                              className="taskCardIcon"
                              style={{
                                backgroundColor: `${task.badgeColor}15`,
                                color: task.badgeColor,
                              }}
                            >
                              <Icon size={18} />
                            </div>
                            <div className="taskCardMeta">
                              <h4>{task.name}</h4>
                              <span className="taskCatLabel">{task.categoryLabel}</span>
                            </div>
                          </div>

                          <div className="inspectorRolePillsList">
                            {rolesSummary.map(({ role, hasPerm, origin }) => {
                              const roleCfg = ROLE_TYPE_CONFIG[role.roleType]
                              return (
                                <div
                                  key={role.permissionKey}
                                  className={`inspectorRoleRow ${hasPerm ? 'granted' : 'denied'}`}
                                >
                                  <div className="roleRowLeft">
                                    <span
                                      className="roleTypeMiniDot"
                                      style={{ backgroundColor: roleCfg.color }}
                                    />
                                    <span className="roleRowName">{role.shortLabel}</span>
                                  </div>

                                  <div className="roleRowRight">
                                    {hasPerm ? (
                                      <span
                                        className={`originBadge origin-${origin || 'member'}`}
                                        title={`ที่มา: ${
                                          origin === 'admin'
                                            ? 'สิทธิ์ Super Admin'
                                            : origin === 'position'
                                            ? `ผูกตามตำแหน่ง "${selectedInspectorMember.position}"`
                                            : 'กำหนดเจาะจงรายบุคคล'
                                        }`}
                                      >
                                        <Check size={11} />
                                        {origin === 'admin'
                                          ? 'Admin'
                                          : origin === 'position'
                                          ? 'ตามตำแหน่ง'
                                          : 'รายบุคคล'}
                                      </span>
                                    ) : (
                                      <span className="deniedBadge">ไม่มีสิทธิ์</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="inspectorEmptySelect">
                <Users size={48} />
                <h3>กรุณาเลือกบุคลากรจากรายการทางด้านซ้าย</h3>
                <p>เพื่อตรวจสอบสรุปสิทธิ์การเข้าถึงและการปฏิบัติงานในทุกระบบของโรงพยาบาล</p>
              </div>
            )}
          </main>
        </div>
      )}

      {/* =========================================================================
          TAB 3: FEATURE TOGGLES & SYSTEM MODULES
          ========================================================================= */}
      {activeTab === 'features' && (
        <div className="featureTogglesContainer">
          <div className="featureTogglesHeader">
            <div className="headerLeft">
              <h2>สวิตช์ควบคุมการเปิด/ปิดโมดูลระบบบริการ</h2>
              <p>
                เปิดหรือปิดการแสดงผลโมดูลบริการหลักสำหรับบุคลากรในพอร์ทัลสมาชิก
                เมื่อปิดการใช้งาน เมนูดังกล่าวจะไม่แสดงบนหน้าแดชบอร์ด
              </p>
            </div>
            <div className="headerRight">
              <button
                type="button"
                onClick={handleSaveFeatures}
                disabled={!isFeaturesDirty || isSavingSettings}
                className={`saveFeaturesBtn ${isFeaturesDirty ? 'dirty' : ''}`}
              >
                {isSavingSettings ? (
                  <RefreshCw size={16} className="spinIcon" />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าโมดูล'}</span>
              </button>
            </div>
          </div>

          <div className="featureCardsGrid">
            {/* Inbox */}
            <div className={`featureCard ${featureInbox ? 'active' : ''}`}>
              <div className="featureCardIconBox iconTeal">
                <Inbox size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>กล่องงานและระบบสายการอนุมัติ (Task Inbox)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureInbox}
                      onChange={(e) => setFeatureInbox(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>
                  ระบบกล่องงานกลางสำหรับรับ-ส่ง ติดตามขั้นตอนการอนุมัติ
                  และการมอบหมายงานอิเล็กทรอนิกส์
                </p>
              </div>
            </div>

            {/* Signature */}
            <div className={`featureCard ${featureSignature ? 'active' : ''}`}>
              <div className="featureCardIconBox iconIndigo">
                <CheckCircle2 size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>ระบบลายเซ็นดิจิทัล (Digital Signature)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureSignature}
                      onChange={(e) => setFeatureSignature(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>
                  ระบบลงนามอิเล็กทรอนิกส์และวาดลายเซ็นดิจิทัล พร้อม HMAC-SHA256 Audit Verification
                </p>
              </div>
            </div>

            {/* Media Request */}
            <div className={`featureCard ${featureMediaRequest ? 'active' : ''}`}>
              <div className="featureCardIconBox iconPurple">
                <Palette size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>ระบบขอสื่อประชาสัมพันธ์ (Media Request)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureMediaRequest}
                      onChange={(e) => setFeatureMediaRequest(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>
                  ระบบขอผลิตสื่อกราฟิก ออกแบบ วิดีโอ ไวนิล และประชาสัมพันธ์สำหรับหน่วยงาน
                </p>
              </div>
            </div>

            {/* Repair */}
            <div className={`featureCard ${featureRepair ? 'active' : ''}`}>
              <div className="featureCardIconBox iconAmber">
                <Wrench size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>ระบบแจ้งซ่อมบำรุงและศูนย์ไอที (Repair Service)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureRepair}
                      onChange={(e) => setFeatureRepair(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>
                  ระบบแจ้งซ่อมคอมพิวเตอร์ งานช่างอาคารสถานที่ และงานเครื่องมือแพทย์
                </p>
              </div>
            </div>

            {/* Salary */}
            <div className={`featureCard ${featureSalary ? 'active' : ''}`}>
              <div className="featureCardIconBox iconEmerald">
                <Coins size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>ระบบสลิปเงินเดือนและค่าตอบแทน (Salary Portal)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureSalary}
                      onChange={(e) => setFeatureSalary(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>ระบบค้นหา ตรวจสอบ และดาวน์โหลดสลิปเงินเดือนสำหรับเจ้าหน้าที่ รพ.เถิน</p>
              </div>
            </div>

            {/* ITA */}
            <div className={`featureCard ${featureIta ? 'active' : ''}`}>
              <div className="featureCardIconBox iconViolet">
                <Layers size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>ระบบประเมินคุณธรรมและความโปร่งใส (ITA Articles)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureIta}
                      onChange={(e) => setFeatureIta(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>ระบบเขียนและเผยแพร่บทความประเมินคุณธรรมและความโปร่งใส ITA</p>
              </div>
            </div>

            {/* RDU */}
            <div className={`featureCard ${featureRdu ? 'active' : ''}`}>
              <div className="featureCardIconBox iconCyan">
                <Pill size={24} />
              </div>
              <div className="featureCardContent">
                <div className="featureCardTitleRow">
                  <h3>ระบบการใช้ยาอย่างสมเหตุผล (RDU Hospital)</h3>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={featureRdu}
                      onChange={(e) => setFeatureRdu(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p>ระบบจัดเก็บโฟลเดอร์และรายงานการใช้ยาอย่างสมเหตุผลของโรงพยาบาล</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: QUICK ADD ASSIGNEE (MEMBER OR POSITION)
          ========================================================================= */}
      {isAddModalOpen && targetTask && targetRole && (
        <div className="modalOverlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modalDialog modalLarge" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalHeaderTitleRow">
                <div
                  className="modalIconBox"
                  style={{
                    backgroundColor: `${targetTask.badgeColor}15`,
                    color: targetTask.badgeColor,
                  }}
                >
                  <Plus size={20} />
                </div>
                <div className="modalTitleMeta">
                  <h3>เพิ่มผู้รับผิดชอบในบทบาท</h3>
                  <p>
                    {targetTask.name} ➔ <strong>{targetRole.label}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="modalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Add Mode Switch */}
            <div className="modalTabSwitch">
              <button
                type="button"
                onClick={() => setAddMode('member')}
                className={`modalTabBtn ${addMode === 'member' ? 'active' : ''}`}
              >
                <User size={16} />
                <span>เพิ่มรายบุคคล (Member-based)</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMode('position')}
                className={`modalTabBtn ${addMode === 'position' ? 'active' : ''}`}
              >
                <Briefcase size={16} />
                <span>เพิ่มตามตำแหน่งงาน (Position-based)</span>
              </button>
            </div>

            {/* TAB: MEMBER-BASED */}
            {addMode === 'member' && (
              <div className="modalBodyContent">
                <div className="modalFilterBar">
                  <div className="modalSearchInputBox">
                    <Search size={16} className="searchIcon" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อ-สกุล, ตำแหน่ง, ฝ่าย..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="modalSearchInput"
                      autoFocus
                    />
                    {memberSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMemberSearchQuery('')}
                        className="clearSearchBtn"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="modalDeptSelect"
                  >
                    <option value="all">ทุกกลุ่มงาน/ฝ่าย ({members.length})</option>
                    {uniqueDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modalMembersScrollable">
                  {modalFilteredMembers.map((member) => {
                    const isAssigned = member.permissions.includes(targetRole.permissionKey)
                    const avColor = getAvatarColor(member.id)

                    return (
                      <div
                        key={member.id}
                        className={`modalMemberRow ${isAssigned ? 'assigned' : ''}`}
                      >
                        <div
                          className="memberAvatarMini"
                          style={{ backgroundColor: avColor.bg, color: avColor.text }}
                        >
                          {member.name.charAt(0) || 'U'}
                        </div>
                        <div className="modalMemberInfo">
                          <span className="name">{member.name}</span>
                          <span className="sub">
                            {member.position || 'ไม่ระบุตำแหน่ง'} •{' '}
                            {member.department || 'ไม่ระบุฝ่าย'}
                          </span>
                        </div>

                        <div className="modalMemberAction">
                          {isAssigned ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeMember(member, targetRole)}
                              disabled={isActionPending}
                              className="btnRevokeAction"
                            >
                              <Check size={14} />
                              <span>ได้รับสิทธิ์แล้ว (คลิกเพื่อปลด)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGrantMember(member, targetRole)}
                              disabled={isActionPending}
                              className="btnGrantAction"
                            >
                              <Plus size={14} />
                              <span>มอบสิทธิ์นี้</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {modalFilteredMembers.length === 0 && (
                    <div className="modalEmptyNotice">
                      <User size={32} />
                      <p>ไม่พบบุคลากรที่ตรงกับเงื่อนไขการค้นหา</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: POSITION-BASED */}
            {addMode === 'position' && (
              <div className="modalBodyContent">
                <div className="modalFilterBar">
                  <div className="modalSearchInputBox" style={{ width: '100%' }}>
                    <Search size={16} className="searchIcon" />
                    <input
                      type="text"
                      placeholder="พิมพ์ค้นหาชื่อตำแหน่งงานของโรงพยาบาล..."
                      value={positionSearchQuery}
                      onChange={(e) => setPositionSearchQuery(e.target.value)}
                      className="modalSearchInput"
                      autoFocus
                    />
                    {positionSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPositionSearchQuery('')}
                        className="clearSearchBtn"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="modalPositionsScrollable">
                  {modalFilteredPositions.map((pos) => {
                    const isAssigned = positionMappings.some(
                      (p) =>
                        p.permissionKey === targetRole.permissionKey && p.positionName === pos
                    )
                    const count = positionMemberCounts[pos] || 0

                    return (
                      <div
                        key={pos}
                        className={`modalPositionRow ${isAssigned ? 'assigned' : ''}`}
                      >
                        <div className="positionIconBox">
                          <Briefcase size={18} />
                        </div>
                        <div className="modalPositionInfo">
                          <span className="posName">{pos}</span>
                          <span className="posSub">
                            บุคลากรปัจจุบันในตำแหน่งนี้: <strong>{count} คน</strong>
                          </span>
                        </div>

                        <div className="modalPositionAction">
                          {isAssigned ? (
                            <button
                              type="button"
                              onClick={() => handleRevokePosition(pos, targetRole)}
                              disabled={isActionPending}
                              className="btnRevokeAction"
                            >
                              <Check size={14} />
                              <span>ได้รับสิทธิ์แล้ว (คลิกเพื่อปลด)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGrantPosition(pos, targetRole)}
                              disabled={isActionPending}
                              className="btnGrantAction"
                            >
                              <Plus size={14} />
                              <span>มอบสิทธิ์ทั้งตำแหน่ง</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {modalFilteredPositions.length === 0 && (
                    <div className="modalEmptyNotice">
                      <Briefcase size={32} />
                      <p>ไม่พบตำแหน่งงานที่ตรงกับการค้นหา</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="modalFooter">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="modalCloseFooterBtn"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: FINE-GRAINED MEMBER PERMISSIONS EDITOR
          ========================================================================= */}
      {editingMember && (
        <div className="modalOverlay" onClick={() => setEditingMember(null)}>
          <div className="modalDialog modalLarge" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalHeaderTitleRow">
                <div
                  className="modalIconBox"
                  style={{
                    backgroundColor: getAvatarColor(editingMember.id).bg,
                    color: getAvatarColor(editingMember.id).text,
                  }}
                >
                  <UserCog size={20} />
                </div>
                <div className="modalTitleMeta">
                  <div className="modalTitleRow">
                    <h3>ปรับปรุงสิทธิ์รายบุคคลโดยละเอียด</h3>
                    <span
                      className={`modalPermCountBadge ${
                        editingMemberPerms.length === 0 ? 'empty' : ''
                      }`}
                    >
                      {editingMemberPerms.length === 0
                        ? 'ไม่มีสิทธิ์ที่เลือก'
                        : `เลือก ${editingMemberPerms.length} สิทธิ์`}
                    </span>
                  </div>
                  <p>
                    {editingMember.name} • {editingMember.position || 'เจ้าหน้าที่'} (
                    {editingMember.department || 'รพ.เถิน'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="modalCloseBtn"
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modalBodyContent" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="memberPermEditGrid">
                {tasks.map((task) => {
                  const Icon = ICON_MAP[task.iconName] || Layers
                  return (
                    <div key={task.id} className="memberEditTaskGroup">
                      <div className="taskGroupHeader">
                        <div
                          className="groupIconBox"
                          style={{
                            backgroundColor: `${task.badgeColor}15`,
                            color: task.badgeColor,
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <span className="groupTitle">{task.name}</span>
                      </div>

                      <div className="groupPermCheckboxes">
                        {task.roles.map((role) => {
                          const isChecked = editingMemberPerms.includes(role.permissionKey)
                          return (
                            <label key={role.permissionKey} className="checkboxLabelItem">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setEditingMemberPerms((prev) =>
                                    prev.includes(role.permissionKey)
                                      ? prev.filter((k) => k !== role.permissionKey)
                                      : [...prev, role.permissionKey]
                                  )
                                }}
                              />
                              <div className="checkboxText">
                                <span className="title">{role.label}</span>
                                <span className="desc">{role.description}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="modalFooter spaceBetween">
              <div className="modalFooterLeft">
                <button
                  type="button"
                  onClick={() => setEditingMemberPerms([])}
                  disabled={isSavingMemberPerms || editingMemberPerms.length === 0}
                  className="modalClearAllBtn"
                  title="ล้างสิทธิ์ที่เลือกทั้งหมดสำหรับบุคคลนี้"
                >
                  <Trash2 size={15} />
                  <span>ล้างสิทธิ์ทั้งหมด</span>
                  {editingMemberPerms.length > 0 && (
                    <span className="clearAllCountBadge">{editingMemberPerms.length}</span>
                  )}
                </button>
              </div>
              <div className="modalFooterRight">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  disabled={isSavingMemberPerms}
                  className="modalCancelBtn"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveMemberAllPerms}
                  disabled={isSavingMemberPerms}
                  className="modalSaveBtn"
                >
                  {isSavingMemberPerms ? (
                    <RefreshCw size={15} className="spinIcon" />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>{isSavingMemberPerms ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์บุคคลนี้'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
