import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getPublicRdu } from '../route'
import { GET as streamRduFile } from '../file/[id]/route'
import { GET as getFolders, POST as createFolder, PUT as updateFolder, DELETE as deleteFolder } from '../../member/rdu/folders/route'
import { POST as uploadFile, PUT as updateFile, DELETE as deleteFile } from '../../member/rdu/files/route'
import { apiGateway } from '@/lib/apiGateway'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { requireMemberApi } from '@/lib/memberAuth'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getRduTree: vi.fn(),
      getRduFileById: vi.fn(),
      createRduFolder: vi.fn(),
      updateRduFolder: vi.fn(),
      deleteRduFolder: vi.fn(),
      createRduFile: vi.fn(),
      updateRduFile: vi.fn(),
      deleteRduFile: vi.fn(),
    },
  },
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    readBuffer: vi.fn(),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    renameDirectory: vi.fn().mockResolvedValue(undefined),
    deleteDirectory: vi.fn().mockResolvedValue(undefined),
    save: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  sanitizeName: vi.fn((s: string) => s.replace(/[^a-zA-Z0-9_\-\u0E00-\u0E7F]/g, '_')),
  StorageValidationError: class extends Error {},
}))

vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: vi.fn().mockResolvedValue({
    member: { username: 'testuser', role: 'admin' },
    error: null,
  }),
}))

describe('RDU API Routes (Named Gateway Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/rdu returns public folders tree', async () => {
    vi.mocked(apiGateway.app.getRduTree).mockResolvedValue([
      {
        id: 1,
        folder_name: 'Antibiogram 2026',
        display_order: 1,
        is_active: 1,
        files: [
          { id: 10, folder_id: 1, display_name: 'Antibiogram All', file_name: 'doc.pdf', file_path: '/api/rdu/file/10', file_size: 1024, display_order: 1 }
        ]
      }
    ])

    const res = await getPublicRdu()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.folders).toHaveLength(1)
    expect(json.folders[0].folder_name).toBe('Antibiogram 2026')
    expect(apiGateway.app.getRduTree).toHaveBeenCalledWith({ includeInactive: false })
  })

  it('GET /api/rdu/file/[id] streams PDF file with proper headers', async () => {
    vi.mocked(apiGateway.app.getRduFileById).mockResolvedValue({
      id: 10,
      folder_name: 'Antibiogram',
      file_name: 'antibio.pdf',
      display_name: 'Antibiogram Report',
    })

    const sampleBuffer = Buffer.from('%PDF-1.4 test')
    vi.mocked(DocumentStorage.readBuffer).mockResolvedValue(sampleBuffer)

    const res = await streamRduFile(new Request('http://localhost:3000/api/rdu/file/10'), {
      params: Promise.resolve({ id: '10' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Length')).toBe(sampleBuffer.length.toString())
  })

  it('POST /api/member/rdu/folders creates folder via Gateway & DocumentStorage', async () => {
    vi.mocked(apiGateway.app.createRduFolder).mockResolvedValue({
      success: true,
      folderId: 5,
      folderName: 'New Folder',
      displayOrder: 1,
    })

    const req = new Request('http://localhost:3000/api/member/rdu/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_name: 'New Folder' }),
    })

    const res = await createFolder(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.folderId).toBe(5)
    expect(DocumentStorage.createDirectory).toHaveBeenCalledWith('public/documents/rdu/New Folder')
  })

  it('DELETE /api/member/rdu/folders deletes folder and directory', async () => {
    vi.mocked(apiGateway.app.deleteRduFolder).mockResolvedValue({
      success: true,
      message: 'ลบสำเร็จ',
      folderName: 'Deleted Folder',
    })

    const req = new Request('http://localhost:3000/api/member/rdu/folders?id=5', {
      method: 'DELETE',
    })

    const res = await deleteFolder(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.deleteRduFolder).toHaveBeenCalledWith('5')
    expect(DocumentStorage.deleteDirectory).toHaveBeenCalledWith('public/documents/rdu/Deleted Folder')
  })
})
