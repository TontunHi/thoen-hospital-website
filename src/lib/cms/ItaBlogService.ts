import { queryMemberDb } from '@/lib/memberDb'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any>

export interface ItaBlogItem {
  id: number
  title: string
  slug: string
  content: string
  author_id?: number
  author_name: string
  author_position?: string | null
  created_at: string | Date
  updated_at: string | Date
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export class ItaBlogService {
  /**
   * Generates a readable URL slug from the title, optimizing for Thai Buddhist years (e.g. 2568 -> ita-2568)
   */
  static generateSlug(title: string): string {
    const yearMatch = title.match(/\b(25\d{2})\b/)
    if (yearMatch) {
      return `ita-${yearMatch[1]}`
    }
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Retrieves a paginated list of ITA blogs
   */
  static async listBlogs(
    options: { page?: number; limit?: number; authorId?: number } = {},
    executor: QueryExecutor = queryMemberDb
  ): Promise<PaginatedResult<ItaBlogItem>> {
    const page = Math.max(1, options.page || 1)
    const limit = Math.min(100, Math.max(1, options.limit || 20))
    const offset = (page - 1) * limit

    const whereClauses: string[] = []
    const params: any[] = []

    if (options.authorId !== undefined) {
      whereClauses.push('author_id = ?')
      params.push(options.authorId)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const countRes = await executor(`SELECT COUNT(*) as total FROM ita_blogs ${whereSql}`, params)
    const total = Number(countRes[0]?.total || 0)

    const listParams = [...params, limit, offset]
    const blogs = (await executor(
      `SELECT id, title, slug, content, author_id, author_name, author_position, created_at, updated_at 
       FROM ita_blogs 
       ${whereSql} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      listParams
    )) as ItaBlogItem[]

    return {
      data: blogs || [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    }
  }

  /**
   * Fetches a single blog post by its numeric ID or unique slug
   */
  static async getBlogByIdOrSlug(
    idOrSlug: number | string,
    executor: QueryExecutor = queryMemberDb
  ): Promise<ItaBlogItem | null> {
    const isId = typeof idOrSlug === 'number' || !isNaN(Number(idOrSlug))
    const sql = isId
      ? 'SELECT id, title, slug, content, author_id, author_name, author_position, created_at, updated_at FROM ita_blogs WHERE id = ? LIMIT 1'
      : 'SELECT id, title, slug, content, author_id, author_name, author_position, created_at, updated_at FROM ita_blogs WHERE slug = ? LIMIT 1'

    const rows = await executor(sql, [idOrSlug])
    if (!rows || rows.length === 0) {
      return null
    }
    return rows[0] as ItaBlogItem
  }

  /**
   * Creates a new blog post
   */
  static async createBlog(
    data: {
      title: string
      content: string
      author: {
        id: number
        name: string
        position?: string | null
      }
    },
    executor: QueryExecutor = queryMemberDb
  ): Promise<{ id: number; slug: string }> {
    const title = data.title.trim()
    const content = data.content.trim()
    const slug = this.generateSlug(title)
    const authorName = data.author.name
    const authorPosition = data.author.position ? data.author.position.trim() : 'เจ้าพนักงานเครื่องคอมพิวเตอร์'

    const result = await executor(
      'INSERT INTO ita_blogs (title, slug, content, author_id, author_name, author_position) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, content, data.author.id, authorName, authorPosition]
    )

    return {
      id: (result as any).insertId,
      slug,
    }
  }

  /**
   * Updates an existing blog post (only author or admin allowed)
   */
  static async updateBlog(
    id: number,
    data: { title: string; content: string },
    member: { id: number; role: string },
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    const existing = await executor('SELECT id, author_id FROM ita_blogs WHERE id = ? LIMIT 1', [id])
    if (!existing || existing.length === 0) {
      throw new Error('ไม่พบบทความที่ต้องการแก้ไข')
    }

    const blog = existing[0]
    if (blog.author_id !== member.id && member.role !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์แก้ไขบทความนี้')
    }

    const title = data.title.trim()
    const content = data.content.trim()
    const slug = this.generateSlug(title)

    await executor('UPDATE ita_blogs SET title = ?, slug = ?, content = ? WHERE id = ?', [
      title,
      slug,
      content,
      id,
    ])
  }

  /**
   * Deletes a blog post (only author or admin allowed)
   */
  static async deleteBlog(
    id: number,
    member: { id: number; role: string },
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    const existing = await executor('SELECT id, author_id FROM ita_blogs WHERE id = ? LIMIT 1', [id])
    if (!existing || existing.length === 0) {
      throw new Error('ไม่พบบทความที่ต้องการลบ')
    }

    const blog = existing[0]
    if (blog.author_id !== member.id && member.role !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์ลบบทความนี้')
    }

    await executor('DELETE FROM ita_blogs WHERE id = ?', [id])
  }
}
