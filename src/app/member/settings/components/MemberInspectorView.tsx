'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  X,
  User,
  Shield,
  UserCheck,
  UserCog,
  Sparkles,
  Check,
  Layers,
  Users,
} from 'lucide-react'
import { TaskDefinition } from '@/lib/permissions/taskDefinitions'
import {
  MemberItem,
  PositionMappingItem,
  ICON_MAP,
  ROLE_TYPE_CONFIG,
  getAvatarColor,
  maskIdentifier,
  hasMemberPermissionEffective,
} from '../types'

export interface MemberInspectorViewProps {
  members: MemberItem[]
  tasks: TaskDefinition[]
  positionMappings: PositionMappingItem[]
  uniqueDepartments: string[]
  onEditMember: (member: MemberItem) => void
}

export default function MemberInspectorView({
  members,
  tasks,
  positionMappings,
  uniqueDepartments,
  onEditMember,
}: MemberInspectorViewProps) {
  const [inspectorSearch, setInspectorSearch] = useState('')
  const [inspectorDeptFilter, setInspectorDeptFilter] = useState('all')
  const [selectedInspectorMemberId, setSelectedInspectorMemberId] = useState<number | null>(null)

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
    if (selectedInspectorMemberId === null) {
      return filteredInspectorMembers[0] || null
    }
    return (
      members.find((m) => m.id === selectedInspectorMemberId) ||
      filteredInspectorMembers[0] ||
      null
    )
  }, [members, selectedInspectorMemberId, filteredInspectorMembers])

  return (
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
                  onClick={() => onEditMember(selectedInspectorMember)}
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
                      role.permissionKey,
                      positionMappings
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
  )
}
