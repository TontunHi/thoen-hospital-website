import { z } from 'zod'
import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway, GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { S3_CONFIG } from '@/lib/storage/s3Client'
import { toBangkokIsoString } from '@/lib/events/eventTimeUtils'

export type MediaVisibility = 'PUBLIC' | 'INTERNAL'
export type CategoryVisibility = 'ALL' | 'PUBLIC' | 'INTERNAL'
export type MediaType = 'VIDEO' | 'INFOGRAPHIC' | 'DOCUMENT'
export type MediaSourceType = 'MINIO' | 'YOUTUBE'

export type QueryExecutor = (sql: string, params?: unknown[]) => Promise<any>

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

/**
 * Extracts an 11-character YouTube Video ID from standard, short, embed, shorts, or live URLs.
 */
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

/**
 * Builds a privacy-friendly YouTube embed URL for player iframes.
 */
export function buildYoutubeEmbedUrl(urlOrId?: string | null): string | null {
  const videoId = extractYoutubeVideoId(urlOrId)
  if (!videoId) return null
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
}

/**
 * Maps media visibility scope to its dedicated MinIO bucket.
 */
export function resolveBucketForVisibility(visibility: MediaVisibility): string {
  return visibility === 'INTERNAL' ? S3_CONFIG.privateBucket : S3_CONFIG.publicBucket
}

/**
 * Generates a URL-safe slug preserving Thai and alphanumeric characters.
 */
