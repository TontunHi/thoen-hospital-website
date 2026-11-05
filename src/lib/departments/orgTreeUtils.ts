export interface OrgMember {
  id: number
  groupId: number
  name: string
  position: string
  role: string
  orderIndex: number
  imagePath: string | null
  phone?: string | null
  memberId?: number | null
  groupName?: string
}

export interface OrgGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  members: OrgMember[]
  children: OrgGroupNode[]
  isActive?: boolean
}

/**
 * Checks if a given role string corresponds to a department/unit leader
 */
export function isLeaderRole(role?: string | null): boolean {
  const l = (role || '').toLowerCase().trim()
  return (
    l === 'leader' ||
    (l.includes('หัวหน้า') && !l.includes('รอง') && !l.includes('ผู้ช่วย')) ||
    l.includes('ผู้อำนวยการ') ||
    l.includes('ผู้บริหาร')
  )
}

/**
 * Counts all personnel in this group and all its sub-units recursively
 */
export function countTotalMembersInGroup(node: OrgGroupNode): number {
  let count = node.members?.length || 0
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countTotalMembersInGroup(child)
    }
  }
  return count
}

/**
 * Counts all sub-units under this group recursively
 */
export function countTotalSubUnits(node: OrgGroupNode): number {
  let count = node.children?.length || 0
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countTotalSubUnits(child)
    }
  }
  return count
}

/**
 * Swaps two members inside a specified group in the org tree
 */
export function swapMembersInTree<T extends OrgGroupNode>(
  nodes: T[],
  groupId: number,
  memberIdA: number,
  memberIdB: number
): { updatedNodes: T[]; swappedGroup: T | null } {
  let swappedGroup: T | null = null

  function traverse(list: T[]): T[] {
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
          children: traverse(currentNode.children as T[])
        }
      }

      return currentNode
    })
  }

  const updatedNodes = traverse(nodes)
  return { updatedNodes, swappedGroup }
}

/**
 * Swaps two sibling groups (or root tabs) in the org tree
 */
export function swapGroupsInTree<T extends OrgGroupNode>(
  nodes: T[],
  parentId: number | null,
  groupIdA: number,
  groupIdB: number
): { updatedNodes: T[]; swappedGroupIds: number[] | null } {
  if (parentId === null) {
    const idxA = nodes.findIndex((g) => g.id === groupIdA)
    const idxB = nodes.findIndex((g) => g.id === groupIdB)
    if (idxA === -1 || idxB === -1) return { updatedNodes: nodes, swappedGroupIds: null }

    const next = [...nodes]
    const temp = next[idxA]
    next[idxA] = next[idxB]
    next[idxB] = temp
    const reordered = next.map((g, idx) => ({ ...g, orderIndex: idx })) as T[]
    return {
      updatedNodes: reordered,
      swappedGroupIds: reordered.map((g) => g.id)
    }
  }

  let swappedGroupIds: number[] | null = null

  function traverse(list: T[]): T[] {
    return list.map((node) => {
      let currentNode = node
      if (node.id === parentId && node.children && node.children.length > 0) {
        const children = [...node.children] as T[]
        const idxA = children.findIndex((c) => c.id === groupIdA)
        const idxB = children.findIndex((c) => c.id === groupIdB)
        if (idxA !== -1 && idxB !== -1) {
          const temp = children[idxA]
          children[idxA] = children[idxB]
          children[idxB] = temp
          const reordered = children.map((c, idx) => ({ ...c, orderIndex: idx })) as T[]
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
          children: traverse(currentNode.children as T[])
        }
      }

      return currentNode
    })
  }

  const updatedNodes = traverse(nodes)
  return { updatedNodes, swappedGroupIds }
}
