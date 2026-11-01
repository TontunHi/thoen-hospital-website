'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  X,
  Briefcase,
  Plus,
  Check,
  User,
} from 'lucide-react'
import { TaskDefinition, TaskRoleConfig } from '@/lib/permissions/taskDefinitions'
import {
  MemberItem,
  PositionMappingItem,
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

  // Calculate distinct members and positions for a task
  const getTaskCounts = (task: TaskDefinition) => {
    const memberIds = new Set<number>()
    const posNames = new Set<string>()
    task.roles.forEach((r) => {
      getAssignedMembersForPerm(r.permissionKey).forEach((m) => memberIds.add(m.id))
      getAssignedPositionsForPerm(r.permissionKey).forEach((p) => posNames.add(p))
    })
    return {
      memberCount: memberIds.size,
      positionCount: posNames.size,
    }
  }

  const currentTaskCounts = useMemo(() => {
    if (!currentTask) return { memberCount: 0, positionCount: 0 }
    return getTaskCounts(currentTask)
  }, [currentTask, members, positionMappings])

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
      {/* =====================================================================
          Left Column: Task Navigator (300px)
          ===================================================================== */}
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
              aria-label="ค้นหาภารกิจงาน"
            />
            {taskSearchQuery && (
              <button
                type="button"
                onClick={() => setTaskSearchQuery('')}
                className="clearSearchBtn"
                aria-label="ล้างการค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="taskNavScrollable" role="tablist" aria-label="รายการภารกิจงาน">
          {/* Category 1: Workflow Tasks */}
          {workflowTasks.length > 0 && (
            <div className="taskNavGroup">
              <div className="taskNavGroupHeader groupHeaderWorkflow">
                <span>งานบริการ &amp; กล่องงาน</span>
                <span className="groupCount">{workflowTasks.length}</span>
              </div>
              <div className="taskNavList">
                {workflowTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id
                  const { memberCount, positionCount } = getTaskCounts(task)

                  return (
                    <button
                      key={task.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-pressed={isSelected}
                      onClick={() => onSelectTaskId(task.id)}
                      className={`taskNavItem ${isSelected ? 'active' : ''}`}
                    >
                      <span className="taskNavName">{task.name}</span>
                      <span className="taskNavRolesCount">
                        {task.roles.length} บทบาท · {memberCount} คน
                        {positionCount > 0 ? ` · ${positionCount} ตำแหน่ง` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Category 2: System & Governance Modules */}
          {systemTasks.length > 0 && (
            <div className="taskNavGroup">
              <div className="taskNavGroupHeader groupHeaderSystem">
                <span>ระบบบริหาร &amp; กำกับดูแล</span>
                <span className="groupCount">{systemTasks.length}</span>
              </div>
              <div className="taskNavList">
                {systemTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id
                  const { memberCount, positionCount } = getTaskCounts(task)

                  return (
                    <button
                      key={task.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-pressed={isSelected}
                      onClick={() => onSelectTaskId(task.id)}
                      className={`taskNavItem ${isSelected ? 'active' : ''}`}
                    >
                      <span className="taskNavName">{task.name}</span>
                      <span className="taskNavRolesCount">
                        {task.roles.length} บทบาท · {memberCount} คน
                        {positionCount > 0 ? ` · ${positionCount} ตำแหน่ง` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {filteredTasks.length === 0 && (
            <div className="taskEmptySearch">
              <p>ไม่พบภารกิจงานที่ตรงกับการค้นหา</p>
            </div>
          )}
        </div>
      </aside>

      {/* =====================================================================
          Right Column: Task Workspace & Roles Details
          ===================================================================== */}
      <main className="taskWorkspacePane">
        {currentTask && (
          <>
            {/* 2.3 Task Header Card */}
            <div className="taskHeaderCard">
              <div className="taskHeaderTopLine">
                <span>{currentTask.categoryLabel}</span>
                <span>·</span>
                <code className="taskHeaderMonoCode">{currentTask.id}</code>
              </div>

              <h2 className="taskHeaderTitle">{currentTask.name}</h2>
              <p className="taskHeaderDesc">{currentTask.description}</p>

              {/* 3 Summary Boxes */}
              <div className="taskSummaryBoxes">
                <div className="summaryBox summaryBoxMembers">
                  <span className="summaryNum">{currentTaskCounts.memberCount}</span>
                  <span className="summaryLabel">คนที่ได้รับสิทธิ์</span>
                </div>
                <div className="summaryBox summaryBoxPositions">
                  <span className="summaryNum">{currentTaskCounts.positionCount}</span>
                  <span className="summaryLabel">ตำแหน่งที่ผูกสิทธิ์</span>
                </div>
                <div className="summaryBox summaryBoxRoles">
                  <span className="summaryNum">{currentTask.roles.length}</span>
                  <span className="summaryLabel">บทบาท</span>
                </div>
              </div>
            </div>

            {/* Legend Bar (แถบคำอธิบายระดับสิทธิ์เหนือรายการบทบาท) */}
            <div className="permLegendBar" aria-label="คำอธิบายระดับสิทธิ์">
              <span className="legendTitle">ระดับสิทธิ์:</span>
              {(['view', 'edit', 'approve', 'manage'] as const).map((lvl) => {
                const cfg = ROLE_TYPE_CONFIG[lvl]
                return (
                  <span
                    key={lvl}
                    className="legendItem"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    <span className="legendDot" style={{ backgroundColor: cfg.dotColor }} />
                    {cfg.badgeLabel}
                  </span>
                )
              })}
            </div>

            {/* 2.4 Unified Roles Card: All roles in single container */}
            <div className="rolesUnifiedCard">
              {currentTask.roles.map((role) => {
                const roleCfg = ROLE_TYPE_CONFIG[role.roleType]
                const assignedMembers = getAssignedMembersForPerm(role.permissionKey)
                const assignedPositions = getAssignedPositionsForPerm(role.permissionKey)

                return (
                  <div key={role.permissionKey} className="roleRow">
                    {/* Left Column (240px) */}
                    <div
                      className="roleColLeft"
                      style={{ backgroundColor: roleCfg.bg }}
                    >
                      <span
                        className="roleLevelBadge"
                        style={{ color: roleCfg.color }}
                      >
                        {roleCfg.badgeLabel}
                      </span>
                      <h3 className="roleName">{role.label}</h3>
                      <code className="roleMonoCode">{role.permissionKey}</code>
                    </div>

                    {/* Right Column */}
                    <div className="roleColRight">
                      <p className="roleDesc">{role.description}</p>

                      {/* ทำอะไรได้ (2-col grid) */}
                      {role.allowedActions && role.allowedActions.length > 0 && (
                        <div className="roleCapsSection">
                          <h4 className="roleCapsTitle">ทำอะไรได้</h4>
                          <div className="roleCapsGrid">
                            {role.allowedActions.map((action, i) => (
                              <div key={i} className="capItem">
                                <span
                                  className="capDot"
                                  style={{ backgroundColor: roleCfg.dotColor }}
                                />
                                <span>{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ได้สิทธิ์ตามตำแหน่ง */}
                      {assignedPositions.length > 0 && (
                        <div className="assignedSection">
                          <h4 className="assignedTitle">
                            ได้สิทธิ์ตามตำแหน่ง ({assignedPositions.length})
                          </h4>
                          <div className="chipsList">
                            {assignedPositions.map((pos) => (
                              <span key={pos} className="posChip">
                                <span className="chipLabel">{pos}</span>
                                {positionMemberCounts[pos] !== undefined && (
                                  <span className="chipSubCount">
                                    ({positionMemberCounts[pos]} คน)
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onRevokePosition(pos, role)}
                                  className="chipCloseBtn"
                                  aria-label={`ลบตำแหน่ง ${pos}`}
                                  title={`ปลดสิทธิ์ตำแหน่ง ${pos}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ได้สิทธิ์รายบุคคล */}
                      <div className="assignedSection">
                        <h4 className="assignedTitle">
                          ได้สิทธิ์รายบุคคล ({assignedMembers.length})
                        </h4>
                        {assignedMembers.length > 0 ? (
                          <div className="chipsList">
                            {assignedMembers.map((member) => (
                              <span key={member.id} className="memberChip">
                                <span className="chipLabel">{member.name}</span>
                                <span className="chipMemberPos">
                                  {member.position || member.department || 'เจ้าหน้าที่'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onRevokeMember(member, role)}
                                  className="chipCloseBtn"
                                  aria-label={`ลบ ${member.name}`}
                                  title={`ปลดสิทธิ์คุณ ${member.name}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : assignedPositions.length === 0 ? (
                          <div className="roleEmptyBox">
                            ยังไม่มีการกำหนดผู้รับผิดชอบในบทบาทนี้
                          </div>
                        ) : null}
                      </div>

                      {/* Quick Add Button */}
                      <div className="roleActionsRow">
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(currentTask, role)}
                          className="addRoleAssigneeBtn"
                        >
                          + เพิ่มผู้รับผิดชอบ
                        </button>
                      </div>
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
              <div className="modalTitleMeta">
                <h3>เพิ่มผู้รับผิดชอบในบทบาท</h3>
                <p>
                  {targetTask.name} ➔ <strong>{targetRole.label}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="modalCloseBtn"
                aria-label="ปิดหน้าต่าง"
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
                <span>เพิ่มรายบุคคล</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMode('position')}
                className={`modalTabBtn ${addMode === 'position' ? 'active' : ''}`}
              >
                <Briefcase size={16} />
                <span>เพิ่มตามตำแหน่งงาน</span>
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
                        aria-label="ล้างการค้นหา"
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
                        aria-label="ล้างการค้นหา"
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
