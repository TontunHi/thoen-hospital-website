import { z } from 'zod'
import { apiGateway, GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { S3_CONFIG } from '@/lib/storage/s3Client'
import { toBangkokIsoString } from '@/lib/events/eventTimeUtils'

export type MediaVisibility = 'PUBLIC' | 'INTERNAL'
export type CategoryVisibility = 'ALL' | 'PUBLIC' | 'INTERNAL'
export type MediaType = 'VIDEO' | 'INFOGRAPHIC' | 'DOCUMENT'
export type MediaSourceType = 'MINIO' | 'YOUTUBE'

export interface OnlineMediaCategoryRecord {
  id: number
  name: string
  slug: string
  visibility: CategoryVisibility
  displayOrder: number
  isActive: boolean
  itemCount?: number
  createdAt: string
  updatedAt: string
}

export interface OnlineMediaAttachmentRecord {
  id: number
  mediaId: number
  title: string
  s3Bucket: string
  s3Key: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  displayOrder: number
  createdAt: string
}

export interface OnlineMediaAttachmentDto {
  id: number
  mediaId: number
  title: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  displayOrder: number
  streamUrl: string
  downloadUrl: string | null
}

export interface OnlineMediaItemRecord {
  id: number
  slug: string
  title: string
  description: string | null
  categoryId: number
  categoryName?: string
  visibility: MediaVisibility
  mediaType: MediaType
  sourceType: MediaSourceType
  s3Bucket: string | null
  s3Key: string | null
  youtubeUrl: string | null
  thumbnailS3Key: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
  allowDownload: boolean
  isPublished: boolean
  viewCount: number
  createdById: number | null
  createdByName: string | null
  createdByProfilePath?: string | null
  createdAt: string
  updatedAt: string
  attachments?: OnlineMediaAttachmentRecord[]
}

export interface OnlineMediaViewerItem {
  id: number
  slug: string
  title: string
  description: string | null
  categoryId: number
  categoryName?: string
  visibility: MediaVisibility
  mediaType: MediaType
  sourceType: MediaSourceType
  youtubeUrl: string | null
  youtubeEmbedUrl: string | null
  streamUrl: string | null
  downloadUrl: string | null
  thumbnailUrl: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
  allowDownload: boolean
  isPublished: boolean
  viewCount: number
  createdById: number | null
  createdByName: string | null
  createdByAvatarUrl: string | null
  createdAt: string
  updatedAt: string
  attachments: OnlineMediaAttachmentDto[]
}

export interface OnlineMediaViewRecord {
  id: number
  mediaId: number
  memberId: number
  memberName: string
  memberDepartment: string | null
  viewCount: number
  firstViewedAt: string
  lastViewedAt: string
}

export interface MediaActor {
  id?: number | null
  username: string
  email?: string | null
  name?: string | null
}

export interface MediaAttachmentInput {
  id?: number
  title: string
  s3Bucket: string
  s3Key: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  displayOrder?: number
}

export interface SaveMediaItemInput {
  title: string
  description?: string | null
  categoryId: number
  visibility: MediaVisibility
  mediaType: MediaType
  sourceType: MediaSourceType
  s3Bucket?: string | null
  s3Key?: string | null
  youtubeUrl?: string | null
  thumbnailS3Key?: string | null
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
  allowDownload?: boolean
  isPublished?: boolean
  attachments?: MediaAttachmentInput[]
}

export class OnlineMediaValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'OnlineMediaValidationError'
  }
}

export class OnlineMediaNotFoundError extends Error {
  readonly status = 404
  constructor(message: string) {
    super(message)
    this.name = 'OnlineMediaNotFoundError'
  }
}

const optionalPositiveInt = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? undefined : Number(v)),
  z.number().int().positive().optional()
)

const optionalNonNegativeNumber = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? null : Number(v)),
  z.number().nonnegative().nullable().optional()
)

