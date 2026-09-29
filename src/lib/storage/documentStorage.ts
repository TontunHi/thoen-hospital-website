import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

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
]

const DEFAULT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024 // 25MB

const DEFAULT_ALLOWED_ROOT_PREFIXES = ['public/uploads', 'public/documents', 'storage']

/**
 * Sanitize a string to be safely used as a filename or directory name.
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\.{2,}/g, '_')
    .trim()
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
    const allowedExts = (options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS).map(e => e.toLowerCase())
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

    // Size validation
    if (fileSize > maxSize) {
      const mbLimit = Math.round(maxSize / (1024 * 1024))
      throw new StorageValidationError(`ขนาดไฟล์เกินกำหนด (สูงสุด ${mbLimit}MB)`, 'FILE_TOO_LARGE')
    }

    if (fileSize === 0) {
      throw new StorageValidationError('ไฟล์มีขนาด 0 byte หรือว่างเปล่า', 'EMPTY_FILE')
    }

    // Extension & MIME validation
    const candidateName = options.baseName || originalName
    const rawExt = path.extname(candidateName).toLowerCase() || path.extname(originalName).toLowerCase()
    const ext = rawExt || (mimeType === 'application/pdf' ? '.pdf' : '.jpg')
    
    if (!allowedExts.includes(ext)) {
      throw new StorageValidationError(`ไม่อนุญาตไฟล์นามสกุล ${ext}`, 'INVALID_EXTENSION')
    }

    if (allowedMimes.length > 0 && mimeType !== 'application/octet-stream') {
      if (!allowedMimes.includes(mimeType)) {
        throw new StorageValidationError(`ไม่อนุญาตประเภทไฟล์ ${mimeType}`, 'INVALID_MIME_TYPE')
      }
    }

    // Clean base name (strip extension if present in candidate baseName)
    const rawBase = options.baseName
      ? path.basename(options.baseName, path.extname(options.baseName))
      : path.basename(originalName, rawExt)
    const safeBase = sanitizeName(rawBase) || 'file'

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
}
