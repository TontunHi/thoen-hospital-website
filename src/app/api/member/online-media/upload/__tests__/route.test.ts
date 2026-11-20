import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRequireMemberApi = vi.fn()
const mockInitMultipartS3 = vi.fn()
const mockUploadMultipartPartS3 = vi.fn()
const mockCompleteMultipartS3 = vi.fn()
const mockAbortMultipartS3 = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: (...args: unknown[]) => mockRequireMemberApi(...args),
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  MAX_MULTIPART_MEDIA_SIZE_BYTES: 10 * 1024 * 1024 * 1024,
  StorageValidationError: class StorageValidationError extends Error {
    code: string
    constructor(message: string, code = 'VALIDATION_ERROR') {
      super(message)
      this.code = code
    }
  },
  DocumentStorage: {
    formatDateDirectory: vi.fn().mockReturnValue('online-media/internal/2026/11'),
    initMultipartS3: (...args: unknown[]) => mockInitMultipartS3(...args),
    uploadMultipartPartS3: (...args: unknown[]) => mockUploadMultipartPartS3(...args),
    completeMultipartS3: (...args: unknown[]) => mockCompleteMultipartS3(...args),
    abortMultipartS3: (...args: unknown[]) => mockAbortMultipartS3(...args),
    saveToS3Only: vi.fn(),
  },
}))

import { POST } from '../route'

describe('/api/member/online-media/upload route (multi-GB multipart)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireMemberApi.mockResolvedValue({
      member: { id: 1, username: 'admin', email: 'admin@thoen.go.th' },
    })
  })

  it('initializes multipart upload for files larger than 1GB (e.g. 3.5GB)', async () => {
    const fileSize = Math.round(3.5 * 1024 * 1024 * 1024)
    mockInitMultipartS3.mockResolvedValue({
      bucket: 'private-documents',
      s3Key: 'online-media/internal/2026/11/lecture.mp4',
      uploadId: 'upload-123',
      fileName: 'lecture-1.mp4',
      mimeType: 'video/mp4',
    })

    const req = new NextRequest('http://localhost/api/member/online-media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        visibility: 'INTERNAL',
        fileName: 'lecture.mp4',
        mimeType: 'video/mp4',
        fileSize,
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.uploadId).toBe('upload-123')
    expect(mockInitMultipartS3).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'private-documents',
        fileSize,
        maxSizeBytes: 10 * 1024 * 1024 * 1024,
      })
    )
  })

  it('rejects multipart upload larger than 10GB', async () => {
    const oversized = 11 * 1024 * 1024 * 1024
    const req = new NextRequest('http://localhost/api/member/online-media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        visibility: 'PUBLIC',
        fileName: 'huge.mp4',
        mimeType: 'video/mp4',
        fileSize: oversized,
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toContain('10GB')
    expect(mockInitMultipartS3).not.toHaveBeenCalled()
  })

  it('initializes 100MB upload with empty mimeType and long Thai filename', async () => {
    const fileSize = 100 * 1024 * 1024
    const longThaiFileName = 'การอบรมเชิงปฏิบัติการความปลอดภัยระบบสารสนเทศโรงพยาบาลเถินประจำปีงบประมาณ2570-วิดีโอบันทึกการประชุมช่วงเช้าและบ่าย-ฉบับเต็มHD.mp4'
    mockInitMultipartS3.mockResolvedValue({
      bucket: 'public-assets',
      s3Key: 'online-media/public/2026/11/video.mp4',
      uploadId: 'upload-100mb',
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
    })

    const req = new NextRequest('http://localhost/api/member/online-media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        visibility: 'PUBLIC',
        fileName: longThaiFileName,
        mimeType: '',
        fileSize,
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockInitMultipartS3).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'public-assets',
        fileName: longThaiFileName,
        mimeType: 'video/mp4',
        fileSize,
      })
    )
  })

  it('uploads raw binary chunk via query parameters (?action=part)', async () => {
    const chunkBytes = new Uint8Array([1, 2, 3, 4, 5])
    mockUploadMultipartPartS3.mockResolvedValue({
      eTag: '"etag-part-1"',
      partNumber: 1,
    })

    const req = new NextRequest(
      'http://localhost/api/member/online-media/upload?action=part&uploadId=u1&bucket=public-assets&s3Key=online-media%2Fpublic%2Ftest.mp4&partNumber=1',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunkBytes,
      }
    )

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ eTag: '"etag-part-1"', partNumber: 1 })
    expect(mockUploadMultipartPartS3).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'public-assets',
        s3Key: 'online-media/public/test.mp4',
        uploadId: 'u1',
        partNumber: 1,
      })
    )
  })
})