const categorySchema = z.object({
  id: optionalPositiveInt,
  name: z.string().trim().min(1, 'กรุณาระบุชื่อหมวดหมู่สื่อ').max(200),
  visibility: z.enum(['ALL', 'PUBLIC', 'INTERNAL']).default('ALL'),
  displayOrder: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? 0 : Number(v)),
    z.number().int().default(0)
  ),
  isActive: z.boolean().default(true),
})

const attachmentInputSchema = z.object({
  id: optionalPositiveInt,
  title: z.string().trim().min(1, 'กรุณาระบุชื่อไฟล์แนบ').max(255),
  s3Bucket: z.string().trim().min(1).max(100),
  s3Key: z.string().trim().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  fileSize: optionalNonNegativeNumber,
  mimeType: z.string().trim().max(100).optional().nullable(),
  displayOrder: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? 0 : Number(v)),
    z.number().int().default(0)
  ),
})

const mediaItemSchema = z.object({
  title: z.string().trim().min(1, 'กรุณาระบุชื่อเรื่องสื่อ').max(500),
  description: z.string().trim().max(5000).optional().nullable(),
  categoryId: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? 0 : Number(v)),
    z.number({ message: 'กรุณาเลือกหมวดหมู่สื่อ' }).int().positive('กรุณาเลือกหมวดหมู่สื่อ')
  ),
  visibility: z.enum(['PUBLIC', 'INTERNAL']).default('PUBLIC'),
  mediaType: z.enum(['VIDEO', 'INFOGRAPHIC', 'DOCUMENT']).default('VIDEO'),
  sourceType: z.enum(['MINIO', 'YOUTUBE']).default('MINIO'),
  s3Bucket: z.string().trim().max(100).optional().nullable(),
  s3Key: z.string().trim().max(1000).optional().nullable(),
  youtubeUrl: z.string().trim().max(500).optional().nullable(),
  thumbnailS3Key: z.string().trim().max(1000).optional().nullable(),
  fileName: z.string().trim().max(255).optional().nullable(),
  fileSize: optionalNonNegativeNumber,
  mimeType: z.string().trim().max(100).optional().nullable(),
  allowDownload: z.boolean().default(true),
  isPublished: z.boolean().default(true),
  attachments: z.array(attachmentInputSchema).optional().default([]),
})

export function extractYoutubeVideoId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null
  const trimmed = urlOrId.trim()
  if (!trimmed) return null

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0]
      return seg && /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = parsed.searchParams.get('v')
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam
      }

      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        const candidate = parts[1]
        return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null
      }
    }
  } catch {
    return null
  }

  return null
}

export function buildYoutubeEmbedUrl(urlOrId?: string | null): string | null {
  const videoId = extractYoutubeVideoId(urlOrId)
  if (!videoId) return null
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
}

export function resolveBucketForVisibility(visibility: MediaVisibility): string {
  return visibility === 'INTERNAL' ? S3_CONFIG.privateBucket : S3_CONFIG.publicBucket
}

export function generateMediaSlug(title: string, suffix?: string): string {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/[\s]+/g, '-')
      .replace(/[^\u0E00-\u0E7Fa-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 140) || 'media'
  const uniquePart = suffix || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return `${base}-${uniquePart}`
}

export function extractFileExtension(
  fileNameOrKey?: string | null,
  mimeType?: string | null,
  mediaType?: MediaType | null
): string {
  const candidate = (fileNameOrKey || '').trim()
  const match = candidate.match(/(\.[a-zA-Z0-9]{1,10})$/)
  if (match) {
    return match[1].toLowerCase()
  }
  const mime = (mimeType || '').toLowerCase()
  if (mime.includes('pdf')) return '.pdf'
  if (mime.includes('mp4')) return '.mp4'
  if (mime.includes('webm')) return '.webm'
  if (mime.includes('quicktime')) return '.mov'
  if (mime.includes('png')) return '.png'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mediaType === 'DOCUMENT') return '.pdf'
  if (mediaType === 'INFOGRAPHIC') return '.jpg'
  if (mediaType === 'VIDEO') return '.mp4'
  return ''
}

