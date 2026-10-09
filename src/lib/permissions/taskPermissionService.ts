import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit'
import {
  TASK_DEFINITIONS,
  TaskDefinition,
  TaskRoleConfig,
  PermRoleType,
} from './taskDefinitions'

export { TASK_DEFINITIONS }
export type { TaskDefinition, TaskRoleConfig, PermRoleType }

export interface AdminActorSession {
  username?: string | null
  email?: string | null
  id?: number | null
}

export interface TaskAssignmentSummary {
  taskId: string
  taskName: string
  roles: {
    roleType: PermRoleType
    permissionKey: string
    label: string
    shortLabel: string
    assignedMembers: Array<{
      id: number
      username: string
      name: string
      department: string
      position: string
      role: string
    }>
    assignedPositions: string[]
  }[]
}

/**
 * Task Permission Domain Service
 * Single source of truth for task-centric permission management
 */
export class TaskPermissionService {
  /**
   * Get all tasks with their currently assigned members and positions
   */
  static async getTaskCentricData(): Promise<{
    tasks: TaskDefinition[]
    assignments: TaskAssignmentSummary[]
    members: Array<{
      id: number
      username: string
      name: string
      department: string
      position: string
      role: string
      permissions: string[]
    }>
    availablePositions: string[]
    positionMappings: Array<{
      id: number
      permissionKey: string
      positionName: string
    }>
  }> {
    // 1. Fetch all members with permissions
    const members = await prisma.member.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        position: true,
        role: true,
        member_permissions: {
          select: {
            permissionKey: true,
          },
        },
      },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    })

    const formattedMembers = members.map(
      (m: {
        id: number
        username: string
        name: string | null
        department: string | null
        position: string | null
        role: string | null
        member_permissions: Array<{ permissionKey: string }>
      }) => ({
        id: m.id,
        username: m.username,
        name: m.name ?? '',
        department: m.department ?? '',
        position: m.position ?? '',
        role: m.role ?? 'member',
        permissions: m.member_permissions.map((p: { permissionKey: string }) => p.permissionKey),
      })
    )

    // 2. Fetch position permissions mappings
    const positionPerms = await prisma.positionPermission.findMany({
      select: {
        id: true,
        permissionKey: true,
        positionName: true,
      },
      orderBy: [{ permissionKey: 'asc' }, { positionName: 'asc' }],
    })

    // 3. Fetch unique positions from members
    const uniquePositionsSet = new Set<string>()
    members.forEach((m: { position: string | null }) => {
      if (m.position && m.position.trim()) {
        uniquePositionsSet.add(m.position.trim())
      }
    })
    positionPerms.forEach((p: { positionName: string }) => {
      if (p.positionName && p.positionName.trim()) {
        uniquePositionsSet.add(p.positionName.trim())
      }
    })
    const availablePositions = Array.from(uniquePositionsSet).sort((a, b) =>
      a.localeCompare(b, 'th')
    )

    // Build Task Assignments summary
    const assignments: TaskAssignmentSummary[] = TASK_DEFINITIONS.map((task: TaskDefinition) => {
      return {
        taskId: task.id,
        taskName: task.name,
        roles: task.roles.map((role: TaskRoleConfig) => {
          const permKey = role.permissionKey

          // Members with this permission
          const assignedMembers = formattedMembers.filter((m: { permissions: string[] }) =>
            m.permissions.includes(permKey)
          )

          // Positions with this permission
          const assignedPositions = positionPerms
            .filter((p: { permissionKey: string }) => p.permissionKey === permKey)
            .map((p: { positionName: string }) => p.positionName)

          return {
            roleType: role.roleType,
            permissionKey: permKey,
            label: role.label,
            shortLabel: role.shortLabel,
            assignedMembers: assignedMembers.map(
              (m: {
                id: number
                username: string
                name: string
                department: string
                position: string
                role: string
              }) => ({
                id: m.id,
                username: m.username,
                name: m.name,
                department: m.department,
                position: m.position,
                role: m.role,
              })
            ),
            assignedPositions,
          }
        }),
      }
    })

    return {
      tasks: TASK_DEFINITIONS,
      assignments,
      members: formattedMembers,
      availablePositions,
      positionMappings: positionPerms,
    }
  }

  /**
   * Grant a permission key to a specific member
   */
  static async grantMemberPermission(
    session: AdminActorSession,
    memberId: number,
    permissionKey: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanKey = permissionKey.trim()
    if (!cleanKey) {
      throw new Error('รหัสสิทธิ์ไม่ถูกต้อง')
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, username: true },
    })

    if (!member) {
      throw new Error('ไม่พบบุคลากรที่ระบุ')
    }

    // Upsert member permission
    await prisma.memberPermission.upsert({
      where: {
        memberId_permissionKey: {
          memberId,
          permissionKey: cleanKey,
        },
      },
      update: {},
      create: {
        memberId,
        permissionKey: cleanKey,
        createdBy: session.username || 'admin',
      },
    })

    // Write audit log
    await logAudit(
      'UPDATE_MEMBER_PERMISSIONS',
      'member_permissions',
      `Granted permission ${cleanKey} to member ${member.name || member.username} (ID: ${memberId})`,
      {
        memberId,
        permissionKey: cleanKey,
        action: 'GRANT',
        admin: session.username,
        username: session.username,
        email: session.email,
      }
    )

    return {
      success: true,
      message: `เพิ่มสิทธิ์ให้คุณ ${member.name || member.username} เรียบร้อยแล้ว`,
    }
  }

  /**
   * Revoke a permission key from a specific member
   */
  static async revokeMemberPermission(
    session: AdminActorSession,
    memberId: number,
    permissionKey: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanKey = permissionKey.trim()
    if (!cleanKey) {
      throw new Error('รหัสสิทธิ์ไม่ถูกต้อง')
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, username: true },
    })

    await prisma.memberPermission.deleteMany({
      where: {
        memberId,
        permissionKey: cleanKey,
      },
    })

    // Write audit log
    await logAudit(
      'UPDATE_MEMBER_PERMISSIONS',
      'member_permissions',
      `Revoked permission ${cleanKey} from member ${member?.name || member?.username || memberId}`,
      {
        memberId,
        permissionKey: cleanKey,
        action: 'REVOKE',
        admin: session.username,
        username: session.username,
        email: session.email,
      }
    )

    return {
      success: true,
      message: `ปลดสิทธิ์ของ ${member?.name || member?.username || 'บุคลากร'} เรียบร้อยแล้ว`,
    }
  }

  /**
   * Grant a permission key to a position
   */
  static async grantPositionPermission(
    session: AdminActorSession,
    positionName: string,
    permissionKey: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanPos = positionName.trim()
    const cleanKey = permissionKey.trim()

    if (!cleanPos || !cleanKey) {
      throw new Error('กรุณาระบุชื่อตำแหน่งและรหัสสิทธิ์')
    }

    // Check if exists
    const existing = await prisma.positionPermission.findFirst({
      where: {
        positionName: cleanPos,
        permissionKey: cleanKey,
      },
    })

    if (!existing) {
      await prisma.positionPermission.create({
        data: {
          positionName: cleanPos,
          permissionKey: cleanKey,
        },
      })
    }

    // Write audit log
    await logAudit(
      'UPDATE_MEMBER_PERMISSIONS',
      'position_permissions',
      `Granted permission ${cleanKey} to position "${cleanPos}"`,
      {
        positionName: cleanPos,
        permissionKey: cleanKey,
        action: 'GRANT_POSITION',
        admin: session.username,
        username: session.username,
        email: session.email,
      }
    )

    return {
      success: true,
      message: `เพิ่มสิทธิ์สำหรับตำแหน่ง "${cleanPos}" เรียบร้อยแล้ว`,
    }
  }

  /**
   * Revoke a permission key from a position
   */
  static async revokePositionPermission(
    session: AdminActorSession,
    positionName: string,
    permissionKey: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanPos = positionName.trim()
    const cleanKey = permissionKey.trim()

    if (!cleanPos || !cleanKey) {
      throw new Error('กรุณาระบุชื่อตำแหน่งและรหัสสิทธิ์')
    }

    await prisma.positionPermission.deleteMany({
      where: {
        positionName: cleanPos,
        permissionKey: cleanKey,
      },
    })

    // Write audit log
    await logAudit(
      'UPDATE_MEMBER_PERMISSIONS',
      'position_permissions',
      `Revoked permission ${cleanKey} from position "${cleanPos}"`,
      {
        positionName: cleanPos,
        permissionKey: cleanKey,
        action: 'REVOKE_POSITION',
        admin: session.username,
        username: session.username,
        email: session.email,
      }
    )

    return {
      success: true,
      message: `ปลดสิทธิ์สำหรับตำแหน่ง "${cleanPos}" เรียบร้อยแล้ว`,
    }
  }

  /**
   * Atomically update permissions for a single member
   */
  static async updateMemberPermissions({
    memberId,
    permissions,
    performedBy,
    userAgent,
    ipAddress,
  }: {
    memberId: number
    permissions: string[]
    performedBy: string
    userAgent?: string
    ipAddress?: string
  }): Promise<{ success: boolean; message: string }> {
    const uniquePermissions = Array.from(
      new Set(permissions.map((p) => p.trim()).filter(Boolean))
    )

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Delete all existing permissions for this member
      await tx.memberPermission.deleteMany({
        where: { memberId },
      })

      // 2. Insert new permissions if any
      if (uniquePermissions.length > 0) {
        await tx.memberPermission.createMany({
          data: uniquePermissions.map((permissionKey) => ({
            memberId,
            permissionKey,
            createdBy: performedBy,
          })),
        })
      }
    })

    // Write audit log
    await logAudit(
      'UPDATE_MEMBER_PERMISSIONS',
      'members',
      `Updated permissions for member ${memberId}`,
      {
        memberId,
        permissions: uniquePermissions,
        admin: performedBy,
        username: performedBy,
        email: '',
      }
    )

    return {
      success: true,
      message: 'บันทึกสิทธิ์เรียบร้อยแล้ว',
    }
  }

  /**
   * Atomically update permissions for multiple members in a single transaction
   */
  static async batchUpdateMemberPermissions({
    updates,
    performedBy,
    userAgent,
    ipAddress,
  }: {
    updates: Array<{ memberId: number; permissions: string[] }>
    performedBy: string
    userAgent?: string
    ipAddress?: string
  }): Promise<{ success: boolean; message: string; updatedCount: number }> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of updates) {
        const cleanPerms = Array.from(
          new Set(item.permissions.map((p) => p.trim()).filter(Boolean))
        )

        // 1. Delete all existing permissions for this member
        await tx.memberPermission.deleteMany({
          where: { memberId: item.memberId },
        })

        // 2. Insert new cleaned permissions if any
        if (cleanPerms.length > 0) {
          await tx.memberPermission.createMany({
            data: cleanPerms.map((permissionKey) => ({
              memberId: item.memberId,
              permissionKey,
              createdBy: performedBy,
            })),
          })
        }
      }
    })

    // Write audit log
    await logAudit(
      'BATCH_UPDATE_MEMBER_PERMISSIONS',
      'members',
      JSON.stringify({
        updatedCount: updates.length,
        memberIds: updates.map((u) => u.memberId),
      }),
      { username: performedBy, email: '' }
    )

    return {
      success: true,
      message: 'บันทึกสิทธิ์แบบกลุ่มเรียบร้อยแล้ว',
      updatedCount: updates.length,
    }
  }

  /**
   * List members with their individual permissions and optional filters
   */
  static async listMembersWithPermissions({
    query,
    department,
    hasPermissionsOnly,
  }: {
    query?: string
    department?: string
    hasPermissionsOnly?: boolean
  } = {}): Promise<{
    members: Array<{
      id: number
      username: string
      name: string
      department: string
      position: string
      role: string
      permissions: string[]
    }>
  }> {
    const where: Prisma.MemberWhereInput = {}

    if (query && query.trim()) {
      const q = query.trim()
      where.OR = [
        { name: { contains: q } },
        { username: { contains: q } },
        { department: { contains: q } },
      ]
    }

    if (department && department.trim()) {
      where.department = department.trim()
    }

    if (hasPermissionsOnly) {
      where.member_permissions = {
        some: {},
      }
    }

    const members = await prisma.member.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        position: true,
        role: true,
        member_permissions: {
          select: {
            permissionKey: true,
          },
        },
      },
      orderBy: [
        { department: 'asc' },
        { name: 'asc' },
      ],
    })

    const formattedMembers = members.map((m: {
      id: number
      username: string
      name: string | null
      department: string | null
      position: string | null
      role: string | null
      member_permissions: Array<{ permissionKey: string }>
    }) => ({
      id: m.id,
      username: m.username,
      name: m.name ?? '',
      department: m.department ?? '',
      position: m.position ?? '',
      role: m.role ?? 'member',
      permissions: m.member_permissions.map((p: { permissionKey: string }) => p.permissionKey),
    }))

    return {
      members: formattedMembers,
    }
  }
}
