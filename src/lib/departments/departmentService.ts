import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { resolvePublicProfilePath } from './departmentImageUtils'

export interface DepartmentGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  isActive: boolean
  children: DepartmentGroupNode[]
}

export interface DepartmentRoleRecord {
  id: number
  name: string
  orderIndex: number
  isDefault: boolean
}

export interface CreateRoleInput {
  name: string
  orderIndex?: number
  isDefault?: boolean
}

export interface UpdateRoleInput {
  name?: string
  orderIndex?: number
  isDefault?: boolean
}

export interface DepartmentMemberRecord {
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

export interface CreateGroupInput {
  name: string
  parentId?: number | null
  orderIndex?: number
}

export interface UpdateGroupInput {
  name?: string
  parentId?: number | null
  orderIndex?: number
  isActive?: boolean
}

export interface CreateMemberInput {
  groupId: number
  name: string
  position: string
  role?: string
  orderIndex?: number
  imagePath?: string | null
  phone?: string | null
  memberId?: number | null
}

export interface UpdateMemberInput {
  name?: string
  position?: string
  role?: string
  orderIndex?: number
  imagePath?: string | null
  phone?: string | null
  memberId?: number | null
}

export interface ActorInfo {
  id?: number | null
  name?: string | null
}

export interface DepartmentGatewayAdapter {
  listDepartmentGroupsV2: typeof apiGateway.app.listDepartmentGroupsV2
  getDepartmentGroupByIdV2: typeof apiGateway.app.getDepartmentGroupByIdV2
  createDepartmentGroupV2: typeof apiGateway.app.createDepartmentGroupV2
  updateDepartmentGroupV2: typeof apiGateway.app.updateDepartmentGroupV2
  reorderDepartmentGroupsV2: typeof apiGateway.app.reorderDepartmentGroupsV2
  deleteDepartmentGroupV2: typeof apiGateway.app.deleteDepartmentGroupV2
  listDepartmentRolesV2: typeof apiGateway.app.listDepartmentRolesV2
  createDepartmentRoleV2: typeof apiGateway.app.createDepartmentRoleV2
  updateDepartmentRoleV2: typeof apiGateway.app.updateDepartmentRoleV2
  deleteDepartmentRoleV2: typeof apiGateway.app.deleteDepartmentRoleV2
  reorderDepartmentRolesV2: typeof apiGateway.app.reorderDepartmentRolesV2
  listDepartmentMembersV2: typeof apiGateway.app.listDepartmentMembersV2
  createDepartmentMemberV2: typeof apiGateway.app.createDepartmentMemberV2
  updateDepartmentMemberV2: typeof apiGateway.app.updateDepartmentMemberV2
  deleteDepartmentMemberV2: typeof apiGateway.app.deleteDepartmentMemberV2
  reorderDepartmentMembersV2: typeof apiGateway.app.reorderDepartmentMembersV2
  searchDepartmentStaffV2: typeof apiGateway.app.searchDepartmentStaffV2
  getPublicOrgChartRawV2: typeof apiGateway.app.getPublicOrgChartRawV2
}

const defaultDepartmentGateway: DepartmentGatewayAdapter = {
  listDepartmentGroupsV2: (activeOnly) => apiGateway.app.listDepartmentGroupsV2(activeOnly),
  getDepartmentGroupByIdV2: (id) => apiGateway.app.getDepartmentGroupByIdV2(id),
  createDepartmentGroupV2: (body) => apiGateway.app.createDepartmentGroupV2(body),
  updateDepartmentGroupV2: (id, body) => apiGateway.app.updateDepartmentGroupV2(id, body),
  reorderDepartmentGroupsV2: (groupIds) => apiGateway.app.reorderDepartmentGroupsV2(groupIds),
  deleteDepartmentGroupV2: (id) => apiGateway.app.deleteDepartmentGroupV2(id),
  listDepartmentRolesV2: () => apiGateway.app.listDepartmentRolesV2(),
  createDepartmentRoleV2: (body) => apiGateway.app.createDepartmentRoleV2(body),
  updateDepartmentRoleV2: (id, body) => apiGateway.app.updateDepartmentRoleV2(id, body),
  deleteDepartmentRoleV2: (id) => apiGateway.app.deleteDepartmentRoleV2(id),
  reorderDepartmentRolesV2: (roleIds) => apiGateway.app.reorderDepartmentRolesV2(roleIds),
  listDepartmentMembersV2: (groupId) => apiGateway.app.listDepartmentMembersV2(groupId),
  createDepartmentMemberV2: (body) => apiGateway.app.createDepartmentMemberV2(body),
  updateDepartmentMemberV2: (id, body) => apiGateway.app.updateDepartmentMemberV2(id, body),
  deleteDepartmentMemberV2: (id) => apiGateway.app.deleteDepartmentMemberV2(id),
  reorderDepartmentMembersV2: (groupId, memberIds) =>
    apiGateway.app.reorderDepartmentMembersV2(groupId, memberIds),
  searchDepartmentStaffV2: (keyword) => apiGateway.app.searchDepartmentStaffV2(keyword),
  getPublicOrgChartRawV2: () => apiGateway.app.getPublicOrgChartRawV2(),
}

export class DepartmentService {
  private readonly gw: DepartmentGatewayAdapter

