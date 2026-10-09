import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../prisma'

vi.mock('../prisma', () => {
  return {
    prisma: {
      memberPermission: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
      member: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    },
  }
})

describe('MemberPermission DB Model & Prisma Delegate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries member permissions by memberId', async () => {
    const mockPermissions = [
      {
        id: 1,
        memberId: 42,
        permissionKey: 'cctv_request_manage',
        createdAt: new Date('2026-10-09T00:00:00Z'),
        createdBy: 'admin',
      },
      {
        id: 2,
        memberId: 42,
        permissionKey: 'upload_salary',
        createdAt: new Date('2026-10-09T00:00:00Z'),
        createdBy: 'admin',
      },
    ]

    vi.mocked(prisma.memberPermission.findMany).mockResolvedValueOnce(mockPermissions)

    const permissions = await prisma.memberPermission.findMany({
      where: { memberId: 42 },
    })

    expect(prisma.memberPermission.findMany).toHaveBeenCalledWith({
      where: { memberId: 42 },
    })
    expect(permissions).toHaveLength(2)
    expect(permissions[0].permissionKey).toBe('cctv_request_manage')
    expect(permissions[1].permissionKey).toBe('upload_salary')
  })

  it('queries members with a specific permissionKey', async () => {
    const mockRecords = [
      {
        id: 10,
        memberId: 101,
        permissionKey: 'cctv_request_manage',
        createdAt: new Date('2026-10-09T00:00:00Z'),
        createdBy: 'superadmin',
      },
    ]

    vi.mocked(prisma.memberPermission.findMany).mockResolvedValueOnce(mockRecords)

    const records = await prisma.memberPermission.findMany({
      where: { permissionKey: 'cctv_request_manage' },
    })

    expect(prisma.memberPermission.findMany).toHaveBeenCalledWith({
      where: { permissionKey: 'cctv_request_manage' },
    })
    expect(records).toHaveLength(1)
    expect(records[0].memberId).toBe(101)
  })

  it('creates a new member permission entry', async () => {
    const newEntry = {
      id: 5,
      memberId: 99,
      permissionKey: 'repair_manage',
      createdAt: new Date('2026-10-09T00:00:00Z'),
      createdBy: 'director',
    }

    vi.mocked(prisma.memberPermission.create).mockResolvedValueOnce(newEntry)

    const result = await prisma.memberPermission.create({
      data: {
        memberId: 99,
        permissionKey: 'repair_manage',
        createdBy: 'director',
      },
    })

    expect(prisma.memberPermission.create).toHaveBeenCalledWith({
      data: {
        memberId: 99,
        permissionKey: 'repair_manage',
        createdBy: 'director',
      },
    })
    expect(result.id).toBe(5)
    expect(result.memberId).toBe(99)
    expect(result.permissionKey).toBe('repair_manage')
    expect(result.createdBy).toBe('director')
  })

  it('deletes member permissions on revoke', async () => {
    vi.mocked(prisma.memberPermission.deleteMany).mockResolvedValueOnce({ count: 1 })

    const result = await prisma.memberPermission.deleteMany({
      where: {
        memberId: 99,
        permissionKey: 'repair_manage',
      },
    })

    expect(prisma.memberPermission.deleteMany).toHaveBeenCalledWith({
      where: {
        memberId: 99,
        permissionKey: 'repair_manage',
      },
    })
    expect(result.count).toBe(1)
  })

  it('queries member with member_permissions relation included', async () => {
    const mockMemberWithPerms = {
      id: 42,
      username: '1234567890123',
      name: 'John Doe',
      role: 'member',
      member_permissions: [
        {
          id: 1,
          memberId: 42,
          permissionKey: 'cctv_request_manage',
          createdAt: new Date('2026-10-09T00:00:00Z'),
          createdBy: 'admin',
        },
      ],
    }

    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(mockMemberWithPerms as any)

    const member = await prisma.member.findUnique({
      where: { id: 42 },
      include: { member_permissions: true },
    })

    expect(prisma.member.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      include: { member_permissions: true },
    })
    expect(member?.member_permissions).toHaveLength(1)
    expect(member?.member_permissions[0].permissionKey).toBe('cctv_request_manage')
  })
})
