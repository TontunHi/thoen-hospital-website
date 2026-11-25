import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'
import {
  isS3Configured,
  uploadToS3,
  deleteFromS3,
  getObjectFromS3,
  checkMinioHealth,
  ensureStorageBucketsExist,
  createMultipartUploadS3,
  uploadPartS3,
  completeMultipartUploadS3,
  abortMultipartUploadS3,
  S3_CONFIG,
} from './s3Client'

export { checkMinioHealth, ensureStorageBucketsExist }

export interface StorageSaveOptions {
  /**
   * Destination subdirectory relative to project root (e.g., 'public/uploads/news', 'public/documents/ethics/2568', 'storage/user123')
   */
  destinationDir: string

  /**
   * Allowed MIME types. Default permits common images and PDF.
   */
  allowedMimeTypes?: string[]

  /**
   * Allowed file extensions including dot (e.g., ['.pdf', '.jpg', '.png']).
   */
  allowedExtensions?: string[]

  /**
   * Maximum permitted file size in bytes. Defaults to 25MB.
   */
  maxSizeBytes?: number

  /**
   * Suggested base name for the file (will be sanitized).
   */
  baseName?: string

  /**
   * Strategy for resolving filename:
   * - 'timestamp': appends timestamp and random suffix (default)
   * - 'increment': appends _1, _2 if file exists
   * - 'fixed': uses exact baseName + ext without suffix (overwrites existing if any)
   */
  collisionStrategy?: 'timestamp' | 'increment' | 'fixed'

  /**
   * Allowed base directories to prevent path traversal outside app boundaries.
   * Defaults to ['public/uploads', 'public/documents', 'storage']
   */
  allowedRootPrefixes?: string[]
}

export interface StoredFileResult {
  publicUrl: string
  relativePath: string
  diskPath: string
  fileName: string
  fileSize: number
  mimeType: string
}

export class StorageValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR') {
    super(message)
    this.name = 'StorageValidationError'
  }
}

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
]

const DEFAULT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4']

const ONLINE_MEDIA_ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  'video/x-msvideo',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

const ONLINE_MEDIA_ALLOWED_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.mkv',
  '.avi',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
]

const EXT_TO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8',
}

function resolveMimeTypeFromExtension(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream'
}

function assertAllowedS3Bucket(bucket: string): string {
  if (bucket !== S3_CONFIG.publicBucket && bucket !== S3_CONFIG.privateBucket) {
    throw new StorageValidationError(`Invalid S3 bucket: ${bucket}`, 'INVALID_BUCKET')
  }
  return bucket
}

function sanitizeS3Prefix(prefix: string): string {
  const clean = prefix.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!clean || clean.includes('..') || path.isAbsolute(prefix)) {
    throw new StorageValidationError('Invalid S3 key prefix', 'PATH_TRAVERSAL')
  }
  return clean
}

