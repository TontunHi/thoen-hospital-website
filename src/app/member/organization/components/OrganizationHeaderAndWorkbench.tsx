'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronRight,
  Crown,
  Edit2,
  ExternalLink,
  FolderPlus,
  FolderTree,
  GripVertical,
  Hand,
  Layers,
  Loader2,
  Network,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import { countTotalMembersInGroup, type OrgGroupNode } from '@/lib/departments/orgTreeUtils'
import type { DepartmentGroupNode, DepartmentMember } from '../organizationHelpers'

export interface OrganizationHeaderAndStatsProps {
  rolesCount: number
  groupStats: { main: number; sub: number; total: number }
  selectedGroup: DepartmentGroupNode | null
  membersCount: number
  leaderCount: number
  adminViewMode: 'diagram' | 'workbench'
  setAdminViewMode: React.Dispatch<React.SetStateAction<'diagram' | 'workbench'>>
  setIsRoleModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  onCreateMainGroup: () => void
}

export function OrganizationHeaderAndStats({
  rolesCount,
  groupStats,
  selectedGroup,
  membersCount,
  leaderCount,
  adminViewMode,
  setAdminViewMode,
  setIsRoleModalOpen,
  onCreateMainGroup,
}: OrganizationHeaderAndStatsProps) {
  return (
    <>
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
            <span>ระดับบทบาท ({rolesCount})</span>
          </button>
          <button type="button" className="btn btnPrimary" onClick={onCreateMainGroup}>
            <FolderPlus size={16} />
            <span>เพิ่มกลุ่มงานหลัก</span>
          </button>
        </div>
      </header>

      <div className="orgStatsStrip">
        <div className="orgStatItem">
          <div className="orgStatIconWrap"><Building2 size={16} /></div>
          <div className="orgStatInfo">
            <span className="orgStatLabel">กลุ่มงานหลัก</span>
            <span className="orgStatValue">{groupStats.main}</span>
          </div>
        </div>

        <div className="orgStatDivider" />

        <div className="orgStatItem">
          <div className="orgStatIconWrap sub"><Layers size={16} /></div>
          <div className="orgStatInfo">
            <span className="orgStatLabel">หน่วยงานย่อย</span>
            <span className="orgStatValue">{groupStats.sub}</span>
          </div>
        </div>

        <div className="orgStatDivider" />

        <div className="orgStatItem">
          <div className="orgStatIconWrap active"><Users size={16} /></div>
          <div className="orgStatInfo">
            <span className="orgStatLabel">สมาชิกในกลุ่มที่เลือก</span>
            <span className="orgStatValue">
              {selectedGroup ? membersCount : '—'}
              <small className="orgStatUnit">{selectedGroup ? ' คน' : ''}</small>
            </span>
          </div>
        </div>

        <div className="orgStatDivider" />

        <div className="orgStatItem">
          <div className="orgStatIconWrap gold"><Crown size={16} /></div>
          <div className="orgStatInfo">
            <span className="orgStatLabel">หัวหน้ากลุ่มงานนี้</span>
            <span className="orgStatValue">
              {selectedGroup ? leaderCount : '—'}
              <small className="orgStatUnit">{selectedGroup ? ' ท่าน' : ''}</small>
            </span>
          </div>
        </div>
      </div>

      <div className="orgViewSwitcherBar">
        <div className="orgViewModeToggle" role="tablist" aria-label="สลับมุมมองการจัดการ">
          <button
            type="button"
            role="tab"
            aria-selected={adminViewMode === 'diagram'}
            className={`viewModeBtn ${adminViewMode === 'diagram' ? 'active' : ''}`}
            onClick={() => setAdminViewMode('diagram')}
          >
            <Network size={16} />
            <span>มุมมองแผนผังองค์กร</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={adminViewMode === 'workbench'}
            className={`viewModeBtn ${adminViewMode === 'workbench' ? 'active' : ''}`}
            onClick={() => setAdminViewMode('workbench')}
          >
            <FolderTree size={16} />
            <span>มุมมองรายการละเอียด</span>
          </button>
        </div>

        {adminViewMode === 'diagram' && (
          <div className="adminViewHint" role="status">
            <Hand size={14} className="adminViewHintIcon" />
            <span>
              <strong>Free View:</strong> ลากพื้นที่ว่างเพื่อเลื่อน และกดปุ่มบนการ์ดเพื่อจัดการได้ทันที
            </span>
          </div>
        )}
      </div>
    </>
  )
}

