import { apiGateway, GatewayNotFoundError } from '@/lib/apiGateway'
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
 * Single source of truth for task-centric permission management (Zero-SQL via API Gateway)
 */
export class TaskPermissionService {
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
    const { members, permissionRows, positionPerms } =
      await apiGateway.app.getTaskCentricPermissionsRaw()

    const permsByMemberId = new Map<number, string[]>()
    for (const p of permissionRows || []) {
      const list = permsByMemberId.get(p.memberId) || []
      list.push(p.permissionKey)
      permsByMemberId.set(p.memberId, list)
    }

    const formattedMembers = (members || []).map((m) => ({
      id: m.id,
      username: m.username,
      name: m.name ?? '',
      department: m.department ?? '',
      position: m.position ?? '',
      role: m.role ?? 'member',
      permissions: permsByMemberId.get(m.id) || [],
    }))

    const uniquePositionsSet = new Set<string>()
    for (const m of members || []) {
      if (m.position && m.position.trim()) uniquePositionsSet.add(m.position.trim())
    }
    for (const p of positionPerms || []) {
      if (p.positionName && p.positionName.trim()) uniquePositionsSet.add(p.positionName.trim())
    }
    const availablePositions = Array.from(uniquePositionsSet).sort((a, b) =>
      a.localeCompare(b, 'th')
    )

    const assignments: TaskAssignmentSummary[] = TASK_DEFINITIONS.map((task: TaskDefinition) => ({
      taskId: task.id,
      taskName: task.name,
      roles: task.roles.map((role: TaskRoleConfig) => {
        const permKey = role.permissionKey
        const assignedMembers = formattedMembers.filter((m) => m.permissions.includes(permKey))
        const assignedPositions = (positionPerms || [])
          .filter((p) => p.permissionKey === permKey)
          .map((p) => p.positionName)

        return {
          roleType: role.roleType,
          permissionKey: permKey,
          label: role.label,
          shortLabel: role.shortLabel,
          assignedMembers: assignedMembers.map((m) => ({
            id: m.id,
            username: m.username,
            name: m.name,
            department: m.department,
            position: m.position,
            role: m.role,
          })),
          assignedPositions,
        }
      }),
    }))

    return {
      tasks: TASK_DEFINITIONS,
      assignments,
      members: formattedMembers,
      availablePositions,
      positionMappings: positionPerms || [],
    }
  }

  static async grantMemberPermission(
    session: AdminActorSession,
    memberId: number,
    permissionKey: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanKey = permissionKey.trim()
    if (!cleanKey) {
      throw new Error('รหัสสิทธิ์ไม่ถูกต้อง')
    }

    let member: { id: number; name?: string | null; username: string }
    try {
      const res = await apiGateway.app.grantMemberPermissionV2({
        memberId,
        permissionKey: cleanKey,
        actorUsername: session.username || 'admin',
      })
      member = res.member
    } catch (err) {
      if (err instanceof GatewayNotFoundError) {
        throw new Error('ไม่พบบุคลากรที่ระบุ')
      }
      throw err
    }

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

  static async revokeMemberPermission(
    session: AdminActorSession,
    memberId: number,
    permissionKey: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanKey = permissionKey.trim()
    if (!cleanKey) {
      throw new Error('รหัสสิทธิ์ไม่ถูกต้อง')
    }

    const res = await apiGateway.app.revokeMemberPermissionV2({
      memberId,
      permissionKey: cleanKey,
    })
    const member = res.member

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

    await apiGateway.app.grantPositionPermissionV2({
      positionName: cleanPos,
      permissionKey: cleanKey,
    })

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

    await apiGateway.app.revokePositionPermissionV2({
      positionName: cleanPos,
      permissionKey: cleanKey,
    })

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

  static async updateMemberPermissions({
    memberId,
    permissions,
    performedBy,
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

    await apiGateway.app.replaceMemberPermissionsV2(memberId, {
      permissions: uniquePermissions,
      performedBy,
    })

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

  static async batchUpdateMemberPermissions({
    updates,
    performedBy,
  }: {
    updates: Array<{ memberId: number; permissions: string[] }>
    performedBy: string
    userAgent?: string
    ipAddress?: string
  }): Promise<{ success: boolean; message: string; updatedCount: number }> {
    const cleanedUpdates = updates.map((item) => ({
      memberId: item.memberId,
      permissions: Array.from(new Set(item.permissions.map((p) => p.trim()).filter(Boolean))),
    }))

    await apiGateway.app.batchReplaceMemberPermissionsV2({
      updates: cleanedUpdates,
      performedBy,
    })

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
    const { members, permissionRows } = await apiGateway.app.listMembersWithPermissionsRaw({
      query: query?.trim() || undefined,
      department: department?.trim() || undefined,
    })

    const permsByMemberId = new Map<number, string[]>()
    for (const p of permissionRows || []) {
      const list = permsByMemberId.get(p.memberId) || []
      list.push(p.permissionKey)
      permsByMemberId.set(p.memberId, list)
    }

    let formattedMembers = (members || []).map((m) => ({
      id: m.id,
      username: m.username,
      name: m.name ?? '',
      department: m.department ?? '',
      position: m.position ?? '',
      role: m.role ?? 'member',
      permissions: permsByMemberId.get(m.id) || [],
    }))

    if (hasPermissionsOnly) {
      formattedMembers = formattedMembers.filter((m) => m.permissions.length > 0)
    }

    return { members: formattedMembers }
  }

  static async listPositionPermissions() {
    return apiGateway.app.listPositionPermissionsV2()
  }

  static async addPositionPermissionMapping(
    permissionKey: string,
    positionName: string
  ): Promise<void> {
    await apiGateway.app.grantPositionPermissionV2({
      positionName: positionName.trim(),
      permissionKey,
    })
  }

  static async removePositionPermissionMapping(
    permissionKey: string,
    positionName: string
  ): Promise<void> {
    await apiGateway.app.revokePositionPermissionV2({
      positionName: positionName.trim(),
      permissionKey,
    })
  }
}
