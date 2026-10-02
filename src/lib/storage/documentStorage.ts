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
  'video/mp4',
]

const DEFAULT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4']

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

    if (mode === 'monthly') {
      return `${cleanSubDir}/${year}/${month}`
    } else if (mode === 'yearly') {
      return `${cleanSubDir}/${year}`
    }
    return `${cleanSubDir}/${day}-${month}-${year}`
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

    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    try {
      const stat = await fs.stat(absolutePath)
      if (!stat.isFile()) throw new StorageValidationError('Not a file', 'FILE_NOT_FOUND')
      return await fs.readFile(absolutePath)
    } catch (e: any) {
      if (e.code === 'ENOENT') throw new StorageValidationError('File not found', 'FILE_NOT_FOUND')
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
    } catch (e: any) {
      return new Response('Forbidden', { status: 403 })
    }

    const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
    let stat;
    try {
      stat = await fs.stat(absolutePath)
      if (!stat.isFile()) return new Response('Not Found', { status: 404 })
    } catch (e: any) {
      return new Response('Not Found', { status: 404 })
    }

    const fileSize = stat.size
    const ext = path.extname(absolutePath).toLowerCase()

    let contentType = 'application/octet-stream'
    if (ext === '.mp4') contentType = 'video/mp4'
    else if (ext === '.webm') contentType = 'video/webm'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.pdf') contentType = 'application/pdf'

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
  }
}

