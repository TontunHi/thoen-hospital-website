import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as signaturePostHandler } from '../route'
import fs from 'fs'

const mockVerifyMemberSession = vi.fn()
const mockQueryMemberDb = vi.fn()
const mockLogAudit = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => mockVerifyMemberSession(),
}))

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: (...args: any[]) => mockQueryMemberDb(...args),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: (...args: any[]) => mockLogAudit(...args),
}))

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: vi.fn().mockReturnValue(true),
      mkdirSync: vi.fn(),
      promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
})

describe('Signatures API Route Handler - Security Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyMemberSession.mockResolvedValue({
      id: 1,
      username: 'doctor_somchai',
      email: 'somchai@thoen.moph.go.th',
      role: 'member',
    })
    mockQueryMemberDb.mockResolvedValue([])
  })

  it('rejects request if member is not logged in', async () => {
    mockVerifyMemberSession.mockResolvedValue(null)
    const req = new Request('http://localhost:3000/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: 'data:image/png;base64,abc' }),
    })
    const res = await signaturePostHandler(req)
    expect(res.status).toBe(401)
  })

  it('rejects request if imageBase64 format is invalid', async () => {
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
    // 3MB string
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
    // Malicious text disguised as PNG base64
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

  it('accepts valid PNG bytes, saves file, and records audit log', async () => {
    // PNG Header: 89 50 4E 47 0D 0A 1A 0A followed by dummy data
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

    // Verify fs write
    expect(fs.promises.writeFile).toHaveBeenCalled()

    // Verify audit log
    expect(mockLogAudit).toHaveBeenCalledWith(
      'UPDATE',
      'members',
      'บันทึกหรืออัปเดตลายเซ็นอิเล็กทรอนิกส์ (E-Signature)',
      { username: 'doctor_somchai', email: 'somchai@thoen.moph.go.th' }
    )
  })
})
