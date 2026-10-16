import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyMemberSession = vi.fn()
const mockBatchUpdateMemberPermissions = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => mockVerifyMemberSession(),
}))

vi.mock('@/lib/permissions/taskPermissionService', () => ({
  TaskPermissionService: {
    batchUpdateMemberPermissions: (...args: any[]) => mockBatchUpdateMemberPermissions(...args),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('POST /api/member/permissions/batch-update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce(null)

    const { POST } = await import('../batch-update/route')
    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          { memberId: 1, permissions: ['take_repairs_it'] },
        ],
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน')
  })

  it('returns 403 when authenticated user is not admin', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce({
      username: 'nurse_user',
      email: 'nurse@thoen.go.th',
      role: 'nurse',
    })

    const { POST } = await import('../batch-update/route')
    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          { memberId: 1, permissions: ['take_repairs_it'] },
        ],
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toBe('คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้')
  })

  it('returns 400 when request body is malformed JSON', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce({
      username: 'admin01',
      email: 'admin@thoen.go.th',
      role: 'admin',
    })

    const { POST } = await import('../batch-update/route')
    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json-payload',
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toBe('รูปแบบข้อมูลไม่ถูกต้อง')
  })

  it('returns 400 when updates array is empty or missing', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce({
      username: 'admin01',
      email: 'admin@thoen.go.th',
      role: 'admin',
    })

    const { POST } = await import('../batch-update/route')
    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [] }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toBe('ข้อมูลไม่ถูกต้อง')
  })

  it('returns 400 when an item has invalid memberId or permissions schema', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce({
      username: 'admin01',
      email: 'admin@thoen.go.th',
      role: 'admin',
    })

    const { POST } = await import('../batch-update/route')
    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          { memberId: -5, permissions: ['valid_perm'] },
        ],
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toBe('ข้อมูลไม่ถูกต้อง')
  })

  it('returns 200 and performs atomic batch updates across multiple members with audit log', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce({
      username: 'admin01',
      email: 'admin@thoen.go.th',
      role: 'admin',
    })

    mockBatchUpdateMemberPermissions.mockResolvedValueOnce({
      success: true,
      message: 'บันทึกสิทธิ์แบบกลุ่มเรียบร้อยแล้ว',
      updatedCount: 3,
    })

    const { POST } = await import('../batch-update/route')
    const payload = {
      updates: [
        {
          memberId: 10,
          permissions: ['take_repairs_it', 'manage_repairs', 'take_repairs_it'],
        },
        {
          memberId: 20,
          permissions: ['approve_repairs', 'view_all_work'],
        },
        {
          memberId: 30,
          permissions: [],
        },
      ],
    }

    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.updatedCount).toBe(3)

    expect(mockBatchUpdateMemberPermissions).toHaveBeenCalledWith({
      updates: payload.updates,
      performedBy: 'admin01',
    })
  })

  it('returns 500 when transaction encounters a database error', async () => {
    mockVerifyMemberSession.mockResolvedValueOnce({
      username: 'admin01',
      email: 'admin@thoen.go.th',
      role: 'admin',
    })

    mockBatchUpdateMemberPermissions.mockRejectedValueOnce(new Error('Deadlock detected'))

    const { POST } = await import('../batch-update/route')
    const payload = {
      updates: [
        { memberId: 10, permissions: ['take_repairs_it'] },
      ],
    }

    const request = new Request('http://localhost/api/member/permissions/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toBe('เกิดข้อผิดพลาดในการบันทึกสิทธิ์')
  })
})
