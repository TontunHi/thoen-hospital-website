import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyMemberSession = vi.fn()
const mockMemberFindMany = vi.fn()
const mockMemberPermissionDeleteMany = vi.fn()
const mockMemberPermissionCreateMany = vi.fn()
const mockLogAudit = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => mockVerifyMemberSession(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    member: {
      findMany: (...args: any[]) => mockMemberFindMany(...args),
    },
    memberPermission: {
      deleteMany: (...args: any[]) => mockMemberPermissionDeleteMany(...args),
      createMany: (...args: any[]) => mockMemberPermissionCreateMany(...args),
    },
    $transaction: async (cb: any) => {
      if (typeof cb === 'function') {
        return await cb({
          memberPermission: {
            deleteMany: (...args: any[]) => mockMemberPermissionDeleteMany(...args),
            createMany: (...args: any[]) => mockMemberPermissionCreateMany(...args),
          },
        })
      }
      return cb
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: (...args: any[]) => mockLogAudit(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Member Permissions API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/member/permissions/members', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce(null)

      const { GET } = await import('../members/route')
      const request = new Request('http://localhost/api/member/permissions/members')
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.error).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน')
    })

    it('returns 403 when user is authenticated but not admin', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'user123',
        email: 'user@thoen.go.th',
        role: 'member',
      })

      const { GET } = await import('../members/route')
      const request = new Request('http://localhost/api/member/permissions/members')
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.error).toBe('คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้')
    })

    it('returns 200 and mapped members with permissions for admin', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      const mockDbMembers = [
        {
          id: 1,
          username: '1234567890123',
          name: 'นายแพทย์ สมชาย ใจดี',
          department: 'กลุ่มงานการแพทย์',
          position: 'นายแพทย์ชำนาญการ',
          role: 'member',
          member_permissions: [
            { permissionKey: 'approve_repairs' },
            { permissionKey: 'view_all_work' },
          ],
        },
        {
          id: 2,
          username: '9876543210987',
          name: 'นางสาว สมศรี รักงาน',
          department: 'ศูนย์คอมพิวเตอร์',
          position: 'นักวิชาการคอมพิวเตอร์',
          role: 'member',
          member_permissions: [
            { permissionKey: 'take_repairs_it' },
            { permissionKey: 'manage_repairs' },
          ],
        },
        {
          id: 3,
          username: '1111222233334',
          name: 'นาย สมศักดิ์ มีสุข',
          department: 'กลุ่มงานบริหารทั่วไป',
          position: 'เจ้าพนักงานธุรการ',
          role: 'member',
          member_permissions: [],
        },
      ]

      mockMemberFindMany.mockResolvedValueOnce(mockDbMembers)

      const { GET } = await import('../members/route')
      const request = new Request('http://localhost/api/member/permissions/members')
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.members).toHaveLength(3)

      expect(json.data.members[0]).toEqual({
        id: 1,
        username: '1234567890123',
        name: 'นายแพทย์ สมชาย ใจดี',
        department: 'กลุ่มงานการแพทย์',
        position: 'นายแพทย์ชำนาญการ',
        role: 'member',
        permissions: ['approve_repairs', 'view_all_work'],
      })

      expect(json.data.members[1].permissions).toEqual(['take_repairs_it', 'manage_repairs'])
      expect(json.data.members[2].permissions).toEqual([])
    })

    it('filters by search parameter across name, username, and department', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockMemberFindMany.mockResolvedValueOnce([])

      const { GET } = await import('../members/route')
      const request = new Request('http://localhost/api/member/permissions/members?search=สมชาย')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockMemberFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'สมชาย' } },
            { username: { contains: 'สมชาย' } },
            { department: { contains: 'สมชาย' } },
          ],
        },
        select: expect.any(Object),
        orderBy: expect.any(Array),
      })
    })

    it('filters by hasPermissionsOnly parameter', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockMemberFindMany.mockResolvedValueOnce([])

      const { GET } = await import('../members/route')
      const request = new Request('http://localhost/api/member/permissions/members?hasPermissionsOnly=true')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockMemberFindMany).toHaveBeenCalledWith({
        where: {
          member_permissions: {
            some: {},
          },
        },
        select: expect.any(Object),
        orderBy: expect.any(Array),
      })
    })

    it('handles database error gracefully with 500', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockMemberFindMany.mockRejectedValueOnce(new Error('DB Connection Failed'))

      const { GET } = await import('../members/route')
      const request = new Request('http://localhost/api/member/permissions/members')
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.success).toBe(false)
      expect(json.error).toBe('เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์บุคลากร')
    })
  })

  describe('POST /api/member/permissions/update', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce(null)

      const { POST } = await import('../update/route')
      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 1, permissions: ['take_repairs_it'] }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.error).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน')
    })

    it('returns 403 when authenticated user is not admin', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'regular_user',
        email: 'user@thoen.go.th',
        role: 'member',
      })

      const { POST } = await import('../update/route')
      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 1, permissions: ['take_repairs_it'] }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.error).toBe('คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้')
    })

    it('returns 400 when body schema is invalid', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      const { POST } = await import('../update/route')
      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 'invalid-id', permissions: 'not-an-array' }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toBe('ข้อมูลไม่ถูกต้อง')
      expect(json.details).toBeDefined()
    })

    it('returns 400 when body contains malformed JSON', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      const { POST } = await import('../update/route')
      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-string',
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toBe('รูปแบบข้อมูลไม่ถูกต้อง')
    })

    it('returns 200 and performs atomic replacement with audit logging', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockMemberPermissionDeleteMany.mockResolvedValueOnce({ count: 2 })
      mockMemberPermissionCreateMany.mockResolvedValueOnce({ count: 3 })

      const { POST } = await import('../update/route')
      const payload = {
        memberId: 42,
        permissions: ['take_repairs_it', 'manage_repairs', 'view_all_work'],
      }

      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.message).toBe('บันทึกสิทธิ์เรียบร้อยแล้ว')

      // Verify deleteMany called with memberId
      expect(mockMemberPermissionDeleteMany).toHaveBeenCalledWith({
        where: { memberId: 42 },
      })

      // Verify createMany called with unique permissions and createdBy
      expect(mockMemberPermissionCreateMany).toHaveBeenCalledWith({
        data: [
          { memberId: 42, permissionKey: 'take_repairs_it', createdBy: 'admin01' },
          { memberId: 42, permissionKey: 'manage_repairs', createdBy: 'admin01' },
          { memberId: 42, permissionKey: 'view_all_work', createdBy: 'admin01' },
        ],
      })

      // Verify logAudit called
      expect(mockLogAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'members',
        'Updated permissions for member 42',
        expect.objectContaining({
          memberId: 42,
          permissions: ['take_repairs_it', 'manage_repairs', 'view_all_work'],
          admin: 'admin01',
        })
      )
    })

    it('successfully clears all permissions when permissions array is empty', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockMemberPermissionDeleteMany.mockResolvedValueOnce({ count: 5 })

      const { POST } = await import('../update/route')
      const payload = {
        memberId: 42,
        permissions: [],
      }

      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockMemberPermissionDeleteMany).toHaveBeenCalledWith({
        where: { memberId: 42 },
      })
      expect(mockMemberPermissionCreateMany).not.toHaveBeenCalled()

      expect(mockLogAudit).toHaveBeenCalledWith(
        'UPDATE_MEMBER_PERMISSIONS',
        'members',
        'Updated permissions for member 42',
        expect.objectContaining({
          memberId: 42,
          permissions: [],
          admin: 'admin01',
        })
      )
    })

    it('handles database error in update transaction with 500', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockMemberPermissionDeleteMany.mockRejectedValueOnce(new Error('Transaction Rollback'))

      const { POST } = await import('../update/route')
      const request = new Request('http://localhost/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 42, permissions: ['take_repairs_it'] }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.success).toBe(false)
      expect(json.error).toBe('เกิดข้อผิดพลาดในการบันทึกสิทธิ์')
    })
  })
})
