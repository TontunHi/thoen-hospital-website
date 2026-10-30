import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

export interface DepartmentGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  isActive: boolean
  children: DepartmentGroupNode[]
}

export interface DepartmentMemberRecord {
  id: number
  groupId: number
  name: string
  position: string
  role: 'leader' | 'member'
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
  role?: 'leader' | 'member'
  orderIndex?: number
  imagePath?: string | null
  phone?: string | null
  memberId?: number | null
}

export interface UpdateMemberInput {
  name?: string
  position?: string
  role?: 'leader' | 'member'
  orderIndex?: number
  imagePath?: string | null
  phone?: string | null
  memberId?: number | null
}

export interface ActorInfo {
  id?: number | null
  name?: string | null
}

export class DepartmentService {
  constructor(
    private readonly queryExecutor: (sql: string, params?: any[]) => Promise<any[]> = queryMemberDb
  ) {}

  /**
   * Retrieves all groups and builds a recursive tree structure.
   */
  async getGroupTree(options: { activeOnly?: boolean } = {}): Promise<DepartmentGroupNode[]> {
    const whereClause = options.activeOnly ? 'WHERE is_active = 1' : ''
    const rows = await this.queryExecutor(`
      SELECT id, name, parent_id, order_index, is_active
      FROM department_groups
      ${whereClause}
      ORDER BY order_index ASC, id ASC
    `)

    // Build tree
    const map = new Map<number, DepartmentGroupNode>()
    const rootNodes: DepartmentGroupNode[] = []

    rows.forEach((row: any) => {
      map.set(Number(row.id), {
        id: Number(row.id),
        name: String(row.name),
        parentId: row.parent_id !== null && row.parent_id !== undefined ? Number(row.parent_id) : null,
        orderIndex: Number(row.order_index || 0),
        isActive: Boolean(row.is_active),
        children: []
      })
    })

    rows.forEach((row: any) => {
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
    const rows = await this.queryExecutor(
      `SELECT id, name, parent_id, order_index, is_active FROM department_groups WHERE id = ? LIMIT 1`,
      [id]
    )
    if (!rows || rows.length === 0) return null
    const row = rows[0]
    return {
      id: Number(row.id),
      name: String(row.name),
      parentId: row.parent_id ? Number(row.parent_id) : null,
      orderIndex: Number(row.order_index || 0),
      isActive: Boolean(row.is_active),
      children: []
    }
  }

  /**
   * Creates a new department or subgroup.
   */
  async createGroup(input: CreateGroupInput, actor: ActorInfo): Promise<{ id: number; name: string; parentId: number | null; orderIndex: number; isActive: boolean }> {
    const cleanName = input.name.trim()
    const parentId = input.parentId && input.parentId > 0 ? input.parentId : null
    const orderIndex = input.orderIndex ?? 0

    const res: any = await this.queryExecutor(
      `INSERT INTO department_groups (name, parent_id, order_index, is_active) VALUES (?, ?, ?, 1)`,
      [cleanName, parentId, orderIndex]
    )

    const insertId = Number(res?.insertId || 0)

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
      isActive: true
    }
  }

  /**
   * Updates an existing department or subgroup.
   */
  async updateGroup(id: number, input: UpdateGroupInput, actor: ActorInfo): Promise<boolean> {
    const updates: string[] = []
    const params: any[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name.trim())
    }
    if (input.parentId !== undefined) {
      updates.push('parent_id = ?')
      params.push(input.parentId && input.parentId > 0 ? input.parentId : null)
    }
    if (input.orderIndex !== undefined) {
      updates.push('order_index = ?')
      params.push(input.orderIndex)
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ?')
      params.push(input.isActive ? 1 : 0)
    }

    if (updates.length === 0) return true
    params.push(id)

    await this.queryExecutor(
      `UPDATE department_groups SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    await logAudit(
      'UPDATE',
      'department_groups',
      JSON.stringify({ groupId: id, input }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Deletes a department or subgroup, preventing deletion if it contains subgroups or members.
   */
  async deleteGroup(id: number, actor: ActorInfo): Promise<boolean> {
    // 1. Check subgroups
    const subRows = await this.queryExecutor(
      `SELECT COUNT(*) AS count FROM department_groups WHERE parent_id = ?`,
      [id]
    )
    if (Number(subRows[0]?.count || 0) > 0) {
      throw new Error('ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากมีกลุ่มงานย่อยอยู่ภายใน')
    }

    // 2. Check members
    const memberRows = await this.queryExecutor(
      `SELECT COUNT(*) AS count FROM department_members WHERE group_id = ?`,
      [id]
    )
    if (Number(memberRows[0]?.count || 0) > 0) {
      throw new Error('ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากยังมีสมาชิกอยู่ภายในกลุ่มงาน')
    }

    await this.queryExecutor(`DELETE FROM department_groups WHERE id = ?`, [id])

    await logAudit(
      'DELETE',
      'department_groups',
      JSON.stringify({ groupId: id }),
      { username: actor.name || undefined }
    ).catch(() => {})

    return true
  }

  /**
   * Retrieves members for a specific group.
   * If isPublic=true, phone number is stripped for privacy (PDPA compliance).
   */
  async getMembersByGroupId(groupId: number, options: { isPublic?: boolean } = {}): Promise<DepartmentMemberRecord[]> {
    const rows = await this.queryExecutor(
      `SELECT id, group_id, name, position, role, order_index, image_path, phone, member_id
       FROM department_members
       WHERE group_id = ?
       ORDER BY CASE WHEN role = 'leader' THEN 0 ELSE 1 END, order_index ASC, id ASC`,
      [groupId]
    )

    return rows.map((row: any) => {
      const record: DepartmentMemberRecord = {
        id: Number(row.id),
        groupId: Number(row.group_id),
        name: String(row.name),
        position: String(row.position),
        role: row.role === 'leader' ? 'leader' : 'member',
        orderIndex: Number(row.order_index || 0),
        imagePath: row.image_path || null,
        memberId: row.member_id ? Number(row.member_id) : null
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
    const role = input.role === 'leader' ? 'leader' : 'member'
    const orderIndex = input.orderIndex ?? 0
    const imagePath = input.imagePath?.trim() || null
    const phone = input.phone?.trim() || null
    const memberId = input.memberId && input.memberId > 0 ? input.memberId : null

    const res: any = await this.queryExecutor(
      `INSERT INTO department_members (group_id, name, position, role, order_index, image_path, phone, member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.groupId, cleanName, cleanPosition, role, orderIndex, imagePath, phone, memberId]
    )

    const insertId = Number(res?.insertId || 0)

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
      memberId
    }
  }

  /**
   * Updates an existing member.
   */
  async updateMember(id: number, input: UpdateMemberInput, actor: ActorInfo): Promise<boolean> {
    const updates: string[] = []
    const params: any[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name.trim())
    }
    if (input.position !== undefined) {
      updates.push('position = ?')
      params.push(input.position.trim())
    }
    if (input.role !== undefined) {
      updates.push('role = ?')
      params.push(input.role === 'leader' ? 'leader' : 'member')
    }
    if (input.orderIndex !== undefined) {
      updates.push('order_index = ?')
      params.push(input.orderIndex)
    }
    if (input.imagePath !== undefined) {
      updates.push('image_path = ?')
      params.push(input.imagePath?.trim() || null)
    }
    if (input.phone !== undefined) {
      updates.push('phone = ?')
      params.push(input.phone?.trim() || null)
    }
    if (input.memberId !== undefined) {
      updates.push('member_id = ?')
      params.push(input.memberId && input.memberId > 0 ? input.memberId : null)
    }

    if (updates.length === 0) return true
    params.push(id)

    await this.queryExecutor(
      `UPDATE department_members SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

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
    await this.queryExecutor(`DELETE FROM department_members WHERE id = ?`, [id])

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

    const cases = memberIds.map(() => 'WHEN ? THEN ?').join(' ')
    const caseParams = memberIds.flatMap((id, idx) => [id, idx])
    const inPlaceholders = memberIds.map(() => '?').join(', ')

    await this.queryExecutor(
      `UPDATE department_members
       SET order_index = CASE id ${cases} ELSE order_index END
       WHERE group_id = ? AND id IN (${inPlaceholders})`,
      [...caseParams, groupId, ...memberIds]
    )

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
  async searchStaff(keyword: string): Promise<Array<DepartmentMemberRecord & { groupName: string }>> {
    const cleanKw = `%${keyword.trim()}%`
    const rows = await this.queryExecutor(
      `SELECT m.id, m.group_id, m.name, m.position, m.role, m.order_index, m.image_path, g.name AS group_name
       FROM department_members m
       JOIN department_groups g ON m.group_id = g.id
       WHERE g.is_active = 1 AND (m.name LIKE ? OR m.position LIKE ?)
       ORDER BY m.name ASC
       LIMIT 50`,
      [cleanKw, cleanKw]
    )

    return rows.map((row: any) => ({
      id: Number(row.id),
      groupId: Number(row.group_id),
      name: String(row.name),
      position: String(row.position),
      role: row.role === 'leader' ? 'leader' : 'member',
      orderIndex: Number(row.order_index || 0),
      imagePath: row.image_path || null,
      groupName: String(row.group_name)
    }))
  }

  /**
   * Retrieves complete active group tree with embedded members for public display.
   * Excludes phone numbers to comply with PDPA and hospital privacy standards.
   */
  async getPublicOrgChart(): Promise<any[]> {
    const [groups, members] = await Promise.all([
      this.queryExecutor(`
        SELECT id, name, parent_id, order_index
        FROM department_groups
        WHERE is_active = 1
        ORDER BY order_index ASC, id ASC
      `),
      this.queryExecutor(`
        SELECT m.id, m.group_id, m.name, m.position, m.role, m.order_index, m.image_path
        FROM department_members m
        JOIN department_groups g ON m.group_id = g.id
        WHERE g.is_active = 1
        ORDER BY CASE WHEN m.role = 'leader' THEN 0 ELSE 1 END, m.order_index ASC, m.id ASC
      `)
    ])

    const memberMap = new Map<number, any[]>()
    members.forEach((m: any) => {
      const gid = Number(m.group_id)
      if (!memberMap.has(gid)) memberMap.set(gid, [])
      memberMap.get(gid)!.push({
        id: Number(m.id),
        groupId: gid,
        name: String(m.name),
        position: String(m.position),
        role: m.role === 'leader' ? 'leader' : 'member',
        orderIndex: Number(m.order_index || 0),
        imagePath: m.image_path || null
      })
    })

    const nodeMap = new Map<number, any>()
    const rootNodes: any[] = []

    groups.forEach((g: any) => {
      const gid = Number(g.id)
      nodeMap.set(gid, {
        id: gid,
        name: String(g.name),
        parentId: g.parent_id !== null && g.parent_id !== undefined ? Number(g.parent_id) : null,
        orderIndex: Number(g.order_index || 0),
        members: memberMap.get(gid) || [],
        children: []
      })
    })

    groups.forEach((g: any) => {
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
