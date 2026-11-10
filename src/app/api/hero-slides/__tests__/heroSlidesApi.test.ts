import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, POST } from '../route'
import { PUT, DELETE } from '../[id]/route'
import { apiGateway } from '@/lib/apiGateway'
import { DocumentStorage } from '@/lib/storage/documentStorage'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getSlides: vi.fn(),
      createSlide: vi.fn(),
      updateSlide: vi.fn(),
      deleteSlide: vi.fn(),
      updateSlideDuration: vi.fn(),
    },
  },
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  requireNewsPermission: vi.fn().mockResolvedValue({
    session: { id: 1, username: 'admin', role: 'admin' },
  }),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('Hero Slides API Routes (Named Gateway Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/hero-slides returns active slides and duration', async () => {
    vi.mocked(apiGateway.app.getSlides).mockResolvedValue({
      success: true,
      count: 1,
      slides: [
        { id: 10, title: 'Slide 1', imagePath: '/uploads/s1.jpg', displayOrder: 1, duration: 6 },
      ],
      data: [
        { id: 10, title: 'Slide 1', imagePath: '/uploads/s1.jpg', displayOrder: 1, duration: 6 },
      ],
      slideDuration: 6,
    })

    const req = new Request('http://localhost:3000/api/hero-slides')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.slides).toHaveLength(1)
    expect(json.slideDuration).toBe(6)
    expect(apiGateway.app.getSlides).toHaveBeenCalledWith(false)
  })

  it('GET /api/hero-slides?all=true requests all slides from gateway', async () => {
    vi.mocked(apiGateway.app.getSlides).mockResolvedValue({
      success: true,
      count: 2,
      slides: [
        { id: 1, title: 'Slide 1', displayOrder: 1 },
        { id: 2, title: 'Slide 2', displayOrder: 2 },
      ],
      data: [],
      slideDuration: 8,
    })

    const req = new Request('http://localhost:3000/api/hero-slides?all=true')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(apiGateway.app.getSlides).toHaveBeenCalledWith(true)
    expect(json.slideDuration).toBe(8)
  })

  it('PATCH /api/hero-slides validates duration range (2 to 30)', async () => {
    const invalidReq = new Request('http://localhost:3000/api/hero-slides', {
      method: 'PATCH',
      body: JSON.stringify({ slideDuration: 50 }),
    })
    const res = await PATCH(invalidReq)
    expect(res.status).toBe(400)

    const validReq = new Request('http://localhost:3000/api/hero-slides', {
      method: 'PATCH',
      body: JSON.stringify({ slideDuration: 10 }),
    })
    vi.mocked(apiGateway.app.updateSlideDuration).mockResolvedValue({
      success: true,
      slideDuration: 10,
    })
    const validRes = await PATCH(validReq)
    const validJson = await validRes.json()

    expect(validRes.status).toBe(200)
    expect(validJson.slideDuration).toBe(10)
    expect(apiGateway.app.updateSlideDuration).toHaveBeenCalledWith(10)
  })

  it('POST /api/hero-slides creates a slide via Gateway Named API', async () => {
    const slidePayload = {
      imagePath: '/uploads/slides/banner.jpg',
      title: 'ประชาสัมพันธ์วันเด็ก',
      linkUrl: 'https://thoenhospital.moph.go.th',
      startDate: '2026-01-01 08:00:00',
      endDate: '2026-01-31 18:00:00',
      displayOrder: 1,
      duration: 6,
    }

    vi.mocked(apiGateway.app.createSlide).mockResolvedValue({
      success: true,
      insertId: 99,
      slide: { id: 99, ...slidePayload },
    })

    const req = new Request('http://localhost:3000/api/hero-slides', {
      method: 'POST',
      body: JSON.stringify(slidePayload),
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.slide.id).toBe(99)
    expect(apiGateway.app.createSlide).toHaveBeenCalled()
  })

  it('PUT /api/hero-slides/:id updates a slide and cleans old image if changed', async () => {
    const updatePayload = {
      imagePath: '/uploads/slides/new-banner.jpg',
      title: 'แก้ไขหัวข้อสไลด์',
      startDate: '2026-01-01 08:00:00',
      endDate: '2026-01-31 18:00:00',
      displayOrder: 1,
      duration: 8,
    }

    vi.mocked(apiGateway.app.updateSlide).mockResolvedValue({
      success: true,
      slide: { id: 99, ...updatePayload },
      previousImagePath: '/uploads/slides/old-banner.jpg',
    })

    const req = new Request('http://localhost:3000/api/hero-slides/99', {
      method: 'PUT',
      body: JSON.stringify(updatePayload),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: '99' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.updateSlide).toHaveBeenCalled()
    expect(DocumentStorage.delete).toHaveBeenCalledWith('/uploads/slides/old-banner.jpg')
  })

  it('DELETE /api/hero-slides/:id deletes slide via Gateway and removes image from storage', async () => {
    vi.mocked(apiGateway.app.deleteSlide).mockResolvedValue({
      success: true,
      message: 'ลบสไลด์ภาพเรียบร้อยแล้ว',
      slide: { id: 99, title: 'สไลด์ที่ถูกลบ', imagePath: '/uploads/slides/banner-to-delete.jpg' },
    })

    const req = new Request('http://localhost:3000/api/hero-slides/99', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: '99' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.deleteSlide).toHaveBeenCalledWith(99)
    expect(DocumentStorage.delete).toHaveBeenCalledWith('/uploads/slides/banner-to-delete.jpg')
  })
})
