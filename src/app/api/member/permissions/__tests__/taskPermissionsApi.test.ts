import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyMemberSession = vi.fn()
const mockGetTaskCentricData = vi.fn()
const mockGrantMemberPermission = vi.fn()
const mockGrantPositionPermission = vi.fn()
const mockRevokeMemberPermission = vi.fn()
const mockRevokePositionPermission = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => mockVerifyMemberSession(),
}))

vi.mock('@/lib/permissions/taskPermissionService', () => ({
  TaskPermissionService: {
    getTaskCentricData: () => mockGetTaskCentricData(),
    grantMemberPermission: (...args: any[]) => mockGrantMemberPermission(...args),
    grantPositionPermission: (...args: any[]) => mockGrantPositionPermission(...args),
    revokeMemberPermission: (...args: any[]) => mockRevokeMemberPermission(...args),
    revokePositionPermission: (...args: any[]) => mockRevokePositionPermission(...args),
  },
  TASK_DEFINITIONS: [],
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Task Permissions API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/member/permissions/tasks', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce(null)

      const { GET } = await import('../tasks/route')
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.error).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน')
    })

    it('returns 200 and task-centric data for admin', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      const mockData = {
        tasks: [{ id: 'MEDIA_REQUEST', name: 'งานขอสื่อ' }],
        assignments: [],
        members: [],
        availablePositions: ['นักประชาสัมพันธ์'],
        positionMappings: [],
      }
      mockGetTaskCentricData.mockResolvedValueOnce(mockData)

      const { GET } = await import('../tasks/route')
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.tasks[0].id).toBe('MEDIA_REQUEST')
    })
  })

  describe('POST /api/member/permissions/grant', () => {
    it('grants permission to member', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockGrantMemberPermission.mockResolvedValueOnce({
        success: true,
        message: 'เพิ่มสิทธิ์สำเร็จ',
      })

      const { POST } = await import('../grant/route')
      const request = new Request('http://localhost/api/member/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'member',
          memberId: 10,
          permissionKey: 'produce_media',
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockGrantMemberPermission).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin01' }),
        10,
        'produce_media'
      )
    })

    it('grants permission to position', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockGrantPositionPermission.mockResolvedValueOnce({
        success: true,
        message: 'เพิ่มสิทธิ์สำหรับตำแหน่งสำเร็จ',
      })

      const { POST } = await import('../grant/route')
      const request = new Request('http://localhost/api/member/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'position',
          positionName: 'นักประชาสัมพันธ์',
          permissionKey: 'produce_media',
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockGrantPositionPermission).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin01' }),
        'นักประชาสัมพันธ์',
        'produce_media'
      )
    })
  })

  describe('POST /api/member/permissions/revoke', () => {
    it('revokes permission from member', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockRevokeMemberPermission.mockResolvedValueOnce({
        success: true,
        message: 'ปลดสิทธิ์สำเร็จ',
      })

      const { POST } = await import('../revoke/route')
      const request = new Request('http://localhost/api/member/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'member',
          memberId: 10,
          permissionKey: 'produce_media',
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockRevokeMemberPermission).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin01' }),
        10,
        'produce_media'
      )
    })

    it('revokes permission from position', async () => {
      mockVerifyMemberSession.mockResolvedValueOnce({
        username: 'admin01',
        email: 'admin@thoen.go.th',
        role: 'admin',
      })

      mockRevokePositionPermission.mockResolvedValueOnce({
        success: true,
        message: 'ปลดสิทธิ์สำเร็จ',
      })

      const { POST } = await import('../revoke/route')
      const request = new Request('http://localhost/api/member/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'position',
          positionName: 'นักประชาสัมพันธ์',
          permissionKey: 'produce_media',
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockRevokePositionPermission).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin01' }),
        'นักประชาสัมพันธ์',
        'produce_media'
      )
    })
  })
})
