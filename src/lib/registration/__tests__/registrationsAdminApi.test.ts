import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as listRegistrations } from '@/app/api/member/registrations/route'
import { GET as getRegistration, PUT as updateRegistration, DELETE as deleteRegistration } from '@/app/api/member/registrations/[id]/route'
import { POST as approveRegistration } from '@/app/api/member/registrations/[id]/approve/route'
import { POST as rejectRegistration } from '@/app/api/member/registrations/[id]/reject/route'
import { requireMemberApi } from '@/lib/memberAuth'
import { registrationService } from '@/lib/registration/registrationService.default'

vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: vi.fn(),
}))

vi.mock('@/lib/registration/registrationService.default', () => ({
  registrationService: {
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('Member Registrations Admin API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/member/registrations', () => {
    it('returns 401/403 when not authenticated or not admin', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as any,
      } as any)

      const req = new Request('http://localhost:3000/api/member/registrations')
      const res = await listRegistrations(req)
      expect(res.status).toBe(401)
    })

    it('returns registrations list when admin is authenticated', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        member: { id: 1, username: 'admin1', email: 'admin@test.com', role: 'admin' } as any,
      } as any)
      vi.mocked(registrationService.list).mockResolvedValue({
        items: [{ id: 1, citizenId: '1234567890123' } as any],
        total: 1,
      })

      const req = new Request('http://localhost:3000/api/member/registrations?status=pending&search=test')
      const res = await listRegistrations(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.total).toBe(1)
      expect(registrationService.list).toHaveBeenCalledWith({
        status: 'pending',
        search: 'test',
        page: 1,
        limit: 50,
      })
    })
  })

  describe('GET /api/member/registrations/[id]', () => {
    it('returns registration detail by id', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        member: { id: 1, username: 'admin1', email: 'admin@test.com', role: 'admin' } as any,
      } as any)
      vi.mocked(registrationService.getById).mockResolvedValue({ id: 5, citizenId: '1234567890123' } as any)

      const req = new Request('http://localhost:3000/api/member/registrations/5')
      const res = await getRegistration(req, { params: Promise.resolve({ id: '5' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(5)
    })
  })

  describe('PUT /api/member/registrations/[id]', () => {
    it('updates registration data', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        member: { id: 1, username: 'admin1', email: 'admin@test.com', role: 'admin' } as any,
      } as any)
      vi.mocked(registrationService.update).mockResolvedValue({ ok: true, data: undefined })

      const req = new Request('http://localhost:3000/api/member/registrations/5', {
        method: 'PUT',
        body: JSON.stringify({ firstNameTh: 'สมชายใหม่' }),
      })
      const res = await updateRegistration(req, { params: Promise.resolve({ id: '5' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(registrationService.update).toHaveBeenCalledWith(5, { firstNameTh: 'สมชายใหม่' }, { username: 'admin1', email: 'admin@test.com' })
    })
  })

  describe('POST /api/member/registrations/[id]/approve', () => {
    it('approves registration', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        member: { id: 1, username: 'admin1', email: 'admin@test.com', role: 'admin' } as any,
      } as any)
      vi.mocked(registrationService.approve).mockResolvedValue({ ok: true, data: undefined })

      const req = new Request('http://localhost:3000/api/member/registrations/5/approve', { method: 'POST' })
      const res = await approveRegistration(req, { params: Promise.resolve({ id: '5' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(registrationService.approve).toHaveBeenCalledWith(5, { username: 'admin1', email: 'admin@test.com' })
    })
  })

  describe('POST /api/member/registrations/[id]/reject', () => {
    it('rejects registration with reason', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        member: { id: 1, username: 'admin1', email: 'admin@test.com', role: 'admin' } as any,
      } as any)
      vi.mocked(registrationService.reject).mockResolvedValue({ ok: true, data: undefined })

      const req = new Request('http://localhost:3000/api/member/registrations/5/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: 'เอกสารไม่ครบถ้วน' }),
      })
      const res = await rejectRegistration(req, { params: Promise.resolve({ id: '5' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(registrationService.reject).toHaveBeenCalledWith(5, 'เอกสารไม่ครบถ้วน', { username: 'admin1', email: 'admin@test.com' })
    })
  })

  describe('DELETE /api/member/registrations/[id]', () => {
    it('deletes registration', async () => {
      vi.mocked(requireMemberApi).mockResolvedValue({
        member: { id: 1, username: 'admin1', email: 'admin@test.com', role: 'admin' } as any,
      } as any)
      vi.mocked(registrationService.delete).mockResolvedValue({ ok: true, data: undefined })

      const req = new Request('http://localhost:3000/api/member/registrations/5', { method: 'DELETE' })
      const res = await deleteRegistration(req, { params: Promise.resolve({ id: '5' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(registrationService.delete).toHaveBeenCalledWith(5, { username: 'admin1', email: 'admin@test.com' })
    })
  })
})
