import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ItaBlogService, type QueryExecutor } from '../ItaBlogService'

describe('ItaBlogService', () => {
  let mockExecutor: QueryExecutor

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecutor = vi.fn()
  })

  describe('generateSlug', () => {
    it('generates year-based slug when year 25xx is present', () => {
      expect(ItaBlogService.generateSlug('รายงานการประเมิน ITA ประจำปี 2568')).toBe('ita-2568')
      expect(ItaBlogService.generateSlug('ITA ประจำปี 2567')).toBe('ita-2567')
    })

    it('generates sanitized slug when no year is present', () => {
      expect(ItaBlogService.generateSlug('Hospital Transparency Standard')).toBe('hospital-transparency-standard')
    })
  })

  describe('listBlogs', () => {
    it('returns paginated blogs with total count', async () => {
      const mockRows = [
        { id: 1, title: 'Blog 1', slug: 'ita-2568', content: 'Body 1', author_name: 'Admin' },
      ]
      mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ total: 1 }]) // COUNT
        .mockResolvedValueOnce(mockRows) // SELECT

      const result = await ItaBlogService.listBlogs({ page: 1, limit: 10 }, mockExecutor)
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
    })
  })

  describe('getBlogByIdOrSlug', () => {
    it('returns blog when found by id', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([{ id: 1, title: 'Test Blog' }])
      const blog = await ItaBlogService.getBlogByIdOrSlug(1, mockExecutor)
      expect(blog).not.toBeNull()
      expect(blog?.title).toBe('Test Blog')
    })

    it('returns null when blog not found', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([])
      const blog = await ItaBlogService.getBlogByIdOrSlug(999, mockExecutor)
      expect(blog).toBeNull()
    })
  })

  describe('updateBlog', () => {
    it('throws error if blog does not exist', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([])
      await expect(
        ItaBlogService.updateBlog(999, { title: 'New', content: 'Body' }, { id: 1, role: 'member' }, mockExecutor)
      ).rejects.toThrow('ไม่พบบทความที่ต้องการแก้ไข')
    })

    it('throws error if user is neither author nor admin', async () => {
      mockExecutor = vi.fn().mockResolvedValueOnce([{ id: 1, author_id: 2 }]) // author_id is 2
      await expect(
        ItaBlogService.updateBlog(1, { title: 'New', content: 'Body' }, { id: 10, role: 'member' }, mockExecutor) // user is 10
      ).rejects.toThrow('คุณไม่มีสิทธิ์แก้ไขบทความนี้')
    })

    it('allows author to update blog', async () => {
      mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ id: 1, author_id: 5 }]) // author is 5
        .mockResolvedValueOnce({ affectedRows: 1 }) // update

      await expect(
        ItaBlogService.updateBlog(1, { title: 'Updated', content: 'Body' }, { id: 5, role: 'member' }, mockExecutor)
      ).resolves.not.toThrow()
    })

    it('allows admin to update blog of another author', async () => {
      mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ id: 1, author_id: 5 }]) // author is 5
        .mockResolvedValueOnce({ affectedRows: 1 }) // update

      await expect(
        ItaBlogService.updateBlog(1, { title: 'Updated Admin', content: 'Body' }, { id: 99, role: 'admin' }, mockExecutor)
      ).resolves.not.toThrow()
    })
  })
})