export function cleanDisplayFileName(
  fileName?: string | null,
  fallbackTitle?: string | null,
  s3Key?: string | null,
  mimeType?: string | null,
  mediaType?: MediaType | null
): string {
  const ext = extractFileExtension(fileName || s3Key, mimeType, mediaType)
  const raw = (fileName || '').trim()
  if (raw) {
    const withoutExt = ext && raw.toLowerCase().endsWith(ext) ? raw.slice(0, -ext.length) : raw
    const stripped = withoutExt.replace(/-\d{12,14}-[a-z0-9]{4,10}$/i, '').trim()
    return `${stripped || withoutExt}${ext}`
  }
  const baseTitle = (fallbackTitle || 'media').trim().replace(/[\\/:*?"<>|\r\n\t]+/g, '-')
  return `${baseTitle || 'media'}${ext}`
}

export function resolveDownloadFileName(params: {
  customFileName?: string | null
  storedFileName?: string | null
  fallbackTitle?: string | null
  s3Key?: string | null
  mimeType?: string | null
  mediaType?: MediaType | null
}): string {
  const ext = extractFileExtension(
    params.storedFileName || params.s3Key,
    params.mimeType,
    params.mediaType
  )
  const rawCustom = (params.customFileName || '').trim()
  if (rawCustom) {
    const cleanedCustom = rawCustom
      .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
      .replace(/\.{2,}/g, '_')
      .replace(/[. ]+$/g, '')
      .trim()
    if (cleanedCustom) {
      const hasExt = ext && cleanedCustom.toLowerCase().endsWith(ext)
      const basePart = hasExt ? cleanedCustom.slice(0, -ext.length).trim() : cleanedCustom
      const safeBase = (basePart || 'download').slice(0, 100)
      return `${safeBase}${ext}`
    }
  }

  return cleanDisplayFileName(
    params.storedFileName,
    params.fallbackTitle,
    params.s3Key,
    params.mimeType,
    params.mediaType
  )
}

export function sanitizeMediaItemForViewer(
  item: OnlineMediaItemRecord,
  isAuthenticatedMember: boolean
): OnlineMediaViewerItem | null {
  if (item.visibility === 'INTERNAL' && !isAuthenticatedMember) {
    return null
  }

  const streamUrl = item.sourceType === 'MINIO' && item.s3Key ? `/api/media/stream/${item.id}` : null
  const downloadUrl =
    streamUrl && item.allowDownload ? `/api/media/stream/${item.id}?download=1` : null
  const thumbnailUrl = item.thumbnailS3Key
    ? `/api/media/stream/${item.id}?kind=thumbnail`
    : null
  const youtubeEmbedUrl =
    item.sourceType === 'YOUTUBE' && item.youtubeUrl
      ? buildYoutubeEmbedUrl(item.youtubeUrl)
      : null

  const cleanPrimaryFileName =
    item.sourceType === 'MINIO' && (item.fileName || item.s3Key)
      ? cleanDisplayFileName(item.fileName, item.title, item.s3Key, item.mimeType, item.mediaType)
      : item.fileName

  const attachments: OnlineMediaAttachmentDto[] = (item.attachments || []).map((att) => ({
    id: att.id,
    mediaId: att.mediaId,
    title: att.title,
    fileName: cleanDisplayFileName(att.fileName, att.title, att.s3Key, att.mimeType, 'DOCUMENT'),
    fileSize: att.fileSize,
    mimeType: att.mimeType,
    displayOrder: att.displayOrder,
    streamUrl: `/api/media/stream/${item.id}?attachmentId=${att.id}`,
    downloadUrl: item.allowDownload
      ? `/api/media/stream/${item.id}?attachmentId=${att.id}&download=1`
      : null,
  }))

  const createdByAvatarUrl = item.createdByProfilePath
    ? `/api/media/stream/${item.id}?kind=avatar`
    : null

  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    visibility: item.visibility,
    mediaType: item.mediaType,
    sourceType: item.sourceType,
    youtubeUrl: item.sourceType === 'YOUTUBE' ? item.youtubeUrl : null,
    youtubeEmbedUrl,
    streamUrl,
    downloadUrl,
    thumbnailUrl,
    fileName: cleanPrimaryFileName,
    fileSize: item.fileSize,
    mimeType: item.mimeType,
    allowDownload: item.allowDownload,
    isPublished: item.isPublished,
    viewCount: item.viewCount,
    createdById: item.createdById,
    createdByName: item.createdByName,
    createdByAvatarUrl,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    attachments,
  }
}

function serializeDateField(val: unknown): string {
  if (!val) return ''
  return toBangkokIsoString(val as Date | string) || String(val)
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function mapCategoryRow(row: Record<string, unknown>): OnlineMediaCategoryRecord {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    visibility: String(row.visibility || 'ALL').toUpperCase() as CategoryVisibility,
    displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
    isActive: Boolean(Number(row.isActive ?? row.is_active ?? 1)),
    itemCount: row.itemCount !== undefined ? Number(row.itemCount) : undefined,
    createdAt: serializeDateField(row.createdAt ?? row.created_at),
    updatedAt: serializeDateField(row.updatedAt ?? row.updated_at),
  }
}

function mapAttachmentRow(row: Record<string, unknown>): OnlineMediaAttachmentRecord {
  return {
    id: Number(row.id),
    mediaId: Number(row.mediaId ?? row.media_id),
    title: String(row.title ?? ''),
    s3Bucket: String(row.s3Bucket ?? row.s3_bucket ?? ''),
    s3Key: String(row.s3Key ?? row.s3_key ?? ''),
    fileName: String(row.fileName ?? row.file_name ?? ''),
    fileSize: toNullableNumber(row.fileSize ?? row.file_size),
    mimeType: row.mimeType ?? row.mime_type ? String(row.mimeType ?? row.mime_type) : null,
    displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
    createdAt: serializeDateField(row.createdAt ?? row.created_at),
  }
}

function mapMediaItemRow(row: Record<string, unknown>): OnlineMediaItemRecord {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : null,
    categoryId: Number(row.categoryId ?? row.category_id),
    categoryName: row.categoryName ? String(row.categoryName) : undefined,
    visibility: String(row.visibility || 'PUBLIC').toUpperCase() as MediaVisibility,
    mediaType: String(row.mediaType ?? row.media_type ?? 'VIDEO').toUpperCase() as MediaType,
    sourceType: String(row.sourceType ?? row.source_type ?? 'MINIO').toUpperCase() as MediaSourceType,
    s3Bucket: row.s3Bucket ?? row.s3_bucket ? String(row.s3Bucket ?? row.s3_bucket) : null,
    s3Key: row.s3Key ?? row.s3_key ? String(row.s3Key ?? row.s3_key) : null,
    youtubeUrl: row.youtubeUrl ?? row.youtube_url ? String(row.youtubeUrl ?? row.youtube_url) : null,
    thumbnailS3Key:
      row.thumbnailS3Key ?? row.thumbnail_s3_key
        ? String(row.thumbnailS3Key ?? row.thumbnail_s3_key)
        : null,
    fileName: row.fileName ?? row.file_name ? String(row.fileName ?? row.file_name) : null,
    fileSize: toNullableNumber(row.fileSize ?? row.file_size),
    mimeType: row.mimeType ?? row.mime_type ? String(row.mimeType ?? row.mime_type) : null,
    allowDownload: Boolean(Number(row.allowDownload ?? row.allow_download ?? 1)),
    isPublished: Boolean(Number(row.isPublished ?? row.is_published ?? 1)),
    viewCount: Number(row.viewCount ?? row.view_count ?? 0),
    createdById: toNullableNumber(row.createdById ?? row.created_by_id),
    createdByName:
      row.createdByName ?? row.created_by_name
        ? String(row.createdByName ?? row.created_by_name)
        : null,
    createdByProfilePath:
      row.createdByProfilePath ?? row.created_by_profile_path
        ? String(row.createdByProfilePath ?? row.created_by_profile_path)
        : null,
    createdAt: serializeDateField(row.createdAt ?? row.created_at),
    updatedAt: serializeDateField(row.updatedAt ?? row.updated_at),
  }
}

