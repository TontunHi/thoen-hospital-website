import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskPermissionService, TASK_DEFINITIONS } from '../taskPermissionService'
import { apiGateway, GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'

vi.mock('@/lib/apiGateway', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiGateway')>()
  return {
    ...actual,
    apiGateway: {
      app: {
        getTaskCentricPermissionsRaw: vi.fn(),
        listMembersWithPermissionsRaw: vi.fn(),
        grantMemberPermissionV2: vi.fn(),
        revokeMemberPermissionV2: vi.fn(),
        grantPositionPermissionV2: vi.fn(),
        revokePositionPermissionV2: vi.fn(),
        replaceMemberPermissionsV2: vi.fn(),
        batchReplaceMemberPermissionsV2: vi.fn(),
        listPositionPermissionsV2: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('TaskPermissionService', () => {
  const mockAdminSession = {
    username: 'admin01',
    email: 'admin@thoen.go.th',
    id: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TASK_DEFINITIONS registry', () => {
    it('contains all required workflow and system tasks', () => {
      const taskIds = TASK_DEFINITIONS.map((t) => t.id)
      expect(taskIds).toContain('MEDIA_REQUEST')
      expect(taskIds).toContain('IT_REPAIR')
      expect(taskIds).toContain('GENERAL_REPAIR')
      expect(taskIds).toContain('MEDICAL_REPAIR')
      expect(taskIds).toContain('INBOX_CENTRAL')
      expect(taskIds).toContain('SALARY')
      expect(taskIds).toContain('FACILITY_ASSET')
      expect(taskIds).toContain('OUTGOING_DOC')
      expect(taskIds).toContain('ETHICS')
      expect(taskIds).toContain('ITA')
      expect(taskIds).toContain('RDU')
      expect(taskIds).toContain('NEWS')
      expect(taskIds).toContain('DM_REMISSION_REGISTRY')
      expect(taskIds).toContain('FCT_HOME_VISIT_REGISTRY')
    })

    it('defines single manage_dm_remission role for DM_REMISSION_REGISTRY task', () => {
      const dmTask = TASK_DEFINITIONS.find((t) => t.id === 'DM_REMISSION_REGISTRY')
      expect(dmTask).toBeDefined()
      expect(dmTask?.roles).toHaveLength(1)
      expect(dmTask?.roles[0]?.roleType).toBe('manage')
      expect(dmTask?.roles[0]?.label).toBe('ผู้ดูแลระบบทะเบียน DM Remission')
      expect(dmTask?.roles[0]?.permissionKey).toBe('manage_dm_remission')
    })

    it('defines single manage_fct_home_visit role for FCT_HOME_VISIT_REGISTRY task', () => {
      const fctTask = TASK_DEFINITIONS.find((t) => t.id === 'FCT_HOME_VISIT_REGISTRY')
      expect(fctTask).toBeDefined()
      expect(fctTask?.roles).toHaveLength(1)
      expect(fctTask?.roles[0]?.roleType).toBe('manage')
      expect(fctTask?.roles[0]?.label).toBe('ผู้ดูแลระบบเยี่ยมบ้านทีม FCT')
      expect(fctTask?.roles[0]?.permissionKey).toBe('manage_fct_home_visit')
    })

    it('defines PROJECT_TRACKER in workflow category with manage_project_tracker role', () => {
      const ptTask = TASK_DEFINITIONS.find((t) => t.id === 'PROJECT_TRACKER')
      expect(ptTask).toBeDefined()
      expect(ptTask?.category).toBe('workflow')
      expect(ptTask?.categoryLabel).toBe('งานบริการ & กล่องงาน')
      expect(ptTask?.roles[0]?.permissionKey).toBe('manage_project_tracker')
    })

    it('defines 4 canonical roles for MEDIA_REQUEST task', () => {
      const mediaTask = TASK_DEFINITIONS.find((t) => t.id === 'MEDIA_REQUEST')
      expect(mediaTask).toBeDefined()
      const roleTypes = mediaTask?.roles.map((r) => r.roleType)
      expect(roleTypes).toEqual(['view', 'edit', 'approve', 'manage'])
      expect(mediaTask?.roles.find((r) => r.roleType === 'edit')?.permissionKey).toBe('produce_media')
      expect(mediaTask?.roles.find((r) => r.roleType === 'approve')?.permissionKey).toBe('approve_media')
    })
  })

  describe('getTaskCentricData', () => {
    it('returns aggregated tasks, assignments, members, and available positions', async () => {
      vi.mocked(apiGateway.app.getTaskCentricPermissionsRaw).mockResolvedValueOnce({
        members: [
          {
            id: 10,
            username: '1234567890123',
            name: 'สมศรี นักออกแบบ',
            department: 'ศูนย์คอมพิวเตอร์',
            position: 'นักประชาสัมพันธ์',
            role: 'member',
          },
          {
            id: 20,
            username: '9876543210987',
            name: 'สมชาย หัวหน้างาน',
            department: 'กลุ่มงานบริหารทั่วไป',
            position: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
            role: 'member',
          },
        ],
        permissionRows: [
          { memberId: 10, permissionKey: 'produce_media' },
          { memberId: 20, permissionKey: 'approve_media' },
        ],
        positionPerms: [
          { id: 1, permissionKey: 'produce_media', positionName: 'นักประชาสัมพันธ์' },
        ],
      })

      const result = await TaskPermissionService.getTaskCentricData()

      expect(result.tasks).toBeDefined()
      expect(result.members).toHaveLength(2)
      expect(result.availablePositions).toContain('นักประชาสัมพันธ์')
      expect(result.availablePositions).toContain('หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์')

      const mediaAssignment = result.assignments.find((a) => a.taskId === 'MEDIA_REQUEST')
      expect(mediaAssignment).toBeDefined()

      const editRole = mediaAssignment?.roles.find((r) => r.roleType === 'edit')
      expect(editRole?.assignedMembers[0].id).toBe(10)
      expect(editRole?.assignedPositions).toContain('นักประชาสัมพันธ์')

      const approveRole = mediaAssignment?.roles.find((r) => r.roleType === 'approve')
      expect(approveRole?.assignedMembers[0].id).toBe(20)
    })
  })

  describe('grantMemberPermission', () => {
    it('upserts member permission and writes audit log', async () => {
      vi.mocked(apiGateway.app.grantMemberPermissionV2).mockResolvedValueOnce({
        member: { id: 10, name: 'สมศรี', username: 'somsri' },
      })

      const result = await TaskPermissionService.grantMemberPermission(
        mockAdminSession,
        10,
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(apiGateway.app.grantMemberPermissionV2).toHaveBeenCalledWith({
        memberId: 10,
        permissionKey: 'produce_media',
        actorUsername: 'admin01',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'member_permissions',
        expect.stringContaining('Granted permission produce_media to member สมศรี'),
        expect.any(Object)
      )
    })

    it('throws error when member is not found', async () => {
      vi.mocked(apiGateway.app.grantMemberPermissionV2).mockRejectedValueOnce(
        new GatewayNotFoundError('Not found')
      )

      await expect(
        TaskPermissionService.grantMemberPermission(mockAdminSession, 999, 'produce_media')
      ).rejects.toThrow('ไม่พบบุคลากรที่ระบุ')
    })
  })

  describe('revokeMemberPermission', () => {
    it('deletes member permission and writes audit log', async () => {
      vi.mocked(apiGateway.app.revokeMemberPermissionV2).mockResolvedValueOnce({
        member: { id: 10, name: 'สมศรี', username: 'somsri' },
      })

      const result = await TaskPermissionService.revokeMemberPermission(
        mockAdminSession,
        10,
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(apiGateway.app.revokeMemberPermissionV2).toHaveBeenCalledWith({
        memberId: 10,
        permissionKey: 'produce_media',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'member_permissions',
        expect.stringContaining('Revoked permission produce_media from member สมศรี'),
        expect.any(Object)
      )
    })
  })

  describe('grantPositionPermission', () => {
    it('creates position permission mapping and logs audit', async () => {
      vi.mocked(apiGateway.app.grantPositionPermissionV2).mockResolvedValueOnce({ granted: true })

      const result = await TaskPermissionService.grantPositionPermission(
        mockAdminSession,
        'นักประชาสัมพันธ์',
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(apiGateway.app.grantPositionPermissionV2).toHaveBeenCalledWith({
        positionName: 'นักประชาสัมพันธ์',
        permissionKey: 'produce_media',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'position_permissions',
        expect.stringContaining('Granted permission produce_media to position "นักประชาสัมพันธ์"'),
        expect.any(Object)
      )
    })
  })

  describe('revokePositionPermission', () => {
    it('deletes position permission mapping and logs audit', async () => {
      vi.mocked(apiGateway.app.revokePositionPermissionV2).mockResolvedValueOnce({ revoked: true })

      const result = await TaskPermissionService.revokePositionPermission(
        mockAdminSession,
        'นักประชาสัมพันธ์',
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(apiGateway.app.revokePositionPermissionV2).toHaveBeenCalledWith({
        positionName: 'นักประชาสัมพันธ์',
        permissionKey: 'produce_media',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'position_permissions',
        expect.stringContaining('Revoked permission produce_media from position "นักประชาสัมพันธ์"'),
        expect.any(Object)
      )
    })
  })

  describe('updateMemberPermissions', () => {
    it('atomically replaces member permissions via Gateway and logs audit', async () => {
      vi.mocked(apiGateway.app.replaceMemberPermissionsV2).mockResolvedValueOnce({
        updated: true,
        count: 2,
      })

      const result = await TaskPermissionService.updateMemberPermissions({
        memberId: 10,
        permissions: ['take_repairs_it', 'manage_repairs', 'take_repairs_it'],
        performedBy: 'admin01',
      })

      expect(result.success).toBe(true)
      expect(apiGateway.app.replaceMemberPermissionsV2).toHaveBeenCalledWith(10, {
        permissions: ['take_repairs_it', 'manage_repairs'],
        performedBy: 'admin01',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'members',
        'Updated permissions for member 10',
        expect.objectContaining({
          memberId: 10,
          permissions: ['take_repairs_it', 'manage_repairs'],
          admin: 'admin01',
          username: 'admin01',
        })
      )
    })

    it('clears all permissions when empty array is supplied', async () => {
      vi.mocked(apiGateway.app.replaceMemberPermissionsV2).mockResolvedValueOnce({
        updated: true,
        count: 0,
      })

      const result = await TaskPermissionService.updateMemberPermissions({
        memberId: 10,
        permissions: [],
        performedBy: 'admin01',
      })

      expect(result.success).toBe(true)
      expect(apiGateway.app.replaceMemberPermissionsV2).toHaveBeenCalledWith(10, {
        permissions: [],
        performedBy: 'admin01',
      })
    })
  })

  describe('batchUpdateMemberPermissions', () => {
    it('batch replaces member permissions via Gateway and logs audit', async () => {
      vi.mocked(apiGateway.app.batchReplaceMemberPermissionsV2).mockResolvedValueOnce({
        updatedCount: 2,
      })

      const result = await TaskPermissionService.batchUpdateMemberPermissions({
        updates: [
          { memberId: 10, permissions: ['manage_news'] },
          { memberId: 20, permissions: ['manage_rdu', 'manage_rdu'] },
        ],
        performedBy: 'admin01',
      })

      expect(result.success).toBe(true)
      expect(result.updatedCount).toBe(2)
      expect(apiGateway.app.batchReplaceMemberPermissionsV2).toHaveBeenCalledWith({
        updates: [
          { memberId: 10, permissions: ['manage_news'] },
          { memberId: 20, permissions: ['manage_rdu'] },
        ],
        performedBy: 'admin01',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'BATCH_UPDATE_MEMBER_PERMISSIONS',
        'members',
        expect.stringContaining('"updatedCount":2'),
        expect.objectContaining({ username: 'admin01' })
      )
    })
  })
})
