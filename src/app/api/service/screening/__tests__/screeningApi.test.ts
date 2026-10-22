import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getQueues, POST as createQueue } from '../route'
import {
  GET as getQueueDetail,
  PATCH as updateQueueStatus,
  POST as updateQueuePost,
  DELETE as cancelQueueDelete,
} from '../[id]/route'
import * as memberAuth from '@/lib/memberAuth'
import { screeningQueueService } from '@/lib/screening/screeningService'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/screening/screeningService', () => ({
  screeningQueueService: {
    getQueues: vi.fn(),
    getQueueById: vi.fn(),
    addToQueue: vi.fn(),
    updateQueueStatus: vi.fn(),
  },
}))

describe('Screening Queue API Routes', () => {
  const mockMember = {
    id: 1,
    username: 'staff01',
    name: 'เจ้าหน้าที่ ทดสอบ',
    role: 'member',
    email: 'staff01@thoenhospital.com',
    department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/service/screening', () => {
    it('returns 401 when not authenticated', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        error: NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' } },
          { status: 401 }
        ),
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening')
      const res = await getQueues(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('returns 200 with queue items when authenticated', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      vi.mocked(screeningQueueService.getQueues).mockResolvedValue({
        date: '2026-10-14',
        total: 1,
        items: [{ id: 1, cid: '1529900123456', fullName: 'นายทดสอบ', status: 'WAITING' }] as any,
      })

      const req = new NextRequest('http://localhost:3000/api/service/screening?date=today')
      const res = await getQueues(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items.length).toBe(1)
    })
  })

  describe('POST /api/service/screening', () => {
    it('returns 400 when cid is missing or invalid', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      const req = new NextRequest('http://localhost:3000/api/service/screening', {
        method: 'POST',
        body: JSON.stringify({ cid: '123' }),
      })
      const res = await createQueue(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 201 when valid data is posted', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      vi.mocked(screeningQueueService.addToQueue).mockResolvedValue({
        id: 1,
        cid: '1529900123456',
        fullName: 'นายสมศักดิ์ ทดสอบ',
        status: 'WAITING',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening', {
        method: 'POST',
        body: JSON.stringify({
          cid: '1529900123456',
          fullName: 'นายสมศักดิ์ ทดสอบ',
        }),
      })
      const res = await createQueue(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(1)
    })
  })

  describe('GET /api/service/screening/[id]', () => {
    it('returns 404 when item is not found', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })
      vi.mocked(screeningQueueService.getQueueById).mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/service/screening/999')
      const res = await getQueueDetail(req, { params: Promise.resolve({ id: '999' }) })
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 200 with item details', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })
      vi.mocked(screeningQueueService.getQueueById).mockResolvedValue({
        id: 1,
        cid: '1529900123456',
        fullName: 'นายสมศักดิ์',
        rawPayload: '{"test":true}',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening/1')
      const res = await getQueueDetail(req, { params: Promise.resolve({ id: '1' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(1)
    })
  })

  describe('PATCH /api/service/screening/[id]', () => {
    it('returns 200 when updating status to VISIT_OPENED', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      vi.mocked(screeningQueueService.updateQueueStatus).mockResolvedValue({
        id: 1,
        status: 'VISIT_OPENED',
        vn: '691014120001',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening/1', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'VISIT_OPENED',
          vn: '691014120001',
        }),
      })

      const res = await updateQueueStatus(req, { params: Promise.resolve({ id: '1' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('VISIT_OPENED')
    })

    it('supports POST /api/service/screening/[id] for proxy compatibility', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      vi.mocked(screeningQueueService.updateQueueStatus).mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening/1', {
        method: 'POST',
        body: JSON.stringify({
          status: 'CANCELLED',
        }),
      })

      const res = await updateQueuePost(req, { params: Promise.resolve({ id: '1' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('CANCELLED')
    })

    it('supports DELETE /api/service/screening/[id] to cancel queue', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      vi.mocked(screeningQueueService.updateQueueStatus).mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening/1', {
        method: 'DELETE',
      })

      const res = await cancelQueueDelete(req, { params: Promise.resolve({ id: '1' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('CANCELLED')
    })

    it('supports direct fallback POST /api/service/screening with UPDATE_STATUS action', async () => {
      vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
        member: mockMember as any,
      })

      vi.mocked(screeningQueueService.updateQueueStatus).mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/service/screening', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          id: 1,
          status: 'CANCELLED',
        }),
      })

      const res = await createQueue(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('CANCELLED')
    })
  })
})
