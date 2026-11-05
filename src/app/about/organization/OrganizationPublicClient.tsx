'use client'

import React, { useState, useEffect, useMemo, createContext, useContext, useRef } from 'react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import {
  Users,
  User,
  Search,
  ChevronRight,
  Loader2,
  X,
  Network,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  MoveHorizontal,
  Building2,
  Crown,
  Layers,
  GripVertical
} from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import { getInitials } from '@/lib/formatters'
import './page.css'

interface PublicMember {
  id: number
  groupId: number
  name: string
  position: string
  role: 'leader' | 'member'
  orderIndex: number
  imagePath: string | null
  groupName?: string
}

interface PublicGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  members: PublicMember[]
  children: PublicGroupNode[]
}

interface DragItemMember {
  type: 'member'
  id: number
  groupId: number
}

interface DragItemGroup {
  type: 'group'
  id: number
  parentId: number | null
}

type DragItem = DragItemMember | DragItemGroup

interface OrgDragContextValue {
  canReorder: boolean
  draggedItem: DragItem | null
  dragOverKey: string | null
  handleDragStart: (item: DragItem, e: React.DragEvent) => void
  handleDragOver: (key: string, item: DragItem, e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (targetItem: DragItem, e: React.DragEvent) => void
  handleDragEnd: () => void
  handleCardClick: (member: PublicMember, groupName?: string) => void
}

const OrgDragContext = createContext<OrgDragContextValue | null>(null)

function useOrgDrag() {
  return useContext(OrgDragContext)
}

function countTotalMembersInGroup(node: PublicGroupNode): number {
  let count = node.members.length
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countTotalMembersInGroup(child)
    }
  }
  return count
}

function countTotalSubUnits(node: PublicGroupNode): number {
  let count = node.children ? node.children.length : 0
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countTotalSubUnits(child)
    }
  }
  return count
}

/**
 * Pure helper to swap two members inside the specified group in the org tree.
 */
export function swapMembersInTree(
  nodes: PublicGroupNode[],
  groupId: number,
  memberIdA: number,
  memberIdB: number
): { updatedNodes: PublicGroupNode[]; swappedGroup: PublicGroupNode | null } {
  let swappedGroup: PublicGroupNode | null = null

  function traverse(list: PublicGroupNode[]): PublicGroupNode[] {
    return list.map((node) => {
      let currentNode = node
      if (node.id === groupId) {
        const members = [...node.members]
        const idxA = members.findIndex((m) => m.id === memberIdA)
        const idxB = members.findIndex((m) => m.id === memberIdB)
        if (idxA !== -1 && idxB !== -1) {
          const temp = members[idxA]
          members[idxA] = members[idxB]
          members[idxB] = temp
          const reordered = members.map((m, idx) => ({ ...m, orderIndex: idx }))
          currentNode = { ...node, members: reordered }
          swappedGroup = currentNode
        }
      }

      if (currentNode.children && currentNode.children.length > 0) {
        return {
          ...currentNode,
          children: traverse(currentNode.children)
        }
      }

      return currentNode
    })
  }

  const updatedNodes = traverse(nodes)
  return { updatedNodes, swappedGroup }
}

/**
 * Pure helper to swap two sibling groups (or root tabs) in the org tree.
 */
export function swapGroupsInTree(
  nodes: PublicGroupNode[],
  parentId: number | null,
  groupIdA: number,
  groupIdB: number
): { updatedNodes: PublicGroupNode[]; swappedGroupIds: number[] | null } {
  if (parentId === null) {
    const idxA = nodes.findIndex((g) => g.id === groupIdA)
    const idxB = nodes.findIndex((g) => g.id === groupIdB)
    if (idxA === -1 || idxB === -1) return { updatedNodes: nodes, swappedGroupIds: null }

    const next = [...nodes]
    const temp = next[idxA]
    next[idxA] = next[idxB]
    next[idxB] = temp
    const reordered = next.map((g, idx) => ({ ...g, orderIndex: idx }))
    return {
      updatedNodes: reordered,
      swappedGroupIds: reordered.map((g) => g.id)
    }
  }

  let swappedGroupIds: number[] | null = null

  function traverse(list: PublicGroupNode[]): PublicGroupNode[] {
    return list.map((node) => {
      let currentNode = node
      if (node.id === parentId && node.children && node.children.length > 0) {
        const children = [...node.children]
        const idxA = children.findIndex((c) => c.id === groupIdA)
        const idxB = children.findIndex((c) => c.id === groupIdB)
        if (idxA !== -1 && idxB !== -1) {
          const temp = children[idxA]
          children[idxA] = children[idxB]
          children[idxB] = temp
          const reordered = children.map((c, idx) => ({ ...c, orderIndex: idx }))
          swappedGroupIds = reordered.map((c) => c.id)
          currentNode = {
            ...node,
            children: reordered
          }
        }
      }

      if (currentNode.children && currentNode.children.length > 0) {
        return {
          ...currentNode,
          children: traverse(currentNode.children)
        }
      }

      return currentNode
    })
  }

  const updatedNodes = traverse(nodes)
  return { updatedNodes, swappedGroupIds }
}

/**
 * Member Detail Modal
 * Displays full personnel information: First name - Last name, Department / Group, and Position.
 */
interface MemberDetailModalProps {
  member: PublicMember
  groupName: string
  onClose: () => void
}

