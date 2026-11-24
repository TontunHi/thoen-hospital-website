import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as signatureGetHandler, POST as signaturePostHandler } from '../route'
import { GET as signatureImageGetHandler } from '../image/route'

const mockVerifyMemberSession = vi.fn()
const mockIsSignatureFeatureEnabled = vi.fn()
const mockGetMemberSignaturePath = vi.fn()
const mockUpdateMemberSignaturePath = vi.fn()
const mockResolveMemberSignatureAccess = vi.fn()
const mockLogAudit = vi.fn()
const mockStorageSave = vi.fn()
const mockStorageReadBuffer = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => mockVerifyMemberSession(),
}))

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      isSignatureFeatureEnabled: (...args: unknown[]) => mockIsSignatureFeatureEnabled(...args),
      getMemberSignaturePath: (...args: unknown[]) => mockGetMemberSignaturePath(...args),
      updateMemberSignaturePath: (...args: unknown[]) => mockUpdateMemberSignaturePath(...args),
      resolveMemberSignatureAccess: (...args: unknown[]) => mockResolveMemberSignatureAccess(...args),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    save: (...args: unknown[]) => mockStorageSave(...args),
    readBuffer: (...args: unknown[]) => mockStorageReadBuffer(...args),
  },
}))

describe('Signatures API Route Handlers & Service Seam - Security Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyMemberSession.mockResolvedValue({
      id: 1,
      username: 'doctor_somchai',
      email: 'somchai@thoen.moph.go.th',
      role: 'member',
    })
    mockIsSignatureFeatureEnabled.mockResolvedValue({ enabled: true })
    mockGetMemberSignaturePath.mockResolvedValue({ signaturePath: null, updatedAt: null })
    mockUpdateMemberSignaturePath.mockResolvedValue({ updated: true })
    mockStorageSave.mockResolvedValue({
      publicUrl: '/storage/doctor_somchai/signature.png',
      relativePath: 'storage/doctor_somchai/signature.png',
      diskPath: '/app/storage/doctor_somchai/signature.png',
      fileName: 'signature.png',
      fileSize: 16,
      mimeType: 'image/png',
    })
  })

  it('rejects POST request if member is not logged in', async () => {
    mockVerifyMemberSession.mockResolvedValue(null)
    const req = new Request('http://localhost:3000/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: 'data:image/png;base64,abc' }),
    })
    const res = await signaturePostHandler(req)
    expect(res.status).toBe(401)
  })

  it('rejects POST request if imageBase64 format is invalid', async () => {
    const req = new Request('http://localhost:3000/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: 'data:image/jpeg;base64,abc' }),
    })
    const res = await signaturePostHandler(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('รูปแบบไฟล์ลายเซ็นไม่ถูกต้อง')
  })

  it('rejects oversized payload exceeding 2MB limit (A04: Insecure Design)', async () => {
    const largePayload = 'A'.repeat(3 * 1024 * 1024)
    const req = new Request('http://localhost:3000/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: `data:image/png;base64,${largePayload}` }),
    })
    const res = await signaturePostHandler(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB')
  })

  it('rejects files without valid PNG magic bytes (A04: Insecure Design)', async () => {
    const fakeContent = Buffer.from('<?php echo "evil"; ?>').toString('base64')
    const req = new Request('http://localhost:3000/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: `data:image/png;base64,${fakeContent}` }),
    })
    const res = await signaturePostHandler(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('ไฟล์ลายเซ็นไม่ใช่รูปภาพ PNG ที่ถูกต้อง')
  })

  it('accepts valid PNG bytes, saves via DocumentStorage seam, and records audit log', async () => {
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ])
    const validBase64 = validPngBuffer.toString('base64')

    const req = new Request('http://localhost:3000/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: `data:image/png;base64,${validBase64}` }),
    })
    const res = await signaturePostHandler(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.path).toBe('storage/doctor_somchai/signature.png')

    expect(mockStorageSave).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        destinationDir: 'storage/doctor_somchai',
        baseName: 'signature.png',
        collisionStrategy: 'fixed',
        allowedRootPrefixes: ['storage'],
      })
    )

    expect(mockLogAudit).toHaveBeenCalledWith(
      'UPDATE',
      'members',
      'บันทึกหรืออัปเดตลายเซ็นอิเล็กทรอนิกส์ (E-Signature)',
      { username: 'doctor_somchai', email: 'somchai@thoen.moph.go.th' }
    )
  })

  it('returns signature status via GET /api/signatures', async () => {
    mockIsSignatureFeatureEnabled.mockResolvedValueOnce({ enabled: true })
    mockGetMemberSignaturePath.mockResolvedValueOnce({
      signaturePath: 'storage/doctor_somchai/signature.png',
      updatedAt: '2026-01-01T00:00:00Z',
    })

    const res = await signatureGetHandler()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      success: true,
      exists: true,
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('blocks non-admin from reading another user signature path via GET /api/signatures/image', async () => {
    mockGetMemberSignaturePath.mockResolvedValueOnce({
      signaturePath: 'storage/doctor_somchai/signature.png',
      updatedAt: '2026-01-01T00:00:00Z',
    })

    const req = new Request(
      'http://localhost:3000/api/signatures/image?path=storage/other_user/signature.png'
    )
    const res = await signatureImageGetHandler(req)
    expect(res.status).toBe(403)
    expect(mockStorageReadBuffer).not.toHaveBeenCalled()
  })
})
