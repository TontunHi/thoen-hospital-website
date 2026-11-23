export interface DepartmentGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  isActive: boolean
  children: DepartmentGroupNode[]
}

export interface DepartmentRoleItem {
  id: number
  name: string
  orderIndex: number
  isDefault: boolean
}

export interface DepartmentMember {
  id: number
  groupId: number
  name: string
  position: string
  role: string
  orderIndex: number
  imagePath: string | null
  phone?: string | null
  memberId?: number | null
}

export interface SystemMemberSearchResult {
  id: number
  name: string
  position: string
  department: string
  profilePath: string | null
}

export function findGroupName(nodes: DepartmentGroupNode[], targetId: number): string | null {
  for (const node of nodes) {
    if (node.id === targetId) return node.name
    if (node.children && node.children.length > 0) {
      const found = findGroupName(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

export function findGroupById(nodes: DepartmentGroupNode[], targetId: number): DepartmentGroupNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node
    if (node.children && node.children.length > 0) {
      const found = findGroupById(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

export function getGroupBreadcrumbs(
  nodes: DepartmentGroupNode[],
  targetId: number,
  trail: { id: number; name: string }[] = []
): { id: number; name: string }[] | null {
  for (const node of nodes) {
    const currentTrail = [...trail, { id: node.id, name: node.name }]
    if (node.id === targetId) return currentTrail
    if (node.children && node.children.length > 0) {
      const found = getGroupBreadcrumbs(node.children, targetId, currentTrail)
      if (found) return found
    }
  }
  return null
}

export function countGroupsAndSubunits(nodes: DepartmentGroupNode[]): { total: number; main: number; sub: number } {
  const main = nodes.length
  let sub = 0
  const countSub = (list: DepartmentGroupNode[]) => {
    for (const item of list) {
      if (item.children && item.children.length > 0) {
        sub += item.children.length
        countSub(item.children)
      }
    }
  }
  countSub(nodes)
  return { total: main + sub, main, sub }
}

export function buildRoleSections(
  members: DepartmentMember[],
  roles: DepartmentRoleItem[],
  searchMemberInGroupQuery: string
) {
  if (roles.length === 0) {
    const leaders = members.filter((m) => {
      const r = (m.role || '').toLowerCase().trim()
      return r === 'leader' || (r.includes('หัวหน้า') && !r.includes('รอง') && !r.includes('ผู้ช่วย'))
    })
    const regulars = members.filter((m) => !leaders.some((l) => l.id === m.id))
    return [
      { id: 1, name: 'หัวหน้ากลุ่มงาน / ผู้บริหาร', isLeader: true, orderIndex: 0, isDefault: false, members: leaders },
      { id: 2, name: 'เจ้าหน้าที่ / สมาชิกในกลุ่มงาน', isLeader: false, orderIndex: 1, isDefault: true, members: regulars },
    ]
  }

  const q = searchMemberInGroupQuery.trim().toLowerCase()
  const visibleMembers = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.position.toLowerCase().includes(q))
    : members

  const membersByRoleId = new Map<number, DepartmentMember[]>()
  roles.forEach((r) => membersByRoleId.set(r.id, []))
  const otherMembers: DepartmentMember[] = []

  const defaultRole = roles.find((r) => r.isDefault) || roles[roles.length - 1]
  const topRole = roles[0]

  for (const m of visibleMembers) {
    const mRole = (m.role || '').toLowerCase().trim()
    const exactRole = roles.find((r) => r.name.toLowerCase().trim() === mRole)
    if (exactRole) {
      membersByRoleId.get(exactRole.id)?.push(m)
      continue
    }

    if (mRole === 'leader') {
      if (topRole) membersByRoleId.get(topRole.id)?.push(m)
      else otherMembers.push(m)
      continue
    }

    if (mRole === 'member') {
      if (defaultRole) membersByRoleId.get(defaultRole.id)?.push(m)
      else otherMembers.push(m)
      continue
    }

    if (mRole) {
      if (mRole.includes('รอง')) {
        const deputyRole = roles.find((r) => r.name.toLowerCase().includes('รอง'))
        if (deputyRole) {
          membersByRoleId.get(deputyRole.id)?.push(m)
          continue
        }
      } else if (mRole.includes('หัวหน้า') && !mRole.includes('ผู้ช่วย')) {
        const leaderRole =
          roles.find((r) => {
            const name = r.name.toLowerCase()
            return name.includes('หัวหน้า') && !name.includes('รอง') && !name.includes('ผู้ช่วย')
          }) || topRole
        if (leaderRole) {
          membersByRoleId.get(leaderRole.id)?.push(m)
          continue
        }
      }
    }

    otherMembers.push(m)
  }

  const sections = roles.map((role, idx) => {
    const isLeader =
      idx === 0 ||
      (role.name.toLowerCase().includes('หัวหน้า') &&
        !role.name.toLowerCase().includes('รอง') &&
        !role.name.toLowerCase().includes('ผู้ช่วย'))
    return {
      id: role.id,
      name: role.name,
      isLeader,
      orderIndex: role.orderIndex,
      isDefault: role.isDefault,
      members: membersByRoleId.get(role.id) || [],
    }
  })

  if (otherMembers.length > 0) {
    sections.push({
      id: 99999,
      name: 'บทบาทอื่นๆ',
      isLeader: false,
      orderIndex: 99999,
      isDefault: false,
      members: otherMembers,
    })
  }

  return sections
}