export interface OrganizationDiagramSectionProps {
  effectiveOrgChart: OrgGroupNode[]
  selectedRoot: OrgGroupNode | null
  setSelectedRootId: React.Dispatch<React.SetStateAction<number | null>>
  groups: DepartmentGroupNode[]
  setSelectedGroup: React.Dispatch<React.SetStateAction<DepartmentGroupNode | null>>
  handleResetDiagramView: () => void
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  isPanning: boolean
  pan: { x: number; y: number }
  handleDiagramPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  handleDiagramPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  handleDiagramPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  handleDiagramWheel: (e: React.WheelEvent<HTMLDivElement>) => void
  renderAdminRootNode: (root: OrgGroupNode) => React.ReactNode
}

export function OrganizationDiagramSection({
  effectiveOrgChart,
  selectedRoot,
  setSelectedRootId,
  groups,
  setSelectedGroup,
  handleResetDiagramView,
  zoom,
  setZoom,
  isPanning,
  pan,
  handleDiagramPointerDown,
  handleDiagramPointerMove,
  handleDiagramPointerUp,
  handleDiagramWheel,
  renderAdminRootNode,
}: OrganizationDiagramSectionProps) {
  return (
    <div className="adminDiagramSection">
      <div className="adminDeptSelectorSection">
        <div className="adminDeptSelectorHeader">
          <div className="adminDeptSelectorTitle">
            <Building2 size={18} className="text-emerald-700" />
            <span>เลือกกลุ่มงาน ({effectiveOrgChart.length} กลุ่มงาน)</span>
          </div>
          <div className="adminDeptSelectorQuick">
            <span className="adminDeptSelectLabel">เลือกด่วน:</span>
            <select
              className="adminDeptSelectInput"
              value={selectedRoot?.id || ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                setSelectedRootId(id)
                const found = groups.find((g) => g.id === id)
                if (found) setSelectedGroup(found)
              }}
              aria-label="เลือกกลุ่มงานหลักที่ต้องการแสดงในแผนภาพ"
            >
              {effectiveOrgChart.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="adminDeptTabsGrid" role="tablist">
          {effectiveOrgChart.map((g) => {
            const isSelected = selectedRoot?.id === g.id
            const count = countTotalMembersInGroup(g)
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`adminDeptTabBtn ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRootId(g.id)
                  const found = groups.find((grp) => grp.id === g.id)
                  if (found) setSelectedGroup(found)
                }}
              >
                <Building2 size={16} className="adminDeptTabIcon" />
                <span className="adminDeptTabName">{g.name}</span>
                {count > 0 && <span className="adminDeptTabBadge">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="adminDiagramCard">
        <div className="adminDiagramToolbar">
          <button
            type="button"
            className="adminCanvasResetPill"
            onClick={handleResetDiagramView}
            title="รีเซ็ตตำแหน่งแผนผังให้อยู่ตรงกลาง"
          >
            <RotateCcw size={13} />
            <span>รีเซ็ตมุมมอง</span>
          </button>

          <div className="adminDiagramScrollHint" title="คลิกค้างแล้วลากบนพื้นหลังเพื่อเลื่อนดูแผนผังได้อย่างอิสระ">
            <Hand size={13} className="text-emerald-700" />
            <span>ลากพื้นที่ว่างเพื่อเลื่อนดู (Free View)</span>
          </div>

          <div className="adminZoomControls">
            <button
              type="button"
              className="adminZoomBtn"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
              aria-label="ย่อขนาด"
              title="ย่อขนาด (Zoom out)"
            >
              <ZoomOut size={14} />
            </button>
            <span className="adminZoomLevel">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="adminZoomBtn"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              aria-label="ขยายขนาด"
              title="ขยายขนาด (Zoom in)"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>

        <div
          className={`adminDiagramScroll ${isPanning ? 'isPanning' : ''}`}
          onPointerDown={handleDiagramPointerDown}
          onPointerMove={handleDiagramPointerMove}
          onPointerUp={handleDiagramPointerUp}
          onPointerCancel={handleDiagramPointerUp}
          onWheel={handleDiagramWheel}
        >
          <div
            className="adminDiagramCanvas"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            {selectedRoot ? (
              renderAdminRootNode(selectedRoot)
            ) : (
              <div className="emptyState">
                <div className="emptyStateIconCircle">
                  <Building2 size={36} className="text-emerald-700" />
                </div>
                <span className="emptyStateTitle">ไม่พบข้อมูลกลุ่มงาน</span>
                <p>กรุณาสร้างกลุ่มงานหลักเพื่อเริ่มจัดโครงสร้าง</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export interface OrganizationWorkbenchProps {
  groupStats: { total: number }
  searchGroupQuery: string
  setSearchGroupQuery: React.Dispatch<React.SetStateAction<string>>
  loadingGroups: boolean
  filteredGroups: DepartmentGroupNode[]
  renderGroupNode: (
    node: DepartmentGroupNode,
    level: number,
    siblings: DepartmentGroupNode[],
    index: number
  ) => React.ReactNode
  selectedGroup: DepartmentGroupNode | null
  breadcrumbs: Array<{ id: number; name: string }>
  members: DepartmentMember[]
  leaderMembers: DepartmentMember[]
  regularMembers: DepartmentMember[]
  loadingMembers: boolean
  roleSections: Array<{
    id: number
    name: string
    isLeader: boolean
    members: DepartmentMember[]
  }>
  searchMemberInGroupQuery: string
  setSearchMemberInGroupQuery: React.Dispatch<React.SetStateAction<string>>
  draggedMemberId: number | null
  dragOverMemberId: number | null
  handleMemberDragStart: (id: number, e: React.DragEvent) => void
  handleMemberDragOver: (id: number, e: React.DragEvent) => void
  handleMemberDragLeave: (e: React.DragEvent) => void
  handleMemberDrop: (id: number, e: React.DragEvent) => void
  handleMemberDragEnd: () => void
  handleMoveMember: (list: DepartmentMember[], index: number, dir: 'up' | 'down') => void
  handleDeleteMember: (member: DepartmentMember) => void
  onCreateMainGroup: () => void
  onOpenGroupModal: (mode: 'create' | 'edit', data: { id?: number; name: string; parentId: number | null }) => void
  onOpenCreateMemberModal: () => void
  onOpenEditMemberModal: (member: DepartmentMember) => void
}

export function OrganizationWorkbench({
  groupStats,
  searchGroupQuery,
  setSearchGroupQuery,
  loadingGroups,
  filteredGroups,
  renderGroupNode,
  selectedGroup,
  breadcrumbs,
  members,
  leaderMembers,
  regularMembers,
  loadingMembers,
  roleSections,
  searchMemberInGroupQuery,
  setSearchMemberInGroupQuery,
  draggedMemberId,
  dragOverMemberId,
  handleMemberDragStart,
  handleMemberDragOver,
  handleMemberDragLeave,
  handleMemberDrop,
  handleMemberDragEnd,
  handleMoveMember,
  handleDeleteMember,
  onCreateMainGroup,
  onOpenGroupModal,
  onOpenCreateMemberModal,
  onOpenEditMemberModal,
}: OrganizationWorkbenchProps) {
  return (
    <div className="orgWorkbench">
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
            onClick={onCreateMainGroup}
            title="สร้างกลุ่มงานระดับบนสุดใหม่"
          >
            <Plus size={13} />
            <span>กลุ่มหลัก</span>
          </button>
        </div>

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

      <main className="orgMembersPane">
        {selectedGroup ? (
          <>
            <div className="orgMembersHeader">
              <div className="orgMembersTitleWrap">
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
                      onClick={() =>
                        onOpenGroupModal('edit', {
                          id: selectedGroup.id,
                          name: selectedGroup.name,
                          parentId: selectedGroup.parentId,
                        })
                      }
                    >
                      <Edit2 size={13} />
                      <span>แก้ไขชื่อ</span>
                    </button>
                    <button
                      type="button"
                      className="actionPillBtn"
                      title="เพิ่มงานย่อยภายใต้กลุ่มนี้"
                      onClick={() =>
                        onOpenGroupModal('create', { name: '', parentId: selectedGroup.id })
                      }
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

              <div className="orgMembersHeaderActions">
                <button type="button" className="btn btnPrimary" onClick={onOpenCreateMemberModal}>
                  <UserPlus size={16} />
                  <span>เพิ่มสมาชิก</span>
                </button>
              </div>
            </div>

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
                <button type="button" className="btn btnPrimary" onClick={onOpenCreateMemberModal}>
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

                      <div className={sec.isLeader ? 'leaderCardsList' : 'membersGrid'}>
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
                                  <img src={member.imagePath} alt={member.name} className="leaderAvatar" />
                                ) : (
                                  <div className="avatarFallback">{getInitials(member.name)}</div>
                                )}
                                <span className="leaderCrownBadge" title="หัวหน้ากลุ่มงาน">
                                  <Crown size={12} />
                                </span>
                              </div>

                              <div className="leaderInfo">
                                <div className="leaderHeaderLine">
                                  <span className="leaderBadge">{sec.name}</span>
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
                                  onClick={() => onOpenEditMemberModal(member)}
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
                                  <img src={member.imagePath} alt={member.name} className="memberAvatarSmall" />
                                ) : (
                                  <div className="avatarFallback small">{getInitials(member.name)}</div>
                                )}
                              </div>

                              <div className="memberCardInfo">
                                <span className="memberCardName" title={member.name}>{member.name}</span>
                                <span className="memberCardPosition" title={member.position}>{member.position}</span>
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
                                  onClick={() => onOpenEditMemberModal(member)}
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
  )
}
