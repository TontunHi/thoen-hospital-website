'use client'

import React, { createContext, useContext } from 'react'
import {
  OrgMember as PublicMember,
  OrgGroupNode as PublicGroupNode,
  isLeaderRole,
} from '@/lib/departments/orgTreeUtils'

export type { PublicMember, PublicGroupNode }

export interface DragItemMember {
  type: 'member'
  id: number
  groupId: number
}

export interface DragItemGroup {
  type: 'group'
  id: number
  parentId: number | null
}

export type DragItem = DragItemMember | DragItemGroup

export interface OrgDragContextValue {
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

export const OrgDragContext = createContext<OrgDragContextValue | null>(null)

export function useOrgDrag() {
  return useContext(OrgDragContext)
}

/**
 * Splits a group's direct members into primary leader, deputy leaders, and general staff.
 * Single shared domain helper so tree nodes and directory views stay consistent.
 */
export function partitionGroupMembers(members: PublicMember[]): {
  leader: PublicMember | null
  deputyLeaders: PublicMember[]
  staff: PublicMember[]
} {
  const isRegularRole = (role?: string | null) => {
    const normalized = (role || '').trim().toLowerCase()
    return (
      !normalized ||
      normalized === 'member' ||
      normalized === 'เจ้าหน้าที่' ||
      normalized === 'เจ้าหน้าที่ผู้ปฏิบัติงาน'
    )
  }

  const leader =
    members.find((m) => isLeaderRole(m.role)) ||
    members.find(
      (m) =>
        !isRegularRole(m.role) &&
        !m.role.includes('รอง') &&
        !m.role.includes('ผู้ช่วย')
    ) ||
    null

  const deputyLeaders = members.filter(
    (m) => m.id !== leader?.id && !isRegularRole(m.role)
  )

  const staff = members.filter(
    (m) => m.id !== leader?.id && !deputyLeaders.some((d) => d.id === m.id)
  )

  return { leader, deputyLeaders, staff }
}
