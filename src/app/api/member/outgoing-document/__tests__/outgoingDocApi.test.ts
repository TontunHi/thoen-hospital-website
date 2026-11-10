import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getServiceDocs } from '../../../service/outgoing-document/route'
import { GET as getMemberDocs, POST as createDoc, PUT as updateDoc, DELETE as deleteDoc } from '../route'
import { apiGateway } from '@/lib/apiGateway'
import { requireMemberApi, verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getOutgoingDocuments: vi.fn(),
      getOutgoingDocumentById: vi.fn(),
      createOutgoingDocument: vi.fn(),
      updateOutgoingDocument: vi.fn(),
      deleteOutgoingDocument: vi.fn(),
    },
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: vi.fn(),
  verifyMemberSession: vi.fn(),
  checkPositionPermission: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('Outgoing Documents API Routes (Named Gateway Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/service/outgoing-document returns active docs for authenticated member', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'user1',
      role: 'member',
    } as any)
    vi.mocked(checkPositionPermission).mockResolvedValue(true)
    vi.mocked(apiGateway.app.getOutgoingDocuments).mockResolvedValue([
      { id: 1, year: '2569', label: 'หนังสือส่ง 2569', url: 'https://docs.google.com/spreadsheets/d/1' }
    ])

    const res = await getServiceDocs()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.canManage).toBe(true)
    expect(json.documents).toHaveLength(1)
    expect(apiGateway.app.getOutgoingDocuments).toHaveBeenCalledWith({ activeOnly: true, order: 'service' })
  })

  it('GET /api/member/outgoing-document returns all docs for management', async () => {
    vi.mocked(requireMemberApi).mockResolvedValue({
      member: { username: 'admin1', session: {} } as any,
      error: undefined,
    })
    vi.mocked(apiGateway.app.getOutgoingDocuments).mockResolvedValue([
      { id: 1, year: '2569', label: 'หนังสือส่ง 2569', isActive: true },
      { id: 2, year: '2568', label: 'หนังสือส่ง 2568', isActive: false },
    ])

    const res = await getMemberDocs()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.documents).toHaveLength(2)
    expect(apiGateway.app.getOutgoingDocuments).toHaveBeenCalledWith({ activeOnly: false, order: 'manager' })
  })

  it('POST /api/member/outgoing-document creates document and logs audit', async () => {
    vi.mocked(requireMemberApi).mockResolvedValue({
      member: { username: 'admin1', session: {} } as any,
      error: undefined,
    })
    vi.mocked(apiGateway.app.createOutgoingDocument).mockResolvedValue({
      success: true,
      document: {
        id: 15,
        year: '2569',
        label: 'หนังสือส่ง 2569',
        url: 'https://docs.google.com/spreadsheets/d/test',
        status: 'เสร็จสิ้น',
        displayOrder: 1,
        isActive: true,
      },
      message: 'บันทึกสำเร็จ',
    })

    const req = new Request('http://localhost:3000/api/member/outgoing-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: '2569',
        label: 'หนังสือส่ง 2569',
        url: 'https://docs.google.com/spreadsheets/d/test',
        status: 'เสร็จสิ้น',
        displayOrder: 1,
        isActive: true,
      }),
    })

    const res = await createDoc(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.document.id).toBe(15)
    expect(logAudit).toHaveBeenCalledWith(
      'CREATE',
      'outgoing_documents',
      expect.stringContaining('2569'),
      expect.anything()
    )
  })

  it('DELETE /api/member/outgoing-document deletes document and logs audit', async () => {
    vi.mocked(requireMemberApi).mockResolvedValue({
      member: { username: 'admin1', session: {} } as any,
      error: undefined,
    })
    vi.mocked(apiGateway.app.deleteOutgoingDocument).mockResolvedValue({
      success: true,
      message: 'ลบสำเร็จ',
      document: { id: 15, year: '2569', label: 'หนังสือส่ง 2569' },
    })

    const req = new Request('http://localhost:3000/api/member/outgoing-document?id=15', {
      method: 'DELETE',
    })

    const res = await deleteDoc(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.deleteOutgoingDocument).toHaveBeenCalledWith(15)
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'outgoing_documents',
      expect.stringContaining('ID: 15'),
      expect.anything()
    )
  })
})