export function generateMediaSlug(title: string, suffix?: string): string {
  const base = title
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

/**
 * Extracts a normalized file extension (including leading dot, e.g. ".mp4", ".pdf")
 * from a file name, S3 key, or MIME type / mediaType fallback.
 */
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

/**
 * Strips any auto-generated S3 timestamp/random suffix (e.g. "-1732089123456-ab12cd")
 * from a stored filename while preserving its extension.
 */
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

/**
 * Resolves a safe download filename, applying an optional user-specified custom filename
 * and guaranteeing that the original file extension is preserved.
 */
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

/**
 * Maps internal media records into viewer-safe DTOs.
 * Enforces visibility boundaries and strips raw internal MinIO bucket/key details.
 */
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
    visibility: (String(row.visibility || 'ALL').toUpperCase() as CategoryVisibility),
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
    visibility: (String(row.visibility || 'PUBLIC').toUpperCase() as MediaVisibility),
    mediaType: (String(row.mediaType ?? row.media_type ?? 'VIDEO').toUpperCase() as MediaType),
    sourceType: (String(row.sourceType ?? row.source_type ?? 'MINIO').toUpperCase() as MediaSourceType),
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

const CREATE_CATEGORIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS online_media_categories (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'ALL',
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    UNIQUE KEY uq_media_cat_slug (slug),
    INDEX idx_media_cat_vis_order (visibility, is_active, display_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_ITEMS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS online_media_items (
    id INT NOT NULL AUTO_INCREMENT,
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    category_id INT NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    media_type VARCHAR(30) NOT NULL DEFAULT 'VIDEO',
    source_type VARCHAR(20) NOT NULL DEFAULT 'MINIO',
    s3_bucket VARCHAR(100) NULL,
    s3_key VARCHAR(1000) NULL,
    youtube_url VARCHAR(500) NULL,
    thumbnail_s3_key VARCHAR(1000) NULL,
    file_name VARCHAR(255) NULL,
    file_size BIGINT NULL,
    mime_type VARCHAR(100) NULL,
    allow_download BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    view_count INT NOT NULL DEFAULT 0,
    created_by_id INT NULL,
    created_by_name VARCHAR(255) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    UNIQUE KEY uq_media_item_slug (slug),
    INDEX idx_media_item_vis_pub (visibility, is_published, created_at),
    INDEX idx_media_item_cat (category_id),
    INDEX idx_media_item_type (media_type),
    CONSTRAINT fk_media_item_cat FOREIGN KEY (category_id) REFERENCES online_media_categories(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_ATTACHMENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS online_media_attachments (
    id INT NOT NULL AUTO_INCREMENT,
    media_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NULL,
    mime_type VARCHAR(100) NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    INDEX idx_media_att_media_order (media_id, display_order),
    CONSTRAINT fk_media_att_item FOREIGN KEY (media_id) REFERENCES online_media_items(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_VIEWS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS online_media_views (
    id INT NOT NULL AUTO_INCREMENT,
    media_id INT NOT NULL,
    member_id INT NOT NULL,
    member_name VARCHAR(255) NOT NULL,
    member_department VARCHAR(150) NULL,
    view_count INT NOT NULL DEFAULT 1,
    first_viewed_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    last_viewed_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    UNIQUE KEY uq_media_view_media_member (media_id, member_id),
    INDEX idx_media_view_last (media_id, last_viewed_at),
    CONSTRAINT fk_media_view_item FOREIGN KEY (media_id) REFERENCES online_media_items(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

let schemaReadyPromise: Promise<void> | null = null

/**
 * Ensures Online Media Library tables and starter categories exist.
 */
export async function ensureOnlineMediaTables(queryFn: QueryExecutor = queryMemberDb): Promise<void> {
  const runInit = async () => {
    await queryFn(CREATE_CATEGORIES_TABLE_SQL)
    await queryFn(CREATE_ITEMS_TABLE_SQL)
    await queryFn(CREATE_ATTACHMENTS_TABLE_SQL)
    await queryFn(CREATE_VIEWS_TABLE_SQL)

    const countRows = await queryFn(`SELECT COUNT(*) AS cnt FROM online_media_categories`)
    const count = Number(countRows?.[0]?.cnt || 0)
    if (count === 0) {
      await queryFn(
        `INSERT INTO online_media_categories (name, slug, visibility, display_order, is_active) VALUES
         (?, ?, ?, ?, ?),
         (?, ?, ?, ?, ?),
         (?, ?, ?, ?, ?)`,
        [
          'สื่อสุขศึกษาสำหรับประชาชน',
          'public-health-education',
          'PUBLIC',
          1,
          1,
          'สื่อการอบรมและพัฒนาบุคลากร',
          'staff-training-internal',
          'INTERNAL',
          2,
          1,
          'อินโฟกราฟิกและคู่มือสุขภาพ',
          'infographics-and-guides',
          'ALL',
          3,
          1,
        ]
      )
    }
  }

  if (queryFn !== queryMemberDb) {
    return
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = runInit().catch((err) => {
      schemaReadyPromise = null
      throw err
    })
  }
  await schemaReadyPromise
}

export class OnlineMediaService {
  static async listCategories(
    options: { includeInactive?: boolean; isAuthenticated?: boolean } = {},
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaCategoryRecord[]> {
    if (queryFn === queryMemberDb) {
      const rows = await apiGateway.app.getOnlineMediaCategories(options)
      return (Array.isArray(rows) ? rows : []).map(mapCategoryRow)
    }

    await ensureOnlineMediaTables(queryFn)

    const whereClauses: string[] = []
    if (!options.includeInactive) {
      whereClauses.push('c.is_active = 1')
    }
    if (!options.isAuthenticated) {
      whereClauses.push("c.visibility IN ('ALL', 'PUBLIC')")
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const itemVisJoinCondition = options.isAuthenticated
      ? options.includeInactive
        ? ''
        : 'AND i.is_published = 1'
      : "AND i.is_published = 1 AND i.visibility = 'PUBLIC'"

    const rows = await queryFn(
      `SELECT
        c.id,
        c.name,
        c.slug,
        c.visibility,
        c.display_order AS displayOrder,
        c.is_active AS isActive,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        COUNT(i.id) AS itemCount
      FROM online_media_categories c
      LEFT JOIN online_media_items i ON i.category_id = c.id ${itemVisJoinCondition}
      ${whereSql}
      GROUP BY c.id, c.name, c.slug, c.visibility, c.display_order, c.is_active, c.created_at, c.updated_at
      ORDER BY c.display_order ASC, c.id ASC`
    )

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
    actor: MediaActor,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaCategoryRecord> {
    const parsed = categorySchema.safeParse(input)
    if (!parsed.success) {
      throw new OnlineMediaValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const { id, name, visibility, displayOrder, isActive } = parsed.data

    if (queryFn === queryMemberDb) {
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

    await ensureOnlineMediaTables(queryFn)

    if (id) {
      const existing = await queryFn(`SELECT id FROM online_media_categories WHERE id = ?`, [id])
      if (!existing?.[0]) {
        throw new OnlineMediaNotFoundError('ไม่พบหมวดหมู่สื่อที่ต้องการแก้ไข')
      }

      await queryFn(
        `UPDATE online_media_categories
         SET name = ?, visibility = ?, display_order = ?, is_active = ?, updated_at = NOW()
         WHERE id = ?`,
        [name, visibility, displayOrder, isActive ? 1 : 0, id]
      )

      await logAudit(
        'UPDATE',
        'online_media_categories',
        `แก้ไขหมวดหมู่สื่อ "${name}" (ID: ${id}) โดย ${actor.username}`,
        actor
      )

      const updated = await queryFn(`SELECT * FROM online_media_categories WHERE id = ?`, [id])
      return mapCategoryRow(updated[0])
    }

    const slug = generateMediaSlug(name)
    const res = await queryFn(
      `INSERT INTO online_media_categories (name, slug, visibility, display_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, slug, visibility, displayOrder, isActive ? 1 : 0]
    )

    const createdId = Number(res?.insertId || res?.[0]?.insertId)
    await logAudit(
      'CREATE',
      'online_media_categories',
      `สร้างหมวดหมู่สื่อ "${name}" โดย ${actor.username}`,
      actor
    )

    const created = await queryFn(`SELECT * FROM online_media_categories WHERE id = ?`, [createdId])
    return mapCategoryRow(created[0])
  }

  static async deleteCategory(
    id: number,
    actor: MediaActor,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<void> {
    if (queryFn === queryMemberDb) {
      try {
        const res = await apiGateway.app.deleteOnlineMediaCategory(id)
        await logAudit(
          'DELETE',
          'online_media_categories',
          `ลบหมวดหมู่สื่อ "${res?.name || id}" (ID: ${id}) โดย ${actor.username}`,
          actor
        )
        return
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

    await ensureOnlineMediaTables(queryFn)

    const existing = await queryFn(`SELECT id, name FROM online_media_categories WHERE id = ?`, [id])
    if (!existing?.[0]) {
      throw new OnlineMediaNotFoundError('ไม่พบหมวดหมู่สื่อที่ต้องการลบ')
    }

    const usedRows = await queryFn(
      `SELECT COUNT(*) AS cnt FROM online_media_items WHERE category_id = ?`,
      [id]
    )
    if (Number(usedRows?.[0]?.cnt || 0) > 0) {
      throw new OnlineMediaValidationError(
        'ไม่สามารถลบหมวดหมู่ที่มีรายการสื่ออยู่ได้ กรุณาย้ายหรือลบสื่อภายในหมวดหมู่นี้ก่อน'
      )
    }

    await queryFn(`DELETE FROM online_media_categories WHERE id = ?`, [id])
    await logAudit(
      'DELETE',
      'online_media_categories',
      `ลบหมวดหมู่สื่อ "${existing[0].name}" (ID: ${id}) โดย ${actor.username}`,
      actor
    )
  }

  static async listMediaItems(
    filters: {
      visibility?: 'PUBLIC' | 'INTERNAL' | 'ALL'
      categoryId?: number
      mediaType?: MediaType
      search?: string
      includeUnpublished?: boolean
      isAuthenticated: boolean
    },
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaViewerItem[]> {
    if (queryFn === queryMemberDb) {
      const rows = await apiGateway.app.getOnlineMediaItems(filters)
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

    await ensureOnlineMediaTables(queryFn)

    const whereClauses: string[] = []
    const params: unknown[] = []

    if (!filters.isAuthenticated) {
      whereClauses.push("i.visibility = 'PUBLIC'")
      whereClauses.push('i.is_published = 1')
    } else {
      if (filters.visibility && filters.visibility !== 'ALL') {
        whereClauses.push('i.visibility = ?')
        params.push(filters.visibility)
      }
      if (!filters.includeUnpublished) {
        whereClauses.push('i.is_published = 1')
      }
    }

    if (filters.categoryId) {
      whereClauses.push('i.category_id = ?')
      params.push(filters.categoryId)
    }

    if (filters.mediaType) {
      whereClauses.push('i.media_type = ?')
      params.push(filters.mediaType)
    }

    if (filters.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`
      whereClauses.push('(i.title LIKE ? OR i.description LIKE ?)')
      params.push(q, q)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const rows = await queryFn(
      `SELECT
        i.*,
        c.name AS categoryName,
        (
          SELECT m.profile_path
          FROM members m
          WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
             OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
          LIMIT 1
        ) AS createdByProfilePath
      FROM online_media_items i
      LEFT JOIN online_media_categories c ON c.id = i.category_id
      ${whereSql}
      ORDER BY i.created_at DESC, i.id DESC`,
      params
    )

    const items = (Array.isArray(rows) ? rows : []).map(mapMediaItemRow)
    if (items.length === 0) return []

    const mediaIds = items.map((item) => item.id)
    const placeholders = mediaIds.map(() => '?').join(', ')
    const attRows = await queryFn(
      `SELECT * FROM online_media_attachments WHERE media_id IN (${placeholders}) ORDER BY display_order ASC, id ASC`,
      mediaIds
    )

    const attachmentsByMediaId = new Map<number, OnlineMediaAttachmentRecord[]>()
    for (const row of Array.isArray(attRows) ? attRows : []) {
      const att = mapAttachmentRow(row)
      const list = attachmentsByMediaId.get(att.mediaId) || []
      list.push(att)
      attachmentsByMediaId.set(att.mediaId, list)
    }

    const sanitized: OnlineMediaViewerItem[] = []
    for (const item of items) {
      item.attachments = attachmentsByMediaId.get(item.id) || []
      const safe = sanitizeMediaItemForViewer(item, filters.isAuthenticated)
      if (safe) sanitized.push(safe)
    }
    return sanitized
  }

  static async getMediaItemBySlugOrId(
    slugOrId: string | number,
    options: { isAuthenticated: boolean; includeUnpublished?: boolean },
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<{ item: OnlineMediaViewerItem | null; requiresAuth: boolean }> {
    if (queryFn === queryMemberDb) {
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

    await ensureOnlineMediaTables(queryFn)

    const rawStr = String(slugOrId).trim()
    let decodedStr = rawStr
    try {
      decodedStr = decodeURIComponent(rawStr)
    } catch {
      decodedStr = rawStr
    }

    const numericId = /^\d+$/.test(decodedStr) ? parseInt(decodedStr, 10) : null
    const whereField = numericId !== null ? 'i.id = ?' : 'i.slug = ?'
    const whereParam = numericId !== null ? numericId : decodedStr

    const rows = await queryFn(
      `SELECT
        i.*,
        c.name AS categoryName,
        (
          SELECT m.profile_path
          FROM members m
          WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
             OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
          LIMIT 1
        ) AS createdByProfilePath
      FROM online_media_items i
      LEFT JOIN online_media_categories c ON c.id = i.category_id
      WHERE ${whereField}
      LIMIT 1`,
      [whereParam]
    )

    const row = rows?.[0]
    if (!row) {
      return { item: null, requiresAuth: false }
    }

    const item = mapMediaItemRow(row)

    if (!item.isPublished && !options.includeUnpublished) {
      return { item: null, requiresAuth: false }
    }

    if (item.visibility === 'INTERNAL' && !options.isAuthenticated) {
      return { item: null, requiresAuth: true }
    }

    const attRows = await queryFn(
      `SELECT * FROM online_media_attachments WHERE media_id = ? ORDER BY display_order ASC, id ASC`,
      [item.id]
    )
    item.attachments = (Array.isArray(attRows) ? attRows : []).map(mapAttachmentRow)

    return {
      item: sanitizeMediaItemForViewer(item, options.isAuthenticated),
      requiresAuth: false,
    }
  }

  /**
   * Fetches raw MinIO storage metadata for server-side streaming authorization.
   */
  static async getRawMediaStreamTarget(
    mediaId: number,
    options?: { attachmentId?: number | null },
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<{
    item: OnlineMediaItemRecord
    attachment?: OnlineMediaAttachmentRecord
  } | null> {
    if (queryFn === queryMemberDb) {
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

    await ensureOnlineMediaTables(queryFn)

    const rows = await queryFn(
      `SELECT
        i.*,
        (
          SELECT m.profile_path
          FROM members m
          WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
             OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
          LIMIT 1
        ) AS createdByProfilePath
      FROM online_media_items i
      WHERE i.id = ?
      LIMIT 1`,
      [mediaId]
    )
    if (!rows?.[0]) return null

    const item = mapMediaItemRow(rows[0])
    if (options?.attachmentId) {
      const attRows = await queryFn(
        `SELECT * FROM online_media_attachments WHERE id = ? AND media_id = ? LIMIT 1`,
        [options.attachmentId, mediaId]
      )
      if (!attRows?.[0]) return null
      return { item, attachment: mapAttachmentRow(attRows[0]) }
    }

    return { item }
  }

  /**
   * Fetches raw media item with S3 keys for backoffice management edit modal.
   */
  static async getMediaItemForManage(
    mediaId: number,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaItemRecord | null> {
    if (queryFn === queryMemberDb) {
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

    await ensureOnlineMediaTables(queryFn)

    const rows = await queryFn(
      `SELECT i.*, c.name AS categoryName
       FROM online_media_items i
       LEFT JOIN online_media_categories c ON c.id = i.category_id
       WHERE i.id = ? LIMIT 1`,
      [mediaId]
    )
    if (!rows?.[0]) return null

    const item = mapMediaItemRow(rows[0])
    const attRows = await queryFn(
      `SELECT * FROM online_media_attachments WHERE media_id = ? ORDER BY display_order ASC, id ASC`,
      [item.id]
    )
    item.attachments = (Array.isArray(attRows) ? attRows : []).map(mapAttachmentRow)
    return item
  }

  static async recordMediaView(
    mediaId: number,
    viewer?: { memberId: number; memberName: string; memberDepartment?: string | null } | null,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<void> {
    if (queryFn === queryMemberDb) {
      await apiGateway.app.recordOnlineMediaView(mediaId, viewer)
      return
    }

    await ensureOnlineMediaTables(queryFn)

    await queryFn(
      `UPDATE online_media_items SET view_count = view_count + 1 WHERE id = ?`,
      [mediaId]
    )

    if (viewer?.memberId) {
      const cleanName = (viewer.memberName || 'บุคลากร').trim()
      const cleanDept = viewer.memberDepartment ? viewer.memberDepartment.trim() : null

      await queryFn(
        `INSERT INTO online_media_views (media_id, member_id, member_name, member_department, view_count, first_viewed_at, last_viewed_at)
         VALUES (?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           view_count = view_count + 1,
           last_viewed_at = NOW(),
           member_name = VALUES(member_name),
           member_department = VALUES(member_department)`,
        [mediaId, viewer.memberId, cleanName, cleanDept]
      )
    }
  }

  static async listMediaViewers(
    mediaId: number,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaViewRecord[]> {
    if (queryFn === queryMemberDb) {
      const rows = await apiGateway.app.getOnlineMediaViewers(mediaId)
      return (Array.isArray(rows) ? rows : []).map(mapViewRow)
    }

    await ensureOnlineMediaTables(queryFn)

    const rows = await queryFn(
      `SELECT
        id,
        media_id AS mediaId,
        member_id AS memberId,
        member_name AS memberName,
        member_department AS memberDepartment,
        view_count AS viewCount,
        first_viewed_at AS firstViewedAt,
        last_viewed_at AS lastViewedAt
      FROM online_media_views
      WHERE media_id = ?
      ORDER BY last_viewed_at DESC, id DESC`,
      [mediaId]
    )

    return (Array.isArray(rows) ? rows : []).map(mapViewRow)
  }

  static async createMediaItem(
    input: SaveMediaItemInput,
    actor: MediaActor,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaItemRecord> {
    await ensureOnlineMediaTables(queryFn)

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

    const bucket = data.sourceType === 'MINIO'
      ? data.s3Bucket || resolveBucketForVisibility(data.visibility)
      : data.thumbnailS3Key
      ? resolveBucketForVisibility(data.visibility)
      : null

    const slug = generateMediaSlug(data.title)

    if (queryFn === queryMemberDb) {
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

    const catRows = await queryFn(`SELECT id FROM online_media_categories WHERE id = ?`, [data.categoryId])
    if (!catRows?.[0]) {
      throw new OnlineMediaValidationError('ไม่พบหมวดหมู่สื่อที่เลือก')
    }

    const res = await queryFn(
      `INSERT INTO online_media_items (
        slug, title, description, category_id, visibility, media_type, source_type,
        s3_bucket, s3_key, youtube_url, thumbnail_s3_key, file_name, file_size, mime_type,
        allow_download, is_published, view_count, created_by_id, created_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW())`,
      [
        slug,
        data.title,
        data.description || null,
        data.categoryId,
        data.visibility,
        data.mediaType,
        data.sourceType,
        bucket,
        data.sourceType === 'MINIO' ? data.s3Key : null,
        data.sourceType === 'YOUTUBE' ? data.youtubeUrl : null,
        data.thumbnailS3Key || null,
        data.fileName || null,
        data.fileSize ?? null,
        data.mimeType || null,
        data.allowDownload ? 1 : 0,
        data.isPublished ? 1 : 0,
        actor.id ?? null,
        actor.name || actor.username,
      ]
    )

    const createdId = Number(res?.insertId || res?.[0]?.insertId)

    for (let i = 0; i < data.attachments.length; i++) {
      const att = data.attachments[i]
      await queryFn(
        `INSERT INTO online_media_attachments (
          media_id, title, s3_bucket, s3_key, file_name, file_size, mime_type, display_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          createdId,
          att.title,
          att.s3Bucket,
          att.s3Key,
          att.fileName,
          att.fileSize ?? null,
          att.mimeType || null,
          att.displayOrder ?? i,
        ]
      )
    }

    await logAudit(
      'CREATE',
      'online_media_items',
      `เพิ่มสื่อออนไลน์ "${data.title}" (${data.visibility}/${data.mediaType}) โดย ${actor.username}`,
      actor
    )

    const created = await this.getMediaItemForManage(createdId, queryFn)
    if (!created) {
      throw new Error('ไม่สามารถโหลดข้อมูลสื่อที่สร้างได้')
    }
    return created
  }

  static async updateMediaItem(
    id: number,
    input: Partial<SaveMediaItemInput>,
    actor: MediaActor,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<OnlineMediaItemRecord> {
    await ensureOnlineMediaTables(queryFn)

    const existing = await this.getMediaItemForManage(id, queryFn)
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

    // Clean up replaced primary S3 file if changed or switched to YouTube
    if (existing.s3Key && existing.s3Bucket) {
      const nextPrimaryKey = data.sourceType === 'MINIO' ? data.s3Key : null
      if (existing.s3Key !== nextPrimaryKey) {
        await DocumentStorage.deleteFromS3Only({
          bucket: existing.s3Bucket,
          s3Key: existing.s3Key,
        })
      }
    }

    // Clean up replaced thumbnail
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

    if (queryFn === queryMemberDb) {
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

    await queryFn(
      `UPDATE online_media_items
       SET title = ?, description = ?, category_id = ?, visibility = ?, media_type = ?, source_type = ?,
           s3_bucket = ?, s3_key = ?, youtube_url = ?, thumbnail_s3_key = ?,
           file_name = ?, file_size = ?, mime_type = ?, allow_download = ?, is_published = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        data.title,
        data.description || null,
        data.categoryId,
        data.visibility,
        data.mediaType,
        data.sourceType,
        nextBucket,
        data.sourceType === 'MINIO' ? data.s3Key : null,
        data.sourceType === 'YOUTUBE' ? data.youtubeUrl : null,
        data.thumbnailS3Key || null,
        data.sourceType === 'MINIO' ? data.fileName || null : null,
        data.sourceType === 'MINIO' ? data.fileSize ?? null : null,
        data.sourceType === 'MINIO' ? data.mimeType || null : null,
        data.allowDownload ? 1 : 0,
        data.isPublished ? 1 : 0,
        id,
      ]
    )

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

      await queryFn(`DELETE FROM online_media_attachments WHERE media_id = ?`, [id])
      for (let i = 0; i < data.attachments.length; i++) {
        const att = data.attachments[i]
        await queryFn(
          `INSERT INTO online_media_attachments (
            media_id, title, s3_bucket, s3_key, file_name, file_size, mime_type, display_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            id,
            att.title,
            att.s3Bucket,
            att.s3Key,
            att.fileName,
            att.fileSize ?? null,
            att.mimeType || null,
            att.displayOrder ?? i,
          ]
        )
      }
    }

    await logAudit(
      'UPDATE',
      'online_media_items',
      `แก้ไขสื่อออนไลน์ "${data.title}" (ID: ${id}) โดย ${actor.username}`,
      actor
    )

    const updated = await this.getMediaItemForManage(id, queryFn)
    if (!updated) {
      throw new Error('ไม่สามารถโหลดข้อมูลสื่อหลังอัปเดตได้')
    }
    return updated
  }

  static async deleteMediaItem(
    id: number,
    actor: MediaActor,
    queryFn: QueryExecutor = queryMemberDb
  ): Promise<void> {
    await ensureOnlineMediaTables(queryFn)

    const existing = await this.getMediaItemForManage(id, queryFn)
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

    if (queryFn === queryMemberDb) {
      await apiGateway.app.deleteOnlineMediaItem(id)
    } else {
      await queryFn(`DELETE FROM online_media_items WHERE id = ?`, [id])
    }

    await logAudit(
      'DELETE',
      'online_media_items',
      `ลบสื่อออนไลน์ "${existing.title}" (ID: ${id}) โดย ${actor.username}`,
      actor
    )
  }
}
