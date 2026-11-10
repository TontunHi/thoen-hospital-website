import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as listBlogs, POST as createBlog } from '../blogs/route'
import { GET as getBlog, PUT as updateBlog, DELETE as deleteBlog } from '../blogs/[id]/route'
import { apiGateway } from '@/lib/apiGateway'
import { verifyMemberSession } from '@/lib/memberAuth'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getItaBlogs: vi.fn(),
      getItaBlogById: vi.fn(),
      createItaBlog: vi.fn(),
      updateItaBlog: vi.fn(),
      deleteItaBlog: vi.fn(),
      getMembers: vi.fn(),
    },
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

describe('ITA Blogs API Routes (Named Gateway Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/ita/blogs returns blog list', async () => {
    vi.mocked(apiGateway.app.getItaBlogs).mockResolvedValue([
      { id: 1, title: 'ITA 2569 Report', slug: 'ita-2569' }
    ])

    const res = await listBlogs()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].title).toBe('ITA 2569 Report')
  })

  it('POST /api/ita/blogs creates blog when authenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: 5,
      username: 'somchai',
      role: 'member',
      email: 'somchai@hospital.go.th',
    } as any)

    vi.mocked(apiGateway.app.getMembers).mockResolvedValue([
      { id: 5, username: 'somchai', name: 'สมชาย ใจดี', position: 'นักวิชาการคอมพิวเตอร์' }
    ])

    vi.mocked(apiGateway.app.createItaBlog).mockResolvedValue({
      success: true,
      id: 99,
    })

    const req = new Request('http://localhost:3000/api/ita/blogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'ผลการประเมิน ITA ประจำปี 2569',
        content: '<p>รายงานสรุปผลการดำเนินงาน...</p>',
      }),
    })

    const res = await createBlog(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(99)
    expect(apiGateway.app.createItaBlog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'ผลการประเมิน ITA ประจำปี 2569',
        slug: 'ita-2569',
        authorId: 5,
      })
    )
  })

  it('GET /api/ita/blogs/[id] returns single blog', async () => {
    vi.mocked(apiGateway.app.getItaBlogById).mockResolvedValue({
      id: 10,
      title: 'ITA Announcement',
      content: 'Content here',
    })

    const res = await getBlog(new Request('http://localhost:3000/api/ita/blogs/10'), {
      params: Promise.resolve({ id: '10' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(10)
  })

  it('PUT /api/ita/blogs/[id] updates blog when author matches', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: 5,
      username: 'somchai',
      role: 'member',
    } as any)

    vi.mocked(apiGateway.app.getItaBlogById).mockResolvedValue({
      id: 10,
      author_id: 5,
      title: 'Old Title',
    })

    vi.mocked(apiGateway.app.getMembers).mockResolvedValue([
      { id: 5, username: 'somchai', role: 'member' }
    ])

    vi.mocked(apiGateway.app.updateItaBlog).mockResolvedValue({
      success: true,
      affectedRows: 1,
    })

    const req = new Request('http://localhost:3000/api/ita/blogs/10', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated ITA 2569 Report',
        content: 'Updated content',
      }),
    })

    const res = await updateBlog(req, { params: Promise.resolve({ id: '10' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.updateItaBlog).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        title: 'Updated ITA 2569 Report',
        slug: 'ita-2569',
      })
    )
  })

  it('DELETE /api/ita/blogs/[id] deletes blog when user is admin', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: 999,
      username: 'admin_user',
      role: 'admin',
    } as any)

    vi.mocked(apiGateway.app.getItaBlogById).mockResolvedValue({
      id: 10,
      author_id: 5, // Not admin_user
    })

    vi.mocked(apiGateway.app.getMembers).mockResolvedValue([
      { id: 999, username: 'admin_user', role: 'admin' }
    ])

    vi.mocked(apiGateway.app.deleteItaBlog).mockResolvedValue({
      success: true,
      message: 'ลบบทความสำเร็จ',
    })

    const res = await deleteBlog(new Request('http://localhost:3000/api/ita/blogs/10'), {
      params: Promise.resolve({ id: '10' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.deleteItaBlog).toHaveBeenCalledWith(10)
  })
})
