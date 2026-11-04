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
  Crop
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

interface DepartmentMember {
  id: number
  groupId: number
  name: string
  position: string
  role: 'leader' | 'member'
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

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [memberModalMode, setMemberModalMode] = useState<'create' | 'edit'>('create')
  const [memberFormData, setMemberFormData] = useState<{
    id?: number
    name: string
    position: string
    role: 'leader' | 'member'
    phone: string
    imagePath: string
    memberId: number | null
  }>({
    name: '',
    position: '',
    role: 'member',
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

  useEffect(() => {
    loadGroups()
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

  // Move member up/down to reorder scoped strictly to role section
  const handleMoveMember = async (role: 'leader' | 'member', sectionIndex: number, direction: 'up' | 'down') => {
    if (!selectedGroup) return
    const sectionList = role === 'leader' ? leaderMembers : regularMembers
    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1
    if (targetIndex < 0 || targetIndex >= sectionList.length) return

    const updatedSection = [...sectionList]
    const temp = updatedSection[sectionIndex]
    updatedSection[sectionIndex] = updatedSection[targetIndex]
    updatedSection[targetIndex] = temp

    const updatedCombined =
      role === 'leader'
        ? [...updatedSection, ...regularMembers]
        : [...leaderMembers, ...updatedSection]

    setMembers(updatedCombined)

    try {
      const res = await fetch('/api/departments/members/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          memberIds: updatedCombined.map((m) => m.id)
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

  // Split members into leader and normal members
  const leaderMembers = members.filter((m) => m.role === 'leader')
  const regularMembers = members.filter((m) => m.role !== 'leader')

  // Filter members by in-pane search
  const filteredLeaderMembers = useMemo(() => {
    const q = searchMemberInGroupQuery.trim().toLowerCase()
    if (!q) return leaderMembers
    return leaderMembers.filter((m) => m.name.toLowerCase().includes(q) || m.position.toLowerCase().includes(q))
  }, [leaderMembers, searchMemberInGroupQuery])

  const filteredRegularMembers = useMemo(() => {
    const q = searchMemberInGroupQuery.trim().toLowerCase()
    if (!q) return regularMembers
    return regularMembers.filter((m) => m.name.toLowerCase().includes(q) || m.position.toLowerCase().includes(q))
  }, [regularMembers, searchMemberInGroupQuery])

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
                    {/* Leader Section */}
                    {leaderMembers.length > 0 && (
                      <section className="orgMemberSection">
                        <div className="orgSectionHeading">
                          <Crown size={15} className="text-amber-600" />
                          <span>หัวหน้ากลุ่มงาน / ผู้บริหาร</span>
                          <span className="orgSectionCount">{leaderMembers.length}</span>
                        </div>

                        {filteredLeaderMembers.length === 0 ? (
                          <div className="orgNoSearchResultNote">
                            ไม่พบหัวหน้ากลุ่มงานที่ตรงกับคำค้นหา &quot;{searchMemberInGroupQuery}&quot;
                          </div>
                        ) : (
                          <div className="leaderCardsList">
                            {filteredLeaderMembers.map((leader, leaderIndex) => {
                              return (
                                <div key={leader.id} className="leaderCard">
                                  <div className="leaderAvatarWrap">
                                    {leader.imagePath ? (
                                      <img
                                        src={leader.imagePath}
                                        alt={leader.name}
                                        className="leaderAvatar"
                                      />
                                    ) : (
                                      <div className="avatarFallback">
                                        {getInitials(leader.name)}
                                      </div>
                                    )}
                                    <span className="leaderCrownBadge" title="หัวหน้ากลุ่มงาน">
                                      <Crown size={12} />
                                    </span>
                                  </div>

                                  <div className="leaderInfo">
                                    <div className="leaderHeaderLine">
                                      <span className="leaderBadge">
                                        หัวหน้ากลุ่มงาน
                                      </span>
                                      {leader.memberId && (
                                        <span className="linkedAccountBadge" title="ผูกกับบัญชีบุคลากรในระบบ">
                                          <CheckCircle2 size={11} /> บุคลากรในระบบ
                                        </span>
                                      )}
                                    </div>
                                    <span className="leaderName">{leader.name}</span>
                                    <span className="leaderPosition">{leader.position}</span>
                                    {leader.phone && (
                                      <div className="leaderPhoneChip" title="เบอร์โทรภายใน (ดูได้เฉพาะเจ้าหน้าที่)">
                                        <Phone size={12} />
                                        <span>เบอร์โทรภายใน: {leader.phone}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="cardActionButtons">
                                    <div className="orderButtons">
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนขึ้น"
                                        disabled={leaderIndex === 0}
                                        onClick={() => handleMoveMember('leader', leaderIndex, 'up')}
                                      >
                                        <ArrowUp size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนลง"
                                        disabled={leaderIndex === leaderMembers.length - 1}
                                        onClick={() => handleMoveMember('leader', leaderIndex, 'down')}
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
                                          id: leader.id,
                                          name: leader.name,
                                          position: leader.position,
                                          role: leader.role,
                                          phone: leader.phone || '',
                                          imagePath: leader.imagePath || '',
                                          memberId: leader.memberId || null
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
                                      onClick={() => handleDeleteMember(leader)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    )}

                    {/* Regular Members Grid */}
                    {regularMembers.length > 0 && (
                      <section className="orgMemberSection">
                        <div className="orgSectionHeading">
                          <Users size={15} className="text-slate-600" />
                          <span>เจ้าหน้าที่ / สมาชิกในกลุ่มงาน ({regularMembers.length})</span>
                          <span className="orgSectionCount">{regularMembers.length}</span>
                        </div>

                        {filteredRegularMembers.length === 0 ? (
                          <div className="orgNoSearchResultNote">
                            ไม่พบสมาชิกที่ตรงกับคำค้นหา &quot;{searchMemberInGroupQuery}&quot;
                          </div>
                        ) : (
                          <div className="membersGrid">
                            {filteredRegularMembers.map((member, memberIndex) => {
                              return (
                                <div key={member.id} className="memberCard">
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
                                        onClick={() => handleMoveMember('member', memberIndex, 'up')}
                                      >
                                        <ArrowUp size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        className="orderBtn"
                                        title="เลื่อนลง"
                                        disabled={memberIndex === regularMembers.length - 1}
                                        onClick={() => handleMoveMember('member', memberIndex, 'down')}
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
                        )}
                      </section>
                    )}
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
                    <label className="formLabel">บทบาทในกลุ่มงาน *</label>
                    <div className="roleSelectorGrid">
                      <div
                        className={`roleOptionCard ${memberFormData.role === 'member' ? 'active' : ''}`}
                        onClick={() => setMemberFormData({ ...memberFormData, role: 'member' })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setMemberFormData({ ...memberFormData, role: 'member' })
                          }
                        }}
                      >
                        <div className="roleOptionCardHeader">
                          <Users size={16} className={memberFormData.role === 'member' ? 'text-emerald-700' : 'text-slate-400'} />
                          <div className="roleOptionCardTitle">
                            เจ้าหน้าที่ผู้ปฏิบัติงาน
                          </div>
                        </div>
                        <div className="roleOptionCardDesc">
                          แสดงเป็นการ์ดพร้อมเส้นโยงสายการบังคับบัญชาลงมาจากหัวหน้างาน
                        </div>
                      </div>

                      <div
                        className={`roleOptionCard ${memberFormData.role === 'leader' ? 'active' : ''}`}
                        onClick={() => setMemberFormData({ ...memberFormData, role: 'leader' })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setMemberFormData({ ...memberFormData, role: 'leader' })
                          }
                        }}
                      >
                        <div className="roleOptionCardHeader">
                          <Crown size={16} className={memberFormData.role === 'leader' ? 'text-amber-600' : 'text-slate-400'} />
                          <div className="roleOptionCardTitle">
                            หัวหน้ากลุ่มงาน / ผู้บริหาร
                          </div>
                        </div>
                        <div className="roleOptionCardDesc">
                          แสดงเด่นด้านบนสุด เป็นจุดเริ่มต้นของสายการบังคับบัญชา
                        </div>
                      </div>
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