function MemberDetailModal({ member, groupName, onClose }: MemberDetailModalProps) {
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomed) {
          setIsZoomed(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, isZoomed])

  const roleText = useMemo(() => {
    if (member.role === 'leader') {
      return 'หัวหน้ากลุ่มงาน / หัวหน้างาน'
    }
    return 'บุคลากรผู้ปฏิบัติงาน'
  }, [member.role])

  return (
    <>
      <div
        className="orgModalOverlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
      >
        <div
          className="orgModalCard"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="orgModalHeader">
            <div className="orgModalHeaderTitle">
              <User size={18} className="text-emerald-700" />
              <h3 id="member-modal-title">ข้อมูลบุคลากร</h3>
            </div>
            <button
              type="button"
              className="orgModalCloseIconBtn"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>

          <div className="orgModalBody">
            <div className="orgModalAvatarSection">
              <div
                className={`orgModalAvatarWrap ${member.imagePath ? 'hasZoom' : ''}`}
                onClick={() => {
                  if (member.imagePath) setIsZoomed(true)
                }}
                title={member.imagePath ? 'คลิกเพื่อดูรูปภาพขยายขนาดเต็ม' : undefined}
                role={member.imagePath ? 'button' : undefined}
                tabIndex={member.imagePath ? 0 : undefined}
                onKeyDown={(e) => {
                  if (member.imagePath && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setIsZoomed(true)
                  }
                }}
              >
                {member.imagePath ? (
                  <>
                    <img
                      src={member.imagePath}
                      alt={member.name}
                      className="orgModalAvatar"
                    />
                    <div className="orgModalAvatarZoomBadge">
                      <ZoomIn size={13} /> <span>ขยายรูป</span>
                    </div>
                  </>
                ) : (
                  <div className="orgModalAvatarFallback">
                    {getInitials(member.name)}
                  </div>
                )}
              </div>
              <h4 className="orgModalMemberName">{member.name}</h4>
              <span className="orgModalRoleBadge">{roleText}</span>
            </div>

            <div className="orgModalDetailsList">
              <div className="orgModalDetailItem">
                <span className="orgModalDetailLabel">ชื่อ - นามสกุล</span>
                <span className="orgModalDetailValue" style={{ fontWeight: 600 }}>{member.name}</span>
              </div>
              <div className="orgModalDetailItem">
                <span className="orgModalDetailLabel">ตำแหน่ง</span>
                <span className="orgModalDetailValue">{member.position}</span>
              </div>
              <div className="orgModalDetailItem">
                <span className="orgModalDetailLabel">แผนก / กลุ่มงาน</span>
                <span className="orgModalDetailValue orgModalDeptValue">{groupName || 'โรงพยาบาลเถิน'}</span>
              </div>
            </div>
          </div>

          <div className="orgModalFooter">
            <button
              type="button"
              className="orgModalCloseBtn"
              onClick={onClose}
            >
              ปิด
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox full-size image viewer */}
      {isZoomed && member.imagePath && (
        <div
          className="orgLightboxOverlay"
          onClick={() => setIsZoomed(false)}
          role="dialog"
          aria-label="รูปภาพขนาดเต็ม"
        >
          <div className="orgLightboxContent" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="orgLightboxCloseBtn"
              onClick={() => setIsZoomed(false)}
              aria-label="ปิดรูปภาพขนาดเต็ม"
            >
              <X size={20} />
            </button>
            <img
              src={member.imagePath}
              alt={member.name}
              className="orgLightboxImage"
            />
            <div className="orgLightboxCaption">
              <span className="orgLightboxName">{member.name}</span>
              <span className="orgLightboxPosition">{member.position}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Leaf Member Card in the Org Tree
 * Note: If badge === 'เจ้าหน้าที่', the tag is intentionally omitted per user specification.
 */
function OrgTreeMemberLeaf({
  member,
  badge,
  groupId,
  groupName
}: {
  member: PublicMember
  badge?: string
  groupId?: number
  groupName?: string
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const resolvedGroupId = groupId ?? member.groupId
  const itemKey = `member-${member.id}`
  const isDragging = canReorder && dragCtx?.draggedItem?.type === 'member' && dragCtx.draggedItem.id === member.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  const showBadge = Boolean(badge && badge !== 'เจ้าหน้าที่')
  const isDeputy = badge?.includes('รอง')

  return (
    <li>
      <div
        className={`treeMemberCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
        draggable={canReorder}
        onDragStart={canReorder ? (e) => dragCtx?.handleDragStart({ type: 'member', id: member.id, groupId: resolvedGroupId }, e) : undefined}
        onDragOver={canReorder ? (e) => dragCtx?.handleDragOver(itemKey, { type: 'member', id: member.id, groupId: resolvedGroupId }, e) : undefined}
        onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
        onDrop={canReorder ? (e) => dragCtx?.handleDrop({ type: 'member', id: member.id, groupId: resolvedGroupId }, e) : undefined}
        onDragEnd={canReorder ? dragCtx?.handleDragEnd : undefined}
        onClick={() => dragCtx?.handleCardClick(member, groupName)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            dragCtx?.handleCardClick(member, groupName)
          }
        }}
        title={canReorder ? 'คลิกเพื่อดูข้อมูล หรือลากเพื่อสลับตำแหน่ง' : 'คลิกเพื่อดูข้อมูล'}
      >
        <div className="treeMemberAvatarWrap">
          {member.imagePath ? (
            <img src={member.imagePath} alt={member.name} className="treeMemberAvatar" />
          ) : (
            <div className="treeMemberAvatarFallback">{getInitials(member.name)}</div>
          )}
        </div>
        {showBadge && (
          <span className={`treeMemberBadge ${isDeputy ? 'deputy' : ''}`}>
            {badge}
          </span>
        )}
        <span className="treeMemberName" title={member.name}>
          {member.name}
        </span>
        <span className="treeMemberPosition" title={member.position}>
          {member.position}
        </span>
      </div>
    </li>
  )
}

/**
 * Tiered Multi-Row Member List for Large Departments/Units
 * Arranges members in rows of `perRow` (e.g. 4) with a continuous central
 * vertical line ("เส้นหลัก") extending down between rows to prevent excessive
 * horizontal tree width.
 */
function OrgTreeTieredStaff({
  members,
  perRow,
  badge,
  isNested = false,
  groupId,
  groupName
}: {
  members: PublicMember[]
  perRow: number
  badge?: string
  isNested?: boolean
  groupId?: number
  groupName?: string
}) {
  const rows = useMemo(() => {
    const res: PublicMember[][] = []
    for (let i = 0; i < members.length; i += perRow) {
      res.push(members.slice(i, i + perRow))
    }
    return res
  }, [members, perRow])

  if (rows.length === 0) return null

  return (
    <div className={`orgTreeTieredBlock ${isNested ? 'nested' : ''}`}>
      {rows.map((rowMembers, rowIndex) => {
        const hasNext = rowIndex < rows.length - 1

        return (
          <div key={`tiered-row-${rowIndex}`} className="orgTreeTieredRowWrap">
            <ul className={`orgTreeTieredRow ${hasNext ? 'hasNextRow' : ''}`}>
              {rowMembers.map((member) => (
                <OrgTreeMemberLeaf
                  key={`staff-${member.id}`}
                  member={member}
                  badge={badge}
                  groupId={groupId ?? member.groupId}
                  groupName={groupName}
                />
              ))}
            </ul>
            {hasNext && (
              <div className="orgTreeTieredInterRowStem" aria-hidden="true" />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Recursive Tree Subnode for Org Chart Diagram View
 */
function OrgTreeSubnode({
  node,
  membersPerRow = 4
}: {
  node: PublicGroupNode
  membersPerRow?: number
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const itemKey = `sub-group-${node.id}`
  const isDragging = canReorder && dragCtx?.draggedItem?.type === 'group' && dragCtx.draggedItem.id === node.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  const leader = node.members.find((m) => m.role === 'leader')
  const otherLeaders = node.members.filter((m) => m.role === 'leader' && m.id !== leader?.id)
  const staff = node.members.filter((m) => m.role !== 'leader')
  const children = node.children || []

  const hasChildBranches = children.length > 0 || otherLeaders.length > 0 || staff.length > 0

  return (
    <li>
      <div
        className={`treeNodeCard subUnitNode ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
        draggable={canReorder}
        onDragStart={canReorder ? (e) => dragCtx?.handleDragStart({ type: 'group', id: node.id, parentId: node.parentId }, e) : undefined}
        onDragOver={canReorder ? (e) => dragCtx?.handleDragOver(itemKey, { type: 'group', id: node.id, parentId: node.parentId }, e) : undefined}
        onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
        onDrop={canReorder ? (e) => dragCtx?.handleDrop({ type: 'group', id: node.id, parentId: node.parentId }, e) : undefined}
        onDragEnd={canReorder ? dragCtx?.handleDragEnd : undefined}
        onClick={() => {
          if (leader) dragCtx?.handleCardClick(leader, node.name)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && leader) {
            e.preventDefault()
            dragCtx?.handleCardClick(leader, node.name)
          }
        }}
        title={
          leader
            ? (canReorder
                ? 'คลิกเพื่อดูข้อมูลหัวหน้างาน หรือลากเพื่อสลับตำแหน่งหน่วยงานย่อย'
                : 'คลิกเพื่อดูข้อมูลหัวหน้างาน')
            : (canReorder ? 'ลากเพื่อสลับตำแหน่งหน่วยงานย่อย' : undefined)
        }
      >
        <span className="treeNodeGroupTag" title={node.name}>
          {node.name}
        </span>

        {leader ? (
          <>
            <div className="treeNodeAvatarWrap">
              {leader.imagePath ? (
                <img src={leader.imagePath} alt={leader.name} className="treeNodeAvatar" />
              ) : (
                <div className="treeNodeAvatarFallback">{getInitials(leader.name)}</div>
              )}
            </div>
            <span
              className="publicLeaderBadge"
              style={{ fontSize: '0.7rem', padding: '2px 9px', margin: '0 auto', width: 'fit-content' }}
            >
              หัวหน้างาน
            </span>
            <span className="treeNodeName" title={leader.name}>{leader.name}</span>
            <span className="treeNodePosition" title={leader.position}>{leader.position}</span>
          </>
        ) : (
          <>
            <div
              className="treeNodeAvatarFallback"
              style={{ background: '#f1f5f9', color: '#94a3b8' }}
            >
              <User size={24} />
            </div>
            <span className="treeNodeName" style={{ color: '#64748b', fontSize: '0.85rem' }}>
              เจ้าหน้าที่ผู้ปฏิบัติงาน
            </span>
          </>
        )}
      </div>

      {/* Recursive Child Branches (Subgroups + Deputy Leaders + Staff) */}
      {hasChildBranches && (
        children.length === 0 && otherLeaders.length === 0 ? (
          <OrgTreeTieredStaff
            members={staff}
            perRow={membersPerRow}
            badge="เจ้าหน้าที่"
            groupId={node.id}
            groupName={node.name}
          />
        ) : (
          <ul>
            {/* Sub-departments / Sub-units */}
            {children.map((child) => (
              <OrgTreeSubnode
                key={`group-${child.id}`}
                node={child}
                membersPerRow={membersPerRow}
              />
            ))}

            {/* Deputy Leaders (if any) */}
            {otherLeaders.map((deputy) => (
              <OrgTreeMemberLeaf
                key={`deputy-${deputy.id}`}
                member={deputy}
                badge="รองหัวหน้างาน"
                groupId={node.id}
                groupName={node.name}
              />
            ))}

            {/* Regular Staff Members (Tiered if multiple, cleanly nested) */}
            {staff.length > 0 && (
              <li className="treeTieredBranchLi">
                <OrgTreeTieredStaff
                  members={staff}
                  perRow={membersPerRow}
                  badge="เจ้าหน้าที่"
                  isNested
                  groupId={node.id}
                  groupName={node.name}
                />
              </li>
            )}
          </ul>
        )
      )}
    </li>
  )
}

/**
 * Draggable Member Card for Directory Cards View
 */
function PublicDraggableMemberCard({
  member,
  groupId,
  groupName
}: {
  member: PublicMember
  groupId: number
  groupName?: string
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const itemKey = `member-${member.id}`
  const isDragging = canReorder && dragCtx?.draggedItem?.type === 'member' && dragCtx.draggedItem.id === member.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  return (
    <div
      className={`publicMemberCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
      draggable={canReorder}
      onDragStart={canReorder ? (e) => dragCtx?.handleDragStart({ type: 'member', id: member.id, groupId }, e) : undefined}
      onDragOver={canReorder ? (e) => dragCtx?.handleDragOver(itemKey, { type: 'member', id: member.id, groupId }, e) : undefined}
      onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
      onDrop={canReorder ? (e) => dragCtx?.handleDrop({ type: 'member', id: member.id, groupId }, e) : undefined}
      onDragEnd={canReorder ? dragCtx?.handleDragEnd : undefined}
      onClick={() => dragCtx?.handleCardClick(member, groupName)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          dragCtx?.handleCardClick(member, groupName)
        }
      }}
      title={canReorder ? 'คลิกเพื่อดูข้อมูล หรือลากเพื่อสลับตำแหน่ง' : 'คลิกเพื่อดูข้อมูล'}
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
        <span className="publicMemberPosition" title={member.position}>
          {member.position}
        </span>
      </div>
    </div>
  )
}

/**
 * Draggable Deputy Card for Directory Cards View
 */
function PublicDraggableDeputyCard({
  deputy,
  groupId,
  groupName,
  badgeText = 'รองหัวหน้างาน'
}: {
  deputy: PublicMember
  groupId: number
  groupName?: string
  badgeText?: string
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const itemKey = `member-${deputy.id}`
  const isDragging = canReorder && dragCtx?.draggedItem?.type === 'member' && dragCtx.draggedItem.id === deputy.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  return (
    <div
      className={`publicLeaderCard publicDeputyCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
      draggable={canReorder}
      onDragStart={canReorder ? (e) => dragCtx?.handleDragStart({ type: 'member', id: deputy.id, groupId }, e) : undefined}
      onDragOver={canReorder ? (e) => dragCtx?.handleDragOver(itemKey, { type: 'member', id: deputy.id, groupId }, e) : undefined}
      onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
      onDrop={canReorder ? (e) => dragCtx?.handleDrop({ type: 'member', id: deputy.id, groupId }, e) : undefined}
      onDragEnd={canReorder ? dragCtx?.handleDragEnd : undefined}
      onClick={() => dragCtx?.handleCardClick(deputy, groupName)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          dragCtx?.handleCardClick(deputy, groupName)
        }
      }}
      title={canReorder ? 'คลิกเพื่อดูข้อมูล หรือลากเพื่อสลับตำแหน่ง' : 'คลิกเพื่อดูข้อมูล'}
    >
      <div className="publicLeaderAvatarWrap">
        {deputy.imagePath ? (
          <img
            src={deputy.imagePath}
            alt={deputy.name}
            className="publicLeaderAvatar"
            style={{ width: '60px', height: '60px' }}
          />
        ) : (
          <div className="publicAvatarFallback" style={{ width: '60px', height: '60px', fontSize: '1.25rem' }}>
            {getInitials(deputy.name)}
          </div>
        )}
      </div>
      <div className="publicLeaderInfo">
        <span className="publicLeaderBadge publicDeputyBadge">
          {badgeText}
        </span>
        <span className="publicLeaderName" style={{ fontSize: '1.05rem' }}>
          {deputy.name}
        </span>
        <span className="publicLeaderPosition">{deputy.position}</span>
      </div>
    </div>
  )
}

/**
 * Recursive Subgroup Block for Directory Cards View
 */
function PublicSubgroupView({ subgroup, depth = 0 }: { subgroup: PublicGroupNode; depth?: number }) {
  const dragCtx = useOrgDrag()
  const primaryLeader = subgroup.members.find((m) => m.role === 'leader')
  const deputyLeaders = subgroup.members.filter((m) => m.role === 'leader' && m.id !== primaryLeader?.id)
  const subMembers = subgroup.members.filter((m) => m.role !== 'leader')

  return (
    <div
      key={subgroup.id}
      className="subgroupBlock"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 16, 48)}px` : undefined }}
    >
      <div className="subgroupHeader">
        <div className="subgroupIconWrap">
          <Layers size={16} />
        </div>
        <h3>{subgroup.name}</h3>
        <span className="subgroupMemberCount">
          {subgroup.members.length} ท่าน
        </span>
      </div>

      {/* Subgroup Primary Leader */}
      {primaryLeader && (
        <div
          className="publicLeaderCard"
          style={{ padding: '16px 20px', cursor: 'pointer' }}
          onClick={() => dragCtx?.handleCardClick(primaryLeader, subgroup.name)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              dragCtx?.handleCardClick(primaryLeader, subgroup.name)
            }
          }}
          title="คลิกเพื่อดูข้อมูลหัวหน้างาน"
        >
          <div className="publicLeaderAvatarWrap">
            {primaryLeader.imagePath ? (
              <img
                src={primaryLeader.imagePath}
                alt={primaryLeader.name}
                className="publicLeaderAvatar"
                style={{ width: '68px', height: '68px' }}
              />
            ) : (
              <div className="publicAvatarFallback" style={{ width: '68px', height: '68px', fontSize: '1.4rem' }}>
                {getInitials(primaryLeader.name)}
              </div>
            )}
            <span className="publicLeaderCrown" title="หัวหน้างาน">
              <Crown size={12} />
            </span>
          </div>
          <div className="publicLeaderInfo">
            <span className="publicLeaderBadge">
              หัวหน้างาน
            </span>
            <span className="publicLeaderName" style={{ fontSize: '1.15rem' }}>
              {primaryLeader.name}
            </span>
            <span className="publicLeaderPosition">{primaryLeader.position}</span>
          </div>
        </div>
      )}

      {/* Subgroup Deputy Leaders (รองหัวหน้างาน) */}
      {deputyLeaders.map((deputy) => (
        <PublicDraggableDeputyCard
          key={deputy.id}
          deputy={deputy}
          groupId={subgroup.id}
          groupName={subgroup.name}
          badgeText="รองหัวหน้างาน"
        />
      ))}

      {/* Subgroup Regular Members */}
      {subMembers.length > 0 && (
        <div className="publicMembersGrid">
          {subMembers.map((member) => (
            <PublicDraggableMemberCard
              key={member.id}
              member={member}
              groupId={subgroup.id}
              groupName={subgroup.name}
            />
          ))}
        </div>
      )}

      {/* Recursive Nested Sub-groups (Depth 2, 3, etc.) */}
      {subgroup.children && subgroup.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
          {subgroup.children.map((child) => (
            <PublicSubgroupView key={child.id} subgroup={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

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

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicMember[]>([])
  const [searching, setSearching] = useState(false)

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const hasDraggedRef = useRef(false)

  // Member Detail Modal state
  const [selectedMember, setSelectedMember] = useState<{ member: PublicMember; groupName: string } | null>(null)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type, duration: 3000 }])
  }

  // Check auth session to verify if logged in
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
        // Not logged in or network failure -> keep canReorder as false
      }
    }
    checkAuth()
    return () => {
      isMounted = false
    }
  }, [])

  // Fetch full org chart
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

  // Map of groupId -> groupName for fast lookup
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

  // Debounced search
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const res = await fetch(`/api/departments/public/search?q=${encodeURIComponent(trimmed)}`)
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

  // Drag & drop swapping handlers
  const handleSwapMembers = async (memberIdA: number, memberIdB: number, groupId: number) => {
    const { updatedNodes, swappedGroup } = swapMembersInTree(orgChart, groupId, memberIdA, memberIdB)
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
      }
    } catch {
      // Local state is already updated smoothly
    }
  }

  const handleSwapGroups = async (groupIdA: number, groupIdB: number, parentId: number | null) => {
    const { updatedNodes, swappedGroupIds } = swapGroupsInTree(orgChart, parentId, groupIdA, groupIdB)
    if (!swappedGroupIds) return

    setOrgChart(updatedNodes)

    try {
      const res = await fetch('/api/departments/groups/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupIds: swappedGroupIds
        })
      })
      const json = await res.json().catch(() => null)
      if (json && json.success) {
        addToast(json.message || 'บันทึกลำดับกลุ่มงานสำเร็จ', 'success')
      }
    } catch {
      // Local state is already updated smoothly
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
    const resolvedGroup = groupName || member.groupName || groupNameMap.get(member.groupId) || ''
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
    handleCardClick
  }

  const selectedRoot = orgChart.find((g) => g.id === selectedRootId) || orgChart[0]
  const rootLeader = selectedRoot ? selectedRoot.members.find((m) => m.role === 'leader') : null
  const otherRootLeaders = selectedRoot
    ? selectedRoot.members.filter((m) => m.role === 'leader' && m.id !== rootLeader?.id)
    : []
  const rootStaff = selectedRoot ? selectedRoot.members.filter((m) => m.role !== 'leader') : []
  const rootChildren = selectedRoot ? selectedRoot.children || [] : []

  const hasRootBranches =
    rootChildren.length > 0 || otherRootLeaders.length > 0 || rootStaff.length > 0

  // Computed totals for selected department
  const selectedDeptTotalMembers = useMemo(() => {
    if (!selectedRoot) return 0
    return countTotalMembersInGroup(selectedRoot)
  }, [selectedRoot])

  const selectedDeptTotalSubUnits = useMemo(() => {
    if (!selectedRoot) return 0
    return countTotalSubUnits(selectedRoot)
  }, [selectedRoot])

  return (
    <OrgDragContext.Provider value={dragContextValue}>
      <div className="publicOrgPage">
        {/* Hero Header without the badge */}
        <section className="orgHero">
          <div className="orgHeroContainer">
            <Breadcrumb
              variant="light"
              items={[
                { label: 'เกี่ยวกับเรา', href: '/about' },
                { label: 'โครงสร้างกลุ่มงานและบุคลากร' }
              ]}
            />
            <h1 className="orgHeroTitle">โครงสร้างกลุ่มงานและบุคลากร</h1>
            <p className="orgHeroDesc">
              คณะผู้บริหาร หัวหน้ากลุ่มงาน และบุคลากรผู้ปฏิบัติงาน โรงพยาบาลเถิน
              มุ่งมั่นให้บริการดูแลสุขภาพประชาชนอย่างมีมาตรฐาน ปลอดภัย และโปร่งใส
            </p>
          </div>
        </section>

        {/* Main Content Area */}
        <div className="orgContentContainer">
          {/* Instant Search Bar */}
          <div className="orgSearchCard">
            <Search size={20} className="text-emerald-700" />
            <input
              type="text"
              className="orgSearchInput"
              placeholder="ค้นหาบุคลากรตามชื่อ-นามสกุล หรือตำแหน่ง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clearSearchBtn"
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                aria-label="ล้างคำค้นหา"
              >
                <X size={15} /> <span>ล้างคำค้นหา</span>
              </button>
            )}
            {searching && <Loader2 size={18} className="animate-spin text-emerald-700" />}
          </div>

          {/* If Search Active: Show Search Results */}
          {searchQuery.trim().length >= 2 ? (
            <div className="searchResultsBlock">
              <div className="searchResultsHeader">
                <span>
                  ผลการค้นหาสำหรับ &quot;<strong>{searchQuery}</strong>&quot; ({searchResults.length} ท่าน)
                </span>
              </div>

              {searching ? (
                <div className="publicEmptyState">
                  <Loader2 size={32} className="animate-spin text-emerald-700" />
                  <span>กำลังค้นหาข้อมูล...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="publicEmptyState">
                  <Users size={48} className="text-slate-300" />
                  <p>ไม่พบบุคลากรที่ตรงกับคำค้นหา &quot;{searchQuery}&quot;</p>
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
                        <span className="publicMemberPosition">
                          {member.position}
                        </span>
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
            /* Normal Directory Browsing */
            <>
              {loading ? (
                <div className="deptDisplayCard">
                  <div className="publicEmptyState">
                    <Loader2 size={36} className="animate-spin text-emerald-700" />
                    <span>กำลังโหลดโครงสร้างกลุ่มงาน...</span>
                  </div>
                </div>
              ) : orgChart.length === 0 ? (
                <div className="deptDisplayCard">
                  <div className="publicEmptyState">
                    <User size={48} className="text-slate-300" />
                    <h3>ยังไม่มีข้อมูลโครงสร้างกลุ่มงาน</h3>
                    <p>ระบบยังไม่ได้เพิ่มข้อมูลกลุ่มงานและบุคลากรในขณะนี้</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Department Selection Tabs */}
                  <div className="deptTabsNav">
                    {orgChart.map((root) => {
                      const isActive = selectedRootId === root.id
                      const itemKey = `root-group-${root.id}`
                      const isDragging = canReorder && draggedItem?.type === 'group' && draggedItem.id === root.id
                      const isDropTarget = canReorder && dragOverKey === itemKey

                      return (
                        <button
                          key={root.id}
                          type="button"
                          className={`deptTabBtn ${isActive ? 'active' : ''} ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
                          draggable={canReorder}
                          onDragStart={canReorder ? (e) => handleDragStart({ type: 'group', id: root.id, parentId: null }, e) : undefined}
                          onDragOver={canReorder ? (e) => handleDragOver(itemKey, { type: 'group', id: root.id, parentId: null }, e) : undefined}
                          onDragLeave={canReorder ? handleDragLeave : undefined}
                          onDrop={canReorder ? (e) => handleDrop({ type: 'group', id: root.id, parentId: null }, e) : undefined}
                          onDragEnd={canReorder ? handleDragEnd : undefined}
                          onClick={() => {
                            setSelectedRootId(root.id)
                            setZoom(1)
                          }}
                          title={canReorder ? 'คลิกเพื่อเลือก หรือลากเพื่อสลับลำดับกลุ่มงาน' : 'คลิกเพื่อเลือกกลุ่มงาน'}
                        >
                          <Building2 size={15} />
                          <span>{root.name}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Selected Department Display */}
                  {selectedRoot && (
                    <div className="deptDisplayCard">
                      <div className="deptHeaderRow">
                        <div className="deptTitleBlock">
                          <div className="deptHeaderMain">
                            <h2>{selectedRoot.name}</h2>
                            <div className="deptBadgePillRow">
                              <span className="deptMetaChip">
                                <Users size={12} /> บุคลากรทั้งหมด <strong>{selectedDeptTotalMembers}</strong> ท่าน
                              </span>
                              {selectedDeptTotalSubUnits > 0 && (
                                <span className="deptMetaChip">
                                  <Layers size={12} /> <strong>{selectedDeptTotalSubUnits}</strong> หน่วยงานย่อย
                                </span>
                              )}
                            </div>
                          </div>
                          <p>โครงสร้างคณะผู้บริหารและเจ้าหน้าที่ผู้ปฏิบัติงาน ประจำ{selectedRoot.name}</p>
                        </div>
                      </div>

                      {/* View Switcher Toolbar (Tree Diagram vs Directory Cards) */}
                      <div className="viewToggleBar">
                        <div className="viewModePills">
                          <button
                            type="button"
                            className={`viewModeBtn ${viewMode === 'tree' ? 'active' : ''}`}
                            onClick={() => setViewMode('tree')}
                          >
                            <Network size={16} />
                            <span>ผังโครงสร้างองค์กร</span>
                          </button>
                          <button
                            type="button"
                            className={`viewModeBtn ${viewMode === 'cards' ? 'active' : ''}`}
                            onClick={() => setViewMode('cards')}
                          >
                            <LayoutGrid size={16} />
                            <span>รายชื่อแบบการ์ด</span>
                          </button>
                        </div>

                        {viewMode === 'tree' ? (
                          <div className="diagramToolbar">
                            {/* Row density control: แถวละ x คน */}
                            <div className="densityControls" title="ปรับจำนวนบุคลากรต่อแถวในแผนก">
                              <span className="densityLabel">แถวละ</span>
                              <div className="densityButtons">
                                {[3, 4, 5, 6].map((count) => (
                                  <button
                                    key={count}
                                    type="button"
                                    className={`densityBtn ${membersPerRow === count ? 'active' : ''}`}
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
                              <span className="diagramScrollHint" title="ลากการ์ดหรือแท็บเพื่อสลับตำแหน่ง">
                                <GripVertical size={14} /> ลากเพื่อสลับตำแหน่ง
                              </span>
                            )}

                            <span className="diagramScrollHint">
                              <MoveHorizontal size={14} /> เลื่อนเพื่อดูผังเพิ่มเติม
                            </span>
                            <div className="zoomControls">
                              <button
                                type="button"
                                className="zoomBtn"
                                title="ย่อขนาด"
                                onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
                                aria-label="ย่อขนาด"
                              >
                                <ZoomOut size={14} />
                              </button>
                              <button
                                type="button"
                                className="zoomLevelText"
                                title="รีเซ็ตขนาด 100%"
                                onClick={() => setZoom(1)}
                              >
                                {`${Math.round(zoom * 100)}%`}
                              </button>
                              <button
                                type="button"
                                className="zoomBtn"
                                title="ขยายขนาด"
                                onClick={() => setZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(1))))}
                                aria-label="ขยายขนาด"
                              >
                                <ZoomIn size={14} />
                              </button>
                            </div>
                          </div>
                        ) : canReorder ? (
                          <div className="diagramToolbar">
                            <span className="diagramScrollHint" title="ลากการ์ดเพื่อสลับตำแหน่ง">
                              <GripVertical size={14} /> ลากเพื่อสลับตำแหน่ง
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* ==============================================================
                          VIEW MODE 1: VISUAL TREE DIAGRAM (CSS Tree with Connecting Lines)
                          ============================================================== */}
                      {viewMode === 'tree' ? (
                        <div className="orgDiagramScroll">
                          <div
                            className="orgDiagramCanvas"
                            style={{ transform: `scale(${zoom})` }}
                          >
                            <div className="orgTree">
                              {/* Root Node Card (Head of Department) */}
                              <div
                                className="treeNodeCard rootNode clickable"
                                onClick={() => {
                                  if (rootLeader) handleCardClick(rootLeader, selectedRoot.name)
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && rootLeader) {
                                    e.preventDefault()
                                    handleCardClick(rootLeader, selectedRoot.name)
                                  }
                                }}
                                title={rootLeader ? 'คลิกเพื่อดูข้อมูลหัวหน้ากลุ่มงาน' : undefined}
                              >
                                <span className="treeNodeGroupTag">{selectedRoot.name}</span>

                                {rootLeader ? (
                                  <>
                                    <div className="treeNodeAvatarWrap">
                                      {rootLeader.imagePath ? (
                                        <img
                                          src={rootLeader.imagePath}
                                          alt={rootLeader.name}
                                          className="treeNodeAvatar"
                                          style={{ width: '72px', height: '72px' }}
                                        />
                                      ) : (
                                        <div
                                          className="treeNodeAvatarFallback"
                                          style={{ width: '72px', height: '72px', fontSize: '1.5rem' }}
                                        >
                                          {getInitials(rootLeader.name)}
                                        </div>
                                      )}
                                      <span className="treeCrownBadge" title="หัวหน้ากลุ่มงาน">
                                        <Crown size={12} />
                                      </span>
                                    </div>
                                    <span
                                      className="publicLeaderBadge"
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '3px 12px',
                                        margin: '0 auto',
                                        width: 'fit-content'
                                      }}
                                    >
                                      หัวหน้ากลุ่มงาน
                                    </span>
                                    <span className="treeNodeName" style={{ fontSize: '1.05rem' }}>
                                      {rootLeader.name}
                                    </span>
                                    <span className="treeNodePosition">{rootLeader.position}</span>
                                  </>
                                ) : (
                                  <>
                                    <div
                                      className="treeNodeAvatarFallback"
                                      style={{ background: '#f1f5f9', color: '#94a3b8' }}
                                    >
                                      <User size={28} />
                                    </div>
                                    <span className="treeNodeName" style={{ color: '#64748b' }}>
                                      ยังไม่ระบุหัวหน้ากลุ่มงาน
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Root Connecting Branches */}
                              {hasRootBranches && (
                                rootChildren.length === 0 && otherRootLeaders.length === 0 ? (
                                  /* When department has only staff (e.g. กลุ่มงานการแพทย์ with 20+ members) */
                                  <OrgTreeTieredStaff
                                    members={rootStaff}
                                    perRow={membersPerRow}
                                    badge="เจ้าหน้าที่"
                                    groupId={selectedRoot.id}
                                    groupName={selectedRoot.name}
                                  />
                                ) : (
                                  <ul>
                                    {/* Sub-departments / Sub-units */}
                                    {rootChildren.map((child) => (
                                      <OrgTreeSubnode
                                        key={`group-${child.id}`}
                                        node={child}
                                        membersPerRow={membersPerRow}
                                      />
                                    ))}

                                    {/* Deputy Leaders (if any) */}
                                    {otherRootLeaders.map((deputy) => (
                                      <OrgTreeMemberLeaf
                                        key={`deputy-${deputy.id}`}
                                        member={deputy}
                                        badge="รองหัวหน้ากลุ่มงาน"
                                        groupId={selectedRoot.id}
                                        groupName={selectedRoot.name}
                                      />
                                    ))}

                                    {/* Direct Staff Members of Root Group */}
                                    {rootStaff.length > 0 && (
                                      <li className="treeTieredBranchLi">
                                        <OrgTreeTieredStaff
                                          members={rootStaff}
                                          perRow={membersPerRow}
                                          badge="เจ้าหน้าที่"
                                          isNested
                                          groupId={selectedRoot.id}
                                          groupName={selectedRoot.name}
                                        />
                                      </li>
                                    )}
                                  </ul>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* ==============================================================
                           VIEW MODE 2: DIRECTORY CARDS (Grouped Lists)
                           ============================================================== */
                        <div className="directoryCardsWrap">
                          {/* Department Leader Highlight */}
                          {rootLeader && (
                            <div
                              className="publicLeaderCard clickable"
                              onClick={() => handleCardClick(rootLeader, selectedRoot.name)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleCardClick(rootLeader, selectedRoot.name)
                                }
                              }}
                              title="คลิกเพื่อดูข้อมูลหัวหน้ากลุ่มงาน"
                            >
                              <div className="publicLeaderAvatarWrap">
                                {rootLeader.imagePath ? (
                                  <img
                                    src={rootLeader.imagePath}
                                    alt={rootLeader.name}
                                    className="publicLeaderAvatar"
                                  />
                                ) : (
                                  <div className="publicAvatarFallback">
                                    {getInitials(rootLeader.name)}
                                  </div>
                                )}
                                <span className="publicLeaderCrown" title="หัวหน้ากลุ่มงาน">
                                  <Crown size={14} />
                                </span>
                              </div>
                              <div className="publicLeaderInfo">
                                <span className="publicLeaderBadge">
                                  หัวหน้ากลุ่มงาน
                                </span>
                                <span className="publicLeaderName">{rootLeader.name}</span>
                                <span className="publicLeaderPosition">{rootLeader.position}</span>
                              </div>
                            </div>
                          )}

                          {/* Department Deputy Leaders (รองหัวหน้ากลุ่มงาน) */}
                          {otherRootLeaders.map((deputy) => (
                            <PublicDraggableDeputyCard
                              key={deputy.id}
                              deputy={deputy}
                              groupId={selectedRoot.id}
                              groupName={selectedRoot.name}
                              badgeText="รองหัวหน้ากลุ่มงาน"
                            />
                          ))}

                          {/* Department Root Members (Regular) */}
                          {rootStaff.length > 0 && (
                            <div className="directoryMembersSection">
                              <div className="directorySectionTitle">
                                <Users size={16} />
                                <span>เจ้าหน้าที่ประจำกลุ่มงาน ({rootStaff.length} ท่าน)</span>
                              </div>
                              <div className="publicMembersGrid">
                                {rootStaff.map((member) => (
                                  <PublicDraggableMemberCard
                                    key={member.id}
                                    member={member}
                                    groupId={selectedRoot.id}
                                    groupName={selectedRoot.name}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sub-groups (Recursive Multi-level Tree) */}
                          {selectedRoot.children && selectedRoot.children.length > 0 && (
                            <div className="directorySubgroupsList">
                              {selectedRoot.children.map((subgroup) => (
                                <PublicSubgroupView key={subgroup.id} subgroup={subgroup} depth={0} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!rootLeader &&
                        (!selectedRoot.children || selectedRoot.children.length === 0) &&
                        rootStaff.length === 0 && (
                          <div className="publicEmptyState" style={{ padding: '30px' }}>
                            <Users size={36} className="text-slate-300" />
                            <p>ยังไม่มีข้อมูลในกลุ่มงานนี้</p>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Member Detail Modal */}
        {selectedMember && (
          <MemberDetailModal
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
