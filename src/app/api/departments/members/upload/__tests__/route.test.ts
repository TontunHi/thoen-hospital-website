import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { NextResponse } from 'next/server'

vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: vi.fn()
}))
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/lib/storage/documentStorage', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    DocumentStorage: {
      save: vi.fn().mockResolvedValue({
        publicUrl: '/uploads/org-chart/staff-photo-12345.jpg',
        relativePath: 'public/uploads/org-chart/staff-photo-12345.jpg',
        fileName: 'staff-photo-12345.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg'
      })
    }
  }
})

describe('POST /api/departments/members/upload', () => {
  const adminMember = {
    id: 1,
    username: '1234567890123',
    name: 'Admin User',
    role: 'admin'
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized non-admin users with 403', async () => {
    vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    } as any)

    const formData = new FormData()
    const req = new Request('http://localhost/api/departments/members/upload', {
      method: 'POST',
      body: formData
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when no file is uploaded', async () => {
    vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({
      member: adminMember
    } as any)

    const mockFormData = {
      get: (_key: string) => null
    }
    const req = { formData: async () => mockFormData } as any

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('กรุณาเลือกไฟล์รูปภาพ')
  })

  it('returns 400 when an invalid file type is uploaded (e.g. text or exe)', async () => {
    vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({
      member: adminMember
    } as any)

    const fakeFile = {
      name: 'document.txt',
      type: 'text/plain',
      size: 100
    }
    const mockFormData = {
      get: (key: string) => (key === 'file' ? fakeFile : null)
    }
    const req = { formData: async () => mockFormData } as any

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toContain('รองรับเฉพาะไฟล์รูปภาพ')
  })

  it('accepts image/jpeg, image/png, image/webp, image/jfif and saves with safe baseName', async () => {
    vi.mocked(memberAuth.requireMemberApi).mockResolvedValueOnce({
      member: adminMember
    } as any)

    const fakeFile = {
      name: 'หมอทดสอบ_รูปถ่าย.jpg',
      type: 'image/jpeg',
      size: 1024,
      arrayBuffer: async () => Buffer.from('fake image buffer')
    }
    const mockFormData = {
      get: (key: string) => (key === 'file' ? fakeFile : null)
    }
    const req = { formData: async () => mockFormData } as any

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.url).toBe('/uploads/org-chart/staff-photo-12345.jpg')
    expect(DocumentStorage.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationDir: 'public/uploads/org-chart',
        maxSizeBytes: 15 * 1024 * 1024,
        collisionStrategy: 'timestamp'
      })
    )
  })
})
