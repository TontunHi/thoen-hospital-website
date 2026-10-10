import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RduService, type QueryExecutor } from '../rduService'
import { DocumentStorage } from '@/lib/storage/documentStorage'

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    createDirectory: vi.fn().mockResolvedValue(undefined),
    renameDirectory: vi.fn().mockResolvedValue(undefined),
    deleteDirectory: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue({
      fileName: 'test.pdf',
      publicUrl: '/documents/rdu/folder1/test.pdf',
      fileSize: 1024,
    }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
  sanitizeName: (s: string) => s.replace(/[\\/:*?"<>|]/g, '_'),
  StorageValidationError: class StorageValidationError extends Error {},
}))

describe('RduService', () => {
  let mockExecutor: QueryExecutor

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecutor = vi.fn()
  })

  describe('getFolderTree', () => {
    it('returns empty array when no folders exist', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([])
      const result = await RduService.getFolderTree({ isActiveOnly: false }, mockExecutor)
      expect(result).toEqual([])
    })

    it('returns folders with grouped files and stream URLs', async () => {
      const mockFolders = [
        { id: 1, folder_name: 'Antibiogram', display_order: 0, is_active: 1 },
      ]
      const mockFiles = [
        {
          id: 10,
          folder_id: 1,
          display_name: 'Antibio 2026',
          file_name: 'antibio.pdf',
          file_path: '/documents/rdu/Antibiogram/antibio.pdf',
          file_size: 2048,
          display_order: 0,
        },
      ]

      mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockFolders)
        .mockResolvedValueOnce(mockFiles)

      const result = await RduService.getFolderTree({ isActiveOnly: true }, mockExecutor)
      expect(result).toHaveLength(1)
      expect(result[0].folder_name).toBe('Antibiogram')
      expect(result[0].files).toHaveLength(1)
      expect(result[0].files[0].file_path).toBe('/api/rdu/file/10')
    })
  })

  describe('createFolder', () => {
    it('throws error if folder name is empty', async () => {
      await expect(RduService.createFolder('', mockExecutor)).rejects.toThrow('กรุณาระบุชื่อโฟลเดอร์')
    })

    it('throws error if folder name already exists', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([{ id: 1 }])
      await expect(RduService.createFolder('Existing', mockExecutor)).rejects.toThrow('มีโฟลเดอร์ชื่อนี้อยู่ในระบบแล้ว')
    })

    it('creates directory and inserts record', async () => {
      mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([]) // check existing
        .mockResolvedValueOnce([{ maxOrder: 2 }]) // max order
        .mockResolvedValueOnce({ insertId: 5 }) // insert

      const res = await RduService.createFolder('New Folder', mockExecutor)
      expect(res.id).toBe(5)
      expect(res.folderName).toBe('New Folder')
      expect(DocumentStorage.createDirectory).toHaveBeenCalledWith('public/documents/rdu/New Folder')
    })
  })

  describe('deleteFolder', () => {
    it('throws 404 error if folder not found', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([])
      await expect(RduService.deleteFolder(999, mockExecutor)).rejects.toThrow('ไม่พบโฟลเดอร์')
    })

    it('deletes folder record and removes directory', async () => {
      mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ folder_name: 'Trash Folder' }])
        .mockResolvedValueOnce({ affectedRows: 1 })

      await RduService.deleteFolder(1, mockExecutor)
      expect(DocumentStorage.deleteDirectory).toHaveBeenCalledWith('public/documents/rdu/Trash Folder')
    })
  })
})
