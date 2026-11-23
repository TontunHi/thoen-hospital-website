'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users,
  FolderPlus,
  UserPlus,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Plus,
  Search,
  Upload,
  Phone,
  Loader2,
  X,
  Check,
  Building2,
  ExternalLink,
  Shield,
  Crown,
  Layers,
  Info,
  FolderTree,
  Filter,
  CheckCircle2,
  UserCheck,
  Crop,
  GripVertical,
  Network,
  RotateCcw,
  Hand,
  ZoomIn,
  ZoomOut,
  ChevronLeft
} from 'lucide-react'
import ImageCropModal from '@/components/ui/ImageCropModal'
import Link from 'next/link'
import { getInitials } from '@/lib/formatters'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import {
  OrgMember,
  OrgGroupNode,
  countTotalMembersInGroup,
  countTotalSubUnits,
  swapMembersInTree,
  swapGroupsInTree,
  isLeaderRole
} from '@/lib/departments/orgTreeUtils'
import './page.css'

import {
  type DepartmentGroupNode,
  type DepartmentRoleItem,
  type DepartmentMember,
  type SystemMemberSearchResult,
  findGroupName,
  findGroupById,
  getGroupBreadcrumbs,
  countGroupsAndSubunits,
  buildRoleSections,
} from './organizationHelpers'
import { OrganizationAdminModals } from './OrganizationAdminModals'
import {
  OrganizationHeaderAndStats,
  OrganizationDiagramSection,
  OrganizationWorkbench,
} from './components/OrganizationHeaderAndWorkbench'
export type { DepartmentRoleItem }
export default function OrganizationAdminClient({ currentAdmin }: { currentAdmin?: any }) {
  const [groups, setGroups] = useState<DepartmentGroupNode[]>([])
  const [selectedGroup, setSelectedGroup] = useState<DepartmentGroupNode | null>(null)
  const [members, setMembers] = useState<DepartmentMember[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // UI state
  const [searchGroupQuery, setSearchGroupQuery] = useState('')
  const [searchMemberInGroupQuery, setSearchMemberInGroupQuery] = useState('')
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(new Set())

  // Modals state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create')
  const [groupFormData, setGroupFormData] = useState<{ id?: number; name: string; parentId: number | null }>({
    name: '',
    parentId: null
  })

  // Roles state & Role modal
  const [roles, setRoles] = useState<DepartmentRoleItem[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)
  const [editingRoleName, setEditingRoleName] = useState('')
  const [savingRoleEdit, setSavingRoleEdit] = useState(false)

  // Drag-and-drop state for members in right pane
  const [draggedMemberId, setDraggedMemberId] = useState<number | null>(null)
  const [dragOverMemberId, setDragOverMemberId] = useState<number | null>(null)

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [memberModalMode, setMemberModalMode] = useState<'create' | 'edit'>('create')
  const [memberFormData, setMemberFormData] = useState<{
    id?: number
    name: string
    position: string
    role: string
    phone: string
    imagePath: string
    memberId: number | null
  }>({
    name: '',
    position: '',
    role: 'เจ้าหน้าที่ผู้ปฏิบัติงาน',
    phone: '',
    imagePath: '',
    memberId: null
  })

  // Member search autocomplete state
  const [searchMemberQuery, setSearchMemberQuery] = useState('')
  const [searchMemberResults, setSearchMemberResults] = useState<SystemMemberSearchResult[]>([])
  const [searchingMembers, setSearchingMembers] = useState(false)
  const isSelectingMemberRef = useRef(false)
  const autocompleteContainerRef = useRef<HTMLDivElement>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [cropFileName, setCropFileName] = useState('staff-photo.jpg')
  const [imgPreviewFailed, setImgPreviewFailed] = useState(false)

  // Confirm delete dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToasts((prev) => [...prev, { id: String(Date.now()), message, type }])
  }

  // View mode switcher: 'diagram' (ผังโครงสร้าง) or 'workbench' (รายการละเอียด)
  const [adminViewMode, setAdminViewMode] = useState<'diagram' | 'workbench'>('diagram')

  // Full Org Chart for diagram view
  const [orgChart, setOrgChart] = useState<OrgGroupNode[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null)

  // Diagram free-view state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null)
  const diagramScrollRef = useRef<HTMLDivElement>(null)
  const [membersPerRow, setMembersPerRow] = useState(4)
  const [isTabsWrapped, setIsTabsWrapped] = useState(true)
  const [deptFilterQuery, setDeptFilterQuery] = useState('')

  // Drag-and-drop state in diagram
  const [diagramDragItem, setDiagramDragItem] = useState<
    { type: 'member'; id: number; groupId: number } | { type: 'group'; id: number; parentId: number | null } | null
  >(null)
  const [diagramDragOverKey, setDiagramDragOverKey] = useState<string | null>(null)

  // Fetch groups tree
  const loadGroups = async (selectGroupId?: number) => {
    try {
      setLoadingGroups(true)
      const res = await fetch('/api/departments/groups')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setGroups(json.data)

        // Expand all groups with children by default
        const collectIds = (nodes: DepartmentGroupNode[]): number[] => {
          let ids: number[] = []
          for (const node of nodes) {
            ids.push(node.id)
            if (node.children && node.children.length > 0) {
              ids = ids.concat(collectIds(node.children))
            }
          }
          return ids
        }
        setExpandedGroupIds(new Set(collectIds(json.data)))

        // Select initial group or keep current
        if (selectGroupId) {
          const findNode = (nodes: DepartmentGroupNode[]): DepartmentGroupNode | null => {
            for (const n of nodes) {
              if (n.id === selectGroupId) return n
              const childMatch = findNode(n.children)
              if (childMatch) return childMatch
            }
            return null
          }
          const matched = findNode(json.data)
          if (matched) setSelectedGroup(matched)
        } else if (!selectedGroup && json.data.length > 0) {
          setSelectedGroup(json.data[0])
        }
      }
    } catch {
      addToast('ไม่สามารถโหลดข้อมูลกลุ่มงานได้', 'error')
    } finally {
      setLoadingGroups(false)
    }
  }

  // Fetch members of selected group
  const loadMembers = async (groupId: number) => {
    try {
      setLoadingMembers(true)
      const res = await fetch(`/api/departments/members?groupId=${groupId}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setMembers(json.data)
      } else {
        setMembers([])
      }
    } catch {
      addToast('ไม่สามารถโหลดข้อมูลสมาชิกได้', 'error')
    } finally {
      setLoadingMembers(false)
    }
  }

  // Fetch department roles
  const loadRoles = async () => {
    try {
      setLoadingRoles(true)
      const res = await fetch('/api/departments/roles')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setRoles(json.data)
      }
    } catch {
      addToast('ไม่สามารถโหลดระดับบทบาทได้', 'error')
    } finally {
      setLoadingRoles(false)
    }
  }

  // Fetch complete org chart for visual diagram
  const loadFullChart = async () => {
    try {
      setLoadingChart(true)
      const res = await fetch('/api/departments/public')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setOrgChart(json.data)
        if (!selectedRootId && json.data.length > 0) {
          setSelectedRootId(json.data[0].id)
        }
      }
    } catch {
      // Fallback handles building tree from groups and members
    } finally {
      setLoadingChart(false)
    }
  }

  useEffect(() => {
    loadGroups()
    loadRoles()
    loadFullChart()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id)
      setSearchMemberInGroupQuery('')
    } else {
      setMembers([])
    }
  }, [selectedGroup?.id])

  // Fallback tree construction if orgChart is not yet fetched or empty
  const effectiveOrgChart: OrgGroupNode[] = useMemo(() => {
    if (orgChart.length > 0) return orgChart

    const buildNode = (g: DepartmentGroupNode): OrgGroupNode => {
      const gMembers: OrgMember[] =
        selectedGroup?.id === g.id
          ? members.map((m) => ({
              id: m.id,
              groupId: g.id,
              name: m.name,
              position: m.position,
              role: m.role,
              orderIndex: m.orderIndex,
              imagePath: m.imagePath,
              phone: m.phone,
              memberId: m.memberId
            }))
          : []
      return {
        id: g.id,
        name: g.name,
        parentId: g.parentId,
        orderIndex: g.orderIndex,
        members: gMembers,
        children: (g.children || []).map(buildNode)
      }
    }
    return groups.map(buildNode)
  }, [orgChart, groups, members, selectedGroup])

  const selectedRoot = useMemo(() => {
    if (selectedRootId) {
      const found = effectiveOrgChart.find((g) => g.id === selectedRootId)
      if (found) return found
    }
    return effectiveOrgChart[0] || null
  }, [effectiveOrgChart, selectedRootId])

  useEffect(() => {
    if (!selectedRootId && effectiveOrgChart.length > 0) {
      setSelectedRootId(effectiveOrgChart[0].id)
    }
  }, [effectiveOrgChart, selectedRootId])

  const filteredDiagramChart = useMemo(() => {
    const q = deptFilterQuery.trim().toLowerCase()
    if (!q) return effectiveOrgChart
    return effectiveOrgChart.filter((g) => g.name.toLowerCase().includes(q))
  }, [effectiveOrgChart, deptFilterQuery])

  // Diagram Free View handlers
  const handleResetDiagramView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleDiagramPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (
      target.closest('.adminTreeNodeCard') ||
      target.closest('.adminTreeMemberCard') ||
      target.closest('.adminTreeAddDashedCard') ||
      target.closest('.adminTreeAddSubunitDashedCard') ||
      target.closest('.adminDirectStaffBlock') ||
      target.closest('.adminStaffBranchCardWrap') ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('select')
    ) {
      return
    }

    setIsPanning(true)
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleDiagramPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return
    const dx = e.clientX - panStartRef.current.startX
    const dy = e.clientY - panStartRef.current.startY
    setPan({
      x: panStartRef.current.initialPanX + dx,
      y: panStartRef.current.initialPanY + dy
    })
  }

  const handleDiagramPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return
    setIsPanning(false)
    panStartRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleDiagramWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      setZoom((z) => Math.min(1.4, Math.max(0.5, Number((z + delta).toFixed(2)))))
    } else {
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY
      }))
    }
  }

  // Diagram modal triggers
  const openCreateMemberForGroup = (groupId: number, groupName?: string, defaultRole?: string) => {
    const foundGroup = findGroupById(groups, groupId)
    if (foundGroup) {
      setSelectedGroup(foundGroup)
    }
    setMemberModalMode('create')
    const initialRole =
      defaultRole ||
      (roles.length > 0
        ? (roles.find((r) => r.isDefault)?.name || roles[roles.length - 1].name)
        : 'เจ้าหน้าที่ผู้ปฏิบัติงาน')

    setMemberFormData({
      name: '',
      position: '',
      role: initialRole,
      phone: '',
      imagePath: '',
      memberId: null
    })
    isSelectingMemberRef.current = false
    setSearchMemberResults([])
    setSearchMemberQuery('')
    setImgPreviewFailed(false)
    setIsMemberModalOpen(true)
  }

  const openEditMember = (m: DepartmentMember | OrgMember) => {
    const foundGroup = findGroupById(groups, m.groupId)
    if (foundGroup) setSelectedGroup(foundGroup)

    setMemberModalMode('edit')
    setMemberFormData({
      id: m.id,
      name: m.name,
      position: m.position,
      role: m.role,
      phone: m.phone || '',
      imagePath: m.imagePath || '',
      memberId: m.memberId || null
    })
    setImgPreviewFailed(false)
    setIsMemberModalOpen(true)
  }

  const openCreateSubGroup = (parentId: number) => {
    setGroupModalMode('create')
    setGroupFormData({ name: '', parentId })
    setIsGroupModalOpen(true)
  }

  const openEditGroup = (g: { id: number; name: string; parentId: number | null }) => {
    setGroupModalMode('edit')
    setGroupFormData({ id: g.id, name: g.name, parentId: g.parentId })
    setIsGroupModalOpen(true)
  }

  // Diagram Member Drag & Drop reordering
  const handleDiagramMemberDragStart = (memberId: number, groupId: number, e: React.DragEvent) => {
    setDiagramDragItem({ type: 'member', id: memberId, groupId })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(memberId))
  }

  const handleDiagramMemberDragOver = (memberId: number, groupId: number, e: React.DragEvent) => {
    if (!diagramDragItem || diagramDragItem.type !== 'member') return
    if (diagramDragItem.id === memberId || diagramDragItem.groupId !== groupId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const key = `member-${memberId}`
    if (diagramDragOverKey !== key) {
      setDiagramDragOverKey(key)
    }
  }

  const handleDiagramMemberDragLeave = () => {
    setDiagramDragOverKey(null)
  }

  const handleDiagramMemberDrop = (targetMemberId: number, groupId: number, e: React.DragEvent) => {
    e.preventDefault()
    if (!diagramDragItem || diagramDragItem.type !== 'member') return
    if (diagramDragItem.id !== targetMemberId && diagramDragItem.groupId === groupId) {
      handleSwapMembersInDiagram(diagramDragItem.id, targetMemberId, groupId)
    }
    setDiagramDragItem(null)
    setDiagramDragOverKey(null)
  }

  const handleDiagramMemberDragEnd = () => {
    setDiagramDragItem(null)
    setDiagramDragOverKey(null)
  }

  const handleSwapMembersInDiagram = async (memberIdA: number, memberIdB: number, groupId: number) => {
    const { updatedNodes, swappedGroup } = swapMembersInTree(effectiveOrgChart, groupId, memberIdA, memberIdB)
    if (!swappedGroup) return

    setOrgChart(updatedNodes)

    try {
      const res = await fetch('/api/departments/members/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          memberIds: swappedGroup.members.map((m) => m.id)
        })
      })
      const json = await res.json().catch(() => null)
      if (json && json.success) {
        addToast(json.message || 'บันทึกลำดับสมาชิกสำเร็จ', 'success')
        if (selectedGroup?.id === groupId) {
          loadMembers(groupId)
        }
      }
    } catch {
      // Local state already updated smoothly
    }
  }

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteContainerRef.current &&
        !autocompleteContainerRef.current.contains(e.target as Node)
      ) {
        setSearchMemberResults([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // System member search debounced
  useEffect(() => {
    // If query updated via autocomplete selection, do not re-fetch & keep results closed
    if (isSelectingMemberRef.current) {
      isSelectingMemberRef.current = false
      setSearchMemberResults([])
      return
    }

    if (!searchMemberQuery.trim() || searchMemberQuery.trim().length < 2) {
      setSearchMemberResults([])
      return
    }

    const abortController = new AbortController()

    const timer = setTimeout(async () => {
      try {
        setSearchingMembers(true)
        const res = await fetch(
          `/api/departments/members/search-system?q=${encodeURIComponent(searchMemberQuery)}`,
          { signal: abortController.signal }
        )
        const json = await res.json()
        if (!abortController.signal.aborted && json.success) {
          setSearchMemberResults(json.data || [])
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Ignore search error
        }
      } finally {
        if (!abortController.signal.aborted) {
          setSearchingMembers(false)
        }
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      abortController.abort()
    }
  }, [searchMemberQuery])

  // Photo selection & Crop modal trigger
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.heic', '.heif']
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/jfif',
      'image/png',
      'image/x-png',
      'image/webp',
      'image/avif',
      'image/heic',
      'image/heif'
    ]

    const ext = file.name && file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : ''
    const isMimeValid = allowedMimes.includes(file.type?.toLowerCase())
    const isExtValid = ext && allowedExts.includes(ext)

    if (!isMimeValid && !isExtValid) {
      addToast('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP หรือ HEIC เท่านั้น', 'error')
      e.target.value = ''
      return
    }

    if (imageToCrop && imageToCrop.startsWith('blob:')) {
      URL.revokeObjectURL(imageToCrop)
    }

    const objectUrl = URL.createObjectURL(file)
    setImageToCrop(objectUrl)
    setCropFileName(file.name || 'staff-photo.jpg')
    setIsCropModalOpen(true)
    e.target.value = ''
  }

  const handleEditCurrentPhoto = () => {
    if (!memberFormData.imagePath) return
    if (imageToCrop && imageToCrop.startsWith('blob:')) {
      URL.revokeObjectURL(imageToCrop)
    }
    setImageToCrop(memberFormData.imagePath)
    setCropFileName(`staff-${memberFormData.id || 'photo'}.jpg`)
    setIsCropModalOpen(true)
  }

  const handleCloseCropModal = () => {
    if (imageToCrop && imageToCrop.startsWith('blob:')) {
      URL.revokeObjectURL(imageToCrop)
    }
    setIsCropModalOpen(false)
    setImageToCrop(null)
  }

  const handleSaveCroppedPhoto = async (file: File) => {
    try {
      setIsUploadingPhoto(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/departments/members/upload', {
        method: 'POST',
        body: formData
      })
      const json = await res.json()
      if (json.success && json.data?.url) {
        setMemberFormData((prev) => ({ ...prev, imagePath: json.data.url }))
        setImgPreviewFailed(false)
        addToast('อัปโหลดและตัดครอบรูปภาพสำเร็จ', 'success')
      } else {
        const errMsg = json.error || 'อัปโหลดรูปภาพไม่สำเร็จ'
        addToast(errMsg, 'error')
        throw new Error(errMsg)
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('อัปโหลดรูปภาพไม่สำเร็จ')) {
        addToast(err.message, 'error')
      }
      throw err
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Save Group (Create/Update)
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupFormData.name.trim()) {
      addToast('กรุณาระบุชื่อกลุ่มงาน', 'error')
      return
    }

    try {
      if (groupModalMode === 'create') {
        const res = await fetch('/api/departments/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupFormData.name.trim(),
            parentId: groupFormData.parentId
          })
        })
        const json = await res.json()
        if (json.success) {
          addToast('สร้างกลุ่มงานสำเร็จ', 'success')
          setIsGroupModalOpen(false)
          loadGroups(json.data.id)
          loadFullChart()
        } else {
          addToast(json.error || 'สร้างกลุ่มงานไม่สำเร็จ', 'error')
        }
      } else if (groupModalMode === 'edit' && groupFormData.id) {
        const res = await fetch(`/api/departments/groups/${groupFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupFormData.name.trim()
          })
        })
        const json = await res.json()
        if (json.success) {
          addToast('อัปเดตกลุ่มงานสำเร็จ', 'success')
          setIsGroupModalOpen(false)
          loadGroups(groupFormData.id)
          loadFullChart()
        } else {
          addToast(json.error || 'อัปเดตกลุ่มงานไม่สำเร็จ', 'error')
        }
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการบันทึกกลุ่มงาน', 'error')
    }
  }

  // Delete Group
  const handleDeleteGroup = (group: { id: number; name: string }) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบกลุ่มงาน',
      message: `คุณต้องการลบ "${group.name}" ใช่หรือไม่? (ระบบจะไม่ยินยอมให้ลบหากยังมีกลุ่มงานย่อยหรือสมาชิกอยู่)`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/departments/groups/${group.id}`, { method: 'DELETE' })
          const json = await res.json()
          if (json.success) {
            addToast('ลบกลุ่มงานสำเร็จ', 'success')
            if (selectedGroup?.id === group.id) {
              setSelectedGroup(null)
            }
            loadGroups()
            loadFullChart()
          } else {
            addToast(json.error || 'ไม่สามารถลบกลุ่มงานได้', 'error')
          }
        } catch {
          addToast('เกิดข้อผิดพลาดในการลบกลุ่มงาน', 'error')
        }
      }
    })
  }

  // Save Member (Create/Update)
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup) return
    if (!memberFormData.name.trim() || !memberFormData.position.trim()) {
      addToast('กรุณากรอกชื่อ-นามสกุล และตำแหน่งให้ครบถ้วน', 'error')
      return
    }

    try {
      if (memberModalMode === 'create') {
        const res = await fetch('/api/departments/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: selectedGroup.id,
            name: memberFormData.name.trim(),
            position: memberFormData.position.trim(),
            role: memberFormData.role,
            phone: memberFormData.phone.trim() || null,
            imagePath: memberFormData.imagePath.trim() || null,
            memberId: memberFormData.memberId
          })
        })
        const json = await res.json()
        if (json.success) {
          addToast('เพิ่มสมาชิกสำเร็จ', 'success')
          setIsMemberModalOpen(false)
          loadMembers(selectedGroup.id)
          loadFullChart()
        } else {
          addToast(json.error || 'เพิ่มสมาชิกไม่สำเร็จ', 'error')
        }
      } else if (memberModalMode === 'edit' && memberFormData.id) {
        const res = await fetch(`/api/departments/members/${memberFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: memberFormData.name.trim(),
            position: memberFormData.position.trim(),
            role: memberFormData.role,
            phone: memberFormData.phone.trim() || null,
            imagePath: memberFormData.imagePath.trim() || null,
            memberId: memberFormData.memberId
          })
        })
        const json = await res.json()
        if (json.success) {
          addToast('อัปเดตข้อมูลสมาชิกสำเร็จ', 'success')
          setIsMemberModalOpen(false)
          loadMembers(selectedGroup.id)
          loadFullChart()
        } else {
          addToast(json.error || 'อัปเดตสมาชิกไม่สำเร็จ', 'error')
        }
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลสมาชิก', 'error')
    }
  }

  // Delete Member
  const handleDeleteMember = (member: { id: number; name: string; groupId?: number }) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบสมาชิก',
      message: `คุณต้องการลบ "${member.name}" ออกจากกลุ่มงานใช่หรือไม่?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/departments/members/${member.id}`, { method: 'DELETE' })
          const json = await res.json()
          if (json.success) {
            addToast('ลบสมาชิกสำเร็จ', 'success')
            if (selectedGroup) loadMembers(selectedGroup.id)
            loadFullChart()
          } else {
            addToast(json.error || 'ไม่สามารถลบสมาชิกได้', 'error')
          }
        } catch {
          addToast('เกิดข้อผิดพลาดในการลบสมาชิก', 'error')
        }
      }
    })
  }

  // Move member up/down to reorder within its section
  const handleMoveMember = async (sectionList: DepartmentMember[], sectionIndex: number, direction: 'up' | 'down') => {
    if (!selectedGroup) return
    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1
    if (targetIndex < 0 || targetIndex >= sectionList.length) return

    const memberA = sectionList[sectionIndex]
    const memberB = sectionList[targetIndex]

    const updatedMembers = [...members]
    const idxA = updatedMembers.findIndex((m) => m.id === memberA.id)
    const idxB = updatedMembers.findIndex((m) => m.id === memberB.id)
    if (idxA === -1 || idxB === -1) return

    const temp = updatedMembers[idxA]
    updatedMembers[idxA] = updatedMembers[idxB]
    updatedMembers[idxB] = temp

    setMembers(updatedMembers)

    try {
      const res = await fetch('/api/departments/members/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          memberIds: updatedMembers.map((m) => m.id)
        })
      })
      const json = await res.json()
      if (!json.success) {
        addToast(json.error || 'ไม่สามารถบันทึกลำดับได้', 'error')
        loadMembers(selectedGroup.id)
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการสลับลำดับ', 'error')
      loadMembers(selectedGroup.id)
    }
  }

  // Member drag-and-drop handlers for admin workbench
  const handleMemberDragStart = (memberId: number, e: React.DragEvent) => {
    setDraggedMemberId(memberId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(memberId))
  }

  const handleMemberDragOver = (memberId: number, e: React.DragEvent) => {
    if (!draggedMemberId || draggedMemberId === memberId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverMemberId !== memberId) {
      setDragOverMemberId(memberId)
    }
  }

  const handleMemberDragLeave = (e: React.DragEvent) => {
    const currentTarget = e.currentTarget
    const relatedTarget = e.relatedTarget as Node | null
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverMemberId(null)
    }
  }

  const handleMemberDrop = async (targetMemberId: number, e: React.DragEvent) => {
    e.preventDefault()
    if (!selectedGroup || !draggedMemberId || draggedMemberId === targetMemberId) {
      setDraggedMemberId(null)
      setDragOverMemberId(null)
      return
    }

    const currentList = [...members]
    const fromIndex = currentList.findIndex((m) => m.id === draggedMemberId)
    const toIndex = currentList.findIndex((m) => m.id === targetMemberId)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedMemberId(null)
      setDragOverMemberId(null)
      return
    }

    const [moved] = currentList.splice(fromIndex, 1)
    currentList.splice(toIndex, 0, moved)

    setMembers(currentList)
    setDraggedMemberId(null)
    setDragOverMemberId(null)

    try {
      const res = await fetch('/api/departments/members/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          memberIds: currentList.map((m) => m.id)
        })
      })
      const json = await res.json()
      if (json.success) {
        addToast('สลับตำแหน่งบุคลากรสำเร็จ', 'success')
      } else {
        addToast(json.error || 'ไม่สามารถบันทึกลำดับได้', 'error')
        loadMembers(selectedGroup.id)
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการสลับลำดับ', 'error')
      loadMembers(selectedGroup.id)
    }
  }

  const handleMemberDragEnd = () => {
    setDraggedMemberId(null)
    setDragOverMemberId(null)
  }

  // Role Management Handlers
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = newRoleName.trim()
    if (!cleanName) return
    try {
      setCreatingRole(true)
      const res = await fetch('/api/departments/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      })
      const json = await res.json()
      if (json.success) {
        addToast('เพิ่มระดับบทบาทสำเร็จ', 'success')
        setNewRoleName('')
        await loadRoles()
      } else {
        addToast(json.error || 'เพิ่มระดับบทบาทไม่สำเร็จ', 'error')
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการเพิ่มบทบาท', 'error')
    } finally {
      setCreatingRole(false)
    }
  }

  const handleUpdateRole = async (id: number) => {
    const cleanName = editingRoleName.trim()
    if (!cleanName) return
    try {
      setSavingRoleEdit(true)
      const res = await fetch(`/api/departments/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      })
      const json = await res.json()
      if (json.success) {
        addToast('อัปเดตชื่อบทบาทสำเร็จ', 'success')
        setEditingRoleId(null)
        setEditingRoleName('')
        await loadRoles()
      } else {
        addToast(json.error || 'อัปเดตชื่อบทบาทไม่สำเร็จ', 'error')
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการอัปเดตบทบาท', 'error')
    } finally {
      setSavingRoleEdit(false)
    }
  }

  const handleDeleteRole = (roleItem: DepartmentRoleItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบบทบาท',
      message: `คุณต้องการลบบทบาท "${roleItem.name}" ใช่หรือไม่? บุคลากรที่ใช้บทบาทนี้จะยังคงอยู่ในระบบ`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/departments/roles/${roleItem.id}`, { method: 'DELETE' })
          const json = await res.json()
          if (json.success) {
            addToast('ลบบทบาทสำเร็จ', 'success')
            await loadRoles()
          } else {
            addToast(json.error || 'ไม่สามารถลบบทบาทได้', 'error')
          }
        } catch {
          addToast('เกิดข้อผิดพลาดในการลบบทบาท', 'error')
        }
      }
    })
  }

  const handleMoveRole = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= roles.length) return

    const updated = [...roles]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp

    setRoles(updated)

    try {
      const res = await fetch('/api/departments/roles/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: updated.map((r) => r.id) })
      })
      const json = await res.json()
      if (json.success) {
        addToast('สลับลำดับบทบาทสำเร็จ', 'success')
        await loadRoles()
      } else {
        addToast(json.error || 'ไม่สามารถสลับลำดับบทบาทได้', 'error')
        await loadRoles()
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการสลับลำดับบทบาท', 'error')
      await loadRoles()
    }
  }

  // Handle move group order (up or down within same hierarchy level)
  const handleMoveGroup = async (
    siblings: DepartmentGroupNode[],
    currentIndex: number,
    direction: 'up' | 'down'
  ) => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= siblings.length) return

    const updatedSiblings = [...siblings]
    const [moved] = updatedSiblings.splice(currentIndex, 1)
    updatedSiblings.splice(targetIndex, 0, moved)

    const reorderedGroupIds = updatedSiblings.map((g) => g.id)

    try {
      const res = await fetch('/api/departments/groups/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: reorderedGroupIds })
      })
      const json = await res.json()
      if (json.success) {
        addToast('สลับลำดับกลุ่มงานสำเร็จ', 'success')
        await loadGroups(selectedGroup?.id)
      } else {
        addToast(json.error || 'ไม่สามารถสลับลำดับกลุ่มงานได้', 'error')
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการสลับลำดับกลุ่มงาน', 'error')
    }
  }

  const toggleGroupExpand = (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // Computed metrics
  const groupStats = useMemo(() => countGroupsAndSubunits(groups), [groups])
  const breadcrumbs = useMemo(() => {
    if (!selectedGroup) return []
    return getGroupBreadcrumbs(groups, selectedGroup.id) || [{ id: selectedGroup.id, name: selectedGroup.name }]
  }, [groups, selectedGroup])

  // Filter groups tree based on search query
  const filteredGroups = useMemo(() => {
    const query = searchGroupQuery.trim().toLowerCase()
    if (!query) return groups

    const filterNode = (node: DepartmentGroupNode): DepartmentGroupNode | null => {
      const nameMatch = node.name.toLowerCase().includes(query)
      const matchingChildren = node.children
        .map(filterNode)
        .filter((c): c is DepartmentGroupNode => c !== null)

      if (nameMatch || matchingChildren.length > 0) {
        return {
          ...node,
          children: matchingChildren
        }
      }
      return null
    }

    return groups.map(filterNode).filter((n): n is DepartmentGroupNode => n !== null)
  }, [groups, searchGroupQuery])

  // Recursive tree node renderer
  const renderGroupNode = (
    node: DepartmentGroupNode,
    level = 0,
    siblings: DepartmentGroupNode[] = groups,
    index = 0
  ) => {
    const isSelected = selectedGroup?.id === node.id
    const hasChildren = Boolean(node.children && node.children.length > 0)
    const isExpanded = expandedGroupIds.has(node.id)
    const canMoveUp = index > 0
    const canMoveDown = index < siblings.length - 1

    return (
      <div key={node.id} className={`orgTreeItem ${isSelected ? 'active' : ''}`}>
        <div
          className="orgTreeItemRow"
          onClick={() => setSelectedGroup(node)}
          style={{ paddingLeft: `${Math.max(8, level * 16 + 6)}px` }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedGroup(node)
            }
          }}
        >
          {/* Expand/Collapse Toggle or Indent spacer */}
          {hasChildren ? (
            <button
              type="button"
              className="orgTreeChevronBtn"
              onClick={(e) => toggleGroupExpand(node.id, e)}
              aria-label={isExpanded ? 'ยุบรายการ' : 'ขยายรายการ'}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="orgTreeChevronSpacer" />
          )}

          <div className="orgTreeItemInfo">
            <div className={`orgTreeIconWrap ${isSelected ? 'active' : ''} ${level > 0 ? 'sub' : ''}`}>
              {level === 0 ? <Building2 size={15} /> : <Layers size={13} />}
            </div>
            <span className="orgTreeItemName" title={node.name}>
              {node.name}
            </span>
            {hasChildren && (
              <span className="orgTreeSubCount" title={`มีงานย่อย ${node.children.length} แผนก`}>
                {node.children.length}
              </span>
            )}
          </div>

          <div className="orgTreeActions" onClick={(e) => e.stopPropagation()}>
            {/* Reorder Buttons for Groups */}
            <div className="orderButtonsRow">
              <button
                type="button"
                className="orderBtnCompact"
                title="เลื่อนขึ้น"
                disabled={!canMoveUp}
                onClick={() => handleMoveGroup(siblings, index, 'up')}
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                className="orderBtnCompact"
                title="เลื่อนลง"
                disabled={!canMoveDown}
                onClick={() => handleMoveGroup(siblings, index, 'down')}
              >
                <ArrowDown size={11} />
              </button>
            </div>

            <button
              type="button"
              className="iconBtnCompact"
              title="เพิ่มงานย่อยภายใต้กลุ่มนี้"
              onClick={() => {
                setGroupModalMode('create')
                setGroupFormData({ name: '', parentId: node.id })
                setIsGroupModalOpen(true)
              }}
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              className="iconBtnCompact"
              title="แก้ไขชื่อกลุ่มงาน"
              onClick={() => {
                setGroupModalMode('edit')
                setGroupFormData({ id: node.id, name: node.name, parentId: node.parentId })
                setIsGroupModalOpen(true)
              }}
            >
              <Edit2 size={12} />
            </button>
            <button
              type="button"
              className="iconBtnCompact danger"
              title="ลบกลุ่มงาน"
              onClick={() => handleDeleteGroup(node)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="orgTreeChildren">
            {node.children.map((child, childIdx) =>
              renderGroupNode(child, level + 1, node.children, childIdx)
            )}
          </div>
        )}
      </div>
    )
  }

  // Dynamic role sections grouping
  const roleSections = useMemo(
    () => buildRoleSections(members, roles, searchMemberInGroupQuery),
    [members, roles, searchMemberInGroupQuery]
  )

  const leaderMembers = useMemo(() => {
    const firstSec = roleSections[0]
    return firstSec && firstSec.isLeader
      ? firstSec.members
      : members.filter((m) => {
          const r = (m.role || '').toLowerCase().trim()
          return r === 'leader' || (r.includes('หัวหน้า') && !r.includes('รอง') && !r.includes('ผู้ช่วย'))
        })
  }, [roleSections, members])

  const regularMembers = useMemo(() => {
    const leaderSet = new Set(leaderMembers.map((m) => m.id))
    return members.filter((m) => !leaderSet.has(m.id))
  }, [members, leaderMembers])

  // Diagram Render Helpers
  const renderAdminMemberLeaf = (
    member: OrgMember,
    badge?: string,
    groupId?: number,
    groupName?: string
  ) => {
    const resolvedGroupId = groupId ?? member.groupId
    const itemKey = `member-${member.id}`
    const isDragging = diagramDragItem?.type === 'member' && diagramDragItem.id === member.id
    const isDropTarget = diagramDragOverKey === itemKey
    const showBadge = Boolean(badge && badge !== 'เจ้าหน้าที่' && badge !== 'เจ้าหน้าที่ผู้ปฏิบัติงาน')
    const isDeputy = badge?.includes('รอง')

    return (
      <li key={`staff-leaf-${member.id}`} className="adminTreeMemberLeafLi">
        <div
          className={`adminTreeMemberCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
          draggable={true}
          onDragStart={(e) => handleDiagramMemberDragStart(member.id, resolvedGroupId, e)}
          onDragOver={(e) => handleDiagramMemberDragOver(member.id, resolvedGroupId, e)}
          onDragLeave={handleDiagramMemberDragLeave}
          onDrop={(e) => handleDiagramMemberDrop(member.id, resolvedGroupId, e)}
          onDragEnd={handleDiagramMemberDragEnd}
          onClick={() => openEditMember(member)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openEditMember(member)
            }
          }}
          title="คลิกเพื่อแก้ไขข้อมูล หรือลากเพื่อสลับตำแหน่ง"
        >
          <div className="adminTreeMemberAvatarWrap">
            {member.imagePath ? (
              <img src={member.imagePath} alt={member.name} className="adminTreeMemberAvatar" />
            ) : (
              <div className="adminTreeMemberAvatarFallback">{getInitials(member.name)}</div>
            )}
          </div>
          {showBadge && (
            <span className={`adminTreeMemberBadge ${isDeputy ? 'deputy' : ''}`}>
              {badge}
            </span>
          )}
          <span className="adminTreeMemberName" title={member.name}>
            {member.name}
          </span>
          <span className="adminTreeMemberPosition" title={member.position}>
            {member.position}
          </span>
          <div className="adminMemberCardActions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="adminMiniBtn"
              title="แก้ไขข้อมูล"
              onClick={() => openEditMember(member)}
            >
              <Edit2 size={13} />
              <span>แก้ไข</span>
            </button>
            <button
              type="button"
              className="adminMiniBtn danger"
              title="ลบบุคลากรออกจากกลุ่มงาน"
              onClick={() => handleDeleteMember(member)}
            >
              <Trash2 size={13} />
              <span>ลบ</span>
            </button>
          </div>
        </div>
      </li>
    )
  }

  const renderAdminTieredStaff = (
    staffMembers: OrgMember[],
    perRow: number,
    badge: string | undefined,
    isNested: boolean,
    groupId: number,
    groupName?: string
  ) => {
    const rows: OrgMember[][] = []
    for (let i = 0; i < staffMembers.length; i += perRow) {
      rows.push(staffMembers.slice(i, i + perRow))
    }

    return (
      <div className={`adminTieredStaffBlock ${isNested ? 'nested' : ''}`}>
        {rows.map((rowMembers, rowIndex) => {
          const isLastRow = rowIndex === rows.length - 1
          return (
            <div key={`admin-row-wrap-${rowIndex}`} className="adminTieredRowWrap">
              <ul className="adminTieredRow">
                {rowMembers.map((member) =>
                  renderAdminMemberLeaf(member, badge, groupId, groupName)
                )}
                {isLastRow && (
                  <li key="admin-add-card" className="adminTreeAddDashedCardWrap">
                    <button
                      type="button"
                      className="adminTreeAddDashedCard"
                      onClick={() => openCreateMemberForGroup(groupId, groupName, badge || 'เจ้าหน้าที่ผู้ปฏิบัติงาน')}
                      title={`เพิ่มบุคลากร (${badge || 'เจ้าหน้าที่'})`}
                    >
                      <UserPlus size={18} />
                      <span>+ เพิ่มบุคลากร</span>
                    </button>
                  </li>
                )}
              </ul>
              {!isLastRow && <div className="adminTieredInterRowStem" aria-hidden="true" />}
            </div>
          )
        })}
        {rows.length === 0 && (
          <ul className="adminTieredRow">
            <li key="admin-add-card-empty" className="adminTreeAddDashedCardWrap">
              <button
                type="button"
                className="adminTreeAddDashedCard"
                onClick={() => openCreateMemberForGroup(groupId, groupName, badge || 'เจ้าหน้าที่ผู้ปฏิบัติงาน')}
                title={`เพิ่มบุคลากร (${badge || 'เจ้าหน้าที่'})`}
              >
                <UserPlus size={18} />
                <span>+ เพิ่มบุคลากร</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    )
  }

  const renderAdminSubnode = (node: OrgGroupNode, rowSize = 4) => {
    const leader = node.members.find((m) => isLeaderRole(m.role)) || (node.members.length > 0 && node.members[0].role !== 'member' && node.members[0].role !== 'เจ้าหน้าที่ผู้ปฏิบัติงาน' ? node.members[0] : undefined)
    const otherLeaders = node.members.filter((m) => m.id !== leader?.id && (isLeaderRole(m.role) || (m.role !== 'member' && m.role !== 'เจ้าหน้าที่ผู้ปฏิบัติงาน')))
    const staff = node.members.filter((m) => m.id !== leader?.id && !otherLeaders.some((ol) => ol.id === m.id))
    const children = node.children || []

    const hasChildBranches = children.length > 0 || otherLeaders.length > 0 || staff.length > 0

    return (
      <li key={`subnode-${node.id}`} className="adminOrgTreeSubItem">
        <div className="adminTreeNodeCard subUnitNode">
          {/* Top Bar: Unit Tag on left, Edit/Delete on right */}
          <div className="adminTreeNodeHeader">
            <span className="adminTreeNodeGroupTag">งานย่อย</span>
            <div className="adminNodeHeaderActions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="adminIconBtn"
                onClick={() => openEditGroup(node)}
                title="แก้ไขชื่องานย่อย"
                aria-label="แก้ไขชื่องานย่อย"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="adminIconBtn danger"
                onClick={() => handleDeleteGroup(node)}
                title="ลบงานย่อย"
                aria-label="ลบงานย่อย"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <h3 className="adminTreeNodeTitle" title={node.name}>
            {node.name}
          </h3>

          {/* Leader Section */}
          {leader ? (
            <div className="adminNodeLeaderWrap">
              <div className="adminNodeLeaderAvatarWrap">
                {leader.imagePath ? (
                  <img src={leader.imagePath} alt={leader.name} className="adminNodeLeaderAvatar" />
                ) : (
                  <div className="adminNodeLeaderFallback">{getInitials(leader.name)}</div>
                )}
                <span className="adminCrownBadge" title="หัวหน้างาน">
                  <Crown size={11} />
                </span>
              </div>
              <span className="adminNodeLeaderName">{leader.name}</span>
              <span className="adminNodeLeaderPosition">{leader.position}</span>
              <div className="adminLeaderActionsOverlay" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="adminMiniBtn"
                  onClick={() => openEditMember(leader)}
                  title="แก้ไขข้อมูล"
                >
                  <Edit2 size={12} />
                  <span>แก้ไขข้อมูล</span>
                </button>
                <button
                  type="button"
                  className="adminMiniBtn danger"
                  onClick={() => handleDeleteMember(leader)}
                  title="ลบข้อมูลหัวหน้า"
                >
                  <Trash2 size={12} />
                  <span>ลบ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="adminNoLeaderCard">
              <span className="adminNoLeaderText">ยังไม่มีหัวหน้างาน</span>
              <button
                type="button"
                className="adminMiniBtn primary"
                onClick={() => openCreateMemberForGroup(node.id, node.name, 'หัวหน้างาน')}
              >
                <Plus size={12} />
                <span>+ กำหนดหัวหน้า</span>
              </button>
            </div>
          )}

          {/* Prominent Card Bottom Action Bar - Big, clear buttons! */}
          <div className="adminCardBottomBar" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="adminCardActionBtn primary"
              onClick={() => openCreateMemberForGroup(node.id, node.name)}
              title="เพิ่มสมาชิกเข้างานย่อยนี้"
            >
              <UserPlus size={14} />
              <span>+ สมาชิก</span>
            </button>
            <button
              type="button"
              className="adminCardActionBtn secondary"
              onClick={() => openCreateSubGroup(node.id)}
              title="เพิ่มงานย่อยภายใต้งานนี้"
            >
              <FolderPlus size={14} />
              <span>+ งานย่อย</span>
            </button>
          </div>
        </div>

        {/* Continuous Stem & Child Branches */}
        {hasChildBranches && (
          children.length === 0 && otherLeaders.length === 0 ? (
            <>
              <div className="adminTreeVerticalStem" />
              <div className="adminDirectStaffBlock">
                <div className="adminStaffTierHeader">
                  <Users size={14} className="text-emerald-700" />
                  <span>เจ้าหน้าที่ ({staff.length} คน)</span>
                </div>
                {renderAdminTieredStaff(staff, rowSize, 'เจ้าหน้าที่', true, node.id, node.name)}
              </div>
            </>
          ) : (
            <ul className="adminTreeBranchRow">
              {children.map((child) => renderAdminSubnode(child, rowSize))}

              <li key="add-subunit-dashed-child" className="adminOrgTreeBranchItem dashed">
                <button
                  type="button"
                  className="adminTreeAddSubunitDashedCard"
                  onClick={() => openCreateSubGroup(node.id)}
                  title="เพิ่มงานย่อยภายใต้แผนกนี้"
                >
                  <FolderPlus size={20} />
                  <span>+ เพิ่มงานย่อย</span>
                </button>
              </li>

              {otherLeaders.map((deputy) =>
                renderAdminMemberLeaf(deputy, deputy.role, node.id, node.name)
              )}

              {staff.length > 0 && (
                <li key="nested-staff-branch" className="adminOrgTreeBranchItem staffBranch">
                  <div className="adminStaffBranchCardWrap">
                    <div className="adminStaffBranchHeader">
                      <Users size={14} />
                      <span>เจ้าหน้าที่ ({staff.length} คน)</span>
                    </div>
                    {renderAdminTieredStaff(staff, rowSize, 'เจ้าหน้าที่', true, node.id, node.name)}
                  </div>
                </li>
              )}
            </ul>
          )
        )}
      </li>
    )
  }

  const renderAdminRootNode = (root: OrgGroupNode) => {
    const leader = root.members.find((m) => isLeaderRole(m.role)) || (root.members.length > 0 && root.members[0].role !== 'member' && root.members[0].role !== 'เจ้าหน้าที่ผู้ปฏิบัติงาน' ? root.members[0] : undefined)
    const otherLeaders = root.members.filter((m) => m.id !== leader?.id && (isLeaderRole(m.role) || (m.role !== 'member' && m.role !== 'เจ้าหน้าที่ผู้ปฏิบัติงาน')))
    const staff = root.members.filter((m) => m.id !== leader?.id && !otherLeaders.some((ol) => ol.id === m.id))
    const children = root.children || []

    const hasRootBranches = children.length > 0 || otherLeaders.length > 0 || staff.length > 0

    return (
      <div className="adminOrgTree">
        <div className="adminTreeNodeCard rootNode">
          {/* Top Bar: Group Tag on left, Edit/Delete on right */}
          <div className="adminTreeNodeHeader">
            <span className="adminTreeNodeGroupTag">กลุ่มงานหลัก</span>
            <div className="adminNodeHeaderActions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="adminIconBtn"
                onClick={() => openEditGroup(root)}
                title="แก้ไขชื่อกลุ่มงานหลัก"
                aria-label="แก้ไขชื่อกลุ่มงานหลัก"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="adminIconBtn danger"
                onClick={() => handleDeleteGroup(root)}
                title="ลบกลุ่มงานหลัก"
                aria-label="ลบกลุ่มงานหลัก"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <h2 className="adminTreeNodeTitle" title={root.name}>
            {root.name}
          </h2>

          {/* Leader Section */}
          {leader ? (
            <div className="adminNodeLeaderWrap">
              <div className="adminNodeLeaderAvatarWrap">
                {leader.imagePath ? (
                  <img src={leader.imagePath} alt={leader.name} className="adminNodeLeaderAvatar" />
                ) : (
                  <div className="adminNodeLeaderFallback">{getInitials(leader.name)}</div>
                )}
                <span className="adminCrownBadge" title="หัวหน้ากลุ่มงาน">
                  <Crown size={12} />
                </span>
              </div>
              <span className="adminNodeLeaderName">{leader.name}</span>
              <span className="adminNodeLeaderPosition">{leader.position}</span>
              <div className="adminLeaderActionsOverlay" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="adminMiniBtn"
                  onClick={() => openEditMember(leader)}
                  title="แก้ไขข้อมูล"
                >
                  <Edit2 size={12} />
                  <span>แก้ไขข้อมูล</span>
                </button>
                <button
                  type="button"
                  className="adminMiniBtn danger"
                  onClick={() => handleDeleteMember(leader)}
                  title="ลบข้อมูลหัวหน้ากลุ่มงาน"
                >
                  <Trash2 size={12} />
                  <span>ลบ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="adminNoLeaderCard">
              <span className="adminNoLeaderText">ยังไม่มีหัวหน้ากลุ่มงาน</span>
              <button
                type="button"
                className="adminMiniBtn primary"
                onClick={() => openCreateMemberForGroup(root.id, root.name, 'หัวหน้ากลุ่มงาน')}
              >
                <Plus size={12} />
                <span>+ กำหนดหัวหน้ากลุ่มงาน</span>
              </button>
            </div>
          )}

          {/* Prominent Card Bottom Action Bar */}
          <div className="adminCardBottomBar" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="adminCardActionBtn primary"
              onClick={() => openCreateMemberForGroup(root.id, root.name)}
              title="เพิ่มสมาชิกเข้ากลุ่มงานหลัก"
            >
              <UserPlus size={15} />
              <span>+ เพิ่มสมาชิก</span>
            </button>
            <button
              type="button"
              className="adminCardActionBtn secondary"
              onClick={() => openCreateSubGroup(root.id)}
              title="เพิ่มหน่วยงานย่อย"
            >
              <FolderPlus size={15} />
              <span>+ เพิ่มงานย่อย</span>
            </button>
          </div>
        </div>

        {/* Continuous Connecting Stem & Child Branches */}
        {hasRootBranches && (
          children.length === 0 && otherLeaders.length === 0 ? (
            /* Only staff under department -> Vertical stem straight to staff block */
            <>
              <div className="adminTreeVerticalStem" />
              <div className="adminDirectStaffBlock">
                <div className="adminStaffTierHeader">
                  <Users size={15} className="text-emerald-700" />
                  <span>เจ้าหน้าที่ผู้ปฏิบัติงาน ({staff.length} คน)</span>
                </div>
                {renderAdminTieredStaff(staff, membersPerRow, 'เจ้าหน้าที่', false, root.id, root.name)}
                <div className="adminAddSubunitPrompt">
                  <button
                    type="button"
                    className="adminTreeAddSubunitDashedCard"
                    onClick={() => openCreateSubGroup(root.id)}
                    title="เพิ่มหน่วยงานย่อย"
                  >
                    <FolderPlus size={18} />
                    <span>+ เพิ่มงานย่อยในกลุ่มงานนี้</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Has Sub-units -> Branch row with continuous horizontal and vertical lines */
            <ul className="adminTreeBranchRow">
              {children.map((child) => renderAdminSubnode(child, membersPerRow))}

              <li key="add-subunit-dashed-root" className="adminOrgTreeBranchItem dashed">
                <button
                  type="button"
                  className="adminTreeAddSubunitDashedCard"
                  onClick={() => openCreateSubGroup(root.id)}
                  title="เพิ่มหน่วยงานย่อย"
                >
                  <FolderPlus size={20} />
                  <span>+ เพิ่มงานย่อย</span>
                </button>
              </li>

              {otherLeaders.map((deputy) =>
                renderAdminMemberLeaf(deputy, deputy.role, root.id, root.name)
              )}

              {staff.length > 0 && (
                <li key="root-staff-branch" className="adminOrgTreeBranchItem staffBranch">
                  <div className="adminStaffBranchCardWrap">
                    <div className="adminStaffBranchHeader">
                      <Users size={14} />
                      <span>เจ้าหน้าที่กลุ่มงานหลัก ({staff.length} คน)</span>
                    </div>
                    {renderAdminTieredStaff(staff, membersPerRow, 'เจ้าหน้าที่', false, root.id, root.name)}
                  </div>
                </li>
              )}
            </ul>
          )
        )}
      </div>
    )
  }

  return (
    <div className="orgAdminPage">
      <div className="orgAdminContainer">
        <OrganizationHeaderAndStats
          rolesCount={roles.length}
          groupStats={groupStats}
          selectedGroup={selectedGroup}
          membersCount={members.length}
          leaderCount={leaderMembers.length}
          adminViewMode={adminViewMode}
          setAdminViewMode={setAdminViewMode}
          setIsRoleModalOpen={setIsRoleModalOpen}
          onCreateMainGroup={() => {
            setGroupModalMode('create')
            setGroupFormData({ name: '', parentId: null })
            setIsGroupModalOpen(true)
          }}
        />
        {adminViewMode === 'diagram' ? (
          <OrganizationDiagramSection
            effectiveOrgChart={effectiveOrgChart}
            selectedRoot={selectedRoot}
            setSelectedRootId={setSelectedRootId}
            groups={groups}
            setSelectedGroup={setSelectedGroup}
            handleResetDiagramView={handleResetDiagramView}
            zoom={zoom}
            setZoom={setZoom}
            isPanning={isPanning}
            pan={pan}
            handleDiagramPointerDown={handleDiagramPointerDown}
            handleDiagramPointerMove={handleDiagramPointerMove}
            handleDiagramPointerUp={handleDiagramPointerUp}
            handleDiagramWheel={handleDiagramWheel}
            renderAdminRootNode={renderAdminRootNode}
          />
        ) : (
          <OrganizationWorkbench
            groupStats={groupStats}
            searchGroupQuery={searchGroupQuery}
            setSearchGroupQuery={setSearchGroupQuery}
            loadingGroups={loadingGroups}
            filteredGroups={filteredGroups}
            renderGroupNode={renderGroupNode}
            selectedGroup={selectedGroup}
            breadcrumbs={breadcrumbs}
            members={members}
            leaderMembers={leaderMembers}
            regularMembers={regularMembers}
            loadingMembers={loadingMembers}
            roleSections={roleSections}
            searchMemberInGroupQuery={searchMemberInGroupQuery}
            setSearchMemberInGroupQuery={setSearchMemberInGroupQuery}
            draggedMemberId={draggedMemberId}
            dragOverMemberId={dragOverMemberId}
            handleMemberDragStart={handleMemberDragStart}
            handleMemberDragOver={handleMemberDragOver}
            handleMemberDragLeave={handleMemberDragLeave}
            handleMemberDrop={handleMemberDrop}
            handleMemberDragEnd={handleMemberDragEnd}
            handleMoveMember={handleMoveMember}
            handleDeleteMember={handleDeleteMember}
            onCreateMainGroup={() => {
              setGroupModalMode('create')
              setGroupFormData({ name: '', parentId: null })
              setIsGroupModalOpen(true)
            }}
            onOpenGroupModal={(mode, data) => {
              setGroupModalMode(mode)
              setGroupFormData(data)
              setIsGroupModalOpen(true)
            }}
            onOpenCreateMemberModal={() => {
              setMemberModalMode('create')
              setMemberFormData({
                name: '',
                position: '',
                role: 'member',
                phone: '',
                imagePath: '',
                memberId: null,
              })
              isSelectingMemberRef.current = false
              setSearchMemberResults([])
              setSearchMemberQuery('')
              setImgPreviewFailed(false)
              setIsMemberModalOpen(true)
            }}
            onOpenEditMemberModal={(member) => {
              setMemberModalMode('edit')
              setMemberFormData({
                id: member.id,
                name: member.name,
                position: member.position,
                role: member.role,
                phone: member.phone || '',
                imagePath: member.imagePath || '',
                memberId: member.memberId || null,
              })
              setImgPreviewFailed(false)
              setIsMemberModalOpen(true)
            }}
          />
        )}

        <OrganizationAdminModals
          isGroupModalOpen={isGroupModalOpen}
          setIsGroupModalOpen={setIsGroupModalOpen}
          groupModalMode={groupModalMode}
          groupFormData={groupFormData}
          setGroupFormData={setGroupFormData}
          groups={groups}
          handleSaveGroup={handleSaveGroup}
          isMemberModalOpen={isMemberModalOpen}
          setIsMemberModalOpen={setIsMemberModalOpen}
          memberModalMode={memberModalMode}
          selectedGroup={selectedGroup}
          handleSaveMember={handleSaveMember}
          autocompleteContainerRef={autocompleteContainerRef}
          searchMemberQuery={searchMemberQuery}
          setSearchMemberQuery={setSearchMemberQuery}
          isSelectingMemberRef={isSelectingMemberRef}
          searchMemberResults={searchMemberResults}
          setSearchMemberResults={setSearchMemberResults}
          searchingMembers={searchingMembers}
          memberFormData={memberFormData}
          setMemberFormData={setMemberFormData}
          addToast={addToast}
          imgPreviewFailed={imgPreviewFailed}
          setImgPreviewFailed={setImgPreviewFailed}
          isUploadingPhoto={isUploadingPhoto}
          handlePhotoSelect={handlePhotoSelect}
          handleEditCurrentPhoto={handleEditCurrentPhoto}
          setIsRoleModalOpen={setIsRoleModalOpen}
          roles={roles}
          isRoleModalOpen={isRoleModalOpen}
          handleCreateRole={handleCreateRole}
          newRoleName={newRoleName}
          setNewRoleName={setNewRoleName}
          creatingRole={creatingRole}
          loadingRoles={loadingRoles}
          editingRoleId={editingRoleId}
          setEditingRoleId={setEditingRoleId}
          editingRoleName={editingRoleName}
          setEditingRoleName={setEditingRoleName}
          handleUpdateRole={handleUpdateRole}
          savingRoleEdit={savingRoleEdit}
          handleMoveRole={handleMoveRole}
          handleDeleteRole={handleDeleteRole}
        />

        {/* Image Crop & Background Removal Modal */}
        {isCropModalOpen && imageToCrop && (
          <ImageCropModal
            isOpen={isCropModalOpen}
            imageSrc={imageToCrop}
            title="ตัดครอบรูปถ่ายบุคลากร (Crop Staff Photo)"
            subtitle="ปรับสัดส่วนภาพและเลือกตำแหน่งที่ต้องการแสดงผล"
            initialAspectRatio={3 / 4}
            fileName={cropFileName}
            onClose={handleCloseCropModal}
            onSave={handleSaveCroppedPhoto}
          />
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          description={confirmDialog.message}
          confirmText="ยืนยันการลบ"
          type="danger"
          onConfirm={() => {
            confirmDialog.onConfirm()
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
          }}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* Toasts */}
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </div>
    </div>
  )
}
