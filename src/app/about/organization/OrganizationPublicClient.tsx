'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import {
  Users,
  User,
  Search,
  Loader2,
  X,
  Network,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Building2,
  GripVertical,
  RotateCcw,
  Hand,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import { getInitials } from '@/lib/formatters'
import {
  OrgMember as PublicMember,
  OrgGroupNode as PublicGroupNode,
  countTotalMembersInGroup,
  countTotalSubUnits,
  swapMembersInTree,
  swapGroupsInTree,
} from '@/lib/departments/orgTreeUtils'
import {
  OrgDragContext,
  partitionGroupMembers,
  type DragItem,
  type OrgDragContextValue,
} from './orgDragContext'
import PersonnelDrawer from './PersonnelDrawer'
import OrgTreeView from './OrgTreeView'
import OrgDirectoryView from './OrgDirectoryView'

export { swapMembersInTree, swapGroupsInTree }
export type { PublicMember, PublicGroupNode }

export default function OrganizationPublicClient() {
  const [orgChart, setOrgChart] = useState<PublicGroupNode[]>([])
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Auth state: only logged in members/admins can drag to reorder
  const [canReorder, setCanReorder] = useState(false)

  // View mode: 'tree' (Org Chart Diagram) vs 'cards' (Directory Cards View)
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree')
  const [zoom, setZoom] = useState<number>(1)
  const [membersPerRow, setMembersPerRow] = useState<number>(4)

  // Unified Search state (filters departments live + queries personnel when >= 2 chars)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicMember[]>([])
  const [searching, setSearching] = useState(false)

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const hasDraggedRef = useRef(false)

  // Member Detail Drawer state
  const [selectedMember, setSelectedMember] = useState<{
    member: PublicMember
    groupName: string
  } | null>(null)

  // Free View (Pan & Zoom) canvas state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{
    startX: number
    startY: number
    initialPanX: number
    initialPanY: number
  } | null>(null)
  const diagramScrollRef = useRef<HTMLDivElement>(null)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type, duration: 3000 }])
  }

  const selectDepartment = (id: number) => {
    setSelectedRootId(id)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (
      target.closest('.treeNodeCard') ||
      target.closest('.treeMemberCard') ||
      target.closest('.publicMemberCard') ||
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
      initialPanY: pan.y,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return
    const dx = e.clientX - panStartRef.current.startX
    const dy = e.clientY - panStartRef.current.startY
    setPan({
      x: panStartRef.current.initialPanX + dx,
      y: panStartRef.current.initialPanY + dy,
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return
    setIsPanning(false)
    panStartRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      setZoom((z) => Math.min(1.4, Math.max(0.5, Number((z + delta).toFixed(2)))))
    } else {
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }))
    }
  }

  useEffect(() => {
    let isMounted = true
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/member/me')
        const json = await res.json()
        if (isMounted && json && json.authenticated) {
          setCanReorder(true)
        }
      } catch {
        // Anonymous visitor -> canReorder stays false
      }
    }
    checkAuth()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const fetchOrgChart = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/departments/public')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setOrgChart(json.data)
          if (json.data.length > 0) {
            setSelectedRootId(json.data[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load public org chart:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrgChart()
  }, [])

  const groupNameMap = useMemo(() => {
    const map = new Map<number, string>()
    function walk(nodes: PublicGroupNode[]) {
      for (const n of nodes) {
        map.set(n.id, n.name)
        if (n.children && n.children.length > 0) {
          walk(n.children)
        }
      }
    }
    walk(orgChart)
    return map
  }, [orgChart])

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const res = await fetch(
          `/api/departments/public/search?q=${encodeURIComponent(trimmed)}`
        )
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSwapMembers = async (
    memberIdA: number,
    memberIdB: number,
    groupId: number
  ) => {
    const { updatedNodes, swappedGroup } = swapMembersInTree(
      orgChart,
      groupId,
      memberIdA,
      memberIdB
    )
    if (!swappedGroup) return

    setOrgChart(updatedNodes)

    try {
      const res = await fetch('/api/departments/members/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          memberIds: swappedGroup.members.map((m) => m.id),
        }),
      })
      const json = await res.json().catch(() => null)
      if (json && json.success) {
        addToast(json.message || 'บันทึกลำดับสมาชิกสำเร็จ', 'success')
      }
    } catch {
      // Optimistic local state remains updated
    }
  }

  const handleSwapGroups = async (
    groupIdA: number,
    groupIdB: number,
    parentId: number | null
  ) => {
    const { updatedNodes, swappedGroupIds } = swapGroupsInTree(
      orgChart,
      parentId,
      groupIdA,
      groupIdB
    )
    if (!swappedGroupIds) return

    setOrgChart(updatedNodes)

    try {
      const res = await fetch('/api/departments/groups/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupIds: swappedGroupIds,
        }),
      })
      const json = await res.json().catch(() => null)
      if (json && json.success) {
        addToast(json.message || 'บันทึกลำดับกลุ่มงานสำเร็จ', 'success')
      }
    } catch {
      // Optimistic local state remains updated
    }
  }

  const handleDragStart = (item: DragItem, e: React.DragEvent) => {
    if (!canReorder) {
      e.preventDefault()
      return
    }
    hasDraggedRef.current = true
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${item.type}:${item.id}`)
  }

  const handleDragOver = (key: string, item: DragItem, e: React.DragEvent) => {
    if (!canReorder || !draggedItem) return
    if (draggedItem.type !== item.type) return
    if (draggedItem.id === item.id) return

    if (draggedItem.type === 'member' && item.type === 'member') {
      if (draggedItem.groupId !== item.groupId) return
    }

    if (draggedItem.type === 'group' && item.type === 'group') {
      if (draggedItem.parentId !== item.parentId) return
    }

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverKey !== key) {
      setDragOverKey(key)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    const currentTarget = e.currentTarget
    const relatedTarget = e.relatedTarget as Node | null
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverKey(null)
    }
  }

  const handleDrop = (targetItem: DragItem, e: React.DragEvent) => {
    e.preventDefault()
    if (!canReorder || !draggedItem) return

    if (draggedItem.type === 'member' && targetItem.type === 'member') {
      if (draggedItem.id !== targetItem.id && draggedItem.groupId === targetItem.groupId) {
        handleSwapMembers(draggedItem.id, targetItem.id, draggedItem.groupId)
      }
    } else if (draggedItem.type === 'group' && targetItem.type === 'group') {
      if (draggedItem.id !== targetItem.id && draggedItem.parentId === targetItem.parentId) {
        handleSwapGroups(draggedItem.id, targetItem.id, draggedItem.parentId)
      }
    }

    setDraggedItem(null)
    setDragOverKey(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverKey(null)
    setTimeout(() => {
      hasDraggedRef.current = false
    }, 120)
  }

  const handleCardClick = (member: PublicMember, groupName?: string) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false
      return
    }
    const resolvedGroup =
      groupName || member.groupName || groupNameMap.get(member.groupId) || ''
    setSelectedMember({ member, groupName: resolvedGroup })
  }

  const dragContextValue: OrgDragContextValue = {
    canReorder,
    draggedItem,
    dragOverKey,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleCardClick,
  }

  const selectedRoot = orgChart.find((g) => g.id === selectedRootId) || orgChart[0]

  const {
    leader: rootLeader,
    deputyLeaders: otherRootLeaders,
    staff: rootStaff,
  } = useMemo(() => {
    if (!selectedRoot) {
      return { leader: null, deputyLeaders: [], staff: [] }
    }
    return partitionGroupMembers(selectedRoot.members)
  }, [selectedRoot])

  const rootChildren = selectedRoot ? selectedRoot.children || [] : []
  const hasRootBranches =
    rootChildren.length > 0 || otherRootLeaders.length > 0 || rootStaff.length > 0

  const selectedDeptTotalMembers = useMemo(() => {
    if (!selectedRoot) return 0
    return countTotalMembersInGroup(selectedRoot)
  }, [selectedRoot])

  const selectedDeptTotalSubUnits = useMemo(() => {
    if (!selectedRoot) return 0
    return countTotalSubUnits(selectedRoot)
  }, [selectedRoot])

  const totalHospitalPersonnel = useMemo(() => {
    return orgChart.reduce((sum, root) => sum + countTotalMembersInGroup(root), 0)
  }, [orgChart])

  const filteredOrgChart = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return orgChart
    return orgChart.filter((g) => g.name.toLowerCase().includes(q))
  }, [orgChart, searchQuery])

  const isSearchingPersonnel = searchQuery.trim().length >= 2

  return (
    <OrgDragContext.Provider value={dragContextValue}>
      <div className="orgPage">
        {/* 1. Calm Clinical Header */}
        <header className="orgHeader">
          <div className="orgContainer orgHeaderInner">
            <Breadcrumb
              variant="default"
              items={[
                { label: 'เกี่ยวกับเรา', href: '/about' },
                { label: 'โครงสร้างกลุ่มงานและบุคลากร' },
              ]}
            />

            <div className="orgHeaderTop">
              <div className="orgHeaderTitleGroup">
                <h1 className="orgTitle">โครงสร้างกลุ่มงานและบุคลากร</h1>
                <p className="orgSubtitle">
                  คณะผู้บริหาร หัวหน้ากลุ่มงาน และบุคลากรผู้ปฏิบัติงาน โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง
                </p>
              </div>

              {!loading && orgChart.length > 0 && (
                <div className="orgHeaderStats" aria-label="สรุปจำนวนกลุ่มงานและบุคลากร">
                  <div className="orgStatItem">
                    <span className="orgStatValue orgTabular">{orgChart.length}</span>
                    <span className="orgStatLabel">กลุ่มงาน</span>
                  </div>
                  <div className="orgStatDivider" aria-hidden="true" />
                  <div className="orgStatItem">
                    <span className="orgStatValue orgTabular">{totalHospitalPersonnel}</span>
                    <span className="orgStatLabel">บุคลากร</span>
                  </div>
                </div>
              )}
            </div>

            {/* Unified Search Bar */}
            <div className="orgSearchBar">
              <Search size={18} strokeWidth={1.5} className="orgSearchIcon" aria-hidden="true" />
              <input
                type="search"
                className="orgSearchInput"
                placeholder="ค้นหาชื่อบุคลากร ตำแหน่ง หรือกลุ่มงาน"
                aria-label="ค้นหาชื่อบุคลากร ตำแหน่ง หรือกลุ่มงาน"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searching && (
                <Loader2 size={18} strokeWidth={1.5} className="orgSpin orgIconAccent" aria-hidden="true" />
              )}
              {searchQuery && (
                <button
                  type="button"
                  className="orgClearBtn"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>ล้าง</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 2. Main Split Workspace */}
        <div className="orgContainer orgWorkspaceWrap">
          {loading ? (
            <div className="orgStatusCard">
              <Loader2 size={32} strokeWidth={1.5} className="orgSpin orgIconAccent" aria-hidden="true" />
              <span>กำลังโหลดโครงสร้างกลุ่มงาน...</span>
            </div>
          ) : orgChart.length === 0 ? (
            <div className="orgStatusCard">
              <User size={40} strokeWidth={1.5} className="orgIconMuted" aria-hidden="true" />
              <h2>ยังไม่มีข้อมูลโครงสร้างกลุ่มงาน</h2>
              <p>ระบบยังไม่ได้เพิ่มข้อมูลกลุ่มงานและบุคลากรในขณะนี้</p>
            </div>
          ) : (
            <div className="orgWorkspace">
              {/* Left Sidebar (Desktop) */}
              <aside className="orgSidebar" aria-label="รายชื่อกลุ่มงาน">
                <div className="orgSidebarHeader">
                  <span className="orgSidebarTitle">กลุ่มงาน</span>
                  <span className="orgSidebarTotal orgTabular">{filteredOrgChart.length}</span>
                </div>

                {filteredOrgChart.length === 0 ? (
                  <div className="orgSidebarEmpty">
                    <span>ไม่พบกลุ่มงานที่ตรงกับ &ldquo;{searchQuery}&rdquo;</span>
                    <button
                      type="button"
                      className="orgSidebarResetLink"
                      onClick={() => setSearchQuery('')}
                    >
                      แสดงทั้งหมด
                    </button>
                  </div>
                ) : (
                  <nav className="orgSidebarList" aria-label="รายการกลุ่มงาน">
                    {filteredOrgChart.map((root) => {
                      const isActive = !isSearchingPersonnel && selectedRoot?.id === root.id
                      const itemKey = `root-group-${root.id}`
                      const isDragging =
                        canReorder &&
                        draggedItem?.type === 'group' &&
                        draggedItem.id === root.id
                      const isDropTarget = canReorder && dragOverKey === itemKey
                      const count = countTotalMembersInGroup(root)

                      const itemClassName = [
                        'orgSidebarItem',
                        isActive && 'active',
                        isDragging && 'isDragging',
                        isDropTarget && 'isDropTarget',
                      ]
                        .filter(Boolean)
                        .join(' ')

                      return (
                        <button
                          key={root.id}
                          type="button"
                          className={itemClassName}
                          draggable={canReorder}
                          onDragStart={
                            canReorder
                              ? (e) =>
                                  handleDragStart(
                                    { type: 'group', id: root.id, parentId: null },
                                    e
                                  )
                              : undefined
                          }
                          onDragOver={
                            canReorder
                              ? (e) =>
                                  handleDragOver(
                                    itemKey,
                                    { type: 'group', id: root.id, parentId: null },
                                    e
                                  )
                              : undefined
                          }
                          onDragLeave={canReorder ? handleDragLeave : undefined}
                          onDrop={
                            canReorder
                              ? (e) =>
                                  handleDrop(
                                    { type: 'group', id: root.id, parentId: null },
                                    e
                                  )
                              : undefined
                          }
                          onDragEnd={canReorder ? handleDragEnd : undefined}
                          onClick={() => {
                            selectDepartment(root.id)
                            if (isSearchingPersonnel) {
                              setSearchQuery('')
                              setSearchResults([])
                            }
                          }}
                          aria-current={isActive ? 'true' : undefined}
                          title={
                            canReorder
                              ? 'คลิกเพื่อเลือก หรือลากเพื่อสลับลำดับกลุ่มงาน'
                              : root.name
                          }
                        >
                          <span className="orgSidebarItemIcon" aria-hidden="true">
                            <Building2 size={16} strokeWidth={1.5} />
                          </span>
                          <span className="orgSidebarItemLabel">{root.name}</span>
                          <span className="orgSidebarItemCount orgTabular">{count}</span>
                        </button>
                      )
                    })}
                  </nav>
                )}
              </aside>

              {/* Main Right Pane */}
              <div className="orgMainPane">
                {/* Mobile / Tablet Compact Department Picker */}
                {!isSearchingPersonnel && (
                  <div className="orgMobileDeptBar">
                    <label htmlFor="dept-select" className="orgMobileDeptLabel">
                      <Building2 size={16} strokeWidth={1.5} className="orgIconAccent" aria-hidden="true" />
                      <span>กลุ่มงาน</span>
                    </label>
                    <div className="orgSelectWrap">
                      <select
                        id="dept-select"
                        className="orgSelectInput"
                        value={selectedRoot?.id ?? ''}
                        onChange={(e) => selectDepartment(Number(e.target.value))}
                        aria-label="เลือกกลุ่มงาน"
                      >
                        {orgChart.map((root) => {
                          const count = countTotalMembersInGroup(root)
                          return (
                            <option key={root.id} value={root.id}>
                              {root.name} ({count} ท่าน)
                            </option>
                          )
                        })}
                      </select>
                      <ChevronDown size={16} strokeWidth={1.5} className="orgSelectArrow" aria-hidden="true" />
                    </div>
                  </div>
                )}

                {isSearchingPersonnel ? (
                  /* Search Results View (Matching Departments + Personnel) */
                  <div className="orgPanel">
                    {filteredOrgChart.length > 0 && (
                      <div className="orgMatchedDeptsSection">
                        <div className="orgSectionEyebrow">
                          กลุ่มงานที่ตรงกัน (<span className="orgTabular">{filteredOrgChart.length}</span>)
                        </div>
                        <div className="orgMatchedDeptsGrid">
                          {filteredOrgChart.map((dept) => (
                            <button
                              key={dept.id}
                              type="button"
                              className="orgMatchedDeptCard"
                              onClick={() => {
                                selectDepartment(dept.id)
                                setSearchQuery('')
                                setSearchResults([])
                              }}
                            >
                              <Building2 size={16} strokeWidth={1.5} className="orgIconAccent" aria-hidden="true" />
                              <span className="orgMatchedDeptName">{dept.name}</span>
                              <span className="orgMatchedDeptCount orgTabular">
                                {countTotalMembersInGroup(dept)} ท่าน
                              </span>
                              <ChevronRight size={15} strokeWidth={1.5} className="orgIconMuted" aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="searchResultsHeader">
                      <span>
                        ผลการค้นหาบุคลากรสำหรับ &ldquo;<strong>{searchQuery}</strong>&rdquo; (
                        <span className="orgTabular">{searchResults.length}</span> ท่าน)
                      </span>
                    </div>

                    {searching ? (
                      <div className="publicEmptyState">
                        <Loader2 size={28} strokeWidth={1.5} className="orgSpin orgIconAccent" aria-hidden="true" />
                        <span>กำลังค้นหาข้อมูล...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="publicEmptyState">
                        <Users size={36} strokeWidth={1.5} className="orgIconMuted" aria-hidden="true" />
                        <p>ไม่พบบุคลากรที่ตรงกับคำค้นหา &ldquo;{searchQuery}&rdquo;</p>
                      </div>
                    ) : (
                      <div className="publicMembersGrid">
                        {searchResults.map((member) => (
                          <div
                            key={member.id}
                            className="publicMemberCard clickable"
                            onClick={() => handleCardClick(member, member.groupName)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleCardClick(member, member.groupName)
                              }
                            }}
                            title="คลิกเพื่อดูข้อมูลบุคลากร"
                          >
                            <div className="publicMemberAvatarWrap">
                              {member.imagePath ? (
                                <img
                                  src={member.imagePath}
                                  alt={member.name}
                                  className="publicMemberAvatar"
                                />
                              ) : (
                                <div className="publicMemberAvatarFallback">
                                  {getInitials(member.name)}
                                </div>
                              )}
                            </div>
                            <div className="publicMemberInfo">
                              <span className="publicMemberName" title={member.name}>
                                {member.name}
                              </span>
                              <span className="publicMemberPosition">{member.position}</span>
                              {member.groupName && (
                                <span className="publicMemberDeptBadge">
                                  {member.groupName}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Active Department Panel */
                  selectedRoot && (
                    <div className="orgPanel">
                      <div className="orgDeptHeader">
                        <div className="orgDeptTitleRow">
                          <div>
                            <h2 className="orgDeptTitle">{selectedRoot.name}</h2>
                            <p className="orgDeptSubtitle">
                              บุคลากรทั้งหมด <strong className="orgTabular">{selectedDeptTotalMembers}</strong> ท่าน
                              {selectedDeptTotalSubUnits > 0 && (
                                <>
                                  {' · '}
                                  <strong className="orgTabular">{selectedDeptTotalSubUnits}</strong> หน่วยงานย่อย
                                </>
                              )}
                            </p>
                          </div>

                          <div className="viewModePills" role="tablist" aria-label="รูปแบบการแสดงผล">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={viewMode === 'tree'}
                              className={`viewModeBtn ${viewMode === 'tree' ? 'active' : ''}`}
                              onClick={() => setViewMode('tree')}
                            >
                              <Network size={16} strokeWidth={1.5} aria-hidden="true" />
                              <span>ผังโครงสร้างองค์กร</span>
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={viewMode === 'cards'}
                              className={`viewModeBtn ${viewMode === 'cards' ? 'active' : ''}`}
                              onClick={() => setViewMode('cards')}
                            >
                              <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" />
                              <span>รายชื่อแบบการ์ด</span>
                            </button>
                          </div>
                        </div>

                        {(viewMode === 'tree' || canReorder) && (
                          <div className="orgToolbar">
                            {viewMode === 'tree' ? (
                              <>
                                <div className="orgToolbarGroup">
                                  <div
                                    className="densityControls"
                                    title="ปรับจำนวนบุคลากรต่อแถวในแผนก"
                                  >
                                    <span className="densityLabel">แถวละ</span>
                                    <div className="densityButtons">
                                      {[3, 4, 5, 6].map((count) => (
                                        <button
                                          key={count}
                                          type="button"
                                          className={`densityBtn orgTabular ${membersPerRow === count ? 'active' : ''}`}
                                          onClick={() => setMembersPerRow(count)}
                                          aria-label={`แสดงแถวละ ${count} คน`}
                                        >
                                          {count}
                                        </button>
                                      ))}
                                    </div>
                                    <span className="densityUnit">คน</span>
                                  </div>

                                  {canReorder && (
                                    <span
                                      className="diagramScrollHint"
                                      title="ลากการ์ดหรือรายการกลุ่มงานเพื่อสลับตำแหน่ง"
                                    >
                                      <GripVertical size={14} strokeWidth={1.5} aria-hidden="true" />
                                      <span>ลากเพื่อสลับตำแหน่ง</span>
                                    </span>
                                  )}
                                </div>

                                <div className="orgToolbarGroup">
                                  <span
                                    className="diagramScrollHint isCanvasHint"
                                    title="คลิกค้างแล้วลากบนพื้นหลังเพื่อเลื่อนดูแผนผัง"
                                  >
                                    <Hand size={14} strokeWidth={1.5} aria-hidden="true" />
                                    <span>ลากพื้นหลังเพื่อเลื่อนดู</span>
                                  </span>

                                  <div className="zoomControls">
                                    <button
                                      type="button"
                                      className="zoomBtn"
                                      title="ย่อขนาด"
                                      onClick={() =>
                                        setZoom((z) =>
                                          Math.max(0.5, Number((z - 0.1).toFixed(1)))
                                        )
                                      }
                                      aria-label="ย่อขนาด"
                                    >
                                      <ZoomOut size={15} strokeWidth={1.5} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="zoomLevelText orgTabular"
                                      title="รีเซ็ตขนาด 100%"
                                      onClick={() => setZoom(1)}
                                    >
                                      {`${Math.round(zoom * 100)}%`}
                                    </button>
                                    <button
                                      type="button"
                                      className="zoomBtn"
                                      title="ขยายขนาด"
                                      onClick={() =>
                                        setZoom((z) =>
                                          Math.min(1.4, Number((z + 0.1).toFixed(1)))
                                        )
                                      }
                                      aria-label="ขยายขนาด"
                                    >
                                      <ZoomIn size={15} strokeWidth={1.5} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="zoomBtn"
                                      title="จัดกึ่งกลางและรีเซ็ตมุมมอง (Reset View)"
                                      onClick={handleResetView}
                                      aria-label="จัดกึ่งกลางและรีเซ็ตมุมมอง"
                                    >
                                      <RotateCcw size={15} strokeWidth={1.5} aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              canReorder && (
                                <span
                                  className="diagramScrollHint"
                                  title="ลากการ์ดเพื่อสลับตำแหน่ง"
                                >
                                  <GripVertical size={14} strokeWidth={1.5} aria-hidden="true" />
                                  <span>ลากเพื่อสลับตำแหน่ง</span>
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      {viewMode === 'tree' ? (
                        <OrgTreeView
                          selectedRoot={selectedRoot}
                          rootLeader={rootLeader}
                          otherRootLeaders={otherRootLeaders}
                          rootStaff={rootStaff}
                          rootChildren={rootChildren}
                          hasRootBranches={hasRootBranches}
                          membersPerRow={membersPerRow}
                          zoom={zoom}
                          pan={pan}
                          isPanning={isPanning}
                          diagramScrollRef={diagramScrollRef}
                          onResetView={handleResetView}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onWheel={handleWheel}
                          onCardClick={handleCardClick}
                        />
                      ) : (
                        <OrgDirectoryView
                          selectedRoot={selectedRoot}
                          rootLeader={rootLeader}
                          otherRootLeaders={otherRootLeaders}
                          rootStaff={rootStaff}
                          onCardClick={handleCardClick}
                        />
                      )}

                      {!rootLeader &&
                        (!selectedRoot.children || selectedRoot.children.length === 0) &&
                        rootStaff.length === 0 && (
                          <div className="publicEmptyState">
                            <Users size={36} strokeWidth={1.5} className="orgIconMuted" aria-hidden="true" />
                            <p>ยังไม่มีข้อมูลในกลุ่มงานนี้</p>
                          </div>
                        )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Personnel Slide-over Detail Drawer */}
        {selectedMember && (
          <PersonnelDrawer
            member={selectedMember.member}
            groupName={selectedMember.groupName}
            onClose={() => setSelectedMember(null)}
          />
        )}

        {/* Toasts */}
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </div>
    </OrgDragContext.Provider>
  )
}
