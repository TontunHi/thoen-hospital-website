'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  Shield,
  Loader2,
  X,
  Check,
  Building2
} from 'lucide-react'
import Link from 'next/link'
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

export default function OrganizationAdminClient({ currentAdmin }: { currentAdmin: any }) {
  const [groups, setGroups] = useState<DepartmentGroupNode[]>([])
  const [selectedGroup, setSelectedGroup] = useState<DepartmentGroupNode | null>(null)
  const [members, setMembers] = useState<DepartmentMember[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

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
    } else {
      setMembers([])
    }
  }, [selectedGroup?.id])

  // System member search debounced
  useEffect(() => {
    if (!searchMemberQuery.trim() || searchMemberQuery.trim().length < 2) {
      setSearchMemberResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingMembers(true)
        const res = await fetch(`/api/departments/members/search-system?q=${encodeURIComponent(searchMemberQuery)}`)
        const json = await res.json()
        if (json.success) {
          setSearchMemberResults(json.data || [])
        }
      } catch {
        // Ignore search error
      } finally {
        setSearchingMembers(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchMemberQuery])

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
        addToast('อัปโหลดรูปภาพสำเร็จ', 'success')
      } else {
        addToast(json.error || 'อัปโหลดรูปภาพไม่สำเร็จ', 'error')
      }
    } catch {
      addToast('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ', 'error')
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
      message: `คุณต้องการลบ "${group.name}" ใช่หรือไม่? (ระบบจะไม่อนุญาตให้ลบหากยังมีกลุ่มงานย่อยหรือสมาชิกอยู่)`,
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

  // Recursive tree node renderer
  const renderGroupNode = (node: DepartmentGroupNode, level = 0) => {
    const isSelected = selectedGroup?.id === node.id
    return (
      <div key={node.id} className={`orgTreeItem ${isSelected ? 'active' : ''}`}>
        <div
          className="orgTreeItemRow"
          onClick={() => setSelectedGroup(node)}
          style={{ paddingLeft: `${Math.max(10, level * 16)}px` }}
        >
          <div className="orgTreeItemInfo">
            <Building2 size={16} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="orgTreeItemName" title={node.name}>
              {node.name}
            </span>
          </div>

          <div className="orgTreeActions" onClick={(e) => e.stopPropagation()}>
            <button
              className="iconBtn"
              title="เพิ่มงานย่อยภายใต้กลุ่มนี้"
              onClick={() => {
                setGroupModalMode('create')
                setGroupFormData({ name: '', parentId: node.id })
                setIsGroupModalOpen(true)
              }}
            >
              <Plus size={14} />
            </button>
            <button
              className="iconBtn"
              title="แก้ไขชื่อกลุ่มงาน"
              onClick={() => {
                setGroupModalMode('edit')
                setGroupFormData({ id: node.id, name: node.name, parentId: node.parentId })
                setIsGroupModalOpen(true)
              }}
            >
              <Edit2 size={14} />
            </button>
            <button
              className="iconBtn danger"
              title="ลบกลุ่มงาน"
              onClick={() => handleDeleteGroup(node)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <div className="orgTreeChildren">
            {node.children.map((child) => renderGroupNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // Split members into leader and normal members
  const leaderMembers = members.filter((m) => m.role === 'leader')
  const regularMembers = members.filter((m) => m.role !== 'leader')

  return (
    <div className="orgAdminPage">
      <div className="orgAdminContainer">
        {/* Header */}
        <div className="orgAdminHeader">
          <div className="orgAdminHeaderTitle">
            <h1>
              <Users className="text-emerald-600" size={28} />
              จัดการแผนผังและสมาชิกกลุ่มงาน
            </h1>
            <p>
              จัดการโครงสร้างกลุ่มภารกิจ หน่วยงานย่อย และรายชื่อบุคลากรประจำแต่ละแผนกของโรงพยาบาลเถิน
            </p>
          </div>

          <div className="orgAdminHeaderActions">
            <Link href="/about/organization" target="_blank" className="btn btnSecondary">
              ดูหน้าเว็บสาธารณะ
            </Link>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setGroupModalMode('create')
                setGroupFormData({ name: '', parentId: null })
                setIsGroupModalOpen(true)
              }}
            >
              <FolderPlus size={16} />
              เพิ่มกลุ่มงานหลัก
            </button>
          </div>
        </div>

        {/* Workbench Split View */}
        <div className="orgWorkbench">
          {/* Left Pane: Groups Explorer */}
          <div className="orgGroupsPane">
            <div className="orgPaneHeader">
              <h3>
                <Building2 size={18} className="text-emerald-600" />
                โครงสร้างกลุ่มงาน
              </h3>
              <button
                className="btn btnSecondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  setGroupModalMode('create')
                  setGroupFormData({ name: '', parentId: null })
                  setIsGroupModalOpen(true)
                }}
              >
                <Plus size={14} /> กลุ่มหลัก
              </button>
            </div>

            <div className="orgTreeList">
              {loadingGroups ? (
                <div className="emptyState" style={{ padding: '40px 10px' }}>
                  <Loader2 className="animate-spin text-emerald-600" size={24} />
                  <span>กำลังโหลดกลุ่มงาน...</span>
                </div>
              ) : groups.length === 0 ? (
                <div className="emptyState" style={{ padding: '40px 10px' }}>
                  <Building2 size={32} className="text-slate-300" />
                  <span className="emptyStateTitle">ยังไม่มีกลุ่มงาน</span>
                  <p style={{ fontSize: '0.8rem' }}>คลิกปุ่ม &quot;เพิ่มกลุ่มงานหลัก&quot; ด้านบนเพื่อเริ่มต้น</p>
                </div>
              ) : (
                groups.map((group) => renderGroupNode(group, 0))
              )}
            </div>
          </div>

          {/* Right Pane: Members in Selected Group */}
          <div className="orgMembersPane">
            {selectedGroup ? (
              <>
                <div className="orgMembersHeader">
                  <div className="orgMembersTitle">
                    <h2>{selectedGroup.name}</h2>
                    <span className="orgGroupBreadcrumb">
                      จำนวนสมาชิกทั้งหมด: <strong>{members.length}</strong> คน
                    </span>
                  </div>

                  <button
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
                      setIsMemberModalOpen(true)
                    }}
                  >
                    <UserPlus size={16} />
                    เพิ่มสมาชิก
                  </button>
                </div>

                {loadingMembers ? (
                  <div className="emptyState">
                    <Loader2 className="animate-spin text-emerald-600" size={28} />
                    <span>กำลังโหลดรายชื่อสมาชิก...</span>
                  </div>
                ) : members.length === 0 ? (
                  <div className="emptyState">
                    <Users size={48} className="text-slate-300" />
                    <span className="emptyStateTitle">ยังไม่มีสมาชิกในกลุ่มงานนี้</span>
                    <p style={{ fontSize: '0.875rem' }}>
                      เพิ่มหัวหน้ากลุ่มงานหรือเจ้าหน้าที่เพื่อเริ่มต้นแสดงในแผนผัง
                    </p>
                    <button
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
                        setIsMemberModalOpen(true)
                      }}
                    >
                      <UserPlus size={16} />
                      เพิ่มสมาชิกคนแรก
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Leader Section */}
                    {leaderMembers.length > 0 && (
                      <div className="orgMemberSection">
                        <div className="orgSectionHeading">
                          <Shield size={16} className="text-emerald-600" />
                          หัวหน้ากลุ่มงาน / ผู้บริหาร
                        </div>
                        {leaderMembers.map((leader, leaderIndex) => {
                          return (
                            <div key={leader.id} className="leaderCard">
                              {leader.imagePath ? (
                                <img
                                  src={leader.imagePath}
                                  alt={leader.name}
                                  className="leaderAvatar"
                                />
                              ) : (
                                <div className="avatarFallback">
                                  {leader.name.slice(0, 1)}
                                </div>
                              )}

                              <div className="leaderInfo">
                                <span className="leaderBadge">
                                  <Shield size={12} />
                                  หัวหน้ากลุ่มงาน
                                </span>
                                <span className="leaderName">{leader.name}</span>
                                <span className="leaderPosition">{leader.position}</span>
                                {leader.phone && (
                                  <span className="leaderPhone" title="เบอร์โทรภายใน (ดูได้เฉพาะเจ้าหน้าที่)">
                                    <Phone size={13} />
                                    เบอร์ภายใน: {leader.phone}
                                  </span>
                                )}
                              </div>

                              <div className="cardActionButtons">
                                <div className="orderButtons">
                                  <button
                                    className="orderBtn"
                                    title="เลื่อนขึ้น"
                                    disabled={leaderIndex === 0}
                                    onClick={() => handleMoveMember('leader', leaderIndex, 'up')}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    className="orderBtn"
                                    title="เลื่อนลง"
                                    disabled={leaderIndex === leaderMembers.length - 1}
                                    onClick={() => handleMoveMember('leader', leaderIndex, 'down')}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </div>
                                <button
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
                                    setIsMemberModalOpen(true)
                                  }}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  className="iconBtn danger"
                                  title="ลบสมาชิก"
                                  onClick={() => handleDeleteMember(leader)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Regular Members Grid */}
                    {regularMembers.length > 0 && (
                      <div className="orgMemberSection">
                        <div className="orgSectionHeading">
                          <Users size={16} className="text-slate-500" />
                          เจ้าหน้าที่ / สมาชิกในกลุ่มงาน ({regularMembers.length})
                        </div>
                        <div className="membersGrid">
                          {regularMembers.map((member, memberIndex) => {
                            return (
                              <div key={member.id} className="memberCard">
                                {member.imagePath ? (
                                  <img
                                    src={member.imagePath}
                                    alt={member.name}
                                    className="memberAvatarSmall"
                                  />
                                ) : (
                                  <div className="avatarFallback small">
                                    {member.name.slice(0, 1)}
                                  </div>
                                )}

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
                                      className="orderBtn"
                                      title="เลื่อนขึ้น"
                                      disabled={memberIndex === 0}
                                      onClick={() => handleMoveMember('member', memberIndex, 'up')}
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      className="orderBtn"
                                      title="เลื่อนลง"
                                      disabled={memberIndex === regularMembers.length - 1}
                                      onClick={() => handleMoveMember('member', memberIndex, 'down')}
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                  </div>
                                  <button
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
                                      setIsMemberModalOpen(true)
                                    }}
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button
                                    className="iconBtn danger"
                                    title="ลบสมาชิก"
                                    onClick={() => handleDeleteMember(member)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="emptyState">
                <Building2 size={48} className="text-slate-300" />
                <span className="emptyStateTitle">กรุณาเลือกกลุ่มงาน</span>
                <p>เลือกกลุ่มงานจากรายการฝั่งซ้าย เพื่อดูและจัดการรายชื่อสมาชิก</p>
              </div>
            )}
          </div>
        </div>

        {/* Group Add/Edit Modal */}
        {isGroupModalOpen && (
          <div className="modalOverlay" onClick={() => setIsGroupModalOpen(false)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <h3>{groupModalMode === 'create' ? 'เพิ่มกลุ่มงานใหม่' : 'แก้ไขชื่อกลุ่มงาน'}</h3>
                <button className="iconBtn" onClick={() => setIsGroupModalOpen(false)}>
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
                      placeholder="เช่น กลุ่มงานการพยาบาล, งานอุบัติเหตุฉุกเฉิน"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                      required
                      autoFocus
                    />
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
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <h3>{memberModalMode === 'create' ? 'เพิ่มสมาชิกในกลุ่มงาน' : 'แก้ไขข้อมูลสมาชิก'}</h3>
                <button className="iconBtn" onClick={() => setIsMemberModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveMember}>
                <div className="modalBody">
                  {/* Prefill from System Member Search */}
                  {memberModalMode === 'create' && (
                    <div className="formGroup" style={{ position: 'relative' }}>
                      <label className="formLabel">
                        ค้นหาและดึงข้อมูลจากบัญชีบุคลากรในระบบ (ทางเลือก สะดวกรวดเร็ว)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="formInput"
                          style={{ width: '100%', paddingLeft: '34px' }}
                          placeholder="พิมพ์ชื่อ นามสกุล หรือแผนก เพื่อดึงข้อมูลอัตโนมัติ..."
                          value={searchMemberQuery}
                          onChange={(e) => setSearchMemberQuery(e.target.value)}
                        />
                        <Search
                          size={16}
                          className="text-slate-400"
                          style={{ position: 'absolute', left: '10px', top: '12px' }}
                        />
                        {searchingMembers && (
                          <Loader2
                            size={16}
                            className="animate-spin text-emerald-600"
                            style={{ position: 'absolute', right: '10px', top: '12px' }}
                          />
                        )}
                      </div>

                      {searchMemberResults.length > 0 && (
                        <div className="autocompleteList">
                          {searchMemberResults.map((s) => (
                            <div
                              key={s.id}
                              className="autocompleteItem"
                              onClick={() => {
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
                              <span className="autocompleteItemName">{s.name}</span>
                              <span className="autocompleteItemSub">
                                {s.position} • {s.department}
                              </span>
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
                      {memberFormData.imagePath ? (
                        <img
                          src={memberFormData.imagePath}
                          alt="Preview"
                          className="photoPreview"
                        />
                      ) : (
                        <div className="avatarFallback">
                          {memberFormData.name ? memberFormData.name.slice(0, 1) : '?'}
                        </div>
                      )}

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="btn btnSecondary" style={{ cursor: 'pointer', width: 'fit-content' }}>
                          <Upload size={14} />
                          {isUploadingPhoto ? 'กำลังอัปโหลด...' : 'เลือกรูปถ่าย (JPG, PNG, WebP)'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePhotoUpload}
                            disabled={isUploadingPhoto}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {memberFormData.imagePath && (
                          <button
                            type="button"
                            className="iconBtn danger"
                            style={{ width: 'fit-content', fontSize: '0.75rem', padding: '2px 6px' }}
                            onClick={() => setMemberFormData({ ...memberFormData, imagePath: '' })}
                          >
                            <Trash2 size={12} /> ลบรูปภาพ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="formGroup">
                    <label className="formLabel">คำนำหน้า-ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น พญ.นฤณาท จอมภาปิน, นายแพทย์สาธิต ปทุมมัง"
                      value={memberFormData.name}
                      onChange={(e) => setMemberFormData({ ...memberFormData, name: e.target.value })}
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
                      onChange={(e) => setMemberFormData({ ...memberFormData, position: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label className="formLabel">บทบาทในกลุ่มงาน</label>
                    <select
                      className="formSelect"
                      value={memberFormData.role}
                      onChange={(e) =>
                        setMemberFormData({
                          ...memberFormData,
                          role: e.target.value as 'leader' | 'member'
                        })
                      }
                    >
                      <option value="member">เจ้าหน้าที่ / สมาชิกทั่วไป</option>
                      <option value="leader">หัวหน้ากลุ่มงาน / ผู้บริหาร (แสดงเด่นด้านบน)</option>
                    </select>
                  </div>

                  <div className="formGroup">
                    <label className="formLabel">เบอร์โทรศัพท์ภายใน (สำหรับดูเฉพาะภายใน รพ.)</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น 101, 102 หรือ เบอร์ต่อห้องตรวจ"
                      value={memberFormData.phone}
                      onChange={(e) => setMemberFormData({ ...memberFormData, phone: e.target.value })}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      * เบอร์โทรนี้จะแสดงเฉพาะในระบบหลังบ้านเพื่อการติดต่อภายใน จะไม่ถูกนำไปแสดงบนหน้าเว็บสาธารณะ
                    </small>
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
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </div>
          </div>
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
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </div>
    </div>
  )
}