function validateAndBuildS3Key(params: {
  keyPrefix: string
  originalName: string
  baseName?: string
  mimeType: string
  fileSize: number
  allowedMimeTypes?: string[]
  allowedExtensions?: string[]
  maxSizeBytes: number
}): { s3Key: string; fileName: string; mimeType: string } {
  const safePrefix = sanitizeS3Prefix(params.keyPrefix)
  const allowedMimes = params.allowedMimeTypes || ONLINE_MEDIA_ALLOWED_MIME_TYPES
  const allowedExts = (params.allowedExtensions || ONLINE_MEDIA_ALLOWED_EXTENSIONS).map((e) => {
    const lower = e.toLowerCase().trim()
    return lower.startsWith('.') ? lower : `.${lower}`
  })

  const effectiveMaxSize =
    Number.isFinite(params.maxSizeBytes) && params.maxSizeBytes > 0
      ? params.maxSizeBytes
      : 10 * 1024 * 1024 * 1024

  if (params.fileSize > effectiveMaxSize) {
    const limitLabel =
      effectiveMaxSize >= 1024 * 1024 * 1024
        ? `${(effectiveMaxSize / (1024 * 1024 * 1024)).toFixed(0)}GB`
        : `${Math.round(effectiveMaxSize / (1024 * 1024))}MB`
    throw new StorageValidationError(`ขนาดไฟล์เกินกำหนด (สูงสุด ${limitLabel})`, 'FILE_TOO_LARGE')
  }

  if (params.fileSize <= 0) {
    throw new StorageValidationError('ไฟล์มีขนาด 0 byte หรือว่างเปล่า', 'EMPTY_FILE')
  }

  const origExt = path.extname(params.originalName).toLowerCase()
  const baseExt = params.baseName ? path.extname(params.baseName).toLowerCase() : ''
  const inferredExt =
    params.mimeType === 'application/pdf'
      ? '.pdf'
      : params.mimeType === 'video/mp4'
      ? '.mp4'
      : params.mimeType === 'video/webm'
      ? '.webm'
      : '.jpg'
  const ext = baseExt && allowedExts.includes(baseExt) ? baseExt : origExt || inferredExt

  if (!allowedExts.includes(ext)) {
    throw new StorageValidationError(`ไม่อนุญาตไฟล์นามสกุล ${ext}`, 'INVALID_EXTENSION')
  }

  const normalizedMime = params.mimeType && params.mimeType !== 'application/octet-stream'
    ? params.mimeType
    : resolveMimeTypeFromExtension(ext)

  if (allowedMimes.length > 0 && normalizedMime !== 'application/octet-stream') {
    if (!allowedMimes.includes(normalizedMime)) {
      throw new StorageValidationError(`ไม่อนุญาตประเภทไฟล์ ${normalizedMime}`, 'INVALID_MIME_TYPE')
    }
  }

  const rawBase = params.baseName
    ? baseExt && allowedExts.includes(baseExt)
      ? path.basename(params.baseName, baseExt)
      : params.baseName
    : path.basename(params.originalName, origExt)
  const safeBase = sanitizeName(rawBase, 60) || 'media'
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const fileName = `${safeBase}-${uniqueSuffix}${ext}`

  return {
    s3Key: `${safePrefix}/${fileName}`,
    fileName,
    mimeType: normalizedMime,
  }
}

export const MAX_MULTIPART_MEDIA_SIZE_BYTES = 10 * 1024 * 1024 * 1024 // 10GB

async function withBucketEnsureRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const errObj = err as { name?: string; Code?: string }
    if (errObj?.name === 'NoSuchBucket' || errObj?.Code === 'NoSuchBucket') {
      await ensureStorageBucketsExist()
      return await fn()
    }
    throw err
  }
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024 // 25MB

const DEFAULT_ALLOWED_ROOT_PREFIXES = ['public/uploads', 'public/documents', 'storage']

/**
 * Sanitize a string to be safely used as a filename or directory name.
 */
export function sanitizeName(name: string, maxLength = 80): string {
  const sanitized = name
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()

  return sanitized.length > maxLength
    ? sanitized.slice(0, maxLength).trim().replace(/[. _-]+$/, '')
    : sanitized
}

/**
 * Validate that a relative path strictly falls within allowed project roots.
 */
function assertSafePath(targetRelPath: string, allowedRoots: string[]): string {
  // Normalize and prevent backward slashes
  const normalized = path.normalize(targetRelPath).replace(/\\/g, '/')
  
  // Guard against path traversal attempts
  if (normalized.includes('..') || path.isAbsolute(targetRelPath)) {
    throw new StorageValidationError('Invalid path traversal detected', 'PATH_TRAVERSAL')
  }

  const isAllowed = allowedRoots.some(root => {
    const normRoot = path.normalize(root).replace(/\\/g, '/')
    return normalized === normRoot || normalized.startsWith(normRoot + '/')
  })

  if (!isAllowed) {
    throw new StorageValidationError(`Path outside allowed directories: ${targetRelPath}`, 'INVALID_DIRECTORY')
  }

  return normalized
}

