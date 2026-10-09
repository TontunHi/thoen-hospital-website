import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskPermissionService, TASK_DEFINITIONS } from '../taskPermissionService'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    member: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    memberPermission: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    positionPermission: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === 'function') {
        return await cb(mockPrisma)
      }
      return cb
    }),
  }
  return { prisma: mockPrisma }
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
      const mockDbMembers = [
        {
          id: 10,
          username: '1234567890123',
          name: 'สมศรี นักออกแบบ',
          department: 'ศูนย์คอมพิวเตอร์',
          position: 'นักประชาสัมพันธ์',
          role: 'member',
          member_permissions: [{ permissionKey: 'produce_media' }],
        },
        {
          id: 20,
          username: '9876543210987',
          name: 'สมชาย หัวหน้างาน',
          department: 'กลุ่มงานบริหารทั่วไป',
          position: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
          role: 'member',
          member_permissions: [{ permissionKey: 'approve_media' }],
        },
      ]

      const mockPositionPerms = [
        { id: 1, permissionKey: 'produce_media', positionName: 'นักประชาสัมพันธ์' },
      ]

      vi.mocked(prisma.member.findMany).mockResolvedValueOnce(mockDbMembers as any)
      vi.mocked(prisma.positionPermission.findMany).mockResolvedValueOnce(mockPositionPerms as any)

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
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
        id: 10,
        name: 'สมศรี',
        username: 'somsri',
      } as any)

      vi.mocked(prisma.memberPermission.upsert).mockResolvedValueOnce({} as any)

      const result = await TaskPermissionService.grantMemberPermission(
        mockAdminSession,
        10,
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(prisma.memberPermission.upsert).toHaveBeenCalledWith({
        where: {
          memberId_permissionKey: {
            memberId: 10,
            permissionKey: 'produce_media',
          },
        },
        update: {},
        create: {
          memberId: 10,
          permissionKey: 'produce_media',
          createdBy: 'admin01',
        },
      })
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'member_permissions',
        expect.stringContaining('Granted permission produce_media to member สมศรี'),
        expect.any(Object)
      )
    })

    it('throws error when member is not found', async () => {
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null)

      await expect(
        TaskPermissionService.grantMemberPermission(mockAdminSession, 999, 'produce_media')
      ).rejects.toThrow('ไม่พบบุคลากรที่ระบุ')
    })
  })

  describe('revokeMemberPermission', () => {
    it('deletes member permission and writes audit log', async () => {
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
        id: 10,
        name: 'สมศรี',
        username: 'somsri',
      } as any)

      vi.mocked(prisma.memberPermission.deleteMany).mockResolvedValueOnce({ count: 1 })

      const result = await TaskPermissionService.revokeMemberPermission(
        mockAdminSession,
        10,
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(prisma.memberPermission.deleteMany).toHaveBeenCalledWith({
        where: {
          memberId: 10,
          permissionKey: 'produce_media',
        },
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
    it('creates position permission mapping if not exists and logs audit', async () => {
      vi.mocked(prisma.positionPermission.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.positionPermission.create).mockResolvedValueOnce({} as any)

      const result = await TaskPermissionService.grantPositionPermission(
        mockAdminSession,
        'นักประชาสัมพันธ์',
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(prisma.positionPermission.create).toHaveBeenCalledWith({
        data: {
          positionName: 'นักประชาสัมพันธ์',
          permissionKey: 'produce_media',
        },
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
      vi.mocked(prisma.positionPermission.deleteMany).mockResolvedValueOnce({ count: 1 } as any)

      const result = await TaskPermissionService.revokePositionPermission(
        mockAdminSession,
        'นักประชาสัมพันธ์',
        'produce_media'
      )

      expect(result.success).toBe(true)
      expect(prisma.positionPermission.deleteMany).toHaveBeenCalledWith({
        where: {
          positionName: 'นักประชาสัมพันธ์',
          permissionKey: 'produce_media',
        },
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
    it('atomically replaces member permissions in transaction and logs audit', async () => {
      vi.mocked(prisma.memberPermission.deleteMany).mockResolvedValueOnce({ count: 2 } as any)
      vi.mocked(prisma.memberPermission.createMany).mockResolvedValueOnce({ count: 2 } as any)

      const result = await TaskPermissionService.updateMemberPermissions({
        memberId: 10,
        permissions: ['take_repairs_it', 'manage_repairs', 'take_repairs_it'],
        performedBy: 'admin01',
      })

      expect(result.success).toBe(true)
      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.memberPermission.deleteMany).toHaveBeenCalledWith({
        where: { memberId: 10 },
      })
      expect(prisma.memberPermission.createMany).toHaveBeenCalledWith({
        data: [
          { memberId: 10, permissionKey: 'take_repairs_it', createdBy: 'admin01' },
          { memberId: 10, permissionKey: 'manage_repairs', createdBy: 'admin01' },
        ],
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
      vi.mocked(prisma.memberPermission.deleteMany).mockResolvedValueOnce({ count: 1 } as any)

      const result = await TaskPermissionService.updateMemberPermissions({
        memberId: 10,
        permissions: [],
        performedBy: 'admin01',
      })

      expect(result.success).toBe(true)
      expect(prisma.memberPermission.deleteMany).toHaveBeenCalledWith({
        where: { memberId: 10 },
      })
      expect(prisma.memberPermission.createMany).not.toHaveBeenCalled()
    })
  })

  describe('batchUpdateMemberPermissions', () => {
    it('atomically updates multiple members in a single transaction and logs audit', async () => {
      vi.mocked(prisma.memberPermission.deleteMany).mockResolvedValue({ count: 1 } as any)
      vi.mocked(prisma.memberPermission.createMany).mockResolvedValue({ count: 1 } as any)

      const updates = [
        { memberId: 10, permissions: ['take_repairs_it'] },
        { memberId: 20, permissions: ['approve_repairs', 'view_all_work'] },
        { memberId: 30, permissions: [] },
      ]

      const result = await TaskPermissionService.batchUpdateMemberPermissions({
        updates,
        performedBy: 'admin01',
      })

      expect(result.success).toBe(true)
      expect(result.updatedCount).toBe(3)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.memberPermission.deleteMany).toHaveBeenCalledTimes(3)
      expect(prisma.memberPermission.createMany).toHaveBeenCalledTimes(2)

      expect(logAudit).toHaveBeenCalledWith(
        'BATCH_UPDATE_MEMBER_PERMISSIONS',
        'members',
        JSON.stringify({ updatedCount: 3, memberIds: [10, 20, 30] }),
        expect.objectContaining({ username: 'admin01' })
      )
    })
  })

  describe('listMembersWithPermissions', () => {
    it('returns formatted members with search, department, and hasPermissionsOnly filters', async () => {
      const mockMembers = [
        {
          id: 1,
          username: '1234567890123',
          name: 'นายแพทย์ สมชาย',
          department: 'การแพทย์',
          position: 'แพทย์',
          role: 'member',
          member_permissions: [{ permissionKey: 'approve_repairs' }],
        },
      ]

      vi.mocked(prisma.member.findMany).mockResolvedValueOnce(mockMembers as any)

      const result = await TaskPermissionService.listMembersWithPermissions({
        query: 'สมชาย',
        department: 'การแพทย์',
        hasPermissionsOnly: true,
      })

      expect(result.members).toHaveLength(1)
      expect(result.members[0]).toEqual({
        id: 1,
        username: '1234567890123',
        name: 'นายแพทย์ สมชาย',
        department: 'การแพทย์',
        position: 'แพทย์',
        role: 'member',
        permissions: ['approve_repairs'],
      })

      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'สมชาย' } },
            { username: { contains: 'สมชาย' } },
            { department: { contains: 'สมชาย' } },
          ],
          department: 'การแพทย์',
          member_permissions: {
            some: {},
          },
        },
        select: expect.any(Object),
        orderBy: expect.any(Array),
      })
    })
  })
})
