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
  GripVertical
} from 'lucide-react'
import ImageCropModal from '@/components/ui/ImageCropModal'
import Link from 'next/link'
import { getInitials } from '@/lib/formatters'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import './page.css'

interface DepartmentGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  isActive: boolean
  children: DepartmentGroupNode[]
}

export interface DepartmentRoleItem {
  id: number
  name: string
  orderIndex: number
  isDefault: boolean
}

interface DepartmentMember {
  id: number
  groupId: number
  name: string
  position: string
  role: string
  orderIndex: number
  imagePath: string | null
  phone?: string | null
  memberId?: number | null
}

interface SystemMemberSearchResult {
  id: number
  name: string
  position: string
  department: string
  profilePath: string | null
}

function findGroupName(nodes: DepartmentGroupNode[], targetId: number): string | null {
  for (const node of nodes) {
    if (node.id === targetId) return node.name
    if (node.children && node.children.length > 0) {
      const found = findGroupName(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

function getGroupBreadcrumbs(
  nodes: DepartmentGroupNode[],
  targetId: number,
  trail: { id: number; name: string }[] = []
): { id: number; name: string }[] | null {
  for (const node of nodes) {
    const currentTrail = [...trail, { id: node.id, name: node.name }]
    if (node.id === targetId) return currentTrail
    if (node.children && node.children.length > 0) {
      const found = getGroupBreadcrumbs(node.children, targetId, currentTrail)
      if (found) return found
    }
  }
  return null
}

function countGroupsAndSubunits(nodes: DepartmentGroupNode[]): { total: number; main: number; sub: number } {
  const main = nodes.length
  let sub = 0
  const countSub = (list: DepartmentGroupNode[]) => {
    for (const item of list) {
      if (item.children && item.children.length > 0) {
        sub += item.children.length
        countSub(item.children)
      }
    }
  }
  countSub(nodes)
  return { total: main + sub, main, sub }
}

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

  useEffect(() => {
    loadGroups()
    loadRoles()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id)
      setSearchMemberInGroupQuery('')
    } else {
      setMembers([])
    }
  }, [selectedGroup?.id])

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
        } else {
          addToast(json.error || 'อัปเดตกลุ่มงานไม่สำเร็จ', 'error')
        }
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการบันทึกกลุ่มงาน', 'error')
    }
  }

  // Delete Group
  const handleDeleteGroup = (group: DepartmentGroupNode) => {
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
        } else {
          addToast(json.error || 'อัปเดตสมาชิกไม่สำเร็จ', 'error')
        }
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลสมาชิก', 'error')
    }
  }

  // Delete Member
  const handleDeleteMember = (member: DepartmentMember) => {
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
  const roleSections = useMemo(() => {
    if (roles.length === 0) {
      const leaders = members.filter((m) => {
        const r = (m.role || '').toLowerCase().trim()
        return r === 'leader' || (r.includes('หัวหน้า') && !r.includes('รอง') && !r.includes('ผู้ช่วย'))
      })
      const regulars = members.filter((m) => !leaders.some((l) => l.id === m.id))
      return [
        { id: 1, name: 'หัวหน้ากลุ่มงาน / ผู้บริหาร', isLeader: true, orderIndex: 0, isDefault: false, members: leaders },
        { id: 2, name: 'เจ้าหน้าที่ / สมาชิกในกลุ่มงาน', isLeader: false, orderIndex: 1, isDefault: true, members: regulars }
      ]
    }

    const q = searchMemberInGroupQuery.trim().toLowerCase()
    const visibleMembers = q
      ? members.filter((m) => m.name.toLowerCase().includes(q) || m.position.toLowerCase().includes(q))
      : members

    const membersByRoleId = new Map<number, DepartmentMember[]>()
    roles.forEach((r) => membersByRoleId.set(r.id, []))
    const otherMembers: DepartmentMember[] = []

    const defaultRole = roles.find((r) => r.isDefault) || roles[roles.length - 1]
    const topRole = roles[0]

    // Assign each member to exactly ONE section
    for (const m of visibleMembers) {
      const mRole = (m.role || '').toLowerCase().trim()

      // 1. Exact match with a role name
      const exactRole = roles.find((r) => r.name.toLowerCase().trim() === mRole)
      if (exactRole) {
        membersByRoleId.get(exactRole.id)?.push(m)
        continue
      }

      // 2. Legacy 'leader' -> ONLY top-level leader role (roles[0]), never deputy/staff
      if (mRole === 'leader') {
        if (topRole) {
          membersByRoleId.get(topRole.id)?.push(m)
        } else {
          otherMembers.push(m)
        }
        continue
      }

      // 3. Legacy 'member' -> default role (or last role)
      if (mRole === 'member') {
        if (defaultRole) {
          membersByRoleId.get(defaultRole.id)?.push(m)
        } else {
          otherMembers.push(m)
        }
        continue
      }

      // 4. Fuzzy fallback if role has keyword
      if (mRole) {
        if (mRole.includes('รอง')) {
          const deputyRole = roles.find((r) => r.name.toLowerCase().includes('รอง'))
          if (deputyRole) {
            membersByRoleId.get(deputyRole.id)?.push(m)
            continue
          }
        } else if (mRole.includes('หัวหน้า') && !mRole.includes('ผู้ช่วย')) {
          const leaderRole = roles.find((r) => {
            const name = r.name.toLowerCase()
            return name.includes('หัวหน้า') && !name.includes('รอง') && !name.includes('ผู้ช่วย')
          }) || topRole
          if (leaderRole) {
            membersByRoleId.get(leaderRole.id)?.push(m)
            continue
          }
        }
      }

      // 5. Unmatched
      otherMembers.push(m)
    }

    const sections = roles.map((role, idx) => {
      const isLeader = idx === 0 || (role.name.toLowerCase().includes('หัวหน้า') && !role.name.toLowerCase().includes('รอง') && !role.name.toLowerCase().includes('ผู้ช่วย'))
      return {
        id: role.id,
        name: role.name,
        isLeader,
        orderIndex: role.orderIndex,
        isDefault: role.isDefault,
        members: membersByRoleId.get(role.id) || []
      }
    })

    if (otherMembers.length > 0) {
      sections.push({
        id: 99999,
        name: 'บทบาทอื่นๆ',
        isLeader: false,
        orderIndex: 99999,
        isDefault: false,
        members: otherMembers
      })
    }

    return sections
  }, [members, roles, searchMemberInGroupQuery])

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

  return (
    <div className="orgAdminPage">
      <div className="orgAdminContainer">
        {/* Top Header Card */}
        <header className="orgAdminHeader">
          <div className="orgAdminHeaderLeft">
            <div className="orgAdminLogoBadge">
              <Building2 className="text-emerald-700" size={26} />
            </div>
            <div className="orgAdminHeaderTitle">
              <h1>
                <Users className="text-emerald-700 hidden sm:inline-block" size={26} />
                จัดการแผนผังและสมาชิกกลุ่มงาน
              </h1>
              <p>
                จัดการโครงสร้างกลุ่มภารกิจ หน่วยงานย่อย และทำเนียบบุคลากรประจำแต่ละแผนกของโรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="orgAdminHeaderActions">
            <Link
              href="/about/organization"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btnSecondary"
              title="เปิดดูหน้าโครงสร้างองค์กรที่ประชาชนทั่วไปมองเห็น"
            >
              <span>ดูหน้าเว็บสาธารณะ</span>
              <ExternalLink size={14} />
            </Link>
            <button
              type="button"
              className="btn btnSecondary"
              onClick={() => setIsRoleModalOpen(true)}
              title="จัดการระดับบทบาทบุคลากร (หัวหน้า, รองหัวหน้า, เจ้าหน้าที่ ฯลฯ)"
            >
              <Shield size={15} className="text-emerald-700" />
              <span>ระดับบทบาท ({roles.length})</span>
            </button>
            <button
              type="button"
              className="btn btnPrimary"
              onClick={() => {
                setGroupModalMode('create')
                setGroupFormData({ name: '', parentId: null })
                setIsGroupModalOpen(true)
              }}
            >
              <FolderPlus size={16} />
              <span>เพิ่มกลุ่มงานหลัก</span>
            </button>
          </div>
        </header>

        {/* Overview Stats Strip */}
        <div className="orgStatsStrip">
          <div className="orgStatItem">
            <div className="orgStatIconWrap">
              <Building2 size={16} />
            </div>
            <div className="orgStatInfo">
              <span className="orgStatLabel">กลุ่มงานหลัก</span>
              <span className="orgStatValue">{groupStats.main}</span>
            </div>
          </div>

          <div className="orgStatDivider" />

          <div className="orgStatItem">
            <div className="orgStatIconWrap sub">
              <Layers size={16} />
            </div>
            <div className="orgStatInfo">
              <span className="orgStatLabel">หน่วยงานย่อย</span>
              <span className="orgStatValue">{groupStats.sub}</span>
            </div>
          </div>

          <div className="orgStatDivider" />

          <div className="orgStatItem">
            <div className="orgStatIconWrap active">
              <Users size={16} />
            </div>
            <div className="orgStatInfo">
              <span className="orgStatLabel">สมาชิกในกลุ่มที่เลือก</span>
              <span className="orgStatValue">
                {selectedGroup ? members.length : '—'}
                <small className="orgStatUnit">{selectedGroup ? ' คน' : ''}</small>
              </span>
            </div>
          </div>

          <div className="orgStatDivider" />

          <div className="orgStatItem">
            <div className="orgStatIconWrap gold">
              <Crown size={16} />
            </div>
            <div className="orgStatInfo">
              <span className="orgStatLabel">หัวหน้ากลุ่มงานนี้</span>
              <span className="orgStatValue">
                {selectedGroup ? leaderMembers.length : '—'}
                <small className="orgStatUnit">{selectedGroup ? ' ท่าน' : ''}</small>
              </span>
            </div>
          </div>
        </div>

        {/* Workbench Split View */}
        <div className="orgWorkbench">
          {/* Left Pane: Groups Explorer */}
          <aside className="orgGroupsPane">
            <div className="orgPaneHeader">
              <div className="orgPaneHeaderTitle">
                <FolderTree size={18} className="text-emerald-700" />
                <h3>โครงสร้างกลุ่มงาน</h3>
                <span className="orgPaneBadge">{groupStats.total} แผนก</span>
              </div>
              <button
                type="button"
                className="btn btnSecondary btnSmall"
                onClick={() => {
                  setGroupModalMode('create')
                  setGroupFormData({ name: '', parentId: null })
                  setIsGroupModalOpen(true)
                }}
                title="สร้างกลุ่มงานระดับบนสุดใหม่"
              >
                <Plus size={13} />
                <span>กลุ่มหลัก</span>
              </button>
            </div>

            {/* Quick Search for Groups */}
            <div className="orgGroupSearchWrap">
              <Search size={14} className="orgGroupSearchIcon" />
              <input
                type="text"
                className="orgGroupSearchInput"
                placeholder="ค้นหากลุ่มงาน หรือ งานย่อย..."
                value={searchGroupQuery}
                onChange={(e) => setSearchGroupQuery(e.target.value)}
              />
              {searchGroupQuery && (
                <button
                  type="button"
                  className="orgGroupSearchClear"
                  onClick={() => setSearchGroupQuery('')}
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="orgTreeList">
              {loadingGroups ? (
                <div className="emptyState" style={{ padding: '40px 10px' }}>
                  <Loader2 className="animate-spin text-emerald-700" size={24} />
                  <span>กำลังโหลดกลุ่มงาน...</span>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="emptyState" style={{ padding: '40px 10px' }}>
                  <Building2 size={32} className="text-slate-300" />
                  <span className="emptyStateTitle">
                    {searchGroupQuery ? 'ไม่พบกลุ่มงานที่ค้นหา' : 'ยังไม่มีกลุ่มงาน'}
                  </span>
                  <p style={{ fontSize: '0.8rem' }}>
                    {searchGroupQuery
                      ? 'ลองค้นหาด้วยคำอื่น หรือกดล้างการค้นหา'
                      : 'คลิกปุ่ม "+ กลุ่มหลัก" ด้านบนเพื่อเริ่มต้นสร้างโครงสร้าง'}
                  </p>
                  {searchGroupQuery && (
                    <button
                      type="button"
                      className="btn btnSecondary btnSmall"
                      onClick={() => setSearchGroupQuery('')}
                    >
                      ล้างการค้นหา
                    </button>
                  )}
                </div>
              ) : (
                filteredGroups.map((group, idx) => renderGroupNode(group, 0, filteredGroups, idx))
              )}
            </div>
          </aside>

          {/* Right Pane: Members in Selected Group */}
          <main className="orgMembersPane">
            {selectedGroup ? (
              <>
                {/* Selected Group Header */}
                <div className="orgMembersHeader">
                  <div className="orgMembersTitleWrap">
                    {/* Breadcrumbs path */}
                    <div className="orgBreadcrumbRow">
                      <span className="orgBreadcrumbItem">โครงสร้าง</span>
                      {breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={crumb.id}>
                          <ChevronRight size={13} className="text-slate-400" />
                          <span
                            className={`orgBreadcrumbItem ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
                          >
                            {crumb.name}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="orgGroupNameRow">
                      <h2>{selectedGroup.name}</h2>
                      <div className="orgGroupActionsPill">
                        <button
                          type="button"
                          className="actionPillBtn"
                          title="แก้ไขชื่อกลุ่มงานนี้"
                          onClick={() => {
                            setGroupModalMode('edit')
                            setGroupFormData({
                              id: selectedGroup.id,
                              name: selectedGroup.name,
                              parentId: selectedGroup.parentId
                            })
                            setIsGroupModalOpen(true)
                          }}
                        >
                          <Edit2 size={13} />
                          <span>แก้ไขชื่อ</span>
                        </button>
                        <button
                          type="button"
                          className="actionPillBtn"
                          title="เพิ่มงานย่อยภายใต้กลุ่มนี้"
                          onClick={() => {
                            setGroupModalMode('create')
                            setGroupFormData({ name: '', parentId: selectedGroup.id })
                            setIsGroupModalOpen(true)
                          }}
                        >
                          <Plus size={13} />
                          <span>เพิ่มงานย่อย</span>
                        </button>
                      </div>
                    </div>

                    <div className="orgGroupSummaryInfo">
                      <span className="summaryPill">
                        <Users size={12} /> บุคลากรทั้งหมด <strong>{members.length}</strong> คน
                      </span>
                      <span className="summaryPill">
                        <Crown size={12} className="text-amber-600" /> หัวหน้า <strong>{leaderMembers.length}</strong> ท่าน
                      </span>
                      <span className="summaryPill">
                        <UserCheck size={12} className="text-emerald-700" /> เจ้าหน้าที่ <strong>{regularMembers.length}</strong> คน
                      </span>
                    </div>
                  </div>

                  {/* Header CTA Buttons */}
                  <div className="orgMembersHeaderActions">
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={() => {
                        setMemberModalMode('create')
                        setMemberFormData({
                          name: '',
                          position: '',
                          role: 'member',
                          phone: '',
                          imagePath: '',
                          memberId: null
                        })
                        isSelectingMemberRef.current = false
                        setSearchMemberResults([])
                        setSearchMemberQuery('')
                        setImgPreviewFailed(false)
                        setIsMemberModalOpen(true)
                      }}
                    >
                      <UserPlus size={16} />
                      <span>เพิ่มสมาชิก</span>
                    </button>
                  </div>
                </div>

                {/* In-group member search filter (only show if members exist) */}
                {members.length > 3 && (
                  <div className="orgMemberFilterRow">
                    <div className="orgMemberSearchInputWrap">
                      <Search size={14} className="orgMemberSearchIcon" />
                      <input
                        type="text"
                        className="orgMemberSearchInput"
                        placeholder="ค้นหาชื่อหรือตำแหน่งในกลุ่มงานนี้..."
                        value={searchMemberInGroupQuery}
                        onChange={(e) => setSearchMemberInGroupQuery(e.target.value)}
                      />
                      {searchMemberInGroupQuery && (
                        <button
                          type="button"
                          className="orgMemberSearchClear"
                          onClick={() => setSearchMemberInGroupQuery('')}
                          aria-label="ล้างคำค้นหา"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {loadingMembers ? (
                  <div className="emptyState">
                    <Loader2 className="animate-spin text-emerald-700" size={32} />
                    <span>กำลังโหลดรายชื่อสมาชิก...</span>
                  </div>
                ) : members.length === 0 ? (
                  <div className="emptyState">
                    <div className="emptyStateIconCircle">
                      <Users size={36} className="text-emerald-700" />
                    </div>
                    <span className="emptyStateTitle">ยังไม่มีสมาชิกในกลุ่มงานนี้</span>
                    <p style={{ fontSize: '0.875rem', maxWidth: '420px' }}>
                      เพิ่มหัวหน้ากลุ่มงานหรือเจ้าหน้าที่ผู้ปฏิบัติงาน เพื่อเริ่มต้นจัดทำเนียบและแสดงผลในแผนผังองค์กรของโรงพยาบาลเถิน
                    </p>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={() => {
                        setMemberModalMode('create')
                        setMemberFormData({
                          name: '',
                          position: '',
                          role: 'member',
                          phone: '',
                          imagePath: '',
                          memberId: null
                        })
                        setSearchMemberQuery('')
                        setImgPreviewFailed(false)
                        setIsMemberModalOpen(true)
                      }}
                    >
                      <UserPlus size={16} />
                      <span>เพิ่มสมาชิกคนแรก</span>
                    </button>
                  </div>
                ) : (
                  <div className="orgMembersListScroll">
                    {roleSections.map((sec) => {
                      if (sec.members.length === 0) return null

                      return (
                        <section key={sec.id} className="orgMemberSection">
                          <div className="orgSectionHeading">
                            {sec.isLeader ? (
                              <Crown size={15} className="text-amber-600" />
                            ) : (
                              <Users size={15} className="text-slate-600" />
                            )}
                            <span>{sec.name}</span>
                            <span className="orgSectionCount">{sec.members.length}</span>
                          </div>

                          <div className={sec.isLeader ? "leaderCardsList" : "membersGrid"}>
                            {sec.members.map((member, memberIndex) => {
                              const isDragging = draggedMemberId === member.id
                              const isDropTarget = dragOverMemberId === member.id

                              return sec.isLeader ? (
                                <div
                                  key={member.id}
                                  className={`leaderCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleMemberDragStart(member.id, e)}
                                  onDragOver={(e) => handleMemberDragOver(member.id, e)}
                                  onDragLeave={handleMemberDragLeave}
                                  onDrop={(e) => handleMemberDrop(member.id, e)}
                                  onDragEnd={handleMemberDragEnd}
                                >
                                  <div className="dragHandleWrap" title="ลากเพื่อสลับตำแหน่ง">
                                    <GripVertical size={16} className="text-slate-400" />
                                  </div>

                                  <div className="leaderAvatarWrap">
                                    {member.imagePath ? (
                                      <img
                                        src={member.imagePath}
                                        alt={member.name}
                                        className="leaderAvatar"
                                      />
                                    ) : (
                                      <div className="avatarFallback">
                                        {getInitials(member.name)}
                                      </div>
                                    )}
                                    <span className="leaderCrownBadge" title="หัวหน้ากลุ่มงาน">
                                      <Crown size={12} />
                                    </span>
                                  </div>

                                  <div className="leaderInfo">
                                    <div className="leaderHeaderLine">
                                      <span className="leaderBadge">
                                        {sec.name}
                                      </span>
                                      {member.memberId && (
                                        <span className="linkedAccountBadge" title="ผูกกับบัญชีบุคลากรในระบบ">
                                          <CheckCircle2 size={11} /> บุคลากรในระบบ
                                        </span>
                                      )}
                                    </div>
                                    <span className="leaderName">{member.name}</span>
                                    <span className="leaderPosition">{member.position}</span>
                                    {member.phone && (
                                      <div className="leaderPhoneChip" title="เบอร์โทรภายใน (ดูได้เฉพาะเจ้าหน้าที่)">
                                        <Phone size={12} />
                                        <span>เบอร์โทรภายใน: {member.phone}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="cardActionButtons">
                                    <div className="orderButtons">
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนขึ้น"
                                        disabled={memberIndex === 0}
                                        onClick={() => handleMoveMember(sec.members, memberIndex, 'up')}
                                      >
                                        <ArrowUp size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนลง"
                                        disabled={memberIndex === sec.members.length - 1}
                                        onClick={() => handleMoveMember(sec.members, memberIndex, 'down')}
                                      >
                                        <ArrowDown size={12} />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      className="iconBtn"
                                      title="แก้ไขข้อมูล"
                                      onClick={() => {
                                        setMemberModalMode('edit')
                                        setMemberFormData({
                                          id: member.id,
                                          name: member.name,
                                          position: member.position,
                                          role: member.role,
                                          phone: member.phone || '',
                                          imagePath: member.imagePath || '',
                                          memberId: member.memberId || null
                                        })
                                        setImgPreviewFailed(false)
                                        setIsMemberModalOpen(true)
                                      }}
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      className="iconBtn danger"
                                      title="ลบสมาชิก"
                                      onClick={() => handleDeleteMember(member)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  key={member.id}
                                  className={`memberCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleMemberDragStart(member.id, e)}
                                  onDragOver={(e) => handleMemberDragOver(member.id, e)}
                                  onDragLeave={handleMemberDragLeave}
                                  onDrop={(e) => handleMemberDrop(member.id, e)}
                                  onDragEnd={handleMemberDragEnd}
                                >
                                  <div className="dragHandleWrap" title="ลากเพื่อสลับตำแหน่ง">
                                    <GripVertical size={14} className="text-slate-400" />
                                  </div>

                                  <div className="memberCardAvatarWrap">
                                    {member.imagePath ? (
                                      <img
                                        src={member.imagePath}
                                        alt={member.name}
                                        className="memberAvatarSmall"
                                      />
                                    ) : (
                                      <div className="avatarFallback small">
                                        {getInitials(member.name)}
                                      </div>
                                    )}
                                  </div>

                                  <div className="memberCardInfo">
                                    <span className="memberCardName" title={member.name}>
                                      {member.name}
                                    </span>
                                    <span className="memberCardPosition" title={member.position}>
                                      {member.position}
                                    </span>
                                    {member.phone && (
                                      <span className="memberCardPhone" title="เบอร์โทรภายใน">
                                        <Phone size={11} /> {member.phone}
                                      </span>
                                    )}
                                  </div>

                                  <div className="cardActionButtons">
                                    <div className="orderButtons">
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนขึ้น"
                                        disabled={memberIndex === 0}
                                        onClick={() => handleMoveMember(sec.members, memberIndex, 'up')}
                                      >
                                        <ArrowUp size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนลง"
                                        disabled={memberIndex === sec.members.length - 1}
                                        onClick={() => handleMoveMember(sec.members, memberIndex, 'down')}
                                      >
                                        <ArrowDown size={11} />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      className="iconBtn"
                                      title="แก้ไขข้อมูล"
                                      onClick={() => {
                                        setMemberModalMode('edit')
                                        setMemberFormData({
                                          id: member.id,
                                          name: member.name,
                                          position: member.position,
                                          role: member.role,
                                          phone: member.phone || '',
                                          imagePath: member.imagePath || '',
                                          memberId: member.memberId || null
                                        })
                                        setImgPreviewFailed(false)
                                        setIsMemberModalOpen(true)
                                      }}
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="iconBtn danger"
                                      title="ลบสมาชิก"
                                      onClick={() => handleDeleteMember(member)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="emptyState">
                <div className="emptyStateIconCircle">
                  <Building2 size={36} className="text-emerald-700" />
                </div>
                <span className="emptyStateTitle">กรุณาเลือกกลุ่มงาน</span>
                <p style={{ maxWidth: '380px' }}>
                  เลือกกลุ่มงานจากรายการฝั่งซ้ายเพื่อตรวจสอบ ปรับปรุง หรือจัดลำดับรายชื่อสมาชิกและบุคลากร
                </p>
              </div>
            )}
          </main>
        </div>

        {/* Group Add/Edit Modal */}
        {isGroupModalOpen && (
          <div className="modalOverlay" onClick={() => setIsGroupModalOpen(false)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <h3 className="modalHeaderTitle">
                    {groupModalMode === 'create'
                      ? groupFormData.parentId
                        ? 'เพิ่มงานย่อย'
                        : 'เพิ่มกลุ่มงานหลัก'
                      : 'แก้ไขชื่อกลุ่มงาน'}
                  </h3>
                  {groupFormData.parentId && (
                    <p className="modalHeaderSub">
                      ภายใต้กลุ่มงาน:{' '}
                      <strong>{findGroupName(groups, groupFormData.parentId) || 'กลุ่มงานหลัก'}</strong>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setIsGroupModalOpen(false)}
                  aria-label="ปิด"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveGroup}>
                <div className="modalBody">
                  <div className="formGroup">
                    <label className="formLabel">ชื่อกลุ่มงาน / หน่วยงาน *</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น กลุ่มงานการพยาบาล, งานอุบัติเหตุและฉุกเฉิน"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                      required
                      autoFocus
                    />
                    <small className="formHelpText">
                      ชื่อนี้จะปรากฏในผังโครงสร้างองค์กรและเว็บไซต์ทางการของโรงพยาบาลเถิน
                    </small>
                  </div>
                </div>
                <div className="modalFooter">
                  <button
                    type="button"
                    className="btn btnSecondary"
                    onClick={() => setIsGroupModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn btnPrimary">
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Member Add/Edit Modal */}
        {isMemberModalOpen && (
          <div className="modalOverlay" onClick={() => setIsMemberModalOpen(false)}>
            <div className="modalContent modalWide" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <h3 className="modalHeaderTitle">
                    {memberModalMode === 'create' ? 'เพิ่มสมาชิกในกลุ่มงาน' : 'แก้ไขข้อมูลสมาชิก'}
                  </h3>
                  <p className="modalHeaderSub">
                    กลุ่มงาน: <strong>{selectedGroup?.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setIsMemberModalOpen(false)}
                  aria-label="ปิด"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveMember}>
                <div className="modalBody">
                  <div className="modalFormGrid">
                    {/* Left Column: Member Search (if create) + Photo Upload */}
                    <div className="modalSectionCol">
                      {memberModalMode === 'create' && (
                        <div className="formGroup autocompleteContainer" ref={autocompleteContainerRef}>
                          <label className="formLabel">
                            ดึงข้อมูลจากบัญชีบุคลากร (ทางเลือก)
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              className="formInput"
                              style={{
                                width: '100%',
                                paddingLeft: '34px',
                                paddingRight: searchMemberQuery ? '34px' : '10px',
                                fontSize: '0.85rem'
                              }}
                              placeholder="ค้นชื่อ หรือ แผนก..."
                              value={searchMemberQuery}
                              onChange={(e) => {
                                isSelectingMemberRef.current = false
                                setSearchMemberQuery(e.target.value)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setSearchMemberResults([])
                                }
                              }}
                            />
                            <Search
                              size={15}
                              className="text-slate-400"
                              style={{ position: 'absolute', left: '10px', top: '12px' }}
                            />
                            {searchingMembers ? (
                              <Loader2
                                size={15}
                                className="animate-spin text-emerald-700"
                                style={{ position: 'absolute', right: '10px', top: '12px' }}
                              />
                            ) : searchMemberQuery ? (
                              <button
                                type="button"
                                onClick={() => {
                                  isSelectingMemberRef.current = false
                                  setSearchMemberQuery('')
                                  setSearchMemberResults([])
                                }}
                                aria-label="ล้างคำค้นหา"
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--admin-slate-muted)'
                                }}
                              >
                                <X size={14} />
                              </button>
                            ) : null}
                          </div>

                          {searchMemberResults.length > 0 && (
                            <div className="autocompleteList">
                              {searchMemberResults.map((s) => (
                                <div
                                  key={s.id}
                                  className="autocompleteItem"
                                  onClick={() => {
                                    isSelectingMemberRef.current = true
                                    setMemberFormData({
                                      ...memberFormData,
                                      name: s.name,
                                      position: s.position,
                                      imagePath: s.profilePath || '',
                                      memberId: s.id
                                    })
                                    setSearchMemberResults([])
                                    setSearchMemberQuery(s.name)
                                    addToast(`ดึงข้อมูลคุณ ${s.name} เรียบร้อย`, 'info')
                                  }}
                                >
                                  {s.profilePath ? (
                                    <img
                                      src={s.profilePath}
                                      alt={s.name}
                                      className="autocompleteAvatar"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <div className="autocompleteAvatarFallback">
                                      {getInitials(s.name)}
                                    </div>
                                  )}
                                  <div className="autocompleteText">
                                    <span className="autocompleteItemName">{s.name}</span>
                                    <span className="autocompleteItemSub">
                                      {s.position} • {s.department}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Photo Upload Area */}
                      <div className="formGroup">
                        <label className="formLabel">รูปถ่ายบุคลากร</label>
                        <div className="photoUploadArea">
                          {memberFormData.imagePath && !imgPreviewFailed ? (
                            <img
                              src={memberFormData.imagePath}
                              alt="Preview"
                              className="photoPreview"
                              onError={() => setImgPreviewFailed(true)}
                            />
                          ) : (
                            <div className="avatarFallback photoPreviewFallback">
                              {getInitials(memberFormData.name)}
                            </div>
                          )}

                          <div className="photoUploadActions">
                            <label className="btn btnSecondary btnSmall uploadBtnLabel">
                              <Upload size={14} />
                              <span>{isUploadingPhoto ? 'กำลังอัปโหลด...' : memberFormData.imagePath ? 'เปลี่ยนรูปถ่าย (ตัดครอบ/Crop)' : 'เลือกรูปถ่าย (ตัดครอบ/Crop)'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/jfif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.jfif,.heic,.heif"
                                onChange={handlePhotoSelect}
                                disabled={isUploadingPhoto}
                                style={{ display: 'none' }}
                              />
                            </label>
                            {memberFormData.imagePath && (
                              <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                                <button
                                  type="button"
                                  className="btn btnSecondary btnSmall"
                                  onClick={handleEditCurrentPhoto}
                                  style={{
                                    flex: 1,
                                    fontSize: '0.75rem',
                                    padding: '5px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Crop size={12} color="#2563EB" />
                                  <span>Crop / ตัดครอบรูป</span>
                                </button>
                                <button
                                  type="button"
                                  className="iconBtnCompact danger"
                                  onClick={() => {
                                    setMemberFormData({ ...memberFormData, imagePath: '' })
                                    setImgPreviewFailed(false)
                                  }}
                                  title="ลบรูปภาพ"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Name, Position, Phone */}
                    <div className="modalSectionCol">
                      <div className="formGroup">
                        <label className="formLabel">คำนำหน้า-ชื่อ-นามสกุล *</label>
                        <input
                          type="text"
                          className="formInput"
                          placeholder="เช่น พญ.นฤนาท จอมภาปิน, นายแพทย์สาธิต ปทุมมัง"
                          value={memberFormData.name}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="formGroup">
                        <label className="formLabel">ตำแหน่งงาน *</label>
                        <input
                          type="text"
                          className="formInput"
                          placeholder="เช่น ผู้อำนวยการโรงพยาบาล, พยาบาลวิชาชีพชำนาญการ"
                          value={memberFormData.position}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, position: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="formGroup">
                        <label className="formLabel">
                          เบอร์โทรศัพท์ภายใน (สำหรับดูเฉพาะภายใน รพ.)
                        </label>
                        <input
                          type="text"
                          className="formInput"
                          placeholder="เช่น 101, 102 หรือ เบอร์ต่อห้องตรวจ"
                          value={memberFormData.phone}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, phone: e.target.value })
                          }
                        />
                        <small className="formHelpText">
                          * เบอร์ภายในจะแสดงเฉพาะเจ้าหน้าที่ในระบบ จะไม่แสดงบนเว็บสาธารณะ
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Role in Group (Full Width) */}
                  <div className="formGroup" style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="formLabel">ระดับบทบาทในกลุ่มงาน *</label>
                      <button
                        type="button"
                        onClick={() => setIsRoleModalOpen(true)}
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--admin-primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Shield size={12} />
                        <span>จัดการระดับบทบาท</span>
                      </button>
                    </div>
                    <div className="roleSelectorGrid">
                      {roles.length === 0 ? (
                        <>
                          <div
                            className={`roleOptionCard ${memberFormData.role === 'member' ? 'active' : ''}`}
                            onClick={() => setMemberFormData({ ...memberFormData, role: 'member' })}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="roleOptionCardHeader">
                              <Users size={16} className={memberFormData.role === 'member' ? 'text-emerald-700' : 'text-slate-400'} />
                              <div className="roleOptionCardTitle">เจ้าหน้าที่ผู้ปฏิบัติงาน</div>
                            </div>
                          </div>
                          <div
                            className={`roleOptionCard ${memberFormData.role === 'leader' ? 'active' : ''}`}
                            onClick={() => setMemberFormData({ ...memberFormData, role: 'leader' })}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="roleOptionCardHeader">
                              <Crown size={16} className={memberFormData.role === 'leader' ? 'text-amber-600' : 'text-slate-400'} />
                              <div className="roleOptionCardTitle">หัวหน้ากลุ่มงาน / ผู้บริหาร</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        roles.map((r, rIdx) => {
                          const isSelected =
                            memberFormData.role === r.name ||
                            (rIdx === 0 && memberFormData.role === 'leader') ||
                            (r.isDefault && memberFormData.role === 'member')
                          const isLeader = rIdx === 0 || (r.name.toLowerCase().includes('หัวหน้า') && !r.name.toLowerCase().includes('รอง') && !r.name.toLowerCase().includes('ผู้ช่วย'))

                          return (
                            <div
                              key={r.id}
                              className={`roleOptionCard ${isSelected ? 'active' : ''}`}
                              onClick={() => setMemberFormData({ ...memberFormData, role: r.name })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setMemberFormData({ ...memberFormData, role: r.name })
                                }
                              }}
                            >
                              <div className="roleOptionCardHeader">
                                {isLeader ? (
                                  <Crown size={16} className={isSelected ? 'text-amber-600' : 'text-slate-400'} />
                                ) : (
                                  <Users size={16} className={isSelected ? 'text-emerald-700' : 'text-slate-400'} />
                                )}
                                <div className="roleOptionCardTitle">{r.name}</div>
                              </div>
                              <div className="roleOptionCardDesc">
                                ระดับลำดับที่ {rIdx + 1} {r.isDefault ? '• ค่าเริ่มต้น' : ''}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
                <div className="modalFooter">
                  <button
                    type="button"
                    className="btn btnSecondary"
                    onClick={() => setIsMemberModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn btnPrimary" disabled={isUploadingPhoto}>
                    {isUploadingPhoto ? 'กำลังดำเนินการ...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Role Levels Management Modal */}
        {isRoleModalOpen && (
          <div className="modalOverlay" onClick={() => setIsRoleModalOpen(false)}>
            <div className="modalContent modalWide" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <h3 className="modalHeaderTitle">
                    จัดการระดับบทบาทบุคลากร (Role Levels)
                  </h3>
                  <p className="modalHeaderSub">
                    กำหนดและจัดลำดับความสำคัญของบทบาทบุคลากรภายในกลุ่มงาน (เช่น หัวหน้า, รองหัวหน้า, เจ้าหน้าที่)
                  </p>
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setIsRoleModalOpen(false)}
                  aria-label="ปิด"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modalBody">
                {/* Add Role Form */}
                <form onSubmit={handleCreateRole} className="roleCreateForm">
                  <input
                    type="text"
                    className="formInput"
                    placeholder="ระบุชื่อบทบาทใหม่ เช่น รองหัวหน้ากลุ่มงาน, ผู้ช่วยหัวหน้างาน, พยาบาลประสานงาน..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    disabled={creatingRole}
                  />
                  <button
                    type="submit"
                    className="btn btnPrimary"
                    disabled={creatingRole || !newRoleName.trim()}
                  >
                    {creatingRole ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>เพิ่มบทบาท</span>
                  </button>
                </form>

                {/* Roles List */}
                <div className="roleListContainer">
                  {loadingRoles ? (
                    <div className="emptyState" style={{ padding: '24px 0' }}>
                      <Loader2 className="animate-spin text-emerald-700" size={24} />
                      <span>กำลังโหลดระดับบทบาท...</span>
                    </div>
                  ) : roles.length === 0 ? (
                    <div className="emptyState" style={{ padding: '24px 0' }}>
                      <span>ยังไม่มีบทบาทที่กำหนด</span>
                    </div>
                  ) : (
                    <div className="rolesList">
                      {roles.map((r, index) => {
                        const isEditing = editingRoleId === r.id
                        const isFirst = index === 0
                        const isLast = index === roles.length - 1

                        return (
                          <div key={r.id} className="roleListItem">
                            <div className="roleItemLeft">
                              <div className="roleRankBadge" title={`ลำดับความสำคัญที่ ${index + 1}`}>
                                #{index + 1}
                              </div>

                              {isEditing ? (
                                <div className="roleEditInputWrap">
                                  <input
                                    type="text"
                                    className="formInput"
                                    value={editingRoleName}
                                    onChange={(e) => setEditingRoleName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateRole(r.id)
                                      if (e.key === 'Escape') setEditingRoleId(null)
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btnPrimary btnSmall"
                                    onClick={() => handleUpdateRole(r.id)}
                                    disabled={savingRoleEdit || !editingRoleName.trim()}
                                  >
                                    <Check size={13} /> บันทึก
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btnSecondary btnSmall"
                                    onClick={() => setEditingRoleId(null)}
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <div className="roleItemNameWrap">
                                  <span className="roleItemName">{r.name}</span>
                                  {r.isDefault && (
                                    <span className="roleDefaultTag">ค่าเริ่มต้น</span>
                                  )}
                                  {isFirst && (
                                    <span className="roleTopRankTag">ระดับสูงสุด</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {!isEditing && (
                              <div className="roleItemActions">
                                <div className="orderButtonsRow">
                                  <button
                                    type="button"
                                    className="orderBtnCompact"
                                    title="เลื่อนระดับขึ้น (ความสำคัญสูงขึ้น)"
                                    disabled={isFirst}
                                    onClick={() => handleMoveRole(index, 'up')}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="orderBtnCompact"
                                    title="เลื่อนระดับลง"
                                    disabled={isLast}
                                    onClick={() => handleMoveRole(index, 'down')}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  className="iconBtnCompact"
                                  title="แก้ไขชื่อบทบาท"
                                  onClick={() => {
                                    setEditingRoleId(r.id)
                                    setEditingRoleName(r.name)
                                  }}
                                >
                                  <Edit2 size={13} />
                                </button>

                                <button
                                  type="button"
                                  className="iconBtnCompact danger"
                                  title="ลบบทบาทนี้"
                                  disabled={roles.length <= 1}
                                  onClick={() => handleDeleteRole(r)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => setIsRoleModalOpen(false)}
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

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
