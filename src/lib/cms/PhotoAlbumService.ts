import { apiGateway } from '@/lib/apiGateway'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  formatAvailableMonthsThai,
  formatThaiMonthYear,
  normalizeAlbumItem,
} from '@/lib/cms/albumFormatters'
import type {
  AlbumListResult,
  CreatePhotoAlbumInput,
  PhotoAlbumItem,
  UpdatePhotoAlbumInput,
} from '@/types/album'

export { formatAvailableMonthsThai, formatThaiMonthYear, normalizeAlbumItem }

export interface PhotoAlbumGateway {
  getAlbums: typeof apiGateway.app.getAlbums
  getAlbumById: typeof apiGateway.app.getAlbumById
  createAlbum: typeof apiGateway.app.createAlbum
  updateAlbum: typeof apiGateway.app.updateAlbum
  deleteAlbum: typeof apiGateway.app.deleteAlbum
  incrementAlbumView: typeof apiGateway.app.incrementAlbumView
}

export interface PhotoAlbumAuditSession {
  username?: string | null
  email?: string | null
  role?: string | null
}

function generateAlbumSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\u0E00-\u0E7Fa-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 180)
  return `${base || 'album'}-${Date.now().toString(36)}`
}

export class PhotoAlbumService {
  private readonly gateway: PhotoAlbumGateway

  constructor(gateway: PhotoAlbumGateway = apiGateway.app) {
    this.gateway = gateway
  }

  async listAlbums(options?: {
    all?: boolean
    page?: number
    limit?: number
    year?: number
    month?: number
    search?: string
  }): Promise<AlbumListResult> {
    const res = await this.gateway.getAlbums(options)
    const rawAlbums = Array.isArray(res?.albums) ? res.albums : []
    const albums = rawAlbums.map(normalizeAlbumItem)
    const availableMonths = formatAvailableMonthsThai(res?.availableMonths || [])
    const pagination = res?.pagination || {
      page: options?.page || 1,
      limit: options?.limit || 12,
      total: albums.length,
      totalPages: 1,
    }

    return {
      albums,
      availableMonths,
      pagination,
    }
  }

  async getHomepageAlbums(limit: number = 6): Promise<PhotoAlbumItem[]> {
    try {
      const result = await this.listAlbums({ all: false, page: 1, limit })
      return result.albums
    } catch (error) {
      logger.error({ err: error }, 'Failed to load homepage photo albums')
      return []
    }
  }

  async getAlbum(idOrSlug: string | number): Promise<PhotoAlbumItem | null> {
    try {
      const res = await this.gateway.getAlbumById(idOrSlug)
      if (!res?.data) return null
      return normalizeAlbumItem(res.data)
    } catch {
      return null
    }
  }

  async createAlbum(
    input: CreatePhotoAlbumInput,
    session?: PhotoAlbumAuditSession
  ): Promise<PhotoAlbumItem> {
    const slug = input.slug?.trim() || generateAlbumSlug(input.title)
    const normalizedImages = input.images.map((img, idx) => ({
      imageUrl: img.imageUrl,
      caption: img.caption || null,
      displayOrder: typeof img.displayOrder === 'number' ? img.displayOrder : idx,
    }))
    const coverImageUrl =
      input.coverImageUrl && normalizedImages.some((i) => i.imageUrl === input.coverImageUrl)
        ? input.coverImageUrl
        : normalizedImages[0]?.imageUrl || null

    const res = await this.gateway.createAlbum({
      title: input.title,
      slug,
      description: input.description || null,
      eventDate: input.eventDate,
      coverImageUrl,
      status: input.status || 'PUBLISHED',
      isPinned: Boolean(input.isPinned),
      createdBy: session?.username || null,
      images: normalizedImages,
    })

    const created = res?.data
      ? normalizeAlbumItem(res.data)
      : normalizeAlbumItem({
          id: res?.insertId,
          title: input.title,
          slug,
          description: input.description || null,
          eventDate: input.eventDate,
          coverImageUrl,
          status: input.status || 'PUBLISHED',
          isPinned: Boolean(input.isPinned),
          viewCount: 0,
          createdBy: session?.username || null,
          images: normalizedImages,
        })

    if (session) {
      await logAudit(
        'CREATE',
        'photo_albums',
        `สร้างอัลบั้มภาพข่าว ID ${created.id}: ${created.title} (${created.imageCount} ภาพ)`,
        session as any
      )
    }

    return created
  }

  async updateAlbum(
    id: number,
    input: UpdatePhotoAlbumInput,
    session?: PhotoAlbumAuditSession
  ): Promise<PhotoAlbumItem> {
    const normalizedImages = input.images?.map((img, idx) => ({
      imageUrl: img.imageUrl,
      caption: img.caption || null,
      displayOrder: typeof img.displayOrder === 'number' ? img.displayOrder : idx,
    }))

    const res = await this.gateway.updateAlbum(id, {
      title: input.title,
      description: input.description,
      eventDate: input.eventDate,
      coverImageUrl: input.coverImageUrl,
      status: input.status,
      isPinned: input.isPinned,
      images: normalizedImages,
    })

    const updated = normalizeAlbumItem(res?.data || { id })

    // Clean up local uploaded files that were removed from the album
    if (normalizedImages && Array.isArray(res?.previousImageUrls)) {
      const nextUrlSet = new Set(normalizedImages.map((i) => i.imageUrl))
      const removedUrls = res.previousImageUrls.filter(
        (url) => url.startsWith('/uploads/') && !nextUrlSet.has(url)
      )
      await Promise.allSettled(removedUrls.map((url) => DocumentStorage.delete(url)))
    }

    if (session) {
      await logAudit(
        'UPDATE',
        'photo_albums',
        `แก้ไขอัลบั้มภาพข่าว ID ${id}: ${updated.title}`,
        session as any
      )
    }

    return updated
  }

  async deleteAlbum(id: number, session?: PhotoAlbumAuditSession): Promise<void> {
    const res = await this.gateway.deleteAlbum(id)
    const deletedUrls = Array.isArray(res?.deletedImageUrls) ? res.deletedImageUrls : []

    await Promise.allSettled(
      deletedUrls
        .filter((url) => url.startsWith('/uploads/'))
        .map((url) => DocumentStorage.delete(url))
    )

    if (session) {
      await logAudit(
        'DELETE',
        'photo_albums',
        `ลบอัลบั้มภาพข่าว ID ${id} (${deletedUrls.length} ภาพ)`,
        session as any
      )
    }
  }

  async incrementView(idOrSlug: string | number): Promise<void> {
    await this.gateway.incrementAlbumView(idOrSlug)
  }
}

export const photoAlbumService = new PhotoAlbumService()
