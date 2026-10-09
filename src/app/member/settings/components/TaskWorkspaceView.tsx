'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  X,
  Sparkles,
  Building2,
  ChevronRight,
  Layers,
  Users,
  Briefcase,
  Plus,
  Check,
  Info,
  User,
} from 'lucide-react'
import { TaskDefinition, TaskRoleConfig } from '@/lib/permissions/taskDefinitions'
import {
  MemberItem,
  PositionMappingItem,
  ICON_MAP,
  ROLE_TYPE_CONFIG,
  getAvatarColor,
} from '../types'

export interface TaskWorkspaceViewProps {
  tasks: TaskDefinition[]
  members: MemberItem[]
  positionMappings: PositionMappingItem[]
  availablePositions: string[]
  uniqueDepartments: string[]
  positionMemberCounts: Record<string, number>
  selectedTaskId: string
  onSelectTaskId: (taskId: string) => void
  onGrantMember: (member: MemberItem, role: TaskRoleConfig) => Promise<void>
  onRevokeMember: (member: MemberItem, role: TaskRoleConfig) => Promise<void>
  onGrantPosition: (positionName: string, role: TaskRoleConfig) => Promise<void>
  onRevokePosition: (positionName: string, role: TaskRoleConfig) => Promise<void>
  isActionPending: boolean
}

export default function TaskWorkspaceView({
  tasks,
  members,
  positionMappings,
  availablePositions,
  uniqueDepartments,
  positionMemberCounts,
  selectedTaskId,
  onSelectTaskId,
  onGrantMember,
  onRevokeMember,
  onGrantPosition,
  onRevokePosition,
  isActionPending,
}: TaskWorkspaceViewProps) {
  const [taskSearchQuery, setTaskSearchQuery] = useState('')

  // Add Assignee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [targetTask, setTargetTask] = useState<TaskDefinition | null>(null)
  const [targetRole, setTargetRole] = useState<TaskRoleConfig | null>(null)
  const [addMode, setAddMode] = useState<'member' | 'position'>('member')
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [positionSearchQuery, setPositionSearchQuery] = useState('')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all')

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
        t.roles.some(
          (r) => r.label.toLowerCase().includes(q) || r.shortLabel.toLowerCase().includes(q)
        )
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

  // Filtered members in Add Modal
  const modalFilteredMembers = useMemo(() => {
    if (!targetRole) return []
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

  return (
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
                      onClick={() => onSelectTaskId(task.id)}
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
                      onClick={() => onSelectTaskId(task.id)}
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
                                  onClick={() => onRevokePosition(pos, role)}
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
                                    onClick={() => onRevokeMember(member, role)}
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
                              onClick={() => onRevokeMember(member, targetRole)}
                              disabled={isActionPending}
                              className="btnRevokeAction"
                            >
                              <Check size={14} />
                              <span>ได้รับสิทธิ์แล้ว (คลิกเพื่อปลด)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onGrantMember(member, targetRole)}
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
                              onClick={() => onRevokePosition(pos, targetRole)}
                              disabled={isActionPending}
                              className="btnRevokeAction"
                            >
                              <Check size={14} />
                              <span>ได้รับสิทธิ์แล้ว (คลิกเพื่อปลด)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onGrantPosition(pos, targetRole)}
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
    </div>
  )
}