function mapViewRow(row: Record<string, unknown>): OnlineMediaViewRecord {
  return {
    id: Number(row.id),
    mediaId: Number(row.mediaId ?? row.media_id),
    memberId: Number(row.memberId ?? row.member_id),
    memberName: String(row.memberName ?? row.member_name ?? ''),
    memberDepartment:
      row.memberDepartment ?? row.member_department
        ? String(row.memberDepartment ?? row.member_department)
        : null,
    viewCount: Number(row.viewCount ?? row.view_count ?? 1),
    firstViewedAt: serializeDateField(row.firstViewedAt ?? row.first_viewed_at),
    lastViewedAt: serializeDateField(row.lastViewedAt ?? row.last_viewed_at),
  }
}

export class OnlineMediaService {
  static async listCategories(
    options: { includeInactive?: boolean; isAuthenticated?: boolean } = {}
  ): Promise<OnlineMediaCategoryRecord[]> {
    const rows = await apiGateway.app.getOnlineMediaCategories(options)
    return (Array.isArray(rows) ? rows : []).map(mapCategoryRow)
  }

  static async saveCategory(
    input: {
      id?: number
      name: string
      visibility?: CategoryVisibility
      displayOrder?: number
      isActive?: boolean
    },
    actor: MediaActor
  ): Promise<OnlineMediaCategoryRecord> {
    const parsed = categorySchema.safeParse(input)
    if (!parsed.success) {
      throw new OnlineMediaValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const { id, name, visibility, displayOrder, isActive } = parsed.data

    try {
      const saved = await apiGateway.app.saveOnlineMediaCategory({
        id,
        name,
        slug: id ? undefined : generateMediaSlug(name),
        visibility,
        displayOrder,
        isActive,
      })
      await logAudit(
        id ? 'UPDATE' : 'CREATE',
        'online_media_categories',
        id
          ? `แก้ไขหมวดหมู่สื่อ "${name}" (ID: ${id}) โดย ${actor.username}`
          : `สร้างหมวดหมู่สื่อ "${name}" โดย ${actor.username}`,
        actor
      )
      return mapCategoryRow(saved)
    } catch (err) {
      if (err instanceof GatewayNotFoundError) {
        throw new OnlineMediaNotFoundError(err.message)
      }
      if (err instanceof GatewayError && err.status === 400) {
        throw new OnlineMediaValidationError(err.message)
      }
      throw err
    }
  }

  static async deleteCategory(id: number, actor: MediaActor): Promise<void> {
    try {
      const res = await apiGateway.app.deleteOnlineMediaCategory(id)
      await logAudit(
        'DELETE',
        'online_media_categories',
        `ลบหมวดหมู่สื่อ "${res?.name || id}" (ID: ${id}) โดย ${actor.username}`,
        actor
      )
    } catch (err) {
      if (err instanceof GatewayNotFoundError) {
        throw new OnlineMediaNotFoundError(err.message)
      }
      if (err instanceof GatewayError && err.status === 400) {
        throw new OnlineMediaValidationError(err.message)
      }
      throw err
    }
  }

  static async listMediaItems(filters: {
    visibility?: 'PUBLIC' | 'INTERNAL' | 'ALL'
    categoryId?: number
    mediaType?: MediaType
    search?: string
    includeUnpublished?: boolean
    isAuthenticated: boolean
  }): Promise<OnlineMediaViewerItem[]> {
    const effectiveFilters = filters.isAuthenticated
      ? filters
      : { ...filters, visibility: 'PUBLIC' as const, includeUnpublished: false }

    const rows = await apiGateway.app.getOnlineMediaItems(effectiveFilters)
    const sanitized: OnlineMediaViewerItem[] = []
    for (const row of Array.isArray(rows) ? rows : []) {
      const item = mapMediaItemRow(row)
      const rawAtts = Array.isArray((row as Record<string, unknown>).attachments)
        ? ((row as Record<string, unknown>).attachments as Record<string, unknown>[])
        : []
      item.attachments = rawAtts.map(mapAttachmentRow)
      const safe = sanitizeMediaItemForViewer(item, filters.isAuthenticated)
      if (safe) sanitized.push(safe)
    }
    return sanitized
  }

  static async getMediaItemBySlugOrId(
    slugOrId: string | number,
    options: { isAuthenticated: boolean; includeUnpublished?: boolean }
  ): Promise<{ item: OnlineMediaViewerItem | null; requiresAuth: boolean }> {
    const res = await apiGateway.app.getOnlineMediaItemBySlugOrId(slugOrId, options)
    if (!res?.item) {
      return { item: null, requiresAuth: Boolean(res?.requiresAuth) }
    }
    const item = mapMediaItemRow(res.item)
    const rawAtts = Array.isArray((res.item as Record<string, unknown>).attachments)
      ? ((res.item as Record<string, unknown>).attachments as Record<string, unknown>[])
      : []
    item.attachments = rawAtts.map(mapAttachmentRow)
    return {
      item: sanitizeMediaItemForViewer(item, options.isAuthenticated),
      requiresAuth: false,
    }
  }

  static async getRawMediaStreamTarget(
    mediaId: number,
    options?: { attachmentId?: number | null }
  ): Promise<{
    item: OnlineMediaItemRecord
    attachment?: OnlineMediaAttachmentRecord
  } | null> {
    try {
      const res = await apiGateway.app.getOnlineMediaStreamTarget(mediaId, options?.attachmentId)
      if (!res?.item) return null
      const item = mapMediaItemRow(res.item)
      return res.attachment
        ? { item, attachment: mapAttachmentRow(res.attachment) }
        : { item }
    } catch (err) {
      if (err instanceof GatewayNotFoundError) {
        return null
      }
      throw err
    }
  }

  static async getMediaItemForManage(mediaId: number): Promise<OnlineMediaItemRecord | null> {
    try {
      const row = await apiGateway.app.getOnlineMediaItemForManage(mediaId)
      if (!row) return null
      const item = mapMediaItemRow(row)
      const rawAtts = Array.isArray((row as Record<string, unknown>).attachments)
        ? ((row as Record<string, unknown>).attachments as Record<string, unknown>[])
        : []
      item.attachments = rawAtts.map(mapAttachmentRow)
      return item
    } catch (err) {
      if (err instanceof GatewayNotFoundError) {
        return null
      }
      throw err
    }
  }

  static async recordMediaView(
    mediaId: number,
    viewer?: { memberId: number; memberName: string; memberDepartment?: string | null } | null
  ): Promise<void> {
    await apiGateway.app.recordOnlineMediaView(mediaId, viewer)
  }

  static async listMediaViewers(mediaId: number): Promise<OnlineMediaViewRecord[]> {
    const rows = await apiGateway.app.getOnlineMediaViewers(mediaId)
    return (Array.isArray(rows) ? rows : []).map(mapViewRow)
  }

  static async createMediaItem(
    input: SaveMediaItemInput,
    actor: MediaActor
  ): Promise<OnlineMediaItemRecord> {
    const parsed = mediaItemSchema.safeParse(input)
    if (!parsed.success) {
      throw new OnlineMediaValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const data = parsed.data
    if (data.sourceType === 'YOUTUBE') {
      if (!extractYoutubeVideoId(data.youtubeUrl)) {
        throw new OnlineMediaValidationError('ลิงก์ YouTube ไม่ถูกต้อง กรุณาตรวจสอบ URL อีกครั้ง')
      }
    } else if (!data.s3Key) {
      throw new OnlineMediaValidationError('กรุณาอัปโหลดไฟล์สื่อขึ้น MinIO')
    }

    const bucket =
      data.sourceType === 'MINIO'
        ? data.s3Bucket || resolveBucketForVisibility(data.visibility)
        : data.thumbnailS3Key
        ? resolveBucketForVisibility(data.visibility)
        : null

    const slug = generateMediaSlug(data.title)

    try {
      const createdRow = await apiGateway.app.createOnlineMediaItem({
        slug,
        title: data.title,
        description: data.description || null,
        categoryId: data.categoryId,
        visibility: data.visibility,
        mediaType: data.mediaType,
        sourceType: data.sourceType,
        s3Bucket: bucket,
        s3Key: data.sourceType === 'MINIO' ? data.s3Key : null,
        youtubeUrl: data.sourceType === 'YOUTUBE' ? data.youtubeUrl : null,
        thumbnailS3Key: data.thumbnailS3Key || null,
        fileName: data.fileName || null,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType || null,
        allowDownload: data.allowDownload,
        isPublished: data.isPublished,
        createdById: actor.id ?? null,
        createdByName: actor.name || actor.username,
        attachments: data.attachments,
      })
      await logAudit(
        'CREATE',
        'online_media_items',
        `เพิ่มสื่อออนไลน์ "${data.title}" (${data.visibility}/${data.mediaType}) โดย ${actor.username}`,
        actor
      )
      const item = mapMediaItemRow(createdRow)
      const rawAtts = Array.isArray((createdRow as Record<string, unknown>).attachments)
        ? ((createdRow as Record<string, unknown>).attachments as Record<string, unknown>[])
        : []
      item.attachments = rawAtts.map(mapAttachmentRow)
      return item
    } catch (err) {
      if (err instanceof GatewayError && err.status === 400) {
        throw new OnlineMediaValidationError(err.message)
      }
      throw err
    }
  }

  static async updateMediaItem(
    id: number,
    input: Partial<SaveMediaItemInput>,
    actor: MediaActor
  ): Promise<OnlineMediaItemRecord> {
    const existing = await this.getMediaItemForManage(id)
    if (!existing) {
      throw new OnlineMediaNotFoundError('ไม่พบรายการสื่อที่ต้องการแก้ไข')
    }

    const merged = {
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      categoryId: input.categoryId ?? existing.categoryId,
      visibility: input.visibility ?? existing.visibility,
      mediaType: input.mediaType ?? existing.mediaType,
      sourceType: input.sourceType ?? existing.sourceType,
      s3Bucket: input.s3Bucket !== undefined ? input.s3Bucket : existing.s3Bucket,
      s3Key: input.s3Key !== undefined ? input.s3Key : existing.s3Key,
      youtubeUrl: input.youtubeUrl !== undefined ? input.youtubeUrl : existing.youtubeUrl,
      thumbnailS3Key:
        input.thumbnailS3Key !== undefined ? input.thumbnailS3Key : existing.thumbnailS3Key,
      fileName: input.fileName !== undefined ? input.fileName : existing.fileName,
      fileSize: input.fileSize !== undefined ? input.fileSize : existing.fileSize,
      mimeType: input.mimeType !== undefined ? input.mimeType : existing.mimeType,
      allowDownload: input.allowDownload ?? existing.allowDownload,
      isPublished: input.isPublished ?? existing.isPublished,
      attachments:
        input.attachments !== undefined
          ? input.attachments
          : (existing.attachments || []).map((a) => ({
              id: a.id,
              title: a.title,
              s3Bucket: a.s3Bucket,
              s3Key: a.s3Key,
              fileName: a.fileName,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
              displayOrder: a.displayOrder,
            })),
    }

    const parsed = mediaItemSchema.safeParse(merged)
    if (!parsed.success) {
      throw new OnlineMediaValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const data = parsed.data
    if (data.sourceType === 'YOUTUBE' && !extractYoutubeVideoId(data.youtubeUrl)) {
      throw new OnlineMediaValidationError('ลิงก์ YouTube ไม่ถูกต้อง กรุณาตรวจสอบ URL อีกครั้ง')
    }
    if (data.sourceType === 'MINIO' && !data.s3Key) {
      throw new OnlineMediaValidationError('กรุณาอัปโหลดไฟล์สื่อขึ้น MinIO')
    }

    if (existing.s3Key && existing.s3Bucket) {
      const nextPrimaryKey = data.sourceType === 'MINIO' ? data.s3Key : null
      if (existing.s3Key !== nextPrimaryKey) {
        await DocumentStorage.deleteFromS3Only({
          bucket: existing.s3Bucket,
          s3Key: existing.s3Key,
        })
      }
    }

    if (existing.thumbnailS3Key && existing.thumbnailS3Key !== (data.thumbnailS3Key || null)) {
      const thumbBucket = existing.s3Bucket || resolveBucketForVisibility(existing.visibility)
      await DocumentStorage.deleteFromS3Only({
        bucket: thumbBucket,
        s3Key: existing.thumbnailS3Key,
      })
    }

    const nextBucket =
      data.sourceType === 'MINIO'
        ? data.s3Bucket || resolveBucketForVisibility(data.visibility)
        : data.thumbnailS3Key
        ? data.s3Bucket || resolveBucketForVisibility(data.visibility)
        : null

    if (input.attachments !== undefined) {
      const retainedKeys = new Set(data.attachments.map((a) => a.s3Key))
      for (const oldAtt of existing.attachments || []) {
        if (!retainedKeys.has(oldAtt.s3Key)) {
          await DocumentStorage.deleteFromS3Only({
            bucket: oldAtt.s3Bucket,
            s3Key: oldAtt.s3Key,
          })
        }
      }
    }

    const updatedRow = await apiGateway.app.updateOnlineMediaItem(id, {
      title: data.title,
      description: data.description || null,
      categoryId: data.categoryId,
      visibility: data.visibility,
      mediaType: data.mediaType,
      sourceType: data.sourceType,
      s3Bucket: nextBucket,
      s3Key: data.sourceType === 'MINIO' ? data.s3Key : null,
      youtubeUrl: data.sourceType === 'YOUTUBE' ? data.youtubeUrl : null,
      thumbnailS3Key: data.thumbnailS3Key || null,
      fileName: data.sourceType === 'MINIO' ? data.fileName || null : null,
      fileSize: data.sourceType === 'MINIO' ? data.fileSize ?? null : null,
      mimeType: data.sourceType === 'MINIO' ? data.mimeType || null : null,
      allowDownload: data.allowDownload,
      isPublished: data.isPublished,
      attachments: input.attachments !== undefined ? data.attachments : undefined,
    })

    await logAudit(
      'UPDATE',
      'online_media_items',
      `แก้ไขสื่อออนไลน์ "${data.title}" (ID: ${id}) โดย ${actor.username}`,
      actor
    )

    const item = mapMediaItemRow(updatedRow)
    const rawAtts = Array.isArray((updatedRow as Record<string, unknown>).attachments)
      ? ((updatedRow as Record<string, unknown>).attachments as Record<string, unknown>[])
      : []
    item.attachments = rawAtts.map(mapAttachmentRow)
    return item
  }

  static async deleteMediaItem(id: number, actor: MediaActor): Promise<void> {
    const existing = await this.getMediaItemForManage(id)
    if (!existing) {
      throw new OnlineMediaNotFoundError('ไม่พบรายการสื่อที่ต้องการลบ')
    }

    if (existing.s3Key && existing.s3Bucket) {
      await DocumentStorage.deleteFromS3Only({
        bucket: existing.s3Bucket,
        s3Key: existing.s3Key,
      })
    }

    if (existing.thumbnailS3Key) {
      const thumbBucket = existing.s3Bucket || resolveBucketForVisibility(existing.visibility)
      await DocumentStorage.deleteFromS3Only({
        bucket: thumbBucket,
        s3Key: existing.thumbnailS3Key,
      })
    }

    for (const att of existing.attachments || []) {
      await DocumentStorage.deleteFromS3Only({
        bucket: att.s3Bucket,
        s3Key: att.s3Key,
      })
    }

    await apiGateway.app.deleteOnlineMediaItem(id)

    await logAudit(
      'DELETE',
      'online_media_items',
      `ลบสื่อออนไลน์ "${existing.title}" (ID: ${id}) โดย ${actor.username}`,
      actor
    )
  }
}