  constructor(gateway: Partial<DepartmentGatewayAdapter> = {}) {
    this.gw = { ...defaultDepartmentGateway, ...gateway }
  }

  /**
   * Retrieves all groups and builds a recursive tree structure.
   */
  async getGroupTree(options: { activeOnly?: boolean } = {}): Promise<DepartmentGroupNode[]> {
    const rows = await this.gw.listDepartmentGroupsV2(Boolean(options.activeOnly))

    const map = new Map<number, DepartmentGroupNode>()
    const rootNodes: DepartmentGroupNode[] = []

    rows.forEach((row: Record<string, unknown>) => {
      map.set(Number(row.id), {
        id: Number(row.id),
        name: String(row.name),
        parentId:
          row.parent_id !== null && row.parent_id !== undefined ? Number(row.parent_id) : null,
        orderIndex: Number(row.order_index || 0),
        isActive: Boolean(row.is_active),
        children: [],
      })
    })

    rows.forEach((row: Record<string, unknown>) => {
      const node = map.get(Number(row.id))!
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    return rootNodes
  }

  /**
   * Retrieves a single group by ID.
   */
  async getGroupById(id: number): Promise<DepartmentGroupNode | null> {
    const row = await this.gw.getDepartmentGroupByIdV2(id)
    if (!row) return null
    return {
      id: Number(row.id),
      name: String(row.name),
      parentId: row.parent_id ? Number(row.parent_id) : null,
      orderIndex: Number(row.order_index || 0),
      isActive: Boolean(row.is_active),
      children: [],
    }
  }

  /**
   * Creates a new department or subgroup.
   */
  async createGroup(
    input: CreateGroupInput,
    actor: ActorInfo
  ): Promise<{ id: number; name: string; parentId: number | null; orderIndex: number; isActive: boolean }> {
    const cleanName = input.name.trim()
    const parentId = input.parentId && input.parentId > 0 ? input.parentId : null
    const orderIndex = input.orderIndex ?? 0

    const res = await this.gw.createDepartmentGroupV2({
      name: cleanName,
      parentId,
      orderIndex,
    })

    const insertId = Number(res?.id || 0)

    await logAudit(
      'CREATE',
      'department_groups',
      JSON.stringify({ groupId: insertId, name: cleanName, parentId }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return {
      id: insertId,
      name: cleanName,
      parentId,
      orderIndex,
      isActive: true,
    }
  }

  /**
   * Updates an existing department or subgroup.
   */
  async updateGroup(id: number, input: UpdateGroupInput, actor: ActorInfo): Promise<boolean> {
    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) payload.name = input.name.trim()
    if (input.parentId !== undefined) {
      payload.parentId = input.parentId && input.parentId > 0 ? input.parentId : null
    }
    if (input.orderIndex !== undefined) payload.orderIndex = input.orderIndex
    if (input.isActive !== undefined) payload.isActive = input.isActive

    if (Object.keys(payload).length === 0) return true

    await this.gw.updateDepartmentGroupV2(id, payload)

    await logAudit(
      'UPDATE',
      'department_groups',
      JSON.stringify({ groupId: id, input }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Reorders department groups atomically within the same hierarchy level.
   */
  async reorderGroups(groupIds: number[], actor: ActorInfo): Promise<boolean> {
    if (groupIds.length === 0) return true

    await this.gw.reorderDepartmentGroupsV2(groupIds)

    await logAudit(
      'UPDATE',
      'department_groups',
      JSON.stringify({ action: 'REORDER_GROUPS', groupIds }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Deletes a department or subgroup, preventing deletion if it contains subgroups or members.
   */
  async deleteGroup(id: number, actor: ActorInfo): Promise<boolean> {
    await this.gw.deleteDepartmentGroupV2(id)

    await logAudit(
      'DELETE',
      'department_groups',
      JSON.stringify({ groupId: id }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Retrieves all custom department roles ordered by priority/level.
   */
  async getRoles(): Promise<DepartmentRoleRecord[]> {
    try {
      const rows = await this.gw.listDepartmentRolesV2()
      if (!Array.isArray(rows)) return []

      return rows.map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        name: String(r.name),
        orderIndex: Number(r.order_index ?? 0),
        isDefault: Boolean(r.is_default),
      }))
    } catch {
      return []
    }
  }

  /**
   * Creates a new department role level.
   */
  async createRole(input: CreateRoleInput, actor: ActorInfo): Promise<DepartmentRoleRecord> {
    const cleanName = input.name.trim()
    if (!cleanName) throw new Error('กรุณาระบุชื่อบทบาท')

    const res = await this.gw.createDepartmentRoleV2({
      name: cleanName,
      orderIndex: input.orderIndex,
      isDefault: Boolean(input.isDefault),
    })

    const insertId = Number(res?.id || 0)
    const orderIndex = Number(res?.orderIndex ?? input.orderIndex ?? 0)

    await logAudit(
      'CREATE',
      'department_roles',
      JSON.stringify({ roleId: insertId, name: cleanName, orderIndex }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return {
      id: insertId,
      name: cleanName,
      orderIndex,
      isDefault: Boolean(input.isDefault),
    }
  }

  /**
   * Updates an existing department role.
   */
  async updateRole(id: number, input: UpdateRoleInput, actor: ActorInfo): Promise<boolean> {
    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) {
      const cleanName = input.name.trim()
      if (!cleanName) throw new Error('ชื่อบทบาทไม่สามารถเว้นว่างได้')
      payload.name = cleanName
    }
    if (input.orderIndex !== undefined) payload.orderIndex = input.orderIndex
    if (input.isDefault !== undefined) payload.isDefault = input.isDefault

    if (Object.keys(payload).length === 0) return true

    await this.gw.updateDepartmentRoleV2(id, payload)

    await logAudit(
      'UPDATE',
      'department_roles',
      JSON.stringify({ roleId: id, input }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Deletes a department role. Prevents deletion if it is the only role left.
   */
  async deleteRole(id: number, actor: ActorInfo): Promise<boolean> {
    await this.gw.deleteDepartmentRoleV2(id)

    await logAudit(
      'DELETE',
      'department_roles',
      JSON.stringify({ roleId: id }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Reorders department roles atomically based on given array order.
   */
  async reorderRoles(roleIds: number[], actor: ActorInfo): Promise<boolean> {
    if (roleIds.length === 0) return true

    await this.gw.reorderDepartmentRolesV2(roleIds)

    await logAudit(
      'UPDATE',
      'department_roles',
      JSON.stringify({ action: 'REORDER_ROLES', roleIds }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Retrieves members for a specific group ordered by order_index (the admin's saved drag order).
   * If isPublic=true, phone number is stripped for privacy (PDPA compliance).
   */
  async getMembersByGroupId(
    groupId: number,
    options: { isPublic?: boolean } = {}
  ): Promise<DepartmentMemberRecord[]> {
    const rows = await this.gw.listDepartmentMembersV2(groupId)
    if (!Array.isArray(rows)) return []

    return rows.map((row: Record<string, unknown>) => {
      const record: DepartmentMemberRecord = {
        id: Number(row.id),
        groupId: Number(row.group_id),
        name: String(row.name),
        position: String(row.position),
        role: String(row.role || 'member'),
        orderIndex: Number(row.order_index || 0),
        imagePath: (row.image_path as string | null) || null,
        memberId: row.member_id ? Number(row.member_id) : null,
      }

      if (!options.isPublic && row.phone) {
        record.phone = String(row.phone)
      }

      return record
    })
  }

  /**
   * Creates a member inside a department group.
   */
  async createMember(input: CreateMemberInput, actor: ActorInfo): Promise<DepartmentMemberRecord> {
    const cleanName = input.name.trim()
    const cleanPosition = input.position.trim()
    const role = (input.role || 'member').trim()
    const orderIndex = input.orderIndex ?? 0
    const memberId = input.memberId && input.memberId > 0 ? input.memberId : null
    const imagePath = await resolvePublicProfilePath(input.imagePath?.trim() || null, memberId)
    const phone = input.phone?.trim() || null

    const res = await this.gw.createDepartmentMemberV2({
      groupId: input.groupId,
      name: cleanName,
      position: cleanPosition,
      role,
      orderIndex,
      imagePath,
      phone,
      memberId,
    })

    const insertId = Number(res?.id || 0)

    await logAudit(
      'CREATE',
      'department_members',
      JSON.stringify({ memberId: insertId, groupId: input.groupId, name: cleanName, role }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return {
      id: insertId,
      groupId: input.groupId,
      name: cleanName,
      position: cleanPosition,
      role,
      orderIndex,
      imagePath,
      phone,
      memberId,
    }
  }

  /**
   * Updates an existing member.
   */
  async updateMember(id: number, input: UpdateMemberInput, actor: ActorInfo): Promise<boolean> {
    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) payload.name = input.name.trim()
    if (input.position !== undefined) payload.position = input.position.trim()
    if (input.role !== undefined) payload.role = input.role.trim()
    if (input.orderIndex !== undefined) payload.orderIndex = input.orderIndex
    if (input.imagePath !== undefined) {
      payload.imagePath = await resolvePublicProfilePath(input.imagePath?.trim() || null, input.memberId)
    }
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null
    if (input.memberId !== undefined) {
      payload.memberId = input.memberId && input.memberId > 0 ? input.memberId : null
    }

    if (Object.keys(payload).length === 0) return true

    await this.gw.updateDepartmentMemberV2(id, payload)

    await logAudit(
      'UPDATE',
      'department_members',
      JSON.stringify({ memberId: id, input }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Deletes a department member.
   */
  async deleteMember(id: number, actor: ActorInfo): Promise<boolean> {
    await this.gw.deleteDepartmentMemberV2(id)

    await logAudit(
      'DELETE',
      'department_members',
      JSON.stringify({ memberId: id }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Reorders members inside a group in a single atomic batch query.
   */
  async reorderMembers(groupId: number, memberIds: number[], actor: ActorInfo): Promise<boolean> {
    if (memberIds.length === 0) return true

    await this.gw.reorderDepartmentMembersV2(groupId, memberIds)

    await logAudit(
      'UPDATE',
      'department_members',
      JSON.stringify({ groupId, action: 'REORDER', memberIds }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Fast search across active staff for the public directory (no phone returned).
   */
  async searchStaff(
    keyword: string
  ): Promise<Array<DepartmentMemberRecord & { groupName: string }>> {
    const rows = await this.gw.searchDepartmentStaffV2(keyword.trim())

    return rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      groupId: Number(row.group_id),
      name: String(row.name),
      position: String(row.position),
      role: String(row.role || 'member'),
      orderIndex: Number(row.order_index || 0),
      imagePath: (row.image_path as string | null) || null,
      groupName: String(row.group_name),
    }))
  }

  /**
   * Retrieves complete active group tree with embedded members for public display.
   * Excludes phone numbers to comply with PDPA and hospital privacy standards.
   */
  async getPublicOrgChart(): Promise<
    Array<{
      id: number
      name: string
      parentId: number | null
      orderIndex: number
      members: Array<{
        id: number
        groupId: number
        name: string
        position: string
        role: string
        orderIndex: number
        imagePath: string | null
      }>
      children: unknown[]
    }>
  > {
    const raw = await this.gw.getPublicOrgChartRawV2()
    const groups = raw?.groups
    const members = raw?.members

    if (!Array.isArray(groups) || !Array.isArray(members)) return []

    const memberMap = new Map<
      number,
      Array<{
        id: number
        groupId: number
        name: string
        position: string
        role: string
        orderIndex: number
        imagePath: string | null
      }>
    >()

    members.forEach((m: Record<string, unknown>) => {
      const gid = Number(m.group_id)
      if (!memberMap.has(gid)) memberMap.set(gid, [])
      memberMap.get(gid)!.push({
        id: Number(m.id),
        groupId: gid,
        name: String(m.name),
        position: String(m.position),
        role: String(m.role || 'member'),
        orderIndex: Number(m.order_index || 0),
        imagePath: (m.image_path as string | null) || null,
      })
    })

    const nodeMap = new Map<number, any>()
    const rootNodes: any[] = []

    groups.forEach((g: Record<string, unknown>) => {
      const gid = Number(g.id)
      nodeMap.set(gid, {
        id: gid,
        name: String(g.name),
        parentId: g.parent_id !== null && g.parent_id !== undefined ? Number(g.parent_id) : null,
        orderIndex: Number(g.order_index || 0),
        members: memberMap.get(gid) || [],
        children: [],
      })
    })

    groups.forEach((g: Record<string, unknown>) => {
      const gid = Number(g.id)
      const node = nodeMap.get(gid)!
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    return rootNodes
  }
}

export const departmentService = new DepartmentService()
