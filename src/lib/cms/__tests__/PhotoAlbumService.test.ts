import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PhotoAlbumService,
  formatAvailableMonthsThai,
  normalizeAlbumItem,
  type PhotoAlbumGateway,
} from '../PhotoAlbumService'

const mockDelete = vi.fn().mockResolvedValue(undefined)
const mockLogAudit = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    delete: (...args: any[]) => mockDelete(...args),
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: (...args: any[]) => mockLogAudit(...args),
}))

function createMockGateway(): PhotoAlbumGateway {
  return {
    getAlbums: vi.fn(),
    getAlbumById: vi.fn(),
    createAlbum: vi.fn(),
    updateAlbum: vi.fn(),
    deleteAlbum: vi.fn(),
    incrementAlbumView: vi.fn(),
  }
}

describe('PhotoAlbumService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('formats available months into Thai Buddhist labels', () => {
    const result = formatAvailableMonthsThai([
      { year: 2026, month: 11, count: 4 },
      { year: 2026, month: 1, count: 2 },
    ])

    expect(result).toEqual([
      { year: 2026, month: 11, count: 4, value: '2026-11', label: 'พฤศจิกายน 2569' },
      { year: 2026, month: 1, count: 2, value: '2026-01', label: 'มกราคม 2569' },
    ])
  })

  it('normalizes raw album data and defaults coverImageUrl to first image', () => {
    const normalized = normalizeAlbumItem({
      id: 10,
      title: 'กิจกรรมวันพยาบาลแห่งชาติ',
      slug: 'nurse-day-2569',
      eventDate: '2026-10-21T00:00:00.000Z',
      coverImageUrl: null,
      status: 'PUBLISHED',
      isPinned: 1,
      viewCount: 15,
      images: [
        { id: 1, imageUrl: '/uploads/2026/10/a.webp', displayOrder: 0 },
        { id: 2, imageUrl: '/uploads/2026/10/b.webp', displayOrder: 1 },
      ],
    })

    expect(normalized.eventDate).toBe('2026-10-21')
    expect(normalized.coverImageUrl).toBe('/uploads/2026/10/a.webp')
    expect(normalized.isPinned).toBe(true)
    expect(normalized.imageCount).toBe(2)
  })

  it('returns empty array safely when getHomepageAlbums encounters gateway failure', async () => {
    const gw = createMockGateway()
    vi.mocked(gw.getAlbums).mockRejectedValue(new Error('Gateway down'))
    const service = new PhotoAlbumService(gw)

    const albums = await service.getHomepageAlbums(6)
    expect(albums).toEqual([])
  })

  it('creates an album with fallback cover and records audit log', async () => {
    const gw = createMockGateway()
    vi.mocked(gw.createAlbum).mockResolvedValue({
      success: true,
      insertId: 42,
      data: {
        id: 42,
        title: 'รณรงค์ตรวจสุขภาพชุมชน',
        slug: 'health-camp-123',
        eventDate: '2026-11-23',
        coverImageUrl: '/uploads/2026/11/1.webp',
        status: 'PUBLISHED',
        isPinned: true,
        images: [
          { id: 101, albumId: 42, imageUrl: '/uploads/2026/11/1.webp', displayOrder: 0 },
          { id: 102, albumId: 42, imageUrl: '/uploads/2026/11/2.webp', displayOrder: 1 },
        ],
      },
    })

    const service = new PhotoAlbumService(gw)
    const created = await service.createAlbum(
      {
        title: 'รณรงค์ตรวจสุขภาพชุมชน',
        eventDate: '2026-11-23',
        isPinned: true,
        images: [
          { imageUrl: '/uploads/2026/11/1.webp' },
          { imageUrl: '/uploads/2026/11/2.webp' },
        ],
      },
      { username: 'pr_staff', role: 'ADMIN' }
    )

    expect(created.id).toBe(42)
    expect(created.coverImageUrl).toBe('/uploads/2026/11/1.webp')
    expect(gw.createAlbum).toHaveBeenCalledTimes(1)
    expect(mockLogAudit).toHaveBeenCalledWith(
      'CREATE',
      'photo_albums',
      expect.stringContaining('42'),
      expect.objectContaining({ username: 'pr_staff' })
    )
  })

  it('deletes removed local uploads when updating album images', async () => {
    const gw = createMockGateway()
    vi.mocked(gw.updateAlbum).mockResolvedValue({
      success: true,
      message: 'updated',
      previousImageUrls: ['/uploads/2026/11/keep.webp', '/uploads/2026/11/remove.webp'],
      data: {
        id: 7,
        title: 'อัปเดตอัลบั้ม',
        slug: 'updated-album',
        eventDate: '2026-11-23',
        coverImageUrl: '/uploads/2026/11/keep.webp',
        status: 'PUBLISHED',
        isPinned: false,
        images: [{ id: 1, albumId: 7, imageUrl: '/uploads/2026/11/keep.webp', displayOrder: 0 }],
      },
    })

    const service = new PhotoAlbumService(gw)
    await service.updateAlbum(
      7,
      {
        title: 'อัปเดตอัลบั้ม',
        images: [{ imageUrl: '/uploads/2026/11/keep.webp' }],
      },
      { username: 'pr_staff' }
    )

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith('/uploads/2026/11/remove.webp')
    expect(mockLogAudit).toHaveBeenCalledWith(
      'UPDATE',
      'photo_albums',
      expect.stringContaining('7'),
      expect.anything()
    )
  })

  it('cleans up local image files and logs audit on deleteAlbum', async () => {
    const gw = createMockGateway()
    vi.mocked(gw.deleteAlbum).mockResolvedValue({
      success: true,
      message: 'deleted',
      deletedImageUrls: ['/uploads/2026/11/a.webp', 'https://external.example.com/b.jpg'],
    })

    const service = new PhotoAlbumService(gw)
    await service.deleteAlbum(9, { username: 'pr_staff' })

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith('/uploads/2026/11/a.webp')
    expect(mockLogAudit).toHaveBeenCalledWith(
      'DELETE',
      'photo_albums',
      expect.stringContaining('9'),
      expect.anything()
    )
  })
})
