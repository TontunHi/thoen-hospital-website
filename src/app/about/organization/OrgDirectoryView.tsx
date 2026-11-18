'use client'

import React from 'react'
import { Crown, Layers, Users } from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import {
  useOrgDrag,
  partitionGroupMembers,
  type PublicMember,
  type PublicGroupNode,
} from './orgDragContext'

export function PublicDraggableMemberCard({
  member,
  groupId,
  groupName,
}: {
  member: PublicMember
  groupId: number
  groupName?: string
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const itemKey = `member-${member.id}`
  const isDragging =
    canReorder &&
    dragCtx?.draggedItem?.type === 'member' &&
    dragCtx.draggedItem.id === member.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  return (
    <div
      className={`publicMemberCard clickable ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
      draggable={canReorder}
      onDragStart={
        canReorder
          ? (e) => dragCtx?.handleDragStart({ type: 'member', id: member.id, groupId }, e)
          : undefined
      }
      onDragOver={
        canReorder
          ? (e) => dragCtx?.handleDragOver(itemKey, { type: 'member', id: member.id, groupId }, e)
          : undefined
      }
      onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
      onDrop={
        canReorder
          ? (e) => dragCtx?.handleDrop({ type: 'member', id: member.id, groupId }, e)
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
      <div className="publicMemberAvatarWrap">
        {member.imagePath ? (
          <img src={member.imagePath} alt={member.name} className="publicMemberAvatar" />
        ) : (
          <div className="publicMemberAvatarFallback">{getInitials(member.name)}</div>
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

function PublicDraggableDeputyCard({
  deputy,
  groupId,
  groupName,
  badgeText = 'รองหัวหน้างาน',
}: {
  deputy: PublicMember
  groupId: number
  groupName?: string
  badgeText?: string
}) {
  const dragCtx = useOrgDrag()
  const canReorder = dragCtx?.canReorder ?? false
  const itemKey = `member-${deputy.id}`
  const isDragging =
    canReorder &&
    dragCtx?.draggedItem?.type === 'member' &&
    dragCtx.draggedItem.id === deputy.id
  const isDropTarget = canReorder && dragCtx?.dragOverKey === itemKey

  return (
    <div
      className={`publicLeaderCard publicDeputyCard clickable ${isDragging ? 'isDragging' : ''} ${isDropTarget ? 'isDropTarget' : ''}`}
      draggable={canReorder}
      onDragStart={
        canReorder
          ? (e) => dragCtx?.handleDragStart({ type: 'member', id: deputy.id, groupId }, e)
          : undefined
      }
      onDragOver={
        canReorder
          ? (e) => dragCtx?.handleDragOver(itemKey, { type: 'member', id: deputy.id, groupId }, e)
          : undefined
      }
      onDragLeave={canReorder ? dragCtx?.handleDragLeave : undefined}
      onDrop={
        canReorder
          ? (e) => dragCtx?.handleDrop({ type: 'member', id: deputy.id, groupId }, e)
          : undefined
      }
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
            className="publicLeaderAvatar isCompact"
          />
        ) : (
          <div className="publicAvatarFallback isCompact">
            {getInitials(deputy.name)}
          </div>
        )}
      </div>
      <div className="publicLeaderInfo">
        <span className="publicLeaderBadge publicDeputyBadge">{badgeText}</span>
        <span className="publicLeaderName isCompact">{deputy.name}</span>
        <span className="publicLeaderPosition">{deputy.position}</span>
      </div>
    </div>
  )
}

function PublicSubgroupView({
  subgroup,
  depth = 0,
}: {
  subgroup: PublicGroupNode
  depth?: number
}) {
  const dragCtx = useOrgDrag()
  const { leader: primaryLeader, deputyLeaders, staff: subMembers } =
    partitionGroupMembers(subgroup.members)

  return (
    <div className={`subgroupBlock ${depth > 0 ? 'isNested' : ''}`}>
      <div className="subgroupHeader">
        <div className="subgroupIconWrap">
          <Layers size={16} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h3>{subgroup.name}</h3>
      </div>

      {primaryLeader && (
        <div
          className="publicLeaderCard isSubUnit clickable"
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
                className="publicLeaderAvatar isCompact"
              />
            ) : (
              <div className="publicAvatarFallback isCompact">
                {getInitials(primaryLeader.name)}
              </div>
            )}
            <span className="publicLeaderCrown" title="หัวหน้างาน">
              <Crown size={12} strokeWidth={1.5} aria-hidden="true" />
            </span>
          </div>
          <div className="publicLeaderInfo">
            <span className="publicLeaderBadge">
              {primaryLeader.role && primaryLeader.role !== 'leader'
                ? primaryLeader.role
                : 'หัวหน้างาน'}
            </span>
            <span className="publicLeaderName isCompact">{primaryLeader.name}</span>
            <span className="publicLeaderPosition">{primaryLeader.position}</span>
          </div>
        </div>
      )}

      {deputyLeaders.map((deputy) => (
        <PublicDraggableDeputyCard
          key={deputy.id}
          deputy={deputy}
          groupId={subgroup.id}
          groupName={subgroup.name}
          badgeText={
            deputy.role && deputy.role !== 'leader' ? deputy.role : 'รองหัวหน้างาน'
          }
        />
      ))}

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

      {subgroup.children && subgroup.children.length > 0 && (
        <div className="subgroupChildrenStack">
          {subgroup.children.map((child) => (
            <PublicSubgroupView key={child.id} subgroup={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface OrgDirectoryViewProps {
  selectedRoot: PublicGroupNode
  rootLeader: PublicMember | null
  otherRootLeaders: PublicMember[]
  rootStaff: PublicMember[]
  onCardClick: (member: PublicMember, groupName?: string) => void
}

export default function OrgDirectoryView({
  selectedRoot,
  rootLeader,
  otherRootLeaders,
  rootStaff,
  onCardClick,
}: OrgDirectoryViewProps) {
  return (
    <div className="directoryCardsWrap">
      {rootLeader && (
        <div
          className="publicLeaderCard clickable"
          onClick={() => onCardClick(rootLeader, selectedRoot.name)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onCardClick(rootLeader, selectedRoot.name)
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
              <Crown size={14} strokeWidth={1.5} aria-hidden="true" />
            </span>
          </div>
          <div className="publicLeaderInfo">
            <span className="publicLeaderBadge">
              {rootLeader.role && rootLeader.role !== 'leader'
                ? rootLeader.role
                : 'หัวหน้ากลุ่มงาน'}
            </span>
            <span className="publicLeaderName">{rootLeader.name}</span>
            <span className="publicLeaderPosition">{rootLeader.position}</span>
          </div>
        </div>
      )}

      {otherRootLeaders.map((deputy) => (
        <PublicDraggableDeputyCard
          key={deputy.id}
          deputy={deputy}
          groupId={selectedRoot.id}
          groupName={selectedRoot.name}
          badgeText={
            deputy.role && deputy.role !== 'leader' ? deputy.role : 'รองหัวหน้ากลุ่มงาน'
          }
        />
      ))}

      {rootStaff.length > 0 && (
        <div className="directoryMembersSection">
          <div className="directorySectionTitle">
            <Users size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>
              เจ้าหน้าที่ประจำกลุ่มงาน (<span className="orgTabular">{rootStaff.length}</span> ท่าน)
            </span>
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

      {selectedRoot.children && selectedRoot.children.length > 0 && (
        <div className="directorySubgroupsList">
          {selectedRoot.children.map((subgroup) => (
            <PublicSubgroupView key={subgroup.id} subgroup={subgroup} depth={0} />
          ))}
        </div>
      )}
    </div>
  )
}
