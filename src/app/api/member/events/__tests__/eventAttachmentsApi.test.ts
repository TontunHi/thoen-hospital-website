import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getAttachments, POST as addAttachment } from '../[id]/attachments/route'
import { DELETE as deleteAttachment } from '../[id]/attachments/[attachmentId]/route'
import * as memberAuth from '@/lib/memberAuth'
import { DocumentStorage } from '@/lib/storage/documentStorage'

const { mockEventServiceInstance } = vi.hoisted(() => ({
  mockEventServiceInstance: {
    getAttachments: vi.fn(),
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
}))

vi.mock('@/lib/events/hospitalEventService', () => {
  return {
    HospitalEventService: class {
      constructor() {
        return mockEventServiceInstance
      }
    },
  }
})

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    save: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('Member Event Attachments API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: {
        id: 10,
        username: 'staff1',
        name: 'นายแพทย์ทดสอบ',
        department: 'กลุ่มงานการแพทย์',
        position: 'นายแพทย์ชำนาญการ',
        role: 'user',
        isSuperAdmin: false,
      },
    } as any)
  })

  it('GET /api/member/events/[id]/attachments returns attachments list', async () => {
    mockEventServiceInstance.getAttachments.mockResolvedValue([
      { id: 1, eventId: 2, attachmentType: 'IMAGE', title: 'ภาพบรรยากาศ 1' },
      { id: 2, eventId: 2, attachmentType: 'NOTE', title: 'สรุปการประชุม', textContent: 'มติที่ประชุม...' },
    ])

    const req = new Request('http://localhost/api/member/events/2/attachments')
    const res = await getAttachments(req, { params: Promise.resolve({ id: '2' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.attachments).toHaveLength(2)
    expect(mockEventServiceInstance.getAttachments).toHaveBeenCalledWith(2)
  })

  it('POST /api/member/events/[id]/attachments with JSON creates NOTE attachment', async () => {
    mockEventServiceInstance.addAttachment.mockResolvedValue({
      id: 5,
      eventId: 2,
      attachmentType: 'NOTE',
      title: 'ประกาศผล',
      textContent: 'ข้อความประกาศ',
    })

    const req = new Request('http://localhost/api/member/events/2/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachmentType: 'NOTE',
        title: 'ประกาศผล',
        textContent: 'ข้อความประกาศ',
      }),
    })

    const res = await addAttachment(req, { params: Promise.resolve({ id: '2' }) })
    const json = await res.json()
    if (res.status !== 200) {
      console.error('DEBUG API ERROR:', json)
    }

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.title).toBe('ประกาศผล')
    expect(mockEventServiceInstance.addAttachment).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        attachmentType: 'NOTE',
        title: 'ประกาศผล',
        textContent: 'ข้อความประกาศ',
      }),
      expect.any(Object)
    )
  })

  it('POST /api/member/events/[id]/attachments with multipart formData uploads IMAGE', async () => {
    vi.mocked(DocumentStorage.save).mockResolvedValue({
      publicUrl: '/uploads/events/2/photo1.jpg',
      relativePath: 'public/uploads/events/2/photo1.jpg',
      diskPath: '/disk/photo1.jpg',
      fileName: 'photo1.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
    })

    mockEventServiceInstance.addAttachment.mockResolvedValue({
      id: 6,
      eventId: 2,
      attachmentType: 'IMAGE',
      title: 'ภาพพิธีเปิด',
      filePath: '/uploads/events/2/photo1.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024,
    })

    const fakeFile = {
      name: 'photo1.jpg',
      type: 'image/jpeg',
      size: 1024,
      arrayBuffer: async () => new ArrayBuffer(1024),
    }

    const req = new Request('http://localhost/api/member/events/2/attachments', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=test',
      },
    })
    req.formData = async () =>
      ({
        get: (key: string) => {
          if (key === 'attachmentType') return 'IMAGE'
          if (key === 'title') return 'ภาพพิธีเปิด'
          if (key === 'file') return fakeFile
          return null
        },
        getAll: (key: string) => {
          if (key === 'files') return [fakeFile]
          return []
        },
      } as any)

    const res = await addAttachment(req, { params: Promise.resolve({ id: '2' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(DocumentStorage.save).toHaveBeenCalled()
    expect(mockEventServiceInstance.addAttachment).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        attachmentType: 'IMAGE',
        title: 'ภาพพิธีเปิด',
        filePath: '/uploads/events/2/photo1.jpg',
      }),
      expect.any(Object)
    )
  })

  it('DELETE /api/member/events/[id]/attachments/[attachmentId] deletes attachment', async () => {
    mockEventServiceInstance.deleteAttachment.mockResolvedValue({
      success: true,
      message: 'ลบเอกสารหรือไฟล์แนบเรียบร้อยแล้ว',
    })

    const req = new Request('http://localhost/api/member/events/2/attachments/5', {
      method: 'DELETE',
    })

    const res = await deleteAttachment(req, {
      params: Promise.resolve({ id: '2', attachmentId: '5' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockEventServiceInstance.deleteAttachment).toHaveBeenCalledWith(2, 5, expect.any(Object))
  })
})
