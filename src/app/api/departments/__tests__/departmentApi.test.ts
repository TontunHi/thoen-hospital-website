import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getGroups, POST as createGroup } from '../groups/route'
import { PUT as updateGroup, DELETE as deleteGroup } from '../groups/[id]/route'
import { GET as getMembers, POST as createMember } from '../members/route'
import { PATCH as reorderMembers } from '../members/reorder/route'
import { GET as getPublicOrgChart } from '../public/route'
import { GET as searchPublicStaff } from '../public/search/route'
import { departmentService } from '@/lib/departments/departmentService'
import * as memberAuth from '@/lib/memberAuth'
import { NextResponse } from 'next/server'

vi.mock('@/lib/departments/departmentService')
vi.mock('@/lib/memberAuth')
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined)
}))

describe('Department API Routes', () => {
  const adminMember = {
    id: 1,
    username: '1234567890123',
    email: 'admin@thoen.go.th',
    name: 'Admin Test',
    role: 'admin',
    department: 'บริหาร'
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Groups API', () => {
    it('GET /api/departments/groups returns full tree', async () => {
      vi.mocked(departmentService.getGroupTree).mockResolvedValueOnce([
        { id: 1, name: 'การพยาบาล', parentId: null, orderIndex: 0, isActive: true, children: [] }
      ])

      const res = await getGroups()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
    })

    it('POST /api/departments/groups rejects non-admin users', async () => {
      vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({
        error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
      } as any)

      const req = new Request('http://localhost/api/departments/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'กลุ่มงานใหม่' })
      })

      const res = await createGroup(req)
      expect(res.status).toBe(403)
    })

    it('POST /api/departments/groups creates group for admin', async () => {
      vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({ member: adminMember } as any)
      vi.mocked(departmentService.createGroup).mockResolvedValueOnce({
        id: 10,
        name: 'กลุ่มงานใหม่',
        parentId: null,
        orderIndex: 0,
        isActive: true
      })

      const req = new Request('http://localhost/api/departments/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'กลุ่มงานใหม่' })
      })

      const res = await createGroup(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(10)
    })

    it('DELETE /api/departments/groups/[id] returns error if deletion fails', async () => {
      vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({ member: adminMember } as any)
      vi.mocked(departmentService.deleteGroup).mockRejectedValueOnce(
        new Error('ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากยังมีสมาชิกอยู่ภายในกลุ่มงาน')
      )

      const req = new Request('http://localhost/api/departments/groups/1', { method: 'DELETE' })
      const res = await deleteGroup(req, { params: Promise.resolve({ id: '1' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('ยังมีสมาชิกอยู่')
    })
  })

  describe('Members API', () => {
    it('GET /api/departments/members requires groupId param', async () => {
      const req = new Request('http://localhost/api/departments/members')
      const res = await getMembers(req)
      expect(res.status).toBe(400)
    })

    it('POST /api/departments/members creates member for admin', async () => {
      vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({ member: adminMember } as any)
      vi.mocked(departmentService.createMember).mockResolvedValueOnce({
        id: 99,
        groupId: 1,
        name: 'สมชาย ใจดี',
        position: 'พยาบาล',
        role: 'member',
        orderIndex: 0,
        imagePath: null
      })

      const req = new Request('http://localhost/api/departments/members', {
        method: 'POST',
        body: JSON.stringify({
          groupId: 1,
          name: 'สมชาย ใจดี',
          position: 'พยาบาล'
        })
      })

      const res = await createMember(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(99)
    })

    it('PATCH /api/departments/members/reorder reorders successfully', async () => {
      vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({ member: adminMember } as any)
      vi.mocked(departmentService.reorderMembers).mockResolvedValueOnce(true)

      const req = new Request('http://localhost/api/departments/members/reorder', {
        method: 'PATCH',
        body: JSON.stringify({
          groupId: 1,
          memberIds: [2, 1, 3]
        })
      })

      const res = await reorderMembers(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('Public API', () => {
    it('GET /api/departments/public returns org chart for guests', async () => {
      vi.mocked(departmentService.getPublicOrgChart).mockResolvedValueOnce([
        { id: 1, name: 'การพยาบาล', members: [], children: [] }
      ])

      const res = await getPublicOrgChart()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
    })

    it('GET /api/departments/public/search returns empty for short queries', async () => {
      const req = new Request('http://localhost/api/departments/public/search?q=a')
      const res = await searchPublicStaff(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toEqual([])
    })
  })
})
