import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getNewsList, POST as createNews } from '../route'
import { GET as getNewsDetail, PUT as updateNews, DELETE as deleteNews } from '../[id]/route'
import { POST as incrementView } from '../[id]/view/route'
import { apiGateway } from '@/lib/apiGateway'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getNews: vi.fn(),
      getNewsById: vi.fn(),
      createNews: vi.fn(),
      updateNews: vi.fn(),
      deleteNews: vi.fn(),
      incrementNewsView: vi.fn(),
    },
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  requireNewsPermission: vi.fn().mockResolvedValue({
    session: { id: 1, username: 'admin', role: 'admin' },
  }),
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

describe('News API Routes (Named Gateway Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/news returns formatted news list and pagination', async () => {
    vi.mocked(apiGateway.app.getNews).mockResolvedValue({
      success: true,
      count: 1,
      total: 1,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      data: [
        {
          id: 1,
          title: 'กิจกรรมส่งเสริมสุขภาพ',
          slug: 'health-promo-2026',
          category: 'PR',
          youtubeLink: null,
          startDate: '2026-01-01 08:00:00',
          endDate: '2026-12-31 18:00:00',
          viewCount: 15,
          attachments: [
            { id: 101, filePath: '/uploads/news/img1.jpg', fileType: 'image/jpeg', originalName: 'img1.jpg' },
            { id: 102, filePath: '/uploads/news/doc1.pdf', fileType: 'application/pdf', originalName: 'doc1.pdf' },
          ],
        },
      ],
    })

    const req = new Request('http://localhost:3000/api/news?page=1&limit=10')
    const res = await getNewsList(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.news).toHaveLength(1)
    expect(json.news[0].title).toBe('กิจกรรมส่งเสริมสุขภาพ')
    expect(json.news[0].images).toHaveLength(1)
    expect(json.news[0].pdfUrl).toBe('/uploads/news/doc1.pdf')
    expect(apiGateway.app.getNews).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      category: undefined,
      all: false,
      search: undefined,
    })
  })

  it('POST /api/news creates news article with attachments in 1 transaction', async () => {
    const newsPayload = {
      title: 'ข่าวสารงานบริการใหม่',
      category: 'PR',
      publishedAt: '2026-01-01T08:00:00.000Z',
      expiredAt: '2026-12-31T18:00:00.000Z',
      images: ['/uploads/news/photo.jpg'],
      pdfUrl: '/uploads/news/announce.pdf',
    }

    vi.mocked(apiGateway.app.createNews).mockResolvedValue({
      success: true,
      insertId: 10,
      data: { id: 10, title: 'ข่าวสารงานบริการใหม่', slug: 'news-slug' },
    })

    const req = new Request('http://localhost:3000/api/news', {
      method: 'POST',
      body: JSON.stringify(newsPayload),
    })
    const res = await createNews(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(apiGateway.app.createNews).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'ข่าวสารงานบริการใหม่',
        category: 'PR',
        attachments: expect.arrayContaining([
          expect.objectContaining({ filePath: '/uploads/news/photo.jpg', fileType: 'image/jpeg' }),
          expect.objectContaining({ filePath: '/uploads/news/announce.pdf', fileType: 'application/pdf' }),
        ]),
      })
    )
  })

  it('GET /api/news/:id fetches news details by id', async () => {
    vi.mocked(apiGateway.app.getNewsById).mockResolvedValue({
      success: true,
      data: {
        id: 10,
        title: 'ข่าวเด่นประจำสัปดาห์',
        slug: 'weekly-news',
        category: 'PR',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        viewCount: 20,
        attachments: [],
      },
    })

    const req = new Request('http://localhost:3000/api/news/10') as any
    const res = await getNewsDetail(req, { params: Promise.resolve({ id: '10' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.news.title).toBe('ข่าวเด่นประจำสัปดาห์')
    expect(apiGateway.app.getNewsById).toHaveBeenCalledWith('10')
  })

  it('PUT /api/news/:id updates news and replaces attachments safely', async () => {
    vi.mocked(apiGateway.app.getNewsById).mockResolvedValue({
      success: true,
      data: {
        id: 10,
        title: 'ข่าวเดิม',
        category: 'PR',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        attachments: [],
      },
    })

    vi.mocked(apiGateway.app.updateNews).mockResolvedValue({
      success: true,
      message: 'แก้ไขข่าวสารสำเร็จ',
      data: { id: 10, title: 'ข่าวอัปเดตใหม่' },
    })

    const req = new Request('http://localhost:3000/api/news/10', {
      method: 'PUT',
      body: JSON.stringify({
        title: 'ข่าวอัปเดตใหม่',
        images: ['/uploads/news/new-image.jpg'],
      }),
    }) as any

    const res = await updateNews(req, { params: Promise.resolve({ id: '10' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.updateNews).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        title: 'ข่าวอัปเดตใหม่',
        attachments: expect.arrayContaining([
          expect.objectContaining({ filePath: '/uploads/news/new-image.jpg' }),
        ]),
      })
    )
  })

  it('DELETE /api/news/:id removes news via Gateway', async () => {
    vi.mocked(apiGateway.app.deleteNews).mockResolvedValue({
      success: true,
      message: 'ลบข่าวสารสำเร็จ',
    })

    const req = new Request('http://localhost:3000/api/news/10', { method: 'DELETE' }) as any
    const res = await deleteNews(req, { params: Promise.resolve({ id: '10' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.deleteNews).toHaveBeenCalledWith(10)
  })

  it('POST /api/news/:id/view increments article view count', async () => {
    vi.mocked(apiGateway.app.incrementNewsView).mockResolvedValue({
      success: true,
      message: 'เพิ่มยอดเข้าชมสำเร็จ',
    })

    const req = new Request('http://localhost:3000/api/news/10/view', { method: 'POST' }) as any
    const res = await incrementView(req, { params: Promise.resolve({ id: '10' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.incremented).toBe(true)
    expect(apiGateway.app.incrementNewsView).toHaveBeenCalledWith(10)
  })
})