export const DocumentStorage = {
  /**
   * Save a file (Web File or Buffer) into the managed storage system.
   */
  async save(
    file: File | { name: string; type?: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | Buffer,
    options: StorageSaveOptions
  ): Promise<StoredFileResult> {
    const allowedRoots = options.allowedRootPrefixes || DEFAULT_ALLOWED_ROOT_PREFIXES
    const safeDestDir = assertSafePath(options.destinationDir, allowedRoots)
    const allowedMimes = options.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES
    const allowedExts = (options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS).map(e => {
      const lower = e.toLowerCase().trim()
      return lower.startsWith('.') ? lower : `.${lower}`
    })
    const maxSize = options.maxSizeBytes || DEFAULT_MAX_SIZE
    const strategy = options.collisionStrategy || 'timestamp'

    let buffer: Buffer
    let originalName = 'file'
    let mimeType = 'application/octet-stream'
    let fileSize = 0

    if (Buffer.isBuffer(file)) {
      buffer = file
      fileSize = buffer.length
      originalName = options.baseName || 'file'
      mimeType = options.allowedMimeTypes?.[0] || 'application/octet-stream'
    } else {
      originalName = file.name || options.baseName || 'file'
      mimeType = file.type || 'application/octet-stream'
      fileSize = file.size
      buffer = Buffer.from(await file.arrayBuffer())
    }

    // Filename length validation (enforce max 80 characters to prevent Windows MAX_PATH/URL overflow)
    const candidateName = options.baseName || originalName
    if (candidateName && candidateName.length > 80) {
      throw new StorageValidationError(
        `ไม่อนุญาตให้ตั้งชื่อไฟล์ยาวเกิน 80 ตัวอักษร (ชื่อไฟล์ปัจจุบัน: ${candidateName.length} ตัวอักษร) กรุณาเปลี่ยนชื่อไฟล์ให้สั้นลง`,
        'FILENAME_TOO_LONG'
      )
    }

    // Size validation
    if (fileSize > maxSize) {
      const mbLimit = Math.round(maxSize / (1024 * 1024))
      throw new StorageValidationError(`ขนาดไฟล์เกินกำหนด (สูงสุด ${mbLimit}MB)`, 'FILE_TOO_LARGE')
    }

    if (fileSize === 0) {
      throw new StorageValidationError('ไฟล์มีขนาด 0 byte หรือว่างเปล่า', 'EMPTY_FILE')
    }

    // Extension & MIME validation
    const origExt = path.extname(originalName).toLowerCase()
    const baseExt = options.baseName ? path.extname(options.baseName).toLowerCase() : ''
    
    // If baseName has an explicitly recognized extension, respect it; otherwise use original file's extension
    const ext = (baseExt && allowedExts.includes(baseExt))
      ? baseExt
      : (origExt || (mimeType === 'application/pdf' ? '.pdf' : mimeType === 'video/mp4' ? '.mp4' : '.jpg'))
    
    if (!allowedExts.includes(ext)) {
      throw new StorageValidationError(`ไม่อนุญาตไฟล์นามสกุล ${ext}`, 'INVALID_EXTENSION')
    }

    if (allowedMimes.length > 0 && mimeType !== 'application/octet-stream') {
      if (!allowedMimes.includes(mimeType)) {
        throw new StorageValidationError(`ไม่อนุญาตประเภทไฟล์ ${mimeType}`, 'INVALID_MIME_TYPE')
      }
    }

    // Clean base name: only strip extension if candidate actually had that recognized extension
    const rawBase = options.baseName
      ? (baseExt && allowedExts.includes(baseExt) ? path.basename(options.baseName, baseExt) : options.baseName)
      : path.basename(originalName, origExt)
    const safeBase = sanitizeName(rawBase, 50) || 'file'

    // Build directory on disk
    const absoluteDirPath = path.join(/*turbopackIgnore: true*/ process.cwd(), safeDestDir)
    await fs.mkdir(absoluteDirPath, { recursive: true })

    // Resolve final filename based on collision strategy
    let finalFileName: string
    if (strategy === 'fixed') {
      finalFileName = `${safeBase}${ext}`
    } else if (strategy === 'increment') {
      let candidate = `${safeBase}${ext}`
      let count = 1
      while (fsSync.existsSync(path.join(/*turbopackIgnore: true*/ absoluteDirPath, candidate))) {
        candidate = `${safeBase}_${count}${ext}`
        count++
      }
      finalFileName = candidate
    } else {
      // timestamp
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      finalFileName = `${safeBase}-${uniqueSuffix}${ext}`
    }

    const absoluteFilePath = path.join(/*turbopackIgnore: true*/ absoluteDirPath, finalFileName)
    await fs.writeFile(absoluteFilePath, buffer)

    // Build public URL and relative path
    const relativePath = `${safeDestDir}/${finalFileName}`
    let publicUrl = relativePath
    if (relativePath.startsWith('public/')) {
      publicUrl = '/' + relativePath.substring('public/'.length)
    } else {
      publicUrl = '/' + relativePath
    }

    // Mirror to MinIO / S3 Object Storage if configured
    if (isS3Configured()) {
      try {
        const isPrivate = safeDestDir.startsWith('storage') || safeDestDir.includes('private')
        const bucket = isPrivate ? S3_CONFIG.privateBucket : S3_CONFIG.publicBucket
        const s3Key = relativePath.startsWith('public/') ? relativePath.substring('public/'.length) : relativePath
        await uploadToS3({
          bucket,
          key: s3Key,
          body: buffer,
          contentType: mimeType,
        })
      } catch (s3Err: unknown) {
        logger.warn({ relativePath, s3Err }, '[DocumentStorage] S3 upload failed, kept on local disk')
      }
    }

    return {
      publicUrl,
      relativePath,
      diskPath: absoluteFilePath,
      fileName: finalFileName,
      fileSize: buffer.length,
      mimeType,
    }
  },

  /**
   * Delete a file safely from disk.
   */
  async delete(
    targetPath: string | null | undefined,
    allowedRoots: string[] = DEFAULT_ALLOWED_ROOT_PREFIXES
  ): Promise<boolean> {
    if (!targetPath) return false

    // Normalize path to relative format from project root
    let relPath = targetPath.trim().replace(/\\/g, '/')
    if (relPath.startsWith('/')) {
      relPath = relPath.substring(1)
    }

    // If starts with uploads/ or documents/, map to public/uploads or public/documents
    if (relPath.startsWith('uploads/') || relPath.startsWith('documents/')) {
      relPath = 'public/' + relPath
    }

    try {
      assertSafePath(relPath, allowedRoots)
    } catch {
      return false
    }

    // Delete from MinIO / S3 if configured
    if (isS3Configured()) {
      try {
        const isPrivate = relPath.startsWith('storage') || relPath.includes('private')
        const bucket = isPrivate ? S3_CONFIG.privateBucket : S3_CONFIG.publicBucket
        const s3Key = relPath.startsWith('public/') ? relPath.substring('public/'.length) : relPath
        await deleteFromS3({ bucket, key: s3Key })
      } catch (s3Err: unknown) {
        logger.warn({ relPath, s3Err }, '[DocumentStorage] S3 delete failed')
      }
    }

    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    try {
      await fs.unlink(absolutePath)
      return true
    } catch {
      // File already missing or deleted
      return false
    }
  },

  /**
   * Replace an existing file with a new one atomically (writes new file first, then unlinks old).
   */
  async replace(
    oldPath: string | null | undefined,
    newFile: File | { name: string; type?: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | Buffer,
    options: StorageSaveOptions
  ): Promise<StoredFileResult> {
    const saved = await this.save(newFile, options)
    if (oldPath) {
      let normOld = oldPath.trim().replace(/\\/g, '/')
      if (!normOld.startsWith('/')) normOld = '/' + normOld
      let normNew = saved.publicUrl.trim().replace(/\\/g, '/')
      if (!normNew.startsWith('/')) normNew = '/' + normNew

      if (normOld !== normNew) {
        await this.delete(oldPath, options.allowedRootPrefixes)
      }
    }
    return saved
  },

  /**
   * Helper to format standard date subdirectory path.
   * - 'daily': public/uploads/<subDir>/DD-MM-YYYY
   * - 'monthly': public/uploads/<subDir>/YYYY/MM
   * - 'yearly': public/uploads/<subDir>/YYYY
   */
  formatDateDirectory(
    subDir: string,
    dateInput?: string | Date | null,
    mode: 'daily' | 'monthly' | 'yearly' = 'daily'
  ): string {
    let d = new Date()
    if (dateInput) {
      const parsed = new Date(dateInput)
      if (!isNaN(parsed.getTime())) {
        d = parsed
      }
    }

    const year = String(d.getFullYear())
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')

    const cleanSubDir = subDir.replace(/^\/+|\/+$/g, '')

    let datePart = `${day}-${month}-${year}`
    if (mode === 'monthly') {
      datePart = `${year}/${month}`
    } else if (mode === 'yearly') {
      datePart = `${year}`
    }

    return cleanSubDir ? `${cleanSubDir}/${datePart}` : datePart
  },

  /**
   * Save multiple files in a batch operation.
   */
  async saveBatch(
    files: (File | { name: string; type?: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | Buffer)[],
    options: StorageSaveOptions
  ): Promise<StoredFileResult[]> {
    if (!files || files.length === 0) {
      return []
    }

    const results: StoredFileResult[] = []
    for (const file of files) {
      const saved = await this.save(file, options)
      results.push(saved)
    }
    return results
  },

  /**
   * Reads a file and returns its raw Buffer.
   * Throws StorageValidationError with code 'FILE_NOT_FOUND' if it doesn't exist.
   */
  async readBuffer(relativePath: string, allowedRoots: string[] = DEFAULT_ALLOWED_ROOT_PREFIXES): Promise<Buffer> {
    let relPath = relativePath.trim().replace(/\\/g, '/')
    if (relPath.startsWith('/')) relPath = relPath.substring(1)
    if (relPath.startsWith('uploads/') || relPath.startsWith('documents/')) relPath = 'public/' + relPath

    assertSafePath(relPath, allowedRoots)

    // Try reading from MinIO / S3 first
    if (isS3Configured()) {
      try {
        const isPrivate = relPath.startsWith('storage') || relPath.includes('private')
        const bucket = isPrivate ? S3_CONFIG.privateBucket : S3_CONFIG.publicBucket
        const s3Key = relPath.startsWith('public/') ? relPath.substring('public/'.length) : relPath
        const s3Res = await getObjectFromS3({ bucket, key: s3Key })
        if (s3Res.Body) {
          const bodyAny = s3Res.Body as any
          if (typeof bodyAny.transformToByteArray === 'function') {
            const bytes = await bodyAny.transformToByteArray()
            return Buffer.from(bytes)
          }
        }
      } catch (s3Err: unknown) {
        const errObj = s3Err as { name?: string; $metadata?: { httpStatusCode?: number } }
        if (errObj?.name !== 'NoSuchKey' && errObj?.$metadata?.httpStatusCode !== 404) {
          logger.warn({ relPath, s3Err }, '[DocumentStorage] S3 readBuffer failed')
        }
      }
    }

    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    try {
      const stat = await fs.stat(absolutePath)
      if (!stat.isFile()) throw new StorageValidationError('Not a file', 'FILE_NOT_FOUND')
      return await fs.readFile(absolutePath)
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'ENOENT') {
        throw new StorageValidationError('File not found', 'FILE_NOT_FOUND')
      }
      throw e
    }
  },

  /**
   * Serves a file as a streaming Response (HTTP 206) or full file (HTTP 200).
   */
  async serveFile(relativePath: string, req: Request, allowedRoots: string[] = DEFAULT_ALLOWED_ROOT_PREFIXES): Promise<Response> {
    let relPath = relativePath.trim().replace(/\\/g, '/')
    if (relPath.startsWith('/')) relPath = relPath.substring(1)
    if (relPath.startsWith('uploads/') || relPath.startsWith('documents/')) relPath = 'public/' + relPath

    try {
      assertSafePath(relPath, allowedRoots)
    } catch {
      return new Response('Forbidden', { status: 403 })
    }

    // Try streaming from MinIO / S3 first
    if (isS3Configured()) {
      try {
        const isPrivate = relPath.startsWith('storage') || relPath.includes('private')
        const bucket = isPrivate ? S3_CONFIG.privateBucket : S3_CONFIG.publicBucket
        const s3Key = relPath.startsWith('public/') ? relPath.substring('public/'.length) : relPath
        const rangeHeader = req.headers.get('range') || undefined
        const s3Res = await getObjectFromS3({ bucket, key: s3Key, range: rangeHeader })

        if (s3Res.Body) {
          const contentType = s3Res.ContentType || 'application/octet-stream'
          const contentLength = s3Res.ContentLength
          const contentRange = s3Res.ContentRange
          const isPartial = Boolean(rangeHeader && contentRange)

          const bodyAny = s3Res.Body as any
          const webStream = typeof bodyAny.transformToWebStream === 'function'
            ? bodyAny.transformToWebStream()
            : (require('stream').Readable.toWeb(bodyAny) as ReadableStream)

          const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          }
          if (contentLength !== undefined) headers['Content-Length'] = String(contentLength)
          if (contentRange) headers['Content-Range'] = contentRange

          return new Response(webStream, {
            status: isPartial ? 206 : 200,
            headers,
          })
        }
      } catch (s3Err: unknown) {
        const errObj = s3Err as { name?: string; $metadata?: { httpStatusCode?: number } }
        if (errObj?.name !== 'NoSuchKey' && errObj?.$metadata?.httpStatusCode !== 404) {
          logger.warn({ relPath, s3Err }, '[DocumentStorage] S3 serveFile failed')
        }
      }
    }

    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    let stat;
    try {
      stat = await fs.stat(absolutePath)
      if (!stat.isFile()) return new Response('Not Found', { status: 404 })
    } catch (_e: unknown) {
      return new Response('Not Found', { status: 404 })
    }

    const fileSize = stat.size
    const ext = path.extname(absolutePath).toLowerCase()
    const contentType = resolveMimeTypeFromExtension(ext)

    const rangeHeader = req.headers.get('range')

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize || start > end || isNaN(start)) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } })
      }

      const chunksize = end - start + 1
      const stream = fsSync.createReadStream(absolutePath, { start, end })
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const webStream = require('stream').Readable.toWeb(stream) as ReadableStream

      return new Response(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunksize),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    const stream = fsSync.createReadStream(absolutePath)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webStream = require('stream').Readable.toWeb(stream) as ReadableStream

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  },

  async createDirectory(relativePath: string, allowedRoots: string[] = DEFAULT_ALLOWED_ROOT_PREFIXES): Promise<void> {
    let relPath = relativePath.trim().replace(/\\/g, '/')
    if (relPath.startsWith('/')) relPath = relPath.substring(1)
    if (relPath.startsWith('uploads/') || relPath.startsWith('documents/')) relPath = 'public/' + relPath
    assertSafePath(relPath, allowedRoots)
    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    await fs.mkdir(absolutePath, { recursive: true })
  },

  async renameDirectory(oldRelPath: string, newRelPath: string, allowedRoots: string[] = DEFAULT_ALLOWED_ROOT_PREFIXES): Promise<void> {
    let oldP = oldRelPath.trim().replace(/\\/g, '/')
    if (oldP.startsWith('/')) oldP = oldP.substring(1)
    if (oldP.startsWith('uploads/') || oldP.startsWith('documents/')) oldP = 'public/' + oldP
    assertSafePath(oldP, allowedRoots)
    const absoluteOld = path.join(/*turbopackIgnore: true*/ process.cwd(), oldP)

    let newP = newRelPath.trim().replace(/\\/g, '/')
    if (newP.startsWith('/')) newP = newP.substring(1)
    if (newP.startsWith('uploads/') || newP.startsWith('documents/')) newP = 'public/' + newP
    assertSafePath(newP, allowedRoots)
    const absoluteNew = path.join(/*turbopackIgnore: true*/ process.cwd(), newP)

    try {
      await fs.access(absoluteOld)
      await fs.rename(absoluteOld, absoluteNew)
    } catch {
      await fs.mkdir(absoluteNew, { recursive: true })
    }
  },

  async deleteDirectory(relativePath: string, allowedRoots: string[] = DEFAULT_ALLOWED_ROOT_PREFIXES): Promise<void> {
    let relPath = relativePath.trim().replace(/\\/g, '/')
    if (relPath.startsWith('/')) relPath = relPath.substring(1)
    if (relPath.startsWith('uploads/') || relPath.startsWith('documents/')) relPath = 'public/' + relPath
    assertSafePath(relPath, allowedRoots)
    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    try {
      await fs.rm(absolutePath, { recursive: true, force: true })
    } catch {
      // ignore
    }
  },

  /**
   * Upload a file directly to MinIO / S3 without duplicating to local disk.
   */
  async saveToS3Only(
    file: File | { name: string; type?: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | Buffer,
    options: {
      bucket: string
      keyPrefix: string
      baseName?: string
      allowedMimeTypes?: string[]
      allowedExtensions?: string[]
      maxSizeBytes?: number
    }
  ): Promise<{ bucket: string; s3Key: string; fileName: string; fileSize: number; mimeType: string }> {
    if (!isS3Configured()) {
      throw new StorageValidationError('ระบบจัดเก็บไฟล์ MinIO ยังไม่พร้อมใช้งาน', 'S3_NOT_CONFIGURED')
    }
    const bucket = assertAllowedS3Bucket(options.bucket)

    let buffer: Buffer
    let originalName = 'media'
    let mimeType = 'application/octet-stream'
    let fileSize = 0

    if (Buffer.isBuffer(file)) {
      buffer = file
      fileSize = buffer.length
      originalName = options.baseName || 'media'
      mimeType = options.allowedMimeTypes?.[0] || 'application/octet-stream'
    } else {
      originalName = file.name || options.baseName || 'media'
      mimeType = file.type || 'application/octet-stream'
      fileSize = file.size
      buffer = Buffer.from(await file.arrayBuffer())
    }

    const validated = validateAndBuildS3Key({
      keyPrefix: options.keyPrefix,
      originalName,
      baseName: options.baseName,
      mimeType,
      fileSize,
      allowedMimeTypes: options.allowedMimeTypes,
      allowedExtensions: options.allowedExtensions,
      maxSizeBytes: options.maxSizeBytes ?? 50 * 1024 * 1024,
    })

    const uploaded = await withBucketEnsureRetry(() =>
      uploadToS3({
        bucket,
        key: validated.s3Key,
        body: buffer,
        contentType: validated.mimeType,
        cacheControl: bucket === S3_CONFIG.publicBucket ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
      })
    )

    return {
      bucket: uploaded.bucket,
      s3Key: uploaded.key,
      fileName: validated.fileName,
      fileSize: buffer.length,
      mimeType: validated.mimeType,
    }
  },

  /**
   * Initialize a chunked S3 Multipart upload for large media files (up to 10GB) directly on MinIO.
   */
  async initMultipartS3(options: {
    bucket: string
    keyPrefix: string
    fileName: string
    mimeType: string
    fileSize: number
    allowedMimeTypes?: string[]
    allowedExtensions?: string[]
    maxSizeBytes?: number
  }): Promise<{ bucket: string; s3Key: string; uploadId: string; fileName: string; mimeType: string }> {
    if (!isS3Configured()) {
      throw new StorageValidationError('ระบบจัดเก็บไฟล์ MinIO ยังไม่พร้อมใช้งาน', 'S3_NOT_CONFIGURED')
    }
    const bucket = assertAllowedS3Bucket(options.bucket)

    const validated = validateAndBuildS3Key({
      keyPrefix: options.keyPrefix,
      originalName: options.fileName,
      mimeType: options.mimeType,
      fileSize: options.fileSize,
      allowedMimeTypes: options.allowedMimeTypes,
      allowedExtensions: options.allowedExtensions,
      maxSizeBytes: options.maxSizeBytes ?? MAX_MULTIPART_MEDIA_SIZE_BYTES,
    })

    const created = await withBucketEnsureRetry(() =>
      createMultipartUploadS3({
        bucket,
        key: validated.s3Key,
        contentType: validated.mimeType,
      })
    )

    return {
      bucket: created.bucket,
      s3Key: created.key,
      uploadId: created.uploadId,
      fileName: validated.fileName,
      mimeType: validated.mimeType,
    }
  },

  /**
   * Upload a single chunk part for an active MinIO multipart upload.
   */
  async uploadMultipartPartS3(params: {
    bucket: string
    s3Key: string
    uploadId: string
    partNumber: number
    body: Buffer
  }): Promise<{ eTag: string; partNumber: number }> {
    if (!isS3Configured()) {
      throw new StorageValidationError('ระบบจัดเก็บไฟล์ MinIO ยังไม่พร้อมใช้งาน', 'S3_NOT_CONFIGURED')
    }
    const bucket = assertAllowedS3Bucket(params.bucket)
    if (!params.s3Key || params.s3Key.includes('..')) {
      throw new StorageValidationError('Invalid S3 key', 'PATH_TRAVERSAL')
    }
    return await uploadPartS3({
      bucket,
      key: params.s3Key,
      uploadId: params.uploadId,
      partNumber: params.partNumber,
      body: params.body,
    })
  },

  /**
   * Complete an active MinIO multipart upload.
   */
  async completeMultipartS3(params: {
    bucket: string
    s3Key: string
    uploadId: string
    parts: Array<{ ETag: string; PartNumber: number }>
  }): Promise<{ bucket: string; s3Key: string }> {
    if (!isS3Configured()) {
      throw new StorageValidationError('ระบบจัดเก็บไฟล์ MinIO ยังไม่พร้อมใช้งาน', 'S3_NOT_CONFIGURED')
    }
    const bucket = assertAllowedS3Bucket(params.bucket)
    if (!params.s3Key || params.s3Key.includes('..')) {
      throw new StorageValidationError('Invalid S3 key', 'PATH_TRAVERSAL')
    }
    const completed = await completeMultipartUploadS3({
      bucket,
      key: params.s3Key,
      uploadId: params.uploadId,
      parts: params.parts,
    })
    return { bucket: completed.bucket, s3Key: completed.key }
  },

  /**
   * Abort an active MinIO multipart upload.
   */
  async abortMultipartS3(params: {
    bucket: string
    s3Key: string
    uploadId: string
  }): Promise<void> {
    if (!isS3Configured()) return
    const bucket = assertAllowedS3Bucket(params.bucket)
    if (!params.s3Key || params.s3Key.includes('..')) {
      throw new StorageValidationError('Invalid S3 key', 'PATH_TRAVERSAL')
    }
    await abortMultipartUploadS3({
      bucket,
      key: params.s3Key,
      uploadId: params.uploadId,
    })
  },

  /**
   * Delete an object from MinIO / S3 directly.
   */
  async deleteFromS3Only(params: { bucket: string; s3Key: string }): Promise<boolean> {
    if (!isS3Configured() || !params.s3Key) return false
    const bucket = assertAllowedS3Bucket(params.bucket)
    if (params.s3Key.includes('..')) return false
    return await deleteFromS3({ bucket, key: params.s3Key })
  },

  /**
   * Stream an object directly from MinIO / S3 supporting HTTP 206 Partial Content Range requests.
   */
  async serveS3Object(params: {
    bucket: string
    s3Key: string
    req: Request
    fileName?: string
    download?: boolean
    isPrivate?: boolean
  }): Promise<Response> {
    if (!isS3Configured()) {
      return new Response('Storage not configured', { status: 503 })
    }
    let bucket: string
    try {
      bucket = assertAllowedS3Bucket(params.bucket)
    } catch {
      return new Response('Forbidden', { status: 403 })
    }
    if (!params.s3Key || params.s3Key.includes('..')) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const rangeHeader = params.req.headers.get('range') || undefined
      const s3Res = await getObjectFromS3({
        bucket,
        key: params.s3Key,
        range: rangeHeader,
      })

      if (!s3Res.Body) {
        return new Response('Not Found', { status: 404 })
      }

      const ext = path.extname(params.fileName || params.s3Key).toLowerCase()
      const fallbackMime = resolveMimeTypeFromExtension(ext)
      const contentType =
        s3Res.ContentType && s3Res.ContentType !== 'application/octet-stream'
          ? s3Res.ContentType
          : fallbackMime

      const isPartial = Boolean(rangeHeader && s3Res.ContentRange)
      const bodyAny = s3Res.Body as any
      const webStream =
        typeof bodyAny.transformToWebStream === 'function'
          ? bodyAny.transformToWebStream()
          : (require('stream').Readable.toWeb(bodyAny) as ReadableStream)

      const safeFileName = sanitizeName(params.fileName || path.basename(params.s3Key), 120) || 'media'
      const asciiFallback = safeFileName.replace(/[^\x20-\x7E]/g, '_') || 'media'
      const disposition = params.download
        ? `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`
        : 'inline'

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': disposition,
        'X-Frame-Options': 'SAMEORIGIN',
        'Cache-Control': params.isPrivate ? 'private, max-age=3600' : 'public, max-age=86400',
      }

      if (s3Res.ContentLength !== undefined) headers['Content-Length'] = String(s3Res.ContentLength)
      if (s3Res.ContentRange) headers['Content-Range'] = s3Res.ContentRange

      return new Response(webStream, {
        status: isPartial ? 206 : 200,
        headers,
      })
    } catch (s3Err: unknown) {
      const errObj = s3Err as { name?: string; $metadata?: { httpStatusCode?: number } }
      const status = errObj?.$metadata?.httpStatusCode
      if (errObj?.name === 'NoSuchKey' || status === 404) {
        return new Response('Not Found', { status: 404 })
      }
      if (status === 416) {
        return new Response('Range Not Satisfiable', { status: 416 })
      }
      logger.error({ bucket, s3Key: params.s3Key, s3Err }, '[DocumentStorage] serveS3Object failed')
      return new Response('Failed to stream media', { status: 502 })
    }
  }
}

