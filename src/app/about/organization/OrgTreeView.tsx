'use client'

import React, { useMemo } from 'react'
import { Crown, RotateCcw, User } from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import {
  useOrgDrag,
  partitionGroupMembers,
  type PublicMember,
  type PublicGroupNode,
} from './orgDragContext'

/**
 * Leaf Member Card in the Org Tree.
 * Note: If badge === 'เจ้าหน้าที่', the tag is intentionally omitted per user specification.
 */
function OrgTreeMemberLeaf({
  member,
  badge,
  groupId,
  groupName,
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
  const isDragging =
    canReorder &&
    dragCtx?.draggedItem?.type === 'member' &&
    dragCtx.draggedItem.id === member.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  const showBadge = Boolean(badge && badge !== 'เจ้าหน้าที่')
  const isDeputy = badge?.includes('รอง')

  return (
    <li>
      <div
        className={`treeMemberCard ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
        draggable={canReorder}
        onDragStart={
          canReorder
            ? (e) =>
                dragCtx?.handleDragStart(
                  { type: 'member', id: member.id, groupId: resolvedGroupId },
                  e
                )
            : undefined
        }
        onDragOver={
          canReorder
            ? (e) =>
                dragCtx?.handleDragOver(
                  itemKey,
                  { type: 'member', id: member.id, groupId: resolvedGroupId },
                  e
                )
            : undefined
        }
        onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
        onDrop={
          canReorder
            ? (e) =>
                dragCtx?.handleDrop(
                  { type: 'member', id: member.id, groupId: resolvedGroupId },
                  e
                )
            : undefined
        }
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
 * Tiered Multi-Row Member List for Large Departments/Units.
 * Arranges members in rows of `perRow` with a continuous central vertical trunk line.
 */
function OrgTreeTieredStaff({
  members,
  perRow,
  badge,
  isNested = false,
  groupId,
  groupName,
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
  membersPerRow = 4,
}: {
  node: PublicGroupNode
  membersPerRow?: number
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const itemKey = `sub-group-${node.id}`
  const isDragging =
    canReorder &&
    dragCtx?.draggedItem?.type === 'group' &&
    dragCtx.draggedItem.id === node.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  const { leader, deputyLeaders: otherLeaders, staff } = partitionGroupMembers(node.members)
  const children = node.children || []
  const hasChildBranches = children.length > 0 || otherLeaders.length > 0 || staff.length > 0

  const nodeClassName = [
    'treeNodeCard',
    'subUnitNode',
    !leader && 'noLeaderUnit',
    isDragging && 'isDragging',
    isDropTarget && 'isDropTarget',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li>
      <div
        className={nodeClassName}
        draggable={canReorder}
        onDragStart={
          canReorder
            ? (e) =>
                dragCtx?.handleDragStart(
                  { type: 'group', id: node.id, parentId: node.parentId },
                  e
                )
            : undefined
        }
        onDragOver={
          canReorder
            ? (e) =>
                dragCtx?.handleDragOver(
                  itemKey,
                  { type: 'group', id: node.id, parentId: node.parentId },
                  e
                )
            : undefined
        }
        onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
        onDrop={
          canReorder
            ? (e) =>
                dragCtx?.handleDrop(
                  { type: 'group', id: node.id, parentId: node.parentId },
                  e
                )
            : undefined
        }
        onDragEnd={canReorder ? dragCtx?.handleDragEnd : undefined}
        onClick={() => {
          if (leader) dragCtx?.handleCardClick(leader, node.name)
        }}
        role={leader ? 'button' : undefined}
        tabIndex={leader ? 0 : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && leader) {
            e.preventDefault()
            dragCtx?.handleCardClick(leader, node.name)
          }
        }}
        title={
          leader
            ? canReorder
              ? 'คลิกเพื่อดูข้อมูลหัวหน้างาน หรือลากเพื่อสลับตำแหน่งหน่วยงานย่อย'
              : 'คลิกเพื่อดูข้อมูลหัวหน้างาน'
            : canReorder
              ? 'ลากเพื่อสลับตำแหน่งหน่วยงานย่อย'
              : undefined
        }
      >
        {leader ? (
          <>
            <span className="treeNodeGroupTag" title={node.name}>
              {node.name}
            </span>
            <div className="treeNodeAvatarWrap">
              {leader.imagePath ? (
                <img src={leader.imagePath} alt={leader.name} className="treeNodeAvatar" />
              ) : (
                <div className="treeNodeAvatarFallback">{getInitials(leader.name)}</div>
              )}
            </div>
            <span className="publicLeaderBadge isSubUnit">
              {leader.role && leader.role !== 'leader' ? leader.role : 'หัวหน้างาน'}
            </span>
            <span className="treeNodeName" title={leader.name}>
              {leader.name}
            </span>
            <span className="treeNodePosition" title={leader.position}>
              {leader.position}
            </span>
          </>
        ) : (
          <div className="subUnitSimpleHeader">
            <span className="subUnitSimpleBadge">งานย่อย</span>
            <span className="subUnitSimpleTitle" title={node.name}>
              {node.name}
            </span>
          </div>
        )}
      </div>

      {hasChildBranches &&
        (children.length === 0 && otherLeaders.length === 0 ? (
          <OrgTreeTieredStaff
            members={staff}
            perRow={membersPerRow}
            badge="เจ้าหน้าที่"
            groupId={node.id}
            groupName={node.name}
          />
        ) : (
          <ul>
            {children.map((child) => (
              <OrgTreeSubnode
                key={`group-${child.id}`}
                node={child}
                membersPerRow={membersPerRow}
              />
            ))}

            {otherLeaders.map((deputy) => (
              <OrgTreeMemberLeaf
                key={`deputy-${deputy.id}`}
                member={deputy}
                badge={deputy.role && deputy.role !== 'leader' ? deputy.role : 'รองหัวหน้างาน'}
                groupId={node.id}
                groupName={node.name}
              />
            ))}

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
        ))}
    </li>
  )
}

interface OrgTreeViewProps {
  selectedRoot: PublicGroupNode
  rootLeader: PublicMember | null
  otherRootLeaders: PublicMember[]
  rootStaff: PublicMember[]
  rootChildren: PublicGroupNode[]
  hasRootBranches: boolean
  membersPerRow: number
  zoom: number
  pan: { x: number; y: number }
  isPanning: boolean
  diagramScrollRef: React.RefObject<HTMLDivElement | null>
  onResetView: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void
  onCardClick: (member: PublicMember, groupName?: string) => void
}

export default function OrgTreeView({
  selectedRoot,
  rootLeader,
  otherRootLeaders,
  rootStaff,
  rootChildren,
  hasRootBranches,
  membersPerRow,
  zoom,
  pan,
  isPanning,
  diagramScrollRef,
  onResetView,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onCardClick,
}: OrgTreeViewProps) {
  return (
    <div
      ref={diagramScrollRef}
      className={`orgDiagramScroll ${isPanning ? 'isPanning' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {(pan.x !== 0 || pan.y !== 0 || zoom !== 1) && (
        <button
          type="button"
          className="canvasResetPill"
          onClick={onResetView}
          title="จัดกึ่งกลางและรีเซ็ตขนาด (Reset View)"
        >
          <RotateCcw size={12} strokeWidth={1.5} aria-hidden="true" />
          <span>จัดกึ่งกลาง</span>
        </button>
      )}

      <div
        className={`orgDiagramCanvas ${isPanning ? 'isPanning' : ''}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <div className="orgTree">
          <div
            className={`treeNodeCard rootNode ${rootLeader ? 'clickable' : ''}`}
            onClick={() => {
              if (rootLeader) onCardClick(rootLeader, selectedRoot.name)
            }}
            role={rootLeader ? 'button' : undefined}
            tabIndex={rootLeader ? 0 : undefined}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && rootLeader) {
                e.preventDefault()
                onCardClick(rootLeader, selectedRoot.name)
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
                      className="treeNodeAvatar isRoot"
                    />
                  ) : (
                    <div className="treeNodeAvatarFallback isRoot">
                      {getInitials(rootLeader.name)}
                    </div>
                  )}
                  <span className="treeCrownBadge" title="หัวหน้ากลุ่มงาน">
                    <Crown size={12} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </div>
                <span className="publicLeaderBadge isRoot">
                  {rootLeader.role && rootLeader.role !== 'leader'
                    ? rootLeader.role
                    : 'หัวหน้ากลุ่มงาน'}
                </span>
                <span className="treeNodeName isRoot">{rootLeader.name}</span>
                <span className="treeNodePosition">{rootLeader.position}</span>
              </>
            ) : (
              <>
                <div className="treeNodeAvatarFallback isEmpty">
                  <User size={24} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <span className="treeNodeName isEmpty">ยังไม่ระบุหัวหน้ากลุ่มงาน</span>
              </>
            )}
          </div>

          {hasRootBranches &&
            (rootChildren.length === 0 && otherRootLeaders.length === 0 ? (
              <OrgTreeTieredStaff
                members={rootStaff}
                perRow={membersPerRow}
                badge="เจ้าหน้าที่"
                groupId={selectedRoot.id}
                groupName={selectedRoot.name}
              />
            ) : (
              <ul>
                {rootChildren.map((child) => (
                  <OrgTreeSubnode
                    key={`group-${child.id}`}
                    node={child}
                    membersPerRow={membersPerRow}
                  />
                ))}

                {otherRootLeaders.map((deputy) => (
                  <OrgTreeMemberLeaf
                    key={`deputy-${deputy.id}`}
                    member={deputy}
                    badge={
                      deputy.role && deputy.role !== 'leader'
                        ? deputy.role
                        : 'รองหัวหน้ากลุ่มงาน'
                    }
                    groupId={selectedRoot.id}
                    groupName={selectedRoot.name}
                  />
                ))}

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
            ))}
        </div>
      </div>
    </div>
  )
}
