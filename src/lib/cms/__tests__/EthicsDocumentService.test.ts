import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EthicsDocumentService } from '../EthicsDocumentService'
import { prisma } from '@/lib/prisma'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ethicsYear: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    ethicsDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    }
  }
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    save: vi.fn(),
    delete: vi.fn(),
    replace: vi.fn(),
  }
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

describe('EthicsDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDocumentTree', () => {
    it('returns empty state when no years exist', async () => {
      vi.mocked(prisma.ethicsYear.findMany).mockResolvedValue([])
      
      const tree = await EthicsDocumentService.getDocumentTree()
      
      expect(tree).toEqual([])
      expect(prisma.ethicsYear.findMany).toHaveBeenCalledTimes(1)
    })

    it('builds tree with nested children correctly', async () => {
      const mockYears = [
        {
          id: 1,
          year: '2567',
          displayOrder: 1,
          documents: [
            { id: 10, title: 'Parent Doc 1', parentId: null, displayOrder: 1, filePath: '/docs/10.pdf' },
            { id: 11, title: 'Child Doc 1', parentId: 10, displayOrder: 1, filePath: '/docs/11.pdf' },
            { id: 12, title: 'Child Doc 2', parentId: 10, displayOrder: 2, filePath: '/docs/12.pdf' },
            { id: 20, title: 'Parent Doc 2', parentId: null, displayOrder: 2, filePath: null },
          ]
        }
      ]
      
      vi.mocked(prisma.ethicsYear.findMany).mockResolvedValue(mockYears as any)
      
      const tree = await EthicsDocumentService.getDocumentTree()
      
      expect(tree).toHaveLength(1)
      expect(tree[0].year).toBe('2567')
      expect(tree[0].documents).toHaveLength(2)
      
      const parent1 = tree[0].documents[0]
      expect(parent1.id).toBe(10)
      expect(parent1.subItems).toHaveLength(2)
      expect(parent1.subItems?.[0].id).toBe(11)
      expect(parent1.subItems?.[1].id).toBe(12)
      
      const parent2 = tree[0].documents[1]
      expect(parent2.id).toBe(20)
      expect(parent2.subItems).toBeUndefined()
    })
  })

  describe('deleteDocument', () => {
    it('cascading delete removes child files and calls logAudit', async () => {
      const mockDoc = {
        id: 10,
        title: 'Parent with children',
        filePath: '/docs/parent.pdf',
        children: [
          { id: 11, filePath: '/docs/child1.pdf' },
          { id: 12, filePath: null },
          { id: 13, filePath: '/docs/child3.pdf' },
        ]
      }
      
      vi.mocked(prisma.ethicsDocument.findUnique).mockResolvedValue(mockDoc as any)
      vi.mocked(prisma.ethicsDocument.delete).mockResolvedValue({} as any)
      
      await EthicsDocumentService.deleteDocument('10', 'test-actor', { user: 'test' })
      
      // Should delete child1, child3, and parent files
      expect(DocumentStorage.delete).toHaveBeenCalledTimes(3)
      expect(DocumentStorage.delete).toHaveBeenCalledWith('/docs/child1.pdf')
      expect(DocumentStorage.delete).toHaveBeenCalledWith('/docs/child3.pdf')
      expect(DocumentStorage.delete).toHaveBeenCalledWith('/docs/parent.pdf')
      
      expect(prisma.ethicsDocument.delete).toHaveBeenCalledWith({
        where: { id: 10 }
      })
      
      expect(logAudit).toHaveBeenCalledWith(
        'DELETE',
        'ethics_documents',
        expect.stringContaining('ลบเอกสารจริยธรรม "Parent with children" (ID: 10) พร้อมเอกสารย่อย'),
        { user: 'test' }
      )
    })
  })
})
